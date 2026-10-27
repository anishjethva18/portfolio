import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { publicMedia } from 'virtual:portfolio-public-media';
import { useOS } from '../../context/OSContext';
import { FileItem } from '../../types';
import { soundManager } from '../../utils/sound';
import { getMediaPreviewUrl, VideoFrameThumbnail } from '../common/MediaThumbnail';
import { captureStorageService, LocalCaptureRecord } from '../../services/captureStorageService';
import { useTouchSensitivity } from '../../hooks/useTouchSensitivity';
import { isPortfolioMediaUrl } from '../../utils/portfolioMedia';
import { motion } from 'motion/react';
import {
  buildVirtualDDriveFiles,
  D_DRIVE_FOLDER_PATHS,
  type PublishedDriveContent,
} from '../../utils/virtualDDrive';
import {
  Image as ImageIcon,
  Film,
  Music,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  Trash2,
  AlertTriangle,
  Copy,
  Scissors,
  Clipboard,
  CheckSquare,
  Square,
  Info,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  Folder,
  Download,
  X,
  Monitor,
  Heart,
  Camera,
  Calendar,
  Search,
  Settings as SettingsIcon,
  ChevronDown,
  Menu,
  ArrowLeft,
  RefreshCw,
  HardDrive,
  ExternalLink,
  Mail,
  FileText,
  Sparkles,
  Check,
  Eye,
  Lock,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';

interface PhotosAppProps {
  filePath?: string;
  initialMediaId?: string;
  initialMediaUrl?: string;
  initialMediaName?: string;
  initialMediaExtension?: string;
}

export interface LocalAlbum {
  id: string;
  title: string;
  path: string;
  files: FileItem[];
  count: number;
  iconType: string;
  modified: string;
}

interface MediaAppSettings {
  theme: 'dark' | 'light' | 'system';
  autoPlayVideos: boolean;
  showFilmstrip: boolean;
  hardwareAccel: boolean;
  confirmDelete: boolean;
  gridTileSize: 'small' | 'medium' | 'large' | 'xlarge';
  sortOrder: 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-desc';
  loopVideos: boolean;
  wallpaperFit: 'fill' | 'fit' | 'stretch' | 'center';
}

const DEFAULT_SETTINGS: MediaAppSettings = {
  theme: 'dark',
  autoPlayVideos: true,
  showFilmstrip: true,
  hardwareAccel: true,
  confirmDelete: true,
  gridTileSize: 'medium',
  sortOrder: 'newest',
  loopVideos: false,
  wallpaperFit: 'fill',
};

const RenderMediaCover: React.FC<{
  media: FileItem;
  className?: string;
  isVid?: boolean;
}> = ({ media, className = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300', isVid }) => {
  const ext = (media.extension || '').toLowerCase();
  const isVideo =
    isVid !== undefined
      ? isVid
      : ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi', 'wmv', 'flv', 'm4v'].includes(ext) ||
        media.content?.startsWith('data:video') ||
        media.content?.includes('/sample/') ||
        media.content?.endsWith('.mp4');

  if (isVideo) {
    return (
      <VideoFrameThumbnail
        src={media.content}
        poster={media.poster}
        name={media.name}
        className={className}
      />
    );
  }

  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || media.content?.startsWith('data:audio') || media.content?.includes('.mp3');

  if (isAudio) {
    const poster = media.poster || getMediaPreviewUrl(media) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';
    return (
      <div className="relative w-full h-full overflow-hidden bg-slate-900 flex items-center justify-center">
        <img
          src={poster}
          alt={media.name}
          className={className}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-md">
            <Music className="w-4 h-4 fill-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={
        getMediaPreviewUrl(media) ||
        media.content ||
        'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80'
      }
      alt={media.name}
      referrerPolicy="no-referrer"
      className={className}
      loading="lazy"
    />
  );
};

export const MediaApp: React.FC<PhotosAppProps> = ({
  filePath,
  initialMediaId,
  initialMediaUrl,
  initialMediaName,
  initialMediaExtension,
}) => {
  const {
    files,
    settings,
    deleteFile,
    deleteFiles,
    copyFiles,
    copyFile,
    cutFiles,
    cutFile,
    pasteFile,
    clipboard,
    addNotification,
    openApp,
    updateSettings,
    addClipboardHistory,
    deletedFiles,
    restoreFile,
    deletePermanently,
    emptyRecycleBin,
  } = useOS();
  const [localCaptureSources, setLocalCaptureSources] = useState<Map<string, { url: string; status: LocalCaptureRecord['archiveStatus']; archiveId?: string }>>(new Map());
  const localCaptureUrlsRef = useRef(new Map<string, { url: string; signature: string }>());

  useEffect(() => {
    let isCurrent = true;
    let loadRevision = 0;
    const loadLocalCaptures = async () => {
      const revision = ++loadRevision;
      try {
        const captures = await captureStorageService.list();
        if (!isCurrent || revision !== loadRevision) {
          return;
        }
        const capturesById = new Map(captures.map((capture) => [capture.id, capture]));
        for (const [id, source] of localCaptureUrlsRef.current) {
          if (!capturesById.has(id)) {
            URL.revokeObjectURL(source.url);
            localCaptureUrlsRef.current.delete(id);
          }
        }
        for (const capture of captures) {
          const signature = `${capture.createdAt}:${capture.blob.size}:${capture.blob.type}:${capture.mimeType}`;
          const existingSource = localCaptureUrlsRef.current.get(capture.id);
          if (existingSource?.signature === signature) continue;
          if (existingSource) URL.revokeObjectURL(existingSource.url);
          localCaptureUrlsRef.current.set(capture.id, {
            url: URL.createObjectURL(capture.blob),
            signature,
          });
        }
        setLocalCaptureSources(new Map(captures.map((capture) => [
          capture.id,
          {
            url: localCaptureUrlsRef.current.get(capture.id)!.url,
            status: capture.archiveStatus,
            archiveId: capture.archiveId,
          },
        ])));
      } catch (error) {
        console.error('[MediaApp] Could not load local camera captures from IndexedDB.', error);
      }
    };
    const onLocalCapturesUpdated = () => void loadLocalCaptures();
    window.addEventListener('local-captures-updated', onLocalCapturesUpdated);
    void loadLocalCaptures();
    return () => {
      isCurrent = false;
      window.removeEventListener('local-captures-updated', onLocalCapturesUpdated);
      for (const source of localCaptureUrlsRef.current.values()) {
        URL.revokeObjectURL(source.url);
      }
      localCaptureUrlsRef.current.clear();
    };
  }, []);
  const [publishedDriveContent, setPublishedDriveContent] = useState<PublishedDriveContent | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refreshPublishedContent = async () => {
      try {
        const response = await fetch('/api/portfolio-content', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || payload?.success !== true || !payload.content) {
          throw new Error(payload?.error || `Published media could not be loaded (HTTP ${response.status}).`);
        }
        if (active) setPublishedDriveContent(payload.content);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        console.error('[Media] Could not load published media references.', error);
      }
    };
    const handlePublishedContent = (event: Event) => {
      const content = (event as CustomEvent<PublishedDriveContent>).detail;
      if (content && typeof content === 'object') {
        setPublishedDriveContent(content);
      } else {
        void refreshPublishedContent();
      }
    };
    void refreshPublishedContent();
    window.addEventListener('portfolio-content-published', handlePublishedContent);
    window.addEventListener('portfolio-data-updated', refreshPublishedContent);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('portfolio-content-published', handlePublishedContent);
      window.removeEventListener('portfolio-data-updated', refreshPublishedContent);
    };
  }, []);

  // Load user settings from localStorage
  const [appSettings, setAppSettings] = useState<MediaAppSettings>(() => {
    try {
      const saved = localStorage.getItem('win11_media_app_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const saveSetting = <K extends keyof MediaAppSettings>(key: K, value: MediaAppSettings[K]) => {
    setAppSettings((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem('win11_media_app_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const virtualDriveFiles = useMemo(
    () => buildVirtualDDriveFiles(files, publishedDriveContent, [], publicMedia),
    [files, publishedDriveContent]
  );

  // Show persisted D: media alongside published and bundled virtual-drive media.
  const mediaFiles = useMemo(() => {
    const availableFiles = virtualDriveFiles.filter((f) => {
      if (f.type === 'folder') return false;
      const ext = (f.extension || '').toLowerCase();
      const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'heic'].includes(ext);
      const isVid = ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi', 'wmv', 'flv', 'm4v'].includes(ext);
      const isAud = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
      const isMediaContent =
        f.content?.startsWith('data:image') ||
        f.content?.startsWith('data:video') ||
        f.content?.startsWith('data:audio') ||
        (f.content?.startsWith('http') &&
          (f.content.includes('unsplash') ||
            f.content.includes('images') ||
            f.content.includes('video') ||
            f.content.includes('mp3') ||
            f.content.includes('soundhelix') ||
            f.content.includes('freesound') ||
            f.content.includes('commondatastorage')));
      return isImg || isVid || isAud || isMediaContent;
    }).map((file) => {
      if (!file.localCaptureId) return file;
      const localCapture = localCaptureSources.get(file.localCaptureId);
      return {
        ...file,
        content: localCapture?.url || file.content,
        captureStatus: localCapture?.status || file.captureStatus || 'local-only',
        archiveId: localCapture?.archiveId || file.archiveId,
      };
    });
    const isSafeInitialUrl =
      typeof initialMediaUrl === 'string' &&
      (isPortfolioMediaUrl(initialMediaUrl) ||
        /^\/(?:downloads|wallpapers|videos|audio)\/[A-Za-z0-9_.-]+$/.test(initialMediaUrl) ||
        /^https?:\/\//i.test(initialMediaUrl));
    if (
      !isSafeInitialUrl ||
      !initialMediaId ||
      availableFiles.some((media) => media.id === initialMediaId)
    ) {
      return availableFiles;
    }

    const extension = (initialMediaExtension || initialMediaName?.split('.').pop() || '').toLowerCase();
    const validMediaExtension = [
      'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'heic',
      'mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi', 'wmv', 'flv', 'm4v',
      'mp3', 'wav', 'm4a', 'flac', 'aac',
    ].includes(extension);
    if (!validMediaExtension) return availableFiles;

    const name = initialMediaName || `Preview.${extension}`;
    const path = filePath || `D:/Virtual Media/${name}`;
    return [
      ...availableFiles,
      {
        id: initialMediaId,
        name,
        path,
        type: 'file' as const,
        extension,
        content: initialMediaUrl,
        parentId: path.slice(0, path.lastIndexOf('/')) || 'D:/Virtual Media',
        modified: 'Published',
        readOnly: true,
      },
    ];
  }, [virtualDriveFiles, localCaptureSources, filePath, initialMediaId, initialMediaUrl, initialMediaName, initialMediaExtension]);

  // Deleted media files in Recycle Bin (Media files only, excluding .txt, .md, folders, etc.)
  const deletedMediaFiles = useMemo(() => {
    return deletedFiles.filter((f) => {
      if (f.type === 'folder') return false;
      const ext = (f.extension || '').toLowerCase();
      const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'heic'].includes(ext);
      const isVid = ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi', 'wmv', 'flv', 'm4v'].includes(ext);
      const isMediaContent =
        f.content?.startsWith('data:image') ||
        f.content?.startsWith('data:video') ||
        (f.content?.startsWith('http') &&
          (f.content.includes('unsplash') ||
            f.content.includes('images') ||
            f.content.includes('video') ||
            f.content.includes('commondatastorage')));
      return isImg || isVid || isMediaContent;
    });
  }, [deletedFiles]);

  // Discover media folders available on the local file system
  const albumsOnThisPC = useMemo<LocalAlbum[]>(() => {
    const albumMap: Record<string, { title: string; path: string; files: FileItem[]; iconType?: string }> = {};
    const mediaFolders = [
      { path: D_DRIVE_FOLDER_PATHS.wallpapers, title: 'Wallpapers', iconType: 'image' },
      { path: D_DRIVE_FOLDER_PATHS.photoCaptures, title: 'Camera Pictures', iconType: 'camera' },
      { path: D_DRIVE_FOLDER_PATHS.videos, title: 'Videos', iconType: 'video' },
      { path: D_DRIVE_FOLDER_PATHS.videoCaptures, title: 'Camera Videos', iconType: 'camera' },
      { path: D_DRIVE_FOLDER_PATHS.audio, title: 'Audio', iconType: 'audio' },
    ];
    mediaFolders.forEach((folder) => {
      albumMap[folder.path] = { ...folder, files: [] };
    });

    // Group all media files by their actual directory parent path
    mediaFiles.forEach((file) => {
      let parentDir = (file.parentId || 'D:/Pictures/Wallpapers').replace(/\/$/, '');
      if (parentDir === 'C:' || parentDir === 'D:' || parentDir === 'This PC' || parentDir === '') {
        parentDir = 'D:/Pictures/Wallpapers';
      }
      if (!albumMap[parentDir]) {
        let folderName = parentDir.split('/').pop() || 'Pictures';
        if (folderName === 'C:' || folderName === 'D:' || folderName === 'This PC') {
          folderName = 'Pictures';
        }
        albumMap[parentDir] = {
          title: folderName,
          path: parentDir,
          files: [],
        };
      }
      albumMap[parentDir].files.push(file);
    });

    // Preserve the known media folders even when they are empty so each gets its own empty state.
    return Object.entries(albumMap)
      .filter(([dirPath]) => dirPath !== 'C:' && dirPath !== 'D:' && dirPath !== 'This PC')
      .map(([dirPath, data]) => {
        const lowerName = data.title.toLowerCase();
        let iconType = data.iconType || 'folder';
        if (lowerName.includes('camera')) iconType = 'camera';
        else if (lowerName.includes('snapchat')) iconType = 'snapchat';
        else if (lowerName.includes('screenshot')) iconType = 'screenshots';
        else if (lowerName.includes('time table') || lowerName.includes('timetable')) iconType = 'timetable';
        else if (lowerName.includes('whatsapp') && lowerName.includes('vid')) iconType = 'whatsapp-vid';
        else if (lowerName.includes('whatsapp')) iconType = 'whatsapp-img';
        else if (lowerName.includes('education') || lowerName.includes('arham')) iconType = 'education';
        else if (lowerName.includes('download')) iconType = 'download';
        else if (lowerName.includes('video')) iconType = 'video';
        else if (lowerName.includes('audio')) iconType = 'audio';
        else if (lowerName.includes('picture') || lowerName.includes('photo')) iconType = 'image';

        // Find latest modified date
        let newestDate = 'Today';
        if (data.files.length > 0) {
          const sorted = [...data.files].sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
          newestDate = sorted[0]?.modified || 'Today';
        }

        return {
          id: dirPath,
          title: data.title,
          path: dirPath,
          files: data.files,
          count: data.files.length,
          iconType,
          modified: newestDate,
        };
      });
  }, [mediaFiles]);

  // View state: 'albums' | 'album-view' | 'viewer' | 'settings' | 'recycle-bin'
  const [currentView, setCurrentView] = useState<'albums' | 'album-view' | 'viewer' | 'settings' | 'recycle-bin'>(
    filePath ? 'viewer' : 'album-view'
  );
  const [selectedNav, setSelectedNav] = useState<string>('all-media');
  const [selectedAlbumPath, setSelectedAlbumPath] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  // Keep navigation sidebar expanded by default
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAlbumsTreeOpen, setIsAlbumsTreeOpen] = useState(true);

  // Guarantee All Media by default on mount/open
  useEffect(() => {
    if (!filePath) {
      setCurrentView('album-view');
      setSelectedNav('all-media');
      setSelectedAlbumPath('');
    }
  }, [filePath]);

  // Touch sensitivity hook for mobile gestures & scrolling
  const touchSensitivity = useTouchSensitivity({ threshold: 10 });

  const navigateTo = (nav: string, view: 'albums' | 'album-view' | 'viewer' | 'settings' | 'recycle-bin', albumPath: string = '') => {
    setSelectedNav(nav);
    setSelectedAlbumPath(albumPath);
    setCurrentView(view);
    soundManager.play('click');
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setIsSidebarCollapsed(true);
    }
  };

  // Favorites state stored locally
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('win11_media_favorites');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const isNowFav = !next.has(id);
      if (isNowFav) {
        next.add(id);
      } else {
        next.delete(id);
      }
      try {
        localStorage.setItem('win11_media_favorites', JSON.stringify(Array.from(next)));
      } catch {}
      soundManager.play('click');
      return next;
    });
  }, []);

  // Selected media item for lightbox/viewer
  const [currentMediaId, setCurrentMediaId] = useState<string>(() => {
    if (filePath) {
      const match = mediaFiles.find((m) => m.path === filePath);
      if (match) return match.id;
    }
    if (initialMediaId) return initialMediaId;
    return mediaFiles[0]?.id || '';
  });
  const [viewerNavigationVisible, setViewerNavigationVisible] = useState(false);
  const viewerNavigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Share Dialog State
  const [shareTargetMedia, setShareTargetMedia] = useState<FileItem | null>(null);

  // Delete Confirmation State
  const [pendingDeleteMedia, setPendingDeleteMedia] = useState<FileItem | null>(null);
  const [showConfirmEmptyMediaRecycle, setShowConfirmEmptyMediaRecycle] = useState(false);
  const [pendingDeleteMediaRecycleIds, setPendingDeleteMediaRecycleIds] = useState<string[]>([]);

  // Multi-Selection State for Media Items
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [selectedRecycleIds, setSelectedRecycleIds] = useState<Set<string>>(new Set());
  const [mediaRecycleIconSize, setMediaRecycleIconSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Media Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target?: FileItem;
    isMulti?: boolean;
    items: FileItem[];
  } | null>(null);

  // Standalone Properties Modal
  const [propertiesTargetMedia, setPropertiesTargetMedia] = useState<FileItem | null>(null);

  // Active Filmstrip Thumbnail Ref
  const activeThumbnailRef = useRef<HTMLButtonElement | null>(null);

  // Clear selection when navigating views
  useEffect(() => {
    setSelectedMediaIds(new Set());
    setSelectedRecycleIds(new Set());
    setContextMenu(null);
  }, [selectedNav, selectedAlbumPath, currentView]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setShowViewerMoreMenu(false);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setPropertiesTargetMedia(null);
        setShowViewerMoreMenu(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const toggleSelectMedia = useCallback((mediaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
    soundManager.play('click');
  }, []);

  // When filePath prop updates externally
  useEffect(() => {
    if (filePath) {
      const match = mediaFiles.find((m) => m.path === filePath);
      if (match) {
        setCurrentMediaId(match.id);
        setCurrentView('viewer');
      }
    }
  }, [filePath, mediaFiles]);

  const activeMedia = useMemo(() => {
    return mediaFiles.find((m) => m.id === currentMediaId) || mediaFiles[0] || null;
  }, [mediaFiles, currentMediaId]);
  const activeMediaContentRef = useRef(activeMedia?.content);
  activeMediaContentRef.current = activeMedia?.content;

  const isVideo = useMemo(() => {
    if (!activeMedia) return false;
    const ext = (activeMedia.extension || '').toLowerCase();
    return ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi'].includes(ext) || activeMedia.content?.startsWith('data:video');
  }, [activeMedia]);

  const isAudio = useMemo(() => {
    if (!activeMedia) return false;
    const ext = (activeMedia.extension || '').toLowerCase();
    return ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || activeMedia.content?.startsWith('data:audio') || activeMedia.content?.includes('.mp3');
  }, [activeMedia]);

  const isPlayableMedia = isVideo || isAudio;

  const isGif = useMemo(() => {
    if (!activeMedia) return false;
    const ext = (activeMedia.extension || '').toLowerCase();
    return ext === 'gif' || activeMedia.name.toLowerCase().endsWith('.gif');
  }, [activeMedia]);

  // Viewer Transforms & Modes
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [showViewerMoreMenu, setShowViewerMoreMenu] = useState(false);

  // Pinch-to-zoom touch gesture refs and handlers
  const touchStartDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);

  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleStageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e);
      if (dist && dist > 10) {
        touchStartDistanceRef.current = dist;
        initialPinchZoomRef.current = zoom;
      }
    }
  };

  const handleStageTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const currentDist = getTouchDistance(e);
      if (currentDist && currentDist > 10) {
        if (!touchStartDistanceRef.current) {
          touchStartDistanceRef.current = currentDist;
          initialPinchZoomRef.current = zoom;
        } else {
          const scaleFactor = currentDist / touchStartDistanceRef.current;
          const newZoom = Math.min(8, Math.max(0.4, Number((initialPinchZoomRef.current * scaleFactor).toFixed(2))));
          setZoom(newZoom);
        }
      }
    }
  };

  const handleStageTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDistanceRef.current = null;
    }
  };

  // Video playback states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [videoControlsVisible, setVideoControlsVisible] = useState(false);
  const [pulseIndicator, setPulseIndicator] = useState<{ side: 'left' | 'right'; seconds: number; key: number } | null>(null);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerPulse = useCallback((side: 'left' | 'right', seconds: number = 10) => {
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    setPulseIndicator({ side, seconds, key: Date.now() });
    pulseTimeoutRef.current = setTimeout(() => {
      setPulseIndicator(null);
    }, 550);
  }, []);

  const triggerControlsVisible = useCallback(() => {
    setVideoControlsVisible(true);
    if (videoControlsTimeoutRef.current) clearTimeout(videoControlsTimeoutRef.current);
    if (isPlaying) {
      videoControlsTimeoutRef.current = setTimeout(() => {
        setVideoControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (videoControlsTimeoutRef.current) clearTimeout(videoControlsTimeoutRef.current);
      return;
    } else {
      if (videoControlsTimeoutRef.current) clearTimeout(videoControlsTimeoutRef.current);
      videoControlsTimeoutRef.current = setTimeout(() => {
        setVideoControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying]);

  const safePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromiseRef.current = playPromise;
      playPromise
        .then(() => {
          playPromiseRef.current = null;
          setIsPlaying(true);
        })
        .catch((err: any) => {
          playPromiseRef.current = null;
          if (err && err.name !== 'AbortError') {
            console.warn('Video playback error:', err);
          }
          setIsPlaying(false);
        });
    }
  }, []);

  const safePause = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (playPromiseRef.current) {
      playPromiseRef.current
        .then(() => {
          try {
            vid.pause();
          } catch {}
          setIsPlaying(false);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      try {
        vid.pause();
      } catch {}
      setIsPlaying(false);
    }
  }, []);

  // Reset transforms and handle video auto-play on media switch or viewer open
  useEffect(() => {
    let playTimeout: any;
    let isCancelled = false;

    if (currentView !== 'viewer') {
      safePause();
      return;
    }

    setZoom(1);
    setRotation(0);
    setIsFlipped(false);
    setCurrentTime(0);
    setVideoLoadError(false);
    setImageLoadError(false);

    if (isVideo) {
      if (appSettings.autoPlayVideos) {
        playTimeout = setTimeout(() => {
          if (isCancelled || !videoRef.current) return;
          const vid = videoRef.current;
          const playPromise = vid.play();
          if (playPromise !== undefined) {
            playPromiseRef.current = playPromise;
            playPromise
              .then(() => {
                playPromiseRef.current = null;
                if (!isCancelled) setIsPlaying(true);
              })
              .catch((err: any) => {
                playPromiseRef.current = null;
                if (err && err.name !== 'AbortError' && !isCancelled && videoRef.current) {
                  videoRef.current.muted = true;
                  setIsMuted(true);
                  const retry = videoRef.current.play();
                  if (retry !== undefined) {
                    playPromiseRef.current = retry;
                    retry
                      .then(() => {
                        playPromiseRef.current = null;
                        if (!isCancelled) setIsPlaying(true);
                      })
                      .catch(() => {
                        playPromiseRef.current = null;
                        if (!isCancelled) setIsPlaying(false);
                      });
                  }
                } else if (!isCancelled) {
                  setIsPlaying(false);
                }
              });
          }
        }, 120);
      } else {
        safePause();
      }
    } else {
      safePause();
    }

    return () => {
      isCancelled = true;
      if (playTimeout) clearTimeout(playTimeout);
      safePause();
    };
  }, [currentMediaId, isVideo, appSettings.autoPlayVideos, currentView, safePlay, safePause]);

  useEffect(() => {
    setImageLoadError(false);
  }, [activeMedia?.id, activeMedia?.content]);

  // Auto-scroll active thumbnail into view in viewer (center positioned)
  useEffect(() => {
    if (currentView === 'viewer' && activeThumbnailRef.current) {
      const timer = setTimeout(() => {
        activeThumbnailRef.current?.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentMediaId, currentView]);

  // Sort helper
  const sortMediaList = useCallback((list: FileItem[]) => {
    return [...list].sort((a, b) => {
      switch (appSettings.sortOrder) {
        case 'newest':
          return (b.modified || '').localeCompare(a.modified || '');
        case 'oldest':
          return (a.modified || '').localeCompare(b.modified || '');
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'size-desc': {
          const numA = parseFloat(a.size || '0');
          const numB = parseFloat(b.size || '0');
          return numB - numA;
        }
        default:
          return 0;
      }
    });
  }, [appSettings.sortOrder]);

  // Filtered media items for current view
  const currentViewMedia = useMemo(() => {
    let list: FileItem[] = [];

    if (selectedNav === 'all-media') {
      list = mediaFiles;
    } else if (selectedNav === 'photos') {
      list = mediaFiles.filter((m) => {
        const ext = (m.extension || '').toLowerCase();
        return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'heic'].includes(ext) || m.content?.startsWith('data:image');
      });
    } else if (selectedNav === 'videos') {
      list = mediaFiles.filter((m) => {
        const ext = (m.extension || '').toLowerCase();
        return ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi'].includes(ext) || m.content?.startsWith('data:video');
      });
    } else if (selectedNav === 'favorites') {
      list = mediaFiles.filter((m) => favorites.has(m.id));
    } else if (selectedAlbumPath) {
      const matchAlbum = albumsOnThisPC.find((a) => a.path === selectedAlbumPath);
      list = matchAlbum ? matchAlbum.files : [];
    } else {
      list = mediaFiles;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || (m.path && m.path.toLowerCase().includes(q)));
    }

    return sortMediaList(list);
  }, [selectedNav, selectedAlbumPath, albumsOnThisPC, mediaFiles, favorites, searchQuery, sortMediaList]);

  // Viewer active media list synchronized with current side panel tab / album filter
  const viewerMediaList = useMemo(() => {
    return currentViewMedia.length > 0 ? currentViewMedia : mediaFiles;
  }, [currentViewMedia, mediaFiles]);

  // Auto slideshow timer
  useEffect(() => {
    if (!isSlideshow || viewerMediaList.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentMediaId((prevId) => {
        const idx = viewerMediaList.findIndex((m) => m.id === prevId);
        const nextIdx = (idx + 1) % viewerMediaList.length;
        return viewerMediaList[nextIdx].id;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [isSlideshow, viewerMediaList]);

  // Active Album Metadata
  const currentActiveAlbum = useMemo(() => {
    if (selectedAlbumPath) {
      const alb = albumsOnThisPC.find((a) => a.path === selectedAlbumPath);
      if (alb) return alb;
    }
    return {
      id: 'all',
      title: selectedNav === 'photos' ? 'Photos' : selectedNav === 'videos' ? 'Videos' : selectedNav === 'favorites' ? 'Favorites' : 'All Media',
      path: 'D:/Pictures/Wallpapers',
      files: currentViewMedia,
      count: currentViewMedia.length,
      iconType: 'folder',
      modified: 'Today',
    };
  }, [selectedAlbumPath, albumsOnThisPC, selectedNav, currentViewMedia]);

  const emptyMediaState = useMemo(() => {
    if (selectedAlbumPath === D_DRIVE_FOLDER_PATHS.wallpapers) {
      return { title: 'No wallpapers in this folder', detail: 'Add images to D:/Pictures/Wallpapers or publish a wallpaper from Admin to see it here.', icon: ImageIcon };
    }
    if (selectedAlbumPath === D_DRIVE_FOLDER_PATHS.photoCaptures) {
      return { title: 'No camera photos in this folder', detail: 'Photos captured with the Camera app will appear in D:/Pictures/Camera.', icon: Camera };
    }
    if (selectedAlbumPath === D_DRIVE_FOLDER_PATHS.videos) {
      return { title: 'No videos in this folder', detail: 'Add or capture a video to D:/Videos to see it here.', icon: Film };
    }
    if (selectedAlbumPath === D_DRIVE_FOLDER_PATHS.videoCaptures) {
      return { title: 'No camera videos in this folder', detail: 'Videos recorded with the Camera app will appear in D:/Videos/Camera.', icon: Camera };
    }
    if (selectedAlbumPath === D_DRIVE_FOLDER_PATHS.audio) {
      return { title: 'No audio files in this folder', detail: 'Add supported music or audio files to D:/Audio to see them here.', icon: Music };
    }
    if (selectedNav === 'photos') {
      return { title: 'No photos on This PC', detail: 'Add images to D:/Pictures or capture a photo with the Camera app.', icon: ImageIcon };
    }
    if (selectedNav === 'videos') {
      return { title: 'No videos on This PC', detail: 'Add videos to D:/Videos or record one with the Camera app.', icon: Film };
    }
    if (selectedNav === 'favorites') {
      return { title: 'No favorite media yet', detail: 'Mark a photo, video, or audio file as a favorite to see it here.', icon: Heart };
    }
    return { title: 'No media files in this location', detail: 'Add or publish images, videos, or audio in the D: folders to see them here.', icon: ImageIcon };
  }, [selectedAlbumPath, selectedNav]);

  // Filtered albums search
  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albumsOnThisPC;
    const q = searchQuery.toLowerCase();
    return albumsOnThisPC.filter((a) => a.title.toLowerCase().includes(q) || a.path.toLowerCase().includes(q));
  }, [albumsOnThisPC, searchQuery]);

  // Multi-Selection and Clipboard Handlers
  const handleSelectAllMedia = useCallback(() => {
    if (selectedMediaIds.size === currentViewMedia.length && currentViewMedia.length > 0) {
      setSelectedMediaIds(new Set());
    } else {
      setSelectedMediaIds(new Set(currentViewMedia.map((m) => m.id)));
    }
    soundManager.play('click');
  }, [currentViewMedia, selectedMediaIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedMediaIds(new Set());
    soundManager.play('click');
  }, []);

  const handleCopySelected = useCallback(() => {
    const targetItems =
      selectedMediaIds.size > 0
        ? files.filter((f) => selectedMediaIds.has(f.id))
        : activeMedia
        ? [activeMedia]
        : [];
    if (targetItems.length === 0) return;
    copyFiles(targetItems);
    soundManager.play('click');
    addNotification({
      title: 'Copied to Clipboard',
      message: `Copied ${targetItems.length} media file(s). You can paste them in This PC or other folders.`,
      type: 'success',
      appId: 'photos',
    });
  }, [selectedMediaIds, files, activeMedia, copyFiles, addNotification]);

  const handleCutSelected = useCallback(() => {
    const targetItems =
      selectedMediaIds.size > 0
        ? files.filter((f) => selectedMediaIds.has(f.id))
        : activeMedia
        ? [activeMedia]
        : [];
    if (targetItems.length === 0) return;
    cutFiles(targetItems);
    soundManager.play('click');
    addNotification({
      title: 'Cut to Clipboard',
      message: `Cut ${targetItems.length} media file(s).`,
      type: 'info',
      appId: 'photos',
    });
  }, [selectedMediaIds, files, activeMedia, cutFiles, addNotification]);

  const handlePasteMedia = useCallback(() => {
    const dest = selectedAlbumPath || 'D:/Pictures/Wallpapers';
    pasteFile(dest);
    soundManager.play('click');
  }, [selectedAlbumPath, pasteFile]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedMediaIds.size === 0) return;
    deleteFiles(Array.from(selectedMediaIds));
    setSelectedMediaIds(new Set());
    soundManager.play('delete');
  }, [selectedMediaIds, deleteFiles]);

  // Navigation handlers synchronized with active tab/album media
  const handlePrev = useCallback(() => {
    if (viewerMediaList.length <= 1) return;
    const idx = viewerMediaList.findIndex((m) => m.id === currentMediaId);
    const prevIdx = (idx - 1 + viewerMediaList.length) % viewerMediaList.length;
    setCurrentMediaId(viewerMediaList[prevIdx].id);
    soundManager.play('click');
  }, [viewerMediaList, currentMediaId]);

  const showViewerNavigation = useCallback(() => {
    setViewerNavigationVisible(true);
    if (viewerNavigationTimeoutRef.current) clearTimeout(viewerNavigationTimeoutRef.current);
    viewerNavigationTimeoutRef.current = setTimeout(() => setViewerNavigationVisible(false), 2200);
  }, []);

  useEffect(() => () => {
    if (viewerNavigationTimeoutRef.current) clearTimeout(viewerNavigationTimeoutRef.current);
  }, []);

  const handleNext = useCallback(() => {
    if (viewerMediaList.length <= 1) return;
    const idx = viewerMediaList.findIndex((m) => m.id === currentMediaId);
    const nextIdx = (idx + 1) % viewerMediaList.length;
    setCurrentMediaId(viewerMediaList[nextIdx].id);
    soundManager.play('click');
  }, [viewerMediaList, currentMediaId]);

  // Video and Audio controls
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      safePause();
      setVideoControlsVisible(true);
    } else {
      safePlay();
      triggerControlsVisible();
    }
  }, [isPlaying, safePause, safePlay, triggerControlsVisible]);

  const handleSeekDelta = useCallback((deltaSeconds: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    const maxDur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : (duration || 0);
    const newTime = Math.max(0, Math.min(maxDur, (vid.currentTime || 0) + deltaSeconds));
    vid.currentTime = newTime;
    setCurrentTime(newTime);
    triggerControlsVisible();
    if (deltaSeconds < 0) triggerPulse('left', Math.abs(deltaSeconds));
    if (deltaSeconds > 0) triggerPulse('right', Math.abs(deltaSeconds));
    soundManager.play('click');
  }, [duration, triggerControlsVisible, triggerPulse]);

  const handleVideoContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;

    if (ratio < 0.3) {
      handleSeekDelta(-10);
    } else if (ratio > 0.7) {
      handleSeekDelta(10);
    } else {
      togglePlayPause();
    }
  }, [handleSeekDelta, togglePlayPause]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Keyboard Shortcuts for PhotosApp
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      // Viewer Keyboard Navigation & Controls
      if (currentView === 'viewer') {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          if (isVideo || isAudio) {
            togglePlayPause();
          } else {
            setIsSlideshow((s) => !s);
          }
          return;
        }

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (isVideo || isAudio) {
            handleSeekDelta(-10);
          } else {
            handlePrev();
          }
          return;
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (isVideo || isAudio) {
            handleSeekDelta(10);
          } else {
            handleNext();
          }
          return;
        }

        if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          if (isVideo || isAudio) handleSeekDelta(-10);
          return;
        }

        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          if (isVideo || isAudio) handleSeekDelta(10);
          return;
        }

        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          if (isVideo || isAudio) togglePlayPause();
          return;
        }

        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          if (isVideo || isAudio) toggleMute();
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          if (showInfo) {
            setShowInfo(false);
          } else if (showViewerMoreMenu) {
            setShowViewerMoreMenu(false);
          } else {
            setCurrentView(selectedNav === 'recycle-bin' ? 'recycle-bin' : 'album-view');
          }
          return;
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'a' && currentView === 'album-view') {
        e.preventDefault();
        handleSelectAllMedia();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopySelected();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCutSelected();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteMedia();
      } else if (e.key === 'Delete' && selectedMediaIds.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === 'Escape') {
        if (propertiesTargetMedia) {
          e.preventDefault();
          setPropertiesTargetMedia(null);
        } else if (selectedMediaIds.size > 0) {
          e.preventDefault();
          handleClearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentView,
    isVideo,
    isAudio,
    showInfo,
    showViewerMoreMenu,
    propertiesTargetMedia,
    selectedNav,
    togglePlayPause,
    handleSeekDelta,
    toggleMute,
    handlePrev,
    handleNext,
    handleSelectAllMedia,
    handleCopySelected,
    handleCutSelected,
    handlePasteMedia,
    handleDeleteSelected,
    handleClearSelection,
    selectedMediaIds.size,
  ]);

  // Media Context Menu Handlers (Disabled context menu on media elements per user request)
  const handleMediaContextMenu = (e: React.MouseEvent, _item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    // Intentionally suppressed to prevent context menus on images/videos
  };

  const handleBgContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Transform controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleFlip = () => setIsFlipped((f) => !f);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs < 0 || secs === Infinity) {
      return '0:00';
    }
    const total = Math.floor(secs);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Set as Wallpaper
  const handleSetAsWallpaper = (media: FileItem) => {
    if (!media || !media.content) return;
    updateSettings({
      wallpaper: 'custom',
      customWallpaperUrl: media.content,
    });
    soundManager.play('notification');
    addNotification({
      title: 'Desktop Wallpaper Updated',
      message: `Set "${media.name}" as your active Windows 11 wallpaper.`,
      type: 'success',
      appId: 'photos',
    });
  };

  // Set as Lock Screen Background
  const handleSetAsLockScreen = (media: FileItem) => {
    if (!media || !media.content) return;
    updateSettings({
      lockScreenWallpaper: 'custom',
      customLockScreenUrl: media.content,
    });
    soundManager.play('notification');
    addNotification({
      title: 'Lock Screen Background Updated',
      message: `Set "${media.name}" as your active Windows 11 lock screen background.`,
      type: 'success',
      appId: 'photos',
    });
  };

  // Copy to Clipboard (Image/Path)
  const handleCopyToClipboard = (media: FileItem) => {
    if (!media) return;
    addClipboardHistory({
      content: media.content || media.path,
      type: isVideo ? 'text' : 'image',
      label: media.name,
      pinned: false,
    });
    soundManager.play('click');
    addNotification({
      title: 'Copied to Clipboard',
      message: `Copied "${media.name}" to Windows Clipboard history.`,
      type: 'info',
      appId: 'photos',
    });
  };

  // Download / Save to Disk
  const handleDownloadMedia = (media: FileItem) => {
    if (!media || !media.content) return;
    const a = document.createElement('a');
    a.href = media.content;
    a.download = media.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    soundManager.play('click');
    addNotification({
      title: 'File Download Started',
      message: `Saving "${media.name}" to local disk.`,
      type: 'success',
      appId: 'photos',
    });
  };

  // Delete Media Action
  const requestDeleteMedia = (media: FileItem) => {
    if (!media) return;
    if (appSettings.confirmDelete) {
      setPendingDeleteMedia(media);
    } else {
      executeDeleteMedia(media);
    }
  };

  const executeDeleteMedia = (media: FileItem) => {
    deleteFile(media.id);
    setPendingDeleteMedia(null);
    if (currentMediaId === media.id) {
      const remaining = mediaFiles.filter((m) => m.id !== media.id);
      if (remaining.length > 0) {
        setCurrentMediaId(remaining[0].id);
      } else {
        setCurrentView('albums');
      }
    }
    soundManager.play('delete');
  };

  // Keyboard navigation inside viewer
  useEffect(() => {
    if (currentView !== 'viewer') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setCurrentView('albums');
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-' || e.key === '_') handleZoomOut();
      if (e.key === 'r' || e.key === 'R') handleRotate();
      if (e.key === ' ' && (isVideo || isAudio)) {
        e.preventDefault();
        togglePlayPause();
      }
      if (e.key === 'ArrowLeft' && (isVideo || isAudio) && e.shiftKey) {
        e.preventDefault();
        handleSeekDelta(-10);
      }
      if (e.key === 'ArrowRight' && (isVideo || isAudio) && e.shiftKey) {
        e.preventDefault();
        handleSeekDelta(10);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentView, handlePrev, handleNext, isVideo, isAudio, isPlaying, handleSeekDelta]);

  // Icon renderer based on folder archetype
  const renderAlbumIcon = (type: string, className = 'w-5 h-5') => {
    switch (type) {
      case 'camera':
        return <Camera className={className} />;
      case 'snapchat':
        return <Sparkles className={className} />;
      case 'screenshots':
        return <Monitor className={className} />;
      case 'timetable':
        return <Calendar className={className} />;
      case 'whatsapp-vid':
      case 'video':
        return <Film className={className} />;
      case 'whatsapp-img':
        return <ImageIcon className={className} />;
      case 'education':
        return <FileText className={className} />;
      case 'download':
        return <Download className={className} />;
      default:
        return <Folder className={className} />;
    }
  };

  const isDarkTheme = settings?.theme === 'dark';

  return (
    <div
      className={`h-full w-full flex select-none overflow-hidden font-sans relative ${
        isDarkTheme ? 'bg-[#18181a] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
      onClick={() => {
        if (contextMenu) setContextMenu(null);
      }}
    >
      {/* Mobile Drawer Backdrop with Blur */}
      {!isSidebarCollapsed && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-md z-30 sm:hidden animate-in fade-in transition-all duration-200 cursor-pointer"
          onClick={() => setIsSidebarCollapsed(true)}
          title="Tap to close navigation"
        />
      )}

      {/* ================= 1. SIDEBAR NAVIGATION ================= */}
      <div
        className={`${
          isSidebarCollapsed ? 'hidden sm:flex sm:w-14' : 'absolute sm:relative inset-y-0 left-0 z-40 w-60 shadow-2xl sm:shadow-none'
        } shrink-0 border-r flex flex-col justify-between transition-all duration-200 select-none ${
          isDarkTheme ? 'bg-[#1b1b1e] border-white/10' : 'bg-[#f8f9fa] border-slate-200'
        }`}
      >
        {/* Top Header / App Brand inside Side Panel */}
        <div
          className={`h-12 px-3 flex items-center justify-between border-b shrink-0 transition-colors ${
            isDarkTheme ? 'border-white/10 text-white' : 'border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                isDarkTheme ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-200/70 text-slate-600'
              }`}
              title={isSidebarCollapsed ? 'Expand Navigation Pane' : 'Collapse Navigation Pane'}
            >
              <Menu className="w-4 h-4" />
            </button>
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2 animate-in fade-in duration-150 truncate">
                <div className="p-1 rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sm tracking-wide">Media</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 text-xs">
          {/* All Media */}
            <button
              onClick={() => navigateTo('all-media', 'album-view', '')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                selectedNav === 'all-media' && currentView === 'album-view'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : isDarkTheme
                  ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
              title="All Media on This PC"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">All Media</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[11px] opacity-70 font-mono">{mediaFiles.length}</span>
              )}
            </button>

            {/* Photos Only */}
            <button
              onClick={() => navigateTo('photos', 'album-view', '')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                selectedNav === 'photos' && currentView === 'album-view'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : isDarkTheme
                  ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
              title="Photos Only"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Photos</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[11px] opacity-70 font-mono">
                  {mediaFiles.filter((m) => !['mp4', 'webm', 'mov'].includes((m.extension || '').toLowerCase())).length}
                </span>
              )}
            </button>

            {/* Videos Only */}
            <button
              onClick={() => navigateTo('videos', 'album-view', '')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                selectedNav === 'videos' && currentView === 'album-view'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : isDarkTheme
                  ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
              title="Videos Only"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Film className="w-4 h-4 text-purple-400 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Videos</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[11px] opacity-70 font-mono">
                  {mediaFiles.filter((m) => ['mp4', 'webm', 'mov'].includes((m.extension || '').toLowerCase())).length}
                </span>
              )}
            </button>

            {/* Favorites */}
            <button
              onClick={() => navigateTo('favorites', 'album-view', '')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                selectedNav === 'favorites' && currentView === 'album-view'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : isDarkTheme
                  ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
              title="Favorites"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Heart className="w-4 h-4 text-red-400 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Favorites</span>}
              </div>
              {!isSidebarCollapsed && favorites.size > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500/20 text-red-400 font-bold">
                  {favorites.size}
                </span>
              )}
            </button>

            {/* Media Recycle Bin (Side panel entry showing ONLY deleted media files) */}
            <button
              onClick={() => navigateTo('recycle-bin', 'recycle-bin', '')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                selectedNav === 'recycle-bin' && currentView === 'recycle-bin'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : isDarkTheme
                  ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
              title="Media Recycle Bin (Only Photos & Videos)"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Recycle Bin</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[11px] opacity-70 font-mono">{deletedMediaFiles.length}</span>
              )}
            </button>

            {/* Albums (Collapsible tree containing folders) */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setIsAlbumsTreeOpen(!isAlbumsTreeOpen);
                  navigateTo('albums', 'albums', '');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                  selectedNav === 'albums' && currentView === 'albums'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : isDarkTheme
                    ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
                title="Albums"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">Albums</span>}
                </div>
                {!isSidebarCollapsed && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 opacity-60 transition-transform ${
                      isAlbumsTreeOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                )}
              </button>

              {/* Dynamic Local Folders List */}
              {isAlbumsTreeOpen && !isSidebarCollapsed && (
                <div className="pl-6 pr-1 pt-1 space-y-0.5">
                  {albumsOnThisPC.map((alb) => {
                    const isSelected = selectedAlbumPath === alb.path && currentView === 'album-view';
                    return (
                      <button
                        key={alb.id}
                        onClick={() => navigateTo(`album-${alb.id}`, 'album-view', alb.path)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                            : isDarkTheme
                            ? 'text-slate-400 hover:text-white hover:bg-white/5'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                      >
                        <span className="truncate">{alb.title}</span>
                        <span className="text-[10px] opacity-60 font-mono ml-1 shrink-0">{alb.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Settings Button */}
          <div className={`p-2 border-t ${isDarkTheme ? 'border-white/5' : 'border-slate-200'}`}>
            <button
              onClick={() => navigateTo('settings', 'settings', '')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs cursor-pointer ${
                currentView === 'settings'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : isDarkTheme
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
              title="Media App Settings"
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Settings</span>}
            </button>
          </div>
        </div>

        {/* ================= 2. MAIN CONTENT AREA ================= */}
        <div
          className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-200 ${
            !isSidebarCollapsed ? 'filter blur-[3px] sm:blur-none pointer-events-none sm:pointer-events-auto' : ''
          } ${isDarkTheme ? 'bg-[#141416]' : 'bg-slate-100'}`}
        >
          {/* VIEW 1: ALBUMS DASHBOARD (ONLY THIS PC ALBUMS) */}
          {currentView === 'albums' && (
            <div {...touchSensitivity.touchProps} className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 sm:p-8 space-y-4 sm:space-y-6">
              {/* Top Controls: Search Bar & Refresh */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 max-w-md w-full">
                  <button
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="sm:hidden p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer"
                    title="Open Navigation Pane"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search albums on This PC..."
                      className={`w-full pl-10 pr-9 py-2 rounded-xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        isDarkTheme
                          ? 'bg-[#222225] border-white/10 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-500'
                      }`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="p-1 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Page Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                    Albums on This PC
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    All local folders containing photos, videos, and media items
                  </p>
                </div>
                <span
                  className={`text-xs font-mono px-2.5 py-1 rounded-lg border shrink-0 ${
                    isDarkTheme ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {albumsOnThisPC.length} Albums
                </span>
              </div>

              {/* Albums Grid (Dynamic local folders with real image collage thumbnails) */}
              {mediaFiles.length === 0 || filteredAlbums.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-slate-400">
                  <ImageIcon className="mb-3 h-12 w-12 text-slate-500" />
                  <p className="text-sm font-semibold">
                    {mediaFiles.length === 0 ? 'No media albums on This PC' : 'No albums match your search'}
                  </p>
                  <p className="mt-1 max-w-md text-xs text-slate-500">
                    {mediaFiles.length === 0
                      ? 'Add media to a D: folder, capture a photo or video, or publish a wallpaper to see albums here.'
                      : 'Try a different folder name or clear the search to see albums.'}
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredAlbums.map((album) => {
                  const items = album.files;
                  const count = items.length;
                  const firstFour = items.slice(0, 4);

                  return (
                    <motion.div
                      key={album.id}
                      whileHover={{ scale: 1.025, y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      onClick={() => {
                        if (!touchSensitivity.shouldAllowClick()) return;
                        setSelectedAlbumPath(album.path);
                        setSelectedNav(`album-${album.id}`);
                        setCurrentView('album-view');
                        soundManager.play('click');
                      }}
                      className={`group relative flex flex-col justify-between h-52 rounded-2xl border transition-colors duration-200 cursor-pointer overflow-hidden p-3.5 select-none shadow-sm hover:shadow-xl ${
                        isDarkTheme
                          ? 'bg-[#222226] hover:bg-[#2a2a2e] border-white/5 hover:border-blue-500/50'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-400'
                      }`}
                    >
                      {/* Top Thumbnail Canvas (Real preview from inside this album) */}
                      <div className="w-full h-32 rounded-xl overflow-hidden relative bg-black/40 border border-black/10 flex items-center justify-center">
                        {firstFour.length === 0 ? (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            {renderAlbumIcon(album.iconType, 'w-8 h-8 opacity-50 mb-1')}
                            <span className="text-[10px]">Empty Album</span>
                          </div>
                        ) : firstFour.length === 1 ? (
                          // Single Large Thumbnail
                          <img
                            src={
                              getMediaPreviewUrl(firstFour[0]) ||
                              firstFour[0].content ||
                              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'
                            }
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          // Multi-Item Dynamic Thumbnail Grid
                          <div className="w-full h-full grid grid-cols-2 gap-0.5 bg-black/20">
                            {firstFour.map((item, idx) => (
                              <div key={item.id || idx} className="w-full h-full overflow-hidden bg-slate-900 relative">
                                <img
                                  src={
                                    getMediaPreviewUrl(item) ||
                                    item.content ||
                                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'
                                  }
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Top corner icon badge */}
                        <div className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-xs">
                          {renderAlbumIcon(album.iconType, 'w-3.5 h-3.5')}
                        </div>
                      </div>

                      {/* Bottom Metadata */}
                      <div className="pt-2 flex items-center justify-between min-w-0">
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`font-bold text-xs truncate ${
                              isDarkTheme ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'
                            }`}
                          >
                            {album.title}
                          </h3>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">{count} items</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* VIEW 2: ALBUM & MEDIA GRID VIEW */}
          {currentView === 'album-view' && (
            <div
              {...touchSensitivity.touchProps}
              className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-4 sm:space-y-6"
              onContextMenu={handleBgContextMenu}
            >
              {/* Top Navigation & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="sm:hidden p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer"
                    title="Open Navigation Pane"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentView('albums')}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isDarkTheme
                        ? 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                    }`}
                    title="Back to Albums"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h1 className={`text-lg sm:text-xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                      {currentActiveAlbum.title}
                    </h1>
                    <span className="text-xs text-slate-400">
                      {currentViewMedia.length} media files {selectedMediaIds.size > 0 ? `• ${selectedMediaIds.size} selected` : 'on This PC'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {/* Multi-Selection & Clipboard Command Bar */}
                  {selectedMediaIds.size > 0 ? (
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-blue-600/10 border border-blue-500/30">
                      <button
                        onClick={handleSelectAllMedia}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-xs font-semibold shadow-xs cursor-pointer border border-blue-400/40"
                        title={selectedMediaIds.size === currentViewMedia.length ? 'Deselect All' : 'Select All'}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{selectedMediaIds.size === currentViewMedia.length ? 'Deselect All' : 'Select All'}</span>
                      </button>
                      <button
                        onClick={handleCopySelected}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                        title="Copy selected items (Ctrl+C)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy ({selectedMediaIds.size})</span>
                      </button>
                      <button
                        onClick={handleCutSelected}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          isDarkTheme ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-white hover:bg-slate-100 text-slate-800'
                        }`}
                        title="Cut selected items (Ctrl+X)"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Cut</span>
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                        title="Delete selected items (Del)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                      <button
                        onClick={handleClearSelection}
                        className={`px-2 py-1 rounded-lg text-xs cursor-pointer ${
                          isDarkTheme ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Clear selection (Esc)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {clipboard && clipboard.files && clipboard.files.length > 0 && (
                        <button
                          onClick={handlePasteMedia}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                          title="Paste items here (Ctrl+V)"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                          <span>Paste ({clipboard.files.length})</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Grid Size Selector */}
                  <div
                    className={`flex items-center p-0.5 rounded-xl border ${
                      isDarkTheme ? 'bg-black/30 border-white/10 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => saveSetting('gridTileSize', size)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium capitalize cursor-pointer transition-all ${
                          appSettings.gridTileSize === size
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'hover:opacity-100 opacity-60'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  {/* Open Folder in File Explorer */}
                  {selectedAlbumPath && (
                    <button
                      onClick={() => openApp('explorer', { initialPath: selectedAlbumPath })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isDarkTheme
                          ? 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
                      }`}
                      title="Open This PC Folder in File Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                      <span>Open in Explorer</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Media Items Grid with Full Thumbnails Everywhere */}
              {currentViewMedia.length > 0 ? (
                <div
                  className={`grid gap-3.5 ${
                    appSettings.gridTileSize === 'small'
                      ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
                      : appSettings.gridTileSize === 'large'
                      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                  }`}
                >
                  {currentViewMedia.map((media) => {
                    const ext = (media.extension || '').toLowerCase();
                    const isItemVid =
                      ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi'].includes(ext) || media.content?.startsWith('data:video');
                    const isItemGif = ext === 'gif' || media.name.toLowerCase().endsWith('.gif');
                    const isFav = favorites.has(media.id);
                    const isSelected = selectedMediaIds.has(media.id);

                    return (
                      <motion.div
                        key={media.id}
                        whileHover={{ scale: 1.035, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!touchSensitivity.shouldAllowClick()) return;
                          if (e.ctrlKey || e.metaKey) {
                            toggleSelectMedia(media.id, e);
                          } else if (selectedMediaIds.size > 0) {
                            toggleSelectMedia(media.id, e);
                          } else {
                            setCurrentMediaId(media.id);
                            setCurrentView('viewer');
                            soundManager.play('click');
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setCurrentMediaId(media.id);
                          setCurrentView('viewer');
                          soundManager.play('click');
                        }}
                        onContextMenu={(e) => handleMediaContextMenu(e, media)}
                        className={`media-card-item group relative aspect-square rounded-2xl border overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-colors ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[0.98]'
                            : isDarkTheme
                            ? 'bg-[#222226] border-white/5 hover:border-blue-500'
                            : 'bg-white border-slate-200 hover:border-blue-500'
                        }`}
                      >
                        {/* Selection Checkbox */}
                        <button
                          onClick={(e) => toggleSelectMedia(media.id, e)}
                          className={`absolute top-2 left-2 z-20 p-1 rounded-lg backdrop-blur-md transition-all cursor-pointer shadow-xs ${
                            isSelected
                              ? 'bg-blue-600 text-white opacity-100 ring-2 ring-white/50'
                              : 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-blue-600'
                          }`}
                          title={isSelected ? 'Deselect item' : 'Select item'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-white/80" />
                          )}
                        </button>

                        {/* Video / Image Thumbnail */}
                        {isItemVid ? (
                          <div className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden">
                            <RenderMediaCover
                              media={media}
                              isVid={true}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* Video Play Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors pointer-events-none">
                              <div className="p-2.5 rounded-full bg-blue-600 text-white shadow-xl group-hover:scale-110 transition-transform">
                                <Play className="w-4 h-4 fill-white" />
                              </div>
                            </div>
                            {/* Video Pill */}
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-bold text-white uppercase border border-white/10">
                              {media.extension || 'MP4'}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full relative overflow-hidden bg-slate-950">
                            <RenderMediaCover
                              media={media}
                              isVid={false}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {isItemGif && (
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-purple-600/90 backdrop-blur-md text-[9px] font-extrabold text-white uppercase border border-white/10">
                                GIF
                              </div>
                            )}
                          </div>
                        )}

                        {/* Top Action Icons (Favorite & Quick Share) */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareTargetMedia(media);
                            }}
                            className="p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-blue-600 backdrop-blur-md transition-all cursor-pointer shadow-xs"
                            title="Share"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(media.id);
                            }}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-xs ${
                              isFav
                                ? 'bg-red-500 text-white opacity-100'
                                : 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500'
                            }`}
                            title={isFav ? 'Remove Favorite' : 'Add to Favorites'}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}`} />
                          </button>
                        </div>

                        {/* Bottom Name Badge */}
                        <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[11px] font-semibold text-white truncate">{media.name}</p>
                          <p className="text-[9px] text-slate-300 mt-0.5">{media.size || '1.2 MB'}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                  <emptyMediaState.icon className="mb-3 h-12 w-12 text-slate-500" />
                  <p className="text-sm font-semibold">{emptyMediaState.title}</p>
                  <p className="mt-1 max-w-md text-xs text-slate-500">{emptyMediaState.detail}</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: FULL LIGHTBOX & MEDIA VIEWER */}
          {currentView === 'viewer' && activeMedia && (
            <div className={`flex flex-col h-full w-full ${isDarkTheme ? 'bg-black' : 'bg-slate-100'} select-none overflow-hidden relative`}>
              {/* Top Viewer Toolbar */}
              <div className={`flex items-center justify-between px-2 sm:px-4 py-2 ${isDarkTheme ? 'bg-[#1c1c1e]/95 border-white/10 text-white' : 'bg-white/95 border-slate-200 text-slate-800'} backdrop-blur-md border-b shrink-0 z-30 gap-1.5 sm:gap-2`}>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
                  <button
                    onClick={() => {
                      if (selectedNav === 'recycle-bin') {
                        setCurrentView('recycle-bin');
                      } else {
                        setCurrentView('album-view');
                      }
                      soundManager.play('click');
                    }}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg ${isDarkTheme ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'} text-xs font-semibold transition-colors cursor-pointer shrink-0`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                  <span className={`text-xs font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'} truncate max-w-[90px] xs:max-w-[140px] sm:max-w-xs`}>
                    {activeMedia.name}
                  </span>
                </div>

                {/* Toolbar Tools */}
                <div className={`flex items-center gap-1 ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'} shrink-0 justify-end`}>
                  {!isVideo && (
                    <>
                      <button
                        onClick={handleZoomIn}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                        }`}
                        title="Zoom In (+)"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleZoomOut}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                        }`}
                        title="Zoom Out (-)"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleRotate}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                        }`}
                        title="Rotate 90° Clockwise"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleFlip}
                        className={`hidden md:flex p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                        }`}
                        title="Flip Horizontal"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>
                      <div className={`hidden md:block h-4 w-px mx-0.5 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-300'}`} />
                    </>
                  )}

                  {/* Favorite */}
                  <button
                    onClick={() => toggleFavorite(activeMedia.id)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      favorites.has(activeMedia.id)
                        ? 'text-red-400 hover:bg-red-500/20'
                        : isDarkTheme
                        ? 'hover:text-white hover:bg-white/10 text-slate-300'
                        : 'hover:text-slate-950 hover:bg-slate-200 text-slate-700'
                    }`}
                    title="Favorite"
                  >
                    <Heart className={`w-4 h-4 ${favorites.has(activeMedia.id) ? 'fill-red-400' : ''}`} />
                  </button>

                  {/* Desktop Only Actions */}
                  <div className="hidden md:flex items-center gap-1">
                    {/* Slideshow */}
                    {!isVideo && (
                      <button
                        onClick={() => setIsSlideshow(!isSlideshow)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isSlideshow
                            ? 'bg-blue-600 text-white font-bold'
                            : isDarkTheme
                            ? 'hover:text-white hover:bg-white/10 text-slate-300'
                            : 'hover:text-slate-950 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={isSlideshow ? 'Pause Slideshow' : 'Start Slideshow'}
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}

                    {/* Set as Desktop Wallpaper */}
                    <button
                      onClick={() => handleSetAsWallpaper(activeMedia)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                      }`}
                      title="Set as Desktop Wallpaper"
                    >
                      <Monitor className="w-4 h-4" />
                    </button>

                    {/* Set as Lock Screen Background */}
                    <button
                      onClick={() => handleSetAsLockScreen(activeMedia)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                      }`}
                      title="Set as Lock Screen Background"
                    >
                      <Lock className="w-4 h-4" />
                    </button>

                    {/* Copy to Clipboard */}
                    <button
                      onClick={() => handleCopyToClipboard(activeMedia)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                      }`}
                      title="Copy File to Clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Download */}
                    <button
                      onClick={() => handleDownloadMedia(activeMedia)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                      }`}
                      title="Download to Local Disk"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Windows 11 / This PC Sharing Flyout */}
                    <button
                      onClick={() => setShareTargetMedia(activeMedia)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        isDarkTheme ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-slate-200 hover:text-slate-950 text-slate-700'
                      }`}
                      title="Share File"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => requestDeleteMedia(activeMedia)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-500 cursor-pointer transition-colors"
                      title="Delete Media"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Info Panel Toggle */}
                    <button
                      onClick={() => setShowInfo(!showInfo)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        showInfo
                          ? isDarkTheme
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-300 text-slate-950 font-bold'
                          : isDarkTheme
                          ? 'hover:text-white hover:bg-white/10 text-slate-300'
                          : 'hover:text-slate-950 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="File Properties & Info"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mobile More Actions Dropdown Menu */}
                  <div className="relative md:hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowViewerMoreMenu(!showViewerMoreMenu);
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        showViewerMoreMenu
                          ? isDarkTheme
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-300 text-slate-950'
                          : isDarkTheme
                          ? 'hover:bg-white/10 text-slate-300 hover:text-white'
                          : 'hover:bg-slate-200 text-slate-700 hover:text-slate-950'
                      }`}
                      title="More Options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {showViewerMoreMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-0 top-full mt-2 w-56 backdrop-blur-xl border rounded-xl shadow-2xl p-1.5 z-50 text-xs flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 ${
                          isDarkTheme
                            ? 'bg-[#252528]/95 border-white/15 text-slate-200'
                            : 'bg-white/95 border-slate-200 text-slate-800 shadow-xl'
                        }`}
                      >
                        {!isVideo && (
                          <>
                            <button
                              onClick={() => {
                                handleFlip();
                                setShowViewerMoreMenu(false);
                              }}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                                isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <FlipHorizontal className="w-4 h-4 text-cyan-400" />
                              <span>Flip Horizontal</span>
                            </button>
                            <button
                              onClick={() => {
                                setIsSlideshow(!isSlideshow);
                                setShowViewerMoreMenu(false);
                              }}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                                isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <Play className="w-4 h-4 text-emerald-400" />
                              <span>{isSlideshow ? 'Pause Slideshow' : 'Start Slideshow'}</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            handleSetAsWallpaper(activeMedia);
                            setShowViewerMoreMenu(false);
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Monitor className="w-4 h-4 text-blue-400" />
                          <span>Set as Wallpaper</span>
                        </button>
                        <button
                          onClick={() => {
                            handleSetAsLockScreen(activeMedia);
                            setShowViewerMoreMenu(false);
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Lock className="w-4 h-4 text-indigo-400" />
                          <span>Set as Lock Screen</span>
                        </button>
                        <button
                          onClick={() => {
                            handleCopyToClipboard(activeMedia);
                            setShowViewerMoreMenu(false);
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Copy to Clipboard</span>
                        </button>
                        <button
                          onClick={() => {
                            handleDownloadMedia(activeMedia);
                            setShowViewerMoreMenu(false);
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>Download Media</span>
                        </button>
                        <button
                          onClick={() => {
                            setShareTargetMedia(activeMedia);
                            setShowViewerMoreMenu(false);
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Share2 className="w-4 h-4 text-amber-400" />
                          <span>Share File...</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowInfo(!showInfo);
                            setShowViewerMoreMenu(false);
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isDarkTheme ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Info className="w-4 h-4 text-cyan-400" />
                          <span>File Properties & Info</span>
                        </button>
                        <div className={`h-px my-1 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-200'}`} />
                        <button
                          onClick={() => {
                            requestDeleteMedia(activeMedia);
                            setShowViewerMoreMenu(false);
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/20 text-red-400 text-left transition-colors cursor-pointer font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Media</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage Canvas */}
              <div
                className="media-viewer-stage group flex-1 flex items-center justify-center relative overflow-hidden bg-black/90 touch-none select-none"
                onMouseMove={showViewerNavigation}
                onTouchStart={(event) => {
                  showViewerNavigation();
                  handleStageTouchStart(event);
                }}
                onTouchMove={handleStageTouchMove}
                onTouchEnd={handleStageTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {/* Previous Button */}
                {mediaFiles.length > 1 && (
                  <button
                    onClick={() => {
                      showViewerNavigation();
                      handlePrev();
                    }}
                    className={`media-viewer-navigation absolute left-2 sm:left-4 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md z-20 transition-all cursor-pointer shadow-lg ${
                      viewerNavigationVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    title="Previous (Left Arrow)"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                {/* Next Button */}
                {mediaFiles.length > 1 && (
                  <button
                    onClick={() => {
                      showViewerNavigation();
                      handleNext();
                    }}
                    className={`media-viewer-navigation absolute right-2 sm:right-4 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md z-20 transition-all cursor-pointer shadow-lg ${
                      viewerNavigationVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    title="Next (Right Arrow)"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}

                {/* Video, Audio or Image Node */}
                {isAudio ? (
                  <div
                    className="relative w-full h-full flex flex-col items-center justify-center p-6"
                    onMouseMove={triggerControlsVisible}
                    onTouchStart={triggerControlsVisible}
                    onClick={triggerControlsVisible}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <audio
                      ref={videoRef}
                      key={activeMedia.content}
                      src={activeMedia.content}
                      loop={appSettings.loopVideos}
                      autoPlay={appSettings.autoPlayVideos}
                      onError={() => {
                        setVideoLoadError(true);
                        setIsPlaying(false);
                      }}
                      onTimeUpdate={() => {
                        if (videoRef.current) {
                          const cur = videoRef.current.currentTime;
                          setCurrentTime(cur);
                          if (!Number.isFinite(duration) || duration === 0 || cur > duration) {
                            if (Number.isFinite(videoRef.current.duration) && videoRef.current.duration !== Infinity) {
                              setDuration(videoRef.current.duration);
                            } else {
                              setDuration(Math.max(duration || 0, Math.ceil(cur)));
                            }
                          }
                        }
                      }}
                      onLoadedMetadata={(e) => {
                        const aud = e.currentTarget;
                        if (aud && Number.isFinite(aud.duration) && aud.duration > 0) {
                          setDuration(aud.duration);
                        }
                      }}
                      onEnded={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />

                    {/* Vinyl / Album Art Display with Center Play/Pause and ±10s Controls */}
                    <div className="relative flex flex-col items-center justify-center space-y-6 max-w-sm text-center my-auto">
                      <div className="relative w-52 h-52 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 group">
                        <img
                          src={
                            activeMedia.poster ||
                            getMediaPreviewUrl(activeMedia) ||
                            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80'
                          }
                          alt={activeMedia.name}
                          className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                          referrerPolicy="no-referrer"
                        />
                        {/* Center Play/Pause & ±10s Overlay */}
                        <div
                          className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-3 select-none transition-all duration-300 ${
                            videoControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlayPause();
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeekDelta(-10);
                            }}
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/60 hover:bg-black/85 text-white flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-lg border border-white/20"
                            title="Rewind 10 seconds (-10s)"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span className="text-[8px] font-bold tracking-tighter leading-none">-10s</span>
                          </button>

                          <div
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-105 cursor-pointer ${isPlaying ? 'animate-pulse' : ''}`}
                            title={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? (
                              <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
                            ) : (
                              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeekDelta(10);
                            }}
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/60 hover:bg-black/85 text-white flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-lg border border-white/20"
                            title="Forward 10 seconds (+10s)"
                          >
                            <RotateCw className="w-4 h-4" />
                            <span className="text-[8px] font-bold tracking-tighter leading-none">+10s</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 z-10 px-4">
                        <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-xs sm:max-w-md mx-auto">{activeMedia.name}</h3>
                        <p className="text-xs text-rose-400 font-semibold tracking-wide uppercase">
                          Audio Track • {activeMedia.extension?.toUpperCase() || 'MP3'}
                        </p>
                        {videoLoadError && (
                          <p role="alert" className="text-xs font-medium text-amber-300">
                            This browser could not decode this audio file ({activeMedia.extension?.toUpperCase() || 'unknown format'}).
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Floating Audio Controls */}
                    <div
                      className={`absolute bottom-4 inset-x-2 sm:inset-x-4 w-auto max-w-xl mx-auto min-w-0 p-2 sm:p-3 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 flex items-center gap-1 sm:gap-2.5 text-white z-30 shadow-2xl overflow-hidden transition-all duration-300 ${
                        videoControlsVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
                      }`}
                      onClick={(event) => event.stopPropagation()}
                      onMouseEnter={triggerControlsVisible}
                    >
                      <button
                        onClick={() => handleSeekDelta(-10)}
                        className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer transition-colors flex items-center gap-0.5 text-xs text-slate-200"
                        title="Rewind 10 seconds (-10s)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold leading-none">-10s</span>
                      </button>

                      <button
                        onClick={togglePlayPause}
                        className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer transition-colors"
                        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>

                      <button
                        onClick={() => handleSeekDelta(10)}
                        className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer transition-colors flex items-center gap-0.5 text-xs text-slate-200"
                        title="Forward 10 seconds (+10s)"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold leading-none">+10s</span>
                      </button>

                      <span className="text-[10px] font-mono text-slate-300 shrink-0">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.1}
                        value={currentTime}
                        onChange={handleSeek}
                        className="min-w-0 flex-1 h-1.5 rounded-lg bg-white/20 accent-rose-500 cursor-pointer"
                        title="Seek"
                      />
                      <button
                        onClick={toggleMute}
                        className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer transition-colors"
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-8 sm:w-16 max-w-full h-1.5 shrink-0 rounded-lg bg-white/20 accent-rose-500 cursor-pointer"
                      />
                    </div>
                  </div>
                ) : isVideo ? (
                  <div
                    className="relative w-full h-full flex items-center justify-center"
                    onMouseMove={triggerControlsVisible}
                    onMouseEnter={triggerControlsVisible}
                    onTouchStart={triggerControlsVisible}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {videoLoadError || !activeMedia.content ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl space-y-3 z-20">
                        <div className="p-4 rounded-full bg-amber-500/20 text-amber-400">
                          <Film className="w-10 h-10" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{activeMedia.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">
                            This browser could not play this {activeMedia.extension?.toUpperCase() || 'video'} file. Its format or video codec may not be supported by this browser.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => handleDownloadMedia(activeMedia)}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Video</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                      <div
                        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-pointer select-none"
                        onClick={handleVideoContainerClick}
                        onMouseMove={triggerControlsVisible}
                      >
                        <video
                          ref={videoRef}
                          key={activeMedia.content}
                          src={activeMedia.content}
                          loop={appSettings.loopVideos}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onError={(e) => {
                            e.stopPropagation();
                            setVideoLoadError(true);
                            setIsPlaying(false);
                          }}
                          onTimeUpdate={() => {
                            if (videoRef.current) {
                              const cur = videoRef.current.currentTime;
                              setCurrentTime(cur);
                              if (!Number.isFinite(duration) || duration === 0 || cur > duration) {
                                if (Number.isFinite(videoRef.current.duration) && videoRef.current.duration !== Infinity) {
                                  setDuration(videoRef.current.duration);
                                } else {
                                  setDuration(Math.max(duration || 0, Math.ceil(cur)));
                                }
                              }
                            }
                          }}
                          onLoadedMetadata={(e) => {
                            const vid = e.currentTarget;
                            if (vid) {
                              const dur = vid.duration;
                              if (!Number.isFinite(dur) || isNaN(dur) || dur === Infinity) {
                                const onDurationChange = () => {
                                  if (Number.isFinite(vid.duration) && vid.duration > 0 && vid.duration !== Infinity) {
                                    setDuration(vid.duration);
                                    vid.removeEventListener('durationchange', onDurationChange);
                                    vid.currentTime = 0;
                                  }
                                };
                                vid.addEventListener('durationchange', onDurationChange);
                                vid.currentTime = 1e10;
                                setTimeout(() => {
                                  if (vid && (!Number.isFinite(vid.duration) || vid.duration === Infinity)) {
                                    vid.currentTime = 0;
                                  }
                                }, 150);
                              } else {
                                setDuration(dur);
                              }
                            }
                          }}
                          onEnded={() => setIsPlaying(false)}
                          className="max-w-full max-h-full object-contain select-none pointer-events-none"
                          style={{
                            transform: `scale(${zoom}) rotate(${rotation}deg) scaleX(${isFlipped ? -1 : 1})`,
                            transition: appSettings.hardwareAccel ? 'transform 0.15s ease-out' : 'none',
                          }}
                        />

                        {/* Edge Double-Tap / Seek Pulse Indicator Overlay */}
                        {pulseIndicator && (
                          <div
                            className={`absolute top-0 bottom-0 ${
                              pulseIndicator.side === 'left' ? 'left-0 w-2/5 bg-gradient-to-r from-blue-600/40 via-blue-600/10 to-transparent rounded-r-full' : 'right-0 w-2/5 bg-gradient-to-l from-blue-600/40 via-blue-600/10 to-transparent rounded-l-full'
                            } flex items-center justify-center z-40 pointer-events-none transition-all duration-300`}
                          >
                            <div className="flex flex-col items-center justify-center p-4 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/20 text-white shadow-2xl scale-110">
                              {pulseIndicator.side === 'left' ? <RotateCcw className="w-7 h-7 text-blue-400 mb-0.5" /> : <RotateCw className="w-7 h-7 text-blue-400 mb-0.5" />}
                              <span className="text-xs font-black font-mono tracking-wider">
                                {pulseIndicator.side === 'left' ? `-${pulseIndicator.seconds}s` : `+${pulseIndicator.seconds}s`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      </>
                    )}

                    {/* Modern Floating Media Player Controls (Image 1 UI Match) */}
                    {!videoLoadError && activeMedia.content && (
                      <div
                        className={`absolute bottom-3 sm:bottom-6 inset-x-2 sm:inset-x-4 w-auto max-w-xl mx-auto px-2 sm:px-4 py-2 sm:py-2.5 rounded-2xl sm:rounded-full bg-[#0c1017]/95 hover:bg-[#0c1017] backdrop-blur-2xl border border-white/10 flex items-center gap-1 sm:gap-3 text-white z-30 shadow-2xl transition-all duration-300 overflow-hidden ${
                          videoControlsVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => triggerControlsVisible()}
                      >
                        {/* Play/Pause Blue Circular Button */}
                        <button
                          onClick={togglePlayPause}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center cursor-pointer transition-transform hover:scale-105 shadow-lg shadow-blue-500/25 shrink-0"
                          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                        >
                          {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                        </button>

                        {/* Rewind -10s */}
                        <button
                          onClick={() => handleSeekDelta(-10)}
                          className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors flex items-center gap-1 text-xs shrink-0"
                          title="Rewind 10 seconds (Left Arrow)"
                        >
                          <RotateCcw className="w-4 h-4 text-slate-300" />
                          <span className="hidden sm:inline text-[11px] font-extrabold font-mono text-slate-200">-10s</span>
                        </button>

                        {/* Forward +10s */}
                        <button
                          onClick={() => handleSeekDelta(10)}
                          className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors flex items-center gap-1 text-xs shrink-0"
                          title="Forward 10 seconds (Right Arrow)"
                        >
                          <RotateCw className="w-4 h-4 text-slate-300" />
                          <span className="hidden sm:inline text-[11px] font-extrabold font-mono text-slate-200">+10s</span>
                        </button>

                        {/* Time Counter */}
                        <span className="text-[9px] sm:text-[11px] font-mono text-slate-300 shrink-0 font-medium tabular-nums">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>

                        {/* Seek Track */}
                        <div className="flex-1 flex items-center min-w-[24px] px-0.5 sm:px-1">
                          <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            step={0.1}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full min-w-0 h-1.5 rounded-full bg-white/20 accent-[#2563eb] hover:accent-blue-400 cursor-pointer transition-all"
                            title="Seek video timeline"
                          />
                        </div>

                        {/* Mute/Volume Toggle & Slider */}
                        <div className="flex items-center gap-1 shrink-0 min-w-0">
                          <button
                            onClick={toggleMute}
                            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors"
                            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                          >
                            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-8 sm:w-20 max-w-full h-1.5 shrink min-w-0 rounded-full bg-white/20 accent-[#2563eb] cursor-pointer"
                            title="Volume"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : imageLoadError ? (
                  <div role="alert" className="flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-amber-400/30 bg-black/70 p-6 text-center text-white">
                    <ImageIcon className="h-10 w-10 text-amber-300" />
                    <h3 className="text-sm font-bold">Image preview unavailable</h3>
                    <p className="text-xs text-slate-300">
                      This browser could not decode {activeMedia.extension?.toUpperCase() || 'this image format'}.
                      HEIC previews depend on browser support; try opening or downloading the original file in a compatible viewer.
                    </p>
                    <button
                      onClick={() => handleDownloadMedia(activeMedia)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                    >
                      Download original
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
                    onDoubleClick={() => setZoom((prev) => (prev > 1 ? 1 : 2))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg) scaleX(${isFlipped ? -1 : 1})`,
                      transition: appSettings.hardwareAccel ? 'transform 0.2s ease-out' : 'none',
                    }}
                  >
                    <img
                      key={`${activeMedia.id}:${activeMedia.content || ''}`}
                      src={activeMedia.content || ''}
                      alt={activeMedia.name}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      onError={(event) => {
                        if (event.currentTarget.getAttribute('src') === activeMediaContentRef.current) {
                          setImageLoadError(true);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="max-w-full max-h-full object-contain select-none pointer-events-none"
                    />
                  </div>
                )}
              </div>

              {/* Bottom Filmstrip Carousel (Everywhere Thumbnails synchronized with active album/tab) */}
              {appSettings.showFilmstrip && viewerMediaList.length > 1 && (
                <div
                  className={`h-16 ${isDarkTheme ? 'bg-[#18181a]/95 border-white/10' : 'bg-white/95 border-slate-200'} border-t flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 z-20`}
                  style={{
                    paddingLeft: 'calc(50% - 32px)',
                    paddingRight: 'calc(50% - 32px)',
                  }}
                >
                  {viewerMediaList.map((m) => {
                    const isCur = m.id === currentMediaId;
                    const isItemVid =
                      ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi'].includes((m.extension || '').toLowerCase()) ||
                      m.content?.startsWith('data:video') ||
                      m.content?.includes('/sample/');
                    return (
                      <button
                        key={m.id}
                        ref={isCur ? activeThumbnailRef : null}
                        onClick={() => {
                          setCurrentMediaId(m.id);
                          soundManager.play('click');
                        }}
                        className={`h-12 w-16 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer relative bg-slate-900 ${
                          isCur ? 'border-blue-500 scale-105 shadow-md ring-2 ring-blue-500/50' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        title={m.name}
                      >
                        {/* Filmstrip item thumbnail */}
                        <div className="w-full h-full relative">
                          <RenderMediaCover
                            media={m}
                            isVid={isItemVid}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                          {isItemVid && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                              <Play className="w-3 h-3 fill-white text-white opacity-80" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Right Properties Drawer & Outside Click Backdrop */}
              {showInfo && (
                <>
                  <div
                    className="absolute inset-0 z-25 bg-black/20"
                    onClick={() => setShowInfo(false)}
                  />
                  <div
                    className={`absolute top-12 right-0 bottom-16 w-80 backdrop-blur-xl border-l p-5 overflow-y-auto custom-scrollbar z-30 shadow-2xl space-y-4 transition-colors ${
                      isDarkTheme
                        ? 'bg-[#202023]/95 border-white/10 text-white'
                        : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-400/20'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={`flex items-center justify-between border-b pb-3 ${isDarkTheme ? 'border-white/10' : 'border-slate-200'}`}>
                      <h3 className={`font-bold text-xs flex items-center gap-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                        <Info className="w-4 h-4 text-blue-500" />
                        <span>File Properties</span>
                      </h3>
                      <button
                        onClick={() => setShowInfo(false)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          isDarkTheme ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Close properties"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Thumbnail Preview Banner */}
                    <div className={`w-full max-h-52 min-h-[140px] rounded-xl overflow-hidden border flex items-center justify-center p-2 relative ${
                      isDarkTheme ? 'bg-black/60 border-white/10' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <RenderMediaCover
                        media={activeMedia}
                        isVid={isVideo}
                        className="max-h-48 w-full object-contain rounded-lg drop-shadow"
                      />
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="p-3 rounded-full bg-blue-600/90 text-white shadow-xl">
                            <Play className="w-5 h-5 fill-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>File Name</label>
                        <p className={`font-semibold break-all ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{activeMedia.name}</p>
                      </div>
                      <div>
                        <label className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Path on This PC</label>
                        <p className={`font-mono text-[10px] break-all ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>{activeMedia.path}</p>
                      </div>
                      <div>
                        <label className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>File Size</label>
                        <p className={isDarkTheme ? 'text-slate-200' : 'text-slate-700'}>{activeMedia.size || '1.4 MB'}</p>
                      </div>
                      <div>
                        <label className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Date Modified</label>
                        <p className={isDarkTheme ? 'text-slate-200' : 'text-slate-700'}>{activeMedia.modified || 'Today'}</p>
                      </div>
                      <div>
                        <label className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Format</label>
                        <p className={`uppercase font-mono ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{activeMedia.extension || 'JPG'}</p>
                      </div>
                      <div>
                        <label className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Resolution</label>
                        <p className={isDarkTheme ? 'text-slate-200' : 'text-slate-700'}>1920 × 1080 px (FHD)</p>
                      </div>

                      <button
                        onClick={() => {
                          const targetFolder = activeMedia.parentId || 'D:/Pictures/Wallpapers';
                          openApp('explorer', { initialPath: targetFolder });
                          soundManager.play('click');
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs mt-3 ${
                          isDarkTheme
                            ? 'bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border-blue-500/30'
                            : 'bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border-blue-200'
                        }`}
                        title="Open file's folder in File Explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in Explorer</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW 4: IN-APP MEDIA SETTINGS (100% WORKING & PERSISTENT) */}
          {currentView === 'settings' && (
            <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
              {/* Header */}
              <div className="flex items-center gap-3 border-b pb-4 border-white/10">
                <button
                  onClick={() => setCurrentView('albums')}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    isDarkTheme
                      ? 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                  }`}
                  title="Back to Albums"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h1 className={`text-xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                    Media App Settings
                  </h1>
                  <p className="text-xs text-slate-400">Configure theme and playback preferences</p>
                </div>
              </div>

              {/* Section 2: Viewing & Playback Options */}
              <div
                className={`p-5 rounded-2xl border space-y-4 shadow-xs ${
                  isDarkTheme ? 'bg-[#222226] border-white/10' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>Viewing and Playback</span>
                </div>

                {/* Auto-Play Videos */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <h4 className="text-xs font-semibold">Auto-play videos and animated GIFs</h4>
                    <p className="text-[11px] text-slate-400">Automatically begin playback when opened in the lightbox</p>
                  </div>
                  <button
                    onClick={() => {
                      saveSetting('autoPlayVideos', !appSettings.autoPlayVideos);
                      soundManager.play('click');
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      appSettings.autoPlayVideos ? 'bg-blue-600' : 'bg-slate-600/40'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        appSettings.autoPlayVideos ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Filmstrip */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <h4 className="text-xs font-semibold">Show filmstrip in media viewer</h4>
                    <p className="text-[11px] text-slate-400">Display thumbnail carousel at the bottom of the lightbox</p>
                  </div>
                  <button
                    onClick={() => {
                      saveSetting('showFilmstrip', !appSettings.showFilmstrip);
                      soundManager.play('click');
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      appSettings.showFilmstrip ? 'bg-blue-600' : 'bg-slate-600/40'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        appSettings.showFilmstrip ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Loop Videos */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <h4 className="text-xs font-semibold">Loop video playback</h4>
                    <p className="text-[11px] text-slate-400">Automatically replay videos upon reaching the end</p>
                  </div>
                  <button
                    onClick={() => {
                      saveSetting('loopVideos', !appSettings.loopVideos);
                      soundManager.play('click');
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      appSettings.loopVideos ? 'bg-blue-600' : 'bg-slate-600/40'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        appSettings.loopVideos ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Hardware Acceleration */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <h4 className="text-xs font-semibold">Hardware-accelerated smooth animations</h4>
                    <p className="text-[11px] text-slate-400">Enable GPU transitions for zoom, panning, and rotation</p>
                  </div>
                  <button
                    onClick={() => {
                      saveSetting('hardwareAccel', !appSettings.hardwareAccel);
                      soundManager.play('click');
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      appSettings.hardwareAccel ? 'bg-blue-600' : 'bg-slate-600/40'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        appSettings.hardwareAccel ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Confirm Delete */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <h4 className="text-xs font-semibold">Confirm before deleting media</h4>
                    <p className="text-[11px] text-slate-400">Ask for confirmation before sending items to Recycle Bin</p>
                  </div>
                  <button
                    onClick={() => {
                      saveSetting('confirmDelete', !appSettings.confirmDelete);
                      soundManager.play('click');
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      appSettings.confirmDelete ? 'bg-blue-600' : 'bg-slate-600/40'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        appSettings.confirmDelete ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Section 3: Default Sort Order & Grid Sizing */}
              <div
                className={`p-5 rounded-2xl border space-y-4 shadow-xs ${
                  isDarkTheme ? 'bg-[#222226] border-white/10' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <span>Grid Sorting & Layout</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5">Default Sorting</label>
                    <select
                      value={appSettings.sortOrder}
                      onChange={(e) => saveSetting('sortOrder', e.target.value as any)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                        isDarkTheme ? 'bg-[#1b1b1e] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="name-asc">Name (A to Z)</option>
                      <option value="name-desc">Name (Z to A)</option>
                      <option value="size-desc">File Size (Largest)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5">Thumbnail Grid Size</label>
                    <select
                      value={appSettings.gridTileSize}
                      onChange={(e) => saveSetting('gridTileSize', e.target.value as any)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                        isDarkTheme ? 'bg-[#1b1b1e] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="small">Small (Dense)</option>
                      <option value="medium">Medium (Standard)</option>
                      <option value="large">Large (Expansive)</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 5: RECYCLE BIN (MEDIA FILES ONLY: PHOTOS & VIDEOS) */}
          {currentView === 'recycle-bin' && (
            <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-5">
              {/* Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCurrentView('albums');
                      setSelectedNav('albums');
                    }}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isDarkTheme
                        ? 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                    }`}
                    title="Back to Albums"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h1 className={`text-xl font-bold flex items-center gap-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                      <Trash2 className="w-5 h-5 text-rose-400" />
                      <span>Recycle Bin (Media Files)</span>
                    </h1>
                    <p className="text-xs text-slate-400">
                      Showing only deleted photos, videos, and media items ({deletedMediaFiles.length} items)
                    </p>
                  </div>
                </div>

                {deletedMediaFiles.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedRecycleIds.size > 0 && (
                      <>
                        <button
                          onClick={() => {
                            selectedRecycleIds.forEach((id) => restoreFile(id));
                            setSelectedRecycleIds(new Set());
                            soundManager.play('notification');
                            addNotification({
                              title: 'Selected Media Restored',
                              message: `Restored ${selectedRecycleIds.size} media items back to their original albums.`,
                              type: 'success',
                              appId: 'photos',
                            });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Restore Selected ({selectedRecycleIds.size})</span>
                        </button>
                        <button
                          onClick={() => {
                            setPendingDeleteMediaRecycleIds(Array.from(selectedRecycleIds));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/40 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Selected</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        deletedMediaFiles.forEach((file) => restoreFile(file.id));
                        setSelectedRecycleIds(new Set());
                        soundManager.play('notification');
                        addNotification({
                          title: 'Media Files Restored',
                          message: `Restored ${deletedMediaFiles.length} media items back to their original albums.`,
                          type: 'success',
                          appId: 'photos',
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Restore All Media</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowConfirmEmptyMediaRecycle(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Empty Media Bin</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Secondary Feature Bar matching Image 1: Select All + Segmented Size Control */}
              {deletedMediaFiles.length > 0 && (
                <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border ${
                  isDarkTheme ? 'bg-[#1e1e24]/80 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (selectedRecycleIds.size === deletedMediaFiles.length) {
                          setSelectedRecycleIds(new Set());
                        } else {
                          setSelectedRecycleIds(new Set(deletedMediaFiles.map((m) => m.id)));
                        }
                        soundManager.play('click');
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        selectedRecycleIds.size === deletedMediaFiles.length && deletedMediaFiles.length > 0
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                          : isDarkTheme
                          ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                      <span>
                        {selectedRecycleIds.size === deletedMediaFiles.length && deletedMediaFiles.length > 0
                          ? 'Deselect All'
                          : 'Select All'}
                      </span>
                    </button>

                    {selectedRecycleIds.size > 0 && (
                      <span className="text-xs text-slate-400 font-medium">
                        {selectedRecycleIds.size} of {deletedMediaFiles.length} selected
                      </span>
                    )}
                  </div>

                  {/* Size Toggle Segmented Control */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setMediaRecycleIconSize(size);
                          soundManager.play('click');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                          mediaRecycleIconSize === size
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Deleted Media Items Grid */}
              {deletedMediaFiles.length > 0 ? (
                <div
                  className={`grid gap-4 ${
                    mediaRecycleIconSize === 'small'
                      ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
                      : mediaRecycleIconSize === 'large'
                      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                  }`}
                >
                  {deletedMediaFiles.map((item) => {
                    const ext = (item.extension || '').toLowerCase();
                    const isItemVid = ['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi'].includes(ext) || item.content?.startsWith('data:video');
                    const isSelected = selectedRecycleIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedRecycleIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) {
                              next.delete(item.id);
                            } else {
                              next.add(item.id);
                            }
                            return next;
                          });
                          soundManager.play('click');
                        }}
                        className={`group relative flex flex-col justify-between rounded-2xl border overflow-hidden p-3 select-none shadow-sm hover:shadow-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-blue-500 bg-blue-500/10 border-blue-500/50'
                            : isDarkTheme
                            ? 'bg-[#222226] border-white/10 hover:border-white/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Selection Checkbox Overlay */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecycleIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            });
                            soundManager.play('click');
                          }}
                          className={`absolute top-4 left-4 z-20 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-black/60 text-transparent hover:bg-black/80 hover:text-white/70 border border-white/30'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>

                        {/* Thumbnail */}
                        <div className="w-full aspect-square rounded-xl overflow-hidden relative bg-black/50 border border-white/5 flex items-center justify-center">
                          <RenderMediaCover
                            media={item}
                            isVid={isItemVid}
                            className="w-full h-full object-cover"
                          />
                          {isItemVid && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                              <Play className="w-4 h-4 fill-white text-white opacity-80" />
                            </div>
                          )}
                        </div>

                        {/* Title & Info */}
                        <div className="pt-2">
                          <p className={`font-semibold text-xs truncate ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{item.size || '1.2 MB'}</p>
                        </div>

                        {/* Action Buttons */}
                        <div
                          className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 justify-between"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              restoreFile(item.id);
                              soundManager.play('notification');
                              addNotification({
                                title: 'File Restored',
                                message: `Restored "${item.name}" back to ${item.parentId || 'Pictures'}.`,
                                type: 'success',
                                appId: 'photos',
                              });
                            }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Restore file to original location"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => {
                              setPendingDeleteMediaRecycleIds([item.id]);
                            }}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 rounded-3xl bg-white/5 border border-white/10 mb-4 text-slate-400">
                    <Trash2 className="w-10 h-10 opacity-50" />
                  </div>
                  <h3 className={`text-base font-bold mb-1 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                    Media Recycle Bin is Empty
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    When you delete photos or videos anywhere in the system, they will safely appear here for restoration or permanent deletion.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      {/* ================= 3. WINDOWS 11 / THIS PC SHARING FLYOUT DIALOG ================= */}
      {shareTargetMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden p-5 space-y-4 ${
              isDarkTheme ? 'bg-[#252528] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-white/10">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm">Share from This PC</h3>
              </div>
              <button
                onClick={() => setShareTargetMedia(null)}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isDarkTheme ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Media Preview Card */}
            <div
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                isDarkTheme ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-white/10 relative">
                <RenderMediaCover
                  media={shareTargetMedia}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-bold truncate">{shareTargetMedia.name}</p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{shareTargetMedia.path}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{shareTargetMedia.size || '1.4 MB'}</p>
              </div>
            </div>

            {/* Sharing Options (Exact Windows 11 / This PC Sharing List) */}
            <div className="space-y-1.5 text-xs">
              {/* Option 1: Contact Me App */}
              <button
                onClick={() => {
                  setShareTargetMedia(null);
                  openApp('contact', {
                    attachments: [shareTargetMedia],
                    subject: `Sharing: ${shareTargetMedia.name}`,
                    message: `Hi Anish,\n\nI am sharing this media item "${shareTargetMedia.name}" with you from the Windows 11 Portfolio Media App.`,
                  });
                  soundManager.play('click');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isDarkTheme
                    ? 'bg-white/5 hover:bg-blue-600/20 border-white/10 hover:border-blue-500 text-white'
                    : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-400 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Send via Contact Me</p>
                    <p className="text-[10px] text-slate-400">Attach and send directly to Anish Jethva</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Option 2: Copy to Clipboard */}
              <button
                onClick={() => {
                  handleCopyToClipboard(shareTargetMedia);
                  setShareTargetMedia(null);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isDarkTheme
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Copy className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Copy to Clipboard</p>
                    <p className="text-[10px] text-slate-400">Save to Windows 11 clipboard history</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Option 3: Set as Desktop Wallpaper */}
              <button
                onClick={() => {
                  handleSetAsWallpaper(shareTargetMedia);
                  setShareTargetMedia(null);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isDarkTheme
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Set as Desktop Wallpaper</p>
                    <p className="text-[10px] text-slate-400">Apply as Windows 11 background</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Option 4: Set as Lock Screen Background */}
              <button
                onClick={() => {
                  handleSetAsLockScreen(shareTargetMedia);
                  setShareTargetMedia(null);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isDarkTheme
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Set as Lock Screen Background</p>
                    <p className="text-[10px] text-slate-400">Apply as Windows 11 lock screen</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Option 4: Open in File Explorer */}
              <button
                onClick={() => {
                  setShareTargetMedia(null);
                  openApp('explorer', { initialPath: shareTargetMedia.parentId });
                  soundManager.play('click');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isDarkTheme
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Show in File Explorer</p>
                    <p className="text-[10px] text-slate-400">Navigate to folder on This PC</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Option 5: Download / Save */}
              <button
                onClick={() => {
                  handleDownloadMedia(shareTargetMedia);
                  setShareTargetMedia(null);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isDarkTheme
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Download File</p>
                    <p className="text-[10px] text-slate-400">Save to your device</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. DELETE CONFIRMATION MODAL ================= */}
      {pendingDeleteMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden p-5 space-y-4 ${
              isDarkTheme ? 'bg-[#252528] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Delete Media File?</h3>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5 text-xs">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0 relative">
                <RenderMediaCover
                  media={pendingDeleteMedia}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{pendingDeleteMedia.name}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{pendingDeleteMedia.size || '1.2 MB'}</p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Are you sure you want to move this file to the Recycle Bin? It will be automatically purged after 30 days.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingDeleteMedia(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border ${
                  isDarkTheme ? 'bg-white/10 hover:bg-white/15 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteMedia(pendingDeleteMedia)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-xs"
              >
                Delete to Recycle Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. MEDIA APP CONTEXT MENU ================= */}
      {contextMenu && (
        <div
          className="fixed z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`w-64 rounded-2xl border shadow-2xl p-1.5 backdrop-blur-xl text-xs select-none ${
              isDarkTheme
                ? 'bg-[#1e1e24]/95 border-white/15 text-slate-200 shadow-black/70'
                : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-400/30'
            }`}
          >
            {contextMenu.isMulti && contextMenu.items.length > 1 ? (
              // MULTI-SELECTION CONTEXT MENU
              <div className="space-y-0.5">
                <div className="px-3 py-1.5 text-[11px] font-bold text-blue-400 border-b border-white/10 flex items-center justify-between">
                  <span>{contextMenu.items.length} Items Selected</span>
                  <button
                    onClick={() => {
                      handleClearSelection();
                      setContextMenu(null);
                    }}
                    className={`cursor-pointer transition-colors p-1 rounded-md ${
                      isDarkTheme ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (contextMenu.items[0]) {
                      setCurrentMediaId(contextMenu.items[0].id);
                      setCurrentView('viewer');
                    }
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>View Selected Items</span>
                </button>

                <button
                  onClick={() => {
                    contextMenu.items.forEach((m) => {
                      if (!favorites.has(m.id)) toggleFavorite(m.id);
                    });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Heart className="w-4 h-4 text-red-400" />
                  <span>Add All to Favorites</span>
                </button>

                <div className={`h-px my-1 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-200'}`} />

                <button
                  onClick={() => {
                    handleCopySelected();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-4 h-4 text-emerald-400" />
                    <span>Copy ({contextMenu.items.length})</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+C</span>
                </button>

                <button
                  onClick={() => {
                    handleCutSelected();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Scissors className="w-4 h-4 text-amber-400" />
                    <span>Cut ({contextMenu.items.length})</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+X</span>
                </button>

                <div className={`h-px my-1 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-200'}`} />

                <button
                  onClick={() => {
                    handleDeleteSelected();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-red-600 hover:text-white text-rose-400 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete ({contextMenu.items.length})</span>
                  </div>
                  <span className="text-[10px] opacity-60">Del</span>
                </button>
              </div>
            ) : contextMenu.target ? (
              // SINGLE MEDIA ITEM CONTEXT MENU
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setCurrentMediaId(contextMenu.target!.id);
                    setCurrentView('viewer');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold">Open in Viewer</span>
                  </div>
                  <span className="text-[10px] opacity-60">Enter</span>
                </button>

                <button
                  onClick={() => {
                    handleSetAsWallpaper(contextMenu.target!);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Monitor className="w-4 h-4 text-cyan-400" />
                  <span>Set as Desktop Background</span>
                </button>

                <button
                  onClick={() => {
                    handleSetAsLockScreen(contextMenu.target!);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <span>Set as Lock Screen</span>
                </button>

                <div className={`h-px my-1 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-200'}`} />

                <button
                  onClick={() => {
                    toggleFavorite(contextMenu.target!.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favorites.has(contextMenu.target!.id) ? 'fill-red-500 text-red-500' : 'text-red-400'
                    }`}
                  />
                  <span>
                    {favorites.has(contextMenu.target!.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShareTargetMedia(contextMenu.target!);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <span>Share Media</span>
                </button>

                <button
                  onClick={() => {
                    handleDownloadMedia(contextMenu.target!);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>Download File</span>
                </button>

                <div className={`h-px my-1 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-200'}`} />

                <button
                  onClick={() => {
                    copyFile(contextMenu.target!);
                    soundManager.play('click');
                    addNotification({
                      title: 'Copied',
                      message: `Copied "${contextMenu.target!.name}" to clipboard`,
                      type: 'info',
                    });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-4 h-4 text-emerald-400" />
                    <span>Copy</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+C</span>
                </button>

                <button
                  onClick={() => {
                    cutFile(contextMenu.target!);
                    soundManager.play('click');
                    addNotification({
                      title: 'Cut',
                      message: `Cut "${contextMenu.target!.name}" to clipboard`,
                      type: 'info',
                    });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Scissors className="w-4 h-4 text-amber-400" />
                    <span>Cut</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+X</span>
                </button>

                <div className={`h-px my-1 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-200'}`} />

                <button
                  onClick={() => {
                    requestDeleteMedia(contextMenu.target!);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-red-600 hover:text-white text-rose-400 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </div>
                  <span className="text-[10px] opacity-60">Del</span>
                </button>

                <button
                  onClick={() => {
                    setPropertiesTargetMedia(contextMenu.target!);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Info className="w-4 h-4 text-slate-400" />
                  <span>Properties</span>
                </button>
              </div>
            ) : (
              // EMPTY CANVAS BACKGROUND CONTEXT MENU
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    handleSelectAllMedia();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                    <span>Select All</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+A</span>
                </button>

                {clipboard && clipboard.files && clipboard.files.length > 0 && (
                  <button
                    onClick={() => {
                      handlePasteMedia();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clipboard className="w-4 h-4 text-emerald-400" />
                      <span>Paste ({clipboard.files.length})</span>
                    </div>
                    <span className="text-[10px] opacity-60">Ctrl+V</span>
                  </button>
                )}

                <div className={`h-px my-1 ${isDarkTheme ? 'bg-white/10' : 'bg-slate-200'}`} />

                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Grid Size
                </div>
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      saveSetting('gridTileSize', size);
                      setContextMenu(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-left capitalize ${
                      appSettings.gridTileSize === size ? 'text-blue-400 font-bold' : ''
                    }`}
                  >
                    <span>{size} Icons</span>
                    {appSettings.gridTileSize === size && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 6. PROPERTIES DIALOG MODAL ================= */}
      {propertiesTargetMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPropertiesTargetMedia(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden p-5 space-y-4 ${
              isDarkTheme ? 'bg-[#252528] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-2xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkTheme ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <h3 className={`font-bold text-sm ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Media Properties</h3>
              </div>
              <button
                onClick={() => setPropertiesTargetMedia(null)}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isDarkTheme ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`w-full max-h-56 min-h-[140px] rounded-xl overflow-hidden flex items-center justify-center p-2 relative border ${
              isDarkTheme ? 'bg-black/40 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <RenderMediaCover
                media={propertiesTargetMedia}
                className="max-h-52 w-full object-contain rounded-lg drop-shadow"
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className={`flex justify-between py-1.5 border-b ${isDarkTheme ? 'border-white/10' : 'border-slate-100'}`}>
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>File Name:</span>
                <span className={`font-semibold truncate max-w-[200px] ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{propertiesTargetMedia.name}</span>
              </div>
              <div className={`flex justify-between py-1.5 border-b ${isDarkTheme ? 'border-white/10' : 'border-slate-100'}`}>
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Type:</span>
                <span className={`font-mono uppercase ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{propertiesTargetMedia.extension || 'Media'}</span>
              </div>
              <div className={`flex justify-between py-1.5 border-b ${isDarkTheme ? 'border-white/10' : 'border-slate-100'}`}>
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Size:</span>
                <span className={`font-mono ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{propertiesTargetMedia.size || '1.2 MB'}</span>
              </div>
              <div className={`flex justify-between py-1.5 border-b ${isDarkTheme ? 'border-white/10' : 'border-slate-100'}`}>
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Location:</span>
                <span className={`font-mono text-[10px] truncate max-w-[200px] ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>{propertiesTargetMedia.path || 'This PC'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Modified:</span>
                <span className={isDarkTheme ? 'text-slate-200' : 'text-slate-700'}>{propertiesTargetMedia.modified || 'Recent'}</span>
              </div>
            </div>

            <div className={`flex justify-end pt-2 border-t ${isDarkTheme ? 'border-white/10' : 'border-slate-200'}`}>
              <button
                onClick={() => setPropertiesTargetMedia(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Bin Confirmation Modal */}
      {showConfirmEmptyMediaRecycle && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Empty Media Recycle Bin?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  Are you sure you want to permanently delete all {deletedMediaFiles.length} media item(s)? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-colors"
                onClick={() => setShowConfirmEmptyMediaRecycle(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-red-600/20"
                onClick={() => {
                  deletedMediaFiles.forEach((file) => deletePermanently(file.id));
                  setSelectedRecycleIds(new Set());
                  setShowConfirmEmptyMediaRecycle(false);
                  soundManager.play('delete');
                  addNotification({
                    title: 'Media Bin Emptied',
                    message: 'Permanently deleted all media items from the recycle bin.',
                    type: 'info',
                    appId: 'photos',
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
      {pendingDeleteMediaRecycleIds.length > 0 && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {pendingDeleteMediaRecycleIds.length === 1 ? 'Permanently Delete Media Item?' : 'Permanently Delete Selected Media Items?'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  {pendingDeleteMediaRecycleIds.length === 1
                    ? 'Are you sure you want to permanently delete this media item? This action cannot be undone.'
                    : `Are you sure you want to permanently delete the ${pendingDeleteMediaRecycleIds.length} selected media items? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-colors"
                onClick={() => setPendingDeleteMediaRecycleIds([])}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-red-600/20"
                onClick={() => {
                  pendingDeleteMediaRecycleIds.forEach((id) => deletePermanently(id));
                  setSelectedRecycleIds((prev) => {
                    const next = new Set(prev);
                    pendingDeleteMediaRecycleIds.forEach((id) => next.delete(id));
                    return next;
                  });
                  setPendingDeleteMediaRecycleIds([]);
                  soundManager.play('delete');
                  addNotification({
                    title: 'Media Deleted',
                    message: pendingDeleteMediaRecycleIds.length === 1 ? 'Permanently deleted media item.' : `Permanently deleted ${pendingDeleteMediaRecycleIds.length} selected media items.`,
                    type: 'info',
                    appId: 'photos',
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

export const PhotosApp = MediaApp;
