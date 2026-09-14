import { CableRoute, ShipParticulars, ShipTrackPoint, ShipTrackSummaryData } from '../types';
import { minDistanceToCable } from '../utils/geoUtils';

export const DEFAULT_SAMPLE_SHIP: ShipParticulars = {
  mmsi: '567001588',
  imo: '9233894',
  name: 'SEATRANFERRY 10',
  callSign: 'HSB6336',
  shipType: 'Ro-Ro / Passenger Ferry',
  dimension: '118.5m × 19.2m',
  flag: 'Thailand 🇹🇭',
};

/**
 * Generates a realistic voyage trajectory for testing ship track visualization.
 * Tailored dynamically according to active cable route (e.g. Koh Samui or Si Racha).
 */
export function generateSampleShipTrack(cableRoute: CableRoute): ShipTrackSummaryData {
  const waypoints = cableRoute?.waypoints || [];
  const isSiRacha = waypoints.length > 0 && waypoints[0].lat > 12.0;

  // Center point of the subsea cable route
  const midWp = waypoints.length > 0
    ? waypoints[Math.floor(waypoints.length / 2)]
    : { lat: 9.4025, lng: 99.9430 };

  const corridorWidth = cableRoute?.protectionCorridorMeters || 500;

  // Base raw timestamps on 2026-09-01 local Thailand maritime logs
  const baseDate = new Date('2026-09-01T12:00:00+07:00');

  type RawPoint = {
    offsetLat: number;
    offsetLng: number;
    sog: number;
    cog: number;
    status: string;
    minutes: number;
  };

  const rawTrajectory: RawPoint[] = isSiRacha
    ? [
        // Si Racha corridor approach
        { offsetLat: -0.022, offsetLng: -0.035, sog: 12.8, cog: 55, status: 'Under way using engine', minutes: 0 },
        { offsetLat: -0.016, offsetLng: -0.025, sog: 12.4, cog: 54, status: 'Under way using engine', minutes: 5 },
        { offsetLat: -0.010, offsetLng: -0.016, sog: 12.1, cog: 52, status: 'Under way using engine', minutes: 10 },
        { offsetLat: -0.005, offsetLng: -0.008, sog: 11.5, cog: 50, status: 'Under way using engine', minutes: 15 },
        // Entering cable zone with high speed (Yellow)
        { offsetLat: -0.001, offsetLng: -0.002, sog: 10.8, cog: 48, status: 'Under way using engine', minutes: 20 },
        { offsetLat: 0.001, offsetLng: 0.001, sog: 8.2, cog: 45, status: 'Under way using engine', minutes: 25 },
        // Slowing down inside cable zone SOG < 5 (Orange)
        { offsetLat: 0.002, offsetLng: 0.002, sog: 3.8, cog: 42, status: 'Under way using engine', minutes: 30 },
        { offsetLat: 0.0025, offsetLng: 0.0022, sog: 1.9, cog: 38, status: 'Under way using engine', minutes: 35 },
        // Engine stop inside cable zone SOG < 5 (Orange)
        { offsetLat: 0.0028, offsetLng: 0.0023, sog: 0.8, cog: 30, status: 'Under way using engine', minutes: 40 },
        // Isolated temporary anchor event near corridor boundary (Red)
        { offsetLat: 0.0040, offsetLng: 0.0045, sog: 0.2, cog: 25, status: 'At Anchor', minutes: 45 },
        // Resuming transit and leaving corridor
        { offsetLat: 0.008, offsetLng: 0.010, sog: 6.5, cog: 42, status: 'Under way using engine', minutes: 52 },
        { offsetLat: 0.012, offsetLng: 0.018, sog: 11.9, cog: 46, status: 'Under way using engine', minutes: 55 },
        { offsetLat: 0.018, offsetLng: 0.028, sog: 12.2, cog: 48, status: 'Under way using engine', minutes: 62 },
        // Outside cable zone - drops anchor in harbor anchorage (Red)
        { offsetLat: 0.024, offsetLng: 0.038, sog: 1.4, cog: 50, status: 'Under way using engine', minutes: 70 },
        { offsetLat: 0.026, offsetLng: 0.042, sog: 0.2, cog: 12, status: 'At Anchor', minutes: 78 },
        { offsetLat: 0.0261, offsetLng: 0.0421, sog: 0.1, cog: 15, status: 'At Anchor', minutes: 88 },
        { offsetLat: 0.0262, offsetLng: 0.0420, sog: 0.1, cog: 14, status: 'At Anchor', minutes: 98 },
        { offsetLat: 0.0261, offsetLng: 0.0419, sog: 0.2, cog: 16, status: 'At Anchor', minutes: 110 },
      ]
    : [
        // Koh Samui crossing approach
        { offsetLat: -0.042, offsetLng: -0.055, sog: 13.4, cog: 48, status: 'Under way using engine', minutes: 0 },
        { offsetLat: -0.032, offsetLng: -0.042, sog: 13.2, cog: 47, status: 'Under way using engine', minutes: 6 },
        { offsetLat: -0.022, offsetLng: -0.029, sog: 12.9, cog: 46, status: 'Under way using engine', minutes: 12 },
        { offsetLat: -0.013, offsetLng: -0.017, sog: 12.5, cog: 45, status: 'Under way using engine', minutes: 18 },
        // Entering cable zone at high speed (Yellow: inside cable zone & SOG > 5)
        { offsetLat: -0.005, offsetLng: -0.006, sog: 11.8, cog: 44, status: 'Under way using engine', minutes: 24 },
        { offsetLat: 0.000, offsetLng: 0.001, sog: 9.4, cog: 43, status: 'Under way using engine', minutes: 30 },
        // Slowing down inside cable zone (Orange: inside cable zone & SOG < 5)
        { offsetLat: 0.003, offsetLng: 0.004, sog: 4.2, cog: 40, status: 'Under way using engine', minutes: 36 },
        { offsetLat: 0.0038, offsetLng: 0.0045, sog: 2.1, cog: 36, status: 'Under way using engine', minutes: 42 },
        { offsetLat: 0.0042, offsetLng: 0.0048, sog: 1.1, cog: 32, status: 'Under way using engine', minutes: 48 },
        // Isolated temporary emergency anchor stop inside corridor (Red: At Anchor)
        { offsetLat: 0.0045, offsetLng: 0.0051, sog: 0.2, cog: 15, status: 'At Anchor', minutes: 52 },
        // Resuming speed inside corridor (Yellow)
        { offsetLat: 0.007, offsetLng: 0.009, sog: 6.8, cog: 42, status: 'Under way using engine', minutes: 58 },
        // Exiting corridor under way (Green: outside cable zone & Under way)
        { offsetLat: 0.014, offsetLng: 0.018, sog: 12.2, cog: 46, status: 'Under way using engine', minutes: 62 },
        { offsetLat: 0.023, offsetLng: 0.030, sog: 12.8, cog: 48, status: 'Under way using engine', minutes: 70 },
        { offsetLat: 0.032, offsetLng: 0.042, sog: 12.5, cog: 50, status: 'Under way using engine', minutes: 78 },
        // Approaching designated outer anchorage and dropping anchor (Red: At Anchor)
        { offsetLat: 0.038, offsetLng: 0.052, sog: 3.5, cog: 55, status: 'Under way using engine', minutes: 86 },
        { offsetLat: 0.042, offsetLng: 0.058, sog: 0.3, cog: 18, status: 'At Anchor', minutes: 94 },
        { offsetLat: 0.0422, offsetLng: 0.0582, sog: 0.1, cog: 20, status: 'At Anchor', minutes: 104 },
        { offsetLat: 0.0421, offsetLng: 0.0581, sog: 0.2, cog: 22, status: 'At Anchor', minutes: 114 },
        { offsetLat: 0.0420, offsetLng: 0.0583, sog: 0.1, cog: 19, status: 'At Anchor', minutes: 125 },
      ];

  const points: ShipTrackPoint[] = rawTrajectory.map((p, idx) => {
    const lat = Number((midWp.lat + p.offsetLat).toFixed(6));
    const lng = Number((midWp.lng + p.offsetLng).toFixed(6));

    const dist = minDistanceToCable(lat, lng, waypoints);
    const isInsideCableZone = dist <= corridorWidth;

    // Conditions:
    // - Red if value in status column in CSV file is "At Anchor"
    // - Green if value in status column in CSV file is "Under way using engine"
    // - Orange if the position of ship is inside cable zone and SOG is less than 5
    // - Yellow if the position of ship is inside cable zone and SOG is more than 5
    let dotColor: 'red' | 'green' | 'orange' | 'yellow' = 'green';
    let dotCategory = 'Under way using engine';

    if (isInsideCableZone) {
      if (p.sog < 5) {
        dotColor = 'orange';
        dotCategory = 'Inside Cable Zone (SOG < 5 kts)';
      } else {
        dotColor = 'yellow';
        dotCategory = 'Inside Cable Zone (SOG ≥ 5 kts)';
      }
    } else {
      const normStatus = (p.status || '').toLowerCase().trim();
      if (normStatus.includes('anchor')) {
        dotColor = 'red';
        dotCategory = 'At Anchor';
      } else if (normStatus.includes('under way') || normStatus.includes('engine') || normStatus.includes('underway')) {
        dotColor = 'green';
        dotCategory = 'Under way using engine';
      } else {
        dotColor = 'green';
        dotCategory = p.status || 'Under way';
      }
    }

    const ptDate = new Date(baseDate.getTime() + p.minutes * 60 * 1000);
    const localTimeStr = ptDate.toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return {
      id: `pt-${idx + 1}`,
      timestamp: ptDate.toISOString(),
      localTimeStr,
      lat,
      lng,
      sog: p.sog,
      cog: p.cog,
      status: p.status,
      isInsideCableZone,
      distanceToCableMeters: dist,
      dotColor,
      dotCategory,
    };
  });

  return calculateShipTrackSummary(DEFAULT_SAMPLE_SHIP, points);
}

