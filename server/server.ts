import 'dotenv/config';
import fs from 'fs';
import { createServer as createHttpServer } from 'http';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import contactRouter from './routes/contact';
import { browseRouter } from './routes/browse';
import { filesRouter, hasMediaUrlReference, hasVisibleResumeMediaReference } from './routes/files';
import { profileRouter } from './routes/profile';
import { authRouter } from './routes/auth';
import { tasksRouter } from './routes/tasks';
import { analyticsRouter } from './routes/analytics';
import { docsRouter } from './routes/docs';
import { storageRouter } from './routes/storage';
import { capturesRouter } from './routes/captures';
import { adminRouter, getLivePortfolioContent } from './routes/admin';
import { healthRouter } from './routes/health';
import { analyticsLogger } from './middleware/security';
import { AuthenticatedRequest, optionalAuth, requireAdmin, validateCsrf } from './middleware/auth';
import { projectDraftService } from './services/projectDraftService';
import { apiNotFoundHandler } from './middleware/apiNotFound';
import { getAuthConfig } from './config/authConfig';
import { connectMongo, ensureApplicationCollections } from './config/dbConfig';
import { db } from './db/database';
import { windowsStorageService } from './services/windowsStorageService';
import { AdminContentDraftModel, FileMetadataModel, ProjectModel } from './models';
import { retainAnalyticsUntilReset } from './models/Analytics';
import { contentStudioRouter } from './routes/contentStudio';
import { widgetsRouter } from './routes/widgets';
import { fileService } from './services/fileService';
import { getPublicSkillCategories } from './services/skillCatalog';
import { getEmailConfig } from './config/emailConfig';
import { setPortfolioMediaResourcePolicy } from './utils/portfolioMediaHeaders';
import {
  buildContentSecurityPolicyDirectives,
  buildCorsPolicy,
  parseTrustedProxyHops,
} from './config/httpSecurity';

function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || '3000';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  const emailProvider = getEmailConfig();

  // Validate authentication and security configuration (fails safely in production if secrets are invalid)
  getAuthConfig();

  console.log(`[Config Check] Mode: ${isProd ? 'Production' : 'Development'} | Port: ${port}`);
  console.log(`[Config Check] Gemini AI Search: ${hasGeminiKey ? 'Active (API Key loaded)' : 'Local Search Fallback Mode'}`);
  console.log(`[Config Check] Mail Transport: ${emailProvider.diagnosticDetails?.detectedProvider || 'Dev/Mock Store'}`);
  console.log(`[Config Check] Admin authentication: MongoDB-backed opaque sessions`);
  if (isProd && !process.env.PORTFOLIO_STORAGE_DIR?.trim()) {
    console.warn('[StorageConfig] PORTFOLIO_STORAGE_DIR is not set; non-media uploads and backups use the instance filesystem.');
  }
}

