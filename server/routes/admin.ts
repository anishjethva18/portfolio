import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { db } from '../db/database';
import type { StoredFileMetadata } from '../db/database';
import {
  ProjectModel,
  UserModel,
  ContactModel,
  TaskModel,
  AnalyticsModel,
  FileMetadataModel,
  SiteContentModel,
  AdminProjectDraftModel,
  AdminAuditLogModel,
  AdminContentDraftModel,
  AdminContentRevisionModel,
} from '../models';
import { CaptureModel } from '../models/Capture';
import { windowsStorageService } from '../services/windowsStorageService';
import {
  backupService,
  createPortableBackup,
  getPortfolioMediaReferenceId,
  removeUnavailablePortfolioMediaReferences,
  verifyBackupIntegrity,
} from '../services/backupService';
import { isValidBackupBase64 } from '../utils/base64';
import { requireAdmin, validateCsrf, AuthenticatedRequest } from '../middleware/auth';
import { sessionService } from '../services/sessionService';
import { authService } from '../services/authService';
import { contentStudioService } from '../services/contentStudioService';
import { projectDraftService } from '../services/projectDraftService';
import { emailService } from '../services/emailService';
import { ALLOWED_EXTENSIONS, fileService, type FileStorageCategory } from '../services/fileService';

export const adminRouter = Router();
adminRouter.use(requireAdmin, validateCsrf);
const MAX_BACKUP_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_FULL_BACKUP_MEDIA_BYTES = 50 * 1024 * 1024;
let backupRestoreInProgress = false;
let portfolioMediaMigrationInProgress = false;

class BackupRestoreRollbackError extends Error {
  constructor() {
    super('Backup restore failed and rollback could not fully complete.');
    this.name = 'BackupRestoreRollbackError';
  }
}

function resolveAdminArchivePath(capture: { id: string; adminArchivePath?: string; fileName?: string }): string | null {
  if (capture.adminArchivePath && fs.existsSync(capture.adminArchivePath)) return capture.adminArchivePath;
  const archiveRoot = windowsStorageService.getAdminArchiveRoot();
  if (!fs.existsSync(archiveRoot)) return null;
  const filePrefix = `${capture.id}_`;
  for (const folder of ['CaptureImage', 'CaptureVideo']) {
    const directory = path.join(archiveRoot, folder);
    if (!fs.existsSync(directory)) continue;
    const match = fs.readdirSync(directory).find((name) => name.startsWith(filePrefix));
    if (match) return path.join(directory, match);
  }
  return null;
}

function addPortfolioMediaCategory(
  categories: Map<string, FileStorageCategory>,
  candidate: unknown,
  category: FileStorageCategory
): void {
  if (typeof candidate !== 'string') return;
  let id = '';
  try {
    const url = new URL(candidate, 'http://portfolio.local');
    if (!url.pathname.startsWith('/api/portfolio-media/')) return;
    id = url.searchParams.get('id') || url.pathname.slice('/api/portfolio-media/'.length);
  } catch {
    return;
  }
  if (!/^file-[A-Za-z0-9-]+$/.test(id)) return;
  const current = categories.get(id);
  if (current && current !== category) {
    throw new Error(`Media ${id} is referenced by multiple storage categories.`);
  }
  categories.set(id, category);
}

function collectProfileIconImages(
  value: unknown,
  categories: Map<string, FileStorageCategory>
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectProfileIconImages(item, categories));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    if (key === 'iconImage') addPortfolioMediaCategory(categories, child, 'profile');
    else collectProfileIconImages(child, categories);
  });
}

async function getPortfolioMediaStorageCategories(): Promise<Map<string, FileStorageCategory>> {
  const [published, draft, projects, projectDraft] = await Promise.all([
    SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean(),
    AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean(),
    ProjectModel.find().lean(),
    AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean(),
  ]);
  const categories = new Map<string, FileStorageCategory>();
  const addContent = (content: any) => {
    if (!content || typeof content !== 'object') return;
    addPortfolioMediaCategory(categories, content.profile?.avatar, 'profile');
    addPortfolioMediaCategory(categories, content.profile?.resumeUrl, 'resume');
    addPortfolioMediaCategory(categories, content.siteSettings?.socialImageUrl, 'profile');
    addPortfolioMediaCategory(categories, content.siteSettings?.faviconUrl, 'profile');
    addPortfolioMediaCategory(categories, content.siteSettings?.defaultWallpaperUrl, 'profile');
    for (const resume of Array.isArray(content.resumes) ? content.resumes : []) {
      addPortfolioMediaCategory(categories, resume?.file, 'resume');
    }
    for (const certificate of Array.isArray(content.certifications) ? content.certifications : []) {
      addPortfolioMediaCategory(categories, certificate?.image, 'certificates');
    }
    collectProfileIconImages(content.skills, categories);
  };
  addContent(published);
  addContent(draft?.content);

  for (const project of [...projects, ...(projectDraft?.projects || [])]) {
    addPortfolioMediaCategory(categories, project?.image, 'project');
    for (const screenshot of Array.isArray(project?.screenshots) ? project.screenshots : []) {
      addPortfolioMediaCategory(categories, screenshot, 'project');
    }
  }
  return categories;
}

type CaptureArchiveMove = {
  id: string;
  fileName: string;
  mediaType: 'photo' | 'video';
  sourcePath: string;
  destinationPath: string;
  sha256: string;
};

function getCaptureArchiveMigrationPlan(): CaptureArchiveMove[] {
  const archiveRoot = windowsStorageService.getAdminArchiveRoot();
  const archiveRootReal = fs.realpathSync(archiveRoot);
  const legacyArchiveRoot = process.platform === 'win32'
    ? path.resolve('C:\\WindowsPortfolio\\AdminArchive')
    : '';
  const legacyArchiveRootReal = legacyArchiveRoot && fs.existsSync(legacyArchiveRoot)
    ? fs.realpathSync(legacyArchiveRoot)
    : '';
  const moves: CaptureArchiveMove[] = [];
  for (const capture of db.getAllCaptures()) {
    if (!capture.adminArchived || !capture.adminArchivePath) continue;
    let sourcePath = fileService.resolveSafeDiskPath(capture.adminArchivePath);
    if (!sourcePath && legacyArchiveRootReal) {
      const candidatePath = path.resolve(capture.adminArchivePath);
      const candidateRelative = path.relative(legacyArchiveRootReal, candidatePath);
      if (
        candidateRelative !== '' &&
        candidateRelative !== '..' &&
        !candidateRelative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(candidateRelative) &&
        fs.existsSync(candidatePath)
      ) {
        const realCandidate = fs.realpathSync(candidatePath);
        const realRelative = path.relative(legacyArchiveRootReal, realCandidate);
        if (
          realRelative !== '' &&
          realRelative !== '..' &&
          !realRelative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(realRelative)
        ) sourcePath = realCandidate;
      }
    }
    if (!sourcePath) {
      throw new Error(`Archived capture path is missing or outside private storage: ${capture.fileName}`);
    }
    const relativeSource = path.relative(archiveRootReal, sourcePath);
    const isUnderPrivateArchive = relativeSource !== '..' &&
      !relativeSource.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeSource);
    const isUnderApprovedLegacyArchive = Boolean(legacyArchiveRootReal) &&
      (() => {
        const legacyRelative = path.relative(legacyArchiveRootReal, sourcePath);
        return legacyRelative !== '..' &&
          !legacyRelative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(legacyRelative);
      })();
    if (!isUnderPrivateArchive && !isUnderApprovedLegacyArchive) {
      throw new Error(`Archived capture is outside the AdminArchive folder: ${capture.fileName}`);
    }
    if (capture.mediaType !== 'photo' && capture.mediaType !== 'video') {
      throw new Error(`Archived capture media type is invalid: ${capture.fileName}`);
    }
    const folder = capture.mediaType === 'photo' ? 'CaptureImage' : 'CaptureVideo';
    const destinationDirectory = path.resolve(archiveRoot, folder);
    const destinationDirectoryReal = fs.realpathSync(destinationDirectory);
    const relativeDirectory = path.relative(archiveRootReal, destinationDirectoryReal);
    if (
      relativeDirectory === '..' ||
      relativeDirectory.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeDirectory)
    ) {
      throw new Error(`Capture destination is outside AdminArchive: ${capture.fileName}`);
    }
    const destinationPath = path.resolve(destinationDirectoryReal, path.basename(sourcePath));
    if (
      path.resolve(sourcePath) !== path.resolve(destinationPath) &&
      fs.existsSync(destinationPath)
    ) {
      throw new Error(`Capture destination already exists; refusing to overwrite: ${capture.fileName}`);
    }
    moves.push({
      id: capture.id,
      fileName: capture.fileName,
      mediaType: capture.mediaType,
      sourcePath,
      destinationPath,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
    });
  }
  return moves;
}

async function migrateCaptureArchiveFiles(): Promise<{ moved: number; cleanupPending: string[] }> {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('A connected local MongoDB is required to reorganize archived captures safely.');
  }
  const plan = getCaptureArchiveMigrationPlan();
  const copied: CaptureArchiveMove[] = [];
  const persisted: Array<{ move: CaptureArchiveMove; original: string }> = [];
  try {
    for (const move of plan) {
      if (path.resolve(move.sourcePath) === path.resolve(move.destinationPath)) continue;
      const sourceBytes = fs.readFileSync(move.sourcePath);
      if (crypto.createHash('sha256').update(sourceBytes).digest('hex') !== move.sha256) {
        throw new Error(`Capture source changed after the storage plan was prepared: ${move.fileName}`);
      }
      const fd = fs.openSync(move.destinationPath, 'wx', 0o600);
      copied.push(move);
      try {
        fs.writeFileSync(fd, sourceBytes);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (crypto.createHash('sha256').update(fs.readFileSync(move.destinationPath)).digest('hex') !== move.sha256) {
        throw new Error(`Capture copy failed SHA-256 verification: ${move.fileName}`);
      }
      const result = await CaptureModel.updateOne(
        { id: move.id, adminArchivePath: move.sourcePath },
        { $set: { adminArchivePath: move.destinationPath } },
      );
      if (!result.acknowledged || result.matchedCount !== 1) {
        throw new Error(`Could not update archive metadata for ${move.fileName}.`);
      }
      persisted.push({ move, original: move.sourcePath });
      const capture = db.captures.get(move.id);
      if (capture) db.captures.set(move.id, { ...capture, adminArchivePath: move.destinationPath });
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const { move, original } of persisted.reverse()) {
      try {
        const rollback = await CaptureModel.updateOne(
          { id: move.id },
          { $set: { adminArchivePath: original } },
        );
        if (!rollback.acknowledged || rollback.matchedCount !== 1) throw new Error('rollback not acknowledged');
        const capture = db.captures.get(move.id);
        if (capture) db.captures.set(move.id, { ...capture, adminArchivePath: original });
      } catch {
        rollbackErrors.push(move.fileName);
      }
    }
    if (!rollbackErrors.length) {
      for (const move of copied) {
        try { fs.unlinkSync(move.destinationPath); } catch {
          rollbackErrors.push(move.fileName);
        }
      }
    }
    if (rollbackErrors.length) {
      throw new Error(`Capture archive relocation failed; rollback incomplete for: ${rollbackErrors.join(', ')}.`);
    }
    throw error;
  }

  const cleanupPending: string[] = [];
  let moved = 0;
  for (const move of copied) {
    try {
      fs.unlinkSync(move.sourcePath);
      moved += 1;
    } catch {
      cleanupPending.push(move.sourcePath);
    }
  }
  return { moved, cleanupPending };
}

