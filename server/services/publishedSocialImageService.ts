import sharp from 'sharp';
import { AdminContentDraftModel, AdminProjectDraftModel, FileMetadataModel, ProjectModel, SiteContentModel, SocialPreviewAssetModel } from '../models';
import { hasMediaUrlReference } from '../routes/files';
import { fileService } from './fileService';

const FORMAT_CONTENT_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  tiff: 'image/tiff',
  heif: 'image/heif',
};

const SOCIAL_PREVIEW_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const dimensionCache = new Map<string, { width: number; height: number; contentType: string }>();

export interface PublishedSocialImageInfo {
  url: string;
  width?: number;
  height?: number;
  contentType?: string;
  alt: string;
  fileId?: string;
}

export function getSocialPreviewPath(contentType: string | undefined): string | undefined {
  const extension = contentType ? SOCIAL_PREVIEW_EXTENSIONS[contentType] : undefined;
  return extension ? `/social-preview.${extension}` : undefined;
}

function getMediaId(value: string): string | undefined {
  try {
    const url = new URL(value, 'https://portfolio.local');
    if (!url.pathname.startsWith('/api/portfolio-media/')) return undefined;
    const id = url.searchParams.get('id');
    if (id && /^file-[A-Za-z0-9-]+$/.test(id)) return id;
    const lastSegment = decodeURIComponent(url.pathname.slice('/api/portfolio-media/'.length));
    return /^file-[A-Za-z0-9-]+$/.test(lastSegment) ? lastSegment : undefined;
  } catch {
    return undefined;
  }
}

export async function getPublishedSocialImageInfo(
  socialImageUrl: unknown,
  socialImageAlt: unknown,
  baseUrl: string,
): Promise<PublishedSocialImageInfo | null> {
  const alt = typeof socialImageAlt === 'string' && socialImageAlt.trim()
    ? socialImageAlt.trim().slice(0, 300)
    : 'Portfolio social sharing image';
  if (typeof socialImageUrl !== 'string' || !socialImageUrl.trim()) return null;

  const mediaId = getMediaId(socialImageUrl);
  if (!mediaId) {
    try {
      const url = new URL(socialImageUrl, baseUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        return { url: url.href, alt };
      }
    } catch {
      return null;
    }
    return null;
  }

  const mediaPath = new URL(`/api/portfolio-media/${encodeURIComponent(mediaId)}`, 'https://portfolio.local').pathname;
  if (!hasMediaUrlReference(socialImageUrl, mediaPath)) return null;
  const file = await FileMetadataModel.findOne({
    id: mediaId,
    path: { $regex: '^Portfolio/Media/' },
  }).lean();
  if (!file) return null;

  const asset = await SocialPreviewAssetModel.findOne({ 'variants.fileId': mediaId }).lean();
  const variant = asset?.variants.find((candidate) => candidate.fileId === mediaId);
  if (variant) {
    const previewPath = getSocialPreviewPath(variant.contentType);
    if (!previewPath) return null;
    return {
      url: new URL(previewPath, baseUrl).href,
      width: variant.width,
      height: variant.height,
      contentType: variant.contentType,
      alt,
      fileId: mediaId,
    };
  }

  const cacheKey = `${file.id}:${file.modified}`;
  let dimensions = dimensionCache.get(cacheKey);
  if (!dimensions) {
    const buffer = fileService.getStoredFileBuffer({
      diskPath: typeof file.diskPath === 'string' ? file.diskPath : undefined,
      content: typeof file.content === 'string' ? file.content : undefined,
      contentEncoding: file.contentEncoding === 'base64' ? 'base64' : undefined,
    });
    if (!buffer) return null;
    try {
      const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: 120_000_000 }).metadata();
      if (!metadata.width || !metadata.height || !metadata.format) return null;
      const orientation = metadata.orientation || 1;
      const rotateDimensions = orientation >= 5 && orientation <= 8;
      dimensions = {
        width: rotateDimensions ? metadata.height : metadata.width,
        height: rotateDimensions ? metadata.width : metadata.height,
        contentType: FORMAT_CONTENT_TYPES[metadata.format] || 'application/octet-stream',
      };
      dimensionCache.set(cacheKey, dimensions);
      if (dimensionCache.size > 500) dimensionCache.delete(dimensionCache.keys().next().value!);
    } catch (error) {
      console.error(`[SEO] Could not inspect published social image ${mediaId}.`, error);
      return null;
    }
  }

  return {
    url: getSocialPreviewPath(dimensions.contentType)
      ? new URL(getSocialPreviewPath(dimensions.contentType)!, baseUrl).href
      : new URL(socialImageUrl, baseUrl).href,
    width: dimensions.width,
    height: dimensions.height,
    contentType: dimensions.contentType,
    alt,
    fileId: mediaId,
  };
}

export function getPublishedSocialMediaId(socialImageUrl: unknown): string | undefined {
  return typeof socialImageUrl === 'string' ? getMediaId(socialImageUrl) : undefined;
}

export async function cleanupObsoleteSocialPreviewVariants(): Promise<string[]> {
  const [publishedContent, contentDraft, projects, projectDraft, assets] = await Promise.all([
    SiteContentModel.findOne({ key: 'primary_portfolio_content' }).lean(),
    AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean(),
    ProjectModel.find().lean(),
    AdminProjectDraftModel.findOne({ key: 'primary_portfolio_projects' }).lean(),
    SocialPreviewAssetModel.find().lean(),
  ]);
  const contentSettings = publishedContent?.siteSettings as Record<string, unknown> | undefined;
  const selectedVariantId = getMediaId(typeof contentSettings?.socialImageUrl === 'string' ? contentSettings.socialImageUrl : '');
  const warnings: string[] = [];

  for (const asset of assets) {
    if (asset.variants.some((variant) => variant.fileId === selectedVariantId)) continue;
    const remainingVariants = [];
    for (const variant of asset.variants) {
      const mediaPath = new URL(`/api/portfolio-media/${encodeURIComponent(variant.fileId)}`, 'https://portfolio.local').pathname;
      const usedElsewhere = [
        publishedContent,
        contentDraft?.content,
        projects,
        projectDraft?.projects,
      ].some((record) => hasMediaUrlReference(record, mediaPath));
      if (usedElsewhere) {
        remainingVariants.push(variant);
        continue;
      }
      try {
        if (!fileService.deleteFile(variant.fileId)) {
          throw new Error('Generated variant file was not found.');
        }
        await FileMetadataModel.deleteOne({ id: variant.fileId });
      } catch (error) {
        console.error(`[Social image] Could not remove obsolete generated variant ${variant.fileId}.`, error);
        warnings.push(`Generated social image variant ${variant.fileId} could not be removed.`);
        remainingVariants.push(variant);
      }
    }

    if (remainingVariants.length) {
      await SocialPreviewAssetModel.updateOne({ originalId: asset.originalId }, { $set: { variants: remainingVariants } });
    } else {
      await SocialPreviewAssetModel.deleteOne({ originalId: asset.originalId });
    }
  }
  return warnings;
}
