// Physics for Play (GAMEPLAY_PLAN §10): things that move as things do, first the die. The level's solid blocks are
// static bodies (door leaves follow their swing); a thing that rolls is a dynamic body that sleeps when it settles,
// and the face on top is read then. cannon-es (vendor/, MIT) beside three.js.
import * as THREE from "three";
import * as CANNON from "../vendor/cannon-es.js";

// a six-sided die's faces in BoxGeometry's material order (+x, -x, +y, -y, +z, -z): opposite faces add up to 7
export const DIE_FACES = [2, 5, 1, 6, 3, 4];
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
               5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };

export function topFace(q) {                       // the face whose outward axis points most nearly up
  let best = -2, face = 1;
  AXES.forEach((a, i) => { const up = new THREE.Vector3(...a).applyQuaternion(q).y; if (up > best) { best = up; face = DIE_FACES[i]; } });
  return face;
}

let dieMats = null;
export function dieMaterials() {                    // ivory faces, dark pips, drawn once
  if (dieMats) return dieMats;
  dieMats = DIE_FACES.map(n => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#ece7dc"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#26231f";
    for (const [x, y] of PIPS[n]) { g.beginPath(); g.arc(28 + x * 36, 28 + y * 36, 11, 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.45 });
  });
  return dieMats;
}

const v3 = v => new CANNON.Vec3(v.x, v.y, v.z);
const shapeOf = g => g.radiusTop !== undefined ? new CANNON.Cylinder(g.radiusTop, g.radiusTop, g.height, 12)
                                               : new CANNON.Box(new CANNON.Vec3(g.width / 2, g.height / 2, g.depth / 2));

export class Physics {
  constructor(stage, movers) {                      // movers: the meshes that move (a die); everything else solid is static
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.35;
    this.world.defaultContactMaterial.restitution = 0.25;
    this.statics = []; this.movers = []; this.watch = [];
    stage.world.updateMatrixWorld(true);
    for (const m of stage.solid) {
      if (movers.includes(m) || !m.geometry || !m.geometry.parameters || m.geometry.parameters.width === undefined && m.geometry.parameters.radiusTop === undefined) continue;
      const b = new CANNON.Body({ mass: 0, type: m.userData.kind === "door" ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC, shape: shapeOf(m.geometry.parameters) });
      this.place(b, m); this.world.addBody(b); this.statics.push({ m, b });
    }
    for (const m of movers) {
      const b = new CANNON.Body({ mass: 1, shape: shapeOf(m.geometry.parameters), linearDamping: 0.12, angularDamping: 0.12,
                                  sleepSpeedLimit: 0.12, sleepTimeLimit: 0.35 });
      this.place(b, m); this.world.addBody(b); b.sleep();
      this.movers.push({ m, b });
    }
  }
  place(b, m) {
    const p = m.getWorldPosition(new THREE.Vector3()), q = m.getWorldQuaternion(new THREE.Quaternion());
    b.position.copy(v3(p)); b.quaternion.set(q.x, q.y, q.z, q.w);
  }
  bodyOf(m) { return (this.movers.find(x => x.m === m) || {}).b || null; }
  // throw a thing from the player's hand: forward and a little up, spinning; onRest(face) when it settles
  throw(m, from, dir, s, onRest) {
    const b = this.bodyOf(m); if (!b) return;
    const spin = () => (Math.random() * 2 - 1) * s.spin;
    b.position.copy(v3(from)); b.quaternion.setFromEuler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
    b.velocity.copy(v3(dir.clone().multiplyScalar(s.speed).add(new THREE.Vector3(0, s.lift, 0))));
    b.angularVelocity.set(spin(), spin(), spin());
    b.wakeUp();
    this.watch = this.watch.filter(w => w.b !== b).concat({ m, b, onRest, t: 0 });
  }
  rolling(m) { return this.watch.some(w => w.m === m); }
  step(dt) {
    for (const { m, b } of this.statics) if (b.type === CANNON.Body.KINEMATIC) this.place(b, m);   // a door's leaf as it swings
    this.world.step(1 / 60, dt, 4);
    for (const { m, b } of this.movers) { m.position.set(b.position.x, b.position.y, b.position.z); m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); }
    for (const w of [...this.watch]) {
      w.t += dt;
      if (w.b.sleepState === CANNON.Body.SLEEPING || w.t > 8) { this.watch.splice(this.watch.indexOf(w), 1); w.onRest(topFace(w.m.quaternion)); }
    }
  }
}
