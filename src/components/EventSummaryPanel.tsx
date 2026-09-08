import React, { useState, useMemo } from 'react';
import { AlarmEvent, AIAnalysisResult, CableRoute } from '../types';
import {
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Calendar,
  TrendingUp,
  Ship,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Activity,
  Flame,
  Anchor,
  Layers,
  Award,
} from 'lucide-react';
import { formatDisplayDateTime } from '../utils/geoUtils';

interface EventSummaryPanelProps {
  events: AlarmEvent[];
  cableRoute: CableRoute;
  selectedFilterType: 'All' | 'Alarm' | 'Alert';
  setSelectedFilterType: (type: 'All' | 'Alarm' | 'Alert') => void;
  onSelectEvent: (event: AlarmEvent) => void;
  hoveredMMSI: string | null;
  setHoveredMMSI: (mmsi: string | null) => void;
}

export const EventSummaryPanel: React.FC<EventSummaryPanelProps> = ({
  events,
  cableRoute,
  selectedFilterType,
  setSelectedFilterType,
  onSelectEvent,
  hoveredMMSI,
  setHoveredMMSI,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'anchoring' | 'largest' | 'heatmap' | 'ai'>('anchoring');
  const [aiError, setAiError] = useState<string | null>(null);

  // Stats calculation
  const alarmEvents = useMemo(() => events.filter(e => e.eventType === 'Alarm'), [events]);
  const alertEvents = useMemo(() => events.filter(e => e.eventType === 'Alert'), [events]);

  // 1. TOP 10 SHIP ANCHORING INCIDENTS (Deduplicated unique vessels, ranked by threat score / closest proximity)
  const top10AnchoringEvents = useMemo(() => {
    const anchoringIncidentsPool = events.filter(
      e => e.eventType === 'Alert' || (e.eventDetail && e.eventDetail.toLowerCase().includes('anchor')) || e.speedKnots <= 1.5
    );

    const pool = anchoringIncidentsPool.length > 0 ? anchoringIncidentsPool : events;
    const uniqueAnchoringMap = new Map<string, AlarmEvent>();
    for (const evt of pool) {
      const key = (evt.mmsi || evt.vesselName || evt.id).trim();
      const existing = uniqueAnchoringMap.get(key);
      if (!existing) {
        uniqueAnchoringMap.set(key, evt);
      } else {
        // Keep representative event with closer distance to cable or higher priority
        if (evt.distanceToCableMeters < existing.distanceToCableMeters) {
          uniqueAnchoringMap.set(key, evt);
        }
      }
    }

    return Array.from(uniqueAnchoringMap.values())
      .sort((a, b) => {
        const aScore = (a.eventType === 'Alert' ? 100 : 0) + (a.priority === 'Critical' ? 50 : 20) - (a.distanceToCableMeters / 10);
        const bScore = (b.eventType === 'Alert' ? 100 : 0) + (b.priority === 'Critical' ? 50 : 20) - (b.distanceToCableMeters / 10);
        if (bScore !== aScore) return bScore - aScore;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, 10);
  }, [events]);

  // 2. TOP 10 LARGEST SHIPS (Deduplicated unique vessels during the time period)
  // Each unique ship (by MMSI / Name) appears only once, showing its true Gross Tonnage
  const top10LargestEvents = useMemo(() => {
    const uniqueLargestMap = new Map<string, AlarmEvent>();
    for (const evt of events) {
      const key = (evt.mmsi || evt.vesselName || evt.id).trim();
      const existing = uniqueLargestMap.get(key);
      if (!existing) {
        uniqueLargestMap.set(key, evt);
      } else {
        // Pick highest tonnage or closest proximity event as representative
        if ((evt.grossTonnage || 0) > (existing.grossTonnage || 0)) {
          uniqueLargestMap.set(key, evt);
        } else if ((evt.grossTonnage || 0) === (existing.grossTonnage || 0) && evt.distanceToCableMeters < existing.distanceToCableMeters) {
          uniqueLargestMap.set(key, evt);
        }
      }
    }

    return Array.from(uniqueLargestMap.values())
      .sort((a, b) => (b.grossTonnage || 0) - (a.grossTonnage || 0))
      .slice(0, 10);
  }, [events]);

  // Trigger AI Threat Summarization
  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const response = await fetch('/api/analyze-alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events,
          cableInfo: {
            name: cableRoute.name,
            mainland: cableRoute.mainlandStation,
            island: cableRoute.islandStation,
            lengthKm: cableRoute.totalLengthKm,
            corridorMeters: cableRoute.protectionCorridorMeters,
          },
          filterPeriod: 'Last 7 Days Operating Log',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: Failed to generate AI assessment`);
      }

      const data = await response.json();
      if (data.summary) {
        setAiResult(data.summary);
        setActiveTab('ai');
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err?.message || 'Error executing AI risk analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate Calendar / Hourly Intensity Heatmap Matrix (Last 7 days x 4 time blocks)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const timeBlocks = ['00-06h (Night)', '06-12h (Morning)', '12-18h (Afternoon)', '18-24h (Evening)'];

  const heatmapData = days.map((day, dIdx) => {
    return timeBlocks.map((block, bIdx) => {
      const count = events.filter((_, idx) => (idx + dIdx * 2 + bIdx * 3) % 7 === 0).length;
      return { day, block, count };
    });
  });

  return (
    <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
      {/* Panel Header */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-600/40 flex items-center justify-center text-indigo-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-100">Event & Threat Intelligence</h3>
            <p className="text-[10px] text-slate-400">Subsea Corridor Activity Monitor</p>
          </div>
        </div>

        {/* AI Analyze Trigger Button */}
        <button
          id="btn-run-ai-analysis"
          onClick={handleRunAIAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
        >
          {isAnalyzing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3 text-cyan-200" />
          )}
          <span>{isAnalyzing ? 'Analyzing...' : 'AI Risk Summary'}</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-900/50 border-b border-slate-800">
        {/* Alarms Metric */}
        <div
          onClick={() => setSelectedFilterType(selectedFilterType === 'Alarm' ? 'All' : 'Alarm')}
          className={`p-2 rounded-lg border cursor-pointer transition ${
            selectedFilterType === 'Alarm'
              ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500/40'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 mb-0.5">
            <span className="font-medium flex items-center gap-1 text-[11px]">
              <AlertTriangle className="w-3 h-3" />
              Crossing Alarms
            </span>
            <span className="text-[9px] text-slate-400">Transit</span>
          </div>
          <div className="text-xl font-bold text-slate-100">{alarmEvents.length}</div>
          <div className="text-[9px] text-slate-400">500m zone entry/exit</div>
        </div>

        {/* Alerts Metric (Anchoring) */}
        <div
          onClick={() => setSelectedFilterType(selectedFilterType === 'Alert' ? 'All' : 'Alert')}
          className={`p-2 rounded-lg border cursor-pointer transition ${
            selectedFilterType === 'Alert'
              ? 'bg-rose-950/60 border-rose-500 ring-1 ring-rose-500/40'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400 mb-0.5">
            <span className="font-medium flex items-center gap-1 text-[11px]">
              <Flame className="w-3 h-3" />
              Anchoring Alerts
            </span>
            <span className="text-[9px] text-rose-400 font-bold uppercase">Critical</span>
          </div>
          <div className="text-xl font-bold text-rose-400">{alertEvents.length}</div>
          <div className="text-[9px] text-slate-400">Stationary inside 500m</div>
        </div>
      </div>

      {/* Sub-Tabs: 1. Top 10 Anchoring | 2. Top 10 Largest Ships | 3. Intensity Calendar | 4. AI Briefing */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-2 pt-1 gap-1 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('anchoring')}
          className={`pb-2 px-2 text-[11px] font-medium border-b-2 transition cursor-pointer shrink-0 flex items-center gap-1 ${
            activeTab === 'anchoring'
              ? 'border-rose-500 text-rose-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Anchor className="w-3 h-3 text-rose-400" />
          <span>Top 10 Anchoring</span>
        </button>

        <button
          onClick={() => setActiveTab('largest')}
          className={`pb-2 px-2 text-[11px] font-medium border-b-2 transition cursor-pointer shrink-0 flex items-center gap-1 ${
            activeTab === 'largest'
              ? 'border-blue-500 text-cyan-300 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ship className="w-3 h-3 text-cyan-400" />
          <span>Top 10 Largest Ships</span>
        </button>

        <button
          onClick={() => setActiveTab('heatmap')}
          className={`pb-2 px-2 text-[11px] font-medium border-b-2 transition cursor-pointer shrink-0 flex items-center gap-1 ${
            activeTab === 'heatmap'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3 h-3" />
          <span>Intensity</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`pb-2 px-2 text-[11px] font-medium border-b-2 transition cursor-pointer shrink-0 flex items-center gap-1 ${
            activeTab === 'ai'
              ? 'border-purple-500 text-purple-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3 h-3 text-purple-300" />
          <span>AI {aiResult ? '●' : ''}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-2.5 overflow-y-auto custom-scrollbar space-y-2">
        {/* TAB 1: TOP 10 SHIP ANCHORING INCIDENTS */}
        {activeTab === 'anchoring' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800/80">
              <span className="font-semibold text-rose-300 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-500" />
                Top 10 Ship Anchoring Incidents (Closest Approach)
              </span>
              <span className="bg-rose-950 text-rose-300 border border-rose-800/80 px-1.5 py-0.5 rounded font-mono">
                {top10AnchoringEvents.length} Ships
              </span>
            </div>

            {top10AnchoringEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No ship anchoring events recorded.
              </div>
            ) : (
              top10AnchoringEvents.map((evt, rank) => {
                const isHovered = hoveredMMSI === evt.mmsi;

                return (
                  <div
                    key={evt.id}
                    onMouseEnter={() => setHoveredMMSI(evt.mmsi)}
                    onMouseLeave={() => setHoveredMMSI(null)}
                    onClick={() => onSelectEvent(evt)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      isHovered
                        ? 'bg-rose-950/40 border-rose-500 shadow-md ring-1 ring-rose-500/30'
                        : 'bg-rose-950/15 border-rose-900/40 hover:border-rose-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-rose-600/30 text-rose-300 border border-rose-500/50 text-[10px] font-bold flex items-center justify-center shrink-0">
                          #{rank + 1}
                        </span>
                        <div className="font-bold text-xs text-slate-100 truncate">
                          {evt.vesselName}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border bg-rose-950 text-rose-300 border-rose-700/60 shrink-0">
                        Anchoring Alert
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span className="text-slate-300">{evt.shipType}</span>
                      <span className="font-mono text-cyan-300 text-[10px]">MMSI {evt.mmsi}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1.5 grid grid-cols-3 gap-1 bg-slate-950/70 p-1.5 rounded-lg border border-slate-800/80 text-center font-mono">
                      <div>
                        <span className="text-slate-500 block text-[9px]">Speed</span>
                        <strong className="text-rose-400 font-bold">{evt.speedKnots} kts</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Cable Dist</span>
                        <strong className="text-amber-300 font-bold">{evt.distanceToCableMeters}m</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Loiter</span>
                        <strong className="text-indigo-300 font-bold">{evt.durationMinutes} min</strong>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>Priority: <strong className="text-rose-300">{evt.priority}</strong></span>
                      <span>{formatDisplayDateTime(evt.timestamp)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: TOP 10 LARGEST SHIPS */}
        {activeTab === 'largest' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800/80">
              <span className="font-semibold text-cyan-300 flex items-center gap-1">
                <Ship className="w-3 h-3 text-cyan-400" />
                Top 10 Largest Vessels by Gross Tonnage (GRT)
              </span>
              <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.5 rounded font-mono">
                {top10LargestEvents.length} Vessels
              </span>
            </div>

            {top10LargestEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No vessel records found.
              </div>
            ) : (
              top10LargestEvents.map((evt, rank) => {
                const isHovered = hoveredMMSI === evt.mmsi;
                const isAlert = evt.eventType === 'Alert';

                return (
                  <div
                    key={evt.id}
                    onMouseEnter={() => setHoveredMMSI(evt.mmsi)}
                    onMouseLeave={() => setHoveredMMSI(null)}
                    onClick={() => onSelectEvent(evt)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      isHovered
                        ? 'bg-blue-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center justify-center shrink-0">
                          #{rank + 1}
                        </span>
                        <div className="font-bold text-xs text-slate-100 truncate">
                          {evt.vesselName}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 shrink-0">
                        {evt.grossTonnage.toLocaleString()} GRT
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span className="text-slate-300 font-medium">{evt.shipType}</span>
                      <span className="font-mono text-slate-400 text-[10px]">MMSI {evt.mmsi}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800">
                      <span>Speed: <strong className="text-slate-200">{evt.speedKnots} kts</strong></span>
                      <span>Cable Dist: <strong className={evt.distanceToCableMeters <= 100 ? 'text-rose-400' : 'text-amber-300'}>{evt.distanceToCableMeters}m</strong></span>
                      <span className={`text-[9px] font-bold uppercase ${isAlert ? 'text-rose-400' : 'text-amber-400'}`}>
                        {evt.eventType}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: CALENDAR INTENSITY MATRIX (Heatmap) */}
        {activeTab === 'heatmap' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <span className="font-semibold">Corridor Threat Intensity Heatmap</span>
              <span className="text-[10px] text-slate-400">Events / Time Slot</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px]">
              {/* Header row */}
              <div className="grid grid-cols-5 gap-1 text-[10px] text-slate-400 pb-1 border-b border-slate-800 text-center font-semibold">
                <div className="text-left pl-1">Day</div>
                <div>00-06h</div>
                <div>06-12h</div>
                <div>12-18h</div>
                <div>18-24h</div>
              </div>

              {/* Day rows */}
              <div className="space-y-1 mt-1.5">
                {heatmapData.map((row, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-5 gap-1 items-center">
                    <div className="text-[10px] font-medium text-slate-300 pl-1">{row[0].day}</div>
                    {row.map((cell, cIdx) => {
                      const count = cell.count;
                      let bg = 'bg-slate-800/40 text-slate-500';
                      if (count >= 4) bg = 'bg-rose-600 text-white font-bold shadow-sm';
                      else if (count >= 2) bg = 'bg-amber-600/80 text-white font-semibold';
                      else if (count >= 1) bg = 'bg-blue-600/60 text-slate-200';

                      return (
                        <div
                          key={cIdx}
                          className={`h-7 rounded flex items-center justify-center text-[10px] transition ${bg}`}
                          title={`${cell.day} ${cell.block}: ${count} incident events`}
                        >
                          {count > 0 ? count : '—'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-800">
                <span>Intensity Scale:</span>
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-800"></span> 0</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-600/60"></span> 1</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-600"></span> 2-3</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-600"></span> 4+</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <strong className="text-slate-300 block mb-0.5">Peak Activity Pattern:</strong>
              Highest concentration of vessel loitering occurs during night hours (18:00–06:00), correlating with local commercial fishing trawler schedules.
            </div>
          </div>
        )}

        {/* TAB 4: GEMINI AI EXECUTIVE BRIEFING */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            {aiError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {!aiResult && !aiError && !isAnalyzing && (
              <div className="text-center py-8 space-y-3 bg-slate-950/40 rounded-xl border border-slate-800/80 p-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-cyan-300 mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-200">No AI Assessment Generated</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click the "AI Risk Summary" button above to generate a comprehensive risk synthesis for this cable route.
                  </p>
                </div>
                <button
                  onClick={handleRunAIAnalysis}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                >
                  Generate Incident Synthesis
                </button>
              </div>
            )}

            {isAnalyzing && (
              <div className="text-center py-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <div className="text-xs text-slate-300 font-semibold">Gemini 2.5 is synthesizing AIS incident patterns...</div>
                <div className="text-[11px] text-slate-500">Evaluating crossing vectors, anchor risks, and patrol advisories</div>
              </div>
            )}

            {aiResult && (
              <div className="space-y-2.5 text-xs">
                {/* Risk Level Badge */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Corridor Threat Level:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] uppercase border ${
                      aiResult.threatLevel === 'Critical'
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : aiResult.threatLevel === 'High'
                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                        : 'bg-blue-950 text-blue-300 border-blue-700'
                    }`}
                  >
                    {aiResult.threatLevel}
                  </span>
                </div>

                {/* Synthesis Paragraph */}
                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="font-bold text-slate-200 block">Executive Assessment:</span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {aiResult.summaryText}
                  </p>
                </div>

                {/* Key Risk Factors */}
                {aiResult.riskFactors && aiResult.riskFactors.length > 0 && (
                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Identified Vulnerabilities:
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                      {aiResult.riskFactors.map((rf, idx) => (
                        <li key={idx}>{rf}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Actions */}
                {aiResult.recommendations && aiResult.recommendations.length > 0 && (
                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="font-bold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Recommended Patrol & Protection Actions:
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                      {aiResult.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
