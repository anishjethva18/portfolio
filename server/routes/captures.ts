import { Router, Response, RequestHandler } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { isIP } from 'net';
import { randomUUID } from 'crypto';
import { db, CaptureData } from '../db/database';
import { CaptureModel } from '../models/Capture';
import { windowsStorageService } from '../services/windowsStorageService';
import { requireAuth, requireAdmin, optionalAuth, AuthenticatedRequest } from '../middleware/auth';

export const capturesRouter = Router();
export const MAX_CAPTURE_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_CAPTURE_REQUEST_BYTES = MAX_CAPTURE_UPLOAD_BYTES + 64 * 1024;
export const MAX_CONCURRENT_CAPTURE_UPLOADS = 1;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CAPTURE_UPLOAD_BYTES,
    files: 1,
    fields: 2,
    fieldSize: 1024,
    fieldNameSize: 100,
    parts: 3,
    headerPairs: 20,
  },
});

let activeCaptureUploads = 0;

const runUpload: RequestHandler = (req, res, next) => {
  const contentLength = req.headers['content-length'];
  if (contentLength !== undefined) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      res.status(400).json({ success: false, error: 'Capture request size is invalid.' });
      req.resume();
      return;
    }
    if (declaredBytes > MAX_CAPTURE_REQUEST_BYTES) {
      res.status(413).json({
        success: false,
        error: `Capture exceeds the ${Math.floor(MAX_CAPTURE_UPLOAD_BYTES / 1024 / 1024)} MB upload limit.`,
      });
      req.resume();
      return;
    }
  }

  if (activeCaptureUploads >= MAX_CONCURRENT_CAPTURE_UPLOADS) {
    res.setHeader('Retry-After', '1');
    res.status(429).json({
      success: false,
      error: 'A capture upload is already in progress. Please try again shortly.',
    });
    req.resume();
    return;
  }
  activeCaptureUploads += 1;
  let released = false;
  const releaseSlot = () => {
    if (released) return;
    released = true;
    activeCaptureUploads -= 1;
  };
  res.once('finish', releaseSlot);
  res.once('close', releaseSlot);
  req.once('aborted', releaseSlot);

  let requestBytes = 0;
  let requestTooLarge = false;
  const onRequestData = (chunk: Buffer | string) => {
    requestBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
    if (requestBytes <= MAX_CAPTURE_REQUEST_BYTES || requestTooLarge) return;
    requestTooLarge = true;
    req.unpipe();
    res.status(413).json({
      success: false,
      error: `Capture exceeds the ${Math.floor(MAX_CAPTURE_UPLOAD_BYTES / 1024 / 1024)} MB upload limit.`,
    });
    req.resume();
  };
  req.on('data', onRequestData);

  upload.single('file')(req, res, (error: unknown) => {
    req.off('data', onRequestData);
    if (requestTooLarge || res.headersSent) return;
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        success: false,
        error: tooLarge
          ? `Capture exceeds the ${Math.floor(MAX_CAPTURE_UPLOAD_BYTES / 1024 / 1024)} MB upload limit.`
          : 'Capture upload was invalid.',
      });
      return;
    }
    next(error);
  });
};

const allowedCaptureExtensions: Record<'photo' | 'video', Set<string>> = {
  photo: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']),
  video: new Set(['.mp4', '.m4v', '.webm', '.mkv', '.avi']),
};

const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname === '[::1]' ||
  hostname === '::1' ||
  hostname === '127.0.0.1';

const isLoopbackAddress = (address: string | undefined): boolean => {
  if (!address) return false;
  const normalizedAddress = address.startsWith('::ffff:') ? address.slice(7) : address;
  return normalizedAddress === '::1' || (isIP(normalizedAddress) === 4 && normalizedAddress.startsWith('127.'));
};

const requireLoopbackCameraOrigin: RequestHandler = (req, res, next) => {
  const origin = req.get('origin');
  const host = req.get('host');
  let originHost = '';
  let requestHost = '';
  let originProtocol = '';

  try {
    const parsedOrigin = origin ? new URL(origin) : null;
    originHost = parsedOrigin?.hostname || '';
    originProtocol = parsedOrigin?.protocol || '';
    requestHost = host ? new URL(`http://${host}`).hostname : '';
  } catch {
    res.status(403).json({ success: false, error: 'Local camera archive is available only from this computer.' });
    return;
  }

  if (
    !origin ||
    !['http:', 'https:'].includes(originProtocol) ||
    !isLoopbackHost(originHost) ||
    !isLoopbackHost(requestHost) ||
    !isLoopbackAddress(req.socket.remoteAddress)
  ) {
    res.status(403).json({ success: false, error: 'Local camera archive is available only from this computer.' });
    return;
  }
  next();
};

