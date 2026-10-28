export interface SeoContent {
  profile?: {
    name?: unknown;
    title?: unknown;
    bio?: unknown;
    avatar?: unknown;
  };
  siteSettings?: {
    siteName?: unknown;
    siteTitle?: unknown;
    metaDescription?: unknown;
    faviconUrl?: unknown;
    socialImageUrl?: unknown;
    openGraphTitle?: unknown;
    openGraphDescription?: unknown;
    canonicalUrl?: unknown;
    twitterCard?: unknown;
    twitterTitle?: unknown;
    twitterDescription?: unknown;
  };
}

export interface SeoMetadata {
  siteName: string;
  title: string;
  description: string;
  canonicalUrl: string;
  faviconUrl: string;
  socialImageUrl: string;
  openGraphTitle: string;
  openGraphDescription: string;
  twitterCard: 'summary' | 'summary_large_image';
  twitterTitle: string;
  twitterDescription: string;
}

const FALLBACK_TITLE = 'Developer Portfolio';
const FALLBACK_DESCRIPTION = 'Interactive developer portfolio.';
const FALLBACK_IMAGE = '/avatar.png';

function safeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return text ? text.slice(0, maxLength) : fallback;
}

export function resolvePublicUrl(value: unknown, baseUrl: string, fallback: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return 'https://example.invalid/avatar.png';
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    return 'https://example.invalid/avatar.png';
  }
  const defaultUrl = new URL(FALLBACK_IMAGE, base).href;
  let fallbackUrl = defaultUrl;
  try {
    const parsedFallback = new URL(fallback, base);
    if (['http:', 'https:'].includes(parsedFallback.protocol) && !parsedFallback.username && !parsedFallback.password) {
      fallbackUrl = parsedFallback.href;
    }
  } catch {
    fallbackUrl = defaultUrl;
  }
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
  const profile = content.profile || {};
  const settings = content.siteSettings || {};
  const profileName = safeText(profile.name, '', 160);
  const profileTitle = safeText(profile.title, '', 160);
  const profileBio = safeText(profile.bio, FALLBACK_DESCRIPTION, 320);
  const siteName = safeText(settings.siteName, profileName || FALLBACK_TITLE, 160);
  const titleFallback = profileName
    ? `${profileName}${profileTitle ? ` | ${profileTitle}` : ''}`
    : FALLBACK_TITLE;
  const title = safeText(settings.siteTitle, titleFallback, 120);
  const description = safeText(settings.metaDescription, profileBio, 320);
  const canonicalUrl = resolvePublicUrl(settings.canonicalUrl, baseUrl, '/');
  const faviconUrl = resolvePublicUrl(settings.faviconUrl, baseUrl, FALLBACK_IMAGE);
  const profileAvatarUrl = resolvePublicUrl(profile.avatar, baseUrl, FALLBACK_IMAGE);
  const socialImageUrl = resolvePublicUrl(settings.socialImageUrl, baseUrl, profileAvatarUrl);
  const openGraphTitle = safeText(settings.openGraphTitle, title, 120);
  const openGraphDescription = safeText(settings.openGraphDescription, description, 320);
  const twitterCard = settings.twitterCard === 'summary' || settings.twitterCard === 'summary_large_image'
    ? settings.twitterCard
    : 'summary_large_image';

  return {
    siteName,
    title,
    description,
    canonicalUrl,
    faviconUrl,
    socialImageUrl,
    openGraphTitle,
    openGraphDescription,
    twitterCard,
    twitterTitle: safeText(settings.twitterTitle, openGraphTitle, 120),
    twitterDescription: safeText(settings.twitterDescription, openGraphDescription, 320),
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

export function applySeoMetadata(content: SeoContent, baseUrl: string, targetDocument = document): SeoMetadata {
  const metadata = buildSeoMetadata(content, baseUrl);
  targetDocument.title = metadata.title;

  upsertMeta(targetDocument.head, targetDocument, 'name', 'description', metadata.description);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:site_name', metadata.siteName);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:title', metadata.openGraphTitle);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:description', metadata.openGraphDescription);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:image', metadata.socialImageUrl);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:url', metadata.canonicalUrl);
  upsertMeta(targetDocument.head, targetDocument, 'property', 'og:type', 'website');
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:card', metadata.twitterCard);
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:title', metadata.twitterTitle);
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:description', metadata.twitterDescription);
  upsertMeta(targetDocument.head, targetDocument, 'name', 'twitter:image', metadata.socialImageUrl);

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

  const icon = removeDuplicateElements(
    targetDocument.head,
    'link[rel="icon"]',
    () => {
      const link = targetDocument.createElement('link');
      link.rel = 'icon';
      return link;
    },
  );
  icon.href = metadata.faviconUrl;

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
  const websiteData: Record<string, string> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: metadata.siteName,
    url: metadata.canonicalUrl,
  };
  structuredData.textContent = JSON.stringify(websiteData).replace(/</g, '\\u003c');

  return metadata;
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
    ['property', 'og:url', metadata.canonicalUrl],
    ['property', 'og:type', 'website'],
    ['name', 'twitter:card', metadata.twitterCard],
    ['name', 'twitter:title', metadata.twitterTitle],
    ['name', 'twitter:description', metadata.twitterDescription],
    ['name', 'twitter:image', metadata.socialImageUrl],
  ];

  let output = html;
  for (const [attribute, key, value] of metaTags) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selector = new RegExp(`<meta\\b(?=[^>]*\\b(?:name|property)=["']${escapedKey}["'])[^>]*>`, 'gi');
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
  output = replaceHeadTag(
    output,
    /<link\b(?=[^>]*\brel=["'](?:shortcut\s+)?icon["'])[^>]*>/gi,
    `<link rel="icon" href="${escapeAttribute(metadata.faviconUrl)}" data-seo="icon" />`,
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: metadata.siteName,
    url: metadata.canonicalUrl,
  };
  const jsonLdHtml = `<script id="website-jsonld" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`;
  output = replaceHeadTag(output, /<script\b(?=[^>]*\bid=["']website-jsonld["'])[^>]*>[\s\S]*?<\/script>/gi, jsonLdHtml);
  return output;
}
