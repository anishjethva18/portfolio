import { isPortfolioDataMutation, notifyPortfolioDataUpdated } from './portfolioSync';
import { broadcastAdminSessionEnded, isProtectedAdminRequest } from './adminSessionEvents';

/**
 * Centralized API Client with HttpOnly Session Cookie & CSRF Protection
 */

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCookie('csrfToken');
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Automatically passes HttpOnly session cookies
  });
  if (response.status === 401 && isProtectedAdminRequest(url)) {
    broadcastAdminSessionEnded();
  }
  if (response.ok && isPortfolioDataMutation(url, method)) notifyPortfolioDataUpdated(url, method);
  return response;
}
