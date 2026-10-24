import { GoogleGenAI } from '@google/genai';
import { searchService, SearchResultItem, NewsItem, VideoItem as SearchVideoItem, KnowledgePanelData } from './searchService';

export interface GeminiKnowledgePanel {
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  attributes?: Record<string, string>;
  sourceUrl?: string;
}

export interface GeminiVideoResult {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  channelAvatar: string;
  subscribers: string;
  verified: boolean;
  views: string;
  timestamp: string;
  duration: string;
  thumbnail: string;
  description: string;
  category: string;
  likes: number;
  comments: Array<{
    id: string;
    author: string;
    avatar: string;
    time: string;
    text: string;
    likes: number;
  }>;
}

export interface GeminiSearchResponse {
  query: string;
  summary?: string;
  groundingSources?: Array<{ title: string; uri: string }>;
  knowledgePanel?: GeminiKnowledgePanel;
  organicResults: SearchResultItem[];
  videos: Array<{
    title: string;
    channel: string;
    views: string;
    time: string;
    duration: string;
    thumb: string;
    url?: string;
  }>;
  news: Array<{
    title: string;
    source: string;
    time: string;
    snippet: string;
    url?: string;
  }>;
  images: Array<{
    title: string;
    src: string;
    domain: string;
  }>;
  peopleAlsoAsk: Array<{
    question: string;
    answer: string;
  }>;
  relatedSearches: string[];
}

// In-memory cache for live search responses
const webSearchCache = new Map<string, { timestamp: number; data: GeminiSearchResponse }>();
const youtubeSearchCache = new Map<string, { timestamp: number; data: GeminiVideoResult[] }>();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

