// Footsteps (DECISIONS 2026-10-28, later): the player's own steps off the sound shelf, by the floor under them (the
// room's `floor`: STORY_FORMAT's "it sets footsteps"), one a stride of the ground really covered, so closer together
// running, softer crouched, and none standing still or walking into a wall; none seated, hidden, asleep, at a lens or
// in a scene either (the abilities don't run then). Never the same sound twice running; on wood now and then a creak.
// Our own code.
import { register } from "./parts.js";

// the format's floors onto the shelf's steps (dirt and metal borrow the nearest until the shelf has their own)
export const FLOOR_STEPS = { wood: "step_wood", stone: "step_concrete", tile: "step_concrete", carpet: "step_carpet",
                             dirt: "step_carpet", metal: "step_concrete", water: "step_wet" };
const COUNT = { step_wood: 5, step_concrete: 5, step_carpet: 5, step_wet: 3, step_creaky: 4 };   // step_wood_01..05 on the shelf

register("ability", "steps", {
  // stride, run, crouch: metres a step walking, running and crouched; db, runDb, crouchDb: how loud against the shelf's
  // own level; creak: the chance a step on wood creaks
  settings: { stride: 0.7, run: 1.05, crouch: 0.45, db: -8, runDb: -4, crouchDb: -17, creak: 0.08 },
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
    if (fam === "step_wood" && Math.random() < s.creak) fam = "step_creaky";
    const n = COUNT[fam], prev = rt.lastStep && rt.lastStep.fam === fam ? rt.lastStep.i : -1;
    let i = Math.floor(Math.random() * (prev >= 0 ? n - 1 : n)); if (prev >= 0 && i >= prev) i++;   // never the one just heard
    const name = `${fam}_${String(i + 1).padStart(2, "0")}`;
    rt.lastStep = { fam, i, name, floor, clock: rt.clock }; rt.stepCount = (rt.stepCount || 0) + 1;
    rt.shelfSound(name, null, p.crouched ? s.crouchDb : p.running ? s.runDb : s.db);
  },
});
