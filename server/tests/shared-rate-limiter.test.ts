import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { createRateLimiter } from '../middleware/security';
import { RateLimitBucketModel } from '../models';

test('rate limits are shared between middleware instances through MongoDB', async () => {
  await connectMongo();
  await db.initMongoSync();
  await RateLimitBucketModel.deleteMany({});

  const routePath = `/shared-rate-limit-${Date.now()}`;
  const limiterOptions = { maxRequests: 2, windowMs: 60_000 };
  const firstApp = express();
  const secondApp = express();
  firstApp.get(routePath, createRateLimiter(limiterOptions), (_req, res) => res.sendStatus(204));
  secondApp.get(routePath, createRateLimiter(limiterOptions), (_req, res) => res.sendStatus(204));
  const firstServer = firstApp.listen(0);
  const secondServer = secondApp.listen(0);
  const firstAddress = firstServer.address();
  const secondAddress = secondServer.address();
  if (!firstAddress || typeof firstAddress === 'string' || !secondAddress || typeof secondAddress === 'string') {
    throw new Error('Could not start shared rate-limit test servers.');
  }

  try {
    const first = await fetch(`http://127.0.0.1:${firstAddress.port}${routePath}`);
    const second = await fetch(`http://127.0.0.1:${secondAddress.port}${routePath}`);
    const blocked = await fetch(`http://127.0.0.1:${firstAddress.port}${routePath}`);

    assert.equal(first.status, 204);
    assert.equal(second.status, 204);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('x-ratelimit-limit'), '2');
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    const payload = await blocked.json() as { retryAfterSeconds?: number };
    assert.ok(Number(payload.retryAfterSeconds) > 0);
  } finally {
    await Promise.all([
      new Promise<void>((resolve, reject) => firstServer.close((error) => error ? reject(error) : resolve())),
      new Promise<void>((resolve, reject) => secondServer.close((error) => error ? reject(error) : resolve())),
    ]);
    await RateLimitBucketModel.deleteMany({});
    await disconnectMongo();
  }
});
