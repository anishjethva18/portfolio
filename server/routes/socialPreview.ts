import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAdmin, validateCsrf, AuthenticatedRequest } from '../middleware/auth';
import { FileMetadataModel, SocialPreviewAssetModel } from '../models';
import { fileService } from '../services/fileService';
import { getSourceExtension, getSocialImageUploadLimits, inspectSocialImage } from '../services/socialImageProcessingService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getSocialImageUploadLimits().maxBytes },
});

export const socialPreviewRouter = Router();
socialPreviewRouter.use(requireAdmin, validateCsrf);

const parseImageUpload = (req: AuthenticatedRequest, res: Response, next: (error?: unknown) => void) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({ success: false, error: error.code === 'LIMIT_FILE_SIZE' ? 'Social preview images must be 10 MB or smaller.' : error.message });
      return;
    }
    next(error);
  });
};

function mediaUrl(fileId: string): string {
  return `/api/portfolio-media/${encodeURIComponent(fileId)}`;
}

async function savePortfolioImage(
  buffer: Buffer,
  name: string,
  userId: string,
) {
  const saved = fileService.saveUploadedBuffer(
    buffer,
    name,
    `Portfolio/Media/${name}`,
    'Portfolio/Media',
    userId,
  );
  try {
    await FileMetadataModel.updateOne({ id: saved.id }, { $set: saved }, { upsert: true });
  } catch (error) {
    try {
      fileService.deleteFile(saved.id);
    } catch (cleanupError) {
      console.error(`[Social image] Failed to clean up incomplete file ${saved.id}.`, cleanupError);
    }
    throw error;
  }
  return saved;
}

socialPreviewRouter.post('/upload', parseImageUpload, async (req: AuthenticatedRequest, res: Response) => {
  const image = req.file;
  if (!image) {
    res.status(400).json({ success: false, error: 'Choose a JPEG, PNG, or WebP image to upload.' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Administrator authentication is required.' });
    return;
  }

  let savedFileId: string | undefined;
  try {
    const inspected = await inspectSocialImage(image.buffer, image.mimetype);
    const sourceExtension = getSourceExtension(inspected.source.format);
    const safeOriginalName = fileService.sanitizeFileName(image.originalname);
    const originalName = path.parse(safeOriginalName);
    const originalExtension = originalName.ext.slice(1);
    const normalizedOriginalExtension = originalExtension.toLowerCase();
    const preserveOriginalExtension = normalizedOriginalExtension === sourceExtension ||
      (inspected.source.format === 'jpeg' && normalizedOriginalExtension === 'jpeg');
    const sourceName = `${originalName.name || 'social-image'}.${preserveOriginalExtension ? originalExtension : sourceExtension}`;
    const sourceFile = await savePortfolioImage(
      image.buffer,
      sourceName,
      req.user.userId,
    );
    savedFileId = sourceFile.id;

    const asset = await SocialPreviewAssetModel.findOneAndUpdate(
      { originalId: sourceFile.id },
      {
        $set: {
          originalName: sourceFile.name,
          originalFormat: inspected.source.format,
          originalContentType: inspected.source.contentType,
          originalWidth: inspected.source.width,
          originalHeight: inspected.source.height,
          displayWidth: inspected.source.displayWidth,
          displayHeight: inspected.source.displayHeight,
          originalSizeBytes: inspected.source.sizeBytes,
          orientation: inspected.source.orientation,
          animated: inspected.source.animated,
          variants: [],
          uploadedBy: req.user.userId,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    res.status(201).json({
      success: true,
      original: {
        id: sourceFile.id,
        name: sourceFile.name,
        url: mediaUrl(sourceFile.id),
        contentType: inspected.source.contentType,
        width: inspected.source.displayWidth,
        height: inspected.source.displayHeight,
        encodedWidth: inspected.source.width,
        encodedHeight: inspected.source.height,
        sizeBytes: inspected.source.sizeBytes,
        format: inspected.source.format,
        orientation: inspected.source.orientation,
        animated: inspected.source.animated,
      },
      assetId: asset?.originalId,
    });
  } catch (error) {
    if (savedFileId) {
      try {
        fileService.deleteFile(savedFileId);
        await FileMetadataModel.deleteOne({ id: savedFileId });
      } catch (cleanupError) {
        console.error(`[Social image] Failed to clean up incomplete upload ${savedFileId}.`, cleanupError);
      }
    }
    const message = error instanceof Error ? error.message : 'Social image upload failed.';
    const status = message.includes('10 MB or smaller') ? 413 : 422;
    res.status(status).json({ success: false, error: message });
  }
});

socialPreviewRouter.get('/asset/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const asset = await SocialPreviewAssetModel.findOne({
      $or: [{ originalId: req.params.id }, { 'variants.fileId': req.params.id }],
    }).lean();
    if (!asset) {
      res.status(404).json({ success: false, error: 'Social image metadata was not found.' });
      return;
    }
    const selectedVariant = asset.variants.find((variant) => variant.fileId === req.params.id);
    const selectedId = selectedVariant?.fileId || asset.originalId;
    const selectedFile = await FileMetadataModel.findOne({ id: selectedId }).select('id name').lean();
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      original: {
        id: selectedId,
        name: selectedVariant?.fileId === selectedId ? selectedFile?.name || asset.originalName : asset.originalName,
        url: mediaUrl(selectedId),
        contentType: selectedVariant?.contentType || asset.originalContentType,
        format: selectedVariant?.format || asset.originalFormat,
        width: selectedVariant?.width || asset.displayWidth,
        height: selectedVariant?.height || asset.displayHeight,
        encodedWidth: selectedVariant ? selectedVariant.width : asset.originalWidth,
        encodedHeight: selectedVariant ? selectedVariant.height : asset.originalHeight,
        sizeBytes: selectedVariant?.sizeBytes || asset.originalSizeBytes,
        orientation: selectedVariant ? 1 : asset.orientation,
        animated: selectedVariant ? false : asset.animated,
        storageName: selectedFile?.name,
      },
    });
  } catch (error) {
    console.error('[Social image] Could not load image metadata.', error);
    res.status(503).json({ success: false, error: 'Social image metadata is temporarily unavailable.' });
  }
});
