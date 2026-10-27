import { Router, Response, NextFunction } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileService, BLOCKED_EXTENSIONS, canAccessStoredFile, isFileStorageCategory } from '../services/fileService';
import { requireAdmin, requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/database';
import {
  AdminContentDraftModel,
  AdminProjectDraftModel,
  FileMetadataModel,
  ProjectModel,
  SiteContentModel,
} from '../models';

export const filesRouter = Router();

function toClientFile(file: any) {
  const { diskPath, contentEncoding, ...safeFile } = file;
  if (
    contentEncoding === 'base64' ||
    (typeof file.path === 'string' && file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/'))
  ) delete safeFile.content;
  return {
    ...safeFile,
    storagePath: fileService.getStorageDisplayPath(file),
  };
}

function isMediaUrlReference(candidate: unknown, mediaPath: string): boolean {
  if (typeof candidate !== 'string' || !candidate) return false;
  try {
    const candidateUrl = new URL(candidate, 'http://portfolio.local');
    if (candidateUrl.pathname === mediaPath) return true;
    const targetId = mediaPath.match(/^\/api\/portfolio-media\/(file-[A-Za-z0-9-]+)$/)?.[1];
    return Boolean(targetId && candidateUrl.pathname.startsWith('/api/portfolio-media/') && candidateUrl.searchParams.get('id') === targetId);
  } catch {
    return false;
  }
}

export function hasMediaUrlReference(value: unknown, mediaPath: string): boolean {
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (isMediaUrlReference(current, mediaPath)) return true;
    if (Array.isArray(current)) {
      for (const item of current) pending.push(item);
    } else if (current && typeof current === 'object') {
      for (const item of Object.values(current)) pending.push(item);
    }
  }
  return false;
}

export function hasVisibleResumeMediaReference(resumes: unknown, mediaPath: string): boolean {
  if (!Array.isArray(resumes)) return false;
  return hasMediaUrlReference(
    resumes.filter((resume) =>
      resume && typeof resume === 'object' &&
      (resume as Record<string, unknown>).visible !== false
    ),
    mediaPath
  );
}

export function removeMediaUrlReferences(value: unknown, mediaPath: string): unknown {
  if (isMediaUrlReference(value, mediaPath)) return '';
  const isAtomicValue = (candidate: unknown): boolean => Boolean(
    candidate &&
    typeof candidate === 'object' &&
    (candidate instanceof Date ||
      Buffer.isBuffer(candidate) ||
      typeof (candidate as { toHexString?: unknown }).toHexString === 'function'),
  );
  if (!value || typeof value !== 'object' || isAtomicValue(value)) return value;

  const root: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : {};
  const pending: Array<{ source: unknown[] | Record<string, unknown>; target: unknown[] | Record<string, unknown> }> = [
    { source: value as unknown[] | Record<string, unknown>, target: root },
  ];

  while (pending.length) {
    const { source, target } = pending.pop()!;
    const entries = Array.isArray(source)
      ? source.map((item, index) => [String(index), item] as [string, unknown])
      : Object.entries(source).filter(([key]) => key !== '_id' && key !== '__v');

    for (const [key, child] of entries) {
      if (Array.isArray(target)) {
        if (isMediaUrlReference(child, mediaPath)) continue;
        const nextValue = !child || typeof child !== 'object' || isAtomicValue(child) ? child : Array.isArray(child) ? [] : {};
        target.push(nextValue);
        if (child && typeof child === 'object' && !isAtomicValue(child)) {
          pending.push({
            source: child as unknown[] | Record<string, unknown>,
            target: nextValue as unknown[] | Record<string, unknown>,
          });
        }
      } else if (isMediaUrlReference(child, mediaPath)) {
        target[key] = '';
      } else {
        const nextValue = !child || typeof child !== 'object' || isAtomicValue(child) ? child : Array.isArray(child) ? [] : {};
        target[key] = nextValue;
        if (child && typeof child === 'object' && !isAtomicValue(child)) {
          pending.push({
            source: child as unknown[] | Record<string, unknown>,
            target: nextValue as unknown[] | Record<string, unknown>,
          });
        }
      }
    }
  }

  return root;
}

// Configure multer memory storage with 50MB limit and extension filter
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.includes('.')
      ? file.originalname.substring(file.originalname.lastIndexOf('.') + 1).toLowerCase()
      : '';
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Blocked file extension .${ext} is not permitted.`));
    }
    cb(null, true);
  },
});

// Middleware to gracefully format Multer upload errors
const handleUploadError = (err: any, req: any, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: 'File size exceeds 50MB limit.',
        code: 'PAYLOAD_TOO_LARGE',
      });
      return;
    }
    res.status(400).json({ success: false, error: err.message, code: err.code });
    return;
  }
  if (err) {
    res.status(400).json({ success: false, error: err.message || 'File upload rejected.' });
    return;
  }
  next();
};

/**
 * POST /api/files/upload
 * Secure upload with size verification, path traversal prevention & ownership
 */
filesRouter.post(
  '/upload',
  requireAuth,
  (req: any, res: any, next: any) => {
    (upload.single('file') as any)(req, res, (err: any) => handleUploadError(err, req, res, next));
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // 1. Multipart Form-Data upload via req.file
      if (req.file) {
        const originalName = req.file.originalname || 'uploaded_file';
        const targetFolder = (req.body.targetFolder || req.body.parentId || 'D:/Documents').replace(/\.\./g, '');
        const cleanPath = (req.body.path || `${targetFolder}/${originalName}`).replace(/\.\./g, '').replace(/\/\//g, '/');
        const storageCategory = req.body.storageCategory;
        const normalizedParentId = String(req.body.parentId || req.body.targetFolder || 'D:/Documents')
          .replace(/\\/g, '/')
          .replace(/\.\./g, '')
          .replace(/\/+/g, '/')
          .replace(/\/$/, '');
        if (normalizedParentId === 'Portfolio/Media' && req.file.size > 10 * 1024 * 1024) {
          res.status(413).json({ success: false, error: 'Portfolio media must be 10 MB or smaller.' });
          return;
        }
        if (storageCategory !== undefined && !isFileStorageCategory(storageCategory)) {
          res.status(400).json({ success: false, error: 'A supported private storage category is required.' });
          return;
        }

        const saved = fileService.saveUploadedBuffer(
          req.file.buffer,
          originalName,
          cleanPath,
          targetFolder,
          req.user.userId,
          storageCategory
        );
        // Wait for the VFS record to persist before reporting a successful upload.
        await FileMetadataModel.updateOne({ id: saved.id }, { $set: saved }, { upsert: true });

        res.status(201).json({
          success: true,
          message: 'File uploaded and stored securely',
          file: toClientFile(saved),
        });
        return;
      }

      // 2. JSON Body upload (content can be base64 or text)
      const { name, path: filePath, content, extension, size, type, parentId } = req.body;
      if (!name || !filePath) {
        res.status(400).json({ success: false, error: 'Missing name or path in upload payload.' });
        return;
      }

      const cleanPath = String(filePath).replace(/\.\./g, '').replace(/\/\//g, '/');
      const cleanParentId = parentId ? String(parentId).replace(/\.\./g, '') : cleanPath.substring(0, cleanPath.lastIndexOf('/'));

      const saved = fileService.saveFile(
        {
          name: String(name),
          path: cleanPath,
          parentId: cleanParentId || 'D:/Documents',
          content,
          extension,
          size,
          type: type || 'file',
        },
        req.user.userId
      );
      await FileMetadataModel.updateOne({ id: saved.id }, { $set: saved }, { upsert: true });

      res.status(201).json({
        success: true,
        message: 'File saved and stored securely',
        file: toClientFile(saved),
      });
    } catch (err: any) {
      console.error('[FilesRouter] Upload error:', err.message);
      const status = err.message?.includes('10 MB or smaller') ? 413 : 400;
      res.status(status).json({ success: false, error: err.message || 'File upload failed' });
    }
  }
);

filesRouter.post(
  '/portfolio-media',
  requireAdmin,
  (req: any, res: any, next: any) => {
    (upload.single('file') as any)(req, res, (err: any) => handleUploadError(err, req, res, next));
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const uploadedFile = req.file as Express.Multer.File | undefined;
    if (!uploadedFile) {
      res.status(400).json({ success: false, error: 'Select a portfolio image or PDF to upload.' });
      return;
    }

    const extension = path.extname(uploadedFile.originalname).slice(1).toLowerCase();
    const allowedTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      ico: 'image/x-icon',
      bmp: 'image/bmp',
      pdf: 'application/pdf',
    };
    const signatures: Record<string, (buffer: Buffer) => boolean> = {
      png: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      jpg: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
      jpeg: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
      gif: (buffer) => buffer.subarray(0, 3).toString('ascii') === 'GIF',
      webp: (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
      ico: (buffer) => buffer.length >= 6 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0,
      bmp: (buffer) => buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d,
      pdf: (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
    };
    if (uploadedFile.size > 10 * 1024 * 1024) {
      res.status(413).json({ success: false, error: 'Portfolio media must be 10 MB or smaller.' });
      return;
    }
    const acceptedMimeTypes = extension === 'ico'
      ? new Set(['image/x-icon', 'image/vnd.microsoft.icon'])
      : new Set(allowedTypes[extension] ? [allowedTypes[extension]] : []);
    if (!acceptedMimeTypes.has(uploadedFile.mimetype) || !signatures[extension]?.(uploadedFile.buffer)) {
      res.status(415).json({ success: false, error: 'Only PNG, JPEG, WebP, GIF, ICO, BMP, or PDF files are supported.' });
      return;
    }
    const storageCategory = req.body.storageCategory;
    if (storageCategory !== undefined && !isFileStorageCategory(storageCategory)) {
      res.status(400).json({ success: false, error: 'A supported private storage category is required.' });
      return;
    }

    try {
      const saved = fileService.saveUploadedBuffer(
        uploadedFile.buffer,
        uploadedFile.originalname,
        `Portfolio/Media/${uploadedFile.originalname}`,
        'Portfolio/Media',
        req.user!.userId,
        storageCategory
      );
      await FileMetadataModel.updateOne({ id: saved.id }, { $set: saved }, { upsert: true });
      res.status(201).json({
        success: true,
        file: {
          id: saved.id,
          name: saved.name,
          url: saved.url,
        },
      });
    } catch (err: any) {
      const status = err.message?.includes('10 MB or smaller') ? 413 : 500;
      res.status(status).json({
        success: false,
        error: status === 413 ? err.message : 'Portfolio media could not be saved.',
      });
    }
  }
);

/**
 * GET /api/files/list
 * List files with pagination, filtering, sorting, and user ownership restrictions
 */
filesRouter.get('/list', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const {
    parentId,
    type,
    extension,
    search,
    sortBy,
    order,
    page = '1',
    limit = '100',
  } = req.query;

  const result = db.getFilesFiltered({
    userId: req.user.userId,
    isAdmin: req.user.role === 'admin',
    parentId: parentId ? String(parentId) : undefined,
    type: type === 'folder' || type === 'file' ? (type as any) : undefined,
    extension: extension ? String(extension) : undefined,
    search: search ? String(search) : undefined,
    sortBy: sortBy ? String(sortBy) : 'uploadedAt',
    order: order === 'asc' ? 'asc' : 'desc',
    page: parseInt(page as string, 10) || 1,
    limit: parseInt(limit as string, 10) || 100,
  });

  res.json({
    success: true,
    count: result.items.length,
    total: result.total,
    files: result.items.map(toClientFile),
    pagination: {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      total: result.total,
    },
  });
});

/**
 * GET /api/files/download/:id
 * Stream protected file download with path traversal checks and ownership enforcement
 */
filesRouter.get('/download/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).send('Authentication required');
    return;
  }

  const { id } = req.params;
  const file = fileService.getFileById(id);
  if (!file) {
    res.status(404).send('File not found');
    return;
  }

  // Validate ownership: creator or admin
  if (!canAccessStoredFile(file, req.user)) {
    res.status(403).send('Forbidden: You do not have permission to download this file');
    return;
  }

  const resolvedPath = file.diskPath ? fileService.resolveSafeDiskPath(file.diskPath) : null;
  if (resolvedPath && fs.existsSync(resolvedPath)) {
    return res.download(resolvedPath, file.name);
  }

  const buffer = fileService.getStoredFileBuffer(file);
  if (!buffer) {
    if (file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/')) {
      res.status(503).json({ success: false, error: 'File content is unavailable; configure persistent storage or restore the uploaded file.' });
      return;
    }
    if (file.diskPath && !resolvedPath) {
      res.status(403).send('Access denied: Invalid file path');
      return;
    }
    res.status(404).send('File content is unavailable');
    return;
  }

  const safeName = fileService.sanitizeFileName(file.name);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(buffer);
});

filesRouter.get('/preview/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const file = fileService.getFileById(req.params.id);
  if (!file) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }
  if (!canAccessStoredFile(file, req.user)) {
    res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to preview this file' });
    return;
  }

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  const contentType = mimeTypes[(file.extension || '').toLowerCase()];
  const safePath = file.diskPath ? fileService.resolveSafeDiskPath(file.diskPath) : null;
  if (!contentType) {
    res.status(404).json({ success: false, error: 'Preview is unavailable for this file.' });
    return;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${fileService.sanitizeFileName(file.name)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (safePath && fs.existsSync(safePath)) {
    res.sendFile(safePath, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ success: false, error: 'File preview could not be read.' });
      }
    });
    return;
  }
  const buffer = fileService.getStoredFileBuffer(file);
  if (!buffer) {
    const isPortfolioMedia = file.path.replace(/\\/g, '/').startsWith('Portfolio/Media/');
    res.status(isPortfolioMedia ? 503 : 404).json({
      success: false,
      error: isPortfolioMedia
        ? 'File content is unavailable; configure persistent storage or restore the uploaded file.'
        : 'File preview could not be read.',
    });
    return;
  }
  res.send(buffer);
});

/**
 * GET /api/files/:id
 * Retrieve single file metadata by ID with ownership enforcement
 */
filesRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const file = fileService.getFileById(id);

  if (!file) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  if (!canAccessStoredFile(file, req.user)) {
    res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to view this file' });
    return;
  }

  res.json({ success: true, file: toClientFile(file) });
});

/**
 * PUT /api/files/:id
 * Update file metadata (rename, move, or edit text content) with ownership enforcement
 */
filesRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const file = fileService.getFileById(id);

  if (!file) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  if (!canAccessStoredFile(file, req.user)) {
    res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to edit this file' });
    return;
  }

  const { name, content, path: newPath, parentId } = req.body;
  const updates: Partial<typeof file> = {
    modified: new Date().toISOString(),
  };

  if (name && typeof name === 'string') {
    updates.name = fileService.sanitizeFileName(name);
  }
  if (newPath && typeof newPath === 'string') {
    updates.path = newPath.replace(/\.\./g, '').replace(/\/\//g, '/');
  }
  if (parentId && typeof parentId === 'string') {
    updates.parentId = parentId.replace(/\.\./g, '');
  }
  if (content !== undefined) {
    updates.content = String(content);
    updates.sizeBytes = Buffer.byteLength(String(content), 'utf-8');
    updates.size = fileService.formatFileSize(updates.sizeBytes);

    // If diskPath exists, update the disk file content
    if (file.diskPath) {
      try {
        fileService.writeExistingFile(file.diskPath, String(content));
      } catch {
        res.status(403).json({ success: false, error: 'Access denied: Invalid file path' });
        return;
      }
    }
  }

  const updated = db.updateFileMetadata(id, updates);
  res.json({ success: true, file: updated ? toClientFile(updated) : null });
});

/**
 * DELETE /api/files/:id
 * Remove file from database and safely unlink from physical disk
 */
filesRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const file = fileService.getFileById(id);

  if (!file) {
    res.status(404).json({ success: false, error: 'File not found on server' });
    return;
  }

  if (!canAccessStoredFile(file, req.user)) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have permission to delete this file',
      code: 'FORBIDDEN_OWNERSHIP',
    });
    return;
  }

  if (file.path.startsWith('Portfolio/Media/')) {
    try {
      const [publishedContent, contentDraft, publishedProjects, projectDraft] = await Promise.all([
        SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean(),
        AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean(),
        ProjectModel.find().lean(),
        AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean(),
      ]);
      const mediaUrl = `/api/portfolio-media/${encodeURIComponent(id)}`;
      const mediaPath = new URL(mediaUrl, 'http://portfolio.local').pathname;
      const updates: Promise<unknown>[] = [];
      let unlinkedRecords = 0;

      if (publishedContent) {
        if (hasMediaUrlReference(publishedContent, mediaPath)) {
          const cleaned = removeMediaUrlReferences(publishedContent, mediaPath);
          const contentUpdate = { ...(cleaned as Record<string, unknown>) };
          delete contentUpdate._id;
          delete contentUpdate.key;
          updates.push(SiteContentModel.updateOne({ key: 'primary_portfolio_content' }, { $set: contentUpdate }));
          unlinkedRecords += 1;
        }
      }
      if (contentDraft?.content) {
        if (hasMediaUrlReference(contentDraft.content, mediaPath)) {
          const cleaned = removeMediaUrlReferences(contentDraft.content, mediaPath);
          updates.push(AdminContentDraftModel.updateOne(
            { key: 'primary_portfolio_content' },
            { $set: { content: cleaned, updatedBy: req.user!.userId } },
          ));
          unlinkedRecords += 1;
        }
      }
      for (const project of publishedProjects) {
        if (hasMediaUrlReference(project, mediaPath)) {
          const cleaned = removeMediaUrlReferences(project, mediaPath);
          const projectUpdate = { ...(cleaned as Record<string, unknown>) };
          delete projectUpdate._id;
          updates.push(ProjectModel.updateOne({ id: project.id }, { $set: projectUpdate }));
          unlinkedRecords += 1;
        }
      }
      if (projectDraft?.projects) {
        if (hasMediaUrlReference(projectDraft.projects, mediaPath)) {
          const cleaned = removeMediaUrlReferences(projectDraft.projects, mediaPath);
          updates.push(AdminProjectDraftModel.updateOne(
            { key: 'primary_portfolio_projects' },
            { $set: { projects: cleaned, updatedBy: req.user!.userId } },
          ));
          unlinkedRecords += 1;
        }
      }
      await Promise.all(updates);
      const [remainingPublishedContent, remainingDraftContent, remainingProjects, remainingProjectDraft] = await Promise.all([
        SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean(),
        AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean(),
        ProjectModel.find().lean(),
        AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean(),
      ]);
      const stillReferenced = [
        remainingPublishedContent,
        remainingDraftContent?.content,
        remainingProjects,
        remainingProjectDraft?.projects,
      ].some((record) => hasMediaUrlReference(record, mediaPath));
      if (stillReferenced) {
        res.status(409).json({
          success: false,
          error: 'Some saved portfolio references could not be removed, so the media file was kept. Refresh and try again.',
        });
        return;
      }
      res.locals.unlinkedMediaRecords = unlinkedRecords;
    } catch (err) {
      console.error('[Media deletion] Could not unlink portfolio media references:', err);
      res.status(503).json({ success: false, error: 'Media references could not be safely removed. The file was not deleted.' });
      return;
    }
  }

  const deleted = fileService.deleteFile(id);
  if (!deleted) {
    res.status(500).json({ success: false, error: 'Failed to delete file' });
    return;
  }

  res.json({
    success: true,
    message: `File ${id} deleted successfully`,
    unlinkedRecords: res.locals.unlinkedMediaRecords || 0,
  });
});

/**
 * POST /api/files/sync
 * Bulk synchronize files from frontend VFS with ownership enforcement
 */
filesRouter.post('/sync', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { files } = req.body;
    if (!Array.isArray(files)) {
      res.status(400).json({ success: false, error: 'Invalid files array' });
      return;
    }

    const count = fileService.syncBulk(files, req.user.userId);
    res.json({ success: true, count, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Sync failed' });
  }
});
