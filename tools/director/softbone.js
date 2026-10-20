// Soft bones: jiggle that looks right rather than simulates tissue (docs/FLESH.md §5). After EZSoftBone (Unity, MIT,
// Ethan Zack: github.com/EZhex1991/EZSoftBone), the same idea as Unreal's Kawaii Physics and Unity's Dynamic Bone.
//
// Each soft region (a breast, a buttock, the belly, a thigh...) gets a short chain of bones from the body out to its
// tip. The chain is simulated (a few points), the mesh follows it by skinning: the region moves as one shape (it
// swings, lags, squashes and stretches, keeping its volume) and never folds into shapes flesh doesn't make. The
// joints have radii and collide with the world (floor, walls, boxes, balls) and the body's own arms; the skin of the
// region is then pushed out of the same colliders, so a breast on the floor flattens instead of sinking in.
import * as THREE from "three";
import { FleshSim } from "./flesh.js";

// EZSoftBone's four numbers, per 60 Hz tick (0..1), along the chain (root -> tip):
//   damping: how much of its own motion each tick loses; stiffness: how much it is pulled back to its animated
//   place each tick (the shape keeper); resistance: how little gravity it feels; slackness: how much the bone may
//   stretch from its length (0 = rigid length, 1 = free).
export const SOFT_MATERIALS = {
  balloon: { damping: [0.10, 0.12], stiffness: [0.12, 0.08], resistance: [0.6, 0.4], slackness: [0.30, 0.40], squash: 1 },
  fat: { damping: [0.12, 0.15], stiffness: [0.24, 0.16], resistance: [0.7, 0.55], slackness: [0.15, 0.25], squash: 0.8 },
  // on a limb (thighs, upper arms): the flesh rides with a fast-swinging bone, so firmer and a tighter limit angle,
  // or it lags into a lump on the outside of the hip
  limb: { damping: [0.18, 0.2], stiffness: [0.45, 0.35], resistance: [0.75, 0.6], slackness: [0.1, 0.15], squash: 0.6, limitAngle: 20 },
};
// the jiggliness slider: 1 is the presets (medium), 0 firm, 2 very loose. Looser: less pull home, less damping,
// more stretch
export function jiggled(mat, j) {
  if (j === 1) return mat;
  const d = j - 1;
  return Object.assign({}, mat, {
    stiffness: mat.stiffness.map(v => Math.min(0.85, v * Math.pow(2, -1.2 * d))),
    damping: mat.damping.map(v => Math.min(0.6, v * Math.pow(2, -0.8 * d))),
    slackness: mat.slackness.map(v => Math.min(0.9, v * Math.pow(2, 0.5 * d))),
  });
}
// a bra: firmer (more pull home, more damping, less stretch)
export function supported(mat, s) {
  if (s <= 1) return mat;
  return Object.assign({}, mat, {
    stiffness: mat.stiffness.map(v => Math.min(0.85, 1 - Math.pow(1 - v, s))),
    damping: mat.damping.map(v => Math.min(0.6, v * Math.sqrt(s))),
    slackness: mat.slackness.map(v => v / s),
  });
}
// spread: how far past the region the pull reaches (x its own reach, at the reference depth spreadDepth, m), x
// spreadBust for breasts, buttocks and chest; core: the part of its reach that moves fully; baseShare: the share the
// body around and under takes at the reference depth (more fat, more share); inner: how much of that share the lean
// body under the fat (shown cut away) moves
export const SOFT_DEFAULTS = { tick: 1 / 60, gravity: 9.81, chain: [0.45, 0.8], push: 1, maxStretch: 1.5, minSquash: 0.55, limitAngle: 40,
  spread: 0.6, spreadBust: 1.4, spreadDepth: 0.06, core: 0.55, baseShare: 0.3, inner: 0.8 };

