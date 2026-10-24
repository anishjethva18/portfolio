import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Check, ChevronDown, RefreshCw } from 'lucide-react';

type ActivityDay = { date: string; pageViews: number; projectClicks: number };

export const ADMIN_ACTIVITY_RANGES = [7, 14, 30, 90] as const;

export const AdminDashboardChart: React.FC<{
  activity: ActivityDay[];
  theme: 'light' | 'dark';
  activityDays: number;
  onActivityDaysChange: (days: number) => void;
  onRefresh: () => Promise<void> | void;
}> = ({ activity, theme, activityDays, onActivityDaysChange, onRefresh }) => {
  const [refreshing, setRefreshing] = React.useState(false);
  const [rangeMenuOpen, setRangeMenuOpen] = React.useState(false);
  const rangeMenuRef = React.useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';
  React.useEffect(() => {
    if (!rangeMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rangeMenuRef.current?.contains(event.target as Node)) setRangeMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRangeMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [rangeMenuOpen]);
  const chartData = activity.map((day) => ({
    ...day,
    label: new Intl.DateTimeFormat(undefined, activityDays === 7
      ? { weekday: 'short', timeZone: 'UTC' }
      : { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`)),
  }));
  const panel = isLight ? 'border-slate-200/80 bg-white' : 'border-slate-800 bg-[#11141c]';
  const title = isLight ? 'text-slate-950' : 'text-white';
  const secondary = isLight ? 'text-slate-500' : 'text-slate-400';
  const grid = isLight ? '#e8eef5' : '#273449';
  const tick = isLight ? '#94a3b8' : '#8492a8';

  return (
  <section className={`h-full min-w-0 rounded-2xl border p-4 shadow-sm sm:p-6 ${panel}`}>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8 sm:gap-4">
      <div>
        <h3 className={`text-base font-bold ${title}`}>Activity in the last {activityDays} days</h3>
        <p className={`mt-1 text-xs ${secondary}`}>Portfolio page views and project clicks by day</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative" ref={rangeMenuRef}>
          <button
            type="button"
            aria-label="Activity date range"
            aria-haspopup="listbox"
            aria-expanded={rangeMenuOpen}
            aria-controls="admin-activity-range-options"
            onClick={() => setRangeMenuOpen((open) => !open)}
            className={`admin-activity-range-control inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition ${isLight ? 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50' : 'border-slate-700 bg-[#171e2b] text-slate-300 hover:border-sky-700 hover:bg-slate-800'}`}
          >
          <CalendarDays size={12} />
            <span>{activityDays} days</span>
            <ChevronDown size={12} className={`transition-transform ${rangeMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {rangeMenuOpen && (
            <div
              id="admin-activity-range-options"
              role="listbox"
              aria-label="Activity date range options"
              className={`absolute right-0 top-full z-30 mt-2 w-36 overflow-hidden rounded-xl border p-1.5 shadow-xl ring-1 ${isLight ? 'border-slate-200 bg-white ring-slate-900/5' : 'border-slate-700 bg-[#171e2b] ring-black/30'}`}
            >
              <p className={`px-2.5 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Show activity</p>
              {ADMIN_ACTIVITY_RANGES.map((days) => (
                <button
                  key={days}
                  type="button"
                  role="option"
                  aria-selected={activityDays === days}
                  onClick={() => {
                    onActivityDaysChange(days);
                    setRangeMenuOpen(false);
                  }}
                  className={`flex min-h-8 w-full items-center justify-between rounded-lg px-2.5 text-left text-[11px] font-semibold transition ${activityDays === days
                    ? isLight ? 'bg-sky-50 text-sky-700' : 'bg-sky-950/70 text-sky-300'
                    : isLight ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  <span>Last {days} days</span>
                  {activityDays === days && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Refresh activity"
          title="Refresh activity"
          onClick={() => {
            setRefreshing(true);
            void Promise.resolve(onRefresh())
              .catch((error: unknown) => console.error('Activity refresh failed:', error))
              .finally(() => window.setTimeout(() => setRefreshing(false), 350));
          }}
          className={`admin-activity-refresh-control inline-flex h-8 min-h-0 items-center justify-center gap-1 rounded-lg border px-2 text-[9px] font-semibold transition ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
          <span className={`text-[10px] font-semibold ${secondary}`}>Page views</span>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
          <span className={`text-[10px] font-semibold ${secondary}`}>Project clicks</span>
        </div>
      </div>
    </div>
    <div className="h-[220px] min-w-0 overflow-x-auto overscroll-x-contain touch-pan-x sm:h-64">
      <div className="h-full" style={{ width: activityDays > 7 ? `${Math.max(100, activityDays * 48)}px` : '100%', minWidth: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" interval={0} stroke={tick} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} stroke={tick} fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: isLight ? 'rgba(37,99,235,0.06)' : 'rgba(148,163,184,0.08)' }}
            contentStyle={{ backgroundColor: isLight ? '#ffffff' : '#111827', border: `1px solid ${grid}`, color: isLight ? '#0f172a' : '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
          />
          <Bar dataKey="pageViews" name="Page views" fill="#0ea5e9" radius={[5, 5, 0, 0]} barSize={17} />
          <Bar dataKey="projectClicks" name="Project clicks" fill="#8b5cf6" radius={[5, 5, 0, 0]} barSize={17} />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  </section>
  );
};
