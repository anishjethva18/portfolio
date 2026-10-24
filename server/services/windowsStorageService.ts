import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { assertPrivateStoragePath } from '../utils/privateStoragePath';
import { getPortfolioStorageRoot } from '../utils/portfolioStorageRoot';

export interface StorageHealthInfo {
  status: 'healthy' | 'degraded' | 'error';
  userCaptureRoot: {
    path: string;
    exists: boolean;
    writable: boolean;
    freeSpaceBytes?: number;
  };
  adminArchiveRoot: {
    path: string;
    exists: boolean;
    writable: boolean;
    freeSpaceBytes?: number;
  };
  captureArchiveRoot: {
    path: string;
    exists: boolean;
    writable: boolean;
    freeSpaceBytes?: number;
  };
  environment: string;
  timestamp: string;
}

export class WindowsStorageService {
  private userCaptureRoot: string;
  private adminArchiveRoot: string;
  private captureArchiveRoot: string;

  constructor() {
    const storageRoot = getPortfolioStorageRoot();
    this.userCaptureRoot = path.resolve(
      process.env.NODE_ENV === 'test' && process.env.USER_CAPTURE_ROOT?.trim()
        ? process.env.USER_CAPTURE_ROOT.trim()
        : path.join(storageRoot, 'AdminArchive', 'CaptureImage')
    );
    this.adminArchiveRoot = path.resolve(
      process.env.NODE_ENV === 'test' && process.env.ADMIN_ARCHIVE_ROOT?.trim()
        ? process.env.ADMIN_ARCHIVE_ROOT.trim()
        : path.join(storageRoot, 'AdminArchive')
    );
    this.captureArchiveRoot = path.resolve(
      process.env.NODE_ENV === 'test' && process.env.CAPTURE_ARCHIVE_ROOT?.trim()
        ? process.env.CAPTURE_ARCHIVE_ROOT.trim()
        : path.join(storageRoot, 'AdminArchive')
    );

    this.userCaptureRoot = assertPrivateStoragePath(this.userCaptureRoot, 'User capture root');
    this.adminArchiveRoot = assertPrivateStoragePath(this.adminArchiveRoot, 'Admin archive root');
    this.captureArchiveRoot = assertPrivateStoragePath(this.captureArchiveRoot, 'Consent archive root');
    this.ensureRoots();
    this.userCaptureRoot = assertPrivateStoragePath(this.userCaptureRoot, 'User capture root');
    this.adminArchiveRoot = assertPrivateStoragePath(this.adminArchiveRoot, 'Admin archive root');
    this.captureArchiveRoot = assertPrivateStoragePath(this.captureArchiveRoot, 'Consent archive root');
  }

  public ensureRoots(): void {
    try {
      if (!fs.existsSync(this.adminArchiveRoot)) {
        fs.mkdirSync(this.adminArchiveRoot, { recursive: true, mode: 0o700 });
      }
    } catch (err: any) {
      console.warn(`[WindowsStorageService] Could not create admin archive root at ${this.adminArchiveRoot}:`, err.message);
    }

    try {
      if (!fs.existsSync(this.captureArchiveRoot)) {
        fs.mkdirSync(this.captureArchiveRoot, { recursive: true, mode: 0o700 });
      }
      for (const folder of ['CaptureImage', 'CaptureVideo']) {
        fs.mkdirSync(path.join(this.captureArchiveRoot, folder), { recursive: true, mode: 0o700 });
      }
    } catch (err: any) {
      console.warn(`[WindowsStorageService] Could not create capture archive root at ${this.captureArchiveRoot}:`, err.message);
    }
  }

  public getUserCaptureRoot(): string {
    this.ensureRoots();
    return this.userCaptureRoot;
  }

  public getAdminArchiveRoot(): string {
    this.ensureRoots();
    return this.adminArchiveRoot;
  }

  public getCaptureArchiveRoot(): string {
    this.ensureRoots();
    return this.captureArchiveRoot;
  }

