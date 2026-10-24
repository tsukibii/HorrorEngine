// jewellery.js: what the Studio's earrings, piercings, necklaces and glasses frames are made of, and how a necklace lies
// (Character Studio, Accessories tab; accessories.js places them). Metals are presets with their own colour (a metal's
// colour is its reflection's, so the studio's environment does the rest) or a PBR set off the shelf (assets/pbr, as a
// garment wears one), gems and pearls their own; charms (a heart, a star, a moon, a cross, a coin, a gem, a pearl, a
// ball) hang from a jump ring. A necklace is a strand of points round the neck dropped by gravity onto the body as it is:
// the neck, the shoulders and the chest as slices (each the skin's outline round its own middle), the strand's length
// kept, the skin pushing it out along its own slope, a pendant's weight pulling the front down.
import * as THREE from "three";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";

// ---- what it's made of --------------------------------------------------------------------------------------------------
// a metal's reflectance (its F0, linear) as an sRGB colour, and how rough it is polished
export const METALS = {
  gold: ["#ffe29d", 0.14], "rose gold": ["#f6c2ae", 0.16], "white gold": ["#f2f0ea", 0.12], silver: ["#fcfaf5", 0.16],
  platinum: ["#d7d2cb", 0.12], steel: ["#c4bdb6", 0.26], copper: ["#fad0c3", 0.2], brass: ["#f4e4b0", 0.26], black: ["#46464c", 0.3],
};
export const METAL_NAMES = Object.keys(METALS);
const MATS = new Map();
// a material by its name: a metal above, "colour" (the colour given, as metal: shine sets how polished), or a set off the
// shelf ("pbr/<name>": its maps; metal unless it's plainly not); `shelf` the shelf's sets (api/pbr)
export function metal(name, colour = "#c8c8cc", shine = 0.75, shelf = {}) {
  const key = `${name}|${colour}|${shine}`;
  if (MATS.has(key)) return MATS.get(key);
  let m;
  if (name && name.startsWith("pbr/") && shelf[name]) m = pbrMaterial(name, shelf[name]);
  else {
    const [col, rough] = METALS[name] || [colour, 0.18];
    m = new THREE.MeshStandardMaterial({ color: col, metalness: 1, roughness: Math.min(1, rough + (0.75 - shine) * 0.6) });
  }
  MATS.set(key, m);
  return m;
}
function pbrMaterial(ref, set) {
  const base = "pbrfile/" + ref.replace(/^pbr\//, "").split("/").map(encodeURIComponent).join("/"), M = set.maps || {};
  const tex = (f, srgb) => {
    const t = new THREE.TextureLoader().load(`${base}/${encodeURIComponent(f)}`, undefined, undefined, () => console.warn(`no map ${ref}/${f}`));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const metallic = !!(M.metal || set.orm) || /metal|gold|silver|brass|copper|steel|iron|chrome|bronze|alumin/i.test(ref);
  const m = new THREE.MeshStandardMaterial({ map: M.albedo ? tex(M.albedo, true) : null, metalness: metallic ? 1 : 0, roughness: 0.35 });
  const nm = M.normal || M.normal_dx;
  if (nm) { m.normalMap = tex(nm); if (!M.normal && M.normal_dx || set.normal === "dx") m.normalScale.set(1, -1); }   // DirectX's green points down
  const orm = set.orm && tex(set.orm);                                   // a packed map: AO red, rough green, metal blue
  if (M.rough || orm) { m.roughnessMap = M.rough ? tex(M.rough) : orm; m.roughness = 1; }
  if (M.metal || orm) { m.metalnessMap = M.metal ? tex(M.metal) : orm; m.metalness = 1; }
  if (M.ao || orm) m.aoMap = M.ao ? tex(M.ao) : orm;
  m.userData.pbr = ref;
  return m;
}
export function gem(colour) {
  const key = "gem|" + colour;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshPhysicalMaterial({ color: colour, metalness: 0.05, roughness: 0.02, clearcoat: 1, iridescence: 0.55, envMapIntensity: 2.6 }));
  return MATS.get(key);
}
export function pearl(colour = "#f3ede2") {
  const key = "pearl|" + colour;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshPhysicalMaterial({ color: colour, metalness: 0, roughness: 0.26, sheen: 1, sheenColor: new THREE.Color("#ffdbe6"),
    sheenRoughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.18, iridescence: 0.35, iridescenceIOR: 1.6, envMapIntensity: 1.3 }));
  return MATS.get(key);
}
export function plain(colour, rough = 0.6) {
  const key = `plain|${colour}|${rough}`;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: 0 }));
  return MATS.get(key);
}

