import { doc, getDoc, setDoc, getDocs, collection, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CableRoute, AlarmEvent } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------------------------------------------
// Cable Route Firestore Helpers
// ----------------------------------------------------

/**
 * Saves a subsea cable route config to Firestore
 */
export async function saveCableRouteToFirestore(route: CableRoute): Promise<void> {
  const path = `routes/${route.id}`;
  try {
    const routeRef = doc(db, 'routes', route.id);
    await setDoc(routeRef, {
      id: route.id,
      name: route.name,
      mainlandStation: route.mainlandStation || '',
      islandStation: route.islandStation || '',
      totalLengthKm: route.totalLengthKm || 0,
      protectionCorridorMeters: route.protectionCorridorMeters || 500,
      status: route.status,
      updatedAt: route.updatedAt,
      isDefault: route.isDefault || false,
      waypoints: route.waypoints.map(wp => ({
        id: wp.id,
        name: wp.name || '',
        lat: wp.lat,
        lng: wp.lng,
        depthMeters: wp.depthMeters || 0,
        sequence: wp.sequence
      }))
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetches all saved cable routes from Firestore
 */
export async function getCableRoutesFromFirestore(): Promise<CableRoute[]> {
  const path = 'routes';
  try {
    const qSnapshot = await getDocs(collection(db, 'routes'));
    const routes: CableRoute[] = [];
    qSnapshot.forEach((doc) => {
      routes.push(doc.data() as CableRoute);
    });
    return routes;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// ----------------------------------------------------
// Alarm Event Firestore Helpers
// ----------------------------------------------------

/**
 * Saves a list of alarm events to Firestore (batch-write support)
 */
export async function saveAlarmEventsToFirestore(events: AlarmEvent[]): Promise<void> {
  const path = 'events';
  try {
    // We will save events in chunks of 400 documents to respect Firestore's batch limits (500)
    const chunkSize = 400;
    for (let i = 0; i < events.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = events.slice(i, i + chunkSize);
      
      chunk.forEach(event => {
        const eventRef = doc(db, 'events', event.id);
        batch.set(eventRef, {
          id: event.id,
          timestamp: event.timestamp,
          mmsi: event.mmsi,
          vesselName: event.vesselName || '',
          shipType: event.shipType || '',
          eventType: event.eventType,
          eventDetail: event.eventDetail || '',
          entryLat: event.entryLat || 0,
          entryLon: event.entryLon || 0,
          exitLat: event.exitLat || null,
          exitLon: event.exitLon || null,
          currentLat: event.currentLat || 0,
          currentLon: event.currentLon || 0,
          speedKnots: event.speedKnots || 0,
          headingDegrees: event.headingDegrees || null,
          grossTonnage: event.grossTonnage || 0,
          priority: event.priority,
          durationMinutes: event.durationMinutes || 0,
          distanceToCableMeters: event.distanceToCableMeters || 0,
          info: event.info || '',
          status: event.status,
          photoUrl: event.photoUrl || '',
          callSign: event.callSign || '',
          flagCountry: event.flagCountry || ''
        });
      });
      
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetches all saved alarm events from Firestore
 */
export async function getAlarmEventsFromFirestore(): Promise<AlarmEvent[]> {
  const path = 'events';
  try {
    const qSnapshot = await getDocs(collection(db, 'events'));
    const alarmEvents: AlarmEvent[] = [];
    qSnapshot.forEach((doc) => {
      alarmEvents.push(doc.data() as AlarmEvent);
    });
    // Sort events by timestamp descending or chronological order as appropriate
    return alarmEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
