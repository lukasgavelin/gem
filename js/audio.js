// Procedural Web Audio API sound effects for tactile paper & wire feedback

const MUTE_STORAGE_KEY = 'gemmets_resa_muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this._ensureNoiseBuffer();
  }

  _ensureNoiseBuffer() {
    if (!this.ctx || this.noiseBuffer) return;
    const len = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? '1' : '0');
    } catch {
      // Ignore storage errors in restricted contexts
    }
    return this.muted;
  }

  _ready() {
    if (this.muted) return false;
    this.init();
    return Boolean(this.ctx);
  }

  playJump() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const pitch = 0.92 + Math.random() * 0.16;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.11);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playDash() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    // Metallic wire "twang"
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.16);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playBounce() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const pitch = 0.92 + Math.random() * 0.16;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(680 * pitch, now + 0.16);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playLand() {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const pitch = 0.88 + Math.random() * 0.24;
    const duration = 0.05;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    noise.playbackRate.value = pitch;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900 * pitch;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now, Math.random() * 0.5);
    noise.stop(now + duration + 0.01);
  }

  playWallScratch() {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const duration = 0.05;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400 + Math.random() * 900;
    filter.Q.value = 2.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now, Math.random() * 0.5);
    noise.stop(now + duration + 0.01);
  }

  playCheckpoint() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.11, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.3);
    });
  }

  playStar() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.12, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.24);
    });
  }

  playHazard() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.18);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playPageFlip() {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const duration = 0.45;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + duration * 0.6);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.22, now + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.005, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now, Math.random() * 0.4);
    noise.stop(now + duration + 0.02);
  }

  playMagnet() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }
}

export const sound = new SoundEngine();