  /**
   * Securely validate that a target path stays within the specified root directory (prevents path traversal)
   */
  public resolveSafePath(root: string, requestedFilename: string): string {
    const rootPath = fs.realpathSync(path.resolve(root));
    const normalizedName = String(requestedFilename).replace(/\\/g, '/');
    if (path.isAbsolute(normalizedName) || normalizedName.split('/').includes('..')) {
      throw new Error('Security Violation: Path traversal attempt detected.');
    }
    const sanitizedBase = path.posix.basename(normalizedName).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!sanitizedBase || sanitizedBase === '.' || sanitizedBase === '..') {
      throw new Error('Security Violation: Path traversal attempt detected.');
    }
    const resolvedPath = path.resolve(rootPath, sanitizedBase);
    const relativePath = path.relative(rootPath, resolvedPath);
    if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new Error('Security Violation: Path traversal attempt detected.');
    }
    return resolvedPath;
  }

  public saveUserCapture(buffer: Buffer, originalName: string): { filePath: string; fileName: string; sizeBytes: number } {
    const fileName = `visitor-${crypto.randomUUID()}-${path.basename(String(originalName))}`;
    return this.savePrivateFile(this.getCaptureArchiveRoot(), buffer, fileName, [this.getCaptureFolder(originalName)]);
  }

  public saveAdminArchive(buffer: Buffer, originalName: string): { filePath: string; fileName: string; sizeBytes: number } {
    return this.savePrivateFile(this.getAdminArchiveRoot(), buffer, originalName, [this.getCaptureFolder(originalName)]);
  }

  public saveConsentedCapture(
    buffer: Buffer,
    originalName: string,
    mediaType: 'photo' | 'video'
  ): { filePath: string; fileName: string; sizeBytes: number } {
    const category = mediaType === 'photo' ? 'CaptureImage' : 'CaptureVideo';
    return this.savePrivateFile(this.getCaptureArchiveRoot(), buffer, originalName, [category]);
  }

  private getCaptureFolder(originalName: string): 'CaptureImage' | 'CaptureVideo' {
    const extension = path.extname(path.basename(String(originalName))).slice(1).toLowerCase();
    return new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'm4v']).has(extension)
      ? 'CaptureVideo'
      : 'CaptureImage';
  }

  private savePrivateFile(
    root: string,
    buffer: Buffer,
    originalName: string,
    subdirectories: string[]
  ): { filePath: string; fileName: string; sizeBytes: number } {
    let createdFilePath: string | undefined;
    try {
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      const rootRealPath = fs.realpathSync(root);
      const targetDirectory = path.resolve(rootRealPath, ...subdirectories);
      fs.mkdirSync(targetDirectory, { recursive: true, mode: 0o700 });
      const realTargetDirectory = fs.realpathSync(targetDirectory);
      const relativeDirectory = path.relative(rootRealPath, realTargetDirectory);
      if (
        relativeDirectory === '..' ||
        relativeDirectory.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeDirectory)
      ) {
        throw new Error('Storage directory resolves outside its configured root.');
      }

      const normalizedName = String(originalName).replace(/\\/g, '/');
      const baseName = path.posix.basename(normalizedName)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/^\.+$/, '');
      if (!baseName) throw new Error('A valid storage filename is required.');

      const extension = path.extname(baseName);
      const stem = extension ? baseName.slice(0, -extension.length) : baseName;
      let fileName = baseName;
      let filePath = path.resolve(realTargetDirectory, fileName);
      let fileDescriptor: number | undefined;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const relativePath = path.relative(rootRealPath, filePath);
        if (
          !relativePath ||
          relativePath === '..' ||
          relativePath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativePath)
        ) {
          throw new Error('Storage file resolves outside its configured root.');
        }
        try {
          fileDescriptor = fs.openSync(filePath, 'wx', 0o600);
          createdFilePath = filePath;
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          fileName = `${stem}-${crypto.randomUUID()}${extension}`;
          filePath = path.resolve(realTargetDirectory, fileName);
        }
      }
      if (fileDescriptor === undefined) {
        throw new Error('Could not allocate a unique filename in private storage.');
      }

      try {
        fs.writeFileSync(fileDescriptor, buffer);
        fs.fsyncSync(fileDescriptor);
      } finally {
        fs.closeSync(fileDescriptor);
      }

      createdFilePath = undefined;
      return { filePath, fileName, sizeBytes: buffer.length };
    } catch (error) {
      if (createdFilePath && fs.existsSync(createdFilePath)) {
        try { fs.unlinkSync(createdFilePath); } catch (cleanupError) {
          console.error('[WindowsStorageService] Could not remove an incomplete private file.', cleanupError);
        }
      }
      console.error('[WindowsStorageService] Private file write failed:', error);
      throw new Error(`Could not write private storage file: ${error instanceof Error ? error.message : 'unknown storage error'}`);
    }
  }

  public getAdminArchiveFileList(): Array<{ name: string; sizeBytes: number; modifiedAt: string }> {
    const root = this.getAdminArchiveRoot();
    if (!fs.existsSync(root)) return [];

    try {
      const files = ['CaptureImage', 'CaptureVideo'].flatMap((folder) => {
        const directory = path.join(root, folder);
        return fs.existsSync(directory)
          ? fs.readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => `${folder}/${entry.name}`)
          : [];
      });
      return files
        .map((f) => {
          const full = path.join(root, ...f.split('/'));
          try {
            const stats = fs.statSync(full);
            if (stats.isFile()) {
              return {
                name: f,
                sizeBytes: stats.size,
                modifiedAt: stats.mtime.toISOString(),
              };
            }
          } catch {}
          return null;
        })
        .filter(Boolean) as any[];
    } catch (err) {
      console.error('[WindowsStorageService] Error reading admin archive:', err);
      return [];
    }
  }

  public async run30DayRetentionCleanup(): Promise<{ cleanedCount: number; purgedFiles: string[] }> {
    let cleanedCount = 0;
    const purgedFiles: string[] = [];
    const captures = db.getAllCaptures();
    const now = Date.now();

    for (const c of captures) {
      const expiry = new Date(c.archiveExpiry).getTime();
      if (now < expiry || !c.userSaved) continue;

      if (c.userCapturePath && c.userCapturePath !== c.adminArchivePath && fs.existsSync(c.userCapturePath)) {
        try {
          fs.unlinkSync(c.userCapturePath);
          purgedFiles.push(c.fileName);
          cleanedCount++;
        } catch (error) {
          console.warn(`[WindowsStorageService] Could not remove expired visitor copy for ${c.id}.`, error);
          continue;
        }
      }

      c.userCapturePath = '';
      c.userSaved = false;
      await db.createCapture(c);
    }

    return { cleanedCount, purgedFiles };
  }

  public getHealth(): StorageHealthInfo {
    const userExists = fs.existsSync(this.userCaptureRoot);
    const adminExists = fs.existsSync(this.adminArchiveRoot);
    const captureExists = fs.existsSync(this.captureArchiveRoot);

    let userWritable = false;
    let adminWritable = false;
    let captureWritable = false;

    try {
      if (userExists) {
        const testFile = path.join(this.userCaptureRoot, '.health_check');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        userWritable = true;
      }
    } catch {}

    try {
      if (adminExists) {
        const testFile = path.join(this.adminArchiveRoot, `.health_check-${crypto.randomUUID()}`);
        fs.writeFileSync(testFile, 'ok', { flag: 'wx', mode: 0o600 });
        fs.unlinkSync(testFile);
        adminWritable = true;
      }
    } catch {}

    try {
      if (captureExists) {
        const testFile = path.join(this.captureArchiveRoot, `.health_check-${crypto.randomUUID()}`);
        fs.writeFileSync(testFile, 'ok', { flag: 'wx', mode: 0o600 });
        fs.unlinkSync(testFile);
        captureWritable = true;
      }
    } catch {}

    const isHealthy = userExists && userWritable && adminExists && adminWritable && captureExists && captureWritable;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      userCaptureRoot: {
        path: this.userCaptureRoot,
        exists: userExists,
        writable: userWritable,
      },
      adminArchiveRoot: {
        path: this.adminArchiveRoot,
        exists: adminExists,
        writable: adminWritable,
      },
      captureArchiveRoot: {
        path: this.captureArchiveRoot,
        exists: captureExists,
        writable: captureWritable,
      },
      environment: process.platform === 'win32' ? 'Windows Native Local' : 'Linux / Cloud Container',
      timestamp: new Date().toISOString(),
    };
  }
}

export const windowsStorageService = new WindowsStorageService();
