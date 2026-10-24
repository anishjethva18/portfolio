import React, { useState, useEffect, useRef } from 'react';
import { useOS } from '../../context/OSContext';
import { PORTFOLIO_USER } from '../../data/portfolioData';
import { WeatherData, DEFAULT_AHMEDABAD_WEATHER, fetchLiveWeather, searchCities, CitySearchResult } from '../../utils/weather';
import {
  Compass,
  Search,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  X,
  Sparkles,
  Award,
  Briefcase,
  CheckCircle2,
  Bookmark,
} from 'lucide-react';
import { haptics } from '../../utils/haptics';

export const WidgetsBoard: React.FC = () => {
  const { isWidgetsOpen, closeWidgets, openApp, addNotification } = useOS();
  const [weather, setWeather] = useState<WeatherData>(DEFAULT_AHMEDABAD_WEATHER);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [searchCityQuery, setSearchCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CitySearchResult[]>([]);
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [quickNote, setQuickNote] = useState('Build transformative agentic software.');
  const [isSavedNote, setIsSavedNote] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Load weather on mount
  useEffect(() => {
    let isMounted = true;
    const loadWeather = async () => {
      setIsLoadingWeather(true);
      try {
        const data = await fetchLiveWeather();
        if (isMounted) {
          setWeather(data);
        }
      } catch {
        if (isMounted) {
          setWeather(DEFAULT_AHMEDABAD_WEATHER);
        }
      } finally {
        if (isMounted) setIsLoadingWeather(false);
      }
    };
    loadWeather();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isWidgetsOpen && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        const taskbarWeather = document.getElementById('taskbar-weather-pill');
        if (taskbarWeather && taskbarWeather.contains(e.target as Node)) {
          return;
        }
        closeWidgets();
      }
    };
    if (isWidgetsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isWidgetsOpen, closeWidgets]);

  if (!isWidgetsOpen) return null;

  const handleCitySelect = async (city: CitySearchResult) => {
    setShowCitySearch(false);
    setSearchCityQuery('');
    setSearchResults([]);
    setIsLoadingWeather(true);
    try {
      const data = await fetchLiveWeather({
        customLat: city.latitude,
        customLon: city.longitude,
        customCity: city.name,
      });
      setWeather(data);
      addNotification({
        title: 'Weather Location Changed',
        message: `Now showing weather for ${city.name} (${data.tempC}°C)`,
        type: 'success',
      });
    } catch {
      // Fallback
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleCitySearch = async (val: string) => {
    setSearchCityQuery(val);
    if (val.trim().length >= 2) {
      const results = await searchCities(val);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const stocks = [
    { symbol: 'NVDA', name: 'NVIDIA Corp', price: '$128.40', change: '+3.42%', isUp: true },
    { symbol: 'GOOGL', name: 'Alphabet Inc', price: '$178.10', change: '+1.85%', isUp: true },
    { symbol: 'MSFT', name: 'Microsoft', price: '$448.20', change: '-0.42%', isUp: false },
    { symbol: 'BTC', name: 'Bitcoin', price: '$64,280', change: '+2.14%', isUp: true },
  ];

  return (
    <div
      ref={drawerRef}
      className="fixed left-2 right-2 w-auto sm:w-[680px] md:w-[740px] sm:left-3 sm:right-auto sm:mx-0 top-[calc(40px+env(safe-area-inset-top,0px))] sm:top-auto bottom-[calc(56px+env(safe-area-inset-bottom,0px))] sm:bottom-16 sm:max-h-[85vh] bg-[#1a1a1e]/95 dark:bg-[#121216]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl z-[990] flex flex-col overflow-hidden text-slate-100 animate-in slide-in-from-bottom-6 sm:slide-in-from-left-6 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-xs text-white shadow">
            AJ
          </div>
          <div>
            <div className="font-bold text-xs text-white flex items-center gap-2">
              <span>Widgets Board</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 font-semibold">
                Windows 11
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              {PORTFOLIO_USER.name} • {weather.city}, {weather.country || 'India'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={async () => {
              setIsLoadingWeather(true);
              const data = await fetchLiveWeather({ forceRefresh: true });
              setWeather(data);
              setIsLoadingWeather(false);
              haptics.light();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Weather & Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={closeWidgets}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close Widgets (Win+W)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Widgets Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Row 1: Weather Widget & Portfolio Spotlight Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weather Widget */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900/40 via-slate-900/70 to-cyan-950/40 border border-cyan-500/30 flex flex-col justify-between relative overflow-hidden shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{weather.icon || '☀️'}</span>
                  <div>
                    <div className="text-2xl font-bold text-white tracking-tight">{weather.tempC}°C</div>
                    <div className="text-[11px] text-cyan-200 font-medium">{weather.condition}</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-2">
                  <span>{weather.city}, {weather.country || 'India'}</span>
                  <span>•</span>
                  <span>Feels like {weather.feelsLikeC ?? weather.tempC}°C</span>
                </div>
              </div>

              <button
                onClick={() => setShowCitySearch(!showCitySearch)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Change Location"
              >
                <Compass className="w-3 h-3 text-cyan-400" />
                <span>{showCitySearch ? 'Cancel' : 'Change City'}</span>
              </button>
            </div>

            {/* City Search Overlay */}
            {showCitySearch && (
              <div className="mt-3 p-2 bg-black/80 rounded-xl border border-cyan-500/40 space-y-2 animate-in fade-in">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search city (e.g. London, Mumbai, New York)..."
                    value={searchCityQuery}
                    onChange={(e) => handleCitySearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white/10 text-xs text-white rounded-lg outline-none focus:ring-1 focus:ring-cyan-400 placeholder-slate-400"
                    autoFocus
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleCitySelect(r)}
                        className="w-full text-left px-2.5 py-1 text-xs text-slate-200 hover:bg-cyan-500/20 rounded flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-[10px] text-slate-400">{r.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4-Day Mini Forecast */}
            {weather.forecast && weather.forecast.length > 0 && (
              <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-white/10 text-center">
                {weather.forecast.slice(0, 4).map((f, i) => (
                  <div key={i} className="p-1.5 rounded-lg bg-black/20 text-xs">
                    <div className="text-[10px] text-slate-400">{f.dayName}</div>
                    <div className="text-base my-0.5">{f.icon}</div>
                    <div className="text-[11px] font-bold text-white">{f.tempMaxC}°</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Portfolio Spotlight Card */}
          <div className="p-4 rounded-2xl bg-[#202025] border border-white/10 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs text-white">Portfolio Highlights</span>
              </div>
              <button
                onClick={() => openApp('about')}
                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>About Developer</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
              <div className="text-xs font-bold text-white">{PORTFOLIO_USER.name}</div>
              <div className="text-[11px] text-cyan-300 font-mono">{PORTFOLIO_USER.title}</div>
              <div className="text-[10px] text-slate-400 line-clamp-2 mt-1">{PORTFOLIO_USER.tagline}</div>
            </div>

            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
              <button
                onClick={() => openApp('projects')}
                className="flex-1 py-1.5 px-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Featured Projects</span>
              </button>
              <button
                onClick={() => openApp('resume')}
                className="flex-1 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">View Resume</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Tech Market Watch & Quick Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tech Market Watch */}
          <div className="p-4 rounded-2xl bg-[#202025] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white">Tech & Crypto Watch</span>
              </div>
              <span className="text-[10px] text-slate-500">Live Simulation</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {stocks.map((s) => (
                <div key={s.symbol} className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">{s.symbol}</span>
                    <span
                      className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                        s.isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {s.change}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{s.name}</div>
                  <div className="text-xs font-semibold text-slate-200 mt-1">{s.price}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Scratchpad / Goals */}
          <div className="p-4 rounded-2xl bg-[#202025] border border-white/10 space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-xs text-white">Daily Focus & Quick Notes</span>
              </div>
              {isSavedNote && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Saved</span>
                </span>
              )}
            </div>

            <textarea
              value={quickNote}
              onChange={(e) => {
                setQuickNote(e.target.value);
                setIsSavedNote(true);
                setTimeout(() => setIsSavedNote(false), 1500);
              }}
              rows={3}
              className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none font-sans"
              placeholder="Jot down quick thoughts or ideas..."
            />

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Goal: Transformative software</span>
              <button
                onClick={() => openApp('notepad', { fileContent: quickNote })}
                className="text-cyan-400 hover:underline text-[10px] cursor-pointer"
              >
                Open in Notepad
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
