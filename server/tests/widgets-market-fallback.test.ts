import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { widgetsRouter } from '../routes/widgets';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';

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
