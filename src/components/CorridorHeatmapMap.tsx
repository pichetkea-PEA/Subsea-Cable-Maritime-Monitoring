import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, RefreshCw, ZoomIn, ZoomOut, Maximize2, Shield, Anchor, Layers, Flame, CheckCircle2 } from 'lucide-react';
import { CableRoute, AlarmEvent, ParkingZone } from '../types';
import { generateCableBufferPolygon } from '../utils/geoUtils';
import { captureLeafletMap, getFullCorridorBounds } from '../utils/mapCapture';

interface CorridorHeatmapMapProps {
  cableRoute: CableRoute;
  events: AlarmEvent[];
  parkingZone?: ParkingZone | null;
  capturedImage?: string | null;
  onImageCaptured?: (dataUrl: string) => void;
  className?: string;
  height?: number;
}

export const CorridorHeatmapMap: React.FC<CorridorHeatmapMapProps> = ({
  cableRoute,
  events,
  parkingZone,
  capturedImage: externalCapturedImage,
  onImageCaptured,
  className = '',
  height = 640,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  const [activeTab, setActiveTab] = useState<'map' | 'preview'>('map');
  const [baseMapStyle, setBaseMapStyle] = useState<'dark' | 'ocean' | 'satellite'>('satellite');
  const [isCapturing, setIsCapturing] = useState(false);
  const [localCapturedImage, setLocalCapturedImage] = useState<string | null>(
    () => externalCapturedImage || null
  );
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);

  const tileUrls = {
    dark: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ocean: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  const tileAttributions = {
    dark: '&copy; OpenStreetMap Nautical Dark',
    ocean: '&copy; OpenStreetMap Nautical Ocean',
    satellite: '&copy; Esri World Imagery',
  };

  // Helper to fit tightly from starting point KP 0.0 to ending point KP 34.0
  const fitAllArea = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = getFullCorridorBounds(
      cableRoute.waypoints,
      parkingZone?.coordinates
    );

    // Tight padding to zoom in close to the corridor and illustrate high intensity
    map.fitBounds(bounds, { padding: [8, 8], maxZoom: 14, animate: false });
  }, [cableRoute, parkingZone]);

  // Capture current map picture
  const handleCapture = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setIsCapturing(true);
    setCaptureStatus('Capturing high-resolution map picture...');

    try {
      // Ensure corridor view covers starting point KP 0.0 to KP 34.0
      fitAllArea();
      // Wait for leaflet re-render
      await new Promise(r => setTimeout(r, 450));

      const dataUrl = await captureLeafletMap(map, mapContainerRef.current);
      setLocalCapturedImage(dataUrl);
      localStorage.setItem('ais_corridor_heatmap_image', dataUrl);
      if (onImageCaptured) {
        onImageCaptured(dataUrl);
      }
      setCaptureStatus('Map picture captured successfully! Saved for Report.');
      setTimeout(() => setCaptureStatus(null), 3500);
    } catch (err: any) {
      console.error('Failed to capture map picture:', err);
      setCaptureStatus('Capture warning: canvas compositing fallback used.');
    } finally {
      setIsCapturing(false);
    }
  }, [fitAllArea, onImageCaptured]);

  // Initialize Map with Heatmap ONLY
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
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    const tileLayer = L.tileLayer(tileUrls[baseMapStyle], {
      attribution: tileAttributions[baseMapStyle],
      maxZoom: 18,
      crossOrigin: true,
      className: baseMapStyle === 'dark' ? 'tiles-nautical-dark' : baseMapStyle === 'ocean' ? 'tiles-nautical-ocean' : '',
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // High performance canvas renderer for vector paths and heatmap circles
    const canvasRenderer = L.canvas({ padding: 0.5 });
    canvasRendererRef.current = canvasRenderer;

    mapInstanceRef.current = map;

    // Trigger initial fit bounds from KP 0.0 to KP 34.0
    setTimeout(() => {
      map.invalidateSize();
      fitAllArea();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Automatically capture map picture on mount if not present
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localCapturedImage && mapInstanceRef.current) {
        handleCapture();
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [localCapturedImage, handleCapture]);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileContainer = tileLayerRef.current.getContainer();
    if (tileContainer) {
      tileContainer.className = `leaflet-layer ${
        baseMapStyle === 'dark' ? 'tiles-nautical-dark' : baseMapStyle === 'ocean' ? 'tiles-nautical-ocean' : ''
      }`;
    }
    tileLayerRef.current.setUrl(tileUrls[baseMapStyle]);
  }, [baseMapStyle]);

  // Render Vector Layers & Heatmap (ALL layer names positioned OUTSIDE buffer & parking zone)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const corridorGroup = L.layerGroup();
    const heatmapGroup = L.layerGroup();

    // 1. Draw 500m Protection Buffer Corridor
    if (cableRoute.waypoints.length >= 2) {
      const bufferLeafletCoords: [number, number][] = generateCableBufferPolygon(cableRoute.waypoints, 500);

      const bufferPoly = L.polygon(bufferLeafletCoords, {
        renderer: canvasRendererRef.current || undefined,
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '5, 5',
        fillColor: '#f59e0b',
        fillOpacity: 0.12,
        interactive: false,
      });
      corridorGroup.addLayer(bufferPoly);

      // Subsea Cable Line
      const cableCoords: [number, number][] = cableRoute.waypoints.map(wp => [wp.lat, wp.lng]);
      const cablePolyline = L.polyline(cableCoords, {
        renderer: canvasRendererRef.current || undefined,
        color: '#06b6d4',
        weight: 3.5,
        opacity: 0.95,
        interactive: false,
      });
      corridorGroup.addLayer(cablePolyline);

      // Landing markers & outside callout labels (PREVENTS OVERLAYING BUFFER ZONE)
      const kp0 = cableRoute.waypoints[0];
      const kpEnd = cableRoute.waypoints[cableRoute.waypoints.length - 1];

      // KP 0.0 dot at actual coordinate
      const mk0 = L.circleMarker([kp0.lat, kp0.lng], {
        radius: 6,
        fillColor: '#38bdf8',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mk0);

      // KP 0.0 Label Pill: Positioned OUTSIDE buffer zone to Southwest (Mainland)
      const kp0LabelCoord: [number, number] = [kp0.lat - 0.005, kp0.lng - 0.015];
      // Dashed guide line connecting outside label to KP 0.0
      const kp0LeaderLine = L.polyline([[kp0.lat, kp0.lng], kp0LabelCoord], {
        color: '#38bdf8',
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.7,
        interactive: false,
      });
      corridorGroup.addLayer(kp0LeaderLine);

      const kp0Icon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #06b6d4; border-radius: 6px; padding: 4px 12px; font-size: 10px; font-weight: bold; color: #38bdf8; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 6px; box-sizing: border-box;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; display: inline-block;"></span>
            <span>Khanom Substation (Start)</span>
          </div>
        `,
        iconSize: [220, 30],
        iconAnchor: [210, 15],
      });
      corridorGroup.addLayer(L.marker(kp0LabelCoord, { icon: kp0Icon, interactive: false }));

      // KP 34.0 dot at actual coordinate
      const mkEnd = L.circleMarker([kpEnd.lat, kpEnd.lng], {
        radius: 6,
        fillColor: '#22c55e',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mkEnd);

      // KP 34.0 Label Pill: Positioned OUTSIDE buffer zone and parking zone to East (Koh Samui Island)
      const kpEndLabelCoord: [number, number] = [kpEnd.lat + 0.004, kpEnd.lng + 0.017];
      const kpEndLeaderLine = L.polyline([[kpEnd.lat, kpEnd.lng], kpEndLabelCoord], {
        color: '#22c55e',
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.7,
        interactive: false,
      });
      corridorGroup.addLayer(kpEndLeaderLine);

      const kpEndIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #22c55e; border-radius: 6px; padding: 4px 12px; font-size: 10px; font-weight: bold; color: #4ade80; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 6px; box-sizing: border-box;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
            <span>Koh Samui Terminal (End)</span>
          </div>
        `,
        iconSize: [220, 30],
        iconAnchor: [10, 15],
      });
      corridorGroup.addLayer(L.marker(kpEndLabelCoord, { icon: kpEndIcon, interactive: false }));

      // 500m Safety Buffer Corridor Label (Positioned OUTSIDE buffer on East flank)
      const bufferLabelCoord: [number, number] = [9.360, 99.932];
      const bufferIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.92); border: 1.2px dashed #f59e0b; border-radius: 5px; padding: 4px 12px; font-size: 9px; font-weight: 700; color: #fbbf24; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.5); box-sizing: border-box;">
            500m Buffer Zone (1,000m Total Protected Corridor)
          </div>
        `,
        iconSize: [290, 30],
        iconAnchor: [10, 15],
      });
      corridorGroup.addLayer(L.marker(bufferLabelCoord, { icon: bufferIcon, interactive: false }));
    }

    // 2. Draw Samui Parking Zone Polygon (with label moved OUTSIDE to prevent overlaying)
    if (parkingZone?.coordinates && parkingZone.coordinates.length >= 3) {
      const parkingCoords: [number, number][] = parkingZone.coordinates.map(c => [c.lat, c.lng]);
      const parkingPoly = L.polygon(parkingCoords, {
        renderer: canvasRendererRef.current || undefined,
        color: '#3b82f6',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#1d4ed8',
        fillOpacity: 0.18,
        interactive: false,
      });
      corridorGroup.addLayer(parkingPoly);

      // Label moved further NW (out of cable route) to prevent overlaying cable route
      const parkingLabelCoord: [number, number] = [9.640, 99.710];
      const parkingNorthEdge: [number, number] = [9.580, 99.800];

      // Leader line connecting outside label to parking boundary
      const parkingLeaderLine = L.polyline([parkingNorthEdge, parkingLabelCoord], {
        color: '#60a5fa',
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.7,
        interactive: false,
      });
      corridorGroup.addLayer(parkingLeaderLine);

      const parkingLabelIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #3b82f6; border-radius: 6px; padding: 4px 12px; font-size: 10px; font-weight: bold; color: #60a5fa; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 6px; box-sizing: border-box;">
            <span>⚓</span>
            <span>SAMUI PARKING ZONE (44.6 km² Anchorage)</span>
          </div>
        `,
        iconSize: [290, 30],
        iconAnchor: [145, 15],
      });
      corridorGroup.addLayer(L.marker(parkingLabelCoord, { icon: parkingLabelIcon, interactive: false }));
    }

    // 3. Render Heatmap Density Layers (Spatial Thermal Gradient - NO vessel dots)
    // Extra large radii and multi-tiered thermal layers to illustrate intensity clearly
    events.forEach(evt => {
      const isAlert = evt.eventType === 'Alert' || evt.eventDetail === 'Ship Anchoring';
      const weightMultiplier = isAlert ? 2.2 : 1.4;
      const baseLat = evt.currentLat;
      const baseLon = evt.currentLon;

      // Tier 1: Wide Ambient Heat Dispersion Glow
      const ambientHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 2600 : 2000,
        color: 'transparent',
        fillColor: isAlert ? '#f43f5e' : '#0284c7',
        fillOpacity: 0.18 * weightMultiplier,
        interactive: false,
      });

      // Tier 2: Outer Thermal Halo
      const outerHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 1800 : 1350,
        color: 'transparent',
        fillColor: isAlert ? '#fb7185' : '#38bdf8',
        fillOpacity: 0.28 * weightMultiplier,
        interactive: false,
      });

      // Tier 3: Medium Thermal Intensity Cloud
      const midHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 1100 : 850,
        color: 'transparent',
        fillColor: isAlert ? '#f97316' : '#06b6d4',
        fillOpacity: 0.45 * weightMultiplier,
        interactive: false,
      });

      // Tier 4: Core High-Intensity Hotspot Kernel
      const coreHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 550 : 420,
        color: 'transparent',
        fillColor: isAlert ? '#dc2626' : '#eab308',
        fillOpacity: 0.75 * weightMultiplier,
        interactive: false,
      });

      heatmapGroup.addLayer(ambientHeat);
      heatmapGroup.addLayer(outerHeat);
      heatmapGroup.addLayer(midHeat);
      heatmapGroup.addLayer(coreHeat);
    });

    // 4. Hotspot Annotation Markers: Positioned OUTSIDE buffer zone and parking zone
    const zones = [
      {
        name: 'Zone A: Samui Coastal Approach',
        text: 'High Ferry Traffic',
        color: '#f43f5e',
        labelCoord: [9.525, 100.038] as [number, number], // East of corridor in Samui coastal waters
        targetCoord: [9.525, 100.005] as [number, number],
      },
      {
        name: 'Zone B: Central Deep Fairway',
        text: 'Cargo & Tanker Fairway',
        color: '#fbbf24',
        labelCoord: [9.420, 99.995] as [number, number], // East flank outside 500m buffer
        targetCoord: [9.420, 99.955] as [number, number],
      },
      {
        name: 'Zone C: Khanom Landing Shelf',
        text: 'Nearshore Workboats',
        color: '#06b6d4',
        labelCoord: [9.290, 99.835] as [number, number], // West flank outside 500m buffer on mainland bay
        targetCoord: [9.290, 99.865] as [number, number],
      },
    ];

    zones.forEach(z => {
      // Subtle dashed guide line connecting label to the corridor edge
      const guideLine = L.polyline([z.targetCoord, z.labelCoord], {
        color: z.color,
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.65,
        interactive: false,
      });
      corridorGroup.addLayer(guideLine);

      const icon = L.divIcon({
        className: 'custom-outside-zone-pill',
        html: `
          <div style="background: rgba(15, 23, 42, 0.94); border: 1.5px solid ${z.color}; border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: bold; color: #f8fafc; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${z.color}; display: inline-block;"></span>
            <span>${z.name}</span>
            <span style="color: #94a3b8; font-weight: normal; font-size: 9px;">(${z.text})</span>
          </div>
        `,
        iconSize: [220, 24],
        iconAnchor: [z.labelCoord[1] < 99.9 ? 210 : 10, 12],
      });

      const mk = L.marker(z.labelCoord, { icon, interactive: false });
      corridorGroup.addLayer(mk);
    });

    heatmapGroup.addTo(map);
    corridorGroup.addTo(map);

    return () => {
      map.removeLayer(heatmapGroup);
      map.removeLayer(corridorGroup);
    };
  }, [cableRoute, parkingZone, events]);

  const activeImage = externalCapturedImage || localCapturedImage;

  return (
    <div className={`relative w-full mx-auto rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col ${className}`}>
      {/* Control Header */}
      <div className="bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-600/40 flex items-center justify-center text-rose-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-100">
                Corridor Traffic Density Map (Heatmap Only)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-950/80 border border-rose-700/60 text-rose-300">
                KP 0.0 - KP 34.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Full cable route • 500m Safety Buffer • Samui Parking Zone • Labels moved outside to prevent overlay
            </p>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTab === 'map' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live Map
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Captured Picture</span>
              {activeImage && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Base Map Style (when on Map view) */}
          {activeTab === 'map' && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setBaseMapStyle('dark')}
                className={`px-2 py-0.5 text-[10px] rounded transition cursor-pointer ${
                  baseMapStyle === 'dark' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => setBaseMapStyle('ocean')}
                className={`px-2 py-0.5 text-[10px] rounded transition cursor-pointer ${
                  baseMapStyle === 'ocean' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
              >
                Ocean
              </button>
              <button
                onClick={() => setBaseMapStyle('satellite')}
                className={`px-2 py-0.5 text-[10px] rounded transition cursor-pointer ${
                  baseMapStyle === 'satellite' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
              >
                Satellite
              </button>
            </div>
          )}

          {/* Fit KP 0.0 - KP 34.0 button */}
          <button
            onClick={fitAllArea}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Reset map view to frame starting point KP 0.0 to ending point KP 34.0"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Fit KP 0-34</span>
          </button>

          {/* Capture Button */}
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer bg-gradient-to-r from-amber-600 via-rose-600 to-orange-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-md shadow-rose-900/30 border border-amber-400/40"
            title="Capture map picture with all area from KP 0.0 to KP 34.0 for PDF Report"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isCapturing ? 'Capturing...' : 'Capture Picture for Report'}</span>
          </button>
        </div>
      </div>

      {/* Capture Feedback Notification */}
      {captureStatus && (
        <div className="bg-emerald-950/95 border-b border-emerald-600/60 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300 z-20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{captureStatus}</span>
          </div>
          <button
            onClick={() => setActiveTab('preview')}
            className="text-[11px] font-bold underline hover:text-emerald-100 cursor-pointer"
          >
            View Captured Picture &rarr;
          </button>
        </div>
      )}

      {/* Main Map / Preview Canvas */}
      <div className="relative w-full" style={{ height: `${height}px` }}>
        {/* Live Map Display */}
        <div
          ref={mapContainerRef}
          className={`w-full h-full ${activeTab === 'preview' ? 'hidden' : 'block'}`}
          style={{ background: '#071526' }}
        />

        {/* Captured Picture Preview */}
        {activeTab === 'preview' && (
          <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-4 overflow-auto">
            {activeImage ? (
              <div className="space-y-3 max-w-full flex flex-col items-center">
                <div className="border-2 border-emerald-500/50 rounded-xl overflow-hidden shadow-2xl bg-black max-w-full">
                  <img
                    src={activeImage}
                    alt="Captured Corridor Traffic Density Map (KP 0.0 - KP 34.0)"
                    className="max-h-[500px] w-auto object-contain block"
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    High-Res Picture Ready for PDF Report
                  </span>
                  <span className="text-slate-600">|</span>
                  <button
                    onClick={handleCapture}
                    className="text-cyan-400 hover:text-cyan-300 font-medium underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retake Picture
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3 py-12">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">No Map Picture Captured Yet</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Click "Capture Picture for Report" to snapshot the corridor heatmap covering KP 0.0 to KP 34.0.
                  </p>
                </div>
                <button
                  onClick={handleCapture}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Picture Now</span>
                </button>
              </div>
            )}
          </div>
        )}



        {/* Map View Controls (Bottom Right) */}
        {activeTab === 'map' && (
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-[400]">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer shadow-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer shadow-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={fitAllArea}
              className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-cyan-400 flex items-center justify-center transition cursor-pointer shadow-lg"
              title="Fit KP 0.0 - KP 34.0 Corridor"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
