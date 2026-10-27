import { Request, Response, NextFunction } from 'express';

export interface ValidatedContactBody {
  name: string;
  email: string;
  subject: string;
  message: string;
  attachments?: Array<{
    name: string;
    path?: string;
    size?: string;
    type?: string;
    content?: string;
  }>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

// Strict RFC 5322 regex for standard emails
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const validateContactInput = (req: Request, res: Response, next: NextFunction): void => {
  const { name, email, subject, message, _honeypot } = req.body || {};

  // 1. Anti-bot honeypot check: If the hidden honeypot field is filled, silently ignore or reject
  if (_honeypot && String(_honeypot).trim().length > 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid Submission',
      message: 'Bot submission detected.',
    });
    return;
  }

  const errors: Record<string, string> = {};

  // 2. Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.name = 'Please provide your name (at least 2 characters).';
  } else if (name.trim().length > 100) {
    errors.name = 'Name must be 100 characters or less.';
  }

  // 3. Email validation
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please provide a valid email address (e.g. name@example.com).';
  } else if (email.trim().length > 254) {
    errors.email = 'Email address is too long.';
  }

  // 4. Subject validation
  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
    errors.subject = 'Subject is required (at least 3 characters).';
  } else if (subject.trim().length > 200) {
    errors.subject = 'Subject must be 200 characters or less.';
  }

  // 5. Message length validation (min 10 chars, max 5000 chars)
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters long.';
  } else if (message.trim().length > 5000) {
    errors.message = 'Message must not exceed 5000 characters.';
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Please correct the highlighted fields.',
      errors,
    });
    return;
  }

  // Extract client IP and user-agent
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || '127.0.0.1';

  const userAgent = req.headers['user-agent'] || 'Unknown Browser';

  // Attach sanitized data
  req.body = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subject: subject.trim(),
    message: message.trim(),
    attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
    timestamp: new Date().toISOString(),
    ipAddress,
    userAgent,
  };

  next();
};
