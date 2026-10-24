import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOS } from '../../context/OSContext';
import { useVirtualDDriveFiles } from '../../hooks/useVirtualDDriveFiles';
import { calculateDriveMetrics } from '../../utils/storageMetrics';
import { FileItem } from '../../types';
import { D_DRIVE_FOLDER_PATHS } from '../../utils/virtualDDrive';
import { VirtualDriveIcon } from './VirtualDriveIcon';
import {
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Search,
  Monitor,
  HardDrive,
  Folder,
  FileText,
  Copy,
  CheckCheck,
  RefreshCw,
  FolderPlus,
  ChevronDown,
  LayoutGrid,
  FileCode,
  Image as ImageIcon,
  Film,
  Music,
  Trash2,
  FileArchive,
  ChevronRight,
  Menu,
} from 'lucide-react';

export interface SaveAsFileType {
  label: string;
  ext: string;
}

export interface SaveAsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'save' | 'open';
  isDark?: boolean;
  onSave?: (path: string, fileName: string, fileType: string, encoding: string) => void;
  onOpen?: (file: FileItem) => void;
  initialLocation?: string;
  initialFileName?: string;
  initialFileType?: string;
  fileTypes?: SaveAsFileType[];
  title?: string;
}

export const DEFAULT_FILE_TYPES: SaveAsFileType[] = [
  { label: 'All Files (*.*)', ext: '*' },
  { label: 'Text Documents (*.txt)', ext: 'txt' },
  { label: 'Markdown Files (*.md)', ext: 'md' },
  { label: 'JSON Files (*.json)', ext: 'json' },
  { label: 'JavaScript Files (*.js; *.jsx)', ext: 'js;jsx' },
  { label: 'TypeScript Files (*.ts; *.tsx)', ext: 'ts;tsx' },
  { label: 'HTML Documents (*.html; *.htm)', ext: 'html;htm' },
  { label: 'CSS Stylesheets (*.css)', ext: 'css' },
  { label: 'Python Files (*.py)', ext: 'py' },
  { label: 'SQL Scripts (*.sql)', ext: 'sql' },
];

const NOTEPAD_SUPPORTED_EXTENSIONS = new Set([
  'txt', 'md', 'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json',
  'py', 'java', 'c', 'cpp', 'h', 'sql', 'xml', 'yaml', 'yml',
]);
const ENCODING_OPTIONS = ['UTF-8', 'UTF-8 with BOM', 'UTF-16 LE', 'ANSI'];

