// Play mode (docs/GAMEPLAY_PLAN.md §8 step 1): walk the built level from the player's eye, use what's there, and run a
// stitch's beats from what the player does. The runtime owns the player (feet, look, eye height), collision with the
// level's solid blocks, the trigger volumes, doors, and the cursor; everything the story names is a registered part
// (play/parts.js): conditions, actions, interactables, abilities.
import * as THREE from "three";
import { part, names, settingsOf, KINDS } from "./parts.js";
import { matches } from "./conditions.js";
import { runAll } from "./actions.js";
import { playShelf, shelfName } from "../sfx.js";
import { interactableOf } from "./interactables.js";
import "./abilities.js";
import { behaviourOf } from "./behaviours.js";
import * as M from "../motion.js";
import { Hud, besideAt, setName, playerName } from "./hud.js";
import { Todo } from "./todo.js";
import { pauseMenu, autosave } from "./menu.js";
import { Physics, dieMaterials } from "./physics.js";
import { loadRules, boardCtx, Table } from "./boardgames.js";
import { EYES, FOV_H, vfov, s2t } from "../stage.js";

const ABILITIES = ["look", "walk", "crouch"];     // in the order they run
const THEME = "glass";                           // the HUD theme when a game names none (game.ui_theme)
const LIT = 2.2;                                   // a lamp that starts off: its strength when it's switched on (stage.js's bulb)
const USE_RANGE = 2.2, LOOK_RANGE = 30, DOOR_SECS = 0.6, SLAM_SECS = 0.15;
// a cast member who `sees` (behave): her cone (degrees, full width), its reach (m), how much of it a crouched player
// is seen at, the seconds the suspicion meter takes to fill and to drain, and how long she's calm after a catch
export const SIGHT = { angle: 90, range: 9, crouched: 0.55, meter: 1.2, drain: 1.5, calm: 3 };
const UP = new THREE.Vector3(0, 1, 0);
const flagsHold = (ifs, flags) => (ifs || []).every(f => f.startsWith("!") ? !flags.has(f.slice(1)) : flags.has(f));

