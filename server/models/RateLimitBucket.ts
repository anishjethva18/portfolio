import mongoose, { Document, Schema } from 'mongoose';

export interface IRateLimitBucket extends Document {
  bucketId: string;
  count: number;
  expiresAt: Date;
}

const RateLimitBucketSchema = new Schema<IRateLimitBucket>(
  {
    bucketId: { type: String, required: true, unique: true },
    count: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
  },
);

RateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitBucketModel: mongoose.Model<IRateLimitBucket> =
  (mongoose.models.RateLimitBucket as mongoose.Model<IRateLimitBucket>) ||
  mongoose.model<IRateLimitBucket>('RateLimitBucket', RateLimitBucketSchema);
