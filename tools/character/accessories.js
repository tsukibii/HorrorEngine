// accessories.js: what a character wears on the face and the neck (Character Studio, Accessories tab): glasses,
// piercings, stickers, an eyepatch, a choker. Made in code, no models: glasses from the eyes and the face's own
// points, a piercing or a sticker held to the skin where it sits (a triangle of MHR's mesh and a place in it), so it
// follows every shape and expression, a choker round the neck as it is. Each is a few plain settings in the
// character's file (st.accessories): the character stays editable, nothing here is baked.
import * as THREE from "three";

export const KINDS = {
  glasses: { label: "Glasses", styles: ["round", "square", "cat-eye", "aviator", "rimless", "sunglasses"] },
  piercing: { label: "Piercing", styles: ["stud", "gem", "ring", "hoop", "barbell", "spike"] },
  sticker: { label: "Sticker", styles: ["heart", "star", "bandage", "tear", "sparkle", "moon", "flower", "beauty mark", "gem"] },
  patch: { label: "Eyepatch", styles: ["eyepatch"] },
  neck: { label: "Neck", styles: ["choker", "chain"] },
};
// where a piercing or a sticker goes without clicking: a MediaPipe point on the face, or (the ears, which MediaPipe
// hasn't got) a point on MHR's own base mesh, found once as the nearest place on it
export const SPOTS = {
  "left earlobe": { mesh: [0.083, 1.581, 0.022] }, "right earlobe": { mesh: [-0.083, 1.581, 0.022] },   // the ear's outer rim, low and high
  "left upper ear": { mesh: [0.087, 1.621, 0.016] }, "right upper ear": { mesh: [-0.087, 1.621, 0.016] },
  "left nostril": { lm: 358 }, "right nostril": { lm: 129 }, "septum": { lm: 2 },
  "labret": { lm: 18 }, "left lip (Monroe)": { lm: 267 }, "right lip (Madonna)": { lm: 37 },
  "left brow": { lm: 293 }, "right brow": { lm: 63 }, "bridge": { lm: 168 },
  "left cheek": { lm: 425 }, "right cheek": { lm: 205 }, "under the left eye": { lm: 450 }, "under the right eye": { lm: 230 },
  "forehead": { lm: 151 }, "left temple": { lm: 251 }, "right temple": { lm: 21 }, "chin": { lm: 175 },
  "left eye": { lm: 386 }, "right eye": { lm: 159 },
};
export const DEFAULTS = {
  glasses: { style: "round", colour: "#1d1b1a", metal: 0.2, lens: "#9fb3c8", tint: 0.12, size: 1, height: 0, forward: 0, thick: 1 },
  piercing: { style: "stud", spot: "left earlobe", colour: "#d8d8dc", gem: "#e8f4ff", size: 1, turn: 0 },
  sticker: { style: "heart", spot: "under the left eye", colour: "#ff5c8a", size: 1, turn: 0, shine: 0.3 },
  patch: { style: "eyepatch", spot: "right eye", colour: "#141414", size: 1, turn: 0, shine: 0.1, strap: true },
  neck: { style: "choker", colour: "#151515", size: 1, height: 0.5 },
};
const LENS = { round: [1, 0.84, 2.2], square: [1.04, 0.74, 5], "cat-eye": [1.06, 0.72, 3], aviator: [1.08, 0.9, 2.4], rimless: [1, 0.74, 3.5], sunglasses: [1.12, 0.82, 3] };

export function fresh(kind, style) {
  const a = { id: "a" + Math.random().toString(36).slice(2, 8), kind, ...DEFAULTS[kind], ...(style ? { style } : {}) };
  if (style === "sunglasses") Object.assign(a, { lens: "#1c1c1e", tint: 0.85 });
  if (style === "gem" && kind === "sticker") a.colour = "#7fd8ff";
  if (style === "beauty mark") a.spot = "left lip (Monroe)";
  if (style === "bandage") Object.assign(a, { colour: "#e8c9a8", spot: "right cheek" });
  return a;
}

