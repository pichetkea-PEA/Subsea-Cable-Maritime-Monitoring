import React from 'react';
import { Ship, Anchor, Compass, Radio, Waves, ShieldCheck, Sparkles, Navigation, Info } from 'lucide-react';

export type VesselCategoryKey =
  | 'pleasure_craft'
  | 'towing_and_tug'
  | 'passenger_ship'
  | 'hsc'
  | 'cargo_ship'
  | 'tanker'
  | 'fishing'
  | 'port_tender';

export interface VesselCategoryInfo {
  key: VesselCategoryKey;
  title: string;
  definition: string;
  accentColor: string;
  badgeBg: string;
  textColor: string;
}

export const VESSEL_CATEGORIES: Record<VesselCategoryKey, VesselCategoryInfo> = {
  pleasure_craft: {
    key: 'pleasure_craft',
    title: 'Pleasure Craft',
    definition:
      'A water vessel used strictly for recreation, personal enjoyment, or daily living rather than commercial work or carrying fare-paying passengers.',
    accentColor: '#38bdf8',
    badgeBg: 'bg-sky-950/90 border-sky-500/50',
    textColor: 'text-sky-300',
  },
  towing_and_tug: {
    key: 'towing_and_tug',
    title: 'Towing & Tug',
    definition:
      'A commercial watercraft built to pull, push, or haul alongside other floating objects or disabled vessels.',
    accentColor: '#f59e0b',
    badgeBg: 'bg-amber-950/90 border-amber-500/50',
    textColor: 'text-amber-300',
  },
  passenger_ship: {
    key: 'passenger_ship',
    title: 'Passenger Ship',
    definition:
      'A merchant watercraft designed and equipped primarily to transport people by water.',
    accentColor: '#60a5fa',
    badgeBg: 'bg-blue-950/90 border-blue-500/50',
    textColor: 'text-blue-300',
  },
  hsc: {
    key: 'hsc',
    title: 'HSC (High-Speed Craft)',
    definition:
      'A fast civilian water vessel capable of a maximum speed.',
    accentColor: '#06b6d4',
    badgeBg: 'bg-cyan-950/90 border-cyan-500/50',
    textColor: 'text-cyan-300',
  },
  cargo_ship: {
    key: 'cargo_ship',
    title: 'Cargo Ship',
    definition:
      'A commercial merchant vessel designed primarily to transport goods, commodities, and materials from one port to another across oceans and seas.',
    accentColor: '#f97316',
    badgeBg: 'bg-orange-950/90 border-orange-500/50',
    textColor: 'text-orange-300',
  },
  tanker: {
    key: 'tanker',
    title: 'Tanker',
    definition:
      'A large vessel built to transport liquids or gases in bulk without using barrels or individual containers.',
    accentColor: '#f43f5e',
    badgeBg: 'bg-rose-950/90 border-rose-500/50',
    textColor: 'text-rose-300',
  },
  fishing: {
    key: 'fishing',
    title: 'Fishing',
    definition:
      'Any boat or ship used to catch, process, or transport fish and other aquatic life from the sea.',
    accentColor: '#10b981',
    badgeBg: 'bg-emerald-950/90 border-emerald-500/50',
    textColor: 'text-emerald-300',
  },
  port_tender: {
    key: 'port_tender',
    title: 'Port Tender',
    definition:
      'A small boat or service vessel used to transport passengers, crew, or supplies between a large ship anchored offshore and the land when a port lacks a deep-water dock.',
    accentColor: '#a855f7',
    badgeBg: 'bg-purple-950/90 border-purple-500/50',
    textColor: 'text-purple-300',
  },
};

