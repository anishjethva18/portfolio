import { Router, Response } from 'express';
import { createRateLimiter } from '../middleware/security';

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

interface StockQuoteResponse {
  quotes: StockQuote[];
  warnings: string[];
  updatedAt: string;
  stale?: boolean;
}

const STOCK_SYMBOLS = ['NVDA', 'GOOGL', 'MSFT'] as const;
const CACHE_TTL_MS = 60_000;
const WEATHER_CACHE_TTL_MS = 60_000;
const WEATHER_STALE_TTL_MS = 2 * 60 * 60_000;
const WEATHER_RETRY_DELAY_MS = 60_000;
const WTTR_WEATHER_CODES: Record<number, number> = {
  113: 0,
  116: 2,
  119: 3,
  122: 3,
  143: 45,
  176: 61,
  179: 71,
  182: 66,
  185: 66,
  200: 95,
  227: 71,
  230: 75,
  248: 45,
  260: 45,
  263: 51,
  266: 51,
  281: 66,
  284: 66,
  293: 61,
  296: 61,
  299: 63,
  302: 63,
  305: 65,
  308: 65,
  311: 66,
  314: 66,
  317: 66,
  320: 66,
  323: 71,
  326: 71,
  329: 73,
  332: 73,
  335: 75,
  338: 75,
  350: 77,
  353: 80,
  356: 81,
  359: 82,
  362: 66,
  365: 66,
  368: 85,
  371: 86,
  374: 77,
  377: 77,
  386: 95,
  389: 96,
  392: 95,
  395: 99,
};
const quoteLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60_000,
  message: 'Live market data refresh limit reached.',
});
const weatherLimiter = createRateLimiter({
  maxRequests: 90,
  windowMs: 60_000,
  message: 'Weather refresh limit reached.',
});
const geocodingLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60_000,
  message: 'Location search limit reached.',
});

export const widgetsRouter = Router();

let cachedQuotes: StockQuoteResponse | null = null;
let cacheExpiresAt = 0;
const upstreamCache = new Map<string, { value: unknown; expiresAt: number }>();
const weatherCache = new Map<string, {
  value: unknown;
  fetchedAt: number;
  expiresAt: number;
  staleUntil: number;
  retryAfter: number;
}>();
const weatherRequests = new Map<string, Promise<{
  value: unknown;
  stale: boolean;
  fetchedAt: number;
}>>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function summarizeProviderError(error: unknown): string {
  const cause = error instanceof Error ? asRecord(error.cause) : null;
  const code = typeof cause?.code === 'string' ? cause.code : undefined;
  if (error instanceof Error) return code ? `${error.message} (${code})` : error.message;
  return String(error);
}

function normalizeWttrWeather(payload: unknown): unknown {
  const root = asRecord(payload);
  const current = Array.isArray(root?.current_condition) ? asRecord(root.current_condition[0]) : null;
  const currentTemperature = finiteNumber(current?.temp_C);
  const currentCode = finiteNumber(current?.weatherCode);
  const currentTime = new Date().toISOString().slice(0, 16);
  if (currentTemperature === undefined || currentCode === undefined || !(currentCode in WTTR_WEATHER_CODES)) {
    throw new Error('Weather fallback returned invalid current conditions.');
  }

  const weatherDays = Array.isArray(root?.weather) ? root.weather : [];
  const daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
  } = { time: [], temperature_2m_max: [], temperature_2m_min: [], weathercode: [] };
  for (const entry of weatherDays) {
    const day = asRecord(entry);
    const date = typeof day?.date === 'string' ? day.date : '';
    const maximum = finiteNumber(day?.maxtempC);
    const minimum = finiteNumber(day?.mintempC);
    const hourly = Array.isArray(day?.hourly) ? day.hourly : [];
    const midday = asRecord(hourly.find((hour) => finiteNumber(asRecord(hour)?.time) === 1200) ?? hourly[0]);
    const code = finiteNumber(midday?.weatherCode);
    if (!date || maximum === undefined || minimum === undefined || code === undefined || !(code in WTTR_WEATHER_CODES)) {
      continue;
    }
    daily.time.push(date);
    daily.temperature_2m_max.push(maximum);
    daily.temperature_2m_min.push(minimum);
    daily.weathercode.push(WTTR_WEATHER_CODES[code]);
  }

  return {
    current_weather: {
      temperature: currentTemperature,
      weathercode: WTTR_WEATHER_CODES[currentCode],
      windspeed: finiteNumber(current?.windspeedKmph),
      time: currentTime,
    },
    hourly: {
      time: [currentTime],
      relative_humidity_2m: [finiteNumber(current?.humidity)],
      apparent_temperature: [finiteNumber(current?.FeelsLikeC)],
      uv_index: [finiteNumber(current?.uvIndex)],
    },
    daily,
  };
}

