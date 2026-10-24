import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AppId,
  AppMetadata,
  WindowState,
  SystemSettings,
  NotificationItem,
  FileItem,
  DesktopIconItem,
  ProcessMetric,
  ContextMenuType,
  ClipboardItem,
  PropertiesTarget,
  ContactSubmissionPayload,
  ContactSubmissionResponse,
  VirtualDesktop,
  ClipboardHistoryEntry,
} from '../types';
import { APPS_LIST, PORTFOLIO_USER } from '../data/portfolioData';
import { INITIAL_FILES } from '../data/initialFileSystem';
import { soundManager } from '../utils/sound';
import { storageService } from '../services/storageService';
import { captureStorageService } from '../services/captureStorageService';
import { haptics } from '../utils/haptics';
import { DEFAULT_TIME_ZONE, formatDateISO, formatTime } from '../utils/dateTime';
import { trackPortfolioAnalytics } from '../utils/analytics';
import {
  D_DRIVE_FOLDER_PATHS,
  normalizeVirtualDriveFiles,
  isMarkedDocumentsDemoFile,
  normalizeVfsDestinationPath,
} from '../utils/virtualDDrive';
import { apiFetch } from '../utils/apiClient';

interface OSContextType {
  // Windows
  windows: WindowState[];
  activeWindowId: string | null;
  openApp: (appId: AppId, args?: Record<string, any>, forceNewWindow?: boolean) => void;
  closeWindow: (id: string) => void;
  registerWindowCloseGuard: (id: string, guard: () => Promise<boolean>) => () => void;
  closeAllWindows: () => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;
  snapWindow: (
    id: string,
    layout:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'three-col-left'
      | 'three-col-center'
      | 'three-col-right'
      | 'restore'
  ) => void;
  showDesktop: () => void;

  // Virtual Desktops
  desktops: VirtualDesktop[];
  currentDesktopId: string;
  createDesktop: () => void;
  removeDesktop: (id: string) => void;
  switchDesktop: (id: string) => void;
  renameDesktop: (id: string, newName: string) => void;
  moveWindowToDesktop: (windowId: string, desktopId: string) => void;
  isTaskViewOpen: boolean;
  toggleTaskView: () => void;
  closeTaskView: () => void;

  // Clipboard History
  clipboardHistory: ClipboardHistoryEntry[];
  addClipboardHistory: (item: Omit<ClipboardHistoryEntry, 'id' | 'timestamp'>) => void;
  removeClipboardHistory: (id: string) => void;
  clearClipboardHistory: () => void;
  togglePinClipboardItem: (id: string) => void;
  isClipboardOpen: boolean;
  toggleClipboard: () => void;
  closeClipboard: () => void;

  // Snipping Tool Overlay
  isSnippingOpen: boolean;
  openSnipping: () => void;
  closeSnipping: () => void;

  // Xbox Game Bar Overlay
  isGameBarOpen: boolean;
  toggleGameBar: () => void;
  closeGameBar: () => void;

  // Alt+Tab Switcher
  isAltTabOpen: boolean;
  openAltTab: () => void;
  closeAltTab: () => void;

  // Widgets Board
  isWidgetsOpen: boolean;
  toggleWidgets: () => void;
  closeWidgets: () => void;

  // Context Menu
  contextMenu: ContextMenuType;
  showContextMenu: (menu: ContextMenuType) => void;
  closeContextMenu: () => void;

  // Clipboard
  clipboard: ClipboardItem | null;
  copyFile: (file: FileItem | FileItem[]) => void;
  cutFile: (file: FileItem | FileItem[]) => void;
  copyFiles: (files: FileItem[]) => void;
  cutFiles: (files: FileItem[]) => void;
  pasteFile: (targetPath: string) => void;

  // Pinned Taskbar Apps
  pinnedAppIds: AppId[];
  pinToTaskbar: (appId: AppId) => void;
  unpinFromTaskbar: (appId: AppId) => void;
  reorderPinnedApps: (newOrder: AppId[]) => void;

  // Pinned Start Menu Apps
  startPinnedAppIds: AppId[];
  pinToStart: (appId: AppId) => void;
  unpinFromStart: (appId: AppId) => void;
  togglePinToStart: (appId: AppId) => void;
  isPinnedToStart: (appId: AppId) => boolean;

  // Properties Modal
  propertiesTarget: PropertiesTarget | null;
  openProperties: (target: PropertiesTarget) => void;
  closeProperties: () => void;

  // Power State
  powerState: 'normal' | 'sleep' | 'shutdown' | 'restart' | 'off';
  setPowerState: (state: 'normal' | 'sleep' | 'shutdown' | 'restart' | 'off') => void;

  // Settings
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  apps: AppMetadata[];
  hiddenAppIds: AppId[];
  updateHiddenAppIds: (appIds: AppId[]) => void;
  adminAppEnabledInStart: boolean;
  setAdminAppEnabledInStart: (enabled: boolean) => void;
  applyPublishedAppLayout: (layout: {
    desktopShortcuts?: DesktopIconItem[];
    taskbarPinnedApps?: string[];
    startPinnedApps?: string[];
    adminAppEnabledInStart?: boolean;
  }) => void;

  // Start & Search & Tray & Notifications
  isStartOpen: boolean;
  toggleStart: () => void;
  closeStart: () => void;
  isSearchOpen: boolean;
  toggleSearch: () => void;
  closeSearch: () => void;
  isNotificationsOpen: boolean;
  toggleNotifications: () => void;
  closeNotifications: () => void;
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  clearNotifications: () => void;
  markNotificationRead: (id: string) => void;
  activeTrayPanel: 'wifi' | 'volume' | 'battery' | 'calendar' | null;
  toggleTrayPanel: (panel: 'wifi' | 'volume' | 'battery' | 'calendar') => void;
  closeTrayPanels: () => void;

  // File System & Desktop Icons
  files: FileItem[];
  deletedFiles: FileItem[];
  desktopIcons: DesktopIconItem[];
  driveLabels: Record<string, string>;
  updateDriveLabel: (drivePath: string, newLabel: string) => void;
  createFolder: (parentPath: string, name: string) => void;
  createFile: (parentPath: string, name: string, content?: string, extension?: FileItem['extension'], metadata?: Partial<FileItem>) => void;
  deleteFile: (id: string) => void;
  deleteFiles: (ids: string[]) => void;
  restoreFile: (id: string) => void;
  deletePermanently: (id: string) => void;
  emptyRecycleBin: () => void;
  updateDesktopIconPosition: (id: string, position: { gridX: number; gridY: number }) => void;
  addOrMoveDesktopIcon: (icon: DesktopIconItem) => void;
  renameDesktopIcon: (id: string, newName: string) => void;
  deleteDesktopIcon: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  moveFile: (id: string, targetParentPath: string) => void;
  updateFileContent: (id: string, content: string) => void;
  updateFileAttributes: (idOrPath: string, updates: Partial<FileItem>) => void;
  compressToZip: (items: FileItem[] | FileItem, targetParentPath?: string) => void;
  extractZip: (zipFile: FileItem, targetParentPath?: string) => void;
  sortDesktopIcons: (by: 'name' | 'size' | 'type' | 'date') => void;
  uploadFileToVFS: (targetFolder: string, file: File) => Promise<FileItem>;
  saveMediaFile: (folderPath: string, fileName: string, dataUrl: string, extension: FileItem['extension']) => void;
  resetVFS: () => Promise<void>;
  exportVFSBackup: () => void;
  refreshFileSystem: (targetPath?: string) => Promise<void>;

  // Task Manager & Processes
  processes: ProcessMetric[];
  endProcess: (appId: AppId) => void;

  // Easter Eggs
  isBsod: boolean;
  triggerBsod: () => void;
  dismissBsod: () => void;
  isMatrixMode: boolean;
  toggleMatrixMode: () => void;

  // Touch & Mobile / Tablet Optimizations
  isTouchKeyboardOpen: boolean;
  openTouchKeyboard: () => void;
  closeTouchKeyboard: () => void;
  toggleTouchKeyboard: () => void;
  orientation: 'portrait' | 'landscape';
  isGlobalLoading: boolean;
  globalProgress?: number;
  triggerLoading: (durationMs?: number) => void;

  // Contact System API
  sendContactMessage: (payload: ContactSubmissionPayload) => Promise<ContactSubmissionResponse>;
}

const OSContext = createContext<OSContextType | undefined>(undefined);

const DEFAULT_SETTINGS: SystemSettings = {
  wallpaper: 'custom',
  customWallpaperUrl: `${D_DRIVE_FOLDER_PATHS.downloads}/Windows11.jpg`,
  lockScreenWallpaper: 'spotlight',
  customLockScreenUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2560&q=90',
  theme: 'dark',
  accentColor: '#0078d4',
  iconColor: '#0078d4',
  iconStyleMode: 'fluent_3d',
  syncIconColorWithAccent: false,
  transparency: true,
  iconSize: 'medium',
  clockFormat: '12h',
  dateFormat: 'DD/MM/YYYY',
  timeZone: DEFAULT_TIME_ZONE,
  wifiEnabled: true,
  wifiSSID: 'Anish_Home_5GHz',
  soundEnabled: true,
  soundVolume: 0.5,
  systemActionSoundsEnabled: true,
  brightness: 1.0,
  taskbarAlignment: 'center',
  taskbarAutoHide: false,
  showSearchOnTaskbar: 'icon',
  showWidgetsOnTaskbar: true,
  showWifiOnTaskbar: true,
  showSoundOnTaskbar: true,
  showBatteryOnTaskbar: true,
  showTouchKeyboardOnTaskbar: true,
  showNotificationsOnTaskbar: true,
  showSecondsInClock: false,
  showDateOnMobileStatusBar: false,
  animationsEnabled: true,
};

const INITIAL_DESKTOP_ICONS: DesktopIconItem[] = [
  { id: 'icon-thispc', appId: 'explorer', name: 'This PC', icon: 'ThisPC', position: { gridX: 0, gridY: 0 }, type: 'app' },
  { id: 'icon-about', appId: 'about', name: 'About Me', icon: 'About', position: { gridX: 0, gridY: 1 }, type: 'app' },
  { id: 'icon-projects', appId: 'projects', name: 'Projects', icon: 'Projects', position: { gridX: 0, gridY: 2 }, type: 'app' },
  { id: 'icon-resume', appId: 'resume', name: 'Resume CV', icon: 'Resume', position: { gridX: 1, gridY: 0 }, type: 'app' },
  { id: 'icon-contact', appId: 'contact', name: 'Contact Me', icon: 'Contact', position: { gridX: 1, gridY: 1 }, type: 'app' },
  { id: 'icon-terminal', appId: 'terminal', name: 'Terminal', icon: 'Terminal', position: { gridX: 1, gridY: 2 }, type: 'app' },
  { id: 'icon-browser', appId: 'browser', name: 'Web Browser', icon: 'Globe', position: { gridX: 1, gridY: 3 }, type: 'app' },
  { id: 'icon-settings', appId: 'settings', name: 'Settings', icon: 'Settings', position: { gridX: 2, gridY: 0 }, type: 'app' },
  { id: 'icon-recycle', appId: 'recycle', name: 'Recycle Bin', icon: 'Recycle', position: { gridX: 2, gridY: 1 }, type: 'app' },
  { id: 'icon-calculator', appId: 'calculator', name: 'Calculator', icon: 'Calculator', position: { gridX: 2, gridY: 2 }, type: 'app' },
  { id: 'icon-camera', appId: 'camera', name: 'Camera', icon: 'Camera', position: { gridX: 2, gridY: 3 }, type: 'app' },
  { id: 'icon-photos', appId: 'photos', name: 'Media', icon: 'Media', position: { gridX: 3, gridY: 0 }, type: 'app' },
  { id: 'icon-minesweeper', appId: 'minesweeper', name: 'Minesweeper', icon: 'Minesweeper', position: { gridX: 3, gridY: 1 }, type: 'app' },
  { id: 'icon-snake', appId: 'snake', name: 'Retro Snake', icon: 'Snake', position: { gridX: 3, gridY: 2 }, type: 'app' },
];

