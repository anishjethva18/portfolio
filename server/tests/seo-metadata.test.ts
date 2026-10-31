import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import { renderHomepageMetadata } from '../../netlify/edge-functions/seo-metadata';
import { applyConfiguredFavicon, buildSeoMetadata, renderSeoMetadataHtml } from '../../client/src/utils/seoMetadata';
import { contentStudioRouter } from '../routes/contentStudio';

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
  assert.match(rendered, /property="og:image" content="https:\/\/portfolio\.example\.test\/social\.png"/);
  assert.match(rendered, /rel="canonical" href="https:\/\/portfolio\.example\.test\/"/);
  assert.match(rendered, /rel="icon" href="data:image\/svg\+xml,/);
  assert.match(rendered, /data-configured-favicon="https:\/\/portfolio\.example\.test\/favicon\.png"/);
  assert.match(rendered, /rel="preload" as="image" href="https:\/\/portfolio\.example\.test\/favicon\.png"/);
  assert.match(rendered, /name="twitter:title" content="Published Twitter title"/);
  assert.match(rendered, /name="twitter:description" content="Published Twitter description\."/);
  assert.match(rendered, /name="twitter:image" content="https:\/\/portfolio\.example\.test\/social\.png"/);
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

test('empty settings use safe absolute defaults and untrusted text is escaped', () => {
  const defaults = buildSeoMetadata({}, 'https://portfolio.example.test/path');
  assert.equal(defaults.canonicalUrl, 'https://portfolio.example.test/');
  assert.equal(defaults.faviconUrl, 'https://portfolio.example.test/avatar.png');
  assert.equal(defaults.socialImageUrl, 'https://portfolio.example.test/avatar.png');
  assert.equal(defaults.twitterCard, 'summary_large_image');
  assert.equal(buildSeoMetadata({
    siteSettings: {
      twitterCard: 'summary',
      openGraphTitle: 'Open Graph fallback title',
      openGraphDescription: 'Open Graph fallback description.',
    },
  }, 'https://portfolio.example.test/').twitterCard, 'summary_large_image');
  const invalidImageFallback = buildSeoMetadata(
    { profile: { avatar: 'javascript:alert(1)' }, siteSettings: { socialImageUrl: 'javascript:alert(2)' } },
    'https://portfolio.example.test/',
  );
  assert.equal(invalidImageFallback.socialImageUrl, 'https://portfolio.example.test/avatar.png');

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
    return new Response(JSON.stringify({ success: true, content: publishedContent }), {
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
