import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { AppId } from '../../types';
import { APPS_LIST } from '../../data/portfolioData';
import { AppIcon } from '../common/AppIcon';
import { Search, Wifi, WifiOff, Volume2, Volume1, VolumeX, Bell, Keyboard } from 'lucide-react';
import { BatteryIndicator } from '../common/BatteryIndicator';
import { StartMenu } from './StartMenu';
import { SearchFlyout } from './SearchFlyout';
import { NotificationCenter } from './NotificationCenter';
import { SystemTrayPanels } from './SystemTrayPanels';
import { haptics } from '../../utils/haptics';
import { useLongPress } from '../../utils/useLongPress';
import { WeatherData, fetchLiveWeather } from '../../utils/weather';
import { useNetworkInfo } from '../../hooks/useNetworkInfo';
import { useBattery } from '../../hooks/useBattery';
import { formatDate, formatTime, getZonedDateParts } from '../../utils/dateTime';

interface TaskbarAppButtonProps {
  app: any;
  displayName: string;
  isFocused: boolean;
  isRunning: boolean;
  runningWins: any[];
  accentColor?: string;
  onOpenApp: (id: AppId) => void;
  onMinimizeWindow: (id: string) => void;
  onFocusWindow: (id: string) => void;
  onShowContextMenu: (menu: any) => void;
  draggedTaskbarApp: AppId | null;
  setDraggedTaskbarApp: (id: AppId | null) => void;
  pinnedAppIds: AppId[];
  reorderPinnedApps: (newOrder: AppId[]) => void;
}

const TaskbarAppButton: React.FC<TaskbarAppButtonProps> = ({
  app,
  displayName,
  isFocused,
  isRunning,
  runningWins,
  accentColor,
  onOpenApp,
  onMinimizeWindow,
  onFocusWindow,
  onShowContextMenu,
  draggedTaskbarApp,
  setDraggedTaskbarApp,
  pinnedAppIds,
  reorderPinnedApps,
}) => {
  const longPress = useLongPress(
    (e, coords) => {
      onShowContextMenu({
        type: 'taskbar-app',
        x: coords?.x ?? 40,
        y: coords?.y ?? (window.innerHeight - 60),
        appId: app.id,
      });
    },
    { threshold: 380, hapticFeedback: true }
  );

  return (
    <button
      draggable={true}
      onDragStart={(e) => {
        const isExplorer = app.id === 'explorer';
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({
            type: 'desktop_icon',
            id: isExplorer ? 'icon-thispc' : `icon-${app.id}`,
            appId: app.id,
            name: isExplorer ? 'This PC' : app.name,
            icon: isExplorer ? 'Monitor' : app.icon,
          })
        );
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedTaskbarApp && draggedTaskbarApp !== app.id) {
          const currentIndex = pinnedAppIds.indexOf(draggedTaskbarApp);
          const targetIndex = pinnedAppIds.indexOf(app.id);
          if (currentIndex !== -1 && targetIndex !== -1) {
            const newOrder = [...pinnedAppIds];
            const [moved] = newOrder.splice(currentIndex, 1);
            newOrder.splice(targetIndex, 0, moved);
            reorderPinnedApps(newOrder);
          }
        }
        setDraggedTaskbarApp(null);
      }}
      aria-label={displayName}
      className={`relative group flex items-center justify-center min-w-10 min-h-10 w-10 h-10 rounded-xl transition-all cursor-pointer select-none shrink-0 ${
        isFocused
          ? 'bg-slate-200/80 dark:bg-white/15'
          : isRunning
          ? 'hover:bg-slate-100 dark:hover:bg-white/10 bg-slate-100/40 dark:bg-white/5'
          : 'hover:bg-slate-100 dark:hover:bg-white/10'
      }`}
      onClick={(e) => {
        if (longPress.didTriggerLongPress()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (typeof window !== 'undefined' && (window as any).__lastLongPressTime && Date.now() - (window as any).__lastLongPressTime < 600) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (!isRunning) {
          onOpenApp(app.id);
        } else {
          const activeWin = runningWins[0];
          if (activeWin.isFocused && !activeWin.isMinimized) {
            onMinimizeWindow(activeWin.id);
          } else {
            onFocusWindow(activeWin.id);
          }
        }
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onShowContextMenu({ type: 'taskbar-app', x: e.clientX, y: e.clientY, appId: app.id });
      }}
    >
      <div className="group-hover:scale-110 transition-transform text-blue-500 dark:text-blue-400">
        <AppIcon appId={app.id} name={app.icon} className="w-5 h-5" />
      </div>

      {/* Windows 11 Hover Tooltip */}
      <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-medium tracking-wide shadow-xl border border-white/15 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 delay-150 z-[9999]">
        <span>{displayName}</span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-800/95" />
      </div>

      {/* Running Active Line Indicator Underneath */}
      {isRunning && (
        <div
          className={`absolute bottom-0.5 h-1 rounded-full transition-all duration-200 ${
            isFocused ? 'w-5' : 'w-2 bg-slate-400 dark:bg-slate-500'
          }`}
          style={isFocused ? { backgroundColor: accentColor || '#0078d4' } : undefined}
        />
      )}
    </button>
  );
};

