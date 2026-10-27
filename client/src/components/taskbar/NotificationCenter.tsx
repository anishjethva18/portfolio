import React, { useState } from 'react';
import { useOS } from '../../context/OSContext';
import { Bell, Trash2, RotateCcw, ChevronDown, ChevronUp, Calendar as CalendarIcon } from 'lucide-react';
import { HeaderClockBanner } from '../common/HeaderClockBanner';
import { DEFAULT_TIME_ZONE, getZonedDateParts } from '../../utils/dateTime';

type CalendarViewMode = 'days' | 'months' | 'years';

const MIN_CALENDAR_YEAR = 1947;
const MAX_CALENDAR_YEAR = 3000;

export const NotificationCenter: React.FC = () => {
  const { notifications, clearNotifications, markNotificationRead, settings, closeNotifications, closeTrayPanels } = useOS();
  const timeZone = settings.timeZone || DEFAULT_TIME_ZONE;
  const makeCalendarDate = (year: number, month: number, day = 1) => new Date(Date.UTC(year, month, day));
  const todayParts = getZonedDateParts(new Date(), timeZone);
  const todayDate = makeCalendarDate(todayParts.year, todayParts.month - 1, todayParts.day);
  const [viewDate, setViewDate] = useState(() => makeCalendarDate(todayParts.year, todayParts.month - 1));
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('days');
  const [isCalendarOpen, setIsCalendarOpen] = useState(true);

  // Navigation helpers with bounds [1947, 3000]
  const handlePrev = () => {
    if (calendarView === 'days') {
      const prev = makeCalendarDate(viewDate.getUTCFullYear(), viewDate.getUTCMonth() - 1);
      if (prev.getUTCFullYear() >= MIN_CALENDAR_YEAR) {
        setViewDate(prev);
      }
    } else if (calendarView === 'months') {
      const targetYear = Math.max(MIN_CALENDAR_YEAR, viewDate.getUTCFullYear() - 1);
      setViewDate(makeCalendarDate(targetYear, viewDate.getUTCMonth()));
    } else {
      // Move 10 years back in decade view
      const targetYear = Math.max(MIN_CALENDAR_YEAR, viewDate.getUTCFullYear() - 10);
      setViewDate(makeCalendarDate(targetYear, viewDate.getUTCMonth()));
    }
  };

  const handleNext = () => {
    if (calendarView === 'days') {
      const next = makeCalendarDate(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1);
      if (next.getUTCFullYear() <= MAX_CALENDAR_YEAR) {
        setViewDate(next);
      }
    } else if (calendarView === 'months') {
      const targetYear = Math.min(MAX_CALENDAR_YEAR, viewDate.getUTCFullYear() + 1);
      setViewDate(makeCalendarDate(targetYear, viewDate.getUTCMonth()));
    } else {
      // Move 10 years forward in decade view
      const targetYear = Math.min(MAX_CALENDAR_YEAR, viewDate.getUTCFullYear() + 10);
      setViewDate(makeCalendarDate(targetYear, viewDate.getUTCMonth()));
    }
  };

  const handleResetToday = () => {
    setViewDate(makeCalendarDate(todayParts.year, todayParts.month - 1));
    setCalendarView('days');
  };

  // Generate calendar days for active month with leading/trailing filler days
  const getDaysGrid = () => {
    const year = viewDate.getUTCFullYear();
    const month = viewDate.getUTCMonth();

    const firstDayIndex = makeCalendarDate(year, month, 1).getUTCDay();
    const totalDays = makeCalendarDate(year, month + 1, 0).getUTCDate();
    const prevMonthDays = makeCalendarDate(year, month, 0).getUTCDate();

    const grid = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      grid.push({ day: prevMonthDays - i, isCurrentMonth: false, monthOffset: -1 });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      grid.push({ day: i, isCurrentMonth: true, monthOffset: 0 });
    }

    // Next month filler days to complete 35 or 42 cells
    const remaining = grid.length % 7 === 0 ? 0 : 7 - (grid.length % 7);
    for (let i = 1; i <= remaining; i++) {
      grid.push({ day: i, isCurrentMonth: false, monthOffset: 1 });
    }

    return grid;
  };

  // Calculate 16-year grid bounded strictly within 1947 to 3000
  const getDecadeGrid = () => {
    const year = viewDate.getUTCFullYear();
    const decadeStart = Math.floor(year / 10) * 10;
    const gridStart = Math.max(MIN_CALENDAR_YEAR, decadeStart - 2);

    const years = [];
    for (let i = 0; i < 16; i++) {
      const y = gridStart + i;
      if (y >= MIN_CALENDAR_YEAR && y <= MAX_CALENDAR_YEAR) {
        const isInDecade = y >= decadeStart && y < decadeStart + 10;
        years.push({ year: y, isInDecade });
      }
    }
    const decadeEnd = Math.min(MAX_CALENDAR_YEAR, decadeStart + 9);
    return { decadeStart: Math.max(MIN_CALENDAR_YEAR, decadeStart), decadeEnd, years };
  };

  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(viewDate);
  const isCurrentMonth =
    viewDate.getUTCMonth() === todayDate.getUTCMonth() && viewDate.getUTCFullYear() === todayDate.getUTCFullYear();
  const todayDay = todayDate.getUTCDate();
  const currentYear = todayDate.getUTCFullYear();

  const monthsList = [
    'Jan', 'Feb', 'Mar', 'Apr',
    'May', 'Jun', 'Jul', 'Aug',
    'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const decadeInfo = getDecadeGrid();

  const handleHeaderTitleClick = () => {
    if (calendarView === 'days') {
      setCalendarView('months');
    } else if (calendarView === 'months') {
      setCalendarView('years');
    } else {
      setCalendarView('days');
    }
  };

  return (
    <>
      {/* Backdrop for easy tap/click to dismiss */}
      <div
        className="fixed inset-0 bg-transparent z-[998] animate-in fade-in duration-200"
        onClick={() => {
          closeNotifications();
          closeTrayPanels();
        }}
      />

      <div
        className={`fixed top-9 inset-x-2 sm:inset-x-auto sm:top-auto sm:bottom-14 sm:right-3 z-[999] w-auto sm:w-96 max-w-[96vw] max-h-[88vh] flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-4 select-none animate-in fade-in slide-in-from-top-4 sm:slide-in-from-right-4 transition-all duration-200 ${
          settings.transparency
            ? 'bg-white/95 dark:bg-[#121620]/95 backdrop-blur-3xl text-slate-900 dark:text-white'
            : 'bg-white dark:bg-[#121620] text-slate-900 dark:text-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Dismiss Handle */}
        <div
          className="sm:hidden flex justify-center pb-2 cursor-pointer"
          onClick={() => {
            closeNotifications();
            closeTrayPanels();
          }}
        >
          <div className="w-10 h-1 rounded-full bg-slate-400/40 dark:bg-white/30" />
        </div>

        {/* Time / Date Clock Banner (Mobile only) */}
        <HeaderClockBanner className="sm:hidden" />

        {/* Notifications Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-white">
              Notifications ({notifications.length})
            </span>
            {notifications.length > 10 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-semibold">
                Latest 10
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors cursor-pointer"
              onClick={clearNotifications}
            >
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div
          className={`overflow-y-auto my-2 space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/20 scrollbar-track-transparent overscroll-contain transition-all ${
            isCalendarOpen ? 'max-h-[22vh] sm:max-h-36' : 'max-h-[60vh] sm:max-h-80'
          }`}
        >
          {notifications.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
              <Bell className="w-5 h-5 text-slate-400 dark:text-slate-600 stroke-[1.5]" />
              <span>No new notifications</span>
            </div>
          ) : (
            <>
              {notifications.slice(0, 10).map((notif) => (
                <div
                  key={notif.id}
                  className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    notif.read
                      ? 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800/40 dark:border-white/5 dark:text-slate-300 opacity-70 hover:opacity-100'
                      : 'bg-white border-cyan-500/40 text-slate-800 dark:bg-slate-800/90 dark:border-cyan-500/40 dark:text-slate-100 shadow-sm hover:border-cyan-500'
                  }`}
                  onClick={() => markNotificationRead(notif.id)}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="text-cyan-600 dark:text-cyan-200">{notif.title}</span>
                    <span className="text-[10px] font-normal text-slate-400">{notif.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {notif.message}
                  </p>
                </div>
              ))}
              {notifications.length > 10 && (
                <div className="py-1.5 px-3 text-center text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5">
                  Showing top 10 of {notifications.length} notifications. Clear to view more.
                </div>
              )}
            </>
          )}
        </div>

        {/* Calendar Collapsible Container */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer py-1"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Calendar</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isCalendarOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isCalendarOpen && (
              <button
                onClick={handleResetToday}
                className="flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                title="Reset to today"
              >
                <RotateCcw className="w-3 h-3" /> Today
              </button>
            )}
          </div>

          {isCalendarOpen && (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#161a26] border border-slate-200 dark:border-white/10 shadow-inner animate-in fade-in duration-150">
              {/* Calendar Header with Navigation */}
              <div className="flex items-center justify-between mb-2.5 px-1">
                <button
                  className="text-sm font-bold text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1"
                  onClick={handleHeaderTitleClick}
                  title="Click to toggle view (Days / Months / Years)"
                >
                  <span>
                    {calendarView === 'days' && monthName}
                    {calendarView === 'months' && viewDate.getUTCFullYear()}
                    {calendarView === 'years' && `${decadeInfo.decadeStart} - ${decadeInfo.decadeEnd}`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={handlePrev}
                    disabled={viewDate.getUTCFullYear() <= MIN_CALENDAR_YEAR && (calendarView !== 'days' || viewDate.getUTCMonth() === 0)}
                    title="Previous"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={handleNext}
                    disabled={viewDate.getUTCFullYear() >= MAX_CALENDAR_YEAR && (calendarView !== 'days' || viewDate.getUTCMonth() === 11)}
                    title="Next"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* View 1: Days View */}
              {calendarView === 'days' && (
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center py-1 px-1 rounded-xl bg-cyan-400 text-slate-950 text-[11px] font-extrabold mb-2 shadow">
                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {getDaysGrid().map((cell, idx) => {
                      const isSelected = isCurrentMonth && cell.isCurrentMonth && cell.day === todayDay;
                      return (
                        <div
                          key={idx}
                          className={`h-7 flex items-center justify-center rounded-xl text-xs transition-all ${
                            !cell.isCurrentMonth
                              ? 'text-slate-400 dark:text-slate-600 font-normal'
                              : isSelected
                              ? 'bg-cyan-400 text-slate-950 font-black shadow-lg ring-2 ring-cyan-300 scale-105'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 font-bold'
                          }`}
                        >
                          {cell.day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View 2: Months Selection Grid */}
              {calendarView === 'months' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {monthsList.map((mName, mIdx) => {
                      const isSelectedMonth =
                        viewDate.getUTCMonth() === mIdx && viewDate.getUTCFullYear() === currentYear;
                      return (
                        <button
                          key={mName}
                          className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelectedMonth
                              ? 'bg-cyan-400 text-slate-950 shadow-lg ring-2 ring-cyan-300 scale-105 font-black'
                              : 'bg-slate-200/80 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 border border-slate-300/50 dark:border-white/5'
                          }`}
                          onClick={() => {
                            setViewDate(makeCalendarDate(viewDate.getUTCFullYear(), mIdx));
                            setCalendarView('days');
                          }}
                        >
                          {mName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View 3: Years / Decades Selection Grid (1947 - 3000) */}
              {calendarView === 'years' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {decadeInfo.years.map((yObj) => {
                      const isSelectedYear = yObj.year === currentYear;
                      return (
                        <button
                          key={yObj.year}
                          className={`h-10 rounded-xl text-xs transition-all cursor-pointer ${
                            !yObj.isInDecade
                              ? 'text-slate-400 dark:text-slate-600 bg-slate-200/30 dark:bg-white/[0.02] font-normal hover:bg-slate-200 dark:hover:bg-white/5'
                              : isSelectedYear
                              ? 'bg-cyan-400 text-slate-950 font-black shadow-lg ring-2 ring-cyan-300 scale-105'
                              : 'bg-slate-200/80 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 font-bold border border-slate-300/50 dark:border-white/5'
                          }`}
                          onClick={() => {
                            setViewDate(makeCalendarDate(yObj.year, viewDate.getUTCMonth()));
                            setCalendarView('months');
                          }}
                        >
                          {yObj.year}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};


