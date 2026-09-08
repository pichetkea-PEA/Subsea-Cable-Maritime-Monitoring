import React, { useEffect, useRef, useState } from 'react';
import { CableRoute, AlarmEvent, ParkingZone } from '../types';
import { calculatePolygonAreaSqKm } from '../utils/geoUtils';

interface CorridorHeatmapCanvasProps {
  cableRoute: CableRoute;
  events: AlarmEvent[];
  parkingZone?: ParkingZone;
  width?: number;
  height?: number;
  className?: string;
  onImageReady?: (dataUrl: string) => void;
}

export const CorridorHeatmapCanvas: React.FC<CorridorHeatmapCanvasProps> = ({
  cableRoute,
  events,
  parkingZone,
  width = 900,
  height = 520,
  className = '',
  onImageReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [topHotspots, setTopHotspots] = useState<
    { name: string; lat: number; lng: number; count: number; alerts: number; x: number; y: number }[]
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina display scaling
    const dpr = window.devicePixelRatio || 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 1. Determine Geographic Bounds
    const allLats: number[] = [];
    const allLngs: number[] = [];

    cableRoute.waypoints.forEach(w => {
      allLats.push(w.lat);
      allLngs.push(w.lng);
    });

    events.forEach(e => {
      allLats.push(e.currentLat);
      allLngs.push(e.currentLon);
    });

    if (parkingZone?.coordinates) {
      parkingZone.coordinates.forEach(c => {
        allLats.push(c.lat);
        allLngs.push(c.lng);
      });
    }

    // Default to Gulf of Thailand Khanom-Samui corridor bounds if empty
    let minLat = allLats.length > 0 ? Math.min(...allLats) : 9.25;
    let maxLat = allLats.length > 0 ? Math.max(...allLats) : 9.60;
    let minLng = allLngs.length > 0 ? Math.min(...allLngs) : 99.75;
    let maxLng = allLngs.length > 0 ? Math.max(...allLngs) : 100.10;

    // Add 8% spatial padding
    const latPadding = Math.max((maxLat - minLat) * 0.08, 0.015);
    const lngPadding = Math.max((maxLng - minLng) * 0.08, 0.015);
    minLat -= latPadding;
    maxLat += latPadding;
    minLng -= lngPadding;
    maxLng += lngPadding;

    const pad = 36;
    const drawWidth = width - pad * 2;
    const drawHeight = height - pad * 2;

    const projX = (lng: number) => pad + ((lng - minLng) / (maxLng - minLng)) * drawWidth;
    const projY = (lat: number) => pad + ((maxLat - lat) / (maxLat - minLat)) * drawHeight;

    // 2. Draw Nautical Background & Sea Bathymetry
    const seaGrad = ctx.createLinearGradient(0, 0, width, height);
    seaGrad.addColorStop(0, '#071526');
    seaGrad.addColorStop(0.5, '#0b2038');
    seaGrad.addColorStop(1, '#081729');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, width, height);

    // Nautical Grid Lines (Lat / Lon)
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const latStep = (maxLat - minLat) / 5;
    for (let i = 1; i <= 4; i++) {
      const curLat = minLat + latStep * i;
      const y = projY(curLat);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${curLat.toFixed(3)}°N`, pad - 4, y + 3);
    }

    const lngStep = (maxLng - minLng) / 5;
    for (let i = 1; i <= 4; i++) {
      const curLng = minLng + lngStep * i;
      const x = projX(curLng);
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, height - pad);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${curLng.toFixed(3)}°E`, x, height - pad + 14);
    }
    ctx.setLineDash([]);

    // 3. Approximate Coastline Silhouettes for Context
    // Mainland (Khanom / Surat Thani southwest corner)
    ctx.fillStyle = '#17253b';
    ctx.strokeStyle = '#273c5c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const mainlandX1 = projX(minLng);
    const mainlandY1 = projY(minLat + 0.12);
    const mainlandX2 = projX(minLng + 0.14);
    const mainlandY2 = projY(minLat);
    ctx.moveTo(mainlandX1, mainlandY1);
    ctx.bezierCurveTo(mainlandX1 + 60, mainlandY1 + 20, mainlandX2 - 20, mainlandY2 - 40, mainlandX2, mainlandY2);
    ctx.lineTo(projX(minLng), projX(minLat));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MAINLAND (KHANOM / SURAT THANI)', pad + 15, height - pad - 20);

    // Koh Samui Island (Northeast corner)
    ctx.beginPath();
    const samuiCenterX = projX(minLng + (maxLng - minLng) * 0.82);
    const samuiCenterY = projY(minLat + (maxLat - minLat) * 0.72);
    ctx.ellipse(samuiCenterX, samuiCenterY, 65, 48, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KOH SAMUI ISLAND', samuiCenterX, samuiCenterY + 4);

    // 4. Draw 500m Safety Buffer Corridor
    if (cableRoute.waypoints.length >= 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      cableRoute.waypoints.forEach((wp, idx) => {
        const x = projX(wp.lng);
        const y = projY(wp.lat);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Subsea Cable Route
    if (cableRoute.waypoints.length >= 2) {
      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      cableRoute.waypoints.forEach((wp, idx) => {
        const x = projX(wp.lng);
        const y = projY(wp.lat);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();

      // Route Waypoint kilometer markers
      const totalWps = cableRoute.waypoints.length;
      [0, Math.floor(totalWps * 0.33), Math.floor(totalWps * 0.66), totalWps - 1].forEach((idx, step) => {
        const wp = cableRoute.waypoints[idx];
        if (!wp) return;
        const x = projX(wp.lng);
        const y = projY(wp.lat);

        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'left';
        const label = step === 0 ? 'KP 0.0 (Khanom Landing)' : step === 3 ? 'KP 34.0 (Samui Landing)' : `KP ${(step * 11).toFixed(1)}`;
        ctx.fillText(label, x + 6, y - 4);
      });
    }

    // 6. Draw Samui Parking Zone Polygon (Designated Anchorage)
    if (parkingZone && parkingZone.coordinates && parkingZone.coordinates.length >= 3) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);

      ctx.beginPath();
      parkingZone.coordinates.forEach((c, idx) => {
        const x = projX(c.lng);
        const y = projY(c.lat);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Parking Zone Corner Pins
      parkingZone.coordinates.forEach((c, idx) => {
        const x = projX(c.lng);
        const y = projY(c.lat);
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`P${idx + 1}`, x, y - 5);
      });

      // Parking Zone Label
      const pCenterLng = parkingZone.coordinates.reduce((s, c) => s + c.lng, 0) / parkingZone.coordinates.length;
      const pCenterLat = parkingZone.coordinates.reduce((s, c) => s + c.lat, 0) / parkingZone.coordinates.length;
      const pCenterX = projX(pCenterLng);
      const pCenterY = projY(pCenterLat);

      ctx.fillStyle = '#bfdbfe';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚓ SAMUI PARKING ZONE', pCenterX, pCenterY);
      ctx.fillStyle = '#60a5fa';
      ctx.font = '8px sans-serif';
      ctx.fillText('(Designated Large-Ship Anchorage)', pCenterX, pCenterY + 11);
      ctx.restore();
    }

    // 7. RENDER THE HEATMAP LAYER (Thermal Density Hotspots)
    // Additive blending for smooth thermal glow
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    events.forEach(evt => {
      const x = projX(evt.currentLon);
      const y = projY(evt.currentLat);
      const isAlert = evt.eventType === 'Alert' || evt.eventDetail?.toLowerCase().includes('anchor');
      const radius = isAlert ? 34 : 26;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      if (isAlert) {
        // Higher hazard / anchoring hotspot
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');   // Core Red
        grad.addColorStop(0.3, 'rgba(249, 115, 22, 0.60)'); // Mid Orange
        grad.addColorStop(0.7, 'rgba(234, 179, 8, 0.30)');  // Yellow
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');      // Transparent outer
      } else {
        // Transit / Crossing hotspot
        grad.addColorStop(0, 'rgba(245, 158, 11, 0.75)');   // Amber Core
        grad.addColorStop(0.4, 'rgba(6, 182, 212, 0.50)');  // Cyan
        grad.addColorStop(0.8, 'rgba(59, 130, 246, 0.20)'); // Blue
        grad.addColorStop(1, 'rgba(14, 165, 233, 0)');      // Transparent outer
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 8. Spatial Cluster Detection for Callout Hotspots
    // Segment corridor into 3 major zones: Khanom landing, Mid-channel, Samui approach
    const zoneKhanom = events.filter(e => e.currentLat < minLat + (maxLat - minLat) * 0.35);
    const zoneMid = events.filter(e => e.currentLat >= minLat + (maxLat - minLat) * 0.35 && e.currentLat < minLat + (maxLat - minLat) * 0.70);
    const zoneSamui = events.filter(e => e.currentLat >= minLat + (maxLat - minLat) * 0.70);

    const hotspots = [
      {
        name: 'Hotspot Zone A: Samui Island Coastal Approach',
        lat: minLat + (maxLat - minLat) * 0.80,
        lng: minLng + (maxLng - minLng) * 0.75,
        count: zoneSamui.length,
        alerts: zoneSamui.filter(e => e.eventType === 'Alert').length,
        x: projX(minLng + (maxLng - minLng) * 0.75),
        y: projY(minLat + (maxLat - minLat) * 0.80),
      },
      {
        name: 'Hotspot Zone B: Gulf Deep Channel Fairway',
        lat: minLat + (maxLat - minLat) * 0.52,
        lng: minLng + (maxLng - minLng) * 0.50,
        count: zoneMid.length,
        alerts: zoneMid.filter(e => e.eventType === 'Alert').length,
        x: projX(minLng + (maxLng - minLng) * 0.50),
        y: projY(minLat + (maxLat - minLat) * 0.52),
      },
      {
        name: 'Hotspot Zone C: Khanom Substation Nearshore',
        lat: minLat + (maxLat - minLat) * 0.22,
        lng: minLng + (maxLng - minLng) * 0.28,
        count: zoneKhanom.length,
        alerts: zoneKhanom.filter(e => e.eventType === 'Alert').length,
        x: projX(minLng + (maxLng - minLng) * 0.28),
        y: projY(minLat + (maxLat - minLat) * 0.22),
      },
    ];
    setTopHotspots(hotspots);

    // Draw Hotspot Callout Flags
    hotspots.forEach(h => {
      ctx.save();
      // Target marker
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Badge callout
      const badgeW = 160;
      const badgeH = 28;
      const badgeX = Math.min(Math.max(h.x - badgeW / 2, pad + 10), width - pad - badgeW - 10);
      const badgeY = h.y - 36;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(h.name.slice(0, 24), badgeX + 8, badgeY + 12);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px sans-serif';
      ctx.fillText(`${h.count} Transits • ${h.alerts} Anchoring Alerts`, badgeX + 8, badgeY + 22);
      ctx.restore();
    });

    // 9. North Arrow & Scale Bar
    // North Arrow
    const northX = width - pad - 24;
    const northY = pad + 26;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(northX, northY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(northX, northY - 11);
    ctx.lineTo(northX - 4, northY + 3);
    ctx.lineTo(northX, northY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(northX, northY - 11);
    ctx.lineTo(northX + 4, northY + 3);
    ctx.lineTo(northX, northY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', northX, northY + 11);

    // 10. Thermal Legend Bar (Bottom Left)
    const legX = pad + 15;
    const legY = pad + 15;
    const legW = 190;
    const legH = 50;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(legX, legY, legW, legH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CORRIDOR TRAFFIC HEATMAP', legX + 10, legY + 15);

    // Gradient bar
    const barGrad = ctx.createLinearGradient(legX + 10, 0, legX + legW - 20, 0);
    barGrad.addColorStop(0, '#06b6d4');
    barGrad.addColorStop(0.5, '#f59e0b');
    barGrad.addColorStop(1, '#ef4444');

    ctx.fillStyle = barGrad;
    ctx.fillRect(legX + 10, legY + 22, legW - 20, 8);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '7.5px sans-serif';
    ctx.fillText('Low Transit', legX + 10, legY + 41);
    ctx.textAlign = 'right';
    ctx.fillText('High-Hazard Alert', legX + legW - 10, legY + 41);

    // Notify ready with image dataUrl
    if (onImageReady) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        onImageReady(dataUrl);
      } catch (err) {
        console.warn('Canvas export notice:', err);
      }
    }
  }, [cableRoute, events, parkingZone, width, height]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-700/80 shadow-2xl bg-slate-950 ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="block max-w-full h-auto mx-auto"
      />
      {/* Visual Header Overlay */}
      <div className="absolute top-2 right-14 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-md text-[10px] text-slate-200 font-semibold flex items-center gap-1.5 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
        <span>HEATMAP ONLY • HIGH-TRAFFIC SURVEILLANCE</span>
      </div>
    </div>
  );
};
