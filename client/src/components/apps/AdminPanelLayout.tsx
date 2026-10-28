import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ContactRound,
  Folder,
  Inbox,
  Camera,
  Image,
  ChartNoAxesColumnIncreasing,
  ShieldCheck,
  ShieldAlert,
  Braces,
  HardDrive,
  LogOut,
  Search,
  Palette,
  Menu,
  X,
  RefreshCw,
  Sun,
  Moon,
  ChevronRight,
  History,
  CloudUpload,
  Send,
  SquarePen,
} from 'lucide-react';

export const AdminPanelLayout: React.FC<{
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void | Promise<void>;
  onSaveDraft?: () => void;
  onDiscardUnsavedChanges?: () => void;
  canSaveDraft?: boolean;
  canPublishDraft?: boolean;
  onRefreshData?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}> = ({
  children,
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onSaveDraft,
  onDiscardUnsavedChanges,
  canSaveDraft = false,
  canPublishDraft = false,
  onRefreshData,
  theme,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
    return () => { delete document.documentElement.dataset.adminTheme; };
  }, [theme]);
  const triggerRefresh = () => {
    if (refreshing || !onRefreshData) return;
    setRefreshing(true);
    try {
      onRefreshData();
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  };
  const navGroups = [
    { label: 'Workspace', items: [{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard }] },
    { label: 'Portfolio', items: [
      { id: 'portfolio', label: 'Site Content', icon: ContactRound },
      { id: 'projects', label: 'Projects', icon: Folder },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'media', label: 'Resumes & Media', icon: Image },
      { id: 'seo', label: 'SEO & Sharing', icon: Search },
    ] },
    { label: 'Audience', items: [
      { id: 'contacts', label: 'Messages', icon: Inbox },
      { id: 'analytics', label: 'Analytics', icon: ChartNoAxesColumnIncreasing },
    ] },
    { label: 'Administration', items: [
      { id: 'archives', label: 'Camera Archive', icon: Camera },
      { id: 'publishing', label: 'Publish & History', icon: History },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'security', label: 'Security & Status', icon: ShieldAlert },
      { id: 'advanced', label: 'Advanced JSON', icon: Braces },
      { id: 'backup', label: 'Backup & Restore', icon: HardDrive },
    ] },
  ];
  const activeItem = navGroups.flatMap((group) => group.items).find((item) => item.id === activeTab);
  const pageDescriptions: Record<string, string> = {
    portfolio: 'Manage the information visitors see across your portfolio.',
    projects: 'Curate project details, media, links, and visibility.',
    appearance: 'Choose a saved site theme and control visible sections.',
    media: 'Upload assets and keep track of where each file is used.',
    seo: 'Set search-result and social preview information.',
    contacts: 'Review contact requests and reply to prospective clients.',
    analytics: 'Understand visits, project interest, and activity over time.',
    archives: 'Review, download, and manage archived camera captures.',
    backup: 'Create safe backups and restore portfolio data and assets.',
    advanced: 'Edit the complete portfolio record directly.',
    publishing: 'Review saved changes and publish or discard the current draft.',
    security: 'Change your password and check service configuration.',
    users: 'Manage administrator access, and account status.',
  };
  const pageHeadingTab = activeTab !== 'dashboard' && activeTab !== 'contacts';
  const activeGroup = navGroups.find((group) => group.items.some((item) => item.id === activeTab))?.label || 'Workspace';

  return (
    <div className={`admin-panel-shell admin-theme-${theme} relative flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#f3f8fd] font-sans text-slate-700`}>
      {/* Sidebar (Desktop) */}
      <aside className="w-[252px] bg-white/95 border-r border-slate-200/80 flex flex-col shrink-0 hidden lg:flex shadow-[8px_0_30px_rgba(30,64,175,0.03)]">
        {/* Brand header */}
        <div className="h-[68px] shrink-0 px-5 py-0 font-bold text-lg text-slate-900 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Portfolio CMS</span>
              <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">
                Creator workspace
              </span>
            </div>
          </div>
          {onRefreshData && (
            <button
              onClick={triggerRefresh}
              title="Refresh Workspace Data"
              className="admin-action-button p-2 rounded-xl text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-transform ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto px-3.5 py-3 pb-4 custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="px-3.5 pb-1.5 pt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</div>
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Current administrator profile and session controls */}
        <div className="admin-sidebar-profile border-t border-slate-100 p-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 font-bold text-white shadow-sm">{(user?.name || user?.email || 'A').charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{user?.name || 'Portfolio administrator'}</p>
              <p className="truncate text-[10px] text-slate-500">{user?.email || 'Admin account'}</p>
            </div>
            <button onClick={onLogout} title="Log out" aria-label="Log out from admin panel" className="admin-logout-button grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div
          className="absolute inset-0 z-50 flex lg:hidden bg-black/70 backdrop-blur-sm animate-fadeIn"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="admin-mobile-drawer h-full w-[min(18rem,90%)] max-w-full bg-white border-r border-slate-200 flex flex-col p-4 pb-safe-home">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600"><ShieldCheck className="h-4 w-4 text-white" /></span>
                <span className="font-bold text-slate-900 text-sm">Portfolio CMS</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto py-3">
              {navGroups.map((group) => (
                <div key={group.label} className="mb-3">
                  <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</div>
                  {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="admin-sidebar-profile mt-auto border-t border-slate-200 pt-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 font-bold text-white shadow-sm">{(user?.name || user?.email || 'A').charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{user?.name || 'Portfolio administrator'}</p><p className="truncate text-[10px] text-slate-500">{user?.email || 'Admin account'}</p></div>
                <button onClick={onLogout} title="Log out" aria-label="Log out from admin panel" className="admin-logout-button grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"><LogOut className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="relative z-10 flex min-h-[60px] shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-2.5 sm:min-h-[68px] sm:gap-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open admin navigation"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <span className="hidden shrink-0 sm:inline">{activeGroup}</span><ChevronRight className="hidden h-3 w-3 shrink-0 sm:block" />
                <span className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{activeItem?.label || activeTab.replace(/-/g, ' ')}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 xl:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live site</span>
            <button
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="admin-action-button admin-theme-toggle flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 sm:h-9 sm:w-9 sm:rounded-xl"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onDiscardUnsavedChanges}
              disabled={!canSaveDraft || !onDiscardUnsavedChanges}
              aria-live="polite"
              aria-label={canSaveDraft ? 'Discard unsaved edits and restore saved draft values' : 'No unsaved draft changes'}
              className={`admin-action-button admin-draft-indicator inline-flex h-8 w-8 max-w-8 items-center justify-center gap-1.5 truncate rounded-lg border bg-white px-0 text-[10px] font-bold transition sm:h-auto sm:w-auto sm:max-w-[190px] sm:justify-start sm:rounded-xl sm:px-2.5 sm:py-2 ${canSaveDraft ? 'is-unsaved cursor-pointer hover:brightness-95' : 'is-unpublished cursor-default'}`}
              title={canSaveDraft ? 'Discard unsaved edits and restore the values already saved as draft' : 'No unsaved draft changes'}
            >
              <SquarePen className="h-3 w-3 shrink-0" />
              <span className="hidden md:inline">{canSaveDraft ? 'Unsaved draft changes' : 'Saved draft'}</span>
            </button>
            {onSaveDraft && <button onClick={onSaveDraft} disabled={!canSaveDraft} title={canSaveDraft ? "Save current content changes as a private draft" : "There are no unsaved content changes"} aria-label="Save draft" className="admin-action-button inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:transform-none sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-2"><CloudUpload className="h-3.5 w-3.5" /><span className="hidden sm:inline">Save draft</span></button>}
            <button type="button" onClick={() => setActiveTab('publishing')} disabled={!canPublishDraft} title={canPublishDraft ? 'Review and publish saved draft changes' : 'Save a draft with changes before publishing'} aria-label="Publish changes" className="admin-action-button inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-sky-700 to-cyan-600 text-xs font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:transform-none sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-2"><Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Publish</span></button>
          </div>
        </header>

        {/* View Content */}
        <main className={`admin-panel-scroll h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-auto p-4 md:p-7 ${theme === 'dark' ? 'bg-[#0b0e14] text-slate-100' : 'bg-gradient-to-br from-[#f5faff] via-[#f8fbff] to-[#edf6ff] text-slate-800'}`}>
          {pageHeadingTab && (
            <div className="admin-page-heading mx-0 flex w-full min-w-0 max-w-[1430px] items-end justify-between gap-5 pb-5 pt-2">
              <div>
                <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.17em] text-sky-600">Manage your portfolio</p>
                <h1 className="text-[clamp(25px,3vw,34px)] font-bold tracking-tight text-slate-900">{activeItem?.label || activeTab}</h1>
                {pageDescriptions[activeTab] && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{pageDescriptions[activeTab]}</p>}
              </div>
            </div>
          )}
          <div className="mx-0 w-full min-w-0 max-w-[1430px]">{children}</div>
        </main>
      </div>
    </div>
  );
};
