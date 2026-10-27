import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Home,
  Plus,
  X,
  Star,
  MoreVertical,
  Globe,
  Lock,
  Mic,
  Camera,
  Minus,
  Square,
  Maximize2,
} from 'lucide-react';
import { TabItem, ChromeTheme } from './types';
import { useOS } from '../../../context/OSContext';
import { SnapLayoutMenu } from '../../window/SnapLayoutMenu';
import { haptics } from '../../../utils/haptics';

interface ChromeHeaderProps {
  windowId?: string;
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  inputUrl: string;
  setInputUrl: (url: string) => void;
  onSubmitUrl: (url: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onRefresh: () => void;
  onHome: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  theme: ChromeTheme;
  showBookmarksBar: boolean;
  setShowBookmarksBar: (show: boolean) => void;
  bookmarks: Array<{ title: string; url: string }>;
  onNavigateBookmark: (url: string) => void;
  onOpenVoiceSearch: () => void;
  onOpenGoogleLens?: () => void;
  onReorderTabs?: (sourceId: string, targetId: string) => void;
}

export const ChromeHeader: React.FC<ChromeHeaderProps> = ({
  windowId,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  inputUrl,
  setInputUrl,
  onSubmitUrl,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onRefresh,
  onHome,
  isBookmarked,
  onToggleBookmark,
  theme,
  showBookmarksBar,
  setShowBookmarksBar,
  bookmarks,
  onNavigateBookmark,
  onOpenVoiceSearch,
  onOpenGoogleLens,
  onReorderTabs,
}) => {
  const { windows, minimizeWindow, maximizeWindow, closeWindow, snapWindow, updateWindowPosition, focusWindow, settings } = useOS();
  const isLightMode = settings?.theme === 'light';
  const targetWin = (windowId ? windows.find((w) => w.id === windowId) : null) || windows.find((w) => w.appId === 'browser');
  const actualWindowId = targetWin?.id || windowId || 'browser';
  const isMaximized = targetWin?.isMaximized || false;

  const [showMenu, setShowMenu] = useState(false);
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const snapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Snap Layout hover logic on maximize/restore button with deliberate 250ms hover delay
  const handleSnapMouseEnter = () => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(() => {
      setShowSnapMenu(true);
    }, 250);
  };

