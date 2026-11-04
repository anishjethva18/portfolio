import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { renderHomepageMetadata } from '../../client/edge-functions/seo-metadata';
import { applyConfiguredFavicon, buildSeoMetadata, renderSeoMetadataHtml, stripSeoMetadataHtml } from '../../client/src/utils/seoMetadata';
import { AdminContentDraftModel, AdminContentRevisionModel, SiteContentModel } from '../models';
import { contentStudioRouter } from '../routes/contentStudio';
import { contentStudioService } from '../services/contentStudioService';
import { handlePublishedSeoMetadata } from '../services/seoMetadataService';

const publishedContent = {
  profile: {
    name: 'Portfolio Owner',
    title: 'Software Engineer',
    bio: 'A published portfolio description.',
    avatar: '/avatar.png',
  },
  siteSettings: {
    siteName: 'Published Site Name',
    siteTitle: 'Published Homepage Title',
    metaDescription: 'Published homepage description.',
    faviconUrl: '/favicon.png',
    socialImageUrl: '/api/portfolio-media/file-original-social-image',
    socialImageWidth: 1200,
    socialImageHeight: 630,
    socialImageType: 'image/jpeg',
    socialImageAlt: 'A wide portfolio preview image.',
    openGraphTitle: 'Legacy Open Graph override must be ignored',
    openGraphDescription: 'Legacy Open Graph override must be ignored.',
    canonicalUrl: 'https://portfolio.example.test/',
    twitterCard: 'summary',
    twitterTitle: 'Legacy Twitter override must be ignored',
    twitterDescription: 'Legacy Twitter override must be ignored.',
  },
};

function createFaviconDocument(configuredFavicon: string) {
  const attributes = new Map<string, string>();
  const fallback = 'data:image/svg+xml,immediate-aj-fallback';
  const icon = {
    rel: 'icon',
    href: fallback,
    type: 'image/svg+xml',
    dataset: { configuredFavicon },
    parentElement: {},
    hasAttribute: (name: string) => name === 'href' || attributes.has(name),
    setAttribute: (name: string, value: string) => {
      if (name === 'href') icon.href = value;
      else attributes.set(name, value);
    },
    removeAttribute: (name: string) => {
      if (name === 'href') icon.href = '';
      else attributes.delete(name);
    },
  } as unknown as HTMLLinkElement;
  const pendingImages: Array<{
    src: string;
    onload: ((this: GlobalEventHandlers, event: Event) => unknown) | null;
    onerror: ((this: GlobalEventHandlers, event: Event) => unknown) | null;
  }> = [];
  class MockImage {
    src = '';
    onload: ((this: GlobalEventHandlers, event: Event) => unknown) | null = null;
    onerror: ((this: GlobalEventHandlers, event: Event) => unknown) | null = null;

    constructor() {
      pendingImages.push(this);
    }
  }
  const head = {
    querySelectorAll: <T extends Element>() => [icon] as unknown as NodeListOf<T>,
    querySelector: () => icon,
    appendChild: (element: Node) => element,
  };
  const document = {
    baseURI: 'https://portfolio.example.test/',
    head,
    defaultView: { Image: MockImage },
    createElement: () => icon,
  } as unknown as Document;
  return { document, icon, pendingImages, fallback };
}

test('cached website favicon replaces the inline fallback only after its image loads', () => {
  const configuredUrl = 'https://portfolio.example.test/cached-icon.png?test=success';
  const { document, icon, pendingImages, fallback } = createFaviconDocument(configuredUrl);

  applyConfiguredFavicon(document);
  assert.equal(icon.href, fallback);
  assert.equal(pendingImages[0].src, configuredUrl);
  pendingImages[0].onload?.call(pendingImages[0] as unknown as GlobalEventHandlers, new Event('load'));
  assert.equal(icon.href, configuredUrl);
});

test('failed website favicon loading leaves the inline fallback in place', () => {
  const configuredUrl = 'https://portfolio.example.test/missing-icon.png?test=failure';
  const { document, icon, pendingImages, fallback } = createFaviconDocument(configuredUrl);

  applyConfiguredFavicon(document);
  pendingImages[0].onerror?.call(pendingImages[0] as unknown as GlobalEventHandlers, new Event('error'));
  assert.equal(icon.href, fallback);
});

