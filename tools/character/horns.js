// horns.js: horns and animal ears made in code (the Character Studio's Accessories tab, accessories.js draws them;
// DECISIONS 2026-11-10, night: "enhance the horns and add different type, add cow ears and animal ears ... so they flop
// when the character moves"). No models: a horn is a tube along a curve by its kind (a devil's, a bull's, a goat's, a
// gazelle's ringed lyre, a kudu's corkscrew, a ram's spiral, antlers with their tines...), its growth rings real
// geometry, its grain and its colour from the base to the tip a texture drawn here; an ear is a cupped shell along a
// curve (upright, out to the side, or flopped over), its inside a panel of its own colour, and carries how far along
// the ear each point is, so the export can give it a chain of bones to jiggle (index.html exportRig, `jiggle`).
// Everything in the rig's space, sized by `mm` (a millimetre on this head).
import * as THREE from "three";

// ---- the kinds -----------------------------------------------------------------------------------------------------
// a horn: `base` where it grows from the head (out across the head's width W, up the crown's rise, forward by W, from
// the head's middle between the ears), `pts` its line from there (mm at size 1: out, up, forward, for the character's
// left one), `r` its radius at the base (mm), `taper` how it thins (the power of what's left), `rings` how many growth
// rings and `ridge` how deep (of the radius), over the first `ringTo` of its length, `sect` its cross-section (across,
// front to back) and `keel` a ridge down its front, `twist` turns of its section along it (a unicorn's spiral), `one`:
// a single horn in the middle, `more`: further horns (a dragon's second pair, an antler's tines: `at` along the first)
export const HORNS = {
  devil: { label: "devil's", base: [0.2, 0.8, 0.2], pts: [[0, 0, 0], [5, 20, 3], [13, 40, -4], [20, 54, -20], [24, 60, -38]], r: 10, taper: 0.85, rings: 7, ridge: 0.05, ringTo: 0.6, colour: "#1c1414", tip: "#0b0808" },
  stubs: { label: "stubs (budding)", base: [0.19, 0.82, 0.2], pts: [[0, 0, 0], [2, 9, 2], [5, 19, 1], [7, 26, -3]], r: 9.5, taper: 0.7, rings: 3, ridge: 0.05, ringTo: 0.7, colour: "#2a1c18", tip: "#0f0a09" },
  oni: { label: "oni's", base: [0.15, 0.76, 0.3], pts: [[0, 0, 0], [2, 14, 9], [4, 31, 15], [5, 52, 17]], r: 9, taper: 0.9, rings: 5, ridge: 0.04, ringTo: 0.5, colour: "#d8c7a8", tip: "#7a1d17" },
  unicorn: { label: "unicorn's (one)", one: true, base: [0, 0.8, 0.34], pts: [[0, 0, 0], [0, 45, 27], [0, 96, 50], [0, 152, 68]], r: 11, taper: 1, rings: 0, ridge: 0, twist: 3.2, groove: 0.16, colour: "#efe9df", tip: "#fffaf0" },
  bull: { label: "bull's", base: [0.4, 0.7, 0.03], pts: [[0, 0, 0], [38, 6, 0], [78, 22, 8], [104, 52, 26], [112, 84, 44]], r: 15, taper: 0.8, rings: 6, ridge: 0.04, ringTo: 0.35, colour: "#d9cdb4", tip: "#231c18" },
  cow: { label: "cow's", base: [0.39, 0.72, 0.02], pts: [[0, 0, 0], [26, 8, 0], [47, 25, 4], [55, 48, 8], [50, 68, 10]], r: 12, taper: 0.8, rings: 5, ridge: 0.04, ringTo: 0.4, colour: "#e3d8c0", tip: "#3a2f28" },
  goat: { label: "goat's", base: [0.13, 0.93, 0.08], pts: [[0, 0, 0], [6, 40, -8], [16, 78, -32], [30, 108, -66], [44, 126, -104]], r: 12, taper: 0.75, rings: 13, ridge: 0.13, ringTo: 0.85, sect: [0.82, 1.22], keel: 0.18, colour: "#8d8273", tip: "#3a342c" },
  gazelle: { label: "gazelle's (ringed)", base: [0.1, 0.94, 0.08], pts: [[0, 0, 0], [8, 50, -10], [26, 100, -28], [34, 150, -34], [24, 192, -18]], r: 9.5, taper: 0.7, rings: 22, ridge: 0.2, ringTo: 0.78, colour: "#2b2420", tip: "#0d0b0a" },
  kudu: { label: "kudu's (corkscrew)", base: [0.12, 0.93, 0.06], helix: { axis: [0.36, 0.86, -0.36], len: 235, rad: 17, turns: 2.25 }, r: 11.5, taper: 0.8, rings: 0, ridge: 0, keel: 0.3, sect: [0.9, 1.1], colour: "#6d5a45", tip: "#e9dfcb" },
  ram: { label: "ram's", base: [0.33, 0.78, -0.03], spiral: { rad: 50, turns: 1.4 }, r: 17, taper: 0.68, rings: 26, ridge: 0.11, ringTo: 0.92, sect: [0.9, 1.15], keel: 0.12, colour: "#b39b7b", tip: "#5a4a38" },
  demon: { label: "demon's (great)", base: [0.22, 0.8, 0.16], pts: [[0, 0, 0], [20, 40, 6], [52, 84, -6], [66, 140, -40], [52, 196, -70], [30, 236, -84]], r: 17, taper: 0.8, rings: 16, ridge: 0.09, ringTo: 0.7, colour: "#15100f", tip: "#4a100c" },
  dragon: { label: "dragon's", base: [0.2, 0.9, -0.06], pts: [[0, 0, 0], [10, 38, -40], [22, 66, -92], [30, 84, -150]], r: 13, taper: 0.85, rings: 10, ridge: 0.07, ringTo: 0.7, sect: [0.85, 1.15], keel: 0.2, colour: "#2a2622", tip: "#c9bca6",
            more: [{ base: [0.36, 0.6, -0.1], pts: [[0, 0, 0], [16, 12, -28], [34, 18, -60], [48, 20, -92]], r: 9, taper: 0.9 }, { base: [0.3, 0.3, -0.06], pts: [[0, 0, 0], [14, -4, -18], [28, -10, -38]], r: 6, taper: 0.9 }] },
  antlers: { label: "antlers", base: [0.17, 0.93, 0.04], pts: [[0, 0, 0], [18, 50, -12], [50, 110, -30], [72, 170, -22], [76, 222, 4]], r: 9, taper: 0.5, rings: 0, ridge: 0, burr: 0.5, colour: "#7a5c3e", tip: "#eadfca", tipAt: 0.72,
             more: [{ at: 0.1, pts: [[0, 0, 0], [3, 22, 32], [5, 50, 52]], k: 0.72 }, { at: 0.4, pts: [[0, 0, 0], [14, 30, 26], [22, 64, 40]], k: 0.7 }, { at: 0.68, pts: [[0, 0, 0], [-6, 34, -22], [-16, 66, -32]], k: 0.7 }, { at: 0.86, pts: [[0, 0, 0], [16, 22, 10], [26, 44, 14]], k: 0.8 }] },
};
// an ear: its length and its greatest width (mm at size 1), its outline by `shape` (how wide along it), `thick`, how
// cupped (`cup`, of its half-width), where on the head (`at`: the angle down from the crown along the band from ear to
// ear, radians), how it's held (`lean`: degrees out from straight out of the head; `back`: its tip leaning back, mm),
// how it flops (`droop` 0..1: over and down; `fold`: the tip forward instead, a pig's), `bones`: joints along it
export const EARS = {
  bunny: { label: "bunny", colour: "#f2f0ec", inner: "#f2b6c6", len: 112, wid: 36, shape: "oval", thick: 7, cup: 0.2, at: 0.32, back: 12, bones: 4 },
  "lop bunny": { label: "lop bunny (hanging)", colour: "#d8c3a5", inner: "#f0c4c0", len: 118, wid: 40, shape: "oval", thick: 7, cup: 0.14, at: 0.55, droop: 1, bones: 4 },
  cat: { label: "cat", colour: "#2b2b2e", inner: "#f2b6c6", len: 40, wid: 42, shape: "tri", thick: 6, cup: 0.24, at: 0.42, bones: 2 },
  fox: { label: "fox", colour: "#d9722b", inner: "#fbf3e8", len: 56, wid: 40, shape: "tri", thick: 6, cup: 0.24, at: 0.4, bones: 2 },
  wolf: { label: "wolf", colour: "#7b7b80", inner: "#e8dcd0", len: 70, wid: 46, shape: "spade", thick: 7, cup: 0.26, at: 0.46, lean: 8, bones: 2 },
  bear: { label: "bear", colour: "#6b4a2f", inner: "#caa27a", len: 30, wid: 42, shape: "round", thick: 9, cup: 0.3, at: 0.52, bones: 2 },
  mouse: { label: "mouse", colour: "#8c8c92", inner: "#f2b6c6", len: 58, wid: 62, shape: "disc", thick: 4, cup: 0.12, at: 0.55, lean: 10, bones: 2 },
  cow: { label: "cow", colour: "#efe8dc", inner: "#e9a9a6", len: 96, wid: 54, shape: "leaf", thick: 6, cup: 0.34, at: 1.14, lean: 12, back: 10, droop: 0.12, bones: 3, tag: true },
  goat: { label: "goat", colour: "#e8e1d4", inner: "#e7b3a8", len: 80, wid: 34, shape: "leaf", thick: 5, cup: 0.3, at: 1.08, lean: 16, droop: 0.34, bones: 3 },
  sheep: { label: "sheep", colour: "#efe9e0", inner: "#e7b3a8", len: 62, wid: 30, shape: "leaf", thick: 6, cup: 0.3, at: 1.12, lean: 10, droop: 0.1, bones: 3 },
  deer: { label: "deer", colour: "#a8794a", inner: "#f3e7d6", len: 88, wid: 42, shape: "leaf", thick: 5, cup: 0.32, at: 0.86, lean: 4, back: 6, bones: 3 },
  dog: { label: "dog (floppy)", colour: "#8a5a34", inner: "#d9a88a", len: 94, wid: 54, shape: "flap", thick: 5, cup: 0.08, at: 0.66, droop: 1, bones: 4 },
  pig: { label: "pig", colour: "#f0b4b0", inner: "#e8948f", len: 60, wid: 50, shape: "spade", thick: 5, cup: 0.2, at: 0.52, fold: 0.75, bones: 3 },
};
const OUTLINE = {                                                          // how wide at t along the ear (0 the root, 1 the tip): 0..1 of the half-width
  oval: t => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.06)), 0.7),
  tri: t => Math.pow(1 - t, 0.9) * (0.82 + 0.18 * Math.min(1, t * 6)),
  spade: t => Math.pow(1 - t, 0.62) * (0.7 + 0.3 * Math.min(1, t * 4)),
  round: t => Math.sqrt(Math.max(0, 1 - t * t)) * (0.86 + 0.14 * Math.min(1, t * 5)),
  disc: t => Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + 0.88 * t)), 0.5) * (0.35 + 0.65 * Math.min(1, t * 3.2)),
  leaf: t => Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, t * 0.97 + 0.03), 0.82)), 0.85) * (0.42 + 0.58 * Math.min(1, t * 3.4)),
  flap: t => Math.pow(Math.sin(Math.PI * Math.min(1, 0.3 + 0.68 * t)), 0.6),
};

