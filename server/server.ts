import 'dotenv/config';
import fs from 'fs';
import { createServer as createHttpServer } from 'http';
import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import contactRouter from './routes/contact';
import { browseRouter } from './routes/browse';
import { filesRouter } from './routes/files';
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
import { connectMongo } from './config/dbConfig';
import { db } from './db/database';
import { windowsStorageService } from './services/windowsStorageService';
import { AdminContentDraftModel, FileMetadataModel, ProjectModel } from './models';
import { contentStudioRouter } from './routes/contentStudio';
import { fileService } from './services/fileService';
import { getPublicSkillCategories } from './services/skillCatalog';
import {
  buildContentSecurityPolicyDirectives,
  buildCorsPolicy,
  parseTrustedProxyHops,
} from './config/httpSecurity';

function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || '3000';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  const hasSmtp = Boolean(
    (process.env.EMAIL_USER || process.env.SMTP_USER) &&
    (process.env.EMAIL_PASS || process.env.SMTP_PASS)
  );

  // Validate authentication and security configuration (fails safely in production if secrets are invalid)
  getAuthConfig();

  console.log(`[Config Check] Mode: ${isProd ? 'Production' : 'Development'} | Port: ${port}`);
  console.log(`[Config Check] Gemini AI Search: ${hasGeminiKey ? 'Active (API Key loaded)' : 'Local Search Fallback Mode'}`);
  console.log(`[Config Check] Mail Transport: ${hasSmtp ? 'SMTP Transport' : 'In-Memory / Simulation Mode'}`);
  console.log(`[Config Check] Admin authentication: MongoDB-backed opaque sessions`);
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
    await db.initMongoSync();
    const recoveredPortfolioMedia = await fileService.restorePortfolioMediaIndex();
    console.log(`[Database Engine] MongoDB Mongoose Active (${connInfo.isMemoryServer ? 'Embedded Instance' : 'Connected URI'})`);
    if (recoveredPortfolioMedia > 0) {
      console.log(`[FileService] Portfolio media index synchronized: ${recoveredPortfolioMedia} file(s).`);
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

  app.use('/api/admin/backup/restore', requireAdmin, validateCsrf, express.json({ limit: '70mb' }));

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
  app.use('/api/docs', docsRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/browse', browseRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/storage', storageRouter);
  app.use('/api/captures', capturesRouter);
  app.use('/api/admin/content-studio', contentStudioRouter);
  app.use('/api/admin', adminRouter);

  // Live dynamic portfolio content for all visitors (no redeploy needed)
  app.get('/api/portfolio-content', async (req, res) => {
    try {
      const content = await getLivePortfolioContent();
      const wallpaperUrl = content.siteSettings?.defaultWallpaperUrl;
      const wallpaperId = typeof wallpaperUrl === 'string'
        ? wallpaperUrl.match(/^\/api\/portfolio-media\/([A-Za-z0-9_-]+)$/)?.[1]
        : undefined;
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
      const mediaUrl = `/api/portfolio-media/${encodeURIComponent(req.params.id)}`;
      const content = await getLivePortfolioContent();
      const profile = content.profile as Record<string, unknown> | undefined;
      const siteSettings = content.siteSettings as Record<string, unknown> | undefined;
      const activeResumeReferences = Array.isArray(content.resumes)
        && content.resumes.some((resume: any) => resume?.active === true && resume?.file === mediaUrl);
      const activeSkillIconReferences = getPublicSkillCategories(content.skills).some((category: any) =>
        category.skills.some((skill: any) => skill.iconIdentifier === `image:${mediaUrl}`));
      const profileReferences = [
        profile?.avatar,
        profile?.resumeUrl,
        siteSettings?.socialImageUrl,
        siteSettings?.faviconUrl,
        siteSettings?.defaultWallpaperUrl,
      ].includes(mediaUrl) || activeResumeReferences || activeSkillIconReferences;
      const projectReferences = Boolean(await ProjectModel.exists({
        visible: { $ne: false },
        $or: [{ image: mediaUrl }, { screenshots: mediaUrl }],
      }));
      const isAdmin = (req as AuthenticatedRequest).user?.role === 'admin';
      const [projectDraftReference, contentDraft] = isAdmin
        ? await Promise.all([
            projectDraftService.isDraftMediaReferenced(mediaUrl),
            AdminContentDraftModel.findOne({ key: 'primary_portfolio_content' }).lean(),
          ])
        : [false, null];
      const adminDraftReference = projectDraftReference || Boolean(contentDraft && JSON.stringify(contentDraft.content).includes(mediaUrl));
      if (!isAdmin && !profileReferences && !projectReferences && !adminDraftReference) {
        res.status(404).json({ success: false, error: 'Portfolio media not found.' });
        return;
      }

      const file = await FileMetadataModel.findOne({
        id: req.params.id,
        path: { $regex: '^Portfolio/Media/' },
      }).lean();
      if (!file || !file.diskPath) {
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
      if (!contentType || !safePath) {
        res.status(404).json({ success: false, error: 'Portfolio media not found.' });
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileService.sanitizeFileName(file.name)}"`);
      res.setHeader(
        'Cache-Control',
        isAdmin && !profileReferences && !projectReferences ? 'private, no-store' : 'public, max-age=3600'
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(safePath, (error) => {
        if (error && !res.headersSent) {
          res.status(404).json({ success: false, error: 'Portfolio media could not be read.' });
        }
      });
    } catch {
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
        .map((url) => {
          try {
            return new URL(url.trim(), 'http://portfolio.local').pathname
              .match(/\/api\/portfolio-media\/([A-Za-z0-9_-]+)\/?$/)?.[1];
          } catch {
            return undefined;
          }
        })
        .filter((id): id is string => Boolean(id));
      const requestedFaviconId = typeof _req.query.id === 'string' ? _req.query.id : '';
      const faviconIds = requestedFaviconId && referencedFaviconIds.includes(requestedFaviconId)
        ? [requestedFaviconId, ...referencedFaviconIds.filter((id) => id !== requestedFaviconId)]
        : referencedFaviconIds;

      let favicon: { name: string; contentType: string; safePath: string } | null = null;
      for (const faviconId of new Set(faviconIds)) {
        const file = await FileMetadataModel.findOne({
          id: faviconId,
          path: { $regex: '^Portfolio/Media/' },
        }).select('name extension diskPath').lean();
        const extension = (file?.extension || path.extname(file?.name || '')).replace(/^\./, '').toLowerCase();
        const contentType = mimeTypes[extension];
        const safePath = file?.diskPath ? fileService.resolveSafeDiskPath(file.diskPath) : null;
        if (file && contentType && safePath && fs.existsSync(safePath)) {
          favicon = { name: file.name, contentType, safePath };
          break;
        }
      }
      if (!favicon) {
        res.status(404).send('Configured favicon is unavailable.');
        return;
      }

      res.setHeader('Content-Type', favicon.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileService.sanitizeFileName(favicon.name)}"`);
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');
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
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('[Global API Error Handler]:', err);
    res.status(err.status || err.statusCode || 500).json({
      success: false,
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred on the server.',
    });
  });

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

  if (isDev) {
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
