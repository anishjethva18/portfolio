import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { analyticsLogger, sanitizeLogData } from '../middleware/security';
import { AnalyticsModel } from '../models';
import { retainAnalyticsUntilReset } from '../models/Analytics';

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

test('request analytics persist indefinitely until an admin reset', async () => {
  await connectMongo();
  await db.initMongoSync();
  await AnalyticsModel.init();
  await AnalyticsModel.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await retainAnalyticsUntilReset();

  const path = `/api/analytics-retention-test-${Date.now()}`;
  const oldEventId = `analytics-retention-old-${Date.now()}`;
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
    assert.ok(!('expiresAt' in event), 'new request events do not receive an expiration timestamp');

    const indexes = await AnalyticsModel.collection.indexes();
    assert.ok(!indexes.some((index) => index.expireAfterSeconds !== undefined), 'no TTL index can delete analytics automatically');
    await AnalyticsModel.collection.insertOne({
      id: oldEventId,
      eventName: 'OLD_ANALYTICS_EVENT',
      category: 'system',
      timestamp: '2020-01-01T00:00:00.000Z',
      ipAddress: 'not-collected',
      userAgent: '',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    assert.ok(await AnalyticsModel.collection.findOne({ id: oldEventId }), 'historical analytics remain available until manually reset');
  } finally {
    await AnalyticsModel.deleteMany({ page: path });
    await AnalyticsModel.deleteOne({ id: oldEventId });
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
});
