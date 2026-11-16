// NEON VOID — every sound is synthesized with WebAudio: no audio files,
// no network, nothing to load. The context is created lazily on the first
// user gesture (browsers block audio before one) and stays silent in the
// screenshot scenes, which never call init(). M toggles mute.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    musicGain: null,
    muted: false,
    musicOn: false,
    nextNote: 0,
    step: 0,
    timer: 0,
  };
}

function ensure(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
  } catch {
    return false;
  }
  return true;
}

export function initAudio(audio) {
  ensure(audio);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.ctx) audio.master.gain.setTargetAtTime(muted ? 0 : 0.5, audio.ctx.currentTime, 0.02);
}

function tone(audio, freq, dur, type, vol, slideTo) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(audio, dur, vol, filterFreq) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(t);
}

export const sfx = {
  shoot(audio) { tone(audio, 880, 0.07, 'square', 0.08, 320); },
  enemyDie(audio) { noise(audio, 0.22, 0.22, 1400); tone(audio, 220, 0.18, 'sawtooth', 0.1, 55); },
  playerHit(audio) { noise(audio, 0.16, 0.3, 900); tone(audio, 160, 0.2, 'sawtooth', 0.16, 60); },
  dash(audio) { noise(audio, 0.14, 0.14, 3200); },
  pickup(audio) { tone(audio, 523, 0.09, 'sine', 0.16); tone(audio, 784, 0.12, 'sine', 0.16); },
  wave(audio) { tone(audio, 196, 0.3, 'triangle', 0.2, 392); tone(audio, 294, 0.3, 'triangle', 0.12, 588); },
  win(audio) {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone(audio, f, 0.35, 'triangle', 0.18), i * 120);
    });
  },
  lose(audio) { tone(audio, 330, 0.9, 'sawtooth', 0.14, 55); },
};

// A tiny sequencer: a driving bass pulse with a sparse minor arpeggio.
// It schedules 8th notes ahead of time and is advanced from the game loop;
// in shot mode it is never started, so screenshots stay silent.
const BASS = [55, 55, 65.41, 49];
const ARP = [220, 261.63, 329.63, 392, 329.63, 261.63];

export function startMusic(audio) {
  if (!ensure(audio) || audio.musicOn) return;
  audio.musicOn = true;
  audio.nextNote = audio.ctx.currentTime + 0.05;
  audio.step = 0;
}

export function updateMusic(audio, dt) {
  if (!audio.musicOn || !audio.ctx || audio.muted) return;
  audio.timer += dt;
  const stepDur = 60 / 132 / 2; // 132 BPM, 8th notes
  while (audio.nextNote < audio.ctx.currentTime + 0.12) {
    const s = audio.step % 8;
    const t = audio.nextNote;
    const bass = BASS[Math.floor(audio.step / 8) % BASS.length];
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = bass;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
    osc.connect(gain);
    gain.connect(audio.musicGain);
    osc.start(t);
    osc.stop(t + stepDur);
    if (s % 2 === 0) {
      const a = audio.ctx.createOscillator();
      const ag = audio.ctx.createGain();
      a.type = 'triangle';
      a.frequency.value = ARP[(audio.step / 2 | 0) % ARP.length] * 2;
      ag.gain.setValueAtTime(0.0001, t);
      ag.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      ag.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
      a.connect(ag);
      ag.connect(audio.musicGain);
      a.start(t);
      a.stop(t + stepDur * 2);
    }
    audio.nextNote += stepDur;
    audio.step += 1;
  }
}
