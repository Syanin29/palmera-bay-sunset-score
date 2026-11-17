// All sound synthesized with WebAudio: engine hum, siren, gunshots, bass loop.
// Nothing runs before first interaction (autoplay policy).
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.sirenTimer = null;
    this.musicStep = 0;
    this.sirenHigh = false;
    this.sirenOn = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 52;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 26;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); this.engineOsc2.connect(lp);
      lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); this.engineOsc2.start();
      this.startMusic();
      this.startSiren();
    } catch { this.ctx = null; }
  }
  setEngine(speedKmh, inCar) {
    if (!this.ctx) return;
    const target = inCar ? 0.045 + Math.min(0.15, Math.abs(speedKmh) / 900) : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
    const f = 50 + Math.abs(speedKmh) * 1.15;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f / 2, this.ctx.currentTime, 0.08);
  }
  setSiren(on) { this.sirenOn = on; }
  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  noise(dur, vol = 0.3, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  gunshot() { this.noise(0.14, 0.4, 2400); this.blip(140, 0.1, 'square', 0.15); }
  punch() { this.noise(0.08, 0.25, 500); }
  crash() { this.noise(0.25, 0.35, 700); }
  pickup() { this.blip(660, 0.12); setTimeout(() => this.blip(990, 0.18), 90); }
  cash() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.22), i * 90)); }
  busted() { [440, 349, 293].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.15), i * 160)); }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // Sunset bass groove in A minor: roots with soft lead echo, step each 240ms
    const bass = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
    const lead = [220, 0, 261.63, 0, 0, 329.63, 0, 0, 220, 0, 0, 293.66, 0, 0, 246.94, 0];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.musicStep % 16; this.musicStep += 1;
      if (bass[i]) this.blip(bass[i], 0.22, 'triangle', 0.09);
      if (lead[i]) this.blip(lead[i], 0.3, 'sine', 0.035);
      if (i % 4 === 2) this.noise(0.03, 0.03, 6000);
    }, 240);
  }
  startSiren() {
    if (!this.ctx || this.sirenTimer) return;
    this.sirenTimer = setInterval(() => {
      if (this.muted || !this.ctx || !this.sirenOn) return;
      this.sirenHigh = !this.sirenHigh;
      this.blip(this.sirenHigh ? 880 : 659, 0.42, 'sine', 0.045);
    }, 450);
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
}
