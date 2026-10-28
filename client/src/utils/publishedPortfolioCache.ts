const PUBLISHED_CONTENT_KEY = 'win11_published_portfolio_cache';

type PublishedContent = Record<string, any>;

const resumeBytes = new Map<string, Promise<Uint8Array>>();
let publishedContent: PublishedContent | null = (() => {
  try {
    const saved = localStorage.getItem(PUBLISHED_CONTENT_KEY);
    return saved ? JSON.parse(saved) as PublishedContent : null;
  } catch (error) {
    console.warn('[PortfolioCache] Could not read the saved public portfolio cache.', error);
    return null;
  }
})();
let publishedContentRequest: Promise<PublishedContent> | null = null;

export function getCachedPublishedContent(): PublishedContent | null {
  return publishedContent;
}

export function cachePublishedContent(content: PublishedContent): void {
  publishedContent = content;
  try {
    localStorage.setItem(PUBLISHED_CONTENT_KEY, JSON.stringify(content));
  } catch (error) {
    console.warn('[PortfolioCache] Could not persist the public portfolio cache.', error);
  }
  void preloadPublishedResumes(content);
}

export function loadPublishedContent(forceRefresh = false): Promise<PublishedContent> {
  if (publishedContentRequest) return publishedContentRequest;
  if (publishedContent && !forceRefresh) return Promise.resolve(publishedContent);

  publishedContentRequest = fetch('/api/portfolio-content', { cache: 'no-store' })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success || !data.content) {
        throw new Error(data.error || 'Published portfolio content could not be loaded.');
      }
      cachePublishedContent(data.content);
      return data.content as PublishedContent;
    })
    .finally(() => {
      publishedContentRequest = null;
    });

  return publishedContentRequest;
}

export function getCachedResumeBytes(url: string): Promise<Uint8Array> {
  const cached = resumeBytes.get(url);
  if (cached) return cached;

  const request = fetch(url, { credentials: 'include', cache: 'force-cache' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Resume request failed (HTTP ${response.status}).`);
      return new Uint8Array(await response.arrayBuffer());
    })
    .catch((error: unknown) => {
      resumeBytes.delete(url);
      throw error;
    });
  resumeBytes.set(url, request);
  return request;
}

export function preloadPublishedResumes(content: PublishedContent): void {
  const resumes: unknown[] = Array.isArray(content.resumes)
    ? content.resumes.filter((resume: any) => resume?.visible !== false).map((resume: any) => resume.file)
    : [];
  if (typeof content.profile?.resumeUrl === 'string') resumes.push(content.profile.resumeUrl);

  const urls = [...new Set(resumes.filter((url): url is string => typeof url === 'string' && /^\/api\/portfolio-media\//.test(url)))];
  for (const url of urls) {
    void getCachedResumeBytes(url).catch((error: unknown) => {
      console.warn(`[PortfolioCache] Could not preload resume "${url}".`, error);
    });
  }
}

if (publishedContent) preloadPublishedResumes(publishedContent);
