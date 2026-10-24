import { useEffect, useState } from 'react';

type ElementRef = { readonly current: HTMLElement | null };

export function useResponsivePageSize(
  maximumPageSize: number,
  estimatedItemHeight: number,
  containerRef?: ElementRef,
  fallbackReservedHeight = 280,
): number {
  const [pageSize, setPageSize] = useState(maximumPageSize);

  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('.admin-panel-scroll');
    let frame = 0;
    const updatePageSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const container = containerRef?.current;
        const availableHeight = (panel?.clientHeight ?? window.innerHeight) - fallbackReservedHeight;
        const columns = container
          ? Math.max(1, getComputedStyle(container).gridTemplateColumns.trim().split(/\s+/).length)
          : 1;
        const fittingRows = Math.max(1, Math.floor(Math.max(0, availableHeight) / estimatedItemHeight));
        setPageSize(Math.max(1, Math.min(maximumPageSize, fittingRows * columns)));
      });
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePageSize);
    let observedContainer: HTMLElement | null = null;
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          const nextContainer = containerRef?.current ?? null;
          if (nextContainer === observedContainer) return;
          if (observedContainer) resizeObserver?.unobserve(observedContainer);
          observedContainer = nextContainer;
          if (observedContainer) resizeObserver?.observe(observedContainer);
          updatePageSize();
        });
    if (panel) resizeObserver?.observe(panel);
    if (panel) mutationObserver?.observe(panel, { childList: true, subtree: true });
    observedContainer = containerRef?.current ?? null;
    if (observedContainer) resizeObserver?.observe(observedContainer);
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    window.visualViewport?.addEventListener('resize', updatePageSize);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', updatePageSize);
      window.visualViewport?.removeEventListener('resize', updatePageSize);
    };
  }, [containerRef, estimatedItemHeight, fallbackReservedHeight, maximumPageSize]);

  return pageSize;
}