// ---- frames carried along a curve (no flip where the curve turns through the frame's own axis) ------------------------
function tangents(C) { return C.map((_, i) => C[Math.min(C.length - 1, i + 1)].clone().sub(C[Math.max(0, i - 1)]).normalize()); }
function transport(C, side0) {                                             // each point's [tangent, side, face]: side0 made square to the first tangent, then turned as the tangent turns
  const T = tangents(C), F = [], q = new THREE.Quaternion();
  let s = side0.clone().addScaledVector(T[0], -side0.dot(T[0])); if (s.lengthSq() < 1e-8) s = new THREE.Vector3(1, 0, 0).cross(T[0]); s.normalize();
  for (let i = 0; i < C.length; i++) {
    if (i) { q.setFromUnitVectors(T[i - 1], T[i]); s.applyQuaternion(q); s.addScaledVector(T[i], -s.dot(T[i])).normalize(); }
    F.push([T[i], s.clone(), new THREE.Vector3().crossVectors(T[i], s).normalize()]);
  }
  return F;
}
const lengths = C => { const S = [0]; for (let i = 1; i < C.length; i++) S.push(S[i - 1] + C[i].distanceTo(C[i - 1])); return S; };
const finish = (pos, uv, idx, more = {}) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  for (const k in more) g.setAttribute(k, new THREE.Float32BufferAttribute(more[k], 1)); g.setIndex(idx); g.computeVertexNormals(); return g; };

