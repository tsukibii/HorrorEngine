// Play mode (docs/GAMEPLAY_PLAN.md §8 step 1): walk the built level from the player's eye, use what's there, and run a
// stitch's beats from what the player does. The runtime owns the player (feet, look, eye height), collision with the
// level's solid blocks, the trigger volumes, doors, and the cursor; everything the story names is a registered part
// (play/parts.js): conditions, actions, interactables, abilities.
import * as THREE from "three";
import { part, names, settingsOf } from "./parts.js";
import { matches } from "./conditions.js";
import { runAll } from "./actions.js";
import { interactableOf } from "./interactables.js";
import "./abilities.js";
import { behaviourOf } from "./behaviours.js";
import * as M from "../motion.js";
import { Hud } from "./hud.js";
import { Physics, dieMaterials } from "./physics.js";
import { EYES, FOV_H, vfov, s2t } from "../stage.js";

const ABILITIES = ["look", "walk", "crouch"];     // in the order they run
const THEME = "glass";                           // the HUD theme when a game names none (game.ui_theme)
const LIT = 2.2;                                   // a lamp that starts off: its strength when it's switched on (stage.js's bulb)
const USE_RANGE = 2.2, LOOK_RANGE = 30, DOOR_SECS = 0.6, SLAM_SECS = 0.15;
// a cast member who `sees` (behave): her cone (degrees, full width), its reach (m), how much of it a crouched player
// is seen at, the seconds the suspicion meter takes to fill and to drain, and how long she's calm after a catch
export const SIGHT = { angle: 90, range: 9, crouched: 0.55, meter: 1.2, drain: 1.5, calm: 3 };
const flagsHold = (ifs, flags) => (ifs || []).every(f => f.startsWith("!") ? !flags.has(f.slice(1)) : flags.has(f));

