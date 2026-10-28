// Examining (DECISIONS 2026-10-28, later: picking a thing up to look at it, as Chilla's Art's games do): a small thing
// you look at (`use: inspect`, its longest side 0.6 m or less) is taken up in your hands. The thing itself floats in
// front of the eye, lit by a lamp at your shoulder and drawn over the room (it's in your hands: never inside a wall);
// a drag turns it (the photo turned over to read its back), its name and words are under it, and Esc or the button
// puts it back where it was. A bigger thing (a wardrobe, a car) keeps the text card. The story hears the `use` once it's
// put back, as before. Our own code.
import * as THREE from "three";

// most: the longest side that's taken up (m); dist: how far from the eye; up: how far above the eye's line (clear of
// its words); fill: its longest side in the hands (m); turn: radians a pixel dragged; ease: how fast it follows; light:
// the shoulder lamp
export const EXAMINE = { most: 0.6, dist: 0.36, up: 0.03, fill: 0.14, turn: 0.012, ease: 12, light: 1.8 };
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

export function small(t) {
  if (!t || !t.isMesh) return false;
  const s = new THREE.Box3().setFromObject(t).getSize(new THREE.Vector3()), m = Math.max(s.x, s.y, s.z);
  return m > 0.01 && m <= EXAMINE.most;
}

export class Examine {
  constructor(rt, t) {
    this.rt = rt; this.t = t; this.mats = [];
    const copy = t.clone(true);                         // as it is, without its place: centred, at a size the hands hold
    copy.position.set(0, 0, 0); copy.quaternion.identity(); copy.updateMatrixWorld(true);
    copy.traverse(o => { if (o.material) { o.material = Array.isArray(o.material) ? o.material.map(m => this.mat(m)) : this.mat(o.material); o.renderOrder = 999; } });
    const box = new THREE.Box3().setFromObject(copy), size = box.getSize(new THREE.Vector3());
    copy.position.sub(box.getCenter(new THREE.Vector3()));
    this.turner = new THREE.Group(); this.turner.add(copy);
    this.turner.scale.setScalar(THREE.MathUtils.clamp(EXAMINE.fill / Math.max(size.x, size.y, size.z), 0.4, 3));
    // a thing lying flat (its thinnest side up) is tilted to show its top; one standing (a photo) faces you
    const flat = size.y <= Math.min(size.x, size.z);
    this.want = new THREE.Quaternion().setFromAxisAngle(X, flat ? 0.6 : 0); this.turner.quaternion.copy(this.want);
    this.pivot = new THREE.Group(); this.pivot.add(this.turner);
    this.lamp = new THREE.PointLight(0xfff2e2, EXAMINE.light, 1.6, 2);
    rt.stage.scene.add(this.pivot, this.lamp);
    t.visible = false;                                   // in your hands, not where it was
    this.tick(0);
  }
  mat(m) {                                             // its own copy of each material, drawn over the room
    const c = m.clone(); c.depthTest = false; c.depthWrite = false; c.side = THREE.FrontSide; this.mats.push(c); return c;
  }
  // a drag: turned about the view's up (across) and its side (up and down), whatever way it's facing now
  turn(dx, dy) {
    this.want.premultiply(new THREE.Quaternion().setFromAxisAngle(Y, dx * EXAMINE.turn));
    this.want.premultiply(new THREE.Quaternion().setFromAxisAngle(X, dy * EXAMINE.turn));
  }
  angle() { return 2 * Math.acos(Math.min(1, Math.abs(this.turner.quaternion.w))); }   // how far it's turned from facing you
  tick(dt) {
    const cam = this.rt.stage.camera; cam.updateMatrixWorld();
    this.turner.quaternion.slerp(this.want, dt ? Math.min(1, dt * EXAMINE.ease) : 1);
    this.pivot.position.copy(cam.localToWorld(new THREE.Vector3(0, EXAMINE.up, -EXAMINE.dist)));
    this.pivot.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));
    this.lamp.position.copy(cam.localToWorld(new THREE.Vector3(0.18, 0.16, -0.04)));
  }
  end() {
    this.pivot.removeFromParent(); this.lamp.removeFromParent(); this.lamp.dispose();
    for (const m of this.mats) m.dispose();
    this.t.visible = true;
  }
}
