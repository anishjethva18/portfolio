import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { haptics } from '../../utils/haptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: 'half' | 'full' | 'auto';
  showCloseButton?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  height = 'half',
  showCloseButton = true,
}) => {
  const [dragY, setDragY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const startYRef = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      haptics.light();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startYRef.current;
    if (delta > 0) {
      setDragY(delta);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 120) {
      haptics.medium();
      onClose();
    } else {
      setDragY(0);
    }
  };

  const heightClass =
    height === 'full'
      ? 'h-[92vh]'
      : height === 'half'
      ? 'h-[55vh]'
      : 'max-h-[85vh] h-auto';

  return (
    <div
      id="bottom-sheet-overlay"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex flex-col justify-end transition-opacity duration-200 animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className={`w-full ${heightClass} bg-white dark:bg-slate-900 rounded-t-3xl border-t border-white/20 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,20px)] transition-transform duration-150 select-none animate-in slide-in-from-bottom`}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle Bar Header */}
        <div
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Title & Header Actions */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 py-2 border-b border-slate-200/60 dark:border-white/10">
            {title ? (
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {title}
              </h3>
            ) : (
              <div />
            )}
            {showCloseButton && (
              <button
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                onClick={() => {
                  haptics.light();
                  onClose();
                }}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Sheet Content Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 smooth-scroll">
          {children}
        </div>
      </div>
    </div>
  );
};
