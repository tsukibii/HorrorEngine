// MHR's 72 face shapes as morph targets on a Character Studio export (DECISIONS 2026-11-01: faces in Godot; docs/
// GODOT_DIRECTOR.md §6c), for the copy a Godot project wears (game/people/<name>.glb): the export's own map onto MHR's
// points (each corner's _MHRP, _MHRW: what the desk's face.js moves it by) gives each shape's move on every corner it
// touches, scaled by the head's scale as the export says it (`studioScale` on its skin's node: a child's or a creature's
// head isn't sized by its height; an older export: the body's height over MHR's), written as a sparse morph target named by Meta's name; Godot makes
// them blend shapes and the runtime's face.gd plays the story's `expr` on them. A lash card (_MHRR its root, _MHRE its
// eye's middle) turns whole about its eye as its root moves, at the shape's full weight (face.js turns it the same
// way). A mesh that already has morph targets keeps them and gets the shapes it lacks after them: an export's skin,
// lashes and brows carry its blink (eyesClosed_L, _R and their in-betweens, GODOT_LOOK §5f), which stays the export's
// own, and MHR's other seventy go in beside it. **The lids kept off the eyeballs**: MHR's shapes are for MHR's own eyes;
// the Studio's eyeball is grown to fill its opening, and a squint, a look down or a raised cheek slides a lid 2 to 3 mm
// into it (measured on real exports: thousands of corners on some forty of the shapes), which a file shows as the eye
// coming through the lid. The desk puts that right every frame (face.js eyeFits, pushOut: no skin round an eye deeper
// into it than at rest); Godot has no such step, so the same rule is baked into each shape at its full weight: a
// corner a shape would take into an eye ends on the eye's surface (and a hair) instead. Between rest and there it goes
// straight, a sixth of a millimetre under the eye's curve at most. The eyes turned by the gaze stay the desk's.
// The Studio's own file is left as it is; a file already baked is left alone.
//   node tools/face_morphs.mjs <in.glb> [out.glb]     (out: in place; ends FACEMORPHS ok; --raw: MHR's moves as they
//                                                        are, the lids not kept off the eyes: GDFACES' before)
//   node tools/face_morphs.mjs --check                  (FACEMORPHS: a made-up export of MHR's own face and a lash card,
//                                                        baked and read back: the morphs MHR's own moves, the card turned)
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");

/** MHR's face (Content/Studio/Bodies/MHR_lod1.bin): its 72 names, each shape's move on the points it moves (D:
 * 72 × k × 3), which of those a point is (slot, -1 for none), its points and height */
