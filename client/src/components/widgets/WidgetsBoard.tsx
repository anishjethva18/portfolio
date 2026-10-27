import React, { useState, useEffect, useRef } from 'react';
import { useOS } from '../../context/OSContext';
import { PORTFOLIO_USER } from '../../data/portfolioData';
import { WeatherData, fetchLiveWeather, searchCities, CitySearchResult } from '../../utils/weather';
import { readJsonResponse } from '../../utils/readJsonResponse';
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

interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

interface MarketData {
  quotes: MarketQuote[];
  warnings: string[];
}

const formatMarketPrice = (price: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: price < 1 ? 4 : 2 }).format(price);

async function fetchMarketQuotes(): Promise<MarketData> {
  const [stockResult, cryptoResult] = await Promise.allSettled([
    fetch('/api/widgets/market', { cache: 'no-store' }).then(async (response) => {
      const payload = await readJsonResponse<Record<string, any>>(response, 'Stock quote service');
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.quotes)) {
        const message = payload?.error === 'NotFound'
          ? 'Widget APIs are missing from the running server; restart it with the latest code.'
          : payload?.error || `Live stock quotes are unavailable (HTTP ${response.status}).`;
        throw new Error(message);
      }
      const quotes = payload.quotes.filter((quote: any) =>
        typeof quote?.symbol === 'string' &&
        typeof quote?.name === 'string' &&
        Number.isFinite(quote?.price) &&
        Number.isFinite(quote?.changePercent)
      );
      return {
        quotes: quotes as MarketQuote[],
        warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((warning: unknown) => typeof warning === 'string') : [],
      };
    }),
    fetch('/api/widgets/crypto', { cache: 'no-store' }).then(async (response) => {
      const payload = await readJsonResponse<Record<string, any>>(response, 'Crypto quote service');
      if (!response.ok || payload?.success !== true) {
        const message = payload?.error === 'NotFound'
          ? 'Widget APIs are missing from the running server; restart it with the latest code.'
          : payload?.error || `Live crypto quotes are unavailable (HTTP ${response.status}).`;
        throw new Error(message);
      }
      if (!Array.isArray(payload.data)) throw new Error('CoinGecko returned an invalid market response.');
      return payload.data;
    }),
  ]);

  const quotes: MarketQuote[] = [];
  const warnings: string[] = [];
  if (stockResult.status === 'fulfilled') {
    quotes.push(...stockResult.value.quotes);
    warnings.push(...stockResult.value.warnings);
  } else {
    console.warn('[WidgetsBoard] Live stock quote service failed.', stockResult.reason);
    warnings.push(stockResult.reason instanceof Error ? stockResult.reason.message : 'Stock quotes are unavailable.');
  }

  if (cryptoResult.status === 'fulfilled') {
    for (const coin of cryptoResult.value) {
      if (
        typeof coin?.symbol === 'string' &&
        typeof coin?.name === 'string' &&
        Number.isFinite(coin?.current_price) &&
        Number.isFinite(coin?.price_change_percentage_24h)
      ) {
        quotes.push({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price,
          changePercent: coin.price_change_percentage_24h,
        });
      }
    }
  } else {
    console.warn('[WidgetsBoard] Live crypto quote service failed.', cryptoResult.reason);
    warnings.push(cryptoResult.reason instanceof Error ? cryptoResult.reason.message : 'Crypto quotes are unavailable.');
  }

  if (!quotes.length) {
    throw new Error('Live stock and crypto data is temporarily unavailable.');
  }
  return {
    quotes,
    warnings,
  };
}

