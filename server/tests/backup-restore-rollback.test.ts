import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Server } from 'node:http';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';

type RestoreRequest = (backup: Record<string, unknown>) => Promise<{
  status: number;
  body: Record<string, any>;
}>;

function installPatch(
  target: object,
  methodName: string,
  replacement: (original: (...args: unknown[]) => unknown, args: unknown[]) => unknown,
): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, methodName);
  const originalMethod = Reflect.get(target, methodName);
  if (typeof originalMethod !== 'function') throw new Error(`Could not find method ${methodName}.`);
  Object.defineProperty(target, methodName, {
    configurable: true,
    writable: true,
    value: (...args: unknown[]) => replacement(
      originalMethod as (...methodArgs: unknown[]) => unknown,
      args,
    ),
  });
  return () => {
    if (originalDescriptor) Object.defineProperty(target, methodName, originalDescriptor);
    else Reflect.deleteProperty(target, methodName);
  };
}

function withIntegrity(backup: Record<string, any>): Record<string, any> {
  const payload = {
    metadata: {
      timestamp: backup.metadata.timestamp,
      version: backup.metadata.version,
      type: backup.metadata.type,
      ...(backup.metadata.scope ? { scope: backup.metadata.scope } : {}),
    },
    collections: backup.collections,
  };
  backup.metadata.integrity = {
    algorithm: 'sha256',
    digest: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
  };
  return backup;
}

