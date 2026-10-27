import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { db, AnalyticsEvent } from '../db/database';
import { AnalyticsModel, ContactModel } from '../models';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sanitizeLogData, createRateLimiter } from '../middleware/security';

export const analyticsRouter = Router();

const dashboardEventNames = ['PORTFOLIO_PAGE_VIEW', 'PROJECT_VIEW', 'PROJECT_CLICK', 'PORTFOLIO_APP_OPEN', 'ASSISTANT_QUESTION'];
const MAX_RECENT_PAGE_SIZE = 50;

const trackLimiter = createRateLimiter({
  maxRequests: 120,
  windowMs: 60 * 1000,
  message: 'Analytics event limit reached.',
});

/**
 * GET /api/analytics/dashboard
 * Protected: Portfolio visit and app usage analytics (Admin Only)
 */
analyticsRouter.get('/dashboard', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recentPage = Math.max(1, Number.parseInt(String(req.query.recentPage || '1'), 10) || 1);
    const recentLimit = Math.max(1, Math.min(
      MAX_RECENT_PAGE_SIZE,
      Number.parseInt(String(req.query.recentLimit || MAX_RECENT_PAGE_SIZE), 10) || MAX_RECENT_PAGE_SIZE,
    ));
    const requestedActivityDays = Number.parseInt(String(req.query.activityDays || '7'), 10);
    const activityDays = [7, 14, 30, 90].includes(requestedActivityDays) ? requestedActivityDays : 7;
    const [leadCount, unreadLeadCount] = mongoose.connection.readyState === 1
      ? await Promise.all([
        ContactModel.countDocuments(),
        ContactModel.countDocuments({ replied: { $ne: true }, status: { $ne: 'replied' } }),
      ])
      : (() => {
        const contacts = Array.from(db.contacts.values());
        return [
          contacts.length,
          contacts.filter((contact) => !contact.replied && contact.status !== 'replied').length,
        ];
      })();
    const today = new Date();
    const dailyActivity = Array.from({ length: activityDays }, (_, index) => {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (activityDays - 1 - index)));
      return { date: date.toISOString().slice(0, 10), pageViews: 0, projectClicks: 0 };
    });
    const activityStart = `${dailyActivity[0].date}T00:00:00.000Z`;
    const summary = {
      uniqueVisitors: 0,
      pageViews: 0,
      projectViews: 0,
      projectClicks: 0,
      assistantQuestions: 0,
      chatEngagementRate: 0,
    };
    let topProjects: Array<{ projectId: string; projectTitle: string; views: number; clicks: number }> = [];
    let appOpenCounts: Array<{ appId: string; appName: string; count: number }> = [];
    let recentAppOpens: Array<Pick<AnalyticsEvent, 'id' | 'timestamp' | 'page' | 'metadata'>> = [];
    let recentAppOpensTotal = 0;
    let activity = dailyActivity;

    if (mongoose.connection.readyState === 1) {
      const baseMatch = { eventName: { $in: dashboardEventNames } };
      const [aggregates, recentTotal, recentRows] = await Promise.all([
        AnalyticsModel.aggregate([
          { $match: baseMatch },
          {
            $facet: {
              eventCounts: [{ $group: { _id: '$eventName', count: { $sum: 1 } } }],
              visitors: [
                { $match: { 'metadata.visitorId': { $type: 'string' } } },
                { $group: { _id: '$metadata.visitorId' } },
                { $count: 'count' },
              ],
              assistantVisitors: [
                { $match: { eventName: 'ASSISTANT_QUESTION', 'metadata.visitorId': { $type: 'string' } } },
                { $group: { _id: '$metadata.visitorId' } },
                { $count: 'count' },
              ],
              projects: [
                { $match: { eventName: { $in: ['PROJECT_VIEW', 'PROJECT_CLICK'] }, 'metadata.projectId': { $type: 'string' } } },
                {
                  $group: {
                    _id: '$metadata.projectId',
                    projectTitle: { $last: '$metadata.projectTitle' },
                    views: { $sum: { $cond: [{ $eq: ['$eventName', 'PROJECT_VIEW'] }, 1, 0] } },
                    clicks: { $sum: { $cond: [{ $eq: ['$eventName', 'PROJECT_CLICK'] }, 1, 0] } },
                  },
                },
                { $sort: { views: -1, clicks: -1, _id: 1 } },
                { $limit: 500 },
              ],
              apps: [
                { $match: { eventName: 'PORTFOLIO_APP_OPEN', 'metadata.appId': { $type: 'string' } } },
                {
                  $group: {
                    _id: '$metadata.appId',
                    appName: { $last: '$metadata.appName' },
                    count: { $sum: 1 },
                  },
                },
                { $sort: { count: -1, _id: 1 } },
                { $limit: 500 },
              ],
              activity: [
                { $match: { timestamp: { $gte: activityStart }, eventName: { $in: ['PORTFOLIO_PAGE_VIEW', 'PROJECT_CLICK'] } } },
                {
                  $group: {
                    _id: { $substr: ['$timestamp', 0, 10] },
                    pageViews: { $sum: { $cond: [{ $eq: ['$eventName', 'PORTFOLIO_PAGE_VIEW'] }, 1, 0] } },
                    projectClicks: { $sum: { $cond: [{ $eq: ['$eventName', 'PROJECT_CLICK'] }, 1, 0] } },
                  },
                },
              ],
            },
          },
        ]),
        AnalyticsModel.countDocuments({ ...baseMatch, eventName: 'PORTFOLIO_APP_OPEN' }),
        AnalyticsModel.find({ ...baseMatch, eventName: 'PORTFOLIO_APP_OPEN' })
          .select('id timestamp page metadata')
          .sort({ timestamp: -1, id: -1 })
          .skip((recentPage - 1) * recentLimit)
          .limit(recentLimit)
          .lean(),
      ]);

      const result = aggregates[0] || {};
      const eventCounts = new Map((result.eventCounts || []).map((entry: any) => [entry._id, entry.count]));
      summary.pageViews = Number(eventCounts.get('PORTFOLIO_PAGE_VIEW') || 0);
      summary.projectViews = Number(eventCounts.get('PROJECT_VIEW') || 0);
      summary.projectClicks = Number(eventCounts.get('PROJECT_CLICK') || 0);
      summary.assistantQuestions = Number(eventCounts.get('ASSISTANT_QUESTION') || 0);
      summary.uniqueVisitors = Number(result.visitors?.[0]?.count || 0);
      summary.chatEngagementRate = summary.uniqueVisitors
        ? Math.round((Number(result.assistantVisitors?.[0]?.count || 0) / summary.uniqueVisitors) * 1000) / 10
        : 0;
      topProjects = (result.projects || []).map((project: any) => ({
        projectId: String(project._id),
        projectTitle: String(project.projectTitle || 'Untitled project'),
        views: Number(project.views || 0),
        clicks: Number(project.clicks || 0),
      }));
      appOpenCounts = (result.apps || []).map((app: any) => ({
        appId: String(app._id),
        appName: String(app.appName || app._id),
        count: Number(app.count || 0),
      }));
      activity = dailyActivity.map((day) => {
        const item = (result.activity || []).find((entry: any) => entry._id === day.date);
        return { ...day, pageViews: Number(item?.pageViews || 0), projectClicks: Number(item?.projectClicks || 0) };
      });
      recentAppOpens = recentRows as unknown as typeof recentAppOpens;
      recentAppOpensTotal = recentTotal;
    } else {
      const events = db.analytics.filter((event) => dashboardEventNames.includes(event.eventName));
      const visitors = new Set(events.map((event) => event.metadata?.visitorId)
        .filter((visitorId): visitorId is string => typeof visitorId === 'string' && visitorId.length > 0));
      const assistantVisitors = new Set(events.filter((event) => event.eventName === 'ASSISTANT_QUESTION')
        .map((event) => event.metadata?.visitorId)
        .filter((visitorId): visitorId is string => typeof visitorId === 'string' && visitorId.length > 0));
      const projects = new Map<string, { projectId: string; projectTitle: string; views: number; clicks: number }>();
      const apps = new Map<string, { appId: string; appName: string; count: number }>();
      for (const event of events) {
        const day = activity.find((entry) => entry.date === event.timestamp.slice(0, 10));
        if (event.eventName === 'PORTFOLIO_PAGE_VIEW') {
          summary.pageViews += 1;
          if (day) day.pageViews += 1;
        } else if (event.eventName === 'PROJECT_VIEW') summary.projectViews += 1;
        else if (event.eventName === 'PROJECT_CLICK') {
          summary.projectClicks += 1;
          if (day) day.projectClicks += 1;
        } else if (event.eventName === 'ASSISTANT_QUESTION') summary.assistantQuestions += 1;
        else if (event.eventName === 'PORTFOLIO_APP_OPEN') {
          const appId = String(event.metadata?.appId || 'unknown');
          const app = apps.get(appId) || { appId, appName: String(event.metadata?.appName || appId), count: 0 };
          app.count += 1;
          apps.set(appId, app);
        }
        if (event.eventName === 'PROJECT_VIEW' || event.eventName === 'PROJECT_CLICK') {
          const projectId = String(event.metadata?.projectId || '');
          if (!projectId) continue;
          const project = projects.get(projectId) || {
            projectId,
            projectTitle: String(event.metadata?.projectTitle || 'Untitled project'),
            views: 0,
            clicks: 0,
          };
          if (event.eventName === 'PROJECT_VIEW') project.views += 1;
          else project.clicks += 1;
          projects.set(projectId, project);
        }
      }
      summary.uniqueVisitors = visitors.size;
      summary.chatEngagementRate = visitors.size
        ? Math.round((assistantVisitors.size / visitors.size) * 1000) / 10
        : 0;
      topProjects = Array.from(projects.values()).sort((a, b) => b.views - a.views || b.clicks - a.clicks);
      appOpenCounts = Array.from(apps.values()).sort((a, b) => b.count - a.count);
      const appEvents = events.filter((event) => event.eventName === 'PORTFOLIO_APP_OPEN')
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      recentAppOpensTotal = appEvents.length;
      recentAppOpens = appEvents.slice((recentPage - 1) * recentLimit, recentPage * recentLimit);
    }

    res.json({
      success: true,
      retention: 'until-reset',
      summary: {
        ...summary,
        leads: leadCount,
        unreadLeads: unreadLeadCount,
      },
      topProjects,
      dailyActivity: activity,
      appOpenCounts,
      recentAppOpens,
      recentAppOpensPagination: {
        page: recentPage,
        limit: recentLimit,
        total: recentAppOpensTotal,
        totalPages: Math.ceil(recentAppOpensTotal / recentLimit) || 1,
      },
    });
  } catch (error) {
    console.error('[Analytics] Dashboard summary could not be loaded:', error);
    res.status(500).json({ success: false, error: 'Analytics summary could not be loaded.' });
  }
});

