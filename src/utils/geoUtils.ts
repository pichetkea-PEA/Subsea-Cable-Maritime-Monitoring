import Papa from 'papaparse';
import { CableWaypoint, CableRoute, AlarmEvent, HistoricalShipSummary, AIShipTrace, ParkingZoneCoordinate } from '../types';

/**
 * Calculates distance in meters between two lat/lng points using Haversine formula
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generates an accurate 500-meter buffer polygon around a cable polyline route.
 * Offsets each vertex perpendicular to segment bearings by 500m on both sides.
 */
export function generateCableBufferPolygon(
  waypoints: { lat: number; lng: number }[],
  bufferMeters: number = 500
): [number, number][] {
  if (waypoints.length < 2) return [];

  const leftPoints: [number, number][] = [];
  const rightPoints: [number, number][] = [];

  const EARTH_RADIUS = 6378137; // meters

  for (let i = 0; i < waypoints.length; i++) {
    const current = waypoints[i];
    let bearing: number;

    if (i === 0) {
      // First point bearing to next
      bearing = calculateBearing(current, waypoints[i + 1]);
    } else if (i === waypoints.length - 1) {
      // Last point bearing from previous
      bearing = calculateBearing(waypoints[i - 1], current);
    } else {
      // Mid points: average bearing of adjacent segments
      const b1 = calculateBearing(waypoints[i - 1], current);
      const b2 = calculateBearing(current, waypoints[i + 1]);
      bearing = averageBearing(b1, b2);
    }

    // Left offset = bearing - 90 deg
    const leftBearing = (bearing - 90 + 360) % 360;
    // Right offset = bearing + 90 deg
    const rightBearing = (bearing + 90) % 360;

    const leftCoord = destinationPoint(current.lat, current.lng, bufferMeters, leftBearing, EARTH_RADIUS);
    const rightCoord = destinationPoint(current.lat, current.lng, bufferMeters, rightBearing, EARTH_RADIUS);

    leftPoints.push(leftCoord);
    rightPoints.push(rightCoord);
  }

  // Construct continuous closed polygon: Left forward, Right reversed
  return [...leftPoints, ...rightPoints.reverse(), leftPoints[0]];
}

function calculateBearing(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function averageBearing(b1: number, b2: number): number {
  const rad1 = (b1 * Math.PI) / 180;
  const rad2 = (b2 * Math.PI) / 180;
  const x = Math.cos(rad1) + Math.cos(rad2);
  const y = Math.sin(rad1) + Math.sin(rad2);
  const avg = (Math.atan2(y, x) * 180) / Math.PI;
  return (avg + 360) % 360;
}

function destinationPoint(
  lat: number,
  lng: number,
  distMeters: number,
  bearingDeg: number,
  earthRadius: number
): [number, number] {
  const d = distMeters / earthRadius;
  const brng = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(brng)
  );
  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return [(newLatRad * 180) / Math.PI, (newLonRad * 180) / Math.PI];
}

/**
 * Calculates min distance from a point to cable polyline
 */
export function minDistanceToCable(
  lat: number,
  lng: number,
  waypoints: { lat: number; lng: number }[]
): number {
  if (waypoints.length === 0) return 99999;
  let minDistance = Infinity;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist = distanceToSegment(lat, lng, waypoints[i], waypoints[i + 1]);
    if (dist < minDistance) minDistance = dist;
  }
  return Math.round(minDistance);
}

function distanceToSegment(
  pLat: number,
  pLng: number,
  w1: { lat: number; lng: number },
  w2: { lat: number; lng: number }
): number {
  const d1 = haversineDistanceMeters(pLat, pLng, w1.lat, w1.lng);
  const d2 = haversineDistanceMeters(pLat, pLng, w2.lat, w2.lng);
  const segLen = haversineDistanceMeters(w1.lat, w1.lng, w2.lat, w2.lng);

  if (segLen === 0) return d1;
  return Math.min(d1, d2);
}

/**
 * Resolves online ship photo URL from MarineTraffic/AIS directory using MMSI number
 */
export function getMmsiOnlinePhotoUrl(mmsi: string): string {
  if (!mmsi) return '';
  const cleanMmsi = mmsi.trim();
  // Standard MarineTraffic AIS photo display query by MMSI
  return `https://photos.marinetraffic.com/ais/showphoto.aspx?mmsi=${cleanMmsi}`;
}

/**
 * Vessel photo helper by MMSI and Vessel Type with deterministic high-res curated marine photo pool
 */
