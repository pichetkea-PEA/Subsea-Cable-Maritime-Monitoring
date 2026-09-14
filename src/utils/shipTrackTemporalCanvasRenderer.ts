import { ShipTrackPoint } from '../types';

export interface TemporalAnalysisOptions {
  width: number;
  height: number;
  title?: string;
}

/**
 * Parses a date or timestamp string into a Date object safely.
 */
function parseDateSafe(ts: string): Date | null {
  if (!ts) return null;
  // Handle ISO, space-separated, or slashes
  const parsed = new Date(ts);
  if (!isNaN(parsed.getTime())) return parsed;

  const normalized = ts.replace(' ', 'T');
  const d2 = new Date(normalized);
  if (!isNaN(d2.getTime())) return d2;

  // Try DD/MM/YYYY or YYYY/MM/DD
  const parts = ts.split(/[-/ :]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const h = parts[3] ? parseInt(parts[3], 10) : 0;
      const min = parts[4] ? parseInt(parts[4], 10) : 0;
      return new Date(y, m, d, h, min);
    }
  }
  return null;
}

/**
 * Formats time as HH:MM:SS or HH:MM
 */
function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Formats date as DD MMM YYYY (e.g. 14 Sep 2026)
 */
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Computes difference in hours and minutes formatted as "XXh YYm"
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return '00h 00m';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Renders the Right Area of Page 2 (Orange) or Page 3 (Red) to a high-resolution canvas:
 * 1. 24-Hour Circular Clock Chart (Hourly occurrence radial distribution)
 * 2. Date & Calendar Grid with highlighted active incident dates & metrics
 */
