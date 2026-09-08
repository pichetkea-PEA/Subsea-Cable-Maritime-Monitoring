import React, { useState } from 'react';
import { CableRoute, AlarmEvent } from '../types';
import { parseCableRouteFile, parseAlarmEventsCSV } from '../utils/geoUtils';
import { importCableRouteFromGoogleSheet, importAlarmEventsFromGoogleSheet } from '../utils/googleSheetsUtils';
import { SAMPLE_CABLE_CSV, SAMPLE_ALARMS_CSV } from '../data/mockData';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Database,
  Anchor,
  Table,
  Link,
  Loader2,
} from 'lucide-react';

interface CableSetupFirstPageProps {
  currentRoute: CableRoute;
  savedRoutes: CableRoute[];
  events: AlarmEvent[];
  onConfirmAndProceed: (route: CableRoute, events?: AlarmEvent[]) => void;
  onUpdateCableRoute: (route: CableRoute) => void;
  onUpdateAlarmEvents: (events: AlarmEvent[]) => void;
}

export const CableSetupFirstPage: React.FC<CableSetupFirstPageProps> = ({
  currentRoute,
  savedRoutes,
  events,
  onConfirmAndProceed,
  onUpdateCableRoute,
  onUpdateAlarmEvents,
}) => {
  // Cable Route Form state
  const [routeName, setRouteName] = useState('115 kV Koh Samui circuit 3');
  const [cableCoordsText, setCableCoordsText] = useState('');
  const [parsedRoute, setParsedRoute] = useState<CableRoute>(currentRoute);
  const [cableError, setCableError] = useState<string | null>(null);
  const [cableSuccess, setCableSuccess] = useState<string | null>(null);

  // Companion CSV state
  const [alarmsParsedCount, setAlarmsParsedCount] = useState<number>(events.length);
  const [alarmsStatus, setAlarmsStatus] = useState<string | null>(null);

  // Google Sheets Import Modal State
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [sheetImportType, setSheetImportType] = useState<'route' | 'alarms'>('route');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTabName, setSheetTabName] = useState('Sheet1');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Load default preset "115 kV Koh Samui circuit 3" on mount automatically
  React.useEffect(() => {
    const loadDefaultPreset = async () => {
      try {
        const res = await fetch('/Lat long of circuit 3.txt');
        if (res.ok) {
          const text = await res.text();
          const defaultName = '115 kV Koh Samui circuit 3';
          setRouteName(defaultName);
          setCableCoordsText(text);
          const parsed = parseCableRouteFile(text, defaultName);
          parsed.id = 'circuit-3-samui';
          parsed.isDefault = true;
          setParsedRoute(parsed);
          setCableSuccess(`Default Preset Loaded: ${parsed.waypoints.length} waypoints (${parsed.totalLengthKm} km)`);
          onUpdateCableRoute(parsed);
        }
      } catch (err) {
        console.warn('Auto-load circuit 3 failed:', err);
      }
    };

    if (!currentRoute || currentRoute.waypoints.length < 2500 || currentRoute.name === '115 kV Koh Samui circuit 3' || currentRoute.name.includes('Circuit #2')) {
      loadDefaultPreset();
    } else {
      setRouteName(currentRoute.name);
      setCableCoordsText(currentRoute.waypoints.map(w => `${w.lat}, ${w.lng}`).join('\n'));
    }
  }, []);

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

  // Re-parse cable route on change
  const handleParseCableInput = (text: string, name: string) => {
    try {
      setCableError(null);
      if (!text.trim()) {
        throw new Error('Please enter GPS coordinates (Latitude, Longitude).');
      }
      const parsed = parseCableRouteFile(text, name.trim() || 'Subsea Cable Circuit');
      setParsedRoute(parsed);
      setCableSuccess(`Valid circuit: ${parsed.waypoints.length} waypoints (${parsed.totalLengthKm} km)`);
      return parsed;
    } catch (err: any) {
      setCableError(err.message || 'Invalid coordinates format');
      setCableSuccess(null);
      return null;
    }
  };

  // Handle Cable file upload
  const handleCableFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setCableCoordsText(text);
      handleParseCableInput(text, routeName);
    };
    reader.readAsText(file);
  };

  // Handle Alarm CSV Upload
  const handleAlarmCSVUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseAlarmEventsCSV(text, parsedRoute.waypoints);
        if (parsed.length === 0) throw new Error('No alarm rows found in CSV');
        onUpdateAlarmEvents(parsed);
        setAlarmsParsedCount(parsed.length);
        setAlarmsStatus(`Imported ${parsed.length} alarm & alert records.`);
      } catch (e: any) {
        setAlarmsStatus(`Error: ${e.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Quick Preset Selector
  const handleSelectPreset = async (preset: 'samui_3' | 'samui' | 'phangan' | 'phuket') => {
    let name = '';
    let text = '';
    if (preset === 'samui_3') {
      name = '115 kV Koh Samui circuit 3';
      try {
        const res = await fetch('/Lat long of circuit 3.txt');
        if (res.ok) {
          text = await res.text();
        } else {
          text = SAMPLE_CABLE_CSV;
        }
      } catch {
        text = SAMPLE_CABLE_CSV;
      }
    } else if (preset === 'samui') {
      name = 'Mainland (Khanom) – Ko Samui 115kV Cable Transmission Circuit #2';
      text = SAMPLE_CABLE_CSV;
    } else if (preset === 'phangan') {
      name = 'Ko Samui – Ko Phangan 33kV Subsea Circuit';
      text = `9.5580, 100.0350, 4, Samui North Substation
9.5850, 100.0380, 22, Mid-Channel Deep Section
9.6250, 100.0410, 28, Marine Protection Corridor Waypoint
9.6820, 100.0310, 6, Ko Phangan Haad Rin Terminal`;
    } else {
      name = 'Phuket – Ko Phi Phi 115kV High-Voltage Link';
      text = `7.8804, 98.3923, 5, Phuket Pier Substation
7.8200, 98.5400, 32, Andaman Shipping Channel
7.7400, 98.6700, 38, Deep Trench Marine Zone
7.7390, 98.7780, 8, Ko Phi Phi Don Receiving Station`;
    }

    setRouteName(name);
    setCableCoordsText(text);
    handleParseCableInput(text, name);
  };

  // Confirm and Enter Dashboard Map
  const handleProceed = () => {
    const valid = handleParseCableInput(cableCoordsText, routeName);
    if (!valid) return;
    onUpdateCableRoute(valid);
    onConfirmAndProceed(valid);
  };

  // Execute Google Sheet Import
  const handleExecuteGoogleSheetImport = async () => {
    if (!sheetUrl.trim()) {
      setSheetError('Please enter a valid Google Sheets URL or Spreadsheet ID.');
      return;
    }

    try {
      setSheetLoading(true);
      setSheetError(null);

      if (sheetImportType === 'route') {
        const importedRoute = await importCableRouteFromGoogleSheet(
          sheetUrl,
          routeName || 'Google Sheets Circuit',
          sheetTabName || 'Sheet1'
        );
        setParsedRoute(importedRoute);
        setRouteName(importedRoute.name);
        setCableCoordsText(importedRoute.waypoints.map(w => `${w.lat}, ${w.lng}`).join('\n'));
        setCableSuccess(`Imported ${importedRoute.waypoints.length} waypoints from Google Sheet.`);
        onUpdateCableRoute(importedRoute);
      } else {
        const importedEvents = await importAlarmEventsFromGoogleSheet(
          sheetUrl,
          parsedRoute.waypoints,
          sheetTabName || 'Sheet1'
        );
        onUpdateAlarmEvents(importedEvents);
        setAlarmsParsedCount(importedEvents.length);
        setAlarmsStatus(`Successfully imported ${importedEvents.length} incident records from Google Sheet.`);
      }

      setIsSheetsModalOpen(false);
      setSheetUrl('');
    } catch (e: any) {
      setSheetError(e.message || 'Error reading Google Sheet. Check permissions or tab name.');
    } finally {
      setSheetLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
      {/* Step Workflow Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600/20 text-blue-400 border border-blue-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                System Onboarding & Route Setup
              </span>
              <span className="text-xs text-slate-400">• Step 1 of 2</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
              Subsea Cable Trace & Dataset Configuration
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Upload your subsea power cable route trace (GPS coordinates) to define the 500-meter marine protection corridor before launching the dashboard map.
            </p>
          </div>

          <button
            id="btn-proceed-to-dashboard-top"
            onClick={handleProceed}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition cursor-pointer transform hover:-translate-y-0.5 shrink-0"
          >
            <span>Proceed to Dashboard Map</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-blue-950/60 border border-blue-500/80 p-3 rounded-xl flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <div className="font-bold text-blue-300">Cable Trace Setup</div>
              <div className="text-[11px] text-slate-400">Define GPS route & 500m zone</div>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3 opacity-80">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <div className="font-bold text-slate-300">Dashboard Map & AIS Feed</div>
              <div className="text-[11px] text-slate-400">Live corridor radar & crossing traces</div>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3 opacity-80">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center shrink-0">
              3
            </div>
            <div>
              <div className="font-bold text-slate-300">Statistical Analysis</div>
              <div className="text-[11px] text-slate-400">Density & risk exposure charts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Cable Trace Configuration (Mandatory) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-600/40 flex items-center justify-center text-cyan-400">
                  <Anchor className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">1. Subsea Cable Route Trace</h3>
                  <p className="text-[11px] text-slate-400">Mandatory circuit GPS coordinates</p>
                </div>
              </div>

              {/* Template Download */}
              <button
                onClick={() => downloadTemplate(SAMPLE_CABLE_CSV, 'subsea_cable_trace_template.csv')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition cursor-pointer"
                title="Download standard CSV format template"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>CSV Template</span>
              </button>
            </div>

            {/* Circuit Presets */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                Select Pre-Configured Demo Circuit or Upload Custom:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('samui_3')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                    routeName.includes('circuit 3') || routeName.includes('Circuit #3')
                      ? 'bg-blue-950/80 border-blue-500 ring-1 ring-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-slate-200 text-[11px]">115 kV Koh Samui circuit 3</div>
                  <div className="text-[10px] text-cyan-400 font-semibold mt-0.5">High Density GPS Trace</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('samui')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                    routeName.includes('Transmission Circuit #2')
                      ? 'bg-blue-950/80 border-blue-500 ring-1 ring-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-slate-200 text-[11px]">Samui Circuit #2</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">115kV Cable (24 km)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('phangan')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                    routeName.includes('Phangan')
                      ? 'bg-blue-950/80 border-blue-500 ring-1 ring-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-slate-200 text-[11px]">Ko Samui–Ko Phangan</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">33kV Island Interconnector</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('phuket')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                    routeName.includes('Phi Phi')
                      ? 'bg-blue-950/80 border-blue-500 ring-1 ring-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-slate-200 text-[11px]">Phuket–Ko Phi Phi</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">115kV Deep Trench Link</div>
                </button>
              </div>
            </div>

            {/* Circuit Name */}
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Subsea Circuit Name & Identifier
              </label>
              <input
                id="input-setup-circuit-name"
                type="text"
                value={routeName}
                onChange={e => {
                  setRouteName(e.target.value);
                  handleParseCableInput(cableCoordsText, e.target.value);
                }}
                placeholder="e.g. Mainland (Khanom) – Ko Samui 115kV Cable Transmission Circuit #2"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* GPS Waypoints Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-300 font-semibold">
                  GPS Coordinates Waypoints (Lat, Lon, Depth, Name)
                </label>
                <span className="text-[10px] text-slate-500">Format: Latitude, Longitude</span>
              </div>
              <textarea
                id="textarea-setup-cable-coords"
                rows={7}
                value={cableCoordsText}
                onChange={e => {
                  setCableCoordsText(e.target.value);
                  handleParseCableInput(e.target.value, routeName);
                }}
                placeholder="9.3245, 99.8652, 4, Mainland Landing Terminal&#10;9.3562, 99.8964, 26, Shipping Channel&#10;9.4820, 100.0260, 5, Island Substation"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-cyan-300 focus:outline-none focus:border-blue-500 custom-scrollbar"
              />
            </div>

            {/* Upload File Button & Google Sheets Import */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 cursor-pointer transition shadow-md">
                  <UploadCloud className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold">Upload Coordinates File (.csv / .txt) for Another Circuit</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleCableFileUpload(file);
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setSheetImportType('route');
                    setSheetError(null);
                    setIsSheetsModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 text-xs font-semibold border border-emerald-700/80 cursor-pointer transition shadow-md"
                  title="Import Cable Waypoints directly from Google Sheets (pichet.kea@gmail.com)"
                >
                  <Table className="w-4 h-4 text-emerald-400" />
                  <span>Import Google Sheet</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleParseCableInput(cableCoordsText, routeName)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                Validate Geometry
              </button>
            </div>

            {/* Validation Feedback */}
            {cableError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cableError}</span>
              </div>
            )}
            {cableSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{cableSuccess}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Route Summary & Companion CSV Imports */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Geometry Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Calculated Safety Corridor Geometry
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Total Circuit Length</span>
                <span className="text-lg font-bold text-cyan-300 font-mono">
                  {parsedRoute.totalLengthKm} km
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Corridor Safety Width</span>
                <span className="text-lg font-bold text-amber-300 font-mono">
                  500m (1km Total)
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Waypoints Count</span>
                <span className="text-lg font-bold text-slate-200 font-mono">
                  {parsedRoute.waypoints.length} Points
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Landing Terminals</span>
                <span className="text-xs font-semibold text-slate-300 truncate block mt-1">
                  {parsedRoute.mainlandStation} ➔ {parsedRoute.islandStation}
                </span>
              </div>
            </div>
          </div>

          {/* Optional Companion CSV Upload Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                2. Companion CSV Logs (Optional Initial Upload)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pre-populated with demo data. You can upload custom logs now or directly on the dashboard map.
              </p>
            </div>

            {/* CSV 1: Alarm Events */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
                  <span className="font-bold text-xs text-slate-200">Maritime Incident Events (CSV)</span>
                </div>
                <span className="text-[10px] text-cyan-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {alarmsParsedCount} Records Loaded
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                AIS corridor crossing alarms and anchoring alerts with vessel MMSI, ship type, coordinates, speed, and tonnage.
              </p>

              <div className="flex flex-wrap items-center justify-between text-xs pt-1 gap-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer transition">
                    <UploadCloud className="w-3.5 h-3.5 text-rose-400" />
                    <span>Choose Alarms CSV</span>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleAlarmCSVUpload(file);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setSheetImportType('alarms');
                      setSheetError(null);
                      setIsSheetsModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 text-xs border border-emerald-700/80 cursor-pointer transition"
                    title="Import Alarm Events directly from Google Sheets"
                  >
                    <Table className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Google Sheets Log</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => downloadTemplate(SAMPLE_ALARMS_CSV, 'alarm_events_template.csv')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2 cursor-pointer"
                >
                  Template CSV
                </button>
              </div>

              {alarmsStatus && (
                <div className="text-[11px] text-emerald-300 bg-emerald-950/50 p-1.5 rounded border border-emerald-800/60">
                  {alarmsStatus}
                </div>
              )}
            </div>
          </div>

          {/* Big Launch Button */}
          <button
            id="btn-confirm-and-enter-dashboard"
            onClick={handleProceed}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-base shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5 transition cursor-pointer transform hover:-translate-y-0.5"
          >
            <span>Confirm Cable Route & Enter Dashboard Map</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Google Sheets Import Modal */}
      {isSheetsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-700/50">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    Import {sheetImportType === 'route' ? 'Cable Waypoints' : 'Incident Logs'} from Google Sheets
                  </h3>
                  <p className="text-xs text-emerald-400/90 font-medium">
                    Google Workspace Account: pichet.kea@gmail.com
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSheetsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Google Sheets Link or Spreadsheet ID
                </label>
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Sheet Tab Name (Optional, default: Sheet1)
                </label>
                <input
                  type="text"
                  value={sheetTabName}
                  onChange={e => setSheetTabName(e.target.value)}
                  placeholder="e.g. Sheet1, Circuit3, AlarmsLog"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-emerald-400" />
                  <span>How to connect your sheet:</span>
                </div>
                <p>1. Open your Google Sheet in your account (pichet.kea@gmail.com).</p>
                <p>2. Copy the URL from your browser address bar and paste it above.</p>
                <p>3. Ensure columns contain Latitude and Longitude for cable routes or AIS fields for alarms.</p>
              </div>

              {sheetError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{sheetError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteGoogleSheetImport}
                disabled={sheetLoading}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {sheetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing Sheet...</span>
                  </>
                ) : (
                  <>
                    <Table className="w-4 h-4" />
                    <span>Fetch & Parse Dataset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
