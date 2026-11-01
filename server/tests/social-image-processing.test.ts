import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { getSocialPreviewPath } from '../services/publishedSocialImageService';
import { processSocialImage } from '../services/socialImageProcessingService';

async function createImage(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp',
  options: { alpha?: boolean; orientation?: number } = {},
): Promise<Buffer> {
  const image = sharp({
    create: {
      width,
      height,
      channels: options.alpha ? 4 : 3,
      background: options.alpha
        ? { r: 40, g: 120, b: 220, alpha: 0.5 }
        : { r: 40, g: 120, b: 220 },
    },
  });
  if (format === 'jpeg') {
    return image.jpeg().withMetadata(options.orientation ? { orientation: options.orientation } : {}).toBuffer();
  }
  if (format === 'png') return image.png().toBuffer();
  return image.webp().toBuffer();
}

test('generates dimensioned platform variants for flexible JPEG, PNG, and WebP inputs', async () => {
  const inputs = [
    { width: 240, height: 140, format: 'jpeg' as const, mime: 'image/jpeg' },
    { width: 4200, height: 2800, format: 'png' as const, mime: 'image/png' },
    { width: 500, height: 500, format: 'webp' as const, mime: 'image/webp' },
    { width: 600, height: 1100, format: 'png' as const, mime: 'image/png' },
  ];

  for (const input of inputs) {
    const source = await createImage(input.width, input.height, input.format);
    const processed = await processSocialImage(source, input.mime);
    assert.equal(processed.source.width, input.width);
    assert.equal(processed.source.height, input.height);
    assert.equal(processed.source.format, input.format);
    assert.equal(processed.variants.length, 5);

    for (const variant of processed.variants) {
      const metadata = await sharp(variant.buffer).metadata();
      assert.equal(metadata.width, variant.width);
      assert.equal(metadata.height, variant.height);
      assert.equal(metadata.format, variant.format);
    }
  }
});

test('preserves transparency in the PNG sharing variant', async () => {
  const source = await createImage(320, 480, 'png', { alpha: true });
  const processed = await processSocialImage(source, 'image/png');
  const pngVariant = processed.variants.find((variant) => variant.key === 'open-graph-png');
  assert.ok(pngVariant);
  const metadata = await sharp(pngVariant.buffer).metadata();
  assert.equal(metadata.hasAlpha, true);
});

test('applies EXIF orientation to generated previews while retaining encoded source dimensions', async () => {
  const source = await createImage(160, 90, 'jpeg', { orientation: 6 });
  const processed = await processSocialImage(source, 'image/jpeg');
  assert.equal(processed.source.width, 160);
  assert.equal(processed.source.height, 90);
  assert.equal(processed.source.displayWidth, 90);
  assert.equal(processed.source.displayHeight, 160);
  assert.equal(processed.source.orientation, 6);
});

test('rejects corrupted input and MIME mismatches with clear errors', async () => {
  await assert.rejects(processSocialImage(Buffer.from('not an image'), 'image/jpeg'), /corrupted|cannot be decoded/i);
  const jpeg = await createImage(80, 60, 'jpeg');
  await assert.rejects(processSocialImage(jpeg, 'image/png'), /MIME type/i);
});

test('stable public preview paths map only to generated output formats', () => {
  assert.equal(getSocialPreviewPath('image/jpeg'), '/social-preview.jpg');
  assert.equal(getSocialPreviewPath('image/png'), '/social-preview.png');
  assert.equal(getSocialPreviewPath('image/webp'), '/social-preview.webp');
  assert.equal(getSocialPreviewPath('image/gif'), undefined);
  assert.equal(getSocialPreviewPath('image/tiff'), undefined);
  assert.equal(getSocialPreviewPath('image/avif'), undefined);
});