export const Taskbar: React.FC = () => {
  const {
    windows,
    openApp,
    focusWindow,
    minimizeWindow,
    isStartOpen,
    toggleStart,
    isSearchOpen,
    toggleSearch,
    isNotificationsOpen,
    toggleNotifications,
    notifications,
    activeTrayPanel,
    toggleTrayPanel,
    showDesktop,
    settings,
    showContextMenu,
    pinnedAppIds,
    apps = [],
    pinToTaskbar,
    reorderPinnedApps,
    isWidgetsOpen,
    toggleWidgets,
    toggleTouchKeyboard,
  } = useOS();

  const [draggedTaskbarApp, setDraggedTaskbarApp] = useState<AppId | null>(null);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [isTaskbarHovered, setIsTaskbarHovered] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const battery = useBattery();
  const batteryLevel = battery.level;
  const isCharging = battery.isCharging;
  const { isOnline, networkName } = useNetworkInfo();
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLiveWeather()
      .then((data) => {
        if (active) setWeatherData(data);
      })
      .catch((error: unknown) => {
        console.warn('[Taskbar] Live weather is unavailable.', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const taskbarLongPress = useLongPress(
    (e, coords) => {
      const target = e.target as HTMLElement;
      if (!target.closest('button') && !target.closest('[data-tray="true"]')) {
        showContextMenu({
          type: 'taskbar-space',
          x: coords?.x ?? (window.innerWidth / 2),
          y: coords?.y ?? (window.innerHeight - 60),
        });
      }
    },
    { threshold: 380, hapticFeedback: true }
  );

  // Live Clock & Date Updating
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(formatTime(now, {
        hour: '2-digit',
        minute: '2-digit',
        second: settings.showSecondsInClock ? '2-digit' : undefined,
        hour12: settings.clockFormat === '12h',
      }, settings.timeZone));

      // Custom date format formatting
      const fmt = settings.dateFormat || 'DD/MM/YYYY';
      const { month, day, year } = getZonedDateParts(now, settings.timeZone);
      const monthValue = String(month).padStart(2, '0');
      const dayValue = String(day).padStart(2, '0');

      if (fmt === 'DD/MM/YYYY') {
        setDateStr(`${dayValue}/${monthValue}/${year}`);
      } else if (fmt === 'YYYY-MM-DD') {
        setDateStr(`${year}-${monthValue}-${dayValue}`);
      } else if (fmt === 'MMM D, YYYY') {
        setDateStr(formatDate(now, { month: 'short', day: 'numeric', year: 'numeric' }, settings.timeZone));
      } else if (fmt === 'ddd, MMM D, YYYY') {
        setDateStr(formatDate(now, { weekday: 'short', month: 'short', day: 'numeric' }, settings.timeZone));
      } else if (fmt === 'D MMMM YYYY') {
        setDateStr(formatDate(now, { day: 'numeric', month: 'long', year: 'numeric' }, settings.timeZone));
      } else if (fmt === 'DD-MM-YYYY') {
        setDateStr(`${dayValue}-${monthValue}-${year}`);
      } else {
        setDateStr(`${monthValue}/${dayValue}/${year}`);
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [settings.clockFormat, settings.dateFormat, settings.timeZone, settings.showSecondsInClock]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Taskbar icons list: Pinned apps + running unpinned apps
  const runningAppIds = Array.from(new Set(windows.map((w) => w.appId)));
  const pinnedApps = apps.filter((a) => pinnedAppIds.includes(a.id));

  // Combine pinned apps with any other app currently running
  const taskbarApps = [
    ...pinnedApps,
    ...apps.filter((a) => !pinnedAppIds.includes(a.id) && runningAppIds.includes(a.id)),
  ];
  if (runningAppIds.includes('admin') && !taskbarApps.some((app) => app.id === 'admin')) {
    const adminApp = APPS_LIST.find((app) => app.id === 'admin');
    if (adminApp) taskbarApps.push(adminApp);
  }

  const handleTaskbarContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu({ type: 'taskbar-space', x: e.clientX, y: e.clientY });
  };

  const shouldHideTaskbar =
    settings.taskbarAutoHide &&
    !isTaskbarHovered &&
    !isStartOpen &&
    !isSearchOpen &&
    !isNotificationsOpen &&
    !activeTrayPanel;

  return (
    <>
      {/* Bottom Edge Mouse Trigger Zone when Auto-Hide is enabled */}
      {settings.taskbarAutoHide && (
        <div
          className="fixed bottom-0 inset-x-0 h-3 z-[1001]"
          onMouseEnter={() => setIsTaskbarHovered(true)}
        />
      )}

      {/* Start Menu Flyout */}
      {isStartOpen && <StartMenu />}

      {/* Search Flyout */}
      {isSearchOpen && <SearchFlyout />}

      {/* Notification Center Flyout */}
      {isNotificationsOpen && <NotificationCenter />}

      {/* System Tray Flyouts */}
      <SystemTrayPanels />

      {/* Main Taskbar Container */}
      <div
        id="taskbar-container"
        data-taskbar="true"
        className={`fixed bottom-0 inset-x-0 h-auto pb-[env(safe-area-inset-bottom,0px)] z-[1000] flex flex-col select-none shadow-2xl transition-all duration-300 transform ${
          shouldHideTaskbar ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        } ${
          settings.transparency
            ? 'bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl'
            : 'bg-white dark:bg-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={handleTaskbarContextMenu}
        onMouseEnter={() => setIsTaskbarHovered(true)}
        onMouseLeave={() => setIsTaskbarHovered(false)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            setTouchStartY(e.touches[0].clientY);
          }
          taskbarLongPress.onTouchStart(e);
        }}
        onTouchMove={taskbarLongPress.onTouchMove}
        onTouchEnd={(e) => {
          taskbarLongPress.onTouchEnd(e);
          if (touchStartY !== null && e.changedTouches.length > 0) {
            const endY = e.changedTouches[0].clientY;
            const deltaY = endY - touchStartY;
            // Swipe up gesture (deltaY < -30) triggers Start Menu on mobile
            if (deltaY < -30 && !isStartOpen) {
              toggleStart();
            }
          }
          setTouchStartY(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'link';
        }}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const rawData = e.dataTransfer.getData('text/plain');
            if (!rawData) return;
            const data = JSON.parse(rawData);
            if (data.type === 'desktop_icon' && data.appId) {
              pinToTaskbar(data.appId as AppId);
            } else if (data.type === 'file_item' && data.file) {
              if (data.file.content && data.file.content.startsWith('app:')) {
                const appId = data.file.content.replace('app:', '') as AppId;
                pinToTaskbar(appId);
              } else {
                openApp('explorer');
              }
            }
          } catch {
            // ignore taskbar drop error
          }
        }}
      >
        <div className="w-full h-12 flex items-center justify-between px-1.5 sm:px-3 gap-1">
        {/* Left Weather / Widgets Pill (Windows 11 Live Weather - Desktop & Mobile) */}
        {settings.showWidgetsOnTaskbar !== false && (
          <div className="shrink-0 flex items-center pl-0.5 sm:pl-0">
            {/* Desktop Weather Pill */}
            <button
              id="taskbar-weather-pill"
              onClick={() => {
                haptics.light();
                toggleWidgets();
              }}
              className={`hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl transition-all cursor-pointer select-none ${
                isWidgetsOpen
                  ? 'bg-blue-500/20 text-cyan-400 ring-1 ring-cyan-500/40'
                  : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
              }`}
              title={weatherData
                ? `${weatherData.isLive ? 'Live' : 'Cached'} weather: ${weatherData.tempC}°C ${weatherData.condition} in ${weatherData.city} (Win+W)`
                : 'Widgets & Weather (Win+W)'}
            >
              <span className="text-lg leading-none">{weatherData?.icon || '🌤️'}</span>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{weatherData ? `${weatherData.tempC}°C` : '--°C'}</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                  {weatherData ? `${weatherData.isLive ? 'Live' : 'Cached'} • ${weatherData.condition} • ${weatherData.city}` : 'Weather unavailable'}
                </span>
              </div>
            </button>

            {/* Mobile Weather / Widget Pill */}
            <button
              id="taskbar-weather-pill-mobile"
              onClick={() => {
                haptics.light();
                toggleWidgets();
              }}
              className={`flex sm:hidden items-center gap-1 px-2 min-h-10 h-10 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
                isWidgetsOpen
                  ? 'bg-blue-500/25 text-cyan-500 ring-1 ring-cyan-500/40'
                  : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5'
              }`}
              title={weatherData
                ? `${weatherData.isLive ? 'Live' : 'Cached'} weather: ${weatherData.tempC}°C ${weatherData.condition} in ${weatherData.city}`
                : 'Widgets & Weather'}
              aria-label={weatherData
                ? `${weatherData.isLive ? 'Live' : 'Cached'} weather: ${weatherData.tempC}°C ${weatherData.condition} in ${weatherData.city}`
                : 'Widgets & Weather'}
            >
              <span className="text-base leading-none">{weatherData?.icon || '🌤️'}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{weatherData ? `${weatherData.tempC}°` : '--°'}</span>
              {weatherData && !weatherData.isLive && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              )}
            </button>
          </div>
        )}

        {/* Taskbar Icons: Center or Left aligned for desktop, always fully accessible on mobile */}
        <div
          className={`flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 py-0.5 px-1.5 ${
            settings.taskbarAlignment === 'left' ? 'justify-start sm:mr-auto' : 'justify-center sm:mx-auto'
          }`}
        >
          {/* Windows Start Button - Always visible, never squished */}
          <button
            id="taskbar-start-button"
            className={`shrink-0 group relative flex items-center justify-center min-w-10 min-h-10 w-10 h-10 rounded-xl transition-all cursor-pointer ${
              isStartOpen
                ? 'bg-blue-500/20 text-blue-500 scale-95'
                : 'hover:bg-slate-100 dark:hover:bg-white/10 text-blue-600 dark:text-blue-400'
            }`}
            onClick={toggleStart}
            aria-label="Start"
          >
            {/* Windows 11 Start Icon Graphic */}
            <div className="group-hover:scale-110 transition-transform flex items-center justify-center">
              <AppIcon name="Start" size={22} />
            </div>

            {/* Windows 11 Hover Tooltip */}
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-medium tracking-wide shadow-xl border border-white/15 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 delay-150 z-[9999]">
              <span>Start</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-800/95" />
            </div>
          </button>

          {/* Search Button (Box, Icon, or Hidden) */}
          {settings.showSearchOnTaskbar !== 'hide' && (
            settings.showSearchOnTaskbar === 'box' ? (
              <>
                {/* Desktop Search Box */}
                <button
                  id="taskbar-search-box-desktop"
                  className={`shrink-0 group relative hidden sm:flex items-center gap-2 px-3 h-8.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs transition-all cursor-pointer ${
                    isSearchOpen ? 'ring-2 ring-blue-500 bg-white/20' : ''
                  }`}
                  onClick={toggleSearch}
                  aria-label="Search"
                >
                  <Search className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="font-normal text-slate-700 dark:text-slate-300">Search</span>
                  {/* Windows 11 Hover Tooltip */}
                  <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-medium tracking-wide shadow-xl border border-white/15 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 delay-150 z-[9999]">
                    <span>Search</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-800/95" />
                  </div>
                </button>

                {/* Mobile Search Button (Compact icon, no text, to save space) */}
                <button
                  id="taskbar-search-box-mobile"
                  className={`shrink-0 group relative flex sm:hidden items-center justify-center min-w-10 min-h-10 w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 active:bg-slate-200 dark:active:bg-white/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200 transition-all cursor-pointer ${
                    isSearchOpen ? 'ring-2 ring-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-400' : ''
                  }`}
                  onClick={toggleSearch}
                  aria-label="Search"
                >
                  <Search className="w-4.5 h-4.5 text-blue-500 dark:text-blue-400" />
                </button>
              </>
            ) : (
              <button
                className={`shrink-0 group relative flex items-center justify-center min-w-10 min-h-10 w-10 h-10 rounded-xl transition-all cursor-pointer ${
                  isSearchOpen
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                }`}
                onClick={toggleSearch}
                aria-label="Search"
              >
                <Search className="w-4.5 h-4.5 text-blue-500 dark:text-blue-400" />
                {/* Windows 11 Hover Tooltip */}
                <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-medium tracking-wide shadow-xl border border-white/15 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 delay-150 z-[9999]">
                  <span>Search</span>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-800/95" />
                </div>
              </button>
            )
          )}

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-white/10 mx-0.5" />

          {/* Scrollable Container for Application Shortcut Icons */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x min-w-0 py-0.5 px-0.5">
            {taskbarApps.map((app) => {
              const runningWins = windows.filter((w) => w.appId === app.id);
              const isRunning = runningWins.length > 0;
              const isFocused = runningWins.some((w) => w.isFocused && !w.isMinimized);
              const displayName = app.id === 'explorer' ? 'File Explorer' : app.name;

              return (
                <TaskbarAppButton
                  key={app.id}
                  app={app}
                  displayName={displayName}
                  isFocused={isFocused}
                  isRunning={isRunning}
                  runningWins={runningWins}
                  accentColor={settings.accentColor}
                  onOpenApp={openApp}
                  onMinimizeWindow={minimizeWindow}
                  onFocusWindow={focusWindow}
                  onShowContextMenu={showContextMenu}
                  draggedTaskbarApp={draggedTaskbarApp}
                  setDraggedTaskbarApp={setDraggedTaskbarApp}
                  pinnedAppIds={pinnedAppIds}
                  reorderPinnedApps={reorderPinnedApps}
                />
              );
            })}
          </div>

          {/* Virtual Touch Keyboard on Mobile Taskbar if enabled */}
          {settings.showTouchKeyboardOnTaskbar && (
            <button
              id="taskbar-mobile-touch-keyboard"
              onClick={() => {
                haptics.light();
                toggleTouchKeyboard();
              }}
              className="sm:hidden shrink-0 flex items-center justify-center min-w-10 min-h-10 w-10 h-10 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 active:scale-95 cursor-pointer transition-transform"
              title="Virtual Touch Keyboard"
            >
              <Keyboard className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Right System Tray & Clock (Hidden on Mobile, as MobileStatusBar handles top status) */}
        <div className="hidden sm:flex items-center gap-0.5 sm:gap-1.5 text-xs text-slate-700 dark:text-slate-200 shrink-0">
          {/* Virtual Touch Keyboard Button in System Tray */}
          {settings.showTouchKeyboardOnTaskbar && (
            <button
              id="taskbar-touch-keyboard-button"
              onClick={() => {
                haptics.light();
                toggleTouchKeyboard();
              }}
              className="flex items-center justify-center p-1.5 min-h-[44px] sm:min-h-0 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shrink-0"
              title="Virtual Touch Keyboard"
            >
              <Keyboard className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </button>
          )}
          {/* Wi-Fi, Volume, Battery Group */}
          {(settings.showWifiOnTaskbar !== false ||
            settings.showSoundOnTaskbar !== false ||
            settings.showBatteryOnTaskbar !== false) && (
            <button
              className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2.5 py-1 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
              onClick={() => toggleTrayPanel('battery')}
              title={`Quick Settings (Wi-Fi, Sound, Battery)`}
            >
              {/* Wi-Fi Status Indicator */}
              {settings.showWifiOnTaskbar !== false && (
                <div
                  title={
                    settings.wifiEnabled === false
                      ? 'Wi-Fi: Disconnected (Wi-Fi is Off)'
                      : !isOnline
                      ? 'No Internet Access (Offline)'
                      : 'Wi-Fi: Connected'
                  }
                  className="flex items-center"
                >
                  {settings.wifiEnabled === false || !isOnline ? (
                    <WifiOff className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  ) : (
                    <Wifi className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  )}
                </div>
              )}

              {/* Sound Status Indicator */}
              {settings.showSoundOnTaskbar !== false && (
                <div
                  title={
                    !settings.soundEnabled || (settings.soundVolume ?? 0.5) === 0
                      ? 'Speakers: Muted (0%)'
                      : `Speakers: ${Math.round((settings.soundVolume ?? 0.5) * 100)}%`
                  }
                  className="hidden xs:flex sm:flex items-center"
                >
                  {!settings.soundEnabled || (settings.soundVolume ?? 0.5) === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  ) : (settings.soundVolume ?? 0.5) <= 0.35 ? (
                    <Volume1 className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />
                  )}
                </div>
              )}

              {/* Battery Status Indicator */}
              {settings.showBatteryOnTaskbar !== false && (
                <div
                  className="flex items-center gap-1.5"
                  title={isCharging ? `Battery: ${batteryLevel}% (Plugged in)` : `Battery: ${batteryLevel}%`}
                >
                  <BatteryIndicator level={batteryLevel} isCharging={isCharging} size="sm" />
                  <span className="hidden sm:inline text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {batteryLevel}%
                  </span>
                </div>
              )}
            </button>
          )}

          {/* Time & Date */}
          <button
            className="flex flex-col items-end px-1.5 sm:px-2 py-1 min-h-[44px] sm:min-h-0 justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-right cursor-pointer transition-colors"
            onClick={() => toggleTrayPanel('calendar')}
          >
            <span className="font-semibold text-xs leading-none">{timeStr}</span>
            <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
              {dateStr}
            </span>
          </button>

          {/* Notification Center Button */}
          {settings.showNotificationsOnTaskbar !== false && (
            <button
              className="relative flex items-center justify-center min-w-[40px] min-h-[44px] sm:min-w-8 sm:min-h-8 sm:w-8 sm:h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
              onClick={toggleNotifications}
              title="Notification Center"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>
          )}

          {/* Far Right Edge "Show Desktop" Peek Strip */}
          <button
            className="w-1.5 h-8 hover:bg-blue-500/50 rounded-xs cursor-pointer ml-1 transition-colors"
            onClick={showDesktop}
            title="Show Desktop"
          />
        </div>
      </div>
    </div>
  </>
  );
};
