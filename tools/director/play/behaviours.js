// Behaviours: what a cast member does during play (docs/GAMEPLAY_PLAN.md §2), set by the `behave` action. Not AI:
// (whether she sees the player is the runtime's, for any behaviour: the `sees` setting, runtime.sees)
// each is a small routine with settings. `start(npc, rt, s)` sets it up, `update(npc, rt, dt, s)` moves it on; both
// write the npc's state, which the runtime draws: `level`, `pos` (feet, three's space), `yaw` (story degrees),
// `pose` (a pose library name) and `walking`; a `motion` setting (the story's motions table) plays instead of the pose
// while she stands or sits, or while she walks a path or a patrol (the runtime's drawNpcs). A route is a level's named list of spots (STORY_FORMAT §2,
// `levels.<id>.routes`), or a list of spots given in place; rt.route() resolves either.
import * as THREE from "three";
import { register, part } from "./parts.js";
import { s2t } from "../stage.js";

const TURN = 240;                                   // degrees a second when she turns to a heading
const ARRIVE = 0.05;                                // metres: at a point
const turnTo = (npc, yaw, dt) => {
  const d = ((yaw - npc.yaw) % 360 + 540) % 360 - 180, step = TURN * dt;
  npc.yaw += Math.abs(d) <= step ? d : Math.sign(d) * step;
  return Math.abs(d) <= step;
};
const spotPos = t => s2t(t.pos[0], t.pos[1], t.pos[2] || 0);

// stand at a spot (idle, or any pose), facing its rot, or `face` (a thing or a cast member) when given
function at(npc, rt, s) {
  const t = rt.plan.things[s.at]; if (!t) { rt.hud.log(`behave: no spot ${s.at}`); return false; }
  npc.level = t.level; npc.pos = spotPos(t); npc.yaw = t.yaw || 0; npc.walking = false;
  return true;
}
function faceThing(npc, rt, s, dt) {
  if (!s.face) return;
  const o = rt.byId && rt.byId[s.face], f = !o && rt.npcs[s.face];
  const p = o ? o.getWorldPosition(new THREE.Vector3()) : f ? f.pos : s.face === "player" ? rt.player.pos : null;
  if (p) turnTo(npc, Math.atan2(-(p.z - npc.pos.z), p.x - npc.pos.x) * 180 / Math.PI, dt);
}
register("behaviour", "idle", {
  settings: { at: null, pose: "idle", face: null, motion: null },
  start: (npc, rt, s) => { if (at(npc, rt, s)) npc.pose = s.pose; },
  update: (npc, rt, dt, s) => faceThing(npc, rt, s, dt),
});
register("behaviour", "sit", {
  settings: { at: null, pose: "sit", motion: null },
  start: (npc, rt, s) => { if (at(npc, rt, s)) npc.pose = s.pose; },
  update: () => {},
});

// walk a route: to each point in turn at `speed`, turning as she goes; a point's `wait` holds her there (facing its
// rot, in its `pose`), then on. `mode`: loop, pingpong, once (stops at the end, idle); the route's own mode unless set
function walkRoute(npc, rt, dt, s, r, onEnd) {
  const st = npc.st;
  if (!r.points.length) return;
  if (st.wait > 0) { st.wait -= dt; if (st.pose) turnTo(npc, st.faceYaw, dt); if (st.wait <= 0) st.pose = null; npc.pose = st.pose || s.pose; return; }
  const pt = r.points[st.i], d = pt.pos.clone().sub(npc.pos).setY(0), dist = d.length();
  if (dist <= ARRIVE) {
    if (pt.wait) { st.wait = pt.wait; st.pose = pt.pose; st.faceYaw = pt.yaw; npc.walking = false; npc.pose = pt.pose || s.pose; }
    if (pt.check && rt.player.hiding === pt.check) rt.caught(npc.cid, pt.check);   // she looks in that hiding place
    const n = r.points.length, mode = s.mode || r.mode;
    if (mode === "pingpong" && n > 1) { if (st.i + st.dir >= n || st.i + st.dir < 0) st.dir = -st.dir; st.i += st.dir; }
    else if (st.i + 1 < n) st.i += 1;
    else if (mode === "once") { npc.walking = false; npc.pose = s.pose; if (onEnd) onEnd(); return; }
    else st.i = 0;
    return;
  }
  npc.walking = true; npc.pose = s.pose; npc.level = r.level;
  const ready = turnTo(npc, Math.atan2(-d.z, d.x) * 180 / Math.PI, dt);
  const step = Math.min(dist, s.speed * dt * (ready ? 1 : 0.3));               // she turns, then walks
  npc.pos.addScaledVector(d.normalize(), step);
}
register("behaviour", "path", {
  settings: { route: null, mode: null, speed: 1.1, pose: "idle", from: "nearest", motion: null },   // m/s; from: nearest or first; motion: while she walks
  start: (npc, rt, s) => {
    const r = npc.st.r = rt.route(s.route); if (!r) return;
    npc.st.dir = 1; npc.st.wait = 0;
    if (!npc.pos) { npc.pos = r.points[0].pos.clone(); npc.yaw = r.points[0].yaw; npc.level = r.level; }
    npc.st.i = s.from === "first" ? 0 : r.points.reduce((b, p, i) => p.pos.distanceTo(npc.pos) < r.points[b].pos.distanceTo(npc.pos) ? i : b, 0);
  },
  update: (npc, rt, dt, s) => { if (npc.st.r) walkRoute(npc, rt, dt, s, npc.st.r); },
});
// patrol: walk each route once, then the next (in order, or `pick: "random"`); the story swaps the set with another behave
register("behaviour", "patrol", {
  settings: { routes: [], pick: "order", speed: 1.1, pose: "idle", motion: null },
  start: (npc, rt, s) => { npc.st.k = -1; next(npc, rt, s); },
  update: (npc, rt, dt, s) => { if (npc.st.r) walkRoute(npc, rt, dt, Object.assign({}, s, { mode: "once" }), npc.st.r, () => next(npc, rt, s)); },
});
function next(npc, rt, s) {
  const rs = s.routes || []; if (!rs.length) return;
  const k = s.pick === "random" && rs.length > 1 ? (npc.st.k + 1 + Math.floor(Math.random() * (rs.length - 1))) % rs.length : (npc.st.k + 1) % rs.length;
  npc.st.k = k; npc.st.r = rt.route(rs[k]); npc.st.i = 0; npc.st.wait = 0; npc.st.dir = 1;
  if (npc.st.r && !npc.pos) { npc.pos = npc.st.r.points[0].pos.clone(); npc.level = npc.st.r.level; }
}

export const behaviourOf = name => part("behaviour", name);
