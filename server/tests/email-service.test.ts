import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createAdminReplyEmailHtml, createPasswordResetEmailHtml, createPortfolioEmailHtml, createSenderConfirmationEmailHtml, getEmailBrandMark, getEmailBranding, getPortfolioMediaIdFromUrl, getSmtpFailureExplanation, isEmailFaviconEnabled, resolveEmailBrandingUrls, sendMailWithTimeout, sendWithGmailApi, shouldRetrySmtpFallback, verifyGmailApiAccess } from '../services/emailService';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { SiteContentModel } from '../models';
import { getEmailConfig } from '../config/emailConfig';

const asTransporter = (transport: Partial<Transporter>): Transporter => transport as Transporter;

test('email provider selection supports automatic Resend, Google OAuth, Gmail SMTP, and generic SMTP modes', () => {
  const resend = getEmailConfig({
    RESEND_API_KEY: 're_test_key',
    RESEND_FROM: 'Portfolio <portfolio@example.test>',
    EMAIL_USER: 'mailer@example.test',
    EMAIL_PASS: 'smtp-password',
  } as NodeJS.ProcessEnv);
  assert.equal(resend.provider, 'resend');
  assert.equal(resend.resend?.apiKey, 're_test_key');
  assert.equal(resend.fromEmail, 'Portfolio <portfolio@example.test>');

  const googleOAuth = getEmailConfig({
    EMAIL_USER: 'mailer@gmail.com',
    GOOGLE_OAUTH_CLIENT_ID: 'client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh-token',
  } as NodeJS.ProcessEnv);
  assert.equal(googleOAuth.provider, 'gmail_oauth');
  assert.equal(googleOAuth.smtp, undefined);
  assert.equal(googleOAuth.googleOAuth?.user, 'mailer@gmail.com');
  assert.equal(googleOAuth.googleOAuth?.refreshToken, 'refresh-token');

  const gmailSmtp = getEmailConfig({
    EMAIL_USER: 'mailer@gmail.com',
    EMAIL_PASS: 'gmail-app-password',
  } as NodeJS.ProcessEnv);
  assert.equal(gmailSmtp.provider, 'gmail_smtp');
  assert.equal(gmailSmtp.smtp?.host, 'smtp.gmail.com');

  const genericSmtp = getEmailConfig({
    EMAIL_HOST: 'mail.example.test',
    EMAIL_PORT: '587',
    EMAIL_USER: 'mailer@example.test',
    EMAIL_PASS: 'smtp-password',
  } as NodeJS.ProcessEnv);
  assert.equal(genericSmtp.provider, 'smtp');
  assert.equal(genericSmtp.smtp?.host, 'mail.example.test');

  const explicitSmtp = getEmailConfig({
    EMAIL_PROVIDER: 'smtp',
    RESEND_API_KEY: 're_test_key',
    EMAIL_HOST: 'mail.example.test',
    EMAIL_USER: 'mailer@example.test',
    EMAIL_PASS: 'smtp-password',
  } as NodeJS.ProcessEnv);
  assert.equal(explicitSmtp.provider, 'smtp');
});