export const SaveAsModal: React.FC<SaveAsModalProps> = ({
  isOpen,
  onClose,
  mode = 'save',
  isDark = true,
  onSave,
  onOpen,
  initialLocation = 'This PC',
  initialFileName = 'Untitled.txt',
  initialFileType = 'All Files (*.*)',
  fileTypes = DEFAULT_FILE_TYPES,
  title,
}) => {
  const { files: storedFiles, createFile, createFolder, deleteFile, renameFile, driveLabels, addNotification } = useOS();
  const files = useVirtualDDriveFiles(storedFiles, (title, message) => {
    addNotification({ title, message, type: 'warning' });
  }, isOpen);

  const [currentLocation, setCurrentLocation] = useState<string>(initialLocation);
  const [history, setHistory] = useState<string[]>([initialLocation]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileName, setFileName] = useState<string>(initialFileName);
  const [selectedFileType, setSelectedFileType] = useState<string>(initialFileType);
  const [encoding, setEncoding] = useState<string>('UTF-8');
  const [showEncodingDropdown, setShowEncodingDropdown] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isEditingAddress, setIsEditingAddress] = useState<boolean>(false);
  const [addressInput, setAddressInput] = useState<string>('');
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [showOrganizeDropdown, setShowOrganizeDropdown] = useState<boolean>(false);
  const [showViewDropdown, setShowViewDropdown] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'icons' | 'list' | 'details' | 'tiles'>('tiles');
  const [showNewFolderInput, setShowNewFolderInput] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [hideFolders, setHideFolders] = useState<boolean>(false);

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameInputName, setRenameInputName] = useState<string>('');

  const addressInputRef = useRef<HTMLInputElement>(null);
  const organizeDropdownRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const encodingDropdownRef = useRef<HTMLDivElement>(null);
  const shouldRenameNextNewFolder = useRef<boolean>(false);

  // Click outside dropdowns listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showOrganizeDropdown && organizeDropdownRef.current && !organizeDropdownRef.current.contains(target)) {
        setShowOrganizeDropdown(false);
      }
      if (showViewDropdown && viewDropdownRef.current && !viewDropdownRef.current.contains(target)) {
        setShowViewDropdown(false);
      }
      if (encodingDropdownRef.current && !encodingDropdownRef.current.contains(target)) {
        setShowEncodingDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOrganizeDropdown, showViewDropdown]);

  useEffect(() => {
    if (!accessDeniedMessage) return;
    const timeout = window.setTimeout(() => setAccessDeniedMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [accessDeniedMessage]);

  // Sync new folder creation to inline rename
  const prevFilesLength = useRef<number>(storedFiles.length);
  useEffect(() => {
    if (storedFiles.length > prevFilesLength.current) {
      if (shouldRenameNextNewFolder.current) {
        shouldRenameNextNewFolder.current = false;
        const parent = currentLocation === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentLocation;
        // Find the folder inside parent that is most recently created (highest timestamp in ID)
        const folder = storedFiles
          .filter((f) => f.type === 'folder' && f.parentId === parent)
          .sort((a, b) => b.id.localeCompare(a.id))[0];
        if (folder) {
          setRenamingFolderId(folder.id);
          setRenameInputName(folder.name);
        }
      }
    }
    prevFilesLength.current = storedFiles.length;
  }, [storedFiles, currentLocation]);

  // Sync initial location & file name on open
  useEffect(() => {
    if (isOpen) {
      setCurrentLocation(initialLocation);
      setHistory([initialLocation]);
      setHistoryIndex(0);
      setFileName(initialFileName);
      setSelectedFile(null);
      setSearchQuery('');
      setAccessDeniedMessage(null);
      setShowEncodingDropdown(false);
      setIsEditingAddress(false);
      setShowNewFolderInput(false);
      setRenamingFolderId(null);
      
      // Auto-hide folders sidebar on small screen (mobile)
      if (window.innerWidth < 640) {
        setHideFolders(true);
      } else {
        setHideFolders(false);
      }
    }
  }, [isOpen, initialLocation, initialFileName]);

  // Synchronize drive storage metrics
  const drivesData = useMemo(() => calculateDriveMetrics(files, driveLabels), [files, driveLabels]);

  const navigateTo = (newPath: string) => {
    if (newPath === currentLocation) return;
    if (/^C:(?:\/|$)/i.test(newPath.replace(/\\/g, '/').trim())) {
      const message = 'Access to the C: drive is restricted in this portfolio.';
      setAccessDeniedMessage(message);
      addNotification({
        title: 'Access Denied',
        message,
        type: 'warning',
      });
      return;
    }
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPath);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentLocation(newPath);
    setSelectedFile(null);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentLocation(target);
      setSelectedFile(null);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentLocation(target);
      setSelectedFile(null);
    }
  };

  const handleUp = () => {
    if (currentLocation === 'This PC') return;
    const parts = currentLocation.split('/').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      navigateTo(parts.join('/'));
    } else {
      navigateTo('This PC');
    }
  };

  // Compute breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (currentLocation === 'This PC') {
      return [{ label: 'This PC', path: 'This PC', type: 'pc' }];
    }
    const segments = currentLocation.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; path: string; type: 'pc' | 'drive' | 'folder' }> = [
      { label: 'This PC', path: 'This PC', type: 'pc' },
    ];
    let accum = '';
    segments.forEach((seg, idx) => {
      accum += (idx === 0 ? '' : '/') + seg;
      const isDrive = idx === 0 && /^[A-Za-z]:?$/.test(seg);
      const driveKey = seg.substring(0, 2).toUpperCase();
      const driveLabel = driveLabels[driveKey] || (driveKey === 'C:' ? 'Local Disk' : 'New Volume');
      crumbs.push({
        label: isDrive ? `${driveLabel} (${seg.endsWith(':') ? seg : `${seg}:`})` : seg,
        path: accum,
        type: isDrive ? 'drive' : 'folder',
      });
    });
    return crumbs;
  }, [currentLocation, driveLabels]);

  if (!isOpen) return null;

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingAddress(false);
    const target = addressInput.trim().replace(/\\/g, '/');
    if (!target || target.toLowerCase() === 'this pc') {
      navigateTo('This PC');
      return;
    }
    if (/^C:(?:\/|$)/i.test(target)) {
      navigateTo(target);
      return;
    }
    const exists = files.some((f) => f.path.toLowerCase() === target.toLowerCase());
    if (exists || target.toUpperCase() === 'D:' || target.toUpperCase() === 'D:/') {
      navigateTo(target.toUpperCase() === 'D:/' ? 'D:' : target);
    } else {
      addNotification({
        title: 'Location Not Found',
        message: `Windows cannot find '${addressInput}'. Check spelling.`,
        type: 'warning',
      });
    }
  };

  const handleCopyPath = () => {
    const formatted = currentLocation === 'This PC' ? 'This PC' : currentLocation.replace(/\//g, '\\');
    navigator.clipboard.writeText(formatted);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
    addNotification({ title: 'Path Copied', message: formatted, type: 'info' });
  };

  const handleCreateNewFolder = () => {
    const parent = currentLocation === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentLocation;
    shouldRenameNextNewFolder.current = true;
    createFolder(parent, 'New folder');
  };

  const handleConfirmAction = () => {
    if (mode === 'open') {
      if (selectedFile) {
        if (selectedFile.type === 'folder') {
          navigateTo(selectedFile.path);
          return;
        }
        const extension = (selectedFile.extension || selectedFile.name.split('.').pop() || '').toLowerCase();
        if (!NOTEPAD_SUPPORTED_EXTENSIONS.has(extension)) {
          addNotification({
            title: 'Unsupported file type',
            message: 'Notepad can open text, Markdown, and programming files only.',
            type: 'warning',
          });
          return;
        }
        if (onOpen) onOpen(selectedFile);
        onClose();
        return;
      }
      // Check if typed name matches any file in current directory
      const norm = currentLocation.replace(/\/$/, '');
      const match = files.find(
        (f) =>
          !f.deletedAt &&
          (f.parentId || '').replace(/\/$/, '') === norm &&
          f.name.toLowerCase() === fileName.trim().toLowerCase() &&
          NOTEPAD_SUPPORTED_EXTENSIONS.has((f.extension || f.name.split('.').pop() || '').toLowerCase())
      );
      if (match) {
        if (match.type === 'folder') {
          navigateTo(match.path);
        } else {
          if (onOpen) onOpen(match);
          onClose();
        }
      } else {
        addNotification({
          title: 'File Not Found',
          message: `"${fileName}" does not exist in ${currentLocation}.`,
          type: 'warning',
        });
      }
    } else {
      // Save Mode
      let finalName = fileName.trim();
      if (!finalName) finalName = 'Untitled.txt';

      const chosenType = fileTypes.find((t) => t.label === selectedFileType);
      const defaultExtension = chosenType?.ext.split(';')[0]?.trim().replace(/^\*\./, '');
      if (chosenType && chosenType.ext !== '*' && !finalName.includes('.') && defaultExtension) {
        finalName = `${finalName}.${defaultExtension}`;
      }
      const finalExtension = finalName.split('.').pop()?.toLowerCase() || '';
      if (!NOTEPAD_SUPPORTED_EXTENSIONS.has(finalExtension)) {
        addNotification({
          title: 'Unsupported file type',
          message: 'Notepad can save text, Markdown, and programming files only.',
          type: 'warning',
        });
        return;
      }

      const targetDir = currentLocation === 'This PC' ? D_DRIVE_FOLDER_PATHS.documents : currentLocation;
      if (onSave) {
        onSave(targetDir, finalName, selectedFileType, encoding);
      }
      onClose();
    }
  };

  const quickAccessDirs = [
    { id: 'desktop', name: 'Desktop', path: D_DRIVE_FOLDER_PATHS.desktop, icon: Monitor },
    { id: 'documents', name: 'Documents', path: D_DRIVE_FOLDER_PATHS.documents, icon: Folder },
    { id: 'downloads', name: 'Downloads', path: D_DRIVE_FOLDER_PATHS.downloads, icon: Folder },
    { id: 'pictures', name: 'Pictures', path: D_DRIVE_FOLDER_PATHS.pictures, icon: ImageIcon },
    { id: 'music', name: 'Audio', path: D_DRIVE_FOLDER_PATHS.audio, icon: Music },
    { id: 'videos', name: 'Videos', path: D_DRIVE_FOLDER_PATHS.videos, icon: Film },
    { id: 'projects', name: 'Projects', path: D_DRIVE_FOLDER_PATHS.projects, icon: HardDrive },
  ];

  // Helper to render file icon by extension
  const getFileIcon = (file: FileItem, sizeClass: string = 'w-4 h-4') => {
    if (file.type === 'folder') {
      return <Folder className={`${sizeClass} text-amber-400 shrink-0`} />;
    }
    const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase();
    if (['txt', 'md', 'rtf', 'log'].includes(ext)) {
      return <FileText className={`${sizeClass} text-cyan-400 shrink-0`} />;
    }
    if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'sql', 'cpp', 'c', 'java'].includes(ext)) {
      return <FileCode className={`${sizeClass} text-emerald-400 shrink-0`} />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) {
      return <ImageIcon className={`${sizeClass} text-purple-400 shrink-0`} />;
    }
    if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
      return <Film className={`${sizeClass} text-amber-500 shrink-0`} />;
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
      return <Music className={`${sizeClass} text-rose-400 shrink-0`} />;
    }
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
      return <FileArchive className={`${sizeClass} text-amber-500 shrink-0`} />;
    }
    return <FileText className={`${sizeClass} text-slate-400 shrink-0`} />;
  };

  const modalTitle = title || (mode === 'open' ? 'Open' : 'Save As');

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-colors duration-200 animate-in zoom-in-95 h-[88dvh] max-h-[88dvh] sm:h-[540px] sm:max-h-none ${
          isDark ? 'bg-[#1f1f1f] border-white/15 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header Bar */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b shrink-0 ${
          isDark ? 'bg-[#252526] border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <div className="w-5 h-5 rounded-md bg-blue-600/80 flex items-center justify-center shadow-xs">
              <Folder className="w-3.5 h-3.5 text-white" />
            </div>
            <span>{modalTitle}</span>
          </div>
          <button
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
            }`}
            onClick={onClose}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Ribbon Action Toolbar (Organize, New Folder, View) */}
        <div className={`flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0 ${
          isDark ? 'bg-[#1e1e1e] border-white/10' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-1.5">
            {/* Sidebar toggle for mobile/tablet */}
            <button
              onClick={() => setHideFolders(!hideFolders)}
              className={`p-1 px-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                !hideFolders
                  ? isDark ? 'bg-blue-600/30 text-cyan-300' : 'bg-blue-100 text-blue-700'
                  : isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
              title="Toggle Sidebar / Navigation Pane"
            >
              <Menu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Navigation</span>
            </button>

            <div className="h-4 w-px bg-white/10 mx-0.5" />

            {/* Organize Dropdown */}
            <div className="relative" ref={organizeDropdownRef}>
              <button
                className={"flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer " + (isDark ? "hover:bg-white/10 text-slate-300 hover:text-white" : "hover:bg-slate-100 text-slate-600 hover:text-slate-900") + " " + (
                  showOrganizeDropdown ? isDark ? 'bg-white/15 text-white font-medium' : 'bg-slate-200 text-slate-800 font-medium' : '')
              }
                onClick={() => {
                  setShowOrganizeDropdown(!showOrganizeDropdown);
                  setShowViewDropdown(false);
                }}
              >
                <span>Organize</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showOrganizeDropdown && (
                <div
                  className={`absolute left-0 top-7 z-50 w-44 border rounded-xl shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 ${
                    isDark ? 'bg-[#252526] border-white/15' : 'bg-white border-slate-300'
                  }`}
                  onClick={() => setShowOrganizeDropdown(false)}
                >
                  <button
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between ${
                      isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    onClick={() => {
                      if (selectedFile) deleteFile(selectedFile.id);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Delete</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Del</span>
                  </button>
                  <button
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 ${
                      isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    onClick={() => handleCopyPath()}
                  >
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy Location</span>
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  <button
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 ${
                      isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    onClick={handleCreateNewFolder}
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>New Folder</span>
                  </button>
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-white/10 mx-0.5" />

            {/* New Folder Button */}
            <button
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${isDark ? 'hover:bg-white/10 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'} transition-colors cursor-pointer`}
              onClick={handleCreateNewFolder}
              title="Create a new folder in current directory"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">New folder</span>
              <span className="xs:hidden">New</span>
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="relative" ref={viewDropdownRef}>
            <button
                className={"flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer " + (isDark ? "hover:bg-white/10 text-slate-300 hover:text-white" : "hover:bg-slate-100 text-slate-600 hover:text-slate-900") + " " + (
                showViewDropdown ? isDark ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-800' : '')
              }
              onClick={() => {
                setShowViewDropdown(!showViewDropdown);
                setShowOrganizeDropdown(false);
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
              <span>View</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showViewDropdown && (
              <div
                className={`absolute right-0 top-7 z-50 w-40 border rounded-xl shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 ${
                  isDark ? 'bg-[#252526] border-white/15' : 'bg-white border-slate-300'
                }`}
                onClick={() => setShowViewDropdown(false)}
              >
                <button
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between ${
                    viewMode === 'tiles' ? 'bg-blue-600/30 text-cyan-300 font-bold' : isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  onClick={() => setViewMode('tiles')}
                >
                  <span>Tiles</span>
                  {viewMode === 'tiles' && <span className="text-cyan-400 text-xs">✓</span>}
                </button>
                <button
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between ${
                    viewMode === 'icons' ? 'bg-blue-600/30 text-cyan-300 font-bold' : isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  onClick={() => setViewMode('icons')}
                >
                  <span>Medium icons</span>
                  {viewMode === 'icons' && <span className="text-cyan-400 text-xs">✓</span>}
                </button>
                <button
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between ${
                    viewMode === 'list' ? 'bg-blue-600/30 text-cyan-300 font-bold' : isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  onClick={() => setViewMode('list')}
                >
                  <span>List</span>
                  {viewMode === 'list' && <span className="text-cyan-400 text-xs">✓</span>}
                </button>
                <button
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between ${
                    viewMode === 'details' ? 'bg-blue-600/30 text-cyan-300 font-bold' : isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  onClick={() => setViewMode('details')}
                >
                  <span>Details</span>
                  {viewMode === 'details' && <span className="text-cyan-400 text-xs">✓</span>}
                </button>
              </div>
            )}
          </div>
        </div>

        {accessDeniedMessage && (
          <div
            role="status"
            className={`mx-3 mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              isDark
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
          >
            <span className="font-bold">Access denied:</span>
            <span>{accessDeniedMessage}</span>
          </div>
        )}

        {/* 3. Address & Search Bar (Exact Windows 11 Breadcrumbs) */}
        <div className={`flex flex-col md:flex-row gap-2 p-2 border-b shrink-0 text-xs ${
          isDark ? 'bg-[#252526] border-white/10' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  historyIndex > 0
                    ? isDark
                      ? isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer' : 'text-slate-600 hover:bg-black/5 hover:text-slate-900 cursor-pointer'
                      : 'text-slate-600 hover:bg-black/5 hover:text-slate-900 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed text-slate-400'
                }`}
                onClick={handleBack}
                title="Back"
                disabled={historyIndex <= 0}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  historyIndex < history.length - 1
                    ? isDark
                      ? isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer' : 'text-slate-600 hover:bg-black/5 hover:text-slate-900 cursor-pointer'
                      : 'text-slate-600 hover:bg-black/5 hover:text-slate-900 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed text-slate-400'
                }`}
                onClick={handleForward}
                title="Forward"
                disabled={historyIndex >= history.length - 1}
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-black/5 hover:text-slate-900'
                }`}
                onClick={handleUp}
                title="Up to parent folder"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Breadcrumb Address Bar */}
            <div className={`flex-1 relative flex items-center border rounded-xl px-2 py-1 overflow-hidden focus-within:border-cyan-400/80 transition-colors ${
              isDark ? 'bg-[#181818] border-white/15' : 'bg-white border-slate-300'
            }`}>
              {isEditingAddress ? (
                <form onSubmit={handleAddressSubmit} className="flex-1 flex items-center">
                  <input
                    ref={addressInputRef}
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    onBlur={() => setIsEditingAddress(false)}
                    className={`w-full bg-transparent text-xs outline-none font-mono ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}
                    autoFocus
                  />
                </form>
              ) : (
                <div
                  className={`flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none cursor-text truncate ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                  onClick={() => {
                    setAddressInput(currentLocation === 'This PC' ? 'This PC' : currentLocation);
                    setIsEditingAddress(true);
                    setTimeout(() => addressInputRef.current?.select(), 20);
                  }}
                >
                  {breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.path}>
                      <button
                        className={`px-1.5 py-0.5 rounded cursor-pointer truncate flex items-center gap-1 font-medium shrink-0 ${
                            isDark ? 'hover:bg-white/10 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateTo(crumb.path);
                        }}
                      >
                        {crumb.type === 'pc' && <Monitor className="w-3.5 h-3.5 text-blue-500" />}
                        {crumb.type === 'drive' && (
                          <VirtualDriveIcon
                            driveLetter={crumb.path.toUpperCase().startsWith('C:') ? 'C:' : 'D:'}
                            className="w-4 h-3.5"
                          />
                        )}
                        {crumb.type === 'folder' && <Folder className="w-3.5 h-3.5 text-amber-500" />}
                        <span>{crumb.label}</span>
                      </button>
                      {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 ml-1 shrink-0">
                <button
                  onClick={handleCopyPath}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
                  }`}
                  title="Copy full path to clipboard"
                >
                  {copiedPath ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFile(null);
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
                  }`}
                  title="Refresh folder view"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-52 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${breadcrumbs[breadcrumbs.length - 1]?.label || 'files'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-6 py-1 rounded-xl border text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                isDark ? 'bg-[#181818] border-white/15 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
            {searchQuery && (
              <button
                className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 4. Body Content (Left Sidebar + Center Explorer Area) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Navigation Pane */}
          {!hideFolders && (
            <div className={`w-48 sm:w-56 border-r p-2.5 overflow-y-auto shrink-0 space-y-3 text-xs ${
              isDark ? 'bg-[#181818]/95 border-white/10' : 'bg-slate-50/95 border-slate-200'
            } absolute sm:relative left-0 top-0 bottom-0 z-30 shadow-2xl sm:shadow-none h-full`}>
              {/* Quick Access */}
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 flex items-center justify-between ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>Quick access</span>
                </div>
                <div className="space-y-0.5">
                  {quickAccessDirs.map((dir) => {
                    const IconComp = dir.icon;
                    const isCur = currentLocation === dir.path;
                    return (
                      <button
                        key={dir.id}
                        onClick={() => navigateTo(dir.path)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                          isCur
                            ? isDark
                              ? 'bg-blue-600/30 text-cyan-300 font-semibold border border-cyan-500/40'
                              : 'bg-blue-50 text-blue-700 font-semibold border border-blue-300'
                            : isDark
                              ? isDark ? 'hover:bg-white/5 text-slate-300 hover:text-white' : 'hover:bg-slate-200/60 text-slate-700 hover:text-slate-900'
                              : 'hover:bg-slate-200/60 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <IconComp className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} />
                        <span className="truncate">{dir.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* This PC & Drives */}
              <div className={`pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <button
                  onClick={() => navigateTo('This PC')}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left cursor-pointer font-bold transition-colors ${
                    currentLocation === 'This PC'
                      ? isDark
                        ? 'bg-blue-600/30 text-cyan-300 font-semibold border border-cyan-500/40'
                        : 'bg-blue-50 text-blue-700 font-semibold border border-blue-300'
                      : isDark
                        ? isDark ? 'hover:bg-white/5 text-slate-300 hover:text-white' : 'hover:bg-slate-200/60 text-slate-700 hover:text-slate-900'
                        : 'hover:bg-slate-200/60 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>This PC</span>
                </button>

                <div className="pl-3 mt-1 space-y-1">
                  {drivesData.map((drive) => {
                    const isCur = currentLocation === drive.letter;
                    return (
                      <button
                        key={drive.letter}
                        onClick={() => navigateTo(drive.letter)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left cursor-pointer transition-colors ${
                          isCur
                            ? isDark
                              ? 'bg-blue-600/30 text-cyan-300 font-semibold border border-cyan-500/40'
                              : 'bg-blue-50 text-blue-700 font-semibold border border-blue-300'
                            : isDark
                              ? isDark ? 'hover:bg-white/5 text-slate-300 hover:text-white' : 'hover:bg-slate-200/60 text-slate-700 hover:text-slate-900'
                              : 'hover:bg-slate-200/60 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <VirtualDriveIcon
                          driveLetter={drive.letter === 'C:' ? 'C:' : 'D:'}
                          className={drive.letter === 'C:' ? 'w-5 h-4 shrink-0' : 'w-5 h-3 shrink-0'}
                        />
                        <span className="truncate font-medium">{drive.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Center File / Folder Grid */}
          <div
            onClick={() => {
              if (window.innerWidth < 640 && !hideFolders) {
                setHideFolders(true);
              }
            }}
            className={`flex-1 p-4 overflow-y-auto ${
              isDark ? 'bg-[#1f1f1f]' : 'bg-white'
            }`}
          >
            {/* Inline New Folder Input Banner */}
            {showNewFolderInput && (
              <div className={`mb-3 p-2.5 rounded-xl border border-cyan-500/50 flex items-center gap-2 text-xs shadow-md animate-in slide-in-from-top-2 ${
                isDark ? 'bg-[#252526] text-white' : 'bg-cyan-50 text-slate-800'
              }`}>
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNewFolder();
                    if (e.key === 'Escape') setShowNewFolderInput(false);
                  }}
                  autoFocus
                  className={`flex-1 px-2 py-1 rounded-lg border focus:outline-none text-xs ${
                    isDark ? 'bg-black/50 border-white/20 text-white focus:border-cyan-400' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
                <button
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                  onClick={handleCreateNewFolder}
                >
                  Create
                </button>
                <button
                  className={`px-2 py-1 rounded-lg cursor-pointer ${
                    isDark ? 'bg-white/10 hover:bg-white/20 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                  onClick={() => setShowNewFolderInput(false)}
                >
                  Cancel
                </button>
              </div>
            )}

            {currentLocation === 'This PC' ? (
              <div className="space-y-4">
                <div>
                  <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Devices and drives ({drivesData.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {drivesData.map((drive) => (
                      <div
                        key={drive.letter}
                        onClick={() => navigateTo(drive.letter)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${
                          isDark
                            ? 'bg-black/30 border-white/10 hover:border-cyan-500/60 hover:bg-white/5'
                            : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <VirtualDriveIcon
                          driveLetter={drive.letter === 'C:' ? 'C:' : 'D:'}
                          className={`shrink-0 group-hover:scale-105 transition-transform ${drive.letter === 'C:' ? 'w-10 h-10' : 'w-12 h-8'}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {drive.name}
                          </div>
                          {drive.letter === 'C:' && (
                            <div className={`text-[10px] mt-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                              Access restricted
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Folders</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {quickAccessDirs.map((dir) => (
                      <div
                        key={dir.id}
                        onClick={() => navigateTo(dir.path)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer text-xs group transition-all ${
                          isDark
                            ? 'bg-black/25 border-white/5 hover:border-cyan-500/50 hover:bg-white/5'
                            : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <Folder className="w-4 h-4 text-amber-500 shrink-0 group-hover:scale-105 transition-transform" />
                        <span className={`truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{dir.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {(() => {
                  const normLocation = currentLocation.replace(/\/$/, '');
                  const childFolders = files.filter(
                    (f) => !f.deletedAt && f.type === 'folder' && (f.parentId || '').replace(/\/$/, '') === normLocation
                  );
                  const allChildFiles = files.filter(
                    (f) => !f.deletedAt && f.type === 'file' && (f.parentId || '').replace(/\/$/, '') === normLocation
                  );

                  // Filter child files by extension filter if specified
                  const currentExtFilter = fileTypes.find((t) => t.label === selectedFileType)?.ext || '*';
                  const targetExts = currentExtFilter === '*'
                    ? null
                    : currentExtFilter.toLowerCase().split(';').map((value) => value.trim().replace(/^\*\./, ''));
                  const filteredFilesByExt = allChildFiles.filter((file) => {
                    const extension = (file.extension || file.name.split('.').pop() || '').toLowerCase();
                    return NOTEPAD_SUPPORTED_EXTENSIONS.has(extension) && (!targetExts || targetExts.includes(extension));
                  });

                  const filteredFolders = searchQuery.trim()
                    ? childFolders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    : childFolders;
                  const filteredFiles = searchQuery.trim()
                    ? filteredFilesByExt.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    : filteredFilesByExt;

                  if (filteredFolders.length === 0 && filteredFiles.length === 0) {
                    return (
                      <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                        <Folder className="w-8 h-8 text-slate-400 stroke-[1.5]" />
                        <span>This folder is empty.</span>
                      </div>
                    );
                  }

                  if (viewMode === 'details') {
                    return (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className={`border-b text-[11px] ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                            <th className="pb-1.5 font-semibold">Name</th>
                            <th className="pb-1.5 font-semibold">Date modified</th>
                            <th className="pb-1.5 font-semibold">Type</th>
                            <th className="pb-1.5 font-semibold text-right">Size</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                          {filteredFolders.map((sub) => (
                            <tr
                              key={sub.id}
                              onDoubleClick={() => navigateTo(sub.path)}
                              onClick={() => {
                                setSelectedFile(sub);
                                if (mode === 'open') setFileName(sub.name);
                              }}
                              className={`cursor-pointer transition-colors ${
                                selectedFile?.id === sub.id
                                  ? isDark ? 'bg-blue-600/30 font-semibold text-white' : 'bg-blue-100 text-blue-900 font-semibold'
                                  : isDark ? isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <td className="py-1.5 flex items-center gap-2 truncate">
                                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                                <span>{sub.name}</span>
                              </td>
                              <td className={`py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sub.modified || '2026-08-10'}</td>
                              <td className={`py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>File folder</td>
                              <td className={`py-1.5 text-right ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>-</td>
                            </tr>
                          ))}
                          {filteredFiles.map((f) => (
                            <tr
                              key={f.id}
                              onDoubleClick={() => {
                                setSelectedFile(f);
                                setFileName(f.name);
                                if (mode === 'open') {
                                  if (onOpen) onOpen(f);
                                  onClose();
                                } else {
                                  handleConfirmAction();
                                }
                              }}
                              onClick={() => {
                                setSelectedFile(f);
                                setFileName(f.name);
                              }}
                              className={`cursor-pointer transition-colors ${
                                selectedFile?.id === f.id
                                  ? isDark ? 'bg-blue-600/30 font-semibold text-white' : 'bg-blue-100 text-blue-900 font-semibold'
                                  : isDark ? isDark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <td className="py-1.5 flex items-center gap-2 truncate">
                                {getFileIcon(f)}
                                <span>{f.name}</span>
                              </td>
                              <td className={`py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.modified || '2026-08-10'}</td>
                              <td className={`py-1.5 uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.extension || 'File'}</td>
                              <td className={`py-1.5 text-right ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.size || '1 KB'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  }

                  // Default Tiles / Icons / List Layout
                  const gridCols =
                    viewMode === 'icons'
                      ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
                      : viewMode === 'list'
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

                  const gapSize =
                    viewMode === 'icons' ? 'gap-3' : viewMode === 'list' ? 'gap-1.5' : 'gap-2';

                  return (
                    <div className={`grid ${gridCols} ${gapSize}`}>
                      {filteredFolders.map((sub) => {
                        const isRenamingThis = renamingFolderId === sub.id;
                        if (viewMode === 'icons') {
                          return (
                            <div
                              key={sub.id}
                              onDoubleClick={() => !isRenamingThis && navigateTo(sub.path)}
                              onClick={() => {
                                if (!isRenamingThis) {
                                  setSelectedFile(sub);
                                  if (mode === 'open') setFileName(sub.name);
                                }
                              }}
                              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer text-xs text-center group ${
                                selectedFile?.id === sub.id
                                  ? isDark
                                    ? 'bg-blue-600/35 border-cyan-400 text-white font-semibold shadow-md'
                                    : 'bg-blue-100 border-blue-500 text-blue-900 font-semibold shadow-xs'
                                  : isDark
                                    ? 'bg-black/30 border-white/5 hover:border-cyan-500/50 hover:bg-white/5 text-slate-200'
                                    : 'bg-slate-50/80 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-800'
                              }`}
                            >
                              <Folder className="w-10 h-10 text-amber-400 shrink-0 group-hover:scale-110 transition-transform mb-1.5" />
                              <div className="w-full min-w-0">
                                {isRenamingThis ? (
                                  <input
                                    type="text"
                                    value={renameInputName}
                                    onChange={(e) => setRenameInputName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (renameInputName.trim()) {
                                          renameFile(sub.id, renameInputName.trim());
                                        }
                                        setRenamingFolderId(null);
                                      } else if (e.key === 'Escape') {
                                        setRenamingFolderId(null);
                                      }
                                    }}
                                    onBlur={() => {
                                      if (renameInputName.trim()) {
                                        renameFile(sub.id, renameInputName.trim());
                                      }
                                      setRenamingFolderId(null);
                                    }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={(e) => e.target.select()}
                                    className={`w-full px-1.5 py-0.5 text-xs text-center rounded border focus:outline-none ${
                                      isDark ? 'bg-black/50 border-white/30 text-white' : 'bg-white border-slate-300 text-slate-900'
                                    }`}
                                  />
                                ) : (
                                  <div className="truncate font-medium">{sub.name}</div>
                                )}
                                <div className="text-[9px] text-slate-500 mt-0.5">Folder</div>
                              </div>
                            </div>
                          );
                        }

                        const isList = viewMode === 'list';
                        return (
                          <div
                            key={sub.id}
                            onDoubleClick={() => !isRenamingThis && navigateTo(sub.path)}
                            onClick={() => {
                              if (!isRenamingThis) {
                                setSelectedFile(sub);
                                if (mode === 'open') setFileName(sub.name);
                              }
                            }}
                            className={`flex items-center gap-2.5 rounded-xl border transition-all cursor-pointer text-xs group ${
                              isList ? 'p-1.5' : 'p-2'
                            } ${
                              selectedFile?.id === sub.id
                                ? isDark
                                  ? 'bg-blue-600/35 border-cyan-400 text-white font-semibold shadow-md'
                                  : 'bg-blue-100 border-blue-500 text-blue-900 font-semibold shadow-xs'
                                : isDark
                                  ? 'bg-black/30 border-white/5 hover:border-cyan-500/50 hover:bg-white/5 text-slate-200'
                                  : 'bg-slate-50/80 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-800'
                            }`}
                          >
                            <Folder className={`${isList ? 'w-4 h-4' : 'w-6 h-6'} text-amber-400 shrink-0 group-hover:scale-110 transition-transform`} />
                            <div className="flex-1 min-w-0">
                              {isRenamingThis ? (
                                <input
                                  type="text"
                                  value={renameInputName}
                                  onChange={(e) => setRenameInputName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (renameInputName.trim()) {
                                        renameFile(sub.id, renameInputName.trim());
                                      }
                                      setRenamingFolderId(null);
                                    } else if (e.key === 'Escape') {
                                      setRenamingFolderId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (renameInputName.trim()) {
                                      renameFile(sub.id, renameInputName.trim());
                                    }
                                    setRenamingFolderId(null);
                                  }}
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => e.target.select()}
                                  className={`w-full px-1.5 py-0.5 text-xs rounded border focus:outline-none ${
                                    isDark ? 'bg-black/50 border-white/30 text-white' : 'bg-white border-slate-300 text-slate-900'
                                  }`}
                                />
                              ) : (
                                <div className="truncate font-medium">{sub.name}</div>
                              )}
                              {!isList && <div className="text-[10px] text-slate-500">Folder</div>}
                            </div>
                          </div>
                        );
                      })}

                      {filteredFiles.map((f) => {
                        if (viewMode === 'icons') {
                          return (
                            <div
                              key={f.id}
                              onDoubleClick={() => {
                                setSelectedFile(f);
                                setFileName(f.name);
                                if (mode === 'open') {
                                  if (onOpen) onOpen(f);
                                  onClose();
                                } else {
                                  handleConfirmAction();
                                }
                              }}
                              onClick={() => {
                                setSelectedFile(f);
                                setFileName(f.name);
                              }}
                              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer text-xs text-center group ${
                                selectedFile?.id === f.id
                                  ? isDark
                                    ? 'bg-blue-600/35 border-cyan-400 text-white font-semibold shadow-md'
                                    : 'bg-blue-100 border-blue-500 text-blue-900 font-semibold shadow-xs'
                                  : isDark
                                    ? 'bg-black/20 border-white/5 hover:border-cyan-400/40 hover:bg-white/5 text-slate-200'
                                    : 'bg-slate-50/80 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-800'
                              }`}
                            >
                              {getFileIcon(f, 'w-10 h-10 mb-1.5')}
                              <div className="w-full min-w-0">
                                <div className="truncate font-medium">{f.name}</div>
                                <div className="text-[9px] text-slate-500 mt-0.5">{f.size || '1 KB'}</div>
                              </div>
                            </div>
                          );
                        }

                        const isList = viewMode === 'list';
                        return (
                          <div
                            key={f.id}
                            onDoubleClick={() => {
                              setSelectedFile(f);
                              setFileName(f.name);
                              if (mode === 'open') {
                                if (onOpen) onOpen(f);
                                onClose();
                              } else {
                                handleConfirmAction();
                              }
                            }}
                            onClick={() => {
                              setSelectedFile(f);
                              setFileName(f.name);
                            }}
                            className={`flex items-center gap-2.5 rounded-xl border transition-all cursor-pointer text-xs group ${
                              isList ? 'p-1.5' : 'p-2'
                            } ${
                              selectedFile?.id === f.id
                                ? isDark
                                  ? 'bg-blue-600/35 border-cyan-400 text-white font-semibold shadow-md'
                                  : 'bg-blue-100 border-blue-500 text-blue-900 font-semibold shadow-xs'
                                : isDark
                                  ? 'bg-black/20 border-white/5 hover:border-cyan-400/40 hover:bg-white/5 text-slate-200'
                                  : 'bg-slate-50/80 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-800'
                            }`}
                          >
                            {getFileIcon(f, isList ? 'w-4 h-4' : 'w-6 h-6')}
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">{f.name}</div>
                              {!isList && <div className="text-[10px] text-slate-500">{f.size || '1 KB'}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* 5. Bottom Form Controls (File Name, Type Filter, Encoding & Action Buttons) */}
        <div className={`p-3.5 border-t space-y-2 text-xs shrink-0 transition-colors duration-200 ${
          isDark ? 'bg-[#252526] border-white/10' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <label className={`w-full sm:w-24 text-left sm:text-right font-medium shrink-0 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>File name:</label>
            <div className="flex-1">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:border-blue-500 shadow-xs ${
                  isDark ? 'bg-black/50 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmAction();
                }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <label className={`w-full sm:w-24 text-left sm:text-right font-medium shrink-0 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              {mode === 'open' ? 'Files of type:' : 'Save as type:'}
            </label>
            <div className="flex-1">
              <select
                value={selectedFileType}
                onChange={(e) => setSelectedFileType(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-xl border text-xs cursor-pointer focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-black/50 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {fileTypes.map((type) => (
                  <option key={type.label} value={type.label}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t ${
            isDark ? 'border-white/5' : 'border-slate-200'
          }`}>
            <button
              className={`flex items-center gap-1 text-xs cursor-pointer transition-colors ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
              onClick={() => setHideFolders(!hideFolders)}
            >
              <span>{hideFolders ? '˄ Show Folders' : '˅ Hide Folders'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 justify-end w-full sm:w-auto">
              {mode === 'save' && (
                <div ref={encodingDropdownRef} className={`relative flex items-center gap-1.5 text-xs ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <span>Encoding:</span>
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={showEncodingDropdown}
                    onClick={() => setShowEncodingDropdown((open) => !open)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs outline-none cursor-pointer ${
                      isDark ? 'bg-black/50 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {encoding}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showEncodingDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showEncodingDropdown && (
                    <div
                      role="listbox"
                      aria-label="Encoding"
                      className={`absolute bottom-full right-0 z-[10000] mb-1 w-40 rounded-lg border p-1 shadow-xl ${
                        isDark ? 'bg-[#252526] border-white/15' : 'bg-white border-slate-300'
                      }`}
                    >
                      {ENCODING_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="option"
                          aria-selected={encoding === option}
                          onClick={() => {
                            setEncoding(option);
                            setShowEncodingDropdown(false);
                          }}
                          className={`w-full rounded-md px-2.5 py-2 text-left text-xs cursor-pointer ${
                            encoding === option
                              ? 'bg-blue-600 text-white'
                              : isDark
                                ? 'text-slate-200 hover:bg-white/10'
                                : 'text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto sm:ml-0">
                <button
                  className="px-6 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
                  onClick={handleConfirmAction}
                >
                  {mode === 'open' ? 'Open' : 'Save'}
                </button>
                <button
                  className={`px-5 py-1.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer ${
                    isDark ? 'bg-white/10 hover:bg-white/15 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OpenFileModal = SaveAsModal;
