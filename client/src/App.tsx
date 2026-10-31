import React from 'react';
import { AnimatePresence } from 'motion/react';
import { OSProvider, useOS } from './context/OSContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Desktop } from './components/desktop/Desktop';
import { WindowFrame } from './components/window/WindowFrame';
import { RenderApp } from './components/apps/AppRegistry';
import { Taskbar } from './components/taskbar/Taskbar';
import { BSODScreen } from './components/easter/BSODScreen';
import { SleepScreen } from './components/common/SleepScreen';
import { PowerScreen } from './components/common/PowerScreen';
import { LockScreen } from './components/desktop/LockScreen';
import { AdminLoginScreen } from './components/apps/AdminLoginScreen';
import { AdminDraftPreviewPage } from './components/apps/admin/AdminDraftPreviewPage';
import { trackPortfolioAnalytics } from './utils/analytics';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext';
import { applyConfiguredFavicon, applySeoMetadata } from './utils/seoMetadata';
import { getCachedPublishedContent } from './utils/publishedPortfolioCache';
import { Construction, ShieldCheck, Clock3, Sparkles } from 'lucide-react';
import { getAdminShortcut, matchesAdminShortcut } from './utils/adminShortcut';

const OSMainContent: React.FC = () => {
  const { windows, isBsod, powerState, settings, currentDesktopId, openApp, applyPublishedAppLayout } = useOS();
  const { isLocked, login, unlockScreen } = useAuth();
  const trackedInitialPageView = React.useRef(false);
  const adminRouteHandled = React.useRef(false);
  const adminWindowSeen = React.useRef(false);
  const [maintenanceSettings, setMaintenanceSettings] = React.useState<{ enabled: boolean; message: string }>({ enabled: false, message: '' });
  const [maintenanceStatus, setMaintenanceStatus] = React.useState<'checking' | 'ready' | 'error'>('checking');
  const [isPasswordResetRoute] = React.useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return Boolean(new URLSearchParams(window.location.search).get('resetToken') || hashParams.get('resetToken'));
  });
  const [isAdminDraftPreviewRoute] = React.useState(() => window.location.pathname === '/admin/preview');
  const [skipLockForAdmin, setSkipLockForAdmin] = React.useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !isAdminDraftPreviewRoute && (
      window.location.pathname === '/admin' ||
      window.location.pathname.startsWith('/admin/') ||
      window.location.hash === '#admin' ||
      params.get('app') === 'admin' ||
      params.get('admin') === 'true'
    );
  });

  React.useEffect(() => {
    let active = true;
    let publishedAppLayoutApplied = false;
    applyConfiguredFavicon();
    const cachedContent = getCachedPublishedContent();
    if (cachedContent?.siteSettings) {
      applySeoMetadata(cachedContent, window.location.href);
    }
    const refreshMaintenanceSettings = async () => {
      try {
        const response = await fetch('/api/portfolio-content', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Maintenance settings could not be loaded (HTTP ${response.status}).`);
        const payload = await response.json();
        if (!payload.success || !payload.content?.siteSettings) throw new Error('Published maintenance settings are missing.');
        if (active) {
          applySeoMetadata(payload.content, window.location.href);
          if (!publishedAppLayoutApplied) {
            applyPublishedAppLayout(payload.content.siteSettings);
            publishedAppLayoutApplied = true;
          }
          setMaintenanceSettings({
            enabled: payload.content.siteSettings.maintenanceMode === true,
            message: typeof payload.content.siteSettings.maintenanceMessage === 'string' ? payload.content.siteSettings.maintenanceMessage : '',
          });
          setMaintenanceStatus('ready');
        }
      } catch (error) {
        if (active) {
          console.error('[App] Published maintenance settings could not be loaded.', error);
          setMaintenanceStatus((status) => status === 'checking' ? 'error' : status);
        }
      }
    };

    void refreshMaintenanceSettings();
    const handlePublishedContent = (event: Event) => {
      const content = (event as CustomEvent).detail;
      const settings = content?.siteSettings;
      if (!settings) return;
      applySeoMetadata(content, window.location.href);
      applyPublishedAppLayout(settings);
      setMaintenanceSettings({
        enabled: settings.maintenanceMode === true,
        message: typeof settings.maintenanceMessage === 'string' ? settings.maintenanceMessage : '',
      });
      setMaintenanceStatus('ready');
    };
    window.addEventListener('portfolio-content-published', handlePublishedContent);
    window.addEventListener('portfolio-data-updated', refreshMaintenanceSettings);
    return () => {
      active = false;
      window.removeEventListener('portfolio-content-published', handlePublishedContent);
      window.removeEventListener('portfolio-data-updated', refreshMaintenanceSettings);
    };
  }, [applyPublishedAppLayout]);

  React.useEffect(() => {
    const keepSelectMenuInsideViewport = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || target.disabled || target.size > 1) return;
      const bounds = target.getBoundingClientRect();
      const taskbar = document.querySelector<HTMLElement>('[data-taskbar="true"]');
      const viewportBottom = taskbar && taskbar.getBoundingClientRect().top > 0
        ? taskbar.getBoundingClientRect().top
        : window.innerHeight;
      const optionCount = Array.from(target.options).filter((option) => !option.hidden).length;
      const menuHeight = Math.min(Math.max(optionCount, 1), 8) * 36 + 16;
      if (viewportBottom - bounds.bottom < menuHeight && bounds.top > menuHeight) {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      }
    };

    document.addEventListener('pointerdown', keepSelectMenuInsideViewport, true);
    document.addEventListener('focusin', keepSelectMenuInsideViewport, true);
    return () => {
      document.removeEventListener('pointerdown', keepSelectMenuInsideViewport, true);
      document.removeEventListener('focusin', keepSelectMenuInsideViewport, true);
    };
  }, []);

  React.useEffect(() => {
    const checkAdminRoute = () => {
      if (isPasswordResetRoute || isAdminDraftPreviewRoute) return;
      const hash = window.location.hash;
      const search = new URLSearchParams(window.location.search);
      const path = window.location.pathname;
      const isAdminRoute = hash === '#admin' || search.get('app') === 'admin' || search.get('admin') === 'true'
        || path === '/admin' || path.startsWith('/admin/');
      setSkipLockForAdmin(isAdminRoute);
      if (isAdminRoute) {
        if (!adminRouteHandled.current) {
          adminRouteHandled.current = true;
          adminWindowSeen.current = false;
          openApp('admin');
        }
      } else {
        adminRouteHandled.current = false;
        adminWindowSeen.current = false;
      }
    };
    checkAdminRoute();
    window.addEventListener('hashchange', checkAdminRoute);
    window.addEventListener('popstate', checkAdminRoute);
    return () => {
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('popstate', checkAdminRoute);
    };
  }, [openApp, isPasswordResetRoute, isAdminDraftPreviewRoute]);

  React.useEffect(() => {
    if (!adminRouteHandled.current) return;
    const adminWindow = windows.find((win) => win.appId === 'admin');
    if (adminWindow && !adminWindow.isMinimized) {
      adminWindowSeen.current = true;
      return;
    }
    if (!adminWindowSeen.current) return;

    const url = new URL(window.location.href);
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) url.pathname = '/';
    url.searchParams.delete('app');
    url.searchParams.delete('admin');
    if (url.hash === '#admin') url.hash = '';
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    adminRouteHandled.current = false;
    adminWindowSeen.current = false;
    setSkipLockForAdmin(false);
  }, [windows]);

  React.useEffect(() => {
    const handleAdminShortcut = (event: KeyboardEvent) => {
      if (!matchesAdminShortcut(event, getAdminShortcut())) return;
      event.preventDefault();
      event.stopPropagation();
      const url = new URL(window.location.href);
      url.pathname = '/admin';
      url.searchParams.delete('app');
      url.searchParams.delete('admin');
      window.history.pushState({}, document.title, `${url.pathname}${url.search}`);
      adminRouteHandled.current = true;
      adminWindowSeen.current = false;
      setSkipLockForAdmin(true);
      void unlockScreen('');
      openApp('admin');
    };
    window.addEventListener('keydown', handleAdminShortcut, true);
    return () => window.removeEventListener('keydown', handleAdminShortcut, true);
  }, [openApp, unlockScreen]);

  React.useEffect(() => {
    if (trackedInitialPageView.current || isPasswordResetRoute || isAdminDraftPreviewRoute) return;
    const hash = window.location.hash.toLowerCase();
    const isAdminRoute = window.location.pathname.startsWith('/admin') || hash === '#admin' || new URLSearchParams(window.location.search).get('app') === 'admin';
    if (isAdminRoute) return;
    trackedInitialPageView.current = true;
    trackPortfolioAnalytics('PORTFOLIO_PAGE_VIEW', 'navigation', window.location.pathname || '/');
  }, [isPasswordResetRoute, isAdminDraftPreviewRoute]);

  if (isPasswordResetRoute) {
    return (
      <AdminLoginScreen
        onLogin={async (email, pass) => {
          const result = await login(email, pass, false);
          if (result.success) {
            const url = new URL(window.location.href);
            url.searchParams.delete('resetToken');
            url.searchParams.set('app', 'admin');
            const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
            hashParams.delete('resetToken');
            url.hash = hashParams.toString();
            window.location.replace(url.toString());
          }
          return result;
        }}
      />
    );
  }

  if (isAdminDraftPreviewRoute) {
    return <AdminDraftPreviewPage />;
  }

  if (isBsod) {
    return <BSODScreen />;
  }

  if (powerState === 'sleep') {
    return <SleepScreen />;
  }

  if (powerState === 'shutdown' || powerState === 'restart' || powerState === 'off') {
    return <PowerScreen mode={powerState} />;
  }

  return (
    <>
      <AnimatePresence>
        {isLocked && !skipLockForAdmin && (
          <LockScreen
            wallpaper={settings.customLockScreenUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=2560&auto=format&fit=crop&q=90'}
          />
        )}
      </AnimatePresence>
      <Desktop>
        <AnimatePresence>
          {windows
            .filter((win) => !win.desktopId || win.desktopId === currentDesktopId)
            .map((win) => (
              <WindowFrame key={win.id} windowState={win}>
                <RenderApp appId={win.appId} args={win.args} windowId={win.id} />
              </WindowFrame>
            ))}
        </AnimatePresence>
        <Taskbar />
      </Desktop>
      {maintenanceStatus === 'ready' && maintenanceSettings.enabled && !skipLockForAdmin && (
        <div className="fixed inset-0 z-[1000000] flex min-h-0 items-center justify-center overflow-hidden bg-[#080d1b] px-4 py-8 text-white sm:px-8">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-[110px]" />
            <div className="absolute -bottom-48 -right-28 h-[34rem] w-[34rem] rounded-full bg-indigo-500/15 blur-[130px]" />
            <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.22) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
          </div>
          <section className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl sm:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-400" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-sky-300/20 bg-sky-400/10 text-sky-200"><Construction className="h-5 w-5" /></span>
                <div><p className="text-sm font-bold tracking-wide">Windows 11 Portfolio</p><p className="mt-0.5 text-[11px] text-slate-400">A brief pause while we improve things</p></div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />{maintenanceStatus === 'ready' ? 'Maintenance in progress' : 'Checking site status'}</span>
            </div>
            <div className="mt-10 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{maintenanceStatus === 'ready' ? 'We’ll be right back' : 'Please wait'}</p>
                <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{maintenanceStatus === 'ready' ? 'Making a few improvements.' : 'Checking site availability.'}</h1>
                <p className="mt-4 max-w-xl whitespace-pre-line text-sm leading-7 text-slate-300">
                  {maintenanceStatus === 'ready'
                    ? maintenanceSettings.message || 'This portfolio is temporarily unavailable while emergency maintenance is in progress. Please check back soon.'
                    : maintenanceStatus === 'error'
                      ? 'The site status could not be verified. We are retrying automatically; please try again shortly.'
                      : 'The site is verifying its current availability. This should only take a moment.'}
                </p>
              </div>
              <div className="hidden h-24 w-24 place-items-center rounded-[1.75rem] border border-white/10 bg-white/[0.04] text-sky-200 sm:grid">
                <Sparkles className="h-9 w-9" />
              </div>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" />Your saved portfolio data is safe</span>
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-sky-300" />Service will return shortly</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <OSProvider>
        <ConfirmDialogProvider>
          <OSMainContent />
        </ConfirmDialogProvider>
      </OSProvider>
    </AuthProvider>
  );
}