export class PlayRuntime {
  // opts: run (the Watch's run: flags, karma, counters), settings ({crouch: {mode: "hold"}}), theme, fade(to, secs)
  constructor(stage, story, plan, box, opts = {}) {
    Object.assign(this, { stage, story, plan, box, opts });
    this.run = opts.run || null;
    this.flags = (this.run && this.run.flags) || new Set();
    this.items = new Set();
    this.settings = opts.settings || {};
    this.hud = new Hud(box, opts.theme || (story.game || {}).ui_theme || THEME);
    this.player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, eye: EYES.stand, crouched: false };
    this.keys = {}; this.ended = {}; this.clock = 0; this.inside = new Set(); this.doors = {}; this.waits = [];
    this.npcs = {};                                 // cast id -> what they're doing in play (behave), kept across stitches
    this.suspicion = 0; this.calm = 0; this.lastCaught = null;
    this.look = { id: null, t: 0, dist: Infinity }; this.target = null; this.busy = false; this.active = false; this.level = null;
    this.listener = null; this.ray = new THREE.Raycaster();
    this.on = {
      click: () => { if (this.active && !this.busy) box.requestPointerLock(); },
      lock: () => this.hud.locked(document.pointerLockElement === box),
      move: e => { if (this.active && !this.busy && document.pointerLockElement === box) this.ability("look", "mouse", e.movementX, e.movementY); },
      key: e => this.keyEvent(e, e.type === "keydown"),
    };
    box.addEventListener("click", this.on.click);
    document.addEventListener("pointerlockchange", this.on.lock);
    document.addEventListener("mousemove", this.on.move);
    window.addEventListener("keydown", this.on.key); window.addEventListener("keyup", this.on.key);
    this.hud.locked(false);
  }
  stop() {
    this.active = false; this.listener = null; this.stopped = true;
    for (const w of this.waits) w.res(); this.waits = [];
    this.box.removeEventListener("click", this.on.click);
    document.removeEventListener("pointerlockchange", this.on.lock);
    document.removeEventListener("mousemove", this.on.move);
    window.removeEventListener("keydown", this.on.key); window.removeEventListener("keyup", this.on.key);
    if (document.pointerLockElement === this.box) document.exitPointerLock();
    this.hud.remove();
  }
  set(name) { const p = part("ability", name) || part("interactable", name); return settingsOf(p, this.settings[name]); }
  ability(name, fn, ...args) { const p = part("ability", name); if (p && p[fn]) p[fn](this, ...args, this.set(name)); }
  keyEvent(e, down) {
    if (!this.active || this.busy) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyC", "Space"].includes(e.code)) e.preventDefault();
    this.keys[e.code] = down;
    if (down && e.code === "KeyE" && !e.repeat) this.use();
    if (!this.player.hiding) for (const a of ABILITIES) this.ability(a, "key", e, down);
  }

  // ---- the level ---------------------------------------------------------------------------------------------------
  // the stage's world is rebuilt by every scene the Watch plays, so what play changed (doors, things shown or taken)
  // is kept per level and put back
  enterLevel(level) {
    if (this.level === level && this.world === this.stage.world.children[0]) return;
    if (this.stage.level !== level || !this.stage.world.children.length) this.stage.setWorld(this.plan, this.story, level);
    this.stage.setFree(false);
    this.level = level; this.world = this.stage.world.children[0]; this.byId = {}; this.doors = {};
    const kept = (this.kept = this.kept || {})[level] = this.kept[level] || { vis: {}, doors: {}, bodies: {} };
    for (const o of this.stage.world.children) if (o.userData && o.userData.id) this.byId[o.userData.id] = o;
    for (const l of this.stage.lights) { this.byId[l.userData.id] = l; l.userData.on = l.intensity > 0; if (!l.userData.base) l.userData.base = LIT; }
    for (const m of this.stage.world.children) if (m.userData && m.userData.kind === "door") {
      const p = m.userData.piece || {}, by = (p.tags || []).find(t => t.startsWith("locked_by:"));
      const d = this.doors[m.userData.id] = kept.doors[m.userData.id] || { open: false, locked: !!by, by: by ? by.slice(10) : null, deg: 0, from: 0, to: 0, t: 1, secs: DOOR_SECS };
      kept.doors[m.userData.id] = d; d.mesh = m; d.t = 1; d.deg = d.to;
      if (d.deg) this.stage.swingDoor(m, d.deg);
    }
    for (const [id, on] of Object.entries(kept.vis)) this.setVisible(id, on, true);
    if (this.player.hiding) this.stage.seeThrough(this.player.hiding, this.stage.seeThroughOf(this.player.hiding));
    for (const f of Object.values(this.stage.cast)) f.group.visible = false;          // shown again by their behaviour (drawNpcs)
    const movers = this.stage.world.children.filter(o => o.isMesh && o.userData.use === "roll");   // things that roll: dice
    for (const m of movers) {
      m.material = dieMaterials();
      const k = kept.bodies[m.userData.id]; if (k) { m.position.copy(k.p); m.quaternion.copy(k.q); }
    }
    this.physics = movers.length ? new Physics(this.stage, movers) : null;
    this.triggers = this.plan.pieces.filter(p => p.level === level && p.kind === "trigger").map(p => {
      const rv = p.tags.find(t => t.startsWith("room_volume:")), [w, d, h] = p.size, [x, y, z] = p.pos;
      return { id: rv ? rv.slice(12) : p.id, safe: !!(p.d || {}).safe, min: [x - w / 2, y - d / 2, z - h / 2], max: [x + w / 2, y + d / 2, z + h / 2] };
    });
  }
  placeAt(level, spot) {                               // the player on a spot (story coordinates and its yaw)
    this.player.seat = null; this.leaveHiding();
    this.enterLevel(level);
    const t = this.plan.things[spot];
    if (t) this.place(s2t(t.pos[0], t.pos[1], 0), t.yaw || 0, 0);
  }
  // carry on from where a scene left the eye: no cut back to a spot. Still seated or hidden when the eye is where it
  // was (a scene played from the seat or the locker)
  placeFromCamera(level, cam) {
    const p = this.player, f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), stay = (p.seat || p.hiding) && cam.position.distanceTo(this.eyePos()) < 0.4;
    if (!stay) { p.seat = null; this.leaveHiding(); }
    this.enterLevel(level);
    if (stay) { p.yaw = Math.atan2(-f.z, f.x) * 180 / Math.PI; if (p.hiding) this.stage.seeThrough(p.hiding, this.stage.seeThroughOf(p.hiding)); return; }
    this.place(new THREE.Vector3(cam.position.x, Math.max(0, cam.position.y - EYES.stand), cam.position.z), Math.atan2(-f.z, f.x) * 180 / Math.PI, Math.asin(Math.max(-1, Math.min(1, f.y))) * 180 / Math.PI);
  }
  place(feet, yaw, pitch) {
    const p = this.player;
    p.pos.copy(feet); p.yaw = yaw; p.pitch = pitch;
    p.pos.y = this.groundAt(p.pos, 0.5);
    this.inside = new Set(this.triggers.filter(t => this.isIn(t)).map(t => t.id));      // where you are isn't an "enter"
  }

  // ---- collision: the player is an upright circle against every solid block, stepping onto low ones ----------------
  blocks() { return this.stage.solid.filter(m => m.visible && m.geometry && m.geometry.parameters); }
  extent(m) {
    const g = m.geometry.parameters, cy = m.getWorldPosition(new THREE.Vector3()).y;
    if (g.radiusTop !== undefined) return { r: g.radiusTop, hy: g.height / 2, cy };
    if (g.width === undefined) return null;
    return { hx: g.width / 2, hy: g.height / 2, hz: g.depth / 2, cy };
  }
  move(dx, dz, s) {
    const p = this.player;
    p.pos.x += dx; p.pos.z += dz;
    this.stage.world.updateMatrixWorld(true);
    for (let i = 0; i < 3; i++) this.pushOut(s);
    const g = this.groundAt(p.pos, s.step);
    if (g > -Infinity) p.pos.y = g;
  }
  pushOut(s) {
    const p = this.player, r = s.radius, feet = p.pos.y, head = feet + p.eye + 0.1;
    for (const m of this.blocks()) {
      const e = this.extent(m); if (!e) continue;
      if (e.cy + e.hy <= feet + s.step || e.cy - e.hy >= head) continue;      // walked onto, or overhead
      const L = m.worldToLocal(p.pos.clone());
      let px = 0, pz = 0;
      if (e.r !== undefined) {
        const d = Math.hypot(L.x, L.z); if (d >= e.r + r) continue;
        const k = d > 1e-6 ? (e.r + r - d) / d : 0; px = L.x * k; pz = d > 1e-6 ? L.z * k : e.r + r;
      } else {
        const cx = Math.max(-e.hx, Math.min(e.hx, L.x)), cz = Math.max(-e.hz, Math.min(e.hz, L.z)), ox = L.x - cx, oz = L.z - cz, d = Math.hypot(ox, oz);
        if (d >= r) continue;
        if (d > 1e-6) { px = ox / d * (r - d); pz = oz / d * (r - d); }
        else {                                                                   // inside: out by the nearest face
          const fx = e.hx - Math.abs(L.x), fz = e.hz - Math.abs(L.z);
          if (fx < fz) px = Math.sign(L.x || 1) * (fx + r); else pz = Math.sign(L.z || 1) * (fz + r);
        }
      }
      const W = m.localToWorld(new THREE.Vector3(L.x + px, L.y, L.z + pz));
      p.pos.x = W.x; p.pos.z = W.z;
    }
  }
  groundAt(pos, step) {                                // the highest top under the feet that's no more than a step up
    let best = -Infinity;
    for (const m of this.blocks()) {
      const e = this.extent(m); if (!e) continue;
      const top = e.cy + e.hy; if (top > pos.y + step) continue;
      const L = m.worldToLocal(pos.clone());
      const inside = e.r !== undefined ? Math.hypot(L.x, L.z) <= e.r : Math.abs(L.x) <= e.hx && Math.abs(L.z) <= e.hz;
      if (inside && top > best) best = top;
    }
    return best > -Infinity ? best : pos.y;
  }
  isIn(t) {
    const p = this.player.pos, x = p.x, y = -p.z, z = p.y + 0.5;
    return x >= t.min[0] && x <= t.max[0] && y >= t.min[1] && y <= t.max[1] && z >= t.min[2] && z <= t.max[2];
  }

  // ---- what the story's parts call -------------------------------------------------------------------------------
  emit(ev) { if (this.listener) this.listener(ev); }
  setFlag(f) { if (!f) return; this.flags.add(f); this.emit({ type: "flag", id: f }); }
  give(item) { this.items.add(item); this.hud.log(`got: ${this.itemName(item)}`); }
  itemName(id) { return ((this.story.items || {})[id] || {}).name || String(id).replace(/_/g, " "); }
  nameOf(t) { const p = t.userData.piece || {}, d = p.d || {}; return d.name || (p.tags || []).find(x => x.startsWith("tag:"))?.slice(4).replace(/_/g, " ") || t.userData.id.replace(/_/g, " "); }
  lineText(id) { const l = (this.story.lines || {})[id]; return l ? l.en || l.ja : null; }
  setVisible(id, on, restoring) {
    const o = this.byId[id]; if (!o) { this.hud.log(`no ${id} in this level`); return; }
    o.visible = on;
    if (!restoring) this.kept[this.level].vis[id] = on;
    const solid = this.stage.solid, i = solid.indexOf(o), hollow = ((o.userData.piece || {}).tags || []).includes("hollow");
    if (o.isMesh && on && i < 0 && !hollow) solid.push(o);
    if (!on && i >= 0) solid.splice(i, 1);
  }
  doorOf(id) { return this.doors[id] || { open: false, locked: false }; }
  canUnlock(d) { return !d.by ? false : d.by.startsWith("flag:") ? this.flags.has(d.by.slice(5)) : this.items.has(d.by); }
  door(id, set) {
    const d = this.doors[id]; if (!d) { this.hud.log(`no door ${id}`); return; }
    if (set === "lock") { d.locked = true; return; }
    if (set === "unlock") { d.locked = false; return; }
    const open = set === "open";
    if (open === d.open) return;
    d.open = open; d.from = d.deg; d.t = 0; d.secs = set === "slam" ? SLAM_SECS : DOOR_SECS;
    if (set === "slam") this.hud.log("♪ slam");
    d.to = open ? this.awayDeg(d.mesh) : 0;
  }
  awayDeg(m) {                                          // open away from the player: try both ways, keep the farther
    const far = deg => { this.stage.swingDoor(m, deg); m.updateMatrixWorld(); return m.getWorldPosition(new THREE.Vector3()).distanceTo(this.player.pos); };
    const a = far(90), b = far(-90); this.stage.swingDoor(m, 0);
    return a >= b ? 90 : -90;
  }
  light(id, room, set) {
    const ls = id ? [this.byId[id]].filter(Boolean) : this.stage.lights.filter(l => l.userData.room === room);
    for (const l of ls) {
      if (set === "toggle") l.userData.on = !l.userData.on;
      else if (set === "on" || set === "off") l.userData.on = set === "on";
      else if (set === "flicker") { l.userData.on = true; l.userData.flicker = Math.max(0.6, l.userData.flicker || 0); }
      else if (set === "dim") { l.userData.on = true; l.userData.dim = 0.35; }
    }
  }
  wait(secs) { return new Promise(res => this.waits.push({ at: this.clock + secs, res })); }
  fade(to, secs) { return this.opts.fade ? this.opts.fade(to, secs) : Promise.resolve(); }
  lookAt(id, secs) {
    const o = this.byId[id]; if (!o) return;
    const at = o.getWorldPosition(new THREE.Vector3()), eye = this.eyePos(), d = at.sub(eye);
    this.lookTween = { y0: this.player.yaw, p0: this.player.pitch, t: 0, secs: Math.max(0.2, secs * 0.6),
      y1: this.player.yaw + (((Math.atan2(-d.z, d.x) * 180 / Math.PI - this.player.yaw) % 360 + 540) % 360 - 180),
      p1: Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180 / Math.PI };
  }
  lookedAt(id, within) { return this.look.id === id && this.look.dist <= within ? this.look.t : 0; }
  async panel(spec) { return this.modal(() => this.hud.panel(spec)); }
  async choose(spec) { return this.modal(() => this.hud.choose(spec)); }      // a multiple choice: the index picked
  async modal(show) {                                  // a HUD panel with the pointer freed, then back to looking
    this.busy = true; this.keys = {};
    if (document.pointerLockElement === this.box) document.exitPointerLock();
    this.hud.locked(false);
    const v = await show();
    this.busy = false; this.hud.locked(false);
    try { await this.box.requestPointerLock(); } catch (e) { }   // back to looking (a click does it if the browser says no)
    return v;
  }
  finish() { if (this.end) this.end({ to: this.next }); }
  // a die thrown from the hand along the look; when it settles its top face is heard (`rolled`) and kept
  roll(t, s) {
    if (!this.physics) return;
    const dir = new THREE.Vector3(); this.stage.camera.getWorldDirection(dir);
    const from = this.eyePos().addScaledVector(dir, 0.45).add(new THREE.Vector3(0, -0.25, 0));
    this.physics.throw(t, from, dir, s, face => {
      this.kept[this.level].bodies[t.userData.id] = { p: t.position.clone(), q: t.quaternion.clone() };
      this.hud.log(`rolled ${face}`);
      this.emit({ type: "rolled", id: t.userData.id, face });
    });
  }
  // a triggered scene (the `scene` action): blended in from where the player is; afterwards they carry on from its last
  // view (placeFromCamera)
  async scene(id) {
    if (!this.opts.playScene) { this.hud.log(`scene ${id}: not from here`); return; }
    this.pause(); this.moving = null;
    const r = await this.opts.playScene(id);
    if (this.stopped || !r) return;
    this.placeFromCamera(r.level, r.cam);
    this.go();
  }
  // sitting: the player eases onto the seat facing out (the way they came), the eye at sitting height; standing eases
  // back to where they stood
  sit(t, s) {
    const p = this.player, at = t.getWorldPosition(new THREE.Vector3());
    p.seat = t; p.stood = { pos: p.pos.clone(), eye: p.eye };
    return this.tween({ pos: new THREE.Vector3(at.x, p.pos.y, at.z), eye: s.eye, yaw: p.yaw + 180, pitch: 0, secs: s.secs });
  }
  stand(s) {
    const p = this.player, st = p.stood; p.seat = null;
    if (st) return this.tween({ pos: st.pos, eye: st.eye, yaw: p.yaw, pitch: p.pitch, secs: s.secs });
  }
  // hiding: the player eases inside (its `inside` spot, else its middle facing its front), the eye at hiding height,
  // the look kept to a cone out of its door, the walls see-through (stage.seeThrough); getting out eases back
  async hide(t, s) {
    const p = this.player, id = t.userData.id, piece = t.userData.piece || {}, spot = this.plan.things[(piece.d || {}).inside];
    const at = spot ? s2t(spot.pos[0], spot.pos[1], 0) : t.getWorldPosition(new THREE.Vector3());
    const yaw = spot ? spot.yaw || 0 : piece.yaw || 0;
    p.stood = { pos: p.pos.clone(), eye: p.eye };
    p.hiding = id; p.limit = { yaw, dy: s.look[0], dp: s.look[1] };
    this.stage.seeThrough(id, this.stage.seeThroughOf(id));
    await this.tween({ pos: new THREE.Vector3(at.x, p.pos.y, at.z), eye: s.eye, yaw, pitch: 0, secs: s.secs });
    this.emit({ type: "hidden", id });
  }
  async unhide(s) {
    const p = this.player, st = p.stood;
    this.leaveHiding();
    if (st) await this.tween({ pos: st.pos, eye: st.eye, yaw: p.yaw, pitch: p.pitch, secs: s.secs });
  }
  leaveHiding() {
    const p = this.player, id = p.hiding; if (!id) return;
    this.stage.seeThrough(id, 0); p.hiding = null; p.limit = null;
    this.emit({ type: "unhidden", id });
  }
  tween(to) {
    const p = this.player;
    return new Promise(done => { this.moving = { from: { pos: p.pos.clone(), eye: p.eye, yaw: p.yaw, pitch: p.pitch }, to, t: 0, done }; });
  }

  // ---- the cast in play: behaviours (play/behaviours.js) ------------------------------------------------------------
  // a route: a level's named one, or a list of spots in place -> {level, mode, points: [{pos, yaw, wait, pose}]}
  route(ref) {
    let r = null, level = null;
    if (Array.isArray(ref)) r = { points: ref };
    else for (const [lid, lv] of Object.entries(this.story.levels || {})) if ((lv.routes || {})[ref]) { r = lv.routes[ref]; level = lid; }
    if (!r) { this.hud.log(`no route ${ref}`); return null; }
    const points = [];
    for (const p of r.points || []) {
      const q = typeof p === "string" ? { at: p } : p, t = this.plan.things[q.at];
      if (!t) { this.hud.log(`route ${ref}: no spot ${q.at}`); continue; }
      level = level || t.level;
      points.push({ pos: s2t(t.pos[0], t.pos[1], t.pos[2] || 0), yaw: t.yaw || 0, wait: +(q.wait || 0), pose: q.pose || null, check: q.check || null });
    }
    return points.length ? { level, mode: r.mode || "loop", points } : null;
  }
  behave(cid, spec) {
    const as = spec.as || "idle", npc = this.npcs[cid];
    if (as === "off") { delete this.npcs[cid]; if (this.stage.cast[cid]) this.stage.cast[cid].group.visible = false; return; }
    const b = behaviourOf(as); if (!b) { this.hud.log(`behaviour not in Play yet: ${as}`); return; }
    const n = this.npcs[cid] = { cid, as, s: settingsOf(b, spec), st: {}, pos: npc && npc.pos, yaw: npc ? npc.yaw : 0, level: npc && npc.level, pose: "idle", walking: false };
    b.start(n, this, n.s);
  }
  drawNpcs(dt) {
    const lib = this.stage.lib, X = new THREE.Vector3(1, 0, 0);
    for (const n of Object.values(this.npcs)) {
      const b = behaviourOf(n.as); if (b && b.update) b.update(n, this, dt, n.s);
      const f = this.stage.cast[n.cid]; if (!f) continue;
      f.group.visible = !!n.pos && n.level === this.level;
      if (!f.group.visible) continue;
      f.group.position.copy(n.pos); f.group.rotation.y = (n.yaw + 90) * Math.PI / 180;
      let p = M.clonePose(lib.poses[n.pose] || lib.poses.idle);
      if (n.walking) p = M.walkOverlay(lib, p, this.clock);
      p.q.spine_02.multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.sin(this.clock * 2.2) * 0.012));   // breathing
      f.update(M.fk(lib, p, +((this.story.cast || {})[n.cid] || {}).height || 1.7).pos);
    }
  }

  // ---- being seen (GAMEPLAY_PLAN §3): a cast member who `sees` fills the suspicion meter while the player is in her
  // cone, in reach (shorter crouched) and in her line of sight, and not hidden or in a safe zone; full, it's `caught`
  sightOf(n) { return n.s.sees ? Object.assign({}, SIGHT, n.s.sees === true ? {} : n.s.sees) : null; }
  sees(n) {
    const c = this.sightOf(n), p = this.player;
    if (!c || !n.pos || n.level !== this.level || p.hiding) return false;
    if (this.triggers.some(t => t.safe && this.isIn(t))) return false;
    const h = +((this.story.cast || {})[n.cid] || {}).height || 1.7;
    const eye = n.pos.clone().setY(n.pos.y + h * 0.93), at = p.pos.clone().setY(p.pos.y + p.eye * 0.9), d = at.clone().sub(eye), dist = d.length();
    if (dist > c.range * (p.crouched ? c.crouched : 1)) return false;
    const a = n.yaw * Math.PI / 180, fwd = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), flat = d.clone().setY(0).normalize();
    if (Math.acos(Math.max(-1, Math.min(1, fwd.dot(flat)))) * 180 / Math.PI > c.angle / 2) return false;
    this.ray.set(eye, d.clone().normalize()); this.ray.far = dist;
    const hit = this.ray.intersectObjects(this.blocks(), false)[0];
    return !(hit && hit.distance < dist - 0.3);
  }
  watch(dt) {
    if (this.calm > 0) { this.calm -= dt; this.suspicion = Math.max(0, this.suspicion - dt / SIGHT.drain); this.hud.seen(this.suspicion); return; }
    const by = Object.values(this.npcs).find(n => this.sees(n));
    if (by) { this.suspicion += dt / this.sightOf(by).meter; if (this.suspicion >= 1) return this.caught(by.cid, null); }
    else this.suspicion = Math.max(0, this.suspicion - dt / SIGHT.drain);
    this.hud.seen(this.suspicion);
  }
  caught(by, at) {                                   // at: the hiding place she found the player in (a route point's check)
    const n = this.npcs[by], c = (n && this.sightOf(n)) || SIGHT;
    this.suspicion = 0; this.calm = c.calm; this.hud.seen(0);
    this.lastCaught = { by, at, clock: this.clock };
    this.hud.log(`caught by ${by}${at ? " in " + at : ""}`);
    this.emit({ type: "caught", by, at });
  }

  // ---- the player's use and the cursor ---------------------------------------------------------------------------
  eyePos() { return this.player.pos.clone().add(new THREE.Vector3(0, this.player.eye, 0)); }
  aim() {
    return this.ray.intersectObjects(this.stage.world.children.filter(o => o.isMesh && o.visible), false)[0] || null;
  }
  async use() {
    const seat = this.player.seat;
    if (seat && (!this.target || this.target === seat)) { this.hud.press(); this.stand(this.set("sit")); return; }   // E stands you up
    if (this.player.hiding && !this.target) { this.hud.press(); this.unhide(this.set("hide")); return; }             // E gets you out
    const t = this.target; if (!t) return;
    const ip = interactableOf(t);
    this.hud.press();
    if (ip) await ip.use(t, this, this.set(ip.name));     // the use is done (seated, the door open, the note read) before the story hears it
    this.emit({ type: "use", id: t.userData.id });
  }
  updateCursor(dt) {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.stage.camera);
    this.ray.far = LOOK_RANGE;
    const hit = this.aim(), o = hit && hit.object, id = o && o.userData.id;
    if (id && id === this.look.id) this.look.t += dt; else this.look = { id, t: 0, dist: hit ? hit.distance : Infinity };
    if (hit) this.look.dist = hit.distance;
    const ip = o && hit.distance <= USE_RANGE ? interactableOf(o) : null;
    this.target = ip ? o : null;
    if (!ip) { this.hud.setCursor("none", this.player.seat ? this.set("sit").stand : ""); return; }
    const pr = ip.prompt(o, this, this.set(ip.name));
    this.hud.setCursor(pr.cursor, pr.label, pr.label ? this.anchorAt(o) : null, this.titleOf(o));
  }
  // where a thing's prompt floats, in the HUD's pixels: a door's handle (on your side of the leaf, so it's where your
  // hand goes; the whole door still takes E), anything else its middle. Kept to the safe area (the screen's margin,
  // above the footer, where lines and choices live); `flip` puts the words left of the mark near the right edge, and
  // `bare` drops the mark when it would sit on the reticle or the point had to be pulled in. Null behind the eye
  anchorAt(o) {
    const p = this.doors[o.userData.id] ? this.handleOf(o) : this.middleOf(o), v = p.project(this.stage.camera);
    if (v.z > 1) return null;
    const W = this.hud.root.clientWidth, H = this.hud.root.clientHeight, m = 56, px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
    if (Math.hypot(px - W / 2, py - H / 2) < 24) return { x: W / 2 + 16, y: H / 2, bare: true };   // on the reticle: the words beside it
    const x = Math.min(W - m, Math.max(m, px)), y = Math.min(H * 0.7, Math.max(m, py));
    return { x, y, flip: x > W * 0.7, bare: x !== px || y !== py };
  }
  handleOf(o) {                                       // the leaf's edge away from its hinges, at handle height
    const g = o.geometry.parameters || {}, sw = o.userData.swing || {}, w = sw.w || g.width || 0.9, h = g.height || 2.05, d = g.depth || 0.05;
    const side = sw.pivot ? -Math.sign(sw.pivot.x) || 1 : 1, me = o.worldToLocal(this.eyePos());
    return o.localToWorld(new THREE.Vector3(side * (w / 2 - (sw.handleIn ?? 0.065)), -h / 2 + (sw.handleZ ?? 0.95), (me.z < 0 ? -1 : 1) * (d / 2 + 0.02)));
  }
  middleOf(o) {                                       // its bounds' middle, kept in its own space so it moves with it
    if (!o.userData.mid) o.userData.mid = o.worldToLocal(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()));
    return o.localToWorld(o.userData.mid.clone());
  }
  titleOf(t) {                                        // the name under the verb: an item, a note's title, a named thing
    const d = (t.userData.piece || {}).d || {};
    return d.item ? this.itemName(d.item) : d.note ? ((this.story.notes || {})[d.note] || {}).title || null : d.name || null;
  }

  // ---- running the story -----------------------------------------------------------------------------------------
  // a stitch: its beats fire from what the player does; it ends on `done`, its timer, or an interrupt
  runStitch(st, n, interrupts = []) {
    return new Promise(resolve => {
      const beats = (st.beats || []).map(b => ({ b, fired: false }));
      this.next = n.next;
      this.end = r => { this.listener = null; this.end = null; this.timerLeft = null; this.hud.timer(null); resolve(r); };
      this.timerLeft = st.timer ? +st.timer.secs : null;
      this.timerFail = st.timer ? st.timer.fail : null;
      this.listener = ev => {
        for (const it of interrupts) if (matches(it.when, ev, this)) return this.end({ to: it.to, interrupt: true });
        for (const x of beats) {
          if (x.fired || !flagsHold(x.b.if, this.flags) || !matches(x.b.when, ev, this)) continue;
          x.fired = true;
          runAll(x.b.do, this).then(() => { this.ended[x.b.id] = this.clock; });
        }
      };
      this.go();
      this.emit({ type: "start" });
    });
  }
  // a choice by act: the first option whose `when` happens
  runChoice(n) {
    return new Promise(resolve => {
      if (n.prompt) this.hud.log(n.prompt);
      this.end = null;
      this.listener = ev => { const o = (n.options || []).find(o => o.when && matches(o.when, ev, this)); if (o) { this.listener = null; resolve(o); } };
      this.go();
    });
  }
  pause() { this.active = false; this.keys = {}; this.hud.root.style.display = "none"; }   // the pointer stays locked: a scene looks round with it
  go() {
    if (this.stopped) return;
    this.hud.root.style.display = "";
    if (this.active) return;
    this.active = true; this.last = performance.now();
    const loop = now => { if (!this.active) return; this.tick(Math.min(0.05, (now - this.last) / 1000)); this.last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  tick(dt) {
    this.clock += dt;
    const p = this.player;
    if (this.physics) this.physics.step(dt);
    if (this.moving) {
      const M = this.moving; M.t += dt; const u = Math.min(1, M.t / Math.max(0.05, M.to.secs)), k = u * u * (3 - 2 * u);
      p.pos.lerpVectors(M.from.pos, M.to.pos, k); p.eye = M.from.eye + (M.to.eye - M.from.eye) * k;
      p.yaw = M.from.yaw + (M.to.yaw - M.from.yaw) * k; p.pitch = M.from.pitch + (M.to.pitch - M.from.pitch) * k;
      if (u >= 1) { this.moving = null; M.done(); }
    }
    if (this.lookTween) {
      const L = this.lookTween; L.t += dt; const u = Math.min(1, L.t / L.secs), k = u * u * (3 - 2 * u);
      p.yaw = L.y0 + (L.y1 - L.y0) * k; p.pitch = L.p0 + (L.p1 - L.p0) * k; if (u >= 1) this.lookTween = null;
    }
    if (!this.busy && !p.seat && !p.hiding && !this.moving) for (const a of ABILITIES) this.ability(a, "update", dt);
    this.hud.setStance(p.hiding ? "hidden" : p.crouched ? "crouched" : "");
    for (const [id, d] of Object.entries(this.doors)) if (d.t < 1) {
      d.t = Math.min(1, d.t + dt / d.secs); const k = 1 - (1 - d.t) * (1 - d.t);
      d.deg = d.from + (d.to - d.from) * k; this.stage.swingDoor(d.mesh, d.deg);
      if (d.t >= 1 && !d.open) this.emit({ type: "closed", id });
    }
    for (const t of this.triggers) {
      const now = this.isIn(t), was = this.inside.has(t.id);
      if (now && !was) { this.inside.add(t.id); this.emit({ type: "enter", id: t.id }); }
      if (!now && was) { this.inside.delete(t.id); this.emit({ type: "exit", id: t.id }); }
    }
    if (this.timerLeft !== null && this.timerLeft !== undefined && this.end) {
      this.timerLeft -= dt; this.hud.timer(this.timerLeft);
      if (this.timerLeft <= 0) { const to = this.timerFail; this.end({ to, timeout: true }); }
    }
    for (const w of this.waits.filter(w => this.clock >= w.at)) { this.waits.splice(this.waits.indexOf(w), 1); w.res(); }
    const c = this.stage.camera, eye = this.eyePos();
    c.position.copy(eye); c.rotation.order = "YXZ";
    c.rotation.set(p.pitch * Math.PI / 180, (p.yaw - 90) * Math.PI / 180, 0);
    c.fov = vfov(+((this.story.game || {}).fov || FOV_H), c.aspect || 16 / 9); c.updateProjectionMatrix();
    const T = this.clock;
    for (const l of this.stage.lights) {
      const u = l.userData; let k = u.on ? (u.dim || 1) : 0;
      if (u.flicker) k *= 1 - u.flicker * 0.5 * Math.max(0, Math.sin(T * 13.7) * Math.sin(T * 7.3));
      l.intensity = (u.base || 1) * k;
    }
    this.drawNpcs(dt);
    this.watch(dt);
    if (!this.busy) this.updateCursor(dt);
    this.emit({ type: "tick" });
    this.hud.tick();
    this.stage.render();
  }
}
export const PARTS = () => Object.fromEntries(["condition", "action", "interactable", "ability", "behaviour"].map(k => [k, names(k)]));
