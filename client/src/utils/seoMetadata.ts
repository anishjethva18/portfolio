import { getApplicationRoute } from './applicationRoutes.ts';

export interface SeoContent {
  profile?: {
    name?: unknown;
    title?: unknown;
    bio?: unknown;
    avatar?: unknown;
    website?: unknown;
  };
  siteSettings?: {
    siteName?: unknown;
    siteTitle?: unknown;
    metaDescription?: unknown;
    faviconUrl?: unknown;
    socialImageUrl?: unknown;
    socialImageAlt?: unknown;
    socialImageWidth?: unknown;
    socialImageHeight?: unknown;
    socialImageType?: unknown;
    canonicalUrl?: unknown;
  };
}

export interface SeoMetadata {
  siteName: string;
  alternateNames: string[];
  title: string;
  description: string;
  canonicalUrl: string;
  faviconUrl: string;
  socialImageUrl: string;
  socialImageWidth: number | null;
  socialImageHeight: number | null;
  socialImageType: string;
  socialImageAlt: string;
  openGraphTitle: string;
  openGraphDescription: string;
  twitterCard: 'summary_large_image';
  twitterTitle: string;
  twitterDescription: string;
}

const FAVICON_MIME_TYPES: Record<string, string> = {
  ico: 'image/x-icon',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function getFaviconMimeType(url: string): string | undefined {
  try {
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase();
    return extension ? FAVICON_MIME_TYPES[extension] : undefined;
  } catch {
    return undefined;
  }
}

function safeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return text ? text.slice(0, maxLength) : fallback;
}

export function createRouteSeoContent(content: SeoContent, pathname: string, baseUrl: string): SeoContent {
  const path = pathname.replace(/\/+$/, '') || '/';
  const settings = content.siteSettings || {};
  const profileName = safeText(content.profile?.name, '', 160);
  const siteName = safeText(settings.siteName, profileName, 160);
  const siteTitle = safeText(settings.siteTitle, siteName, 120);
  const routeDescription = path === '/app-info'
    ? 'Learn about this interactive Windows 11 portfolio, its published applications, and how to get in touch.'
    : path === '/privacy-policy'
      ? 'Read the privacy policy for this portfolio, including information about contact submissions, analytics, browser storage, and service providers.'
      : getApplicationRoute(path)?.description;

  const canonicalBase = resolvePublicUrl(settings.canonicalUrl, baseUrl, baseUrl);
  let canonicalUrl = '';
  try {
    const canonical = new URL(canonicalBase);
    canonical.pathname = path;
    canonical.search = '';
    canonical.hash = '';
    canonicalUrl = canonical.href;
  } catch {
    canonicalUrl = '';
  }

  return {
    ...content,
    siteSettings: {
      ...settings,
      siteName,
      siteTitle,
      metaDescription: routeDescription || settings.metaDescription,
      canonicalUrl,
      faviconUrl: resolvePublicUrl(settings.faviconUrl, baseUrl, ''),
      socialImageUrl: resolvePublicUrl(settings.socialImageUrl, canonicalUrl || baseUrl, ''),
    },
  };
}

