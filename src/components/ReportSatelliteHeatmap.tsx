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

  const isSamuiRoute = cableRoute.name.toLowerCase().includes('samui') || 
    (cableRoute.waypoints[0] && Math.abs(cableRoute.waypoints[0].lat - 9.4) < 0.6);

  const isSiChangRoute = cableRoute.name.toLowerCase().includes('sichang') ||
    cableRoute.name.toLowerCase().includes('si chang') ||
    cableRoute.waypoints.some(wp => Math.abs(wp.lat - 13.16) < 0.25 && Math.abs(wp.lng - 100.86) < 0.25);

  const fitBounds = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = getFullCorridorBounds(
      cableRoute.waypoints,
      isSamuiRoute ? parkingZone?.coordinates : undefined
    );
    map.fitBounds(bounds, { padding: [30, 40], maxZoom: 14, animate: false });
  }, [cableRoute, parkingZone, isSamuiRoute]);

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

    let kp0LabelCoord: [number, number] | null = null;
    let kpEndLabelCoord: [number, number] | null = null;

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
      const totalWp = cableRoute.waypoints.length;
      const kp0 = cableRoute.waypoints[0];
      const kpEnd = cableRoute.waypoints[totalWp - 1];
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

      // KP 0.0 dot
      const mk0 = L.circleMarker([kp0.lat, kp0.lng], {
        radius: 6,
        fillColor: '#38bdf8',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mk0);

      const lats = cableRoute.waypoints.map(w => w.lat);
      const lngs = cableRoute.waypoints.map(w => w.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const latSpan = Math.max(maxLat - minLat, 0.030);
      const lngSpan = Math.max(maxLng - minLng, 0.040);

      // Relocate labels strictly away from cable corridor and inside picture borders:
      // West terminal (Koh Si Chang Island) -> moved SOUTH into clear bottom water area
      // East terminal (Si Racha Mainland) -> moved NORTH into clear upper coastal area
      const southOffset = Math.max(latSpan * 0.46, 0.022);
      const northOffset = Math.max(latSpan * 0.46, 0.022);
      const lngShift = Math.max(lngSpan * 0.08, 0.006);

      if (isKp0West) {
        // kp0 is on the WEST (Koh Si Chang Island) -> move SOUTH into clear bottom water
        kp0LabelCoord = [kp0.lat - southOffset, kp0.lng + lngShift];
        // kpEnd is on the EAST (Si Racha Mainland) -> move NORTH into clear upper area
        kpEndLabelCoord = [kpEnd.lat + northOffset, kpEnd.lng - lngShift];
      } else {
        // kp0 is on the EAST -> move NORTH
        kp0LabelCoord = [kp0.lat + northOffset, kp0.lng - lngShift];
        // kpEnd is on the WEST -> move SOUTH
        kpEndLabelCoord = [kpEnd.lat - southOffset, kpEnd.lng + lngShift];
      }

      // Leader line for KP 0.0
      const kp0LeaderLine = L.polyline([[kp0.lat, kp0.lng], kp0LabelCoord], {
        color: '#38bdf8',
        weight: 1.5,
        dashArray: '3, 3',
        opacity: 0.85,
        interactive: false,
      });
      corridorGroup.addLayer(kp0LeaderLine);

      const kp0Icon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #06b6d4; border-radius: 6px; padding: 4px 10px; font-size: 9.5px; font-weight: bold; color: #38bdf8; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.85); display: flex; align-items: center; gap: 5px; box-sizing: border-box;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; display: inline-block; flex-shrink: 0;"></span>
            <span>${kp0StationName} (KP 0.0)</span>
          </div>
        `,
        iconSize: [170, 26],
        iconAnchor: isKp0West ? [85, 0] : [85, 26],
      });
      corridorGroup.addLayer(L.marker(kp0LabelCoord, { icon: kp0Icon, interactive: false }));

      // KP End dot
      const mkEnd = L.circleMarker([kpEnd.lat, kpEnd.lng], {
        radius: 6,
        fillColor: '#22c55e',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      });
      corridorGroup.addLayer(mkEnd);

      // Leader line for KP End
      const kpEndLeaderLine = L.polyline([[kpEnd.lat, kpEnd.lng], kpEndLabelCoord], {
        color: '#22c55e',
        weight: 1.5,
        dashArray: '3, 3',
        opacity: 0.85,
        interactive: false,
      });
      corridorGroup.addLayer(kpEndLeaderLine);

      const kpEndIcon = L.divIcon({
        className: 'custom-outside-label',
        html: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #22c55e; border-radius: 6px; padding: 4px 10px; font-size: 9.5px; font-weight: bold; color: #4ade80; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.85); display: flex; align-items: center; gap: 5px; box-sizing: border-box;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block; flex-shrink: 0;"></span>
            <span>${kpEndStationName} (KP ${cableRoute.totalLengthKm || 'End'})</span>
          </div>
        `,
        iconSize: [180, 26],
        iconAnchor: isKp0West ? [90, 26] : [90, 0],
      });
      corridorGroup.addLayer(L.marker(kpEndLabelCoord, { icon: kpEndIcon, interactive: false }));
    }

    // 2. Vessel Parking Zone (Only for Samui)
    if (isSamuiRoute && parkingZone?.coordinates && parkingZone.coordinates.length >= 3) {
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
    const lengthScale = Math.max(0.35, Math.min(1.2, (cableRoute.totalLengthKm || 25) / 34));
    events.forEach(evt => {
      const isAlert = evt.eventType === 'Alert' || evt.eventDetail === 'Ship Anchoring';
      const weightMultiplier = isAlert ? 1.6 : 1.1;
      const baseLat = evt.currentLat;
      const baseLon = evt.currentLon;

      const ambientHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 1100 : 800) * lengthScale,
        color: 'transparent',
        fillColor: isAlert ? '#f43f5e' : '#0284c7',
        fillOpacity: 0.16 * weightMultiplier,
        interactive: false,
      });

      const outerHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 750 : 500) * lengthScale,
        color: 'transparent',
        fillColor: isAlert ? '#fb7185' : '#38bdf8',
        fillOpacity: 0.25 * weightMultiplier,
        interactive: false,
      });

      const midHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 450 : 300) * lengthScale,
        color: 'transparent',
        fillColor: isAlert ? '#f97316' : '#06b6d4',
        fillOpacity: 0.40 * weightMultiplier,
        interactive: false,
      });

      const coreHeat = L.circle([baseLat, baseLon], {
        renderer: canvasRendererRef.current || undefined,
        radius: (isAlert ? 220 : 150) * lengthScale,
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

    // Fit bounds including route waypoints, parking zone (if Samui), and station label coordinates
    const labelPoints = (kp0LabelCoord && kpEndLabelCoord)
      ? [
          { lat: kp0LabelCoord[0], lng: kp0LabelCoord[1] },
          { lat: kpEndLabelCoord[0], lng: kpEndLabelCoord[1] },
        ]
      : undefined;

    const boundsWithLabels = getFullCorridorBounds(
      cableRoute.waypoints,
      isSamuiRoute ? parkingZone?.coordinates : undefined,
      labelPoints
    );
    map.fitBounds(boundsWithLabels, { padding: [30, 40], maxZoom: 14, animate: false });

    return () => {
      map.removeLayer(corridorGroup);
      map.removeLayer(heatmapGroup);
    };
  }, [cableRoute, events, parkingZone, isSamuiRoute, isSiChangRoute]);

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
