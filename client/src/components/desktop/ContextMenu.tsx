import React, { useState } from 'react';
import { useOS } from '../../context/OSContext';
import { APPS_LIST } from '../../data/portfolioData';
import { calculateDriveMetrics } from '../../utils/storageMetrics';
import { ShareModal } from '../common/ShareModal';
import type { AppId, FileItem } from '../../types';
import { soundManager } from '../../utils/sound';
import { isMediaFile } from '../../utils/fileAssociations';
import { formatDateISO } from '../../utils/dateTime';
import {
  RotateCcw,
  FolderPlus,
  FilePlus,
  Monitor,
  Palette,
  Terminal,
  Grid,
  Info,
  EyeOff,
  ExternalLink,
  Edit,
  Copy,
  Scissors,
  Trash2,
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  X,
  Clipboard,
  Sliders,
  Play,
  Cpu,
  ChevronRight,
  ArrowUpDown,
  Check,
  Archive,
  FolderArchive,
  Share2,
  Lock,
} from 'lucide-react';

export const ContextMenu: React.FC = () => {
  const {
    contextMenu,
    closeContextMenu,
    openApp,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    windows,
    createFolder,
    createFile,
    updateSettings,
    settings,
    addNotification,
    toggleMatrixMode,
    files,
    desktopIcons,
    renameDesktopIcon,
    deleteDesktopIcon,
    renameFile,
    deleteFile,
    copyFile,
    cutFile,
    pasteFile,
    clipboard,
    pinnedAppIds,
    pinToTaskbar,
    unpinFromTaskbar,
    startPinnedAppIds,
    pinToStart,
    unpinFromStart,
    isPinnedToStart,
    openProperties,
    sortDesktopIcons,
    showDesktop,
    driveLabels,
    updateDriveLabel,
    compressToZip,
    extractZip,
    refreshFileSystem,
  } = useOS();

  const [activeSubmenu, setActiveSubmenu] = useState<'view' | 'sort' | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<{ id: string; currentName: string; type: 'icon' | 'file' } | null>(null);
  const [newPrompt, setNewPrompt] = useState<{ type: 'folder' | 'file'; path: string } | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
  const openTimeRef = React.useRef(0);

  React.useEffect(() => {
    if (contextMenu) {
      openTimeRef.current = Date.now();
    }
  }, [contextMenu]);

  // Robust auto-close on mobile and desktop when user taps/clicks elsewhere
  React.useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalDismiss = (e: MouseEvent | TouchEvent) => {
      // Prevent dismissing right during the long-press finger lift (< 600ms)
      if (Date.now() - openTimeRef.current < 600) return;
      if (typeof window !== 'undefined') {
        const lastLp = (window as any).__lastLongPressTime;
        if (lastLp && Date.now() - lastLp < 600) return;
        if ((window as any).__isLongPressActiveNow) return;
      }

      const target = e.target as HTMLElement;
      if (target && target.closest('[data-contextmenu="true"]')) {
        return;
      }

      closeContextMenu();
      setActiveSubmenu(null);
    };

    window.addEventListener('pointerdown', handleGlobalDismiss, { capture: true });
    window.addEventListener('touchstart', handleGlobalDismiss, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleGlobalDismiss, { capture: true });
      window.removeEventListener('touchstart', handleGlobalDismiss, { capture: true });
    };
  }, [contextMenu, closeContextMenu]);

  const togglePinQuickAccess = (file: { name: string; path: string; icon?: string }) => {
    try {
      const saved = localStorage.getItem('win11_quick_access');
      const current = saved ? JSON.parse(saved) : [];
      const existing = current.find((p: any) => p.path === file.path);
      let updated;
      if (existing) {
        updated = current.filter((p: any) => p.path !== file.path);
        addNotification({ title: 'Unpinned', message: `Unpinned "${file.name}" from Quick Access`, type: 'info' });
      } else {
        const icon = file.icon || (file.path.includes('Desktop') ? 'Monitor' : 'Folder');
        updated = [...current, { id: 'qa-' + Date.now(), name: file.name, path: file.path, icon }];
        addNotification({ title: 'Pinned to Quick Access', message: `Pinned "${file.name}" to Quick Access`, type: 'success' });
      }
      localStorage.setItem('win11_quick_access', JSON.stringify(updated));
      window.dispatchEvent(new Event('quickaccess_updated'));
    } catch {
      // ignore
    }
  };

  if (!contextMenu && !renamePrompt && !newPrompt && !sharingFile) return null;

  // Calculate adjusted position to keep menu inside viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const adjustedX = contextMenu ? Math.max(8, Math.min(contextMenu.x, window.innerWidth - 232)) : 0;
  const adjustedY = contextMenu
    ? Math.max(isMobile ? 44 : 8, Math.min(contextMenu.y, window.innerHeight - (isMobile ? 320 : 380)))
    : 0;

  const handleRefresh = async () => {
    let isFolder = false;
    let folderPath: string | undefined;

    if (contextMenu?.type === 'explorer-space') {
      isFolder = true;
      folderPath = contextMenu.currentPath;
    } else if (contextMenu?.type === 'explorer-item') {
      isFolder = contextMenu.file.type === 'folder';
      folderPath = contextMenu.file.path;
    }

    closeContextMenu();
    setActiveSubmenu(null);

    // Forces that specific window or desktop interface to re-read its data from the storage drive
    // The "Refresh" option in the right-click context menu does not reboot or refresh the entire operating system.
    if (isFolder && folderPath) {
      soundManager.playRefresh();
      await refreshFileSystem(folderPath);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('win11_refresh_view', {
            detail: { target: 'folder', path: folderPath },
          })
        );
      }
      addNotification({
        title: 'Folder Refreshed',
        message: `Refreshed view for ${folderPath.split('/').pop() || folderPath}`,
        type: 'info',
      });
    } else {
      soundManager.playRefresh();
      await refreshFileSystem('desktop');
      // Refresh desktop view and files without resetting or changing user's custom icon positions
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('win11_refresh_view', {
            detail: { target: 'desktop' },
          })
        );
      }
      addNotification({
        title: 'Desktop Refreshed',
        message: 'Desktop view updated.',
        type: 'info',
      });
    }
  };

  const handleSetIconSize = (size: 'small' | 'medium' | 'large') => {
    closeContextMenu();
    setActiveSubmenu(null);
    updateSettings({ iconSize: size });
  };

  const handleSortIcons = (by: 'name' | 'size' | 'type' | 'date') => {
    closeContextMenu();
    setActiveSubmenu(null);
    sortDesktopIcons(by);
  };

  const handleNewFolderClick = (path = 'D:/Desktop') => {
    closeContextMenu();
    setActiveSubmenu(null);
    createFolder(path, 'New Folder');
  };

  const handleNewFileClick = (path = 'D:/Desktop') => {
    closeContextMenu();
    setActiveSubmenu(null);
    createFile(path, 'New Document.txt', 'Sample document content...', 'txt');
  };

  const handleCreateConfirm = () => {
    if (!newPrompt || !promptInput.trim()) return;
    if (newPrompt.type === 'folder') {
      createFolder(newPrompt.path, promptInput.trim());
    } else {
      createFile(newPrompt.path, promptInput.trim(), 'Type your text content here...', 'txt');
    }
    setNewPrompt(null);
  };

  const handleRenameConfirm = () => {
    if (!renamePrompt || !promptInput.trim()) return;
    if (renamePrompt.type === 'icon') {
      renameDesktopIcon(renamePrompt.id, promptInput.trim());
    } else {
      renameFile(renamePrompt.id, promptInput.trim());
    }
    setRenamePrompt(null);
  };

  return (
    <>
      {contextMenu && (
        <div
          className="fixed inset-0 z-[9998] bg-transparent"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeContextMenu();
          }}
          onTouchStart={(e) => {
            if (Date.now() - openTimeRef.current < 450) return;
            e.preventDefault();
            e.stopPropagation();
            closeContextMenu();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (Date.now() - openTimeRef.current < 450) {
              return;
            }
            e.preventDefault();
            closeContextMenu();
          }}
        />
      )}
      {contextMenu && (
        <div
          data-contextmenu="true"
          className="fixed z-[9999] w-56 py-1.5 rounded-xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl text-xs text-slate-800 dark:text-slate-100 select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ top: adjustedY, left: adjustedX }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
        {/* ================= 1. DESKTOP CONTEXT MENU ================= */}
        {contextMenu.type === 'desktop' && (
          <div className="space-y-1">
            <div className="px-1.5 space-y-0.5">
              {/* View Button with Submenu */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('view')}
              >
                <button
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                    activeSubmenu === 'view'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubmenu(activeSubmenu === 'view' ? null : 'view');
                  }}
                >
                  <span className="flex items-center gap-2.5">
                    <Grid className="w-3.5 h-3.5 text-blue-500" />
                    <span>View</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Submenu for View */}
                {activeSubmenu === 'view' && (
                  <div
                    className={`absolute top-0 w-44 py-1.5 rounded-xl border border-white/20 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl space-y-0.5 z-[10000] text-xs animate-in fade-in zoom-in-95 duration-100 ${
                      adjustedX + 224 + 180 > window.innerWidth
                        ? 'right-full mr-1'
                        : 'left-full ml-1'
                    }`}
                    onMouseEnter={() => setActiveSubmenu('view')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-left cursor-pointer text-slate-700 dark:text-slate-200"
                      onClick={() => handleSetIconSize('large')}
                    >
                      <span className="flex items-center gap-2">
                        <Grid className="w-4 h-4 text-blue-500" />
                        <span>Large icons</span>
                      </span>
                      {settings.iconSize === 'large' && <Check className="w-3.5 h-3.5 text-blue-500 stroke-[3]" />}
                    </button>
                    <button
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-left cursor-pointer text-slate-700 dark:text-slate-200"
                      onClick={() => handleSetIconSize('medium')}
                    >
                      <span className="flex items-center gap-2">
                        <Grid className="w-3.5 h-3.5 text-blue-500" />
                        <span>Medium icons</span>
                      </span>
                      {settings.iconSize === 'medium' && <Check className="w-3.5 h-3.5 text-blue-500 stroke-[3]" />}
                    </button>
                    <button
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-left cursor-pointer text-slate-700 dark:text-slate-200"
                      onClick={() => handleSetIconSize('small')}
                    >
                      <span className="flex items-center gap-2">
                        <Grid className="w-3 h-3 text-blue-500" />
                        <span>Small icons</span>
                      </span>
                      {settings.iconSize === 'small' && <Check className="w-3.5 h-3.5 text-blue-500 stroke-[3]" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Sort by Button with Submenu */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('sort')}
              >
                <button
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                    activeSubmenu === 'sort'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubmenu(activeSubmenu === 'sort' ? null : 'sort');
                  }}
                >
                  <span className="flex items-center gap-2.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Sort by</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Submenu for Sort by */}
                {activeSubmenu === 'sort' && (
                  <div
                    className={`absolute top-0 w-44 py-1.5 rounded-xl border border-white/20 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl space-y-0.5 z-[10000] text-xs animate-in fade-in zoom-in-95 duration-100 ${
                      adjustedX + 224 + 180 > window.innerWidth
                        ? 'right-full mr-1'
                        : 'left-full ml-1'
                    }`}
                    onMouseEnter={() => setActiveSubmenu('sort')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
                      onClick={() => handleSortIcons('name')}
                    >
                      Name
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
                      onClick={() => handleSortIcons('size')}
                    >
                      Size
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
                      onClick={() => handleSortIcons('type')}
                    >
                      Item type
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
                      onClick={() => handleSortIcons('date')}
                    >
                      Date modified
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="my-1 border-t border-slate-200 dark:border-white/10" />

            <div className="px-1.5 space-y-0.5" onMouseEnter={() => setActiveSubmenu(null)}>
              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={handleRefresh}
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                <span>Refresh</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => handleNewFolderClick()}
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                <span>New Folder</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => handleNewFileClick()}
              >
                <FilePlus className="w-3.5 h-3.5 text-emerald-500" />
                <span>New Text Document</span>
              </button>
            </div>

            <div className="my-1 border-t border-slate-200 dark:border-white/10" />

            <div className="px-1.5 space-y-0.5" onMouseEnter={() => setActiveSubmenu(null)}>
              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  openApp('terminal');
                }}
              >
                <Terminal className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                <span>Open Terminal Here</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  openApp('settings', { tab: 'personalization' });
                }}
              >
                <Palette className="w-3.5 h-3.5 text-purple-500" />
                <span>Personalize</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  openApp('settings', { tab: 'system' });
                }}
              >
                <Monitor className="w-3.5 h-3.5 text-sky-500" />
                <span>Display Settings</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  openApp('about');
                }}
              >
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>About Portfolio</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 2. DESKTOP ICON CONTEXT MENU ================= */}
        {contextMenu.type === 'desktop-icon' && (() => {
          const icon = desktopIcons.find((i) => i.id === contextMenu.iconId);
          if (!icon) return null;
          const isPinned = icon.appId && pinnedAppIds.includes(icon.appId);

          return (
            <div className="px-1.5 space-y-0.5">
              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg font-medium transition-colors"
                onClick={() => {
                  closeContextMenu();
                  if (icon.appId) openApp(icon.appId);
                  else if (icon.type === 'folder' && icon.filePath) openApp('explorer', { path: icon.filePath });
                  else if (icon.filePath) {
                    if (isMediaFile(icon.filePath)) {
                      openApp('photos', { filePath: icon.filePath });
                    } else {
                      openApp('notepad', { filePath: icon.filePath });
                    }
                  }
                  else openApp('explorer');
                }}
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                <span>Open</span>
              </button>

              {icon.appId && (
                <button
                  className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                  onClick={() => {
                    closeContextMenu();
                    if (isPinned) unpinFromTaskbar(icon.appId!);
                    else pinToTaskbar(icon.appId!);
                  }}
                >
                  {isPinned ? (
                    <>
                      <PinOff className="w-3.5 h-3.5 text-amber-500" />
                      <span>Unpin from Taskbar</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5 text-blue-500" />
                      <span>Pin to Taskbar</span>
                    </>
                  )}
                </button>
              )}

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => {
                  closeContextMenu();
                  const matchingFile = files.find((f) => f.path === icon.filePath || f.id === icon.id);
                  if (matchingFile) {
                    copyFile(matchingFile);
                  } else {
                    copyFile({
                      id: icon.id,
                      name: icon.name,
                      path: icon.filePath || `D:/Desktop/${icon.name}`,
                      type: icon.type === 'folder' ? 'folder' : 'file',
                      parentId: 'D:/Desktop',
                      modified: formatDateISO(new Date()),
                    });
                  }
                }}
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => {
                  closeContextMenu();
                  const matchingFile = files.find((f) => f.path === icon.filePath || f.id === icon.id);
                  if (matchingFile) {
                    cutFile(matchingFile);
                  } else {
                    cutFile({
                      id: icon.id,
                      name: icon.name,
                      path: icon.filePath || `D:/Desktop/${icon.name}`,
                      type: icon.type === 'folder' ? 'folder' : 'file',
                      parentId: 'D:/Desktop',
                      modified: formatDateISO(new Date()),
                    });
                  }
                }}
              >
                <Scissors className="w-3.5 h-3.5 text-slate-500" />
                <span>Cut</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors font-medium"
                onClick={() => {
                  closeContextMenu();
                  deleteDesktopIcon(icon.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  window.dispatchEvent(new CustomEvent('start-inline-rename', { detail: { id: icon.id, type: 'icon' } }));
                }}
              >
                <Edit className="w-3.5 h-3.5 text-slate-500" />
                <span>Rename</span>
              </button>

              {/* Compress to ZIP for desktop file/folder */}
              {icon.type !== 'app' && (
                <button
                  className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-amber-500 font-medium"
                  onClick={() => {
                    closeContextMenu();
                    const matchingFile = files.find((f) => f.path === icon.filePath || f.id === icon.id);
                    if (matchingFile) {
                      compressToZip(matchingFile, 'D:/Desktop');
                    } else {
                      compressToZip({
                        id: icon.id,
                        name: icon.name,
                        path: icon.filePath || `D:/Desktop/${icon.name}`,
                        type: icon.type === 'folder' ? 'folder' : 'file',
                        parentId: 'D:/Desktop',
                        modified: formatDateISO(new Date()),
                      }, 'D:/Desktop');
                    }
                  }}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Compress to ZIP file</span>
                </button>
              )}

              {/* Extract All if desktop ZIP */}
              {(icon.name.toLowerCase().endsWith('.zip') || icon.filePath?.toLowerCase().endsWith('.zip')) && (
                <button
                  className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-emerald-500/15 text-emerald-500 rounded-lg transition-colors cursor-pointer font-medium"
                  onClick={() => {
                    closeContextMenu();
                    const matchingFile = files.find((f) => f.path === icon.filePath || f.id === icon.id);
                    if (matchingFile) {
                      extractZip(matchingFile, 'D:/Desktop');
                    }
                  }}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Extract All...</span>
                </button>
              )}

              {/* Set as Desktop / Lock screen Wallpaper for Desktop Image or Video files */}
              {icon.type !== 'app' &&
                icon.type !== 'folder' &&
                icon.filePath &&
                ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'tiff', 'bmp', 'heic', 'mp4', 'webm', 'mov', 'mkv', 'avi'].some(
                  (ext) => icon.filePath?.toLowerCase().endsWith(`.${ext}`)
                ) && (
                  <>
                    <button
                      className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg transition-colors cursor-pointer font-medium"
                      onClick={() => {
                        closeContextMenu();
                        const matchingFile = files.find((f) => f.path === icon.filePath || f.id === icon.id);
                        const wallUrl = matchingFile?.content || icon.filePath!;
                        updateSettings({
                          wallpaper: 'custom',
                          customWallpaperUrl: wallUrl,
                        });
                        addNotification({
                          title: 'Desktop Background Updated',
                          message: `Set "${icon.name}" as desktop background`,
                          type: 'success',
                        });
                      }}
                    >
                      <Monitor className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Set as desktop background</span>
                    </button>

                    <button
                      className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer font-medium"
                      onClick={() => {
                        closeContextMenu();
                        const matchingFile = files.find((f) => f.path === icon.filePath || f.id === icon.id);
                        const wallUrl = matchingFile?.content || icon.filePath!;
                        updateSettings({
                          lockScreenWallpaper: 'custom',
                          customLockScreenUrl: wallUrl,
                        });
                        addNotification({
                          title: 'Lock Screen Background Updated',
                          message: `Set "${icon.name}" as lock screen background`,
                          type: 'success',
                        });
                      }}
                    >
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Set as lock screen background</span>
                    </button>
                  </>
                )}

              <div className="my-1 border-t border-slate-200 dark:border-white/10" />

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => {
                  closeContextMenu();
                  openProperties({
                    name: icon.name,
                    type: icon.type === 'app' ? 'Application Shortcut' : icon.type === 'folder' ? 'Folder' : 'File',
                    location: icon.filePath || 'D:/Desktop',
                    size: '1.2 KB',
                  });
                }}
              >
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Properties</span>
              </button>
            </div>
          );
        })()}

        {/* ================= 3. FILE EXPLORER EMPTY SPACE ================= */}
        {contextMenu.type === 'explorer-space' && (
          (() => {
            const isDDrivePath = /^D:(?:\/|$)/i.test(contextMenu.currentPath.replace(/\\/g, '/'));
            return (
              <div className="px-1.5 space-y-0.5">
            <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={handleRefresh}
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
              <span>Refresh</span>
            </button>

            {!isDDrivePath && <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => handleNewFolderClick(contextMenu.currentPath)}
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
              <span>New Folder</span>
            </button>}

            {!isDDrivePath && <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => handleNewFileClick(contextMenu.currentPath)}
            >
              <FilePlus className="w-3.5 h-3.5 text-emerald-500" />
              <span>New Document</span>
            </button>}

            {clipboard && !isDDrivePath && (
              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-blue-500 font-medium cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  pasteFile(contextMenu.currentPath);
                }}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>
                  Paste {clipboard.files && clipboard.files.length > 1 ? `(${clipboard.files.length} items)` : `"${clipboard.file.name}"`}
                </span>
              </button>
            )}

            <div className="my-1 border-t border-slate-200 dark:border-white/10" />

            <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => {
                closeContextMenu();
                openProperties({
                  name: contextMenu.currentPath.split('/').pop() || 'Folder',
                  type: 'Folder',
                  location: contextMenu.currentPath,
                });
              }}
            >
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              <span>Properties</span>
            </button>
              </div>
            );
          })()
        )}

        {/* ================= 4. FILE OR FOLDER ITEM IN FILE EXPLORER ================= */}
        {contextMenu.type === 'explorer-item' && (() => {
          const { file, files: targetFiles } = contextMenu;
          const activeFiles = targetFiles && targetFiles.length > 0 ? targetFiles : [file];
          const isMulti = activeFiles.length > 1;
          const isFolder = file.type === 'folder';
          const canMutate = activeFiles.every((item) =>
            !item.readOnly && !/^D:(?:\/|$)/i.test(item.path.replace(/\\/g, '/'))
          );

          return (
            <div className="px-1.5 space-y-0.5">
              {/* Top Action Bar (Cut, Copy, Rename, Share, Delete) */}
              {(canMutate || !isMulti) && <div className="flex items-center justify-around p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-1.5 border border-slate-200 dark:border-white/10">
                {canMutate && <>
                <button
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  onClick={() => { closeContextMenu(); cutFile(activeFiles); }}
                  title={isMulti ? `Cut (${activeFiles.length} items)` : "Cut"}
                >
                  <Scissors className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  onClick={() => { closeContextMenu(); copyFile(activeFiles); }}
                  title={isMulti ? `Copy (${activeFiles.length} items)` : "Copy"}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                </>}
                {!isMulti && canMutate && (
                  <button
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    onClick={() => {
                      closeContextMenu();
                      window.dispatchEvent(new CustomEvent('start-inline-rename', { detail: { id: file.id, type: 'file' } }));
                    }}
                    title="Rename (F2)"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                )}
                {!isMulti && (
                  <button
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    onClick={() => {
                      closeContextMenu();
                      setSharingFile(file);
                    }}
                    title="Share"
                  >
                    <Share2 className="w-3.5 h-3.5 text-blue-500" />
                  </button>
                )}
                {canMutate && <button
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-red-500 transition-colors cursor-pointer"
                  onClick={() => {
                    closeContextMenu();
                    activeFiles.forEach((f) => deleteFile(f.id));
                  }}
                  title={isMulti ? `Delete (${activeFiles.length} items)` : "Delete"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>}
              </div>}

              {!isMulti && (
                <button
                  className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg font-semibold transition-colors cursor-pointer"
                  onClick={() => {
                    closeContextMenu();
                    if (isFolder) {
                      openApp('explorer', { path: file.path });
                    } else if (file.content?.startsWith('app:')) {
                      openApp(file.content.replace('app:', '') as AppId);
                    } else if (file.extension === 'pdf') {
                      openApp('resume', { initialResumeUrl: file.content });
                    } else if (isMediaFile(file.extension || file.name)) {
                      const sourceId = file.id.startsWith('virtual-ref-')
                        ? file.id.slice('virtual-ref-'.length)
                        : file.id;
                      openApp('photos', {
                        filePath: file.path,
                        initialMediaId: sourceId,
                        initialMediaUrl: file.id.startsWith('virtual-ref-') ? undefined : file.content,
                        initialMediaName: file.name,
                        initialMediaExtension: file.extension,
                      });
                    } else {
                      openApp('notepad', { filePath: file.path });
                    }
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                  <span>Open</span>
                </button>
              )}

              {canMutate && !isMulti && !isFolder && (file.extension === 'txt' || file.extension === 'md') && (
                <button
                  className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  onClick={() => {
                    closeContextMenu();
                    openApp('notepad', { filePath: file.path });
                  }}
                >
                  <Edit className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Edit in Notepad</span>
                </button>
              )}

              {!isMulti && isFolder && (
                <button
                  className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  onClick={() => {
                    closeContextMenu();
                    openApp('explorer', { path: file.path });
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                  <span>Open in New Window</span>
                </button>
              )}

              {canMutate && <button
                className="w-full text-left flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  cutFile(activeFiles);
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Scissors className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cut {isMulti ? `(${activeFiles.length} items)` : ''}</span>
                </div>
                <span className="text-[10px] text-slate-400">Ctrl+X</span>
              </button>}

              {canMutate && <button
                className="w-full text-left flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  copyFile(activeFiles);
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy {isMulti ? `(${activeFiles.length} items)` : ''}</span>
                </div>
                <span className="text-[10px] text-slate-400">Ctrl+C</span>
              </button>}

              {!isMulti && isFolder && canMutate && clipboard && (
                <button
                  className="w-full text-left flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-blue-500 font-medium cursor-pointer"
                  onClick={() => {
                    closeContextMenu();
                    pasteFile(file.path);
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>
                      Paste {clipboard.files && clipboard.files.length > 1 ? `(${clipboard.files.length} items)` : `"${clipboard.file.name}"`} into "{file.name}"
                    </span>
                  </div>
                  <span className="text-[10px]">Ctrl+V</span>
                </button>
              )}

              {!isMulti && canMutate && <button
                className="w-full text-left flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  window.dispatchEvent(new CustomEvent('start-inline-rename', { detail: { id: file.id, type: 'file' } }));
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rename</span>
                </div>
                <span className="text-[10px] text-slate-400">F2</span>
              </button>}

              {!isMulti && canMutate && <button
                className="w-full text-left flex items-center justify-between px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  deleteFile(file.id);
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </div>
                <span className="text-[10px] opacity-70">Del</span>
              </button>}

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  togglePinQuickAccess({ name: file.name, path: file.path, icon: isFolder ? 'Folder' : 'FileText' });
                }}
              >
                <Pin className="w-3.5 h-3.5 text-blue-500" />
                <span>Pin to Quick access</span>
              </button>

              {/* Set as desktop background & lock screen (for any image or video) */}
              {!isFolder &&
                ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'tiff', 'bmp', 'heic', 'mp4', 'webm', 'mov', 'mkv', 'avi'].includes(
                  (file.extension || '').toLowerCase()
                ) && (
                  <>
                    <button
                      className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg transition-colors cursor-pointer font-medium"
                      onClick={() => {
                        closeContextMenu();
                        updateSettings({
                          wallpaper: 'custom',
                          customWallpaperUrl: file.content || file.path,
                        });
                        addNotification({
                          title: 'Desktop Background Updated',
                          message: `Set "${file.name}" as desktop background`,
                          type: 'success',
                        });
                      }}
                    >
                      <Monitor className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Set as desktop background</span>
                    </button>

                    <button
                      className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer font-medium"
                      onClick={() => {
                        closeContextMenu();
                        updateSettings({
                          lockScreenWallpaper: 'custom',
                          customLockScreenUrl: file.content || file.path,
                        });
                        addNotification({
                          title: 'Lock Screen Background Updated',
                          message: `Set "${file.name}" as lock screen background`,
                          type: 'success',
                        });
                      }}
                    >
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Set as lock screen background</span>
                    </button>
                  </>
                )}

              {/* Compress to ZIP */}
              {canMutate && <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-amber-500 font-medium"
                onClick={() => {
                  closeContextMenu();
                  compressToZip(file);
                }}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Compress to ZIP file</span>
              </button>}

              {/* Extract All (if ZIP) */}
              {canMutate && (file.extension === 'zip' || file.name.toLowerCase().endsWith('.zip')) && (
                <button
                  className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-emerald-500/15 text-emerald-500 rounded-lg transition-colors cursor-pointer font-medium"
                  onClick={() => {
                    closeContextMenu();
                    extractZip(file);
                  }}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Extract All...</span>
                </button>
              )}

              <div className="my-1 border-t border-slate-200 dark:border-white/10" />

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  if (file.path === 'C:' || file.path === 'D:') {
                    const metrics = calculateDriveMetrics(files, driveLabels);
                    const drive = metrics.find((d) => d.path === file.path);
                    if (drive) {
                      openProperties({
                        name: drive.name,
                        type: 'Local Disk',
                        location: drive.path,
                        drivePath: drive.path,
                        usedGB: drive.usedFormatted,
                        freeGB: drive.freeFormatted,
                        totalGB: drive.totalFormatted,
                        fileSystem: 'NTFS',
                        created: 'August 10, 2026, 12:00:00 PM',
                        modified: 'August 13, 2026, 12:00:00 PM',
                      });
                    }
                  } else {
                    openProperties({
                      name: file.name,
                      type: isFolder ? 'Folder' : `${file.extension?.toUpperCase() || 'Text'} File`,
                      location: file.path,
                      size: file.size || '1.0 KB',
                      modified: file.modified,
                    });
                  }
                }}
              >
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Properties</span>
              </button>
            </div>
          );
        })()}

        {/* ================= 5. TASKBAR EMPTY SPACE ================= */}
        {contextMenu.type === 'taskbar-space' && (
          <div className="px-1.5 space-y-0.5">
            <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => {
                closeContextMenu();
                openApp('taskmanager');
              }}
            >
              <Cpu className="w-3.5 h-3.5 text-blue-500" />
              <span>Task Manager</span>
            </button>

            <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => {
                closeContextMenu();
                updateSettings({ taskbarAutoHide: !settings.taskbarAutoHide });
              }}
            >
              <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
              <span>{settings.taskbarAutoHide ? 'Unhide Taskbar (Always Visible)' : 'Auto-hide Taskbar'}</span>
            </button>

            <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => {
                closeContextMenu();
                openApp('settings');
              }}
            >
              <Sliders className="w-3.5 h-3.5 text-purple-500" />
              <span>Taskbar Settings</span>
            </button>

            <div className="my-1 border-t border-slate-200 dark:border-white/10" />

            <button
              className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => {
                closeContextMenu();
                showDesktop();
              }}
            >
              <Monitor className="w-3.5 h-3.5 text-sky-500" />
              <span>Show Desktop</span>
            </button>
          </div>
        )}

        {/* ================= 6. TASKBAR APPLICATION ICON ================= */}
        {contextMenu.type === 'taskbar-app' && (() => {
          const { appId } = contextMenu;
          const appMeta = APPS_LIST.find((a) => a.id === appId);
          const activeWin = windows.find((w) => w.appId === appId);
          const isPinned = pinnedAppIds.includes(appId);

          return (
            <div className="px-1.5 space-y-0.5">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {appMeta?.name || appId}
              </div>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg font-medium transition-colors"
                onClick={() => {
                  closeContextMenu();
                  openApp(appId);
                }}
              >
                <Play className="w-3.5 h-3.5 text-emerald-500" />
                <span>{activeWin ? 'Focus Window' : 'Open'}</span>
              </button>

              {activeWin && (
                <>
                  <button
                    className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    onClick={() => {
                      closeContextMenu();
                      minimizeWindow(activeWin.id);
                    }}
                  >
                    <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Minimize</span>
                  </button>

                  <button
                    className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    onClick={() => {
                      closeContextMenu();
                      maximizeWindow(activeWin.id);
                    }}
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{activeWin.isMaximized ? 'Restore' : 'Maximize'}</span>
                  </button>

                  <button
                    className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    onClick={() => {
                      closeContextMenu();
                      closeWindow(activeWin.id);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Close Window</span>
                  </button>
                </>
              )}

              <div className="my-1 border-t border-slate-200 dark:border-white/10" />

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => {
                  closeContextMenu();
                  if (isPinned) unpinFromTaskbar(appId);
                  else pinToTaskbar(appId);
                }}
              >
                {isPinned ? (
                  <>
                    <PinOff className="w-3.5 h-3.5 text-amber-500" />
                    <span>Unpin from Taskbar</span>
                  </>
                ) : (
                  <>
                    <Pin className="w-3.5 h-3.5 text-blue-500" />
                    <span>Pin to Taskbar</span>
                  </>
                )}
              </button>
            </div>
          );
        })()}

        {/* ================= 7. START MENU APPLICATION ICON ================= */}
        {contextMenu.type === 'start-app' && (() => {
          const { appId } = contextMenu;
          const appMeta = APPS_LIST.find((a) => a.id === appId);
          const isPinnedStart = isPinnedToStart(appId);
          const isPinnedTaskbar = pinnedAppIds.includes(appId);

          return (
            <div className="px-1.5 space-y-0.5">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {appMeta?.name || appId}
              </div>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg font-medium transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  openApp(appId);
                }}
              >
                <Play className="w-3.5 h-3.5 text-emerald-500" />
                <span>Open</span>
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  if (isPinnedStart) unpinFromStart(appId);
                  else pinToStart(appId);
                }}
              >
                {isPinnedStart ? (
                  <>
                    <PinOff className="w-3.5 h-3.5 text-amber-500" />
                    <span>Unpin from Start</span>
                  </>
                ) : (
                  <>
                    <Pin className="w-3.5 h-3.5 text-blue-500" />
                    <span>Pin to Start</span>
                  </>
                )}
              </button>

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  if (isPinnedTaskbar) unpinFromTaskbar(appId);
                  else pinToTaskbar(appId);
                }}
              >
                {isPinnedTaskbar ? (
                  <>
                    <PinOff className="w-3.5 h-3.5 text-amber-500" />
                    <span>Unpin from Taskbar</span>
                  </>
                ) : (
                  <>
                    <Pin className="w-3.5 h-3.5 text-blue-500" />
                    <span>Pin to Taskbar</span>
                  </>
                )}
              </button>

              <div className="my-1 border-t border-slate-200 dark:border-white/10" />

              <button
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  closeContextMenu();
                  openProperties({
                    name: appMeta?.name || appId,
                    type: 'Portfolio Application',
                    location: 'Portfolio OS applications',
                    size: '2.4 MB',
                  });
                }}
              >
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Properties</span>
              </button>
            </div>
          );
        })()}
      </div>)}

      {/* RENAME DIALOG MODAL */}
      {renamePrompt && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="w-80 bg-slate-900 border border-white/20 rounded-2xl p-4 shadow-2xl space-y-3 text-slate-100 text-xs select-none">
            <div className="font-semibold text-sm">Rename Item</div>
            <input
              type="text"
              autoFocus
              value={promptInput || ''}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRenameConfirm();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setRenamePrompt(null);
                }
              }}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 text-slate-100"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRenamePrompt(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameConfirm}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW ITEM DIALOG MODAL */}
      {newPrompt && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="w-80 bg-slate-900 border border-white/20 rounded-2xl p-4 shadow-2xl space-y-3 text-slate-100 text-xs select-none">
            <div className="font-semibold text-sm">
              Create New {newPrompt.type === 'folder' ? 'Folder' : 'Text Document'}
            </div>
            <input
              type="text"
              autoFocus
              value={promptInput || ''}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateConfirm()}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 text-slate-100"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setNewPrompt(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConfirm}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SHARE DIALOG MODAL */}
      <ShareModal
        file={sharingFile}
        isOpen={!!sharingFile}
        onClose={() => setSharingFile(null)}
      />
    </>
  );
};
