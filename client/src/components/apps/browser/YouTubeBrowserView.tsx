import React, { useState, useEffect } from 'react';
import { Search, Play, ExternalLink, RefreshCw, CheckCircle2, ArrowLeft,  } from 'lucide-react';

interface YouTubeVideo {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  channelAvatar?: string;
  subscribers?: string;
  verified?: boolean;
  views: string;
  timestamp: string;
  duration: string;
  thumbnail: string;
  description?: string;
}

interface YouTubeBrowserViewProps {
  initialSearch?: string;
  onNavigateUrl?: (url: string) => void;
}

const CATEGORIES = ['All', 'Music', 'Tech & Coding', 'Gaming', 'AI & ML', 'Podcasts', 'Live'];

export const YouTubeBrowserView: React.FC<YouTubeBrowserViewProps> = ({ initialSearch = '', onNavigateUrl }) => {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [submittedQuery, setSubmittedQuery] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState('All');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);

  const fetchVideos = async (q: string, cat: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/browse/youtube?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.videos)) {
          setVideos(data.videos);
        } else {
          setVideos([]);
        }
      } else {
        setVideos([]);
      }
    } catch (err) {
      console.warn('[YouTubeBrowserView] Fetch error:', err);
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialSearch) {
      const videoMatch = initialSearch.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (videoMatch && videoMatch[1]) {
        setSelectedVideo({
          id: videoMatch[1],
          youtubeId: videoMatch[1],
          title: 'YouTube Video',
          channel: 'YouTube Channel',
          views: 'Live Video',
          timestamp: 'Just now',
          duration: 'Live',
          thumbnail: `https://i.ytimg.com/vi/${videoMatch[1]}/hqdefault.jpg`,
        });
      }
    }
  }, [initialSearch]);

  useEffect(() => {
    fetchVideos(submittedQuery, activeCategory);
  }, [submittedQuery, activeCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0f0f0f] text-slate-100 font-sans select-text overflow-y-auto">
      {/* YouTube Top Bar */}
      <header className="px-6 py-3.5 bg-[#212121] border-b border-white/10 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => { setSearchQuery(''); setSubmittedQuery(''); setSelectedVideo(null); }}>
          <div className="flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-lg font-black text-xs tracking-wider">
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>YouTube</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">Live Video Hub</span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center max-w-lg w-full">
          <div className="flex-1 flex items-center bg-[#121212] border border-white/15 rounded-l-full px-4 py-2 focus-within:border-blue-500">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search live YouTube videos..."
              className="w-full bg-transparent text-xs text-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-l-0 border-white/15 rounded-r-full text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-sm transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open YouTube</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1">
        {selectedVideo ? (
          /* Video Watch View */
          <div className="space-y-6 max-w-4xl mx-auto">
            <button
              onClick={() => setSelectedVideo(null)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to feed</span>
            </button>

            {/* Embed Player */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="space-y-3">
              <h1 className="text-xl font-bold text-white leading-snug">{selectedVideo.title}</h1>
              <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600/30 border border-red-500/30 flex items-center justify-center font-bold text-sm text-red-300">
                    {selectedVideo.channel.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <span>{selectedVideo.channel}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    </h3>
                    <p className="text-xs text-slate-400">{selectedVideo.subscribers || '100K'} subscribers</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={`https://www.youtube.com/watch?v=${selectedVideo.youtubeId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Watch on YouTube.com</span>
                  </a>
                </div>
              </div>

              {selectedVideo.description && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 leading-relaxed">
                  <p className="font-bold text-white mb-1">{selectedVideo.views} • {selectedVideo.timestamp}</p>
                  <p>{selectedVideo.description}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Browse Grid Feed */
          <div className="space-y-5">
            {/* Category Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-white text-black font-bold'
                      : 'bg-white/10 hover:bg-white/15 text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
                <p className="text-xs text-slate-400">Fetching live YouTube videos...</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-20 text-slate-400 space-y-2 bg-[#212121]/50 rounded-2xl border border-white/10 p-8">
                <Play className="w-12 h-12 mx-auto text-slate-600" />
                <h3 className="text-base font-bold text-white">No videos found</h3>
                <p className="text-xs text-slate-400">Try searching for another topic or category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {videos.map((vid) => (
                  <div
                    key={vid.id || vid.youtubeId}
                    onClick={() => setSelectedVideo(vid)}
                    className="flex flex-col space-y-2.5 cursor-pointer group"
                  >
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-800 shadow-md border border-white/10">
                      <img
                        src={vid.thumbnail}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 font-bold text-[10px] text-white">
                        {vid.duration}
                      </span>
                    </div>

                    <div className="flex gap-3 px-0.5">
                      <div className="w-9 h-9 rounded-full bg-red-600/30 border border-red-500/30 flex items-center justify-center font-bold text-xs text-red-300 shrink-0 mt-0.5">
                        {vid.channel.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden space-y-0.5">
                        <h3 className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                          {vid.title}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <span className="truncate">{vid.channel}</span>
                          <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {vid.views} • {vid.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
