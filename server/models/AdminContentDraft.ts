import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminContentDraft extends Document {
  key: string;
  content: Record<string, unknown>;
  updatedBy: string;
  updatedAt: Date;
}

const AdminContentDraftSchema = new Schema<IAdminContentDraft>(
  {
    key: { type: String, required: true, unique: true, default: 'primary_portfolio_content' },
    content: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const AdminContentDraftModel: mongoose.Model<IAdminContentDraft> =
  (mongoose.models.AdminContentDraft as mongoose.Model<IAdminContentDraft>) ||
  mongoose.model<IAdminContentDraft>('AdminContentDraft', AdminContentDraftSchema);