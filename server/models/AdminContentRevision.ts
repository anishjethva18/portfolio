import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminContentRevision extends Document {
  key: string;
  content: Record<string, unknown>;
  projects?: Record<string, unknown>[];
  publishedBy: string;
  publishedAt: Date;
}

const AdminContentRevisionSchema = new Schema<IAdminContentRevision>(
  {
    key: { type: String, required: true, default: 'primary_portfolio_content', index: true },
    content: { type: Schema.Types.Mixed, required: true },
    projects: { type: Schema.Types.Mixed, default: undefined },
    publishedBy: { type: String, required: true },
    publishedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: false, versionKey: false }
);

AdminContentRevisionSchema.index({ key: 1, publishedAt: -1 });

export const AdminContentRevisionModel: mongoose.Model<IAdminContentRevision> =
  (mongoose.models.AdminContentRevision as mongoose.Model<IAdminContentRevision>) ||
  mongoose.model<IAdminContentRevision>('AdminContentRevision', AdminContentRevisionSchema);