export const WidgetsBoard: React.FC = () => {
  const { isWidgetsOpen, closeWidgets, openApp, addNotification, settings } = useOS();
  const isLight = settings.theme !== 'dark';
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [marketQuotes, setMarketQuotes] = useState<MarketQuote[]>([]);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [searchCityQuery, setSearchCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CitySearchResult[]>([]);
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [quickNote, setQuickNote] = useState('Build transformative agentic software.');
  const [isSavedNote, setIsSavedNote] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const refreshWeather = async (
    { requestLocation = false, forceRefresh = requestLocation }: {
      requestLocation?: boolean;
      forceRefresh?: boolean;
    } = {}
  ) => {
    setIsLoadingWeather(true);
    try {
      const data = await fetchLiveWeather({ requestGps: requestLocation, forceRefresh });
      setWeather(data);
      setWeatherError(null);
    } catch (error) {
      console.warn('[WidgetsBoard] Weather could not be refreshed.', error);
      setWeatherError('Weather data is temporarily unavailable. Refresh to try again.');
      setWeather((current) => current ? { ...current, isLive: false } : null);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const refreshMarket = async () => {
    setIsLoadingMarket(true);
    try {
      const data = await fetchMarketQuotes();
      setMarketQuotes(data.quotes);
      setMarketError(data.warnings.join(' '));
    } catch (error) {
      console.warn('[WidgetsBoard] Market data could not be refreshed.', error);
      setMarketError('Live market data is temporarily unavailable. Refresh to try again.');
    } finally {
      setIsLoadingMarket(false);
    }
  };

  useEffect(() => {
    if (!isWidgetsOpen) return;
    void refreshWeather();
    void refreshMarket();
    const intervalId = window.setInterval(() => {
      void refreshWeather({ forceRefresh: true });
      void refreshMarket();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [isWidgetsOpen]);

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
        customCountry: city.country,
      });
      setWeather(data);
      setWeatherError(null);
      try {
        localStorage.setItem('win11_weather_coords', JSON.stringify({ lat: city.latitude, lon: city.longitude }));
        localStorage.setItem('win11_weather_city', city.name);
        localStorage.setItem('win11_weather_location_mode', 'city');
      } catch (error) {
        console.warn('[WidgetsBoard] Selected city could not be stored locally.', error);
      }
      addNotification({
        title: 'Weather Location Changed',
        message: `Now showing weather for ${city.name} (${data.tempC}°C)`,
        type: 'success',
      });
    } catch (error) {
      console.warn('[WidgetsBoard] Selected city weather could not be loaded.', error);
      setWeatherError('Weather for this city is temporarily unavailable. Try again later.');
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

  return (
    <div
      ref={drawerRef}
      className={`widgets-board fixed left-2 right-2 w-auto sm:w-[680px] md:w-[740px] sm:left-3 sm:right-auto sm:mx-0 top-[calc(40px+env(safe-area-inset-top,0px))] sm:top-auto bottom-[calc(56px+env(safe-area-inset-bottom,0px))] sm:bottom-16 sm:max-h-[85vh] backdrop-blur-2xl border rounded-2xl shadow-2xl z-[990] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-left-6 duration-200 ${isLight ? 'widgets-board-light bg-slate-100/95 text-slate-900 border-slate-300' : 'bg-[#1a1a1e]/95 dark:bg-[#121216]/95 border-white/15 text-slate-100'}`}
    >
      {/* Header */}
      <div className={`widgets-board-header flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${isLight ? 'border-slate-200 bg-white/80' : 'border-white/10 bg-white/5'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-xs text-white shadow">
            AJ
          </div>
          <div>
            <div className={`font-bold text-xs flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span>Widgets Board</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 font-semibold">
                Windows 11
              </span>
            </div>
            <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {PORTFOLIO_USER.name} • {weather ? `${weather.city}${weather.country ? `, ${weather.country}` : ''}` : 'Weather unavailable'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={async () => {
              await Promise.all([refreshWeather({ requestLocation: true }), refreshMarket()]);
              haptics.light();
            }}
            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            title="Refresh live weather and market data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather || isLoadingMarket ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={closeWidgets}
            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
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
              {weather ? <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{weather.icon || '☀️'}</span>
                  <div>
                    <div className="text-2xl font-bold text-white tracking-tight">{weather.tempC}°C</div>
                    <div className="text-[11px] text-cyan-200 font-medium">{weather.condition}</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-2">
                  <span>{weather.city}{weather.country ? `, ${weather.country}` : ''}</span>
                  <span>•</span>
                  <span>Feels like {weather.feelsLikeC !== undefined ? `${weather.feelsLikeC}°C` : '—'}</span>
                  <span>•</span>
                  <span>{weather.isLive ? 'Live' : 'Cached'}</span>
                </div>
              </div> : (
                <div role={weatherError ? 'alert' : 'status'} className="text-sm font-semibold text-white">
                  {weatherError ? 'Live weather is unavailable' : 'Loading local weather…'}
                  {weatherError && <p className="mt-1 text-[10px] font-normal text-slate-300">{weatherError}</p>}
                </div>
              )}

              <button
                onClick={() => setShowCitySearch(!showCitySearch)}
                className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  isLight ? 'border-white/30 bg-slate-950/70 text-white hover:bg-slate-900' : 'border-white/10 bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
                title="Change Location"
              >
                <Compass className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-200' : 'text-cyan-400'}`} />
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
            {weather?.forecast && weather.forecast.length > 0 && (
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
            {weatherError && weather && <p role="status" className="mt-2 text-[10px] text-amber-200">{weatherError}</p>}
          </div>

          {/* Portfolio Spotlight Card */}
          <div className={`widgets-board-card p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${isLight ? 'border-slate-200 bg-white' : 'bg-[#202025] border-white/10'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Portfolio Highlights</span>
              </div>
              <button
                onClick={() => openApp('about')}
                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>About Developer</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className={`widgets-board-inset p-3 rounded-xl border space-y-1 ${isLight ? 'border-slate-200 bg-slate-50' : 'bg-black/30 border-white/5'}`}>
              <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{PORTFOLIO_USER.name}</div>
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
          <div className={`widgets-board-card p-4 rounded-2xl border space-y-3 ${isLight ? 'border-slate-200 bg-white' : 'bg-[#202025] border-white/10'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Tech & Crypto Watch</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {isLoadingMarket ? 'Updating…' : marketQuotes.length ? 'Live public feeds · 1 min' : 'Live data unavailable'}
              </span>
            </div>

            {marketError && marketQuotes.length > 0 && <p role="status" className="text-[10px] text-amber-600 dark:text-amber-300">{marketError}</p>}
            {marketQuotes.length ? <div className="grid grid-cols-2 gap-2">
              {marketQuotes.map((quote) => (
                <div key={quote.symbol} className={`widgets-board-inset p-2.5 rounded-xl border flex flex-col justify-between ${isLight ? 'border-slate-200 bg-slate-50' : 'bg-black/30 border-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>{quote.symbol}</span>
                    <span
                      className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                        quote.changePercent >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{quote.name}</div>
                  <div className={`text-xs font-semibold mt-1 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{formatMarketPrice(quote.price)}</div>
                </div>
              ))}
            </div> : (
              <p role={marketError ? 'alert' : 'status'} className={`py-4 text-center text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {marketError || 'Loading live stock and crypto quotes…'}
              </p>
            )}
          </div>

          {/* Quick Scratchpad / Goals */}
          <div className={`widgets-board-card p-4 rounded-2xl border space-y-2 flex flex-col justify-between ${isLight ? 'border-slate-200 bg-white' : 'bg-[#202025] border-white/10'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-cyan-400" />
                <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Daily Focus & Quick Notes</span>
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
              className={`w-full p-2.5 rounded-xl border text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none font-sans ${isLight ? 'widgets-board-note bg-slate-50 border-slate-200 text-slate-800' : 'bg-black/40 border-white/10 text-slate-200'}`}
              placeholder="Jot down quick thoughts or ideas..."
            />

            <div className={`flex items-center justify-between text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
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
