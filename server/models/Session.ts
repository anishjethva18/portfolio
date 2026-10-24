import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession extends Document {
  sessionId: string;
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  csrfToken: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

const SessionSchema = new Schema<ISession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true },
    role: { type: String, enum: ['admin', 'user', 'guest'], default: 'user' },
    csrfToken: { type: String, required: true },
    userAgent: { type: String, default: 'Unknown' },
    ipAddress: { type: String, default: '127.0.0.1' },
    createdAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, expires: 0 },
    isRevoked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const SessionModel: Model<ISession> =
  (mongoose.models.Session as Model<ISession>) || mongoose.model<ISession>('Session', SessionSchema);
