import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { SiteContentModel } from '../models';
import { getPublishedSocialImageInfo } from './publishedSocialImageService';

const CONTENT_KEY = 'primary_portfolio_content';

export async function loadPublishedSeoMetadata(baseUrl: string) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Published SEO metadata is unavailable because the database is disconnected.');
  }

  const published = await SiteContentModel.findOne({ key: CONTENT_KEY }).lean();
  if (!published) return { published: false as const, content: {} };

  const profile = published.profile || {};
  const settings = published.siteSettings || {};
  const socialImage = await getPublishedSocialImageInfo(
    settings.socialImageUrl,
    settings.socialImageAlt,
    baseUrl,
  );

  return {
    published: true as const,
    content: {
      profile: {
        name: profile.name,
        title: profile.title,
        bio: profile.bio,
        avatar: profile.avatar,
        website: profile.website,
      },
      siteSettings: {
        siteName: settings.siteName,
        siteTitle: settings.siteTitle,
        metaDescription: settings.metaDescription,
        faviconUrl: settings.faviconUrl,
        socialImageUrl: socialImage?.fileId && socialImage.url
          ? new URL(socialImage.url).pathname
          : socialImage?.url || settings.socialImageUrl,
        socialImageAlt: settings.socialImageAlt,
        socialImageWidth: socialImage?.width,
        socialImageHeight: socialImage?.height,
        socialImageType: socialImage?.contentType,
        canonicalUrl: settings.canonicalUrl,
      },
    },
  };
}

export async function handlePublishedSeoMetadata(req: Request, res: Response): Promise<void> {
  try {
    const result = await loadPublishedSeoMetadata(`${req.protocol}://${req.get('host')}`);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[SEO] Published metadata could not be loaded from the database.', error);
    res.status(503).json({ success: false, error: 'Published SEO metadata is temporarily unavailable.' });
  }
}
