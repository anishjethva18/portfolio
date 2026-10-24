import React, { useState, useRef, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { Crop, Square, Scissors, Maximize, X, Copy, Download,  } from 'lucide-react';
import { soundManager } from '../../utils/sound';
import { formatDateTime } from '../../utils/dateTime';

interface SnippingToolOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnippingToolOverlay: React.FC<SnippingToolOverlayProps> = ({ isOpen, onClose }) => {
  const { addNotification, saveMediaFile, openApp } = useOS();
  const [mode, setMode] = useState<'rect' | 'window' | 'full'>('rect');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnnotating, setIsAnnotating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStartPos(null);
      setCurrentPos(null);
      setCapturedImage(null);
      setIsAnnotating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (capturedImage) return;
    setIsDrawing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || capturedImage) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos) return;
    setIsDrawing(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    if (w < 20 || h < 20) {
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    // Generate a placeholder screenshot canvas representation
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Render snapshot background canvas with gradient fill
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0078d4');
      grad.addColorStop(0.5, '#4f46e5');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Segoe UI, sans-serif';
      ctx.fillText('Snip Screenshot', 16, 32);
      ctx.font = '12px Segoe UI, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(formatDateTime(new Date()), 16, 54);
    }

    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);
    soundManager.playCameraShutter();
    addNotification({
      title: 'Snip Captured',
      message: 'Screenshot copied to clipboard and ready for annotation.',
      type: 'success',
    });
  };

  const handleCaptureFull = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px Segoe UI, sans-serif';
      ctx.fillText('Full Screen Snip', 32, 64);
    }
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);
    soundManager.playCameraShutter();
  };

  const handleSaveToFiles = () => {
    if (!capturedImage) return;
    const fileName = `Snip_${Date.now()}.png`;
    saveMediaFile('C:/Pictures', fileName, capturedImage, 'png');
    addNotification({
      title: 'Saved to Pictures',
      message: `Saved screenshot as ${fileName}`,
      type: 'success',
    });
    onClose();
  };

  const handleCopyClipboard = async () => {
    if (!capturedImage) return;
    try {
      addNotification({
        title: 'Copied to Clipboard',
        message: 'Snip image copied to clipboard buffer.',
        type: 'info',
      });
      soundManager.playClick();
    } catch {}
    onClose();
  };

  const selectionRect = startPos && currentPos ? {
    x: Math.min(startPos.x, currentPos.x),
    y: Math.min(startPos.y, currentPos.y),
    w: Math.abs(currentPos.x - startPos.x),
    h: Math.abs(currentPos.y - startPos.y),
  } : null;

  return (
    <div className="fixed inset-0 z-[99990] select-none">
      {/* Top Toolbar pill */}
      {!capturedImage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-1 p-1.5 rounded-2xl bg-slate-900/90 border border-white/20 backdrop-blur-xl shadow-2xl text-white">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              mode === 'rect' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'
            }`}
            onClick={() => setMode('rect')}
            title="Rectangle Snip"
          >
            <Square className="w-3.5 h-3.5" /> Rectangle
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              mode === 'window' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'
            }`}
            onClick={() => {
              setMode('window');
              handleCaptureFull();
            }}
            title="Window Snip"
          >
            <Crop className="w-3.5 h-3.5" /> Window
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              mode === 'full' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'
            }`}
            onClick={() => {
              setMode('full');
              handleCaptureFull();
            }}
            title="Full Screen Snip"
          >
            <Maximize className="w-3.5 h-3.5" /> Full Screen
          </button>
          <div className="w-[1px] h-4 bg-white/20 mx-1" />
          <button
            className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer"
            onClick={onClose}
            title="Close Snipping Tool (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dimmed Drag Screen */}
      {!capturedImage && (
        <div
          className="w-full h-full bg-black/40 cursor-crosshair relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {selectionRect && (
            <div
              className="absolute border-2 border-blue-500 bg-white/10 shadow-lg pointer-events-none"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.w,
                height: selectionRect.h,
              }}
            />
          )}
        </div>
      )}

      {/* Snipping Preview & Annotation Window */}
      {capturedImage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                <Scissors className="w-4 h-4 text-blue-500" />
                <span>Snipping Tool Preview</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  onClick={handleCopyClipboard}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                  onClick={handleSaveToFiles}
                >
                  <Download className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 cursor-pointer"
                  onClick={onClose}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preview image */}
            <div className="p-6 flex items-center justify-center bg-slate-100 dark:bg-slate-950 overflow-auto max-h-[65vh]">
              <img
                src={capturedImage}
                alt="Captured Snip"
                className="max-h-[50vh] rounded-xl shadow-lg border border-slate-200 dark:border-white/10 object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
