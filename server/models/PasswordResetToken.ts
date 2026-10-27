import mongoose, { Schema, Document } from 'mongoose';

export interface IPasswordResetToken extends Document {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    used: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  }
);

export const PasswordResetTokenModel: mongoose.Model<IPasswordResetToken> =
  (mongoose.models.PasswordResetToken as mongoose.Model<IPasswordResetToken>) ||
  mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);
