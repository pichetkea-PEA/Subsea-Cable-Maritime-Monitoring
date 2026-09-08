import React, { useState, useEffect, useMemo } from 'react';
import { CableRoute, AlarmEvent, HistoricalShipSummary, UserProfile, ParkingZone } from './types';
import { DEFAULT_CABLE_ROUTE, INITIAL_ALARM_EVENTS, INITIAL_HISTORICAL_SHIPS, DEFAULT_USER, DEFAULT_PARKING_ZONE } from './data/mockData';
import { parseCableRouteFile, parseAlarmEventsCSV, parseParkingZoneText } from './utils/geoUtils';
import { Header, NavigationTab } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { CableSetupFirstPage } from './components/CableSetupFirstPage';
import { DashboardCsvUploadBar } from './components/DashboardCsvUploadBar';
import { MapChart } from './components/MapChart';
import { EventSummaryPanel } from './components/EventSummaryPanel';
import { EventLogTable } from './components/EventLogTable';
import { StatisticalAnalysisPage } from './components/StatisticalAnalysisPage';
import { DataManagementModal } from './components/DataManagementModal';
import { CableRouteModal } from './components/CableRouteModal';
import { AuthModal } from './components/AuthModal';
import { initAuth } from './lib/firebase';
import { saveCableRouteToFirestore, getCableRoutesFromFirestore, saveAlarmEventsToFirestore, getAlarmEventsFromFirestore } from './utils/firebaseUtils';

