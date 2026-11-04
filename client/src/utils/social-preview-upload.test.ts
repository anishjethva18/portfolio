import assert from 'node:assert/strict';
import test from 'node:test';
import { runSingleFlight, uploadSocialPreviewImage } from './socialPreviewUpload';

test('one social image upload makes one POST with exactly one file', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({
      success: true,
      original: {
        id: 'file-original-image',
        name: 'social.jpg',
        url: '/api/portfolio-media/file-original-image',
        contentType: 'image/jpeg',
        format: 'jpeg',
        width: 1200,
        height: 630,
        sizeBytes: 123,
      },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const file = new File([new Uint8Array([1, 2, 3])], 'social.jpg', { type: 'image/jpeg' });
    const result = await uploadSocialPreviewImage(file);
    assert.equal(result.id, 'file-original-image');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/admin/social-preview/upload');
    assert.equal(requests[0].init?.method, 'POST');
    const body = requests[0].init?.body;
    assert.ok(body instanceof FormData);
    assert.deepEqual([...body.keys()], ['file']);
    assert.equal((body.get('file') as File).name, 'social.jpg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('concurrent social-image handler calls are limited to one upload action', async () => {
  const guard = { current: false };
  let actionCount = 0;
  let releaseAction!: () => void;
  const action = () => {
    actionCount += 1;
    return new Promise<void>((resolve) => {
      releaseAction = resolve;
    });
  };

  const first = runSingleFlight(guard, action);
  const duplicate = await runSingleFlight(guard, action);
  assert.equal(duplicate, undefined);
  assert.equal(actionCount, 1);
  releaseAction();
  await first;
  assert.equal(guard.current, false);
});
