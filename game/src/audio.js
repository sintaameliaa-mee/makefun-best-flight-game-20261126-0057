// audio.js — every sound is synthesized with WebAudio: no audio files.
// Engine hum follows throttle and speed, wind follows airspeed, and the
// chimes, warnings and thuds are short oscillator envelopes.
export function makeAudio() {
  const audio = {
    ctx: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windGain: null,
    windSource: null,
    master: null,
    muted: false,
    started: false,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);

      // Engine: two detuned saws through a low-pass filter.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineOsc2 = audio.ctx.createOscillator();
      audio.engineOsc2.type = 'sawtooth';
      audio.engineOsc2.frequency.value = 82;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(filter);
      audio.engineOsc2.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      audio.engineOsc2.start();

      // Wind: looped white noise through a band-pass filter.
      const len = audio.ctx.sampleRate * 2;
      const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      audio.windSource = audio.ctx.createBufferSource();
      audio.windSource.buffer = buffer;
      audio.windSource.loop = true;
      const windFilter = audio.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 900;
      windFilter.Q.value = 0.6;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      audio.windSource.connect(windFilter);
      windFilter.connect(audio.windGain);
      audio.windGain.connect(audio.master);
      audio.windSource.start();
      audio.started = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  // Call from any user gesture: browsers block audio until then.
  audio.unlock = function unlock() {
    if (ensure() && audio.ctx.state === 'suspended') audio.ctx.resume();
  };

  // Continuous engine + wind, called every frame while flying.
  audio.update = function update(throttle, speed, flying) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const engineLevel = flying ? 0.05 + throttle * 0.075 : 0;
    audio.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 75, t, 0.1);
    audio.engineOsc2.frequency.setTargetAtTime(72 + throttle * 110, t, 0.1);
    const windLevel = flying ? Math.min(0.16, (speed / 118) * 0.16) : 0;
    audio.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
  };

  function tone(freq, duration, type, volume, when = 0) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noiseBurst(duration, volume, lowFreq) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * duration);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq;
    const gain = audio.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t0);
  }

  audio.ring = function ring() {
    tone(659, 0.35, 'sine', 0.22);
    tone(880, 0.5, 'sine', 0.2, 0.09);
    tone(1318, 0.4, 'sine', 0.12, 0.18);
  };
  audio.miss = function miss() {
    tone(220, 0.3, 'triangle', 0.18);
    tone(174, 0.4, 'triangle', 0.15, 0.1);
  };
  audio.warning = function warning() {
    tone(880, 0.12, 'square', 0.08);
    tone(880, 0.12, 'square', 0.08, 0.18);
  };
  audio.land = function land() {
    noiseBurst(0.25, 0.3, 300);
    tone(523, 0.4, 'sine', 0.18, 0.05);
    tone(784, 0.5, 'sine', 0.16, 0.15);
  };
  audio.crash = function crash() {
    noiseBurst(0.9, 0.5, 240);
    tone(65, 0.8, 'sine', 0.35);
  };
  audio.win = function win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'sine', 0.18, i * 0.12));
  };
  audio.click = function click() {
    tone(1200, 0.06, 'sine', 0.1);
  };

  return audio;
}
