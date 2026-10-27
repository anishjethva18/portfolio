import { Router, Request, Response } from 'express';
import { contentProxy } from '../services/contentProxy';
import { searchService } from '../services/searchService';
import { geminiSearchService } from '../services/geminiSearchService';
import { SiteContentModel } from '../models';
import { PROXY_CONTENT_SECURITY_POLICY } from '../config/httpSecurity';

export const browseRouter = Router();

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function safeScriptJson(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

async function isExternalSearchEnabled(): Promise<boolean> {
  const published = await SiteContentModel.findOne({ key: 'primary_portfolio_content' })
    .select('siteSettings.assistantEnabled')
    .lean();
  return published?.siteSettings?.assistantEnabled !== false;
}

// GET /api/browse/gemini-search?q=<query>
browseRouter.get('/gemini-search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query.trim()) {
    return res.json({
      query: '',
      organicResults: [],
      videos: [],
      news: [],
      images: [],
      peopleAlsoAsk: [],
      relatedSearches: [],
    });
  }

  try {
    if (!(await isExternalSearchEnabled())) {
      const fallbackResults = await searchService.search(query);
      res.json({
        success: true,
        query,
        organicResults: fallbackResults,
        videos: [],
        news: [],
        images: [],
        peopleAlsoAsk: [],
        relatedSearches: [],
        source: 'local',
      });
      return;
    }
    const data = await geminiSearchService.searchWeb(query);
    res.json({ success: true, ...data });
  } catch (err: any) {
    console.warn('[browseRouter] gemini-search handled error:', err?.message || err);
    // Fallback to local search index
    const fallbackResults = await searchService.search(query);
    res.json({
      success: true,
      query,
      organicResults: fallbackResults,
      videos: [],
      news: [],
      images: [],
      peopleAlsoAsk: [],
      relatedSearches: [],
    });
  }
});

// GET /api/browse/youtube?q=<query>&category=<category>
browseRouter.get('/youtube', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const category = (req.query.category as string) || 'All';

  try {
    if (!(await isExternalSearchEnabled())) {
      res.json({ success: true, query, category, count: 0, videos: [] });
      return;
    }
    const videos = await geminiSearchService.searchYouTube(query, category);
    res.json({ success: true, query, category, count: videos.length, videos });
  } catch (err: any) {
    console.warn('[browseRouter] youtube handled error:', err?.message || err);
    res.json({ success: true, query, category, count: 0, videos: [] });
  }
});

// GET /api/browse/news?q=<query>
browseRouter.get('/news', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  try {
    const news = query ? await searchService.searchNews(query) : await searchService.getTechNews();
    res.json({ success: true, count: news.length, news });
  } catch (err: any) {
    console.warn('[browseRouter] news handled error:', err?.message || err);
    res.json({ success: true, count: 0, news: [] });
  }
});

// GET /api/browse/proxy?url=<target_url>
browseRouter.get('/proxy', async (req: Request, res: Response) => {
  const targetUrl = req.query.url;
  res.setHeader('Content-Security-Policy', PROXY_CONTENT_SECURITY_POLICY);
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (typeof targetUrl !== 'string' || !targetUrl.trim() || targetUrl.length > 2048) {
    return res.status(400).send('A valid "url" query parameter of at most 2048 characters is required.');
  }

  const result = await contentProxy.fetchAndSanitize(targetUrl);
  if (!result.success || !result.html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const safeError = escapeHtml(result.error || 'Host unreachable or refusing proxy connection.');
    const safeTargetUrl = escapeHtml(targetUrl);
    let safeExternalUrl = '';
    try {
      const parsedTarget = new URL(/^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`);
      if (parsedTarget.protocol === 'http:' || parsedTarget.protocol === 'https:') {
        safeExternalUrl = escapeHtml(parsedTarget.href);
      }
    } catch {
      safeExternalUrl = '';
    }
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Proxy Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 540px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); text-align: center; }
            h2 { color: #f87171; margin-top: 0; font-size: 18px; }
            p { color: #94a3b8; line-height: 1.6; font-size: 13px; }
            .btn { display: inline-block; margin-top: 16px; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 13px; }
            .btn:hover { background: #1d4ed8; }
            code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-size: 12px; }
          </style>
          <script>
            function sendErr() {
              try {
                window.parent.postMessage({
                  type: 'BROWSER_PROXY_ERROR',
                  error: ${safeScriptJson(result.error || 'Host unreachable or refusing proxy connection.')},
                  url: ${safeScriptJson(targetUrl)}
                }, '*');
              } catch(e) {}
            }
            sendErr();
            window.addEventListener('load', sendErr);
          </script>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Unable to Connect to Web Page</h2>
            <p>The Edge proxy was unable to fetch content from <code>${safeTargetUrl}</code>.</p>
            <p><strong>Reason:</strong> ${safeError}</p>
            ${safeExternalUrl ? `<a href="${safeExternalUrl}" target="_blank" class="btn" rel="noreferrer">Open in New Browser Window ↗</a>` : ''}
          </div>
        </body>
      </html>
    `);
  }

  res.setHeader('Content-Type', result.contentType || 'text/html; charset=utf-8');
  res.send(result.html);
});

// GET /api/browse/search?q=<query>
browseRouter.get('/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query.trim()) {
    return res.json({ query: '', results: [] });
  }

  try {
    const results = await searchService.search(query);
    res.json({ query, count: results.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search service error' });
  }
});

// GET /api/browse/news
browseRouter.get('/news', async (req: Request, res: Response) => {
  try {
    const news = await searchService.getTechNews();
    res.json({ success: true, count: news.length, news });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'News service error' });
  }
});

// GET /api/browse/wikipedia?title=<title>
browseRouter.get('/wikipedia', async (req: Request, res: Response) => {
  const title = req.query.title as string;
  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  const summary = await searchService.getWikipediaSummary(title);
  if (!summary) {
    return res.status(404).json({ error: 'Wikipedia article not found' });
  }
  res.json(summary);
});
