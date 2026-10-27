import React, { useState, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { Gamepad2, Activity, Mic, MicOff, Camera, Video, X, Sliders } from 'lucide-react';
import { soundManager } from '../../utils/sound';

interface GameBarOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GameBarOverlay: React.FC<GameBarOverlayProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, addNotification, openSnipping } = useOS();
  const [fps, setFps] = useState(60);
  const [cpu, setCpu] = useState(14);
  const [gpu, setGpu] = useState(28);
  const [ram, setRam] = useState(42);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setFps(Math.floor(58 + Math.random() * 4));
      setCpu(Math.floor(12 + Math.random() * 10));
      setGpu(Math.floor(25 + Math.random() * 15));
      setRam(Math.floor(40 + Math.random() * 4));
    }, 1500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleGameMode = () => {
    updateSettings({ gameModeEnabled: !settings.gameModeEnabled });
    soundManager.playClick();
  };

  const handleScreenshot = () => {
    onClose();
    setTimeout(() => {
      openSnipping();
    }, 200);
  };

  const handleRecord = () => {
    setIsRecording(!isRecording);
    soundManager.playClick();
    addNotification({
      title: isRecording ? 'Recording Stopped' : 'Game Clip Recording Started',
      message: isRecording ? 'Clip saved to C:/Videos/Captures' : 'Recording game footage (simulated 1080p 60fps)...',
      type: 'info',
    });
  };

  return (
    <div
      className="fixed inset-0 z-[99995] flex flex-col justify-between p-6 bg-black/40 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-6 py-3 mx-auto w-full max-w-4xl rounded-2xl bg-slate-900/90 border border-white/20 backdrop-blur-2xl shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-sm tracking-wide">Xbox Game Bar</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
            {fps} FPS
          </span>
        </div>

        {/* Center shortcuts */}
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            onClick={handleScreenshot}
            title="Take Screenshot"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded-xl cursor-pointer ${
              isRecording ? 'bg-rose-600 text-white animate-pulse' : 'hover:bg-white/10 text-slate-300'
            }`}
            onClick={handleRecord}
            title={isRecording ? 'Stop Recording' : 'Record Game Clip'}
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded-xl cursor-pointer ${
              isMicMuted ? 'bg-rose-500/20 text-rose-300' : 'hover:bg-white/10 text-slate-300'
            }`}
            onClick={() => setIsMicMuted(!isMicMuted)}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {/* Right close */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Game Mode</span>
            <button
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                settings.gameModeEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
              onClick={toggleGameMode}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.gameModeEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Widgets Container */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Widget 1: Performance Stats */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/15 backdrop-blur-2xl text-white space-y-3 shadow-2xl">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Performance</span>
            </div>
            <span className="font-mono text-emerald-400">{fps} FPS</span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>CPU</span>
                <span>{cpu}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${cpu}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>GPU</span>
                <span>{gpu}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${gpu}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>RAM</span>
                <span>{ram}% (6.7 GB)</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${ram}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Widget 2: Capture Quick Actions */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/15 backdrop-blur-2xl text-white space-y-3 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Capture Controls</span>
          </div>

          <div className="space-y-2 pt-1">
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              onClick={handleScreenshot}
            >
              <span>Take Screenshot</span>
              <span className="text-[10px] text-slate-400">Win+Alt+PrtScn</span>
            </button>
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              onClick={handleRecord}
            >
              <span>{isRecording ? 'Stop Recording' : 'Record Last 30s'}</span>
              <span className="text-[10px] text-slate-400">Win+Alt+G</span>
            </button>
          </div>
        </div>

        {/* Widget 3: Audio Mixer */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/15 backdrop-blur-2xl text-white space-y-3 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Audio Mixer</span>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>System Sound</span>
                <span>{Math.round((settings.soundVolume ?? 0.5) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.soundVolume ?? 0.5}
                onChange={(e) => updateSettings({ soundVolume: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg accent-purple-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Microphone</span>
                <span>{isMicMuted ? 'Muted' : '85%'}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={85}
                disabled={isMicMuted}
                className="w-full h-1.5 bg-slate-800 rounded-lg accent-emerald-500 cursor-pointer disabled:opacity-30"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-400">
        Press <span className="font-bold text-white">Win + G</span> or click outside to dismiss Game Bar
      </div>
    </div>
  );
};