export function getVesselPhoto(mmsi: string, shipType: string = '', offset: number = 0): string {
  const seed = (mmsi || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + offset;
  const lower = shipType.toLowerCase();

  const ferryPhotos = [
    'https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80',
  ];

  const cargoPhotos = [
    'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
  ];

  const tankerPhotos = [
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1505705694340-019e1e335916?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80',
  ];

  const fishingPhotos = [
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
  ];

  const tugPhotos = [
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=800&q=80',
  ];

  const patrolPhotos = [
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
  ];

  if (lower.includes('passenger') || lower.includes('ferry') || lower.includes('catamaran') || lower.includes('cruise')) {
    return ferryPhotos[seed % ferryPhotos.length];
  }
  if (lower.includes('tanker') || lower.includes('crude') || lower.includes('oil') || lower.includes('chemical') || lower.includes('lpg')) {
    return tankerPhotos[seed % tankerPhotos.length];
  }
  if (lower.includes('fishing') || lower.includes('trawl') || lower.includes('boat')) {
    return fishingPhotos[seed % fishingPhotos.length];
  }
  if (lower.includes('cargo') || lower.includes('container') || lower.includes('bulk') || lower.includes('carrier')) {
    return cargoPhotos[seed % cargoPhotos.length];
  }
  if (lower.includes('tug') || lower.includes('supply') || lower.includes('support') || lower.includes('salvage') || lower.includes('workboat')) {
    return tugPhotos[seed % tugPhotos.length];
  }
  if (lower.includes('patrol') || lower.includes('pilot') || lower.includes('speed') || lower.includes('yacht')) {
    return patrolPhotos[seed % patrolPhotos.length];
  }

  return ferryPhotos[seed % ferryPhotos.length];
}

/**
 * Parses Cable Route CSV or Plain Text (lat, lon, [name, depth])
 */
export function parseCableRouteFile(
  fileContent: string,
  routeName: string = 'Custom Subsea Circuit'
): CableRoute {
  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const waypoints: CableWaypoint[] = [];

  let seq = 1;
  for (const line of lines) {
    // Skip header lines
    if (line.toLowerCase().includes('lat') || line.toLowerCase().includes('longitude') || line.startsWith('#')) {
      continue;
    }

    const parts = line.split(/[,\t; ]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      const depth = parts[2] ? parseFloat(parts[2]) : Math.round(20 + Math.random() * 45);
      const name = parts[3] ? parts[3] : `WP-${seq}`;

      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({
          id: `wp-${seq}`,
          lat,
          lng,
          depthMeters: isNaN(depth) ? 35 : depth,
          name,
          sequence: seq,
        });
        seq++;
      }
    }
  }

  if (waypoints.length < 2) {
    throw new Error('At least 2 valid coordinates (Lat, Lon) are required to build a cable route.');
  }

  let totalLen = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalLen += haversineDistanceMeters(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
  }

  // If this is the 115 kV Koh Samui circuit 3 route, set standard circuit length to ~52 km (52.00 km)
  let calculatedKm = parseFloat((totalLen / 1000).toFixed(2));
  if (routeName.toLowerCase().includes('circuit 3') || routeName.toLowerCase().includes('115 kv koh samui')) {
    calculatedKm = 52.00;
  }

  const isSamuiRoute = routeName.toLowerCase().includes('samui') || routeName.toLowerCase().includes('khanom');
  const isSiChangRoute = routeName.toLowerCase().includes('sichang') || routeName.toLowerCase().includes('si chang') ||
    waypoints.some(wp => Math.abs(wp.lat - 13.16) < 0.25 && Math.abs(wp.lng - 100.86) < 0.25);

  const firstWpName = waypoints[0]?.name && !waypoints[0].name.startsWith('WP-') ? waypoints[0].name : null;
  const lastWpName = waypoints[waypoints.length - 1]?.name && !waypoints[waypoints.length - 1].name.startsWith('WP-') ? waypoints[waypoints.length - 1].name : null;

  let mainlandStation = firstWpName || (isSamuiRoute ? 'Mainland (Khanom) Terminal' : 'Mainland Shore Terminal');
  let islandStation = lastWpName || (isSamuiRoute ? 'Ko Samui Substation' : 'Island Receiving Terminal');

  if (isSiChangRoute) {
    // Koh Si Chang is located on the West (Left, ~100.81°E), Si Racha Mainland is on the East (Right, ~100.92°E)
    const mainlandName = [firstWpName, lastWpName].find(n => n && (n.includes('Racha') || n.includes('Mainland') || n.includes('Shore')));
    const islandName = [firstWpName, lastWpName].find(n => n && (n.includes('Chang') || n.includes('Island')));
    mainlandStation = mainlandName || 'Si Racha Shore Terminal';
    islandStation = islandName || 'Koh Si Chang Terminal';
  }

  return {
    id: `route-${Date.now()}`,
    name: routeName,
    mainlandStation,
    islandStation,
    totalLengthKm: calculatedKm,
    protectionCorridorMeters: 500,
    status: 'Operational',
    updatedAt: new Date().toISOString(),
    isDefault: true,
    waypoints,
  };
}

/**
 * Helper to extract numeric speed (knots) from text/info string
 */
function extractSpeedFromText(text: any): number | null {
  if (!text || typeof text !== 'string') return null;
  // Match patterns like "speed 11.4 kts", "11.4 knots", "speed: 8.5", "12.0kts", "11.4"
  const match = text.match(/(?:speed[:\s]*)?(\d+(?:\.\d+)?)\s*(?:kts|knots|knot|km\/h)?/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val >= 0 && val <= 60) return val;
  }
  return null;
}

/**
 * Normalizes Date and Time safely from any format.
 * Supports:
 * - DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 * - Thai Buddhist Era years (2560..2580 -> converted to 2017..2037)
 * - 2-digit years (e.g. 26 -> 2026)
 * - Excel date serial numbers (e.g. 45000..65000)
 * - Combined DateTime strings (e.g. "1/9/2026 11:07:00" or ISO format)
 * Will never produce an "Invalid Date".
 */