const loadHiddenAppIds = (): AppId[] => {
  try {
    const saved = JSON.parse(localStorage.getItem('win11_hidden_apps') || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((id): id is AppId => id !== 'admin' && APPS_LIST.some((app) => app.id === id));
  } catch {
    return [];
  }
};

let idCounter = 0;
export const generateUniqueId = (prefix: string = 'file'): string => {
  idCounter = (idCounter + 1) % 1000000;
  const rand = Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 7);
  const now = Date.now();
  const perf = typeof performance !== 'undefined' ? Math.floor(performance.now() * 100) : idCounter;
  return `${prefix}-${now}-${perf}-${idCounter}-${rand}`;
};

export const deduplicateFiles = (items: FileItem[]): FileItem[] => {
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const unique: FileItem[] = [];

  for (const item of items) {
    if (!item || !item.id) continue;
    if (!seenIds.has(item.id) && !seenPaths.has(item.path)) {
      seenIds.add(item.id);
      seenPaths.add(item.path);
      unique.push(item);
    }
  }
  return unique;
};

const MIGRATED_INITIAL_FILES = deduplicateFiles(normalizeVirtualDriveFiles(INITIAL_FILES));
const D_DRIVE_LAYOUT_MIGRATION_KEY = 'win11_d_drive_layout_migrated_v1';
const excludePortfolioMediaFromDesktop = (items: FileItem[]): FileItem[] => items.filter((item) => (
  item.path !== 'Portfolio' &&
  item.path !== 'Portfolio/Media' &&
  !item.path.startsWith('Portfolio/Media/')
));

