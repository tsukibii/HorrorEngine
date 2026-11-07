// The flashlight (DECISIONS 2026-10-28; STORY_FORMAT §2 items, §4): an item with `torch` lights the way with F once
// the player has it (picked up, or given). It isn't in the inventory's row: it's in the pocket, out in the right hand
// when it's on. Its beam starts a little right of and below the eye and follows the look a moment late (the hand
// catching up), bobbing with the steps: a hot middle and a wide dim spill, warm or cold by its `kelvin`. The story
// switches it ({"torch": "on" | "off" | "flicker" | "dead" | "works" | "dim" | "drain"}: dead flickers it out and leaves F
// only clicking, works is new batteries) and hears the player switch it ({"torch": "on"} or {"torch": "off"}). On a
// `battery` (FLASHLIGHT_PLAN §1, shared/torchbeam.js) it drains while it's on, dims and warms (a bulb) or blinks into a
// low mode (an LED), is heard running low, dying and changed, and a set of batteries in the pocket changes itself.
import * as THREE from "three";
import { register } from "./parts.js";
import { batteryOf, beam, REST_SECS, REST_GAIN, RESTS, CHANGE_SECS } from "../../shared/torchbeam.js";
import { flickerK, MODES } from "../../shared/flicker.js";

// cone and spill: their full angles (degrees); range (m) and strength (the stage's units, its bulb 2.2); lag: the
// seconds the beam takes to catch the look; hand: where it's held in the eye's space (right, up, forward: m)
register("ability", "torch", {
  settings: { key: "KeyF", cone: 26, spill: 62, range: 18, strength: 7.5, kelvin: 5200, lag: 0.09, hand: [0.2, -0.2, -0.05] },
  key: (rt, e, down, s) => { if (down && !e.repeat && e.code === s.key) rt.torchSwitch(); },
  update: (rt, dt, s) => { if (rt.torchLight) rt.torchLight.tick(dt, s); },
});

// a colour temperature as a three.js colour (Tanner Helland's fit, good from 1000 to 40000 K)
export function kelvinColor(k) {
  const t = k / 100, c = v => Math.max(0, Math.min(255, v)) / 255;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return new THREE.Color(c(r), c(g), c(b));
}

