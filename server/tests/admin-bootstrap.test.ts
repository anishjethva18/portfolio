import assert from 'node:assert/strict';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { requireAdmin } from '../middleware/auth';
import { UserModel, PasswordResetTokenModel } from '../models';
import { adminRouter } from '../routes/admin';
import { authRouter } from '../routes/auth';
import { AuthService, authService } from '../services/authService';
import { emailService } from '../services/emailService';
import { SessionHistoryModel, SessionModel } from '../models';

test('environment bootstrap is atomic, database-authoritative, and supports additional managed admins', async () => {
  const savedEnvironment = {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_NAME: process.env.ADMIN_NAME,
    NODE_ENV: process.env.NODE_ENV,
  };
  await connectMongo();
  await db.initMongoSync();
  await UserModel.deleteMany({});
  db.users.clear();
  await UserModel.collection.createIndex(
    { role: 1 },
    {
      unique: true,
      partialFilterExpression: { role: 'admin' },
      name: 'unique_single_admin_by_role',
    },
  );
  await authService.ensureBootstrapAdminConstraint();
  const upgradedIndexes = await UserModel.collection.indexes();
  assert.ok(upgradedIndexes.some((index) => index.name === 'unique_bootstrap_admin'));
  assert.equal(upgradedIndexes.some((index) => index.name === 'unique_single_admin_by_role'), false);
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.get('/api/admin/protected', requireAdmin, (_req, res) => res.json({ success: true }));
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let adminId = '';
  let secondAdminId = '';

  const login = async (email: string, password: string) => fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  try {
    process.env.NODE_ENV = 'test';
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    const missingConfiguration = await login('owner@example.test', 'SomeSecurePassword123!');
    assert.equal(missingConfiguration.status, 503);
    assert.deepEqual(await missingConfiguration.json(), {
      success: false,
      error: 'Invalid email or password',
    });

    const bootstrapEmail = 'first-admin@example.test';
    const bootstrapPassword = 'BootstrapSecurePassword123!';
    process.env.ADMIN_EMAIL = bootstrapEmail;
    process.env.ADMIN_PASSWORD = bootstrapPassword;

    const wrongFirstLogin = await login(bootstrapEmail, 'IncorrectSecurePassword123!');
    assert.equal(wrongFirstLogin.status, 401);
    assert.equal(await UserModel.countDocuments({ role: 'admin' }), 0);

    const concurrentLogins = await Promise.all([
      login(bootstrapEmail, bootstrapPassword),
      login(bootstrapEmail, bootstrapPassword),
    ]);
    assert.deepEqual(concurrentLogins.map((response) => response.status), [200, 200]);
    const admins = await UserModel.find({ role: 'admin' }).lean();
    assert.equal(admins.length, 1, 'concurrent first logins create only one admin');
    const admin = admins[0];
    adminId = admin.id;
    assert.match(admin.passwordHash, /^\$argon2id\$/);
    assert.notEqual(admin.passwordHash, bootstrapPassword);
    const firstLoginPayload = await concurrentLogins[0].json() as {
      user: Record<string, unknown>;
      csrfToken: string;
    };
    assert.equal('passwordHash' in firstLoginPayload.user, false);
    assert.equal(JSON.stringify(firstLoginPayload).includes(bootstrapPassword), false);

    const changedEmail = 'changed-admin@example.test';
    const changedPassword = 'ChangedSecurePassword123!';
    process.env.ADMIN_EMAIL = changedEmail;
    process.env.ADMIN_PASSWORD = changedPassword;
    const existingDatabaseLogin = await login(bootstrapEmail, bootstrapPassword);
    assert.equal(existingDatabaseLogin.status, 200, 'existing DB credentials remain authoritative after env changes');
    const environmentBypass = await login(changedEmail, changedPassword);
    assert.equal(environmentBypass.status, 401, 'changed env credentials cannot bypass the existing DB account');
    const unchangedAdmin = await UserModel.findOne({ id: adminId }).select('email passwordHash').lean();
    assert.equal(unchangedAdmin?.email, bootstrapEmail);
    assert.equal(await authService.comparePassword(bootstrapPassword, unchangedAdmin!.passwordHash), true);

    const registration = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST' });
    assert.equal(registration.status, 404, 'public registration endpoint remains unavailable');
    const unauthenticatedAdminApi = await fetch(`${baseUrl}/api/admin/users`);
    assert.equal(unauthenticatedAdminApi.status, 401, 'admin APIs remain protected');
    const unauthenticatedCreate = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'second-admin@example.test', password: 'AnotherSecurePassword123!' }),
    });
    assert.equal(unauthenticatedCreate.status, 401);

    const authenticatedLogin = await login(bootstrapEmail, bootstrapPassword);
    const cookies = authenticatedLogin.headers.get('set-cookie') || '';
    const sessionId = cookies.match(/(?:^|,\s*)sid=([^;,\s]+)/)?.[1];
    const csrfToken = cookies.match(/csrfToken=([^;,\s]+)/)?.[1];
    assert.ok(sessionId && csrfToken);
    const authHeaders = {
      Cookie: `sid=${sessionId}; csrfToken=${csrfToken}`,
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    };
    const additionalAdmin = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email: 'second-admin@example.test', password: 'AnotherSecurePassword123!' }),
    });
    assert.equal(additionalAdmin.status, 422, 'managed Admin creation validates required account name');
    const createdAdmin = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Second Admin',
        email: 'second-admin@example.test',
        password: 'AnotherSecurePassword123!',
        role: 'admin',
      }),
    });
    assert.equal(createdAdmin.status, 201, 'authenticated Admin can create another administrator from Users');
    const createdAdminPayload = await createdAdmin.json() as { user: { id: string; email: string; role: string } };
    secondAdminId = createdAdminPayload.user.id;
    assert.equal(createdAdminPayload.user.role, 'admin');
    assert.equal(await UserModel.countDocuments({ role: 'admin' }), 2);
    const bootstrapIndexes = await UserModel.collection.indexes();
    assert.ok(bootstrapIndexes.some((index) => index.name === 'unique_bootstrap_admin'));
    await new AuthService().ensureBootstrapAdminConstraint();
    const secondAdminLogin = await login('second-admin@example.test', 'AnotherSecurePassword123!');
    assert.equal(secondAdminLogin.status, 200, 'additional Admin can authenticate with database credentials');
    const secondAdminRecord = await UserModel.findOne({ id: secondAdminId }).lean();
    assert.equal(await authService.comparePassword('AnotherSecurePassword123!', secondAdminRecord!.passwordHash), true);

    await assert.rejects(
      UserModel.create({
        id: 'duplicate-bootstrap-admin',
        email: 'duplicate-bootstrap@example.test',
        passwordHash: await authService.hashPassword('AnotherSecurePassword123!'),
        name: 'Duplicate Bootstrap Admin',
        role: 'admin',
        bootstrapAdmin: true,
        disabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      (error: { code?: number }) => error.code === 11000,
      'bootstrap-only marker remains unique without restricting managed Admin accounts',
    );

    const rolePromotion = await fetch(`${baseUrl}/api/admin/users/migrate-to-admin`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(rolePromotion.status, 410, 'legacy bulk role migration remains disabled');
    assert.equal(await UserModel.countDocuments({ role: 'admin' }), 2);
    const protectedApi = await fetch(`${baseUrl}/api/admin/protected`, {
      headers: { Cookie: `sid=${sessionId}` },
    });
    assert.equal(protectedApi.status, 200);

    const originalSendResetEmail = emailService.sendPasswordResetEmail;
    let resetLink = '';
    emailService.sendPasswordResetEmail = async (_email, link) => {
      resetLink = link;
      return true;
    };
    try {
      const resetRequest = await authService.requestPasswordReset(bootstrapEmail);
      assert.equal(resetRequest.delivered, true, 'existing password recovery still sends a reset link');
      const resetToken = new URLSearchParams(new URL(resetLink).hash.slice(1)).get('resetToken');
      assert.ok(resetToken);
      const replacementPassword = 'RecoveredSecurePassword123!';
      assert.equal(await authService.resetPassword(resetToken!, replacementPassword), true);
      const recoveredLogin = await login(bootstrapEmail, replacementPassword);
      assert.equal(recoveredLogin.status, 200, 'password recovery updates the existing database credential');
    } finally {
      emailService.sendPasswordResetEmail = originalSendResetEmail;
    }

    await SessionModel.deleteMany({ userId: adminId });
    await SessionHistoryModel.deleteMany({ userId: adminId });
    await PasswordResetTokenModel.deleteMany({ userId: adminId });
    await SessionModel.deleteMany({ userId: secondAdminId });
    await SessionHistoryModel.deleteMany({ userId: secondAdminId });
  } finally {
    if (adminId) {
      await SessionModel.deleteMany({ userId: adminId });
      await SessionHistoryModel.deleteMany({ userId: adminId });
      await PasswordResetTokenModel.deleteMany({ userId: adminId });
      await UserModel.deleteOne({ id: adminId });
      db.users.delete(adminId);
    }
    if (secondAdminId) {
      await SessionModel.deleteMany({ userId: secondAdminId });
      await SessionHistoryModel.deleteMany({ userId: secondAdminId });
      await UserModel.deleteOne({ id: secondAdminId });
      db.users.delete(secondAdminId);
    }
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
});
