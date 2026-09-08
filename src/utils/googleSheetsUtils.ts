import { parseCableRouteFile, parseAlarmEventsCSV, parseParkingZoneText } from './geoUtils';
import { CableRoute, AlarmEvent, ParkingZone } from '../types';
import { getAccessToken } from '../lib/firebase';

/**
 * Extracts Google Sheets Spreadsheet ID from a link or returns raw ID
 */
export function extractSpreadsheetId(urlOrId: any): string {
  if (!urlOrId) return '';
  const trimmed = String(urlOrId).trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Fetches Google Sheet values as CSV or JSON using Google Sheets API or Public Export URL
 */
export async function fetchGoogleSheetCSV(spreadsheetIdOrUrl: string, sheetName: string = 'Sheet1'): Promise<string> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!spreadsheetId) {
    throw new Error('Invalid Google Sheets URL or ID.');
  }

  const token = getAccessToken();

  // 1. Try Google Sheets REST API with OAuth Bearer Token if logged in
  if (token) {
    try {
      const range = sheetName ? encodeURIComponent(sheetName) : 'A1:Z2000';
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const values: string[][] = data.values || [];
        if (values.length > 0) {
          // Convert 2D values array to CSV string
          return values
            .map(row =>
              row
                .map(cell => {
                  const str = String(cell ?? '').replace(/"/g, '""');
                  return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
                })
                .join(',')
            )
            .join('\n');
        }
      }
    } catch (e) {
      console.warn('Google Sheets API token fetch error, falling back to public export URL:', e);
    }
  }

  // 2. Fallback to public export CSV URL
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${
    sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : ''
  }`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error(
      `Unable to access Google Sheet (${res.status}). Please ensure the sheet is shared or sign in with Google account pichet.kea@gmail.com.`
    );
  }

  return await res.text();
}

/**
 * Import Cable Route directly from Google Sheets
 */
export async function importCableRouteFromGoogleSheet(
  spreadsheetUrlOrId: string,
  routeName: string = 'Google Sheet Subsea Route',
  sheetName: string = 'Sheet1'
): Promise<CableRoute> {
  const csvText = await fetchGoogleSheetCSV(spreadsheetUrlOrId, sheetName);
  const route = parseCableRouteFile(csvText, routeName);
  if (!route || route.waypoints.length === 0) {
    throw new Error('No valid GPS coordinates (latitude, longitude) were found in the specified Google Sheet.');
  }
  return route;
}

/**
 * Import Alarm Events directly from Google Sheets
 */
export async function importAlarmEventsFromGoogleSheet(
  spreadsheetUrlOrId: string,
  waypoints: { lat: number; lng: number }[],
  sheetName: string = 'Sheet1'
): Promise<AlarmEvent[]> {
  const csvText = await fetchGoogleSheetCSV(spreadsheetUrlOrId, sheetName);
  const events = parseAlarmEventsCSV(csvText, waypoints);
  if (!events || events.length === 0) {
    throw new Error('No valid alarm incident records were found in the specified Google Sheet.');
  }
  return events;
}

/**
 * Import Samui Parking Zone polygon coordinates directly from Google Sheets
 */
export async function importParkingZoneFromGoogleSheet(
  spreadsheetUrlOrId: string,
  sheetName: string = 'Samui Parking Zone',
  zoneName: string = 'Samui Parking Zone'
): Promise<ParkingZone> {
  const csvText = await fetchGoogleSheetCSV(spreadsheetUrlOrId, sheetName);
  const coords = parseParkingZoneText(csvText);

  if (!coords || coords.length < 3) {
    throw new Error(
      `No valid polygon coordinates found in Google Sheet tab "${sheetName}". Please ensure the sheet has columns for Latitude and Longitude.`
    );
  }

  return {
    id: 'samui-parking-zone-imported',
    name: zoneName,
    description: 'Designated Vessel Parking & Anchorage Area for Large-Size Ships (Cruise liners, container vessels & deep-draft maritime traffic)',
    targetVesselType: 'Large-size ship',
    coordinates: coords,
    isActive: true,
    color: '#3b82f6',
    updatedAt: new Date().toISOString(),
  };
}
