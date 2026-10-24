import { DEFAULT_TIME_ZONE, getZonedDateParts } from './dateTime';

export interface DailyForecast {
  date: string;
  dayName: string;
  tempMaxC: number;
  tempMinC: number;
  tempMaxF: number;
  tempMinF: number;
  condition: string;
  icon: string;
}

export interface WeatherData {
  city: string;
  country?: string;
  tempC: number;
  tempF: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  uvIndex?: number;
  feelsLikeC?: number;
  feelsLikeF?: number;
  isLive: boolean;
  lastUpdated: number;
  forecast?: DailyForecast[];
}

export interface CitySearchResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

// Map Open-Meteo weathercode to condition text and emoji icon
export function getWeatherCondition(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Clear Sky', icon: '☀️' };
  if (code === 1 || code === 2) return { condition: 'Mainly Clear', icon: '🌤️' };
  if (code === 3) return { condition: 'Overcast', icon: '☁️' };
  if (code >= 45 && code <= 48) return { condition: 'Fog & Mist', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { condition: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { condition: 'Rain', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { condition: 'Snowfall', icon: '❄️' };
  if (code >= 80 && code <= 82) return { condition: 'Rain Showers', icon: '🌧️' };
  if (code >= 95 && code <= 99) return { condition: 'Thunderstorm', icon: '⛈️' };
  return { condition: 'Clear Sky', icon: '☀️' };
}

export const DEFAULT_AHMEDABAD_WEATHER: WeatherData = {
  city: 'Ahmedabad',
  country: 'India',
  tempC: 32,
  tempF: 90,
  feelsLikeC: 34,
  feelsLikeF: 93,
  condition: 'Sunny & Clear',
  icon: '☀️',
  humidity: 48,
  windSpeed: 14,
  uvIndex: 7,
  isLive: false,
  lastUpdated: Date.now(),
  forecast: [
    { date: '2026-08-16', dayName: 'Today', tempMaxC: 34, tempMinC: 26, tempMaxF: 93, tempMinF: 79, condition: 'Sunny', icon: '☀️' },
    { date: '2026-08-17', dayName: 'Mon', tempMaxC: 33, tempMinC: 25, tempMaxF: 91, tempMinF: 77, condition: 'Partly Cloudy', icon: '⛅' },
    { date: '2026-08-18', dayName: 'Tue', tempMaxC: 32, tempMinC: 25, tempMaxF: 90, tempMinF: 77, condition: 'Rain Shower', icon: '🌦️' },
    { date: '2026-08-19', dayName: 'Wed', tempMaxC: 31, tempMinC: 24, tempMaxF: 88, tempMinF: 75, condition: 'Thunderstorm', icon: '⛈️' },
    { date: '2026-08-20', dayName: 'Thu', tempMaxC: 33, tempMinC: 25, tempMaxF: 91, tempMinF: 77, condition: 'Clear', icon: '☀️' },
  ],
};

const CACHE_KEY = 'win11_weather_cached_data_v2';
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Search cities using Open-Meteo Geocoding API (Restricted/prioritized to India)
 */
export async function searchCities(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=10&language=en&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        const indianResults = data.results.filter((r: any) => (r.country || '').toLowerCase().includes('india'));
        const listToUse = indianResults.length > 0 ? indianResults : data.results.filter((r: any) => (r.country || '').toLowerCase().includes('india'));
        return listToUse.map((r: any) => ({
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          country: r.country || 'India',
          admin1: r.admin1 || '',
        }));
      }
    }
  } catch (e) {
    console.warn('[Weather] City search error:', e);
  }
  return [];
}

/**
 * Main Weather Fetch Function with Caching, Geolocation & 5-Day Forecast
 */
