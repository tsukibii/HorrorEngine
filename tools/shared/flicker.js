// A light's flicker by mode (STORY_FORMAT §2 `light`: `flicker` 0..1 how much, `mode` which; after Light Kit's
// Flicker component, Light Kit's, the Unreal plugin it was first written for, the same curves):
//   (none)       the old wobble: two sines beating, the amount deep
//   fluorescent  a tube: steady, then now and then a stutter of quick drops (every `interval` s or so)
//   dying        a failing bulb or tube: drops out often, sometimes for a while, never quite full between
//   candle       a flame: a fast, small, restless wobble
//   pulse        a slow breath up and down, `rate` breaths a second
//   custom       your own `letters`: a (off) to m (as placed) to z (double), `rate` letters a second, looping
// A tube switched on stutters on for a moment (`flickerOn`). Shared by the desk (stage.js the Watch, runtime.js
// Play) and ported to Godot (flicker.gd); the two must agree. Everything is drawn from the clock and a seed, so a
// light flickers the same way on every run.
export const MODES = ["fluorescent", "dying", "candle", "pulse", "custom"];
export const DEFAULTS = { interval: 6, rate: { pulse: 0.5, custom: 10 }, letters: "mmmmmmmmmmmmmmmmmmmmamammmmmmmmmmmmmmmammmmmmmm" };
function hash(i, seed) {                                                            // 32-bit all the way, as flicker.gd's
  let h = (Math.imul(i, 374761393) + Math.imul(seed, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = f => f * f * (3 - 2 * f);
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i; return (hash(i, seed) * (1 - sm(f)) + hash(i + 1, seed) * sm(f)) * 2 - 1; }   // smooth, -1..1
const rnd = (u, T, n) => hash(Math.floor(T * 60) + n * 7919, u.seed || 1);         // a fresh draw each 60th of a second, the same on every run

// the light's settings from the story's light (its `d`): what the runtimes keep on the light
export function flickerOf(d = {}, id = "") {
  const mode = MODES.includes(d.mode) ? d.mode : null;
  let seed = 1; for (const ch of String(id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return { flicker: d.flicker !== undefined ? +d.flicker : (mode ? 1 : 0), mode, interval: +d.interval || DEFAULTS.interval,
    rate: +d.rate || DEFAULTS.rate[mode] || 1, letters: typeof d.letters === "string" && d.letters ? d.letters.toLowerCase() : DEFAULTS.letters, seed: seed || 1 };
}

// the tube switched on: a moment of the starter clicking (fluorescent and dying only)
export function flickerOn(u, T) { if (u.mode === "fluorescent" || u.mode === "dying") u.fl_start = T + 0.4 + 0.8 * rnd(u, T, 3); }

// the multiplier on the light's energy now
export function flickerK(u, T) {
  const amount = +u.flicker || 0;
  if (u.fl_start && T < u.fl_start) return rnd(u, T, 1) < 0.45 ? 0.05 : 0.6 + 0.4 * rnd(u, T, 2);
  if (!u.mode) return amount ? 1 - amount * 0.5 * Math.max(0, Math.sin(T * 13.7) * Math.sin(T * 7.3)) : 1;
  let M = 1;
  if (u.mode === "fluorescent" || u.mode === "dying") {
    const dying = u.mode === "dying", interval = u.interval || DEFAULTS.interval;
    if (u.fl_next === undefined) u.fl_next = (0.3 + 1.7 * rnd(u, T, 4)) * interval, u.fl_end = -1;
    if (T >= u.fl_next && u.fl_end < T) {
      u.fl_end = T + (dying ? 0.05 + 0.75 * rnd(u, T, 5) : 0.12 + 0.28 * rnd(u, T, 5));
      u.fl_next = u.fl_end + ((dying ? 0.1 : 0.5) + (dying ? 1.9 : 1.5) * rnd(u, T, 6)) * interval * (dying ? 0.3 : 1);
    }
    if (T < u.fl_end) M = dying && rnd(u, T, 7) < 0.6 ? 0 : (rnd(u, T, 8) < 0.5 ? 0.15 : 1);
    else if (dying) M = 0.75 + 0.1 * noise1(T * 3, u.seed);
  } else if (u.mode === "candle") M = 1 + 0.14 * noise1(T * 7, u.seed) + 0.06 * noise1(T * 23 + 5, u.seed + 1);
  else if (u.mode === "pulse") M = 1 - 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * (u.rate || 0.5) * T));
  else if (u.mode === "custom") {
    const s = u.letters || DEFAULTS.letters;
    if (s.length) { const ch = s.charCodeAt(Math.floor(T * (u.rate || 10)) % s.length) - 97; M = Math.min(25, Math.max(0, ch)) / 12; }
  }
  return 1 + (M - 1) * amount;
}
