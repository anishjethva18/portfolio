export interface AuthConfig {
  adminEmail: string;
  adminSetupToken?: string;
  isProduction: boolean;
}

export function validateProductionAuthEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const smtpUser = env.EMAIL_USER || env.SMTP_USER;
  const smtpPassword = env.EMAIL_PASS || env.SMTP_PASS;
  const appUrl = env.APP_URL?.trim();
  const missing = [
    !env.ADMIN_EMAIL?.trim() && 'ADMIN_EMAIL',
    !env.MONGODB_URI?.trim() && 'MONGODB_URI',
    !appUrl && 'APP_URL',
    !smtpUser?.trim() && 'EMAIL_USER or SMTP_USER',
    !smtpPassword?.trim() && 'EMAIL_PASS or SMTP_PASS',
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Production security configuration is incomplete: ${missing.join(', ')}.`);
  }
  if (!appUrl || new URL(appUrl).protocol !== 'https:') {
    throw new Error('Production APP_URL must use HTTPS.');
  }
}

export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const isProduction = env.NODE_ENV === 'production';
  validateProductionAuthEnvironment(env);

  return {
    adminEmail: (env.ADMIN_EMAIL || '').toLowerCase().trim(),
    adminSetupToken: env.ADMIN_SETUP_TOKEN,
    isProduction,
  };
}