class GeminiSearchService {
  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  /**
   * Performs dynamic Google Web Search with Search Grounding and live search aggregation
   */
  public async searchWeb(query: string): Promise<GeminiSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        query: '',
        organicResults: [],
        videos: [],
        news: [],
        images: [],
        peopleAlsoAsk: [],
        relatedSearches: [],
      };
    }

    const cacheKey = trimmed.toLowerCase();
    const cached = webSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // 1. Fetch real, live search results across web, news, videos, and knowledge graph
    const [liveOrganic, liveNews, liveVideos, liveKp] = await Promise.allSettled([
      searchService.search(trimmed),
      searchService.searchNews(trimmed),
      searchService.searchVideos(trimmed),
      searchService.getKnowledgePanel(trimmed),
    ]);

    const organicResults: SearchResultItem[] =
      liveOrganic.status === 'fulfilled' ? liveOrganic.value : [];
    const newsResults: NewsItem[] =
      liveNews.status === 'fulfilled' ? liveNews.value : [];
    const videoResults: SearchVideoItem[] =
      liveVideos.status === 'fulfilled' ? liveVideos.value : [];
    const kpResult: KnowledgePanelData | null =
      liveKp.status === 'fulfilled' ? liveKp.value : null;

    // 2. Attempt Google Search Grounding with Gemini if API key is present
    const groundingSources: Array<{ title: string; uri: string }> = [];
    const relatedSearches: string[] = [];
    let summary: string | undefined = undefined;

    const ai = this.getClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `Provide a concise, factual 2-sentence summary answering the search query: "${trimmed}".`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        if (response.text?.trim()) {
          summary = response.text.trim();
        }

        const candidate = response.candidates?.[0];
        const chunks = candidate?.groundingMetadata?.groundingChunks;
        if (chunks && Array.isArray(chunks)) {
          for (const chunk of chunks) {
            if (chunk.web?.uri && chunk.web?.title) {
              groundingSources.push({
                title: chunk.web.title,
                uri: chunk.web.uri,
              });
            }
          }
        }

        const searchQueries = candidate?.groundingMetadata?.webSearchQueries;
        if (searchQueries && Array.isArray(searchQueries)) {
          for (const sq of searchQueries) {
            if (typeof sq === 'string' && sq.trim() && !relatedSearches.includes(sq.trim())) {
              relatedSearches.push(sq.trim());
            }
          }
        }
      } catch (err: any) {
        if (err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('quota')) {
          console.debug('[GeminiSearchService] Gemini API quota reached, falling back to live web results.');
        } else {
          console.warn('[GeminiSearchService] Grounding call failed, using live web results:', err);
        }
      }
    }

    // 3. Combine verified grounding sources with live organic results (avoiding duplicates)
    const combinedOrganic: SearchResultItem[] = [...organicResults];
    const seenUrls = new Set<string>(organicResults.map((o) => o.url.toLowerCase()));

    for (const gs of groundingSources) {
      if (!seenUrls.has(gs.uri.toLowerCase())) {
        seenUrls.add(gs.uri.toLowerCase());
        let domain = 'google.com';
        try {
          domain = new URL(gs.uri).hostname.replace(/^www\./, '');
        } catch {}

        combinedOrganic.unshift({
          title: gs.title,
          url: gs.uri,
          displayedUrl: gs.uri.length > 55 ? `${gs.uri.slice(0, 52)}...` : gs.uri,
          snippet: gs.title ? `${gs.title} — Live reference via Google Search Grounding.` : '',
          source: domain,
          category: 'grounded',
        });
      }
    }

    // 4. Extract authentic images from live knowledge panel and YouTube search thumbnails
    const realImages: Array<{ title: string; src: string; domain: string }> = [];
    if (kpResult?.imageUrl) {
      realImages.push({
        title: `${kpResult.title} — Media`,
        src: kpResult.imageUrl,
        domain: 'wikipedia.org',
      });
    }
    for (const v of videoResults) {
      if (v.thumb && !realImages.some((img) => img.src === v.thumb)) {
        realImages.push({
          title: v.title,
          src: v.thumb,
          domain: 'youtube.com',
        });
      }
    }

    // 5. Assemble formatted Knowledge Panel only if genuine data exists
    let knowledgePanel: GeminiKnowledgePanel | undefined = undefined;
    if (kpResult) {
      knowledgePanel = {
        title: kpResult.title,
        subtitle: kpResult.subtitle,
        description: kpResult.description,
        attributes: kpResult.attributes,
        sourceUrl: kpResult.sourceUrl,
        imageUrl: kpResult.imageUrl,
      };
    }

    const finalResponse: GeminiSearchResponse = {
      query: trimmed,
      summary: summary || kpResult?.description || undefined,
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
      knowledgePanel,
      organicResults: combinedOrganic,
      videos: videoResults.map((v) => ({
        title: v.title,
        channel: v.channel,
        views: v.views,
        time: v.time,
        duration: v.duration,
        thumb: v.thumb,
        url: v.url,
      })),
      news: newsResults.map((n) => ({
        title: n.title,
        source: n.source,
        time: n.time || 'Recent',
        snippet: n.snippet,
        url: n.url,
      })),
      images: realImages,
      peopleAlsoAsk: [],
      relatedSearches,
    };

    webSearchCache.set(cacheKey, { timestamp: Date.now(), data: finalResponse });
    return finalResponse;
  }

  /**
   * Fetches real YouTube video search results from live sources only
   */
  public async searchYouTube(query: string, category: string = 'All'): Promise<GeminiVideoResult[]> {
    const trimmed = query.trim();
    const effectiveCategory = category !== 'All' ? category : '';
    const searchQuery = trimmed || effectiveCategory || 'trending';
    const cacheKey = `${searchQuery.toLowerCase()}::${category.toLowerCase()}`;

    const cached = youtubeSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const liveVideos = await searchService.searchVideos(searchQuery);
      if (liveVideos.length > 0) {
        const results: GeminiVideoResult[] = liveVideos.map((v, idx) => {
          const yId =
            v.url.match(/[?&]v=([a-zA-Z0-9_-]+)/)?.[1] ||
            v.url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)?.[1] ||
            '';

          return {
            id: `yt-${yId || idx}`,
            youtubeId: yId,
            title: v.title,
            channel: v.channel,
            channelAvatar: '',
            subscribers: 'Channel',
            verified: false,
            views: v.views || '0 views',
            timestamp: v.time || '',
            duration: v.duration || '',
            thumbnail: v.thumb,
            description: '',
            category: category !== 'All' ? category : 'General',
            likes: 0,
            comments: [],
          };
        });

        youtubeSearchCache.set(cacheKey, { timestamp: Date.now(), data: results });
        return results;
      }
    } catch (e) {
      console.warn('[GeminiSearchService] Real YouTube search failed:', e);
    }

    // Return empty array when live source fails or returns nothing
    return [];
  }
}

export const geminiSearchService = new GeminiSearchService();
