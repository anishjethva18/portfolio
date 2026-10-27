import React, { useState, useMemo } from 'react';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { APPS_LIST, PROJECTS_DATA } from '../../data/portfolioData';
import { AppIcon } from '../common/AppIcon';
import { AppId, FileItem } from '../../types';
import { isMediaFile } from '../../utils/fileAssociations';
import { usePublishedProfile } from '../../hooks/usePublishedProfile';
import {
  Search,
  Power,
  Settings,
  FileText,
  Lock,
  Moon,
  RotateCcw,
  ShieldAlert,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Pin,
  PinOff,
  Sliders,
  Folder,
  FileCode,
  Archive,
  Image as ImageIcon,
} from 'lucide-react';
import { useLongPress } from '../../utils/useLongPress';

interface SettingTopic {
  title: string;
  tab: 'home' | 'personalization' | 'taskbar' | 'system' | 'apps' | 'about';
  desc: string;
}

const SETTINGS_SEARCH_INDEX: SettingTopic[] = [
  { title: 'Personalization & Wallpapers', tab: 'personalization', desc: 'Change background wallpaper, accent colors, and desktop themes' },
  { title: 'Dark Mode & Light Theme', tab: 'personalization', desc: 'Toggle dark mode or light OS theme' },
  { title: 'Taskbar Alignment & Behaviors', tab: 'taskbar', desc: 'Center or left align taskbar, auto-hide taskbar' },
  { title: 'Taskbar System Icons & Location', tab: 'taskbar', desc: 'Toggle Wi-Fi, Sound, Battery, and Live Weather Location' },
  { title: 'Sound & Volume Settings', tab: 'system', desc: 'Adjust system volume and audio sound effects' },
  { title: 'Display & Brightness', tab: 'system', desc: 'Adjust screen brightness and display scaling' },
  { title: 'Storage & SSD Drives', tab: 'system', desc: 'Inspect NVMe SSD storage distribution (C: and D: drives)' },
  { title: 'Installed Applications', tab: 'apps', desc: 'View installed apps, defaults, and process metrics' },
  { title: 'About This PC & System Specs', tab: 'about', desc: 'Processor, RAM, device specifications, and OS version' },
];

