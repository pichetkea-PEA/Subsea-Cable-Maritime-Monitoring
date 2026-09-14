import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CableRoute, ShipTrackPoint, ShipTrackSummaryData } from '../types';
import { generateCableBufferPolygon } from '../utils/geoUtils';
import { ZoomIn, ZoomOut, Compass, AlertTriangle, Navigation } from 'lucide-react';

interface ShipTrackMapChartProps {
  cableRoute: CableRoute;
  summaryData: ShipTrackSummaryData | null;
  onHoverPoint?: (point: ShipTrackPoint | null) => void;
  containerRefOut?: React.RefObject<HTMLDivElement | null>;
}

export const ShipTrackMapChart: React.FC<ShipTrackMapChartProps> = ({
  cableRoute,
  summaryData,
  onHoverPoint,
  containerRefOut,
}) => {
  const outerContainerRef = useRef<HTMLDivElement | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups
  const corridorLayerRef = useRef<L.LayerGroup | null>(null);
  const cableLayerRef = useRef<L.LayerGroup | null>(null);
  const trackLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeBaseMap, setActiveBaseMap] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [hoveredPoint, setHoveredPoint] = useState<ShipTrackPoint | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);

  // Synchronize containerRefOut with outer container
  useEffect(() => {
    if (containerRefOut && outerContainerRef.current) {
      (containerRefOut as any).current = outerContainerRef.current;
    }
  }, [containerRefOut]);

  // Helper to compute bearing in degrees from point 1 to point 2
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    const dLon = (lon2 - lon1) * toRad;
    const y = Math.sin(dLon) * Math.cos(lat2 * toRad);
    const x =
      Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
      Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * toDeg;
    return (brng + 360) % 360;
  };

  // Color mapping utility
  const getColorHex = (color: 'red' | 'green' | 'orange' | 'yellow'): string => {
    switch (color) {
      case 'red':
        return '#ef4444';
      case 'green':
        return '#22c55e';
      case 'orange':
        return '#f97316';
      case 'yellow':
        return '#eab308';
    }
  };

  // 1. Initialize Map safely (free of ResizeObserver loops)
  useEffect(() => {
    const container = mapDivRef.current;
    if (!container) return;

    // Prevent "Map container is already initialized"
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const waypoints = cableRoute?.waypoints || [];
    const defaultCenter: [number, number] =
      waypoints.length > 0
        ? [waypoints[Math.floor(waypoints.length / 2)].lat, waypoints[Math.floor(waypoints.length / 2)].lng]
        : [9.40, 99.95];

    const map = L.map(container, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    mapInstanceRef.current = map;

    // Add Tile Layer
    const tileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
        attribution: 'Map tiles &copy; Esri',
        crossOrigin: true,
      }
    ).addTo(map);
    baseTileLayerRef.current = tileLayer;

    // Initialize Layer Groups in structured z-index order
    corridorLayerRef.current = L.layerGroup().addTo(map);
    cableLayerRef.current = L.layerGroup().addTo(map);
    trackLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    setMapReady(true);

    // Debounced window resize handler (NEVER use ResizeObserver synchronously calling invalidateSize!)
    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleWindowResize);
      setMapReady(false);
      try {
        map.remove();
      } catch (e) {
        console.warn('Map cleanup error:', e);
      }
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // 2. Switch Tile Layers when activeBaseMap changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !baseTileLayerRef.current) return;

    map.removeLayer(baseTileLayerRef.current);

    let tileUrl = '';
    let maxZoom = 18;

    if (activeBaseMap === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
    } else if (activeBaseMap === 'dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      maxZoom = 19;
    } else {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      maxZoom = 19;
    }

    const newTile = L.tileLayer(tileUrl, {
      maxZoom,
      attribution: 'Map tiles &copy; Esri / OpenStreetMap',
      crossOrigin: true,
    }).addTo(map);

    baseTileLayerRef.current = newTile;
  }, [activeBaseMap, mapReady]);

  // 3. Draw Subsea Cable, Page 1 Protection Zone Polygon, and Ship Track
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // Clear existing vector layers
    corridorLayerRef.current?.clearLayers();
    cableLayerRef.current?.clearLayers();
    trackLayerRef.current?.clearLayers();
    markersLayerRef.current?.clearLayers();

    const boundsPoints: [number, number][] = [];
    const waypoints = cableRoute?.waypoints || [];

    // --- A. Draw Subsea Cable and Protection Zone (Exact Page 1 Data) ---
    if (waypoints.length > 0) {
      const cableCoords: [number, number][] = waypoints.map((w) => {
        boundsPoints.push([w.lat, w.lng]);
        return [w.lat, w.lng];
      });

      // 1. Draw Protection Buffer Corridor Polygon using Page 1 data
      const corridorWidth = cableRoute.protectionCorridorMeters || 500;
      const bufferPolygonCoords = generateCableBufferPolygon(waypoints, corridorWidth);
      if (bufferPolygonCoords.length > 0 && corridorLayerRef.current) {
        const bufferPoly = L.polygon(bufferPolygonCoords, {
          color: '#f59e0b',
          weight: 1.5,
          opacity: 0.85,
          fillColor: '#d97706',
          fillOpacity: 0.12,
          dashArray: '4, 4',
        });

        bufferPoly.bindTooltip(
          `<div>
            <div style="font-weight: bold; color: #f59e0b; font-size: 11px;">
              ${corridorWidth}m Restricted Protection Zone
            </div>
            <div style="font-size: 10px; color: #cbd5e1;">
              ${cableRoute.name || 'Subsea Cable Route'} • Prohibited Anchoring / Trawling
            </div>
          </div>`,
          { sticky: true, className: 'leaflet-custom-tooltip' }
        );

        corridorLayerRef.current.addLayer(bufferPoly);
      }

      // 2. Draw Cable Route Polyline
      if (cableLayerRef.current) {
        // Glow line
        const cableGlow = L.polyline(cableCoords, {
          color: '#22d3ee',
          weight: 7,
          opacity: 0.35,
        });
        cableLayerRef.current.addLayer(cableGlow);

        // Core Cable line
        const cableLine = L.polyline(cableCoords, {
          color: '#06b6d4',
          weight: 3.5,
          opacity: 0.95,
        });
        cableLayerRef.current.addLayer(cableLine);

        // Landing Station Markers
        const wpStart = waypoints[0];
        const wpEnd = waypoints[waypoints.length - 1];

        const terminalIconStart = L.divIcon({
          className: 'terminal-marker',
          html: `
            <div style="background: rgba(15, 23, 42, 0.92); border: 1.5px solid #06b6d4; border-radius: 4px; padding: 2px 6px; font-size: 9px; font-weight: bold; color: #38bdf8; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.8);">
              ${cableRoute.islandStation || 'KP 0.0 Landing'}
            </div>
          `,
          iconSize: [120, 20],
          iconAnchor: [60, 24],
        });
        cableLayerRef.current.addLayer(
          L.marker([wpStart.lat, wpStart.lng], { icon: terminalIconStart, interactive: false })
        );

        const terminalIconEnd = L.divIcon({
          className: 'terminal-marker',
          html: `
            <div style="background: rgba(15, 23, 42, 0.92); border: 1.5px solid #22c55e; border-radius: 4px; padding: 2px 6px; font-size: 9px; font-weight: bold; color: #4ade80; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.8);">
              ${cableRoute.mainlandStation || 'KP End Landing'}
            </div>
          `,
          iconSize: [120, 20],
          iconAnchor: [60, 24],
        });
        cableLayerRef.current.addLayer(
          L.marker([wpEnd.lat, wpEnd.lng], { icon: terminalIconEnd, interactive: false })
        );
      }
    }

    // --- B. Draw Ship Track Path & Categorized Dots ---
    const points = summaryData?.points || [];
    if (points.length > 0 && trackLayerRef.current && markersLayerRef.current) {
      const trackCoords: [number, number][] = points.map((p) => {
        boundsPoints.push([p.lat, p.lng]);
        return [p.lat, p.lng];
      });

      // 1. Path Polyline connecting points
      const pathLine = L.polyline(trackCoords, {
        color: '#38bdf8',
        weight: 2.2,
        opacity: 0.85,
        dashArray: '5, 4',
      });
      trackLayerRef.current.addLayer(pathLine);

      // 2. Arrowheads along the movement direction (sampled to max ~60 arrows for smooth performance)
      const arrowStep = Math.max(1, Math.floor(points.length / 50));
      for (let i = 0; i < points.length - 1; i += arrowStep) {
        const p1 = points[i];
        const p2 = points[i + 1];

        // Ensure minimum distance between consecutive points before drawing arrow
        const dLat = Math.abs(p2.lat - p1.lat);
        const dLng = Math.abs(p2.lng - p1.lng);
        if (dLat < 0.00005 && dLng < 0.00005) continue;

        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;
        const bearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);

        const arrowIcon = L.divIcon({
          className: 'track-arrowhead',
          html: `
            <div style="transform: rotate(${Math.round(bearing)}deg); width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5">
                <polygon points="12,2 22,21 12,17 2,21" />
              </svg>
            </div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        trackLayerRef.current.addLayer(
          L.marker([midLat, midLng], { icon: arrowIcon, interactive: false })
        );
      }

      // 3. Small Circle Dots categorized by color
      points.forEach((pt, idx) => {
        const hex = getColorHex(pt.dotColor);

        const dotMarker = L.circleMarker([pt.lat, pt.lng], {
          radius: 5.5,
          fillColor: hex,
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.95,
        });

        // Hover tooltip on each dot
        const tooltipHtml = `
          <div style="min-width: 190px; font-family: sans-serif; font-size: 11px; line-height: 1.4; color: #f1f5f9; padding: 2px;">
            <div style="font-weight: bold; color: #38bdf8; font-size: 11.5px; margin-bottom: 3px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 2px;">
              ⏱️ ${pt.localTimeStr}
            </div>
            <div style="color: #cbd5e1; margin-bottom: 2px;">
              <strong>Lat:</strong> ${pt.lat.toFixed(5)}° &nbsp;<strong>Lon:</strong> ${pt.lng.toFixed(5)}°
            </div>
            <div style="margin-bottom: 2px; font-weight: 600; color: ${hex}; display: flex; align-items: center; gap: 4px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${hex}; display: inline-block;"></span>
              <span>Status: ${pt.status}</span>
            </div>
            <div style="color: #94a3b8; font-size: 10px; display: flex; justify-content: space-between; margin-top: 3px; padding-top: 2px; border-top: 1px dashed rgba(255,255,255,0.1);">
              <span>SOG: <strong>${pt.sog.toFixed(1)} kts</strong></span>
              <span>${
                pt.isInsideCableZone
                  ? '<span style="color:#f59e0b; font-weight:bold;">Inside Cable Zone</span>'
                  : `Dist: ${pt.distanceToCableMeters}m`
              }</span>
            </div>
          </div>
        `;

        dotMarker.bindTooltip(tooltipHtml, {
          direction: 'top',
          offset: [0, -6],
          className: 'custom-shiptrack-leaflet-tooltip',
          opacity: 0.98,
        });

        dotMarker.on('mouseover', () => {
          dotMarker.setRadius(8);
          dotMarker.setStyle({ weight: 2.5, color: '#38bdf8' });
          setHoveredPoint(pt);
          if (onHoverPoint) onHoverPoint(pt);
        });

        dotMarker.on('mouseout', () => {
          dotMarker.setRadius(5.5);
          dotMarker.setStyle({ weight: 1.5, color: '#ffffff' });
          setHoveredPoint(null);
          if (onHoverPoint) onHoverPoint(null);
        });

        markersLayerRef.current?.addLayer(dotMarker);

        // Voyage Start & End Badges
        if (idx === 0) {
          const startBadge = L.divIcon({
            className: 'start-badge',
            html: `
              <div style="background: #10b981; color: white; font-size: 9px; font-weight: bold; border-radius: 10px; padding: 1px 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
                Voyage Start
              </div>
            `,
            iconSize: [65, 16],
            iconAnchor: [32, 22],
          });
          markersLayerRef.current?.addLayer(
            L.marker([pt.lat, pt.lng], { icon: startBadge, interactive: false })
          );
        } else if (idx === points.length - 1) {
          const endBadge = L.divIcon({
            className: 'end-badge',
            html: `
              <div style="background: #ef4444; color: white; font-size: 9px; font-weight: bold; border-radius: 10px; padding: 1px 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
                Voyage End
              </div>
            `,
            iconSize: [60, 16],
            iconAnchor: [30, 22],
          });
          markersLayerRef.current?.addLayer(
            L.marker([pt.lat, pt.lng], { icon: endBadge, interactive: false })
          );
        }
      });
    }

    // --- C. Fit Map Bounds Safely ---
    if (boundsPoints.length > 0) {
      try {
        const size = map.getSize();
        if (size.x > 0 && size.y > 0) {
          const latLngBounds = L.latLngBounds(boundsPoints);
          map.fitBounds(latLngBounds, {
            padding: [45, 45],
            maxZoom: 14,
            animate: false,
          });
        }
      } catch (e) {
        console.warn('fitBounds warning:', e);
      }
    }
  }, [cableRoute, summaryData, mapReady]);

  return (
    <div
      ref={outerContainerRef}
      className="relative w-full h-full min-h-[580px] lg:min-h-[660px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-xl select-none"
    >
      {/* Dedicated Leaflet Map Viewport Container */}
      <div
        ref={mapDivRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{ minHeight: '100%' }}
      />

      {/* Top Left: Map Controls & Base Map Switcher (Z-1000 above all Leaflet panes) */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2">
        <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/80 rounded-lg p-1 flex items-center shadow-lg">
          <button
            onClick={() => setActiveBaseMap('satellite')}
            className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition ${
              activeBaseMap === 'satellite'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setActiveBaseMap('dark')}
            className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition ${
              activeBaseMap === 'dark'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Dark Ocean
          </button>
          <button
            onClick={() => setActiveBaseMap('streets')}
            className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition ${
              activeBaseMap === 'streets'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Nautical / Map
          </button>
        </div>

        <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/80 rounded-lg p-1 flex items-center gap-1 shadow-lg">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            title="Zoom In"
            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            title="Zoom Out"
            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Right: Active Hovered Point Inspector HUD */}
      {hoveredPoint && (
        <div className="absolute top-3 right-3 z-[1000] max-w-xs bg-slate-900/95 border border-cyan-500/50 backdrop-blur-md rounded-lg p-3 shadow-2xl animate-fade-in text-xs text-slate-200 pointer-events-none">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-2">
            <span className="font-bold text-cyan-400 flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5" />
              AIS Track Fix Detail
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase"
              style={{ backgroundColor: getColorHex(hoveredPoint.dotColor) }}
            >
              {hoveredPoint.dotColor}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Local Time:</span>
              <span className="font-semibold text-slate-100">{hoveredPoint.localTimeStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Position:</span>
              <span className="font-mono text-slate-200">
                {hoveredPoint.lat.toFixed(5)}°, {hoveredPoint.lng.toFixed(5)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Nav Status:</span>
              <span className="font-semibold text-slate-100">{hoveredPoint.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Speed (SOG):</span>
              <span className="font-bold text-cyan-300">{hoveredPoint.sog.toFixed(1)} kts</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Corridor Zone:</span>
              {hoveredPoint.isInsideCableZone ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Inside {cableRoute.protectionCorridorMeters || 500}m Protection
                </span>
              ) : (
                <span className="text-emerald-400">{hoveredPoint.distanceToCableMeters}m from cable</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Legend Bar - Always visible across all zoom levels */}
      <div
        className="absolute bottom-3 left-3 right-3 z-[1200] pointer-events-auto select-none"
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3.5 py-2.5 rounded-lg shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Ship Track Status Legend:</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Red */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/30"></span>
              <span className="text-slate-300">
                <strong className="text-red-400">Red:</strong> Status = &quot;At Anchor&quot;
              </span>
            </div>

            {/* Green */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-500/30"></span>
              <span className="text-slate-300">
                <strong className="text-green-400">Green:</strong> Status = &quot;Under way using engine&quot;
              </span>
            </div>

            {/* Orange */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-orange-500/30"></span>
              <span className="text-slate-300">
                <strong className="text-orange-400">Orange:</strong> Inside Cable Zone &amp; SOG &lt; 5
              </span>
            </div>

            {/* Yellow */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-500 ring-2 ring-yellow-500/30"></span>
              <span className="text-slate-300">
                <strong className="text-yellow-400">Yellow:</strong> Inside Cable Zone &amp; SOG &gt;= 5
              </span>
            </div>

            {/* Cable Line & Corridor */}
            <div className="hidden sm:flex items-center gap-3 pl-2 border-l border-slate-700">
              <div className="flex items-center gap-1 text-cyan-400">
                <span className="w-4 h-1 bg-cyan-400 rounded"></span>
                <span>Cable Polyline</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <span className="w-4 h-2 border border-dashed border-amber-400 bg-amber-400/20 rounded-sm"></span>
                <span>{cableRoute.protectionCorridorMeters || 500}m Protection Zone</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