// ---- stickers: drawn on a canvas, laid on the skin -------------------------------------------------------------------
const TEX = {};
function stickerTexture(style, colour) {
  const key = style + colour;
  if (TEX[key]) return TEX[key];
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), col = new THREE.Color(colour), dark = "#" + col.clone().multiplyScalar(0.55).getHexString(), lite = "#" + col.clone().lerp(new THREE.Color(1, 1, 1), 0.55).getHexString();
  g.translate(128, 128);
  const fill = (path, glossy = true) => {
    const gr = g.createLinearGradient(-90, -90, 90, 90); gr.addColorStop(0, lite); gr.addColorStop(0.45, colour); gr.addColorStop(1, dark);
    g.fillStyle = glossy ? gr : colour; path(); g.fill();
    g.lineWidth = 5; g.strokeStyle = "rgba(255,255,255,0.85)"; path(); g.stroke();   // a sticker's white cut edge
  };
  const poly = pts => () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  const star = (n, r0, r1) => poly(Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r1 : r0; return [Math.cos(a) * r, Math.sin(a) * r]; }));
  if (style === "heart") fill(() => { g.beginPath(); g.moveTo(0, 95); g.bezierCurveTo(-120, 10, -95, -95, 0, -45); g.bezierCurveTo(95, -95, 120, 10, 0, 95); g.closePath(); });
  else if (style === "star") fill(star(5, 112, 48));
  else if (style === "sparkle") fill(star(4, 118, 28));
  else if (style === "tear") fill(() => { g.beginPath(); g.moveTo(0, -110); g.bezierCurveTo(30, -50, 72, 0, 70, 38); g.arc(0, 38, 70, 0, Math.PI); g.bezierCurveTo(-72, 0, -30, -50, 0, -110); g.closePath(); });
  else if (style === "moon") fill(() => { g.beginPath(); g.arc(0, 0, 100, 0.25 * Math.PI, 1.75 * Math.PI, false); g.arc(38, -10, 82, 1.62 * Math.PI, 0.42 * Math.PI, true); g.closePath(); });
  else if (style === "flower") { for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5; fill(() => { g.beginPath(); g.arc(Math.cos(a) * 58, Math.sin(a) * 58, 50, 0, 2 * Math.PI); }); }
    g.fillStyle = "#ffd96a"; g.beginPath(); g.arc(0, 0, 36, 0, 2 * Math.PI); g.fill(); }
  else if (style === "beauty mark") { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60); gr.addColorStop(0, "#2a1810"); gr.addColorStop(0.7, "rgba(42,24,16,0.85)"); gr.addColorStop(1, "rgba(42,24,16,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 60, 0, 2 * Math.PI); g.fill(); }
  else if (style === "gem") { fill(poly([[0, -110], [80, -30], [0, 110], [-80, -30]]));
    g.fillStyle = "rgba(255,255,255,0.55)"; poly([[0, -110], [80, -30], [0, -10], [-80, -30]])(); g.fill(); }
  else if (style === "bandage") { const r = (x, y, w, h, k) => () => { g.beginPath(); g.roundRect(x, y, w, h, k); };
    g.fillStyle = "#e8c9a8"; r(-118, -44, 236, 88, 40)(); g.fill(); g.fillStyle = "#f4e6d4"; r(-44, -34, 88, 68, 10)(); g.fill();
    g.fillStyle = "rgba(150,110,80,0.5)"; for (let x = -100; x <= 100; x += 18) for (const y of [-26, 0, 26]) if (Math.abs(x) > 52) { g.beginPath(); g.arc(x, y, 3, 0, 2 * Math.PI); g.fill(); } }
  else if (style === "eyepatch") { g.fillStyle = colour; g.beginPath(); g.ellipse(0, 0, 118, 92, 0, 0, 2 * Math.PI); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 104, 80, 0, 0, 2 * Math.PI); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TEX[key] = t);
}

// ---- the set of accessories on one character --------------------------------------------------------------------------
export class Accessories {
  // ctx: { rig, POS, TRIS, BASEP, normals(): the smooth normals now, lmk(i), LMK ({tri, bary}), scale(): metres per
  // MHR unit, eyes: {L, R} (the eyeballs, centres and sizes in the rig's space) }
  constructor(ctx) {
    this.c = ctx; this.list = []; this.made = new Map(); this.group = new THREE.Group(); ctx.rig.add(this.group);
  }
  set(list) { this.list = list; for (const id of [...this.made.keys()]) if (!list.find(a => a.id === id)) this.drop(id); for (const a of list) this.rebuild(a); this.update(); }
  drop(id) { const m = this.made.get(id); if (!m) return; this.group.remove(m.obj); m.obj.traverse(o => { o.geometry?.dispose(); }); this.made.delete(id); }
  rebuild(a) { this.drop(a.id); const obj = new THREE.Group(); obj.name = "acc_" + a.id; this.group.add(obj); this.made.set(a.id, { obj, a, bind: null }); }

