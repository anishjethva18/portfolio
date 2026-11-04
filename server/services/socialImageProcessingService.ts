import sharp, { type Metadata } from 'sharp';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 120_000_000;
const MAX_SOURCE_DIMENSION = 30_000;

const SOURCE_FORMATS: Record<string, { extension: string; mimeTypes: string[] }> = {
  jpeg: { extension: 'jpg', mimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'] },
  png: { extension: 'png', mimeTypes: ['image/png'] },
  webp: { extension: 'webp', mimeTypes: ['image/webp'] },
};

export interface InspectedSocialImage {
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
}

function getDisplayDimensions(width: number, height: number, orientation: number): { width: number; height: number } {
  return orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

export async function inspectSocialImage(
  buffer: Buffer,
  declaredMimeType: string,
): Promise<InspectedSocialImage> {
  if (!buffer.length) throw new Error('The selected image is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('Social preview images must be 10 MB or smaller.');

  let metadata: Metadata;
  try {
    const image = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
    metadata = await image.metadata();
    await image.stats();
  } catch {
    throw new Error('The selected image is corrupted or cannot be decoded safely.');
  }

  const sourceFormat = metadata.format ? SOURCE_FORMATS[metadata.format] : undefined;
  if (!sourceFormat || !metadata.width || !metadata.height) {
    throw new Error('Unsupported image format. Use a valid JPEG, PNG, or WebP image.');
  }
  const normalizedMime = declaredMimeType.toLowerCase().split(';')[0].trim();
  if (!sourceFormat.mimeTypes.includes(normalizedMime)) {
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
  const contentType = metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format}`;

  return {
    source: {
      format: metadata.format,
      contentType,
      width: metadata.width,
      height: metadata.height,
      displayWidth: displayDimensions.width,
      displayHeight: displayDimensions.height,
      sizeBytes: buffer.length,
      orientation,
      animated: (metadata.pages || 1) > 1,
    },
  };
}

export function getSocialImageUploadLimits() {
  return { maxBytes: MAX_UPLOAD_BYTES, maxPixels: MAX_INPUT_PIXELS };
}

export function getSourceExtension(format: string): string {
  const definition = SOURCE_FORMATS[format];
  if (!definition) throw new Error('Unsupported source image format.');
  return definition.extension;
}
