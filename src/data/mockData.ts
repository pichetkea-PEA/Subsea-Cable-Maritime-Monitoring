import { CableRoute, AlarmEvent, HistoricalShipSummary, UserProfile, ParkingZone } from '../types';
import { getVesselPhoto, minDistanceToCable, lookupVesselGrossTonnage } from '../utils/geoUtils';

// Default Admin User Profile
export const DEFAULT_USER: UserProfile = {
  email: 'pichet.kea@gmail.com',
  name: 'Pichet Kea',
  role: 'admin',
  department: 'Maritime Infrastructure Security & Subsea Operations',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
};

// Permanent Samui Vessel Parking Zone for Large-Size Ships
export const DEFAULT_PARKING_ZONE: ParkingZone = {
  id: 'samui-parking-zone-1',
  name: 'Samui Parking Zone',
  description: 'Designated Vessel Parking & Anchorage Area for Large-Size Ships (Cruise liners, container vessels & deep-draft maritime traffic)',
  targetVesselType: 'Large-size ship',
  isActive: true,
  color: '#2563eb',
  updatedAt: '2026-09-08T00:00:00Z',
  coordinates: [
    { lat: 9.523328, lng: 99.903333, label: 'Point 1' },
    { lat: 9.523330, lng: 99.866663, label: 'Point 2' },
    { lat: 9.566659, lng: 99.866663, label: 'Point 3' },
    { lat: 9.566662, lng: 99.879994, label: 'Point 4' },
  ],
};

// Realistic Subsea Cable Route: Surat Thani Mainland to Ko Samui Island (approx 20.8 km marine crossing)
export const DEFAULT_CABLE_ROUTE: CableRoute = {
  id: 'route-default-samui-link-1',
  name: 'Mainland (Khanom) – Ko Samui 115kV Subsea Circuit Alpha',
  mainlandStation: 'Khanom Mainland Landing Terminal (TP#1)',
  islandStation: 'Ko Samui Submarine Substation (TP#12)',
  totalLengthKm: 22.45,
  protectionCorridorMeters: 500, // 500m left/right (1,000m corridor)
  status: 'Operational',
  updatedAt: '2026-09-06T14:30:00Z',
  isDefault: true,
  waypoints: [
    { id: 'wp-1', name: 'Khanom Shore Landing (KP 0.0)', lat: 9.3245, lng: 99.8652, depthMeters: 4, sequence: 1 },
    { id: 'wp-2', name: 'Nearshore Burial Trench (KP 1.8)', lat: 9.3380, lng: 99.8785, depthMeters: 14, sequence: 2 },
    { id: 'wp-3', name: 'Shipping Channel Ingress (KP 4.5)', lat: 9.3562, lng: 99.8964, depthMeters: 26, sequence: 3 },
    { id: 'wp-4', name: 'Central Trench Trenching WP (KP 8.2)', lat: 9.3812, lng: 99.9210, depthMeters: 38, sequence: 4 },
    { id: 'wp-5', name: 'Deep Channel Midpoint (KP 11.5)', lat: 9.4025, lng: 99.9430, depthMeters: 46, sequence: 5 },
    { id: 'wp-6', name: 'Subsea Junction Joint Box (KP 14.8)', lat: 9.4280, lng: 99.9685, depthMeters: 42, sequence: 6 },
    { id: 'wp-7', name: 'North Channel Crossing (KP 17.6)', lat: 9.4490, lng: 99.9912, depthMeters: 31, sequence: 7 },
    { id: 'wp-8', name: 'Samui Approach Shelf (KP 19.8)', lat: 9.4675, lng: 100.0105, depthMeters: 18, sequence: 8 },
    { id: 'wp-9', name: 'Ko Samui Shore Landing (KP 22.5)', lat: 9.4820, lng: 100.0260, depthMeters: 5, sequence: 9 },
  ],
};

