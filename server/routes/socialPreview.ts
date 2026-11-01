import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAdmin, validateCsrf, AuthenticatedRequest } from '../middleware/auth';
import { FileMetadataModel, SocialPreviewAssetModel } from '../models';
import { fileService } from '../services/fileService';
import { getSourceExtension, getSocialImageUploadLimits, processSocialImage } from '../services/socialImageProcessingService';

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
  extension: string,
  contentType: string,
  userId: string,
) {
  const saved = fileService.saveFile({
    name,
    path: `Portfolio/Media/${name}`,
    parentId: 'Portfolio/Media',
    type: 'file',
    extension,
    content: `data:${contentType};base64,${buffer.toString('base64')}`,
    size: `${(buffer.length / 1024).toFixed(1)} KB`,
    sizeBytes: buffer.length,
  }, userId);
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
    res.status(400).json({ success: false, error: 'Choose a raster image to upload.' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Administrator authentication is required.' });
    return;
  }

  const savedFiles: string[] = [];
  try {
    const processed = await processSocialImage(image.buffer, image.mimetype);
    const sourceExtension = getSourceExtension(processed.source.format, processed.source.contentType);
    const sourceName = `${path.parse(image.originalname).name || 'social-image'}.${sourceExtension}`;
    const sourceFile = await savePortfolioImage(
      image.buffer,
      sourceName,
      sourceExtension,
      processed.source.contentType,
      req.user.userId,
    );
    savedFiles.push(sourceFile.id);

    const variants = [];
    for (const variant of processed.variants) {
      const extension = variant.format === 'jpeg' ? 'jpg' : variant.format;
      const variantName = `${path.parse(sourceFile.name).name}-${variant.key}.${extension}`;
      const variantFile = await savePortfolioImage(
        variant.buffer,
        variantName,
        extension,
        variant.contentType,
        req.user.userId,
      );
      savedFiles.push(variantFile.id);
      variants.push({
        key: variant.key,
        label: variant.label,
        fileId: variantFile.id,
        url: mediaUrl(variantFile.id),
        width: variant.width,
        height: variant.height,
        format: variant.format,
        contentType: variant.contentType,
        sizeBytes: variant.sizeBytes,
      });
    }

    const asset = await SocialPreviewAssetModel.findOneAndUpdate(
      { originalId: sourceFile.id },
      {
        $set: {
          originalName: image.originalname,
          originalFormat: processed.source.format,
          originalContentType: processed.source.contentType,
          originalWidth: processed.source.width,
          originalHeight: processed.source.height,
          displayWidth: processed.source.displayWidth,
          displayHeight: processed.source.displayHeight,
          originalSizeBytes: processed.source.sizeBytes,
          orientation: processed.source.orientation,
          animated: processed.source.animated,
          variants: variants.map(({ url: _url, ...metadata }) => metadata),
          uploadedBy: req.user.userId,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    res.status(201).json({
      success: true,
      original: {
        id: sourceFile.id,
        name: image.originalname,
        url: mediaUrl(sourceFile.id),
        contentType: processed.source.contentType,
        width: processed.source.displayWidth,
        height: processed.source.displayHeight,
        encodedWidth: processed.source.width,
        encodedHeight: processed.source.height,
        sizeBytes: processed.source.sizeBytes,
        format: processed.source.format,
        orientation: processed.source.orientation,
        animated: processed.source.animated,
      },
      variants,
      defaultVariant: variants.find((variant) => variant.key === 'open-graph-jpeg'),
      assetId: asset?.originalId,
    });
  } catch (error) {
    for (const id of savedFiles) {
      try {
        fileService.deleteFile(id);
        await FileMetadataModel.deleteOne({ id });
      } catch (cleanupError) {
        console.error(`[Social image] Failed to clean up incomplete upload ${id}.`, cleanupError);
      }
    }
    const message = error instanceof Error ? error.message : 'Social image processing failed.';
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
      res.status(404).json({ success: false, error: 'Generated social image variants were not found.' });
      return;
    }
    const original = await FileMetadataModel.findOne({ id: asset.originalId }).select('id name').lean();
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      original: {
        id: asset.originalId,
        name: asset.originalName,
        url: mediaUrl(asset.originalId),
        contentType: asset.originalContentType,
        format: asset.originalFormat,
        width: asset.displayWidth,
        height: asset.displayHeight,
        encodedWidth: asset.originalWidth,
        encodedHeight: asset.originalHeight,
        sizeBytes: asset.originalSizeBytes,
        orientation: asset.orientation,
        animated: asset.animated,
        storageName: original?.name,
      },
      variants: asset.variants.map((variant) => ({ ...variant, url: mediaUrl(variant.fileId) })),
      defaultVariant: asset.variants.find((variant) => variant.key === 'open-graph-jpeg')
        ? {
            ...asset.variants.find((variant) => variant.key === 'open-graph-jpeg'),
            url: mediaUrl(asset.variants.find((variant) => variant.key === 'open-graph-jpeg')!.fileId),
          }
        : null,
    });
  } catch (error) {
    console.error('[Social image] Could not load generated variants.', error);
    res.status(503).json({ success: false, error: 'Generated social image variants are unavailable.' });
  }
});
