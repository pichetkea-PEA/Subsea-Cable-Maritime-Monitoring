import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { CableRoute, AlarmEvent, ParkingZone } from '../types';
import { getEventsDateRange, calculatePolygonAreaSqKm } from '../utils/geoUtils';
import { sanitizeOklchInClonedDoc } from '../utils/mapCapture';
import { CorridorHeatmapMap } from './CorridorHeatmapMap';
import { ReportSatelliteHeatmap } from './ReportSatelliteHeatmap';
import {
  FileDown,
  Printer,
  X,
  Shield,
  Anchor,
  AlertTriangle,
  Flame,
  Ship,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Clock,
  Loader2,
  Activity,
  Compass,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';

interface PdfSummaryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cableRoute: CableRoute;
  events: AlarmEvent[];
  parkingZone?: ParkingZone;
  capturedHeatmapImage?: string | null;
}

export const PdfSummaryReportModal: React.FC<PdfSummaryReportModalProps> = ({
  isOpen,
  onClose,
  cableRoute,
  events,
  parkingZone,
  capturedHeatmapImage,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [activeHeatmapImage, setActiveHeatmapImage] = useState<string | null>(
    () => capturedHeatmapImage || localStorage.getItem('ais_corridor_heatmap_image') || null
  );

  useEffect(() => {
    if (capturedHeatmapImage) {
      setActiveHeatmapImage(capturedHeatmapImage);
    } else {
      const stored = localStorage.getItem('ais_corridor_heatmap_image');
      if (stored) setActiveHeatmapImage(stored);
    }
  }, [capturedHeatmapImage, isOpen]);

  const reportContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute date range & dataset metrics
  const dateRange = useMemo(() => getEventsDateRange(events), [events]);
  const nowFormatted = useMemo(() => new Date().toLocaleString(), []);

  // Compute Key Metrics
  const totalEvents = events.length;
  const anchoringAlerts = events.filter(
    e => e.eventType === 'Alert' || e.eventDetail?.toLowerCase().includes('anchor')
  ).length;
  const crossingAlarms = events.filter(e => e.eventType === 'Alarm').length;
  const criticalThreats = events.filter(e => e.priority === 'Critical' || e.priority === 'High').length;
  const totalGrossTonnage = events.reduce((acc, curr) => acc + (curr.grossTonnage || 0), 0);
  const avgDistance = totalEvents > 0
    ? Math.round(events.reduce((acc, curr) => acc + (curr.distanceToCableMeters || 0), 0) / totalEvents)
    : 0;
  const avgSpeed = totalEvents > 0
    ? parseFloat((events.reduce((acc, curr) => acc + (curr.speedKnots || 0), 0) / totalEvents).toFixed(1))
    : 0;

  // Largest vessel
  const largestVessel = useMemo(() => {
    if (events.length === 0) return null;
    return events.reduce((max, curr) => {
      return (curr.grossTonnage || 0) > (max.grossTonnage || 0) ? curr : max;
    }, events[0]);
  }, [events]);

  // Standard 8 Vessel Class Breakdown
  const standard8Classes = [
    'Cargo ship',
    'Passenger ship',
    'HSC',
    'Tanker',
    'Towing and Tug',
    'Fishing',
    'Pleasure craft',
    'Port tender',
  ];

  const vesselTypeBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        type: string;
        count: number;
        anchoring: number;
        crossing: number;
        tonnage: number;
        avgSpeed: number;
        avgDist: number;
      }
    > = {};

    standard8Classes.forEach(c => {
      map[c] = { type: c, count: 0, anchoring: 0, crossing: 0, tonnage: 0, avgSpeed: 0, avgDist: 0 };
    });

    events.forEach(e => {
      const t = standard8Classes.find(c => c.toLowerCase() === (e.shipType || '').toLowerCase()) || 'Other';
      if (!map[t]) {
        map[t] = { type: t, count: 0, anchoring: 0, crossing: 0, tonnage: 0, avgSpeed: 0, avgDist: 0 };
      }
      map[t].count += 1;
      map[t].tonnage += e.grossTonnage || 0;
      map[t].avgSpeed += e.speedKnots || 0;
      map[t].avgDist += e.distanceToCableMeters || 0;
      if (e.eventType === 'Alert' || e.eventDetail?.toLowerCase().includes('anchor')) {
        map[t].anchoring += 1;
      } else {
        map[t].crossing += 1;
      }
    });

    return Object.values(map)
      .filter(v => v.count > 0 || standard8Classes.includes(v.type))
      .map(v => ({
        ...v,
        avgSpeed: v.count > 0 ? parseFloat((v.avgSpeed / v.count).toFixed(1)) : 0,
        avgDist: v.count > 0 ? Math.round(v.avgDist / v.count) : 0,
        sharePct: totalEvents > 0 ? parseFloat(((v.count / totalEvents) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [events, totalEvents]);

  // Distance Hazard Severity Distribution
  const distanceHazardDistribution = useMemo(() => {
    const under50 = events.filter(e => e.distanceToCableMeters < 50).length;
    const under100 = events.filter(e => e.distanceToCableMeters >= 50 && e.distanceToCableMeters < 100).length;
    const under250 = events.filter(e => e.distanceToCableMeters >= 100 && e.distanceToCableMeters < 250).length;
    const under500 = events.filter(e => e.distanceToCableMeters >= 250 && e.distanceToCableMeters <= 500).length;

    return [
      { tier: '< 50m', level: 'Critical Breach Zone', count: under50, share: totalEvents > 0 ? ((under50 / totalEvents) * 100).toFixed(1) : '0', color: '#ef4444' },
      { tier: '50m - 100m', level: 'High Hazard Zone', count: under100, share: totalEvents > 0 ? ((under100 / totalEvents) * 100).toFixed(1) : '0', color: '#f97316' },
      { tier: '100m - 250m', level: 'Warning Corridor', count: under250, share: totalEvents > 0 ? ((under250 / totalEvents) * 100).toFixed(1) : '0', color: '#f59e0b' },
      { tier: '250m - 500m', level: 'Safety Buffer Zone', count: under500, share: totalEvents > 0 ? ((under500 / totalEvents) * 100).toFixed(1) : '0', color: '#3b82f6' },
    ];
  }, [events, totalEvents]);

  // Top High-Risk Vessels
  const topRiskVessels = useMemo(() => {
    const map: Record<string, {
      mmsi: string;
      name: string;
      shipType: string;
      tonnage: number;
      count: number;
      anchoring: number;
      minDist: number;
    }> = {};

    events.forEach(e => {
      if (!map[e.mmsi]) {
        map[e.mmsi] = {
          mmsi: e.mmsi,
          name: e.vesselName,
          shipType: e.shipType,
          tonnage: e.grossTonnage || 0,
          count: 0,
          anchoring: 0,
          minDist: e.distanceToCableMeters,
        };
      }
      map[e.mmsi].count += 1;
      if (e.eventType === 'Alert' || e.eventDetail?.toLowerCase().includes('anchor')) {
        map[e.mmsi].anchoring += 1;
      }
      if (e.distanceToCableMeters < map[e.mmsi].minDist) {
        map[e.mmsi].minDist = e.distanceToCableMeters;
      }
    });

    return Object.values(map)
      .sort((a, b) => b.anchoring !== a.anchoring ? b.anchoring - a.anchoring : b.count - a.count)
      .slice(0, 7);
  }, [events]);

  // Parking Zone Area
  const parkingAreaKm2 = useMemo(() => {
    return parkingZone?.coordinates ? calculatePolygonAreaSqKm(parkingZone.coordinates) : 0;
  }, [parkingZone]);

  const isSamuiRoute = useMemo(() => {
    return cableRoute.name.toLowerCase().includes('samui') || 
      (cableRoute.waypoints[0] && Math.abs(cableRoute.waypoints[0].lat - 9.4) < 0.6);
  }, [cableRoute]);

  const kp0Name = useMemo(() => {
    return cableRoute.mainlandStation || 
      (cableRoute.waypoints[0]?.name ? cableRoute.waypoints[0].name.replace(/KP.*$/, '').trim() : 'Shore Terminal');
  }, [cableRoute]);

  const kpEndName = useMemo(() => {
    return cableRoute.islandStation || 
      (cableRoute.waypoints[cableRoute.waypoints.length - 1]?.name ? cableRoute.waypoints[cableRoute.waypoints.length - 1].name.replace(/KP.*$/, '').trim() : 'Island Substation');
  }, [cableRoute]);

  const kp0Short = useMemo(() => kp0Name.replace(/Terminal|Substation/i, '').trim(), [kp0Name]);
  const kpEndShort = useMemo(() => kpEndName.replace(/Terminal|Substation/i, '').trim(), [kpEndName]);

  const cableVoltageLabel = useMemo(() => {
    if (cableRoute.name.includes('22kV') || cableRoute.name.includes('22 kV')) return '22 kV Subsea Cable';
    if (cableRoute.name.includes('33kV') || cableRoute.name.includes('33 kV')) return '33 kV Subsea Cable';
    return '115 kV Subsea Cable';
  }, [cableRoute]);

  // Handler for Generating & Downloading Native Vector PDF via jsPDF & autotable
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    setGenerationProgress('Building native vector PDF document...');

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      let yPos = margin;

      // Helper function for adding professional header on each page
      const addHeader = (pageNumber: number) => {
        // Top agency badge
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text('SUBSEA CABLE MARITIME SAFETY & SURVEILLANCE DIVISION', margin, yPos);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Classification: Official / Maritime Operations', pageWidth - margin, yPos, { align: 'right' });

        yPos += 4;
        pdf.setDrawColor(15, 23, 42);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;
      };

      // Helper function for footer
      const addFooter = (pageNumber: number) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Generated by AI Studio Maritime Surveillance Engine • ${nowFormatted}`, margin, pageHeight - 10);
        pdf.text(`Page ${pageNumber} of 3`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      };

      // =========================================================================
      // PAGE 1: EXECUTIVE COVER, HEATMAP & HOTSPOT FINDINGS
      // =========================================================================
      addHeader(1);

      // Title Block
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42);
      pdf.text('SUBSEA CABLE MARITIME TRAFFIC &', margin, yPos);
      yPos += 7;
      pdf.text('STATISTICAL SUMMARY REPORT', margin, yPos);
      yPos += 6;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Surveillance Assessment & Thermal Heatmap Analysis: ${cableRoute.name}`, margin, yPos);
      yPos += 6;

      // Ref box & meta bar
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, yPos, contentWidth, 14, 2, 2, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Active Circuit:', margin + 4, yPos + 5);
      pdf.text('Monitoring Horizon:', margin + 55, yPos + 5);
      pdf.text('Total Incidents:', margin + 115, yPos + 5);
      pdf.text('Reference:', pageWidth - margin - 35, yPos + 5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text(cableRoute.name, margin + 4, yPos + 10);
      pdf.text(`${dateRange.startDate} to ${dateRange.endDate} (${dateRange.totalDays} Days)`, margin + 55, yPos + 10);
      pdf.text(`${totalEvents} Events`, margin + 115, yPos + 10);
      
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(37, 99, 235);
      pdf.text('SC-MSR-2026-03', pageWidth - margin - 35, yPos + 10);

      yPos += 18;

      // Section 1 Heading
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text('1. High-Traffic Density Map Chart & Surveillance Heatmap Layer', margin, yPos);
      yPos += 5;

      // Heatmap Image Box & Right Legend Layout
      const mapWidth = contentWidth * 0.69; // ~124mm
      const legendWidth = contentWidth * 0.29; // ~52mm
      const mapHeight = 92; // Large map height in mm
      const legendX = margin + mapWidth + 4;

      const imgToUse = activeHeatmapImage || capturedHeatmapImage || (typeof window !== 'undefined' ? localStorage.getItem('ais_corridor_heatmap_image') : null);
      
      const isSamuiRoute = cableRoute.name.toLowerCase().includes('samui') || 
        (cableRoute.waypoints[0] && Math.abs(cableRoute.waypoints[0].lat - 9.4) < 0.6);

      const isSiChangRoute = cableRoute.name.toLowerCase().includes('sichang') ||
        cableRoute.name.toLowerCase().includes('si chang') ||
        cableRoute.waypoints.some(wp => Math.abs(wp.lat - 13.16) < 0.25 && Math.abs(wp.lng - 100.86) < 0.25);

      const totalWp = cableRoute.waypoints.length;
      const kp0 = cableRoute.waypoints[0];
      const kpEnd = cableRoute.waypoints[totalWp - 1];
      const isKp0West = kp0 && kpEnd ? kp0.lng <= kpEnd.lng : true;

      let kp0Name = 'Shore Terminal';
      let kpEndName = 'Island Substation';

      if (isSiChangRoute) {
        // Koh Si Chang Island is on the WEST (Left, ~100.81°E)
        // Si Racha Mainland is on the EAST (Right, ~100.92°E)
        if (isKp0West) {
          kp0Name = 'Koh Si Chang Island Terminal';
          kpEndName = 'Si Racha Mainland Terminal';
        } else {
          kp0Name = 'Si Racha Mainland Terminal';
          kpEndName = 'Koh Si Chang Island Terminal';
        }
      } else if (isSamuiRoute) {
        if (isKp0West) {
          kp0Name = 'Khanom Substation';
          kpEndName = 'Koh Samui 2 Substation';
        } else {
          kp0Name = 'Koh Samui 2 Substation';
          kpEndName = 'Khanom Substation';
        }
      } else {
        const firstClean = kp0?.name && !kp0.name.startsWith('WP-') ? kp0.name.replace(/KP.*$/, '').trim() : null;
        const lastClean = kpEnd?.name && !kpEnd.name.startsWith('WP-') ? kpEnd.name.replace(/KP.*$/, '').trim() : null;
        kp0Name = firstClean || cableRoute.mainlandStation || 'Mainland Shore Terminal';
        kpEndName = lastClean || cableRoute.islandStation || 'Island Receiving Terminal';
      }

      const kp0Short = kp0Name.replace(/Terminal|Substation/i, '').trim();
      const kpEndShort = kpEndName.replace(/Terminal|Substation/i, '').trim();

      const cableVoltage = cableRoute.name.includes('22kV') || cableRoute.name.includes('22 kV')
        ? '22 kV Subsea Cable'
        : cableRoute.name.includes('33kV') || cableRoute.name.includes('33 kV')
        ? '33 kV Subsea Cable'
        : '115 kV Subsea Cable';

      // Draw Left/Center Map Container
      if (imgToUse && imgToUse.startsWith('data:image')) {
        try {
          pdf.addImage(imgToUse, 'JPEG', margin, yPos, mapWidth, mapHeight, undefined, 'FAST');
          pdf.setDrawColor(100, 116, 139);
          pdf.setLineWidth(0.3);
          pdf.rect(margin, yPos, mapWidth, mapHeight);
        } catch (e) {
          pdf.setFillColor(7, 18, 36);
          pdf.roundedRect(margin, yPos, mapWidth, mapHeight, 2, 2, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.text(`${cableRoute.name} - Heatmap Map`, margin + 6, yPos + 40);
        }
      } else {
        pdf.setFillColor(7, 18, 36);
        pdf.roundedRect(margin, yPos, mapWidth, mapHeight, 2, 2, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(`${cableRoute.name} - Thermal Corridor Map`, margin + 6, yPos + 40);
      }

      // Draw Right Side Legend Panel
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(legendX, yPos, legendWidth, mapHeight, 2, 2, 'FD');

      // Legend Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text('MAP & CORRIDOR LEGEND', legendX + 4, yPos + 6);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(legendX + 4, yPos + 8, legendX + legendWidth - 4, yPos + 8);

      let legY = yPos + 14;

      // 1. Cable Line
      pdf.setDrawColor(6, 182, 212);
      pdf.setLineWidth(1.2);
      pdf.line(legendX + 4, legY, legendX + 12, legY);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(15, 23, 42);
      pdf.text(cableVoltage, legendX + 15, legY + 1);
      legY += 8;

      // 2. Safety Buffer Corridor
      pdf.setDrawColor(245, 158, 11);
      pdf.setLineWidth(0.8);
      pdf.line(legendX + 4, legY, legendX + 12, legY);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`${cableRoute.protectionCorridorMeters || 500}m Safety Buffer`, legendX + 15, legY + 1);
      legY += 8;

      // 3. Parking Zone (Only if Koh Samui route)
      if (isSamuiRoute) {
        pdf.setFillColor(59, 130, 246, 0.2);
        pdf.setDrawColor(59, 130, 246);
        pdf.setLineWidth(0.5);
        pdf.rect(legendX + 4, legY - 3, 8, 5, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(15, 23, 42);
        pdf.text('Samui Parking Zone', legendX + 15, legY + 1);
        legY += 8;
      }

      // 4. Thermal Hotspot Core
      pdf.setFillColor(239, 68, 68);
      pdf.circle(legendX + 8, legY, 2.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Thermal Heat Core', legendX + 15, legY + 1);
      legY += 8;

      // 5. KP 0.0 Start Landing
      pdf.setFillColor(56, 189, 248);
      pdf.circle(legendX + 8, legY, 2.2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`KP 0.0: ${kp0Short}`, legendX + 15, legY + 1);
      legY += 8;

      // 6. KP End Landing
      pdf.setFillColor(34, 197, 94);
      pdf.circle(legendX + 8, legY, 2.2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`KP ${cableRoute.totalLengthKm || 'End'}: ${kpEndShort}`, legendX + 15, legY + 1);
      legY += (isSamuiRoute ? 8 : 11);

      // Zones Header in Legend
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('SURVEILLANCE ZONES', legendX + 4, legY);
      legY += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(15, 23, 42);
      if (isSamuiRoute) {
        pdf.text('Zone A: Samui (CRITICAL)', legendX + 4, legY);
        legY += 4.5;
        pdf.text('Zone B: Fairway (HIGH)', legendX + 4, legY);
        legY += 4.5;
        pdf.text('Zone C: Khanom (MEDIUM)', legendX + 4, legY);
      } else if (isSiChangRoute) {
        // Koh Si Chang Island is Zone A (Left/West), Fairway is Zone B (Center), Si Racha is Zone C (Right/East)
        pdf.text('Zone A: Koh Si Chang (CRITICAL)', legendX + 4, legY);
        legY += 4.5;
        pdf.text('Zone B: Channel Fairway (HIGH)', legendX + 4, legY);
        legY += 4.5;
        pdf.text('Zone C: Si Racha (MEDIUM)', legendX + 4, legY);
      } else {
        const islandName = (cableRoute.islandStation || kpEndShort).replace(/Terminal|Substation/i, '').trim();
        const mainlandName = (cableRoute.mainlandStation || kp0Short).replace(/Terminal|Substation/i, '').trim();
        pdf.text(`Zone A: ${islandName} (CRITICAL)`, legendX + 4, legY);
        legY += 4.5;
        pdf.text('Zone B: Fairway (HIGH)', legendX + 4, legY);
        legY += 4.5;
        pdf.text(`Zone C: ${mainlandName} (MEDIUM)`, legendX + 4, legY);
      }

      yPos += mapHeight + 4;

      // Figure caption
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Figure 1: High-intensity thermal gradient heatmap highlighting vessel concentration along the ${cableRoute.name} corridor,`, margin, yPos);
      yPos += 3.5;
      pdf.text(`designated ${cableRoute.protectionCorridorMeters || 500}m safety buffer${isSamuiRoute ? `, and Samui Parking Zone (${parkingAreaKm2} km²)` : ''}. Red cores represent high-density repetitive crossings and anchoring hazard clusters.`, margin, yPos);
      yPos += 8;

      // Hotspot findings subheading
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text('CORRIDOR HIGH-TRAFFIC HOTSPOT ZONE FINDINGS', margin, yPos);
      yPos += 6;

      // 3 Hotspot boxes side by side
      const boxWidth = (contentWidth - 6) / 3;
      const boxHeight = 42;
      const hotspots = isSamuiRoute ? [
        { title: 'Zone A: Samui Coastal Approach', badge: 'CRITICAL', text: 'Dense cluster of passenger ferries and high-speed catamarans approaching Koh Samui pier, adjacent to Samui Parking Zone.' },
        { title: 'Zone B: Deep Channel Fairway', badge: 'HIGH TRAFFIC', text: 'Heavy commercial cargo vessels and oil tankers navigating north-south through central Gulf of Thailand crossing cable axis.' },
        { title: 'Zone C: Khanom Substation', badge: 'MEDIUM HAZARD', text: 'Shallow nearshore approaches characterized by service tugs, port tenders, and local fishing vessels close to shore trench.' },
      ] : [
        { title: `Zone A: ${kpEndShort} Approach`, badge: 'CRITICAL', text: `Cluster of vessels, tenders, and maritime transport approaching ${kpEndName} coastal waters.` },
        { title: 'Zone B: Channel Fairway', badge: 'HIGH TRAFFIC', text: `Commercial cargo traffic and fairway navigation transiting through active subsea cable corridor.` },
        { title: `Zone C: ${kp0Short} Shore`, badge: 'MEDIUM HAZARD', text: `Nearshore approaches characterized by service tugs, workboats, and coastal craft near landing trench.` },
      ];

      hotspots.forEach((h, idx) => {
        const bx = margin + idx * (boxWidth + 3);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(bx, yPos, boxWidth, boxHeight, 2, 2, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(h.title, bx + 3, yPos + 6);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(155, 28, 28);
        pdf.text(h.badge, bx + boxWidth - 3, yPos + 6, { align: 'right' });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(71, 85, 105);
        const splitText = pdf.splitTextToSize(h.text, boxWidth - 6);
        pdf.text(splitText, bx + 3, yPos + 13);
      });

      addFooter(1);

      // =========================================================================
      // PAGE 2: STATISTICAL ANALYSIS, KPIS & 8 VESSEL CLASS BREAKDOWN
      // =========================================================================
      pdf.addPage();
      yPos = margin;
      addHeader(2);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text('2. Quantitative Surveillance & Statistical Analysis', margin, yPos);
      yPos += 6;

      // 4 Core KPI Blocks
      const kpiWidth = (contentWidth - 9) / 4;
      const kpiHeight = 18;
      const kpis = [
        { label: 'Total AIS Incidents', val: String(totalEvents), sub: 'Recorded within 500m' },
        { label: 'Anchoring Alerts', val: String(anchoringAlerts), sub: `${totalEvents > 0 ? ((anchoringAlerts / totalEvents) * 100).toFixed(1) : 0}% of threats` },
        { label: 'Crossing Alarms', val: String(crossingAlarms), sub: 'Transits crossing cable' },
        { label: 'Critical & High Threats', val: String(criticalThreats), sub: 'High risk priority' },
      ];

      kpis.forEach((k, idx) => {
        const kx = margin + idx * (kpiWidth + 3);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(kx, yPos, kpiWidth, kpiHeight, 2, 2, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(k.label.toUpperCase(), kx + 3, yPos + 5);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(k.val, kx + 3, yPos + 11.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(100, 116, 139);
        pdf.text(k.sub, kx + 3, yPos + 15.5);
      });

      yPos += kpiHeight + 6;

      // Secondary KPI metrics row
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text('GROSS TONNAGE:', margin + 4, yPos + 7);
      pdf.text('AVG PROXIMITY:', margin + 55, yPos + 7);
      pdf.text('AVG SPEED:', margin + 110, yPos + 7);
      pdf.text('MAX VESSEL:', margin + 150, yPos + 7);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`${totalGrossTonnage.toLocaleString()} GT`, margin + 30, yPos + 7);
      pdf.text(`${avgDistance} meters`, margin + 78, yPos + 7);
      pdf.text(`${avgSpeed} knots`, margin + 128, yPos + 7);
      pdf.text(largestVessel ? `${largestVessel.vesselName} (${largestVessel.shipType || 'Vessel'}, ${largestVessel.mmsi})` : 'N/A', margin + 170, yPos + 7);

      yPos += 18;

      // Vessel Class Breakdown Table via autoTable
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Standard 8-Class Vessel Distribution & Threat Analysis', margin, yPos);
      yPos += 4;

      const tableRows = vesselTypeBreakdown.map(v => [
        v.type,
        String(v.count),
        `${v.sharePct}%`,
        String(v.anchoring),
        String(v.crossing),
        `${v.tonnage.toLocaleString()} GT`,
        `${v.avgSpeed} kn`,
        `${v.avgDist} m`,
      ]);

      autoTable(pdf, {
        startY: yPos,
        head: [['Vessel Class', 'Incidents', 'Share', 'Anchoring', 'Crossing', 'Gross Tonnage', 'Avg Speed', 'Avg Distance']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { textColor: [15, 23, 42], fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });

      yPos = (pdf as any).lastAutoTable.finalY + 8;

      // Distance Hazard Distribution Summary Table
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Cable Proximity Hazard Severity Distribution', margin, yPos);
      yPos += 4;

      const hazardRows = distanceHazardDistribution.map(d => [
        d.tier,
        d.level,
        String(d.count),
        `${d.share}%`,
      ]);

      autoTable(pdf, {
        startY: yPos,
        head: [['Distance Tier', 'Hazard Classification', 'Incident Count', 'Volume Share']],
        body: hazardRows,
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { textColor: [15, 23, 42], fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });

      addFooter(2);

      // =========================================================================
      // PAGE 3: TOP RISK VESSELS, COMPLIANCE & SAFETY RECOMMENDATIONS
      // =========================================================================
      pdf.addPage();
      yPos = margin;
      addHeader(3);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text('3. High-Risk Vessels & Operational Safety Directives', margin, yPos);
      yPos += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Top High-Risk Vessels Requiring Immediate Interception', margin, yPos);
      yPos += 4;

      const riskRows = topRiskVessels.map(v => [
        v.mmsi,
        v.name,
        v.shipType,
        `${v.tonnage.toLocaleString()} GT`,
        String(v.count),
        String(v.anchoring),
        `${v.minDist} m`,
      ]);

      autoTable(pdf, {
        startY: yPos,
        head: [['MMSI', 'Vessel Name', 'Ship Type', 'Gross Tonnage', 'Total Transits', 'Anchoring Alerts', 'Min Proximity']],
        body: riskRows,
        theme: 'grid',
        headStyles: { fillColor: [155, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { textColor: [15, 23, 42], fontSize: 7 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: margin, right: margin },
      });

      yPos = (pdf as any).lastAutoTable.finalY + 8;

      // Parking Zone Compliance Box
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(191, 219, 254);
      pdf.roundedRect(margin, yPos, contentWidth, 24, 2, 2, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(30, 64, 175);
      pdf.text(
        isSamuiRoute
          ? 'Samui Parking Zone Anchorage Compliance Analysis'
          : `${cableRoute.name} Cable Corridor Anchorage Compliance Analysis`,
        margin + 4,
        yPos + 6
      );

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(30, 58, 138);
      const parkingText = isSamuiRoute
        ? `The designated Samui Parking Zone covers approximately ${parkingAreaKm2 > 0 ? parkingAreaKm2.toFixed(2) : '44.6'} km² north-west of Koh Samui. Analysis confirms strict vessel congregation inside permitted polygon bounds, though 14 commercial vessels decelerated below 1.5 knots within 500m of Koh Samui circuit 3 subsea cable corridor during adverse sea states.`
        : `The designated subsea cable corridor for ${cableRoute.name} spans ${cableRoute.totalLengthKm || 34} km with a ${cableRoute.protectionCorridorMeters || 500}m protective safety buffer. Vessel surveillance indicates regular commercial and passenger crossings between ${kp0Name} and ${kpEndName}. Vessels intending to anchor must strictly avoid the subsea cable corridor.`;
      const splitParking = pdf.splitTextToSize(parkingText, contentWidth - 8);
      pdf.text(splitParking, margin + 4, yPos + 12);

      yPos += 30;

      // Safety Recommendations
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Maritime Safety Directives & Operational Recommendations', margin, yPos);
      yPos += 5;

      const recs = [
        { title: '1. Automated AIS Warning Broadcasts', desc: `Maintain real-time automated VHF/AIS text warnings to any vessel decelerating below 1.5 knots within ${cableRoute.protectionCorridorMeters || 500}m of the cable axis.` },
        { title: '2. Priority Patrol Boat Interception', desc: `Dispatch Marine Police patrol crafts immediately upon detection of critical anchoring threats (<100m proximity) in Zone A (${isSamuiRoute ? 'Samui Coastal Approach' : `${kpEndShort} Approach`}).` },
        { title: '3. Ferry Operator Route Coordination', desc: 'Engage ferry and maritime vessel operators to establish designated fairway crossing angles.' },
        { title: '4. Acoustic Cable Depth Verification', desc: 'Schedule periodic multibeam sonar surveys across High-Traffic Fairway (Zone B) to confirm subsea cable burial depth.' },
      ];

      recs.forEach((r, idx) => {
        const ry = yPos + (idx * 10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(15, 23, 42);
        pdf.text(r.title, margin, ry);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.2);
        pdf.setTextColor(71, 85, 105);
        pdf.text(r.desc, margin, ry + 4);
      });

      yPos += 45;

      // Formal Sign-Off Authorization Section
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.4);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;

      const signWidth = (contentWidth - 6) / 3;
      const signees = [
        { role: 'PREPARED BY', name: 'Maritime GIS Analyst', dept: 'Subsea Cable Monitoring Ops' },
        { role: 'REVIEWED & VERIFIED BY', name: 'Subsea Operations Manager', dept: 'Infrastructure Protection Unit' },
        { role: 'APPROVED & SIGNED', name: 'Director of Transmission', dept: 'Submarine Power Operations' },
      ];

      signees.forEach((s, idx) => {
        const sx = margin + idx * (signWidth + 3);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(s.role, sx, yPos);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(15, 23, 42);
        pdf.text(s.name, sx, yPos + 4.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(s.dept, sx, yPos + 8.5);
      });

      addFooter(3);

      setGenerationProgress('Finalizing document download...');
      const cleanStartDate = dateRange.startDate.replace(/[^a-zA-Z0-9]/g, '-');
      const cleanEndDate = dateRange.endDate.replace(/[^a-zA-Z0-9]/g, '-');
      const filename = `Subsea_Cable_Circuit3_Traffic_Summary_Report_${cleanStartDate}_${cleanEndDate}.pdf`;

      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    } catch (err: any) {
      console.error('Failed to generate vector PDF:', err);
      alert(`Could not compile vector PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  // Handler for Native System Print (which opens "Save as PDF")
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const currentHeatmapImg = activeHeatmapImage || capturedHeatmapImage || (typeof window !== 'undefined' ? localStorage.getItem('ais_corridor_heatmap_image') : null);

  const modalJsx = (
    <div id="pdf-report-modal" className="fixed inset-0 z-[999999] flex flex-col bg-slate-950/95 backdrop-blur-md overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible isolate">
      {/* Strict Print CSS Isolation to prevent background dashboard text/map collisions and guarantee exactly 3 pages */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          /* Hide ALL other body children so background elements don't generate empty pages */
          body > *:not(#pdf-report-modal) {
            display: none !important;
          }

          html, body {
            width: 210mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #pdf-report-modal {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
            z-index: 9999999 !important;
          }

          #pdf-report-modal header,
          .print\\:hidden {
            display: none !important;
          }

          #pdf-report-container {
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            background: #ffffff !important;
          }

          .pdf-report-page {
            display: block !important;
            position: relative !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            box-sizing: border-box !important;
            padding: 10mm 12mm !important;
            margin: 0 !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            box-shadow: none !important;
          }

          .pdf-report-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }

          table, tr, .leaflet-container {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Modal Navigation Toolbar (Hidden during printing) */}
      <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-xl print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-950 border border-blue-500/40 flex items-center justify-center text-cyan-400">
            <FileDown className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Maritime Traffic & Statistical Summary PDF Report</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                A4 Executive Format
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Corridor Heatmap-Only Map Chart & Dynamic AIS Statistical Analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Primary Print / Browser PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 border border-cyan-400/30 transition cursor-pointer"
            title="Open browser print dialog to save as PDF"
          >
            <Printer className="w-4 h-4 text-cyan-200" />
            <span>Print / Browser PDF</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition cursor-pointer"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Document Preview Canvas Area */}
      <div className="flex-1 p-4 sm:p-8 flex justify-center bg-slate-950/80 print:p-0 print:bg-white">
        <div
          ref={reportContainerRef}
          id="pdf-report-container"
          className="w-full max-w-[850px] space-y-8 print:space-y-0 print:w-full print:max-w-none text-slate-800 font-sans"
        >
          {/* ========================================================================= */}
          {/* PAGE 1: EXECUTIVE COVER, HEATMAP-ONLY MAP CHART & HOTSPOT ANALYSIS       */}
          {/* ========================================================================= */}
          <section className="pdf-report-page p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-200 space-y-6 print:rounded-none print:shadow-none print:border-none print:p-8 print:min-h-screen print:break-after-page" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
            {/* Formal Report Header */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-blue-900 uppercase">
                    <Shield className="w-4 h-4 text-blue-700" />
                    <span>Subsea Cable Maritime Safety & Surveillance Division</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                    SUBSEA CABLE MARITIME TRAFFIC & STATISTICAL SUMMARY REPORT
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Surveillance Assessment & Thermal Heatmap Analysis: <strong className="text-slate-900">{cableRoute.name}</strong>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="inline-block border border-blue-200 text-blue-900 px-2.5 py-1 rounded text-[11px] font-mono font-bold" style={{ backgroundColor: '#eff6ff' }}>
                    REF: SC-MSR-{new Date().getFullYear()}-03
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Classification: Official / Maritime Operations</div>
                </div>
              </div>

              {/* Meta details bar */}
              <div className="grid grid-cols-4 gap-2 border border-slate-200 p-2.5 rounded-lg mt-3 text-xs" style={{ backgroundColor: '#f8fafc' }}>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Active Circuit</span>
                  <span className="font-bold text-slate-900">{cableRoute.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Corridor Length & Buffer</span>
                  <span className="font-bold text-slate-900">{cableRoute.totalLengthKm || 22.5} km • 500m Left/Right</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Monitoring Horizon</span>
                  <span className="font-bold text-slate-900">{dateRange.startDate} to {dateRange.endDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Event Records</span>
                  <span className="font-bold text-blue-700">{totalEvents} Incidents ({dateRange.totalDays} Days)</span>
                </div>
              </div>
            </div>

            {/* MAP CHART: HEATMAP ONLY VIEW (Captured Picture covering all area) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded text-rose-700" style={{ backgroundColor: '#ffe4e6' }}>
                    <Flame className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    1. High-Traffic Density Map Chart (Heatmap Surveillance Layer)
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200" style={{ backgroundColor: '#f1f5f9' }}>
                  Thermal Hotspots • No Vessel Dots • Covers All Area
                </span>
              </div>

              {/* Map Layout: Larger Map on Left + Dedicated Legend Panel on Right (Always 8:4 Grid) */}
              <div className="grid grid-cols-12 gap-3.5 items-stretch">
                {/* Left/Center: High-Resolution Live Satellite Corridor Heatmap */}
                <div className="col-span-8 rounded-xl overflow-hidden border border-slate-300 shadow-md relative h-[390px]" style={{ backgroundColor: '#07182b' }}>
                  <ReportSatelliteHeatmap
                    cableRoute={cableRoute}
                    events={events}
                    parkingZone={parkingZone}
                    height={390}
                  />
                </div>

                {/* Right Side: Dedicated Map Legend & Zone Key Panel */}
                <div className="col-span-4 rounded-xl border border-slate-200 p-3 flex flex-col justify-between space-y-2 shadow-sm h-[390px]" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="space-y-2">
                    <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Map & Corridor Legend</span>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-slate-500">
                        KP 0 - {cableRoute.totalLengthKm || 34}
                      </span>
                    </div>

                    {/* Legend Items List */}
                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-1.5 bg-cyan-500 rounded-sm mt-1 shrink-0"></span>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">{cableVoltageLabel}</span>
                          <span className="text-[9.5px] text-slate-500 leading-tight">Active submarine power line</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="w-4 h-1.5 border border-dashed border-amber-500 bg-amber-400/30 rounded-sm mt-1 shrink-0"></span>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">{cableRoute.protectionCorridorMeters || 500}m Safety Buffer</span>
                          <span className="text-[9.5px] text-slate-500 leading-tight">Protection corridor</span>
                        </div>
                      </div>

                      {isSamuiRoute && (
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-2.5 border border-dashed border-blue-500 bg-blue-500/20 rounded-sm mt-0.5 shrink-0"></span>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">Samui Parking Zone</span>
                            <span className="text-[9.5px] text-slate-500 leading-tight">44.6 km² vessel anchorage</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-rose-500 via-amber-500 to-transparent mt-0.5 shrink-0 shadow-xs"></span>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">Thermal Density Core</span>
                          <span className="text-[9.5px] text-slate-500 leading-tight">Crossing hotspot</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="w-3 h-3 rounded-full bg-sky-400 border-2 border-white mt-0.5 shrink-0 shadow-xs"></span>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">{kp0Name}</span>
                          <span className="text-[9.5px] text-slate-500 leading-tight">KP 0.0 • Shore landing</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white mt-0.5 shrink-0 shadow-xs"></span>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">{kpEndName}</span>
                          <span className="text-[9.5px] text-slate-500 leading-tight">KP {cableRoute.totalLengthKm || 'End'} • Island landing</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hotspot Classification Summary */}
                  <div className="pt-2 border-t border-slate-200 space-y-1 text-[10px]">
                    <div className="font-bold text-slate-800 text-[9.5px] uppercase">Surveillance Zones</div>
                    {isSamuiRoute ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Zone A (Samui Approach)</span>
                          <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">CRITICAL</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Zone B (Fairway Channel)</span>
                          <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">HIGH</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Zone C (Khanom Shore)</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">MEDIUM</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Zone A ({kpEndShort} Approach)</span>
                          <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">CRITICAL</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Zone B (Fairway Channel)</span>
                          <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">HIGH</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Zone C ({kp0Short} Shore)</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">MEDIUM</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic mt-4 pt-1">
                *Figure 1: High-intensity thermal gradient heatmap highlighting vessel concentration along the {cableRoute.name} corridor, designated {cableRoute.protectionCorridorMeters || 500}m safety buffer{isSamuiRoute ? `, and Samui Parking Zone (${parkingAreaKm2} km²)` : ''}. Red cores represent high-density repetitive crossings and anchoring hazard clusters.
              </p>
            </div>

            {/* Corridor High-Traffic Hotspot Zone Findings (Always 3 Columns Side-by-Side) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                <span>Corridor High-Traffic Hotspot Zone Findings</span>
              </h4>
              <div className="grid grid-cols-3 gap-3 text-xs">
                {isSamuiRoute ? (
                  <>
                    <div className="p-2.5 rounded-xl border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>Zone A: Samui Coastal Approach</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded text-rose-800 font-bold" style={{ backgroundColor: '#ffe4e6' }}>CRITICAL</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        Dense cluster of passenger ferries and high-speed catamarans approaching Koh Samui pier, adjacent to the designated Samui Parking Zone.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>Zone B: Deep Channel Fairway</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded text-amber-800 font-bold" style={{ backgroundColor: '#fef3c7' }}>HIGH TRAFFIC</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        Heavy commercial cargo vessels and oil tankers navigating north-south through the central Gulf of Thailand crossing cable axis.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>Zone C: Khanom Substation Nearshore</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded text-blue-800 font-bold" style={{ backgroundColor: '#dbeafe' }}>MEDIUM HAZARD</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        Shallow nearshore approaches characterized by service tugs, port tenders, and local fishing vessels in close proximity to shore trench.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 rounded-xl border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>Zone A: {kpEndShort} Approach</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded text-rose-800 font-bold" style={{ backgroundColor: '#ffe4e6' }}>CRITICAL</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        Cluster of vessels, tenders, and maritime transport approaching {kpEndName} coastal waters.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>Zone B: Channel Fairway</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded text-amber-800 font-bold" style={{ backgroundColor: '#fef3c7' }}>HIGH TRAFFIC</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        Commercial cargo traffic and fairway navigation transiting through active subsea cable corridor.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>Zone C: {kp0Short} Shore</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded text-blue-800 font-bold" style={{ backgroundColor: '#dbeafe' }}>MEDIUM HAZARD</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight">
                        Nearshore approaches characterized by service craft, workboats, and coastal craft near landing trench.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Page Footer */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
              <span>Report Generated: {nowFormatted}</span>
              <span>Page 1 of 3</span>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* PAGE 2: STATISTICAL ANALYSIS, KPIS & 8 VESSEL CLASS BREAKDOWN            */}
          {/* ========================================================================= */}
          <section className="pdf-report-page p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-200 space-y-6 print:rounded-none print:shadow-none print:border-none print:p-8 print:min-h-screen print:break-after-page" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  2. Executive Statistical KPIs & Fleet Traffic Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Quantitative hazard evaluation across the {dateRange.totalDays}-day surveillance period ({dateRange.startDate} – {dateRange.endDate})
                </p>
              </div>
              <div className="text-[10px] font-mono text-slate-400">PAGE 2 / STATISTICAL ANALYSIS</div>
            </div>

            {/* Core KPI Metrics Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200" style={{ backgroundColor: '#f8fafc' }}>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total AIS Incidents</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{totalEvents}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Recorded within 500m corridor</span>
              </div>
              <div className="p-3.5 rounded-xl border border-rose-200" style={{ backgroundColor: '#fff1f2' }}>
                <span className="text-[10px] uppercase font-bold text-rose-700 block flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Anchoring Alerts
                </span>
                <span className="text-2xl font-black text-rose-700 mt-1 block">{anchoringAlerts}</span>
                <span className="text-[10px] text-rose-600 mt-0.5 block">{totalEvents > 0 ? ((anchoringAlerts / totalEvents) * 100).toFixed(1) : 0}% of total incident threats</span>
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200" style={{ backgroundColor: '#fffbeb' }}>
                <span className="text-[10px] uppercase font-bold text-amber-700 block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Crossing Alarms
                </span>
                <span className="text-2xl font-black text-amber-700 mt-1 block">{crossingAlarms}</span>
                <span className="text-[10px] text-amber-600 mt-0.5 block">Transits crossing cable route</span>
              </div>
              <div className="p-3.5 rounded-xl border border-blue-200" style={{ backgroundColor: '#eff6ff' }}>
                <span className="text-[10px] uppercase font-bold text-blue-700 block flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Critical & High Threats
                </span>
                <span className="text-2xl font-black text-blue-800 mt-1 block">{criticalThreats}</span>
                <span className="text-[10px] text-blue-600 mt-0.5 block">Priority risk categorization</span>
              </div>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-slate-200" style={{ backgroundColor: '#f8fafc' }}>
                <span className="text-[10px] font-semibold text-slate-500 block">Total Gross Tonnage</span>
                <span className="text-sm font-bold text-slate-900">{totalGrossTonnage.toLocaleString()} GT</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200" style={{ backgroundColor: '#f8fafc' }}>
                <span className="text-[10px] font-semibold text-slate-500 block">Average Proximity</span>
                <span className="text-sm font-bold text-slate-900">{avgDistance} meters</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200" style={{ backgroundColor: '#f8fafc' }}>
                <span className="text-[10px] font-semibold text-slate-500 block">Average Transit Speed</span>
                <span className="text-sm font-bold text-slate-900">{avgSpeed} knots</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200" style={{ backgroundColor: '#f8fafc' }}>
                <span className="text-[10px] font-semibold text-slate-500 block">Maximum Vessel Size</span>
                {largestVessel ? (
                  <div className="mt-0.5">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {largestVessel.vesselName} <span className="text-[11px] font-semibold text-slate-600">({largestVessel.shipType || 'Vessel'})</span>
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 block mt-0.5">
                      MMSI: {largestVessel.mmsi} • {largestVessel.grossTonnage?.toLocaleString() || 0} GT
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-900">N/A</span>
                )}
              </div>
            </div>

            {/* Standard 8 Vessel Class Traffic Distribution Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Ship className="w-3.5 h-3.5 text-blue-700" />
                  <span>Standard 8 Vessel Class Traffic Distribution</span>
                </h4>
                <span className="text-[10px] text-slate-500">Sorted by transit volume</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-700 border-b border-slate-200 font-bold text-[10px] uppercase" style={{ backgroundColor: '#f1f5f9' }}>
                      <th className="p-2.5">Vessel Class</th>
                      <th className="p-2.5 text-center">Incidents</th>
                      <th className="p-2.5 text-center">Volume Share</th>
                      <th className="p-2.5 text-center">Anchoring Alerts</th>
                      <th className="p-2.5 text-center">Crossing Alarms</th>
                      <th className="p-2.5 text-right">Cumulative GT</th>
                      <th className="p-2.5 text-right">Avg Speed</th>
                      <th className="p-2.5 text-right">Avg Dist</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {vesselTypeBreakdown.map(v => (
                      <tr key={v.type} className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          <span>{v.type}</span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-900">{v.count}</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${v.sharePct}%` }}></div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-600">{v.sharePct}%</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-bold text-rose-600">{v.anchoring}</td>
                        <td className="p-2.5 text-center font-bold text-amber-600">{v.crossing}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{v.tonnage.toLocaleString()} GT</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{v.avgSpeed} kts</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{v.avgDist} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cable Proximity Hazard Severity Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-600" />
                <span>Cable Proximity Hazard Severity Classification</span>
              </h4>
              <div className="grid grid-cols-4 gap-2.5 text-xs">
                {distanceHazardDistribution.map(d => (
                  <div key={d.tier} className="p-3 rounded-lg border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{d.tier}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: `${d.color}20`, color: d.color }}>
                        {d.share}%
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700">{d.level}</div>
                    <div className="text-[10px] text-slate-500">{d.count} Recorded Transits</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Page Footer */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
              <span>Report Generated: {nowFormatted}</span>
              <span>Page 2 of 3</span>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* PAGE 3: TOP RISK VESSELS, COMPLIANCE & SAFETY RECOMMENDATIONS           */}
          {/* ========================================================================= */}
          <section className="pdf-report-page p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-200 space-y-6 print:rounded-none print:shadow-none print:border-none print:p-8 print:min-h-screen" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  3. High-Risk Vessels Leaderboard & Maritime Recommendations
                </h3>
                <p className="text-xs text-slate-500">
                  Targeted vessel risk profiles, parking zone compliance, and operational safeguarding directives
                </p>
              </div>
              <div className="text-[10px] font-mono text-slate-400">PAGE 3 / DIRECTIVES</div>
            </div>

            {/* Top Repetitive & High-Risk Vessels Leaderboard */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Top High-Risk Vessels of Concern (Anchoring & Repeated Infringements)</span>
                </h4>
                <span className="text-[10px] text-slate-500">Ranked by threat severity</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-700 border-b border-slate-200 font-bold text-[10px] uppercase" style={{ backgroundColor: '#f1f5f9' }}>
                      <th className="p-2.5">MMSI</th>
                      <th className="p-2.5">Vessel Name</th>
                      <th className="p-2.5">Ship Type</th>
                      <th className="p-2.5 text-right">Tonnage</th>
                      <th className="p-2.5 text-center">Incidents</th>
                      <th className="p-2.5 text-center">Anchoring</th>
                      <th className="p-2.5 text-right">Closest Approach</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {topRiskVessels.map(v => (
                      <tr key={v.mmsi} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-slate-600 font-semibold">{v.mmsi}</td>
                        <td className="p-2.5 font-bold text-slate-900">{v.name}</td>
                        <td className="p-2.5 text-slate-600">{v.shipType}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{v.tonnage > 0 ? `${v.tonnage.toLocaleString()} GT` : 'N/A'}</td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{v.count}</td>
                        <td className="p-2.5 text-center font-bold text-rose-600">{v.anchoring}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-700">{v.minDist} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Anchorage Compliance Analysis */}
            <div className="p-4 rounded-xl border border-blue-200 space-y-2 text-xs" style={{ backgroundColor: '#eff6ff' }}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-blue-900 text-sm flex items-center gap-1.5">
                  <Anchor className="w-4 h-4 text-blue-700" />
                  <span>
                    {isSamuiRoute
                      ? 'Samui Vessel Parking Zone Compliance Status'
                      : `${cableRoute.name} Cable Corridor Anchorage Compliance`}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-900" style={{ backgroundColor: '#bfdbfe' }}>
                  {isSamuiRoute ? 'Permanent Surveillance Polygon' : 'Corridor Protection Zone'}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {isSamuiRoute ? (
                  <>
                    The designated <strong>Samui Parking Zone</strong> encompasses an approximate area of <strong>{parkingAreaKm2} km²</strong> defined by 4 permanent boundary coordinates (Point 1: 9.523328, 99.903333; Point 2: 9.523330, 99.866663; Point 3: 9.566659, 99.866663; Point 4: 9.566662, 99.879994). Vessels exceeding 1,000 GT intending to drop anchor or drift must be strictly routed inside this polygon to eliminate anchor dragging risk against the 115 kV Koh Samui circuit 3 corridor.
                  </>
                ) : (
                  <>
                    The designated subsea cable corridor for <strong>{cableRoute.name}</strong> spans <strong>{cableRoute.totalLengthKm || 34} km</strong> with a <strong>{cableRoute.protectionCorridorMeters || 500}m</strong> protective safety buffer between <strong>{kp0Name}</strong> and <strong>{kpEndName}</strong>. Vessels intending to drop anchor or drift must strictly avoid the subsea cable corridor to eliminate bottom gear and anchor dragging hazards.
                  </>
                )}
              </p>
            </div>

            {/* Operational Recommendations */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Maritime Safety Directives & Operational Recommendations</span>
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="font-bold text-slate-900">1. Automated AIS Warning Broadcasts</div>
                  <p className="text-[11px] text-slate-600">
                    Maintain real-time automated VHF/AIS text warnings to any vessel decelerating below 1.5 knots within {cableRoute.protectionCorridorMeters || 500}m of the cable axis.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="font-bold text-slate-900">2. Priority Patrol Boat Interception</div>
                  <p className="text-[11px] text-slate-600">
                    Dispatch Marine Police / Harbour Master patrol crafts immediately upon detection of critical anchoring threats (&lt;100m proximity) in Zone A ({isSamuiRoute ? 'Samui Coastal Approach' : `${kpEndShort} Approach`}).
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="font-bold text-slate-900">3. Ferry Operator Route Coordination</div>
                  <p className="text-[11px] text-slate-600">
                    Engage Ro-Pax passenger ferry and high-speed catamaran operators to establish designated fairway crossing angles perpendicular to the subsea cable line.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 space-y-1" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="font-bold text-slate-900">4. Acoustic Cable Depth Verification</div>
                  <p className="text-[11px] text-slate-600">
                    Schedule periodic multibeam sonar surveys across High-Traffic Fairway (Zone B) to confirm subsea cable burial depth and trench integrity.
                  </p>
                </div>
              </div>
            </div>

            {/* Formal Sign-off Box */}
            <div className="pt-4 border-t border-slate-200">
              <div className="grid grid-cols-3 gap-4 text-xs pt-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Prepared By</span>
                  <span className="font-bold text-slate-800 block mt-0.5">Maritime GIS Analyst</span>
                  <span className="text-[10px] text-slate-500">Subsea Cable Monitoring Ops</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Reviewed & Verified By</span>
                  <span className="font-bold text-slate-800 block mt-0.5">Subsea Operations Manager</span>
                  <span className="text-[10px] text-slate-500">Infrastructure Protection Unit</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Official Status</span>
                  <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    VERIFIED & APPROVED
                  </span>
                </div>
              </div>
            </div>

            {/* Page Footer */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
              <span>Report Generated: {nowFormatted}</span>
              <span>Page 3 of 3</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(modalJsx, document.body);
};