// a horn's tube: C its line, R its radius at each point; rings as real ridges, a keel, a section, a twist; closed at
// both ends; UVs round it and from its base to its tip (v 0..vScale)
export function hornTube(C, R, { n = 18, side, sect = [1, 1], keel = 0, twist = 0, groove = 0, vScale = 1 } = {}) {
  const F = transport(C, side), S = lengths(C), L = S[S.length - 1] || 1, N = C.length, pos = [], uv = [], idx = [];
  for (let i = 0; i < N; i++) {
    const [, sd, fc] = F[i], tw = twist * 2 * Math.PI * S[i] / L;
    for (let j = 0; j <= n; j++) {                                         // (the seam's points twice: the texture wraps there)
      const a = j / n * Math.PI * 2, ca = Math.cos(a + tw), sa = Math.sin(a + tw);
      const k = 1 + keel * Math.pow(Math.max(0, Math.sin(a)), 6) - groove * Math.pow(Math.abs(Math.sin(1.5 * a)), 3);   // the keel down the front; a spiral's three grooves
      const q = C[i].clone().addScaledVector(sd, ca * R[i] * sect[0] * k).addScaledVector(fc, sa * R[i] * sect[1] * k);
      pos.push(q.x, q.y, q.z); uv.push(j / n, S[i] / L * vScale);
    }
  }
  const W = n + 1;
  for (let i = 0; i + 1 < N; i++) for (let j = 0; j < n; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  for (const [i, flip] of [[0, true], [N - 1, false]]) { const c = pos.length / 3; pos.push(C[i].x, C[i].y, C[i].z); uv.push(0.5, S[i] / L * vScale); for (let j = 0; j < n; j++) { const a = i * W + j, b = a + 1; if (flip) idx.push(c, b, a); else idx.push(c, a, b); } }
  return finish(pos, uv, idx);
}

// one kind's horns for one side: its lines (a smooth curve through its points, or a spiral, or a corkscrew) and radii.
// frame: { c, right, up, fwd, W, rise } the head's; sg: 1 the character's left, -1 the right (0: the middle);
// o: { size, spread, curl, length, thick, ridges, lean }; onHead(p): the place on the scalp nearest p, or null
export function hornLines(style, frame, sg, mm, o, onHead = null) {
  const K = HORNS[style] || HORNS.devil, { c, right, up, fwd, W, rise } = frame, R = right.clone().multiplyScalar(sg || 1), k = o.size || 1, len = k * (o.length || 1), thick = k * (o.thick || 1), curl = o.curl ?? 1, lean = (o.lean || 0) * Math.PI / 180;
  const local = ([x, y, z]) => new THREE.Vector3().addScaledVector(R, x * (sg ? 1 : 0)).addScaledVector(up, y).addScaledVector(fwd, z);
  const leaned = v => lean ? v.applyAxisAngle(R, -lean) : v;                 // tipped forward (+) or back about the head's side
  const baseOf = b => { const p = c.clone().addScaledVector(R, b[0] * W * (sg ? (o.spread ?? 1) : 0)).addScaledVector(up, b[1] * rise).addScaledVector(fwd, b[2] * W); return (onHead && onHead(p)) || p; };
  const lines = [];
  const curve = (base, pts, r0, taper, def, tine = false) => {
    // the points' bend scaled by `curl` (1 as drawn, 0 a straight horn along its chord)
    const end = pts[pts.length - 1], P = pts.map((p, i) => { const f = i / (pts.length - 1), ch = [end[0] * f, end[1] * f, end[2] * f]; return leaned(local([ch[0] + (p[0] - ch[0]) * curl, ch[1] + (p[1] - ch[1]) * curl, ch[2] + (p[2] - ch[2]) * curl])).multiplyScalar(len * mm).add(base); });
    const M = Math.max(24, Math.round((def.rings ? 7 * def.rings : 60) * (tine ? 0.5 : 1))), C = new THREE.CatmullRomCurve3(P, false, "centripetal").getSpacedPoints(M);
    lines.push(shaped(C, r0 * thick * mm, taper, def, tine));
  };
  const shaped = (C, r0, taper, def, tine = false) => {
    const S = lengths(C), L = S[S.length - 1] || 1, rings = def.rings || 0, amp = (def.ridge || 0) * (o.ridges ?? 1), to = def.ringTo ?? 0.8;
    const Rr = C.map((_, i) => { const t = S[i] / L;
      let r = r0 * (Math.pow(1 - t, taper) * 0.97 + 0.03);
      if (!tine) r *= 1 + (0.16 + 0.5 * (def.burr || 0)) * Math.pow(Math.max(0, 1 - t / 0.07), 2);        // the base swells where it leaves the skin (an antler's burr more)
      if (rings && amp) { const ph = t / to * rings, w = Math.max(0, 1 - t / to); r *= 1 + amp * w ** 0.5 * (Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * ph), 1.6) - 0.35); }   // growth rings, fading toward the tip
      return r; });
    const sink = tine ? 0 : 1.3 * r0, t0 = C[1].clone().sub(C[0]).normalize();
    if (sink) { C.unshift(C[0].clone().addScaledVector(t0, -sink)); Rr.unshift(Rr[0] * 1.02); }           // its root sunk into the head, deep enough that a horn leaving the scalp at a slant shows no edge
    return { C, R: Rr, def };
  };
  const spec = (d, parent) => ({ ...K, more: undefined, ...d });
  if (K.spiral) {                                                           // a ram's: a spiral beside the head, from the temple's top back, down and round
    const base = baseOf(K.base), R0 = K.spiral.rad * mm * len, mid = base.clone().addScaledVector(up, -R0).addScaledVector(fwd, -R0 * 0.2), turns = K.spiral.turns * curl, C = [], M = 150;
    for (let i = 0; i <= M; i++) { const t = i / M, th = t * turns * Math.PI * 2, r = R0 * (1 - 0.42 * t);
      C.push(mid.clone().addScaledVector(up, Math.cos(th) * r).addScaledVector(fwd, -Math.sin(th) * r).addScaledVector(R, (8 + 34 * t) * mm * len)); }   // back, down behind the ear, forward under it and out
    lines.push(shaped(C, K.r * thick * mm, K.taper, K));
  } else if (K.helix) {                                                     // a kudu's: a corkscrew about a line up, out and back
    const base = baseOf(K.base), ax = leaned(local(K.helix.axis)).normalize(), e1 = new THREE.Vector3().crossVectors(ax, fwd).normalize(), e2 = new THREE.Vector3().crossVectors(ax, e1).normalize(), C = [], M = 170;
    for (let i = 0; i <= M; i++) { const t = i / M, th = t * K.helix.turns * curl * Math.PI * 2 * (sg || 1), r = K.helix.rad * mm * len * Math.min(1, t * 5) * (1 - 0.35 * t);
      C.push(base.clone().addScaledVector(ax, K.helix.len * mm * len * t).addScaledVector(e1, Math.cos(th) * r - (i ? 0 : 0)).addScaledVector(e2, Math.sin(th) * r)); }
    lines.push(shaped(C, K.r * thick * mm, K.taper, K));
  } else curve(baseOf(K.base), K.pts, K.r, K.taper, K);
  for (const m of K.more || []) {
    if (m.at !== undefined) {                                               // a tine: from a point along the first line, a share of its radius there
      const first = lines[0], i = Math.round(m.at * (first.C.length - 1));
      curve(first.C[i].clone(), m.pts, first.R[i] / (thick * mm) * m.k, 0.8, { ...K, rings: 0, ridge: 0 }, true);
    } else curve(baseOf(m.base), m.pts, m.r, m.taper, spec(m));
  }
  return lines.map(l => ({ ...l, side: fwd.clone().cross(l.C[Math.min(4, l.C.length - 1)].clone().sub(l.C[0]).normalize()).normalize() }));
}