const removeMarkedDocumentsDemoFilesFromServer = async (): Promise<void> => {
  const serverFiles = await storageService.loadServerFiles();
  const demoFiles = serverFiles.filter(isMarkedDocumentsDemoFile);
  for (const file of demoFiles) {
    try {
      const response = await apiFetch(`/api/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        console.error(`[OSContext] Could not remove obsolete Documents demo file "${file.name}" (HTTP ${response.status}).`);
      }
    } catch (error) {
      console.error(`[OSContext] Could not remove obsolete Documents demo file "${file.name}".`, error);
    }
  }
};

export const OSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const windowCloseGuards = React.useRef(new Map<string, () => Promise<boolean>>());
  const pendingWindowCloses = React.useRef(new Set<string>());
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('win11_system_settings');
      if (saved) {
        const savedSettings = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...savedSettings,
          customWallpaperUrl: typeof savedSettings.customWallpaperUrl === 'string' &&
            !/^C:\//i.test(savedSettings.customWallpaperUrl)
            ? savedSettings.customWallpaperUrl
            : DEFAULT_SETTINGS.customWallpaperUrl,
          timeZone: !savedSettings.timeZone || savedSettings.timeZone === 'Local'
            ? DEFAULT_TIME_ZONE
            : savedSettings.timeZone,
        };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('win11_system_settings', JSON.stringify(settings));
    } catch {}
    haptics.setEnabled(settings.hapticsEnabled !== false);
  }, [settings]);

  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeTrayPanel, setActiveTrayPanel] = useState<'wifi' | 'volume' | 'battery' | 'calendar' | null>(null);

  const [files, setFiles] = useState<FileItem[]>(MIGRATED_INITIAL_FILES);
  const [filesHydrated, setFilesHydrated] = useState(false);
  const [deletedFiles, setDeletedFiles] = useState<FileItem[]>([]);
  const [desktopIcons, setDesktopIcons] = useState<DesktopIconItem[]>(INITIAL_DESKTOP_ICONS);
  const [hiddenAppIds, setHiddenAppIds] = useState<AppId[]>(loadHiddenAppIds);
  const [adminAppEnabledInStart, setAdminAppEnabledInStartState] = useState(() => {
    try {
      return localStorage.getItem('win11_admin_start_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const setAdminAppEnabledInStart = useCallback((enabled: boolean) => {
    setAdminAppEnabledInStartState(enabled);
    try {
      localStorage.setItem('win11_admin_start_enabled', String(enabled));
    } catch {
      console.error('[Appearance] Could not save Admin Control Center Start menu visibility.');
    }
  }, []);
  const applyPublishedAppLayout = useCallback((layout: {
    desktopShortcuts?: DesktopIconItem[];
    taskbarPinnedApps?: string[];
    startPinnedApps?: string[];
    adminAppEnabledInStart?: boolean;
  }) => {
    const validAppIds = new Set(APPS_LIST.map((app) => app.id));
    if (Array.isArray(layout.desktopShortcuts)) {
      const shortcuts = layout.desktopShortcuts.filter((item) =>
        item?.type === 'app' && typeof item.id === 'string' && validAppIds.has(item.appId as AppId)
      );
      setDesktopIcons((current) => [
        ...current.filter((item) => item.type !== 'app'),
        ...shortcuts,
      ]);
    }
    if (Array.isArray(layout.taskbarPinnedApps)) {
      setPinnedAppIds(Array.from(new Set(layout.taskbarPinnedApps.filter((id): id is AppId => validAppIds.has(id as AppId)))));
    }
    if (Array.isArray(layout.startPinnedApps)) {
      setStartPinnedAppIds(Array.from(new Set(layout.startPinnedApps.filter((id): id is AppId => validAppIds.has(id as AppId)))));
    }
    if (typeof layout.adminAppEnabledInStart === 'boolean') {
      setAdminAppEnabledInStartState(layout.adminAppEnabledInStart);
      try {
        localStorage.setItem('win11_admin_start_enabled', String(layout.adminAppEnabledInStart));
      } catch {
        console.error('[Appearance] Could not apply the published Admin Control Center Start menu visibility.');
      }
    }
  }, []);
  const updateHiddenAppIds = useCallback((appIds: AppId[]) => {
    const safeIds = appIds.filter((id) => id !== 'admin' && APPS_LIST.some((app) => app.id === id));
    const hidden = Array.from(new Set(safeIds));
    setHiddenAppIds(hidden);
    try { localStorage.setItem('win11_hidden_apps', JSON.stringify(hidden)); } catch {}
    setWindows((previous) => previous.filter((win) => !hidden.includes(win.appId)));
  }, []);

  // Helper to find the first completely unoccupied grid slot sequentially to prevent overlap
  const findNextAvailablePosition = useCallback((existingIcons: DesktopIconItem[]) => {
    const occupied = new Set(existingIcons.map(i => `${i.position?.gridX || 0},${i.position?.gridY || 0}`));
    
    // Determine dynamic column count based on screen width
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
    const cols = isMobile ? Math.max(3, Math.floor((screenWidth - 16) / 84)) : 4;

    let found = false;
    let gridX = 0;
    let gridY = 0;
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < cols; x++) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          gridX = x;
          gridY = y;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    return { gridX, gridY };
  }, []);

  // Hydrate files from persistent IndexedDB / localStorage on startup & Auto-purge 30-day old deleted items
  useEffect(() => {
    let isMounted = true;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    storageService.loadFiles()
      .then(async (saved) => {
        if (!isMounted) return;
        let hideLegacyDEntries = false;
        try {
          hideLegacyDEntries = localStorage.getItem(D_DRIVE_LAYOUT_MIGRATION_KEY) !== 'true';
        } catch (error) {
          console.error('[OSContext] Could not read the D: layout migration marker.', error);
        }
        if (saved && saved.length > 0) {
          const hasDocumentsDemoFiles = saved.some(isMarkedDocumentsDemoFile);
          const hasObsoleteNestedVideos = saved.some((file) =>
            /^D:\/Videos\/Videos(?:\/|$)/i.test(file.path.replace(/\\/g, '/'))
          );
          const migratedFiles = deduplicateFiles([
            ...MIGRATED_INITIAL_FILES,
            ...normalizeVirtualDriveFiles(
              excludePortfolioMediaFromDesktop(saved),
              true,
              hideLegacyDEntries
            ),
          ]);
          setFiles(migratedFiles);
          if (hideLegacyDEntries || hasObsoleteNestedVideos || hasDocumentsDemoFiles) {
            await storageService.saveFiles(migratedFiles);
          }
          if (hasDocumentsDemoFiles) {
            await removeMarkedDocumentsDemoFilesFromServer();
          }
        } else if (hideLegacyDEntries) {
          await storageService.saveFiles(MIGRATED_INITIAL_FILES);
        }
        if (hideLegacyDEntries) {
          try {
            localStorage.setItem(D_DRIVE_LAYOUT_MIGRATION_KEY, 'true');
          } catch (error) {
            console.error('[OSContext] Could not persist the D: layout migration marker.', error);
          }
        }
        setFilesHydrated(true);
      })
      .catch((error: unknown) => {
        console.error('[OSContext] Could not hydrate the virtual file system.', error);
        if (isMounted) setFilesHydrated(true);
      });
    storageService.loadDeletedFiles().then((savedDel) => {
      if (isMounted && savedDel && savedDel.length > 0) {
        // Automatically purge any files that have been in the Recycle Bin for more than 30 days
        const activeDel = savedDel.filter((f) => {
          if (!f.deletedAt) return true;
          return now - f.deletedAt < THIRTY_DAYS_MS;
        });
        setDeletedFiles(deduplicateFiles(normalizeVirtualDriveFiles(activeDel, false)));
      }
    });

    // Real-time synchronization across browser tabs/windows
    const unsubscribeSync = storageService.onSync((event) => {
      if (!isMounted) return;
      if (event && (event.action === 'files_saved' || event.action === 'file_updated' || event.action === 'vfs_reset')) {
        storageService.loadFiles().then((refreshed) => {
          if (isMounted && refreshed) {
            setFiles(deduplicateFiles([
              ...MIGRATED_INITIAL_FILES,
              ...normalizeVirtualDriveFiles(excludePortfolioMediaFromDesktop(refreshed)),
            ]));
          }
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribeSync();
    };
  }, []);

  // Debounced auto-save files to IndexedDB
  useEffect(() => {
    if (!filesHydrated) return;
    const timer = setTimeout(() => {
      storageService.saveFiles(files);
    }, 500);
    return () => clearTimeout(timer);
  }, [files, filesHydrated]);

  // Auto-save deleted files to storage
  useEffect(() => {
    storageService.saveDeletedFiles(deletedFiles);
  }, [deletedFiles]);

  // Drive Custom Labels State
  const [driveLabels, setDriveLabels] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('win11_drive_labels');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { 'C:': 'Local Disk', 'D:': 'New Volume' };
  });

  const updateDriveLabel = useCallback((drivePath: string, newLabel: string) => {
    const key = drivePath.substring(0, 2).toUpperCase();
    const fallback = key === 'C:' ? 'Local Disk' : 'New Volume';
    const label = newLabel.trim() || fallback;
    setDriveLabels((prev) => {
      const updated = { ...prev, [key]: label };
      try {
        localStorage.setItem('win11_drive_labels', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuType>(null);
  const showContextMenu = useCallback((menu: ContextMenuType) => {
    setContextMenu(menu);
  }, []);
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Clipboard State
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  // Pinned Taskbar Apps State
  const [pinnedAppIds, setPinnedAppIds] = useState<AppId[]>(() => {
    try {
      const saved = localStorage.getItem('win11_taskbar_pinned');
      if (saved) return Array.from(new Set((JSON.parse(saved) as string[]).map((id) => id === 'skills' ? 'about' : id))) as AppId[];
    } catch {}
    return ['explorer', 'browser', 'terminal', 'about', 'projects', 'settings'];
  });

  // Pinned Start Menu Apps State (defaults matching Windows 11 / Image 4)
  const [startPinnedAppIds, setStartPinnedAppIds] = useState<AppId[]>(() => {
    try {
      const saved = localStorage.getItem('win11_start_pinned');
      if (saved) return Array.from(new Set((JSON.parse(saved) as string[]).map((id) => id === 'skills' ? 'about' : id))) as AppId[];
    } catch {}
    return [
      'about',
      'projects',
      'resume',
      'contact',
      'explorer',
      'terminal',
      'browser',
      'notepad',
      'settings',
      'taskmanager',
      'minesweeper',
      'snake',
      'calculator',
    ];
  });

  // Save pinned taskbar apps to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('win11_taskbar_pinned', JSON.stringify(pinnedAppIds));
    } catch {}
  }, [pinnedAppIds]);

  // Save pinned start apps to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('win11_start_pinned', JSON.stringify(startPinnedAppIds));
    } catch {}
  }, [startPinnedAppIds]);

  // Properties Modal State
  const [propertiesTarget, setPropertiesTarget] = useState<PropertiesTarget | null>(null);
  const openProperties = useCallback((target: PropertiesTarget) => {
    setPropertiesTarget(target);
  }, []);
  const closeProperties = useCallback(() => {
    setPropertiesTarget(null);
  }, []);

  // Power State
  const [powerState, setPowerState] = useState<'normal' | 'sleep' | 'shutdown' | 'restart' | 'off'>('normal');

  // Virtual Desktops State
  const [desktops, setDesktops] = useState<VirtualDesktop[]>(() => {
    try {
      const saved = localStorage.getItem('win11_virtual_desktops');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'desktop-1', name: 'Desktop 1' },
      { id: 'desktop-2', name: 'Desktop 2' },
    ];
  });
  const [currentDesktopId, setCurrentDesktopId] = useState<string>('desktop-1');
  const [isTaskViewOpen, setIsTaskViewOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('win11_virtual_desktops', JSON.stringify(desktops));
    } catch {}
  }, [desktops]);

  const createDesktop = useCallback(() => {
    setDesktops((prev) => {
      const nextNum = prev.length + 1;
      const newD: VirtualDesktop = {
        id: `desktop-${Date.now()}`,
        name: `Desktop ${nextNum}`,
      };
      return [...prev, newD];
    });
    soundManager.playClick();
  }, []);

  const removeDesktop = useCallback((id: string) => {
    setDesktops((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((d) => d.id !== id);
      return filtered;
    });
    // Move any windows on the removed desktop to the first remaining desktop
    setWindows((prevWins) =>
      prevWins.map((w) => (w.desktopId === id ? { ...w, desktopId: 'desktop-1' } : w))
    );
    setCurrentDesktopId((prev) => (prev === id ? 'desktop-1' : prev));
    soundManager.playTrashEmpty();
  }, []);

  const switchDesktop = useCallback((id: string) => {
    setCurrentDesktopId(id);
    soundManager.playClick();
  }, []);

  const renameDesktop = useCallback((id: string, newName: string) => {
    setDesktops((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: newName } : d))
    );
  }, []);

  const moveWindowToDesktop = useCallback((windowId: string, desktopId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, desktopId } : w))
    );
    soundManager.playClick();
  }, []);

  const toggleTaskView = useCallback(() => {
    setIsTaskViewOpen((prev) => !prev);
    soundManager.playClick();
  }, []);

  const closeTaskView = useCallback(() => {
    setIsTaskViewOpen(false);
  }, []);

  // Clipboard History State
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('win11_clipboard_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('win11_clipboard_history', JSON.stringify(clipboardHistory));
    } catch {}
  }, [clipboardHistory]);

  const addClipboardHistory = useCallback((item: Omit<ClipboardHistoryEntry, 'id' | 'timestamp'>) => {
    const newItem: ClipboardHistoryEntry = {
      ...item,
      id: `clip-${Date.now()}`,
      timestamp: formatTime(new Date(), { hour: '2-digit', minute: '2-digit' }),
    };
    setClipboardHistory((prev) => [newItem, ...prev.slice(0, 24)]);
  }, []);

  const removeClipboardHistory = useCallback((id: string) => {
    setClipboardHistory((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearClipboardHistory = useCallback(() => {
    setClipboardHistory((prev) => prev.filter((c) => c.pinned));
    soundManager.playTrashEmpty();
  }, []);

  const togglePinClipboardItem = useCallback((id: string) => {
    setClipboardHistory((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);

  const toggleClipboard = useCallback(() => {
    setIsClipboardOpen((prev) => !prev);
    soundManager.playClick();
  }, []);

  const closeClipboard = useCallback(() => {
    setIsClipboardOpen(false);
  }, []);

  // Snipping Tool Overlay State
  const [isSnippingOpen, setIsSnippingOpen] = useState(false);
  const openSnipping = useCallback(() => {
    setIsSnippingOpen(true);
    soundManager.playClick();
  }, []);
  const closeSnipping = useCallback(() => {
    setIsSnippingOpen(false);
  }, []);

  // Xbox Game Bar Overlay State
  const [isGameBarOpen, setIsGameBarOpen] = useState(false);
  const toggleGameBar = useCallback(() => {
    setIsGameBarOpen((prev) => !prev);
    soundManager.playClick();
  }, []);
  const closeGameBar = useCallback(() => {
    setIsGameBarOpen(false);
  }, []);

  // Alt+Tab Switcher State
  const [isAltTabOpen, setIsAltTabOpen] = useState(false);
  const openAltTab = useCallback(() => {
    setIsAltTabOpen(true);
  }, []);
  const closeAltTab = useCallback(() => {
    setIsAltTabOpen(false);
  }, []);

  // Widgets Board State
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(false);
  const toggleWidgets = useCallback(() => {
    setIsWidgetsOpen((prev) => !prev);
    soundManager.playClick();
  }, []);
  const closeWidgets = useCallback(() => {
    setIsWidgetsOpen(false);
  }, []);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'welcome-1',
      title: 'Welcome to Windows 11 Portfolio',
      message: `Explore ${PORTFOLIO_USER.name}'s interactive OS! Double-click icons or use the Start menu.`,
      timestamp: formatTime(new Date(), { hour: '2-digit', minute: '2-digit' }),
      type: 'info',
      read: false,
    },
  ]);

  const addNotification = useCallback((item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const id = 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const newNotif: NotificationItem = {
      ...item,
      id,
      timestamp: formatTime(new Date(), { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    soundManager.playNotification();
  }, []);

  const pinToTaskbar = useCallback((appId: AppId) => {
    setPinnedAppIds((prev) => (prev.includes(appId) ? prev : [...prev, appId]));
    soundManager.playClick();
  }, []);

  const unpinFromTaskbar = useCallback((appId: AppId) => {
    setPinnedAppIds((prev) => prev.filter((id) => id !== appId));
    soundManager.playClick();
  }, []);

  const reorderPinnedApps = useCallback((newOrder: AppId[]) => {
    setPinnedAppIds(newOrder);
  }, []);

  const pinToStart = useCallback((appId: AppId) => {
    setStartPinnedAppIds((prev) => (prev.includes(appId) ? prev : [...prev, appId]));
    soundManager.playClick();
  }, []);

  const unpinFromStart = useCallback((appId: AppId) => {
    setStartPinnedAppIds((prev) => prev.filter((id) => id !== appId));
    soundManager.playClick();
  }, []);

  const togglePinToStart = useCallback((appId: AppId) => {
    setStartPinnedAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
    soundManager.playClick();
  }, []);

  const isPinnedToStart = useCallback(
    (appId: AppId) => startPinnedAppIds.includes(appId),
    [startPinnedAppIds]
  );

  const copyFile = useCallback((fileOrFiles: FileItem | FileItem[]) => {
    const list = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (list.length === 0) return;
    soundManager.playCopy();
    setClipboard({ file: list[0], files: list, action: 'copy' });
    addNotification({
      title: 'Copied to Clipboard',
      message: list.length === 1 ? `Copied "${list[0].name}"` : `Copied ${list.length} items to clipboard`,
      type: 'info',
    });
  }, [addNotification]);

  const cutFile = useCallback((fileOrFiles: FileItem | FileItem[]) => {
    const list = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (list.length === 0) return;
    soundManager.playCut();
    setClipboard({ file: list[0], files: list, action: 'cut' });
    addNotification({
      title: 'Cut to Clipboard',
      message: list.length === 1 ? `Cut "${list[0].name}"` : `Cut ${list.length} items to clipboard`,
      type: 'info',
    });
  }, [addNotification]);

  const copyFiles = useCallback((filesList: FileItem[]) => {
    copyFile(filesList);
  }, [copyFile]);

  const cutFiles = useCallback((filesList: FileItem[]) => {
    cutFile(filesList);
  }, [cutFile]);

  const pasteFile = useCallback(
    (targetPath: string) => {
      if (!clipboard) return;
      const destinationPath = normalizeVfsDestinationPath(targetPath);
      const itemsToPaste = clipboard.files && clipboard.files.length > 0 ? clipboard.files : [clipboard.file];
      if (itemsToPaste.length === 0) return;

      if (clipboard.action === 'copy') {
        const newCopiedFiles: FileItem[] = [];
        const newDesktopIcons: DesktopIconItem[] = [];

        setFiles((currentFiles) => {
          let updatedFilesList = [...currentFiles];

          itemsToPaste.forEach((srcFile) => {
            let base = srcFile.name;
            let ext = '';
            if (srcFile.type === 'file' && srcFile.name.includes('.')) {
              const idx = srcFile.name.lastIndexOf('.');
              base = srcFile.name.substring(0, idx);
              ext = srcFile.name.substring(idx);
            }
            let newName = `${base} - Copy${ext}`;
            let counter = 1;
            while (updatedFilesList.some((f) => f.parentId === destinationPath && f.name === newName)) {
              newName = `${base} - Copy (${counter})${ext}`;
              counter++;
            }

            const newPath = `${destinationPath}/${newName}`.replace(/\/\//g, '/');
            const copiedFile: FileItem = {
              ...srcFile,
              id: generateUniqueId('file-copy'),
              name: newName,
              path: newPath,
              parentId: destinationPath,
              modified: formatDateISO(new Date()),
            };

            updatedFilesList.push(copiedFile);
            newCopiedFiles.push(copiedFile);

            if (destinationPath.includes('Desktop')) {
              newDesktopIcons.push({
                id: generateUniqueId('icon'),
                name: newName,
                filePath: newPath,
                icon: srcFile.type === 'folder' ? 'Folder' : 'FileText',
                position: { gridX: 0, gridY: 0 },
                type: srcFile.type === 'folder' ? 'folder' : 'file',
              });
            }
          });

          return updatedFilesList;
        });

        if (destinationPath.includes('Desktop') && newDesktopIcons.length > 0) {
          setDesktopIcons((prev) => {
            let tempIcons = [...prev];
            const placedIcons = newDesktopIcons.map((ic) => {
              const pos = findNextAvailablePosition(tempIcons);
              const newIcon = {
                ...ic,
                position: pos,
              };
              tempIcons.push(newIcon);
              return newIcon;
            });
            return [...prev, ...placedIcons];
          });
        }

        soundManager.playPaste();
        addNotification({
          title: 'Files Pasted',
          message: itemsToPaste.length === 1 ? `Pasted "${itemsToPaste[0].name}"` : `Pasted ${itemsToPaste.length} items to folder`,
          type: 'success',
        });
      } else if (clipboard.action === 'cut') {
        const movedIds = new Set(itemsToPaste.map((f) => f.id));
        const movedPaths = new Map(itemsToPaste.map((f) => [f.id, `${destinationPath}/${f.name}`.replace(/\/\//g, '/')]));

        setFiles((prev) =>
          prev.map((f) => {
            if (movedIds.has(f.id)) {
              return {
                ...f,
                parentId: destinationPath,
                path: movedPaths.get(f.id) || f.path,
                modified: formatDateISO(new Date()),
              };
            }
            return f;
          })
        );

        if (targetPath.includes('Desktop')) {
          setDesktopIcons((prev) => {
            let tempIcons = [...prev];
            const added: DesktopIconItem[] = itemsToPaste.map((srcFile, idx) => {
              const pos = findNextAvailablePosition(tempIcons);
              const newIcon: DesktopIconItem = {
                id: 'icon-' + Date.now() + '-' + idx,
                name: srcFile.name,
                filePath: `${targetPath}/${srcFile.name}`.replace(/\/\//g, '/'),
                icon: srcFile.type === 'folder' ? 'Folder' : 'FileText',
                position: pos,
                type: (srcFile.type === 'folder' ? 'folder' : 'file') as 'folder' | 'file',
              };
              tempIcons.push(newIcon);
              return newIcon;
            });
            return [...prev, ...added];
          });
        } else if (itemsToPaste.some((f) => f.parentId.includes('Desktop'))) {
          setDesktopIcons((prev) => prev.filter((i) => !itemsToPaste.some((f) => f.path === i.filePath || f.id === i.id)));
        }

        setClipboard(null); // Clear cut items
        soundManager.playPaste();
        addNotification({
          title: 'Files Moved',
          message: itemsToPaste.length === 1 ? `Moved "${itemsToPaste[0].name}" to ${targetPath}` : `Moved ${itemsToPaste.length} items to ${targetPath}`,
          type: 'success',
        });
      }
    },
    [clipboard, addNotification]
  );

  const renameFile = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (!target) return prev;
      const parent = target.parentId;
      const oldPath = target.path;

      // Check if another file or folder with same name exists in this folder
      const duplicateExists = prev.some(
        (f) => f.id !== id && f.parentId === parent && f.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (duplicateExists) {
        soundManager.playError();
        addNotification({
          title: 'Cannot Rename Item',
          message: `A file or folder with the name "${trimmed}" already exists in this location.`,
          type: 'error',
        });
        return prev;
      }

      const newPath = `${parent}/${trimmed}`.replace(/\/\//g, '/');

      // Sync corresponding desktop icon if exists
      setDesktopIcons((icons) =>
        icons.map((i) => (i.filePath === oldPath || i.id === id ? { ...i, name: trimmed, filePath: newPath } : i))
      );

      addNotification({
        title: 'Item Renamed',
        message: `Renamed to "${trimmed}"`,
        type: 'success',
      });

      return prev.map((f) => {
        if (f.id === id) {
          return { ...f, name: trimmed, path: newPath };
        }
        if (f.path.startsWith(oldPath + '/')) {
          const sub = f.path.substring(oldPath.length);
          return { ...f, path: `${newPath}${sub}` };
        }
        return f;
      });
    });
  }, [addNotification]);

  const moveFile = useCallback(
    (id: string, targetParentPath: string) => {
      setFiles((prev) => {
        const fileToMove = prev.find((f) => f.id === id);
        if (!fileToMove) return prev;

        const normalizedTarget = normalizeVfsDestinationPath(targetParentPath);
        const normalizedCurrentParent = fileToMove.parentId.replace(/\/$/, '');

        // If target is same as current parent, do nothing
        if (normalizedTarget === normalizedCurrentParent) return prev;

        // If it's a folder, ensure target is not inside itself
        if (
          fileToMove.type === 'folder' &&
          (normalizedTarget === fileToMove.path || normalizedTarget.startsWith(fileToMove.path + '/'))
        ) {
          addNotification({
            title: 'Action Not Allowed',
            message: 'Cannot move a folder into itself or its subfolder.',
            type: 'warning',
          });
          return prev;
        }

        const oldPath = fileToMove.path;
        let finalName = fileToMove.name;
        let counter = 1;
        const baseName =
          fileToMove.name.includes('.') && fileToMove.type === 'file'
            ? fileToMove.name.substring(0, fileToMove.name.lastIndexOf('.'))
            : fileToMove.name;
        const extStr =
          fileToMove.name.includes('.') && fileToMove.type === 'file'
            ? fileToMove.name.substring(fileToMove.name.lastIndexOf('.'))
            : '';

        while (
          prev.some(
            (f) =>
              f.id !== id &&
              f.parentId.replace(/\/$/, '') === normalizedTarget &&
              f.name === finalName
          )
        ) {
          finalName =
            fileToMove.type === 'folder'
              ? `${fileToMove.name} (${counter})`
              : `${baseName} (${counter})${extStr}`;
          counter++;
        }

        const newPath = `${normalizedTarget}/${finalName}`.replace(/\/\//g, '/');

        // Update Desktop Icons if moving to/from Desktop
        if (normalizedTarget.includes('Desktop')) {
          setDesktopIcons((icons) => {
            const alreadyHasIcon = icons.some((i) => i.filePath === oldPath || i.id === id);
            if (!alreadyHasIcon) {
              return [
                ...icons,
                {
                  id: 'icon-' + Date.now(),
                  name: finalName,
                  filePath: newPath,
                  icon: fileToMove.type === 'folder' ? 'Folder' : 'FileText',
                  position: findNextAvailablePosition(icons),
                  type: fileToMove.type === 'folder' ? 'folder' : 'file',
                },
              ];
            }
            return icons.map((i) =>
              i.filePath === oldPath || i.id === id ? { ...i, name: finalName, filePath: newPath } : i
            );
          });
        } else if (fileToMove.parentId.includes('Desktop')) {
          setDesktopIcons((icons) => icons.filter((i) => i.filePath !== oldPath && i.id !== id));
        }

        addNotification({
          title: 'File Moved',
          message: `Moved "${fileToMove.name}" to ${normalizedTarget.split('/').pop() || normalizedTarget}`,
          type: 'success',
        });
        soundManager.playClick();

        return prev.map((f) => {
          if (f.id === id) {
            return {
              ...f,
              name: finalName,
              parentId: normalizedTarget,
              path: newPath,
              modified: formatDateISO(new Date()),
            };
          }
          if (f.path.startsWith(oldPath + '/')) {
            const subPath = f.path.substring(oldPath.length);
            const updatedPath = `${newPath}${subPath}`;
            const parentOfSub = updatedPath.substring(0, updatedPath.lastIndexOf('/'));
            return {
              ...f,
              path: updatedPath,
              parentId: parentOfSub,
            };
          }
          return f;
        });
      });
    },
    [addNotification]
  );

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const newSize = `${(content.length / 1024).toFixed(1)} KB`;
          return { ...f, content, size: newSize, modified: formatDateISO(new Date()) };
        }
        return f;
      })
    );
  }, []);

  const updateFileAttributes = useCallback((idOrPath: string, updates: Partial<FileItem>) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === idOrPath || f.path === idOrPath || (f.path && idOrPath && f.path.toLowerCase() === idOrPath.toLowerCase())) {
          return { ...f, ...updates };
        }
        return f;
      })
    );
  }, []);

  const sortDesktopIcons = useCallback(
    (by: 'name' | 'size' | 'type' | 'date') => {
      setDesktopIcons((prev) => {
        const parseSize = (icon: DesktopIconItem): number => {
          if (icon.filePath) {
            const f = files.find((file) => file.path === icon.filePath);
            if (f && f.size) {
              const num = parseFloat(f.size);
              if (f.size.includes('MB')) return num * 1024 * 1024;
              if (f.size.includes('KB')) return num * 1024;
              if (f.size.includes('GB')) return num * 1024 * 1024 * 1024;
              return num || 1024;
            }
          }
          if (icon.type === 'folder') return 2048;
          if (icon.type === 'app') return 51200;
          return 1024;
        };

        const parseDate = (icon: DesktopIconItem): number => {
          if (icon.filePath) {
            const f = files.find((file) => file.path === icon.filePath);
            if (f && f.modified) {
              const d = new Date(f.modified).getTime();
              if (!isNaN(d)) return d;
            }
          }
          return 1723500000000;
        };

        const sorted = [...prev].sort((a, b) => {
          if (by === 'name') {
            return a.name.localeCompare(b.name);
          }
          if (by === 'type') {
            const typeRank = (i: DesktopIconItem) => {
              if (i.type === 'app') return 1;
              if (i.type === 'folder') return 2;
              return 3;
            };
            const diff = typeRank(a) - typeRank(b);
            return diff !== 0 ? diff : a.name.localeCompare(b.name);
          }
          if (by === 'size') {
            const sA = parseSize(a);
            const sB = parseSize(b);
            return sB !== sA ? sB - sA : a.name.localeCompare(b.name);
          }
          if (by === 'date') {
            const dA = parseDate(a);
            const dB = parseDate(b);
            return dB !== dA ? dB - dA : a.name.localeCompare(b.name);
          }
          return a.name.localeCompare(b.name);
        });

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        if (isMobile) {
          const screenW = typeof window !== 'undefined' ? window.innerWidth : 360;
          const maxCols = Math.max(3, Math.floor((screenW - 16) / 84));
          return sorted.map((icon, idx) => ({
            ...icon,
            position: { gridX: idx % maxCols, gridY: Math.floor(idx / maxCols) },
          }));
        }

        const cellH = settings.iconSize === 'small' ? 94 : settings.iconSize === 'large' ? 124 : 110;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
        const maxRows = Math.max(1, Math.floor((screenH - 56 - 16) / cellH));

        return sorted.map((icon, idx) => ({
          ...icon,
          position: { gridX: Math.floor(idx / maxRows), gridY: idx % maxRows },
        }));
      });
      soundManager.playClick();
      addNotification({
        title: 'Desktop Sorted',
        message: `Icons sorted by ${by === 'name' ? 'Name' : by === 'size' ? 'Size' : by === 'type' ? 'Item Type' : 'Date Modified'}`,
        type: 'info',
      });
    },
    [settings.iconSize, files, addNotification]
  );

  // Auto-arrange icons whenever iconSize or screen orientation changes
  useEffect(() => {
    const handleResize = () => {
      setDesktopIcons((prev) => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        if (isMobile) {
          const screenW = window.innerWidth;
          const maxCols = Math.max(3, Math.floor((screenW - 16) / 84));
          return prev.map((icon, idx) => ({
            ...icon,
            position: { gridX: idx % maxCols, gridY: Math.floor(idx / maxCols) },
          }));
        }
        const cellH = settings.iconSize === 'small' ? 94 : settings.iconSize === 'large' ? 124 : 110;
        const screenH = window.innerHeight;
        const maxRows = Math.max(1, Math.floor((screenH - 56 - 16) / cellH));
        return prev.map((icon, idx) => ({
          ...icon,
          position: { gridX: Math.floor(idx / maxRows), gridY: idx % maxRows },
        }));
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [settings.iconSize]);

  const [isBsod, setIsBsod] = useState(false);
  const [isMatrixMode, setIsMatrixMode] = useState(false);
  const [desktopMinimizingState, setDesktopMinimizingState] = useState<boolean>(false);

  // Mobile / Tablet Touch Keyboard State
  const [isTouchKeyboardOpen, setIsTouchKeyboardOpen] = useState<boolean>(false);
  const openTouchKeyboard = useCallback(() => setIsTouchKeyboardOpen(true), []);
  const closeTouchKeyboard = useCallback(() => setIsTouchKeyboardOpen(false), []);
  const toggleTouchKeyboard = useCallback(() => setIsTouchKeyboardOpen((prev) => !prev), []);

  // Screen Orientation State & Listener
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
    }
    return 'landscape';
  });

  useEffect(() => {
    const handleOrientation = () => {
      const isPortrait = window.innerWidth < window.innerHeight;
      setOrientation(isPortrait ? 'portrait' : 'landscape');
    };

    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  // Global Top Loading Progress
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false);
  const [globalProgress, setGlobalProgress] = useState<number | undefined>(undefined);

  const triggerLoading = useCallback((durationMs = 600) => {
    setIsGlobalLoading(true);
    setGlobalProgress(15);
    const step1 = setTimeout(() => setGlobalProgress(65), durationMs * 0.4);
    const step2 = setTimeout(() => setGlobalProgress(100), durationMs * 0.85);
    const step3 = setTimeout(() => {
      setIsGlobalLoading(false);
      setGlobalProgress(undefined);
    }, durationMs);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  }, []);

  // Sync sound settings
  useEffect(() => {
    soundManager.setEnabled(settings.soundEnabled);
    soundManager.setVolume(settings.soundVolume);
    soundManager.setSystemActionSoundsEnabled(settings.systemActionSoundsEnabled !== false);
  }, [settings.soundEnabled, settings.soundVolume, settings.systemActionSoundsEnabled]);

  // Initial welcome notification sound
  useEffect(() => {
    const timer = setTimeout(() => {
      soundManager.playStartup();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Window Management
  const focusWindow = useCallback((id: string) => {
    setIsStartOpen(false);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setActiveTrayPanel(null);
    setContextMenu(null);
    setWindows((prev) => {
      const maxZ = Math.max(0, ...prev.map((w) => w.zIndex));
      return prev.map((w) => {
        if (w.id === id) {
          return { ...w, isFocused: true, isMinimized: false, zIndex: maxZ + 1 };
        }
        return { ...w, isFocused: false };
      });
    });
    setActiveWindowId(id);
  }, []);

  const openApp = useCallback(
    (appId: AppId, args?: Record<string, any>, forceNewWindow?: boolean) => {
      // Close start & search flyouts
      setIsStartOpen(false);
      setIsSearchOpen(false);
      setActiveTrayPanel(null);
      closeWidgets();

      const appMeta = APPS_LIST.find((a) => a.id === appId);
      if (!appMeta) return;
      if (appId !== 'admin' && hiddenAppIds.includes(appId)) return;

      if (appId !== 'admin') {
        trackPortfolioAnalytics('PORTFOLIO_APP_OPEN', 'interaction', `/${appId}`, {
          appId,
          appName: appMeta.name,
        });
        trackPortfolioAnalytics('PORTFOLIO_PAGE_VIEW', 'navigation', `/${appId}`, {
          appId,
          appName: appMeta.name,
        });
      }

      const allowMultiple = forceNewWindow || args?.forceNewWindow || args?.multiWindow;

      // Check if window already exists
      const existing = !allowMultiple ? windows.find((w) => w.appId === appId) : null;
      if (existing) {
        setWindows((prev) => {
          const maxZ = Math.max(0, ...prev.map((w) => w.zIndex));
          return prev.map((w) =>
            w.id === existing.id
              ? {
                  ...w,
                  isMinimized: false,
                  isFocused: true,
                  zIndex: maxZ + 1,
                  desktopId: currentDesktopId || w.desktopId || 'desktop-1',
                  args: args ? { ...w.args, ...args } : w.args,
                }
              : { ...w, isFocused: false }
          );
        });
        setActiveWindowId(existing.id);
        soundManager.playClick();
        return;
      }

      // Calculate initial position staggered
      const offset = (windows.length % 6) * 28;
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

      const isMobile = screenWidth < 640;
      const isCalculator = appId === 'calculator';
      const initialWidth = isMobile ? screenWidth : isCalculator ? 340 : appMeta.defaultWidth;
      const initialHeight = isMobile ? screenHeight - 56 : isCalculator ? 520 : appMeta.defaultHeight;

      const posX = isMobile
        ? 0
        : isCalculator
        ? Math.max(40, Math.floor((screenWidth - initialWidth) / 2))
        : Math.max(40, Math.min(screenWidth - initialWidth - 40, 80 + offset));
      const posY = isMobile
        ? 0
        : isCalculator
        ? Math.max(40, Math.floor((screenHeight - initialHeight) / 2))
        : Math.max(40, Math.min(screenHeight - initialHeight - 80, 50 + offset));

      const newId = `win-${appId}-${Date.now()}`;
      const maxZ = Math.max(0, ...windows.map((w) => w.zIndex));

      const newWindow: WindowState = {
        id: newId,
        appId,
        title: appMeta.name,
        icon: appMeta.icon,
        isMinimized: false,
        isMaximized: isMobile ? true : isCalculator ? false : true,
        isFocused: true,
        position: { x: posX, y: posY },
        size: { width: initialWidth, height: initialHeight },
        zIndex: maxZ + 1,
        desktopId: currentDesktopId || 'desktop-1',
        args,
      };

      setWindows((prev) => [...prev.map((w) => ({ ...w, isFocused: false })), newWindow]);
      setActiveWindowId(newId);
      soundManager.playOpenWindow();
    },
    [windows, currentDesktopId, hiddenAppIds, closeWidgets]
  );

  const removeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const remaining = prev.filter((w) => w.id !== id);
      const visible = remaining.filter((w) => !w.isMinimized);
      if (visible.length > 0) {
        let topWin = visible[0];
        for (const w of visible) {
          if (w.zIndex > topWin.zIndex) topWin = w;
        }
        setActiveWindowId(topWin.id);
        return remaining.map((w) => ({
          ...w,
          isFocused: w.id === topWin.id,
        }));
      } else {
        setActiveWindowId(null);
        return remaining;
      }
    });
    soundManager.playMinimizeWindow();
  }, []);

  const registerWindowCloseGuard = useCallback((id: string, guard: () => Promise<boolean>) => {
    windowCloseGuards.current.set(id, guard);
    return () => {
      if (windowCloseGuards.current.get(id) === guard) {
        windowCloseGuards.current.delete(id);
      }
    };
  }, []);

  const closeWindow = useCallback((id: string) => {
    const guard = windowCloseGuards.current.get(id);
    if (!guard) {
      removeWindow(id);
      return;
    }
    if (pendingWindowCloses.current.has(id)) return;

    pendingWindowCloses.current.add(id);
    void guard()
      .then((mayClose) => {
        if (mayClose) removeWindow(id);
      })
      .catch((error: unknown) => {
        console.error(`[OSContext] Window close guard failed for "${id}".`, error);
      })
      .finally(() => pendingWindowCloses.current.delete(id));
  }, [removeWindow]);

  const closeAllWindows = useCallback(() => {
    setWindows([]);
    setActiveWindowId(null);
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const updated = prev.map((w) => (w.id === id ? { ...w, isMinimized: true, isFocused: false } : w));
      const visible = updated.filter((w) => !w.isMinimized);
      if (visible.length > 0) {
        let topWin = visible[0];
        for (const w of visible) {
          if (w.zIndex > topWin.zIndex) topWin = w;
        }
        setActiveWindowId(topWin.id);
        return updated.map((w) => ({
          ...w,
          isFocused: w.id === topWin.id,
        }));
      } else {
        setActiveWindowId(null);
        return updated;
      }
    });
    soundManager.playMinimizeWindow();
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const maxZ = Math.max(0, ...prev.map((w) => w.zIndex));
      return prev.map((w) => {
        if (w.id === id) {
          return {
            ...w,
            isMaximized: !w.isMaximized,
            isMinimized: false,
            isFocused: true,
            zIndex: maxZ + 1,
          };
        }
        return { ...w, isFocused: false };
      });
    });
    setActiveWindowId(id);
    soundManager.playClick();
  }, []);

  const updateWindowPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, position, isMaximized: false } : w))
    );
  }, []);

  const updateWindowSize = useCallback((id: string, size: { width: number; height: number }) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, size } : w)));
  }, []);

  const snapWindow = useCallback(
    (
      id: string,
      layout:
        | 'left'
        | 'right'
        | 'top'
        | 'bottom'
        | 'top-left'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-right'
        | 'three-col-left'
        | 'three-col-center'
        | 'three-col-right'
        | 'restore'
    ) => {
      const isMobile = window.innerWidth < 640;
      const topBarH = isMobile ? 32 : 0;
      const taskbarH = 48;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight - topBarH - taskbarH;

      setWindows((prev) => {
        const maxZ = Math.max(0, ...prev.map((w) => w.zIndex));
        return prev.map((w) => {
          if (w.id !== id) return { ...w, isFocused: false };
          if (layout === 'restore') {
            return {
              ...w,
              isMaximized: false,
              isMinimized: false,
              isFocused: true,
              zIndex: maxZ + 1,
              position: isMobile
                ? { x: Math.max(0, Math.floor((screenW - Math.min(screenW * 0.94, 500)) / 2)), y: topBarH + 10 }
                : { x: Math.max(20, Math.floor((screenW - 800) / 2)), y: 40 },
              size: isMobile
                ? { width: Math.min(screenW * 0.94, 500), height: Math.min(screenH * 0.85, 520) }
                : { width: 800, height: 560 },
            };
          }

          let pos = { x: 0, y: topBarH };
          let sz = { width: Math.floor(screenW / 2), height: screenH };

          if (layout === 'top') {
            pos = { x: 0, y: topBarH };
            sz = { width: screenW, height: Math.floor(screenH / 2) };
          } else if (layout === 'bottom') {
            pos = { x: 0, y: topBarH + Math.floor(screenH / 2) };
            sz = { width: screenW, height: Math.ceil(screenH / 2) };
          } else if (layout === 'left') {
            pos = { x: 0, y: topBarH };
            sz = { width: Math.floor(screenW / 2), height: screenH };
          } else if (layout === 'right') {
            pos = { x: Math.floor(screenW / 2), y: topBarH };
            sz = { width: Math.ceil(screenW / 2), height: screenH };
          } else if (layout === 'top-left') {
            pos = { x: 0, y: topBarH };
            sz = { width: Math.floor(screenW / 2), height: Math.floor(screenH / 2) };
          } else if (layout === 'top-right') {
            pos = { x: Math.floor(screenW / 2), y: topBarH };
            sz = { width: Math.ceil(screenW / 2), height: Math.floor(screenH / 2) };
          } else if (layout === 'bottom-left') {
            pos = { x: 0, y: topBarH + Math.floor(screenH / 2) };
            sz = { width: Math.floor(screenW / 2), height: Math.ceil(screenH / 2) };
          } else if (layout === 'bottom-right') {
            pos = { x: Math.floor(screenW / 2), y: topBarH + Math.floor(screenH / 2) };
            sz = { width: Math.ceil(screenW / 2), height: Math.ceil(screenH / 2) };
          } else if (layout === 'three-col-left') {
            pos = { x: 0, y: topBarH };
            sz = { width: Math.floor(screenW / 3), height: screenH };
          } else if (layout === 'three-col-center') {
            pos = { x: Math.floor(screenW / 3), y: topBarH };
            sz = { width: Math.floor(screenW / 3), height: screenH };
          } else if (layout === 'three-col-right') {
            pos = { x: Math.floor((screenW / 3) * 2), y: topBarH };
            sz = { width: screenW - Math.floor((screenW / 3) * 2), height: screenH };
          }

          return {
            ...w,
            position: pos,
            size: sz,
            isMaximized: false,
            isMinimized: false,
            isFocused: true,
            zIndex: maxZ + 1,
          };
        });
      });
      setActiveWindowId(id);
      soundManager.playClick();
    },
    []
  );

  const showDesktop = useCallback(() => {
    setDesktopMinimizingState((prev) => {
      const nextState = !prev;
      setWindows((prevWins) => {
        if (nextState) {
          setActiveWindowId(null);
          return prevWins.map((w) => ({
            ...w,
            isMinimized: true,
            isFocused: false,
          }));
        } else {
          let topWin = prevWins[0];
          for (const w of prevWins) {
            if (w.zIndex >= (topWin?.zIndex ?? 0)) topWin = w;
          }
          setActiveWindowId(topWin?.id || null);
          return prevWins.map((w) => ({
            ...w,
            isMinimized: false,
            isFocused: topWin ? w.id === topWin.id : false,
          }));
        }
      });
      return nextState;
    });
    soundManager.playClick();
  }, []);

  // Start & Search & Tray & Notifications
  const toggleStart = useCallback(() => {
    setIsStartOpen((prev) => !prev);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setActiveTrayPanel(null);
    soundManager.playClick();
  }, []);

  const closeStart = useCallback(() => setIsStartOpen(false), []);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
    setIsStartOpen(false);
    setIsNotificationsOpen(false);
    setActiveTrayPanel(null);
    soundManager.playClick();
  }, []);

  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  const toggleNotifications = useCallback(() => {
    setIsNotificationsOpen((prev) => !prev);
    setIsStartOpen(false);
    setIsSearchOpen(false);
    setActiveTrayPanel(null);
    soundManager.playClick();
  }, []);

  const closeNotifications = useCallback(() => setIsNotificationsOpen(false), []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    soundManager.playTrashEmpty();
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const toggleTrayPanel = useCallback((panel: 'wifi' | 'volume' | 'battery' | 'calendar') => {
    setActiveTrayPanel((prev) => (prev === panel ? null : panel));
    setIsStartOpen(false);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    soundManager.playClick();
  }, []);

  const closeTrayPanels = useCallback(() => setActiveTrayPanel(null), []);

  // File System & Desktop Icons
  const createFolder = useCallback(
    (parentPath: string, name: string) => {
      const normalizedParent = normalizeVfsDestinationPath(parentPath);
      let finalName = name;
      let counter = 1;

      const isDuplicateFolder = (folderName: string) =>
        files.some(
          (f) =>
            !f.deletedAt &&
            f.parentId?.replace(/\\/g, '/').replace(/\/$/, '') === normalizedParent &&
            f.name.toLowerCase() === folderName.toLowerCase()
        );

      if (isDuplicateFolder(finalName)) {
        while (isDuplicateFolder(`${name} (${counter})`)) {
          counter++;
        }
        finalName = `${name} (${counter})`;
      }

      const cleanPath = `${normalizedParent}/${finalName}`;
      const newFolder: FileItem = {
        id: generateUniqueId('folder'),
        name: finalName,
        path: cleanPath,
        type: 'folder',
        parentId: normalizedParent,
        modified: formatDateISO(new Date()),
      };
      setFiles((prev) => [...prev.filter((f) => f.id !== newFolder.id && f.path !== newFolder.path), newFolder]);

      // Sync with desktop icons if created on Desktop
      if (normalizedParent.includes('Desktop')) {
        setDesktopIcons((prev) => [
          ...prev.filter((i) => i.filePath !== cleanPath),
          {
            id: generateUniqueId('icon'),
            name: finalName,
            filePath: cleanPath,
            icon: 'Folder',
            position: findNextAvailablePosition(prev),
            type: 'folder',
          },
        ]);
      }

      addNotification({
        title: 'Folder Created',
        message: `Created folder "${finalName}"`,
        type: 'info',
      });
      soundManager.playClick();
    },
    [files, addNotification]
  );

  const createFile = useCallback(
    (parentPath: string, name: string, content = '', extension: FileItem['extension'] = 'txt', metadata: Partial<FileItem> = {}) => {
      const normalizedParent = normalizeVfsDestinationPath(parentPath);
      const lastDotIndex = name.lastIndexOf('.');
      let baseName = name;
      let extStr = extension ? `.${extension}` : '';
      let effectiveExt = extension || 'txt';

      if (lastDotIndex > 0) {
        baseName = name.substring(0, lastDotIndex);
        extStr = name.substring(lastDotIndex);
        effectiveExt = name.substring(lastDotIndex + 1).toLowerCase() || extension || 'txt';
      }

      let finalName = lastDotIndex > 0 ? name : `${baseName}${extStr}`;
      let counter = 1;

      // Check for duplicates strictly within this specific folder path
      const isDuplicateInFolder = (fileName: string) =>
        files.some(
          (f) =>
            !f.deletedAt &&
            f.parentId?.replace(/\\/g, '/').replace(/\/$/, '') === normalizedParent &&
            f.name.toLowerCase() === fileName.toLowerCase()
        );

      if (isDuplicateInFolder(finalName)) {
        while (isDuplicateInFolder(`${baseName} (${counter})${extStr}`)) {
          counter++;
        }
        finalName = `${baseName} (${counter})${extStr}`;
      }

      const cleanPath = `${normalizedParent}/${finalName}`;
      const newFile: FileItem = {
        ...metadata,
        id: generateUniqueId('file'),
        name: finalName,
        path: cleanPath,
        type: 'file',
        extension: effectiveExt,
        content,
        size: `${(content.length / 1024).toFixed(1)} KB`,
        parentId: normalizedParent,
        modified: formatDateISO(new Date()),
      };
      setFiles((prev) => [...prev.filter((f) => f.id !== newFile.id && f.path !== newFile.path), newFile]);

      // Sync with desktop icons if created on Desktop
      if (normalizedParent.includes('Desktop')) {
        setDesktopIcons((prev) => [
          ...prev.filter((i) => i.filePath !== cleanPath),
          {
            id: generateUniqueId('icon'),
            name: finalName,
            filePath: cleanPath,
            icon: 'FileText',
            position: findNextAvailablePosition(prev),
            type: 'file',
          },
        ]);
      }

      addNotification({
        title: 'File Created',
        message: `Created file "${finalName}"`,
        type: 'success',
      });
      soundManager.playFileOperation();
    },
    [files, addNotification]
  );

  const compressToZip = useCallback(
    (items: FileItem[] | FileItem, targetParentPath?: string) => {
      const itemsList = Array.isArray(items) ? items : [items];
      if (itemsList.length === 0) return;

      const firstItem = itemsList[0];
      const parent = normalizeVfsDestinationPath(
        targetParentPath || firstItem.parentId || D_DRIVE_FOLDER_PATHS.documents
      );

      const zipBaseName =
        itemsList.length === 1
          ? firstItem.name.includes('.') && firstItem.type === 'file'
            ? firstItem.name.substring(0, firstItem.name.lastIndexOf('.'))
            : firstItem.name
          : 'Compressed_Archive';

      let zipName = `${zipBaseName}.zip`;
      let counter = 1;
      while (files.some((f) => f.parentId === parent && f.name.toLowerCase() === zipName.toLowerCase())) {
        zipName = `${zipBaseName} (${counter}).zip`;
        counter++;
      }

      const archiveEntries: Record<string, { content?: string; size?: string; type: string }> = {};
      itemsList.forEach((item) => {
        if (item.type === 'file') {
          archiveEntries[item.name] = {
            content: item.content || '',
            size: item.size || '1.0 KB',
            type: 'file',
          };
        } else {
          const subFiles = files.filter((f) => f.path.startsWith(item.path + '/') || f.path === item.path);
          subFiles.forEach((sf) => {
            const relPath = sf.path.substring(item.parentId.length + 1);
            archiveEntries[relPath] = {
              content: sf.content || '',
              size: sf.size || '1.0 KB',
              type: sf.type,
            };
          });
        }
      });

      const zipContent = JSON.stringify(
        {
          format: 'win11_virtual_zip',
          created: new Date().toISOString(),
          entries: archiveEntries,
        },
        null,
        2
      );

      const cleanPath = `${parent}/${zipName}`.replace(/\/\//g, '/');
      const newZipFile: FileItem = {
        id: generateUniqueId('file-zip'),
        name: zipName,
        path: cleanPath,
        type: 'file',
        extension: 'zip',
        content: zipContent,
        size: `${Math.max(0.5, zipContent.length / 1024).toFixed(1)} KB`,
        parentId: parent,
        modified: formatDateISO(new Date()),
      };

      setFiles((prev) => [...prev.filter((f) => f.id !== newZipFile.id && f.path !== newZipFile.path), newZipFile]);

      if (parent.includes('Desktop')) {
        setDesktopIcons((prev) => [
          ...prev.filter((i) => i.filePath !== cleanPath),
          {
            id: generateUniqueId('icon'),
            name: zipName,
            filePath: cleanPath,
            icon: 'FileArchive',
            position: findNextAvailablePosition(prev),
            type: 'file',
          },
        ]);
      }

      soundManager.playClick();
      addNotification({
        title: 'ZIP Archive Created',
        message: `Successfully compressed ${itemsList.length} item(s) into "${zipName}".`,
        type: 'success',
      });
    },
    [files, addNotification]
  );

  const extractZip = useCallback(
    (zipFile: FileItem, targetParentPath?: string) => {
      const parent = normalizeVfsDestinationPath(
        targetParentPath || zipFile.parentId || D_DRIVE_FOLDER_PATHS.documents
      );
      const folderBaseName = zipFile.name.replace(/\.zip$/i, '');
      let folderName = folderBaseName;
      let counter = 1;
      while (files.some((f) => f.parentId === parent && f.name.toLowerCase() === folderName.toLowerCase())) {
        folderName = `${folderBaseName} (${counter})`;
        counter++;
      }

      const extractedFolderPath = `${parent}/${folderName}`.replace(/\/\//g, '/');
      const newFolder: FileItem = {
        id: generateUniqueId('folder-ext'),
        name: folderName,
        path: extractedFolderPath,
        type: 'folder',
        parentId: parent,
        modified: formatDateISO(new Date()),
      };

      const extractedItems: FileItem[] = [newFolder];

      try {
        if (zipFile.content && zipFile.content.includes('win11_virtual_zip')) {
          const parsed = JSON.parse(zipFile.content);
          if (parsed.entries) {
            Object.entries(parsed.entries).forEach(([relPath, data]: [string, any]) => {
              const parts = relPath.split('/');
              const itemName = parts.pop() || relPath;
              const subDir = parts.length > 0 ? `${extractedFolderPath}/${parts.join('/')}` : extractedFolderPath;
              const itemPath = `${extractedFolderPath}/${relPath}`.replace(/\/\//g, '/');
              const ext = itemName.includes('.') ? itemName.substring(itemName.lastIndexOf('.') + 1).toLowerCase() : undefined;

              extractedItems.push({
                id: generateUniqueId('file-ext'),
                name: itemName,
                path: itemPath,
                type: data.type === 'folder' ? 'folder' : 'file',
                extension: ext,
                content: data.content || '',
                size: data.size || '1.0 KB',
                parentId: subDir,
                modified: formatDateISO(new Date()),
              });
            });
          }
        } else {
          extractedItems.push({
            id: generateUniqueId('file-ext-sample'),
            name: `${folderBaseName}_extracted.txt`,
            path: `${extractedFolderPath}/${folderBaseName}_extracted.txt`,
            type: 'file',
            extension: 'txt',
            content: zipFile.content || 'Extracted content from zip archive.',
            size: '1.2 KB',
            parentId: extractedFolderPath,
            modified: formatDateISO(new Date()),
          });
        }
      } catch {
        extractedItems.push({
          id: generateUniqueId('file-ext-sample'),
          name: `${folderBaseName}_extracted.txt`,
          path: `${extractedFolderPath}/${folderBaseName}_extracted.txt`,
          type: 'file',
          extension: 'txt',
          content: zipFile.content || 'Extracted content from archive.',
          size: '1.0 KB',
          parentId: extractedFolderPath,
          modified: formatDateISO(new Date()),
        });
      }

      const extractedIds = new Set(extractedItems.map((e) => e.id));
      const extractedPaths = new Set(extractedItems.map((e) => e.path));
      setFiles((prev) => [...prev.filter((f) => !extractedIds.has(f.id) && !extractedPaths.has(f.path)), ...extractedItems]);

      soundManager.playClick();
      addNotification({
        title: 'Archive Extracted',
        message: `Extracted files to folder "${folderName}".`,
        type: 'success',
      });
    },
    [files, addNotification]
  );

  const deleteFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const fileToDelete = prev.find((f) => f.id === id);
        if (fileToDelete) {
          const itemWithTimestamp: FileItem = {
            ...fileToDelete,
            deletedAt: Date.now(),
          };
          setDeletedFiles((del) => {
            const alreadyExists = del.some((d) => d.id === fileToDelete.id || d.path === fileToDelete.path);
            if (alreadyExists) return del;
            return [...del, itemWithTimestamp];
          });
          // Also remove corresponding desktop icon if exists
          setDesktopIcons((icons) =>
            icons.filter((i) => i.filePath !== fileToDelete.path && i.id !== id)
          );
        }
        return prev.filter((f) => f.id !== id);
      });
      soundManager.playTrashEmpty();
      addNotification({
        title: 'Moved to Recycle Bin',
        message: 'Item has been moved to Recycle Bin (auto-deleted in 30 days).',
        type: 'info',
      });
    },
    [addNotification]
  );

  const deleteFiles = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idsSet = new Set(ids);
      setFiles((prev) => {
        const filesToDelete = prev.filter((f) => idsSet.has(f.id));
        if (filesToDelete.length > 0) {
          const itemsWithTimestamp: FileItem[] = filesToDelete.map((f) => ({
            ...f,
            deletedAt: Date.now(),
          }));
          setDeletedFiles((del) => {
            const existingIds = new Set(del.map((d) => d.id));
            const newToAdd = itemsWithTimestamp.filter((item) => !existingIds.has(item.id));
            return [...del, ...newToAdd];
          });
          const pathsToDelete = new Set(filesToDelete.map((f) => f.path));
          setDesktopIcons((icons) =>
            icons.filter((i) => (!i.filePath || !pathsToDelete.has(i.filePath)) && !idsSet.has(i.id))
          );
        }
        return prev.filter((f) => !idsSet.has(f.id));
      });
      soundManager.playTrashEmpty();
      addNotification({
        title: 'Moved to Recycle Bin',
        message: `${ids.length} items moved to Recycle Bin.`,
        type: 'info',
      });
    },
    [addNotification]
  );

  const restoreFile = useCallback((id: string) => {
    setDeletedFiles((del) => {
      const fileToRestore = del.find((f) => f.id === id);
      if (fileToRestore) {
        const restoredItem: FileItem = { ...fileToRestore };
        delete restoredItem.deletedAt;
        setFiles((f) => {
          const alreadyInFiles = f.some((item) => item.id === fileToRestore.id || item.path === fileToRestore.path);
          if (alreadyInFiles) return f.map((item) => item.id === fileToRestore.id ? restoredItem : item);
          return [...f, restoredItem];
        });
      }
      return del.filter((f) => f.id !== id);
    });
    soundManager.playFileOperation();
    addNotification({
      title: 'File Restored',
      message: 'Item restored to original location.',
      type: 'success',
    });
  }, [addNotification]);

  const deletePermanently = useCallback((id: string) => {
    const target = deletedFiles.find((file) => file.id === id);
    if (target?.localCaptureId) {
      void captureStorageService.delete(target.localCaptureId).catch((error: unknown) => {
        console.error('[OSContext] Could not permanently delete the local camera capture.', error);
      });
    }
    storageService.deleteFileFromServer(id);
    setDeletedFiles((del) => del.filter((f) => f.id !== id));
    soundManager.playTrashEmpty();
    addNotification({
      title: 'Permanently Deleted',
      message: 'Item removed permanently from storage.',
      type: 'info',
    });
  }, [deletedFiles, addNotification]);

  const emptyRecycleBin = useCallback(() => {
    deletedFiles.forEach((file) => {
      storageService.deleteFileFromServer(file.id);
      if (file.localCaptureId) {
        void captureStorageService.delete(file.localCaptureId).catch((error: unknown) => {
          console.error('[OSContext] Could not permanently delete a local camera capture while emptying Recycle Bin.', error);
        });
      }
    });
    setDeletedFiles([]);
    soundManager.playTrashEmpty();
    addNotification({
      title: 'Recycle Bin Emptied',
      message: 'All items permanently removed.',
      type: 'system',
    });
  }, [deletedFiles, addNotification]);

  const updateDesktopIconPosition = useCallback((id: string, position: { gridX: number; gridY: number }) => {
    setDesktopIcons((prev) => prev.map((icon) => (icon.id === id ? { ...icon, position } : icon)));
  }, []);

  const addOrMoveDesktopIcon = useCallback((iconItem: DesktopIconItem) => {
    setDesktopIcons((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.id === iconItem.id || (iconItem.appId && i.appId === iconItem.appId)
      );
      if (existingIndex !== -1) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          name: iconItem.name || copy[existingIndex].name,
          icon: iconItem.icon || copy[existingIndex].icon,
          position: iconItem.position,
        };
        return copy;
      }
      return [...prev, iconItem];
    });
  }, []);

  const renameDesktopIcon = useCallback(
    (id: string, newName: string) => {
      setDesktopIcons((prevIcons) => {
        const targetIcon = prevIcons.find((i) => i.id === id);
        if (targetIcon) {
          const oldFilePath = targetIcon.filePath;
          const parentDir = oldFilePath
            ? oldFilePath.substring(0, oldFilePath.lastIndexOf('/'))
            : D_DRIVE_FOLDER_PATHS.desktop;
          const newFilePath = `${parentDir}/${newName}`.replace(/\/\//g, '/');

          if (oldFilePath) {
            setFiles((prevFiles) =>
              prevFiles.map((f) => {
                if (f.path === oldFilePath || f.id === id) {
                  return { ...f, name: newName, path: newFilePath };
                }
                if (f.path.startsWith(oldFilePath + '/')) {
                  const subPath = f.path.substring(oldFilePath.length);
                  return { ...f, path: `${newFilePath}${subPath}` };
                }
                return f;
              })
            );
          }

          return prevIcons.map((i) => (i.id === id ? { ...i, name: newName, filePath: newFilePath } : i));
        }
        return prevIcons;
      });
      addNotification({
        title: 'Item Renamed',
        message: `Renamed to "${newName}"`,
        type: 'success',
      });
    },
    [addNotification]
  );

  const deleteDesktopIcon = useCallback(
    (id: string) => {
      setDesktopIcons((prevIcons) => {
        const targetIcon = prevIcons.find((i) => i.id === id);
        if (targetIcon && targetIcon.filePath) {
          setFiles((prevFiles) => {
            const fileToDelete = prevFiles.find((f) => f.path === targetIcon.filePath || f.id === id);
            if (fileToDelete) {
              setDeletedFiles((del) => [...del, fileToDelete]);
              return prevFiles.filter((f) => f.id !== fileToDelete.id && f.parentId !== fileToDelete.path);
            }
            return prevFiles;
          });
        }
        return prevIcons.filter((i) => i.id !== id);
      });
      soundManager.playTrashEmpty();
      addNotification({
        title: 'Item Deleted',
        message: 'Item moved to Recycle Bin.',
        type: 'info',
      });
    },
    [addNotification]
  );

  const uploadFileToVFS = useCallback(
    async (targetFolder: string, file: File): Promise<FileItem> => {
      const normalizedTargetFolder = normalizeVfsDestinationPath(targetFolder);
      let previewContent = '';
      const name = file.name;
      const ext = name.includes('.') ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : '';
      let extension: FileItem['extension'] = (ext || 'txt') as FileItem['extension'];

      // Generate base64 preview for client display while server stores actual file
      try {
        if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') || ['pdf', 'zip', 'rar', '7z', 'mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
          previewContent = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string) || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
          });
        } else {
          previewContent = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string) || '');
            reader.onerror = () => resolve('');
            reader.readAsText(file);
          });
        }
      } catch (e) {
        console.warn('Preview generation warning:', e);
      }

      let finalName = name;
      let counter = 1;
      const baseName = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
      const extStr = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';

      while (files.some((f) => f.parentId === normalizedTargetFolder && f.name === finalName)) {
        finalName = `${baseName} (${counter})${extStr}`;
        counter++;
      }

      const cleanPath = `${normalizedTargetFolder}/${finalName}`.replace(/\/\//g, '/');

      let uploadedItem: FileItem;

      try {
        // Send file to backend API at /api/files/upload, saving physical file to uploads/ and metadata to DB
        uploadedItem = await storageService.uploadFileToServer(normalizedTargetFolder, file, cleanPath);
        if (previewContent && !uploadedItem.content) {
          uploadedItem.content = previewContent;
        }
      } catch (uploadErr) {
        console.warn('[uploadFileToVFS] Server API upload encountered an issue, creating local VFS fallback:', uploadErr);
        const sizeStr = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(0.1, file.size / 1024).toFixed(1)} KB`;

        uploadedItem = {
          id: generateUniqueId('file-upload'),
          name: finalName,
          path: cleanPath,
          type: 'file',
          extension,
          content: previewContent,
          size: sizeStr,
          parentId: normalizedTargetFolder,
          modified: formatDateISO(new Date()),
        };
        await storageService.saveFile(uploadedItem);
      }

      setFiles((prev) => [...prev.filter((f) => f.id !== uploadedItem.id && f.path !== uploadedItem.path), uploadedItem]);

      if (normalizedTargetFolder.includes('Desktop')) {
        setDesktopIcons((prev) => [
          ...prev.filter((i) => i.filePath !== cleanPath),
          {
            id: generateUniqueId('icon'),
            name: finalName,
            filePath: cleanPath,
            icon: extension === 'png' || extension === 'jpg' || extension === 'jpeg' ? 'Image' : 'FileText',
            position: findNextAvailablePosition(prev),
            type: 'file',
          },
        ]);
      }

      addNotification({
        title: 'File Uploaded',
        message: `"${finalName}" saved to server & persistent storage`,
        type: 'success',
      });

      return uploadedItem;
    },
    [files, addNotification]
  );

  const saveMediaFile = useCallback(
    (folderPath: string, fileName: string, dataUrl: string, extension: FileItem['extension']) => {
      const normalizedFolderPath = normalizeVfsDestinationPath(folderPath);
      let finalName = fileName;
      let counter = 1;
      const base = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : `.${extension}`;

      while (files.some((f) => f.parentId === normalizedFolderPath && f.name === finalName)) {
        finalName = `${base}_${counter}${ext}`;
        counter++;
      }

      const cleanPath = `${normalizedFolderPath}/${finalName}`.replace(/\/\//g, '/');
      const approxBytes = Math.round(dataUrl.length * 0.75);
      const sizeStr = approxBytes > 1024 * 1024
        ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(0.1, approxBytes / 1024).toFixed(1)} KB`;

      const mediaFile: FileItem = {
        id: generateUniqueId('media'),
        name: finalName,
        path: cleanPath,
        type: 'file',
        extension,
        content: dataUrl,
        size: sizeStr,
        parentId: normalizedFolderPath,
        modified: formatDateISO(new Date()),
      };

      setFiles((prev) => [...prev.filter((f) => f.id !== mediaFile.id && f.path !== mediaFile.path), mediaFile]);

      if (folderPath.includes('Desktop')) {
        setDesktopIcons((prev) => [
          ...prev.filter((i) => i.filePath !== cleanPath),
          {
            id: generateUniqueId('icon'),
            name: finalName,
            filePath: cleanPath,
            icon: extension === 'mp4' || extension === 'webm' ? 'Video' : 'Image',
            position: findNextAvailablePosition(prev),
            type: 'file',
          },
        ]);
      }

      addNotification({
        title: 'Media Saved',
        message: `Saved "${finalName}" to ${folderPath}`,
        type: 'success',
      });
    },
    [files, addNotification]
  );

  const resetVFS = useCallback(async () => {
    await storageService.clearAll();
    setFiles(MIGRATED_INITIAL_FILES);
    setDeletedFiles([]);
    addNotification({
      title: 'VFS Reset',
      message: 'Virtual File System restored to default factory state.',
      type: 'system',
    });
  }, [addNotification]);

  const exportVFSBackup = useCallback(() => {
    const data = JSON.stringify({ files, deletedFiles, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `win11_vfs_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [files, deletedFiles]);

  const refreshFileSystem = useCallback(async (targetPath?: string) => {
    try {
      const saved = await storageService.loadFiles();
      if (saved && saved.length > 0) {
        setFiles(deduplicateFiles([
          ...MIGRATED_INITIAL_FILES,
          ...normalizeVirtualDriveFiles(excludePortfolioMediaFromDesktop(saved)),
        ]));
        if (saved.some(isMarkedDocumentsDemoFile)) {
          await removeMarkedDocumentsDemoFilesFromServer();
        }
      }
      const savedDel = await storageService.loadDeletedFiles();
      if (savedDel && savedDel.length > 0) {
        setDeletedFiles(deduplicateFiles(normalizeVirtualDriveFiles(savedDel, false)));
      }

    } catch (err) {
      console.error('Failed to reload filesystem from storage drive:', err);
    }
  }, []);

  // Process Metrics for Task Manager
  const processes: ProcessMetric[] = windows.map((w, index) => ({
    appId: w.appId,
    name: w.title,
    pid: 1000 + index * 123 + w.appId.length * 4,
    cpu: Math.floor(Math.random() * 8) + (w.isFocused ? 12 : 2),
    memory: Math.floor(Math.random() * 45) + 60,
    status: w.isMinimized ? 'Suspended' : 'Running',
  }));

  const endProcess = useCallback((appId: AppId) => {
    setWindows((prev) => prev.filter((w) => w.appId !== appId));
    addNotification({
      title: 'Task Ended',
      message: `Process ${appId} terminated by Task Manager.`,
      type: 'warning',
    });
    soundManager.playClick();
  }, [addNotification]);

  // Easter Eggs
  const triggerBsod = useCallback(() => {
    setIsBsod(true);
    soundManager.playTrashEmpty();
  }, []);

  const dismissBsod = useCallback(() => {
    setIsBsod(false);
    soundManager.playStartup();
  }, []);

  const toggleMatrixMode = useCallback(() => {
    setIsMatrixMode((prev) => !prev);
    soundManager.playClick();
  }, []);

  // Unified Global Copy/Cut Clipboard History Listener
  useEffect(() => {
    const handleGlobalCopy = () => {
      try {
        const selected = window.getSelection()?.toString();
        if (selected && selected.trim().length > 0) {
          addClipboardHistory({
            type: 'text',
            content: selected,
            label: selected.slice(0, 120),
          });
        }
      } catch {}
    };

    window.addEventListener('copy', handleGlobalCopy);
    window.addEventListener('cut', handleGlobalCopy);
    return () => {
      window.removeEventListener('copy', handleGlobalCopy);
      window.removeEventListener('cut', handleGlobalCopy);
    };
  }, [addClipboardHistory]);

  // Unified Global Keyboard Shortcuts (Win+E, Win+D, Win+I, Win+V, Win+Shift+S, Alt+F4, Ctrl+Alt+Del)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        setIsStartOpen(false);
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
        setActiveTrayPanel(null);
        setIsClipboardOpen(false);
        setIsSnippingOpen(false);
      }

      // Windows key + V (or Ctrl+Alt+V) -> Clipboard History
      if ((e.metaKey && e.key.toLowerCase() === 'v') || (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'v')) {
        e.preventDefault();
        toggleClipboard();
        return;
      }

      // Windows key + Shift + S -> Snipping tool
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSnipping();
        return;
      }

      // Windows key + G -> Game bar
      if (e.metaKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        toggleGameBar();
        return;
      }

      // Alt + F4 -> Close active focused window
      if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        if (activeWindowId) {
          closeWindow(activeWindowId);
        }
        return;
      }

      if (!isInput) {
        // Meta or Super key (Windows key) alone
        if (e.key === 'Meta') {
          toggleStart();
        }
        if (e.altKey && e.ctrlKey && (e.key === 'Delete' || e.key === 't')) {
          e.preventDefault();
          openApp('taskmanager');
        }
        if (e.metaKey && e.key.toLowerCase() === 'e') {
          e.preventDefault();
          openApp('explorer');
        }
        if (e.metaKey && e.key.toLowerCase() === 'i') {
          e.preventDefault();
          openApp('settings');
        }
        if (e.metaKey && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          showDesktop();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleStart, openApp, showDesktop, toggleClipboard, openSnipping, toggleGameBar, closeWindow, activeWindowId]);

  // Global listener to close context menu on left click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Prevent synthetic click after long press from instantly dismissing the newly opened menu
      if ((window as any).__lastLongPressTime && Date.now() - (window as any).__lastLongPressTime < 500) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-contextmenu="true"]')) {
        return;
      }
      setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Mobile / Android Hardware Back Button & Browser History Stack
  useEffect(() => {
    try {
      window.history.pushState({ osState: 'root' }, '');
    } catch {
      // safe fallback
    }

    const handlePopState = () => {
      try {
        window.history.pushState({ osState: 'active' }, '');
      } catch {
        // safe fallback
      }

      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      if (propertiesTarget) {
        setPropertiesTarget(null);
        return;
      }
      if (isStartOpen) {
        setIsStartOpen(false);
        return;
      }
      if (isSearchOpen) {
        setIsSearchOpen(false);
        return;
      }
      if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
        return;
      }
      if (activeTrayPanel) {
        setActiveTrayPanel(null);
        return;
      }
      if (isTouchKeyboardOpen) {
        setIsTouchKeyboardOpen(false);
        return;
      }
      if (windows.length > 0) {
        const currentActive = windows.find((w) => w.id === activeWindowId && !w.isMinimized);
        if (currentActive) {
          minimizeWindow(currentActive.id);
        } else {
          const openWin = windows.find((w) => !w.isMinimized);
          if (openWin) minimizeWindow(openWin.id);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    contextMenu,
    propertiesTarget,
    isStartOpen,
    isSearchOpen,
    isNotificationsOpen,
    activeTrayPanel,
    isTouchKeyboardOpen,
    windows,
    activeWindowId,
    minimizeWindow,
  ]);

  // Sync Theme & Accent Color CSS variables
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (settings.accentColor) {
      document.documentElement.style.setProperty('--accent-color', settings.accentColor);
      document.documentElement.style.setProperty('--accent-color-hover', settings.accentColor);
      document.documentElement.style.setProperty('--accent-color-light', settings.accentColor + '25');
    }

    const iconCol = settings.iconColor || settings.accentColor || '#0078d4';
    document.documentElement.style.setProperty('--icon-color', iconCol);
  }, [settings.theme, settings.accentColor, settings.iconColor]);

  const sendContactMessage = useCallback(async (payload: ContactSubmissionPayload): Promise<ContactSubmissionResponse> => {
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || data.error || `Server returned error ${response.status}`);
        }
        return data;
      } else {
        const errorText = await response.text();
        const cleanText = errorText.includes('<!doctype html>') || errorText.includes('<!DOCTYPE html>')
          ? 'HTML Error Page received (likely route or proxy timeout issue)'
          : errorText.substring(0, 150);
        throw new Error(`Server returned non-JSON response (${response.status}): ${cleanText}`);
      }
    } catch (err: any) {
      console.error('[OSContext] Failed to send contact message:', err);
      throw err;
    }
  }, []);

  return (
    <OSContext.Provider
      value={{
        windows,
        activeWindowId,
        openApp,
        closeWindow,
        registerWindowCloseGuard,
        closeAllWindows,
        minimizeWindow,
        maximizeWindow,
        focusWindow,
        updateWindowPosition,
        updateWindowSize,
        snapWindow,
        showDesktop,

        // Virtual Desktops
        desktops,
        currentDesktopId,
        createDesktop,
        removeDesktop,
        switchDesktop,
        renameDesktop,
        moveWindowToDesktop,
        isTaskViewOpen,
        toggleTaskView,
        closeTaskView,

        // Clipboard History
        clipboardHistory,
        addClipboardHistory,
        removeClipboardHistory,
        clearClipboardHistory,
        togglePinClipboardItem,
        isClipboardOpen,
        toggleClipboard,
        closeClipboard,

        // Snipping Tool
        isSnippingOpen,
        openSnipping,
        closeSnipping,

        // Xbox Game Bar
        isGameBarOpen,
        toggleGameBar,
        closeGameBar,

        // Alt+Tab
        isAltTabOpen,
        openAltTab,
        closeAltTab,

        // Widgets
        isWidgetsOpen,
        toggleWidgets,
        closeWidgets,

        contextMenu,
        showContextMenu,
        closeContextMenu,

        clipboard,
        copyFile,
        cutFile,
        copyFiles,
        cutFiles,
        pasteFile,

        pinnedAppIds,
        pinToTaskbar,
        unpinFromTaskbar,
        reorderPinnedApps,

        startPinnedAppIds,
        pinToStart,
        unpinFromStart,
        togglePinToStart,
        isPinnedToStart,

        propertiesTarget,
        openProperties,
        closeProperties,

        powerState,
        setPowerState,

        settings,
        updateSettings,
        apps: APPS_LIST.filter((app) => !hiddenAppIds.includes(app.id) && (app.id !== 'admin' || adminAppEnabledInStart)),
        hiddenAppIds,
        updateHiddenAppIds,
        adminAppEnabledInStart,
        setAdminAppEnabledInStart,
        applyPublishedAppLayout,

        isStartOpen,
        toggleStart,
        closeStart,
        isSearchOpen,
        toggleSearch,
        closeSearch,
        isNotificationsOpen,
        toggleNotifications,
        closeNotifications,
        notifications,
        addNotification,
        clearNotifications,
        markNotificationRead,
        activeTrayPanel,
        toggleTrayPanel,
        closeTrayPanels,

        files,
        deletedFiles,
        desktopIcons,
        driveLabels,
        updateDriveLabel,
        createFolder,
        createFile,
        deleteFile,
        deleteFiles,
        restoreFile,
        deletePermanently,
        emptyRecycleBin,
        updateDesktopIconPosition,
        addOrMoveDesktopIcon,
        renameDesktopIcon,
        deleteDesktopIcon,
        renameFile,
        moveFile,
        updateFileContent,
        updateFileAttributes,
        compressToZip,
        extractZip,
        sortDesktopIcons,
        uploadFileToVFS,
        saveMediaFile,
        resetVFS,
        exportVFSBackup,
        refreshFileSystem,

        processes,
        endProcess,

        isBsod,
        triggerBsod,
        dismissBsod,
        isMatrixMode,
        toggleMatrixMode,

        isTouchKeyboardOpen,
        openTouchKeyboard,
        closeTouchKeyboard,
        toggleTouchKeyboard,
        orientation,
        isGlobalLoading,
        globalProgress,
        triggerLoading,

        sendContactMessage,
      }}
    >
      {children}
    </OSContext.Provider>
  );
};

export const useOS = () => {
  const context = useContext(OSContext);
  if (!context) throw new Error('useOS must be used within an OSProvider');
  return context;
};
