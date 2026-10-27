import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { Power } from 'lucide-react';
import { soundManager } from '../../utils/sound';

interface PowerScreenProps {
  mode: 'shutdown' | 'restart' | 'off';
}

export const PowerScreen: React.FC<PowerScreenProps> = ({ mode }) => {
  const { setPowerState, closeAllWindows } = useOS();
  const { isLocked } = useAuth();
  const [currentStep, setCurrentStep] = useState<'action' | 'off' | 'booting'>(
    mode === 'off' ? 'off' : 'action'
  );
  const [bootProgress, setBootProgress] = useState(0);

  useEffect(() => {
    if (mode === 'shutdown') {
      setCurrentStep('action');
      const timer = setTimeout(() => {
        closeAllWindows();
        setCurrentStep('off');
      }, 2500);
      return () => clearTimeout(timer);
    } else if (mode === 'restart') {
      setCurrentStep('action');
      const timer = setTimeout(() => {
        closeAllWindows();
        setCurrentStep('booting');
      }, 2200);
      return () => clearTimeout(timer);
    } else if (mode === 'off') {
      setCurrentStep('off');
    }
  }, [mode, closeAllWindows]);

  useEffect(() => {
    if (currentStep === 'booting') {
      setBootProgress(0);
      try {
        soundManager.play('startup');
      } catch {}

      const interval = setInterval(() => {
        setBootProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setPowerState('normal');
            }, 600);
            return 100;
          }
          return prev + 20;
        });
      }, 350);

      return () => clearInterval(interval);
    }
  }, [currentStep, setPowerState]);

  const handlePowerOn = () => {
    setCurrentStep('booting');
  };

  // Listen for keypress or click to power on when OFF
  useEffect(() => {
    if (currentStep === 'off') {
      const handleKeyDown = () => handlePowerOn();
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentStep]);

  // 1. BOOTING / REBOOTING SCREEN (Windows 11 Boot Logo & Rotating Dots)
  if (currentStep === 'booting') {
    return (
      <div className="fixed inset-0 z-[99999] bg-black text-white flex flex-col items-center justify-center select-none animate-in fade-in duration-300">
        {/* Windows 11 Logo */}
        <div className="mb-14 flex flex-col items-center">
          <div className="grid grid-cols-2 gap-1.5 w-18 h-18 mb-4">
            <div className="bg-[#0078d4] rounded-xs shadow-md" />
            <div className="bg-[#0078d4] rounded-xs shadow-md" />
            <div className="bg-[#0078d4] rounded-xs shadow-md" />
            <div className="bg-[#0078d4] rounded-xs shadow-md" />
          </div>
          <span className="text-xl font-medium tracking-wide text-slate-100">Windows 11</span>
        </div>

        {/* Windows 11 Circular Revolving Dots Spinner */}
        <div className="relative w-10 h-10 mb-6">
          <div className="absolute inset-0 rounded-full border-3 border-t-blue-500 border-r-blue-400 border-b-transparent border-l-transparent animate-spin" />
        </div>

        <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">
          Starting up... {bootProgress}%
        </p>
      </div>
    );
  }

  // 2. PC TURNED OFF SCREEN (Deep Black with Physical Power Button)
  if (currentStep === 'off') {
    return (
      <div
        className="fixed inset-0 z-[99999] bg-[#05070c] text-white flex flex-col items-center justify-center p-6 select-none cursor-pointer animate-in fade-in duration-500"
        onClick={handlePowerOn}
        title="Click or press any key to Turn PC On"
      >
        <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
          {/* Glowing Power Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePowerOn();
            }}
            className="w-24 h-24 rounded-full bg-slate-900/90 border-2 border-white/20 hover:border-blue-500 flex items-center justify-center text-slate-400 hover:text-blue-400 hover:bg-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer group"
          >
            <Power className="w-10 h-10 transition-transform group-hover:scale-110" />
          </button>

          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-slate-200">System is Powered Off</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Windows 11 Portfolio session has safely shut down.
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePowerOn();
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg hover:shadow-blue-500/25 transition-all transform hover:scale-105 cursor-pointer"
          >
            <Power className="w-4 h-4" />
            <span>Turn PC On</span>
          </button>

          <p className="text-[11px] text-slate-500 font-sans">
            Press any keyboard key or click anywhere to power on
          </p>
        </div>
      </div>
    );
  }

  // 3. SHUTTING DOWN OR RESTARTING SCREEN (Authentic Windows 11 Deep Slate & Spinner)
  const isShuttingDown = mode === 'shutdown';

  return (
    <div className="fixed inset-0 z-[99999] bg-[#00102b] text-white flex flex-col items-center justify-center select-none animate-in fade-in duration-300">
      {/* Windows 11 Spinner */}
      <div className="relative w-12 h-12 mb-8">
        <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-white font-sans">
          {isShuttingDown ? 'Shutting down' : 'Restarting'}
        </h1>
        <p className="text-xs text-slate-300/80 font-sans">
          {isShuttingDown
            ? 'Closing apps and saving state...'
            : 'Rebooting system kernel...'}
        </p>
      </div>
    </div>
  );
};
