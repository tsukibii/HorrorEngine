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
import { flickerK, flickerOn } from "../../shared/flicker.js";
import { castSteps } from "./steps.js";
import { Torch } from "./torch.js";
import "./clean.js";
import "./faces.js";
import { lensesFor, followLeaf, LENS } from "./peephole.js";
import { latchFor, turnBar } from "./latch.js";
import { Examine } from "./examine.js";
import { behaviourOf } from "./behaviours.js";
import * as M from "../motion.js";
import { Hud, besideAt, setName, playerName } from "./hud.js";
import { Todo } from "./todo.js";
import { pauseMenu, autosave } from "./menu.js";
import { Physics, dieMaterials, inHand, follow } from "./physics.js";
import { Inventory } from "./inventory.js";
import { loadRules, boardCtx, Table } from "./boardgames.js";
import { EYES, FOV_H, vfov, s2t, Stage } from "../stage.js";

const ABILITIES = ["look", "walk", "crouch", "steps"];     // in the order they run (steps.js hears what walking did)
const THEME = "glass";                           // the HUD theme when a game names none (game.ui_theme)
const LIT = 2.2;                                   // a lamp that starts off: its strength when it's switched on (stage.js's bulb)
const USE_RANGE = 2.2, LOOK_RANGE = 30, DOOR_SECS = 0.6, SLAM_SECS = 0.15;
const DROP_AHEAD = 0.55, ICON = 112;               // G sets a thing down this far in front of you; the inventory's pictures (px)
// a cast member who `sees` (behave): her cone (degrees, full width), its reach (m), how much of it a crouched player
// is seen at, the seconds the suspicion meter takes to fill and to drain, and how long she's calm after a catch
export const SIGHT = { angle: 90, range: 9, crouched: 0.55, meter: 1.2, drain: 1.5, calm: 3 };
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const ELECTRIC = l => !["candle", "fire"].includes(l.userData.kind);   // a power cut darkens these
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
    this.inv = new Inventory(this); this.hand = null;  // what the player has picked up (inventory.js); the copy of the one in the hand ({entry, x: its spring})
    this.torchLight = null;                            // the flashlight (torch.js), made once the player has one
    this.playing = null; this.anims = []; this.boardTitles = {};   // a board game going on (its id); tweens on the game's clock
    fetch(`/api/boardgames/${encodeURIComponent(opts.game || "_")}`).then(r => (r.ok ? r.json() : {})).then(j => { for (const g of j.games || []) this.boardTitles[g.id] = g.title; }).catch(() => { });
    this.listener = null; this.ray = new THREE.Raycaster(); this.ray.layers.enableAll();   // every ray sees what the simple view leaves undrawn (stage.cull)
    this.on = {
      click: () => { if (this.active && !this.busy && document.pointerLockElement !== box) box.requestPointerLock(); },   // the first click takes the mouse
      // a left click uses what's under the reticle (every interactable: DECISIONS 2026-10-27, later); the wheel turns the inventory
      down: e => { if (e.button === 0 && document.pointerLockElement === box && this.active && !this.busy && !this.playing) { e.preventDefault(); this.use(true); } },
      up: e => { if (e.button === 0 && this.holding) { this.holding = null; this.hud.progress(null); } },   // a held use (scrubbing) let go
      wheel: e => { if (document.pointerLockElement === box && this.active && !this.busy && !this.playing) { e.preventDefault(); this.inv.scroll(e.deltaY); } },
      lock: () => {                                 // the lock lost in play (Esc) pauses
        const on = document.pointerLockElement === box;
        if (this.wasLocked && !on && this.active && !this.busy && performance.now() - (this.resumed || 0) > 500) this.pause();   // (not the lock a resume just asked for, lost again)
        this.wasLocked = on; this.hud.locked(on);
      },
      move: e => { if ((this.active || this.liveScene) && !this.busy && document.pointerLockElement === box) this.ability("look", "mouse", e.movementX, e.movementY); },
      key: e => this.keyEvent(e, e.type === "keydown"),
    };
    box.addEventListener("click", this.on.click); box.addEventListener("mousedown", this.on.down); box.addEventListener("wheel", this.on.wheel, { passive: false });
    window.addEventListener("mouseup", this.on.up);
    document.addEventListener("pointerlockchange", this.on.lock);
    document.addEventListener("mousemove", this.on.move);
    window.addEventListener("keydown", this.on.key); window.addEventListener("keyup", this.on.key);
    this.hud.locked(false);
  }
  stop() {
    this.active = false; this.listener = null; this.stopped = true; this.stage.uncull();
    for (const w of this.waits) w.res(); this.waits = [];
    for (const a of this.anims) a.done(); this.anims = [];
    this.box.removeEventListener("click", this.on.click); this.box.removeEventListener("mousedown", this.on.down); this.box.removeEventListener("wheel", this.on.wheel);
    window.removeEventListener("mouseup", this.on.up);
    document.removeEventListener("pointerlockchange", this.on.lock);
    if (this.hand) { this.hand.x.m.removeFromParent(); this.hand = null; }
    if (this.iconR) { this.iconR.dispose(); this.iconR.forceContextLoss(); this.iconR = null; }
    if (this.torchLight) { this.torchLight.remove(); this.torchLight = null; }
    document.removeEventListener("mousemove", this.on.move);
    window.removeEventListener("keydown", this.on.key); window.removeEventListener("keyup", this.on.key);
    if (document.pointerLockElement === this.box) document.exitPointerLock();
    this.hud.remove();
  }
  set(name) { const p = part("ability", name) || part("interactable", name); return settingsOf(p, this.settings[name]); }
  get carried() { return this.inv.held; }            // the thing in the hand (the `carrying` condition)
  ability(name, fn, ...args) { const p = part("ability", name); if (p && p[fn]) p[fn](this, ...args, this.set(name)); }
  keyEvent(e, down) {
    if (this.liveScene && !this.busy) {               // a live scene: only the walk's keys (the stitch's own keys wait)
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "KeyC"].includes(e.code)) { e.preventDefault(); this.keys[e.code] = down; if (!this.player.seat) for (const a of ABILITIES) this.ability(a, "key", e, down); }
      return;
    }
    if (!this.active || this.busy) return;
    if (down && e.code === "Escape") {               // Esc without the lock (the desk) pauses too, but not an Esc meant
      e.preventDefault(); if (performance.now() - this.since > 400) this.pause(); return;   // for the scene that just ended, or the card
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyG", "KeyQ", "KeyC", "KeyF", "Space", "ShiftLeft", "ShiftRight"].includes(e.code)) e.preventDefault();
    if (down && this.player.peeping && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) { this.unpeep(); return; }   // a step: the eye back
    if (this.playing) return;                          // at a board game: its choices take the keys
    this.keys[e.code] = down;
    this.ability("torch", "key", e, down);             // F: the flashlight, hidden or not
    if (down && !e.repeat && e.code === "KeyE") this.inv.toggle();        // E: the inventory's row, shown or hidden
    if (down && !e.repeat && e.code === "KeyG") this.drop();              // G: the one in the hand put down
    if (down && !e.repeat && e.code === "KeyQ") this.inv.lower(!this.inv.lowered);   // Q: lowered out of view, or raised
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
    this.lenses = [];                                    // a door with a peephole: its lens on both faces (peephole.js), riding the leaf
    for (const m of this.stage.world.children) {
      const pk = m.userData && m.userData.kind === "door" && ((m.userData.piece || {}).d || {}).peephole;
      if (!pk || this.lenses.some(x => x.door.userData.id === m.userData.id)) continue;
      for (const l of lensesFor(m, typeof pk === "number" ? pk : LENS.z)) { l.userData.id += l.userData.side > 0 ? ":a" : ":b"; this.stage.world.add(l); this.byId[l.userData.id] = l; this.lenses.push({ l, door: m }); followLeaf(l, m); }
    }
    this.latches = [];                                   // a door with a latch: its thumb turn on the face of the room that holds it (latch.js)
    for (const m of this.stage.world.children) {
      if (!(m.userData && m.userData.kind === "door" && ((m.userData.piece || {}).d || {}).latch) || this.latches.some(x => x.door.userData.id === m.userData.id)) continue;
      const l = latchFor(m, this.latchSide(m)); this.stage.world.add(l); this.byId[l.userData.id] = l; this.latches.push({ l, door: m });
      followLeaf(l, m); turnBar(l, !!this.doors[m.userData.id].latched);
    }
    for (const [id, on] of Object.entries(kept.vis)) this.setVisible(id, on, true);
    if (this.player.hiding) this.stage.seeThrough(this.player.hiding, this.stage.seeThroughOf(this.player.hiding));
    for (const f of Object.values(this.stage.cast)) f.group.visible = false;          // shown again by their behaviour (drawNpcs)
    // what the player set down here from another level (a copy of it, kept.brought), and where everything moved sits
    for (const [id, b] of Object.entries(kept.brought || {})) {
      const o = b.src.clone(); o.visible = true; this.stage.world.add(o); this.byId[id] = o;
      if (!((o.userData.piece || {}).tags || []).includes("hollow")) this.stage.solid.push(o);
    }
    for (const [id, k] of Object.entries(kept.bodies)) { const m = this.byId[id]; if (m) { m.position.copy(k.p); m.quaternion.copy(k.q); } }
    const movers = this.stage.world.children.filter(o => o.isMesh && o.userData.use === "roll");   // dice
    for (const m of movers) m.material = dieMaterials();
    this.physics = movers.length ? new Physics(this.stage, movers) : null;   // (what's in the inventory is hidden: not in the way)
    this.triggers = this.plan.pieces.filter(p => p.level === level && p.kind === "trigger").map(p => {
      const rv = p.tags.find(t => t.startsWith("room_volume:")), [w, d, h] = p.size, [x, y, z] = p.pos;
      return { id: rv ? rv.slice(12) : p.id, safe: !!(p.d || {}).safe, min: [x - w / 2, y - d / 2, z - h / 2], max: [x + w / 2, y + d / 2, z + h / 2] };
    });
  }
  placeAt(level, spot) {                               // the player on a spot (story coordinates and its yaw)
    this.player.seat = null; this.leaveHiding(); this.unpeep();
    this.enterLevel(level);
    const t = this.plan.things[spot];
    if (t) this.place(s2t(t.pos[0], t.pos[1], 0), t.yaw || 0, 0);
  }
  // carry on from where a scene left the eye: no cut back to a spot. Still seated or hidden when the eye is where it
  // was (a scene played from the seat or the locker)
  placeFromCamera(level, cam) {
    this.unpeep();                                     // a scene played from the peephole (a beat on peeping): the eye comes away with it
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
  // the floor under the feet (the player's, or anyone's), the room's `floor` (wood, stone, carpet, tile, dirt, metal,
  // water): its footsteps (steps.js)
  floorUnder(p = this.player.pos) {
    let best = null, top = -Infinity;
    for (const m of this.stage.solid) {
      if (m.userData.kind !== "floor") continue;
      const e = this.extent(m); if (!e || e.r !== undefined) continue;
      const t = e.cy + e.hy; if (t > p.y + 0.05 || t <= top) continue;
      const L = m.worldToLocal(p.clone());
      if (Math.abs(L.x) <= e.hx && Math.abs(L.z) <= e.hz) { best = m; top = t; }
    }
    const tag = best && ((best.userData.piece || {}).tags || []).find(t => t.startsWith("floor:"));
    return tag ? tag.slice(6) : "wood";
  }
  isIn(t) { const p = this.player.pos; return this.pointIn(t, p.x, -p.z, p.y + 0.5); }
  pointIn(t, x, y, z) { return x >= t.min[0] && x <= t.max[0] && y >= t.min[1] && y <= t.max[1] && z >= t.min[2] && z <= t.max[2]; }   // story coordinates

  // ---- what the story's parts call -------------------------------------------------------------------------------
  // what happened: the stitch's beats hear it first, then the to-do list (so a beat on the same moment as the last task's
  // tick still runs: taking the fuse slams the vault door before the list, through, ends the station)
  emit(ev) { if (this.listener) this.listener(ev); if (this.todo) this.todo.event(ev); }
  setFlag(f) { if (!f) return; this.flags.add(f); this.emit({ type: "flag", id: f }); if (this.opts.onFlag) this.opts.onFlag(f); }
  give(item) { this.items.add(item); this.hud.log(`got: ${this.itemName(item)}`); }
  takeItem(item) {                                   // the story's take, or used up (use_on): out of the pocket and the row
    this.items.delete(item);
    for (const e of this.inv.list.filter(e => e.item === item)) this.inv.remove(e.id);
  }
  inView(o) {                                         // any of it inside the camera's frustum (walls don't hide it)
    const c = this.stage.camera; c.updateMatrixWorld();
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse));
    return f.intersectsObject(o);
  }
  itemName(id) { return ((this.story.items || {})[id] || {}).name || String(id).replace(/_/g, " "); }
  // the flashlight (torch.js): the item with `torch` the player has; F switches it (heard as {type: "torch", on}), the
  // story's `torch` sets it. Dead, F only clicks
  isTorch(item) { return !!((this.story.items || {})[item] || {}).torch; }
  torchItem() { for (const id of this.items) if (this.isTorch(id)) return this.story.items[id]; return null; }
  torchOf() { if (!this.torchLight) { this.torchLight = new Torch(this); this.hud.hintKey("F", "flashlight"); } return this.torchLight; }
  torchSwitch() {
    if (!this.torchItem() || this.player.sleeping || this.inChapter) return;
    const t = this.torchOf(); this.shelfSound(t.on ? "flashlight_02" : "flashlight_01");
    if (t.dead) { this.hud.log("the flashlight is dead"); return; }
    t.on = !t.on; t.flick = 0;
    this.emit({ type: "torch", on: t.on });
  }
  torchSet(v) { if (!this.torchItem() && (v === "on" || v === "flicker")) { this.hud.log(`torch ${v}: the player has no flashlight`); return; } this.torchOf().set(v); }
  nameOf(t) { const p = t.userData.piece || {}, d = p.d || {}; return d.name || (p.tags || []).find(x => x.startsWith("tag:"))?.slice(4).replace(/_/g, " ") || t.userData.id.replace(/_/g, " "); }
  lineText(id) { const l = (this.story.lines || {})[id]; return l ? l.en || l.ja : null; }
  // a story sound: off the Studio's shelf when its file is sfx/<name>, placed at `at` (a thing or a cast member) when
  // it's given, else where the player is; a sound of the game's own is only logged (it plays in Unreal)
  sound(id, at) {
    const s = (this.story.sounds || {})[id], n = s && shelfName(s.file);
    this.hud.log(`♪ ${id}${at ? " at " + at : ""}${n ? "" : " (the game's own file: in Unreal)"}`);
    if (n) this.shelfSound(n, at);
  }
  shelfSound(name, at, db = 0) {
    if (!this.active) return;
    const f = at && (this.stage.cast || {})[at], o = at && (this.byId[at] || (f && f.group));   // a cast member: her figure's group
    const pos = o && o.getWorldPosition ? o.getWorldPosition(new THREE.Vector3()) : null;
    playShelf(name, pos ? { pos, camera: this.stage.camera, db } : { db });
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
    if (set === "lock" || set === "unlock") { d.locked = set === "lock"; if (!d.locked) d.latched = false; this.turnLatch(id); return; }   // the story's lock isn't the latch's
    const open = set === "open";
    if (open === d.open) return;
    d.open = open; d.from = d.deg; d.t = 0; d.secs = set === "slam" ? SLAM_SECS : DOOR_SECS;
    if (set === "slam") { this.hud.log("♪ slam"); this.shelfSound("door_slam_01", id); }
    d.to = open ? this.awayDeg(d.mesh) : 0;
  }
  // the latch (latch.js): which face of the leaf looks into the room that holds the door (+1 or -1 along its thickness),
  // whether the player stands on that side, the thumb turn turned (locked or not; the bar, the shelf's latch, heard).
  // It undoes only its own lock (`latched`): a door the story locked, or one its key opens, stays locked
  latchSide(m) {
    const floor = this.byId[`${(m.userData.piece || {}).room}__floor`], b = m.userData.base || { pos: m.position, rot: m.rotation.y };
    return !floor ? 1 : floor.position.clone().sub(b.pos).dot(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rot)) >= 0 ? 1 : -1;
  }
  onLatchSide(id) {
    const x = (this.latches || []).find(x => x.door.userData.id === id); if (!x) return false;
    const b = x.door.userData.base || { pos: x.door.position, rot: x.door.rotation.y };
    return this.player.pos.clone().sub(b.pos).dot(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rot)) * x.l.userData.side > 0;
  }
  turnLatch(id) { const d = this.doors[id]; for (const x of this.latches || []) if (x.door.userData.id === id) turnBar(x.l, !!(d && d.latched)); }
  latch(id, on) {
    const d = this.doors[id]; if (!d || d.open || (on ? d.locked : !d.latched)) return;
    d.locked = d.latched = on; this.turnLatch(id); this.shelfSound("latch", id);
    this.hud.log(`${on ? "locked" : "unlocked"}: ${id}`);
    this.emit({ type: "locked", id, on });
  }
  awayDeg(m) {                                          // open away from the player: try both ways, keep the farther
    const far = deg => { this.stage.swingDoor(m, deg); m.updateMatrixWorld(); return m.getWorldPosition(new THREE.Vector3()).distanceTo(this.player.pos); };
    const a = far(90), b = far(-90); this.stage.swingDoor(m, 0);
    return a >= b ? 90 : -90;
  }
  // the power (the `power` action, a breaker): kept per level; cut, every electric light is dark at render (each keeps
  // its own on or off for when it comes back: candles and fire burn on) and the switches are dead; back, they flicker up
  powered(level = this.level) { const k = this.kept && this.kept[level]; return !k || k.power !== false; }
  sweep(room) { this.stage.fireSweeps(room); this.hud.log(`a car passes ${room || "outside"}`); }   // the story's `sweep` action: a car passes the room's windows now
  sweeping(room) { return this.stage.sweeping(room); }
  power(set, level = this.level) {
    const k = (this.kept = this.kept || {})[level] = this.kept[level] || { vis: {}, doors: {}, bodies: {} }, on = set !== "off";
    if (on === (k.power !== false)) return;
    k.power = on; this.hud.log(on ? "the power is back" : "the power's out");
    if (on && level === this.level) for (const l of this.stage.lights) if (ELECTRIC(l)) {   // flickering up for a moment, then its own flicker again
      const u = l.userData; if (u.flicker0 === undefined) u.flicker0 = u.flicker || 0;
      u.flicker = Math.max(u.flicker0, 0.8); u.surge = this.clock + 0.9; flickerOn(u, this.clock);   // a tube's starter clicks
    }
    this.emit({ type: "power", on });
  }
  light(id, room, set) {
    const ls = id ? [this.byId[id]].filter(Boolean) : this.stage.lights.filter(l => l.userData.room === room);
    for (const l of ls) {
      const was = l.userData.on;
      if (set === "toggle") l.userData.on = !l.userData.on;
      else if (set === "on" || set === "off") l.userData.on = set === "on";
      else if (set === "flicker") { l.userData.on = true; l.userData.flicker = Math.max(0.6, l.userData.flicker || 0); }
      else if (set === "dim") { l.userData.on = true; l.userData.dim = 0.35; }
      if (l.userData.on && !was) flickerOn(l.userData, this.clock);   // switched on: a tube stutters on
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
  async examine(t, title, text) {                      // a small thing taken up in the hands (examine.js): dragged to turn, put back
    const ex = this.examining = new Examine(this, t);
    try { await this.modal(() => this.hud.examine({ title, text, turn: (dx, dy) => ex.turn(dx, dy) })); }
    finally { ex.end(); this.examining = null; }
  }
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
    this.busy = false; this.hud.locked(false); this.since = performance.now();   // the Esc that closed it isn't a pause too
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
  // ---- the inventory (inventory.js): taking a thing, the one in the hand, setting it down -----------------------------
  // a click on a pickup or a thing to carry: it leaves the world into the inventory, in the hand. Heard as `pickup` (its
  // item) or `carry`. One set down here from another level is taken back up from where it was set
  physicsOf(m) { const d = (m.userData.piece || {}).d || {}; return { name: d.physics || "rigid", settings: d.jiggle !== undefined ? { jiggle: +d.jiggle } : null }; }
  take(t) {
    const id = t.userData.id, d = (t.userData.piece || {}).d || {}, kept = this.kept[this.level], back = (kept.brought || {})[id];
    if (this.inv.has(id)) return;
    if (d.item && this.isTorch(d.item)) {             // a flashlight: into the pocket (F), not the row
      this.setVisible(id, false); delete kept.bodies[id]; this.give(d.item); this.torchOf();
      this.emit({ type: "pickup", item: d.item }); return;
    }
    const src = t.clone(); delete src.userData.mid;
    if (back) { delete kept.brought[id]; t.removeFromParent(); const i = this.stage.solid.indexOf(t); if (i >= 0) this.stage.solid.splice(i, 1); delete this.byId[id]; }
    else this.setVisible(id, false);
    delete kept.bodies[id];
    if (this.physics) this.physics.removeStatic(t);
    const mesh = src.clone(); mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.visible = true; mesh.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(mesh), size = bb.getSize(new THREE.Vector3());
    const e = { id, item: d.item || null, name: this.titleOf(t) || this.nameOf(t), kind: t.userData.use === "carry" ? "carry" : "pickup", level: back ? back.from : this.level,
                src, mesh, physics: this.physicsOf(t), r: Math.max(size.x, size.z) / 2, bottom: -bb.min.y, icon: this.iconOf(mesh) };
    this.inv.add(e);
    if (e.item) { this.give(e.item); this.emit({ type: "pickup", item: e.item }); }
    if (e.kind === "carry") this.emit({ type: "carry", id });
  }
  // the one in the hand: a copy of it in front of the eye, a little right and down (its physics kind's `hand`), after the
  // hand on its kind's spring (a plushie lags, squashes and flops), bobbing with the steps, pulled in short of a wall.
  // Put away while a scene plays, at a board game, sitting, hiding, asleep or reading
  handTick(dt) {
    const e = this.inv.held, p = this.player;
    if (this.hand && this.hand.entry !== e) { this.hand.x.m.removeFromParent(); this.hand = null; }
    if (!e) return;
    if (!this.hand) { this.stage.scene.add(e.mesh); this.hand = { entry: e, x: inHand(e.mesh, e.physics) }; }
    const m = this.hand.x.m, away = !this.active || !!this.playing || !!p.seat || !!p.hiding || !!p.sleeping || !!p.peeping || this.busy || this.inv.lowered;
    m.visible = !away; if (away) return;
    const cam = this.stage.camera, walk = Math.min(1, (p.speed || 0) / 1.2), hand = new THREE.Vector3(...this.hand.x.s.hand);
    hand.y -= Math.cos((this.stepAt ?? 0.5) * Math.PI * 2) * 0.012 * walk;      // dipping with each footstep (steps.js)
    if (this.clock - (this.scrubbing ?? -9) < 0.15) { hand.x += Math.sin(this.clock * 15) * 0.05; hand.y -= 0.06; }   // scrubbing: the hand works it to and fro
    const eye = cam.position.clone(), want = cam.localToWorld(hand), d = want.clone().sub(eye), len = d.length();
    this.ray.set(eye, d.divideScalar(len)); this.ray.far = len + e.r;
    const hit = this.ray.intersectObjects(this.blocks(), false)[0];
    if (hit) want.copy(eye).addScaledVector(d, Math.max(0.12, hit.distance - e.r));
    this.hand.at = want;
    follow(this.hand.x, want, new THREE.Quaternion().setFromAxisAngle(UP, (p.yaw - 90) * Math.PI / 180), dt);
  }
  // G: the one in the hand set down on whatever is under a spot just in front of you (the floor, a table), facing you:
  // no falling, it's simply there. Out of the inventory (its item too), and heard where it lies: {type: "dropped", id,
  // in: [the rooms and triggers it's in]}. Set down in the level it came from it's the thing itself again; in another,
  // a copy of it stays there (kept with that level)
  drop() {
    const e = this.inv.held, p = this.player;
    if (!e || this.busy || this.playing || p.seat || p.hiding || p.sleeping) return;
    const at = this.dropSpot(e); if (!at) { this.hud.shake(); this.hud.line("There's no room to put it down.", "", 1.4, true); return; }
    const kept = this.kept[this.level], q = new THREE.Quaternion().setFromAxisAngle(UP, (p.yaw - 90) * Math.PI / 180);
    let o = e.level === this.level ? this.byId[e.id] : null;
    if (o) { o.position.copy(at); o.quaternion.copy(q); this.setVisible(e.id, true); }
    else {
      o = e.src.clone(); o.position.copy(at); o.quaternion.copy(q); o.visible = true;
      this.stage.world.add(o); this.byId[e.id] = o;
      if (!((o.userData.piece || {}).tags || []).includes("hollow")) this.stage.solid.push(o);
      (kept.brought = kept.brought || {})[e.id] = { src: e.src, from: e.level };
    }
    o.updateMatrixWorld(true);
    kept.bodies[e.id] = { p: o.position.clone(), q: o.quaternion.clone() };
    if (this.physics) this.physics.addStatic(o);
    this.inv.remove(e.id);
    if (e.item) this.items.delete(e.item);
    this.hud.log(`put down: ${e.name}`);
    this.emit({ type: "dropped", id: e.id, in: this.triggers.filter(t => this.pointIn(t, at.x, -at.z, at.y)).map(t => t.id) });
  }
  // where a thing goes down: DROP_AHEAD in front of your feet (nearer when a wall is), on top of whatever is under that
  // spot; null when you're against a wall
  dropSpot(e) {
    const p = this.player, a = p.yaw * Math.PI / 180, fwd = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const from = p.pos.clone().setY(p.pos.y + 0.45), blocks = this.blocks();
    this.ray.set(from, fwd); this.ray.far = DROP_AHEAD + e.r + 0.1;
    const wall = this.ray.intersectObjects(blocks, false)[0], dist = wall ? Math.min(DROP_AHEAD, wall.distance - e.r - 0.04) : DROP_AHEAD;
    if (dist < 0.12) return null;
    const x = from.x + fwd.x * dist, z = from.z + fwd.z * dist;
    this.ray.set(new THREE.Vector3(x, p.pos.y + Math.max(p.eye, 1.2), z), DOWN); this.ray.far = Math.max(p.eye, 1.2) + 0.5;
    const hit = this.ray.intersectObjects(blocks, false)[0];
    return new THREE.Vector3(x, (hit ? hit.point.y : p.pos.y) + e.bottom, z);
  }
  // a picture of a thing for the inventory's row: it alone, three quarters from the front and a little above, lit, on
  // nothing (a small renderer of its own, made the first time)
  iconOf(src) {
    try {
      if (!this.iconR) {
        this.iconR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); this.iconR.setSize(ICON, ICON, false); this.iconR.setClearColor(0x000000, 0);
        this.iconScene = new THREE.Scene(); this.iconCam = new THREE.PerspectiveCamera(28, 1, 0.01, 60);
        const key = new THREE.DirectionalLight(0xfff0dd, 2.2); key.position.set(1.4, 2.4, 2.6);
        const rim = new THREE.DirectionalLight(0x9fb6ff, 0.9); rim.position.set(-2, 1.2, -2);
        this.iconScene.add(new THREE.HemisphereLight(0xd9dde6, 0x2a2622, 1.1), key, rim);
      }
      const o = src.clone(); o.position.set(0, 0, 0); o.quaternion.setFromAxisAngle(UP, -0.55); o.visible = true;
      this.iconScene.add(o); o.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3()), r = Math.max(0.02, box.getSize(new THREE.Vector3()).length() / 2);
      const cam = this.iconCam, dist = r / Math.sin(cam.fov * Math.PI / 360) * 1.04;
      cam.position.copy(c).addScaledVector(new THREE.Vector3(0, 0.5, 1).normalize(), dist); cam.lookAt(c);
      cam.near = Math.max(0.005, dist - r * 2); cam.far = dist + r * 2; cam.updateProjectionMatrix();
      this.iconR.render(this.iconScene, cam);
      const url = this.iconR.domElement.toDataURL("image/png");
      this.iconScene.remove(o);
      return url;
    } catch (err) { return null; }
  }
  // a board game (use: game): the player sits down at the table (seatAt) and its rules (Content/Studio/BoardGames/,
  // or the game's own BoardGames/) play it out through ctx (play/boardgames.js); then they stand up again, and the
  // story hears {type: "played", id, game, result}. `vs` names who they play (the dealer when no one)
  async boardGame(t, s) {
    if (this.playing) return;
    const d = (t.userData.piece || {}).d || {}, id = t.userData.id;
    let rules; try { rules = await loadRules(this.opts.game, d.game); } catch (e) { this.hud.log(`no rules for ${d.game}`); return; }
    this.playing = id; this.keys = {}; this.hud.setCursor("none", "");
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
    p.seat = t; p.stood = { pos: p.pos.clone(), eye: p.eye }; p.seatYaw = p.yaw + 180;   // the way the seat faces: a live scene's look is 90° either side of it
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
    const down = new THREE.Raycaster(new THREE.Vector3(at.x, box.max.y + 1, at.z), new THREE.Vector3(0, -1, 0)); down.layers.enableAll();   // the mattress at its middle, not a headboard
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
  // the peephole (peephole.js): the eye to the lens on the far face of the door, looking out along it through a wide
  // lens in a round hole (the HUD's .peep), a little room to look about; a click or a step takes it back to where it was
  peep(door, s) {
    const p = this.player, near = this.target, far = (this.lenses || []).find(x => x.door.userData.id === door && (!near || x.l.userData.side !== near.userData.side));
    if (!far || p.peeping) return;
    followLeaf(far.l, far.door);
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(far.l.quaternion), yaw = Math.atan2(-n.z, n.x) * 180 / Math.PI;
    p.peeping = { door, at: far.l.getWorldPosition(new THREE.Vector3()).addScaledVector(n, 0.03), back: { yaw: p.yaw, pitch: p.pitch } };
    p.limit = { yaw, dy: s.look[0], dp: s.look[1] }; p.yaw = yaw; p.pitch = 0; this.keys = {};
    this.hud.peep(true); this.hud.setCursor("none", "");
  }
  unpeep() {
    const p = this.player, pk = p.peeping; if (!pk) return;
    p.peeping = null; p.limit = null; p.yaw = pk.back.yaw; p.pitch = pk.back.pitch; this.hud.peep(false);
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
  // out in the rain a cast member's skin wets by itself (toward 0.8 in a few seconds) and dries slowly once she's in
  // (about a minute), unless the story's `skin` word has set her (byWord): then hers is hers till the word changes it
  rainWet(dt) {
    const lv = ((this.story.levels || {})[this.level] || {}), rain = (lv.weather ?? (this.story.game || {}).weather) === "rain";
    const rooms = rain ? (lv.rooms || []).filter(r => r.ceiling === false).map(r => r.id) : [];
    if (!rooms.length && !this.skinWet) return;
    for (const [cid, n] of Object.entries(this.npcs)) {
      if (!n.pos) continue;
      const s = (this.skinWet || {})[cid]; if (s && s.byWord) continue;
      const out = this.triggers.some(t => rooms.includes(t.id) && this.pointIn(t, n.pos.x, -n.pos.z, n.pos.y + 0.5));
      const cur = +((s || {}).wet || 0), nw = out ? Math.min(0.8, cur + 0.15 * dt) : Math.max(0, cur - 0.02 * dt);
      if (nw !== cur) (this.skinWet = this.skinWet || {})[cid] = this.stage.setSkin(cid, { wet: nw });
    }
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
  // the player's abilities (game.player, STORY_FORMAT §9.10): run and crouch unless told not; the standing eye height
  can(what) { const p = (this.story.game || {}).player; return !(p && p[what] === false); }
  standEye() { const p = (this.story.game || {}).player; return p && typeof p.eye === "number" ? Math.max(1.2, Math.min(2.0, p.eye)) : EYES.stand; }
  // what the reticle is on: the first visible thing along the ray, never a hollow piece (a kit door's frame: its block
  // spans the doorway, its drawn parts only the edges; you walk and click through it)
  // (nor a light effect drawn in the room: a window's shaft box, a pattern's plane (lightfx.js): the eye sees through them, so does the reticle)
  aim() { return this.ray.intersectObjects(this.stage.world.children.filter(o => o.isMesh && o.visible && !o.userData.shaft && !o.userData.pattern && !((o.userData.piece || {}).tags || []).includes("hollow")), false)[0] || null; }
  async use(press) {
    if (this.player.sleeping || this.inChapter) return;
    if (this.player.peeping) { this.hud.press(); this.unpeep(); return; }   // a click takes the eye from the peephole
    const seat = this.player.seat;
    if (seat && (!this.target || this.target === seat)) { this.hud.press(); this.stand(this.set("sit")); return; }   // a click stands you up
    if (this.player.hiding && !this.target) { this.hud.press(); this.unhide(this.set("hide")); return; }             // a click gets you out
    const t = this.target; if (!t) return;
    const ip = interactableOf(t, this);
    this.hud.press();
    if (ip && ip.holds) {                                  // held (scrubbing): hold() every frame till it's let go
      if (press && ip.prompt(t, this, this.set(ip.name)).cursor !== "locked") this.holding = t;
      else ip.use(t, this, this.set(ip.name));            // what's missing, said
      return;
    }
    if (ip && (await ip.use(t, this, this.set(ip.name))) === false) return;   // the use is done (seated, the door open, the note read) before the story hears it; false: nothing happened
    this.emit({ type: "use", id: t.userData.id });
  }
  updateCursor(dt) {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.stage.camera);
    this.ray.far = LOOK_RANGE;
    const hit = this.aim(), o = hit && hit.object, id = o && o.userData.id;
    if (id && id === this.look.id) this.look.t += dt; else this.look = { id, t: 0, dist: hit ? hit.distance : Infinity };
    if (hit) this.look.dist = hit.distance;
    const ip = o && hit.distance <= USE_RANGE ? interactableOf(o, this) : null;
    this.target = ip ? o : null;
    if (!ip) { this.hud.setCursor("none", this.player.seat ? this.set("sit").stand : ""); return; }
    const pr = ip.prompt(o, this, this.set(ip.name));
    this.hud.setCursor(pr.cursor, pr.label, pr.label ? this.anchorAt(o) : null, this.titleOf(o));
  }
  // a held use (play/clean.js): its hold() every frame while the button is down and the reticle on it (looked away: it
  // waits); done, the story hears its use
  holdTick(dt) {
    const t = this.holding, ip = interactableOf(t, this);
    if (!ip || !ip.hold || !t.visible) { this.holding = null; this.hud.progress(null); return; }
    if (this.target !== t) return;
    if (ip.hold(t, this, dt, this.set(ip.name))) {
      this.holding = null; this.hud.progress(null); this.setVisible(t.userData.id, false);
      this.hud.log(`clean: ${this.nameOf(t)}`); this.emit({ type: "use", id: t.userData.id });
    }
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
    const v = await pauseMenu(this.hud, { game: this.gameTitle(), where: this.stitchTitle, secs: this.run ? this.run.secs + this.clock : this.clock, torch: !!this.torchItem() });
    this.held = false; this.busy = false; this.last = this.resumed = performance.now();
    if (v && v.quit) { if (this.opts.quit) this.opts.quit(v.quit); return; }
    if (v === "escaped") return;                     // closed by Esc: asking for the lock now, the browser would take the same Esc as leaving it
                                                      // and pause again (the menu opening on every Esc); a click on the view takes it
    try { await this.box.requestPointerLock(); } catch (e) { }
  }
  // a live scene (STORY_FORMAT §3 `camera.mode: live`): play is held (no beats, no use, no HUD) but the eye stays the
  // player's: they look round and, standing, walk; seated, the look stays within 90° either side of the seat's facing
  liveStart() {
    const p = this.player; this.liveScene = true; this.keys = {}; this.liveLimit = p.limit;
    if (p.seat) p.limit = { yaw: p.seatYaw ?? p.yaw, dy: 90, dp: 60 };
    this.liveTick(0);
  }
  liveEnd() { this.liveScene = false; this.player.limit = this.liveLimit || null; this.keys = {}; }
  liveTick(dt) {
    const p = this.player, feet = p.pos.clone();
    if (dt > 0 && !this.busy && !p.seat && !p.hiding && !p.sleeping && !p.peeping && !this.moving) for (const a of ["walk", "crouch", "steps"]) this.ability(a, "update", dt);
    p.speed = dt ? p.pos.distanceTo(feet) / dt : 0;
    const c = this.stage.camera; c.position.copy(this.eyePos()); c.rotation.order = "YXZ";
    c.rotation.set(p.pitch * Math.PI / 180, (p.yaw - 90) * Math.PI / 180, 0);
    c.fov = vfov(+((this.story.game || {}).fov || FOV_H), c.aspect || 16 / 9); c.updateProjectionMatrix(); c.updateMatrixWorld();
  }
  hold() {
    this.active = false; this.keys = {}; this.hud.root.style.display = "none"; if (this.hand) this.hand.x.m.visible = false;
    this.stage.uncull();                              // a scene's eye may be anywhere: all of it drawn
    if (this.torchLight) for (const l of [this.torchLight.hot, this.torchLight.spill]) l.intensity = 0;   // the beam out while a scene plays
  }   // the pointer stays locked: a scene looks round with it
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
  skipTime(secs) { if (!this.lives) return; this.lives.skip(this.now(), secs); this.lifeEvents(); }   // missing time: the little things live through it
  lifeEvents() {
    const ch = this.lives.changes;
    for (; this.livesSeen < ch.length; this.livesSeen++) { const c = ch[this.livesSeen]; this.emit({ type: "state", id: c.id, is: c.to, by: c.by }); }
  }
  tick(dt) {
    this.clock += dt;
    if (this.lives) { this.lives.advance(this.now()); this.lifeEvents(); }
    if (this.faces) this.faces.tick(dt);                // the cast's expressions (faces.js: `expr`)
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
    if (!this.busy && !this.playing && !p.seat && !p.hiding && !p.sleeping && !p.peeping && !this.moving) for (const a of ABILITIES) this.ability(a, "update", dt);
    p.speed = dt ? p.pos.distanceTo(feet) / dt : 0;
    if (this.active && !this.busy) castSteps(this, dt, this.set("steps"));   // the cast walking about: heard where they are (steps.js)
    this.hud.setStance(p.hiding ? "hidden" : p.crouched ? "crouched" : "");
    for (const [id, d] of Object.entries(this.doors)) if (d.t < 1) {
      d.t = Math.min(1, d.t + dt / d.secs); const k = 1 - (1 - d.t) * (1 - d.t);
      d.deg = d.from + (d.to - d.from) * k; this.stage.swingDoor(d.mesh, d.deg);
      if (d.t >= 1 && !d.open) this.emit({ type: "closed", id });
    }
    for (const x of this.lenses || []) followLeaf(x.l, x.door);
    for (const x of this.latches || []) followLeaf(x.l, x.door);
    if (this.examining) this.examining.tick(dt);
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
    const c = this.stage.camera, eye = p.peeping ? p.peeping.at : this.eyePos();
    c.position.copy(eye); c.rotation.order = "YXZ";
    c.rotation.set(p.pitch * Math.PI / 180, (p.yaw - 90) * Math.PI / 180, 0);
    c.fov = p.peeping ? LENS.fov : vfov(+((this.story.game || {}).fov || FOV_H), c.aspect || 16 / 9); c.updateProjectionMatrix();   // through a peephole: its wide lens
    c.updateMatrixWorld();                               // the cursor's ray (and the hands) from where the eye is now, not the last frame
    const T = this.clock;
    for (const l of this.stage.lights) {
      const u = l.userData; let k = u.on && (this.powered() || !ELECTRIC(l)) ? (u.dim || 1) : 0;
      if (u.surge && T >= u.surge) { u.flicker = u.flicker0 || 0; delete u.surge; }   // back after the power's flicker-up
      k *= flickerK(u, T);                                                           // its mode (tools/shared/flicker.js)
      l.intensity = (u.base || 1) * k;
    }
    this.stage.sweepTick(dt);                            // the windows' headlight sweeps
    this.handTick(dt);
    if (this.torchLight) { if (!this.torchItem()) this.torchLight.on = false; this.ability("torch", "update", dt); }   // taken away: off
    for (const a of [...this.anims]) { a.t += dt; const k = Math.min(1, a.t / a.secs); a.fn(k); if (k >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.done(); } }
    this.drawNpcs(dt);
    this.rainWet(dt);
    this.watch(dt);
    if (!this.busy && !this.playing && !p.peeping) this.updateCursor(dt);
    if (this.holding) this.holdTick(dt);
    this.emit({ type: "tick" });
    this.hud.tick();
    if (this.stage.life && this.lives) { const T = this.now(); this.stage.life.update(T, id => ({ st: this.lives.at(id, T), hist: this.lives.history(id) })); }
    if (Stage.simple) this.stage.cull(c, id => { const d = this.doors[id]; return !d || d.open || d.t < 1; }); else this.stage.uncull();   // the simple view: what's out of sight not drawn
    this.stage.render();
  }
}
export const PARTS = () => Object.fromEntries(KINDS.map(k => [k, names(k)]));
