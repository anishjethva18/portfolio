import { Router, Request, Response } from 'express';
import { contactRateLimiter } from '../middleware/rateLimiter';
import { validateContactInput } from '../middleware/validation';
import { emailService, contactDb } from '../services/emailService';
import { getEmailConfig } from '../config/emailConfig';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/database';

const router = Router();

/**
 * POST /api/contact
 * Primary contact form submission endpoint with validation, rate limiting, and persistence
 */
router.post(
  ['/', ''],
  contactRateLimiter,
  validateContactInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await emailService.handleContactSubmission(req.body, req.get('origin') || '');
      res.status(200).json(result);
    } catch (error: any) {
      console.error('[Contact Route] Unhandled exception:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your message. Please try again later.',
      });
    }
  }
);

/**
 * GET /api/contact/health
 * Checks contact service status, active email provider, configuration diagnostics, and total stored messages
 */
router.get('/health', (req: Request, res: Response): void => {
  const config = getEmailConfig();
  res.json({
    status: 'online',
    provider: config.provider,
    receiverEmail: config.receiverEmail,
    totalMessagesStored: contactDb.getCount(),
    diagnostics: config.diagnosticDetails,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/contact/history
 * Protected: Returns submitted messages with search, status filtering, sorting & pagination (Admin Only)
 */
router.get('/history', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const {
    status,
    search,
    sortBy,
    order,
    page = '1',
    limit = '50',
  } = req.query;

  const result = db.getContactsFiltered({
    status: status ? String(status) : undefined,
    search: search ? String(search) : undefined,
    sortBy: sortBy ? String(sortBy) : 'timestamp',
    order: order === 'asc' ? 'asc' : 'desc',
    page: parseInt(page as string, 10) || 1,
    limit: parseInt(limit as string, 10) || 50,
  });

  res.json({
    success: true,
    count: result.items.length,
    total: result.total,
    messages: result.items,
    pagination: {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      total: result.total,
    },
  });
});

/**
 * GET /api/contact/:id
 * Protected: Retrieve single message detail (Admin Only)
 */
router.get('/:id', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const contact = db.getContactById(id);

  if (!contact) {
    res.status(404).json({ success: false, error: 'Inquiry not found' });
    return;
  }

  res.json({ success: true, contact });
});

/**
 * PATCH /api/contact/:id/status
 * Protected: Update inquiry status, notes, or reply flag (Admin Only)
 */
router.patch('/:id/status', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { status, notes, replied } = req.body;

  const updated = db.updateContactStatus(id, {
    status,
    notes,
    replied,
  });

  if (!updated) {
    res.status(404).json({ success: false, error: 'Inquiry not found' });
    return;
  }

  res.json({ success: true, contact: updated });
});

/**
 * DELETE /api/contact/:id
 * Protected: Delete inquiry from database (Admin Only)
 */
router.delete('/:id', requireAdmin, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const deleted = db.deleteContact(id);

  if (!deleted) {
    res.status(404).json({ success: false, error: 'Inquiry not found' });
    return;
  }

  res.json({ success: true, message: 'Inquiry deleted successfully' });
});

export default router;
