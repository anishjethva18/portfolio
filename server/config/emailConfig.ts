export interface EmailConfig {
  provider: 'gmail_smtp' | 'smtp' | 'dev_mock';
  receiverEmail: string;
  fromEmail: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  diagnosticDetails?: {
    hasSmtpConfig: boolean;
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

const cleanEnv = (val?: string): string => {
  if (!val) return '';
  let cleaned = val.trim();
  // Remove wrapping quotes or backticks
  cleaned = cleaned.replace(/^["'`]|["'`]$/g, '').trim();
  // If user pasted in KEY=VALUE format into the environment variable field
  if (cleaned.includes('=') && /^[A-Z_a-z]+=/i.test(cleaned)) {
    cleaned = cleaned.split('=').slice(1).join('=').trim();
    cleaned = cleaned.replace(/^["'`]|["'`]$/g, '').trim();
  }
  return cleaned;
};

export const getEmailConfig = (): EmailConfig => {
  const receiverEmail =
    cleanEnv(process.env.CONTACT_RECEIVER_EMAIL) ||
    cleanEnv(process.env.RECEIVER_EMAIL) ||
    'anish.jethva2006@gmail.com';

  const customFrom = cleanEnv(process.env.EMAIL_FROM) || cleanEnv(process.env.SMTP_FROM);

  const rawHost = cleanEnv(process.env.EMAIL_HOST) || cleanEnv(process.env.SMTP_HOST);
  const smtpUser = cleanEnv(process.env.EMAIL_USER) || cleanEnv(process.env.SMTP_USER);
  const smtpPass = cleanEnv(process.env.EMAIL_PASS) || cleanEnv(process.env.SMTP_PASS);
  const rawPort = cleanEnv(process.env.EMAIL_PORT) || cleanEnv(process.env.SMTP_PORT);

  // Default to smtp.gmail.com if host is not specified but credentials exist
  const smtpHost = rawHost || (smtpUser ? 'smtp.gmail.com' : '');
  const isGmail = smtpHost.includes('gmail');
  const port = rawPort ? parseInt(rawPort, 10) : isGmail ? 465 : 587;
  const secureSetting = cleanEnv(process.env.EMAIL_SECURE) || cleanEnv(process.env.SMTP_SECURE);
  const isSecure = secureSetting ? secureSetting === 'true' : port === 465;

  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);
  const smtpConfigObj = hasSmtp
    ? {
        host: smtpHost,
        port,
        secure: isSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }
    : undefined;

  // SMTP is the only live mail transport.
  if (hasSmtp) {
    const from = customFrom || `Portfolio Contact <${smtpUser}>`;
    const providerName = isGmail ? 'Gmail SMTP' : `SMTP (${smtpHost}:${port})`;

    return {
      provider: isGmail ? 'gmail_smtp' : 'smtp',
      receiverEmail,
      fromEmail: from,
      smtp: smtpConfigObj,
      diagnosticDetails: {
        hasSmtpConfig: true,
        smtpHost,
        smtpPort: port,
        smtpUser,
        hasSmtpPass: true,
        isSecure,
        isGmail,
        detectedProvider: providerName,
        reason: `SMTP is active via ${smtpHost}:${port} for ${smtpUser}.`,
      },
    };
  }

  // 3. Dev / Mock fallback transport when credentials are not yet configured
  return {
    provider: 'dev_mock',
    receiverEmail,
    fromEmail: customFrom || `Portfolio Contact <${receiverEmail}>`,
    diagnosticDetails: {
      hasSmtpConfig: false,
      smtpHost: smtpHost || 'smtp.gmail.com',
      smtpPort: port,
      smtpUser: smtpUser || undefined,
      hasSmtpPass: Boolean(smtpPass),
      isSecure,
      isGmail,
      detectedProvider: 'Dev/Mock Store',
      reason: 'Configure EMAIL_HOST, EMAIL_USER, and EMAIL_PASS to enable email delivery.',
    },
  };
};
