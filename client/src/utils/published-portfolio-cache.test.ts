import assert from 'node:assert/strict';
import test from 'node:test';

test('resume PDF bytes are fetched once and reused on revisits', async () => {
  const url = `/api/portfolio-media/cache-test-${Date.now()}.pdf`;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let fetchCount = 0;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined },
  });
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 });
  };

  try {
    const { getCachedResumeBytes } = await import('./publishedPortfolioCache');
    const first = await getCachedResumeBytes(url);
    const second = await getCachedResumeBytes(url);
    assert.deepEqual([...first], [37, 80, 68, 70]);
    assert.equal(first, second);
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
