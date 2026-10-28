// Cleaning (DECISIONS 2026-10-28): a stain (use: clean) is scrubbed away by holding the left button on it. Its blot
// fades as the seconds of scrubbing add up (`secs`, 3 by default), a cloth sound with the strokes, and the thing in
// the hand works at it when it's the one the stain needs (`with`: an item: the mop, a rag). Let go, look away, and it
// waits where it got to. Clean, it's gone (kept with the level) and the story hears {"use": id}. Without what it needs
// in the hand it says so ("Need the mop"), and a click thinks it.
import { register } from "./parts.js";

const progressOf = (t, rt) => ((rt.kept[rt.level].clean = rt.kept[rt.level].clean || {})[t.userData.id] || 0);
const needs = t => ((t.userData.piece || {}).d || {}).with || null;
const has = (t, rt) => { const w = needs(t); return !w || (!!rt.carried && rt.carried.item === w); };

register("interactable", "clean", {
  settings: { cursor: "use", label: "Hold to clean", need: "Need", thought: "I need something to clean this with.", secs: 3,
              sounds: ["cloth_01", "cloth_02", "cloth_03", "cloth_04"], every: 0.36 },
  holds: true,                                        // the runtime calls hold() every frame the button is down on it
  prompt: (t, rt, s) => (has(t, rt) ? { cursor: s.cursor, label: progressOf(t, rt) > 0 ? `${s.label} · ${Math.round(progressOf(t, rt) * 100)}%` : s.label }
                                    : { cursor: "locked", label: `${s.need} ${rt.itemName(needs(t)).toLowerCase()}` }),
  use: (t, rt, s) => { if (!has(t, rt)) rt.hud.line(s.thought, "", 2.2, true); return false; },   // a click: only says what's missing
  // a frame of scrubbing: true when it's clean
  hold: (t, rt, dt, s) => {
    if (!has(t, rt)) return false;
    const d = (t.userData.piece || {}).d || {}, secs = Math.max(0.2, +(d.secs ?? s.secs)), id = t.userData.id;
    const kept = rt.kept[rt.level].clean = rt.kept[rt.level].clean || {}, p = kept[id] = Math.min(1, (kept[id] || 0) + dt / secs);
    if (t.material) { t.material.opacity = 1 - p * p * (3 - 2 * p) * 0.94; t.material.needsUpdate = false; }
    rt.scrubbing = rt.clock;                           // the hand works (handTick)
    if (rt.clock - (rt.lastScrub || -9) >= s.every) { rt.lastScrub = rt.clock; rt.shelfSound(s.sounds[Math.floor(rt.clock / s.every) % s.sounds.length], id); }
    rt.hud.progress(p);
    return p >= 1;
  },
});