async function fetchWttrWeather(latitude: number, longitude: number): Promise<unknown> {
  const url = `https://wttr.in/${latitude},${longitude}?format=j1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'WindowsPortfolioWidgets/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Weather fallback request failed (HTTP ${response.status}).`);
  return normalizeWttrWeather(await response.json());
}

async function fetchUpstreamJson(url: string, cacheKey: string, ttlMs = 60_000): Promise<unknown> {
  const cached = upstreamCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  for (const [key, entry] of upstreamCache) {
    if (entry.expiresAt <= Date.now()) upstreamCache.delete(key);
  }
  if (upstreamCache.size >= 150) {
    const oldestKey = upstreamCache.keys().next().value;
    if (oldestKey) upstreamCache.delete(oldestKey);
  }
  const response = await fetch(url, {
    headers: { 'User-Agent': 'WindowsPortfolioWidgets/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Upstream request failed (HTTP ${response.status}).`);
  const value: unknown = await response.json();
  upstreamCache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function fetchWeatherData(url: string, cacheKey: string, latitude: number, longitude: number): Promise<{
  value: unknown;
  stale: boolean;
  fetchedAt: number;
}> {
  const now = Date.now();
  const cached = weatherCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return { value: cached.value, stale: false, fetchedAt: cached.fetchedAt };
  }
  if (cached && now < cached.staleUntil && now < cached.retryAfter) {
    return { value: cached.value, stale: true, fetchedAt: cached.fetchedAt };
  }

  const pending = weatherRequests.get(cacheKey);
  if (pending) return pending;

  for (const [key, entry] of weatherCache) {
    if (entry.staleUntil <= now) weatherCache.delete(key);
  }
  if (weatherCache.size >= 150) {
    const oldestKey = weatherCache.keys().next().value;
    if (oldestKey) weatherCache.delete(oldestKey);
  }

  const request = (async () => {
    let value: unknown;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'WindowsPortfolioWidgets/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Upstream request failed (HTTP ${response.status}).`);
      value = await response.json();
    } catch (primaryError) {
      console.warn(`[Widgets] Open-Meteo unavailable; trying weather fallback (${summarizeProviderError(primaryError)}).`);
      try {
        value = await fetchWttrWeather(latitude, longitude);
      } catch (fallbackError) {
        console.warn(`[Widgets] Weather fallback unavailable (${summarizeProviderError(fallbackError)}).`);
        if (cached && Date.now() < cached.staleUntil) {
          cached.retryAfter = Date.now() + WEATHER_RETRY_DELAY_MS;
          console.warn('[Widgets] Weather providers unavailable; serving cached weather.');
          return { value: cached.value, stale: true, fetchedAt: cached.fetchedAt };
        }
        throw new Error('Weather providers are unavailable.');
      }
    }

    const fetchedAt = Date.now();
    weatherCache.set(cacheKey, {
      value,
      fetchedAt,
      expiresAt: fetchedAt + WEATHER_CACHE_TTL_MS,
      staleUntil: fetchedAt + WEATHER_STALE_TTL_MS,
      retryAfter: 0,
    });
    return { value, stale: false, fetchedAt };
  })();
  weatherRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    weatherRequests.delete(cacheKey);
  }
}

async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`,
    { headers: { 'User-Agent': 'WindowsPortfolioWidgets/1.0' }, signal: AbortSignal.timeout(8000) }
  );
  if (!response.ok) throw new Error(`Quote request failed (HTTP ${response.status}).`);

  const payload = asRecord(await response.json());
  const chart = asRecord(payload?.chart);
  const result = Array.isArray(chart?.result) ? asRecord(chart.result[0]) : null;
  const metadata = asRecord(result?.meta);
  const indicator = Array.isArray(asRecord(result?.indicators)?.quote)
    ? asRecord((asRecord(result?.indicators)?.quote as unknown[])[0])
    : null;
  const closeValues = Array.isArray(indicator?.close) ? indicator.close : [];
  const lastClose = [...closeValues].reverse().find((value) => typeof value === 'number' && Number.isFinite(value));
  const price = typeof metadata?.regularMarketPrice === 'number'
    ? metadata.regularMarketPrice
    : lastClose;
  const previousClose = typeof metadata?.chartPreviousClose === 'number'
    ? metadata.chartPreviousClose
    : metadata?.previousClose;

  if (
    typeof price !== 'number' ||
    !Number.isFinite(price) ||
    typeof previousClose !== 'number' ||
    !Number.isFinite(previousClose) ||
    previousClose === 0
  ) {
    throw new Error('Quote response did not contain valid prices.');
  }

  const longName = metadata?.longName;
  const shortName = metadata?.shortName;
  return {
    symbol,
    name: typeof longName === 'string' ? longName : typeof shortName === 'string' ? shortName : symbol,
    price,
    changePercent: ((price - previousClose) / previousClose) * 100,
  };
}

async function fetchKrakenCryptoQuotes(): Promise<Array<{
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
}>> {
  const payload = asRecord(await fetchUpstreamJson(
    'https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD',
    'crypto:kraken:btc,eth'
  ));
  const result = asRecord(payload?.result);
  if (!result || (Array.isArray(payload?.error) && payload.error.length > 0)) {
    throw new Error('Kraken returned an invalid crypto ticker response.');
  }

  return [
    { symbol: 'BTC', name: 'Bitcoin', pairFragment: 'XBT' },
    { symbol: 'ETH', name: 'Ethereum', pairFragment: 'ETH' },
  ].flatMap(({ symbol, name, pairFragment }) => {
    const pair = Object.entries(result).find(([key]) => key.toUpperCase().includes(pairFragment));
    const quote = asRecord(pair?.[1]);
    const lastTrade = Array.isArray(quote?.c) ? Number(quote.c[0]) : NaN;
    const openingPrice = typeof quote?.o === 'string' ? Number(quote.o) : NaN;
    if (!Number.isFinite(lastTrade) || !Number.isFinite(openingPrice) || openingPrice <= 0) return [];
    return [{
      symbol,
      name,
      current_price: lastTrade,
      price_change_percentage_24h: ((lastTrade - openingPrice) / openingPrice) * 100,
    }];
  });
}

widgetsRouter.get('/weather', weatherLimiter, async (req, res: Response) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    res.status(400).json({ success: false, error: 'A valid latitude and longitude are required.' });
    return;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relative_humidity_2m,apparent_temperature,uv_index&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
  try {
    const weather = await fetchWeatherData(
      url,
      `weather:${latitude.toFixed(3)}:${longitude.toFixed(3)}`,
      latitude,
      longitude,
    );
    res.json({
      success: true,
      data: weather.value,
      stale: weather.stale,
      updatedAt: new Date(weather.fetchedAt).toISOString(),
    });
  } catch (error) {
    console.error('[Widgets] Weather provider request failed.', error);
    res.status(502).json({ success: false, error: 'Live weather is temporarily unavailable.' });
  }
});

widgetsRouter.get('/geocoding/search', geocodingLimiter, async (req, res: Response) => {
  const query = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (query.length < 2 || query.length > 80) {
    res.status(400).json({ success: false, error: 'Search city must contain 2 to 80 characters.' });
    return;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;
  try {
    res.json({ success: true, data: await fetchUpstreamJson(url, `geocoding:search:${query.toLowerCase()}`, 5 * 60_000) });
  } catch (error) {
    console.error('[Widgets] City search provider request failed.', error);
    res.status(502).json({ success: false, error: 'City search is temporarily unavailable.' });
  }
});

widgetsRouter.get('/geocoding/reverse', geocodingLimiter, async (req, res: Response) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    res.status(400).json({ success: false, error: 'A valid latitude and longitude are required.' });
    return;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;
  try {
    res.json({ success: true, data: await fetchUpstreamJson(url, `geocoding:reverse:${latitude.toFixed(3)}:${longitude.toFixed(3)}`, 5 * 60_000) });
  } catch (error) {
    console.error('[Widgets] Reverse geocoding provider request failed.', error);
    res.status(502).json({ success: false, error: 'Location details are temporarily unavailable.' });
  }
});

widgetsRouter.get('/crypto', weatherLimiter, async (_req, res: Response) => {
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h';
  try {
    const responseData = await fetchUpstreamJson(url, 'crypto:usd:btc,eth');
    const data = Array.isArray(responseData)
      ? responseData.filter((coin) => {
          const ticker = asRecord(coin);
          return typeof ticker?.symbol === 'string' &&
            typeof ticker.name === 'string' &&
            typeof ticker.current_price === 'number' &&
            Number.isFinite(ticker.current_price) &&
            typeof ticker.price_change_percentage_24h === 'number' &&
            Number.isFinite(ticker.price_change_percentage_24h);
        })
      : [];
    if (!data.length) {
      throw new Error('CoinGecko returned no crypto tickers.');
    }
    res.json({ success: true, data, provider: 'CoinGecko' });
  } catch (primaryError) {
    console.warn('[Widgets] CoinGecko crypto quotes unavailable; trying Kraken.', primaryError);
    try {
      const data = await fetchKrakenCryptoQuotes();
      if (!data.length) throw new Error('Kraken did not return valid BTC or ETH quotes.');
      res.json({ success: true, data, provider: 'Kraken' });
    } catch (fallbackError) {
      console.error('[Widgets] Both CoinGecko and Kraken crypto feeds failed.', fallbackError);
      res.status(502).json({ success: false, error: 'Live crypto quotes are temporarily unavailable from CoinGecko and Kraken.' });
    }
  }
});

widgetsRouter.get('/market', quoteLimiter, async (_req, res: Response) => {
  if (cachedQuotes && Date.now() < cacheExpiresAt) {
    res.json({ success: true, ...cachedQuotes });
    return;
  }

  const settled = await Promise.allSettled(STOCK_SYMBOLS.map(fetchStockQuote));
  const quotes = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const warnings = settled.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [];
    console.warn(`[Widgets] Stock quote refresh failed for ${STOCK_SYMBOLS[index]}.`, result.reason);
    return [STOCK_SYMBOLS[index]];
  });

  if (!quotes.length && cachedQuotes) {
    res.json({
      success: true,
      ...cachedQuotes,
      stale: true,
      warnings: ['Latest stock quotes could not be refreshed; showing the last successful prices.'],
    });
    return;
  }
  if (!quotes.length) {
    res.status(502).json({
      success: false,
      error: 'Live stock quotes are temporarily unavailable.',
      warnings,
    });
    return;
  }

  cachedQuotes = {
    quotes,
    warnings: warnings.length ? [`Stock quote unavailable: ${warnings.join(', ')}.`] : [],
    updatedAt: new Date().toISOString(),
  };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  res.json({ success: true, ...cachedQuotes });
});