export const isSupportedCaptureUpload = (
  mediaType: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number
): boolean => {
  if (mediaType !== 'photo' && mediaType !== 'video') return false;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_CAPTURE_UPLOAD_BYTES) return false;
  const extension = path.extname(originalName).toLowerCase();
  if (!allowedCaptureExtensions[mediaType].has(extension)) return false;
  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime === 'application/octet-stream') return true;
  return mediaType === 'photo' ? normalizedMime.startsWith('image/') : normalizedMime.startsWith('video/');
};

const safeDisplayName = (name: string): string =>
  path.basename(name).replace(/[\u0000-\u001f\u007f"\\/]/g, '_').slice(0, 180) || 'capture';

const publicCapture = (capture: CaptureData) => ({
  id: capture.id,
  userId: capture.userId,
  mediaType: capture.mediaType,
  fileName: capture.fileName,
  fileSize: capture.fileSize,
  adminArchived: capture.adminArchived,
  archiveExpiry: capture.archiveExpiry,
  archiveConsentAt: capture.archiveConsentAt,
  deleted: capture.deleted,
  timestamp: capture.timestamp,
});

/**
 * GET /api/captures
 * Authenticated: returns the caller's capture metadata without exposing disk paths.
 */
capturesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication is required.' });
      return;
    }
    const captures = user.role === 'admin'
      ? db.getAllCaptures()
      : db.getCapturesByUser(user.userId);
    const activeCaptures = captures.filter((capture) => !capture.deleted);
    res.json({
      success: true,
      count: activeCaptures.length,
      captures: activeCaptures.map(publicCapture),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Could not list captures.' });
  }
});

/**
 * POST /api/captures
 * Public visitors may submit only after an explicit capture-specific consent action.
 * Archive files are private on disk and can be read or removed only by admins.
 */
