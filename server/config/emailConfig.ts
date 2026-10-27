export type EmailProvider = 'resend' | 'gmail_oauth' | 'gmail_smtp' | 'smtp' | 'dev_mock';

export type SmtpAuthentication =
  | { user: string; pass: string }
  | {
      type: 'OAuth2';
      user: string;
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      accessToken?: string;
    };

export interface EmailConfig {
  provider: EmailProvider;
  receiverEmail: string;
  fromEmail: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: SmtpAuthentication;
  };
  resend?: { apiKey: string };
  diagnosticDetails?: {
    hasSmtpConfig: boolean;
    hasResendConfig: boolean;
    hasGoogleOAuthConfig: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    hasSmtpPass?: boolean;
    isSecure?: boolean;
    isGmail: boolean;
    detectedProvider: string;
    reason: string;
  };
}

const cleanEnv = (value?: string): string => {
  if (!value) return '';
  let cleaned = value.trim().replace(/^["'`]|["'`]$/g, '').trim();
  if (cleaned.includes('=') && /^[A-Z_a-z]+=/i.test(cleaned)) {
    cleaned = cleaned.split('=').slice(1).join('=').trim();
    cleaned = cleaned.replace(/^["'`]|["'`]$/g, '').trim();
  }
  return cleaned;
};

const firstEnv = (...values: Array<string | undefined>): string =>
  values.map(cleanEnv).find(Boolean) || '';

export const hasEmailProviderConfiguration = (env: NodeJS.ProcessEnv = process.env): boolean =>
  getEmailConfig(env).provider !== 'dev_mock';

export const getEmailConfig = (env: NodeJS.ProcessEnv = process.env): EmailConfig => {
  const receiverEmail =
    firstEnv(env.CONTACT_RECEIVER_EMAIL, env.RECEIVER_EMAIL) ||
    'anish.jethva2006@gmail.com';
  const customFrom = firstEnv(env.EMAIL_FROM, env.SMTP_FROM, env.RESEND_FROM);
  const smtpUser = firstEnv(env.EMAIL_USER, env.SMTP_USER, env.GMAIL_USER, env.GOOGLE_OAUTH_EMAIL, env.GOOGLE_EMAIL);
  const smtpPass = firstEnv(env.EMAIL_PASS, env.SMTP_PASS);
  const rawHost = firstEnv(env.EMAIL_HOST, env.SMTP_HOST);
  const smtpHost = rawHost || (smtpUser ? 'smtp.gmail.com' : '');
  const isGmail = /(^|\.)gmail\.com$/i.test(smtpHost) || smtpHost.toLowerCase() === 'smtp.gmail.com';
  const rawPort = firstEnv(env.EMAIL_PORT, env.SMTP_PORT);
  const port = rawPort ? Number.parseInt(rawPort, 10) : isGmail ? 465 : 587;
  const secureSetting = firstEnv(env.EMAIL_SECURE, env.SMTP_SECURE).toLowerCase();
  const secure = secureSetting ? secureSetting === 'true' : port === 465;

  const resendApiKey = firstEnv(env.RESEND_API_KEY);
  const oauthClientId = firstEnv(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_CLIENT_ID, env.GMAIL_OAUTH_CLIENT_ID, env.GMAIL_CLIENT_ID);
  const oauthClientSecret = firstEnv(env.GOOGLE_OAUTH_CLIENT_SECRET, env.GOOGLE_CLIENT_SECRET, env.GMAIL_OAUTH_CLIENT_SECRET, env.GMAIL_CLIENT_SECRET);
  const oauthRefreshToken = firstEnv(env.GOOGLE_OAUTH_REFRESH_TOKEN, env.GOOGLE_REFRESH_TOKEN, env.GMAIL_OAUTH_REFRESH_TOKEN, env.GMAIL_REFRESH_TOKEN);
  const oauthAccessToken = firstEnv(env.GOOGLE_OAUTH_ACCESS_TOKEN, env.GMAIL_ACCESS_TOKEN);
  const hasGoogleOAuth = Boolean(smtpUser && oauthClientId && oauthClientSecret && oauthRefreshToken);
  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass && Number.isInteger(port) && port > 0 && port <= 65535);
  const requestedProvider = firstEnv(env.EMAIL_PROVIDER).toLowerCase().replace(/[-\s]/g, '_');

  const providerByName: Record<string, Exclude<EmailProvider, 'dev_mock'>> = {
    resend: 'resend',
    gmail_oauth: 'gmail_oauth',
    google_oauth: 'gmail_oauth',
    gmail_smtp: 'gmail_smtp',
    smtp: isGmail ? 'gmail_smtp' : 'smtp',
  };
  const requested = providerByName[requestedProvider];
  const providerAvailable = (provider: Exclude<EmailProvider, 'dev_mock'>): boolean => {
    if (provider === 'resend') return Boolean(resendApiKey);
    if (provider === 'gmail_oauth') return hasGoogleOAuth;
    if (provider === 'gmail_smtp' || provider === 'smtp') return hasSmtp;
    return false;
  };

  const provider: EmailProvider = requested
    ? providerAvailable(requested) ? requested : 'dev_mock'
    : resendApiKey
      ? 'resend'
      : hasGoogleOAuth
        ? 'gmail_oauth'
        : hasSmtp
          ? isGmail ? 'gmail_smtp' : 'smtp'
          : 'dev_mock';
  const isOAuth = provider === 'gmail_oauth';
  const activeSmtp = provider === 'gmail_oauth' || provider === 'gmail_smtp' || provider === 'smtp';
  const auth: SmtpAuthentication | undefined = isOAuth
    ? {
        type: 'OAuth2',
        user: smtpUser,
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        refreshToken: oauthRefreshToken,
        ...(oauthAccessToken ? { accessToken: oauthAccessToken } : {}),
      }
    : activeSmtp
      ? { user: smtpUser, pass: smtpPass }
      : undefined;
  const selectedHost = provider === 'gmail_oauth' || provider === 'gmail_smtp' ? 'smtp.gmail.com' : smtpHost;
  const defaultFrom = smtpUser || receiverEmail;
  const providerName = provider === 'resend'
    ? 'Resend API'
    : provider === 'gmail_oauth'
      ? 'Gmail OAuth2'
      : provider === 'gmail_smtp'
        ? 'Gmail SMTP'
        : provider === 'smtp'
          ? `SMTP (${selectedHost}:${port})`
          : 'Dev/Mock Store';
  const fromEmail = provider === 'resend'
    ? firstEnv(env.RESEND_FROM, env.EMAIL_FROM, env.SMTP_FROM) || 'Portfolio Contact <onboarding@resend.dev>'
    : customFrom || `Portfolio Contact <${defaultFrom}>`;
  const reason = provider === 'dev_mock'
    ? requested
      ? `EMAIL_PROVIDER requested ${requestedProvider}, but its required credentials are missing.`
      : 'Configure RESEND_API_KEY, Google OAuth credentials, or SMTP credentials to enable email delivery.'
    : `Email delivery is active via ${providerName}.`;

  return {
    provider,
    receiverEmail,
    fromEmail,
    ...(provider === 'resend' ? { resend: { apiKey: resendApiKey } } : {}),
    ...(activeSmtp && auth
      ? {
          smtp: {
            host: selectedHost,
            port,
            secure,
            auth,
          },
        }
      : {}),
    diagnosticDetails: {
      hasSmtpConfig: hasSmtp,
      hasResendConfig: Boolean(resendApiKey),
      hasGoogleOAuthConfig: hasGoogleOAuth,
      smtpHost: selectedHost || undefined,
      smtpPort: port,
      smtpUser: smtpUser || undefined,
      hasSmtpPass: Boolean(smtpPass),
      isSecure: isOAuth ? false : secure,
      isGmail: provider === 'gmail_oauth' || provider === 'gmail_smtp',
      detectedProvider: providerName,
      reason,
    },
  };
};