// ---- charms: hung from their top (the origin), down -y, their face toward +z; h their height in metres ----------------
export const CHARMS = ["heart", "star", "moon", "cross", "coin", "gem", "pearl", "ball"];
const shapeOf = (kind, h) => {                         // a flat charm's outline, its top at y=0
  const s = new THREE.Shape();
  if (kind === "heart") {                              // the classic heart curve, its dip at the top
    for (let i = 0; i <= 64; i++) {
      const t = i / 64 * 2 * Math.PI, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const X = x / 32 * h * 1.04, Y = (y - 5) / 29 * h;   // the dip at the top (y 5 -> 0), the point at the bottom (-17 -> -h * 0.76)
      i ? s.lineTo(X, Y) : s.moveTo(X, Y);
    }
  } else if (kind === "star") {
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.2 : 0.5) * h; const X = Math.cos(a) * r, Y = Math.sin(a) * r - 0.5 * h; i ? s.lineTo(X, Y) : s.moveTo(X, Y); }
  } else if (kind === "moon") {                       // a crescent opening to the right
    s.absarc(0, -h / 2, h / 2, Math.PI * 0.3, Math.PI * 1.7, false); s.absarc(h * 0.2, -h / 2, h * 0.38, Math.PI * 1.55, Math.PI * 0.45, true);
  } else if (kind === "cross") {
    const w = 0.13 * h, a = 0.32 * h, top = 0, mid = -0.3 * h;
    [[-w, top], [w, top], [w, mid + w], [a, mid + w], [a, mid - w], [w, mid - w], [w, -h], [-w, -h], [-w, mid - w], [-a, mid - w], [-a, mid + w], [-w, mid + w]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  }
  return s;
};
// a flat charm puffed like a pillow (a flat face of polished metal mirrors one spot of the room, often a dark one: a
// domed one catches the light from all round). A grid over its outline, each point inside raised by the square root of
// how far it is from the edge (a rounded rim, a gentle dome), the back the same; the grid's points just outside are
// moved onto the outline, where front and back meet. `thick` the whole thickness (metres)
function puffed(shape, thick, n = 36) {
  const O = shape.getPoints(24), m = O.length - (O[0].distanceTo(O[O.length - 1]) < 1e-9 ? 1 : 0);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < m; i++) { x0 = Math.min(x0, O[i].x); x1 = Math.max(x1, O[i].x); y0 = Math.min(y0, O[i].y); y1 = Math.max(y1, O[i].y); }
  const step = Math.max(x1 - x0, y1 - y0) / n, nx = Math.ceil((x1 - x0) / step) + 3, ny = Math.ceil((y1 - y0) / step) + 3, gx = x0 - step, gy = y0 - step;
  const near = (px, py) => {                           // the outline's nearest point and whether p is inside (even-odd)
    let best = Infinity, bx = 0, by = 0, inside = false;
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const a = O[j], b = O[i], ex = b.x - a.x, ey = b.y - a.y, t = Math.max(0, Math.min(1, ((px - a.x) * ex + (py - a.y) * ey) / (ex * ex + ey * ey || 1)));
      const qx = a.x + ex * t, qy = a.y + ey * t, d = (px - qx) ** 2 + (py - qy) ** 2;
      if (d < best) { best = d; bx = qx; by = qy; }
      if ((a.y > py) !== (b.y > py) && px < a.x + (py - a.y) / (b.y - a.y) * ex) inside = !inside;
    }
    return { d: Math.sqrt(best), bx, by, inside };
  };
  const G = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = gx + i * step, y = gy + j * step; G.push({ x, y, ...near(x, y) }); }
  const at = (i, j) => G[j * nx + i], ok = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && at(i, j).inside;
  let dmax = 0; for (const g of G) if (g.inside) dmax = Math.max(dmax, g.d);
  const pos = [], idx = [], front = new Int32Array(G.length).fill(-1), back = new Int32Array(G.length).fill(-1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const g = at(i, j), k = j * nx + i;
    if (g.inside) { const z = thick / 2 * Math.sqrt(g.d / dmax); front[k] = pos.length / 3; pos.push(g.x, g.y, z); back[k] = pos.length / 3; pos.push(g.x, g.y, -z); }
    else if ([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(([di, dj]) => ok(i + di, j + dj))) { front[k] = back[k] = pos.length / 3; pos.push(g.bx, g.by, 0); }   // onto the edge
  }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = [j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i];
    if (!c.some(k => G[k].inside) || c.some(k => front[k] < 0)) continue;
    const F = c.map(k => front[k]), B = c.map(k => back[k]);
    idx.push(F[0], F[1], F[2], F[0], F[2], F[3], B[0], B[2], B[1], B[0], B[3], B[2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// the parts of a charm: [{geo, part: "metal" | "gem" | "pearl"}], with its jump ring (threaded across its face)
export function charm(kind, h) {
  const parts = [], ring = new THREE.TorusGeometry(0.09 * h, 0.022 * h, 8, 20).rotateY(Math.PI / 2).translate(0, 0.07 * h, 0);
  if (["heart", "star", "moon", "cross"].includes(kind)) parts.push({ geo: puffed(shapeOf(kind, h), 0.2 * h).translate(0, -0.01 * h, 0), part: "metal" });
  else if (kind === "coin") parts.push({ geo: new THREE.CylinderGeometry(h / 2, h / 2, 0.09 * h, 36).rotateX(Math.PI / 2).translate(0, -h / 2, 0), part: "metal" });
  else if (kind === "gem") {                          // a faceted teardrop in a little cap
    const prof = [[0, 0.05], [0.16, 0.18], [0.3, 0.5], [0.26, 0.75], [0.12, 0.92], [0, 1]].map(([r, y]) => new THREE.Vector2(r * h, -y * h));
    const g = new THREE.LatheGeometry(prof, 8).toNonIndexed(); g.computeVertexNormals();
    parts.push({ geo: g, part: "gem" }, { geo: new THREE.SphereGeometry(0.09 * h, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, -0.03 * h, 0), part: "metal" });
  } else if (kind === "pearl") parts.push({ geo: new THREE.SphereGeometry(h / 2, 24, 16).translate(0, -h / 2 - 0.02 * h, 0), part: "pearl" });
  else parts.push({ geo: new THREE.SphereGeometry(h / 2, 20, 14).translate(0, -h / 2 - 0.02 * h, 0), part: "metal" });
  parts.push({ geo: ring, part: "metal" });
  return parts;
}

// ---- the neck and the chest as slices -------------------------------------------------------------------------------
// From the triangles each slice's plane cuts (MHR's points are far apart in places: an outline from them alone cuts
// through the body), within `side` of the middle (the arms left out); each slice's outline round its own middle as the
// outermost skin by angle. Coarse (a slice near the chin holds the jaw too, one under a short neck the shoulders): the
// distance field below is what a necklace lies on; the slices give a start when neckRing can't and a normal off it.
const BINS = 96;
export class TorsoField {
  constructor(P, T, top, bottom, step, side, depth, mid) {
    const S = Math.max(2, Math.ceil((top - bottom) / step) + 1), tris = [];
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, lo = Math.min(P[a + 1], P[b + 1], P[c + 1]), hi = Math.max(P[a + 1], P[b + 1], P[c + 1]);
      if (hi < bottom - step || lo > top + step) continue;
      const mx = (P[a] + P[b] + P[c]) / 3 - mid.x, mz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - mid.z;
      if (Math.abs(mx) > side || Math.abs(mz) > depth) continue;
      tris.push(a, b, c);
    }
    this.S = S; this.step = step; this.bottom = bottom; this.cx = new Float32Array(S); this.cz = new Float32Array(S); this.R = new Float32Array(S * BINS);
    for (let s = 0; s < S; s++) {
      const y = bottom + s * step, pts = [];
      for (let t = 0; t < tris.length; t += 3) {      // the segment where the plane at y cuts the triangle, sampled every 2 mm
        const cut = [];
        for (let e = 0; e < 3; e++) {
          const p = tris[t + e], q = tris[t + (e + 1) % 3], yp = P[p + 1], yq = P[q + 1];
          if ((yp - y) * (yq - y) > 0 || yp === yq) continue;
          const f = (y - yp) / (yq - yp); cut.push([P[p] + (P[q] - P[p]) * f, P[p + 2] + (P[q + 2] - P[p + 2]) * f]);
        }
        if (cut.length < 2) continue;
        const [[ax, az], [bx, bz]] = cut, n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.002));
        for (let i = 0; i <= n; i++) pts.push(ax + (bx - ax) * i / n, az + (bz - az) * i / n);
      }
      if (!pts.length) continue;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 1]); z1 = Math.max(z1, pts[i + 1]); }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; this.cx[s] = cx; this.cz[s] = cz;
      for (let i = 0; i < pts.length; i += 2) {
        const dx = pts[i] - cx, dz = pts[i + 1] - cz, b = Math.round((Math.atan2(dx, dz) / (2 * Math.PI) + 1) * BINS) % BINS, k = s * BINS + b;
        this.R[k] = Math.max(this.R[k], Math.hypot(dx, dz));
      }
      for (let pass = 0; pass < 6; pass++) for (let b = 0; b < BINS; b++) {   // empty bins from their neighbours
        const k = s * BINS + b; if (this.R[k]) continue;
        const l = this.R[s * BINS + (b + BINS - 1) % BINS], r = this.R[s * BINS + (b + 1) % BINS]; this.R[k] = l && r ? (l + r) / 2 : l || r;
      }
    }
    for (let s = 0; s < S; s++) if (!this.R[s * BINS]) {   // an empty slice takes its neighbour's
      const o = s ? s - 1 : 1; this.cx[s] = this.cx[o]; this.cz[s] = this.cz[o]; this.R.copyWithin(s * BINS, o * BINS, o * BINS + BINS);
    }
    this.top = bottom + (S - 1) * step;
  }
  at(s, phi) { const f = ((phi / (2 * Math.PI)) % 1 + 1) % 1 * BINS, b0 = Math.floor(f) % BINS, b1 = (b0 + 1) % BINS, t = f - Math.floor(f); return this.R[s * BINS + b0] * (1 - t) + this.R[s * BINS + b1] * t; }
  // the outline at height y and angle phi (0 ahead, + toward the character's left): its middle, radius and dR/dy
  shape(y, phi) {
    const f = Math.min(this.S - 1.0001, Math.max(0, (y - this.bottom) / this.step)), s = Math.floor(f), t = f - s;
    const r0 = this.at(s, phi), r1 = this.at(s + 1, phi);
    return { cx: this.cx[s] + (this.cx[s + 1] - this.cx[s]) * t, cz: this.cz[s] + (this.cz[s + 1] - this.cz[s]) * t, r: r0 + (r1 - r0) * t, dr: (r1 - r0) / this.step };
  }
  normal(p) {                                          // the skin's outward normal under p
    const c0 = this.shape(p.y, 0), phi = Math.atan2(p.x - c0.cx, p.z - c0.cz), o = this.shape(p.y, phi), g = Math.hypot(1, o.dr);
    return new THREE.Vector3(Math.sin(phi) / g, -o.dr / g, Math.cos(phi) / g);
  }
}

