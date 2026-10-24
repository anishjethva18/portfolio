import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { requireAdmin, validateCsrf } from '../middleware/auth';
import { UserModel } from '../models';
import { authRouter } from '../routes/auth';
import { authService } from '../services/authService';
import { sessionService } from '../services/sessionService';

test('production authentication cookies are secure and CSRF protects writes', async () => {
  await connectMongo();
  await db.initMongoSync();

  const adminId = `secure_cookie_admin_${Date.now()}`;
  const email = `secure_cookie_${Date.now()}@test.local`;
  const password = 'SecureTestPassword123!';
  const originalEnv = { ...process.env };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.post('/api/protected-write', requireAdmin, validateCsrf, (_req, res) => res.sendStatus(204));
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start cookie security test server.');
  }

  try {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      APP_URL: 'https://portfolio.example',
      ADMIN_EMAIL: email,
      MONGODB_URI: 'mongodb://isolated-test.invalid',
      EMAIL_USER: 'test@example.invalid',
      EMAIL_PASS: 'test-only-password',
    });
    const now = new Date().toISOString();
    await UserModel.create({
      id: adminId,
      email,
      passwordHash: await authService.hashPassword(password),
      name: 'Cookie Security Test',
      role: 'admin',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    db.users.set(adminId, {
      id: adminId,
      email,
      passwordHash: 'unused',
      name: 'Cookie Security Test',
      role: 'admin',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });

    const login = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    const cookies = login.headers.get('set-cookie') || '';
    assert.match(cookies, /__Host-sid=/);
    assert.match(cookies, /HttpOnly/i);
    assert.match(cookies, /Secure/i);
    assert.match(cookies, /SameSite=Lax/i);
    assert.match(cookies, /csrfToken=/);
    const csrfCookie = cookies.slice(cookies.indexOf('csrfToken='));
    assert.doesNotMatch(csrfCookie, /HttpOnly/i);
    const payload = await login.json() as { csrfToken: string };
    const sidCookie = cookies.match(/__Host-sid=([^;,]+)/)?.[1];
    assert.ok(sidCookie);

    const noCsrf = await fetch(`http://127.0.0.1:${address.port}/api/protected-write`, {
      method: 'POST',
      headers: { Cookie: `__Host-sid=${sidCookie}` },
    });
    assert.equal(noCsrf.status, 403);

    const withCsrf = await fetch(`http://127.0.0.1:${address.port}/api/protected-write`, {
      method: 'POST',
      headers: {
        Cookie: `__Host-sid=${sidCookie}; csrfToken=${payload.csrfToken}`,
        'X-CSRF-Token': payload.csrfToken,
      },
    });
    assert.equal(withCsrf.status, 204);

    await sessionService.revokeSession(sidCookie);
  } finally {
    await UserModel.deleteMany({ id: adminId });
    db.users.delete(adminId);
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
});