test('Gmail OAuth delivery uses the Gmail HTTPS API and sends a valid base64url MIME message', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  let submittedMime = '';
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'oauth-access-token' }), { status: 200 });
    }
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer oauth-access-token');
    const body = JSON.parse(String(init?.body)) as { raw: string };
    submittedMime = Buffer.from(body.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return new Response(JSON.stringify({ id: 'gmail-message-123' }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await sendWithGmailApi({
      user: 'mailer@gmail.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
    }, {
      from: 'Portfolio <mailer@gmail.com>',
      to: 'owner@example.test',
      replyTo: 'visitor@example.test',
      subject: 'Portfolio inquiry',
      text: 'Hello from the contact form.',
      attachments: [{
        filename: 'resume.pdf',
        content: Buffer.from('%PDF-test'),
        contentType: 'application/pdf',
      }],
    });

    assert.equal(result.messageId, 'gmail-message-123');
    assert.deepEqual(requestedUrls, [
      'https://oauth2.googleapis.com/token',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    ]);
    assert.match(submittedMime, /To: owner@example\.test/i);
    assert.match(submittedMime, /Subject: Portfolio inquiry/i);
    assert.match(submittedMime, /filename=resume\.pdf/i);
    assert.match(submittedMime, /JVBERi10ZXN0/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gmail OAuth verification checks Gmail API access without SMTP', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'oauth-access-token' }), { status: 200 });
    }
    return new Response(JSON.stringify({ emailAddress: 'mailer@gmail.com' }), { status: 200 });
  }) as typeof fetch;
  try {
    await verifyGmailApiAccess({
      user: 'mailer@gmail.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
    });
    assert.deepEqual(requestedUrls, [
      'https://oauth2.googleapis.com/token',
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Resend delivery maps recipients, reply-to, attachments, and provider errors', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  let requestUrl = '';
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: 'resend-message-123' }), { status: 200 });
  }) as typeof fetch;
  try {
    const { sendWithResend } = await import('../services/emailService');
    const result = await sendWithResend('re_test_key', {
      from: 'Portfolio <portfolio@example.test>',
      to: 'owner@example.test',
      replyTo: 'visitor@example.test',
      subject: 'Contact subject',
      html: '<p>Hello</p>',
      text: 'Hello',
      attachments: [{ filename: 'resume.pdf', content: Buffer.from('%PDF-test'), contentType: 'application/pdf' }],
    });
    assert.equal(result.messageId, 'resend-message-123');
    assert.equal(requestUrl, 'https://api.resend.com/emails');
    assert.deepEqual(requestBody?.to, ['owner@example.test']);
    assert.equal(requestBody?.reply_to, 'visitor@example.test');
    const attachments = requestBody?.attachments as Array<{ filename: string; content: string; content_type: string }>;
    assert.equal(attachments[0].filename, 'resume.pdf');
    assert.equal(Buffer.from(attachments[0].content, 'base64').toString(), '%PDF-test');
    assert.equal(attachments[0].content_type, 'application/pdf');

    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 })) as typeof fetch;
    await assert.rejects(
      sendWithResend('re_invalid_key', { from: 'a@example.test', to: 'b@example.test', subject: 'test', text: 'test' }),
      /Resend email delivery failed: Invalid API key/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendMailWithTimeout returns successful SMTP delivery', async () => {
  const info = { messageId: 'mail-1', envelope: { from: 'sender@example.test', to: ['recipient@example.test'] } };
  const transport = asTransporter({ sendMail: async () => info });
  assert.equal(await sendMailWithTimeout(transport, {}, 100), info);
});

test('sendMailWithTimeout closes a stalled transport and reports timeout', async () => {
  let closed = false;
  const transport = asTransporter({
    sendMail: () => new Promise<import('nodemailer').SentMessageInfo>(() => {}),
    close: () => { closed = true; },
  });
  await assert.rejects(sendMailWithTimeout(transport, {}, 10), (error: NodeJS.ErrnoException) => {
    assert.equal(error.code, 'ETIMEDOUT');
    assert.match(error.message || '', /timed out after 10ms/);
    return true;
  });
  assert.equal(closed, true);
});

test('SMTP fallback is skipped for permanent auth and server configuration failures', () => {
  assert.equal(shouldRetrySmtpFallback(Object.assign(new Error('Invalid login'), { code: 'EAUTH' })), false);
  assert.equal(shouldRetrySmtpFallback(Object.assign(new Error('Authentication rejected'), { responseCode: 535 })), false);
  assert.equal(shouldRetrySmtpFallback(Object.assign(new Error('Bad recipient configuration'), { code: 'EENVELOPE' })), false);
});