export function renderTemporalAnalysisCanvas(
  points: ShipTrackPoint[],
  eventType: 'orange' | 'red',
  options: TemporalAnalysisOptions
): HTMLCanvasElement {
  const { width, height } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context for temporal analysis');
  }

  const isOrange = eventType === 'orange';
  const themeColor = isOrange ? '#f97316' : '#ef4444';
  const themeColorDark = isOrange ? '#c2410c' : '#b91c1c';
  const themeColorGlow = isOrange ? 'rgba(249, 115, 22, 0.35)' : 'rgba(239, 68, 68, 0.35)';
  const themeBgSubtle = isOrange ? 'rgba(249, 115, 22, 0.10)' : 'rgba(239, 68, 68, 0.10)';

  // --- 1. Background & Border Neatline ---
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#091322');
  bgGrad.addColorStop(0.5, '#0b182d');
  bgGrad.addColorStop(1, '#07101e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer border & neatline
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 0.75;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // --- 2. Temporal Data Extraction ---
  const hourlyCounts = new Array(24).fill(0);
  const dateCounts = new Map<
    string,
    { count: number; dayCount: number; nightCount: number; firstTime: string; lastTime: string; dateObj: Date }
  >();

  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  let minSog = Infinity;
  let maxSog = -Infinity;
  let sumSog = 0;
  let minDistance = Infinity;

  let dayTotalCount = 0;
  let nightTotalCount = 0;
  let earliestDayDate: Date | null = null;
  let latestDayDate: Date | null = null;
  let earliestNightDate: Date | null = null;
  let latestNightDate: Date | null = null;

  points.forEach((p) => {
    const d = parseDateSafe(p.timestamp || p.localTimeStr);
    if (d) {
      const hour = d.getHours();
      hourlyCounts[hour]++;

      const isDayHour = hour >= 6 && hour < 18;
      if (isDayHour) {
        dayTotalCount++;
        if (!earliestDayDate || d.getTime() < earliestDayDate.getTime()) earliestDayDate = d;
        if (!latestDayDate || d.getTime() > latestDayDate.getTime()) latestDayDate = d;
      } else {
        nightTotalCount++;
        if (!earliestNightDate || d.getTime() < earliestNightDate.getTime()) earliestNightDate = d;
        if (!latestNightDate || d.getTime() > latestNightDate.getTime()) latestNightDate = d;
      }

      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const timeStr = formatTime(d);
      const existing = dateCounts.get(dateKey);
      if (existing) {
        existing.count++;
        if (isDayHour) existing.dayCount++;
        else existing.nightCount++;
        existing.lastTime = timeStr;
      } else {
        dateCounts.set(dateKey, {
          count: 1,
          dayCount: isDayHour ? 1 : 0,
          nightCount: isDayHour ? 0 : 1,
          firstTime: timeStr,
          lastTime: timeStr,
          dateObj: d,
        });
      }

      if (!earliestDate || d.getTime() < earliestDate.getTime()) {
        earliestDate = d;
      }
      if (!latestDate || d.getTime() > latestDate.getTime()) {
        latestDate = d;
      }
    }

    if (typeof p.sog === 'number' && !isNaN(p.sog)) {
      minSog = Math.min(minSog, p.sog);
      maxSog = Math.max(maxSog, p.sog);
      sumSog += p.sog;
    }
    if (typeof p.distanceToCableMeters === 'number' && !isNaN(p.distanceToCableMeters)) {
      minDistance = Math.min(minDistance, p.distanceToCableMeters);
    }
  });

  const totalPoints = points.length;
  const avgSog = totalPoints > 0 && sumSog > 0 ? sumSog / totalPoints : 0;
  const durationMs = earliestDate && latestDate ? latestDate.getTime() - earliestDate.getTime() : 0;
  const durationStr = formatDuration(durationMs);

  const dayDurationMs = earliestDayDate && latestDayDate ? latestDayDate.getTime() - earliestDayDate.getTime() : 0;
  const dayDurationStr = formatDuration(dayDurationMs);

  const nightDurationMs = earliestNightDate && latestNightDate ? latestNightDate.getTime() - earliestNightDate.getTime() : 0;
  const nightDurationStr = formatDuration(nightDurationMs);

  // Peak Hours calculation
  let peakDayHour = 12;
  let maxDayHCount = 0;
  for (let h = 6; h < 18; h++) {
    if (hourlyCounts[h] > maxDayHCount) {
      maxDayHCount = hourlyCounts[h];
      peakDayHour = h;
    }
  }

  let peakNightHour = 0;
  let maxNightHCount = 0;
  const nightHoursList = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
  nightHoursList.forEach((h) => {
    if (hourlyCounts[h] > maxNightHCount) {
      maxNightHCount = hourlyCounts[h];
      peakNightHour = h;
    }
  });

  // Layout Division: Top Half = Dual Clocks (Day & Night), Bottom Half = Calendar & Summary
  const topY = 22;
  const topH = 880;
  const botY = 916;
  const botH = 960;
  const padX = 26;
  const cardW = width - padX * 2;

  // =========================================================================
  // TOP SECTION: TWO REAL CLOCKS (DAY & NIGHT) WITH EVENT COUNTERS
  // =========================================================================

  // Top Card Container
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(padX, topY, cardW, topH);
  ctx.strokeStyle = isOrange ? 'rgba(249, 115, 22, 0.45)' : 'rgba(239, 68, 68, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padX, topY, cardW, topH);

  // Top Header Banner
  ctx.fillStyle = themeBgSubtle;
  ctx.fillRect(padX, topY, cardW, 64);
  ctx.fillStyle = themeColor;
  ctx.fillRect(padX, topY, 8, 64);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.fillText(
    isOrange
      ? 'TEMPORAL DIURNAL CYCLES (DAY & NIGHT CLOCKS) • ORANGE ALERT EVENTS'
      : 'TEMPORAL DIURNAL CYCLES (DAY & NIGHT CLOCKS) • RED ANCHORING EVENTS',
    padX + 24,
    topY + 36
  );

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(
    'Dual 12-hour analog maritime clocks displaying incident fix counters for Daytime (06:00–18:00) and Nighttime (18:00–06:00 ICT)',
    padX + 24,
    topY + 56
  );

  /**
   * Helper to draw an authentic 12-hour maritime clock with hour counters and hands.
   */
  const drawRealMaritimeClock = (
    cx: number,
    cy: number,
    radius: number,
    type: 'day' | 'night',
    totalCount: number,
    periodDuration: string,
    peakHourVal: number
  ) => {
    const isDay = type === 'day';
    const clockTheme = isDay ? '#f59e0b' : '#38bdf8';

    // 1. Clock Title Header Badge above clock
    const badgeW = 380;
    const badgeH = 34;
    const badgeX = cx - badgeW / 2;
    const badgeY = cy - radius - 52;

    ctx.fillStyle = isDay ? 'rgba(245, 158, 11, 0.12)' : 'rgba(56, 189, 248, 0.12)';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = clockTheme;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = clockTheme;
    ctx.textAlign = 'center';
    ctx.fillText(
      isDay ? '☀️ DAY CLOCK (06:00 – 18:00 ICT)' : '🌙 NIGHT CLOCK (18:00 – 06:00 ICT)',
      cx,
      badgeY + 22
    );

    // 2. Metallic Outer Bezel
    const bezelGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    bezelGrad.addColorStop(0, '#334155');
    bezelGrad.addColorStop(0.5, '#0f172a');
    bezelGrad.addColorStop(1, '#1e293b');

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
    ctx.fillStyle = bezelGrad;
    ctx.fill();
    ctx.strokeStyle = clockTheme;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Subtle Bezel Screws (4 corners)
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((ang) => {
      const sx = cx + Math.cos(ang + Math.PI / 4) * (radius + 9);
      const sy = cy + Math.sin(ang + Math.PI / 4) * (radius + 9);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#64748b';
      ctx.fill();
    });

    // 3. Dial Face Interior
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = isDay ? '#07101e' : '#050a14';
    ctx.fill();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Draw 60 Minute / Second Tick Marks
    for (let m = 0; m < 60; m++) {
      const angle = -Math.PI / 2 + (m / 60) * Math.PI * 2;
      const isHour = m % 5 === 0;
      const tickLen = isHour ? 12 : 5;
      const rOuter = radius - 4;
      const rInner = rOuter - tickLen;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
      ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
      ctx.strokeStyle = isHour ? (m % 15 === 0 ? clockTheme : '#94a3b8') : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = isHour ? (m % 15 === 0 ? 2.5 : 1.8) : 1;
      ctx.stroke();
    }

    // 5. Hour Definitions for Dial Construction
    const dialMap: { dialNum: number; hour24: number; label24: string }[] = isDay
      ? [
          { dialNum: 12, hour24: 12, label24: '12:00' },
          { dialNum: 1, hour24: 13, label24: '13:00' },
          { dialNum: 2, hour24: 14, label24: '14:00' },
          { dialNum: 3, hour24: 15, label24: '15:00' },
          { dialNum: 4, hour24: 16, label24: '16:00' },
          { dialNum: 5, hour24: 17, label24: '17:00' },
          { dialNum: 6, hour24: 6, label24: '06:00' },
          { dialNum: 7, hour24: 7, label24: '07:00' },
          { dialNum: 8, hour24: 8, label24: '08:00' },
          { dialNum: 9, hour24: 9, label24: '09:00' },
          { dialNum: 10, hour24: 10, label24: '10:00' },
          { dialNum: 11, hour24: 11, label24: '11:00' },
        ]
      : [
          { dialNum: 12, hour24: 0, label24: '00:00' },
          { dialNum: 1, hour24: 1, label24: '01:00' },
          { dialNum: 2, hour24: 2, label24: '02:00' },
          { dialNum: 3, hour24: 3, label24: '03:00' },
          { dialNum: 4, hour24: 4, label24: '04:00' },
          { dialNum: 5, hour24: 5, label24: '05:00' },
          { dialNum: 6, hour24: 18, label24: '18:00' },
          { dialNum: 7, hour24: 19, label24: '19:00' },
          { dialNum: 8, hour24: 20, label24: '20:00' },
          { dialNum: 9, hour24: 21, label24: '21:00' },
          { dialNum: 10, hour24: 22, label24: '22:00' },
          { dialNum: 11, hour24: 23, label24: '23:00' },
        ];

    // 6. Draw 12 Hour Numbers & 24h Tags & Event Counters
    dialMap.forEach((entry) => {
      const dialStep = entry.dialNum === 12 ? 0 : entry.dialNum;
      const angle = -Math.PI / 2 + (dialStep / 12) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Real clock numeral (1 to 12)
      const numR = radius - 30;
      const nx = cx + cosA * numR;
      const ny = cy + sinA * numR;

      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = entry.dialNum % 3 === 0 ? clockTheme : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(entry.dialNum), nx, ny);

      // 24-hr secondary label
      const tagR = radius - 50;
      const tx = cx + cosA * tagR;
      const ty = cy + sinA * tagR;
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(entry.label24, tx, ty);

      // --- EVENT COUNTER BADGE FOR THIS HOUR ---
      const hourCount = hourlyCounts[entry.hour24] || 0;
      const counterR = radius - 80;
      const bx = cx + cosA * counterR;
      const by = cy + sinA * counterR;

      if (hourCount > 0) {
        // Glowing Counter Badge
        ctx.beginPath();
        ctx.arc(bx, by, 16, 0, Math.PI * 2);
        ctx.fillStyle = themeColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner number of events
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(hourCount), bx, by);

        // Highlight radial ray from center to tick
        ctx.beginPath();
        ctx.moveTo(cx + cosA * 105, cy + sinA * 105);
        ctx.lineTo(cx + cosA * (radius - 16), cy + sinA * (radius - 16));
        ctx.strokeStyle = themeColorGlow;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        // Subtle dot indicating zero events at this hour
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(51, 65, 85, 0.45)';
        ctx.fill();
      }
    });

    // 7. Authentic Clock Hands (Pointing to peak activity hour)
    if (totalCount > 0 && peakHourVal !== undefined) {
      const match = dialMap.find((m) => m.hour24 === peakHourVal);
      if (match) {
        const dStep = match.dialNum === 12 ? 0 : match.dialNum;
        const handAngle = -Math.PI / 2 + (dStep / 12) * Math.PI * 2;

        // Hour Hand
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(handAngle);
        ctx.beginPath();
        ctx.moveTo(-5, 10);
        ctx.lineTo(0, -radius * 0.45);
        ctx.lineTo(5, 10);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Minute Hand (Pointing to 12)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.moveTo(-3, 10);
        ctx.lineTo(0, -radius * 0.65);
        ctx.lineTo(3, 10);
        ctx.closePath();
        ctx.fillStyle = clockTheme;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 8. Center Counter Display Hub
    const hubR = 72;
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fillStyle = '#060d1b';
    ctx.fill();
    ctx.strokeStyle = totalCount > 0 ? themeColor : '#334155';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = isDay ? '#fbbf24' : '#38bdf8';
    ctx.fillText(isDay ? 'DAY COUNTER' : 'NIGHT COUNTER', cx, cy - 32);

    // Large Bold Event Counter
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = totalCount > 0 ? themeColor : '#64748b';
    ctx.fillText(`${totalCount}`, cx, cy - 4);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(totalCount === 1 ? 'EVENT FIX' : 'EVENT FIXES', cx, cy + 18);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(totalCount > 0 ? periodDuration : '00h 00m', cx, cy + 34);

    // Pinion Cap
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = clockTheme;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  // Render Day Clock (Left) and Night Clock (Right)
  const clockRadius = 210;
  const dayClockCenterX = padX + Math.round(cardW * 0.26);
  const nightClockCenterX = padX + Math.round(cardW * 0.74);
  const clockCenterY = topY + 440;

  drawRealMaritimeClock(
    dayClockCenterX,
    clockCenterY,
    clockRadius,
    'day',
    dayTotalCount,
    dayDurationStr,
    peakDayHour
  );

  drawRealMaritimeClock(
    nightClockCenterX,
    clockCenterY,
    clockRadius,
    'night',
    nightTotalCount,
    nightDurationStr,
    peakNightHour
  );

  // Bottom Diurnal Summary Bar across both clocks
  const barY = topY + topH - 58;
  const barH = 42;
  ctx.fillStyle = 'rgba(10, 20, 36, 0.95)';
  ctx.fillRect(padX + 20, barY, cardW - 40, barH);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(padX + 20, barY, cardW - 40, barH);

  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const dayPct = totalPoints > 0 ? ((dayTotalCount / totalPoints) * 100).toFixed(0) : '0';
  const nightPct = totalPoints > 0 ? ((nightTotalCount / totalPoints) * 100).toFixed(0) : '0';

  ctx.fillStyle = '#f8fafc';
  ctx.fillText(
    `DIURNAL BALANCE: Day Period = ${dayTotalCount} Events (${dayPct}%) • Night Period = ${nightTotalCount} Events (${nightPct}%) • Total Surveillance Fixes = ${totalPoints} Occurrences`,
    padX + cardW / 2,
    barY + barH / 2
  );
  ctx.textBaseline = 'alphabetic'; // reset

  // =========================================================================
  // BOTTOM SECTION: DATE & CALENDAR SCHEDULE ANALYSIS
  // =========================================================================

  // Bottom Card Container
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fillRect(padX, botY, cardW, botH);
  ctx.strokeStyle = isOrange ? 'rgba(249, 115, 22, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(padX, botY, cardW, botH);

  // Bottom Header Banner
  ctx.fillStyle = themeBgSubtle;
  ctx.fillRect(padX, botY, cardW, 64);
  ctx.fillStyle = themeColor;
  ctx.fillRect(padX, botY, 8, 64);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.fillText(
    isOrange
      ? 'CALENDAR CHART & DAILY EVENT OCCURRENCE LOG • ORANGE TYPE EVENTS'
      : 'CALENDAR CHART & DAILY EVENT OCCURRENCE LOG • RED ANCHORING EVENTS',
    padX + 24,
    botY + 36
  );

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(
    'Detailed monthly calendar displaying exact event counts per day, temporal chronology, and PEA threat action recommendations',
    padX + 24,
    botY + 56
  );

  // --- CALENDAR WIDGET (LEFT HALF OF BOTTOM SECTION) ---
  const calX = padX + 24;
  const calY = botY + 80;
  const calW = 580;
  const calH = 430;

  ctx.fillStyle = '#071120';
  ctx.fillRect(calX, calY, calW, calH);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(calX, calY, calW, calH);

  // Reference month from earliest detected date (or fallback to September 2026)
  const refDate = earliestDate || new Date(2026, 8, 14);
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const monthName = refDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();

  // Calendar Header
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(calX, calY, calW, 52);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText(`${monthName} ${year}`, calX + calW / 2, calY + 34);

  // Weekday Columns (Mon to Sun)
  const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const colW = calW / 7;
  const headerY = calY + 76;

  daysOfWeek.forEach((d, idx) => {
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = idx >= 5 ? '#64748b' : '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(d, calX + idx * colW + colW / 2, headerY);
  });

  // Calculate Calendar Days Matrix
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sun, 1 is Mon
  const startingDayOffset = (firstDayOfMonth + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calGridStartY = headerY + 18;
  const cellH = (calH - 102) / 6;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayIndex = startingDayOffset + day - 1;
    const col = dayIndex % 7;
    const row = Math.floor(dayIndex / 7);

    const cellX = calX + col * colW;
    const cellY = calGridStartY + row * cellH;

    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = dateCounts.get(dateKey);
    const hasEvents = !!dayData && dayData.count > 0;

    if (hasEvents) {
      // Highlighted Active Incident Date Badge with Prominent Counter
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.roundRect(cellX + 3, cellY + 2, colW - 6, cellH - 4, 8);
      ctx.fill();

      // Glowing outer rim
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Date number
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${day}`, cellX + colW / 2, cellY + 18);

      // Amount of Events in this day (Prominently displayed)
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${dayData.count} EVENTS`, cellX + colW / 2, cellY + 33);

      // Day / Night Breakdown Pill
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = isOrange ? '#fed7aa' : '#fecaca';
      ctx.fillText(`D:${dayData.dayCount} | N:${dayData.nightCount}`, cellX + colW / 2, cellY + 45);
    } else {
      // Normal Day
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText(`${day}`, cellX + colW / 2, cellY + cellH / 2 + 5);
    }
  }

  // --- DAILY INCIDENT LOG & METRICS (RIGHT HALF OF BOTTOM SECTION) ---
  const metaX = calX + calW + 24;
  const metaW = cardW - (calW + 65);
  const metaY = calY;

  // Box 1: Daily Event Log (Listing events for each active day)
  const box1H = 195;
  ctx.fillStyle = '#071120';
  ctx.fillRect(metaX, metaY, metaW, box1H);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(metaX, metaY, metaW, box1H);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(metaX, metaY, metaW, 40);
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.fillText('DAILY EVENT OCCURRENCE BREAKDOWN', metaX + 18, metaY + 26);

  // Table rows for active days
  let logRowY = metaY + 68;
  if (dateCounts.size > 0) {
    Array.from(dateCounts.entries()).forEach(([key, dData], idx) => {
      if (idx < 3) {
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`📅 ${formatDate(dData.dateObj)}:`, metaX + 18, logRowY);

        // Bold event count pill
        ctx.fillStyle = themeColor;
        ctx.font = 'bold 15px monospace';
        ctx.fillText(`${dData.count} Fixes`, metaX + 180, logRowY);

        // Day/Night and Time window
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText(`(${dData.dayCount} Day, ${dData.nightCount} Night) • ${dData.firstTime}–${dData.lastTime} ICT`, metaX + 270, logRowY);

        logRowY += 38;
      }
    });
  } else {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('No incident fixes logged for this timeframe.', metaX + 18, logRowY);
  }

  // Box 2: Speed & Proximity Profile
  const box2Y = metaY + box1H + 18;
  const box2H = 217;
  ctx.fillStyle = '#071120';
  ctx.fillRect(metaX, box2Y, metaW, box2H);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(metaX, box2Y, metaW, box2H);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(metaX, box2Y, metaW, 40);
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('VESSEL DYNAMICS & SUBSEA CORRIDOR PROXIMITY', metaX + 18, box2Y + 26);

  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Speed Profile (SOG):', metaX + 18, box2Y + 68);
  ctx.fillText('Minimum Distance to Cable:', metaX + 18, box2Y + 110);
  ctx.fillText('500m Safety Corridor Status:', metaX + 18, box2Y + 152);
  ctx.fillText('Total Alert Dwell Duration:', metaX + 18, box2Y + 192);

  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#f8fafc';
  const sogDisplay =
    minSog !== Infinity
      ? `Min ${minSog.toFixed(1)} kts • Max ${maxSog.toFixed(1)} kts • Avg ${avgSog.toFixed(1)} kts`
      : 'N/A';
  ctx.fillText(sogDisplay, metaX + 240, box2Y + 68);

  const distDisplay = minDistance !== Infinity ? `${minDistance.toFixed(1)} meters (HIGH THREAT)` : 'Inside Safety Corridor';
  ctx.fillStyle = themeColor;
  ctx.fillText(distDisplay, metaX + 240, box2Y + 110);

  ctx.fillStyle = '#ef4444';
  ctx.fillText('SAFETY CORRIDOR BREACHED', metaX + 240, box2Y + 152);

  ctx.fillStyle = themeColor;
  ctx.fillText(`${durationStr} (${totalPoints} Active Fixes)`, metaX + 240, box2Y + 192);

  // Box 3: Threat Impact Analysis & Operational Action (Bottom Box across full width)
  const box3Y = calY + calH + 20;
  const box3W = cardW - 48;
  const box3H = 370;

  ctx.fillStyle = 'rgba(10, 19, 36, 0.95)';
  ctx.fillRect(calX, box3Y, box3W, box3H);
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(calX, box3Y, box3W, box3H);

  // Title banner
  ctx.fillStyle = themeBgSubtle;
  ctx.fillRect(calX, box3Y, box3W, 46);
  ctx.fillStyle = themeColor;
  ctx.fillRect(calX, box3Y, 8, 46);

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(
    isOrange
      ? 'INFRASTRUCTURE THREAT ASSESSMENT: LOW SPEED / CORRIDOR LOITERING'
      : 'INFRASTRUCTURE THREAT ASSESSMENT: DIRECT AT-ANCHOR CABLE HAZARD',
    calX + 22,
    box3Y + 30
  );

  // Advisory bullets (increased font size 16px with comfortable line spacing)
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'left';

  const bullets = isOrange
    ? [
        '• OPERATIONAL HAZARD: Speeds below 5.0 knots inside the 500-meter corridor indicate deliberate loitering, drift fishing, or deployment of benthic bottom-dragging gear directly above critical submarine power assets.',
        '• ASSET PROTECTION: The 115 kV Koh Samui armored submarine cable rests on seabed with rock mattress armoring. Contact from anchors, drag chains, or heavy trawl boards creates severe risk of mechanical armor abrasion.',
        '• INCIDENT CHRONOLOGY: Total corridor dwell reached ' +
          durationStr +
          ' spanning ' +
          totalPoints +
          ' surveillance fixes. Peak daytime activity observed at ' +
          String(peakDayHour).padStart(2, '0') +
          ':00 ICT, peak nighttime activity at ' +
          String(peakNightHour).padStart(2, '0') +
          ':00 ICT.',
        '• MANDATORY PEA ACTION: Formal incident notification dispatched to vessel owner and Marine Department in compliance with Section 115 Submarine Electrical Corridor Protection Ordinances.',
      ]
    : [
        '• SEVERE INFRASTRUCTURE EMERGENCY: Vessel status is confirmed "At Anchor" within proximity to the 115 kV submarine power circuit. Penetration of anchor flukes 3 to 5 meters into the seabed causes imminent risk of catastrophic cable severing.',
        '• POWER GRID IMPACT: Severing this primary 115 kV electrical transmission line triggers immediate province-wide blackouts across Koh Samui and Koh Phangan, requiring emergency submarine salvage and restoration ships.',
        '• INCIDENT CHRONOLOGY: Anchoring persisted for ' +
          durationStr +
          ' with minimum recorded distance of ' +
          (minDistance !== Infinity ? minDistance.toFixed(1) + 'm' : '<50m') +
          ' from the subsea cable route. ' +
          dayTotalCount +
          ' fixes occurred during day hours and ' +
          nightTotalCount +
          ' fixes occurred during night hours.',
        '• EMERGENCY PROTOCOL: Immediate dispatch of PEA marine patrol craft, urgent notification to Marine Department Port Authority, and emergency VHF Channel 16 warning to order anchor weigh-in.',
      ];

  let bulletY = box3Y + 84;
  bullets.forEach((b) => {
    ctx.fillText(b, calX + 24, bulletY, box3W - 48);
    bulletY += 52;
  });

  // Footer Signature Block
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(calX + 20, box3Y + box3H - 45);
  ctx.lineTo(calX + box3W - 20, box3Y + box3H - 45);
  ctx.stroke();

  ctx.font = '13px monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText(
    `PEA-SCMM AUTOMATED RADAR & AIS SURVEILLANCE TELEMETRY • GENERATED: ${formatDate(new Date())} • PROVINCIAL ELECTRICITY AUTHORITY`,
    calX + 20,
    box3Y + box3H - 20
  );

  return canvas;
}