test('homepage metadata is present in the initial HTML exactly once', async () => {
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  const rendered = renderSeoMetadataHtml(html, publishedContent, 'https://portfolio.example.test/');

  for (const selector of [
    /<title\b/gi,
    /<meta\s+name="description"/gi,
    /<link\s+rel="canonical"/gi,
    /<link\s+rel="icon"/gi,
    /property="og:site_name"/gi,
    /property="og:title"/gi,
    /property="og:description"/gi,
    /property="og:image"/gi,
    /property="og:image:secure_url"/gi,
    /property="og:image:width"/gi,
    /property="og:image:height"/gi,
    /property="og:image:type"/gi,
    /property="og:image:alt"/gi,
    /property="og:url"/gi,
    /property="og:type"/gi,
    /name="twitter:card"/gi,
    /name="twitter:title"/gi,
    /name="twitter:description"/gi,
    /name="twitter:image"/gi,
    /id="website-jsonld"/gi,
  ]) {
    assert.equal(rendered.match(selector)?.length, 1, `expected exactly one match for ${selector}`);
  }

  assert.match(rendered, /<title data-seo="title">Published Homepage Title<\/title>/);
  assert.match(rendered, /property="og:site_name" content="Published Site Name"/);
  assert.match(rendered, /property="og:title" content="Published Homepage Title"/);
  assert.match(rendered, /property="og:description" content="Published homepage description\."/);
  assert.match(rendered, /property="og:image" content="https:\/\/portfolio\.example\.test\/api\/portfolio-media\/file-original-social-image"/);
  assert.match(rendered, /property="og:image:width" content="1200"/);
  assert.match(rendered, /property="og:image:height" content="630"/);
  assert.match(rendered, /property="og:image:type" content="image\/jpeg"/);
  assert.match(rendered, /property="og:image:alt" content="A wide portfolio preview image\."/);
  assert.match(rendered, /name="twitter:card" content="summary_large_image"/);
  assert.match(rendered, /rel="canonical" href="https:\/\/portfolio\.example\.test\/"/);
  assert.match(rendered, /rel="icon" href="https:\/\/portfolio\.example\.test\/favicon\.png" type="image\/png"/);
  assert.match(rendered, /data-configured-favicon="https:\/\/portfolio\.example\.test\/favicon\.png"/);
  assert.match(rendered, /rel="preload" as="image" href="https:\/\/portfolio\.example\.test\/favicon\.png"/);
  assert.match(rendered, /name="twitter:title" content="Published Homepage Title"/);
  assert.match(rendered, /name="twitter:description" content="Published homepage description\."/);
  assert.doesNotMatch(rendered, /Legacy Open Graph override|Legacy Twitter override/);
  assert.match(rendered, /name="twitter:image" content="https:\/\/portfolio\.example\.test\/api\/portfolio-media\/file-original-social-image"/);
  assert.equal(
    rendered.match(/property="og:image" content="([^"]+)"/)?.[1],
    rendered.match(/name="twitter:image" content="([^"]+)"/)?.[1],
  );
  const jsonLdText = rendered.match(/<script id="website-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(jsonLdText);
  assert.deepEqual(JSON.parse(jsonLdText), {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Published Site Name',
    alternateName: ['Published Site Name Portfolio'],
    url: 'https://portfolio.example.test/',
  });
});