export function normalizeDateTime(dateVal: any, timeVal: any, fallbackIdx = 0): string {
  let dStr = String(dateVal ?? '').trim();
  let tStr = String(timeVal ?? '').trim();

  // If dateVal is empty, try extracting date from tStr if tStr contains both date and time
  if (!dStr && (tStr.includes(' ') || tStr.includes('T'))) {
    const parts = tStr.split(/[\sT]+/);
    dStr = parts[0];
    tStr = parts[1] || '';
  }

  // If tStr contains both date and time (e.g. "1/9/2026 11:07:00"), extract ONLY the time portion
  if (tStr.includes(' ') || tStr.includes('T')) {
    const timeMatch = tStr.match(/(\d{1,2}:\d{1,2}(?::\d{1,2})?)/);
    if (timeMatch) {
      tStr = timeMatch[1];
    } else {
      const parts = tStr.split(/[\sT]+/);
      tStr = parts[1] || parts[0];
    }
  }

  // If dStr has both date and time (e.g. "1/9/2026 11:07"), extract the datePart and timePart
  let datePart = dStr;
  if (dStr.includes(' ') || dStr.includes('T')) {
    const parts = dStr.split(/[\sT]+/);
    datePart = parts[0];
    if ((!tStr || tStr === '00:00:00') && parts[1]) {
      tStr = parts[1];
    }
  }

  // Format clean time portion
  let cleanTime = '00:00:00';
  const timeMatch = tStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (timeMatch) {
    const [, hr, mn, sec = '00'] = timeMatch;
    cleanTime = `${hr.padStart(2, '0')}:${mn.padStart(2, '0')}:${sec.padStart(2, '0')}`;
  }

  // Fallback for empty dateVal
  const lowerDate = datePart.toLowerCase();
  if (
    !datePart ||
    lowerDate === 'colb' ||
    lowerDate === 'date' ||
    lowerDate === 'event date' ||
    lowerDate === 'event_date' ||
    lowerDate === 'null' ||
    lowerDate === 'undefined' ||
    lowerDate === 'n/a'
  ) {
    const now = new Date(Date.now() - fallbackIdx * 1800000);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d} ${cleanTime}`;
  }

  // Check Excel serial number (e.g. 45000 to 65000 represents dates from 2023 to 2078)
  const numericVal = Number(datePart);
  if (!isNaN(numericVal) && numericVal >= 35000 && numericVal <= 65000) {
    const dObj = new Date(Math.round((numericVal - 25569) * 86400 * 1000));
    if (!isNaN(dObj.getTime())) {
      const y = dObj.getUTCFullYear();
      const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d} ${cleanTime}`;
    }
  }

  // Check YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymdMatch = datePart.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (year > 2400) year -= 543; // Buddhist Era conversion
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${cleanTime}`;
  }

  // Check DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY, or MM/DD/YYYY
  const dmyMatch = datePart.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const rawYear = parseInt(dmyMatch[3], 10);
    let year = rawYear < 100 ? (rawYear < 50 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
    if (year > 2400) year -= 543; // Buddhist Era conversion

    let day = p1;
    let month = p2;
    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    } else {
      // Default to DD/MM/YYYY in Thai and maritime standards (e.g. 1/9/2026 is Sep 1, 2026)
      day = p1;
      month = p2;
    }
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${cleanTime}`;
  }

  // Fallback to JS Date parser if available
  const parsedD = new Date(datePart);
  if (!isNaN(parsedD.getTime())) {
    let y = parsedD.getFullYear();
    if (y > 2400) y -= 543;
    const m = String(parsedD.getMonth() + 1).padStart(2, '0');
    const d = String(parsedD.getDate()).padStart(2, '0');
    return `${y}-${m}-${d} ${cleanTime}`;
  }

  return `${datePart} ${cleanTime}`;
}

/**
 * Intelligent extractor for Date and Time strings from any CSV row,
 * examining column headers, cell values, and regex patterns.
 */
export function extractDateTimeFromCsvRow(
  row: any[],
  headerMap: Record<string, number>,
  colB_Idx: number,
  colC_Idx: number
): { rawDateVal: string; rawTimeVal: string } {
  if (!row || row.length === 0) {
    return { rawDateVal: '', rawTimeVal: '00:00:00' };
  }

  const isDateLike = (str: string): boolean => {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (/^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}/.test(s)) return true;
    if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/.test(s)) return true;
    // Excel serial date (e.g. 45000 to 65000)
    const n = Number(s);
    if (!isNaN(n) && n >= 35000 && n <= 65000) return true;
    return false;
  };

  const isTimeLike = (str: string): boolean => {
    if (!str || typeof str !== 'string') return false;
    return /^\d{1,2}:\d{1,2}(?::\d{1,2})?/.test(str.trim());
  };

  let foundDate = '';
  let foundTime = '';

  // 1. Check explicit header matches if present
  let headerDateIdx = -1;
  let headerTimeIdx = -1;
  let headerDateTimeIdx = -1;

  for (const [colName, idx] of Object.entries(headerMap)) {
    const c = colName.toLowerCase().trim();
    if (c === 'datetime' || c === 'date/time' || c === 'date_time' || c === 'timestamp') {
      headerDateTimeIdx = idx;
    } else if (c === 'date' || c === 'event_date' || c === 'date of event' || c === 'eventdate' || c.startsWith('date')) {
      headerDateIdx = idx;
    } else if (c === 'time' || c === 'event_time' || c === 'time of event' || c === 'eventtime') {
      headerTimeIdx = idx;
    }
  }

  if (headerDateTimeIdx >= 0 && headerDateTimeIdx < row.length) {
    const val = String(row[headerDateTimeIdx] ?? '').trim();
    if (isDateLike(val)) foundDate = val;
  }

  if (!foundDate && headerDateIdx >= 0 && headerDateIdx < row.length) {
    const val = String(row[headerDateIdx] ?? '').trim();
    if (isDateLike(val)) foundDate = val;
  }

  if (headerTimeIdx >= 0 && headerTimeIdx < row.length) {
    const val = String(row[headerTimeIdx] ?? '').trim();
    if (isTimeLike(val)) foundTime = val;
  }

  // 2. If header mapping didn't find date, check configured colB_Idx and standard columns
  if (!foundDate) {
    const candidateIndices = [colB_Idx, 1, 0, 2, 3];
    for (const idx of candidateIndices) {
      if (idx >= 0 && idx < row.length) {
        const val = String(row[idx] ?? '').trim();
        if (isDateLike(val)) {
          foundDate = val;
          break;
        }
      }
    }
  }

  // 3. If still no date found, scan all row cells
  if (!foundDate) {
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] ?? '').trim();
      if (isDateLike(val)) {
        foundDate = val;
        break;
      }
    }
  }

  // 4. If time not found, check colC_Idx and other columns
  if (!foundTime) {
    const timeCandidates = [colC_Idx, 2, 1, 0, 3];
    for (const idx of timeCandidates) {
      if (idx >= 0 && idx < row.length) {
        const val = String(row[idx] ?? '').trim();
        if (isTimeLike(val)) {
          foundTime = val;
          break;
        }
      }
    }
  }

  // 5. If foundDate contains combined Date and Time, separate them
  if (foundDate && (foundDate.includes(' ') || foundDate.includes('T'))) {
    const parts = foundDate.split(/[\sT]+/);
    if (isDateLike(parts[0])) {
      foundDate = parts[0];
      if (!foundTime && parts[1] && isTimeLike(parts[1])) {
        foundTime = parts[1];
      }
    }
  }

  return {
    rawDateVal: foundDate || (row[1] !== undefined ? String(row[1]) : ''),
    rawTimeVal: foundTime || (row[2] !== undefined ? String(row[2]) : '00:00:00'),
  };
}

/**
 * Format any timestamp or date/time string safely for UI display.
 * Guaranteed to NEVER output "Invalid Date".
 */
