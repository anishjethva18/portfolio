import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CaptureMigrationExport,
  generateCaptureMigrationManifest,
  verifyCaptureMigrationManifest,
} from '../services/captureMigrationManifest';

const createRecord = (
  overrides: Partial<CaptureMigrationExport['records'][number]>
): CaptureMigrationExport['records'][number] => ({
  id: 'cap_fixture_photo_a',
  userId: 'fixture-user',
  mediaType: 'photo',
  fileName: 'dummy-photo.jpg',
  userCapturePath: '',
  adminArchivePath: '',
  fileSize: 0,
  userSaved: false,
  adminArchived: true,
  archiveExpiry: '',
  archiveConsentAt: '2026-10-20T12:00:00.000Z',
  deleted: false,
  timestamp: '2026-10-20T12:00:00.000Z',
  ...overrides,
});

const createSnapshots = (sourceRootIds: string[], evidenceRoot: string) => {
  const databasePath = path.join(evidenceRoot, 'synthetic-database-snapshot.json');
  const filesystemPath = path.join(evidenceRoot, 'synthetic-filesystem-snapshot.json');
  fs.writeFileSync(databasePath, JSON.stringify({ records: ['synthetic-capture-record'] }));
  fs.writeFileSync(filesystemPath, JSON.stringify({ sourceRootIds, files: ['synthetic-fixture-file'] }));
  const digest = (filePath: string) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return {
    database: {
      artifactId: 'synthetic-database-snapshot',
      artifactPath: databasePath,
      sha256: digest(databasePath),
      verified: true,
      isolated: true,
    },
    filesystem: {
      artifactId: 'synthetic-filesystem-snapshot',
      artifactPath: filesystemPath,
      sha256: digest(filesystemPath),
      verified: true,
      isolated: true,
      sourceRootIds,
    },
  };
};