// ---- colliders (world space, metres) ----------------------------------------------------------------------------
// { type: "plane", p, n } | { type: "sphere", c, r } | { type: "capsule", a, b, r } | { type: "box", m (Matrix4, world
// from box), half (Vector3) }; push(point, radius) moves a point out, returns how far it moved
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _inv = new THREE.Matrix4();
export function pushOut(c, p, rad) {
  if (c.type === "plane") {
    const d = _v.copy(p).sub(c.p).dot(c.n) - rad;
    if (d >= 0) return 0; p.addScaledVector(c.n, -d); return -d;
  }
  if (c.type === "sphere") {
    _v.copy(p).sub(c.c); const l = _v.length(), r = c.r + rad;
    if (l >= r) return 0; if (l < 1e-6) _v.set(0, 1, 0); else _v.divideScalar(l);
    p.copy(c.c).addScaledVector(_v, r); return r - l;
  }
  if (c.type === "capsule") {
    _w.copy(c.b).sub(c.a); const t = Math.max(0, Math.min(1, _v.copy(p).sub(c.a).dot(_w) / Math.max(1e-9, _w.lengthSq())));
    const q = _w.multiplyScalar(t).add(c.a); _v.copy(p).sub(q); const l = _v.length(), r = c.r + rad;
    if (l >= r) return 0; if (l < 1e-6) return 0; p.copy(q).addScaledVector(_v.divideScalar(l), r); return r - l;
  }
  if (c.type === "box") {
    _inv.copy(c.m).invert(); _v.copy(p).applyMatrix4(_inv); const h = c.half;
    const dx = h.x + rad - Math.abs(_v.x), dy = h.y + rad - Math.abs(_v.y), dz = h.z + rad - Math.abs(_v.z);
    if (dx <= 0 || dy <= 0 || dz <= 0) return 0;
    const m = Math.min(dx, dy, dz);                  // out through the nearest face
    if (m === dx) _v.x += Math.sign(_v.x || 1) * dx; else if (m === dy) _v.y += Math.sign(_v.y || 1) * dy; else _v.z += Math.sign(_v.z || 1) * dz;
    p.copy(_v.applyMatrix4(c.m)); return m;
  }
  return 0;
}

// ---- the regions of a fat suit (balloons bring their own, from the sculpt) --------------------------------------
const FAT_REGIONS = [
  ["belly", v => v.bone(["root", "c_spine0", "c_spine1"]) && v.z > 0],
  ["chest L", v => v.bone(["c_spine2", "c_spine3"]) && v.z > 0 && v.x > 0],
  ["chest R", v => v.bone(["c_spine2", "c_spine3"]) && v.z > 0 && v.x <= 0],
  ["buttock L", v => v.bone(["root", "upleg"]) && v.z < 0 && v.x > 0 && v.y > v.crotch],
  ["buttock R", v => v.bone(["root", "upleg"]) && v.z < 0 && v.x <= 0 && v.y > v.crotch],
  ["love handle L", v => v.bone(["c_spine0", "c_spine1"]) && v.z <= 0 && v.x > 0],
  ["love handle R", v => v.bone(["c_spine0", "c_spine1"]) && v.z <= 0 && v.x <= 0],
  ["thigh L", v => v.bone(["l_upleg"]) && v.y <= v.crotch],
  ["thigh R", v => v.bone(["r_upleg"]) && v.y <= v.crotch],
  ["upper arm L", v => v.bone(["l_uparm"])],
  ["upper arm R", v => v.bone(["r_uparm"])],
];

