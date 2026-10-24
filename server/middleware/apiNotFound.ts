import { Request, Response } from 'express';

export function apiNotFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: 'The requested API endpoint does not exist.',
  });
}
