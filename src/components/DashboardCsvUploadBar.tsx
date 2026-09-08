import React, { useState, useMemo } from 'react';
import { AlarmEvent, HistoricalShipSummary, CableRoute } from '../types';
import { parseAlarmEventsCSV, parseHistoricalShipCSV, getEventsDateRange } from '../utils/geoUtils';
import { SAMPLE_ALARMS_CSV, SAMPLE_HISTORICAL_CSV } from '../data/mockData';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Ship,
  CheckCircle2,
  Download,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Calendar,
} from 'lucide-react';

interface DashboardCsvUploadBarProps {
  cableRoute: CableRoute;
  events?: AlarmEvent[];
  eventsCount: number;
  historicalCount: number;
  onUpdateAlarmEvents: (events: AlarmEvent[]) => void;
  onUpdateHistoricalData: (data: HistoricalShipSummary[]) => void;
  onOpenDataModal: () => void;
}

export const DashboardCsvUploadBar: React.FC<DashboardCsvUploadBarProps> = ({
  cableRoute,
  events = [],
  eventsCount,
  historicalCount,
  onUpdateAlarmEvents,
  onUpdateHistoricalData,
  onOpenDataModal,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);

  // Compute start date and end date from active events (Column B date)
  const dateRange = useMemo(() => getEventsDateRange(events), [events]);

  // Template Downloader
  const downloadTemplate = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAlarmCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseAlarmEventsCSV(text, cableRoute.waypoints);
        if (parsed.length === 0) throw new Error('No alarm records parsed');
        onUpdateAlarmEvents(parsed);
        setLastActionStatus(`Successfully updated: ${parsed.length} Alarm/Alert events loaded from ${file.name}`);
        setTimeout(() => setLastActionStatus(null), 6000);
      } catch (err: any) {
        setLastActionStatus(`Upload error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleHistoricalCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseHistoricalShipCSV(text);
        if (parsed.length === 0) throw new Error('No historical records parsed');
        onUpdateHistoricalData(parsed);
        setLastActionStatus(`Successfully updated: ${parsed.length} Historical vessel categories loaded from ${file.name}`);
        setTimeout(() => setLastActionStatus(null), 6000);
      } catch (err: any) {
        setLastActionStatus(`Upload error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 shadow-md backdrop-blur-sm transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Section Title & Active Counts */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/40 flex items-center justify-center text-cyan-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                Dashboard CSV Data Management
              </span>
              <span className="inline-flex items-center gap-1.5 bg-blue-950/80 text-cyan-300 border border-blue-500/40 px-2.5 py-0.5 rounded-md text-[11px] font-medium shadow-xs">
                <Calendar className="w-3 h-3 text-cyan-400" />
                <span>Start Date: <strong className="text-white font-mono">{dateRange.startDate}</strong></span>
                <span className="text-blue-400">|</span>
                <span>End Date: <strong className="text-white font-mono">{dateRange.endDate}</strong></span>
                <span className="text-slate-400 text-[10px] font-normal">({dateRange.totalDays}d)</span>
              </span>
              <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700">
                Live Ingest
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Alarms Loaded: <strong className="text-rose-400">{eventsCount}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Ship Types Loaded: <strong className="text-purple-400">{historicalCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Center/Right: Quick Upload Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload 1: Alarm Event CSV */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 text-xs font-semibold border border-rose-700/60 cursor-pointer shadow-sm transition">
            <UploadCloud className="w-3.5 h-3.5 text-rose-400" />
            <span>Upload Alarm Events CSV</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleAlarmCSV(f);
              }}
            />
          </label>

          {/* Upload 2: Ship Type Summary CSV */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 text-xs font-semibold border border-purple-700/60 cursor-pointer shadow-sm transition">
            <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
            <span>Upload Ship Type Summary CSV</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleHistoricalCSV(f);
              }}
            />
          </label>

          {/* Quick Toggle Details / Templates */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer transition"
            title="Toggle CSV format details and templates"
          >
            <span className="hidden sm:inline">Templates</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {lastActionStatus && (
        <div className="mt-2.5 p-2 rounded-lg bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{lastActionStatus}</span>
          </div>
          <button
            onClick={() => setLastActionStatus(null)}
            className="text-[10px] text-emerald-400 hover:text-emerald-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expanded Template & Format Assistance */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs animate-in fade-in duration-200">
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Alarm Event Summary CSV Spec
              </span>
              <button
                onClick={() => downloadTemplate(SAMPLE_ALARMS_CSV, 'alarm_events_template.csv')}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Download Template
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Columns: <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">Timestamp, MMSI, VesselName, ShipType, SpeedKnots, Latitude, Longitude, Heading, Info</code>
            </p>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-300 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5" />
                Historical Ship Type Summary CSV Spec
              </span>
              <button
                onClick={() => downloadTemplate(SAMPLE_HISTORICAL_CSV, 'historical_ship_summary_template.csv')}
                className="text-[11px] text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Download Template
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Columns: <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">ShipType, TotalVessels, CrossingsCount, AnchoringEvents, AvgDwellMinutes, AvgSpeedKnots, RiskScore</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
