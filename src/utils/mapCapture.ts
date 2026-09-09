import L from 'leaflet';
import html2canvas from 'html2canvas';

/**
 * Normalizes CSS strings containing unsupported oklch(...) colors
 * into standard hex or rgba(...) strings that html2canvas can parse without errors.
 */
export function sanitizeOklchInClonedDoc(clonedDoc: Document): void {
  try {
    const canvas = clonedDoc.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    const convertColorString = (str: string): string => {
      if (!str || typeof str !== 'string' || !str.toLowerCase().includes('oklch')) {
        return str;
      }

      return str.replace(/oklch\([^)]+\)/gi, (oklchMatch) => {
        if (!ctx) return '#0f172a';
        try {
          ctx.fillStyle = '#0f172a'; // Reset default
          ctx.fillStyle = oklchMatch;
          const result = ctx.fillStyle;
          if (result && !result.toLowerCase().includes('oklch')) {
            return result;
          }
        } catch {
          // Fallback
        }
        return '#0f172a';
      });
    };

    // 1. Sanitize all <style> blocks in the cloned document
    const styleElements = clonedDoc.querySelectorAll('style');
    styleElements.forEach((styleEl) => {
      if (styleEl.textContent && styleEl.textContent.toLowerCase().includes('oklch')) {
        styleEl.textContent = convertColorString(styleEl.textContent);
      }
    });

    // 2. Inline computed colors directly on DOM elements in cloned document
    const allElements = clonedDoc.querySelectorAll<HTMLElement>('*');
    allElements.forEach((el) => {
      const styleAttr = el.getAttribute('style');
      if (styleAttr && styleAttr.toLowerCase().includes('oklch')) {
        el.setAttribute('style', convertColorString(styleAttr));
      }

      if (window && window.getComputedStyle) {
        try {
          const comp = window.getComputedStyle(el);
          const bg = comp.backgroundColor;
          const color = comp.color;
          const border = comp.borderColor;

          if (bg && bg.toLowerCase().includes('oklch')) {
            el.style.backgroundColor = convertColorString(bg);
          }
          if (color && color.toLowerCase().includes('oklch')) {
            el.style.color = convertColorString(color);
          }
          if (border && border.toLowerCase().includes('oklch')) {
            el.style.borderColor = convertColorString(border);
          }
        } catch {
          // Ignore
        }
      }
    });
  } catch (err) {
    console.warn('oklch sanitization warning:', err);
  }
}

/**
 * Captures a high-resolution picture of a Leaflet map.
 * Uses html2canvas and direct canvas compositing without problematic external dependencies.
 */
export async function captureLeafletMap(map: L.Map, containerEl?: HTMLElement | null): Promise<string> {
  const target = containerEl || map.getContainer();
  if (!target) {
    throw new Error('Map container not found');
  }

  // Ensure map is properly sized
  map.invalidateSize();

  try {
    const canvas = await html2canvas(target, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#071526',
      scale: 1.5,
      ignoreElements: (element) => {
        return element.classList.contains('leaflet-control-zoom');
      },
      onclone: (clonedDoc) => {
        sanitizeOklchInClonedDoc(clonedDoc);
      },
    });

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    if (dataUrl && dataUrl.length > 500) {
      return dataUrl;
    }
  } catch (err) {
    console.warn('html2canvas capture warning:', err);
  }

  // Fallback: direct composite from overlay pane canvas
  try {
    const overlayCanvas = target.querySelector('.leaflet-overlay-pane canvas') as HTMLCanvasElement | null;
    const size = map.getSize();
    const compCanvas = document.createElement('canvas');
    compCanvas.width = size.x;
    compCanvas.height = size.y;
    const ctx = compCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#071526';
      ctx.fillRect(0, 0, size.x, size.y);
      if (overlayCanvas) {
        ctx.drawImage(overlayCanvas, 0, 0);
      }
      const dataUrl = compCanvas.toDataURL('image/png', 0.95);
      if (dataUrl && dataUrl.length > 500) {
        return dataUrl;
      }
    }
  } catch (e) {
    console.error('Direct canvas composite failed:', e);
  }

  throw new Error('Unable to capture map image');
}

/**
 * Calculates geographic bounds that encompass the active subsea cable corridor
 * from starting point to ending point, safety buffer, and adjacent parking zone if applicable.
 */
export function getFullCorridorBounds(
  waypoints: { lat: number; lng: number }[],
  parkingCoords?: { lat: number; lng: number }[],
  additionalPoints?: { lat: number; lng: number }[]
): L.LatLngBounds {
  const points: [number, number][] = [];

  // 1. Waypoints covering the entire active cable route
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    waypoints.forEach(wp => {
      if (wp && typeof wp.lat === 'number' && typeof wp.lng === 'number' && !isNaN(wp.lat) && !isNaN(wp.lng)) {
        points.push([wp.lat, wp.lng]);
      }
    });
  }

  // 2. Parking Zone coordinates (only include if geographically adjacent to the cable route <= 0.6 deg ~ 65km)
  if (Array.isArray(parkingCoords) && parkingCoords.length > 0 && points.length > 0) {
    const isAdjacent = parkingCoords.some(pc =>
      points.some(([wLat, wLng]) => Math.abs(pc.lat - wLat) < 0.6 && Math.abs(pc.lng - wLng) < 0.6)
    );
    if (isAdjacent) {
      parkingCoords.forEach(pc => {
        if (pc && typeof pc.lat === 'number' && typeof pc.lng === 'number') {
          points.push([pc.lat, pc.lng]);
        }
      });
    }
  }

  // 3. Additional offset label points (to ensure labels stay in view, only if geographically near)
  if (Array.isArray(additionalPoints) && additionalPoints.length > 0 && points.length > 0) {
    additionalPoints.forEach(p => {
      if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
        const isNear = points.some(([wLat, wLng]) => Math.abs(p.lat - wLat) < 0.6 && Math.abs(p.lng - wLng) < 0.6);
        if (isNear) {
          points.push([p.lat, p.lng]);
        }
      }
    });
  }

  if (points.length === 0) {
    return L.latLngBounds([[9.31, 99.85], [9.55, 100.04]]);
  }

  const bounds = L.latLngBounds(points);
  // Padding so all corridor components, labels, and badges stay completely within the visible frame
  const spanLng = bounds.getEast() - bounds.getWest();
  const padFactor = spanLng < 0.2 ? 0.16 : 0.10;
  return bounds.pad(padFactor);
}
