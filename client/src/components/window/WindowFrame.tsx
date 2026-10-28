import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { useOS } from '../../context/OSContext';
import { WindowState } from '../../types';
import { AppIcon } from '../common/AppIcon';
import { Minus, Maximize2, Square, X } from 'lucide-react';
import { SnapLayoutMenu } from './SnapLayoutMenu';
import { SnapDockPreviewOverlay, SnapDockZone } from './SnapDockPreviewOverlay';
import { haptics } from '../../utils/haptics';
import { soundManager } from '../../utils/sound';

interface WindowFrameProps {
  windowState: WindowState;
  children: React.ReactNode;
}

interface ViewportBounds {
  width: number;
  height: number;
  left: number;
  top: number;
  statusBarHeight: number;
  taskbarHeight: number;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ windowState, children }) => {
  const {
    focusWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    updateWindowPosition,
    updateWindowSize,
    snapWindow,
    settings,
  } = useOS();

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeSnapZone, setActiveSnapZone] = useState<SnapDockZone>(null);
  const activeSnapZoneRef = useRef<SnapDockZone>(null);
  activeSnapZoneRef.current = activeSnapZone;

  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    posX: 0,
    posY: 0,
  });
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds>(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
    left: 0,
    top: 0,
    statusBarHeight: 0,
    taskbarHeight: 0,
  }));

  const windowRef = useRef<HTMLDivElement>(null);
  const snapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const handleSnapMouseEnter = () => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => setShowSnapMenu(true), 250);
  };

  const handleSnapMouseLeave = () => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => setShowSnapMenu(false), 200);
  };

  const handleSnapTouchStart = () => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      haptics.medium();
      setShowSnapMenu((prev) => !prev);
    }, 350);
  };

  const handleSnapTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const { id, title, icon, isMinimized, isMaximized, isFocused, position, size, zIndex } = windowState;

  // Window Dragging - Mouse
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (isMaximized || e.button !== 0) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    focusWindow(id);
  };

  const isMobile = viewportBounds.width < 640;
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const updateViewportBounds = () => {
      const visualViewport = window.visualViewport;
      const width = visualViewport?.width ?? window.innerWidth;
      const height = visualViewport?.height ?? window.innerHeight;
      const statusBar = document.getElementById('mobile-status-bar');
      const taskbar = document.getElementById('taskbar-container');
      setViewportBounds({
        width,
        height,
        left: visualViewport?.offsetLeft ?? 0,
        top: visualViewport?.offsetTop ?? 0,
        statusBarHeight: width < 640 ? statusBar?.getBoundingClientRect().height ?? 32 : 0,
        taskbarHeight: settings.taskbarAutoHide ? 0 : taskbar?.getBoundingClientRect().height ?? 48,
      });
    };

    updateViewportBounds();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateViewportBounds);
    const statusBar = document.getElementById('mobile-status-bar');
    const taskbar = document.getElementById('taskbar-container');
    if (statusBar) resizeObserver?.observe(statusBar);
    if (taskbar) resizeObserver?.observe(taskbar);
    window.addEventListener('resize', updateViewportBounds);
    window.visualViewport?.addEventListener('resize', updateViewportBounds);
    window.visualViewport?.addEventListener('scroll', updateViewportBounds);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateViewportBounds);
      window.visualViewport?.removeEventListener('resize', updateViewportBounds);
      window.visualViewport?.removeEventListener('scroll', updateViewportBounds);
    };
  }, [settings.taskbarAutoHide]);

  // Auto-detect narrow mobile viewport and apply full-screen mode by default for newly opened application
  const hasInitializedMobileFullscreen = useRef(false);
  useEffect(() => {
    if (!hasInitializedMobileFullscreen.current) {
      hasInitializedMobileFullscreen.current = true;
      if (typeof window !== 'undefined' && (window.innerWidth < 640 || settings.lockPortrait) && !isMaximized) {
        maximizeWindow(id);
      }
    } else if (settings.lockPortrait && !isMaximized) {
      maximizeWindow(id);
    }
  }, [id, maximizeWindow, isMaximized, settings.lockPortrait]);

  // Window Dragging & Gestures - Touch
  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    if (!isMaximized) {
      setIsDragging(true);
      setDragOffset({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      });
    }
    focusWindow(id);
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartPos.current.x;
      const deltaY = touch.clientY - touchStartPos.current.y;

      // Swipe down gesture to minimize
      if (deltaY > 90 && Math.abs(deltaX) < 60) {
        minimizeWindow(id);
      }
      // Swipe left gesture on titlebar to close
      else if (deltaX < -100 && Math.abs(deltaY) < 60) {
        closeWindow(id);
      }
    }
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (isDragging) {
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 80;
        const newX = Math.max(-100, Math.min(maxX, clientX - dragOffset.x));
        const newY = Math.max(0, Math.min(maxY, clientY - dragOffset.y));
        updateWindowPosition(id, { x: newX, y: newY });

        // Edge detection for Snap Layout Preview
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const EDGE_THRESHOLD = 20;
        const CORNER_THRESHOLD = 45;

        let detectedZone: SnapDockZone = null;

        if (clientY <= 15) {
          // Top edge: Maximize
          detectedZone = 'maximize';
        } else if (clientX <= CORNER_THRESHOLD && clientY <= 100) {
          detectedZone = 'top-left';
        } else if (clientX <= CORNER_THRESHOLD && clientY >= winH - 140) {
          detectedZone = 'bottom-left';
        } else if (clientX <= EDGE_THRESHOLD) {
          detectedZone = 'left';
        } else if (clientX >= winW - CORNER_THRESHOLD && clientY <= 100) {
          detectedZone = 'top-right';
        } else if (clientX >= winW - CORNER_THRESHOLD && clientY >= winH - 140) {
          detectedZone = 'bottom-right';
        } else if (clientX >= winW - EDGE_THRESHOLD) {
          detectedZone = 'right';
        }

        if (detectedZone !== activeSnapZoneRef.current) {
          if (detectedZone && !activeSnapZoneRef.current) {
            haptics.light();
          }
          setActiveSnapZone(detectedZone);
        }
      } else if (isResizing) {
        const deltaX = clientX - resizeStart.startX;
        const deltaY = clientY - resizeStart.startY;
        const MIN_W = 320;
        const MIN_H = 220;

        let newW = resizeStart.startW;
        let newH = resizeStart.startH;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;

        // Horizontal resizing
        if (isResizing.includes('e')) {
          newW = Math.max(MIN_W, resizeStart.startW + deltaX);
        } else if (isResizing.includes('w')) {
          const rawW = resizeStart.startW - deltaX;
          newW = Math.max(MIN_W, rawW);
          newX = resizeStart.posX + (resizeStart.startW - newW);
        }

        // Vertical resizing
        if (isResizing.includes('s')) {
          newH = Math.max(MIN_H, resizeStart.startH + deltaY);
        } else if (isResizing.includes('n')) {
          const rawH = resizeStart.startH - deltaY;
          newH = Math.max(MIN_H, rawH);
          newY = resizeStart.posY + (resizeStart.startH - newH);
        }

        updateWindowSize(id, { width: newW, height: newH });
        if (newX !== resizeStart.posX || newY !== resizeStart.posY) {
          updateWindowPosition(id, { x: newX, y: newY });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        const finalZone = activeSnapZoneRef.current;
        if (finalZone) {
          haptics.heavy();
          soundManager.playWindowSnap();
          if (finalZone === 'maximize') {
            maximizeWindow(id);
          } else {
            snapWindow(id, finalZone);
          }
          setActiveSnapZone(null);
        }
      }
      if (isResizing) setIsResizing(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('touchcancel', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, id, updateWindowPosition, updateWindowSize, maximizeWindow, snapWindow]);

  // Window Resizing Handles
  const handleResizeStart = (direction: string) => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isMaximized) {
      maximizeWindow(id);
    }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsResizing(direction);
    setResizeStart({
      startX: clientX,
      startY: clientY,
      startW: size.width,
      startH: size.height,
      posX: position.x,
      posY: position.y,
    });
    focusWindow(id);
  };

  // Dynamic styling based on maximized vs windowed mode
  const activeAccent = settings.accentColor || '#0078d4';
  const isEffectivelyMaximized = isMaximized;

  const availableHeight = Math.max(
    0,
    viewportBounds.height - viewportBounds.statusBarHeight - viewportBounds.taskbarHeight
  );
  const windowWidth = isMobile ? Math.min(viewportBounds.width, size.width) : size.width;
  const windowHeight = isMobile ? Math.min(availableHeight, size.height) : size.height;
  const windowLeft = isMobile
    ? Math.min(
        Math.max(viewportBounds.left, position.x),
        viewportBounds.left + viewportBounds.width - windowWidth
      )
    : Math.max(0, position.x);
  const windowTop = isMobile
    ? Math.min(
        Math.max(viewportBounds.top + viewportBounds.statusBarHeight, position.y),
        viewportBounds.top + viewportBounds.height - viewportBounds.taskbarHeight - windowHeight
      )
    : Math.max(0, position.y);

  const windowStyle: React.CSSProperties = isEffectivelyMaximized
    ? {
        top: isMobile ? viewportBounds.top + viewportBounds.statusBarHeight : 0,
        left: isMobile ? viewportBounds.left : 0,
        width: isMobile ? viewportBounds.width : '100vw',
        height: isMobile
          ? `${availableHeight}px`
          : (settings.taskbarAutoHide ? '100vh' : `calc(100vh - ${viewportBounds.taskbarHeight}px)`),
        zIndex,
        borderRadius: 0,
        borderColor: isFocused ? activeAccent : 'rgba(150, 150, 150, 0.4)',
        borderWidth: isFocused ? '2px' : '1px',
        boxShadow: isFocused ? `0 0 0 2px ${activeAccent}, 0 25px 50px -12px rgba(0,0,0,0.4)` : '0 10px 30px rgba(0,0,0,0.3)',
      }
    : {
        top: windowTop,
        left: windowLeft,
        width: windowWidth,
        height: windowHeight,
        zIndex,
        borderRadius: isMobile ? 12 : 12,
        borderColor: isFocused ? activeAccent : 'rgba(150, 150, 150, 0.4)',
        borderWidth: isFocused ? '2px' : '1px',
        boxShadow: isFocused ? `0 0 0 2px ${activeAccent}, 0 25px 50px -12px rgba(0,0,0,0.5)` : '0 10px 25px -5px rgba(0,0,0,0.3)',
      };

  return (
    <motion.div
      ref={windowRef}
      data-window="true"
      data-window-app={windowState.appId}
      initial={{ opacity: 0, scale: 0.92, y: 16 }}
      animate={
        isMinimized
          ? { opacity: 0, scale: 0.78, y: 100, pointerEvents: 'none' }
          : { opacity: 1, scale: 1, y: 0, pointerEvents: 'auto' }
      }
      exit={{ opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.16, ease: 'easeOut' } }}
      transition={{
        type: 'spring',
        damping: 30,
        stiffness: 380,
        mass: 0.75,
      }}
      className={`fixed flex flex-col overflow-hidden select-none bg-white dark:bg-[#1e1e20] ${
        isFocused ? 'shadow-2xl' : 'shadow-lg'
      }`}
      style={windowStyle}
      // Focus the clicked window before its child action runs. This lets a
      // nested openApp() action raise the destination window without the
      // source window's bubbling click stealing focus back afterward.
      onPointerDownCapture={() => focusWindow(id)}
    >
      {/* Title Bar (Hidden for File Explorer, Browser, and Notepad to integrate tabs seamlessly in top header) */}
      {windowState.appId !== 'explorer' && windowState.appId !== 'browser' && windowState.appId !== 'notepad' && (
        <div
          className="flex items-center justify-between h-10 sm:h-9 px-3 border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#18181b] cursor-default select-none touch-none shrink-0"
          onMouseDown={handleHeaderMouseDown}
          onTouchStart={handleHeaderTouchStart}
          onTouchEnd={handleHeaderTouchEnd}
          onDoubleClick={() => maximizeWindow(id)}
        >
          {/* App Icon & Title */}
          <div className="flex items-center gap-2.5 truncate max-w-[60%] sm:max-w-[65%]">
            <div className="text-blue-500 dark:text-blue-400 shrink-0">
              <AppIcon appId={windowState.appId} name={icon} className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
              {title}
            </span>
          </div>

          {/* Window Controls (Minimize, Maximize, Close) */}
          <div
            className="relative flex items-center h-full gap-1 sm:gap-0.5"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Minimize */}
            <button
              className="flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-8 sm:min-h-7 rounded hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                haptics.light();
                minimizeWindow(id);
              }}
              title="Minimize"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Maximize / Restore + Snap Layout Hover & Mobile Long-Press */}
            <div
              className="relative flex items-center z-[100]"
              onMouseEnter={handleSnapMouseEnter}
              onMouseLeave={handleSnapMouseLeave}
            >
              <button
                className="flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-8 sm:min-h-7 rounded hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                onTouchStart={handleSnapTouchStart}
                onTouchEnd={handleSnapTouchEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLongPressRef.current) {
                    isLongPressRef.current = false;
                    return;
                  }
                  haptics.light();
                  maximizeWindow(id);
                }}
                title={showSnapMenu ? undefined : isMaximized ? 'Restore (Long-press for Snap)' : 'Maximize (Long-press for Snap)'}
              >
                {isMaximized ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Snap Layout Flyout Menu */}
              {showSnapMenu && (
                <SnapLayoutMenu
                  onSnap={(layout) => {
                    haptics.medium();
                    snapWindow(id, layout);
                  }}
                  onClose={() => setShowSnapMenu(false)}
                />
              )}
            </div>

            {/* Close */}
            <button
              className="flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-8 sm:min-h-7 rounded hover:bg-red-500 hover:text-white text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                haptics.medium();
                const closeEvent = new CustomEvent('app-request-close', {
                  bubbles: true,
                  cancelable: true,
                  detail: { windowId: id, appId: windowState.appId },
                });
                const isPreventedWindow = !window.dispatchEvent(closeEvent);
                const isPreventedRef = windowRef.current ? !windowRef.current.dispatchEvent(closeEvent) : false;
                if (isPreventedWindow || isPreventedRef) {
                  return;
                }
                closeWindow(id);
              }}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Window Body */}
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#1e1e20] text-slate-900 dark:text-slate-100 font-sans"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-window-header="true"]')) {
            handleHeaderMouseDown(e);
          }
        }}
        onTouchStart={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-window-header="true"]')) {
            handleHeaderTouchStart(e);
          }
        }}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-window-header="true"]') && !target.closest('button')) {
            maximizeWindow(id);
          }
        }}
      >
        {children}
      </div>

      {/* Full 8-direction Window Edge & Corner Resizing Handles */}
      {!isMaximized && (
        <>
          {/* Edges */}
          <div
            className="absolute top-0 left-3 right-3 h-3 sm:h-1.5 cursor-n-resize z-40 touch-none"
            onMouseDown={handleResizeStart('n')}
            onTouchStart={handleResizeStart('n')}
            title="Resize Window Top"
          />
          <div
            className="absolute bottom-0 left-3 right-3 h-3.5 sm:h-2 cursor-s-resize z-40 touch-none"
            onMouseDown={handleResizeStart('s')}
            onTouchStart={handleResizeStart('s')}
            title="Resize Window Bottom"
          />
          <div
            className="absolute left-0 top-3 bottom-3 w-3.5 sm:w-1.5 cursor-w-resize z-40 touch-none"
            onMouseDown={handleResizeStart('w')}
            onTouchStart={handleResizeStart('w')}
            title="Resize Window Left"
          />
          <div
            className="absolute right-0 top-3 bottom-3 w-3.5 sm:w-2 cursor-e-resize z-40 touch-none"
            onMouseDown={handleResizeStart('e')}
            onTouchStart={handleResizeStart('e')}
            title="Resize Window Right"
          />

          {/* Corners */}
          <div
            className="absolute top-0 left-0 w-6 h-6 sm:w-3.5 sm:h-3.5 cursor-nw-resize z-50 touch-none"
            onMouseDown={handleResizeStart('nw')}
            onTouchStart={handleResizeStart('nw')}
          />
          <div
            className="absolute top-0 right-0 w-6 h-6 sm:w-3.5 sm:h-3.5 cursor-ne-resize z-50 touch-none"
            onMouseDown={handleResizeStart('ne')}
            onTouchStart={handleResizeStart('ne')}
          />
          <div
            className="absolute bottom-0 left-0 w-6 h-6 sm:w-3.5 sm:h-3.5 cursor-sw-resize z-50 touch-none"
            onMouseDown={handleResizeStart('sw')}
            onTouchStart={handleResizeStart('sw')}
          />
          <div
            className="absolute bottom-0 right-0 w-6 h-6 sm:w-4 sm:h-4 cursor-se-resize z-50 touch-none"
            onMouseDown={handleResizeStart('se')}
            onTouchStart={handleResizeStart('se')}
          />
        </>
      )}
      {/* Snap Layout Docking Preview Overlay */}
      {isDragging && activeSnapZone && <SnapDockPreviewOverlay zone={activeSnapZone} />}
    </motion.div>
  );
};
