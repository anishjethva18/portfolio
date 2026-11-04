import assert from 'node:assert/strict';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { db } from '../db/database';
import { FileMetadataModel, SiteContentModel, SocialPreviewAssetModel, UserModel } from '../models';
import { socialPreviewRouter } from '../routes/socialPreview';
import { portfolioMediaRouter } from '../routes/portfolioMedia';
import { buildSeoMetadata, renderSeoMetadataHtml } from '../../client/src/utils/seoMetadata';
import { fileService } from '../services/fileService';
import { cleanupObsoleteSocialPreviewVariants, getPublishedSocialImageInfo, getSocialPreviewPath } from '../services/publishedSocialImageService';
import { loadPublishedSeoMetadata } from '../services/seoMetadataService';
import { sessionService } from '../services/sessionService';
import { getSourceExtension, inspectSocialImage } from '../services/socialImageProcessingService';

async function createImage(format: 'jpeg' | 'png' | 'webp'): Promise<Buffer> {
  const image = sharp({
    create: {
      width: 321,
      height: 517,
      channels: 4,
      background: { r: 40, g: 120, b: 220, alpha: 0.5 },
    },
  });
  if (format === 'jpeg') return image.jpeg().toBuffer();
  if (format === 'png') return image.png().toBuffer();
  return image.webp().toBuffer();
}

