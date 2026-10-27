import mongoose, { Schema, Document } from 'mongoose';
import type { ProjectData } from '../db/database';

export interface IAdminProjectDraft extends Document {
  key: string;
  projects: ProjectData[];
  updatedBy: string;
  updatedAt: Date;
}

const AdminProjectDraftSchema = new Schema<IAdminProjectDraft>(
  {
    key: { type: String, required: true, unique: true, default: 'primary_portfolio_projects' },
    projects: { type: Schema.Types.Mixed, required: true, default: [] },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const AdminProjectDraftModel: mongoose.Model<IAdminProjectDraft> =
  (mongoose.models.AdminProjectDraft as mongoose.Model<IAdminProjectDraft>) ||
  mongoose.model<IAdminProjectDraft>('AdminProjectDraft', AdminProjectDraftSchema);
