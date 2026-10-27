import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeAdminDraft } from './mergeAdminDraft';

test('draft merge keeps local changes and newer edits from other sections', () => {
  const base = {
    profile: { name: 'Anish', bio: 'Original' },
    siteSettings: { theme: 'dark' },
    resumes: [],
  };
  const local = {
    profile: { name: 'Anish Jethva', bio: 'Original' },
    siteSettings: { theme: 'dark' },
    resumes: [],
  };
  const latest = {
    profile: { name: 'Anish', bio: 'Updated elsewhere' },
    siteSettings: { theme: 'light' },
    resumes: [{ id: 'resume-1' }],
  };

  assert.deepEqual(mergeAdminDraft(base, local, latest), {
    profile: { name: 'Anish Jethva', bio: 'Updated elsewhere' },
    siteSettings: { theme: 'light' },
    resumes: [{ id: 'resume-1' }],
  });
});

test('draft merge preserves local deletion and array replacement', () => {
  const base = { profile: { name: 'Anish', tagline: 'Old' }, skills: ['React'] };
  const local = { profile: { name: 'Anish' }, skills: ['React', 'TypeScript'] };
  const latest = { profile: { name: 'Anish', tagline: 'Old', location: 'India' }, skills: ['React'] };

  assert.deepEqual(mergeAdminDraft(base, local, latest), {
    profile: { name: 'Anish', location: 'India' },
    skills: ['React', 'TypeScript'],
  });
});
