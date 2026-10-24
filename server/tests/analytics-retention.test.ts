import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { analyticsLogger, sanitizeLogData } from '../middleware/security';
import { AnalyticsModel } from '../models';

test('request analytics redact URL query values that may contain credentials', () => {
  const sanitized = sanitizeLogData({
    url: 'https://example.test/reset?token=private-value',
    query: 'ordinary-search',
  });

  assert.deepEqual(sanitized, {
    url: '[REDACTED]',
    query: 'ordinary-search',
  });
});

test('request analytics use trusted client IP and expire after 90 days', async () => {
  await connectMongo();
  await db.initMongoSync();
  await AnalyticsModel.init();

  const path = `/api/analytics-retention-test-${Date.now()}`;
  const app = express();
  app.set('trust proxy', false);
  app.use(analyticsLogger);
  app.get(path, (_req, res) => res.sendStatus(204));
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start analytics retention test server.');
  }

  try {
    const beforeRequest = Date.now();
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      headers: { 'X-Forwarded-For': '203.0.113.77' },
    });
    assert.equal(response.status, 204);

    let event = await AnalyticsModel.findOne({ page: path }).lean();
    for (let attempt = 0; !event && attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      event = await AnalyticsModel.findOne({ page: path }).lean();
    }
    assert.ok(event, 'request event should persist');
    assert.notEqual(event.ipAddress, '203.0.113.77', 'client-supplied forwarding headers are ignored');
    assert.ok(event.expiresAt instanceof Date, 'request events receive an expiration timestamp');
    const retention = event.expiresAt.getTime() - beforeRequest;
    assert.ok(retention >= 89 * 24 * 60 * 60 * 1000);
    assert.ok(retention <= 90 * 24 * 60 * 60 * 1000 + 1000);

    const indexes = await AnalyticsModel.collection.indexes();
    assert.ok(indexes.some((index) => index.key?.expiresAt === 1 && index.expireAfterSeconds === 0));
  } finally {
    await AnalyticsModel.deleteMany({ page: path });
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
});