test('homepage metadata replaces duplicate tags and makes configured image URLs absolute', async () => {
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  const duplicatedHtml = html.replace(
    '</head>',
    `<meta name="description" content="duplicate" />
    <meta property="og:image" content="/old-image.png" />
    <meta name="twitter:image" content="/old-image.png" />
    <link rel="canonical" href="/old-canonical" />
    <link rel="icon" href="/old-icon.png" />
    <script id="website-jsonld" type="application/ld+json">{}</script>
    </head>`,
  );
  const rendered = renderSeoMetadataHtml(duplicatedHtml, publishedContent, 'https://portfolio.example.test/');

  for (const selector of [
    /<meta\s+name="description"/gi,
    /property="og:image"/gi,
    /name="twitter:image"/gi,
    /rel="canonical"/gi,
    /rel="icon"/gi,
    /id="website-jsonld"/gi,
  ]) {
    assert.equal(rendered.match(selector)?.length, 1, `expected exactly one match for ${selector}`);
  }

  for (const url of [
    rendered.match(/data-configured-favicon="([^"]+)"/)?.[1],
    rendered.match(/rel="preload" as="image" href="([^"]+)"/)?.[1],
    rendered.match(/property="og:image" content="([^"]+)"/)?.[1],
    rendered.match(/name="twitter:image" content="([^"]+)"/)?.[1],
  ]) {
    assert.ok(url);
    assert.equal(new URL(url).origin, 'https://portfolio.example.test');
  }
});

test('homepage HTML serves the configured favicon before JavaScript runs', async () => {
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  const rendered = renderSeoMetadataHtml(html, publishedContent, 'https://portfolio.example.test/');
  assert.equal(rendered.match(/<link rel="icon"/g)?.length, 1);
  assert.match(rendered, /<link rel="icon" href="https:\/\/portfolio\.example\.test\/favicon\.png" type="image\/png"/);
  assert.match(rendered, /rel="preload" as="image" href="https:\/\/portfolio\.example\.test\/favicon\.png"/);
});

test('homepage metadata removes stale image dimensions when the published image has none', async () => {
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  const rendered = renderSeoMetadataHtml(
    html,
    { siteSettings: { socialImageUrl: 'https://cdn.example.test/image.jpg' } },
    'https://portfolio.example.test/',
  );
  assert.doesNotMatch(rendered, /property="og:image:width"/);
  assert.doesNotMatch(rendered, /property="og:image:height"/);
  assert.doesNotMatch(rendered, /property="og:image:type"/);
});