// ---- the body as a distance field ---------------------------------------------------------------------------------
// The skin round the neck, the shoulders and the chest as signed distances on a grid (h metres apart) in a band either
// side of it (outside > 0), each from the nearest triangle: corners the slices can't hold (where a short neck meets the
// shoulders, the nape, the hollow of the throat) are in it as they are. push(p, gap) moves p out to gap along the
// field's gradient; far from the skin (outside the band) it does nothing.
export class BodySDF {
  constructor(P, T, box, h = 0.004, band = 2) {
    const nx = Math.ceil((box.x1 - box.x0) / h) + 1, ny = Math.ceil((box.y1 - box.y0) / h) + 1, nz = Math.ceil((box.z1 - box.z0) / h) + 1;
    Object.assign(this, { box, h, nx, ny, nz });
    const D = this.D = new Float32Array(nx * ny * nz).fill(Infinity), A = new Float64Array(9), r = band * h;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      for (let k = 0; k < 3; k++) { A[k] = P[a + k]; A[3 + k] = P[b + k]; A[6 + k] = P[c + k]; }
      const lo = [0, 1, 2].map(k => Math.min(A[k], A[3 + k], A[6 + k]) - r), hi = [0, 1, 2].map(k => Math.max(A[k], A[3 + k], A[6 + k]) + r);
      if (hi[0] < box.x0 || lo[0] > box.x1 || hi[1] < box.y0 || lo[1] > box.y1 || hi[2] < box.z0 || lo[2] > box.z1) continue;
      const ux = A[3] - A[0], uy = A[4] - A[1], uz = A[5] - A[2], vx = A[6] - A[0], vy = A[7] - A[1], vz = A[8] - A[2];
      let Nx = uy * vz - uz * vy, Ny = uz * vx - ux * vz, Nz = ux * vy - uy * vx; const nl = Math.hypot(Nx, Ny, Nz) || 1; Nx /= nl; Ny /= nl; Nz /= nl;
      const i0 = Math.max(0, Math.ceil((lo[0] - box.x0) / h)), i1 = Math.min(nx - 1, Math.floor((hi[0] - box.x0) / h));
      const j0 = Math.max(0, Math.ceil((lo[1] - box.y0) / h)), j1 = Math.min(ny - 1, Math.floor((hi[1] - box.y0) / h));
      const k0 = Math.max(0, Math.ceil((lo[2] - box.z0) / h)), k1 = Math.min(nz - 1, Math.floor((hi[2] - box.z0) / h));
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = box.x0 + i * h, y = box.y0 + j * h, z = box.z0 + k * h, q = closest(A, x, y, z), dx = x - q[0], dy = y - q[1], dz = z - q[2], d = Math.hypot(dx, dy, dz);
        if (d > r) continue;
        const at = (k * ny + j) * nx + i;
        if (d < Math.abs(D[at])) D[at] = dx * Nx + dy * Ny + dz * Nz < 0 ? -d : d;   // inside when behind the nearest triangle
      }
    }
  }
  value(x, y, z) {                                      // trilinear; Infinity outside the band (or the box)
    const { box, h, nx, ny, nz, D } = this, fx = (x - box.x0) / h, fy = (y - box.y0) / h, fz = (z - box.z0) / h;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    if (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) return Infinity;
    const tx = fx - i, ty = fy - j, tz = fz - k, at = (k * ny + j) * nx + i, sx = 1, sy = nx, sz = nx * ny;
    const c = [D[at], D[at + sx], D[at + sy], D[at + sx + sy], D[at + sz], D[at + sx + sz], D[at + sy + sz], D[at + sx + sy + sz]];
    if (c.some(v => v === Infinity)) return Infinity;
    const x0 = c[0] + (c[1] - c[0]) * tx, x1 = c[2] + (c[3] - c[2]) * tx, x2 = c[4] + (c[5] - c[4]) * tx, x3 = c[6] + (c[7] - c[6]) * tx;
    return (x0 + (x1 - x0) * ty) * (1 - tz) + (x2 + (x3 - x2) * ty) * tz;
  }
  normal(p) {                                           // the field's gradient: out of the skin
    const e = this.h * 0.5, g = new THREE.Vector3(this.value(p.x + e, p.y, p.z) - this.value(p.x - e, p.y, p.z), this.value(p.x, p.y + e, p.z) - this.value(p.x, p.y - e, p.z), this.value(p.x, p.y, p.z + e) - this.value(p.x, p.y, p.z - e));
    return isFinite(g.x + g.y + g.z) && g.lengthSq() > 0 ? g.normalize() : null;
  }
  push(p, gap) {
    const d = this.value(p.x, p.y, p.z);
    if (!(d < gap)) return null;
    const n = this.normal(p); if (!n) return null;
    p.addScaledVector(n, gap - d);
    return { moved: gap - d, n };
  }
}
function closest(A, px, py, pz) {                      // the closest point of a triangle (A: 9 numbers) to p (Ericson)
  const ax = A[0], ay = A[1], az = A[2], abx = A[3] - ax, aby = A[4] - ay, abz = A[5] - az, acx = A[6] - ax, acy = A[7] - ay, acz = A[8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return [ax, ay, az];
  const bpx = px - A[3], bpy = py - A[4], bpz = pz - A[5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return [A[3], A[4], A[5]];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [ax + abx * v, ay + aby * v, az + abz * v]; }
  const cpx = px - A[6], cpy = py - A[7], cpz = pz - A[8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return [A[6], A[7], A[8]];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [ax + acx * w, ay + acy * w, az + acz * w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [A[3] + (A[6] - A[3]) * w, A[4] + (A[7] - A[4]) * w, A[5] + (A[8] - A[5]) * w]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w];
}

// ---- a necklace, dropped ----------------------------------------------------------------------------------------------
// `length` metres of strand closed round the neck. It's put on as a person does: loose round the neck just under the
// chin (as long as the neck is round there, if it's to be shorter), then it falls and tightens to its length, riding up
// the neck if it must (position-based dynamics: gravity, each link its length, the skin as a distance field pushing
// out, a little friction where it touches): the back catches at the nape, the sides on the shoulders, the front drops
// down the chest. A strand too short to go on stops where it's snug (`length` is then what it is: a choker asks for
// 0). The point opposite the clasp (the front) is `heavy` times as heavy (a pendant). body: {slices (TorsoField: where
// it starts, unless `start` gives its points), sdf (BodySDF: what it touches)}; `gravity` 0 leaves it where it's put
// (a snug choker: friction holds it). Returns the points (Vector3s, closed), its length, the steps it took,
// and `fell` if any point went through the body (it never should).
export function dropNecklace({ slices, sdf }, { y, length, start = null, n = start ? start.length : 48, heavy = 1, gravity = 1, gap = 0.0012, steps = 3600, friction = 0.2, iters = 16 }) {
  const x = [], prev = [], w = [];
  for (let i = 0; i < n; i++) {                        // 0 at the nape (the clasp), n/2 at the front; from `start` (neckRing) or the slices
    const phi = Math.PI + i / n * 2 * Math.PI, o = start ? null : slices.shape(y, phi), r = o ? o.r + gap + 0.0005 : 0;
    x.push(start ? start[i].clone() : new THREE.Vector3(o.cx + Math.sin(phi) * r, y, o.cz + Math.cos(phi) * r)); sdf.push(x[i], gap); prev.push(x[i].clone()); w.push(i === n >> 1 ? 1 / heavy : 1);
  }
  const loop = () => { let L = 0; for (let i = 0; i < n; i++) L += x[i].distanceTo(x[(i + 1) % n]); return L; };
  let rest = Math.max(length, loop() * 1.01) / n, tighten = rest * n > length + 1e-4;
  const g = -9.81 * (1 / 240) ** 2 * gravity, damp = 0.985, maxStep = 0.003, d = new THREE.Vector3(), v = new THREE.Vector3();
  let still = 0, k = 0;
  for (; k < steps; k++) {
    if (tighten) {                                      // 0.3 mm a step, until its length or until it's snug (stretched: it can't)
      rest = Math.max(length / n, rest - 0.0003 / n);
      if (k % 10 === 0 && loop() > rest * n * 1.025) { rest = loop() / n; tighten = false; }
      if (rest * n <= length + 1e-5) tighten = false;
    }
    let speed = 0;
    for (let i = 0; i < n; i++) { v.copy(x[i]).sub(prev[i]).multiplyScalar(damp).clampLength(0, maxStep); prev[i].copy(x[i]); x[i].add(v); x[i].y += g; }
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {                    // each link its length (both ways: the strand neither stretches nor bunches)
        const j = (i + 1) % n; d.copy(x[j]).sub(x[i]); const L = d.length() || 1e-9, c = (L - rest) / L / (w[i] + w[j]);
        x[i].addScaledVector(d, c * w[i]); x[j].addScaledVector(d, -c * w[j]);
      }
      for (let i = 0; i < n; i++) {
        const h = sdf.push(x[i], gap);
        if (h && it === iters - 1) { v.copy(x[i]).sub(prev[i]); const vn = v.dot(h.n); v.addScaledVector(h.n, -vn).multiplyScalar(friction); prev[i].add(v); }   // friction: slide less where it touches
      }
    }
    for (let i = 0; i < n; i++) speed = Math.max(speed, x[i].distanceTo(prev[i]));
    still = speed < 1e-5 && !tighten ? still + 1 : 0;
    if (still > 40) break;
  }
  if (!gravity) for (let pass = 0; pass < 8; pass++) {   // left where it's put, it keeps the bumps it started with: smoothed along itself, on the skin
    const y = x.map((p, i) => p.clone().multiplyScalar(2).add(x[(i + n - 1) % n]).add(x[(i + 1) % n]).multiplyScalar(0.25));
    for (let i = 0; i < n; i++) { x[i].copy(y[i]); sdf.push(x[i], gap); }
  }
  return { points: x, length: rest * n, steps: k, fell: x.some(p => p.y < sdf.box.y0 + 0.01) };
}

// a ring round the neck at height y (at its middle line x), in a plane tilted `tilt` radians down to the front: from the
// neck's middle out to its own skin each way (the first skin met: at the sides the shoulders can stand further out at
// the same height), gap off it. Its points (0 at the nape, n/2 at the front) and its length, or null if the neck isn't
// there (outside the field)
export function neckRing(sdf, x, y, n = 48, gap = 0.0012, tilt = 0) {
  const { box } = sdf, step = 0.001, slope = Math.tan(tilt);
  let zf = null, zb = null;                            // the throat and the nape on the middle line: the neck's middle between
  for (let z = box.z1; z > box.z0 && zf === null; z -= step) if (sdf.value(x, y, z) < gap) zf = z;
  for (let z = box.z0; z < box.z1 && zb === null; z += step) if (sdf.value(x, y, z) < gap) zb = z;
  if (zf === null || zb === null || zf - zb < 0.04) return null;
  const cz = (zf + zb) / 2, points = [];
  for (let i = 0; i < n; i++) {
    const phi = Math.PI + i / n * 2 * Math.PI, sx = Math.sin(phi), sz = Math.cos(phi);
    let inside = false, at = null;
    for (let r = 0; r < 0.15 && !at; r += step) {
      const px = x + sx * r, pz = cz + sz * r, py = y - slope * (pz - cz), v = sdf.value(px, py, pz);
      if (v < 0) inside = true;
      else if (inside && v >= gap && v !== Infinity) at = new THREE.Vector3(px, py, pz);
    }
    if (!at) return null;
    points.push(at);
  }
  let length = 0; for (let i = 0; i < n; i++) length += points[i].distanceTo(points[(i + 1) % n]);
  return { points, length };
}

// the neck's narrowest girth between the heights `from` and `to` (from above), over a few tilts (the neck leans
// forward: round it, the front is lower), its front no higher than `below` (under the chin, seen): where a choker sits,
// snug. {y, tilt, length}
export function neckWaist(sdf, x, from, to, below, gap = 0.0012) {
  let best = null;
  for (let y = from; y >= to - 1e-9; y -= 0.002) for (const tilt of [0, 0.1, 0.2, 0.3]) {
    const r = neckRing(sdf, x, y, 32, gap, tilt);
    if (r && r.points[16].y <= below && (!best || r.length < best.length)) best = { y, tilt, length: r.length };
  }
  return best;
}

// ---- drawing a strand ---------------------------------------------------------------------------------------------------
// the settled points as a smooth closed curve; along it the strand's own pieces, each placed by `normal(p)` (the skin's
// outward normal there) so links, beads and a ribbon sit on the body. Returns one merged geometry per material part.
export function strand(points, style, size, normal, push) {
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal"), L = curve.getLength(), out = { metal: [], cord: [], pearl: [], bead: [] };
  const frames = count => {                           // count places along it: the point (a curve between two points on the skin can dip into it: out again), the way
    const F = [];                                     // along, and the skin's normal smoothed over a centimetre (the field's is a 4 mm grid's: a ribbon on it crumples)
    for (let i = 0; i < count; i++) { const u = i / count, p = curve.getPointAt(u), t = curve.getTangentAt(u).normalize(), n = normal(p); if (push) push(p); F.push({ p, t, n }); }
    const R = Math.max(1, Math.round(0.005 / (L / count))), N = F.map((f, i) => { const s = new THREE.Vector3(); for (let k = -R; k <= R; k++) s.add(F[(i + k + count) % count].n); return s; });
    F.forEach((f, i) => { f.n = N[i].addScaledVector(f.t, -N[i].dot(f.t)).normalize(); f.b = new THREE.Vector3().crossVectors(f.t, f.n); });
    return F;
  };
  const place = (geo, f, X, Y) => { const Z = new THREE.Vector3().crossVectors(X, Y); return geo.clone().applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(f)); };
  if (style === "chain") {                             // oval links, each turned a quarter from the last
    const R = 0.0016 * size, r = 0.00042 * size, pitch = 2 * R * 1.05, link = new THREE.TorusGeometry(R, r, 6, 14).scale(1.35, 1, 1), count = Math.max(8, Math.round(L / pitch)), F = frames(count);
    for (let i = 0; i < count; i++) { const q = F[i], up = i % 2 === 0; out.metal.push(place(link, q.p.clone().addScaledVector(q.n, (up ? R : 0) + r + 0.0004), q.t, up ? q.n : q.b)); }   // a link on its edge sits a radius off the skin
  } else if (style === "pearls" || style === "beads") {   // spheres touching along it (beads on a fine cord)
    const r = (style === "pearls" ? 0.0036 : 0.0024) * size, count = Math.max(6, Math.floor(L / (2 * r * 1.03))), ball = new THREE.SphereGeometry(r, 16, 12), F = frames(count);
    for (let i = 0; i < count; i++) { const q = F[i]; out[style === "pearls" ? "pearl" : "bead"].push(ball.clone().translate(q.p.x, q.p.y, q.p.z).translate(q.n.x * r, q.n.y * r, q.n.z * r)); }
    if (style === "beads") out.cord.push(new THREE.TubeGeometry(curve, Math.round(L / 0.003), 0.0005 * size, 5, true));
  } else if (style === "choker") {                    // a ribbon flat on the skin
    const W = 0.012 * size, T = 0.0012, count = Math.max(48, Math.round(L / 0.003)), pos = [], idx = [], F = frames(count);
    for (let i = 0; i <= count; i++) {
      const q = F[i % count], base = q.p.clone().addScaledVector(q.n, 0.0004);
      for (const [dw, dt] of [[-W / 2, 0], [W / 2, 0], [W / 2, T], [-W / 2, T]]) {
        const v = base.clone().addScaledVector(q.b, dw); if (dw && push) push(v);   // its edges off the skin where the neck curves under it
        pos.push(...v.addScaledVector(q.n, dt).toArray());
      }
    }
    for (let i = 0; i < count; i++) for (let s = 0; s < 4; s++) { const a = i * 4 + s, b = i * 4 + (s + 1) % 4; idx.push(a, a + 4, b, b, a + 4, b + 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); out.cord.push(g);
  } else out.cord.push(new THREE.TubeGeometry(curve, Math.round(L / 0.003), 0.0011 * size, 8, true));   // a cord
  const merged = {};
  for (const [k, list] of Object.entries(out)) if (list.length) merged[k] = list.length === 1 ? list[0] : mergeGeometries(list);   // clones of one shape: they merge as they are
  return { geos: merged, curve, length: L };
}
