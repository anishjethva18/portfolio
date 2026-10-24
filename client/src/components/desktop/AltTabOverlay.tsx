import React, { useEffect, useState } from 'react';
import { useOS } from '../../context/OSContext';
import { AppIcon } from '../common/AppIcon';
import { X } from 'lucide-react';
import { soundManager } from '../../utils/sound';

interface AltTabOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AltTabOverlay: React.FC<AltTabOverlayProps> = ({ isOpen, onClose }) => {
  const { windows, focusWindow, closeWindow } = useOS();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const openWindows = windows.filter((w) => !w.isMinimized || true); // show all windows

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setSelectedIndex((prev) => (e.shiftKey ? (prev - 1 + openWindows.length) % openWindows.length : (prev + 1) % openWindows.length));
        soundManager.playClick();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % openWindows.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + openWindows.length) % openWindows.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (openWindows[selectedIndex]) {
          focusWindow(openWindows[selectedIndex].id);
        }
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openWindows, selectedIndex, focusWindow, onClose]);

  if (!isOpen || openWindows.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[99996] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full p-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/15 backdrop-blur-2xl shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
          <span>Task Switcher (Alt + Tab)</span>
          <span>{openWindows.length} Active Windows</span>
        </div>

        {/* Windows Grid Thumbnails */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1">
          {openWindows.map((win, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div
                key={win.id}
                className={`group relative flex flex-col rounded-2xl p-3 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/30 scale-102 shadow-xl'
                    : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-white/10 hover:border-blue-400/50 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
                onClick={() => {
                  focusWindow(win.id);
                  onClose();
                }}
              >
                {/* Window header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <AppIcon name={win.icon} className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {win.title}
                    </span>
                  </div>
                  <button
                    className="p-1 rounded-md hover:bg-rose-500 hover:text-white text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWindow(win.id);
                    }}
                    title="Close Window"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Window Preview Thumbnail */}
                <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-950 border border-slate-300/60 dark:border-white/5 overflow-hidden flex flex-col justify-center items-center p-3 text-center space-y-1">
                  <AppIcon name={win.icon} className="w-8 h-8 text-blue-500 opacity-80" />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-full font-medium">
                    {win.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