export class SoftBoneSim extends FleshSim {
  constructor(figure, outer, lean, opts = {}) {
    super(figure, outer, lean, opts);
    this.so = Object.assign({}, SOFT_DEFAULTS, opts.soft || {});
    this.colliders = [];                            // the world's; the body's arms are added each tick
    this.mat = opts.material || SOFT_MATERIALS[this.region ? "balloon" : "fat"];
    this.jiggle = 1;                                // the jiggliness slider (1 = the preset)
    this.ownRegions = !this.region;                 // a fat suit finds its regions; balloons bring theirs
    this.support = 1;                               // a bra on the breasts (balloons)
    this.amount = { bust: 1, butt: 1, thighs: 1, belly: 1, arms: 1 };   // per area: how far the jiggle shows (any value)
    if (this.ownRegions) this.fatRegions();
    this.setupChains();
  }
  fatRegions() {                                   // each point's region from its strongest bone and side
    const G = this.mesh.geometry, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, bones = this.mesh.skeleton.bones, B = this.outerBind;
    let low = 1e9, top = -1e9; for (let i = 0; i < this.N; i++) { low = Math.min(low, B[i * 3 + 1]); top = Math.max(top, B[i * 3 + 1]); }
    const crotch = low + 0.47 * (top - low);
    this.region = new Int8Array(this.N); this.regionNames = ["", ...FAT_REGIONS.map(r => r[0])]; this.regionInfo = [];
    this.rep.forEach((r, i) => {
      let best = -1, bw = 0; for (let k = 0; k < 4; k++) if (SW.getComponent(r, k) > bw) { bw = SW.getComponent(r, k); best = SI.getComponent(r, k); }
      const name = bones[best] ? bones[best].name : "";
      const v = { x: B[i * 3], y: B[i * 3 + 1], z: B[i * 3 + 2], crotch, bone: keys => keys.some(k => name === k || name.startsWith(k + "_") || name.startsWith("l_" + k) || name.startsWith("r_" + k)) };
      if (this.h[i] < 0.006) return;                // under 6 mm of fat: stays on the bone
      FAT_REGIONS.some(([, test], k) => test(v) ? (this.region[i] = k + 1, true) : false);
    });
  }
  setupChains() {
    const N = this.N, nR = this.regionNames.length, o = this.so;
    // the weight field (the spread): soft tissue moves as one object, so a region's weight isn't only its own fat.
    // Over the skin (distance measured along the surface, from the region's deepest point) the whole mound carries
    // fully, then the pull fades into the skin around it; and the body under and around the fat (the lean body
    // wearing the suit) takes a share that grows with how deep the fat is, most for breasts and buttocks
    const W = Array.from({ length: nR }, () => null);
    this.chains = [];
    for (let r = 1; r < nR; r++) {
      let hMax = 0, apex = -1, n = 0;
      for (let i = 0; i < N; i++) if (this.region[i] === r) { n++; if (this.h[i] > hMax) { hMax = this.h[i]; apex = i; } }
      if (n < 12 || hMax < 0.008) continue;
      const name = this.regionNames[r], big = /^(breast|buttock|chest)/.test(name) ? o.spreadBust : 1;
      const far = 1e9, dist = this.geodesic(apex, far);
      const ds = []; for (let i = 0; i < N; i++) if (this.region[i] === r && dist[i] < far) ds.push(dist[i]);
      ds.sort((a, b) => a - b);
      const Rr = ds[Math.floor(0.9 * (ds.length - 1))] || 1;                // the region's reach over the skin
      const deep = Math.min(1.5, hMax / o.spreadDepth);                     // how much fat there is, 1 = the reference depth
      const core = o.core * Rr, edge = Rr * (1 + o.spread * deep * big);     // full weight out to core, none past edge
      const share = Math.min(0.85, o.baseShare * deep * big);               // the body around and under it
      const w = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const d = dist[i]; if (!(d < edge)) continue;
        const fall = d <= core ? 1 : (u => u * u * (3 - 2 * u))(1 - (d - core) / (edge - core));
        const t = Math.min(1, this.h[i] / (0.5 * hMax)), own = this.region[i] === r ? t * t * (3 - 2 * t) : 0;
        w[i] = fall * (share + (1 - share) * own);
      }
      for (let it = 0; it < 2; it++) {              // a light smoothing over the mesh
        const nw = new Float32Array(w);
        for (let i = 0; i < N; i++) { const nb = this.nb[i]; if (!nb.length) continue; let s = 0; for (let j = 0; j < nb.length; j++) s += w[nb[j]]; nw[i] = 0.5 * w[i] + 0.5 * s / nb.length; }
        w.set(nw);
      }
      W[r] = w;
      const joints = o.chain.map(f => ({ f, pos: new THREE.Vector3(), prev: new THREE.Vector3(), speed: new THREE.Vector3(), anim: new THREE.Vector3(), animPrev: new THREE.Vector3() }));
      // the radius: the tip joint stands inside the shape by about a quarter of its depth, the middle one deeper
      joints.forEach((j, k) => { j.radius = Math.max(0.008, hMax * (k === joints.length - 1 ? 0.25 : 0.4)); });
      const limb = /^(thigh|upper arm)/.test(name);
      const area = /^(breast|chest)/.test(name) ? "bust" : /^buttock/.test(name) ? "butt" : /^thigh/.test(name) ? "thighs" : /^upper arm/.test(name) ? "arms" : "belly";
      const own = limb ? SOFT_MATERIALS.limb : area === "bust" && this.support > 1 ? supported(this.mat, this.support) : undefined;
      this.chains.push({ r, name, area, matOwn: own, pair: name.replace(/ [LR]$/, ""), apex, hMax, joints, w, inner: share * o.inner, base: new THREE.Vector3(), tip: new THREE.Vector3(), anchor: this.anchorBone(apex) });
    }
    // where several regions share a point, their weights share it (never more than all of it)
    for (let i = 0; i < N; i++) { let s = 0; for (const c of this.chains) s += c.w[i]; if (s > 1) for (const c of this.chains) c.w[i] /= s; }
    this.first = true;
  }
  geodesic(src, far) {                           // distance over the skin from one point (Dijkstra on the mesh, mesh units)
    const N = this.N, B = this.outerBind, dist = new Float64Array(N).fill(far), heap = [[0, src]]; dist[src] = 0;
    const push = e => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, i] = pop(); if (d > dist[i]) continue;
      const nb = this.nb[i];
      for (let k = 0; k < nb.length; k++) { const j = nb[k], nd = d + Math.hypot(B[i * 3] - B[j * 3], B[i * 3 + 1] - B[j * 3 + 1], B[i * 3 + 2] - B[j * 3 + 2]); if (nd < dist[j]) { dist[j] = nd; push([nd, j]); } }
    }
    return dist;
  }
  refine() {                                     // painted volume: new thickness, so new regions and chains
    super.refine();
    if (this.ownRegions) this.fatRegions();
    this.setupChains();
  }
  anchorBone(i) {                                  // the body bone the region hangs from (for the Unreal export)
    const G = this.mesh.geometry, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, r = this.rep[i];
    let best = -1, bw = 0; for (let k = 0; k < 4; k++) if (SW.getComponent(r, k) > bw) { bw = SW.getComponent(r, k); best = SI.getComponent(r, k); }
    const name = this.mesh.skeleton.bones[best]?.name || "root";
    return name.replace(/_twist\d*_proc$/, "").replace(/_twist$/, "");
  }
  bodyColliders() {                                // the arms, as capsules: they push the breasts, belly and thighs
    const f = this.f, out = [];
    if (!f.all) return out;
    const W = n => f.all[n] ? f.all[n].getWorldPosition(new THREE.Vector3()) : null;
    for (const m of ["l", "r"]) for (const [seg, a, b] of [["up", "uparm", "lowarm"], ["low", "lowarm", "wrist"]]) {
      const A = W(`${m}_${a}`), B = W(`${m}_${b}`); if (!A || !B) continue;
      out.push({ type: "capsule", a: A, b: B, r: 0.8 * ((f.limbR && f.limbR[`${m}_${seg}`]) || 0.04), side: m, arm: true });
    }
    return out;
  }
  step(dt) {
    const N = this.N;
    this.mesh.updateMatrixWorld(true);
    this.Rprev.set(this.R);
    this.skin(this.R, this.outerBind, this.Gd);
    this.skin(this.A, this.leanBind, null);
    const R = this.R, A = this.A;
    // the chains' animated places: from the region's floor (under the apex) out through its tip
    for (const c of this.chains) {
      const i = c.apex;
      c.base.set(A[i * 3], A[i * 3 + 1], A[i * 3 + 2]); c.tip.set(R[i * 3], R[i * 3 + 1], R[i * 3 + 2]);
      for (const j of c.joints) { j.animPrev.copy(j.anim); j.anim.copy(c.base).lerp(c.tip, j.f); }
    }
    if (this.first) {
      for (const c of this.chains) for (const j of c.joints) { j.pos.copy(j.anim); j.animPrev.copy(j.anim); j.speed.set(0, 0, 0); }
      this.x.set(R); this.Rprev.set(R); this.first = false; this.acc = 0; return;
    }
    // fixed ticks (EZSoftBone's numbers are per tick), the animation interpolated between frames
    this.acc = (this.acc || 0) + dt;
    const tick = this.so.tick, ticks = Math.max(1, Math.round(this.acc / tick)); this.acc -= ticks * tick;
    const world = this.colliders.concat(this.bodyColliders());
    for (let s = 1; s <= ticks; s++) this.tick(s / ticks, tick * ticks / ticks, world, dt);
    this.deform(world);
  }
  tick(a, h, world, frameDt) {
    const g = this.so.gravity;
    for (const c of this.chains) {
      const i = c.apex, base = c.matOwn || this.mat;
      if (c._j !== this.jiggle || c._b !== base) { c._m = jiggled(base, this.jiggle); c._j = this.jiggle; c._b = base; }
      const mat = c._m;
      // gravity: only the change since the standing pose the shape was made in (it already hangs)
      const gx = -this.Gd[i * 3], gy = -1 - this.Gd[i * 3 + 1], gz = -this.Gd[i * 3 + 2];
      let parent = c.base, parentAnim = c.base;      // the floor is the body's: it doesn't move on its own
      c.joints.forEach((j, k) => {
        const anim = j.animPrev.clone().lerp(j.anim, a);
        const animV = j.anim.clone().sub(j.animPrev).divideScalar(frameDt);       // the body's own motion here
        const old = j.pos.clone();
        // resistance: gravity felt
        j.speed.x += gx * g * (1 - mat.resistance[k]) * h; j.speed.y += gy * g * (1 - mat.resistance[k]) * h; j.speed.z += gz * g * (1 - mat.resistance[k]) * h;
        // damping: on the motion relative to the body (EZSoftBone damps it all, which drags flesh behind a runner)
        j.speed.sub(animV).multiplyScalar(1 - mat.damping[k]).add(animV);
        j.pos.addScaledVector(j.speed, h);
        // stiffness: back toward where the animation puts it, relative to its parent's simulated place
        const pAnim = k === 0 ? parentAnim : c.joints[k - 1].animNow;
        const expected = anim.clone().sub(pAnim).add(parent);
        j.pos.lerp(expected, mat.stiffness[k]);
        // slackness: the bone's length, kept loosely
        const len = anim.distanceTo(pAnim), d = j.pos.clone().sub(parent), dl = d.length() || 1;
        const keep = parent.clone().addScaledVector(d, len / dl);
        j.pos.lerp(keep, 1 - mat.slackness[k]);
        // and never further than the stretch limit, nor closer than the squash limit
        const nd = j.pos.clone().sub(parent), nl = nd.length() || 1;
        const cl = Math.max(len * this.so.minSquash, Math.min(len * this.so.maxStretch, nl));
        if (cl !== nl) j.pos.copy(parent).addScaledVector(nd, cl / nl);
        // collisions: the world, the arms, and the other breast or buttock (siblings keep apart)
        for (const col of world) if (!(col.arm && !this.armsPush(c))) pushOut(col, j.pos, j.radius);
        for (const o of this.chains) if (o !== c && o.pair === c.pair && o.joints[k]) { const q = o.joints[k]; const sp = { type: "sphere", c: q.pos, r: q.radius * 0.9 }; pushOut(sp, j.pos, j.radius * 0.9); }
        this.limit(j.pos, parent, anim.clone().sub(pAnim), len, mat.limitAngle);     // last: a shove can't fold it back through the body
        j.speed.add(j.pos.clone().sub(old).divideScalar(h)).multiplyScalar(0.5);
        j.animNow = anim.clone();
        parent = j.pos; parentAnim = j.animNow;
      });
    }
  }
  // the limit angle (Kawaii Physics has the same): the bone swings at most so far from its animated direction, and
  // stays between the squash and stretch limits
  limit(pos, parent, animDir, len, angle) {
    const d = pos.clone().sub(parent), l = d.length(); if (l < 1e-9) { pos.copy(parent).addScaledVector(animDir, 1); return; }
    const a = animDir.clone().normalize(), dn = d.clone().divideScalar(l), lim = (angle || this.so.limitAngle) * Math.PI / 180;
    const ang = Math.acos(Math.max(-1, Math.min(1, a.dot(dn))));
    let dir = dn;
    if (ang > lim) {
      let ax = new THREE.Vector3().crossVectors(a, dn); if (ax.lengthSq() < 1e-12) ax = new THREE.Vector3(1, 0, 0).cross(a); ax.normalize();
      dir = a.clone().applyAxisAngle(ax, lim);
    }
    const cl = Math.max(len * this.so.minSquash, Math.min(len * this.so.maxStretch, l));
    pos.copy(parent).addScaledVector(dir, cl);
  }
  // the arms push what they can reach without already resting in it: breasts, chest, belly
  armsPush(c) { return /^(breast|chest|belly)/.test(c.name); }
  deform(world) {                                  // the mesh follows its chain as one piece: swung, squashed or stretched
    const N = this.N, x = this.x, R = this.R, A = this.A;
    x.set(R);
    if (!this.leanX) this.leanX = new Float32Array(N * 3);
    this.leanX.set(A);                              // the lean body under the suit, carried by its share
    const t = new THREE.Vector3(), q = new THREE.Vector3();
    for (const c of this.chains) {
      // one transform from the floor to the tip: the region turns about its floor and squashes along it, keeping its
      // volume (squashed, it bulges; stretched, it thins). The chain's middle joint shapes the motion (the lag, the
      // overshoot), not the mesh: blending two bones' transforms on a soft lump tears it
      // the area's amount scales how far the tip shows from where the animation puts it (2 = twice the swing; any value)
      const amt = this.amount[c.area] ?? 1, tipJ = c.joints[c.joints.length - 1];
      const ra = tipJ.anim.clone().sub(c.base), rs = tipJ.pos.clone().sub(tipJ.anim).multiplyScalar(amt).add(tipJ.anim).sub(c.base);
      const la = ra.length() || 1e-6, ls = rs.length() || 1e-6, axis = ra.divideScalar(la);
      const quat = new THREE.Quaternion().setFromUnitVectors(axis, rs.clone().divideScalar(ls));
      let k = ls / la; k = Math.max(0.05, 1 + (k - 1) * (c.matOwn || this.mat).squash);
      const side = 1 / Math.sqrt(k);
      for (let i = 0; i < N; i++) {
        const w = c.w[i] * this.jig[i]; if (Math.abs(w) < 1e-4) continue;     // the painted jiggle scales it (any value)
        t.set(R[i * 3], R[i * 3 + 1], R[i * 3 + 2]);
        q.copy(t).sub(c.base);
        const along = q.dot(axis);
        q.addScaledVector(axis, -along).multiplyScalar(side).addScaledVector(axis, along * k).applyQuaternion(quat).add(c.base);
        x[i * 3] += (q.x - t.x) * w; x[i * 3 + 1] += (q.y - t.y) * w; x[i * 3 + 2] += (q.z - t.z) * w;
        const wi = Math.min(w, c.inner); if (wi < 1e-4) continue;
        t.set(A[i * 3], A[i * 3 + 1], A[i * 3 + 2]); q.copy(t).sub(c.base);
        const al = q.dot(axis);
        q.addScaledVector(axis, -al).multiplyScalar(side).addScaledVector(axis, al * k).applyQuaternion(quat).add(c.base);
        this.leanX[i * 3] += (q.x - t.x) * wi; this.leanX[i * 3 + 1] += (q.y - t.y) * wi; this.leanX[i * 3 + 2] += (q.z - t.z) * wi;
      }
    }
    const p = new THREE.Vector3();
    // the skin of the soft regions out of the world's colliders (a contact flattens it), not out of its own arm
    if (this.so.push) for (let i = 0; i < N; i++) {
      let w = 0; for (const c of this.chains) w = Math.max(w, c.w[i]); if (w < 0.05) continue;
      p.set(x[i * 3], x[i * 3 + 1], x[i * 3 + 2]);
      let moved = 0;
      for (const col of world) {
        if (col.arm) { if (!this.chains.some(c => c.w[i] > 0.2 && this.armsPush(c))) continue; const save = col.r; col.r = save * 0.85; moved += pushOut(col, p, 0.004); col.r = save; }
        else moved += pushOut(col, p, 0.002);
      }
      if (moved) { x[i * 3] = p.x; x[i * 3 + 1] = p.y; x[i * 3 + 2] = p.z; }
    }
  }
  // the tip of a region and how far it is from where the body alone would put it (for the report)
  apex(r) { const c = this.chains.find(c => c.r === r); return c ? c.apex : -1; }
  chainState() { return this.chains.map(c => ({ name: c.name, tip: c.joints[c.joints.length - 1].pos.clone(), anim: c.joints[c.joints.length - 1].anim.clone() })); }
  // for Unreal (Kawaii Physics, which works the same way): the bones to add, the skin weights, the settings
  softBones() {
    const bones = [], weights = {};
    for (const c of this.chains) {
      const i = c.apex, base = [0, 1, 2].map(a => this.leanBind[i * 3 + a]), tip = [0, 1, 2].map(a => this.outerBind[i * 3 + a]);
      const id = c.name.replace(/\s+/g, "_").toLowerCase();
      let parent = c.anchor;
      bones.push({ name: `soft_${id}_root`, parent, bind_cm: base.map(v => +v.toFixed(2)) });
      parent = `soft_${id}_root`;
      c.joints.forEach((j, k) => {
        const p = base.map((b, a) => b + (tip[a] - b) * j.f);
        bones.push({ name: `soft_${id}_${k + 1}`, parent, bind_cm: p.map(v => +v.toFixed(2)), radius_cm: +(j.radius * 100).toFixed(1) });
        parent = `soft_${id}_${k + 1}`;
      });
      const wl = []; for (let v = 0; v < this.N; v++) { const ww = c.w[v] * this.jig[v]; if (ww > 0.01) wl.push([v, +Math.min(1, ww).toFixed(3)]); }   // with the painted jiggle
      weights[id] = wl;
    }
    return {
      units: "cm, MHR bind space (Y up); point index = the welded MHR vertex (positions in points)",
      note: "Add the bones under their parents; give each region's points its weights on soft_<region>_root (taken from the bones they had); drive the chains with Kawaii Physics, whose Damping, Stiffness, radius, limit angle and limits mean what ours do (per 60 Hz tick). Squash: scale the root bone by the chain length ratio along it, 1/sqrt across (docs/FLESH.md §5).",
      material: this.mat, jiggle: this.jiggle, amount: this.amount, bones, weights,
      points: Array.from({ length: this.N }, (_, v) => [0, 1, 2].map(a => +this.outerBind[v * 3 + a].toFixed(2))),
    };
  }
}