export function resolvePublicUrl(value: unknown, baseUrl: string, fallback: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    return '';
  }
  const fallbackUrl = (() => {
    if (!fallback) return '';
    try {
      const parsedFallback = new URL(fallback, base);
      return ['http:', 'https:'].includes(parsedFallback.protocol) && !parsedFallback.username && !parsedFallback.password
        ? parsedFallback.href
        : '';
    } catch {
      return '';
    }
  })();
  if (typeof value !== 'string' || !value.trim()) return fallbackUrl;
  const candidate = value.trim();
  if (candidate.includes('\\')) return fallbackUrl;
  if (candidate.startsWith('/') && (candidate.startsWith('//') || candidate.split(/[/?#]/).includes('..'))) {
    return fallbackUrl;
  }

  try {
    const url = new URL(candidate, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return fallbackUrl;
    }
    return url.href;
  } catch {
    return fallbackUrl;
  }
}

export function buildSeoMetadata(content: SeoContent, baseUrl: string): SeoMetadata {
  const settings = content.siteSettings || {};
  const siteName = safeText(settings.siteName, '', 160);
  const title = safeText(settings.siteTitle, '', 120);
  const description = safeText(settings.metaDescription, '', 320);
  const canonicalUrl = resolvePublicUrl(settings.canonicalUrl, baseUrl, '');
  const faviconUrl = resolvePublicUrl(settings.faviconUrl, baseUrl, '');
  const socialImageUrl = resolvePublicUrl(settings.socialImageUrl, baseUrl, '');
  const socialImageWidth = typeof settings.socialImageWidth === 'number' && Number.isSafeInteger(settings.socialImageWidth) && settings.socialImageWidth > 0
    ? settings.socialImageWidth
    : null;
  const socialImageHeight = typeof settings.socialImageHeight === 'number' && Number.isSafeInteger(settings.socialImageHeight) && settings.socialImageHeight > 0
    ? settings.socialImageHeight
    : null;
  const socialImageType = typeof settings.socialImageType === 'string' && /^image\/[a-z0-9.+-]+$/i.test(settings.socialImageType)
    ? settings.socialImageType
    : '';
  const socialImageAlt = safeText(settings.socialImageAlt, socialImageUrl ? `${siteName} social sharing image` : '', 300);
  const twitterCard = 'summary_large_image';

  return {
    siteName,
    alternateNames: siteName ? [`${siteName} Portfolio`] : [],
    title,
    description,
    canonicalUrl,
    faviconUrl,
    socialImageUrl,
    socialImageWidth,
    socialImageHeight,
    socialImageType,
    socialImageAlt,
    openGraphTitle: title,
    openGraphDescription: description,
    twitterCard,
    twitterTitle: title,
    twitterDescription: description,
  };
}

function removeDuplicateElements<T extends Element>(
  head: Document['head'],
  selector: string,
  create: () => T,
): T {
  const matches = Array.from(head.querySelectorAll<T>(selector));
  const element = matches.shift() || create();
  matches.forEach((duplicate) => duplicate.remove());
  if (!element.parentElement) head.appendChild(element);
  return element;
}

function upsertMeta(
  head: Document['head'],
  targetDocument: Document,
  attribute: 'name' | 'property',
  key: string,
  content: string,
): void {
  const element = removeDuplicateElements(
    head,
    `meta[${attribute}="${key}"]`,
    () => {
      const meta = targetDocument.createElement('meta');
      meta.setAttribute(attribute, key);
      return meta;
    },
  );
  element.content = content;
}

function removeMeta(head: Document['head'], attribute: 'name' | 'property', key: string): void {
  head.querySelectorAll(`meta[${attribute}="${key}"]`).forEach((element) => element.remove());
}

function applyFavicon(url: string, targetDocument: Document): void {
  if (!url) {
    targetDocument.head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
      .forEach((icon) => icon.remove());
    return;
  }

  targetDocument.head.querySelectorAll('link[rel="shortcut icon"]')
    .forEach((icon) => icon.remove());
  const icon = removeDuplicateElements(
    targetDocument.head,
    'link[rel="icon"]',
    () => {
      const link = targetDocument.createElement('link');
      link.rel = 'icon';
      return link;
    },
  );
  const faviconUrl = new URL(url, targetDocument.baseURI).href;
  icon.href = faviconUrl;
  const mimeType = getFaviconMimeType(faviconUrl);
  if (mimeType) icon.type = mimeType;
  else icon.removeAttribute('type');
  icon.dataset.configuredFavicon = faviconUrl;
}

export function applyConfiguredFavicon(targetDocument = document): void {
  const icon = targetDocument.head.querySelector<HTMLLinkElement>('link[rel="icon"][data-configured-favicon]');
  const faviconUrl = icon?.dataset.configuredFavicon?.trim();
  if (faviconUrl) applyFavicon(faviconUrl, targetDocument);
}

export function applySeoMetadata(content: SeoContent, baseUrl: string, targetDocument = document): SeoMetadata {
  const metadata = buildSeoMetadata(content, baseUrl);
  targetDocument.title = metadata.title;

  upsertMeta(targetDocument.head, targetDocument, 'name', 'description', metadata.description);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:site_name', metadata.siteName);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:title', metadata.openGraphTitle);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:description', metadata.openGraphDescription);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:image', metadata.socialImageUrl);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:image:secure_url', metadata.socialImageUrl);
  if (metadata.socialImageWidth) upsertMeta(targetDocument.head, targetDocument, 'property', 'og:image:width', String(metadata.socialImageWidth));
  else removeMeta(targetDocument.head, 'property', 'og:image:width');
  if (metadata.socialImageHeight) upsertMeta(targetDocument.head, targetDocument, 'property', 'og:image:height', String(metadata.socialImageHeight));
  else removeMeta(targetDocument.head, 'property', 'og:image:height');
  if (metadata.socialImageType) upsertMeta(targetDocument.head, targetDocument, 'property', 'og:image:type', metadata.socialImageType);
  else removeMeta(targetDocument.head, 'property', 'og:image:type');
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:image:alt', metadata.socialImageAlt);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:url', metadata.canonicalUrl);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:type', 'website');
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:card', metadata.twitterCard);
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:title', metadata.twitterTitle);
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:description', metadata.twitterDescription);
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:image', metadata.socialImageUrl);
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:image:alt', metadata.socialImageAlt);

  const canonical = removeDuplicateElements(
    targetDocument.head,
    'link[rel="canonical"]',
    () => {
      const link = targetDocument.createElement('link');
      link.rel = 'canonical';
      return link;
    },
  );
  canonical.href = metadata.canonicalUrl;

  applyFavicon(metadata.faviconUrl, targetDocument);
  targetDocument.head.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute(
    'data-configured-favicon',
    metadata.faviconUrl,
  );

  const structuredData = removeDuplicateElements(
    targetDocument.head,
    'script#website-jsonld[type="application/ld+json"]',
    () => {
      const script = targetDocument.createElement('script');
      script.id = 'website-jsonld';
      script.type = 'application/ld+json';
      return script;
    },
  );
  const websiteData: Record<string, string | string[]> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: metadata.siteName,
    url: metadata.canonicalUrl,
  };
  if (metadata.alternateNames.length) {
    websiteData.alternateName = metadata.alternateNames;
  }
  structuredData.textContent = JSON.stringify(websiteData).replace(/</g, '\\u003c');

  return metadata;
}

