import React from 'react';
import { ShipParticulars, ShipTrackSummaryData } from '../types';
import {
  Ship,
  Anchor,
  AlertTriangle,
  FileText,
  Download,
  Info,
  Compass,
  Gauge,
  Clock,
  ShieldAlert,
  Copy,
  Check,
  Flag,
  Ruler,
} from 'lucide-react';

interface ShipGeneralDataBoxProps {
  summaryData: ShipTrackSummaryData | null;
  onGeneratePdf: () => void;
  isGeneratingPdf?: boolean;
  onExportCsv?: () => void;
}

export const ShipGeneralDataBox: React.FC<ShipGeneralDataBoxProps> = ({
  summaryData,
  onGeneratePdf,
  isGeneratingPdf = false,
  onExportCsv,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (!summaryData) {
    return (
      <div className="h-full bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center text-slate-400 space-y-3 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
          <Ship className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-base text-slate-200">No Vessel Data Loaded</h3>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Upload a &quot;Ship Track&quot; CSV file and click <strong>&quot;Summarize ship track&quot;</strong> to inspect individual ship data and surveillance analytics.
        </p>
      </div>
    );
  }

  const { ship } = summaryData;

  return (
    <div className="h-full bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xl space-y-4 overflow-y-auto">
      {/* Box Header: General Data of Ship */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-900/50 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Ship className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                General Ship Data
              </h2>
              <p className="text-[11px] text-slate-400">Individual vessel particulars &amp; AIS registry</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/50">
            {ship.flag || 'AIS Verified'}
          </span>
        </div>

        {/* 7 Required Individual Ship Particulars */}
        <div className="grid grid-cols-1 gap-2 text-xs">
          {/* 1. Name */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Vessel Name</div>
              <div className="text-sm font-bold text-cyan-300 mt-0.5">{ship.name || 'Unknown'}</div>
            </div>
            <button
              onClick={() => handleCopy('name', ship.name)}
              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Copy Name"
            >
              {copiedField === 'name' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 2. MMSI & 3. IMO */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">MMSI</div>
              <div className="text-xs font-mono font-bold text-slate-100 mt-0.5 flex items-center justify-between">
                <span>{ship.mmsi || '-'}</span>
                <button
                  onClick={() => handleCopy('mmsi', ship.mmsi)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {copiedField === 'mmsi' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">IMO</div>
              <div className="text-xs font-mono font-bold text-slate-100 mt-0.5 flex items-center justify-between">
                <span>{ship.imo || '-'}</span>
                <button
                  onClick={() => handleCopy('imo', ship.imo)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {copiedField === 'imo' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* 4. Call Sign & 5. Ship Type */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Call Sign</div>
              <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5 truncate">
                {ship.callSign || '-'}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Ship Type</div>
              <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate" title={ship.shipType}>
                {ship.shipType || 'Commercial Vessel'}
              </div>
            </div>
          </div>

          {/* 6. Ship Dimension & 7. Flag */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                <Ruler className="w-3 h-3 text-slate-400" />
                <span>Dimension</span>
              </div>
              <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                {ship.dimension || '118m × 19m'}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                <Flag className="w-3 h-3 text-slate-400" />
                <span>Flag</span>
              </div>
              <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                {ship.flag || 'Thailand 🇹🇭'}
              </div>
            </div>
          </div>
        </div>

        {/* Cable Surveillance & Threat Summary Box */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2.5">
          <div className="text-xs font-bold text-slate-200 flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="flex items-center gap-1.5 text-amber-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              Surveillance Incident Summary
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{summaryData.totalPoints} fixes</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Anchoring Times */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Anchor className="w-3 h-3 text-red-400" />
                <span>Anchoring</span>
              </div>
              <div className="text-base font-bold text-red-400 mt-0.5">
                {summaryData.anchoringCount}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  {summaryData.anchoringCount === 1 ? 'time' : 'times'}
                </span>
              </div>
              <div className="text-[9.5px] text-slate-500 mt-0.5">
                ({summaryData.pointsAnchoringCount} track points)
              </div>
            </div>

            {/* Cable Zone Entrances */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Enter Cable Zone</span>
              </div>
              <div className="text-base font-bold text-amber-400 mt-0.5">
                {summaryData.cableZoneEnterCount}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  {summaryData.cableZoneEnterCount === 1 ? 'time' : 'times'}
                </span>
              </div>
              <div className="text-[9.5px] text-slate-500 mt-0.5">
                ({summaryData.pointsInCableZoneCount} points in corridor)
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-1 text-[11px] text-slate-300 pt-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Min Distance to Cable:</span>
              <span className="font-bold text-cyan-400">{summaryData.minDistanceToCableMeters} meters</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Speed (SOG Profile):</span>
              <span>
                Avg <strong>{summaryData.avgSog}</strong> kts (Max {summaryData.maxSog} kts)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Time Window:</span>
              <span className="truncate max-w-[150px]" title={`${summaryData.startTime} ➔ ${summaryData.endTime}`}>
                {summaryData.durationFormatted}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions: PDF Summary Report & CSV Export */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <button
          id="btn-generate-ship-pdf"
          onClick={onGeneratePdf}
          disabled={isGeneratingPdf}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs py-3 px-4 rounded-lg shadow-lg shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingPdf ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Generating PDF Report...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>PDF Summary Report</span>
            </>
          )}
        </button>

        {onExportCsv && (
          <button
            onClick={onExportCsv}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs py-2 px-3 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Track Points (CSV)</span>
          </button>
        )}
      </div>
    </div>
  );
};