  // a place on the skin: {tri, bary}; its point and normal on the body as it is now
  anchorOf(a) {
    if (a.at) return a.at;
    const s = SPOTS[a.spot] || SPOTS[DEFAULTS[a.kind]?.spot];
    if (!s) return null;
    if (s.lm !== undefined && this.c.LMK) return { tri: this.c.LMK.tri[s.lm], bary: [...this.c.LMK.bary[s.lm]] };
    if (s.mesh) return (s.found ||= nearestOn(this.c.BASEP, this.c.TRIS, s.mesh));
    return null;
  }
  point(at) { const P = this.c.POS, T = this.c.TRIS, o = [0, 0, 0]; for (let k = 0; k < 3; k++) { const v = T[at.tri * 3 + k] * 3; for (let i = 0; i < 3; i++) o[i] += at.bary[k] * P[v + i]; } return new THREE.Vector3(...o); }
  normal(at) { const N = this.c.normals(), T = this.c.TRIS, o = [0, 0, 0]; for (let k = 0; k < 3; k++) { const v = T[at.tri * 3 + k] * 3; for (let i = 0; i < 3; i++) o[i] += at.bary[k] * N[v + i]; } return new THREE.Vector3(...o).normalize(); }
  faceFrame() {                                       // the face's right, up and forward, from its own points
    const L = i => new THREE.Vector3(...this.c.lmk(i));
    const right = L(263).sub(L(33)).normalize(), up = L(10).sub(L(152)), fwd = new THREE.Vector3().crossVectors(right, up).normalize();
    up.crossVectors(fwd, right).normalize();
    return { right, up, fwd, L };
  }
  // a click on the body: where it hit (a triangle of MHR's mesh) becomes the accessory's place
  placeAt(a, tri, point) {
    const T = this.c.TRIS, P = this.c.POS, v = k => new THREE.Vector3(P[T[tri * 3 + k] * 3], P[T[tri * 3 + k] * 3 + 1], P[T[tri * 3 + k] * 3 + 2]);
    a.at = { tri, bary: bary(point, v(0), v(1), v(2)) }; a.spot = "where you clicked";
    const m = this.made.get(a.id); if (m) m.bind = null;
    this.update();
  }

  update() {
    if (!this.c.LMK) return;
    for (const a of this.list) {
      const m = this.made.get(a.id); if (!m) continue;
      try { this["draw_" + a.kind](a, m); } catch (e) { console.warn("accessory", a.kind, e); }
    }
  }
  clear(m) { for (const o of [...m.obj.children]) { m.obj.remove(o); o.geometry?.dispose(); } }

