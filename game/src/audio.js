// Procedural sound: engine drone pitched by throttle, wind rush, ring chimes,
// mail-drop thuds and a short success phrase. No audio files needed.

export class Sound {
  constructor() {
    this.ctx = null;
    this.engine = null;
    this.wind = null;
    this.muted = false;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      if (this.muted) this.ctx.suspend();
      else this.ctx.resume();
    }
    return this.muted;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const engineOsc = this.ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    const engineGain = this.ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(this.ctx.destination);
    engineOsc.start();
    this.engine = { osc: engineOsc, gain: engineGain, filter: engineFilter };

    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter).connect(windGain).connect(this.ctx.destination);
    noise.start();
    this.wind = { gain: windGain, filter: windFilter };
  }

  update(plane) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = plane.engineOn ? 52 + plane.throttle * 88 : 0;
    this.engine.osc.frequency.setTargetAtTime(Math.max(1, rpm), t, 0.08);
    this.engine.gain.gain.setTargetAtTime(plane.engineOn ? 0.05 + plane.throttle * 0.06 : 0, t, 0.1);
    this.wind.gain.gain.setTargetAtTime(Math.min(0.11, plane.speed / 1400), t, 0.12);
    this.wind.filter.frequency.setTargetAtTime(420 + plane.speed * 5, t, 0.12);
  }

  tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  ring() { this.tone(880, 0.16); this.tone(1318, 0.22, 'sine', 0.1, 0.07); }
  drop() { this.tone(180, 0.14, 'triangle', 0.16); }
  delivered() { this.tone(660, 0.12); this.tone(990, 0.18, 'sine', 0.1, 0.08); }
  thud() { this.tone(72, 0.3, 'triangle', 0.24); }
  crash() { this.tone(52, 0.6, 'sawtooth', 0.2); this.tone(38, 0.8, 'triangle', 0.22, 0.05); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.12, i * 0.11)); }
  click() { this.tone(1200, 0.05, 'square', 0.05); }
}
