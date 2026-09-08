import { CableRoute, AlarmEvent } from '../types';

/**
 * Uploads a text file or CSV directly to Google Drive via multipart API.
 * Uses the OAuth access token retrieved via Google Auth.
 */
export async function uploadToGoogleDrive(
  accessToken: string,
  filename: string,
  content: string,
  mimeType: string
): Promise<{ id: string; name: string }> {
  const metadata = {
    name: filename,
    mimeType: mimeType,
  };

  const boundary = 'drive_backup_boundary_separator';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive upload failed (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Formats a CableRoute waypoints back to latitude[tab]longitude format matching the "Lat long of circuit 3.txt" pattern.
 */
export function formatCableRouteToText(route: CableRoute): string {
  return route.waypoints.map(wp => `${wp.lat}\t${wp.lng}`).join('\n');
}

/**
 * Formats state AlarmEvent array back to 15-column CSV matching the "Default Alarm Event.csv" layout.
 */
export function formatEventsToCSV(events: AlarmEvent[]): string {
  const headers = [
    'Time', 'Date', 'Hour', 'Priority', 'Condition', 'Msg', 'Zone', 
    'MMSI', 'IMO', 'Name', 'Call Sign', 'Type', 'Latitude', 'Longitude', 'Info'
  ];
  
  const rows = events.map(evt => {
    const dt = new Date(evt.timestamp);
    let dateStr = evt.timestamp;
    let timeStr = '00:00:00';
    if (!isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      dateStr = `${dd}/${mm}/${dt.getFullYear()}`;
      timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`;
    }
    
    const condition = evt.eventDetail === 'Ship Exit' ? 'On Exit' : 'On Enter';
    const msg = evt.eventDetail === 'Ship Anchoring' ? 'Ship Anchoring inside cable zone' : evt.eventDetail === 'Ship Exit' ? 'Ship Exit Cable Zone' : 'Ship Enter Cable Zone';
    
    const fields = [
      evt.timestamp,                        // Column A: Time (original formatted string)
      dateStr,                              // Column B: Date
      timeStr,                              // Column C: Hour
      evt.priority || 'Low',                // Column D: Priority
      condition,                            // Column E: Condition
      msg,                                  // Column F: Msg
      '115kV Cable to Koh Samui 200m',      // Column G: Zone
      evt.mmsi,                             // Column H: MMSI
      '-1',                                 // Column I: IMO (placeholder)
      evt.vesselName || '',                 // Column J: Name
      evt.callSign || '',                   // Column K: Call Sign
      evt.shipType || '',                   // Column L: Type
      evt.currentLat.toString(),            // Column M: Latitude
      evt.currentLon.toString(),            // Column N: Longitude
      evt.info || ''                        // Column O: Info
    ];
    
    // Safely wrap each field in double quotes and escape existing quotes for standard CSV parser
    return fields.map(field => {
      const s = String(field ?? '').trim();
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\t')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}