test('social image upload validates and stores one unchanged original file for JPEG, PNG, and WebP', async () => {
  await connectMongo();
  await db.initMongoSync();

  const app = express();
  app.use(cookieParser());
  let uploadRequestCount = 0;
  app.use('/api/admin/social-preview/upload', (_req, _res, next) => {
    uploadRequestCount += 1;
    next();
  });
  app.use('/api/admin/social-preview', socialPreviewRouter);
  app.use('/api/portfolio-media', portfolioMediaRouter);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start social image upload test server.');

  const adminId = `social-image-admin-${Date.now()}`;
  const adminEmail = `${adminId}@test.local`;
  await UserModel.create({
    id: adminId,
    email: adminEmail,
    passwordHash: 'test-only',
    name: 'Social Image Test Admin',
    role: 'admin',
    disabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const admin = await sessionService.createSession({
    id: adminId,
    email: adminEmail,
    role: 'admin',
  });
  const createdIds: string[] = [];
  const legacyDerivativeIds: string[] = [];
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const profileMediaDirectory = path.join(fileService.getUploadsDir(), 'profile');
  const countStoredImages = () => fs.readdirSync(profileMediaDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:jpe?g|png|webp)$/i.test(entry.name)).length;

  try {
    const initialMediaCount = await FileMetadataModel.countDocuments({ path: { $regex: '^Portfolio/Media/' } });
    const inputs = [
      { format: 'jpeg' as const, mime: 'image/jpeg', filename: 'original-photo.jpg' },
      { format: 'png' as const, mime: 'image/png', filename: 'transparent-original.png' },
      { format: 'webp' as const, mime: 'image/webp', filename: 'landscape-original.webp' },
    ];

    for (const [index, input] of inputs.entries()) {
      const source = await createImage(input.format);
      const before = Buffer.from(source);
      const requestCountBefore = uploadRequestCount;
      const diskImageCountBefore = countStoredImages();
      const inspection = await inspectSocialImage(source, input.mime);
      assert.equal(inspection.source.width, 321);
      assert.equal(inspection.source.height, 517);
      assert.equal(inspection.source.contentType, input.mime);
      assert.equal(getSourceExtension(inspection.source.format), input.format === 'jpeg' ? 'jpg' : input.format);
      assert.deepEqual(source, before, 'inspection must not modify the uploaded bytes');

      const form = new FormData();
      form.append('file', new Blob([source], { type: input.mime }), input.filename);
      const response = await fetch(`${baseUrl}/api/admin/social-preview/upload`, {
        method: 'POST',
        headers: {
          Cookie: `sid=${admin.sessionId}; csrfToken=${admin.csrfToken}`,
          'X-CSRF-Token': admin.csrfToken,
        },
        body: form,
      });
      const payload = await response.json() as {
        success: boolean;
        original?: { id: string; name: string; url: string; contentType: string; width: number; height: number; sizeBytes: number };
        variants?: unknown[];
        defaultVariant?: unknown;
        error?: string;
      };
      assert.equal(response.status, 201, payload.error);
      assert.equal(uploadRequestCount, requestCountBefore + 1, 'one selected image must trigger one upload request');
      assert.equal(payload.success, true);
      assert.ok(payload.original);
      const original = payload.original!;
      createdIds.push(original.id);
      assert.equal(original.name, input.filename);
      assert.equal(original.url, `/api/portfolio-media/${original.id}`);
      assert.equal(original.contentType, input.mime);
      assert.equal(original.width, 321);
      assert.equal(original.height, 517);
      assert.equal(original.sizeBytes, source.length);
      assert.equal(payload.variants, undefined);
      assert.equal(payload.defaultVariant, undefined);

      const mediaFile = await FileMetadataModel.findOne({ id: original.id }).lean();
      assert.ok(mediaFile);
      assert.equal(mediaFile.path, `Portfolio/Media/${input.filename}`);
      assert.deepEqual(
        fileService.getStoredFileBuffer({
          diskPath: mediaFile.diskPath,
          content: mediaFile.content,
          contentEncoding: mediaFile.contentEncoding === 'base64' ? 'base64' : undefined,
        }),
        source,
        'stored file bytes must exactly match the uploaded image',
      );
      const asset = await SocialPreviewAssetModel.findOne({ originalId: original.id }).lean();
      assert.ok(asset);
      assert.equal(asset.variants.length, 0);
      assert.equal(
        await FileMetadataModel.countDocuments({ path: { $regex: '^Portfolio/Media/' } }),
        initialMediaCount + index + 1,
        'each upload operation must create exactly one portfolio media file',
      );
      assert.equal(countStoredImages(), diskImageCountBefore + 1, 'each upload must write exactly one image file to disk');

      const publicImage = await getPublishedSocialImageInfo(
        original.url,
        'Original image',
        'https://portfolio.example.test',
      );
      assert.equal(publicImage?.url, `https://portfolio.example.test${original.url}`);
      assert.equal(publicImage?.contentType, input.mime);
      assert.equal(publicImage?.width, 321);
      assert.equal(publicImage?.height, 517);
      await SiteContentModel.findOneAndUpdate(
        { key: 'primary_portfolio_content' },
        { $set: { siteSettings: { socialImageUrl: original.url, socialImageAlt: 'Original image' } } },
        { upsert: true, setDefaultsOnInsert: true },
      );
      const seoResponse = await loadPublishedSeoMetadata('https://portfolio.example.test');
      const publishedSiteSettings = seoResponse.content.siteSettings;
      assert.ok(publishedSiteSettings);
      assert.equal(publishedSiteSettings.socialImageUrl, `/api/portfolio-media/${original.id}`);
      assert.equal('socialPreviewUrl' in publishedSiteSettings, false);
      const publicImageResponse = await fetch(`${baseUrl}${original.url}`);
      assert.equal(publicImageResponse.status, 200);
      assert.equal(publicImageResponse.headers.get('content-type'), input.mime);
      assert.deepEqual(Buffer.from(await publicImageResponse.arrayBuffer()), source);
      const seo = buildSeoMetadata({
        siteSettings: {
          socialImageUrl: publishedSiteSettings.socialImageUrl,
          socialImageWidth: publicImage?.width,
          socialImageHeight: publicImage?.height,
          socialImageType: publicImage?.contentType,
        },
      }, 'https://portfolio.example.test');
      assert.equal(seo.socialImageUrl, publicImage?.url);
      const initialHtml = renderSeoMetadataHtml(
        '<html><head></head><body></body></html>',
        {
          siteSettings: {
            siteName: 'Test portfolio',
            siteTitle: 'Test page',
            metaDescription: 'Test description',
            socialImageUrl: publishedSiteSettings.socialImageUrl,
            socialImageWidth: publicImage?.width,
            socialImageHeight: publicImage?.height,
            socialImageType: publicImage?.contentType,
          },
        },
        'https://portfolio.example.test',
      );
      const ogImage = initialHtml.match(/property="og:image" content="([^"]+)"/)?.[1];
      const twitterImage = initialHtml.match(/name="twitter:image" content="([^"]+)"/)?.[1];
      assert.equal(ogImage, publicImage?.url);
      assert.equal(twitterImage, publicImage?.url);
    }

    const sourceFile = fileService.getFileById(createdIds[0]);
    assert.ok(sourceFile);
    const variantNames = [
      'original-image-open-graph-jpeg.jpg',
      'social-preview-x-large-jpeg.jpg',
      'social-preview-square-jpeg.jpg',
      'social-preview-open-graph-webp.webp',
      'social-preview-open-graph-png.png',
    ];
    const legacyVariants = variantNames.map((name, index) => {
      const format = index === 3 ? 'webp' : index === 4 ? 'png' : 'jpeg';
      const contentType = `image/${format}`;
      const extension = name.split('.').pop()!;
      const file = fileService.saveFile({
        name,
        path: `Portfolio/Media/${name}`,
        parentId: 'Portfolio/Media',
        extension,
        content: `data:${contentType};base64,${Buffer.from('legacy derivative').toString('base64')}`,
        size: '17 B',
        sizeBytes: 17,
      });
      legacyDerivativeIds.push(file.id);
      return {
        file,
        metadata: {
          key: `legacy-${index}`,
          label: name,
          fileId: file.id,
          width: 1200,
          height: 630,
          format: format as 'jpeg' | 'png' | 'webp',
          contentType,
          sizeBytes: 17,
        },
      };
    });
    const unrelatedMedia = fileService.saveFile({
      name: 'manual-social-export.jpg',
      path: 'Portfolio/Media/manual-social-export.jpg',
      parentId: 'Portfolio/Media',
      extension: 'jpg',
      content: `data:image/jpeg;base64,${Buffer.from('unrelated media').toString('base64')}`,
    });
    legacyDerivativeIds.push(unrelatedMedia.id);
    for (const { file } of legacyVariants) {
      const metadata = fileService.getFileById(file.id);
      assert.ok(metadata);
      await FileMetadataModel.updateOne({ id: file.id }, { $set: metadata }, { upsert: true });
    }
    await FileMetadataModel.updateOne({ id: unrelatedMedia.id }, { $set: unrelatedMedia }, { upsert: true });
    await SocialPreviewAssetModel.updateOne(
      { originalId: sourceFile.id },
      { $set: { variants: [] } },
    );
    await SocialPreviewAssetModel.create({
      originalId: 'file-original-record-missing',
      originalName: 'original-no-longer-in-media-library.jpg',
      originalFormat: 'jpeg',
      originalContentType: 'image/jpeg',
      originalWidth: 1200,
      originalHeight: 630,
      displayWidth: 1200,
      displayHeight: 630,
      originalSizeBytes: 17,
      orientation: 1,
      animated: false,
      variants: [
        ...legacyVariants.map(({ metadata }) => metadata),
        {
          key: 'unverified',
          label: 'Unverified media',
          fileId: unrelatedMedia.id,
          width: 1,
          height: 1,
          format: 'jpeg',
          contentType: 'image/jpeg',
          sizeBytes: 15,
        },
      ],
      uploadedBy: adminId,
    });
    await SiteContentModel.findOneAndUpdate(
      { key: 'primary_portfolio_content' },
      { $set: { 'siteSettings.socialImageUrl': `/api/portfolio-media/${sourceFile.id}` } },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await cleanupObsoleteSocialPreviewVariants();

    assert.ok(await FileMetadataModel.findOne({ id: sourceFile.id }), 'selected original image should remain');
    for (const { file } of legacyVariants) {
      assert.equal(await FileMetadataModel.findOne({ id: file.id }), null);
      assert.equal(fileService.getFileById(file.id), undefined);
    }
    const retainedAsset = await SocialPreviewAssetModel.findOne({ originalId: 'file-original-record-missing' }).lean();
    assert.deepEqual(retainedAsset?.variants.map((variant) => variant.fileId), [unrelatedMedia.id]);
    assert.ok(await FileMetadataModel.findOne({ id: unrelatedMedia.id }), 'unverified media must not be deleted');
    fileService.deleteFile(unrelatedMedia.id);
    await FileMetadataModel.deleteOne({ id: unrelatedMedia.id });
    await SocialPreviewAssetModel.deleteOne({ originalId: 'file-original-record-missing' });
    await SiteContentModel.deleteOne({ key: 'primary_portfolio_content' });

    for (const fileId of legacyDerivativeIds) {
      if (fileService.getFileById(fileId)) fileService.deleteFile(fileId);
      await FileMetadataModel.deleteOne({ id: fileId });
    }
    legacyDerivativeIds.length = 0;
    await SocialPreviewAssetModel.updateOne({ originalId: sourceFile.id }, { $set: { variants: [] } });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const id of legacyDerivativeIds) {
      if (fileService.getFileById(id)) fileService.deleteFile(id);
      await FileMetadataModel.deleteOne({ id });
    }
    for (const id of createdIds) {
      fileService.deleteFile(id);
      await Promise.all([
        FileMetadataModel.deleteOne({ id }),
        SocialPreviewAssetModel.deleteOne({ originalId: id }),
      ]);
    }
    await sessionService.revokeSession(admin.sessionId);
    await UserModel.deleteOne({ id: adminId });
    await disconnectMongo();
  }
});

test('legacy social image aliases remain supported for existing published links', () => {
  assert.equal(getSocialPreviewPath('image/jpeg'), '/social-preview.jpg');
  assert.equal(getSocialPreviewPath('image/png'), '/social-preview.png');
  assert.equal(getSocialPreviewPath('image/webp'), '/social-preview.webp');
  assert.equal(getSocialPreviewPath('image/gif'), undefined);
});

test('social image validation rejects corrupted input, unsupported formats, and mismatched MIME types', async () => {
  await assert.rejects(inspectSocialImage(Buffer.from('not an image'), 'image/jpeg'), /corrupted|cannot be decoded/i);
  const jpeg = await createImage('jpeg');
  await assert.rejects(inspectSocialImage(jpeg, 'image/png'), /MIME type/i);
  const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#123456' } }).gif().toBuffer();
  await assert.rejects(inspectSocialImage(gif, 'image/gif'), /Unsupported image format/i);
});
