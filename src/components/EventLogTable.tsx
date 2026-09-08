import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlarmEvent } from '../types';
import {
  Search,
  Download,
  ArrowUpDown,
  Ship,
  X,
  Anchor,
  LogIn,
  LogOut,
  Info as InfoIcon,
  CheckCircle2,
} from 'lucide-react';
import { formatDisplayDateTime } from '../utils/geoUtils';

interface EventLogTableProps {
  events: AlarmEvent[];
  selectedEvent: AlarmEvent | null;
  onSelectEvent: (event: AlarmEvent | null) => void;
  hoveredMMSI: string | null;
  setHoveredMMSI: (mmsi: string | null) => void;
  eventTypeFilter?: 'ALL' | 'Ship Enter' | 'Ship Exit' | 'Ship Anchoring';
  onEventTypeFilterChange?: (filter: 'ALL' | 'Ship Enter' | 'Ship Exit' | 'Ship Anchoring') => void;
  onUpdateEventStatus?: (eventId: string, newStatus: any) => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  hoveredMMSI,
  setHoveredMMSI,
  eventTypeFilter: externalFilterType,
  onEventTypeFilterChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalFilterType, setInternalFilterType] = useState<'ALL' | 'Ship Enter' | 'Ship Exit' | 'Ship Anchoring'>('ALL');
  const filterType = externalFilterType !== undefined ? externalFilterType : internalFilterType;
  const setFilterType = (newType: 'ALL' | 'Ship Enter' | 'Ship Exit' | 'Ship Anchoring') => {
    if (onEventTypeFilterChange) {
      onEventTypeFilterChange(newType);
    } else {
      setInternalFilterType(newType);
    }
  };

  const [sortField, setSortField] = useState<'timestamp' | 'vesselName' | 'distance' | 'tonnage'>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  const pageSize = 10;

  // Filter & Search over all events by ship name, MMSI, ship type, and info
  const filteredEvents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return events.filter(evt => {
      const matchesSearch =
        !term ||
        (evt.vesselName && evt.vesselName.toLowerCase().includes(term)) ||
        (evt.mmsi && evt.mmsi.toLowerCase().includes(term)) ||
        (evt.shipType && evt.shipType.toLowerCase().includes(term)) ||
        (evt.info && evt.info.toLowerCase().includes(term));

      const eventDetail = evt.eventDetail || (evt.eventType === 'Alert' ? 'Ship Anchoring' : 'Ship Enter');
      const matchesType = filterType === 'ALL' || eventDetail === filterType;

      return matchesSearch && matchesType;
    });
  }, [events, searchTerm, filterType]);

  // Sort
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      let comp = 0;
      if (sortField === 'timestamp') {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        comp = (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
      } else if (sortField === 'vesselName') {
        comp = (a.vesselName || '').localeCompare(b.vesselName || '');
      } else if (sortField === 'distance') {
        comp = a.distanceToCableMeters - b.distanceToCableMeters;
      } else if (sortField === 'tonnage') {
        comp = a.grossTonnage - b.grossTonnage;
      }
      return sortAsc ? comp : -comp;
    });
  }, [filteredEvents, sortField, sortAsc]);

  // Auto-jump to page containing selectedEvent when clicked on map
  useEffect(() => {
    if (!selectedEvent) return;
    const targetIdx = sortedEvents.findIndex(
      e => e.id === selectedEvent.id || (e.mmsi === selectedEvent.mmsi && e.timestamp === selectedEvent.timestamp)
    );
    if (targetIdx !== -1) {
      const targetPage = Math.floor(targetIdx / pageSize) + 1;
      setCurrentPage(targetPage);
    }
  }, [selectedEvent, sortedEvents]);

  // Smooth scroll highlighted row into view
  useEffect(() => {
    if (selectedEvent && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedEvent, currentPage]);

  // Pagination - 10 items per page
  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const displayEvents = sortedEvents.slice(startIndex, startIndex + pageSize);

  // Export filtered events to CSV (including Ship Name)
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Event Type', 'Ship Name', 'MMSI', 'Ship Type', 'Ton Gross', 'Distance from zone', 'Info'];
    const rows = sortedEvents.map(e => [
      `"${formatDisplayDateTime(e.timestamp)}"`,
      `"${e.eventDetail || (e.eventType === 'Alert' ? 'Ship Anchoring' : 'Ship Enter')}"`,
      `"${(e.vesselName || '').replace(/"/g, '""')}"`,
      e.mmsi,
      `"${e.shipType}"`,
      e.grossTonnage,
      e.distanceToCableMeters,
      `"${(e.info || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `incident_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="detailed-incident-log-section" className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Table Toolbar */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <Ship className="w-4 h-4 text-cyan-400" />
            Detailed Maritime Incident Logs
          </h3>

          {selectedEvent ? (
            <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/70 px-3 py-1 rounded-full text-xs text-cyan-200 shadow-md">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>
                Highlighted: <strong className="text-white">{selectedEvent.vesselName}</strong> (MMSI: <span className="font-mono">{selectedEvent.mmsi}</span>)
              </span>
              <button
                id="btn-clear-table-selection"
                onClick={() => onSelectEvent(null)}
                className="hover:bg-slate-800 p-0.5 rounded text-slate-400 hover:text-white cursor-pointer transition ml-1"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-cyan-300 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800 font-medium">
              Showing ({sortedEvents.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + pageSize, sortedEvents.length)} of {sortedEvents.length})
            </span>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Search Box - Search by Ship Name or MMSI */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              id="input-search-events"
              type="text"
              placeholder="Search ship name, MMSI..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs w-48 sm:w-56"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 text-slate-400 hover:text-white cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Event Detail Type Filter */}
          <select
            id="select-filter-type"
            value={filterType}
            onChange={e => {
              setFilterType(e.target.value as any);
              setCurrentPage(1);
            }}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs cursor-pointer"
          >
            <option value="ALL">All Event Types</option>
            <option value="Ship Enter">Ship Enter</option>
            <option value="Ship Exit">Ship Exit</option>
            <option value="Ship Anchoring">Ship Anchoring</option>
          </select>

          {/* Export CSV Button */}
          <button
            id="btn-export-log-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title="Download Filtered Records as CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Viewport with 8 Columns (including Ship Name) */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-20 border-b border-slate-800">
            <tr>
              {/* Column 1: Time Stamp */}
              <th
                onClick={() => {
                  setSortField('timestamp');
                  setSortAsc(!sortAsc);
                }}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Timestamp</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* Column 2: Event Type */}
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Event Type</th>

              {/* Column 3: Ship Name */}
              <th
                onClick={() => {
                  setSortField('vesselName');
                  setSortAsc(!sortAsc);
                }}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <Ship className="w-3 h-3 text-cyan-400" />
                  <span>Ship Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* Column 4: MMSI */}
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">MMSI</th>

              {/* Column 5: Ship Type */}
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Ship Type</th>

              {/* Column 6: Ton Gross */}
              <th
                onClick={() => {
                  setSortField('tonnage');
                  setSortAsc(!sortAsc);
                }}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Ton Gross</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* Column 7: Distance from zone */}
              <th
                onClick={() => {
                  setSortField('distance');
                  setSortAsc(!sortAsc);
                }}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Distance from Zone</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* Column 8: Info */}
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap min-w-[220px]">
                <div className="flex items-center gap-1">
                  <InfoIcon className="w-3 h-3 text-cyan-400" />
                  <span>Info (AIS Base Station Message)</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
            {displayEvents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                  No matching incident records found for search term "{searchTerm}".
                </td>
              </tr>
            ) : (
              displayEvents.map(evt => {
                const isSelected = selectedEvent?.id === evt.id || (selectedEvent !== null && selectedEvent.mmsi === evt.mmsi && selectedEvent.timestamp === evt.timestamp);
                const isMmsiActive = selectedEvent?.mmsi === evt.mmsi || hoveredMMSI === evt.mmsi;
                const eventDetail = evt.eventDetail || (evt.eventType === 'Alert' ? 'Ship Anchoring' : 'Ship Enter');
                const isAnchoring = eventDetail === 'Ship Anchoring' || evt.eventType === 'Alert';
                const isExit = eventDetail === 'Ship Exit';

                return (
                  <tr
                    key={evt.id}
                    ref={isSelected ? selectedRowRef : null}
                    onMouseEnter={() => setHoveredMMSI(evt.mmsi)}
                    onMouseLeave={() => setHoveredMMSI(null)}
                    onClick={() => onSelectEvent(evt)}
                    className={`transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-950/90 via-blue-950/80 to-slate-900 border-l-4 border-l-cyan-400 text-white shadow-lg ring-1 ring-cyan-400/80'
                        : isMmsiActive
                        ? 'bg-slate-800/90 border-l-4 border-l-sky-500/60'
                        : isAnchoring
                        ? 'hover:bg-rose-950/30'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* 1. Time stamp */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {isSelected && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-bold border border-cyan-400 text-[9px] uppercase tracking-wider">
                            SELECTED
                          </span>
                        )}
                        <span className={isSelected ? 'text-cyan-200 font-bold' : 'text-slate-200'}>
                          {formatDisplayDateTime(evt.timestamp)}
                        </span>
                      </div>
                    </td>

                    {/* 2. Specific Event Type */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {isAnchoring ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-rose-950/80 text-rose-300 border-rose-700/60">
                          <Anchor className="w-3 h-3 text-rose-400" />
                          Ship Anchoring
                        </span>
                      ) : isExit ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-indigo-950/80 text-indigo-300 border-indigo-700/60">
                          <LogOut className="w-3 h-3 text-indigo-400" />
                          Ship Exit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-cyan-950/80 text-cyan-300 border-cyan-700/60">
                          <LogIn className="w-3 h-3 text-cyan-400" />
                          Ship Enter
                        </span>
                      )}
                    </td>

                    {/* 3. Ship Name */}
                    <td className={`py-2.5 px-3 whitespace-nowrap font-medium ${isSelected ? 'text-cyan-200 font-bold' : 'text-slate-100'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[140px] sm:max-w-[180px]">{evt.vesselName}</span>
                      </div>
                    </td>

                    {/* 4. MMSI */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-cyan-300 font-semibold text-[11px]">
                      {evt.mmsi}
                    </td>

                    {/* 5. Ship type */}
                    <td className={`py-2.5 px-3 whitespace-nowrap ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
                      {evt.shipType}
                    </td>

                    {/* 6. Ton gross */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-200 font-semibold">
                      {evt.grossTonnage.toLocaleString()} GT
                    </td>

                    {/* 7. Distance from zone */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                      <span className={evt.distanceToCableMeters < 200 ? 'text-rose-400 font-bold' : 'text-amber-300 font-medium'}>
                        {evt.distanceToCableMeters} m
                      </span>
                    </td>

                    {/* 8. Info */}
                    <td className="py-2.5 px-3 text-slate-300 text-[11px] max-w-xs sm:max-w-md truncate" title={evt.info}>
                      <span className={isSelected ? 'text-slate-100 font-medium' : ''}>
                        {evt.info || 'No AIS transmission log recorded.'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="text-[11px]">
          Showing <strong className="text-cyan-300">10</strong> events per page • Total <span className="text-slate-200 font-semibold">{sortedEvents.length}</span> records
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            Previous
          </button>
          <span className="text-[11px] font-mono text-slate-300">
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};


