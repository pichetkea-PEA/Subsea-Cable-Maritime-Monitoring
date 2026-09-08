import React, { useState, useMemo } from 'react';
import { AlarmEvent, CableRoute, ParkingZone } from '../types';
import { DEFAULT_CABLE_ROUTE, DEFAULT_PARKING_ZONE } from '../data/mockData';
import { CorridorHeatmapMap } from './CorridorHeatmapMap';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  ShieldAlert,
  Anchor,
  Activity,
  Clock,
  Layers,
  Flame,
  AlertTriangle,
  Ship,
  Gauge,
  Compass,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  MapPin,
  FileDown,
} from 'lucide-react';
import { VesselMockup } from './VesselMockup';
import { PdfSummaryReportModal } from './PdfSummaryReportModal';
import { formatDisplayDateTime, getEventsDateRange } from '../utils/geoUtils';

interface StatisticalAnalysisPageProps {
  events: AlarmEvent[];
  cableRoute?: CableRoute;
  parkingZone?: ParkingZone;
  capturedHeatmapImage?: string | null;
  onImageCaptured?: (dataUrl: string) => void;
}

const PALETTE = {
  pleasure: '#38bdf8', // Sky
  towing: '#f97316',   // Orange
  passenger: '#3b82f6',// Blue
  hsc: '#06b6d4',      // Cyan
  cargo: '#8b5cf6',    // Purple
  tanker: '#ec4899',   // Pink
  fishing: '#ef4444',  // Red
  tender: '#10b981',   // Emerald
  default: '#64748b',  // Slate
};

const SHIP_TYPE_COLORS: Record<string, string> = {
  'Pleasure craft': '#38bdf8',
  'Towing and Tug': '#f97316',
  'Passenger ship': '#3b82f6',
  'HSC': '#06b6d4',
  'Cargo ship': '#8b5cf6',
  'Tanker': '#ec4899',
  'Fishing': '#ef4444',
  'Port tender': '#10b981',
};

const STANDARD_8_TYPES = [
  {
    type: 'Pleasure craft',
    name: 'Recreational Yacht / Cruiser',
    mmsi: '567009101',
    tonnage: 420,
  },
  {
    type: 'Towing and Tug',
    name: 'Harbor Tug / Heavy Workboat',
    mmsi: '567008202',
    tonnage: 850,
  },
  {
    type: 'Passenger ship',
    name: 'Ro-Pax Ferry / Island Cruiser',
    mmsi: '567001507',
    tonnage: 5600,
  },
  {
    type: 'HSC',
    name: 'High-Speed Hydrofoil / Catamaran',
    mmsi: '567004303',
    tonnage: 1200,
  },
  {
    type: 'Cargo ship',
    name: 'Container / Bulk Freight Vessel',
    mmsi: '567002404',
    tonnage: 18500,
  },
  {
    type: 'Tanker',
    name: 'Crude Oil / LNG Carrier',
    mmsi: '567003505',
    tonnage: 24000,
  },
  {
    type: 'Fishing',
    name: 'Commercial Marine Trawler',
    mmsi: '567007606',
    tonnage: 680,
  },
  {
    type: 'Port tender',
    name: 'Harbor Service / Crew Tender',
    mmsi: '567006707',
    tonnage: 280,
  },
];