export async function fetchLiveWeather(
  options: {
    requestGps?: boolean;
    forceRefresh?: boolean;
    customLat?: number;
    customLon?: number;
    customCity?: string;
  } = {}
): Promise<WeatherData> {
  const { requestGps = false, forceRefresh = false, customLat, customLon, customCity } = options;

  // Check cached data
  if (!forceRefresh && !customLat) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: WeatherData = JSON.parse(raw);
        if (cached && Date.now() - cached.lastUpdated < CACHE_TTL_MS) {
          return cached;
        }
      }
    } catch {}
  }

  let lat = customLat ?? 23.0225; // Default Ahmedabad
  let lon = customLon ?? 72.5714;
  let cityName = customCity ?? 'Ahmedabad';
  let countryName = 'India';

  if (!customLat) {
    // 1. Browser HTML5 GPS if requested
    if (requestGps && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            cityName = 'Current Location';
            try {
              localStorage.setItem('win11_weather_coords', JSON.stringify({ lat, lon }));
              localStorage.setItem('win11_weather_city', cityName);
            } catch {}
            resolve();
          },
          () => resolve(),
          { timeout: 5000, maximumAge: 300000 }
        );
      });
    } else {
      // 2. Saved manual coordinates
      try {
        const savedCoords = localStorage.getItem('win11_weather_coords');
        const savedCity = localStorage.getItem('win11_weather_city');
        if (savedCoords) {
          const parsed = JSON.parse(savedCoords);
          if (parsed.lat && parsed.lon) {
            lat = parsed.lat;
            lon = parsed.lon;
            if (savedCity) cityName = savedCity;
          }
        }
      } catch {}
    }
  }

  // 3. Query Open-Meteo for Current + Daily 5-Day Forecast
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m,apparent_temperature,uv_index&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

    const data = await res.json();
    if (data && data.current_weather) {
      const cw = data.current_weather;
      const tempC = Math.round(cw.temperature);
      const tempF = Math.round((tempC * 9) / 5 + 32);
      const cond = getWeatherCondition(cw.weathercode);

      // Humidity & UV index
      const hourIndex = getZonedDateParts(new Date(), DEFAULT_TIME_ZONE).hour;
      const humidity = data.hourly?.relative_humidity_2m?.[hourIndex] ?? 52;
      const feelsLikeC = Math.round(data.hourly?.apparent_temperature?.[hourIndex] ?? tempC);
      const feelsLikeF = Math.round((feelsLikeC * 9) / 5 + 32);
      const uvIndex = Math.round(data.hourly?.uv_index?.[hourIndex] ?? 5);

      // Build 5-day daily forecast
      const forecast: DailyForecast[] = [];
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (data.daily?.time && Array.isArray(data.daily.time)) {
        for (let i = 0; i < Math.min(5, data.daily.time.length); i++) {
          const dStr = data.daily.time[i];
          const dObj = new Date(`${dStr}T00:00:00Z`);
          const maxC = Math.round(data.daily.temperature_2m_max[i]);
          const minC = Math.round(data.daily.temperature_2m_min[i]);
          const dCond = getWeatherCondition(data.daily.weathercode[i]);
          forecast.push({
            date: dStr,
            dayName: i === 0 ? 'Today' : days[dObj.getUTCDay()],
            tempMaxC: maxC,
            tempMinC: minC,
            tempMaxF: Math.round((maxC * 9) / 5 + 32),
            tempMinF: Math.round((minC * 9) / 5 + 32),
            condition: dCond.condition,
            icon: dCond.icon,
          });
        }
      }

      const weatherResult: WeatherData = {
        city: cityName,
        country: countryName,
        tempC,
        tempF,
        feelsLikeC,
        feelsLikeF,
        condition: cond.condition,
        icon: cond.icon,
        humidity,
        windSpeed: Math.round(cw.windspeed || 12),
        uvIndex,
        isLive: true,
        lastUpdated: Date.now(),
        forecast,
      };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(weatherResult));
      } catch {}

      return weatherResult;
    }
  } catch (err) {
    console.warn('[Weather] API fetch failed, falling back to default:', err);
  }

  return DEFAULT_AHMEDABAD_WEATHER;
}