export async function refreshPublishedRouteSeo(
  pathname: string,
  baseUrl: string,
  targetDocument = document,
): Promise<string> {
  const response = await fetch('/api/seo-metadata', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Published SEO metadata could not be loaded (HTTP ${response.status}).`);
  const payload = await response.json() as { success?: boolean; published?: boolean; content?: SeoContent };
  if (!payload.success || typeof payload.published !== 'boolean' || !payload.content) {
    throw new Error('Published SEO metadata response is invalid.');
  }
  const content = createRouteSeoContent(payload.content, pathname, baseUrl);
  return applySeoMetadata(content, baseUrl, targetDocument).siteName;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceHeadTag(html: string, selector: RegExp, replacement: string): string {
  let replaced = false;
  let output = html.replace(selector, () => {
    if (replaced) return '';
    replaced = true;
    return replacement;
  });
  if (!replaced) output = output.replace(/<\/head>/i, `${replacement}\n</head>`);
  return output;
}

export function renderSeoMetadataHtml(html: string, content: SeoContent, baseUrl: string): string {
  const metadata = buildSeoMetadata(content, baseUrl);
  const metaTags: Array<[string, string, string]> = [
    ['name', 'description', metadata.description],
    ['property', 'og:site_name', metadata.siteName],
    ['property', 'og:title', metadata.openGraphTitle],
    ['property', 'og:description', metadata.openGraphDescription],
    ['property', 'og:image', metadata.socialImageUrl],
    ['property', 'og:image:secure_url', metadata.socialImageUrl],
    ['property', 'og:image:alt', metadata.socialImageAlt],
    ['property', 'og:image:width', metadata.socialImageWidth ? String(metadata.socialImageWidth) : ''],
    ['property', 'og:image:height', metadata.socialImageHeight ? String(metadata.socialImageHeight) : ''],
    ['property', 'og:image:type', metadata.socialImageType],
    ['property', 'og:url', metadata.canonicalUrl],
    ['property', 'og:type', 'website'],
    ['name', 'twitter:card', metadata.twitterCard],
    ['name', 'twitter:title', metadata.twitterTitle],
    ['name', 'twitter:description', metadata.twitterDescription],
    ['name', 'twitter:image', metadata.socialImageUrl],
    ['name', 'twitter:image:alt', metadata.socialImageAlt],
  ];
  let output = html;
  for (const [attribute, key, value] of metaTags) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selector = new RegExp(`<meta\\b(?=[^>]*\\b(?:name|property)=["']${escapedKey}["'])[^>]*>`, 'gi');
    if (!value && [
      'og:image',
      'og:image:secure_url',
      'og:image:alt',
      'og:image:width',
      'og:image:height',
      'og:image:type',
      'twitter:image',
      'twitter:image:alt',
    ].includes(key)) {
      output = replaceHeadTag(output, selector, '');
      continue;
    }
    output = replaceHeadTag(
      output,
      selector,
      `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(value)}" data-seo="${escapeAttribute(key)}" />`,
    );
  }

  output = replaceHeadTag(
    output,
    /<title\b[^>]*>[\s\S]*?<\/title>/gi,
    `<title data-seo="title">${escapeAttribute(metadata.title)}</title>`,
  );
  output = replaceHeadTag(
    output,
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi,
    `<link rel="canonical" href="${escapeAttribute(metadata.canonicalUrl)}" data-seo="canonical" />`,
  );
  const faviconSelector = /<link\b(?=[^>]*\brel=["'](?:shortcut\s+)?icon["'])[^>]*>/gi;
  if (metadata.faviconUrl) {
    const initialFaviconType = getFaviconMimeType(metadata.faviconUrl);
    output = replaceHeadTag(
      output,
      faviconSelector,
      `<link rel="icon" href="${escapeAttribute(metadata.faviconUrl)}"${initialFaviconType ? ` type="${escapeAttribute(initialFaviconType)}"` : ''} data-seo="icon" data-configured-favicon="${escapeAttribute(metadata.faviconUrl)}" />`,
    );
  } else {
    output = output.replace(faviconSelector, '');
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: metadata.siteName,
    ...(metadata.alternateNames.length ? { alternateName: metadata.alternateNames } : {}),
    url: metadata.canonicalUrl,
  };
  const jsonLdHtml = `<script id="website-jsonld" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`;
  output = replaceHeadTag(output, /<script\b(?=[^>]*\bid=["']website-jsonld["'])[^>]*>[\s\S]*?<\/script>/gi, jsonLdHtml);
  return output;
}

export function stripSeoMetadataHtml(html: string): string {
  let output = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["'](?:description|twitter:[^"']+)["'])[^>]*>/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty=["']og:[^"']+["'])[^>]*>/gi, '')
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '')
    .replace(/<link\b(?=[^>]*\bdata-seo-favicon-preload=["'])[^>]*>/gi, '')
    .replace(/<link\b(?=[^>]*\brel=["'](?:shortcut\s+)?icon["'])[^>]*>/gi, '')
    .replace(/<script\b(?=[^>]*\bid=["']website-jsonld["'])[^>]*>[\s\S]*?<\/script>/gi, '');
  return output;
}