test('empty settings use safe absolute defaults and untrusted text is escaped', () => {
  const defaults = buildSeoMetadata({}, 'https://portfolio.example.test/path');
  assert.equal(defaults.canonicalUrl, '');
  assert.equal(defaults.title, '');
  assert.equal(defaults.description, '');
  assert.equal(defaults.faviconUrl, '');
  assert.equal(defaults.socialImageUrl, '');
  assert.equal(defaults.twitterCard, 'summary_large_image');
  const legacySettings = {
    twitterCard: 'summary',
    openGraphTitle: 'Open Graph fallback title',
    openGraphDescription: 'Open Graph fallback description.',
    twitterTitle: 'Twitter override',
    twitterDescription: 'Twitter description override',
    socialImageUrl: '/api/portfolio-media/file-original-social-image',
    socialPreviewUrl: '/social-preview.jpg',
    siteTitle: 'Admin page title',
    metaDescription: 'Admin page description',
  };
  const legacyOverrides = buildSeoMetadata({
    siteSettings: legacySettings,
  }, 'https://portfolio.example.test/');
  assert.equal(legacyOverrides.twitterCard, 'summary_large_image');
  assert.equal(legacyOverrides.openGraphTitle, 'Admin page title');
  assert.equal(legacyOverrides.twitterTitle, 'Admin page title');
  assert.equal(legacyOverrides.openGraphDescription, 'Admin page description');
  assert.equal(legacyOverrides.twitterDescription, 'Admin page description');
  assert.equal(legacyOverrides.socialImageUrl, 'https://portfolio.example.test/api/portfolio-media/file-original-social-image');
  assert.equal(buildSeoMetadata({
    profile: { website: 'https://profile.example.test/' },
    siteSettings: {},
  }, 'https://portfolio.example.test/').canonicalUrl, '');
  const invalidImageFallback = buildSeoMetadata(
    { profile: { avatar: 'javascript:alert(1)' }, siteSettings: { socialImageUrl: 'javascript:alert(2)' } },
    'https://portfolio.example.test/',
  );
  assert.equal(invalidImageFallback.socialImageUrl, '');

  const escaped = renderSeoMetadataHtml(
    '<!doctype html><html><head></head><body></body></html>',
    { siteSettings: { siteName: '<script>alert(1)</script>', siteTitle: '" onload="alert(1)' } },
    'https://portfolio.example.test/',
  );
  assert.doesNotMatch(escaped, /<script>alert\(1\)<\/script>/);
  assert.match(escaped, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(escaped, /&quot; onload=&quot;alert\(1\)/);
});

test('unpublished SEO produces clean HTML without title, social metadata, images, or structured data', async () => {
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  const pollutedHtml = html.replace(
    '</head>',
    `<title>SEO metadata not published</title>
    <meta name="description" content="No published SEO description is available." />
    <meta property="og:title" content="SEO metadata not published" />
    <meta property="og:description" content="No published SEO description is available." />
    <meta property="og:image" content="/avatar.png" />
    <meta name="twitter:title" content="SEO metadata not published" />
    <meta name="twitter:description" content="No published SEO description is available." />
    <meta name="twitter:image" content="/avatar.png" />
    <link rel="canonical" href="/" />
    <script id="website-jsonld" type="application/ld+json">{}</script>
    </head>`,
  );
  const cleaned = stripSeoMetadataHtml(pollutedHtml);

  assert.doesNotMatch(cleaned, /<title\b|name="description"|property="og:|name="twitter:|website-jsonld|rel="canonical"/);
  assert.doesNotMatch(cleaned, /SEO metadata not published|No published SEO description is available|avatar\.png/);
  assert.match(cleaned, /rel="icon" href="data:image\/svg\+xml,/);
});

test('Netlify homepage edge handler uses the public published metadata endpoint', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(new URL(String(input)).pathname, '/api/seo-metadata');
    return new Response(JSON.stringify({ success: true, published: true, content: publishedContent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await renderHomepageMetadata(
      new Request('https://portfolio.example.test/'),
      {
        next: async () => new Response('<html><head><title>Old title</title></head><body></body></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': '72' },
        }),
      },
    );
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('netlify-cdn-cache-control'), 'no-store');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.has('content-length'), false);
    assert.match(html, /Published Homepage Title/);
    assert.match(html, /Published homepage description\./);
    assert.doesNotMatch(html, /Legacy Open Graph override|Legacy Twitter override/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Netlify returns rewritten metadata as a complete response for Meta range requests', async () => {
  const originalFetch = globalThis.fetch;
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    published: true,
    content: publishedContent,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await renderHomepageMetadata(
      new Request('https://portfolio.example.test/', {
        headers: {
          Range: 'bytes=0-524288',
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        },
      }),
      {
        next: async () => new Response(html, {
          status: 206,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Range': `bytes 0-${html.length - 1}/${html.length}`,
            'Accept-Ranges': 'bytes',
          },
        }),
      },
    );
    const rendered = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.has('content-range'), false);
    assert.equal(response.headers.has('accept-ranges'), false);
    assert.equal(response.headers.has('content-length'), false);
    assert.equal(response.headers.get('netlify-cdn-cache-control'), 'no-store');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(rendered, /property="og:site_name" content="Published Site Name"/);
    assert.match(rendered, /property="og:image" content="https:\/\/portfolio\.example\.test\/api\/portfolio-media\/file-original-social-image"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Netlify returns clean HTML when the published SEO record does not exist', async () => {
  const originalFetch = globalThis.fetch;
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    published: false,
    content: {},
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const response = await renderHomepageMetadata(
      new Request('https://portfolio.example.test/'),
      {
        next: async () => new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      },
    );
    const rendered = await response.text();
    assert.equal(response.status, 200);
    assert.doesNotMatch(rendered, /<title\b|name="description"|property="og:|name="twitter:|website-jsonld/);
    assert.doesNotMatch(rendered, /SEO metadata not published|No published SEO description is available|avatar\.png/);
    assert.match(rendered, /rel="icon" href="data:image\/svg\+xml,/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Netlify does not replace failed published metadata with static HTML defaults', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  globalThis.fetch = async () => new Response(
    '<!doctype html><title>Page not found</title>',
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
  console.error = () => undefined;

  try {
    const response = await renderHomepageMetadata(
      new Request('https://portfolio.example.test/'),
      {
        next: async () => new Response('<html><head><title>SEO metadata not published</title></head><body></body></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      },
    );
    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'Published SEO metadata is temporarily unavailable.');
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('initial HTML follows only the latest published SEO settings, never drafts', async () => {
  await connectMongo();
  const app = express();
  app.get('/api/seo-metadata', handlePublishedSeoMetadata);
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const originalFetch = globalThis.fetch;
  const seoContent = (title: string, imageUrl: string) => ({
    profile: {
      name: 'SEO Regression Owner',
      title: 'Published Engineer',
      bio: `Published bio for ${title}.`,
      website: 'https://portfolio.example.test/',
    },
    siteSettings: {
      siteName: 'Published SEO Regression Site',
      siteTitle: title,
      metaDescription: `Description for ${title}.`,
      openGraphTitle: `Ignored Open Graph ${title}`,
      openGraphDescription: `Ignored Open Graph description for ${title}.`,
      canonicalUrl: 'https://portfolio.example.test/',
      faviconUrl: '/published-favicon.png',
      socialImageUrl: imageUrl,
      socialImageAlt: `Preview for ${title}.`,
      twitterCard: 'summary',
      twitterTitle: `Ignored Twitter ${title}`,
      twitterDescription: `Ignored Twitter description for ${title}.`,
    },
  });
  const renderLiveHtml = async () => {
    const response = await renderHomepageMetadata(
      new Request('https://portfolio.example.test/'),
      {
        next: async () => new Response(
          await readFile(new URL('../../client/index.html', import.meta.url), 'utf8'),
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        ),
      },
    );
    return { response, html: await response.text() };
  };

  try {
    await Promise.all([
      SiteContentModel.deleteMany({ key: 'primary_portfolio_content' }),
      AdminContentDraftModel.deleteMany({ key: 'primary_portfolio_content' }),
      AdminContentRevisionModel.deleteMany({ key: 'primary_portfolio_content' }),
    ]);

    globalThis.fetch = async (input, init) => {
      const target = new URL(String(input));
      if (target.pathname === '/api/seo-metadata') {
        return originalFetch(`http://127.0.0.1:${address.port}/api/seo-metadata`, init);
      }
      return originalFetch(input, init);
    };

    const unpublished = await renderLiveHtml();
    assert.equal(unpublished.response.status, 200);
    assert.doesNotMatch(unpublished.html, /<title\b|name="description"|property="og:|name="twitter:|website-jsonld/);
    assert.doesNotMatch(unpublished.html, /SEO metadata not published|No published SEO description is available|avatar\.png/);

    const firstDraft = seoContent('First Published Title', 'https://images.example.test/first-preview.jpg');
    await contentStudioService.saveDraft(firstDraft, 'seo-metadata-regression', {});
    const beforeFirstPublish = await renderLiveHtml();
    assert.doesNotMatch(beforeFirstPublish.html, /First Published Title|first-preview\.jpg/);
    assert.doesNotMatch(beforeFirstPublish.html, /<title\b|property="og:|name="twitter:/);

    await contentStudioService.publishDraft('seo-metadata-regression');
    const publishedSeoResponse = await originalFetch(
      `http://127.0.0.1:${address.port}/api/seo-metadata`,
    );
    const publishedSeo = await publishedSeoResponse.json() as {
      content: { siteSettings: Record<string, unknown> };
    };
    assert.equal(publishedSeo.content.siteSettings.socialImageUrl, 'https://images.example.test/first-preview.jpg');
    assert.equal('socialPreviewUrl' in publishedSeo.content.siteSettings, false);
    const firstPublished = await renderLiveHtml();
    assert.match(firstPublished.html, /<title data-seo="title">First Published Title<\/title>/);
    assert.match(firstPublished.html, /property="og:title" content="First Published Title"/);
    assert.match(firstPublished.html, /property="og:description" content="Description for First Published Title\."/);
    assert.match(firstPublished.html, /property="og:image" content="https:\/\/images\.example\.test\/first-preview\.jpg"/);
    assert.match(firstPublished.html, /name="twitter:image" content="https:\/\/images\.example\.test\/first-preview\.jpg"/);
    assert.match(firstPublished.html, /name="twitter:card" content="summary_large_image"/);
    assert.match(firstPublished.html, /name="twitter:title" content="First Published Title"/);
    assert.match(firstPublished.html, /name="twitter:description" content="Description for First Published Title\."/);
    assert.match(firstPublished.html, /rel="icon" href="https:\/\/portfolio\.example\.test\/published-favicon\.png"/);
    assert.match(firstPublished.html, /data-configured-favicon="https:\/\/portfolio\.example\.test\/published-favicon\.png"/);
    const websiteData = firstPublished.html.match(/<script id="website-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(websiteData);
    assert.deepEqual(JSON.parse(websiteData).alternateName, ['Published SEO Regression Site Portfolio']);
    assert.doesNotMatch(firstPublished.html, /Developer Portfolio|Interactive developer portfolio|avatar\.png/);

    const secondDraft = seoContent('Second Published Title', 'https://images.example.test/second-preview.jpg');
    await contentStudioService.saveDraft(secondDraft, 'seo-metadata-regression', firstDraft);
    const beforeSecondPublish = await renderLiveHtml();
    assert.match(beforeSecondPublish.html, /First Published Title/);
    assert.match(beforeSecondPublish.html, /first-preview\.jpg/);
    assert.doesNotMatch(beforeSecondPublish.html, /Second Published Title|second-preview\.jpg/);

    await contentStudioService.publishDraft('seo-metadata-regression');
    const secondPublished = await renderLiveHtml();
    assert.match(secondPublished.html, /<title data-seo="title">Second Published Title<\/title>/);
    assert.match(secondPublished.html, /property="og:image" content="https:\/\/images\.example\.test\/second-preview\.jpg"/);
    assert.match(secondPublished.html, /name="twitter:title" content="Second Published Title"/);
    assert.doesNotMatch(secondPublished.html, /First Published Title|first-preview\.jpg/);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
});

test('Netlify proxies only generated social formats and preserves API and SEO routing', async () => {
  const config = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');
  const expectedFormats = ['jpg', 'png', 'webp'];
  const socialRedirects = config.split('[[redirects]]').slice(1);
  const socialBlocks = socialRedirects.filter((block) => block.includes('from = "/social-preview.'));
  assert.equal(socialBlocks.length, expectedFormats.length);

  for (const extension of expectedFormats) {
    const redirectIndex = config.indexOf(`from = "/social-preview.${extension}"`);
    const block = socialBlocks.find((candidate) => candidate.includes(`from = "/social-preview.${extension}"`));
    assert.ok(block, `missing Netlify proxy for generated ${extension} preview`);
    assert.match(block, new RegExp(`to = "https://portfolio-ub24\\.onrender\\.com/social-preview\\.${extension}"`));
    assert.match(block, /status = 200/);
    assert.match(block, /force = true/);
    assert.ok(redirectIndex < config.indexOf('from = "/*"'), `${extension} proxy must precede the SPA fallback`);
  }

  assert.equal([...config.matchAll(/from = "\/social-preview\.[a-z]+"/g)].length, expectedFormats.length);
  const apiProxy = config.match(/from = "\/api\/\*"\s+to = "([^"]+)"\s+status = 200\s+force = true/);
  assert.ok(apiProxy, 'Netlify must configure a force rewrite for every /api/* request');
  const seoApiTarget = apiProxy[1].replace(':splat', 'seo-metadata');
  assert.equal(new URL(seoApiTarget).origin, 'https://portfolio-ub24.onrender.com');
  assert.equal(new URL(seoApiTarget).pathname, '/api/seo-metadata');
  assert.match(config, /edge_functions = "client\/edge-functions"/);
  assert.match(config, /function = "seo-metadata"\s+path = "\/"/);
  assert.ok(config.indexOf('from = "/api/*"') < config.indexOf('from = "/*"'));
});

test('publishing SEO metadata remains unavailable without administrator authentication', async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin/content-studio', contentStudioRouter);
  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/content-studio/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
