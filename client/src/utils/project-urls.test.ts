import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProjectDemoUrl } from './projectUrls';

test('normalizes project demo URLs and rejects unsafe protocols', () => {
  assert.equal(normalizeProjectDemoUrl('https://example.com/demo'), 'https://example.com/demo');
  assert.equal(normalizeProjectDemoUrl('www.example.com/demo'), 'https://www.example.com/demo');
  assert.equal(normalizeProjectDemoUrl('javascript:alert(1)'), null);
  assert.equal(normalizeProjectDemoUrl(''), null);
});
