import mongoose, { Document, Schema } from 'mongoose';

export interface SocialPreviewVariant {
  key: string;
  label: string;
  fileId: string;
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'webp';
  contentType: string;
  sizeBytes: number;
}

export interface ISocialPreviewAsset extends Document {
  originalId: string;
  originalName: string;
  originalFormat: string;
  originalContentType: string;
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
  originalSizeBytes: number;
  orientation: number;
  animated: boolean;
  variants: SocialPreviewVariant[];
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<SocialPreviewVariant>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    fileId: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    format: { type: String, enum: ['jpeg', 'png', 'webp'], required: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false },
);

const SocialPreviewAssetSchema = new Schema<ISocialPreviewAsset>(
  {
    originalId: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    originalFormat: { type: String, required: true },
    originalContentType: { type: String, required: true },
    originalWidth: { type: Number, required: true },
    originalHeight: { type: Number, required: true },
    displayWidth: { type: Number, required: true },
    displayHeight: { type: Number, required: true },
    originalSizeBytes: { type: Number, required: true },
    orientation: { type: Number, required: true },
    animated: { type: Boolean, default: false },
    variants: { type: [VariantSchema], default: [] },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

export const SocialPreviewAssetModel: mongoose.Model<ISocialPreviewAsset> =
  (mongoose.models.SocialPreviewAsset as mongoose.Model<ISocialPreviewAsset>) ||
  mongoose.model<ISocialPreviewAsset>('SocialPreviewAsset', SocialPreviewAssetSchema);