function replaceBackupMediaReference(value: string, replacements: Map<string, string>): string {
  const exactReplacement = replacements.get(value);
  if (exactReplacement) return exactReplacement;
  try {
    const url = new URL(value, 'http://portfolio.local');
    if (!url.pathname.startsWith('/api/portfolio-media/')) return value;
    const id = url.searchParams.get('id') || url.pathname.slice('/api/portfolio-media/'.length);
    return replacements.get(`/api/portfolio-media/${id}`) || value;
  } catch {
    return value;
  }
}

function replaceBackupMediaReferences(value: unknown, replacements: Map<string, string>): unknown {
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? replaceBackupMediaReference(value, replacements) : value;
  }

  const root: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : {};
  const pending: Array<{ source: unknown[] | Record<string, unknown>; target: unknown[] | Record<string, unknown> }> = [
    { source: value as unknown[] | Record<string, unknown>, target: root },
  ];

  while (pending.length) {
    const { source, target } = pending.pop()!;
    const entries: Array<[string, unknown]> = Array.isArray(source)
      ? source.map((item, index) => [String(index), item])
      : Object.entries(source);

    for (const [key, child] of entries) {
      const nextValue = typeof child === 'string' ? replaceBackupMediaReference(child, replacements) : child;
      if (Array.isArray(target)) {
        const index = Number(key);
        if (!Array.isArray(child) && (!child || typeof child !== 'object')) target[index] = nextValue;
        else {
          const nested: unknown[] | Record<string, unknown> = Array.isArray(child) ? [] : {};
          target[index] = nested;
          pending.push({ source: child as unknown[] | Record<string, unknown>, target: nested });
        }
      } else if (!child || typeof child !== 'object') {
        target[key] = nextValue;
      } else {
        const nested: unknown[] | Record<string, unknown> = Array.isArray(child) ? [] : {};
        target[key] = nested;
        pending.push({ source: child as unknown[] | Record<string, unknown>, target: nested });
      }
    }
  }

  return root;
}

function collectBackupMediaReferences(value: unknown): string[] {
  const references: string[] = [];
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (typeof current === 'string' && /^\/api\/portfolio-media\//.test(current)) references.push(current);
    else if (Array.isArray(current)) {
      for (const item of current) pending.push(item);
    } else if (current && typeof current === 'object') {
      for (const item of Object.values(current)) pending.push(item);
    }
  }
  return references;
}

function mediaSignatureIsValid(extension: string, buffer: Buffer): boolean {
  const isUtf8Text = () => {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      return !buffer.includes(0);
    } catch {
      return false;
    }
  };
  switch (extension) {
    case 'png':
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'jpg':
    case 'jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'gif':
      return buffer.subarray(0, 3).toString('ascii') === 'GIF';
    case 'webp':
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'bmp':
      return buffer.subarray(0, 2).toString('ascii') === 'BM';
    case 'ico':
      return buffer.length >= 6 && buffer.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]));
    case 'svg': {
      if (!isUtf8Text()) return false;
      const text = buffer.toString('utf8');
      return /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text) &&
        !/<script\b|<foreignObject\b|\bon[a-z]+\s*=|javascript\s*:|<!DOCTYPE|<!ENTITY|@import\b/i.test(text) &&
        !/\b(?:href|src)\s*=\s*["'](?!#)[^"']*["']/i.test(text) &&
        !/url\(\s*["']?(?!#)/i.test(text);
    }
    case 'pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'mp3':
      return buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
        (buffer.length > 1 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    case 'wav':
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WAVE';
    case 'ogg':
      return buffer.subarray(0, 4).toString('ascii') === 'OggS';
    case 'mp4':
      return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'webm':
      return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case 'zip':
    case 'docx':
      return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    case 'gz':
      return buffer.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]));
    case 'tar':
      return buffer.length >= 262 && buffer.subarray(257, 262).toString('ascii') === 'ustar';
    case 'json':
      if (!isUtf8Text()) return false;
      try { JSON.parse(buffer.toString('utf8')); return true; } catch { return false; }
    case 'doc':
      return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    default:
      return isUtf8Text();
  }
}

export { isValidBackupBase64 };

async function recordAudit(
  req: AuthenticatedRequest,
  action: string,
  targetType: string,
  targetId?: string,
  details?: string,
  outcome: 'success' | 'failed' = 'success'
): Promise<void> {
  const log = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    adminId: req.user?.userId || 'unknown',
    adminEmail: req.user?.email || 'admin@portfolio.local',
    action,
    targetType,
    targetId,
    details: details || `Admin performed ${action} on ${targetType}`,
    ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
    outcome,
    timestamp: new Date().toISOString(),
  };
  try {
    await AdminAuditLogModel.create(log);
  } catch {
    console.error('[AdminAuditLog] Administrator action could not be persisted.');
    throw new Error('Administrator action could not be recorded in the audit log.');
  }
}

type NormalizedProjectInput = {
  title?: string;
  tagline?: string;
  description?: string;
  features?: string[];
  technologies?: string[];
  category?: string;
  image?: string;
  githubUrl?: string;
  liveUrl?: string;
  stars?: number;
  featured?: boolean;
  visible?: boolean;
  sortOrder?: number;
  slug?: string;
  type?: string;
  stack?: string;
  screenshots?: string[];
  overview?: string;
  summary?: string;
  caseStudy?: {
    goal?: string;
    approach?: string;
    architecture?: string[];
    engineeringHighlights?: string[];
    delivered?: string;
  };
};

function normalizeProjectInput(body: any, creating: boolean): { value?: NormalizedProjectInput; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Project details must be an object.' };
  }

  const normalized: NormalizedProjectInput = {};
  const stringFields: Array<[keyof Pick<NormalizedProjectInput,
    'title' | 'tagline' | 'description' | 'category' | 'slug' | 'type' | 'stack' | 'overview' | 'summary'>, number, boolean]> = [
    ['title', 120, true],
    ['tagline', 240, false],
    ['description', 10000, true],
    ['category', 80, true],
    ['slug', 160, false],
    ['type', 120, false],
    ['stack', 500, false],
    ['overview', 10000, false],
    ['summary', 10000, false],
  ];
  for (const [field, maxLength, required] of stringFields) {
    if (body[field] === undefined && !creating) continue;
    const raw = body[field] ?? (creating && field === 'category' ? 'Full Stack' : '');
    if (typeof raw !== 'string') return { error: `${field} must be text.` };
    const value = raw.trim();
    if ((required && !value.trim()) || value.length > maxLength) {
      return { error: `${field} is required and must be no longer than ${maxLength} characters.` };
    }
    normalized[field] = value;
  }

  for (const field of ['features', 'technologies', 'screenshots'] as const) {
    if (body[field] === undefined && !creating) continue;
    const values = body[field] ?? [];
    const maxEntries = field === 'screenshots' ? 20 : 40;
    const maxLength = field === 'screenshots' ? 2048 : 1000;
    if (!Array.isArray(values) || values.length > maxEntries || values.some((item) => typeof item !== 'string' || !item.trim() || item.length > maxLength)) {
      return { error: `${field} must contain at most ${maxEntries} non-empty text entries of ${maxLength} characters or fewer.` };
    }
    const cleanValues = values.map((item: string) => item.trim());
    if (field === 'screenshots') {
      for (const url of cleanValues) {
        if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\') &&
          !url.split('/').includes('..') && (!url.startsWith('/api/') || /^\/api\/portfolio-media\/[A-Za-z0-9_-]+$/i.test(url))) continue;
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
        } catch {
          return { error: 'Screenshot URLs must use http(s) or a local path.' };
        }
      }
    }
    normalized[field] = cleanValues;
  }

  for (const field of ['image', 'githubUrl', 'liveUrl'] as const) {
    if (body[field] === undefined && !creating) continue;
    const raw = body[field] ?? '';
    if (typeof raw !== 'string' || raw.length > 2048) return { error: `${field} must be a URL of 2,048 characters or fewer.` };
    const value = raw.trim();
    if (value) {
      if (field === 'image' && value.startsWith('/') && !value.startsWith('//')) {
        if (value.includes('\\') || value.split('/').includes('..') ||
          (value.startsWith('/api/') && !/^\/api\/portfolio-media\/[A-Za-z0-9_-]+$/i.test(value))) {
          return { error: 'image must use a public local path or http(s) URL.' };
        }
        normalized[field] = value;
      } else {
        try {
          const parsed = new URL(value);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
          normalized[field] = value;
        } catch {
          return { error: `${field} must use an http(s) URL${field === 'image' ? ' or a local path' : ''}.` };
        }
      }
    } else {
      normalized[field] = '';
    }
  }

  if (body.caseStudy !== undefined || creating) {
    const raw = body.caseStudy ?? {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'caseStudy must be an object.' };
    const caseStudy: NonNullable<NormalizedProjectInput['caseStudy']> = {};
    for (const field of ['goal', 'approach', 'delivered'] as const) {
      const value = raw[field] ?? '';
      if (typeof value !== 'string' || value.length > 10000) return { error: `caseStudy.${field} must be text of 10,000 characters or fewer.` };
      caseStudy[field] = value.trim();
    }
    for (const field of ['architecture', 'engineeringHighlights'] as const) {
      const values = raw[field] ?? [];
      if (!Array.isArray(values) || values.length > 40 || values.some((item: unknown) => typeof item !== 'string' || !item.trim() || item.length > 1000)) {
        return { error: `caseStudy.${field} must contain at most 40 non-empty entries of 1,000 characters or fewer.` };
      }
      caseStudy[field] = values.map((item: string) => item.trim());
    }
    normalized.caseStudy = caseStudy;
  }

  if (body.stars !== undefined || creating) {
    const stars = body.stars ?? 0;
    if (!Number.isInteger(stars) || stars < 0 || stars > 100000) return { error: 'stars must be a whole number between 0 and 100,000.' };
    normalized.stars = stars;
  }
  if (body.featured !== undefined || creating) {
    const featured = body.featured ?? false;
    if (typeof featured !== 'boolean') return { error: 'featured must be a boolean.' };
    normalized.featured = featured;
  }
  if (body.visible !== undefined || creating) {
    const visible = body.visible ?? true;
    if (typeof visible !== 'boolean') return { error: 'visible must be a boolean.' };
    normalized.visible = visible;
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 100000) return { error: 'sortOrder must be a whole number between 0 and 100,000.' };
    normalized.sortOrder = body.sortOrder;
  }

  return { value: normalized };
}

