import React, { useState, useEffect } from 'react';
import { Heart, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

interface DevArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet?: string;
}

export const DevCommunityView: React.FC<{ onNavigateUrl?: (url: string) => void }> = ({ onNavigateUrl }) => {
  const [articles, setArticles] = useState<DevArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({});

  const fetchLiveNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/browse/news?q=tech');
      if (!res.ok) throw new Error('Failed to fetch live tech news');
      const data = await res.json();
      if (data.success && Array.isArray(data.news)) {
        setArticles(data.news);
      } else {
        setArticles([]);
      }
    } catch (err: any) {
      console.warn('[DevCommunityView] Error loading live news:', err);
      setError(err?.message || 'Unable to connect to live DEV feeds');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveNews();
  }, []);

  const handleToggleHeart = (url: string) => {
    setReactions((prev) => ({
      ...prev,
      [url]: (prev[url] || 0) + 1,
    }));
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0d1117] text-slate-100 font-sans select-text overflow-y-auto">
      {/* Top Navbar */}
      <header className="px-6 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#161b22] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded bg-black border border-white/20 font-black text-xs text-white tracking-widest">
            DEV
          </div>
          <span className="font-bold text-sm text-white">DEV & Tech Community</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLiveNews}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Feed */}
      <main className="max-w-4xl mx-auto p-6 sm:p-8 space-y-6 w-full flex-1">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg text-white">Live Community Articles & Discussions</h1>
          {!loading && <span className="text-xs text-slate-400">Showing {articles.length} live posts</span>}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Fetching live DEV & Tech feeds...</p>
          </div>
        ) : error || articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#161b22] rounded-2xl border border-white/10 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-500" />
            <h3 className="text-sm font-bold text-white">No live community articles available</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {error || 'The live tech feed returned no items. Please check your network or refresh.'}
            </p>
            <button
              onClick={fetchLiveNews}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((art, idx) => (
              <div
                key={art.url || idx}
                className="p-5 rounded-2xl bg-[#161b22] border border-white/10 space-y-3 shadow-md hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2.5 py-0.5 rounded-full">
                    {art.source || 'DEV Community'}
                  </span>
                  <span className="text-[11px] text-slate-400">{art.publishedAt}</span>
                </div>

                <h2
                  onClick={() => onNavigateUrl && onNavigateUrl(art.url)}
                  className="text-base sm:text-lg font-bold text-white leading-snug hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {art.title}
                </h2>

                {art.snippet && (
                  <p className="text-xs text-slate-300 leading-relaxed">{art.snippet}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
                  <button
                    onClick={() => handleToggleHeart(art.url)}
                    className="flex items-center gap-1.5 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Heart className={`w-4 h-4 ${(reactions[art.url] || 0) > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{(reactions[art.url] || 0) > 0 ? `${reactions[art.url]} likes` : 'Like'}</span>
                  </button>

                  <a
                    href={art.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                  >
                    <span>Read Full Article</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
