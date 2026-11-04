import fs from 'fs';
import { Router, Response } from 'express';
import { AdminContentDraftModel, FileMetadataModel, ProjectModel } from '../models';
import { AuthenticatedRequest, optionalAuth } from '../middleware/auth';
import { getLivePortfolioContent } from './admin';
import { hasMediaUrlReference, hasVisibleResumeMediaReference } from './files';
import { projectDraftService } from '../services/projectDraftService';
import { fileService } from '../services/fileService';
import { getPublicSkillCategories } from '../services/skillCatalog';
import { setPortfolioMediaResourcePolicy } from '../utils/portfolioMediaHeaders';

export const portfolioMediaRouter = Router();

portfolioMediaRouter.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedId = typeof req.query.id === 'string' ? req.query.id : req.params.id;
    if (!/^file-[A-Za-z0-9-]+$/.test(requestedId)) {
      res.status(404).json({ success: false, error: 'Portfolio media not found.' });
      return;
    }
    const file = await FileMetadataModel.findOne({
      id: requestedId,
      path: { $regex: '^Portfolio/Media/' },
    }).lean();
    if (!file || (requestedId !== req.params.id && file.name !== req.params.id)) {
      res.status(404).json({ success: false, error: 'Portfolio media not found.' });
      return;
    }
    const mediaUrl = `/api/portfolio-media/${encodeURIComponent(requestedId)}`;
    const content = await getLivePortfolioContent();
    const profile = content.profile as Record<string, unknown> | undefined;
    const siteSettings = content.siteSettings as Record<string, unknown> | undefined;
    const visibleResumeReferences = hasVisibleResumeMediaReference(content.resumes, mediaUrl);
    const activeSkillIconReferences = getPublicSkillCategories(content.skills).some((category: any) =>
      category.skills.some((skill: any) => typeof skill.iconIdentifier === 'string' &&
        skill.iconIdentifier.startsWith('image:') &&
        hasMediaUrlReference(skill.iconIdentifier.slice('image:'.length), mediaUrl)));
    const profileReferences = hasMediaUrlReference([
      profile?.avatar,
      profile?.resumeUrl,
      siteSettings?.socialImageUrl,
      siteSettings?.faviconUrl,
      siteSettings?.emailBrandImageUrl,
      siteSettings?.defaultWallpaperUrl,
    ], mediaUrl) || visibleResumeReferences || activeSkillIconReferences;
    const projects = await ProjectModel.find({
      visible: { $ne: false },
    }).select('image screenshots').lean();
    const projectReferences = hasMediaUrlReference(projects, mediaUrl);
    const isAdmin = req.user?.role === 'admin';
    const [projectDraftReference, contentDraft] = isAdmin
      ? await Promise.all([
          projectDraftService.isDraftMediaReferenced(mediaUrl),
          AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean(),
        ])
      : [false, null];
    const adminDraftReference = projectDraftReference || Boolean(contentDraft && hasMediaUrlReference(contentDraft.content, mediaUrl));
    if (!isAdmin && !profileReferences && !projectReferences && !adminDraftReference) {
      res.status(404).json({ success: false, error: 'Portfolio media not found.' });
      return;
    }

    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      ico: 'image/x-icon',
      bmp: 'image/bmp',
      tif: 'image/tiff',
      tiff: 'image/tiff',
      heic: 'image/heic',
      heif: 'image/heif',
      avif: 'image/avif',
      pdf: 'application/pdf',
    };
    const extension = (file.extension || '').toLowerCase();
    const contentType = mimeTypes[extension];
    const safePath = fileService.resolveSafeDiskPath(file.diskPath);
    if (!contentType) {
      res.status(404).json({ success: false, error: 'Portfolio media not found.' });
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileService.sanitizeFileName(file.name)}"`);
    res.setHeader(
      'Cache-Control',
      isAdmin && !profileReferences && !projectReferences ? 'private, no-store' : 'public, max-age=3600',
    );
    setPortfolioMediaResourcePolicy(res, profileReferences || projectReferences);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (safePath && fs.existsSync(safePath)) {
      res.sendFile(safePath, (error) => {
        if (error && !res.headersSent) {
          res.status(404).json({ success: false, error: 'Portfolio media could not be read.' });
        }
      });
      return;
    }
    const buffer = fileService.getStoredFileBuffer(file);
    if (!buffer) {
      res.status(503).json({
        success: false,
        error: 'Portfolio media content is unavailable; restore the file or configure persistent storage.',
      });
      return;
    }
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('[Portfolio media] Could not serve the requested asset.', error);
    res.status(503).json({ success: false, error: 'Portfolio media is temporarily unavailable.' });
  }
});