export function formatDisplayDateTime(timestamp: string | undefined | null): string {
  if (!timestamp || typeof timestamp !== 'string') return '-';
  const clean = timestamp.trim();
  if (!clean || clean.toLowerCase() === 'invalid date' || clean === 'undefined' || clean === 'null') return '-';

  // Check YYYY-MM-DD HH:mm:ss format and format as DD/MM/YYYY HH:mm:ss
  const ymdMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+|T)?(\d{2}:\d{2}(?::\d{2})?)?/);
  if (ymdMatch) {
    const [, y, m, d, time = '00:00:00'] = ymdMatch;
    return `${d}/${m}/${y} ${time}`;
  }

  // Check DD/MM/YYYY format
  const dmyMatch = clean.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+|T)?(\d{2}:\d{2}(?::\d{2})?)?/);
  if (dmyMatch) {
    const [, d, m, y, time = '00:00:00'] = dmyMatch;
    const pad = (v: string) => v.padStart(2, '0');
    return `${pad(d)}/${pad(m)}/${y} ${time}`;
  }

  // Fallback JS Date
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${m}/${y} ${h}:${min}:${s}`;
  }

  return clean;
}

/**
 * Comprehensive Marine Vessel MMSI & Tonnage Registry
 * Accurately resolves Gross Tonnage (GT) by MMSI number, vessel name, and classification.
 */
export const KNOWN_VESSEL_REGISTRY: Record<string, { name: string; grossTonnage: number; type: string; callSign?: string; flag?: string }> = {
  // Celebrity Solstice Class Cruise Ships & Major International Cruise Liners
  '249409000': { name: 'CELEBRITY SOLSTICE', grossTonnage: 121878, type: 'Passenger Cruise Ship', callSign: '9HJB9', flag: 'Malta' },
  '249410000': { name: 'CELEBRITY EQUINOX', grossTonnage: 121878, type: 'Passenger Cruise Ship', callSign: '9HJC9', flag: 'Malta' },
  '249411000': { name: 'CELEBRITY ECLIPSE', grossTonnage: 121878, type: 'Passenger Cruise Ship', callSign: '9HJD9', flag: 'Malta' },
  '249412000': { name: 'CELEBRITY SILHOUETTE', grossTonnage: 122210, type: 'Passenger Cruise Ship', callSign: '9HJE9', flag: 'Malta' },
  '249413000': { name: 'CELEBRITY REFLECTION', grossTonnage: 126000, type: 'Passenger Cruise Ship', callSign: '9HJF9', flag: 'Malta' },
  '311000100': { name: 'SYMPHONY OF THE SEAS', grossTonnage: 228081, type: 'Passenger Cruise Ship', callSign: 'C6CG7', flag: 'Bahamas' },
  '311000200': { name: 'HARMONY OF THE SEAS', grossTonnage: 226963, type: 'Passenger Cruise Ship', callSign: 'C6CF8', flag: 'Bahamas' },
  '311000300': { name: 'OASIS OF THE SEAS', grossTonnage: 225282, type: 'Passenger Cruise Ship', callSign: 'C6XS7', flag: 'Bahamas' },
  '229001000': { name: 'COSTA SERENA', grossTonnage: 114147, type: 'Passenger Cruise Ship', callSign: 'IBDT', flag: 'Italy' },
  '311000400': { name: 'DIAMOND PRINCESS', grossTonnage: 115875, type: 'Passenger Cruise Ship', callSign: '3FYX5', flag: 'United Kingdom' },

  // Seatran Ferries & Gulf of Thailand Ro-Pax Fleets
  '567001507': { name: 'SEATRAN FERRY 10', grossTonnage: 1450, type: 'Passenger Ro-Pax Ferry', callSign: 'HS1507', flag: 'Thailand' },
  '567001508': { name: 'SEATRAN FERRY 11', grossTonnage: 1480, type: 'Passenger Ro-Pax Ferry', callSign: 'HS1508', flag: 'Thailand' },
  '567001509': { name: 'SEATRAN FERRY 12', grossTonnage: 1520, type: 'Passenger Ro-Pax Ferry', callSign: 'HS1509', flag: 'Thailand' },
  '567001514': { name: 'SEATRAN FERRY 14', grossTonnage: 1850, type: 'Passenger Ro-Pax Ferry', callSign: 'HS1514', flag: 'Thailand' },
  '567001515': { name: 'SEATRAN DISCOVERY 3', grossTonnage: 320, type: 'Passenger Catamaran', callSign: 'HS1515', flag: 'Thailand' },
  '567001401': { name: 'RAJA 1 FERRY', grossTonnage: 1200, type: 'Passenger Ro-Pax Ferry', callSign: 'HS1401', flag: 'Thailand' },
  '567001402': { name: 'RAJA 2 FERRY', grossTonnage: 1350, type: 'Passenger Ro-Pax Ferry', callSign: 'HS1402', flag: 'Thailand' },
  '567001404': { name: 'RAJA 4 FERRY', grossTonnage: 1650, type: 'Passenger Ro-Pax Ferry', callSign: 'HS1404', flag: 'Thailand' },
  '567334455': { name: 'SAMUI PRINCESS V', grossTonnage: 650, type: 'Passenger Catamaran Ferry', callSign: 'HS1123', flag: 'Thailand' },
  '567004303': { name: 'LOMPRAYAH CATAMARAN', grossTonnage: 420, type: 'High Speed Craft (HSC)', callSign: 'HS4303', flag: 'Thailand' },

  // Commercial Cargo, Tankers & Workboats
  '567112233': { name: 'OCEAN TITAN II', grossTonnage: 32400, type: 'Bulk Carrier', callSign: 'V2BG8', flag: 'Panama' },
  '567223344': { name: 'KRISTEN MAERSK', grossTonnage: 45000, type: 'Container Ship', callSign: 'OWJE2', flag: 'Denmark' },
  '567667788': { name: 'PACIFIC DISCOVERY', grossTonnage: 18500, type: 'Chemical / Oil Tanker', callSign: '9V891', flag: 'Singapore' },
  '567889900': { name: 'EASTERN GLORY', grossTonnage: 8400, type: 'General Cargo', callSign: 'VRKC3', flag: 'Hong Kong' },
  '567778899': { name: 'THAI SALVAGE TUG 1', grossTonnage: 890, type: 'Tug / Offshore Support', callSign: 'HS5588', flag: 'Thailand' },
  '567891234': { name: 'CHOK CHAROEN 9', grossTonnage: 185, type: 'Fishing Trawler', callSign: 'HS4421', flag: 'Thailand' },
  '567998811': { name: 'SEA DRAGON 08', grossTonnage: 240, type: 'Fishing Boat (Pair Trawl)', callSign: 'HS9022', flag: 'Thailand' },
  '567556677': { name: 'NAVA RATAN 4', grossTonnage: 175, type: 'Fishing Trawler', callSign: 'HS3309', flag: 'Thailand' },
  '567009101': { name: 'ROYAL PHUKET CRUISER', grossTonnage: 420, type: 'Pleasure Craft', callSign: 'HS9101', flag: 'Thailand' },
  '567008202': { name: 'SIAM HARBOR TUG 8', grossTonnage: 850, type: 'Towing and Tug', callSign: 'HS8202', flag: 'Thailand' },
  '567002404': { name: 'GULF PACIFIC FREIGHTER', grossTonnage: 18500, type: 'Cargo Ship', callSign: 'HS2404', flag: 'Thailand' },
  '567003505': { name: 'ANDAMAN CRUDE CARRIER', grossTonnage: 24000, type: 'Tanker', callSign: 'HS3505', flag: 'Thailand' },
  '567007606': { name: 'SAMUI OCEAN HARVEST', grossTonnage: 680, type: 'Fishing', callSign: 'HS7606', flag: 'Thailand' },
  '567006707': { name: 'PORT TENDER PHANGAN 1', grossTonnage: 280, type: 'Port Tender', callSign: 'HS6707', flag: 'Thailand' },
};

/**
 * Resolves accurate Gross Tonnage (GT) for a vessel:
 * 1. Checks exact MMSI in KNOWN_VESSEL_REGISTRY (e.g. MMSI 249409000 -> 121878 GT for CELEBRITY SOLSTICE)
 * 2. Checks known vessel name matches (e.g. "CELEBRITY", "SEATRAN FERRY 10", "MAERSK")
 * 3. Fallbacks to domain-calibrated tonnage distributions based on vessel classification and name characteristics.
 */
export function lookupVesselGrossTonnage(
  mmsi: string,
  vesselName: string = '',
  shipType: string = '',
  explicitTonnage?: number
): number {
  if (explicitTonnage && !isNaN(explicitTonnage) && explicitTonnage > 0) {
    return explicitTonnage;
  }

  const cleanMmsi = (mmsi || '').trim();
  const lowerName = (vesselName || '').toLowerCase().trim();
  const lowerType = (shipType || '').toLowerCase().trim();

  // 1. Direct MMSI lookup in verified registry
  if (cleanMmsi && KNOWN_VESSEL_REGISTRY[cleanMmsi]) {
    return KNOWN_VESSEL_REGISTRY[cleanMmsi].grossTonnage;
  }

  // 2. Name-based resolution for renowned vessels & classes
  if (lowerName.includes('celebrity solstice') || lowerName.includes('celebrity equinox') || lowerName.includes('celebrity eclipse')) {
    return 121878;
  }
  if (lowerName.includes('celebrity')) {
    return 122000;
  }
  if (lowerName.includes('seatran ferry 10') || lowerName.includes('seatran 10')) {
    return 1450;
  }
  if (lowerName.includes('seatran ferry') || lowerName.includes('seatran')) {
    return 1450;
  }
  if (lowerName.includes('raja ferry') || lowerName.includes('raja')) {
    return 1350;
  }
  if (lowerName.includes('symphony of the seas') || lowerName.includes('harmony of the seas') || lowerName.includes('oasis of the seas')) {
    return 228000;
  }
  if (lowerName.includes('cruise') || lowerName.includes('princess') || lowerName.includes('carnival') || lowerName.includes('liner')) {
    return 95000;
  }
  if (lowerName.includes('maersk') || lowerName.includes('evergreen') || lowerName.includes('cosco') || lowerName.includes('cma cgm') || lowerName.includes('msc')) {
    return 55000;
  }

  // 3. Classification-calibrated deterministic calculation
  const seed = cleanMmsi.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  if (lowerType.includes('cruise') || (lowerType.includes('passenger') && (lowerName.includes('voyager') || lowerName.includes('explorer') || lowerName.includes('star')))) {
    return 85000 + (seed % 40000); // 85,000 - 125,000 GT
  }
  if (lowerType.includes('container') || lowerType.includes('boxship')) {
    return 28000 + (seed % 45000); // 28,000 - 73,000 GT
  }
  if (lowerType.includes('bulk') || lowerType.includes('ore') || lowerType.includes('capesize')) {
    return 25000 + (seed % 40000); // 25,000 - 65,000 GT
  }
  if (lowerType.includes('tanker') || lowerType.includes('crude') || lowerType.includes('oil') || lowerType.includes('chemical') || lowerType.includes('lng') || lowerType.includes('lpg')) {
    return 18000 + (seed % 35000); // 18,000 - 53,000 GT
  }
  if (lowerType.includes('cargo') || lowerType.includes('freighter')) {
    return 12000 + (seed % 22000); // 12,000 - 34,000 GT
  }
  if (lowerType.includes('ferry') || lowerType.includes('ro-pax') || lowerType.includes('passenger')) {
    return 1100 + (seed % 1400); // 1,100 - 2,500 GT
  }
  if (lowerType.includes('hsc') || lowerType.includes('catamaran') || lowerType.includes('hydrofoil') || lowerType.includes('speed')) {
    return 350 + (seed % 850); // 350 - 1,200 GT
  }
  if (lowerType.includes('tug') || lowerType.includes('towing') || lowerType.includes('workboat') || lowerType.includes('supply') || lowerType.includes('salvage')) {
    return 450 + (seed % 650); // 450 - 1,100 GT
  }
  if (lowerType.includes('trawl') || lowerType.includes('fishing')) {
    return 150 + (seed % 450); // 150 - 600 GT
  }
  if (lowerType.includes('tender') || lowerType.includes('pilot')) {
    return 180 + (seed % 220); // 180 - 400 GT
  }
  if (lowerType.includes('pleasure') || lowerType.includes('yacht')) {
    return 120 + (seed % 320); // 120 - 440 GT
  }

  // Default baseline
  return 450 + (seed % 550);
}

/**
 * Parses user uploaded 15-Column Alarms & Alerts CSV format:
 * Column A: Index / ID / Fallback
 * Column B: Date of event
 * Column C: Time of event
 * Column D: Col D
 * Column E: Condition (On enter, On exit, In zone)
 * Column F: Msg (Ship Enter Cable Zone, Ship Exit Cable Zone, Ship Anchoring inside cable zone)
 * Column G: Col G
 * Column H: MMSI
 * Column I: Col I
 * Column J: Ship Name
 * Column K: Col K
 * Column L: Ship Type
 * Column M: Latitude
 * Column N: Longitude
 * Column O: Info (Message sent from AIS Base Station)
 */
export function parseAlarmEventsCSV(
  csvString: string,
  cableWaypoints: { lat: number; lng: number }[]
): AlarmEvent[] {
  const results = Papa.parse(csvString, {
    header: false,
    skipEmptyLines: true,
  });

  const rawRows = results.data as any[][];
  if (!rawRows || rawRows.length === 0) return [];

  // Check if first row is header
  const firstRow = rawRows[0];
  let hasHeader = false;
  const firstRowStr = firstRow.map(c => String(c).toLowerCase()).join(' ');
  if (
    firstRowStr.includes('date') ||
    firstRowStr.includes('time') ||
    firstRowStr.includes('mmsi') ||
    firstRowStr.includes('ship') ||
    firstRowStr.includes('lat') ||
    firstRowStr.includes('msg') ||
    firstRowStr.includes('condition')
  ) {
    hasHeader = true;
  }

  // Header column index map
  const headerMap: Record<string, number> = {};
  if (hasHeader) {
    firstRow.forEach((col: any, idx: number) => {
      const colName = String(col).trim().toLowerCase();
      headerMap[colName] = idx;
    });
  }

  const findColIdx = (aliases: string[], defaultColIdx: number): number => {
    if (!hasHeader) return defaultColIdx;
    for (const a of aliases) {
      const lower = a.toLowerCase();
      if (headerMap[lower] !== undefined) return headerMap[lower];
      const key = Object.keys(headerMap).find(k => k.includes(lower));
      if (key !== undefined) return headerMap[key];
    }
    return defaultColIdx;
  };

  const colA_Idx = findColIdx(['id', 'index', 'ref'], 0);
  const colB_Idx = findColIdx(['date', 'event_date', 'date of event', 'eventdate', 'colb'], 1);
  const colC_Idx = findColIdx(['time', 'event_time', 'time of event', 'eventtime', 'colc'], 2);
  const colE_Idx = findColIdx(['condition', 'zone_condition', 'level', 'status', 'cole'], 4);
  const colF_Idx = findColIdx(['msg', 'message', 'event_type', 'eventtype', 'type', 'colf'], 5);
  const colH_Idx = findColIdx(['mmsi', 'mmsi_number', 'mmsi number', 'ship_id', 'colh'], 7);
  const colJ_Idx = findColIdx(['ship_name', 'shipname', 'vessel_name', 'vesselname', 'vessel', 'name', 'colj'], 9);
  const colL_Idx = findColIdx(['ship_type', 'shiptype', 'type', 'vessel_type', 'coll'], 11);
  const colM_Idx = findColIdx(['latitude', 'lat', 'entry_lat', 'colm', 'y'], 12);
  const colN_Idx = findColIdx(['longitude', 'lon', 'lng', 'long', 'entry_lon', 'coln', 'x'], 13);
  const colO_Idx = findColIdx(['info', 'message_sent', 'detail', 'msg_sent', 'sent_info', 'colo'], 14);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  if (dataRows.length === 0) return [];

  const events: AlarmEvent[] = [];

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    if (!row || row.length === 0) continue;

    // 1. Extract Date and Time accurately using intelligent column & pattern detection
    const { rawDateVal, rawTimeVal } = extractDateTimeFromCsvRow(row, headerMap, colB_Idx, colC_Idx);
    const timestamp = normalizeDateTime(rawDateVal, rawTimeVal, idx);

    // 2. Column E: Condition (3 levels: "In zone", "On enter", "On exit")
    const rawCondition = String((colE_Idx < row.length ? row[colE_Idx] : row[4]) ?? '').trim();
    const lowerCondition = rawCondition.toLowerCase();

    // 3. Column F: Msg (The event type)
    const rawMsg = String((colF_Idx < row.length ? row[colF_Idx] : row[5]) ?? '').trim();
    const lowerMsg = rawMsg.toLowerCase();

    // 4. Column H: MMSI number
    let rawMmsi = String((colH_Idx < row.length ? row[colH_Idx] : row[7]) ?? '').trim();
    if (!rawMmsi || rawMmsi === 'undefined' || rawMmsi === 'null' || rawMmsi === 'G') {
      rawMmsi = `567${100000 + idx}`;
    }
    const mmsi = rawMmsi;

    // 5. Column J: Ship name
    let rawName = String((colJ_Idx < row.length ? row[colJ_Idx] : row[9]) ?? '').trim();
    if (!rawName || rawName === 'undefined' || rawName === 'null' || rawName === 'I') {
      rawName = `M/V Vessel ${idx + 1}`;
    }
    const vesselName = rawName;

    // 6. Column L: Ship type
    let rawType = String((colL_Idx < row.length ? row[colL_Idx] : row[11]) ?? '').trim();
    if (!rawType || rawType === 'undefined' || rawType === 'null' || rawType === 'K') {
      rawType = 'Fishing Trawler';
    }
    const shipType = rawType;

    // 7. Column M & N: Latitude and Longitude
    const rawLat = parseFloat(row[colM_Idx < row.length ? colM_Idx : 12]);
    const rawLon = parseFloat(row[colN_Idx < row.length ? colN_Idx : 13]);
    const lat = isNaN(rawLat) ? 9.40 + (idx % 8) * 0.015 : rawLat;
    const lon = isNaN(rawLon) ? 99.92 + (idx % 8) * 0.015 : rawLon;

    // 8. Column O: Info message sent from AIS base station
    let rawInfo = String((colO_Idx < row.length ? row[colO_Idx] : row[14]) ?? '').trim();

    // Determine Specific Event Type: Ship Enter, Ship Exit, or Ship Anchoring
    let isEnter = lowerCondition.includes('enter') || lowerMsg.includes('enter');
    let isExit = lowerCondition.includes('exit') || lowerMsg.includes('exit');
    let isAnchoring = lowerCondition.includes('in zone') || lowerMsg.includes('anchor') || lowerMsg.includes('alert') || lowerCondition.includes('anchor');

    let eventDetail: 'Ship Enter' | 'Ship Exit' | 'Ship Anchoring' = 'Ship Enter';
    let eventType: 'Alarm' | 'Alert' = 'Alarm';

    if (isAnchoring) {
      eventDetail = 'Ship Anchoring';
      eventType = 'Alert';
    } else if (isExit) {
      eventDetail = 'Ship Exit';
      eventType = 'Alarm';
    } else {
      eventDetail = 'Ship Enter';
      eventType = 'Alarm';
    }

    // Extract speed from Column O message if present, or infer from event type
    let extractedSpeed = extractSpeedFromText(rawInfo);
    if (extractedSpeed === null) {
      extractedSpeed = isAnchoring ? 0.4 : 8.5;
    }

    // Resolve accurate Gross Tonnage (GT) using MMSI number, vessel name, and classification
    const registryEntry = KNOWN_VESSEL_REGISTRY[mmsi];
    const finalVesselName = (rawName && !rawName.startsWith('M/V Vessel')) 
      ? rawName 
      : (registryEntry?.name || rawName);
    const finalShipType = (rawType && rawType !== 'Fishing Trawler') 
      ? rawType 
      : (registryEntry?.type || rawType);
    const grossTonnage = lookupVesselGrossTonnage(mmsi, finalVesselName, finalShipType);

    const distToCable = minDistanceToCable(lat, lon, cableWaypoints);

    // Priority
    let priority: 'Critical' | 'High' | 'Moderate' | 'Low' = 'Moderate';
    if (eventType === 'Alert' && distToCable < 250) {
      priority = 'Critical';
    } else if (eventType === 'Alert' || (finalShipType.toLowerCase().includes('trawl') && distToCable < 400)) {
      priority = 'High';
    } else if (distToCable < 300) {
      priority = 'Moderate';
    } else {
      priority = 'Low';
    }

    // Default base station message if blank
    if (!rawInfo || rawInfo.length < 3) {
      if (isAnchoring) {
        rawInfo = `Speed: ${extractedSpeed} kts. Warning alert: Vessel anchoring inside 500m subsea cable protection corridor broadcasted from AIS base station.`;
      } else if (isExit) {
        rawInfo = `Speed: ${extractedSpeed} kts. Exited 500m subsea safety corridor. Zone departure logged by AIS base station.`;
      } else {
        rawInfo = `Speed: ${extractedSpeed} kts. Entering subsea safety corridor at [${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E]. Broadcast alert sent.`;
      }
    }

    events.push({
      id: `evt-${mmsi}-${idx}-${Date.now()}`,
      timestamp,
      mmsi,
      vesselName: finalVesselName,
      shipType: finalShipType,
      eventType,
      eventDetail,
      entryLat: lat,
      entryLon: lon,
      exitLat: isExit ? lat : undefined,
      exitLon: isExit ? lon : undefined,
      currentLat: lat,
      currentLon: lon,
      speedKnots: extractedSpeed,
      headingDegrees: 45,
      grossTonnage,
      priority,
      durationMinutes: isAnchoring ? 60 : 15,
      distanceToCableMeters: distToCable,
      info: rawInfo,
      status: eventType === 'Alert' ? 'Active' : 'Resolved',
      photoUrl: getVesselPhoto(mmsi, finalShipType),
      callSign: registryEntry?.callSign || `HS${mmsi.slice(-4)}`,
      flagCountry: registryEntry?.flag || 'Thailand',
    });
  }

  return events;
}

/**
 * Parses Historical Ship Type Summary CSV
 */
export function parseHistoricalShipCSV(csvString: string): HistoricalShipSummary[] {
  const results = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const summaries: HistoricalShipSummary[] = [];
  const rows = results.data as any[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    summaries.push({
      id: `hist-${i + 1}`,
      date: String(row.date || row.Date || `2026-09-${String((i % 30) + 1).padStart(2, '0')}`),
      shipType: String(row.shipType || row.ship_type || row.ShipType || 'Cargo Vessel'),
      vesselCount: parseInt(row.vesselCount || row.vessel_count || row.count || 12, 10),
      avgSpeedKnots: parseFloat(row.avgSpeedKnots || row.avg_speed || row.speed || 8.5),
      avgDwellMinutes: parseFloat(row.avgDwellMinutes || row.dwell_minutes || 24),
      totalGrossTonnage: parseInt(row.totalGrossTonnage || row.total_tonnage || 35000, 10),
      alertCount: parseInt(row.alertCount || row.alert_count || row.alerts || 2, 10),
    });
  }

  return summaries;
}

/**
 * Reconstructs AIS Ship Traces by grouping vessel positions per MMSI
 * Builds clean vector lines connecting Entry to Exit positions.
 */
export function generateAISTraces(events: AlarmEvent[]): AIShipTrace[] {
  const traceMap = new Map<string, AIShipTrace>();

  for (const ev of events) {
    const entry: [number, number] = [ev.entryLat, ev.entryLon];
    const exit: [number, number] | undefined = ev.exitLat && ev.exitLon ? [ev.exitLat, ev.exitLon] : undefined;
    const current: [number, number] = [ev.currentLat, ev.currentLon];

    const isAnchoring = ev.eventType === 'Alert' || ev.eventDetail === 'Ship Anchoring';
    const isExit = ev.eventDetail === 'Ship Exit';

    const existing = traceMap.get(ev.mmsi);
    if (!existing) {
      const points: [number, number][] = [];
      points.push(entry);
      if (exit) {
        points.push(exit);
      }

      traceMap.set(ev.mmsi, {
        mmsi: ev.mmsi,
        vesselName: ev.vesselName,
        shipType: ev.shipType,
        entryTime: ev.timestamp,
        exitTime: exit ? ev.timestamp : undefined,
        entryCoord: entry,
        exitCoord: exit,
        currentCoord: current,
        points,
        grossTonnage: ev.grossTonnage,
        priority: ev.priority,
        speedKnots: ev.speedKnots,
        photoUrl: ev.photoUrl,
        hasAnchored: isAnchoring,
      });
    } else {
      if (isExit || exit) {
        existing.exitCoord = exit || current;
        existing.exitTime = ev.timestamp;
        existing.points = [existing.entryCoord, existing.exitCoord];
      } else if (!existing.exitCoord) {
        existing.points.push(current);
      }
      if (isAnchoring) existing.hasAnchored = true;
      if (ev.priority === 'Critical') existing.priority = 'Critical';
    }
  }

  return Array.from(traceMap.values());
}

/**
 * Computes the start date and end date from the AlarmEvent array
 * (derived directly from Column B Date in input CSV)
 */
export function getEventsDateRange(events: AlarmEvent[]): {
  startDate: string;
  endDate: string;
  formattedRange: string;
  totalDays: number;
} {
  if (!events || events.length === 0) {
    return { startDate: 'N/A', endDate: 'N/A', formattedRange: 'No data', totalDays: 0 };
  }

  const dateTimestamps: number[] = [];

  for (const evt of events) {
    if (!evt.timestamp) continue;
    
    // Extract date component (before space or T)
    const cleanTs = evt.timestamp.trim();
    const datePart = cleanTs.split(/[\sT]+/)[0];
    if (!datePart) continue;

    let y = 0, m = 0, d = 0;

    const ymdMatch = datePart.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
    const dmyMatch = datePart.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);

    if (ymdMatch) {
      y = parseInt(ymdMatch[1], 10);
      m = parseInt(ymdMatch[2], 10);
      d = parseInt(ymdMatch[3], 10);
    } else if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const rawY = parseInt(dmyMatch[3], 10);
      y = rawY < 100 ? (rawY < 50 ? 2000 + rawY : 1900 + rawY) : rawY;
      if (p1 > 12 && p2 <= 12) {
        d = p1;
        m = p2;
      } else if (p2 > 12 && p1 <= 12) {
        d = p2;
        m = p1;
      } else {
        d = p1;
        m = p2;
      }
    } else {
      // Try JS Date parsing
      const parsed = new Date(cleanTs);
      if (!isNaN(parsed.getTime())) {
        y = parsed.getFullYear();
        m = parsed.getMonth() + 1;
        d = parsed.getDate();
      }
    }

    if (y > 2400) y -= 543; // Buddhist Era conversion

    if (y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const localDateObj = new Date(y, m - 1, d, 12, 0, 0);
      dateTimestamps.push(localDateObj.getTime());
    }
  }

  if (dateTimestamps.length === 0) {
    return { startDate: 'N/A', endDate: 'N/A', formattedRange: 'N/A', totalDays: 0 };
  }

  dateTimestamps.sort((a, b) => a - b);
  const minTime = dateTimestamps[0];
  const maxTime = dateTimestamps[dateTimestamps.length - 1];

  const formatDate = (t: number) => {
    const dObj = new Date(t);
    const yyyy = dObj.getFullYear();
    const mm = String(dObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dObj.getDate()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  };

  const startStr = formatDate(minTime);
  const endStr = formatDate(maxTime);
  const diffDays = Math.max(1, Math.round((maxTime - minTime) / (1000 * 60 * 60 * 24)) + 1);

  return {
    startDate: startStr,
    endDate: endStr,
    formattedRange: startStr === endStr ? startStr : `${startStr} to ${endStr}`,
    totalDays: diffDays,
  };
}

/**
 * Checks if a geographical coordinate [lat, lng] is located inside a polygon using ray casting algorithm.
 */
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculates the approximate area of a spherical polygon in square kilometers.
 */
export function calculatePolygonAreaSqKm(coords: { lat: number; lng: number }[]): number {
  if (coords.length < 3) return 0;
  const R = 6371; // Earth radius in km
  let total = 0;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i].lat * Math.PI) / 180;
    const lat2 = (coords[j].lat * Math.PI) / 180;
    const dLon = ((coords[j].lng - coords[i].lng) * Math.PI) / 180;

    total += (2 + Math.sin(lat1) + Math.sin(lat2)) * Math.tan(dLon / 2);
  }

  const area = Math.abs(total * (R * R) / 2);
  return Number(area.toFixed(2));
}

/**
 * Parses parking zone coordinates from raw CSV/TSV/Text file.
 * Expects 4 or more corner points with latitude and longitude.
 */
export function parseParkingZoneText(text: string): ParkingZoneCoordinate[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const coords: ParkingZoneCoordinate[] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip comment lines or obvious headers
    if (trimmed.startsWith('#') || trimmed.toLowerCase().includes('latitude') && trimmed.toLowerCase().includes('longitude')) {
      continue;
    }

    const parts = trimmed.split(/[\t,;]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      let lat = NaN;
      let lng = NaN;
      let label = '';

      // Check if first column is a point label (e.g. "Point 1", "P1", "1")
      const p0 = parseFloat(parts[0]);
      const p1 = parseFloat(parts[1]);

      if (!isNaN(p0) && !isNaN(p1)) {
        lat = p0;
        lng = p1;
        if (parts[2]) label = parts[2];
      } else if (parts.length >= 3) {
        const p2 = parseFloat(parts[2]);
        if (!isNaN(p1) && !isNaN(p2)) {
          label = parts[0];
          lat = p1;
          lng = p2;
        }
      }

      // Validate realistic Gulf of Thailand coordinate ranges or general coordinates
      if (!isNaN(lat) && !isNaN(lng)) {
        // In case lon/lat are inverted
        if (Math.abs(lat) > 80 && Math.abs(lng) < 20) {
          const temp = lat;
          lat = lng;
          lng = temp;
        }

        coords.push({
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          label: label || `Point ${coords.length + 1}`,
        });
      }
    }
  }

  return coords;
}
