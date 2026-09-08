import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CableRoute, AlarmEvent, ParkingZone } from '../types';
import { generateCableBufferPolygon } from '../utils/geoUtils';
import { getFullCorridorBounds } from '../utils/mapCapture';
import { Flame } from 'lucide-react';

interface ReportSatelliteHeatmapProps {
  cableRoute: CableRoute;
  events: AlarmEvent[];
  parkingZone?: ParkingZone;
  height?: number | string;
  className?: string;
}

export const ReportSatelliteHeatmap: React.FC<ReportSatelliteHeatmapProps> = ({
  cableRoute,
  events,
  parkingZone,
  height = 380,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  const fitBounds = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = getFullCorridorBounds(
      cableRoute.waypoints,
      parkingZone?.coordinates
    );
    map.fitBounds(bounds, { padding: [10, 10], maxZoom: 14, animate: false });
  }, [cableRoute, parkingZone]);

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

    // High-resolution Esri World Imagery (Satellite) Layer with anonymous CORS
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri World Imagery',
      maxZoom: 18,
      crossOrigin: 'anonymous',
    }).addTo(map);

    const canvasRenderer = L.canvas({ padding: 0.5 });
    canvasRendererRef.current = canvasRenderer;
    mapInstanceRef.current = map;

    // Trigger precise bounding fit
    const updateSizeAndBounds = () => {
      map.invalidateSize();
      fitBounds();
    };

    updateSizeAndBounds();
    const timer = setTimeout(updateSizeAndBounds, 150);

    // ResizeObserver ensures Leaflet recalculates and fills 100% frame on modal display / print pass
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateSizeAndBounds();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Draw Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const corridorGroup = L.layerGroup();
    const heatmapGroup = L.layerGroup();

    // 1. Draw 500m Safety Buffer Corridor
    if (cableRoute.waypoints.length >= 2) {
      const bufferCoords: [number, number][] = generateCableBufferPolygon(cableRoute.waypoints, 500);
      const bufferPoly = L.polygon(bufferCoords, {
        renderer: canvasRendererRef.current || undefined,
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '5, 5',
        fillColor: '#f59e0b',
        fillOpacity: 0.14,
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

      // KP 0.0 & KP End markers
      const kp0 = cableRoute.waypoints[0];
      const kpEnd = cableRoute.waypoints[cableRoute.waypoints.length - 1];

      // KP 0.0 dot
      const mk0 = L.circleMarker([kp0.lat, kp0.lng], {
        radius: 6,
        fillColor: '#38bdf8',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mk0);

      const kp0LabelCoord: [number, number] = [kp0.lat - 0.005, kp0.lng - 0.015];
      const kp0LeaderLine = L.polyline([[kp0.lat, kp0.lng], kp0LabelCoord], {
        color: '#38bdf8',
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.8,
        interactive: false,
      });
      corridorGroup.addLayer(kp0LeaderLine);

      const kp0Icon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.92); border: 1.5px solid #06b6d4; border-radius: 6px; padding: 3px 10px; font-size: 9.5px; font-weight: bold; color: #38bdf8; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.7); display: flex; align-items: center; gap: 5px; box-sizing: border-box;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; display: inline-block;"></span>
            <span>Khanom Substation</span>
          </div>
        `,
        iconSize: [160, 26],
        iconAnchor: [150, 13],
      });
      corridorGroup.addLayer(L.marker(kp0LabelCoord, { icon: kp0Icon, interactive: false }));

      // KP 34.0 dot
      const mkEnd = L.circleMarker([kpEnd.lat, kpEnd.lng], {
        radius: 6,
        fillColor: '#22c55e',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mkEnd);

      const kpEndLabelCoord: [number, number] = [kpEnd.lat + 0.004, kpEnd.lng + 0.017];
      const kpEndLeaderLine = L.polyline([[kpEnd.lat, kpEnd.lng], kpEndLabelCoord], {
        color: '#22c55e',
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.8,
        interactive: false,
      });
      corridorGroup.addLayer(kpEndLeaderLine);

      const kpEndIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.92); border: 1.5px solid #22c55e; border-radius: 6px; padding: 3px 10px; font-size: 9.5px; font-weight: bold; color: #4ade80; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.7); display: flex; align-items: center; gap: 5px; box-sizing: border-box;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
            <span>Koh Samui 2 Substation</span>
          </div>
        `,
        iconSize: [180, 26],
        iconAnchor: [10, 13],
      });
      corridorGroup.addLayer(L.marker(kpEndLabelCoord, { icon: kpEndIcon, interactive: false }));
    }

    // 2. Samui Vessel Parking Zone
    if (parkingZone?.coordinates && parkingZone.coordinates.length >= 3) {
      const parkingCoords: [number, number][] = parkingZone.coordinates.map(c => [c.lat, c.lng]);
      const parkingPoly = L.polygon(parkingCoords, {
        renderer: canvasRendererRef.current || undefined,
        color: '#3b82f6',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#1d4ed8',
        fillOpacity: 0.22,
        interactive: false,
      });
      corridorGroup.addLayer(parkingPoly);

      const parkingLabelCoord: [number, number] = [9.620, 99.730];
      const parkingNorthEdge: [number, number] = [9.560, 99.800];
      const parkingLeaderLine = L.polyline([parkingNorthEdge, parkingLabelCoord], {
        color: '#60a5fa',
        weight: 1.2,
        dashArray: '3, 3',
        opacity: 0.8,
        interactive: false,
      });
      corridorGroup.addLayer(parkingLeaderLine);

      const parkingLabelIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.92); border: 1.5px solid #3b82f6; border-radius: 6px; padding: 3px 10px; font-size: 9.5px; font-weight: bold; color: #60a5fa; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.7); display: flex; align-items: center; gap: 5px; box-sizing: border-box;">
            <span>⚓ Samui Vessel Parking Zone (44.6 km²)</span>
          </div>
        `,
        iconSize: [230, 26],
        iconAnchor: [10, 13],
      });
      corridorGroup.addLayer(L.marker(parkingLabelCoord, { icon: parkingLabelIcon, interactive: false }));
    }

    // 3. Multi-Tiered Compact Thermal Gradient Heatmap Density Layers (NO vessel dots)
    events.forEach(evt => {
      const isAlert = evt.eventType === 'Alert' || evt.eventDetail === 'Ship Anchoring';
      const weightMultiplier = isAlert ? 1.6 : 1.1;
      const baseLat = evt.currentLat;
      const baseLon = evt.currentLon;

      const ambientHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 1100 : 800,
        color: 'transparent',
        fillColor: isAlert ? '#f43f5e' : '#0284c7',
        fillOpacity: 0.16 * weightMultiplier,
        interactive: false,
      });

      const outerHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 750 : 500,
        color: 'transparent',
        fillColor: isAlert ? '#fb7185' : '#38bdf8',
        fillOpacity: 0.25 * weightMultiplier,
        interactive: false,
      });

      const midHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 450 : 300,
        color: 'transparent',
        fillColor: isAlert ? '#f97316' : '#06b6d4',
        fillOpacity: 0.40 * weightMultiplier,
        interactive: false,
      });

      const coreHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: isAlert ? 220 : 150,
        color: 'transparent',
        fillColor: isAlert ? '#dc2626' : '#eab308',
        fillOpacity: 0.65 * weightMultiplier,
        interactive: false,
      });

      heatmapGroup.addLayer(ambientHeat);
      heatmapGroup.addLayer(outerHeat);
      heatmapGroup.addLayer(midHeat);
      heatmapGroup.addLayer(coreHeat);
    });

    // Add heatmapGroup FIRST, then corridorGroup on TOP so cable line is easily visible!
    heatmapGroup.addTo(map);
    corridorGroup.addTo(map);

    return () => {
      map.removeLayer(corridorGroup);
      map.removeLayer(heatmapGroup);
    };
  }, [cableRoute, events, parkingZone]);

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-slate-700/80 shadow-md ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height, backgroundColor: '#07182b' }}
    >
      {/* Leaflet Satellite Container occupying absolute inset-0 */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
