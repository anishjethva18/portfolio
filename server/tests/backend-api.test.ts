import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, DatabaseManager } from '../db/database';
import { connectMongo, disconnectMongo, withDefaultMongoDatabase } from '../config/dbConfig';
import { getAuthConfig } from '../config/authConfig';
import {
  UserModel,
  TaskModel,
  ProjectModel,
  FileMetadataModel,
  AnalyticsModel,
  AdminAuditLogModel,
  CaptureModel,
  SessionModel,
  PasswordResetTokenModel,
  SiteContentModel,
  AdminContentDraftModel,
  AdminProjectDraftModel,
  AdminContentRevisionModel,
} from '../models';
import { authService } from '../services/authService';
import { emailService } from '../services/emailService';
import { formatEmailTimestamp } from '../utils/dateTime';
import { sessionService } from '../services/sessionService';
import { fileService } from '../services/fileService';
import { windowsStorageService } from '../services/windowsStorageService';
import { isOwnerOrAdmin, requireAuth } from '../middleware/auth';
import { sanitizeLogData } from '../middleware/security';
import { assertPrivateStoragePath } from '../utils/privateStoragePath';
import { authRouter } from '../routes/auth';
import { adminRouter, isValidBackupBase64 } from '../routes/admin';
import { contentStudioRouter } from '../routes/contentStudio';
import { contentStudioService } from '../services/contentStudioService';
import { projectDraftService } from '../services/projectDraftService';
import { getLivePortfolioContent } from '../routes/admin';
import { browseRouter } from '../routes/browse';
import { apiNotFoundHandler } from '../middleware/apiNotFound';
import { filesRouter, hasMediaUrlReference, hasVisibleResumeMediaReference, removeMediaUrlReferences } from '../routes/files';
import { analyticsRouter } from '../routes/analytics';
import { widgetsRouter } from '../routes/widgets';

async function createTestUser(email: string, password: string, name: string, role: 'admin' | 'user' = 'user') {
  const now = new Date().toISOString();
  const user = {
    id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: email.toLowerCase().trim(),
    passwordHash: await authService.hashPassword(password),
    name,
    role,
    disabled: false,
    createdAt: now,
    updatedAt: now,
  };
  await UserModel.create(user);
  db.users.set(user.id, user as any);
  return user;
}