// Realistic Seed Alarm Events (Alarms & Alerts) with 2-adjacent-row crossing traces and anchoring alerts
const rawSampleEvents = [
  // Flagship Cruise Liner: CELEBRITY SOLSTICE (121,878 Gross Tonnage)
  {
    mmsi: '249409000',
    vesselName: 'CELEBRITY SOLSTICE',
    shipType: 'Passenger Cruise Ship',
    eventType: 'Alarm' as const,
    eventDetail: 'Ship Enter' as const,
    entryLat: 9.4250,
    entryLon: 99.9580,
    exitLat: 9.4010,
    exitLon: 99.9320,
    currentLat: 9.4125,
    currentLon: 99.9440,
    speedKnots: 16.8,
    headingDegrees: 215,
    grossTonnage: 121878,
    timestamp: '2026-09-06 20:15:00',
    durationMinutes: 18,
    info: 'Speed: 16.8 kts. Solstice-class passenger cruise ship transiting deep water corridor at KP 12.4',
    priority: 'Moderate' as const,
    status: 'Resolved' as const,
    callSign: '9HJB9',
    flagCountry: 'Malta',
  },
  // Pair 1: Bulk Carrier crossing corridor (2 adjacent rows)
  {
    mmsi: '567112233',
    vesselName: 'OCEAN TITAN II',
    shipType: 'Bulk Carrier',
    eventType: 'Alarm' as const,
    eventDetail: 'Ship Enter' as const,
    entryLat: 9.4120,
    entryLon: 99.9350,
    exitLat: 9.3950,
    exitLon: 99.9550,
    currentLat: 9.4035,
    currentLon: 99.9450,
    speedKnots: 11.4,
    headingDegrees: 125,
    grossTonnage: 32400,
    timestamp: '2026-09-06 18:30:00',
    durationMinutes: 14,
    info: 'Speed: 11.4 kts. Entering subsea safety corridor',
    priority: 'Low' as const,
    status: 'Resolved' as const,
    callSign: 'V2BG8',
    flagCountry: 'Panama',
  },
  // Anchoring Alert 1: Fishing Trawler anchoring inside 500m zone
  {
    mmsi: '567891234',
    vesselName: 'CHOK CHAROEN 9',
    shipType: 'Fishing Trawler',
    eventType: 'Alert' as const,
    eventDetail: 'Ship Anchoring' as const,
    entryLat: 9.3845,
    entryLon: 99.9190,
    exitLat: 9.3830,
    exitLon: 99.9230,
    currentLat: 9.3820,
    currentLon: 99.9215,
    speedKnots: 0.3,
    headingDegrees: 142,
    grossTonnage: 185,
    timestamp: '2026-09-06 19:45:00',
    durationMinutes: 84,
    info: 'Speed: 0.3 kts. Anchoring alert warning broadcasted',
    priority: 'Critical' as const,
    status: 'Active' as const,
    callSign: 'HS4421',
    flagCountry: 'Thailand',
  },
  // Seatran Ferry 10 Ro-Pax Ferry Crossing
  {
    mmsi: '567001507',
    vesselName: 'SEATRAN FERRY 10',
    shipType: 'Passenger Ro-Pax Ferry',
    eventType: 'Alarm' as const,
    eventDetail: 'Ship Enter' as const,
    entryLat: 9.4520,
    entryLon: 99.9950,
    exitLat: 9.4710,
    exitLon: 100.0150,
    currentLat: 9.4610,
    currentLon: 100.0050,
    speedKnots: 13.5,
    headingDegrees: 52,
    grossTonnage: 1450,
    timestamp: '2026-09-06 17:20:00',
    durationMinutes: 12,
    info: 'Speed: 13.5 kts. Scheduled passenger & vehicle ferry crossing Don Sak to Koh Samui',
    priority: 'Low' as const,
    status: 'Resolved' as const,
    callSign: 'HS1507',
    flagCountry: 'Thailand',
  },
  // Pair 2: Passenger Ferry crossing corridor (2 adjacent rows)
  {
    mmsi: '567334455',
    vesselName: 'SAMUI PRINCESS V',
    shipType: 'Passenger Catamaran Ferry',
    eventType: 'Alarm' as const,
    eventDetail: 'Ship Enter' as const,
    entryLat: 9.4600,
    entryLon: 100.0050,
    exitLat: 9.4750,
    exitLon: 100.0180,
    currentLat: 9.4675,
    currentLon: 100.0115,
    speedKnots: 18.2,
    headingDegrees: 48,
    grossTonnage: 650,
    timestamp: '2026-09-06 15:00:00',
    durationMinutes: 6,
    info: 'Speed: 18.2 kts. Entering ferry channel crossing',
    priority: 'Low' as const,
    status: 'Resolved' as const,
    callSign: 'HS1123',
    flagCountry: 'Thailand',
  },
  // Anchoring Alert 2: Pair Trawl fishing slow drag
  {
    mmsi: '567998811',
    vesselName: 'SEA DRAGON 08',
    shipType: 'Fishing Boat (Pair Trawl)',
    eventType: 'Alert' as const,
    eventDetail: 'Ship Anchoring' as const,
    entryLat: 9.4310,
    entryLon: 99.9650,
    exitLat: 9.4260,
    exitLon: 99.9720,
    currentLat: 9.4290,
    currentLon: 99.9675,
    speedKnots: 1.1,
    headingDegrees: 210,
    grossTonnage: 240,
    timestamp: '2026-09-06 16:15:00',
    durationMinutes: 52,
    info: 'Speed: 1.1 kts. Stationary drift near joint box',
    priority: 'High' as const,
    status: 'Investigating' as const,
    callSign: 'HS9022',
    flagCountry: 'Thailand',
  },
  // Large Container Ship: KRISTEN MAERSK (45,000 GT)
  {
    mmsi: '567223344',
    vesselName: 'KRISTEN MAERSK',
    shipType: 'Container Ship',
    eventType: 'Alarm' as const,
    eventDetail: 'Ship Enter' as const,
    entryLat: 9.4180,
    entryLon: 99.9520,
    exitLat: 9.3920,
    exitLon: 99.9280,
    currentLat: 9.4050,
    currentLon: 99.9400,
    speedKnots: 14.6,
    headingDegrees: 220,
    grossTonnage: 45000,
    timestamp: '2026-09-05 22:30:00',
    durationMinutes: 10,
    info: 'Speed: 14.6 kts. High-speed transit',
    priority: 'Low' as const,
    status: 'Resolved' as const,
    callSign: 'OWJE2',
    flagCountry: 'Denmark',
  },
  // Pair 3: Chemical Tanker crossing corridor (2 adjacent rows)
  {
    mmsi: '567667788',
    vesselName: 'PACIFIC DISCOVERY',
    shipType: 'Chemical / Oil Tanker',
    eventType: 'Alarm' as const,
    eventDetail: 'Ship Enter' as const,
    entryLat: 9.3980,
    entryLon: 99.9320,
    exitLat: 9.3750,
    exitLon: 99.9150,
    currentLat: 9.3865,
    currentLon: 99.9235,
    speedKnots: 9.8,
    headingDegrees: 215,
    grossTonnage: 18500,
    timestamp: '2026-09-06 11:40:00',
    durationMinutes: 16,
    info: 'Speed: 9.8 kts. Southbound channel entry',
    priority: 'Moderate' as const,
    status: 'Resolved' as const,
    callSign: '9V891',
    flagCountry: 'Singapore',
  },
  // Anchoring Alert 3: Stationary Tug near burial trench
  {
    mmsi: '567778899',
    vesselName: 'THAI SALVAGE TUG 1',
    shipType: 'Tug / Offshore Support',
    eventType: 'Alert' as const,
    eventDetail: 'Ship Anchoring' as const,
    entryLat: 9.3350,
    entryLon: 99.8750,
    exitLat: 9.3420,
    exitLon: 99.8820,
    currentLat: 9.3390,
    currentLon: 99.8790,
    speedKnots: 0.8,
    headingDegrees: 85,
    grossTonnage: 890,
    timestamp: '2026-09-06 09:10:00',
    durationMinutes: 65,
    info: 'Speed: 0.8 kts. Offshore tethering position',
    priority: 'High' as const,
    status: 'Investigating' as const,
    callSign: 'HS5588',
    flagCountry: 'Thailand',
  },
  // Pair 4: General Cargo crossing corridor (2 adjacent rows)
  {
    mmsi: '567889900',
    vesselName: 'EASTERN GLORY',
    shipType: 'General Cargo',
    eventType: 'Alarm' as const,
    eventDetail: 'Ship Exit' as const,
    entryLat: 9.4420,
    entryLon: 99.9820,
    exitLat: 9.4580,
    exitLon: 100.0020,
    currentLat: 9.4500,
    currentLon: 99.9920,
    speedKnots: 10.2,
    headingDegrees: 40,
    grossTonnage: 8400,
    timestamp: '2026-09-06 07:05:00',
    durationMinutes: 15,
    info: 'Speed: 10.0 kts. Exit zone acknowledged',
    priority: 'Low' as const,
    status: 'Resolved' as const,
    callSign: 'VRKC3',
    flagCountry: 'Hong Kong',
  },
  // Anchoring Alert 4: Extended drift near central trench
  {
    mmsi: '567556677',
    vesselName: 'NAVA RATAN 4',
    shipType: 'Fishing Trawler',
    eventType: 'Alert' as const,
    eventDetail: 'Ship Anchoring' as const,
    entryLat: 9.3780,
    entryLon: 99.9140,
    exitLat: 9.3850,
    exitLon: 99.9250,
    currentLat: 9.3810,
    currentLon: 99.9195,
    speedKnots: 0.5,
    headingDegrees: 310,
    grossTonnage: 175,
    timestamp: '2026-09-05 18:15:00',
    durationMinutes: 98,
    info: 'Speed: 0.5 kts. Anchoring near subsea cable',
    priority: 'Critical' as const,
    status: 'Resolved' as const,
    callSign: 'HS3309',
    flagCountry: 'Thailand',
  },
];

