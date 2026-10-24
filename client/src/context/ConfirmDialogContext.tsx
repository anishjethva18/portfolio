import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type PendingConfirmation = ConfirmOptions & { resolve: (accepted: boolean) => void };
const ConfirmDialogContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending((previous) => {
      previous?.resolve(false);
      return { ...options, resolve };
    });
  }), []);

  const settle = useCallback((accepted: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    setPending(null);
    current.resolve(accepted);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(false);
      if (event.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending, settle]);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) settle(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" className="admin-confirm-dialog w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl animate-fadeIn">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${pending.destructive ? 'bg-rose-500/15 text-rose-300' : 'bg-blue-500/15 text-blue-300'}`}><AlertTriangle size={19} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="confirm-dialog-title" className="text-base font-bold">{pending.title}</h2>
                  <button type="button" onClick={() => settle(false)} aria-label="Close confirmation" className="admin-confirm-close rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X size={17} /></button>
                </div>
                <p id="confirm-dialog-message" className="admin-confirm-message mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{pending.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => settle(false)} className="admin-confirm-cancel rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">Cancel</button>
              <button autoFocus type="button" onClick={() => settle(true)} className={`rounded-lg px-4 py-2.5 text-xs font-bold text-white transition hover:brightness-110 ${pending.destructive ? 'bg-rose-600' : 'bg-blue-600'}`}>{pending.confirmLabel || 'Continue'}</button>
            </div>
          </section>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirmDialog = () => {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider.');
  return confirm;
};
