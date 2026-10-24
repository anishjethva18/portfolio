import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';

test('new portfolio media uploads use their private storage category while retaining existing URLs', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-file-categories-'));
  process.env.PORTFOLIO_STORAGE_DIR = storageRoot;
  process.env.NODE_ENV = 'test';
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  delete process.env.MONGODB_URI;
  delete process.env.CAPTURE_ARCHIVE_ROOT;
  delete process.env.USER_CAPTURE_ROOT;
  delete process.env.ADMIN_ARCHIVE_ROOT;

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongo = await MongoMemoryServer.create({ instance: { dbName: 'file_storage_categories_test' } });
  await mongoose.connect(mongo.getUri());
  const { fileService, isFileStorageCategory } = await import('../services/fileService');
  const { windowsStorageService } = await import('../services/windowsStorageService');
  const { backupService } = await import('../services/backupService');
  const { FileMetadataModel } = await import('../models/FileMetadata');
  const { db } = await import('../db/database');
  const storedIds: string[] = [];
  t.after(async () => {
    await FileMetadataModel.deleteMany({ id: { $in: storedIds } });
    for (const id of storedIds) db.files.delete(id);
    await mongoose.disconnect();
    await mongo.stop();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  const fixtures = [
    { category: 'resume', name: 'resume.pdf' },
    { category: 'profile', name: 'avatar.png' },
    { category: 'profile', name: 'wallpaper.jpg' },
    { category: 'certificates', name: 'certificate.png' },
    { category: 'project', name: 'project.png' },
  ] as const;
  for (const directory of ['resume', 'profile', 'certificates', 'project']) {
    assert.equal(fs.existsSync(path.join(storageRoot, ...directory.split('/'))), true);
  }

  for (const fixture of fixtures) {
    const saved = fileService.saveUploadedBuffer(
      Buffer.from('synthetic fixture only'),
      fixture.name,
      `Portfolio/Media/${fixture.name}`,
      'Portfolio/Media',
      'synthetic-admin',
      fixture.category,
    );
    storedIds.push(saved.id);
    assert.equal(saved.diskPath, path.join(storageRoot, ...fixture.category.split('/'), fixture.name));
    assert.equal(fs.existsSync(saved.diskPath), true);
    assert.equal(saved.path.startsWith('Portfolio/Media/'), true);
    assert.equal(typeof saved.url, 'string');
    assert.match(saved.url || '', /^\/api\/portfolio-media\/file-/);
  }
  await FileMetadataModel.find({ id: { $in: storedIds } }).lean();

  const legacyCompatibleMedia = fileService.saveUploadedBuffer(
    Buffer.from('legacy-compatible fixture'),
    'legacy.png',
    'Portfolio/Media/legacy.png',
    'Portfolio/Media',
    'synthetic-admin',
  );
  storedIds.push(legacyCompatibleMedia.id);
  assert.equal(legacyCompatibleMedia.diskPath, path.join(storageRoot, 'profile', 'legacy.png'));

  assert.equal(await fileService.migrateLegacyPortfolioMedia(), 0);
  for (const id of storedIds) {
    const file = fileService.getFileById(id);
    assert.ok(file?.diskPath);
    assert.equal(fs.existsSync(file.diskPath), true);
  }

  assert.equal(isFileStorageCategory('profile'), true);
  assert.equal(isFileStorageCategory('AdminArchive'), false);
  assert.equal(
    windowsStorageService.getCaptureArchiveRoot(),
    path.join(storageRoot, 'AdminArchive'),
  );
  assert.equal(fs.existsSync(path.join(storageRoot, 'AdminArchive', 'CaptureImage')), true);
  assert.equal(fs.existsSync(path.join(storageRoot, 'AdminArchive', 'CaptureVideo')), true);
  assert.equal(fs.existsSync(path.join(storageRoot, 'backup')), true);
  assert.equal(backupService.getLatestBackup(), null);

  const photoArchive = windowsStorageService.saveConsentedCapture(
    Buffer.from('synthetic photo archive'),
    'synthetic-photo.jpg',
    'photo',
  );
  const videoArchive = windowsStorageService.saveConsentedCapture(
    Buffer.from('synthetic video archive'),
    'synthetic-video.mp4',
    'video',
  );
  assert.equal(photoArchive.filePath, path.join(storageRoot, 'AdminArchive', 'CaptureImage', 'synthetic-photo.jpg'));
  assert.equal(videoArchive.filePath, path.join(storageRoot, 'AdminArchive', 'CaptureVideo', 'synthetic-video.mp4'));
  fs.unlinkSync(photoArchive.filePath);
  fs.unlinkSync(videoArchive.filePath);

  const migrationCandidate = fileService.saveUploadedBuffer(
    Buffer.from('synthetic migration sample'),
    'legacy-resume.pdf',
    'Portfolio/Media/legacy-resume.pdf',
    'Portfolio/Media',
    'synthetic-admin',
  );
  storedIds.push(migrationCandidate.id);
  const legacySourcePath = path.join(storageRoot, 'Portfolio', 'Media', 'legacy-resume.pdf');
  fs.mkdirSync(path.dirname(legacySourcePath), { recursive: true });
  fs.renameSync(migrationCandidate.diskPath || '', legacySourcePath);
  const legacyMetadata = { ...migrationCandidate, diskPath: legacySourcePath };
  await FileMetadataModel.updateOne(
    { id: migrationCandidate.id },
    { $set: legacyMetadata },
    { upsert: true },
  );
  assert.equal(
    await FileMetadataModel.findOne({ id: migrationCandidate.id }).lean().then((doc) => doc?.diskPath),
    legacySourcePath,
  );
  db.files.set(migrationCandidate.id, legacyMetadata);
  const migration = await fileService.migratePortfolioMediaFiles(new Map([[migrationCandidate.id, 'resume']]));
  const migrated = db.getFileById(migrationCandidate.id);
  assert.equal(migration.moved, 1);
  assert.equal(migration.cleanupPending.length, 0);
  assert.equal(fs.existsSync(legacySourcePath), false);
  assert.equal(migrated?.diskPath, path.join(storageRoot, 'resume', 'legacy-resume.pdf'));
  assert.equal(await FileMetadataModel.findOne({ id: migrationCandidate.id }).lean().then((doc) => doc?.diskPath), migrated?.diskPath);

  const repeatedPlan = fileService.getPortfolioMediaMigrationPlan(new Map([[migrationCandidate.id, 'resume']]));
  assert.equal(repeatedPlan.length, 1);
  assert.equal(repeatedPlan[0].sourcePath, repeatedPlan[0].destinationPath);
  assert.equal(
    repeatedPlan[0].sha256,
    crypto.createHash('sha256').update('synthetic migration sample').digest('hex'),
  );

  const conflictingMedia = fileService.saveUploadedBuffer(
    Buffer.from('synthetic conflict fixture'),
    'conflict.pdf',
    'Portfolio/Media/conflict.pdf',
    'Portfolio/Media',
    'synthetic-admin',
  );
  storedIds.push(conflictingMedia.id);
  const conflictSource = path.join(storageRoot, 'Portfolio', 'Media', 'conflict.pdf');
  fs.mkdirSync(path.dirname(conflictSource), { recursive: true });
  fs.renameSync(conflictingMedia.diskPath || '', conflictSource);
  const conflictMetadata = { ...conflictingMedia, diskPath: conflictSource };
  await FileMetadataModel.updateOne(
    { id: conflictingMedia.id },
    { $set: conflictMetadata },
    { upsert: true },
  );
  db.files.set(conflictingMedia.id, conflictMetadata);
  const conflictDestination = path.join(storageRoot, 'resume', 'conflict.pdf');
  fs.writeFileSync(conflictDestination, 'pre-existing synthetic destination');
  assert.throws(
    () => fileService.getPortfolioMediaMigrationPlan(new Map([[conflictingMedia.id, 'resume']])),
    /Destination already exists; refusing to overwrite/,
  );
  assert.throws(
    () => fileService.getPortfolioMediaMigrationPlan(new Map([['missing-media-id', 'resume']])),
    /Referenced portfolio media metadata is unavailable/,
  );

  const legacyBackupDirectory = path.join(storageRoot, 'AdminArchive', 'Backups');
  fs.mkdirSync(legacyBackupDirectory, { recursive: true });
  const legacyBackupPath = path.join(legacyBackupDirectory, 'full-backup-2026-10-21T10-00-00-000Z.json');
  fs.writeFileSync(legacyBackupPath, JSON.stringify({
    metadata: { timestamp: '2026-10-21T10:00:00.000Z', type: 'full-portfolio-assets' },
    collections: { media: [] },
  }));
  assert.equal(backupService.getLegacyBackupMigrationPlan().length, 1);
  const backupMove = backupService.migrateLegacyBackupFiles();
  assert.equal(backupMove.moved, 1);
  assert.equal(fs.existsSync(legacyBackupPath), false);
  assert.equal(fs.existsSync(path.join(storageRoot, 'backup', path.basename(legacyBackupPath))), true);

  await fileService.restorePortfolioMediaIndex();
  assert.equal(fs.existsSync(path.join(storageRoot, '.media-index.json')), true);
  assert.equal(fs.existsSync(conflictSource), true);
  assert.equal(fs.existsSync(path.join(storageRoot, 'resume', 'legacy-resume.pdf')), true);

  const emptyLegacyDirectory = path.join(storageRoot, 'UnclassifiedEmpty');
  const nonEmptyLegacyDirectory = path.join(storageRoot, 'UnclassifiedWithData');
  fs.mkdirSync(emptyLegacyDirectory);
  fs.mkdirSync(nonEmptyLegacyDirectory);
  fs.writeFileSync(path.join(nonEmptyLegacyDirectory, 'keep.txt'), 'Preserve unclassified data.');
  const remainingDirectories = fileService.removeEmptyUnapprovedStorageDirectories();
  assert.equal(fs.existsSync(emptyLegacyDirectory), false);
  assert.equal(fs.existsSync(path.join(nonEmptyLegacyDirectory, 'keep.txt')), true);
  assert.equal(remainingDirectories.includes('UnclassifiedWithData'), true);
});
