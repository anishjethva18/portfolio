import assert from 'node:assert/strict';
import { connectMongo, disconnectMongo } from '../config/dbConfig';
import { SiteContentModel } from '../models/SiteContent';
import { AdminContentDraftModel } from '../models/AdminContentDraft';
import { AdminContentRevisionModel } from '../models/AdminContentRevision';
import { contentStudioService, summarizeChanges } from '../services/contentStudioService';

async function run() {
  assert.deepEqual(
    summarizeChanges(
      { siteSettings: { emailFaviconEnabled: true } },
      { siteSettings: { emailFaviconEnabled: false } },
    ),
    ['Site & Appearance · Email favicon in emails: Enabled → Disabled'],
    'Boolean settings history states the prior and new values explicitly',
  );
  assert.deepEqual(
    summarizeChanges(
      { siteSettings: { siteName: 'Old name', canonicalUrl: 'https://old.example.test/' } },
      { siteSettings: { siteName: 'New name', canonicalUrl: '' } },
    ),
    [
      'Site & Appearance · Site name: Old name → New name',
      'Site & Appearance · Canonical URL: https://old.example.test/ → (empty)',
    ],
    'SEO edits and removals are tracked in the shared publish history',
  );
  assert.deepEqual(
    summarizeChanges(
      { profile: { contactVisibility: { email: false } } },
      { profile: { contactVisibility: { email: true } } },
    ),
    ['Profile & About · Contact Visibility · Email: Disabled → Enabled'],
    'Nested visibility history describes enabled and disabled states',
  );

  await connectMongo();
  try {
    await Promise.all([
      SiteContentModel.deleteMany({ key: 'primary_portfolio_content' }),
      AdminContentDraftModel.deleteMany({ key: 'primary_portfolio_content' }),
      AdminContentRevisionModel.deleteMany({ key: 'primary_portfolio_content' }),
    ]);

    const content = {
      profile: {
        name: 'Visibility test',
        email: 'hidden@example.test',
        phone: '555-0100',
        location: 'Hidden location',
        github: 'https://github.com/hidden',
        linkedin: 'https://linkedin.com/hidden',
        instagram: 'https://instagram.com/hidden',
        twitter: 'https://x.com/hidden',
        contactVisibility: {
          email: false,
          phone: false,
          location: false,
          github: false,
          linkedin: false,
          instagram: false,
          twitter: false,
        },
        socialLinks: [{ label: 'Hidden link', url: 'https://hidden.test', visible: false }],
      },
      experiences: [{ role: 'Hidden role', company: 'Test', period: '2025', description: [], skills: [], visible: false }],
      education: [{ degree: 'Hidden degree', institution: 'Test', period: '2025', details: '', visible: false }],
      certifications: [{ title: 'Hidden certificate', visible: false }],
      capabilities: [{ title: 'Hidden capability', icon: 'Sparkles', description: '', visible: false }],
      siteSettings: {
        siteName: 'Published SEO Test',
        siteTitle: 'Published SEO page title',
        metaDescription: 'Published SEO description.',
        openGraphTitle: 'Published Open Graph title',
        openGraphDescription: 'Published Open Graph description.',
        canonicalUrl: 'https://portfolio.example.test/',
        faviconUrl: '/api/portfolio-media/favicon.png?id=file-seo-test',
        socialImageUrl: 'https://portfolio.example.test/social.png',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Published Twitter title',
        twitterDescription: 'Published Twitter description.',
      },
    };

    const publishedFallback = {
      ...content,
      siteSettings: { ...content.siteSettings, siteName: 'Previously published site name' },
    };
    const savedSnapshot = await contentStudioService.saveDraft(content, 'visibility-test', publishedFallback);
    assert.equal(savedSnapshot.isPublished, false, 'Saving changed SEO settings reports unpublished changes');
    const publishedSnapshot = await contentStudioService.publishDraft('visibility-test');
    assert.equal(publishedSnapshot.isPublished, true, 'Publishing clears the unpublished state');
    const refreshedSnapshot = await contentStudioService.getSnapshot({});

    for (const snapshot of [publishedSnapshot, refreshedSnapshot]) {
      const published = snapshot.published as any;
      const draft = snapshot.draft as any;
      assert.equal(published.profile.contactVisibility.email, false);
      assert.equal(published.profile.contactVisibility.phone, false);
      assert.equal(published.profile.contactVisibility.location, false);
      assert.equal(published.profile.contactVisibility.github, false);
      assert.equal(published.profile.contactVisibility.linkedin, false);
      assert.equal(published.profile.contactVisibility.instagram, false);
      assert.equal(published.profile.contactVisibility.twitter, false);
      assert.equal(published.profile.socialLinks[0].visible, false);
      assert.equal(published.experiences[0].visible, false);
      assert.equal(published.education[0].visible, false);
      assert.equal(published.certifications[0].visible, false);
      assert.equal(published.capabilities[0].visible, false);
      assert.equal((snapshot.draft as any).profile.contactVisibility.email, false);
      assert.equal((snapshot.draft as any).capabilities[0].visible, false);
      assert.equal((snapshot.published as any).siteSettings.siteName, 'Published SEO Test');
      assert.equal((snapshot.published as any).siteSettings.canonicalUrl, 'https://portfolio.example.test/');
      assert.equal((snapshot.published as any).siteSettings.twitterCard, 'summary_large_image');
      for (const savedContent of [published, draft]) {
        assert.equal(savedContent.siteSettings.siteName, 'Published SEO Test');
        assert.equal(savedContent.siteSettings.siteTitle, 'Published SEO page title');
        assert.equal(savedContent.siteSettings.metaDescription, 'Published SEO description.');
        assert.equal(savedContent.siteSettings.openGraphTitle, 'Published Open Graph title');
        assert.equal(savedContent.siteSettings.openGraphDescription, 'Published Open Graph description.');
        assert.equal(savedContent.siteSettings.canonicalUrl, 'https://portfolio.example.test/');
        assert.equal(savedContent.siteSettings.faviconUrl, '/api/portfolio-media/favicon.png?id=file-seo-test');
        assert.equal(savedContent.siteSettings.socialImageUrl, 'https://portfolio.example.test/social.png');
        assert.equal(savedContent.siteSettings.twitterCard, 'summary_large_image');
        assert.equal(savedContent.siteSettings.twitterTitle, 'Published Twitter title');
        assert.equal(savedContent.siteSettings.twitterDescription, 'Published Twitter description.');
      }
    }

    const updatedContent = {
      ...content,
      siteSettings: {
        ...content.siteSettings,
        siteName: 'Updated SEO Test',
        siteTitle: 'Updated SEO page title',
      },
    };
    const updatedSnapshot = await contentStudioService.saveDraft(updatedContent, 'visibility-test', publishedSnapshot.published);
    assert.equal(updatedSnapshot.isPublished, false, 'Subsequent SEO edits are detected as unpublished');
    await contentStudioService.publishDraft('visibility-test');
    const [currentVersion] = await contentStudioService.listRevisions();
    assert.ok(currentVersion.changes.includes('Site & Appearance · Site name: Published SEO Test → Updated SEO Test'));
    assert.ok(currentVersion.changes.includes('Site & Appearance · Page title: Published SEO page title → Updated SEO page title'));

    const invalidMetadata = {
      ...content,
      siteSettings: { ...content.siteSettings, faviconUrl: 'javascript:alert(1)' },
    };
    await assert.rejects(
      contentStudioService.saveDraft(invalidMetadata, 'visibility-test'),
      /Favicon URL must use http\(s\) or a public local portfolio path/,
    );
    console.log('Content visibility and SEO settings persist through save, publish, and reload.');
  } finally {
    await disconnectMongo();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
