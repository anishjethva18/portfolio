import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Bell, Volume2, Volume1, VolumeX } from 'lucide-react';
import { BatteryIndicator } from './BatteryIndicator';
import { useOS } from '../../context/OSContext';
import { useNetworkInfo } from '../../hooks/useNetworkInfo';
import { useBattery } from '../../hooks/useBattery';
import { haptics } from '../../utils/haptics';
import { formatTime, getZonedDateParts } from '../../utils/dateTime';

export const MobileStatusBar: React.FC = () => {
  const { settings, toggleTrayPanel, toggleNotifications, toggleTouchKeyboard, notifications, closeTrayPanels, closeNotifications, openApp, windows, minimizeWindow, focusWindow } = useOS();
  const { networkName } = useNetworkInfo();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  const battery = useBattery();
  const batteryLevel = battery.level;
  const isCharging = battery.isCharging;
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const updateTimeAndDate = () => {
      const now = new Date();
      setTime(formatTime(now, {
        hour: '2-digit',
        minute: '2-digit',
        second: settings.showSecondsInClock ? '2-digit' : undefined,
        hour12: settings.clockFormat === '12h',
      }, settings.timeZone));

      // Format custom date according to settings.dateFormat
      const fmt = settings.dateFormat || 'DD/MM/YYYY';
      const { month, day, year } = getZonedDateParts(now, settings.timeZone);
      const monthValue = String(month).padStart(2, '0');
      const dayValue = String(day).padStart(2, '0');

      if (fmt === 'DD/MM/YYYY') {
        setDateStr(`${dayValue}/${monthValue}/${year}`);
      } else if (fmt === 'YYYY-MM-DD') {
        setDateStr(`${year}-${monthValue}-${dayValue}`);
      } else if (fmt === 'MMM D, YYYY') {
        setDateStr(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: settings.timeZone }).format(now));
      } else if (fmt === 'DD-MM-YYYY') {
        setDateStr(`${dayValue}-${monthValue}-${year}`);
      } else {
        setDateStr(`${monthValue}/${dayValue}/${year}`);
      }
    };

    updateTimeAndDate();
    const timer = setInterval(updateTimeAndDate, 1000);
    return () => clearInterval(timer);
  }, [settings.clockFormat, settings.dateFormat, settings.timeZone, settings.showSecondsInClock]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  return (
    <div
      id="mobile-status-bar"
      className="sm:hidden fixed top-0 left-0 right-0 h-8 z-[1002] px-2.5 flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white select-none pointer-events-auto backdrop-blur-md bg-white/85 dark:bg-black/60 border-b border-slate-300/60 dark:border-white/10 shadow-xs"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          setTouchStartX(e.touches[0].clientX);
          setTouchStartY(e.touches[0].clientY);
        }
      }}
      onTouchEnd={(e) => {
        if (touchStartY !== null && e.changedTouches.length > 0) {
          const deltaY = e.changedTouches[0].clientY - touchStartY;
          const currentX = touchStartX ?? e.changedTouches[0].clientX;
          const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
          if (deltaY > 12) {
            haptics.medium();
            if (currentX < screenWidth / 2) {
              // Pulled down from left side: Open Notification Center
              closeTrayPanels();
              toggleNotifications();
            } else {
              // Pulled down from right side: Open Battery, Sound, Wi-Fi menu
              closeNotifications();
              toggleTrayPanel('battery');
            }
          }
        }
        setTouchStartY(null);
        setTouchStartX(null);
      }}
    >
      {/* Left: Time, Date and Notifications */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.light();
            toggleTrayPanel('calendar');
          }}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-all cursor-pointer"
          title="Date & Calendar"
        >
          <span className="font-bold tracking-tight tabular-nums text-xs text-slate-900 dark:text-white">
            {time}
          </span>
          {settings.showDateOnMobileStatusBar === true && dateStr && (
            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium font-mono">
              {dateStr}
            </span>
          )}
        </button>

        {settings.showNotificationsOnTaskbar !== false && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptics.light();
              toggleNotifications();
            }}
            className="relative p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-all cursor-pointer flex items-center justify-center"
            title={`Notifications (${notifications.length})`}
          >
            <Bell className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            {unreadNotifications > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-cyan-500 animate-pulse ring-1 ring-white dark:ring-black" />
            )}
          </button>
        )}
      </div>

      {/* Center: Dynamic Island / Notch Pill - Fixed at exact mathematical center for all device views */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-16 xs:w-20 h-3.5 rounded-full bg-slate-900 dark:bg-black border border-slate-700/50 dark:border-white/10 shadow-inner flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0 pointer-events-auto z-10 hover:border-cyan-400"
        onClick={(e) => {
          e.stopPropagation();
          haptics.light();
          const cameraWindow = windows.find((w) => w.appId === 'camera');
          if (cameraWindow) {
            if (cameraWindow.isMinimized) {
              focusWindow(cameraWindow.id);
            } else if (cameraWindow.isFocused) {
              minimizeWindow(cameraWindow.id);
            } else {
              focusWindow(cameraWindow.id);
            }
          } else {
            openApp('camera');
          }
        }}
        title="Tap to open/toggle Camera"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      </div>

      {/* Right: Sound, Wi-Fi & Battery */}
      <div className="flex items-center gap-1 shrink-0 justify-end">
        {/* Sound / Volume */}
        {settings.showSoundOnTaskbar !== false && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptics.light();
              toggleTrayPanel('battery');
            }}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-all cursor-pointer flex items-center"
            title={`Sound: ${settings.soundEnabled ? Math.round((settings.soundVolume ?? 0.5) * 100) + '%' : 'Muted'}`}
          >
            {!settings.soundEnabled || (settings.soundVolume ?? 0.5) === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-500 stroke-[2.2]" />
            ) : (settings.soundVolume ?? 0.5) <= 0.35 ? (
              <Volume1 className="w-3.5 h-3.5 text-slate-900 dark:text-white stroke-[2.2]" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-900 dark:text-white stroke-[2.2]" />
            )}
          </button>
        )}

        {/* Wi-Fi */}
        {settings.showWifiOnTaskbar !== false && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptics.light();
              toggleTrayPanel('wifi');
            }}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-all cursor-pointer flex items-center gap-1"
            title={`Wi-Fi: ${networkName}`}
          >
            {isOnline && settings.wifiEnabled !== false ? (
              <Wifi className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0 stroke-[2.2]" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-500 shrink-0 stroke-[2.2]" />
            )}
          </button>
        )}

        {/* Battery with Live Point / Level indicator */}
        {settings.showBatteryOnTaskbar !== false && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptics.light();
              toggleTrayPanel('battery');
            }}
            className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-all cursor-pointer shrink-0"
            title={`Battery: ${batteryLevel}% ${isCharging ? '(Charging)' : ''}`}
          >
            <BatteryIndicator
              level={batteryLevel}
              isCharging={isCharging}
              size="xs"
            />
            <span className="text-[10px] tabular-nums font-mono min-w-[20px] text-right font-bold text-slate-900 dark:text-white ml-0.5">
              {batteryLevel}%
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

