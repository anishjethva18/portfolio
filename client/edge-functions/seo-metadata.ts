import { privacyPolicyIntroduction, privacyPolicyLastUpdated, privacyPolicySections } from '../src/pages/privacyPolicyContent.ts';
import { createRouteSeoContent, renderSeoMetadataHtml, stripSeoMetadataHtml, type SeoContent } from '../src/utils/seoMetadata.ts';
import { getApplicationRoute, getPublicApplicationRoutes } from '../src/utils/applicationRoutes.ts';

type EdgeContext = {
  next: () => Promise<Response>;
};

type SeoApiResponse = {
  success?: boolean;
  published?: boolean;
  content?: SeoContent;
};

type PublicProfilePayload = {
  name?: unknown;
  email?: unknown;
  socials?: Record<string, unknown>;
  socialLinks?: Array<{ label?: unknown; url?: unknown }>;
  siteSettings?: { disabledApps?: unknown[] };
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const cleanText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const renderInfoMarkup = (profile: PublicProfilePayload | null, origin: string, siteName: string): string => {
  const links: Array<{ label: string; href: string }> = [];
  const addLink = (label: unknown, rawHref: unknown) => {
    if (typeof rawHref !== 'string' || !rawHref.trim()) return;
    try {
      const parsed = new URL(rawHref, origin);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return;
      links.push({ label: cleanText(label), href: parsed.href });
    } catch {
      return;
    }
  };
  addLink('Email', typeof profile?.email === 'string' ? `mailto:${profile.email}` : '');
  for (const [label, href] of Object.entries(profile?.socials || {})) addLink(label, href);
  for (const link of profile?.socialLinks || []) addLink(link.label, link.url);

  const disabledApps = Array.isArray(profile?.siteSettings?.disabledApps)
    ? profile.siteSettings.disabledApps.filter((appId): appId is string => typeof appId === 'string')
    : [];
  const appMarkup = getPublicApplicationRoutes(disabledApps).map((route) =>
    `<li style="list-style:none"><a href="${escapeHtml(route.path)}" aria-label="Open ${escapeHtml(route.app.name)}" style="display:flex;align-items:flex-start;gap:14px;min-height:112px;padding:18px;border:1px solid #e2e8f0;border-radius:16px;background:white;color:#0f172a;text-decoration:none"><span aria-hidden="true" style="display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:12px;background:#eff6ff;color:#0369a1"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg></span><span><strong style="display:block">${escapeHtml(route.app.name)}</strong><span style="display:block;margin-top:5px;color:#475569;font-size:14px">${escapeHtml(route.description)}</span></span></a></li>`
  ).join('');
  const contactMarkup = links.length
    ? `<ul>${links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label || link.href)}</a></li>`).join('')}</ul>`
    : '<p>Published developer contact information is currently unavailable.</p>';

  return `<main style="height:100dvh;overflow-y:auto;overscroll-behavior-y:contain;background:#f7f9fc;color:#0f172a;font:16px/1.65 system-ui,sans-serif;box-sizing:border-box"><article style="max-width:960px;margin:0 auto;padding:0 20px"><header style="position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;background:rgba(255,255,255,.96);padding:16px 8px"><strong>${escapeHtml(siteName)}</strong><span>Portfolio</span></header><section style="max-width:720px;padding:48px 0"><p style="color:#0369a1;font-size:14px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(siteName)} · Portfolio</p><h1 style="font-size:clamp(2rem,5vw,3rem);line-height:1.15">An Interactive Windows 11 Portfolio</h1><p>A desktop-inspired website for exploring Anish Jethva’s professional portfolio. Visitors can open the published applications from the desktop or application links below to view portfolio information and tools.</p></section><section style="border:1px solid #e2e8f0;border-radius:24px;background:white;padding:24px"><h2>About this website</h2><dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px"><div><dt>Website owner</dt><dd>Anish Jethva</dd></div><div><dt>Website type</dt><dd>Personal portfolio</dd></div><div><dt>Purpose</dt><dd>Showcase professional background, projects, skills, and contact information</dd></div></dl></section><section style="padding:40px 0"><h2>Portfolio applications</h2><p>These applications provide focused ways to explore the portfolio. This list includes only public applications currently published in the Admin Panel.</p><ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin:20px 0;padding:0">${appMarkup}</ul></section><section style="border:1px solid #e2e8f0;border-radius:24px;background:white;padding:24px"><h2>Privacy and support</h2><p>For questions about the website or its content, contact the developer using a published contact method.</p>${contactMarkup}<p><a href="/privacy-policy">Privacy Policy</a></p></section><footer style="margin-top:40px;border-top:1px solid #e2e8f0;padding:24px 8px;color:#64748b;font-size:14px;text-align:center">© ${new Date().getFullYear()} ${escapeHtml(siteName)}</footer></article></main>`;
};

