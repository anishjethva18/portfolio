import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { widgetsRouter } from '../routes/widgets';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';

const WEATHER_CACHE_TTL_MS_FOR_TEST = 61_000;

test('crypto widget falls back to Kraken when CoinGecko is unavailable', async (t) => {
  await connectMongo();
  await db.initMongoSync();
  t.after(() => disconnectMongo());

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
    if (url.includes('api.coingecko.com')) {
      return new Response('rate limited', { status: 429 });
    }
    if (url.includes('api.kraken.com/0/public/Ticker')) {
      return Response.json({
        error: [],
        result: {
          XXBTZUSD: { c: ['68000', '0.01'], o: '67000' },
          XETHZUSD: { c: ['3500', '0.01'], o: '3400' },
        },
      });
    }
    throw new Error(`Unexpected upstream URL: ${url}`);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const app = express();
  app.use('/api/widgets', widgetsRouter);
  const server = app.listen(0);
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  const response = await originalFetch(`http://127.0.0.1:${port}/api/widgets/crypto`);
  const payload = await response.json() as {
    success?: boolean;
    provider?: string;
    data?: Array<{ symbol: string; current_price: number; price_change_percentage_24h: number }>;
  };
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.provider, 'Kraken');
  assert.deepEqual(payload.data?.map(({ symbol }) => symbol), ['BTC', 'ETH']);
  assert.equal(payload.data?.[0].current_price, 68000);
  assert.ok((payload.data?.[0].price_change_percentage_24h || 0) > 0);
});

test('weather widget serves clearly marked cached data when Open-Meteo is unavailable', async (t) => {
  await connectMongo();
  await db.initMongoSync();
  t.after(() => disconnectMongo());

  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let upstreamRequests = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
    if (url.includes('api.open-meteo.com')) {
      upstreamRequests++;
      if (upstreamRequests > 1) throw new TypeError('fetch failed');
      return Response.json({
        current_weather: { temperature: 24, weathercode: 1, windspeed: 8, time: '2026-10-31T08:00' },
        hourly: { time: ['2026-10-31T08:00'], relative_humidity_2m: [50], apparent_temperature: [25], uv_index: [3] },
        daily: { time: ['2026-10-31'], temperature_2m_max: [29], temperature_2m_min: [20], weathercode: [1] },
      });
    }
    throw new Error(`Unexpected upstream URL: ${url}`);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  });

  const app = express();
  app.use('/api/widgets', widgetsRouter);
  const server = app.listen(0);
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/api/widgets/weather?latitude=12.345&longitude=67.89`;

  const freshResponse = await originalFetch(url);
  const freshPayload = await freshResponse.json() as { success?: boolean; stale?: boolean; updatedAt?: string };
  assert.equal(freshResponse.status, 200);
  assert.equal(freshPayload.success, true);
  assert.equal(freshPayload.stale, false);

  Date.now = () => originalNow() + WEATHER_CACHE_TTL_MS_FOR_TEST;
  const staleResponse = await originalFetch(url);
  const stalePayload = await staleResponse.json() as { success?: boolean; stale?: boolean; updatedAt?: string };
  assert.equal(staleResponse.status, 200);
  assert.equal(stalePayload.success, true);
  assert.equal(stalePayload.stale, true);
  assert.equal(stalePayload.updatedAt, freshPayload.updatedAt);

  const retryResponse = await originalFetch(url);
  const retryPayload = await retryResponse.json() as { stale?: boolean };
  assert.equal(retryPayload.stale, true);
  assert.equal(upstreamRequests, 2);
});

test('weather widget falls back to wttr.in when Open-Meteo cannot be resolved', async (t) => {
  await connectMongo();
  await db.initMongoSync();
  t.after(() => disconnectMongo());

  const originalFetch = globalThis.fetch;
  let fallbackRequests = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
    if (url.includes('api.open-meteo.com')) throw new TypeError('fetch failed');
    if (url.startsWith('https://wttr.in/23.456,-78.901?format=j1')) {
      fallbackRequests++;
      return Response.json({
        current_condition: [{
          temp_C: '22',
          weatherCode: '116',
          windspeedKmph: '10',
          humidity: '60',
          FeelsLikeC: '21',
          uvIndex: '3',
        }],
        weather: [{
          date: '2026-10-31',
          maxtempC: '28',
          mintempC: '19',
          hourly: [{ time: '1200', weatherCode: '119' }],
        }],
      });
    }
    throw new Error(`Unexpected upstream URL: ${url}`);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const app = express();
  app.use('/api/widgets', widgetsRouter);
  const server = app.listen(0);
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  const response = await originalFetch(
    `http://127.0.0.1:${port}/api/widgets/weather?latitude=23.456&longitude=-78.901`,
  );
  const payload = await response.json() as {
    success?: boolean;
    stale?: boolean;
    data?: {
      current_weather?: { temperature?: number; weathercode?: number; windspeed?: number; time?: string };
      hourly?: { relative_humidity_2m?: number[]; apparent_temperature?: number[]; uv_index?: number[] };
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; weathercode?: number[] };
    };
  };
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.stale, false);
  assert.equal(payload.data?.current_weather?.temperature, 22);
  assert.equal(payload.data?.current_weather?.weathercode, 2);
  assert.equal(payload.data?.current_weather?.windspeed, 10);
  assert.equal(typeof payload.data?.current_weather?.time, 'string');
  assert.deepEqual(payload.data?.hourly?.relative_humidity_2m, [60]);
  assert.deepEqual(payload.data?.hourly?.apparent_temperature, [21]);
  assert.deepEqual(payload.data?.hourly?.uv_index, [3]);
  assert.deepEqual(payload.data?.daily?.temperature_2m_max, [28]);
  assert.deepEqual(payload.data?.daily?.temperature_2m_min, [19]);
  assert.deepEqual(payload.data?.daily?.weathercode, [3]);
  assert.equal(fallbackRequests, 1);
});
