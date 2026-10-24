// Physics for Play (GAMEPLAY_PLAN §10): things that move as things do. The level's solid blocks are static bodies
// (door leaves follow their swing); a thing that moves is a dynamic body that sleeps when it settles: a die (its face
// on top read then) and the things you carry. How a thing moves is its **physics kind**, a part (parts.js, kind
// "physics"): its body (`mass` kg, `bounce`, `friction`, `damping`, `spin` its turning's damping), where the hand holds
// it (`hand`: metres right, up and ahead of the eye), how it follows the hand (`follow` a spring's stiffness, moving
// with the hand and lagging only as the hand speeds up or stops; `give` its damping: 1 settles without passing the
// hand, less swings past it), and `soft(st, acc, dt, s)`: what its own
// shape does with its acceleration, in the hand and on the ground (st.sq its squash, st.bend its top's lean in
// metres). `rigid` and `plushie` first; a game adds a kind by registering one, and the format's word for it with it
// (storylib.PHYSICS). cannon-es (vendor/, MIT) beside three.js.
import * as THREE from "three";
import * as CANNON from "../vendor/cannon-es.js";
import { register, part, settingsOf } from "./parts.js";

register("physics", "rigid", {                     // a box, a bottle, a die: it follows the hand stiffly
  settings: { mass: 1, bounce: 0.25, friction: 0.35, damping: 0.12, spin: 0.12, follow: 1500, give: 0.9, turn: 30, hand: [0.22, -0.24, -0.55] },
});
// a plushie: light and soft. It stays in the hand but lags a little and swings past as the hand starts and stops,
// squashes as it's pushed up and stretches as it's let go, bounces a little with each step, and its top flops behind
// a turn and wobbles back; dropped, it hardly bounces, squashes on landing and settles. `jiggle` scales the softness:
// 0 still, 1 a plushie, 2 jelly
register("physics", "plushie", {
  settings: { mass: 0.35, bounce: 0.04, friction: 0.85, damping: 0.45, spin: 0.6, follow: 600, give: 0.4, turn: 9,
              squash: 0.9, floppy: 0.45, jiggle: 1, round: 0.65, hand: [0.2, -0.27, -0.66] },
  soft: (st, acc, dt, s) => {
    const j = s.jiggle ?? 1, a = acc.clone().clampLength(0, 60);
    st.sv += (-a.y * s.squash * j - 180 * st.sq - 9 * st.sv) * dt; st.sq = Math.max(-0.4, Math.min(0.4, st.sq + st.sv * dt));
    st.bv.addScaledVector(a.setY(0), -s.floppy * j * dt).addScaledVector(st.bend, -81 * dt).addScaledVector(st.bv, -4.5 * dt);
    st.bend.addScaledVector(st.bv, dt).clampLength(0, 0.35 * st.h);
  },
});

const STEP = 1 / 120;                               // the soft springs' steps: steady on slow frames