/**
 * DELETE /api/analytics/reset
 * Protected: Clears portfolio analytics while preserving contact messages and system logs.
 */
analyticsRouter.delete('/reset', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const deletedCount = mongoose.connection.readyState === 1
      ? (await AnalyticsModel.deleteMany({ eventName: { $in: dashboardEventNames } })).deletedCount
      : db.analytics.filter((event) => dashboardEventNames.includes(event.eventName)).length;
    db.analytics = db.analytics.filter((event) => !dashboardEventNames.includes(event.eventName));
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('[Analytics] Analytics could not be reset:', error);
    res.status(500).json({ success: false, error: 'Analytics could not be reset.' });
  }
});

/**
 * POST /api/analytics/track
 * Client event tracking with strict secret redaction
 */
analyticsRouter.post('/track', trackLimiter, async (req: Request, res: Response) => {
  const { eventId, eventName, category, metadata, page } = req.body || {};
  const allowedEvents = ['PORTFOLIO_PAGE_VIEW', 'PROJECT_CLICK', 'PROJECT_VIEW', 'PORTFOLIO_APP_OPEN'];
  if (typeof eventName !== 'string' || !allowedEvents.includes(eventName)) {
    res.status(400).json({ success: false, error: 'Unsupported analytics event.' });
    return;
  }

  if (typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(eventId)) {
    res.status(400).json({ success: false, error: 'A valid analytics event ID is required.' });
    return;
  }

  const sourceMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const allowedMetadataKeys = eventName === 'PORTFOLIO_APP_OPEN'
    ? ['visitorId', 'appId', 'appName']
    : eventName === 'PROJECT_CLICK' || eventName === 'PROJECT_VIEW'
      ? ['visitorId', 'projectId', 'projectTitle']
      : ['visitorId', 'appId', 'appName'];
  const minimalMetadata: Record<string, unknown> = {};
  for (const key of allowedMetadataKeys) {
    const value = sourceMetadata[key];
    if (typeof value === 'string' && value.trim()) minimalMetadata[key] = value.slice(0, 120);
  }
  if (
    (eventName === 'PORTFOLIO_APP_OPEN' && typeof minimalMetadata.appId !== 'string') ||
    ((eventName === 'PROJECT_CLICK' || eventName === 'PROJECT_VIEW') && typeof minimalMetadata.projectId !== 'string')
  ) {
    res.status(400).json({ success: false, error: 'The app or project ID is required for this event.' });
    return;
  }

  const event: AnalyticsEvent = {
    id: eventId,
    eventName: eventName.slice(0, 100),
    page: page ? String(page).slice(0, 200) : '/',
    category: ['navigation', 'interaction', 'auth', 'api', 'system'].includes(category)
      ? category
      : 'interaction',
    metadata: sanitizeLogData(minimalMetadata),
    ipAddress: 'not-collected',
    userAgent: '',
    timestamp: new Date().toISOString(),
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const result = await AnalyticsModel.updateOne(
        { id: event.id },
        { $setOnInsert: event },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        db.analytics.unshift(event);
      }
      res.status(result.upsertedCount > 0 ? 201 : 200).json({
        success: true,
        eventId: event.id,
        duplicate: result.upsertedCount === 0,
        timestamp: result.upsertedCount > 0
          ? event.timestamp
          : await AnalyticsModel.findOne({ id: event.id }).select('timestamp').then((saved) => saved?.timestamp),
      });
    } catch (error) {
      console.error('[Analytics] Event could not be persisted:', error);
      res.status(503).json({ success: false, error: 'Analytics event could not be saved.' });
    }
    return;
  }

  const existing = db.analytics.find((saved) => saved.id === event.id);
  if (existing) {
    res.status(200).json({ success: true, eventId: event.id, duplicate: true, timestamp: existing.timestamp });
    return;
  }
  db.analytics.unshift(event);
  res.status(201).json({ success: true, eventId: event.id, duplicate: false, timestamp: event.timestamp });
});

/**
 * GET /api/analytics/logs
 * Protected: Portfolio interaction history only; excludes server/system telemetry.
 */
analyticsRouter.get('/logs', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { category, search, page = '1', limit = '50' } = req.query;

  const result = db.getAnalyticsLogsFiltered({
    category: category ? String(category) : undefined,
    search: search ? String(search) : undefined,
    page: parseInt(page as string, 10) || 1,
    limit: parseInt(limit as string, 10) || 50,
  });

  const portfolioLogs = result.items.filter((event) => ['PORTFOLIO_PAGE_VIEW', 'PROJECT_VIEW', 'PROJECT_CLICK', 'PORTFOLIO_APP_OPEN'].includes(event.eventName));
  res.json({
    success: true,
    count: portfolioLogs.length,
    total: portfolioLogs.length,
    logs: portfolioLogs,
    pagination: {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      total: result.total,
    },
  });
});
