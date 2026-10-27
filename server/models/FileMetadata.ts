import mongoose, { Schema, Document } from 'mongoose';

export interface IFileMetadata extends Document {
  id: string;
  userId?: string;
  name: string;
  path: string;
  parentId: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: string;
  sizeBytes?: number;
  modified: string;
  url?: string;
  diskPath?: string;
  storageCategory?: 'resume' | 'profile' | 'certificates' | 'project';
  content?: string;
  contentEncoding?: 'base64';
  uploadedAt: string;
}

const FileMetadataSchema = new Schema<IFileMetadata>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    path: { type: String, required: true, index: true },
    parentId: { type: String, required: true, index: true },
    type: { type: String, enum: ['file', 'folder'], default: 'file', index: true },
    extension: { type: String, index: true },
    size: { type: String, default: '0 KB' },
    sizeBytes: { type: Number, default: 0 },
    modified: { type: String, default: () => new Date().toISOString() },
    url: { type: String },
    diskPath: { type: String },
    storageCategory: { type: String, enum: ['resume', 'profile', 'certificates', 'project'] },
    content: { type: String },
    contentEncoding: { type: String, enum: ['base64'] },
    uploadedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    collection: 'filemetadata',
    timestamps: false,
    versionKey: false,
  }
);

FileMetadataSchema.index({ userId: 1, path: 1 });
FileMetadataSchema.index({ userId: 1, parentId: 1 });

export const FileMetadataModel: mongoose.Model<IFileMetadata> =
  (mongoose.models.FileMetadata as mongoose.Model<IFileMetadata>) ||
  mongoose.model<IFileMetadata>('FileMetadata', FileMetadataSchema);
