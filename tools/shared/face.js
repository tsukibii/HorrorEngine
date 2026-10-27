// face.js: an expression from the library (docs/EXPRESSIONS_PLAN.md, tools/face_capture.py) played on a body. A capture
// is MediaPipe's 52 ARKit scores a frame, raw; here it's sampled at a time, its neutral taken away and its strength
// applied, mapped onto MHR's 72 face shapes through arkit_mhr.json, and set on a body's morph targets. Shared by the
// desk (the Expressions tab's preview, the timeline later) and any page that can fetch /api/expressions/map.
//
//   loadMap()                        {map: ARKit -> [[MHR shape, weight]], mhr: MHR's 72 names in the bodies' order}
//   sample(e, t, o)                  {ARKit name: 0..1} at t seconds (o.loop, o.neutral, o.strength, o.w)
//   toMHR(scores, M)                 Float32Array(72) in MHR's order
//   loadMHRFace()                    MHR's 72 face shapes on the points they move (Content/Studio/Bodies/MHR_lod1.bin)
//   faceOf(root, F)                  what on a body takes the 72: MHR's shape_c_45..116 morphs (the desk's MHR bodies),
//                                    or a Studio export's skin through its corners' MHR points (_MHRP, _MHRW) with F
//                                    from loadMHRFace, its eyeballs turned on their bones by the gaze
//   setFace(targets, w72)            the 72 weights onto it (null: neutral)
//   NEUTRALS                         how an expression's rest is found: first (its first frames), quiet (each channel's
//                                    quietest), none (MediaPipe's own zero)

export const NEUTRALS = [["first", "its first frames"], ["quiet", "each channel's quietest"], ["none", "none (MediaPipe's own)"]];
let MAP = null;
export function loadMap(base = "") {
  if (!MAP) MAP = fetch(base + "/api/expressions/map").then(r => { if (!r.ok) throw new Error("no expression map"); return r.json(); })
    .then(m => Object.assign(m, { index: Object.fromEntries(m.mhr.map((n, i) => [n, i])) }));
  return MAP;
}

const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
/** each channel's rest under `neutral` (cached on the expression per neutral) */
export function zeroOf(e, neutral = e.neutral || "first") {
  e._zero = e._zero || {};
  if (e._zero[neutral]) return e._zero[neutral];
  const z = {};
  for (const [k, v] of Object.entries(e.curves || {})) {
    z[k] = neutral === "none" ? 0 : neutral === "quiet" ? pct(v, 5) : (v[0] + v[Math.min(1, v.length - 1)] + v[Math.min(2, v.length - 1)]) / 3;
  }
  return (e._zero[neutral] = z);
}

/** the scores at t seconds: between frames blended, past the end held (or looped), the rest taken away (what's
 * under it reads as 0), scaled back to 0..1 and by the strength and o.w */
export function sample(e, t, o = {}) {
  const n = e.frames || 1, fps = e.fps || 30, out = {};
  let f = t * fps * (o.speed ?? 1);
  f = o.loop ? ((f % n) + n) % n : Math.max(0, Math.min(n - 1, f));
  const i = Math.floor(f), j = o.loop ? (i + 1) % n : Math.min(n - 1, i + 1), u = f - i;
  const z = zeroOf(e, o.neutral || e.neutral || "first"), s = (o.strength ?? e.strength ?? 1) * (o.w ?? 1);
  for (const [k, c] of Object.entries(e.curves || {})) {
    const v = c[i] * (1 - u) + c[j] * u, z0 = z[k] || 0;
    out[k] = Math.max(0, Math.min(1, (v - z0) / Math.max(0.05, 1 - z0) * s));
  }
  return out;
}

/** ARKit scores onto MHR's 72 (summed where two ARKit curves drive one shape, capped at 1) */
export function toMHR(scores, M) {
  const w = new Float32Array(M.mhr.length);
  for (const [k, v] of Object.entries(scores)) for (const [name, g] of M.map[k] || []) { const i = M.index[name]; if (i !== undefined) w[i] += v * g; }
  for (let i = 0; i < w.length; i++) w[i] = Math.min(1, w[i]);
  return w;
}

