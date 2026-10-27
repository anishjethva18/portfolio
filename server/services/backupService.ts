import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import {
    AdminAuditLogModel,
    AdminContentRevisionModel,
    AnalyticsModel,
    ContactModel,
    FileMetadataModel,
    ProjectModel,
    SiteContentModel,
} from '../models';
import type { StoredFileMetadata } from '../db/database';
import { contentStudioService } from './contentStudioService';
import { projectDraftService } from './projectDraftService';
import { fileService } from './fileService';
import { assertPrivateStoragePath } from '../utils/privateStoragePath';
import { getPortfolioBackupRoot, getPortfolioStorageRoot } from '../utils/portfolioStorageRoot';

const MAX_BACKUP_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_FULL_BACKUP_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_SERIALIZED_BACKUP_BYTES = 100 * 1024 * 1024;

export type BackupType = 'manual-portfolio' | 'full-portfolio-assets';

export type PortfolioBackup = {
    metadata: {
        timestamp: string;
        version: string;
        type: BackupType;
        warnings?: string[];
        integrity?: { algorithm: 'sha256'; digest: string };
    };
    collections: {
        publishedContent: Record<string, unknown>;
        draftContent: Record<string, unknown>;
        projects: Array<Record<string, unknown>>;
        projectDrafts?: Array<Record<string, unknown>>;
        media: Array<{
            sourceUrl: string;
            id?: string;
            name: string;
            extension: string;
            sizeBytes: number;
            contentBase64: string;
            path?: string;
            storagePath?: string;
        }>;
        users?: Array<Record<string, unknown>>;
        contacts?: Array<Record<string, unknown>>;
        analytics?: Array<Record<string, unknown>>;
        contentRevisions?: Array<Record<string, unknown>>;
        auditLogs?: Array<Record<string, unknown>>;
    };
};

export interface BackupResult {
    success: boolean;
    fileName: string;
    filePath: string;
    sizeBytes: number;
    timestamp: string;
    collections: string[];
    type?: BackupType;
    warnings?: string[];
}

export interface LegacyBackupMove {
    fileName: string;
    sourcePath: string;
    destinationPath: string;
    sha256: string;
}

