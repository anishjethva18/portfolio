import { useRef, useCallback, useState } from 'react';

interface TouchSensitivityOptions {
  /** Distance in pixels finger must move before a touch is considered a scroll rather than a tap */
  threshold?: number;
  /** Maximum time in ms for a tap gesture */
  tapTimeout?: number;
  /** Optional callback when scrolling starts */
  onScrollStart?: () => void;
  /** Optional callback when scrolling stops */
  onScrollEnd?: () => void;
}

export function useTouchSensitivity(options: TouchSensitivityOptions = {}) {
  const { threshold = 8, tapTimeout = 250, onScrollStart, onScrollEnd } = options;

  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startTime = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startPos.current = { x: touch.clientX, y: touch.clientY };
      startTime.current = Date.now();
      isScrollingRef.current = false;
      setIsScrolling(false);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && !isScrollingRef.current) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - startPos.current.x);
        const dy = Math.abs(touch.clientY - startPos.current.y);

        if (dx > threshold || dy > threshold) {
          isScrollingRef.current = true;
          setIsScrolling(true);
          onScrollStart?.();
        }
      }
    },
    [threshold, onScrollStart]
  );

  const handleTouchEnd = useCallback(() => {
    if (isScrollingRef.current) {
      onScrollEnd?.();
      // Keep isScrollingRef true momentarily to absorb click events fired right after touchend
      setTimeout(() => {
        isScrollingRef.current = false;
        setIsScrolling(false);
      }, 120);
    }
  }, [onScrollEnd]);

  /** Helper to determine if a tap or click should be permitted */
  const shouldAllowClick = useCallback(() => {
    return !isScrollingRef.current;
  }, []);

  return {
    touchProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isScrolling,
    isScrollingRef,
    shouldAllowClick,
  };
}
