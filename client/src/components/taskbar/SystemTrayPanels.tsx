import React, {  } from 'react';
import { useOS } from '../../context/OSContext';
import { Wifi, WifiOff, Volume2, Volume1, VolumeX, Sun, Moon } from 'lucide-react';
import { BatteryIndicator } from '../common/BatteryIndicator';
import { NotificationCenter } from './NotificationCenter';
import { HeaderClockBanner } from '../common/HeaderClockBanner';
import { useNetworkInfo } from '../../hooks/useNetworkInfo';
import { useBattery } from '../../hooks/useBattery';

export const SystemTrayPanels: React.FC = () => {
  const { activeTrayPanel, closeTrayPanels, settings, updateSettings } = useOS();
  const battery = useBattery();
  const batteryLevel = battery.level;
  const isCharging = battery.isCharging;
  const { isOnline, networkName } = useNetworkInfo();

  const wifiEnabled = settings.wifiEnabled !== false;
  const isWifiConnected = wifiEnabled && isOnline;

  if (!activeTrayPanel) return null;

  if (activeTrayPanel === 'calendar') {
    return <NotificationCenter />;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-transparent z-[998]"
        onClick={closeTrayPanels}
      />
      <div
        className={`fixed top-9 right-2 sm:top-auto sm:bottom-14 sm:right-12 z-[999] w-80 max-w-[calc(100vw-24px)] p-4 rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl select-none animate-in fade-in zoom-in-95 duration-100 ${
          settings.transparency
            ? 'bg-white/85 dark:bg-slate-900/85 backdrop-blur-3xl'
            : 'bg-white dark:bg-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Dismiss Handle */}
        <div
          className="sm:hidden flex justify-center pb-2 cursor-pointer"
          onClick={closeTrayPanels}
        >
          <div className="w-10 h-1 rounded-full bg-slate-400/40 dark:bg-white/30" />
        </div>

        {/* Time / Date Clock Banner matching Image 1 (Mobile only) */}
        <HeaderClockBanner className="sm:hidden" />

        <div className="space-y-4 text-xs text-slate-800 dark:text-slate-100">
        {/* Quick Action Tiles */}
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
              isWifiConnected
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-400'
            }`}
            onClick={() => updateSettings({ wifiEnabled: !wifiEnabled })}
            title={isWifiConnected ? 'Click to disconnect Wi-Fi' : 'Click to enable Wi-Fi'}
          >
            {isWifiConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-rose-400" />}
            <div className="text-left truncate">
              <p className="font-bold">Wi-Fi</p>
              <p className="text-[10px] opacity-80">
                {wifiEnabled
                  ? isOnline
                    ? 'Connected'
                    : 'No Internet'
                  : 'Turned Off'}
              </p>
            </div>
          </button>

          <button
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
              settings.theme === 'dark'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
            }`}
            onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          >
            {settings.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <div className="text-left truncate">
              <p className="font-bold">Dark Mode</p>
              <p className="text-[10px] opacity-80">{settings.theme === 'dark' ? 'Enabled' : 'Disabled'}</p>
            </div>
          </button>
        </div>

        {/* System Volume Slider */}
        <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-white/10">
          <div className="flex items-center justify-between text-xs font-semibold">
            <button
              onClick={() =>
                updateSettings({
                  soundEnabled: !settings.soundEnabled,
                  soundVolume:
                    !settings.soundEnabled && (settings.soundVolume ?? 0) === 0
                      ? 0.5
                      : settings.soundVolume,
                })
              }
              className="flex items-center gap-1.5 hover:text-blue-500 transition-colors cursor-pointer"
              title={settings.soundEnabled && (settings.soundVolume ?? 0.5) > 0 ? 'Click to Mute' : 'Click to Unmute'}
            >
              {settings.soundVolume === 0 || !settings.soundEnabled ? (
                <VolumeX className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              ) : (settings.soundVolume ?? 0.5) <= 0.35 ? (
                <Volume1 className="w-4 h-4 text-blue-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-blue-500" />
              )}
              <span>System Volume</span>
            </button>
            <span className="font-mono text-xs">{settings.soundEnabled ? `${Math.round((settings.soundVolume ?? 0.5) * 100)}%` : '0%'}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.soundEnabled ? (settings.soundVolume ?? 0.5) : 0}
            onChange={(e) =>
              updateSettings({
                soundVolume: parseFloat(e.target.value),
                soundEnabled: parseFloat(e.target.value) > 0,
              })
            }
            className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Screen Brightness Controller Slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" />
              Screen Brightness
            </span>
            <span>{Math.round((settings.brightness ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={settings.brightness ?? 1}
            onChange={(e) =>
              updateSettings({
                brightness: parseFloat(e.target.value),
              })
            }
            className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Real System Battery Status Card */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <BatteryIndicator level={batteryLevel} isCharging={isCharging} size="md" />
            <div>
              <p className="font-bold">{batteryLevel !== null ? `Battery ${batteryLevel}%` : 'Battery N/A'}</p>
              <p className="text-[10px] text-slate-400">Power Mode: Best Performance</p>
            </div>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
              isCharging ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'
            }`}
          >
            {isCharging ? 'Plugged in' : 'On Battery'}
          </span>
        </div>
      </div>
    </div>
  </>
);
};
