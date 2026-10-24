import React, { useState } from 'react';
import { useOS } from '../../context/OSContext';
import { ClipboardHistoryEntry } from '../../types';
import { Clipboard, Pin, Trash2, Search, X, Check, Code, FileText, Image as ImageIcon } from 'lucide-react';
import { soundManager } from '../../utils/sound';

interface ClipboardHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClipboardHistoryModal: React.FC<ClipboardHistoryModalProps> = ({ isOpen, onClose }) => {
  const { clipboardHistory = [], removeClipboardHistory, clearClipboardHistory, togglePinClipboardItem, addNotification } = useOS();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredItems = (clipboardHistory || []).filter((item) =>
    item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.label && item.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCopyItem = async (item: ClipboardHistoryEntry) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.content);
      }
    } catch {}
    setCopiedId(item.id);
    soundManager.playClick();
    addNotification({
      title: 'Pasted from Clipboard',
      message: item.content.slice(0, 50) + (item.content.length > 50 ? '...' : ''),
      type: 'info',
    });
    setTimeout(() => {
      setCopiedId(null);
      onClose();
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Clipboard className="w-4 h-4 text-blue-500" />
            <span>Clipboard History</span>
            <span className="text-[11px] font-normal text-slate-400">Win + V</span>
          </div>

          <div className="flex items-center gap-1">
            {clipboardHistory.length > 0 && (
              <button
                className="px-2 py-1 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                onClick={clearClipboardHistory}
                title="Clear unpinned items"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear all</span>
              </button>
            )}
            <button
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 cursor-pointer"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clipboard history..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              autoFocus
            />
          </div>
        </div>

        {/* List of Clips */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-96">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Clipboard className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <p className="text-xs">Your clipboard history is empty</p>
              <p className="text-[10px] text-slate-500">Copy items (Ctrl+C) to see them here</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/5 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
                onClick={() => handleCopyItem(item)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {item.type === 'code' ? (
                      <Code className="w-3 h-3 text-emerald-500" />
                    ) : item.type === 'image' ? (
                      <ImageIcon className="w-3 h-3 text-purple-500" />
                    ) : (
                      <FileText className="w-3 h-3 text-blue-500" />
                    )}
                    <span>{item.label || item.type}</span>
                    <span>•</span>
                    <span>{item.timestamp}</span>
                  </div>

                  {/* Actions: Pin / Delete */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 ${
                        item.pinned ? 'text-blue-500 opacity-100' : 'text-slate-400'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinClipboardItem(item.id);
                      }}
                      title={item.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${item.pinned ? 'fill-blue-500 text-blue-500' : ''}`} />
                    </button>
                    <button
                      className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClipboardHistory(item.id);
                      }}
                      title="Delete from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content text */}
                <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-3 font-mono break-all whitespace-pre-wrap">
                  {item.content}
                </p>

                {/* Copied indicator */}
                {copiedId === item.id && (
                  <div className="absolute inset-0 rounded-xl bg-blue-600/90 text-white flex items-center justify-center gap-1.5 text-xs font-bold animate-in fade-in duration-100">
                    <Check className="w-4 h-4" /> Pasted to active field
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-100/60 dark:bg-slate-800/40 border-t border-slate-200 dark:border-white/5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Click any item to paste</span>
          <span>Pinned items stay after clearing</span>
        </div>
      </div>
    </div>
  );
};
