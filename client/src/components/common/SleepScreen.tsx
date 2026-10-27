import React, { useState, useEffect, useMemo } from 'react';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { PORTFOLIO_USER } from '../../data/portfolioData';
import { Lock, Power, Sun } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/dateTime';
import { usePublishedProfile } from '../../hooks/usePublishedProfile';

export const SleepScreen: React.FC = () => {
  const { setPowerState, settings } = useOS();
  const { user } = useAuth();
  const { profile } = usePublishedProfile();
  const [time, setTime] = useState(new Date());

  const currentUser = useMemo(() => {
    let customProfile: any = null;
    try {
      const raw = localStorage.getItem('win11_custom_about_profile');
      if (raw) customProfile = JSON.parse(raw);
    } catch {}
    return {
      name: user?.name || customProfile?.name || PORTFOLIO_USER.name,
      avatar: profile.avatar || '/avatar.png',
    };
  }, [user?.name, profile.avatar]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleWake = () => {
    setPowerState('normal');
  };

  useEffect(() => {
    const handleKeyDown = () => handleWake();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formattedTime = formatTime(time, { hour: '2-digit', minute: '2-digit' }, settings.timeZone);
  const formattedDate = formatDate(time, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }, settings.timeZone);

  return (
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-3xl text-white flex flex-col justify-between p-8 md:p-16 select-none cursor-pointer animate-in fade-in duration-300"
      onClick={handleWake}
      title="Click anywhere or press any key to wake up"
    >
      {/* Top Left: Clock & Date */}
      <div className="space-y-1 animate-in slide-in-from-top-4 duration-500">
        <div className="text-6xl md:text-8xl font-light tracking-tight text-white/95 font-sans">
          {formattedTime}
        </div>
        <div className="text-lg md:text-xl text-slate-300 font-medium pl-1">
          {formattedDate}
        </div>
      </div>

      {/* Center: User Profile & Status */}
      <div className="self-center flex flex-col items-center space-y-4">
        <div className="relative">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/avatar.png';
            }}
            className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover ring-4 ring-white/20 shadow-2xl"
          />
          <div className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white ring-2 ring-slate-900 shadow-md">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
            {currentUser.name}
          </h2>
          <p className="text-xs md:text-sm text-slate-400">
            System In Sleep Mode
          </p>
        </div>

        <button
          className="mt-4 flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-medium text-xs backdrop-blur-md ring-1 ring-white/20 transition-all transform hover:scale-105 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleWake();
          }}
        >
          <Sun className="w-4 h-4 text-amber-400" />
          <span>Click to Wake Up</span>
        </button>
      </div>

      {/* Bottom Hint Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-sans border-t border-white/10 pt-4">
        <div className="flex items-center gap-2">
          <Power className="w-3.5 h-3.5 text-blue-400" />
          <span>Windows 11 Portfolio Sleep Screen</span>
        </div>
        <div className="hidden sm:block text-slate-400/80">
          Press any key or click anywhere to resume your session
        </div>
      </div>
    </div>
  );
};
