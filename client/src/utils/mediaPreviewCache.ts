interface PreviewFile {
  id: string;
  name: string;
  modified?: string;
  uploadedAt?: string;
  size?: string;
}

interface PreviewCacheEntry {
  url?: string;
  request?: Promise<string>;
}

const previewCache = new Map<string, PreviewCacheEntry>();
const MAX_PREVIEW_CACHE_ENTRIES = 80;

const getCacheKey = (file: PreviewFile): string =>
  `${file.id}:${file.modified || file.uploadedAt || ''}:${file.size || ''}`;

const trimPreviewCache = () => {
  while (previewCache.size > MAX_PREVIEW_CACHE_ENTRIES) {
    const oldestEntry = [...previewCache.entries()].find(([, entry]) => Boolean(entry.url));
    if (!oldestEntry) return;
    const [key, entry] = oldestEntry;
    if (entry.url) URL.revokeObjectURL(entry.url);
    previewCache.delete(key);
  }
};

export const getCachedMediaPreviewUrl = (file: PreviewFile): string | null => {
  const key = getCacheKey(file);
  const entry = previewCache.get(key);
  if (!entry?.url) return null;
  previewCache.delete(key);
  previewCache.set(key, entry);
  return entry.url;
};

export const loadCachedMediaPreviewUrl = (file: PreviewFile): Promise<string> => {
  const key = getCacheKey(file);
  const cachedUrl = getCachedMediaPreviewUrl(file);
  if (cachedUrl) return Promise.resolve(cachedUrl);

  const cachedEntry = previewCache.get(key);
  if (cachedEntry?.request) return cachedEntry.request;

  const entry: PreviewCacheEntry = {};
  const request = fetch(`/api/files/download/${encodeURIComponent(file.id)}`, { credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Preview request failed (${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      if (previewCache.get(key) !== entry) {
        URL.revokeObjectURL(url);
        throw new Error('Media preview was removed before it finished loading.');
      }
      entry.url = url;
      entry.request = undefined;
      trimPreviewCache();
      return url;
    })
    .catch((error: unknown) => {
      if (previewCache.get(key) === entry) previewCache.delete(key);
      throw error;
    });
  entry.request = request;
  previewCache.set(key, entry);
  trimPreviewCache();
  return request;
};

export const clearCachedMediaPreview = (fileId: string): void => {
  const prefix = `${fileId}:`;
  for (const [key, entry] of previewCache) {
    if (!key.startsWith(prefix)) continue;
    if (entry.url) URL.revokeObjectURL(entry.url);
    previewCache.delete(key);
  }
};