export const INITIAL_ALARM_EVENTS: AlarmEvent[] = rawSampleEvents.map((e, idx) => {
  const dist = minDistanceToCable(e.currentLat, e.currentLon, DEFAULT_CABLE_ROUTE.waypoints);
  const accurateGT = lookupVesselGrossTonnage(e.mmsi, e.vesselName, e.shipType, e.grossTonnage);
  return {
    ...e,
    grossTonnage: accurateGT,
    id: `evt-seed-${idx + 1}`,
    distanceToCableMeters: dist,
    photoUrl: getVesselPhoto(e.mmsi, e.shipType),
  };
});

// Seed Historical Ship Type Summary Data
export const INITIAL_HISTORICAL_SHIPS: HistoricalShipSummary[] = [
  { id: 'hist-1', date: '2026-09-01', shipType: 'Fishing Trawlers', vesselCount: 42, avgSpeedKnots: 4.2, avgDwellMinutes: 48, totalGrossTonnage: 7800, alertCount: 8 },
  { id: 'hist-2', date: '2026-09-01', shipType: 'Cargo Vessels', vesselCount: 28, avgSpeedKnots: 11.8, avgDwellMinutes: 14, totalGrossTonnage: 284000, alertCount: 1 },
  { id: 'hist-3', date: '2026-09-01', shipType: 'Crude & Oil Tankers', vesselCount: 14, avgSpeedKnots: 10.2, avgDwellMinutes: 18, totalGrossTonnage: 195000, alertCount: 0 },
  { id: 'hist-4', date: '2026-09-01', shipType: 'Passenger Ferries', vesselCount: 36, avgSpeedKnots: 16.5, avgDwellMinutes: 8, totalGrossTonnage: 26000, alertCount: 0 },
  { id: 'hist-5', date: '2026-09-01', shipType: 'Tug & Offshore Support', vesselCount: 9, avgSpeedKnots: 5.4, avgDwellMinutes: 38, totalGrossTonnage: 8100, alertCount: 2 },
  
  { id: 'hist-6', date: '2026-09-02', shipType: 'Fishing Trawlers', vesselCount: 51, avgSpeedKnots: 3.8, avgDwellMinutes: 56, totalGrossTonnage: 9400, alertCount: 11 },
  { id: 'hist-7', date: '2026-09-02', shipType: 'Cargo Vessels', vesselCount: 31, avgSpeedKnots: 12.1, avgDwellMinutes: 13, totalGrossTonnage: 310000, alertCount: 0 },
  { id: 'hist-8', date: '2026-09-02', shipType: 'Crude & Oil Tankers', vesselCount: 12, avgSpeedKnots: 9.9, avgDwellMinutes: 19, totalGrossTonnage: 162000, alertCount: 0 },
  { id: 'hist-9', date: '2026-09-02', shipType: 'Passenger Ferries', vesselCount: 38, avgSpeedKnots: 17.0, avgDwellMinutes: 8, totalGrossTonnage: 27400, alertCount: 0 },
  { id: 'hist-10', date: '2026-09-02', shipType: 'Tug & Offshore Support', vesselCount: 11, avgSpeedKnots: 6.1, avgDwellMinutes: 32, totalGrossTonnage: 9900, alertCount: 1 },

  { id: 'hist-11', date: '2026-09-03', shipType: 'Fishing Trawlers', vesselCount: 39, avgSpeedKnots: 4.5, avgDwellMinutes: 44, totalGrossTonnage: 7200, alertCount: 6 },
  { id: 'hist-12', date: '2026-09-03', shipType: 'Cargo Vessels', vesselCount: 25, avgSpeedKnots: 11.5, avgDwellMinutes: 15, totalGrossTonnage: 250000, alertCount: 0 },
  { id: 'hist-13', date: '2026-09-03', shipType: 'Crude & Oil Tankers', vesselCount: 16, avgSpeedKnots: 10.4, avgDwellMinutes: 17, totalGrossTonnage: 220000, alertCount: 1 },
  { id: 'hist-14', date: '2026-09-03', shipType: 'Passenger Ferries', vesselCount: 35, avgSpeedKnots: 16.8, avgDwellMinutes: 8, totalGrossTonnage: 25200, alertCount: 0 },
  { id: 'hist-15', date: '2026-09-03', shipType: 'Tug & Offshore Support', vesselCount: 8, avgSpeedKnots: 5.8, avgDwellMinutes: 35, totalGrossTonnage: 7200, alertCount: 1 },

  { id: 'hist-16', date: '2026-09-04', shipType: 'Fishing Trawlers', vesselCount: 48, avgSpeedKnots: 4.0, avgDwellMinutes: 52, totalGrossTonnage: 8900, alertCount: 9 },
  { id: 'hist-17', date: '2026-09-04', shipType: 'Cargo Vessels', vesselCount: 34, avgSpeedKnots: 12.0, avgDwellMinutes: 14, totalGrossTonnage: 340000, alertCount: 1 },
  { id: 'hist-18', date: '2026-09-04', shipType: 'Crude & Oil Tankers', vesselCount: 15, avgSpeedKnots: 10.1, avgDwellMinutes: 18, totalGrossTonnage: 205000, alertCount: 0 },
  { id: 'hist-19', date: '2026-09-04', shipType: 'Passenger Ferries', vesselCount: 40, avgSpeedKnots: 17.2, avgDwellMinutes: 7, totalGrossTonnage: 28800, alertCount: 0 },
  { id: 'hist-20', date: '2026-09-04', shipType: 'Tug & Offshore Support', vesselCount: 12, avgSpeedKnots: 4.9, avgDwellMinutes: 42, totalGrossTonnage: 10800, alertCount: 3 },

  { id: 'hist-21', date: '2026-09-05', shipType: 'Fishing Trawlers', vesselCount: 55, avgSpeedKnots: 3.5, avgDwellMinutes: 62, totalGrossTonnage: 10200, alertCount: 14 },
  { id: 'hist-22', date: '2026-09-05', shipType: 'Cargo Vessels', vesselCount: 29, avgSpeedKnots: 11.9, avgDwellMinutes: 13, totalGrossTonnage: 290000, alertCount: 0 },
  { id: 'hist-23', date: '2026-09-05', shipType: 'Crude & Oil Tankers', vesselCount: 18, avgSpeedKnots: 10.5, avgDwellMinutes: 16, totalGrossTonnage: 245000, alertCount: 0 },
  { id: 'hist-24', date: '2026-09-05', shipType: 'Passenger Ferries', vesselCount: 42, avgSpeedKnots: 16.9, avgDwellMinutes: 8, totalGrossTonnage: 30200, alertCount: 0 },
  { id: 'hist-25', date: '2026-09-05', shipType: 'Tug & Offshore Support', vesselCount: 14, avgSpeedKnots: 5.2, avgDwellMinutes: 40, totalGrossTonnage: 12600, alertCount: 2 },
];

