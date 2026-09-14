import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle2, Navigation, Layers, Compass, Loader2 } from 'lucide-react';

interface DashboardTransitionLoadingProps {
  routeName?: string;
  onComplete: () => void;
}

export const DashboardTransitionLoading: React.FC<DashboardTransitionLoadingProps> = ({
  routeName = '115 kV Koh Samui circuit 3',
  onComplete,
}) => {
  const [progress, setProgress] = useState<number>(12);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const steps = [
    { title: 'Validating Subsea Cable Coordinates', desc: 'Checking waypoint continuity and marine geographic bounds' },
    { title: 'Generating 500m Protection Corridor', desc: 'Computing lateral safety buffer and alert boundary polygons' },
    { title: 'Processing Real-Time AIS Vessel Vectors', desc: 'Matching speed profiles, corridor entries, and anchoring threats' },
    { title: 'Initializing Interactive Cartographic Viewport', desc: 'Mounting satellite tiles, vector layers, and HUD inspectors' },
  ];

  useEffect(() => {
    // Step progression timers
    const t1 = setTimeout(() => {
      setProgress(38);
      setCurrentStepIndex(1);
    }, 400);

    const t2 = setTimeout(() => {
      setProgress(72);
      setCurrentStepIndex(2);
    }, 900);

    const t3 = setTimeout(() => {
      setProgress(95);
      setCurrentStepIndex(3);
    }, 1400);

    const t4 = setTimeout(() => {
      setProgress(100);
    }, 1800);

    const tFinal = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tFinal);
    };
  }, [onComplete]);

  return (
    <div
      id="dashboard-transition-loading-screen"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300 select-none p-4"
    >
      <div className="relative max-w-lg w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/60 text-slate-100 overflow-hidden">
        {/* Animated Background Radar Glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* Header Icon & Title */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/30 shrink-0">
            <Compass className="w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
            <div className="absolute inset-0 rounded-2xl border-2 border-cyan-400/40 animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 tracking-wider uppercase">
              <Shield className="w-3.5 h-3.5" />
              <span>PEA-SCMM Cartography Engine</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-0.5">
              Loading Dashboard Map...
            </h2>
            <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-xs">
              {routeName}
            </p>
          </div>
        </div>

        {/* High-Resolution Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">
              {progress < 100 ? 'Configuring Marine Vector Layers...' : 'Dashboard Ready. Launching Viewport...'}
            </span>
            <span className="font-mono text-cyan-400 font-bold text-sm">
              {progress}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-sm shadow-cyan-400/50"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Verification Checklist */}
        <div className="space-y-2.5 bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
          {steps.map((step, idx) => {
            const isFinished = idx < currentStepIndex || progress === 100;
            const isCurrent = idx === currentStepIndex && progress < 100;

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 text-xs transition-opacity duration-300 ${
                  isFinished ? 'text-slate-200' : isCurrent ? 'text-cyan-300' : 'text-slate-500 opacity-60'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isFinished ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-in zoom-in duration-200" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] font-mono">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{step.title}</div>
                  <div className="text-[11px] text-slate-400 leading-tight truncate">
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>500m Safety Protection Corridor</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live AIS Surveillance</span>
          </span>
        </div>
      </div>
    </div>
  );
};