  // ---- glasses: lenses round the eyes, a bridge over the nose, the temples back to the ears ----------------------------
  draw_glasses(a, m) {
    this.clear(m);
    const { right, up, fwd, L } = this.faceFrame(), mm = 0.001 * this.c.scale(), E = this.c.eyes;
    const eye = s => new THREE.Vector3().copy(E[s].position).addScaledVector(fwd, E[s].scale.x);   // the cornea's front
    const ipd = eye("L").distanceTo(eye("R")), [kw, kh, n] = LENS[a.style] || LENS.round;
    const w = ipd * 0.37 * kw * a.size, h = ipd * 0.37 * kh * a.size, gap = 13 * mm + a.forward * mm;   // a lens about 47 mm wide on a 63 mm IPD
    const rad = (a.style === "rimless" ? 0.6 : 1.3) * a.thick * mm;
    const frame = new THREE.MeshPhysicalMaterial({ color: a.colour, metalness: a.metal, roughness: a.metal > 0.5 ? 0.3 : 0.22, clearcoat: a.metal > 0.5 ? 0 : 1, clearcoatRoughness: 0.15 });
    const glass = new THREE.MeshPhysicalMaterial({ color: a.lens, metalness: 0, roughness: 0.05, transparent: true, opacity: a.style === "sunglasses" ? Math.max(0.75, a.tint) : a.tint,
                                                    clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 });
    const outline = side => {                         // a lens's rim: a superellipse (cat-eye lifted outward, aviator dropped inward)
      const s = side === "L" ? 1 : -1, c = eye(side).addScaledVector(fwd, gap).addScaledVector(up, a.height * mm), pts = [];
      for (let i = 0; i < 64; i++) {
        const t = i / 64 * 2 * Math.PI, cx = Math.cos(t), cy = Math.sin(t);
        let x = Math.sign(cx) * Math.abs(cx) ** (2 / n), y = Math.sign(cy) * Math.abs(cy) ** (2 / n);
        if (a.style === "cat-eye" && y > 0) y += 0.35 * Math.max(0, x) ** 2;          // the outer top corner up
        if (a.style === "aviator" && y < 0) { y *= 1.15; x -= 0.18 * (1 + y) * (1 - Math.abs(y)); }   // a teardrop toward the nose
        const p = c.clone().addScaledVector(right, s * x * w).addScaledVector(up, y * h).addScaledVector(fwd, -(x > 0 ? 0.12 : 0.03) * x * x * w);   // wrapping back toward the temples
        pts.push(p);
      }
      return { pts, c, s };
    };
    const tube = (pts, r, closed = false) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), closed ? 96 : 32, r, 8, closed), frame);
    const sides = { L: outline("L"), R: outline("R") };
    for (const o of Object.values(sides)) {
      if (a.style !== "rimless") m.obj.add(tube(o.pts, rad, true));
      const lens = new THREE.BufferGeometry(), pos = [o.c.x, o.c.y, o.c.z], idx = [];   // the lens: a fan, bulged a little forward
      o.pts.forEach(p => pos.push(...p.clone().addScaledVector(fwd, -0.4 * mm).toArray()));
      for (let i = 0; i < 64; i++) idx.push(0, 1 + i, 1 + (i + 1) % 64);
      pos[0] += fwd.x * 1.5 * mm; pos[1] += fwd.y * 1.5 * mm; pos[2] += fwd.z * 1.5 * mm;
      lens.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); lens.setIndex(idx); lens.computeVertexNormals();
      const lm = new THREE.Mesh(lens, glass); lm.renderOrder = 6; m.obj.add(lm);
    }
    const inner = o => o.pts.reduce((b, p) => (o.s * p.clone().sub(o.c).dot(right) < o.s * b.clone().sub(o.c).dot(right) ? p : b));
    const outer = o => o.pts.reduce((b, p) => (o.s * p.clone().sub(o.c).dot(right) > o.s * b.clone().sub(o.c).dot(right) ? p : b));
    const iL = inner(sides.L), iR = inner(sides.R), top = L(168).addScaledVector(fwd, 5 * mm).addScaledVector(up, a.height * mm + 2 * mm);
    m.obj.add(tube([iR.clone().addScaledVector(up, h * 0.25), top, iL.clone().addScaledVector(up, h * 0.25)], rad * 0.9));
    for (const side of ["L", "R"]) {                  // the temples: from the hinge back over the ear, bending down behind it
      const o = sides[side], hinge = outer(o).clone().addScaledVector(up, h * 0.3);
      const ear = L(side === "L" ? 454 : 234).addScaledVector(right, o.s * 4 * mm).addScaledVector(up, (hinge.clone().sub(L(side === "L" ? 454 : 234)).dot(up)) * 0.9);
      const back = ear.clone().addScaledVector(fwd, -22 * mm), down = back.clone().addScaledVector(fwd, -10 * mm).addScaledVector(up, -16 * mm).addScaledVector(right, -o.s * 3 * mm);
      m.obj.add(tube([hinge, hinge.clone().addScaledVector(fwd, -8 * mm).addScaledVector(right, o.s * 3 * mm), ear, back, down], rad * 0.8));
    }
  }

  // ---- piercings: a stud, a gem, a ring or hoop through the skin, a barbell, a spike -----------------------------------
  draw_piercing(a, m) {
    this.clear(m);
    const at = this.anchorOf(a); if (!at) return;
    const mm = 0.001 * this.c.scale(), p = this.point(at), n = this.normal(at), { up } = this.faceFrame();
    const metal = new THREE.MeshStandardMaterial({ color: a.colour, metalness: 1, roughness: 0.22 });
    const t = new THREE.Vector3().crossVectors(up, n).normalize(); if (t.lengthSq() < 0.5) t.set(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(n, t).normalize();   // up along the skin
    t.applyAxisAngle(n, (a.turn || 0) * Math.PI / 180); u.applyAxisAngle(n, (a.turn || 0) * Math.PI / 180);
    const put = (geo, mat, at, quat) => { const o = new THREE.Mesh(geo, mat); o.position.copy(at); if (quat) o.quaternion.copy(quat); m.obj.add(o); return o; };
    const k = a.size, basis = new THREE.Matrix4().makeBasis(t, u, n), q = new THREE.Quaternion().setFromRotationMatrix(basis);
    if (a.style === "stud") put(new THREE.SphereGeometry(1.6 * mm * k, 16, 12), metal, p.clone().addScaledVector(n, 0.9 * mm * k));
    else if (a.style === "gem") {
      put(new THREE.CylinderGeometry(1.9 * mm * k, 1.9 * mm * k, 0.8 * mm, 16).rotateX(Math.PI / 2), metal, p.clone().addScaledVector(n, 0.4 * mm), q);
      put(new THREE.OctahedronGeometry(1.7 * mm * k, 0).scale(1, 1, 0.6), new THREE.MeshPhysicalMaterial({ color: a.gem, metalness: 0.1, roughness: 0.02, clearcoat: 1, iridescence: 0.6, envMapIntensity: 2.5 }), p.clone().addScaledVector(n, 1.4 * mm * k), q);
    } else if (a.style === "ring" || a.style === "hoop") {   // through the skin at its top, hanging below it, in the plane of the normal and the skin's up
      const R = (a.style === "hoop" ? 7.5 : 4) * mm * k, tube = (a.style === "hoop" ? 0.55 : 0.7) * mm * k;
      const ring = put(new THREE.TorusGeometry(R, tube, 10, 48), metal, p.clone().addScaledVector(u, -R + tube).addScaledVector(n, 0.2 * mm));
      ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(n, u, t));
    } else if (a.style === "barbell") {               // a bar along the skin's up, a ball at each end
      const L2 = 6 * mm * k;
      put(new THREE.CylinderGeometry(0.5 * mm, 0.5 * mm, L2, 8), metal, p.clone().addScaledVector(n, 0.8 * mm), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u));
      for (const s of [-1, 1]) put(new THREE.SphereGeometry(1.3 * mm * k, 12, 10), metal, p.clone().addScaledVector(u, s * L2 / 2).addScaledVector(n, 1.2 * mm));
    } else if (a.style === "spike") put(new THREE.ConeGeometry(1.5 * mm * k, 5 * mm * k, 16), metal, p.clone().addScaledVector(n, 2.5 * mm * k), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
  }

  // ---- stickers (and the eyepatch): a small sheet held to the skin, a grid of places on it found once ----------------
  draw_sticker(a, m) { this.sheet(a, m, 14 * a.size); }
  draw_patch(a, m) {
    if (m.strap) { m.obj.remove(m.strap); m.strap.geometry.dispose(); m.strap = null; }
    this.sheet(a, m, 46 * a.size, 1.4);
    const at = this.anchorOf(a); if (!a.strap || !at) return;
    // the strap: from the patch's outer edge back over its own ear, round the back of the head, up over the far ear and
    // down across the forehead to the patch's inner edge, on the skin all the way (the head's outline at each height)
    const { right, up, fwd } = this.faceFrame(), mm = 0.001 * this.c.scale(), p = this.point(at), H = this.headMap(p.y - 25 * mm, p.y + 70 * mm);
    const ang = v => Math.atan2(v.clone().sub(H.c).dot(right), v.clone().sub(H.c).dot(fwd));   // 0 ahead, + toward the character's left
    const s = Math.sign(p.clone().sub(H.c).dot(right)) || 1, phiP = ang(p), half = 0.75 * 23 * a.size * 1.4 * mm / Math.max(1e-6, H.r(phiP, p.y)), dy = y => y - p.y;
    const out = phiP + s * half, inn = phiP - s * half, D = Math.PI / 180;
    const keys = [[out, 0], [s * 100 * D, 8 * mm], [s * 180 * D, 14 * mm], [-s * 95 * D, 38 * mm], [-s * 25 * D, 30 * mm], [inn + (s > 0 ? -2 * Math.PI : 2 * Math.PI), 8 * mm]];
    for (let i = 1; i < keys.length; i++) while (s * (keys[i][0] - keys[i - 1][0]) < 0) keys[i][0] += s * 2 * Math.PI;   // one way round, through the back
    const pts = [], n = 40, total = keys[keys.length - 1][0] - keys[0][0];
    for (let i = 0; i <= n; i++) {
      const phi = keys[0][0] + total * i / n;
      let k = 0; while (k < keys.length - 2 && s * (phi - keys[k + 1][0]) > 0) k++;
      const [p0, h0] = keys[k], [p1, h1] = keys[k + 1], t = Math.min(1, Math.max(0, (phi - p0) / (p1 - p0 || 1))), y = p.y + h0 + (h1 - h0) * (t * t * (3 - 2 * t));
      const r = H.r(phi, y) + 1.4 * mm;
      pts.push(H.c.clone().setY(y).addScaledVector(fwd, Math.cos(phi) * r).addScaledVector(right, Math.sin(phi) * r));
    }
    m.strap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false), 96, 1.1 * mm, 6, false), new THREE.MeshStandardMaterial({ color: a.colour, roughness: 0.8 }));
    m.obj.add(m.strap);
  }
  // the head's (or the neck's) outline between two heights: the outermost skin by angle round its own middle, in
  // slabs. From the triangles cut by each slab's plane, not the points (MHR's back of the head has few points, far
  // apart: an outline from points would cut through the skull). r(phi, y): the radius there (phi 0 ahead, + toward
  // the character's left); side, depth: how far from the face's middle line to look (m), so the shoulders stay out
  headMap(y0, y1, side = 0.11, depth = 0.17) {
    const { right, fwd, L } = this.faceFrame(), P = this.c.POS, T = this.c.TRIS, k = this.c.scale(), mm = 0.001 * k;
    const step = 5 * mm, S = Math.max(2, Math.ceil((y1 - y0) / step) + 1), B = 72, R = new Float32Array(S * B);
    const guess = L(234).add(L(454)).multiplyScalar(0.5).addScaledVector(fwd, -30 * mm);
    const loc = i => { const dx = P[i] - guess.x, dz = P[i + 2] - guess.z; return [dx * right.x + dz * right.z, dx * fwd.x + dz * fwd.z]; };   // sideways, ahead
    const tris = [];                                   // the triangles in reach, between the heights
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, lo = Math.min(P[a + 1], P[b + 1], P[c + 1]), hi = Math.max(P[a + 1], P[b + 1], P[c + 1]);
      if (hi < y0 - step || lo > y1 + step) continue;
      const m = [a, b, c].map(loc), mx = (m[0][0] + m[1][0] + m[2][0]) / 3, mz = (m[0][1] + m[1][1] + m[2][1]) / 3;
      if (Math.abs(mx) > side * k || Math.abs(mz) > depth * k) continue;
      tris.push(a, b, c);
      for (const [x, z] of m) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, c = guess.clone().addScaledVector(right, cx).addScaledVector(fwd, cz);
    const put = (sl, x, z) => { const a = x - cx, b = z - cz, bin = Math.round((Math.atan2(a, b) / (2 * Math.PI) + 1) * B) % B, kk = sl * B + bin; R[kk] = Math.max(R[kk], Math.hypot(a, b)); };
    for (let sl = 0; sl < S; sl++) {
      const y = y0 + sl * step;
      for (let t = 0; t < tris.length; t += 3) {      // where the plane at y cuts the triangle: a segment, sampled every 2 mm
        const v = [tris[t], tris[t + 1], tris[t + 2]], cut = [];
        for (let e = 0; e < 3; e++) {
          const p = v[e], q = v[(e + 1) % 3], yp = P[p + 1], yq = P[q + 1];
          if ((yp - y) * (yq - y) > 0 || yp === yq) continue;
          const f = (y - yp) / (yq - yp), lp = loc(p), lq = loc(q);
          cut.push([lp[0] + (lq[0] - lp[0]) * f, lp[1] + (lq[1] - lp[1]) * f]);
        }
        if (cut.length < 2) continue;
        const [[ax, az], [bx, bz]] = cut, n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (2 * mm)));
        for (let i = 0; i <= n; i++) put(sl, ax + (bx - ax) * i / n, az + (bz - az) * i / n);
      }
    }
    for (let sl = 0; sl < S; sl++) for (let pass = 0; pass < 4; pass++) for (let b = 0; b < B; b++) {   // gaps from the neighbours
      const kk = sl * B + b; if (R[kk]) continue;
      const l = R[sl * B + (b + B - 1) % B], r = R[sl * B + (b + 1) % B]; R[kk] = l && r ? (l + r) / 2 : l || r || (sl ? R[(sl - 1) * B + b] : 0);
    }
    const r = (phi, y) => {
      const fs = Math.min(S - 1, Math.max(0, (y - y0) / step)), s0 = Math.floor(fs), s1 = Math.min(S - 1, s0 + 1), ts = fs - s0;
      const fb = ((phi / (2 * Math.PI) % 1 + 1) % 1) * B, b0 = Math.floor(fb) % B, b1 = (b0 + 1) % B, tb = fb - Math.floor(fb);
      const at = (sl, b) => R[sl * B + b] || 60 * mm;
      return (at(s0, b0) * (1 - tb) + at(s0, b1) * tb) * (1 - ts) + (at(s1, b0) * (1 - tb) + at(s1, b1) * tb) * ts;
    };
    c.y = (y0 + y1) / 2;
    return { c, r };
  }
  sheet(a, m, sizeMm, aspect = 1) {
    const at = this.anchorOf(a); if (!at) { this.clear(m); return; }
    const mm = 0.001 * this.c.scale(), G = 11;
    const key = JSON.stringify([at, sizeMm, a.turn || 0, aspect, a.style]);
    if (!m.bind || m.key !== key) {                   // its grid laid on the skin as it is now, each place kept as (triangle, where in it)
      const p = this.point(at), n = this.normal(at), { up } = this.faceFrame();
      const t = new THREE.Vector3().crossVectors(up, n).normalize(), u = new THREE.Vector3().crossVectors(n, t).normalize();
      t.applyAxisAngle(n, (a.turn || 0) * Math.PI / 180); u.applyAxisAngle(n, (a.turn || 0) * Math.PI / 180);
      const W = sizeMm * mm * aspect, H = sizeMm * mm, near = trianglesNear(this.c.POS, this.c.TRIS, p, Math.max(W, H) + 6 * mm);
      m.bind = []; m.key = key;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const q = p.clone().addScaledVector(t, (i / (G - 1) - 0.5) * W).addScaledVector(u, (j / (G - 1) - 0.5) * H);
        m.bind.push(nearestIn(this.c.POS, this.c.TRIS, near, q));
      }
      this.clear(m); m.strap = null;
      const geo = new THREE.BufferGeometry(), uv = [], idx = [];
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) uv.push(i / (G - 1), j / (G - 1));
      for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) { const k = j * G + i; idx.push(k, k + 1, k + G, k + 1, k + G + 1, k + G); }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(G * G * 3), 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      const mat = new THREE.MeshStandardMaterial({ map: stickerTexture(a.style, a.colour), transparent: true, alphaTest: 0.03, roughness: 1 - 0.85 * (a.shine ?? 0.3), metalness: 0,
                                                   polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const sh = new THREE.Mesh(geo, mat); sh.renderOrder = 5; sh.frustumCulled = false; m.obj.add(sh);
    }
    const sh = m.obj.children.find(o => o.renderOrder === 5), P = sh.geometry.attributes.position.array;
    m.bind.forEach((b, k) => { const q = this.point(b).addScaledVector(this.normal(b), 0.25 * mm); P[k * 3] = q.x; P[k * 3 + 1] = q.y; P[k * 3 + 2] = q.z; });
    sh.geometry.attributes.position.needsUpdate = true; sh.geometry.computeVertexNormals();
  }

  // ---- the neck: a choker or a chain round the neck as it is, at a height between the chin and the collarbone -------
  draw_neck(a, m) {
    this.clear(m);
    const { right, up, fwd, L } = this.faceFrame(), mm = 0.001 * this.c.scale();
    // round the neck in a tilted plane, as a choker sits: low at the throat, higher at the back (the neck leans forward)
    const yF = L(152).y - (24 + 30 * (a.height ?? 0.5)) * mm, yB = yF + 26 * mm, H = this.headMap(yF - 4 * mm, yB + 4 * mm, 0.078, 0.16), ring = [];
    for (let b = 0; b < 72; b++) {
      const phi = b / 72 * 2 * Math.PI, y = yF + (yB - yF) * (1 - Math.cos(phi)) / 2, r = H.r(phi, y) + 1.6 * mm;
      ring.push(H.c.clone().setY(y).addScaledVector(fwd, Math.cos(phi) * r).addScaledVector(right, Math.sin(phi) * r));
    }
    const chain = a.style === "chain", mat = chain ? new THREE.MeshStandardMaterial({ color: a.colour === DEFAULTS.neck.colour ? "#d4af37" : a.colour, metalness: 1, roughness: 0.25 })
                                                    : new THREE.MeshStandardMaterial({ color: a.colour, roughness: 0.55 });
    const geo = chain ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 144, 0.9 * mm * a.size, 8, true)
                      : bandAround(ring, up, 12 * mm * a.size, 1.2 * mm);
    m.obj.add(new THREE.Mesh(geo, mat));
  }
}

