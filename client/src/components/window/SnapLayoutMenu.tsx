import React, { useEffect, useRef } from 'react';

export type SnapLayoutType =
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
  | 'restore';

interface SnapLayoutMenuProps {
  onSnap: (layout: SnapLayoutType) => void;
  onClose: () => void;
}

export const SnapLayoutMenu: React.FC<SnapLayoutMenuProps> = ({ onSnap, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute top-full right-0 mt-1.5 z-[99999] w-64 max-w-[calc(100vw-24px)] p-3 rounded-2xl border border-slate-200/90 dark:border-white/15 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.35)] text-xs select-none animate-in fade-in zoom-in-95 duration-150 space-y-2.5"
      onMouseLeave={onClose}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-1">
        <span>Snap Layouts</span>
        <span className="font-mono text-[9px] bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-300">Win + Z</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Layout 1: Left / Right Split */}
        <div className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex gap-1 h-14">
          <button
            className="w-1/2 h-full rounded-lg bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('left');
              onClose();
            }}
            title="Snap Left (50%)"
          />
          <button
            className="w-1/2 h-full rounded-lg bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('right');
              onClose();
            }}
            title="Snap Right (50%)"
          />
        </div>

        {/* Layout 2: Top / Bottom Split (Mobile & Multi-Tasking) */}
        <div className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-1 h-14">
          <button
            className="w-full h-1/2 rounded-md bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('top');
              onClose();
            }}
            title="Snap Top (50%)"
          />
          <button
            className="w-full h-1/2 rounded-md bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('bottom');
              onClose();
            }}
            title="Snap Bottom (50%)"
          />
        </div>

        {/* Layout 3: 4 Quadrants (2x2) */}
        <div className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 grid grid-cols-2 gap-1 h-14">
          <button
            className="rounded bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('top-left');
              onClose();
            }}
            title="Top Left"
          />
          <button
            className="rounded bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('top-right');
              onClose();
            }}
            title="Top Right"
          />
          <button
            className="rounded bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('bottom-left');
              onClose();
            }}
            title="Bottom Left"
          />
          <button
            className="rounded bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors"
            onClick={() => {
              onSnap('bottom-right');
              onClose();
            }}
            title="Bottom Right"
          />
        </div>

        {/* Layout 4: Restore / Full Split */}
        <div className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-center items-center h-14">
          <button
            className="w-full h-full rounded-lg bg-blue-500/20 hover:bg-blue-600 border border-blue-500/40 hover:border-blue-600 cursor-pointer transition-colors flex items-center justify-center font-bold text-[10px] text-blue-500 hover:text-white"
            onClick={() => {
              onSnap('restore');
              onClose();
            }}
            title="Restore Window Size"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
};
