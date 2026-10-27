import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOS } from '../../context/OSContext';
import { WallpaperId, DesktopIconItem, AppId } from '../../types';
import { usePublishedProfile } from '../../hooks/usePublishedProfile';
import { fetchLiveWeather, WeatherData } from '../../utils/weather';
import { D_DRIVE_FOLDER_PATHS } from '../../utils/virtualDDrive';
import { AppIcon } from '../common/AppIcon';
import {
  Home,
  Music,
  Monitor,
  Palette,
  PanelBottom,
  LayoutGrid,
  User,
  Search,
  Check,
  Sparkles,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Laptop,
  ChevronRight,
  Briefcase,
  Award,
  FileText,
  Mail,
  Sliders,
  Code2,
  Wifi,
  Battery,
  Bell,
  MapPin,
  RefreshCw,
  Link,
  Play,
  Calendar,
  PanelLeft,
  Menu,
  X,
  Plus,
  Trash2,
  Globe,
  FolderOpen,
} from 'lucide-react';

type SettingsTab =
  | 'home'
  | 'personalization'
  | 'taskbar'
  | 'system'
  | 'apps'
  | 'about';

interface SettingSearchItem {
  id: string;
  tab: SettingsTab;
  title: string;
  category: string;
  description: string;
}

interface SettingsAppProps {
  initialTab?: SettingsTab;
}

