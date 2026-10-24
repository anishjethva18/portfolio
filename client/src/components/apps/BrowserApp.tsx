import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { ChromeHeader } from './browser/ChromeHeader';
import { ChromeNewTab, WALLPAPER_PRESETS,  } from './browser/ChromeNewTab';
import { VoiceSearchModal } from './browser/VoiceSearchModal';
import { GoogleSearchResultsView } from './browser/GoogleSearchResultsView';
import { GoogleLensModal } from './browser/GoogleLensModal';
import { WikipediaView } from './browser/WikipediaView';
import { DevCommunityView } from './browser/DevCommunityView';
import { YouTubeBrowserView } from './browser/YouTubeBrowserView';
import { WebContentView } from './browser/WebContentView';
import { TabItem, ShortcutItem, ChromeTheme } from './browser/types';
import {
  ExternalLink,
  Github,
  Star,
} from 'lucide-react';

interface BrowserAppProps {
  initialUrl?: string;
  windowId?: string;
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: 'sc-1', title: 'YouTube', url: 'https://youtube.com' },
  { id: 'sc-2', title: 'GitHub', url: 'https://github.com/anishjethva18' },
  // { id: 'sc-3', title: 'LinkedIn', url: 'https://www.linkedin.com/in/anishjethva/' },
  { id: 'sc-4', title: 'Portfolio', url: 'https://anishjethva.dev' },
  { id: 'sc-5', title: 'Wikipedia', url: 'https://wikipedia.org' },
  { id: 'sc-6', title: 'DEV Community', url: 'https://dev.to' },
];

