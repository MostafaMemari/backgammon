/**
 * Sound engine.
 *
 * Every sound is synthesized live with the Web Audio API - there are no audio
 * assets to download, so sounds work instantly on slow connections and in
 * countries where CDNs are unreliable. Volume / mute live in the redux
 * settings slice and are read at play time.
 */

import { store } from "./store/store";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function soundEnabled(): boolean {
  const s = store.getState().settings;
  return s.soundEnabled && s.soundVolume > 0;
}

function soundVolume(): number {
  return store.getState().settings.soundVolume / 100;
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (ctx == null || master == null) {
    const Ctor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctor == null) {
      return null;
    }
    const newCtx: AudioContext = new Ctor();
    const newMaster = newCtx.createGain();
    newMaster.gain.value = 0.9;
    newMaster.connect(newCtx.destination);
    ctx = newCtx;
    master = newMaster;
  }
  if (ctx!.state === "suspended") {
    ctx!.resume().catch(() => {
      /* Will retry on the next user gesture. */
    });
  }
  return ctx!;
}

// Browsers only allow audio after a user gesture. Nudge the context back to
// life on every pointer/key press; this is a no-op once it is running.
if (typeof window !== "undefined") {
  const unlock = () => {
    if (ctx != null && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

/** Short burst of filtered noise - the backbone of clicks, cracks, rattles. */
function noiseBurst(
  context: AudioContext,
  out: AudioNode,
  at: number,
  duration: number,
  filterType: BiquadFilterType,
  filterFreq: number,
  gainValue: number,
  q = 1
): void {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const src = context.createBufferSource();
  src.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.setValueAtTime(gainValue, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(at);
  src.stop(at + duration + 0.02);
}

/** A short pitched "wood" tone with a fast decay. */
function woodTone(
  context: AudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  duration: number,
  gainValue: number
): void {
  const osc = context.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(gainValue, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Pure sine note (chimes / jingles). */
function tone(
  context: AudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = "sine"
): void {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(gainValue, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

function play(fn: (context: AudioContext, out: AudioNode, t0: number) => void) {
  if (!soundEnabled()) {
    return;
  }
  const context = ensureContext();
  if (context == null || master == null || context.state !== "running") {
    return;
  }
  try {
    fn(context, master, context.currentTime + 0.01);
  } catch {
    /* Never let audio break the game. */
  }
}

/*******************
 * Public sounds    *
 *******************/

/** Dice tumbling on the board: a burst of dry clicks fading out. */
export function playDiceRoll(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    const clicks = 9;
    for (let i = 0; i < clicks; i++) {
      const at = t0 + i * (0.035 + Math.random() * 0.05);
      const clatter = 1 - i / clicks;
      noiseBurst(
        context,
        out,
        at,
        0.03 + Math.random() * 0.02,
        "bandpass",
        1400 + Math.random() * 2600,
        (0.12 + clatter * 0.22) * vol,
        2.5
      );
      woodTone(
        context,
        out,
        at,
        190 + Math.random() * 130,
        0.045,
        clatter * 0.16 * vol
      );
    }
    // Final settle of the two dice.
    noiseBurst(context, out, t0 + 0.42, 0.05, "bandpass", 900, 0.16 * vol, 2);
    woodTone(context, out, t0 + 0.42, 150, 0.09, 0.22 * vol);
  });
}

/**
 * A checker being placed on a point. Pitch rises slightly with the stack
 * height so tall towers sound "fuller".
 */
export function playCheckerPlace(stackIndex = 0): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    const detune = 1 + (Math.random() - 0.5) * 0.06;
    const freq = (185 + Math.min(5, stackIndex) * 9) * detune;
    woodTone(context, out, t0, freq, 0.11, 0.3 * vol);
    woodTone(context, out, t0, freq * 2.7, 0.045, 0.1 * vol);
    noiseBurst(context, out, t0, 0.02, "highpass", 2200, 0.12 * vol);
  });
}

/** A blot is broken: sharp crack + lower knock + little rattle. */
export function playCheckerHit(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    noiseBurst(context, out, t0, 0.05, "highpass", 1800, 0.34 * vol);
    woodTone(context, out, t0 + 0.005, 320, 0.07, 0.3 * vol);
    woodTone(context, out, t0 + 0.05, 140, 0.14, 0.32 * vol);
    // Rattle: the hit checker clatters onto the bar.
    for (let i = 0; i < 4; i++) {
      const at = t0 + 0.1 + i * 0.055;
      noiseBurst(
        context,
        out,
        at,
        0.025,
        "bandpass",
        1700 + Math.random() * 1400,
        (0.14 - i * 0.025) * vol,
        3
      );
    }
  });
}

/** Soft tick when selecting a movable checker. */
export function playSelect(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    woodTone(context, out, t0, 520, 0.05, 0.12 * vol);
    noiseBurst(context, out, t0, 0.015, "highpass", 3200, 0.06 * vol);
  });
}

/** Muffled thud for illegal clicks. */
export function playDeny(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    woodTone(context, out, t0, 110, 0.1, 0.16 * vol);
  });
}

/** Warm two-note chime: it is your turn (dice are ready). */
export function playYourTurn(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    tone(context, out, t0, 659.25, 0.22, 0.16 * vol);
    tone(context, out, t0 + 0.12, 880, 0.34, 0.18 * vol);
  });
}

/** Little fanfare when the local player wins. */
export function playWin(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone(context, out, t0 + i * 0.13, f, 0.4, 0.2 * vol);
      tone(context, out, t0 + i * 0.13, f * 2, 0.25, 0.05 * vol);
    });
  });
}

/** Soft two-note blip: a chat message arrived from the opponent. */
export function playChatReceive(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    tone(context, out, t0, 740, 0.12, 0.12 * vol);
    tone(context, out, t0 + 0.09, 988, 0.2, 0.12 * vol);
  });
}

/** Playful rising "boing-pop" when a sticker bursts onto the board. */
export function playStickerPop(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.16);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.2 * vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
    osc.connect(gain).connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.28);
    // Little "tick" on top so it reads as a bubble bursting.
    noiseBurst(context, out, t0, 0.03, "highpass", 2400, 0.1 * vol);
  });
}

/** Sober descending pair when the local player loses. */
export function playLose(): void {
  play((context, out, t0) => {
    const vol = soundVolume();
    tone(context, out, t0, 392, 0.35, 0.16 * vol);
    tone(context, out, t0 + 0.2, 261.63, 0.55, 0.16 * vol);
  });
}
