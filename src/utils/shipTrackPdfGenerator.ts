import jsPDF from 'jspdf';
import { CableRoute, ShipTrackPoint, ShipTrackSummaryData } from '../types';
import { renderShipTrackMapToCanvas } from './shipTrackMapCanvasRenderer';
import { renderTemporalAnalysisCanvas } from './shipTrackTemporalCanvasRenderer';

/**
 * Generates and downloads a comprehensive 3-page PDF summary report of vessel track surveillance:
 * - Page 1: Overview map chart of overall ship path with satellite background layer,
 *           plus vessel particulars and surveillance incident metrics.
 * - Page 2: Orange Alert Events Deep-Dive:
 *           - Left area: Map chart with zoom into the area where most orange dots occurred (satellite background layer).
 *           - Right area: 24-Hour circular clock chart and calendar/date chronology of this orange type event.
 * - Page 3: Red Alert Events Deep-Dive:
 *           - Left area: Map chart with zoom into the area where most red dots occurred (satellite background layer).
 *           - Right area: 24-Hour circular clock chart and calendar/date chronology of this red type event.
 */
export async function generateShipTrackPdf(
  summaryData: ShipTrackSummaryData,
  cableRoute: CableRoute,
  _mapContainerEl?: HTMLElement | null
): Promise<void> {
  if (!summaryData) {
    throw new Error('No ship track summary data available to generate report.');
  }

  const pageWidth = 297;
  const pageHeight = 210;

  // Initialize Landscape A4 PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const reportDateStr = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const { ship } = summaryData;
  const points = summaryData.points || [];
  const orangePoints = points.filter((p) => p.dotColor === 'orange');
  const redPoints = points.filter((p) => p.dotColor === 'red');

  // =========================================================================
  // PAGE 1: OVERALL SHIP PATH & PARTICULARS (WITH SATELLITE BACKGROUND)
  // =========================================================================

  // Background dark maritime aesthetic
  doc.setFillColor(7, 15, 30);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // --- HEADER SECTION (Y: 6 to 17) ---
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 6, pageWidth - 16, 11, 'F');
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.3);
  doc.rect(8, 6, pageWidth - 16, 11, 'S');

  // Left Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(56, 189, 248); // Cyan
  doc.text('PEA-SCMM • VESSEL TRACK SURVEILLANCE & INFRASTRUCTURE INCIDENT REPORT', 12, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(
    `Subsea Cable: ${cableRoute?.name || 'Active Cable Corridor'} (${cableRoute?.protectionCorridorMeters || 500}m Safety Protection Zone)`,
    12,
    14.5
  );

  // Right Threat Badges
  // Anchoring Badge
  const anchorCount = summaryData.anchoringCount;
  doc.setFillColor(anchorCount > 0 ? 220 : 30, anchorCount > 0 ? 38 : 41, anchorCount > 0 ? 38 : 59);
  doc.roundedRect(155, 7.5, 38, 7.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`ANCHORING: ${anchorCount} TIME${anchorCount === 1 ? '' : 'S'}`, 158, 12.2);

  // Cable Zone Entry Badge
  const entryCount = summaryData.cableZoneEnterCount;
  doc.setFillColor(entryCount > 0 ? 217 : 30, entryCount > 0 ? 119 : 41, entryCount > 0 ? 6 : 59);
  doc.roundedRect(196, 7.5, 42, 7.5, 1, 1, 'F');
  doc.text(`CABLE ZONE: ${entryCount} ENTRY`, 199, 12.2);

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Date: ${reportDateStr}`, 242, 12.2);

  // Page Indicator Badge
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(268, 7.5, 17, 7.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(226, 232, 240);
  doc.text('PAGE 1 / 3', 270, 12.2);

  // --- MAP CHART SECTION: OVERALL SHIP PATH (Y: 19 to 176) ---
  const mapX = 8;
  const mapY = 19;
  const mapW = 281;
  const mapH = 157;

  try {
    const overallCanvas = await renderShipTrackMapToCanvas(summaryData, cableRoute, {
      mode: 'overall',
      width: 1680,
      height: 940,
      customTitle: 'OVERALL SHIP PATH & ACTIVE SUBSEA CABLE CORRIDOR (FULL VOYAGE)',
      enableSatelliteBackground: true,
    });
    const overallImageBase64 = overallCanvas.toDataURL('image/png', 0.95);
    doc.addImage(overallImageBase64, 'PNG', mapX, mapY, mapW, mapH, undefined, 'FAST');
  } catch (err) {
    console.error('Overall canvas rendering failed:', err);
    doc.setFillColor(15, 23, 42);
    doc.rect(mapX, mapY, mapW, mapH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Overall Surveillance Chart (Satellite Layer Active)', mapX + mapW / 2 - 40, mapY + mapH / 2);
  }

  // --- BOTTOM SECTION: SHIP PARTICULARS & SURVEILLANCE SUMMARY (Y: 178 to 204) ---
  const bottomY = 178;
  const bottomH = 26;

  doc.setFillColor(15, 23, 42);
  doc.rect(mapX, bottomY, mapW, bottomH, 'F');
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.3);
  doc.rect(mapX, bottomY, mapW, bottomH, 'S');

  // Row 1: Section Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(56, 189, 248);
  doc.text('VESSEL REGISTRY PARTICULARS & SURVEILLANCE DOSSIER', mapX + 4, bottomY + 4.5);

  // Row 2: Ship Particulars Grid
  const colY = bottomY + 6.5;
  const numCols = 7;
  const colWidth = (mapW - 8) / numCols;

  const fields = [
    { label: 'VESSEL NAME', val: ship.name || 'Unknown' },
    { label: 'MMSI', val: ship.mmsi || 'N/A' },
    { label: 'IMO NUMBER', val: ship.imo || 'N/A' },
    { label: 'CALL SIGN', val: ship.callSign || 'N/A' },
    { label: 'VESSEL TYPE', val: ship.shipType || 'General Cargo' },
    {
      label: 'DIMENSIONS',
      val: ship.dimension || 'N/A',
    },
    { label: 'FLAG STATE', val: ship.flag || 'Thailand (THA)' },
  ];

  fields.forEach((field, i) => {
    const colX = mapX + 4 + i * colWidth;
    doc.setFillColor(8, 14, 27);
    doc.rect(colX, colY, colWidth - 2, 7.5, 'F');
    doc.setDrawColor(51, 65, 85);
    doc.rect(colX, colY, colWidth - 2, 7.5, 'S');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(field.label, colX + 2, colY + 2.8);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(241, 245, 249);
    const truncatedVal = doc.splitTextToSize(field.val, colWidth - 4)[0] || field.val;
    doc.text(truncatedVal, colX + 2, colY + 6);
  });

  // Row 3: Comprehensive Surveillance Summary Text
  doc.setFillColor(10, 20, 38);
  doc.rect(mapX + 4, bottomY + 15.5, mapW - 8, 7.5, 'F');
  doc.setDrawColor(40, 70, 140);
  doc.rect(mapX + 4, bottomY + 15.5, mapW - 8, 7.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(245, 158, 11); // Amber
  doc.text('SURVEILLANCE INCIDENT SUMMARY:', mapX + 6, bottomY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(226, 232, 240);

  const summaryText = `Ship recorded ${summaryData.anchoringCount} anchoring event(s) (${summaryData.pointsAnchoringCount} track fixes) and entered the 500m cable safety corridor ${summaryData.cableZoneEnterCount} time(s) (${summaryData.pointsInCableZoneCount} fixes inside corridor). Closest distance to cable: ${summaryData.minDistanceToCableMeters}m. Speed profile: Avg ${summaryData.avgSog} kts (Min ${summaryData.minSog} kts, Max ${summaryData.maxSog} kts) over ${summaryData.totalPoints} total AIS fixes.`;
  doc.text(summaryText, mapX + 55, bottomY + 20);

  // Footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Provincial Electricity Authority (PEA) • Subsea Cable Maintenance Management (SCMM) • Page 1 of 3',
    12,
    206
  );

  // =========================================================================
  // PAGE 2: ORANGE ALERT EVENTS (LEFT: ZOOMED MAP, RIGHT: CLOCK & CALENDAR)
  // =========================================================================
  doc.addPage('a4', 'landscape');

  // Background
  doc.setFillColor(7, 15, 30);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header Banner Page 2
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 6, pageWidth - 16, 10, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.35);
  doc.rect(8, 6, pageWidth - 16, 10, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(253, 186, 116);
  doc.text('PEA-SCMM • GEOSPATIAL & TEMPORAL INCIDENT DEEP-DIVE: ORANGE ALERTS', 12, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Slow Speed loitering (SOG < 5.0 kts) inside the 500-meter subsea cable protection safety corridor',
    12,
    14.3
  );

  // Badges on Right
  doc.setFillColor(217, 119, 6);
  doc.roundedRect(175, 7.5, 36, 6.8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`ORANGE: ${orangePoints.length} FIXES`, 178, 12);

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(215, 7.5, 48, 6.8, 1, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Date: ${reportDateStr}`, 218, 12);

  // Page Indicator Badge
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(268, 7.5, 17, 6.8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(226, 232, 240);
  doc.text('PAGE 2 / 3', 270, 12);

  // Content Area: Left = Zoomed Satellite Map, Right = Clock Chart & Calendar Summary
  const contentY = 18;
  const contentH = 185;
  const leftW = 142;
  const rightX = 154;
  const rightW = 135;

  // Render Left Map (Zoom into Orange Alert Sector with Satellite Background)
  try {
    const orangeMapCanvas = await renderShipTrackMapToCanvas(summaryData, cableRoute, {
      mode: 'orange_focus',
      width: 1420,
      height: 1850,
      customTitle: 'INCIDENT SECTOR ZOOM: ORANGE ALERT EVENTS (SOG < 5 KTS IN CABLE ZONE)',
      enableSatelliteBackground: true,
    });
    const orangeMapImageBase64 = orangeMapCanvas.toDataURL('image/png', 0.95);
    doc.addImage(orangeMapImageBase64, 'PNG', 8, contentY, leftW, contentH, undefined, 'FAST');
  } catch (err) {
    console.error('Orange focus map canvas rendering failed:', err);
    doc.setFillColor(15, 23, 42);
    doc.rect(8, contentY, leftW, contentH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Orange Alert Map (Satellite Layer Active)', 8 + leftW / 2 - 35, contentY + contentH / 2);
  }

  // Render Right Panel (Clock Chart & Calendar of Orange Events)
  try {
    const orangeRightCanvas = renderTemporalAnalysisCanvas(orangePoints, 'orange', {
      width: 1400,
      height: 1900,
    });
    const orangeRightBase64 = orangeRightCanvas.toDataURL('image/png', 0.95);
    doc.addImage(orangeRightBase64, 'PNG', rightX, contentY, rightW, contentH, undefined, 'FAST');
  } catch (err) {
    console.error('Orange temporal analysis canvas rendering failed:', err);
    doc.setFillColor(15, 23, 42);
    doc.rect(rightX, contentY, rightW, contentH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Orange Temporal & Calendar Analysis', rightX + rightW / 2 - 35, contentY + contentH / 2);
  }

  // Footer Page 2
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Provincial Electricity Authority (PEA) • Subsea Cable Maintenance Management (SCMM) • Page 2 of 3',
    12,
    206
  );

  // =========================================================================
  // PAGE 3: RED ALERT EVENTS (LEFT: ZOOMED MAP, RIGHT: CLOCK & CALENDAR)
  // =========================================================================
  doc.addPage('a4', 'landscape');

  // Background
  doc.setFillColor(7, 15, 30);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header Banner Page 3
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 6, pageWidth - 16, 10, 'F');
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.35);
  doc.rect(8, 6, pageWidth - 16, 10, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(252, 165, 165);
  doc.text('PEA-SCMM • GEOSPATIAL & TEMPORAL INCIDENT DEEP-DIVE: RED ALERTS', 12, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Stationary Navigation Status "At Anchor" reported in proximity to high-voltage subsea cable asset',
    12,
    14.3
  );

  // Badges on Right
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(175, 7.5, 36, 6.8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`RED: ${redPoints.length} FIXES`, 181, 12);

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(215, 7.5, 48, 6.8, 1, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Date: ${reportDateStr}`, 218, 12);

  // Page Indicator Badge
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(268, 7.5, 17, 6.8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(226, 232, 240);
  doc.text('PAGE 3 / 3', 270, 12);

  // Check if Red Alert Points have multiple distinct geographic areas / isolated points
  const clusters: ShipTrackPoint[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < redPoints.length; i++) {
    if (visited.has(i)) continue;
    const currentCluster: ShipTrackPoint[] = [redPoints[i]];
    visited.add(i);

    for (let j = i + 1; j < redPoints.length; j++) {
      if (visited.has(j)) continue;
      const isClose = currentCluster.some((p) => {
        const dLat = ((p.lat - redPoints[j].lat) * Math.PI) / 180;
        const dLng = ((p.lng - redPoints[j].lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((p.lat * Math.PI) / 180) *
            Math.cos((redPoints[j].lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const distM = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return distM <= 1200; // within 1.2km
      });
      if (isClose) {
        currentCluster.push(redPoints[j]);
        visited.add(j);
      }
    }
    clusters.push(currentCluster);
  }

  // Sort clusters by size descending (largest = mostly found, smaller = isolated)
  clusters.sort((a, b) => b.length - a.length);
  const hasDifferenceArea = clusters.length >= 2;

  if (hasDifferenceArea) {
    const mostlyFoundPoints = clusters[0];
    const isolatedPoints = clusters.slice(1).flat();

    const mostlyFoundCentroid = {
      lat: mostlyFoundPoints.reduce((s, p) => s + p.lat, 0) / mostlyFoundPoints.length,
      lng: mostlyFoundPoints.reduce((s, p) => s + p.lng, 0) / mostlyFoundPoints.length,
    };
    const isolatedCentroid = {
      lat: isolatedPoints.reduce((s, p) => s + p.lat, 0) / isolatedPoints.length,
      lng: isolatedPoints.reduce((s, p) => s + p.lng, 0) / isolatedPoints.length,
    };

    // SECTION 1: OVERALL RED CIRCLE EVENTS (Top half of left area)
    const s1X = 8;
    const s1Y = contentY;
    const s1W = leftW;
    const s1H = 86;

    try {
      const overallRedCanvas = await renderShipTrackMapToCanvas(summaryData, cableRoute, {
        mode: 'custom_focus',
        width: 1420,
        height: 860,
        customTitle: '1. OVERALL: RED EVENTS DISTRIBUTION & CABLE CORRIDOR',
        enableSatelliteBackground: true,
        customFocusPoints: redPoints,
        highlightCallouts: [
          {
            lat: mostlyFoundCentroid.lat,
            lng: mostlyFoundCentroid.lng,
            label: `MOSTLY FOUND (${mostlyFoundPoints.length} FIXES)`,
            color: '#ef4444',
          },
          {
            lat: isolatedCentroid.lat,
            lng: isolatedCentroid.lng,
            label: `ISOLATED (${isolatedPoints.length} FIX)`,
            color: '#f59e0b',
          },
        ],
      });
      const img1 = overallRedCanvas.toDataURL('image/png', 0.95);
      doc.addImage(img1, 'PNG', s1X, s1Y, s1W, s1H, undefined, 'FAST');
    } catch (err) {
      console.error('Section 1 overall red canvas error:', err);
    }

    // SECTION 2: MOSTLY FOUND RED CIRCLE (Bottom-Left)
    const s2X = 8;
    const s2Y = contentY + s1H + 3;
    const s2W = 69.5;
    const s2H = 96;

    try {
      const mostlyFoundCanvas = await renderShipTrackMapToCanvas(summaryData, cableRoute, {
        mode: 'custom_focus',
        width: 700,
        height: 960,
        customTitle: `2. MOSTLY FOUND RED CIRCLE (${mostlyFoundPoints.length} FIXES)`,
        enableSatelliteBackground: true,
        customFocusPoints: mostlyFoundPoints,
      });
      const img2 = mostlyFoundCanvas.toDataURL('image/png', 0.95);
      doc.addImage(img2, 'PNG', s2X, s2Y, s2W, s2H, undefined, 'FAST');
    } catch (err) {
      console.error('Section 2 mostly found red canvas error:', err);
    }

    // SECTION 3: ISOLATED RED CIRCLE (Bottom-Right)
    const s3X = 80.5;
    const s3Y = contentY + s1H + 3;
    const s3W = 69.5;
    const s3H = 96;

    try {
      const isolatedCanvas = await renderShipTrackMapToCanvas(summaryData, cableRoute, {
        mode: 'custom_focus',
        width: 700,
        height: 960,
        customTitle: `3. ISOLATED RED CIRCLE (${isolatedPoints.length} FIX)`,
        enableSatelliteBackground: true,
        customFocusPoints: isolatedPoints,
      });
      const img3 = isolatedCanvas.toDataURL('image/png', 0.95);
      doc.addImage(img3, 'PNG', s3X, s3Y, s3W, s3H, undefined, 'FAST');
    } catch (err) {
      console.error('Section 3 isolated red canvas error:', err);
    }
  } else {
    // Single area red event focus map
    try {
      const redMapCanvas = await renderShipTrackMapToCanvas(summaryData, cableRoute, {
        mode: 'red_focus',
        width: 1420,
        height: 1850,
        customTitle: 'INCIDENT SECTOR ZOOM: RED ALERT EVENTS (AT ANCHOR INCIDENTS)',
        enableSatelliteBackground: true,
      });
      const redMapImageBase64 = redMapCanvas.toDataURL('image/png', 0.95);
      doc.addImage(redMapImageBase64, 'PNG', 8, contentY, leftW, contentH, undefined, 'FAST');
    } catch (err) {
      console.error('Red focus map canvas rendering failed:', err);
      doc.setFillColor(15, 23, 42);
      doc.rect(8, contentY, leftW, contentH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('Red Alert Map (Satellite Layer Active)', 8 + leftW / 2 - 30, contentY + contentH / 2);
    }
  }

  // Render Right Panel (Clock Chart & Calendar of Red Events)
  try {
    const redRightCanvas = renderTemporalAnalysisCanvas(redPoints, 'red', {
      width: 1400,
      height: 1900,
    });
    const redRightBase64 = redRightCanvas.toDataURL('image/png', 0.95);
    doc.addImage(redRightBase64, 'PNG', rightX, contentY, rightW, contentH, undefined, 'FAST');
  } catch (err) {
    console.error('Red temporal analysis canvas rendering failed:', err);
    doc.setFillColor(15, 23, 42);
    doc.rect(rightX, contentY, rightW, contentH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Red Temporal & Calendar Analysis', rightX + rightW / 2 - 30, contentY + contentH / 2);
  }

  // Footer Page 3
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Provincial Electricity Authority (PEA) • Subsea Cable Maintenance Management (SCMM) • Page 3 of 3',
    12,
    206
  );

  // Save PDF
  const safeVesselName = (ship.name || 'VESSEL').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Ship_Track_Summary_Report_${safeVesselName}_${reportDateStr.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Backward compatibility alias for existing imports.
 */
export const generateShipTrackSinglePagePdf = generateShipTrackPdf;
