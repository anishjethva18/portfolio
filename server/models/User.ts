import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  disabled: boolean;
  avatar?: string;
  bio?: string;
  settings?: {
    theme?: 'light' | 'dark';
    wallpaper?: string;
    soundEnabled?: boolean;
    accentColor?: string;
  };
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'user', 'guest'], default: 'user', index: true },
    disabled: { type: Boolean, default: false, index: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    settings: {
      theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
      wallpaper: { type: String, default: 'custom' },
      soundEnabled: { type: Boolean, default: true },
      accentColor: { type: String, default: '#0078d4' },
    },
    lastLogin: { type: String },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Indexes
UserSchema.index({ email: 1, role: 1 });

export const UserModel: mongoose.Model<IUser> =
  (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
