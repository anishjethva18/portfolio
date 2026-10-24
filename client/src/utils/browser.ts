export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  icon?: string;
  category?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  author: string;
  publishedAt: string;
  snippet: string;
  score?: number;
  commentsCount?: number;
}

export function isValidWebUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('file:')) {
    return false;
  }
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('.') || trimmed.startsWith('about:');
}

export function normalizeBrowserUrl(rawInput: string): string {
  let url = rawInput.trim();
  if (!url) return 'about:home';

  // Handle internal OS sites
  if (url === 'about:home' || url === 'about:blank' || url === 'about:newtab') {
    return url;
  }

  if (url.startsWith('alexrivera.dev') || url.startsWith('anishjethva.dev')) {
    return 'https://anishjethva.dev';
  }

  // If looks like a search query rather than a URL (contains spaces or no dot)
  if (url.includes(' ') || (!url.includes('.') && !url.startsWith('localhost'))) {
    return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return url;
}

export function getProxiedUrl(targetUrl: string): string {
  if (targetUrl.startsWith('about:') || targetUrl.startsWith('data:')) {
    return targetUrl;
  }
  return `/api/browse/proxy?url=${encodeURIComponent(targetUrl)}`;
}

export async function fetchLiveSearchResults(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`/api/browse/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
  } catch (e) {
    console.warn('[BrowserUtils] Search fetch error:', e);
  }
  return [];
}

export async function fetchLiveTechNews(): Promise<NewsArticle[]> {
  try {
    const res = await fetch('/api/browse/news');
    if (res.ok) {
      const data = await res.json();
      return data.news || [];
    }
  } catch (e) {
    console.warn('[BrowserUtils] News fetch error:', e);
  }
  return [];
}

export async function fetchWikipediaSummary(title: string): Promise<any> {
  try {
    const res = await fetch(`/api/browse/wikipedia?title=${encodeURIComponent(title)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[BrowserUtils] Wikipedia fetch error:', e);
  }
  return null;
}
