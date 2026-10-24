import { Router, Response } from 'express';
import { authService } from '../services/authService';
import { sessionService, SESSION_DURATION_MS } from '../services/sessionService';
import { requireAuth, requireAdmin, validateCsrf, AuthenticatedRequest, extractSessionId } from '../middleware/auth';
import { createRateLimiter } from '../middleware/security';

export const authRouter = Router();

const authRateLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

const passwordResetLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many password reset requests. Please try again in 15 minutes.',
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Helper to set secure session and anti-CSRF cookies
 */
function setSessionCookies(res: Response, sessionId: string, csrfToken: string, rememberMe = false) {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = rememberMe ? SESSION_DURATION_MS.remembered : SESSION_DURATION_MS.standard;
  const sidCookieName = isProd ? '__Host-sid' : 'sid';

  res.cookie(sidCookieName, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  // The double-submit token must be readable by the browser API client; the session stays HttpOnly.
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

function clearSessionCookies(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = { path: '/', httpOnly: true, secure: isProd, sameSite: 'lax' as const };
  res.clearCookie(isProd ? '__Host-sid' : 'sid', cookieOptions);
  res.clearCookie('csrfToken', cookieOptions);
}

/**
 * POST /api/auth/login
 * Server-side session login with rate limiting & brute-force protection
 */
authRouter.post('/login', authRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (
      typeof email !== 'string' ||
      email.length > 254 ||
      !EMAIL_REGEX.test(email.trim()) ||
      typeof password !== 'string' ||
      password.length === 0 ||
      password.length > 1024
    ) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const shouldRememberSession = rememberMe === true;
    const result = await authService.login(email, password, req, { rememberMe: shouldRememberSession });

    // Set secure cookies
    setSessionCookies(res, result.sessionId, result.csrfToken, shouldRememberSession);

    res.json({
      success: true,
      user: result.user,
      csrfToken: result.csrfToken,
      message: 'Logged in successfully',
    });
  } catch (error: any) {
    res.status(401).json({ success: false, error: error.message || 'Invalid email or password' });
  }
});

/**
 * GET /api/auth/me
 * Retrieve current user profile and CSRF token from server-side session
 */
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const user = authService.getUserById(req.user.userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User record not found' });
    return;
  }

  res.json({
    success: true,
    user,
    csrfToken: req.sessionInfo?.csrfToken,
  });
});

/**
 * POST /api/auth/logout
 * Revoke server-side session and clear cookies
 */
authRouter.post('/logout', requireAdmin, validateCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = extractSessionId(req);
    if (!sessionId) {
      res.status(401).json({ success: false, error: 'Administrator session is required.' });
      return;
    }
    await sessionService.revokeSession(sessionId);
    clearSessionCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch {
    res.status(503).json({ success: false, error: 'Authentication service is temporarily unavailable.' });
  }
});

/**
 * POST /api/auth/unlock
 * Unlock desktop session
 */
authRouter.post('/unlock', authRateLimiter, requireAdmin, validateCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password } = req.body;

    if (typeof password !== 'string' || !password) {
      res.status(400).json({ success: false, error: 'Password is required to unlock desktop session.' });
      return;
    }

    const valid = await authService.verifyAdminPassword(req.user!.userId, password);
    if (!valid) {
      res.status(401).json({ success: false, error: 'The administrator password is incorrect.' });
      return;
    }

    res.json({ success: true, message: 'Desktop unlocked successfully' });
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message || 'The password or PIN is incorrect. Try again.' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Send a secure, expiring password reset link to an administrator's email
 */
authRouter.post('/forgot-password', passwordResetLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ success: false, error: 'A valid email address is required' });
      return;
    }

    await authService.requestPasswordReset(email, req.get('origin') || '');
    res.json({
      success: true,
      message: 'If an administrator account matches that email address, a password reset link will be sent.',
    });
  } catch {
    res.status(503).json({ success: false, error: 'Password reset is temporarily unavailable.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using single-use cryptographically secure token
 */
authRouter.post('/reset-password', passwordResetLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ success: false, error: 'Token and new password are required' });
      return;
    }

    await authService.resetPassword(token, newPassword);

    // Clear any existing cookies since all sessions were invalidated
    clearSessionCookies(res);

    res.json({
      success: true,
      message: 'Password has been reset successfully. All previous sessions were logged out. Please sign in.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to reset password' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated administrator
 */
authRouter.post('/change-password', requireAdmin, validateCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Current password and new password are required' });
      return;
    }

    await authService.changePassword(req.user!.userId, currentPassword, newPassword);

    // Issue a fresh session for the current client
    const user = authService.getUserById(req.user!.userId);
    if (user) {
      const result = await sessionService.createSession(user, req);
      setSessionCookies(res, result.sessionId, result.csrfToken);
    }

    res.json({
      success: true,
      message: 'Password changed successfully. Other device sessions have been invalidated.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to update password' });
  }
});

/**
 * POST /api/auth/change-email
 * Change administrator email address with password verification
 */
authRouter.post('/change-email', requireAdmin, validateCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, newEmail } = req.body;
    if (!password || !newEmail || !EMAIL_REGEX.test(newEmail.trim())) {
      res.status(400).json({ success: false, error: 'Valid password and new email address are required' });
      return;
    }

    await authService.changeAdminEmail(req.user!.userId, password, newEmail);

    res.json({
      success: true,
      message: 'Administrator email updated successfully.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to update email address' });
  }
});

/**
 * PUT /api/auth/profile
 * Update authenticated user profile
 */
authRouter.put('/profile', requireAuth, validateCsrf, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, bio, avatar, settings } = req.body;
    const updated = authService.updateUserProfile(req.user!.userId, { name, bio, avatar, settings });

    res.json({
      success: true,
      user: updated,
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Could not update profile' });
  }
});

/**
 * GET /api/auth/users
 * Administrator-only user management directory
 */
authRouter.get('/users', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const users = authService.getAllUsers();
  res.json({
    success: true,
    count: users.length,
    users,
  });
});
