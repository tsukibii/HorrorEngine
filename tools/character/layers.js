// Paint by vertex, in layers (the Character Studio's Layers tab). Our own code.
//
// A selection is a set of vertices (brush, flood, region, grow and shrink on the mesh's own surface), with a bleed (a hard
// grow) and an inner and outer feather measured along the surface, like a feathered selection in Photoshop. A Fill freezes the
// selection's weights into a layer: its colour, a PNG projected onto the skin, a PBR set tiled on it, or a texture already in
// MHR's UV layout. Layers sit above the base mesh and never touch it: delete them and the base is what's left.
//
// Every layer is baked into MHR's UV space (SIZE x SIZE) by walking each triangle once (the index is built once: the UVs never
// change; the positions are read live). Layers are merged into three textures the skin shader reads:
//   ov   RGBA  paint laid over the skin (premultiplied alpha)                                  (a layer with pigment off)
//   pig  RGB   transmittance, white = none: pigment layers are multiplied together, so   (a layer with pigment on)
//              two pigments mix like filters (blue x green goes dark teal) and order doesn't matter
//   surf RGBA  R roughness multiplier x4 · G clear coat (gloss) · B relief · A coat roughness
//   glow RGBA  RGB light from within (thin skin: ears, nose tip, cheeks) · A how much the pores, grain and relief are smoothed away
// Pigment layers show under the overlay ones whatever their order in the list (a limit of keeping them in separate textures).
import * as THREE from "three";

