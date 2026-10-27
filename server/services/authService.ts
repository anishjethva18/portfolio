import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { db, User } from '../db/database';
import { UserModel, PasswordResetTokenModel } from '../models';
import { getAuthConfig } from '../config/authConfig';
import { sessionService, ActiveSession } from './sessionService';
import { emailService } from './emailService';
import { Request } from 'express';

interface LoginAttemptRecord {
  failedAttempts: number;
  lockUntil?: number;
}

function minimumAdminPasswordLength(): number {
  return 8;
}

export class AuthService {
  // In-memory brute-force protection map (email -> attempt record)
  private loginAttempts = new Map<string, LoginAttemptRecord>();

  /**
   * Hash passwords with Argon2id using memory-hard production parameters.
   */
  public async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
  * Verify current Argon2id hashes and transparently migrate legacy bcrypt hashes.
   */
  public async comparePassword(plain: string, hashed: string): Promise<boolean> {
    if (!plain || !hashed) return false;
    try {
      if (hashed.startsWith('$argon2id$')) return await argon2.verify(hashed, plain);
      if (/^\$2[aby]\$/.test(hashed)) return await bcrypt.compare(plain, hashed);
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if an account is temporarily locked due to repeated failed logins
   */
  public checkBruteForceLock(email: string): { isLocked: boolean; retryAfterSec?: number } {
    const key = email.toLowerCase().trim();
    const record = this.loginAttempts.get(key);
    if (!record || !record.lockUntil) {
      return { isLocked: false };
    }

    const now = Date.now();
    if (now < record.lockUntil) {
      const retryAfterSec = Math.ceil((record.lockUntil - now) / 1000);
      return { isLocked: true, retryAfterSec };
    }

    // Lock expired; clear lock
    this.loginAttempts.delete(key);
    return { isLocked: false };
  }

  /**
   * Record a failed login attempt; lock if limit reached (5 attempts -> 15 min lock)
   */
  public recordFailedLogin(email: string): void {
    const key = email.toLowerCase().trim();
    const record = this.loginAttempts.get(key) || { failedAttempts: 0 };
    record.failedAttempts += 1;

    if (record.failedAttempts >= 5) {
      record.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
      console.warn(`[Security Alert] Account ${key} temporarily locked due to 5 consecutive failed login attempts.`);
    }

    this.loginAttempts.set(key, record);
  }

  /**
   * Reset failed login counter on successful authentication
   */
  public resetFailedLogin(email: string): void {
    const key = email.toLowerCase().trim();
    this.loginAttempts.delete(key);
  }

  /**
   * Server-side session login with email and password
   */
  public async login(
    email: string,
    password: string,
    req?: Request,
    options?: { rememberMe?: boolean }
  ): Promise<{ user: Omit<User, 'passwordHash'>; sessionId: string; csrfToken: string; session: ActiveSession }> {
    const normalizedEmail = email.toLowerCase().trim();
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();

    if (process.env.NODE_ENV === 'production' && configuredAdminEmail && normalizedEmail !== configuredAdminEmail) {
      this.recordFailedLogin(normalizedEmail);
      throw new Error('Invalid email or password');
    }

    // 1. Check brute-force lockout
    const lockStatus = this.checkBruteForceLock(normalizedEmail);
    if (lockStatus.isLocked) {
      throw new Error(
        `Account is temporarily locked due to excessive failed attempts. Please try again in ${Math.ceil(
          (lockStatus.retryAfterSec || 60) / 60
        )} minute(s).`
      );
    }

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Authentication storage is unavailable. Please try again later.');
    }
    const mongoUser = await UserModel.findOne({ email: normalizedEmail, role: 'admin', disabled: { $ne: true } }).lean();
    const user = mongoUser as User | null;

    if (!user || user.disabled) {
      this.recordFailedLogin(normalizedEmail);
      throw new Error('Invalid email or password');
    }

    // 3. Verify password
    const isMatch = await this.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      this.recordFailedLogin(normalizedEmail);
      throw new Error('Invalid email or password');
    }

    if (user.passwordHash.startsWith('$2')) {
      user.passwordHash = await this.hashPassword(password);
      user.updatedAt = new Date().toISOString();
      await UserModel.updateOne({ id: user.id }, { $set: { passwordHash: user.passwordHash, updatedAt: user.updatedAt } });
    }

    // 4. Success: Reset brute-force counter
    this.resetFailedLogin(normalizedEmail);

    // Update last login timestamp
    user.lastLogin = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    db.users.set(user.id, user);
    await UserModel.updateOne(
      { id: user.id },
      { $set: { lastLogin: user.lastLogin, updatedAt: user.updatedAt } }
    );

    // 5. Create secure server-side session
    const { sessionId, csrfToken, session } = await sessionService.createSession(user, req, options);
    const { passwordHash: _, ...safeUser } = user;

    return { user: safeUser, sessionId, csrfToken, session };
  }

