import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { db, StoredFileMetadata } from '../db/database';
import { FileMetadataModel } from '../models';
import { isValidBackupBase64 } from '../utils/base64';
import { assertPrivateStoragePath } from '../utils/privateStoragePath';
import { getPortfolioStorageRoot } from '../utils/portfolioStorageRoot';

export function canAccessStoredFile(
  file: Pick<StoredFileMetadata, 'userId' | 'diskPath'>,
  requester: { userId: string; role: string }
): boolean {
  if (requester.role === 'admin') return true;
  if (file.userId) return file.userId === requester.userId;
  return !file.diskPath;
}

export const ALLOWED_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp',
  // Documents & Text
  'pdf', 'doc', 'docx', 'txt', 'md', 'json', 'csv', 'xml', 'log',
  // Audio & Video
  'mp3', 'wav', 'ogg', 'mp4', 'webm',
  // Code & Web
  'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py',
  // Archives
  'zip', 'tar', 'gz',
]);

export const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'vbs', 'msi', 'scr', 'pif', 'dll', 'ps1', 'apk',
]);

export type FileStorageCategory = 'resume' | 'profile' | 'certificates' | 'project';

const FILE_STORAGE_CATEGORIES = [
  'resume',
  'profile',
  'certificates',
  'project',
] as const satisfies readonly FileStorageCategory[];

export function isFileStorageCategory(value: unknown): value is FileStorageCategory {
  return typeof value === 'string' && FILE_STORAGE_CATEGORIES.some((category) => category === value);
}

export interface PortfolioMediaMigrationItem {
  id: string;
  name: string;
  category: FileStorageCategory;
  sourcePath: string;
  destinationPath: string;
  sha256: string;
}

export const MAX_PORTFOLIO_MEDIA_BYTES = 10 * 1024 * 1024;

export class FileService {
  private uploadsDir: string;
  private readonly portfolioMediaIndexName = '.media-index.json';

  constructor() {
    this.uploadsDir = getPortfolioStorageRoot();
    this.uploadsDir = assertPrivateStoragePath(this.uploadsDir, 'Portfolio storage root');
    this.ensureUploadsDir();
    this.uploadsDir = assertPrivateStoragePath(this.uploadsDir, 'Portfolio storage root');
    this.ensurePortfolioStorageDirectories();
  }

  private ensurePortfolioStorageDirectories(): void {
    for (const category of FILE_STORAGE_CATEGORIES) {
      const directory = path.resolve(this.getUploadsDir(), ...category.split('/'));
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      this.resolveSafeDiskPath(directory);
    }
  }

