import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { FileItem, AppId } from '../../types';
import { AppIcon } from '../common/AppIcon';
import { MediaThumbnail } from '../common/MediaThumbnail';
import { SnapLayoutMenu } from '../window/SnapLayoutMenu';
import { ShareModal } from '../common/ShareModal';
import { VirtualDriveIcon } from '../common/VirtualDriveIcon';
import { calculateDriveMetrics } from '../../utils/storageMetrics';
import { isMediaFile } from '../../utils/fileAssociations';
import { haptics } from '../../utils/haptics';
import { soundManager } from '../../utils/sound';
import { useTouchSensitivity } from '../../hooks/useTouchSensitivity';
import { useVirtualDDriveFiles } from '../../hooks/useVirtualDDriveFiles';
import { formatDateISO } from '../../utils/dateTime';
import { LOCAL_CAPTURE_CONTENT_PREFIX } from '../../services/captureStorageService';
import {
  D_DRIVE_FOLDER_PATHS,
  getLegacyDDriveChildren,
  isCanonicalDDrivePath,
  isCanonicalDDriveFolderPath,
  isLegacyDDrivePath,
} from '../../utils/virtualDDrive';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Download,
  RotateCcw,
  RotateCw,
  Search,
  Grid,
  List,
  Folder,
  FileText,
  FileCode,
  Image as ImageIcon,
  File,
  HardDrive,
  Trash2,
  AlertTriangle,
  Info,
  X,
  ChevronRight,
  ChevronDown,
  User,
  Terminal,
  Globe,
  Briefcase,
  Award,
  Settings,
  Gamepad2,
  Sparkles,
  Mail,
  Plus,
  Scissors,
  Copy,
  Clipboard,
  Monitor,
  Music,
  Film,
  Home,
  Pin,
  PinOff,
  Minus,
  Square,
  Maximize2,
  ArrowUpDown,
  ArrowDown,
  Check,
  CheckSquare,
  PanelRight,
  PanelLeft,
  Share2,
  Wrench,
  FolderArchive,
  Link2,
  Lock,
  SlidersHorizontal,
  MoreHorizontal,
  TableProperties,
  Rows3,
  Columns2,
  Tv,
  LayoutGrid,
  Menu,
  PanelRightClose,
} from 'lucide-react';

interface TabItem {
  id: string;
  path: string;
  history: string[];
  historyIndex: number;
}

interface FileExplorerAppProps {
  windowId?: string;
  initialPath?: string;
}

type QuickAccessItem = { id: string; name: string; path: string; icon: string };

const DEFAULT_QUICK_ACCESS: QuickAccessItem[] = [
  { id: 'qa-desktop', name: 'Desktop', path: D_DRIVE_FOLDER_PATHS.desktop, icon: 'Monitor' },
  { id: 'qa-downloads', name: 'Downloads', path: D_DRIVE_FOLDER_PATHS.downloads, icon: 'Download' },
  { id: 'qa-documents', name: 'Documents', path: D_DRIVE_FOLDER_PATHS.documents, icon: 'FileText' },
  { id: 'qa-pictures', name: 'Pictures', path: D_DRIVE_FOLDER_PATHS.pictures, icon: 'Image' },
  { id: 'qa-videos', name: 'Videos', path: D_DRIVE_FOLDER_PATHS.videos, icon: 'Film' },
  { id: 'qa-audio', name: 'Audio', path: D_DRIVE_FOLDER_PATHS.audio, icon: 'Music' },
  { id: 'qa-projects', name: 'Projects', path: D_DRIVE_FOLDER_PATHS.projects, icon: 'Briefcase' },
  { id: 'qa-certificates', name: 'Certificates', path: D_DRIVE_FOLDER_PATHS.certificates, icon: 'Award' },
  { id: 'qa-aboutme', name: 'About Me', path: D_DRIVE_FOLDER_PATHS.aboutMe, icon: 'User' },
];

const QUICK_ACCESS_D_MIGRATION_KEY = 'win11_quick_access_d_drive_v3';

const normalizeQuickAccessItems = (items: QuickAccessItem[], addMissingDefaults = false): QuickAccessItem[] => {
  const normalizedItems = items
    .filter((item) => item && typeof item.path === 'string')
    .flatMap((item) => {
      const path = item.path.replace(/\\/g, '/').replace(/\/+$/, '');
      const defaultItem = DEFAULT_QUICK_ACCESS.find((candidate) => candidate.path.toLowerCase() === path.toLowerCase());
      if (!defaultItem) return [];
      return {
        ...defaultItem,
        ...item,
        id: typeof item.id === 'string' ? item.id : defaultItem.id,
        name: defaultItem.name,
        path: defaultItem.path,
        icon: defaultItem.icon,
      };
    });
  const seenPaths = new Set<string>();
  const migrated = normalizedItems.filter((item) => {
    const key = item.path.toLowerCase();
    if (!DEFAULT_QUICK_ACCESS.some((defaultItem) => defaultItem.path.toLowerCase() === key)) return false;
    if (seenPaths.has(key)) return false;
    seenPaths.add(key);
    return true;
  });
  const existingPaths = new Set(migrated.map((item) => item.path.toLowerCase()));
  const missingDefaults = DEFAULT_QUICK_ACCESS.filter((item) => !existingPaths.has(item.path.toLowerCase()));
  return addMissingDefaults || missingDefaults.length > 0 ? [...migrated, ...missingDefaults] : migrated;
};