const handleCaptureUpload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const isLocalCapture = req.path === '/local';
    if (!isLocalCapture && req.user?.role !== 'admin' && req.body?.archiveConsent !== 'true') {
      res.status(400).json({ success: false, error: 'Explicit consent is required before archiving a capture.' });
      return;
    }
    if (!req.file?.buffer) {
      res.status(400).json({ success: false, error: 'No media file was provided.' });
      return;
    }

    const mediaType = req.body.mediaType;
    const fileName = safeDisplayName(req.file.originalname);
    if (!isSupportedCaptureUpload(mediaType, fileName, req.file.mimetype, req.file.size)) {
      res.status(415).json({ success: false, error: 'Unsupported capture type. Upload a supported photo or video file.' });
      return;
    }

    const captureId = `cap_${randomUUID()}`;
    const timestamp = new Date().toISOString();
    let adminArchivePath = '';
    let captureRecord: CaptureData | undefined;
    let metadataStorage: 'mongo' | 'memory' | undefined;
    try {
      const archive = windowsStorageService.saveConsentedCapture(
        req.file.buffer,
        `${captureId}_${fileName}`,
        mediaType
      );
      adminArchivePath = archive.filePath;
      if (!fs.existsSync(adminArchivePath) || fs.statSync(adminArchivePath).size !== req.file.size) {
        throw new Error('The server could not verify the saved archive copy.');
      }

      captureRecord = {
        id: captureId,
        userId: isLocalCapture ? 'local-machine' : req.user?.userId || 'visitor',
        mediaType,
        fileName,
        userCapturePath: '',
        adminArchivePath,
        fileSize: req.file.size,
        userSaved: false,
        adminArchived: true,
        archiveExpiry: '',
        ...(!isLocalCapture && req.body?.archiveConsent === 'true' ? { archiveConsentAt: timestamp } : {}),
        deleted: false,
        timestamp,
      };

      if (mongoose.connection.readyState === 1) {
        metadataStorage = 'mongo';
        const result = await CaptureModel.updateOne(
          { id: captureRecord.id },
          { $set: captureRecord },
          { upsert: true }
        );
        if (!result.acknowledged) throw new Error('The archive metadata could not be committed to the database.');
        db.captures.set(captureRecord.id, captureRecord);
      } else {
        metadataStorage = 'memory';
        await db.createCapture(captureRecord);
      }

      res.status(201).json({
        success: true,
        message: 'A separate copy was saved to the private admin-managed archive.',
        capture: publicCapture(captureRecord),
      });
    } catch (error) {
      console.error('[CapturesRouter] Could not persist consented archive capture:', error);
      let metadataRollbackConfirmed = metadataStorage === undefined;
      if (captureRecord && metadataStorage === 'memory') {
        db.captures.delete(captureRecord.id);
        metadataRollbackConfirmed = true;
      } else if (captureRecord && metadataStorage === 'mongo') {
        try {
          if (mongoose.connection.readyState !== 1) {
            throw new Error('Database connection was lost before metadata rollback could be confirmed.');
          }
          const result = await CaptureModel.deleteOne({ id: captureRecord.id });
          if (!result.acknowledged) {
            throw new Error('Capture metadata rollback was not acknowledged by the database.');
          }
          db.captures.delete(captureRecord.id);
          metadataRollbackConfirmed = true;
        } catch (cleanupError) {
          console.error(`[CapturesRouter] Could not confirm metadata rollback for ${captureRecord.id}.`, cleanupError);
        }
      }

      let rollbackComplete = metadataRollbackConfirmed;
      if (metadataRollbackConfirmed && adminArchivePath && fs.existsSync(adminArchivePath)) {
        try {
          fs.unlinkSync(adminArchivePath);
        } catch (cleanupError) {
          rollbackComplete = false;
          console.error('[CapturesRouter] Could not remove the incomplete archive file.', cleanupError);
        }
      }
      const rollbackMessage = rollbackComplete
        ? ''
        : ' Upload rollback could not be completed; private archive or capture metadata may require recovery.';
      res.status(500).json({
        success: false,
        error: `${error instanceof Error ? `Archive upload failed: ${error.message}` : 'Archive upload failed.'}${rollbackMessage}`,
      });
    }
};

capturesRouter.post('/', optionalAuth, runUpload, handleCaptureUpload);
capturesRouter.post('/admin', requireAdmin, runUpload, handleCaptureUpload);
capturesRouter.post('/local', requireLoopbackCameraOrigin, runUpload, handleCaptureUpload);

/**
 * DELETE /api/captures/:id
 * Retired user-copy cleanup. The admin archive remains untouched; permanent archive deletion
 * is available only through the authenticated admin archive-management endpoint.
 */
capturesRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication is required.' });
      return;
    }
    const capture = db.getCaptureById(req.params.id);
    if (!capture) {
      res.status(404).json({ success: false, error: 'Capture not found.' });
      return;
    }
    if (user.role !== 'admin' && capture.userId !== user.userId) {
      res.status(403).json({ success: false, error: 'You do not own this capture.' });
      return;
    }
    if (capture.userCapturePath && fs.existsSync(capture.userCapturePath)) {
      fs.unlinkSync(capture.userCapturePath);
    }
    await db.deleteCaptureByUser(capture.id);
    res.json({
      success: true,
      message: 'The server-side visitor copy was removed. The admin archive remains private and unchanged.',
      id: capture.id,
      adminArchived: capture.adminArchived,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Capture deletion failed.' });
  }
});

/**
 * GET /api/captures/:id/download
 * Authenticated owner can retrieve their server-side copy; admins can retrieve the private archive.
 */
capturesRouter.get('/:id/download', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication is required.' });
      return;
    }
    const capture = db.getCaptureById(req.params.id);
    if (!capture) {
      res.status(404).json({ success: false, error: 'Capture not found.' });
      return;
    }
    const isAdmin = user.role === 'admin';
    if (!isAdmin && capture.userId !== user.userId) {
      res.status(403).json({ success: false, error: 'You are not authorized to download this capture.' });
      return;
    }

    const targetPath = isAdmin ? capture.adminArchivePath : capture.userCapturePath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      res.status(404).json({ success: false, error: 'The requested server-side capture copy was not found.' });
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${safeDisplayName(capture.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.resolve(targetPath));
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Capture download failed.' });
  }
});