test('synthetic capture manifest hashes files, maps metadata, flags conflicts and never writes', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-manifest-fixture-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  const storageRoot = path.join(fixtureRoot, 'isolated-storage');
  const sourceRoot = path.join(fixtureRoot, 'legacy-camera-root');
  const photoPath = path.join(sourceRoot, 'photos', 'dummy-photo.jpg');
  const duplicatePhotoPath = path.join(sourceRoot, 'photos', 'dummy-photo-copy.jpg');
  const videoPath = path.join(sourceRoot, 'videos', 'dummy-video.mp4');
  const collisionSourcePath = path.join(sourceRoot, 'photos', 'collision-source.jpg');
  const orphanPath = path.join(sourceRoot, 'unreferenced-dummy.bin');
  const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x44, 0x55]);
  const videoBytes = Buffer.from('synthetic-video-fixture');
  fs.mkdirSync(path.dirname(photoPath), { recursive: true });
  fs.mkdirSync(path.dirname(videoPath), { recursive: true });
  fs.writeFileSync(photoPath, photoBytes);
  fs.writeFileSync(duplicatePhotoPath, photoBytes);
  fs.writeFileSync(videoPath, videoBytes);
  fs.writeFileSync(collisionSourcePath, Buffer.from('synthetic-collision-source'));
  fs.writeFileSync(orphanPath, Buffer.from('synthetic-unreferenced-file'));

  const conflictDestination = path.join(
    storageRoot,
    'AdminArchive',
    'Captures',
    'Photos',
    'cap_fixture_collision_collision.jpg'
  );
  fs.mkdirSync(path.dirname(conflictDestination), { recursive: true });
  fs.writeFileSync(conflictDestination, Buffer.from('existing-destination-must-not-change'));
  const originalConflictBytes = fs.readFileSync(conflictDestination);

  const captureExport: CaptureMigrationExport = {
    format: 'capture-record-export-v1',
    sourceEnvironment: 'synthetic-test',
    syntheticOnly: true,
    exportedAt: '2026-10-20T12:00:00.000Z',
    stagingSnapshots: createSnapshots(['fixture-legacy-root'], fixtureRoot),
    sourceRoots: [{ id: 'fixture-legacy-root', path: sourceRoot }],
    records: [
      createRecord({ adminArchivePath: photoPath, fileSize: photoBytes.length }),
      createRecord({
        id: 'cap_fixture_photo_b',
        fileName: 'dummy-photo-copy.jpg',
        adminArchivePath: duplicatePhotoPath,
        fileSize: photoBytes.length,
      }),
      createRecord({
        id: 'cap_fixture_video',
        mediaType: 'video',
        fileName: 'dummy-video.mp4',
        adminArchivePath: videoPath,
        fileSize: videoBytes.length,
      }),
      createRecord({
        id: 'cap_fixture_missing',
        adminArchivePath: path.join(sourceRoot, 'photos', 'missing-dummy.jpg'),
        fileSize: 1,
      }),
      createRecord({
        id: 'cap_fixture_collision',
        fileName: 'collision.jpg',
        adminArchivePath: collisionSourcePath,
        fileSize: fs.statSync(collisionSourcePath).size,
      }),
    ],
  };

  const manifest = generateCaptureMigrationManifest(
    captureExport,
    storageRoot,
    '2026-10-21T00:00:00.000Z'
  );
  const verification = verifyCaptureMigrationManifest(manifest, storageRoot);

  assert.equal(manifest.syntheticOnly, true);
  assert.equal(manifest.execution, 'manifest-only-no-copy-no-database-write');
  assert.equal(manifest.approvedDestinationRoot, path.join(storageRoot, 'AdminArchive', 'Captures'));
  assert.equal(manifest.entries.length, 5);
  assert.equal(manifest.duplicateHashes.length, 1);
  assert.equal(manifest.duplicateHashes[0].recordIds.length, 2);
  assert.equal(manifest.entries.find((entry) => entry.recordId === 'cap_fixture_missing')?.sourceStatus, 'missing');
  assert.equal(manifest.entries.find((entry) => entry.recordId === 'cap_fixture_collision')?.destinationStatus, 'already-exists');
  assert.equal(manifest.entries.find((entry) => entry.recordId === 'cap_fixture_photo_a')?.databaseReferences.pathField, 'adminArchivePath');
  assert.equal(manifest.entries.find((entry) => entry.recordId === 'cap_fixture_photo_a')?.mediaIndexReferences.applies, false);
  assert.equal(manifest.entries.find((entry) => entry.recordId === 'cap_fixture_photo_a')?.rollback.restoreValue, photoPath);
  assert.equal(manifest.entries.find((entry) => entry.recordId === 'cap_fixture_missing')?.sourceExists, false);
  assert.equal(manifest.orphanSourceFiles.length, 1);
  assert.ok(manifest.entries.every((entry) =>
    path.relative(manifest.approvedDestinationRoot, entry.destinationPath).split(path.sep)[0] !== '..'
  ));
  assert.deepEqual(fs.readFileSync(conflictDestination), originalConflictBytes);
  assert.ok(fs.existsSync(photoPath) && fs.existsSync(duplicatePhotoPath) && fs.existsSync(videoPath));
  assert.equal(verification.pathsSafe, true);
  assert.equal(verification.verifiedSources, 4);
  assert.equal(verification.missingSources, 1);
  assert.equal(verification.changedSources, 0);
  assert.equal(verification.destinationConflicts, 1);

  fs.writeFileSync(videoPath, Buffer.from('changed-synthetic-video'));
  const changedVerification = verifyCaptureMigrationManifest(manifest, storageRoot);
  assert.equal(changedVerification.changedSources, 1);
});

