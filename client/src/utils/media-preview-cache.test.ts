import assert from 'node:assert/strict';
import test from 'node:test';
import { clearCachedMediaPreview, getCachedMediaPreviewUrl, loadCachedMediaPreviewUrl } from './mediaPreviewCache';

test('media preview blobs are reused after pagination unmounts the thumbnail', async () => {
  const file = { id: `preview-cache-test-${Date.now()}`, name: 'preview.png' };
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(new Blob(['image bytes'], { type: 'image/png' }), { status: 200 });
  };

  try {
    const firstUrl = await loadCachedMediaPreviewUrl(file);
    assert.equal(getCachedMediaPreviewUrl(file), firstUrl);
    assert.equal(await loadCachedMediaPreviewUrl(file), firstUrl);
    assert.equal(fetchCount, 1);
    clearCachedMediaPreview(file.id);
    assert.equal(getCachedMediaPreviewUrl(file), null);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedMediaPreview(file.id);
  }
});
