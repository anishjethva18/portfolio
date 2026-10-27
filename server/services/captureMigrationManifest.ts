import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { assertPrivateStoragePath } from '../utils/privateStoragePath';

export interface CaptureMigrationRecord {
  id: string;
  userId: string;
  mediaType: 'photo' | 'video';
  fileName: string;
  userCapturePath: string;
  adminArchivePath: string;
  fileSize: number;
  userSaved: boolean;
  adminArchived: boolean;
  archiveExpiry: string;
  archiveConsentAt?: string;
  deleted: boolean;
  deletedAt?: string;
  error?: string;
  timestamp: string;
}

export interface CaptureMigrationSourceRoot {
  id: string;
  path: string;
}

export interface CaptureMigrationSnapshotEvidence {
  artifactId: string;
  artifactPath: string;
  sha256: string;
  verified: boolean;
  isolated: boolean;
}

export interface CaptureMigrationExport {
  format: 'capture-record-export-v1';
  sourceEnvironment: 'staging' | 'synthetic-test';
  syntheticOnly: boolean;
  exportedAt: string;
  stagingSnapshots: {
    database: CaptureMigrationSnapshotEvidence;
    filesystem: CaptureMigrationSnapshotEvidence & { sourceRootIds: string[] };
  };
  sourceRoots: CaptureMigrationSourceRoot[];
  records: CaptureMigrationRecord[];
}

export interface CaptureMigrationManifestEntry {
  recordId: string;
  mediaId: string;
  mediaType: 'photo' | 'video';
  sourceRootId: string | null;
  sourcePath: string;
  sourceExists: boolean | null;
  destinationPath: string;
  destinationExists: boolean;
  destinationFileName: string;
  fileSize: number | null;
  sha256: string | null;
  sourceStatus: 'verified' | 'missing' | 'outside-approved-source-roots' | 'invalid';
  destinationStatus: 'available' | 'already-exists' | 'filename-conflict' | 'not-checked';
  databaseReferences: {
    collection: 'Capture';
    lookupField: 'id';
    lookupValue: string;
    pathField: 'adminArchivePath';
    runtimeCache: 'db.captures';
  };
  mediaIndexReferences: {
    applies: false;
    reason: string;
  };
  compatibility: {
    originalPathRetainedDuringCopy: true;
    existingReadersUseStoredPathUntilUpdated: true;
    explicitAliasRequiredIfSourceIsRemoved: true;
  };
  rollback: {
    restoreField: 'adminArchivePath';
    restoreValue: string;
    retainDestinationCopy: true;
    sourceDeletionAuthorized: false;
  };
  metadataMapping: {
    id: string;
    mediaType: 'photo' | 'video';
    fileName: string;
    fileSize: number;
    archiveConsentAt: string | null;
    adminArchivePathFrom: string;
    adminArchivePathTo: string;
    otherRecordFieldsPreserved: true;
  };
  filenameConflicts: string[];
  conflicts: string[];
}

export interface CaptureMigrationManifest {
  format: 'capture-migration-manifest-v1';
  sourceEnvironment: CaptureMigrationExport['sourceEnvironment'];
  generatedAt: string;
  syntheticOnly: boolean;
  execution: 'manifest-only-no-copy-no-database-write';
  storageRoot: string;
  approvedDestinationRoot: string;
  stagingSnapshots: CaptureMigrationExport['stagingSnapshots'];
  sourceRoots: CaptureMigrationSourceRoot[];
  entries: CaptureMigrationManifestEntry[];
  duplicateHashes: Array<{ sha256: string; paths: string[]; recordIds: string[] }>;
  orphanSourceFiles: Array<{ sourceRootId: string; path: string; fileSize: number; sha256: string }>;
  unresolvedConflicts: Array<{ recordId: string; reason: string }>;
  verificationAtGeneration: CaptureMigrationVerification;
}

export interface CaptureMigrationVerification {
  pathsSafe: boolean;
  verifiedSources: number;
  missingSources: number;
  changedSources: number;
  destinationConflicts: number;
  filenameConflicts: number;
  errors: string[];
}

const isWithin = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

const safeId = (value: string): string => {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  if (!sanitized || sanitized !== value) throw new Error(`Invalid capture record ID: ${value}`);
  return sanitized;
};

