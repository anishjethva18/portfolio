import mongoose, { Schema, Document } from 'mongoose';

export interface IRevokedToken extends Document {
  token: string;
  revokedAt: Date;
}

const RevokedTokenSchema = new Schema<IRevokedToken>(
  {
    token: { type: String, required: true, unique: true, index: true },
    revokedAt: { type: Date, default: Date.now, expires: '7d' }, // Automatically TTL clean up after 7 days
  },
  {
    versionKey: false,
  }
);

export const RevokedTokenModel: mongoose.Model<IRevokedToken> =
  (mongoose.models.RevokedToken as mongoose.Model<IRevokedToken>) ||
  mongoose.model<IRevokedToken>('RevokedToken', RevokedTokenSchema);
