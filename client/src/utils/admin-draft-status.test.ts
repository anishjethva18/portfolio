import assert from 'node:assert/strict';
import test from 'node:test';
import { getContentState, getProjectChanges, getProjectState } from './adminDraftStatus';

test('draft status detects meaningful project fields and ignores whitespace-only differences', () => {
  const published = [{
    id: 'project-1',
    title: 'Portfolio',
    description: 'Original',
    screenshots: ['/one.png'],
    caseStudy: { goal: 'Build it' },
    sortOrder: 0,
    updatedAt: 'old',
  }];
  const edited = [{
    id: 'project-1',
    title: 'Portfolio',
    description: 'Original ',
    screenshots: ['/one.png', '/two.png'],
    caseStudy: { goal: 'Build it better' },
    sortOrder: 0,
    updatedAt: 'new',
  }];

  assert.notEqual(getProjectState(published), getProjectState(edited));
  assert.deepEqual(getProjectChanges(edited, published), [
    'Projects / Portfolio / Screenshots',
    'Projects / Portfolio / Case study',
  ]);
  assert.equal(
    getProjectState([{ id: 'project-1', title: 'Title' }]),
    getProjectState([{ id: 'project-1', title: 'Title ' }]),
  );
  assert.equal(getContentState({ profile: { bio: 'Text' } }), getContentState({ profile: { bio: 'Text ' } }));
  assert.equal(getProjectState(published), getProjectState([{ ...published[0], updatedAt: 'new' }]));
});

test('project draft status reports add, removal, and order changes', () => {
  const published = [
    { id: 'first', title: 'First', sortOrder: 0 },
    { id: 'second', title: 'Second', sortOrder: 1 },
  ];
  const draft = [
    { id: 'second', title: 'Second', sortOrder: 0 },
    { id: 'third', title: 'Third', sortOrder: 1 },
  ];

  assert.notEqual(getProjectState(draft), getProjectState(published));
  assert.deepEqual(getProjectChanges(draft, published), [
    'Projects / Third / Added',
    'Projects / First / Removed',
  ]);
  assert.deepEqual(
    getProjectChanges(
      [{ id: 'second', title: 'Second', sortOrder: 0 }, { id: 'first', title: 'First', sortOrder: 1 }],
      published,
    ),
    ['Projects / Display order'],
  );
});

test('project changes include all new fields but omit whitespace-only differences', () => {
  const changes = getProjectChanges(
    [{ id: 'project-1', title: 'Project', tagline: 'A project ', overview: 'Updated', caseStudy: { delivered: 'Done' } }],
    [{ id: 'project-1', title: 'Project', tagline: 'A project', overview: '', caseStudy: { delivered: '' } }],
  );

  assert.deepEqual(changes, [
    'Projects / Project / Overview',
    'Projects / Project / Case study',
  ]);
});

test('project status treats omitted optional fields like their empty defaults', () => {
  const draft = [{ id: 'project-1', title: 'Project', githubUrl: '', liveUrl: '', caseStudy: {} }];
  const published = [{ id: 'project-1', title: 'Project' }];

  assert.equal(getProjectState(draft), getProjectState(published));
  assert.deepEqual(getProjectChanges(draft, published), []);
});
