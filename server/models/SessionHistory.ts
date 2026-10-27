import mongoose, { Document, Model, Schema } from 'mongoose';

export type SessionEndReason = 'logout' | 'revoked' | 'expired';

export interface ISessionHistory extends Document {
  sessionIdHash: string;
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  loginAt: Date;
  expiresAt: Date;
  logoutAt?: Date | null;
  endReason?: SessionEndReason;
}

const SessionHistorySchema = new Schema<ISessionHistory>(
  {
    sessionIdHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true },
    role: { type: String, enum: ['admin', 'user', 'guest'], required: true },
    loginAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true },
    logoutAt: { type: Date, default: null },
    endReason: { type: String, enum: ['logout', 'revoked', 'expired'] },
  },
  { versionKey: false }
);

SessionHistorySchema.index({ loginAt: -1, _id: -1 });

export const SessionHistoryModel: Model<ISessionHistory> =
  (mongoose.models.SessionHistory as Model<ISessionHistory>) ||
  mongoose.model<ISessionHistory>('SessionHistory', SessionHistorySchema);