function getBackupIntegrityDigest(snapshot: Pick<PortfolioBackup, 'metadata' | 'collections'>): string {
    const payload = {
        metadata: {
            timestamp: snapshot.metadata.timestamp,
            version: snapshot.metadata.version,
            type: snapshot.metadata.type,
            ...(snapshot.metadata.warnings ? { warnings: snapshot.metadata.warnings } : {}),
        },
        collections: snapshot.collections,
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function getPortfolioMediaReferenceId(value: string): string | undefined {
    try {
        const url = new URL(value, 'http://portfolio.local');
        if (!url.pathname.startsWith('/api/portfolio-media/')) return undefined;
        const id = url.searchParams.get('id') ||
            decodeURIComponent(url.pathname.slice('/api/portfolio-media/'.length));
        return /^file-[A-Za-z0-9-]+$/.test(id) ? id : undefined;
    } catch {
        return undefined;
    }
}

export function removeUnavailablePortfolioMediaReferences<T>(
    value: T,
    availableIds: ReadonlySet<string>,
): { value: T; missingIds: string[] } {
    if (!value || typeof value !== 'object') {
        if (typeof value !== 'string') return { value, missingIds: [] };
        const id = getPortfolioMediaReferenceId(value);
        return id && !availableIds.has(id)
            ? { value: '' as T, missingIds: [id] }
            : { value, missingIds: [] };
    }

    const root: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : {};
    const pending: Array<{
        source: unknown[] | Record<string, unknown>;
        target: unknown[] | Record<string, unknown>;
    }> = [{ source: value as unknown[] | Record<string, unknown>, target: root }];
    const missingIds = new Set<string>();

    while (pending.length) {
        const { source, target } = pending.pop()!;
        const entries: Array<[string, unknown]> = Array.isArray(source)
            ? source.map((item, index) => [String(index), item])
            : Object.entries(source);

        for (const [key, child] of entries) {
            let nextValue = child;
            if (typeof child === 'string') {
                const id = getPortfolioMediaReferenceId(child);
                if (id && !availableIds.has(id)) {
                    missingIds.add(id);
                    nextValue = '';
                }
            }

            if (Array.isArray(target)) {
                const index = Number(key);
                if (!child || typeof child !== 'object') {
                    target[index] = nextValue;
                } else {
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

    return { value: root as T, missingIds: Array.from(missingIds) };
}

export function verifyBackupIntegrity(value: unknown): value is PortfolioBackup {
    if (!value || typeof value !== 'object') return false;
    const backup = value as Partial<PortfolioBackup>;
    if (!backup.metadata || !backup.collections) return false;
    const integrity = backup.metadata.integrity;
    if (!integrity) return backup.metadata.version !== '3.1.0';
    if (integrity.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/i.test(integrity.digest)) return false;
    return getBackupIntegrityDigest(backup as Pick<PortfolioBackup, 'metadata' | 'collections'>) === integrity.digest;
}

export function createPortableBackup(snapshot: PortfolioBackup): PortfolioBackup {
    const collections = { ...snapshot.collections };
    delete collections.users;
    const portable: PortfolioBackup = {
        ...snapshot,
        metadata: { ...snapshot.metadata },
        collections,
    };
    if (portable.metadata.integrity) {
        portable.metadata.integrity = {
            algorithm: 'sha256',
            digest: getBackupIntegrityDigest(portable),
        };
    }
    return portable;
}

function formatBackupFileTimestamp(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
    return `Windows-11-Portfolio-Backup-${part('day')}-${part('month')}-${part('year')}_${part('hour')}-${part('minute')}-${part('second')}-${part('dayPeriod').toUpperCase()}.json`;
}

export class BackupService {
    private backupDir: string;
    private readonly legacyBackupDirs: string[];

    constructor() {
        const storageRoot = getPortfolioStorageRoot();
        this.backupDir = getPortfolioBackupRoot(storageRoot);
        this.legacyBackupDirs = [path.join(storageRoot, 'AdminArchive', 'Backups'), path.join(storageRoot, 'Backups')];
        this.backupDir = assertPrivateStoragePath(this.backupDir, 'Portfolio backup root');
        this.ensureDir();
        this.backupDir = assertPrivateStoragePath(this.backupDir, 'Portfolio backup root');
    }

    private ensureDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o700 });
        }
    }

    public getLegacyBackupMigrationPlan(): LegacyBackupMove[] {
        const plan: LegacyBackupMove[] = [];
        for (const directory of this.legacyBackupDirs) {
            if (!fs.existsSync(directory)) continue;
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                if (!entry.isFile() || !/^(?:backup|full-backup|portfolio-backup|portfolio-full-backup|Windows-11-Portfolio-Backup)-.+\.json$/i.test(entry.name)) continue;
                const sourcePath = path.resolve(directory, entry.name);
                const destinationPath = path.resolve(this.backupDir, entry.name);
                const sha256 = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
                if (fs.existsSync(destinationPath)) {
                    const destinationHash = crypto.createHash('sha256').update(fs.readFileSync(destinationPath)).digest('hex');
                    if (sha256 !== destinationHash) {
                        throw new Error(`A different backup already exists at the new storage path: ${entry.name}`);
                    }
                }
                plan.push({ fileName: entry.name, sourcePath, destinationPath, sha256 });
            }
        }
        return plan;
    }

    public migrateLegacyBackupFiles(): { moved: number; cleanupPending: string[] } {
        const plan = this.getLegacyBackupMigrationPlan();
        const cleanupPending: string[] = [];
        let moved = 0;
        for (const entry of plan) {
            if (!fs.existsSync(entry.destinationPath)) {
                fs.copyFileSync(entry.sourcePath, entry.destinationPath, fs.constants.COPYFILE_EXCL);
                const copiedHash = crypto.createHash('sha256').update(fs.readFileSync(entry.destinationPath)).digest('hex');
                if (copiedHash !== entry.sha256) {
                    fs.unlinkSync(entry.destinationPath);
                    throw new Error(`Backup copy failed SHA-256 verification: ${entry.fileName}`);
                }
            }
            try {
                fs.unlinkSync(entry.sourcePath);
                moved += 1;
            } catch {
                cleanupPending.push(entry.sourcePath);
            }
        }
        return { moved, cleanupPending };
    }

    public async createSnapshot(
        backupType: BackupType = 'manual-portfolio',
        fallbackContent: unknown = new SiteContentModel({ key: 'primary_portfolio_content' }).toObject()
    ): Promise<PortfolioBackup> {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('MongoDB must be connected to create a portfolio backup.');
        }

        await fileService.restorePortfolioMediaIndex();
        const content = await contentStudioService.getSnapshot(fallbackContent);
        if (!content.published.profile || !content.draft.profile) {
            throw new Error('Portfolio content is unavailable; refusing to create an unrestorable backup.');
        }
        const projects = await ProjectModel.find().lean();
        const includeCompleteData = backupType === 'full-portfolio-assets';
        const projectDrafts = includeCompleteData ? await projectDraftService.getDraftProjects() : undefined;
        const [contacts, analytics, contentRevisions, auditLogs] = includeCompleteData
            ? await Promise.all([
                ContactModel.find().lean(),
                AnalyticsModel.find().lean(),
                AdminContentRevisionModel.find({ key: 'primary_portfolio_content' }).sort({ publishedAt: 1, _id: 1 }).lean(),
                AdminAuditLogModel.find().lean(),
            ])
            : [undefined, undefined, undefined, undefined];
        const references = new Set<string>();
        const collectReferences = (value: unknown) => {
            if (typeof value === 'string') {
                try {
                    const url = new URL(value, 'http://portfolio.local');
                    if (!url.pathname.startsWith('/api/portfolio-media/')) return;
                    const id = url.searchParams.get('id') || url.pathname.slice('/api/portfolio-media/'.length);
                    if (/^file-[A-Za-z0-9-]+$/.test(id)) references.add(id);
                } catch {
                    return;
                }
            } else if (Array.isArray(value)) {
                value.forEach(collectReferences);
            } else if (value && typeof value === 'object') {
                Object.values(value).forEach(collectReferences);
            }
        };
        collectReferences(content.published);
        collectReferences(content.draft);
        collectReferences(projects);
        if (projectDrafts) collectReferences(projectDrafts);
        if (contentRevisions) collectReferences(contentRevisions);

        const media: PortfolioBackup['collections']['media'] = [];
        const warnings = new Set<string>();
        let totalMediaBytes = 0;
        const maxMediaBytes = backupType === 'full-portfolio-assets' ? MAX_FULL_BACKUP_MEDIA_BYTES : MAX_BACKUP_MEDIA_BYTES;

        const referencedFiles: StoredFileMetadata[] = references.size
            ? await FileMetadataModel.find({ id: { $in: Array.from(references) } }).lean<StoredFileMetadata[]>()
            : [];
        const filesById = new Map(referencedFiles.map((file) => [file.id, file]));
        for (const file of fileService.getAllFiles()) {
            if (references.has(file.id) && !filesById.has(file.id)) filesById.set(file.id, file);
        }

        const addMedia = (file: StoredFileMetadata | undefined, id: string) => {
            const normalizedPath = file?.path.replace(/\\/g, '/');
            if (!file || !normalizedPath?.startsWith('Portfolio/Media/') || !file.extension) {
                warnings.add(`Portfolio media ${id} was unavailable and its broken reference was removed from the backup.`);
                return;
            }
            const buffer = fileService.getStoredFileBuffer(file);
            if (!buffer) {
                warnings.add(`Portfolio media ${id} had no readable file content and its broken reference was removed from the backup.`);
                return;
            }
            totalMediaBytes += buffer.length;
            if (totalMediaBytes > maxMediaBytes) {
                throw new Error(`Portfolio media exceeds the ${Math.round(maxMediaBytes / (1024 * 1024))} MB backup limit.`);
            }
            media.push({
                sourceUrl: `/api/portfolio-media/${encodeURIComponent(id)}`,
                id,
                name: file.name,
                extension: file.extension.toLowerCase(),
                sizeBytes: buffer.length,
                contentBase64: buffer.toString('base64'),
                path: file.path,
                storagePath: fileService.getStorageDisplayPath(file),
            });
        };

        for (const id of references) {
            addMedia(filesById.get(id) || fileService.getFileById(id), id);
        }

        // If full asset backup, also include all other stored media files
        if (backupType === 'full-portfolio-assets') {
            const databaseMediaFiles: StoredFileMetadata[] = await FileMetadataModel.find({
                path: { $regex: '^Portfolio/Media/' },
            }).lean<StoredFileMetadata[]>();
            const allFilesById = new Map(databaseMediaFiles.map((file) => [file.id, file]));
            for (const file of fileService.getAllFiles()) {
                if (file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/')) allFilesById.set(file.id, file);
            }
            const includedIds = new Set(media.map((item) => item.id));
            for (const file of allFilesById.values()) {
                if (includedIds.has(file.id)) continue;
                addMedia(file, file.id);
            }
        }

        const availableMediaIds = new Set(media.map((item) => item.id).filter((id): id is string => Boolean(id)));
        const sanitizedPublished = removeUnavailablePortfolioMediaReferences(content.published, availableMediaIds);
        const sanitizedDraft = removeUnavailablePortfolioMediaReferences(content.draft, availableMediaIds);
        const sanitizedProjects = removeUnavailablePortfolioMediaReferences(projects, availableMediaIds);
        const sanitizedProjectDrafts = projectDrafts
            ? removeUnavailablePortfolioMediaReferences(projectDrafts, availableMediaIds)
            : undefined;
        const sanitizedRevisions = contentRevisions
            ? removeUnavailablePortfolioMediaReferences(contentRevisions, availableMediaIds)
            : undefined;
        for (const id of [
            ...sanitizedPublished.missingIds,
            ...sanitizedDraft.missingIds,
            ...sanitizedProjects.missingIds,
            ...(sanitizedProjectDrafts?.missingIds || []),
            ...(sanitizedRevisions?.missingIds || []),
        ]) {
            warnings.add(`Portfolio media ${id} was unavailable and its broken reference was removed from the backup.`);
        }

        const collections: PortfolioBackup['collections'] = {
            publishedContent: sanitizedPublished.value,
            draftContent: sanitizedDraft.value,
            projects: sanitizedProjects.value.map(({ _id, __v, ...project }) => project as Record<string, unknown>),
            media,
        };

        if (projectDrafts) {
            collections.projectDrafts = (sanitizedProjectDrafts?.value || projectDrafts).map(({ ...project }) =>
                project as Record<string, unknown>
            );
        }
        if (contacts) collections.contacts = contacts.map(({ _id, __v, ...contact }) => contact as Record<string, unknown>);
        if (analytics) collections.analytics = analytics.map(({ _id, __v, ...event }) => event as Record<string, unknown>);
        if (contentRevisions) {
            collections.contentRevisions = (sanitizedRevisions?.value || contentRevisions).map(({ _id, __v, ...revision }) =>
                revision as Record<string, unknown>
            );
        }
        if (auditLogs) collections.auditLogs = auditLogs.map(({ _id, __v, ...entry }) => entry as Record<string, unknown>);

        const snapshot: PortfolioBackup = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '3.3.0',
                type: backupType,
                ...(warnings.size ? { warnings: Array.from(warnings) } : {}),
            },
            collections,
        };
        snapshot.metadata.integrity = {
            algorithm: 'sha256',
            digest: getBackupIntegrityDigest(snapshot),
        };
        if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_SERIALIZED_BACKUP_BYTES) {
            throw new Error('Complete backup exceeds the 100 MB JSON limit. No partial backup was created.');
        }
        return snapshot;
    }

    public async createManualBackup(
        backupType: BackupType = 'manual-portfolio',
        fallbackContent: unknown = new SiteContentModel({ key: 'primary_portfolio_content' }).toObject()
    ): Promise<BackupResult> {
        this.ensureDir();
        const now = new Date();
        const baseFileName = formatBackupFileTimestamp(now);
        let incompleteBackupPath: string | undefined;

        try {
            const data = await this.createSnapshot(backupType, fallbackContent);
            const serialized = JSON.stringify(data, null, 2);
            if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED_BACKUP_BYTES) {
                throw new Error('Complete backup exceeds the 100 MB JSON limit. No partial backup was created.');
            }
            let fileName = baseFileName;
            let filePath = path.join(this.backupDir, fileName);
            let fileDescriptor: number | undefined;
            for (let suffix = 1; suffix <= 1000; suffix += 1) {
                if (suffix > 1) {
                    fileName = baseFileName.replace(/\.json$/i, `-${suffix}.json`);
                    filePath = path.join(this.backupDir, fileName);
                }
                try {
                    fileDescriptor = fs.openSync(filePath, 'wx', 0o600);
                    incompleteBackupPath = filePath;
                    break;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                }
            }
            if (fileDescriptor === undefined) {
                throw new Error('Could not allocate a unique backup filename.');
            }
            try {
                fs.writeFileSync(fileDescriptor, serialized);
                fs.fsyncSync(fileDescriptor);
            } finally {
                fs.closeSync(fileDescriptor);
            }
            const writtenBackup = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
            if (!verifyBackupIntegrity(writtenBackup)) {
                throw new Error('Written backup failed its SHA-256 integrity check.');
            }
            const stats = fs.statSync(filePath);
            incompleteBackupPath = undefined;

            return {
                success: true,
                fileName,
                filePath,
                sizeBytes: stats.size,
                timestamp: data.metadata.timestamp,
                collections: Object.keys(data.collections),
                type: backupType,
                ...(data.metadata.warnings ? { warnings: data.metadata.warnings } : {}),
            };
        } catch (err) {
            if (incompleteBackupPath && fs.existsSync(incompleteBackupPath)) {
                try { fs.unlinkSync(incompleteBackupPath); } catch (cleanupError) {
                    console.error('[BackupService] Could not remove an incomplete backup file.', cleanupError);
                }
            }
            console.error('[BackupService] Backup failed:', err);
            throw new Error(`Backup failed: ${err instanceof Error ? err.message : 'Unknown backup error.'}`);
        }
    }

    public getLatestBackup(): BackupResult | null {
        this.ensureDir();
        try {
            const backupDirectories = [this.backupDir, ...this.legacyBackupDirs]
                .filter((directory, index, directories) =>
                    directories.indexOf(directory) === index && fs.existsSync(directory)
                );
            const files = backupDirectories.flatMap((directory) => fs.readdirSync(directory)
                .filter((name) =>
                    /^(?:backup|full-backup|portfolio-backup|portfolio-full-backup)-.+\.json$/.test(name) ||
                    /^Windows-11-Portfolio-Backup-\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}-(?:AM|PM)(?:-\d+)?\.json$/i.test(name),
                )
                .map((name) => {
                    const filePath = path.join(directory, name);
                    const stats = fs.statSync(filePath);
                    const encodedTimestamp = name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1];
                    const filenameTimestamp = encodedTimestamp
                        ? new Date(encodedTimestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z'))
                        : new Date(Number.NaN);
                    return {
                        name,
                        filePath,
                        sizeBytes: stats.size,
                        timestamp: Number.isFinite(filenameTimestamp.getTime())
                            ? filenameTimestamp.toISOString()
                            : stats.mtime.toISOString(),
                    };
                }))
                .sort((left, right) => right.timestamp.localeCompare(left.timestamp));

            const latest = files[0];
            if (!latest) return null;

            let timestamp = latest.timestamp;
            let type: BackupType = latest.name.startsWith('full-backup-') || latest.name.startsWith('portfolio-full-backup-') || latest.name.startsWith('Windows-11-Portfolio-Backup-')
                ? 'full-portfolio-assets'
                : 'manual-portfolio';
            try {
                const backup = JSON.parse(fs.readFileSync(latest.filePath, 'utf8')) as PortfolioBackup;
                if (!verifyBackupIntegrity(backup)) {
                    console.error(`[BackupService] Backup integrity validation failed for ${latest.name}.`);
                    return null;
                }
                if (backup.metadata?.timestamp && Number.isFinite(new Date(backup.metadata.timestamp).getTime())) {
                    timestamp = new Date(backup.metadata.timestamp).toISOString();
                }
                if (backup.metadata?.type === 'full-portfolio-assets' || backup.metadata?.type === 'manual-portfolio') {
                    type = backup.metadata.type;
                }
            } catch (error) {
                console.error(`[BackupService] Could not read backup metadata from ${latest.name}:`, error);
                return null;
            }

            const isDescriptiveName = /^Windows-11-Portfolio-Backup-\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}-(?:AM|PM)(?:-\d+)?\.json$/i.test(latest.name);
            return {
                success: true,
                fileName: isDescriptiveName ? latest.name : formatBackupFileTimestamp(new Date(timestamp)),
                filePath: latest.filePath,
                sizeBytes: latest.sizeBytes,
                timestamp,
                collections: [],
                type,
            };
        } catch (error) {
            console.error('[BackupService] Could not determine the latest backup:', error);
            return null;
        }
    }

    public isAutomatedScheduled(): boolean {
        return false;
    }
}

export const backupService = new BackupService();
