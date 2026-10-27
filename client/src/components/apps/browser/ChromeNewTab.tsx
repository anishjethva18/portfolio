import React, { useState } from 'react';
import {
  Search,
  Mic,
  Camera,
  Plus,
  Pencil,
  X,
  Check,
  Image as ImageIcon,
  Palette,
  Youtube,
  Github,
  Linkedin,
  Globe,
  BookOpen,
  Code2,
} from 'lucide-react';
import { ShortcutItem, ChromeTheme } from './types';

export const LIGHT_CHROME_THEME: ChromeTheme = {
  id: 'light-chrome',
  name: 'Light Chrome',
  tabBg: '#e2e8f0',
  toolbarBg: '#ffffff',
  activeTabBg: '#ffffff',
  wallpaperUrl: '',
  wallpaperTitle: 'Light Theme',
  wallpaperArtist: 'Google Chrome',
};

export const DARK_CHROME_THEME: ChromeTheme = {
  id: 'classic-chrome',
  name: 'Dark Chrome',
  tabBg: '#1f1f1f',
  toolbarBg: '#2b2b2b',
  activeTabBg: '#2b2b2b',
  wallpaperUrl: '',
  wallpaperTitle: 'Dark Theme',
  wallpaperArtist: 'Google Chrome',
};

export const WALLPAPER_PRESETS: ChromeTheme[] = [
  LIGHT_CHROME_THEME,
  DARK_CHROME_THEME,
  {
    id: 'deep-slate',
    name: 'Nordic Minimalist',
    tabBg: '#18181b',
    toolbarBg: '#27272a',
    activeTabBg: '#27272a',
    wallpaperUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&auto=format&fit=crop&q=80',
    wallpaperTitle: 'Nordic Architecture',
    wallpaperArtist: 'Studio Monolith',
  },
  {
    id: 'walli-polygon',
    name: 'Geometric Polygons',
    tabBg: '#2b1b24',
    toolbarBg: '#3d2534',
    activeTabBg: '#3d2534',
    wallpaperUrl:
      'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920&auto=format&fit=crop&q=80',
    wallpaperTitle: 'Geometric Crystals',
    wallpaperArtist: 'Polygon Studio',
  },
  {
    id: 'neon-city',
    name: 'Cyberpunk Skyline',
    tabBg: '#1e102a',
    toolbarBg: '#2e1840',
    activeTabBg: '#2e1840',
    wallpaperUrl:
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1920&auto=format&fit=crop&q=80',
    wallpaperTitle: 'Night Skyline',
    wallpaperArtist: 'Cyber Synth',
  },
  {
    id: 'sunset-gradient',
    name: 'Alpine Sunset',
    tabBg: '#2d142c',
    toolbarBg: '#441d40',
    activeTabBg: '#441d40',
    wallpaperUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&auto=format&fit=crop&q=80',
    wallpaperTitle: 'Alpine Sunset',
    wallpaperArtist: 'Nature Discovery',
  },
];

interface ChromeNewTabProps {
  onNavigate: (url: string) => void;
  shortcuts?: ShortcutItem[];
  onAddShortcut?: (shortcut: Omit<ShortcutItem, 'id'>) => void;
  onRemoveShortcut?: (id: string) => void;
  currentTheme: ChromeTheme;
  onSelectTheme?: (theme: ChromeTheme) => void;
  onOpenVoiceSearch: () => void;
  onOpenGoogleLens?: () => void;
  isLightMode?: boolean;
}

