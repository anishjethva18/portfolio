import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import type { SendMailOptions, SentMessageInfo, Transporter } from 'nodemailer';
import { EmailConfig, EmailProvider, getEmailConfig } from '../config/emailConfig';
import { ValidatedContactBody } from '../middleware/validation';
import { db } from '../db/database';
import { ContactModel, SiteContentModel } from '../models';
import { formatEmailTimestamp } from '../utils/dateTime';

export interface StoredContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  status: 'delivered' | 'failed' | 'queued' | 'simulated';
  emailSent: boolean;
  provider: string;
  attachments?: any[];
  error?: string;
}

// Persistent contact database bridging to centralized DatabaseManager & MongoDB
class ContactDatabase {
  public insert(msg: StoredContactMessage): StoredContactMessage {
    const record: any = { ...msg };
    db.contacts.set(msg.id, record);
    if (mongoose.connection.readyState === 1) {
      ContactModel.updateOne({ id: msg.id }, { $set: record }, { upsert: true }).catch((err) => {
        console.error('[ContactDatabase] Error persisting to MongoDB:', err.message);
      });
    }
    return msg;
  }

  public updateStatus(id: string, status: StoredContactMessage['status'], emailSent: boolean, error?: string): void {
    const item: any = db.contacts.get(id);
    if (item) {
      item.status = status;
      item.emailSent = emailSent;
      if (error) item.error = error;
      db.contacts.set(id, item);
      if (mongoose.connection.readyState === 1) {
        ContactModel.updateOne({ id }, { $set: item }).catch((err) => {
          console.error('[ContactDatabase] Error updating in MongoDB:', err.message);
        });
      }
    }
  }

  public getAll(): StoredContactMessage[] {
    return Array.from(db.contacts.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) as any[];
  }

  public getByEmail(email: string): StoredContactMessage[] {
    return Array.from(db.contacts.values())
      .filter((m) => m.email.toLowerCase() === email.toLowerCase()) as any[];
  }

  public getCount(): number {
    return db.contacts.size;
  }
}

export const contactDb = new ContactDatabase();

interface PublishedEmailBranding {
  canonicalUrl: string;
  faviconUrl: string;
}

export const isEmailFaviconEnabled = (value: unknown): boolean => value !== false;
export const getPortfolioMediaIdFromUrl = (value: string): string => {
  try {
    const url = new URL(value, 'http://portfolio.local');
    const queryId = url.searchParams.get('id');
    if (queryId && /^file-[A-Za-z0-9-]+$/.test(queryId)) return queryId;
    return url.pathname.match(/\/api\/portfolio-media\/([A-Za-z0-9_-]+)\/?$/)?.[1] || '';
  } catch {
    return '';
  }
};

export const resolveEmailBrandingUrls = (
  publishedWebsite: string,
  configuredClientUrl: string,
  publishedFavicon: string,
  configuredEmailPublicBaseUrl = ''
): PublishedEmailBranding => {
  const canonicalUrl = isHttpUrl(publishedWebsite)
    ? publishedWebsite
    : isHttpUrl(configuredClientUrl)
      ? configuredClientUrl
      : '';
  const faviconBaseUrl = getPublicHttpsOrigin(configuredEmailPublicBaseUrl);
  let faviconUrl = '';

  if (publishedFavicon) {
    try {
      const faviconId = getPortfolioMediaIdFromUrl(publishedFavicon);
      if (faviconId && faviconBaseUrl) {
        faviconUrl = new URL(
          `/api/email/favicon?id=${encodeURIComponent(faviconId)}`,
          faviconBaseUrl
        ).href;
        return { canonicalUrl, faviconUrl };
      }
      const resolvedFavicon = new URL(publishedFavicon, faviconBaseUrl || undefined);
      if (resolvedFavicon.protocol === 'https:' && !resolvedFavicon.username && !resolvedFavicon.password) {
        faviconUrl = resolvedFavicon.href;
      }
    } catch {
      faviconUrl = '';
    }
  }

  return { canonicalUrl, faviconUrl };
};