  const handleSnapMouseLeave = () => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(() => {
      setShowSnapMenu(false);
    }, 200);
  };

  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  // Handle window dragging from Chrome's top tab strip area
  const handleTabStripMouseDown = (e: React.MouseEvent) => {
    if (isMaximized || e.button !== 0 || !targetWin) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-tab-item="true"]')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: targetWin.position.x,
      posY: targetWin.position.y,
    };
    focusWindow(actualWindowId);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      updateWindowPosition(actualWindowId, {
        x: Math.max(-100, Math.min(window.innerWidth - 100, dragStartRef.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy)),
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onSubmitUrl(inputUrl.trim());
    }
  };

  // Determine if header should render light theme contrast
  const isLightHeader =
    theme.id === 'light-chrome' ||
    (Boolean(theme.toolbarBg) &&
      (theme.toolbarBg === '#ffffff' ||
        theme.toolbarBg === '#f8fafc' ||
        theme.toolbarBg.toLowerCase().startsWith('#f') ||
        theme.toolbarBg.toLowerCase().startsWith('#e')));

  return (
    <div
      className={`flex flex-col select-none border-b shrink-0 relative z-50 overflow-visible transition-colors ${
        isLightHeader ? 'text-slate-800 border-slate-300/80 shadow-xs' : 'text-white border-black/30'
      }`}
      style={{ backgroundColor: isLightHeader && !theme.toolbarBg ? '#ffffff' : theme.toolbarBg }}
    >
      {/* 1. TOP TAB STRIP & INTEGRATED WINDOW CONTROLS WITH SNAP LAYOUTS */}
      <div
        className="flex items-center justify-between px-2 pt-1.5 overflow-visible cursor-default relative z-50 transition-colors"
        style={{ backgroundColor: isLightHeader && !theme.tabBg ? '#e2e8f0' : theme.tabBg }}
        onMouseDown={handleTabStripMouseDown}
        onDoubleClick={() => maximizeWindow(actualWindowId)}
      >
        {/* Left Side: Open Tabs Strip */}
        <div className="flex items-end gap-1 flex-1 min-w-0 pr-2 overflow-hidden">
          {/* List of Open Tabs */}
          <div className="flex items-end gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isDraggingThis = draggedTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  data-tab-item="true"
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('text/plain', tab.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedTabId(tab.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceId = e.dataTransfer.getData('text/plain') || draggedTabId;
                    if (sourceId && sourceId !== tab.id && onReorderTabs) {
                      onReorderTabs(sourceId, tab.id);
                    }
                    setDraggedTabId(null);
                  }}
                  onDragEnd={() => setDraggedTabId(null)}
                  onClick={() => onSelectTab(tab.id)}
                  className={`group relative flex items-center gap-2 px-3 h-[34px] rounded-t-[8px] text-xs max-w-[210px] min-w-[90px] sm:min-w-[130px] transition-all cursor-pointer select-none shrink-0 ${
                    isDraggingThis ? 'opacity-40 scale-95' : ''
                  } ${
                    isActive
                      ? isLightHeader
                        ? 'text-slate-900 font-semibold z-10 -mb-px shadow-xs'
                        : 'text-white font-medium z-10 -mb-px'
                      : isLightHeader
                        ? 'text-slate-600 hover:bg-black/5 hover:text-slate-900 rounded-[6px] mb-0.5'
                        : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 rounded-[6px] mb-0.5'
                  }`}
                  style={{
                    backgroundColor: isActive ? (isLightHeader && !theme.toolbarBg ? '#ffffff' : theme.toolbarBg) : 'transparent',
                  }}
                >
                  {/* Left & Right Inverted Fillet Wings for Active Tab */}
                  {isActive && (
                    <>
                      <svg
                        className="absolute -left-2 bottom-0 w-2 h-2 pointer-events-none"
                        viewBox="0 0 8 8"
                        fill="none"
                        style={{ color: isLightHeader && !theme.toolbarBg ? '#ffffff' : theme.toolbarBg }}
                      >
                        <path d="M0 8h8V0C8 4.418 4.418 8 0 8z" fill="currentColor" />
                      </svg>
                      <svg
                        className="absolute -right-2 bottom-0 w-2 h-2 pointer-events-none"
                        viewBox="0 0 8 8"
                        fill="none"
                        style={{ color: isLightHeader && !theme.toolbarBg ? '#ffffff' : theme.toolbarBg }}
                      >
                        <path d="M8 8H0V0C0 4.418 3.582 8 8 8z" fill="currentColor" />
                      </svg>
                    </>
                  )}

                  {/* Favicon */}
                  {tab.url === 'chrome://newtab' || tab.url.includes('google.com') ? (
                    <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center font-bold text-[10px] text-blue-600 shrink-0 shadow-xs">
                      G
                    </span>
                  ) : (
                    <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                  )}

                  {/* Tab Title */}
                  <span className="truncate flex-1 text-xs font-normal select-none">{tab.title || 'New Tab'}</span>

                  {/* Close Tab 'x' */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1 ${
                      isLightHeader
                        ? 'hover:bg-black/10 text-slate-400 hover:text-slate-700'
                        : 'hover:bg-white/10 text-zinc-400 hover:text-white'
                    }`}
                    title="Close tab"
                  >
                    <X className="w-3 h-3 stroke-[2]" />
                  </button>
                </div>
              );
            })}

            {/* '+' New Tab Button */}
            <button
              onClick={onNewTab}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-0.5 mb-1 ${
                isLightHeader
                  ? 'hover:bg-black/10 text-slate-500 hover:text-slate-900'
                  : 'hover:bg-white/10 text-zinc-400 hover:text-white'
              }`}
              title="New tab"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
            </button>
          </div>
        </div>

        {/* Right Side: Windows 11 Title Bar Controls with Snap Layouts */}
        <div className="flex items-center gap-0.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {/* Minimize Window Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              haptics.light();
              minimizeWindow(actualWindowId);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              haptics.light();
              minimizeWindow(actualWindowId);
            }}
            className={`flex items-center justify-center w-8 sm:w-9 h-7 rounded cursor-pointer transition-colors ${
              isLightHeader ? 'hover:bg-black/10 text-slate-700 hover:text-slate-900' : 'hover:bg-white/15 text-slate-200 hover:text-white'
            }`}
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {/* Maximize / Restore Window Button with Snap Layout Flyout Menu */}
          <div
            className="relative flex items-center z-[100]"
            onMouseEnter={handleSnapMouseEnter}
            onMouseLeave={handleSnapMouseLeave}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                haptics.light();
                maximizeWindow(actualWindowId);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                haptics.light();
                maximizeWindow(actualWindowId);
              }}
              className={`flex items-center justify-center w-8 sm:w-9 h-7 rounded cursor-pointer transition-colors ${
                isLightHeader ? 'hover:bg-black/10 text-slate-700 hover:text-slate-900' : 'hover:bg-white/15 text-slate-200 hover:text-white'
              }`}
              title={showSnapMenu ? undefined : isMaximized ? 'Restore Down' : 'Maximize'}
            >
              {isMaximized ? <Square className="w-3 h-3 stroke-[2.5]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>

            {/* Windows 11 Snap Layout Menu */}
            {showSnapMenu && (
              <SnapLayoutMenu
                onSnap={(layout) => {
                  haptics.medium();
                  snapWindow(actualWindowId, layout);
                  setShowSnapMenu(false);
                }}
                onClose={() => setShowSnapMenu(false)}
              />
            )}
          </div>

          {/* Close Window Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              haptics.medium();
              closeWindow(actualWindowId);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              haptics.medium();
              closeWindow(actualWindowId);
            }}
            className={`flex items-center justify-center w-8 sm:w-10 h-7 rounded cursor-pointer transition-colors hover:bg-red-600 hover:text-white ${
              isLightHeader ? 'text-slate-700' : 'text-slate-200'
            }`}
            title="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. CHROME NAVIGATION & OMNIBOX BAR */}
      <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 text-xs">
        {/* Navigation Arrows */}
        <div className={`flex items-center gap-0.5 sm:gap-1 shrink-0 ${isLightHeader ? 'text-slate-700' : 'text-white/80'}`}>
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`p-1 sm:p-1.5 rounded-full transition-colors cursor-pointer ${
              isLightHeader ? 'hover:bg-black/10 disabled:opacity-30 disabled:hover:bg-transparent' : 'hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent'
            }`}
            title="Click to go back"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className={`hidden sm:inline-flex p-1.5 rounded-full transition-colors cursor-pointer ${
              isLightHeader ? 'hover:bg-black/10 disabled:opacity-30 disabled:hover:bg-transparent' : 'hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent'
            }`}
            title="Click to go forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onRefresh}
            className={`p-1 sm:p-1.5 rounded-full transition-colors cursor-pointer ${
              isLightHeader ? 'hover:bg-black/10' : 'hover:bg-white/10'
            }`}
            title="Reload this page"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={onHome}
            className={`hidden md:inline-flex p-1.5 rounded-full transition-colors cursor-pointer ${
              isLightHeader ? 'hover:bg-black/10' : 'hover:bg-white/10'
            }`}
            title="Open the home page"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Omnibox / URL Address Bar */}
        <div className="flex-1 min-w-0 relative">
          <form onSubmit={handleSubmit} className="w-full flex items-center">
            <div className={`w-full flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full transition-all text-xs ${
              isLightHeader
                ? 'bg-slate-100/90 border border-slate-300/80 hover:border-slate-400 focus-within:border-blue-500 focus-within:bg-white shadow-xs text-slate-800'
                : 'bg-black/30 hover:bg-black/40 focus-within:bg-black/50 border border-white/10 focus-within:border-white/30 text-white'
            }`}>
              {/* Google Logo / Lock Icon */}
              {inputUrl.startsWith('https://') ? (
                <Lock className={`w-3.5 h-3.5 shrink-0 ${isLightHeader ? 'text-emerald-600' : 'text-emerald-400'}`} />
              ) : (
                <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${isLightHeader ? 'bg-blue-100 text-blue-600' : 'bg-white/20 text-white'}`}>
                  G
                </span>
              )}

              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Search Google or type a URL..."
                className={`w-full bg-transparent text-xs focus:outline-none font-sans ${
                  isLightHeader ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-white/50'
                }`}
              />

              {/* Mic voice search in Omnibox */}
              <button
                type="button"
                onClick={onOpenVoiceSearch}
                className={`p-1 cursor-pointer transition-colors ${
                  isLightHeader ? 'text-slate-600 hover:text-slate-800' : 'text-white/70 hover:text-white'
                }`}
                title="Search by voice"
              >
                <Mic className="w-3.5 h-3.5 text-blue-500" />
              </button>

              {/* Google Lens in Omnibox */}
              {onOpenGoogleLens && (
                <button
                  type="button"
                  onClick={onOpenGoogleLens}
                  className={`hidden sm:inline-flex p-1 cursor-pointer transition-colors ${
                    isLightHeader ? 'text-slate-600 hover:text-slate-800' : 'text-white/70 hover:text-white'
                  }`}
                  title="Search by image (Google Lens)"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-500" />
                </button>
              )}

              {/* Bookmark Star button */}
              <button
                type="button"
                onClick={onToggleBookmark}
                className={`hidden xs:inline-flex p-1 hover:text-yellow-400 cursor-pointer transition-colors ${
                  isBookmarked
                    ? 'text-yellow-400 fill-yellow-400'
                    : isLightHeader
                      ? 'text-slate-400'
                      : 'text-white/60'
                }`}
                title={isBookmarked ? 'Bookmark added' : 'Bookmark this tab'}
              >
                <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-yellow-400' : ''}`} />
              </button>
            </div>
          </form>
        </div>

        {/* Right Side Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Chrome 3-Dots Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isLightHeader ? 'hover:bg-black/10 text-slate-600 hover:text-slate-800' : 'hover:bg-white/10 text-white/80 hover:text-white'
              }`}
              title="Customize and control Google Chrome"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className={`absolute right-0 top-9 w-60 p-2 rounded-2xl border backdrop-blur-xl shadow-2xl z-50 animate-in fade-in text-xs space-y-1 ${
                    isLightHeader
                      ? 'bg-white border-slate-200 text-slate-800'
                      : 'bg-slate-900 border border-white/15 text-slate-200'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                <button
                  onClick={onNewTab}
                  className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left cursor-pointer ${
                    isLightHeader ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <span>New tab</span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+T</span>
                </button>

                <button
                  onClick={() => setShowBookmarksBar(!showBookmarksBar)}
                  className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left cursor-pointer ${
                    isLightHeader ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <span>Show Bookmarks Bar</span>
                  <span className="text-[10px] opacity-60 font-mono">{showBookmarksBar ? '✓' : ''}</span>
                </button>

                <button
                  onClick={() => onRefresh()}
                  className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left cursor-pointer ${
                    isLightHeader ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <span>Reload</span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+R</span>
                </button>

                <div className={`h-px my-1 ${isLightHeader ? 'bg-slate-200' : 'bg-white/10'}`} />

                <button
                  onClick={() => onHome()}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-2 text-left cursor-pointer ${
                    isLightHeader ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 text-blue-500" />
                  <span>Google Chrome Home</span>
                </button>
              </div>
            </>
            )}
          </div>
        </div>
      </div>

      {/* 3. BOOKMARKS BAR */}
      {showBookmarksBar && (
        <div className={`flex items-center gap-2 px-3 py-1 text-[11px] overflow-x-auto border-t scrollbar-none ${
          isLightHeader ? 'bg-slate-100/90 border-slate-200 text-slate-700' : 'bg-black/40 border-white/10 text-white/90'
        }`}>
          {bookmarks.map((bm, i) => (
            <button
              key={i}
              onClick={() => onNavigateBookmark(bm.url)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors shrink-0 cursor-pointer ${
                isLightHeader ? 'hover:bg-slate-200 text-slate-700 hover:text-slate-900' : 'hover:bg-white/15 text-white/90 hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate max-w-[120px]">{bm.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
