import { Router, Response } from 'express';
import multer from 'multer';
import { windowsStorageService } from '../services/windowsStorageService';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

export const storageRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

/**
 * GET /api/storage/health
 * Admin-only storage health, including server-side path details.
 */
storageRouter.get('/health', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const health = windowsStorageService.getHealth();
    res.json({ success: true, ...health });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/storage/capture
 * Authenticated legacy file upload to the private USER_CAPTURE_ROOT.
 */
storageRouter.post(
  '/capture',
  requireAuth,
  upload.single('file') as any,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file provided in request.' });
        return;
      }

      const originalName = req.file.originalname || 'capture.bin';
      const result = windowsStorageService.saveUserCapture(req.file.buffer, originalName);

      res.status(201).json({
        success: true,
        message: 'File saved successfully to User Capture storage root.',
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/storage/archive
 * Admin-only legacy archive upload to the private ADMIN_ARCHIVE_ROOT.
 */
storageRouter.post(
  '/archive',
  requireAdmin,
  upload.single('file') as any,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file provided in request.' });
        return;
      }

      const originalName = req.file.originalname || 'archive.bin';
      const result = windowsStorageService.saveAdminArchive(req.file.buffer, originalName);

      res.status(201).json({
        success: true,
        message: 'File saved securely to Admin Archive storage root.',
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/storage/archive
 * Admin Only: List files in Admin Archive root (Never exposed via public static serving)
 */
storageRouter.get('/archive', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = windowsStorageService.getAdminArchiveFileList();
    res.json({
      success: true,
      count: files.length,
      files,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