export function mhrFace() {
  const raw = fs.readFileSync(path.join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1.bin"));
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const n = new DataView(buf).getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
  const k = H.expr_points, idx = new Uint32Array(buf, H.expr_idx_at, k), half = new Uint16Array(buf, H.expr_at, H.expressions * k * 3);
  const D = new Float32Array(half.length);
  for (let i = 0; i < half.length; i++) {
    const x = half[i], s = x & 0x8000 ? -1 : 1, e = (x >> 10) & 31, f = x & 1023;
    D[i] = s * (e === 0 ? f * 5.960464477539063e-8 : e === 31 ? 0 : Math.pow(2, e - 15) * (1 + f / 1024));
  }
  const slot = new Int32Array(H.points).fill(-1); idx.forEach((p, i) => { slot[p] = i; });
  const P = new Float32Array(buf, H.points_at, H.points * 3), T = new Uint32Array(buf, H.triangles_at, H.triangles * 3);
  let lo = Infinity, hi = -Infinity; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  return { names: H.expr_names, k, D, slot, P, T, tall: hi - lo };
}

// ---- a glb's chunks and accessors -------------------------------------------------------------------------------
export function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a .glb`);
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4), data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (type === 0x004e4942) bin = Buffer.from(data);
    off += 8 + len;
  }
  return { json, bin };
}
export function writeGlb(file, json, bin) {
  const pad = (b, c) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, c)]);
  if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = bin.length;
  const J = pad(Buffer.from(JSON.stringify(json), "utf8"), 0x20), B = pad(bin, 0);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + J.length + 8 + B.length, 8);
  jh.writeUInt32LE(J.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(B.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, J, bh, B]));
}
const COMP = { 5120: [1, "getInt8", 127], 5121: [1, "getUint8", 255], 5122: [2, "getInt16", 32767], 5123: [2, "getUint16", 65535], 5125: [4, "getUint32", 1], 5126: [4, "getFloat32", 1] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
/** an accessor's values as plain numbers, row after row (a sparse one's too; normalized ints back to 0..1) */
export function readAcc(json, bin, i) {
  const a = json.accessors[i], n = NCOMP[a.type], [sz, get, top] = COMP[a.componentType], out = new Float64Array(a.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), norm = a.normalized ? 1 / top : 1;
  if (a.bufferView !== undefined) {
    const bv = json.bufferViews[a.bufferView], stride = bv.byteStride || sz * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    for (let e = 0; e < a.count; e++) for (let c = 0; c < n; c++) out[e * n + c] = dv[get](base + e * stride + c * sz, true) * norm;
  }
  if (a.sparse) {
    const S = a.sparse, iv = json.bufferViews[S.indices.bufferView], vv = json.bufferViews[S.values.bufferView];
    const [isz, iget] = COMP[S.indices.componentType], ib = (iv.byteOffset || 0) + (S.indices.byteOffset || 0), vb = (vv.byteOffset || 0) + (S.values.byteOffset || 0);
    for (let j = 0; j < S.count; j++) { const e = dv[iget](ib + j * isz, true); for (let c = 0; c < n; c++) out[e * n + c] = dv[get](vb + (j * n + c) * sz, true) * norm; }
  }
  return out;
}

// ---- the bake ---------------------------------------------------------------------------------------------------
// a move under a fiftieth of a millimetre isn't written: MHR's shapes fade out over the whole face, and half of all a
// real export's entries are smaller than that (1.9 million corners over its seventy shapes: 30 MB written whole)
const TINY = 2e-5;
/** turn v about the axis that takes a to b (both from the eye's middle), by the angle between them (face.js's lash turn) */
function turner(a, b) {
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  let k = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sn = Math.hypot(...k) / (la * lb), cs = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  if (sn <= 1e-9) return p => p;
  k = k.map(x => x / (sn * la * lb));
  return p => {
    const d = k[0] * p[0] + k[1] * p[1] + k[2] * p[2], c = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
    return [0, 1, 2].map(i => p[i] * cs + c[i] * sn + k[i] * d * (1 - cs));
  };
}

// ---- the lids kept off the eyeballs (tools/shared/face.js eyeFits and pushOut, with the eyes looking ahead) ----------
// (the desk's profile is 24 steps by the angle from the eye's front, a frame's budget, and as if every eye were a solid
// of revolution about its middle. Here there's time for the eye itself: its surface found by rays from its middle, a
// degree a step down from its front and three round it, read between its steps. Why it matters: a cornea rises 2.6 mm
// over 30 degrees and sits a little off the joint's axis; with the coarse profile a lid resting beside it was held up
// to 0.6 mm wrong, and a squint slid it over the dome with the eye showing through: 13 mm2 of it on a real export)
const TH = 120, PH = 120, GAP = 0.0004;                 // steps of a degree from the front (to 120: behind that no lid goes), of three degrees round
/** an eye's size toward (x, y, z) from its middle, L away: its surface there, between the map's steps */
const sizeAt = (f, x, y, z, L) => {
  const th = Math.min(TH - 1e-6, Math.acos(Math.max(-1, Math.min(1, z / L))) * 180 / Math.PI), ph = ((Math.atan2(y, x) / (2 * Math.PI) + 1) % 1) * PH;
  const i = Math.floor(th), j = Math.floor(ph) % PH, j1 = (j + 1) % PH, t = th - i, u = ph - Math.floor(ph), M = f.map, a = i * PH, b = Math.min(TH, i + 1) * PH;
  return (M[a + j] * (1 - u) + M[a + j1] * u) * (1 - t) + (M[b + j] * (1 - u) + M[b + j1] * u) * t;
};
/** each eyeball in a file (a skinned mesh named ..._eye_L or _R): its middle `c` (its eye joint's bind position: the
 * skin's bind space), `map` its surface's distance from there by direction ((TH + 1) x PH: its outermost surface, the
 * white's sphere and the cornea's dome), `far` its furthest point */
export function eyeFits(json, bin) {
  const fits = [];
  for (const n of json.nodes || []) {
    const m = /_eye_([LR])$/.exec(n.name || ""); if (!m || n.mesh === undefined || n.skin === undefined) continue;
    const sk = (json.skins || [])[n.skin]; if (!sk || sk.inverseBindMatrices === undefined) continue;
    const ji = sk.joints.findIndex(j => (json.nodes[j].name || "") === (m[1] === "L" ? "l_eye" : "r_eye")); if (ji < 0) continue;
    // where the joint is: the inverse of its inverse bind matrix's translation, -R^-1 t
    const M = readAcc(json, bin, sk.inverseBindMatrices).subarray(ji * 16, ji * 16 + 16);
    const a = M[0], b = M[4], c3 = M[8], d = M[1], e = M[5], f = M[9], g = M[2], h = M[6], k = M[10], t = [M[12], M[13], M[14]];
    const det = a * (e * k - f * h) - b * (d * k - f * g) + c3 * (d * h - e * g); if (!det) continue;
    const R = [[(e * k - f * h) / det, (c3 * h - b * k) / det, (b * f - c3 * e) / det], [(f * g - d * k) / det, (a * k - c3 * g) / det, (c3 * d - a * f) / det], [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det]];
    const c = R.map(r => -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]));
    const map = new Float64Array((TH + 1) * PH); let far = 0;
    const dirs = new Float64Array((TH + 1) * PH * 3);
    for (let i = 0; i <= TH; i++) for (let j = 0; j < PH; j++) { const th = i * Math.PI / 180, ph = j * 2 * Math.PI / PH, o = (i * PH + j) * 3; dirs[o] = Math.sin(th) * Math.cos(ph); dirs[o + 1] = Math.sin(th) * Math.sin(ph); dirs[o + 2] = Math.cos(th); }
    for (const p of json.meshes[n.mesh].primitives) {
      if (p.attributes.POSITION === undefined) continue;
      const V = readAcc(json, bin, p.attributes.POSITION), I = p.indices !== undefined ? readAcc(json, bin, p.indices) : Float64Array.from({ length: V.length / 3 }, (_, q) => q);
      for (let v = 0; v < V.length; v += 3) far = Math.max(far, Math.hypot(V[v] - c[0], V[v + 1] - c[1], V[v + 2] - c[2]));
      for (let q = 0; q + 2 < I.length; q += 3) {
        // a triangle from the eye's middle: the rays that could meet it are those between its corners' directions (and a step more)
        const P = [0, 1, 2].map(w => [V[I[q + w] * 3] - c[0], V[I[q + w] * 3 + 1] - c[1], V[I[q + w] * 3 + 2] - c[2]]);
        const ths = P.map(v => Math.acos(Math.max(-1, Math.min(1, v[2] / (Math.hypot(...v) || 1)))) * 180 / Math.PI);
        const i0 = Math.max(0, Math.floor(Math.min(...ths)) - 1), i1 = Math.min(TH, Math.ceil(Math.max(...ths)) + 1); if (i0 > TH) continue;
        const phs = P.map(v => ((Math.atan2(v[1], v[0]) / (2 * Math.PI) + 1) % 1) * PH), lo = Math.min(...phs), hi = Math.max(...phs);
        const all = i0 <= 2 || hi - lo > PH / 2;        // round the pole, or across the seam: every step round
        const j0 = all ? 0 : Math.floor(lo) - 1, j1 = all ? PH - 1 : Math.ceil(hi) + 1;
        const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
        for (let i = i0; i <= i1; i++) for (let jj = j0; jj <= j1; jj++) {
          const j = ((jj % PH) + PH) % PH, o = (i * PH + j) * 3, dx = dirs[o], dy = dirs[o + 1], dz = dirs[o + 2];
          // Moller-Trumbore from the middle (the origin here) along the ray
          const px = dy * e2[2] - dz * e2[1], py = dz * e2[0] - dx * e2[2], pz = dx * e2[1] - dy * e2[0], dt = e1[0] * px + e1[1] * py + e1[2] * pz;
          if (Math.abs(dt) < 1e-18) continue;
          const tx = -P[0][0], ty = -P[0][1], tz = -P[0][2], uu = (tx * px + ty * py + tz * pz) / dt; if (uu < -1e-9 || uu > 1 + 1e-9) continue;
          const qx = ty * e1[2] - tz * e1[1], qy = tz * e1[0] - tx * e1[2], qz = tx * e1[1] - ty * e1[0], vv = (dx * qx + dy * qy + dz * qz) / dt; if (vv < -1e-9 || uu + vv > 1 + 1e-9) continue;
          const tt = (e2[0] * qx + e2[1] * qy + e2[2] * qz) / dt;
          if (tt > map[i * PH + j]) map[i * PH + j] = tt;   // (its outermost surface: the iris's plane lies inside the dome)
        }
      }
    }
    if (!far) continue;
    // a ray that met nothing (a gap between two triangles, the back of an eye left open): what its neighbours round it met, else the last step's
    for (let i = 0; i <= TH; i++) for (let j = 0; j < PH; j++) if (!map[i * PH + j]) {
      let got = 0; for (let s = 1; s < PH / 2 && !got; s++) got = map[i * PH + (j + s) % PH] || map[i * PH + (j - s + PH) % PH];
      map[i * PH + j] = got || (i ? map[(i - 1) * PH + j] : 0);
    }
    fits.push({ side: m[1], c, map, far });
  }
  return fits;
}

// A lid's skin is a few big triangles (MHR's own: 4 to 8 mm a side under the eye), and a triangle is flat where an eye
// is round: with all three corners outside the eye, the middle of one a squint has stretched over the cornea still
// cuts half a millimetre under it, and the eye shows through there (measured: 14 mm2 on a real export with the corners
// alone kept out). So each triangle round an eye is tried across its inside as the shape leaves it, a point every
// millimetre: where one is nearer the eye than the same point at rest (or than a twentieth of a millimetre
// off it), the triangle's corners are lifted straight out from the eye by what's missing, the corners that share a
// place together, and tried again until none is. Returns how many points were lifted.
const STEP = 0.001, HAIR = 0.00005;
function liftTriangles(q, fits, dl) {
  const X = q.X, T = q.tris, P = new Float64Array(9), R = new Float64Array(9);
  let total = 0;
  for (let round = 0; round < 12; round++) {
    const need = new Float64Array(q.points); let any = false;
    for (let t = 0; t < T.length; t += 3) {
      const f = fits[q.eye[T[t]]]; let moved = false, edge = 0;
      for (let k = 0; k < 3; k++) { const v = T[t + k];
        for (let a = 0; a < 3; a++) { R[k * 3 + a] = X[v * 3 + a] - f.c[a]; P[k * 3 + a] = R[k * 3 + a] + dl[v * 3 + a]; }
        if (dl[v * 3] || dl[v * 3 + 1] || dl[v * 3 + 2]) moved = true; }
      if (!moved) continue;                             // (as it rests: nothing to keep out)
      for (let k = 0; k < 3; k++) { const j = (k + 1) % 3; edge = Math.max(edge, Math.hypot(P[k * 3] - P[j * 3], P[k * 3 + 1] - P[j * 3 + 1], P[k * 3 + 2] - P[j * 3 + 2])); }
      const n = Math.max(2, Math.min(24, Math.ceil(edge / STEP)));
      let worst = 0;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        if ((i === n) || (j === n) || (i === 0 && j === 0)) continue;   // (its corners: kept out already)
        const wa = i / n, wb = j / n, wc = 1 - wa - wb;
        const x = wa * P[0] + wb * P[3] + wc * P[6], y = wa * P[1] + wb * P[4] + wc * P[7], z = wa * P[2] + wb * P[5] + wc * P[8], L = Math.hypot(x, y, z); if (!L) continue;
        const x0 = wa * R[0] + wb * R[3] + wc * R[6], y0 = wa * R[1] + wb * R[4] + wc * R[7], z0 = wa * R[2] + wb * R[5] + wc * R[8], L0 = Math.hypot(x0, y0, z0);
        const off = L - sizeAt(f, x, y, z, L), off0 = L0 ? L0 - sizeAt(f, x0, y0, z0, L0) : HAIR;   // how far outside the eye now, and at rest
        const short = Math.min(off0, HAIR) - off; if (short > worst) worst = short;
      }
      if (worst > 1e-7) { any = true; for (let k = 0; k < 3; k++) { const w = q.weld[T[t + k]]; if (worst * 1.15 > need[w]) need[w] = worst * 1.15; } }
    }
    if (!any) break;
    const seen = new Uint8Array(q.points), done = new Uint8Array(X.length / 3);   // (a corner several triangles list is lifted once)
    for (let t = 0; t < T.length; t++) {
      const v = T[t], w = q.weld[v], up = need[w]; if (!(up > 0) || done[v]) continue;
      done[v] = 1;
      const f = fits[q.eye[v]], x = X[v * 3] + dl[v * 3] - f.c[0], y = X[v * 3 + 1] + dl[v * 3 + 1] - f.c[1], z = X[v * 3 + 2] + dl[v * 3 + 2] - f.c[2], L = Math.hypot(x, y, z); if (!L) continue;
      const k = up / L; dl[v * 3] += x * k; dl[v * 3 + 1] += y * k; dl[v * 3 + 2] += z * k;
      if (!seen[w]) { seen[w] = 1; total++; }
    }
  }
  return total;
}

/** the face's morphs added to a glb's json and bin: {meshes: n, corners, targets, scale, kept: corner moves ended on an
 * eye's surface instead of inside it, deepest: how far in the worst would have gone} (0 meshes: nothing carries MHR's
 * points, or it's baked already) */
export function bake(json, bin, F = mhrFace(), raw = false) {   // raw: MHR's moves as they are, the lids not kept off the eyes (a check's before)
  const parts = [], chunks = [bin];
  let size = bin.length;
  const view = (buf) => {                             // a new bufferView at the bin's end (4-aligned)
    const padn = (4 - (size % 4)) % 4; if (padn) { chunks.push(Buffer.alloc(padn)); size += padn; }
    json.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: buf.length }); chunks.push(buf); size += buf.length;
    return json.bufferViews.length - 1;
  };
  for (const [mi, mesh] of (json.meshes || []).entries()) {
    // what the mesh has already: a Studio export's own blink (eyesClosed_L, _R and their in-betweens: the lids kept off
    // the eyes and met when shut, better than MHR's own eyesClosed) is kept as it is, and MHR's other shapes go in after
    // it. (This skipped any mesh that had targets at all, as "baked already": every export's skin, lashes and brows
    // have carried the blink since 2026-10-31, so nothing was baked and a face in Godot moved only its lids.)
    const ex = mesh.extras || {}, count = (mesh.primitives[0].targets || []).length;
    const have = count ? (Array.isArray(ex.targetNames) && ex.targetNames.length === count ? ex.targetNames.map(String) : null) : [];
    if (!have || mesh.primitives.some(p => (p.targets || []).length !== count)) continue;   // targets with no names (or uneven): not ours to add to
    const lack = F.names.map((n, e) => [n, e]).filter(([n]) => !have.includes(n));
    if (!lack.length) continue;                         // baked already
    const prims = mesh.primitives.map(p => {
      const A = p.attributes || {};
      if (A._MHRP === undefined || A._MHRW === undefined || A.POSITION === undefined) return null;
      return { p, I: readAcc(json, bin, A._MHRP), W: readAcc(json, bin, A._MHRW), X: readAcc(json, bin, A.POSITION),
        R: A._MHRR !== undefined ? readAcc(json, bin, A._MHRR) : null, E: A._MHRE !== undefined ? readAcc(json, bin, A._MHRE) : null };
    });
    if (!prims.some(Boolean)) continue;
    parts.push({ mi, mesh, prims, have, lack });
  }
  // the body's height (the tallest skin's, as face.js finds it): MHR's moves scaled by it, brows and lashes too, when the file doesn't say
  let tall = 0;
  for (const { prims } of parts) for (const q of prims) if (q && !q.R) {
    let lo = Infinity, hi = -Infinity; for (let i = 1; i < q.X.length; i += 3) { lo = Math.min(lo, q.X[i]); hi = Math.max(hi, q.X[i]); }
    tall = Math.max(tall, hi - lo);
  }
  // (the export's own word for the head's scale, studioScale on its skin's node: a child's or a creature's head isn't sized by its height)
  const known = (json.nodes || []).map(n => +(n.extras && n.extras.studioScale)).find(k => k > 0);
  const scale = known || (tall > 0 ? tall / F.tall : 1);
  let corners = 0, targets = 0, kept = 0, deepest = 0, lifted = 0;
  const move = (e, s) => [F.D[(e * F.k + s) * 3] * scale, F.D[(e * F.k + s) * 3 + 1] * scale, F.D[(e * F.k + s) * 3 + 2] * scale];
  // the skin that could reach an eye (in front of its middle, within half again its size), and how far outside it rests
  // (a hair at most; skin that rests inside, the socket's, hidden, keeps its depth)
  const fits = raw ? [] : eyeFits(json, bin);
  if (fits.length) for (const { prims } of parts) for (const q of prims) if (q && !q.R) {
    const n = q.X.length / 3; q.eye = new Int8Array(n).fill(-1); q.room = new Float32Array(n);
    fits.forEach((f, fi) => {
      for (let c = 0; c < n; c++) {
        const x = q.X[c * 3] - f.c[0], y = q.X[c * 3 + 1] - f.c[1], z = q.X[c * 3 + 2] - f.c[2], L = Math.hypot(x, y, z);
        if (!(z > -0.3 * f.far && L < 1.6 * f.far && L > 0) || q.eye[c] >= 0) continue;
        q.eye[c] = fi; q.room[c] = Math.min(GAP, L - sizeAt(f, x, y, z, L));
      }
    });
    // its triangles whose three corners are all round one eye, and each corner's point (an export's skin isn't welded:
    // the corners that share a place are one point, raised together, or the skin would open between them)
    const I = q.p.indices !== undefined ? readAcc(json, bin, q.p.indices) : null, nt = Math.floor((I ? I.length : n) / 3);
    q.tris = []; q.weld = new Int32Array(n).fill(-1); const at = new Map();
    for (let t = 0; t < nt; t++) {
      const a = I ? I[t * 3] : t * 3, b = I ? I[t * 3 + 1] : t * 3 + 1, c = I ? I[t * 3 + 2] : t * 3 + 2;
      if (q.eye[a] < 0 || q.eye[a] !== q.eye[b] || q.eye[a] !== q.eye[c]) continue;
      q.tris.push(a, b, c);
      for (const v of [a, b, c]) if (q.weld[v] < 0) { const key = `${q.X[v * 3]},${q.X[v * 3 + 1]},${q.X[v * 3 + 2]}`; let w = at.get(key); if (w === undefined) at.set(key, w = at.size); q.weld[v] = w; }
    }
    q.points = at.size;
  }
  for (const { mesh, prims, have, lack } of parts) {
    for (const [pi, prim] of mesh.primitives.entries()) {
      const q = prims[pi], count = json.accessors[prim.attributes.POSITION].count;
      let cards = null;
      if (q && q.R && q.E) {                          // a lash card: its corners by their root, turned about their eye
        const by = new Map();
        for (let v = 0; v < count; v++) {
          const key = `${q.R[v * 3]},${q.R[v * 3 + 1]},${q.R[v * 3 + 2]}`; let c = by.get(key);
          if (!c) by.set(key, c = { s: F.slot[q.I[v * 3]], r: [q.R[v * 3], q.R[v * 3 + 1], q.R[v * 3 + 2]], e: [q.E[v * 3], q.E[v * 3 + 1], q.E[v * 3 + 2]], v: [] });
          c.v.push(v);
        }
        cards = [...by.values()].filter(c => c.s >= 0);
      }
      prim.targets = (prim.targets || []).slice();     // (its own, the blink's, first: their indices stay)
      for (const [, e] of lack) {
        const idx = [], val = [];
        if (q && cards) {
          for (const c of cards) {
            const m = move(e, c.s); if (!m[0] && !m[1] && !m[2]) continue;
            const a = [c.r[0] - c.e[0], c.r[1] - c.e[1], c.r[2] - c.e[2]], turn = turner(a, [a[0] + m[0], a[1] + m[1], a[2] + m[2]]);
            for (const v of c.v) {
              const p = [q.X[v * 3] - c.e[0], q.X[v * 3 + 1] - c.e[1], q.X[v * 3 + 2] - c.e[2]], t = turn(p);
              const d = [t[0] - p[0], t[1] - p[1], t[2] - p[2]];
              if (Math.hypot(d[0], d[1], d[2]) > TINY) { idx.push(v); val.push(...d); }
            }
          }
        } else if (q) {
          const dl = q.dl || (q.dl = new Float32Array(count * 3)); dl.fill(0);
          let nearMoved = false;
          for (let c = 0; c < count; c++) {
            let x = 0, y = 0, z = 0;
            for (let j = 0; j < 3; j++) {
              const w = q.W[c * 3 + j], s = w ? F.slot[q.I[c * 3 + j]] : -1; if (s < 0) continue;
              const o = (e * F.k + s) * 3; x += w * F.D[o]; y += w * F.D[o + 1]; z += w * F.D[o + 2];
            }
            if (!(Math.hypot(x, y, z) * scale > TINY)) continue;
            x *= scale; y *= scale; z *= scale;
            if (q.eye && q.eye[c] >= 0) {               // no deeper into its eye than at rest: out to the eye's surface there
              const f = fits[q.eye[c]], px = q.X[c * 3] + x - f.c[0], py = q.X[c * 3 + 1] + y - f.c[1], pz = q.X[c * 3 + 2] + z - f.c[2], L = Math.hypot(px, py, pz);
              const r = L > 0 ? sizeAt(f, px, py, pz, L) + q.room[c] : 0;
              if (L > 0 && L < r) { const k = r / L; x = f.c[0] + px * k - q.X[c * 3]; y = f.c[1] + py * k - q.X[c * 3 + 1]; z = f.c[2] + pz * k - q.X[c * 3 + 2]; kept++; deepest = Math.max(deepest, r - L); }
              nearMoved = true;
            }
            dl[c * 3] = x; dl[c * 3 + 1] = y; dl[c * 3 + 2] = z;
          }
          if (nearMoved && q.tris && q.tris.length) lifted += liftTriangles(q, fits, dl);
          for (let c = 0; c < count; c++) if (Math.hypot(dl[c * 3], dl[c * 3 + 1], dl[c * 3 + 2]) > TINY) { idx.push(c); val.push(dl[c * 3], dl[c * 3 + 1], dl[c * 3 + 2]); }
        }
        const acc = { componentType: 5126, count, type: "VEC3", min: [0, 0, 0], max: [0, 0, 0] };
        if (idx.length) {
          for (let j = 0; j < val.length; j++) { const c = j % 3; acc.min[c] = Math.min(acc.min[c], val[j]); acc.max[c] = Math.max(acc.max[c], val[j]); }
          acc.sparse = { count: idx.length, indices: { bufferView: view(Buffer.from(Uint32Array.from(idx).buffer)), componentType: 5125 },
            values: { bufferView: view(Buffer.from(Float32Array.from(val).buffer)) } };
          corners += idx.length;
        }
        json.accessors.push(acc);
        prim.targets.push({ POSITION: json.accessors.length - 1 });
        targets++;
      }
    }
    mesh.weights = [...(Array.isArray(mesh.weights) && mesh.weights.length === have.length ? mesh.weights : new Array(have.length).fill(0)), ...new Array(lack.length).fill(0)];
    mesh.extras = Object.assign({}, mesh.extras || {}, { targetNames: [...have, ...lack.map(([n]) => n)] });
  }
  return { meshes: parts.length, corners, targets, scale, kept, deepest, lifted, eyes: fits.length, bin: Buffer.concat(chunks) };
}

export function bakeFile(input, output = input, raw = false) {
  const { json, bin } = readGlb(input), r = bake(json, bin, undefined, raw);
  if (r.meshes) writeGlb(output, json, r.bin);
  else if (output !== input) fs.copyFileSync(input, output);
  return r;
}

// ---- the check: a made-up export of MHR's own face, and a lash card ----------------------------------------------
function madeUp(F, file, studioScale = 0, own = null, eyeball = false) {   // studioScale: the head's scale as an export says it (its skin's node); own: target names both meshes carry already (an export's own blink); eyeball: an eye behind the left lid, as an export has them
  const n = F.P.length / 3, I = new Uint32Array(n * 3), W = new Float32Array(n * 3);
  for (let p = 0; p < n; p++) { I[p * 3] = I[p * 3 + 1] = I[p * 3 + 2] = p; W[p * 3] = 1; }
  // a lash card of four corners on a point of the upper lid's (one eyesClosed moves most), its eye 1.2 cm behind it
  const blink = F.names.indexOf("eyesClosed_L");
  let root = -1, best = 0;
  for (let p = 0; p < n; p++) { const s = F.slot[p]; if (s < 0) continue; const o = (blink * F.k + s) * 3, m = Math.hypot(F.D[o], F.D[o + 1], F.D[o + 2]); if (m > best) { best = m; root = p; } }
  const r = [F.P[root * 3], F.P[root * 3 + 1], F.P[root * 3 + 2]], eye = [r[0], r[1] - 0.004, r[2] - 0.012];
  const cardX = Float32Array.from([...r, r[0] + 0.004, r[1], r[2] + 0.002, r[0], r[1] + 0.006, r[2] + 0.004, r[0] + 0.004, r[1] + 0.006, r[2] + 0.006]);
  const cardI = Uint32Array.from([root, root, root, root, root, root, root, root, root, root, root, root]), cardW = Float32Array.from([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
  const cardR = Float32Array.from([...r, ...r, ...r, ...r]), cardE = Float32Array.from([...eye, ...eye, ...eye, ...eye]);
  const blobs = [F.P, I, W, F.T, cardX, cardI, cardW, cardR, cardE, Uint32Array.from([0, 1, 2, 2, 1, 3])].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  const json = { asset: { version: "2.0" }, buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [], meshes: [], nodes: [], scenes: [{ nodes: [0, 1] }], scene: 0 };
  let off = 0; const views = blobs.map(b => { json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length }); off += b.length; return json.bufferViews.length - 1; });
  const acc = (v, ct, cnt, type, extra = {}) => { json.accessors.push(Object.assign({ bufferView: v, componentType: ct, count: cnt, type }, extra)); return json.accessors.length - 1; };
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < F.P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], F.P[i]); hi[i % 3] = Math.max(hi[i % 3], F.P[i]); }
  json.meshes.push({ name: "skin", primitives: [{ attributes: { POSITION: acc(views[0], 5126, n, "VEC3", { min: lo, max: hi }), _MHRP: acc(views[1], 5125, n, "VEC3"), _MHRW: acc(views[2], 5126, n, "VEC3") }, indices: acc(views[3], 5125, F.T.length, "SCALAR") }] });
  const cmin = [0, 1, 2].map(c => Math.min(...[0, 1, 2, 3].map(v => cardX[v * 3 + c]))), cmax = [0, 1, 2].map(c => Math.max(...[0, 1, 2, 3].map(v => cardX[v * 3 + c])));
  json.meshes.push({ name: "lashes", primitives: [{ attributes: { POSITION: acc(views[4], 5126, 4, "VEC3", { min: cmin, max: cmax }), _MHRP: acc(views[5], 5125, 4, "VEC3"), _MHRW: acc(views[6], 5126, 4, "VEC3"),
    _MHRR: acc(views[7], 5126, 4, "VEC3"), _MHRE: acc(views[8], 5126, 4, "VEC3") }, indices: acc(views[9], 5125, 6, "SCALAR") }] });
  json.nodes.push({ name: "body", mesh: 0, ...(studioScale ? { extras: { studioScale } } : {}) }, { name: "lashes", mesh: 1 });
  if (own) for (const [mesh, cnt] of [[json.meshes[0], n], [json.meshes[1], 4]]) {   // (their moves nothing: accessors with no buffer view are zeros)
    mesh.primitives[0].targets = own.map(() => ({ POSITION: acc(undefined, 5126, cnt, "VEC3", { min: [0, 0, 0], max: [0, 0, 0] }) }));
    mesh.weights = own.map(() => 0); mesh.extras = { targetNames: own.slice() };
  }
  let ball = null;
  if (eyeball) {                                        // a ball behind the upper lid, the lid resting a fifth of a millimetre off it, on its own joint (l_eye)
    const R = Math.hypot(r[0] - eye[0], r[1] - eye[1], r[2] - eye[2]) - 0.0002, pts = [], tri = [], LAT = 90, LON = 120;   // (fine: its facets within a hundredth of a millimetre of the ball)
    for (let i = 0; i <= LAT; i++) for (let j = 0; j < LON; j++) { const th = Math.PI * i / LAT, ph = 2 * Math.PI * j / LON; pts.push(eye[0] + R * Math.sin(th) * Math.cos(ph), eye[1] + R * Math.cos(th), eye[2] + R * Math.sin(th) * Math.sin(ph)); }
    for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) { const a0 = i * LON + j, a1 = i * LON + (j + 1) % LON, b0 = a0 + LON, b1 = a1 + LON; tri.push(a0, b0, a1, a1, b0, b1); }
    const more = [Float32Array.from(pts), Uint32Array.from(tri), Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -eye[0], -eye[1], -eye[2], 1])].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    const mv = more.map(b => { json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length }); off += b.length; return json.bufferViews.length - 1; });
    blobs.push(...more);
    json.meshes.push({ name: "eye", primitives: [{ attributes: { POSITION: acc(mv[0], 5126, pts.length / 3, "VEC3", { min: eye.map(v => v - R), max: eye.map(v => v + R) }) }, indices: acc(mv[1], 5125, tri.length, "SCALAR") }] });
    json.nodes.push({ name: "l_eye", translation: eye }, { name: "madeup_eye_L", mesh: json.meshes.length - 1, skin: 0 });
    json.skins = [{ joints: [json.nodes.length - 2], inverseBindMatrices: acc(mv[2], 5126, 1, "MAT4") }];
    json.scenes[0].nodes.push(json.nodes.length - 2, json.nodes.length - 1);
    ball = { c: eye, R };
  }
  writeGlb(file, json, Buffer.concat(blobs));
  return { root, eye, blink, cardX, ball };
}

function check() {
  const F = mhrFace(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "facemorphs_")), file = path.join(tmp, "madeup.glb"), bad = [];
  const ok = (what, good, why = "") => { console.log((good ? "  ok  " : "  BAD ") + what + (good || !why ? "" : "  " + why)); if (!good) bad.push(what); };
  const m = madeUp(F, file), r = bakeFile(file), again = bakeFile(file);
  ok(`baked: ${r.meshes} meshes, ${r.targets} morph targets, ${r.corners} corners moved; again: nothing (${again.meshes})`, r.meshes === 2 && r.targets === 144 && again.meshes === 0);
  const { json, bin } = readGlb(file), skin = json.meshes[0], lash = json.meshes[1];
  ok("the targets named by MHR's 72 (Meta's names), the weights at rest", JSON.stringify(skin.extras.targetNames) === JSON.stringify(F.names) && skin.weights.length === 72 && skin.weights.every(w => w === 0));
  let worst = 0, moved = 0;                               // every corner's move MHR's own, shape by shape
  for (let e = 0; e < 72; e++) {
    const d = readAcc(json, bin, skin.primitives[0].targets[e].POSITION);
    for (let p = 0; p < F.P.length / 3; p++) {
      const s = F.slot[p], o = (e * F.k + s) * 3;
      const want = s < 0 ? [0, 0, 0] : [F.D[o], F.D[o + 1], F.D[o + 2]];
      worst = Math.max(worst, Math.abs(d[p * 3] - want[0]), Math.abs(d[p * 3 + 1] - want[1]), Math.abs(d[p * 3 + 2] - want[2]));
      if (s >= 0 && Math.hypot(...want) > 1e-6) moved++;
    }
  }
  ok(`the skin's morphs MHR's own moves (${(worst * 1000).toFixed(4)} mm at worst: moves under ${TINY * 1000} mm aren't written; ${moved} moves), its scale 1 (${r.scale.toFixed(4)})`, worst <= TINY * 1.01 && moved > 1000 && Math.abs(r.scale - 1) < 1e-6);
  const dL = readAcc(json, bin, lash.primitives[0].targets[m.blink].POSITION);    // the card on a blink: turned about its eye, its corners as far from it
  let off = 0, swing = 0;
  for (let v = 0; v < 4; v++) {
    const p = [m.cardX[v * 3] - m.eye[0], m.cardX[v * 3 + 1] - m.eye[1], m.cardX[v * 3 + 2] - m.eye[2]], t = [p[0] + dL[v * 3], p[1] + dL[v * 3 + 1], p[2] + dL[v * 3 + 2]];
    off = Math.max(off, Math.abs(Math.hypot(...t) - Math.hypot(...p))); swing = Math.max(swing, Math.hypot(dL[v * 3], dL[v * 3 + 1], dL[v * 3 + 2]));
  }
  const rootMove = Math.hypot(...[0, 1, 2].map(c => F.D[(m.blink * F.k + F.slot[m.root]) * 3 + c]));
  ok(`a lash card on the blink turned whole about its eye (its corners ${(off * 1000).toFixed(4)} mm off their distance, swung ${(swing * 1000).toFixed(1)} mm; its root ${(rootMove * 1000).toFixed(1)} mm)`, off < 1e-5 && swing > 0.5 * rootMove && rootMove > 0.001);
  // a child's or a creature's export: its head isn't sized by its height, and the file says the head's scale itself
  const file2 = path.join(tmp, "said.glb"); madeUp(F, file2, 0.9);
  const r2 = bakeFile(file2), g2 = readGlb(file2), jaw = Math.max(0, F.names.indexOf("jawOpen")), d2 = readAcc(g2.json, g2.bin, g2.json.meshes[0].primitives[0].targets[jaw].POSITION);
  let off2 = 0, most2 = 0;
  for (let p = 0; p < F.P.length / 3; p++) { const s = F.slot[p]; if (s < 0) continue; const o = (jaw * F.k + s) * 3;
    for (let c = 0; c < 3; c++) { off2 = Math.max(off2, Math.abs(d2[p * 3 + c] - 0.9 * F.D[o + c])); most2 = Math.max(most2, Math.abs(F.D[o + c])); } }
  ok(`a file that says its head's scale (studioScale 0.9 on a body as tall as MHR's): the moves times it, not times the height's (${F.names[jaw]}: ${(off2 * 1000).toFixed(4)} mm off, the largest move ${(most2 * 1000).toFixed(1)} mm; scale ${r2.scale.toFixed(3)})`, Math.abs(r2.scale - 0.9) < 1e-9 && off2 <= TINY * 1.01 && most2 > 0.003);
  // an export as the Studio writes it since the blink: its skin and lashes already carry eyesClosed_L, _R and in-betweens
  const file3 = path.join(tmp, "blinks.glb"), own = ["eyesClosed_L", "eyesClosed_L_in5000", "eyesClosed_R", "eyesClosed_R_in5000"]; madeUp(F, file3, 0, own);
  const before3 = readGlb(file3).json.meshes.map(m => m.primitives[0].targets.map(t => t.POSITION)), r3 = bakeFile(file3), again3 = bakeFile(file3), g3 = readGlb(file3);
  const names3 = g3.json.meshes[0].extras.targetNames, kept = g3.json.meshes.every((m, k) => before3[k].every((a, i) => m.primitives[0].targets[i].POSITION === a));
  const jd = names3.indexOf("jawDrop"), dj = jd < 0 ? null : readAcc(g3.json, g3.bin, g3.json.meshes[0].primitives[0].targets[jd].POSITION), ej = F.names.indexOf("jawDrop");
  let off3 = 1, n3 = 0; if (dj) { off3 = 0; for (let p = 0; p < F.P.length / 3; p++) { const s = F.slot[p]; if (s < 0) continue; const o = (ej * F.k + s) * 3; for (let c = 0; c < 3; c++) off3 = Math.max(off3, Math.abs(dj[p * 3 + c] - F.D[o + c])); n3++; } }
  ok(`a mesh that already carries its blink (${own.length} targets, an export's own): they stay first and as they were, MHR's other ${72 - 2} go in after them (${names3.length} in all, on the lashes too: ${g3.json.meshes[1].extras.targetNames.length}), jawDrop MHR's own (${(off3 * 1000).toFixed(4)} mm off over ${n3} points); again: nothing`,
     r3.meshes === 2 && kept && names3.length === own.length + 70 && own.every((n, i) => names3[i] === n) && names3.filter(n => n === "eyesClosed_L").length === 1 && F.names.every(n => names3.includes(n))
     && g3.json.meshes[0].weights.length === names3.length && g3.json.meshes[1].extras.targetNames.length === names3.length && g3.json.meshes.every(m => m.primitives.every(p => p.targets.length === names3.length)) && off3 <= TINY * 1.01 && n3 > 1000 && again3.meshes === 0);
  // an export's eyeball behind the lid: MHR's shapes slide the lid into it; baked, no corner near it ends deeper than at rest
  const file4 = path.join(tmp, "eye.glb"), m4 = madeUp(F, file4, 0, null, true), r4 = bakeFile(file4), g4 = readGlb(file4), sk4 = g4.json.meshes[0].primitives[0];
  const c4 = m4.ball.c, R4 = m4.ball.R, n4 = F.P.length / 3, nearEye = new Uint8Array(n4), room4 = new Float32Array(n4);
  for (let p = 0; p < n4; p++) { const x = F.P[p * 3] - c4[0], y = F.P[p * 3 + 1] - c4[1], z = F.P[p * 3 + 2] - c4[2], L = Math.hypot(x, y, z); if (z > -0.3 * R4 && L < 1.6 * R4 && L > 0) { nearEye[p] = 1; room4[p] = Math.min(GAP, L - R4); } }
  let raw4 = 0, rawDeep = 0, left4 = 0, leftDeep = 0, far4 = 0, shapes4 = 0;
  for (let e = 0; e < 72; e++) {
    const d = readAcc(g4.json, g4.bin, sk4.targets[e].POSITION); let any = false;
    for (let p = 0; p < n4; p++) {
      const sl = F.slot[p], o = (e * F.k + sl) * 3, want = sl < 0 ? [0, 0, 0] : [F.D[o], F.D[o + 1], F.D[o + 2]];
      if (!nearEye[p]) { far4 = Math.max(far4, Math.abs(d[p * 3] - want[0]), Math.abs(d[p * 3 + 1] - want[1]), Math.abs(d[p * 3 + 2] - want[2])); continue; }
      const depth = v => { const x = F.P[p * 3] + v[0] - c4[0], y = F.P[p * 3 + 1] + v[1] - c4[1], z = F.P[p * 3 + 2] + v[2] - c4[2]; return R4 + room4[p] - Math.hypot(x, y, z); };   // how far deeper than at rest
      const was = Math.hypot(...want) > TINY ? depth(want) : 0, is = depth([d[p * 3], d[p * 3 + 1], d[p * 3 + 2]]);
      if (was > 3e-5) { raw4++; rawDeep = Math.max(rawDeep, was); any = true; }
      if (is > 1.5e-5) { left4++; leftDeep = Math.max(leftDeep, is); }   // (the bake keeps them off the ball's facets, this measures against the ball: a hundredth of a millimetre between them)
    }
    if (any) shapes4++;
  }
  ok(`an eyeball behind the lid (${(R4 * 1000).toFixed(1)} mm, on its own joint): MHR's own moves would take ${raw4} corner moves of ${shapes4} shapes into it, ${(rawDeep * 1000).toFixed(1)} mm at the deepest; baked, none ends deeper than it rests (${left4} left, ${(leftDeep * 1000).toFixed(4)} mm), the bake's own count ${r4.kept} and ${(r4.deepest * 1000).toFixed(1)} mm; away from the eye the moves MHR's own (${(far4 * 1000).toFixed(4)} mm off)`,
     r4.eyes === 1 && raw4 > 100 && shapes4 >= 2 && rawDeep > 0.0005 && left4 === 0 && r4.kept >= raw4 * 0.9 && r4.kept < raw4 * 1.4 && Math.abs(r4.deepest - rawDeep) < 3e-5 && far4 <= TINY * 1.01);   // (the bake counts every corner it moves at all, this only those a few hundredths of a millimetre in)
  // and across its triangles: a shape tried at every triangle round the eye, a point each 0.75 mm: none nearer the ball than at rest (or than on it)
  const T4 = readAcc(g4.json, g4.bin, sk4.indices); let cut4 = 0, cutDeep = 0, tried4 = 0;
  const offBall = (x, y, z) => Math.hypot(x - c4[0], y - c4[1], z - c4[2]) - R4;
  for (const nm of ["lidTightener_L", "eyesLookDown_L", "eyesClosed_L", "cheekRaiser_L", "upperLidRaiser_L"]) {
    const d = readAcc(g4.json, g4.bin, sk4.targets[F.names.indexOf(nm)].POSITION);
    for (let t = 0; t + 2 < T4.length; t += 3) {
      const v = [T4[t], T4[t + 1], T4[t + 2]]; if (!v.every(p => nearEye[p]) || !v.some(p => d[p * 3] || d[p * 3 + 1] || d[p * 3 + 2])) continue;
      if (!v.every(p => offBall(F.P[p * 3], F.P[p * 3 + 1], F.P[p * 3 + 2]) > -1e-6)) continue;   // (a triangle with a corner inside the ball at rest, MHR's own eye's or a lid's this made-up ball swallows, crosses its surface already: nothing to keep)
      tried4++;
      const edge = Math.max(...[0, 1, 2].map(k => Math.hypot(...[0, 1, 2].map(a => F.P[v[k] * 3 + a] + d[v[k] * 3 + a] - F.P[v[(k + 1) % 3] * 3 + a] - d[v[(k + 1) % 3] * 3 + a])))), n = Math.max(2, Math.ceil(edge / 0.00075));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const w = [i / n, j / n, 1 - i / n - j / n], at = (dd) => [0, 1, 2].map(a => w[0] * (F.P[v[0] * 3 + a] + dd * d[v[0] * 3 + a]) + w[1] * (F.P[v[1] * 3 + a] + dd * d[v[1] * 3 + a]) + w[2] * (F.P[v[2] * 3 + a] + dd * d[v[2] * 3 + a]));
        const now = offBall(...at(1)), rest = offBall(...at(0)), under = Math.min(rest, 0) - now;
        if (under > 3e-5) { cut4++; cutDeep = Math.max(cutDeep, under); if (process.env.FM_DEBUG) console.log("    ", nm, "tri", v.join(","), "w", w.map(x => x.toFixed(2)).join(","), "rest", (rest * 1000).toFixed(3), "now", (now * 1000).toFixed(3), "corners now", v.map(p => (offBall(F.P[p * 3] + d[p * 3], F.P[p * 3 + 1] + d[p * 3 + 1], F.P[p * 3 + 2] + d[p * 3 + 2]) * 1000).toFixed(3)).join(" "), "rest", v.map(p => (offBall(F.P[p * 3], F.P[p * 3 + 1], F.P[p * 3 + 2]) * 1000).toFixed(3)).join(" "), "moved", v.map(p => (Math.hypot(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]) * 1000).toFixed(2)).join(" "), "n", n); }
      }
    }
  }
  ok(`and across its triangles (${tried4} that rest outside it tried over five shapes, a point every 0.75 mm): none cuts under the ball (${cut4} points, ${(cutDeep * 1000).toFixed(3)} mm), ${r4.lifted} points lifted for it`, tried4 > 200 && cut4 === 0 && r4.lifted > 0);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad.length ? `FACEMORPHS FAIL (${bad.length})` : "FACEMORPHS ok");
  return bad.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--check")) process.exit(check());
  const raw = args.includes("--raw"), files = args.filter(x => !x.startsWith("--"));
  if (!files[0]) { console.log("node tools/face_morphs.mjs <in.glb> [out.glb] [--raw]   |   --check"); process.exit(1); }
  const r = bakeFile(path.resolve(files[0]), path.resolve(files[1] || files[0]), raw);
  console.log(r.meshes ? `FACEMORPHS ok (${r.meshes} meshes, ${r.targets} morph targets, ${r.corners} corners; scale ${r.scale.toFixed(3)}${r.eyes ? `; the lids kept off ${r.eyes} eyes: ${r.kept} corner moves ended on an eye's surface, the deepest ${(r.deepest * 1000).toFixed(1)} mm in, ${r.lifted} points lifted for their triangles` : ""})` : "FACEMORPHS ok (nothing to bake: no MHR points, or baked already)");
}
