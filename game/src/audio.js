// Sound for VAULTFALL: WebAudio oscillators only — no audio files, no network.
// A tiny synth: soft blips for footsteps and pickups, a rising two-tone warn
// while a guard's suspicion climbs, a siren pulse during lockdown, and a low
// sting on being caught. Created lazily on the first user gesture.
export function createAudio() {
  return {
    ctx: null,
    muted: false,
    lastStep: 0,
    warnOsc: null,
  };
}

function ensureCtx(audio) {
  if (!audio.ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audio.ctx = new Ctor();
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  return audio.ctx;
}

/** One short oscillator blip. */
function blip(audio, freq, duration, type, gainValue, when = 0) {
  if (audio.muted) return;
  const ctx = ensureCtx(audio);
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(gainValue, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** Soft footstep tick, throttled so it never machine-guns. */
export function playStep(audio, time) {
  if (time - audio.lastStep < 0.28) return;
  audio.lastStep = time;
  blip(audio, 140, 0.06, 'sine', 0.04);
}

/** Bright two-note chime when loot is pocketed. */
export function playPickup(audio) {
  blip(audio, 660, 0.12, 'sine', 0.08);
  blip(audio, 990, 0.18, 'sine', 0.08, 0.09);
}

/** Vault cracked: a little arpeggio. */
export function playVault(audio) {
  [523, 659, 784, 1047].forEach((f, i) => blip(audio, f, 0.16, 'triangle', 0.07, i * 0.08));
}

/** Warning beep whose pitch follows guard suspicion (0..1). */
export function playWarn(audio, suspicion) {
  blip(audio, 300 + suspicion * 500, 0.09, 'square', 0.03);
}

/** Lockdown siren: two alternating tones. */
export function playSiren(audio) {
  blip(audio, 520, 0.22, 'sawtooth', 0.05);
  blip(audio, 390, 0.22, 'sawtooth', 0.05, 0.24);
}

/** Caught sting: a low descending note. */
export function playCaught(audio) {
  blip(audio, 220, 0.5, 'sawtooth', 0.09);
  blip(audio, 110, 0.7, 'sawtooth', 0.09, 0.15);
}

/** Win fanfare: three rising notes. */
export function playWin(audio) {
  [523, 659, 784].forEach((f, i) => blip(audio, f, 0.25, 'triangle', 0.08, i * 0.12));
}

/** Toggle mute. Returns the new muted state. */
export function toggleMute(audio) {
  audio.muted = !audio.muted;
  return audio.muted;
}
