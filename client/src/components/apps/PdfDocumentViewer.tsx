import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfDocumentViewerProps {
  url: string;
  fitWidth?: boolean;
  zoom?: number;
  firstPageOnly?: boolean;
  className?: string;
  onZoomChange?: (zoom: number) => void;
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  url,
  fitWidth = true,
  zoom = 100,
  firstPageOnly = false,
  className = '',
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [useNativeViewer, setUseNativeViewer] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) return;

    let cancelled = false;
    const renderTasks: Array<{ cancel: () => void }> = [];
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let pdfDocument: PDFDocumentProxy | undefined;
    let renderedWidth = 0;
    let renderGeneration = 0;
    setUseNativeViewer(false);

    const renderDocument = async () => {
      const generation = ++renderGeneration;
      if (!container.clientWidth) return;
      setLoading(true);
      setError('');
      renderTasks.forEach((task) => task.cancel());
      renderTasks.length = 0;
      container.replaceChildren();

      try {
        loadingTask ||= pdfjs.getDocument({ url, withCredentials: true });
        pdfDocument ||= await loadingTask.promise;
        if (cancelled || generation !== renderGeneration) return;

        const pageCount = firstPageOnly ? Math.min(pdfDocument.numPages, 1) : pdfDocument.numPages;
        const availableWidth = Math.max(1, container.clientWidth);
        const availableHeight = Math.max(1, container.clientHeight - 24);
        const deviceScale = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          if (cancelled || generation !== renderGeneration) return;
          const page = await pdfDocument.getPage(pageNumber);
          if (cancelled || generation !== renderGeneration) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = firstPageOnly
            ? Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height)
            : fitWidth
              ? availableWidth / baseViewport.width
              : zoom / 100;
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Could not create a canvas for the PDF page.');

          canvas.width = Math.max(1, Math.floor(viewport.width * deviceScale));
          canvas.height = Math.max(1, Math.floor(viewport.height * deviceScale));
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.style.maxWidth = firstPageOnly ? '100%' : 'none';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 12px';
          canvas.style.backgroundColor = '#fff';
          canvas.setAttribute('aria-label', `PDF page ${pageNumber} of ${pdfDocument.numPages}`);
          container.appendChild(canvas);

          const task = page.render({
            canvasContext: context,
            viewport,
            transform: deviceScale === 1 ? undefined : [deviceScale, 0, 0, deviceScale, 0, 0],
          });
          renderTasks.push(task);
          await task.promise;
          if (cancelled || generation !== renderGeneration) return;
        }
        if (!cancelled && generation === renderGeneration) setLoading(false);
      } catch (error) {
        if (!cancelled && generation === renderGeneration && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          console.error('Could not render PDF document.', error);
          setError('PDF preview could not be rendered.');
          setUseNativeViewer(true);
          setLoading(false);
        }
      }
    };

    resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width);
      if (!nextWidth || (nextWidth === renderedWidth && container.childElementCount > 0)) return;
      renderedWidth = nextWidth;
      void renderDocument();
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      renderTasks.forEach((task) => task.cancel());
      void loadingTask?.destroy();
      container.replaceChildren();
    };
  }, [url, fitWidth, zoom, firstPageOnly]);

  let isExternal = false;
  try {
    isExternal = new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    isExternal = false;
  }

  if (isExternal) {
    const externalUrl = `${url}${url.includes('#') ? '&' : '#'}toolbar=0&navpanes=0&scrollbar=1`;
    return <iframe src={externalUrl} title="PDF document" className={className} />;
  }

  if (useNativeViewer) {
    return (
      <div className={`relative flex min-h-0 flex-col ${className}`}>
        <iframe src={url} title="PDF document" className="min-h-0 w-full flex-1 border-0" />
        <div role="alert" className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">
          <span>PDF preview could not be rendered by the in-app viewer.</span>
          <a href={url} target="_blank" rel="noreferrer" className="font-semibold underline">Open PDF</a>
          <a href={url} download className="font-semibold underline">Download PDF</a>
        </div>
      </div>
    );
  }

  const updateGestureZoom = (delta: number) => {
    if (!onZoomChange || !Number.isFinite(delta)) return;
    onZoomChange(Math.min(180, Math.max(40, zoom + delta)));
  };

  return (
    <div
      className={`relative ${className}`}
      onWheel={(event) => {
        if (!event.ctrlKey || !onZoomChange) return;
        event.preventDefault();
        updateGestureZoom(event.deltaY < 0 ? 5 : -5);
      }}
      onTouchStart={(event) => {
        if (event.touches.length === 2) {
          const [first, second] = Array.from(event.touches);
          pinchStartDistanceRef.current = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
        }
      }}
      onTouchMove={(event) => {
        if (event.touches.length !== 2 || pinchStartDistanceRef.current === null) return;
        const [first, second] = Array.from(event.touches);
        const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
        const delta = distance - pinchStartDistanceRef.current;
        if (Math.abs(delta) >= 8) {
          updateGestureZoom(delta > 0 ? 5 : -5);
          pinchStartDistanceRef.current = distance;
        }
        event.preventDefault();
      }}
      onTouchEnd={(event) => {
        if (event.touches.length < 2) pinchStartDistanceRef.current = null;
      }}
    >
      <div ref={containerRef} className={`h-full w-full ${firstPageOnly ? 'overflow-hidden' : 'overflow-x-auto overflow-y-scroll'}`} />
      {loading && !error && <div role="status" className="absolute inset-0 grid place-items-center bg-white/90 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />Loading PDF…</span></div>}
      {error && <div role="alert" className="absolute inset-x-3 top-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">{error}</div>}
    </div>
  );
};
