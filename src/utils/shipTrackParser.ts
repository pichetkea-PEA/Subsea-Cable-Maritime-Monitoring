import Papa from 'papaparse';
import { CableRoute, ShipParticulars, ShipTrackPoint, ShipTrackSummaryData } from '../types';
import { minDistanceToCable, formatDisplayDateTime } from './geoUtils';
import { calculateShipTrackSummary, DEFAULT_SAMPLE_SHIP } from '../data/sampleShipTrack';

/**
 * Parses user-uploaded "Ship Track" CSV file into structured track points and ship particulars.
 */
export function parseShipTrackCsv(
  csvText: string,
  cableRoute: CableRoute
): Promise<ShipTrackSummaryData> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            throw new Error('CSV file contains no data rows.');
          }

          const rawRows = results.data as Record<string, any>[];
          const waypoints = cableRoute?.waypoints || [];
          const corridorWidth = cableRoute?.protectionCorridorMeters || 500;

          // Helper to find column key case-insensitively
          const findKey = (row: Record<string, any>, candidates: string[]): string | null => {
            const keys = Object.keys(row);
            for (const cand of candidates) {
              const matched = keys.find((k) => k.toLowerCase().replace(/[\s_-]/g, '') === cand.toLowerCase().replace(/[\s_-]/g, ''));
              if (matched) return matched;
            }
            return null;
          };

          const firstRow = rawRows[0];

          // Key mappings
          const dateKey = findKey(firstRow, ['datetime', 'timestamp', 'date', 'time', 'localtime', 'utctime', 'eventtime']);
          const latKey = findKey(firstRow, ['latitude', 'lat', 'y']);
          const lngKey = findKey(firstRow, ['longitude', 'lon', 'lng', 'long', 'x']);
          const sogKey = findKey(firstRow, ['sog', 'speed', 'speedknots', 'knt', 'velocity']);
          const cogKey = findKey(firstRow, ['cog', 'course', 'heading']);
          const statusKey = findKey(firstRow, ['status', 'navigationalstatus', 'navstatus', 'condition', 'state', 'msg']);

          // Ship particulars mappings
          const mmsiKey = findKey(firstRow, ['mmsi', 'mmsino', 'vesselmmsi']);
          const imoKey = findKey(firstRow, ['imo', 'imono']);
          const nameKey = findKey(firstRow, ['name', 'vesselname', 'shipname', 'vessel']);
          const callSignKey = findKey(firstRow, ['callsign', 'call_sign', 'call']);
          const typeKey = findKey(firstRow, ['type', 'shiptype', 'vesseltype']);
          const dimensionKey = findKey(firstRow, ['dimension', 'dimensions', 'size']);
          const lengthKey = findKey(firstRow, ['length', 'ship_length']);
          const widthKey = findKey(firstRow, ['width', 'beam', 'breadth']);
          const flagKey = findKey(firstRow, ['flag', 'country', 'nationality']);

          if (!latKey || !lngKey) {
            throw new Error('Could not identify Latitude and Longitude columns in CSV. Expected headers like "Latitude", "Longitude" (or "Lat", "Lon").');
          }

          // Extract Ship Particulars
          const mmsiVal = mmsiKey && firstRow[mmsiKey] ? String(firstRow[mmsiKey]).trim() : DEFAULT_SAMPLE_SHIP.mmsi;
          const imoVal = imoKey && firstRow[imoKey] ? String(firstRow[imoKey]).trim() : DEFAULT_SAMPLE_SHIP.imo;
          const nameVal = nameKey && firstRow[nameKey] ? String(firstRow[nameKey]).trim() : DEFAULT_SAMPLE_SHIP.name;
          const callSignVal = callSignKey && firstRow[callSignKey] ? String(firstRow[callSignKey]).trim() : DEFAULT_SAMPLE_SHIP.callSign;
          const typeVal = typeKey && firstRow[typeKey] ? String(firstRow[typeKey]).trim() : DEFAULT_SAMPLE_SHIP.shipType;
          
          let dimensionVal = DEFAULT_SAMPLE_SHIP.dimension;
          if (dimensionKey && firstRow[dimensionKey]) {
            dimensionVal = String(firstRow[dimensionKey]).trim();
          } else if (lengthKey && widthKey && firstRow[lengthKey] && firstRow[widthKey]) {
            dimensionVal = `${firstRow[lengthKey]}m × ${firstRow[widthKey]}m`;
          }

          const flagVal = flagKey && firstRow[flagKey] ? String(firstRow[flagKey]).trim() : DEFAULT_SAMPLE_SHIP.flag;

          const ship: ShipParticulars = {
            mmsi: mmsiVal || '567001588',
            imo: imoVal || '9233894',
            name: nameVal || 'SEATRANFERRY 10',
            callSign: callSignVal || 'HSB6336',
            shipType: typeVal || 'Ro-Ro / Passenger Ferry',
            dimension: dimensionVal || '118.5m × 19.2m',
            flag: flagVal || 'Thailand 🇹🇭',
          };

          // Parse rows into points
          const parsedPoints: ShipTrackPoint[] = [];

          rawRows.forEach((row, idx) => {
            const rawLat = parseFloat(String(row[latKey]));
            const rawLng = parseFloat(String(row[lngKey]));

            if (isNaN(rawLat) || isNaN(rawLng)) return;

            const sog = sogKey && row[sogKey] !== undefined ? parseFloat(String(row[sogKey])) || 0 : 0;
            const cog = cogKey && row[cogKey] !== undefined ? parseFloat(String(row[cogKey])) || 0 : undefined;
            const statusRaw = statusKey && row[statusKey] !== undefined ? String(row[statusKey]).trim() : 'Under way using engine';

            // Local Time resolution
            let rawTime = dateKey && row[dateKey] ? String(row[dateKey]).trim() : '';
            let localTimeStr = rawTime;
            let isoTimestamp = new Date().toISOString();

            if (rawTime) {
              try {
                const parsedDate = new Date(rawTime);
                if (!isNaN(parsedDate.getTime())) {
                  isoTimestamp = parsedDate.toISOString();
                  localTimeStr = parsedDate.toLocaleString('en-GB', {
                    timeZone: 'Asia/Bangkok',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  });
                } else {
                  localTimeStr = formatDisplayDateTime(rawTime);
                }
              } catch {
                localTimeStr = formatDisplayDateTime(rawTime);
              }
            } else {
              localTimeStr = `Fix #${idx + 1}`;
            }

            // Subsea Cable Distance calculation
            const distanceToCableMeters = minDistanceToCable(rawLat, rawLng, waypoints);
            const isInsideCableZone = distanceToCableMeters <= corridorWidth;

            // Strict User Condition Logic:
            // - Red if value in status column in CSV file is "At Anchor"
            // - Green if value in status column in CSV file is "Under way using engine"    
            // - Orange if the position of ship is inside cable zone and SOG is less than 5
            // - Yellow if the position of ship is inside cable zone and SOG is more than 5
            let dotColor: 'red' | 'green' | 'orange' | 'yellow' = 'green';
            let dotCategory = 'Under way using engine';

            if (isInsideCableZone) {
              if (sog < 5) {
                dotColor = 'orange';
                dotCategory = 'Inside Cable Zone (SOG < 5 kts)';
              } else {
                dotColor = 'yellow';
                dotCategory = 'Inside Cable Zone (SOG ≥ 5 kts)';
              }
            } else {
              const normStatus = statusRaw.toLowerCase();
              if (normStatus.includes('anchor')) {
                dotColor = 'red';
                dotCategory = 'At Anchor';
              } else if (normStatus.includes('under way') || normStatus.includes('engine') || normStatus.includes('underway')) {
                dotColor = 'green';
                dotCategory = 'Under way using engine';
              } else if (normStatus.includes('moored')) {
                dotColor = 'red';
                dotCategory = 'Moored / At Anchor';
              } else {
                dotColor = 'green';
                dotCategory = statusRaw || 'Under way';
              }
            }

            parsedPoints.push({
              id: `csv-pt-${idx + 1}`,
              timestamp: isoTimestamp,
              localTimeStr,
              lat: rawLat,
              lng: rawLng,
              sog: Number(sog.toFixed(1)),
              cog: cog !== undefined ? Number(cog.toFixed(0)) : undefined,
              status: statusRaw,
              isInsideCableZone,
              distanceToCableMeters,
              dotColor,
              dotCategory,
            });
          });

          if (parsedPoints.length === 0) {
            throw new Error('No valid track coordinate records found in CSV file.');
          }

          // Sort chronologically if timestamps are valid
          parsedPoints.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
              return timeA - timeB;
            }
            return 0;
          });

          const summary = calculateShipTrackSummary(ship, parsedPoints);
          resolve(summary);
        } catch (err: any) {
          reject(err);
        }
      },
      error: (error) => {
        reject(new Error(`CSV Parsing failed: ${error.message}`));
      },
    });
  });
}
