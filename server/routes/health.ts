import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { windowsStorageService } from '../services/windowsStorageService';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { getEmailConfig } from '../config/emailConfig';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Windows 11 OS Portfolio Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/admin
 * Detailed runtime health is available only to the administrator.
 */
healthRouter.get('/admin', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const storageHealth = windowsStorageService.getHealth();
  const emailConfigured = Boolean(getEmailConfig().smtp);
  let databaseLatencyMs: number | null = null;
  if (isDbConnected && mongoose.connection.db) {
    try {
      const startedAt = Date.now();
      await mongoose.connection.db.admin().ping();
      databaseLatencyMs = Date.now() - startedAt;
    } catch {
      databaseLatencyMs = null;
    }
  }

  const isHealthy = isDbConnected && databaseLatencyMs !== null && storageHealth.status === 'healthy';

  res.status(isHealthy ? 200 : 207).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'Windows 11 OS Portfolio Server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    platform: process.platform,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: isDbConnected ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      latencyMs: databaseLatencyMs,
      host: mongoose.connection.host || 'embedded-memory-server',
      name: mongoose.connection.name || 'win11portfolio',
    },
    storage: {
      status: storageHealth.status,
      roots: {
        userCaptures: storageHealth.userCaptureRoot.exists,
        adminArchive: storageHealth.adminArchiveRoot.exists,
      },
      userCapturesExist: storageHealth.userCaptureRoot.exists,
      adminArchiveExist: storageHealth.adminArchiveRoot.exists,
    },
    email: { status: emailConfigured ? 'configured' : 'not-configured' },
    memory: {
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
});

/**
 * GET /api/health/storage
 * Detailed storage roots status
 */
healthRouter.get('/storage', requireAdmin, (req: Request, res: Response) => {
  const health = windowsStorageService.getHealth();
  res.json(health);
});

/**
 * GET /api/health/db
 * Database ping check
 */
healthRouter.get('/db', requireAdmin, async (req: Request, res: Response) => {
  const state = mongoose.connection.readyState;
  const statesMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  let pingSuccess = false;
  let latencyMs = -1;

  if (state === 1 && mongoose.connection.db) {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      latencyMs = Date.now() - start;
      pingSuccess = true;
    } catch {}
  }

  res.status(pingSuccess ? 200 : 503).json({
    status: pingSuccess ? 'ok' : 'error',
    readyState: statesMap[state] || 'unknown',
    latencyMs,
    timestamp: new Date().toISOString(),
  });
});
