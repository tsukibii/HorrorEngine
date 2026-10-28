// The flashlight (DECISIONS 2026-10-28; STORY_FORMAT §2 items, §4): an item with `torch` lights the way with F once
// the player has it (picked up, or given). It isn't in the inventory's row: it's in the pocket, out in the right hand
// when it's on. Its beam starts a little right of and below the eye and follows the look a moment late (the hand
// catching up), bobbing with the steps: a hot middle and a wide dim spill, warm or cold by its `kelvin`. The story
// switches it ({"torch": "on" | "off" | "flicker" | "dead" | "works"}: dead flickers it out and leaves F only clicking,
// works is new batteries) and hears the player switch it ({"torch": "on"} or {"torch": "off"}).
import * as THREE from "three";
import { register } from "./parts.js";

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
    const mk = () => { const l = new THREE.SpotLight(0xffffff, 0, 18, 0.2, 0.5, 1.5); rt.stage.scene.add(l, l.target); return l; };
    this.hot = mk(); this.spill = mk();
  }
  remove() { for (const l of [this.hot, this.spill]) { l.removeFromParent(); l.target.removeFromParent(); } }
  // the item's own settings over the part's: `torch: true` or {kelvin, cone, range}
  settings(s) { const it = this.rt.torchItem(); return Object.assign({}, s, it && typeof it.torch === "object" ? it.torch : {}); }
  // the story's word: on, off, flicker (a stutter, then on), dead (a stutter and out; F only clicks), works (F works again)
  set(v) {
    if (v === "on" && !this.dead) this.on = true;
    else if (v === "off") this.on = false;
    else if (v === "flicker") { this.on = !this.dead; this.flick = 1.4; }
    else if (v === "dead") { if (this.on) { this.flick = 1.1; this.dying = true; } this.dead = true; }
    else if (v === "works") { this.dead = false; this.dying = false; }
  }
  tick(dt, s0) {
    const s = this.settings(s0), rt = this.rt, cam = rt.stage.camera, p = rt.player;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (!this.dir) this.dir = fwd.clone();
    this.dir.lerp(fwd, Math.min(1, dt / Math.max(0.01, s.lag))).normalize();      // the hand catching up with the look
    const from = cam.localToWorld(new THREE.Vector3(...s.hand)), walk = Math.min(1, (p.speed || 0) / 1.2);
    this.phase = ((this.phase || 0) + dt * walk * Math.PI * 2 * 1.8) % (Math.PI * 2);    // about two steps a second at a walk
    from.y += Math.sin(this.phase) * 0.01 * walk;                                   // bobbing with the steps
    const aim = from.clone().addScaledVector(this.dir, 6);
    let k = this.on && !p.peeping ? 1 : 0;                                          // (not through a peephole)
    if (this.flick > 0) {                                                         // a stutter: hashed on the clock, never steady
      this.flick -= dt; const n = Math.sin(rt.clock * 61.3) * Math.sin(rt.clock * 23.9 + 1.7);
      k = this.dying ? (n > 0.1 - this.flick * 0.4 ? 1 : 0.05) : n > -0.2 ? 1 : 0.15;
      if (this.flick <= 0 && this.dying) { this.on = false; this.dying = false; }
    }
    const col = kelvinColor(s.kelvin);
    for (const [l, cone, part] of [[this.hot, s.cone, 1], [this.spill, s.spill, 0.22]]) {
      l.color.copy(col); l.distance = s.range; l.angle = cone / 2 * Math.PI / 180; l.penumbra = part === 1 ? 0.7 : 0.95;
      l.intensity = s.strength * part * k; l.position.copy(from); l.target.position.copy(aim); l.target.updateMatrixWorld();
    }
  }
}