// Sample CSV Download Templates
export const SAMPLE_CABLE_CSV = `latitude,longitude,depth_meters,waypoint_name
9.3245,99.8652,4,Mainland Landing Terminal KP0
9.3380,99.8785,14,Nearshore Burial Trench KP1.8
9.3562,99.8964,26,Shipping Channel Ingress KP4.5
9.3812,99.9210,38,Central Trench Trenching WP KP8.2
9.4025,99.9430,46,Deep Channel Midpoint KP11.5
9.4280,99.9685,42,Subsea Junction Joint Box KP14.8
9.4490,99.9912,31,North Channel Crossing KP17.6
9.4675,100.0105,18,Samui Approach Shelf KP19.8
9.4820,100.0260,5,Ko Samui Shore Landing KP22.5`;

export const SAMPLE_ALARMS_CSV = `ID,Date,Time,ColD,Condition,Msg,ColG,MMSI,ColI,ShipName,ColK,ShipType,Latitude,Longitude,Info
EVT-01,2026-09-06,20:15:00,D,On enter,Ship Enter Cable Zone,G,249409000,I,CELEBRITY SOLSTICE,K,Passenger Cruise Ship,9.4250,99.9580,"Speed: 16.8 kts. Solstice-class passenger cruise ship transiting deep water corridor at KP 12.4"
EVT-02,2026-09-06,20:33:00,D,On exit,Ship Exit Cable Zone,G,249409000,I,CELEBRITY SOLSTICE,K,Passenger Cruise Ship,9.4010,99.9320,"Speed: 16.5 kts. Cleared 500m subsea safety zone"
EVT-03,2026-09-06,18:30:00,D,On enter,Ship Enter Cable Zone,G,567112233,I,OCEAN TITAN II,K,Bulk Carrier,9.4120,99.9350,"Speed: 11.4 kts. Entering subsea safety corridor"
EVT-04,2026-09-06,18:44:00,D,On exit,Ship Exit Cable Zone,G,567112233,I,OCEAN TITAN II,K,Bulk Carrier,9.3950,99.9550,"Speed: 11.2 kts. Exited 500m corridor"
EVT-05,2026-09-06,19:45:00,D,In zone,Ship Anchoring inside cable zone,G,567891234,I,CHOK CHAROEN 9,K,Fishing Trawler,9.3820,99.9215,"Speed: 0.3 kts. Anchoring alert warning broadcasted"
EVT-06,2026-09-06,17:20:00,D,On enter,Ship Enter Cable Zone,G,567001507,I,SEATRAN FERRY 10,K,Passenger Ro-Pax Ferry,9.4520,99.9950,"Speed: 13.5 kts. Scheduled passenger & vehicle ferry crossing Don Sak to Koh Samui"
EVT-07,2026-09-06,17:32:00,D,On exit,Ship Exit Cable Zone,G,567001507,I,SEATRAN FERRY 10,K,Passenger Ro-Pax Ferry,9.4710,100.0150,"Speed: 13.4 kts. Ro-Pax ferry exited cable crossing"
EVT-08,2026-09-06,15:00:00,D,On enter,Ship Enter Cable Zone,G,567334455,I,SAMUI PRINCESS V,K,Passenger Ferry,9.4600,100.0050,"Speed: 18.2 kts. Entering ferry channel crossing"
EVT-09,2026-09-06,15:06:00,D,On exit,Ship Exit Cable Zone,G,567334455,I,SAMUI PRINCESS V,K,Passenger Ferry,9.4750,100.0180,"Speed: 18.0 kts. Cleared cable crossing"
EVT-10,2026-09-06,16:15:00,D,In zone,Ship Anchoring inside cable zone,G,567998811,I,SEA DRAGON 08,K,Fishing Boat,9.4290,99.9675,"Speed: 1.1 kts. Stationary drift near joint box"
EVT-11,2026-09-06,11:40:00,D,On enter,Ship Enter Cable Zone,G,567667788,I,PACIFIC DISCOVERY,K,Chemical Tanker,9.3980,99.9320,"Speed: 9.8 kts. Southbound channel entry"
EVT-12,2026-09-06,11:56:00,D,On exit,Ship Exit Cable Zone,G,567667788,I,PACIFIC DISCOVERY,K,Chemical Tanker,9.3750,99.9150,"Speed: 9.7 kts. Clear of 500m zone"
EVT-13,2026-09-06,09:10:00,D,In zone,Ship Anchoring inside cable zone,G,567778899,I,THAI SALVAGE TUG 1,K,Tugboat,9.3390,99.8790,"Speed: 0.8 kts. Offshore tethering position"
EVT-14,2026-09-05,22:30:00,D,On enter,Ship Enter Cable Zone,G,567223344,I,KRISTEN MAERSK,K,Container Ship,9.4180,99.9520,"Speed: 14.6 kts. High-speed transit"
EVT-15,2026-09-06,06:50:00,D,On enter,Ship Enter Cable Zone,G,567889900,I,EASTERN GLORY,K,General Cargo,9.4420,99.9820,"Speed: 10.2 kts. Transiting eastern passage"
EVT-16,2026-09-06,07:05:00,D,On exit,Ship Exit Cable Zone,G,567889900,I,EASTERN GLORY,K,General Cargo,9.4580,100.0020,"Speed: 10.0 kts. Exit zone acknowledged"`;

export const SAMPLE_HISTORICAL_CSV = `date,ship_type,vessel_count,avg_speed,dwell_minutes,total_tonnage,alert_count
2026-09-01,Fishing Trawlers,42,4.2,48,7800,8
2026-09-01,Cargo Vessels,28,11.8,14,284000,1
2026-09-01,Crude Tankers,14,10.2,18,195000,0
2026-09-01,Passenger Ferries,36,16.5,8,26000,0
2026-09-02,Fishing Trawlers,51,3.8,56,9400,11
2026-09-02,Cargo Vessels,31,12.1,13,310000,0
2026-09-02,Crude Tankers,12,9.9,19,162000,0
2026-09-02,Passenger Ferries,38,17.0,8,27400,0`;
