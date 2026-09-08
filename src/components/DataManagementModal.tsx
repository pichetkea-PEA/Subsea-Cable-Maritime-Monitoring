import React, { useState } from 'react';
import { CableRoute, AlarmEvent, HistoricalShipSummary } from '../types';
import { parseCableRouteFile, parseAlarmEventsCSV, parseHistoricalShipCSV } from '../utils/geoUtils';
import { SAMPLE_CABLE_CSV, SAMPLE_ALARMS_CSV, SAMPLE_HISTORICAL_CSV, DEFAULT_CABLE_ROUTE, INITIAL_ALARM_EVENTS, INITIAL_HISTORICAL_SHIPS } from '../data/mockData';
import { uploadToGoogleDrive, formatCableRouteToText, formatEventsToCSV } from '../utils/driveUtils';
import { getAccessToken } from '../lib/firebase';
import { X, UploadCloud, Download, CheckCircle2, AlertCircle, FileText, Database, Layers, Sparkles, HardDrive } from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cableRoute: CableRoute;
  events: AlarmEvent[];
  onUpdateCableRoute: (newRoute: CableRoute) => void;
  onUpdateAlarmEvents: (events: AlarmEvent[]) => void;
  onUpdateHistoricalData: (data: HistoricalShipSummary[]) => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  cableRoute,
  events,
  onUpdateCableRoute,
  onUpdateAlarmEvents,
  onUpdateHistoricalData,
}) => {
  const [activeTab, setActiveTab] = useState<'alarms' | 'cable' | 'historical'>('alarms');

  // Cable Route Form state
  const [routeNameInput, setRouteNameInput] = useState('');
  const [cableFileText, setCableFileText] = useState('');
  const [cableStatusMsg, setCableStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Alarms Form state
  const [alarmsFileText, setAlarmsFileText] = useState('');
  const [alarmsStatusMsg, setAlarmsStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Historical Form state
  const [histFileText, setHistFileText] = useState('');
  const [histStatusMsg, setHistStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Drive Backup Loading states
  const [isDriveSaving, setIsDriveSaving] = useState(false);

  if (!isOpen) return null;

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

  // Google Drive Backup for Cable Route
  const handleSaveRouteToDrive = async () => {
    setIsDriveSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Google OAuth access token missing. Please sign in with your Google Account (pichet.kea@gmail.com).');
      }
      const routeText = formatCableRouteToText(cableRoute);
      const res = await uploadToGoogleDrive(token, 'Lat long of circuit 3.txt', routeText, 'text/plain');
      setCableStatusMsg({
        type: 'success',
        text: `Saved "Lat long of circuit 3.txt" to Google Drive (pichet.kea@gmail.com) successfully! File ID: ${res.id}`,
      });
    } catch (err: any) {
      setCableStatusMsg({ type: 'error', text: err.message || 'Drive export failed.' });
    } finally {
      setIsDriveSaving(false);
    }
  };

  // Google Drive Backup for Alarm Events CSV
  const handleSaveAlarmsToDrive = async () => {
    setIsDriveSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Google OAuth access token missing. Please sign in with your Google Account (pichet.kea@gmail.com).');
      }
      const csvData = formatEventsToCSV(events);
      const res = await uploadToGoogleDrive(token, 'Default Alarm Event.csv', csvData, 'text/csv');
      setAlarmsStatusMsg({
        type: 'success',
        text: `Saved "Default Alarm Event.csv" to Google Drive (pichet.kea@gmail.com) successfully! File ID: ${res.id}`,
      });
    } catch (err: any) {
      setAlarmsStatusMsg({ type: 'error', text: err.message || 'Drive export failed.' });
    } finally {
      setIsDriveSaving(false);
    }
  };

  // 1. Process Cable Route Upload
  const handleUploadCableRoute = () => {
    try {
      if (!cableFileText.trim()) {
        throw new Error('Please select or paste a CSV/Text file containing GPS coordinates.');
      }
      const name = routeNameInput.trim() || 'Subsea Cable Transmission Circuit';
      const parsed = parseCableRouteFile(cableFileText, name);
      onUpdateCableRoute(parsed);
      setCableStatusMsg({
        type: 'success',
        text: `Successfully imported "${name}" with ${parsed.waypoints.length} GPS waypoints (${parsed.totalLengthKm} km). Set as default persistent circuit.`,
      });
      setCableFileText('');
      setRouteNameInput('');
    } catch (err: any) {
      setCableStatusMsg({ type: 'error', text: err.message || 'Failed to parse cable coordinates' });
    }
  };

  // 2. Process Alarm Events CSV Upload
  const handleUploadAlarmEvents = () => {
    try {
      if (!alarmsFileText.trim()) {
        throw new Error('Please select or paste an Alarm Event Summary CSV file.');
      }
      const parsed = parseAlarmEventsCSV(alarmsFileText, cableRoute.waypoints);
      if (parsed.length === 0) {
        throw new Error('No valid event rows parsed from CSV.');
      }
      onUpdateAlarmEvents(parsed);
      setAlarmsStatusMsg({
        type: 'success',
        text: `Successfully imported ${parsed.length} maritime alarm & alert records. AIS traces generated.`,
      });
      setAlarmsFileText('');
    } catch (err: any) {
      setAlarmsStatusMsg({ type: 'error', text: err.message || 'Failed to parse alarm events CSV' });
    }
  };

  // 3. Process Historical Ship Type Summary CSV Upload
  const handleUploadHistoricalData = () => {
    try {
      if (!histFileText.trim()) {
        throw new Error('Please select or paste a Historical Ship Type Summary CSV file.');
      }
      const parsed = parseHistoricalShipCSV(histFileText);
      if (parsed.length === 0) {
        throw new Error('No valid records parsed from Historical CSV.');
      }
      onUpdateHistoricalData(parsed);
      setHistStatusMsg({
        type: 'success',
        text: `Successfully imported ${parsed.length} historical density records across vessel classes.`,
      });
      setHistFileText('');
    } catch (err: any) {
      setHistStatusMsg({ type: 'error', text: err.message || 'Failed to parse historical summary CSV' });
    }
  };

  // Reset to default sample datasets
  const handleRestoreDemoData = () => {
    onUpdateCableRoute(DEFAULT_CABLE_ROUTE);
    onUpdateAlarmEvents(INITIAL_ALARM_EVENTS);
    onUpdateHistoricalData(INITIAL_HISTORICAL_SHIPS);
    alert('Prototype sample datasets restored successfully (Mainland–Island Link, 10 Incident AIS traces, and 25 historical logs).');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-600/40 flex items-center justify-center text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Dataset & Route Management</h3>
              <p className="text-xs text-slate-400">Import CSV logs, update subsea cable circuits, or download templates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('alarms')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'alarms'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Alarm Event Summary (CSV)
          </button>
          <button
            onClick={() => setActiveTab('cable')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'cable'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Cable Route Trace (GPS)
          </button>
          <button
            onClick={() => setActiveTab('historical')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'historical'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Historical Ship Summary
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* TAB 1: ALARM EVENT SUMMARY */}
          {activeTab === 'alarms' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wide">
                    Upload Alarm & Alert Events CSV
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Includes timestamp, MMSI, vessel name, entry/exit coordinates, speed, and tonnage.
                  </p>
                </div>
                <button
                  onClick={() => downloadTemplate(SAMPLE_ALARMS_CSV, 'alarm_event_summary_template.csv')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  Template CSV
                </button>
              </div>

              {/* File Drop / Text Area */}
              <div>
                <textarea
                  id="textarea-alarms-csv"
                  rows={6}
                  placeholder="Paste Alarm Event Summary CSV content here or upload a file..."
                  value={alarmsFileText}
                  onChange={e => setAlarmsFileText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 cursor-pointer transition">
                    <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
                    <span>Choose CSV File</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => setAlarmsFileText(ev.target?.result as string);
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>

                  <button
                    id="btn-drive-backup-alarms"
                    onClick={handleSaveAlarmsToDrive}
                    disabled={isDriveSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 font-medium text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isDriveSaving ? 'Saving...' : 'Backup "Default Alarm Event.csv" to Google Drive'}</span>
                  </button>
                </div>

                <button
                  id="btn-submit-alarms-csv"
                  onClick={handleUploadAlarmEvents}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer ml-auto"
                >
                  Import & Parse Events
                </button>
              </div>

              {alarmsStatusMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    alarmsStatusMsg.type === 'success'
                      ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300'
                      : 'bg-rose-950/70 border border-rose-700/60 text-rose-300'
                  }`}
                >
                  {alarmsStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{alarmsStatusMsg.text}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CABLE ROUTE TRACE */}
          {activeTab === 'cable' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wide">
                    Import Subsea Cable Route Coordinates
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Enter circuit name and list of GPS waypoints (Lat, Lon, Depth, Waypoint Name).
                  </p>
                </div>
                <button
                  onClick={() => downloadTemplate(SAMPLE_CABLE_CSV, 'cable_route_gps_template.csv')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  Template CSV
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Subsea Circuit Name</label>
                <input
                  id="input-circuit-name"
                  type="text"
                  placeholder="e.g. Mainland (Khanom) – Ko Samui 115kV Circuit #2"
                  value={routeNameInput}
                  onChange={e => setRouteNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">GPS Coordinates (Latitude, Longitude)</label>
                <textarea
                  id="textarea-cable-coords"
                  rows={5}
                  placeholder="9.3245, 99.8652, 4, Mainland Landing Terminal&#10;9.3562, 99.8964, 26, Shipping Channel&#10;9.4820, 100.0260, 5, Island Substation"
                  value={cableFileText}
                  onChange={e => setCableFileText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 cursor-pointer transition">
                    <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Choose Text / CSV</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => setCableFileText(ev.target?.result as string);
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>

                  <button
                    id="btn-drive-backup-route"
                    onClick={handleSaveRouteToDrive}
                    disabled={isDriveSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 font-medium text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isDriveSaving ? 'Saving...' : 'Backup "Lat long of circuit 3.txt" to Google Drive'}</span>
                  </button>
                </div>

                <button
                  id="btn-submit-cable-route"
                  onClick={handleUploadCableRoute}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer ml-auto"
                >
                  Set as Active Default Route
                </button>
              </div>

              {cableStatusMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    cableStatusMsg.type === 'success'
                      ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300'
                      : 'bg-rose-950/70 border border-rose-700/60 text-rose-300'
                  }`}
                >
                  {cableStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{cableStatusMsg.text}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HISTORICAL SHIP SUMMARY */}
          {activeTab === 'historical' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wide">
                    Historical Ship Type Summary CSV
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Aggregated vessel traffic density, speed, dwell time, and tonnage over time.
                  </p>
                </div>
                <button
                  onClick={() => downloadTemplate(SAMPLE_HISTORICAL_CSV, 'historical_ship_summary_template.csv')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  Template CSV
                </button>
              </div>

              <div>
                <textarea
                  id="textarea-historical-csv"
                  rows={6}
                  placeholder="Paste Historical Ship Type Summary CSV content here..."
                  value={histFileText}
                  onChange={e => setHistFileText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 cursor-pointer transition">
                  <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
                  <span>Choose CSV File</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => setHistFileText(ev.target?.result as string);
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>

                <button
                  id="btn-submit-historical-csv"
                  onClick={handleUploadHistoricalData}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Import Statistical Data
                </button>
              </div>

              {histStatusMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    histStatusMsg.type === 'success'
                      ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300'
                      : 'bg-rose-950/70 border border-rose-700/60 text-rose-300'
                  }`}
                >
                  {histStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{histStatusMsg.text}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleRestoreDemoData}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Restore Prototype Demo Data
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
