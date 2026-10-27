import React from 'react';

export type SnapDockZone =
  | 'maximize'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | null;

interface SnapDockPreviewOverlayProps {
  zone: SnapDockZone;
}

export const SnapDockPreviewOverlay: React.FC<SnapDockPreviewOverlayProps> = ({ zone }) => {
  if (!zone) return null;

  let style: React.CSSProperties = {};

  switch (zone) {
    case 'maximize':
      style = {
        top: 8,
        left: 8,
        width: 'calc(100vw - 16px)',
        height: 'calc(100vh - 56px - 16px)',
      };
      break;
    case 'left':
      style = {
        top: 8,
        left: 8,
        width: 'calc(50vw - 12px)',
        height: 'calc(100vh - 56px - 16px)',
      };
      break;
    case 'right':
      style = {
        top: 8,
        left: 'calc(50vw + 4px)',
        width: 'calc(50vw - 12px)',
        height: 'calc(100vh - 56px - 16px)',
      };
      break;
    case 'top-left':
      style = {
        top: 8,
        left: 8,
        width: 'calc(50vw - 12px)',
        height: 'calc((100vh - 56px)/2 - 12px)',
      };
      break;
    case 'top-right':
      style = {
        top: 8,
        left: 'calc(50vw + 4px)',
        width: 'calc(50vw - 12px)',
        height: 'calc((100vh - 56px)/2 - 12px)',
      };
      break;
    case 'bottom-left':
      style = {
        top: 'calc((100vh - 56px)/2 + 4px)',
        left: 8,
        width: 'calc(50vw - 12px)',
        height: 'calc((100vh - 56px)/2 - 12px)',
      };
      break;
    case 'bottom-right':
      style = {
        top: 'calc((100vh - 56px)/2 + 4px)',
        left: 'calc(50vw + 4px)',
        width: 'calc(50vw - 12px)',
        height: 'calc((100vh - 56px)/2 - 12px)',
      };
      break;
  }

  return (
    <div
      style={style}
      className="fixed z-[99999] pointer-events-none transition-all duration-150 ease-out rounded-2xl bg-blue-500/20 dark:bg-blue-400/20 backdrop-blur-md border-2 border-blue-400 dark:border-blue-300 shadow-[0_8px_32px_rgba(0,120,212,0.35)] animate-in fade-in zoom-in-95"
    >
      <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-400/10 to-transparent flex items-center justify-center">
        <div className="px-3 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span>
            {zone === 'maximize'
              ? 'Maximize Window'
              : zone === 'left'
              ? 'Snap Left (50%)'
              : zone === 'right'
              ? 'Snap Right (50%)'
              : zone === 'top-left'
              ? 'Snap Top-Left (25%)'
              : zone === 'top-right'
              ? 'Snap Top-Right (25%)'
              : zone === 'bottom-left'
              ? 'Snap Bottom-Left (25%)'
              : 'Snap Bottom-Right (25%)'}
          </span>
        </div>
      </div>
    </div>
  );
};