test('SMTP fallback remains enabled for connection and timeout failures', () => {
  assert.equal(shouldRetrySmtpFallback(Object.assign(new Error('Connection refused'), { code: 'ECONNECTION' })), true);
  assert.equal(shouldRetrySmtpFallback(Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' })), true);
  assert.equal(shouldRetrySmtpFallback(Object.assign(new Error('DNS lookup failed'), { code: 'ENOTFOUND' })), true);
});

test('SMTP DNS and timeout failures give actionable delivery guidance', () => {
  const primaryDnsError = Object.assign(new Error('getaddrinfo ENOTFOUND smtp.gmail.com'), { code: 'ENOTFOUND' });
  const secondaryDnsError = Object.assign(new Error('getaddrinfo ENOTFOUND smtp.gmail.com'), { code: 'ENOTFOUND' });
  assert.match(
    getSmtpFailureExplanation(primaryDnsError, secondaryDnsError, 'smtp.gmail.com'),
    /could not resolve SMTP host "smtp\.gmail\.com".*Check DNS and network access/
  );

  const timeoutError = Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' });
  assert.match(
    getSmtpFailureExplanation(timeoutError, timeoutError, 'smtp.gmail.com'),
    /SMTP connection timed out/
  );
});

test('email branding references a hosted favicon and keeps AJ when none is configured', () => {
  assert.match(getEmailBrandMark('https://portfolio.example/favicon.png'), /src="https:\/\/portfolio\.example\/favicon\.png"/);
  assert.match(getEmailBrandMark(''), />AJ<\/span>/);
  assert.match(getEmailBrandMark('https://portfolio.example/favicon.png'), /src="https:\/\/portfolio\.example\/favicon\.png"/);
});

test('email favicon is enabled by default and can be disabled in published settings', () => {
  assert.equal(isEmailFaviconEnabled(undefined), true);
  assert.equal(isEmailFaviconEnabled(true), true);
  assert.equal(isEmailFaviconEnabled(false), false);
});

test('email favicon media IDs resolve from relative or published absolute asset URLs', () => {
  assert.equal(getPortfolioMediaIdFromUrl('/api/portfolio-media/file-123'), 'file-123');
  assert.equal(getPortfolioMediaIdFromUrl('https://portfolio.example/api/portfolio-media/file-123?cache=1'), 'file-123');
  assert.equal(getPortfolioMediaIdFromUrl('https://untrusted.example/favicon.png'), '');
});

test('email branding only builds API favicon URLs from a configured public API origin', () => {
  assert.deepEqual(
    resolveEmailBrandingUrls(
      'https://portfolio.example',
      'http://localhost:3000',
      '/api/portfolio-media/published-favicon'
    ),
    {
      canonicalUrl: 'https://portfolio.example',
      faviconUrl: '',
    }
  );
  assert.deepEqual(
    resolveEmailBrandingUrls('', 'http://localhost:3000', ''),
    { canonicalUrl: 'http://localhost:3000', faviconUrl: '' }
  );
  assert.deepEqual(
    resolveEmailBrandingUrls(
      'https://portfolio.example',
      'http://localhost:3000',
      '/api/portfolio-media/published-favicon'
    ),
    {
      canonicalUrl: 'https://portfolio.example',
      faviconUrl: '',
    }
  );
  assert.deepEqual(
    resolveEmailBrandingUrls(
      'https://personal.example',
      'https://portfolio.example',
      '/api/portfolio-media/published-favicon'
    ),
    {
      canonicalUrl: 'https://personal.example',
      faviconUrl: '',
    }
  );
  assert.deepEqual(
    resolveEmailBrandingUrls(
      'https://personal.example',
      'http://localhost:3000',
      '/api/portfolio-media/published-favicon',
      'https://api.portfolio.example'
    ),
    {
      canonicalUrl: 'https://personal.example',
      faviconUrl: 'https://api.portfolio.example/api/email/favicon?id=published-favicon',
    }
  );
});

test('all four email templates use the published favicon URL', () => {
  const faviconUrl = 'https://portfolio.example/api/email/favicon?id=published-favicon';
  const contact = {
    name: 'Jane Doe',
    email: 'jane@example.test',
    subject: 'Portfolio inquiry',
    message: 'I would like to discuss your work.',
    timestamp: new Date('2026-10-22T12:00:00.000Z').toISOString(),
    ipAddress: '127.0.0.1',
    userAgent: 'Test',
  };
  const templates = [
    createPortfolioEmailHtml(contact, 'https://portfolio.example', faviconUrl),
    createSenderConfirmationEmailHtml(contact, 'https://portfolio.example', faviconUrl),
    createAdminReplyEmailHtml('Jane', 'Thanks for contacting me.', 'https://portfolio.example', faviconUrl),
    createPasswordResetEmailHtml('admin@example.test', 'https://portfolio.example/reset?token=one', 'https://portfolio.example', faviconUrl),
  ];

  for (const html of templates) {
    assert.match(html, /src="https:\/\/portfolio\.example\/api\/email\/favicon\?id=published-favicon"/);
  }
});

test('admin reply and password reset templates adapt their layout on narrow screens and escape user input', () => {
  const faviconUrl = 'https://portfolio.example/api/email/favicon?id=published-favicon';
  const reply = createAdminReplyEmailHtml(
    '<Anish>',
    'A long reply with a URL https://example.test/' + 'a'.repeat(150),
    'https://portfolio.example',
    faviconUrl,
  );
  const reset = createPasswordResetEmailHtml(
    'admin@example.test',
    'https://portfolio.example/reset?token=one&next=two',
    'https://portfolio.example',
    faviconUrl,
  );

  for (const html of [reply, reset]) {
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0"/);
    assert.match(html, /@media only screen and \(max-width: 600px\)/);
    assert.match(html, /width:100%;max-width:580px/);
    assert.match(html, /word-break:break-word|overflow-wrap:anywhere/);
  }
  assert.match(reply, /Hi &lt;Anish&gt;/);
  assert.match(reply, /getEmailBrandHeader|REPLY/);
  assert.match(reply, /src="https:\/\/portfolio\.example\/api\/email\/favicon\?id=published-favicon"/);
  assert.match(reply, /width:36px;height:36px;max-width:36px;max-height:36px/);
  assert.match(reply, /white-space:nowrap;">Anish Jethva<\/span>/);
  assert.match(reply, /width:104px;padding-left:12px/);
  assert.match(reset, /class="reset-button"/);
  assert.match(reset, /src="https:\/\/portfolio\.example\/api\/email\/favicon\?id=published-favicon"/);
  for (const html of [reply, reset]) {
    assert.match(html, /PORTFOLIO OS · CONTACT ENGINE/);
    assert.match(html, /Anish Jethva<\/span>/);
    assert.match(html, /width="44" height="44"/);
    assert.match(html, /padding:32px 36px/);
    assert.doesNotMatch(html, /\.reply-header-table|\.reset-brand-table|\.reset-status-cell/);
  }
  assert.match(reset, /PASSWORD RESET/);
  assert.match(reset, /<td width="44" height="44"/);
  assert.doesNotMatch(reset, /reset-button \{\s*display:\s*block !important/);
  assert.match(reset, /align="center"[\s\S]*?class="reset-button"/);
  assert.match(reset, /token=one&amp;next=two/);
});

test('all four email templates reference the published image URL without adding an image MIME attachment', async () => {
  const faviconUrl = 'https://portfolio.example/api/email/favicon?id=published-favicon';
  const contact = {
    name: 'Jane Doe',
    email: 'jane@example.test',
    subject: 'Portfolio inquiry',
    message: 'I would like to discuss your work.',
    timestamp: new Date('2026-10-22T12:00:00.000Z').toISOString(),
    ipAddress: '127.0.0.1',
    userAgent: 'Test',
  };
  const templates = [
    createPortfolioEmailHtml(contact, 'https://portfolio.example', faviconUrl),
    createSenderConfirmationEmailHtml(contact, 'https://portfolio.example', faviconUrl),
    createAdminReplyEmailHtml('Jane', 'Thanks for contacting me.', 'https://portfolio.example', faviconUrl),
    createPasswordResetEmailHtml('admin@example.test', 'https://portfolio.example/reset?token=one', 'https://portfolio.example', faviconUrl),
  ];

  for (const html of templates) {
    const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const result = await transporter.sendMail({
      from: 'sender@example.test',
      to: 'recipient@example.test',
      html,
      text: 'Email plain-text fallback.',
    });
    const mime = result.message.toString().replace(/=\r?\n/g, '');
    assert.match(mime, /src=3D"https:\/\/portfolio\.example\/api\/email\/favicon\?id=3Dpublished-favicon"/);
    assert.doesNotMatch(mime, /Content-ID:|Content-Disposition: inline|Content-Type: image\//i);
    assert.doesNotMatch(mime, /Content-Disposition: attachment/i);
  }
});

test('Nodemailer references the hosted favicon without attaching a favicon MIME part', async () => {
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const result = await transporter.sendMail({
    from: 'sender@example.test',
    to: 'recipient@example.test',
    html: getEmailBrandMark('https://portfolio.example/favicon.png'),
  });
  const mime = result.message.toString();
  assert.match(mime, /src=3D"https:\/\/portfolio\.example\/favicon\.png"/);
  assert.doesNotMatch(mime, /Content-ID:|Content-Disposition: inline|Content-Type: image\//);
});

test('email branding emits the public favicon endpoint and no favicon MIME attachment', async () => {
  await connectMongo();
  const originalEnvironment = {
    appUrl: process.env.APP_URL,
    emailPublicBaseUrl: process.env.EMAIL_PUBLIC_BASE_URL,
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL,
    renderExternalHostname: process.env.RENDER_EXTERNAL_HOSTNAME,
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  };
  try {
    process.env.APP_URL = 'https://portfolio.example';
    process.env.EMAIL_PUBLIC_BASE_URL = 'https://api.portfolio.example';
    process.env.CORS_ALLOWED_ORIGINS = 'https://portfolio.example';
    await SiteContentModel.findOneAndUpdate(
      { key: 'primary_portfolio_content' },
      {
        $set: {
          'profile.website': 'https://portfolio.example',
          'siteSettings.faviconUrl': '/api/portfolio-media/file-email-brand-test',
          'siteSettings.emailFaviconEnabled': true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    const branding = await getEmailBranding('https://portfolio.example');
    assert.equal(branding.faviconUrl, 'https://api.portfolio.example/api/email/favicon?id=file-email-brand-test');

    delete process.env.EMAIL_PUBLIC_BASE_URL;
    process.env.RENDER_EXTERNAL_URL = 'https://render-api.portfolio.example';
    const renderBranding = await getEmailBranding('https://portfolio.example');
    assert.equal(
      renderBranding.faviconUrl,
      'https://render-api.portfolio.example/api/email/favicon?id=file-email-brand-test'
    );

    delete process.env.RENDER_EXTERNAL_URL;
    process.env.RENDER_EXTERNAL_HOSTNAME = 'render-api.portfolio.example';
    const hostnameBranding = await getEmailBranding('https://portfolio.example');
    assert.equal(
      hostnameBranding.faviconUrl,
      'https://render-api.portfolio.example/api/email/favicon?id=file-email-brand-test'
    );

    const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const result = await transporter.sendMail({
      from: 'sender@example.test',
      to: 'recipient@example.test',
      html: createPasswordResetEmailHtml(
        'admin@example.test',
        'https://portfolio.example/reset',
        hostnameBranding.canonicalUrl,
        hostnameBranding.faviconUrl
      ),
    });
    const mime = result.message.toString().replace(/=\r?\n/g, '');
    assert.match(mime, /src=3D"https:\/\/render-api\.portfolio\.example\/api\/email\/favicon\?id=3Dfile-email-brand-test"/);
    assert.doesNotMatch(mime, /Content-ID:|Content-Disposition: inline|Content-Type: image\/|filename=/i);
    assert.doesNotMatch(mime, /Content-Disposition: attachment/i);
  } finally {
    if (originalEnvironment.appUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalEnvironment.appUrl;
    if (originalEnvironment.emailPublicBaseUrl === undefined) delete process.env.EMAIL_PUBLIC_BASE_URL;
    else process.env.EMAIL_PUBLIC_BASE_URL = originalEnvironment.emailPublicBaseUrl;
    if (originalEnvironment.renderExternalUrl === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = originalEnvironment.renderExternalUrl;
    if (originalEnvironment.renderExternalHostname === undefined) delete process.env.RENDER_EXTERNAL_HOSTNAME;
    else process.env.RENDER_EXTERNAL_HOSTNAME = originalEnvironment.renderExternalHostname;
    if (originalEnvironment.corsAllowedOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = originalEnvironment.corsAllowedOrigins;
    await SiteContentModel.deleteOne({ key: 'primary_portfolio_content' });
    await mongoose.disconnect();
    await disconnectMongo();
  }
});