const renderPrivacyMarkup = (siteName: string): string => {
  const sections = privacyPolicySections.map((section, index) =>
    `<section id="privacy-section-${index + 1}" style="padding:28px 0;border-bottom:1px solid #e2e8f0;scroll-margin-top:96px"><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}${'contactEmail' in section ? `<p><a href="mailto:${escapeHtml(section.contactEmail)}">${escapeHtml(section.contactEmail)}</a></p>` : ''}</section>`
  ).join('');
  const toc = privacyPolicySections.map((section, index) =>
    `<li><a href="#privacy-section-${index + 1}">${escapeHtml(section.heading.replace(/^\d+\.\s*/, ''))}</a></li>`
  ).join('');
  return `<main style="height:100dvh;box-sizing:border-box;overflow-y:auto;scroll-behavior:smooth;background:#f7f9fc;color:#0f172a;font:16px/1.8 system-ui,sans-serif"><header style="position:sticky;top:0;z-index:2;border-bottom:1px solid #e2e8f0;background:rgba(255,255,255,.96);padding:16px max(20px,calc((100vw - 960px)/2))"><a href="/app-info" style="color:#0f172a;font-weight:650;text-decoration:none">${escapeHtml(siteName)}</a><span style="float:right;color:#64748b">Portfolio</span></header><article style="max-width:1024px;margin:0 auto;padding:32px 20px 64px"><a href="/app-info" style="color:#0369a1">← Back to Portfolio Information</a><header style="margin-top:32px"><p style="color:#0369a1;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Privacy and transparency</p><h1 style="margin:12px 0 0;font-size:clamp(36px,6vw,56px);line-height:1.1;letter-spacing:-.045em">Privacy Policy</h1><p style="color:#64748b;font-size:14px">Last updated: ${escapeHtml(privacyPolicyLastUpdated)}</p></header><p style="max-width:768px;color:#475569">${escapeHtml(privacyPolicyIntroduction)}</p><nav aria-label="Table of contents" style="margin:32px 0;padding:24px;border:1px solid #e2e8f0;border-radius:20px;background:#fff"><h2 style="margin:0;font-size:16px">On this page</h2><ol style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:4px 24px;padding-left:22px;color:#0369a1">${toc}</ol></nav><div>${sections}</div><footer style="display:flex;justify-content:space-between;gap:16px;margin-top:24px;padding:24px 0;border-top:1px solid #e2e8f0;color:#64748b;font-size:14px">© ${new Date().getFullYear()} ${escapeHtml(siteName)}<a href="/app-info" style="color:#0369a1">Portfolio Information</a></footer></article></main>`;
};

const fetchJson = async <T,>(url: URL): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Public content endpoint returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
};

export async function renderPublicRouteMetadata(request: Request, context: EdgeContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const applicationRoute = getApplicationRoute(path);
  if (
    !['/', '/home', '/app-info', '/privacy-policy'].includes(path) &&
    applicationRoute?.access !== 'public' &&
    applicationRoute?.appId !== 'admin' &&
    path !== '/admin' &&
    !path.startsWith('/admin/')
  ) return context.next();

  const response = await context.next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;

  const html = await response.text();
  try {
    const seoPayload = await fetchJson<SeoApiResponse>(new URL('/api/seo-metadata', url));
    if (!seoPayload.success || !seoPayload.content || typeof seoPayload.published !== 'boolean') {
      throw new Error('Published metadata endpoint returned an invalid response.');
    }

    const content = createRouteSeoContent(seoPayload.content, path, url.href);
    const siteName = cleanText(content.siteSettings?.siteName) || cleanText(content.profile?.name);
    let output = seoPayload.published
      ? renderSeoMetadataHtml(html, content, url.href)
      : stripSeoMetadataHtml(html);

    if (path === '/app-info') {
      let profile: PublicProfilePayload | null = null;
      try {
        profile = await fetchJson<PublicProfilePayload>(new URL('/api/profile', url));
      } catch (error) {
        console.error('[AppInfo] Published profile could not be included in the initial HTML.', error);
      }
      output = output.replace(/<div\b(?=[^>]*\bid=["']root["'])[^>]*>\s*<\/div>/i, `<div id="root">${renderInfoMarkup(profile, url.origin, siteName)}</div>`);
    } else if (path === '/privacy-policy') {
      output = output.replace(/<div\b(?=[^>]*\bid=["']root["'])[^>]*>\s*<\/div>/i, `<div id="root">${renderPrivacyMarkup(siteName)}</div>`);
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('content-range');
    headers.delete('accept-ranges');
    headers.set('Netlify-CDN-Cache-Control', 'no-store');
    headers.set('Cache-Control', 'no-store');
    const status = response.status === 206 ? 200 : response.status;
    return new Response(output, {
      status,
      statusText: status === 200 && response.status === 206 ? 'OK' : response.statusText,
      headers,
    });
  } catch (error) {
    console.error('[SEO] Public route metadata could not be loaded.', error);
    return new Response('Published SEO metadata is temporarily unavailable.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

export const renderHomepageMetadata = renderPublicRouteMetadata;
export default renderPublicRouteMetadata;