export function resolveVesselCategory(shipType: string = ''): VesselCategoryInfo {
  const typeLower = shipType.toLowerCase();

  // 1. HSC / High Speed Craft
  if (
    typeLower.includes('hsc') ||
    typeLower.includes('high speed') ||
    typeLower.includes('high-speed') ||
    typeLower.includes('hydrofoil') ||
    typeLower.includes('fast ferry')
  ) {
    return VESSEL_CATEGORIES.hsc;
  }

  // 2. Pleasure Craft
  if (
    typeLower.includes('pleasure') ||
    typeLower.includes('yacht') ||
    typeLower.includes('sailing') ||
    typeLower.includes('sailboat') ||
    typeLower.includes('recreation')
  ) {
    return VESSEL_CATEGORIES.pleasure_craft;
  }

  // 3. Port Tender / Pilot / Service Shuttle
  if (
    typeLower.includes('tender') ||
    typeLower.includes('port tender') ||
    typeLower.includes('pilot') ||
    typeLower.includes('shuttle') ||
    typeLower.includes('crew boat') ||
    typeLower.includes('launch')
  ) {
    return VESSEL_CATEGORIES.port_tender;
  }

  // 4. Towing & Tug
  if (
    typeLower.includes('tug') ||
    typeLower.includes('towing') ||
    typeLower.includes('pusher') ||
    typeLower.includes('salvage') ||
    typeLower.includes('workboat')
  ) {
    return VESSEL_CATEGORIES.towing_and_tug;
  }

  // 5. Fishing
  if (
    typeLower.includes('fishing') ||
    typeLower.includes('trawler') ||
    typeLower.includes('seiner') ||
    typeLower.includes('fish') ||
    typeLower.includes('whaler')
  ) {
    return VESSEL_CATEGORIES.fishing;
  }

  // 6. Tanker
  if (
    typeLower.includes('tanker') ||
    typeLower.includes('oil') ||
    typeLower.includes('chemical') ||
    typeLower.includes('crude') ||
    typeLower.includes('lpg') ||
    typeLower.includes('lng') ||
    typeLower.includes('gas carrier')
  ) {
    return VESSEL_CATEGORIES.tanker;
  }

  // 7. Passenger Ship
  if (
    typeLower.includes('passenger') ||
    typeLower.includes('ferry') ||
    typeLower.includes('cruise') ||
    typeLower.includes('ro-pax') ||
    typeLower.includes('catamaran')
  ) {
    return VESSEL_CATEGORIES.passenger_ship;
  }

  // 8. Cargo Ship (Default commercial merchant vessel)
  return VESSEL_CATEGORIES.cargo_ship;
}

interface VesselMockupProps {
  shipType?: string;
  vesselName?: string;
  mmsi?: string;
  tonnage?: number;
  className?: string;
  showDefinition?: boolean;
}

