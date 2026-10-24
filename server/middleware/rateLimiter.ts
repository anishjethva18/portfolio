import { createRateLimiter } from './security';

export const contactRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
  limitResponse: (retryAfterSeconds) => ({
    success: false,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Please wait ${Math.ceil(retryAfterSeconds / 60)} minute(s) before sending another message to prevent spam.`,
    retryAfter: retryAfterSeconds,
  }),
});