function getPortfolioMediaId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value, 'http://portfolio.local');
    if (!url.pathname.startsWith('/api/portfolio-media/')) return undefined;
    const id = url.searchParams.get('id');
    if (id) return id;
    const legacyId = url.pathname.slice('/api/portfolio-media/'.length);
    return /^file-[A-Za-z0-9-]+$/.test(legacyId) ? legacyId : undefined;
  } catch {
    return undefined;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateMetaTag(html: string, attribute: 'name' | 'property', key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${escapedKey}["'])[^>]*>`, 'i');
  const existingTag = html.match(matcher)?.[0];
  if (!value) return existingTag ? html.replace(existingTag, '') : html;
  const tag = `<meta ${attribute}="${key}" content="${escapeHtmlAttribute(value)}" />`;
  return existingTag
    ? html.replace(existingTag, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`);
}

function updateLinkTag(html: string, rel: 'canonical' | 'icon', href: string): string {
  const matcher = new RegExp(`<link\\b(?=[^>]*\\brel=["']${rel}["'])[^>]*>`, 'i');
  const existingTag = html.match(matcher)?.[0];
  if (!href) return existingTag ? html.replace(existingTag, '') : html;
  const tag = `<link rel="${rel}" href="${escapeHtmlAttribute(href)}" />`;
  return existingTag
    ? html.replace(existingTag, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`);
}

async function startServer() {
  validateEnvironment();

  // A second `npm run dev` should reuse the already-running local app instead
  // of bootstrapping another database and failing to bind the same port.
  if (process.env.NODE_ENV !== 'production') {
    const port = Number.parseInt(process.env.PORT || '3000', 10);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        const health = await response.json() as { service?: string };
        if (health.service === 'Windows 11 OS Portfolio Server') {
          console.log(`[Server] Development app is already running at http://localhost:${port}; reusing it.`);
          return;
        }
      }
    } catch {
      // Nothing is responding as this app on the configured port; continue startup.
    }
  }

  // Persistent storage is required to serve the application safely.
  try {
    const connInfo = await connectMongo();
    await ensureApplicationCollections();
    await retainAnalyticsUntilReset();
    await db.initMongoSync();
    const recoveredPortfolioMedia = await fileService.restorePortfolioMediaIndex();
    const persistedPortfolioMedia = await fileService.persistPortfolioMediaContent();
    console.log(`[Database Engine] MongoDB Mongoose Active (${connInfo.isMemoryServer ? 'Embedded Instance' : 'Connected URI'})`);
    if (recoveredPortfolioMedia > 0) {
      console.log(`[FileService] Portfolio media index synchronized: ${recoveredPortfolioMedia} file(s).`);
    }
    if (persistedPortfolioMedia > 0) {
      console.log(`[FileService] Portfolio media copied into MongoDB for durable serving: ${persistedPortfolioMedia} file(s).`);
    }
  } catch {
    console.error('[Database Engine] Required MongoDB persistence is unavailable; server startup aborted.');
    throw new Error('Required MongoDB persistence is unavailable.');
  }

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const corsPolicy = buildCorsPolicy();

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: buildContentSecurityPolicyDirectives(process.env.NODE_ENV === 'production'),
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Trust only an explicitly configured number of reverse proxies; default trusts none.
  const configuredProxyHops = parseTrustedProxyHops(process.env.TRUST_PROXY_HOPS);
  app.set('trust proxy', configuredProxyHops || false);

  // Cross-Origin Resource Sharing with production origin validation
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, corsPolicy.isAllowedOrigin(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Session-ID'],
    })
  );

  // Cookie parser for JWT session cookies
  app.use(cookieParser());

  app.use('/api/admin/backup/restore', requireAdmin, validateCsrf, express.json({ limit: '110mb' }));

  // Body parser middleware (support media and photo data URLs)
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Enforce CSRF protection centrally for every authenticated state-changing route.
  app.use(validateCsrf);

  // Telemetry and request logging
  app.use(analyticsLogger);

  // Health check router
  app.use('/api/health', healthRouter);

  // Mount backend API routers
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/widgets', widgetsRouter);
  app.use('/api/docs', docsRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/browse', browseRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/storage', storageRouter);
  app.use('/api/captures', capturesRouter);
  app.use('/api/admin/content-studio', contentStudioRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api/seo-metadata', async (_req, res) => {
    try {
      const content = await getLivePortfolioContent();
      const settings = content.siteSettings || {};
      const profile = content.profile || {};
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        content: {
          profile: {
            name: profile.name,
            title: profile.title,
            bio: profile.bio,
            avatar: profile.avatar,
          },
          siteSettings: {
            siteName: settings.siteName,
            siteTitle: settings.siteTitle,
            metaDescription: settings.metaDescription,
            faviconUrl: settings.faviconUrl,
            socialImageUrl: settings.socialImageUrl,
            openGraphTitle: settings.openGraphTitle,
            openGraphDescription: settings.openGraphDescription,
            canonicalUrl: settings.canonicalUrl,
            twitterCard: settings.twitterCard,
            twitterTitle: settings.twitterTitle,
            twitterDescription: settings.twitterDescription,
          },
        },
      });
    } catch {
      res.status(503).json({ success: false, error: 'Published SEO metadata could not be loaded.' });
    }
  });

  // Live dynamic portfolio content for all visitors (no redeploy needed)
  app.get('/api/portfolio-content', async (req, res) => {
    try {
      const content = await getLivePortfolioContent();
      const wallpaperUrl = content.siteSettings?.defaultWallpaperUrl;
      const wallpaperId = getPortfolioMediaId(wallpaperUrl);
      const wallpaperMetadata = wallpaperId
        ? await FileMetadataModel.findOne({
            id: wallpaperId,
            path: { $regex: '^Portfolio/Media/' },
          }).select('name').lean()
        : null;
      const siteSettings = {
        ...content.siteSettings,
        ...(wallpaperMetadata?.name ? { defaultWallpaperName: wallpaperMetadata.name } : {}),
      };
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        content: {
          ...content,
          siteSettings,
          skills: getPublicSkillCategories(content.skills),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Public projects endpoint for the ProjectsApp
  app.get('/api/projects', async (req, res) => {
    try {
      const projects = await ProjectModel.find({ visible: { $ne: false } }).sort({ featured: -1, createdAt: -1 }).lean();
      res.json({ success: true, projects });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/portfolio-media/:id', optionalAuth, async (req, res) => {
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
        siteSettings?.defaultWallpaperUrl,
      ], mediaUrl) || visibleResumeReferences || activeSkillIconReferences;
      const projects = await ProjectModel.find({
        visible: { $ne: false },
      }).select('image screenshots').lean();
      const projectReferences = hasMediaUrlReference(projects, mediaUrl);
      const isAdmin = (req as AuthenticatedRequest).user?.role === 'admin';
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
        isAdmin && !profileReferences && !projectReferences ? 'private, no-store' : 'public, max-age=3600'
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

  app.get('/api/email/favicon', async (_req, res) => {
    try {
      const publishedContent = await getLivePortfolioContent();
      const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        ico: 'image/x-icon',
        bmp: 'image/bmp',
      };
      const draft = await AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' })
        .select('content.siteSettings.faviconUrl')
        .lean();
      const draftContent = draft?.content as Record<string, unknown> | undefined;
      const draftSettings = draftContent?.siteSettings;
      const draftFavicon = draftSettings && typeof draftSettings === 'object'
        ? (draftSettings as Record<string, unknown>).faviconUrl
        : undefined;
      const configuredFaviconUrls = [
        publishedContent.siteSettings?.faviconUrl,
        draftFavicon,
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
      const referencedFaviconIds = configuredFaviconUrls
        .map((url) => getPortfolioMediaId(url.trim()))
        .filter((id): id is string => Boolean(id));
      const requestedFaviconId = typeof _req.query.id === 'string' ? _req.query.id : '';
      const faviconIds = requestedFaviconId && referencedFaviconIds.includes(requestedFaviconId)
        ? [requestedFaviconId, ...referencedFaviconIds.filter((id) => id !== requestedFaviconId)]
        : referencedFaviconIds;

      let favicon:
        | { name: string; contentType: string; safePath: string; buffer?: never }
        | { name: string; contentType: string; buffer: Buffer; safePath?: never }
        | null = null;
      for (const faviconId of new Set(faviconIds)) {
        const file = await FileMetadataModel.findOne({
          id: faviconId,
          path: { $regex: '^Portfolio/Media/' },
        }).select('name extension diskPath content contentEncoding').lean();
        const extension = (file?.extension || path.extname(file?.name || '')).replace(/^\./, '').toLowerCase();
        const contentType = mimeTypes[extension];
        const safePath = file?.diskPath ? fileService.resolveSafeDiskPath(file.diskPath) : null;
        if (file && contentType && safePath && fs.existsSync(safePath)) {
          favicon = { name: file.name, contentType, safePath };
          break;
        }
        if (file && contentType) {
          const buffer = fileService.getStoredFileBuffer(file);
          if (buffer) {
            favicon = { name: file.name, contentType, buffer };
            break;
          }
        }
      }
      if (!favicon) {
        res.status(503).send('Configured favicon is unavailable.');
        return;
      }

      res.setHeader('Content-Type', favicon.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileService.sanitizeFileName(favicon.name)}"`);
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (favicon.buffer) {
        res.setHeader('Content-Length', favicon.buffer.length);
        res.send(favicon.buffer);
        return;
      }
      res.sendFile(favicon.safePath, (error) => {
        if (error && !res.headersSent) {
          console.error('[Email favicon] Could not read the configured favicon file.', error);
          res.status(404).send('Configured favicon could not be read.');
        }
      });
    } catch (error) {
      console.error('[Email favicon] Could not serve the configured favicon.', error);
      res.status(503).send('Email favicon is temporarily unavailable.');
    }
  });

  // Never allow unmatched API requests to fall through to the SPA HTML response.
  app.use('/api', apiNotFoundHandler);

  // Global API error handler for any uncaught /api/ errors (returns JSON instead of HTML)
  const apiErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const error = err as Error & {
      status?: number;
      statusCode?: number;
      type?: string;
      code?: string | number;
    };
    let status = Number.isInteger(error.statusCode) ? error.statusCode! : error.status;
    if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') status = 413;
    else if (error.type === 'entity.parse.failed') status = 400;
    else if (error.name === 'ValidationError') status = 422;
    else if (error.name === 'CastError') status = 400;
    else if (error.code === 11000) status = 409;
    if (!Number.isInteger(status) || status! < 400 || status! > 599) status = 500;

    const publicMessage = status! >= 500
      ? 'The server could not complete this request.'
      : error.message || 'The request could not be processed.';
    const code = typeof error.code === 'string'
      ? error.code
      : status === 413
        ? 'PAYLOAD_TOO_LARGE'
        : status === 422
          ? 'VALIDATION_ERROR'
          : status === 409
            ? 'CONFLICT'
            : status === 503
              ? 'SERVICE_UNAVAILABLE'
              : status! >= 500
                ? 'INTERNAL_SERVER_ERROR'
                : 'INVALID_REQUEST';

    if (status! >= 500) console.error(`[API] ${req.method} ${req.originalUrl} failed:`, err);
    else console.warn(`[API] ${req.method} ${req.originalUrl} rejected with ${status}: ${error.message}`);
    res.status(status!).json({
      success: false,
      error: publicMessage,
      message: publicMessage,
      code,
    });
  };
  app.use('/api', apiErrorHandler);

  // Share the HTTP server with Vite so HMR does not claim a separate fixed port.
  const server = createHttpServer(app);

  // Serve only intentionally public static assets; private captures use authenticated download routes.
  app.use(express.static(path.join(process.cwd(), 'client/public')));

  // Vite middleware for development & SPA serving for production
  const isDev =
    process.env.NODE_ENV !== 'production' ||
    process.env.npm_lifecycle_event === 'dev' ||
    process.env.VITE_DEV === 'true' ||
    !fs.existsSync(path.join(process.cwd(), 'client/dist/index.html')) ||
    process.argv.some((arg) => arg.includes('server.ts') || arg.includes('tsx'));

  if (isDev && process.env.PORTFOLIO_DEV_API_ONLY === 'true') {
    console.log('[Server] API-only development mode; Vite is served separately on its development port.');
  } else if (isDev) {
    console.log('[Server] Mounting live Vite development middleware (Tailwind CSS v4 + React HMR)...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.join(process.cwd(), 'client/vite.config.ts'),
      root: path.join(process.cwd(), 'client'),
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Server] Serving compiled static production frontend from /client/dist...');
    const distPath = path.join(process.cwd(), 'client/dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res, next) => {
      try {
        let html = await fs.promises.readFile(path.join(distPath, 'index.html'), 'utf8');
        const content = await getLivePortfolioContent() as Record<string, unknown>;
        const siteSettings = content.siteSettings && typeof content.siteSettings === 'object'
          ? content.siteSettings as Record<string, unknown>
          : {};
        const profile = content.profile && typeof content.profile === 'object'
          ? content.profile as Record<string, unknown>
          : {};
        const siteTitle = typeof siteSettings.siteTitle === 'string' ? siteSettings.siteTitle : '';
        const description = typeof siteSettings.metaDescription === 'string' ? siteSettings.metaDescription : '';
        const website = typeof profile.website === 'string' ? profile.website : '';
        const requestOrigin = `${req.protocol}://${req.get('host')}`;
        const publicOrigin = (() => {
          try {
            const url = new URL(website || requestOrigin);
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : requestOrigin;
          } catch {
            return requestOrigin;
          }
        })();
        const resolvePublicImage = (value: unknown) => {
          if (typeof value !== 'string' || !value.trim()) return '';
          try {
            const url = new URL(value, publicOrigin);
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
          } catch {
            return '';
          }
        };
        const socialImageUrl = resolvePublicImage(siteSettings.socialImageUrl);
        const faviconUrl = resolvePublicImage(siteSettings.faviconUrl);
        const canonicalUrl = /^https?:\/\//i.test(website) ? website : '';
        if (siteTitle) html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtmlAttribute(siteTitle)}</title>`);
        html = updateMetaTag(html, 'name', 'description', description);
        html = updateMetaTag(html, 'property', 'og:title', siteTitle);
        html = updateMetaTag(html, 'property', 'og:description', description);
        html = updateMetaTag(html, 'property', 'og:image', socialImageUrl);
        html = updateMetaTag(html, 'name', 'twitter:card', socialImageUrl ? 'summary_large_image' : 'summary');
        html = updateMetaTag(html, 'name', 'twitter:title', siteTitle);
        html = updateMetaTag(html, 'name', 'twitter:description', description);
        html = updateMetaTag(html, 'name', 'twitter:image', socialImageUrl);
        html = updateLinkTag(html, 'canonical', canonicalUrl);
        html = updateLinkTag(html, 'icon', faviconUrl);
        res.setHeader('Cache-Control', 'no-cache');
        res.type('html').send(html);
      } catch (error) {
        next(error);
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Windows 11 OS Portfolio] Listening on http://0.0.0.0:${PORT}`);
    
    // Retire expired visitor copies daily while preserving admin archive originals.
    setInterval(() => {
        void windowsStorageService.run30DayRetentionCleanup()
          .then((result) => console.log(`[Worker] Cleanup complete. Retired ${result.cleanedCount} expired visitor copies; admin archives were preserved.`))
          .catch((err) => {
            console.error('[Worker] Archive cleanup failed:', err);
          });
    }, 24 * 60 * 60 * 1000);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Startup Fatal Error]: Port ${PORT} is already in use by another process.`);
    } else {
      console.error(`[Startup Fatal Error]: Server failed to bind on port ${PORT}:`, err);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('[Startup Fatal Error]: Failed to bootstrap server:', err);
  process.exit(1);
});
