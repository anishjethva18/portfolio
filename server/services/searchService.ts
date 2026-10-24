export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
  icon?: string;
  category?: string;
  displayedUrl?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  author?: string;
  publishedAt?: string;
  time?: string;
  snippet: string;
  commentsCount?: number;
  score?: number;
}

export interface VideoItem {
  title: string;
  channel: string;
  views: string;
  time: string;
  duration: string;
  thumb: string;
  url: string;
}

export interface KnowledgePanelData {
  title: string;
  subtitle: string;
  description: string;
  attributes?: Record<string, string>;
  sourceUrl: string;
  imageUrl?: string;
}

export class SearchService {
  /**
   * Decodes Bing redirection URL (e.g. u=a1aHR0cHM6Ly9...) to the authentic destination URL
   */
  public decodeBingUrl(rawUrl: string): string {
    try {
      const uMatch = rawUrl.match(/[?&;]u=([a-zA-Z0-9_\-=]+)/);
      if (uMatch) {
        let b64 = uMatch[1];
        if (b64.startsWith('a1')) b64 = b64.slice(2);
        while (b64.length % 4 !== 0) b64 += '=';
        b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
      }
    } catch {
      // ignore
    }
    return rawUrl;
  }

  /**
   * Live Web Search aggregation across real web search, Wikipedia, and developer repositories
   */
  public async search(query: string): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results: SearchResultItem[] = [];
    const seenUrls = new Set<string>();

    // 1. Live Web Search via verified Bing extraction
    try {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(bingUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (res.ok) {
        const html = await res.text();
        const algoRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
        let match;
        let count = 0;

        while ((match = algoRegex.exec(html)) !== null && count < 10) {
          const itemHtml = match[1];
          const titleMatch = itemHtml.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/i);
          const snippetMatch = itemHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

          if (titleMatch) {
            const rawHref = titleMatch[1];
            const cleanTitle = titleMatch[2].replace(/<[^>]+>/g, '').trim();
            const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
            const finalUrl = this.decodeBingUrl(rawHref);

            if (finalUrl.startsWith('http') && !seenUrls.has(finalUrl)) {
              seenUrls.add(finalUrl);
              let domain = '';
              try {
                domain = new URL(finalUrl).hostname.replace(/^www\./, '');
              } catch {
                domain = 'web';
              }

              results.push({
                title: cleanTitle,
                url: finalUrl,
                displayedUrl: finalUrl.length > 55 ? `${finalUrl.slice(0, 52)}...` : finalUrl,
                snippet: snippet || '',
                source: domain,
                category: 'web',
              });
              count++;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SearchService] Bing live search warning:', e);
    }

    // 2. Wikipedia Search API
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        trimmed
      )}&format=json&origin=*&utf8=1&srlimit=4`;
      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'Win11PortfolioBrowser/2.0' },
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.query?.search) {
          for (const item of data.query.search) {
            const targetUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
            if (!seenUrls.has(targetUrl)) {
              seenUrls.add(targetUrl);
              results.push({
                title: `${item.title} — Wikipedia`,
                url: targetUrl,
                displayedUrl: targetUrl,
                snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''),
                source: 'en.wikipedia.org',
                category: 'encyclopedia',
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SearchService] Wikipedia query warning:', e);
    }

    // 3. DuckDuckGo Instant Answers API
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Win11PortfolioBrowser/2.0' },
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.AbstractText && data.AbstractURL && !seenUrls.has(data.AbstractURL)) {
          seenUrls.add(data.AbstractURL);
          results.push({
            title: data.Heading || trimmed,
            url: data.AbstractURL,
            displayedUrl: data.AbstractURL,
            snippet: data.AbstractText,
            source: data.AbstractSource || 'duckduckgo.com',
            category: 'knowledge',
          });
        }
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 4)) {
            if (topic.Text && topic.FirstURL && !seenUrls.has(topic.FirstURL)) {
              seenUrls.add(topic.FirstURL);
              results.push({
                title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
                url: topic.FirstURL,
                displayedUrl: topic.FirstURL,
                snippet: topic.Text,
                source: 'web',
                category: 'web',
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SearchService] DuckDuckGo query warning:', e);
    }

    return results;
  }

  /**
   * Fetch Live Real News from Google News RSS
   */
  public async searchNews(query: string): Promise<NewsItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const newsList: NewsItem[] = [];
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(trimmed)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });

      if (res.ok) {
        const xml = await res.text();
        const regex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>[\s\S]*?<\/item>/g;
        let m;
        let count = 0;

        while ((m = regex.exec(xml)) !== null && count < 8) {
          const rawTitle = m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          const link = m[2].trim();
          const pubDate = m[3].trim();
          const source = m[4].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();

          let relativeTime = pubDate;
          try {
            const date = new Date(pubDate);
            const diffHours = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60));
            if (diffHours < 1) {
              relativeTime = 'Just now';
            } else if (diffHours < 24) {
              relativeTime = `${diffHours} hours ago`;
            } else {
              const diffDays = Math.round(diffHours / 24);
              relativeTime = `${diffDays} days ago`;
            }
          } catch {}

          newsList.push({
            id: `news-${Date.now()}-${count}`,
            title: rawTitle,
            url: link,
            source: source || 'Google News',
            time: relativeTime,
            publishedAt: pubDate,
            snippet: `${rawTitle} — Reported by ${source}.`,
          });
          count++;
        }
      }
    } catch (e) {
      console.warn('[SearchService] News fetch warning:', e);
    }

    return newsList;
  }

  /**
   * Fetch Real YouTube Videos by parsing YouTube search results
   */
  public async searchVideos(query: string): Promise<VideoItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const videos: VideoItem[] = [];
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (res.ok) {
        const html = await res.text();
        const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1]);
          const contents =
            data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
              ?.itemSectionRenderer?.contents || [];

          for (const item of contents) {
            const v = item.videoRenderer;
            if (v && v.videoId && videos.length < 8) {
              const title = v.title?.runs?.[0]?.text || '';
              const channel = v.ownerText?.runs?.[0]?.text || 'YouTube Creator';
              const views = v.viewCountText?.simpleText || `${v.shortViewCountText?.simpleText || 'Popular'}`;
              const time = v.publishedTimeText?.simpleText || 'Recently uploaded';
              const duration = v.lengthText?.simpleText || 'Video';
              const thumb = v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
              const videoUrl = `https://www.youtube.com/watch?v=${v.videoId}`;

              videos.push({
                title,
                channel,
                views,
                time,
                duration,
                thumb,
                url: videoUrl,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SearchService] YouTube video search warning:', e);
    }

    return videos;
  }

