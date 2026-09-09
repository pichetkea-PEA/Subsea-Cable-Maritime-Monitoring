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

  const isSamuiRoute = cableRoute.name.toLowerCase().includes('samui') || 
    (cableRoute.waypoints[0] && Math.abs(cableRoute.waypoints[0].lat - 9.4) < 0.6);

  const isSiChangRoute = cableRoute.name.toLowerCase().includes('sichang') ||
    cableRoute.name.toLowerCase().includes('si chang') ||
    cableRoute.waypoints.some(wp => Math.abs(wp.lat - 13.16) < 0.25 && Math.abs(wp.lng - 100.86) < 0.25);

  // Helper to fit tightly to the active cable corridor while ensuring all callout labels remain comfortably inside the map container
  const fitAllArea = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || cableRoute.waypoints.length === 0) return;

    const lats = cableRoute.waypoints.map(w => w.lat);
    const lngs = cableRoute.waypoints.map(w => w.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = Math.max(maxLat - minLat, 0.030);
    const lngSpan = Math.max(maxLng - minLng, 0.040);
    const safeSideOffset = Math.max(lngSpan * 0.28, 0.026);
    const safeNorthOffset = Math.max(latSpan * 0.55, 0.022);
    const safeSouthOffset = Math.max(latSpan * 0.55, 0.022);

    const kp0 = cableRoute.waypoints[0];
    const kpEnd = cableRoute.waypoints[cableRoute.waypoints.length - 1];
    const isKp0West = kp0.lng <= kpEnd.lng;

    const labelPoints = [
      { lat: kp0.lat, lng: isKp0West ? kp0.lng - safeSideOffset : kp0.lng + safeSideOffset },
      { lat: kpEnd.lat, lng: isKp0West ? kpEnd.lng + safeSideOffset : kpEnd.lng - safeSideOffset },
      { lat: maxLat + safeNorthOffset + 0.006, lng: (minLng + maxLng) / 2 },
      { lat: minLat - safeSouthOffset - 0.006, lng: minLng },
      { lat: minLat - safeSouthOffset - 0.006, lng: maxLng },
    ];

    const bounds = getFullCorridorBounds(
      cableRoute.waypoints,
      isSamuiRoute ? parkingZone?.coordinates : undefined,
      labelPoints
    );

    // Generous padding ensures all station pills and zone callout badges stay 100% inside the visible map view
    map.fitBounds(bounds, { padding: [45, 55], maxZoom: 14, animate: false });
  }, [cableRoute, parkingZone, isSamuiRoute]);

  // Capture current map picture
  const handleCapture = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setIsCapturing(true);
    setCaptureStatus('Capturing high-resolution map picture...');

    try {
      // Ensure corridor view covers starting point to ending point
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

    const totalWp = cableRoute.waypoints.length;
    const kp0 = cableRoute.waypoints[0];
    const kpEnd = cableRoute.waypoints[totalWp - 1];

    // Determine West vs East orientation
    const isKp0West = kp0.lng <= kpEnd.lng;

    let kp0StationName = 'Shore Terminal';
    let kpEndStationName = 'Island Terminal';

    if (isSiChangRoute) {
      // Koh Si Chang Island is on the WEST (Left, ~100.81°E)
      // Si Racha Mainland is on the EAST (Right, ~100.92°E)
      if (isKp0West) {
        kp0StationName = 'Koh Si Chang Island Terminal';
        kpEndStationName = 'Si Racha Mainland Terminal';
      } else {
        kp0StationName = 'Si Racha Mainland Terminal';
        kpEndStationName = 'Koh Si Chang Island Terminal';
      }
    } else if (isSamuiRoute) {
      // Khanom (Mainland) is on the WEST (~99.86°E)
      // Koh Samui (Island) is on the EAST (~100.00°E)
      if (isKp0West) {
        kp0StationName = 'Khanom Substation';
        kpEndStationName = 'Koh Samui 2 Substation';
      } else {
        kp0StationName = 'Koh Samui 2 Substation';
        kpEndStationName = 'Khanom Substation';
      }
    } else {
      const firstClean = kp0?.name && !kp0.name.startsWith('WP-') ? kp0.name.replace(/KP.*$/, '').trim() : null;
      const lastClean = kpEnd?.name && !kpEnd.name.startsWith('WP-') ? kpEnd.name.replace(/KP.*$/, '').trim() : null;
      kp0StationName = firstClean || cableRoute.mainlandStation || 'Mainland Shore Terminal';
      kpEndStationName = lastClean || cableRoute.islandStation || 'Island Receiving Terminal';
    }

    // Landing markers & outside callout labels calculations (Positioned completely outside cable route and buffer corridor)
    const lats = cableRoute.waypoints.length > 0 ? cableRoute.waypoints.map(w => w.lat) : [kp0.lat];
    const lngs = cableRoute.waypoints.length > 0 ? cableRoute.waypoints.map(w => w.lng) : [kp0.lng];
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = Math.max(maxLat - minLat, 0.030);
    const lngSpan = Math.max(maxLng - minLng, 0.040);

    // Safe offsets to guarantee zero intersection with 500m buffer and cable route
    const safeSideOffset = Math.max(lngSpan * 0.28, 0.026);
    const safeNorthOffset = Math.max(latSpan * 0.55, 0.022);
    const safeSouthOffset = Math.max(latSpan * 0.55, 0.022);

    // 1. Draw 500m Protection Buffer Corridor
    let kp0LabelCoord: [number, number] = [kp0.lat, kp0.lng];
    let kpEndLabelCoord: [number, number] = [kpEnd.lat, kpEnd.lng];
    let bufferLabelCoord: [number, number] = [kp0.lat, kp0.lng];

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

      // KP 0.0 dot at actual coordinate
      const mk0 = L.circleMarker([kp0.lat, kp0.lng], {
        radius: 6,
        fillColor: '#38bdf8',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mk0);

      const southOffset = Math.max(latSpan * 0.46, 0.022);
      const northOffset = Math.max(latSpan * 0.46, 0.022);
      const lngShift = Math.max(lngSpan * 0.08, 0.006);

      if (isKp0West) {
        // kp0 is West (Koh Si Chang Island Terminal) -> move SOUTH into clear bottom water
        kp0LabelCoord = [kp0.lat - southOffset, kp0.lng + lngShift];
        // kpEnd is East (Si Racha Mainland Terminal) -> move NORTH into clear upper area
        kpEndLabelCoord = [kpEnd.lat + northOffset, kpEnd.lng - lngShift];
      } else {
        // kp0 is East -> move NORTH
        kp0LabelCoord = [kp0.lat + northOffset, kp0.lng - lngShift];
        // kpEnd is West -> move SOUTH
        kpEndLabelCoord = [kpEnd.lat - southOffset, kpEnd.lng + lngShift];
      }

      const kp0LeaderLine = L.polyline(
        [[kp0.lat, kp0.lng], kp0LabelCoord],
        {
          color: '#38bdf8',
          weight: 1.5,
          dashArray: '3, 3',
          opacity: 0.85,
          interactive: false,
        }
      );
      corridorGroup.addLayer(kp0LeaderLine);

      const kp0Icon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #06b6d4; border-radius: 6px; padding: 4px 10px; font-size: 9.5px; font-weight: bold; color: #38bdf8; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 5px; box-sizing: border-box;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; display: inline-block; flex-shrink: 0;"></span>
            <span>${kp0StationName} (KP 0.0)</span>
          </div>
        `,
        iconSize: [170, 26],
        iconAnchor: isKp0West ? [85, 0] : [85, 26],
      });
      corridorGroup.addLayer(L.marker(kp0LabelCoord, { icon: kp0Icon, interactive: false }));

      // KP End dot at actual coordinate
      const mkEnd = L.circleMarker([kpEnd.lat, kpEnd.lng], {
        radius: 6,
        fillColor: '#22c55e',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mkEnd);

      const kpEndLeaderLine = L.polyline(
        [[kpEnd.lat, kpEnd.lng], kpEndLabelCoord],
        {
          color: '#22c55e',
          weight: 1.5,
          dashArray: '3, 3',
          opacity: 0.85,
          interactive: false,
        }
      );
      corridorGroup.addLayer(kpEndLeaderLine);

      const kpEndIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #22c55e; border-radius: 6px; padding: 4px 10px; font-size: 9.5px; font-weight: bold; color: #4ade80; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 5px; box-sizing: border-box;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block; flex-shrink: 0;"></span>
            <span>${kpEndStationName} (KP ${cableRoute.totalLengthKm || 'End'})</span>
          </div>
        `,
        iconSize: [180, 26],
        iconAnchor: isKp0West ? [90, 26] : [90, 0],
      });
      corridorGroup.addLayer(L.marker(kpEndLabelCoord, { icon: kpEndIcon, interactive: false }));

      // Safety Buffer Corridor Label (Positioned well to the North in open waters, clear of corridor)
      const midIdx = Math.floor(cableRoute.waypoints.length / 2);
      const midWp = cableRoute.waypoints[midIdx] || kp0;
      bufferLabelCoord = [maxLat + safeNorthOffset + 0.006, (minLng + maxLng) / 2];

      const bufferLeaderLine = L.polyline(
        [[maxLat + 0.005, (minLng + maxLng) / 2], [bufferLabelCoord[0] - 0.003, bufferLabelCoord[1]]],
        {
          color: '#f59e0b',
          weight: 1.2,
          dashArray: '3, 3',
          opacity: 0.75,
          interactive: false,
        }
      );
      corridorGroup.addLayer(bufferLeaderLine);

      const bufferIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.2px dashed #f59e0b; border-radius: 5px; padding: 4px 10px; font-size: 9px; font-weight: 700; color: #fbbf24; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.6); box-sizing: border-box;">
            ${cableRoute.protectionCorridorMeters || 500}m Buffer Zone (${(cableRoute.protectionCorridorMeters || 500) * 2}m Protected Corridor)
          </div>
        `,
        iconSize: [240, 26],
        iconAnchor: [120, 13],
      });
      corridorGroup.addLayer(L.marker(bufferLabelCoord, { icon: bufferIcon, interactive: false }));
    }

    // 2. Draw Samui Parking Zone Polygon ONLY if this is the Koh Samui circuit
    if (isSamuiRoute && parkingZone?.coordinates && parkingZone.coordinates.length >= 3) {
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

      // Label moved further NW to prevent overlaying cable route
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
    // Scale radii proportionally to corridor length
    const lengthScale = Math.max(0.35, Math.min(1.2, (cableRoute.totalLengthKm || 25) / 34));
    events.forEach(evt => {
      const isAlert = evt.eventType === 'Alert' || evt.eventDetail === 'Ship Anchoring';
      const weightMultiplier = isAlert ? 2.2 : 1.4;
      const baseLat = evt.currentLat;
      const baseLon = evt.currentLon;

      // Tier 1: Wide Ambient Heat Dispersion Glow
      const ambientHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 2600 : 2000) * lengthScale,
        color: 'transparent',
        fillColor: isAlert ? '#f43f5e' : '#0284c7',
        fillOpacity: 0.18 * weightMultiplier,
        interactive: false,
      });

      // Tier 2: Outer Thermal Halo
      const outerHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 1800 : 1350) * lengthScale,
        color: 'transparent',
        fillColor: isAlert ? '#fb7185' : '#38bdf8',
        fillOpacity: 0.28 * weightMultiplier,
        interactive: false,
      });

      // Tier 3: Medium Thermal Intensity Cloud
      const midHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 1100 : 850) * lengthScale,
        color: 'transparent',
        fillColor: isAlert ? '#f97316' : '#06b6d4',
        fillOpacity: 0.45 * weightMultiplier,
        interactive: false,
      });

      // Tier 4: Core High-Intensity Hotspot Kernel
      const coreHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 550 : 420) * lengthScale,
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

    // 4. Hotspot Annotation Markers: Geographically aligned to active circuit (Positioned away from cable route)
    let zones: { name: string; text: string; color: string; labelCoord: [number, number]; targetCoord: [number, number] }[] = [];

    const southLat = minLat - safeSouthOffset - 0.006;

    if (isSamuiRoute) {
      zones = [
        {
          name: 'Zone A: Samui Coastal Approach',
          text: 'High Ferry Traffic',
          color: '#f43f5e',
          labelCoord: [9.545, 100.050],
          targetCoord: [9.525, 100.005],
        },
        {
          name: 'Zone B: Central Deep Fairway',
          text: 'Cargo & Tanker Fairway',
          color: '#fbbf24',
          labelCoord: [9.420, 100.055],
          targetCoord: [9.420, 99.955],
        },
        {
          name: 'Zone C: Khanom Landing Shelf',
          text: 'Nearshore Workboats',
          color: '#06b6d4',
          labelCoord: [9.255, 99.835],
          targetCoord: [9.290, 99.865],
        },
      ];
    } else if (isSiChangRoute) {
      // Koh Si Chang Island is on the WEST (Left), Si Racha Mainland is on the EAST (Right)
      const westIdx = isKp0West ? Math.min(1, totalWp - 1) : Math.max(0, totalWp - 2);
      const eastIdx = isKp0West ? Math.max(0, totalWp - 2) : Math.min(1, totalWp - 1);
      const midIdx = Math.floor(totalWp * 0.5);

      const westPoint = cableRoute.waypoints[westIdx] || kp0;
      const eastPoint = cableRoute.waypoints[eastIdx] || kpEnd;
      const midPoint = cableRoute.waypoints[midIdx] || kp0;

      zones = [
        {
          name: 'Zone A: Koh Si Chang Approach',
          text: 'Island Coastal Waters',
          color: '#f43f5e',
          targetCoord: [westPoint.lat, westPoint.lng],
          labelCoord: [southLat, westPoint.lng + 0.006],
        },
        {
          name: 'Zone B: Channel Fairway',
          text: 'Commercial Fairway',
          color: '#fbbf24',
          targetCoord: [midPoint.lat, midPoint.lng],
          labelCoord: [southLat, midPoint.lng],
        },
        {
          name: 'Zone C: Si Racha Shore Shelf',
          text: 'Mainland Nearshore Shelf',
          color: '#06b6d4',
          targetCoord: [eastPoint.lat, eastPoint.lng],
          labelCoord: [southLat, eastPoint.lng - 0.006],
        },
      ];
    } else if (totalWp >= 3) {
      const westIdx = Math.floor(totalWp * 0.15);
      const midIdx = Math.floor(totalWp * 0.5);
      const eastIdx = Math.floor(totalWp * 0.85);

      const pWest = cableRoute.waypoints[westIdx];
      const pMid = cableRoute.waypoints[midIdx];
      const pEast = cableRoute.waypoints[eastIdx];

      const westName = isKp0West ? kp0StationName : kpEndStationName;
      const eastName = isKp0West ? kpEndStationName : kp0StationName;

      zones = [
        {
          name: `Zone A: ${westName.replace(/Terminal|Substation/i, '').trim()} Approach`,
          text: 'Coastal Approach',
          color: '#f43f5e',
          targetCoord: [pWest.lat, pWest.lng],
          labelCoord: [southLat, pWest.lng + 0.006],
        },
        {
          name: 'Zone B: Channel Fairway',
          text: 'Commercial Fairway',
          color: '#fbbf24',
          targetCoord: [pMid.lat, pMid.lng],
          labelCoord: [southLat, pMid.lng],
        },
        {
          name: `Zone C: ${eastName.replace(/Terminal|Substation/i, '').trim()} Shelf`,
          text: 'Nearshore Waters',
          color: '#06b6d4',
          targetCoord: [pEast.lat, pEast.lng],
          labelCoord: [southLat, pEast.lng - 0.006],
        },
      ];
    }

    zones.forEach(z => {
      // Subtle dashed guide line connecting label to the corridor edge
      const guideLine = L.polyline([z.targetCoord, z.labelCoord], {
        color: z.color,
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.75,
        interactive: false,
      });
      corridorGroup.addLayer(guideLine);

      const icon = L.divIcon({
        className: 'custom-outside-zone-pill',
        html: `
          <div style="background: rgba(15, 23, 42, 0.94); border: 1.5px solid ${z.color}; border-radius: 6px; padding: 3px 8px; font-size: 9.5px; font-weight: bold; color: #f8fafc; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px; box-sizing: border-box;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: ${z.color}; display: inline-block;"></span>
            <span>${z.name}</span>
            <span style="color: #94a3b8; font-weight: normal; font-size: 8.5px;">(${z.text})</span>
          </div>
        `,
        iconSize: [200, 24],
        iconAnchor: [100, 12],
      });

      const mk = L.marker(z.labelCoord, { icon, interactive: false });
      corridorGroup.addLayer(mk);
    });

    heatmapGroup.addTo(map);
    corridorGroup.addTo(map);

    // Ensure map fits all waypoints AND label coordinates with generous padding
    const allLabelPoints = [
      { lat: kp0LabelCoord[0], lng: kp0LabelCoord[1] },
      { lat: kpEndLabelCoord[0], lng: kpEndLabelCoord[1] },
      { lat: bufferLabelCoord[0], lng: bufferLabelCoord[1] },
      ...zones.map(z => ({ lat: z.labelCoord[0], lng: z.labelCoord[1] })),
    ];

    const boundsWithLabels = getFullCorridorBounds(
      cableRoute.waypoints,
      isSamuiRoute ? parkingZone?.coordinates : undefined,
      allLabelPoints
    );
    map.fitBounds(boundsWithLabels, { padding: [40, 50], maxZoom: 14, animate: false });

    return () => {
      map.removeLayer(heatmapGroup);
      map.removeLayer(corridorGroup);
    };
  }, [cableRoute, parkingZone, events, isSamuiRoute, isSiChangRoute]);

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
                KP 0.0 - {cableRoute.totalLengthKm ? `KP ${cableRoute.totalLengthKm}` : 'End'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {cableRoute.name} • {cableRoute.protectionCorridorMeters || 500}m Safety Buffer{isSamuiRoute ? ' • Samui Parking Zone' : ''} • Dynamic Focus
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
                    Click "Capture Picture for Report" to snapshot the corridor heatmap covering the active cable corridor.
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
              title="Fit Active Cable Corridor"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