export const ChromeNewTab: React.FC<ChromeNewTabProps> = ({
  onNavigate,
  shortcuts = [],
  onAddShortcut,
  onRemoveShortcut,
  currentTheme,
  onSelectTheme,
  onOpenVoiceSearch,
  onOpenGoogleLens,
  isLightMode = false,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isAddShortcutOpen, setIsAddShortcutOpen] = useState(false);
  const [shortcutTitle, setShortcutTitle] = useState('');
  const [shortcutUrl, setShortcutUrl] = useState('');
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(true);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;

    if (q.startsWith('http://') || q.startsWith('https://')) {
      onNavigate(q);
    } else if (q.includes('.') && !q.includes(' ')) {
      onNavigate(`https://${q}`);
    } else {
      onNavigate(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
    }
  };

  const handleSaveShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcutTitle.trim() || !shortcutUrl.trim()) return;

    let cleanUrl = shortcutUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (onAddShortcut) {
      if (editingShortcutId && onRemoveShortcut) {
        onRemoveShortcut(editingShortcutId);
      }
      onAddShortcut({
        title: shortcutTitle.trim(),
        url: cleanUrl,
      });
    }

    setShortcutTitle('');
    setShortcutUrl('');
    setEditingShortcutId(null);
    setIsAddShortcutOpen(false);
  };

  const hasWallpaper = Boolean(currentTheme.wallpaperUrl);

  const getShortcutIcon = (item: ShortcutItem) => {
    const u = item.url.toLowerCase();
    if (u.includes('youtube.com')) return <Youtube className="w-5 h-5 text-red-500" />;
    if (u.includes('github.com')) return <Github className={`w-5 h-5 ${!hasWallpaper && isLightMode ? 'text-slate-900' : 'text-white'}`} />;
    if (u.includes('linkedin.com')) return <Linkedin className="w-5 h-5 text-sky-400" />;
    if (u.includes('wikipedia.org')) return <BookOpen className={`w-5 h-5 ${!hasWallpaper && isLightMode ? 'text-slate-700' : 'text-slate-200'}`} />;
    if (u.includes('dev.to')) return <Code2 className="w-5 h-5 text-emerald-400" />;
    if (u.includes('anishjethva.dev') || u.includes('alexrivera.dev')) return <Globe className="w-5 h-5 text-blue-400" />;
    return <Globe className="w-5 h-5 text-cyan-400" />;
  };

  return (
    <div
      className={`relative flex flex-col h-full w-full select-none overflow-hidden bg-cover bg-center ${
        hasWallpaper ? 'text-white' : isLightMode ? 'text-slate-800' : 'text-white'
      }`}
      style={{
        backgroundImage: hasWallpaper
          ? `linear-gradient(to bottom, rgba(0,0,0,0.30), rgba(0,0,0,0.60)), url('${currentTheme.wallpaperUrl}')`
          : undefined,
        backgroundColor: hasWallpaper ? undefined : (isLightMode ? '#f8fafc' : '#202124'),
      }}
    >
      {/* Main Center Body: Clean Google Logo + Search Bar + Shortcuts */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-3xl mx-auto w-full space-y-6 z-10 my-auto overflow-y-auto">
        {/* Google Display Logo */}
        <div className="flex items-center justify-center cursor-default tracking-tight select-none pt-4">
          <span className="text-5xl sm:text-6xl font-black tracking-normal font-sans drop-shadow-xl">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">o</span>
            <span className="text-[#4285F4]">g</span>
            <span className="text-[#34A853]">l</span>
            <span className="text-[#EA4335]">e</span>
          </span>
        </div>

        {/* Centered Omnibox / Search Pill */}
        <div className="w-full max-w-2xl relative">
          <form
            onSubmit={handleSearchSubmit}
            className={`w-full relative flex items-center rounded-full transition-all px-4 py-3.5 shadow-2xl ${
              isLightMode && !hasWallpaper
                ? 'bg-white border border-slate-300 hover:border-slate-400 focus-within:border-blue-500'
                : 'bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-white/20 hover:bg-white dark:hover:bg-slate-800/95 focus-within:bg-white dark:focus-within:bg-slate-900'
            }`}
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Google or type a URL..."
              className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none"
              autoFocus
            />

            <div className="flex items-center gap-1.5 pl-2 shrink-0">
              {/* Google Voice Search Trigger */}
              <button
                type="button"
                onClick={onOpenVoiceSearch}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Search by voice"
              >
                <Mic className="w-4 h-4 text-blue-500" />
              </button>

              {/* Google Lens Trigger */}
              {onOpenGoogleLens && (
                <button
                  type="button"
                  onClick={onOpenGoogleLens}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Search by image (Google Lens)"
                >
                  <Camera className="w-4 h-4 text-emerald-500" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Shortcuts Grid */}
        {showShortcuts && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 max-w-2xl w-full justify-items-center pt-2">
            {shortcuts.map((item) => (
              <div
                key={item.id}
                className={`group relative flex flex-col items-center gap-2 p-2 rounded-2xl transition-all cursor-pointer w-20 text-center ${
                  hasWallpaper
                    ? 'hover:bg-white/15'
                    : isLightMode
                      ? 'hover:bg-slate-200/70'
                      : 'hover:bg-white/10'
                }`}
                onClick={() => onNavigate(item.url)}
              >
                {/* Shortcut Icon Bubble */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-all ${
                    hasWallpaper
                      ? 'bg-white/15 dark:bg-slate-800/80 backdrop-blur-md border border-white/20 group-hover:bg-white/25'
                      : isLightMode
                        ? 'bg-white border border-slate-200 shadow-sm text-slate-800 group-hover:bg-slate-100'
                        : 'bg-slate-800/80 border border-white/10 group-hover:bg-slate-700/80'
                  }`}
                >
                  {getShortcutIcon(item)}
                </div>

                {/* Shortcut Label */}
                <span
                  className={`text-[11px] font-medium truncate w-full ${
                    hasWallpaper
                      ? 'text-white/95 drop-shadow group-hover:text-white'
                      : isLightMode
                        ? 'text-slate-800 group-hover:text-slate-950 font-semibold'
                        : 'text-zinc-200 group-hover:text-white'
                  }`}
                >
                  {item.title}
                </span>

                {/* Hover Delete Action */}
                {onRemoveShortcut && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveShortcut(item.id);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900/90 text-white hover:bg-red-500 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-md"
                    title="Remove shortcut"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Shortcut Button */}
            {onAddShortcut && (
              <button
                type="button"
                onClick={() => {
                  setShortcutTitle('');
                  setShortcutUrl('');
                  setEditingShortcutId(null);
                  setIsAddShortcutOpen(true);
                }}
                className={`flex flex-col items-center gap-2 p-2 rounded-2xl transition-all cursor-pointer w-20 text-center group ${
                  hasWallpaper
                    ? 'hover:bg-white/15'
                    : isLightMode
                      ? 'hover:bg-slate-200/70'
                      : 'hover:bg-white/10'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-all ${
                    hasWallpaper
                      ? 'bg-white/15 dark:bg-slate-800/80 backdrop-blur-md border border-white/20 text-white group-hover:bg-white/25'
                      : isLightMode
                        ? 'bg-white border border-slate-200 shadow-sm text-slate-700 group-hover:bg-slate-100'
                        : 'bg-slate-800/80 border border-white/10 text-white group-hover:bg-slate-700/80'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-medium truncate w-full ${
                    hasWallpaper
                      ? 'text-white/95 drop-shadow'
                      : isLightMode
                        ? 'text-slate-800 font-semibold'
                        : 'text-zinc-200'
                  }`}
                >
                  Add shortcut
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer Bar */}
      <div className="flex items-center justify-between px-6 py-4 z-10 shrink-0">
        {/* Wallpaper Artist Attribution */}
        {currentTheme.wallpaperTitle && (
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md border text-xs transition-colors ${
              hasWallpaper
                ? 'bg-black/40 border-white/15 text-white/80 hover:text-white'
                : isLightMode
                  ? 'bg-white/80 border-slate-200 text-slate-700 shadow-xs'
                  : 'bg-black/40 border-white/15 text-white/80'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span className="font-medium">
              {currentTheme.wallpaperTitle} · {currentTheme.wallpaperArtist || 'Walli'}
            </span>
          </div>
        )}

        {/* Customize Chrome Button */}
        <button
          type="button"
          onClick={() => setIsCustomizeOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border text-xs font-semibold shadow-lg transition-all hover:scale-105 cursor-pointer ml-auto ${
            hasWallpaper
              ? 'bg-black/40 hover:bg-black/60 border-white/20 text-white'
              : isLightMode
                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-md'
                : 'bg-black/40 hover:bg-black/60 border-white/20 text-white'
          }`}
        >
          <Pencil className="w-3.5 h-3.5 text-blue-500" />
          <span>Customize Chrome</span>
        </button>
      </div>

      {/* Customize Chrome Side Drawer */}
      {isCustomizeOpen && (
        <div
          className="absolute inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsCustomizeOpen(false)}
        >
          <div
            className={`w-80 sm:w-96 border-l h-full p-6 flex flex-col shadow-2xl relative z-10 select-none overflow-hidden transition-colors ${
              isLightMode
                ? 'bg-white/95 text-slate-800 border-slate-200/80'
                : 'bg-slate-900/95 text-white border-white/15'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className={`flex items-center justify-between pb-4 border-b shrink-0 ${
              isLightMode ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-blue-500" />
                <h2 className={`text-base font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Customize this page</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1 scrollbar-thin">
              {/* Wallpaper Presets */}
              <div className="space-y-3">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Chrome Background Themes
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {WALLPAPER_PRESETS.map((preset) => {
                    const isSelected = currentTheme.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => onSelectTheme && onSelectTheme(preset)}
                        className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-video group shadow-md ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/50 scale-102'
                            : isLightMode
                              ? 'border-slate-200 hover:border-slate-400'
                              : 'border-white/10 hover:border-white/40'
                        }`}
                      >
                        {preset.wallpaperUrl ? (
                          <img
                            src={preset.wallpaperUrl}
                            alt={preset.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : preset.id === 'light-chrome' ? (
                          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-white flex flex-col items-center justify-center p-2 text-center border border-slate-200">
                            <span className="text-xs font-bold text-slate-800">Light Chrome</span>
                            <span className="text-[9px] text-slate-500 font-medium">Clean Light Theme</span>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-xs font-bold text-slate-100">Dark Chrome</span>
                            <span className="text-[9px] text-slate-400 font-medium">Classic Dark Theme</span>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] font-semibold text-white truncate">
                          {preset.name}
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Wallpaper URL Input */}
              <div className={`space-y-2 pt-2 border-t ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                <label className={`text-xs font-semibold flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                  <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                  <span>Custom Image URL</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="https://example.com/wallpaper.jpg"
                    className={`flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 ${
                      isLightMode
                        ? 'bg-slate-100 border-slate-300 text-slate-800 placeholder-slate-400 focus:bg-white'
                        : 'bg-black/40 border-white/15 text-white placeholder-slate-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customImageUrl.trim() && onSelectTheme) {
                        onSelectTheme({
                          id: 'custom-' + Date.now(),
                          name: 'Custom Wallpaper',
                          tabBg: '#0f172a',
                          toolbarBg: '#1e293b',
                          activeTabBg: '#1e293b',
                          wallpaperUrl: customImageUrl.trim(),
                          wallpaperTitle: 'Custom Background',
                          wallpaperArtist: 'Personal Image',
                        });
                        setCustomImageUrl('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Shortcuts Toggle */}
              <div className={`flex items-center justify-between pt-2 border-t ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                <span className={`text-xs font-semibold ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>Show shortcuts on New Tab</span>
                <button
                  type="button"
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    showShortcuts ? 'bg-blue-600' : isLightMode ? 'bg-slate-300' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      showShortcuts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Bottom Done Button Footer */}
            <div className={`pt-4 border-t shrink-0 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Shortcut Modal */}
      {isAddShortcutOpen && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsAddShortcutOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-2xl relative z-10 transition-colors ${
              isLightMode
                ? 'bg-white text-slate-800 border-slate-200'
                : 'bg-slate-900 text-white border-white/15'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Add shortcut</h3>
              <button
                onClick={() => setIsAddShortcutOpen(false)}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isLightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShortcut} className="space-y-4">
              <div className="space-y-1">
                <label className={`text-xs font-medium ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>Name</label>
                <input
                  type="text"
                  value={shortcutTitle}
                  onChange={(e) => setShortcutTitle(e.target.value)}
                  placeholder="e.g. YouTube, GitHub"
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isLightMode
                      ? 'bg-slate-100 border-slate-300 text-slate-800 placeholder-slate-400 focus:bg-white'
                      : 'bg-black/40 border-white/15 text-white placeholder-slate-500'
                  }`}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-medium ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>URL</label>
                <input
                  type="text"
                  value={shortcutUrl}
                  onChange={(e) => setShortcutUrl(e.target.value)}
                  placeholder="https://youtube.com"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddShortcutOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!shortcutTitle.trim() || !shortcutUrl.trim()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
