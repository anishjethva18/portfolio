import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOS } from '../../context/OSContext';
import { PROJECTS_DATA } from '../../data/portfolioData';
import { isMediaFile } from '../../utils/fileAssociations';
import { AppIcon } from '../common/AppIcon';
import {
  Search,
  X,
  Folder,
  FileText,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Clock,
  Compass,
  FileCode,
  Archive,
  Image as ImageIcon,
  Sliders,
} from 'lucide-react';
import { FileItem, ProjectData } from '../../types';

interface SettingTopic {
  title: string;
  tab: 'home' | 'personalization' | 'taskbar' | 'system' | 'apps' | 'about';
  desc: string;
  keywords: string[];
}

const SETTINGS_SEARCH_INDEX: SettingTopic[] = [
  {
    title: 'Taskbar Settings',
    tab: 'taskbar',
    desc: 'Taskbar behaviors, alignment (center/left), auto-hide, search bar, and system tray icons',
    keywords: ['taskbar', 'taskbar settings', 'task bar', 'alignment', 'center', 'left', 'auto hide', 'tray', 'dock', 'start button'],
  },
  {
    title: 'Taskbar Alignment & Behaviors',
    tab: 'taskbar',
    desc: 'Center or left align taskbar, auto-hide taskbar, show badges and animations',
    keywords: ['taskbar', 'alignment', 'position', 'bottom', 'center taskbar', 'left taskbar'],
  },
  {
    title: 'Taskbar System Icons & Location',
    tab: 'taskbar',
    desc: 'Toggle Wi-Fi, Sound, Battery, and Live Weather Location on taskbar',
    keywords: ['taskbar icons', 'system tray', 'wifi', 'volume', 'battery', 'clock', 'weather'],
  },
  {
    title: 'Personalization & Wallpapers',
    tab: 'personalization',
    desc: 'Change background wallpaper, live dynamic themes, accent colors, and desktop styles',
    keywords: ['wallpaper', 'background', 'theme', 'personalization', 'colors', 'accent', 'look'],
  },
  {
    title: 'Desktop & App Icon Styles',
    tab: 'personalization',
    desc: 'Customize desktop & app icon color style and Fluent 3D / Outline modes',
    keywords: ['icon color', 'desktop icons', 'icon style', 'fluent', 'outline', 'tint'],
  },
  {
    title: 'Dark Mode & Light Theme',
    tab: 'personalization',
    desc: 'Toggle dark mode, light OS theme, or automatic schedule',
    keywords: ['dark mode', 'light mode', 'theme', 'color scheme', 'appearance'],
  },
  {
    title: 'Sound & Volume Settings',
    tab: 'system',
    desc: 'Adjust master volume, audio effects, and startup chimes',
    keywords: ['sound', 'volume', 'audio', 'speaker', 'sound effects', 'mute'],
  },
  {
    title: 'Display & Brightness',
    tab: 'system',
    desc: 'Adjust screen brightness, night light, and display resolution',
    keywords: ['display', 'brightness', 'screen', 'monitor', 'night light', 'resolution'],
  },
  {
    title: 'Storage & Recycle Bin Policy',
    tab: 'system',
    desc: 'Storage Sense, NVMe SSD storage (C: and D: drives), and 30-day auto-delete rules',
    keywords: ['storage', 'hard drive', 'ssd', 'recycle bin', 'auto delete', 'disk space', 'clean up'],
  },
  {
    title: 'Camera & Microphone Settings',
    tab: 'system',
    desc: 'Camera devices, resolution, microphone audio input, and mirroring options',
    keywords: ['camera', 'webcam', 'microphone', 'mic', 'video', 'mirror camera', 'permissions'],
  },
  {
    title: 'Installed Applications & Processes',
    tab: 'apps',
    desc: 'View installed apps, default programs, background processes, and memory usage',
    keywords: ['apps', 'applications', 'programs', 'installed', 'defaults', 'task manager', 'software'],
  },
  {
    title: 'About This PC & System Specs',
    tab: 'about',
    desc: 'Device specifications, CPU, RAM, OS build, and developer portfolio info',
    keywords: ['about', 'system specs', 'pc info', 'device specifications', 'specs', 'ram', 'processor', 'version'],
  },
];

