import assert from 'node:assert/strict';
import test from 'node:test';
import { getMediaPreviewUrl } from './MediaThumbnail';

test('local capture references wait for IndexedDB instead of showing a generic preview', () => {
  assert.equal(
    getMediaPreviewUrl({
      name: 'Photo_20261022_103927.jpg',
      extension: 'jpg',
      content: 'local-capture:capture-1',
    }),
    null
  );
});

test('blob-backed local capture previews are used directly', () => {
  const url = 'blob:https://portfolio.test/capture-1';
  assert.equal(
    getMediaPreviewUrl({
      name: 'Photo_20261022_103927.jpg',
      extension: 'jpg',
      content: url,
    }),
    url
  );
});