  public ensureUploadsDir() {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[FileService] Failed to create uploads directory:', e);
    }
  }

  public getUploadsDir(): string {
    this.ensureUploadsDir();
    return this.uploadsDir;
  }

  /**
   * Format byte sizes into readable string (e.g. "1.2 MB" or "45.6 KB")
   */
  public formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
  }

  private getPortfolioMediaDirectory(): string {
      return path.resolve(this.getUploadsDir(), 'Portfolio', 'Media');
    }

    private getFileStorageCategoryForPath(candidatePath: string): FileStorageCategory | undefined {
      const resolvedPath = path.resolve(candidatePath);
      for (const category of FILE_STORAGE_CATEGORIES) {
        const categoryRoot = path.resolve(this.getUploadsDir(), ...category.split('/'));
        const relativePath = path.relative(categoryRoot, resolvedPath);
        if (
          relativePath !== '' &&
          relativePath !== '..' &&
          !relativePath.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relativePath)
        ) return category;
      }
      return undefined;
    }

    private persistPortfolioMediaIndex(files: StoredFileMetadata[] = db.getFiles()): void {
      const root = this.getUploadsDir();
      const indexPath = path.resolve(root, this.portfolioMediaIndexName);
      const indexedFiles = files
        .filter((file) => file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/') && file.diskPath)
        .map((file) => {
          const safePath = this.resolveSafeDiskPath(file.diskPath);
          if (!safePath || !fs.existsSync(safePath)) return null;
          const { content: _content, diskPath: _diskPath, ...metadata } = file;
          return {
            ...metadata,
            relativeDiskPath: path.relative(root, safePath).replace(/\\/g, '/'),
          };
        })
        .filter((file): file is NonNullable<typeof file> => Boolean(file));
      const index = {
        version: 1,
        importedLegacyRoot: true,
        files: indexedFiles,
      };
      const temporaryPath = `${indexPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      try {
        fs.writeFileSync(temporaryPath, JSON.stringify(index, null, 2), { mode: 0o600 });
        fs.renameSync(temporaryPath, indexPath);
      } catch (error) {
        try { fs.unlinkSync(temporaryPath); } catch {}
        throw error;
      }
    }

    private createRecoveredMediaMetadata(filePath: string, name: string, id = `file-${crypto.randomUUID()}`): StoredFileMetadata {
      const stats = fs.statSync(filePath);
      const extension = path.extname(name).slice(1).toLowerCase();
      return {
        id,
        name,
        path: `Portfolio/Media/${name}`,
        parentId: 'Portfolio/Media',
        type: 'file',
        extension,
        size: this.formatFileSize(stats.size),
        sizeBytes: stats.size,
        modified: stats.mtime.toISOString(),
        url: this.getPortfolioMediaUrl({ id, name }),
        diskPath: filePath,
        storageCategory: this.getFileStorageCategoryForPath(filePath),
        uploadedAt: stats.mtime.toISOString(),
      };
    }

    /** Rebuild the database index from the durable portfolio media index and disk. */
    public async restorePortfolioMediaIndex(): Promise<number> {
      const root = this.getUploadsDir();
      const mediaDirectory = this.getPortfolioMediaDirectory();
      const canonicalIndexPath = path.resolve(root, this.portfolioMediaIndexName);
      const legacyIndexPath = path.resolve(root, 'Portfolio', this.portfolioMediaIndexName);
      const indexPath = fs.existsSync(canonicalIndexPath) ? canonicalIndexPath : legacyIndexPath;

      let importedLegacyRoot = false;
      const recovered = new Map<string, StoredFileMetadata>();
      if (fs.existsSync(indexPath)) {
        const parsed: unknown = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          (parsed as { version?: unknown }).version !== 1 ||
          !Array.isArray((parsed as { files?: unknown }).files)
        ) {
          throw new Error(`Portfolio media index is invalid: ${indexPath}`);
        }
        importedLegacyRoot = (parsed as { importedLegacyRoot?: unknown }).importedLegacyRoot === true;
        for (const item of (parsed as { files: Array<Record<string, unknown>> }).files) {
          if (
            !item ||
            typeof item.id !== 'string' ||
            !/^[\w-]{1,128}$/.test(item.id) ||
            typeof item.name !== 'string' ||
            typeof item.relativeDiskPath !== 'string'
          ) {
            console.warn('[FileService] Skipping an invalid entry in the portfolio media index.');
            continue;
          }
          const safeName = this.sanitizeFileName(item.name);
          const candidatePath = path.resolve(root, item.relativeDiskPath);
          const safePath = this.resolveSafeDiskPath(candidatePath);
          if (!safePath || !fs.existsSync(safePath)) continue;
          const existingFile = db.getFileById(item.id);
          const recoveredFile = {
            ...existingFile,
            ...this.createRecoveredMediaMetadata(safePath, safeName, item.id),
          };
          recoveredFile.userId = typeof item.userId === 'string' ? item.userId : undefined;
          recovered.set(recoveredFile.id, recoveredFile);
        }
      }

      for (const file of db.getFiles()) {
        if (!file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/') || !file.diskPath) continue;
        if (recovered.has(file.id)) continue;
        const safePath = this.resolveSafeDiskPath(file.diskPath);
        if (!safePath || !fs.existsSync(safePath)) continue;
        let storedPath = safePath;
        let storedName = this.sanitizeFileName(file.name);
        const restoredFile: StoredFileMetadata = {
          ...file,
          name: storedName,
          path: `Portfolio/Media/${storedName}`,
          parentId: 'Portfolio/Media',
          diskPath: storedPath,
          url: this.getPortfolioMediaUrl({ id: file.id, name: storedName }),
        };
        recovered.set(file.id, restoredFile);
      }

      const supportedMediaExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'pdf']);
      const backupDirectories = [
        path.resolve(root, 'backup'),
        path.resolve(root, 'AdminArchive', 'Backups'),
        path.resolve(root, 'Backups'),
      ];
      const latestFullBackup = backupDirectories
        .filter((directory) => fs.existsSync(directory))
        .flatMap((directory) => fs.readdirSync(directory)
          .filter((name) => /^(?:full-backup|portfolio-full-backup|Windows-11-Portfolio-Backup)-.+\.json$/i.test(name))
          .map((name) => ({ directory, name })))
        .sort((left, right) => right.name.localeCompare(left.name))[0];
      if (latestFullBackup) {
        const backupPath = path.join(latestFullBackup.directory, latestFullBackup.name);
        try {
            const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as {
              metadata?: { type?: unknown };
              collections?: { media?: Array<Record<string, unknown>> };
            };
            if (backup.metadata?.type === 'full-portfolio-assets' && Array.isArray(backup.collections?.media)) {
              for (const item of backup.collections.media) {
                let sourceId: string | undefined;
                if (typeof item.sourceUrl === 'string') {
                  try {
                    const sourceUrl = new URL(item.sourceUrl, 'http://portfolio.local');
                    if (sourceUrl.pathname.startsWith('/api/portfolio-media/')) {
                      const candidateId = sourceUrl.searchParams.get('id') ||
                        sourceUrl.pathname.slice('/api/portfolio-media/'.length);
                      if (/^file-[A-Za-z0-9-]+$/.test(candidateId)) sourceId = candidateId;
                    }
                  } catch {
                    sourceId = undefined;
                  }
                }
                const name = typeof item.name === 'string' ? this.sanitizeFileName(item.name) : '';
                const extension = path.extname(name).slice(1).toLowerCase();
                if (
                  !sourceId ||
                  !name ||
                  !supportedMediaExtensions.has(extension) ||
                  !isValidBackupBase64(item.contentBase64)
                ) continue;
                const id = sourceId;
                if (recovered.has(id)) continue;
                const buffer = Buffer.from(item.contentBase64, 'base64');
                if (!buffer.length || (Number.isSafeInteger(item.sizeBytes) && buffer.length !== item.sizeBytes)) continue;

                const recoveryDirectory = path.resolve(root, extension === 'pdf' ? 'resume' : 'profile');
                const existingMediaPath = path.resolve(recoveryDirectory, name);
                const mediaPathAlreadyUsed = Array.from(recovered.values()).some((file) =>
                  file.diskPath && path.resolve(file.diskPath).toLowerCase() === existingMediaPath.toLowerCase(),
                );
                let restoredName = name;
                let destinationPath = existingMediaPath;
                if (mediaPathAlreadyUsed) {
                  const extensionWithDot = path.extname(name);
                  restoredName = `${path.basename(name, extensionWithDot)}-restored-${id.slice(-8)}${extensionWithDot}`;
                  destinationPath = path.resolve(recoveryDirectory, restoredName);
                }

                if (!fs.existsSync(destinationPath)) {
                  fs.writeFileSync(destinationPath, buffer, { flag: 'wx', mode: 0o600 });
                }
                const restoredFile = {
                  ...db.getFileById(id),
                  ...this.createRecoveredMediaMetadata(destinationPath, restoredName, id),
                };
                recovered.set(id, restoredFile);
              }
            }
        } catch (error) {
          console.error(`[FileService] Could not recover media from ${backupPath}:`, error);
        }
      }

      const knownPaths = new Set(
        Array.from(recovered.values()).map((file) => path.resolve(file.diskPath || '').toLowerCase()),
      );
      for (const entry of fs.existsSync(mediaDirectory)
        ? fs.readdirSync(mediaDirectory, { withFileTypes: true })
        : []) {
        if (!entry.isFile() || entry.name.startsWith('.')) continue;
        const extension = path.extname(entry.name).slice(1).toLowerCase();
        if (!supportedMediaExtensions.has(extension)) continue;
        const diskPath = path.resolve(mediaDirectory, entry.name);
        if (knownPaths.has(diskPath.toLowerCase())) continue;
        const recoveredFile = this.createRecoveredMediaMetadata(diskPath, this.sanitizeFileName(entry.name));
        recovered.set(recoveredFile.id, recoveredFile);
        knownPaths.add(diskPath.toLowerCase());
      }

      if (!importedLegacyRoot) {
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          if (!entry.isFile() || entry.name.startsWith('.')) continue;
          const extension = path.extname(entry.name).slice(1).toLowerCase();
          if (!supportedMediaExtensions.has(extension)) continue;
          const sourcePath = path.resolve(root, entry.name);
          const destinationPath = path.resolve(root, extension === 'pdf' ? 'resume' : 'profile', entry.name);
          if (fs.existsSync(destinationPath)) continue;
          fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
          const recoveredFile = this.createRecoveredMediaMetadata(destinationPath, this.sanitizeFileName(entry.name));
          recovered.set(recoveredFile.id, recoveredFile);
        }
      }

      const files = Array.from(recovered.values());
      this.persistPortfolioMediaIndex(files);
      for (const file of files) {
        db.files.set(file.id, file);
        await FileMetadataModel.updateOne({ id: file.id }, { $set: file }, { upsert: true });
      }
      return files.length;
    }

    public getPortfolioMediaMigrationPlan(
      categories: Map<string, FileStorageCategory>
    ): PortfolioMediaMigrationItem[] {
      const filesById = new Map(db.getFiles().map((file) => [file.id, file]));
      const destinations = new Set<string>();
      const plan: PortfolioMediaMigrationItem[] = [];

      for (const [id, category] of categories) {
        const file = filesById.get(id);
        if (!file || !file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/')) {
          throw new Error(`Referenced portfolio media metadata is unavailable: ${id}`);
        }
        const sourcePath = this.resolveSafeDiskPath(file.diskPath);
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          throw new Error(`Referenced portfolio media is missing or outside private storage: ${file.name}`);
        }
        const destinationPath = path.resolve(
          this.getUploadsDir(),
          ...category.split('/'),
          this.sanitizeFileName(file.name)
        );
        const destinationKey = process.platform === 'win32'
          ? destinationPath.toLowerCase()
          : destinationPath;
        if (destinations.has(destinationKey)) {
          throw new Error(`Multiple media records resolve to the same destination: ${destinationPath}`);
        }
        destinations.add(destinationKey);
        if (
          path.resolve(sourcePath) !== path.resolve(destinationPath) &&
          fs.existsSync(destinationPath)
        ) {
          throw new Error(`Destination already exists; refusing to overwrite: ${destinationPath}`);
        }
        plan.push({
          id: file.id,
          name: file.name,
          category,
          sourcePath,
          destinationPath,
          sha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
        });
      }
      return plan;
    }

    public async migratePortfolioMediaFiles(
      categories: Map<string, FileStorageCategory>
    ): Promise<{ moved: number; alreadyOrganized: number; cleanupPending: string[] }> {
      if (mongoose.connection.readyState !== 1) {
        throw new Error('A connected local MongoDB is required to reorganize existing media safely.');
      }
      const plan = this.getPortfolioMediaMigrationPlan(categories);
      const filesById = new Map(db.getFiles().map((file) => [file.id, file]));
      const prepared: Array<{
        item: PortfolioMediaMigrationItem;
        original: StoredFileMetadata;
        updated: StoredFileMetadata;
        createdDestination: boolean;
      }> = [];

      for (const item of plan) {
        const original = filesById.get(item.id);
        if (!original?.diskPath) throw new Error(`Media metadata is unavailable for ${item.name}.`);
        if (path.resolve(item.sourcePath) === path.resolve(item.destinationPath)) {
          prepared.push({
            item,
            original,
            updated: original,
            createdDestination: false,
          });
          continue;
        }
        prepared.push({
          item,
          original,
          updated: { ...original, diskPath: item.destinationPath },
          createdDestination: true,
        });
      }

      const copied: typeof prepared = [];
      try {
        for (const entry of prepared) {
          if (!entry.createdDestination) continue;
          const sourceBuffer = fs.readFileSync(entry.item.sourcePath);
          const sourceHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
          if (sourceHash !== entry.item.sha256) {
            throw new Error(`Source media changed after the migration plan was prepared: ${entry.item.name}`);
          }
          fs.mkdirSync(path.dirname(entry.item.destinationPath), { recursive: true, mode: 0o700 });
          const destinationFd = fs.openSync(entry.item.destinationPath, 'wx', 0o600);
          copied.push(entry);
          try {
            fs.writeFileSync(destinationFd, sourceBuffer);
            fs.fsyncSync(destinationFd);
          } finally {
            fs.closeSync(destinationFd);
          }
          const destinationHash = crypto.createHash('sha256')
            .update(fs.readFileSync(entry.item.destinationPath))
            .digest('hex');
          if (destinationHash !== entry.item.sha256) {
            throw new Error(`Copied media failed SHA-256 verification: ${entry.item.name}`);
          }
        }
      } catch (error) {
        const cleanupErrors: string[] = [];
        for (const entry of copied) {
          try { fs.unlinkSync(entry.item.destinationPath); } catch {
            cleanupErrors.push(entry.item.destinationPath);
          }
        }
        if (cleanupErrors.length) {
          throw new Error(`Media copy failed and temporary-file cleanup was incomplete (${cleanupErrors.join(', ')}).`);
        }
        throw error;
      }

      const persisted: typeof prepared = [];
      try {
        for (const entry of prepared) {
          if (!entry.createdDestination) continue;
          const result = await FileMetadataModel.updateOne(
            { id: entry.original.id, diskPath: entry.original.diskPath },
            { $set: { diskPath: entry.updated.diskPath } }
          );
          if (!result.acknowledged || result.matchedCount !== 1) {
            throw new Error(`Could not persist the new media path for ${entry.item.name}.`);
          }
          persisted.push(entry);
          db.files.set(entry.updated.id, entry.updated);
        }
        this.persistPortfolioMediaIndex();
      } catch (error) {
        const rollbackErrors: string[] = [];
        for (const entry of persisted.reverse()) {
          try {
            const rollback = await FileMetadataModel.updateOne(
              { id: entry.original.id },
              { $set: { diskPath: entry.original.diskPath } }
            );
            if (!rollback.acknowledged || rollback.matchedCount !== 1) {
              throw new Error('Database rollback was not acknowledged.');
            }
            db.files.set(entry.original.id, entry.original);
          } catch {
            rollbackErrors.push(`metadata:${entry.item.name}`);
          }
        }
        try {
          this.persistPortfolioMediaIndex();
        } catch {
          rollbackErrors.push('media-index');
        }
        if (!rollbackErrors.length) {
          for (const entry of prepared) {
            if (!entry.createdDestination) continue;
            try { fs.unlinkSync(entry.item.destinationPath); } catch {
              rollbackErrors.push(`file:${entry.item.name}`);
            }
          }
        }
        if (rollbackErrors.length) {
          throw new Error(`Media migration failed and rollback was incomplete (${rollbackErrors.join(', ')}).`);
        }
        throw error;
      }

      const cleanupPending: string[] = [];
      let moved = 0;
      let alreadyOrganized = 0;
      for (const entry of prepared) {
        if (!entry.createdDestination) {
          alreadyOrganized += 1;
          continue;
        }
        try {
          fs.unlinkSync(entry.item.sourcePath);
          moved += 1;
        } catch {
          cleanupPending.push(entry.item.sourcePath);
        }
      }
      return { moved, alreadyOrganized, cleanupPending };
    }

    public removeEmptyLegacyPortfolioDirectory(): boolean {
      const root = this.getUploadsDir();
      const legacyDirectory = path.resolve(root, 'Portfolio');
      const mediaDirectory = path.resolve(legacyDirectory, 'Media');
      const legacyIndexPath = path.resolve(legacyDirectory, this.portfolioMediaIndexName);
      const canonicalIndexPath = path.resolve(root, this.portfolioMediaIndexName);
      if (!fs.existsSync(legacyDirectory)) return true;
      if (!fs.existsSync(canonicalIndexPath)) return false;
      if (
        fs.existsSync(mediaDirectory) &&
        fs.readdirSync(mediaDirectory, { withFileTypes: true }).length > 0
      ) return false;

      for (const entry of fs.readdirSync(legacyDirectory, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name === 'Media') {
          fs.rmdirSync(mediaDirectory);
          continue;
        }
        if (entry.isFile() && entry.name === this.portfolioMediaIndexName) {
          fs.unlinkSync(legacyIndexPath);
          continue;
        }
        return false;
      }
      fs.rmdirSync(legacyDirectory);
      return true;
    }

    public normalizeStorageDirectoryNames(): void {
      if (process.platform !== 'win32') return;
      const root = this.getUploadsDir();
      const requiredDirectories = [
        'resume',
        'profile',
        'certificates',
        'project',
        'backup',
        'AdminArchive',
      ];
      for (const directoryName of requiredDirectories) {
        const existingName = fs.readdirSync(root, { withFileTypes: true })
          .find((entry) => entry.isDirectory() && entry.name.toLowerCase() === directoryName.toLowerCase())
          ?.name;
        if (!existingName || existingName === directoryName) continue;

        const existingPath = path.resolve(root, existingName);
        const temporaryPath = path.resolve(root, `.storage-case-${process.pid}-${crypto.randomUUID()}`);
        const destinationPath = path.resolve(root, directoryName);
        fs.renameSync(existingPath, temporaryPath);
        try {
          fs.renameSync(temporaryPath, destinationPath);
        } catch (error) {
          fs.renameSync(temporaryPath, existingPath);
          throw error;
        }
      }
    }

    public removeEmptyUnapprovedStorageDirectories(): string[] {
      const root = this.getUploadsDir();
      const allowedDirectories = new Set([
        'resume',
        'profile',
        'certificates',
        'project',
        'backup',
        'AdminArchive',
        path.join('AdminArchive', 'CaptureImage'),
        path.join('AdminArchive', 'CaptureVideo'),
      ].map((directory) => path.resolve(root, directory)));
      const remaining: string[] = [];
      const inspect = (directory: string): void => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const child = path.resolve(directory, entry.name);
          inspect(child);
          if (allowedDirectories.has(child)) continue;
          if (fs.readdirSync(child).length === 0) {
            fs.rmdirSync(child);
          } else {
            remaining.push(path.relative(root, child).replace(/\\/g, '/'));
          }
        }
      };
      inspect(root);
      return remaining;
    }

  /**
   * Validate file extension against security policy
   */
  public isAllowedExtension(ext: string): boolean {
    const cleanExt = ext.toLowerCase().replace(/^\./, '').trim();
    return Boolean(cleanExt) && !BLOCKED_EXTENSIONS.has(cleanExt) && ALLOWED_EXTENSIONS.has(cleanExt);
  }

  /**
   * Sanitize filename and prevent directory traversal
   */
  public sanitizeFileName(originalName: string): string {
    const base = path.posix.basename(originalName.replace(/\\/g, '/'));
    const sanitized = base
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .trim()
      .replace(/[. ]+$/g, '');
    if (!sanitized || sanitized === '.' || sanitized === '..') return 'uploaded_file';
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(sanitized)
      ? `_${sanitized}`
      : sanitized;
  }

  private isWithinUploadsRoot(candidatePath: string): boolean {
    const root = fs.realpathSync(this.uploadsDir);
    const relative = path.relative(root, candidatePath);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  }

  private resolveNewDiskPath(filename: string, subdirectory = ''): string {
    const root = fs.realpathSync(this.uploadsDir);
    const safeName = this.sanitizeFileName(filename);
    const safeSegments = this.sanitizeVirtualPath(subdirectory).split('/').filter(Boolean);
    const parentCandidate = path.resolve(root, ...safeSegments);
    fs.mkdirSync(parentCandidate, { recursive: true });
    const parent = fs.realpathSync(parentCandidate);
    const relativeParent = path.relative(root, parent);
    const parentIsSafe = parent === root || (
      relativeParent !== '..' &&
      !relativeParent.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeParent)
    );
    const target = path.resolve(parent, safeName);
    if (!parentIsSafe || !this.isWithinUploadsRoot(target) || fs.realpathSync(path.dirname(target)) !== parent) {
      throw new Error('File path is outside the configured uploads directory.');
    }
    return target;
  }

  public resolveSafeDiskPath(diskPath?: string): string | null {
    if (!diskPath || !path.isAbsolute(diskPath)) return null;
    try {
      const candidate = path.resolve(diskPath);
      if (!this.isWithinUploadsRoot(candidate)) return null;
      const canonical = fs.realpathSync(candidate);
      return this.isWithinUploadsRoot(canonical) ? canonical : null;
    } catch {
      return null;
    }
  }

  public writeExistingFile(diskPath: string, content: string): void {
    const safePath = this.resolveSafeDiskPath(diskPath);
    if (!safePath) throw new Error('File path is outside the configured uploads directory.');
    fs.writeFileSync(safePath, content, 'utf-8');
  }

  private sanitizeVirtualPath(value: unknown): string {
    return String(value || '')
      .replace(/\\/g, '/')
      .split('/')
      .filter((segment) => segment && segment !== '.' && segment !== '..')
      .join('/');
  }

  private getAvailableStorageName(name: string, category: FileStorageCategory): string {
    const directory = path.resolve(this.getUploadsDir(), ...category.split('/'));
    const extension = path.extname(name);
    const baseName = path.basename(name, extension);
    const existingNames = new Set(
      db.getFiles()
        .filter((file) => file.diskPath && path.dirname(path.resolve(file.diskPath)).toLowerCase() === directory.toLowerCase())
        .map((file) => file.name.toLowerCase())
    );
    let candidate = name;
    let suffix = 1;
    while (fs.existsSync(path.resolve(directory, candidate)) || existingNames.has(candidate.toLowerCase())) {
      candidate = `${baseName}(${suffix})${extension}`;
      suffix += 1;
    }
    return candidate;
  }

  public getStorageDisplayPath(file: Pick<StoredFileMetadata, 'diskPath' | 'storageCategory' | 'name' | 'extension'>): string | undefined {
    const safePath = this.resolveSafeDiskPath(file.diskPath);
    if (safePath) {
      const relativePath = path.relative(this.getUploadsDir(), safePath).replace(/\\/g, '/');
      return `storage/${relativePath}`;
    }
    const category = file.storageCategory || (file.extension?.toLowerCase() === 'pdf' ? 'resume' : 'profile');
    return `storage/${category}/${this.sanitizeFileName(file.name)}`;
  }

  public getPortfolioMediaUrl(file: Pick<StoredFileMetadata, 'id' | 'name'>): string {
    return `/api/portfolio-media/${encodeURIComponent(file.name)}?id=${encodeURIComponent(file.id)}`;
  }

  /**
   * Save a binary file buffer to uploads/ folder and persist metadata
   */
  public saveUploadedBuffer(
    buffer: Buffer,
    originalName: string,
    targetPath: string,
    parentId?: string,
    userId?: string,
    storageCategory?: FileStorageCategory
  ): StoredFileMetadata {
    this.ensureUploadsDir();

    const sanitizedBase = this.sanitizeFileName(originalName);
    const ext = sanitizedBase.includes('.')
      ? sanitizedBase.substring(sanitizedBase.lastIndexOf('.') + 1).toLowerCase()
      : 'txt';

    if (!this.isAllowedExtension(ext)) {
      throw new Error(`File type .${ext} is blocked for security policy reasons.`);
    }

    const uniqueId = `file-${crypto.randomUUID()}`;
    const cleanTargetPath = this.sanitizeVirtualPath(targetPath);
    const resolvedParentId =
      this.sanitizeVirtualPath(parentId) || cleanTargetPath.substring(0, cleanTargetPath.lastIndexOf('/')) || 'D:/Documents';
    const isPortfolioMedia = resolvedParentId === 'Portfolio/Media' && cleanTargetPath.startsWith('Portfolio/Media/');
    if (isPortfolioMedia && buffer.length > MAX_PORTFOLIO_MEDIA_BYTES) {
      throw new Error('Portfolio media must be 10 MB or smaller.');
    }
    if (storageCategory !== undefined && !isFileStorageCategory(storageCategory)) {
      throw new Error('A supported private storage category is required.');
    }
    const storageSubdirectory: FileStorageCategory = storageCategory || (
      resolvedParentId.toLowerCase().includes('certificate') ? 'certificates' :
      resolvedParentId.toLowerCase().includes('resume') ? 'resume' :
      resolvedParentId.toLowerCase().includes('project') ? 'project' :
      isPortfolioMedia && ext === 'pdf' ? 'resume' :
      'profile'
    );
    const storedName = this.getAvailableStorageName(sanitizedBase, storageSubdirectory);
    const diskFileName = storedName;

    const safeDiskPath = this.resolveNewDiskPath(diskFileName, storageSubdirectory);

    try {
      fs.writeFileSync(safeDiskPath, buffer, { flag: 'wx', mode: 0o600 });
    } catch (writeErr: any) {
      console.error('[FileService] Failed to write file buffer:', writeErr);
      throw new Error('Failed to write file buffer to disk.');
    }

    try {
      const sizeBytes = buffer.length;
      const sizeStr = this.formatFileSize(sizeBytes);
      const storedPath = isPortfolioMedia ? `Portfolio/Media/${storedName}` : cleanTargetPath;
      const uploadsRelativePath = path.relative(this.getUploadsDir(), safeDiskPath).replace(/\\/g, '/');

      const metadata: StoredFileMetadata = {
        id: uniqueId,
        userId,
        name: storedName,
        path: storedPath,
        parentId: resolvedParentId,
        type: 'file',
        extension: ext,
        size: sizeStr,
        sizeBytes,
        modified: new Date().toISOString(),
        url: isPortfolioMedia
          ? this.getPortfolioMediaUrl({ id: uniqueId, name: storedName })
          : `/uploads/${uploadsRelativePath}`,
        diskPath: safeDiskPath,
        storageCategory: storageSubdirectory,
        ...(isPortfolioMedia ? { content: buffer.toString('base64'), contentEncoding: 'base64' as const } : {}),
        uploadedAt: new Date().toISOString(),
      };

      if (isPortfolioMedia) this.persistPortfolioMediaIndex([...db.getFiles(), metadata]);
      return db.saveFileMetadata(metadata);
    } catch (metaErr) {
      // Clean up written file if metadata saving fails
      if (fs.existsSync(safeDiskPath)) {
        try { fs.unlinkSync(safeDiskPath); } catch {}
      }
      throw metaErr;
    }
  }

  /** Move older portfolio media from the flat upload directory into its VFS folder. */
  public async migrateLegacyPortfolioMedia(): Promise<number> {
    return 0;
  }

  /**
   * Save a file from JSON payload (base64 dataURL or text) to disk and DB
   */
  public saveFile(
    file: Partial<StoredFileMetadata> & { name: string; path: string },
    userId?: string
  ): StoredFileMetadata {
    this.ensureUploadsDir();

    const sanitizedBase = this.sanitizeFileName(file.name);
    const ext =
      file.extension ||
      (sanitizedBase.includes('.')
        ? sanitizedBase.substring(sanitizedBase.lastIndexOf('.') + 1).toLowerCase()
        : 'txt');

    if (!this.isAllowedExtension(ext)) {
      throw new Error(`File type .${ext} is blocked for security policy reasons.`);
    }

    const uniqueId = `file-${crypto.randomUUID()}`;
    const cleanTargetPath = this.sanitizeVirtualPath(file.path);
    const resolvedParentId =
      file.parentId || cleanTargetPath.substring(0, cleanTargetPath.lastIndexOf('/')) || 'D:/Documents';
    const isPortfolioMedia = resolvedParentId === 'Portfolio/Media' && cleanTargetPath.startsWith('Portfolio/Media/');
    const storageSubdirectory: FileStorageCategory =
      resolvedParentId.toLowerCase().includes('certificate') ? 'certificates' :
      resolvedParentId.toLowerCase().includes('resume') ? 'resume' :
      resolvedParentId.toLowerCase().includes('project') ? 'project' :
      isPortfolioMedia && ext.toLowerCase() === 'pdf' ? 'resume' :
      'profile';
    const storedName = this.getAvailableStorageName(sanitizedBase, storageSubdirectory);
    const diskFileName = storedName;
    const safeDiskPath = this.resolveNewDiskPath(diskFileName, storageSubdirectory);

    let sizeBytes = 0;

    try {
      if (file.content) {
        if (file.content.startsWith('data:')) {
          const matches = file.content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches[2]) {
            const buffer = Buffer.from(matches[2], 'base64');
            fs.writeFileSync(safeDiskPath, buffer, { flag: 'wx', mode: 0o600 });
            sizeBytes = buffer.length;
          } else {
            fs.writeFileSync(safeDiskPath, file.content, { flag: 'wx', mode: 0o600 });
            sizeBytes = Buffer.byteLength(file.content, 'utf-8');
          }
        } else {
          fs.writeFileSync(safeDiskPath, file.content, { flag: 'wx', mode: 0o600 });
          sizeBytes = Buffer.byteLength(file.content, 'utf-8');
        }
      } else {
        // Empty file
        fs.writeFileSync(safeDiskPath, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
        sizeBytes = 0;
      }
    } catch (err: any) {
      console.error('[FileService] Failed to write content to disk:', err);
      throw new Error('Failed to write file content to disk.');
    }

    const sizeStr = file.size || this.formatFileSize(sizeBytes);
    if (isPortfolioMedia && sizeBytes > MAX_PORTFOLIO_MEDIA_BYTES) {
      try { fs.unlinkSync(safeDiskPath); } catch {}
      throw new Error('Portfolio media must be 10 MB or smaller.');
    }
    const stored: StoredFileMetadata = {
      id: uniqueId,
      userId,
      name: storedName,
      path: isPortfolioMedia ? `Portfolio/Media/${storedName}` : cleanTargetPath,
      parentId: resolvedParentId,
      type: file.type || 'file',
      extension: ext,
      size: sizeStr,
      sizeBytes,
      modified: new Date().toISOString(),
      url: isPortfolioMedia
        ? this.getPortfolioMediaUrl({ id: uniqueId, name: storedName })
        : `/uploads/${path.relative(this.getUploadsDir(), safeDiskPath).replace(/\\/g, '/')}`,
      diskPath: safeDiskPath,
      storageCategory: storageSubdirectory,
      ...(isPortfolioMedia
        ? { content: fs.readFileSync(safeDiskPath).toString('base64'), contentEncoding: 'base64' as const }
        : { content: file.content }),
      uploadedAt: new Date().toISOString(),
    };

    if (isPortfolioMedia) this.persistPortfolioMediaIndex([...db.getFiles(), stored]);
    return db.saveFileMetadata(stored);
  }

  public getFileById(id: string): StoredFileMetadata | undefined {
    return db.getFileById(id);
  }

  public getAllFiles(): StoredFileMetadata[] {
    return db.getFiles();
  }

  public getStoredFileBuffer(file: Pick<StoredFileMetadata, 'diskPath' | 'content' | 'contentEncoding'>): Buffer | null {
    const safePath = this.resolveSafeDiskPath(file.diskPath);
    if (safePath && fs.existsSync(safePath)) return fs.readFileSync(safePath);

    if (file.contentEncoding === 'base64' && isValidBackupBase64(file.content)) {
      return Buffer.from(file.content, 'base64');
    }
    if (typeof file.content === 'string' && file.content.startsWith('data:')) {
      const encodedContent = file.content.match(/^data:[^;,]+;base64,([A-Za-z0-9+/]+={0,2})$/)?.[1];
      if (isValidBackupBase64(encodedContent)) return Buffer.from(encodedContent, 'base64');
    }
    if (typeof file.content === 'string' && file.contentEncoding !== 'base64') {
      return Buffer.from(file.content, 'utf8');
    }
    return null;
  }

  public async persistPortfolioMediaContent(): Promise<number> {
    const media = await FileMetadataModel.find({
      path: { $regex: '^Portfolio/Media/' },
    }).select('id diskPath name contentEncoding').lean();
    let persisted = 0;

    for (const file of media) {
      if (file.contentEncoding === 'base64') continue;
      const safePath = this.resolveSafeDiskPath(file.diskPath);
      if (!safePath || !fs.existsSync(safePath)) continue;
      const buffer = fs.readFileSync(safePath);
      if (buffer.length > MAX_PORTFOLIO_MEDIA_BYTES) {
        console.warn(`[FileService] Existing media exceeds the MongoDB durability limit and requires persistent disk storage: ${file.name}`);
        continue;
      }
      const updates = {
        content: buffer.toString('base64'),
        contentEncoding: 'base64' as const,
        sizeBytes: buffer.length,
      };
      await FileMetadataModel.updateOne({ id: file.id }, { $set: updates });
      const cachedFile = db.getFileById(file.id);
      if (cachedFile) db.files.set(file.id, { ...cachedFile, ...updates });
      persisted += 1;
    }
    return persisted;
  }

  /** Remove file records whose managed upload has disappeared from disk. */
  public pruneMissingDiskFiles(): number {
    let removed = 0;
    for (const file of db.getFiles()) {
      const isPortfolioMedia = file.path.replace(/\\/g, '/').toLowerCase().startsWith('portfolio/media/');
      if (isPortfolioMedia) continue;
      if (!file.diskPath) {
        continue;
      }
      const safePath = this.resolveSafeDiskPath(file.diskPath);
      // Leave invalid/out-of-root metadata untouched; only prune a managed path that is missing.
      if (!path.isAbsolute(file.diskPath) || !this.isWithinUploadsRoot(path.resolve(file.diskPath)) || fs.existsSync(file.diskPath)) continue;
      if (db.deleteFileMetadata(file.id)) removed += 1;
    }
    return removed;
  }

  /**
   * Delete file metadata and remove physical disk file safely
   */
  public deleteFile(id: string): boolean {
    const file = db.getFileById(id);
    if (!file) return false;

    if (file.diskPath) {
      const candidate = path.resolve(file.diskPath);
      if (!path.isAbsolute(file.diskPath) || !this.isWithinUploadsRoot(candidate)) {
        throw new Error('Refusing to delete a file outside the configured uploads directory.');
      }
      if (fs.existsSync(candidate)) {
        const resolved = this.resolveSafeDiskPath(candidate);
        if (!resolved) throw new Error('Refusing to delete a file outside the configured uploads directory.');
        fs.unlinkSync(resolved);
      }
    }

    const deleted = db.deleteFileMetadata(id);
    if (file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/')) {
      this.persistPortfolioMediaIndex();
    }
    return deleted;
  }

  /**
   * Bulk sync files from client VFS
   */
  public syncBulk(files: Array<Partial<StoredFileMetadata>>, ownerId: string): number {
    if (!ownerId) throw new Error('Authenticated owner is required for file sync.');
    let count = 0;
    for (const file of files) {
      if (!file || typeof file.name !== 'string' || typeof file.path !== 'string') continue;

      const name = this.sanitizeFileName(file.name);
      const extension = path.posix.extname(name).slice(1).toLowerCase();
      const type = file.type === 'folder' ? 'folder' : 'file';
      if (type === 'file' && !this.isAllowedExtension(extension)) continue;
      if (file.content !== undefined && typeof file.content !== 'string') continue;

      const logicalPath = this.sanitizeVirtualPath(file.path);
      const parentId = this.sanitizeVirtualPath(file.parentId) || logicalPath.substring(0, logicalPath.lastIndexOf('/'));
      const existing = db.getFiles().find((stored) =>
        stored.userId === ownerId && !stored.diskPath && stored.name === name && stored.path === logicalPath
      );
      const content = typeof file.content === 'string' ? file.content : undefined;
      const sizeBytes = content ? Buffer.byteLength(content, 'utf8') : 0;
      const cleanFile: StoredFileMetadata = {
        id: existing?.id || `sync-${crypto.randomUUID()}`,
        userId: ownerId,
        name,
        path: logicalPath,
        parentId: parentId || 'D:/Documents',
        type,
        extension: type === 'file' ? extension : undefined,
        size: this.formatFileSize(sizeBytes),
        sizeBytes,
        modified: new Date().toISOString(),
        uploadedAt: existing?.uploadedAt || new Date().toISOString(),
        content,
      };
      db.saveFileMetadata(cleanFile);
      count++;
    }
    return count;
  }
}

export const fileService = new FileService();
