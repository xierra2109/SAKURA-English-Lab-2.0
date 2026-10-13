import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Users, 
  Plus, 
  Search, 
  Filter, 
  BookmarkPlus,
  ArrowRight,
  Sun,
  Layers,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Booking } from '../types';
import { CALENDAR_HOURS, TIMETABLE_PERIODS, formatTime12h, calculateDurationHours } from '../data/timeSlots';

interface BookingCalendarProps {
  bookings: Booking[];
  schoolLogo?: string | null;
  onSelectBooking: (booking: Booking) => void;
  onQuickBookSlot: (date: string, startTime: string) => void;
  onOpenBookingModal: (isPrebooking?: boolean, date?: string, startTime?: string) => void;
}

type CalendarViewMode = 'week' | 'month' | 'day';

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
  schoolLogo,
  onSelectBooking,
  onQuickBookSlot,
  onOpenBookingModal,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Period Range for condensed display: 'academic' (Periods 1-12 | 7:00 AM - 1:30 PM) or 'all' (7:00 AM - 5:00 PM)
  const [periodRange, setPeriodRange] = useState<'academic' | 'all'>('academic');

  // Mobile specific states for condensed view
  const [mobileDayIndex, setMobileDayIndex] = useState<number>(0);
  const [mobileViewType, setMobileViewType] = useState<'periods' | 'summary'>('periods');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'all_including_cancelled' | 'regular' | 'prebooking' | 'completed' | 'cancelled'>('all');

  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = formatDateISO(new Date());
  const nowTimeStr = new Date().toTimeString().slice(0, 5);

  // Week view calculation: Mon-Fri by default; include Saturday/Sunday ONLY if there is a booking on those days
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Monday of current week
    const monday = new Date(curr);
    monday.setDate(diff);

    // Default: Mon (0) to Fri (4)
    const days: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }

    // Check Saturday (5)
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    const satStr = formatDateISO(saturday);
    const hasSatBooking = bookings.some(b => b.status !== 'cancelled' && b.date === satStr);

    // Check Sunday (6)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sunStr = formatDateISO(sunday);
    const hasSunBooking = bookings.some(b => b.status !== 'cancelled' && b.date === sunStr);

    if (hasSatBooking) {
      days.push(saturday);
    }
    if (hasSunBooking) {
      days.push(sunday);
    }

    return days;
  }, [currentDate, bookings]);

  // Keep mobile day selection valid when week changes
  const effectiveMobileDayIndex = useMemo(() => {
    if (mobileDayIndex >= weekDays.length) return 0;
    return mobileDayIndex;
  }, [mobileDayIndex, weekDays]);

  // Active periods based on range selection:
  // 'academic' = Periods 1 to 12 + Rehat (07:00 - 13:30) [13 slots - fits 100% width on desktop!]
  // 'all' = All 20 periods (07:00 - 17:00)
  const activePeriods = useMemo(() => {
    if (periodRange === 'academic') {
      return TIMETABLE_PERIODS.slice(0, 13);
    }
    return TIMETABLE_PERIODS;
  }, [periodRange]);

  // Check if any booking occurs in afternoon (after 13:30)
  const hasAfternoonBookingsThisWeek = useMemo(() => {
    return weekDays.some(day => {
      const dStr = formatDateISO(day);
      return bookings.some(b => b.status !== 'cancelled' && b.date === dStr && b.endTime > '13:30');
    });
  }, [weekDays, bookings]);

  // Unique teachers
  const teacherList = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach(b => {
      if (b.teacherName) set.add(b.teacherName);
    });
    return Array.from(set).sort();
  }, [bookings]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const isPast = b.date < todayStr || (b.date === todayStr && b.endTime <= nowTimeStr);

      if (selectedFilter === 'cancelled') {
        if (b.status !== 'cancelled') return false;
      } else if (selectedFilter === 'all_including_cancelled') {
        // Keep all records
      } else if (selectedFilter === 'completed') {
        if (b.status === 'cancelled' || !isPast) return false;
      } else {
        // Hide cancelled by default
        if (b.status === 'cancelled') return false;
        if (selectedFilter === 'prebooking' && !b.isPrebooking) return false;
        if (selectedFilter === 'regular' && b.isPrebooking) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = b.title.toLowerCase().includes(q);
        const matchTeacher = b.teacherName.toLowerCase().includes(q);
        const matchClass = b.className.toLowerCase().includes(q);
        if (!matchTitle && !matchTeacher && !matchClass) return false;
      }
      if (selectedTeacher !== 'all' && b.teacherName !== selectedTeacher) return false;
      return true;
    });
  }, [bookings, searchQuery, selectedTeacher, selectedFilter, todayStr, nowTimeStr]);

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  // Detailed 30-minute status for an hour block in day view
  const getHourSlotStatus = (dateStr: string, hourStr: string) => {
    const [h] = hourStr.split(':').map(Number);
    const nextH = h + 1;
    const nextHourStr = `${nextH.toString().padStart(2, '0')}:00`;
    const timeStr1 = `${h.toString().padStart(2, '0')}:00`;
    const timeStr2 = `${h.toString().padStart(2, '0')}:30`;

    const dayBookings = filteredBookings.filter(b => b.date === dateStr);

    const slot1Booking = dayBookings.find(b => {
      return b.startTime <= timeStr1 && b.endTime >= timeStr2;
    });

    const slot2Booking = dayBookings.find(b => {
      return b.startTime <= timeStr2 && b.endTime >= nextHourStr;
    });

    const isFullHourSameBooking =
      Boolean(slot1Booking && slot2Booking && slot1Booking.id === slot2Booking.id);

    return {
      hourStr,
      nextHourStr,
      timeStr1,
      timeStr2,
      slot1Booking,
      slot2Booking,
      isFullHourSameBooking,
      fullBooking: isFullHourSameBooking ? slot1Booking : null,
    };
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xs border border-stone-200 overflow-hidden font-sans">
      {/* Calendar Control Bar */}
      <div className="p-3 sm:p-5 border-b border-stone-200 bg-stone-50/70">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Date Range Navigation */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-white rounded-xl border border-stone-300 shadow-2xs p-0.5">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-sm sm:text-base font-bold text-stone-800 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-rose-600 shrink-0" />
              {viewMode === 'week' && weekDays.length > 0 && (
                <span>
                  {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                  {weekDays[weekDays.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {viewMode === 'month' && (
                <span>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              )}
              {viewMode === 'day' && (
                <span>{currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
            </h2>
          </div>

          {/* Quick Actions & View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none min-w-[140px] sm:min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search teacher, class..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-rose-400"
              />
            </div>

            {/* View Switcher: Week / Month / Day */}
            <div className="flex bg-stone-200/60 p-0.5 rounded-xl border border-stone-300 text-xs font-medium">
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  viewMode === 'week' ? 'bg-white text-stone-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  viewMode === 'month' ? 'bg-white text-stone-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  viewMode === 'day' ? 'bg-white text-stone-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Day
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => onOpenBookingModal(true)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200/80 transition-colors flex items-center gap-1"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Pre-Book</span>
            </button>

            <button
              onClick={() => onOpenBookingModal(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-200/90 text-rose-950 border border-rose-300 hover:bg-rose-200 transition-colors shadow-2xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Book</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter & Condensed View Toggle Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-200/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-stone-500 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter:</span>
            </div>

            <select
              value={selectedTeacher}
              onChange={e => setSelectedTeacher(e.target.value)}
              className="text-xs bg-white border border-stone-300 rounded-lg px-2 py-1 text-stone-700 max-w-[140px] truncate"
            >
              <option value="all">All Teachers ({teacherList.length})</option>
              {teacherList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={selectedFilter}
              onChange={e => setSelectedFilter(e.target.value as any)}
              className="text-xs bg-white border border-stone-300 rounded-lg px-2 py-1 text-stone-700 max-w-[180px] truncate"
            >
              <option value="all">Active &amp; Done</option>
              <option value="all_including_cancelled">All (inc. Cancelled)</option>
              <option value="completed">Completed Only</option>
              <option value="regular">Regular Bookings</option>
              <option value="prebooking">Pre-Bookings Only</option>
              <option value="cancelled">Cancelled Only</option>
            </select>

            {(selectedTeacher !== 'all' || selectedFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedTeacher('all');
                  setSelectedFilter('all');
                  setSearchQuery('');
                }}
                className="text-rose-700 hover:text-rose-900 text-xs font-semibold"
              >
                Reset
              </button>
            )}
          </div>

          {/* Condensed Period Scope Toggle (School Hours vs Full Day) */}
          {viewMode === 'week' && (
            <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-lg border border-stone-300 text-[11px] font-semibold ml-auto">
              <button
                onClick={() => setPeriodRange('academic')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                  periodRange === 'academic'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="School Timetable Periods 1-12 (7:00 AM – 1:30 PM) condensed to 1 single screen without scrolling"
              >
                <Sun className="w-3 h-3 text-amber-600" />
                <span>School Hours (P1–P12)</span>
              </button>
              <button
                onClick={() => setPeriodRange('all')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                  periodRange === 'all'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="All Periods including afternoon (7:00 AM – 5:00 PM)"
              >
                <Layers className="w-3 h-3 text-teal-600" />
                <span>All Day (P1–P17)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* WEEK VIEW: CONDENSED TO 1 DISPLAY WITHOUT SCROLLING      */}
      {/* ======================================================== */}
      {viewMode === 'week' && (
        <div>
          {/* Subtle Notice Bar */}
          <div className="px-3.5 py-1.5 bg-stone-50 border-b border-stone-200 text-[11px] text-stone-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Condensed View · All periods visible at a glance (No scrolling between periods)</span>
            </span>
            {periodRange === 'academic' && hasAfternoonBookingsThisWeek && (
              <button
                onClick={() => setPeriodRange('all')}
                className="text-amber-800 hover:underline font-bold text-[10px] flex items-center gap-1"
              >
                <span>⚠️ Afternoon session exists · Switch to All Day</span>
              </button>
            )}
          </div>

          {/* ---------------------------------------------------- */}
          {/* 1. DESKTOP VIEW (md and up): 100% WIDTH TABLE FIXED  */}
          {/* ---------------------------------------------------- */}
          <div className="hidden md:block w-full select-none overflow-hidden">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                {/* Fixed Date & Day Column */}
                <col className="w-24 lg:w-28" />
                {/* Dynamically distributed period columns filling 100% of remaining width */}
                {activePeriods.map(p => (
                  <col key={p.startTime} />
                ))}
              </colgroup>

              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px]">
                  {/* Left Header: Date & Day */}
                  <th className="py-2.5 px-2 text-left font-bold text-stone-700 border-r border-stone-200 bg-stone-100/90">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                      <span>Date &amp; Day</span>
                    </div>
                  </th>

                  {/* Period Headers (P1, P2... Rehat...) */}
                  {activePeriods.map(period => (
                    <th
                      key={period.startTime}
                      className={`py-1.5 px-0.5 text-center border-r border-stone-200 font-semibold overflow-hidden ${
                        period.isRehat ? 'bg-amber-100/60 text-amber-950' : 'bg-stone-50 text-stone-700'
                      }`}
                      title={`${period.isRehat ? 'Recess / Rehat' : `Period ${period.periodNumber}`}: ${period.timeLabel}`}
                    >
                      <div className="font-bold text-[10px] uppercase tracking-tight truncate">
                        {period.isRehat ? 'Rehat' : `P${period.periodNumber || ''}`}
                      </div>
                      <div className="font-mono text-[9px] text-stone-500 leading-none mt-0.5 truncate">
                        {period.startTime}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-200">
                {weekDays.map(day => {
                  const dayStr = formatDateISO(day);
                  const isToday = dayStr === todayStr;
                  const dayBookings = filteredBookings
                    .filter(b => b.date === dayStr)
                    .sort((a, b) => {
                      if (a.status !== 'cancelled' && b.status === 'cancelled') return -1;
                      if (a.status === 'cancelled' && b.status !== 'cancelled') return 1;
                      return 0;
                    });

                  return (
                    <tr
                      key={dayStr}
                      className={`hover:bg-stone-50/40 transition-colors h-20 ${
                        isToday ? 'bg-rose-50/20' : 'bg-white'
                      }`}
                    >
                      {/* Left Cell: Day & Date */}
                      <td
                        className={`border-r border-stone-200 p-2 align-middle ${
                          isToday ? 'bg-rose-50/90' : 'bg-white'
                        }`}
                      >
                        <div className="font-bold text-xs text-stone-900 leading-tight">
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-[10px] text-stone-500 font-medium">
                          {day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </div>
                        {isToday && (
                          <span className="inline-block mt-1 px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-950 font-bold text-[9px] border border-rose-300">
                            Today
                          </span>
                        )}
                      </td>

                      {/* Period Cells: Colspan across multi-period bookings */}
                      {(() => {
                        const cells: React.ReactNode[] = [];
                        let i = 0;

                        while (i < activePeriods.length) {
                          const period = activePeriods[i];
                          const [psh, psm] = period.startTime.split(':').map(Number);
                          const [peh, pem] = period.endTime.split(':').map(Number);
                          const pStartMin = psh * 60 + psm;
                          const pEndMin = peh * 60 + pem;

                          const overlappingBooking = dayBookings.find(b => {
                            const [bsh, bsm] = b.startTime.split(':').map(Number);
                            const [beh, bem] = b.endTime.split(':').map(Number);
                            const bStartMin = bsh * 60 + bsm;
                            const bEndMin = beh * 60 + bem;
                            return bStartMin < pEndMin && bEndMin > pStartMin;
                          });

                          if (overlappingBooking) {
                            // Calculate span within activePeriods
                            let span = 1;
                            while (i + span < activePeriods.length) {
                              const nextPeriod = activePeriods[i + span];
                              const [nsh, nsm] = nextPeriod.startTime.split(':').map(Number);
                              const [neh, nem] = nextPeriod.endTime.split(':').map(Number);
                              const nStartMin = nsh * 60 + nsm;
                              const nEndMin = neh * 60 + nem;

                              const [bsh, bsm] = overlappingBooking.startTime.split(':').map(Number);
                              const [beh, bem] = overlappingBooking.endTime.split(':').map(Number);
                              const bStartMin = bsh * 60 + bsm;
                              const bEndMin = beh * 60 + bem;

                              if (bStartMin < nEndMin && bEndMin > nStartMin) {
                                span++;
                              } else {
                                break;
                              }
                            }

                            const isPast = overlappingBooking.date < todayStr || 
                              (overlappingBooking.date === todayStr && overlappingBooking.endTime <= nowTimeStr);
                            const isCancelled = overlappingBooking.status === 'cancelled';

                            cells.push(
                              <td
                                key={`${dayStr}-${period.startTime}`}
                                colSpan={span}
                                className="p-0.5 border-r border-stone-200 align-middle h-20"
                              >
                                <div
                                  onClick={() => onSelectBooking(overlappingBooking)}
                                  className={`h-full w-full rounded-lg p-1 text-left cursor-pointer transition-all border shadow-2xs hover:shadow-xs flex flex-col justify-between overflow-hidden ${
                                    isCancelled
                                      ? 'bg-stone-100/90 border-stone-300 text-stone-500 hover:border-stone-400'
                                      : isPast
                                      ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400 text-emerald-950'
                                      : overlappingBooking.isPrebooking
                                      ? 'bg-amber-50 border-amber-300 hover:border-amber-400 text-amber-950'
                                      : 'bg-teal-50 border-teal-300 hover:border-teal-400 text-teal-950'
                                  }`}
                                  title={`${overlappingBooking.title} | Class: ${overlappingBooking.className} | Teacher: ${overlappingBooking.teacherName} | Time: ${formatTime12h(overlappingBooking.startTime)} - ${formatTime12h(overlappingBooking.endTime)}`}
                                >
                                  {/* Top Row: Class & Time */}
                                  <div className="flex items-center justify-between leading-tight gap-0.5">
                                    <span className={`font-bold text-[10px] truncate ${isCancelled ? 'line-through text-stone-400' : ''}`}>
                                      {overlappingBooking.className}
                                    </span>
                                    {span > 1 && (
                                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-black/5 shrink-0">
                                        {overlappingBooking.startTime}–{overlappingBooking.endTime}
                                      </span>
                                    )}
                                  </div>

                                  {/* Middle Row: Purpose / Activity Title */}
                                  <div className={`text-[9px] font-medium truncate my-0.5 leading-tight ${isCancelled ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                                    {overlappingBooking.title}
                                  </div>

                                  {/* Bottom Row: Teacher & Status */}
                                  <div className="flex items-center justify-between text-[9px] text-stone-600 leading-tight">
                                    <span className="truncate font-semibold">{overlappingBooking.teacherName}</span>
                                    {isCancelled ? (
                                      <span className="shrink-0 text-stone-500 font-bold text-[8px]">❌</span>
                                    ) : isPast ? (
                                      <span className="shrink-0 text-emerald-800 font-bold text-[8px]">✓</span>
                                    ) : overlappingBooking.isPrebooking ? (
                                      <span className="shrink-0 text-amber-800 font-bold text-[8px]">Pre</span>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            );

                            i += span;
                          } else {
                            // Free slot cell
                            cells.push(
                              <td
                                key={`${dayStr}-${period.startTime}`}
                                colSpan={1}
                                className={`p-0.5 border-r border-stone-200 align-middle h-20 ${
                                  period.isRehat ? 'bg-amber-50/20' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => onQuickBookSlot(dayStr, period.startTime)}
                                  className="w-full h-full rounded-md border border-dashed border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/60 flex flex-col items-center justify-center text-stone-300 hover:text-emerald-800 transition-all group p-0.5"
                                  title={`Free: Click to book ${period.timeLabel} on ${dayStr}`}
                                >
                                  <Plus className="w-3 h-3 group-hover:scale-125 transition-transform text-stone-300 group-hover:text-emerald-700" />
                                  <span className="text-[8px] font-semibold text-stone-400 group-hover:text-emerald-800 mt-0.5">
                                    {period.isRehat ? 'Rehat' : 'Free'}
                                  </span>
                                </button>
                              </td>
                            );

                            i++;
                          }
                        }

                        return cells;
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ---------------------------------------------------- */}
          {/* 2. MOBILE VIEW (< md): CONDENSED 1-SCREEN DISPLAY    */}
          {/* ---------------------------------------------------- */}
          <div className="block md:hidden p-3 bg-stone-50/50">
            {/* Mobile Day Selector Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-stone-200/70 rounded-xl mb-3 overflow-x-auto scrollbar-none">
              {weekDays.map((day, idx) => {
                const dayStr = formatDateISO(day);
                const isToday = dayStr === todayStr;
                const isSelected = effectiveMobileDayIndex === idx;
                const dayBookingsCount = filteredBookings.filter(b => b.date === dayStr && b.status !== 'cancelled').length;

                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => setMobileDayIndex(idx)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all min-w-[55px] ${
                      isSelected
                        ? 'bg-rose-500 text-white font-bold shadow-xs'
                        : isToday
                        ? 'bg-rose-100 text-rose-950 font-semibold border border-rose-200'
                        : 'bg-white text-stone-700 border border-stone-200 font-medium'
                    }`}
                  >
                    <div className="text-[9px] uppercase tracking-wider leading-tight">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-xs font-bold leading-tight mt-0.5">
                      {day.getDate()}
                    </div>
                    {dayBookingsCount > 0 && (
                      <span className={`text-[8px] font-mono px-1 py-0.2 rounded-full inline-block mt-0.5 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'
                      }`}>
                        {dayBookingsCount} bk
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile View Toggle: Periods Grid vs Summary */}
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-stone-200">
              <span className="text-xs font-bold text-stone-800">
                {weekDays[effectiveMobileDayIndex]?.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>

              <div className="flex items-center bg-stone-200/80 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMobileViewType('periods')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    mobileViewType === 'periods' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600'
                  }`}
                >
                  All Periods (P1–P12)
                </button>
                <button
                  type="button"
                  onClick={() => setMobileViewType('summary')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    mobileViewType === 'summary' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600'
                  }`}
                >
                  5-Day Summary
                </button>
              </div>
            </div>

            {/* Mobile Sub-View A: Condensed Period Grid for Selected Day */}
            {mobileViewType === 'periods' && (() => {
              const selectedDay = weekDays[effectiveMobileDayIndex];
              const dayStr = formatDateISO(selectedDay);
              const dayBookings = filteredBookings.filter(b => b.date === dayStr);

              return (
                <div className="space-y-3">
                  {/* Morning & Midday Periods Laid Out in a Condensed 2-Column Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Column 1: Morning Periods P1 to P6 */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider px-1">
                        Morning (P1 – P6)
                      </div>
                      {TIMETABLE_PERIODS.slice(0, 6).map(period => {
                        const [psh, psm] = period.startTime.split(':').map(Number);
                        const [peh, pem] = period.endTime.split(':').map(Number);
                        const pStartMin = psh * 60 + psm;
                        const pEndMin = peh * 60 + pem;

                        const booking = dayBookings.find(b => {
                          const [bsh, bsm] = b.startTime.split(':').map(Number);
                          const [beh, bem] = b.endTime.split(':').map(Number);
                          return (bsh * 60 + bsm) < pEndMin && (beh * 60 + bem) > pStartMin;
                        });

                        return (
                          <div
                            key={period.startTime}
                            className={`p-2 rounded-xl border text-xs transition-all ${
                              booking
                                ? booking.status === 'cancelled'
                                  ? 'bg-stone-100 border-stone-300 text-stone-400'
                                  : booking.date < todayStr || (booking.date === todayStr && booking.endTime <= nowTimeStr)
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                  : booking.isPrebooking
                                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                                  : 'bg-teal-50 border-teal-300 text-teal-950'
                                : 'bg-white border-stone-200 hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono text-[9px] text-stone-500">
                              <span className="font-bold text-stone-700">P{period.periodNumber}</span>
                              <span>{period.timeLabel}</span>
                            </div>

                            {booking ? (
                              <div
                                onClick={() => onSelectBooking(booking)}
                                className="mt-1 cursor-pointer"
                              >
                                <div className="font-bold text-xs truncate">{booking.className}</div>
                                <div className="text-[10px] text-stone-700 truncate">{booking.title}</div>
                                <div className="text-[9px] text-stone-500 mt-0.5 truncate">{booking.teacherName}</div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onQuickBookSlot(dayStr, period.startTime)}
                                className="w-full mt-1.5 py-1 px-1.5 rounded-lg bg-stone-100 hover:bg-emerald-100 text-stone-600 hover:text-emerald-900 font-semibold text-[10px] flex items-center justify-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3 text-emerald-600" />
                                <span>Book Free</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Column 2: Midday Periods P7 to P12 */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider px-1">
                        Midday (P7 – P12)
                      </div>
                      {TIMETABLE_PERIODS.slice(7, 13).map(period => {
                        const [psh, psm] = period.startTime.split(':').map(Number);
                        const [peh, pem] = period.endTime.split(':').map(Number);
                        const pStartMin = psh * 60 + psm;
                        const pEndMin = peh * 60 + pem;

                        const booking = dayBookings.find(b => {
                          const [bsh, bsm] = b.startTime.split(':').map(Number);
                          const [beh, bem] = b.endTime.split(':').map(Number);
                          return (bsh * 60 + bsm) < pEndMin && (beh * 60 + bem) > pStartMin;
                        });

                        return (
                          <div
                            key={period.startTime}
                            className={`p-2 rounded-xl border text-xs transition-all ${
                              booking
                                ? booking.status === 'cancelled'
                                  ? 'bg-stone-100 border-stone-300 text-stone-400'
                                  : booking.date < todayStr || (booking.date === todayStr && booking.endTime <= nowTimeStr)
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                  : booking.isPrebooking
                                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                                  : 'bg-teal-50 border-teal-300 text-teal-950'
                                : 'bg-white border-stone-200 hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono text-[9px] text-stone-500">
                              <span className="font-bold text-stone-700">P{period.periodNumber}</span>
                              <span>{period.timeLabel}</span>
                            </div>

                            {booking ? (
                              <div
                                onClick={() => onSelectBooking(booking)}
                                className="mt-1 cursor-pointer"
                              >
                                <div className="font-bold text-xs truncate">{booking.className}</div>
                                <div className="text-[10px] text-stone-700 truncate">{booking.title}</div>
                                <div className="text-[9px] text-stone-500 mt-0.5 truncate">{booking.teacherName}</div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onQuickBookSlot(dayStr, period.startTime)}
                                className="w-full mt-1.5 py-1 px-1.5 rounded-lg bg-stone-100 hover:bg-emerald-100 text-stone-600 hover:text-emerald-900 font-semibold text-[10px] flex items-center justify-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3 text-emerald-600" />
                                <span>Book Free</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rehat Strip (10:00 - 10:30) */}
                  <div className="p-2 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-950 text-xs flex items-center justify-between">
                    <span className="font-bold text-[11px]">Recess / Rehat (10:00 AM – 10:30 AM)</span>
                    <button
                      type="button"
                      onClick={() => onQuickBookSlot(dayStr, '10:00')}
                      className="text-[10px] font-bold text-amber-900 underline"
                    >
                      Book Rehat slot
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Mobile Sub-View B: 5-Day Condensed Summary */}
            {mobileViewType === 'summary' && (
              <div className="space-y-2.5">
                {weekDays.map(day => {
                  const dayStr = formatDateISO(day);
                  const isToday = dayStr === todayStr;
                  const dayBookings = filteredBookings.filter(b => b.date === dayStr && b.status !== 'cancelled');

                  return (
                    <div
                      key={dayStr}
                      className={`p-3 rounded-xl border bg-white ${
                        isToday ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-stone-800">
                            {day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-950 text-[9px] font-bold">
                              Today
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-stone-500 font-semibold">
                          {dayBookings.length} {dayBookings.length === 1 ? 'session' : 'sessions'}
                        </span>
                      </div>

                      {dayBookings.length === 0 ? (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-emerald-700 font-medium">Free all day</span>
                          <button
                            type="button"
                            onClick={() => onQuickBookSlot(dayStr, '08:00')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-[10px] flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Book Day
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-2">
                          {dayBookings.map(b => (
                            <div
                              key={b.id}
                              onClick={() => onSelectBooking(b)}
                              className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between text-xs cursor-pointer hover:bg-stone-100"
                            >
                              <div>
                                <div className="font-bold text-stone-800 flex items-center gap-1">
                                  <span>{b.className}</span>
                                  <span className="font-normal text-stone-500">· {b.title}</span>
                                </div>
                                <div className="text-[10px] text-stone-500">
                                  {b.teacherName} ({formatTime12h(b.startTime)} - {formatTime12h(b.endTime)})
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-rose-700">View →</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MONTH VIEW                                               */}
      {/* ======================================================== */}
      {viewMode === 'month' && (
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="bg-stone-100 p-2 text-center text-xs font-bold text-stone-600">
                {d}
              </div>
            ))}

            {(() => {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();

              const cells: React.ReactNode[] = [];

              // Leading blank days
              for (let i = 0; i < firstDay; i++) {
                cells.push(<div key={`blank-${i}`} className="bg-stone-50/50 min-h-[85px] p-1.5" />);
              }

              // Days of month
              for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month, d);
                const dateStr = formatDateISO(dateObj);
                const isToday = dateStr === todayStr;
                const dayBookings = filteredBookings.filter(b => b.date === dateStr);

                cells.push(
                  <div
                    key={`day-${d}`}
                    onClick={() => {
                      setCurrentDate(dateObj);
                      setViewMode('day');
                    }}
                    className={`bg-white min-h-[85px] p-1.5 transition-colors cursor-pointer hover:bg-stone-50 flex flex-col justify-between ${
                      isToday ? 'ring-2 ring-rose-300 ring-inset bg-rose-50/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? 'text-rose-700' : 'text-stone-700'}`}>
                        {d}
                      </span>
                      {dayBookings.length > 0 && (
                        <span className="text-[9px] font-bold bg-stone-100 text-stone-700 px-1.5 py-0.2 rounded-full">
                          {dayBookings.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-14 scrollbar-none">
                      {dayBookings.slice(0, 2).map(b => {
                        const isPast = b.date < todayStr || (b.date === todayStr && b.endTime <= nowTimeStr);
                        const isCancelled = b.status === 'cancelled';
                        return (
                          <div
                            key={b.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBooking(b);
                            }}
                            className={`text-[9px] p-0.5 px-1 rounded font-medium truncate ${
                              isCancelled
                                ? 'bg-stone-100 text-stone-400 line-through'
                                : isPast
                                ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                                : b.isPrebooking
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : 'bg-teal-50 text-teal-900 border border-teal-200'
                            }`}
                            title={`${formatTime12h(b.startTime)}: ${b.title} (${b.teacherName})`}
                          >
                            <span className="font-bold">{b.className}</span> · {b.teacherName}
                          </div>
                        );
                      })}
                      {dayBookings.length > 2 && (
                        <div className="text-[9px] text-stone-500 text-center font-medium">
                          +{dayBookings.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return cells;
            })()}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DAY VIEW (Accurate 30-Minute Schedule)                   */}
      {/* ======================================================== */}
      {viewMode === 'day' && (
        <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between bg-stone-50 p-3.5 rounded-xl border border-stone-200 shadow-2xs">
            <div>
              <h3 className="font-bold text-stone-800 text-sm sm:text-base">
                {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Accurate 30-minute interval timetable for English Language Lab
              </p>
            </div>
            <button
              onClick={() => {
                const dStr = formatDateISO(currentDate);
                const todayStr = formatDateISO(new Date());
                onOpenBookingModal(dStr > todayStr, dStr);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-rose-200/90 text-rose-950 hover:bg-rose-200 inline-flex items-center gap-1.5 shadow-2xs border border-rose-300"
            >
              <Plus className="w-3.5 h-3.5" /> Book on this Day
            </button>
          </div>

          <div className="space-y-2.5">
            {CALENDAR_HOURS.map(hour => {
              const dStr = formatDateISO(currentDate);
              const status = getHourSlotStatus(dStr, hour);

              return (
                <div
                  key={hour}
                  className="p-3 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-2"
                >
                  {/* Hour Header */}
                  <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                    <span className="font-mono font-bold text-xs text-stone-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>{formatTime12h(hour)} – {formatTime12h(status.nextHourStr)}</span>
                    </span>
                    {status.isFullHourSameBooking ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        1-Hour Session
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-medium">
                        30-minute intervals
                      </span>
                    )}
                  </div>

                  {status.isFullHourSameBooking && status.fullBooking ? (
                    /* Unified Full 1-Hour Session */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-stone-900">
                            {status.fullBooking.className}
                          </span>
                          <span className="font-mono text-xs text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">
                            {formatTime12h(status.fullBooking.startTime)} - {formatTime12h(status.fullBooking.endTime)}
                          </span>
                          {status.fullBooking.isPrebooking && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                              Pre-Booked
                            </span>
                          )}
                        </div>
                        <h4
                          onClick={() => onSelectBooking(status.fullBooking!)}
                          className="font-semibold text-xs text-stone-800 hover:text-rose-700 cursor-pointer"
                        >
                          {status.fullBooking.title}
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Instructor: <strong>{status.fullBooking.teacherName}</strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectBooking(status.fullBooking!)}
                        className="text-xs font-semibold text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors self-start sm:self-auto shrink-0"
                      >
                        View Details
                      </button>
                    </div>
                  ) : (
                    /* Dual 30-Minute Breakdowns */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* 1st Half: :00 - :30 */}
                      <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/50">
                        <div className="text-[10px] font-mono text-stone-500 font-semibold mb-1 flex items-center justify-between">
                          <span>{formatTime12h(status.timeStr1)} - {formatTime12h(status.timeStr2)}</span>
                          {status.slot1Booking ? (
                            <span className="font-bold text-stone-700">Booked</span>
                          ) : (
                            <span className="font-bold text-emerald-700">Available</span>
                          )}
                        </div>

                        {status.slot1Booking ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-stone-900">{status.slot1Booking.className}</span>
                              <button
                                type="button"
                                onClick={() => onSelectBooking(status.slot1Booking!)}
                                className="text-[11px] text-rose-700 font-semibold hover:underline"
                              >
                                View
                              </button>
                            </div>
                            <p className="text-[11px] text-stone-700 font-medium truncate" title={status.slot1Booking.title}>
                              {status.slot1Booking.title}
                            </p>
                            <p className="text-[10px] text-stone-500">
                              {status.slot1Booking.teacherName} • <span className="font-mono">{formatTime12h(status.slot1Booking.startTime)}-{formatTime12h(status.slot1Booking.endTime)}</span>
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-emerald-700">Free (30m)</span>
                            <button
                              type="button"
                              onClick={() => onQuickBookSlot(dStr, status.timeStr1)}
                              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Book 30m
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 2nd Half: :30 - :00 */}
                      <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/50">
                        <div className="text-[10px] font-mono text-stone-500 font-semibold mb-1 flex items-center justify-between">
                          <span>{formatTime12h(status.timeStr2)} - {formatTime12h(status.nextHourStr)}</span>
                          {status.slot2Booking ? (
                            <span className="font-bold text-stone-700">Booked</span>
                          ) : (
                            <span className="font-bold text-emerald-700">Available</span>
                          )}
                        </div>

                        {status.slot2Booking ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-stone-900">{status.slot2Booking.className}</span>
                              <button
                                type="button"
                                onClick={() => onSelectBooking(status.slot2Booking!)}
                                className="text-[11px] text-rose-700 font-semibold hover:underline"
                              >
                                View
                              </button>
                            </div>
                            <p className="text-[11px] text-stone-700 font-medium truncate" title={status.slot2Booking.title}>
                              {status.slot2Booking.title}
                            </p>
                            <p className="text-[10px] text-stone-500">
                              {status.slot2Booking.teacherName} • <span className="font-mono">{formatTime12h(status.slot2Booking.startTime)}-{formatTime12h(status.slot2Booking.endTime)}</span>
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-emerald-700">Free (30m)</span>
                            <button
                              type="button"
                              onClick={() => onQuickBookSlot(dStr, status.timeStr2)}
                              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Book 30m
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
