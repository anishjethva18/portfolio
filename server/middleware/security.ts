import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { db, AnalyticsEvent } from '../db/database';
import { AnalyticsModel } from '../models';
import { incrementSharedRateLimit } from '../services/rateLimitService';

/**
 * IP Rate limiter middleware (e.g. 30 requests per 15 minutes for auth/sensitive APIs)
 */
export const createRateLimiter = (options: {
  maxRequests: number;
  windowMs: number;
  message?: string;
  limitResponse?: (retryAfterSeconds: number) => Record<string, unknown>;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const scope = req.originalUrl.split('?')[0];
    void incrementSharedRateLimit(scope, ip, options.windowMs).then(({ count, resetAt }) => {
      const now = Date.now();
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

      if (count > options.maxRequests) {
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(429).json(options.limitResponse?.(retryAfterSeconds) || {
          error: 'Too Many Requests',
          message: options.message || 'You have exceeded the rate limit. Please try again later.',
          retryAfterSeconds,
        });
        return;
      }
      next();
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`[RateLimiter] Shared MongoDB rate-limit storage failed: ${message}`);
      res.status(503).json({
        error: 'Rate-limit service unavailable',
        code: 'RATE_LIMIT_STORAGE_UNAVAILABLE',
        message: 'Request protection is temporarily unavailable. Please try again shortly.',
      });
    });
  };
};

const SENSITIVE_KEY_REGEX = /password|pass|token|secret|hash|authorization|auth|cookie|apikey|api_key|pin|bearer|jwt|session|credential|url/i;
const JWT_PATTERN = /^ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
const BCRYPT_PATTERN = /^\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/;
const BEARER_PATTERN = /^Bearer\s+ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/i;

/**
 * Recursively sanitize log data, masking passwords, tokens, hashes, and secrets
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 6 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    if (JWT_PATTERN.test(data) || BCRYPT_PATTERN.test(data) || BEARER_PATTERN.test(data)) {
      return '[REDACTED]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Telemetry and Analytics Request Logger with strict PII and Secret Redaction
 */
export const analyticsLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Only log API requests
    if (req.path.startsWith('/api/') && req.path !== '/api/health') {
      const sanitizedQuery = sanitizeLogData(req.query);

      const event: AnalyticsEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        eventName: `${req.method} ${req.path}`,
        page: req.path,
        category: req.path.startsWith('/api/auth')
          ? 'auth'
          : req.path.startsWith('/api/files')
          ? 'interaction'
          : 'api',
        metadata: {
          method: req.method,
          statusCode: res.statusCode,
          durationMs,
          query: sanitizedQuery,
        },
        ipAddress: ip.split(',')[0].trim(),
        userAgent,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      db.analytics.unshift(event);
      if (db.analytics.length > 500) db.analytics.pop();
      if (mongoose.connection.readyState === 1) {
        AnalyticsModel.create(event).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'unknown error';
          console.error(`[AnalyticsLogger] Failed to persist request analytics: ${message}`);
        });
      }
    }
  });

  next();
};
