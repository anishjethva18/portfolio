import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Mic,
  Play,
  Music,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Globe,
  Youtube,
  Sparkles,
  Volume2,
  Share2,
  RefreshCw,
} from 'lucide-react';

interface GeminiKnowledgePanel {
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  attributes?: Record<string, string>;
  sourceUrl?: string;
}

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  displayedUrl?: string;
  publishedDate?: string;
  category?: string;
}

interface GeminiSearchSong {
  id?: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  year: string;
  views: string;
  cover?: string;
}

interface GeminiSearchResponse {
  query: string;
  summary?: string;
  groundingSources?: Array<{ title: string; uri: string }>;
  knowledgePanel?: GeminiKnowledgePanel;
  songs?: GeminiSearchSong[];
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

interface GoogleSearchResultsViewProps {
  query: string;
  onNavigate: (url: string) => void;
  onSearch: (q: string) => void;
  onOpenVoiceSearch: () => void;
  onOpenGoogleLens?: () => void;
}

export const GoogleSearchResultsView: React.FC<GoogleSearchResultsViewProps> = ({
  query,
  onNavigate,
  onSearch,
  onOpenVoiceSearch,
}) => {
  const [searchInput, setSearchInput] = useState(query);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Images' | 'Videos' | 'News' | 'Maps' | 'Shopping'>('All');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [searchData, setSearchData] = useState<GeminiSearchResponse | null>(null);

  // Sync search input if external query changes
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Fetch live AI grounded search results from server
  useEffect(() => {
    let isCancelled = false;
    const fetchSearchResults = async () => {
      if (!query.trim()) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/browse/gemini-search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data: GeminiSearchResponse = await res.json();
          if (!isCancelled) {
            setSearchData(data);
          }
        }
      } catch (err) {
        console.warn('[GoogleSearchResultsView] Live search error:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchSearchResults();
    return () => {
      isCancelled = true;
    };
  }, [query]);

  const cleanQuery = (query || '').toLowerCase().trim();

  // Categorize query intent
  const isYouTubeQuery =
    cleanQuery.includes('youtube') ||
    cleanQuery === 'yt' ||
    cleanQuery.includes('video') ||
    cleanQuery.includes('channel');

  const isMusicQuery =
    cleanQuery.includes('song') ||
    cleanQuery.includes('music') ||
    cleanQuery.includes('track') ||
    cleanQuery.includes('album') ||
    cleanQuery.includes('spotify') ||
    cleanQuery.includes('audio') ||
    cleanQuery.includes('listen') ||
    cleanQuery.includes('sing') ||
    cleanQuery.includes('pop') ||
    cleanQuery.includes('rock') ||
    cleanQuery.includes('rap') ||
    cleanQuery.includes('band');

  const isWeatherQuery =
    cleanQuery.includes('weather') ||
    cleanQuery.includes('temperature') ||
    cleanQuery.includes('forecast') ||
    cleanQuery.includes('rain') ||
    cleanQuery.includes('climate');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  // Play synthesized audio tone / chime preview when song play button is clicked
  const playSongAudio = (songId: string) => {
    if (playingSongId === songId) {
      setPlayingSongId(null);
      return;
    }
    setPlayingSongId(songId);
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const notes = [261.63, 329.63, 392.00, 523.25, 440.00, 349.23];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.25);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.25);
          osc.stop(ctx.currentTime + i * 0.25 + 0.4);
        });
      }
    } catch {}
  };

  const SONGS_LIST = useMemo(() => {
    return searchData?.songs || [];
  }, [searchData?.songs]);

  const capitalizedQuery = query ? query.charAt(0).toUpperCase() + query.slice(1) : 'Search';

  const imageResults = searchData?.images || [];
  const videoResults = searchData?.videos || [];
  const newsResults = searchData?.news || [];
  const organicList = searchData?.organicResults || [];
  const kp = searchData?.knowledgePanel;
  const faqs = searchData?.peopleAlsoAsk || [];
  const related = searchData?.relatedSearches || [];

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#202124] text-slate-800 dark:text-[#bdc1c6] font-sans overflow-y-auto select-text">
      {/* Top Google Header with Search Bar */}
      <div className="sticky top-0 z-30 bg-white dark:bg-[#202124] border-b border-slate-200 dark:border-[#3c4043] px-4 sm:px-8 py-3 shrink-0 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 max-w-5xl">
          {/* Google Logo */}
          <div
            onClick={() => onNavigate('chrome://newtab')}
            className="flex items-center cursor-pointer shrink-0"
          >
            <span className="text-xl sm:text-2xl font-bold tracking-tight">
              <span className="text-blue-500">G</span>
              <span className="text-red-500">o</span>
              <span className="text-yellow-500">o</span>
              <span className="text-blue-500">g</span>
              <span className="text-green-500">l</span>
              <span className="text-red-500">e</span>
            </span>
          </div>

          {/* Search Pill Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 flex items-center bg-slate-100 dark:bg-[#303134] rounded-full px-4 py-2 border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all shadow-xs"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none placeholder-slate-400"
              placeholder="Search Google or type a URL..."
            />
            <div className="flex items-center gap-1 pl-2">
              <button
                type="button"
                onClick={onOpenVoiceSearch}
                className="p-1 text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                title="Search by voice"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="p-1 text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Tab Filters (All, Images, Videos, News, Maps, Shopping) */}
        <div className="flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400 mt-3 sm:ml-28 max-w-5xl overflow-x-auto no-scrollbar">
          {(['All', 'Images', 'Videos', 'News', 'Maps', 'Shopping'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`pb-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === filter
                  ? 'border-blue-600 dark:border-[#8ab4f8] text-blue-600 dark:text-[#8ab4f8] font-bold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Main Results Body */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-4 sm:ml-28 space-y-6">
        {/* Results Metadata */}
        <div className="text-[12px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            {organicList.length > 0 ? `About ${organicList.length} results` : `Search results`} for "{query}"
          </span>
          {isLoading && (
            <span className="flex items-center gap-1.5 text-blue-500 dark:text-[#8ab4f8] font-medium text-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Fetching live results...
            </span>
          )}
        </div>

        {/* ================= IF ACTIVE FILTER IS IMAGES ================= */}
        {activeFilter === 'Images' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Images for {query}</h2>
            {imageResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imageResults.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => onNavigate(img.src)}
                    className="group rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-xs hover:shadow-md transition-all"
                  >
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={img.src}
                        alt={img.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{img.title}</p>
                      <span className="text-[10px] text-slate-400">{img.domain}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No images found for "{query}".
              </div>
            )}
          </div>
        )}

        {/* ================= IF ACTIVE FILTER IS VIDEOS ================= */}
        {activeFilter === 'Videos' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Videos for {query}</h2>
            {videoResults.length > 0 ? (
              <div className="space-y-4">
                {videoResults.map((vid, i) => (
                  <div
                    key={i}
                    onClick={() => onNavigate(vid.url || `https://youtube.com/results?search_query=${encodeURIComponent(query)}`)}
                    className="flex gap-4 p-3 rounded-2xl border border-slate-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="relative w-40 aspect-video rounded-xl overflow-hidden bg-slate-800 shrink-0">
                      <img src={vid.thumb} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono font-bold">{vid.duration}</span>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-blue-700 dark:text-[#8ab4f8] group-hover:underline line-clamp-2">{vid.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">YouTube · {vid.channel}</p>
                      <p className="text-[11px] text-slate-400">{vid.views} · {vid.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No videos found for "{query}".
              </div>
            )}
          </div>
        )}

        {/* ================= IF ACTIVE FILTER IS NEWS ================= */}
        {activeFilter === 'News' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">News for {query}</h2>
            {newsResults.length > 0 ? (
              <div className="space-y-3">
                {newsResults.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => onNavigate(item.url || 'https://news.google.com')}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] hover:shadow-md transition-all cursor-pointer group space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{item.source}</span>
                      <span>{item.time}</span>
                    </div>
                    <h3 className="text-base font-semibold text-blue-700 dark:text-[#8ab4f8] group-hover:underline">{item.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-[#bdc1c6] leading-relaxed">{item.snippet}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No news articles found for "{query}".
              </div>
            )}
          </div>
        )}

        {/* ================= ALL (DEFAULT) FILTER WITH RICH RESULTS & KNOWLEDGE GRAPH ================= */}
        {activeFilter === 'All' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Organic Matches & Rich Snippets */}
            <div className={`space-y-6 max-w-2xl ${kp ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              {/* GOOGLE AI OVERVIEW (GEMINI GROUNDED SUMMARY) */}
              {searchData?.summary && (
                <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-b from-blue-50/50 via-white to-white dark:from-[#1e2538] dark:via-[#202124] dark:to-[#202124] p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-[#8ab4f8] font-bold text-sm">
                      <Sparkles className="w-4 h-4" />
                      <span>AI Overview</span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      Powered by Gemini with Google Search
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                    {searchData.summary}
                  </p>

                  {/* Grounding source pills */}
                  {searchData.groundingSources && searchData.groundingSources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 font-medium">Sources:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {searchData.groundingSources.slice(0, 4).map((src, i) => (
                          <button
                            key={i}
                            onClick={() => onNavigate(src.uri)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 text-[11px] text-blue-600 dark:text-[#8ab4f8] transition-colors cursor-pointer"
                          >
                            <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{src.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SPECIAL CASE 1: YOUTUBE SEARCH */}
              {isYouTubeQuery && (
                <div className="rounded-2xl border border-slate-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shrink-0">
                      <Youtube className="w-6 h-6 fill-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-[#bdc1c6]">
                        <span>https://www.youtube.com</span>
                      </div>
                      <button
                        onClick={() => onNavigate('https://youtube.com')}
                        className="text-xl font-semibold text-blue-700 dark:text-[#8ab4f8] hover:underline block text-left cursor-pointer"
                      >
                        YouTube — Watch, Stream, and Share Videos
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-[#bdc1c6] leading-relaxed">
                    Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world on YouTube.
                  </p>

                  {/* Sitelinks Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
                    <div
                      onClick={() => onNavigate('https://youtube.com')}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <h4 className="text-sm font-semibold text-blue-700 dark:text-[#8ab4f8] group-hover:underline">Trending</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">See what the world is watching right now in music, gaming, and viral news.</p>
                    </div>
                    <div
                      onClick={() => onNavigate('https://youtube.com')}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <h4 className="text-sm font-semibold text-blue-700 dark:text-[#8ab4f8] group-hover:underline">YouTube Music</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Explore official albums, live performances, and endless music playlists.</p>
                    </div>
                    <div
                      onClick={() => onNavigate('https://youtube.com')}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <h4 className="text-sm font-semibold text-blue-700 dark:text-[#8ab4f8] group-hover:underline">Gaming</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Watch live esports, top gameplay creators, and community streams.</p>
                    </div>
                    <div
                      onClick={() => onNavigate('https://youtube.com')}
                      className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <h4 className="text-sm font-semibold text-blue-700 dark:text-[#8ab4f8] group-hover:underline">Sign in</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Sign in to access your subscriptions, playlists, and history.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIAL CASE 2: SONGS / MUSIC (Only if live real songs returned) */}
              {SONGS_LIST.length > 0 && !isYouTubeQuery && (
                <div className="rounded-2xl border border-slate-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Music className="w-5 h-5 text-blue-500" />
                      <h2 className="text-base font-bold">Top Songs & Music</h2>
                    </div>
                    <span
                      onClick={() => onNavigate('https://youtube.com')}
                      className="text-xs text-blue-600 dark:text-[#8ab4f8] font-medium cursor-pointer hover:underline"
                    >
                      Listen on YouTube
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {SONGS_LIST.map((song, sIdx) => {
                      const songKey = song.id || `song-${sIdx}`;
                      const isPlaying = playingSongId === songKey;
                      return (
                        <div
                          key={songKey}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                              {song.cover ? (
                                <img
                                  src={song.cover}
                                  alt={song.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-700 text-white">
                                  <Music className="w-5 h-5" />
                                </div>
                              )}
                              <button
                                onClick={() => playSongAudio(songKey)}
                                className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-90 group-hover:opacity-100 transition-opacity cursor-pointer"
                              >
                                {isPlaying ? (
                                  <Volume2 className="w-5 h-5 text-green-400 animate-pulse" />
                                ) : (
                                  <Play className="w-5 h-5 fill-white ml-0.5" />
                                )}
                              </button>
                            </div>
                            <div
                              onClick={() => onNavigate(`https://youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.artist)}`)}
                              className="cursor-pointer"
                            >
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                                {song.title}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {song.artist} {song.album ? `• ${song.album}` : ''} {song.year ? `(${song.year})` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            {song.duration && <span className="text-xs text-slate-400 font-mono">{song.duration}</span>}
                            <button
                              onClick={() => onNavigate(`https://youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.artist)}`)}
                              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Watch song on YouTube"
                            >
                              <Youtube className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DYNAMIC ORGANIC SEARCH RESULTS */}
              {isLoading && organicList.length === 0 ? (
                <div className="space-y-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 animate-pulse">
                      <div className="h-3.5 bg-slate-200 dark:bg-white/10 rounded w-1/3" />
                      <div className="h-5 bg-slate-200 dark:bg-white/10 rounded w-4/5" />
                      <div className="h-3.5 bg-slate-200 dark:bg-white/10 rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : organicList.length > 0 ? (
                organicList.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#bdc1c6]">
                      <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">
                        {item.displayedUrl || item.url}
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigate(item.url)}
                      className="text-lg font-medium text-blue-700 dark:text-[#8ab4f8] hover:underline block text-left cursor-pointer leading-snug"
                    >
                      {item.title}
                    </button>
                    <p className="text-xs text-slate-600 dark:text-[#bdc1c6] leading-relaxed">
                      {item.snippet}
                    </p>
                  </div>
                ))
              ) : !isLoading && !searchData?.summary && !isYouTubeQuery ? (
                <div className="space-y-3 py-6 text-sm text-slate-600 dark:text-slate-300">
                  <p>Your search - <strong className="text-slate-900 dark:text-white font-bold">{query}</strong> - did not match any documents.</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Suggestions:</p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <li>Make sure all words are spelled correctly.</li>
                    <li>Try different keywords.</li>
                    <li>Try more general keywords.</li>
                  </ul>
                </div>
              ) : null}

              {/* People Also Ask Accordion (Only if real questions available) */}
              {faqs.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] p-4 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">People also ask</h3>
                  <div className="divide-y divide-slate-100 dark:divide-white/10 text-xs">
                    {faqs.map((faq, idx) => (
                      <div key={idx} className="py-2.5">
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                          className="w-full flex items-center justify-between font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-[#8ab4f8] cursor-pointer text-left"
                        >
                          <span>{faq.question}</span>
                          {expandedFaq === idx ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>
                        {expandedFaq === idx && (
                          <p className="mt-2 text-slate-600 dark:text-[#bdc1c6] leading-relaxed animate-in fade-in">
                            {faq.answer}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos Carousel Snippet (Only if real videos available) */}
              {videoResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-600" />
                    <span>Videos for {query}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {videoResults.slice(0, 2).map((vid, i) => (
                      <div
                        key={i}
                        onClick={() => onNavigate(vid.url || `https://youtube.com/results?search_query=${encodeURIComponent(query)}`)}
                        className="group rounded-xl border border-slate-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] overflow-hidden cursor-pointer hover:shadow-md transition-all flex flex-col"
                      >
                        <div className="relative aspect-video bg-slate-800 overflow-hidden">
                          <img src={vid.thumb} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono font-bold">{vid.duration}</span>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
                              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5 space-y-1">
                          <h4 className="text-xs font-semibold text-blue-700 dark:text-[#8ab4f8] group-hover:underline line-clamp-2">{vid.title}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{vid.channel} · {vid.views}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 1 Col: Dynamic Google Knowledge Panel Card */}
            {kp && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] p-5 shadow-xs space-y-4">
                  <div className="space-y-1 border-b border-slate-100 dark:border-white/10 pb-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {kp.title}
                      </h2>
                      <button
                        onClick={() => onNavigate(kp.sourceUrl || 'https://wikipedia.org')}
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                    {kp.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {kp.subtitle}
                      </p>
                    )}
                  </div>

                  {kp.imageUrl && (
                    <div className="rounded-xl overflow-hidden aspect-video bg-slate-800">
                      <img
                        src={kp.imageUrl}
                        alt={kp.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <p className="text-xs text-slate-600 dark:text-[#bdc1c6] leading-relaxed">
                    {kp.description}
                  </p>

                  {/* Attributes Table */}
                  {kp.attributes && Object.keys(kp.attributes).length > 0 && (
                    <div className="space-y-2 text-xs border-t border-slate-100 dark:border-white/10 pt-3">
                      {Object.entries(kp.attributes).map(([key, val]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-slate-50 dark:border-white/5 last:border-0">
                          <span className="text-slate-500 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {kp.sourceUrl && (
                    <button
                      onClick={() => onNavigate(kp.sourceUrl!)}
                      className="w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-white/5 hover:bg-blue-100 dark:hover:bg-white/10 text-xs font-bold text-blue-600 dark:text-[#8ab4f8] transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      <span>Open Source Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Related Searches Section */}
        {related.length > 0 && (
          <div className="pt-6 border-t border-slate-200 dark:border-[#3c4043] space-y-3 max-w-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Related searches</h3>
            <div className="flex flex-wrap gap-2">
              {related.map((rel, idx) => (
                <button
                  key={idx}
                  onClick={() => onSearch(rel)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-[#303134] hover:bg-slate-200 dark:hover:bg-[#3c4043] text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>{rel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