export const SearchFlyout: React.FC = () => {
  const { openApp, closeSearch, files, settings, apps = [] } = useOS();
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('win11_recent_searches') || '[]');
      return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string').slice(0, 6) : [];
    } catch (error) {
      console.warn('[SearchFlyout] Recent searches could not be read.', error);
      return [];
    }
  });
  const [publishedProjects, setPublishedProjects] = useState<ProjectData[]>(PROJECTS_DATA);
  const [publishedProfileSearchText, setPublishedProfileSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'apps' | 'projects' | 'files' | 'settings'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/profile/projects').then(async (response) => {
        if (!response.ok) throw new Error(`Published projects could not be loaded (HTTP ${response.status}).`);
        const result = await response.json();
        if (!Array.isArray(result?.projects)) throw new Error('Published project search data is invalid.');
        if (active) setPublishedProjects(result.projects.filter((project: ProjectData) => project.visible !== false));
      }),
      fetch('/api/profile').then(async (response) => {
        if (!response.ok) throw new Error(`Published profile search data could not be loaded (HTTP ${response.status}).`);
        const result = await response.json();
        const skills = Array.isArray(result?.skills)
          ? result.skills.flatMap((category: { title?: string; skills?: Array<{ name?: string }> }) => [
              category.title || '',
              ...(category.skills || []).map((skill) => skill.name || ''),
            ])
          : [];
        const searchableText = [result?.name, result?.title, result?.tagline, result?.bio, ...skills]
          .filter((value): value is string => typeof value === 'string')
          .join(' ')
          .toLowerCase();
        if (active) setPublishedProfileSearchText(searchableText);
      }),
    ]).catch((error: unknown) => console.error('[SearchFlyout] Published search data could not be loaded.', error));
    return () => { active = false; };
  }, []);

  const query = searchTerm.trim().toLowerCase();
  const tokens = useMemo(() => query.split(/\s+/).filter(Boolean), [query]);
  const cleanExt = query.startsWith('.') ? query.slice(1) : query;

  useEffect(() => {
    if (!query) return;
    const timer = window.setTimeout(() => {
      setRecentSearches((current) => {
        const next = [searchTerm.trim(), ...current.filter((term) => term.toLowerCase() !== query)].slice(0, 6);
        try {
          localStorage.setItem('win11_recent_searches', JSON.stringify(next));
        } catch (error) {
          console.warn('[SearchFlyout] Recent searches could not be saved.', error);
        }
        return next;
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query, searchTerm]);

  const topSearches = useMemo(() => {
    const suggestions = [...apps.slice(0, 4).map((app) => app.name), ...publishedProjects.slice(0, 3).map((project) => project.title)];
    return [...new Set(suggestions.filter(Boolean))].slice(0, 6);
  }, [apps, publishedProjects]);

  // Filter apps with smart multi-word matching
  const matchedApps = useMemo(() => {
    if (!query) return [];
    return apps.filter((app) => {
      const text = `${app.name} ${app.category} ${app.description || ''}`.toLowerCase();
      if (app.id === 'about' && publishedProfileSearchText.includes(query)) return true;
      if (text.includes(query)) return true;
      return tokens.every((token) => text.includes(token));
    });
  }, [query, tokens, apps, publishedProfileSearchText]);

  // Filter projects with smart multi-word matching
  const matchedProjects = useMemo(() => {
    if (!query) return [];
    return publishedProjects.filter((p) => {
      const text = `${p.title} ${p.category} ${p.tagline} ${p.technologies.join(' ')}`.toLowerCase();
      if (text.includes(query)) return true;
      return tokens.every((token) => text.includes(token));
    });
  }, [query, tokens, publishedProjects]);

  // Filter file system files & documents (including .docx, .pdf, extension matching)
  const matchedFiles = useMemo(() => {
    if (!query) return [];
    return files.filter((f) => {
      if (f.type === 'folder') {
        const text = `${f.name} ${f.path}`.toLowerCase();
        return text.includes(query) || tokens.every((t) => text.includes(t));
      }
      const ext = f.extension?.toLowerCase() || '';
      const matchesExt = ext === cleanExt || ext === query;
      const text = `${f.name} ${f.path} ${ext}`.toLowerCase();
      if (matchesExt || text.includes(query)) return true;
      return tokens.every((token) => text.includes(token));
    });
  }, [query, cleanExt, files, tokens]);

  // Filter settings with smart keywords & token matching
  const matchedSettings = useMemo(() => {
    if (!query) return [];
    return SETTINGS_SEARCH_INDEX.filter((s) => {
      const fullText = `${s.title} ${s.desc} ${s.tab} ${s.keywords.join(' ')}`.toLowerCase();
      if (fullText.includes(query)) return true;
      return tokens.every((token) => fullText.includes(token));
    });
  }, [query, tokens]);

  const totalResults =
    (activeCategory === 'all' || activeCategory === 'apps' ? matchedApps.length : 0) +
    (activeCategory === 'all' || activeCategory === 'projects' ? matchedProjects.length : 0) +
    (activeCategory === 'all' || activeCategory === 'files' ? matchedFiles.length : 0) +
    (activeCategory === 'all' || activeCategory === 'settings' ? matchedSettings.length : 0);

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') return <Folder className="w-5 h-5 text-amber-500" />;
    const ext = file.extension?.toLowerCase();
    if (ext === 'pdf' || ext === 'docx' || ext === 'txt' || ext === 'md') {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (ext === 'json' || ext === 'csv' || ext === 'bin') {
      return <FileCode className="w-5 h-5 text-emerald-500" />;
    }
    if (ext === 'png' || ext === 'jpg') {
      return <ImageIcon className="w-5 h-5 text-purple-500" />;
    }
    if (ext === 'zip') {
      return <Archive className="w-5 h-5 text-amber-600" />;
    }
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-transparent z-[998]"
        onClick={closeSearch}
      />
      <div
        id="search-flyout-container"
      className={`fixed inset-0 w-full h-full max-w-none max-h-none rounded-none pt-[max(env(safe-area-inset-top,8px),38px)] pb-[max(env(safe-area-inset-bottom,16px),56px)] sm:pt-4 sm:bottom-14 sm:inset-auto sm:w-[640px] sm:max-w-[95vw] sm:h-[520px] sm:max-h-[85vh] sm:rounded-2xl z-[999] flex flex-col border border-white/20 dark:border-white/10 shadow-2xl p-3 sm:p-5 select-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-4 ${
        settings.transparency
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl'
          : 'bg-white dark:bg-slate-900'
      } ${
        settings.taskbarAlignment === 'center' ? 'sm:left-1/2 sm:-translate-x-1/2' : 'sm:left-4'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Search Input Bar */}
      <div className="relative mb-2.5 flex items-center gap-2">
        <button
          onClick={closeSearch}
          className="sm:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
          title="Back / Close search"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search apps, files, settings..."
            className="w-full pl-10 pr-10 h-11 sm:h-auto sm:py-2.5 text-sm sm:text-xs rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          {searchTerm && (
            <button
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer"
              onClick={() => setSearchTerm('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 pb-2.5 border-b border-slate-200/60 dark:border-white/10 text-xs overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
        {(['all', 'apps', 'projects', 'files', 'settings'] as const).map((cat) => (
          <button
            key={cat}
            className={`px-3 py-1 rounded-lg capitalize font-medium whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat === 'files' ? 'Files & .docx' : cat}
          </button>
        ))}
      </div>

      {/* Search Body Content */}
      <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-4">
        {!searchTerm ? (
          /* Default Quick Suggestions & Portfolio Overview */
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" /> Top searches
              </p>
              <div className="flex flex-wrap gap-2">
                {topSearches.map((term) => (
                  <button
                    key={term}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 hover:bg-blue-500/10 hover:text-blue-500 text-xs text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-white/5 cursor-pointer transition-all"
                    onClick={() => setSearchTerm(term)}
                  >
                    <Search className="w-3 h-3 text-slate-400" />
                    <span>{term}</span>
                  </button>
                ))}
                {!topSearches.length && <span className="text-xs text-slate-400">Search suggestions will appear when apps are available.</span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Recent searches
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 hover:bg-blue-500/10 hover:text-blue-500 text-xs text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-white/5 cursor-pointer transition-all"
                    onClick={() => setSearchTerm(term)}
                  >
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{term}</span>
                  </button>
                ))}
                {!recentSearches.length && <span className="text-xs text-slate-400">Your searches will appear here.</span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" /> Quick Apps
              </p>
              <div className="grid grid-cols-4 gap-2">
                {apps.slice(0, 8).map((app) => (
                  <button
                    key={app.id}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-500/10 border border-slate-200/50 dark:border-white/5 cursor-pointer group transition-all"
                    onClick={() => {
                      openApp(app.id);
                      closeSearch();
                    }}
                  >
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                      <AppIcon name={app.icon} className="w-5 h-5" />
                    </div>
                    <span className="mt-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate w-full text-center">
                      {app.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Search Results */
          <div className="space-y-4">
            {totalResults === 0 ? (
              <div className="py-12 text-center">
                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No results found for "{searchTerm}"</p>
                <p className="text-xs text-slate-400 mt-1">Try searching for ".docx", "Projects", "Skills", "Terminal", or "Settings"</p>
              </div>
            ) : (
              <>
                {/* Apps Match */}
                {(activeCategory === 'all' || activeCategory === 'apps') && matchedApps.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Applications ({matchedApps.length})
                    </p>
                    <div className="space-y-1.5">
                      {matchedApps.map((app) => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-white/5 cursor-pointer transition-all"
                          onClick={() => {
                            openApp(app.id);
                            closeSearch();
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                              <AppIcon name={app.icon} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{app.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{app.category} App</p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files Match (including .docx, .pdf, .txt, etc.) */}
                {(activeCategory === 'all' || activeCategory === 'files') && matchedFiles.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Files & Documents ({matchedFiles.length})
                    </p>
                    <div className="space-y-1.5">
                      {matchedFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-white/5 cursor-pointer transition-all"
                          onClick={() => {
                            if (f.type === 'folder') {
                              openApp('explorer', { path: f.path });
                            } else if (f.extension === 'pdf') {
                              openApp('resume');
                            } else if (isMediaFile(f.extension || f.name)) {
                              openApp('photos', { filePath: f.path });
                            } else {
                              openApp('notepad', { filePath: f.path });
                            }
                            closeSearch();
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                              {getFileIcon(f)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{f.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{f.path}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase shrink-0">
                            {f.extension || 'Folder'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settings Match */}
                {(activeCategory === 'all' || activeCategory === 'settings') && matchedSettings.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Settings ({matchedSettings.length})
                    </p>
                    <div className="space-y-1.5">
                      {matchedSettings.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-white/5 cursor-pointer transition-all"
                          onClick={() => {
                            openApp('settings', { tab: s.tab });
                            closeSearch();
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                              <Sliders className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{s.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{s.desc}</p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects Match */}
                {(activeCategory === 'all' || activeCategory === 'projects') && matchedProjects.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Portfolio Projects ({matchedProjects.length})
                    </p>
                    <div className="space-y-1.5">
                      {matchedProjects.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-white/5 cursor-pointer transition-all"
                          onClick={() => {
                            openApp('projects');
                            closeSearch();
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                            <img
                              src={p.image || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80'}
                              alt={p.title}
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{p.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{p.category} • {p.technologies.slice(0, 3).join(', ')}</p>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-blue-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  </>
  );
};