const safeFileName = (value: string): string => {
  const normalizedName = value.replace(/\\/g, '/');
  if (
    normalizedName.split('/').includes('..') ||
    normalizedName.startsWith('/') ||
    normalizedName.includes(':')
  ) {
    throw new Error(`Unsafe capture filename: ${value}`);
  }
  const baseName = path.basename(normalizedName).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!baseName || baseName === '.' || baseName === '..') throw new Error(`Invalid capture filename: ${value}`);
  return baseName;
};

const hasTraversalSegment = (value: string): boolean =>
  value.replace(/\\/g, '/').split('/').includes('..');

const hashFile = (filePath: string): string => {
  const descriptor = fs.openSync(filePath, 'r');
  const hash = crypto.createHash('sha256');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead > 0) hash.update(chunk.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
};

const verifySnapshotEvidence = (snapshot: CaptureMigrationSnapshotEvidence): boolean => {
  if (
    !snapshot.verified ||
    !snapshot.isolated ||
    !path.isAbsolute(snapshot.artifactPath) ||
    !/^[a-f0-9]{64}$/i.test(snapshot.sha256)
  ) return false;
  const artifactPath = assertPrivateStoragePath(
    path.resolve(snapshot.artifactPath),
    `Staging snapshot ${snapshot.artifactId}`
  );
  return fs.existsSync(artifactPath) &&
    fs.statSync(artifactPath).isFile() &&
    hashFile(artifactPath) === snapshot.sha256.toLowerCase();
};

const listFiles = (rootId: string, rootPath: string): Array<{ sourceRootId: string; path: string; fileSize: number; sha256: string }> => {
  const result: Array<{ sourceRootId: string; path: string; fileSize: number; sha256: string }> = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const childPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        visit(childPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(childPath);
        result.push({
          sourceRootId: rootId,
          path: childPath,
          fileSize: stats.size,
          sha256: hashFile(childPath),
        });
      }
    }
  };
  visit(rootPath);
  return result;
};

