import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useOS } from '../../context/OSContext';
import { useBattery } from '../../hooks/useBattery';
import { usePublishedProfile } from '../../hooks/usePublishedProfile';
import { formatDate, formatTime } from '../../utils/dateTime';
import { BatteryIndicator } from '../common/BatteryIndicator';
import {
  Wifi,
  WifiOff,
  Power,
  Moon,
  RotateCcw,
  Sparkles,
  ChevronUp,
  CloudSun,
} from 'lucide-react';

interface LockScreenProps {
  wallpaper: string;
}

const FALLBACK_WALLPAPER = '/wallpapers/Landscape_Mountain_Lake.jpg';

export const LockScreen: React.FC<LockScreenProps> = ({ wallpaper }) => {
  const { isLocked, unlockScreen } = useAuth();
  const { setPowerState, files, settings } = useOS();
  const { siteSettings } = usePublishedProfile();
  const battery = useBattery();

  const [time, setTime] = useState(new Date());
  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [isOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wallpaperError, setWallpaperError] = useState(false);

  // Resolve wallpaper
  const resolvedWallpaper = React.useMemo(() => {
    if (!wallpaper) {
      return FALLBACK_WALLPAPER;
    }
    const matchingFile = files.find(
      (f) => f.path === wallpaper || f.id === wallpaper || f.name === wallpaper
    );
    if (matchingFile?.content) {
      return matchingFile.content;
    }
    return wallpaper;
  }, [wallpaper, files]);

  useEffect(() => {
    setWallpaperError(false);
  }, [resolvedWallpaper]);

  const displayedWallpaper = wallpaperError ? FALLBACK_WALLPAPER : resolvedWallpaper;
  const isVideoWallpaper =
    !wallpaperError &&
    (displayedWallpaper.endsWith('.mp4') ||
      displayedWallpaper.endsWith('.webm') ||
      displayedWallpaper.startsWith('data:video/'));

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Direct unlock on any key press
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPowerMenu) {
        if (e.key === 'Escape') setShowPowerMenu(false);
        return;
      }
      void unlockScreen('');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, showPowerMenu, unlockScreen]);

  if (!isLocked) return null;

  const handleUnlock = () => {
    void unlockScreen('');
  };

  return (
    <motion.div
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -100 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      id="windows-lock-screen"
      className="fixed inset-0 z-[99999] flex flex-col justify-between overflow-hidden select-none"
      onClick={() => {
        if (showPowerMenu) {
          setShowPowerMenu(false);
        } else {
          handleUnlock();
        }
      }}
    >
      {/* Background Wallpaper Container */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
        {isVideoWallpaper ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            key={displayedWallpaper}
            src={displayedWallpaper}
            onError={() => setWallpaperError(true)}
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        ) : (
          <img
            src={displayedWallpaper}
            alt="Lock Screen Wallpaper"
            referrerPolicy="no-referrer"
            onError={() => setWallpaperError(true)}
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        )}
      </div>

      {/* Acrylic backdrop filter */}
      <div className="absolute inset-0 transition-all duration-500 z-1 bg-black/30 backdrop-blur-[1px] hover:backdrop-blur-none" />

      {/* Top Status Indicators */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-6 text-white/85">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium bg-black/40 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg text-white/90">
            <CloudSun className="w-3.5 h-3.5 text-amber-300" />
            <span>26°C Clear • RealFeel® 28°C</span>
          </div>
        </div>

        {/* Live Network & Shared Dynamic Battery Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm bg-black/40 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg">
            <div className="flex items-center gap-1.5" title={isOnline ? 'Internet Connected' : 'Offline'}>
              {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-rose-400" />}
              <span className="text-xs">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            <div
              className="flex items-center gap-1.5"
              title={
                battery.supported
                  ? `Battery: ${battery.level}% (${battery.chargingStatusText})`
                  : 'Battery status unavailable on this hardware'
              }
            >
              <BatteryIndicator level={battery.level} isCharging={battery.isCharging} size="sm" />
              <span className="text-xs font-semibold">
                {battery.supported && battery.level !== null ? `${battery.level}%` : 'N/A'}
                {battery.isCharging && ' ⚡'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Stage: Clock & Sign In Button */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
        onClick={handleUnlock}
      >
        <div className="flex flex-col items-center">
          <h1 className="text-7xl md:text-8xl font-light tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]">
            {formatTime(time, { hour: '2-digit', minute: '2-digit', hour12: false }, settings.timeZone)}
          </h1>
          <p className="mt-2 text-xl md:text-2xl font-normal text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
            {formatDate(time, { weekday: 'long', month: 'long', day: 'numeric' }, settings.timeZone)}
          </p>

          <div className="mt-8 flex flex-col items-center">
            <button
              id="lockscreen-enter-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleUnlock();
              }}
              className="flex min-h-11 items-center gap-2.5 rounded-full border border-white/30 bg-white/20 px-8 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-xl transition-all duration-200 hover:bg-blue-600 active:scale-95"
            >
              <Sparkles className="h-4 w-4 text-blue-300" />
              <span>Sign In</span>
            </button>

            <span className="mt-4 flex items-center gap-1.5 text-xs text-white/70 drop-shadow">
              <ChevronUp className="h-3.5 w-3.5 animate-bounce" />
              Click anywhere or press any key to unlock desktop
            </span>
          </div>
        </div>
      </div>

      {/* Bottom info bar & Windows 11 Power Controls */}
      <div className="relative z-10 flex items-center justify-between px-8 pb-6 text-white/80 text-xs">
        <div className="flex items-center gap-2">
          <span>Windows 11 Pro</span>
          <span>•</span>
          <span>Anish Jethva Portfolio</span>
          <span>•</span>
          <span className="text-white/60">Portfolio OS v{siteSettings.portfolioVersion || '1.0.0'}</span>
        </div>

        {/* Right Power & Quick Controls Menu */}
        <div className="relative flex items-center gap-3">
          <button
            id="lockscreen-power-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowPowerMenu((prev) => !prev);
            }}
            className="p-2.5 rounded-full bg-black/40 hover:bg-white/20 backdrop-blur-xl border border-white/15 text-white shadow-lg transition-all cursor-pointer"
            title="Power options"
          >
            <Power className="w-4 h-4 text-rose-400" />
          </button>

          {/* Windows 11 Power Popup Menu */}
          <AnimatePresence>
            {showPowerMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-12 w-48 rounded-2xl bg-slate-900/90 backdrop-blur-2xl border border-white/20 shadow-2xl p-2 text-white z-50 space-y-1"
              >
                <button
                  onClick={() => {
                    setShowPowerMenu(false);
                    setPowerState('sleep');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-xs"
                >
                  <Moon className="w-4 h-4 text-blue-400" />
                  <span>Sleep</span>
                </button>
                <button
                  onClick={() => {
                    setShowPowerMenu(false);
                    setPowerState('restart');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer text-xs"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>Restart</span>
                </button>
                <button
                  onClick={() => {
                    setShowPowerMenu(false);
                    setPowerState('shutdown');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-600/80 text-left transition-colors cursor-pointer text-xs text-rose-300 hover:text-white"
                >
                  <Power className="w-4 h-4" />
                  <span>Shut Down</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
