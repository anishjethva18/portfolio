import React, { useState, useEffect } from 'react';
import { Search, Globe, RefreshCw, BookOpen } from 'lucide-react';

interface ArticleData {
  title: string;
  subtitle?: string;
  extract: string;
  sections?: Array<{ title: string; content: string }>;
  infobox?: Record<string, string>;
  image?: string;
  articleUrl?: string;
}

interface WikipediaViewProps {
  initialArticle?: string;
  onNavigateUrl?: (url: string) => void;
}

export const WikipediaView: React.FC<WikipediaViewProps> = ({
  initialArticle = 'windows 11',
  onNavigateUrl,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<ArticleData | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchArticle = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/browse/wikipedia?title=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setArticle({
          title: data.title || query,
          subtitle: data.description || 'Wikipedia Encyclopedia Article',
          extract: data.extract || 'No extract available.',
          image: data.thumbnail?.source || undefined,
          articleUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/ /g, '_'))}`,
          infobox: {
            Language: 'English (en)',
            Source: 'Wikimedia Foundation',
            API: 'Wikipedia REST v1',
          },
        });
      } else {
        throw new Error('Wikipedia article not found.');
      }
    } catch (err: any) {
      setError(err?.message || 'Wikipedia article could not be loaded.');
      setArticle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialArticle) {
      fetchArticle(initialArticle);
    }
  }, [initialArticle]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const term = searchTerm.trim();
    if (onNavigateUrl) {
      onNavigateUrl(`https://en.wikipedia.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}`);
    } else {
      fetchArticle(term);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans select-text overflow-y-auto">
      {/* Top Wikipedia Header */}
      <header className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/80 sticky top-0 z-20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigateUrl?.('https://wikipedia.org')}>
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center font-serif text-xl font-bold">
            W
          </div>
          <div>
            <span className="font-serif text-lg font-bold tracking-wider">WIKIPEDIA</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">The Free Encyclopedia</p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search live Wikipedia..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            Search
          </button>
        </form>
      </header>

      {/* Main Encyclopedia Article */}
      <main className="max-w-4xl mx-auto p-6 sm:p-10 space-y-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-blue-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Connecting to live Wikipedia API...</span>
          </div>
        ) : error || !article ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Wikipedia Article Unavailable</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {error || 'No live Wikipedia article was found for this query.'}
            </p>
          </div>
        ) : article ? (
          <>
            {/* Title & Article Link */}
            <div className="border-b border-slate-200 dark:border-white/10 pb-4 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold tracking-tight">{article.title}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{article.subtitle}</p>
              </div>

              {article.articleUrl && (
                <button
                  onClick={() => onNavigateUrl?.(article.articleUrl!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-500/20 transition-all cursor-pointer shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>View Live Page</span>
                </button>
              )}
            </div>

            {/* Article Body */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <p className="whitespace-pre-line text-base font-serif leading-relaxed">{article.extract}</p>
              </div>

              {/* Sidebar Infobox */}
              <div className="md:col-span-1 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 space-y-3 h-fit text-xs">
                <div className="text-center font-bold font-serif text-sm pb-2 border-b border-slate-200 dark:border-white/10">
                  {article.title}
                </div>

                {article.image && (
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full rounded-xl object-cover aspect-video border border-white/10 shadow-sm"
                  />
                )}

                {article.infobox && (
                  <div className="space-y-1.5 pt-2">
                    {Object.entries(article.infobox).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 border-b border-slate-200/50 dark:border-white/5 pb-1">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">{k}</span>
                        <span className="text-slate-800 dark:text-slate-200 text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
};