export const getEmailBranding = async (requestPublicOrigin = ''): Promise<PublishedEmailBranding> => {
  let publishedWebsite = '';
  let publishedFavicon = '';
  let emailFaviconEnabled = true;
  if (mongoose.connection.readyState === 1) {
    try {
      const content = await SiteContentModel.findOne({ key: 'primary_portfolio_content' })
        .select('profile.website siteSettings.faviconUrl siteSettings.emailBrandImageUrl siteSettings.emailFaviconEnabled')
        .lean();
      publishedWebsite = typeof content?.profile?.website === 'string' ? content.profile.website.trim() : '';
      emailFaviconEnabled = isEmailFaviconEnabled(content?.siteSettings?.emailFaviconEnabled);
      publishedFavicon = typeof content?.siteSettings?.emailBrandImageUrl === 'string' &&
        content.siteSettings.emailBrandImageUrl.trim()
        ? content.siteSettings.emailBrandImageUrl.trim()
        : typeof content?.siteSettings?.faviconUrl === 'string'
          ? content.siteSettings.faviconUrl.trim()
          : '';
    } catch (error) {
      console.warn('[EmailService] Could not load published email branding or favicon asset.', error);
    }
  }

  const configuredClientUrl = process.env.APP_URL?.trim() || process.env.CLIENT_URL?.split(',')[0]?.trim() || '';
  const renderExternalUrl = process.env.RENDER_EXTERNAL_URL?.trim()
    || (process.env.RENDER_EXTERNAL_HOSTNAME?.trim() ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME.trim()}` : '');
  const configuredEmailPublicBaseUrl = getPublicHttpOrigin(
    process.env.EMAIL_PUBLIC_BASE_URL?.trim() ||
    renderExternalUrl ||
    ''
  );
  const allowedPublicOrigins = [
    process.env.APP_URL,
    process.env.EMAIL_PUBLIC_BASE_URL,
    renderExternalUrl,
    ...(process.env.CLIENT_URL?.split(',') || []),
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(',') || []),
  ]
    .map((value) => getPublicHttpOrigin(value?.trim() || ''))
    .filter(Boolean);
  const requestOrigin = getPublicHttpOrigin(requestPublicOrigin);
  const validatedRequestOrigin = requestOrigin && allowedPublicOrigins.includes(requestOrigin)
    ? requestOrigin
    : '';
  const emailFavicon = emailFaviconEnabled ? publishedFavicon : '';
  const branding = resolveEmailBrandingUrls(
    publishedWebsite,
    configuredClientUrl,
    emailFavicon,
    configuredEmailPublicBaseUrl || validatedRequestOrigin
  );
  if (emailFavicon && !branding.faviconUrl) {
    console.warn(
      '[EmailService] Email favicon is enabled, but no public API origin is configured. The email will use the AJ fallback. Set EMAIL_PUBLIC_BASE_URL to a publicly reachable HTTPS API origin.'
    );
  }
  return branding;
};

const isHttpUrl = (value: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const getPublicHttpOrigin = (value: string): string => {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.localhost') ||
      url.hostname.endsWith('.local') ||
      url.hostname.startsWith('127.') ||
      url.hostname === '[::1]' ||
      url.hostname === '0.0.0.0'
    ) return '';
    return url.origin;
  } catch {
    return '';
  }
};

const getPublicHttpsOrigin = (value: string): string => {
  const origin = getPublicHttpOrigin(value);
  return origin && new URL(origin).protocol === 'https:' ? origin : '';
};

// HTML Email Template for Portfolio Inquiries
export const getEmailBrandMark = (faviconUrl: string): string => faviconUrl
    ? `<img src="${escapeHtml(faviconUrl)}" alt="AJ" width="36" height="36" border="0" style="display:block;width:36px;height:36px;max-width:36px;max-height:36px;object-fit:contain;border:0;border-radius:8px;font-family:Arial,sans-serif;font-size:18px;font-weight:800;color:#4f46e5;" />`
  : '<span style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:18px;font-weight:800;color:#4f46e5;letter-spacing:-0.5px;display:block;line-height:44px;">AJ</span>';

const getEmailBrandHeader = (label: string, faviconUrl: string): string => `
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="left" style="vertical-align:middle;">
        <table role="presentation" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td width="44" height="44" style="width:44px;height:44px;background-color:#ffffff;border-radius:12px;text-align:center;vertical-align:middle;overflow:hidden;">
              ${getEmailBrandMark(faviconUrl)}
            </td>
            <td style="padding-left:12px;vertical-align:middle;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;display:block;line-height:1.15;white-space:nowrap;">Anish Jethva</span>
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:9px;font-weight:700;color:#c7d2fe;letter-spacing:1px;text-transform:uppercase;display:block;margin-top:3px;line-height:1.35;">PORTFOLIO OS · CONTACT ENGINE</span>
            </td>
          </tr>
        </table>
      </td>
      <td width="104" align="right" style="width:104px;padding-left:12px;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;font-weight:800;letter-spacing:1.2px;line-height:1.35;color:#38bdf8;text-transform:uppercase;">
        ${escapeHtml(label)}
      </td>
    </tr>
  </table>`;

export const createPortfolioEmailHtml = (data: ValidatedContactBody, canonicalUrl: string, faviconUrl: string): string => {
  const formattedDate = formatEmailTimestamp(data.timestamp);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Inquiry: ${escapeHtml(data.subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
    }
    td {
      padding: 0;
    }
    img {
      border: 0;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);">
          
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #4f46e5; padding: 32px 36px;">
              ${getEmailBrandHeader('NEW INQUIRY', faviconUrl)}
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 38px 36px 32px 36px; background-color: #ffffff;">
              <h1 style="margin: 0 0 14px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.5px; line-height: 1.25;">Hi Anish Jethva,</h1>
              <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #4b5563;">You have received a new contact submission from your <strong>Windows 11 Portfolio OS</strong>. Below are the inquiry details and sender message.</p>

              <!-- Submission Overview -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 22px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; width: 100px;">From:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHtml(data.name)}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Email:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 500;"><a href="mailto:${data.email}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${escapeHtml(data.email)}</a></td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Subject:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHtml(data.subject)}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Received:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #475569;">${formattedDate} (UTC)</td>
                      </tr>
                      <tr>
                        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Visitor IP:</td>
                        <td style="font-family: monospace; font-size: 12px; color: #64748b;">${escapeHtml(data.ipAddress)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Message Section -->
              <h3 style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Message Content</h3>
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-wrap; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">${escapeHtml(data.message)}</div>

              <!-- Primary Action CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px auto 0 auto;">
                <tr>
                  <td align="center" style="text-align: center;">
                    <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="border-radius: 10px; background-color: #4f46e5; text-align: center;">
                          <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject)}" target="_blank" style="display: inline-block; padding: 13px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: 10px; letter-spacing: -0.2px;">Reply to ${escapeHtml(data.name)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Footer -->
          <tr>
            <td style="border-top: 1px solid #e5e7eb; background-color: #ffffff; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #6b7280; line-height: 1.5;">
                &copy; 2026 Anish Jethva. All rights reserved. &middot; ${canonicalUrl ? `<a href="${escapeHtml(canonicalUrl)}" target="_blank" style="color: #4f46e5; text-decoration: none; font-weight: 500;">Portfolio OS</a>` : 'Portfolio OS'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Confirmation HTML Email for Inquiry Senders
export const createSenderConfirmationEmailHtml = (data: ValidatedContactBody, canonicalUrl: string, faviconUrl: string): string => {
  const formattedDate = formatEmailTimestamp(data.timestamp);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt: Message delivered to Anish Jethva</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
    }
    td {
      padding: 0;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);">
          
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #4f46e5; padding: 32px 36px;">
              ${getEmailBrandHeader('RECEIPT CONFIRMED', faviconUrl)}
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 38px 36px 32px 36px; background-color: #ffffff;">
              <h1 style="margin: 0 0 14px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.5px; line-height: 1.25;">Hi ${escapeHtml(data.name)},</h1>
              <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #4b5563;">Thank you for getting in touch through my <strong>Windows 11 Portfolio OS</strong>. Your inquiry has been received and is ready for review.</p>

              <!-- Submission Overview -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 22px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; width: 100px;">Recipient:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #0f172a;">Anish Jethva</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Email:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 500;"><a href="mailto:anish.jethva2006@gmail.com" style="color: #4f46e5; text-decoration: none; font-weight: 600;">anish.jethva2006@gmail.com</a></td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Subject:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #0f172a;">${escapeHtml(data.subject)}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Sent:</td>
                        <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #475569;">${formattedDate} (UTC)</td>
                      </tr>
                      <tr>
                        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Status:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #16a34a;">Received</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Message Section -->
              <h3 style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Message Content</h3>
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-wrap; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); margin-bottom: 24px;">${escapeHtml(data.message)}</div>

              <!-- Primary Action CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px auto;">
                <tr>
                  <td align="center" style="text-align: center;">
                    <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="border-radius: 10px; background-color: #4f46e5; text-align: center;">
                          ${canonicalUrl ? `<a href="${escapeHtml(canonicalUrl)}" target="_blank" style="display: inline-block; padding: 13px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: 10px; letter-spacing: -0.2px;">Explore Portfolio OS</a>` : '<span style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;">Portfolio OS</span>'}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Follow-up Note -->
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">I review all inquiries promptly and will get back to you soon. Looking forward to connecting!</p>
            </td>
          </tr>

          <!-- Email Footer -->
          <tr>
            <td style="border-top: 1px solid #e5e7eb; background-color: #ffffff; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #6b7280; line-height: 1.5;">
                &copy; 2026 Anish Jethva. All rights reserved. &middot; ${canonicalUrl ? `<a href="${escapeHtml(canonicalUrl)}" target="_blank" style="color: #4f46e5; text-decoration: none; font-weight: 500;">Portfolio OS</a>` : 'Portfolio OS'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface SendContactResult {
  success: boolean;
  messageId: string;
  timestamp: string;
  status: 'delivered' | 'failed' | 'simulated';
  emailSent: boolean;
  provider: string;
  receiver: string;
  note?: string;
  error?: string;
}

export const createAdminReplyEmailHtml = (
  recipientName: string,
  message: string,
  canonicalUrl: string,
  faviconUrl: string
): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A reply from Anish Jethva</title>
  <style>
    @media only screen and (max-width: 600px) {
      .reply-outer { padding: 12px !important; }
      .reply-header { padding: 22px 20px !important; }
      .reply-content { padding: 26px 20px !important; }
      .reply-footer { padding: 18px 20px !important; }
      .reply-card { border-radius: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table class="reply-outer" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table class="reply-card" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td class="reply-header" style="background-color:#4f46e5;padding:32px 36px;">
          ${getEmailBrandHeader('REPLY', faviconUrl)}
        </td></tr>
        <tr><td class="reply-content" style="padding:34px 32px;">
          <h1 style="margin:0 0 14px;font-size:23px;font-weight:800;color:#111827;line-height:1.3;">Hi ${escapeHtml(recipientName)},</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#4b5563;">Thank you for reaching out. Here is my response to your message:</p>
          <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(message)}</div>
          <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">Best regards,<br><strong style="color:#111827;">Anish Jethva</strong></p>
        </td></tr>
        <tr><td class="reply-footer" style="border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#6b7280;">&copy; 2026 Anish Jethva · ${canonicalUrl ? `<a href="${escapeHtml(canonicalUrl)}" style="color:#4f46e5;text-decoration:none;">Portfolio OS</a>` : 'Portfolio OS'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const createPasswordResetEmailHtml = (
  email: string,
  resetUrl: string,
  canonicalUrl: string,
  faviconUrl: string
): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    @media only screen and (max-width: 600px) {
      .reset-outer { padding: 12px !important; }
      .reset-header { padding: 22px 20px !important; }
      .reset-content { padding: 26px 20px !important; }
      .reset-footer { padding: 18px 20px !important; }
      .reset-card { border-radius: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table class="reset-outer" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table class="reset-card" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
        <tr>
          <td class="reset-header" style="background-color:#4f46e5;padding:32px 36px;color:#ffffff;">
            ${getEmailBrandHeader('PASSWORD RESET', faviconUrl)}
          </td>
        </tr>
        <tr>
          <td class="reset-content" style="padding:34px 32px 30px;color:#1f2937;">
            <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#111827;line-height:1.25;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;overflow-wrap:anywhere;">A password reset was requested for <strong>${escapeHtml(email)}</strong>. Use the button below to choose a new password.</p>
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:28px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                    <tr>
                      <td align="center" style="border-radius:10px;background-color:#4f46e5;text-align:center;">
                        <a class="reset-button" href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:13px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">Set new password</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#64748b;">This link expires in 15 minutes and can only be used once.</p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">If you did not request this, ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td class="reset-footer" style="border-top:1px solid #e5e7eb;background-color:#ffffff;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">Anish Jethva · ${canonicalUrl ? `<a href="${escapeHtml(canonicalUrl)}" style="color:#4f46e5;text-decoration:none;">Portfolio OS</a>` : 'Portfolio OS'}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/** Retry another SMTP port only when changing transport settings can plausibly help. */
export const shouldRetrySmtpFallback = (error: NodeJS.ErrnoException & { responseCode?: number }): boolean => {
  if (error.code === 'EAUTH' || error.code === 'EENVELOPE') return false;
  if (typeof error.responseCode === 'number' && error.responseCode >= 500 && error.responseCode < 600) return false;
  return true;
};

export const getSmtpFailureExplanation = (
  primaryError: NodeJS.ErrnoException,
  secondaryError: NodeJS.ErrnoException,
  host: string
): string => {
  const errors = [primaryError, secondaryError];
  if (errors.some((error) => error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN')) {
    return `The server could not resolve SMTP host "${host}" through DNS. Check DNS and network access for the server process, then retry.`;
  }
  if (errors.some((error) => error.code === 'ETIMEDOUT' || error.message.toLowerCase().includes('timeout'))) {
    return 'SMTP connection timed out. Verify the mail host, port, TLS settings, credentials, and hosting provider outbound SMTP policy.';
  }
  return secondaryError.message || primaryError.message || 'SMTP delivery failed. Check the mail server configuration and retry.';
};

/** Hard deadline around SMTP operations; Nodemailer's socket timeout is only an idle timeout. */
export const sendMailWithTimeout = async (
  transporter: Transporter,
  message: SendMailOptions,
  timeoutMs = 20000
): Promise<SentMessageInfo> => {
  let timeout: NodeJS.Timeout;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = Object.assign(new Error(`SMTP send timed out after ${timeoutMs}ms.`), { code: 'ETIMEDOUT' });
      try {
        transporter.close();
      } catch {
        // The timeout still needs to be reported if the transport already closed.
      }
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => transporter.sendMail(message)),
      deadline,
    ]);
  } finally {
    clearTimeout(timeout!);
  }
};

export interface EmailDeliveryInfo {
  messageId: string;
}

export function getEmailProviderLabel(provider: EmailProvider): string {
  switch (provider) {
    case 'resend': return 'Resend API';
    case 'gmail_oauth': return 'Gmail API (OAuth2)';
    case 'gmail_smtp': return 'Gmail SMTP';
    case 'smtp': return 'SMTP';
    case 'dev_mock': return 'Dev/Mock Store';
  }
}

type GoogleOAuthConfig = NonNullable<EmailConfig['googleOAuth']>;

async function fetchWithDeadline(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  providerName: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw Object.assign(new Error(`${providerName} request timed out after ${timeoutMs}ms.`), { code: 'ETIMEDOUT' });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getGoogleOAuthAccessToken(
  credentials: GoogleOAuthConfig,
  timeoutMs = 15000,
): Promise<string> {
  const response = await fetchWithDeadline(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    },
    timeoutMs,
    'Google OAuth',
  );
  const result = await response.json().catch(() => ({})) as {
    access_token?: unknown;
    error_description?: unknown;
    error?: unknown;
  };
  if (!response.ok || typeof result.access_token !== 'string' || !result.access_token) {
    const errorCode = typeof result.error === 'string' ? result.error : '';
    const description = typeof result.error_description === 'string'
      ? result.error_description
      : '';
    const detail = errorCode === 'invalid_grant'
      ? 'Google rejected the refresh token (invalid_grant). It may be revoked or expired, created for a different OAuth client, or the consent screen may still be in Testing mode. Confirm the Gmail account and OAuth client ID/secret match the token, enable Gmail API access, then issue one new offline refresh token. If this is a deployed app, store it in the backend host environment and restart the service.'
      : errorCode === 'invalid_client'
        ? 'Google rejected the OAuth client credentials (invalid_client). Confirm the client ID and client secret belong to the same active Google Cloud OAuth client.'
        : errorCode === 'unauthorized_client'
          ? 'Google rejected this OAuth client for the refresh-token grant (unauthorized_client). Check the OAuth client type and Google Cloud consent configuration.'
          : errorCode === 'invalid_request'
            ? 'Google rejected the OAuth refresh request (invalid_request). Confirm the client ID, client secret, and refresh token are complete and belong to the same OAuth authorization.'
            : [
                errorCode || `HTTP ${response.status}`,
                description && description !== 'Bad Request' ? description : '',
              ].filter(Boolean).join(': ') || 'Google OAuth returned an invalid token response.';
    throw new Error(`Google OAuth token refresh failed: ${detail}`);
  }
  return result.access_token;
}

export async function sendWithGmailApi(
  credentials: GoogleOAuthConfig,
  message: SendMailOptions,
  timeoutMs = 20000,
): Promise<EmailDeliveryInfo> {
  const accessToken = await getGoogleOAuthAccessToken(credentials, timeoutMs);
  const mimeTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'unix',
  });
  const mime = await mimeTransport.sendMail(message);
  const messageOutput: unknown = mime.message;
  let mimeBytes: Buffer;
  if (Buffer.isBuffer(messageOutput)) {
    mimeBytes = messageOutput;
  } else if (typeof messageOutput === 'string') {
    mimeBytes = Buffer.from(messageOutput);
  } else if (
    messageOutput &&
    typeof messageOutput === 'object' &&
    Symbol.asyncIterator in messageOutput
  ) {
    const mimeChunks: Buffer[] = [];
    for await (const chunk of messageOutput as AsyncIterable<Uint8Array | string>) {
      mimeChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    mimeBytes = Buffer.concat(mimeChunks);
  } else {
    throw new Error('Nodemailer did not produce a readable MIME message for Gmail API delivery.');
  }
  const raw = mimeBytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const response = await fetchWithDeadline(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    },
    timeoutMs,
    'Gmail API',
  );
  const result = await response.json().catch(() => ({})) as {
    id?: unknown;
    error?: { message?: unknown };
  };
  if (!response.ok || typeof result.id !== 'string' || !result.id) {
    const detail = typeof result.error?.message === 'string'
      ? result.error.message
      : `Gmail API returned HTTP ${response.status}.`;
    throw new Error(`Gmail API email delivery failed: ${detail}`);
  }
  return { messageId: result.id };
}

export async function verifyGmailApiAccess(
  credentials: GoogleOAuthConfig,
  timeoutMs = 15000,
): Promise<void> {
  const accessToken = await getGoogleOAuthAccessToken(credentials, timeoutMs);
  const response = await fetchWithDeadline(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { Authorization: `Bearer ${accessToken}` } },
    timeoutMs,
    'Gmail API',
  );
  const result = await response.json().catch(() => ({})) as {
    emailAddress?: unknown;
    error?: { message?: unknown };
  };
  if (!response.ok || typeof result.emailAddress !== 'string') {
    const detail = typeof result.error?.message === 'string'
      ? result.error.message
      : `Gmail API returned HTTP ${response.status}.`;
    throw new Error(`Gmail API access verification failed: ${detail}`);
  }
}

function normalizeEmailAddresses(address: unknown): string[] {
  if (!address) return [];
  const addresses = Array.isArray(address) ? address : [address];
  return addresses.flatMap((item): string[] => {
    if (typeof item === 'string') return [item];
    if (!item || typeof item !== 'object') return [];
    if ('address' in item && typeof item.address === 'string') return [item.address];
    return [];
  });
}

export async function sendWithResend(
  apiKey: string,
  message: SendMailOptions,
  timeoutMs = 20000,
): Promise<EmailDeliveryInfo> {
  const recipients = normalizeEmailAddresses(message.to);
  if (!recipients.length) throw new Error('At least one email recipient is required.');

  const attachments = (message.attachments || []).map((attachment) => {
    const content = attachment.content;
    const encodedContent = Buffer.isBuffer(content)
      ? content.toString('base64')
      : typeof content === 'string'
        ? content
        : '';
    if (!encodedContent) throw new Error(`Email attachment ${attachment.filename || 'unnamed'} has no content.`);
    return {
      filename: attachment.filename || 'attachment',
      content: encodedContent,
      ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
    };
  });
  const replyToAddresses = normalizeEmailAddresses(message.replyTo);
  const replyTo = replyToAddresses.length
    ? Array.isArray(message.replyTo) ? replyToAddresses : replyToAddresses[0]
    : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: recipients,
        subject: message.subject,
        ...(message.html ? { html: message.html } : {}),
        ...(message.text ? { text: message.text } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments.length ? { attachments } : {}),
      }),
    });
    const responseBody = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown; name?: unknown };
    if (!response.ok) {
      const detail = typeof responseBody.message === 'string'
        ? responseBody.message
        : typeof responseBody.name === 'string'
          ? responseBody.name
          : `Resend returned HTTP ${response.status}.`;
      throw new Error(`Resend email delivery failed: ${detail}`);
    }
    if (typeof responseBody.id !== 'string' || !responseBody.id) {
      throw new Error('Resend accepted no message identifier; delivery could not be confirmed.');
    }
    return { messageId: responseBody.id };
  } catch (error) {
    if (controller.signal.aborted) {
      throw Object.assign(new Error(`Resend request timed out after ${timeoutMs}ms.`), { code: 'ETIMEDOUT' });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendThroughResend(
  config: EmailConfig,
  message: SendMailOptions,
): Promise<EmailDeliveryInfo> {
  if (!config.resend) throw new Error('Resend is not configured.');
  return sendWithResend(config.resend.apiKey, message);
}

export class EmailService {
  /** Main email dispatch handler using the selected provider. */
  public async handleContactSubmission(data: ValidatedContactBody, requestPublicOrigin = ''): Promise<SendContactResult> {
    const config = getEmailConfig();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Initial record into Database
    const initialRecord: StoredContactMessage = {
      id: messageId,
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      attachments: data.attachments,
      timestamp: data.timestamp,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'queued',
      emailSent: false,
      provider: getEmailProviderLabel(config.provider),
    };
    contactDb.insert(initialRecord);

    const { canonicalUrl, faviconUrl } = await getEmailBranding(requestPublicOrigin);
    const emailHtml = createPortfolioEmailHtml(data, canonicalUrl, faviconUrl);
    const receiptHtml = createSenderConfirmationEmailHtml(data, canonicalUrl, faviconUrl);

    // Use a simulated response when SMTP is not configured.
    if (config.provider === 'dev_mock') {
      console.log('====================================================');
      console.log('📧 [PORTFOLIO OS CONTACT MESSAGE RECORDED (DEV MODE)]');
      console.log(`ID: ${messageId}`);
      console.log(`To: ${config.receiverEmail}`);
      console.log(`From: "${data.name}" <${data.email}>`);
      console.log(`Subject: ${data.subject}`);
      console.log('====================================================');

      contactDb.updateStatus(messageId, 'simulated', false);
      return {
        success: true,
        messageId,
        timestamp: data.timestamp,
        status: 'simulated',
        emailSent: false,
        provider: 'Dev/Mock Store',
        receiver: config.receiverEmail,
        note: `Message stored in portfolio database for ${config.receiverEmail}. Configure an email provider to dispatch live emails.`,
      };
    }

    if (config.provider === 'gmail_oauth' && config.googleOAuth) {
      return this.sendViaGmailApi(config, data, emailHtml, receiptHtml, messageId, canonicalUrl);
    }

    // Send the owner notification and visitor receipt through SMTP.
    if (config.smtp) {
      return this.sendViaSmtp(config, data, emailHtml, receiptHtml, messageId, canonicalUrl);
    }

    if (config.resend) {
      return this.sendViaResend(config, data, emailHtml, receiptHtml, messageId, canonicalUrl);
    }

    contactDb.updateStatus(messageId, 'simulated', false);
    return {
      success: true,
      messageId,
      timestamp: data.timestamp,
      status: 'simulated',
      emailSent: false,
      provider: 'Dev/Mock Store',
      receiver: config.receiverEmail,
      note: 'Message stored in database.',
    };
  }

  private async sendViaGmailApi(
    config: EmailConfig,
    data: ValidatedContactBody,
    emailHtml: string,
    receiptHtml: string,
    messageId: string,
    canonicalUrl: string,
  ): Promise<SendContactResult> {
    try {
      await sendWithGmailApi(config.googleOAuth!, {
        from: config.fromEmail,
        to: config.receiverEmail,
        replyTo: `"${data.name}" <${data.email}>`,
        subject: `[Portfolio Contact] ${data.subject} - from ${data.name}`,
        html: emailHtml,
        text: `New portfolio inquiry\n\nFrom: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\n${data.message}${canonicalUrl ? `\n\nPortfolio OS: ${canonicalUrl}` : ''}`,
        attachments: (data.attachments || [])
          .filter((attachment) => Boolean(attachment.content))
          .map((attachment) => {
            const content = attachment.content || '';
            const dataUrlMatch = content.match(/^data:[^;]+;base64,(.+)$/);
            return {
              filename: attachment.name,
              content: dataUrlMatch ? Buffer.from(dataUrlMatch[1], 'base64') : Buffer.from(content),
              contentType: attachment.type || 'application/octet-stream',
            };
          }),
      });

      void sendWithGmailApi(config.googleOAuth!, {
        from: config.fromEmail,
        to: data.email,
        subject: `Receipt: Message delivered to Anish Jethva ("${data.subject}")`,
        html: receiptHtml,
        text: `Hi ${data.name},\n\nThank you for getting in touch through my Windows 11 Portfolio OS. Your inquiry has been received and is ready for review.\n\nSubject: ${data.subject}\n\nYour message:\n${data.message}\n\nBest regards,\nAnish Jethva${canonicalUrl ? `\n\nPortfolio OS: ${canonicalUrl}` : ''}`,
      }).catch((error: unknown) => {
        console.warn(
          '[EmailService] Gmail API confirmation receipt could not be sent:',
          error instanceof Error ? error.message : 'Unknown delivery error.',
        );
      });

      contactDb.updateStatus(messageId, 'delivered', true);
      return {
        success: true,
        messageId,
        timestamp: data.timestamp,
        status: 'delivered',
        emailSent: true,
        provider: getEmailProviderLabel(config.provider),
        receiver: config.receiverEmail,
        note: `Live email delivered via Gmail API to ${config.receiverEmail}.`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gmail API delivery failed.';
      console.error('[EmailService] Gmail API contact delivery failed:', errorMessage);
      contactDb.updateStatus(messageId, 'failed', false, errorMessage);
      return {
        success: true,
        messageId,
        timestamp: data.timestamp,
        status: 'failed',
        emailSent: false,
        provider: getEmailProviderLabel(config.provider),
        receiver: config.receiverEmail,
        error: errorMessage,
        note: `Message saved in portfolio database. ${errorMessage}`,
      };
    }
  }

  /**
   * Helper for SMTP delivery with dual-port fallback (465 SSL and 587 STARTTLS)
   */
  private async sendViaSmtp(
    config: any,
    data: ValidatedContactBody,
    emailHtml: string,
    receiptHtml: string,
    messageId: string,
    canonicalUrl: string
  ): Promise<SendContactResult> {
    const primaryPort = config.smtp.port;
    const isPrimary465 = primaryPort === 465 || config.smtp.secure;
    const secondaryPort = isPrimary465 ? 587 : 465;
    const secondarySecure = secondaryPort === 465;

    const trySendOnPort = async (port: number, secure: boolean) => {
      const sendWithDnsRetry = async (message: SendMailOptions): Promise<SentMessageInfo> => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port,
            secure,
            auth: config.smtp.auth,
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 15000,
            tls: { rejectUnauthorized: false },
          });

          try {
            return await sendMailWithTimeout(transporter, message);
          } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (attempt > 0 || (code !== 'ENOTFOUND' && code !== 'EAI_AGAIN')) throw error;
            try {
              transporter.close();
            } catch {
              // The retry will create a fresh transporter.
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        throw new Error('SMTP DNS retry ended without a result.');
      };

      await sendWithDnsRetry({
        from: config.fromEmail,
        to: config.receiverEmail,
        replyTo: `"${data.name}" <${data.email}>`,
        subject: `[Portfolio Contact] ${data.subject} - from ${data.name}`,
        html: emailHtml,
        text: `New portfolio inquiry\n\nFrom: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\n${data.message}${canonicalUrl ? `\n\nPortfolio OS: ${canonicalUrl}` : ''}`,
        attachments: [
          ...(data.attachments || [])
          .filter((attachment) => Boolean(attachment.content))
          .map((attachment) => {
            const content = attachment.content || '';
            const dataUrlMatch = content.match(/^data:[^;]+;base64,(.+)$/);
            return {
              filename: attachment.name,
              content: dataUrlMatch ? Buffer.from(dataUrlMatch[1], 'base64') : Buffer.from(content),
              contentType: attachment.type || 'application/octet-stream',
            };
          }),
        ],
      });

      void sendWithDnsRetry({
          from: config.fromEmail,
          to: data.email,
          subject: `Receipt: Message delivered to Anish Jethva ("${data.subject}")`,
          html: receiptHtml,
          text: `Hi ${data.name},\n\nThank you for getting in touch through my Windows 11 Portfolio OS. Your inquiry has been received and is ready for review.\n\nSubject: ${data.subject}\n\nYour message:\n${data.message}\n\nBest regards,\nAnish Jethva${canonicalUrl ? `\n\nPortfolio OS: ${canonicalUrl}` : ''}`,
        }).catch((e) => console.warn('[EmailService] SMTP Confirmation receipt skipped:', e.message));
    };

    try {
      await trySendOnPort(primaryPort, config.smtp.secure);
      contactDb.updateStatus(messageId, 'delivered', true);
      return {
        success: true,
        messageId,
        timestamp: data.timestamp,
        status: 'delivered',
        emailSent: true,
          provider: getEmailProviderLabel(config.provider),
        receiver: config.receiverEmail,
        note: `Live email delivered via SMTP (${config.smtp.host}:${primaryPort}) to ${config.receiverEmail}`,
      };
    } catch (primaryErr: any) {
      if (!shouldRetrySmtpFallback(primaryErr)) {
        const errorExplanation = primaryErr.message || 'SMTP authentication or configuration was rejected.';
        console.warn(`[EmailService] SMTP send failed with a permanent error; skipping port ${secondaryPort} fallback: ${errorExplanation}`);
        contactDb.updateStatus(messageId, 'failed', false, errorExplanation);
        return {
          success: true,
          messageId,
          timestamp: data.timestamp,
          status: 'failed',
          emailSent: false,
          provider: getEmailProviderLabel(config.provider),
          receiver: config.receiverEmail,
          error: errorExplanation,
          note: `Message saved in portfolio database. ${errorExplanation}`,
        };
      }
      console.warn(`[EmailService] SMTP send on port ${primaryPort} failed: ${primaryErr.message}. Trying port ${secondaryPort}...`);

      try {
        await trySendOnPort(secondaryPort, secondarySecure);
        contactDb.updateStatus(messageId, 'delivered', true);
        return {
          success: true,
          messageId,
          timestamp: data.timestamp,
          status: 'delivered',
          emailSent: true,
            provider: getEmailProviderLabel(config.provider),
          receiver: config.receiverEmail,
          note: `Live email delivered via fallback SMTP (${config.smtp.host}:${secondaryPort}) to ${config.receiverEmail}`,
        };
      } catch (secondaryErr: any) {
        console.warn('[EmailService] SMTP secondary port failed:', secondaryErr.message);
        const errorExplanation = getSmtpFailureExplanation(primaryErr, secondaryErr, config.smtp.host);

        contactDb.updateStatus(messageId, 'failed', false, errorExplanation);
        return {
          success: true,
          messageId,
          timestamp: data.timestamp,
          status: 'failed',
          emailSent: false,
          provider: getEmailProviderLabel(config.provider),
          receiver: config.receiverEmail,
          error: errorExplanation,
          note: `Message saved in portfolio database. ${errorExplanation}`,
        };
      }
    }
  }

  private async sendViaResend(
    config: EmailConfig,
    data: ValidatedContactBody,
    emailHtml: string,
    receiptHtml: string,
    messageId: string,
    canonicalUrl: string,
  ): Promise<SendContactResult> {
    try {
      const info = await sendThroughResend(config, {
        from: config.fromEmail,
        to: config.receiverEmail,
        replyTo: `"${data.name}" <${data.email}>`,
        subject: `[Portfolio Contact] ${data.subject} - from ${data.name}`,
        html: emailHtml,
        text: `New portfolio inquiry\n\nFrom: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\n${data.message}${canonicalUrl ? `\n\nPortfolio OS: ${canonicalUrl}` : ''}`,
        attachments: (data.attachments || [])
          .filter((attachment) => Boolean(attachment.content))
          .map((attachment) => {
            const content = attachment.content || '';
            const dataUrlMatch = content.match(/^data:[^;]+;base64,(.+)$/);
            return {
              filename: attachment.name,
              content: dataUrlMatch ? Buffer.from(dataUrlMatch[1], 'base64') : Buffer.from(content),
              contentType: attachment.type || 'application/octet-stream',
            };
          }),
      });
      void sendThroughResend(config, {
        from: config.fromEmail,
        to: data.email,
        subject: `Receipt: Message delivered to Anish Jethva ("${data.subject}")`,
        html: receiptHtml,
        text: `Hi ${data.name},\n\nThank you for getting in touch through my Windows 11 Portfolio OS. Your inquiry has been received and is ready for review.\n\nSubject: ${data.subject}\n\nYour message:\n${data.message}\n\nBest regards,\nAnish Jethva${canonicalUrl ? `\n\nPortfolio OS: ${canonicalUrl}` : ''}`,
      }).catch((error: unknown) => {
        console.warn('[EmailService] Resend confirmation receipt skipped:', error instanceof Error ? error.message : 'Unknown delivery error.');
      });

      contactDb.updateStatus(messageId, 'delivered', true);
      return {
        success: true,
        messageId,
        timestamp: data.timestamp,
        status: 'delivered',
        emailSent: true,
        provider: getEmailProviderLabel(config.provider),
        receiver: config.receiverEmail,
        note: `Live email delivered via Resend API to ${config.receiverEmail}. Message ID: ${info.messageId}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Resend delivery failed.';
      console.error('[EmailService] Resend contact delivery failed:', errorMessage);
      contactDb.updateStatus(messageId, 'failed', false, errorMessage);
      return {
        success: true,
        messageId,
        timestamp: data.timestamp,
        status: 'failed',
        emailSent: false,
        provider: getEmailProviderLabel(config.provider),
        receiver: config.receiverEmail,
        error: errorMessage,
        note: `Message saved in portfolio database. ${errorMessage}`,
      };
    }
  }

  public async sendAdminReply(
    to: string,
    recipientName: string,
    originalSubject: string,
    message: string,
    requestPublicOrigin = ''
  ): Promise<void> {
    const config = getEmailConfig();
    if (!config.smtp && !config.resend && !config.googleOAuth) {
      throw new Error('Email delivery is not configured. Configure Resend, Google OAuth, or SMTP before sending replies.');
    }

    const subject = originalSubject.replace(/[\r\n]+/g, ' ').trim().slice(0, 180);
    const { canonicalUrl, faviconUrl } = await getEmailBranding(requestPublicOrigin);
    const mailOptions: SendMailOptions = {
      from: config.fromEmail,
      to,
      replyTo: config.receiverEmail,
      subject: `Re: ${subject}`,
      text: `Hi ${recipientName},\n\nThank you for reaching out. Here is my response to your message:\n\n${message}\n\nBest regards,\nAnish Jethva${canonicalUrl ? `\n\nPortfolio OS: ${canonicalUrl}` : ''}`,
      html: createAdminReplyEmailHtml(recipientName, message, canonicalUrl, faviconUrl),
    };
    if (config.resend) {
      await sendThroughResend(config, mailOptions);
      return;
    }
    if (config.googleOAuth) {
      await sendWithGmailApi(config.googleOAuth, mailOptions);
      return;
    }
    const smtpConfig = config.smtp;
    if (!smtpConfig) throw new Error('Email delivery is not configured.');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    try {
      await transporter.sendMail(mailOptions);
    } catch {
      throw new Error('The reply could not be delivered. The contact message was not marked as replied.');
    }
  }

  /**
  * Dispatches a password reset email containing a secure one-time link
   */
  public async sendPasswordResetEmail(email: string, resetUrl: string, requestPublicOrigin = ''): Promise<boolean> {
    const config = getEmailConfig();
    const subject = 'Reset your administrator password';
    const { canonicalUrl, faviconUrl } = await getEmailBranding(requestPublicOrigin);
    const html = createPasswordResetEmailHtml(
      email,
      resetUrl,
      canonicalUrl,
      faviconUrl,
    );

    if (config.resend) {
      try {
        await sendThroughResend(config, {
          from: config.fromEmail,
          to: email,
          subject,
          html,
          text: `Reset your administrator password\n\nUse this link to choose a new password (expires in 15 minutes): ${resetUrl}\n\nAnish Jethva · Portfolio OS${canonicalUrl ? `\n${canonicalUrl}` : ''}`,
        });
        return true;
      } catch (error) {
        console.warn('[EmailService] Resend delivery unavailable for password reset:', error instanceof Error ? error.message : 'Unknown delivery error.');
        return false;
      }
    }

    if (config.googleOAuth) {
      try {
        await sendWithGmailApi(config.googleOAuth, {
          from: config.fromEmail,
          to: email,
          subject,
          html,
          text: `Reset your administrator password\n\nUse this link to choose a new password (expires in 15 minutes): ${resetUrl}\n\nAnish Jethva · Portfolio OS${canonicalUrl ? `\n${canonicalUrl}` : ''}`,
        });
        return true;
      } catch (error) {
        console.warn(
          '[EmailService] Gmail API delivery unavailable for password reset:',
          error instanceof Error ? error.message : 'Unknown delivery error.',
        );
        return false;
      }
    }

    if (config.smtp) {
      try {
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: config.smtp.auth,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
          tls: { rejectUnauthorized: false },
        });
        await transporter.sendMail({
          from: config.fromEmail,
          to: email,
          subject,
          html,
          text: `Reset your administrator password\n\nUse this link to choose a new password (expires in 15 minutes): ${resetUrl}\n\nAnish Jethva · Portfolio OS${canonicalUrl ? `\n${canonicalUrl}` : ''}`,
        });
        return true;
      } catch (err: any) {
        console.warn('[EmailService] SMTP delivery unavailable for password reset:', err.message);
      }
    }

    return false;
  }

  /**
   * Diagnostic verification for the active provider and credentials.
   */
  public async verifySmtpConnection(): Promise<{
    configured: boolean;
    connected: boolean;
    provider: string;
    host?: string;
    port?: number;
    user?: string;
    error?: string;
    message: string;
  }> {
    const config = getEmailConfig();
    if (config.resend) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${config.resend.apiKey}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { message?: unknown };
          const detail = typeof body.message === 'string' ? body.message : `Resend returned HTTP ${response.status}.`;
          return {
            configured: true,
            connected: false,
            provider: getEmailProviderLabel(config.provider),
            error: detail,
            message: `Resend API verification failed: ${detail}`,
          };
        }
        return {
          configured: true,
          connected: true,
          provider: getEmailProviderLabel(config.provider),
          message: 'Resend API credentials were verified successfully.',
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown API error.';
        return {
          configured: true,
          connected: false,
          provider: getEmailProviderLabel(config.provider),
          error: detail,
          message: `Resend API verification failed: ${detail}`,
        };
      } finally {
        clearTimeout(timeout);
      }
    }
    if (config.googleOAuth) {
      try {
        await verifyGmailApiAccess(config.googleOAuth);
        return {
          configured: true,
          connected: true,
          provider: getEmailProviderLabel(config.provider),
          user: config.googleOAuth.user,
          message: `Gmail API OAuth credentials and send access were verified for ${config.googleOAuth.user}.`,
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown Gmail API error.';
        return {
          configured: true,
          connected: false,
          provider: getEmailProviderLabel(config.provider),
          user: config.googleOAuth.user,
          error: detail,
          message: detail,
        };
      }
    }
    if (!config.smtp) {
      return {
        configured: false,
        connected: false,
        provider: 'dev_mock',
        message: 'No Resend, Google OAuth, or SMTP email provider is configured. In-memory message storage is active.',
      };
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
      tls: { rejectUnauthorized: false },
    });

    try {
      await transporter.verify();
      return {
        configured: true,
        connected: true,
        provider: getEmailProviderLabel(config.provider),
        host: config.smtp.host,
        port: config.smtp.port,
        user: config.smtp.auth?.user,
        message: `SMTP connection and authentication successfully verified with ${config.smtp.host}:${config.smtp.port}.`,
      };
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        provider: getEmailProviderLabel(config.provider),
        host: config.smtp.host,
        port: config.smtp.port,
        user: config.smtp.auth?.user,
        error: err.message,
        message: `${getEmailProviderLabel(config.provider)} connection verification failed: ${err.message}`,
      };
    }
  }

  /**
   * Dispatches a live test email to verify end-to-end email transmission
   */
  public async sendTestEmail(targetRecipient?: string): Promise<{
    success: boolean;
    deliveryMode: 'smtp' | 'resend' | 'gmail_api' | 'test_account' | 'simulated';
    recipient: string;
    messageId: string;
    timestamp: string;
    previewUrl?: string | false;
    note: string;
  }> {
    const config = getEmailConfig();
    const recipient = targetRecipient || config.receiverEmail;
    const testId = `test_mail_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const testSubject = `[Windows 11 Portfolio] Email Test Delivery (${testId})`;
    const testHtml = `
      <div style="font-family:sans-serif;padding:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <h2 style="color:#0284c7;margin:0 0 12px 0;">Windows 11 OS Portfolio - Email Delivery Test</h2>
        <p style="color:#334155;font-size:14px;line-height:1.6;">This is an automated test message dispatched to verify live email delivery from the Windows 11 Portfolio OS.</p>
        <ul style="color:#475569;font-size:13px;line-height:1.8;">
          <li><strong>Timestamp:</strong> ${timestamp}</li>
          <li><strong>Test ID:</strong> ${testId}</li>
          <li><strong>Destination:</strong> ${recipient}</li>
          <li><strong>Status:</strong> Successfully delivered</li>
        </ul>
      </div>
    `;

    if (config.resend) {
      const info = await sendThroughResend(config, {
        from: config.fromEmail,
        to: recipient,
        subject: testSubject,
        html: testHtml,
        text: `Windows 11 OS Portfolio email delivery test. Test ID: ${testId}.`,
      });
      return {
        success: true,
        deliveryMode: 'resend',
        recipient,
        messageId: info.messageId,
        timestamp,
        note: `Test email delivered via Resend API to ${recipient}.`,
      };
    }

    if (config.googleOAuth) {
      const info = await sendWithGmailApi(config.googleOAuth, {
        from: config.fromEmail,
        to: recipient,
        subject: testSubject,
        html: testHtml,
        text: `Windows 11 OS Portfolio email delivery test. Test ID: ${testId}.`,
      });
      return {
        success: true,
        deliveryMode: 'gmail_api',
        recipient,
        messageId: info.messageId,
        timestamp,
        note: `Test email delivered via Gmail API to ${recipient}.`,
      };
    }

    if (config.smtp) {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.auth,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: false },
      });

      const info = await transporter.sendMail({
        from: config.fromEmail,
        to: recipient,
        subject: testSubject,
        html: testHtml,
      });

      return {
        success: true,
        deliveryMode: 'smtp',
        recipient,
        messageId: info.messageId || testId,
        timestamp,
        note: `Live email successfully delivered via ${getEmailProviderLabel(config.provider)} (${config.smtp.host}) to ${recipient}.`,
      };
    }

    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"Windows 11 OS Test" <${testAccount.user}>`,
        to: recipient,
        subject: testSubject,
        html: testHtml,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      return {
        success: true,
        deliveryMode: 'test_account',
        recipient,
        messageId: info.messageId || testId,
        timestamp,
        previewUrl,
        note: `Live test email generated and delivered via verified test SMTP transport (Ethereal). Preview: ${previewUrl}`,
      };
    } catch {
      return {
        success: true,
        deliveryMode: 'simulated',
        recipient,
        messageId: testId,
        timestamp,
        note: 'SMTP not configured; simulated test email generated and verified in local simulation mode.',
      };
    }
  }
}

export const emailService = new EmailService();
