import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPublicRouteMetadata } from './seo-metadata';

const originalFetch = globalThis.fetch;
const shell = '<!doctype html><html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
const publishedContent = {
  profile: { name: 'Portfolio Owner' },
  siteSettings: {
    siteName: 'Published Portfolio',
    siteTitle: 'Published Global Title',
    metaDescription: 'Published global description.',
    canonicalUrl: 'https://canonical.example.test/',
    faviconUrl: '/published-icon.png',
    socialImageUrl: '/published-share.png',
  },
};

const createContext = () => ({
  next: async () => new Response(shell, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }),
});

test('app-info has public initial content and preserves published global branding', async () => {
  let projectsRequested = false;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/seo-metadata') {
      return Response.json({ success: true, published: true, content: publishedContent });
    }
    if (url.pathname === '/api/profile') {
      return Response.json({
        name: 'Anish Jethva',
        title: 'Engineer',
        bio: 'Must not appear in the public information page.',
        email: 'anish@example.test',
        siteSettings: { disabledApps: ['browser', 'admin', 'camera'] },
      });
    }
    if (url.pathname === '/api/profile/projects') {
      projectsRequested = true;
      throw new Error('Project details should not be requested by app-info.');
    }
    throw new Error(`Unexpected fetch ${url.pathname}`);
  };
  try {
    const response = await renderPublicRouteMetadata(new Request('https://portfolio.example.test/app-info'), createContext());
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<title data-seo="title">Published Global Title<\/title>/);
    assert.match(html, /name="description" content="Learn about this interactive Windows 11 portfolio/);
    assert.match(html, /property="og:site_name" content="Published Portfolio"/);
    assert.match(html, /property="og:image" content="https:\/\/canonical\.example\.test\/published-share\.png"/);
    assert.match(html, /rel="canonical" href="https:\/\/canonical\.example\.test\/app-info"/);
    assert.match(html, /rel="icon" href="https:\/\/portfolio\.example\.test\/published-icon\.png"/);
    assert.match(html, /<strong>Published Portfolio<\/strong>/);
    assert.match(html, /<h1[^>]*>An Interactive Windows 11 Portfolio<\/h1>/);
    assert.match(html, /Website owner/);
    assert.match(html, /Personal portfolio/);
    assert.match(html, /About Me/);
    assert.match(html, /Projects/);
    assert.match(html, /Resume CV/);
    assert.match(html, /Contact Me/);
    assert.match(html, /href="\/projects"/);
    assert.match(html, /Browse selected projects and published work\./);
    assert.match(html, /anish@example\.test/);
    assert.doesNotMatch(html, /Must not appear|Published school|Published toolkit|Published project/);
    assert.match(html, /href="\/privacy-policy"/);
    assert.match(html, /Privacy Policy/);
    assert.doesNotMatch(html, /LockScreen|Admin Control Center|Web Browser|Camera|href="\/camera"/);
    assert.equal(projectsRequested, false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('privacy policy initial HTML has complete content, published metadata, and linked sections', async () => {
  globalThis.fetch = async () => Response.json({
    success: true,
    published: true,
    content: publishedContent,
  });
  try {
    const response = await renderPublicRouteMetadata(new Request('https://portfolio.example.test/privacy-policy'), createContext());
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<title data-seo="title">Published Global Title<\/title>/);
    assert.match(html, /rel="canonical" href="https:\/\/canonical\.example\.test\/privacy-policy"/);
    assert.match(html, /Information submitted through the contact form/);
    assert.match(html, /Gmail OAuth/);
    assert.match(html, /mailto:anish\.jethva2006@gmail\.com/);
    assert.match(html, /aria-label="Table of contents"/);
    assert.match(html, /href="#privacy-section-1"/);
    assert.match(html, /id="privacy-section-1"/);
    assert.match(html, /Back to Portfolio Information/);
    assert.match(html, /Published Portfolio<\/a>/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('home and public application routes receive published route metadata', async () => {
  globalThis.fetch = async () => Response.json({
    success: true,
    published: true,
    content: publishedContent,
  });
  try {
    for (const [path, description] of [
      ['/', 'Published global description.'],
      ['/home', 'Published global description.'],
      ['/projects', 'Browse selected projects and published work.'],
    ]) {
      const response = await renderPublicRouteMetadata(new Request(`https://portfolio.example.test${path}`), createContext());
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /<title data-seo="title">Published Global Title<\/title>/);
      assert.match(html, new RegExp(`name="description" content="${description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
      assert.match(html, new RegExp(`rel="canonical" href="https://canonical\\.example\\.test${path}"`));
      assert.match(html, /rel="icon" href="https:\/\/portfolio\.example\.test\/published-icon\.png"/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin-only routes receive published branding without exposing admin content', async () => {
  globalThis.fetch = async () => Response.json({
    success: true,
    published: true,
    content: publishedContent,
  });
  try {
    const response = await renderPublicRouteMetadata(new Request('https://portfolio.example.test/admin-control-center'), {
      next: async () => {
        return new Response(shell, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      },
    });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<title data-seo="title">Published Global Title<\/title>/);
    assert.match(html, /rel="icon" href="https:\/\/portfolio\.example\.test\/published-icon\.png"/);
    assert.doesNotMatch(html, /Admin Control Center|admin password|admin dashboard/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