/**
 * GET /api/admin/dashboard
 * Admin Dashboard Metrics & Storage Health
 */
adminRouter.get('/dashboard', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      usersCount,
      projectsCount,
      contactsCount,
      capturesCount,
      photoCount,
      videoCount,
      recentAuditLogs,
    ] = await Promise.all([
      UserModel.countDocuments(),
      ProjectModel.countDocuments(),
      ContactModel.countDocuments(),
      CaptureModel.countDocuments(),
      CaptureModel.countDocuments({ mediaType: 'photo' }),
      CaptureModel.countDocuments({ mediaType: 'video' }),
      AdminAuditLogModel.find().sort({ timestamp: -1 }).limit(20).lean(),
    ]);

    const storageHealth = windowsStorageService.getHealth();
    res.json({
      success: true,
      metrics: {
        usersCount,
        projectsCount,
        contactsCount,
        totalCaptures: capturesCount,
        totalPhotos: photoCount,
        totalVideos: videoCount,
      },
      storageHealth,
      recentAuditLogs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PROJECTS CRUD
 */
adminRouter.get('/projects', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [projects, publishedProjects] = await Promise.all([
      projectDraftService.getDraftProjects(),
      ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean(),
    ]);
    res.json({ success: true, projects, publishedProjects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.get('/projects/published', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const projects = await ProjectModel.find().sort({ sortOrder: 1, featured: -1, createdAt: -1 }).lean();
    res.json({ success: true, projects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Published projects could not be loaded.' });
  }
});

adminRouter.post('/projects/revert-change', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, projectId, field } = req.body ?? {};
    const draftProjects = await projectDraftService.getDraftProjects();
    const publishedProjects = await ProjectModel.find()
      .sort({ sortOrder: 1, featured: -1, createdAt: -1 })
      .lean();

    if (action === 'order') {
      const publishedOrder = new Map(publishedProjects.map((project, index) => [project.id, project.sortOrder ?? index]));
      for (const project of draftProjects) {
        if (publishedOrder.has(project.id)) project.sortOrder = publishedOrder.get(project.id)!;
      }
    } else {
      if (typeof projectId !== 'string' || !/^[\w-]{1,128}$/.test(projectId)) {
        res.status(422).json({ success: false, error: 'A valid project ID is required.' });
        return;
      }
      const draftIndex = draftProjects.findIndex((project) => project.id === projectId);
      const published = publishedProjects.find((project) => project.id === projectId);

      if (action === 'added') {
        if (draftIndex < 0 || published) {
          res.status(409).json({ success: false, error: 'This added project is no longer an unpublished draft change.' });
          return;
        }
        draftProjects.splice(draftIndex, 1);
      } else if (action === 'removed') {
        if (draftIndex >= 0 || !published) {
          res.status(409).json({ success: false, error: 'This removed project is no longer an unpublished draft change.' });
          return;
        }
        const { _id: _mongoId, __v: _version, ...restoredProject } = published;
        draftProjects.push(restoredProject as typeof draftProjects[number]);
      } else if (action === 'field') {
        const allowedFields = new Set([
          'title', 'tagline', 'description', 'features', 'technologies', 'category', 'image',
          'githubUrl', 'liveUrl', 'stars', 'featured', 'visible', 'slug', 'type', 'stack',
          'screenshots', 'overview', 'summary', 'caseStudy',
        ]);
        if (typeof field !== 'string' || !allowedFields.has(field) || draftIndex < 0 || !published) {
          res.status(409).json({ success: false, error: 'This project field is no longer an unpublished draft change.' });
          return;
        }
        const draftProject = draftProjects[draftIndex] as unknown as Record<string, unknown>;
        const publishedProject = published as unknown as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(publishedProject, field)) draftProject[field] = publishedProject[field];
        else delete draftProject[field];
      } else {
        res.status(422).json({ success: false, error: 'Unsupported project draft change.' });
        return;
      }
    }

    await projectDraftService.saveDraftProjects(draftProjects, req.user!.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Project draft change could not be reverted.' });
  }
});

adminRouter.post('/projects', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = normalizeProjectInput(req.body, true);
    if (!validation.value) {
      res.status(422).json({ success: false, error: validation.error });
      return;
    }
    const projectInput = validation.value;
    if (!projectInput.title || !projectInput.description || !projectInput.category) {
      res.status(422).json({ success: false, error: 'Title, description, and category are required.' });
      return;
    }
    const newProj = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: projectInput.title,
      tagline: projectInput.tagline || '',
      description: projectInput.description,
      features: projectInput.features || [],
      technologies: projectInput.technologies || [],
      category: projectInput.category,
      image: projectInput.image || '',
      githubUrl: projectInput.githubUrl,
      liveUrl: projectInput.liveUrl,
      stars: projectInput.stars ?? 0,
      featured: projectInput.featured ?? false,
      visible: projectInput.visible ?? true,
      sortOrder: projectInput.sortOrder ?? 0,
      slug: projectInput.slug || '',
      type: projectInput.type || '',
      stack: projectInput.stack || '',
      screenshots: projectInput.screenshots || [],
      overview: projectInput.overview || '',
      summary: projectInput.summary || '',
      caseStudy: projectInput.caseStudy || { goal: '', approach: '', architecture: [], engineeringHighlights: [], delivered: '' },
      createdAt: new Date().toISOString(),
    };
    const projects = await projectDraftService.getDraftProjects();
    newProj.sortOrder = projects.length;
    projects.push(newProj);
    await projectDraftService.saveDraftProjects(projects, req.user!.userId);
    await recordAudit(req, 'CREATE', 'Project', newProj.id, `Created project: ${newProj.title}`);
    res.status(201).json({ success: true, project: newProj });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.put('/projects/:id/visibility', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (typeof req.body?.visible !== 'boolean') {
      res.status(422).json({ success: false, error: 'Project visibility must be true or false.' });
      return;
    }
    const { id } = req.params;
    const projects = await projectDraftService.getDraftProjects();
    const projectIndex = projects.findIndex((project) => project.id === id);
    if (projectIndex < 0) {
      res.status(404).json({ success: false, error: 'Project not found in the current draft.' });
      return;
    }
    const updated = { ...projects[projectIndex], visible: req.body.visible };
    projects[projectIndex] = updated;
    await projectDraftService.saveDraftProjects(projects, req.user!.userId);
    await recordAudit(req, 'UPDATE', 'Project', id, `Changed project visibility: ${updated.title} (${updated.visible ? 'visible' : 'hidden'})`);
    res.json({ success: true, project: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Project visibility could not be updated.' });
  }
});

adminRouter.put('/projects/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const validation = normalizeProjectInput(req.body, false);
    if (!validation.value) {
      res.status(422).json({ success: false, error: validation.error });
      return;
    }
    const projects = await projectDraftService.getDraftProjects();
    const projectIndex = projects.findIndex((project) => project.id === id);
    if (projectIndex < 0) {
      res.status(404).json({ success: false, error: 'Project not found.' });
      return;
    }
    const updated = { ...projects[projectIndex], ...validation.value, id };
    projects[projectIndex] = updated;
    await projectDraftService.saveDraftProjects(projects, req.user!.userId);
    await recordAudit(req, 'UPDATE', 'Project', id, `Updated project draft: ${updated.title}`);
    res.json({ success: true, project: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/projects/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const projects = await projectDraftService.getDraftProjects();
    const projectIndex = projects.findIndex((project) => project.id === id);
    if (projectIndex < 0) {
      res.status(404).json({ success: false, error: 'Project not found.' });
      return;
    }
    const [deleted] = projects.splice(projectIndex, 1);
    await projectDraftService.saveDraftProjects(projects, req.user!.userId);
    await recordAudit(req, 'DELETE', 'Project', id, `Deleted project draft: ${id}`);
    res.json({ success: true, message: 'Project removed from draft.', project: deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * USERS & ROLE MANAGEMENT
 */
adminRouter.get('/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await UserModel.find()
      .select('id email name role disabled createdAt lastLogin')
      .lean();
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.post('/users/migrate-to-admin', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const legacyUsers = await UserModel.find({ role: 'user' }).lean();
    if (legacyUsers.length === 0) {
      res.json({ success: true, migratedCount: 0 });
      return;
    }

    const updatedAt = new Date().toISOString();
    const userIds = legacyUsers.map((user) => user.id);
    const result = await UserModel.updateMany(
      { id: { $in: userIds }, role: 'user' },
      { $set: { role: 'admin', updatedAt } },
    );
    for (const user of legacyUsers) {
      const cachedUser = db.users.get(user.id);
      if (cachedUser) db.users.set(user.id, { ...cachedUser, role: 'admin', updatedAt });
    }

    await Promise.all(userIds.map((userId) => sessionService.revokeAllUserSessions(userId)));
    await recordAudit(
      req,
      'MIGRATE_ROLES',
      'User',
      undefined,
      `Converted ${result.modifiedCount} legacy user account(s) to administrator accounts.`,
    );
    res.json({ success: true, migratedCount: result.modifiedCount });
  } catch (err: any) {
    res.status(503).json({ success: false, error: err.message || 'Legacy accounts could not be converted to administrators.' });
  }
});

adminRouter.post('/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role: 'admin' = 'admin';
    if (req.body?.role !== undefined && req.body.role !== 'admin') {
      res.status(422).json({ success: false, error: 'Only administrator accounts can be created.' });
      return;
    }
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      res.status(422).json({ success: false, error: 'Provide a valid name and email address.' });
      return;
    }
    const minPasswordLength = 8;
    if (password.length < minPasswordLength || password.length > 1024) {
      res.status(422).json({ success: false, error: `Password must contain between ${minPasswordLength} and 1,024 characters.` });
      return;
    }
    if (await UserModel.exists({ email })) {
      res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      return;
    }
    const now = new Date().toISOString();
    const user = {
      id: `usr_${crypto.randomUUID()}`,
      email,
      name,
      role,
      passwordHash: await authService.hashPassword(password),
      createdAt: now,
      updatedAt: now,
      disabled: false,
    };
    await UserModel.create(user);
    db.users.set(user.id, user);
    await recordAudit(req, 'CREATE', 'User', user.id, `Created ${role} account: ${email}`);
    res.status(201).json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err: any) {
    res.status(503).json({ success: false, error: err.message || 'User account could not be created.' });
  }
});

adminRouter.put('/users/:id/role', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (id === req.user!.userId) {
      res.status(403).json({ success: false, error: 'The active administrator role cannot be changed.' });
      return;
    }
    if (role !== 'admin') {
      res.status(400).json({ success: false, error: 'All managed accounts must have the administrator role.' });
      return;
    }
    const user = await UserModel.findOne({ id }).lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    const roleChanged = user.role !== role;
    const updatedAt = new Date().toISOString();
    const updatedUser = await UserModel.findOneAndUpdate(
      { id },
      { role, updatedAt },
      { new: true, runValidators: true },
    ).lean();
    if (!updatedUser) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    db.users.set(id, { ...updatedUser, role, updatedAt });
    if (roleChanged) await sessionService.revokeAllUserSessions(id);
    await recordAudit(req, 'UPDATE_ROLE', 'User', id, `Changed user ${updatedUser.email} role to ${role}`);
    res.json({ success: true, user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/users/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (id === req.user!.userId) {
      res.status(400).json({ success: false, error: 'Cannot delete your own active administrator account.' });
      return;
    }
    // Read from Mongo directly; the in-memory cache can lag behind records created
    // or restored by another server process.
    const user = await UserModel.findOne({ id }).lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    const deletedUser = await UserModel.findOneAndDelete({ id }).lean();
    if (!deletedUser) {
      res.status(404).json({ success: false, error: 'This account was already deleted.' });
      return;
    }
    db.users.delete(id);
    // The account deletion is authoritative. Cleanup failures must not make the
    // UI report that the account still exists after Mongo has removed it.
    await sessionService.revokeAllUserSessions(id).catch((error) => {
      console.error(`[Admin] Could not revoke sessions for deleted user ${id}:`, error);
    });
    await recordAudit(req, 'DELETE', 'User', id, `Deleted user account: ${user.email}`).catch((error) => {
      console.error(`[Admin] Could not record deletion audit for user ${id}:`, error);
    });
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.put('/users/:id/status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { disabled } = req.body;
    if (typeof disabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'disabled must be a boolean.' });
      return;
    }
    const user = db.users.get(id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    if (id === req.user!.userId && disabled) {
      res.status(403).json({ success: false, error: 'The active administrator account cannot be disabled.' });
      return;
    }
    if (user.role === 'admin' && disabled) {
      res.status(403).json({ success: false, error: 'Administrator accounts cannot be disabled.' });
      return;
    }
    const statusChanged = Boolean(user.disabled) !== disabled;
    user.disabled = disabled;
    user.updatedAt = new Date().toISOString();
    await UserModel.findOneAndUpdate({ id }, { disabled: user.disabled, updatedAt: user.updatedAt });
    db.users.set(id, user);
    if (statusChanged) await sessionService.revokeAllUserSessions(id);
    await recordAudit(req, 'TOGGLE_STATUS', 'User', id, `${disabled ? 'Disabled' : 'Enabled'} user account ${user.email}`);
    res.json({ success: true, user: { id: user.id, email: user.email, disabled: user.disabled } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * CONTACT MESSAGES MANAGEMENT
 */
adminRouter.get('/contacts', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contacts = await ContactModel.find().sort({ timestamp: -1 }).lean();
    res.json({ success: true, contacts });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Contact messages could not be loaded from persistent storage.' });
  }
});

adminRouter.put('/contacts/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, replied } = req.body;
    const allowedStatuses = ['delivered', 'failed', 'queued', 'simulated', 'replied'];
    if (
      (status !== undefined && !allowedStatuses.includes(status)) ||
      (notes !== undefined && (typeof notes !== 'string' || notes.length > 3000)) ||
      (replied !== undefined && typeof replied !== 'boolean') ||
      (status === undefined && notes === undefined && replied === undefined)
    ) {
      res.status(422).json({ success: false, error: 'Provide a valid contact status, notes (up to 3,000 characters), or replied flag.' });
      return;
    }

    const updates: Record<string, unknown> = {};
    const unsetUpdates: Record<string, ''> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes.trim();
    if (replied !== undefined) {
      updates.replied = replied;
      if (replied) {
        updates.status = 'replied';
        updates.repliedAt = new Date().toISOString();
      } else {
        unsetUpdates.repliedAt = '';
      }
    }

    const updateOperation: Record<string, unknown> = { $set: updates };
    if (Object.keys(unsetUpdates).length) updateOperation.$unset = unsetUpdates;
    const contact = await ContactModel.findOneAndUpdate({ id }, updateOperation, { new: true, runValidators: true }).lean();
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact message not found.' });
      return;
    }
    db.contacts.set(id, contact);
    await recordAudit(req, 'UPDATE', 'ContactMessage', id, `Updated contact message from ${contact.email}`);
    res.json({ success: true, contact });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Contact message changes could not be saved to persistent storage.' });
  }
});

adminRouter.post('/contacts/:id/reply', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 10000) {
    res.status(422).json({ success: false, error: 'Reply must contain between 1 and 10,000 characters.' });
    return;
  }

  let replyDelivered = false;
  try {
    const { id } = req.params;
    const contact = await ContactModel.findOne({ id }).lean();
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact message not found.' });
      return;
    }

    const legacyHistory = contact.replyMessage
      ? [{ message: contact.replyMessage, repliedAt: contact.repliedAt || contact.timestamp }]
      : [];
    if (legacyHistory.length && !contact.replyHistory?.length) {
      await ContactModel.updateOne(
        { id, $or: [{ replyHistory: { $exists: false } }, { replyHistory: { $size: 0 } }] },
        { $set: { replyHistory: legacyHistory } }
      );
    }

    await emailService.sendAdminReply(contact.email, contact.name, contact.subject, message, req.get('origin') || '');
    replyDelivered = true;

    const repliedAt = new Date().toISOString();
    const updated = await ContactModel.findOneAndUpdate(
      { id },
      {
        $set: {
          replied: true,
          repliedAt,
          replyMessage: message,
          status: 'replied',
        },
        $push: { replyHistory: { message, repliedAt } },
      },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) {
      res.status(500).json({ success: false, error: 'Reply was sent, but the contact status could not be saved. Do not resend it.' });
      return;
    }

    db.contacts.set(id, updated);
    await recordAudit(req, 'REPLY', 'ContactMessage', id, `Replied to contact message from ${contact.email}`);
    res.json({ success: true, contact: updated });
  } catch (err: any) {
    if (replyDelivered) {
      res.status(500).json({ success: false, error: 'Reply was sent, but its status could not be saved. Check the contact record before retrying.' });
      return;
    }
    res.status(503).json({ success: false, error: err.message || 'Reply delivery failed.' });
  }
});