export class PlayRuntime {
  // opts: run (the Watch's run: flags, karma, counters), settings ({crouch: {mode: "hold"}}), theme, fade(to, secs),
  //       onBeat(stitch, beat, secs) (a beat fired: the desk's debug panel), onFlag(flag) (a flag set: the desk's
  //       achievements), files (the desk's loaded motions, by file)
  constructor(stage, story, plan, box, opts = {}) {
    Object.assign(this, { stage, story, plan, box, opts });
    this.run = opts.run || null;
    this.flags = (this.run && this.run.flags) || new Set();
    this.items = new Set();
    this.settings = opts.settings || {};
    this.hud = new Hud(box, opts.theme || (story.game || {}).ui_theme || THEME);
    this.todo = new Todo(this);                        // the to-do list, kept with the run (todo.js)
    this.player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, eye: EYES.stand, crouched: false };
    this.keys = {}; this.ended = {}; this.clock = 0; this.inside = new Set(); this.doors = {}; this.waits = [];
    this.npcs = {};                                 // cast id -> what they're doing in play (behave), kept across stitches
    this.files = opts.files || {};
    this.lives = (this.run && this.run.lives) || opts.lives || null;   // the little things' states (life.js States), kept with the run
    this.livesSeen = this.lives ? this.lives.changes.length : 0; this.clock0 = 0;
    this.suspicion = 0; this.calm = 0; this.lastCaught = null;
    this.look = { id: null, t: 0, dist: Infinity }; this.target = null; this.busy = false; this.active = false; this.level = null;
    this.carried = null; this.holding = null;          // the thing in the hands ({m, id, level, yaw, r}); E being held ({t, secs, on | put})
    this.playing = null; this.anims = []; this.boardTitles = {};   // a board game going on (its id); tweens on the game's clock
    fetch(`/api/boardgames/${encodeURIComponent(opts.game || "_")}`).then(r => (r.ok ? r.json() : {})).then(j => { for (const g of j.games || []) this.boardTitles[g.id] = g.title; }).catch(() => { });
    this.listener = null; this.ray = new THREE.Raycaster();
    this.on = {
      click: () => { if (this.active && !this.busy) box.requestPointerLock(); },
      lock: () => {                                 // the lock lost in play (Esc) pauses
        const on = document.pointerLockElement === box;
        if (this.wasLocked && !on && this.active && !this.busy && performance.now() - (this.resumed || 0) > 500) this.pause();   // (not the lock a resume just asked for, lost again)
        this.wasLocked = on; this.hud.locked(on);
      },
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
    for (const a of this.anims) a.done(); this.anims = [];
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
    if (down && e.code === "Escape") {               // Esc without the lock (the desk) pauses too, but not an Esc meant
      e.preventDefault(); if (performance.now() - this.since > 400) this.pause(); return;   // for the scene that just ended
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyC", "Space"].includes(e.code)) e.preventDefault();
    if (this.playing) return;                          // at a board game: its choices take the keys
    this.keys[e.code] = down;
    if (e.code === "KeyE" && !e.repeat) { if (down) this.pressE(); else this.releaseE(); }
    if (!this.player.hiding) for (const a of ABILITIES) this.ability(a, "key", e, down);
  }

  // ---- the level ---------------------------------------------------------------------------------------------------
  // the stage's world is rebuilt by every scene the Watch plays, so what play changed (doors, things shown or taken)
  // is kept per level and put back
  enterLevel(level) {
    if (this.level === level && this.world === this.stage.world.children[0]) return;
    const first = !(this.kept && this.kept[level]);   // this run's first time here: the level as the story builds it, never as an earlier playtest left it
    if (first || this.stage.level !== level || !this.stage.world.children.length) this.stage.setWorld(this.plan, this.story, level);
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
    const movers = this.stage.world.children.filter(o => o.isMesh && (o.userData.use === "roll" || o.userData.use === "carry"));   // dice, things you carry
    for (const m of movers) {
      if (m.userData.use === "roll") m.material = dieMaterials();
      const k = kept.bodies[m.userData.id]; if (k) { m.position.copy(k.p); m.quaternion.copy(k.q); }
    }
    this.physics = movers.length ? new Physics(this.stage, movers, m => m.userData.use === "carry" ? this.physicsOf(m) : { name: "rigid" }) : null;
    // what's in the hands goes on with the player: picked up again in the rebuilt world (a scene played), or, to another
    // level, left at their feet in its own
    const was = this.carried; this.carried = null; this.holding = null; this.hud.hold(null);
    if (was && was.level === level && this.byId[was.id]) { this.pickUp(this.byId[was.id], was.yaw); if (this.carried) this.carried.snap = true; }
    else if (was) {
      const p = this.player, a = p.yaw * Math.PI / 180, g = was.m.geometry.parameters, h = g.height ?? (g.radius || 0.15) * 2;
      this.kept[was.level].bodies[was.id] = { p: new THREE.Vector3(p.pos.x + Math.cos(a) * 0.35, p.pos.y + h / 2, p.pos.z - Math.sin(a) * 0.35),
                                              q: new THREE.Quaternion().setFromAxisAngle(UP, (p.yaw - 90) * Math.PI / 180 + was.yaw) };
    }
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
  blocks() { return this.stage.solid.filter(m => m.visible && m.geometry && m.geometry.parameters && m.userData.use !== "carry"); }   // a thing you carry never stops you
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
  isIn(t) { const p = this.player.pos; return this.pointIn(t, p.x, -p.z, p.y + 0.5); }
  pointIn(t, x, y, z) { return x >= t.min[0] && x <= t.max[0] && y >= t.min[1] && y <= t.max[1] && z >= t.min[2] && z <= t.max[2]; }   // story coordinates

  // ---- what the story's parts call -------------------------------------------------------------------------------
  emit(ev) { if (this.todo) this.todo.event(ev); if (this.listener) this.listener(ev); }
  setFlag(f) { if (!f) return; this.flags.add(f); this.emit({ type: "flag", id: f }); if (this.opts.onFlag) this.opts.onFlag(f); }
  give(item) { this.items.add(item); this.hud.log(`got: ${this.itemName(item)}`); }
  itemName(id) { return ((this.story.items || {})[id] || {}).name || String(id).replace(/_/g, " "); }
  nameOf(t) { const p = t.userData.piece || {}, d = p.d || {}; return d.name || (p.tags || []).find(x => x.startsWith("tag:"))?.slice(4).replace(/_/g, " ") || t.userData.id.replace(/_/g, " "); }
  lineText(id) { const l = (this.story.lines || {})[id]; return l ? l.en || l.ja : null; }
  // a story sound: off the Studio's shelf when its file is sfx/<name>, placed at `at` (a thing or a cast member) when
  // it's given, else where the player is; a sound of the game's own is only logged (it plays in Unreal)
  sound(id, at) {
    const s = (this.story.sounds || {})[id], n = s && shelfName(s.file);
    this.hud.log(`♪ ${id}${at ? " at " + at : ""}${n ? "" : " (the game's own file: in Unreal)"}`);
    if (n) this.shelfSound(n, at);
  }
  shelfSound(name, at) {
    if (!this.active) return;
    const o = at && (this.byId[at] || (this.stage.cast || {})[at]), pos = o && o.getWorldPosition ? o.getWorldPosition(new THREE.Vector3()) : null;
    playShelf(name, pos ? { pos, camera: this.stage.camera } : {});
  }
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
    if (set === "slam") { this.hud.log("♪ slam"); this.shelfSound("door_slam_01", id); }
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
  anim(secs, fn) { return new Promise(done => this.anims.push({ t: 0, secs: Math.max(0.01, secs), fn, done })); }   // fn(0..1) each frame, on the game's clock
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
  async choose(spec) {                                 // a multiple choice: the index picked. Beside `who` (a cast member), at `on` (a thing), else under the reticle
    const f = spec.who && this.stage.cast[spec.who], t = spec.on && this.byId[spec.on], W = () => this.hud.root.clientWidth, H = () => this.hud.root.clientHeight;
    const anchor = f ? () => besideAt(this.stage.camera, f, W(), H()) : t ? () => this.anchorAt(t) : null;
    return this.modal(() => this.hud.choose(Object.assign({}, spec, { anchor, who: f ? ((this.story.cast || {})[spec.who] || {}).name || spec.who : spec.who })));
  }
  async askName(question, def) {                      // the player types their name (a `name` action): kept with the run, {name} shows it
    const v = await this.modal(() => this.hud.panel({ title: question || "What's your name?", name: def || (this.story.game || {}).player_name || playerName() }));
    const name = setName(v);
    if (this.run) this.run.name = name;
    return name;
  }
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
  // carrying (use: carry): a thing held E picks up rides in the hands, springing after them as its physics kind says
  // (physics.js: a plushie lags, squashes and flops), until E is held again to put it down; it falls from there, and
  // when it has settled it's kept where it lies and heard: {type: "dropped", id, in: [the rooms and triggers it's in]}
  physicsOf(m) { const d = (m.userData.piece || {}).d || {}; return { name: d.physics || "rigid", settings: d.jiggle !== undefined ? { jiggle: +d.jiggle } : null }; }
  pickUp(m, yaw) {
    if (!this.physics || this.carried) return;
    if (!this.physics.pick(m)) return;
    const g = m.geometry.parameters;
    this.carried = { m, id: m.userData.id, level: this.level, r: Math.max(g.width || 0, g.depth || 0, (g.radius || g.radiusTop || 0) * 2) / 2,
                     yaw: yaw ?? new THREE.Euler().setFromQuaternion(m.quaternion, "YXZ").y - (this.player.yaw - 90) * Math.PI / 180 };   // its turn to the player, kept
    this.emit({ type: "carry", id: m.userData.id });
  }
  putDown() {
    const c = this.carried; if (!c) return;
    this.carried = null;
    this.physics.drop(c.m, () => {
      const at = c.m.position;
      this.kept[this.level].bodies[c.id] = { p: at.clone(), q: c.m.quaternion.clone() };
      this.emit({ type: "dropped", id: c.id, in: this.triggers.filter(t => this.pointIn(t, at.x, -at.z, at.y)).map(t => t.id) });
    });
  }
  // in the hands: ahead of the eye, a little right and down (its kind's `hand`), bobbing with the steps, pulled in short
  // of a wall; turned with the player
  carryTick(dt) {
    const c = this.carried, s = this.physics && this.physics.settingsOf(c.m); if (!s) return;
    const cam = this.stage.camera, p = this.player, walk = Math.min(1, (p.speed || 0) / 1.2), hand = new THREE.Vector3(...s.hand);
    this.stepPhase = ((this.stepPhase || 0) + dt * walk * Math.PI * 2 * 1.8) % (Math.PI * 2);      // about two steps a second at a walk
    hand.y += Math.sin(this.stepPhase) * 0.012 * walk;
    const eye = cam.position.clone(), want = cam.localToWorld(hand), d = want.clone().sub(eye), len = d.length();
    this.ray.set(eye, d.divideScalar(len)); this.ray.far = len + c.r;
    const hit = this.ray.intersectObjects(this.blocks(), false)[0];
    if (hit) want.copy(eye).addScaledVector(d, Math.max(0.12, hit.distance - c.r));
    const q = new THREE.Quaternion().setFromAxisAngle(UP, (p.yaw - 90) * Math.PI / 180 + c.yaw);
    if (c.snap) { const st = this.physics.moverOf(c.m).st; st.pos.copy(want); st.vel.set(0, 0, 0); st.quat.copy(q); c.snap = false; }
    c.at = want; this.physics.carry(c.m, want, q, dt);
  }
  // E: a use at once, or held for a thing whose interactable has `hold` (seconds: picking it up), the reticle's ring
  // filling. With a thing in the hands, held puts it down, and a tap uses what's under the reticle when it's let go
  pressE() {
    const t = this.target, ip = t && interactableOf(t, this), s = ip && this.set(ip.name);
    if (this.carried) this.holding = { t: 0, secs: this.set("carry").hold, put: true };
    else if (s && s.hold) this.holding = { t: 0, secs: s.hold, on: t };
    else this.use();
  }
  releaseE() {
    const h = this.holding; if (!h) return;
    this.holding = null; this.hud.hold(null);
    if (h.put) this.use();                              // a tap: the door, the switch (or standing up)
  }
  holdTick(dt) {
    const h = this.holding;
    if (!this.keys.KeyE || this.busy || (h.on && this.target !== h.on)) { this.holding = null; this.hud.hold(null); return; }   // let go, or looked away
    h.t += dt; this.hud.hold(h.t / h.secs);
    if (h.t < h.secs) return;
    this.holding = null; this.hud.hold(null); this.hud.press();
    if (h.put) this.putDown(); else this.pickUp(h.on);
  }
  // a board game (use: game): the player sits down at the table (seatAt) and its rules (Content/Studio/BoardGames/,
  // or the game's own BoardGames/) play it out through ctx (play/boardgames.js); then they stand up again, and the
  // story hears {type: "played", id, game, result}. `vs` names who they play (the dealer when no one)
  async boardGame(t, s) {
    if (this.playing) return;
    const d = (t.userData.piece || {}).d || {}, id = t.userData.id;
    let rules; try { rules = await loadRules(this.opts.game, d.game); } catch (e) { this.hud.log(`no rules for ${d.game}`); return; }
    if (this.carried) this.putDown();                   // set down to play
    this.playing = id; this.keys = {}; this.holding = null; this.hud.hold(null); this.hud.setCursor("none", "");
    const p = this.player, back = { pos: p.pos.clone(), eye: p.eye, yaw: p.yaw, pitch: p.pitch, secs: s.secs }, seat = this.seatAt(t, s);
    await this.tween(seat);
    const them = d.vs ? ((this.story.cast || {})[d.vs] || {}).name || d.vs : s.house, table = new Table(this, t, seat.yaw);
    let result = null;
    try { result = await rules.default(boardCtx(this, table, rules.meta, d.settings, them, id)); }
    catch (e) { console.error(e); this.hud.log(`${d.game}: ${e.message}`); }
    if (!this.stopped) await this.wait(1.0);
    table.clear(); this.hud.board(null);
    if (!this.stopped) await this.tween(back);
    this.playing = null;
    if (result) { this.hud.log(`${rules.meta.title}: ${result}`); this.emit({ type: "played", id, game: d.game, result }); }
  }
  seatAt(t, s) {                                      // at a long side of the table (the player's half), `back` from its edge, facing its middle and looking down at it
    const g = t.geometry.parameters || {}, hw = (g.width || 1) / 2, hd = (g.depth || 1) / 2, L = t.worldToLocal(this.player.pos.clone());
    const side = hw > hd ? new THREE.Vector3(0, 0, Math.sign(L.z) || 1) : new THREE.Vector3(Math.sign(L.x) || 1, 0, 0);
    const at = t.localToWorld(side.clone().multiplyScalar(Math.min(hw, hd) + s.back)), mid = t.getWorldPosition(new THREE.Vector3());
    const dx = mid.x - at.x, dz = mid.z - at.z, top = mid.y + (g.height || 0.75) / 2, feet = new THREE.Vector3(at.x, this.player.pos.y, at.z);
    return { pos: feet, eye: s.eye, yaw: Math.atan2(-dz, dx) * 180 / Math.PI, pitch: Math.atan2(top - feet.y - s.eye, Math.hypot(dx, dz)) * 180 / Math.PI, secs: s.secs };
  }
  // a triggered scene (the `scene` action): blended in from where the player is; afterwards they carry on from its last
  // view (placeFromCamera)
  async scene(id) {
    if (!this.opts.playScene) { this.hud.log(`scene ${id}: not from here`); return; }
    this.hold(); this.moving = null;
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
  // sleeping (a bed, use: sleep): the player lies down on it looking up, and the view goes dark. The story's beat on its
  // use plays a chapter, which wakes them; with none, they wake by themselves. `ready`: its `if` flags hold
  ready(t) { const ifs = (t.userData.piece.d || {}).if; return flagsHold(Array.isArray(ifs) ? ifs : ifs ? [ifs] : [], this.flags); }
  async sleep(t, s) {
    const p = this.player, box = new THREE.Box3().setFromObject(t), at = box.getCenter(new THREE.Vector3());
    const down = new THREE.Raycaster(new THREE.Vector3(at.x, box.max.y + 1, at.z), new THREE.Vector3(0, -1, 0));   // the mattress at its middle, not a headboard
    const top = Math.min((down.intersectObject(t, true)[0] || { point: box.max }).point.y, box.min.y + s.mattress);   // a block stand-in's top is its headboard's
    p.sleeping = { pos: p.pos.clone(), eye: p.eye, yaw: p.yaw };
    await this.tween({ pos: new THREE.Vector3(at.x, p.pos.y, at.z), eye: top - p.pos.y + s.eye, yaw: p.yaw, pitch: s.pitch, secs: s.secs });
    await this.fade(1, s.dark);
    this.wait(s.wake).then(() => { if (p.sleeping && !this.inChapter) this.wake(); });   // nothing played a chapter
  }
  async wake(secs = 1) {                            // the view comes back while they lie there, then they get up where they stood
    const p = this.player, st = p.sleeping; if (!st) return;
    await this.fade(0, secs); await this.wait(0.7);
    await this.tween({ pos: st.pos, eye: st.eye, yaw: st.yaw, pitch: 0, secs: 1.0 }); p.sleeping = null;
  }
  // a chapter (`chapter`): the view goes dark, its title card ("Night 2", `sub` under it: "23:40") is held up, the time of
  // day changes behind it (`time`), the game autosaves (unless `save: false`), and the view comes back (a sleeper wakes)
  async chapter(title, a) {
    this.inChapter = true; this.busy = true; this.keys = {};
    await this.fade(1, 1);
    if (a.time && this.opts.setTime) this.opts.setTime(a.time);
    if (a.save !== false) autosave(this.gameTitle(), title, this.run ? this.run.secs + this.clock : this.clock);
    await this.hud.chapter(title, a.sub, +(a.secs ?? 3));
    this.inChapter = false; this.busy = false;
    if (this.player.sleeping) await this.wake(1.2); else await this.fade(0, 1.2);
  }
  gameTitle() { return (this.story.game || {}).title || "game"; }
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
    const n = this.npcs[cid] = { cid, as, s: settingsOf(b, spec), st: {}, pos: npc && npc.pos, yaw: npc ? npc.yaw : 0, level: npc && npc.level, pose: "idle", walking: false, t0: this.clock };
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
      const h = +((this.story.cast || {})[n.cid] || {}).height || 1.7;
      // her motion (behave `motion`, the story's motions table): while she stands or sits, or while she walks a path or
      // a patrol (in place: the route moves her; at a wait, the point's pose); not made and no stand-in: the pose
      const m = n.s.motion && (this.story.motions || {})[n.s.motion], walks = n.as === "path" || n.as === "patrol" || n.as === "go";
      const mp = m && (n.walking || !walks) ? M.tableMotionPose(lib, m, m.name && this.files[m.name + ".json"], this.clock - (n.t0 || 0), h, walks) : null;
      if (mp) { f.update(mp); continue; }
      let p = M.clonePose(lib.poses[n.pose] || lib.poses.idle);
      if (n.walking) p = M.walkOverlay(lib, p, this.clock);
      p.q.spine_02.multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.sin(this.clock * 2.2) * 0.012));   // breathing
      f.update(M.fk(lib, p, h).pos);
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
    const held = this.carried && this.carried.m;
    return this.ray.intersectObjects(this.stage.world.children.filter(o => o.isMesh && o.visible && o !== held), false)[0] || null;
  }
  async use() {
    if (this.player.sleeping || this.inChapter) return;
    const seat = this.player.seat;
    if (seat && (!this.target || this.target === seat)) { this.hud.press(); this.stand(this.set("sit")); return; }   // E stands you up
    if (this.player.hiding && !this.target) { this.hud.press(); this.unhide(this.set("hide")); return; }             // E gets you out
    const t = this.target; if (!t) return;
    const ip = interactableOf(t, this);
    this.hud.press();
    if (ip && (await ip.use(t, this, this.set(ip.name))) === false) return;   // the use is done (seated, the door open, the note read) before the story hears it; false: nothing happened
    this.emit({ type: "use", id: t.userData.id });
  }
  updateCursor(dt) {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.stage.camera);
    this.ray.far = LOOK_RANGE;
    const hit = this.aim(), o = hit && hit.object, id = o && o.userData.id;
    if (id && id === this.look.id) this.look.t += dt; else this.look = { id, t: 0, dist: hit ? hit.distance : Infinity };
    if (hit) this.look.dist = hit.distance;
    let ip = o && hit.distance <= USE_RANGE ? interactableOf(o, this) : null;
    if (ip && this.carried && this.set(ip.name).hold) ip = null;          // the hands are full: another thing to carry waits
    this.target = ip ? o : null;
    if (!ip && this.carried) { this.hud.setCursor("drop", this.set("carry").drop, null, this.titleOf(this.carried.m), true); return; }
    if (!ip) { this.hud.setCursor("none", this.player.seat ? this.set("sit").stand : ""); return; }
    const pr = ip.prompt(o, this, this.set(ip.name));
    this.hud.setCursor(pr.cursor, pr.label, pr.label ? this.anchorAt(o) : null, this.titleOf(o), pr.hold);
  }
  // where a thing's prompt floats, in the HUD's pixels: a door's handle (on your side of the leaf, so it's where your
  // hand goes; the whole door still takes E), anything else its middle. Kept to the safe area (the screen's margin,
  // above the footer, where lines and choices live); `flip` puts the words left of the mark near the right edge, and
  // `bare` drops the mark when it would sit on the reticle or the point had to be pulled in; `fx, fy` the point itself
  // (the focus pull's centre) and `clear` how near the reticle is to it. Null behind the eye
  anchorAt(o) {
    const p = this.doors[o.userData.id] ? this.handleOf(o) : this.middleOf(o), v = p.project(this.stage.camera);
    if (v.z > 1) return null;
    const W = this.hud.root.clientWidth, H = this.hud.root.clientHeight, m = 56, px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
    const d = Math.hypot(px - W / 2, py - H / 2), fx = Math.min(W, Math.max(0, px)), fy = Math.min(H, Math.max(0, py));
    if (d < 24) return { x: W / 2 + 16, y: H / 2, bare: true, fx, fy, clear: 1 };   // on the reticle: the words beside it
    const x = Math.min(W - m, Math.max(m, px)), y = Math.min(H * 0.7, Math.max(m, py)), bare = x !== px || y !== py;
    return { x, y, flip: x > W * 0.7, bare, fx, fy, clear: bare ? 1 : Math.max(0, Math.min(1, 1 - (d - 40) / 260)) };   // sharper as the reticle nears it
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
  titleOf(t) {                                        // the name under the verb: an item, a note's title, a board game's, a named thing
    const d = (t.userData.piece || {}).d || {};
    return d.item ? this.itemName(d.item) : d.note ? ((this.story.notes || {})[d.note] || {}).title || null
         : t.userData.use === "game" && d.game ? this.boardTitles[d.game] || d.game.replace(/_/g, " ") : d.name || null;
  }

  // ---- running the story -----------------------------------------------------------------------------------------
  // a stitch: its beats fire from what the player does; it ends on `done`, its timer, or an interrupt
  runStitch(st, n, interrupts = []) {
    return new Promise(resolve => {
      const beats = (st.beats || []).map(b => ({ b, fired: false }));
      this.stitchTitle = st.title || null;
      this.next = n.next;
      this.end = r => { this.listener = null; this.end = null; this.timerLeft = null; this.hud.timer(null); resolve(r); };
      this.timerLeft = st.timer ? +st.timer.secs : null;
      this.clock0 = this.clock;                     // the run's time (now()) carries on from where the run's clock is
      this.timerFail = st.timer ? st.timer.fail : null;
      this.listener = ev => {
        for (const it of interrupts) if (matches(it.when, ev, this)) return this.end({ to: it.to, interrupt: true });
        for (const x of beats) {
          if (x.fired || !flagsHold(x.b.if, this.flags) || !matches(x.b.when, ev, this)) continue;
          x.fired = true;
          if (this.opts.onBeat) this.opts.onBeat(st, x.b, (this.run ? this.run.secs : 0) + this.clock);   // the desk's debug panel lists it
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
      this.end = null; this.clock0 = this.clock;
      this.listener = ev => { const o = (n.options || []).find(o => o.when && matches(o.when, ev, this)); if (o) { this.listener = null; resolve(o); } };
      this.go();
    });
  }
  // the pause menu (play/menu.js): the world holds (no tick: the clock, timers, NPCs, doors all wait) while it's up
  async pause() {
    if (this.held) return;
    this.held = true; this.busy = true; this.keys = {};
    if (document.pointerLockElement === this.box) document.exitPointerLock();
    const v = await pauseMenu(this.hud, { game: this.gameTitle(), where: this.stitchTitle, secs: this.run ? this.run.secs + this.clock : this.clock });
    this.held = false; this.busy = false; this.last = this.resumed = performance.now();
    if (v && v.quit) { if (this.opts.quit) this.opts.quit(v.quit); return; }
    if (v === "escaped") return;                     // closed by Esc: asking for the lock now, the browser would take the same Esc as leaving it
                                                      // and pause again (the menu opening on every Esc); a click on the view takes it
    try { await this.box.requestPointerLock(); } catch (e) { }
  }
  hold() { this.active = false; this.keys = {}; this.hud.root.style.display = "none"; }   // the pointer stays locked: a scene looks round with it
  go() {
    if (this.stopped) return;
    this.hud.root.style.display = "";
    if (this.active) return;
    this.active = true; this.last = this.since = performance.now();
    const loop = now => { if (!this.active) return; if (!this.held) this.tick(Math.min(0.05, (now - this.last) / 1000)); this.last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // ---- the little things (docs/IMMERSION.md): their states on the run's clock; each change is heard ({type: "state"})
  now() { return (this.run ? this.run.secs : 0) + (this.clock - this.clock0); }
  stateOf(id) { const s = this.lives && this.lives.at(id, this.now()); return s ? s.state : null; }
  lifeActs(id) { return this.lives && this.lives.things[id] ? this.lives.acts(id, this.now()) : []; }
  setState(id, to, by = "story") { if (!this.lives) return; this.lives.set(id, to, this.now(), by); this.lifeEvents(); }
  lifeEvents() {
    const ch = this.lives.changes;
    for (; this.livesSeen < ch.length; this.livesSeen++) { const c = ch[this.livesSeen]; this.emit({ type: "state", id: c.id, is: c.to, by: c.by }); }
  }
  tick(dt) {
    this.clock += dt;
    if (this.lives) { this.lives.advance(this.now()); this.lifeEvents(); }
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
    const feet = p.pos.clone();
    if (!this.busy && !this.playing && !p.seat && !p.hiding && !p.sleeping && !this.moving) for (const a of ABILITIES) this.ability(a, "update", dt);
    p.speed = dt ? p.pos.distanceTo(feet) / dt : 0;
    this.hud.setStance(p.hiding ? "hidden" : [p.crouched && "crouched", this.carried && "carrying"].filter(Boolean).join(" · "));
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
    c.updateMatrixWorld();                               // the cursor's ray (and the hands) from where the eye is now, not the last frame
    const T = this.clock;
    for (const l of this.stage.lights) {
      const u = l.userData; let k = u.on ? (u.dim || 1) : 0;
      if (u.flicker) k *= 1 - u.flicker * 0.5 * Math.max(0, Math.sin(T * 13.7) * Math.sin(T * 7.3));
      l.intensity = (u.base || 1) * k;
    }
    if (this.holding) this.holdTick(dt);
    if (this.carried) this.carryTick(dt);
    for (const a of [...this.anims]) { a.t += dt; const k = Math.min(1, a.t / a.secs); a.fn(k); if (k >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.done(); } }
    this.drawNpcs(dt);
    this.watch(dt);
    if (!this.busy && !this.playing) this.updateCursor(dt);
    this.emit({ type: "tick" });
    this.hud.tick();
    if (this.stage.life && this.lives) { const T = this.now(); this.stage.life.update(T, id => ({ st: this.lives.at(id, T), hist: this.lives.history(id) })); }
    this.stage.render();
  }
}
export const PARTS = () => Object.fromEntries(KINDS.map(k => [k, names(k)]));