// ---- a horn's look, drawn here: its colour from the base to the tip with its rings and its grain, and their relief as a
// normal map (the texture wraps round the horn: every pattern across it is periodic). Cached by what it's made from
const TEX = new Map();
export function hornTextures({ colour = "#1c1414", tip = null, tipAt = 0.55, rings = 8, ringTo = 0.8, grain = 1, seed = 1 }) {
  const key = [colour, tip, tipAt, rings, ringTo, grain, seed].join("|"); if (TEX.has(key)) return TEX.get(key);
  const W = 128, Hh = 512, c0 = new THREE.Color(colour), c1 = new THREE.Color(tip || colour);
  let s = seed * 9301 + 49297; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const waves = Array.from({ length: 9 }, (_, i) => ({ f: 3 + Math.floor(rnd() * 22), p: rnd() * 6.283, a: (0.35 + rnd() * 0.65) / (1 + i * 0.25), d: rnd() * 3 }));
  const h = new Float32Array(W * Hh), sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let r = 0; r < Hh; r++) { const v = r / (Hh - 1);                    // v 0 the base
    const ring = rings ? Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * v / ringTo * rings), 3) * Math.max(0, 1 - v / ringTo) : 0;
    for (let x = 0; x < W; x++) { const u = x / W * 2 * Math.PI; let g = 0; for (const w of waves) g += w.a * Math.cos(w.f * u + w.p + w.d * v * 6); h[r * W + x] = 0.16 * grain * g + 0.55 * ring; } }
  const col = document.createElement("canvas"), nor = document.createElement("canvas"); col.width = nor.width = W; col.height = nor.height = Hh;
  const gc = col.getContext("2d"), gn = nor.getContext("2d"), ic = gc.createImageData(W, Hh), inn = gn.createImageData(W, Hh), c = new THREE.Color();
  for (let r = 0; r < Hh; r++) { const v = r / (Hh - 1), y = Hh - 1 - r;        // (the canvas's top row is v = 1: three flips it)
    for (let x = 0; x < W; x++) {
      const i = r * W + x, o = (y * W + x) * 4, hx = h[r * W + (x + 1) % W] - h[r * W + (x + W - 1) % W], hy = h[Math.min(Hh - 1, r + 1) * W + x] - h[Math.max(0, r - 1) * W + x];
      c.copy(c0).lerp(c1, sm(tipAt - 0.22, tipAt + 0.22, v + 0.05 * h[i])).multiplyScalar(0.86 + 0.5 * h[i] * 0.5 + 0.1 * (1 - v));   // darker in the grooves, a touch lighter toward the base
      ic.data[o] = 255 * Math.min(1, Math.sqrt(c.r)); ic.data[o + 1] = 255 * Math.min(1, Math.sqrt(c.g)); ic.data[o + 2] = 255 * Math.min(1, Math.sqrt(c.b)); ic.data[o + 3] = 255;
      const nx = -hx * 2.2, ny = -hy * 2.2, l = Math.hypot(nx, ny, 1);
      inn.data[o] = 255 * (nx / l * 0.5 + 0.5); inn.data[o + 1] = 255 * (ny / l * 0.5 + 0.5); inn.data[o + 2] = 255 * (1 / l * 0.5 + 0.5); inn.data[o + 3] = 255;
    } }
  gc.putImageData(ic, 0, 0); gn.putImageData(inn, 0, 0);
  const map = new THREE.CanvasTexture(col), normalMap = new THREE.CanvasTexture(nor);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = normalMap.wrapS = THREE.RepeatWrapping; map.anisotropy = normalMap.anisotropy = 4; map.name = "horn_colour"; normalMap.name = "horn_normal";
  const out = { map, normalMap }; if (TEX.size > 24) TEX.clear(); TEX.set(key, out); return out;
}

