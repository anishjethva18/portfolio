import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import express from 'express';
import { db } from '../db/database';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { authRouter } from '../routes/auth';
import { windowsStorageService } from '../services/windowsStorageService';
import { backupService } from '../services/backupService';
import { CaptureModel } from '../models/Capture';
import { FileMetadataModel, ProjectModel } from '../models';
import { fileService } from '../services/fileService';

async function runRepairTests() {
    console.log('=================================================================');
    console.log('  Windows 11 Admin Panel Repair & Enhanced Security Test Suite');
    console.log('=================================================================\n');

    await connectMongo();
    await db.initMongoSync();

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string, errorDetail?: string) {
        if (condition) {
            console.log(`✔ Passed: ${testName}`);
            passed++;
        } else {
            console.error(`✘ Failed: ${testName}${errorDetail ? ` — ${errorDetail}` : ''}`);
            failed++;
        }
    }

    // --- 1. Visitor-copy retention preserves permanent admin archives ---
    try {
        const now = Date.now();
        const THIRTY_ONE_DAYS_AGO = now - (31 * 24 * 60 * 60 * 1000);
        const TEN_DAYS_AGO = now - (10 * 24 * 60 * 60 * 1000);

        const expiredId = `expired_${Date.now()}`;
        const activeId = `active_${Date.now()}`;

        // Mock Capture Root
        const mockAdminRoot = windowsStorageService.getAdminArchiveRoot();
        const mockUserRoot = windowsStorageService.getUserCaptureRoot();
        const expiredFile = path.join(mockAdminRoot, `${expiredId}.png`);
        const activeFile = path.join(mockAdminRoot, `${activeId}.png`);
        const expiredVisitorFile = path.join(mockUserRoot, `${expiredId}.png`);
        const activeVisitorFile = path.join(mockUserRoot, `${activeId}.png`);

        fs.writeFileSync(expiredFile, 'expired');
        fs.writeFileSync(activeFile, 'active');
        fs.writeFileSync(expiredVisitorFile, 'expired visitor copy');
        fs.writeFileSync(activeVisitorFile, 'active visitor copy');

        // Create records
        await db.createCapture({
            id: expiredId,
            userId: 'test_user',
            mediaType: 'photo',
            fileName: `${expiredId}.png`,
            userCapturePath: expiredVisitorFile,
            adminArchivePath: expiredFile,
            fileSize: 7,
            userSaved: true,
            adminArchived: true,
            archiveExpiry: new Date(THIRTY_ONE_DAYS_AGO + (30 * 24 * 60 * 60 * 1000)).toISOString(),
            deleted: false,
            timestamp: new Date(THIRTY_ONE_DAYS_AGO).toISOString()
        });

        await db.createCapture({
            id: activeId,
            userId: 'test_user',
            mediaType: 'photo',
            fileName: `${activeId}.png`,
            userCapturePath: activeVisitorFile,
            adminArchivePath: activeFile,
            fileSize: 6,
            userSaved: true,
            adminArchived: true,
            archiveExpiry: new Date(TEN_DAYS_AGO + (30 * 24 * 60 * 60 * 1000)).toISOString(),
            deleted: false,
            timestamp: new Date(TEN_DAYS_AGO).toISOString()
        });

        // Run cleanup
        const result = await windowsStorageService.run30DayRetentionCleanup();
        
        assert(
            fs.existsSync(expiredFile) && !fs.existsSync(expiredVisitorFile) && fs.existsSync(activeFile) && fs.existsSync(activeVisitorFile),
            'Retention removes expired visitor copies but permanently preserves admin archives'
        );
        assert(
            db.captures.get(expiredId)?.adminArchived === true && db.captures.get(expiredId)?.userSaved === false && db.captures.has(activeId),
            'Expired visitor-copy metadata is updated without deleting the archive record'
        );

        // Cleanup mock files
        if (fs.existsSync(expiredFile)) fs.unlinkSync(expiredFile);
        if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
        if (fs.existsSync(expiredVisitorFile)) fs.unlinkSync(expiredVisitorFile);
        if (fs.existsSync(activeVisitorFile)) fs.unlinkSync(activeVisitorFile);
        db.captures.delete(expiredId);
        db.captures.delete(activeId);
        await CaptureModel.deleteMany({ id: { $in: [expiredId, activeId] } });
    } catch (err: any) {
        assert(false, 'Archive retention rule', err.message);
    }

    // --- 2. Independent Copy Behavior (User deletion vs Admin Archive) ---
    try {
        const captureId = `independent_${Date.now()}`;
        const userRoot = windowsStorageService.getUserCaptureRoot();
        const adminRoot = windowsStorageService.getAdminArchiveRoot();
        
        const userPath = path.join(userRoot, `${captureId}.png`);
        const adminPath = path.join(adminRoot, `${captureId}.png`);

        fs.writeFileSync(userPath, 'user content');
        fs.writeFileSync(adminPath, 'admin content');

        await db.createCapture({
            id: captureId,
            userId: 'test_user',
            mediaType: 'photo',
            fileName: `${captureId}.png`,
            userCapturePath: userPath,
            adminArchivePath: adminPath,
            fileSize: 12,
            userSaved: true,
            adminArchived: true,
            archiveExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            deleted: false,
            timestamp: new Date().toISOString()
        });

        // Simulate user deletion
        await db.deleteCaptureByUser(captureId);
        
        const record = db.getCaptureById(captureId);
        assert(
            record?.deleted === true && fs.existsSync(adminPath),
            'User deletion marks record as deleted but leaves admin archive physical file intact'
        );

        // Cleanup
        if (fs.existsSync(userPath)) fs.unlinkSync(userPath);
        if (fs.existsSync(adminPath)) fs.unlinkSync(adminPath);
    } catch (err: any) {
        assert(false, 'Independent copy behavior', err.message);
    }

    // --- Legacy backup display/download filename compatibility ---
    const legacyBackupName = 'backup-2099-11-16T05-08-09-000Z.json';
    const backupDirectory = process.env.PORTFOLIO_BACKUP_DIR ||
        path.resolve(process.cwd(), 'server/storage/Backup');
    const legacyBackupPath = path.resolve(backupDirectory, legacyBackupName);
    try {
        fs.writeFileSync(legacyBackupPath, JSON.stringify({
            metadata: { timestamp: '2099-11-16T05:08:09.000Z', version: '3.0.0', type: 'manual-portfolio' },
            collections: { publishedContent: {}, draftContent: {}, projects: [], media: [] },
        }));
        const latest = backupService.getLatestBackup();
        assert(
            latest?.fileName === 'Windows-11-Portfolio-Backup-16-11-2099_10-38-09-AM.json' &&
            latest.filePath === legacyBackupPath,
            'Legacy backup files retain their stored path while reporting a readable timestamped download name'
        );
    } catch (err: any) {
        assert(false, 'Legacy backup filename normalization', err.message);
    } finally {
        if (fs.existsSync(legacyBackupPath)) fs.unlinkSync(legacyBackupPath);
    }

    const legacyFullBackupName = 'portfolio-full-backup-2099-11-16T05-08-10-000Z.json';
    const legacyFullBackupPath = path.resolve(backupDirectory, legacyFullBackupName);
    try {
        fs.writeFileSync(legacyFullBackupPath, JSON.stringify({
            metadata: { timestamp: '2099-11-16T05:08:10.000Z', version: '3.0.0', type: 'full-portfolio-assets' },
            collections: { publishedContent: {}, draftContent: {}, projects: [], media: [] },
        }));
        const latest = backupService.getLatestBackup();
        assert(
            latest?.fileName === 'Windows-11-Portfolio-Backup-16-11-2099_10-38-10-AM.json' &&
            latest.type === 'full-portfolio-assets' &&
            latest.filePath === legacyFullBackupPath,
            'Legacy full backup gets a readable download name and retains its full-assets type and stored path'
        );
    } catch (err: any) {
        assert(false, 'Legacy full backup filename normalization', err.message);
    } finally {
        if (fs.existsSync(legacyFullBackupPath)) fs.unlinkSync(legacyFullBackupPath);
    }

    // --- 3. Backup Operation Reliability ---
    try {
        const mediaId = `backup_test_${Date.now()}`;
        const projectId = `backup_test_project_${Date.now()}`;
        let savedMediaId: string | undefined;
        let testBackupPath: string | undefined;
        try {
            const saved = fileService.saveUploadedBuffer(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
                `${mediaId}.png`,
                `Portfolio/Media/${mediaId}.png`,
                'Portfolio/Media',
                'backup-test'
            );
            savedMediaId = saved.id;
            await FileMetadataModel.updateOne({ id: saved.id }, { $set: saved }, { upsert: true });
            await ProjectModel.create({
                id: projectId,
                title: 'Backup media test',
                description: 'Verifies referenced project media is included.',
                features: [],
                technologies: [],
                category: 'Testing',
                image: `/api/portfolio-media/${encodeURIComponent(saved.id)}`,
                stars: 0,
                featured: false,
                createdAt: new Date().toISOString(),
            });

            const result = await backupService.createManualBackup();
            testBackupPath = result.filePath;
            assert(
                result.success &&
                /^Windows-11-Portfolio-Backup-\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}-(?:AM|PM)(?:-\d+)?\.json$/.test(result.fileName) &&
                fs.existsSync(result.filePath) &&
                result.sizeBytes > 0,
                'Manual backup successfully exports portfolio content, projects, and assets to timestamped JSON archive'
            );
            const backup = JSON.parse(fs.readFileSync(result.filePath, 'utf8'));
            assert(
                backup.metadata.type === 'manual-portfolio' &&
                backup.metadata.integrity?.algorithm === 'sha256' &&
                /^[a-f0-9]{64}$/.test(backup.metadata.integrity.digest) &&
                Array.isArray(backup.collections.projects) &&
                backup.collections.publishedContent &&
                backup.collections.draftContent &&
                !backup.collections.users,
                'Manual portfolio backup includes a SHA-256 integrity digest and excludes account credentials'
            );
            assert(
                backup.collections.media.some((item: any) =>
                    item.sourceUrl === `/api/portfolio-media/${encodeURIComponent(saved.id)}` &&
                    Buffer.from(item.contentBase64, 'base64').equals(fs.readFileSync(saved.diskPath!))
                ),
                'Manual portfolio backup embeds the binary for referenced project media'
            );
            assert(!backupService.isAutomatedScheduled(), 'Portfolio backups are manual-only');

            const latest = backupService.getLatestBackup();
            assert(
                latest?.fileName === result.fileName,
                'Backup tracking correctly identifies the most recent system snapshot'
            );
        } finally {
            await ProjectModel.deleteOne({ id: projectId });
            if (savedMediaId) {
                fileService.deleteFile(savedMediaId);
                await FileMetadataModel.deleteOne({ id: savedMediaId });
            }
            if (testBackupPath && fs.existsSync(testBackupPath)) fs.unlinkSync(testBackupPath);
        }
    } catch (err: any) {
        assert(false, 'Backup operation reliability', err.message);
    }

    // --- 4. Admin Role Enforcement (Standard User Access Denial) ---
    try {
        const app = express();
        app.use(express.json());
        app.use('/api/auth', authRouter);
        const server = app.listen(0);
        const port = (server.address() as any).port;
        const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `visitor_${Date.now()}@test.local`, password: 'pass', role: 'admin' }),
        });
        await new Promise<void>((resolve, reject) => server.close((err?: Error) => err ? reject(err) : resolve()));
        assert(response.status === 404, 'Public registration endpoint is disabled');
    } catch (err: any) {
        assert(false, 'Admin role enforcement', err.message);
    }

    console.log('\n=================================================================');
    console.log(`  Repair Test Suite Completed: ${passed} passed, ${failed} failed.`);
    console.log('=================================================================\n');

    await disconnectMongo();
    process.exit(failed > 0 ? 1 : 0);
}

runRepairTests().catch(err => {
    console.error('Fatal repair test error:', err);
    process.exit(1);
});
