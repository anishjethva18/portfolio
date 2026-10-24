import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { requireAdmin } from '../middleware/auth';
import { SessionModel, UserModel } from '../models';
import { authRouter } from '../routes/auth';
import { sessionService } from '../services/sessionService';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`Failed: ${message}`);
  console.log(`Passed: ${message}`);
};

async function runAdminSessionLifecycleTests(): Promise<void> {
  await connectMongo();
  await db.initMongoSync();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.get('/api/admin/protected', requireAdmin, (_req, res) => res.json({ success: true }));
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start admin session test server.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const now = new Date().toISOString();
  const adminId = `session_admin_${Date.now()}`;
  const adminEmail = `${adminId}@test.local`;
  const visitorId = `${adminId}_visitor`;
  let currentAdminSession = '';
  let otherAdminSession = '';
  let visitorSession = '';

  try {
    await UserModel.create([
      {
        id: adminId,
        email: adminEmail,
        passwordHash: 'test-session-only',
        name: 'Session Test Admin',
        role: 'admin',
        disabled: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: visitorId,
        email: `${visitorId}@test.local`,
        passwordHash: 'test-session-only',
        name: 'Session Test Visitor',
        role: 'user',
        disabled: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const admin = { id: adminId, email: adminEmail, role: 'admin' as const };
    const visitor = { id: visitorId, email: `${visitorId}@test.local`, role: 'user' as const };
    const first = await sessionService.createSession(admin);
    const second = await sessionService.createSession(admin);
    const visitorSessionResult = await sessionService.createSession(visitor);
    currentAdminSession = first.sessionId;
    otherAdminSession = second.sessionId;
    visitorSession = visitorSessionResult.sessionId;

    const protectedResponse = await fetch(`${baseUrl}/api/admin/protected`, {
      headers: { Cookie: `sid=${currentAdminSession}` },
    });
    assert(protectedResponse.ok, 'A valid administrator session can access protected admin APIs');

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `sid=${currentAdminSession}; csrfToken=${first.csrfToken}`,
        'X-CSRF-Token': first.csrfToken,
      },
    });
    assert(
      logoutResponse.status === 200 &&
        (await sessionService.validateSession(currentAdminSession)) === null &&
        (await sessionService.validateSession(otherAdminSession)) !== null &&
        (await sessionService.validateSession(visitorSession)) !== null,
      'Explicit logout revokes only the current admin session, preserving other sessions and visitor auth'
    );

    const revokedApiResponse = await fetch(`${baseUrl}/api/admin/protected`, {
      headers: { Cookie: `sid=${currentAdminSession}` },
    });
    assert(revokedApiResponse.status === 401, 'Revoked admin sessions are rejected by protected APIs');

    const visitorProtectedResponse = await fetch(`${baseUrl}/api/admin/protected`, {
      headers: { Cookie: `sid=${visitorSession}` },
    });
    assert(visitorProtectedResponse.status === 403, 'Visitor sessions remain valid but cannot access admin APIs');
    const visitorLogoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `sid=${visitorSession}; csrfToken=${visitorSessionResult.csrfToken}`,
        'X-CSRF-Token': visitorSessionResult.csrfToken,
      },
    });
    assert(
      visitorLogoutResponse.status === 403 &&
        (await sessionService.validateSession(visitorSession)) !== null,
      'Visitor sessions cannot invoke the Admin logout endpoint or revoke themselves through it'
    );

    const expiredSession = await sessionService.createSession(admin);
    const expiredHash = crypto.createHash('sha256').update(expiredSession.sessionId).digest('hex');
    await SessionModel.updateOne({ sessionId: expiredHash }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expiredApiResponse = await fetch(`${baseUrl}/api/admin/protected`, {
      headers: { Cookie: `sid=${expiredSession.sessionId}` },
    });
    assert(
      expiredApiResponse.status === 401 &&
        (await sessionService.validateSession(expiredSession.sessionId)) === null,
      'Expired administrator sessions are rejected and require a fresh login'
    );

    const expiredLogoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `sid=${expiredSession.sessionId}; csrfToken=${expiredSession.csrfToken}`,
        'X-CSRF-Token': expiredSession.csrfToken,
      },
    });
    assert(expiredLogoutResponse.status === 401, 'Retrying logout after expiry reports an already-ended session');
  } finally {
    for (const sessionId of [currentAdminSession, otherAdminSession, visitorSession]) {
      if (sessionId) await sessionService.revokeSession(sessionId);
    }
    await SessionModel.deleteMany({ userId: { $in: [adminId, visitorId] } });
    await UserModel.deleteMany({ id: { $in: [adminId, visitorId] } });
    db.users.delete(adminId);
    db.users.delete(visitorId);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
}

runAdminSessionLifecycleTests().catch(async (error: unknown) => {
  console.error(error);
  await disconnectMongo();
  process.exitCode = 1;
});
