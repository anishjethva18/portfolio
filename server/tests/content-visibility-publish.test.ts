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
    };

    await contentStudioService.saveDraft(content, 'visibility-test');
    const publishedSnapshot = await contentStudioService.publishDraft('visibility-test');
    const refreshedSnapshot = await contentStudioService.getSnapshot({});

    for (const snapshot of [publishedSnapshot, refreshedSnapshot]) {
      const published = snapshot.published as any;
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
    }

    console.log('Content visibility settings persist through save, publish, and reload.');
  } finally {
    await disconnectMongo();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
