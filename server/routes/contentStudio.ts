import { Router, Response } from 'express';
import { requireAdmin, validateCsrf, AuthenticatedRequest } from '../middleware/auth';
import { getLivePortfolioContent } from './admin';
import { contentStudioService } from '../services/contentStudioService';
import mongoose from 'mongoose';
import { getEmailConfig } from '../config/emailConfig';
import { projectDraftService } from '../services/projectDraftService';

export const contentStudioRouter = Router();
contentStudioRouter.use(requireAdmin, validateCsrf);

contentStudioRouter.get('/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [snapshot, emailConfig] = await Promise.all([
      contentStudioService.getSnapshot(await getLivePortfolioContent()),
      Promise.resolve(getEmailConfig()),
    ]);
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    const draftSettings = snapshot.draft.siteSettings as Record<string, unknown> | undefined;
    const publishedSettings = snapshot.published.siteSettings as Record<string, unknown> | undefined;
    res.json({
      success: true,
      services: {
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        webSearch: publishedSettings?.assistantEnabled === false ? 'disabled' : geminiConfigured ? 'gemini' : 'local-fallback',
        webSearchConfigured: geminiConfigured,
        email: emailConfig.provider !== 'dev_mock' ? 'configured' : 'not-configured',
        chatHistory: 'not-available',
      },
      draftSearchEnabled: draftSettings?.assistantEnabled !== false,
      publishedSearchEnabled: publishedSettings?.assistantEnabled !== false,
    });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message || 'Service status unavailable.' });
  }
});

contentStudioRouter.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await contentStudioService.getSnapshot(await getLivePortfolioContent());
    res.json({ success: true, ...snapshot });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message || 'Content studio unavailable.' });
  }
});

contentStudioRouter.put('/draft', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await contentStudioService.saveDraft(req.body?.content, req.user!.userId);
    res.json({ success: true, ...snapshot });
  } catch (error: any) {
    const status = error.message?.includes('smaller than') ? 413 : error.message?.includes('must') ? 422 : 503;
    res.status(status).json({ success: false, error: error.message || 'Draft could not be saved.' });
  }
});

contentStudioRouter.post('/discard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await contentStudioService.discardDraft(req.user!.userId);
    await projectDraftService.discardDraftProjects(req.user!.userId);
    res.json({ success: true, ...snapshot });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message || 'Draft changes could not be discarded.' });
  }
});

contentStudioRouter.post('/publish', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await contentStudioService.publishDraft(req.user!.userId);
    await projectDraftService.publishDraftProjects();
    res.json({ success: true, ...snapshot });
  } catch (error: any) {
    const status = error.message?.includes('Save a draft') ? 409 : error.message?.includes('must') ? 422 : 503;
    res.status(status).json({ success: false, error: error.message || 'Draft could not be published.' });
  }
});

contentStudioRouter.get('/revisions', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const revisions = await contentStudioService.listRevisions();
    res.json({ success: true, revisions });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message || 'Revisions unavailable.' });
  }
});

contentStudioRouter.post('/revisions/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await contentStudioService.restoreRevision(req.params.id, req.user!.userId);
    if (!snapshot) {
      res.status(404).json({ success: false, error: 'Revision not found.' });
      return;
    }
    res.json({ success: true, ...snapshot });
  } catch (error: any) {
    const status = error.message?.includes('must') ? 422 : 503;
    res.status(status).json({ success: false, error: error.message || 'Revision could not be restored.' });
  }
});

const deleteRevisionHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await contentStudioService.deleteRevision(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Revision not found.' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(503).json({ success: false, error: error.message || 'Revision could not be deleted.' });
  }
};

contentStudioRouter.delete('/revisions/:id', deleteRevisionHandler);
// POST is kept as a method-compatible alternative for local/proxy deployments
// that do not forward DELETE requests reliably.
contentStudioRouter.post('/revisions/:id/delete', deleteRevisionHandler);