// ---- geometry helpers -----------------------------------------------------------------------------------------------
function bary(p, a, b, c) {                           // barycentric coordinates of p's projection onto the triangle
  const v0 = b.clone().sub(a), v1 = c.clone().sub(a), v2 = p.clone().sub(a);
  const d00 = v0.dot(v0), d01 = v0.dot(v1), d11 = v1.dot(v1), d20 = v2.dot(v0), d21 = v2.dot(v1), den = d00 * d11 - d01 * d01 || 1e-12;
  const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
  return [1 - v - w, v, w];
}
function closestOnTri(p, a, b, c) {                   // the closest point of a triangle to p, as barycentric coordinates
  let [u, v, w] = bary(p, a, b, c);
  if (u >= 0 && v >= 0 && w >= 0) return [u, v, w];
  const seg = (x, y) => { const d = y.clone().sub(x), t = Math.min(1, Math.max(0, p.clone().sub(x).dot(d) / (d.lengthSq() || 1e-12))); return [x.clone().addScaledVector(d, t), t]; };
  const cands = [[seg(a, b), t => [1 - t, t, 0]], [seg(b, c), t => [0, 1 - t, t]], [seg(c, a), t => [t, 0, 1 - t]]];
  let best = null, bd = Infinity;
  for (const [[q, t], f] of cands) { const d = q.distanceToSquared(p); if (d < bd) { bd = d; best = f(t); } }
  return best;
}
function triVerts(P, T, t) { return [0, 1, 2].map(k => { const v = T[t * 3 + k] * 3; return new THREE.Vector3(P[v], P[v + 1], P[v + 2]); }); }
function trianglesNear(P, T, p, r) {
  const out = [], r2 = r * r;
  for (let t = 0; t < T.length / 3; t++) for (let k = 0; k < 3; k++) { const v = T[t * 3 + k] * 3, dx = P[v] - p.x, dy = P[v + 1] - p.y, dz = P[v + 2] - p.z; if (dx * dx + dy * dy + dz * dz < r2) { out.push(t); break; } }
  return out;
}
function nearestIn(P, T, tris, q) {
  let best = null, bd = Infinity;
  for (const t of tris) {
    const [a, b, c] = triVerts(P, T, t), w = closestOnTri(q, a, b, c), x = a.clone().multiplyScalar(w[0]).addScaledVector(b, w[1]).addScaledVector(c, w[2]), d = x.distanceToSquared(q);
    if (d < bd) { bd = d; best = { tri: t, bary: w }; }
  }
  return best;
}
export function nearestOn(P, T, xyz) {               // the nearest place on a mesh to a point: {tri, bary}
  const q = new THREE.Vector3(...xyz);
  let r = 0.01, tris = [];
  while (!tris.length && r < 0.2) { tris = trianglesNear(P, T, q, r); r *= 2; }
  return nearestIn(P, T, tris, q);
}
function bandAround(ring, up, h, thick) {             // a flat band through a closed ring of points, h tall, its outside out by thick
  const pos = [], idx = [], n = ring.length, c = ring.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
  for (let i = 0; i < n; i++) {
    const p = ring[i], out = p.clone().sub(c).setComponent(1, 0).normalize();
    for (const [dy, dr] of [[-h / 2, 0], [h / 2, 0], [h / 2, thick], [-h / 2, thick]]) pos.push(...p.clone().addScaledVector(up, dy).addScaledVector(out, dr).toArray());
  }
  for (let i = 0; i < n; i++) { const a = i * 4, b = ((i + 1) % n) * 4; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