  /**
   * Send a single-use 15-minute password reset link to an administrator.
   */
  public async requestPasswordReset(email: string, requestPublicOrigin = ''): Promise<{ delivered: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Authentication storage is unavailable. Please try again later.');
    }
    const mongoUser = await UserModel.findOne({ email: normalizedEmail, role: 'admin', disabled: { $ne: true } }).lean();
    const user = mongoUser as User | null;

    if (!user || user.role !== 'admin' || user.disabled) {
      // Return generic status to prevent account enumeration
      return { delivered: false };
    }

    // Generate cryptographically secure random token (32 bytes = 64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const tokenRecord = {
      tokenHash,
      userId: user.id,
      email: user.email,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };

    await PasswordResetTokenModel.create(tokenRecord);

    const configuredAppUrl = process.env.APP_URL?.trim();
    const appUrl = configuredAppUrl && configuredAppUrl !== 'MY_APP_URL'
      ? configuredAppUrl
      : `http://localhost:${process.env.PORT || '3000'}`;
    const appOrigin = new URL(appUrl);
    if (appOrigin.protocol !== 'http:' && appOrigin.protocol !== 'https:') {
      throw new Error('APP_URL must use HTTP or HTTPS');
    }
    const resetUrl = new URL('/', appOrigin);
    resetUrl.searchParams.set('app', 'admin');
    resetUrl.hash = new URLSearchParams({ resetToken: rawToken }).toString();

    // Dispatch the secret only through the administrator's email link.
    let delivered = false;
    try {
      delivered = await emailService.sendPasswordResetEmail(user.email, resetUrl.toString(), requestPublicOrigin);
    } catch (err: any) {
      console.warn('[AuthService] Password reset email delivery error:', err.message);
    }

    if (!delivered) await PasswordResetTokenModel.deleteOne({ tokenHash });
    return { delivered };
  }

  /**
   * Reset password using single-use SHA-256 verified token and invalidate all user sessions
   */
  public async resetPassword(rawToken: string, newPassword: string): Promise<boolean> {
    const minPasswordLength = minimumAdminPasswordLength();
    if (!rawToken || !newPassword || newPassword.length < minPasswordLength || newPassword.length > 1024) {
      throw new Error(`A valid token and password of at least ${minPasswordLength} characters are required`);
    }
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Authentication storage is unavailable. Please try again later.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const record = await PasswordResetTokenModel.findOneAndUpdate(
      { tokenHash, used: false, expiresAt: { $gt: new Date() } },
      { $set: { used: true } },
      { returnDocument: 'before' }
    ).lean();
    if (!record) throw new Error('Invalid, expired, or already used password reset token');

    const user = await UserModel.findOne({
      id: record.userId,
      role: 'admin',
      disabled: { $ne: true },
    }).lean();
    if (!user) throw new Error('Administrator associated with reset token not found');

    const passwordHash = await this.hashPassword(newPassword);
    const updatedAt = new Date().toISOString();
    const updateResult = await UserModel.updateOne(
      { id: user.id, role: 'admin', disabled: { $ne: true } },
      { $set: { passwordHash, updatedAt } }
    );
    if (updateResult.matchedCount !== 1) throw new Error('Administrator account could not be updated');
    db.users.set(user.id, { ...(user as any), passwordHash, updatedAt });

    // Invalidate all active sessions for this user across all devices
    await sessionService.revokeAllUserSessions(user.id);
    console.log(`[Security] Password reset completed for ${user.email}. All sessions invalidated.`);

    return true;
  }

  public async verifyAdminPassword(userId: string, password: string): Promise<boolean> {
    if (mongoose.connection.readyState !== 1) return false;
    const user = await UserModel.findOne({ id: userId, role: 'admin', disabled: { $ne: true } }).lean() as User | null;
    if (!user || !(await this.comparePassword(password, user.passwordHash))) return false;

    if (user.passwordHash.startsWith('$2')) {
      user.passwordHash = await this.hashPassword(password);
      user.updatedAt = new Date().toISOString();
      await UserModel.updateOne({ id: user.id }, { $set: { passwordHash: user.passwordHash, updatedAt: user.updatedAt } });
      db.users.set(user.id, user);
    }
    return true;
  }

  /**
   * Change password for logged-in user with current password verification
   */
  public async changePassword(userId: string, currentPass: string, newPass: string, currentSessionHash?: string): Promise<boolean> {
    if (mongoose.connection.readyState !== 1) throw new Error('Authentication storage is unavailable.');
    const user = await UserModel.findOne({ id: userId, role: 'admin', disabled: { $ne: true } }).lean() as User | null;
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await this.comparePassword(currentPass, user.passwordHash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    const minPasswordLength = minimumAdminPasswordLength();
    if (!newPass || newPass.length < minPasswordLength || newPass.length > 1024) {
      throw new Error(`New password must be at least ${minPasswordLength} characters long`);
    }

    const passwordHash = await this.hashPassword(newPass);
    const updatedAt = new Date().toISOString();
    await UserModel.updateOne({ id: user.id }, { $set: { passwordHash, updatedAt } });
    db.users.set(user.id, { ...user, passwordHash, updatedAt });

    // Keep the current admin session alive for the in-panel password change;
    // the public auth flow omits this value and rotates into a fresh session.
    if (currentSessionHash) await sessionService.revokeOtherUserSessions(user.id, currentSessionHash);
    else await sessionService.revokeAllUserSessions(user.id);
    return true;
  }

  /**
   * Change admin email with password verification
   */
  public async changeAdminEmail(userId: string, password: string, newEmail: string): Promise<boolean> {
    if (mongoose.connection.readyState !== 1) throw new Error('Authentication storage is unavailable.');
    const user = await UserModel.findOne({ id: userId, role: 'admin', disabled: { $ne: true } }).lean() as User | null;
    if (!user || user.role !== 'admin') {
      throw new Error('Admin user not found');
    }

    const isMatch = await this.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Password verification failed');
    }

    const normalizedEmail = newEmail.toLowerCase().trim();
    if (process.env.NODE_ENV === 'production' && normalizedEmail !== getAuthConfig().adminEmail) {
      throw new Error('Set ADMIN_EMAIL to the new address before changing the administrator email.');
    }
    user.email = normalizedEmail;
    user.updatedAt = new Date().toISOString();
    await UserModel.updateOne({ id: user.id }, { $set: { email: normalizedEmail, updatedAt: user.updatedAt } });
    db.users.set(user.id, user);
    await sessionService.revokeAllUserSessions(user.id);

    return true;
  }

  /**
   * One-time administrator bootstrap CLI / Setup tool
   */
  public async bootstrapAdmin(
    email: string,
    pass: string,
    name = 'Anish Jethva',
    setupToken?: string
  ): Promise<Omit<User, 'passwordHash'>> {
    const config = getAuthConfig();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB is required to initialize the administrator.');
    }
    const minPasswordLength = minimumAdminPasswordLength();
    if (!email || !pass || pass.length < minPasswordLength || pass.length > 1024) {
      throw new Error(`A valid email and password of at least ${minPasswordLength} characters are required.`);
    }
    if (config.isProduction && !config.adminSetupToken) {
      throw new Error('ADMIN_SETUP_TOKEN must be configured for production bootstrap.');
    }
    if (config.adminSetupToken) {
      const expectedToken = Buffer.from(config.adminSetupToken);
      const receivedToken = Buffer.from(setupToken || '');
      if (expectedToken.length !== receivedToken.length || !crypto.timingSafeEqual(expectedToken, receivedToken)) {
        throw new Error('Invalid administrator setup token');
      }
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (config.isProduction && normalizedEmail !== config.adminEmail) {
      throw new Error('Administrator email must match ADMIN_EMAIL.');
    }
    if (config.isProduction) {
      const existingAdmin = await UserModel.exists({ role: 'admin' });
      if (existingAdmin) throw new Error('Production administrator is already initialized.');
    }

    const passwordHash = await this.hashPassword(pass);
    const adminUser: User = {
      id: 'usr_admin_anish',
      email: normalizedEmail,
      passwordHash,
      name,
      role: 'admin',
      avatar: '/avatar.png',
      bio: 'Full Stack & AI Engineer specializing in Next.js, Cloud Architectures & Windows UI Systems.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        theme: 'dark',
        wallpaper: 'bloom-dark',
        soundEnabled: true,
        accentColor: '#0078D4',
      },
    };

    await UserModel.updateOne({ id: adminUser.id }, { $set: adminUser }, { upsert: true });
    db.users.set(adminUser.id, adminUser);

    const { passwordHash: _, ...safeAdmin } = adminUser;
    return safeAdmin;
  }

  public getUserById(id: string): Omit<User, 'passwordHash'> | null {
    const user = db.users.get(id);
    if (!user) return null;
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  public getAllUsers(): Omit<User, 'passwordHash'>[] {
    return Array.from(db.users.values()).map((u) => {
      const { passwordHash: _, ...safe } = u;
      return safe;
    });
  }

  public updateUserProfile(id: string, updates: Partial<User>): Omit<User, 'passwordHash'> {
    const user = db.users.get(id);
    if (!user) throw new Error('User not found');

    if (updates.name) user.name = updates.name.trim();
    if (updates.bio !== undefined) user.bio = updates.bio;
    if (updates.avatar) user.avatar = updates.avatar;
    if (updates.settings) user.settings = { ...user.settings, ...updates.settings };
    user.updatedAt = new Date().toISOString();

    db.users.set(id, user);
    if (mongoose.connection.readyState === 1) {
      UserModel.updateOne({ id }, { $set: user }).catch(() => {});
    }

    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}

export const authService = new AuthService();