test('backup restore recovers every affected data area on failure and serializes restore requests', async (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-restore-rollback-'));
  let mongo: MongoMemoryServer | undefined;
  let server: Server | undefined;
  t.after(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongo) await mongo.stop();
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });
  process.env.NODE_ENV = 'test';
  delete process.env.MONGODB_URI;
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.PORTFOLIO_STORAGE_DIR = path.join(fixtureRoot, 'storage');
  process.env.PORTFOLIO_BACKUP_DIR = path.join(fixtureRoot, 'backups');

  const { MongoMemoryServer: MongoMemoryServerRuntime } = await import('mongodb-memory-server');
  mongo = await MongoMemoryServerRuntime.create({ instance: { dbName: 'backup_restore_fixture' } });
  const { db } = await import('../db/database');
  const {
    AdminContentDraftModel,
    AdminProjectDraftModel,
    AdminContentRevisionModel,
    AdminAuditLogModel,
    AnalyticsModel,
    ContactModel,
    FileMetadataModel,
    ProjectModel,
    SiteContentModel,
    UserModel,
  } = await import('../models');
  const { contentStudioService } = await import('../services/contentStudioService');
  const { fileService } = await import('../services/fileService');
  const { backupService } = await import('../services/backupService');
  const { normalizeSkillCategories } = await import('../services/skillCatalog');
  const { getLivePortfolioContent, adminRouter } = await import('../routes/admin');
  const express = (await import('express')).default;

  await mongoose.connect(mongo.getUri());
  await db.initMongoSync();

  const adminId = 'restore-test-admin';
  const fallbackContent = await getLivePortfolioContent();
  const originalContent = {
    ...fallbackContent,
    skills: normalizeSkillCategories(fallbackContent.skills),
  };
  const originalTagline = originalContent.profile.tagline;
  await SiteContentModel.deleteMany({ key: 'primary_portfolio_content' });
  await AdminContentDraftModel.deleteMany({ key: 'primary_portfolio_content' });
  await AdminContentRevisionModel.deleteMany({ key: 'primary_portfolio_content' });
  await SiteContentModel.create({
    ...originalContent,
    key: 'primary_portfolio_content',
    updatedAt: new Date().toISOString(),
  });
  await AdminContentDraftModel.create({
    key: 'primary_portfolio_content',
    content: originalContent,
    updatedBy: adminId,
  });
  await AdminContentRevisionModel.create({
    key: 'primary_portfolio_content',
    content: originalContent,
    publishedBy: adminId,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  const baselineAnalytics = [{
    id: 'restore-baseline-event',
    eventName: 'baseline',
    category: 'system',
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    timestamp: '2026-01-01T00:00:00.000Z',
  }];
  const baselineAuditLogs = [{
    id: 'restore-baseline-audit',
    adminId,
    adminEmail: 'restore-admin@example.test',
    action: 'BASELINE',
    targetType: 'Test',
    details: 'Baseline history',
    ipAddress: '127.0.0.1',
    outcome: 'success',
    timestamp: '2026-01-01T00:00:00.000Z',
  }];
  await AnalyticsModel.deleteMany({});
  await AnalyticsModel.insertMany(baselineAnalytics);
  db.analytics.splice(0, db.analytics.length, ...baselineAnalytics as any[]);
  await AdminAuditLogModel.deleteMany({});
  await AdminAuditLogModel.insertMany(baselineAuditLogs);

  const baselineProjects = await ProjectModel.find().lean();
  const baselineProjectIds = baselineProjects.map((project) => project.id).sort();
  const baselineDraftProjects = baselineProjects.map(({ _id, __v, ...project }) => project);
  await AdminProjectDraftModel.deleteMany({ key: 'primary_portfolio_projects' });
  await AdminProjectDraftModel.create({
    key: 'primary_portfolio_projects',
    projects: baselineDraftProjects,
    updatedBy: adminId,
  });
  const baselineContacts = [
    { id: 'restore-contact-one', name: 'Old One', email: 'restore-one@example.test', subject: 'old', message: 'old', timestamp: 'old', ipAddress: '127.0.0.1', userAgent: 'test', status: 'queued', emailSent: false },
    { id: 'restore-contact-two', name: 'Old Two', email: 'restore-two@example.test', subject: 'old', message: 'old', timestamp: 'old', ipAddress: '127.0.0.1', userAgent: 'test', status: 'queued', emailSent: false },
  ];
  const baselineUsers = [
    { id: 'restore-user-one', email: 'restore-user-one@example.test', passwordHash: 'dummy-hash-one', name: 'Old User One', role: 'user', disabled: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'restore-user-two', email: 'restore-user-two@example.test', passwordHash: 'dummy-hash-two', name: 'Old User Two', role: 'user', disabled: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ];
  await ContactModel.deleteMany({ id: { $in: baselineContacts.map((item) => item.id) } });
  await UserModel.deleteMany({ id: { $in: baselineUsers.map((item) => item.id) } });
  await ContactModel.insertMany(baselineContacts);
  await UserModel.insertMany(baselineUsers);
  baselineContacts.forEach((item) => db.contacts.set(item.id, item as any));
  baselineUsers.forEach((item) => db.users.set(item.id, item as any));

  const app = express();
  app.use(express.json({ limit: '70mb' }));
  app.use((req, _res, next) => {
    const authenticated = req as typeof req & {
      user?: { userId: string; email: string; role: 'admin' };
      sessionInfo?: { sessionId: string; csrfToken: string; userId: string; email: string; role: 'admin' };
    };
    authenticated.user = { userId: adminId, email: 'restore-admin@example.test', role: 'admin' };
    authenticated.sessionInfo = {
      sessionId: 'synthetic-session',
      csrfToken: 'synthetic-csrf',
      userId: adminId,
      email: 'restore-admin@example.test',
      role: 'admin',
    };
    next();
  });
  app.use('/api/admin', adminRouter);
  const testServer = app.listen(0, '127.0.0.1');
  server = testServer;
  await new Promise<void>((resolve, reject) => {
    testServer.once('listening', resolve);
    testServer.once('error', reject);
  });
  const address = testServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not start isolated restore test server.');
  const endpoint = `http://127.0.0.1:${address.port}/api/admin/backup/restore`;
  const restoreRequest: RestoreRequest = async (backup) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'synthetic-csrf' },
      body: JSON.stringify(backup),
    });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };

  const createBackup = async (version = '3.1.0') => {
    const content = structuredClone(originalContent);
    content.profile.tagline = 'Synthetic restored tagline';
    return withIntegrity({
      metadata: {
        timestamp: '2026-10-21T00:00:00.000Z',
        version,
        type: 'full-portfolio-assets',
      },
      collections: {
        publishedContent: content,
        draftContent: content,
        projects: [{
          id: 'restore-project-new',
          title: 'Synthetic Restore Project',
          description: 'Dummy fixture project',
          technologies: ['TypeScript'],
          category: 'Test',
          image: '',
          stars: 0,
          featured: false,
          createdAt: '2026-10-21T00:00:00.000Z',
        }],
        projectDrafts: [{
          id: 'restore-project-new',
          title: 'Synthetic restored draft project',
          description: 'Synthetic draft project description',
          technologies: ['TypeScript'],
          category: 'Test',
          image: '',
          stars: 0,
          featured: false,
          createdAt: '2026-10-21T00:00:00.000Z',
        }],
        media: [{
          sourceUrl: '/api/portfolio-media/original-synthetic-image',
          name: 'synthetic.png',
          extension: 'png',
          sizeBytes: 8,
          contentBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64'),
          storagePath: 'storage/resume/synthetic.png',
        }],
        contacts: baselineContacts.map((item) => ({ ...item, name: `Restored ${item.id}` })),
        users: baselineUsers.map((item) => ({ ...item, name: `Restored ${item.id}` })),
        analytics: [{
          id: 'restore-success-event',
          eventName: 'restored',
          category: 'navigation',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          timestamp: '2026-10-21T00:00:00.000Z',
        }],
        contentRevisions: [{
          key: 'primary_portfolio_content',
          content,
          publishedBy: adminId,
          publishedAt: '2026-10-21T00:00:00.000Z',
        }],
        auditLogs: [{
          id: 'restore-success-audit',
          adminId,
          adminEmail: 'restore-admin@example.test',
          action: 'SYNTHETIC',
          targetType: 'Test',
          details: 'Restored audit history',
          ipAddress: '127.0.0.1',
          outcome: 'success',
          timestamp: '2026-10-21T00:00:00.000Z',
        }],
      },
    });
  };

  const assertBaseline = async () => {
    const site = await SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean();
    const draft = await AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean();
    const projects = await ProjectModel.find().lean();
    const projectDraft = await AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean();
    const contacts = await ContactModel.find({ id: { $in: baselineContacts.map((item) => item.id) } }).lean();
    const users = await UserModel.find({ id: { $in: baselineUsers.map((item) => item.id) } }).lean();
    assert.equal(site?.profile?.tagline, originalTagline);
    assert.equal((draft?.content as any)?.profile?.tagline, originalTagline);
    assert.deepEqual(projects.map((project) => project.id).sort(), baselineProjectIds);
    assert.deepEqual(projectDraft?.projects.map((project) => project.id).sort(), baselineProjectIds);
    assert.deepEqual(contacts.map((contact) => contact.name).sort(), baselineContacts.map((item) => item.name).sort());
    assert.deepEqual(users.map((user) => user.name).sort(), baselineUsers.map((item) => item.name).sort());
    assert.equal(
      await AdminContentRevisionModel.countDocuments({
        key: 'primary_portfolio_content',
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      1,
      'baseline revision history must be present'
    );
    assert.deepEqual((await AnalyticsModel.find().lean()).map((item) => item.id).sort(), baselineAnalytics.map((item) => item.id));
    assert.deepEqual((await AdminAuditLogModel.find().lean()).map((item) => item.id).sort(), baselineAuditLogs.map((item) => item.id));
    assert.equal(await FileMetadataModel.countDocuments({ path: /^Portfolio\/Media\// }), 0);
    const mediaDirectory = path.join(fixtureRoot, 'storage', 'Portfolio', 'Media');
    if (fs.existsSync(mediaDirectory)) {
      assert.deepEqual(fs.readdirSync(mediaDirectory).filter((name) => name.endsWith('.png')), []);
    }
    const mediaIndexPath = path.join(fixtureRoot, 'storage', '.media-index.json');
    if (fs.existsSync(mediaIndexPath)) {
      const mediaIndex = JSON.parse(fs.readFileSync(mediaIndexPath, 'utf8')) as { files?: Array<{ path?: string }> };
      assert.deepEqual(mediaIndex.files?.filter((file) => file.path?.startsWith('Portfolio/Media/')), []);
    }
    assert.equal(db.projects.size, baselineProjects.length);
    baselineContacts.forEach((item) => assert.equal(db.contacts.get(item.id)?.name, item.name));
    assert.deepEqual(db.analytics.map((item) => item.id).sort(), baselineAnalytics.map((item) => item.id));
    baselineUsers.forEach((item) => assert.equal(db.users.get(item.id)?.name, item.name));
  };

  const resetBaseline = async () => {
    const restoredMedia = await FileMetadataModel.find({ path: /^Portfolio\/Media\// }).lean();
    for (const file of restoredMedia) {
      if (db.getFileById(file.id)) fileService.deleteFile(file.id);
      await FileMetadataModel.deleteOne({ id: file.id });
      db.files.delete(file.id);
    }
    await SiteContentModel.deleteMany({ key: 'primary_portfolio_content' });
    await SiteContentModel.create({
      ...originalContent,
      key: 'primary_portfolio_content',
      updatedAt: new Date().toISOString(),
    });
    await AdminContentDraftModel.deleteMany({ key: 'primary_portfolio_content' });
    await AdminContentDraftModel.create({
      key: 'primary_portfolio_content',
      content: originalContent,
      updatedBy: adminId,
    });
    await AdminContentRevisionModel.deleteMany({ key: 'primary_portfolio_content' });
    await AdminContentRevisionModel.create({
      key: 'primary_portfolio_content',
      content: originalContent,
      publishedBy: adminId,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await ProjectModel.deleteMany({});
    if (baselineProjects.length) await ProjectModel.insertMany(baselineProjects);
    db.projects.clear();
    baselineProjects.forEach((project) => db.projects.set(project.id, project as any));
    await AdminProjectDraftModel.findOneAndUpdate(
      { key: 'primary_portfolio_projects' },
      { $set: { projects: baselineDraftProjects, updatedBy: adminId } },
      { upsert: true }
    );
    await ContactModel.deleteMany({ id: { $in: baselineContacts.map((item) => item.id) } });
    await ContactModel.insertMany(baselineContacts);
    baselineContacts.forEach((item) => db.contacts.set(item.id, item as any));
    await AnalyticsModel.deleteMany({});
    await AnalyticsModel.insertMany(baselineAnalytics);
    db.analytics.splice(0, db.analytics.length, ...baselineAnalytics as any[]);
    await AdminAuditLogModel.deleteMany({});
    await AdminAuditLogModel.insertMany(baselineAuditLogs);
    await UserModel.deleteMany({ id: { $in: baselineUsers.map((item) => item.id) } });
    await UserModel.insertMany(baselineUsers);
    baselineUsers.forEach((item) => db.users.set(item.id, item as any));
  };

  try {
    await t.test('creates compact portfolio-only backups and excludes unreferenced media', async () => {
      const unreferenced = fileService.saveUploadedBuffer(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'unused.png',
        'Portfolio/Media/unused.png',
        'Portfolio/Media',
        adminId,
      );
      await FileMetadataModel.updateOne({ id: unreferenced.id }, { $set: unreferenced }, { upsert: true });

      try {
        const snapshot = await backupService.createSnapshot('full-portfolio-assets', originalContent);
        assert.equal(snapshot.metadata.scope, 'portfolio-only');
        assert.ok(Array.isArray(snapshot.collections.projectDrafts));
        assert.equal(snapshot.collections.contacts, undefined);
        assert.equal(snapshot.collections.analytics, undefined);
        assert.equal(snapshot.collections.contentRevisions, undefined);
        assert.equal(snapshot.collections.auditLogs, undefined);
        assert.equal(snapshot.collections.users, undefined);
        assert.ok(snapshot.collections.media.every((item) =>
          !('id' in item) && !('path' in item) &&
          item.sourceUrl !== `/api/portfolio-media/${unreferenced.id}`
        ));
      } finally {
        fileService.deleteFile(unreferenced.id);
        await FileMetadataModel.deleteOne({ id: unreferenced.id });
        db.files.delete(unreferenced.id);
      }
    });

    await t.test('successful checksummed restore and supported legacy no-checksum backup', async () => {
      const success = await restoreRequest(await createBackup());
      assert.equal(success.status, 200);
      assert.equal(success.body.success, true);
      assert.equal(success.body.restored.contacts, 2);
      assert.equal(success.body.restored.users, 2);
      assert.equal(success.body.restored.analytics, 1);
      assert.equal(success.body.restored.contentRevisions, 1);
      assert.equal(success.body.restored.auditLogs, 1);
      assert.deepEqual(
        (await AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean())?.projects.map((project) => project.id),
        ['restore-project-new']
      );
      assert.equal(await SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean().then((doc) => doc?.profile?.tagline), 'Synthetic restored tagline');
      assert.equal(await FileMetadataModel.countDocuments({ path: /^Portfolio\/Media\// }), 1);
      const restoredMediaFile = await FileMetadataModel.findOne({ path: /^Portfolio\/Media\// }).lean();
      assert.equal(restoredMediaFile && fileService.getStorageDisplayPath(restoredMediaFile), 'storage/resume/synthetic.png');
      assert.deepEqual((await AnalyticsModel.find().lean()).map((item) => item.id), ['restore-success-event']);
      assert.deepEqual((await AdminAuditLogModel.find({ id: 'restore-success-audit' }).lean()).map((item) => item.id), ['restore-success-audit']);

      const legacy = await createBackup('3.0.0');
      delete legacy.metadata.integrity;
      const legacyResponse = await restoreRequest(legacy);
      assert.equal(legacyResponse.status, 200);
      assert.equal(legacyResponse.body.success, true);
    });

    await t.test('restores compact portfolio data without replacing operational history', async () => {
      await resetBaseline();
      const compact = await createBackup();
      compact.metadata.scope = 'portfolio-only';
      for (const key of ['contacts', 'users', 'analytics', 'contentRevisions', 'auditLogs']) {
        delete compact.collections[key];
      }
      compact.collections.projectDrafts[0].title = 'Compact backup draft project';
      withIntegrity(compact);

      const response = await restoreRequest(compact);
      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.restored.contacts, 0);
      assert.equal(response.body.restored.analytics, 0);
      assert.equal(response.body.restored.contentRevisions, 0);
      assert.equal(response.body.restored.auditLogs, 0);
      assert.equal(
        await ContactModel.countDocuments({ id: { $in: baselineContacts.map((item) => item.id) } }),
        baselineContacts.length
      );
      assert.deepEqual((await AnalyticsModel.find().lean()).map((item) => item.id), baselineAnalytics.map((item) => item.id));
      assert.equal(
        await AdminAuditLogModel.countDocuments({ id: baselineAuditLogs[0].id }),
        1,
        'compact restore must retain existing audit history'
      );
      assert.equal(
        await AdminContentRevisionModel.countDocuments({
          key: 'primary_portfolio_content',
          publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
        1,
        'compact restore must retain existing content revision history'
      );
      assert.deepEqual(
        (await AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean())?.projects.map((project) => project.title),
        ['Compact backup draft project']
      );
    });

    await t.test('restores a backup with stale media references and reports removed links', async () => {
      await resetBaseline();
      const backup = await createBackup();
      const missingMediaUrl = '/api/portfolio-media/file-missing-from-backup';
      backup.collections.publishedContent.profile.avatar = missingMediaUrl;
      backup.collections.draftContent.profile.avatar = missingMediaUrl;
      backup.collections.contentRevisions[0].content.profile.avatar = missingMediaUrl;
      withIntegrity(backup);

      const response = await restoreRequest(backup);
      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.warnings.length, 1);
      assert.match(response.body.warnings[0], /file-missing-from-backup/);
      assert.equal(
        await SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean()
          .then((doc) => doc?.profile?.avatar),
        ''
      );
      assert.equal(
        await AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean()
          .then((doc) => (doc?.content as any)?.profile?.avatar),
        ''
      );
      assert.equal(
        await AdminContentRevisionModel.findOne({ key: 'primary_portfolio_content' }).lean()
          .then((doc) => (doc?.content as any)?.profile?.avatar),
        ''
      );
    });

    await t.test('rejects corrupted integrity before changing data', async () => {
      await resetBaseline();
      const corrupted = await createBackup();
      corrupted.collections.projects[0].title = 'Tampered synthetic project';
      const response = await restoreRequest(corrupted);
      assert.equal(response.status, 422);
      assert.match(response.body.error, /integrity/i);
    });

    await t.test('rolls back content, projects, contacts, users, media metadata and revision on late failure', async () => {
      await resetBaseline();
      const patchRestore = installPatch(contentStudioService, 'restoreBackup', async (original, args) => {
        await Reflect.apply(original, contentStudioService, args);
        throw new Error('synthetic failure after content mutation');
      });
      try {
        const response = await restoreRequest(await createBackup());
        assert.equal(response.status, 500);
        assert.equal(response.body.success, false);
        await assertBaseline();
      } finally {
        patchRestore();
      }
    });

    await t.test('waits for both content writes to settle before rollback', async () => {
      await resetBaseline();
      let releaseSiteWrite: (() => void) | undefined;
      let signalDraftFailure: (() => void) | undefined;
      const siteWriteBlocked = new Promise<void>((resolve) => { releaseSiteWrite = resolve; });
      const draftFailure = new Promise<void>((resolve) => { signalDraftFailure = resolve; });
      const patchSiteWrite = installPatch(SiteContentModel, 'findOneAndUpdate', async (original, args) => {
        await siteWriteBlocked;
        return await Reflect.apply(original, SiteContentModel, args);
      });
      const patchDraftWrite = installPatch(AdminContentDraftModel, 'findOneAndUpdate', async () => {
        signalDraftFailure?.();
        throw new Error('synthetic draft write failure');
      });
      try {
        const request = restoreRequest(await createBackup());
        await Promise.race([
          draftFailure,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Draft write did not fail.')), 5000)),
        ]);
        const completedBeforeSiteWrite = await Promise.race([
          request.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
        ]);
        assert.equal(completedBeforeSiteWrite, false);
        releaseSiteWrite?.();
        const response = await request;
        assert.equal(response.status, 500);
        await assertBaseline();
      } finally {
        releaseSiteWrite?.();
        patchDraftWrite();
        patchSiteWrite();
      }
    });

    await t.test('rolls back partial contact and user upserts after later failures', async () => {
      await resetBaseline();
      let projectStageContactCalls = 0;
      const patchProjectStage = installPatch(ContactModel, 'updateOne', () => {
        projectStageContactCalls += 1;
        throw new Error('synthetic failure after project replacement');
      });
      try {
        const response = await restoreRequest(await createBackup());
        assert.equal(response.status, 500);
        assert.equal(projectStageContactCalls, 1);
        await assertBaseline();
      } finally {
        patchProjectStage();
      }

      await resetBaseline();
      let contactCalls = 0;
      const patchContact = installPatch(ContactModel, 'updateOne', async (original, args) => {
        contactCalls += 1;
        if (contactCalls === 2) throw new Error('synthetic contact write failure');
        return await Reflect.apply(original, ContactModel, args);
      });
      try {
        const response = await restoreRequest(await createBackup());
        assert.equal(response.status, 500);
        assert.equal(contactCalls, 2);
        await assertBaseline();
      } finally {
        patchContact();
      }

      await resetBaseline();
      let userCalls = 0;
      const patchUser = installPatch(UserModel, 'updateOne', async (original, args) => {
        userCalls += 1;
        if (userCalls === 2) throw new Error('synthetic user write failure');
        return await Reflect.apply(original, UserModel, args);
      });
      try {
        const response = await restoreRequest(await createBackup());
        assert.equal(response.status, 500);
        assert.equal(userCalls, 2);
        await assertBaseline();
      } finally {
        patchUser();
      }
    });

    await t.test('reports rollback failure without including backup content', async () => {
      await resetBaseline();
      const patchRestore = installPatch(contentStudioService, 'restoreBackup', async (original, args) => {
        await Reflect.apply(original, contentStudioService, args);
        throw new Error('synthetic failure containing no user data');
      });
      const patchDelete = installPatch(SiteContentModel, 'deleteOne', () => {
        throw new Error('synthetic rollback failure');
      });
      try {
        const response = await restoreRequest(await createBackup());
        assert.equal(response.status, 500);
        assert.match(response.body.error, /rollback could not fully complete/i);
        assert.doesNotMatch(JSON.stringify(response.body), /Synthetic restored tagline|synthetic\.png/);
      } finally {
        patchDelete();
        patchRestore();
      }
    });

    await t.test('rejects a concurrent restore while the first restore is active', async () => {
      await resetBaseline();
      let resumeRestore: (() => void) | undefined;
      let restoreStarted: (() => void) | undefined;
      const started = new Promise<void>((resolve) => { restoreStarted = resolve; });
      const blocked = new Promise<void>((resolve) => { resumeRestore = resolve; });
      const patchRestore = installPatch(contentStudioService, 'restoreBackup', async (original, args) => {
        restoreStarted?.();
        await blocked;
        return await Reflect.apply(original, contentStudioService, args);
      });
      try {
        const firstRequest = restoreRequest(await createBackup());
        await Promise.race([
          started,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('First restore did not reach the mutation stage.')), 5000)),
        ]);
        const second = await restoreRequest(await createBackup());
        assert.equal(second.status, 409);
        assert.equal(second.body.success, false);
        resumeRestore?.();
        const first = await firstRequest;
        assert.equal(first.status, 200);
      } finally {
        resumeRestore?.();
        patchRestore();
      }
    });
  } finally {
    server.closeAllConnections();
  }
});