test('manifest detects case-insensitive destination filename collisions without writing', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-manifest-name-conflict-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const sourceRoot = path.join(fixtureRoot, 'confirmed-root');
  fs.mkdirSync(sourceRoot, { recursive: true });
  const firstPath = path.join(sourceRoot, 'first.jpg');
  const secondPath = path.join(sourceRoot, 'second.jpg');
  fs.writeFileSync(firstPath, Buffer.from('first synthetic file'));
  fs.writeFileSync(secondPath, Buffer.from('second synthetic file'));

  const captureExport: CaptureMigrationExport = {
    format: 'capture-record-export-v1',
    sourceEnvironment: 'synthetic-test',
    syntheticOnly: true,
    exportedAt: '2026-10-20T12:00:00.000Z',
    stagingSnapshots: createSnapshots(['confirmed-fixture-root'], fixtureRoot),
    sourceRoots: [{ id: 'confirmed-fixture-root', path: sourceRoot }],
    records: [
      createRecord({ id: 'cap_fixture_CASE', adminArchivePath: firstPath, fileSize: 20 }),
      createRecord({ id: 'cap_fixture_case', adminArchivePath: secondPath, fileSize: 21 }),
    ],
  };
  const storageRoot = path.join(fixtureRoot, 'storage');
  const manifest = generateCaptureMigrationManifest(captureExport, storageRoot);
  assert.ok(manifest.entries.every((entry) => entry.destinationStatus === 'filename-conflict'));
  assert.ok(manifest.entries.every((entry) => entry.filenameConflicts.length === 1));
  assert.equal(manifest.verificationAtGeneration.filenameConflicts, 2);
  assert.equal(manifest.entries.filter((entry) => fs.existsSync(entry.destinationPath)).length, 0);
});

test('manifest generator marks paths outside confirmed source roots and rejects duplicate record IDs', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-manifest-paths-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const sourceRoot = path.join(fixtureRoot, 'confirmed-root');
  const outsideRoot = path.join(fixtureRoot, 'unconfirmed-root');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });
  const outsidePath = path.join(outsideRoot, 'dummy.jpg');
  fs.writeFileSync(outsidePath, Buffer.from('synthetic-only'));

  const outsideExport: CaptureMigrationExport = {
    format: 'capture-record-export-v1',
    sourceEnvironment: 'synthetic-test',
    syntheticOnly: true,
    exportedAt: '2026-10-20T12:00:00.000Z',
    stagingSnapshots: createSnapshots(['confirmed-fixture-root'], fixtureRoot),
    sourceRoots: [{ id: 'confirmed-fixture-root', path: sourceRoot }],
    records: [createRecord({ adminArchivePath: outsidePath, fileSize: 13 })],
  };
  const manifest = generateCaptureMigrationManifest(outsideExport, path.join(fixtureRoot, 'storage'));
  assert.equal(manifest.entries[0].sourceStatus, 'outside-approved-source-roots');
  assert.equal(manifest.entries[0].sourceExists, null);
  assert.equal(manifest.entries[0].sha256, null);

  assert.throws(
    () => generateCaptureMigrationManifest(
      { ...outsideExport, records: [outsideExport.records[0], outsideExport.records[0]] },
      path.join(fixtureRoot, 'storage')
    ),
    /Duplicate capture record ID/
  );
  assert.throws(
    () => generateCaptureMigrationManifest(
      { ...outsideExport, records: [createRecord({ adminArchivePath: `${sourceRoot}\\..\\unconfirmed-root\\dummy.jpg` })] },
      path.join(fixtureRoot, 'storage')
    ),
    /Unsafe source path/
  );
  assert.throws(
    () => generateCaptureMigrationManifest(
      { ...outsideExport, records: [createRecord({ fileName: '..\\unsafe.jpg', adminArchivePath: outsidePath })] },
      path.join(fixtureRoot, 'storage')
    ),
    /Unsafe capture filename/
  );
  assert.throws(
    () => generateCaptureMigrationManifest(
      { ...outsideExport, stagingSnapshots: { ...outsideExport.stagingSnapshots, database: { ...outsideExport.stagingSnapshots.database, verified: false } } },
      path.join(fixtureRoot, 'storage')
    ),
    /Verified isolated staging database and filesystem snapshot artifacts with matching SHA-256/
  );
  assert.throws(
    () => generateCaptureMigrationManifest(
      { ...outsideExport, sourceEnvironment: 'staging', syntheticOnly: true },
      path.join(fixtureRoot, 'storage')
    ),
    /sourceEnvironment and syntheticOnly marker are inconsistent/
  );
});