export const VesselMockup: React.FC<VesselMockupProps> = ({
  shipType = 'Passenger ship',
  vesselName = 'Vessel',
  mmsi = '567001507',
  tonnage,
  className = '',
  showDefinition = true,
}) => {
  const categoryInfo = resolveVesselCategory(shipType);
  const category = categoryInfo.key;

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between p-2.5 select-none ${className}`}
    >
      {/* Nautical Grid Background */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '18px 18px',
        }}
      />

      {/* Top Header Tag Ribbon */}
      <div className="relative z-10 flex items-center justify-between text-[10px] font-mono gap-2">
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border backdrop-blur-md shadow-sm ${categoryInfo.badgeBg}`}
        >
          <Ship className={`w-3.5 h-3.5 ${categoryInfo.textColor}`} />
          <span className={`font-bold uppercase tracking-wider ${categoryInfo.textColor}`}>
            {categoryInfo.title}
          </span>
        </div>

        <div className="text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/80 flex items-center gap-1.5 shadow-sm text-[9px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-400">ILLUSTRATION</span>
        </div>
      </div>

      {/* Main 2D Illustrated Vector Picture */}
      <div className="relative z-10 my-auto flex items-center justify-center w-full px-2 py-1">
        <svg
          viewBox="0 0 380 145"
          className="w-full max-h-32 drop-shadow-[0_8px_18px_rgba(0,0,0,0.8)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Water Surface Gradient */}
            <linearGradient id="vesselOceanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#082f49" stopOpacity="0.95" />
            </linearGradient>

            {/* Glass Shading Gradient */}
            <linearGradient id="vesselGlassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Gold / Brass Accent Gradient */}
            <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {/* Ocean Waterline & Horizon Grid */}
          <path
            d="M 0 114 Q 48 111 95 114 T 190 114 T 285 114 T 380 114 L 380 145 L 0 145 Z"
            fill="url(#vesselOceanGrad)"
          />
          <line
            x1="0"
            y1="114"
            x2="380"
            y2="114"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.8"
          />

          {/* ======================================================== */}
          {/* 1. PLEASURE CRAFT: Recreation & Luxury Cruiser */}
          {/* ======================================================== */}
          {category === 'pleasure_craft' && (
            <g id="art-pleasure-craft">
              <ellipse cx="190" cy="120" rx="140" ry="6" fill="#000000" opacity="0.45" />

              {/* Sleek Deep-V Pure White Yacht Hull */}
              <path
                d="M 40 114 L 305 114 Q 345 114 360 84 L 335 70 L 40 70 Z"
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />
              {/* Navy Waterline Accent Stripe */}
              <path d="M 40 106 L 312 106 Q 338 106 348 88 L 340 88 Q 312 99 40 99 Z" fill="#0284c7" />
              <line x1="40" y1="92" x2="330" y2="92" stroke="#d97706" strokeWidth="1.5" />

              {/* Swim Platform at Stern */}
              <rect x="30" y="102" width="14" height="6" rx="2" fill="#d97706" stroke="#92400e" strokeWidth="0.8" />
              <rect x="25" y="104" width="8" height="2" fill="#94a3b8" />

              {/* Main Deck Luxury Salon */}
              <path d="M 90 70 L 295 70 L 310 46 L 110 46 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.2" />
              {/* Panoramic Tinted Salon Windows */}
              <path d="M 125 50 L 290 50 L 302 65 L 115 65 Z" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Flybridge & Sun Deck */}
              <path d="M 140 46 L 255 46 L 265 28 L 155 28 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
              <rect x="168" y="32" width="85" height="10" rx="1.5" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Sleek Aerodynamic Radar Arch */}
              <path d="M 155 46 L 175 12 L 188 12 L 172 46 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <ellipse cx="182" cy="10" rx="9" ry="3" fill="#38bdf8" stroke="#0284c7" strokeWidth="0.8" />

              {/* Foredeck Sun Loungers & Stainless Steel Bow Railings */}
              <path d="M 270 70 L 332 70 L 338 62 L 270 62" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
              <rect x="265" y="64" width="22" height="5" rx="1.5" fill="#3b82f6" />
            </g>
          )}

          {/* ======================================================== */}
          {/* 2. TOWING AND TUG: Powerful Towboat & Salvage Pusher */}
          {/* ======================================================== */}
          {category === 'towing_and_tug' && (
            <g id="art-towing-tug">
              <ellipse cx="180" cy="120" rx="120" ry="6" fill="#000000" opacity="0.45" />

              {/* Heavy Duty High-Bollard-Pull Tug Hull */}
              <path
                d="M 50 114 L 275 114 Q 315 114 322 80 L 300 70 L 50 70 Z"
                fill="#b45309"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
              <path d="M 50 106 L 285 106 Q 305 106 312 88 L 50 88 Z" fill="#78350f" />

              {/* Heavy Wrap-Around Rubber Bow Fender */}
              <path
                d="M 300 70 Q 328 80 322 98 Q 308 110 290 112"
                fill="none"
                stroke="#0f172a"
                strokeWidth="9"
                strokeLinecap="round"
              />

              {/* Elevated 360-Degree Panoramic Pilot House */}
              <path d="M 135 70 L 245 70 L 252 34 L 142 34 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
              <rect x="150" y="38" width="92" height="12" rx="2" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Twin High-Output Exhaust Funnels */}
              <path d="M 158 34 L 162 14 L 176 14 L 172 34 Z" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
              <path d="M 184 34 L 188 14 L 202 14 L 198 34 Z" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
              <rect x="161" y="14" width="16" height="3" fill="#0f172a" />
              <rect x="187" y="14" width="16" height="3" fill="#0f172a" />

              {/* Heavy Towing Winch & Spool on Aft Deck */}
              <rect x="75" y="52" width="38" height="18" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
              <circle cx="94" cy="61" r="5.5" fill="#f59e0b" />
              <line x1="60" y1="58" x2="75" y2="58" stroke="#cbd5e1" strokeWidth="2" />

              {/* Heavy Towing Bollard / Towing Staple */}
              <rect x="62" y="64" width="8" height="8" rx="1" fill="#f59e0b" />

              {/* Pilot House Searchlight & Radar Mast */}
              <line x1="225" y1="34" x2="225" y2="10" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx="225" cy="10" r="3.5" fill="#38bdf8" />
            </g>
          )}

          {/* ======================================================== */}
          {/* 3. PASSENGER SHIP: Merchant People Ferry & Cruise Liner */}
          {/* ======================================================== */}
          {category === 'passenger_ship' && (
            <g id="art-passenger-ship">
              <ellipse cx="190" cy="120" rx="145" ry="6" fill="#000000" opacity="0.45" />

              {/* Lower Maritime Hull (Blue with Boot-topping) */}
              <path
                d="M 35 114 L 305 114 Q 348 114 360 88 L 340 72 L 35 72 Z"
                fill="#1e3a8a"
                stroke="#60a5fa"
                strokeWidth="1.5"
              />
              <path d="M 35 106 L 312 106 Q 338 106 348 90 L 340 90 Q 312 100 35 100 Z" fill="#ef4444" />

              {/* Lower Passenger / Vehicle Enclosed Deck */}
              <rect x="55" y="56" width="270" height="16" rx="2" fill="#3b82f6" stroke="#93c5fd" strokeWidth="1" />

              {/* Upper Superstructure Lounge & Cabins */}
              <rect x="80" y="36" width="230" height="20" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />

              {/* Double Rows of Passenger Windows */}
              {[95, 120, 145, 170, 195, 220, 245, 270, 290].map((x, i) => (
                <rect key={`pwin-${i}`} x={x} y="41" width="16" height="9" rx="1.5" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />
              ))}

              {/* Forward Navigation Bridge & Wheelhouse */}
              <path d="M 220 36 L 305 36 L 315 18 L 230 18 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
              <rect x="240" y="22" width="65" height="8" rx="1.5" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Streamlined Passenger Exhaust Stack */}
              <path d="M 140 36 L 150 16 L 170 16 L 162 36 Z" fill="#ef4444" stroke="#f87171" strokeWidth="1.2" />
              <rect x="148" y="16" width="22" height="4" rx="1" fill="#0f172a" />

              {/* Lifeboat Stations on Promenade */}
              <rect x="105" y="52" width="28" height="6" rx="3" fill="#f97316" stroke="#fb923c" strokeWidth="0.5" />
              <rect x="145" y="52" width="28" height="6" rx="3" fill="#f97316" stroke="#fb923c" strokeWidth="0.5" />
              <rect x="185" y="52" width="28" height="6" rx="3" fill="#f97316" stroke="#fb923c" strokeWidth="0.5" />

              {/* Main Radar Mast & Navigation Lights */}
              <line x1="280" y1="18" x2="280" y2="4" stroke="#e2e8f0" strokeWidth="2" />
              <line x1="272" y1="9" x2="288" y2="9" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="280" cy="4" r="2.5" fill="#38bdf8" />
            </g>
          )}

          {/* ======================================================== */}
          {/* 4. HSC: High-Speed Craft & Fast Catamaran Hydrofoil */}
          {/* ======================================================== */}
          {category === 'hsc' && (
            <g id="art-hsc-fast-craft">
              <ellipse cx="190" cy="120" rx="145" ry="6" fill="#000000" opacity="0.45" />

              {/* Wave-Piercing Twin Catamaran Low-Drag Hull */}
              <path
                d="M 40 114 L 320 114 Q 365 114 372 86 L 335 72 L 40 72 Z"
                fill="#0f172a"
                stroke="#06b6d4"
                strokeWidth="1.5"
              />
              <path d="M 40 106 L 330 106 Q 355 106 364 90 L 40 90 Z" fill="#0284c7" />

              {/* High-Speed Hydrofoil Wing & Waterjet Plume Under Hull */}
              <path d="M 30 112 Q 10 112 0 106 Q 15 118 35 116 Z" fill="#e0f2fe" opacity="0.8" />
              <path d="M 20 114 Q 5 114 -8 110 Q 10 120 25 118 Z" fill="#38bdf8" opacity="0.6" />

              {/* Swept Aerodynamic Cockpit & Speed Passenger Pod */}
              <path d="M 80 72 L 310 72 L 328 44 L 110 44 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
              {/* Sweeping Aero Windshield Ribbon */}
              <path d="M 140 48 L 305 48 L 318 64 L 125 64 Z" fill="url(#vesselGlassGrad)" stroke="#06b6d4" strokeWidth="0.8" />

              {/* Air Intake Scoop & High-Speed Turbines */}
              <path d="M 115 44 L 135 30 L 175 30 L 165 44 Z" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
              <rect x="138" y="32" width="30" height="5" rx="1.5" fill="#0f172a" />

              {/* Swept Back Aerodynamic Radar Arch */}
              <path d="M 175 44 L 195 18 L 210 18 L 190 44 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <circle cx="204" cy="16" r="3.5" fill="#06b6d4" />

              {/* High-Visibility HSC Speed Marking Bands */}
              <polygon points="280,72 295,48 305,48 290,72" fill="#ef4444" />
            </g>
          )}

          {/* ======================================================== */}
          {/* 5. CARGO SHIP: Commercial Ocean Freight & Containers */}
          {/* ======================================================== */}
          {category === 'cargo_ship' && (
            <g id="art-cargo-ship">
              <ellipse cx="190" cy="120" rx="150" ry="6" fill="#000000" opacity="0.45" />

              {/* Deep Ocean Cargo Hull with Bulbous Bow Flare */}
              <path
                d="M 30 114 L 320 114 Q 360 114 370 82 L 345 68 L 30 68 Z"
                fill="#991b1b"
                stroke="#f87171"
                strokeWidth="1.5"
              />
              <path d="M 30 106 L 325 106 Q 352 106 362 88 L 354 88 Q 325 98 30 98 Z" fill="#7f1d1d" />

              {/* Container Bays (Tier 1) */}
              <rect x="88" y="52" width="46" height="16" rx="1" fill="#2563eb" stroke="#1d4ed8" strokeWidth="0.8" />
              <rect x="138" y="52" width="46" height="16" rx="1" fill="#16a34a" stroke="#15803d" strokeWidth="0.8" />
              <rect x="188" y="52" width="46" height="16" rx="1" fill="#d97706" stroke="#b45309" strokeWidth="0.8" />
              <rect x="238" y="52" width="46" height="16" rx="1" fill="#dc2626" stroke="#b91c1c" strokeWidth="0.8" />

              {/* Container Bays (Tier 2) */}
              <rect x="94" y="36" width="44" height="16" rx="1" fill="#0891b2" stroke="#0e7490" strokeWidth="0.8" />
              <rect x="142" y="36" width="44" height="16" rx="1" fill="#ca8a04" stroke="#a16207" strokeWidth="0.8" />
              <rect x="192" y="36" width="44" height="16" rx="1" fill="#4f46e5" stroke="#4338ca" strokeWidth="0.8" />
              <rect x="242" y="36" width="40" height="16" rx="1" fill="#059669" stroke="#047857" strokeWidth="0.8" />

              {/* Container Bays (Tier 3) */}
              <rect x="98" y="20" width="42" height="16" rx="1" fill="#ea580c" stroke="#c2410c" strokeWidth="0.8" />
              <rect x="146" y="20" width="42" height="16" rx="1" fill="#2563eb" stroke="#1d4ed8" strokeWidth="0.8" />
              <rect x="196" y="20" width="42" height="16" rx="1" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />

              {/* Aft Bridge Superstructure Castle */}
              <path d="M 36 68 L 82 68 L 82 22 L 42 22 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
              <rect x="48" y="26" width="32" height="8" rx="1" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Funnel */}
              <path d="M 40 22 L 43 8 L 56 8 L 53 22 Z" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />

              {/* Radar Mast & Forecastle Flag Staff */}
              <line x1="72" y1="22" x2="72" y2="4" stroke="#e2e8f0" strokeWidth="1.5" />
              <line x1="340" y1="68" x2="340" y2="44" stroke="#e2e8f0" strokeWidth="1.5" />
            </g>
          )}

          {/* ======================================================== */}
          {/* 6. TANKER: Bulk Liquid & Gas Carrier */}
          {/* ======================================================== */}
          {category === 'tanker' && (
            <g id="art-tanker-ship">
              <ellipse cx="190" cy="120" rx="150" ry="6" fill="#000000" opacity="0.45" />

              {/* Low Freeboard Tanker Hull */}
              <path
                d="M 30 114 L 320 114 Q 360 114 368 84 L 345 74 L 30 74 Z"
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <line x1="30" y1="106" x2="356" y2="106" stroke="#ef4444" strokeWidth="3" />

              {/* Deck Cargo Pipeline Truss Networks */}
              <line x1="90" y1="70" x2="300" y2="70" stroke="#cbd5e1" strokeWidth="3" />
              <line x1="90" y1="65" x2="300" y2="65" stroke="#94a3b8" strokeWidth="1.8" />

              {/* Midships Cargo Manifold Valves & Loading Crane */}
              <rect x="185" y="52" width="25" height="22" rx="2" fill="#ef4444" stroke="#f87171" strokeWidth="1" />
              <circle cx="197" cy="52" r="4" fill="#f59e0b" />
              <line x1="197" y1="52" x2="197" y2="34" stroke="#f59e0b" strokeWidth="2" />
              <line x1="197" y1="34" x2="215" y2="38" stroke="#f59e0b" strokeWidth="2" />

              {/* Forecastle Forward Anchor Store */}
              <path d="M 305 74 L 342 74 L 342 60 L 310 60 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

              {/* Aft Bridge Castle & Accommodation */}
              <path d="M 38 74 L 88 74 L 88 24 L 46 24 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
              <rect x="52" y="28" width="34" height="8" rx="1" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Funnel */}
              <path d="M 44 24 L 47 10 L 60 10 L 57 24 Z" fill="#0f172a" stroke="#ef4444" strokeWidth="1.5" />
              <line x1="72" y1="24" x2="72" y2="6" stroke="#cbd5e1" strokeWidth="1.5" />
            </g>
          )}

          {/* ======================================================== */}
          {/* 7. FISHING: Marine Trawler & Aquatic Life Harvester */}
          {/* ======================================================== */}
          {category === 'fishing' && (
            <g id="art-fishing-trawler">
              <ellipse cx="180" cy="120" rx="130" ry="6" fill="#000000" opacity="0.45" />

              {/* High Flared Bow Green Fishing Hull */}
              <path
                d="M 40 114 L 285 114 Q 328 114 338 82 L 315 72 L 40 72 Z"
                fill="#047857"
                stroke="#34d399"
                strokeWidth="1.5"
              />
              <line x1="40" y1="106" x2="325" y2="106" stroke="#f59e0b" strokeWidth="2.5" />

              {/* Forward Wheelhouse & Living Quarters */}
              <path d="M 210 72 L 290 72 L 298 40 L 218 40 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
              <rect x="230" y="46" width="60" height="9" rx="1.5" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Heavy Aft Trawling Gantry Rig / A-Frame */}
              <line x1="65" y1="72" x2="98" y2="24" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="130" y1="72" x2="98" y2="24" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="78" y1="44" x2="118" y2="44" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="98" cy="24" r="4" fill="#ef4444" />

              {/* Trawl Net Spool Drum on Aft Working Deck */}
              <rect x="135" y="54" width="30" height="18" rx="3" fill="#064e3b" stroke="#34d399" strokeWidth="1.2" />
              <line x1="140" y1="58" x2="160" y2="58" stroke="#10b981" strokeWidth="1.5" />
              <line x1="140" y1="64" x2="160" y2="64" stroke="#10b981" strokeWidth="1.5" />

              {/* Outrigger Fishing Booms */}
              <line x1="180" y1="72" x2="155" y2="30" stroke="#cbd5e1" strokeWidth="2" />

              {/* Searchlight Mast */}
              <line x1="260" y1="40" x2="260" y2="14" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx="260" cy="14" r="3.5" fill="#fbbf24" />
            </g>
          )}

          {/* ======================================================== */}
          {/* 8. PORT TENDER: Harbor Service Boat & Passenger Shuttle */}
          {/* ======================================================== */}
          {category === 'port_tender' && (
            <g id="art-port-tender">
              <ellipse cx="180" cy="120" rx="115" ry="6" fill="#000000" opacity="0.45" />

              {/* High-Freeboard Harbor Tender Service Hull */}
              <path
                d="M 55 114 L 275 114 Q 310 114 318 84 L 295 72 L 55 72 Z"
                fill="#581c87"
                stroke="#c084fc"
                strokeWidth="1.5"
              />

              {/* Continuous Perimeter High-Visibility D-Fender */}
              <path
                d="M 50 74 L 295 74 Q 315 84 310 98 Q 295 112 280 114"
                fill="none"
                stroke="#0f172a"
                strokeWidth="7"
                strokeLinecap="round"
              />

              {/* Central Passenger Seating Enclosure & Pilot Cabin */}
              <path d="M 115 72 L 245 72 L 255 42 L 125 42 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
              {/* Boarding Windows */}
              <rect x="135" y="48" width="105" height="12" rx="2" fill="url(#vesselGlassGrad)" stroke="#38bdf8" strokeWidth="0.5" />

              {/* Safe Boarding Platform with Handrails */}
              <path d="M 255 72 L 290 72 L 295 62 L 255 62" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
              <rect x="260" y="64" width="28" height="8" rx="1" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />

              {/* Aft Luggage / Supply Cargo Rack with Yellow Tarp */}
              <rect x="70" y="58" width="38" height="14" rx="2" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />
              <line x1="70" y1="65" x2="108" y2="65" stroke="#713f12" strokeWidth="1" />

              {/* High-Visibility Searchlight Mast */}
              <line x1="200" y1="42" x2="200" y2="18" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx="200" cy="18" r="3.5" fill="#a855f7" />
            </g>
          )}
        </svg>
      </div>

      {/* Bottom Technical Specifications & Definition Footer */}
      <div className="relative z-10 flex flex-col gap-1 text-[9px] font-mono text-slate-300 pt-1.5 border-t border-slate-800/80 bg-slate-950/80 px-2 py-1 rounded backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate max-w-[160px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="truncate text-cyan-200 font-bold">{vesselName}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>MMSI: <strong className="text-cyan-300">{mmsi}</strong></span>
            {tonnage ? <span className="text-slate-300 font-semibold">{tonnage.toLocaleString()} GRT</span> : null}
          </div>
        </div>

        {/* Definition Subtitle */}
        {showDefinition && (
          <div className="text-[8.5px] leading-tight text-slate-400 font-sans italic line-clamp-2 border-t border-slate-900/90 pt-1">
            <span className="text-cyan-400/90 font-semibold not-italic">Definition: </span>
            {categoryInfo.definition}
          </div>
        )}
      </div>
    </div>
  );
};