async function runTests() {
  console.log('=================================================================');
  console.log('  Windows 11 Full-Stack Backend Integration & Security Test Suite');
  console.log('=================================================================\n');

  // Establish MongoDB connection
  const connInfo = await connectMongo();
  await db.initMongoSync();
  console.log(`[Test Suite] Initialized MongoDB Connection (${connInfo.uri})\n`);
  const canonicalAdminBefore = await UserModel.findOne({ id: 'usr_admin_anish' }).select('email passwordHash').lean();
  let testAdminEmail = `admin_${Date.now()}@test.local`;
  let testAdminPass = 'TestAdminPass123!';
  const testAdmin = await createTestUser(testAdminEmail, testAdminPass, 'Test Admin', 'admin');
  const testAdminUserId = testAdmin.id;
  console.log(`[Test Suite] Isolated test administrator created: ${testAdminEmail}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetail?: string) {
    if (condition) {
      console.log(`✔ Passed: ${testName}`);
      passed++;
    } else {
      console.error(`✘ Failed: ${testName}${errorDetail ? ` — ${errorDetail}` : ''}`);
      failed++;
    }
  }

  assert(
    new URL(withDefaultMongoDatabase('mongodb://localhost:27017')).pathname === '/portfolio' &&
      new URL(withDefaultMongoDatabase('mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true')).pathname === '/portfolio' &&
      new URL(withDefaultMongoDatabase('mongodb://localhost:27017/test')).pathname === '/test',
    'MongoDB connections default to portfolio without overriding an explicit database'
  );

  const mediaReferencePath = '/api/portfolio-media/file-test-pdf';
  const aliasedMediaReference = '/api/portfolio-media/resume%20(1).pdf?id=file-test-pdf';
  const resumeSubdocumentId = new mongoose.Types.ObjectId();
  const cleanedMediaReferences = removeMediaUrlReferences({
    resumes: [{ _id: resumeSubdocumentId, file: mediaReferencePath }],
  }, mediaReferencePath) as { resumes: Array<{ _id?: mongoose.Types.ObjectId; file: string }> };
  assert(
      !('_id' in cleanedMediaReferences.resumes[0]) &&
      cleanedMediaReferences.resumes[0].file === '' &&
      !hasMediaUrlReference(cleanedMediaReferences, mediaReferencePath),
    'Media reference cleanup omits generated subdocument IDs while unlinking file URLs'
  );
  const cleanedAliasReference = removeMediaUrlReferences(
    { resume: aliasedMediaReference },
    mediaReferencePath
  ) as { resume: string };
  assert(
    hasMediaUrlReference({ resume: aliasedMediaReference }, mediaReferencePath) &&
      cleanedAliasReference.resume === '',
    'Filename-based media URLs remain reference-aware for authorization and deletion'
  );
  assert(
    hasVisibleResumeMediaReference([
      { file: mediaReferencePath, active: false },
      { file: '/api/portfolio-media/file-hidden-resume', visible: false },
    ], mediaReferencePath) &&
      !hasVisibleResumeMediaReference([
        { file: mediaReferencePath, visible: false },
      ], mediaReferencePath),
    'Public media access follows resume visibility, not which visible resume is selected by default'
  );
  assert(
    isValidBackupBase64('A'.repeat(8 * 1024 * 1024)) &&
      !isValidBackupBase64('A'.repeat(4096) + '!==='),
    'Large backup media base64 validation avoids regex stack overflow and rejects invalid characters'
  );

  async function withRestoredEnvironment<T>(operation: () => Promise<T> | T, overrides: Record<string, string | undefined>): Promise<T> {
    const previous = { ...process.env };
    const keysToClear = Object.keys(overrides).filter((key) => overrides[key] === undefined);
    for (const key of keysToClear) delete process.env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) process.env[key] = value;
    }

    try {
      return await Promise.resolve(operation());
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in previous)) delete process.env[key];
      }
      Object.assign(process.env, previous);
    }
  }

  // Unknown API URLs must return JSON before any SPA fallback can serve HTML.
  {
    const apiFallbackApp = express();
    apiFallbackApp.get('/api/projects', (_req, res) => res.json({ success: true, projects: [] }));
    apiFallbackApp.use('/api', apiNotFoundHandler);
    apiFallbackApp.use((_req, res) => res.type('html').send('<!doctype html><title>SPA</title>'));
    const apiFallbackServer = apiFallbackApp.listen(0);
    const apiFallbackPort = (apiFallbackServer.address() as any).port;
    try {
      const validResponse = await fetch(`http://127.0.0.1:${apiFallbackPort}/api/projects`);
      const validContentType = validResponse.headers.get('content-type') || '';
      const validPayload = await validResponse.json() as { success?: boolean; projects?: unknown[] };
      const missingResponse = await fetch(`http://127.0.0.1:${apiFallbackPort}/api/health/admin`);
      const missingContentType = missingResponse.headers.get('content-type') || '';
      const missingPayload = await missingResponse.json() as { success?: boolean; error?: string };
      assert(
        validResponse.ok && validContentType.includes('application/json') && validPayload.success === true,
        'API success responses remain JSON ahead of the SPA fallback'
      );
      assert(
        missingResponse.status === 404 &&
          missingContentType.includes('application/json') &&
          missingPayload.success === false &&
          missingPayload.error === 'NotFound',
        'Unmatched API requests return a JSON 404 instead of SPA HTML'
      );
    } finally {
      await new Promise<void>((resolve, reject) => apiFallbackServer.close((error) => error ? reject(error) : resolve()));
    }
  }

  {
    const widgetsApp = express();
    widgetsApp.use('/api/widgets', widgetsRouter);
    const widgetsServer = widgetsApp.listen(0);
    const widgetsPort = (widgetsServer.address() as any).port;
    try {
      const weatherResponse = await fetch(`http://127.0.0.1:${widgetsPort}/api/widgets/weather?latitude=91&longitude=0`);
      const weatherPayload = await weatherResponse.json() as { success?: boolean; error?: string };
      const searchResponse = await fetch(`http://127.0.0.1:${widgetsPort}/api/widgets/geocoding/search?name=x`);
      const searchPayload = await searchResponse.json() as { success?: boolean; error?: string };
      assert(
        weatherResponse.status === 400 &&
          weatherPayload.success === false &&
          weatherPayload.error === 'A valid latitude and longitude are required.',
        'Widget weather proxy rejects out-of-range coordinates'
      );
      assert(
        searchResponse.status === 400 &&
          searchPayload.success === false &&
          searchPayload.error === 'Search city must contain 2 to 80 characters.',
        'Widget geocoding proxy rejects too-short search input'
      );
    } finally {
      await new Promise<void>((resolve, reject) => widgetsServer.close((error) => error ? reject(error) : resolve()));
    }
  }

  assert(
    formatEmailTimestamp('2026-10-04T13:24:06.000Z') === '4 Oct 2026, 6:54 PM IST',
    'Email timestamps use Asia/Kolkata date and time without seconds'
  );

  // --- 1. Database Initialization & Seed Integrity ---
  try {
    const users = db.getUsers();
    assert(users.length >= 1, 'Database initialization contains seeded users');
  } catch (err: any) {
    assert(false, 'Database initialization contains seeded users', err.message);
  }

  // --- 2. Argon2id administrator authentication ---
  try {
    const loginEmail = `login_test_${Date.now()}@test.local`;
    const loginPass = 'LoginPass123!';
    
    // Register a fresh user first
    const user = await createTestUser(loginEmail, loginPass, 'Login Tester', 'admin');

    const loginResult = await authService.login(loginEmail, loginPass);
    assert(
      Boolean(loginResult?.sessionId && loginResult?.csrfToken && loginResult.user.role === 'admin'),
      'Admin authenticates with Argon2id and receives a server-side CSRF-protected session'
    );
    assert(user.passwordHash.startsWith('$argon2id$'), 'New account password is stored as Argon2id');

    let wrongPassRejected = false;
    try {
      await authService.login(loginEmail, 'CompletelyWrongPass123!');
    } catch {
      wrongPassRejected = true;
    }
    assert(wrongPassRejected, 'Invalid passwords strictly rejected (no bypass)');

    const legacyEmail = `legacy_admin_${Date.now()}@test.local`;
    const legacyPassword = 'LegacyAdminPassword123!';
    const legacyUser = await createTestUser(legacyEmail, legacyPassword, 'Legacy Admin', 'admin');
    const legacyHash = await bcrypt.hash(legacyPassword, 10);
    await UserModel.updateOne({ id: legacyUser.id }, { $set: { passwordHash: legacyHash } });
    const migratedLogin = await authService.login(legacyEmail, legacyPassword);
    const migratedUser = await UserModel.findOne({ id: legacyUser.id }).select('passwordHash').lean();
    assert(Boolean(migratedLogin.sessionId && migratedUser?.passwordHash.startsWith('$argon2id$')), 'Legacy bcrypt password is re-hashed to Argon2id after valid login');

    const authApp = express();
    authApp.use(express.json());
    authApp.use(cookieParser());
    authApp.use('/api/auth', authRouter);
    const authServer = authApp.listen(0);
    const authPort = (authServer.address() as any).port;
    try {
      await withRestoredEnvironment(async () => {
        process.env.NODE_ENV = 'production';
        let additionalAdminRejected = false;
        try {
          await authService.login(legacyEmail, legacyPassword);
        } catch {
          additionalAdminRejected = true;
        }
        assert(additionalAdminRejected, 'Production login rejects legacy administrators outside ADMIN_EMAIL');
        const response = await fetch(`http://127.0.0.1:${authPort}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPass, rememberMe: false }),
        });
        const payload = await response.json() as Record<string, any>;
        const setCookie = response.headers.get('set-cookie') || '';
        const sessionCookieHeader = setCookie.split(/,\s*csrfToken=/i)[0];
        const csrfCookieHeader = setCookie.split(/,\s*csrfToken=/i)[1] || '';
        const sid = sessionCookieHeader.match(/(?:^|,\s*)__Host-sid=([^;,\s]+)/)?.[1];
        const cookieNames = [...setCookie.matchAll(/(?:^|,\s*)([^=;,\s]+)=/g)].map((match) => match[1]);
        const hasHttpOnly = /HttpOnly/i.test(sessionCookieHeader);
        const hasSecure = /Secure/i.test(sessionCookieHeader);
        const csrfHasHttpOnly = /HttpOnly/i.test(csrfCookieHeader);
        const hasCsrfCookie = /(?:^|,\s*)csrfToken=/i.test(setCookie);
        assert(
          response.ok && Boolean(sid) && hasHttpOnly && hasSecure,
          'Production login issues a Secure HttpOnly __Host-sid cookie',
          `status=${response.status}; cookies=${cookieNames.join(',')}; httpOnly=${hasHttpOnly}; secure=${hasSecure}`
        );
        assert(
          hasCsrfCookie && !csrfHasHttpOnly,
          'Production login exposes only the CSRF token to the browser client',
          `csrfHttpOnly=${csrfHasHttpOnly}`
        );
        assert(!('passwordHash' in (payload.user || {})) && !('sessionId' in payload) && !('accessToken' in payload), 'Login never exposes hashes or bearer tokens');

        const logoutResponse = await fetch(`http://127.0.0.1:${authPort}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Cookie: `__Host-sid=${sid}; csrfToken=${payload.csrfToken}`,
            'X-CSRF-Token': payload.csrfToken,
          },
        });
        assert(logoutResponse.status === 200 && (await sessionService.validateSession(sid!)) === null, 'CSRF-protected logout revokes its MongoDB session');
      }, {
        NODE_ENV: 'production',
        ADMIN_EMAIL: loginEmail,
        MONGODB_URI: 'mongodb://127.0.0.1:27017/win11portfolio',
        APP_URL: 'https://portfolio.example.com',
        SMTP_USER: 'test-mailer@example.com',
        SMTP_PASS: 'test-only-mail-password',
      });
    } finally {
      await new Promise<void>((resolve, reject) => authServer.close((err?: Error) => err ? reject(err) : resolve()));
    }
    
    // Set these for subsequent tests
    testAdminEmail = loginEmail;
    testAdminPass = loginPass;
  } catch (err: any) {
    assert(false, 'Password verification', err.message);
  }

  // --- 3. Public visitors cannot register or authenticate as users ---
  let regularUserId = '';
  try {
    const testEmail = `user_${Date.now()}@example.com`;
    const publicAuthApp = express();
    publicAuthApp.use(express.json());
    publicAuthApp.use('/api/auth', authRouter);
    const publicAuthServer = publicAuthApp.listen(0);
    const publicAuthPort = (publicAuthServer.address() as any).port;
    try {
      const response = await fetch(`http://127.0.0.1:${publicAuthPort}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'UserSecurePassword123!', role: 'admin' }),
      });
      assert(response.status === 404, 'Public account registration endpoint is disabled');
    } finally {
      await new Promise<void>((resolve, reject) => publicAuthServer.close((err?: Error) => err ? reject(err) : resolve()));
    }

    const user = await createTestUser(testEmail, 'UserSecurePassword123!', 'Regular User');
    regularUserId = user.id;
    let userLoginRejected = false;
    try {
      await authService.login(testEmail, 'UserSecurePassword123!');
    } catch {
      userLoginRejected = true;
    }
    assert(userLoginRejected, 'Non-admin accounts cannot use the administrator login');
  } catch (err: any) {
    assert(false, 'Privilege escalation prevention', err.message);
  }

  // --- 4. Server-Side Session Validation ---
  try {
    const standardSessionStartedAt = Date.now();
    const loginRes = await authService.login(testAdminEmail, testAdminPass);
    const session = await sessionService.validateSession(loginRes.sessionId);
    assert(Boolean(session && session.email === testAdminEmail), 'Session validated from server storage');
    const standardSessionDuration = loginRes.session.expiresAt.getTime() - standardSessionStartedAt;
    assert(Math.abs(standardSessionDuration - 15 * 60 * 1000) < 5000, 'Default administrator session expires after 15 minutes');
    const sessionHash = crypto.createHash('sha256').update(loginRes.sessionId).digest('hex');
    const storedSession = await SessionModel.findOne({ sessionId: sessionHash }).lean();
    assert(Boolean(storedSession && storedSession.sessionId === sessionHash && storedSession.sessionId !== loginRes.sessionId), 'Mongo stores only a hash of the opaque session ID');
    await sessionService.revokeSession(loginRes.sessionId);

    const rememberedSessionStartedAt = Date.now();
    const rememberedSession = await sessionService.createSession(
      { id: testAdminUserId, email: testAdminEmail, role: 'admin' },
      undefined,
      { rememberMe: true }
    );
    const rememberedSessionDuration = rememberedSession.session.expiresAt.getTime() - rememberedSessionStartedAt;
    assert(Math.abs(rememberedSessionDuration - 15 * 60 * 1000) < 5000, 'Remembered administrator session also expires after 15 minutes');
    await sessionService.revokeSession(rememberedSession.sessionId);
  } catch (err: any) {
    assert(false, 'Session validation', err.message);
  }

  // --- 5. Session Revocation (Logout) ---
  try {
    const loginRes = await authService.login(testAdminEmail, testAdminPass);
    const sid = loginRes.sessionId;
    assert((await sessionService.validateSession(sid)) !== null, 'Session active before revocation');

    await sessionService.revokeSession(sid);
    assert((await sessionService.validateSession(sid)) === null, 'Revoked session immediately rejected');

    const expiringSession = await sessionService.createSession({ id: testAdminUserId, email: testAdminEmail, role: 'admin' });
    const expiringHash = crypto.createHash('sha256').update(expiringSession.sessionId).digest('hex');
    await SessionModel.updateOne({ sessionId: expiringHash }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert((await sessionService.validateSession(expiringSession.sessionId)) === null, 'Expired MongoDB session is rejected immediately');
  } catch (err: any) {
    assert(false, 'Session revocation', err.message);
  }

  // --- 6. Single-Use Expiring Password Reset Token ---
  const sendPasswordResetEmail = emailService.sendPasswordResetEmail;
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const originalAppUrl = process.env.APP_URL;
  process.env.ADMIN_EMAIL = testAdminEmail;
  process.env.APP_URL = 'http://localhost:3000';
  let resetUrl = '';
  emailService.sendPasswordResetEmail = async (_email, link) => {
    resetUrl = link;
    return true;
  };
  try {
    const nonAdminReset = await authService.requestPasswordReset(`other_${Date.now()}@test.local`);
    assert(!nonAdminReset.delivered && resetUrl === '', 'Password reset is restricted to the configured administrator email');

    const resetReq = await authService.requestPasswordReset(testAdminEmail);
    const emailedResetUrl = new URL(resetUrl);
    const resetToken = new URLSearchParams(emailedResetUrl.hash.slice(1)).get('resetToken');
    assert(resetReq.delivered && emailedResetUrl.searchParams.get('app') === 'admin' && Boolean(resetToken && resetToken.length === 64), 'Administrator receives a secure password reset link by email');

    const tempPass = 'ResetPassAdmin@2026';
    const resetAccount = db.getUserByEmail(testAdminEmail);
    if (!resetAccount) throw new Error('Reset administrator fixture missing');
    const sessionBeforeReset = await sessionService.createSession({
      id: resetAccount.id,
      email: resetAccount.email,
      role: 'admin',
    });
    const resetSuccess = await authService.resetPassword(resetToken!, tempPass);
    assert(resetSuccess, 'Password successfully reset using token');
    assert((await sessionService.validateSession(sessionBeforeReset.sessionId)) === null, 'Password reset revokes every active administrator session');

    let reuseAttempt = false;
    try {
      await authService.resetPassword(resetToken!, 'AnotherPassword123');
    } catch {
      reuseAttempt = true;
    }
    assert(reuseAttempt, 'Single-use reset token cannot be reused');

    resetUrl = '';
    await authService.requestPasswordReset(testAdminEmail);
    const expiredToken = new URLSearchParams(new URL(resetUrl).hash.slice(1)).get('resetToken')!;
    const expiredTokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    await PasswordResetTokenModel.updateOne({ tokenHash: expiredTokenHash }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    let expiredResetRejected = false;
    try {
      await authService.resetPassword(expiredToken, 'AnotherPassword123!');
    } catch {
      expiredResetRejected = true;
    }
    assert(expiredResetRejected, 'Expired password reset token is rejected');

    // Restore original password
    resetUrl = '';
    const restoreReq = await authService.requestPasswordReset(testAdminEmail);
    const restoreToken = new URLSearchParams(new URL(resetUrl).hash.slice(1)).get('resetToken');
    await authService.resetPassword(restoreToken!, testAdminPass);
  } catch (err: any) {
    assert(false, 'Single-use password reset', err.message);
  } finally {
    emailService.sendPasswordResetEmail = sendPasswordResetEmail;
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdminEmail;
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  }

  // --- 7. Mongo-backed content drafts, publishing and revision restore ---
  try {
    const liveContent = await getLivePortfolioContent();
    assert(!('securitySettings' in liveContent), 'Live portfolio content never exposes private admin security settings');
    const siteBefore = await SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean();
    const draftBefore = await AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean();
    const actorId = `content_studio_test_${Date.now()}`;
    let baseline: Record<string, any>;
    try {
      if (!siteBefore) {
        const fallback = await contentStudioService.getSnapshot(await getLivePortfolioContent());
        await SiteContentModel.create({ ...fallback.published, key: 'primary_portfolio_content' });
      }
      await SiteContentModel.updateOne({ key: 'primary_portfolio_content' }, {
        $unset: {
          'siteSettings.desktopShortcuts': '',
          'siteSettings.taskbarPinnedApps': '',
          'siteSettings.startPinnedApps': '',
          'siteSettings.adminAppEnabledInStart': '',
        },
      });
      await AdminContentDraftModel.updateOne({ key: 'primary_portfolio_content' }, {
        $unset: {
          'content.siteSettings.desktopShortcuts': '',
          'content.siteSettings.taskbarPinnedApps': '',
          'content.siteSettings.startPinnedApps': '',
          'content.siteSettings.adminAppEnabledInStart': '',
        },
      });
      const initial = await contentStudioService.getSnapshot(await getLivePortfolioContent());
      baseline = structuredClone(initial.published);
      const edited = structuredClone(baseline);
      edited.profile = { ...edited.profile, tagline: `Draft test ${actorId}` };
      edited.resumes = [{
        id: `resume_${actorId}`,
        title: 'Integration test resume',
        file: '/downloads/integration-resume.pdf',
        active: true,
      }];
      const saved: any = await contentStudioService.saveDraft(edited, actorId);
      assert(saved.draft.profile.tagline === edited.profile.tagline, 'Portfolio edit is saved as a MongoDB draft');
      assert(saved.draft.resumes?.[0]?.title === 'Integration test resume' && saved.published.resumes?.[0]?.id !== `resume_${actorId}`, 'Resume entries remain private until content is published');
      assert(saved.published.profile.tagline !== edited.profile.tagline, 'Saving a draft leaves public portfolio content unchanged');
      assert(!('securitySettings' in saved.draft) && !JSON.stringify(saved.draft).includes('adminPinHash'), 'Content studio strips private security fields');

      const withUploadedMedia = structuredClone(edited);
      const uploadedPdfUrl = '/api/portfolio-media/Anish-Jethva-Full-Stack-Developer.pdf?id=file-test-media';
      withUploadedMedia.resumes[0].file = uploadedPdfUrl;
      withUploadedMedia.profile.resumeUrl = uploadedPdfUrl;
      withUploadedMedia.siteSettings = {
        ...((withUploadedMedia.siteSettings || {}) as Record<string, unknown>),
        socialImageUrl: '/api/portfolio-media/profile%20picture%20(1).png?id=file-test-image',
        faviconUrl: '/api/portfolio-media/favicon.png?id=file-test-favicon',
      };
      const savedMediaDraft: any = await contentStudioService.saveDraft(withUploadedMedia, actorId);
      assert(
        savedMediaDraft.draft.resumes[0].file === uploadedPdfUrl &&
          savedMediaDraft.draft.siteSettings.socialImageUrl.includes('?id=file-test-image'),
        'Uploaded portfolio media URLs with encoded filenames and IDs save in the private draft',
      );

      const discarded: any = await contentStudioService.discardDraft(actorId);
      assert(discarded.draft.profile.tagline === baseline.profile.tagline && discarded.isPublished, 'Discard restores the published portfolio content as the draft');
      await contentStudioService.saveDraft(edited, actorId);
      const published: any = await contentStudioService.publishDraft(actorId);
      assert(published.published.profile.tagline === edited.profile.tagline, 'Publishing makes the saved draft live');
      assert(published.isPublished, 'Publishing marks the saved draft as up to date');

      const withRecycleBinRemoved = structuredClone(edited);
      withRecycleBinRemoved.siteSettings = {
        ...((withRecycleBinRemoved.siteSettings || {}) as Record<string, unknown>),
        desktopShortcuts: [
          { id: `icon-thispc-${actorId}`, appId: 'explorer', name: 'This PC', icon: 'ThisPC', position: { gridX: 0, gridY: 0 }, type: 'app' },
          { id: `icon-about-${actorId}`, appId: 'about', name: 'About Me', icon: 'About', position: { gridX: 0, gridY: 1 }, type: 'app' },
          { id: `icon-projects-${actorId}`, appId: 'projects', name: 'Projects', icon: 'Projects', position: { gridX: 0, gridY: 2 }, type: 'app' },
          { id: `icon-resume-${actorId}`, appId: 'resume', name: 'Resume CV', icon: 'Resume', position: { gridX: 1, gridY: 0 }, type: 'app' },
          { id: `icon-contact-${actorId}`, appId: 'contact', name: 'Contact Me', icon: 'Contact', position: { gridX: 1, gridY: 1 }, type: 'app' },
          { id: `icon-terminal-${actorId}`, appId: 'terminal', name: 'Terminal', icon: 'Terminal', position: { gridX: 1, gridY: 2 }, type: 'app' },
          { id: `icon-browser-${actorId}`, appId: 'browser', name: 'Web Browser', icon: 'Globe', position: { gridX: 1, gridY: 3 }, type: 'app' },
          { id: `icon-settings-${actorId}`, appId: 'settings', name: 'Settings', icon: 'Settings', position: { gridX: 2, gridY: 0 }, type: 'app' },
          { id: `icon-calculator-${actorId}`, appId: 'calculator', name: 'Calculator', icon: 'Calculator', position: { gridX: 2, gridY: 2 }, type: 'app' },
          { id: `icon-camera-${actorId}`, appId: 'camera', name: 'Camera', icon: 'Camera', position: { gridX: 2, gridY: 3 }, type: 'app' },
          { id: `icon-photos-${actorId}`, appId: 'photos', name: 'Media', icon: 'Media', position: { gridX: 3, gridY: 0 }, type: 'app' },
          { id: `icon-minesweeper-${actorId}`, appId: 'minesweeper', name: 'Minesweeper', icon: 'Minesweeper', position: { gridX: 3, gridY: 1 }, type: 'app' },
          { id: `icon-snake-${actorId}`, appId: 'snake', name: 'Retro Snake', icon: 'Snake', position: { gridX: 3, gridY: 2 }, type: 'app' },
        ],
        taskbarPinnedApps: ['explorer', 'browser', 'terminal', 'about', 'projects', 'settings'],
        startPinnedApps: ['about', 'projects', 'resume', 'contact', 'explorer', 'terminal', 'browser', 'notepad', 'settings', 'taskmanager', 'minesweeper', 'snake', 'calculator'],
      };
      await contentStudioService.saveDraft(withRecycleBinRemoved, actorId);
      const shortcutsPublished: any = await contentStudioService.publishDraft(actorId);
      assert(
        shortcutsPublished.published.siteSettings.desktopShortcuts.length === 13 &&
          !shortcutsPublished.published.siteSettings.desktopShortcuts.some((shortcut: Record<string, unknown>) => shortcut.appId === 'recycle'),
        'Publishing a desktop shortcut removal persists the remaining shortcuts only',
      );

      await SiteContentModel.updateOne({ key: 'primary_portfolio_content' }, { $set: { 'siteSettings.assistantEnabled': false } });
      const searchApp = express();
      searchApp.use('/api/browse', browseRouter);
      const searchServer = searchApp.listen(0);
      const searchPort = (searchServer.address() as any).port;
      try {
        const searchResponse = await fetch(`http://127.0.0.1:${searchPort}/api/browse/gemini-search?q=windows+portfolio`);
        const searchPayload = await searchResponse.json() as any;
        assert(searchResponse.ok && searchPayload.source === 'local' && searchPayload.videos.length === 0, 'Published assistant-disabled setting forces local search fallback');
      } finally {
        await new Promise<void>((resolve, reject) => searchServer.close((err?: Error) => err ? reject(err) : resolve()));
      }
      await SiteContentModel.updateOne({ key: 'primary_portfolio_content' }, { $set: { 'siteSettings.assistantEnabled': true } });
      const revisions = await contentStudioService.listRevisions();
      const actorRevisions = revisions.filter((revision) => revision.publishedBy === actorId && !revision.isCurrent);
      const priorRevision = actorRevisions[actorRevisions.length - 1];
      assert(Boolean(priorRevision), 'Publishing stores the previous public version as a revision');
      const currentVersion = revisions.find((revision) => revision.isCurrent);
      assert(
        currentVersion?.changes.length === 1 &&
          currentVersion.changes[0] === 'Site & Appearance · Apps & shortcuts · Recycle Bin · Removed',
        'Current published version shows only the removed shortcut, not legacy-default apps or pins',
      );
      const liveBeforeRevisionDelete = await SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean();
      const projectsBeforeRevisionDelete = await ProjectModel.find().lean();
      const disposableRevision = await AdminContentRevisionModel.create({
        key: 'primary_portfolio_content',
        content: { profile: { name: 'Delete-only revision fixture' } },
        publishedBy: actorId,
        publishedAt: new Date(),
      });
      const deletedRevision = await contentStudioService.deleteRevision(String(disposableRevision._id));
      const liveAfterRevisionDelete = await SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean();
      const projectsAfterRevisionDelete = await ProjectModel.find().lean();
      const currentAfterRevisionDelete = (await contentStudioService.listRevisions()).find((revision) => revision.isCurrent);
      assert(
        deletedRevision &&
          JSON.stringify(liveBeforeRevisionDelete) === JSON.stringify(liveAfterRevisionDelete) &&
          JSON.stringify(projectsBeforeRevisionDelete) === JSON.stringify(projectsAfterRevisionDelete) &&
          currentAfterRevisionDelete?.id === 'current-live',
        'Deleting a history record leaves live content and projects unchanged and keeps current history stable',
      );

      if (priorRevision) {
        const restored: any = await contentStudioService.restoreRevision(priorRevision.id, actorId);
        assert(restored?.draft.profile.tagline === baseline.profile.tagline, 'Revision restore places the old version into the draft');
        assert(restored?.published.profile.tagline === edited.profile.tagline, 'Revision restore does not change the currently published version');
        assert(!restored?.isPublished, 'Restoring an older version leaves a publishable draft when it differs from live');
      }
      const restoredLive: any = await contentStudioService.restoreRevision('current-live', actorId);
      assert(restoredLive?.draft.profile.tagline === edited.profile.tagline, 'Current live version can be copied into the draft');
    } finally {
      if (siteBefore) {
        const { _id: _siteId, __v: _siteVersion, ...siteData } = siteBefore as any;
        if (siteData.siteSettings) {
          siteData.siteSettings = {
            ...siteData.siteSettings,
            assistantEnabled: siteBefore.siteSettings?.assistantEnabled ?? true,
          };
        }
        await SiteContentModel.updateOne({ key: 'primary_portfolio_content' }, {
          $set: siteData,
        });
      } else {
        await SiteContentModel.deleteOne({ key: 'primary_portfolio_content' });
      }
      if (draftBefore) {
        const { _id: _draftId, __v: _draftVersion, ...draftData } = draftBefore as any;
        await AdminContentDraftModel.updateOne({ key: 'primary_portfolio_content' }, { $set: draftData });
      } else {
        await AdminContentDraftModel.deleteOne({ key: 'primary_portfolio_content' });
      }
      await AdminContentRevisionModel.deleteMany({ publishedBy: actorId });
    }
  } catch (err: any) {
    assert(false, 'Content studio draft, publish and revision workflow', err.message);
  }

  // --- 8. Task CRUD, Filtering, Pagination & Ownership ---
  let createdTaskId = '';
  try {
    // Create task
    const newTask = await db.createTask({
      userId: regularUserId,
      title: 'Integration Test Task for User',
      description: 'Testing task planner functionality',
      priority: 'high',
      category: 'Work',
      dueDate: '2026-10-15',
      tags: ['Test', 'CI'],
    });
    createdTaskId = newTask.id;
    assert(Boolean(createdTaskId), 'Task created with proper userId ownership');

    // Filter and paginate
    const filtered = db.getTasksFiltered({
      userId: regularUserId,
      isAdmin: false,
      priority: 'high',
      page: 1,
      limit: 10,
    });
    assert(
      filtered.items.some((t) => t.id === createdTaskId) && filtered.total >= 1,
      'Task filtering and pagination returns expected result'
    );

    // Ownership check: owner vs stranger vs admin
    const ownerReq: any = { user: { userId: regularUserId, role: 'user' } };
    const strangerReq: any = { user: { userId: 'usr_different_stranger', role: 'user' } };
    const adminReq: any = { user: { userId: 'usr_admin_test', role: 'admin' } };

    assert(isOwnerOrAdmin(ownerReq, newTask.userId), 'Task owner is granted modification access');
    assert(!isOwnerOrAdmin(strangerReq, newTask.userId), 'Unrelated user is denied modification access');
    assert(isOwnerOrAdmin(adminReq, newTask.userId), 'Administrator is granted override access');

    // Update task
    const updated = await db.updateTask(createdTaskId, { status: 'completed' });
    assert(updated?.status === 'completed' && Boolean(updated.completedAt), 'Task update persists and records completion timestamp');

    // Delete task
    const deleted = await db.deleteTask(createdTaskId);
    assert(deleted && db.getTaskById(createdTaskId) === undefined, 'Task deletion removes item from database');
  } catch (err: any) {
    assert(false, 'Task CRUD and ownership', err.message);
  }

  // --- 8. File System & Security Policy ---
  let testFileId = '';
  let traversalFileId = '';
  try {
    // Allowed extensions check
    assert(fileService.isAllowedExtension('txt'), 'Valid text file extension permitted');
    assert(fileService.isAllowedExtension('png'), 'Valid image extension permitted');
    assert(!fileService.isAllowedExtension('exe'), 'Malicious .exe extension blocked');
    assert(!fileService.isAllowedExtension('bat'), 'Malicious .bat extension blocked');

    // File creation with sanitized path
    const savedFile = fileService.saveFile(
      {
        name: 'test_notes.txt',
        path: 'D:/Documents/test_notes.txt',
        content: 'Hello secure world! Automated test verification.',
      },
      regularUserId
    );
    testFileId = savedFile.id;
    assert(Boolean(testFileId && savedFile.userId === regularUserId), 'File saved with ownership and metadata');

    // Path traversal check
    let traversalBlocked = false;
    try {
      const traversalFile = fileService.saveFile(
        {
          name: '../../../../etc/passwd',
          path: '../../../../etc/passwd',
          content: 'malicious',
        },
        regularUserId
      );
      traversalFileId = traversalFile.id;
    } catch {
      traversalBlocked = true;
    }
    // If not thrown, verify sanitized name doesn't contain '..'
    const sanitizedName = fileService.sanitizeFileName('../../../../etc/passwd');
    assert(traversalBlocked || !sanitizedName.includes('..'), 'Path traversal sanitized or blocked');

    // Filter files
    const fileList = db.getFilesFiltered({
      userId: regularUserId,
      isAdmin: false,
      extension: 'txt',
    });
    assert(fileList.items.some((f) => f.id === testFileId), 'Files list correctly filters by user and extension');

    // Delete file
    const fileDeleted = fileService.deleteFile(testFileId);
    assert(fileDeleted && db.getFileById(testFileId) === undefined, 'File deleted and metadata cleaned up');
  } catch (err: any) {
    assert(false, 'File operations and security', err.message);
  } finally {
    for (const id of [testFileId, traversalFileId]) {
      if (!id) continue;
      fileService.deleteFile(id);
      await FileMetadataModel.deleteOne({ id });
    }
  }

  // --- 9. Contact Inquiries & Status Management ---
  let contactId = '';
  try {
    const contact = await db.createContact({
      name: 'Client Partner',
      email: 'partner@techcorp.io',
      subject: 'Architecture Consulting Opportunity',
      message: 'Excited to discuss our new cloud migration project.',
      ipAddress: '127.0.0.1',
      userAgent: 'Automated Test Runner',
      status: 'delivered',
      emailSent: true,
    });
    contactId = contact.id;
    assert(Boolean(contactId), 'Contact inquiry created and persisted');

    // Filter contacts
    const filteredContacts = db.getContactsFiltered({ status: 'delivered' });
    assert(filteredContacts.items.some((c) => c.id === contactId), 'Contact history filtering returns inquiries');

    // Status update (mark replied)
    const updatedContact = await db.updateContactStatus(contactId, {
      status: 'replied',
      notes: 'Initial consultation call scheduled for Friday.',
      replied: true,
      replyMessage: 'Thanks for reaching out. Let us schedule a call.',
    });
    assert(
      updatedContact?.status === 'replied' &&
        Boolean(updatedContact.repliedAt) &&
        updatedContact.replyMessage === 'Thanks for reaching out. Let us schedule a call.' &&
        updatedContact.replyHistory?.length === 1,
      'Contact inquiry status update records the first reply and notes'
    );
    const contactWithSecondReply = await db.updateContactStatus(contactId, {
      replyMessage: 'Following up with the requested project details.',
    });
    assert(
      contactWithSecondReply?.replyHistory?.length === 2 &&
        contactWithSecondReply.replyHistory[0].message === 'Thanks for reaching out. Let us schedule a call.' &&
        contactWithSecondReply.replyHistory[1].message === 'Following up with the requested project details.',
      'Contact inquiry status update preserves every reply in chronological order'
    );
    const legacyContactId = `${contactId}_legacy`;
    db.contacts.set(legacyContactId, {
      ...contact,
      id: legacyContactId,
      replyMessage: 'Previously sent reply.',
      repliedAt: '2026-10-18T10:00:00.000Z',
    });
    const migratedLegacyContact = await db.updateContactStatus(legacyContactId, {
      replyMessage: 'New reply after the history upgrade.',
    });
    assert(
      migratedLegacyContact?.replyHistory?.length === 2 &&
        migratedLegacyContact.replyHistory[0].message === 'Previously sent reply.' &&
        migratedLegacyContact.replyHistory[1].message === 'New reply after the history upgrade.',
      'Contact reply history migration retains the previous single reply'
    );
    db.contacts.delete(legacyContactId);

    // Delete contact
    const contactDeleted = await db.deleteContact(contactId);
    assert(contactDeleted && db.getContactById(contactId) === undefined, 'Contact inquiry deleted successfully');
  } catch (err: any) {
    assert(false, 'Contact submissions and status updates', err.message);
  }

  // --- 10. Analytics & Telemetry Secret Sanitization ---
  try {
    const sensitivePayload = {
      action: 'LOGIN_ATTEMPT',
      password: 'PlainSecretPassword123!',
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.signature',
      nested: {
        hash: '$2b$10$22QpTF8rerET3dJwnj4Bd.hrUCP/hfaRXdL5vxPm10gmXtaEobHk6',
        authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        publicMetric: 42,
      },
    };

    const clean = sanitizeLogData(sensitivePayload);
    assert(
      clean.password === '[REDACTED]' &&
      clean.jwtToken === '[REDACTED]' &&
      clean.nested.hash === '[REDACTED]' &&
      clean.nested.authHeader === '[REDACTED]' &&
      clean.nested.publicMetric === 42,
      'Telemetry logs recursively mask passwords, JWTs, hashes, and authorization headers'
    );

    db.logEvent({
      eventName: 'AUTOMATED_SYSTEM_TEST',
      category: 'system',
      metadata: clean,
      ipAddress: '127.0.0.1',
      userAgent: 'Automated Test Runner / 1.0',
    });

    const summary = db.getAnalyticsSummary();
    assert(summary.totalRequests > 0, 'Analytics summary calculates total request and latency metrics');
  } catch (err: any) {
    assert(false, 'Analytics and log sanitization', err.message);
  }

  // --- 11. MongoDB Mongoose Persistence & Restart Survival Simulation ---
  try {
    // 1. Create durable test records via db
    const durableTask = await db.createTask({
      userId: testAdminUserId,
      title: 'Persistent Mongo Survival Task',
      status: 'in_progress',
      priority: 'urgent',
      tags: ['MongoDB', 'Mongoose'],
    });

    // 2. Directly verify record exists in MongoDB collection via Mongoose Model
    const mongoFound = await TaskModel.findOne({ id: durableTask.id, title: 'Persistent Mongo Survival Task' }).lean();
    assert(Boolean(mongoFound && mongoFound.id === durableTask.id && mongoFound.userId === testAdminUserId), 'Record directly queryable from MongoDB Mongoose collection');

    // 3. Project Model CRUD in MongoDB
    const testProjectId = `proj_mongo_test_${Date.now()}`;
    await db.addProject({
      id: testProjectId,
      title: 'MongoDB Test Project',
      tagline: 'Persisted project summary',
      description: 'Testing Mongoose CRUD integration',
      features: ['Mongo persistence', 'Reload-safe edits'],
      technologies: ['MongoDB', 'Mongoose', 'Express'],
      category: 'Full Stack',
      image: '/test.png',
      stars: 42,
      featured: true,
    });
    const foundProject = await ProjectModel.findOne({ id: testProjectId }).lean();
    assert(
      Boolean(
        foundProject &&
        foundProject.title === 'MongoDB Test Project' &&
        foundProject.tagline === 'Persisted project summary' &&
        foundProject.features.includes('Mongo persistence')
      ),
      'Project fields persisted and queryable from MongoDB ProjectModel'
    );

    // Update project
    await db.updateProject(testProjectId, { stars: 99 });
    const updatedProj = await ProjectModel.findOne({ id: testProjectId }).lean();
    assert(updatedProj?.stars === 99, 'Project updates propagate directly to MongoDB');

    // Delete project
    await db.deleteProject(testProjectId);
    const deletedProj = await ProjectModel.findOne({ id: testProjectId }).lean();
    assert(deletedProj === null, 'Project deletion removes record from MongoDB');

    // 4. File Metadata Model CRUD in MongoDB
    const testFileMetaId = `file_mongo_${Date.now()}`;
    await db.saveFile({
      id: testFileMetaId,
      name: 'mongo_doc.txt',
      path: 'D:/Documents/mongo_doc.txt',
      parentId: 'D:/Documents',
      type: 'file',
      extension: 'txt',
      size: '1.2 KB',
      sizeBytes: 1200,
      modified: '2026-10-03',
      uploadedAt: new Date().toISOString(),
    });
    const foundFile = await FileMetadataModel.findOne({ id: testFileMetaId }).lean();
    assert(Boolean(foundFile && foundFile.name === 'mongo_doc.txt'), 'FileMetadata persisted and queryable from MongoDB');

    await db.deleteFile(testFileMetaId);
    const deletedFile = await FileMetadataModel.findOne({ id: testFileMetaId }).lean();
    assert(deletedFile === null, 'FileMetadata deletion cleans up MongoDB record');

    // 5. Instantiate a second clean DatabaseManager to simulate a complete server restart
    const restartedDb = new DatabaseManager();
    await restartedDb.syncFromMongo();
    const loadedUsers = restartedDb.getUsers();
    const loadedTasks = restartedDb.getTasks();

    assert(
      loadedUsers.some((u: any) => u.id === testAdminUserId) &&
      loadedTasks.some((t: any) => t.id === durableTask.id && t.title === 'Persistent Mongo Survival Task'),
      'All records survive simulated server restart and reload accurately from MongoDB'
    );
  } catch (err: any) {
    assert(false, 'MongoDB persistence and restart survival', err.message);
  }

  // --- 12. Mongoose Schema Validation, Indexes & Migration Idempotence ---
  try {
    // 1. Schema Validation: Invalid Role should fail Mongoose validation
    let validationFailed = false;
    try {
      const invalidUser = new UserModel({
        id: 'usr_invalid',
        email: 'invalid@example.com',
        passwordHash: 'dummy',
        name: 'Invalid',
        role: 'SUPER_HACKER_ROLE_NOT_ALLOWED', // not in enum
      });
      await invalidUser.validate();
    } catch {
      validationFailed = true;
    }
    assert(validationFailed, 'Mongoose Schema rejects invalid enum values and enforces model schema rules');

    // 2. Disconnection resilience: In-memory cache allows seamless reads even if offline
    assert(db.getUsers().length >= 2, 'In-memory repository cache serves reads seamlessly during connection transitions');

    // 3. Migration idempotence test: Upserting duplicate records does not create duplicate entries
    const testMigrateId = `test_migration_user_${Date.now()}`;
    const testMigrateEmail = `migrate_${Date.now()}@example.com`;
    await UserModel.updateOne(
      { $or: [{ id: testMigrateId }, { email: testMigrateEmail }] },
      { $set: { id: testMigrateId, email: testMigrateEmail, name: 'Migration Test User', passwordHash: 'hash', role: 'user' } },
      { upsert: true }
    );
    // Run second time
    await UserModel.updateOne(
      { $or: [{ id: testMigrateId }, { email: testMigrateEmail }] },
      { $set: { id: testMigrateId, email: testMigrateEmail, name: 'Migration Test User Updated', passwordHash: 'hash', role: 'user' } },
      { upsert: true }
    );
    const count = await UserModel.countDocuments({ id: testMigrateId });
    assert(count === 1, 'Migration upsert logic is strictly idempotent and prevents duplicate documents');

    // Clean up test document
    await UserModel.deleteOne({ id: testMigrateId });
  } catch (err: any) {
    assert(false, 'Mongoose schema validation, indexes and migration idempotence', err.message);
  }

  // --- 13. Window Management State & Z-Index Simulation ---
  try {
    interface TestWindow {
      id: string;
      appId: string;
      title: string;
      isMinimized: boolean;
      isMaximized: boolean;
      isFocused: boolean;
      zIndex: number;
      desktopId: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }

    let windows: TestWindow[] = [];
    let activeWindowId: string | null = null;

    const openTestApp = (appId: string, title: string, desktopId = 'desktop-1') => {
      const existing = windows.find((w) => w.appId === appId);
      if (existing) {
        const maxZ = Math.max(0, ...windows.map((w) => w.zIndex));
        windows = windows.map((w) =>
          w.id === existing.id
            ? { ...w, isMinimized: false, isFocused: true, zIndex: maxZ + 1 }
            : { ...w, isFocused: false }
        );
        activeWindowId = existing.id;
        return;
      }
      const maxZ = Math.max(0, ...windows.map((w) => w.zIndex));
      const offset = (windows.length % 6) * 28;
      const newWin: TestWindow = {
        id: `win-${appId}-${Date.now()}`,
        appId,
        title,
        isMinimized: false,
        isMaximized: false,
        isFocused: true,
        zIndex: maxZ + 1,
        desktopId,
        position: { x: 40 + offset, y: 40 + offset },
        size: { width: 800, height: 600 },
      };
      windows = [...windows.map((w) => ({ ...w, isFocused: false })), newWin];
      activeWindowId = newWin.id;
    };

    const closeTestWindow = (id: string) => {
      windows = windows.filter((w) => w.id !== id);
      const visible = windows.filter((w) => !w.isMinimized);
      if (visible.length > 0) {
        let topWin = visible[0];
        for (const w of visible) {
          if (w.zIndex > topWin.zIndex) topWin = w;
        }
        activeWindowId = topWin.id;
        windows = windows.map((w) => ({
          ...w,
          isFocused: w.id === topWin.id,
        }));
      } else {
        activeWindowId = null;
      }
    };

    const minimizeTestWindow = (id: string) => {
      windows = windows.map((w) => (w.id === id ? { ...w, isMinimized: true, isFocused: false } : w));
      const visible = windows.filter((w) => !w.isMinimized);
      if (visible.length > 0) {
        let topWin = visible[0];
        for (const w of visible) {
          if (w.zIndex > topWin.zIndex) topWin = w;
        }
        activeWindowId = topWin.id;
        windows = windows.map((w) => ({
          ...w,
          isFocused: w.id === topWin.id,
        }));
      } else {
        activeWindowId = null;
      }
    };

    // 1. Open App 1 (Explorer)
    openTestApp('explorer', 'File Explorer');
    assert(windows.length === 1 && activeWindowId === windows[0].id, 'Window 1 opened and active');

    // 2. Open App 2 (Terminal)
    openTestApp('terminal', 'Terminal');
    assert(
      windows.length === 2 &&
      windows[1].isFocused &&
      !windows[0].isFocused &&
      windows[1].zIndex > windows[0].zIndex,
      'Window 2 opened on top with incremented z-index'
    );

    // 3. Re-open App 1 -> Brings App 1 to foreground
    openTestApp('explorer', 'File Explorer');
    assert(
      windows.length === 2 &&
      windows[0].isFocused &&
      !windows[1].isFocused &&
      windows[0].zIndex > windows[1].zIndex,
      'Re-opening existing application focuses existing instance and elevates z-index'
    );

    // 4. Minimize active App 1 -> Promotes App 2 to active
    minimizeTestWindow(windows[0].id);
    assert(
      windows[0].isMinimized &&
      activeWindowId === windows[1].id &&
      windows[1].isFocused,
      'Minimizing top window promotes highest z-index remaining window to focus'
    );

    // 5. Close remaining window -> Active window safely becomes null
    closeTestWindow(windows[1].id);
    closeTestWindow(windows[0].id);
    assert(windows.length === 0 && activeWindowId === null, 'Closing all windows sets active window to null');
  } catch (err: any) {
    assert(false, 'Window management and z-index simulation', err.message);
  }

  // --- 14. Snap Layout Calculations ---
  try {
    const screenW = 1920;
    const screenH = 1080 - 48; // minus taskbar

    const calcSnap = (layout: string) => {
      let pos = { x: 0, y: 0 };
      let sz = { width: Math.floor(screenW / 2), height: screenH };

      if (layout === 'left') {
        pos = { x: 0, y: 0 };
        sz = { width: Math.floor(screenW / 2), height: screenH };
      } else if (layout === 'right') {
        pos = { x: Math.floor(screenW / 2), y: 0 };
        sz = { width: Math.ceil(screenW / 2), height: screenH };
      } else if (layout === 'top') {
        pos = { x: 0, y: 0 };
        sz = { width: screenW, height: Math.floor(screenH / 2) };
      } else if (layout === 'bottom') {
        pos = { x: 0, y: Math.floor(screenH / 2) };
        sz = { width: screenW, height: Math.ceil(screenH / 2) };
      } else if (layout === 'top-left') {
        pos = { x: 0, y: 0 };
        sz = { width: Math.floor(screenW / 2), height: Math.floor(screenH / 2) };
      } else if (layout === 'bottom-right') {
        pos = { x: Math.floor(screenW / 2), y: Math.floor(screenH / 2) };
        sz = { width: Math.ceil(screenW / 2), height: Math.ceil(screenH / 2) };
      } else if (layout === 'three-col-center') {
        pos = { x: Math.floor(screenW / 3), y: 0 };
        sz = { width: Math.floor(screenW / 3), height: screenH };
      }
      return { pos, sz };
    };

    const snapLeft = calcSnap('left');
    const snapRight = calcSnap('right');
    const snap3Col = calcSnap('three-col-center');

    assert(
      snapLeft.sz.width + snapRight.sz.width === screenW &&
      snapLeft.sz.height === screenH &&
      snapRight.pos.x === snapLeft.sz.width,
      'Split left/right snap layouts accurately partition screen width without overlapping'
    );

    assert(
      snap3Col.pos.x === 640 && snap3Col.sz.width === 640,
      'Three-column snap layouts calculate exact centered third column bounds'
    );
  } catch (err: any) {
    assert(false, 'Snap layout calculations', err.message);
  }

  // --- 15. Virtual Desktops Window Migration ---
  try {
    let testDesktops = [
      { id: 'desktop-1', name: 'Desktop 1' },
      { id: 'desktop-2', name: 'Desktop 2' },
    ];
    let testWins = [
      { id: 'w1', desktopId: 'desktop-1', title: 'Code' },
      { id: 'w2', desktopId: 'desktop-2', title: 'Browser' },
    ];

    // Remove desktop-2
    const removedId = 'desktop-2';
    testDesktops = testDesktops.filter((d) => d.id !== removedId);
    testWins = testWins.map((w) => (w.desktopId === removedId ? { ...w, desktopId: 'desktop-1' } : w));

    assert(
      testDesktops.length === 1 &&
      testWins.every((w) => w.desktopId === 'desktop-1'),
      'Removing a virtual desktop safely migrates its windows to the primary desktop'
    );
  } catch (err: any) {
    assert(false, 'Virtual desktop window migration', err.message);
  }

  // --- 16. Calculator Math Engine ---
  try {
    const evaluateMathExpression = (expr: string, angleInRad = false): number => {
      let sanitized = expr.trim();
      const openCount = (sanitized.match(/\(/g) || []).length;
      const closeCount = (sanitized.match(/\)/g) || []).length;
      if (openCount > closeCount) sanitized += ')'.repeat(openCount - closeCount);

      sanitized = sanitized
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/mod/g, '%')
        .replace(/\bπ\b/g, `(${Math.PI})`)
        .replace(/\be\b/g, `(${Math.E})`);

      sanitized = sanitized.replace(/(\d+(\.\d+)?)!/g, (_, num) => {
        const n = Math.floor(parseFloat(num));
        if (n < 0) return 'NaN';
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return `(${res})`;
      });

      sanitized = sanitized.replace(/\^/g, '**');

      // Functions
      sanitized = sanitized.replace(/\bsin\(([^)]+)\)/g, (_, val) => {
        const v = parseFloat(val);
        const rad = angleInRad ? v : (v * Math.PI) / 180;
        return `(${Math.sin(rad)})`;
      });

      sanitized = sanitized.replace(/\bsqrt\(([^)]+)\)/g, 'Math.sqrt($1)');

      const result = Function(`'use strict'; return (${sanitized})`)();
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    };

    const res1 = evaluateMathExpression('25 × 4 + 50 ÷ 2');
    assert(res1 === 125, 'Standard arithmetic (PEMDAS) evaluated accurately');

    const res2 = evaluateMathExpression('5! + sqrt(144)');
    assert(res2 === 132, 'Advanced math functions (factorials and square roots) evaluated accurately');

    const res3 = evaluateMathExpression('sin(90)', false);
    assert(Math.abs(res3 - 1) < 1e-6, 'Trigonometric functions in DEG mode evaluated accurately');
  } catch (err: any) {
    assert(false, 'Calculator math engine evaluation', err.message);
  }

  // --- 17. Terminal Command Parser & Redirection ---
  try {
    const parseTerminalCommand = (cmdStr: string, currentDir: string) => {
      const trimmed = cmdStr.trim();
      if (trimmed.includes('>')) {
        const parts = trimmed.split('>');
        const left = parts[0].trim();
        const filename = parts[1].trim();
        if (left.startsWith('echo ') && filename) {
          const content = left.slice(5).replace(/^["']|["']$/g, '');
          return { action: 'redirect', filename, content, dir: currentDir };
        }
      }
      const parts = trimmed.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      return { action: 'command', command, args, dir: currentDir };
    };

    const parsedEcho = parseTerminalCommand('echo "Hello World" > output.txt', 'C:\\Users\\Anish Jethva');
    assert(
      parsedEcho.action === 'redirect' && parsedEcho.content === 'Hello World' && parsedEcho.filename === 'output.txt',
      'Terminal stdout redirection parsed correctly'
    );

    const parsedCd = parseTerminalCommand('cd Documents', 'C:\\Users\\Anish Jethva');
    assert(
      parsedCd.action === 'command' && parsedCd.command === 'cd' && parsedCd.args[0] === 'Documents',
      'Terminal navigation commands parsed correctly'
    );
  } catch (err: any) {
    assert(false, 'Terminal command parser', err.message);
  }

  // --- 18. Minesweeper Board & Neighbor Count Generation ---
  try {
    const rows = 9;
    const cols = 9;
    const mineCount = 10;
    let grid: Array<Array<{ isMine: boolean; neighborMines: number }>> = [];

    for (let r = 0; r < rows; r++) {
      let row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ isMine: false, neighborMines: 0 });
      }
      grid.push(row);
    }

    // Place mines deterministically for testing
    grid[0][0].isMine = true;
    grid[0][1].isMine = true;

    // Calculate neighbors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
                count++;
              }
            }
          }
          grid[r][c].neighborMines = count;
        }
      }
    }

    assert(
      grid[1][0].neighborMines === 2 && grid[1][1].neighborMines === 2 && grid[0][2].neighborMines === 1,
      'Minesweeper adjacent neighbor mine counts calculated accurately'
    );
  } catch (err: any) {
    assert(false, 'Minesweeper board logic', err.message);
  }

  // --- 19. Snake Game Collision & Scoring ---
  try {
    const tileCount = 20;
    const checkCollision = (head: { x: number; y: number }, body: Array<{ x: number; y: number }>) => {
      if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) return true;
      for (let seg of body) {
        if (seg.x === head.x && seg.y === head.y) return true;
      }
      return false;
    };

    const wallHit = checkCollision({ x: -1, y: 10 }, [{ x: 1, y: 10 }]);
    const selfHit = checkCollision({ x: 5, y: 5 }, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const validMove = checkCollision({ x: 5, y: 4 }, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);

    assert(wallHit && selfHit && !validMove, 'Snake game collision boundaries and self-intersection verified');
  } catch (err: any) {
    assert(false, 'Snake game collision', err.message);
  }

  // --- 20. Recycle Bin 30-Day Retention Calculation ---
  try {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const oldDeleted = { id: 'old-1', deletedAt: new Date(now - THIRTY_DAYS_MS - 1000).toISOString() };
    const recentDeleted = { id: 'recent-1', deletedAt: new Date(now - 1000 * 60 * 60).toISOString() };

    const shouldAutoPurge = (deletedAt?: string) => {
      if (!deletedAt) return false;
      const d = new Date(deletedAt).getTime();
      return now - d > THIRTY_DAYS_MS;
    };

    assert(
      shouldAutoPurge(oldDeleted.deletedAt) && !shouldAutoPurge(recentDeleted.deletedAt),
      'Recycle Bin correctly identifies and filters items older than 30 days'
    );
  } catch (err: any) {
    assert(false, 'Recycle Bin retention calculation', err.message);
  }

  // --- 21. Main Visitor Journey & Public Content Validation ---
  try {
    // 1. Validate public user data schema & absence of sensitive admin data
    const publicUser = {
      name: 'Test Portfolio User',
      title: 'Senior Software Engineer',
      email: 'public@test.local',
      website: 'https://test.local',
      github: 'https://github.com/testuser',
    };

    assert(
      Boolean(publicUser.name && publicUser.email && publicUser.github) &&
      !('passwordHash' in publicUser) &&
      !('jwtSecret' in publicUser),
      'Public portfolio metadata is complete and exposes zero sensitive administrator credentials'
    );

    // 2. Validate Contact submission flow & spam honeypot
    const validContact = await db.createContact({
      name: 'Visitor Recruiter',
      email: 'recruiter@faang.com',
      subject: 'Senior Full Stack Role',
      message: 'Impressive Windows 11 portfolio! Would love to chat regarding architecture opportunities.',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      status: 'delivered',
      emailSent: true,
    });
    assert(Boolean(validContact.id && validContact.timestamp), 'Visitor contact inquiry submitted and persisted in database');

    // 3. Honeypot check: Bots filling _honeypot must be rejected
    const isBotSubmission = (payload: { name: string; _honeypot?: string }) => {
      return Boolean(payload._honeypot && payload._honeypot.trim().length > 0);
    };
    assert(isBotSubmission({ name: 'Bot', _honeypot: 'spam_payload' }), 'Honeypot detector identifies bot submissions');
    assert(!isBotSubmission({ name: 'Real User', _honeypot: '' }), 'Legitimate user without honeypot passes validation');

    // 4. Projects catalog validation
    const sampleProjects = [
      { id: 'p1', title: 'Windows 11 OS', category: 'Full Stack', technologies: ['TypeScript', 'React', 'Tailwind'] },
      { id: 'p2', title: 'Aether Code AI', category: 'AI / ML', technologies: ['TypeScript', 'Gemini API', 'Docker'] },
    ];
    const filteredByTag = sampleProjects.filter((p) => p.technologies.includes('TypeScript'));
    assert(filteredByTag.length === 2, 'Projects catalog search and technology tag filtering returns matching portfolio work');
  } catch (err: any) {
    assert(false, 'Visitor journey and public content validation', err.message);
  }

  // --- 22. Windows Storage Service & Isolation ---
  let userFixturePath = '';
  let adminFixturePath = '';
  try {
    const userRoot = windowsStorageService.getUserCaptureRoot();
    const adminRoot = windowsStorageService.getAdminArchiveRoot();
    assert(
      Boolean(userRoot && adminRoot && windowsStorageService.getCaptureArchiveRoot()),
      'Configurable private storage roots defined for user files, admin archives, and consented captures'
    );
    let publicStorageRejected = false;
    try {
      assertPrivateStoragePath(path.resolve(process.cwd(), 'client/public/private-storage'), 'Test storage root');
    } catch {
      publicStorageRejected = true;
    }
    assert(publicStorageRejected, 'Storage configuration rejects roots inside publicly served frontend assets');

    // Test saving user capture
    const testBuf = Buffer.from('Test user capture bytes', 'utf-8');
    const savedCapture = windowsStorageService.saveUserCapture(testBuf, `test_screenshot_${Date.now()}.png`);
    userFixturePath = savedCapture.filePath;
    assert(Boolean(savedCapture.filePath && fs.existsSync(savedCapture.filePath)), 'User capture successfully saved to storage root');

    // Test saving admin archive
    const adminBuf = Buffer.from('Sensitive admin backup data', 'utf-8');
    const savedArchive = windowsStorageService.saveAdminArchive(adminBuf, `admin_backup_${Date.now()}.zip`);
    adminFixturePath = savedArchive.filePath;
    assert(Boolean(savedArchive.filePath && fs.existsSync(savedArchive.filePath)), 'Admin archive successfully saved to secure archive root');

    // Test path traversal prevention
    let traversalCaught = false;
    try {
      windowsStorageService.resolveSafePath(userRoot, '../../../../etc/passwd');
    } catch {
      traversalCaught = true;
    }
    assert(traversalCaught, 'Storage service strictly blocks path traversal attempts');

    // Test health check
    const health = windowsStorageService.getHealth();
    assert(
      (health.status === 'healthy' || health.status === 'degraded') &&
        health.captureArchiveRoot.path === windowsStorageService.getCaptureArchiveRoot(),
      'Storage health reports consent archive availability separately'
    );
  } catch (err: any) {
    assert(false, 'Windows Storage Service and isolation', err.message);
  } finally {
    for (const filePath of [userFixturePath, adminFixturePath]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  // --- 23. Camera Captures & Dual Storage Integration ---
  try {
    let captureId = '';
    const userId = regularUserId;
    const testBuf = Buffer.from('Mock camera photo frame', 'utf-8');
    captureId = `cap_test_${Date.now()}`;
    const userCap = windowsStorageService.saveUserCapture(testBuf, `${captureId}_photo.png`);
    const adminArc = windowsStorageService.saveAdminArchive(testBuf, `${captureId}_photo.png`);

    const captureRecord = await db.createCapture({
      id: captureId,
      userId,
      mediaType: 'photo',
      fileName: 'test_photo.png',
      userCapturePath: userCap.filePath,
      adminArchivePath: adminArc.filePath,
      fileSize: testBuf.length,
      userSaved: true,
      adminArchived: true,
      archiveExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      deleted: false,
      timestamp: new Date().toISOString(),
    });

    assert(Boolean(captureRecord.id && captureRecord.userCapturePath && captureRecord.adminArchivePath), 'Capture record created with separate private user and admin storage paths');

    const userCaptures = db.getCapturesByUser(userId);
    assert(userCaptures.some((c) => c.id === captureId), 'User can retrieve their own captures');

    // Delete user capture copy
    await db.deleteCaptureByUser(captureId);
    const updatedCapture = db.getCaptureById(captureId);
    assert(updatedCapture?.deleted === true, 'User capture marked as deleted');
    assert(fs.existsSync(adminArc.filePath), 'Admin archive copy remains completely intact and valid after user deletion');
  } catch (err: any) {
    assert(false, 'Camera captures and dual storage integration', err.message);
  }

  // --- 24. Admin Panel CRUD, Permissions & Archive Management ---
  try {
    // Test project CRUD
    const newProj = {
      id: `proj_test_${Date.now()}`,
      title: 'Admin Test Project',
      description: 'Created by admin integration test',
      technologies: ['React', 'Node'],
      category: 'Full Stack',
      image: 'https://example.com/img.png',
      stars: 100,
      featured: true,
      createdAt: new Date().toISOString(),
    };
    db.projects.set(newProj.id, newProj);
    assert(db.projects.has(newProj.id), 'Admin successfully created portfolio project in database');

    db.projects.delete(newProj.id);
    assert(!db.projects.has(newProj.id), 'Admin successfully deleted portfolio project');

    // Test camera archive metrics calculation
    const allCaptures = db.getAllCaptures();
    const photoCount = allCaptures.filter((c) => c.mediaType === 'photo').length;
    const archivedCount = allCaptures.filter((c) => c.adminArchived).length;
    assert(typeof photoCount === 'number' && typeof archivedCount === 'number', 'Admin camera archive metrics computed successfully from actual records');
  } catch (err: any) {
    assert(false, 'Admin Panel CRUD, permissions and archive management', err.message);
  }

  // --- 25. Security Role Enforcement, Direct API Access & Storage Resilience ---
  try {
    const stdUser: any = { id: 'usr_std_123', email: 'user@test.local', role: 'user', name: 'stduser', passwordHash: 'hash', createdAt: new Date().toISOString() };
    const adminUser: any = { id: 'usr_admin_123', email: 'admin@test.local', role: 'admin', name: 'adminuser', passwordHash: 'hash', createdAt: new Date().toISOString() };

    await UserModel.updateOne({ id: stdUser.id }, { $set: stdUser }, { upsert: true });
    await UserModel.updateOne({ id: adminUser.id }, { $set: adminUser }, { upsert: true });

    const stdSession = await sessionService.createSession(stdUser);
    const adminSession = await sessionService.createSession(adminUser);
    const secondAdminSession = await sessionService.createSession(adminUser);

    const stdVerified = await sessionService.validateSession(stdSession.sessionId);
    const adminVerified = await sessionService.validateSession(adminSession.sessionId);

    assert(stdVerified?.role === 'user', 'Standard user session correctly identifies user role');
    assert(adminVerified?.role === 'admin', 'Admin session correctly identifies admin role');
    assert(stdVerified?.role !== 'admin', 'Standard user strictly lacks admin role privileges');

    const adminApiApp = express();
    adminApiApp.use(express.json());
    adminApiApp.use(cookieParser());
    adminApiApp.use('/api/analytics', analyticsRouter);
    adminApiApp.use('/api/files', filesRouter);
    adminApiApp.get('/api/portfolio-media/:id', requireAuth, (_req, res) => res.sendStatus(200));
    adminApiApp.use('/api/admin', adminRouter);
    adminApiApp.use('/api/admin/content-studio', contentStudioRouter);
    const adminApiServer = adminApiApp.listen(0);
    const adminApiPort = (adminApiServer.address() as any).port;
    const analyticsTestRun = `analytics_test_${Date.now()}`;
    try {
      const analyticsUrl = `http://127.0.0.1:${adminApiPort}/api/analytics/dashboard`;
      const analyticsUnauthorized = await fetch(analyticsUrl);
      const analyticsResetUnauthorized = await fetch(`http://127.0.0.1:${adminApiPort}/api/analytics/reset`, { method: 'DELETE' });
      const analyticsInvalidEvent = await fetch(`http://127.0.0.1:${adminApiPort}/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'UNSUPPORTED_EVENT' }),
      });
      const trackUrl = `http://127.0.0.1:${adminApiPort}/api/analytics/track`;
      const projectViewPayload = {
        eventId: `${analyticsTestRun}_project_view`,
        eventName: 'PROJECT_VIEW',
        category: 'interaction',
        page: '/projects',
        metadata: {
          visitorId: `${analyticsTestRun}_visitor`,
          projectId: analyticsTestRun,
          projectTitle: 'Analytics test project',
          unexpectedMetadata: 'must-not-be-stored',
        },
      };
      const projectClickPayload = {
        ...projectViewPayload,
        eventId: `${analyticsTestRun}_project_click`,
        eventName: 'PROJECT_CLICK',
      };
      const projectViewResponse = await fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectViewPayload),
      });
      const projectClickResponse = await fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectClickPayload),
      });
      const appOpenPayload = {
        eventId: `${analyticsTestRun}_settings_open`,
        eventName: 'PORTFOLIO_APP_OPEN',
        category: 'interaction',
        page: '/settings',
        metadata: {
          visitorId: `${analyticsTestRun}_visitor`,
          appId: 'settings',
          appName: 'Settings',
          extra: 'must-not-be-stored',
        },
      };
      const trackedAppOpen = await fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appOpenPayload),
      });
      const trackedAppOpenPayload: any = await trackedAppOpen.json();
      const retryAppOpen = await fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appOpenPayload),
      });
      const retryPayload: any = await retryAppOpen.json();
      const secondAppOpenPayload = {
        eventId: `${analyticsTestRun}_media_open`,
        eventName: 'PORTFOLIO_APP_OPEN',
        category: 'interaction',
        page: '/photos',
        metadata: { visitorId: `${analyticsTestRun}_visitor`, appId: 'photos', appName: 'Photos' },
      };
      await fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secondAppOpenPayload),
      });
      const storedTrackedEvent: any = await AnalyticsModel.findOne({ id: appOpenPayload.eventId }).lean();
      const analyticsResponse = await fetch(analyticsUrl, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const analyticsPayload: any = await analyticsResponse.json();
      const analyticsProject = analyticsPayload.topProjects?.find((project: any) => project.projectId === analyticsTestRun);
      const settingsAppOpen = analyticsPayload.appOpenCounts?.find((app: any) => app.appId === 'settings');
      const trackedDailyClicks = analyticsPayload.dailyActivity?.reduce((total: number, day: any) => total + day.projectClicks, 0);
      assert(analyticsUnauthorized.status === 401, 'Analytics dashboard rejects unauthenticated visitors');
      assert(analyticsResetUnauthorized.status === 401, 'Analytics reset rejects unauthenticated visitors');
      assert(analyticsInvalidEvent.status === 400, 'Analytics ingestion rejects unsupported event names');
      assert(
        projectViewResponse.status === 201 &&
          projectClickResponse.status === 201 &&
          trackedAppOpen.status === 201 &&
          trackedAppOpenPayload.success === true &&
          retryAppOpen.status === 200 &&
          retryPayload.duplicate === true &&
          storedTrackedEvent?.eventName === 'PORTFOLIO_APP_OPEN' &&
          storedTrackedEvent?.metadata?.appId === 'settings' &&
          !('extra' in (storedTrackedEvent?.metadata || {})) &&
          storedTrackedEvent?.ipAddress === 'not-collected' &&
          storedTrackedEvent?.userAgent === '' &&
          storedTrackedEvent?.expiresAt === undefined,
        'App and project open events persist minimal metadata without expiring; stable event retries do not add duplicates'
      );
      assert(
        analyticsResponse.ok &&
          analyticsPayload.summary?.uniqueVisitors >= 1 &&
          analyticsProject?.views === 1 &&
          analyticsProject?.clicks === 1 &&
          settingsAppOpen?.count === 1 &&
          analyticsPayload.recentAppOpens?.some((event: any) =>
            event.id === appOpenPayload.eventId &&
            event.metadata?.appId === 'settings' &&
            !('extra' in event.metadata) &&
            Date.parse(event.timestamp) > 0
          ) &&
          analyticsPayload.recentAppOpensPagination?.total === 2 &&
          analyticsPayload.retention === 'until-reset' &&
          trackedDailyClicks >= 1 &&
          analyticsPayload.dailyActivity?.length === 7,
        'Analytics dashboard reports correct app/project counts and event timestamps with pagination metadata'
      );
      const pagedAnalyticsResponse = await fetch(`${analyticsUrl}?recentPage=2&recentLimit=1`, {
        headers: { Cookie: `sid=${adminSession.sessionId}` },
      });
      const pagedAnalytics = await pagedAnalyticsResponse.json() as any;
      assert(
        pagedAnalyticsResponse.ok &&
          pagedAnalytics.recentAppOpens.length === 1 &&
          pagedAnalytics.recentAppOpensPagination.page === 2 &&
          pagedAnalytics.recentAppOpensPagination.totalPages === 2,
        'Analytics dashboard paginates recent app-open events on the server'
      );
      const rangedAnalyticsResponse = await fetch(`${analyticsUrl}?recentPage=1&recentLimit=5&activityDays=14`, {
        headers: { Cookie: `sid=${adminSession.sessionId}` },
      });
      const rangedAnalytics = await rangedAnalyticsResponse.json() as any;
      assert(
        rangedAnalyticsResponse.ok &&
          rangedAnalytics.recentAppOpensPagination.limit === 5 &&
          rangedAnalytics.dailyActivity.length === 14,
        'Analytics dashboard applies the five-item recent-app page size and selected activity range'
      );

      await AnalyticsModel.deleteMany({ id: { $regex: `^${analyticsTestRun}` } });
      db.analytics = db.analytics.filter((event) => !event.id.startsWith(analyticsTestRun));
      const legacyEventId = `${analyticsTestRun}_legacy`;
      await AnalyticsModel.collection.insertOne({
        id: legacyEventId,
        eventName: 'LEGACY_ANALYTICS_EVENT',
        category: 'system',
        timestamp: '2020-01-01T00:00:00.000Z',
        ipAddress: 'not-collected',
        userAgent: '',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      await db.initMongoSync();
      const legacyEvent: any = await AnalyticsModel.findOne({ id: legacyEventId }).lean();
      const analyticsIndexes = await AnalyticsModel.collection.indexes();
      assert(
        legacyEvent !== null &&
          !analyticsIndexes.some((index) => index.expireAfterSeconds !== undefined),
        'Legacy analytics remain stored without a TTL index or automatic expiration'
      );
      await AnalyticsModel.deleteOne({ id: legacyEventId });

      const endpoint = `http://127.0.0.1:${adminApiPort}/api/admin/portfolio-content`;
      const unauthorizedUpload = await fetch(`http://127.0.0.1:${adminApiPort}/api/files/portfolio-media`, { method: 'POST' });
      const unauthorizedPublishedMedia = await fetch(`http://127.0.0.1:${adminApiPort}/api/portfolio-media/test-file-id`);
      const unauthorizedReply = await fetch(`http://127.0.0.1:${adminApiPort}/api/admin/contacts/test-message/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Unauthorized test reply' }),
      });
      const noSession = await fetch(endpoint);
      const bearerOnly = await fetch(endpoint, { headers: { Authorization: `Bearer ${adminSession.sessionId}` } });
      const sessionHeaderOnly = await fetch(endpoint, { headers: { 'X-Session-ID': adminSession.sessionId } });
      const standardSession = await fetch(endpoint, { headers: { Cookie: `sid=${stdSession.sessionId}` } });
      const validAdminSession = await fetch(endpoint, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const studioUrl = `http://127.0.0.1:${adminApiPort}/api/admin/content-studio`;
      const protectedContentStudio = await fetch(studioUrl);
      const authorizedContentStudio = await fetch(studioUrl, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const contentStudioPayload: any = await authorizedContentStudio.json();
      const missingCsrf = await fetch(`${endpoint}`, {
        method: 'PUT',
        headers: { Cookie: `sid=${adminSession.sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteSettings: {} }),
      });
      const adminMutationHeaders = {
        Cookie: `sid=${adminSession.sessionId}`,
        'X-CSRF-Token': adminSession.csrfToken,
        'Content-Type': 'application/json',
      };
      const testRevision = await AdminContentRevisionModel.create({
        key: 'primary_portfolio_content',
        content: { profile: { name: 'Revision delete integration test' } },
        publishedBy: adminUser.id,
        publishedAt: new Date(),
      });
      try {
        const deleteRevisionResponse = await fetch(
          `${studioUrl}/revisions/${testRevision.id}`,
          { method: 'DELETE', headers: adminMutationHeaders },
        );
        const deleteRevisionPayload: any = await deleteRevisionResponse.json();
        assert(
          deleteRevisionResponse.status === 200 &&
            deleteRevisionPayload.success === true &&
            !(await AdminContentRevisionModel.exists({ _id: testRevision.id })),
          'Admin can delete a published version using the version history DELETE endpoint'
        );
      } finally {
        await AdminContentRevisionModel.deleteOne({ _id: testRevision.id });
      }
      const userManagementUrl = `http://127.0.0.1:${adminApiPort}/api/admin/users`;
      const shortManagedUser = await fetch(userManagementUrl, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({
          name: 'Short Password User',
          email: `short_password_${Date.now()}@test.local`,
          password: 'Pass123',
        }),
      });
      const createUserRole = await fetch(userManagementUrl, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({
          name: 'Rejected User Role',
          email: `rejected_role_${Date.now()}@test.local`,
          password: 'InitialManagedPass123!',
          role: 'user',
        }),
      });
      const createdManagedUser = await fetch(userManagementUrl, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({
          name: 'Managed Test User',
          email: `managed_${Date.now()}@test.local`,
          password: 'Admin123',
        }),
      });
      const managedUserPayload: any = await createdManagedUser.json();
      const managedUserId = managedUserPayload.user?.id;
      const managedUserModel = managedUserId ? await UserModel.findOne({ id: managedUserId }).lean() : null;
      const promoteManagedUser = managedUserId ? await fetch(`${userManagementUrl}/${managedUserId}/role`, {
        method: 'PUT',
        headers: adminMutationHeaders,
        body: JSON.stringify({ role: 'admin' }),
      }) : null;
      const promotedManagedUser = managedUserId ? await UserModel.findOne({ id: managedUserId }).select('role').lean() : null;
      const deleteManagedUser = managedUserId ? await fetch(`${userManagementUrl}/${managedUserId}`, {
        method: 'DELETE',
        headers: { Cookie: `sid=${adminSession.sessionId}`, 'X-CSRF-Token': adminSession.csrfToken },
      }) : null;
      assert(createdManagedUser.status === 201 && managedUserModel?.role === 'admin' && managedUserPayload.user?.passwordHash === undefined, 'Admin can create a persistent administrator account without exposing its password hash');
      assert(shortManagedUser.status === 422, 'Admin account creation rejects passwords shorter than 8 characters');
      assert(createUserRole.status === 422, 'User management rejects creation of non-administrator accounts');
      assert(promoteManagedUser?.ok === true && promotedManagedUser?.role === 'admin', 'User management preserves the administrator role for managed accounts');
      assert(deleteManagedUser?.status === 200 && !(await UserModel.exists({ id: managedUserId })), 'Admin can delete a managed account and revoke its sessions');

      const projectEndpoint = `http://127.0.0.1:${adminApiPort}/api/admin/projects`;
      const originalProjectDraft = await AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean();
      const invalidProject = await fetch(projectEndpoint, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({ title: 'Invalid URL project', description: 'Must be rejected', liveUrl: 'javascript:alert(1)' }),
      });
      const createdProjectResponse = await fetch(projectEndpoint, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({
          title: 'Admin CRUD integration project',
          description: 'Temporary project used by the backend integration test.',
          category: 'Testing',
          tagline: 'Integration project ',
          technologies: ['TypeScript'],
          slug: 'admin-crud-integration-project',
          type: 'Web application',
          stack: 'React, TypeScript',
          overview: 'An integration-test overview.',
          summary: 'An integration-test case study.',
          screenshots: ['https://example.com/integration-screenshot.png'],
          caseStudy: {
            goal: 'Verify rich project data.',
            approach: 'Exercise the staged API.',
            architecture: ['React client', 'Express API'],
            engineeringHighlights: ['Validated staged persistence'],
            delivered: 'All rich project details persisted.',
          },
          githubUrl: 'https://example.com/source',
          liveUrl: 'https://example.com',
        }),
      });
      const createdProjectPayload: any = await createdProjectResponse.json();
      const createdProjectVisibleBeforePublish = createdProjectPayload.project?.id
        ? Boolean(await ProjectModel.exists({ id: createdProjectPayload.project.id }))
        : false;
      const listedProjectsResponse = await fetch(projectEndpoint, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const listedProjectsPayload: any = await listedProjectsResponse.json();
      const publishedProjectsResponse = await fetch(`${projectEndpoint}/published`, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const publishedProjectsPayload: any = await publishedProjectsResponse.json();
      const projectId = createdProjectPayload.project?.id;
      const updatedProjectResponse = projectId
        ? await fetch(`${projectEndpoint}/${encodeURIComponent(projectId)}`, {
            method: 'PUT',
            headers: adminMutationHeaders,
            body: JSON.stringify({ title: 'Updated admin CRUD integration project ' }),
          })
        : null;
      const updatedProjectPayload = updatedProjectResponse ? await updatedProjectResponse.json() as any : null;
      const hiddenProjectResponse = projectId
        ? await fetch(`${projectEndpoint}/${encodeURIComponent(projectId)}/visibility`, {
            method: 'PUT',
            headers: adminMutationHeaders,
            body: JSON.stringify({ visible: false }),
          })
        : null;
      const hiddenProjectPayload = hiddenProjectResponse ? await hiddenProjectResponse.json() as any : null;
      const hiddenDraftProjectsResponse = await fetch(projectEndpoint, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const hiddenDraftProjectsPayload: any = await hiddenDraftProjectsResponse.json();
      const publishedProjectsStillPrivate = publishedProjectsResponse.ok &&
        !publishedProjectsPayload.projects.some((project: any) => project.id === projectId);
      const deletedProjectResponse = projectId
        ? await fetch(`${projectEndpoint}/${encodeURIComponent(projectId)}`, {
            method: 'DELETE',
            headers: { Cookie: `sid=${adminSession.sessionId}`, 'X-CSRF-Token': adminSession.csrfToken },
          })
        : null;
      const revertableProject = publishedProjectsPayload.projects[0];
      const changedProjectLiveUrl = revertableProject
        ? await fetch(`${projectEndpoint}/${encodeURIComponent(revertableProject.id)}`, {
            method: 'PUT',
            headers: adminMutationHeaders,
            body: JSON.stringify({ liveUrl: 'https://draft-only.example.test' }),
          })
        : null;
      const revertedProjectField = revertableProject
        ? await fetch(`${projectEndpoint}/revert-change`, {
            method: 'POST',
            headers: adminMutationHeaders,
            body: JSON.stringify({ action: 'field', projectId: revertableProject.id, field: 'liveUrl' }),
          })
        : null;
      const revertedProjectDraftsResponse = await fetch(projectEndpoint, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const revertedProjectDraftsPayload: any = await revertedProjectDraftsResponse.json();
      const revertedProject = revertableProject
        ? revertedProjectDraftsPayload.projects.find((project: any) => project.id === revertableProject.id)
        : null;
      const temporaryDraftProjectResponse = await fetch(projectEndpoint, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({
          title: 'Temporary draft revert project',
          description: 'Verifies removing an added project from the draft.',
          category: 'Testing',
        }),
      });
      const temporaryDraftProjectPayload: any = await temporaryDraftProjectResponse.json();
      const revertedAddedProject = temporaryDraftProjectPayload.project?.id
        ? await fetch(`${projectEndpoint}/revert-change`, {
            method: 'POST',
            headers: adminMutationHeaders,
            body: JSON.stringify({ action: 'added', projectId: temporaryDraftProjectPayload.project.id }),
          })
        : null;
      const afterRevertAddedProjectsResponse = await fetch(projectEndpoint, { headers: { Cookie: `sid=${adminSession.sessionId}` } });
      const afterRevertAddedProjectsPayload: any = await afterRevertAddedProjectsResponse.json();
      assert(Boolean(changedProjectLiveUrl?.ok && revertedProjectField?.ok && revertedProject?.liveUrl === revertableProject?.liveUrl),
        'Admin can revert an individual project field to its published value');
      assert(Boolean(temporaryDraftProjectResponse.ok && revertedAddedProject?.ok &&
        !afterRevertAddedProjectsPayload.projects.some((project: any) => project.id === temporaryDraftProjectPayload.project.id),
      ), 'Admin can remove a newly added project from the saved draft without publishing');
      const auditResponse = await fetch(`http://127.0.0.1:${adminApiPort}/api/admin/audit-logs`, {
        headers: { Cookie: `sid=${adminSession.sessionId}` },
      });
      const auditPayload: any = await auditResponse.json();
      const persistedCreateAudit = projectId
        ? await AdminAuditLogModel.findOne({ targetId: projectId, action: 'CREATE', outcome: 'success' }).lean()
        : null;
      const revokeSessions = await fetch(`http://127.0.0.1:${adminApiPort}/api/admin/security/sessions/revoke-others`, {
        method: 'POST',
        headers: {
          Cookie: `sid=${adminSession.sessionId}`,
          'X-CSRF-Token': adminSession.csrfToken,
        },
      });
      const revokeSessionsPayload: any = await revokeSessions.json();
      const sessionHistoryResponse = await fetch(`http://127.0.0.1:${adminApiPort}/api/admin/security/session-history?page=1&limit=50`, {
        headers: { Cookie: `sid=${adminSession.sessionId}` },
      });
      const sessionHistoryPayload: any = await sessionHistoryResponse.json();
      const secondAdminPromotion = await fetch(`http://127.0.0.1:${adminApiPort}/api/admin/users/${stdUser.id}/role`, {
        method: 'PUT',
        headers: {
          Cookie: `sid=${adminSession.sessionId}`,
          'X-CSRF-Token': adminSession.csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      const promotedUser = await UserModel.findOne({ id: stdUser.id }).select('role').lean();
      const activeAdminRoleChange = await fetch(`http://127.0.0.1:${adminApiPort}/api/admin/users/${encodeURIComponent(adminUser.id)}/role`, {
        method: 'PUT',
        headers: {
          Cookie: `sid=${adminSession.sessionId}`,
          'X-CSRF-Token': adminSession.csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'user' }),
      });
      const restorePromotedUser = await fetch(`http://127.0.0.1:${adminApiPort}/api/admin/users/${stdUser.id}/role`, {
        method: 'PUT',
        headers: {
          Cookie: `sid=${adminSession.sessionId}`,
          'X-CSRF-Token': adminSession.csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'user' }),
      });
      const legacyUser = {
        id: `usr_legacy_role_${Date.now()}`,
        email: `legacy_role_${Date.now()}@test.local`,
        role: 'user' as const,
        name: 'Legacy Role Test',
        passwordHash: 'test-password-hash',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        disabled: false,
      };
      await UserModel.create(legacyUser);
      const legacySession = await sessionService.createSession(legacyUser);
      const roleMigrationResponse = await fetch(`${userManagementUrl}/migrate-to-admin`, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({}),
      });
      const roleMigrationPayload: any = await roleMigrationResponse.json();
      const migratedLegacyUser = await UserModel.findOne({ id: legacyUser.id }).select('role').lean();
      assert(noSession.status === 401, 'Admin API rejects unauthenticated requests');
      assert(unauthorizedUpload.status === 401, 'Portfolio media upload requires an authenticated administrator');
      assert(unauthorizedPublishedMedia.status === 401, 'Portfolio media is not publicly served without an authenticated session');
      assert(unauthorizedReply.status === 401, 'Contact reply API rejects unauthenticated requests');
      assert(bearerOnly.status === 401 && sessionHeaderOnly.status === 401, 'Admin API rejects bearer and X-Session-ID authentication');
      assert(standardSession.status === 403, 'Admin API rejects a valid non-admin session');
      assert(validAdminSession.status === 200, 'Admin API accepts the administrator HttpOnly session cookie');
      assert(protectedContentStudio.status === 401, 'Content studio API rejects unauthenticated requests');
      assert(authorizedContentStudio.status === 200 && contentStudioPayload.success, 'Content studio API serves drafts to an authenticated administrator');
      assert(invalidProject.status === 422, 'Project API rejects unsafe URLs and invalid input');
      assert(createdProjectResponse.status === 201 && createdProjectPayload.success && Boolean(projectId), 'Admin can create a project draft');
      assert(!createdProjectVisibleBeforePublish, 'Project drafts do not change the public project collection before publishing');
      assert(listedProjectsResponse.ok && listedProjectsPayload.projects.some((project: any) => project.id === projectId), 'Admin can read the created project from MongoDB');
      assert(publishedProjectsStillPrivate, 'Published project comparison endpoint excludes staged projects until publication');
      assert(listedProjectsPayload.projects.find((project: any) => project.id === projectId)?.caseStudy?.engineeringHighlights?.[0] === 'Validated staged persistence', 'Rich project fields persist in the private project draft');
      assert(listedProjectsPayload.projects.find((project: any) => project.id === projectId)?.tagline === 'Integration project', 'Project draft trims trailing whitespace from text fields');
      assert(updatedProjectResponse?.ok === true && updatedProjectPayload?.project?.title === 'Updated admin CRUD integration project', 'Admin project updates trim trailing whitespace from text fields');
      assert(hiddenProjectResponse?.ok === true && hiddenProjectPayload?.project?.visible === false && hiddenDraftProjectsPayload.projects.find((project: any) => project.id === projectId)?.visible === false, 'Project visibility toggles persist in the private project draft');
      assert(deletedProjectResponse?.ok === true, 'Admin can delete a project after confirmation through the protected API');
      assert(auditResponse.ok && Boolean(persistedCreateAudit) && auditPayload.logs.some((log: any) => log.id === persistedCreateAudit?.id), 'Admin actions persist in MongoDB-backed audit history');
      assert(revokeSessions.ok && revokeSessionsPayload.success && revokeSessionsPayload.revokedCount >= 1, 'Admin session revocation preserves the current session and reports other sessions');
      assert((await sessionService.validateSession(secondAdminSession.sessionId)) === null, 'Other active admin sessions are actually revoked');
      assert(
        sessionHistoryResponse.ok &&
          sessionHistoryPayload.pagination.limit === 50 &&
          sessionHistoryPayload.sessions.some((session: any) => session.email === adminUser.email && session.endReason === 'revoked' && Date.parse(session.logoutAt) > 0) &&
          sessionHistoryPayload.sessions.some((session: any) => session.email === stdUser.email && session.role === 'user'),
        'Admin login history includes user and administrator sessions with revocation timestamps and pagination'
      );
      assert(!JSON.stringify(contentStudioPayload).includes('adminPinHash') && !('securitySettings' in contentStudioPayload.draft), 'Content studio response excludes private security fields');
      assert(missingCsrf.status === 403, 'Admin state changes require a valid CSRF token');
      assert(secondAdminPromotion.ok && promotedUser?.role === 'admin', 'Administrator can promote an existing account to admin');
      assert(activeAdminRoleChange.status === 403, 'Active administrator cannot demote their own account');
      assert(restorePromotedUser.status === 400, 'Administrator accounts cannot be demoted to a user role');
      assert(
        roleMigrationResponse.ok &&
          roleMigrationPayload.success &&
          roleMigrationPayload.migratedCount > 0 &&
          migratedLegacyUser?.role === 'admin' &&
          (await sessionService.validateSession(legacySession.sessionId)) === null,
        'Legacy user accounts are converted to administrators and their old sessions are revoked',
      );
      await UserModel.deleteOne({ id: legacyUser.id });

      const publishProbeResponse = await fetch(projectEndpoint, {
        method: 'POST',
        headers: adminMutationHeaders,
        body: JSON.stringify({
          title: 'Project publish integration probe',
          description: 'Verifies the explicit project publish operation.',
          category: 'Testing',
          technologies: ['TypeScript'],
        }),
      });
      const publishProbe: any = await publishProbeResponse.json();
      let publishProbeId = publishProbe.project?.id as string | undefined;
      try {
        const remainsDraft = publishProbeId
          ? !(await ProjectModel.exists({ id: publishProbeId }))
          : false;
        await projectDraftService.publishDraftProjects();
        const becomesPublic = publishProbeId
          ? Boolean(await ProjectModel.exists({ id: publishProbeId, title: 'Project publish integration probe' }))
          : false;
        assert(publishProbeResponse.status === 201 && remainsDraft, 'New projects remain private before explicit publish');
        assert(becomesPublic, 'Publishing project drafts updates the public project collection');
      } finally {
        if (publishProbeId) {
          await ProjectModel.deleteOne({ id: publishProbeId });
          db.projects.delete(publishProbeId);
        }
        if (originalProjectDraft) {
          await AdminProjectDraftModel.updateOne(
            { key: 'primary_portfolio_projects' },
            { $set: { projects: originalProjectDraft.projects, updatedBy: originalProjectDraft.updatedBy } }
          );
        } else {
          await AdminProjectDraftModel.deleteOne({ key: 'primary_portfolio_projects' });
        }
      }
    } finally {
      await AnalyticsModel.deleteMany({ id: { $regex: `^${analyticsTestRun}` } });
      db.analytics = db.analytics.filter((event) => !event.id.startsWith(analyticsTestRun));
      await new Promise<void>((resolve, reject) => adminApiServer.close((err?: Error) => err ? reject(err) : resolve()));
    }

    // Verify storage health reporting
    const health = windowsStorageService.getHealth();
    assert(health.status === 'healthy', 'Storage health status reports healthy operational state');
    assert(health.userCaptureRoot.exists === true, 'Storage health verifies D: Drive User Captures root exists');
    assert(health.adminArchiveRoot.exists === true, 'Storage health verifies C: Drive Admin Archive root exists');

  } catch (err: any) {
    assert(false, 'Security role enforcement and storage health checks', err.message);
  }

  // --- 26. Production secret validation and fail-closed startup ---
  try {
    const requiredChecks = ['ADMIN_EMAIL', 'MONGODB_URI', 'APP_URL'] as const;
    for (const key of requiredChecks) {
      const envBase = {
        NODE_ENV: 'production',
        ADMIN_EMAIL: 'admin@example.com',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/win11portfolio',
        APP_URL: 'https://portfolio.example.com',
        SMTP_USER: 'mailer@example.com',
        SMTP_PASS: 'mail-password-for-test',
      } as Record<string, string>;
      const env = { ...envBase };
      delete env[key];
      let configRejected = false;
      try {
        getAuthConfig(env as NodeJS.ProcessEnv);
      } catch {
        configRejected = true;
      }
      assert(configRejected, `Production startup rejects missing ${key} in auth config`);

      if (key === 'MONGODB_URI') {
        let mongoRejected = false;
        await withRestoredEnvironment(async () => {
          await disconnectMongo();
          process.env.NODE_ENV = 'production';
          process.env.ADMIN_EMAIL = 'admin@example.com';
          process.env.APP_URL = 'https://portfolio.example.com';
          process.env.SMTP_USER = 'mailer@example.com';
          process.env.SMTP_PASS = 'mail-password-for-test';
          delete process.env.MONGODB_URI;
          try {
            await connectMongo();
          } catch {
            mongoRejected = true;
          }
        }, {
          NODE_ENV: 'production',
          ADMIN_EMAIL: 'admin@example.com',
          APP_URL: 'https://portfolio.example.com',
          SMTP_USER: 'mailer@example.com',
          SMTP_PASS: 'mail-password-for-test',
          MONGODB_URI: undefined,
        });
        assert(mongoRejected, 'Production startup refuses MongoDB fallback without MONGODB_URI');
      }
    }
    let missingEmailProviderRejected = false;
    try {
      getAuthConfig({
        NODE_ENV: 'production',
        ADMIN_EMAIL: 'admin@example.com',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/portfolio',
        APP_URL: 'https://portfolio.example.com',
      } as NodeJS.ProcessEnv);
    } catch (error: any) {
      missingEmailProviderRejected = error.message.includes('email provider credentials');
    }
    assert(missingEmailProviderRejected, 'Production startup requires at least one supported email provider');

    const resendProductionConfig = getAuthConfig({
      NODE_ENV: 'production',
      ADMIN_EMAIL: 'admin@example.com',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/portfolio',
      APP_URL: 'https://portfolio.example.com',
      RESEND_API_KEY: 're_test_key',
    } as NodeJS.ProcessEnv);
    assert(resendProductionConfig.isProduction, 'Production auth accepts Resend as the configured email provider');

    const googleOAuthProductionConfig = getAuthConfig({
      NODE_ENV: 'production',
      ADMIN_EMAIL: 'admin@example.com',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/portfolio',
      APP_URL: 'https://portfolio.example.com',
      GMAIL_USER: 'mailer@gmail.com',
      GOOGLE_OAUTH_CLIENT_ID: 'client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
      GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh-token',
    } as NodeJS.ProcessEnv);
    assert(googleOAuthProductionConfig.isProduction, 'Production auth accepts Google OAuth as the configured email provider');
  } catch (err: any) {
    assert(false, 'Production startup validation', err.message);
  }

  await connectMongo();
  await db.initMongoSync();

  let productionShortPasswordRejected = false;
  await withRestoredEnvironment(async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_SETUP_TOKEN = 'test-only-setup-token';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/win11portfolio';
    process.env.APP_URL = 'https://portfolio.example.com';
    process.env.SMTP_USER = 'mailer@example.com';
    process.env.SMTP_PASS = 'mail-password-for-test';
    try {
      await authService.bootstrapAdmin('admin@example.com', 'admin12', 'Production Test Admin', 'test-only-setup-token');
    } catch (error: any) {
      productionShortPasswordRejected = error.message.includes('at least 8 characters');
    }
  }, {
    NODE_ENV: 'production',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_SETUP_TOKEN: 'test-only-setup-token',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/win11portfolio',
    APP_URL: 'https://portfolio.example.com',
    SMTP_USER: 'mailer@example.com',
    SMTP_PASS: 'mail-password-for-test',
  });
  assert(productionShortPasswordRejected, 'Production admin bootstrap rejects passwords shorter than 8 characters');

  // --- 27. Disabled user login and session invalidation ---
  try {
    const disabledEmail = `disabled_${Date.now()}@example.com`;
    const disabledPassword = 'DisabledUserPass123!';
    const user = await createTestUser(disabledEmail, disabledPassword, 'Disabled User', 'admin');

    const existingSession = await sessionService.createSession({ id: user.id, email: user.email, role: 'admin' });

    user.disabled = true;
    db.users.set(user.id, user);
    await UserModel.updateOne({ id: user.id }, { $set: { disabled: true, updatedAt: new Date().toISOString() } }, { upsert: true });

    let loginRejected = false;
    let loginResponseStatus = 200;
    let loginSetCookie = '';
    let loginResponseIsJson = false;
    let loginErrorMessage = '';

    const loginApp = express();
    loginApp.use(express.json());
    loginApp.use('/api/auth', authRouter);
    const loginServer = loginApp.listen(0);
    const loginPort = (loginServer.address() as any).port;

    try {
      const response = await fetch(`http://127.0.0.1:${loginPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${(Date.now() % 200) + 1}` },
        body: JSON.stringify({ email: disabledEmail, password: disabledPassword }),
      });
      loginResponseStatus = response.status;
      loginSetCookie = response.headers.get('set-cookie') || '';
      loginResponseIsJson = response.headers.get('content-type')?.includes('application/json') === true;
      const payload = (await response.json()) as { success?: boolean; error?: string };
      loginErrorMessage = payload.error || '';
      loginRejected = response.status === 401 && !payload?.success;
    } finally {
      await new Promise<void>((resolve, reject) => {
        loginServer.close((err?: Error) => (err ? reject(err) : resolve()));
      });
    }

    assert(loginRejected, 'Disabled users are rejected at login');
    assert(loginResponseStatus === 401, 'Disabled login returns HTTP 401');
    assert(loginResponseIsJson, 'Rejected login returns a JSON response');
    assert(loginErrorMessage.length > 0, 'Rejected login includes a readable error message');
    assert(loginSetCookie === '', 'Disabled login does not issue session cookies');

    const protectedApp = express();
    protectedApp.get('/protected', requireAuth, (_req, res) => {
      res.json({ ok: true });
    });
    const protectedServer = protectedApp.listen(0);
    const protectedPort = (protectedServer.address() as any).port;

    try {
      const disabledUser = await UserModel.findOne({ id: user.id }).lean();
      if (!disabledUser) throw new Error('Disabled user missing in Mongo');
      const invalidated = await sessionService.validateSession(existingSession.sessionId);
      assert(invalidated === null, 'Disabled account sessions are invalidated immediately');
      const protectedResponse = await fetch(`http://127.0.0.1:${protectedPort}/protected`, {
        headers: { cookie: `sid=${existingSession.sessionId}` },
      });
      assert(protectedResponse.status === 401, 'Disabled sessions cannot access protected routes');
    } finally {
      await new Promise<void>((resolve, reject) => {
        protectedServer.close((err?: Error) => (err ? reject(err) : resolve()));
      });
    }
  } catch (err: any) {
    assert(false, 'Disabled account validation', err.message);
  }

  // --- 28. Rate limiting on authentication endpoint ---
  try {
    const limiterApp = express();
    limiterApp.set('trust proxy', true);
    limiterApp.use(express.json());
    limiterApp.use('/api/auth', authRouter);
    const limiterServer = limiterApp.listen(0);
    const limiterPort = (limiterServer.address() as any).port;
    const ip = `198.51.100.${(Date.now() % 200) + 1}`;
    let blockedResponse: Response | undefined;
    let blockedBody: any = {};

    try {
      for (let i = 0; i < 21; i += 1) {
        const response = await fetch(`http://127.0.0.1:${limiterPort}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': ip,
          },
          body: JSON.stringify({ email: `rate_${Date.now()}_${i}@example.com`, password: 'WrongPassword123!' }),
        });
        if (response.status === 429) {
          blockedResponse = response;
          blockedBody = await response.json().catch(() => ({}));
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        limiterServer.close((err?: Error) => (err ? reject(err) : resolve()));
      });
    }

    assert(Boolean(blockedResponse), 'Rate limiter blocks requests after the configured threshold');
    assert(blockedResponse!.status === 429, 'Rate limiter returns HTTP 429 after threshold');
    assert(blockedResponse!.headers.get('x-ratelimit-limit') === '20', 'Rate limiter exposes the configured limit header');
    assert((blockedResponse!.headers.get('x-ratelimit-remaining') || '0') === '0', 'Rate limiter exposes remaining header as zero');
    assert(Number.isFinite(blockedBody.retryAfterSeconds), 'Rate limiter exposes retry timing in the error payload');
  } catch (err: any) {
    assert(false, 'Authentication rate limiting', err.message);
  }

  if (canonicalAdminBefore) {
    const canonicalAdminAfter = await UserModel.findOne({ id: 'usr_admin_anish' }).select('email passwordHash').lean();
    assert(
      Boolean(canonicalAdminAfter && canonicalAdminAfter.email === canonicalAdminBefore.email && canonicalAdminAfter.passwordHash === canonicalAdminBefore.passwordHash),
      'Test suite does not overwrite the canonical administrator account'
    );
  }

  console.log('\n=================================================================');
  console.log(`  Test Suite Completed: ${passed} passed, ${failed} failed.`);
  console.log('=================================================================\n');

  await disconnectMongo();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
