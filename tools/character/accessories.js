// accessories.js: what a character wears on the face, the head and the neck (Character Studio, Accessories tab): glasses,
// piercings, earrings, stickers, an eyepatch, necklaces, hats (a beret, a cap, a bucket hat, a beanie: made on the head's
// own outline, DECISIONS 2026-10-27, after the user's street-wear references). Made in code, no models: glasses from the eyes and the face's
// own points, a piercing, an earring or a sticker held to the skin where it sits (a triangle of MHR's mesh and a place
// in it), so it follows every shape and expression; earrings in pairs, hanging as gravity has them; a necklace dropped
// round the neck by gravity onto the body as it is (jewellery.js, which also makes the metals, gems, pearls and charms).
// Each is a few plain settings in the character's file (st.accessories): the character stays editable, nothing here
// is baked.
import * as THREE from "three";
import * as JW from "./jewellery.js";
export { JW };

export const KINDS = {
  glasses: { label: "Glasses", styles: ["round", "square", "cat-eye", "aviator", "rimless", "sunglasses", "heart"] },
  piercing: { label: "Piercing", styles: ["stud", "gem", "ring", "hoop", "nose hoop", "barbell", "spike"] },
  earring: { label: "Earrings", styles: ["stud", "pearl", "gem", "huggie", "hoop", "drop", "chain drop"] },
  sticker: { label: "Sticker", styles: ["heart", "star", "bandage", "tear", "sparkle", "moon", "flower", "beauty mark", "gem"] },
  patch: { label: "Eyepatch", styles: ["eyepatch"] },
  neck: { label: "Necklace", styles: ["chain", "pearls", "beads", "cord", "choker"] },
  hat: { label: "Hat", styles: ["beret", "cap", "bucket", "beanie"] },
  horns: { label: "Horns", styles: ["devil", "ram"] },
  ears: { label: "Ears (headband)", styles: ["bunny", "cat", "fox"] },
};
// every accessory can be moved and turned from where it's made (mm, degrees): ox, oy, oz along the face's right, up and
// forward, rx, ry, rz about them (the user, 2026-11-01: "make props more adjustable via an x,y,z slider")
export const PLACE = [["ox", "Right (mm)"], ["oy", "Up (mm)"], ["oz", "Forward (mm)"], ["rx", "Tip forward (°)"], ["ry", "Turn (°)"], ["rz", "Lean (°)"]];
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
// `material`: a metal by name (jewellery.js METALS), "colour" (the colour, as metal), or a PBR set off the shelf
// ("pbr/<name>"); glasses' "" keeps the frame's colour, plastic to metal by its slider
export const DEFAULTS = {
  glasses: { style: "round", colour: "#1d1b1a", metal: 0.2, material: "", lens: "#9fb3c8", tint: 0.12, size: 1, height: 0, forward: 0, thick: 1 },
  piercing: { style: "stud", spot: "left earlobe", material: "silver", colour: "#d8d8dc", shine: 0.75, gem: "#e8f4ff", size: 1, turn: 0 },
  earring: { style: "hoop", spot: "left earlobe", pair: true, material: "gold", colour: "#d8d8dc", shine: 0.8, gem: "#9ad7ff", charm: "pearl", size: 1, length: 16 },
  sticker: { style: "heart", spot: "under the left eye", colour: "#ff5c8a", size: 1, turn: 0, shine: 0.3 },
  patch: { style: "eyepatch", spot: "right eye", colour: "#141414", size: 1, turn: 0, shine: 0.1, strap: true },
  neck: { style: "chain", material: "gold", colour: "#151515", shine: 0.8, length: 45, ease: 0, size: 1, pendant: "none", gem: "#d4245a" },
  hat: { style: "beret", colour: "#141416", size: 1, tilt: 18, turn: 0, height: 0, shine: 0.1, material: "" },
  horns: { style: "devil", colour: "#1c1414", material: "", shine: 0.35, size: 1, spread: 1, curl: 1 },
  ears: { style: "bunny", colour: "#f2f0ec", inner: "#f2b6c6", band: "#18181a", material: "", shine: 0.1, size: 1, tilt: 0 },
};
const LENS = { round: [1, 0.84, 2.2], square: [1.04, 0.74, 5], "cat-eye": [1.06, 0.72, 3], aviator: [1.08, 0.9, 2.4], rimless: [1, 0.74, 3.5], sunglasses: [1.12, 0.82, 3], heart: [1.06, 0.98, 2] };

