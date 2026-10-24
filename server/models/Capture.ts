import mongoose, { Schema, Document } from 'mongoose';

export interface ICapture extends Document {
  id: string;
  userId: string;
  mediaType: 'photo' | 'video';
  fileName: string;
  userCapturePath: string;
  adminArchivePath: string;
  fileSize: number;
  userSaved: boolean;
  adminArchived: boolean;
  archiveExpiry: string;
  archiveConsentAt?: string;
  deleted: boolean;
  deletedAt?: string;
  error?: string;
  timestamp: string;
}

const CaptureSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    mediaType: { type: String, enum: ['photo', 'video'], required: true },
    fileName: { type: String, required: true },
    userCapturePath: { type: String, required: true },
    adminArchivePath: { type: String, required: true },
    fileSize: { type: Number, required: true, default: 0 },
    userSaved: { type: Boolean, default: true },
    adminArchived: { type: Boolean, default: true },
    archiveExpiry: { type: String, required: true },
    archiveConsentAt: { type: String },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: String },
    error: { type: String },
    timestamp: { type: String, required: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

CaptureSchema.index({ userId: 1, timestamp: -1 });
CaptureSchema.index({ deleted: 1, archiveExpiry: 1 });

export const CaptureModel: mongoose.Model<ICapture> =
  (mongoose.models.Capture as mongoose.Model<ICapture>) ||
  mongoose.model<ICapture>('Capture', CaptureSchema);
