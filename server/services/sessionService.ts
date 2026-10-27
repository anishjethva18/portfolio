import crypto from 'crypto';
import { Request } from 'express';
import mongoose from 'mongoose';
import { SessionModel } from '../models/Session';
import { SessionHistoryModel, type SessionEndReason } from '../models/SessionHistory';
import { UserModel } from '../models/User';

export const SESSION_DURATION_MS = {
  standard: 15 * 60 * 1000,
  remembered: 15 * 60 * 1000,
} as const;

const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export interface ActiveSession {
  sessionIdHash: string;
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  csrfToken: string;
  userAgent: string;
  ipAddress: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

export class SessionService {
  constructor() {
    const timer = setInterval(() => {
      this.cleanupExpiredSessions().catch((error: unknown) => {
        console.error('[SessionService] Expired-session cleanup failed.', error);
      });
    }, 60 * 1000);
    if (timer.unref) timer.unref();
  }

  /**
   * Create a new secure server-side session with CSRF token
   */
  public async createSession(
    user: { id: string; email: string; role: 'admin' | 'user' | 'guest' },
    req?: Request,
    options?: { rememberMe?: boolean }
  ): Promise<{ sessionId: string; csrfToken: string; session: ActiveSession }> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const sessionIdHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');

    const ipAddress = req?.ip || req?.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req?.headers?.['user-agent'] || 'Unknown User-Agent';

    const duration = options?.rememberMe === true
      ? SESSION_DURATION_MS.remembered
      : SESSION_DURATION_MS.standard;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + duration);

    const sessionData: ActiveSession = {
      sessionIdHash,
      userId: user.id,
      email: user.email.toLowerCase().trim(),
      role: user.role,
      csrfToken,
      userAgent,
      ipAddress,
      createdAt,
      lastActiveAt: createdAt,
      expiresAt,
      isRevoked: false,
    };

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Authentication storage is unavailable. Please try again later.');
    }
    const { sessionIdHash: _sessionIdHash, ...storedSession } = sessionData;
    await SessionModel.create({ ...storedSession, sessionId: sessionIdHash });
    try {
      await SessionHistoryModel.create({
        sessionIdHash,
        userId: sessionData.userId,
        email: sessionData.email,
        role: sessionData.role,
        loginAt: sessionData.createdAt,
        expiresAt: sessionData.expiresAt,
      });
    } catch (error) {
      await SessionModel.deleteOne({ sessionId: sessionIdHash });
      throw error;
    }

    return { sessionId, csrfToken, session: sessionData };
  }

  /**
   * Validate session ID and verify not expired / revoked
   */
  public async validateSession(
    sessionId: string
  ): Promise<{ userId: string; email: string; role: 'admin' | 'user' | 'guest'; csrfToken: string; sessionId: string; expiresAt: Date } | null> {
    if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9]{64}$/i.test(sessionId)) {
      return null;
    }

    const now = new Date();
    if (mongoose.connection.readyState !== 1) return null;
    const sessionIdHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    let session: ActiveSession | null;
    try {
      const doc = await SessionModel.findOne({ sessionId: sessionIdHash, isRevoked: false, expiresAt: { $gt: now } }).lean();
      session = doc
        ? {
            sessionIdHash: doc.sessionId,
            userId: doc.userId,
            email: doc.email,
            role: doc.role,
            csrfToken: doc.csrfToken,
            userAgent: doc.userAgent || 'Unknown',
            ipAddress: doc.ipAddress || '127.0.0.1',
            createdAt: doc.createdAt,
            lastActiveAt: doc.lastActiveAt,
            expiresAt: doc.expiresAt,
            isRevoked: doc.isRevoked,
          }
        : null;
    } catch {
      return null;
    }
    if (!session) return null;

    const lastActive = new Date(session.lastActiveAt).getTime();
    if (now.getTime() - lastActive >= SESSION_IDLE_TIMEOUT_MS) {
      await this.revokeSession(sessionId, 'expired');
      return null;
    }

    let currentUser;
    try {
      currentUser = await UserModel.findOne({ id: session.userId }).select('email role disabled').lean();
    } catch {
      return null;
    }
    if (!currentUser || currentUser.disabled || currentUser.role !== session.role || currentUser.email.toLowerCase() !== session.email.toLowerCase()) {
      await this.revokeAllUserSessions(session.userId);
      return null;
    }

    if (now.getTime() - lastActive > 60 * 1000) {
      const expiresAt = new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS);
      await Promise.all([
        SessionModel.updateOne(
          { sessionId: sessionIdHash, isRevoked: false },
          { $set: { lastActiveAt: now, expiresAt } }
        ),
        SessionHistoryModel.updateOne(
          { sessionIdHash, logoutAt: null },
          { $set: { expiresAt } }
        ),
      ]);
      session.expiresAt = expiresAt;
    }

    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      csrfToken: session.csrfToken,
      sessionId: session.sessionIdHash,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Revoke an active session
   */
  public async revokeSession(sessionId: string, reason: SessionEndReason = 'logout'): Promise<boolean> {
    if (!sessionId) return false;
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Authentication storage is unavailable.');
    }
    const sessionIdHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    const endedAt = new Date();
    await SessionHistoryModel.updateOne(
      { sessionIdHash, logoutAt: null },
      { $set: { logoutAt: endedAt, endReason: reason } }
    );
    const result = await SessionModel.deleteOne({ sessionId: sessionIdHash });
    return result.deletedCount > 0;
  }

  /**
   * Invalidate all sessions for a user (e.g. after password reset / password change)
   */
  public async revokeAllUserSessions(userId: string): Promise<number> {
    if (!userId) return 0;

    if (mongoose.connection.readyState !== 1) throw new Error('Authentication storage is unavailable.');
    const endedAt = new Date();
    const activeSessions = await SessionModel.find({ userId }).select('sessionId').lean();
    if (activeSessions.length) {
      await SessionHistoryModel.updateMany(
        { sessionIdHash: { $in: activeSessions.map((session) => session.sessionId) }, logoutAt: null },
        { $set: { logoutAt: endedAt, endReason: 'revoked' } }
      );
    }
    const result = await SessionModel.deleteMany({ userId });
    return result.deletedCount || 0;
  }

  public async revokeOtherUserSessions(userId: string, currentSessionHash: string): Promise<number> {
    if (!userId || !/^[a-f0-9]{64}$/i.test(currentSessionHash)) {
      throw new Error('A valid current administrator session is required.');
    }
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Authentication storage is unavailable.');
    }
    const activeSessions = await SessionModel.find({
      userId,
      sessionId: { $ne: currentSessionHash },
    }).select('sessionId').lean();
    if (activeSessions.length) {
      await SessionHistoryModel.updateMany(
        { sessionIdHash: { $in: activeSessions.map((session) => session.sessionId) }, logoutAt: null },
        { $set: { logoutAt: new Date(), endReason: 'revoked' } }
      );
    }
    const result = await SessionModel.deleteMany({ userId, sessionId: { $ne: currentSessionHash } });
    return result.deletedCount || 0;
  }

  /**
   * Cleanup expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    if (mongoose.connection.readyState !== 1) return 0;
    const idleCutoff = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS);
    const inactiveSessions = await SessionModel.find({
      $or: [
        { expiresAt: { $lte: now } },
        { lastActiveAt: { $lte: idleCutoff } },
      ],
    }).select('sessionId').lean();
    const expiredSessionIds = inactiveSessions.map((session) => session.sessionId);
    if (expiredSessionIds.length) {
      await SessionHistoryModel.updateMany(
        { sessionIdHash: { $in: expiredSessionIds }, logoutAt: null },
        { $set: { logoutAt: now, endReason: 'expired' } }
      );
    }
    await SessionHistoryModel.updateMany(
      { expiresAt: { $lte: now }, logoutAt: null },
      [{ $set: { logoutAt: '$expiresAt', endReason: 'expired' } }],
      { updatePipeline: true }
    );
    const res = await SessionModel.deleteMany({
      $or: [
        { expiresAt: { $lte: now } },
        { lastActiveAt: { $lte: idleCutoff } },
        { isRevoked: true },
      ],
    });
    return res.deletedCount || 0;
  }

  public async getSessionHistory(page: number, limit: number) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Authentication storage is unavailable.');
    }
    const now = new Date();
    await SessionHistoryModel.updateMany(
      { expiresAt: { $lte: now }, logoutAt: null },
      [{ $set: { logoutAt: '$expiresAt', endReason: 'expired' } }],
      { updatePipeline: true }
    );
    const [total, sessions] = await Promise.all([
      SessionHistoryModel.countDocuments(),
      SessionHistoryModel.find()
        .select('userId email role loginAt logoutAt expiresAt endReason')
        .sort({ loginAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    return {
      sessions: sessions.map((session) => ({
        id: String(session._id),
        userId: session.userId,
        email: session.email,
        role: session.role,
        loginAt: session.loginAt,
        logoutAt: session.logoutAt || null,
        expiresAt: session.expiresAt,
        endReason: session.endReason || null,
        active: !session.logoutAt && session.expiresAt > now,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}

export const sessionService = new SessionService();