export const SIZE = 1024;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const hex2rgb = h => { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// an image as pixels, for sampling (large ones are shrunk: the bake samples, it doesn't need 8K)
export class Pix {
  constructor(src, max = 1024) {
    const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height, k = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(src, 0, 0, c.width, c.height);
    this.w = c.width; this.h = c.height; this.d = g.getImageData(0, 0, c.width, c.height).data;
    this.url = null;
  }
  mean() {                                   // the alpha-weighted average colour (for "relative": a photo's own skin tone divided out)
    let r = 0, g = 0, b = 0, a = 0; const d = this.d;
    for (let i = 0; i < d.length; i += 4) { const w = d[i + 3] / 255; r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; a += w; }
    return a ? [r / a / 255, g / a / 255, b / a / 255] : [1, 1, 1];
  }
  // bilinear; wrap tiles it, otherwise outside the picture is transparent. out = [r, g, b, a] in 0..1
  at(u, v, wrap, out) {
    if (!wrap && (u < 0 || u > 1 || v < 0 || v > 1)) { out[0] = out[1] = out[2] = out[3] = 0; return out; }
    let x = u * this.w - 0.5, y = v * this.h - 0.5;
    let x0 = Math.floor(x), y0 = Math.floor(y); const fx = x - x0, fy = y - y0;
    const W = this.w, H = this.h, d = this.d;
    const X = i => wrap ? ((i % W) + W) % W : clamp(i, 0, W - 1), Y = j => wrap ? ((j % H) + H) % H : clamp(j, 0, H - 1);
    const xa = X(x0), xb = X(x0 + 1), ya = Y(y0), yb = Y(y0 + 1);
    const p00 = (ya * W + xa) * 4, p10 = (ya * W + xb) * 4, p01 = (yb * W + xa) * 4, p11 = (yb * W + xb) * 4;
    for (let k = 0; k < 4; k++) out[k] = ((d[p00 + k] * (1 - fx) + d[p10 + k] * fx) * (1 - fy) + (d[p01 + k] * (1 - fx) + d[p11 + k] * fx) * fy) / 255;
    return out;
  }
}

export const DEFAULT_FILL = () => ({
  type: "colour", colour: "#c23a4f",
  image: { mode: "front", size: 12, rot: 0, ox: 0, oy: 0, tile: false, relative: false },     // size in cm; tile on for textures, off for a decal
  pbr: { size: 20, rough: 1, height: 0.6, ao: 1, tint: "#ffffff" },
  grad: { c2: "#f3a6ae", mode: "radial", alpha: "flat", gamma: 1, angle: 90, len: 4 },   // c2 is the edge colour; alpha: flat, fading out toward the edge (centre) or toward the middle (edge)
  opacity: 1, pigment: false, density: 2.2, cover: 0.15,
  shine: 0, oil: 0, tight: 0.25, glow: 0, glowColour: "#ff5a3c", smooth: 0,
});

export class SkinLayers {
  // N points, TRIS (3 per triangle, into the points), UV (2 per corner), getPos()/getNrm(): the live positions and normals
  constructor({ N, TRIS, UV, getPos, getNrm }) {
    Object.assign(this, { N, TRIS, UV, getPos, getNrm });
    this.sel = new Uint8Array(N); this.layers = []; this.nextId = 1; this.anchor = [0, 1.6, 0.1]; this.neckY = 1.45;
    this.ov = new Uint8Array(SIZE * SIZE * 4); this.pig = new Uint8Array(SIZE * SIZE * 4).fill(255); this.surf = new Uint8Array(SIZE * SIZE * 4);
    const tex = (d, srgb) => { const t = new THREE.DataTexture(d, SIZE, SIZE, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
    this.glow = new Uint8Array(SIZE * SIZE * 4); this.texGlow = tex(this.glow, true); this.texOv = tex(this.ov, true); this.texPig = tex(this.pig, true); this.texSurf = tex(this.surf, false);
    this.buildAdjacency(); this.buildIndex();
    this.onChange = () => { };
  }

  // ---- the mesh: neighbours (for distances along the surface) and the UV index (which triangle each texel is in) ----
  buildAdjacency() {
    const { N, TRIS } = this, deg = new Uint32Array(N + 1);
    for (let t = 0; t < TRIS.length; t += 3) for (let k = 0; k < 3; k++) deg[TRIS[t + k] + 1] += 2;
    for (let i = 0; i < N; i++) deg[i + 1] += deg[i];
    this.adjStart = deg; this.adj = new Uint32Array(deg[N]); const fill = deg.slice(0, N);
    for (let t = 0; t < TRIS.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = TRIS[t + k], b = TRIS[t + (k + 1) % 3], c = TRIS[t + (k + 2) % 3];
      this.adj[fill[a]++] = b; this.adj[fill[a]++] = c;
    }
  }
  buildIndex() {
    const S = SIZE, { TRIS, UV } = this;
    const tri = this.tri = new Int32Array(S * S).fill(-1), bu = this.bu = new Float32Array(S * S), bv = this.bv = new Float32Array(S * S);
    for (let t = 0; t < TRIS.length / 3; t++) {
      const x = [0, 1, 2].map(k => UV[(t * 3 + k) * 2] * S), y = [0, 1, 2].map(k => UV[(t * 3 + k) * 2 + 1] * S);
      const area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(...x))), x1 = Math.min(S - 1, Math.ceil(Math.max(...x)));
      const y0 = Math.max(0, Math.floor(Math.min(...y))), y1 = Math.min(S - 1, Math.ceil(Math.max(...y)));
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const px = i + 0.5, py = j + 0.5;
        const w1 = ((px - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (py - y[0])) / area;
        const w2 = ((x[1] - x[0]) * (py - y[0]) - (px - x[0]) * (y[1] - y[0])) / area, w0 = 1 - w1 - w2;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const p = j * S + i; tri[p] = t; bu[p] = w1; bv[p] = w2;
      }
    }
    for (let pass = 0; pass < 6; pass++) {                    // a gutter: texels just outside an island borrow their neighbour's place (no seams under filtering)
      const t2 = tri.slice(), u2 = bu.slice(), v2 = bv.slice();
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const p = j * S + i; if (tri[p] >= 0) continue;
        for (const q of [i > 0 ? p - 1 : -1, i < S - 1 ? p + 1 : -1, j > 0 ? p - S : -1, j < S - 1 ? p + S : -1]) if (q >= 0 && tri[q] >= 0) { t2[p] = tri[q]; u2[p] = bu[q]; v2[p] = bv[q]; break; }
      }
      tri.set(t2); bu.set(u2); bv.set(v2);
    }
  }

  // ---- distances along the surface: Dijkstra over the edges, from every source at once, as far as `limit` ----
  distance(isSource, limit) {
    const { N, adjStart, adj } = this, P = this.getPos(), dist = new Float64Array(N).fill(Infinity);          // doubles: float32 rounding made equal paths look shorter and looped forever
    const hk = [], hv = [];                                   // a binary heap of (distance, vertex)
    const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
    const pop = () => { const k = hk[0], v = hv[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hk.length && hk[l] < hk[m]) m = l; if (r < hk.length && hk[r] < hk[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return [k, v]; };
    for (let i = 0; i < N; i++) if (isSource(i)) { dist[i] = 0; push(0, i); }
    while (hk.length) {
      const [d, v] = pop(); if (d > dist[v]) continue;
      for (let e = adjStart[v]; e < adjStart[v + 1]; e++) {
        const u = adj[e], dx = P[u * 3] - P[v * 3], dy = P[u * 3 + 1] - P[v * 3 + 1], dz = P[u * 3 + 2] - P[v * 3 + 2], nd = d + Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (nd < dist[u] && nd <= limit) { dist[u] = nd; push(nd, u); }
      }
    }
    return dist;
  }

  // ---- the selection ----
  count() { let n = 0; for (let i = 0; i < this.N; i++) n += this.sel[i]; return n; }
  clear() { this.sel.fill(0); }
  all() { this.sel.fill(1); }
  invert() { for (let i = 0; i < this.N; i++) this.sel[i] ^= 1; }
  brush(v, radius, add) {                                     // every point within `radius` metres of v along the surface
    const d = this.distance(i => i === v, radius);
    for (let i = 0; i < this.N; i++) if (d[i] <= radius) this.sel[i] = add ? 1 : 0;
  }
  flood(v, maxDist, angleDeg, add) {                           // out from v while the surface doesn't bend more than the angle from one point to the next
    const { adjStart, adj } = this, Nn = this.getNrm(), P = this.getPos(), cosA = Math.cos(angleDeg * Math.PI / 180);
    const seen = new Uint8Array(this.N), q = [v]; seen[v] = 1;
    const d0 = this.distance(i => i === v, maxDist);
    while (q.length) {
      const a = q.pop(); this.sel[a] = add ? 1 : 0;
      for (let e = adjStart[a]; e < adjStart[a + 1]; e++) {
        const b = adj[e]; if (seen[b] || d0[b] > maxDist) continue;
        if (Nn[a * 3] * Nn[b * 3] + Nn[a * 3 + 1] * Nn[b * 3 + 1] + Nn[a * 3 + 2] * Nn[b * 3 + 2] < cosA) continue;
        seen[b] = 1; q.push(b);
      }
    }
  }
  region(name) {                                              // the head (from the chin up) or the body (below it)
    const P = this.getPos();
    for (let i = 0; i < this.N; i++) this.sel[i] = (name === "head" ? P[i * 3 + 1] >= this.neckY : P[i * 3 + 1] < this.neckY) ? 1 : 0;
  }
  grow(mm) { const d = this.distance(i => this.sel[i] === 1, mm / 1000); for (let i = 0; i < this.N; i++) if (d[i] <= mm / 1000) this.sel[i] = 1; }
  shrink(mm) { const d = this.distance(i => this.sel[i] === 0, mm / 1000); for (let i = 0; i < this.N; i++) if (d[i] <= mm / 1000) this.sel[i] = 0; }
  // the selection's weights per point: a bleed (a hard grow), then feathers along the surface: inner ramps up from the edge into the
  // selection, outer fades out from the edge. 0 for both is a hard edge (at the mesh's own resolution).
  weights(bleedMm = 0, innerMm = 0, outerMm = 0) {
    const N = this.N, sel = Uint8Array.from(this.sel);
    if (bleedMm > 0) { const d = this.distance(i => sel[i] === 1, bleedMm / 1000); for (let i = 0; i < N; i++) if (d[i] <= bleedMm / 1000) sel[i] = 1; }
    const w = new Float32Array(N);
    const dOut = outerMm > 0 ? this.distance(i => sel[i] === 1, outerMm / 1000) : null, dIn = innerMm > 0 ? this.distance(i => sel[i] === 0, innerMm / 1000) : null;
    for (let i = 0; i < N; i++) {
      if (sel[i]) w[i] = dIn ? smooth(Math.min(dIn[i], innerMm / 1000) / (innerMm / 1000)) : 1;
      else w[i] = dOut && dOut[i] < Infinity ? 1 - smooth(dOut[i] / (outerMm / 1000)) : 0;
    }
    return w;
  }

  // ---- erasing from a layer: a soft or sharp brush takes its weights down (or, restoring, back toward what the fill first poured) ----
  // soft 0 is a hard disc, 1 fades from the dab's centre to its rim; strength is how much one dab takes
  erase(L, v, radius, soft, strength, restore = false) {
    const d = this.distance(i => i === v, radius), s = clamp(soft, 0, 1);
    for (let i = 0; i < this.N; i++) {
      if (d[i] > radius) continue;
      const t = d[i] / radius, f = s <= 0.001 || t <= 1 - s ? 1 : 1 - smooth((t - (1 - s)) / s), k = clamp(strength * f);
      L.w[i] = restore ? L.w[i] + (L.w0[i] - L.w[i]) * k : L.w[i] * (1 - k);
    }
    L.stale = true; clearTimeout(this._e); this._e = setTimeout(() => this.update(), 90);          // the bake waits for the drag to pause
  }

  // ---- layers ----
  centroid(w) {                                                      // where the selection is: a picture lands centred on it
    const P = this.getPos(); let x = 0, y = 0, z = 0, c = 0;
    for (let i = 0; i < this.N; i++) if (w[i] > 0.5) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; c++; }
    return c ? [x / c, y / c, z / c] : this.anchor.slice();
  }
  depthOf(w) {                                                        // 0 at the selection's edge, 1 at its deepest point, along the surface
    const d = this.distance(i => w[i] < 0.5, Infinity); let m = 1e-6;
    for (let i = 0; i < this.N; i++) if (w[i] >= 0.5 && d[i] < Infinity) m = Math.max(m, d[i]);
    return Float32Array.from(d, (x, i) => w[i] < 0.5 ? 0 : Math.min(1, x / m));
  }
  add(name, w, fill) {
    const L = { id: this.nextId++, name, visible: true, w: Float32Array.from(w), ...structuredClone({ ...fill, imgs: undefined }), imgs: fill.imgs || {} };
    L.depth = this.depthOf(w); L.w0 = Float32Array.from(L.w); L.anchor = this.centroid(w); L.stale = true; this.layers.push(L); this.update(); return L;
  }
  remove(L) { this.layers.splice(this.layers.indexOf(L), 1); this.update(); }
  move(L, d) { const i = this.layers.indexOf(L), j = i + d; if (j < 0 || j >= this.layers.length) return; this.layers.splice(i, 1); this.layers.splice(j, 0, L); this.compose(); }
  touch(L, rebake = true) { if (rebake) L.stale = true; this.update(); }
  shapeChanged() { for (const L of this.layers) L.stale = true; clearTimeout(this._t); if (this.layers.length) this._t = setTimeout(() => this.update(), 400); }
  update() { for (const L of this.layers) if (L.stale && L.visible) this.bake(L); this.compose(); this.onChange(); }

  texelWeights(w) {
    const S = SIZE, n = S * S, T = this.TRIS; let a = new Float32Array(n), b = new Float32Array(n);
    for (let p = 0; p < n; p++) { const t = this.tri[p]; if (t < 0) continue; const b1 = this.bu[p], b2 = this.bv[p]; a[p] = (1 - b1 - b2) * w[T[t * 3]] + b1 * w[T[t * 3 + 1]] + b2 * w[T[t * 3 + 2]]; }
    for (let pass = 0; pass < 2; pass++) {                           // a box blur, x then y, twice: about a 5 texel soften
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let s = 0, c = 0; for (let d = -2; d <= 2; d++) { const x = i + d; if (x < 0 || x >= S) continue; const q = j * S + x; if (this.tri[q] < 0) continue; s += a[q]; c++; } b[j * S + i] = c ? s / c : 0; }
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let s = 0, c = 0; for (let d = -2; d <= 2; d++) { const y = j + d; if (y < 0 || y >= S) continue; const q = y * S + i; if (this.tri[q] < 0) continue; s += b[q]; c++; } a[j * S + i] = c ? s / c : 0; }
    }
    return a;
  }
  // one layer into UV space: its colour and alpha (mask x the picture's own alpha), its roughness and height from a PBR set
  bake(L) {
    L.stale = false; const S = SIZE, n = S * S, P = this.getPos(), Nn = this.getNrm(), T = this.TRIS, [ax, ay, az] = L.anchor || this.anchor;
    const rgba = L.rgba = new Uint8Array(n * 4), rm = L.rm = new Uint8Array(n).fill(64), ht = L.ht = new Uint8Array(n).fill(128);
    const px = [0, 0, 0, 0], tmp = [0, 0, 0, 0], colour = hex2rgb(L.colour), tint = hex2rgb(L.pbr.tint);
    const img = L.imgs.image, mean = img && L.image.relative ? img.mean() : null;
    const alb = L.imgs.albedo, rgh = L.imgs.rough, hgt = L.imgs.height, aoM = L.imgs.ao;
    const type = L.type, I = L.image, B = L.pbr;
    const rot = (I.rot || 0) * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
    const planar = (mode, x, y, z, s, ox, oy) => {              // the picture's u, v for a point: the camera looking along an axis, in cm from the anchor
      let a, b;
      if (mode === "side") { a = -(z - az); b = y - ay; } else if (mode === "top") { a = x - ax; b = -(z - az); } else { a = x - ax; b = y - ay; }
      a = a * 100 - ox; b = b * 100 - oy;
      const u = (a * cr + b * sr) / s + 0.5, v = 0.5 - (-a * sr + b * cr) / s;
      return [u, v];
    };
    const MT = this.texelWeights(L.w);                               // the mask per texel, softened a little (the mesh's points are coarser than the texels)
    for (let p = 0; p < n; p++) {
      const t = this.tri[p]; if (t < 0) continue;
      const v0 = T[t * 3], v1 = T[t * 3 + 1], v2 = T[t * 3 + 2], b1 = this.bu[p], b2 = this.bv[p], b0 = 1 - b1 - b2;
      const m = MT[p]; if (m < 0.002) continue;
      let r = colour[0], g = colour[1], b = colour[2], a = m, rmv = 1, h = 0.5;
      if (type === "gradient") {
        const G = L.grad; let t;
        if (G.mode === "linear") {
          const x = b0 * P[v0 * 3] + b1 * P[v1 * 3] + b2 * P[v2 * 3], y = b0 * P[v0 * 3 + 1] + b1 * P[v1 * 3 + 1] + b2 * P[v2 * 3 + 1], an = G.angle * Math.PI / 180;
          t = clamp(((x - ax) * Math.cos(an) + (y - ay) * Math.sin(an)) * 100 / G.len + 0.5);        // from the colour (0) to the second colour (1) along an angle, len cm across
        } else t = 1 - (b0 * L.depth[v0] + b1 * L.depth[v1] + b2 * L.depth[v2]);                     // the colour in the middle, the second at the edge
        const tg = Math.pow(t, Math.max(0.1, G.gamma)), c2 = hex2rgb(G.c2);
        r = colour[0] + (c2[0] - colour[0]) * tg; g = colour[1] + (c2[1] - colour[1]) * tg; b = colour[2] + (c2[2] - colour[2]) * tg;
        if (G.mode !== "linear") a = m * (G.alpha === "centre" ? Math.pow(1 - t, 0.8) : G.alpha === "edge" ? Math.pow(t, 0.8) : 1);       // fade out toward the edge, or toward the middle (a rim)
      } else if (type === "uv" && img) {                                  // a texture already in MHR's layout (the photo skin, one painted elsewhere)
        img.at((p % S + 0.5) / S, 1 - (Math.floor(p / S) + 0.5) / S, false, px); r = px[0]; g = px[1]; b = px[2]; a = m * px[3];
        if (mean) { r = clamp(r / Math.max(mean[0], 0.02), 0, 1.25); g = clamp(g / Math.max(mean[1], 0.02), 0, 1.25); b = clamp(b / Math.max(mean[2], 0.02), 0, 1.25); }
      } else if (type === "image" || type === "pbr") {
        const x = b0 * P[v0 * 3] + b1 * P[v1 * 3] + b2 * P[v2 * 3], y = b0 * P[v0 * 3 + 1] + b1 * P[v1 * 3 + 1] + b2 * P[v2 * 3 + 1], z = b0 * P[v0 * 3 + 2] + b1 * P[v1 * 3 + 2] + b2 * P[v2 * 3 + 2];
        if (type === "image" && img) {
          let nx = 0, ny = 0, nz = 0; nx = b0 * Nn[v0 * 3] + b1 * Nn[v1 * 3] + b2 * Nn[v2 * 3]; ny = b0 * Nn[v0 * 3 + 1] + b1 * Nn[v1 * 3 + 1] + b2 * Nn[v2 * 3 + 1]; nz = b0 * Nn[v0 * 3 + 2] + b1 * Nn[v1 * 3 + 2] + b2 * Nn[v2 * 3 + 2];
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          if (I.mode === "tri") {                                  // three projections, blended by how much the surface faces each
            const wx = Math.pow(Math.abs(nx), 4), wy = Math.pow(Math.abs(ny), 4), wz = Math.pow(Math.abs(nz), 4), ws = wx + wy + wz || 1;
            let ar = 0, ag = 0, ab = 0, aa = 0;
            for (const [w, mode] of [[wx / ws, "side"], [wy / ws, "top"], [wz / ws, "front"]]) { if (w < 0.01) continue; const [u, v] = planar(mode, x, y, z, I.size, I.ox, I.oy); img.at(u, v, I.tile, tmp); ar += tmp[0] * tmp[3] * w; ag += tmp[1] * tmp[3] * w; ab += tmp[2] * tmp[3] * w; aa += tmp[3] * w; }
            if (aa > 0.001) { r = ar / aa; g = ag / aa; b = ab / aa; } a = m * aa;
          } else {
            const [u, v] = planar(I.mode, x, y, z, I.size, I.ox, I.oy); img.at(u, v, I.tile, px);
            const face = I.mode === "side" ? -nx : I.mode === "top" ? ny : nz;               // not onto the far side of the head
            r = px[0]; g = px[1]; b = px[2]; a = m * px[3] * smooth((face + 0.05) / 0.4);
          }
          if (mean) { r = clamp(r / Math.max(mean[0], 0.02), 0, 1.25); g = clamp(g / Math.max(mean[1], 0.02), 0, 1.25); b = clamp(b / Math.max(mean[2], 0.02), 0, 1.25); }
        } else if (type === "pbr") {
          let nx = b0 * Nn[v0 * 3] + b1 * Nn[v1 * 3] + b2 * Nn[v2 * 3], ny = b0 * Nn[v0 * 3 + 1] + b1 * Nn[v1 * 3 + 1] + b2 * Nn[v2 * 3 + 1], nz = b0 * Nn[v0 * 3 + 2] + b1 * Nn[v1 * 3 + 2] + b2 * Nn[v2 * 3 + 2];
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const wx = Math.pow(Math.abs(nx), 4), wy = Math.pow(Math.abs(ny), 4), wz = Math.pow(Math.abs(nz), 4), ws = wx + wy + wz || 1;
          let ar = 0, ag = 0, ab = 0, rr = 0, hh = 0, oo = 0, cnt = 0;
          for (const [w, mode] of [[wx / ws, "side"], [wy / ws, "top"], [wz / ws, "front"]]) {
            if (w < 0.01) continue; const [u, v] = planar(mode, x, y, z, B.size, 0, 0); cnt += w;
            if (alb) { alb.at(u, v, true, tmp); ar += tmp[0] * w; ag += tmp[1] * w; ab += tmp[2] * w; } else { ar += w; ag += w; ab += w; }
            if (rgh) { rgh.at(u, v, true, tmp); rr += tmp[0] * w; } else rr += 0.5 * w;
            if (hgt) { hgt.at(u, v, true, tmp); hh += tmp[0] * w; } else hh += 0.5 * w;
            if (aoM) { aoM.at(u, v, true, tmp); oo += tmp[0] * w; } else oo += w;
          }
          const ao = 1 - B.ao * (1 - oo / cnt);
          r = ar / cnt * tint[0] * ao; g = ag / cnt * tint[1] * ao; b = ab / cnt * tint[2] * ao;
          rmv = 1 + (clamp(rr / cnt * 2, 0.05, 3) - 1) * B.rough; h = 0.5 + (hh / cnt - 0.5) * B.height;
        }
      }
      const o = p * 4; rgba[o] = clamp(r) * 255; rgba[o + 1] = clamp(g) * 255; rgba[o + 2] = clamp(b) * 255; rgba[o + 3] = clamp(a) * 255;
      rm[p] = clamp(rmv * 64, 0, 255); ht[p] = clamp(h * 255, 0, 255);
    }
  }

  // the visible layers into the three textures
  compose() {
    const S = SIZE, n = S * S, ov = this.ov, pig = this.pig, sf = this.surf;
    ov.fill(0); pig.fill(255); sf.fill(0); this.glow.fill(0);
    const R = new Float32Array(n).fill(1), COAT = new Float32Array(n), COATR = new Float32Array(n), HT = new Float32Array(n);
    const GR = new Float32Array(n), GG = new Float32Array(n), GB = new Float32Array(n), SM = new Float32Array(n);
    const oR = new Float32Array(n), oG = new Float32Array(n), oB = new Float32Array(n), oA = new Float32Array(n);   // premultiplied
    const pR = new Float32Array(n).fill(1), pG = new Float32Array(n).fill(1), pB = new Float32Array(n).fill(1);
    let any = false;
    for (const L of this.layers) {
      if (!L.visible || !L.rgba) continue; any = true; const gcol = hex2rgb(L.glowColour || "#ff5a3c"), glow = L.glow || 0, smo = L.smooth || 0;
      const op = L.opacity, dens = L.density, cover = L.cover, shine = L.shine, oil = L.oil, rmL = (1 - 0.5 * shine) * (1 - 0.55 * oil), tight = L.tight;
      for (let p = 0; p < n; p++) {
        const o = p * 4, a = L.rgba[o + 3] / 255 * op; if (a < 0.003) continue;
        const r = L.rgba[o] / 255, g = L.rgba[o + 1] / 255, b = L.rgba[o + 2] / 255;
        if (L.pigment) {
          const d = dens * a; pR[p] *= Math.pow(Math.max(r, 0.004), d); pG[p] *= Math.pow(Math.max(g, 0.004), d); pB[p] *= Math.pow(Math.max(b, 0.004), d);
          const c = clamp(cover * a);                               // a little of the pigment hides the base, like paint
          if (c > 0) { oR[p] = r * c + oR[p] * (1 - c); oG[p] = g * c + oG[p] * (1 - c); oB[p] = b * c + oB[p] * (1 - c); oA[p] = c + oA[p] * (1 - c); }
        } else { oR[p] = r * a + oR[p] * (1 - a); oG[p] = g * a + oG[p] * (1 - a); oB[p] = b * a + oB[p] * (1 - a); oA[p] = a + oA[p] * (1 - a); }
        R[p] *= 1 + (L.rm[p] / 64 * rmL - 1) * a;
        const cw = shine * a; if (cw > 0) { COATR[p] = (COATR[p] * COAT[p] + (1 - 0.8 * tight) * cw) / (COAT[p] + cw); COAT[p] = Math.min(1, COAT[p] + cw); }
        HT[p] += (L.ht[p] / 255 - 0.5) * a;
        if (glow > 0) { GR[p] += gcol[0] * glow * a; GG[p] += gcol[1] * glow * a; GB[p] += gcol[2] * glow * a; }
        if (smo > 0) SM[p] = Math.min(1, SM[p] + smo * a);
      }
    }
    for (let p = 0; p < n; p++) {
      const o = p * 4, a = oA[p];
      if (a > 0.002) { ov[o] = oR[p] * 255; ov[o + 1] = oG[p] * 255; ov[o + 2] = oB[p] * 255; ov[o + 3] = a * 255; }      // premultiplied: filtering the texture never pulls a clear texel's black into the edge
      pig[o] = pR[p] * 255; pig[o + 1] = pG[p] * 255; pig[o + 2] = pB[p] * 255; pig[o + 3] = 255;
      this.glow[o] = clamp(GR[p]) * 255; this.glow[o + 1] = clamp(GG[p]) * 255; this.glow[o + 2] = clamp(GB[p]) * 255; this.glow[o + 3] = SM[p] * 255;
      sf[o] = clamp(R[p] * 64, 0, 255); sf[o + 1] = COAT[p] * 255; sf[o + 2] = clamp(128 + HT[p] * 255, 0, 255); sf[o + 3] = COATR[p] * 255;
    }
    this.any = any; for (const t of [this.texOv, this.texPig, this.texSurf, this.texGlow]) t.needsUpdate = true;
  }

  // ---- saving: the masks as bytes, the pictures as data URLs ----
  toJSON() {
    return { v: 1, nextId: this.nextId, layers: this.layers.map(L => ({
      id: L.id, name: L.name, visible: L.visible, anchor: L.anchor, type: L.type, colour: L.colour, image: L.image, pbr: L.pbr, opacity: L.opacity, pigment: L.pigment, density: L.density, cover: L.cover,
      shine: L.shine, oil: L.oil, tight: L.tight, glow: L.glow, glowColour: L.glowColour, smooth: L.smooth, grad: L.grad, depth: L.depth ? b64(Uint8Array.from(L.depth, x => Math.round(clamp(x) * 255))) : null, w: b64(Uint8Array.from(L.w, x => Math.round(clamp(x) * 255))),
      imgs: Object.fromEntries(Object.entries(L.imgs).map(([k, p]) => [k, p.url])) })) };
  }
  async fromJSON(j) {
    this.layers = []; this.nextId = j.nextId || 1;
    for (const s of j.layers || []) {
      const L = { ...s, w: Float32Array.from(unb64(s.w), x => x / 255), imgs: {}, stale: true }; L.w0 = Float32Array.from(L.w); L.depth = s.depth ? Float32Array.from(unb64(s.depth), x => x / 255) : this.depthOf(L.w);
      for (const [k, url] of Object.entries(s.imgs || {})) if (url) { const im = await loadImage(url); L.imgs[k] = Object.assign(new Pix(im), { url }); }
      this.layers.push(L);
    }
    this.update();
  }
}

export function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("couldn't read that picture")); im.src = src; });
}
export async function fileToPix(file) {          // a File: its Pix, and a data URL to save it by
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  return Object.assign(new Pix(await loadImage(url)), { url });
}
