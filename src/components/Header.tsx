import React from 'react';
import { Anchor, Shield, Radio, Activity, UploadCloud, BarChart3, Database, User, Compass, LogOut } from 'lucide-react';
import { CableRoute, UserProfile } from '../types';

export type NavigationTab = 'setup' | 'dashboard' | 'statistics';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  cableRoute: CableRoute;
  onChangeRouteClick: () => void;
  onDataManageClick: () => void;
  onAuthClick: () => void;
  onLogout?: () => void;
  currentUser: UserProfile;
  alarmCount: number;
  alertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cableRoute,
  onChangeRouteClick,
  onDataManageClick,
  onAuthClick,
  onLogout,
  currentUser,
  alarmCount,
  alertCount,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 select-none sticky top-0 z-40">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand & Cable Status */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-950 border border-blue-600/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-blue-500/10">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-wide text-slate-100 flex items-center gap-1.5">
                SUBSEA CABLE MARITIME MONITORING
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                HISTORICAL AIS DATA
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="text-slate-300 font-medium truncate max-w-[280px] sm:max-w-md">
                Active Circuit: <span className="text-cyan-300 font-semibold">{cableRoute.name}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">500m Safety Corridor</span>
              <button
                id="btn-change-cable-route"
                onClick={() => setActiveTab('setup')}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 ml-1 cursor-pointer"
              >
                Change Trace / Setup
              </button>
            </div>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800/80 text-xs font-medium">
          <button
            id="nav-tab-setup"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'setup'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>1. Cable Trace & Data Setup</span>
          </button>
          <button
            id="nav-tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>2. Dashboard Map</span>
          </button>
          <button
            id="nav-tab-statistics"
            onClick={() => setActiveTab('statistics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'statistics'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>3. Statistical Analysis</span>
          </button>
        </nav>

        {/* Right: Quick Counts & User Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Threat Tally */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-2.5 py-1 rounded-md text-xs">
            <div className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Alarms: <strong>{alarmCount}</strong></span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>Alerts: <strong>{alertCount}</strong></span>
            </div>
          </div>

          {/* User Profile Button */}
          <button
            id="btn-user-profile"
            onClick={onAuthClick}
            className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] ring-1 ring-blue-400/40">
              {currentUser.name.charAt(0)}
            </div>
            <div className="text-left hidden sm:block">
              <div className="font-semibold text-slate-200 flex items-center gap-1">
                {currentUser.name}
                {currentUser.role === 'admin' && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1 rounded uppercase font-bold">
                    Admin
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">{currentUser.email}</div>
            </div>
          </button>

          {/* Quick Sign Out Button */}
          {onLogout && (
            <button
              id="btn-header-logout"
              onClick={onLogout}
              title="Sign Out of Session"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/80 hover:border-rose-700/60 border border-slate-700/80 text-slate-400 hover:text-rose-300 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
