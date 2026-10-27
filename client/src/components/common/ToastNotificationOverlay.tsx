import React, { useState, useEffect, useRef } from 'react';
import { useOS } from '../../context/OSContext';
import { NotificationItem } from '../../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, ExternalLink } from 'lucide-react';

export const ToastNotificationOverlay: React.FC<{ suppressWelcome?: boolean }> = ({ suppressWelcome = false }) => {
  const { notifications, markNotificationRead, openApp } = useOS();
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);

  // Watch for latest unread notification
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[notifications.length - 1];
      if (latest && !latest.read && latest.id !== lastSeenIdRef.current) {
        lastSeenIdRef.current = latest.id;
        if (suppressWelcome && latest.id === 'welcome-1') {
          if (activeToast?.id === latest.id) setActiveToast(null);
          if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
          markNotificationRead(latest.id);
          return;
        }
        setActiveToast(latest);
        setSwipeOffset(0);

        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        // Auto-dismiss in 5 seconds (5000ms) as per requirement 2.1 E
        dismissTimerRef.current = setTimeout(() => {
          setActiveToast(null);
        }, 5000);
      }
    }
  }, [notifications, suppressWelcome, markNotificationRead, activeToast?.id]);

  useEffect(() => {
    if (!suppressWelcome || activeToast?.id !== 'welcome-1') return;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setActiveToast(null);
    markNotificationRead('welcome-1');
  }, [suppressWelcome, activeToast?.id, markNotificationRead]);

  const handleDismiss = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (activeToast) {
      markNotificationRead(activeToast.id);
    }
    setActiveToast(null);
    setSwipeOffset(0);
  };

  // Touch gesture handlers for swipe-to-dismiss (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    setSwipeOffset(deltaX);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (Math.abs(swipeOffset) > 80) {
      // Swiped far enough to dismiss
      handleDismiss();
    } else {
      // Reset position and restart 5s timer
      setSwipeOffset(0);
      dismissTimerRef.current = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
    }
  };

  if (!activeToast) return null;

  const getIcon = () => {
    switch (activeToast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 animate-status-pop" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div
      id="mobile-toast-notification-container"
      className="fixed z-[9999] top-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-sm sm:left-auto sm:right-4 sm:translate-x-0 sm:w-96 pointer-events-auto transition-transform duration-150 ease-out"
      style={{
        transform: `translate(${swipeOffset}px, 0)`,
        opacity: Math.max(0, 1 - Math.abs(swipeOffset) / 200),
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-2xl text-slate-800 dark:text-white select-none">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <p className="text-xs sm:text-sm font-bold truncate">{activeToast.title}</p>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">Just now</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {activeToast.message}
          </p>

          {/* Action buttons (Swipe to action / Action bar) */}
          <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 dark:border-white/5">
            <button
              onClick={handleDismiss}
              className="min-h-[32px] px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              Dismiss
            </button>
            {activeToast.actionApp && (
              <button
                onClick={() => {
                  if (activeToast.actionApp) openApp(activeToast.actionApp);
                  handleDismiss();
                }}
                className="min-h-[32px] px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Open</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
          title="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
