import React from 'react';
import { AppWindow, Eye, MousePointer2, Clock3, Users, Mail, RefreshCw, FolderKanban, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { AdminDashboardChart } from './admin/AdminDashboardChart';

type AnalyticsData = {
  summary?: {
    uniqueVisitors: number;
    pageViews: number;
    projectViews: number;
    projectClicks: number;
    leads: number;
    unreadLeads: number;
  };
  topProjects?: Array<{ projectId: string; projectTitle: string; views: number; clicks: number }>;
  dailyActivity?: Array<{ date: string; pageViews: number; projectClicks: number }>;
  appOpenCounts?: Array<{ appId: string; appName: string; count: number }>;
  recentAppOpens?: Array<{ id: string; timestamp: string; page: string; metadata?: { appId?: string; appName?: string } }>;
  recentAppOpensPagination?: { page: number; limit: number; total: number; totalPages: number };
  retentionDays?: number;
};

export const AnalyticsDashboard: React.FC<{
  data: AnalyticsData | null;
  theme?: 'dark' | 'light';
  onRefresh?: () => Promise<void> | void;
  onRecentPageChange?: (page: number) => void;
  activityDays: number;
  onActivityDaysChange: (days: number) => void;
  onReset?: () => Promise<void> | void;
}> = ({ data, theme = 'dark', onRefresh, onRecentPageChange, activityDays, onActivityDaysChange, onReset }) => {
  const confirm = useConfirmDialog();
  const isLight = theme === 'light';
  const [refreshing, setRefreshing] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [resetError, setResetError] = React.useState('');
  const [pages, setPages] = React.useState({ projects: 0, apps: 0, recent: 0 });
  const projectPageSize = 5;
  const appPageSize = 5;
  const recentPageSize = 5;
  if (!data) return <div role="status" className="animate-pulse p-6 text-sm text-slate-500">Loading portfolio analytics…</div>;

  const activity = data.dailyActivity || [];
  const summary = data.summary || { uniqueVisitors: 0, pageViews: 0, projectViews: 0, projectClicks: 0, leads: 0, unreadLeads: 0 };
  const topProjects = data.topProjects || [];
  const appOpenCounts = data.appOpenCounts || [];
  const recentAppOpens = data.recentAppOpens || [];
  const getPageItems = <T,>(items: T[], page: number, pageSize: number) => {
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(page, pageCount - 1);
    return { currentPage, pageCount, items: items.slice(currentPage * pageSize, (currentPage + 1) * pageSize) };
  };
  const pagedProjects = getPageItems(topProjects, pages.projects, projectPageSize);
  const pagedApps = getPageItems(appOpenCounts, pages.apps, appPageSize);
  const recentPagination = data.recentAppOpensPagination || {
    page: 1,
    limit: recentPageSize,
    total: recentAppOpens.length,
    totalPages: 1,
  };
  const pagination = (key: keyof typeof pages, total: number, page: number, pageCount: number, pageSize: number) => pageCount <= 1 ? null : (
    <div className={`mt-4 flex items-center justify-between border-t pt-3 text-xs ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
      <span className={muted}>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}</span>
      <div className="flex gap-1">
        <button type="button" onClick={() => setPages((current) => ({ ...current, [key]: Math.max(0, page - 1) }))} disabled={page === 0} aria-label="Previous page" className={`grid h-8 w-8 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40 ${isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-700 hover:bg-slate-800'}`}><ChevronLeft size={15} /></button>
        <button type="button" onClick={() => setPages((current) => ({ ...current, [key]: Math.min(pageCount - 1, page + 1) }))} disabled={page >= pageCount - 1} aria-label="Next page" className={`grid h-8 w-8 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40 ${isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-700 hover:bg-slate-800'}`}><ChevronRight size={15} /></button>
      </div>
    </div>
  );
  const refreshAnalytics = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    const startedAt = Date.now();
    try { await onRefresh(); }
    finally { window.setTimeout(() => setRefreshing(false), Math.max(0, 400 - (Date.now() - startedAt))); }
  };
  const resetAnalytics = async () => {
    if (!onReset || resetting) return;
    if (!await confirm({
      title: 'Reset portfolio analytics?',
      message: 'This permanently deletes portfolio visitor, project, app-open, and assistant analytics. Contact messages and system logs will not be affected.',
      confirmLabel: 'Reset analytics',
      destructive: true,
    })) return;
    setResetting(true);
    setResetError('');
    try {
      await onReset();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Analytics could not be reset.');
    } finally {
      setResetting(false);
    }
  };
  const card = `rounded-2xl border p-5 shadow-sm ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-800 bg-[#11141c] text-slate-100'}`;
  const muted = isLight ? 'text-slate-500' : 'text-slate-400';
  const metricCards = [
    { label: 'Unique visitors', value: summary.uniqueVisitors, helper: 'Distinct portfolio browsers', icon: Users, color: 'text-blue-500' },
    { label: 'Page views', value: summary.pageViews, helper: 'Portfolio pages opened', icon: AppWindow, color: 'text-cyan-500' },
    { label: 'Project views', value: summary.projectViews, helper: 'Project detail panels opened', icon: Eye, color: 'text-sky-500' },
    { label: 'Project clicks', value: summary.projectClicks, helper: 'Project cards selected', icon: MousePointer2, color: 'text-violet-500' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-end gap-3">
        <span className={`mr-auto text-xs ${muted}`}>
          Auto-refreshes every 30 seconds · events retained for {data.retentionDays || 90} days
        </span>
        {onRefresh && <button type="button" onClick={() => void refreshAnalytics()} disabled={refreshing} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-70 ${isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />Refresh analytics</button>}
        {onReset && <button type="button" onClick={() => void resetAnalytics()} disabled={resetting} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-wait disabled:opacity-70"><Trash2 size={14} className={resetting ? 'animate-pulse' : ''} />{resetting ? 'Resetting…' : 'Reset analytics'}</button>}
      </div>
      {resetError && <p role="alert" className="text-right text-xs text-rose-400">{resetError}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, helper, icon: Icon, color }) => <article key={label} className={card}>
          <div className={`flex items-center gap-2 text-xs font-semibold ${muted}`}><Icon size={15} className={color} />{label}</div>
          <div className="mt-3 text-3xl font-bold">{value.toLocaleString()}</div>
          <p className={`mt-1 text-xs ${muted}`}>{helper}</p>
        </article>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-1">
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#11141c]'}`}>
          <span className={`flex items-center gap-2 text-xs font-semibold ${muted}`}><Mail size={14} className="text-amber-500" />Contact leads</span>
          <span className="text-sm font-bold">{summary.leads.toLocaleString()} <span className={`font-normal ${muted}`}>· {summary.unreadLeads} unread</span></span>
        </div>
      </div>

      <AdminDashboardChart
        activity={activity}
        theme={theme}
        activityDays={activityDays}
        onActivityDaysChange={onActivityDaysChange}
        onRefresh={() => onRefresh?.()}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={`${card} order-3`}>
          <div className="mb-4 flex items-center gap-2"><FolderKanban size={16} className="text-blue-500" /><h3 className="font-bold">Most viewed projects</h3></div>
          {topProjects.length ? <>{<div className="space-y-2">{pagedProjects.items.map((project, index) => <div key={project.projectId} className={`grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-3 py-3 ${isLight ? 'bg-slate-50' : 'bg-slate-800/50'}`}><span className={`text-xs font-bold ${muted}`}>{pagedProjects.currentPage * projectPageSize + index + 1}</span><span className="truncate text-sm font-semibold">{project.projectTitle}</span><span className={`text-xs ${muted}`}>{project.views} views</span><span className={`text-xs ${muted}`}>{project.clicks} clicks</span></div>)}</div>}{pagination('projects', topProjects.length, pagedProjects.currentPage, pagedProjects.pageCount, projectPageSize)}</> : <p className={`py-8 text-center text-sm ${muted}`}>Project engagement will appear after visitors open project details.</p>}
        </section>
        <section className={`${card} order-2`}>
          <div className="mb-4"><div className="flex items-center gap-2"><AppWindow size={16} className="text-blue-500" /><h3 className="font-bold">Apps opened</h3></div><p className={`mt-1 text-xs ${muted}`}>Number of times each app was opened</p></div>
          {appOpenCounts.length ? <>{<div className="space-y-3">{pagedApps.items.map((app) => <div key={app.appId} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 ${isLight ? 'bg-slate-50' : 'bg-slate-800/50'}`}><span className="truncate text-sm font-medium">{app.appName}</span><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/15 text-blue-300'}`}>{app.count} {app.count === 1 ? 'time' : 'times'}</span></div>)}</div>}{pagination('apps', appOpenCounts.length, pagedApps.currentPage, pagedApps.pageCount, appPageSize)}</> : <p className={`py-8 text-center text-sm ${muted}`}>No app opens recorded yet.</p>}
        </section>
        <section className={`${card} order-1`}>
          <div className="mb-4 flex items-center gap-2"><Clock3 size={16} className="text-emerald-500" /><h3 className="font-bold">Recently opened apps</h3></div>
          {recentAppOpens.length ? (
            <>
              <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
                {recentAppOpens.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="truncate text-sm font-medium">{event.metadata?.appName || event.metadata?.appId || 'Portfolio app'}</span>
                    <time className={`shrink-0 text-xs ${muted}`} dateTime={event.timestamp}>
                      {new Date(event.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                    </time>
                  </div>
                ))}
              </div>
              {recentPagination.totalPages > 1 && (
                <div className={`mt-4 flex items-center justify-between border-t pt-3 text-xs ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <span className={muted}>
                    Showing {(recentPagination.page - 1) * recentPagination.limit + 1}–{Math.min(recentPagination.page * recentPagination.limit, recentPagination.total)} of {recentPagination.total}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onRecentPageChange?.(Math.max(1, recentPagination.page - 1))}
                      disabled={recentPagination.page <= 1}
                      aria-label="Previous recent app opens"
                      className={`grid h-8 w-8 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40 ${isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-700 hover:bg-slate-800'}`}
                    ><ChevronLeft size={15} /></button>
                    <button
                      type="button"
                      onClick={() => onRecentPageChange?.(Math.min(recentPagination.totalPages, recentPagination.page + 1))}
                      disabled={recentPagination.page >= recentPagination.totalPages}
                      aria-label="Next recent app opens"
                      className={`grid h-8 w-8 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40 ${isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-700 hover:bg-slate-800'}`}
                    ><ChevronRight size={15} /></button>
                  </div>
                </div>
              )}
            </>
          ) : <p className={`py-8 text-center text-sm ${muted}`}>Opened portfolio apps will appear here.</p>}
        </section>
      </div>
    </div>
  );
};