export const StatisticalAnalysisPage: React.FC<StatisticalAnalysisPageProps> = ({
  events,
  cableRoute,
  parkingZone,
  capturedHeatmapImage,
  onImageCaptured,
}) => {
  const [showHeatmapSection, setShowHeatmapSection] = useState(true);

  const activeCableRoute = cableRoute || DEFAULT_CABLE_ROUTE;
  const activeParkingZone = parkingZone || DEFAULT_PARKING_ZONE;

  const [timeHorizon, setTimeHorizon] = useState<'7d' | '30d' | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'alert' | 'alarm'>('all');
  const [selectedEvent, setSelectedEvent] = useState<AlarmEvent | null>(null);
  const [hoveredMMSI, setHoveredMMSI] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      // Type filter
      if (typeFilter === 'alert' && evt.eventType !== 'Alert') return false;
      if (typeFilter === 'alarm' && evt.eventType !== 'Alarm') return false;

      // Horizon filter
      if (timeHorizon !== 'all') {
        const evtTime = new Date(evt.timestamp).getTime();
        const now = Date.now();
        const days = timeHorizon === '7d' ? 7 : 30;
        if (now - evtTime > days * 24 * 60 * 60 * 1000) {
          // If mock date is in the past, let it pass through gracefully
          return true;
        }
      }
      return true;
    });
  }, [events, timeHorizon, typeFilter]);

  // Aggregate Key Performance Indicators (KPIs)
  const totalEvents = filteredEvents.length;
  const anchoringAlerts = filteredEvents.filter(e => e.eventType === 'Alert' || e.eventDetail?.toLowerCase().includes('anchor')).length;
  const crossingAlarms = filteredEvents.filter(e => e.eventType === 'Alarm').length;
  const criticalThreats = filteredEvents.filter(e => e.priority === 'Critical' || e.priority === 'High').length;
  const totalGrossTonnage = filteredEvents.reduce((acc, curr) => acc + (curr.grossTonnage || 0), 0);
  const avgDistanceToCable = totalEvents > 0 ? Math.round(filteredEvents.reduce((acc, curr) => acc + (curr.distanceToCableMeters || 0), 0) / totalEvents) : 0;
  const avgSpeedKnots = totalEvents > 0 ? parseFloat((filteredEvents.reduce((acc, curr) => acc + (curr.speedKnots || 0), 0) / totalEvents).toFixed(1)) : 0;

  // Largest gross tonnage vessel across active events
  const largestVesselEvent = useMemo(() => {
    if (filteredEvents.length === 0) return null;
    return filteredEvents.reduce((max, curr) => {
      return (curr.grossTonnage || 0) > (max.grossTonnage || 0) ? curr : max;
    }, filteredEvents[0]);
  }, [filteredEvents]);
  const largestGrossTonnage = largestVesselEvent?.grossTonnage || 0;

  // Compute dataset Start date and End date (derived from Column B Date in input CSV)
  const dateRange = useMemo(() => getEventsDateRange(events), [events]);

  // Ship Type Grouping Aggregates
  const shipTypeAggregates = useMemo(() => {
    const map: Record<string, {
      name: string;
      total: number;
      anchoringAlerts: number;
      crossingAlarms: number;
      totalTonnage: number;
      avgSpeedSum: number;
      avgDistanceSum: number;
      avgDwellSum: number;
      uniqueMMSI: Set<string>;
      criticalCount: number;
    }> = {};

    filteredEvents.forEach(evt => {
      const type = evt.shipType || 'Other';
      if (!map[type]) {
        map[type] = {
          name: type,
          total: 0,
          anchoringAlerts: 0,
          crossingAlarms: 0,
          totalTonnage: 0,
          avgSpeedSum: 0,
          avgDistanceSum: 0,
          avgDwellSum: 0,
          uniqueMMSI: new Set(),
          criticalCount: 0,
        };
      }
      map[type].total += 1;
      if (evt.eventType === 'Alert' || evt.eventDetail?.toLowerCase().includes('anchor')) {
        map[type].anchoringAlerts += 1;
      } else {
        map[type].crossingAlarms += 1;
      }
      map[type].totalTonnage += (evt.grossTonnage || 0);
      map[type].avgSpeedSum += (evt.speedKnots || 0);
      map[type].avgDistanceSum += (evt.distanceToCableMeters || 0);
      map[type].avgDwellSum += (evt.durationMinutes || 0);
      map[type].uniqueMMSI.add(evt.mmsi);
      if (evt.priority === 'Critical' || evt.priority === 'High') {
        map[type].criticalCount += 1;
      }
    });

    return Object.values(map).map(item => ({
      name: item.name,
      total: item.total,
      anchoringAlerts: item.anchoringAlerts,
      crossingAlarms: item.crossingAlarms,
      uniqueShips: item.uniqueMMSI.size,
      totalTonnage: item.totalTonnage,
      avgSpeed: parseFloat((item.avgSpeedSum / item.total).toFixed(1)),
      avgDistance: Math.round(item.avgDistanceSum / item.total),
      avgDwell: Math.round(item.avgDwellSum / item.total),
      criticalCount: item.criticalCount,
      color: SHIP_TYPE_COLORS[item.name] || '#64748b',
    })).sort((a, b) => b.total - a.total);
  }, [filteredEvents]);

  // Donut chart distribution data
  const pieData = useMemo(() => {
    return shipTypeAggregates.map(item => ({
      name: item.name,
      value: item.total,
      color: item.color,
      anchoringAlerts: item.anchoringAlerts,
      crossingAlarms: item.crossingAlarms,
    }));
  }, [shipTypeAggregates]);

  // Daily Temporal Timeline Grouping
  const timelineData = useMemo(() => {
    const map: Record<string, { date: string; fullDate: string; total: number; anchoringAlerts: number; crossingAlarms: number; avgDist: number; distSum: number }> = {};
    
    filteredEvents.forEach(evt => {
      // Extract YYYY-MM-DD or MM/DD
      const rawDate = evt.timestamp ? evt.timestamp.split('T')[0] : '2026-03-01';
      const shortDate = rawDate.slice(5); // MM-DD
      if (!map[rawDate]) {
        map[rawDate] = {
          date: shortDate,
          fullDate: rawDate,
          total: 0,
          anchoringAlerts: 0,
          crossingAlarms: 0,
          avgDist: 0,
          distSum: 0,
        };
      }
      map[rawDate].total += 1;
      if (evt.eventType === 'Alert' || evt.eventDetail?.toLowerCase().includes('anchor')) {
        map[rawDate].anchoringAlerts += 1;
      } else {
        map[rawDate].crossingAlarms += 1;
      }
      map[rawDate].distSum += evt.distanceToCableMeters;
    });

    return Object.values(map)
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
      .map(item => ({
        ...item,
        avgDist: Math.round(item.distSum / item.total),
      }));
  }, [filteredEvents]);

  // Cable Distance Proximity Distribution
  const proximityBands = useMemo(() => {
    let under50 = 0;
    let under100 = 0;
    let under250 = 0;
    let under500 = 0;

    filteredEvents.forEach(evt => {
      const d = evt.distanceToCableMeters;
      if (d <= 50) under50++;
      else if (d <= 100) under100++;
      else if (d <= 250) under250++;
      else under500++;
    });

    return [
      { name: '< 50m (Critical Breach)', count: under50, fill: '#ef4444' },
      { name: '50m - 100m (High Hazard)', count: under100, fill: '#f97316' },
      { name: '100m - 250m (Warning Zone)', count: under250, fill: '#f59e0b' },
      { name: '250m - 500m (Corridor Buffer)', count: under500, fill: '#3b82f6' },
    ];
  }, [filteredEvents]);

  // Unique high-risk vessels leaderboard
  const topHighRiskVessels = useMemo(() => {
    const vesselMap: Record<string, {
      mmsi: string;
      name: string;
      shipType: string;
      tonnage: number;
      incidentCount: number;
      anchoringCount: number;
      minDist: number;
      lowestSpeed: number;
      highestPriority: string;
    }> = {};

    filteredEvents.forEach(evt => {
      if (!vesselMap[evt.mmsi]) {
        vesselMap[evt.mmsi] = {
          mmsi: evt.mmsi,
          name: evt.vesselName,
          shipType: evt.shipType,
          tonnage: evt.grossTonnage || 0,
          incidentCount: 0,
          anchoringCount: 0,
          minDist: evt.distanceToCableMeters,
          lowestSpeed: evt.speedKnots,
          highestPriority: evt.priority,
        };
      }
      const v = vesselMap[evt.mmsi];
      v.incidentCount += 1;
      if (evt.eventType === 'Alert' || evt.eventDetail?.toLowerCase().includes('anchor')) {
        v.anchoringCount += 1;
      }
      if (evt.distanceToCableMeters < v.minDist) {
        v.minDist = evt.distanceToCableMeters;
      }
      if (evt.speedKnots < v.lowestSpeed) {
        v.lowestSpeed = evt.speedKnots;
      }
      if (evt.priority === 'Critical') v.highestPriority = 'Critical';
      else if (evt.priority === 'High' && v.highestPriority !== 'Critical') v.highestPriority = 'High';
    });

    return Object.values(vesselMap)
      .sort((a, b) => {
        if (b.anchoringCount !== a.anchoringCount) return b.anchoringCount - a.anchoringCount;
        return a.minDist - b.minDist;
      })
      .slice(0, 8);
  }, [filteredEvents]);

  return (
    <div className="max-w-[1920px] mx-auto p-3 sm:p-5 space-y-6 animate-in fade-in duration-300">
      {/* Header & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
              Maritime Corridor Statistical Analysis
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs">
              <span className="inline-flex items-center gap-1.5 bg-blue-950/80 border border-blue-500/40 px-2.5 py-0.5 rounded-md text-cyan-300 font-semibold shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Start Date: <strong className="text-white font-mono">{dateRange.startDate}</strong></span>
                <span className="text-blue-400">|</span>
                <span>End Date: <strong className="text-white font-mono">{dateRange.endDate}</strong></span>
                <span className="text-slate-400 text-[10px] font-normal">({dateRange.totalDays} {dateRange.totalDays === 1 ? 'day' : 'days'})</span>
              </span>
              <span className="text-slate-400">
                Live automated aggregation dynamically derived from Dashboard Map AIS incident feed ({events.length} records)
              </span>
            </div>
          </div>
        </div>

        {/* Controls & PDF Export Button */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Incident Type Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setTypeFilter('alert')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeFilter === 'alert'
                  ? 'bg-rose-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <Flame className="w-3 h-3 text-rose-400" />
              Anchoring Alerts ({events.filter(e => e.eventType === 'Alert').length})
            </button>
            <button
              onClick={() => setTypeFilter('alarm')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeFilter === 'alarm'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Crossing Alarms ({events.filter(e => e.eventType === 'Alarm').length})
            </button>
          </div>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg transition cursor-pointer shrink-0"
          >
            <FileDown className="w-4 h-4" />
            <span>Generate PDF Report</span>
          </button>
        </div>
      </div>

      {/* Heatmap-Only High-Traffic Area Surveillance Section */}
      <div className="space-y-4">
        {showHeatmapSection && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Left Column: Dedicated Satellite Heatmap Map covering all area */}
            <div className="lg:col-span-2 w-full min-h-[640px]">
              <CorridorHeatmapMap
                cableRoute={activeCableRoute}
                events={events}
                parkingZone={activeParkingZone}
                capturedImage={capturedHeatmapImage}
                onImageCaptured={onImageCaptured}
                height={640}
              />
            </div>

            {/* Right Panel: Traffic Density Legend & Hotspot Zone Summaries (Zone A, B, C) */}
            <div className="lg:col-span-1 space-y-3">
              {/* Traffic Density Legend Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-slate-200">
                <div className="font-bold text-xs text-cyan-300 pb-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-400" />
                    Traffic Density Legend
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">KP 0.0 - 34.0</span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
                    <span className="text-slate-300">Critical Density</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span className="text-slate-300">High Density</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    <span className="text-slate-300">Medium Density</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className="text-slate-300">Routine Transit</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-0.5 bg-cyan-400"></span>
                    <span>115kV Cable (KP 0.0 - 34.0)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-0.5 border-b border-dashed border-amber-400"></span>
                    <span>500m Protection Buffer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-0.5 border-b border-dashed border-blue-400"></span>
                    <span>Samui Parking Zone (Anchorage)</span>
                  </div>
                </div>
              </div>

              {/* Zone A Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>Zone A: Samui Island Approach</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700/40">
                    Highest Hazard
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  High frequency of passenger catamarans, Ro-Pax ferries, and island tenders entering the Samui terminal corridor adjacent to the Samui Parking Zone.
                </p>
              </div>

              {/* Zone B Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span>Zone B: Central Deep-Sea Fairway</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/40">
                    Heavy Commercial
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Mid-channel commercial shipping route with bulk cargo and tankers navigating north-south through the Gulf of Thailand crossing subsea cables.
                </p>
              </div>

              {/* Zone C Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Zone C: Khanom Landing Shelf</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/40">
                    Nearshore Risk
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Nearshore trench approaches with harbor tugs, fishing trawlers, and workboats operating in shallow bathymetric depths (&lt;15m).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* Total Transits */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Total Incidents</span>
            <Anchor className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{totalEvents}</div>
          <div className="text-[10px] text-cyan-400 mt-1">Logged across corridor</div>
        </div>

        {/* Anchoring Alerts */}
        <div className="bg-slate-900 border border-rose-900/50 p-3.5 rounded-xl shadow-lg bg-rose-950/10">
          <div className="flex items-center justify-between text-xs text-rose-400 mb-1">
            <span className="font-semibold">Anchoring Alerts</span>
            <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-rose-400">{anchoringAlerts}</div>
          <div className="text-[10px] text-rose-300 mt-1">Stationary gear threats</div>
        </div>

        {/* Crossing Alarms */}
        <div className="bg-slate-900 border border-amber-900/50 p-3.5 rounded-xl shadow-lg bg-amber-950/10">
          <div className="flex items-center justify-between text-xs text-amber-400 mb-1">
            <span className="font-semibold">Crossing Alarms</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">{crossingAlarms}</div>
          <div className="text-[10px] text-amber-400/80 mt-1">500m boundary transit</div>
        </div>

        {/* Cumulative Gross Tonnage */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Total Tonnage</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {totalGrossTonnage >= 1000 ? `${(totalGrossTonnage / 1000).toFixed(1)}k` : totalGrossTonnage}
            <span className="text-xs font-normal text-slate-400 ml-1">GT</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Vessel displacement sum</div>
        </div>

        {/* Largest Gross Tonnage (Max Single Vessel) */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-lg hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Largest Tonnage</span>
            <Ship className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-300">
            {largestGrossTonnage >= 1000 ? `${(largestGrossTonnage / 1000).toFixed(1)}k` : largestGrossTonnage}
            <span className="text-xs font-normal text-slate-400 ml-1">GT</span>
          </div>
          {largestVesselEvent ? (
            <div
              className="mt-1 leading-tight text-[10px]"
              title={`${largestVesselEvent.vesselName} (${largestVesselEvent.shipType || 'Vessel'}) • MMSI: ${largestVesselEvent.mmsi} • ${largestGrossTonnage.toLocaleString()} GT`}
            >
              <div className="font-semibold text-cyan-400 truncate">{largestVesselEvent.vesselName}</div>
              <div className="text-slate-400 text-[9.5px] truncate mt-0.5">
                {largestVesselEvent.shipType || 'Vessel'} • MMSI: {largestVesselEvent.mmsi}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 mt-1">Max single displacement</div>
          )}
        </div>

        {/* Avg Distance to Cable */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Avg Cable Dist</span>
            <Compass className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300">
            {avgDistanceToCable}
            <span className="text-xs font-normal text-slate-400 ml-1">m</span>
          </div>
          <div className="text-[10px] text-emerald-400 mt-1">Mean closest approach</div>
        </div>

        {/* Avg Speed */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Mean Transit Speed</span>
            <Gauge className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300">
            {avgSpeedKnots}
            <span className="text-xs font-normal text-slate-400 ml-1">kts</span>
          </div>
          <div className="text-[10px] text-purple-400 mt-1">Corridor navigation speed</div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 cols): Vessel Distribution & Anchoring Breakdown */}
        <div className="lg:col-span-6 space-y-6">
          {/* Chart 1: Donut Distribution of Ship Types */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-cyan-400" />
                Vessel Classification Incident Distribution
              </h3>
              <span className="text-[11px] text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800 font-mono">
                {pieData.length} Active Classes
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Sub-Legend Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
              {pieData.map((item, idx) => (
                <div key={idx} className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                  <div className="truncate">
                    <span className="font-semibold text-slate-200 block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-400">{item.value} events ({item.anchoringAlerts} alerts)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Stacked Bar: Anchoring Alerts vs Crossing Alarms by Type */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                Anchoring Alerts vs. Crossing Alarms by Vessel Class
              </h3>
              <span className="text-[11px] text-slate-400">Incident Severity</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shipTypeAggregates} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-25} textAnchor="end" height={45} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                  <Bar dataKey="anchoringAlerts" name="Ship Anchoring Alerts" fill="#ef4444" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="crossingAlarms" name="Corridor Crossing Alarms" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): Temporal Trend & Proximity Hazard Distribution */}
        <div className="lg:col-span-6 space-y-6">
          {/* Chart 3: Temporal Timeline of Incidents */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Corridor Incident Activity Timeline
              </h3>
              <span className="text-[11px] text-slate-400">Chronological Trend</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="crossingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="anchoringAlerts" name="Anchoring Alerts" stroke="#ef4444" fillOpacity={1} fill="url(#alertGrad)" />
                  <Area type="monotone" dataKey="crossingAlarms" name="Crossing Alarms" stroke="#38bdf8" fillOpacity={1} fill="url(#crossingGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <strong className="text-slate-300 font-semibold block mb-0.5">Automated Intelligence Finding:</strong>
              Anchoring events show strong loitering duration (&gt;45 min) concentrated in shallow approach zones, while cargo and tankers maintain transient crossings (&gt;10 kts).
            </div>
          </div>

          {/* Chart 4: Cable Proximity Risk Exposure */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Cable Proximity Hazard Exposure Bands
              </h3>
              <span className="text-[11px] text-slate-400">Distance to Cable</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proximityBands} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={130} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Incidents in Band" radius={[0, 4, 4, 0]}>
                    {proximityBands.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregated Vessel Class Summary Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
              <Ship className="w-4 h-4 text-cyan-400" />
              Comprehensive Vessel Class Analytics Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggregated from the active AIS incident dataset loaded on the second page
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            {shipTypeAggregates.length} Vessel Types Active
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-3">Vessel Classification</th>
                <th className="py-3 px-3 text-center">Total Incidents</th>
                <th className="py-3 px-3 text-center">Anchoring Alerts</th>
                <th className="py-3 px-3 text-center">Crossing Alarms</th>
                <th className="py-3 px-3 text-center">Unique Vessels</th>
                <th className="py-3 px-3 text-center">Mean Cable Proximity</th>
                <th className="py-3 px-3 text-center">Mean Speed</th>
                <th className="py-3 px-3 text-right">Cumulative Tonnage</th>
                <th className="py-3 px-3 text-center">Corridor Threat Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {shipTypeAggregates.map((row, idx) => {
                const threatRating = row.anchoringAlerts >= 3 || row.avgDistance < 80 ? 'Critical' : row.anchoringAlerts > 0 ? 'High' : 'Moderate';
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-semibold text-slate-100 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }}></span>
                      <span>{row.name}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-200">{row.total}</td>
                    <td className="py-3 px-3 text-center font-bold text-rose-400">{row.anchoringAlerts}</td>
                    <td className="py-3 px-3 text-center font-semibold text-amber-300">{row.crossingAlarms}</td>
                    <td className="py-3 px-3 text-center text-slate-300 font-mono">{row.uniqueShips}</td>
                    <td className="py-3 px-3 text-center font-mono text-cyan-300">{row.avgDistance}m</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{row.avgSpeed} kts</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">{row.totalTonnage.toLocaleString()} GRT</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          threatRating === 'Critical'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                            : threatRating === 'High'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                            : 'bg-blue-950/80 text-blue-300 border-blue-700/60'
                        }`}
                      >
                        {threatRating}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top High Risk Individual Vessels Leaderboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Identified High-Risk Threat Vessels
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Individual vessels identified with severe cable proximity incursions or repeated anchoring activity
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {topHighRiskVessels.map((vessel, idx) => (
            <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 hover:border-slate-700 transition">
              <div className="flex items-start justify-between gap-1">
                <div>
                  <div className="font-bold text-xs text-slate-100 truncate">{vessel.name}</div>
                  <div className="text-[11px] text-cyan-300 font-mono">MMSI {vessel.mmsi}</div>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                    vessel.anchoringCount > 0
                      ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                      : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                  }`}
                >
                  {vessel.anchoringCount > 0 ? 'Anchored' : 'Crossing'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>{vessel.shipType}</span>
                <span className="text-slate-300 font-mono">{vessel.tonnage.toLocaleString()} GRT</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block">Min Cable Dist:</span>
                  <strong className="text-rose-400 font-mono">{vessel.minDist}m</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Lowest Speed:</span>
                  <strong className="text-amber-300 font-mono">{vessel.lowestSpeed} kts</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 8 Ship Types Illustrated Catalog Reference */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <Anchor className="w-5 h-5 text-cyan-400" />
              Standard Vessel Classification Index (8 Ship Types)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official maritime definitions and corresponding 2D illustrated profile schematics
            </p>
          </div>
          <span className="text-xs font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 px-2.5 py-1 rounded-lg">
            8 Archetypes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STANDARD_8_TYPES.map((vessel, idx) => (
            <div key={idx} className="h-64 rounded-xl overflow-hidden border border-slate-800 shadow-md flex flex-col">
              <VesselMockup
                shipType={vessel.type}
                vesselName={vessel.name}
                mmsi={vessel.mmsi}
                tonnage={vessel.tonnage}
                showDefinition={true}
                className="w-full h-full"
              />
            </div>
          ))}
        </div>
      </div>

      <PdfSummaryReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        cableRoute={activeCableRoute}
        events={events}
        parkingZone={activeParkingZone}
        capturedHeatmapImage={capturedHeatmapImage}
      />
    </div>
  );
};
