import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useOS } from '../../context/OSContext';
import { formatDate } from '../../utils/dateTime';
import { AppIcon } from '../common/AppIcon';
import { MediaThumbnail } from '../common/MediaThumbnail';
import { DesktopIconItem } from '../../types';
import { useLongPress } from '../../utils/useLongPress';
import { haptics } from '../../utils/haptics';
import { isMediaFile } from '../../utils/fileAssociations';

interface DesktopIconProps {
  iconItem: DesktopIconItem;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}

export const DesktopIcon: React.FC<DesktopIconProps> = ({ iconItem, isSelected, onSelect }) => {
  const { openApp, settings, renameDesktopIcon, deleteDesktopIcon, showContextMenu, updateDesktopIconPosition, files } = useOS();
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(iconItem?.name || '');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setName(iconItem?.name || '');
  }, [iconItem?.name]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [customPos, setCustomPos] = useState<{ x: number; y: number } | null>(null);

  const longPressProps = useLongPress(
    (e, coords) => {
      const clientX = coords?.x ?? (('touches' in e && e.touches?.[0]) ? e.touches[0].clientX : ('clientX' in e ? (e as React.MouseEvent).clientX : 0));
      const clientY = coords?.y ?? (('touches' in e && e.touches?.[0]) ? e.touches[0].clientY : ('clientY' in e ? (e as React.MouseEvent).clientY : 0));
      showContextMenu({
        type: 'desktop-icon',
        x: clientX,
        y: clientY,
        iconId: iconItem.id,
      });
    },
    { threshold: 600, hapticFeedback: true }
  );

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const iconSizes = {
    small: { cellW: 90, cellH: 94, container: 'w-[72px] sm:w-[82px] min-h-[80px] sm:min-h-[84px] py-1 px-0.5', icon: 'w-7 h-7', text: 'text-[10px] sm:text-[11px]' },
    medium: { cellW: 108, cellH: 110, container: 'w-[76px] sm:w-[100px] min-h-[84px] sm:min-h-[96px] py-1 px-1', icon: 'w-8 h-8 sm:w-9 sm:h-9', text: 'text-[11px] sm:text-xs' },
    large: { cellW: 124, cellH: 124, container: 'w-[84px] sm:w-[118px] min-h-[92px] sm:min-h-[108px] py-1.5 px-1', icon: 'w-9 h-9 sm:w-11 sm:h-11', text: 'text-[11px] sm:text-xs' },
  };

  const currentSize = iconSizes[settings.iconSize] || iconSizes.medium;
  const isLongSingleWord = iconItem.name.length > 10 && !iconItem.name.includes(' ');
  const textClass = isLongSingleWord 
    ? 'text-[10px] sm:text-[11px] tracking-tight'
    : currentSize.text;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  const mobileCols = isMobile ? Math.max(3, Math.floor((screenWidth - 16) / 84)) : 4;
  const CELL_WIDTH = isMobile ? Math.floor((screenWidth - 16) / mobileCols) : currentSize.cellW;
  const CELL_HEIGHT = isMobile ? 86 : currentSize.cellH;
  const PADDING_LEFT = isMobile ? 8 : 16;
  const PADDING_TOP = isMobile ? 44 : 16;

  const defaultLeft = PADDING_LEFT + (iconItem.position?.gridX || 0) * CELL_WIDTH;
  const defaultTop = PADDING_TOP + (iconItem.position?.gridY || 0) * CELL_HEIGHT;

  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const pointerDownRef = useRef(false);
  const dragReadyRef = useRef(false);

  const executeAction = useCallback(() => {
    haptics.light();
    if (iconItem.appId) {
      openApp(iconItem.appId);
    } else if (iconItem.type === 'folder') {
      openApp('explorer', { path: iconItem.filePath || 'D:/Desktop', initialPath: iconItem.filePath || 'D:/Desktop' });
    } else if (iconItem.filePath) {
      if (iconItem.filePath.toLowerCase().endsWith('.pdf')) {
        openApp('resume');
      } else if (isMediaFile(iconItem.filePath)) {
        openApp('photos', { filePath: iconItem.filePath });
      } else {
        openApp('notepad', { filePath: iconItem.filePath });
      }
    } else if (iconItem.url) {
      window.open(iconItem.url, '_blank');
    }
  }, [iconItem, openApp]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    executeAction();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(e);
    if (isMobile && !isRenaming) {
      executeAction();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu({
      type: 'desktop-icon',
      x: e.clientX,
      y: e.clientY,
      iconId: iconItem.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      renameDesktopIcon(iconItem.id, name);
      setIsRenaming(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setName(iconItem.name);
      setIsRenaming(false);
    }
  };

  // Keyboard shortcut listener for F2 (Rename), Delete / Backspace (Delete), Enter (Open), Escape (Cancel)
  useEffect(() => {
    if (!isSelected || isRenaming) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        setIsRenaming(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isRenaming) {
          e.preventDefault();
          deleteDesktopIcon(iconItem.id);
        }
      } else if (e.key === 'Enter') {
        if (!isRenaming) {
          e.preventDefault();
          if (iconItem.appId) {
            openApp(iconItem.appId);
          } else if (iconItem.type === 'folder' && iconItem.filePath) {
            openApp('explorer', { path: iconItem.filePath });
          } else if (iconItem.filePath) {
            if (iconItem.filePath.toLowerCase().endsWith('.pdf')) {
              openApp('resume');
            } else if (isMediaFile(iconItem.filePath)) {
              openApp('photos', { filePath: iconItem.filePath });
            } else {
              openApp('notepad', { filePath: iconItem.filePath });
            }
          }
        }
      } else if (e.key === 'Escape') {
        if (isRenaming) {
          setName(iconItem.name);
          setIsRenaming(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSelected, isRenaming, iconItem, deleteDesktopIcon, openApp]);

  // Listen for context menu inline rename trigger
  useEffect(() => {
    const handleStartRename = (e: any) => {
      if (e.detail?.id === iconItem.id) {
        setIsRenaming(true);
      }
    };
    window.addEventListener('start-inline-rename', handleStartRename);
    return () => window.removeEventListener('start-inline-rename', handleStartRename);
  }, [iconItem.id]);

  // Drag and drop logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isRenaming) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerDownRef.current = true;
    dragReadyRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    holdTimerRef.current = window.setTimeout(() => {
      if (pointerDownRef.current) {
        dragReadyRef.current = true;
        setIsDragging(true);
      }
    }, 400);
  };

  const handleTouchStartCustom = (e: React.TouchEvent) => {
    if (isRenaming) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    pointerDownRef.current = true;
    dragReadyRef.current = false;
    pointerStartRef.current = { x: touch.clientX, y: touch.clientY };
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    holdTimerRef.current = window.setTimeout(() => {
      if (pointerDownRef.current) {
        dragReadyRef.current = true;
        setIsDragging(true);
      }
    }, 420);
  };

  const handleTouchMoveCustom = (e: React.TouchEvent) => {
    longPressProps.onTouchMove(e);
    if (!pointerDownRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const moved = Math.hypot(
      touch.clientX - pointerStartRef.current.x,
      touch.clientY - pointerStartRef.current.y
    );
    if (moved <= 32) return;
    if (!dragReadyRef.current) {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      pointerDownRef.current = false;
      return;
    }
    e.preventDefault();
    setCustomPos({
      x: Math.max(0, Math.min(window.innerWidth - 90, touch.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 100, touch.clientY - dragOffset.y)),
    });
  };

  const cancelUnheldPress = (x: number, y: number) => {
    if (!pointerDownRef.current || dragReadyRef.current) return;
    if (Math.hypot(x - pointerStartRef.current.x, y - pointerStartRef.current.y) <= 8) return;
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    pointerDownRef.current = false;
  };

  const handlePressEnd = () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    pointerDownRef.current = false;
    if (!dragReadyRef.current) setIsDragging(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      if (Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y) <= 12) return;
      setCustomPos({
        x: Math.max(0, Math.min(window.innerWidth - 90, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y)),
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (Math.hypot(touch.clientX - pointerStartRef.current.x, touch.clientY - pointerStartRef.current.y) <= 32) return;
      setCustomPos({
        x: Math.max(0, Math.min(window.innerWidth - 90, touch.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, touch.clientY - dragOffset.y)),
      });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (customPos) {
          const gridX = Math.max(0, Math.floor((customPos.x - PADDING_LEFT + CELL_WIDTH / 2) / CELL_WIDTH));
          const gridY = Math.max(0, Math.floor((customPos.y - PADDING_TOP + CELL_HEIGHT / 2) / CELL_HEIGHT));
          updateDesktopIconPosition(iconItem.id, { gridX, gridY });
          setCustomPos(null);
        }
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, dragOffset, customPos, iconItem.id, updateDesktopIconPosition]);

  const gridStyle = customPos
    ? { position: 'absolute' as const, left: customPos.x, top: customPos.y, zIndex: 50 }
    : {
        position: 'absolute' as const,
        left: defaultLeft,
        top: defaultTop,
      };

  const activeAccent = settings.accentColor || '#0078d4';
  const activeIconColor = settings.iconColor || activeAccent;

  return (
    <div
      data-desktop-icon="true"
      data-desktop-icon-id={iconItem.id}
      draggable={false}
      className={`group flex flex-col items-center justify-start rounded-lg select-none cursor-pointer transition-all duration-150 ${
        currentSize.container
      } ${
        isSelected
          ? 'border backdrop-blur-sm shadow-sm'
          : 'hover:bg-white/15 dark:hover:bg-white/15 border border-transparent'
      }`}
      style={{
        ...gridStyle,
        ...(isSelected ? { backgroundColor: `${activeAccent}35`, borderColor: `${activeAccent}80` } : {}),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => cancelUnheldPress(e.clientX, e.clientY)}
      onMouseUp={handlePressEnd}
      onMouseLeave={(e) => {
        if (e.buttons === 0) handlePressEnd();
      }}
      onTouchStart={(e) => {
        longPressProps.onTouchStart(e);
        handleTouchStartCustom(e);
      }}
      onTouchMove={handleTouchMoveCustom}
      onTouchEnd={(e) => {
        handlePressEnd();
        const wasLongPress = longPressProps.didTriggerLongPress();
        longPressProps.onTouchEnd(e);
        if (wasLongPress) {
          // Do not process tap/click if a long press context menu was just triggered
          return;
        }
        if (!customPos) {
          onSelect(e as unknown as React.MouseEvent);
          if (isMobile && !isRenaming) {
            executeAction();
          }
        }
      }}
    >
      {/* Icon Graphic Container with subtle hover scale */}
      <div className="relative flex items-center justify-center p-0.5 group-hover:scale-105 transition-transform shrink-0">
        <div
          className={`flex items-center justify-center drop-shadow-md ${currentSize.icon}`}
          style={{ color: activeIconColor }}
        >
          {iconItem.filePath && isMediaFile(iconItem.filePath) ? (
            <div className="w-full h-full p-0.5">
              <MediaThumbnail
                item={
                  files.find((f) => f.path === iconItem.filePath) || {
                    id: iconItem.id,
                    name: iconItem.name,
                    path: iconItem.filePath,
                    type: 'file' as const,
                    extension: iconItem.filePath.split('.').pop()?.toLowerCase() || 'png',
                    modified: formatDate(new Date()),
                    parentId: 'desktop',
                  }
                }
                sizeClass="w-full h-full"
              />
            </div>
          ) : (
            <AppIcon
              appId={iconItem.appId || (iconItem.id === 'trash' ? 'recycle' : iconItem.id)}
              name={iconItem.icon}
              className="w-full h-full"
              size={settings.iconSize === 'small' ? 24 : settings.iconSize === 'large' ? 44 : 34}
              color={activeIconColor}
            />
          )}
        </div>
      </div>

      {/* Label or Inline Rename */}
      {isRenaming ? (
        <input
          type="text"
          value={name || ''}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            renameDesktopIcon(iconItem.id, name);
            setIsRenaming(false);
          }}
          autoFocus
          className="w-full mt-0.5 px-1 py-0.5 text-center text-xs bg-white text-slate-900 dark:bg-slate-800 dark:text-white rounded border outline-none shadow-lg"
          style={{ borderColor: activeAccent }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`mt-0.5 px-1 py-0.5 text-center font-medium leading-tight text-white drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.95)] line-clamp-2 max-w-full break-keep rounded select-none ${textClass}`}
        >
          {iconItem.name}
        </span>
      )}
    </div>
  );
};
