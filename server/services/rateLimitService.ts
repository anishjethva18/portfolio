import { createHash } from 'node:crypto';
import { RateLimitBucketModel } from '../models/RateLimitBucket';

export interface RateLimitResult {
  count: number;
  resetAt: number;
}

export async function incrementSharedRateLimit(
  scope: string,
  identity: string,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  if (!scope || !identity || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error('Rate-limit scope, identity, and window must be valid.');
  }
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const bucketId = createHash('sha256')
    .update(`${scope}\0${identity}\0${windowStart}`)
    .digest('hex');
  const expiresAt = new Date(resetAt + Math.max(windowMs, 60_000));

  let bucket;
  try {
    bucket = await RateLimitBucketModel.findOneAndUpdate(
      { bucketId },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean();
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 11000
    ) {
      throw error;
    }
    await RateLimitBucketModel.updateOne({ bucketId }, { $inc: { count: 1 } });
    bucket = await RateLimitBucketModel.findOne({ bucketId }).lean();
  }

  if (!bucket) {
    throw new Error('Rate-limit counter could not be read after increment.');
  }
  return { count: bucket.count, resetAt };
}