export const SettingsApp: React.FC<SettingsAppProps> = ({ initialTab }) => {
  const {
    settings,
    updateSettings,
    addNotification,
    apps = [],
    openApp,
    desktopIcons,
    addOrMoveDesktopIcon,
    deleteDesktopIcon,
    pinnedAppIds,
    pinToTaskbar,
    unpinFromTaskbar,
    startPinnedAppIds,
    pinToStart,
    unpinFromStart,
    isPinnedToStart,
    sortDesktopIcons,
    files = [],
    createFile,
  } = useOS();
  const { profile: currentUser, siteSettings } = usePublishedProfile();

  // Tab State: Starts cleanly at home or initialTab if explicitly opened from a context menu
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (initialTab && ['home', 'personalization', 'taskbar', 'system', 'about'].includes(initialTab)) {
      return initialTab;
    }
    return 'home';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [customLiveUrl, setCustomLiveUrl] = useState(settings.customWallpaperUrl || '');

  const resolvedDesktopWallpaper = React.useMemo(() => {
    if (!settings.customWallpaperUrl) return '';
    const matching = files.find(
      (f) =>
        f.path === settings.customWallpaperUrl ||
        f.id === settings.customWallpaperUrl ||
        f.name === settings.customWallpaperUrl
    );
    return matching?.content || settings.customWallpaperUrl;
  }, [settings.customWallpaperUrl, files]);
  const [pcName] = useState('ANISH-PORTFOLIO-PC');
  const [locationStatus, setLocationStatus] = useState<string>('Default (Ahmedabad)');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrowContainer, setIsNarrowContainer] = useState(false);

  // Background selection and browse state
  const [browsePcModal, setBrowsePcModal] = useState(false);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const [selectedAppIconFilter, setSelectedAppIconFilter] = useState<string>('all');

  // Custom Shortcuts Manager States
  const [customShortcutModal, setCustomShortcutModal] = useState(false);
  const [newShortcutName, setNewShortcutName] = useState('');
  const [newShortcutTargetType, setNewShortcutTargetType] = useState<'app' | 'url'>('app');
  const [newShortcutTargetApp, setNewShortcutTargetApp] = useState<AppId>('projects');
  const [newShortcutUrl, setNewShortcutUrl] = useState('');
  const [newShortcutIcon, setNewShortcutIcon] = useState('Sparkles');
  const [appSearchFilter, setAppSearchFilter] = useState('');
  const [appsCategoryFilter, setAppsCategoryFilter] = useState<string>('all');

  // Responsive container observer for Settings window
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width < 560) {
          setIsNarrowContainer(true);
        } else {
          setIsNarrowContainer(false);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync initialTab if prop changes
  useEffect(() => {
    if (initialTab && ['home', 'personalization', 'taskbar', 'system', 'about'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Read saved location city
  useEffect(() => {
    const savedCity = localStorage.getItem('win11_weather_city');
    if (savedCity) {
      setLocationStatus(savedCity);
    }
  }, []);

  // Searchable Settings Index
  const searchableSettings: SettingSearchItem[] = useMemo(
    () => [
      {
        id: 's-wallpaper',
        tab: 'personalization',
        title: 'Desktop Wallpaper & Themes',
        category: 'Personalization',
        description: 'Choose Windows Bloom, Dark Bloom, Aurora, or Cyberpunk wallpapers',
      },
      {
        id: 's-live-wp',
        tab: 'personalization',
        title: 'Live Animated Wallpapers',
        category: 'Personalization',
        description: 'Matrix rain, harmonic waves, synthwave grid, and breathing aurora shaders',
      },
      {
        id: 's-custom-wp',
        tab: 'personalization',
        title: 'Custom Live Wallpaper URL',
        category: 'Personalization',
        description: 'Embed custom YouTube video, direct MP4 video, or WebGL interactive canvases',
      },
      {
        id: 's-accent',
        tab: 'personalization',
        title: 'Accent Color',
        category: 'Personalization',
        description: 'Change highlight borders, selections, and window accent colors',
      },
      {
        id: 's-icon-color',
        tab: 'personalization',
        title: 'Desktop & App Icon Color',
        category: 'Personalization',
        description: 'Change icon tint color or sync color directly with system accent',
      },
      {
        id: 's-sync-accent',
        tab: 'personalization',
        title: 'Sync Icon Color with Accent',
        category: 'Personalization',
        description: 'Automatically link desktop icon colors to match your chosen accent color',
      },
      {
        id: 's-dark-mode',
        tab: 'personalization',
        title: 'Dark / Light Mode',
        category: 'Personalization',
        description: 'Toggle between dark and light themes across the OS',
      },
      {
        id: 's-taskbar-align',
        tab: 'taskbar',
        title: 'Taskbar Alignment',
        category: 'Taskbar',
        description: 'Position Start menu and taskbar buttons in the Center or Left',
      },
      {
        id: 's-taskbar-autohide',
        tab: 'taskbar',
        title: 'Automatically Hide Taskbar',
        category: 'Taskbar',
        description: 'Autohide taskbar and reveal on bottom edge hover',
      },
      {
        id: 's-taskbar-search',
        tab: 'taskbar',
        title: 'Taskbar Search Button',
        category: 'Taskbar',
        description: 'Display search box, search icon, or hide search on taskbar',
      },
      {
        id: 's-weather-widgets',
        tab: 'taskbar',
        title: 'Weather & Widgets Pill',
        category: 'Taskbar',
        description: 'Configure weather widget and location permission settings',
      },
      {
        id: 's-date-format',
        tab: 'taskbar',
        title: 'Date & Time Formats',
        category: 'Taskbar',
        description: 'Customize clock display: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, short date',
      },
      {
        id: 's-seconds-clock',
        tab: 'taskbar',
        title: 'Show Seconds in Clock',
        category: 'Taskbar',
        description: 'Display seconds (HH:MM:SS) in taskbar clock',
      },
      {
        id: 's-tray-icons',
        tab: 'taskbar',
        title: 'System Tray Icons',
        category: 'Taskbar',
        description: 'Toggle Wi-Fi, Volume, Battery, and Notification Bell indicators',
      },
      {
        id: 's-brightness',
        tab: 'system',
        title: 'Display Brightness',
        category: 'System & Display',
        description: 'Adjust master screen brightness slider',
      },
      {
        id: 's-volume',
        tab: 'system',
        title: 'Sound & Volume Feedback',
        category: 'System & Display',
        description: 'Control system audio volume and click sound effects',
      },
      {
        id: 's-specs',
        tab: 'system',
        title: 'Device Specifications',
        category: 'System & Display',
        description: 'View host device specifications and developer information',
      },
      {
        id: 's-about',
        tab: 'about',
        title: 'About Anish Jethva',
        category: 'About Developer',
        description: 'Developer biography, engineering background, and contact details',
      },
    ],
    []
  );

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return searchableSettings.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [searchQuery, searchableSettings]);

  // Static Wallpapers
  const staticWallpapers: { id: WallpaperId; title: string; bg: string; preview: string }[] = [
    {
      id: 'bloom',
      title: 'Windows Bloom Light',
      bg: 'from-blue-600 via-sky-400 to-indigo-500',
      preview: 'bg-gradient-to-br from-blue-600 via-sky-400 to-indigo-500',
    },
    {
      id: 'darkbloom',
      title: 'Windows Dark Bloom',
      bg: 'from-blue-900 via-indigo-950 to-slate-950',
      preview: 'bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900',
    },
    {
      id: 'aurora',
      title: 'Aurora Borealis',
      bg: 'from-emerald-600 via-teal-500 to-cyan-600',
      preview: 'bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-600',
    },
    {
      id: 'cyberpunk',
      title: 'Cyberpunk Neon',
      bg: 'from-fuchsia-600 via-rose-600 to-cyan-500',
      preview: 'bg-gradient-to-br from-fuchsia-600 via-rose-600 to-cyan-500',
    },
    {
      id: 'sunset',
      title: 'Sunset Dusk',
      bg: 'from-amber-600 via-rose-600 to-purple-800',
      preview: 'bg-gradient-to-br from-amber-600 via-rose-600 to-purple-800',
    },
    {
      id: 'minimal',
      title: 'Minimalist Charcoal',
      bg: 'from-slate-800 to-slate-950',
      preview: 'bg-gradient-to-br from-slate-800 to-slate-950',
    },
  ];

  // Live Animated Wallpapers
  const liveWallpapers: { id: WallpaperId; title: string; bg: string; badge: string; desc: string }[] = [
    {
      id: 'live-matrix',
      title: 'Digital Matrix Rain',
      bg: 'from-emerald-950 via-green-900 to-black',
      badge: 'Interactive Canvas',
      desc: 'Cascading green glyphs flowing in real-time',
    },
    {
      id: 'live-waves',
      title: 'Flowing Neon Waves',
      bg: 'from-blue-950 via-slate-900 to-indigo-950',
      badge: 'Particle Engine',
      desc: 'Smooth harmonic sine wave particle oscillations',
    },
    {
      id: 'live-cyberpunk',
      title: 'Cyber Synthwave Grid',
      bg: 'from-fuchsia-950 via-purple-950 to-black',
      badge: '3D Wireframe',
      desc: 'Retro 80s outrun perspective highway grid',
    },
    {
      id: 'live-aurora',
      title: 'Breathing Aurora Glow',
      bg: 'from-teal-950 via-cyan-900 to-slate-950',
      badge: 'Dynamic Shader',
      desc: 'Ambient colorful atmospheric light curtains',
    },
  ];

  const sampleLiveUrls = [
    {
      label: 'Cosmic Flare (Video)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    },
    {
      label: 'Ocean Nature (Video)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    },
    {
      label: 'Lo-Fi Chill (YouTube)',
      url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    },
    {
      label: '4K Alpine Peaks (Image)',
      url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80',
    },
    {
      label: 'Cyberpunk Neon (Image)',
      url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1920&q=80',
    },
  ];

  const accentColors = [
    { hex: '#0078d4', title: 'Windows Blue' },
    { hex: '#004e8c', title: 'Cobalt Blue' },
    { hex: '#0088cc', title: 'Sky Blue' },
    { hex: '#00b7c3', title: 'Teal Cyan' },
    { hex: '#038387', title: 'Dark Teal' },
    { hex: '#10893e', title: 'Mint Green' },
    { hex: '#107c41', title: 'Emerald Green' },
    { hex: '#004b1c', title: 'Forest Green' },
    { hex: '#5c8a00', title: 'Lime Green' },
    { hex: '#d97706', title: 'Amber Gold' },
    { hex: '#e06b00', title: 'Warm Amber' },
    { hex: '#ca5010', title: 'Vibrant Orange' },
    { hex: '#c44d18', title: 'Terracotta' },
    { hex: '#d13438', title: 'Crimson Red' },
    { hex: '#e3008c', title: 'Rose Pink' },
    { hex: '#c239b3', title: 'Magenta' },
    { hex: '#8764b8', title: 'Orchid' },
    { hex: '#744da9', title: 'Royal Purple' },
    { hex: '#5c2d91', title: 'Iris Purple' },
    { hex: '#4f2d7f', title: 'Dark Violet' },
    { hex: '#567c73', title: 'Slate Green' },
    { hex: '#486860', title: 'Steel Blue' },
    { hex: '#4a5459', title: 'Storm Gray' },
    { hex: '#2d3748', title: 'Charcoal' },
  ];

  const iconColorsList = accentColors;

  const dateFormats = [
    { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '08/14/2026' },
    { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '14/08/2026' },
    { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-08-14' },
    { id: 'MMM D, YYYY', label: 'Short Date', example: 'Aug 14, 2026' },
    { id: 'ddd, MMM D, YYYY', label: 'Day & Month', example: 'Fri, Aug 14' },
    { id: 'D MMMM YYYY', label: 'Full Date', example: '14 August 2026' },
    { id: 'DD-MM-YYYY', label: 'Dashes (DD-MM-YYYY)', example: '14-08-2026' },
  ];

  const handleApplyCustomLiveWallpaper = (urlToApply?: string) => {
    const finalUrl = (urlToApply || customLiveUrl).trim();
    if (!finalUrl) return;
    setCustomLiveUrl(finalUrl);
    updateSettings({
      wallpaper: 'custom',
      customWallpaperUrl: finalUrl,
    });
    addNotification({
      title: 'Live Wallpaper Applied',
      message: `Desktop wallpaper updated to custom stream`,
      type: 'success',
    });
  };

  const cityPresets = [
    { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
    { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
    { name: 'Delhi', lat: 28.6139, lon: 77.209 },
    { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
    { name: 'Pune', lat: 18.5204, lon: 73.8567 },
    { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
    { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
    { name: 'Surat', lat: 21.1702, lon: 72.8311 },
    { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  ];

  const handleSelectCity = async (city: { name: string; lat: number; lon: number }) => {
    try {
      localStorage.setItem('win11_weather_coords', JSON.stringify({ lat: city.lat, lon: city.lon }));
      localStorage.setItem('win11_weather_city', city.name);
      localStorage.setItem('win11_weather_location_mode', 'city');
      setLocationStatus(city.name);
      const data = await fetchLiveWeather({ requestGps: false, forceRefresh: true });
      addNotification({
        title: 'Weather Location Updated',
        message: `Set to ${city.name} (${data.tempC}°C, ${data.condition})`,
        type: 'success',
      });
    } catch {
      setLocationStatus(city.name);
    }
  };

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const data: WeatherData = await fetchLiveWeather({ requestGps: true });
      setLocationStatus(data.city);
      addNotification({
        title: 'Location Updated',
        message: `Weather synchronized for ${data.city} (${data.tempC}°C, ${data.condition})`,
        type: 'success',
      });
    } catch {
      addNotification({
        title: 'Location Detection',
        message: 'Could not retrieve GPS coordinates. Kept current location.',
        type: 'warning',
      });
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleAccentChange = (hex: string) => {
    if (settings.syncIconColorWithAccent) {
      updateSettings({ accentColor: hex, iconColor: hex });
    } else {
      updateSettings({ accentColor: hex });
    }
  };

  const handleToggleSyncWithAccent = () => {
    const nextSync = !settings.syncIconColorWithAccent;
    if (nextSync) {
      updateSettings({
        syncIconColorWithAccent: true,
        iconColor: settings.accentColor,
      });
      addNotification({
        title: 'Icon Color Synced',
        message: 'Desktop & app icon colors are now synced with accent color',
        type: 'info',
      });
    } else {
      updateSettings({ syncIconColorWithAccent: false });
    }
  };

  // Image files on This PC
  const systemImageFiles = useMemo(() => {
    return (files || []).filter((f) => {
      if (f.type === 'folder') return false;
      const ext = (f.extension || '').toLowerCase();
      const isImgExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'tiff', 'bmp', 'heic'].includes(ext);
      const isImgContent = f.content?.startsWith('data:image') || f.content?.startsWith('http');
      return isImgExt || isImgContent;
    });
  }, [files]);

  const handleFileUploadBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        if (createFile) {
          createFile(D_DRIVE_FOLDER_PATHS.wallpapers, file.name, dataUrl, file.name.split('.').pop() || 'jpg');
        }
        updateSettings({
          wallpaper: 'custom',
          customWallpaperUrl: dataUrl,
        });
        addNotification({
          title: 'Desktop Background Updated',
          message: `Set "${file.name}" as desktop background`,
          type: 'success',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSetImageAsBackground = (imageFile: { name: string; content?: string; path: string }) => {
    updateSettings({
      wallpaper: 'custom',
      customWallpaperUrl: imageFile.content || imageFile.path,
    });
    addNotification({
      title: 'Desktop Background Updated',
      message: `Set "${imageFile.name}" as desktop background`,
      type: 'success',
    });
  };

  const handleSelectAppIconVariant = (appId: string, variantId: string) => {
    const currentCustom = settings.customAppIcons || {};
    updateSettings({
      customAppIcons: {
        ...currentCustom,
        [appId]: variantId,
      },
    });
    addNotification({
      title: 'Application Icon Updated',
      message: `Updated icon style for ${appId}`,
      type: 'success',
    });
  };

  const handleResetAllAppIcons = () => {
    updateSettings({ customAppIcons: {} });
    addNotification({
      title: 'Icons Reset',
      message: 'All application icons reset to system default Windows 11 style',
      type: 'info',
    });
  };

  const systemAppEntries = [
    { id: 'explorer', name: 'This PC / File Explorer', category: 'System' },
    { id: 'browser', name: 'Web Browser (Google Chrome)', category: 'Internet' },
    { id: 'terminal', name: 'Windows Terminal / PowerShell', category: 'Developer' },
    { id: 'notepad', name: 'Notepad Text Editor', category: 'Productivity' },
    { id: 'photos', name: 'Photos & Media Player', category: 'Media' },
    { id: 'camera', name: 'Windows Camera App', category: 'Media' },
    { id: 'settings', name: 'Settings & Control Panel', category: 'System' },
    { id: 'resume', name: 'Resume & Curriculum Vitae', category: 'Portfolio' },
    { id: 'projects', name: 'Projects & Case Studies', category: 'Portfolio' },
    { id: 'about', name: 'About Developer Profile', category: 'Portfolio' },
    { id: 'contact', name: 'Contact & Communication', category: 'Portfolio' },
    { id: 'calculator', name: 'Windows Calculator', category: 'Utility' },
    { id: 'minesweeper', name: 'Minesweeper Retro Game', category: 'Games' },
    { id: 'snake', name: 'Retro Snake Arcade', category: 'Games' },
    { id: 'recycle', name: 'Recycle Bin Trash', category: 'System' },
    { id: 'taskmanager', name: 'Task Manager Telemetry', category: 'System' },
  ];

  const filteredAppEntries = useMemo(() => {
    if (selectedAppIconFilter === 'all') return systemAppEntries;
    return systemAppEntries.filter((a) => a.category.toLowerCase() === selectedAppIconFilter.toLowerCase());
  }, [selectedAppIconFilter, systemAppEntries]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'personalization', label: 'Personalization', icon: Palette },
    { id: 'taskbar', label: 'Taskbar', icon: PanelBottom },
    { id: 'system', label: 'System & Display', icon: Monitor },
    { id: 'about', label: 'About Developer', icon: User },
  ];

  return (
    <div ref={containerRef} className="flex h-full bg-slate-100 dark:bg-[#1c1c1c] text-slate-800 dark:text-[#e0e0e0] font-sans select-none overflow-hidden relative">
      {/* Narrow Drawer Backdrop */}
      {isNarrowContainer && isSidebarOpen && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-150"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Settings Left Navigation Sidebar */}
      <div
        className={`${
          isNarrowContainer
            ? `absolute inset-y-0 left-0 z-50 w-64 shadow-2xl transition-transform duration-200 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
              }`
            : `${isSidebarOpen ? 'w-56 md:w-64' : 'w-14'} transition-all duration-200 shrink-0`
        } bg-slate-200/90 dark:bg-[#202020]/95 backdrop-blur-xl border-r border-slate-300 dark:border-white/10 flex flex-col select-none`}
      >
        {/* User / Profile Header */}
        <div className="p-3 md:p-4 flex items-center justify-between border-b border-slate-300 dark:border-white/10">
          <div className="flex items-center gap-3 overflow-hidden">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/avatar.png';
                }}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover ring-2 ring-cyan-500/40 shadow-md shrink-0"
              />
            ) : (
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md text-xs shrink-0">
                AJ
              </div>
            )}
            {(isSidebarOpen || isNarrowContainer) && (
              <div className="overflow-hidden">
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{currentUser.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentUser.title}</div>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-300/50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isNarrowContainer ? <X className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Search Settings Input */}
        {isSidebarOpen || isNarrowContainer ? (
          <div className="p-3 relative">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Find a setting"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#2b2b2b] border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Interactive Search Dropdown */}
            {searchQuery.trim() && (
              <div className="absolute top-full left-3 right-3 mt-1 bg-white dark:bg-[#252525] border border-slate-200 dark:border-cyan-500/40 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto p-1.5 space-y-1">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.tab);
                        setSearchQuery('');
                        if (isNarrowContainer) setIsSidebarOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-cyan-500/15 transition-colors cursor-pointer group flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                          {item.title}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-cyan-600 dark:text-cyan-300 font-medium">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.description}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    No settings found matching "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-2 text-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-300/50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Search settings"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Item Links */}
        <nav className="flex-1 overflow-y-auto px-1.5 md:px-2 space-y-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const showFull = isSidebarOpen || isNarrowContainer;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as SettingsTab);
                  if (isNarrowContainer) setIsSidebarOpen(false);
                }}
                title={item.label}
                className={`w-full flex items-center ${
                  showFull ? 'gap-3 px-3' : 'justify-center px-1'
                } py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white font-bold border-l-2 border-cyan-500 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300/40 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'}`} />
                {showFull && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom OS Version Specs */}
        {(isSidebarOpen || isNarrowContainer) && (
          <div className="p-3 border-t border-slate-300 dark:border-white/10 text-[10px] text-slate-500 text-center truncate">
            Windows 11 Portfolio OS v{siteSettings.portfolioVersion || '1.0.0'}
          </div>
        )}
      </div>

      {/* Main Settings Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-white dark:bg-[#181818] overflow-hidden">
        {/* Top Header - Always pinned at the top with clean borders and zero gap */}
        <div className="z-20 px-3.5 sm:px-4 md:px-6 py-2.5 sm:py-3 bg-white/95 dark:bg-[#181818]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="settings-open-menu-button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center justify-center p-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-white transition-colors cursor-pointer mr-1 font-semibold text-xs shadow-xs active:scale-95"
              title="Open Settings Menu"
            >
              <Menu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="hover:underline hover:text-cyan-600 dark:hover:text-cyan-400 font-semibold cursor-pointer transition-colors text-slate-700 dark:text-slate-300"
              title="Open Settings Menu"
            >
              Settings
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-slate-900 dark:text-white font-semibold capitalize truncate">
              {navItems.find((n) => n.id === activeTab)?.label || activeTab}
            </span>
          </div>
        </div>

        {/* Main Settings Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 md:p-6 min-w-0">
        {/* ================= TAB 1: HOME ================= */}
        {activeTab === 'home' && (
          <div className="space-y-6 max-w-4xl">
            {/* Hero Profile Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#1f293d] to-slate-900 border border-cyan-500/20 shadow-xl">
              <div className="flex items-center gap-4">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/avatar.png';
                    }}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-cyan-500/40 shadow-lg shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shrink-0">
                    AJ
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-white">{currentUser.name}</h1>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                      Online Portfolio
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{currentUser.title} • {currentUser.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => openApp('projects')}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow cursor-pointer flex items-center gap-1.5"
                >
                  <Briefcase className="w-3.5 h-3.5" /> View Projects
                </button>
                <button
                  onClick={() => openApp('contact')}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" /> Contact
                </button>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                onClick={() => openApp('about')}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-5 h-5 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">Skills &amp; Toolkit</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Browse technologies in About Me</div>
              </div>

              <div
                onClick={() => openApp('resume')}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-5 h-5 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">Resume & CV</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Education, experience, achievements</div>
              </div>

              <div
                onClick={() => openApp('about')}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <User className="w-5 h-5 text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">About the Developer</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Background, philosophy, journey</div>
              </div>
            </div>

            {/* Quick Personalization Block */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">System Personalization</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Quickly toggle wallpaper, theme mode, and accent</p>
                </div>
                <button
                  onClick={() => setActiveTab('personalization')}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                >
                  All Personalization Settings <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Wallpaper Previews Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {staticWallpapers.slice(0, 4).map((wp) => (
                  <div
                    key={wp.id}
                    onClick={() => updateSettings({ wallpaper: wp.id })}
                    className={`h-20 rounded-xl ${wp.preview} relative cursor-pointer overflow-hidden border-2 transition-all group ${
                      settings.wallpaper === wp.id ? 'border-cyan-500 shadow-md ring-2 ring-cyan-400/30' : 'border-transparent hover:border-slate-300 dark:hover:border-white/30'
                    }`}
                  >
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white drop-shadow">
                      {wp.title}
                    </span>
                    {settings.wallpaper === wp.id && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Theme & Volume Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/5 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    {settings.theme === 'dark' ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    <span className="text-xs font-medium text-slate-900 dark:text-white">Dark / Light Mode</span>
                  </div>
                  <button
                    onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                    className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-xs font-semibold text-slate-800 dark:text-white transition-colors cursor-pointer border border-slate-200 dark:border-white/10"
                  >
                    {settings.theme === 'dark' ? 'Dark' : 'Light'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/5 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <span className="text-xs font-medium text-slate-900 dark:text-white">System Volume</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.soundEnabled ? Math.round((settings.soundVolume ?? 0.5) * 100) : 0}
                      onChange={(e) => updateSettings({ soundVolume: parseInt(e.target.value) / 100, soundEnabled: parseInt(e.target.value) > 0 })}
                      className="w-24 accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 font-mono w-7 text-right">
                      {settings.soundEnabled ? `${Math.round((settings.soundVolume ?? 0.5) * 100)}%` : 'Mute'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PERSONALIZATION ================= */}
        {activeTab === 'personalization' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Personalization</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize wallpapers, picture backgrounds from This PC, system icons, and accent colors</p>
            </div>

            {/* Desktop Background & Wallpaper Fit Controls */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <span>Desktop Background</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Current style: <span className="text-cyan-500 dark:text-cyan-400 font-semibold uppercase">{settings.wallpaper}</span> • Fit:{' '}
                    <span className="text-cyan-500 dark:text-cyan-400 font-semibold uppercase">{settings.wallpaperFit || 'cover'}</span>
                  </p>
                </div>

                {/* Wallpaper Fit Mode Selector */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 dark:bg-black/40 rounded-xl border border-slate-300 dark:border-white/10 self-start sm:self-auto">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 px-2 font-medium">Fit:</span>
                  {(
                    [
                      { id: 'fill', label: 'Fill' },
                      { id: 'fit', label: 'Fit' },
                      { id: 'stretch', label: 'Stretch' },
                      { id: 'center', label: 'Center' },
                    ] as const
                  ).map((fitOption) => {
                    const isSelected = (settings.wallpaperFit || 'fill') === fitOption.id;
                    return (
                      <button
                        key={fitOption.id}
                        onClick={() => {
                          updateSettings({ wallpaperFit: fitOption.id });
                          addNotification({
                            title: 'Wallpaper Fit Updated',
                            message: `Set wallpaper fit to ${fitOption.label}`,
                            type: 'info',
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {fitOption.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mini Desktop Preview Window */}
              <div className="relative aspect-[16/8] sm:aspect-[16/7] w-full rounded-xl overflow-hidden border border-white/20 shadow-lg bg-black flex flex-col justify-between p-3">
                {/* Background Layer Preview */}
                {settings.wallpaper === 'custom' ? (
                  resolvedDesktopWallpaper.includes('youtube.com') || resolvedDesktopWallpaper.includes('youtu.be') ? (
                    <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-xs text-cyan-300 font-bold">
                      YouTube Live Video Wallpaper Active
                    </div>
                  ) : (resolvedDesktopWallpaper.endsWith('.mp4') ||
                      resolvedDesktopWallpaper.endsWith('.webm') ||
                      resolvedDesktopWallpaper.includes('.mp4?') ||
                      resolvedDesktopWallpaper.includes('.webm?') ||
                      resolvedDesktopWallpaper.startsWith('data:video/mp4') ||
                      resolvedDesktopWallpaper.startsWith('data:video/webm') ||
                      resolvedDesktopWallpaper.startsWith('blob:') ||
                      resolvedDesktopWallpaper.includes('/sample/')) &&
                    !resolvedDesktopWallpaper.includes('unsplash.com') &&
                    !resolvedDesktopWallpaper.startsWith('C:/') ? (
                    <video
                      src={resolvedDesktopWallpaper}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                      onError={(e) => {
                        e.stopPropagation();
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <img
                      src={/^(?:file:\/\/|[a-z]:[\\/])/i.test(resolvedDesktopWallpaper) || !resolvedDesktopWallpaper
                        ? '/downloads/Windows_11.jpg'
                        : resolvedDesktopWallpaper}
                      alt="Desktop Preview"
                      referrerPolicy="no-referrer"
                      className={`absolute inset-0 w-full h-full ${
                        settings.wallpaperFit === 'fit'
                          ? 'object-contain'
                          : settings.wallpaperFit === 'stretch'
                          ? 'object-fill'
                          : settings.wallpaperFit === 'center'
                          ? 'object-none'
                          : 'object-cover'
                      }`}
                      onError={(event) => {
                        if (event.currentTarget.src.endsWith('/downloads/Windows_11.jpg')) {
                          event.currentTarget.style.display = 'none';
                        } else {
                          event.currentTarget.src = '/downloads/Windows_11.jpg';
                        }
                      }}
                    />
                  )
                ) : (
                  <div
                    className={`absolute inset-0 ${
                      staticWallpapers.find((w) => w.id === settings.wallpaper)?.preview || 'bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-950'
                    }`}
                  />
                )}

                {/* Preview Desktop Icons */}
                <div className="relative z-10 flex flex-col gap-2 w-16">
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded backdrop-blur-xs">
                    <div className="w-3 h-3 rounded-full bg-cyan-400" />
                    <span className="text-[8px] text-white font-medium truncate">This PC</span>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded backdrop-blur-xs">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span className="text-[8px] text-white font-medium truncate">Browser</span>
                  </div>
                </div>

                {/* Preview Taskbar */}
                <div className="relative z-10 w-full h-5 bg-slate-900/80 backdrop-blur-md rounded-lg border border-white/15 flex items-center justify-between px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-cyan-400" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                  <div className="text-[7px] text-slate-300 font-mono">10:00 AM</div>
                </div>
              </div>
            </div>

            {/* Custom Image & Video Live Wallpaper URL Box */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-gradient-to-r dark:from-[#202020] dark:to-[#252525] border border-slate-200 dark:border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">Custom Wallpaper (Image & Video URL)</h2>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">
                  Image / Video / YouTube
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Set any direct image link (.png, .jpg, Unsplash), direct video file (.mp4, .webm), or YouTube video URL as your desktop wallpaper.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/... or https://example.com/video.mp4 or YouTube URL"
                  value={customLiveUrl}
                  onChange={(e) => setCustomLiveUrl(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-black/40 border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => handleApplyCustomLiveWallpaper()}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 dark:bg-cyan-400 dark:hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-colors shadow cursor-pointer whitespace-nowrap shrink-0"
                >
                  Apply Wallpaper
                </button>
              </div>

              {/* Verified Working Sample Presets */}
              <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sample Wallpapers:</span>
                {sampleLiveUrls.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleApplyCustomLiveWallpaper(s.url)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-600 dark:hover:text-cyan-300 text-[11px] text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-white/10 cursor-pointer flex items-center gap-1"
                  >
                    <Play className="w-2.5 h-2.5 text-cyan-500 dark:text-cyan-400" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Interactive Animated Wallpapers */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 space-y-4">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">Live Interactive Canvas Wallpapers</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {liveWallpapers.map((wp) => (
                  <div
                    key={wp.id}
                    onClick={() => updateSettings({ wallpaper: wp.id })}
                    className={`p-4 rounded-xl bg-gradient-to-br ${wp.bg} border-2 transition-all cursor-pointer relative overflow-hidden group ${
                      settings.wallpaper === wp.id ? 'border-cyan-500 dark:border-cyan-400 ring-2 ring-cyan-400/30' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-black/60 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold backdrop-blur-sm">
                        {wp.badge}
                      </span>
                      {settings.wallpaper === wp.id && (
                        <div className="w-5 h-5 rounded-full bg-cyan-500 dark:bg-cyan-400 text-slate-950 flex items-center justify-center font-bold">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-sm text-white">{wp.title}</div>
                    <div className="text-[11px] text-slate-100 dark:text-slate-300 mt-1">{wp.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* HD Static Wallpapers */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 space-y-4">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">HD Static Wallpapers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {staticWallpapers.map((wp) => (
                  <div
                    key={wp.id}
                    onClick={() => updateSettings({ wallpaper: wp.id })}
                    className={`h-24 rounded-xl ${wp.preview} border-2 transition-all cursor-pointer relative overflow-hidden group ${
                      settings.wallpaper === wp.id ? 'border-cyan-500 dark:border-cyan-400 ring-2 ring-cyan-400/30' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/30'
                    }`}
                  >
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    <span className="absolute bottom-2 left-2 text-xs font-bold text-white drop-shadow">
                      {wp.title}
                    </span>
                    {settings.wallpaper === wp.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-500 dark:bg-cyan-400 text-slate-950 flex items-center justify-center font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Application & Desktop Icon Themes (Two Options: Option 1 with Icon Color Tint vs Option 2 Fluent 3D) */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <span>Desktop & Application Icon Theme</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose between Modern Outline icons (with custom color tinting) or Official Windows 11 Fluent 3D icons
                  </p>
                </div>
              </div>

              {/* Two Core Options (Option 1: Fluent 3D Icons, Option 2: Modern Outline Icons) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Option 1: Windows 11 Fluent 3D Icons */}
                <div
                  onClick={() => updateSettings({ iconStyleMode: 'fluent_3d' })}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                    settings.iconStyleMode === 'fluent_3d'
                      ? 'bg-cyan-500/15 border-cyan-500 dark:border-cyan-400 ring-2 ring-cyan-400/30'
                      : 'bg-white dark:bg-black/30 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">Option 1: Windows 11 Fluent 3D Icons</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-300 text-[10px] font-semibold">
                        Official Artwork
                      </span>
                    </div>
                    {settings.iconStyleMode === 'fluent_3d' && (
                      <div className="w-5 h-5 rounded-full bg-cyan-500 dark:bg-cyan-400 flex items-center justify-center text-slate-950 shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Official Windows 11 multi-layer gradient 3D icons rendered in rich original full-color artwork.
                  </p>
                  {/* Icon Preview Strip */}
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 overflow-x-auto scrollbar-none">
                    <AppIcon appId="explorer" size={24} overrideStyle="fluent_3d" />
                    <AppIcon appId="browser" size={24} overrideStyle="fluent_3d" />
                    <AppIcon appId="notepad" size={24} overrideStyle="fluent_3d" />
                    <AppIcon appId="camera" size={24} overrideStyle="fluent_3d" />
                    <AppIcon appId="settings" size={24} overrideStyle="fluent_3d" />
                    <AppIcon appId="calculator" size={24} overrideStyle="fluent_3d" />
                  </div>
                </div>

                {/* Option 2: Modern Outline Icons with Color Tinting */}
                <div
                  onClick={() => updateSettings({ iconStyleMode: 'outline_tint' })}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                    settings.iconStyleMode !== 'fluent_3d'
                      ? 'bg-cyan-500/15 border-cyan-500 dark:border-cyan-400 ring-2 ring-cyan-400/30'
                      : 'bg-white dark:bg-black/30 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">Option 2: Modern Outline Icons</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-semibold">
                        With Color Tinting
                      </span>
                    </div>
                    {settings.iconStyleMode !== 'fluent_3d' && (
                      <div className="w-5 h-5 rounded-full bg-cyan-500 dark:bg-cyan-400 flex items-center justify-center text-slate-950 shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Sleek minimalist outline icons supporting custom color tints and accent color synchronization.
                  </p>
                  {/* Icon Preview Strip */}
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 overflow-x-auto scrollbar-none">
                    <AppIcon appId="explorer" size={24} overrideStyle="outline" color={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor} />
                    <AppIcon appId="browser" size={24} overrideStyle="outline" color={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor} />
                    <AppIcon appId="notepad" size={24} overrideStyle="outline" color={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor} />
                    <AppIcon appId="camera" size={24} overrideStyle="outline" color={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor} />
                    <AppIcon appId="settings" size={24} overrideStyle="outline" color={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor} />
                    <AppIcon appId="calculator" size={24} overrideStyle="outline" color={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor} />
                  </div>
                </div>
              </div>
            </div>

            {/* Windows Accent Colors */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">System Accent Color</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Controls highlight borders, selections, and window buttons</p>
                </div>
                <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-white/20 shadow" style={{ backgroundColor: settings.accentColor }} />
              </div>
              <div className="flex flex-wrap gap-3">
                {accentColors.map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => handleAccentChange(col.hex)}
                    className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shadow-md cursor-pointer ${
                      settings.accentColor === col.hex ? 'scale-110 ring-2 ring-slate-400 dark:ring-white' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.title}
                  >
                    {settings.accentColor === col.hex && <Check className="w-5 h-5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>

              {/* Custom Accent Color Picker */}
              <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-950 dark:text-white">Custom Accent Color</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">({settings.accentColor})</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={settings.accentColor}
                    onChange={(e) => {
                      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                        handleAccentChange(e.target.value);
                      }
                    }}
                    placeholder="#0078d4"
                    className="w-24 px-2 py-1 bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 rounded-lg text-xs font-mono text-slate-900 dark:text-white uppercase focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Desktop & App Icon Color with Sync with Accent Option (Only for Option 1: Outline Icons) */}
            {settings.iconStyleMode !== 'fluent_3d' && (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Desktop & App Icon Color</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Change presentation color tint of desktop and application icons (including This PC)</p>
                  </div>
                  <div
                    className="w-6 h-6 rounded-full border border-slate-300 dark:border-white/20 shadow"
                    style={{
                      backgroundColor: settings.syncIconColorWithAccent
                        ? settings.accentColor
                        : settings.iconColor || settings.accentColor,
                    }}
                  />
                </div>

                {/* Extra Option: Sync Color with Accent */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-cyan-500/20">
                  <div className="flex items-center gap-3">
                    <Link className={`w-4 h-4 ${settings.syncIconColorWithAccent ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">Sync Icon Color with Accent</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Icons automatically match your system accent color whenever it changes
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleSyncWithAccent}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.syncIconColorWithAccent ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        settings.syncIconColorWithAccent ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Color Presets */}
                <div className="flex flex-wrap gap-3 pt-1">
                  {iconColorsList.map((col) => {
                    const currentColor = settings.syncIconColorWithAccent
                      ? settings.accentColor
                      : settings.iconColor || settings.accentColor;
                    const isCurrent = currentColor.toLowerCase() === col.hex.toLowerCase();

                    return (
                      <button
                        key={col.hex}
                        onClick={() => {
                          updateSettings({ iconColor: col.hex, syncIconColorWithAccent: false });
                        }}
                        className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shadow-md cursor-pointer border ${
                          isCurrent ? 'scale-110 ring-2 ring-cyan-500 border-white' : 'border-white/10 hover:scale-105'
                        }`}
                        style={{ backgroundColor: col.hex }}
                        title={col.title}
                      >
                        {isCurrent && <Check className="w-5 h-5 text-slate-950 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Icon Color Picker */}
                <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">Custom Icon Color</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      ({settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor}
                      onChange={(e) => {
                        updateSettings({ iconColor: e.target.value, syncIconColorWithAccent: false });
                      }}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={settings.syncIconColorWithAccent ? settings.accentColor : settings.iconColor || settings.accentColor}
                      onChange={(e) => {
                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                          updateSettings({ iconColor: e.target.value, syncIconColorWithAccent: false });
                        }
                      }}
                      placeholder="#0078d4"
                      className="w-24 px-2 py-1 bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 rounded-lg text-xs font-mono text-slate-900 dark:text-white uppercase focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Browse All This PC Files to Select Wallpaper */}
            {browsePcModal && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-xl bg-white dark:bg-[#222222] border border-slate-200 dark:border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">Browse This PC for Desktop Background</h3>
                    </div>
                    <button
                      onClick={() => setBrowsePcModal(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 overflow-y-auto space-y-2 flex-1">
                    {systemImageFiles.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">No images found on This PC</p>
                    ) : (
                      systemImageFiles.map((fileItem) => (
                        <div
                          key={fileItem.id}
                          onClick={() => {
                            handleSetImageAsBackground(fileItem);
                            setBrowsePcModal(false);
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 hover:bg-cyan-500/15 border border-slate-200 dark:border-white/10 hover:border-cyan-400 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={fileItem.content}
                              alt={fileItem.name}
                              referrerPolicy="no-referrer"
                              className="w-12 h-9 object-cover rounded-lg border border-slate-200 dark:border-white/10"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{fileItem.name}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{fileItem.path}</p>
                            </div>
                          </div>
                          <button className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                            Set as Background
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
                    <button
                      onClick={() => setBrowsePcModal(false)}
                      className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB: TASKBAR ================= */}
        {activeTab === 'taskbar' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Taskbar Settings</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize taskbar alignment, clock date formats, location widgets, and tray icons</p>
            </div>

            {/* 1. Taskbar Behaviors */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4 sm:space-y-5">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">Taskbar Behaviors</h2>

              {/* Taskbar Alignment */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">Taskbar Alignment</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Position the Start button and apps in the center or on the left</div>
                </div>
                <div className="flex gap-2 bg-slate-200/80 dark:bg-[#181818] p-1 rounded-xl border border-slate-300 dark:border-white/10 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => updateSettings({ taskbarAlignment: 'center' })}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                      settings.taskbarAlignment === 'center' ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Center
                  </button>
                  <button
                    onClick={() => updateSettings({ taskbarAlignment: 'left' })}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                      settings.taskbarAlignment === 'left' ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Left
                  </button>
                </div>
              </div>

              {/* Automatically Hide Taskbar */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/5">
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">Automatically Hide the Taskbar</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Hide the taskbar when not hovering near the screen bottom</div>
                </div>
                <button
                  onClick={() => updateSettings({ taskbarAutoHide: !settings.taskbarAutoHide })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.taskbarAutoHide ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      settings.taskbarAutoHide ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 2. Weather & Widgets & Location Control */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">Weather & Location Permission</h2>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Weather & Widgets Pill</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Show live weather and temperature on the taskbar</div>
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ showWidgetsOnTaskbar: settings.showWidgetsOnTaskbar === false ? true : false })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.showWidgetsOnTaskbar !== false ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      settings.showWidgetsOnTaskbar !== false ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Exact Location Update on Demand (No startup popups) */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-cyan-550 dark:text-cyan-400" />
                    <div>
                      <div className="text-xs text-slate-900 dark:text-white font-medium">Active Weather City: <span className="text-cyan-600 dark:text-cyan-400 font-bold">{locationStatus}</span></div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Select your city or detect GPS on demand.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                    {isDetectingLocation ? 'Detecting...' : 'Detect Exact GPS'}
                  </button>
                </div>

                {/* Quick City Presets */}
                <div className="pt-2 border-t border-slate-200 dark:border-white/5">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">City Presets:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cityPresets.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => handleSelectCity(c)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          locationStatus.toLowerCase() === c.name.toLowerCase()
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Date & Time Formats */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                <Calendar className="w-4 h-4 text-cyan-550 dark:text-cyan-400" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">Date & Clock Formats</h2>
              </div>

              {/* Date Format Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900 dark:text-white">Select Date Format</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {dateFormats.map((fmt) => {
                    const isSelected = (settings.dateFormat || 'DD/MM/YYYY') === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        onClick={() => updateSettings({ dateFormat: fmt.id as any })}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col gap-0.5 ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 ring-1 ring-cyan-400 text-cyan-900 dark:text-white'
                            : 'bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{fmt.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 stroke-[3]" />}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{fmt.example}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clock 12h / 24h & Seconds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <span className="text-xs text-slate-900 dark:text-white font-semibold">Time Display</span>
                  <div className="flex gap-2 bg-slate-100 dark:bg-[#141414] p-1 rounded-xl border border-slate-200 dark:border-white/10 shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => updateSettings({ clockFormat: '12h' })}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                        settings.clockFormat === '12h' ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      12-Hour
                    </button>
                    <button
                      onClick={() => updateSettings({ clockFormat: '24h' })}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                        settings.clockFormat === '24h' ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      24-Hour
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div>
                    <div className="text-xs text-slate-900 dark:text-white font-semibold">Seconds in Clock</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Display HH:MM:SS</div>
                  </div>
                  <button
                    onClick={() => updateSettings({ showSecondsInClock: !settings.showSecondsInClock })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.showSecondsInClock ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        settings.showSecondsInClock ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Mobile View Date in Status Bar Toggle (Visible only in mobile view) */}
                <div className="flex sm:hidden items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div>
                    <div className="text-xs text-slate-900 dark:text-white font-semibold flex items-center gap-1.5">
                      <span>Date on Mobile Status Bar</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                        Mobile Only
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Show or hide current date in top mobile status bar
                    </div>
                  </div>
                  <button
                    onClick={() => updateSettings({ showDateOnMobileStatusBar: !settings.showDateOnMobileStatusBar })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.showDateOnMobileStatusBar ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        settings.showDateOnMobileStatusBar ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Taskbar Search & System Tray Items */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">System Tray & Search</h2>

              {/* Search on Taskbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Search Appearance</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Choose how search appears on taskbar</div>
                  </div>
                </div>
                <select
                  value={settings.showSearchOnTaskbar || 'icon'}
                  onChange={(e) => updateSettings({ showSearchOnTaskbar: e.target.value as any })}
                  className="w-full sm:w-auto bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="box" className="bg-white dark:bg-[#181818] text-slate-900 dark:text-white">Search box / Mobile search</option>
                  <option value="icon" className="bg-white dark:bg-[#181818] text-slate-900 dark:text-white">Search icon only</option>
                  <option value="hide" className="bg-white dark:bg-[#181818] text-slate-900 dark:text-white">Hide search</option>
                </select>
              </div>

              {/* Tray Indicators Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Wifi className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-xs text-slate-900 dark:text-white font-medium">Wi-Fi Indicator</span>
                  </div>
                  <button
                    onClick={() => updateSettings({ showWifiOnTaskbar: settings.showWifiOnTaskbar === false ? true : false })}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.showWifiOnTaskbar !== false ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showWifiOnTaskbar !== false ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs text-slate-900 dark:text-white font-medium">Volume Indicator</span>
                  </div>
                  <button
                    onClick={() => updateSettings({ showSoundOnTaskbar: settings.showSoundOnTaskbar === false ? true : false })}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.showSoundOnTaskbar !== false ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showSoundOnTaskbar !== false ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Battery className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-xs text-slate-900 dark:text-white font-medium">Battery Status</span>
                  </div>
                  <button
                    onClick={() => updateSettings({ showBatteryOnTaskbar: settings.showBatteryOnTaskbar === false ? true : false })}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.showBatteryOnTaskbar !== false ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showBatteryOnTaskbar !== false ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    <span className="text-xs text-slate-900 dark:text-white font-medium">Notification Bell</span>
                  </div>
                  <button
                    onClick={() => updateSettings({ showNotificationsOnTaskbar: settings.showNotificationsOnTaskbar === false ? true : false })}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.showNotificationsOnTaskbar !== false ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showNotificationsOnTaskbar !== false ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: SYSTEM & DISPLAY ================= */}
        {activeTab === 'system' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">System & Display</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Display brightness, sound audio settings, and device specifications</p>
            </div>

            {/* Display Brightness Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-cyan-550 dark:text-cyan-400" />
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Display Brightness</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Control system screen brightness level</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">{Math.round((settings.brightness ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={Math.round((settings.brightness ?? 1) * 100)}
                onChange={(e) => updateSettings({ brightness: parseInt(e.target.value) / 100 })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Sound & Audio Feedback Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Sound & Audio Effects</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Master output volume and system audio notifications</p>
                  </div>
                </div>

                <button
                  onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    settings.soundEnabled ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}
                >
                  {settings.soundEnabled ? 'Enabled' : 'Muted'}
                </button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                {settings.soundEnabled && (settings.soundVolume ?? 0.5) > 0 ? (
                  <Volume2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-red-500 dark:text-red-400" />
                )}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.soundEnabled ? Math.round((settings.soundVolume ?? 0.5) * 100) : 0}
                  onChange={(e) => updateSettings({ soundVolume: parseInt(e.target.value) / 100, soundEnabled: parseInt(e.target.value) > 0 })}
                  className="flex-1 accent-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium w-12 text-right">
                  {settings.soundEnabled ? `${Math.round((settings.soundVolume ?? 0.5) * 100)}%` : 'Muted'}
                </span>
              </div>

              {/* System Action Sounds Row */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-slate-850 dark:text-slate-200">System Action Sounds</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Feedback for refresh, copy, cut, paste, share, and file actions</p>
                  </div>
                </div>

                <button
                  onClick={() => updateSettings({ systemActionSoundsEnabled: settings.systemActionSoundsEnabled === false ? true : false })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    settings.systemActionSoundsEnabled !== false ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'bg-slate-200/50 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {settings.systemActionSoundsEnabled !== false ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            {/* Touch, Mobile & Tablet Gestures Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <Sliders className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Touch, Mobile & Tablet Controls</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Configure haptic vibration, mobile viewport simulation, and touch gestures</p>
                  </div>
                </div>
              </div>

              {/* Explanatory Info Banner */}
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <span className="font-bold text-indigo-950 dark:text-white block mb-0.5">About Touch & Tablet Controls:</span>
                These settings optimize your Web OS for touchscreen laptops, iPads, tablets, and mobile smartphones. They enable real-time tactile vibrations during window snapping, customize touch keyboard availability, and allow switching between desktop and mobile portrait aspect ratios.
              </div>

              <div className="space-y-3">
                {/* Haptic Feedback */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Haptic Vibration Feedback</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${settings.hapticsEnabled !== false ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                        {settings.hapticsEnabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Generates physical device vibrations on mobile/touch screens when snapping windows, opening menus, and tapping buttons.
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                          navigator.vibrate([40, 30, 40]);
                        }
                        try {
                          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                          const osc = ctx.createOscillator();
                          const gain = ctx.createGain();
                          osc.type = 'sine';
                          osc.frequency.setValueAtTime(150, ctx.currentTime);
                          osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
                          gain.gain.setValueAtTime(0.3, ctx.currentTime);
                          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
                          osc.connect(gain);
                          gain.connect(ctx.destination);
                          osc.start();
                          osc.stop(ctx.currentTime + 0.09);
                        } catch {}

                        addNotification({
                          title: 'Haptic Vibration Pulse',
                          message: 'Simulated a tactile haptic pulse.',
                          type: 'info',
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                      title="Test physical vibration"
                    >
                      Test Pulse
                    </button>

                    <button
                      onClick={() => {
                        const next = settings.hapticsEnabled === false ? true : false;
                        updateSettings({ hapticsEnabled: next });
                        addNotification({
                          title: next ? 'Haptics Enabled' : 'Haptics Disabled',
                          message: next ? 'Tactile vibration feedback turned on.' : 'Haptic vibration turned off.',
                          type: 'info',
                        });
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        settings.hapticsEnabled !== false ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                          settings.hapticsEnabled !== false ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Lock Portrait */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Lock Mobile Portrait Mode</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${settings.lockPortrait ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                        {settings.lockPortrait ? 'Locked (Portrait)' : 'Adaptive'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Locks mobile and tablet app windows into full-height single-column vertical orientation, preventing accidental horizontal landscape rotation.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const next = !settings.lockPortrait;
                      updateSettings({ lockPortrait: next });
                      addNotification({
                        title: next ? 'Portrait Mode Locked' : 'Adaptive Rotation Enabled',
                        message: next ? 'Apps locked to vertical mobile stack.' : 'Free responsive orientation restored.',
                        type: 'info',
                      });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer self-end sm:self-center shrink-0 ${
                      settings.lockPortrait ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        settings.lockPortrait ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Touch Keyboard Shortcut */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Virtual Touch Keyboard Button</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${settings.showTouchKeyboardOnTaskbar ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                        {settings.showTouchKeyboardOnTaskbar ? 'Shown in Tray' : 'Hidden'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Places an on-screen keyboard icon in the taskbar notification tray for quick one-tap text entry on tablet touchscreens.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const next = !settings.showTouchKeyboardOnTaskbar;
                      updateSettings({ showTouchKeyboardOnTaskbar: next });
                      addNotification({
                        title: next ? 'Touch Keyboard Enabled' : 'Touch Keyboard Hidden',
                        message: next ? 'Virtual keyboard button added to taskbar tray.' : 'Removed from taskbar tray.',
                        type: 'info',
                      });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer self-end sm:self-center shrink-0 ${
                      settings.showTouchKeyboardOnTaskbar ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        settings.showTouchKeyboardOnTaskbar ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Network & Wi-Fi Configuration Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <Wifi className="w-5 h-5 text-cyan-550 dark:text-cyan-400" />
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Network & Wi-Fi</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Manage Wi-Fi network connection</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = settings.wifiEnabled === false ? true : false;
                    updateSettings({ wifiEnabled: next });
                    addNotification({
                      title: next ? 'Wi-Fi Connected' : 'Wi-Fi Disconnected',
                      message: next ? 'Connected to Network.' : 'Wi-Fi adapter disabled.',
                      type: 'info',
                    });
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.wifiEnabled !== false ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      settings.wifiEnabled !== false ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Wi-Fi Status & Connect Action */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      settings.wifiEnabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {settings.wifiEnabled !== false ? 'Connected' : 'Disconnected'}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {settings.wifiEnabled !== false ? 'Internet access available' : 'No network connection'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const next = settings.wifiEnabled === false ? true : false;
                    updateSettings({ wifiEnabled: next });
                    addNotification({
                      title: next ? 'Wi-Fi Connected' : 'Wi-Fi Disconnected',
                      message: next ? 'Connected to Network.' : 'Wi-Fi adapter disconnected.',
                      type: next ? 'success' : 'info',
                    });
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    settings.wifiEnabled !== false
                      ? 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
                  }`}
                >
                  {settings.wifiEnabled !== false ? 'Disconnect' : 'Connect'}
                </button>
              </div>

              {/* Technical properties */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[10px] text-slate-500 dark:text-slate-400">
                <div className="p-2 rounded-lg bg-white dark:bg-[#222222] border border-slate-200 dark:border-0">
                  <span className="block text-slate-400 dark:text-slate-500">Protocol</span>
                  <span className="text-slate-800 dark:text-white font-medium">Wi-Fi 6 (802.11ax)</span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#222222] border border-slate-200 dark:border-0">
                  <span className="block text-slate-400 dark:text-slate-500">Band</span>
                  <span className="text-slate-800 dark:text-white font-medium">5.0 GHz (Channel 48)</span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#222222] border border-slate-200 dark:border-0">
                  <span className="block text-slate-400 dark:text-slate-500">Link Speed</span>
                  <span className="text-slate-800 dark:text-white font-medium">866 / 866 (Mbps)</span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#222222] border border-slate-200 dark:border-0">
                  <span className="block text-slate-400 dark:text-slate-500">Security</span>
                  <span className="text-slate-800 dark:text-white font-medium">WPA3-Personal</span>
                </div>
              </div>
            </div>

            {/* System Specifications Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <Laptop className="w-5 h-5 text-cyan-550 dark:text-cyan-400" />
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Device Specifications</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Web Operating System Host Information</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-xs font-bold">
                  {pcName}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Developer / Owner</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentUser.name}</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5">
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Edition</span>
                  <span className="font-bold text-slate-900 dark:text-white">Windows 11 Portfolio Pro (Web Edition)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: APPS & DESKTOP SHORTCUTS ================= */}
        {activeTab === 'apps' && (
          <div className="space-y-6 max-w-4xl">
            {/* Header and Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                  Apps & Desktop Shortcuts Manager
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage which applications appear on your Desktop, Taskbar, and Start Menu, or create custom app shortcuts.
                </p>
              </div>

              <button
                onClick={() => setCustomShortcutModal(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Add Custom Shortcut
              </button>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Desktop Shortcuts</div>
                  <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">{desktopIcons.length} active</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Monitor className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Taskbar Pinned</div>
                  <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{pinnedAppIds.length} pinned</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <PanelBottom className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Start Menu Pinned</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{startPinnedAppIds.length} pinned</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">Quick Actions:</span>
              <button
                onClick={() => {
                  (apps || []).forEach((app, idx) => {
                    if (!desktopIcons.some((i) => i.appId === app.id)) {
                      addOrMoveDesktopIcon({
                        id: `icon-${app.id}-${Date.now()}-${idx}`,
                        appId: app.id as any,
                        name: app.name,
                        icon: app.icon || 'Code2',
                        position: { gridX: Math.floor((desktopIcons.length + idx) / 5), gridY: (desktopIcons.length + idx) % 5 },
                        type: 'app',
                      });
                    }
                  });
                  addNotification({
                    title: 'All Shortcuts Added',
                    message: 'Placed all application shortcuts onto your desktop.',
                    type: 'success',
                  });
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-0 hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-500" />
                Add All to Desktop
              </button>

              <button
                onClick={() => {
                  const essentialAppIds = ['explorer', 'recycle', 'about', 'projects'];
                  desktopIcons.forEach((icon) => {
                    if (icon.appId && !essentialAppIds.includes(icon.appId)) {
                      deleteDesktopIcon(icon.id);
                    }
                  });
                  addNotification({
                    title: 'Desktop Cleaned',
                    message: 'Removed non-essential app shortcuts from Desktop.',
                    type: 'info',
                  });
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-0 hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-550 dark:text-amber-400" />
                Keep Essentials Only
              </button>

              <button
                onClick={() => sortDesktopIcons('name')}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-0 hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-550 dark:text-emerald-400" />
                Auto-Arrange Grid
              </button>
            </div>

            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter applications or shortcuts..."
                  value={appSearchFilter}
                  onChange={(e) => setAppSearchFilter(e.target.value)}
                  className="w-full bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white pl-9 pr-3 py-2 rounded-xl outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#181818] p-1 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
                {['all', 'portfolio', 'system', 'utilities', 'games'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAppsCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                      appsCategoryFilter === cat ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Applications List */}
            <div className="space-y-3">
              {(apps || [])
                .filter((app) => {
                  const matchesSearch = app.name.toLowerCase().includes(appSearchFilter.toLowerCase()) || app.category.toLowerCase().includes(appSearchFilter.toLowerCase());
                  if (!matchesSearch) return false;
                  if (appsCategoryFilter === 'all') return true;
                  if (appsCategoryFilter === 'portfolio') return ['portfolio', 'profile'].includes(app.category.toLowerCase());
                  if (appsCategoryFilter === 'system') return ['system', 'settings'].includes(app.category.toLowerCase());
                  if (appsCategoryFilter === 'utilities') return ['productivity', 'utility', 'media'].includes(app.category.toLowerCase());
                  if (appsCategoryFilter === 'games') return ['games', 'fun'].includes(app.category.toLowerCase());
                  return true;
                })
                .map((app) => {
                  const hasDesktopShortcut = desktopIcons.some((i) => i.appId === app.id);
                  const isTaskbarPinned = pinnedAppIds.includes(app.id as AppId);
                  const isStartPinned = startPinnedAppIds.includes(app.id as AppId);

                  return (
                    <div
                      key={app.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* App Info */}
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#1c1c1c] border border-slate-300 dark:border-white/10 flex items-center justify-center font-bold text-cyan-600 dark:text-cyan-400 shrink-0 shadow-inner">
                          <Code2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                            {app.name}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-normal">
                              {app.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            ID: <span className="font-mono text-slate-600 dark:text-slate-300">{app.id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Placement Toggles */}
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Desktop Shortcut Toggle */}
                        <div className="flex items-center gap-2 bg-white dark:bg-[#181818] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5">
                          <Monitor className="w-3.5 h-3.5 text-cyan-550 dark:text-cyan-400" />
                          <span className="text-[11px] text-slate-700 dark:text-slate-300">Desktop</span>
                          <button
                            onClick={() => {
                              if (hasDesktopShortcut) {
                                const target = desktopIcons.find((i) => i.appId === app.id);
                                if (target) deleteDesktopIcon(target.id);
                                addNotification({
                                  title: 'Shortcut Removed',
                                  message: `Removed "${app.name}" from Desktop.`,
                                  type: 'info',
                                });
                              } else {
                                const newIcon: DesktopIconItem = {
                                  id: `icon-${app.id}-${Date.now()}`,
                                  appId: app.id as any,
                                  name: app.name,
                                  icon: app.icon || 'Code2',
                                  position: { gridX: Math.floor(desktopIcons.length / 5), gridY: desktopIcons.length % 5 },
                                  type: 'app',
                                };
                                addOrMoveDesktopIcon(newIcon);
                                addNotification({
                                  title: 'Shortcut Added',
                                  message: `Added "${app.name}" shortcut to Desktop.`,
                                  type: 'success',
                                });
                              }
                            }}
                            className={`w-9 h-4.5 rounded-full transition-colors relative cursor-pointer ${
                              hasDesktopShortcut ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/20'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${
                                hasDesktopShortcut ? 'right-0.5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Taskbar Pin Toggle */}
                        <div className="flex items-center gap-2 bg-white dark:bg-[#181818] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5">
                          <PanelBottom className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                          <span className="text-[11px] text-slate-700 dark:text-slate-300">Taskbar</span>
                          <button
                            onClick={() => {
                              if (isTaskbarPinned) {
                                unpinFromTaskbar(app.id as AppId);
                              } else {
                                pinToTaskbar(app.id as AppId);
                              }
                            }}
                            className={`w-9 h-4.5 rounded-full transition-colors relative cursor-pointer ${
                              isTaskbarPinned ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-white/20'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${
                                isTaskbarPinned ? 'right-0.5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Start Menu Pin Toggle */}
                        <div className="flex items-center gap-2 bg-white dark:bg-[#181818] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-550 dark:text-emerald-400" />
                          <span className="text-[11px] text-slate-700 dark:text-slate-300">Start</span>
                          <button
                            onClick={() => {
                              if (isStartPinned) {
                                unpinFromStart(app.id as AppId);
                              } else {
                                pinToStart(app.id as AppId);
                              }
                            }}
                            className={`w-9 h-4.5 rounded-full transition-colors relative cursor-pointer ${
                              isStartPinned ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${
                                isStartPinned ? 'right-0.5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Open App Button */}
                        <button
                          onClick={() => openApp(app.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-cyan-500 hover:text-slate-950 text-xs font-semibold text-slate-800 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-cyan-500 dark:hover:text-slate-950 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Launch
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Custom Shortcut Creation Modal */}
            {customShortcutModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                      <Plus className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                      Create Custom Desktop Shortcut
                    </div>
                    <button
                      onClick={() => setCustomShortcutModal(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Shortcut Label</label>
                      <input
                        type="text"
                        placeholder="e.g. My GitHub, Live Demo, Notes..."
                        value={newShortcutName}
                        onChange={(e) => setNewShortcutName(e.target.value)}
                        className="w-full bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewShortcutTargetType('app')}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                            newShortcutTargetType === 'app'
                              ? 'bg-cyan-50 dark:bg-cyan-500/20 border-cyan-500 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300'
                              : 'bg-slate-50 dark:bg-[#181818] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          System App
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewShortcutTargetType('url')}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                            newShortcutTargetType === 'url'
                              ? 'bg-cyan-50 dark:bg-cyan-500/20 border-cyan-500 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300'
                              : 'bg-slate-50 dark:bg-[#181818] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          Web URL
                        </button>
                      </div>
                    </div>

                    {newShortcutTargetType === 'app' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Application</label>
                        <select
                          value={newShortcutTargetApp}
                          onChange={(e) => setNewShortcutTargetApp(e.target.value as AppId)}
                          className="w-full bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          {(apps || []).map((app) => (
                            <option key={app.id} value={app.id} className="bg-white dark:bg-[#181818] text-slate-900 dark:text-white">
                              {app.name} ({app.category})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Destination Web URL</label>
                        <input
                          type="text"
                          placeholder="https://github.com/your-username"
                          value={newShortcutUrl}
                          onChange={(e) => setNewShortcutUrl(e.target.value)}
                          className="w-full bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Choose Icon</label>
                      <div className="flex flex-wrap gap-2">
                        {['Sparkles', 'Globe', 'Terminal', 'Code2', 'Folder', 'FileText', 'Monitor', 'Camera'].map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setNewShortcutIcon(ic)}
                            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                              newShortcutIcon === ic
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                                : 'bg-slate-50 dark:bg-[#181818] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/30'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setCustomShortcutModal(false)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newShortcutName.trim()) {
                          addNotification({
                            title: 'Shortcut Name Required',
                            message: 'Please provide a name for the desktop shortcut.',
                            type: 'warning',
                          });
                          return;
                        }

                        if (newShortcutTargetType === 'app') {
                          const targetApp = apps.find((a) => a.id === newShortcutTargetApp);
                          addOrMoveDesktopIcon({
                            id: `custom-${newShortcutTargetApp}-${Date.now()}`,
                            appId: newShortcutTargetApp,
                            name: newShortcutName.trim(),
                            icon: newShortcutIcon || targetApp?.icon || 'Sparkles',
                            position: { gridX: Math.floor(desktopIcons.length / 5), gridY: desktopIcons.length % 5 },
                            type: 'app',
                          });
                        } else {
                          addOrMoveDesktopIcon({
                            id: `custom-link-${Date.now()}`,
                            appId: 'browser',
                            name: newShortcutName.trim(),
                            icon: newShortcutIcon || 'Globe',
                            position: { gridX: Math.floor(desktopIcons.length / 5), gridY: desktopIcons.length % 5 },
                            type: 'app',
                          });
                        }

                        setCustomShortcutModal(false);
                        setNewShortcutName('');
                        setNewShortcutUrl('');
                        addNotification({
                          title: 'Shortcut Created',
                          message: `Placed shortcut "${newShortcutName}" on Desktop.`,
                          type: 'success',
                        });
                      }}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Create Shortcut
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: ABOUT DEVELOPER ================= */}
        {activeTab === 'about' && (
          <div className="space-y-6 max-w-4xl">
            <div className={`p-6 rounded-2xl border space-y-4 ${
              settings.theme === 'light'
                ? 'bg-white border-slate-200 text-slate-800 shadow-xs'
                : 'bg-gradient-to-r from-slate-900 via-[#1a2333] to-slate-900 border-cyan-500/30'
            }`}>
              <div className="flex items-center gap-4">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/avatar.png';
                    }}
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-cyan-500/40 shadow-xl shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-2xl text-white shadow-xl">
                    AJ
                  </div>
                )}
                <div>
                  <h1 className={`text-2xl font-bold ${settings.theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{currentUser.name}</h1>
                  <p className="text-sm text-cyan-600 dark:text-cyan-400 font-semibold">{currentUser.title}</p>
                  <p className={`text-xs ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{currentUser.location}</p>
                </div>
              </div>

              <p className={`text-xs leading-relaxed ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                {currentUser.bio}
              </p>

              <div className={`flex flex-wrap gap-2 pt-2 border-t ${settings.theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                <button
                  onClick={() => openApp('about')}
                  className={`px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                    settings.theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold'
                      : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
                  }`}
                >
                  <User className="w-3.5 h-3.5" /> About
                </button>
                <button
                  onClick={() => openApp('projects')}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Briefcase className="w-3.5 h-3.5" /> Explore Projects
                </button>
                <button
                  onClick={() => openApp('contact')}
                  className={`px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                    settings.theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold'
                      : 'bg-white/10 hover:bg-white/20 text-white font-semibold'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Send Message
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