  /**
   * Fetch Knowledge Panel from Wikipedia Summary API
   */
  public async getKnowledgePanel(query: string): Promise<KnowledgePanelData | null> {
    const trimmed = query.trim();
    if (!trimmed) return null;

    try {
      const sanitized = encodeURIComponent(trimmed.replace(/ /g, '_'));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${sanitized}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Win11PortfolioBrowser/2.0' },
      });

      if (res.ok) {
        const data: any = await res.json();
        if (data && data.title && (data.extract || data.description)) {
          return {
            title: data.title,
            subtitle: data.description || 'General Subject & Reference',
            description: data.extract || '',
            sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${sanitized}`,
            imageUrl: data.thumbnail?.source || undefined,
            attributes: {
              'Subject': data.title,
              'Source': 'Wikipedia, The Free Encyclopedia',
              'Verified': 'Live Knowledge Graph',
            },
          };
        }
      }
    } catch (e) {
      console.warn('[SearchService] Knowledge panel fetch error:', e);
    }

    return null;
  }

  /**
   * Fetch Live Real Tech & Dev News from HackerNews Top Stories & Dev.to Articles
   */
  public async getTechNews(): Promise<NewsItem[]> {
    const newsList: NewsItem[] = [];

    // 1. Fetch from Dev.to Top Articles API
    try {
      const res = await fetch('https://dev.to/api/articles?per_page=12&top=1');
      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            newsList.push({
              id: `devto-${item.id}`,
              title: item.title,
              url: item.url,
              source: 'DEV Community',
              author: item.user?.name || 'Dev Community',
              publishedAt: item.published_at || new Date().toISOString(),
              snippet: item.description || (item.tags ? `Tags: ${item.tags}` : 'Tech development article.'),
              score: item.positive_reactions_count || item.comments_count || 10,
              commentsCount: item.comments_count,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[SearchService] DEV.to news warning:', e);
    }

    // 2. Fetch Hacker News Top Stories if needed
    if (newsList.length < 8) {
      try {
        const topIdsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        if (topIdsRes.ok) {
          const ids: any = await topIdsRes.json();
          const topFew = (Array.isArray(ids) ? ids : []).slice(0, 8);
          const stories = await Promise.all(
            topFew.map(async (id: any) => {
              const sRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
              return sRes.ok ? ((await sRes.json()) as any) : null;
            })
          );

          for (const story of stories) {
            if (story && story.title) {
              newsList.push({
                id: `hn-${story.id}`,
                title: story.title,
                url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
                source: 'Hacker News',
                author: story.by || 'HN User',
                publishedAt: new Date(story.time * 1000).toISOString(),
                snippet: `${story.score || 0} points • ${story.descendants || 0} comments • Shared by ${story.by}`,
                score: story.score,
                commentsCount: story.descendants,
              });
            }
          }
        }
      } catch (e) {
        console.warn('[SearchService] HackerNews fetch warning:', e);
      }
    }

    return newsList;
  }

  /**
   * Fetch full Wikipedia article summary
   */
  public async getWikipediaSummary(title: string): Promise<any> {
    try {
      const sanitized = encodeURIComponent(title.trim().replace(/ /g, '_'));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${sanitized}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Win11PortfolioBrowser/2.0' },
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.warn('[SearchService] Wikipedia summary error:', e);
      return null;
    }
  }
}

export const searchService = new SearchService();

