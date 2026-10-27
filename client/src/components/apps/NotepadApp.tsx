import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useOS } from '../../context/OSContext';
import { formatDate, formatTime } from '../../utils/dateTime';
import { AppIcon } from '../common/AppIcon';
import { calculateDriveMetrics } from '../../utils/storageMetrics';
import { SaveAsModal } from '../common/SaveAsModal';
import { SnapLayoutMenu } from '../window/SnapLayoutMenu';
import { haptics } from '../../utils/haptics';
import { soundManager } from '../../utils/sound';
import {
  Plus,
  X,
  Minus,
  Square,
  Maximize2,
  ChevronDown,
  Bold,
  Italic,
  Strikethrough,
  Link as LinkIcon,
  Table as TableIcon,
  Search,
  Check,
  Copy,
  Scissors,
  Clipboard,
  Download,
  Save,
  Printer,
  Folder,
  CheckSquare,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Trash2,
  Monitor,
  ImageIcon,
  Film,
  HardDrive,
} from 'lucide-react';

export interface NoteTab {
  id: string;
  name: string;
  htmlContent: string;
  originalContent?: string;
  saved: boolean;
  filePath?: string;
  isMarkdown?: boolean;
}

export const SAVE_DIRECTORIES = [
  { id: 'docs', name: 'Documents', path: 'D:/Documents', drive: 'New Volume (D:)', icon: Folder },
  { id: 'desktop', name: 'Desktop', path: 'D:/Desktop', drive: 'New Volume (D:)', icon: Monitor },
  { id: 'downloads', name: 'Downloads', path: 'D:/Downloads', drive: 'New Volume (D:)', icon: Folder },
  { id: 'pictures', name: 'Wallpapers', path: 'D:/Pictures/Wallpapers', drive: 'New Volume (D:)', icon: ImageIcon },
  { id: 'videos', name: 'Videos', path: 'D:/Videos', drive: 'New Volume (D:)', icon: Film },
  { id: 'projects', name: 'Projects', path: 'D:/Projects', drive: 'New Volume (D:)', icon: HardDrive },
];

export const NOTEPAD_FILE_TYPES = [
  { label: 'Text documents (*.txt)', ext: 'txt' },
  { label: 'Markdown files (*.md)', ext: 'md' },
  { label: 'HTML documents (*.html; *.htm)', ext: 'html;htm' },
  { label: 'CSS stylesheets (*.css)', ext: 'css' },
  { label: 'JavaScript files (*.js; *.jsx)', ext: 'js;jsx' },
  { label: 'TypeScript files (*.ts; *.tsx)', ext: 'ts;tsx' },
  { label: 'JSON data (*.json)', ext: 'json' },
  { label: 'Python scripts (*.py)', ext: 'py' },
  { label: 'Java source (*.java)', ext: 'java' },
  { label: 'C/C++ source (*.c; *.cpp; *.h)', ext: 'c;cpp;h' },
  { label: 'SQL database files (*.sql)', ext: 'sql' },
  { label: 'XML documents (*.xml)', ext: 'xml' },
  { label: 'YAML files (*.yaml; *.yml)', ext: 'yaml' },
  { label: 'All supported text and programming files', ext: '*' },
];

interface GoToModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineNumber: string;
  onChangeLineNumber: (val: string) => void;
  onGoTo: () => void;
}