export default function App() {
  // Authentication State - Always force login screen on app startup
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Initialize Firebase Auth Listener
  useEffect(() => {
    initAuth((user, token) => {
      setIsAuthenticated(true);
      setCurrentUser(prev => ({
        ...prev,
        name: user.displayName || prev.name,
        email: user.email || prev.email,
        avatarUrl: user.photoURL || prev.avatarUrl
      }));
    });
  }, []);

  // 1. Persistent State Initialization
  const [cableRoute, setCableRoute] = useState<CableRoute>(() => {
    try {
      const saved = localStorage.getItem('subsea_active_cable_route');
      return saved ? JSON.parse(saved) : DEFAULT_CABLE_ROUTE;
    } catch {
      return DEFAULT_CABLE_ROUTE;
    }
  });

  const [savedRoutes, setSavedRoutes] = useState<CableRoute[]>(() => {
    try {
      const saved = localStorage.getItem('subsea_saved_cable_routes');
      return saved ? JSON.parse(saved) : [DEFAULT_CABLE_ROUTE];
    } catch {
      return [DEFAULT_CABLE_ROUTE];
    }
  });

  const [events, setEvents] = useState<AlarmEvent[]>(() => {
    try {
      const saved = localStorage.getItem('subsea_alarm_events');
      return saved ? JSON.parse(saved) : INITIAL_ALARM_EVENTS;
    } catch {
      return INITIAL_ALARM_EVENTS;
    }
  });

  const [historicalData, setHistoricalData] = useState<HistoricalShipSummary[]>(() => {
    try {
      const saved = localStorage.getItem('subsea_historical_ships');
      return saved ? JSON.parse(saved) : INITIAL_HISTORICAL_SHIPS;
    } catch {
      return INITIAL_HISTORICAL_SHIPS;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('subsea_user_profile');
      return saved ? JSON.parse(saved) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  // Permanent Vessel Parking Zone (Large-size ship anchorage in Koh Samui)
  const [parkingZone, setParkingZone] = useState<ParkingZone>(() => {
    try {
      const saved = localStorage.getItem('subsea_permanent_parking_zone');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          parsed.coordinates &&
          parsed.coordinates.length === 4 &&
          Math.abs(parsed.coordinates[0].lat - 9.523328) < 0.001
        ) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    localStorage.setItem('subsea_permanent_parking_zone', JSON.stringify(DEFAULT_PARKING_ZONE));
    return DEFAULT_PARKING_ZONE;
  });

  const handleUpdateParkingZone = (newZone: ParkingZone) => {
    setParkingZone(newZone);
    localStorage.setItem('subsea_permanent_parking_zone', JSON.stringify(newZone));
  };

  // UI States - Land directly on 'map' (monitoring page) after login
  const [activeTab, setActiveTab] = useState<NavigationTab>('map');
  const [selectedEvent, setSelectedEvent] = useState<AlarmEvent | null>(null);
  const [hoveredMMSI, setHoveredMMSI] = useState<string | null>(null);
  const [selectedFilterType, setSelectedFilterType] = useState<'All' | 'Alarm' | 'Alert'>('All');
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | 'Ship Enter' | 'Ship Exit' | 'Ship Anchoring'>('ALL');
  const [capturedHeatmapImage, setCapturedHeatmapImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ais_corridor_heatmap_image');
    } catch {
      return null;
    }
  });

  // Modal States
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Load default cable route and alarm events on app mount
  useEffect(() => {
    const initDefaultFiles = async () => {
      try {
        const routeRes = await fetch('/Lat long of circuit 3.txt');
        if (routeRes.ok) {
          const routeText = await routeRes.text();
          const parsedRoute = parseCableRouteFile(routeText, '115 kV Koh Samui circuit 3');
          parsedRoute.id = 'circuit-3-samui';
          parsedRoute.isDefault = true;

          // Check if local storage or cloud already has an active route, otherwise set default
          const savedActive = localStorage.getItem('subsea_active_cable_route');
          const shouldUpdate = !savedActive || (savedActive && (JSON.parse(savedActive).waypoints?.length || 0) < 2500);
          if (shouldUpdate) {
            setCableRoute(parsedRoute);
            localStorage.setItem('subsea_active_cable_route', JSON.stringify(parsedRoute));
          }

          const eventsRes = await fetch('/Default Alarm Event.csv');
          if (eventsRes.ok) {
            const eventsText = await eventsRes.text();
            const parsedEvents = parseAlarmEventsCSV(eventsText, parsedRoute.waypoints);
            const savedEvents = localStorage.getItem('subsea_alarm_events');
            if (!savedEvents) {
              setEvents(parsedEvents);
              localStorage.setItem('subsea_alarm_events', JSON.stringify(parsedEvents));
            }
          }
        }

        // Initialize Samui Parking Zone
        try {
          const parkingRes = await fetch('/Samui Parking Zone.txt');
          if (parkingRes.ok) {
            const pText = await parkingRes.text();
            const pCoords = parseParkingZoneText(pText);
            if (pCoords.length >= 3) {
              const initialZone: ParkingZone = {
                ...DEFAULT_PARKING_ZONE,
                coordinates: pCoords,
              };
              setParkingZone(initialZone);
              localStorage.setItem('subsea_permanent_parking_zone', JSON.stringify(initialZone));
            }
          }
        } catch (pErr) {
          console.warn('Initial parking zone loading notice:', pErr);
        }
      } catch (err) {
        console.warn('Initial default asset loading error:', err);
      }
    };
    initDefaultFiles();
  }, []);

  // Load cloud data from Firestore on mount
  useEffect(() => {
    const loadFirestoreData = async () => {
      try {
        const cloudRoutes = await getCableRoutesFromFirestore();
        if (cloudRoutes.length > 0) {
          setSavedRoutes(cloudRoutes);
          const active = cloudRoutes.find(r => r.isDefault) || cloudRoutes[0];
          setCableRoute(active);
        }

        const cloudEvents = await getAlarmEventsFromFirestore();
        if (cloudEvents.length > 0) {
          setEvents(cloudEvents);
        }
      } catch (e) {
        console.warn('Firestore load notice:', e);
      }
    };
    loadFirestoreData();
  }, []);

  // Authentication Handlers
  const handleLoginSuccess = async (user: UserProfile) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setActiveTab('setup'); // Automatically move to Page 1 (Subsea Cable Trace Setup) after login finish
    try {
      localStorage.setItem('subsea_is_authenticated', 'true');
      localStorage.setItem('subsea_user_profile', JSON.stringify(user));

      // Automatically load default cable route (115 kV Koh Samui circuit 3) and Default Alarm Event csv after login
      const routeRes = await fetch('/Lat long of circuit 3.txt');
      if (routeRes.ok) {
        const routeText = await routeRes.text();
        const parsedRoute = parseCableRouteFile(routeText, '115 kV Koh Samui circuit 3');
        parsedRoute.id = 'circuit-3-samui';
        parsedRoute.isDefault = true;
        setCableRoute(parsedRoute);
        localStorage.setItem('subsea_active_cable_route', JSON.stringify(parsedRoute));
        // Save to Firestore
        saveCableRouteToFirestore(parsedRoute).catch(err => console.warn('Firestore sync route:', err));

        const eventsRes = await fetch('/Default Alarm Event.csv');
        if (eventsRes.ok) {
          const eventsText = await eventsRes.text();
          const parsedEvents = parseAlarmEventsCSV(eventsText, parsedRoute.waypoints);
          setEvents(parsedEvents);
          localStorage.setItem('subsea_alarm_events', JSON.stringify(parsedEvents));
          // Save to Firestore
          saveAlarmEventsToFirestore(parsedEvents).catch(err => console.warn('Firestore sync events:', err));
        }
      }
    } catch (e) {
      console.warn('LocalStorage or default loading error:', e);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('subsea_is_authenticated');
      localStorage.removeItem('subsea_active_cable_route');
      localStorage.removeItem('subsea_alarm_events');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  // Sync state to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('subsea_active_cable_route', JSON.stringify(cableRoute));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [cableRoute]);

  useEffect(() => {
    try {
      localStorage.setItem('subsea_saved_cable_routes', JSON.stringify(savedRoutes));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [savedRoutes]);

  useEffect(() => {
    try {
      localStorage.setItem('subsea_alarm_events', JSON.stringify(events));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem('subsea_historical_ships', JSON.stringify(historicalData));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [historicalData]);

  useEffect(() => {
    try {
      localStorage.setItem('subsea_user_profile', JSON.stringify(currentUser));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [currentUser]);

  // Handle Cable Route Updates
  const handleUpdateCableRoute = (newRoute: CableRoute) => {
    setCableRoute(newRoute);
    setSavedRoutes(prev => {
      const filtered = prev.filter(r => r.id !== newRoute.id && r.name !== newRoute.name);
      return [newRoute, ...filtered];
    });
  };

  // Filtered Events for Map & Table synchronized by Event Type dropdown and panel filters
  const displayedEvents = useMemo(() => {
    return events.filter(evt => {
      if (selectedFilterType !== 'All' && evt.eventType !== selectedFilterType) {
        return false;
      }
      if (eventTypeFilter !== 'ALL') {
        const eventDetail = evt.eventDetail || (evt.eventType === 'Alert' ? 'Ship Anchoring' : 'Ship Enter');
        if (eventDetail !== eventTypeFilter) return false;
      }
      return true;
    });
  }, [events, selectedFilterType, eventTypeFilter]);

  const alarmCount = useMemo(() => events.filter(e => e.eventType === 'Alarm').length, [events]);
  const alertCount = useMemo(() => events.filter(e => e.eventType === 'Alert').length, [events]);

  // Gate app behind Login Page
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cableRoute={cableRoute}
        onChangeRouteClick={() => setActiveTab('setup')}
        onDataManageClick={() => setActiveTab('setup')}
        onAuthClick={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        alarmCount={alarmCount}
        alertCount={alertCount}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* FIRST PAGE / STEP 1: Cable Trace Import & Setup */}
        {activeTab === 'setup' && (
          <CableSetupFirstPage
            currentRoute={cableRoute}
            savedRoutes={savedRoutes}
            events={events}
            onConfirmAndProceed={(newRoute) => {
              handleUpdateCableRoute(newRoute);
              setActiveTab('dashboard');
            }}
            onUpdateCableRoute={handleUpdateCableRoute}
            onUpdateAlarmEvents={setEvents}
          />
        )}

        {/* STEP 2: Dashboard Map with Live AIS Vectors & Inline CSV Uploader */}
        {activeTab === 'dashboard' && (
          <div className="space-y-3.5">
            {/* Direct In-Page CSV Upload Component for Dashboard */}
            <DashboardCsvUploadBar
              cableRoute={cableRoute}
              events={events}
              eventsCount={events.length}
              historicalCount={historicalData.length}
              onUpdateAlarmEvents={setEvents}
              onUpdateHistoricalData={setHistoricalData}
              onOpenDataModal={() => setIsDataModalOpen(true)}
            />

            {/* Top Dashboard Row: 70% Map Chart + 30% Right Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* 70% Map Chart Section (8 cols out of 12 = ~67-70%) */}
              <div className="lg:col-span-8 xl:col-span-8 flex flex-col h-[520px] lg:h-[620px]">
                <MapChart
                  cableRoute={cableRoute}
                  events={displayedEvents}
                  selectedEvent={selectedEvent}
                  onSelectEvent={setSelectedEvent}
                  hoveredMMSI={hoveredMMSI}
                  setHoveredMMSI={setHoveredMMSI}
                  parkingZone={parkingZone}
                  onSnapshotCaptured={setCapturedHeatmapImage}
                />
              </div>

              {/* 30% Right Panel Section (4 cols out of 12 = ~30-33%) */}
              <div className="lg:col-span-4 xl:col-span-4 flex flex-col h-[520px] lg:h-[620px]">
                <EventSummaryPanel
                  events={events}
                  cableRoute={cableRoute}
                  selectedFilterType={selectedFilterType}
                  setSelectedFilterType={setSelectedFilterType}
                  onSelectEvent={setSelectedEvent}
                  hoveredMMSI={hoveredMMSI}
                  setHoveredMMSI={setHoveredMMSI}
                />
              </div>
            </div>

            {/* Bottom Section: Scrollable Detailed Event Log Table */}
            <div>
              <EventLogTable
                events={displayedEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                hoveredMMSI={hoveredMMSI}
                setHoveredMMSI={setHoveredMMSI}
                eventTypeFilter={eventTypeFilter}
                onEventTypeFilterChange={setEventTypeFilter}
              />
            </div>
          </div>
        )}

        {/* STEP 3: Statistical Data Analysis Tab (Summarized directly from second page data) */}
        {activeTab === 'statistics' && (
          <StatisticalAnalysisPage
            events={events}
            cableRoute={cableRoute}
            parkingZone={parkingZone}
            capturedHeatmapImage={capturedHeatmapImage}
            onImageCaptured={setCapturedHeatmapImage}
          />
        )}
      </main>

      {/* Modals */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        cableRoute={cableRoute}
        events={events}
        onUpdateCableRoute={handleUpdateCableRoute}
        onUpdateAlarmEvents={setEvents}
        onUpdateHistoricalData={setHistoricalData}
      />

      <CableRouteModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        currentRoute={cableRoute}
        savedRoutes={savedRoutes}
        onSelectRoute={setCableRoute}
        onAddNewRoute={handleUpdateCableRoute}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={setCurrentUser}
        onLogout={handleLogout}
      />
    </div>
  );
}
