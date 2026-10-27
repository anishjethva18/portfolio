// Mobile, Tablet & Laptop Haptic & Tactile Feedback Engine

let inMemoryHapticsEnabled: boolean | null = null;

export const setHapticsEnabled = (enabled: boolean) => {
  inMemoryHapticsEnabled = enabled;
};

// Helper to check if haptics are enabled in system settings
const isHapticsEnabled = (): boolean => {
  if (inMemoryHapticsEnabled !== null) return inMemoryHapticsEnabled;
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem('win11_system_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.hapticsEnabled === false) return false;
    }
  } catch {}
  return true;
};

// Subtle Web Audio tactile click synthesizer for laptops, desktops, iPads, iPhones
let audioCtx: AudioContext | null = null;
const playTactileClick = (freq = 140, duration = 0.04, volume = 0.08) => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.01);
  } catch {}
};

export const haptics = {
  // Light vibration/tactile pulse for subtle UI taps (buttons, tabs, list selections)
  light: () => {
    if (!isHapticsEnabled()) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
    playTactileClick(160, 0.025, 0.05);
  },

  // Medium vibration/tactile pulse for switches, toggles, icon drops
  medium: () => {
    if (!isHapticsEnabled()) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
    playTactileClick(130, 0.04, 0.09);
  },

  // Heavy vibration/tactile pulse for window snap, long press activation, trash empty
  heavy: () => {
    if (!isHapticsEnabled()) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(50);
      } catch {}
    }
    playTactileClick(100, 0.06, 0.15);
  },

  // Pattern for success notifications & task completion
  success: () => {
    if (!isHapticsEnabled()) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 40, 25]);
      } catch {}
    }
    playTactileClick(180, 0.03, 0.07);
    setTimeout(() => playTactileClick(240, 0.04, 0.08), 50);
  },

  // Pattern for errors, warnings, invalid inputs
  error: () => {
    if (!isHapticsEnabled()) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 50, 40]);
      } catch {}
    }
    playTactileClick(90, 0.05, 0.12);
  },

  // Selection change pulse for sliders and pickers
  selection: () => {
    if (!isHapticsEnabled()) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {}
    }
    playTactileClick(150, 0.02, 0.04);
  },

  setEnabled: (enabled: boolean) => {
    inMemoryHapticsEnabled = enabled;
  },
};

