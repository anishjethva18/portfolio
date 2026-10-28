import type { Response } from 'express';

export function setPortfolioMediaResourcePolicy(
  response: Pick<Response, 'setHeader'>,
  isPubliclyReferenced: boolean,
): void {
  response.setHeader('Cross-Origin-Resource-Policy', isPubliclyReferenced ? 'cross-origin' : 'same-origin');
}