// the soft shape: every visible mesh in the thing bent by height in the thing's own space (its top leans, its base
// stays), and a block with no art rounded into a cushion (`round`). Uniforms per mesh; built again once art arrives
function softMeshes(m, s) {
  const us = [], bare = !m.userData.dressed, inv = new THREE.Matrix4();
  m.updateMatrixWorld(true); inv.copy(m.matrixWorld).invert();
  const g = m.geometry.parameters, h = g.height ?? (g.radius ?? 0.25) * 2;
  if (bare && g.width !== undefined && !m.userData.softGeo) {           // the bare block: more vertices to bend and round
    m.geometry = new THREE.BoxGeometry(g.width, g.height, g.depth, 6, 8, 6); m.userData.softGeo = true;
  }
  m.traverse(o => {
    if (!o.isMesh || !o.material || [].concat(o.material).some(x => x.visible === false)) return;    // a dressed block itself is unseen
    const u = { uBend: { value: new THREE.Vector3() }, uToBody: { value: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) },
                uY: { value: new THREE.Vector2(-h / 2, h / 2) }, uRound: { value: o === m && g.width !== undefined ? s.round ?? 0 : 0 },
                uHalf: { value: new THREE.Vector3((g.width || 1) / 2, (g.height || 1) / 2, (g.depth || 1) / 2) }, mesh: o, toLocal: new THREE.Matrix3() };
    const soften = mat => {
      mat = mat.clone();
      const before = mat.onBeforeCompile, key = mat.customProgramCacheKey();
      mat.onBeforeCompile = (sh, r) => {
        before.call(mat, sh, r);
        Object.assign(sh.uniforms, { uBend: u.uBend, uToBody: u.uToBody, uY: u.uY, uRound: u.uRound, uHalf: u.uHalf });
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform vec3 uBend, uHalf; uniform mat4 uToBody; uniform vec2 uY; uniform float uRound;")
          .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nif (uRound > 0.0) { vec3 pr = normalize(position / uHalf) * uHalf; objectNormal = normalize(mix(objectNormal, normalize(pr / (uHalf * uHalf)), uRound)); }")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nif (uRound > 0.0) transformed = mix(position, normalize(position / uHalf) * uHalf, uRound);\n" +
                   "float hb = clamp(((uToBody * vec4(position, 1.0)).y - uY.x) / max(uY.y - uY.x, 1e-4), 0.0, 1.0); transformed += uBend * hb * hb;");
      };
      mat.customProgramCacheKey = () => key + "|play-soft";
      return mat;
    };
    o.material = Array.isArray(o.material) ? o.material.map(soften) : soften(o.material);
    us.push(u);
  });
  return us;
}

// a six-sided die's faces in BoxGeometry's material order (+x, -x, +y, -y, +z, -z): opposite faces add up to 7
export const DIE_FACES = [2, 5, 1, 6, 3, 4];
export const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];   // their outward axes, in that order
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
                   : g.radius !== undefined ? new CANNON.Sphere(g.radius)
                   : g.width !== undefined ? new CANNON.Box(new CANNON.Vec3(g.width / 2, g.height / 2, g.depth / 2)) : null;