/**
 * Computes summary statistics from a list of ship track points.
 */
export function calculateShipTrackSummary(
  ship: ShipParticulars,
  points: ShipTrackPoint[]
): ShipTrackSummaryData {
  if (points.length === 0) {
    return {
      ship,
      points: [],
      totalPoints: 0,
      anchoringCount: 0,
      cableZoneEnterCount: 0,
      pointsInCableZoneCount: 0,
      pointsAnchoringCount: 0,
      minSog: 0,
      maxSog: 0,
      avgSog: 0,
      minDistanceToCableMeters: 0,
      startTime: '-',
      endTime: '-',
      durationFormatted: '-',
    };
  }

  // Count anchoring episodes (transitions into "At Anchor")
  let anchoringCount = 0;
  let pointsAnchoringCount = 0;
  let inAnchorEpisode = false;

  // Count cable zone entrances (transitions into cable zone)
  let cableZoneEnterCount = 0;
  let pointsInCableZoneCount = 0;
  let inZoneEpisode = false;

  let totalSog = 0;
  let minSog = Infinity;
  let maxSog = -Infinity;
  let minDistance = Infinity;

  points.forEach((pt) => {
    // SOG stats
    totalSog += pt.sog;
    if (pt.sog < minSog) minSog = pt.sog;
    if (pt.sog > maxSog) maxSog = pt.sog;
    if (pt.distanceToCableMeters < minDistance) minDistance = pt.distanceToCableMeters;

    // Anchoring check
    const isAnchor = (pt.status || '').toLowerCase().includes('anchor');
    if (isAnchor) {
      pointsAnchoringCount++;
      if (!inAnchorEpisode) {
        anchoringCount++;
        inAnchorEpisode = true;
      }
    } else {
      inAnchorEpisode = false;
    }

    // Cable zone check
    if (pt.isInsideCableZone) {
      pointsInCableZoneCount++;
      if (!inZoneEpisode) {
        cableZoneEnterCount++;
        inZoneEpisode = true;
      }
    } else {
      inZoneEpisode = false;
    }
  });

  const avgSog = Number((totalSog / points.length).toFixed(1));
  if (minSog === Infinity) minSog = 0;
  if (maxSog === -Infinity) maxSog = 0;
  if (minDistance === Infinity) minDistance = 0;

  const startTime = points[0]?.localTimeStr || '';
  const endTime = points[points.length - 1]?.localTimeStr || '';

  // Duration
  let durationFormatted = '-';
  try {
    const tStart = new Date(points[0].timestamp).getTime();
    const tEnd = new Date(points[points.length - 1].timestamp).getTime();
    const diffMs = Math.max(0, tEnd - tStart);
    const hrs = Math.floor(diffMs / (3600 * 1000));
    const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    durationFormatted = `${hrs}h ${mins}m`;
  } catch {
    durationFormatted = `${points.length} fixes`;
  }

  return {
    ship,
    points,
    totalPoints: points.length,
    anchoringCount,
    cableZoneEnterCount,
    pointsInCableZoneCount,
    pointsAnchoringCount,
    minSog: Number(minSog.toFixed(1)),
    maxSog: Number(maxSog.toFixed(1)),
    avgSog,
    minDistanceToCableMeters: minDistance,
    startTime,
    endTime,
    durationFormatted,
  };
}

/**
 * Exports ship track points into downloadable CSV format
 */
export function exportShipTrackToCsvString(data: ShipTrackSummaryData): string {
  const headers = [
    'DateTime',
    'Latitude',
    'Longitude',
    'SOG',
    'COG',
    'Status',
    'MMSI',
    'IMO',
    'Name',
    'CallSign',
    'Type',
    'Dimension',
    'Flag',
  ];

  const rows = data.points.map((pt) => [
    `"${pt.localTimeStr}"`,
    pt.lat.toFixed(6),
    pt.lng.toFixed(6),
    pt.sog.toFixed(1),
    (pt.cog ?? 0).toFixed(0),
    `"${pt.status}"`,
    `"${data.ship.mmsi}"`,
    `"${data.ship.imo}"`,
    `"${data.ship.name}"`,
    `"${data.ship.callSign}"`,
    `"${data.ship.shipType}"`,
    `"${data.ship.dimension}"`,
    `"${data.ship.flag}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
