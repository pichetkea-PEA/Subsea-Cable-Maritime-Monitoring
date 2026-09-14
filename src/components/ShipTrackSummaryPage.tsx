import React, { useState, useRef, useEffect } from 'react';
import { CableRoute, ShipTrackSummaryData } from '../types';
import { ShipTrackMapChart } from './ShipTrackMapChart';
import { ShipGeneralDataBox } from './ShipGeneralDataBox';
import { ErrorBoundary } from './ErrorBoundary';
import { parseShipTrackCsv } from '../utils/shipTrackParser';
import {
  generateSampleShipTrack,
  exportShipTrackToCsvString,
} from '../data/sampleShipTrack';
import { generateShipTrackPdf } from '../utils/shipTrackPdfGenerator';
import {
  Upload,
  FileSpreadsheet,
  Play,
  RotateCcw,
  AlertCircle,
  Route,
  Shield,
  Layers,
} from 'lucide-react';

interface ShipTrackSummaryPageProps {
  cableRoute: CableRoute;
}

export const ShipTrackSummaryPage: React.FC<ShipTrackSummaryPageProps> = ({ cableRoute }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContentText, setFileContentText] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<ShipTrackSummaryData | null>(() => {
    try {
      return generateSampleShipTrack(cableRoute);
    } catch {
      return null;
    }
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize track summary when cableRoute changes (e.g. user selected another circuit on Page 1)
  useEffect(() => {
    if (!selectedFile && !fileContentText) {
      try {
        setSummaryData(generateSampleShipTrack(cableRoute));
      } catch (e) {
        console.warn('Failed to regenerate sample track for cableRoute:', e);
      }
    } else if (fileContentText) {
      parseShipTrackCsv(fileContentText, cableRoute).then(setSummaryData).catch(console.warn);
    }
  }, [cableRoute]);

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErrorMessage('Please upload a valid CSV file (.csv).');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContentText(text);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      setSelectedFile(file);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setFileContentText(text);
      };
      reader.readAsText(file);
    }
  };

  // Button: "Summarize ship track"
  const handleSummarizeShipTrack = async () => {
    setErrorMessage(null);

    if (!fileContentText && !selectedFile) {
      // If no file uploaded yet, regenerate sample track for the active cable route
      try {
        const sample = generateSampleShipTrack(cableRoute);
        setSummaryData(sample);
      } catch (err: any) {
        setErrorMessage('Failed to generate track summary: ' + err.message);
      }
      return;
    }

    if (!fileContentText) {
      setErrorMessage('No CSV content found. Please re-select the CSV file.');
      return;
    }

    try {
      setIsParsing(true);
      const result = await parseShipTrackCsv(fileContentText, cableRoute);
      setSummaryData(result);
    } catch (err: any) {
      console.error('Ship track parse error:', err);
      setErrorMessage(err.message || 'Failed to parse ship track CSV file.');
    } finally {
      setIsParsing(false);
    }
  };

  // Reset to default sample track
  const handleResetToSample = () => {
    setSelectedFile(null);
    setFileContentText(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    try {
      const sample = generateSampleShipTrack(cableRoute);
      setSummaryData(sample);
    } catch (e) {
      console.warn('Sample reset warning:', e);
    }
  };

  // Download Sample CSV template
  const handleDownloadSampleCsv = () => {
    const sample = summaryData || generateSampleShipTrack(cableRoute);
    const csvString = exportShipTrackToCsvString(sample);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sample_Ship_Track_${(cableRoute?.name || 'Circuit').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export current summarized track to CSV
  const handleExportCurrentCsv = () => {
    if (!summaryData) return;
    const csvString = exportShipTrackToCsvString(summaryData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ship_Track_${summaryData.ship.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Multi-Page PDF Generation (Page 1: Overall Map; Page 2: Zoomed Orange & Red Charts + Tables)
  const handleGeneratePdf = async () => {
    if (!summaryData) {
      setErrorMessage('Please summarize a ship track first before generating the PDF report.');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      await generateShipTrackPdf(summaryData, cableRoute, mapContainerRef.current);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setErrorMessage('Failed to generate PDF report: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <ErrorBoundary fallbackTitle="Ship Track Summary View Error">
      <div className="flex-1 flex flex-col p-3 lg:p-4 space-y-3 bg-slate-950 text-white min-h-[calc(100vh-60px)]">
        {/* Active Circuit & Protection Zone Status Badge (Data inherited directly from Page 1) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0"></span>
            <span className="text-slate-400 font-medium">Selected Cable Circuit:</span>
            <span className="font-bold text-cyan-300 truncate max-w-sm sm:max-w-md">
              {cableRoute?.name || '115 kV Koh Samui circuit 3'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/40">
              Page 1 Data Active
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Protection Corridor:{' '}
                <strong className="text-amber-300 font-mono">
                  {cableRoute?.protectionCorridorMeters || 500}m
                </strong>{' '}
                <span className="text-slate-400 text-[10px]">
                  (Total {((cableRoute?.protectionCorridorMeters || 500) * 2).toLocaleString()}m zone)
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Waypoints: <strong className="text-slate-100 font-mono">{cableRoute?.waypoints?.length || 0}</strong>
              </span>
              {cableRoute?.totalLengthKm ? (
                <span className="text-slate-400 text-[10px]">
                  ({cableRoute.totalLengthKm.toFixed(1)} km)
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Top Controls & CSV Upload Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 lg:p-4 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Page Title & Instructions */}
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Route className="w-5 h-5" />
                </div>
                <h1 className="text-base lg:text-lg font-bold text-slate-100 flex items-center gap-2">
                  4. Ship Track Summary
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                    Trajectory &amp; Corridor Encroachment
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Upload a <strong>&quot;Ship Track&quot;</strong> CSV file. Click{' '}
                <strong>&quot;Summarize ship track&quot;</strong> to render the vessel path with directional arrowheads, evaluate color-coded status fixes, and analyze individual ship data with the Page 1 circuit protection zone.
              </p>
            </div>

            {/* Right: Upload Inputs & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="ship-track-csv-input"
              />

              {/* Upload CSV button */}
              <label
                htmlFor="ship-track-csv-input"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold cursor-pointer transition shadow-sm"
                title="Click or drag & drop CSV file"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span className="truncate max-w-[160px]">
                  {selectedFile ? selectedFile.name : 'Upload "Ship Track" CSV'}
                </span>
              </label>

              {/* Summarize ship track Button */}
              <button
                id="btn-summarize-ship-track"
                onClick={handleSummarizeShipTrack}
                disabled={isParsing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Summarize ship track</span>
                  </>
                )}
              </button>

              {/* Sample & Reset Actions */}
              <button
                onClick={handleResetToSample}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg border border-slate-800 cursor-pointer transition"
                title="Reset to Sample Track Data"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleDownloadSampleCsv}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg border border-slate-800 cursor-pointer transition"
                title="Download Sample CSV Format"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Sample CSV</span>
              </button>
            </div>
          </div>

          {/* Error Notification banner */}
          {errorMessage && (
            <div className="mt-2.5 bg-red-950/60 border border-red-800 text-red-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Main Workspace Layout: 70% Map Chart | 30% Right-Side Vessel Particulars Box */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-[620px]">
          {/* Map Chart Area: 70% width on desktop */}
          <div className="w-full lg:w-[70%] xl:w-[72%] flex flex-col">
            <ShipTrackMapChart
              cableRoute={cableRoute}
              summaryData={summaryData}
              containerRefOut={mapContainerRef}
            />
          </div>

          {/* Right-Side Box: 30% width on desktop (Contains individual data of ship + PDF Summary Button) */}
          <div className="w-full lg:w-[30%] xl:w-[28%] flex flex-col">
            <ShipGeneralDataBox
              summaryData={summaryData}
              onGeneratePdf={handleGeneratePdf}
              isGeneratingPdf={isGeneratingPdf}
              onExportCsv={handleExportCurrentCsv}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
