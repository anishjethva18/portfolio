export interface CorsPolicy {
  allowedOrigins: string[];
  isAllowedOrigin(origin?: string): boolean;
}

function normalizeOrigin(value: string, variableName: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${variableName} must contain valid HTTP or HTTPS origins.`);
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${variableName} must contain valid HTTP or HTTPS origins without paths or credentials.`);
  }
  return url.origin;
}

export function buildCorsPolicy(env: NodeJS.ProcessEnv = process.env): CorsPolicy {
  const isProduction = env.NODE_ENV === 'production';
  const configuredOrigins = [
    ...(env.APP_URL?.trim() ? [normalizeOrigin(env.APP_URL, 'APP_URL')] : []),
    ...(env.CORS_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) || [])
      .map((origin) => normalizeOrigin(origin, 'CORS_ALLOWED_ORIGINS')),
  ];
  const allowedOrigins = [...new Set(configuredOrigins)];

  return {
    allowedOrigins,
    isAllowedOrigin(origin) {
      if (!origin || !isProduction) return true;
      try {
        return allowedOrigins.includes(normalizeOrigin(origin, 'Origin'));
      } catch {
        return false;
      }
    },
  };
}

export function parseTrustedProxyHops(value: string | undefined): number {
  const normalized = value?.trim() || '0';
  if (!/^[0-5]$/.test(normalized)) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
  }
  return Number(normalized);
}

export function buildContentSecurityPolicyDirectives(
  isProduction: boolean,
): Record<string, string[]> {
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    frameSrc: ["'self'", 'blob:', 'https:'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
    objectSrc: ["'none'"],
    scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    workerSrc: ["'self'", 'blob:'],
    connectSrc: isProduction
      ? ["'self'", 'https://api.open-meteo.com', 'https://geocoding-api.open-meteo.com', 'https://wttr.in']
      : ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
    ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
  };
}

export const PROXY_CONTENT_SECURITY_POLICY = [
  'sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads',
  "default-src https: data: blob:",
  "base-uri https:",
  "connect-src https:",
  "font-src https: data:",
  "form-action https:",
  "frame-ancestors 'self'",
  "frame-src https:",
  "img-src https: data: blob:",
  "media-src https: data: blob:",
  "object-src 'none'",
  "script-src https: 'unsafe-inline'",
  "style-src https: 'unsafe-inline'",
].join('; ');