export function fresh(kind, style) {
  const a = { id: "a" + Math.random().toString(36).slice(2, 8), kind, ...DEFAULTS[kind], ...(style ? { style } : {}) };
  if (style === "sunglasses") Object.assign(a, { lens: "#1c1c1e", tint: 0.85 });
  if (style === "heart" && kind === "glasses") Object.assign(a, { colour: "#e2416c", lens: "#ff7aa2", tint: 0.5, metal: 0 });
  if (style === "gem" && kind === "sticker") a.colour = "#7fd8ff";
  if (style === "beauty mark") a.spot = "left lip (Monroe)";
  if (style === "bandage") Object.assign(a, { colour: "#e8c9a8", spot: "right cheek" });
  if (style === "nose hoop") a.spot = "left nostril";
  if (kind === "earring" && (style === "stud" || style === "pearl" || style === "gem")) a.material = "silver";
  if (kind === "neck" && style === "choker") Object.assign(a, { length: 0, colour: "#151515" });   // 0: as long as the neck is round, snug (worked out when it's first drawn)
  if (kind === "neck" && style === "pearls") a.length = 48;
  if (kind === "neck" && style === "cord") Object.assign(a, { colour: "#2a1d16", pendant: "coin", length: 50 });
  if (kind === "hat" && style !== "beret") a.tilt = 0;
  if (kind === "hat" && style === "bucket") a.colour = "#3a3528";
  if (kind === "hat" && style === "beanie") Object.assign(a, { colour: "#4a3a3a", shine: 0 });
  return a;
}
// a saved accessory with today's fields (an older file's choker had a height, its piercings a colour only)
export function normalize(a) {
  const b = { ...DEFAULTS[a.kind], ...a };
  if (a.kind === "piercing" && a.material === undefined && a.colour && a.colour !== DEFAULTS.piercing.colour) b.material = "colour";
  if (a.kind === "neck" && a.length === undefined) Object.assign(b, a.style === "choker" ? { length: 0 } : { material: a.colour && a.colour !== DEFAULTS.neck.colour ? "colour" : "gold" });
  return b;
}
const SIDE = { "left lip (Monroe)": "right lip (Madonna)", "right lip (Madonna)": "left lip (Monroe)" };
const mirrorSpot = s => SIDE[s] || (/\bleft\b/.test(s) ? s.replace(/\bleft\b/, "right") : /\bright\b/.test(s) ? s.replace(/\bright\b/, "left") : null);

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
  // MHR unit, eyes: {L, R} (the eyeballs, centres and sizes in the rig's space), shelf(): the PBR shelf's sets }
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
      try { this["draw_" + a.kind](a, m); this.place(a, m); } catch (e) { console.warn("accessory", a.kind, e); }
    }
  }
  // moved and turned from where it was made: along and about the face's right, up and forward, about its own middle
  place(a, m) {
    const o = m.obj; o.position.set(0, 0, 0); o.quaternion.identity();
    if (!(a.ox || a.oy || a.oz || a.rx || a.ry || a.rz) || !m.obj.children.length) return;
    const { right, up, fwd } = this.faceFrame(), mm = 0.001 * this.c.scale();
    const box = new THREE.Box3(); for (const ch of o.children) { ch.geometry.computeBoundingBox(); box.union(ch.geometry.boundingBox.clone().applyMatrix4(ch.matrix)); }
    const c = box.getCenter(new THREE.Vector3()), d = Math.PI / 180;
    const q = new THREE.Quaternion().setFromAxisAngle(right, (a.rx || 0) * d).premultiply(new THREE.Quaternion().setFromAxisAngle(up, (a.ry || 0) * d)).premultiply(new THREE.Quaternion().setFromAxisAngle(fwd, (a.rz || 0) * d));
    o.quaternion.copy(q);
    o.position.copy(c).sub(c.clone().applyQuaternion(q)).addScaledVector(right, (a.ox || 0) * mm).addScaledVector(up, (a.oy || 0) * mm).addScaledVector(fwd, (a.oz || 0) * mm);
  }
  // what a part that isn't jewellery is made of: its colour, or a PBR set off the shelf (or a metal by name)
  surfaceOf(a, colour, shine = a.shine ?? 0.2) {
    if (a.material && a.material !== "colour") return this.metalOf({ ...a, colour });
    return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.92 - 0.65 * shine, metalness: 0, side: THREE.DoubleSide });
  }
  // the head's measures from the face's own points: its middle (between the ears), width, the crown's height
  headFrame() {
    const f = this.faceFrame(), P = this.c.POS, eL = f.L(454), eR = f.L(234);
    let top = -1e9; for (let i = 1; i < P.length; i += 3) top = Math.max(top, P[i]);
    const c = eL.clone().add(eR).multiplyScalar(0.5);
    return { ...f, c, W: eL.distanceTo(eR), crown: top };
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
    const frame = a.material ? this.metalOf(a) : new THREE.MeshPhysicalMaterial({ color: a.colour, metalness: a.metal, roughness: a.metal > 0.5 ? 0.3 : 0.22, clearcoat: a.metal > 0.5 ? 0 : 1, clearcoatRoughness: 0.15 });
    const glass = new THREE.MeshPhysicalMaterial({ color: a.lens, metalness: 0, roughness: 0.05, transparent: true, opacity: a.style === "sunglasses" ? Math.max(0.75, a.tint) : a.tint,
                                                    clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 });
    const outline = side => {                         // a lens's rim: a superellipse (cat-eye lifted outward, aviator dropped inward)
      const s = side === "L" ? 1 : -1, c = eye(side).addScaledVector(fwd, gap).addScaledVector(up, a.height * mm), pts = [];
      for (let i = 0; i < 64; i++) {
        const t = i / 64 * 2 * Math.PI, cx = Math.cos(t), cy = Math.sin(t);
        let x = Math.sign(cx) * Math.abs(cx) ** (2 / n), y = Math.sign(cy) * Math.abs(cy) ** (2 / n);
        if (a.style === "heart") {                    // the heart curve, its lobes up (x -16..16, y -17..11.6), into -1..1
          const T = Math.PI / 2 - t; x = Math.sin(T) ** 3; y = (13 * Math.cos(T) - 5 * Math.cos(2 * T) - 2 * Math.cos(3 * T) - Math.cos(4 * T) + 2.7) / 14.3;
        }
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
    const mm = 0.001 * this.c.scale(), p = this.point(at), n = this.normal(at), { up, right, fwd } = this.faceFrame();
    const metal = this.metalOf(a);
    const t = new THREE.Vector3().crossVectors(up, n).normalize(); if (t.lengthSq() < 0.5) t.set(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(n, t).normalize();   // up along the skin
    t.applyAxisAngle(n, (a.turn || 0) * Math.PI / 180); u.applyAxisAngle(n, (a.turn || 0) * Math.PI / 180);
    const put = (geo, mat, at, quat) => { const o = new THREE.Mesh(geo, mat); o.position.copy(at); if (quat) o.quaternion.copy(quat); m.obj.add(o); return o; };
    const k = a.size, basis = new THREE.Matrix4().makeBasis(t, u, n), q = new THREE.Quaternion().setFromRotationMatrix(basis);
    if (a.style === "stud") put(new THREE.SphereGeometry(1.6 * mm * k, 16, 12), metal, p.clone().addScaledVector(n, 0.9 * mm * k));
    else if (a.style === "gem") {
      put(new THREE.CylinderGeometry(1.9 * mm * k, 1.9 * mm * k, 0.8 * mm, 16).rotateX(Math.PI / 2), metal, p.clone().addScaledVector(n, 0.4 * mm), q);
      put(new THREE.OctahedronGeometry(1.7 * mm * k, 0).scale(1, 1, 0.6), new THREE.MeshPhysicalMaterial({ color: a.gem, metalness: 0.1, roughness: 0.02, clearcoat: 1, iridescence: 0.6, envMapIntensity: 2.5 }), p.clone().addScaledVector(n, 1.4 * mm * k), q);
    } else if ((a.style === "ring" || a.style === "nose hoop") && a.spot === "septum" && !a.at) {   // through the septum, hanging under the nose, facing out
      const R = 5 * mm * k, tube = 0.7 * mm * k, hole = p.clone().addScaledVector(up, 4 * mm).addScaledVector(fwd, 1.5 * mm);
      const ring = put(new THREE.TorusGeometry(R, tube, 10, 48), metal, hole.clone().addScaledVector(up, -(R - tube)));
      ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
    } else if (a.style === "nose hoop") {             // through the nostril's wing, round its rim and back up inside: hugging, not standing out
      const d = up.clone().negate().addScaledVector(n, up.dot(n)).normalize(), R = 4.2 * mm * k, tube = 0.55 * mm * k;
      const ring = put(new THREE.TorusGeometry(R, tube, 10, 48), metal, p.clone().addScaledVector(d, R - 0.5 * mm).addScaledVector(n, -0.42 * R));
      ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, n, new THREE.Vector3().crossVectors(d, n)));
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

  // how far q is outside the skin (m; less than 0 inside): from the nearest of the triangles given, along its face's normal
  outside(q, tris) {
    let best = null, bd = Infinity;
    for (const t of tris) {
      const [a, b, c] = triVerts(this.c.POS, this.c.TRIS, t), w = closestOnTri(q, a, b, c), x = a.clone().multiplyScalar(w[0]).addScaledVector(b, w[1]).addScaledVector(c, w[2]), dist = x.distanceToSquared(q);
      if (dist < bd) { bd = dist; best = { x, N: new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize() }; }
    }
    return best ? q.clone().sub(best.x).dot(best.N) : Infinity;
  }
  // how far q is outside the skin (metres; inside it's negative), from the triangles within r of it
  skinGap(q, r = 0.02) { return this.outside(q, trianglesNear(this.c.POS, this.c.TRIS, q, r)); }
  // what a metal part is made of (jewellery.js): a metal by name, the colour as metal, or a set off the shelf
  metalOf(a) { return JW.metal(a.material && a.material !== "colour" ? a.material : null, a.colour, a.shine ?? 0.75, this.c.shelf ? this.c.shelf() : {}); }

  // ---- earrings: a pair (or one), through the lobe (or high on the rim), hanging as gravity has them -----------------
  draw_earring(a, m) {
    this.clear(m);
    const at = this.anchorOf(a); if (!at) return;
    this.earring(a, m, at);
    if (a.pair) { const twin = this.mirrorOf(a, m); if (twin) this.earring(a, m, twin); }
  }
  // the other ear's place: the named spot's twin, or the clicked place mirrored across the face's middle
  mirrorOf(a, m) {
    if (!a.at) { const sp = mirrorSpot(a.spot); return sp && SPOTS[sp] ? this.anchorOf({ kind: a.kind, spot: sp }) : null; }
    const key = JSON.stringify(a.at);
    if (m.twin?.key !== key) {
      const { right, L } = this.faceFrame(), p = this.point(a.at), mid = L(168);
      m.twin = { key, at: nearestOn(this.c.POS, this.c.TRIS, p.addScaledVector(right, -2 * p.clone().sub(mid).dot(right)).toArray()) };
    }
    return m.twin.at;
  }
  earring(a, m, at) {
    const mm = 0.001 * this.c.scale(), k = a.size, p = this.point(at), n = this.normal(at), down = new THREE.Vector3(0, -1, 0), metal = this.metalOf(a);
    const add = (geo, mat, pos, quat) => { const o = new THREE.Mesh(geo, mat); o.position.copy(pos); if (quat) o.quaternion.copy(quat); m.obj.add(o); return o; };
    const frame = (X, Y) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, new THREE.Vector3().crossVectors(X, Y)));
    const d = down.clone().addScaledVector(n, -down.dot(n)).normalize();   // down along the lobe: a hoop through it swings in the plane of d and n
    const out = n.clone().addScaledVector(down, -n.dot(down)).normalize();  // outward, level: what a hanging charm faces
    const up = new THREE.Vector3(0, 1, 0);
    if (a.style === "stud") add(new THREE.SphereGeometry(1.8 * mm * k, 16, 12), metal, p.clone().addScaledVector(n, 1.1 * mm * k));
    else if (a.style === "pearl") add(new THREE.SphereGeometry(3.6 * mm * k, 24, 16), JW.pearl(), p.clone().addScaledVector(n, 3.2 * mm * k));
    else if (a.style === "gem") {
      const q = frame(new THREE.Vector3().crossVectors(up, n).normalize(), up.clone().addScaledVector(n, -up.dot(n)).normalize());
      add(new THREE.CylinderGeometry(2.6 * mm * k, 2.6 * mm * k, 1 * mm, 20).rotateX(Math.PI / 2), metal, p.clone().addScaledVector(n, 0.5 * mm), q);
      add(new THREE.OctahedronGeometry(2.4 * mm * k, 0).scale(1, 1, 0.6), JW.gem(a.gem), p.clone().addScaledVector(n, 1.8 * mm * k), q);
    } else if (a.style === "huggie") {               // a small thick hoop hugging the lobe's edge
      const R = 5.2 * mm * k, r = 1.25 * mm * k;
      add(new THREE.TorusGeometry(R, r, 12, 48), metal, p.clone().addScaledVector(d, R - 1.5 * r).addScaledVector(n, R * 0.45), frame(d, n));
    } else if (a.style === "hoop") {                  // through the lobe, hanging; swung out about the hole as far as the jaw and neck push it
      const R = 13 * mm * k, r = 0.85 * mm * Math.sqrt(k), swing = al => [d.clone().multiplyScalar(Math.cos(al)).addScaledVector(n, Math.sin(al)), n.clone().multiplyScalar(Math.cos(al)).addScaledVector(d, -Math.sin(al))];
      const key = p.toArray().map(v => Math.round(v / mm)).join(",") + "|" + k;
      const sw = (this.swings ||= new Map()), id = at.tri + "|" + key;   // kept by where it hangs: a rebuild (anything added) doesn't search again
      if (!sw.has(id)) {                               // found once for where it hangs (an expression barely moves a lobe)
        const near = trianglesNear(this.c.POS, this.c.TRIS, p, 2 * R + 8 * mm);
        const clear = deg => {
          const [dd, nn] = swing(deg * Math.PI / 180), c = p.clone().addScaledVector(dd, R);
          for (let i = 0; i < 36; i++) {
            const th = i / 36 * 2 * Math.PI, q = c.clone().addScaledVector(dd, Math.cos(th) * R).addScaledVector(nn, Math.sin(th) * R);
            if (q.distanceTo(p) > 4 * mm && this.outside(q, near) < r + 0.4 * mm) return false;   // (the hole itself is in the lobe)
          }
          return true;
        };
        let lo = 0, hi = 15;                           // the least swing (5° steps) that clears: swung further out it only clears more
        if (clear(0)) hi = 0; else { while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (clear(mid * 5)) hi = mid; else lo = mid; } }
        if (sw.size > 64) sw.clear();
        sw.set(id, hi * 5);
      }
      const [dd, nn] = swing(sw.get(id) * Math.PI / 180);
      add(new THREE.TorusGeometry(R, r, 12, 96), metal, p.clone().addScaledVector(dd, R - r), frame(dd, nn));
    } else {                                          // a drop: a little ring through the lobe, a wire or a fine chain straight down, the charm at its end
      add(new THREE.TorusGeometry(2.2 * mm, 0.45 * mm, 8, 24), metal, p.clone().addScaledVector(d, 1.6 * mm).addScaledVector(n, 1.2 * mm), frame(d, n));
      const top = p.clone().addScaledVector(d, 3.6 * mm).addScaledVector(n, 1.6 * mm), len = (a.style === "chain drop" ? a.length : Math.min(a.length, 5)) * mm, end = top.clone().addScaledVector(down, len);
      if (len > 0.5 * mm) add(new THREE.TubeGeometry(new THREE.LineCurve3(top, end), 1, (a.style === "chain drop" ? 0.3 : 0.4) * mm, 6, false), metal, new THREE.Vector3());
      const q = frame(new THREE.Vector3().crossVectors(up, out).normalize(), up);
      for (const part of JW.charm(a.charm, (a.charm === "pearl" || a.charm === "ball" ? 7 : 10) * mm * k))
        add(part.geo, part.part === "gem" ? JW.gem(a.gem) : part.part === "pearl" ? JW.pearl() : metal, end, q);
    }
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
  // ---- hats: on the head's own outline (headMap), from a band above the brows up over the crown --------------------
  // a beret (a soft disc slouched to one side by `tilt`), a cap (a dome on the head and a visor), a bucket hat (a flat
  // crown and a brim all round, sloping down), a beanie (a dome with a folded cuff, slouching above the crown)
  draw_hat(a, m) {
    this.clear(m);
    const { right, up, fwd, L } = this.faceFrame(), mm = 0.001 * this.c.scale(), P = this.c.POS, k = a.size;
    let top = -1e9; for (let i = 1; i < P.length; i += 3) top = Math.max(top, P[i]);   // the crown: the head is the body's highest point
    const brow = L(9).y, y0 = brow + (a.style === "beanie" ? 18 : a.style === "cap" ? 30 : 24) * mm + a.height * mm;   // the band, above the brows
    const H = this.headMap(y0 - 12 * mm, top + 4 * mm, 0.13, 0.18), rise = Math.max(30 * mm, top - y0);
    const turn = (a.turn || 0) * Math.PI / 180, tilt = (a.tilt || 0) * Math.PI / 180;
    const mat = this.surfaceOf(a, a.colour, a.shine ?? 0);
    const at = (phi, y, r, dx = 0, dz = 0) => H.c.clone().setY(y).addScaledVector(fwd, Math.cos(phi) * r + dz).addScaledVector(right, Math.sin(phi) * r + dx);
    const NA = 72, rings = [];
    // the rings, bottom up: each a height, a radius over the head's own at that height (or over the band's), a sideways slide
    const ring = (y, extra, slide = 0, atY = y, k2 = 1) => { const pts = []; for (let i = 0; i < NA; i++) { const phi = (i / NA) * 2 * Math.PI + turn; pts.push(at(phi, y, H.r(phi, Math.min(atY, top)) * k2 + extra, Math.sin(tilt) * slide, 0)); } rings.push(pts); };
    if (a.style === "beret") {                        // a snug band, then a soft disc that spreads out and over, slouched sideways
      const prof = [[0, 3, 0], [0.12, 4, 12], [0.3, 38, 32], [0.5, 50, 48], [0.72, 46, 62], [0.88, 26, 70], [0.97, 8, 74], [1, 0, 75]];   // t, out (mm), up (mm)
      for (const [t, out, h] of prof) ring(y0 + h * mm * k, out * mm * k, h * mm * k * 1.2, y0 + 8 * mm, t <= 0.12 ? 1 : (1 - t) * 1.0 + t * 0.001);
    } else if (a.style === "cap") {                   // a dome on the head, a button on top, a visor out over the brow
      const yD = top - 26 * mm, yT = top + 10 * mm, J = 16;         // the head's own outline up to under the crown, then a round top over it
      for (let j = 0; j <= J; j++) { const t = j / J, y = y0 + (yT - y0) * t, u = Math.max(0, Math.min(1, (y - yD) / (yT - yD))), dome = Math.sqrt(Math.max(0.0004, 1 - u * u)); ring(y, 6 * mm, 0, Math.min(y, yD), t < 1 ? dome : 0.02); }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(7 * mm, 12, 8), mat); dome.position.copy(at(0, top + 10 * mm, 0)); m.obj.add(dome);
      const seg = [], U = 7, V = 18, span = 0.9, len = 72 * mm * k;   // the visor: a plate from the band's front, out and down, tapering to nothing at the temples
      for (let i = 0; i <= V; i++) { const phi = -span + 2 * span * i / V + turn, r0 = H.r(phi, y0) + 3 * mm, taper = Math.max(0, 1 - ((phi - turn) / span) ** 2) ** 0.6; for (let j = 0; j <= U; j++) { const u = j / U, p = at(phi, y0 + 1 * mm - (10 * mm * u + 16 * mm * u * u) * taper, r0 + len * taper * u); seg.push(p); } }
      const vg = new THREE.BufferGeometry(), pos = [], idx = []; for (const q of seg) pos.push(q.x, q.y, q.z);
      for (let i = 0; i < V; i++) for (let j = 0; j < U; j++) { const a0 = i * (U + 1) + j, b0 = a0 + U + 1; idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
      vg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); vg.setIndex(idx); vg.computeVertexNormals();
      const visor = new THREE.Mesh(vg, mat); m.obj.add(visor);
    } else if (a.style === "bucket") {                // a flat-topped crown and a brim sloping down all round
      const J = 8, yT = top + 16 * mm; for (let j = 0; j <= J; j++) { const t = j / J, y = y0 + (yT - y0) * t; ring(y, 7 * mm, 0, y0 + 5 * mm, t < 1 ? 1 : 0.02); }
      rings.push(rings[rings.length - 1]); rings.length = J + 1;
      const brim = []; for (let i = 0; i < NA; i++) { const phi = (i / NA) * 2 * Math.PI + turn; brim.push(at(phi, y0 - 2 * mm, H.r(phi, y0) + 7 * mm)); } rings.unshift(brim);
      const edge = []; for (let i = 0; i < NA; i++) { const phi = (i / NA) * 2 * Math.PI + turn; edge.push(at(phi, y0 - 30 * mm, H.r(phi, y0) + 7 * mm + 58 * mm * k)); } rings.unshift(edge);
    } else {                                          // a beanie: a dome over the head with a folded cuff, slouching past the crown
      const cuff = 32 * mm; ring(y0 - 4 * mm, 9 * mm, 0, y0 + 4 * mm); ring(y0 + cuff, 9 * mm, 0, y0 + cuff); ring(y0 + cuff + 3 * mm, 6 * mm, 0, y0 + cuff);
      const yD = top - 28 * mm, yT = top + 24 * mm, J = 12;         // the dome: the head's own outline up to a little under the crown, then a round top past it, slouching sideways
      for (let j = 1; j <= J; j++) { const t = j / J, y = y0 + cuff + 3 * mm + (yT - (y0 + cuff + 3 * mm)) * t, u = Math.max(0, Math.min(1, (y - yD) / (yT - yD))), dome = Math.sqrt(Math.max(0.0004, 1 - u * u)); ring(y, 6 * mm, 12 * mm * u * u, Math.min(y, yD), t < 1 ? dome : 0.02); }
    }
    const g = new THREE.BufferGeometry(), pos = [], idx = [];
    for (const r of rings) for (const q of r) pos.push(q.x, q.y, q.z);
    for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < NA; i++) { const a0 = r * NA + i, b0 = r * NA + (i + 1) % NA, c0 = a0 + NA, d0 = b0 + NA; idx.push(a0, c0, b0, b0, c0, d0); }
    const uv = []; for (let r = 0; r < rings.length; r++) for (let i = 0; i < NA; i++) uv.push(i / NA * 4, r / Math.max(1, rings.length - 1));   // round and up (a PBR set's repeat)
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const hat = new THREE.Mesh(g, mat); hat.castShadow = true; m.obj.add(hat);
  }
  // ---- horns: devil's (up from the forehead's corners, curving back to a point) or a ram's (curling back round the
  // ear); cones swept along their curve, their bases sunk into the head
  draw_horns(a, m) {
    this.clear(m);
    const H = this.headFrame(), mm = 0.001 * this.c.scale(), k = a.size || 1, mat = this.surfaceOf(a, a.colour);
    for (const sg of [1, -1]) {
      const R = H.right.clone().multiplyScalar(sg), rise = H.crown - H.c.y, C = [], rad = [];
      if (a.style === "ram") {                       // a spiral beside the head, from the temple's top back, down and round
        const base = H.c.clone().addScaledVector(H.up, rise * 0.62).addScaledVector(R, H.W * 0.36 * (a.spread ?? 1)).addScaledVector(H.fwd, H.W * 0.05);
        const R0 = 34 * mm * k, mid = base.clone().addScaledVector(H.up, -R0).addScaledVector(H.fwd, -R0 * 0.2), turns = 1.55 * (a.curl ?? 1);
        for (let i = 0; i <= 64; i++) {
          const t = i / 64, th = t * turns * Math.PI * 2, r = R0 * (1 - 0.42 * t);
          C.push(mid.clone().addScaledVector(H.up, Math.cos(th) * r).addScaledVector(H.fwd, -Math.sin(th) * r).addScaledVector(R, (6 + 16 * t) * mm * k));
          rad.push((15 * (1 - 0.68 * t) * (1 + 0.07 * Math.sin(th * 9))) * mm * k);   // tapering, ridged
        }
      } else {                                         // devil's: up and out from the forehead's top corners, swept back
        const base = H.c.clone().addScaledVector(H.up, rise * 0.8).addScaledVector(R, H.W * 0.2 * (a.spread ?? 1)).addScaledVector(H.fwd, H.W * 0.2);
        const L = 58 * mm * k, d0 = H.up.clone().multiplyScalar(1).addScaledVector(R, 0.35).addScaledVector(H.fwd, 0.15).normalize(), back = H.fwd.clone().multiplyScalar(-0.55 * (a.curl ?? 1)).addScaledVector(R, 0.12);
        for (let i = 0; i <= 40; i++) { const t = i / 40; C.push(base.clone().addScaledVector(d0, L * t).addScaledVector(back, L * t * t).addScaledVector(d0, -4 * mm)); rad.push((10 * Math.pow(1 - t, 0.85) + 0.5) * mm * k); }
      }
      m.obj.add(new THREE.Mesh(sweep(C, i => [rad[i], rad[i]], H.fwd), mat));
    }
  }
  // ---- ears on a headband: a band over the head from ear to ear, two ears standing on it (a bunny's long and soft, a
  // cat's and a fox's triangles), their inside a colour of its own
  draw_ears(a, m) {
    this.clear(m);
    const H = this.headFrame(), mm = 0.001 * this.c.scale(), k = a.size || 1, rise = H.crown - H.c.y;
    const bandMat = this.surfaceOf(a, a.band, 0.5), outMat = this.surfaceOf(a, a.colour), inMat = new THREE.MeshStandardMaterial({ color: a.inner, roughness: 0.85, side: THREE.DoubleSide });
    const ring = th => H.c.clone().addScaledVector(H.right, Math.cos(th) * (H.W / 2 + 7 * mm)).addScaledVector(H.up, Math.sin(th) * (rise + 6 * mm)).addScaledVector(H.fwd, H.W * 0.06);
    const band = []; for (let i = 0; i <= 48; i++) band.push(ring(0.12 + (Math.PI - 0.24) * i / 48));
    m.obj.add(new THREE.Mesh(sweep(band, () => [2.5 * mm, 4 * mm], H.fwd), bandMat));
    const sty = { bunny: [112, 36, 0.75, 0.32], cat: [40, 42, 0, 0.42], fox: [56, 40, 0, 0.4] }[a.style] || [112, 36, 0.75, 0.32];
    const [len, wid, soft, at] = sty;
    for (const sg of [1, -1]) {
      const th = Math.PI / 2 - sg * at, root = ring(th), out = root.clone().sub(H.c).normalize();   // straight out of the head there
      const lean = (a.tilt || 0) * Math.PI / 180, dir = out.clone().applyAxisAngle(H.fwd, -sg * lean).normalize(), side = new THREE.Vector3().crossVectors(H.fwd, dir).normalize();
      const C = [], W = [], Ci = [], Wi = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, w = (soft ? Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.06)), 0.7) : 1 - t) * wid * mm * k / 2 + 0.6 * mm;
        const p = root.clone().addScaledVector(dir, len * mm * k * t).addScaledVector(H.fwd, -soft * 12 * mm * k * t * t);   // a bunny's tips lean back
        C.push(p); W.push([w, 3.5 * mm * k]); Ci.push(p.clone().addScaledVector(H.fwd, 2.4 * mm * k)); Wi.push([w * 0.62, 1.2 * mm * k]);
      }
      m.obj.add(new THREE.Mesh(sweep(C, i => W[i], H.fwd, side), outMat), new THREE.Mesh(sweep(Ci.slice(2, 27), i => Wi[i + 2], H.fwd, side), inMat));
    }
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

  // ---- a necklace: a strand dropped round the neck by gravity onto the body as it is (jewellery.js), drawn as a chain,
  // pearls, beads, a cord or a choker's ribbon, a pendant at its front. Settled again only when the neck, shoulders or
  // chest change (an expression doesn't), or its own length, style or pendant; a moment after they stop changing
  neckKey(a) { return this.torsoKey() + "|" + JSON.stringify([a.style, a.style === "choker" ? a.ease || 0 : a.length, a.size, a.pendant]); }
  draw_neck(a, m) {
    const body = this.torsoKey(), key = this.neckKey(a);
    if (m.neck?.key === key) return this.dressNeck(a, m, false);
    if (m.neck) { clearTimeout(m.wait); m.wait = setTimeout(() => { if (this.made.get(a.id) === m) this.settleNeck(a, m, key, body); }, 300); return; }   // still being changed: in a moment
    this.settleNeck(a, m, key, body);
  }
  // Put on loose just under the chin and tightened to its length (no shorter than the neck is round: `length` is raised
  // to what it could be). A choker goes round the neck's narrowest part, snug with a few millimetres to spare whatever
  // the neck is like; `ease` (cm) makes it longer, and past a centimetre it hangs
  settleNeck(a, m, key, body) {
    const field = this.torsoField(body), t0 = performance.now(), heavy = a.pendant && a.pendant !== "none" ? 6 : 1, choker = a.style === "choker";
    let y = field.chin - 0.014, tilt = 0, length = (a.length || 20) / 100, gravity = 1;
    if (choker) { const w = JW.neckWaist(field.sdf, field.mid.x, field.chin - 0.005, field.chin - 0.075, field.chin - 0.03); if (w) ({ y, tilt } = w); }
    const ring = JW.neckRing(field.sdf, field.mid.x, y, 48, 0.0012, tilt);
    if (choker) { length = (ring ? ring.length : 0.36) + 0.004 + (a.ease || 0) / 100; gravity = (a.ease || 0) > 1 ? 1 : 0; }
    let res = JW.dropNecklace(field, { y, start: ring?.points, length, heavy, gravity });
    if (!choker && (!a.length || res.length > a.length / 100 + 1e-4)) {
      a.length = Math.ceil(res.length * 1000) / 10; this.c.settled?.(a);   // what it is (cm)
      if (Math.abs(res.length - a.length / 100) > 1e-3) res = JW.dropNecklace(field, { y, start: ring?.points, length: a.length / 100, heavy });
    }
    m.neck = { key: this.neckKey(a), body, points: res.points, steps: res.steps, fell: res.fell, ms: performance.now() - t0 };
    this.dressNeck(a, m, true);
  }
  dressNeck(a, m, fresh) {
    if (fresh) {
      this.clear(m);
      const field = this.torsoField(m.neck.body), { geos, length } = JW.strand(m.neck.points, a.style, a.size, p => field.sdf.normal(p) || field.slices.normal(p), p => field.sdf.push(p, 0.0012));
      m.neck.length = length;
      for (const [part, geo] of Object.entries(geos)) { const o = new THREE.Mesh(geo, this.neckMat(a, part)); o.userData.part = part; m.obj.add(o); }
      if (a.pendant && a.pendant !== "none") this.pendant(a, m, field);
    }
    for (const o of m.obj.children) o.material = this.neckMat(a, o.userData.part);
  }
  neckMat(a, part) {
    return part === "metal" || part === "bead" ? this.metalOf(a) : part === "pearl" ? JW.pearl() : part === "gem" ? JW.gem(a.gem)
         : JW.plain(a.colour, a.style === "choker" ? 0.85 : 0.65);
  }
  // the pendant: from the strand's front point, down along the chest and lying on it, out from the skin by its thickness
  pendant(a, m, field) {
    const P = m.neck.points, p = P[P.length >> 1].clone(), face = field.sdf.normal(p) || field.slices.normal(p), down = new THREE.Vector3(0, -1, 0);
    const d = down.clone().addScaledVector(face, -down.dot(face)).normalize(), up = d.clone().negate(), X = new THREE.Vector3().crossVectors(up, face).normalize();
    const h = 0.016 * a.size, q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, up, face));
    let lift = 0.0022 * a.size;
    for (const f of [0.25, 0.5, 0.75, 0.95]) { const at = p.clone().addScaledVector(d, f * h).addScaledVector(face, lift), hit = field.sdf.push(at, 0.0012); if (hit) lift += hit.moved; }   // where the chest bulges under it
    for (const part of JW.charm(a.pendant, h)) {
      const kind = part.part === "gem" ? "gem" : part.part === "pearl" ? "pearl" : "metal", o = new THREE.Mesh(part.geo, this.neckMat(a, kind));
      o.position.copy(p).addScaledVector(face, lift); o.quaternion.copy(q); o.userData.part = kind; o.userData.pendant = true; m.obj.add(o);
    }
  }
  // the neck, the shoulders and the chest as they are now: a key from some of their points (not the face's, so an
  // expression leaves it), and the slices built from it once (jewellery.js TorsoField)
  torsoKey() {
    const P = this.c.POS;
    if (!this.torsoIdx) {
      const chin = this.c.lmk(152)[1], idx = [];
      for (let i = 0; i < P.length / 3; i++) { const y = P[i * 3 + 1]; if (y < chin - 0.04 && y > chin - 0.45 && Math.abs(P[i * 3]) < 0.15) idx.push(i); }
      this.torsoIdx = idx.filter((v, k) => k % Math.max(1, Math.floor(idx.length / 64)) === 0);
    }
    return this.torsoIdx.map(i => [0, 1, 2].map(k => Math.round(P[i * 3 + k] * 2000)).join(",")).join(";");
  }
  torsoField(body) {
    if (this.field?.body !== body) {
      const { L } = this.faceFrame(), chin = L(152).y, mid = L(234).add(L(454)).multiplyScalar(0.5), P = this.c.POS, t0 = performance.now();
      let z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < P.length; i += 3) if (P[i + 1] < chin + 0.04 && P[i + 1] > chin - 0.5 && Math.abs(P[i] - mid.x) < 0.2) { z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
      const slices = new JW.TorsoField(P, this.c.TRIS, chin - 0.012, chin - 0.5, 0.004, 0.17, 0.2, mid);
      const sdf = new JW.BodySDF(P, this.c.TRIS, { x0: mid.x - 0.2, x1: mid.x + 0.2, y0: chin - 0.5, y1: chin + 0.04, z0: z0 - 0.03, z1: z1 + 0.03 });
      this.field = { body, f: { slices, sdf, chin, mid, ms: performance.now() - t0 } };
    }
    return this.field.f;
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

// a shape swept along a curve: at each point a ring of 12, its half-widths [a, b] along `side` and `face` square to the
// curve (side: across it, face: its front), its ends closed; UVs round and along (a PBR set's repeat)
function sweep(C, wh, face, side0 = null, n = 12) {
  const pos = [], uv = [], idx = [], N = C.length;
  for (let i = 0; i < N; i++) {
    const t = C[Math.min(N - 1, i + 1)].clone().sub(C[Math.max(0, i - 1)]).normalize();
    const f = face.clone().addScaledVector(t, -face.dot(t)).normalize(), sd = side0 ? side0.clone().addScaledVector(t, -side0.dot(t)).normalize() : new THREE.Vector3().crossVectors(t, f).normalize();
    const [wa, wb] = wh(i);
    for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, q = C[i].clone().addScaledVector(sd, Math.cos(a) * wa).addScaledVector(f, Math.sin(a) * wb); pos.push(q.x, q.y, q.z); uv.push(j / n, i / (N - 1) * 3); }
  }
  for (let i = 0; i + 1 < N; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  for (const [i, flip] of [[0, true], [N - 1, false]]) { const c = pos.length / 3; pos.push(C[i].x, C[i].y, C[i].z); uv.push(0.5, 0.5); for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n; if (flip) idx.push(c, b, a); else idx.push(c, a, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