export function generateCaptureMigrationManifest(
  captureExport: CaptureMigrationExport,
  storageRootInput: string,
  generatedAt = new Date().toISOString()
): CaptureMigrationManifest {
  if (captureExport.format !== 'capture-record-export-v1') {
    throw new Error('Unsupported capture export format.');
  }
  if (
    (captureExport.sourceEnvironment === 'staging' && captureExport.syntheticOnly) ||
    (captureExport.sourceEnvironment === 'synthetic-test' && !captureExport.syntheticOnly)
  ) {
    throw new Error('Capture export sourceEnvironment and syntheticOnly marker are inconsistent.');
  }
  if (captureExport.sourceEnvironment !== 'staging' && captureExport.sourceEnvironment !== 'synthetic-test') {
    throw new Error('Capture export must be explicitly identified as staging or synthetic-test data.');
  }
  const databaseSnapshot = captureExport.stagingSnapshots?.database;
  const filesystemSnapshot = captureExport.stagingSnapshots?.filesystem;
  if (
    !databaseSnapshot ||
    !verifySnapshotEvidence(databaseSnapshot) ||
    !filesystemSnapshot ||
    !verifySnapshotEvidence(filesystemSnapshot)
  ) {
    throw new Error('Verified isolated staging database and filesystem snapshot artifacts with matching SHA-256 are required.');
  }
  if (!path.isAbsolute(storageRootInput)) {
    throw new Error('Storage root must be explicitly supplied as an absolute path.');
  }
  if (!captureExport.sourceRoots.length) throw new Error('At least one explicitly confirmed source root is required.');

  const storageRoot = assertPrivateStoragePath(path.resolve(storageRootInput), 'Capture migration storage root');
  const approvedDestinationRoot = assertPrivateStoragePath(
    path.resolve(storageRoot, 'AdminArchive', 'Captures'),
    'Capture migration destination root'
  );
  if (!isWithin(storageRoot, approvedDestinationRoot)) {
    throw new Error('Capture migration destination resolves outside the approved storage root.');
  }
  const rootIds = new Set<string>();
  const sourceRoots = captureExport.sourceRoots.map((root) => {
    if (!root.id || rootIds.has(root.id) || !path.isAbsolute(root.path) || hasTraversalSegment(root.path)) {
      throw new Error('Source root IDs must be unique and every source path must be absolute.');
    }
    rootIds.add(root.id);
    const resolvedRoot = assertPrivateStoragePath(path.resolve(root.path), `Capture source root ${root.id}`);
    if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
      throw new Error(`Confirmed source root does not exist or is not a directory: ${root.id}`);
    }
    const realRoot = fs.realpathSync(resolvedRoot);
    return { id: root.id, path: realRoot };
  });
  const confirmedRootIds = new Set(sourceRoots.map((root) => root.id));
  if (
    filesystemSnapshot.sourceRootIds.length !== confirmedRootIds.size ||
    filesystemSnapshot.sourceRootIds.some((id) => !confirmedRootIds.has(id))
  ) {
    throw new Error('Filesystem snapshot evidence must cover exactly the explicitly confirmed source roots.');
  }

  const recordIds = new Set<string>();
  const entries = captureExport.records.map((record): CaptureMigrationManifestEntry => {
    safeId(record.id);
    if (recordIds.has(record.id)) throw new Error(`Duplicate capture record ID: ${record.id}`);
    recordIds.add(record.id);
    const fileName = safeFileName(record.fileName);
    const extension = path.extname(fileName).toLowerCase();
    const category = record.mediaType === 'photo' ? 'Photos' : 'Videos';
    if (
      (record.mediaType !== 'photo' && record.mediaType !== 'video') ||
      !Number.isSafeInteger(record.fileSize) ||
      record.fileSize < 0
    ) {
      throw new Error(`Invalid media metadata for capture record: ${record.id}`);
    }
    const plannedDestinationPath = path.resolve(
      approvedDestinationRoot,
      category,
      `${safeId(record.id)}_${fileName}`
    );
    if (
      !isWithin(approvedDestinationRoot, plannedDestinationPath) ||
      path.extname(plannedDestinationPath).toLowerCase() !== extension
    ) {
      throw new Error(`Unsafe destination path for capture record: ${record.id}`);
    }

    if (record.adminArchivePath && hasTraversalSegment(record.adminArchivePath)) {
      throw new Error(`Unsafe source path for capture record: ${record.id}`);
    }
    const sourceCandidate = path.isAbsolute(record.adminArchivePath)
      ? path.resolve(record.adminArchivePath)
      : '';
    const matchingRoot = sourceRoots.find((root) => isWithin(root.path, sourceCandidate));
    const conflicts: string[] = [];
    let sourcePath = sourceCandidate;
    let fileSize: number | null = null;
    let sha256: string | null = null;
    let sourceStatus: CaptureMigrationManifestEntry['sourceStatus'];

    if (!sourceCandidate || !record.adminArchivePath || !matchingRoot) {
      sourceStatus = 'outside-approved-source-roots';
      conflicts.push('Stored adminArchivePath is not contained by any explicitly confirmed source root.');
    } else if (!fs.existsSync(sourceCandidate)) {
      sourceStatus = 'missing';
      conflicts.push('Capture record points to a missing source file.');
    } else {
      sourcePath = fs.realpathSync(sourceCandidate);
      if (!isWithin(matchingRoot.path, sourcePath) || !fs.statSync(sourcePath).isFile()) {
        sourceStatus = 'outside-approved-source-roots';
        conflicts.push('Resolved source is not a regular file beneath its confirmed source root.');
      } else {
        const stats = fs.statSync(sourcePath);
        fileSize = stats.size;
        sha256 = hashFile(sourcePath);
        sourceStatus = 'verified';
        if (stats.size !== record.fileSize) conflicts.push('Filesystem byte size differs from the database fileSize.');
      }
    }

    const safeDestinationPath = assertPrivateStoragePath(plannedDestinationPath, 'Capture migration destination file');
    if (
      path.resolve(plannedDestinationPath).toLocaleLowerCase('en-US') !== safeDestinationPath.toLocaleLowerCase('en-US') ||
      !isWithin(approvedDestinationRoot, safeDestinationPath)
    ) {
      throw new Error(`Destination resolves outside the approved storage root for capture: ${record.id}`);
    }
    const destinationStatus = fs.existsSync(safeDestinationPath) ? 'already-exists' : 'available';
    if (destinationStatus === 'already-exists') {
      conflicts.push('Destination already exists; migration must not overwrite it.');
    }
    return {
      recordId: record.id,
      mediaId: record.id,
      mediaType: record.mediaType,
      sourceRootId: matchingRoot?.id ?? null,
      sourcePath,
      sourceExists: sourceStatus === 'verified' ? true : sourceStatus === 'missing' ? false : null,
      destinationPath: safeDestinationPath,
      destinationExists: destinationStatus === 'already-exists',
      destinationFileName: path.basename(safeDestinationPath),
      fileSize,
      sha256,
      sourceStatus,
      destinationStatus,
      databaseReferences: {
        collection: 'Capture',
        lookupField: 'id',
        lookupValue: record.id,
        pathField: 'adminArchivePath',
        runtimeCache: 'db.captures',
      },
      mediaIndexReferences: {
        applies: false,
        reason: 'Camera captures are stored in CaptureModel, not the portfolio .media-index.json.',
      },
      compatibility: {
        originalPathRetainedDuringCopy: true,
        existingReadersUseStoredPathUntilUpdated: true,
        explicitAliasRequiredIfSourceIsRemoved: true,
      },
      rollback: {
        restoreField: 'adminArchivePath',
        restoreValue: record.adminArchivePath,
        retainDestinationCopy: true,
        sourceDeletionAuthorized: false,
      },
      metadataMapping: {
        id: record.id,
        mediaType: record.mediaType,
        fileName: record.fileName,
        fileSize: record.fileSize,
        archiveConsentAt: record.archiveConsentAt ?? null,
        adminArchivePathFrom: record.adminArchivePath,
        adminArchivePathTo: safeDestinationPath,
        otherRecordFieldsPreserved: true,
      },
      filenameConflicts: [],
      conflicts,
    };
  });

  const plannedNameGroups = new Map<string, CaptureMigrationManifestEntry[]>();
  entries.forEach((entry) => {
    const normalized = path.resolve(entry.destinationPath).toLocaleLowerCase('en-US');
    const group = plannedNameGroups.get(normalized) || [];
    group.push(entry);
    plannedNameGroups.set(normalized, group);
  });
  plannedNameGroups.forEach((group) => {
    if (group.length < 2) return;
    const conflictingRecordIds = group.map((entry) => entry.recordId);
    group.forEach((entry) => {
      entry.destinationStatus = 'filename-conflict';
      entry.filenameConflicts.push(...conflictingRecordIds.filter((id) => id !== entry.recordId));
      entry.conflicts.push(`Destination filename collides case-insensitively with record(s): ${entry.filenameConflicts.join(', ')}.`);
    });
  });

  const referencedSources = new Set(
    entries.filter((entry) => entry.sourceStatus === 'verified').map((entry) => path.resolve(entry.sourcePath))
  );
  const sourceFiles = sourceRoots.flatMap((root) => listFiles(root.id, root.path));
  const orphanSourceFiles = sourceFiles.filter((file) => !referencedSources.has(path.resolve(file.path)));
  const hashes = new Map<string, Array<{ path: string; recordId: string }>>();
  entries.forEach((entry) => {
    if (!entry.sha256) return;
    const group = hashes.get(entry.sha256) || [];
    group.push({ path: entry.sourcePath, recordId: entry.recordId });
    hashes.set(entry.sha256, group);
  });
  const duplicateHashes = Array.from(hashes.entries())
    .filter(([, group]) => group.length > 1)
    .map(([sha256, group]) => ({
      sha256,
      paths: group.map((item) => item.path),
      recordIds: group.map((item) => item.recordId),
    }));

  const unresolvedConflicts = entries.flatMap((entry) =>
    entry.conflicts.map((reason) => ({ recordId: entry.recordId, reason }))
  );
  const manifest: CaptureMigrationManifest = {
    format: 'capture-migration-manifest-v1',
    sourceEnvironment: captureExport.sourceEnvironment,
    generatedAt,
    syntheticOnly: captureExport.syntheticOnly,
    execution: 'manifest-only-no-copy-no-database-write',
    storageRoot,
    approvedDestinationRoot,
    stagingSnapshots: captureExport.stagingSnapshots,
    sourceRoots,
    entries,
    duplicateHashes,
    orphanSourceFiles,
    unresolvedConflicts,
    verificationAtGeneration: {
      pathsSafe: false,
      verifiedSources: 0,
      missingSources: 0,
      changedSources: 0,
      destinationConflicts: 0,
      filenameConflicts: 0,
      errors: [],
    },
  };
  manifest.verificationAtGeneration = verifyCaptureMigrationManifest(manifest, storageRoot);
  return manifest;
}

