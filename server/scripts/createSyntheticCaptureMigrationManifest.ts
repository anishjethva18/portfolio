import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  CaptureMigrationExport,
  generateCaptureMigrationManifest,
  verifyCaptureMigrationManifest,
} from '../services/captureMigrationManifest';

const storageRoot = path.resolve(process.cwd(), 'server', 'storage');
const outputPath = path.join(
  storageRoot,
  'AdminArchive',
  'Manifests',
  'capture-migration-synthetic-2026-10-21-v7.json'
);
const snapshotDirectory = path.join(storageRoot, 'AdminArchive', 'Manifests', 'SyntheticCaptureFixture');
const databaseSnapshotOutputPath = path.join(snapshotDirectory, 'synthetic-capture-database-snapshot.json');
const filesystemSnapshotOutputPath = path.join(snapshotDirectory, 'synthetic-capture-filesystem-snapshot.tar.gz');
const filesystemInventoryOutputPath = path.join(snapshotDirectory, 'synthetic-capture-filesystem-inventory.json');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-capture-migration-synthetic-'));

const writeExclusive = (filePath: string, content: string | Buffer): void => {
  const descriptor = fs.openSync(filePath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
};

try {
  const sourceRoot = path.join(fixtureRoot, 'confirmed-dummy-source');
  const photo = path.join(sourceRoot, 'Photos', 'dummy-photo.jpg');
  const duplicatePhoto = path.join(sourceRoot, 'Photos', 'dummy-photo-copy.jpg');
  const video = path.join(sourceRoot, 'Videos', 'dummy-video.mp4');
  fs.mkdirSync(path.dirname(photo), { recursive: true });
  fs.mkdirSync(path.dirname(video), { recursive: true });
  const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x44, 0x55]);
  const videoBytes = Buffer.from('synthetic-video-fixture-only');
  fs.writeFileSync(photo, photoBytes);
  fs.writeFileSync(duplicatePhoto, photoBytes);
  fs.writeFileSync(video, videoBytes);
  fs.writeFileSync(path.join(sourceRoot, 'orphan-dummy.bin'), Buffer.from('unreferenced-fixture'));

  const record = (
    id: string,
    mediaType: 'photo' | 'video',
    fileName: string,
    adminArchivePath: string,
    fileSize: number
  ): CaptureMigrationExport['records'][number] => ({
    id,
    userId: 'synthetic-fixture-user',
    mediaType,
    fileName,
    userCapturePath: '',
    adminArchivePath,
    fileSize,
    userSaved: false,
    adminArchived: true,
    archiveExpiry: '',
    archiveConsentAt: '2026-10-20T12:00:00.000Z',
    deleted: false,
    timestamp: '2026-10-20T12:00:00.000Z',
  });
  const records: CaptureMigrationExport['records'] = [
    record('cap_fixture_photo_a', 'photo', 'dummy-photo.jpg', photo, photoBytes.length),
    record('cap_fixture_photo_b', 'photo', 'dummy-photo-copy.jpg', duplicatePhoto, photoBytes.length),
    record('cap_fixture_video', 'video', 'dummy-video.mp4', video, videoBytes.length),
    record(
      'cap_fixture_missing',
      'photo',
      'missing-dummy.jpg',
      path.join(sourceRoot, 'Photos', 'missing-dummy.jpg'),
      1
    ),
  ];
  const databaseSnapshotPath = path.join(fixtureRoot, 'synthetic-capture-record-export.json');
  const filesystemInventory = {
    sourceRootId: 'synthetic-dummy-root',
    files: [photo, duplicatePhoto, video, path.join(sourceRoot, 'orphan-dummy.bin')].map((filePath) => ({
      relativePath: path.relative(sourceRoot, filePath),
      fileSize: fs.statSync(filePath).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'),
    })),
  };
  fs.writeFileSync(databaseSnapshotPath, JSON.stringify({ collection: 'captures', records }, null, 2));
  const filesystemInventoryPath = path.join(fixtureRoot, 'synthetic-filesystem-inventory.json');
  fs.writeFileSync(filesystemInventoryPath, JSON.stringify(filesystemInventory, null, 2));
  execFileSync('tar.exe', ['-czf', path.join(fixtureRoot, 'synthetic-filesystem-snapshot.tar.gz'), '-C', sourceRoot, '.']);
  fs.mkdirSync(snapshotDirectory, { recursive: true, mode: 0o700 });
  if ([outputPath, databaseSnapshotOutputPath, filesystemSnapshotOutputPath, filesystemInventoryOutputPath]
    .some((filePath) => fs.existsSync(filePath))) {
    throw new Error('A synthetic manifest or snapshot output already exists; refusing to overwrite it.');
  }
  writeExclusive(databaseSnapshotOutputPath, fs.readFileSync(databaseSnapshotPath));
  writeExclusive(filesystemSnapshotOutputPath, fs.readFileSync(path.join(fixtureRoot, 'synthetic-filesystem-snapshot.tar.gz')));
  writeExclusive(filesystemInventoryOutputPath, fs.readFileSync(filesystemInventoryPath));
  const fileHash = (filePath: string) =>
    crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const syntheticExport: CaptureMigrationExport = {
    format: 'capture-record-export-v1',
    sourceEnvironment: 'synthetic-test',
    syntheticOnly: true,
    exportedAt: '2026-10-21T00:00:00.000Z',
    stagingSnapshots: {
      database: {
        artifactId: 'synthetic-database-snapshot',
        artifactPath: databaseSnapshotOutputPath,
        sha256: fileHash(databaseSnapshotOutputPath),
        verified: true,
        isolated: true,
      },
      filesystem: {
        artifactId: 'synthetic-filesystem-snapshot',
        artifactPath: filesystemSnapshotOutputPath,
        sha256: fileHash(filesystemSnapshotOutputPath),
        verified: true,
        isolated: true,
        sourceRootIds: ['synthetic-dummy-root'],
      },
    },
    sourceRoots: [{ id: 'synthetic-dummy-root', path: sourceRoot }],
    records,
  };

  const manifest = generateCaptureMigrationManifest(syntheticExport, storageRoot);
  const verification = verifyCaptureMigrationManifest(manifest, storageRoot);
  if (!verification.pathsSafe || verification.changedSources) {
    throw new Error(`Synthetic manifest verification failed: ${verification.errors.join('; ')}`);
  }
  if (fs.existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite an existing manifest: ${outputPath}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  const persistedManifest = JSON.parse(JSON.stringify(manifest)) as typeof manifest & {
    fixtureSourcePathsRedacted: true;
    fixtureRemovedAfterVerification: true;
  };
  const redactedFixturePath = (filePath: string): string => {
    const relative = path.relative(fixtureRoot, filePath);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      return filePath;
    }
    return `<DISPOSABLE_TEMP_FIXTURE>\\${relative.replace(/[\\/]/g, '\\')}`;
  };
  persistedManifest.sourceRoots = persistedManifest.sourceRoots.map((root) => ({
    ...root,
    path: redactedFixturePath(root.path),
  }));
  persistedManifest.stagingSnapshots.database.artifactPath = redactedFixturePath(
    persistedManifest.stagingSnapshots.database.artifactPath
  );
  persistedManifest.stagingSnapshots.filesystem.artifactPath = redactedFixturePath(
    persistedManifest.stagingSnapshots.filesystem.artifactPath
  );
  persistedManifest.entries = persistedManifest.entries.map((entry) => ({
    ...entry,
    sourcePath: redactedFixturePath(entry.sourcePath),
    metadataMapping: {
      ...entry.metadataMapping,
      adminArchivePathFrom: redactedFixturePath(entry.metadataMapping.adminArchivePathFrom),
    },
    rollback: {
      ...entry.rollback,
      restoreValue: redactedFixturePath(entry.rollback.restoreValue),
    },
  }));
  persistedManifest.duplicateHashes = persistedManifest.duplicateHashes.map((group) => ({
    ...group,
    paths: group.paths.map(redactedFixturePath),
  }));
  persistedManifest.orphanSourceFiles = persistedManifest.orphanSourceFiles.map((file) => ({
    ...file,
    path: redactedFixturePath(file.path),
  }));
  persistedManifest.fixtureSourcePathsRedacted = true;
  persistedManifest.fixtureRemovedAfterVerification = true;
  writeExclusive(outputPath, JSON.stringify(persistedManifest, null, 2));
  console.log(JSON.stringify({
    outputPath,
    databaseSnapshotOutputPath,
    databaseSnapshotSha256: fileHash(databaseSnapshotOutputPath),
    filesystemSnapshotOutputPath,
    filesystemSnapshotSha256: fileHash(filesystemSnapshotOutputPath),
    filesystemInventoryOutputPath,
    filesystemInventorySha256: fileHash(filesystemInventoryOutputPath),
    entries: manifest.entries.length,
    verifiedSources: verification.verifiedSources,
    missingSources: verification.missingSources,
    duplicateHashGroups: manifest.duplicateHashes.length,
    orphanSourceFiles: manifest.orphanSourceFiles.length,
    destinationConflicts: verification.destinationConflicts,
    syntheticOnly: manifest.syntheticOnly,
    snapshotFilesVerified: true,
    fixtureRootRemovedAtExit: fixtureRoot,
  }, null, 2));
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
