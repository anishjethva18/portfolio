import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { FileMetadataModel, ProjectModel, UserModel, ContactModel, SiteContentModel } from '../models';
import { contentStudioService } from './contentStudioService';
import { fileService } from './fileService';
import { assertPrivateStoragePath } from '../utils/privateStoragePath';
import { getPortfolioBackupRoot, getPortfolioStorageRoot } from '../utils/portfolioStorageRoot';

const MAX_BACKUP_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_FULL_BACKUP_MEDIA_BYTES = 50 * 1024 * 1024;

export type BackupType = 'manual-portfolio' | 'full-portfolio-assets';

export type PortfolioBackup = {
    metadata: {
        timestamp: string;
        version: string;
        type: BackupType;
        integrity?: { algorithm: 'sha256'; digest: string };
    };
    collections: {
        publishedContent: Record<string, unknown>;
        draftContent: Record<string, unknown>;
        projects: Array<Record<string, unknown>>;
        media: Array<{
            sourceUrl: string;
            id?: string;
            name: string;
            extension: string;
            sizeBytes: number;
            contentBase64: string;
            path?: string;
        }>;
        users?: Array<Record<string, unknown>>;
        contacts?: Array<Record<string, unknown>>;
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
        },
        collections: snapshot.collections,
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
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
    delete collections.contacts;
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

        const content = await contentStudioService.getSnapshot(fallbackContent);
        if (!content.published.profile || !content.draft.profile) {
            throw new Error('Portfolio content is unavailable; refusing to create an unrestorable backup.');
        }
        const projects = await ProjectModel.find().lean();
        const references = new Set<string>();
        const collectReferences = (value: unknown) => {
            if (typeof value === 'string') {
                const match = value.match(/^\/api\/portfolio-media\/([^/?#]+)$/);
                if (match) references.add(decodeURIComponent(match[1]));
            } else if (Array.isArray(value)) {
                value.forEach(collectReferences);
            } else if (value && typeof value === 'object') {
                Object.values(value).forEach(collectReferences);
            }
        };
        collectReferences(content.published);
        collectReferences(content.draft);
        collectReferences(projects);

        const media: PortfolioBackup['collections']['media'] = [];
        let totalMediaBytes = 0;
        const maxMediaBytes = backupType === 'full-portfolio-assets' ? MAX_FULL_BACKUP_MEDIA_BYTES : MAX_BACKUP_MEDIA_BYTES;

        // Collect referenced media first
        for (const id of references) {
            const file = await FileMetadataModel.findOne({
                id,
                path: { $regex: '^Portfolio/Media/' },
            }).lean();
            const safePath = fileService.resolveSafeDiskPath(file?.diskPath);
            if (!file || !safePath || !file.extension) {
                throw new Error(`Referenced portfolio media is missing or unavailable: ${id}`);
            }
            const buffer = fs.readFileSync(safePath);
            totalMediaBytes += buffer.length;
            if (totalMediaBytes > maxMediaBytes) {
                throw new Error(`Referenced portfolio media exceeds the ${Math.round(maxMediaBytes / (1024 * 1024))} MB backup limit.`);
            }
            media.push({
                sourceUrl: `/api/portfolio-media/${encodeURIComponent(id)}`,
                id,
                name: file.name,
                extension: file.extension.toLowerCase(),
                sizeBytes: buffer.length,
                contentBase64: buffer.toString('base64'),
                path: file.path,
            });
        }

        // If full asset backup, also include all other stored media files
        if (backupType === 'full-portfolio-assets') {
            const allFiles = await FileMetadataModel.find().lean();
            for (const file of allFiles) {
                if (!file.diskPath || references.has(file.id)) continue;
                const safePath = fileService.resolveSafeDiskPath(file.diskPath);
                if (!safePath || !fs.existsSync(safePath) || !file.extension) continue;
                const buffer = fs.readFileSync(safePath);
                totalMediaBytes += buffer.length;
                if (totalMediaBytes > maxMediaBytes) {
                    console.warn('[BackupService] Full backup reached media limit, continuing with partial media assets');
                    break;
                }
                media.push({
                    sourceUrl: `/api/portfolio-media/${encodeURIComponent(file.id)}`,
                    id: file.id,
                    name: file.name,
                    extension: file.extension.toLowerCase(),
                    sizeBytes: buffer.length,
                    contentBase64: buffer.toString('base64'),
                    path: file.path,
                });
            }
        }

        let usersList: Array<Record<string, unknown>> | undefined;
        let contactsList: Array<Record<string, unknown>> | undefined;

        if (backupType === 'full-portfolio-assets') {
            const rawUsers = await UserModel.find().lean();
            usersList = rawUsers.map(({ _id, __v, ...u }) => u as Record<string, unknown>);

            const rawContacts = await ContactModel.find().lean();
            contactsList = rawContacts.map(({ _id, __v, ...c }) => c as Record<string, unknown>);
        }

        const collections: PortfolioBackup['collections'] = {
            publishedContent: content.published,
            draftContent: content.draft,
            projects: projects.map(({ _id, __v, ...project }) => project as Record<string, unknown>),
            media,
        };

        if (usersList) collections.users = usersList;
        if (contactsList) collections.contacts = contactsList;

        const snapshot: PortfolioBackup = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '3.1.0',
                type: backupType,
            },
            collections,
        };
        snapshot.metadata.integrity = {
            algorithm: 'sha256',
            digest: getBackupIntegrityDigest(snapshot),
        };
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
