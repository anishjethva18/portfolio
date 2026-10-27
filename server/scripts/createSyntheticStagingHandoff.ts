import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CaptureModel } from '../models/Capture';
import {
  CaptureMigrationExport,
  generateCaptureMigrationManifest,
  verifyCaptureMigrationManifest,
} from '../services/captureMigrationManifest';

const workspaceRoot = path.resolve(process.cwd());
const outputDirectory = resolveOutputDirectory(process.argv.slice(2));
const syntheticStorageRoot = path.join(outputDirectory, 'synthetic-storage-root');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-synthetic-staging-'));
const binaryCache = path.join(tempRoot, 'mongodb-binary-cache');
const sourceRootId = 'synthetic-dummy-capture-root';
const sourceRoot = path.join(tempRoot, 'synthetic-source-root');
const photosRoot = path.join(sourceRoot, 'Photos');
const videosRoot = path.join(sourceRoot, 'Videos');
const photoPath = path.join(photosRoot, 'dummy-photo.jpg');
const duplicatePhotoPath = path.join(photosRoot, 'dummy-photo-copy.jpg');
const videoPath = path.join(videosRoot, 'dummy-video.mp4');
const orphanPath = path.join(sourceRoot, 'orphan-dummy.bin');

const artifactPaths = {
  recordExport: path.join(outputDirectory, 'capture-record-export.staging.json'),
  databaseSnapshot: path.join(outputDirectory, 'capture-database-snapshot.archive.gz'),
  filesystemSnapshot: path.join(outputDirectory, 'capture-filesystem-snapshot.zip'),
  sourceRoots: path.join(outputDirectory, 'staging-source-roots.json'),
  inventory: path.join(outputDirectory, 'capture-filesystem-inventory.json'),
  manifest: path.join(outputDirectory, 'capture-migration-manifest.synthetic.json'),
};

const writeExclusive = (filePath: string, content: string | Buffer): void => {
  const descriptor = fs.openSync(filePath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
};

const sha256 = (filePath: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const runPowerShell = (script: string): void => {
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: 'inherit',
  });
};

