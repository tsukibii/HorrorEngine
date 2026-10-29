// Footsteps (DECISIONS 2026-10-28, later): the player's own steps off the sound shelf, by the floor under them (the
// room's `floor`: STORY_FORMAT's "it sets footsteps"), one a stride of the ground really covered, so closer together
// running, softer crouched, and none standing still or walking into a wall; none seated, hidden, asleep, at a lens or
// in a scene either (the abilities don't run then). Never the same sound twice running; on wood now and then a creak.
// And the cast's steps: whoever walks (a route, a patrol, a walk somewhere) is heard where they are, by the floor
// under them, through the walls and fainter across the house (DIRECTING's "footsteps that stop"), while the player has
// the controls, hidden or seated too. Our own code.
import * as THREE from "three";
import { register } from "./parts.js";

// the format's floors onto the shelf's steps (dirt and metal borrow the nearest until the shelf has their own)
export const FLOOR_STEPS = { wood: "step_wood", stone: "step_concrete", tile: "step_concrete", carpet: "step_carpet",
                             dirt: "step_carpet", metal: "step_concrete", water: "step_wet" };
const COUNT = { step_wood: 5, step_concrete: 5, step_carpet: 5, step_wet: 3, step_creaky: 4 };   // step_wood_01..05 on the shelf

const pick = (k, fam) => {                         // one of the family's sounds, never the one this walker just made
  const n = COUNT[fam], prev = k.fam === fam ? k.i : -1;
  let i = Math.floor(Math.random() * (prev >= 0 ? n - 1 : n)); if (prev >= 0 && i >= prev) i++;
  k.fam = fam; k.i = i; return `${fam}_${String(i + 1).padStart(2, "0")}`;
};
// standing on wet ground: a room with no ceiling while the weather (the level's, else the game's) is rain, or a room
// whose own `wet` is 0.5 or more (STORY_FORMAT §2); the Godot export's rule too
const onWet = rt => { const lv = (rt.story.levels || {})[rt.level] || {}, rain = (lv.weather ?? (rt.story.game || {}).weather) === "rain";
  return (lv.rooms || []).some(r => rt.inside.has(r.id) && ((rain && r.ceiling === false) || +(r.wet || 0) >= 0.5)); };
register("ability", "steps", {
  // stride, run, crouch: metres a step walking, running and crouched; db, runDb, crouchDb: how loud against the shelf's
  // own level; creak: the chance a step on wood creaks; castStride, castDb: the cast's (placed: fainter with distance)
  settings: { stride: 0.7, run: 1.05, crouch: 0.45, db: -8, runDb: -4, crouchDb: -17, creak: 0.08, castStride: 0.65, castDb: -2 },
  update: (rt, dt, s) => {
    const p = rt.player, at = p.pos, last = rt.stepFrom, gap = rt.clock - (rt.stepClock ?? -9) > 0.25;
    rt.stepFrom = at.clone(); rt.stepClock = rt.clock;
    if (!last || gap || !dt) { rt.stepAt = 0.5; return; }       // back from a scene, a seat or a hide: from here
    const d = Math.hypot(at.x - last.x, at.z - last.z);
    if (d > 1 || d / dt < 0.2) { rt.stepAt = 0.5; return; }       // standing (or put somewhere new): the next step half a stride on
    rt.stepAt = (rt.stepAt ?? 0.5) + d / (p.crouched ? s.crouch : p.running ? s.run : s.stride);
    if (rt.stepAt < 1) return;
    rt.stepAt -= 1;
    const floor = rt.floorUnder();
    let fam = FLOOR_STEPS[floor] || "step_wood";
    if (onWet(rt)) fam = "step_wet";                 // wet ground: out in the rain, or a room with its own `wet`
    if (fam === "step_wood" && Math.random() < s.creak) fam = "step_creaky";
    const k = rt.lastStep || {}, name = pick(k, fam);
    rt.lastStep = { fam, i: k.i, name, floor, clock: rt.clock }; rt.stepCount = (rt.stepCount || 0) + 1;
    rt.shelfSound(name, null, p.crouched ? s.crouchDb : p.running ? s.runDb : s.db);
  },
});
// the cast's steps, every frame the player has the controls (the runtime's tick): a step each castStride of ground a
// cast member really covers, from where they are
export function castSteps(rt, dt, s) {
  const seen = rt.castWalk = rt.castWalk || {};
  for (const [id, f] of Object.entries(rt.stage.cast || {})) {
    const g = f && f.group; if (!g || !g.visible) continue;          // the stage's figure: its group is where she is
    const at = g.getWorldPosition(new THREE.Vector3()), k = seen[id];
    if (!k || rt.clock - k.clock > 0.25) { seen[id] = { from: at, t: 0.5, clock: rt.clock }; continue; }   // new here, or back from a scene
    const d = Math.hypot(at.x - k.from.x, at.z - k.from.z); k.from = at; k.clock = rt.clock;
    if (!dt || d > 1 || d / dt < 0.3) { k.t = 0.5; continue; }      // standing, turning on the spot, or put somewhere new
    k.t += d / s.castStride;
    if (k.t < 1) continue;
    k.t -= 1;
    const floor = rt.floorUnder(at), name = pick(k, FLOOR_STEPS[floor] || "step_wood");
    rt.castStep = { id, name, floor, clock: rt.clock }; rt.castStepCount = (rt.castStepCount || 0) + 1;
    rt.shelfSound(name, id, s.castDb);
  }
}
