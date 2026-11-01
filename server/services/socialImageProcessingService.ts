import sharp, { type Metadata, type Sharp } from 'sharp';
import type { SocialPreviewVariant } from '../models/SocialPreviewAsset';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 120_000_000;
const MAX_VARIANT_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_DIMENSION = 30_000;

const SOURCE_FORMATS: Record<string, { extension: string; mimeTypes: string[] }> = {
  jpeg: { extension: 'jpg', mimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'] },
  png: { extension: 'png', mimeTypes: ['image/png'] },
  webp: { extension: 'webp', mimeTypes: ['image/webp'] },
  gif: { extension: 'gif', mimeTypes: ['image/gif'] },
  tiff: { extension: 'tiff', mimeTypes: ['image/tiff'] },
  heif: { extension: 'heif', mimeTypes: ['image/heif', 'image/heic', 'image/avif'] },
  avif: { extension: 'avif', mimeTypes: ['image/avif'] },
};

const PLATFORMS = [
  { key: 'open-graph-jpeg', label: 'Open Graph · WhatsApp, Facebook, LinkedIn', width: 1200, height: 630, format: 'jpeg' as const },
  { key: 'x-large-jpeg', label: 'X · Large image card', width: 1200, height: 675, format: 'jpeg' as const },
  { key: 'square-jpeg', label: 'Square card · platform fallback', width: 1200, height: 1200, format: 'jpeg' as const },
  { key: 'open-graph-webp', label: 'Open Graph · WebP', width: 1200, height: 630, format: 'webp' as const },
  { key: 'open-graph-png', label: 'Open Graph · PNG with transparency', width: 1200, height: 630, format: 'png' as const },
];

export interface ProcessedSocialImage {
  source: {
    format: string;
    contentType: string;
    width: number;
    height: number;
    displayWidth: number;
    displayHeight: number;
    sizeBytes: number;
    orientation: number;
    animated: boolean;
  };
  variants: Array<SocialPreviewVariant & { buffer: Buffer }>;
}

function getDisplayDimensions(width: number, height: number, orientation: number): { width: number; height: number } {
  return orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

async function createAdaptiveJpeg(
  pipeline: Sharp,
  initialQuality: number,
): Promise<Buffer> {
  let quality = initialQuality;
  let buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
  while (buffer.length > MAX_VARIANT_BYTES && quality > 70) {
    quality -= 5;
    buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
  }
  return buffer;
}

export async function processSocialImage(
  buffer: Buffer,
  declaredMimeType: string,
): Promise<ProcessedSocialImage> {
  if (!buffer.length) throw new Error('The selected image is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('Social preview images must be 10 MB or smaller.');

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new Error('The selected image is corrupted or cannot be decoded safely.');
  }

  const sourceFormat = metadata.format ? SOURCE_FORMATS[metadata.format] : undefined;
  if (!sourceFormat || !metadata.width || !metadata.height) {
    throw new Error('Unsupported image format. Use a valid JPEG, PNG, WebP, GIF, TIFF, HEIF, or AVIF image.');
  }
  const normalizedMime = declaredMimeType.toLowerCase().split(';')[0].trim();
  const isHeifFamily = metadata.format === 'heif';
  if (!sourceFormat.mimeTypes.includes(normalizedMime) &&
    !(isHeifFamily && ['image/heif', 'image/heic', 'image/avif'].includes(normalizedMime))) {
    throw new Error(`Image content is ${metadata.format}, but the uploaded MIME type is ${normalizedMime || 'missing'}.`);
  }
  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw new Error('The image resolution exceeds the safe processing limit of 120 megapixels.');
  }
  if (metadata.width > MAX_SOURCE_DIMENSION || metadata.height > MAX_SOURCE_DIMENSION) {
    throw new Error('The image width and height must each be 30,000 pixels or smaller.');
  }

  const orientation = metadata.orientation || 1;
  const displayDimensions = getDisplayDimensions(metadata.width, metadata.height, orientation);
  const decoded = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, page: 0 }).rotate();
  const initialQuality = Math.max(74, Math.min(93, Math.round(93 - Math.log2(Math.max(1, buffer.length / 300_000)) * 2)));
  const variants: ProcessedSocialImage['variants'] = [];

  for (const target of PLATFORMS) {
    const background = target.format === 'png'
      ? undefined
      : await decoded
        .clone()
        .resize(target.width, target.height, { fit: 'cover', position: sharp.strategy.attention })
        .blur(36)
        .flatten({ background: '#e8edf3' })
        .toFormat('png')
        .toBuffer();
    const foreground = await decoded
      .clone()
      .resize(target.width, target.height, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const foregroundMetadata = await sharp(foreground).metadata();
    const x = Math.floor((target.width - (foregroundMetadata.width || target.width)) / 2);
    const y = Math.floor((target.height - (foregroundMetadata.height || target.height)) / 2);
    const canvas = sharp({
      create: {
        width: target.width,
        height: target.height,
        channels: 4,
        background: target.format === 'png' || target.format === 'webp'
          ? { r: 0, g: 0, b: 0, alpha: 0 }
          : { r: 232, g: 237, b: 243, alpha: 1 },
      },
    });
    const layers = background
      ? [{ input: background, left: 0, top: 0 }, { input: foreground, left: x, top: y }]
      : [{ input: foreground, left: x, top: y }];
    const composite = canvas.composite(layers);

    let outputBuffer: Buffer;
    if (target.format === 'jpeg') {
      outputBuffer = await createAdaptiveJpeg(composite, initialQuality);
    } else if (target.format === 'webp') {
      outputBuffer = await composite.webp({ quality: initialQuality, effort: 5, alphaQuality: 100 }).toBuffer();
    } else {
      outputBuffer = await composite.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    }

    variants.push({
      key: target.key,
      label: target.label,
      fileId: '',
      width: target.width,
      height: target.height,
      format: target.format,
      contentType: `image/${target.format === 'jpeg' ? 'jpeg' : target.format}`,
      sizeBytes: outputBuffer.length,
      buffer: outputBuffer,
    });
  }

  return {
    source: {
      format: metadata.format,
      contentType: normalizedMime,
      width: metadata.width,
      height: metadata.height,
      displayWidth: displayDimensions.width,
      displayHeight: displayDimensions.height,
      sizeBytes: buffer.length,
      orientation,
      animated: (metadata.pages || 1) > 1,
    },
    variants,
  };
}

export function getSocialImageUploadLimits() {
  return { maxBytes: MAX_UPLOAD_BYTES, maxPixels: MAX_INPUT_PIXELS };
}

export function getSourceExtension(format: string, contentType?: string): string {
  const definition = SOURCE_FORMATS[format];
  if (!definition) throw new Error('Unsupported source image format.');
  if (format === 'heif' || format === 'avif') {
    if (contentType === 'image/avif') return 'avif';
    if (contentType === 'image/heic') return 'heic';
    return 'heif';
  }
  return definition.extension;
}