export const BrowserApp: React.FC<BrowserAppProps> = ({ initialUrl, windowId }) => {
  const { openApp, settings, closeWindow, windows, endProcess } = useOS();
  const isLightMode = settings?.theme === 'light';

  const targetWin = (windowId ? windows.find((w) => w.id === windowId) : null) || windows.find((w) => w.appId === 'browser');
  const actualWindowId = targetWin?.id || windowId || 'browser';

  // Active browser theme
  const [currentTheme, setCurrentTheme] = useState<ChromeTheme>(() => {
    try {
      const saved = localStorage.getItem('win11_chrome_theme');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return WALLPAPER_PRESETS[2]; // Default wallpaper: Nordic Architecture
  });

  // Automatically adapt default theme when OS light/dark mode changes
  useEffect(() => {
    try {
      const isUserCustomized = localStorage.getItem('win11_chrome_theme_customized');
      if (!isUserCustomized) {
        setCurrentTheme(WALLPAPER_PRESETS[2]);
      }
    } catch {}
  }, [isLightMode]);

  const activeTheme = React.useMemo(() => {
    return currentTheme;
  }, [currentTheme]);

  const handleSelectTheme = (theme: ChromeTheme) => {
    setCurrentTheme(theme);
    try {
      localStorage.setItem('win11_chrome_theme', JSON.stringify(theme));
      localStorage.setItem('win11_chrome_theme_customized', 'true');
    } catch {}
  };

  // Modal for Voice Search and Google Lens
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isLensOpen, setIsLensOpen] = useState(false);

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>(() => {
    try {
      const saved = localStorage.getItem('win11_chrome_shortcuts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SHORTCUTS;
  });

  const handleAddShortcut = (item: Omit<ShortcutItem, 'id'>) => {
    const newItem: ShortcutItem = { ...item, id: `sc-${Date.now()}` };
    const updated = [...shortcuts, newItem];
    setShortcuts(updated);
    try {
      localStorage.setItem('win11_chrome_shortcuts', JSON.stringify(updated));
    } catch {}
  };

  const handleRemoveShortcut = (id: string) => {
    const updated = shortcuts.filter((s) => s.id !== id);
    setShortcuts(updated);
    try {
      localStorage.setItem('win11_chrome_shortcuts', JSON.stringify(updated));
    } catch {}
  };

  // Tabs state
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: 'tab-1',
      title: initialUrl ? 'Web Page' : 'New Tab',
      url: initialUrl || 'chrome://newtab',
      history: [initialUrl || 'chrome://newtab'],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [inputUrl, setInputUrl] = useState<string>(initialUrl || '');
  const [showBookmarksBar, setShowBookmarksBar] = useState(true);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Array<{ title: string; url: string }>>([
    { title: 'YouTube', url: 'https://youtube.com' },
    { title: 'Portfolio OS', url: 'https://anishjethva.dev' },
    { title: 'GitHub', url: 'https://github.com/anishjethva18' },
    { title: 'Wikipedia', url: 'https://wikipedia.org' },
    { title: 'Dev.to', url: 'https://dev.to' },
  ]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Helper to format tab title
  const getTabTitle = (url: string): string => {
    if (url === 'chrome://newtab') return 'New Tab';
    if (url.includes('google.com/search')) {
      const q = new URLSearchParams(url.split('?')[1] || '').get('q') || 'Search';
      return `${q} - Google Search`;
    }
    if (url === 'https://google.com') return 'Google';
    if (url.includes('youtube.com')) return 'YouTube';
    if (url.includes('wikipedia.org')) return 'Wikipedia, the free encyclopedia';
    if (url.includes('dev.to')) return 'DEV Community — Tech News';
    if (url.includes('anishjethva.dev') || url.includes('alexrivera.dev')) return 'Anish Jethva — Full Stack & AI Portfolio';
    if (url.includes('linkedin.com')) return 'Anish Jethva | LinkedIn';
    if (url.includes('github.com')) return 'GitHub · Anish Jethva';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  const navigateTo = (rawUrl: string) => {
    let cleanUrl = rawUrl.trim();
    if (!cleanUrl) return;

    if (cleanUrl === 'chrome://newtab') {
      // Return to new tab
    } else if (
      !cleanUrl.startsWith('http://') &&
      !cleanUrl.startsWith('https://') &&
      !cleanUrl.includes('.')
    ) {
      cleanUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanUrl)}`;
    } else if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('chrome://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const title = getTabTitle(cleanUrl);
    setInputUrl(cleanUrl === 'chrome://newtab' ? '' : cleanUrl);

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          const newHistory = t.history.slice(0, t.historyIndex + 1);
          newHistory.push(cleanUrl);
          return {
            ...t,
            url: cleanUrl,
            title,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
        }
        return t;
      })
    );
  };

  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: TabItem = {
      id: newId,
      title: 'New Tab',
      url: 'chrome://newtab',
      history: ['chrome://newtab'],
      historyIndex: 0,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setInputUrl('');
  };

  const handleReorderTabs = (sourceId: string, targetId: string) => {
    setTabs((prev) => {
      const sourceIdx = prev.findIndex((t) => t.id === sourceId);
      const targetIdx = prev.findIndex((t) => t.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(sourceIdx, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length === 1) {
      if (windowId) {
        closeWindow(windowId);
      } else if (actualWindowId) {
        closeWindow(actualWindowId);
      } else {
        endProcess('browser');
      }
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      const nextTab = newTabs[Math.max(0, idx - 1)];
      setActiveTabId(nextTab.id);
      setInputUrl(nextTab.url === 'chrome://newtab' ? '' : nextTab.url);
    }
  };

  const handleGoBack = () => {
    if (activeTab && activeTab.historyIndex > 0) {
      const newIndex = activeTab.historyIndex - 1;
      const targetUrl = activeTab.history[newIndex];
      setInputUrl(targetUrl === 'chrome://newtab' ? '' : targetUrl);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, url: targetUrl, title: getTabTitle(targetUrl), historyIndex: newIndex }
            : t
        )
      );
    }
  };

  const handleGoForward = () => {
    if (activeTab && activeTab.historyIndex < activeTab.history.length - 1) {
      const newIndex = activeTab.historyIndex + 1;
      const targetUrl = activeTab.history[newIndex];
      setInputUrl(targetUrl === 'chrome://newtab' ? '' : targetUrl);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, url: targetUrl, title: getTabTitle(targetUrl), historyIndex: newIndex }
            : t
        )
      );
    }
  };

  const handleToggleBookmark = () => {
    const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);
    if (isBookmarked) {
      setBookmarks((b) => b.filter((item) => item.url !== activeTab.url));
    } else {
      setBookmarks((b) => [...b, { title: activeTab.title, url: activeTab.url }]);
    }
  };

  // Sync inputUrl with active tab
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url === 'chrome://newtab' ? '' : activeTab.url);
    }
  }, [activeTabId]);

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden font-sans select-text ${isLightMode ? 'bg-slate-100' : 'bg-slate-900'}`}>
      {/* Chrome Header with Tabs & Omnibox */}
      <ChromeHeader
        windowId={windowId}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={(id) => {
          setActiveTabId(id);
          const t = tabs.find((x) => x.id === id);
          if (t) setInputUrl(t.url === 'chrome://newtab' ? '' : t.url);
        }}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        inputUrl={inputUrl}
        setInputUrl={setInputUrl}
        onSubmitUrl={navigateTo}
        canGoBack={activeTab ? activeTab.historyIndex > 0 : false}
        canGoForward={activeTab ? activeTab.historyIndex < activeTab.history.length - 1 : false}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onRefresh={() => navigateTo(activeTab.url)}
        onHome={() => navigateTo('chrome://newtab')}
        isBookmarked={bookmarks.some((b) => b.url === activeTab.url)}
        onToggleBookmark={handleToggleBookmark}
        theme={activeTheme}
        showBookmarksBar={showBookmarksBar}
        setShowBookmarksBar={setShowBookmarksBar}
        bookmarks={bookmarks}
        onNavigateBookmark={navigateTo}
        onOpenVoiceSearch={() => setIsVoiceOpen(true)}
        onOpenGoogleLens={() => setIsLensOpen(true)}
        onReorderTabs={handleReorderTabs}
      />

      {/* Main Web Viewport */}
      <div className="flex-1 relative overflow-hidden bg-white dark:bg-slate-950">
        {activeTab.url === 'chrome://newtab' ? (
          <ChromeNewTab
            onNavigate={navigateTo}
            shortcuts={shortcuts}
            onAddShortcut={handleAddShortcut}
            onRemoveShortcut={handleRemoveShortcut}
            currentTheme={activeTheme}
            onSelectTheme={handleSelectTheme}
            onOpenVoiceSearch={() => setIsVoiceOpen(true)}
            onOpenGoogleLens={() => setIsLensOpen(true)}
            isLightMode={isLightMode}
          />

        ) : activeTab.url.includes('google.com/search') ? (
          <GoogleSearchResultsView
            query={
              new URLSearchParams(activeTab.url.split('?')[1] || '').get('q') || ''
            }
            onNavigate={navigateTo}
            onSearch={(q) => navigateTo(`https://www.google.com/search?q=${encodeURIComponent(q)}`)}
            onOpenVoiceSearch={() => setIsVoiceOpen(true)}
            onOpenGoogleLens={() => setIsLensOpen(true)}
          />
        ) : activeTab.url.includes('youtube.com') ? (
          <YouTubeBrowserView
            initialSearch={
              activeTab.url.includes('search_query=')
                ? new URLSearchParams(activeTab.url.split('?')[1] || '').get('search_query') || ''
                : ''
            }
            onNavigateUrl={navigateTo}
          />
        ) : activeTab.url.includes('wikipedia.org') ? (
          <WikipediaView
            initialArticle={
              activeTab.url.includes('/wiki/')
                ? decodeURIComponent(activeTab.url.split('/wiki/')[1] || '').replace(/_/g, ' ')
                : 'windows 11'
            }
            onNavigateUrl={navigateTo}
          />
        ) : activeTab.url.includes('dev.to') ? (
          <DevCommunityView onNavigateUrl={navigateTo} />
        ) : (
          // Smart Live Web View with Fallback & SSL Controls
          <WebContentView
            url={activeTab.url}
            title={activeTab.title}
            onNavigate={(url) => navigateTo(url)}
          />
        )}
      </div>

      {/* Google Voice Search Modal */}
      <VoiceSearchModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onTranscriptComplete={(q) => navigateTo(q)}
      />

      {/* Google Lens Modal */}
      <GoogleLensModal
        isOpen={isLensOpen}
        onClose={() => setIsLensOpen(false)}
        onSearchQuery={(q) => navigateTo(q)}
      />
    </div>
  );
};
