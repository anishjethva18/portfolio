import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Sparkles, ArrowRight, Music, Radio, Youtube, CloudSun, Newspaper } from 'lucide-react';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptComplete: (transcript: string) => void;
}

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  isOpen,
  onClose,
  onTranscriptComplete,
}) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState('Listening...');
  const [manualInput, setManualInput] = useState('');
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startListening = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTranscript('');
    setStatusText('Listening...');
    setIsListening(true);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setStatusText('Listening... Say something like "songs", "weather", etc.');
        };

        recognition.onresult = (event: any) => {
          let currentText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setTranscript(currentText);
          setManualInput(currentText);

          if (event.results[0].isFinal || event.results[event.results.length - 1].isFinal) {
            setIsListening(false);
            setStatusText('Processing...');
            timerRef.current = setTimeout(() => {
              handleExecuteSearch(currentText);
            }, 600);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition error:', e.error);
          setIsListening(false);
          if (e.error === 'not-allowed') {
            setStatusText('Microphone permission denied. Type your voice query below:');
          } else if (e.error === 'no-speech') {
            setStatusText('No speech detected. Tap microphone to retry or type below:');
          } else {
            setStatusText('Ready. Speak now or pick a quick search topic below:');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        return;
      } catch (err) {
        console.warn('Could not initialize SpeechRecognition:', err);
        setIsListening(false);
        setStatusText('Microphone ready. Speak or enter query:');
      }
    } else {
      setIsListening(false);
      setStatusText('Speech API not supported in this environment. Type query below:');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      setTranscript('');
      setManualInput('');
      setIsListening(false);
      return;
    }

    startListening();

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  const handleExecuteSearch = (query: string) => {
    const clean = query.trim();
    if (!clean) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    onTranscriptComplete(clean);
    onClose();
  };

  const quickSearchOptions = [
    { label: 'songs', icon: Music, query: 'songs' },
    { label: 'play music', icon: Radio, query: 'play music' },
    { label: 'YouTube', icon: Youtube, query: 'https://youtube.com' },
    { label: 'weather today', icon: CloudSun, query: 'weather today' },
    { label: 'latest news', icon: Newspaper, query: 'latest news headlines' },
    { label: 'React TypeScript tutorials', icon: Sparkles, query: 'React TypeScript tutorials' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center text-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl font-bold text-white tracking-tight">Google Voice Search</span>
        </div>

        {/* Animated Mic Ring */}
        <div className="relative mb-5 mt-2">
          {isListening && (
            <>
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              <div className="absolute -inset-4 rounded-full bg-red-500/10 animate-pulse" />
            </>
          )}
          <button
            onClick={() => {
              if (isListening) {
                if (recognitionRef.current) recognitionRef.current.abort();
                setIsListening(false);
                setStatusText('Microphone paused.');
              } else {
                startListening();
              }
            }}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white scale-110 shadow-red-500/30'
                : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20'
            }`}
            title={isListening ? 'Click to pause mic' : 'Click to listen'}
          >
            {isListening ? (
              <Mic className="w-9 h-9 animate-bounce" />
            ) : (
              <MicOff className="w-9 h-9 text-slate-400" />
            )}
          </button>
        </div>

        {/* Live Status or Real-time transcript */}
        <p className="text-sm font-medium text-slate-300 min-h-[24px] mb-4">
          {transcript ? `"${transcript}"` : statusText}
        </p>

        {/* Direct Query Input Box (so user can type or edit spoken search) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecuteSearch(manualInput || transcript);
          }}
          className="w-full relative flex items-center mb-5"
        >
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type search query or speak..."
            className="w-full px-4 py-3 rounded-2xl bg-slate-800/90 border border-white/15 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 transition-colors pr-11"
          />
          <button
            type="submit"
            disabled={!manualInput.trim() && !transcript.trim()}
            className="absolute right-2 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white transition-colors cursor-pointer"
            title="Search"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Voice Suggestion Pills */}
        <div className="w-full pt-4 border-t border-white/10 text-left">
          <p className="text-xs font-semibold text-slate-400 mb-2">Try saying or search for:</p>
          <div className="flex flex-wrap gap-2">
            {quickSearchOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleExecuteSearch(opt.query)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-blue-600/20 hover:border-blue-400 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <opt.icon className="w-3.5 h-3.5 text-blue-400" />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
