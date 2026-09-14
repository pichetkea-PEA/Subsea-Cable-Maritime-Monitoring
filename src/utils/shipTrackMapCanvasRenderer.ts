import { CableRoute, ShipTrackPoint, ShipTrackSummaryData } from '../types';
import { generateCableBufferPolygon } from './geoUtils';

export interface RenderMapOptions {
  mode: 'overall' | 'orange_focus' | 'red_focus' | 'custom_focus';
  width: number;
  height: number;
  customTitle?: string;
  enableSatelliteBackground?: boolean;
  customFocusPoints?: ShipTrackPoint[];
  highlightCallouts?: { lat: number; lng: number; label: string; color?: string }[];
}

// In-memory satellite tile cache for high-speed reuse across pages
const tileMemoryCache = new Map<string, HTMLImageElement>();

function lon2tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

function tile2lon(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tile2lat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

async function loadSatelliteTileWithTimeout(
  z: number,
  x: number,
  y: number,
  timeoutMs = 3500
): Promise<HTMLImageElement | null> {
  const cacheKey = `${z}/${x}/${y}`;
  if (tileMemoryCache.has(cacheKey)) {
    const cached = tileMemoryCache.get(cacheKey)!;
    if (cached.complete && cached.naturalWidth > 0) {
      return cached;
    }
  }

  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

  return new Promise((resolve) => {
    let finished = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        tileMemoryCache.set(cacheKey, img);
        resolve(img);
      }
    };

    img.onerror = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    img.src = url;
  });
}

async function renderSatelliteBackgroundLayer(
  ctx: CanvasRenderingContext2D,
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  toX: (lng: number) => number,
  toY: (lat: number) => number,
  width: number,
  height: number
): Promise<boolean> {
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const maxSpan = Math.max(latSpan, lngSpan);

  let zoom = 12;
  if (maxSpan > 0.8) zoom = 10;
  else if (maxSpan > 0.4) zoom = 11;
  else if (maxSpan > 0.18) zoom = 12;
  else if (maxSpan > 0.08) zoom = 13;
  else if (maxSpan > 0.03) zoom = 14;
  else zoom = 15;

  const minTileX = lon2tileX(minLng, zoom);
  const maxTileX = lon2tileX(maxLng, zoom);
  const minTileY = lat2tileY(maxLat, zoom);
  const maxTileY = lat2tileY(minLat, zoom);

  const startX = Math.max(0, minTileX - 1);
  const endX = maxTileX + 1;
  const startY = Math.max(0, minTileY - 1);
  const endY = maxTileY + 1;

  const requests: { z: number; x: number; y: number; promise: Promise<HTMLImageElement | null> }[] = [];
  const maxTiles = 64;
  let count = 0;

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      if (count < maxTiles) {
        requests.push({
          z: zoom,
          x,
          y,
          promise: loadSatelliteTileWithTimeout(zoom, x, y, 3500),
        });
        count++;
      }
    }
  }

  const results = await Promise.allSettled(requests.map((r) => r.promise));
  let anyRendered = false;

  ctx.save();
  ctx.beginPath();
  ctx.rect(10, 10, width - 20, height - 20);
  ctx.clip();

  for (let i = 0; i < requests.length; i++) {
    const item = results[i];
    if (item.status === 'fulfilled' && item.value) {
      const img = item.value;
      const req = requests[i];

      const leftLng = tile2lon(req.x, req.z);
      const rightLng = tile2lon(req.x + 1, req.z);
      const topLat = tile2lat(req.y, req.z);
      const bottomLat = tile2lat(req.y + 1, req.z);

      const px = toX(leftLng);
      const py = toY(topLat);
      const pw = toX(rightLng) - px;
      const ph = toY(bottomLat) - py;

      ctx.drawImage(img, px - 0.5, py - 0.5, pw + 1, ph + 1);
      anyRendered = true;
    }
  }

  if (anyRendered) {
    // Semi-transparent deep maritime overlay: gives cohesive dark marine aesthetic
    // while keeping coastlines, islands, and seabed textures vividly recognizable
    ctx.fillStyle = 'rgba(6, 16, 33, 0.40)';
    ctx.fillRect(10, 10, width - 20, height - 20);
  }

  ctx.restore();
  return anyRendered;
}

