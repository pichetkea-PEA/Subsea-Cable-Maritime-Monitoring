import React, { useState } from 'react';
import { CableRoute } from '../types';
import { parseCableRouteFile } from '../utils/geoUtils';
import { X, Navigation, Plus, Check, Trash2, Shield, UploadCloud } from 'lucide-react';

interface CableRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute: CableRoute;
  savedRoutes: CableRoute[];
  onSelectRoute: (route: CableRoute) => void;
  onAddNewRoute: (route: CableRoute) => void;
  onDeleteRoute?: (routeId: string) => void;
}

export const CableRouteModal: React.FC<CableRouteModalProps> = ({
  isOpen,
  onClose,
  currentRoute,
  savedRoutes,
  onSelectRoute,
  onAddNewRoute,
  onDeleteRoute,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newCoordinatesText, setNewCoordinatesText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateRoute = () => {
    try {
      setErrorMsg(null);
      if (!newCoordinatesText.trim()) {
        throw new Error('Please input waypoint coordinates.');
      }
      const name = newRouteName.trim() || `Subsea Circuit #${savedRoutes.length + 1}`;
      const parsed = parseCableRouteFile(newCoordinatesText, name);
      onAddNewRoute(parsed);
      onSelectRoute(parsed);
      setIsAddingNew(false);
      setNewRouteName('');
      setNewCoordinatesText('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse coordinates');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-600/40 flex items-center justify-center text-cyan-400">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Subsea Cable Circuit Manager</h3>
              <p className="text-xs text-slate-400">Select active monitoring route or upload a new circuit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {!isAddingNew ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Configured Cable Circuits ({savedRoutes.length})</span>
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload New Circuit
                </button>
              </div>

              <div className="space-y-2">
                {savedRoutes.map(route => {
                  const isActive = currentRoute.id === route.id;

                  return (
                    <div
                      key={route.id}
                      onClick={() => {
                        onSelectRoute(route);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'bg-blue-950/70 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-100">{route.name}</span>
                          {isActive && (
                            <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>{route.waypoints.length} Waypoints</span>
                          <span>•</span>
                          <span>{route.totalLengthKm} km Length</span>
                          <span>•</span>
                          <span>500m Safety Corridor</span>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <span className="text-cyan-400 font-mono text-[11px] block">
                          {route.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Upload New Circuit Form */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-200">Import New Subsea Cable Trace</h4>
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Circuit / Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ko Samui – Ko Phangan Subsea Power Link"
                  value={newRouteName}
                  onChange={e => setNewRouteName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  GPS Coordinates (Lat, Lon per line)
                </label>
                <textarea
                  rows={6}
                  placeholder="9.3245, 99.8652, 4, Landing Terminal&#10;9.3562, 99.8964, 26, Channel Waypoint&#10;9.4820, 100.0260, 5, Substation Arrival"
                  value={newCoordinatesText}
                  onChange={e => setNewCoordinatesText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 p-2 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleCreateRoute}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Save & Set Active Circuit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
