import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
  id: string;
  userId?: string;
  eventName: string;
  page?: string;
  category: 'navigation' | 'interaction' | 'auth' | 'api' | 'system';
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

const AnalyticsSchema = new Schema<IAnalytics>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    eventName: { type: String, required: true, index: true },
    page: { type: String },
    category: {
      type: String,
      enum: ['navigation', 'interaction', 'auth', 'api', 'system'],
      default: 'system',
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: '' },
    timestamp: { type: String, default: () => new Date().toISOString(), index: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

AnalyticsSchema.index({ category: 1, timestamp: -1 });
AnalyticsSchema.index({ eventName: 1, timestamp: -1 });
AnalyticsSchema.index({ 'metadata.appId': 1, timestamp: -1 });
AnalyticsSchema.index({ 'metadata.projectId': 1, eventName: 1, timestamp: -1 });
export const AnalyticsModel: mongoose.Model<IAnalytics> =
  (mongoose.models.Analytics as mongoose.Model<IAnalytics>) ||
  mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);

export async function retainAnalyticsUntilReset(): Promise<void> {
  await AnalyticsModel.init();
  const indexes = await AnalyticsModel.collection.indexes();
  for (const index of indexes) {
    if (index.key?.expiresAt !== 1 || index.expireAfterSeconds === undefined || !index.name) continue;
    await AnalyticsModel.collection.dropIndex(index.name);
  }
}