let MHRF = null;
/** MHR's 72 face shapes, sparse: the points they move (slot of each MHR point, -1 for none) and each shape's moves */
export function loadMHRFace(base = "") {
  if (!MHRF) MHRF = fetch(base + "/bodies/MHR_lod1.bin").then(r => { if (!r.ok) throw new Error("no MHR_lod1.bin"); return r.arrayBuffer(); }).then(buf => {
    const n = new DataView(buf).getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
    const idx = new Uint32Array(buf, H.expr_idx_at, H.expr_points), k = H.expr_points, half = new Uint16Array(buf, H.expr_at, H.expressions * k * 3);
    const D = new Float32Array(half.length);
    for (let i = 0; i < half.length; i++) {
      const x = half[i], s = x & 0x8000 ? -1 : 1, e = (x >> 10) & 31, f = x & 1023;
      D[i] = s * (e === 0 ? f * 5.960464477539063e-8 : e === 31 ? 0 : Math.pow(2, e - 15) * (1 + f / 1024));
    }
    const slot = new Int32Array(H.points).fill(-1); idx.forEach((p, i) => { slot[p] = i; });
    const P = new Float32Array(buf, H.points_at, H.points * 3); let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
    return { names: H.expr_names, k, D, slot, tall: hi - lo, move: new Float32Array(k * 3) };
  });
  return MHRF;
}

/** what on a body takes MHR's 72: morph targets shape_c_45..116 (the desk's MHR bodies), or a Studio export's skin
 * through each corner's three MHR points (its own copy of the geometry, so other figures wearing it stay still) */
export function faceOf(root, F = null) {
  const out = [], eyes = ["l_eye", "r_eye"].map(n => root.getObjectByName(n) || null);
  root.traverse(o => {
    const d = o.isMesh && o.morphTargetDictionary;
    if (d && "shape_c_45" in d) { out.push({ mesh: o, idx: Int32Array.from({ length: 72 }, (_, i) => d["shape_c_" + (45 + i)] ?? -1) }); return; }
    const g = o.isMesh && o.geometry, I = g && g.attributes._mhrp, W = g && g.attributes._mhrw;
    if (!I || !W || !F) return;
    o.geometry = o.geometry.clone();
    const P = o.geometry.attributes.position, cs = [], sl = [], ws = [];
    for (let c = 0; c < I.count; c++) {
      const s = [F.slot[I.getX(c)], F.slot[I.getY(c)], F.slot[I.getZ(c)]];
      if (s[0] < 0 && s[1] < 0 && s[2] < 0) continue;
      cs.push(c); sl.push(...s); ws.push(W.getX(c), W.getY(c), W.getZ(c));
    }
    let lo = Infinity, hi = -Infinity; for (let c = 0; c < P.count; c++) { lo = Math.min(lo, P.getY(c)); hi = Math.max(hi, P.getY(c)); }
    out.push({ mesh: o, F, cs: Uint32Array.from(cs), sl: Int32Array.from(sl), ws: Float32Array.from(ws), base: Float32Array.from(P.array), scale: (hi - lo) / F.tall, eyes });
  });
  return out;
}
export function setFace(targets, w72) {
  for (const t of targets) {
    if (t.idx) { const inf = t.mesh.morphTargetInfluences; for (let i = 0; i < t.idx.length; i++) if (t.idx[i] >= 0) inf[t.idx[i]] = w72 ? w72[i] : 0; continue; }
    const { F, cs, sl, ws, base, scale } = t, mv = F.move, P = t.mesh.geometry.attributes.position, A = P.array;
    mv.fill(0);
    if (w72) for (let e = 0; e < 72; e++) { const w = w72[e]; if (!w) continue; const off = e * F.k * 3; for (let i = 0; i < F.k * 3; i++) mv[i] += w * F.D[off + i]; }
    for (let j = 0; j < cs.length; j++) {
      const c = cs[j] * 3; let x = 0, y = 0, z = 0;
      for (let q = 0; q < 3; q++) { const s = sl[j * 3 + q]; if (s < 0) continue; const w = ws[j * 3 + q]; x += w * mv[s * 3]; y += w * mv[s * 3 + 1]; z += w * mv[s * 3 + 2]; }
      A[c] = base[c] + x * scale; A[c + 1] = base[c + 1] + y * scale; A[c + 2] = base[c + 2] + z * scale;
    }
    P.needsUpdate = true;
    const at = n => (w72 ? w72[F.names.indexOf(n)] || 0 : 0);   // the eyeballs turned by the gaze, as the Studio turns them
    t.eyes.forEach((b, i) => { if (!b) return; const sd = i ? "R" : "L";
      b.rotation.set(Math.asin(Math.sin((at("eyesLookDown_" + sd) - at("eyesLookUp_" + sd)) * 0.35)), Math.asin(Math.sin((at("eyesLookLeft_" + sd) - at("eyesLookRight_" + sd)) * 0.45)), 0); });
  }
}
