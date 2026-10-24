// Web Audio API Sound Synthesizer for Windows 11 OS Sound Effects

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;
  private systemActionSoundsEnabled: boolean = true;

  constructor() {
    // Synchronously hydrate from localStorage on initialization if available to prevent race conditions
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('win11_system_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed) {
            if (typeof parsed.soundEnabled === 'boolean') {
              this.enabled = parsed.soundEnabled;
            }
            if (typeof parsed.soundVolume === 'number') {
              this.volume = parsed.soundVolume;
            }
            if (typeof parsed.systemActionSoundsEnabled === 'boolean') {
              this.systemActionSoundsEnabled = parsed.systemActionSoundsEnabled;
            }
          }
        }
      } catch {}
      this.updateGlobalSettings();
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private updateGlobalSettings() {
    if (typeof window !== 'undefined') {
      (window as any).__soundManager_settings = {
        enabled: this.enabled,
        volume: this.volume,
        systemActionSoundsEnabled: this.systemActionSoundsEnabled,
      };
    }
  }

  private getEnabled(): boolean {
    if (typeof window !== 'undefined') {
      const globalSettings = (window as any).__soundManager_settings;
      if (globalSettings && typeof globalSettings.enabled === 'boolean') {
        return globalSettings.enabled;
      }
    }
    return this.enabled;
  }

  private getVolume(): number {
    if (typeof window !== 'undefined') {
      const globalSettings = (window as any).__soundManager_settings;
      if (globalSettings && typeof globalSettings.volume === 'number') {
        return globalSettings.volume;
      }
    }
    return this.volume;
  }

  private getSystemActionSoundsEnabled(): boolean {
    if (typeof window !== 'undefined') {
      const globalSettings = (window as any).__soundManager_settings;
      if (globalSettings && typeof globalSettings.systemActionSoundsEnabled === 'boolean') {
        return globalSettings.systemActionSoundsEnabled;
      }
    }
    return this.systemActionSoundsEnabled;
  }

  private canPlaySystemAction(): boolean {
    return this.getEnabled() && this.getSystemActionSoundsEnabled() && this.getVolume() > 0;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.updateGlobalSettings();
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.updateGlobalSettings();
  }

  public setSystemActionSoundsEnabled(enabled: boolean) {
    this.systemActionSoundsEnabled = enabled;
    this.updateGlobalSettings();
  }

  // Generic dispatcher for convenience
  public play(type: 'click' | 'notification' | 'delete' | 'file' | 'error' | 'snap' | 'shutter' | 'startup' | 'open' | 'minimize' | 'maximize' | 'refresh' | 'copy' | 'cut' | 'paste' | 'share') {
    switch (type) {
      case 'click':
        return this.playClick();
      case 'notification':
        return this.playNotification();
      case 'delete':
        return this.playTrashEmpty();
      case 'file':
        return this.playFileOperation();
      case 'error':
        return this.playError();
      case 'snap':
        return this.playWindowSnap();
      case 'shutter':
        return this.playCameraShutter();
      case 'startup':
        return this.playStartup();
      case 'open':
        return this.playOpenWindow();
      case 'minimize':
        return this.playMinimizeWindow();
      case 'maximize':
        return this.playWindowMaximize();
      case 'refresh':
        return this.playRefresh();
      case 'copy':
        return this.playCopy();
      case 'cut':
        return this.playCut();
      case 'paste':
        return this.playPaste();
      case 'share':
        return this.playShare();
    }
  }

  public playRefresh() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
      gain.gain.setValueAtTime(0.08 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  public playCopy() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
      gain.gain.setValueAtTime(0.07 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  public playCut() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
      gain.gain.setValueAtTime(0.08 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  public playPaste() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
      gain.gain.setValueAtTime(0.09 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  public playShare() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(698.46, now + 0.04); // F5
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6

      gain.gain.setValueAtTime(0.07 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.18);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.18);
    } catch {}
  }

  // 1. Subtle UI Button Click
  public playClick() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

      gain.gain.setValueAtTime(0.06 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {}
  }

  // 2. Window Open Interaction (Gentle melodic rise)
  public playOpenWindow() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now); // A4
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(554.37, now + 0.02); // C#5
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.08 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.02);
      osc2.stop(now + 0.15);
    } catch {}
  }

  // 3. Window Minimize Interaction (Soft downward swoop)
  public playMinimizeWindow() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.11);

      gain.gain.setValueAtTime(0.07 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch {}
  }

  // 4. Window Maximize / Restore Interaction (Expansive chime)
  public playWindowMaximize() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 783.99]; // C5, G5
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.04);
        gain.gain.setValueAtTime(0.06 * this.getVolume(), now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.14);
      });
    } catch {}
  }

  // 5. Window Snap Dock Interaction (Tactile magnetic snap sound)
  public playWindowSnap() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      
      // Tone 1: Low body thud
      const oscLow = ctx.createOscillator();
      const gainLow = ctx.createGain();
      oscLow.type = 'sine';
      oscLow.frequency.setValueAtTime(280, now);
      oscLow.frequency.exponentialRampToValueAtTime(140, now + 0.08);
      gainLow.gain.setValueAtTime(0.12 * this.getVolume(), now);
      gainLow.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      oscLow.connect(gainLow);
      gainLow.connect(ctx.destination);
      oscLow.start(now);
      oscLow.stop(now + 0.08);

      // Tone 2: Crisp docking bell
      const oscHigh = ctx.createOscillator();
      const gainHigh = ctx.createGain();
      oscHigh.type = 'sine';
      oscHigh.frequency.setValueAtTime(880, now + 0.02);
      oscHigh.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12);
      gainHigh.gain.setValueAtTime(0.09 * this.getVolume(), now + 0.02);
      gainHigh.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      oscHigh.connect(gainHigh);
      gainHigh.connect(ctx.destination);
      oscHigh.start(now + 0.02);
      oscHigh.stop(now + 0.14);
    } catch {}
  }

  // 6. Windows 11 Distinct Notification Alert (3-tone harmonic chime: F#5 -> A#5 -> C#6)
  public playNotification() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Windows 11 notification signature chord
      const chords = [
        { freq: 739.99, time: 0.00, dur: 0.28 }, // F#5
        { freq: 932.33, time: 0.06, dur: 0.32 }, // A#5
        { freq: 1108.73, time: 0.12, dur: 0.38 }, // C#6
      ];

      chords.forEach((c) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(c.freq, now + c.time);

        gain.gain.setValueAtTime(0.1 * this.getVolume(), now + c.time);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + c.time + c.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + c.time);
        osc.stop(now + c.time + c.dur);
      });
    } catch {}
  }

  // 7. File Operations (File Created, Copied, Pasted, Moved, Attached)
  public playFileOperation() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

      gain.gain.setValueAtTime(0.08 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  // 8. Trash / Delete / Recycle Bin Sound
  public playTrashEmpty() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);

      gain.gain.setValueAtTime(0.09 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  // 9. Camera Shutter Sound
  public playCameraShutter() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.08);

      gain.gain.setValueAtTime(0.12 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  // 10. Startup Theme Sound
  public playStartup() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C E G C E chord
      const now = ctx.currentTime;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(0.05 * this.getVolume(), startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.65);
      });
    } catch {}
  }

  // 11. Error / Warning Alert Sound
  public playError() {
    if (!this.canPlaySystemAction()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.09);

      gain.gain.setValueAtTime(0.1 * this.getVolume(), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }
}

export const soundManager = new SoundManager();