const StartMenuPinnedItem: React.FC<{
  app: any;
  onOpen: (id: AppId) => void;
  onClose: () => void;
  onContextMenu: (e: any, appId: AppId, coords?: { x: number; y: number }) => void;
}> = ({ app, onOpen, onClose, onContextMenu }) => {
  const longPress = useLongPress(
    (e, coords) => {
      onContextMenu(e, app.id, coords);
    },
    { threshold: 380, hapticFeedback: true }
  );

  return (
    <button
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({ type: 'desktop_icon', id: app.id, appId: app.id, name: app.name })
        );
      }}
      className="group relative flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer select-none"
      onClick={(e) => {
        if (longPress.didTriggerLongPress()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (typeof window !== 'undefined' && (window as any).__lastLongPressTime && Date.now() - (window as any).__lastLongPressTime < 600) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onOpen(app.id);
        onClose();
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onContextMenu={(e) => onContextMenu(e, app.id)}
      title={`${app.name} - Right-click or long-press for options`}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
        <AppIcon appId={app.id} name={app.icon} className="w-6 h-6" />
      </div>
      <span className="mt-1.5 text-[11px] text-center font-medium text-slate-700 dark:text-slate-200 line-clamp-1 w-full">
        {app.name}
      </span>
    </button>
  );
};

const StartMenuAllAppRow: React.FC<{
  app: any;
  isPinned: boolean;
  onOpen: (id: AppId) => void;
  onClose: () => void;
  onTogglePin: (appId: AppId, e: React.MouseEvent) => void;
  onContextMenu: (e: any, appId: AppId, coords?: { x: number; y: number }) => void;
}> = ({ app, isPinned, onOpen, onClose, onTogglePin, onContextMenu }) => {
  const longPress = useLongPress(
    (e, coords) => {
      onContextMenu(e, app.id, coords);
    },
    { threshold: 380, hapticFeedback: true }
  );

  return (
    <div
      className="group flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer select-none"
      onClick={(e) => {
        if (longPress.didTriggerLongPress()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (typeof window !== 'undefined' && (window as any).__lastLongPressTime && Date.now() - (window as any).__lastLongPressTime < 600) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onOpen(app.id);
        onClose();
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onContextMenu={(e) => onContextMenu(e, app.id)}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
          <AppIcon appId={app.id} name={app.icon} className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
            {app.name}
          </p>
          <p className="text-[10px] text-slate-400">{app.category}</p>
        </div>
      </div>

      {/* Quick Pin / Unpin Button */}
      <button
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-all cursor-pointer"
        onClick={(e) => onTogglePin(app.id, e)}
        title={isPinned ? 'Unpin from Start' : 'Pin to Start'}
      >
        {isPinned ? <PinOff className="w-3.5 h-3.5 text-blue-500" /> : <Pin className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

const StartMenuSearchAppRow: React.FC<{
  app: any;
  onOpen: (id: AppId) => void;
  onClose: () => void;
  onContextMenu: (e: any, appId: AppId, coords?: { x: number; y: number }) => void;
}> = ({ app, onOpen, onClose, onContextMenu }) => {
  const longPress = useLongPress(
    (e, coords) => {
      onContextMenu(e, app.id, coords);
    },
    { threshold: 380, hapticFeedback: true }
  );

  return (
    <button
      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-left select-none"
      onClick={(e) => {
        if (longPress.didTriggerLongPress()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (typeof window !== 'undefined' && (window as any).__lastLongPressTime && Date.now() - (window as any).__lastLongPressTime < 600) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onOpen(app.id);
        onClose();
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onContextMenu={(e) => onContextMenu(e, app.id)}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
          <AppIcon name={app.icon} className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {app.name}
          </p>
          <p className="text-[10px] text-slate-400">{app.category} App</p>
        </div>
      </div>
      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
        App
      </span>
    </button>
  );
};

export const StartMenu: React.FC = () => {
  const {
    openApp,
    closeStart,
    showContextMenu,
    triggerBsod,
    toggleMatrixMode,
    settings,
    startPinnedAppIds,
    pinToStart,
    unpinFromStart,
    isPinnedToStart,
    files,
    setPowerState,
    triggerLoading,
    apps = [],
  } = useOS();
  const { lockScreen } = useAuth();
  const { profile: currentUser } = usePublishedProfile();

  const [searchTerm, setSearchTerm] = useState('');
  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'pinned' | 'allApps'>('pinned');
  const [searchCategory, setSearchCategory] = useState<'all' | 'apps' | 'docs' | 'settings' | 'projects'>('all');

  // Pinned apps from OSContext
  const pinnedApps = useMemo(() => {
    return startPinnedAppIds
      .map((id) => apps.find((a) => a.id === id))
      .filter(Boolean) as typeof APPS_LIST;
  }, [startPinnedAppIds, apps]);

  // Alphabetically sorted apps for "All apps" view
  const alphabetizedApps = useMemo(() => {
    const sorted = [...apps].sort((a, b) => a.name.localeCompare(b.name));
    const grouped: Record<string, typeof APPS_LIST> = {};
    sorted.forEach((app) => {
      const letter = app.name[0].toUpperCase();
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(app);
    });
    return grouped;
  }, [apps]);

  // Search filtering
  const query = searchTerm.trim().toLowerCase();
  const isExtensionSearch = query.startsWith('.') || ['docx', 'pdf', 'txt', 'md', 'json', 'csv', 'zip', 'png', 'lnk'].includes(query);

  const matchedApps = useMemo(() => {
    if (!query) return [];
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
    );
  }, [query, apps]);

  const matchedFiles = useMemo(() => {
    if (!query) return [];
    const cleanExt = query.startsWith('.') ? query.slice(1) : query;
    return files.filter((f) => {
      if (f.type === 'folder') {
        return f.name.toLowerCase().includes(query);
      }
      // Check file name, extension, or full path
      const ext = f.extension?.toLowerCase();
      const matchesExt = ext === cleanExt || ext === query;
      const matchesName = f.name.toLowerCase().includes(query);
      const matchesPath = f.path.toLowerCase().includes(query);
      return matchesName || matchesExt || matchesPath;
    });
  }, [query, files]);

  const matchedProjects = useMemo(() => {
    if (!query) return [];
    return PROJECTS_DATA.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.tagline.toLowerCase().includes(query) ||
        p.technologies.some((t) => t.toLowerCase().includes(query))
    );
  }, [query]);

  const matchedSettings = useMemo(() => {
    if (!query) return [];
    return SETTINGS_SEARCH_INDEX.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.desc.toLowerCase().includes(query) ||
        s.tab.toLowerCase().includes(query)
    );
  }, [query]);

  const totalResultsCount =
    (searchCategory === 'all' || searchCategory === 'apps' ? matchedApps.length : 0) +
    (searchCategory === 'all' || searchCategory === 'docs' ? matchedFiles.length : 0) +
    (searchCategory === 'all' || searchCategory === 'projects' ? matchedProjects.length : 0) +
    (searchCategory === 'all' || searchCategory === 'settings' ? matchedSettings.length : 0);

  const handleAppRightClick = (
    e: React.MouseEvent | React.TouchEvent,
    appId: AppId,
    coords?: { x: number; y: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const x =
      coords?.x ??
      ('touches' in e && e.touches[0]
        ? e.touches[0].clientX
        : 'clientX' in e
        ? (e as React.MouseEvent).clientX
        : 40);
    const y =
      coords?.y ??
      ('touches' in e && e.touches[0]
        ? e.touches[0].clientY
        : 'clientY' in e
        ? (e as React.MouseEvent).clientY
        : 100);
    showContextMenu({
      type: 'start-app',
      x,
      y,
      appId,
    });
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') return <Folder className="w-4 h-4 text-amber-500" />;
    const ext = file.extension?.toLowerCase();
    if (ext === 'pdf' || ext === 'docx' || ext === 'txt' || ext === 'md') {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    if (ext === 'json' || ext === 'csv' || ext === 'bin') {
      return <FileCode className="w-4 h-4 text-emerald-500" />;
    }
    if (ext === 'png' || ext === 'jpg') {
      return <ImageIcon className="w-4 h-4 text-purple-500" />;
    }
    if (ext === 'zip') {
      return <Archive className="w-4 h-4 text-amber-600" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-transparent z-[998]"
        onClick={closeStart}
      />
      <div
        id="start-menu-container"
      data-start-menu="true"
      className={`fixed inset-x-0 top-0 bottom-12 w-full h-[calc(100dvh-48px)] max-w-none max-h-none rounded-none pt-9 sm:pt-5 pb-3 sm:pb-5 sm:inset-auto sm:bottom-14 sm:w-[580px] sm:max-w-[95vw] sm:h-[580px] sm:max-h-[85vh] sm:rounded-2xl z-[999] flex flex-col border border-white/20 dark:border-white/10 shadow-2xl px-4 sm:px-5 select-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${
        settings.transparency
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl'
          : 'bg-white dark:bg-slate-900'
      } ${
        settings.taskbarAlignment === 'center'
          ? 'sm:left-1/2 sm:-translate-x-1/2'
          : 'sm:left-4'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Search Input */}
      <div className="relative mb-3.5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id="start-menu-search-input"
          type="text"
          value={searchTerm || ''}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search apps, files, .docx, settings, projects..."
          className="w-full pl-10 pr-8 h-12 sm:h-auto sm:py-2.5 text-base sm:text-xs rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          autoFocus
        />
        {searchTerm && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
            onClick={() => setSearchTerm('')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Start Menu Body: 3 Modes (Search Mode, Pinned Mode, All Apps Mode) */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* ================= 1. SEARCH RESULTS VIEW ================= */}
        {searchTerm ? (
          <div className="space-y-3">
            {/* Search Category Filter Tabs */}
            <div className="flex items-center gap-1 pb-2 border-b border-slate-200/60 dark:border-white/10 text-[11px] overflow-x-auto">
              {(
                [
                  { id: 'all', label: `All (${totalResultsCount})` },
                  { id: 'apps', label: `Apps (${matchedApps.length})` },
                  { id: 'docs', label: `Docs & Files (${matchedFiles.length})` },
                  { id: 'settings', label: `Settings (${matchedSettings.length})` },
                  { id: 'projects', label: `Projects (${matchedProjects.length})` },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    searchCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setSearchCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {totalResultsCount === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No matches found for "{searchTerm}"
                </p>
                <p className="text-[11px] text-slate-400">
                  Try searching for apps ("Terminal", "Projects"), extensions (".docx", ".pdf"), or settings ("Theme", "Taskbar").
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Apps Match */}
                {(searchCategory === 'all' || searchCategory === 'apps') && matchedApps.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                      Applications ({matchedApps.length})
                    </div>
                    <div className="space-y-1">
                      {matchedApps.map((app) => (
                        <StartMenuSearchAppRow
                          key={app.id}
                          app={app}
                          onOpen={openApp}
                          onClose={closeStart}
                          onContextMenu={handleAppRightClick}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents & Files Match (including .docx, .pdf, .txt, etc.) */}
                {(searchCategory === 'all' || searchCategory === 'docs') && matchedFiles.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                      Documents & Files ({matchedFiles.length})
                    </div>
                    <div className="space-y-1">
                      {matchedFiles.map((file) => (
                        <button
                          key={file.id}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-left"
                          onClick={() => {
                            if (file.type === 'folder') {
                              openApp('explorer', { path: file.path });
                            } else if (file.extension === 'pdf') {
                              openApp('resume');
                            } else if (isMediaFile(file.extension || file.name)) {
                              openApp('photos', { filePath: file.path });
                            } else {
                              openApp('notepad', { filePath: file.path });
                            }
                            closeStart();
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                              {getFileIcon(file)}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{file.path}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md uppercase shrink-0">
                            {file.extension || 'Folder'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settings Match */}
                {(searchCategory === 'all' || searchCategory === 'settings') && matchedSettings.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                      Settings ({matchedSettings.length})
                    </div>
                    <div className="space-y-1">
                      {matchedSettings.map((s, idx) => (
                        <button
                          key={idx}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-left"
                          onClick={() => {
                            openApp('settings', { tab: s.tab });
                            closeStart();
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                              <Sliders className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {s.title}
                              </p>
                              <p className="text-[10px] text-slate-400">{s.desc}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            Setting
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects Match */}
                {(searchCategory === 'all' || searchCategory === 'projects') && matchedProjects.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                      Projects ({matchedProjects.length})
                    </div>
                    <div className="space-y-1">
                      {matchedProjects.map((p) => (
                        <button
                          key={p.id}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-left"
                          onClick={() => {
                            openApp('projects');
                            closeStart();
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={p.image || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80'}
                              alt={p.title}
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {p.title}
                              </p>
                              <p className="text-[10px] text-slate-400">{p.category} • {p.tagline}</p>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : viewMode === 'allApps' ? (
          /* ================= 2. ALL APPS VIEW (A-Z Grouped) ================= */
          <div className="space-y-4">
            {/* Header with Back button */}
            <div className="flex items-center justify-between px-1 pb-1">
              <button
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                onClick={() => setViewMode('pinned')}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Pinned</span>
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                All Apps ({apps.length})
              </span>
            </div>

            {/* A-Z App List */}
            <div className="space-y-3">
              {Object.keys(alphabetizedApps).map((letter) => (
                <div key={letter} className="space-y-1">
                  <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10 rounded-md">
                    {letter}
                  </div>
                  {alphabetizedApps[letter].map((app) => (
                    <StartMenuAllAppRow
                      key={app.id}
                      app={app}
                      isPinned={isPinnedToStart(app.id)}
                      onOpen={openApp}
                      onClose={closeStart}
                      onTogglePin={(appId, e) => {
                        e.stopPropagation();
                        if (isPinnedToStart(appId)) unpinFromStart(appId);
                        else pinToStart(appId);
                      }}
                      onContextMenu={handleAppRightClick}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ================= 3. ORIGINAL PINNED APPS VIEW (Image 4) ================= */
          <>
            {/* Pinned Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Pinned</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                  {pinnedApps.length} Apps
                </span>
              </div>
              <button
                id="all-apps-button"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer px-2 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                onClick={() => setViewMode('allApps')}
                title="View all installed applications"
              >
                <span>All apps</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Grid of Pinned Apps */}
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3 mb-5">
              {pinnedApps.map((app) => (
                <StartMenuPinnedItem
                  key={app.id}
                  app={app}
                  onOpen={openApp}
                  onClose={closeStart}
                  onContextMenu={handleAppRightClick}
                />
              ))}
            </div>

            {/* Recommended / Featured Projects Section */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Recommended & Recent
                </span>
                <button
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                  onClick={() => {
                    openApp('projects');
                    closeStart();
                  }}
                >
                  More &gt;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROJECTS_DATA.slice(0, 2).map((proj) => (
                  <div
                    key={proj.id}
                    className="flex items-center gap-3 p-2 rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-all"
                    onClick={() => {
                      openApp('projects');
                      closeStart();
                    }}
                  >
                    <img
                      src={proj.image || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80'}
                      alt={proj.title}
                      className="w-9 h-9 rounded-lg object-cover"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {proj.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {proj.category}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Profile & Power Footer */}
      <div className="relative pt-3 mt-2 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between">
        {/* User Profile Info */}
        <button
          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors group"
          onClick={() => {
            openApp('about');
            closeStart();
          }}
          title="Open About Me (Edit Profile & Avatar)"
        >
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/avatar.png';
            }}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30 group-hover:ring-blue-500 transition-all shadow-sm"
          />
          <div className="text-left">
            <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[140px]">
              {currentUser.name}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[140px]">
              {currentUser.title}
            </p>
          </div>
        </button>

        {/* Power Menu Button & Flyout */}
        <div className="relative">
          <button
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
            onClick={() => setShowPowerMenu(!showPowerMenu)}
            title="Power"
          >
            <Power className="w-4 h-4 text-red-500" />
          </button>

          {showPowerMenu && (
            <div className="absolute bottom-12 right-0 w-48 p-1.5 rounded-xl border border-white/20 dark:border-white/10 bg-white dark:bg-slate-800 shadow-2xl text-xs z-50 animate-in fade-in duration-100 space-y-0.5">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer text-left font-medium"
                onClick={() => {
                  setShowPowerMenu(false);
                  closeStart();
                  lockScreen();
                }}
              >
                <Lock className="w-3.5 h-3.5 text-blue-500" />
                <span>Lock Screen</span>
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer text-left font-medium"
                onClick={() => {
                  setShowPowerMenu(false);
                  closeStart();
                  setPowerState('sleep');
                }}
              >
                <Moon className="w-3.5 h-3.5 text-slate-700 dark:text-white" />
                <span>Sleep</span>
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer text-left font-medium"
                onClick={() => {
                  setShowPowerMenu(false);
                  closeStart();
                  setPowerState('restart');
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restart</span>
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer text-left font-medium"
                onClick={() => {
                  setShowPowerMenu(false);
                  closeStart();
                  setPowerState('shutdown');
                }}
              >
                <Power className="w-3.5 h-3.5 text-red-500" />
                <span>Shut down</span>
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-white/10" />
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer text-left font-medium"
                onClick={() => {
                  setShowPowerMenu(false);
                  closeStart();
                  openApp('settings');
                }}
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Settings</span>
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-600 dark:text-red-400 cursor-pointer text-left font-medium"
                onClick={() => {
                  setShowPowerMenu(false);
                  closeStart();
                  triggerBsod();
                }}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Simulate BSOD</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  </>
  );
};
