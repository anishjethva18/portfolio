import React, { useCallback, useRef } from 'react';
import { haptics } from './haptics';

interface UseLongPressOptions {
  threshold?: number;
  onStart?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
  hapticFeedback?: boolean;
}

export function useLongPress(
  callback: (e: React.TouchEvent | React.MouseEvent, coords?: { x: number; y: number }) => void,
  options: UseLongPressOptions = {}
) {
  const {
    threshold = 380,
    onStart,
    onFinish,
    onCancel,
    hapticFeedback = true,
  } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = useRef(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressActive.current = false;
      let capturedX = 0;
      let capturedY = 0;
      if ('touches' in e && e.touches.length > 0) {
        capturedX = e.touches[0].clientX;
        capturedY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        capturedX = (e as React.MouseEvent).clientX;
        capturedY = (e as React.MouseEvent).clientY;
      }
      startPos.current = { x: capturedX, y: capturedY };

      onStart?.();

      timerRef.current = setTimeout(() => {
        isLongPressActive.current = true;
        if (typeof window !== 'undefined') {
          (window as any).__lastLongPressTime = Date.now();
          (window as any).__isLongPressActiveNow = true;
        }
        if (hapticFeedback) {
          haptics.heavy();
        }
        callback(e, { x: capturedX, y: capturedY });
        onFinish?.();
      }, threshold);
    },
    [callback, threshold, onStart, onFinish, hapticFeedback]
  );

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerCancel = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (isLongPressActive.current) {
        // Prevent default click / native contextmenu following a long-press touch lift
        try {
          if ('preventDefault' in e && typeof e.preventDefault === 'function') {
            e.preventDefault();
          }
          if ('stopPropagation' in e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
          }
        } catch {}
        setTimeout(() => {
          isLongPressActive.current = false;
          if (typeof window !== 'undefined') {
            (window as any).__isLongPressActiveNow = false;
          }
        }, 500);
      } else if (shouldTriggerCancel) {
        onCancel?.();
      }
    },
    [onCancel]
  );

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      let currentX = 0;
      let currentY = 0;
      if ('touches' in e && e.touches.length > 0) {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        currentX = e.clientX;
        currentY = e.clientY;
      }

      const diffX = Math.abs(currentX - startPos.current.x);
      const diffY = Math.abs(currentY - startPos.current.y);

      // If finger/mouse moved more than 32px, cancel long press (it's a scroll or swipe)
      if (diffX > 32 || diffY > 32) {
        clear(e, true);
      }
    },
    [clear]
  );

  const didTriggerLongPress = useCallback(() => {
    if (isLongPressActive.current) return true;
    if (typeof window !== 'undefined' && (window as any).__lastLongPressTime) {
      return Date.now() - (window as any).__lastLongPressTime < 600;
    }
    return false;
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, true),
    onTouchStart: start,
    onTouchEnd: (e: React.TouchEvent) => clear(e, false),
    onTouchMove: move,
    didTriggerLongPress,
    isLongPressActive,
  };
}