export class Physics {
  // movers: the meshes that move (a die, things you carry), each with its kind (kindOf(m): a physics part's name and
  // its settings); everything else solid is static
  constructor(stage, movers, kindOf = () => ({ name: "rigid" })) {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.35;
    this.world.defaultContactMaterial.restitution = 0.25;
    this.statics = []; this.movers = []; this.watch = [];
    const ground = new CANNON.Material({ friction: 1, restitution: 1 });   // cannon multiplies two bodies' own: the thing's decide
    stage.world.updateMatrixWorld(true);
    for (const m of stage.solid) {
      const shape = !movers.includes(m) && m.geometry && m.geometry.parameters && shapeOf(m.geometry.parameters); if (!shape) continue;
      const b = new CANNON.Body({ mass: 0, type: m.userData.kind === "door" ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC, shape, material: ground });
      this.place(b, m); this.world.addBody(b); this.statics.push({ m, b });
    }
    for (const m of movers) {
      const k = kindOf(m) || { name: "rigid" }, kind = part("physics", k.name) || part("physics", "rigid"), s = settingsOf(kind, k.settings), g = m.geometry.parameters;
      const b = new CANNON.Body({ mass: s.mass, shape: shapeOf(g), linearDamping: s.damping, angularDamping: s.spin, sleepSpeedLimit: 0.12, sleepTimeLimit: 0.35,
                                  material: new CANNON.Material({ friction: s.friction, restitution: s.bounce }) });
      this.place(b, m); this.world.addBody(b); b.sleep();
      const st = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), sq: 0, sv: 0, bend: new THREE.Vector3(), bv: new THREE.Vector3(),
                   lastV: new THREE.Vector3(), base: m.scale.clone(), h: g.height ?? (g.radius ?? 0.25) * 2, soft: null };
      this.movers.push({ m, b, kind, s, st });
    }
  }
  moverOf(m) { return this.movers.find(x => x.m === m) || null; }
  settingsOf(m) { const x = this.moverOf(m); return x ? x.s : null; }
  // carrying: the body leaves the world while it's in the hand and carry() moves it there each frame, springing after
  // the hand (target, quat in the world); drop() puts it back moving as it moved, and onRest() when it has settled
  pick(m, at) {
    const x = this.moverOf(m); if (!x) return null;
    this.world.removeBody(x.b); x.carried = true; this.watch = this.watch.filter(w => w.m !== m);
    x.st.pos.copy(at || m.position); x.st.vel.set(0, 0, 0); x.st.quat.copy(m.quaternion); x.st.hand = null;
    return x;
  }
  carry(m, target, quat, dt) {
    const x = this.moverOf(m); if (!x || !x.carried) return;
    const { st, s } = x, c = 2 * Math.sqrt(s.follow) * s.give, acc = new THREE.Vector3();
    if (!st.hand || st.hand.distanceTo(target) > 1) st.hand = target.clone();           // the hands' own speed (a jump, a teleport: none)
    const hv = target.clone().sub(st.hand).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 8); st.hand.copy(target);
    for (let n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n, i = 0; i < n; i++) {
      acc.copy(target).sub(st.pos).multiplyScalar(s.follow).addScaledVector(hv.clone().sub(st.vel), c);
      st.vel.addScaledVector(acc, h); st.pos.addScaledVector(st.vel, h);
      if (x.kind.soft) x.kind.soft(st, acc, h, s);
    }
    st.quat.slerp(quat, 1 - Math.exp(-s.turn * dt));
    m.position.copy(st.pos); m.quaternion.copy(st.quat);
    this.show(x);
  }
  drop(m, onRest) {
    const x = this.moverOf(m); if (!x || !x.carried) return;
    x.carried = false;
    x.b.position.copy(v3(m.position)); x.b.quaternion.set(m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w);
    x.b.velocity.copy(v3(x.st.vel)); x.b.angularVelocity.set(0, 0, 0); x.st.lastV.copy(x.st.vel);
    this.world.addBody(x.b); x.b.wakeUp();
    this.watch = this.watch.filter(w => w.m !== m).concat({ m, b: x.b, onRest: () => onRest && onRest(), t: 0 });
  }
  carrying(m) { const x = this.moverOf(m); return !!(x && x.carried); }
  // a soft thing's shape now: squashed about its own volume, its top leaning (each mesh's bend in its own space)
  show(x) {
    if (!x.kind.soft) return;
    const { m, st } = x;
    if (!st.soft || st.dressed !== !!m.userData.dressed) { st.soft = softMeshes(m, x.s); st.dressed = !!m.userData.dressed; }
    const k = 1 + st.sq, w = 1 / Math.sqrt(Math.max(0.3, k));
    m.scale.set(st.base.x * w, st.base.y * k, st.base.z * w); m.updateMatrixWorld(true);
    for (const u of st.soft) u.uBend.value.copy(st.bend).applyMatrix3(u.toLocal.setFromMatrix4(u.mesh.matrixWorld).invert());
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
    for (const x of this.movers) {
      if (x.carried) continue;
      const { m, b, st } = x;
      m.position.set(b.position.x, b.position.y, b.position.z); m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      if (!x.kind.soft || !dt) continue;
      const v = new THREE.Vector3(b.velocity.x, b.velocity.y, b.velocity.z), acc = v.clone().sub(st.lastV).divideScalar(dt); st.lastV.copy(v);
      if (b.sleepState === CANNON.Body.SLEEPING && Math.abs(st.sq) + Math.abs(st.sv) + st.bend.length() + st.bv.length() < 1e-4 && st.soft) continue;
      for (let n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n, i = 0; i < n; i++) x.kind.soft(st, acc, h, x.s);
      this.show(x);
    }
    for (const w of [...this.watch]) {
      w.t += dt;
      if (w.b.sleepState === CANNON.Body.SLEEPING || w.t > 8) { this.watch.splice(this.watch.indexOf(w), 1); w.onRest(topFace(w.m.quaternion)); }
    }
  }
}
