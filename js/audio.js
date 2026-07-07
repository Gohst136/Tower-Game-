// Fully synthesized sound effects + generative ambient music via Web Audio API.
// No audio files needed. window.Sfx
(function (global) {
  const Sfx = {
    ctx: null,
    masterGain: null,
    sfxGain: null,
    musicGain: null,
    noiseBuffer: null,
    sfxEnabled: true,
    musicEnabled: true,
    musicRunning: false,
    _bassOsc: null,
    _bassGain: null,
    _padTimer: null,
    _started: false,

    // Must be called from within a user-gesture handler (iOS/Safari policy).
    unlock() {
      if (this._started) {
        if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      this._started = true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 0.8 : 0;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.001;
      this.musicGain.connect(this.masterGain);

      this._buildNoiseBuffer();
      if (this.musicEnabled) this.startMusic();
    },

    _resume() {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },

    _buildNoiseBuffer() {
      const len = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    },

    setSfxEnabled(on) {
      this.sfxEnabled = on;
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
    },

    setMusicEnabled(on) {
      this.musicEnabled = on;
      if (!this.ctx) return;
      if (on) this.startMusic();
      else this.stopMusic();
    },

    // ---------------- SFX ----------------
    playShot() {
      if (!this._readyForSfx()) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "square";
      const f0 = 820 + Math.random() * 220;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.1);
    },

    playKill(type) {
      if (!this._readyForSfx()) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const isBoss = type === "boss";
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = isBoss ? 300 : 900 + Math.random() * 400;
      filter.Q.value = 1.2;
      const g = ctx.createGain();
      const dur = isBoss ? 0.4 : 0.12;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(isBoss ? 0.35 : 0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter).connect(g).connect(this.sfxGain);
      src.start(t);
      src.stop(t + dur + 0.05);
    },

    playImpact() {
      if (!this._readyForSfx()) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.22);
    },

    playPurchase() {
      if (!this._readyForSfx()) return;
      const ctx = this.ctx, t = ctx.currentTime;
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = t + i * 0.07;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(g).connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    },

    playWaveStart() {
      if (!this._readyForSfx()) return;
      const ctx = this.ctx, t = ctx.currentTime;
      [440, 554, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const start = t + i * 0.06;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
        osc.connect(g).connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + 0.16);
      });
    },

    playNova() {
      if (!this._readyForSfx()) return;
      const ctx = this.ctx, t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.26, t);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(oscGain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.6);

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      src.connect(filter).connect(g).connect(this.sfxGain);
      src.start(t);
      src.stop(t + 0.5);
    },

    playGameOver() {
      if (!this._readyForSfx()) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 1.05);
    },

    _readyForSfx() {
      if (!this.ctx || !this.sfxEnabled) return false;
      this._resume();
      return true;
    },

    // ---------------- Generative ambient music ----------------
    // A-minor-ish pentatonic drone + slowly evolving pad notes. Never
    // repeats exactly the same way twice; loops forever until stopped.
    SCALE: [55, 65.41, 73.42, 82.41, 98, 110, 130.81, 146.83, 164.81, 196, 220],

    startMusic() {
      if (this.musicRunning || !this.ctx) return;
      this.musicRunning = true;
      const ctx = this.ctx;
      this.musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);

      // slow droning bass with gentle filter movement
      const bass = ctx.createOscillator();
      bass.type = "sine";
      bass.frequency.value = this.SCALE[0];
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = "lowpass";
      bassFilter.frequency.value = 300;
      const bassGain = ctx.createGain();
      bassGain.gain.value = 0.18;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain).connect(bassFilter.frequency);
      bass.connect(bassFilter).connect(bassGain).connect(this.musicGain);
      bass.start();
      lfo.start();
      this._bassOsc = bass;
      this._bassLfo = lfo;
      this._bassGain = bassGain;

      const scheduleNextPad = () => {
        if (!this.musicRunning) return;
        this._playPadNote();
        const wait = 2200 + Math.random() * 2600;
        this._padTimer = setTimeout(scheduleNextPad, wait);
      };
      scheduleNextPad();
    },

    _playPadNote() {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const baseFreq = this.SCALE[1 + Math.floor(Math.random() * (this.SCALE.length - 1))];
      const detune = (Math.random() - 0.5) * 4;
      [baseFreq, baseFreq * 2].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.detune.value = detune * (i + 1);
        const g = ctx.createGain();
        const peak = i === 0 ? 0.09 : 0.035;
        const attack = 1.4 + Math.random() * 0.8;
        const hold = 1.5;
        const release = 2.6 + Math.random();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + attack);
        g.gain.setValueAtTime(peak, t + attack + hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
        osc.connect(g).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + attack + hold + release + 0.2);
      });
    },

    stopMusic() {
      if (!this.musicRunning) return;
      this.musicRunning = false;
      clearTimeout(this._padTimer);
      const ctx = this.ctx;
      if (ctx && this.musicGain) {
        this.musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      }
      const bass = this._bassOsc, lfo = this._bassLfo;
      setTimeout(() => {
        try { bass && bass.stop(); } catch (e) {}
        try { lfo && lfo.stop(); } catch (e) {}
      }, 600);
      this._bassOsc = null;
      this._bassLfo = null;
    },
  };

  global.Sfx = Sfx;
})(window);
