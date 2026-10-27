import React, { useState, useMemo } from 'react';
import { useOS } from '../../context/OSContext';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  LayoutGrid,
  List,
  Clock,
  Search,
  CheckSquare,
  Square,
  Film,
  Music,
  Code,
  Archive,
  Image as ImageIcon,
} from 'lucide-react';
import { FileItem } from '../../types';
import { MediaThumbnail, getMediaPreviewUrl } from '../common/MediaThumbnail';
import { AppIcon } from '../common/AppIcon';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const RecycleBinApp: React.FC = () => {
  const { deletedFiles, restoreFile, deletePermanently, emptyRecycleBin, openProperties } = useOS();
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [iconSize, setIconSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Deduplicate deleted files to ensure every file is unique
  const uniqueDeletedFiles = useMemo(() => {
    const seenIds = new Set<string>();
    const seenPaths = new Set<string>();
    const result: FileItem[] = [];
    for (const item of deletedFiles) {
      if (!item || !item.id) continue;
      if (!seenIds.has(item.id) && !seenPaths.has(item.path)) {
        seenIds.add(item.id);
        seenPaths.add(item.path);
        result.push(item);
      }
    }
    return result;
  }, [deletedFiles]);

  // Filtered files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return uniqueDeletedFiles;
    const q = searchQuery.toLowerCase().trim();
    return uniqueDeletedFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.path && f.path.toLowerCase().includes(q)) ||
        (f.extension && f.extension.toLowerCase().includes(q))
    );
  }, [uniqueDeletedFiles, searchQuery]);

  const handleRestoreAll = () => {
    uniqueDeletedFiles.forEach((file) => {
      restoreFile(file.id);
    });
    setSelectedIds(new Set());
  };

  const handleRestoreSelected = () => {
    selectedIds.forEach((id) => {
      restoreFile(id);
    });
    setSelectedIds(new Set());
  };

  const handleDeletePending = () => {
    pendingDeleteIds.forEach((id) => {
      deletePermanently(id);
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pendingDeleteIds.forEach((id) => next.delete(id));
      return next;
    });
    setPendingDeleteIds([]);
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const getDaysLeft = (deletedAt?: number) => {
    if (!deletedAt) return 30;
    const elapsed = Date.now() - deletedAt;
    const daysLeft = Math.ceil((THIRTY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(30, daysLeft));
  };

  const isImageFile = (item: FileItem) => {
    const ext = (item.extension || '').toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'].includes(ext);
  };

  const isVideoFile = (item: FileItem) => {
    const ext = (item.extension || '').toLowerCase();
    return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv'].includes(ext);
  };

  const isAudioFile = (item: FileItem) => {
    const ext = (item.extension || '').toLowerCase();
    return ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
  };

  const isCodeFile = (item: FileItem) => {
    const ext = (item.extension || '').toLowerCase();
    return ['ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'py', 'sh', 'c', 'cpp'].includes(ext);
  };

  const isArchiveFile = (item: FileItem) => {
    const ext = (item.extension || '').toLowerCase();
    return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
  };

  const renderFileIcon = (item: FileItem, sizeClass = 'w-10 h-10') => {
    if (item.type === 'folder') {
      return <AppIcon name="Folder" size={40} className="shrink-0" />;
    }
    if (isImageFile(item)) {
      return <ImageIcon className={`${sizeClass} text-emerald-400`} />;
    }
    if (isVideoFile(item)) {
      return <Film className={`${sizeClass} text-purple-400`} />;
    }
    if (isAudioFile(item)) {
      return <Music className={`${sizeClass} text-pink-400`} />;
    }
    if (isCodeFile(item)) {
      return <Code className={`${sizeClass} text-amber-400`} />;
    }
    if (isArchiveFile(item)) {
      return <Archive className={`${sizeClass} text-orange-400`} />;
    }
    if (item.extension === 'pdf') {
      return <FileText className={`${sizeClass} text-red-400`} />;
    }
    return <FileText className={`${sizeClass} text-cyan-400`} />;
  };

  return (
    <div
      className="flex flex-col h-full bg-slate-100 dark:bg-[#0b111e] text-slate-800 dark:text-slate-100 select-none overflow-hidden font-sans"
      onClick={() => setSelectedIds(new Set())}
    >
      {/* Top Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-6 py-3 border-b border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#0e1626]/95 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400 shrink-0 shadow-sm">
            <AppIcon name="Recycle Bin" size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Recycle Bin</h1>
              {selectedIds.size > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              <span>{uniqueDeletedFiles.length} deleted item(s)</span>
              <span className="mx-1.5 opacity-40">•</span>
              <span>Items auto-purged after 30 days</span>
            </p>
          </div>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Search bar */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Recycle Bin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-blue-500 focus:bg-white dark:focus:bg-white/10 outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 w-44 sm:w-56 transition-all"
            />
          </div>

          {selectedIds.size > 0 ? (
            <>
              <button
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                onClick={handleRestoreSelected}
                title="Restore selected items"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restore ({selectedIds.size})
              </button>
              <button
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 text-xs font-semibold border border-red-500/30 transition-all cursor-pointer"
                onClick={() => setPendingDeleteIds(Array.from(selectedIds))}
                title="Permanently delete selected items"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.size})
              </button>
            </>
          ) : (
            uniqueDeletedFiles.length > 0 && (
              <button
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold border border-blue-500/30 transition-all cursor-pointer"
                onClick={handleRestoreAll}
                title="Restore all items to their original locations"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restore All
              </button>
            )
          )}

          <button
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={uniqueDeletedFiles.length === 0}
            onClick={() => setShowConfirmEmpty(true)}
          >
            <Trash2 className="w-3.5 h-3.5" /> Empty Bin
          </button>
        </div>
      </div>

      {/* Subheader Toolbar with [✓] Select All & Segmented Size (Small | Medium | Large) */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 py-2 bg-slate-200/80 dark:bg-[#090e1a] border-b border-slate-300 dark:border-white/10 shrink-0 overflow-x-auto scrollbar-none gap-2 text-slate-800 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {/* [✓] Select All Pill Button - appears when item is selected */}
          {selectedIds.size > 0 && (
            <button
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                selectedIds.size === filteredFiles.length && filteredFiles.length > 0
                  ? 'bg-blue-600/30 text-blue-600 dark:text-blue-300 border-blue-500/50 shadow-sm'
                  : 'bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-white/10'
              }`}
              onClick={handleSelectAll}
              title="Select or deselect all items"
            >
              <CheckSquare className={`w-4 h-4 ${selectedIds.size === filteredFiles.length && filteredFiles.length > 0 ? 'text-blue-500' : 'text-slate-400'}`} />
              <span>{selectedIds.size === filteredFiles.length ? 'Deselect All' : 'Select All'}</span>
            </button>
          )}

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {selectedIds.size > 0 ? `${selectedIds.size} of ${filteredFiles.length} selected` : `${filteredFiles.length} item(s)`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Small | Medium | Large Segmented Control Pill */}
          <div className="flex items-center p-0.5 rounded-full bg-slate-300/60 dark:bg-black/50 border border-slate-300 dark:border-white/10 text-xs">
            <button
              onClick={() => setIconSize('small')}
              className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                iconSize === 'small'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Small
            </button>
            <button
              onClick={() => setIconSize('medium')}
              className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                iconSize === 'medium'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setIconSize('large')}
              className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                iconSize === 'large'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Large
            </button>
          </div>

          {/* View Mode Toggle (Grid / List) */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-300/60 dark:bg-black/40 border border-slate-300 dark:border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white dark:bg-white/20 text-blue-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white dark:bg-white/20 text-blue-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Files Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="w-full rounded-2xl bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col min-h-full">
          {uniqueDeletedFiles.length === 0 ? (
            <div className="my-auto py-24 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-slate-500 border border-white/5">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-200">The Recycle Bin is empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Files deleted from File Explorer, Desktop, or Apps will temporarily rest here for 30 days before being permanently removed.
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="my-auto py-20 text-center space-y-2">
              <Search className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No items match "{searchQuery}"</p>
              <p className="text-xs text-slate-500">Check for spelling mistakes or clear your search.</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* ================= GRID VIEW WITH DYNAMIC ICON SIZE ================= */
            <div
              className={`p-4 grid auto-rows-max ${
                iconSize === 'small'
                  ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5'
                  : iconSize === 'large'
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5'
              }`}
            >
              {filteredFiles.map((item) => {
                const daysRemaining = getDaysLeft(item.deletedAt);
                const isSelected = selectedIds.has(item.id);
                const isMedia = isImageFile(item) || isVideoFile(item);
                const previewUrl = getMediaPreviewUrl(item);

                return (
                  <div
                    key={item.id}
                    onClick={(e) => handleToggleSelect(item.id, e)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      restoreFile(item.id);
                    }}
                    className={`group relative rounded-xl border transition-all flex flex-col overflow-hidden cursor-pointer select-none bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-50 dark:bg-blue-500/10 shadow-lg shadow-blue-500/10'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    {/* Select Checkbox Indicator */}
                    <button
                      className={`absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-blue-500 text-white shadow'
                          : 'bg-black/50 text-white/50 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white'
                      }`}
                      onClick={(e) => handleToggleSelect(item.id, e)}
                      title={isSelected ? 'Deselect item' : 'Select item'}
                    >
                      {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    </button>

                    {/* Quick Action Overlay (Restore / Delete) */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white shadow-md transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreFile(item.id);
                        }}
                        title="Restore this file"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white shadow-md transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteIds([item.id]);
                        }}
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Thumbnail / Visual Preview Box */}
                    <div
                      className={`w-full bg-black/40 relative flex items-center justify-center overflow-hidden border-b border-white/5 ${
                        iconSize === 'small' ? 'aspect-[1/1]' : iconSize === 'large' ? 'aspect-[16/10]' : 'aspect-[4/3]'
                      }`}
                    >
                      {isMedia && previewUrl ? (
                        <div className="w-full h-full relative group-hover:scale-105 transition-transform duration-300">
                          <MediaThumbnail item={item} className="w-full h-full object-cover" />
                          {/* File extension badge */}
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider text-slate-200 border border-white/10">
                            {item.extension || 'media'}
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 flex flex-col items-center justify-center gap-1 group-hover:scale-110 transition-transform">
                          {renderFileIcon(item, iconSize === 'small' ? 'w-7 h-7' : iconSize === 'large' ? 'w-14 h-14' : 'w-10 h-10')}
                          {item.extension && (
                            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono uppercase text-slate-400 border border-white/5">
                              .{item.extension}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* File Meta Info */}
                    <div className="p-2.5 flex flex-col flex-1 justify-between gap-1.5">
                      <div>
                        <p
                          className={`font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors ${
                            iconSize === 'small' ? 'text-[11px]' : iconSize === 'large' ? 'text-sm' : 'text-xs'
                          }`}
                          title={item.name}
                        >
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono" title={item.path || item.parentId}>
                          {item.path || item.parentId || 'Desktop'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-white/5 text-[10px]">
                        <span className="text-slate-500 dark:text-slate-400 font-mono">
                          {item.size || (item.type === 'folder' ? 'Folder' : '518.1 KB')}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${
                            daysRemaining <= 5
                              ? 'bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/30'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" /> {daysRemaining}d
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= LIST VIEW WITH MINI THUMBNAILS ================= */
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 text-[11px] font-bold tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <button
                      className="p-1 rounded hover:bg-white/10 text-slate-400 cursor-pointer"
                      onClick={handleSelectAll}
                      title="Select all"
                    >
                      {selectedIds.size === filteredFiles.length && filteredFiles.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Original Location</th>
                  <th className="py-3 px-4">Item Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Auto-Delete Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredFiles.map((item) => {
                  const daysRemaining = getDaysLeft(item.deletedAt);
                  const isSelected = selectedIds.has(item.id);
                  const isMedia = isImageFile(item) || isVideoFile(item);

                  return (
                    <tr
                      key={item.id}
                      onClick={(e) => handleToggleSelect(item.id, e)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        restoreFile(item.id);
                      }}
                      className={`transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/15 font-semibold text-white'
                          : 'hover:bg-white/[0.04] text-slate-200'
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="p-1 rounded hover:bg-white/10 text-slate-400 cursor-pointer"
                          onClick={() => handleToggleSelect(item.id)}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 flex items-center gap-3 font-medium">
                        {/* Mini Thumbnail or Icon */}
                        <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {isMedia ? (
                            <MediaThumbnail item={item} className="w-full h-full object-cover" />
                          ) : (
                            renderFileIcon(item, 'w-4 h-4')
                          )}
                        </div>
                        <span className="truncate max-w-[220px] font-semibold">{item.name}</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] truncate max-w-[240px]">
                        {item.path || item.parentId || 'Desktop'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 capitalize">{item.type}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{item.size || '518.1 KB'}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            daysRemaining <= 5
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          <Clock className="w-3 h-3" /> {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-semibold text-xs transition-all cursor-pointer"
                            onClick={() => restoreFile(item.id)}
                            title="Restore file"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white font-semibold text-xs transition-all cursor-pointer"
                            onClick={() => setPendingDeleteIds([item.id])}
                            title="Permanently delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Empty Bin Confirmation Modal */}
      {showConfirmEmpty && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Empty Recycle Bin?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  Are you sure you want to permanently delete all {uniqueDeletedFiles.length} item(s)? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-colors"
                onClick={() => setShowConfirmEmpty(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-red-600/20"
                onClick={() => {
                  emptyRecycleBin();
                  setShowConfirmEmpty(false);
                }}
              >
                Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected / Single Confirmation Modal */}
      {pendingDeleteIds.length > 0 && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {pendingDeleteIds.length === 1 ? 'Permanently Delete Item?' : 'Permanently Delete Selected Items?'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  {pendingDeleteIds.length === 1
                    ? 'Are you sure you want to permanently delete this item? This action cannot be undone.'
                    : `Are you sure you want to permanently delete the ${pendingDeleteIds.length} selected item(s)? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-colors"
                onClick={() => setPendingDeleteIds([])}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-red-600/20"
                onClick={handleDeletePending}
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