export class Torch {
  constructor(rt) {
    this.rt = rt; this.on = false; this.dead = false; this.flick = 0; this.dying = false; this.dir = null;
    // its battery (shared/torchbeam.js, FLASHLIGHT_PLAN §1): the charge, when it ran low, a rest, a change of batteries;
    // the story's timed dims and flickers on the beam (a lamp's layers)
    this.item = null; this.bat = null; this.charge = 1; this.lowAt = null; this.lowHeard = false; this.restT = 0; this.rests = RESTS;
    this.changing = null; this.layers = []; this.fl = {}; this.k = 0; this.kelvinNow = 0;
    const mk = () => { const l = new THREE.SpotLight(0xffffff, 0, 18, 0.2, 0.5, 1.5); rt.stage.scene.add(l, l.target); return l; };
    this.hot = mk(); this.spill = mk();
  }
  remove() { for (const l of [this.hot, this.spill]) { l.removeFromParent(); l.target.removeFromParent(); } }
  // the item's own settings over the part's: `torch: true` or {kelvin, cone, range}
  settings(s) { const it = this.rt.torchItem(); return Object.assign({}, s, it && typeof it.torch === "object" ? it.torch : {}); }
  // its battery from its item (batteryOf), read again when the flashlight changes
  battery() {
    const it = this.rt.torchItem(); if (!it || this.item === it) return;
    this.item = it; this.bat = batteryOf(it.torch); this.charge = this.bat.charge; this.lowHeard = this.charge < this.bat.low; this.lowAt = null; this.rests = RESTS;
  }
  onBattery() { return !!(this.bat && this.bat.battery > 0); }
  chargeNow() { return this.onBattery() ? this.charge : 1; }
  // the story's word (play.gd torch_set): on, off, flicker (a stutter; with secs or mode that long in a lamp's mode),
  // dim (to, secs, over), dead (the charge gone: a stutter and out), works (full: new batteries), drain (to: the charge)
  set(v, a = {}) {
    this.battery();
    const secs = +a.secs || 0, over = Math.max(0, +a.over || 0), T = this.rt.clock;
    if (v === "on") { if (!this.dead) this.on = true; this.layers = []; }
    else if (v === "off") this.on = false;
    else if (v === "flicker") {
      this.on = !this.dead;
      if (secs > 0 || MODES.includes(a.mode)) this.layers.push({ set: "flicker", mode: MODES.includes(a.mode) ? a.mode : "dying", t0: T, end: T + (secs > 0 ? secs : 1.4), fade: over, to: 1 });
      else this.flick = 1.4;
    } else if (v === "dim") {
      const to = Math.max(0, Math.min(1, a.to !== undefined && a.to !== null ? +a.to : 0.35));
      this.layers.push({ set: "dim", to, t0: T, end: T + (secs > 0 ? secs : 1e9), fade: over, mode: null });
    } else if (v === "dead") {
      if (this.on) { this.flick = 1.1; this.dying = true; } else if (!this.dead) this.died();
      this.dead = true; this.charge = 0;
    } else if (v === "works") { this.dead = false; this.dying = false; this.charge = 1; this.lowHeard = false; this.lowAt = null; this.rests = RESTS; }
    else if (v === "drain") {
      const c = Math.max(0, Math.min(1, +a.to || 0)); this.charge = c;
      if (c <= 0) this.set("dead"); else if (this.bat && c >= this.bat.low) { this.lowHeard = false; this.lowAt = null; }
    }
  }
  // out for good (its stutter over): heard as {"torch": "dead"}; a set in the pocket is then changed by itself
  died() { this.rt.emit({ type: "torch", dead: true }); }
  // the batteries changed from the pocket (by itself once it's dead, or from the pause menu): about two seconds of dark,
  // then the light full; heard as {"torch": "changed"}. False with none to change
  change() {
    const sets = this.rt.batteries(); if (!sets.length || !this.rt.torchItem() || this.changing) return false;
    this.battery(); this.changing = { at: this.rt.clock + CHANGE_SECS, item: sets[0] };
    this.on = false; this.flick = 0; this.dying = false; this.rt.shelfSound("flashlight_02"); this.rt.hud.log("changing the flashlight's batteries");
    return true;
  }
  changed() {
    const c = this.changing; this.changing = null;
    const full = Math.max(0, Math.min(1, +(((this.rt.story.items || {})[c.item] || {}).battery ?? 1)));
    this.rt.takeItem(c.item); this.charge = full; this.dead = false; this.lowHeard = !!(this.bat && full < this.bat.low); this.lowAt = null; this.rests = RESTS;
    this.on = true; this.rt.shelfSound("flashlight_01");
    this.rt.emit({ type: "torch", changed: true }); this.rt.emit({ type: "torch", on: true });
  }
  tick(dt, s0) {
    this.battery();
    const s = this.settings(s0), rt = this.rt, cam = rt.stage.camera, p = rt.player, T = rt.clock, bat = this.bat, onBat = this.onBattery();
    if (this.changing && T >= this.changing.at) this.changed();
    if (onBat) {                                                                   // its battery (FLASHLIGHT_PLAN §1)
      if (this.on && !this.dead && !this.dying) { this.charge = Math.max(0, this.charge - dt / bat.battery); this.restT = 0; }
      if (this.charge < bat.low && !this.lowHeard) { this.lowHeard = true; this.lowAt = T; rt.emit({ type: "torch", low: true }); }
      if (this.charge <= 0 && this.on && !this.dying && !this.dead) { this.flick = 1.1; this.dying = true; this.dead = true; }   // the last of it: a stutter, then out
      if (bat.rest && !this.on && this.charge < bat.low && this.rests > 0) {       // a rest: a bulb's cells give a little more
        this.restT += dt;
        if (this.restT >= REST_SECS) { this.restT = 0; this.rests -= 1; this.charge += REST_GAIN; this.dead = false; }
      }
    }
    if (this.dead && !this.dying && !this.changing && rt.batteries().length) this.change();   // a set in the pocket: changed by itself
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (!this.dir) this.dir = fwd.clone();
    this.dir.lerp(fwd, Math.min(1, dt / Math.max(0.01, s.lag))).normalize();      // the hand catching up with the look
    const from = cam.localToWorld(new THREE.Vector3(...s.hand)), walk = Math.min(1, (p.speed || 0) / 1.2);
    from.y -= Math.cos((rt.stepAt ?? 0.5) * Math.PI * 2) * 0.01 * walk;            // dipping with each footstep (steps.js)
    const aim = from.clone().addScaledVector(this.dir, 6);
    let k = this.on && !p.peeping ? 1 : 0;                                          // (not through a peephole)
    if (this.flick > 0) {                                                         // a stutter: hashed on the clock, never steady
      this.flick -= dt; const n = Math.sin(rt.clock * 61.3) * Math.sin(rt.clock * 23.9 + 1.7);
      k = this.dying ? (n > 0.1 - this.flick * 0.4 ? 1 : 0.05) : n > -0.2 ? 1 : 0.15;
      if (this.flick <= 0 && this.dying) { this.on = false; this.dying = false; this.died(); }
    }
    let kelvin = s.kelvin, reach = 1;
    if (onBat) {                                                                   // the beam by its charge (torchbeam.js)
      const bm = beam({ kind: bat.kind, charge: this.charge, low: bat.low, lowAt: this.lowAt, kelvin: bat.kelvin > 0 ? bat.kelvin : kelvin }, T);
      k *= bm.b; reach = bm.reach; if (bm.kelvin > 0) kelvin = bm.kelvin;
    }
    const keep = [];                                                               // the story's timed dims and flickers on the beam
    for (const L of this.layers) {
      if (T >= L.end + L.fade) continue;
      keep.push(L);
      const w = layerWeight(L, T); if (w <= 0) continue;
      if (L.set === "dim") k *= 1 + (L.to - 1) * w;
      else { Object.assign(this.fl, { flicker: 1, mode: L.mode, seed: 7, interval: 1 }); k *= 1 + (flickerK(this.fl, T) - 1) * w; }
    }
    k *= rt.nearTorchK ?? 1;                                                       // someone near (her `near`): it flickers, dims or dies
    this.layers = keep; this.k = k; this.kelvinNow = kelvin;
    this.from = from; this.aim = this.dir.clone(); this.cone = s.cone; this.spillA = s.spill; this.reachM = s.range * Math.max(0.05, reach);   // for what feels it (runtime.js beamAt)
    const col = kelvinColor(kelvin);
    for (const [l, cone, part] of [[this.hot, s.cone, 1], [this.spill, s.spill, 0.22]]) {
      l.color.copy(col); l.distance = s.range * Math.max(0.05, reach); l.angle = cone / 2 * Math.PI / 180; l.penumbra = part === 1 ? 0.7 : 0.95;
      l.intensity = s.strength * part * k; l.position.copy(from); l.target.position.copy(aim); l.target.updateMatrixWorld();
    }
  }
}

// a timed change's weight now (runtime.js layerW, play.gd layer_w): 0 before and after, 1 while it holds, smoothed both ways
function layerWeight(L, T) {
  const sm = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  return sm(Math.min(L.fade > 0 ? (T - L.t0) / L.fade : (T >= L.t0 ? 1 : 0), L.fade > 0 ? (L.end + L.fade - T) / L.fade : (T < L.end ? 1 : 0)));
}
