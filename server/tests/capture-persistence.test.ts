import fs from 'fs';
import http from 'node:http';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { CaptureModel, SessionModel, UserModel } from '../models';
import { adminRouter } from '../routes/admin';
import {
  capturesRouter,
  isSupportedCaptureUpload,
  MAX_CAPTURE_REQUEST_BYTES,
  MAX_CAPTURE_UPLOAD_BYTES,
} from '../routes/captures';
import { sessionService } from '../services/sessionService';
import { windowsStorageService } from '../services/windowsStorageService';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`Failed: ${message}`);
  console.log(`Passed: ${message}`);
};

const createForm = (options: {
  archiveConsent?: string;
  fileName?: string;
  type?: string;
  mediaType?: 'photo' | 'video';
} = {}): FormData => {
  const form = new FormData();
  if (options.archiveConsent !== undefined) form.append('archiveConsent', options.archiveConsent);
  form.append('mediaType', options.mediaType || 'photo');
  form.append(
    'file',
    new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: options.type || 'image/jpeg' }),
    options.fileName || 'capture.jpg'
  );
  return form;
};

async function sendBoundaryUpload(baseUrl: string, fileSize: number): Promise<{ statusCode: number; body: string }> {
  const form = new FormData();
  form.append('archiveConsent', 'true');
  form.append('mediaType', 'photo');
  form.append(
    'file',
    new Blob([new Uint8Array(fileSize).fill(0x44)], { type: 'image/jpeg' }),
    'boundary.jpg'
  );
  const response = await fetch(`${baseUrl}/api/captures`, { method: 'POST', body: form });
  return { statusCode: response.status, body: await response.text() };
}

async function sendDeclaredOversizedUpload(baseUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const boundary = 'oversized-capture-test';
    const request = http.request(
      `${baseUrl}/api/captures`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': MAX_CAPTURE_REQUEST_BYTES + 1,
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode || 0));
      },
    );
    request.on('error', reject);
    request.end();
  });
}

