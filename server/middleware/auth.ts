import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/sessionService';

export interface UserSessionPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

export interface AuthenticatedRequest extends Request {
  user?: UserSessionPayload;
  sessionInfo?: {
    sessionId: string;
    csrfToken: string;
    userId: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
    expiresAt: Date;
  };
}

function refreshSessionCookies(
  res: Response,
  session: NonNullable<Awaited<ReturnType<typeof sessionService.validateSession>>>,
  sessionId: string
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const sidCookieName = isProd ? '__Host-sid' : 'sid';
  const maxAge = Math.max(1, session.expiresAt.getTime() - Date.now());
  const options = { secure: isProd, sameSite: 'lax' as const, maxAge, path: '/' };

  res.cookie(sidCookieName, sessionId, { ...options, httpOnly: true });
  res.cookie('csrfToken', session.csrfToken, { ...options, httpOnly: false });
}

/**
 * Extract session identifier from cookie (primary) or header
 */
export function extractSessionId(req: Request): string | undefined {
  const sidCookieName = process.env.NODE_ENV === 'production' ? '__Host-sid' : 'sid';
  return req.cookies?.[sidCookieName];
}

/**
 * Require valid server-side session authentication
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.user && req.sessionInfo) {
    next();
    return;
  }
  const sessionId = extractSessionId(req);

  if (!sessionId) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      message: 'Please sign in to access this resource.',
    });
    return;
  }

  let session;
  try {
    session = await sessionService.validateSession(sessionId);
  } catch {
    res.status(503).json({ error: 'Authentication service unavailable', code: 'AUTH_STORAGE_UNAVAILABLE' });
    return;
  }
  if (!session) {
    res.status(401).json({
      error: 'Invalid or expired session',
      code: 'INVALID_SESSION',
      message: 'Your session has expired. Please sign in again.',
    });
    return;
  }

  req.user = {
    userId: session.userId,
    email: session.email,
    role: session.role,
  };
  req.sessionInfo = session;
  refreshSessionCookies(res, session, sessionId);

  next();
};

/** Attach a valid session when one is present without blocking public portfolio actions. */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.user && req.sessionInfo) {
    next();
    return;
  }
  const sessionId = extractSessionId(req);
  if (!sessionId) {
    next();
    return;
  }
  try {
    const session = await sessionService.validateSession(sessionId);
    if (session) {
      req.user = { userId: session.userId, email: session.email, role: session.role };
      req.sessionInfo = session;
      refreshSessionCookies(res, session, sessionId);
    }
  } catch {
    // Capture remains available to a visitor if optional session lookup is unavailable.
  }
  next();
};

/**
 * Require Authenticated User (rejects unauthenticated and guest role)
 */
export const requireUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  await requireAuth(req, res, () => {
    if (!req.user || req.user.role === 'guest') {
      res.status(403).json({
        error: 'Forbidden: Registered user account required',
        code: 'USER_ROLE_REQUIRED',
        message: 'Guest visitors are restricted to read-only operations for this resource.',
      });
      return;
    }
    next();
  });
};

/**
 * Require Admin role strictly on backend
 */
export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  await requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({
        error: 'Forbidden: Administrator privileges required',
        code: 'ADMIN_REQUIRED',
        message: 'You do not have sufficient permissions to access this administrative endpoint.',
      });
      return;
    }
    next();
  });
};

/**
 * Validate CSRF token on state-changing requests when session authentication is active
 */
export const validateCsrf = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateChangingMethods.includes(req.method)) {
    next();
    return;
  }

  // Public state-changing routes that do not require an active authenticated session
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/contact',
  ];

  if (publicPaths.includes(req.path) || req.path === '/api/contact' || req.path.startsWith('/api/contact/')) {
    next();
    return;
  }

  // Populate session if not already populated
  if (!req.sessionInfo) {
    const sessionId = extractSessionId(req);
    if (sessionId) {
      const session = await sessionService.validateSession(sessionId);
      if (session) {
        req.user = { userId: session.userId, email: session.email, role: session.role };
        req.sessionInfo = session;
        refreshSessionCookies(res, session, sessionId);
      }
    }
  }

  // If request has an active session, enforce CSRF token match
  if (req.sessionInfo) {
    const headerCsrf = req.headers['x-csrf-token'];
    const bodyCsrf = req.body?.csrfToken;
    const clientToken = (typeof headerCsrf === 'string' ? headerCsrf : bodyCsrf) || '';

    const expectedToken = Buffer.from(req.sessionInfo.csrfToken);
    const suppliedToken = Buffer.from(clientToken);
    if (expectedToken.length !== suppliedToken.length || !crypto.timingSafeEqual(expectedToken, suppliedToken)) {
      res.status(403).json({
        error: 'Invalid CSRF token',
        code: 'CSRF_INVALID',
        message: 'Security validation failed: CSRF token mismatch. Please reload the page.',
      });
      return;
    }
  }

  next();
};

/**
 * Check if the authenticated requester owns the resource or is admin
 */
export const isOwnerOrAdmin = (req: AuthenticatedRequest, resourceOwnerId?: string): boolean => {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return Boolean(resourceOwnerId && req.user.userId === resourceOwnerId);
};
