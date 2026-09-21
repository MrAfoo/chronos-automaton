"use client";

// ============================================================================
// PROCEDURAL CLOCKWORK SOUND SYNTHESIZER (WEB AUDIO API)
// Pure Web Audio API: Zero external audio files or network requests.
// ============================================================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Ascending harmonic chime on collecting a Chronos Cog
 * Pitch increases with active combo multiplier
 */
export function playCollectSound(combo: number = 1): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const baseFreq = 587.33 * (1 + (combo - 1) * 0.12); // D5 scaled by combo

  // Primary crystal sine chime
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.28);

  // Metallic secondary harmonic tick
  const harmonic = ctx.createOscillator();
  const harmGain = ctx.createGain();

  harmonic.type = "triangle";
  harmonic.frequency.setValueAtTime(baseFreq * 2.0, now);
  harmGain.gain.setValueAtTime(0.12, now);
  harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  harmonic.connect(harmGain);
  harmGain.connect(ctx.destination);

  harmonic.start(now);
  harmonic.stop(now + 0.18);
}

/**
 * Shimmering dual-tone arpeggio on collecting a special power-up
 */
export function playPowerupSound(type: "slowmo" | "shield" | "magnet" = "slowmo"): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes =
    type === "slowmo"
      ? [440, 554.37, 659.25, 880]
      : type === "shield"
      ? [523.25, 659.25, 783.99, 1046.5]
      : [659.25, 830.61, 987.77, 1318.5];

  notes.forEach((freq, idx) => {
    const noteTime = now + idx * 0.055;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.2, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.35);
  });
}

/**
 * Resonant metallic clang + crystalline shatter when Aegis Shield absorbs a hit
 */
export function playShieldDeflectSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Resonant metallic bell
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(840, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.45);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}

/**
 * Low-frequency mechanical impact crunch on collision
 */
export function playCrashSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Low frequency thud
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.35);
}

/**
 * Quick soft aerodynamic swoosh on lane change
 */
export function playLaneSwitchSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(340, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}