async function runCapturePersistenceTests(): Promise<void> {
  await connectMongo();
  await db.initMongoSync();

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/captures', capturesRouter);
  app.use('/api/admin', adminRouter);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start capture test server.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let captureId = '';
  let archivePath = '';
  const extraCaptureIds: string[] = [];
  const extraArchivePaths: string[] = [];
  let adminSessionId = '';
  let adminUserId = '';

  try {
    assert(
      isSupportedCaptureUpload('photo', 'camera.HEIC', 'image/heic', 1) &&
        isSupportedCaptureUpload('video', 'capture.mkv', 'video/x-matroska', 1) &&
        !isSupportedCaptureUpload('photo', 'active.svg', 'image/svg+xml', 1) &&
        isSupportedCaptureUpload('photo', 'boundary.jpg', 'image/jpeg', MAX_CAPTURE_UPLOAD_BYTES) &&
        !isSupportedCaptureUpload('video', 'large.mp4', 'video/mp4', MAX_CAPTURE_UPLOAD_BYTES + 1),
      'Capture upload validation preserves supported formats and accepts the exact 100 MiB file-size boundary'
    );

    const oversizedStatus = await sendDeclaredOversizedUpload(baseUrl);
    assert(oversizedStatus === 413, 'Capture route rejects requests above its bounded multipart request size');

    const originalConcurrencyUpdateOne = Object.getOwnPropertyDescriptor(CaptureModel, 'updateOne');
    let persistenceStartedResolve: (() => void) | undefined;
    const persistenceStarted = new Promise<void>((resolve) => { persistenceStartedResolve = resolve; });
    Object.defineProperty(CaptureModel, 'updateOne', {
      configurable: true,
      writable: true,
      value: async () => {
        persistenceStartedResolve?.();
        await new Promise((resolve) => setTimeout(resolve, 250));
        return { acknowledged: true };
      },
    });
    const firstConcurrentUpload = fetch(`${baseUrl}/api/captures`, {
      method: 'POST',
      body: createForm({ archiveConsent: 'true' }),
    });
    try {
      await persistenceStarted;
      const pressuredUpload = await fetch(`${baseUrl}/api/captures`, {
        method: 'POST',
        body: createForm({ archiveConsent: 'true' }),
      });
      const firstResponse = await firstConcurrentUpload;
      const firstPayload = await firstResponse.json() as { capture?: { id?: string } };
      const firstId = firstPayload.capture?.id || '';
      const firstRecord = firstId ? db.getCaptureById(firstId) : undefined;
      if (firstId) extraCaptureIds.push(firstId);
      if (firstRecord?.adminArchivePath) extraArchivePaths.push(firstRecord.adminArchivePath);
      assert(
        pressuredUpload.status === 429 &&
          pressuredUpload.headers.get('retry-after') === '1' &&
          firstResponse.status === 201,
        'Capture route bounds concurrent uploads per server process while preserving the first valid upload'
      );
    } finally {
      if (originalConcurrencyUpdateOne) {
        Object.defineProperty(CaptureModel, 'updateOne', originalConcurrencyUpdateOne);
      } else {
        Reflect.deleteProperty(CaptureModel, 'updateOne');
      }
    }

    const unauthenticatedRoutes = await Promise.all([
      fetch(`${baseUrl}/api/captures`),
      fetch(`${baseUrl}/api/admin/archives`),
    ]);
    assert(
      unauthenticatedRoutes.every((response) => response.status === 401),
      'Capture listings and admin archive listing reject unauthenticated visitors'
    );

    const missingConsent = await fetch(`${baseUrl}/api/captures`, {
      method: 'POST',
      body: createForm({ archiveConsent: 'false' }),
    });
    assert(missingConsent.status === 400, 'Capture archive upload rejects missing explicit consent');

    const invalidType = await fetch(`${baseUrl}/api/captures`, {
      method: 'POST',
      body: createForm({ archiveConsent: 'true', fileName: 'capture.svg', type: 'image/svg+xml' }),
    });
    assert(invalidType.status === 415, 'Capture archive upload rejects unsupported active SVG files');

    const accepted = await fetch(`${baseUrl}/api/captures`, {
      method: 'POST',
      body: createForm({ archiveConsent: 'true' }),
    });
    const payload = await accepted.json() as {
      success?: boolean;
      capture?: { id?: string; archiveConsentAt?: string; archiveExpiry?: string };
    };
    captureId = payload.capture?.id || '';
    const record = captureId ? db.getCaptureById(captureId) : undefined;
    archivePath = record?.adminArchivePath || '';
    assert(
      accepted.status === 201 &&
        payload.success === true &&
        Boolean(payload.capture?.archiveConsentAt) &&
        payload.capture?.archiveExpiry === '' &&
        record?.adminArchived === true &&
        record.userSaved === false &&
        record.userCapturePath === '' &&
        fs.existsSync(archivePath) &&
        path.relative(windowsStorageService.getCaptureArchiveRoot(), archivePath).startsWith(`CaptureImage${path.sep}`),
      'Consented visitor photo upload creates a persistent private copy under AdminArchive/CaptureImage'
    );

    const boundaryUpload = await sendBoundaryUpload(baseUrl, MAX_CAPTURE_UPLOAD_BYTES);
    const boundaryPayload = JSON.parse(boundaryUpload.body) as { capture?: { id?: string } };
    const boundaryId = boundaryPayload.capture?.id || '';
    const boundaryRecord = boundaryId ? db.getCaptureById(boundaryId) : undefined;
    if (boundaryId) extraCaptureIds.push(boundaryId);
    if (boundaryRecord?.adminArchivePath) extraArchivePaths.push(boundaryRecord.adminArchivePath);
    assert(
      boundaryUpload.statusCode === 201 &&
        Boolean(boundaryRecord) &&
        boundaryRecord?.fileSize === MAX_CAPTURE_UPLOAD_BYTES &&
        fs.existsSync(boundaryRecord.adminArchivePath),
      'Capture route accepts and persists a dummy upload exactly at the configured 100 MiB boundary'
    );

    const oversizedFileUpload = await sendBoundaryUpload(baseUrl, MAX_CAPTURE_UPLOAD_BYTES + 1);
    assert(
      oversizedFileUpload.statusCode === 413,
      'Capture route returns 413 when a streamed file exceeds the configured file-size boundary'
    );

    const originalUpdateOneDescriptor = Object.getOwnPropertyDescriptor(CaptureModel, 'updateOne');
    const originalSaveConsentedCapture = windowsStorageService.saveConsentedCapture;
    let failedArchivePath = '';
    windowsStorageService.saveConsentedCapture = function (...args) {
      const saved = originalSaveConsentedCapture.apply(windowsStorageService, args);
      failedArchivePath = saved.filePath;
      return saved;
    };
    Object.defineProperty(CaptureModel, 'updateOne', {
      configurable: true,
      writable: true,
      value: async () => ({ acknowledged: false }),
    });
    try {
      const failedPersistence = await fetch(`${baseUrl}/api/captures`, {
        method: 'POST',
        body: createForm({ archiveConsent: 'true' }),
      });
      assert(
        failedPersistence.status === 500 &&
          Boolean(failedArchivePath) &&
          !fs.existsSync(failedArchivePath),
        'Capture upload removes its newly written archive file when metadata persistence fails'
      );
    } finally {
      if (originalUpdateOneDescriptor) {
        Object.defineProperty(CaptureModel, 'updateOne', originalUpdateOneDescriptor);
      } else {
        Reflect.deleteProperty(CaptureModel, 'updateOne');
      }
      windowsStorageService.saveConsentedCapture = originalSaveConsentedCapture;
    }

    const firstCollision = windowsStorageService.saveConsentedCapture(
      Buffer.from('first private copy'),
      'same-name.jpg',
      'photo'
    );
    const secondCollision = windowsStorageService.saveConsentedCapture(
      Buffer.from('second private copy'),
      'same-name.jpg',
      'photo'
    );
    const videoArchive = windowsStorageService.saveConsentedCapture(
      Buffer.from('video bytes'),
      'sample.mp4',
      'video'
    );
    extraArchivePaths.push(firstCollision.filePath, secondCollision.filePath, videoArchive.filePath);
    assert(
      firstCollision.filePath !== secondCollision.filePath &&
        fs.readFileSync(firstCollision.filePath, 'utf8') === 'first private copy' &&
        fs.readFileSync(secondCollision.filePath, 'utf8') === 'second private copy' &&
        path.relative(windowsStorageService.getCaptureArchiveRoot(), videoArchive.filePath).startsWith(`CaptureVideo${path.sep}`),
      'Capture archive writes use collision-safe unique names and separate video storage from photos'
    );

    const privateEndpoints = await Promise.all([
      fetch(`${baseUrl}/api/captures/${captureId}/download`),
      fetch(`${baseUrl}/api/captures/${captureId}`, { method: 'DELETE' }),
      fetch(`${baseUrl}/api/admin/archives/${captureId}/preview`),
      fetch(`${baseUrl}/api/admin/archives/${captureId}/download`),
      fetch(`${baseUrl}/api/admin/archives/${captureId}`, { method: 'DELETE' }),
    ]);
    assert(
      privateEndpoints.every((response) => response.status === 401),
      'Anonymous users cannot retrieve, delete, preview, or purge a private archive'
    );
    const anonymousAdminCapture = await fetch(`${baseUrl}/api/captures/admin`, {
      method: 'POST',
      body: createForm({ fileName: 'anonymous.jpg' }),
    });
    assert(
      anonymousAdminCapture.status === 401,
      'Automatic camera archive uploads require an authenticated admin session'
    );
    const blockedLocalCapture = await fetch(`${baseUrl}/api/captures/local`, {
      method: 'POST',
      body: createForm({ fileName: 'blocked-local.jpg' }),
    });
    const blockedRemoteOrigin = await fetch(`${baseUrl}/api/captures/local`, {
      method: 'POST',
      headers: { Origin: 'https://outside.example' },
      body: createForm({ fileName: 'blocked-remote.jpg' }),
    });
    assert(
      blockedLocalCapture.status === 403 && blockedRemoteOrigin.status === 403,
      'Unauthenticated local archive rejects requests without a loopback browser origin'
    );
    const localArchiveResponses = [
      await fetch(`${baseUrl}/api/captures/local`, {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173' },
        body: createForm({ fileName: 'local-camera.jpg' }),
      }),
      await fetch(`${baseUrl}/api/captures/local`, {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173' },
        body: createForm({ fileName: 'local-camera.mp4', type: 'video/mp4', mediaType: 'video' }),
      }),
    ];
    const localArchivePayloads = await Promise.all(
      localArchiveResponses.map((response) => response.json())
    ) as Array<{ success?: boolean; capture?: { id?: string; mediaType?: string } }>;
    const localArchiveRecords = localArchivePayloads.map((payload) =>
      payload.capture?.id ? db.getCaptureById(payload.capture.id) : undefined
    );
    for (const record of localArchiveRecords) {
      if (!record) continue;
      extraCaptureIds.push(record.id);
      extraArchivePaths.push(record.adminArchivePath);
    }
    assert(
      localArchiveResponses.every((response) => response.status === 201) &&
        localArchivePayloads.every((payload) => payload.success === true) &&
        localArchiveRecords[0]?.userId === 'local-machine' &&
        localArchiveRecords[0]?.mediaType === 'photo' &&
        path.relative(windowsStorageService.getCaptureArchiveRoot(), localArchiveRecords[0].adminArchivePath).startsWith(`CaptureImage${path.sep}`) &&
        localArchiveRecords[1]?.userId === 'local-machine' &&
        localArchiveRecords[1]?.mediaType === 'video' &&
        path.relative(windowsStorageService.getCaptureArchiveRoot(), localArchiveRecords[1].adminArchivePath).startsWith(`CaptureVideo${path.sep}`),
      'Loopback-only local camera archives save photos and videos without login or visitor consent'
    );

    await db.deleteCaptureByUser(captureId);
    assert(
      fs.existsSync(archivePath) && db.getCaptureById(captureId)?.adminArchived === true,
      'Visitor-copy deletion does not remove the separately stored admin archive'
    );

    adminUserId = `capture_admin_${Date.now()}`;
    const adminEmail = `${adminUserId}@test.local`;
    const now = new Date().toISOString();
    await UserModel.create({
      id: adminUserId,
      email: adminEmail,
      passwordHash: 'not-used-by-session-test',
      name: 'Capture Test Admin',
      role: 'admin',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    db.users.set(adminUserId, {
      id: adminUserId,
      email: adminEmail,
      passwordHash: 'not-used-by-session-test',
      name: 'Capture Test Admin',
      role: 'admin',
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    const adminSession = await sessionService.createSession({ id: adminUserId, email: adminEmail, role: 'admin' });
    adminSessionId = adminSession.sessionId;
    const adminHeaders = {
      Cookie: `sid=${adminSessionId}`,
      'X-CSRF-Token': adminSession.csrfToken,
    };

    const automaticAdminCaptures = [
      await fetch(`${baseUrl}/api/captures/admin`, {
        method: 'POST',
        headers: adminHeaders,
        body: createForm({ fileName: 'admin-camera.jpg' }),
      }),
      await fetch(`${baseUrl}/api/captures/admin`, {
        method: 'POST',
        headers: adminHeaders,
        body: createForm({ fileName: 'admin-camera.mp4', type: 'video/mp4', mediaType: 'video' }),
      }),
    ];
    const automaticAdminPayloads = await Promise.all(
      automaticAdminCaptures.map((response) => response.json())
    ) as Array<{ success?: boolean; capture?: { id?: string; mediaType?: string } }>;
    const automaticAdminRecords = automaticAdminPayloads.map((payload) =>
      payload.capture?.id ? db.getCaptureById(payload.capture.id) : undefined
    );
    for (const record of automaticAdminRecords) {
      if (!record) continue;
      extraCaptureIds.push(record.id);
      extraArchivePaths.push(record.adminArchivePath);
    }
    assert(
      automaticAdminCaptures.every((response) => response.status === 201) &&
        automaticAdminPayloads.every((payload) => payload.success === true) &&
        automaticAdminRecords[0]?.userId === adminUserId &&
        automaticAdminRecords[0]?.mediaType === 'photo' &&
        path.relative(windowsStorageService.getCaptureArchiveRoot(), automaticAdminRecords[0].adminArchivePath).startsWith(`CaptureImage${path.sep}`) &&
        automaticAdminRecords[1]?.userId === adminUserId &&
        automaticAdminRecords[1]?.mediaType === 'video' &&
        path.relative(windowsStorageService.getCaptureArchiveRoot(), automaticAdminRecords[1].adminArchivePath).startsWith(`CaptureVideo${path.sep}`),
      'Authenticated admin camera uploads automatically archive photos and videos without visitor consent'
    );

    const missingArchiveName = `expired_${Date.now()}.png`;
    const missingArchiveId = `capture_missing_${Date.now()}`;
    const userCopyPath = path.join(
      path.dirname(windowsStorageService.getAdminArchiveRoot()),
      'UserCaptures',
      `${missingArchiveId}.png`,
    );
    const missingAdminArchivePath = path.join(
      windowsStorageService.getAdminArchiveRoot(),
      'CaptureImage',
      missingArchiveName,
    );
    fs.mkdirSync(path.dirname(userCopyPath), { recursive: true });
    fs.writeFileSync(userCopyPath, 'preserve the independent user capture copy');
    const missingCapture = {
      id: missingArchiveId,
      userId: adminUserId,
      mediaType: 'photo' as const,
      fileName: missingArchiveName,
      userCapturePath: userCopyPath,
      adminArchivePath: missingAdminArchivePath,
      fileSize: 41,
      userSaved: true,
      adminArchived: true,
      archiveExpiry: 'never',
      archiveConsentAt: now,
      deleted: false,
      timestamp: now,
    };
    await CaptureModel.create(missingCapture);
    db.captures.set(missingArchiveId, missingCapture);
    extraCaptureIds.push(missingArchiveId);
    extraArchivePaths.push(userCopyPath);
    const missingSourcesResponse = await fetch(
      `${baseUrl}/api/admin/archives/missing-sources`,
      { headers: adminHeaders },
    );
    const missingSourcesPayload = await missingSourcesResponse.json() as {
      missing?: Array<{ id: string; fileName: string }>;
    };
    assert(
      missingSourcesResponse.ok &&
        missingSourcesPayload.missing?.some((capture) =>
          capture.id === missingArchiveId && capture.fileName === missingArchiveName,
        ) === true,
      'Authenticated missing-source inventory lists metadata without exposing storage paths'
    );
    const metadataCleanupResponse = await fetch(
      `${baseUrl}/api/admin/archives/missing/${encodeURIComponent(missingArchiveName)}`,
      { method: 'DELETE', headers: adminHeaders },
    );
    const metadataCleanupPayload = await metadataCleanupResponse.json() as { success?: boolean };
    assert(
      metadataCleanupResponse.ok &&
        metadataCleanupPayload.success === true &&
        !db.getCaptureById(missingArchiveId) &&
        fs.existsSync(userCopyPath) &&
        fs.readFileSync(userCopyPath, 'utf8') === 'preserve the independent user capture copy',
      'Authenticated metadata-only cleanup removes one missing archive record without deleting its user copy'
    );

    const existingArchiveId = `capture_existing_${Date.now()}`;
    const existingArchiveName = `existing_${Date.now()}.jpg`;
    const existingArchiveRecord = {
      ...missingCapture,
      id: existingArchiveId,
      fileName: existingArchiveName,
      adminArchivePath: firstCollision.filePath,
    };
    await CaptureModel.create(existingArchiveRecord);
    db.captures.set(existingArchiveId, existingArchiveRecord);
    extraCaptureIds.push(existingArchiveId);
    const existingArchiveResponse = await fetch(
      `${baseUrl}/api/admin/archives/missing/${encodeURIComponent(existingArchiveName)}`,
      { method: 'DELETE', headers: adminHeaders },
    );
    assert(
      existingArchiveResponse.status === 409 &&
        db.getCaptureById(existingArchiveId) !== undefined &&
        fs.existsSync(firstCollision.filePath),
      'Metadata-only cleanup refuses to remove a record when its archive file exists'
    );

    const archiveListResponse = await fetch(`${baseUrl}/api/admin/archives`, { headers: adminHeaders });
    const archiveList = await archiveListResponse.json() as {
      captures?: Array<{ id: string; isExpired: boolean; ownerName: string }>;
    };
    const archivePreviewResponse = await fetch(`${baseUrl}/api/admin/archives/${captureId}/preview`, { headers: adminHeaders });
    const archiveDownloadResponse = await fetch(`${baseUrl}/api/admin/archives/${captureId}/download`, { headers: adminHeaders });
    assert(
      archiveListResponse.ok &&
        archiveList.captures?.some((capture) => capture.id === captureId && capture.isExpired === false) === true &&
        localArchiveRecords.every((record) =>
          archiveList.captures?.some((capture) => capture.id === record?.id && capture.ownerName === 'This computer') === true
        ) &&
        archivePreviewResponse.ok &&
        archivePreviewResponse.headers.get('cache-control') === 'private, no-store' &&
        archiveDownloadResponse.ok,
      'Authenticated admins can list, preview, and download the non-expiring private archive'
    );

    const purgeResponse = await fetch(`${baseUrl}/api/admin/archives/${captureId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    const purgePayload = await purgeResponse.json() as { success?: boolean; error?: string };
    assert(
      purgeResponse.ok && purgePayload.success === true && !fs.existsSync(archivePath) && !db.getCaptureById(captureId),
      `Only an authenticated admin purge permanently removes the archived capture (HTTP ${purgeResponse.status}; ${purgePayload.error || 'unexpected archive state'})`
    );
    captureId = '';
  } finally {
    if (adminSessionId) {
      await sessionService.revokeSession(adminSessionId);
      await SessionModel.deleteMany({ userId: adminUserId });
    }
    if (adminUserId) {
      db.users.delete(adminUserId);
      await UserModel.deleteOne({ id: adminUserId });
    }
    if (captureId) {
      db.captures.delete(captureId);
      if (mongoose.connection.readyState === 1) await CaptureModel.deleteOne({ id: captureId });
    }
    for (const extraId of extraCaptureIds) {
      db.captures.delete(extraId);
      if (mongoose.connection.readyState === 1) await CaptureModel.deleteOne({ id: extraId });
    }
    if (archivePath && fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    for (const filePath of extraArchivePaths) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
}

runCapturePersistenceTests().catch(async (error: unknown) => {
  console.error(error);
  await disconnectMongo();
  process.exitCode = 1;
});