/**
 * Renders a high-resolution nautical surveillance map directly to an HTML5 Canvas.
 * Produces crisp, vector-grade cartography with satellite imagery background.
 */
export async function renderShipTrackMapToCanvas(
  summaryData: ShipTrackSummaryData,
  cableRoute: CableRoute,
  options: RenderMapOptions
): Promise<HTMLCanvasElement> {
  const { mode, width, height, customTitle, enableSatelliteBackground = true } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context');
  }

  const waypoints = cableRoute?.waypoints || [];
  const points = summaryData?.points || [];

  // --- STEP 1: Compute Lat/Lng Bounding Box based on Mode ---
  let targetPoints: { lat: number; lng: number }[] = [];

  if (mode === 'orange_focus') {
    const orangePoints = points.filter((p) => p.dotColor === 'orange');
    if (orangePoints.length > 0) {
      targetPoints = orangePoints;
    } else {
      // Fallback: points inside cable zone or closest to cable
      const inZone = points.filter((p) => p.isInsideCableZone);
      targetPoints = inZone.length > 0 ? inZone : points.slice(0, 5);
    }
  } else if (mode === 'red_focus') {
    const redPoints = points.filter((p) => p.dotColor === 'red');
    if (redPoints.length > 0) {
      targetPoints = redPoints;
    } else {
      // Fallback: points with minimum SOG or closest approach
      const sortedBySog = [...points].sort((a, b) => a.sog - b.sog);
      targetPoints = sortedBySog.slice(0, 5);
    }
  } else if (mode === 'custom_focus' && options.customFocusPoints && options.customFocusPoints.length > 0) {
    targetPoints = options.customFocusPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
  } else {
    // Mode === 'overall': include all track points + cable waypoints
    targetPoints = [...points.map((p) => ({ lat: p.lat, lng: p.lng })), ...waypoints];
  }

  if (targetPoints.length === 0) {
    targetPoints = [
      { lat: 9.35, lng: 99.85 },
      { lat: 9.50, lng: 100.05 },
    ];
  }

  let minLat = Math.min(...targetPoints.map((p) => p.lat));
  let maxLat = Math.max(...targetPoints.map((p) => p.lat));
  let minLng = Math.min(...targetPoints.map((p) => p.lng));
  let maxLng = Math.max(...targetPoints.map((p) => p.lng));

  // In focus mode, also include adjacent cable waypoints to give geographical context
  if (mode === 'orange_focus' || mode === 'red_focus' || mode === 'custom_focus') {
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const nearbyWaypoints = waypoints.filter((wp) => {
      const dLat = Math.abs(wp.lat - centerLat);
      const dLng = Math.abs(wp.lng - centerLng);
      return dLat < 0.06 && dLng < 0.06;
    });
    if (nearbyWaypoints.length > 0) {
      minLat = Math.min(minLat, ...nearbyWaypoints.map((w) => w.lat));
      maxLat = Math.max(maxLat, ...nearbyWaypoints.map((w) => w.lat));
      minLng = Math.min(minLng, ...nearbyWaypoints.map((w) => w.lng));
      maxLng = Math.max(maxLng, ...nearbyWaypoints.map((w) => w.lng));
    }
  }

  // Add geographic padding
  const baseLatSpan = Math.max(maxLat - minLat, 0.005);
  const baseLngSpan = Math.max(maxLng - minLng, 0.005);

  const padFactor = mode === 'overall' ? 0.14 : 0.28;
  const latPad = Math.max(baseLatSpan * padFactor, mode === 'overall' ? 0.015 : 0.005);
  const lngPad = Math.max(baseLngSpan * padFactor, mode === 'overall' ? 0.018 : 0.006);

  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  // --- STEP 2: Preserve Geographic Aspect Ratio ---
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  let latMeters = (maxLat - minLat) * 111139;
  let lngMeters = (maxLng - minLng) * 111139 * cosLat;
  const targetAspect = width / height;

  if (lngMeters / latMeters < targetAspect) {
    // Width is too narrow; expand longitude
    const desiredLngMeters = latMeters * targetAspect;
    const extraLngDeg = (desiredLngMeters - lngMeters) / (111139 * cosLat);
    minLng -= extraLngDeg / 2;
    maxLng += extraLngDeg / 2;
  } else {
    // Height is too narrow; expand latitude
    const desiredLatMeters = lngMeters / targetAspect;
    const extraLatDeg = (desiredLatMeters - latMeters) / 111139;
    minLat -= extraLatDeg / 2;
    maxLat += extraLatDeg / 2;
  }

  // Projection Functions
  const paddingX = 40;
  const paddingY = 40;
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  const toX = (lng: number): number => paddingX + ((lng - minLng) / (maxLng - minLng)) * innerW;
  const toY = (lat: number): number => paddingY + ((maxLat - lat) / (maxLat - minLat)) * innerH;

  // --- STEP 3: Render Nautical Chart Background ---
  // Deep ocean gradient base
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#061021');
  bgGradient.addColorStop(0.5, '#07152b');
  bgGradient.addColorStop(1, '#091c36');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Satellite Imagery Layer in Background
  if (enableSatelliteBackground) {
    try {
      await renderSatelliteBackgroundLayer(
        ctx,
        minLat,
        maxLat,
        minLng,
        maxLng,
        toX,
        toY,
        width,
        height
      );
    } catch (err) {
      console.warn('Satellite tile layer loading failed, using nautical gradient fallback:', err);
    }
  }

  // Bathymetric depth circles / subtle nautical vignette
  const radialVignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.15, width / 2, height / 2, width * 0.65);
  radialVignette.addColorStop(0, 'rgba(14, 116, 144, 0.04)');
  radialVignette.addColorStop(1, 'rgba(2, 6, 23, 0.45)');
  ctx.fillStyle = radialVignette;
  ctx.fillRect(0, 0, width, height);

  // Outer border & neatline
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 0.75;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // --- STEP 4: Nautical Coordinate Graticule (Grid Lines & Labels) ---
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  // Determine grid interval
  const calcStep = (span: number): number => {
    if (span <= 0.04) return 0.005;
    if (span <= 0.08) return 0.01;
    if (span <= 0.20) return 0.02;
    if (span <= 0.50) return 0.05;
    return 0.1;
  };

  const latStep = calcStep(latSpan);
  const lngStep = calcStep(lngSpan);

  const startLat = Math.ceil(minLat / latStep) * latStep;
  const startLng = Math.ceil(minLng / lngStep) * lngStep;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
  const graticuleFontSize = Math.max(12, Math.round(width * 0.009));
  ctx.font = `${graticuleFontSize}px monospace`;

  // Draw Longitude Lines
  for (let lng = startLng; lng <= maxLng; lng += lngStep) {
    const x = toX(lng);
    if (x >= paddingX && x <= width - paddingX) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, height - 10);
      ctx.stroke();

      // Top coordinate label
      const deg = Math.floor(lng);
      const min = ((lng - deg) * 60).toFixed(1);
      ctx.fillText(`${deg}°${min}'E`, x - 22, 24);
    }
  }

  // Draw Latitude Lines
  for (let lat = startLat; lat <= maxLat; lat += latStep) {
    const y = toY(lat);
    if (y >= paddingY && y <= height - paddingY) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();

      // Left coordinate label
      const deg = Math.floor(lat);
      const min = ((lat - deg) * 60).toFixed(1);
      ctx.fillText(`${deg}°${min}'N`, 14, y - 4);
    }
  }
  ctx.setLineDash([]); // Reset dash

  // --- STEP 5: Cable Protection Corridor (500m Safety Buffer Polygon) ---
  const corridorMeters = cableRoute?.protectionCorridorMeters || 500;
  if (waypoints.length >= 2) {
    const bufferPolygon = generateCableBufferPolygon(waypoints, corridorMeters);
    if (bufferPolygon.length >= 3) {
      ctx.beginPath();
      const firstX = toX(bufferPolygon[0][1]);
      const firstY = toY(bufferPolygon[0][0]);
      ctx.moveTo(firstX, firstY);

      for (let i = 1; i < bufferPolygon.length; i++) {
        ctx.lineTo(toX(bufferPolygon[i][1]), toY(bufferPolygon[i][0]));
      }
      ctx.closePath();

      // Amber translucent fill
      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.fill();

      // Dashed amber safety border
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // --- STEP 6: Active Subsea Cable Polyline ---
  if (waypoints.length >= 2) {
    // Outer cyan glow
    ctx.beginPath();
    ctx.moveTo(toX(waypoints[0].lng), toY(waypoints[0].lat));
    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(toX(waypoints[i].lng), toY(waypoints[i].lat));
    }
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Primary Cyan Cable Line
    ctx.beginPath();
    ctx.moveTo(toX(waypoints[0].lng), toY(waypoints[0].lat));
    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(toX(waypoints[i].lng), toY(waypoints[i].lat));
    }
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Core highlight line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Terminal Waypoint Markers (Start & End)
    const startWp = waypoints[0];
    const endWp = waypoints[waypoints.length - 1];

    const drawTerminal = (wp: { lat: number; lng: number; name?: string }, label: string, isStart: boolean) => {
      const tx = toX(wp.lng);
      const ty = toY(wp.lat);

      // Terminal circle
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fillStyle = isStart ? '#10b981' : '#06b6d4';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label background box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      const textW = ctx.measureText(label).width;
      const boxW = textW + 12;
      const boxX = isStart ? tx + 10 : tx - boxW - 10;
      const boxY = ty - 10;
      ctx.fillRect(boxX, boxY, boxW, 20);
      ctx.strokeRect(boxX, boxY, boxW, 20);

      // Label text
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(label, boxX + 6, boxY + 14);
    };

    drawTerminal(startWp, `KP 0.0: ${startWp.name || 'Terminal 1'}`, true);
    drawTerminal(endWp, `KP ${cableRoute?.totalLengthKm?.toFixed(1) || 'End'}: ${endWp.name || 'Terminal 2'}`, false);
  }

  // --- STEP 7: Ship Voyage Track Polyline & Direction Chevrons ---
  if (points.length >= 2) {
    // Outer trajectory line with subtle cyan glow
    ctx.beginPath();
    ctx.moveTo(toX(points[0].lng), toY(points[0].lat));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i].lng), toY(points[i].lat));
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Solid trajectory path
    ctx.beginPath();
    ctx.moveTo(toX(points[0].lng), toY(points[0].lat));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i].lng), toY(points[i].lat));
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Directional Chevrons along track
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const x1 = toX(p1.lng);
      const y1 = toY(p1.lat);
      const x2 = toX(p2.lng);
      const y2 = toY(p2.lat);

      const dist = Math.hypot(x2 - x1, y2 - y1);
      // Only draw chevron if segment has sufficient pixel length
      if (dist >= 28) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const arrowLen = 7;

        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-arrowLen, -arrowLen * 0.6);
        ctx.lineTo(0, 0);
        ctx.lineTo(-arrowLen, arrowLen * 0.6);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // --- STEP 8: Colored AIS Fix Dots & Focus Highlights ---
  const getColorHex = (color: string): string => {
    switch (color) {
      case 'red':
        return '#ef4444';
      case 'orange':
        return '#f97316';
      case 'yellow':
        return '#eab308';
      case 'green':
      default:
        return '#22c55e';
    }
  };

  points.forEach((pt, index) => {
    const px = toX(pt.lng);
    const py = toY(pt.lat);

    // Filter points out if far outside the chart boundaries
    if (px < -20 || px > width + 20 || py < -20 || py > height + 20) return;

    const isRed = pt.dotColor === 'red';
    const isOrange = pt.dotColor === 'orange';
    const isFocus = (mode === 'orange_focus' && isOrange) || (mode === 'red_focus' && isRed);

    const radius = isFocus ? 6.5 : isRed || isOrange ? 5 : 3.5;
    const color = getColorHex(pt.dotColor);

    // Glowing alert halo for Red / Orange or Focused items
    if (isRed || isOrange || isFocus) {
      ctx.beginPath();
      ctx.arc(px, py, radius + (isFocus ? 6 : 4), 0, Math.PI * 2);
      ctx.fillStyle = isRed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(249, 115, 22, 0.25)';
      ctx.fill();
    }

    // Dot circle
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isFocus ? 1.8 : 1;
    ctx.stroke();

    // Callout badge in focus modes
    if (isFocus) {
      const label = `#${index + 1} • ${pt.localTimeStr || pt.timestamp.slice(11, 16)} • ${pt.sog.toFixed(1)} kts`;
      ctx.font = 'bold 9.5px sans-serif';
      const textW = ctx.measureText(label).width;
      const bw = textW + 10;
      const bh = 18;
      const bx = px + 10;
      const by = py - 9;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, bx + 5, by + 13);
    }
  });

  // --- STEP 9: Start & Latest Voyage Pinpoints ---
  if (points.length > 0) {
    const startPt = points[0];
    const endPt = points[points.length - 1];

    const drawFlagPin = (pt: ShipTrackPoint, label: string, color: string) => {
      const fx = toX(pt.lng);
      const fy = toY(pt.lat);

      ctx.beginPath();
      ctx.arc(fx, fy, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const textW = ctx.measureText(label).width;
      const bw = textW + 12;
      const bx = fx + 12;
      const by = fy - 10;
      ctx.fillRect(bx, by, bw, 20);
      ctx.strokeRect(bx, by, bw, 20);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(label, bx + 6, by + 14);
    };

    drawFlagPin(startPt, `START: ${startPt.localTimeStr || startPt.timestamp.slice(11, 16)}`, '#10b981');
    drawFlagPin(endPt, `LATEST: ${endPt.localTimeStr || endPt.timestamp.slice(11, 16)}`, '#0284c7');
  }

  // --- STEP 10: Cartographic Overlays (Header Banner, Scale Bar, Compass Rose, Callouts) ---
  // Optional Geographic Highlight Callouts (e.g. for multiple red clusters)
  if (options.highlightCallouts && options.highlightCallouts.length > 0) {
    options.highlightCallouts.forEach((co, idx) => {
      const cx = toX(co.lng);
      const cy = toY(co.lat);
      const color = co.color || '#ef4444';

      // Concentric targeting ring
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Leader line
      const lineOffsetX = idx % 2 === 0 ? 35 : -35;
      const lineOffsetY = -30;
      const boxX = cx + lineOffsetX;
      const boxY = cy + lineOffsetY;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(boxX, boxY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Callout box
      ctx.font = 'bold 13px sans-serif';
      const textW = ctx.measureText(co.label).width;
      const bw = textW + 18;
      const bh = 26;
      const bx = lineOffsetX > 0 ? boxX : boxX - bw;
      const by = boxY - bh / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(co.label, bx + 9, by + 18);
    });
  }

  // Chart Title Badge (Top-Left)
  const titleText =
    customTitle ||
    (mode === 'overall'
      ? 'OVERALL VESSEL TRAJECTORY & INFRASTRUCTURE SURVEILLANCE'
      : mode === 'orange_focus'
      ? 'SECTOR ZOOM: ORANGE ALERT EVENTS (CABLE ZONE & SOG < 5 KTS)'
      : 'SECTOR ZOOM: RED ALERT EVENTS (AT ANCHOR HAZARDS)');

  const titleFontSize = Math.max(14, Math.min(22, Math.round(width * 0.014)));
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  const titleW = ctx.measureText(titleText).width + 28;
  const titleH = Math.max(30, Math.round(height * 0.045));

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = mode === 'orange_focus' ? '#f97316' : mode === 'red_focus' || mode === 'custom_focus' ? '#ef4444' : '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.fillRect(16, 16, titleW, titleH);
  ctx.strokeRect(16, 16, titleW, titleH);

  ctx.fillStyle = mode === 'orange_focus' ? '#fdba74' : mode === 'red_focus' || mode === 'custom_focus' ? '#fca5a5' : '#38bdf8';
  ctx.textBaseline = 'middle';
  ctx.fillText(titleText, 26, 16 + titleH / 2);
  ctx.textBaseline = 'alphabetic'; // reset

  // Compass Rose (Top-Right)
  const compassX = width - 42;
  const compassY = 42;
  ctx.save();
  ctx.translate(compassX, compassY);

  // Compass circle
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // North pointer (red)
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, -3);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // North pointer (white)
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(-5, 0);
  ctx.lineTo(0, -3);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // South pointer
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 3);
  ctx.fillStyle = '#64748b';
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', -4, -19);
  ctx.restore();

  // Graphic Scale Bar (Bottom-Left)
  const scaleMeters = mode === 'overall' ? 2000 : 500; // 2km for overall, 500m for zoom
  const scalePixels = (scaleMeters / (111139 * cosLat)) * (innerW / (maxLng - minLng));

  if (scalePixels > 25 && scalePixels < width / 3) {
    const scaleX = 24;
    const scaleY = height - 28;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(scaleX - 6, scaleY - 16, scalePixels + 75, 26);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(scaleX - 6, scaleY - 16, scalePixels + 75, 26);

    // Draw alternating scale bar
    const half = scalePixels / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(scaleX, scaleY, half, 5);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(scaleX + half, scaleY, half, 5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(scaleX, scaleY, scalePixels, 5);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 11px sans-serif';
    const scaleLabel = scaleMeters >= 1000 ? `${(scaleMeters / 1000).toFixed(1)} km` : `${scaleMeters} m`;
    ctx.fillText(`Scale: ${scaleLabel} (${(scaleMeters / 1852).toFixed(2)} NM)`, scaleX + scalePixels + 10, scaleY + 6);
  }

  // Legend Box (Bottom-Right) - Always rendered across all modes
  {
    const legFontSize = Math.max(11, Math.round(width * 0.009));
    const legW = Math.max(370, Math.round(width * 0.35));
    const legH = 30;
    const legX = width - legW - 16;
    const legY = height - legH - 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.fillRect(legX, legY, legW, legH);
    ctx.strokeRect(legX, legY, legW, legH);

    ctx.font = `bold ${legFontSize}px sans-serif`;

    // Red dot item
    const midY = legY + legH / 2;
    ctx.beginPath();
    ctx.arc(legX + 14, midY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText('At Anchor', legX + 24, midY);

    // Orange dot item
    const oX = legX + Math.round(legW * 0.26);
    ctx.beginPath();
    ctx.arc(oX, midY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Zone & SOG<5', oX + 10, midY);

    // Yellow dot item
    const yX = legX + Math.round(legW * 0.54);
    ctx.beginPath();
    ctx.arc(yX, midY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#eab308';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Zone & SOG>=5', yX + 10, midY);

    // Green dot item
    const gX = legX + Math.round(legW * 0.78);
    ctx.beginPath();
    ctx.arc(gX, midY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Under way', gX + 10, midY);
    ctx.textBaseline = 'alphabetic'; // reset
  }

  return canvas;
}