const quotePowerShell = (value: string): string => `'${value.replace(/'/g, "''")}'`;

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolveOutputDirectory(args: string[]): string {
  let requestedPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--output-dir') {
      if (requestedPath || !args[index + 1] || args[index + 1].startsWith('--')) {
        throw new Error('Specify --output-dir exactly once with an absolute temporary directory path.');
      }
      requestedPath = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${args[index]}`);
    }
  }

  const candidate = path.resolve(
    requestedPath || path.join(os.tmpdir(), `windows-portfolio-synthetic-staging-${crypto.randomUUID()}`)
  );
  if (requestedPath && !path.isAbsolute(requestedPath)) {
    throw new Error('--output-dir must be an absolute path.');
  }
  const tempRootPath = fs.realpathSync(os.tmpdir());
  const nearestExisting = (() => {
    let current = candidate;
    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return current;
  })();
  const canonicalCandidate = path.resolve(
    fs.realpathSync(nearestExisting),
    path.relative(nearestExisting, candidate)
  );
  const canonicalWorkspace = fs.realpathSync(workspaceRoot);
  if (!isWithin(tempRootPath, canonicalCandidate) || isWithin(canonicalWorkspace, canonicalCandidate)) {
    throw new Error('Synthetic output must be under the OS temporary directory and outside the project workspace.');
  }
  return canonicalCandidate;
}

const redactTempPath = (filePath: string): string => {
  const relative = path.relative(tempRoot, filePath);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return filePath;
  return `<DISPOSABLE_SYNTHETIC_TEMP>\\${relative.replace(/[\\/]/g, '\\')}`;
};

async function main(): Promise<void> {
  const existingOutput = Object.values(artifactPaths).find((filePath) => fs.existsSync(filePath));
  if (existingOutput) {
    throw new Error(`Refusing to overwrite an existing synthetic handoff artifact: ${existingOutput}`);
  }

  fs.mkdirSync(photosRoot, { recursive: true });
  fs.mkdirSync(videosRoot, { recursive: true });
  const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x44, 0x55]);
  const videoBytes = Buffer.from('synthetic-video-fixture-only');
  fs.writeFileSync(photoPath, photoBytes, { flag: 'wx' });
  fs.writeFileSync(duplicatePhotoPath, photoBytes, { flag: 'wx' });
  fs.writeFileSync(videoPath, videoBytes, { flag: 'wx' });
  fs.writeFileSync(orphanPath, Buffer.from('unreferenced-fixture'), { flag: 'wx' });

  const captureRecords: CaptureMigrationExport['records'] = [
    {
      id: 'cap_synthetic_photo_a',
      userId: 'synthetic-fixture-user',
      mediaType: 'photo',
      fileName: 'dummy-photo.jpg',
      userCapturePath: path.join(tempRoot, 'synthetic-user-captures', 'dummy-photo.jpg'),
      adminArchivePath: photoPath,
      fileSize: photoBytes.length,
      userSaved: false,
      adminArchived: true,
      archiveExpiry: '2030-01-01T00:00:00.000Z',
      archiveConsentAt: '2026-10-20T12:00:00.000Z',
      deleted: false,
      timestamp: '2026-10-20T12:00:00.000Z',
    },
    {
      id: 'cap_synthetic_photo_b',
      userId: 'synthetic-fixture-user',
      mediaType: 'photo',
      fileName: 'dummy-photo-copy.jpg',
      userCapturePath: path.join(tempRoot, 'synthetic-user-captures', 'dummy-photo-copy.jpg'),
      adminArchivePath: duplicatePhotoPath,
      fileSize: photoBytes.length,
      userSaved: false,
      adminArchived: true,
      archiveExpiry: '2030-01-01T00:00:00.000Z',
      archiveConsentAt: '2026-10-20T12:00:00.000Z',
      deleted: false,
      timestamp: '2026-10-20T12:00:00.000Z',
    },
    {
      id: 'cap_synthetic_video',
      userId: 'synthetic-fixture-user',
      mediaType: 'video',
      fileName: 'dummy-video.mp4',
      userCapturePath: path.join(tempRoot, 'synthetic-user-captures', 'dummy-video.mp4'),
      adminArchivePath: videoPath,
      fileSize: videoBytes.length,
      userSaved: false,
      adminArchived: true,
      archiveExpiry: '2030-01-01T00:00:00.000Z',
      archiveConsentAt: '2026-10-20T12:00:00.000Z',
      deleted: false,
      timestamp: '2026-10-20T12:00:00.000Z',
    },
    {
      id: 'cap_synthetic_missing',
      userId: 'synthetic-fixture-user',
      mediaType: 'photo',
      fileName: 'missing-dummy.jpg',
      userCapturePath: path.join(tempRoot, 'synthetic-user-captures', 'missing-dummy.jpg'),
      adminArchivePath: path.join(photosRoot, 'missing-dummy.jpg'),
      fileSize: 1,
      userSaved: false,
      adminArchived: true,
      archiveExpiry: '2030-01-01T00:00:00.000Z',
      archiveConsentAt: '2026-10-20T12:00:00.000Z',
      deleted: false,
      timestamp: '2026-10-20T12:00:00.000Z',
    },
  ];

  let memoryServer: MongoMemoryServer | undefined;
  let connection: mongoose.Connection | undefined;
  try {
    process.env.MONGOMS_DOWNLOAD_DIR = binaryCache;
    memoryServer = await MongoMemoryServer.create({
      instance: { dbName: 'synthetic_capture_fixture' },
      binary: { downloadDir: binaryCache },
    });
    const mongoUri = memoryServer.getUri();
    if (!mongoUri.startsWith('mongodb://127.0.0.1:') && !mongoUri.startsWith('mongodb://localhost:')) {
      throw new Error('Synthetic database URI is not loopback-only; refusing to connect.');
    }
    connection = await mongoose
      .createConnection(mongoUri, { dbName: 'synthetic_capture_fixture' })
      .asPromise();
    const SyntheticCaptureModel = connection.model('Capture', CaptureModel.schema);
    if (SyntheticCaptureModel.collection.name !== 'captures') {
      throw new Error(`Unexpected synthetic Capture collection: ${SyntheticCaptureModel.collection.name}`);
    }
    await SyntheticCaptureModel.insertMany(captureRecords);
    const records = await SyntheticCaptureModel.find({}, { _id: 0, __v: 0 }).lean();
    if (records.length !== captureRecords.length) {
      throw new Error(`Synthetic DB record count mismatch: ${records.length}`);
    }

    const databasePayload = {
      format: 'synthetic-capture-database-snapshot-v1',
      sourceEnvironment: 'synthetic-test',
      syntheticOnly: true,
      databaseName: 'synthetic_capture_fixture',
      collection: SyntheticCaptureModel.collection.name,
      records,
    };
    const databaseSnapshot = gzipSync(Buffer.from(JSON.stringify(databasePayload, null, 2)));
    const filesystemFiles = [photoPath, duplicatePhotoPath, videoPath, orphanPath].map((filePath) => ({
      sourceRootId,
      relativePath: path.relative(sourceRoot, filePath).split(path.sep).join('/'),
      fileSize: fs.statSync(filePath).size,
      sha256: sha256(filePath),
    }));
    const inventory = {
      format: 'synthetic-capture-filesystem-inventory-v1',
      sourceEnvironment: 'synthetic-test',
      syntheticOnly: true,
      sourceRoots: [{ id: sourceRootId, path: sourceRoot }],
      files: filesystemFiles,
    };
    const roots = {
      format: 'synthetic-capture-source-roots-v1',
      sourceEnvironment: 'synthetic-test',
      syntheticOnly: true,
      sourceRoots: [{ id: sourceRootId, path: sourceRoot }],
    };
    const zipTempPath = path.join(tempRoot, 'synthetic-capture-filesystem-snapshot.zip');
    const sourceGlob = `${sourceRoot}\\*`;
    runPowerShell(
      `Compress-Archive -Path ${quotePowerShell(sourceGlob)} -DestinationPath ${quotePowerShell(zipTempPath)} -CompressionLevel Optimal`
    );

    fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
    writeExclusive(artifactPaths.databaseSnapshot, databaseSnapshot);
    writeExclusive(artifactPaths.filesystemSnapshot, fs.readFileSync(zipTempPath));
    writeExclusive(artifactPaths.sourceRoots, JSON.stringify(roots, null, 2));
    writeExclusive(artifactPaths.inventory, JSON.stringify(inventory, null, 2));

    const exportData: CaptureMigrationExport = {
      format: 'capture-record-export-v1',
      sourceEnvironment: 'synthetic-test',
      syntheticOnly: true,
      exportedAt: new Date().toISOString(),
      stagingSnapshots: {
        database: {
          artifactId: 'synthetic-logical-database-snapshot',
          artifactPath: artifactPaths.databaseSnapshot,
          sha256: sha256(artifactPaths.databaseSnapshot),
          verified: true,
          isolated: true,
        },
        filesystem: {
          artifactId: 'synthetic-dummy-filesystem-snapshot',
          artifactPath: artifactPaths.filesystemSnapshot,
          sha256: sha256(artifactPaths.filesystemSnapshot),
          verified: true,
          isolated: true,
          sourceRootIds: [sourceRootId],
        },
      },
      sourceRoots: [{ id: sourceRootId, path: sourceRoot }],
      records: records.map((record) => ({
        id: record.id,
        userId: record.userId,
        mediaType: record.mediaType,
        fileName: record.fileName,
        userCapturePath: record.userCapturePath,
        adminArchivePath: record.adminArchivePath,
        fileSize: record.fileSize,
        userSaved: record.userSaved,
        adminArchived: record.adminArchived,
        archiveExpiry: record.archiveExpiry,
        ...(record.archiveConsentAt ? { archiveConsentAt: record.archiveConsentAt } : {}),
        deleted: record.deleted,
        ...(record.deletedAt ? { deletedAt: record.deletedAt } : {}),
        ...(record.error ? { error: record.error } : {}),
        timestamp: record.timestamp,
      })),
    };
    const extractionRoot = path.join(tempRoot, 'verified-filesystem-snapshot');
    runPowerShell(
      `Expand-Archive -LiteralPath ${quotePowerShell(artifactPaths.filesystemSnapshot)} -DestinationPath ${quotePowerShell(extractionRoot)}`
    );
    for (const item of filesystemFiles) {
      const extractedPath = path.join(extractionRoot, item.relativePath);
      if (!fs.existsSync(extractedPath) || !fs.statSync(extractedPath).isFile()) {
        throw new Error(`Synthetic archive is missing an inventory file: ${item.relativePath}`);
      }
      if (fs.statSync(extractedPath).size !== item.fileSize || sha256(extractedPath) !== item.sha256) {
        throw new Error(`Synthetic archive inventory hash/size mismatch: ${item.relativePath}`);
      }
    }

    const manifest = generateCaptureMigrationManifest(exportData, syntheticStorageRoot);
    const verification = verifyCaptureMigrationManifest(manifest, syntheticStorageRoot);
    if (!verification.pathsSafe || verification.changedSources !== 0) {
      throw new Error(`Synthetic manifest verification failed: ${verification.errors.join('; ')}`);
    }
    const persistedExport = JSON.parse(JSON.stringify(exportData)) as CaptureMigrationExport;
    persistedExport.sourceRoots = persistedExport.sourceRoots.map((root) => ({
      ...root,
      path: redactTempPath(root.path),
    }));
    persistedExport.records = persistedExport.records.map((record) => ({
      ...record,
      userCapturePath: redactTempPath(record.userCapturePath),
      adminArchivePath: redactTempPath(record.adminArchivePath),
    }));
    writeExclusive(artifactPaths.recordExport, JSON.stringify(persistedExport, null, 2));

    const persistedManifest = JSON.parse(JSON.stringify(manifest)) as typeof manifest;
    persistedManifest.sourceRoots = persistedManifest.sourceRoots.map((root) => ({
      ...root,
      path: redactTempPath(root.path),
    }));
    persistedManifest.entries = persistedManifest.entries.map((entry) => ({
      ...entry,
      sourcePath: redactTempPath(entry.sourcePath),
      metadataMapping: {
        ...entry.metadataMapping,
        adminArchivePathFrom: redactTempPath(entry.metadataMapping.adminArchivePathFrom),
      },
      rollback: {
        ...entry.rollback,
        restoreValue: redactTempPath(entry.rollback.restoreValue),
      },
    }));
    persistedManifest.duplicateHashes = persistedManifest.duplicateHashes.map((group) => ({
      ...group,
      paths: group.paths.map(redactTempPath),
    }));
    persistedManifest.orphanSourceFiles = persistedManifest.orphanSourceFiles.map((file) => ({
      ...file,
      path: redactTempPath(file.path),
    }));
    writeExclusive(artifactPaths.manifest, JSON.stringify(persistedManifest, null, 2));

    console.log(JSON.stringify({
      artifacts: Object.fromEntries(
        Object.entries(artifactPaths).map(([key, filePath]) => [key, filePath])
      ),
      hashes: Object.fromEntries(
        Object.entries(artifactPaths)
          .filter(([key]) => key !== 'manifest')
          .map(([key, filePath]) => [key, sha256(filePath)])
      ),
      databaseCollection: SyntheticCaptureModel.collection.name,
      databaseRecords: records.length,
      inventoryFiles: filesystemFiles.length,
      archiveInventoryMatches: true,
      manifest: {
        syntheticOnly: manifest.syntheticOnly,
        entries: manifest.entries.length,
        verifiedSources: verification.verifiedSources,
        missingSources: verification.missingSources,
        duplicateHashGroups: manifest.duplicateHashes.length,
        orphanSourceFiles: manifest.orphanSourceFiles.length,
        destinationConflicts: verification.destinationConflicts,
      },
      approvedDestinationCreated: fs.existsSync(
        path.join(syntheticStorageRoot, 'AdminArchive', 'Captures')
      ),
      realStagingEvidence: false,
    }, null, 2));
  } finally {
    await connection?.close();
    await memoryServer?.stop();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
