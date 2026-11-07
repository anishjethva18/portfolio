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
import { applyConfiguredFavicon, refreshPublishedRouteSeo } from './utils/seoMetadata';
import { Construction, ShieldCheck, Clock3, Sparkles } from 'lucide-react';
import { getAdminShortcut, matchesAdminShortcut } from './utils/adminShortcut';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AppInfo from './pages/AppInfo';
import {
  getApplicationRoute,
  getApplicationRouteById,
  isApplicationRouteAvailable,
  normalizeApplicationPath,
} from './utils/applicationRoutes';
import type { AppId } from './types';

const OSMainContent: React.FC = () => {
  const {
    windows,
    activeWindowId,
    isBsod,
    powerState,
    settings,
    currentDesktopId,
    hiddenAppIds,
    publishedAppAvailabilityReady,
    openApp,
    navigateToDesktop,
    applyPublishedAppLayout,
  } = useOS();
  const { isLocked, login, lockScreen, unlockScreen } = useAuth();
  const trackedInitialPageView = React.useRef(false);
  const adminRouteHandled = React.useRef(false);
  const adminWindowSeen = React.useRef(false);
  const [routeRevision, setRouteRevision] = React.useState(0);
  const routeInitialized = React.useRef(false);
  const suppressNextRouteSync = React.useRef(false);
  const pendingRouteAppId = React.useRef<AppId | null>(null);
  const lastHandledRoute = React.useRef('');
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
      window.location.pathname === '/admin-control-center' ||
      window.location.hash === '#admin' ||
      params.get('app') === 'admin' ||
      params.get('admin') === 'true'
    );
  });

  React.useEffect(() => {
    let active = true;
    let publishedAppLayoutApplied = false;
    applyConfiguredFavicon();
    const refreshMaintenanceSettings = async () => {
      try {
        const response = await fetch('/api/portfolio-content', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Maintenance settings could not be loaded (HTTP ${response.status}).`);
        const payload = await response.json();
        if (!payload.success || !payload.content?.siteSettings) throw new Error('Published maintenance settings are missing.');
        if (active) {
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
    let active = true;
    const refreshSeoMetadata = async () => {
      try {
        if (active) await refreshPublishedRouteSeo(window.location.pathname, window.location.href);
      } catch (error) {
        if (active) console.error('[App] Published SEO metadata could not be loaded.', error);
      }
    };
    applyConfiguredFavicon();
    void refreshSeoMetadata();
    window.addEventListener('portfolio-data-updated', refreshSeoMetadata);
    window.addEventListener('portfolio-content-published', refreshSeoMetadata);
    return () => {
      active = false;
      window.removeEventListener('portfolio-data-updated', refreshSeoMetadata);
      window.removeEventListener('portfolio-content-published', refreshSeoMetadata);
    };
  }, [routeRevision]);

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
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = new URLSearchParams(window.location.search);
      const isAdminRoute = path === '/admin-control-center' || path === '/admin' || path.startsWith('/admin/')
        || hash === '#admin' || search.get('app') === 'admin' || search.get('admin') === 'true';
      setSkipLockForAdmin(isAdminRoute);
      if (isAdminRoute) {
        if (!adminRouteHandled.current) {
          adminRouteHandled.current = true;
          adminWindowSeen.current = false;
          void unlockScreen('');
          openApp('admin');
        }
      } else {
        adminRouteHandled.current = false;
        adminWindowSeen.current = false;
      }
    };
    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
    };
  }, [openApp, unlockScreen, isPasswordResetRoute, isAdminDraftPreviewRoute]);

  React.useEffect(() => {
    if (!adminRouteHandled.current) return;
    const adminWindow = windows.find((win) => win.appId === 'admin');
    if (adminWindow && !adminWindow.isMinimized) {
      adminWindowSeen.current = true;
      return;
    }
    if (!adminWindowSeen.current) return;

    const url = new URL(window.location.href);
    if (
      url.pathname === '/admin-control-center' ||
      url.pathname === '/admin' ||
      url.pathname.startsWith('/admin/')
    ) {
      url.pathname = '/home';
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
      setRouteRevision((revision) => revision + 1);
    }
    adminRouteHandled.current = false;
    adminWindowSeen.current = false;
    setSkipLockForAdmin(false);
  }, [windows]);

  React.useEffect(() => {
    const handlePopState = () => {
      suppressNextRouteSync.current = true;
      setRouteRevision((revision) => revision + 1);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    const path = normalizeApplicationPath(window.location.pathname);
    const search = new URLSearchParams(window.location.search);
    if (
      path === '/admin-control-center' || path === '/admin' || path.startsWith('/admin/') ||
      window.location.hash === '#admin' || search.get('app') === 'admin' || search.get('admin') === 'true'
    ) {
      routeInitialized.current = true;
      return;
    }
    const routeKey = `${path}|${hiddenAppIds.join(',')}${path === '/' ? `|${isLocked}` : ''}`;

    if (path === '/') {
      routeInitialized.current = true;
      lastHandledRoute.current = routeKey;
      if (!isLocked) lockScreen();
      navigateToDesktop();
      return;
    }

    if (lastHandledRoute.current === routeKey) return;

    if (path === '/home') {
      routeInitialized.current = true;
      lastHandledRoute.current = routeKey;
      if (isLocked) void unlockScreen('');
      suppressNextRouteSync.current = true;
      navigateToDesktop();
      return;
    }

    if (!publishedAppAvailabilityReady) return;

    const route = getApplicationRoute(path);
    if (route && !isApplicationRouteAvailable(route, hiddenAppIds)) {
      const nextPath = '/home';
      suppressNextRouteSync.current = true;
      window.history.replaceState({}, document.title, nextPath);
      navigateToDesktop();
      routeInitialized.current = true;
      lastHandledRoute.current = `${nextPath}|${hiddenAppIds.join(',')}`;
      setRouteRevision((revision) => revision + 1);
      return;
    }

    if (route) {
      if (isLocked) return;
      routeInitialized.current = true;
      lastHandledRoute.current = routeKey;
      pendingRouteAppId.current = route.appId;
      suppressNextRouteSync.current = true;
      openApp(route.appId);
      return;
    }

    routeInitialized.current = true;
    lastHandledRoute.current = routeKey;
    if (path !== '/' && path !== '/home') {
      suppressNextRouteSync.current = true;
      window.history.replaceState({}, document.title, '/home');
      setRouteRevision((revision) => revision + 1);
    }
  }, [
    publishedAppAvailabilityReady,
    hiddenAppIds,
    routeRevision,
    isLocked,
    lockScreen,
    unlockScreen,
    openApp,
    navigateToDesktop,
  ]);

  React.useEffect(() => {
    if (!publishedAppAvailabilityReady) return;
    if (isLocked) {
      return;
    }
    if (!routeInitialized.current) return;
    const currentPath = normalizeApplicationPath(window.location.pathname);
    if (currentPath === '/') return;
    const adminPath = currentPath === '/admin-control-center' || currentPath === '/admin' || currentPath.startsWith('/admin/');
    const visibleAdminWindow = windows.some((window) => window.appId === 'admin' && !window.isMinimized);
    if (adminPath && !visibleAdminWindow) return;
    if (pendingRouteAppId.current) {
      const pendingWindowIsOpen = windows.some((window) =>
        window.appId === pendingRouteAppId.current && !window.isMinimized
      );
      if (!pendingWindowIsOpen) return;
      pendingRouteAppId.current = null;
    }
    const activeWindow = windows.find((window) => window.id === activeWindowId && !window.isMinimized);
    const nextPath = activeWindow ? getApplicationRouteById(activeWindow.appId)?.path || '/home' : '/home';
    if (suppressNextRouteSync.current) {
      if (currentPath === nextPath) {
        suppressNextRouteSync.current = false;
      }
      return;
    }
    if (currentPath === nextPath) return;
    window.history.pushState({}, document.title, nextPath);
    setRouteRevision((revision) => revision + 1);
  }, [windows, activeWindowId, isLocked, publishedAppAvailabilityReady]);

  React.useEffect(() => {
    const handleAdminShortcut = (event: KeyboardEvent) => {
      if (!matchesAdminShortcut(event, getAdminShortcut())) return;
      event.preventDefault();
      event.stopPropagation();
      const url = new URL(window.location.href);
      url.pathname = '/admin-control-center';
      url.search = '';
      url.hash = '';
      window.history.pushState({}, document.title, `${url.pathname}${url.search}`);
      setRouteRevision((revision) => revision + 1);
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
    const isAdminRoute = window.location.pathname.startsWith('/admin')
      || window.location.hash.toLowerCase() === '#admin'
      || new URLSearchParams(window.location.search).get('app') === 'admin';
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
            url.searchParams.delete('app');
            url.searchParams.delete('admin');
            url.pathname = '/admin-control-center';
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
            onUnlock={() => {
              if (normalizeApplicationPath(window.location.pathname) !== '/') return;
              window.history.pushState({}, document.title, '/home');
              setRouteRevision((revision) => revision + 1);
            }}
          />
        )}
      </AnimatePresence>
      <Desktop>
        <AnimatePresence>
          {windows
            .filter((win) => win.appId === 'admin' || (publishedAppAvailabilityReady && !hiddenAppIds.includes(win.appId)))
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
  const pathname = normalizeApplicationPath(window.location.pathname);
  if (pathname === '/privacy-policy') {
    return <PrivacyPolicy />;
  }
  if (pathname === '/app-info') return <AppInfo />;

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
