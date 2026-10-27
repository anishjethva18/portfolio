import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { QrCode, RotateCcw, X } from 'lucide-react';

export const BSODScreen: React.FC = () => {
  const { dismissBsod } = useOS();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = p + Math.floor(Math.random() * 15) + 5;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, 700);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut to exit / restart
  useEffect(() => {
    const handleKeyDown = () => {
      dismissBsod();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissBsod]);

  return (
    <div
      className="fixed inset-0 z-[99999] bg-[#0078d7] text-white p-8 md:p-20 font-sans select-none flex flex-col justify-between cursor-pointer"
      onClick={dismissBsod}
      title="Click anywhere to exit BSOD and restart"
    >
      {/* Top Exit Bar */}
      <div className="flex justify-between items-center">
        <div className="text-xs uppercase tracking-widest opacity-60 font-mono">Windows 11 Diagnostic Screen</div>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            dismissBsod();
          }}
          title="Exit to Desktop"
        >
          <X className="w-4 h-4" />
          <span>Exit BSOD</span>
        </button>
      </div>

      {/* Center Main Message */}
      <div className="max-w-3xl space-y-7 animate-in fade-in duration-300">
        <div className="text-7xl md:text-9xl font-light">:(</div>

        <h1 className="text-lg md:text-2xl font-light leading-relaxed">
          Your PC ran into a playful portfolio exception and needs to restart. We're just collecting
          some error info, and then we'll restart for you.
        </h1>

        <div className="text-xl font-bold font-mono">
          {Math.min(100, progress)}% complete
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4">
          <div className="p-3 bg-white text-slate-900 rounded-xl shadow-lg shrink-0">
            <QrCode className="w-18 h-18" />
          </div>

          <div className="space-y-1 text-xs text-blue-100 font-mono">
            <p className="font-bold text-white">For more information about this issue and possible fixes, visit:</p>
            <p className="text-blue-200">https://windows.com/stopcode</p>
            <p className="pt-1.5 text-[11px] opacity-80">If you call a support person, give them this info:</p>
            <p className="opacity-90 font-semibold">Stop code: PORTFOLIO_EXCEPTION_SUCCESS</p>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/15">
        <p className="text-xs text-blue-100/90 font-mono">
          Press any key or click anywhere on screen to restart now.
        </p>

        <button
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white text-[#0078d7] font-bold text-sm hover:bg-blue-50 transition-colors shadow-2xl cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            dismissBsod();
          }}
        >
          <RotateCcw className="w-4 h-4" /> Restart Windows Portfolio
        </button>
      </div>
    </div>
  );
};