// ---- an ear ---------------------------------------------------------------------------------------------------------
// its line from the root: straight out along `dir`, its tip leaning back; flopped over by `droop` (the way turning from
// `dir` toward down and a little out, more the further along), or its tip folded forward (`fold`)
export function earLine(K, root, dir, frame, sg, mm, o) {
  const { right, up, fwd } = frame, R = right.clone().multiplyScalar(sg), k = o.size || 1, L = K.len * mm * k * (o.length || 1), M = 36, C = [root.clone()], droop = o.droop ?? K.droop ?? 0, fold = K.fold || 0;
  const down = up.clone().multiplyScalar(-1).addScaledVector(R, 0.28).addScaledVector(fwd, 0.1).normalize(), ahead = fwd.clone().addScaledVector(up, -0.45).normalize();
  const d = dir.clone();
  for (let i = 1; i <= M; i++) {
    const t = i / M, v = dir.clone();
    if (droop) { const a = dir.angleTo(down) * droop * Math.min(1, Math.pow(t / 0.55, 1.3)), ax = new THREE.Vector3().crossVectors(dir, down).normalize(); v.applyAxisAngle(ax, a); }
    if (fold) { const a = dir.angleTo(ahead) * fold * Math.pow(Math.max(0, (t - 0.42) / 0.58), 1.2), ax = new THREE.Vector3().crossVectors(dir, ahead).normalize(); v.applyAxisAngle(ax, a); }
    d.copy(v).addScaledVector(fwd, -(K.back || 0) / K.len * 2 * t * (1 - droop)).normalize();
    C.push(C[i - 1].clone().addScaledVector(d, L / M));
  }
  return C;
}
// the ear's shell on its line: a cupped lens across (its rim round), its inside (toward `face`) a panel of its own;
// each point's place along the ear (0 the root, 1 the tip) as the attribute `along`
export function earShell(C, K, frame, sg, mm, o, face) {
  const k = o.size || 1, n = 16, N = C.length, side0 = new THREE.Vector3().crossVectors(face, C[1].clone().sub(C[0]).normalize()).multiplyScalar(sg).normalize();
  const F = transport(C, side0), S = lengths(C), L = S[N - 1] || 1, W = K.wid * mm * k * (o.width || 1) / 2, T = K.thick * mm * Math.sqrt(k), f = OUTLINE[K.shape] || OUTLINE.oval, cup = K.cup ?? 0.2;
  const w = i => W * f(S[i] / L) + 0.5 * mm, th = i => T * (0.45 + 0.55 * Math.sqrt(Math.max(0.02, f(S[i] / L))));
  const pos = [], uv = [], idx = [], along = [];
  for (let i = 0; i < N; i++) { const [, sd, fc] = F[i], wi = w(i), ti = th(i);
    for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, x = Math.cos(a) * wi, z = Math.sin(a) * ti / 2 - cup * wi * Math.sin(a) * Math.sin(a);
      const q = C[i].clone().addScaledVector(sd, x).addScaledVector(fc, z); pos.push(q.x, q.y, q.z); uv.push(j / n * 2, S[i] / L * 3); along.push(S[i] / L); } }
  for (let i = 0; i + 1 < N; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  for (const [i, flip] of [[0, true], [N - 1, false]]) { const c = pos.length / 3; pos.push(C[i].x, C[i].y, C[i].z); uv.push(0.5, S[i] / L * 3); along.push(S[i] / L); for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n; if (flip) idx.push(c, b, a); else idx.push(c, a, b); } }
  const outer = finish(pos, uv, idx, { along });
  // the inside: a strip on the lens's front, 0.72 of its width, from just above the root to short of the tip
  const ip = [], iu = [], ii = [], ia = [], m = 8, i0 = Math.max(1, Math.round(0.06 * N)), i1 = Math.round(0.9 * N), rows = i1 - i0;
  for (let i = i0; i <= i1; i++) { const [, sd, fc] = F[i], e = (i - i0) / rows, wi = w(i) * 0.72 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + 0.9 * e)), 0.5), full = w(i), ti = th(i);
    for (let j = 0; j <= m; j++) { const s = (j / m * 2 - 1), x = s * wi, u = Math.min(1, Math.abs(x) / full), z = ti / 2 * Math.sqrt(1 - u * u) - cup * full * (1 - u * u) + 0.5 * mm;
      const q = C[i].clone().addScaledVector(sd, x).addScaledVector(fc, z); ip.push(q.x, q.y, q.z); iu.push(j / m, e * 2); ia.push(S[i] / L); } }
  for (let i = 0; i < rows; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + 1, c = a + m + 1, d = c + 1; ii.push(a, b, c, b, d, c); }
  return { outer, inner: finish(ip, iu, ii, { along: ia }), frames: F, half: w, lengths: S };
}
// a tag in the ear (a cow's): a plate hanging from the ear's lower edge at 55% along it, its pin through the ear
export function earTag(C, shell, frame, sg, mm, o) {
  const i = Math.round(0.55 * (C.length - 1)), [, sd, fc] = shell.frames[i], dn = frame.up.clone().multiplyScalar(-1), k = o.size || 1;
  const edge = sd.dot(dn) > 0 ? sd : sd.clone().multiplyScalar(-1), at = C[i].clone().addScaledVector(edge, shell.half(i) * 0.55).addScaledVector(fc, 2.4 * mm);
  const plate = new THREE.BoxGeometry(24 * mm * k, 30 * mm * k, 1.6 * mm), pin = new THREE.CylinderGeometry(4.5 * mm * k, 4.5 * mm * k, 5 * mm, 14);
  const X = new THREE.Vector3().crossVectors(dn, fc).normalize(), Y = dn.clone().multiplyScalar(-1), Z = new THREE.Vector3().crossVectors(X, Y), M = new THREE.Matrix4().makeBasis(X, Y, Z);
  plate.translate(0, -13 * mm * k, 0); plate.applyMatrix4(M); plate.translate(at.x, at.y, at.z);
  pin.rotateX(Math.PI / 2); pin.applyMatrix4(M); pin.translate(at.x, at.y, at.z);
  const t = shell.lengths[i] / (shell.lengths[shell.lengths.length - 1] || 1);
  for (const g of [plate, pin]) g.setAttribute("along", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(t), 1));
  return [plate, pin];
}
// the joints of an ear's chain: `bones` of them from the root, then its tip (bones + 1 points), on its line
export function earJoints(C, bones) {
  const S = lengths(C), L = S[S.length - 1], out = [];
  for (let b = 0; b <= bones; b++) { const s = L * b / bones; let i = 1; while (i < S.length - 1 && S[i] < s) i++; const f = (s - S[i - 1]) / (S[i] - S[i - 1] || 1); out.push(C[i - 1].clone().lerp(C[i], f)); }
  return out;
}