const GoToModal: React.FC<GoToModalProps> = ({
  isOpen,
  onClose,
  lineNumber,
  onChangeLineNumber,
  onGoTo,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[10000] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-white dark:bg-[#252526] border border-slate-200 dark:border-white/20 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-800 dark:text-slate-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
          <div className="font-bold text-slate-900 dark:text-white text-sm">
            Go To Line
          </div>
          <button
            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1.5">Line number:</label>
            <input
              type="text"
              value={lineNumber}
              onChange={(e) => onChangeLineNumber(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter line number"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onGoTo();
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
            onClick={onGoTo}
          >
            Go To
          </button>
          <button
            className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayText: string;
  onChangeDisplayText: (val: string) => void;
  address: string;
  onChangeAddress: (val: string) => void;
  onInsert: () => void;
}

const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  onClose,
  displayText,
  onChangeDisplayText,
  address,
  onChangeAddress,
  onInsert,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#252526] border border-slate-200 dark:border-white/20 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-800 dark:text-slate-200 select-none animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-bold text-slate-900 dark:text-white">Link</div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1.5">Display text</label>
            <input
              type="text"
              value={displayText}
              onChange={(e) => onChangeDisplayText(e.target.value)}
              placeholder="Text for the link (optional)"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1.5">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => onChangeAddress(e.target.value)}
              placeholder="Link to an existing webpage"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onInsert();
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
            onClick={onInsert}
          >
            Insert
          </button>
          <button
            className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

interface PageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: {
    size: string;
    orientation: string;
    margins: { left: number; right: number; top: number; bottom: number };
  };
  onChange: (options: any) => void;
}

const PageSetupModal: React.FC<PageSetupModalProps> = ({
  isOpen,
  onClose,
  options,
  onChange,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[10000] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#252526] border border-slate-200 dark:border-white/20 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-800 dark:text-slate-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Printer className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Page Setup</span>
          </div>
          <button
            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block mb-1.5">Paper Size</label>
            <select
              value={options.size}
              onChange={(e) => onChange({ ...options, size: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Letter">Letter</option>
              <option value="A4">A4</option>
              <option value="Legal">Legal</option>
              <option value="Executive">Executive</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block mb-1.5">Orientation</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium cursor-pointer">
                <input
                  type="radio"
                  name="orientation"
                  checked={options.orientation === 'portrait'}
                  onChange={() => onChange({ ...options, orientation: 'portrait' })}
                  className="accent-cyan-600 dark:accent-cyan-400 w-4 h-4 cursor-pointer"
                />
                <span>Portrait</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium cursor-pointer">
                <input
                  type="radio"
                  name="orientation"
                  checked={options.orientation === 'landscape'}
                  onChange={() => onChange({ ...options, orientation: 'landscape' })}
                  className="accent-cyan-600 dark:accent-cyan-400 w-4 h-4 cursor-pointer"
                />
                <span>Landscape</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block mb-1.5">Margins (millimeters)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Left</span>
                <input
                  type="number"
                  value={options.margins.left}
                  onChange={(e) => onChange({
                    ...options,
                    margins: { ...options.margins, left: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Right</span>
                <input
                  type="number"
                  value={options.margins.right}
                  onChange={(e) => onChange({
                    ...options,
                    margins: { ...options.margins, right: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Top</span>
                <input
                  type="number"
                  value={options.margins.top}
                  onChange={(e) => onChange({
                    ...options,
                    margins: { ...options.margins, top: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Bottom</span>
                <input
                  type="number"
                  value={options.margins.bottom}
                  onChange={(e) => onChange({
                    ...options,
                    margins: { ...options.margins, bottom: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer"
            onClick={onClose}
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};

interface PasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  onChangeText: (val: string) => void;
  onInsert: () => void;
}

const PasteModal: React.FC<PasteModalProps> = ({
  isOpen,
  onClose,
  text,
  onChangeText,
  onInsert,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#252526] border border-slate-200 dark:border-white/20 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-800 dark:text-slate-200 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Clipboard className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Paste Content into Document</span>
          </div>
          <button
            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Paste your text or clipboard data below (or press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-black/40 text-cyan-700 dark:text-cyan-300 font-mono text-[10px]">Ctrl+V</kbd>):
        </p>

        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Paste or type text here..."
          rows={5}
          autoFocus
          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1e1e1e] border border-slate-300 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <button
            className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-bold cursor-pointer disabled:opacity-50"
            disabled={!text}
            onClick={onInsert}
          >
            Insert Text
          </button>
        </div>
      </div>
    </div>
  );
};

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: 'create' | 'actions';
  setTab: (t: 'create' | 'actions') => void;
  rows: number;
  setRows: (r: number) => void;
  cols: number;
  setCols: (c: number) => void;
  hasHeader: boolean;
  setHasHeader: (h: boolean) => void;
  style: 'standard' | 'striped' | 'minimal';
  setStyle: (s: 'standard' | 'striped' | 'minimal') => void;
  onInsertTable: (rows: number, cols: number, hasHeader: boolean, style: string) => void;
  onEditTable: (action: string) => void;
}

const TableModal: React.FC<TableModalProps> = ({
  isOpen,
  onClose,
  tab,
  setTab,
  rows,
  setRows,
  cols,
  setCols,
  hasHeader,
  setHasHeader,
  style,
  setStyle,
  onInsertTable,
  onEditTable,
}) => {
  const [hoveredRows, setHoveredRows] = React.useState(0);
  const [hoveredCols, setHoveredCols] = React.useState(0);
  const [rowsInput, setRowsInput] = React.useState(String(rows));
  const [colsInput, setColsInput] = React.useState(String(cols));
  const gridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setRowsInput(String(rows));
  }, [rows]);

  React.useEffect(() => {
    setColsInput(String(cols));
  }, [cols]);

  const handleTouchGrid = (e: React.TouchEvent<HTMLDivElement>, isEnd = false) => {
    if (!gridRef.current) return;
    const touch = e.touches[0] || (e.changedTouches && e.changedTouches[0]);
    if (!touch) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const cellW = rect.width / 5;
    const cellH = rect.height / 5;
    const c = Math.min(5, Math.max(1, Math.floor(x / cellW) + 1));
    const r = Math.min(5, Math.max(1, Math.floor(y / cellH) + 1));
    setHoveredRows(r);
    setHoveredCols(c);
    setRows(r);
    setCols(c);
    setRowsInput(String(r));
    setColsInput(String(c));

    if (isEnd) {
      onInsertTable(r, c, hasHeader, style);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[10000] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#252526] border border-slate-200 dark:border-white/20 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-800 dark:text-slate-200 select-none animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <TableIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Table Settings</span>
          </div>
          <button
            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-white/5 text-xs text-slate-500 font-medium">
          <button
            className={`flex-1 py-1.5 border-b-2 text-center transition-colors cursor-pointer ${
              tab === 'create'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={() => setTab('create')}
          >
            Create Table
          </button>
          <button
            className={`flex-1 py-1.5 border-b-2 text-center transition-colors cursor-pointer ${
              tab === 'actions'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={() => setTab('actions')}
          >
            Table Actions
          </button>
        </div>

        {tab === 'create' ? (
          <div className="space-y-3.5 pt-1 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-medium">Visual Grid Picker (Touch or Click):</span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                  {hoveredRows > 0 && hoveredCols > 0 
                    ? `${hoveredRows} x ${hoveredCols} Table` 
                    : `${rows} x ${cols} Table`}
                </span>
              </div>
              <div className="flex justify-center p-2.5 bg-slate-50 dark:bg-black/30 rounded-xl border border-slate-200 dark:border-white/10 touch-none">
                <div 
                  ref={gridRef}
                  className="grid grid-cols-5 gap-1.5 p-1 cursor-pointer touch-none select-none"
                  onMouseLeave={() => {
                    setHoveredRows(0);
                    setHoveredCols(0);
                  }}
                  onTouchStart={(e) => handleTouchGrid(e, false)}
                  onTouchMove={(e) => handleTouchGrid(e, false)}
                  onTouchEnd={(e) => handleTouchGrid(e, true)}
                >
                  {Array.from({ length: 5 }).map((_, rIdx) => {
                    const r = rIdx + 1;
                    return Array.from({ length: 5 }).map((_, cIdx) => {
                      const c = cIdx + 1;
                      const isHighlighted = hoveredRows > 0 && hoveredCols > 0
                        ? r <= hoveredRows && c <= hoveredCols
                        : r <= rows && c <= cols;

                      return (
                        <div
                          key={`${r}-${c}`}
                          className={`w-7 h-7 rounded-md cursor-pointer border transition-all ${
                            isHighlighted
                              ? 'bg-cyan-500 border-cyan-600 dark:border-cyan-400 shadow-xs scale-105 z-10'
                              : 'bg-slate-200/60 dark:bg-white/5 border-slate-300/80 dark:border-white/10 hover:bg-slate-300 dark:hover:bg-white/20'
                          }`}
                          onMouseEnter={() => {
                            setHoveredRows(r);
                            setHoveredCols(c);
                          }}
                          onClick={() => {
                            setRows(r);
                            setCols(c);
                            setRowsInput(String(r));
                            setColsInput(String(c));
                            onInsertTable(r, c, hasHeader, style);
                            onClose();
                          }}
                          title={`${r} x ${c}`}
                        />
                      );
                    });
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Rows</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={rowsInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setRowsInput(val);
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
                      setRows(parsed);
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(rowsInput, 10);
                    if (isNaN(parsed) || parsed < 1) {
                      setRowsInput('1');
                      setRows(1);
                    } else if (parsed > 50) {
                      setRowsInput('50');
                      setRows(50);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 font-medium text-slate-900 dark:text-white"
                  placeholder="Rows"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Columns</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={colsInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setColsInput(val);
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
                      setCols(parsed);
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(colsInput, 10);
                    if (isNaN(parsed) || parsed < 1) {
                      setColsInput('1');
                      setCols(1);
                    } else if (parsed > 50) {
                      setColsInput('50');
                      setCols(50);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/20 font-medium text-slate-900 dark:text-white"
                  placeholder="Cols"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="table-header-checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="accent-cyan-600 dark:accent-cyan-400 w-4 h-4 rounded cursor-pointer"
              />
              <label htmlFor="table-header-checkbox" className="font-medium cursor-pointer text-slate-700 dark:text-slate-300">
                Include table header row
              </label>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 block mb-1.5">Table Styling Preset</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['standard', 'striped', 'minimal'] as const).map((sty) => (
                  <button
                    key={sty}
                    type="button"
                    className={`py-2 px-1 rounded-xl border text-center font-medium capitalize transition-all cursor-pointer ${
                      style === sty
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold ring-1 ring-cyan-500'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => setStyle(sty)}
                  >
                    <div className="text-xs">{sty}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {sty === 'standard' ? 'Full Grid' : sty === 'striped' ? 'Zebra Rows' : 'Clean Lines'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors cursor-pointer shadow"
                onClick={() => {
                  const finalRows = parseInt(rowsInput, 10) || rows || 1;
                  const finalCols = parseInt(colsInput, 10) || cols || 1;
                  onInsertTable(finalRows, finalCols, hasHeader, style);
                  onClose();
                }}
              >
                Insert Table
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-[11px] text-slate-500 text-center">
              Click in any cell in the editor to modify row/column structures:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-medium cursor-pointer text-slate-800 dark:text-slate-200"
                onClick={() => {
                  onEditTable('insert-row-above');
                  onClose();
                }}
              >
                + Insert Row Above
              </button>
              <button
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-medium cursor-pointer text-slate-800 dark:text-slate-200"
                onClick={() => {
                  onEditTable('insert-row-below');
                  onClose();
                }}
              >
                + Insert Row Below
              </button>
              <button
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-medium cursor-pointer text-slate-800 dark:text-slate-200"
                onClick={() => {
                  onEditTable('insert-col-left');
                  onClose();
                }}
              >
                + Insert Column Left
              </button>
              <button
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-medium cursor-pointer text-slate-800 dark:text-slate-200"
                onClick={() => {
                  onEditTable('insert-col-right');
                  onClose();
                }}
              >
                + Insert Column Right
              </button>
              <button
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-medium cursor-pointer text-slate-800 dark:text-slate-200"
                onClick={() => {
                  onEditTable('clear-cell');
                  onClose();
                }}
              >
                Clear Cell Content
              </button>
              <button
                className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40 text-left text-xs font-medium text-amber-700 dark:text-amber-400 cursor-pointer"
                onClick={() => {
                  onEditTable('delete-row');
                  onClose();
                }}
              >
                Delete Selected Row
              </button>
              <button
                className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40 text-left text-xs font-medium text-amber-700 dark:text-amber-400 cursor-pointer"
                onClick={() => {
                  onEditTable('delete-col');
                  onClose();
                }}
              >
                Delete Selected Col
              </button>
              <button
                className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200/60 dark:border-red-800/40 text-left text-xs font-semibold text-red-600 dark:text-red-400 cursor-pointer"
                onClick={() => {
                  onEditTable('delete-table');
                  onClose();
                }}
              >
                Delete Entire Table
              </button>
            </div>
            <div className="pt-2">
              <button
                className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface UnsavedChangesModalProps {
  isOpen: boolean;
  tabName: string;
  isDark?: boolean;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  tabName,
  isDark = true,
  onSave,
  onDontSave,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className={`w-full max-w-md border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 space-y-4 transition-colors duration-200 ${
        isDark ? 'bg-[#252526] border-white/20 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-600'
          }`}>
            <Save className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Do you want to save changes to "{tabName}"?
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              If you close without saving, any changes you made will be permanently lost.
            </p>
          </div>
        </div>
        <div className={`flex items-center justify-end gap-2 pt-3 border-t ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Save
          </button>
          <button
            onClick={onDontSave}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Don't Save
          </button>
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotepadApp: React.FC<{ filePath?: string; fileContent?: string; windowId?: string }> = ({
  filePath,
  fileContent,
  windowId,
}) => {
  const {
    createFile,
    files,
    driveLabels,
    addNotification,
    endProcess,
    openApp,
    clipboardHistory,
    settings,
    closeWindow,
    windows,
    minimizeWindow,
    maximizeWindow,
    snapWindow,
  } = useOS();

  const targetWin = (windowId ? windows.find((w) => w.id === windowId) : null) || windows.find((w) => w.appId === 'notepad');
  const actualWindowId = targetWin?.id || windowId || 'notepad';
  const isMaximized = targetWin?.isMaximized || false;

  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const snapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSnapMouseEnter = () => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(() => {
      setShowSnapMenu(true);
    }, 250);
  };

  const handleSnapMouseLeave = () => {
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(() => {
      setShowSnapMenu(false);
    }, 200);
  };

  const rootContainerRef = useRef<HTMLDivElement | null>(null);

  const [appTheme, setAppTheme] = useState<'system' | 'light' | 'dark'>(() => {
    const saved = localStorage.getItem('notepad_app_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });

  const isDark = appTheme === 'light' ? false : appTheme === 'dark' ? true : settings?.theme !== 'light';

  const handleSetTheme = (theme: 'system' | 'light' | 'dark') => {
    setAppTheme(theme);
    localStorage.setItem('notepad_app_theme', theme);
  };

  // Refs to retain active table cell/row/table references for actions inside modals
  const activeTableRef = useRef<HTMLTableElement | null>(null);
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  const activeCellRef = useRef<HTMLTableCellElement | null>(null);

  // Storage metrics calculated dynamically
  const drivesData = useMemo(() => calculateDriveMetrics(files, driveLabels), [files, driveLabels]);

  // Helper to convert plain text / markdown into rich HTML
  const textToHtml = (text: string): string => {
    if (!text) return '';
    if (text.includes('<p>') || text.includes('<div>') || text.includes('<h1>') || text.includes('<strong>')) {
      return text;
    }
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 font-mono text-cyan-300 text-xs">$1</code>');
    return `<p>${html}</p>`;
  };

  // Helper to convert HTML back to clean plain text / markdown
  const htmlToText = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.innerText || temp.textContent || '';
  };

  // Check if a tab's content has been modified compared to its original state
  const isTabModified = useCallback((tab: NoteTab) => {
    return tab.htmlContent !== (tab.originalContent || '');
  }, []);

  // Initialize tabs: Default to empty "Untitled" tab unless filePath is explicitly passed
  const [tabs, setTabs] = useState<NoteTab[]>(() => {
    const initialName = filePath ? filePath.split('/').pop() || 'Untitled' : 'Untitled';
    const initialRawContent = filePath
      ? fileContent || files.find((f) => f.path === filePath)?.content || ''
      : '';
    const initialHtml = textToHtml(initialRawContent);

    return [
      {
        id: 'tab-1',
        name: initialName,
        htmlContent: initialHtml,
        originalContent: initialHtml,
        saved: true,
        filePath: filePath,
        isMarkdown: initialName.endsWith('.md'),
      },
    ];
  });

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

  // Menus and Dropdowns
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'view' | 'heading' | 'list' | 'table' | null>(null);
  const [activeMenuPos, setActiveMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [activeHeading, setActiveHeading] = useState<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'>('p');
  const [activeList, setActiveList] = useState<'none' | 'disc' | '1' | 'A' | 'a' | 'i' | 'I' | 'task'>('none');

  const toggleDropdownMenu = (
    menuName: 'file' | 'edit' | 'view' | 'heading' | 'list' | 'table',
    e: React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation();
    if (openMenu === menuName) {
      setOpenMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;

    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 520;
    const widthMap: Record<string, number> = {
      file: 230,
      edit: 230,
      view: 210,
      heading: 195,
      list: 215,
      table: isMobileScreen ? 310 : 470,
    };
    const menuWidth = widthMap[menuName] || 220;

    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menuWidth - 12);
    }
    if (left < 12) left = 12;

    setActiveMenuPos({ top, left });
    setOpenMenu(menuName);
  };

  // Editor states
  const [wordWrap, setWordWrap] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [editorMode, setEditorMode] = useState<'rich' | 'plain'>('rich');

  // Cursor & Selection stats
  const [stats, setStats] = useState({ ln: 1, col: 1, chars: 0, words: 0 });

  // Find & Replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findMode, setFindMode] = useState<'find' | 'replace'>('find');
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);

  // Page Setup state
  const [pageSetupOptions, setPageSetupOptions] = useState({
    size: 'Letter',
    orientation: 'portrait',
    margins: { left: 20, right: 20, top: 25, bottom: 25 }
  });
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);

  // Go To Line state
  const [showGoToModal, setShowGoToModal] = useState(false);
  const [goToLineNumber, setGoToLineNumber] = useState('1');

  // Link Modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkDisplayText, setLinkDisplayText] = useState('');
  const [linkAddress, setLinkAddress] = useState('');
  const savedSelectionRangeRef = useRef<Range | null>(null);

  // Table Modal state
  const [showTableModal, setShowTableModal] = useState(false);
  const [customTableRows, setCustomTableRows] = useState(3);
  const [customTableCols, setCustomTableCols] = useState(3);
  const [customTableHasHeader, setCustomTableHasHeader] = useState(true);
  const [customTableStyle, setCustomTableStyle] = useState<'standard' | 'striped' | 'minimal'>('standard');
  const [tableModalTab, setTableModalTab] = useState<'create' | 'actions'>('create');

  // Table hover grid state
  const [tableHoverGrid, setTableHoverGrid] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
  const [tableSelectionInfo, setTableSelectionInfo] = useState<{
    totalRows: number;
    totalCols: number;
    curRow: number;
    curCol: number;
    isHeader: boolean;
    text: string;
  } | null>(null);

  // Quick Paste state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteModalText, setPasteModalText] = useState('');

  // Unsaved close state
  const [pendingCloseTab, setPendingCloseTab] = useState<{
    tabId: string;
    tabName: string;
    closeAppOnDone: boolean;
  } | null>(null);

  // Save As State
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsFileName, setSaveAsFileName] = useState('Untitled.txt');
  const [saveAsFileType, setSaveAsFileType] = useState('Text documents (*.txt)');

  // Open File state
  const [showOpenModal, setShowOpenModal] = useState(false);

  // Editor DOM reference
  const editorRef = useRef<HTMLDivElement | null>(null);
  const plainTextRef = useRef<HTMLTextAreaElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Keep editor DOM in sync when active tab changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== activeTab.htmlContent) {
      editorRef.current.innerHTML = activeTab.htmlContent;
    }
  }, [activeTabId]);

  // Update content on input
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const newHtml = editorRef.current.innerHTML;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, htmlContent: newHtml, saved: false }
          : t
      )
    );
    updateCursorStats();
  };

  const handlePlainTextChange = (val: string) => {
    const newHtml = textToHtml(val);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, htmlContent: newHtml, saved: false }
          : t
      )
    );
    setTimeout(updateCursorStats, 0);
  };

  // Helper to accurately construct text up to the caret position for line/col calculation
  const getTextUpToCaret = useCallback((editor: HTMLElement): string => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    const range = selection.getRangeAt(0);
    const targetNode = range.endContainer;
    const targetOffset = range.endOffset;

    let text = '';
    let finished = false;

    const traverse = (node: Node) => {
      if (finished) return;

      if (node === targetNode) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent?.substring(0, targetOffset) || '';
        } else {
          // Caret is at a child index of an element node
          for (let i = 0; i < targetOffset && i < node.childNodes.length; i++) {
            traverse(node.childNodes[i]);
          }
        }
        finished = true;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toUpperCase();

        const isBlock = ['DIV', 'P', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName);
        if (isBlock && text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }

        if (tagName === 'BR') {
          text += '\n';
        }

        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
          if (finished) return;
        }

        if (isBlock && !text.endsWith('\n')) {
          text += '\n';
        }
      }
    };

    traverse(editor);
    return text;
  }, []);

  // Cursor & selection stats tracker
  const updateCursorStats = useCallback(() => {
    if (editorMode === 'plain' && plainTextRef.current) {
      const pos = plainTextRef.current.selectionStart;
      const text = plainTextRef.current.value.substring(0, pos);
      const lines = text.split('\n');
      const fullText = plainTextRef.current.value;
      const words = fullText.trim() ? fullText.trim().split(/\s+/).filter(Boolean).length : 0;
      setStats({
        ln: lines.length,
        col: (lines[lines.length - 1] || '').length + 1,
        chars: fullText.length,
        words,
      });
      return;
    }

    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      const text = editorRef.current?.innerText || '';
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      setStats({ ln: 1, col: 1, chars: text.length, words });
      return;
    }

    const text = editorRef.current.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;

    const textBeforeCaret = getTextUpToCaret(editorRef.current);
    const lines = textBeforeCaret.split('\n');

    // Detect active heading and active list
    let currentH: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' = 'p';
    let currentL: 'none' | 'disc' | '1' | 'A' | 'a' | 'i' | 'I' | 'task' = 'none';

    let scanNode: Node | null = selection.anchorNode;
    while (scanNode && scanNode !== editorRef.current) {
      const tag = scanNode.nodeName;
      if (tag === 'H1') currentH = 'h1';
      else if (tag === 'H2') currentH = 'h2';
      else if (tag === 'H3') currentH = 'h3';
      else if (tag === 'H4') currentH = 'h4';
      else if (tag === 'H5') currentH = 'h5';
      else if (tag === 'H6') currentH = 'h6';
      else if (tag === 'P') currentH = 'p';

      if (tag === 'UL') {
        currentL = 'disc';
      } else if (tag === 'OL') {
        const el = scanNode as HTMLElement;
        const dataListType = el.getAttribute('data-list-type');
        const attrType = el.getAttribute('type');
        if (dataListType === 'upper-alpha' || attrType === 'A' || el.classList.contains('list-upper-alpha')) {
          currentL = 'A';
        } else if (dataListType === 'lower-alpha' || attrType === 'a' || el.classList.contains('list-lower-alpha')) {
          currentL = 'a';
        } else if (dataListType === 'upper-roman' || attrType === 'I' || el.classList.contains('list-upper-roman')) {
          currentL = 'I';
        } else if (dataListType === 'lower-roman' || attrType === 'i' || el.classList.contains('list-lower-roman')) {
          currentL = 'i';
        } else {
          currentL = '1';
        }
      } else if ((scanNode as HTMLElement).classList?.contains('task-item')) {
        currentL = 'task';
      }
      scanNode = scanNode.parentNode;
    }
    setActiveHeading(currentH);
    setActiveList(currentL);

    // Detect if cursor/selection is inside a table
    let node: Node | null = selection.anchorNode;
    let cell: HTMLTableCellElement | null = null;
    let row: HTMLTableRowElement | null = null;
    let table: HTMLTableElement | null = null;

    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') cell = node as HTMLTableCellElement;
      if (node.nodeName === 'TR') row = node as HTMLTableRowElement;
      if (node.nodeName === 'TABLE') table = node as HTMLTableElement;
      node = node.parentNode;
    }

    // Persist refs to the current table components so modals don't lose them when stealing focus
    if (table && row && cell) {
      activeTableRef.current = table;
      activeRowRef.current = row;
      activeCellRef.current = cell;

      setTableSelectionInfo({
        totalRows: table.rows.length,
        totalCols: row.cells.length,
        curRow: row.rowIndex + 1,
        curCol: cell.cellIndex + 1,
        isHeader: cell.tagName === 'TH',
        text: cell.innerText.trim(),
      });
    } else {
      // Clear refs if cursor is inside the editor but not in a table cell
      if (selection.anchorNode && editorRef.current.contains(selection.anchorNode)) {
        activeTableRef.current = null;
        activeRowRef.current = null;
        activeCellRef.current = null;
      }
      setTableSelectionInfo(null);
    }

    setStats({
      ln: Math.max(1, lines.length),
      col: Math.max(1, (lines[lines.length - 1] || '').length + 1),
      chars,
      words,
    });
  }, [editorMode, getTextUpToCaret]);

  // Tab Operations
  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: NoteTab = {
      id: newId,
      name: 'Untitled',
      htmlContent: '',
      originalContent: '',
      saved: true,
      isMarkdown: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setOpenMenu(null);
  };

  const forceCloseTab = useCallback((idToClose: string) => {
    const remaining = tabs.filter((t) => t.id !== idToClose);
    if (remaining.length === 0) {
      if (windowId) {
        closeWindow(windowId);
      } else if (actualWindowId) {
        closeWindow(actualWindowId);
      } else {
        endProcess('notepad');
      }
      return;
    }

    setTabs(remaining);
    setActiveTabId((current) => {
      if (current === idToClose) {
        return remaining[remaining.length - 1]?.id || remaining[0]?.id;
      }
      return current;
    });
  }, [tabs, windowId, actualWindowId, closeWindow, endProcess]);

  const handleCloseTab = (idToClose: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const t = tabs.find((x) => x.id === idToClose);
    if (t && (!t.saved || isTabModified(t))) {
      setPendingCloseTab({ tabId: idToClose, tabName: t.name, closeAppOnDone: false });
    } else {
      forceCloseTab(idToClose);
    }
  };

  // Listen for window close request (x button on window frame or exit)
  useEffect(() => {
    const handleRequestClose = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.appId === 'notepad') {
        if (windowId && customEvent.detail?.windowId && customEvent.detail.windowId !== windowId) {
          return;
        }

        const unsavedTab = tabs.find((t) => !t.saved || isTabModified(t));
        if (unsavedTab) {
          customEvent.preventDefault();
          e.preventDefault();
          setPendingCloseTab({
            tabId: unsavedTab.id,
            tabName: unsavedTab.name,
            closeAppOnDone: true,
          });
        }
      }
    };

    window.addEventListener('app-request-close', handleRequestClose);
    return () => {
      window.removeEventListener('app-request-close', handleRequestClose);
    };
  }, [tabs, isTabModified, windowId]);

  // Rich Text Formatting Commands
  const execFormat = (command: string, value: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  // Formatting operations
  const handleBold = () => execFormat('bold');
  const handleItalic = () => execFormat('italic');
  const handleStrikethrough = () => execFormat('strikeThrough');

  const applyHeading = (tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p') => {
    if (tag === 'p') {
      execFormat('formatBlock', '<p>');
    } else {
      execFormat('formatBlock', `<${tag}>`);
    }
    setActiveHeading(tag);
    setOpenMenu(null);
  };

  const handleClearList = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        let inUl = false;
        let inOl = false;
        let taskWrapper: HTMLElement | null = null;
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'UL') inUl = true;
          if (node.nodeName === 'OL') inOl = true;
          if ((node as HTMLElement).classList?.contains('task-item')) {
            taskWrapper = node as HTMLElement;
          }
          node = node.parentNode;
        }

        if (taskWrapper) {
          const text = taskWrapper.innerText || '';
          const p = document.createElement('p');
          p.textContent = text.trim() || ' ';
          taskWrapper.parentNode?.replaceChild(p, taskWrapper);
          handleEditorInput();
        } else if (inUl) {
          document.execCommand('insertUnorderedList', false);
          handleEditorInput();
        } else if (inOl) {
          document.execCommand('insertOrderedList', false);
          handleEditorInput();
        } else {
          document.execCommand('formatBlock', false, '<p>');
          handleEditorInput();
        }
      }
    }
    setActiveList('none');
    setOpenMenu(null);
  };

  const handleTaskChecklist = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      const checkboxHtml = `
        <div class="task-item flex items-center gap-2 my-1.5" contenteditable="true">
          <input type="checkbox" class="task-checkbox accent-cyan-500 w-4 h-4 rounded cursor-pointer shrink-0" onchange="const txt = this.closest('.task-item')?.querySelector('.task-text') || this.nextElementSibling; if(txt) { txt.style.textDecoration = this.checked ? 'line-through' : 'none'; txt.style.opacity = this.checked ? '0.6' : '1'; }" />
          <span class="task-text text-slate-700 dark:text-slate-200 outline-none flex-1">Checklist item</span>
        </div>
      `;
      document.execCommand('insertHTML', false, checkboxHtml);
      handleEditorInput();
    }
    setActiveList('task');
    setOpenMenu(null);
  };

  const configureOrderedList = (ol: HTMLOListElement, styleType: '1' | 'A' | 'a' | 'i' | 'I') => {
    const listStyleCSS =
      styleType === 'A' ? 'upper-alpha' :
      styleType === 'a' ? 'lower-alpha' :
      styleType === 'i' ? 'lower-roman' :
      styleType === 'I' ? 'upper-roman' : 'decimal';
    const className = `list-${listStyleCSS}`;

    ol.setAttribute('type', styleType);
    ol.type = styleType;
    ol.setAttribute('data-list-type', listStyleCSS);
    ol.classList.remove('list-upper-alpha', 'list-lower-alpha', 'list-upper-roman', 'list-lower-roman', 'list-decimal');
    ol.classList.add(className);
    ol.style.setProperty('list-style-type', listStyleCSS, 'important');

    const lis = ol.querySelectorAll('li');
    lis.forEach((li) => {
      (li as HTMLElement).style.setProperty('list-style-type', listStyleCSS, 'important');
    });
  };

  const applyListStyle = (styleType: 'none' | 'disc' | '1' | 'A' | 'a' | 'i' | 'I' | 'task') => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    if (styleType === 'none') {
      handleClearList();
      return;
    }

    if (styleType === 'task') {
      handleTaskChecklist();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setOpenMenu(null);
      return;
    }

    let node: Node | null = sel.anchorNode;
    let inUl: HTMLUListElement | null = null;
    let inOl: HTMLOListElement | null = null;

    while (node && node !== editorRef.current) {
      if (node.nodeName === 'UL') inUl = node as HTMLUListElement;
      if (node.nodeName === 'OL') inOl = node as HTMLOListElement;
      node = node.parentNode;
    }

    if (styleType === 'disc') {
      if (inOl) {
        const ul = document.createElement('ul');
        ul.setAttribute('type', 'disc');
        ul.setAttribute('data-list-type', 'disc');
        ul.classList.add('list-disc');
        ul.style.setProperty('list-style-type', 'disc', 'important');
        ul.innerHTML = inOl.innerHTML;
        inOl.parentNode?.replaceChild(ul, inOl);
      } else if (inUl) {
        inUl.setAttribute('type', 'disc');
        inUl.setAttribute('data-list-type', 'disc');
        inUl.classList.add('list-disc');
        inUl.style.setProperty('list-style-type', 'disc', 'important');
      } else {
        document.execCommand('insertUnorderedList', false);
        const curSel = window.getSelection();
        let n: Node | null = curSel?.anchorNode || null;
        while (n && n !== editorRef.current) {
          if (n.nodeName === 'UL') {
            (n as HTMLUListElement).setAttribute('type', 'disc');
            (n as HTMLUListElement).setAttribute('data-list-type', 'disc');
            (n as HTMLUListElement).classList.add('list-disc');
            (n as HTMLUListElement).style.setProperty('list-style-type', 'disc', 'important');
            break;
          }
          n = n.parentNode;
        }
      }
      setActiveList('disc');
    } else {
      if (inUl) {
        const ol = document.createElement('ol');
        ol.innerHTML = inUl.innerHTML;
        configureOrderedList(ol, styleType);
        inUl.parentNode?.replaceChild(ol, inUl);
      } else if (inOl) {
        configureOrderedList(inOl, styleType);
      } else {
        document.execCommand('insertOrderedList', false);
        const curSel = window.getSelection();
        let foundOl: HTMLOListElement | null = null;
        let n: Node | null = curSel?.anchorNode || null;
        while (n && n !== editorRef.current) {
          if (n.nodeName === 'OL') {
            foundOl = n as HTMLOListElement;
            break;
          }
          n = n.parentNode;
        }
        if (!foundOl && curSel?.focusNode) {
          let fn: Node | null = curSel.focusNode;
          while (fn && fn !== editorRef.current) {
            if (fn.nodeName === 'OL') {
              foundOl = fn as HTMLOListElement;
              break;
            }
            fn = fn.parentNode;
          }
        }
        if (foundOl) {
          configureOrderedList(foundOl, styleType);
        }
      }
      setActiveList(styleType);
    }

    handleEditorInput();
    setOpenMenu(null);
  };



  const openLinkModal = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRangeRef.current = selection.getRangeAt(0).cloneRange();
      const selectedText = selection.toString();
      setLinkDisplayText(selectedText);
    } else {
      savedSelectionRangeRef.current = null;
      setLinkDisplayText('');
    }
    setLinkAddress('');
    setShowLinkModal(true);
    setOpenMenu(null);
  };

  const handleInsertLink = () => {
    if (!linkAddress.trim()) {
      setShowLinkModal(false);
      return;
    }

    let url = linkAddress.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const text = linkDisplayText.trim() || url;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedSelectionRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedSelectionRangeRef.current);
        }
      }
      const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-cyan-400 underline hover:text-cyan-500 dark:hover:text-cyan-300 font-medium cursor-pointer">${text}</a>&nbsp;`;
      document.execCommand('insertHTML', false, linkHtml);
      handleEditorInput();
    }

    setShowLinkModal(false);
  };

  const insertTable = (rows: number, cols: number, hasHeader: boolean = true, stylePreset: string = 'standard') => {
    if (editorRef.current) {
      editorRef.current.focus();

      let tableStyle = 'border-collapse: collapse; margin: 12px 0; width: 100%; max-width: 650px; font-size: 12px;';
      let tableClass = 'my-3 text-xs w-full max-w-xl text-left border-collapse';

      let thStyle = 'padding: 8px 12px; font-weight: 600; text-align: left;';
      let thClass = 'p-2.5 font-semibold text-cyan-600 dark:text-cyan-300';

      let tdBaseStyle = 'padding: 8px 12px; min-width: 60px;';
      let tdBaseClass = 'p-2.5 text-slate-800 dark:text-slate-200 min-w-[60px]';

      if (stylePreset === 'minimal') {
        tableStyle += ' border-bottom: 2px solid rgba(148, 163, 184, 0.4);';
        thStyle += ' border-bottom: 2px solid rgba(148, 163, 184, 0.5); background: transparent;';
        tdBaseStyle += ' border-bottom: 1px solid rgba(148, 163, 184, 0.25);';
        tableClass += ' border-b-2 border-slate-300 dark:border-white/20';
        thClass += ' border-b-2 border-slate-300 dark:border-white/20 bg-transparent';
        tdBaseClass += ' border-b border-slate-200 dark:border-white/10';
      } else if (stylePreset === 'striped') {
        tableStyle += ' border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 6px; overflow: hidden;';
        thStyle += ' border: 1px solid rgba(148, 163, 184, 0.4); background-color: rgba(6, 182, 212, 0.12);';
        tdBaseStyle += ' border: 1px solid rgba(148, 163, 184, 0.3);';
        tableClass += ' border border-slate-300 dark:border-white/20 rounded-lg';
        thClass += ' border border-slate-300 dark:border-white/20 bg-cyan-50 dark:bg-cyan-950/40';
        tdBaseClass += ' border border-slate-300 dark:border-white/20';
      } else {
        // standard full grid
        tableStyle += ' border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 6px; overflow: hidden;';
        thStyle += ' border: 1px solid rgba(148, 163, 184, 0.4); background-color: rgba(148, 163, 184, 0.12);';
        tdBaseStyle += ' border: 1px solid rgba(148, 163, 184, 0.3);';
        tableClass += ' border border-slate-300 dark:border-white/20 rounded-lg';
        thClass += ' border border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/10';
        tdBaseClass += ' border border-slate-300 dark:border-white/20';
      }

      let tableHtml = `<table data-style-preset="${stylePreset}" class="${tableClass}" style="${tableStyle}">`;
      if (hasHeader) {
        tableHtml += `<thead><tr>`;
        for (let c = 0; c < cols; c++) {
          tableHtml += `<th class="${thClass}" style="${thStyle}">Header ${c + 1}</th>`;
        }
        tableHtml += `</tr></thead>`;
      }
      tableHtml += `<tbody>`;
      for (let r = 0; r < rows; r++) {
        const isStripedRow = stylePreset === 'striped' && r % 2 === 1;
        const rowStyle = isStripedRow ? 'background-color: rgba(148, 163, 184, 0.14);' : '';
        const rowClass = isStripedRow ? 'bg-slate-100/70 dark:bg-white/5' : '';

        tableHtml += `<tr class="${rowClass}" style="${rowStyle}">`;
        for (let c = 0; c < cols; c++) {
          tableHtml += `<td class="${tdBaseClass}" style="${tdBaseStyle}">&nbsp;</td>`;
        }
        tableHtml += `</tr>`;
      }
      tableHtml += `</tbody></table><p><br/></p>`;

      document.execCommand('insertHTML', false, tableHtml);
      handleEditorInput();
    }
    setOpenMenu(null);
  };

  const handleEditTable = (action: string) => {
    let table = activeTableRef.current;
    let row = activeRowRef.current;
    let cell = activeCellRef.current;

    // Fallback if not set but selection is available
    if (!table) {
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'TD' || node.nodeName === 'TH') cell = node as HTMLTableCellElement;
          if (node.nodeName === 'TR') row = node as HTMLTableRowElement;
          if (node.nodeName === 'TABLE') table = node as HTMLTableElement;
          node = node.parentNode;
        }
      }
    }

    // Secondary fallback: if still no table, try selecting the first table found in the editor
    if (!table && editorRef.current) {
      const firstTable = editorRef.current.querySelector('table');
      if (firstTable) {
        table = firstTable as HTMLTableElement;
        row = table.rows[0] as HTMLTableRowElement;
        cell = row ? (row.cells[0] as HTMLTableCellElement) : null;

        activeTableRef.current = table;
        activeRowRef.current = row;
        activeCellRef.current = cell;
      }
    }

    if (!table) {
      addNotification({
        title: 'Table Not Selected',
        message: 'Click inside a table cell to edit rows or columns.',
        type: 'info',
      });
      return;
    }

    if (action === 'delete-table') {
      table.remove();
      activeTableRef.current = null;
      activeRowRef.current = null;
      activeCellRef.current = null;
    } else if (action === 'clear-cell' && cell) {
      cell.innerHTML = '&nbsp;';
    } else if (action.startsWith('insert-row') && row) {
      const isAbove = action === 'insert-row-above';
      const insertIdx = isAbove ? row.rowIndex : row.rowIndex + 1;
      const newRow = table.insertRow(insertIdx);
      newRow.className = 'border-b border-slate-300 dark:border-white/10 hover:bg-slate-100/50 dark:hover:bg-white/5';
      const colCount = row.cells.length;
      for (let i = 0; i < colCount; i++) {
        const newCell = newRow.insertCell();
        newCell.className = 'p-2 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-slate-200 min-w-[60px]';
        newCell.innerHTML = '&nbsp;';
      }
    } else if (action.startsWith('insert-col') && cell && row) {
      const isLeft = action === 'insert-col-left';
      const colIdx = isLeft ? cell.cellIndex : cell.cellIndex + 1;
      Array.from(table.rows).forEach((r) => {
        const isHeader = r.parentElement?.tagName === 'THEAD';
        const newCell = r.insertCell(colIdx);
        newCell.className = `p-2 border border-slate-300 dark:border-white/20 ${isHeader ? 'font-bold text-cyan-600 dark:text-cyan-300 bg-slate-100 dark:bg-white/10' : 'text-slate-800 dark:text-slate-200 min-w-[60px]'}`;
        newCell.innerHTML = isHeader ? `Header` : '&nbsp;';
      });
    } else if (action === 'delete-row' && row) {
      row.remove();
      activeRowRef.current = null;
      activeCellRef.current = null;
    } else if (action === 'delete-col' && cell) {
      const colIdx = cell.cellIndex;
      Array.from(table.rows).forEach((r) => {
        if (r.cells[colIdx]) r.deleteCell(colIdx);
      });
      activeCellRef.current = null;
    }

    handleEditorInput();
  };

  const handleInsertTimeDate = () => {
    const now = new Date();
    const timeStr = `${formatTime(now)} ${formatDate(now)}`;
    insertTextAtCursor(timeStr);
  };

  // Clipboard operations
  const insertTextAtCursor = (textToInsert: string) => {
    if (!textToInsert) return;
    if (editorMode === 'plain' && plainTextRef.current) {
      const textarea = plainTextRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const originalValue = textarea.value;
      textarea.value = originalValue.substring(0, start) + textToInsert + originalValue.substring(end);
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      handlePlainTextChange(textarea.value);
    } else if (editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(textToInsert);
        range.insertNode(node);
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorRef.current.innerText += textToInsert;
      }
      handleEditorInput();
    }
  };

  const handleEditorCopy = () => {
    soundManager.playCopy();
  };

  const handleEditorCut = () => {
    soundManager.playCut();
  };

  const handleEditorPaste = () => {
    soundManager.playPaste();
  };

  const handleCut = () => {
    if (editorMode === 'plain' && plainTextRef.current) {
      plainTextRef.current.focus();
    } else if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand('cut');
    handleEditorInput();
    setOpenMenu(null);
  };

  const handleCopy = () => {
    if (editorMode === 'plain' && plainTextRef.current) {
      plainTextRef.current.focus();
    } else if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand('copy');
    setOpenMenu(null);
  };

  const handlePaste = async () => {
    setOpenMenu(null);
    if (editorMode === 'plain' && plainTextRef.current) {
      plainTextRef.current.focus();
    } else if (editorRef.current) {
      editorRef.current.focus();
    }

    let pastedText = '';

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
      try {
        pastedText = await navigator.clipboard.readText();
      } catch {
        // Fallback inside sandboxed iframe
      }
    }

    if (!pastedText && clipboardHistory && clipboardHistory.length > 0) {
      pastedText = clipboardHistory[0]?.content || '';
    }

    if (pastedText) {
      soundManager.playPaste();
      insertTextAtCursor(pastedText);
      addNotification({
        title: 'Pasted from Clipboard',
        message: `Inserted ${pastedText.length} character(s).`,
        type: 'info',
      });
    } else {
      setPasteModalText('');
      setShowPasteModal(true);
    }
  };

  const handleSelectAll = () => {
    if (editorMode === 'plain' && plainTextRef.current) {
      plainTextRef.current.focus();
      plainTextRef.current.select();
    } else if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('selectAll');
    }
    setOpenMenu(null);
  };

  // Save Operations
  const handleSave = () => {
    if (!activeTab.filePath) {
      openSaveAsDialog();
      return;
    }

    const plain = htmlToText(activeTab.htmlContent);
    const targetDir = activeTab.filePath.substring(0, activeTab.filePath.lastIndexOf('/')) || 'D:/Documents';
    const ext = activeTab.name.endsWith('.md') ? 'md' : 'txt';

    createFile(targetDir, activeTab.name, plain, ext as any);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, saved: true, originalContent: t.htmlContent } : t))
    );

    addNotification({
      title: 'File Saved',
      message: `Saved "${activeTab.name}" to ${targetDir}.`,
      type: 'success',
    });
    setOpenMenu(null);
  };

  const openSaveAsDialog = () => {
    setSaveAsFileName(activeTab.name === 'Untitled' ? 'Untitled.txt' : activeTab.name);
    setShowSaveAsModal(true);
    setOpenMenu(null);
  };

  const handleConfirmSaveAs = (targetFolder: string, finalName: string, fileType: string, encoding: string) => {
    if (!finalName.trim()) return;
    const extMatch = finalName.split('.').pop()?.toLowerCase() || 'txt';
    const isHtml = extMatch === 'html' || extMatch === 'htm';
    const isMd = extMatch === 'md';
    const fullPath = `${targetFolder}/${finalName}`;
    const fileBody = isHtml ? activeTab.htmlContent : htmlToText(activeTab.htmlContent);

    createFile(targetFolder, finalName, fileBody, extMatch as any);

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, name: finalName, saved: true, originalContent: t.htmlContent, filePath: fullPath, isMarkdown: isMd }
          : t
      )
    );

    setShowSaveAsModal(false);
    addNotification({
      title: 'File Saved Successfully',
      message: `Saved "${finalName}" to ${targetFolder}.`,
      type: 'success',
    });

    // Complete pending close triggers if any
    if (pendingCloseTab) {
      const closingTabId = pendingCloseTab.tabId;
      const isClosingApp = pendingCloseTab.closeAppOnDone;
      const nextTabs = tabs.filter((x) => x.id !== closingTabId);

      forceCloseTab(closingTabId);
      setPendingCloseTab(null);

      if (isClosingApp) {
        if (nextTabs.length === 0) {
          endProcess('notepad');
        } else {
          const remainingUnsaved = nextTabs.filter((x) => !x.saved || isTabModified(x));
          if (remainingUnsaved.length > 0) {
            setPendingCloseTab({
              tabId: remainingUnsaved[0].id,
              tabName: remainingUnsaved[0].name,
              closeAppOnDone: true,
            });
          } else {
            endProcess('notepad');
          }
        }
      }
    }
  };

  const handleSaveAll = () => {
    tabs.forEach((tab) => {
      const targetDir = tab.filePath
        ? tab.filePath.substring(0, tab.filePath.lastIndexOf('/')) || 'D:/Documents'
        : 'D:/Documents';
      const plain = htmlToText(tab.htmlContent);
      createFile(targetDir, tab.name === 'Untitled' ? `${tab.name}.txt` : tab.name, plain, tab.isMarkdown ? 'md' : 'txt');
    });

    setTabs((prev) => prev.map((t) => ({ ...t, saved: true, originalContent: t.htmlContent })));
    addNotification({
      title: 'All Files Saved',
      message: `Saved ${tabs.length} open tab(s) to OS storage.`,
      type: 'success',
    });
    setOpenMenu(null);
  };

  const handleOpenFile = (fileItem: { name: string; content?: string; path: string }) => {
    const rawContent = fileItem.content || '';
    const newHtml = textToHtml(rawContent);
    const newId = `tab-${Date.now()}`;
    const newTab: NoteTab = {
      id: newId,
      name: fileItem.name,
      htmlContent: newHtml,
      originalContent: newHtml,
      saved: true,
      filePath: fileItem.path,
      isMarkdown: fileItem.name.endsWith('.md'),
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setShowOpenModal(false);
    setOpenMenu(null);
  };

  const handleSearchWithBing = () => {
    let query = '';
    if (editorMode === 'plain' && plainTextRef.current) {
      const textarea = plainTextRef.current;
      query = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    } else {
      query = window.getSelection()?.toString() || '';
    }
    if (!query) {
      query = activeTab.name || 'Untitled';
    }
    openApp('browser', { url: `https://www.bing.com/search?q=${encodeURIComponent(query)}` });
  };

  const handleFind = (direction: 'next' | 'prev' = 'next') => {
    if (!findQuery) return;

    if (editorMode === 'plain' && plainTextRef.current) {
      const textarea = plainTextRef.current;
      const text = textarea.value;
      const query = findQuery;

      const textToSearch = matchCase ? text : text.toLowerCase();
      const queryToSearch = matchCase ? query : query.toLowerCase();

      const startIdx = textarea.selectionStart ?? 0;
      const endIdx = textarea.selectionEnd ?? 0;

      let index = -1;
      if (direction === 'next') {
        const searchFrom = startIdx === endIdx ? startIdx : startIdx + 1;
        index = textToSearch.indexOf(queryToSearch, searchFrom);
        if (index === -1) {
          // Wrap around to beginning
          index = textToSearch.indexOf(queryToSearch, 0);
        }
      } else {
        const searchFrom = startIdx - 1;
        index = textToSearch.lastIndexOf(queryToSearch, searchFrom);
        if (index === -1) {
          // Wrap around to end
          index = textToSearch.lastIndexOf(queryToSearch);
        }
      }

      if (index !== -1) {
        textarea.focus();
        textarea.setSelectionRange(index, index + query.length);
        const row = text.substring(0, index).split('\n').length;
        textarea.scrollTop = (row - 3) * 16;
      } else {
        addNotification({
          title: 'Find',
          message: `Cannot find "${findQuery}"`,
          type: 'info',
        });
      }
    } else if (editorRef.current) {
      try {
        const found = (window as any).find(
          findQuery,
          matchCase,
          direction === 'prev',
          true,
          false,
          false,
          false
        );
        if (!found) {
          addNotification({
            title: 'Find',
            message: `Cannot find "${findQuery}"`,
            type: 'info',
          });
        }
      } catch (err) {
        console.error("window.find error", err);
      }
    }
  };

  const handleReplace = (all: boolean = false) => {
    if (!findQuery || !editorRef.current) return;
    let currentHtml = editorRef.current.innerHTML;
    const flags = matchCase ? (all ? 'g' : '') : all ? 'gi' : 'i';
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const updatedHtml = currentHtml.replace(regex, replaceQuery);
    editorRef.current.innerHTML = updatedHtml;
    handleEditorInput();
  };

  const handleGoToLine = () => {
    const lineNum = parseInt(goToLineNumber);
    if (isNaN(lineNum) || lineNum < 1) return;

    if (editorMode === 'plain' && plainTextRef.current) {
      const textarea = plainTextRef.current;
      const text = textarea.value;
      const lines = text.split('\n');
      if (lineNum > lines.length) {
        addNotification({
          title: 'Go To Line',
          message: 'The line number is beyond the total number of lines.',
          type: 'info'
        });
        return;
      }
      let charPos = 0;
      for (let i = 0; i < lineNum - 1; i++) {
        charPos += lines[i].length + 1;
      }
      textarea.focus();
      textarea.setSelectionRange(charPos, charPos);
    } else if (editorRef.current) {
      const editor = editorRef.current;
      const text = editor.innerText;
      const lines = text.split('\n');
      if (lineNum > lines.length) {
        addNotification({
          title: 'Go To Line',
          message: 'The line number is beyond the total number of lines.',
          type: 'info'
        });
        return;
      }
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      let charPos = 0;
      for (let i = 0; i < lineNum - 1; i++) {
        charPos += lines[i].length + 1;
      }

      let currentLen = 0;
      let nodeToSelect: Node | null = null;
      let offsetInNode = 0;

      const findNode = (parent: Node) => {
        if (nodeToSelect) return;
        if (parent.nodeType === Node.TEXT_NODE) {
          const len = parent.textContent?.length || 0;
          if (currentLen + len >= charPos) {
            nodeToSelect = parent;
            offsetInNode = charPos - currentLen;
            return;
          }
          currentLen += len;
        } else {
          for (let i = 0; i < parent.childNodes.length; i++) {
            findNode(parent.childNodes[i]);
          }
        }
      };

      findNode(editor);
      if (nodeToSelect) {
        try {
          range.setStart(nodeToSelect, offsetInNode);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (err) {
          console.error(err);
        }
      }
    }
    setShowGoToModal(false);
  };



  const handleUndo = () => {
    if (editorMode === 'plain' && plainTextRef.current) {
      plainTextRef.current.focus();
    } else if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand('undo');
  };

  const handleRedo = () => {
    if (editorMode === 'plain' && plainTextRef.current) {
      plainTextRef.current.focus();
    } else if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand('redo');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          if (e.shiftKey) {
            openSaveAsDialog();
          } else {
            handleSave();
          }
        } else if (e.key === 'b') {
          e.preventDefault();
          handleBold();
        } else if (e.key === 'i') {
          e.preventDefault();
          handleItalic();
        } else if (e.key === 'n') {
          e.preventDefault();
          if (e.shiftKey) {
            openApp('notepad', { forceNewWindow: true }, true);
          } else {
            handleNewTab();
          }
        } else if (e.key === 'o') {
          e.preventDefault();
          setShowOpenModal(true);
        } else if (e.key === 'w') {
          e.preventDefault();
          handleCloseTab(activeTabId);
        } else if (e.key === 'f') {
          e.preventDefault();
          setShowFindReplace(true);
          setFindMode('find');
        } else if (e.key === 'h') {
          e.preventDefault();
          setShowFindReplace(true);
          setFindMode('replace');
        } else if (e.key === 'g') {
          e.preventDefault();
          if (!wordWrap) setShowGoToModal(true);
        } else if (e.key === 'e') {
          e.preventDefault();
          handleSearchWithBing();
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleInsertTimeDate();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleFind(e.shiftKey ? 'prev' : 'next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabs, activeTabId, wordWrap]);

  // Listen to document-wide selection changes to keep cursor stats completely in sync
  useEffect(() => {
    const handleSelectionChange = () => {
      const activeEl = document.activeElement;
      if (activeEl === editorRef.current || activeEl === plainTextRef.current) {
        updateCursorStats();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateCursorStats]);

  return (
    <div
      ref={rootContainerRef}
      className={`flex flex-col h-full font-sans select-none overflow-hidden relative ${
        isDark ? 'dark bg-[#1f1f1f] text-[#d4d4d4]' : 'bg-[#f3f3f3] text-[#1e1e1e]'
      }`}
      onClick={() => {
        if (openMenu) setOpenMenu(null);
      }}
    >
      {/* Tab Style Overrides to Hide Horizontal Scrollbars completely */}
      <style>{`
        .tabs-container-nosb::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>

      {/* Click outside overlay to close open menus */}
      {openMenu && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setOpenMenu(null)}
        />
      )}

      {/* 1. Windows 11 Integrated Tabs & Window Title Bar Header */}
      <div 
        data-window-header="true"
        className={`flex items-center justify-between px-2 pt-1.5 gap-1.5 select-none shrink-0 relative z-20 ${
          isDark ? 'bg-[#181818]' : 'bg-[#f0f0f0]'
        }`}
      >
        {/* Left Side: Tabs + New Tab Button */}
        <div
          className="flex items-end gap-1 overflow-x-auto overflow-y-hidden scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap flex-1 min-w-0 pr-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Tab Items with App Icon, Title & Close '✕' inside the tab */}
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isDraggingThis = draggedTabId === tab.id;
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
                className={`group relative flex items-center gap-2 px-3 h-[34px] rounded-t-[8px] text-xs transition-all cursor-pointer select-none shrink-0 ${
                  isDraggingThis ? 'opacity-40 scale-95' : ''
                } ${
                  isActive
                    ? isDark
                      ? 'bg-[#242424] text-white font-medium z-10'
                      : 'bg-white text-slate-900 font-medium z-10'
                    : isDark
                      ? 'bg-transparent hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 rounded-[6px] mb-0.5'
                      : 'bg-transparent hover:bg-black/5 text-slate-600 hover:text-slate-900 rounded-[6px] mb-0.5'
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                {/* Left & Right Inverted Fillet Wings for Active Tab - Seamless Windows 11 Menu Bar Connection */}
                {isActive && (
                  <>
                    <svg
                      className={`absolute -left-2 bottom-0 w-2 h-2 pointer-events-none ${
                        isDark ? 'text-[#242424]' : 'text-white'
                      }`}
                      viewBox="0 0 8 8"
                      fill="none"
                    >
                      <path d="M0 8h8V0C8 4.418 4.418 8 0 8z" fill="currentColor" />
                    </svg>
                    <svg
                      className={`absolute -right-2 bottom-0 w-2 h-2 pointer-events-none ${
                        isDark ? 'text-[#242424]' : 'text-white'
                      }`}
                      viewBox="0 0 8 8"
                      fill="none"
                    >
                      <path d="M8 8H0V0C0 4.418 3.582 8 8 8z" fill="currentColor" />
                    </svg>
                  </>
                )}

                <AppIcon name="Notepad" className="w-4 h-4 shrink-0 drop-shadow-xs" />
                <span className="truncate max-w-[140px] text-xs font-normal">{tab.name}</span>
                {!tab.saved && <span className="text-sky-400 font-bold ml-0.5">•</span>}
                <button
                  className={`w-5 h-5 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer ml-1 shrink-0 ${
                    isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                  }`}
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Close Tab (Ctrl+W)"
                >
                  <X className="w-3 h-3 stroke-[2]" />
                </button>
              </div>
            );
          })}

          {/* New Tab (+) Button */}
          <button
            className={`w-7 h-7 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-0.5 mb-1 ${
              isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            onClick={handleNewTab}
            title="New Tab (Ctrl+N)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        {/* Right Side: Windows 11 Title Bar Window Control Buttons */}
        <div className="flex items-center gap-0.5 shrink-0 pb-1" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              haptics.light();
              minimizeWindow(actualWindowId);
            }}
            className={`flex items-center justify-center w-8 sm:w-9 h-7 rounded cursor-pointer transition-colors ${
              !isDark ? 'hover:bg-black/10 text-slate-700 hover:text-slate-900' : 'hover:bg-white/15 text-slate-200 hover:text-white'
            }`}
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <div
            className="relative flex items-center z-[100]"
            onMouseEnter={handleSnapMouseEnter}
            onMouseLeave={handleSnapMouseLeave}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                haptics.light();
                maximizeWindow(actualWindowId);
              }}
              className={`flex items-center justify-center w-8 sm:w-9 h-7 rounded cursor-pointer transition-colors ${
                !isDark ? 'hover:bg-black/10 text-slate-700 hover:text-slate-900' : 'hover:bg-white/15 text-slate-200 hover:text-white'
              }`}
              title={showSnapMenu ? undefined : isMaximized ? 'Restore Down' : 'Maximize'}
            >
              {isMaximized ? <Square className="w-3 h-3 stroke-[2.5]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>

            {showSnapMenu && (
              <SnapLayoutMenu
                onSnap={(layout) => {
                  haptics.medium();
                  snapWindow(actualWindowId, layout);
                  setShowSnapMenu(false);
                }}
                onClose={() => setShowSnapMenu(false)}
              />
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              haptics.medium();
              const closeEvent = new CustomEvent('app-request-close', {
                bubbles: true,
                cancelable: true,
                detail: { windowId: actualWindowId, appId: 'notepad' },
              });
              const isPreventedWindow = !window.dispatchEvent(closeEvent);
              if (isPreventedWindow) return;
              if (windowId) {
                closeWindow(windowId);
              } else {
                endProcess('notepad');
              }
            }}
            className={`flex items-center justify-center w-8 sm:w-9 h-7 rounded hover:bg-red-500 hover:text-white cursor-pointer transition-colors ${
              !isDark ? 'text-slate-700' : 'text-slate-200'
            }`}
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Menu Bar & Rich Formatting Toolbar */}
      <div className={`flex items-center justify-between px-3 py-1 border-b text-xs relative shrink-0 overflow-x-auto scrollbar-none whitespace-nowrap gap-2 ${
        isDark ? 'bg-[#242424] border-[#2e2e2e] text-slate-300' : 'bg-white border-slate-200 text-slate-700'
      }`}>
        {/* Left: File, Edit, View Menus */}
        <div className="flex items-center gap-1">
          {/* File Menu */}
          <div className="relative">
            <button
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                isDark 
                  ? openMenu === 'file' ? 'bg-white/15 text-white font-semibold' : 'hover:bg-white/10' 
                  : openMenu === 'file' ? 'bg-black/10 text-black font-semibold' : 'hover:bg-black/5'
              }`}
              onClick={(e) => toggleDropdownMenu('file', e)}
            >
              File
            </button>

            {openMenu === 'file' && activeMenuPos && (
              <div
                style={{ top: activeMenuPos.top, left: activeMenuPos.left }}
                className={`fixed z-[9999] w-56 border rounded-xl shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 ${
                  isDark ? 'bg-[#252526] border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNewTab();
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Plus className="w-3.5 h-3.5" /><span>New tab</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+N</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openApp('notepad', { forceNewWindow: true }, true);
                    setOpenMenu(null);
                  }}
                >
                  <span>New window</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+Shift+N</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowOpenModal(true);
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /><span>Open...</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+O</span>
                </button>
                <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSave();
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Save className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" /><span>Save</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+S</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openSaveAsDialog();
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Download className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /><span>Save as...</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+Shift+S</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveAll();
                    setOpenMenu(null);
                  }}
                >
                  <span>Save all</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+Alt+S</span>
                </button>
                <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCloseTab(activeTabId);
                    setOpenMenu(null);
                  }}
                >
                  <span>Close tab</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+W</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMenu(null);
                    const unsavedTab = tabs.find((t) => !t.saved || isTabModified(t));
                    if (unsavedTab) {
                      setPendingCloseTab({
                        tabId: unsavedTab.id,
                        tabName: unsavedTab.name,
                        closeAppOnDone: true,
                      });
                    } else {
                      if (windowId) {
                        closeWindow(windowId);
                      } else {
                        endProcess('notepad');
                      }
                    }
                  }}
                >
                  <span>Exit</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500/70' : 'text-slate-400'}`}>Alt+F4</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              className={`px-2.5 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                openMenu === 'edit' ? 'bg-white/15 text-white font-semibold' : ''
              }`}
              onClick={(e) => toggleDropdownMenu('edit', e)}
            >
              Edit
            </button>

            {openMenu === 'edit' && activeMenuPos && (
              <div
                style={{ top: activeMenuPos.top, left: activeMenuPos.left }}
                className={`fixed z-[9999] w-56 border rounded-xl shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 ${
                  isDark ? 'bg-[#252526] border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUndo();
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Undo2 className="w-3.5 h-3.5" /><span>Undo</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+Z</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRedo();
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Redo2 className="w-3.5 h-3.5" /><span>Redo</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+Y</span>
                </button>
                <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCut();
                  }}
                >
                  <div className="flex items-center gap-2"><Scissors className="w-3.5 h-3.5" /><span>Cut</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+X</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopy();
                  }}
                >
                  <div className="flex items-center gap-2"><Copy className="w-3.5 h-3.5" /><span>Copy</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+C</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePaste();
                  }}
                >
                  <div className="flex items-center gap-2"><Clipboard className="w-3.5 h-3.5" /><span>Paste</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+V</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    execFormat('delete');
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /><span>Delete</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Del</span>
                </button>
                <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSearchWithBing();
                    setOpenMenu(null);
                  }}
                >
                  <span>Search with Bing...</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+E</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowFindReplace(true);
                    setFindMode('find');
                    setOpenMenu(null);
                  }}
                >
                  <div className="flex items-center gap-2"><Search className="w-3.5 h-3.5" /><span>Find...</span></div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+F</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFind('next');
                    setOpenMenu(null);
                  }}
                >
                  <span>Find Next</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>F3</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFind('prev');
                    setOpenMenu(null);
                  }}
                >
                  <span>Find Previous</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Shift+F3</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowFindReplace(true);
                    setFindMode('replace');
                    setOpenMenu(null);
                  }}
                >
                  <span>Replace...</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+H</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left ${
                    wordWrap
                      ? isDark ? 'text-slate-600 opacity-50 cursor-not-allowed' : 'text-slate-400 opacity-50 cursor-not-allowed'
                      : isDark ? 'hover:bg-white/10 cursor-pointer text-slate-200' : 'hover:bg-black/5 cursor-pointer text-slate-700'
                  }`}
                  disabled={wordWrap}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!wordWrap) {
                      setShowGoToModal(true);
                      setOpenMenu(null);
                    }
                  }}
                >
                  <span>Go To...</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+G</span>
                </button>
                <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectAll();
                  }}
                >
                  <span>Select all</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+A</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleInsertTimeDate();
                    setOpenMenu(null);
                  }}
                >
                  <span>Time/Date</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>F5</span>
                </button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              className={`px-2.5 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                openMenu === 'view' ? 'bg-white/15 text-white font-semibold' : ''
              }`}
              onClick={(e) => toggleDropdownMenu('view', e)}
            >
              View
            </button>

            {openMenu === 'view' && activeMenuPos && (
              <div
                style={{ top: activeMenuPos.top, left: activeMenuPos.left }}
                className={`fixed z-[9999] w-56 border rounded-xl shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 ${
                  isDark ? 'bg-[#252526] border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold text-[9px]">Zoom</div>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setZoomLevel((z) => Math.min(200, z + 10));
                    setOpenMenu(null);
                  }}
                >
                  <span>Zoom In</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+Plus</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setZoomLevel((z) => Math.max(50, z - 10));
                    setOpenMenu(null);
                  }}
                >
                  <span>Zoom Out</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+Minus</span>
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setZoomLevel(100);
                    setOpenMenu(null);
                  }}
                >
                  <span>Restore default zoom</span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ctrl+0</span>
                </button>

                <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowStatusBar(!showStatusBar);
                    setOpenMenu(null);
                  }}
                >
                  <span>Status bar</span>
                  {showStatusBar && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWordWrap(!wordWrap);
                    setOpenMenu(null);
                  }}
                >
                  <span>Word wrap</span>
                  {wordWrap && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditorMode(editorMode === 'rich' ? 'plain' : 'rich');
                    setOpenMenu(null);
                  }}
                >
                  <span>Rich Formatting Mode</span>
                  {editorMode === 'rich' && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </button>

                <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

                <div className="px-3 py-1 text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold text-[9px]">App Theme</div>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSetTheme('light');
                    setOpenMenu(null);
                  }}
                >
                  <span>Light Theme</span>
                  {appTheme === 'light' && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSetTheme('dark');
                    setOpenMenu(null);
                  }}
                >
                  <span>Dark Theme</span>
                  {appTheme === 'dark' && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </button>
                <button
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSetTheme('system');
                    setOpenMenu(null);
                  }}
                >
                  <span>System Default</span>
                  {appTheme === 'system' && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Rich Formatting Toolbar (Positioned in Center of Menu Bar) */}
        {editorMode === 'rich' ? (
          <div className="flex-1 flex items-center justify-center px-2">
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg border transition-colors ${
              isDark 
                ? 'bg-white/[0.04] border-white/10 text-slate-300 shadow-xs' 
                : 'bg-white/80 border-slate-200 text-slate-700 shadow-xs'
            }`}>
              {/* Headings Style Dropdown */}
              <div className="relative">
                <button
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                    isDark 
                      ? openMenu === 'heading' ? 'bg-white/15 text-white' : 'hover:bg-white/10 text-slate-200' 
                      : openMenu === 'heading' ? 'bg-black/10 text-black' : 'hover:bg-black/5 text-slate-700'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => toggleDropdownMenu('heading', e)}
                  title="Headings"
                >
                  <span className="font-semibold text-xs">
                    {activeHeading === 'h1' ? 'H1' :
                     activeHeading === 'h2' ? 'H2' :
                     activeHeading === 'h3' ? 'H3' :
                     activeHeading === 'h4' ? 'H4' :
                     activeHeading === 'h5' ? 'H5' :
                     activeHeading === 'h6' ? 'H6' :
                     'H1'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {openMenu === 'heading' && activeMenuPos && (
                  <div
                    style={{ top: activeMenuPos.top, left: activeMenuPos.left }}
                    className={`fixed z-[9999] w-48 border rounded-xl shadow-2xl p-1.5 space-y-0.5 select-none animate-in fade-in zoom-in-95 overflow-hidden ${
                      isDark ? 'bg-[#202020] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 1. Title */}
                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center cursor-pointer transition-colors ${
                        activeHeading === 'h1'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHeading('h1');
                      }}
                    >
                      {activeHeading === 'h1' && (
                        <span className="w-1 h-5 bg-cyan-400 dark:bg-[#4cc2ff] rounded-full mr-2 shrink-0" />
                      )}
                      <span className="text-[26px] leading-[32px] font-normal tracking-tight">Title</span>
                    </button>

                    {/* 2. Subtitle */}
                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center cursor-pointer transition-colors ${
                        activeHeading === 'h2'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHeading('h2');
                      }}
                    >
                      {activeHeading === 'h2' && (
                        <span className="w-1 h-4.5 bg-cyan-400 dark:bg-[#4cc2ff] rounded-full mr-2 shrink-0" />
                      )}
                      <span className="text-[20px] leading-[26px] font-normal">Subtitle</span>
                    </button>

                    {/* 3. Heading */}
                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center cursor-pointer transition-colors ${
                        activeHeading === 'h3'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHeading('h3');
                      }}
                    >
                      {activeHeading === 'h3' && (
                        <span className="w-1 h-4 bg-cyan-400 dark:bg-[#4cc2ff] rounded-full mr-2 shrink-0" />
                      )}
                      <span className="text-[17px] leading-[22px] font-semibold">Heading</span>
                    </button>

                    {/* 4. Subheading */}
                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center cursor-pointer transition-colors ${
                        activeHeading === 'h4'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHeading('h4');
                      }}
                    >
                      {activeHeading === 'h4' && (
                        <span className="w-1 h-3.5 bg-cyan-400 dark:bg-[#4cc2ff] rounded-full mr-2 shrink-0" />
                      )}
                      <span className="text-[15px] leading-[20px] font-semibold">Subheading</span>
                    </button>

                    {/* 5. Section */}
                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center cursor-pointer transition-colors ${
                        activeHeading === 'h5'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHeading('h5');
                      }}
                    >
                      {activeHeading === 'h5' && (
                        <span className="w-1 h-3.5 bg-cyan-400 dark:bg-[#4cc2ff] rounded-full mr-2 shrink-0" />
                      )}
                      <span className="text-[14px] leading-[18px] font-medium">Section</span>
                    </button>

                    {/* 6. Subsection */}
                    <button
                      className={`w-full px-3 py-1 rounded-lg text-left flex items-center cursor-pointer transition-colors ${
                        activeHeading === 'h6'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHeading('h6');
                      }}
                    >
                      {activeHeading === 'h6' && (
                        <span className="w-1 h-3 bg-cyan-400 dark:bg-[#4cc2ff] rounded-full mr-2 shrink-0" />
                      )}
                      <span className="text-[13px] leading-[16px] font-medium">Subsection</span>
                    </button>

                    {/* 7. Body */}
                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center cursor-pointer transition-colors ${
                        activeHeading === 'p'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyHeading('p');
                      }}
                    >
                      {activeHeading === 'p' && (
                        <span className="w-1 h-3.5 bg-cyan-400 dark:bg-[#4cc2ff] rounded-full mr-2 shrink-0" />
                      )}
                      <span className="text-[13px] leading-[18px] font-normal">Body</span>
                    </button>
                  </div>
                )}
              </div>

              {/* List Styles Dropdown */}
              <div className="relative">
                <button
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
                    isDark 
                      ? openMenu === 'list' ? 'bg-white/15 text-white' : 'hover:bg-white/10 text-slate-200' 
                      : openMenu === 'list' ? 'bg-black/10 text-black' : 'hover:bg-black/5 text-slate-700'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => toggleDropdownMenu('list', e)}
                  title="List Styles"
                >
                  <List className="w-3.5 h-3.5" />
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {openMenu === 'list' && activeMenuPos && (
                  <div
                    style={{ top: activeMenuPos.top, left: activeMenuPos.left }}
                    className={`fixed z-[9999] w-52 border rounded-xl shadow-2xl p-1.5 text-xs space-y-0.5 animate-in fade-in zoom-in-95 overflow-hidden select-none ${
                      isDark ? 'bg-[#202020] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center justify-between cursor-pointer transition-colors ${
                        activeList === 'none'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10 text-rose-300' : 'hover:bg-black/5 text-rose-600'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('none');
                      }}
                      title="Clear list formatting"
                    >
                      <span className="flex items-center gap-2">
                        {activeList === 'none' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-1" />}
                        <span>None (Normal text)</span>
                      </span>
                      <span className="text-[10px] opacity-70">✕</span>
                    </button>

                    <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center gap-2 cursor-pointer transition-colors ${
                        activeList === 'disc'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('disc');
                      }}
                    >
                      {activeList === 'disc' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-0.5" />}
                      <List className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Bullet list (•)</span>
                    </button>

                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center gap-2 cursor-pointer transition-colors ${
                        activeList === '1'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('1');
                      }}
                    >
                      {activeList === '1' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-0.5" />}
                      <ListOrdered className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Numbering (1, 2, 3...)</span>
                    </button>

                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center gap-2 cursor-pointer transition-colors ${
                        activeList === 'A'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('A');
                      }}
                    >
                      {activeList === 'A' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-0.5" />}
                      <span className="w-3.5 text-center font-bold font-mono text-[11px] text-cyan-400 shrink-0">A.</span>
                      <span>Alphabet uppercase (A, B, C...)</span>
                    </button>

                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center gap-2 cursor-pointer transition-colors ${
                        activeList === 'a'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('a');
                      }}
                    >
                      {activeList === 'a' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-0.5" />}
                      <span className="w-3.5 text-center font-bold font-mono text-[11px] text-cyan-400 shrink-0">a.</span>
                      <span>Alphabet lowercase (a, b, c...)</span>
                    </button>

                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center gap-2 cursor-pointer transition-colors ${
                        activeList === 'i'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('i');
                      }}
                    >
                      {activeList === 'i' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-0.5" />}
                      <span className="w-3.5 text-center font-bold font-mono text-[11px] text-cyan-400 shrink-0">i.</span>
                      <span>Roman numerals (i, ii, iii...)</span>
                    </button>

                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center gap-2 cursor-pointer transition-colors ${
                        activeList === 'I'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('I');
                      }}
                    >
                      {activeList === 'I' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-0.5" />}
                      <span className="w-3.5 text-center font-bold font-mono text-[11px] text-cyan-400 shrink-0">I.</span>
                      <span>Roman uppercase (I, II, III...)</span>
                    </button>

                    <button
                      className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center gap-2 cursor-pointer transition-colors ${
                        activeList === 'task'
                          ? isDark ? 'bg-white/[0.08]' : 'bg-black/[0.06]'
                          : isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyListStyle('task');
                      }}
                    >
                      {activeList === 'task' && <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-0.5" />}
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Task checklist (✓)</span>
                    </button>
                  </div>
                )}
              </div>

              <div className={`h-3.5 w-px mx-0.5 ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

              {/* Direct Formatting Buttons */}
              <button
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-black/5 hover:text-black text-slate-600'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleBold}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <button
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-black/5 hover:text-black text-slate-600'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleItalic}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <button
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-black/5 hover:text-black text-slate-600'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleStrikethrough}
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              <div className={`h-3.5 w-px mx-0.5 ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

              <button
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-black/5 hover:text-black text-slate-600'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={openLinkModal}
                title="Insert Link"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>

              {/* Table Button - Directly opens the Table modal pop-up */}
              <button
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 hover:text-white text-slate-300' : 'hover:bg-black/5 hover:text-black text-slate-600'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTableModalTab(activeTableRef.current ? 'actions' : 'create');
                  setShowTableModal(true);
                }}
                title="Insert / Edit Table"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right Side: Quick Mode Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditorMode(editorMode === 'rich' ? 'plain' : 'rich')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              isDark 
                ? 'hover:bg-white/10 text-zinc-400 hover:text-white' 
                : 'hover:bg-black/5 text-slate-500 hover:text-slate-800'
            }`}
            title="Toggle between Rich Document and Plain Text Editor"
          >
            {editorMode === 'rich' ? 'Rich' : 'Plain'}
          </button>
        </div>
      </div>

      {/* 3. Find and Replace Floating Panel */}
      {showFindReplace && (
        <div className={`flex items-center justify-between px-3 py-2 border-b text-xs gap-2 animate-in slide-in-from-top-2 shrink-0 transition-colors duration-200 ${
          isDark ? 'bg-[#252526] border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              placeholder="Find text..."
              value={findQuery || ''}
              onChange={(e) => setFindQuery(e.target.value)}
              className={`px-2.5 py-1 rounded border text-xs focus:outline-none focus:border-cyan-500 w-40 font-mono ${
                isDark ? 'bg-[#1e1e1e] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
              autoFocus
            />
            {findMode === 'replace' && (
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceQuery || ''}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className={`px-2.5 py-1 rounded border text-xs focus:outline-none focus:border-cyan-500 w-40 font-mono ${
                  isDark ? 'bg-[#1e1e1e] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            )}
            <button
              className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
              onClick={() => handleFind('next')}
            >
              Find Next
            </button>
            <button
              className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
              onClick={() => handleFind('prev')}
            >
              Find Previous
            </button>
            {findMode === 'replace' && (
              <>
                <button
                  className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                    isDark ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                  }`}
                  onClick={() => handleReplace(false)}
                >
                  Replace
                </button>
                <button
                  className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                    isDark ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                  }`}
                  onClick={() => handleReplace(true)}
                >
                  Replace All
                </button>
              </>
            )}
            <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="accent-cyan-500 rounded cursor-pointer w-3.5 h-3.5"
              />
              <span>Match case</span>
            </label>
          </div>
          <button
            className={`p-1 rounded cursor-pointer transition-colors ${
              isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setShowFindReplace(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Main Document Workspace */}
      <div className={`flex-1 overflow-y-auto p-6 cursor-text select-text relative transition-colors duration-200 ${
        isDark ? 'bg-[#1f1f1f] text-[#cccccc]' : 'bg-white text-slate-800'
      }`}>
        {editorMode === 'rich' ? (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onKeyUp={updateCursorStats}
            onMouseUp={updateCursorStats}
            onClick={updateCursorStats}
            onSelect={updateCursorStats}
            onCopy={handleEditorCopy}
            onCut={handleEditorCut}
            onPaste={handleEditorPaste}
            style={{
              fontSize: `${14 * (zoomLevel / 100)}px`,
              lineHeight: '1.6',
            }}
            className={`min-h-full outline-none focus:outline-none font-sans notepad-editor transition-colors duration-200 ${
              isDark ? 'text-[#cccccc]' : 'text-slate-800'
            } ${
              wordWrap ? 'break-words' : 'whitespace-pre overflow-x-auto'
            }`}
          />
        ) : (
          <textarea
            ref={plainTextRef}
            value={htmlToText(activeTab.htmlContent)}
            onChange={(e) => handlePlainTextChange(e.target.value)}
            onKeyUp={updateCursorStats}
            onMouseUp={updateCursorStats}
            onSelect={updateCursorStats}
            onCopy={handleEditorCopy}
            onCut={handleEditorCut}
            onPaste={handleEditorPaste}
            style={{
              fontFamily: 'Consolas, "Cascadia Code", monospace',
              fontSize: `${13 * (zoomLevel / 100)}px`,
            }}
            className={`w-full h-full bg-transparent outline-none resize-none transition-colors duration-200 ${
              isDark ? 'text-[#cccccc]' : 'text-slate-800'
            } ${
              wordWrap ? 'break-words' : 'whitespace-pre overflow-x-auto'
            }`}
            placeholder="Type plain text..."
          />
        )}
      </div>

      {/* 5. Bottom Status Bar */}
      {showStatusBar && (
        <div className={`flex items-center justify-between px-3 py-1 border-t text-[11px] select-none shrink-0 z-20 transition-colors duration-200 overflow-x-auto scrollbar-none whitespace-nowrap gap-4 ${
          isDark ? 'bg-[#181818] border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center gap-3 shrink-0">
            <span>Ln {stats.ln}, Col {stats.col}</span>
            <span>{stats.chars} characters</span>
            <span>{stats.words} words</span>
            {tableSelectionInfo && (
              <span className={`font-medium px-2 py-0.5 border rounded flex items-center gap-1.5 animate-in fade-in transition-colors duration-200 ${
                isDark 
                  ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60' 
                  : 'text-cyan-700 bg-cyan-50 border-cyan-200'
              }`}>
                <TableIcon className="w-3 h-3" />
                Table: Row {tableSelectionInfo.curRow}/{tableSelectionInfo.totalRows}, Col {tableSelectionInfo.curCol}/{tableSelectionInfo.totalCols} {tableSelectionInfo.isHeader ? '(Header)' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span>{editorMode === 'rich' ? 'Rich Document' : 'Plain Text'}</span>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono ${
              isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-200/60 border-slate-300 text-slate-700'
            }`}>
              <button
                className={`px-1 py-0 rounded transition-colors cursor-pointer font-bold leading-none ${
                  isDark ? 'hover:bg-white/15 text-white' : 'hover:bg-black/10 text-black'
                }`}
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                title="Zoom Out (Ctrl+-)"
              >
                -
              </button>
              <span className="min-w-[32px] text-center">{zoomLevel}%</span>
              <button
                className={`px-1 py-0 rounded transition-colors cursor-pointer font-bold leading-none ${
                  isDark ? 'hover:bg-white/15 text-white' : 'hover:bg-black/10 text-black'
                }`}
                onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                title="Zoom In (Ctrl++)"
              >
                +
              </button>
            </div>
            <span>Windows (CRLF)</span>
            <span>UTF-8</span>
          </div>
        </div>
      )}

      {/* Extracted Dialog Modals */}
      <GoToModal
        isOpen={showGoToModal}
        onClose={() => setShowGoToModal(false)}
        lineNumber={goToLineNumber}
        onChangeLineNumber={setGoToLineNumber}
        onGoTo={handleGoToLine}
      />

      <LinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        displayText={linkDisplayText}
        onChangeDisplayText={setLinkDisplayText}
        address={linkAddress}
        onChangeAddress={setLinkAddress}
        onInsert={handleInsertLink}
      />

      <PasteModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        text={pasteModalText}
        onChangeText={setPasteModalText}
        onInsert={() => {
          insertTextAtCursor(pasteModalText);
          setShowPasteModal(false);
        }}
      />

      <TableModal
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        tab={tableModalTab}
        setTab={setTableModalTab}
        rows={customTableRows}
        setRows={setCustomTableRows}
        cols={customTableCols}
        setCols={setCustomTableCols}
        hasHeader={customTableHasHeader}
        setHasHeader={setCustomTableHasHeader}
        style={customTableStyle}
        setStyle={setCustomTableStyle}
        onInsertTable={insertTable}
        onEditTable={handleEditTable}
      />

      <UnsavedChangesModal
        isOpen={!!pendingCloseTab && !showSaveAsModal}
        tabName={pendingCloseTab?.tabName || ''}
        isDark={isDark}
        onSave={() => {
          if (pendingCloseTab) {
            const t = tabs.find((x) => x.id === pendingCloseTab.tabId);
            if (t) {
              if (t.filePath) {
                const plain = htmlToText(t.htmlContent);
                const targetDir = t.filePath.substring(0, t.filePath.lastIndexOf('/')) || 'D:/Documents';
                createFile(targetDir, t.name, plain, t.name.endsWith('.md') ? 'md' : 'txt');
                forceCloseTab(pendingCloseTab.tabId);
                const isClosingApp = pendingCloseTab.closeAppOnDone;
                setPendingCloseTab(null);
                if (isClosingApp) {
                  if (windowId) {
                    closeWindow(windowId);
                  } else {
                    endProcess('notepad');
                  }
                }
              } else {
                setSaveAsFileName(t.name);
                setShowSaveAsModal(true);
              }
            }
          }
        }}
        onDontSave={() => {
          if (pendingCloseTab) {
            forceCloseTab(pendingCloseTab.tabId);
            const isClosingApp = pendingCloseTab.closeAppOnDone;
            setPendingCloseTab(null);
            if (isClosingApp) {
              if (windowId) {
                closeWindow(windowId);
              } else {
                endProcess('notepad');
              }
            }
          }
        }}
        onCancel={() => setPendingCloseTab(null)}
      />

      {/* Shared SaveAs File Dialog for Saving files */}
      <SaveAsModal
        mode="save"
        isOpen={showSaveAsModal}
        isDark={isDark}
        initialFileName={saveAsFileName}
        initialFileType={saveAsFileType}
        fileTypes={NOTEPAD_FILE_TYPES}
        onClose={() => setShowSaveAsModal(false)}
        onSave={(targetFolder, finalName, fileType, encoding) => {
          handleConfirmSaveAs(targetFolder, finalName, fileType, encoding);
        }}
      />

      {/* Shared SaveAs File Dialog for Opening files */}
      <SaveAsModal
        mode="open"
        isOpen={showOpenModal}
        isDark={isDark}
        initialFileType={NOTEPAD_FILE_TYPES[NOTEPAD_FILE_TYPES.length - 1].label}
        onClose={() => setShowOpenModal(false)}
        onOpen={(file) => handleOpenFile({ name: file.name, content: file.content, path: file.path })}
        title="Open"
      />
    </div>
  );
};