export const FileExplorerApp: React.FC<FileExplorerAppProps> = ({ windowId, initialPath }) => {
  const {
    files: storedFiles,
    openApp,
    createFolder,
    createFile,
    deleteFile,
    deleteFiles,
    renameFile,
    moveFile,
    copyFile,
    copyFiles,
    cutFile,
    cutFiles,
    pasteFile,
    clipboard,
    showContextMenu,
    openProperties,
    driveLabels,
    updateDriveLabel,
    compressToZip,
    extractZip,
    exportVFSBackup,
    resetVFS,
    deletedFiles,
    restoreFile,
    deletePermanently,
    emptyRecycleBin,
    addNotification,
    settings,
    updateSettings,
    windows,
    activeWindowId,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    snapWindow,
    refreshFileSystem,
  } = useOS();
  const { user } = useAuth();
  const files = useVirtualDDriveFiles(storedFiles, (title, message) => addNotification({
    title,
    message,
    type: 'warning',
    appId: 'explorer',
  }));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const myWindow = (windowId ? windows.find((w) => w.id === windowId) : null) || windows.find((w) => w.appId === 'explorer');
  const normalizedInitialPath = initialPath?.replace(/\\/g, '/').replace(/\/+$/, '');
  const mappedInitialPath = normalizedInitialPath === 'C:' ||
    normalizedInitialPath === 'This PC' ||
    (normalizedInitialPath && isCanonicalDDrivePath(normalizedInitialPath))
    ? normalizedInitialPath
    : 'This PC';

  // Tabs state
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: 'tab-1',
      path: mappedInitialPath,
      history: [mappedInitialPath],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

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

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || {
    id: 'tab-1',
    path: 'This PC',
    history: ['This PC'],
    historyIndex: 0,
  };

  const currentPath = activeTab.path;
  const history = activeTab.history;
  const historyIndex = activeTab.historyIndex;

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<
    'extra-large' | 'large' | 'medium' | 'small' | 'list' | 'details' | 'tiles' | 'content' | 'grid'
  >('medium');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const selectedWritableItems = Array.from(selectedFileIds)
    .map((id) => files.find((file) => file.id === id))
    .filter((file): file is FileItem => Boolean(file && !file.readOnly && file.path !== 'C:' && file.path !== 'D:'));
  const isDriveRootPage = currentPath === 'This PC' || currentPath === 'C:';
  const hasToolbarSelection = !isDriveRootPage && Boolean(
    (selectedFile && selectedFile.path !== 'C:' && selectedFile.path !== 'D:') ||
    selectedFileIds.size > 0
  );
  const currentFolderIsReadOnly =
    (files.find((file) => file.path.toLowerCase() === currentPath.toLowerCase())?.readOnly === true &&
      !isCanonicalDDriveFolderPath(currentPath)) ||
    (isLegacyDDrivePath(currentPath) && !isCanonicalDDriveFolderPath(currentPath));
  const canCreateInCurrentLocation = !isDriveRootPage && !currentFolderIsReadOnly;
  const [recycleIconSize, setRecycleIconSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showConfirmEmptyRecycle, setShowConfirmEmptyRecycle] = useState(false);
  const [pendingDeleteRecycleIds, setPendingDeleteRecycleIds] = useState<string[]>([]);
  const [showPropertiesModal, setShowPropertiesModal] = useState<FileItem | null>(null);
  const [showDriveAccessDenied, setShowDriveAccessDenied] = useState(false);
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Address bar direct path edit and copy state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const lastClickedIndexRef = useRef<number | null>(null);
  const lastAccessKeywordTapRef = useRef(0);
  const lastAccessKeywordActivationRef = useRef(0);
  const driveAccessDialogRef = useRef<HTMLElement>(null);

  // Sorting and Filtering State
  const [sortBy, setSortBy] = useState<'name' | 'modified' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // New, View, More Menus and View sub-options
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  const [newMenuPos, setNewMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [viewMenuPos, setViewMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [moreMenuPos, setMoreMenuPos] = useState<{ top: number; left: number } | null>(null);

  const calcMenuPos = (e: React.MouseEvent<HTMLButtonElement>, menuWidth: number = 220, estimatedHeight: number = 240) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    let top = rect.bottom + 4;
    if (top + estimatedHeight > window.innerHeight) {
      top = Math.max(8, rect.top - estimatedHeight - 4);
    }
    return { top, left };
  };

  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showShowSubmenu, setShowShowSubmenu] = useState(false);

  const [showFileExtensions, setShowFileExtensions] = useState(true);
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const [showItemCheckboxes, setShowItemCheckboxes] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);

  const [filterType, setFilterType] = useState<'all' | 'folders' | 'documents' | 'images' | 'apps'>('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Details & Preview Panes state
  const [showDetailsPane, setShowDetailsPane] = useState(false);
  const [showPreviewPane, setShowPreviewPane] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Snap layout menu state
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const snapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Mobile search & touch sensitivity
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const touchSensitivity = useTouchSensitivity({ threshold: 10 });

  const handleSnapMouseEnter = () => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => setShowSnapMenu(true), 150);
  };

  const handleSnapMouseLeave = () => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => setShowSnapMenu(false), 200);
  };

  const handleSnapTouchStart = () => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      haptics.medium();
      setShowSnapMenu((prev) => !prev);
    }, 350);
  };

  const handleSnapTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  // Responsive container width observer
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isNarrowContainer = containerWidth < 540;
  const isNarrowContainerRef = useRef(isNarrowContainer);
  isNarrowContainerRef.current = isNarrowContainer;

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isSortMenuOpen && sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setIsSortMenuOpen(false);
      }
      if (isFilterMenuOpen && filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsFilterMenuOpen(false);
      }
      if (isNewMenuOpen && newMenuRef.current && !newMenuRef.current.contains(target)) {
        setIsNewMenuOpen(false);
      }
      if (isViewMenuOpen && viewMenuRef.current && !viewMenuRef.current.contains(target)) {
        setIsViewMenuOpen(false);
        setShowShowSubmenu(false);
      }
      if (isMoreMenuOpen && moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isSortMenuOpen, isFilterMenuOpen, isNewMenuOpen, isViewMenuOpen, isMoreMenuOpen]);

  // Devices & drives collapsible state
  const [isDevicesCollapsed, setIsDevicesCollapsed] = useState(false);
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(false);

  // Targeted folder refresh state & handlers (forces this specific window to re-read from storage)
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshCurrentFolder = useCallback(async () => {
    setIsRefreshing(true);
    soundManager.playRefresh();
    haptics.light();
    try {
      await refreshFileSystem(currentPath);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 450);
    }
  }, [currentPath, refreshFileSystem]);

  useEffect(() => {
    const normalizedPath = currentPath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
    if (normalizedPath === 'c:/portfolio/media') void refreshFileSystem(currentPath);
  }, [currentPath, refreshFileSystem]);

  useEffect(() => {
    const refreshPortfolioMedia = () => {
      if (currentPath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase() === 'c:/portfolio/media') {
        void refreshFileSystem(currentPath);
      }
    };
    window.addEventListener('portfolio-media-changed', refreshPortfolioMedia);
    return () => window.removeEventListener('portfolio-media-changed', refreshPortfolioMedia);
  }, [currentPath, refreshFileSystem]);

  // Listen to win11_refresh_view custom event from context menu or system
  useEffect(() => {
    const handleRefreshView = (e: CustomEvent<{ target?: string; path?: string }>) => {
      if (!e.detail || e.detail.target === 'folder') {
        if (!e.detail?.path || e.detail.path === currentPath) {
          setIsRefreshing(true);
          setTimeout(() => setIsRefreshing(false), 450);
        }
      }
    };
    window.addEventListener('win11_refresh_view' as any, handleRefreshView);
    return () => window.removeEventListener('win11_refresh_view' as any, handleRefreshView);
  }, [currentPath]);

  // Window-scoped F5 and Ctrl+R shortcut to refresh this folder view without rebooting the OS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (myWindow && activeWindowId === myWindow.id) {
        if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
          e.preventDefault();
          e.stopPropagation();
          handleRefreshCurrentFolder();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [myWindow, activeWindowId, handleRefreshCurrentFolder]);

  // Long press timer for touch devices
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clearLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  // Marquee selection box state
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const fileAreaRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Quick Access Pinned Items State & Reordering
  const [draggedQaIndex, setDraggedQaIndex] = useState<number | null>(null);
  const [quickSidebar, setQuickSidebar] = useState<QuickAccessItem[]>(() => {
    const saved = localStorage.getItem('win11_quick_access');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isFirstDriveMigration = localStorage.getItem(QUICK_ACCESS_D_MIGRATION_KEY) !== 'true';
          const normalized = normalizeQuickAccessItems(parsed, isFirstDriveMigration);
          if (isFirstDriveMigration) {
            localStorage.setItem('win11_quick_access', JSON.stringify(normalized));
            localStorage.setItem(QUICK_ACCESS_D_MIGRATION_KEY, 'true');
          }
          return normalized;
        }
      } catch {
        // fallback
      }
    }
    return DEFAULT_QUICK_ACCESS;
  });

  const moveQuickAccessItem = (idx: number, direction: 'up' | 'down') => {
    setQuickSidebar((prev) => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.splice(targetIdx, 0, moved);
      localStorage.setItem('win11_quick_access', JSON.stringify(updated));
      return updated;
    });
  };

  // Sync quick access if updated via context menu
  useEffect(() => {
    const syncQuickAccess = () => {
      const saved = localStorage.getItem('win11_quick_access');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setQuickSidebar(normalizeQuickAccessItems(parsed));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('quickaccess_updated', syncQuickAccess);
    return () => window.removeEventListener('quickaccess_updated', syncQuickAccess);
  }, []);

  const pinToQuickAccess = useCallback((item: { name: string; path: string; icon?: string }) => {
    setQuickSidebar((prev) => {
      const path = item.path.replace(/\\/g, '/').replace(/\/+$/, '');
      if (!DEFAULT_QUICK_ACCESS.some((defaultItem) => defaultItem.path.toLowerCase() === path.toLowerCase())) {
        return prev;
      }
      if (prev.some((p) => p.path.toLowerCase() === path.toLowerCase())) return prev;
      let icon = item.icon || 'Folder';
      if (path.includes('Desktop')) icon = 'Monitor';
      else if (path.includes('Downloads')) icon = 'Download';
      else if (path.toLowerCase().includes('documents')) icon = 'FileText';
      else if (path.toLowerCase().includes('pictures')) icon = 'Image';
      const updated = [...prev, { id: 'qa-' + Date.now(), name: item.name, path, icon }];
      localStorage.setItem('win11_quick_access', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const unpinFromQuickAccess = useCallback((path: string) => {
    setQuickSidebar((prev) => {
      const updated = prev.filter((p) => p.path !== path);
      localStorage.setItem('win11_quick_access', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const [expandedTreePaths, setExpandedTreePaths] = useState<Set<string>>(
    () => new Set(['This PC'])
  );

  const toggleExpand = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedTreePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Helper function to render a folder and its children recursively in sidebar
  const renderSidebarFolderItem = (folder: FileItem, depth: number = 1): React.ReactNode => {
    const childFolders = files.filter((f) => f.type === 'folder' && f.parentId === folder.path);
    const hasChildren = childFolders.length > 0;
    const isExpanded = expandedTreePaths.has(folder.path);
    const isActive = currentPath === folder.path;

    return (
      <div key={folder.path} className="space-y-0.5">
        <div
          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] cursor-pointer group transition-colors ${
            isActive
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
              : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => navigateTo(folder.path)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => handleDropOnExplorer(e, folder.path)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(folder.path, e)}
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-3 h-3 shrink-0" />
          )}
          {folder.name.toLowerCase() === 'pictures' ? (
            <ImageIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          ) : folder.name.toLowerCase() === 'desktop' ? (
            <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          ) : folder.name.toLowerCase() === 'downloads' ? (
            <Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : folder.name.toLowerCase() === 'documents' ? (
            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          ) : folder.name.toLowerCase() === 'videos' ? (
            <Film className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : folder.name.toLowerCase() === 'music' ? (
            <Music className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
          )}
          <span className="truncate">{folder.name}</span>
        </div>

        {/* Child Subfolders */}
        {isExpanded && hasChildren && (
          <div className="space-y-0.5">
            {childFolders.map((child) => renderSidebarFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Navigation helpers for active tab
  const updateActiveTab = useCallback((updater: (tab: TabItem) => TabItem) => {
    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? updater(t) : t)));
  }, [activeTabId]);

  const openAdminLogin = useCallback(() => {
    sessionStorage.setItem('win11_admin_panel_locked', 'true');
    openApp('admin', undefined, true);
  }, [openApp]);

  const handleAccessKeywordClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  const handleAccessKeywordDoubleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (Date.now() - lastAccessKeywordActivationRef.current <= 500) return;
    lastAccessKeywordActivationRef.current = Date.now();
    openAdminLogin();
  };

  const handleAccessKeywordKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastAccessKeywordActivationRef.current <= 500) return;
    lastAccessKeywordActivationRef.current = now;
    openAdminLogin();
  };

  const handleAccessKeywordTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastAccessKeywordTapRef.current <= 500) {
      lastAccessKeywordTapRef.current = now;
      lastAccessKeywordActivationRef.current = now;
      openAdminLogin();
      return;
    }
    lastAccessKeywordTapRef.current = now;
  };

  useEffect(() => {
    if (showDriveAccessDenied) driveAccessDialogRef.current?.focus();
  }, [showDriveAccessDenied]);

  const handleDriveAccessDialogKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      setShowDriveAccessDenied(false);
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = Array.from(
      driveAccessDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') || []
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === driveAccessDialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const navigateTo = useCallback((path: string) => {
    if (/^C:/i.test(path.replace(/\\/g, '/').trim())) {
      setShowDriveAccessDenied(true);
      return;
    }
    updateActiveTab((tab) => {
      const newHistory = tab.history.slice(0, tab.historyIndex + 1);
      newHistory.push(path);
      return {
        ...tab,
        path,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
    setSelectedFile(null);
    setSelectedFileIds(new Set());
    if (isNarrowContainerRef.current) setIsSidebarVisible(false);
  }, [updateActiveTab]);

  useEffect(() => {
    if (initialPath) {
      navigateTo(initialPath);
    }
  }, [initialPath, navigateTo]);

  const handleAddNewTab = () => {
    const newId = 'tab-' + Date.now();
    const newTab: TabItem = {
      id: newId,
      path: 'This PC',
      history: ['This PC'],
      historyIndex: 0,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setSelectedFile(null);
    setSelectedFileIds(new Set());
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      if (myWindow) {
        closeWindow(myWindow.id);
      } else if (windowId) {
        closeWindow(windowId);
      } else {
        closeWindow('explorer');
      }
      return;
    }
    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      if (/^C:/i.test(history[historyIndex - 1].replace(/\\/g, '/').trim())) {
        setShowDriveAccessDenied(true);
        return;
      }
      updateActiveTab((tab) => ({
        ...tab,
        historyIndex: tab.historyIndex - 1,
        path: tab.history[tab.historyIndex - 1],
      }));
    } else {
      if (currentPath !== 'This PC') {
        const parts = currentPath.split('/');
        if (parts.length > 1) {
          parts.pop();
          navigateTo(parts.join('/'));
        } else {
          navigateTo('This PC');
        }
      }
    }
  }, [historyIndex, history, currentPath, updateActiveTab, navigateTo]);

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      if (/^C:/i.test(history[historyIndex + 1].replace(/\\/g, '/').trim())) {
        setShowDriveAccessDenied(true);
        return;
      }
      updateActiveTab((tab) => ({
        ...tab,
        historyIndex: tab.historyIndex + 1,
        path: tab.history[tab.historyIndex + 1],
      }));
    }
  }, [historyIndex, history, updateActiveTab]);

  const handleUp = useCallback(() => {
    if (currentPath === 'This PC') return;
    if (currentPath === 'Recycle Bin') {
      navigateTo('This PC');
      return;
    }
    const parts = currentPath.split('/');
    if (parts.length > 1) {
      parts.pop();
      navigateTo(parts.join('/'));
    } else {
      navigateTo('This PC');
    }
  }, [currentPath, navigateTo]);

  // Dynamic Drive Capacity Calculation (Accurately computed from actual files on each drive)
  const drivesData = React.useMemo(() => {
    const getFileSizeBytes = (f: FileItem): number => {
      if (f.size) {
        const s = f.size.toUpperCase().trim();
        const match = s.match(/^([\d.]+)\s*(TB|GB|MB|KB|B)?$/i);
        if (match) {
          const val = parseFloat(match[1]) || 0;
          const unit = (match[2] || 'KB').toUpperCase();
          if (unit === 'TB') return val * 1024 * 1024 * 1024 * 1024;
          if (unit === 'GB') return val * 1024 * 1024 * 1024;
          if (unit === 'MB') return val * 1024 * 1024;
          if (unit === 'KB') return val * 1024;
          if (unit === 'B') return val;
        }
      }
      if (f.content) {
        return f.content.length;
      }
      return 1024;
    };

    const metrics = calculateDriveMetrics(files, driveLabels);
    return metrics.map((d) => ({
      name: d.name,
      label: d.name.replace(` (${d.letter})`, ''),
      path: d.path,
      free: d.freeFormatted,
      used: d.usedFormatted,
      total: d.totalFormatted,
      summaryText: d.summaryText,
      percent: d.percent,
      usedBytes: d.usedBytes,
      totalBytes: d.totalBytes,
      hasWindows: d.hasWindows,
    }));
  }, [files, driveLabels]);

  // Helpers for size and date calculations
  const getFileSizeBytes = useCallback((item: FileItem): number => {
    if (item.size) {
      const s = item.size.toUpperCase().trim();
      const match = s.match(/^([\d.]+)\s*(TB|GB|MB|KB|B)?$/i);
      if (match) {
        const val = parseFloat(match[1]) || 0;
        const unit = (match[2] || 'KB').toUpperCase();
        if (unit === 'TB') return val * 1024 * 1024 * 1024 * 1024;
        if (unit === 'GB') return val * 1024 * 1024 * 1024;
        if (unit === 'MB') return val * 1024 * 1024;
        if (unit === 'KB') return val * 1024;
        if (unit === 'B') return val;
      }
    }
    if (item.content) return item.content.length;
    return item.type === 'folder' ? 0 : 1024;
  }, []);

  const formatBytesToHuman = useCallback((bytes: number): string => {
    if (bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }, []);

  // Dynamically calculate total recursive size and contents of any folder
  const getFolderSizeInfo = useCallback(
    (folderPath: string) => {
      const normPath = folderPath.replace(/\/$/, '');
      const childFiles = files.filter(
        (f) =>
          f.type === 'file' &&
          (f.path.startsWith(normPath + '/') || f.parentId.startsWith(normPath))
      );
      let totalBytes = 0;
      childFiles.forEach((f) => {
        totalBytes += getFileSizeBytes(f);
      });
      const childFolders = files.filter(
        (f) =>
          f.type === 'folder' &&
          f.path !== normPath &&
          (f.path.startsWith(normPath + '/') || f.parentId.startsWith(normPath))
      );
      return {
        totalBytes,
        fileCount: childFiles.length,
        folderCount: childFolders.length,
        formattedSize: totalBytes > 0 ? formatBytesToHuman(totalBytes) : '0 KB',
      };
    },
    [files, getFileSizeBytes, formatBytesToHuman]
  );

  // Address bar input path normalizer for quick jumps
  const normalizeAddressInput = useCallback((input: string): string => {
    let clean = input.trim();
    if (!clean) return 'This PC';
    const lower = clean.toLowerCase();
    if (lower === 'this pc' || lower === 'thispc' || lower === 'computer' || lower === 'my computer') return 'This PC';
    if (lower === 'recycle bin' || lower === 'recycle' || lower === 'trash') return 'Recycle Bin';
    if (lower === 'desktop') return D_DRIVE_FOLDER_PATHS.desktop;
    if (lower === 'downloads' || lower === 'download') return D_DRIVE_FOLDER_PATHS.downloads;
    if (lower === 'documents' || lower === 'document' || lower === 'docs') return D_DRIVE_FOLDER_PATHS.documents;
    if (lower === 'resumes' || lower === 'resume') return D_DRIVE_FOLDER_PATHS.resumes;
    if (lower === 'pictures' || lower === 'picture' || lower === 'photos') return D_DRIVE_FOLDER_PATHS.pictures;
    if (lower === 'wallpapers') return D_DRIVE_FOLDER_PATHS.wallpapers;
    if (lower === 'music' || lower === 'audio') return D_DRIVE_FOLDER_PATHS.audio;
    if (lower === 'videos' || lower === 'video') return D_DRIVE_FOLDER_PATHS.videos;
    if (lower === 'projects' || lower === 'project') return D_DRIVE_FOLDER_PATHS.projects;
    if (lower === 'certificates') return D_DRIVE_FOLDER_PATHS.certificates;
    if (lower === 'about me' || lower === 'aboutme') return D_DRIVE_FOLDER_PATHS.aboutMe;

    clean = clean.replace(/\\/g, '/');
    if (/^[a-zA-Z]:\/?$/.test(clean)) {
      return clean.substring(0, 2).toUpperCase();
    }
    if (/^[a-zA-Z]:\//.test(clean)) {
      clean = clean[0].toUpperCase() + clean.slice(1);
    }
    clean = clean.replace(/\/+$/, '');
    return clean;
  }, []);

  // Processed Drives for This PC with Filter and Sort support
  const processedDrives = React.useMemo(() => {
    let list = [...drivesData];
    const q = searchTerm.trim().toLowerCase();

    // 1. Search Filtering
    if (q) {
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.path.toLowerCase().includes(q) ||
          d.label.toLowerCase().includes(q)
      );
    }

    // 2. Extension / Type Filtering
    if (filterType === 'documents' || filterType === 'images' || filterType === 'apps') {
      return []; // In This PC, document/image/app filters will display the matching files below
    }

    // 3. Sorting
    list.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === 'size') {
        comp = a.totalBytes - b.totalBytes;
      } else if (sortBy === 'modified') {
        comp = a.name.localeCompare(b.name);
      } else if (sortBy === 'type') {
        comp = a.path.localeCompare(b.path);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return list;
  }, [drivesData, searchTerm, filterType, sortBy, sortOrder]);

  // Home Folders on This PC
  const homeFolders = React.useMemo(() => {
    const defaultList = [
      { id: 'folder-desktop', name: 'Desktop', path: D_DRIVE_FOLDER_PATHS.desktop, icon: 'Monitor' },
      { id: 'folder-documents', name: 'Documents', path: D_DRIVE_FOLDER_PATHS.documents, icon: 'FileText' },
      { id: 'folder-downloads', name: 'Downloads', path: D_DRIVE_FOLDER_PATHS.downloads, icon: 'Download' },
      { id: 'folder-pictures', name: 'Pictures', path: D_DRIVE_FOLDER_PATHS.pictures, icon: 'Image' },
      { id: 'folder-audio', name: 'Audio', path: D_DRIVE_FOLDER_PATHS.audio, icon: 'Music' },
      { id: 'folder-videos', name: 'Videos', path: D_DRIVE_FOLDER_PATHS.videos, icon: 'Film' },
      { id: 'folder-projects', name: 'Projects', path: D_DRIVE_FOLDER_PATHS.projects, icon: 'Briefcase' },
      { id: 'folder-certificates', name: 'Certificates', path: D_DRIVE_FOLDER_PATHS.certificates, icon: 'Award' },
      { id: 'folder-aboutme', name: 'About Me', path: D_DRIVE_FOLDER_PATHS.aboutMe, icon: 'User' },
    ];

    let list: FileItem[] = defaultList.map((df) => {
      const matching = files.find((f) => f.path === df.path);
      return matching || {
        id: df.id,
        name: df.name,
        path: df.path,
        type: 'folder' as const,
        parentId: 'D:',
        modified: '2026-08-10',
      };
    });

    if (showHiddenItems) {
      const hiddenInThisPC = files.filter((f) => f.parentId === 'This PC' && f.name.startsWith('.'));
      list = [...list, ...hiddenInThisPC];
    }

    if (filterType === 'documents' || filterType === 'images' || filterType === 'apps') {
      return [];
    }

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'name') return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (sortBy === 'modified') {
        const timeA = a.modified ? Date.parse(a.modified) || 0 : 0;
        const timeB = b.modified ? Date.parse(b.modified) || 0 : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });

    return list;
  }, [files, showHiddenItems, filterType, searchTerm, sortBy, sortOrder]);

  // F2 Shortcut for Renaming Drives or Files
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!myWindow || activeWindowId !== myWindow.id) return;
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        if (selectedFile && !selectedFile.readOnly) {
          if (selectedFile.path === 'C:' || selectedFile.path === 'D:') {
            const drive = drivesData.find((d) => d.path === selectedFile.path);
            setRenamingId(selectedFile.path);
            setRenamingName(drive?.label || selectedFile.name);
          } else {
            setRenamingId(selectedFile.id);
            setRenamingName(selectedFile.name);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [myWindow, activeWindowId, selectedFile, drivesData]);

  // Listen for context menu or global inline rename triggers (F2 style)
  useEffect(() => {
    const handleStartRename = (e: any) => {
      if (e.detail?.id) {
        const item = files.find((f) => f.id === e.detail.id || f.path === e.detail.id);
        if (item && !item.readOnly && !isLegacyDDrivePath(item.path)) {
          setSelectedFile(item);
          setRenamingId(item.id);
          setRenamingName(item.name);
        }
      }
    };
    window.addEventListener('start-inline-rename', handleStartRename);
    return () => window.removeEventListener('start-inline-rename', handleStartRename);
  }, [files]);

  // Item Filtering & Sorting Logic
  const normalizedCurrentPath = currentPath.replace(/\/$/, '') || 'This PC';
  const term = searchTerm.trim().toLowerCase();
  const isSearching = term.length > 0;

  const rawFolderItems = React.useMemo(() => {
    let raw: FileItem[] = [];
    if (isSearching) {
      raw = files.filter(
        (f) =>
          f.name !== 'Local Disk (C:)' &&
          f.name !== 'New Volume (D:)' &&
          (f.name.toLowerCase().includes(term) ||
            f.path.toLowerCase().includes(term) ||
            (f.extension && f.extension.toLowerCase().includes(term)))
      );
    } else if (normalizedCurrentPath === 'This PC') {
      if (filterType === 'documents' || filterType === 'images' || filterType === 'apps') {
        // If filter is set to documents/images/apps while at This PC, show matching files across all drives
        raw = files.filter((f) => f.type === 'file');
      } else {
        raw = [];
      }
    } else {
      const normalizedParentPath = normalizedCurrentPath.replace(/\\/g, '/').replace(/\/$/, '');
      raw = files.filter((item) => {
        const normalizedParent = item.parentId.replace(/\\/g, '/').replace(/\/$/, '') || 'This PC';
        return normalizedParent.toLowerCase() === normalizedParentPath.toLowerCase();
      });
      if (isLegacyDDrivePath(normalizedCurrentPath) && !isCanonicalDDriveFolderPath(normalizedCurrentPath)) {
        const visiblePaths = new Set(raw.map((item) => item.path.toLowerCase()));
        const legacyChildren = getLegacyDDriveChildren(storedFiles, normalizedCurrentPath)
          .filter((item) => !visiblePaths.has(item.path.toLowerCase()));
        raw = [...raw, ...legacyChildren];
      }
    }

    const seenIds = new Set<string>();
    const seenPaths = new Set<string>();
    return raw.filter((f) => {
      if (!f || !f.id || seenIds.has(f.id) || seenPaths.has(f.path)) return false;
      seenIds.add(f.id);
      seenPaths.add(f.path);
      return true;
    });
  }, [files, isSearching, term, normalizedCurrentPath, filterType]);

  // Apply Ribbon Filter & Hidden Items
  const filteredItems = React.useMemo(() => {
    return rawFolderItems.filter((item) => {
      if (!showHiddenItems && (item.name.startsWith('.') || item.hidden)) return false;
      if (filterType === 'folders') return item.type === 'folder';
      if (filterType === 'documents') {
        const ext = (item.extension || '').toLowerCase();
        return item.type === 'file' && ['txt', 'md', 'pdf', 'doc', 'docx', 'json', 'csv', 'log', 'rtf'].includes(ext);
      }
      if (filterType === 'images') {
        const ext = (item.extension || '').toLowerCase();
        return item.type === 'file' && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext);
      }
      if (filterType === 'apps') {
        const ext = (item.extension || '').toLowerCase();
        return item.type === 'file' && (ext === 'lnk' || ext === 'exe' || item.content?.startsWith('app:'));
      }
      return true;
    });
  }, [rawFolderItems, filterType, showHiddenItems]);

  // Apply Ribbon Sorting
  const currentItems = React.useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        if (a.type !== b.type) {
          comp = a.type === 'folder' ? -1 : 1;
        } else {
          comp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
      } else if (sortBy === 'modified') {
        const timeA = a.modified ? Date.parse(a.modified) || 0 : 0;
        const timeB = b.modified ? Date.parse(b.modified) || 0 : 0;
        comp = timeA - timeB;
      } else if (sortBy === 'size') {
        const bytesA = a.type === 'folder' ? getFolderSizeInfo(a.path).totalBytes : getFileSizeBytes(a);
        const bytesB = b.type === 'folder' ? getFolderSizeInfo(b.path).totalBytes : getFileSizeBytes(b);
        comp = bytesA - bytesB;
      } else if (sortBy === 'type') {
        const typeA = a.type === 'folder' ? 'Folder' : `${(a.extension || 'file').toUpperCase()} File`;
        const typeB = b.type === 'folder' ? 'Folder' : `${(b.extension || 'file').toUpperCase()} File`;
        comp = typeA.localeCompare(typeB);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [filteredItems, sortBy, sortOrder, getFileSizeBytes, getFolderSizeInfo]);

  // Selected Items for Status Bar
  const selectedItemsList = React.useMemo(() => {
    const list: FileItem[] = [];
    selectedFileIds.forEach((id) => {
      // 1. Try to find in files
      const found = files.find((f) => f.id === id);
      if (found) {
        list.push(found);
        return;
      }
      // 2. Try to find in drives
      const drive = processedDrives.find((d) => {
        const dId = `drive-${d.path.toLowerCase().replace(':', '')}`;
        return dId === id;
      });
      if (drive) {
        const driveFile = {
          id: `drive-${drive.path.toLowerCase().replace(':', '')}`,
          name: drive.name,
          path: drive.path,
          type: 'folder' as const,
          parentId: 'This PC',
          modified: '2026-08-10',
          isDrive: true,
          usedBytes: drive.usedBytes,
          totalBytes: drive.totalBytes,
          size: drive.used,
        };
        list.push(driveFile as unknown as FileItem);
        return;
      }
      // 3. Fallback to selectedFile if IDs match
      if (selectedFile && selectedFile.id === id) {
        list.push(selectedFile);
      }
    });

    if (list.length === 0 && selectedFile) {
      return [selectedFile];
    }
    return list;
  }, [files, selectedFileIds, selectedFile, processedDrives]);

  const totalSelectedBytes = React.useMemo(() => {
    return selectedItemsList.reduce((acc, item) => {
      if ((item as any).isDrive && (item as any).usedBytes !== undefined) {
        return acc + (item as any).usedBytes;
      }
      if (item.type === 'folder') {
        // Calculate dynamic folder size recursively
        const folderInfo = getFolderSizeInfo(item.path);
        return acc + folderInfo.totalBytes;
      }
      return acc + getFileSizeBytes(item);
    }, 0);
  }, [selectedItemsList, getFileSizeBytes, getFolderSizeInfo]);

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === 'folder') {
      navigateTo(item.path);
    } else if (item.content && item.content.startsWith('app:')) {
      const appId = item.content.replace('app:', '') as AppId;
      openApp(appId);
    } else if (item.extension === 'pdf' || item.name.toLowerCase().endsWith('.pdf')) {
      const isSupportedResumeUrl =
        item.content && (/^\/api\/portfolio-media\/[A-Za-z0-9_-]+$/.test(item.content) ||
          (/^https:\/\//i.test(item.content) && /\.pdf(?:$|[?#])/i.test(item.content)));
      openApp('resume', isSupportedResumeUrl ? { initialResumeUrl: item.content } : undefined);
    } else if (isMediaFile(item.extension || item.name)) {
      const sourceId = item.id.startsWith('virtual-ref-') ? item.id.slice('virtual-ref-'.length) : null;
      const sourceFile = sourceId ? storedFiles.find((file) => file.id === sourceId) : null;
      openApp('photos', {
        filePath: sourceFile?.path || item.path,
        initialMediaId: sourceFile?.id || item.id,
        initialMediaUrl: sourceFile ? undefined : item.content,
        initialMediaName: item.name,
        initialMediaExtension: item.extension,
      });
    } else if (item.extension === 'html' || item.extension === 'url') {
      openApp('browser', { initialUrl: item.content });
    } else {
      openApp('notepad', { filePath: item.path, fileContent: item.content });
    }
  };

  const handleDropOnExplorer = (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    try {
      const rawData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const data = JSON.parse(rawData);
      const destination = targetFolderPath === 'This PC' ? 'C:' : targetFolderPath || currentPath;
      if (/^C:/i.test(destination.replace(/\\/g, '/').trim())) {
        setShowDriveAccessDenied(true);
        return;
      }
      if (/^D:(?:\/|$)/i.test(destination.replace(/\\/g, '/').trim())) return;

      if (data.type === 'file_item' && (data.file || data.fileId)) {
        const itemToMove = data.file || files.find((f) => f.id === data.fileId);
        if (!itemToMove || itemToMove.readOnly) return;

        if (destination === 'quick_access') {
          pinToQuickAccess(itemToMove);
        } else {
          // If multiple items are selected and the dragged file is one of them, move all selected
          if (selectedFileIds.has(itemToMove.id) && selectedFileIds.size > 1) {
            selectedFileIds.forEach((id) => {
              moveFile(id, destination);
            });
          } else {
            moveFile(itemToMove.id, destination);
          }
        }
      } else if (data.type === 'desktop_icon') {
        if (destination === 'quick_access') {
          pinToQuickAccess({ name: data.name, path: data.filePath || `${D_DRIVE_FOLDER_PATHS.desktop}/${data.name}`, icon: data.icon });
        } else {
          createFile(destination, `${data.name}.lnk`, `app:${data.appId}`, 'lnk');
        }
      }
    } catch {
      // ignore drop error
    }
  };

  // Helper to trigger item context menu with full multi-selection awareness
  const handleItemContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    let currentIds = new Set(selectedFileIds);
    if (!currentIds.has(item.id)) {
      currentIds = new Set([item.id]);
      setSelectedFile(item);
      setSelectedFileIds(currentIds);
    }
    const targetItems = files.filter((f) => currentIds.has(f.id));
    showContextMenu({
      type: 'explorer-item',
      x: e.clientX,
      y: e.clientY,
      file: item,
      files: targetItems.length > 0 ? targetItems : [item],
    });
  };

  // Marquee Selection Box Logic
  const handleFileAreaMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-file-item="true"]') || target.closest('button') || target.closest('input')) return;

    isSelectingRef.current = true;
    const rect = fileAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    startPosRef.current = { x: startX, y: startY };
    setSelectionBox({ x: startX, y: startY, w: 0, h: 0 });

    if (!e.ctrlKey && !e.metaKey) {
      setSelectedFile(null);
      setSelectedFileIds(new Set());
    }
  };

  const handleFileAreaMouseMove = (e: React.MouseEvent) => {
    if (!isSelectingRef.current || !fileAreaRef.current) return;
    const rect = fileAreaRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const boxX = Math.min(startPosRef.current.x, currentX);
    const boxY = Math.min(startPosRef.current.y, currentY);
    const boxW = Math.abs(currentX - startPosRef.current.x);
    const boxH = Math.abs(currentY - startPosRef.current.y);

    setSelectionBox({ x: boxX, y: boxY, w: boxW, h: boxH });

    const newSelected = new Set<string>();
    const itemEls = fileAreaRef.current.querySelectorAll<HTMLElement>('[data-file-id]');
    itemEls.forEach((el) => {
      const id = el.getAttribute('data-file-id');
      if (!id) return;

      const elLeft = el.offsetLeft;
      const elTop = el.offsetTop;
      const elRight = elLeft + el.offsetWidth;
      const elBottom = elTop + el.offsetHeight;

      const intersects =
        boxX < elRight &&
        boxX + boxW > elLeft &&
        boxY < elBottom &&
        boxY + boxH > elTop;

      if (intersects) {
        newSelected.add(id);
      }
    });

    setSelectedFileIds(newSelected);
    if (newSelected.size > 0) {
      const lastId = Array.from(newSelected)[newSelected.size - 1];
      const match = currentItems.find((f) => f.id === lastId);
      if (match) setSelectedFile(match);
    }
  };

  const handleFileAreaMouseUp = () => {
    isSelectingRef.current = false;
    setSelectionBox(null);
  };

  // Icon renderer helper
  const renderItemIcon = (item: FileItem, sizeClass = 'w-10 h-10') => {
    if (item.type === 'folder') {
      const n = item.name.toLowerCase();
      const p = (item.path || '').toLowerCase();

      // System known folders with dedicated Windows 11 icons
      if (n === 'desktop') return <Monitor className={`${sizeClass} text-blue-500`} />;
      if (n === 'downloads') return <Download className={`${sizeClass} text-emerald-500`} />;
      if (n === 'documents') return <FileText className={`${sizeClass} text-blue-500`} />;
      // User request: "Pictures" folder icon same as Image 2 (purple image icon)
      if (n === 'pictures' || p.endsWith('/pictures')) return <ImageIcon className={`${sizeClass} text-purple-500`} />;
      if (n === 'videos' || p.endsWith('/videos')) return <Film className={`${sizeClass} text-amber-500`} />;
      if (n === 'wallpapers' || n === 'camera picture' || n === 'camera video') {
        return <Folder className={`${sizeClass} text-amber-500 fill-amber-500/20`} />;
      }
      if (n === 'music' || n === 'audio' || p.endsWith('/music') || p.endsWith('/audio')) {
        return <Music className={`${sizeClass} text-rose-500`} />;
      }
      if (n === 'projects') return <Briefcase className={`${sizeClass} text-amber-500`} />;
      if (n === 'certificates') return <Award className={`${sizeClass} text-indigo-500`} />;
      if (n === 'about me') return <User className={`${sizeClass} text-sky-500`} />;

      // Windows 11 Media Folder Icon: Check if custom folder DIRECTLY contains media items
      const childMedia = files.filter(
        (f) =>
          f.type !== 'folder' &&
          (f.parentId === item.path || f.parentId === item.id) &&
          (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'mp4', 'mov', 'webm', 'mkv', 'avi'].includes(
            (f.extension || '').toLowerCase()
          ) ||
            f.content?.startsWith('http') ||
            f.content?.startsWith('data:image') ||
            f.content?.startsWith('data:video'))
      );

      if (childMedia.length > 0) {
        const firstMedia = childMedia[0];
        const secondMedia = childMedia.length > 1 ? childMedia[1] : null;

        const isVideo1 = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes((firstMedia.extension || '').toLowerCase());
        const previewSrc1 = firstMedia.content || (isVideo1
          ? 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80');

        const isVideo2 = secondMedia ? ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes((secondMedia.extension || '').toLowerCase()) : false;
        const previewSrc2 = secondMedia
          ? (secondMedia.content || (isVideo2
              ? 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300&auto=format&fit=crop&q=80'
              : 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&auto=format&fit=crop&q=80'))
          : null;

        return (
          <div className={`relative ${sizeClass} flex items-center justify-center select-none group`}>
            {/* Windows 11 Back Folder Plate */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-full h-full text-amber-400 drop-shadow-xs" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 14C4 10.6863 6.68629 8 10 8H24C26.1217 8 28.1566 8.84285 29.6569 10.3431L33.3137 14H54C57.3137 14 60 16.6863 60 20V50C60 53.3137 57.3137 56 54 56H10C6.68629 56 4 53.3137 4 50V14Z" fill="currentColor" fillOpacity="0.85"/>
              </svg>
            </div>

            {/* Folder Collage Previews Peeking out of Folder Flap */}
            {secondMedia && previewSrc2 ? (
              // Multi-item Collage (2 overlapping cards matching Windows 11)
              <>
                {/* Secondary Photo (Back Left, -6deg tilt) */}
                <div className="absolute top-[14%] left-[10%] w-[56%] h-[56%] rounded-[2px] overflow-hidden bg-slate-900 border border-white shadow-xs z-[2] transform -rotate-6 group-hover:-rotate-8 group-hover:-translate-y-1 transition-all">
                  {secondMedia.localCaptureId ? (
                    <MediaThumbnail item={secondMedia} sizeClass="w-full h-full" className="!rounded-none !border-0 !shadow-none" />
                  ) : (
                    <img
                      src={previewSrc2}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  )}
                  {isVideo2 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Film className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>

                {/* Primary Photo (Front Right, +4deg tilt) */}
                <div className="absolute top-[18%] right-[10%] w-[58%] h-[58%] rounded-[2px] overflow-hidden bg-slate-900 border border-white shadow-sm z-[2] transform rotate-4 group-hover:rotate-6 group-hover:-translate-y-1.5 transition-all">
                  {firstMedia.localCaptureId ? (
                    <MediaThumbnail item={firstMedia} sizeClass="w-full h-full" className="!rounded-none !border-0 !shadow-none" />
                  ) : (
                    <img
                      src={previewSrc1}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  )}
                  {isVideo1 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Film className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Single Photo Cover (Centered, -1deg tilt)
              <div className="absolute top-[18%] inset-x-[15%] h-[58%] rounded-[2px] overflow-hidden bg-slate-900 border border-white shadow-xs z-[2] transform -rotate-1 group-hover:scale-105 group-hover:-translate-y-1 transition-all">
                {firstMedia.localCaptureId ? (
                  <MediaThumbnail item={firstMedia} sizeClass="w-full h-full" className="!rounded-none !border-0 !shadow-none" />
                ) : (
                  <img
                    src={previewSrc1}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover pointer-events-none"
                  />
                )}
                {isVideo1 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Film className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            )}

            {/* Front Folder Flap (Windows 11 Yellow Pocket) */}
            <div className="absolute inset-0 flex items-center justify-center z-[3] pointer-events-none">
              <svg className="w-full h-full text-amber-500 drop-shadow" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 26C4 23.7909 5.79086 22 8 22H56C58.2091 22 60 23.7909 60 26V50C60 53.3137 57.3137 56 54 56H10C6.68629 56 4 53.3137 4 50V26Z" fill="currentColor" fillOpacity="0.9"/>
              </svg>
            </div>

            {/* Small Media Count Badge */}
            {childMedia.length > 1 && (
              <span className="absolute -bottom-1 -right-1 z-[4] px-1 py-0.2 rounded-full bg-blue-600 text-[8px] font-bold text-white shadow-xs border border-white/30 leading-none">
                {childMedia.length}
              </span>
            )}
          </div>
        );
      }

      return <Folder className={`${sizeClass} text-amber-500 fill-amber-500/20`} />;
    }

    const content = item.content || '';
    const n = item.name.toLowerCase();
    const ext = (item.extension || '').toLowerCase();

    // ZIP / Archive files matching Image 7
    if (ext === 'zip' || n.endsWith('.zip') || ext === 'rar' || ext === '7z' || ext === 'tar' || ext === 'gz') {
      return <AppIcon name="FileArchive" className={sizeClass} />;
    }

    if (content.startsWith('app:') || item.extension === 'lnk') {
      const appId = content.replace('app:', '').toLowerCase();
      if (appId.includes('about') || n.includes('about')) return <User className={`${sizeClass} text-blue-500`} />;
      if (appId.includes('terminal') || n.includes('terminal')) return <Terminal className={`${sizeClass} text-emerald-500`} />;
      if (appId.includes('browser') || n.includes('browser')) return <Globe className={`${sizeClass} text-sky-500`} />;
      if (appId.includes('projects') || n.includes('projects')) return <Briefcase className={`${sizeClass} text-indigo-500`} />;
      if (appId.includes('skills') || n.includes('skills')) return <Award className={`${sizeClass} text-purple-500`} />;
      if (appId.includes('settings') || n.includes('settings')) return <Settings className={`${sizeClass} text-slate-500`} />;
      if (appId.includes('recycle') || n.includes('recycle')) return <Trash2 className={`${sizeClass} text-red-500`} />;
      if (appId.includes('minesweeper') || n.includes('minesweeper')) return <Gamepad2 className={`${sizeClass} text-green-500`} />;
      if (appId.includes('snake') || n.includes('snake')) return <Sparkles className={`${sizeClass} text-amber-500`} />;
      if (appId.includes('contact') || n.includes('contact')) return <Mail className={`${sizeClass} text-rose-500`} />;
      if (appId.includes('resume') || n.includes('resume')) return <FileText className={`${sizeClass} text-red-500`} />;
    }

    if (ext === 'pdf') return <FileText className={`${sizeClass} text-red-500`} />;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'heic'].includes(ext)) {
      return <MediaThumbnail item={item} sizeClass={sizeClass} />;
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
      return <MediaThumbnail item={item} sizeClass={sizeClass} />;
    }
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) {
      return <MediaThumbnail item={item} sizeClass={sizeClass} />;
    }
    if (ext === 'txt' || ext === 'md' || ext === 'rtf' || ext === 'log') return <FileText className={`${sizeClass} text-blue-500`} />;

    return <FileCode className={`${sizeClass} text-blue-500`} />;
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (renamingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!myWindow || activeWindowId !== myWindow.id) return;
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      // Alt + Enter: Open Properties Modal
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        if (selectedFile) {
          setShowPropertiesModal(selectedFile);
        } else if (currentPath !== 'This PC') {
          const currentFolder = files.find((f) => f.path === currentPath);
          if (currentFolder) {
            setShowPropertiesModal(currentFolder);
          }
        }
        return;
      }

      if (e.key === 'F2' && selectedFile && !selectedFile.readOnly) {
        e.preventDefault();
        setRenamingId(selectedFile.id);
        setRenamingName(selectedFile.name);
        return;
      }

      if (e.key === 'Delete' && (selectedFile || selectedWritableItems.length > 0) && !renamingId) {
        e.preventDefault();
        if (selectedWritableItems.length > 0) {
          selectedWritableItems.forEach((item) => deleteFile(item.id));
          setSelectedFileIds(new Set());
        } else if (selectedFile && !selectedFile.readOnly) {
          deleteFile(selectedFile.id);
        }
        setSelectedFile(null);
        return;
      }

      if (e.key === 'Backspace' && !renamingId) {
        e.preventDefault();
        handleUp();
        return;
      }

      if (e.key === 'Enter' && selectedFile && !renamingId) {
        e.preventDefault();
        handleItemDoubleClick(selectedFile);
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'c' && (selectedFile || selectedFileIds.size > 0)) {
        e.preventDefault();
        if (selectedWritableItems.length > 0) {
          const targetItems = selectedWritableItems;
          if (targetItems.length > 0) copyFile(targetItems);
        } else if (selectedFile && !selectedFile.readOnly) {
          copyFile(selectedFile);
        }
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'x' && (selectedFile || selectedFileIds.size > 0)) {
        e.preventDefault();
        if (selectedWritableItems.length > 0) {
          const targetItems = selectedWritableItems;
          if (targetItems.length > 0) cutFile(targetItems);
        } else if (selectedFile && !selectedFile.readOnly) {
          cutFile(selectedFile);
        }
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (!isDriveRootPage && !currentFolderIsReadOnly && clipboard) {
          pasteFile(currentPath);
        }
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'a' && currentItems.length > 0) {
        e.preventDefault();
        setSelectedFileIds(new Set(currentItems.map((f) => f.id)));
        if (currentItems.length > 0) setSelectedFile(currentItems[0]);
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Home & End keys: Jump to first / last item
      if (e.key === 'Home' && currentItems.length > 0) {
        e.preventDefault();
        const first = currentItems[0];
        setSelectedFile(first);
        setSelectedFileIds(new Set([first.id]));
        lastClickedIndexRef.current = 0;
        return;
      }

      if (e.key === 'End' && currentItems.length > 0) {
        e.preventDefault();
        const last = currentItems[currentItems.length - 1];
        setSelectedFile(last);
        setSelectedFileIds(new Set([last.id]));
        lastClickedIndexRef.current = currentItems.length - 1;
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (!currentFolderIsReadOnly) {
          createFolder(currentPath === 'This PC' ? 'C:' : currentPath, 'New Folder');
        }
        return;
      }

      // Arrow keys navigation & Shift+Arrow range selection in file/folder view
      if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key) && currentItems.length > 0) {
        e.preventDefault();
        if (!selectedFile) {
          setSelectedFile(currentItems[0]);
          setSelectedFileIds(new Set([currentItems[0].id]));
          lastClickedIndexRef.current = 0;
        } else {
          const currentIndex = currentItems.findIndex((item) => item.id === selectedFile.id);
          if (currentIndex !== -1) {
            let nextIndex = currentIndex;
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
              nextIndex = Math.min(currentItems.length - 1, currentIndex + 1);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
              nextIndex = Math.max(0, currentIndex - 1);
            }

            const nextItem = currentItems[nextIndex];
            setSelectedFile(nextItem);

            if (e.shiftKey) {
              const startIdx = lastClickedIndexRef.current !== null ? lastClickedIndexRef.current : currentIndex;
              const minIdx = Math.min(startIdx, nextIndex);
              const maxIdx = Math.max(startIdx, nextIndex);
              const rangeIds = new Set<string>();
              for (let i = minIdx; i <= maxIdx; i++) {
                rangeIds.add(currentItems[i].id);
              }
              setSelectedFileIds(rangeIds);
            } else {
              setSelectedFileIds(new Set([nextItem.id]));
              lastClickedIndexRef.current = nextIndex;
            }
          } else {
            setSelectedFile(currentItems[0]);
            setSelectedFileIds(new Set([currentItems[0].id]));
            lastClickedIndexRef.current = 0;
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [myWindow, activeWindowId, selectedFile, selectedFileIds, selectedWritableItems, renamingId, currentPath, isDriveRootPage, currentFolderIsReadOnly, clipboard, handleUp, deleteFile, copyFile, cutFile, pasteFile, createFolder, files, currentItems]);

  // Synchronize address bar input whenever currentPath changes
  useEffect(() => {
    setAddressInput(currentPath);
  }, [currentPath]);

  const breadcrumbSegments = React.useMemo(() => {
    if (currentPath === 'This PC') {
      return [{ label: 'This PC', path: 'This PC', icon: 'Monitor' }];
    }
    if (currentPath === 'Recycle Bin') {
      return [
        { label: 'This PC', path: 'This PC', icon: 'Monitor' },
        { label: 'Recycle Bin', path: 'Recycle Bin', icon: 'Trash2' },
      ];
    }
    const list: { label: string; path: string; icon: string }[] = [
      { label: 'This PC', path: 'This PC', icon: 'Monitor' },
    ];
    const cleanPath = currentPath.replace(/\\/g, '/');
    const parts = cleanPath.split('/').filter(Boolean);
    let currentAcc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === 0) {
        currentAcc = part;
        const driveKey = part.toUpperCase().endsWith(':') ? part.toUpperCase() : `${part.toUpperCase()}:`;
        const driveLabel = driveLabels[driveKey] || (driveKey === 'C:' ? 'Local Disk' : 'New Volume');
        list.push({ label: `${driveLabel} (${part})`, path: currentAcc, icon: 'HardDrive' });
      } else {
        currentAcc = `${currentAcc}/${part}`;
        list.push({ label: part, path: currentAcc, icon: 'Folder' });
      }
    }
    return list;
  }, [currentPath, driveLabels]);

  const isSelectedPinned = selectedFile ? quickSidebar.some((p) => p.path === selectedFile.path) : false;

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden relative">
      {/* 1. Integrated Header & Multi-Tab Bar */}
      <div
        data-window-header="true"
        className="flex items-center justify-between bg-[#f0f0f0] dark:bg-[#181818] text-xs shrink-0 px-2 pt-1.5 pb-0 cursor-default relative z-50 overflow-visible"
        onDoubleClick={(e) => {
          if (myWindow && !(e.target as HTMLElement).closest('button')) {
            e.stopPropagation();
            maximizeWindow(myWindow.id);
          }
        }}
      >
        {/* Left: Tab Items with scrollbar completely removed */}
        <div className="flex items-end gap-1 overflow-x-auto overflow-y-hidden scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-2 flex-1 min-w-0">
          {tabs.map((tab) => {
            const isTabActive = tab.id === activeTabId;
            const isDraggingThis = draggedTabId === tab.id;
            const tabName = tab.path === 'This PC' ? 'This PC' : tab.path.split('/').pop() || 'This PC';

            return (
              <div
                key={tab.id}
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
                  if (sourceId && sourceId !== tab.id) {
                    handleReorderTabs(sourceId, tab.id);
                  }
                  setDraggedTabId(null);
                }}
                onDragEnd={() => setDraggedTabId(null)}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setSelectedFile(null);
                  setSelectedFileIds(new Set());
                }}
                className={`group relative flex items-center gap-2 px-3 h-[34px] rounded-t-[8px] cursor-pointer transition-all select-none shrink-0 ${
                  isDraggingThis ? 'opacity-40 scale-95' : ''
                } ${
                  isTabActive
                    ? 'bg-white dark:bg-[#242424] font-medium text-slate-900 dark:text-white z-10'
                    : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/[0.06] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 rounded-[6px] mb-0.5'
                }`}
              >
                {/* Left & Right Inverted Fillet Wings for Active Tab - Seamless Windows 11 Menu Bar Connection */}
                {isTabActive && (
                  <>
                    <svg
                      className="absolute -left-2 bottom-0 w-2 h-2 pointer-events-none text-white dark:text-[#242424]"
                      viewBox="0 0 8 8"
                      fill="none"
                    >
                      <path d="M0 8h8V0C8 4.418 4.418 8 0 8z" fill="currentColor" />
                    </svg>
                    <svg
                      className="absolute -right-2 bottom-0 w-2 h-2 pointer-events-none text-white dark:text-[#242424]"
                      viewBox="0 0 8 8"
                      fill="none"
                    >
                      <path d="M8 8H0V0C0 4.418 3.582 8 8 8z" fill="currentColor" />
                    </svg>
                  </>
                )}

                <Monitor className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="truncate max-w-[140px] text-xs font-normal">{tabName}</span>
                <button
                  className="w-5 h-5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center cursor-pointer ml-1 shrink-0 transition-colors"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Close Tab"
                >
                  <X className="w-3 h-3 stroke-[2]" />
                </button>
              </div>
            );
          })}

          {/* Plus (+) Button to Add New Tab opening This PC */}
          <button
            onClick={handleAddNewTab}
            className="w-7 h-7 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors ml-0.5 mb-1"
            title="New Tab (This PC)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        {/* Right: Window Controls */}
        {myWindow && (
          <div className="flex items-center gap-0.5 pb-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
            <button
              className="flex items-center justify-center w-8 h-7 rounded hover:bg-slate-300/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                haptics.light();
                minimizeWindow(myWindow.id);
              }}
              title="Minimize"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>
            <div
              className="relative flex items-center z-[100]"
              onMouseEnter={handleSnapMouseEnter}
              onMouseLeave={handleSnapMouseLeave}
            >
              <button
                className="flex items-center justify-center w-8 h-7 rounded hover:bg-slate-300/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                onTouchStart={handleSnapTouchStart}
                onTouchEnd={handleSnapTouchEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLongPressRef.current) {
                    isLongPressRef.current = false;
                    return;
                  }
                  haptics.light();
                  maximizeWindow(myWindow.id);
                }}
                title={myWindow.isMaximized ? 'Restore' : 'Maximize (Long press for Snap)'}
              >
                {myWindow.isMaximized ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              {showSnapMenu && (
                <SnapLayoutMenu
                  onSnap={(layout) => {
                    snapWindow(myWindow.id, layout);
                    setShowSnapMenu(false);
                  }}
                  onClose={() => setShowSnapMenu(false)}
                />
              )}
            </div>
            <button
              className="flex items-center justify-center w-8 h-7 rounded hover:bg-red-500 hover:text-white text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                haptics.medium();
                closeWindow(myWindow.id);
              }}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Address Breadcrumb & Search Bar */}
      <div className="flex items-center justify-between p-1.5 sm:p-2 bg-white dark:bg-[#242424] border-b border-slate-200 dark:border-white/5 gap-1 sm:gap-2 shrink-0 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            onClick={handleBack}
            disabled={historyIndex === 0 && currentPath === 'This PC'}
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            onClick={handleForward}
            disabled={historyIndex === history.length - 1}
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            onClick={handleUp}
            disabled={currentPath === 'This PC'}
            title="Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-transform active:scale-95 text-slate-700 dark:text-slate-300"
            onClick={handleRefreshCurrentFolder}
            title="Refresh (F5)"
          >
            <RotateCw className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>

        {/* Address Breadcrumb & Direct Editable Bar */}
        <div data-testid="explorer-address-bar" className={`${isMobileSearchOpen ? 'hidden sm:flex' : 'flex'} h-9 min-h-9 flex-1 min-w-0 items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-2.5 text-xs overflow-hidden`}>
          <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
            {isEditingAddress ? (
              <form
                className="flex h-full items-center gap-1.5 w-full min-w-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (addressInput.trim()) {
                    const target = normalizeAddressInput(addressInput);
                    navigateTo(target);
                    setSearchTerm('');
                  }
                  setIsEditingAddress(false);
                }}
              >
                <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <input
                  aria-label="File Explorer address"
                  data-testid="explorer-address-input"
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingAddress(false);
                      setAddressInput(currentPath);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsEditingAddress(false);
                      setAddressInput(currentPath);
                    }, 200);
                  }}
                  autoFocus
                  className="h-full w-full min-w-0 bg-transparent text-slate-800 dark:text-slate-100 font-mono text-xs outline-none"
                  placeholder="Type a path (e.g. D:/Documents or Downloads) and press Enter"
                />
              </form>
            ) : (
              <div
                className="flex h-full items-center gap-1 min-w-0 flex-1 overflow-x-auto cursor-text"
                onClick={() => {
                  setAddressInput(currentPath);
                  setIsEditingAddress(true);
                }}
                title="Click to edit path directly"
              >
                {breadcrumbSegments.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    <button
                      className="flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-white/10 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-200 font-medium cursor-pointer truncate shrink-0 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo(crumb.path);
                        setSearchTerm('');
                        setAddressInput(crumb.path);
                      }}
                      title={`Go to ${crumb.label}`}
                    >
                      {crumb.icon === 'Monitor' && <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                      {crumb.icon === 'HardDrive' && <HardDrive className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" />}
                      {crumb.icon === 'Folder' && <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {crumb.icon === 'Trash2' && <Trash2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      <span className="truncate">{crumb.label}</span>
                    </button>
                    {idx < breadcrumbSegments.length - 1 && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Search Input on Desktop */}
        <div className="hidden sm:block relative w-44 md:w-52 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={currentPath === 'This PC' ? 'Search This PC' : 'Search...'}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
          />
          {searchTerm && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              onClick={() => setSearchTerm('')}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Mobile Search Icon Button & Expanded Input */}
        <div className="sm:hidden flex items-center shrink-0">
          {isMobileSearchOpen ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setIsMobileSearchOpen(false);
                }}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                title="Close Search"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm || ''}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={currentPath === 'This PC' ? 'Search This PC' : 'Search...'}
                  autoFocus
                  className="w-full pl-8 pr-7 py-1 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsMobileSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Top Action Ribbon Bar (Windows 11 Command Bar UI/UX) */}
      <div className="relative z-40 flex items-center justify-between px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-white/10 text-xs gap-1 sm:gap-1.5 shrink-0 flex-nowrap overflow-x-auto whitespace-nowrap scrollbar-none">
        <div className="flex items-center gap-1 shrink-0 flex-nowrap">
          {/* Navigation Pane Toggle */}
          <button
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isSidebarVisible ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
            }`}
            title={isSidebarVisible ? 'Hide Navigation Pane' : 'Show Navigation Pane'}
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-0.5" />

          {/* 1. New Item Dropdown */}
          <div>
            <button
              disabled={!canCreateInCurrentLocation}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium disabled:cursor-not-allowed disabled:opacity-30 ${
                isNewMenuOpen ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
              onClick={(e) => {
                setNewMenuPos(calcMenuPos(e, 224, 220));
                setIsNewMenuOpen(!isNewMenuOpen);
                setIsSortMenuOpen(false);
                setIsViewMenuOpen(false);
                setIsMoreMenuOpen(false);
              }}
              title="Create a new item in the current location"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0 stroke-[2.5]" />
              <span>New</span>
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>

            {isMounted && portalTarget && isNewMenuOpen && newMenuPos && createPortal(
              <div 
                className="fixed w-56 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl z-[999999] text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-100"
                style={{ top: newMenuPos.top, left: newMenuPos.left }}
                ref={newMenuRef}
              >
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    createFolder(currentPath === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentPath, 'New folder');
                    setIsNewMenuOpen(false);
                  }}
                >
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Folder</span>
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    createFile(currentPath === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentPath, 'Shortcut.lnk', 'app:terminal', 'lnk');
                    setIsNewMenuOpen(false);
                  }}
                >
                  <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Shortcut</span>
                </button>
                <div className="my-1 border-t border-slate-200 dark:border-white/10" />
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    createFile(currentPath === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentPath, 'New Text Document.txt', '', 'txt');
                    setIsNewMenuOpen(false);
                  }}
                >
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Text Document</span>
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    createFile(currentPath === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentPath, 'Rich Text Document.md', '# New Document\n', 'md');
                    setIsNewMenuOpen(false);
                  }}
                >
                  <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Rich Text Document</span>
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    createFile(currentPath === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentPath, 'Compressed Archive.zip', 'ZIP_ARCHIVE', 'zip');
                    setIsNewMenuOpen(false);
                  }}
                >
                  <FolderArchive className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Compressed (zipped) Folder</span>
                </button>
              </div>,
              portalTarget
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />

          {/* 2. File Operations (Cut, Copy, Paste, Rename, Share, Delete) */}
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            disabled={!hasToolbarSelection}
            onClick={() => {
              if (selectedWritableItems.length > 0) {
                const targetItems = selectedWritableItems;
                if (targetItems.length > 0) cutFile(targetItems);
              } else if (selectedFile) {
                if (selectedFile.readOnly) {
                  addNotification({ title: 'Item is read-only', message: 'Published references cannot be moved.', type: 'warning', appId: 'explorer' });
                } else {
                  cutFile(selectedFile);
                }
              }
            }}
            title="Cut (Ctrl+X)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            disabled={!hasToolbarSelection}
            onClick={() => {
              if (selectedWritableItems.length > 0) {
                const targetItems = selectedWritableItems;
                if (targetItems.length > 0) copyFile(targetItems);
              } else if (selectedFile) {
                copyFile(selectedFile);
              }
            }}
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            disabled={isDriveRootPage || currentFolderIsReadOnly || !clipboard}
            onClick={() => pasteFile(currentPath)}
            title="Paste (Ctrl+V)"
          >
            <Clipboard className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            disabled={!hasToolbarSelection || !selectedFile}
            onClick={() => {
              if (selectedFile) {
                if (selectedFile.readOnly) {
                  addNotification({ title: 'Item is read-only', message: 'Published references cannot be renamed.', type: 'warning', appId: 'explorer' });
                } else {
                  setRenamingId(selectedFile.id);
                  setRenamingName(selectedFile.name);
                }
              }
            }}
            title="Rename (F2)"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none disabled:cursor-not-allowed cursor-pointer"
            disabled={!hasToolbarSelection}
            onClick={() => {
              const item = selectedFile && !selectedFile.readOnly
                ? selectedFile
                : selectedFile || selectedWritableItems[0];
              if (item) {
                setSharingFile(item);
              }
            }}
            title={!selectedFile && selectedFileIds.size === 0 ? "Select a file to share" : "Share"}
          >
            <Share2 className="w-3.5 h-3.5 text-blue-500" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            disabled={!hasToolbarSelection}
            onClick={() => {
              if (selectedWritableItems.length > 0) {
                selectedWritableItems.forEach((item) => deleteFile(item.id));
                setSelectedFileIds(new Set());
                setSelectedFile(null);
              } else if (selectedFile) {
                if (selectedFile.readOnly) {
                  addNotification({ title: 'Item is read-only', message: 'Published references cannot be deleted.', type: 'warning', appId: 'explorer' });
                } else {
                  deleteFile(selectedFile.id);
                  setSelectedFile(null);
                }
              }
            }}
            title="Delete (Del)"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />

          {/* 3. Sort Dropdown */}
          <div>
            <button
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                isSortMenuOpen ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
              onClick={(e) => {
                setSortMenuPos(calcMenuPos(e, 192, 280));
                setIsSortMenuOpen(!isSortMenuOpen);
                setIsViewMenuOpen(false);
                setIsNewMenuOpen(false);
                setIsMoreMenuOpen(false);
              }}
              title="Sort items"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Sort</span>
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>

            {isMounted && portalTarget && isSortMenuOpen && sortMenuPos && createPortal(
              <div 
                className="fixed w-48 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl z-[999999] text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-100"
                style={{ top: sortMenuPos.top, left: sortMenuPos.left }}
                ref={sortMenuRef}
              >
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Sort by</div>
                {[
                  { id: 'name', label: 'Name' },
                  { id: 'modified', label: 'Date modified' },
                  { id: 'type', label: 'Type' },
                  { id: 'size', label: 'Size' },
                ].map((item) => (
                  <button
                    key={item.id}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                    onClick={() => {
                      setSortBy(item.id as any);
                      setIsSortMenuOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    {sortBy === item.id && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                ))}
                <div className="my-1 border-t border-slate-200 dark:border-white/10" />
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    setSortOrder('asc');
                    setIsSortMenuOpen(false);
                  }}
                >
                  <span>Ascending</span>
                  {sortOrder === 'asc' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    setSortOrder('desc');
                    setIsSortMenuOpen(false);
                  }}
                >
                  <span>Descending</span>
                  {sortOrder === 'desc' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>
              </div>,
              portalTarget
            )}
          </div>

          {/* 4. View Dropdown */}
          <div>
            <button
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                isViewMenuOpen ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
              onClick={(e) => {
                setViewMenuPos(calcMenuPos(e, 240, 380));
                setIsViewMenuOpen(!isViewMenuOpen);
                setIsSortMenuOpen(false);
                setIsNewMenuOpen(false);
                setIsMoreMenuOpen(false);
              }}
              title="Change view layout and options"
            >
              <Menu className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>View</span>
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>

            {isMounted && portalTarget && isViewMenuOpen && viewMenuPos && createPortal(
              <div 
                className="fixed w-60 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl z-[999999] text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] overflow-y-auto text-slate-800 dark:text-slate-100"
                style={{ top: viewMenuPos.top, left: viewMenuPos.left }}
                ref={viewMenuRef}
              >
                {/* 8 Windows View Layout Modes */}
                {[
                  { id: 'extra-large', label: 'Extra large icons', icon: Tv },
                  { id: 'large', label: 'Large icons', icon: LayoutGrid },
                  { id: 'medium', label: 'Medium icons', icon: Grid },
                  { id: 'small', label: 'Small icons', icon: LayoutGrid },
                  { id: 'list', label: 'List', icon: List },
                  { id: 'details', label: 'Details', icon: TableProperties },
                  { id: 'tiles', label: 'Tiles', icon: Columns2 },
                  { id: 'content', label: 'Content', icon: Rows3 },
                ].map((mode) => {
                  const IconComp = mode.icon;
                  const isActive = viewMode === mode.id || (viewMode === 'grid' && mode.id === 'medium');
                  return (
                    <button
                      key={mode.id}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                      onClick={() => {
                        setViewMode(mode.id as any);
                        setIsViewMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComp className="w-4 h-4 text-slate-500 dark:text-slate-300 shrink-0" />
                        <span>{mode.label}</span>
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </button>
                  );
                })}

                <div className="my-1 border-t border-slate-200 dark:border-white/10" />

                {/* Details Pane Toggle */}
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    setShowDetailsPane(!showDetailsPane);
                    if (!showDetailsPane) setShowPreviewPane(false);
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <PanelRight className="w-4 h-4 text-slate-500 dark:text-slate-300 shrink-0" />
                    <span>Details pane</span>
                  </div>
                  {showDetailsPane && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                </button>

                {/* Preview Pane Toggle */}
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    setShowPreviewPane(!showPreviewPane);
                    if (!showPreviewPane) setShowDetailsPane(false);
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <PanelRightClose className="w-4 h-4 text-slate-500 dark:text-slate-300 shrink-0" />
                    <span>Preview pane</span>
                  </div>
                  {showPreviewPane && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                </button>

                {/* Show > Submenu (Inline accordion pattern so it never overflows off-screen on mobile/narrow viewports) */}
                <div>
                  <button
                    className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium ${
                      showShowSubmenu ? 'bg-slate-100 dark:bg-slate-800' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShowSubmenu(!showShowSubmenu);
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <SlidersHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-300 shrink-0" />
                      <span>Show</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 opacity-60 shrink-0 transition-transform ${showShowSubmenu ? 'rotate-90' : ''}`} />
                  </button>

                  {showShowSubmenu && (
                    <div className="mx-2 my-1 p-1 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-white/10 space-y-0.5">
                      <button
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-200/60 dark:hover:bg-white/10 text-left transition-colors cursor-pointer rounded-md text-slate-800 dark:text-slate-100 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFileExtensions(!showFileExtensions);
                        }}
                      >
                        <span>File name extensions</span>
                        {showFileExtensions && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </button>
                      <button
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-200/60 dark:hover:bg-white/10 text-left transition-colors cursor-pointer rounded-md text-slate-800 dark:text-slate-100 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHiddenItems(!showHiddenItems);
                        }}
                      >
                        <span>Hidden items</span>
                        {showHiddenItems && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </button>
                      <button
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-200/60 dark:hover:bg-white/10 text-left transition-colors cursor-pointer rounded-md text-slate-800 dark:text-slate-100 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowItemCheckboxes(!showItemCheckboxes);
                        }}
                      >
                        <span>Item check boxes</span>
                        {showItemCheckboxes && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </button>
                      <button
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-200/60 dark:hover:bg-white/10 text-left transition-colors cursor-pointer rounded-md text-slate-800 dark:text-slate-100 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCompactView(!isCompactView);
                        }}
                      >
                        <span>Compact view</span>
                        {isCompactView && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>,
              portalTarget
            )}
          </div>

          {/* 5. See More ... Dropdown */}
          <div>
            <button
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                isMoreMenuOpen ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
              onClick={(e) => {
                setMoreMenuPos(calcMenuPos(e, 210, 260));
                setIsMoreMenuOpen(!isMoreMenuOpen);
                setIsSortMenuOpen(false);
                setIsViewMenuOpen(false);
                setIsNewMenuOpen(false);
              }}
              title="See more options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {isMounted && portalTarget && isMoreMenuOpen && moreMenuPos && createPortal(
              <div 
                className="fixed w-52 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl z-[999999] text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-100"
                style={{ top: moreMenuPos.top, left: moreMenuPos.left }}
                ref={moreMenuRef}
              >
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    setSelectedFileIds(new Set(currentItems.map((f) => f.id)));
                    if (currentItems.length > 0) setSelectedFile(currentItems[0]);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <span>Select all</span>
                  <span className="text-[10px] text-slate-400">Ctrl+A</span>
                </button>
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    setSelectedFileIds((prev) => {
                      const next = new Set<string>();
                      currentItems.forEach((f) => {
                        if (!prev.has(f.id)) next.add(f.id);
                      });
                      return next;
                    });
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <span>Invert selection</span>
                </button>
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    setSelectedFileIds(new Set());
                    setSelectedFile(null);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <span>Clear selection</span>
                </button>
                <div className="my-1 border-t border-slate-200 dark:border-white/10" />
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    const item = selectedFile || (selectedFileIds.size > 0 ? files.find((f) => selectedFileIds.has(f.id)) : null);
                    if (item) {
                      setSharingFile(item);
                    } else {
                      const currentFolderItem = files.find((f) => f.path === currentPath) || {
                        id: 'current-folder',
                        name: currentPath === 'This PC' ? 'This PC' : currentPath.split('/').pop() || currentPath,
                        path: currentPath,
                        type: 'folder' as const,
                        parentId: '',
                        modified: formatDateISO(new Date()),
                      };
                      setSharingFile(currentFolderItem);
                    }
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Share</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    openApp('terminal', { initialDir: currentPath });
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open in Terminal</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer text-slate-800 dark:text-slate-100 font-medium"
                  onClick={() => {
                    if (selectedFile) {
                      openProperties({
                        name: selectedFile.name,
                        type: selectedFile.type === 'folder' ? 'Folder' : `${selectedFile.extension?.toUpperCase() || 'Text'} File`,
                        location: selectedFile.path,
                        size: selectedFile.size || '1.0 KB',
                        modified: selectedFile.modified,
                        item: selectedFile,
                      });
                    } else {
                      openProperties({
                        name: currentPath,
                        type: 'Folder',
                        location: currentPath,
                        modified: 'Recent',
                      });
                    }
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Properties</span>
                </button>
              </div>,
              portalTarget
            )}
          </div>

          {/* Extract ZIP button if selected file is .zip */}
          {selectedFile && selectedFile.name.toLowerCase().endsWith('.zip') && (
            <button
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 cursor-pointer text-xs font-semibold transition-colors shrink-0"
              onClick={() => {
                extractZip(selectedFile, currentPath === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentPath);
              }}
              title="Extract All files from this ZIP archive"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Extract All</span>
            </button>
          )}

        </div>

        <div className="flex items-center gap-1">
          {/* Details Pane Toggle */}
          <button
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
              showDetailsPane ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
            onClick={() => {
              setShowDetailsPane(!showDetailsPane);
              if (!showDetailsPane) setShowPreviewPane(false);
            }}
            title="Toggle Details Pane"
          >
            <PanelRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Details</span>
          </button>
        </div>
      </div>

      {/* 4. Main Container Split: Sidebar + File Display Area + Details Pane */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 min-w-0">
        {/* Backdrop for Narrow Drawer Sidebar */}
        {isNarrowContainer && isSidebarVisible && (
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs z-35 animate-in fade-in duration-150"
            onClick={() => setIsSidebarVisible(false)}
          />
        )}

        {/* Left Sidebar Navigation Tree */}
        {isSidebarVisible && (
          <div
            className={`${
              isNarrowContainer
                ? 'absolute inset-y-0 left-0 z-40 w-60 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl animate-in slide-in-from-left duration-200'
                : 'w-44 sm:w-52 bg-white/80 dark:bg-slate-900/80 shrink-0 animate-in fade-in duration-150'
            } p-2 border-r border-slate-200 dark:border-white/10 overflow-y-auto space-y-1 text-xs select-none`}
          >
            {/* Narrow Drawer Close Header */}
            {isNarrowContainer && (
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-200 dark:border-white/10 px-1">
                <span className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-blue-500" /> Navigation
                </span>
                <button
                  onClick={() => setIsSidebarVisible(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  title="Close Navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                currentPath === 'This PC'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                  : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
              }`}
              onClick={() => {
                navigateTo('This PC');
                if (isNarrowContainer) setIsSidebarVisible(false);
              }}
            >
              <Home className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Home</span>
            </button>

            {/* Quick Access Section */}
            <div
              className="space-y-0.5 pt-1"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => handleDropOnExplorer(e, 'quick_access')}
            >
              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Access</span>
                <Pin className="w-3 h-3 text-slate-400" />
              </div>

              {quickSidebar.map((item, idx) => (
                <div
                  key={item.path}
                  data-quick-access-path={item.path}
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggedQaIndex(idx);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedQaIndex !== null && draggedQaIndex !== idx) {
                      setQuickSidebar((prev) => {
                        const updated = [...prev];
                        const [moved] = updated.splice(draggedQaIndex, 1);
                        updated.splice(idx, 0, moved);
                        setDraggedQaIndex(idx);
                        localStorage.setItem('win11_quick_access', JSON.stringify(updated));
                        return updated;
                      });
                    }
                  }}
                  onDragEnd={() => setDraggedQaIndex(null)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
                    draggedQaIndex === idx ? 'bg-blue-500/30 border border-blue-500' : ''
                  } ${
                    currentPath === item.path
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                  onClick={() => {
                    const matchingFile = files.find((f) => f.path === item.path);
                    if (matchingFile && matchingFile.type !== 'folder') {
                      handleItemDoubleClick(matchingFile);
                    } else {
                      navigateTo(item.path);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <AppIcon name={item.icon} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>

                  {/* Move Up/Down & Unpin Controls */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {idx > 0 && (
                      <button
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuickAccessItem(idx, 'up');
                        }}
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    {idx < quickSidebar.length - 1 && (
                      <button
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuickAccessItem(idx, 'down');
                        }}
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      className="p-0.5 hover:text-red-500 transition-opacity cursor-pointer shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        unpinFromQuickAccess(item.path);
                      }}
                      title="Unpin from Quick Access"
                    >
                      <PinOff className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="my-2 border-t border-slate-200 dark:border-white/10" />

            {/* This PC Section with Expandable Tree */}
            <div className="space-y-0.5">
              <div
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-semibold text-slate-800 dark:text-slate-200 cursor-pointer transition-colors ${
                  currentPath === 'This PC' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
                onClick={() => navigateTo('This PC')}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => toggleExpand('This PC', e)}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                  >
                    {expandedTreePaths.has('This PC') ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Monitor className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-xs">This PC</span>
                </div>
              </div>

              {/* Drives & Subfolders Tree */}
              {expandedTreePaths.has('This PC') && (
                <div className="space-y-0.5 pl-1.5">
                  {drivesData.map((drive) => {
                    const driveFile = files.find((file) => file.path === drive.path) || {
                      id: `drive-${drive.path.toLowerCase().replace(':', '')}`,
                      name: drive.name,
                      path: drive.path,
                      type: 'folder' as const,
                      parentId: 'This PC',
                      modified: '2026-08-10',
                    };
                    const driveFolders = files.filter(
                      (f) => drive.path !== 'C:' && f.type === 'folder' && f.parentId === drive.path
                    );
                    const hasFolders = driveFolders.length > 0;
                    const isDriveExpanded = expandedTreePaths.has(drive.path);
                    const isDriveSelected = selectedFile?.path === drive.path || selectedFileIds.has(driveFile.id);

                    return (
                      <div key={drive.path} className="space-y-0.5">
                        <div
                          data-virtual-drive={drive.path}
                          role="button"
                          tabIndex={0}
                          aria-label={`${drive.name}${drive.path === 'C:' ? ', locked' : ''}`}
                          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] cursor-pointer transition-colors ${
                            isDriveSelected
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(driveFile);
                            setSelectedFileIds(new Set([driveFile.id]));
                            navigateTo(drive.path);
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                              e.preventDefault();
                              navigateTo(drive.path);
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                          }}
                          onDrop={(e) => handleDropOnExplorer(e, drive.path)}
                        >
                          {hasFolders ? (
                            <button
                              onClick={(e) => toggleExpand(drive.path, e)}
                              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                            >
                              {isDriveExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          ) : (
                            <span className="w-3 h-3 shrink-0" />
                          )}
                          <VirtualDriveIcon
                            driveLetter={drive.path === 'C:' ? 'C:' : 'D:'}
                            className={`shrink-0 ${drive.path === 'C:' ? 'h-5 w-6' : 'h-4 w-6'}`}
                          />
                          <span className="truncate font-medium">{drive.name}</span>
                        </div>

                        {/* Subfolders under this drive */}
                        {isDriveExpanded && hasFolders && (
                          <div className="space-y-0.5">
                            {driveFolders.map((folder) => renderSidebarFolderItem(folder, 1))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="my-2 border-t border-slate-200 dark:border-white/10" />

            <button
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                currentPath === 'Recycle Bin'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              onClick={() => navigateTo('Recycle Bin')}
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Recycle Bin</span>
              </div>
              {deletedFiles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500/20 text-red-500">
                  {deletedFiles.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Right Content Files View + Marquee Selection Box */}
        <div
          ref={fileAreaRef}
          {...touchSensitivity.touchProps}
          className="flex-1 p-4 overflow-y-auto relative"
          onClick={() => {
            if (!touchSensitivity.shouldAllowClick()) return;
            if (!isSelectingRef.current) {
              setSelectedFile(null);
              setSelectedFileIds(new Set());
            }
          }}
          onMouseDown={handleFileAreaMouseDown}
          onMouseMove={handleFileAreaMouseMove}
          onMouseUp={handleFileAreaMouseUp}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => handleDropOnExplorer(e, currentPath)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu({
              type: 'explorer-space',
              x: e.clientX,
              y: e.clientY,
              currentPath: currentPath === 'This PC' ? 'C:' : currentPath,
            });
          }}
        >
          {/* SEARCH RESULTS VIEW */}
          {isSearching ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Search Results for "{searchTerm}" ({currentItems.length} found)
                </span>
                <button
                  className="text-blue-500 hover:underline text-[11px] cursor-pointer"
                  onClick={() => setSearchTerm('')}
                >
                  Clear Search
                </button>
              </div>

              {currentItems.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400">
                  <Search className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No items match your search.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Check for spelling errors or search for another keyword.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {currentItems.map((item) => (
                    <div
                      key={item.id}
                      data-file-id={item.id}
                      data-file-path={item.path}
                      data-file-item="true"
                      className={`flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer ${
                        selectedFile?.id === item.id || selectedFileIds.has(item.id) ? 'bg-blue-500/15 border-blue-500' : 'bg-white dark:bg-slate-900'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(item);
                        setSelectedFileIds(new Set([item.id]));
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleItemDoubleClick(item);
                      }}
                      onContextMenu={(e) => handleItemContextMenu(e, item)}
                    >
                      <div className="shrink-0">{renderItemIcon(item, 'w-8 h-8')}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-slate-800 dark:text-slate-100">{item.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{item.path}</div>
                      </div>
                      <div className="text-[11px] text-slate-400 shrink-0 text-right">
                        <div>{item.modified}</div>
                        <div>
                          {item.type === 'folder'
                            ? `${getFolderSizeInfo(item.path).formattedSize} (${getFolderSizeInfo(item.path).fileCount} items)`
                            : (item.size || formatBytesToHuman(getFileSizeBytes(item)))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentPath === 'This PC' ? (
            /* SPECIAL THIS PC VIEW: DEVICES AND DRIVES */
            <div className="space-y-6 select-none animate-in fade-in duration-150">
              {/* Devices and drives Section */}
              <div>
                <button
                  onClick={() => setIsDevicesCollapsed(!isDevicesCollapsed)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 mb-4 w-full text-left cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDevicesCollapsed ? '-rotate-90' : ''}`} />
                  <span>Devices and drives ({processedDrives.length})</span>
                </button>

                {!isDevicesCollapsed && (
                  processedDrives.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                      No devices or drives match the current filter/search criteria.
                    </div>
                  ) : viewMode === 'details' ? (
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white/50 dark:bg-white/5">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 font-semibold bg-slate-50 dark:bg-white/5">
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Total size</th>
                            <th className="py-2 px-3">Free space</th>
                          </tr>
                        </thead>
                        <tbody>
                          {processedDrives.map((drive) => {
                            const driveFile = files.find((f) => f.path === drive.path) || {
                              id: `drive-${drive.path.toLowerCase().replace(':', '')}`,
                              name: drive.name,
                              path: drive.path,
                              type: 'folder' as const,
                              parentId: 'This PC',
                              modified: '2026-08-10',
                            };
                            const isSelected = selectedFile?.path === drive.path || selectedFileIds.has(driveFile.id);
                            return (
                              <tr
                                key={drive.path}
                                data-drive-card={drive.path}
                                role="button"
                                tabIndex={0}
                                aria-label={`${drive.name}${drive.path === 'C:' ? ', locked' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFile(driveFile);
                                  setSelectedFileIds(new Set([driveFile.id]));
                                }}
                                onDoubleClick={() => navigateTo(drive.path)}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                    e.preventDefault();
                                    navigateTo(drive.path);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedFile(driveFile);
                                  setSelectedFileIds(new Set([driveFile.id]));
                                  showContextMenu({
                                    type: 'explorer-item',
                                    x: e.clientX,
                                    y: e.clientY,
                                    file: driveFile,
                                  });
                                }}
                                className={`border-b border-slate-100 dark:border-white/5 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 font-medium'
                                    : 'hover:bg-blue-500/10 text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                <td className="py-2 px-3 flex items-center gap-2">
                                  {showItemCheckboxes && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="rounded border-slate-300 text-blue-500"
                                    />
                                  )}
                                  <VirtualDriveIcon
                                    driveLetter={drive.path === 'C:' ? 'C:' : 'D:'}
                                    className={`shrink-0 ${drive.path === 'C:' ? 'h-10 w-12' : 'h-6 w-12'}`}
                                  />
                                  <span className="truncate">{drive.name}</span>
                                </td>
                                <td className="py-2 px-3 text-slate-400">Local Fixed Disk</td>
                                <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{drive.total}</td>
                                <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                  {drive.free}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 animate-in fade-in duration-150">
                      {processedDrives.map((drive) => {
                        const driveFile = files.find((f) => f.path === drive.path) || {
                          id: `drive-${drive.path.toLowerCase().replace(':', '')}`,
                          name: drive.name,
                          path: drive.path,
                          type: 'folder' as const,
                          parentId: 'This PC',
                          modified: '2026-08-10',
                        };
                        const isSelected = selectedFile?.path === drive.path || selectedFileIds.has(driveFile.id);

                        return (
                          <div
                            key={drive.path}
                            data-drive-card={drive.path}
                            role="button"
                            tabIndex={0}
                            aria-label={`${drive.name}${drive.path === 'C:' ? ', locked' : ''}`}
                            className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs group select-none min-w-0 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500/15 dark:bg-blue-500/20'
                                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500/80 hover:bg-blue-500/5'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(driveFile);
                              setSelectedFileIds(new Set([driveFile.id]));
                            }}
                            onDoubleClick={() => navigateTo(drive.path)}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                e.preventDefault();
                                navigateTo(drive.path);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedFile(driveFile);
                              setSelectedFileIds(new Set([driveFile.id]));
                              showContextMenu({
                                type: 'explorer-item',
                                x: e.clientX,
                                y: e.clientY,
                                file: driveFile,
                              });
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'copy';
                            }}
                            onDrop={(e) => handleDropOnExplorer(e, drive.path)}
                          >
                            <div className="flex h-[76px] w-[92px] items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                              <VirtualDriveIcon
                                driveLetter={drive.path === 'C:' ? 'C:' : 'D:'}
                                className={drive.path === 'C:' ? 'h-[72px] w-[92px]' : 'h-[52px] w-[92px]'}
                              />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5 overflow-hidden">
                              {renamingId === drive.path ? (
                                <input
                                  type="text"
                                  value={renamingName || ''}
                                  onChange={(e) => setRenamingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      updateDriveLabel(drive.path, renamingName);
                                      setRenamingId(null);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setRenamingId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (renamingName.trim()) {
                                      updateDriveLabel(drive.path, renamingName);
                                    }
                                    setRenamingId(null);
                                  }}
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full bg-blue-500/10 border border-blue-500 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                                />
                              ) : (
                                <div className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{drive.name}</div>
                              )}

                              {/* Windows 11 Capacity Bar */}
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/5">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    drive.percent > 90 ? 'bg-red-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${drive.path === 'C:' ? 30 : drive.path === 'D:' ? 15 : Math.min(100, Math.max(2, drive.percent))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : currentPath === 'Recycle Bin' ? (
            /* SPECIAL RECYCLE BIN VIEW IN THIS PC */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Recycle Bin</h2>
                    <p className="text-[11px] text-slate-500">{deletedFiles.length} deleted item(s)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedFileIds.size > 0 && (
                    <>
                      <button
                        onClick={() => {
                          if (selectedFileIds.size === deletedFiles.length) {
                            setSelectedFileIds(new Set());
                          } else {
                            setSelectedFileIds(new Set(deletedFiles.map((f) => f.id)));
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{selectedFileIds.size === deletedFiles.length ? 'Deselect All' : 'Select All'}</span>
                      </button>
                      <button
                        onClick={() => {
                          selectedFileIds.forEach((id) => restoreFile(id));
                          setSelectedFileIds(new Set());
                          addNotification({
                            title: 'Recycle Bin',
                            message: `Restored ${selectedFileIds.size} selected item(s).`,
                            type: 'success',
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Selected ({selectedFileIds.size})</span>
                      </button>
                      <button
                        onClick={() => {
                          setPendingDeleteRecycleIds(Array.from(selectedFileIds));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/40 font-semibold text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      deletedFiles.forEach((f) => restoreFile(f.id));
                      setSelectedFileIds(new Set());
                      addNotification({
                        title: 'Recycle Bin',
                        message: 'All items have been restored.',
                        type: 'success',
                      });
                    }}
                    disabled={deletedFiles.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-xs cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore All</span>
                  </button>
                  <button
                    onClick={() => {
                      if (deletedFiles.length === 0) return;
                      setShowConfirmEmptyRecycle(true);
                    }}
                    disabled={deletedFiles.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs cursor-pointer disabled:opacity-40 shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Empty Bin</span>
                  </button>
                </div>
              </div>

              {deletedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                    <Trash2 className="w-8 h-8 text-slate-400 opacity-60" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">The Recycle Bin is empty</p>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
                      Files and folders deleted from This PC appear here until you empty the bin.
                    </p>
                  </div>
                </div>
              ) : viewMode === 'details' ? (
                <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold">
                          <th className="py-2.5 px-3.5">Name</th>
                          <th className="py-2.5 px-3.5">Original Location</th>
                          <th className="py-2.5 px-3.5">Item Type</th>
                          <th className="py-2.5 px-3.5">Size</th>
                          <th className="py-2.5 px-3.5">Date Deleted</th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {deletedFiles.map((file) => (
                          <tr
                            key={file.id}
                            className={`hover:bg-blue-500/10 cursor-pointer transition-colors ${
                              selectedFile?.id === file.id || selectedFileIds.has(file.id) ? 'bg-blue-500/15' : ''
                            }`}
                            onClick={() => {
                              setSelectedFile(file);
                              setSelectedFileIds(new Set([file.id]));
                            }}
                          >
                            <td className="py-2.5 px-3.5 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                              {file.type === 'folder' ? (
                                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-cyan-500 shrink-0" />
                              )}
                              <span className="truncate max-w-[200px]">{file.name}</span>
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate max-w-[220px]">
                              {file.path}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-500 capitalize">{file.type}</td>
                            <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">{file.size || '1.2 KB'}</td>
                            <td className="py-2.5 px-3.5 text-slate-500">{file.modified || 'Recent'}</td>
                            <td className="py-2.5 px-3.5 text-right space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  restoreFile(file.id);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[11px] cursor-pointer transition-colors"
                              >
                                Restore
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDeleteRecycleIds([file.id]);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-[11px] cursor-pointer transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : viewMode === 'list' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 p-1">
                  {deletedFiles.map((file) => {
                    const isSelected = selectedFile?.id === file.id || selectedFileIds.has(file.id);
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-blue-500/20 border-blue-500 shadow-xs'
                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                        onClick={() => {
                          setSelectedFile(file);
                          setSelectedFileIds(new Set([file.id]));
                        }}
                        onDoubleClick={() => restoreFile(file.id)}
                      >
                        <div className="shrink-0">{renderItemIcon(file, 'w-5 h-5')}</div>
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</span>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'tiles' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-2">
                  {deletedFiles.map((file) => {
                    const isSelected = selectedFile?.id === file.id || selectedFileIds.has(file.id);
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-blue-500/20 border-blue-500 shadow-sm'
                            : 'border-slate-200/60 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                        onClick={() => {
                          setSelectedFile(file);
                          setSelectedFileIds(new Set([file.id]));
                        }}
                        onDoubleClick={() => restoreFile(file.id)}
                      >
                        <div className="w-10 h-10 flex items-center justify-center shrink-0">
                          {renderItemIcon(file, 'w-9 h-9')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {file.type === 'folder' ? 'Folder' : `${file.extension?.toUpperCase() || 'FILE'}`} • {file.size || '1.2 KB'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreFile(file.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-500 cursor-pointer"
                          title="Restore"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'content' ? (
                <div className="space-y-1.5">
                  {deletedFiles.map((file) => {
                    const isSelected = selectedFile?.id === file.id || selectedFileIds.has(file.id);
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-blue-500/20 border-blue-500 shadow-sm'
                            : 'border-slate-200/60 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                        onClick={() => {
                          setSelectedFile(file);
                          setSelectedFileIds(new Set([file.id]));
                        }}
                        onDoubleClick={() => restoreFile(file.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {renderItemIcon(file, 'w-8 h-8')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{file.path}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right text-[11px] text-slate-400">
                            <p>{file.modified || 'Recent'}</p>
                            <p>{file.size || '1.2 KB'}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreFile(file.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs cursor-pointer transition-colors"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* RECYCLE BIN GRID VIEW (Extra large, Large, Medium, Small, Grid) */
                <div
                  className={`grid gap-3.5 animate-in fade-in duration-150 ${
                    viewMode === 'extra-large'
                      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                      : viewMode === 'large'
                      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
                      : viewMode === 'small'
                      ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  }`}
                >
                  {deletedFiles.map((file) => {
                    const isSelected = selectedFile?.id === file.id || selectedFileIds.has(file.id);
                    const isImage = file.type === 'file' && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((file.extension || '').toLowerCase());
                    const iconClass =
                      viewMode === 'extra-large'
                        ? 'w-20 h-20'
                        : viewMode === 'large'
                        ? 'w-14 h-14'
                        : viewMode === 'small'
                        ? 'w-7 h-7'
                        : 'w-10 h-10';

                    return (
                      <div
                        key={file.id}
                        data-file-id={file.id}
                        data-file-item="true"
                        className={`group relative flex flex-col items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/40 shadow-md'
                            : 'border-slate-200/80 dark:border-white/10 hover:border-blue-400/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-xs'
                        }`}
                        onClick={(e) => {
                          if (!touchSensitivity.shouldAllowClick()) return;
                          e.stopPropagation();
                          setSelectedFileIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(file.id)) next.delete(file.id);
                            else next.add(file.id);
                            return next;
                          });
                          setSelectedFile(file);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          restoreFile(file.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFile(file);
                          setSelectedFileIds(new Set([file.id]));
                          showContextMenu({
                            type: 'explorer-item',
                            x: e.clientX,
                            y: e.clientY,
                            file: file,
                          });
                        }}
                      >
                        {/* Selection Checkbox Overlay */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFileIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(file.id)) next.delete(file.id);
                              else next.add(file.id);
                              return next;
                            });
                          }}
                          className={`absolute top-2.5 left-2.5 z-20 w-4 h-4 rounded flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-black/40 dark:bg-black/60 text-transparent hover:text-white/80 border border-slate-300 dark:border-white/30'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </div>

                        {/* Thumbnail Preview Box */}
                        <div className="w-full aspect-square rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center overflow-hidden mb-2 relative group-hover:shadow-inner transition-transform">
                          {isImage && file.localCaptureId ? (
                            renderItemIcon(file, 'w-full h-full')
                          ) : isImage && file.content && !file.content.startsWith(LOCAL_CAPTURE_CONTENT_PREFIX) ? (
                            <img
                              src={file.content}
                              alt={file.name}
                              className="w-full h-full object-cover rounded-xl"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex items-center justify-center p-3">
                              {renderItemIcon(file, iconClass)}
                            </div>
                          )}

                          {/* Quick Restore & Delete Permanently Action Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1.5 p-1 backdrop-blur-[2px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreFile(file.id);
                              }}
                              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer transition-transform hover:scale-110"
                              title="Restore to original location"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDeleteRecycleIds([file.id]);
                              }}
                              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md cursor-pointer transition-transform hover:scale-110"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title and size */}
                        <div className="w-full text-center space-y-0.5">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-full" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-full font-mono">
                            {file.size || '1.2 KB'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : currentItems.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400">
              This folder is empty.
            </div>
          ) : viewMode === 'details' ? (
            <div className={`space-y-0.5 ${isCompactView ? 'text-[11px]' : 'text-xs'}`}>
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-200 dark:border-white/10 select-none">
                <button
                  onClick={() => {
                    if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('name'); setSortOrder('asc'); }
                  }}
                  className="col-span-5 flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 text-left cursor-pointer"
                >
                  <span>Name</span>
                  {sortBy === 'name' && (
                    <span className="text-blue-500 text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'modified') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('modified'); setSortOrder('asc'); }
                  }}
                  className="col-span-3 flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 text-left cursor-pointer"
                >
                  <span>Date modified</span>
                  {sortBy === 'modified' && (
                    <span className="text-blue-500 text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'type') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('type'); setSortOrder('asc'); }
                  }}
                  className="col-span-2 flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 text-left cursor-pointer"
                >
                  <span>Type</span>
                  {sortBy === 'type' && (
                    <span className="text-blue-500 text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'size') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('size'); setSortOrder('asc'); }
                  }}
                  className="col-span-2 flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 text-left cursor-pointer"
                >
                  <span>Size</span>
                  {sortBy === 'size' && (
                    <span className="text-blue-500 text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </button>
              </div>
              {currentItems.map((item, index) => {
                const isDragTarget = dragOverFolderId === item.id;
                const isSelected = selectedFile?.id === item.id || selectedFileIds.has(item.id);
                const displayName = showFileExtensions || item.type === 'folder' ? item.name : item.name.replace(/\.[^/.]+$/, '');

                return (
                  <div
                    key={item.id}
                    data-file-id={item.id}
                    data-file-path={item.path}
                    data-file-item="true"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'file_item', file: item, fileId: item.id }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (item.type === 'folder') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverFolderId !== item.id) {
                          setDragOverFolderId(item.id);
                        }
                      }
                    }}
                    onDragLeave={(e) => {
                      if (item.type === 'folder') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragOverFolderId === item.id) {
                          setDragOverFolderId(null);
                        }
                      }
                    }}
                    onDrop={(e) => {
                      if (item.type === 'folder') {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverFolderId(null);
                        handleDropOnExplorer(e, item.path);
                      }
                    }}
                    className={`grid grid-cols-12 gap-2 px-3 ${isCompactView ? 'py-1' : 'py-1.5'} rounded-lg items-center cursor-pointer transition-colors ${
                      isDragTarget
                        ? 'bg-blue-500/25 ring-2 ring-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                        : isSelected
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                    onClick={(e) => {
                      if (!touchSensitivity.shouldAllowClick()) return;
                      e.stopPropagation();
                      if (e.shiftKey && lastClickedIndexRef.current !== null) {
                        const minIdx = Math.min(lastClickedIndexRef.current, index);
                        const maxIdx = Math.max(lastClickedIndexRef.current, index);
                        const rangeIds = new Set<string>();
                        for (let i = minIdx; i <= maxIdx; i++) {
                          if (currentItems[i]) rangeIds.add(currentItems[i].id);
                        }
                        setSelectedFileIds(rangeIds);
                        setSelectedFile(item);
                      } else if (e.ctrlKey || e.metaKey) {
                        setSelectedFileIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                        setSelectedFile(item);
                        lastClickedIndexRef.current = index;
                      } else {
                        setSelectedFile(item);
                        setSelectedFileIds(new Set([item.id]));
                        lastClickedIndexRef.current = index;
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleItemDoubleClick(item);
                    }}
                    onContextMenu={(e) => handleItemContextMenu(e, item)}
                  >
                    <span className="col-span-5 flex items-center gap-2 truncate">
                      {showItemCheckboxes && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-blue-500 focus:ring-0 cursor-pointer shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFileIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                        />
                      )}
                      {renderItemIcon(item, 'w-4 h-4 shrink-0')}
                      {renamingId === item.id ? (
                        <input
                          type="text"
                          value={renamingName || ''}
                          onChange={(e) => setRenamingName(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (renamingName.trim()) renameFile(item.id, renamingName.trim());
                              setRenamingId(null);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setRenamingId(null);
                            }
                          }}
                          onBlur={() => {
                            if (renamingName.trim()) renameFile(item.id, renamingName.trim());
                            setRenamingId(null);
                          }}
                          autoFocus
                          className="px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-blue-500 rounded outline-none shadow"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate">{displayName}</span>
                      )}
                    </span>
                    <span className="col-span-3 text-slate-400 text-[11px] truncate">{item.modified || 'Recent'}</span>
                    <span className="col-span-2 text-slate-400 text-[11px] truncate capitalize">{item.type === 'folder' ? 'File folder' : `${item.extension?.toUpperCase() || 'Text'} document`}</span>
                    <span className="col-span-2 text-slate-400 text-[11px] truncate">
                      {item.type === 'folder'
                        ? getFolderSizeInfo(item.path).formattedSize
                        : (item.size || formatBytesToHuman(getFileSizeBytes(item)))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'tiles' ? (
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 ${isCompactView ? 'p-1' : 'p-2'}`}>
              {currentItems.map((item, index) => {
                const isSelected = selectedFile?.id === item.id || selectedFileIds.has(item.id);
                const displayName = showFileExtensions || item.type === 'folder' ? item.name : item.name.replace(/\.[^/.]+$/, '');
                return (
                  <div
                    key={item.id}
                    data-file-id={item.id}
                    data-file-path={item.path}
                    data-file-item="true"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'file_item', file: item, fileId: item.id }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-500 shadow-sm'
                        : 'border-slate-200/60 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                    onClick={(e) => {
                      if (!touchSensitivity.shouldAllowClick()) return;
                      e.stopPropagation();
                      setSelectedFile(item);
                      setSelectedFileIds(new Set([item.id]));
                      lastClickedIndexRef.current = index;
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleItemDoubleClick(item);
                    }}
                    onContextMenu={(e) => handleItemContextMenu(e, item)}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      {renderItemIcon(item, 'w-9 h-9')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.type === 'folder' ? 'File folder' : `${(item.extension || 'file').toUpperCase()} • ${item.size || formatBytesToHuman(getFileSizeBytes(item))}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'content' ? (
            <div className="space-y-1.5">
              {currentItems.map((item, index) => {
                const isSelected = selectedFile?.id === item.id || selectedFileIds.has(item.id);
                const displayName = showFileExtensions || item.type === 'folder' ? item.name : item.name.replace(/\.[^/.]+$/, '');
                return (
                  <div
                    key={item.id}
                    data-file-id={item.id}
                    data-file-path={item.path}
                    data-file-item="true"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'file_item', file: item, fileId: item.id }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-500 shadow-sm'
                        : 'border-slate-200/60 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                    onClick={(e) => {
                      if (!touchSensitivity.shouldAllowClick()) return;
                      e.stopPropagation();
                      setSelectedFile(item);
                      setSelectedFileIds(new Set([item.id]));
                      lastClickedIndexRef.current = index;
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleItemDoubleClick(item);
                    }}
                    onContextMenu={(e) => handleItemContextMenu(e, item)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center shrink-0">
                        {renderItemIcon(item, 'w-8 h-8')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{item.type === 'folder' ? 'File folder' : `${item.extension?.toUpperCase() || 'Text'} document`}</p>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 shrink-0">
                      <p>{item.modified || 'Recent'}</p>
                      <p>{item.type === 'folder' ? getFolderSizeInfo(item.path).formattedSize : (item.size || formatBytesToHuman(getFileSizeBytes(item)))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 ${isCompactView ? 'p-1' : 'p-2'}`}>
              {currentItems.map((item, index) => {
                const isSelected = selectedFile?.id === item.id || selectedFileIds.has(item.id);
                const displayName = showFileExtensions || item.type === 'folder' ? item.name : item.name.replace(/\.[^/.]+$/, '');
                return (
                  <div
                    key={item.id}
                    data-file-id={item.id}
                    data-file-path={item.path}
                    data-file-item="true"
                    draggable={true}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                      isSelected
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                    onClick={(e) => {
                      if (!touchSensitivity.shouldAllowClick()) return;
                      e.stopPropagation();
                      setSelectedFile(item);
                      setSelectedFileIds(new Set([item.id]));
                      lastClickedIndexRef.current = index;
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleItemDoubleClick(item);
                    }}
                    onContextMenu={(e) => handleItemContextMenu(e, item)}
                  >
                    {renderItemIcon(item, 'w-4 h-4 shrink-0')}
                    <span className="truncate">{displayName}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Icon Grid Modes: extra-large, large, medium (default), small */
            <div
              className={`grid ${
                viewMode === 'extra-large'
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                  : viewMode === 'large'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5'
                  : viewMode === 'small'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5'
                  : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3'
              } ${isCompactView ? 'p-1' : 'p-2'}`}
            >
              {currentItems.map((item, index) => {
                const isDragTarget = dragOverFolderId === item.id;
                const isSelected = selectedFile?.id === item.id || selectedFileIds.has(item.id);
                const displayName = showFileExtensions || item.type === 'folder' ? item.name : item.name.replace(/\.[^/.]+$/, '');
                const iconSize =
                  viewMode === 'extra-large'
                    ? 'w-24 h-24'
                    : viewMode === 'large'
                    ? 'w-16 h-16'
                    : viewMode === 'small'
                    ? 'w-5 h-5'
                    : 'w-10 h-10';

                return (
                  <div
                    key={item.id}
                    data-file-id={item.id}
                    data-file-path={item.path}
                    data-file-item="true"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'file_item', file: item, fileId: item.id }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (item.type === 'folder') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverFolderId !== item.id) {
                          setDragOverFolderId(item.id);
                        }
                      }
                    }}
                    onDragLeave={(e) => {
                      if (item.type === 'folder') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragOverFolderId === item.id) {
                          setDragOverFolderId(null);
                        }
                      }
                    }}
                    onDrop={(e) => {
                      if (item.type === 'folder') {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverFolderId(null);
                        handleDropOnExplorer(e, item.path);
                      }
                    }}
                    className={`group relative ${
                      viewMode === 'small' ? 'flex items-center gap-2 p-1.5' : 'flex flex-col items-center justify-center p-3'
                    } rounded-xl border transition-all cursor-pointer select-none ${
                      isDragTarget
                        ? 'bg-blue-500/25 border-blue-500 ring-2 ring-blue-500 scale-[1.02] shadow-md'
                        : isSelected
                        ? 'bg-blue-500/20 border-blue-500 shadow-sm'
                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                    title={
                      item.type === 'folder'
                        ? `${item.name} • ${getFolderSizeInfo(item.path).formattedSize} (${getFolderSizeInfo(item.path).fileCount} files)`
                        : `${item.name} • ${item.size || formatBytesToHuman(getFileSizeBytes(item))}`
                    }
                    onClick={(e) => {
                      if (!touchSensitivity.shouldAllowClick()) return;
                      e.stopPropagation();
                      if (e.shiftKey && lastClickedIndexRef.current !== null) {
                        const minIdx = Math.min(lastClickedIndexRef.current, index);
                        const maxIdx = Math.max(lastClickedIndexRef.current, index);
                        const rangeIds = new Set<string>();
                        for (let i = minIdx; i <= maxIdx; i++) {
                          if (currentItems[i]) rangeIds.add(currentItems[i].id);
                        }
                        setSelectedFileIds(rangeIds);
                        setSelectedFile(item);
                      } else if (e.ctrlKey || e.metaKey) {
                        setSelectedFileIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                        setSelectedFile(item);
                        lastClickedIndexRef.current = index;
                      } else {
                        setSelectedFile(item);
                        setSelectedFileIds(new Set([item.id]));
                        lastClickedIndexRef.current = index;
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleItemDoubleClick(item);
                    }}
                    onContextMenu={(e) => handleItemContextMenu(e, item)}
                  >
                    {showItemCheckboxes && (
                      <div className="absolute top-1.5 left-1.5 z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-blue-500 focus:ring-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFileIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                        />
                      </div>
                    )}
                    <div className={`${viewMode === 'small' ? 'w-6 h-6' : viewMode === 'extra-large' ? 'w-28 h-28 mb-3' : viewMode === 'large' ? 'w-20 h-20 mb-2' : 'w-12 h-12 mb-2'} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}>
                      {renderItemIcon(item, iconSize)}
                    </div>
                    {renamingId === item.id ? (
                      <input
                        type="text"
                        value={renamingName || ''}
                        onChange={(e) => setRenamingName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (renamingName.trim()) {
                              renameFile(item.id, renamingName.trim());
                            }
                            setRenamingId(null);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                        onBlur={() => {
                          if (renamingName.trim()) {
                            renameFile(item.id, renamingName.trim());
                          }
                          setRenamingId(null);
                        }}
                        autoFocus
                        className="w-full px-1.5 py-0.5 text-xs text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-blue-500 rounded outline-none shadow"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={`text-xs font-medium ${viewMode === 'small' ? 'text-left truncate' : 'text-center line-clamp-2 max-w-full'}`}>
                        {displayName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Marquee Selection Rectangle Box */}
          {selectionBox && (
            <div
              className="absolute border border-blue-400 bg-blue-500/20 rounded pointer-events-none z-30"
              style={{
                left: selectionBox.x,
                top: selectionBox.y,
                width: selectionBox.w,
                height: selectionBox.h,
              }}
            />
          )}
        </div>

        {/* Preview Pane Right Sidebar */}
        {showPreviewPane && (
          <div className="w-72 p-4 border-l border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/80 overflow-y-auto space-y-4 text-xs shrink-0 select-text animate-in slide-in-from-right-4 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                <PanelRightClose className="w-4 h-4 text-blue-500" />
                <span>Preview</span>
              </div>
              <button
                onClick={() => setShowPreviewPane(false)}
                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedFile ? (
              <div className="space-y-3">
                {['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes((selectedFile.extension || '').toLowerCase()) && selectedFile.content ? (
                  <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-black/5 flex items-center justify-center">
                    <img
                      src={selectedFile.content}
                      alt={selectedFile.name}
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : ['mp4', 'webm', 'mov'].includes((selectedFile.extension || '').toLowerCase()) && selectedFile.content ? (
                  <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-black flex items-center justify-center">
                    <video src={selectedFile.content} controls className="max-h-full max-w-full" />
                  </div>
                ) : selectedFile.content ? (
                  <div className="w-full h-56 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text text-slate-800 dark:text-slate-200">
                    {selectedFile.content.slice(0, 2000)}
                    {selectedFile.content.length > 2000 && '\n... [Preview truncated]'}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <File className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>No preview available for this item</p>
                  </div>
                )}
                <div className="text-center pt-2">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{selectedFile.name}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedFile.size || '1.2 KB'}</p>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                <PanelRightClose className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-500" />
                <p>Select a file to preview.</p>
              </div>
            )}
          </div>
        )}

        {/* Details Pane Right Sidebar */}
        {showDetailsPane && (
          <div className="w-64 p-4 border-l border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/80 overflow-y-auto space-y-4 text-xs shrink-0 select-text animate-in slide-in-from-right-4 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <button className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                <PanelRight className="w-4 h-4 text-blue-500" />
                <span>Details</span>
              </button>
              <button
                onClick={() => setShowDetailsPane(false)}
                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedFile ? (
              <div className="space-y-4">
                {/* File Icon & Title (Image 7) */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-white/10 text-center">
                  {['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'heic'].includes((selectedFile.extension || '').toLowerCase()) && selectedFile.content ? (
                    <img
                      src={selectedFile.content}
                      alt={selectedFile.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-32 object-cover rounded-xl shadow mb-2 border border-black/10 dark:border-white/10"
                    />
                  ) : (
                    <div className="p-3 my-1">{renderItemIcon(selectedFile, 'w-12 h-12')}</div>
                  )}
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-full mt-1">{selectedFile.name}</h4>
                  <p className="text-[10px] text-slate-400 truncate">{selectedFile.type === 'folder' ? 'File folder' : `${selectedFile.extension?.toUpperCase() || 'Text'} Document`}</p>
                </div>

                {/* Set as Desktop / Lock Screen Background for Images & Videos */}
                {selectedFile.type !== 'folder' &&
                  ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'heic', 'mp4', 'webm', 'mov', 'mkv', 'avi'].includes(
                    (selectedFile.extension || '').toLowerCase()
                  ) && (
                    <div className="space-y-1.5 w-full">
                      <button
                        onClick={() => {
                          updateSettings({
                            wallpaper: 'custom',
                            customWallpaperUrl: selectedFile.content || selectedFile.path,
                          });
                          addNotification({
                            title: 'Desktop Background Updated',
                            message: `Set "${selectedFile.name}" as desktop background`,
                            type: 'success',
                          });
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Monitor className="w-4 h-4 stroke-[2.5]" />
                        <span>Set as desktop background</span>
                      </button>

                      <button
                        onClick={() => {
                          updateSettings({
                            lockScreenWallpaper: 'custom',
                            customLockScreenUrl: selectedFile.content || selectedFile.path,
                          });
                          addNotification({
                            title: 'Lock Screen Background Updated',
                            message: `Set "${selectedFile.name}" as lock screen background`,
                            type: 'success',
                          });
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Lock className="w-4 h-4 stroke-[2.5]" />
                        <span>Set as lock screen</span>
                      </button>
                    </div>
                  )}

                {/* Details Section (Image 7) */}
                <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
                  <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">Details</h5>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-start justify-between">
                      <span className="text-slate-400">Type</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-right">{selectedFile.type === 'folder' ? 'File folder' : `${selectedFile.extension?.toUpperCase() || 'TXT'} Document`}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-400">Size</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-right">
                        {selectedFile.type === 'folder'
                          ? `${getFolderSizeInfo(selectedFile.path).formattedSize} (${getFolderSizeInfo(selectedFile.path).totalBytes.toLocaleString()} bytes)`
                          : (selectedFile.size || formatBytesToHuman(getFileSizeBytes(selectedFile)))}
                      </span>
                    </div>
                    {selectedFile.type === 'folder' && (
                      <div className="flex items-start justify-between">
                        <span className="text-slate-400">Contains</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-right">
                          {getFolderSizeInfo(selectedFile.path).fileCount} Files, {getFolderSizeInfo(selectedFile.path).folderCount} Folders
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <span className="text-slate-400">File location</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-right truncate max-w-[130px]" title={selectedFile.path}>{selectedFile.path.replace(/\/[^\/]+$/, '') || 'C:\\'}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-400">Date modified</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-right">{selectedFile.modified || '04-Sep-25 10:46 PM'}</span>
                    </div>
                  </div>
                </div>

                {/* Properties Button (Image 7) */}
                <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                  <button
                    onClick={() => {
                      if (selectedFile) {
                        if (selectedFile.path === 'C:' || selectedFile.path === 'D:') {
                          const drive = drivesData.find((d) => d.path === selectedFile.path);
                          openProperties({
                            name: drive?.name || selectedFile.name,
                            type: 'Local Disk',
                            location: selectedFile.path,
                            drivePath: selectedFile.path,
                            usedGB: drive?.used,
                            freeGB: drive?.free,
                            totalGB: drive?.total,
                            fileSystem: 'NTFS',
                            created: 'August 10, 2026, 12:00:00 PM',
                            modified: 'August 13, 2026, 12:00:00 PM',
                          });
                        } else {
                          openProperties({
                            name: selectedFile.name,
                            type: selectedFile.type === 'folder' ? 'Folder' : `${selectedFile.extension?.toUpperCase() || 'Text'} File`,
                            location: selectedFile.path,
                            size: selectedFile.size || '1.0 KB',
                            modified: selectedFile.modified,
                          });
                        }
                      }
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-center cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-slate-300/50 dark:border-white/10"
                  >
                    <Wrench className="w-3.5 h-3.5 text-blue-500" />
                    <span>Properties</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* No Item Selected Header Graphic (Image 6) */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-white/10 text-center">
                  <div className="p-4 rounded-2xl bg-sky-500/10 mb-2">
                    <Monitor className="w-12 h-12 text-sky-500" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                    {currentPath === 'This PC' ? `This PC (${drivesData.length} items)` : `${normalizedCurrentPath.split('/').pop()} (${currentItems.length} items)`}
                  </h4>
                </div>

                {/* Info Callout Card (Exact match to Image 6) */}
                <div className="p-3 bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-300 flex items-start gap-2 text-xs leading-relaxed">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Select a single file to get more information and share your cloud content.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Status Bar (Windows 11 Explorer Standard) */}
      <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>
            {currentPath === 'This PC' && (filterType === 'all' || filterType === 'folders')
              ? `${processedDrives.length} item${processedDrives.length === 1 ? '' : 's'}`
              : `${currentItems.length} item${currentItems.length === 1 ? '' : 's'}`}
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          {selectedItemsList.length > 0 ? (
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              {selectedItemsList.length} item{selectedItemsList.length === 1 ? '' : 's'} selected ({formatBytesToHuman(totalSelectedBytes)})
            </span>
          ) : (
            <span>0 items selected</span>
          )}
          {filterType !== 'all' && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium text-[10px]">
                Filter: {filterType}
              </span>
            </>
          )}
        </div>

        {/* View Switcher Icons at Bottom Right */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
              viewMode === 'list' ? 'text-blue-500 font-bold bg-blue-500/10' : 'text-slate-400'
            }`}
            title="Details / List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
              viewMode === 'grid' ? 'text-blue-500 font-bold bg-blue-500/10' : 'text-slate-400'
            }`}
            title="Large icons / Grid view"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Properties Modal / File Preview */}
      {showDriveAccessDenied && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center overflow-y-auto p-4 bg-slate-950/65 backdrop-blur-sm"
          onClick={() => setShowDriveAccessDenied(false)}
        >
          <section
            ref={driveAccessDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Access denied"
            tabIndex={-1}
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-2xl text-slate-800 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleDriveAccessDialogKeyDown}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold"><button
                    type="button"
                    data-access-keyword="true"
                    className="appearance-none border-0 bg-transparent p-0 font-inherit text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    onClick={handleAccessKeywordClick}
                    onDoubleClick={handleAccessKeywordDoubleClick}
                    onKeyDown={handleAccessKeywordKeyDown}
                    onTouchEnd={handleAccessKeywordTouchEnd}
                  >
                    Access 
                  </button> denied</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Sorry, you can’t access this drive.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                onClick={() => setShowDriveAccessDenied(false)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {showPropertiesModal && (
        <div
          className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in ${
            settings.theme === 'light' ? 'bg-slate-950/40' : 'bg-slate-950/60'
          }`}
          onClick={() => setShowPropertiesModal(null)}
        >
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 text-xs select-text ${
              settings.theme === 'light'
                ? 'bg-white border-slate-200 text-slate-800'
                : 'bg-slate-900 border-white/10 text-slate-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b pb-2 ${
              settings.theme === 'light' ? 'border-slate-200' : 'border-white/10'
            }`}>
              <h3 className={`font-bold text-sm flex items-center gap-2 ${
                settings.theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <Info className="w-4 h-4 text-blue-500" /> File Properties
              </h3>
              <button
                className={`p-1 rounded-full cursor-pointer ${
                  settings.theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-300'
                }`}
                onClick={() => setShowPropertiesModal(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showPropertiesModal.content &&
              (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff'].includes(
                (showPropertiesModal.extension || '').toLowerCase()
              ) ||
                showPropertiesModal.content.startsWith('http') ||
                showPropertiesModal.content.startsWith('data:image')) && (
                <div className={`w-full max-h-56 min-h-[140px] rounded-xl overflow-hidden border flex items-center justify-center p-2 ${
                  settings.theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'
                }`}>
                  <img
                    src={showPropertiesModal.content}
                    alt={showPropertiesModal.name}
                    referrerPolicy="no-referrer"
                    className="max-h-52 w-full object-contain rounded-lg drop-shadow"
                  />
                </div>
              )}

            <div className={`space-y-1.5 ${
              settings.theme === 'light' ? 'text-slate-600' : 'text-slate-300'
            }`}>
              <p><strong className={settings.theme === 'light' ? 'text-slate-900' : 'text-white'}>Name:</strong> {showPropertiesModal.name}</p>
              <p><strong className={settings.theme === 'light' ? 'text-slate-900' : 'text-white'}>Path:</strong> {showPropertiesModal.path}</p>
              <p><strong className={settings.theme === 'light' ? 'text-slate-900' : 'text-white'}>Type:</strong> {showPropertiesModal.type === 'folder' ? 'File Folder' : `${showPropertiesModal.extension?.toUpperCase()} File`}</p>
              <p>
                <strong className={settings.theme === 'light' ? 'text-slate-900' : 'text-white'}>Size:</strong>{' '}
                {showPropertiesModal.type === 'folder'
                  ? `${getFolderSizeInfo(showPropertiesModal.path).formattedSize} (${getFolderSizeInfo(showPropertiesModal.path).totalBytes.toLocaleString()} bytes)`
                  : (showPropertiesModal.size || 'N/A')}
              </p>
              {showPropertiesModal.type === 'folder' && (
                <p>
                  <strong className={settings.theme === 'light' ? 'text-slate-900' : 'text-white'}>Contains:</strong>{' '}
                  {getFolderSizeInfo(showPropertiesModal.path).fileCount} Files, {getFolderSizeInfo(showPropertiesModal.path).folderCount} Folders
                </p>
              )}
              <p><strong className={settings.theme === 'light' ? 'text-slate-900' : 'text-white'}>Modified:</strong> {showPropertiesModal.modified}</p>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal Integration */}
      <ShareModal
        file={sharingFile}
        isOpen={!!sharingFile}
        onClose={() => setSharingFile(null)}
      />

      {/* Empty Bin Confirmation Modal */}
      {showConfirmEmptyRecycle && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Empty Recycle Bin?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  Are you sure you want to permanently delete all {deletedFiles.length} item(s)? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-colors"
                onClick={() => setShowConfirmEmptyRecycle(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-red-600/20"
                onClick={() => {
                  emptyRecycleBin();
                  setSelectedFileIds(new Set());
                  setShowConfirmEmptyRecycle(false);
                  addNotification({
                    title: 'Recycle Bin',
                    message: 'The Recycle Bin has been emptied.',
                    type: 'info',
                  });
                }}
              >
                Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected / Single Confirmation Modal */}
      {pendingDeleteRecycleIds.length > 0 && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {pendingDeleteRecycleIds.length === 1 ? 'Permanently Delete Item?' : 'Permanently Delete Selected Items?'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  {pendingDeleteRecycleIds.length === 1
                    ? 'Are you sure you want to permanently delete this item? This action cannot be undone.'
                    : `Are you sure you want to permanently delete the ${pendingDeleteRecycleIds.length} selected item(s)? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-colors"
                onClick={() => setPendingDeleteRecycleIds([])}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-red-600/20"
                onClick={() => {
                  pendingDeleteRecycleIds.forEach((id) => deletePermanently(id));
                  setSelectedFileIds((prev) => {
                    const next = new Set(prev);
                    pendingDeleteRecycleIds.forEach((id) => next.delete(id));
                    return next;
                  });
                  setPendingDeleteRecycleIds([]);
                  addNotification({
                    title: 'Recycle Bin',
                    message: pendingDeleteRecycleIds.length === 1 ? 'Permanently deleted item.' : `Permanently deleted ${pendingDeleteRecycleIds.length} selected items.`,
                    type: 'info',
                  });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
