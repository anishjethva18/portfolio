import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { renderHomepageMetadata } from '../../client/edge-functions/seo-metadata';
import { applyConfiguredFavicon, buildSeoMetadata, renderSeoMetadataHtml } from '../../client/src/utils/seoMetadata';
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
    socialImageUrl: '/social.png',
    socialPreviewUrl: '/social-preview.jpg',
    socialImageWidth: 1200,
    socialImageHeight: 630,
    socialImageType: 'image/jpeg',
    socialImageAlt: 'A wide portfolio preview image.',
    openGraphTitle: 'Published Open Graph title',
    openGraphDescription: 'Published Open Graph description.',
    canonicalUrl: 'https://portfolio.example.test/',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Published Twitter title',
    twitterDescription: 'Published Twitter description.',
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
  assert.match(rendered, /property="og:image" content="https:\/\/portfolio\.example\.test\/social-preview\.jpg"/);
  assert.match(rendered, /property="og:image:width" content="1200"/);
  assert.match(rendered, /property="og:image:height" content="630"/);
  assert.match(rendered, /property="og:image:type" content="image\/jpeg"/);
  assert.match(rendered, /property="og:image:alt" content="A wide portfolio preview image\."/);
  assert.match(rendered, /name="twitter:card" content="summary_large_image"/);
  assert.match(rendered, /rel="canonical" href="https:\/\/portfolio\.example\.test\/"/);
  assert.match(rendered, /rel="icon" href="data:image\/svg\+xml,/);
  assert.match(rendered, /data-configured-favicon="https:\/\/portfolio\.example\.test\/favicon\.png"/);
  assert.match(rendered, /rel="preload" as="image" href="https:\/\/portfolio\.example\.test\/favicon\.png"/);
  assert.match(rendered, /name="twitter:title" content="Published Twitter title"/);
  assert.match(rendered, /name="twitter:description" content="Published Twitter description\."/);
  assert.match(rendered, /name="twitter:image" content="https:\/\/portfolio\.example\.test\/social-preview\.jpg"/);
  const jsonLdText = rendered.match(/<script id="website-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(jsonLdText);
  assert.deepEqual(JSON.parse(jsonLdText), {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Published Site Name',
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

test('homepage HTML keeps an immediate fallback favicon while preloading the configured icon', async () => {
  const html = await readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
  const rendered = renderSeoMetadataHtml(html, publishedContent, 'https://portfolio.example.test/');
  assert.equal(rendered.match(/<link rel="icon"/g)?.length, 1);
  assert.match(rendered, /<link rel="icon" href="data:image\/svg\+xml,/);
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
  assert.equal(defaults.canonicalUrl, 'https://portfolio.example.test/');
  assert.equal(defaults.title, 'SEO metadata not published');
  assert.equal(defaults.description, 'No published SEO description is available.');
  assert.equal(defaults.faviconUrl, '');
  assert.equal(defaults.socialImageUrl, '');
  assert.equal(defaults.twitterCard, 'summary_large_image');
  assert.equal(buildSeoMetadata({
    siteSettings: {
      twitterCard: 'summary',
      openGraphTitle: 'Open Graph fallback title',
      openGraphDescription: 'Open Graph fallback description.',
    },
  }, 'https://portfolio.example.test/').twitterCard, 'summary');
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
    assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
    assert.equal(response.headers.has('content-length'), false);
    assert.match(html, /Published Homepage Title/);
    assert.match(html, /Published Open Graph description\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Netlify does not replace failed published metadata with static HTML defaults', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ success: false, error: 'Published SEO metadata is temporarily unavailable.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
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
      openGraphTitle: `Open Graph ${title}`,
      openGraphDescription: `Open Graph description for ${title}.`,
      canonicalUrl: 'https://portfolio.example.test/',
      faviconUrl: '/published-favicon.png',
      socialImageUrl: imageUrl,
      socialImageAlt: `Preview for ${title}.`,
      twitterCard: 'summary',
      twitterTitle: `Twitter ${title}`,
      twitterDescription: `Twitter description for ${title}.`,
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
    assert.match(unpublished.html, /SEO metadata not published/);
    assert.match(unpublished.html, /No published SEO description is available\./);
    assert.doesNotMatch(unpublished.html, /og:image|twitter:image|avatar\.png/);

    const firstDraft = seoContent('First Published Title', 'https://images.example.test/first-preview.jpg');
    await contentStudioService.saveDraft(firstDraft, 'seo-metadata-regression', {});
    const beforeFirstPublish = await renderLiveHtml();
    assert.doesNotMatch(beforeFirstPublish.html, /First Published Title|first-preview\.jpg/);
    assert.match(beforeFirstPublish.html, /SEO metadata not published/);

    await contentStudioService.publishDraft('seo-metadata-regression');
    const firstPublished = await renderLiveHtml();
    assert.match(firstPublished.html, /<title data-seo="title">First Published Title<\/title>/);
    assert.match(firstPublished.html, /property="og:title" content="Open Graph First Published Title"/);
    assert.match(firstPublished.html, /property="og:image" content="https:\/\/images\.example\.test\/first-preview\.jpg"/);
    assert.match(firstPublished.html, /name="twitter:card" content="summary"/);
    assert.match(firstPublished.html, /data-configured-favicon="https:\/\/portfolio\.example\.test\/published-favicon\.png"/);
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
    assert.match(secondPublished.html, /name="twitter:title" content="Twitter Second Published Title"/);
    assert.doesNotMatch(secondPublished.html, /First Published Title|first-preview\.jpg/);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectMongo();
  }
});

test('Netlify proxies only generated social formats and preserves API and SEO routing', async () => {
  const config = await readFile(new URL('../../client/netlify.toml', import.meta.url), 'utf8');
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
  assert.match(config, /edge_functions = "client\/edge-functions"/);
  assert.match(config, /function = "seo-metadata"\s+path = "\/"/);
  assert.match(config, /from = "\/api\/\*"\s+to = "https:\/\/portfolio-ub24\.onrender\.com\/api\/:splat"\s+status = 200\s+force = true/);
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
