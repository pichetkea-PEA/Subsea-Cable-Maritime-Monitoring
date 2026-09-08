export interface UserProfile {
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'analyst';
  avatarUrl?: string;
  department?: string;
}

export interface CableWaypoint {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  depthMeters?: number;
  sequence: number;
}

export interface CableRoute {
  id: string;
  name: string;
  mainlandStation: string;
  islandStation: string;
  totalLengthKm: number;
  protectionCorridorMeters: number; // 500m left/right (1000m total)
  status: 'Operational' | 'Under Observation' | 'Threat Alert' | 'Maintenance';
  updatedAt: string;
  isDefault: boolean;
  waypoints: CableWaypoint[];
}

export type EventType = 'Alarm' | 'Alert';
export type EventDetailType = 'Ship Enter' | 'Ship Exit' | 'Ship Anchoring';
export type PriorityLevel = 'Critical' | 'High' | 'Moderate' | 'Low';
export type EventStatus = 'Active' | 'Investigating' | 'Resolved' | 'False Positive';

export interface AlarmEvent {
  id: string;
  timestamp: string;
  mmsi: string;
  vesselName: string;
  shipType: string;
  eventType: EventType; // Alarm = entering/exit zone; Alert = anchoring inside 500m zone
  eventDetail: EventDetailType | string; // Specific detail: Ship Enter, Ship Exit, or Ship Anchoring
  entryLat: number;
  entryLon: number;
  exitLat?: number;
  exitLon?: number;
  currentLat: number;
  currentLon: number;
  speedKnots: number;
  headingDegrees?: number;
  grossTonnage: number;
  priority: PriorityLevel;
  durationMinutes: number;
  distanceToCableMeters: number;
  info: string; // Base station sent message
  status: EventStatus;
  photoUrl?: string;
  callSign?: string;
  flagCountry?: string;
}

export interface HistoricalShipSummary {
  id: string;
  date: string;
  shipType: string;
  vesselCount: number;
  avgSpeedKnots: number;
  avgDwellMinutes: number;
  totalGrossTonnage: number;
  alertCount: number;
}

export interface ParkingZoneCoordinate {
  lat: number;
  lng: number;
  label?: string;
}

export interface ParkingZone {
  id: string;
  name: string;
  description: string;
  targetVesselType: string;
  coordinates: ParkingZoneCoordinate[];
  isActive: boolean;
  color?: string;
  updatedAt?: string;
}

export interface AIShipTrace {
  mmsi: string;
  vesselName: string;
  shipType: string;
  entryTime: string;
  exitTime?: string;
  entryCoord: [number, number]; // [lat, lng]
  exitCoord?: [number, number];  // [lat, lng]
  currentCoord: [number, number];
  points: [number, number][];
  grossTonnage: number;
  priority: PriorityLevel;
  speedKnots: number;
  photoUrl?: string;
  hasAnchored: boolean;
}

export interface AIAnalysisResult {
  executiveBrief: string;
  threatLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  totalAnalyzed: number;
  anchoringIncidents?: number;
  boundaryCrossings?: number;
  keyThreats: string[];
  recommendations: string[];
  topRiskVessels: {
    mmsi: string;
    vesselName: string;
    type: string;
    risk: string;
  }[];
}
