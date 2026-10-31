import { DEFAULT_TIME_ZONE, getZonedDateParts } from './dateTime';
import { readJsonResponse } from './readJsonResponse';

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
  humidity?: number;
  windSpeed?: number;
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
  return { condition: 'Conditions unavailable', icon: '🌡️' };
}

const CACHE_KEY = 'win11_weather_cached_data_v2';
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

function isWeatherData(value: unknown): value is WeatherData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<WeatherData>;
  return typeof data.city === 'string' &&
    typeof data.tempC === 'number' &&
    typeof data.tempF === 'number' &&
    typeof data.condition === 'string' &&
    typeof data.icon === 'string' &&
    typeof data.humidity === 'number' &&
    typeof data.windSpeed === 'number' &&
    typeof data.isLive === 'boolean' &&
    typeof data.lastUpdated === 'number';
}

/**
 * Search cities using Open-Meteo's global geocoding API.
 */
export async function searchCities(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `/api/widgets/geocoding/search?name=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    const payload = await readJsonResponse<Record<string, any>>(res, 'City search service');
    if (!res.ok || payload?.success !== true) {
      throw new Error(payload?.error || `City search failed (HTTP ${res.status}).`);
    }
    const data = payload.data;
    if (data && Array.isArray(data.results)) {
      return data.results.map((r: any) => ({
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          country: r.country || '',
          admin1: r.admin1 || '',
        }));
    }
    throw new Error('City search returned an invalid response.');
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
    customCountry?: string;
  } = {}
): Promise<WeatherData> {
  const { requestGps = false, forceRefresh = false, customLat, customLon, customCity, customCountry } = options;

  // Check cached data
  let cachedWeather: WeatherData | null = null;
  let savedLocationMode: string | null = null;
  try {
    savedLocationMode = localStorage.getItem('win11_weather_location_mode');
  } catch (error) {
    console.warn('[Weather] Saved location preference could not be read.', error);
  }
  if (!forceRefresh && !requestGps && customLat === undefined) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: unknown = JSON.parse(raw);
        if (isWeatherData(cached)) {
          const hasSavedLocation = savedLocationMode === 'gps' || savedLocationMode === 'city';
          const isDefaultCityCache = !savedLocationMode && cached.city.toLowerCase() === 'ahmedabad';
          if (hasSavedLocation || isDefaultCityCache) {
            cachedWeather = cached;
            if (Date.now() - cachedWeather.lastUpdated < CACHE_TTL_MS) {
              return { ...cachedWeather, isLive: false };
            }
          }
        }
      }
    } catch (error) {
      console.warn('[Weather] Cached weather could not be read.', error);
    }
  }

  let lat = customLat ?? 23.0225; // Default Ahmedabad
  let lon = customLon ?? 72.5714;
  let cityName = customCity ?? 'Ahmedabad';
  let countryName = customCountry ?? '';

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
              localStorage.setItem('win11_weather_location_mode', 'gps');
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
        if ((savedLocationMode === 'gps' || savedLocationMode === 'city') && savedCoords) {
          const parsed = JSON.parse(savedCoords);
          if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
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
    if (!customCity && cityName === 'Current Location') {
      try {
        const reverseUrl = `/api/widgets/geocoding/reverse?latitude=${lat}&longitude=${lon}`;
        const reverseResponse = await fetch(reverseUrl);
        const reversePayload = await readJsonResponse<Record<string, any>>(reverseResponse, 'Location service');
        if (reverseResponse.ok && reversePayload?.success === true) {
          const place = reversePayload?.data?.results?.[0];
          if (place?.name) cityName = place.name;
          if (place?.country) countryName = place.country;
        } else throw new Error(reversePayload?.error || `Reverse geocoding failed (HTTP ${reverseResponse.status}).`);
      } catch (error) {
        console.warn('[Weather] Reverse geocoding failed; showing the GPS coordinates as current location.', error);
      }
    }

    const url = `/api/widgets/weather?latitude=${lat}&longitude=${lon}`;
    const res = await fetch(url);
    const payload = await readJsonResponse<Record<string, any>>(res, 'Weather service');
    if (!res.ok || payload?.success !== true) {
      const message = payload?.error === 'NotFound'
        ? 'Weather API is missing from the running server; restart it with the latest code.'
        : payload?.error || `Live weather request failed (HTTP ${res.status}).`;
      throw new Error(message);
    }

    const data = payload.data;
    if (data && data.current_weather) {
      const cw = data.current_weather;
      if (!Number.isFinite(cw.temperature) || !Number.isFinite(cw.weathercode)) {
        throw new Error('Open-Meteo returned invalid current weather values.');
      }
      const tempC = Math.round(cw.temperature);
      const tempF = Math.round((tempC * 9) / 5 + 32);
      const cond = getWeatherCondition(cw.weathercode);

      // Humidity & UV index
      const currentHour = data.hourly?.time?.findIndex((time: string) => time === cw.time);
      const hourIndex = currentHour >= 0
        ? currentHour
        : getZonedDateParts(new Date(), DEFAULT_TIME_ZONE).hour;
      const humidityValue = data.hourly?.relative_humidity_2m?.[hourIndex];
      const apparentTemperature = data.hourly?.apparent_temperature?.[hourIndex];
      const uvValue = data.hourly?.uv_index?.[hourIndex];
      const feelsLikeC = Number.isFinite(apparentTemperature) ? Math.round(apparentTemperature) : undefined;
      const feelsLikeF = feelsLikeC === undefined ? undefined : Math.round((feelsLikeC * 9) / 5 + 32);
      const humidity = Number.isFinite(humidityValue) ? humidityValue : undefined;
      const uvIndex = Number.isFinite(uvValue) ? Math.round(uvValue) : undefined;

      // Build 5-day daily forecast
      const forecast: DailyForecast[] = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (data.daily?.time && Array.isArray(data.daily.time)) {
        for (let i = 0; i < Math.min(5, data.daily.time.length); i++) {
          const dStr = data.daily.time[i];
          const dObj = new Date(`${dStr}T00:00:00Z`);
          const maximum = data.daily.temperature_2m_max?.[i];
          const minimum = data.daily.temperature_2m_min?.[i];
          const weatherCode = data.daily.weathercode?.[i];
          if (!Number.isFinite(maximum) || !Number.isFinite(minimum) || !Number.isFinite(weatherCode)) continue;
          const maxC = Math.round(maximum);
          const minC = Math.round(minimum);
          const dCond = getWeatherCondition(weatherCode);
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
        country: countryName || undefined,
        tempC,
        tempF,
        feelsLikeC,
        feelsLikeF,
        condition: cond.condition,
        icon: cond.icon,
        humidity,
        windSpeed: Number.isFinite(cw.windspeed) ? Math.round(cw.windspeed) : undefined,
        uvIndex,
        isLive: payload.stale !== true,
        lastUpdated: typeof payload.updatedAt === 'string' && Number.isFinite(Date.parse(payload.updatedAt))
          ? Date.parse(payload.updatedAt)
          : Date.now(),
        forecast,
      };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(weatherResult));
      } catch {}

      return weatherResult;
    }
    throw new Error('Open-Meteo did not return current conditions for this location.');
  } catch (err) {
    console.warn('[Weather] Live weather request failed.', err);
    if (cachedWeather) return { ...cachedWeather, isLive: false };
    throw err;
  }
}
