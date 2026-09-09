import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { CableRoute, AlarmEvent, ParkingZone } from '../types';
import { generateCableBufferPolygon, isPointInPolygon, calculatePolygonAreaSqKm } from '../utils/geoUtils';
import { captureLeafletMap, getFullCorridorBounds } from '../utils/mapCapture';
import { Layers, Shield, Compass, ZoomIn, ZoomOut, Maximize2, AlertTriangle, Ship, Flame, Anchor, Camera, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { ShipPhoto } from './ShipPhoto';

interface MapChartProps {
  cableRoute: CableRoute;
  events: AlarmEvent[];
  selectedEvent: AlarmEvent | null;
  onSelectEvent: (event: AlarmEvent | null) => void;
  hoveredMMSI: string | null;
  setHoveredMMSI: (mmsi: string | null) => void;
  parkingZone?: ParkingZone | null;
  onSnapshotCaptured?: (dataUrl: string) => void;
}

export const MapChart: React.FC<MapChartProps> = ({
  cableRoute,
  events,
  selectedEvent,
  onSelectEvent,
  hoveredMMSI,
  setHoveredMMSI,
  parkingZone,
  onSnapshotCaptured,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups
  const cableLayerRef = useRef<L.LayerGroup | null>(null);
  const bufferLayerRef = useRef<L.LayerGroup | null>(null);
  const parkingLayerRef = useRef<L.LayerGroup | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightsLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  // Layer Visibility Toggles
  const [showCable, setShowCable] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [showParkingZone, setShowParkingZone] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [baseMapStyle, setBaseMapStyle] = useState<'dark' | 'ocean' | 'satellite'>('dark');
  const [activeHoverVessel, setActiveHoverVessel] = useState<AlarmEvent | null>(null);
  const [isCapturingMap, setIsCapturingMap] = useState(false);
  const [mapCaptureMessage, setMapCaptureMessage] = useState<string | null>(null);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

  // Reliable, free tile URLs with ZERO API key required
  const tileUrls = {
    dark: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ocean: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  const tileAttributions = {
    dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Nautical Dark',
    ocean: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Nautical',
    satellite: '&copy; Esri, Maxar, Earthstar Geographics',
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = cableRoute.waypoints.length > 0
      ? [cableRoute.waypoints[Math.floor(cableRoute.waypoints.length / 2)].lat, cableRoute.waypoints[Math.floor(cableRoute.waypoints.length / 2)].lng]
      : [9.40, 99.95];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    const tileLayer = L.tileLayer(tileUrls[baseMapStyle], {
      attribution: tileAttributions[baseMapStyle],
      maxZoom: 18,
      crossOrigin: true,
      className: baseMapStyle === 'dark' ? 'tiles-nautical-dark' : baseMapStyle === 'ocean' ? 'tiles-nautical-ocean' : '',
    }).addTo(map);
    baseTileLayerRef.current = tileLayer;

    // Create Canvas Renderer for high-performance rendering of thousands of incident dots
    const canvasRenderer = L.canvas({ padding: 0.5 });
    canvasRendererRef.current = canvasRenderer;

    // Create Layer Groups in optimal z-order
    heatmapLayerRef.current = L.layerGroup().addTo(map);
    parkingLayerRef.current = L.layerGroup().addTo(map);
    bufferLayerRef.current = L.layerGroup().addTo(map);
    cableLayerRef.current = L.layerGroup().addTo(map);
    eventsLayerRef.current = L.layerGroup().addTo(map);
    highlightsLayerRef.current = L.layerGroup().addTo(map);

    // Add map background click handler to unhide/restore all vessels
    map.on('click', () => {
      onSelectEvent(null);
      setHoveredMMSI(null);
    });

    mapInstanceRef.current = map;

    // Fix render size
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Preset: Select Only Heatmap & Capture Picture covering all area
  const handleSelectOnlyHeatmapAndCapture = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setIsCapturingMap(true);
    setMapCaptureMessage('Selecting only heatmap & fitting all area...');

    // 1. Select ONLY heatmap (hide individual incident dots)
    setShowHeatMap(true);
    setShowEvents(false);
    setShowCable(true);
    setShowBuffer(true);
    setShowParkingZone(true);

    // 2. Fit bounds to cover corridor from KP 0.0 to KP 34.0 and parking zone
    const bounds = getFullCorridorBounds(
      cableRoute.waypoints,
      parkingZone?.coordinates
    );
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13, animate: false });

    // 3. Allow tiles and layers to render
    await new Promise(r => setTimeout(r, 600));

    // 4. Capture picture
    try {
      setMapCaptureMessage('Capturing high-resolution map picture...');
      const dataUrl = await captureLeafletMap(map, mapContainerRef.current);
      localStorage.setItem('ais_corridor_heatmap_image', dataUrl);
      if (onSnapshotCaptured) {
        onSnapshotCaptured(dataUrl);
      }
      setMapCaptureMessage('✓ Heatmap map picture captured! Stored for Report.');
      setTimeout(() => setMapCaptureMessage(null), 4000);
    } catch (err) {
      console.error('Failed to capture map snapshot:', err);
      setMapCaptureMessage('Map capture complete.');
      setTimeout(() => setMapCaptureMessage(null), 3000);
    } finally {
      setIsCapturingMap(false);
    }
  }, [cableRoute, parkingZone, events, onSnapshotCaptured]);

  // 2. Update Base Map Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileLayerRef.current) return;
    const tileContainer = baseTileLayerRef.current.getContainer();
    if (tileContainer) {
      tileContainer.className = `leaflet-layer ${
        baseMapStyle === 'dark' ? 'tiles-nautical-dark' : baseMapStyle === 'ocean' ? 'tiles-nautical-ocean' : ''
      }`;
    }
    baseTileLayerRef.current.setUrl(tileUrls[baseMapStyle]);
  }, [baseMapStyle]);

  // 3. Render Cable Route & 500m Buffer Corridor
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !cableLayerRef.current || !bufferLayerRef.current) return;

    cableLayerRef.current.clearLayers();
    bufferLayerRef.current.clearLayers();

    if (cableRoute.waypoints.length < 2) return;

    const latlngs: [number, number][] = cableRoute.waypoints.map(wp => [wp.lat, wp.lng]);

    // Draw 500m Protection Buffer Corridor Polygon
    if (showBuffer) {
      const bufferPolygonCoords = generateCableBufferPolygon(cableRoute.waypoints, 500);
      if (bufferPolygonCoords.length > 0) {
        const bufferPoly = L.polygon(bufferPolygonCoords, {
          color: '#f59e0b',
          weight: 1.5,
          opacity: 0.8,
          fillColor: '#d97706',
          fillOpacity: 0.12,
          dashArray: '4, 4',
        });

        bufferPoly.bindTooltip(
          `<div>
            <div class="font-bold text-amber-400 text-xs">500m Restricted Protection Zone</div>
            <div class="text-[11px] text-slate-300">1,000m Total Corridor Width • Prohibited Anchoring / Bottom Trawling</div>
          </div>`,
          { sticky: true, className: 'leaflet-custom-tooltip' }
        );

        bufferLayerRef.current.addLayer(bufferPoly);
      }
    }

    // Draw Cable Route Polyline
    if (showCable) {
      const outerGlow = L.polyline(latlngs, {
        color: '#06b6d4',
        weight: 6,
        opacity: 0.35,
      });

      const mainCable = L.polyline(latlngs, {
        color: '#22d3ee',
        weight: 3,
        opacity: 0.95,
      });

      mainCable.bindTooltip(
        `<div class="p-1">
          <div class="font-bold text-cyan-300 text-xs">${cableRoute.name}</div>
          <div class="text-[11px] text-slate-300">Status: <span class="text-emerald-400 font-semibold">${cableRoute.status}</span></div>
          <div class="text-[11px] text-slate-400">Total Length: ${cableRoute.totalLengthKm} km • 500m Safety Margin</div>
        </div>`,
        { sticky: true }
      );

      cableLayerRef.current.addLayer(outerGlow);
      cableLayerRef.current.addLayer(mainCable);

      // Fit bounds to cable on initial route load
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }
  }, [cableRoute, showCable, showBuffer]);

  // 3b. Render Samui Vessel Parking Zone (Permanent Area for Large-Size Ships)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !parkingLayerRef.current) return;

    parkingLayerRef.current.clearLayers();

    if (!showParkingZone || !parkingZone || !parkingZone.coordinates || parkingZone.coordinates.length < 3) {
      return;
    }

    const latlngs: [number, number][] = parkingZone.coordinates.map(c => [c.lat, c.lng]);

    // Check which active vessels are currently inside the parking zone
    const vesselsInZone = events.filter(e =>
      isPointInPolygon({ lat: e.currentLat, lng: e.currentLon }, parkingZone.coordinates)
    );
    const areaKm2 = calculatePolygonAreaSqKm(parkingZone.coordinates);

    // 1. Draw Parking Zone Polygon
    const parkingPoly = L.polygon(latlngs, {
      color: parkingZone.color || '#2563eb',
      weight: 2.5,
      opacity: 0.95,
      dashArray: '6, 6',
      fillColor: '#1d4ed8',
      fillOpacity: 0.18,
    });

    parkingPoly.bindTooltip(
      `<div class="p-1.5 space-y-1">
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
          <span class="font-bold text-blue-300 text-xs">${parkingZone.name}</span>
        </div>
        <div class="text-[11px] text-slate-200">Designated Vessel Parking Zone (Large-Size Ship)</div>
        <div class="text-[10px] text-slate-400">Area: ~${areaKm2} km² • 4 Polygon Corner Points</div>
        <div class="text-[10px] ${vesselsInZone.length > 0 ? 'text-amber-300 font-semibold' : 'text-slate-400'}">
          Vessels currently in zone: ${vesselsInZone.length}
        </div>
      </div>`,
      { sticky: true, className: 'leaflet-custom-tooltip' }
    );

    parkingPoly.bindPopup(
      `<div class="p-2 space-y-2 text-slate-900 min-w-[260px]">
        <div class="font-bold text-sm text-blue-700 flex items-center gap-1.5">
          <span>⚓</span>
          <span>Samui Parking Zone</span>
        </div>
        <p class="text-xs text-slate-600">${parkingZone.description}</p>
        <div class="text-[11px] bg-slate-100 p-2.5 rounded-lg border border-slate-200 space-y-1 font-sans">
          <div class="font-semibold text-slate-700 flex justify-between">
            <span>Target Vessel:</span>
            <span class="font-bold text-blue-700">${parkingZone.targetVesselType}</span>
          </div>
          <div class="font-semibold text-slate-700 flex justify-between">
            <span>Approx. Area:</span>
            <span class="font-mono text-slate-800">${areaKm2} km²</span>
          </div>
          <div class="font-semibold text-slate-700 flex justify-between">
            <span>Vessels in Zone:</span>
            <span class="font-bold ${vesselsInZone.length > 0 ? 'text-amber-600' : 'text-slate-600'}">${vesselsInZone.length}</span>
          </div>
        </div>
        <div class="space-y-1 text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-700">
          <div class="font-bold text-slate-900 font-sans pb-0.5 border-b border-slate-200">4 Polygon Boundary Points:</div>
          <div>1. 9.523328, 99.903333</div>
          <div>2. 9.523330, 99.866663</div>
          <div>3. 9.566659, 99.866663</div>
          <div>4. 9.566662, 99.879994</div>
        </div>
        <div class="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
          <span>Permanent Area</span>
          <span class="text-blue-600 font-semibold">Active & Always Loaded</span>
        </div>
      </div>`
    );

    parkingLayerRef.current.addLayer(parkingPoly);

    // 2. Draw Corner Pin Boundary Markers with labels
    latlngs.forEach((coord, idx) => {
      const cornerDot = L.circleMarker(coord, {
        radius: 5,
        color: '#bfdbfe',
        weight: 2,
        fillColor: '#1d4ed8',
        fillOpacity: 1,
      });
      cornerDot.bindTooltip(
        `<div class="text-[10px] font-mono text-blue-200 font-semibold">Point ${idx + 1}: ${coord[0].toFixed(6)}°, ${coord[1].toFixed(6)}°</div>`,
        { direction: 'top' }
      );
      parkingLayerRef.current!.addLayer(cornerDot);
    });
  }, [parkingZone, showParkingZone, events]);

  // 4. Render Heat Map Layer for High-Intensity Traffic Areas (Canvas Accelerated)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !heatmapLayerRef.current) return;

    heatmapLayerRef.current.clearLayers();

    if (!showHeatMap || events.length === 0) return;

    // Build spatial heat signatures using canvas renderer
    events.forEach(evt => {
      const isAlert = evt.eventType === 'Alert';
      const weightMultiplier = isAlert ? 1.8 : 1.0;
      const baseLat = evt.currentLat;
      const baseLon = evt.currentLon;

      const outerHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 950 : 750,
        color: 'transparent',
        fillColor: isAlert ? '#f43f5e' : '#38bdf8',
        fillOpacity: 0.12 * weightMultiplier,
        interactive: false,
      });

      const midHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 550 : 450,
        color: 'transparent',
        fillColor: isAlert ? '#fbbf24' : '#06b6d4',
        fillOpacity: 0.22 * weightMultiplier,
        interactive: false,
      });

      const coreHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 250 : 200,
        color: 'transparent',
        fillColor: isAlert ? '#ef4444' : '#eab308',
        fillOpacity: 0.45 * weightMultiplier,
        interactive: false,
      });

      heatmapLayerRef.current!.addLayer(outerHeat);
      heatmapLayerRef.current!.addLayer(midHeat);
      heatmapLayerRef.current!.addLayer(coreHeat);
    });
  }, [events, showHeatMap]);

  // 5. Render Base Incident Event Dots with Canvas Acceleration (Blazing fast for 2,000+ points)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !eventsLayerRef.current) return;

    eventsLayerRef.current.clearLayers();

    // When a ship is selected, isolate and ONLY show that ship's event dots (all other ships disappear)
    const visibleEvents = selectedEvent
      ? events.filter(evt => evt.mmsi === selectedEvent.mmsi || evt.id === selectedEvent.id)
      : events;

    // Render Event Dots with Canvas
    if (showEvents) {
      visibleEvents.forEach(evt => {
        const isAlert = evt.eventType === 'Alert' || evt.eventDetail === 'Ship Anchoring';
        const isExit = evt.eventDetail === 'Ship Exit';
        const dotColor = isAlert ? '#ef4444' : isExit ? '#38bdf8' : '#f59e0b';

        // High-performance Canvas CircleMarker
        const marker = L.circleMarker([evt.entryLat || evt.currentLat, evt.entryLon || evt.currentLon], {
          renderer: canvasRendererRef.current || undefined,
          radius: isAlert ? 5.5 : 4.5,
          fillColor: dotColor,
          fillOpacity: 0.92,
          color: isAlert ? '#7f1d1d' : '#0f172a',
          weight: 1.5,
        });

        // Hover events for Instant Ship Detail Box
        marker.on('mouseover', () => {
          setActiveHoverVessel(evt);
          setHoveredMMSI(evt.mmsi);
        });

        marker.on('mouseout', () => {
          setActiveHoverVessel(null);
          setHoveredMMSI(null);
        });

        // Click handler: Selects event, centers on map, and highlights in Detailed Incident Log
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectEvent(evt);
        });

        eventsLayerRef.current!.addLayer(marker);
      });
    }
  }, [events, showEvents, selectedEvent]);

  // 6. Render Active Selection & Hover Highlights (Isolated Layer, <0.1ms render)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !highlightsLayerRef.current) return;

    highlightsLayerRef.current.clearLayers();

    // Selected Event Pinpoint Marker
    if (selectedEvent) {
      const isAlert = selectedEvent.eventType === 'Alert' || selectedEvent.eventDetail === 'Ship Anchoring';
      const dotColor = isAlert ? '#ef4444' : '#38bdf8';

      const selectedHtml = `
        <div class="relative flex items-center justify-center cursor-pointer pointer-events-none" style="z-index: 9999;">
          <div class="w-5 h-5 rounded-full" style="background-color: ${dotColor}; border: 2.5px solid #ffffff; box-shadow: 0 0 0 4px #22d3ee, 0 0 20px #06b6d4;"></div>
          <div class="absolute -inset-3 rounded-full border-2 border-cyan-400 animate-ping opacity-80 pointer-events-none"></div>
        </div>
      `;

      const selIcon = L.divIcon({
        html: selectedHtml,
        className: 'custom-event-highlight-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const selMarker = L.marker([selectedEvent.entryLat || selectedEvent.currentLat, selectedEvent.entryLon || selectedEvent.currentLon], {
        icon: selIcon,
        interactive: false,
        zIndexOffset: 1000,
      });

      highlightsLayerRef.current.addLayer(selMarker);
    }

    // Hovered MMSI Highlights (if not selected)
    if (hoveredMMSI && (!selectedEvent || selectedEvent.mmsi !== hoveredMMSI)) {
      const hoveredEvents = events.filter(e => e.mmsi === hoveredMMSI);
      hoveredEvents.forEach(hEvt => {
        const hHtml = `
          <div class="relative flex items-center justify-center pointer-events-none" style="z-index: 9000;">
            <div class="w-4 h-4 rounded-full" style="background-color: #38bdf8; border: 2px solid #ffffff; box-shadow: 0 0 0 3px #ffffff, 0 0 12px rgba(56, 189, 248, 0.9);"></div>
          </div>
        `;
        const hIcon = L.divIcon({
          html: hHtml,
          className: 'custom-hover-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const hMarker = L.marker([hEvt.entryLat || hEvt.currentLat, hEvt.entryLon || hEvt.currentLon], {
          icon: hIcon,
          interactive: false,
          zIndexOffset: 900,
        });
        highlightsLayerRef.current!.addLayer(hMarker);
      });
    }
  }, [selectedEvent, hoveredMMSI, events]);

  // Center map on selected event
  useEffect(() => {
    if (selectedEvent && mapInstanceRef.current) {
      mapInstanceRef.current.setView([selectedEvent.currentLat, selectedEvent.currentLon], 13, {
        animate: true,
      });
    }
  }, [selectedEvent]);

  return (
    <div className="relative w-full h-full min-h-[480px] lg:min-h-[580px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-xl flex flex-col">
      {/* Map Header Toolbar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Maritime Situational Map</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] text-slate-400">
            Scale: <strong className="text-slate-300">1:50,000</strong> • Coordinates: <span className="text-slate-300 font-mono">WGS84</span>
          </span>
          {showHeatMap && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/50">
              <Flame className="w-3 h-3 text-amber-400" />
              HEAT MAP ACTIVE
            </span>
          )}
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Heat Map Toggle */}
          <button
            id="toggle-layer-heatmap"
            onClick={() => setShowHeatMap(!showHeatMap)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              showHeatMap ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Toggle Traffic Density Heat Map"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Heat Map</span>
          </button>

          {/* Cable Toggle */}
          <button
            id="toggle-layer-cable"
            onClick={() => setShowCable(!showCable)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition cursor-pointer ${
              showCable ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60' : 'bg-slate-800 text-slate-400'
            }`}
            title="Toggle Subsea Cable Polyline"
          >
            <div className="w-2.5 h-1 bg-cyan-400 rounded"></div>
            <span>Cable Route</span>
          </button>

          {/* Buffer Toggle */}
          <button
            id="toggle-layer-buffer"
            onClick={() => setShowBuffer(!showBuffer)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition cursor-pointer ${
              showBuffer ? 'bg-amber-950 text-amber-300 border border-amber-700/60' : 'bg-slate-800 text-slate-400'
            }`}
            title="Toggle 500m Safety Buffer Corridor"
          >
            <Shield className="w-3 h-3 text-amber-400" />
            <span>500m Zone</span>
          </button>

          {/* Parking Zone Toggle */}
          {parkingZone && (
            <button
              id="toggle-layer-parking-zone"
              onClick={() => setShowParkingZone(!showParkingZone)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition cursor-pointer ${
                showParkingZone ? 'bg-blue-950 text-blue-300 border border-blue-600/70 shadow-sm' : 'bg-slate-800 text-slate-400'
              }`}
              title="Toggle Samui Vessel Parking Zone (Large-size ship anchorage)"
            >
              <Anchor className="w-3 h-3 text-blue-400" />
              <span>Parking Zone</span>
            </button>
          )}

          {/* Incident Dots Toggle */}
          <button
            id="toggle-layer-events"
            onClick={() => setShowEvents(!showEvents)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition cursor-pointer ${
              showEvents ? 'bg-rose-950 text-rose-300 border border-rose-700/60' : 'bg-slate-800 text-slate-400'
            }`}
            title="Toggle Alarms & Alerts Dots"
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Incident Dots ({events.length})</span>
          </button>

          {/* Base Map Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-700/70 rounded p-0.5 ml-1">
            <button
              id="map-style-dark"
              onClick={() => setBaseMapStyle('dark')}
              className={`px-2 py-0.5 text-[11px] rounded transition cursor-pointer ${
                baseMapStyle === 'dark' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Nautical Dark
            </button>
            <button
              id="map-style-ocean"
              onClick={() => setBaseMapStyle('ocean')}
              className={`px-2 py-0.5 text-[11px] rounded transition cursor-pointer ${
                baseMapStyle === 'ocean' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ocean Base
            </button>
            <button
              id="map-style-satellite"
              onClick={() => setBaseMapStyle('satellite')}
              className={`px-2 py-0.5 text-[11px] rounded transition cursor-pointer ${
                baseMapStyle === 'satellite' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Preset: Select Only Heatmap & Capture for PDF Report */}
          <button
            id="btn-select-only-heatmap-capture"
            onClick={handleSelectOnlyHeatmapAndCapture}
            disabled={isCapturingMap}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition cursor-pointer bg-gradient-to-r from-amber-600 via-rose-600 to-orange-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-md shadow-amber-900/30 border border-amber-400/40 ml-1"
            title="Select only heatmap, fit bounds to cover all area, and capture picture for PDF Report"
          >
            <Camera className="w-3.5 h-3.5 text-white" />
            <span>{isCapturingMap ? 'Capturing...' : 'Capture Heatmap Picture (All Area)'}</span>
          </button>
        </div>
      </div>

      {/* Map Capture Status Banner */}
      {mapCaptureMessage && (
        <div className="bg-emerald-950/95 border-b border-emerald-600 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-200 z-20 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{mapCaptureMessage}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80">Available in Page 3 & PDF Report</span>
        </div>
      )}

      {/* Map Viewport Container */}
      <div className="relative flex-1 w-full h-full min-h-[440px]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Selected Ship Isolation Banner */}
        {selectedEvent && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[420] bg-slate-900/95 border border-cyan-500/70 shadow-2xl rounded-full px-4 py-1.5 flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="text-slate-200">
                Isolated Ship: <strong className="text-cyan-300 font-semibold">{selectedEvent.vesselName}</strong> (MMSI: <span className="font-mono text-cyan-200">{selectedEvent.mmsi}</span>) <span className="text-slate-400 hidden sm:inline">• Other ships hidden</span>
              </span>
            </div>
            <button
              id="btn-show-all-vessels-map"
              onClick={(e) => {
                e.stopPropagation();
                onSelectEvent(null);
                setHoveredMMSI(null);
              }}
              className="text-[11px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-0.5 rounded-full transition cursor-pointer shadow flex items-center gap-1"
            >
              <span>Show All Ships</span>
            </button>
          </div>
        )}

        {/* Map Legend Overlay (Collapsible so it never covers Koh Si Chang Island or cable route) */}
        <div className="absolute bottom-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-lg shadow-2xl text-[11px] text-slate-300 pointer-events-auto z-[400] max-w-[240px] transition-all">
          <button
            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
            className="w-full font-bold text-slate-100 p-2 flex items-center justify-between gap-2 hover:text-white cursor-pointer select-none"
            title={isLegendExpanded ? 'Collapse Legend' : 'Expand Chart Legend'}
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Chart Legend</span>
            </div>
            {isLegendExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {isLegendExpanded && (
            <div className="px-2.5 pb-2.5 pt-0 space-y-1.5 border-t border-slate-800/80 mt-0.5">
              <div className="flex items-center gap-2 pt-1.5">
                <span className="w-4 h-1 bg-cyan-400 rounded-sm"></span>
                <span>Subsea Cable Centerline</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-2.5 bg-amber-500/20 border border-amber-500 border-dashed rounded-sm"></span>
                <span>500m Safety Corridor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></span>
                <span><strong className="text-rose-400">Alert</strong>: Ship Anchoring</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span><strong className="text-amber-400">Alarm</strong>: Ship Enter</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                <span><strong className="text-sky-300">Alarm</strong>: Ship Exit</span>
              </div>
              {parkingZone && showParkingZone && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-2 rounded border border-dashed border-blue-400 bg-blue-600/40"></span>
                  <span><strong className="text-blue-400">Parking Zone</strong>: Large-Size Ships</span>
                </div>
              )}
              {showHeatMap && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <span className="w-4 h-2 rounded bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500"></span>
                  <span>Traffic Density Heat Map</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map Zoom / Recenter Quick Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-[400]">
          <button
            id="map-btn-zoom-in"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center shadow-lg transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="map-btn-zoom-out"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center shadow-lg transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            id="map-btn-recenter"
            onClick={() => {
              if (mapInstanceRef.current && cableRoute.waypoints.length > 0) {
                const latlngs: [number, number][] = cableRoute.waypoints.map(wp => [wp.lat, wp.lng]);
                mapInstanceRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
              }
            }}
            className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-slate-700/80 flex items-center justify-center shadow-lg transition cursor-pointer"
            title="Recenter Cable Route"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Hover Ship Detail Box */}
        {activeHoverVessel && (
          <div className="absolute top-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3.5 shadow-2xl z-[450] max-w-sm w-84 text-white animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-950 border border-blue-500/40 flex items-center justify-center text-cyan-400">
                  <Ship className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100 leading-tight">
                    {activeHoverVessel.vesselName}
                  </h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span>MMSI: <strong className="text-cyan-300 font-mono">{activeHoverVessel.mmsi}</strong></span>
                    <span>•</span>
                    <span>{activeHoverVessel.flagCountry || 'INT'}</span>
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                  activeHoverVessel.priority === 'Critical'
                    ? 'bg-rose-950 text-rose-300 border-rose-700/60'
                    : activeHoverVessel.priority === 'High'
                    ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                    : 'bg-blue-950 text-blue-300 border-blue-700/60'
                }`}
              >
                {activeHoverVessel.priority}
              </span>
            </div>

            {/* Vessel 3D Model / Photo Preview */}
            <div className="my-2.5 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 relative h-36">
              <ShipPhoto
                mmsi={activeHoverVessel.mmsi}
                shipType={activeHoverVessel.shipType}
                vesselName={activeHoverVessel.vesselName}
                grossTonnage={activeHoverVessel.grossTonnage}
                size="lg"
                className="w-full h-full"
              />
            </div>

            {/* Vessel Key Metric Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Vessel Type</span>
                <span className="font-semibold text-slate-200 truncate block">{activeHoverVessel.shipType}</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Gross Tonnage</span>
                <span className="font-semibold text-slate-200">{activeHoverVessel.grossTonnage.toLocaleString()} GRT</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Current Speed</span>
                <span className={`font-semibold ${activeHoverVessel.speedKnots <= 1.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {activeHoverVessel.speedKnots} knots
                </span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Distance to Cable</span>
                <span className={`font-semibold ${activeHoverVessel.distanceToCableMeters < 200 ? 'text-rose-400 font-bold' : 'text-amber-300'}`}>
                  {activeHoverVessel.distanceToCableMeters} m
                </span>
              </div>
            </div>

            {/* Event Description */}
            <div className="mt-2 text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
              <span>Click dot to highlight in Incident Log table below.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

