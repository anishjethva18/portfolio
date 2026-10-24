import assert from 'node:assert/strict';
import { getPublicProfile, getVisibleRecords } from '../routes/profile';
import { SiteContentModel } from '../models/SiteContent';

const visibleRecords = getVisibleRecords([
  { id: 'hidden', visible: false },
  { id: 'shown', visible: true },
  { id: 'legacy-default-visible' },
]);
assert.deepEqual(visibleRecords.map((record: any) => record.id), ['shown', 'legacy-default-visible']);
assert.deepEqual(getVisibleRecords(undefined), []);

const publicProfile = getPublicProfile({
  email: 'private@example.test',
  phone: '123456',
  location: 'Somewhere',
  github: 'https://github.com/example',
  linkedin: 'https://linkedin.com/example',
  instagram: 'https://instagram.com/example',
  twitter: 'https://x.com/example',
  contactVisibility: { email: false, github: false, twitter: false },
  socialLinks: [
    { label: 'Visible link', url: 'https://example.test' },
    { label: 'Hidden link', url: 'https://hidden.test', visible: false },
  ],
});
assert.equal(publicProfile.email, '');
assert.equal(publicProfile.github, '');
assert.equal(publicProfile.socials.twitter, '');
assert.equal(publicProfile.phone, '123456');
assert.deepEqual(publicProfile.socialLinks.map((link: any) => link.label), ['Visible link']);

const storedContent = new SiteContentModel({
  key: 'visibility-schema-test',
  profile: {
    name: 'Test',
    contactVisibility: { email: false },
    socialLinks: [{ label: 'Hidden', url: 'https://example.test', visible: false }],
  },
  experiences: [{ role: 'Hidden role', visible: false }],
  education: [{ degree: 'Hidden degree', visible: false }],
  certifications: [{ title: 'Hidden certificate', visible: false }],
  capabilities: [{ title: 'Hidden capability', visible: false }],
});
const stored = storedContent.toObject();
assert.equal(stored.profile.contactVisibility?.email, false);
assert.equal(stored.profile.socialLinks?.[0].visible, false);
assert.equal(stored.experiences?.[0].visible, false);
assert.equal(stored.education?.[0].visible, false);
assert.equal(stored.certifications?.[0].visible, false);
assert.equal(stored.capabilities?.[0].visible, false);

console.log('Profile visibility filtering and persistence tests passed.');
