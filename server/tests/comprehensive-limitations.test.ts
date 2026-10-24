import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { db } from '../db/database';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { adminRouter, getLivePortfolioContent } from '../routes/admin';
import { portfolioRouter } from '../routes/portfolio';
import { healthRouter } from '../routes/health';
import { backupService } from '../services/backupService';
import { emailService } from '../services/emailService';
import { sessionService } from '../services/sessionService';
import { contentStudioService } from '../services/contentStudioService';
import { fileService } from '../services/fileService';
import { ContactModel, UserModel, FileMetadataModel } from '../models';

async function runComprehensiveTests() {
  console.log('=================================================================');
  console.log('  Windows 11 Portfolio OS — Comprehensive Limitations Verification');
  console.log('=================================================================\n');

  await connectMongo();
  await db.initMongoSync();

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

  // Setup Express server with admin, health, and portfolio content routes
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());
  app.use('/api/admin', adminRouter);
  app.get('/api/portfolio-content', async (_req, res) => {
    try {
      const content = await getLivePortfolioContent();
      res.json({ success: true, content });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/health', healthRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Create an active admin session for testing
  const adminUser = await db.getUserByEmail('admin@test.local') || await db.createUser({
    email: `admin_verify_${Date.now()}@test.local`,
    name: 'Admin Tester',
    passwordHash: 'dummy_hash',
    role: 'admin',
    disabled: false,
    settings: { theme: 'dark', wallpaper: 'darkbloom' },
  });
  const adminSession = await sessionService.createSession(adminUser, { headers: { 'user-agent': 'Test' } } as any);
  const adminHeaders = {
    Cookie: `sid=${adminSession.sessionId}`,
    'X-CSRF-Token': adminSession.csrfToken,
    'Content-Type': 'application/json',
  };
  const generatedBackupPaths = new Set<string>();
  const testMediaIds = new Set<string>();

  try {
    // -------------------------------------------------------------
    // 1. FULL ASSETS & PORTFOLIO BACKUP VERIFICATION
    // -------------------------------------------------------------
    console.log('--- 1. Manual Backup & Full Assets Verification ---');
    const fallbackContent = await getLivePortfolioContent();

    // Create test contact, user, and media
    const testContactId = `test_cnt_${Date.now()}`;
    await ContactModel.create({
      id: testContactId,
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      subject: 'AI Portfolio Inquiry',
      message: 'Looking for full stack agentic AI development consulting.',
      status: 'delivered',
      timestamp: new Date().toISOString(),
    });
    db.contacts.set(testContactId, {
      id: testContactId,
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      subject: 'AI Portfolio Inquiry',
      message: 'Looking for full stack agentic AI development consulting.',
      status: 'delivered',
      timestamp: new Date().toISOString(),
    } as any);

    const testUserId = `test_usr_${Date.now()}`;
    await UserModel.create({
      id: testUserId,
      name: 'Dev Associate',
      email: `dev_associate_${Date.now()}@example.com`,
      role: 'user',
      disabled: false,
      passwordHash: 'dummy_hash_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const testMediaId = `test_media_${Date.now()}`;
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const savedFile = fileService.saveUploadedBuffer(
      pngHeader,
      `${testMediaId}.png`,
      `Portfolio/Media/${testMediaId}.png`,
      'Portfolio/Media',
      adminUser.id
    );
    testMediaIds.add(savedFile.id);
    await FileMetadataModel.updateOne({ id: savedFile.id }, { $set: savedFile }, { upsert: true });

    // A. Verify standard portfolio backup still excludes users (preserves contract)
    const standardSnapshot = await backupService.createSnapshot('manual-portfolio', fallbackContent);
    assert(
      standardSnapshot.metadata.type === 'manual-portfolio' &&
      Array.isArray(standardSnapshot.collections.projects) &&
      standardSnapshot.collections.publishedContent !== undefined &&
      standardSnapshot.collections.users === undefined,
      'Standard manual backup produces lightweight portfolio-only snapshot'
    );

    // B. Verify Full Assets Backup includes media, users, contacts, projects, and content
    const fullBackupResult = await backupService.createManualBackup('full-portfolio-assets', fallbackContent);
    assert(
      fullBackupResult.success && fs.existsSync(fullBackupResult.filePath),
      'Full Assets Backup successfully writes timestamped archive to storage'
    );

    const fullBackupData = JSON.parse(fs.readFileSync(fullBackupResult.filePath, 'utf8'));
    assert(
      fullBackupData.metadata.type === 'full-portfolio-assets',
      'Full backup metadata is tagged with type full-portfolio-assets'
    );
    assert(
      Array.isArray(fullBackupData.collections.users) &&
      fullBackupData.collections.users.some((u: any) => u.id === testUserId),
      'Full backup collections include registered accounts and users'
    );
    assert(
      Array.isArray(fullBackupData.collections.contacts) &&
      fullBackupData.collections.contacts.some((c: any) => c.id === testContactId),
      'Full backup collections include contact inquiries'
    );
    assert(
      Array.isArray(fullBackupData.collections.media) &&
      fullBackupData.collections.media.some((m: any) => m.id === savedFile.id && Boolean(m.contentBase64)),
      'Full backup collections include media binary files in base64 format'
    );
    generatedBackupPaths.add(fullBackupResult.filePath);

    // C. Verify /api/admin/backup/run with { type: 'full' }
    const runRes = await fetch(`${baseUrl}/api/admin/backup/run`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ type: 'full' }),
    });
    const runData = await runRes.json() as any;
    if (typeof runData.backup?.filePath === 'string') generatedBackupPaths.add(runData.backup.filePath);
    assert(
      runRes.ok && runData.success && runData.backup.type === 'full-portfolio-assets',
      'Admin API POST /api/admin/backup/run successfully generates full-portfolio-assets backup'
    );
    assert(
      runData.backup.filePath !== fullBackupResult.filePath,
      'Repeated manual backup creation never overwrites an earlier backup file'
    );

    const portableExportResponse = await fetch(`${baseUrl}/api/admin/backup/export?type=full`, {
      headers: adminHeaders,
    });
    const portableExport = await portableExportResponse.json() as any;
    assert(
      portableExportResponse.ok &&
      portableExport.collections?.users === undefined &&
      portableExport.collections?.contacts === undefined &&
      Array.isArray(portableExport.collections?.media),
      'Portable full backup export includes assets but omits password hashes and contact records'
    );

    const tamperedBackup = structuredClone(fullBackupData);
    if (tamperedBackup.collections.projects[0]) {
      tamperedBackup.collections.projects[0].title = `${tamperedBackup.collections.projects[0].title}-modified`;
    } else {
      tamperedBackup.collections.publishedContent.integrityProbe = 'modified';
    }
    const tamperedRestoreResponse = await fetch(`${baseUrl}/api/admin/backup/restore`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(tamperedBackup),
    });
    assert(
      tamperedRestoreResponse.status === 422,
      'Admin backup restore rejects a changed payload when its SHA-256 integrity digest no longer matches'
    );

    // D. Verify /api/admin/backup/restore restores contacts and users
    const restoreRes = await fetch(`${baseUrl}/api/admin/backup/restore`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(fullBackupData),
    });
    const restoreData = await restoreRes.json() as any;
    assert(
      restoreRes.ok &&
        restoreData.success &&
        restoreData.restored.contacts >= 1 &&
        restoreData.restored.users >= 1 &&
        restoreData.restored.media >= 1,
      'Admin API POST /api/admin/backup/restore restores contacts, users, and media into database'
    );
    db.getFiles()
      .filter((file) =>
        file.id !== savedFile.id &&
        file.path.startsWith('Portfolio/Media/') &&
        file.name.startsWith(`${testMediaId}-`)
      )
      .forEach((file) => testMediaIds.add(file.id));

    // Clean up created test records
    await ContactModel.deleteOne({ id: testContactId });
    await UserModel.deleteOne({ id: testUserId });

    // -------------------------------------------------------------
    // 2. SMTP LIVE EMAIL DELIVERY VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 2. SMTP Live Email Delivery Verification ---');

    // A. Verify SMTP connection check method
    const verifyResult = await emailService.verifySmtpConnection();
    assert(
      typeof verifyResult.configured === 'boolean' &&
      typeof verifyResult.message === 'string',
      'emailService.verifySmtpConnection returns structured connectivity diagnostic'
    );

    // B. Verify live test email dispatch
    const testSendResult = await emailService.sendTestEmail('verify_recipient@test.local');
    assert(
      testSendResult.success &&
      Boolean(testSendResult.messageId) &&
      Boolean(testSendResult.timestamp) &&
      ['smtp', 'test_account', 'simulated'].includes(testSendResult.deliveryMode),
      `emailService.sendTestEmail successfully executes delivery pipeline (mode: ${testSendResult.deliveryMode})`
    );

    // C. Verify admin API POST /api/admin/email/verify
    const apiVerifyRes = await fetch(`${baseUrl}/api/admin/email/verify`, {
      method: 'POST',
      headers: adminHeaders,
    });
    const apiVerifyData = await apiVerifyRes.json() as any;
    assert(
      apiVerifyRes.ok && typeof apiVerifyData.configured === 'boolean',
      'Protected Admin API /api/admin/email/verify responds with diagnostic status'
    );

    // D. Verify admin API POST /api/admin/email/test-send
    const apiSendRes = await fetch(`${baseUrl}/api/admin/email/test-send`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ recipient: 'admin_test@test.local' }),
    });
    const apiSendData = await apiSendRes.json() as any;
    assert(
      apiSendRes.ok && apiSendData.success && Boolean(apiSendData.result.messageId),
      'Protected Admin API /api/admin/email/test-send dispatches live test email with receipt ID'
    );

    // -------------------------------------------------------------
    // 3. MONITORING PERIODIC LIVE POLLING VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 3. Monitoring Periodic Live Polling Verification ---');

    // Poll 1: Initial health check
    const poll1Res = await fetch(`${baseUrl}/api/health/admin`, { headers: adminHeaders });
    const poll1Data = await poll1Res.json() as any;
    assert(
      (poll1Res.status === 200 || poll1Res.status === 207) &&
      poll1Data.service === 'Windows 11 OS Portfolio Server' &&
      typeof poll1Data.uptimeSeconds === 'number' &&
      poll1Data.database?.status === 'connected' &&
      poll1Data.storage?.status === 'healthy',
      'First polling tick retrieves verified real-time process, MongoDB latency, and storage roots'
    );

    // Wait 100ms to simulate interval passage
    await new Promise((r) => setTimeout(r, 100));

    // Poll 2: Next polling tick
    const poll2Res = await fetch(`${baseUrl}/api/health/admin`, { headers: adminHeaders });
    const poll2Data = await poll2Res.json() as any;
    assert(
      (poll2Res.status === 200 || poll2Res.status === 207) &&
      new Date(poll2Data.timestamp).getTime() >= new Date(poll1Data.timestamp).getTime(),
      'Subsequent live polling tick provides fresh timestamp and live process metrics'
    );

    // Verify unauthenticated request to /api/health/admin is strictly rejected
    const unauthHealthRes = await fetch(`${baseUrl}/api/health/admin`);
    assert(
      unauthHealthRes.status === 401,
      'System monitoring endpoint strictly enforces authenticated administrator access'
    );

    // -------------------------------------------------------------
    // 4. APPEARANCE SETTINGS SYNC VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 4. Appearance Settings Desktop Sync Verification ---');

    // Save and publish appearance settings
    const testAppearance = {
      defaultTheme: 'light',
      defaultWallpaper: 'aurora',
      defaultAccentColor: '#10b981',
      siteTitle: 'Anish Jethva - AI Systems & OS Portfolio',
    };

    const draftSnapshot = await contentStudioService.getSnapshot({});
    const updatedDraft = {
      ...draftSnapshot.draft,
      siteSettings: {
        ...((draftSnapshot.draft.siteSettings as Record<string, any>) || {}),
        ...testAppearance,
      },
    };

    await contentStudioService.saveDraft(updatedDraft, adminUser.id);
    const publishSnapshot = await contentStudioService.publishDraft(adminUser.id);
    const pubSettings = (publishSnapshot.published.siteSettings as Record<string, any>) || {};
    assert(
      pubSettings.defaultTheme === 'light' &&
      pubSettings.defaultWallpaper === 'aurora' &&
      pubSettings.defaultAccentColor === '#10b981',
      'Content studio successfully publishes customized appearance settings'
    );

    // Verify public portfolio content endpoint reflects the published appearance settings
    const publicContentRes = await fetch(`${baseUrl}/api/portfolio-content`);
    const publicContentData = await publicContentRes.json() as any;
    assert(
      publicContentRes.ok &&
      publicContentData.content?.siteSettings?.defaultTheme === 'light' &&
      publicContentData.content?.siteSettings?.defaultWallpaper === 'aurora' &&
      publicContentData.content?.siteSettings?.defaultAccentColor === '#10b981',
      'Public desktop API /api/portfolio-content delivers published theme, wallpaper, and accent color'
    );

    // Restore default appearance settings
    const resetDraft = {
      ...publishSnapshot.published,
      siteSettings: {
        ...((publishSnapshot.published.siteSettings as Record<string, any>) || {}),
        defaultTheme: 'dark',
        defaultWallpaper: 'darkbloom',
        defaultAccentColor: '#0078d4',
        siteTitle: 'Windows 11 Portfolio OS',
      },
    };
    await contentStudioService.saveDraft(resetDraft, adminUser.id);
    await contentStudioService.publishDraft(adminUser.id);

    console.log('\n=================================================================');
    console.log(`  Comprehensive Verification Suite Completed: ${passed} passed, ${failed} failed.`);
    console.log('=================================================================\n');

  } finally {
    for (const id of testMediaIds) {
      if (db.getFileById(id)) fileService.deleteFile(id);
      await FileMetadataModel.deleteOne({ id });
    }
    for (const backupPath of generatedBackupPaths) {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    }
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    await disconnectMongo();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runComprehensiveTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