export function verifyCaptureMigrationManifest(
  manifest: CaptureMigrationManifest,
  storageRootInput: string
): CaptureMigrationVerification {
  const errors: string[] = [];
  const storageRoot = path.resolve(storageRootInput);
  const canonicalStorageRoot = assertPrivateStoragePath(storageRoot, 'Capture migration storage root');
  const expectedDestinationRoot = assertPrivateStoragePath(
    path.resolve(canonicalStorageRoot, 'AdminArchive', 'Captures'),
    'Capture migration destination root'
  );
  let verifiedSources = 0;
  let missingSources = 0;
  let changedSources = 0;
  let destinationConflicts = 0;
  let filenameConflicts = 0;
  let pathsSafe = manifest.execution === 'manifest-only-no-copy-no-database-write' &&
    ((manifest.sourceEnvironment === 'staging' && !manifest.syntheticOnly) ||
      (manifest.sourceEnvironment === 'synthetic-test' && manifest.syntheticOnly)) &&
    path.resolve(manifest.storageRoot) === canonicalStorageRoot &&
    isWithin(canonicalStorageRoot, expectedDestinationRoot) &&
    path.resolve(manifest.approvedDestinationRoot) === expectedDestinationRoot &&
    verifySnapshotEvidence(manifest.stagingSnapshots.database) &&
    verifySnapshotEvidence(manifest.stagingSnapshots.filesystem);

  if (!pathsSafe) errors.push('Manifest mode or approved destination root is invalid.');
  const roots = manifest.sourceRoots.map((root) => ({ ...root, path: path.resolve(root.path) }));
  const manifestRootIds = new Set(roots.map((root) => root.id));
  if (
    manifest.stagingSnapshots.filesystem.sourceRootIds.length !== manifestRootIds.size ||
    manifest.stagingSnapshots.filesystem.sourceRootIds.some((id) => !manifestRootIds.has(id))
  ) {
    pathsSafe = false;
    errors.push('Filesystem snapshot evidence does not cover the manifest source roots exactly.');
  }
  for (const entry of manifest.entries) {
    const sourceRoot = roots.find((root) => root.id === entry.sourceRootId);
    const safeDestinationPath = assertPrivateStoragePath(
      entry.destinationPath,
      'Capture migration destination file'
    );
    if (
      !isWithin(expectedDestinationRoot, path.resolve(entry.destinationPath)) ||
      !isWithin(expectedDestinationRoot, safeDestinationPath) ||
      path.resolve(entry.destinationPath).toLocaleLowerCase('en-US') !== safeDestinationPath.toLocaleLowerCase('en-US')
    ) {
      pathsSafe = false;
      errors.push(`Destination escapes approved root for ${entry.recordId}.`);
    }
    if (entry.destinationStatus === 'already-exists' || fs.existsSync(entry.destinationPath)) {
      destinationConflicts += 1;
      errors.push(`Destination conflict for ${entry.recordId}; no overwrite is permitted.`);
    }
    if (entry.destinationStatus === 'filename-conflict') {
      filenameConflicts += 1;
      errors.push(`Destination filename conflict for ${entry.recordId}; no write is permitted.`);
    }
    if (
      entry.databaseReferences.collection !== 'Capture' ||
      entry.databaseReferences.lookupValue !== entry.recordId ||
      entry.databaseReferences.pathField !== 'adminArchivePath' ||
      entry.rollback.restoreField !== 'adminArchivePath' ||
      entry.rollback.sourceDeletionAuthorized
    ) {
      pathsSafe = false;
      errors.push(`Database or rollback mapping is invalid for ${entry.recordId}.`);
    }
    if (entry.sourceStatus !== 'verified') {
      if (entry.sourceStatus === 'missing') missingSources += 1;
      continue;
    }
    if (!sourceRoot || !isWithin(sourceRoot.path, path.resolve(entry.sourcePath))) {
      pathsSafe = false;
      errors.push(`Source escapes confirmed roots for ${entry.recordId}.`);
      continue;
    }
    if (!fs.existsSync(entry.sourcePath)) {
      missingSources += 1;
      errors.push(`Source disappeared after manifest generation for ${entry.recordId}.`);
      continue;
    }
    const stats = fs.statSync(entry.sourcePath);
    if (stats.size !== entry.fileSize || hashFile(entry.sourcePath) !== entry.sha256) {
      changedSources += 1;
      errors.push(`Source size or SHA-256 changed for ${entry.recordId}.`);
      continue;
    }
    verifiedSources += 1;
  }
  return {
    pathsSafe,
    verifiedSources,
    missingSources,
    changedSources,
    destinationConflicts,
    filenameConflicts,
    errors,
  };
}