/**
 * POST /api/admin/email/verify
 * Diagnostic verification for the active email provider and its credentials.
 */
adminRouter.post('/email/verify', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await emailService.verifySmtpConnection();
    await recordAudit(req, 'VERIFY_EMAIL_PROVIDER', 'System', undefined, `Email provider check: ${result.message}`);
    res.json({ success: result.connected, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/email/test-send
 * Dispatches a live test email to verify real end-to-end delivery pipeline
 */
adminRouter.post('/email/test-send', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetRecipient = typeof req.body?.recipient === 'string' ? req.body.recipient.trim() : undefined;
    const result = await emailService.sendTestEmail(targetRecipient);
    await recordAudit(req, 'TEST_EMAIL', 'System', undefined, `Test email dispatched to ${result.recipient} (${result.deliveryMode})`);
    res.json({ success: result.success, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/contacts/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await ContactModel.findOneAndDelete({ id }).lean();
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Contact message not found.' });
      return;
    }
    db.contacts.delete(id);
    await recordAudit(req, 'DELETE', 'ContactMessage', id, `Deleted contact message ID: ${id}`);
    res.json({ success: true, message: 'Contact message deleted.' });
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Contact message could not be deleted from persistent storage.' });
  }
});

/**
 * TASKS ADMIN OVERRIDE
 */
adminRouter.get('/tasks', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tasks = Array.from(db.tasks.values());
    res.json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/tasks/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!db.tasks.has(id)) {
      res.status(404).json({ success: false, error: 'Task not found.' });
      return;
    }
    db.tasks.delete(id);
    if (mongoose.connection.readyState === 1) {
      await TaskModel.findOneAndDelete({ id }).catch(() => {});
    }
    await recordAudit(req, 'DELETE', 'Task', id, `Admin deleted task ID: ${id}`);
    res.json({ success: true, message: 'Task deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * CAMERA ARCHIVE MANAGEMENT
 */
adminRouter.get('/archives/missing-sources', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const captures = await CaptureModel.find({ adminArchived: true })
      .select({ id: 1, fileName: 1, mediaType: 1, timestamp: 1, archiveExpiry: 1, adminArchivePath: 1 })
      .lean();
    const missing = captures
      .filter((capture) => !resolveAdminArchivePath(capture))
      .map(({ id, fileName, mediaType, timestamp, archiveExpiry }) => ({
        id,
        fileName,
        mediaType,
        timestamp,
        archiveExpiry,
      }));
    res.json({ success: true, missing });
  } catch {
    res.status(500).json({ success: false, error: 'Could not list missing archive sources.' });
  }
});

adminRouter.get('/archives', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, mediaType, page = '1', limit = '20' } = req.query;
    let captures = db.getAllCaptures().filter((capture) => capture.adminArchived && Boolean(resolveAdminArchivePath(capture)));

    if (mediaType && mediaType !== 'all') {
      captures = captures.filter((c) => c.mediaType === mediaType);
    }
    if (search) {
      const q = String(search).toLowerCase();
      captures = captures.filter((c) => c.fileName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q));
    }
    captures.sort((a, b) => {
      const timestampA = Date.parse(a.timestamp);
      const timestampB = Date.parse(b.timestamp);
      return (Number.isFinite(timestampB) ? timestampB : 0) - (Number.isFinite(timestampA) ? timestampA : 0);
    });

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = captures.slice(startIndex, startIndex + limitNum);

    await recordAudit(req, 'VIEW', 'CameraArchive', undefined, `Queried camera archive management list`);

    res.json({
      success: true,
      total: captures.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(captures.length / limitNum) || 1,
      captures: paginatedItems.map((c) => {
        const owner = db.users.get(c.userId);
        const adminFileExists = fs.existsSync(c.adminArchivePath);
        const userFileExists = fs.existsSync(c.userCapturePath);
        const isExpired = Boolean(c.archiveExpiry) && Date.now() >= Date.parse(c.archiveExpiry);

        return {
          ...c,
          ownerEmail: c.userId === 'local-machine' ? 'local@localhost' : owner?.email || 'unknown@user',
          ownerName: c.userId === 'local-machine'
            ? 'This computer'
            : c.userId === 'visitor'
              ? 'Portfolio visitor'
              : owner?.name || 'Unknown User',
          adminFileExists,
          userFileExists,
          isExpired,
        };
      }),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * BACKUP & MAINTENANCE
 */
adminRouter.get('/backup/status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const latest = backupService.getLatestBackup();
    const scheduled = backupService.isAutomatedScheduled();
    res.json({ success: true, latest, scheduled });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.post('/backup/run', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const backupType = (req.body?.type === 'full' || req.query.type === 'full') ? 'full-portfolio-assets' : 'manual-portfolio';
    const result = await backupService.createManualBackup(backupType, await getLivePortfolioContent());
    await recordAudit(req, 'BACKUP', 'System', undefined, `Manual system backup created (${backupType}): ${result.fileName}`);
    res.json({ success: true, backup: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.get('/backup/download', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const latest = backupService.getLatestBackup();
  if (!latest || !fs.existsSync(latest.filePath)) {
    res.status(404).json({ success: false, error: 'No manual portfolio backup is available.' });
    return;
  }
  res.download(latest.filePath, latest.fileName);
});

/**
 * SECURE ADMIN ARCHIVE DOWNLOAD
 */
adminRouter.get('/archives/:id/preview', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const capture = db.captures.get(req.params.id);
    const archivePath = capture && resolveAdminArchivePath(capture);
    if (!capture || !archivePath) {
      res.status(404).json({ success: false, error: 'Archived capture file not found.' });
      return;
    }
    const extension = path.extname(capture.fileName).toLowerCase();
    const contentType = ({
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
      '.gif': 'image/gif', '.heic': 'image/heic', '.mp4': 'video/mp4', '.m4v': 'video/mp4',
      '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    } as Record<string, string>)[extension];
    if (!contentType) {
      res.status(415).json({ success: false, error: 'This capture format cannot be previewed.' });
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(capture.fileName).replace(/["\\r\\n]/g, '_')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    if (archivePath !== capture.adminArchivePath) {
      capture.adminArchivePath = archivePath;
      void db.createCapture(capture);
    }
    res.sendFile(path.resolve(archivePath));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.get('/archives/:id/download', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const capture = db.captures.get(id);
    const archivePath = capture && resolveAdminArchivePath(capture);
    if (!capture || !archivePath) {
      res.status(404).json({ success: false, error: 'Archived capture file not found on C-drive storage.' });
      return;
    }
    await recordAudit(req, 'DOWNLOAD', 'CameraArchive', id, `Downloaded secure archive file: ${capture.fileName}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(archivePath, capture.fileName);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/archives/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const capture = db.captures.get(id);
    if (!capture) {
      res.status(404).json({ success: false, error: 'Archived capture not found.' });
      return;
    }
    const archivePath = resolveAdminArchivePath(capture);
    if (archivePath) {
      try { fs.unlinkSync(archivePath); } catch {}
    }
    if (fs.existsSync(capture.userCapturePath)) {
      try { fs.unlinkSync(capture.userCapturePath); } catch {}
    }
    db.captures.delete(id);
    if (mongoose.connection.readyState === 1) {
      await CaptureModel.findOneAndDelete({ id }).catch(() => {});
    }
    await recordAudit(req, 'PURGE', 'CameraArchive', id, `Permanently purged archived capture: ${capture.fileName}`);
    res.json({ success: true, message: 'Camera capture purged permanently.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/archives/missing/:fileName', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileName = req.params.fileName;
    if (!fileName || path.basename(fileName) !== fileName) {
      res.status(400).json({ success: false, error: 'A single capture file name is required.' });
      return;
    }

    const matches = await CaptureModel.find({ fileName, adminArchived: true }).lean();
    if (matches.length !== 1) {
      res.status(409).json({
        success: false,
        error: matches.length
          ? 'Multiple archived records match this file name; refusing to remove metadata.'
          : 'No archived record matches this file name.',
      });
      return;
    }

    const capture = matches[0];
    if (resolveAdminArchivePath(capture)) {
      res.status(409).json({ success: false, error: 'The archive file exists; refusing to remove its record.' });
      return;
    }

    const result = await CaptureModel.deleteOne({
      id: capture.id,
      fileName,
      adminArchived: true,
      adminArchivePath: capture.adminArchivePath,
    });
    if (result.deletedCount !== 1) {
      res.status(409).json({ success: false, error: 'The archived record changed; refresh and retry.' });
      return;
    }

    db.captures.delete(capture.id);
    await recordAudit(
      req,
      'PURGE_METADATA',
      'CameraArchive',
      capture.id,
      'Removed one archive metadata record after verifying its source file was missing; no files were deleted',
    );
    res.json({ success: true, message: 'Missing archive metadata removed; no files were deleted.' });
  } catch {
    res.status(500).json({ success: false, error: 'Could not remove the missing archive metadata record.' });
  }
});

adminRouter.post('/archives/cleanup', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await windowsStorageService.run30DayRetentionCleanup();
    await recordAudit(req, 'CLEANUP_WORKER', 'CameraArchive', undefined, `Retired ${result.cleanedCount} expired visitor copies; admin archives were preserved`);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * VFS FILE MANAGEMENT
 */
adminRouter.get('/storage/media-migration-plan', async (_req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '::1'].includes(mongoose.connection.host || '')) {
    res.status(404).json({ success: false, error: 'Local development storage migration is unavailable.' });
    return;
  }
  try {
    const categories = await getPortfolioMediaStorageCategories();
    const plan = fileService.getPortfolioMediaMigrationPlan(categories);
    const capturePlan = getCaptureArchiveMigrationPlan();
    const backupPlan = backupService.getLegacyBackupMigrationPlan();
    const assignedIds = new Set(plan.map((item) => item.id));
    const unclassified = fileService.getAllFiles()
      .filter((file) =>
        file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/') &&
        !assignedIds.has(file.id)
      )
      .map(({ id, name, path: virtualPath }) => ({ id, name, path: virtualPath }));
    res.json({
      success: true,
      files: plan.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        source: path.relative(fileService.getUploadsDir(), item.sourcePath).replace(/\\/g, '/'),
        destination: path.relative(fileService.getUploadsDir(), item.destinationPath).replace(/\\/g, '/'),
        sha256: item.sha256,
      })),
      captureFiles: capturePlan.map(({ id, fileName, mediaType, sourcePath, destinationPath, sha256 }) => ({
        id,
        fileName,
        mediaType,
        source: sourcePath.startsWith(windowsStorageService.getAdminArchiveRoot())
          ? path.relative(windowsStorageService.getAdminArchiveRoot(), sourcePath).replace(/\\/g, '/')
          : `legacy-C-WindowsPortfolio/AdminArchive/${path.basename(sourcePath)}`,
        destination: path.relative(windowsStorageService.getAdminArchiveRoot(), destinationPath).replace(/\\/g, '/'),
        sha256,
      })),
      backupFiles: backupPlan.map(({ fileName, sourcePath, destinationPath, sha256 }) => ({
        fileName,
        source: path.relative(fileService.getUploadsDir(), sourcePath).replace(/\\/g, '/'),
        destination: path.relative(fileService.getUploadsDir(), destinationPath).replace(/\\/g, '/'),
        sha256,
      })),
      unclassified,
    });
  } catch (error) {
    console.error('[StorageMigration] Could not prepare the local media migration plan.');
    res.status(409).json({
      success: false,
      error: error instanceof Error ? error.message : 'Could not prepare the media migration plan.',
    });
  }
});

adminRouter.post('/storage/media-migration', async (_req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '::1'].includes(mongoose.connection.host || '')) {
    res.status(404).json({ success: false, error: 'Local development storage migration is unavailable.' });
    return;
  }
  if (portfolioMediaMigrationInProgress || backupRestoreInProgress) {
    res.setHeader('Retry-After', '1');
    res.status(409).json({ success: false, error: 'Another storage or restore operation is in progress.' });
    return;
  }
  portfolioMediaMigrationInProgress = true;
  try {
    const categories = await getPortfolioMediaStorageCategories();
    fileService.getPortfolioMediaMigrationPlan(categories);
    getCaptureArchiveMigrationPlan();
    backupService.getLegacyBackupMigrationPlan();
    const mediaResult = await fileService.migratePortfolioMediaFiles(categories);
    const captureResult = await migrateCaptureArchiveFiles();
    const backupResult = backupService.migrateLegacyBackupFiles();
    const legacyPortfolioDirectoryRemoved = fileService.removeEmptyLegacyPortfolioDirectory();
    fileService.normalizeStorageDirectoryNames();
    const remainingDirectories = fileService.removeEmptyUnapprovedStorageDirectories();
    res.json({
      success: true,
      media: mediaResult,
      legacyPortfolioDirectoryRemoved,
      captures: captureResult,
      backups: backupResult,
      remainingDirectories,
      message: mediaResult.cleanupPending.length ||
        captureResult.cleanupPending.length ||
        backupResult.cleanupPending.length ||
        !legacyPortfolioDirectoryRemoved ||
        remainingDirectories.length
        ? 'Storage paths were updated, but some old copies remain and need review.'
        : 'Referenced media, archived captures, and legacy backups were relocated and SHA-256 verified.',
    });
  } catch (error) {
    console.error('[StorageMigration] Local portfolio media migration failed.');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Portfolio media migration failed.',
    });
  } finally {
    portfolioMediaMigrationInProgress = false;
  }
});

adminRouter.get('/vfs-files', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storedMedia = await FileMetadataModel.find({
      path: { $regex: '^Portfolio/Media/' },
    }).lean<StoredFileMetadata[]>();
    storedMedia.forEach((file) => db.files.set(file.id, file));
    fileService.pruneMissingDiskFiles();
    const { search, pathPrefix } = req.query;
    let items = Array.from(db.files.values());

    if (pathPrefix) {
      const p = String(pathPrefix).toLowerCase();
      items = items.filter((f) => f.path.toLowerCase().startsWith(p));
    }
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }

    res.json({
      success: true,
      total: items.length,
      files: items.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        type: f.type,
        extension: f.extension,
        size: f.size,
        modified: f.modified,
        uploadedAt: f.uploadedAt,
        storagePath: fileService.getStorageDisplayPath(f),
        parentId: f.parentId,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/vfs-files/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = db.files.get(id);
    if (!file) {
      res.status(404).json({ success: false, error: 'File metadata not found in VFS.' });
      return;
    }
    db.files.delete(id);
    if (mongoose.connection.readyState === 1) {
      await FileMetadataModel.findOneAndDelete({ id }).catch(() => {});
    }
    await recordAudit(req, 'DELETE', 'VFSFile', id, `Admin deleted VFS file: ${file.path}`);
    res.json({ success: true, message: 'VFS file metadata deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * AUDIT LOGS
 */
adminRouter.get('/audit-logs', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await AdminAuditLogModel.find().sort({ timestamp: -1 }).limit(500).lean();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DEFAULT LIVE PORTFOLIO CONTENT & DYNAMIC MANAGEMENT
 * Allows website owner to modify all portfolio content from admin panel without code redeploy.
 */
let cachedSiteContent: any = {
  profile: {
    name: 'Anish Jethva',
    title: 'Full Stack & AI Engineer',
    tagline: 'Building intelligent software, agentic systems, and joyful web operating systems.',
    bio: 'Passionate Full Stack & AI Engineer with expertise in architecting high-performance web applications, cloud systems, and generative AI interfaces. Obsessed with clean UI/UX, responsive systems design, and craft in frontend and backend technologies.',
    avatar: '/avatar.png',
    email: 'anish.jethva2006@gmail.com',
    phone: '+91 98765 43210',
    location: 'India',
    github: 'https://github.com/anishjethva18',
    linkedin: 'https://linkedin.com/in/anishjethva/',
    instagram: 'https://instagram.com/anish_jethva18',
    twitter: 'https://twitter.com/anishjethva',
    website: 'https://anishjethva.dev',
    resumeUrl: '/downloads/resume.pdf',
    goals: [
      'Master agentic AI systems and multi-modal integration',
      'Contribute to transformative open-source developer tooling',
      'Build intuitive, joyful software that solves real human problems',
    ],
    stats: {
      publicRepos: 28,
      totalStars: 540,
      followers: 120,
      yearsExperience: 4,
      completedProjects: 18,
    },
  },
  skills: [
    {
      title: 'Frontend',
      icon: 'Monitor',
      skills: ['TypeScript', 'JavaScript', 'React', 'Tailwind CSS', 'Next.js', 'Vite', 'HTML5', 'Canvas', 'WebGL'].map((name) => ({ name })),
    },
    {
      title: 'Backend',
      icon: 'Server',
      skills: ['Node.js', 'Express.js', 'GraphQL', 'REST API'].map((name) => ({ name })),
    },
    {
      title: 'Database',
      icon: 'Database',
      skills: ['PostgreSQL', 'SQL', 'Redis', 'Caching'].map((name) => ({ name })),
    },
    {
      title: 'Cloud & DevOps',
      icon: 'Cloud',
      skills: ['Docker', 'Containers'].map((name) => ({ name })),
    },
    {
      title: 'AI & Machine Learning',
      icon: 'BrainCircuit',
      skills: ['Gemini', 'LLM APIs', 'LangChain', 'LlamaIndex', 'Vector Databases', 'Function Calling', 'AI Agents'].map((name) => ({ name })),
    },
    {
      title: 'Tools & Ecosystem',
      icon: 'Wrench',
      skills: ['Git', 'GitHub', 'VS Code', 'Linux', 'Webpack', 'Jest', 'Vitest'].map((name) => ({ name })),
    },
  ],
  experiences: [
    {
      role: 'Senior Full Stack & AI Engineer',
      company: 'Apex Tech Solutions',
      period: '2023 - Present',
      location: 'India',
      description: [
        'Spearheaded the development of generative AI tools that improved developer productivity by 40%.',
        'Architected microservices processing 50M+ daily events using Node.js, Express, and PostgreSQL.',
        'Mentored engineers and established company-wide standards for TypeScript and automated testing.',
      ],
      skills: ['TypeScript', 'React', 'Node.js', 'Gemini API', 'Docker', 'PostgreSQL'],
    },
    {
      role: 'Full Stack Engineer',
      company: 'Vanguard Digital Labs',
      period: '2021 - 2023',
      location: 'India',
      description: [
        'Built interactive data visualization dashboards for enterprise cloud telemetry tools.',
        'Optimized React bundle size by 38% through code splitting and asset compression.',
        'Designed and deployed resilient serverless backend endpoints and caching layers.',
      ],
      skills: ['React', 'Redux', 'D3.js', 'Node.js', 'Tailwind CSS', 'Jest'],
    },
  ],
  education: [
    {
      degree: 'B.Tech in Computer Science & Engineering',
      institution: 'Engineering Institute of Technology',
      period: '2019 - 2023',
      details: 'Graduated with Distinction. Focused on Distributed Computing, Full Stack Web Architecture, and Artificial Intelligence.',
    },
  ],
  siteSettings: {
    siteTitle: 'Windows 11 OS Portfolio — Anish Jethva',
    metaDescription: 'Interactive Windows 11 web operating system portfolio showcasing full-stack projects, AI agents, and interactive apps.',
    socialImageUrl: '',
    emailFaviconEnabled: true,
    maintenanceMode: false,
    maintenanceMessage: 'System is currently undergoing scheduled maintenance. Please check back shortly.',
    announcementBanner: {
      enabled: false,
      message: '🚀 Available for exciting new roles and AI/Full-Stack opportunities!',
      type: 'info',
      link: '',
    },
    contactEmail: 'anish.jethva2006@gmail.com',
    defaultTheme: 'dark',
    defaultWallpaper: 'Windows11.jpg',
    defaultAccentColor: '#0078d4',
    defaultIconTheme: 'fluent_3d',
    soundEnabled: true,
    animationsEnabled: true,
    assistantEnabled: true,
    disabledApps: [],
    maxUploadSizeMb: 100,
    archiveRetentionDays: 30,
  },
  securitySettings: {
    reLoginPolicy: 'remember',
    allowPublicRegistration: false,
    auditLoggingEnabled: true,
    adminPinHash: '',
    ipWhitelist: [],
  },
  updatedAt: new Date().toISOString(),
};

export async function getLivePortfolioContent() {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Published portfolio content is temporarily unavailable.');
    Object.assign(error, { status: 503 });
    throw error;
  }
  try {
    const doc = await SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean();
    if (doc) cachedSiteContent = { ...cachedSiteContent, ...doc };
  } catch (cause) {
    console.error('[PortfolioContent] MongoDB read failed; refusing to serve stale content.', cause);
    const error = new Error('Published portfolio content is temporarily unavailable.');
    Object.assign(error, { status: 503 });
    throw error;
  }
  const { securitySettings: _privateSecuritySettings, ...publicContent } = cachedSiteContent;
  return publicContent;
}

/**
 * GET /api/admin/portfolio-content
 */
adminRouter.get('/portfolio-content', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const content = await getLivePortfolioContent();
    res.json({ success: true, content });
  } catch (err: any) {
    res.status(err.status === 503 ? 503 : 500).json({
      success: false,
      error: err.status === 503 ? err.message : 'Published portfolio content could not be loaded.',
    });
  }
});

/**
 * PUT /api/admin/portfolio-content
 * Save updated profile, skills, experiences, education, and site settings
 */
adminRouter.put('/portfolio-content', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const content = req.body?.content || req.body;
    const snapshot = await contentStudioService.saveDraft(content, req.user!.userId, await getLivePortfolioContent());
    await recordAudit(req, 'SAVE_DRAFT', 'PortfolioContent', undefined, 'Admin saved portfolio content draft');
    res.json({ success: true, ...snapshot, message: 'Portfolio draft saved. Publish it from the Publish & History workspace.' });
  } catch (err: any) {
    const status = err.message?.includes('smaller than') ? 413 : err.message?.includes('must') ? 422 : 503;
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/admin/security/password
 * Secure admin password update with bcrypt verification and audit logging
 */
adminRouter.put('/security/password', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Current password and new password are required.' });
      return;
    }
    const minPasswordLength = process.env.NODE_ENV === 'production' ? 12 : 8;
    if (newPassword.length < minPasswordLength || newPassword.length > 1024) {
      res.status(400).json({ success: false, error: `New password must be at least ${minPasswordLength} characters long.` });
      return;
    }

    const admin = await UserModel.findOne({ id: req.user!.userId, role: 'admin', disabled: { $ne: true } }).lean();
    if (!admin) {
      res.status(404).json({ success: false, error: 'Administrator account not found.' });
      return;
    }

    const isValid = await authService.comparePassword(currentPassword, admin.passwordHash);
    if (!isValid) {
      await recordAudit(req, 'FAILED_PASSWORD_CHANGE', 'AdminSecurity', admin.id, 'Invalid current password provided', 'failed');
      res.status(401).json({ success: false, error: 'Current password is incorrect.' });
      return;
    }

    await authService.changePassword(admin.id, currentPassword, newPassword, req.sessionInfo?.sessionId);

    await recordAudit(req, 'PASSWORD_CHANGE', 'AdminSecurity', admin.id, 'Admin password changed successfully');
    res.json({ success: true, message: 'Administrator password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.post('/security/sessions/revoke-others', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.sessionInfo) {
      res.status(401).json({ success: false, error: 'An active administrator session is required.' });
      return;
    }

    const revokedCount = await sessionService.revokeOtherUserSessions(req.user.userId, req.sessionInfo.sessionId);
    await recordAudit(req, 'REVOKE_OTHER_SESSIONS', 'AdminSecurity', req.user.userId, `Revoked ${revokedCount} other administrator sessions`);
    res.json({ success: true, revokedCount });
  } catch {
    res.status(503).json({ success: false, error: 'Other sessions could not be revoked. Authentication storage may be unavailable.' });
  }
});

adminRouter.get('/security/session-history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(50, Number.parseInt(String(req.query.limit || '5'), 10) || 5));
    const history = await sessionService.getSessionHistory(page, limit);
    res.json({ success: true, ...history });
  } catch (error) {
    console.error('[Admin] Login history could not be loaded:', error);
    res.status(503).json({ success: false, error: 'Login history could not be loaded.' });
  }
});

/**
 * GET /api/admin/backup/export
 * Export a portable portfolio backup without account credentials or active sessions.
 */
adminRouter.get('/backup/export', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const backupType = req.query.type === 'full' ? 'full-portfolio-assets' : 'manual-portfolio';
    const snapshot = createPortableBackup(
      await backupService.createSnapshot(backupType, await getLivePortfolioContent())
    );
    await recordAudit(req, 'EXPORT_BACKUP', 'Portfolio', undefined, `Generated a ${backupType} JSON backup`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="win11_${backupType}_${Date.now()}.json"`);
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/backup/restore
 * Restore portfolio content and included data collections from a validated backup.
 */
adminRouter.post('/backup/restore', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  if (backupRestoreInProgress) {
    res.setHeader('Retry-After', '1');
    res.status(409).json({
      success: false,
      error: 'Another backup restore is in progress. Please retry shortly.',
    });
    return;
  }
  backupRestoreInProgress = true;
  try {
    const backup = req.body;
    const collections = backup?.collections;
    const isPortfolioOnlyBackup = backup?.metadata?.scope === 'portfolio-only';
    const restoreProjectDrafts = backup?.metadata?.type === 'full-portfolio-assets' &&
      Array.isArray(collections?.projectDrafts);
    if (
      (backup?.metadata?.type !== 'manual-portfolio' && backup?.metadata?.type !== 'full-portfolio-assets') ||
      (backup?.metadata?.scope !== undefined &&
        (backup.metadata.type !== 'full-portfolio-assets' || !isPortfolioOnlyBackup)) ||
      !collections ||
      !Array.isArray(collections.projects) ||
      collections.projects.length > 10000 ||
      (collections.media !== undefined && !Array.isArray(collections.media)) ||
      !collections.publishedContent ||
      !collections.draftContent ||
      (collections.contacts !== undefined && !Array.isArray(collections.contacts)) ||
      (collections.analytics !== undefined && !Array.isArray(collections.analytics)) ||
      (collections.contentRevisions !== undefined && !Array.isArray(collections.contentRevisions)) ||
      (collections.projectDrafts !== undefined && !Array.isArray(collections.projectDrafts)) ||
      (collections.auditLogs !== undefined && !Array.isArray(collections.auditLogs)) ||
      (isPortfolioOnlyBackup &&
        (collections.contacts !== undefined ||
          collections.users !== undefined ||
          collections.analytics !== undefined ||
          collections.contentRevisions !== undefined ||
          collections.auditLogs !== undefined)) ||
      (backup?.metadata?.type === 'full-portfolio-assets' &&
        (isPortfolioOnlyBackup
          ? !Array.isArray(collections.projectDrafts)
          : !Array.isArray(collections.contacts) ||
            !Array.isArray(collections.analytics) ||
            !Array.isArray(collections.contentRevisions) ||
            !Array.isArray(collections.projectDrafts) ||
            !Array.isArray(collections.auditLogs)))
    ) {
      res.status(422).json({ success: false, error: 'Backup format is invalid or unsupported.' });
      return;
    }
    if (!verifyBackupIntegrity(backup)) {
      res.status(422).json({ success: false, error: 'Backup SHA-256 integrity validation failed.' });
      return;
    }
    if (
      backup.metadata.type === 'full-portfolio-assets' &&
      !isPortfolioOnlyBackup &&
      (
        collections.contacts.some((item: any) => !item || typeof item.id !== 'string' || typeof item.name !== 'string' ||
          typeof item.email !== 'string' || typeof item.subject !== 'string' || typeof item.message !== 'string') ||
        collections.analytics.some((item: any) => !item || typeof item.id !== 'string' || typeof item.eventName !== 'string' ||
          typeof item.category !== 'string' || typeof item.ipAddress !== 'string' || typeof item.userAgent !== 'string' ||
          typeof item.timestamp !== 'string') ||
        collections.contentRevisions.some((item: any) => !item || item.key !== 'primary_portfolio_content' ||
          !item.content || typeof item.content !== 'object' || typeof item.publishedBy !== 'string' || !item.publishedAt) ||
        collections.projectDrafts.some((item: any) => !item || typeof item.id !== 'string' ||
          typeof item.title !== 'string' || typeof item.description !== 'string') ||
        collections.auditLogs.some((item: any) => !item || typeof item.id !== 'string' || typeof item.adminId !== 'string' ||
          typeof item.adminEmail !== 'string' || typeof item.action !== 'string' || typeof item.targetType !== 'string' ||
          typeof item.details !== 'string' || typeof item.ipAddress !== 'string' || typeof item.timestamp !== 'string' ||
          (item.outcome !== 'success' && item.outcome !== 'failed'))
      )
    ) {
      res.status(422).json({ success: false, error: 'Full backup contains invalid portfolio data records.' });
      return;
    }

    const seenProjectIds = new Set<string>();
    const projects: any[] = [];
    for (const project of collections.projects) {
      if (!project || typeof project.id !== 'string' || !/^[\w-]{1,128}$/.test(project.id) || seenProjectIds.has(project.id)) {
        res.status(422).json({ success: false, error: 'Backup contains an invalid or duplicate project identifier.' });
        return;
      }
      const validation = normalizeProjectInput(project, true);
      if (!validation.value) {
        res.status(422).json({ success: false, error: `Backup project is invalid: ${validation.error}` });
        return;
      }
      seenProjectIds.add(project.id);
      projects.push({
        ...validation.value,
        id: project.id,
        createdAt: typeof project.createdAt === 'string' ? project.createdAt : new Date().toISOString(),
      });
    }
    const seenDraftProjectIds = new Set<string>();
    const draftProjects: any[] = [];
    for (const project of restoreProjectDrafts ? collections.projectDrafts : []) {
      if (!project || typeof project.id !== 'string' || !/^[\w-]{1,128}$/.test(project.id) ||
        seenDraftProjectIds.has(project.id)) {
        res.status(422).json({ success: false, error: 'Backup contains an invalid or duplicate draft project identifier.' });
        return;
      }
      const validation = normalizeProjectInput(project, true);
      if (!validation.value) {
        res.status(422).json({ success: false, error: `Backup draft project is invalid: ${validation.error}` });
        return;
      }
      seenDraftProjectIds.add(project.id);
      draftProjects.push({
        ...validation.value,
        id: project.id,
        createdAt: typeof project.createdAt === 'string' ? project.createdAt : new Date().toISOString(),
      });
    }

    const mediaItems: unknown[] = collections.media || [];
    const restoredMedia = new Map<string, string>();
    const createdMediaIds: string[] = [];
    let totalMediaBytes = 0;
    const maxAllowedBytes = backup.metadata.type === 'full-portfolio-assets'
      ? MAX_FULL_BACKUP_MEDIA_BYTES
      : MAX_BACKUP_MEDIA_BYTES;

    for (const item of mediaItems) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof (item as any).sourceUrl !== 'string' ||
        typeof (item as any).name !== 'string' ||
        typeof (item as any).extension !== 'string' ||
        typeof (item as any).contentBase64 !== 'string' ||
        ((item as any).storagePath !== undefined && typeof (item as any).storagePath !== 'string') ||
        !Number.isSafeInteger((item as any).sizeBytes) ||
        !/^\/api\/portfolio-media\/[\w-]{1,128}$/.test((item as any).sourceUrl) ||
        restoredMedia.has((item as any).sourceUrl)
      ) {
        res.status(422).json({ success: false, error: 'Backup contains invalid or duplicate portfolio media.' });
        return;
      }
      const extension = (item as any).extension.toLowerCase();
      const safeName = fileService.sanitizeFileName((item as any).name);
      const contentBase64 = (item as any).contentBase64 as string;
      const storagePath = (item as any).storagePath as string | undefined;
      const storageCategory = storagePath?.match(/^storage\/(resume|profile|certificates|project)\/[^/]+$/)?.[1] as
        FileStorageCategory | undefined;
      if (
        !ALLOWED_EXTENSIONS.has(extension) ||
        safeName !== (item as any).name ||
        (storagePath !== undefined && !storageCategory) ||
        !isValidBackupBase64(contentBase64)
      ) {
        res.status(422).json({ success: false, error: 'Backup contains invalid portfolio media data.' });
        return;
      }
      const buffer = Buffer.from(contentBase64, 'base64');
      if (
        buffer.length !== (item as any).sizeBytes ||
        buffer.toString('base64') !== contentBase64 ||
        !mediaSignatureIsValid(extension, buffer)
      ) {
        res.status(422).json({ success: false, error: 'Backup contains invalid portfolio media data.' });
        return;
      }
      totalMediaBytes += buffer.length;
      if (totalMediaBytes > maxAllowedBytes) {
        res.status(413).json({ success: false, error: `Backup portfolio media exceeds the ${Math.round(maxAllowedBytes / (1024 * 1024))} MB restore limit.` });
        return;
      }
    }

    const restoreContactIds: string[] = Array.isArray(collections.contacts)
      ? [...new Set<string>(collections.contacts
          .filter((contact: any) => contact && typeof contact.id === 'string' &&
            typeof contact.name === 'string' && typeof contact.email === 'string')
          .map((contact: any) => contact.id as string))]
      : [];
    const restoreUserIds: string[] = Array.isArray(collections.users)
      ? [...new Set<string>(collections.users
          .filter((user: any) => user && typeof user.id === 'string' && typeof user.email === 'string' &&
            user.id !== req.user!.userId)
          .map((user: any) => user.id as string))]
      : [];
    const fullRestore = backup.metadata.type === 'full-portfolio-assets' && !isPortfolioOnlyBackup;
    const [
      previousSiteContent,
      previousDraft,
      previousProjects,
      previousProjectDraft,
      previousContacts,
      previousAnalytics,
      previousContentRevisions,
      previousAuditLogs,
      previousUsers,
    ] = await Promise.all([
      SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean(),
      AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean(),
      ProjectModel.find().lean(),
      restoreProjectDrafts ? AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean() : Promise.resolve(null),
      fullRestore
        ? ContactModel.find().lean()
        : restoreContactIds.length ? ContactModel.find({ id: { $in: restoreContactIds } }).lean() : [],
      fullRestore ? AnalyticsModel.find().lean() : [],
      fullRestore ? AdminContentRevisionModel.find({ key: 'primary_portfolio_content' }).lean() : [],
      fullRestore ? AdminAuditLogModel.find().lean() : [],
      restoreUserIds.length ? UserModel.find({ id: { $in: restoreUserIds } }).lean() : [],
    ]);
    try {
      for (const item of mediaItems as Array<{
        sourceUrl: string;
        name: string;
        extension: string;
        contentBase64: string;
        storagePath?: string;
      }>) {
        const buffer = Buffer.from(item.contentBase64, 'base64');
        const storageCategory = item.storagePath?.match(/^storage\/(resume|profile|certificates|project)\/[^/]+$/)?.[1] as
          FileStorageCategory | undefined;
        const saved = fileService.saveUploadedBuffer(
          buffer,
          item.name,
          `Portfolio/Media/${item.name}`,
          'Portfolio/Media',
          req.user!.userId,
          storageCategory
        );
        createdMediaIds.push(saved.id);
        await FileMetadataModel.updateOne({ id: saved.id }, { $set: saved }, { upsert: true });
        const restoredUrl = `/api/portfolio-media/${encodeURIComponent(saved.id)}`;
        restoredMedia.set(item.sourceUrl, restoredUrl);
        const sourceId = item.sourceUrl.slice('/api/portfolio-media/'.length);
        restoredMedia.set(`/api/portfolio-media/${sourceId}`, restoredUrl);
      }

      const restoredMediaIds = new Set(
        Array.from(restoredMedia.values())
          .map(getPortfolioMediaReferenceId)
          .filter((id): id is string => Boolean(id))
      );
      const mediaWarnings = new Set<string>();
      const sanitizeRestoredReferences = <T>(value: T): T => {
        const sanitized = removeUnavailablePortfolioMediaReferences(value, restoredMediaIds);
        for (const id of sanitized.missingIds) {
          mediaWarnings.add(`Portfolio media ${id} was unavailable and its broken reference was removed during restore.`);
        }
        return sanitized.value;
      };
      const publishedContent = sanitizeRestoredReferences(
        replaceBackupMediaReferences(collections.publishedContent, restoredMedia)
      );
      const draftContent = sanitizeRestoredReferences(
        replaceBackupMediaReferences(collections.draftContent, restoredMedia)
      );
      const restoredProjects = sanitizeRestoredReferences(
        replaceBackupMediaReferences(projects, restoredMedia) as any[]
      );
      const restoredDraftProjects = sanitizeRestoredReferences(
        replaceBackupMediaReferences(draftProjects, restoredMedia) as any[]
      );
      const restoredContentRevisions = fullRestore
        ? collections.contentRevisions.map((revision: any) => replaceBackupMediaReferences(revision, restoredMedia))
        : [];
      const sanitizedRevisions = sanitizeRestoredReferences(restoredContentRevisions);
      const allMediaReferences = [
        publishedContent,
        draftContent,
        restoredProjects,
        restoredDraftProjects,
        sanitizedRevisions,
      ];
      for (const value of allMediaReferences) {
        const references = collectBackupMediaReferences(value);
        if (references.some((reference) => !Array.from(restoredMedia.values()).includes(reference))) {
          throw new Error('Backup references portfolio media that is not included in the backup.');
        }
      }

      await contentStudioService.restoreBackup(publishedContent, draftContent, req.user!.userId);
      await ProjectModel.deleteMany({});
      if (restoredProjects.length) await ProjectModel.insertMany(restoredProjects);
      db.projects.clear();
      restoredProjects.forEach((project) => db.projects.set(project.id, project));
      if (restoreProjectDrafts) {
        await AdminProjectDraftModel.findOneAndUpdate(
          { key: 'primary_portfolio_projects' },
          { $set: { projects: restoredDraftProjects, updatedBy: req.user!.userId } },
          { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
        );
      }

      // Restore contacts if included in backup
      let restoredContactsCount = 0;
      if (Array.isArray(collections.contacts)) {
        if (fullRestore) {
          await ContactModel.deleteMany({});
          db.contacts.clear();
        }
        for (const contact of collections.contacts) {
          if (contact && typeof contact.id === 'string' && typeof contact.name === 'string' && typeof contact.email === 'string') {
            await ContactModel.updateOne({ id: contact.id }, { $set: contact }, { upsert: true });
            db.contacts.set(contact.id, contact as any);
            restoredContactsCount++;
          }
        }
      }

      let restoredAnalyticsCount = 0;
      let restoredRevisionCount = 0;
      let restoredAuditLogCount = 0;
      let restoredUsersCount = 0;
      if (fullRestore) {
        const analytics = collections.analytics.map((event: any) => replaceBackupMediaReferences(event, restoredMedia) as Record<string, unknown>);
        await AnalyticsModel.deleteMany({});
        if (analytics.length) await AnalyticsModel.insertMany(analytics);
        db.analytics.splice(0, db.analytics.length, ...analytics as any[]);
        restoredAnalyticsCount = analytics.length;

        const revisions = sanitizedRevisions.map((revision: any) => {
          const { _id: _revisionId, __v: _revisionVersion, ...portableRevision } = revision;
          return portableRevision;
        });
        await AdminContentRevisionModel.deleteMany({ key: 'primary_portfolio_content' });
        if (revisions.length) await AdminContentRevisionModel.insertMany(revisions);
        restoredRevisionCount = revisions.length;

        const auditLogs = collections.auditLogs.map((entry: any) => {
          const { _id: _auditId, __v: _auditVersion, ...portableEntry } = entry;
          return portableEntry;
        });
        await AdminAuditLogModel.deleteMany({});
        if (auditLogs.length) await AdminAuditLogModel.insertMany(auditLogs);
        restoredAuditLogCount = auditLogs.length;
      }

      if (Array.isArray(collections.users)) {
        for (const user of collections.users) {
          if (!user || typeof user.id !== 'string' || typeof user.email !== 'string' || user.id === req.user!.userId) continue;
          await UserModel.updateOne({ id: user.id }, { $set: user }, { upsert: true });
          db.users.set(user.id, user);
          restoredUsersCount++;
        }
      }

      await recordAudit(
        req,
        'RESTORE_BACKUP',
        'Portfolio',
        undefined,
        `Restored ${backup.metadata.type}: ${projects.length} projects, ${createdMediaIds.length} media files, ${restoredContactsCount} contacts, ${restoredAnalyticsCount} analytics events, ${restoredRevisionCount} content revisions, ${restoredAuditLogCount} audit logs`
      );
      res.json({
        success: true,
        message: 'Portfolio backup restored successfully.',
        ...(mediaWarnings.size ? { warnings: Array.from(mediaWarnings) } : {}),
        restored: {
          projects: projects.length,
          media: createdMediaIds.length,
          contacts: restoredContactsCount,
          analytics: restoredAnalyticsCount,
          contentRevisions: restoredRevisionCount,
          auditLogs: restoredAuditLogCount,
          users: restoredUsersCount,
        },
      });
    } catch (restoreError) {
      const rollbackFailures: string[] = [];
      const attemptRollback = async (area: string, action: () => Promise<void>) => {
        try {
          await action();
        } catch {
          rollbackFailures.push(area);
          console.error(`[BackupRestore] Rollback failed for ${area}.`);
        }
      };

      await attemptRollback('published content', async () => {
        await SiteContentModel.deleteOne({ key: 'primary_portfolio_content' });
        if (previousSiteContent) await SiteContentModel.create(previousSiteContent);
      });
      await attemptRollback('content draft', async () => {
        await AdminContentDraftModel.deleteOne({ key: 'primary_portfolio_content' });
        if (previousDraft) await AdminContentDraftModel.create(previousDraft);
      });
      if (fullRestore) {
        await attemptRollback('content revision history', async () => {
          await AdminContentRevisionModel.deleteMany({ key: 'primary_portfolio_content' });
          if (previousContentRevisions.length) await AdminContentRevisionModel.insertMany(previousContentRevisions);
        });
      }
      if (restoreUserIds.length) {
        await attemptRollback('users', async () => {
          await UserModel.deleteMany({ id: { $in: restoreUserIds } });
          if (previousUsers.length) await UserModel.insertMany(previousUsers);
          restoreUserIds.forEach((id) => db.users.delete(id));
          previousUsers.forEach((user: any) => db.users.set(user.id, user));
        });
      }
      await attemptRollback('projects', async () => {
        await ProjectModel.deleteMany({});
        if (previousProjects.length) await ProjectModel.insertMany(previousProjects);
        db.projects.clear();
        previousProjects.forEach((project: any) => db.projects.set(project.id, project));
      });
      if (restoreProjectDrafts) {
        await attemptRollback('project draft', async () => {
          await AdminProjectDraftModel.deleteOne({ key: 'primary_portfolio_projects' });
          if (previousProjectDraft) await AdminProjectDraftModel.create(previousProjectDraft);
        });
      }
      if (fullRestore || restoreContactIds.length) {
        await attemptRollback('contacts', async () => {
          if (fullRestore) {
            await ContactModel.deleteMany({});
            db.contacts.clear();
          } else {
            await ContactModel.deleteMany({ id: { $in: restoreContactIds } });
            restoreContactIds.forEach((id) => db.contacts.delete(id));
          }
          if (previousContacts.length) await ContactModel.insertMany(previousContacts);
          previousContacts.forEach((contact: any) => db.contacts.set(contact.id, contact));
        });
      }
      if (fullRestore) {
        await attemptRollback('analytics', async () => {
          await AnalyticsModel.deleteMany({});
          if (previousAnalytics.length) await AnalyticsModel.insertMany(previousAnalytics);
          db.analytics.splice(0, db.analytics.length, ...previousAnalytics as any[]);
        });
        await attemptRollback('audit history', async () => {
          await AdminAuditLogModel.deleteMany({});
          if (previousAuditLogs.length) await AdminAuditLogModel.insertMany(previousAuditLogs);
        });
      }
      for (const id of createdMediaIds) {
        await attemptRollback('restored media', async () => {
          const file = db.getFileById(id);
          let fileCleanupFailed = false;
          if (file?.diskPath && fs.existsSync(file.diskPath)) {
            try {
              fileService.deleteFile(id);
            } catch {
              fileCleanupFailed = true;
              console.error('[BackupRestore] Could not remove a newly restored media file.');
            }
          } else {
            db.files.delete(id);
          }
          try {
            await FileMetadataModel.deleteOne({ id });
          } catch {
            fileCleanupFailed = true;
            console.error('[BackupRestore] Could not remove metadata for newly restored media.');
          }
          db.files.delete(id);
          if (fileCleanupFailed) throw new Error('Media rollback was incomplete.');
        });
      }
      if (rollbackFailures.length) {
        console.error(`[BackupRestore] Restore rollback incomplete for ${rollbackFailures.join(', ')}.`);
        throw new BackupRestoreRollbackError();
      }
      throw restoreError;
    }
  } catch (err: any) {
    if (err instanceof BackupRestoreRollbackError) {
      res.status(500).json({
        success: false,
        error: 'Backup restore failed and rollback could not fully complete. Check database and media state before further edits.',
      });
      return;
    }
    console.error('[BackupRestore] Restore failed.');
    res.status(500).json({ success: false, error: 'Backup restore failed. No backup contents were included in this response.' });
  } finally {
    backupRestoreInProgress = false;
  }
});
