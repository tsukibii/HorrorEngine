// face.js: an expression from the library (docs/EXPRESSIONS_PLAN.md, tools/face_capture.py) played on a body. A capture
// is MediaPipe's 52 ARKit scores a frame, raw; here it's sampled at a time, its neutral taken away and its strength
// applied, mapped onto MHR's 72 face shapes through arkit_mhr.json, and set on a body's morph targets. Shared by the
// desk (the Expressions tab's preview, the timeline later) and any page that can fetch /api/expressions/map.
//
//   loadMap()                        {map: ARKit -> [[MHR shape, weight]], mhr: MHR's 72 names in the bodies' order}
//   sample(e, t, o)                  {ARKit name: 0..1} at t seconds of its playing (o.loop, o.neutral, o.strength, o.w,
//                                    o.length: the seconds the whole capture takes, else e.length, else its own; between
//                                    frames a smooth curve, so a slowed capture glides; o.speed); a loop made from a
//                                    range (e.loop: {blend}) loops by itself, its end crossfaded into its start over
//                                    blend seconds, so the wrap never jumps (o.blend for any loop)
//   slice(e, a, b, blend)            frames a..b of an expression as a loop of its own (what the server keeps when a
//                                    range is saved as a loop): the whole capture's rest kept, its end blended over
//                                    blend seconds into its start
//   facePlan(faces, edgeT, total, lib)  a scene's face rows (STORY_FORMAT §3.7: [{who, expr, at, secs, loop, in, out, w,
//                                    speed}]) laid on its timeline: edgeT(at) the seconds a clip edge is at, lib the
//                                    expressions by id; {who: [{p, e, S, E, fin, fout, loop}]}
//   faceAt(plan, who, T)             {ARKit name: 0..1} on who's face at T seconds of the scene (null: nothing placed,
//                                    neutral): each placement faded in and out, a loop running until the next takes
//                                    over, overlapping ones crossfaded, one touching the next blended into it
//   toMHR(scores, M)                 Float32Array(72) in MHR's order
//   loadMHRFace()                    MHR's 72 face shapes on the points they move (Content/Studio/Bodies/MHR_lod1.bin)
//   faceOf(root, F)                  what on a body takes the 72: MHR's shape_c_45..116 morphs (the desk's MHR bodies),
//                                    or a Studio export's skin through its corners' MHR points (_MHRP, _MHRW) with F
//                                    from loadMHRFace, its brows on theirs, each lash card swung whole about its eye
//                                    as its root moves (_MHRR, _MHRE), its eyeballs turned on their bones by the gaze
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
/** each channel's rest under `neutral` (cached on the expression per neutral; a loop cut from a range keeps its whole
 * capture's, `rest`: its own first frames are the middle of the expression, not the face at rest) */
export function zeroOf(e, neutral = e.neutral || "first") {
  e._zero = e._zero || {};
  if (e._zero[neutral]) return e._zero[neutral];
  if (e.rest && e.rest[neutral]) return (e._zero[neutral] = e.rest[neutral]);
  const z = {};
  for (const [k, v] of Object.entries(e.curves || {})) {
    z[k] = neutral === "none" ? 0 : neutral === "quiet" ? pct(v, 5) : (v[0] + v[Math.min(1, v.length - 1)] + v[Math.min(2, v.length - 1)]) / 3;
  }
  return (e._zero[neutral] = z);
}

/** the seconds the whole capture plays in: o.length, else the library's own (e.length), else as it was filmed */
export const lengthOf = (e, o = {}) => +(o.length || e.length || e.secs || (e.frames || 1) / (e.fps || 30));
/** the scores at t seconds of its playing: the capture stretched to its length, between frames a Catmull-Rom curve
 * (a slowed capture glides instead of stepping), past the end held (or looped), the rest taken away (what's under it
 * reads as 0), scaled back to 0..1 and by the strength and o.w */
export function sample(e, t, o = {}) {
  const n = e.frames || 1, fps = e.fps || 30, out = {}, own = n / fps, k = own / lengthOf(e, o) * fps * (o.speed ?? 1);   // captured frames a second of playing
  const loop = !!(o.loop || e.loop), B = loop ? Math.min(n / 2, Math.max(0, +(o.blend ?? (e.loop || {}).blend ?? 0)) * k) : 0;
  const z = zeroOf(e, o.neutral || e.neutral || "first"), s = (o.strength ?? e.strength ?? 1) * (o.w ?? 1);
  let f = t * k, g = -1, x = 0;                         // f the frame; with a blended wrap, g the frame it fades from (x of the way out of it)
  if (!loop) f = Math.max(0, Math.min(n - 1, f));
  else if (B < 1) f = ((f % n) + n) % n;
  else {                                                // the loop's last B frames laid over its first: the end turns into the start
    const P = n - B; f = ((f % P) + P) % P;
    if (f < B) { g = f + P; x = f / B; x = x * x * (3 - 2 * x); }
  }
  const wrap = loop && B < 1;
  for (const [key, c] of Object.entries(e.curves || {})) {
    let v = curveAt(c, f, n, wrap);
    if (g >= 0) v = curveAt(c, g, n, false) * (1 - x) + v * x;
    const z0 = z[key] || 0;
    out[key] = Math.max(0, Math.min(1, (v - z0) / Math.max(0.05, 1 - z0) * s));
  }
  return out;
}
// a curve between its frames (Catmull-Rom: a slowed capture glides instead of stepping); its neighbours wrapped round a
// loop, else held at its ends
function curveAt(c, f, n, wrap) {
  const i = Math.floor(f), u = f - i, at = k => (wrap ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k)));
  const p0 = c[at(i - 1)], p1 = c[at(i)], p2 = c[at(i + 1)], p3 = c[at(i + 2)], u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3);
}

export function slice(e, a, b, blend = 0.4) {
  const n = e.frames || 1; a = Math.max(0, Math.min(n - 1, a | 0)); b = Math.max(a, Math.min(n - 1, b | 0));
  const curves = {}, rest = e.rest || { first: zeroOf(e, "first"), quiet: zeroOf(e, "quiet") };
  for (const [k, c] of Object.entries(e.curves || {})) curves[k] = c.slice(a, b + 1);
  const out = Object.assign({}, e, { frames: b - a + 1, secs: (b - a + 1) / (e.fps || 30), curves, rest, loop: { blend }, _zero: undefined });
  if (e.length) out.length = e.length * (b - a + 1) / n; else delete out.length;
  return out;
}

/** a scene's face rows on its timeline: per character its placements in order, each from where it's placed (S) to where
 * it's gone (E): its own length (stretched to secs), a loop until the next one (or secs, or the scene's end); one that
 * runs into or touches the next is taken over by it, the two crossfading over the next one's blend in */
export function facePlan(faces, edgeT, total, lib) {
  const rows = {};
  for (const p of faces || []) {
    const e = lib[p.expr], S = edgeT(p.at || {}); if (!e || S === undefined || S === null || !isFinite(S)) continue;
    (rows[p.who] = rows[p.who] || []).push({ p, e, S: Math.max(0, S) });
  }
  for (const list of Object.values(rows)) {
    list.sort((a, b) => a.S - b.S);
    list.forEach((it, i) => {
      const nx = list[i + 1], p = it.p;
      it.loop = !!(p.loop ?? it.e.loop); it.fin = Math.max(0, +(p.in ?? 0.25)); it.fout = Math.max(0, +(p.out ?? 0.3));
      let E = it.S + (+p.secs > 0 ? +p.secs : it.loop ? Infinity : lengthOf(it.e) / (+p.speed || 1));
      if (nx && nx.S < E + 0.05) { const nin = Math.max(0.05, +(nx.p.in ?? 0.25)); E = nx.S + nin; it.fout = nin; }   // the next takes over
      it.E = isFinite(E) ? E : Math.max(total, it.S) + it.fout;
    });
  }
  return rows;
}
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
export function faceAt(plan, who, T) {
  const list = plan && plan[who]; if (!list) return null;
  let sum = 0; const acc = {};
  for (const it of list) {
    if (T < it.S || T > it.E) continue;
    const env = smooth(Math.min(it.fin > 0 ? (T - it.S) / it.fin : 1, it.fout > 0 ? (it.E - T) / it.fout : 1)); if (env <= 0) continue;
    const p = it.p, sc = sample(it.e, T - it.S, { loop: it.loop, speed: +p.speed || 1, w: p.w ?? 1, length: !it.loop && +p.secs > 0 ? +p.secs * (+p.speed || 1) : undefined });
    for (const k in sc) acc[k] = (acc[k] || 0) + sc[k] * env;
    sum += env;
  }
  if (!sum) return null;
  if (sum > 1) for (const k in acc) acc[k] /= sum;
  return acc;
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
    const P = o.geometry.attributes.position, cs = [], sl = [], ws = [], RR = g.attributes._mhrr, EE = g.attributes._mhre;
    if (RR && EE) {                                   // lashes: a card a group, following its root's point, swung about its eye
      const cards = new Map();
      for (let v = 0; v < I.count; v++) {
        const key = RR.getX(v) + "," + RR.getY(v) + "," + RR.getZ(v); let c = cards.get(key);
        if (!c) cards.set(key, c = { s: F.slot[I.getX(v)], r: [RR.getX(v), RR.getY(v), RR.getZ(v)], e: [EE.getX(v), EE.getY(v), EE.getZ(v)], v: [] });
        c.v.push(v);
      }
      out.push({ mesh: o, F, cards: [...cards.values()].filter(c => c.s >= 0).map(c => Object.assign(c, { v: Uint32Array.from(c.v) })), base: Float32Array.from(P.array), tall: 0, eyes });
      return;
    }
    for (let c = 0; c < I.count; c++) {
      const s = [F.slot[I.getX(c)], F.slot[I.getY(c)], F.slot[I.getZ(c)]];
      if (s[0] < 0 && s[1] < 0 && s[2] < 0) continue;
      cs.push(c); sl.push(...s); ws.push(W.getX(c), W.getY(c), W.getZ(c));
    }
    let lo = Infinity, hi = -Infinity; for (let c = 0; c < P.count; c++) { lo = Math.min(lo, P.getY(c)); hi = Math.max(hi, P.getY(c)); }
    out.push({ mesh: o, F, cs: Uint32Array.from(cs), sl: Int32Array.from(sl), ws: Float32Array.from(ws), base: Float32Array.from(P.array), tall: hi - lo, eyes });
  });
  const tall = Math.max(0, ...out.filter(t => t.F && !t.cards).map(t => t.tall));   // the body's height (the skin's): MHR's moves scaled by it, brows and lashes too
  for (const t of out) if (t.F) t.scale = tall / t.F.tall;
  const skin = out.find(t => t.F && !t.cards && t.tall === tall);
  if (skin) skin.fit = eyeFits(root, skin);
  return out;
}

// the lids kept off the eyeballs: in the Studio an eyeball shows only through its opening (a stencil) and may stand
// proud of MHR's lids; a file has only depth, so the export rests the lids on the eyes, but a blink or a squint slides
// a lid down over the eye's front, which bulges further, and the eyeball came through it. Each eye's shape is measured
// once from its own mesh (its distance from its middle, by the angle from where it looks: the white's sphere, the
// cornea's dome; the Studio grows an eyeball to fill its opening and sets it back, so it's bigger than a real one), and
// every frame no skin round it goes deeper into it than it was at rest: a lid outside stays outside (pushed out to the
// eye's surface and a hair), the socket's skin that rests inside, hidden, keeps its depth (setFace)
const BINS = 24, GAP = 0.0004;
function eyeFits(root, skin) {
  const fits = [], P = skin.base;
  root.traverse(o => {
    const m = o.isSkinnedMesh && /_eye_([LR])$/.exec(o.name || ""); if (!m) return;
    const sk = o.skeleton, bi = sk.bones.findIndex(b => b.name === (m[1] === "L" ? "l_eye" : "r_eye")); if (bi < 0) return;
    const e = sk.boneInverses[bi].clone().invert().elements, c = [e[12], e[13], e[14]];   // the eye's joint at its middle, in the skin's bind space
    const V = o.geometry.attributes.position, prof = new Float32Array(BINS);
    let far = 0;
    for (let v = 0; v < V.count; v++) {
      const x = V.getX(v) - c[0], y = V.getY(v) - c[1], z = V.getZ(v) - c[2], L = Math.hypot(x, y, z); if (!L) continue;
      const b = Math.min(BINS - 1, Math.floor((1 - z / L) / 2 * BINS)); prof[b] = Math.max(prof[b], L); far = Math.max(far, L);   // by the angle from its front (+Z at rest)
    }
    for (let b = 1; b < BINS; b++) if (!prof[b]) prof[b] = prof[b - 1];
    const near = [], room = [];                        // the skin that could reach it (in front of its middle, within half again its size), and how far outside it rests
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i] - c[0], y = P[i + 1] - c[1], z = P[i + 2] - c[2], L = Math.hypot(x, y, z);
      if (!(z > -0.3 * far && L < 1.6 * far && L > 0)) continue;
      near.push(i / 3); room.push(Math.min(GAP, L - prof[Math.min(BINS - 1, Math.floor((1 - z / L) / 2 * BINS))]));
    }
    fits.push({ side: m[1], c, prof, near: Uint32Array.from(near), room: Float32Array.from(room) });
  });
  return fits;
}
function pushOut(A, fit, yaw, pitch) {
  const [cx, cy, cz] = fit.c, fx = Math.sin(yaw), fy = -Math.cos(yaw) * Math.sin(pitch), fz = Math.cos(yaw) * Math.cos(pitch);   // where the eye looks now
  for (let j = 0; j < fit.near.length; j++) {
    const i = fit.near[j] * 3, x = A[i] - cx, y = A[i + 1] - cy, z = A[i + 2] - cz, L = Math.hypot(x, y, z); if (!L) continue;
    const u = (1 - (x * fx + y * fy + z * fz) / L) / 2 * BINS, b = Math.min(BINS - 1, Math.floor(u)), r = fit.prof[b] + fit.room[j];   // no deeper than at rest
    if (L < r) { const k = r / L; A[i] = cx + x * k; A[i + 1] = cy + y * k; A[i + 2] = cz + z * k; }
  }
}
export function setFace(targets, w72) {
  let moved = null;                                    // MHR's moves for these weights, once for every part that needs them
  for (const t of targets) {
    if (t.idx) { const inf = t.mesh.morphTargetInfluences; for (let i = 0; i < t.idx.length; i++) if (t.idx[i] >= 0) inf[t.idx[i]] = w72 ? w72[i] : 0; continue; }
    const { F, cs, sl, ws, base, scale } = t, mv = F.move, P = t.mesh.geometry.attributes.position, A = P.array;
    if (moved !== F) {
      mv.fill(0); moved = F;
      if (w72) for (let e = 0; e < 72; e++) { const w = w72[e]; if (!w) continue; const off = e * F.k * 3; for (let i = 0; i < F.k * 3; i++) mv[i] += w * F.D[off + i]; }
    }
    if (t.cards) {                                     // a lash card: the turn about its eye that takes its root to where the lid put it
      for (const c of t.cards) {
        const [ex, ey, ez] = c.e, ax = c.r[0] - ex, ay = c.r[1] - ey, az = c.r[2] - ez;
        const bx = ax + mv[c.s * 3] * scale, by = ay + mv[c.s * 3 + 1] * scale, bz = az + mv[c.s * 3 + 2] * scale;
        const la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz);
        let kx = ay * bz - az * by, ky = az * bx - ax * bz, kz = ax * by - ay * bx; const sn = Math.hypot(kx, ky, kz) / (la * lb), cs1 = (ax * bx + ay * by + az * bz) / (la * lb);
        if (sn > 1e-9) { kx /= sn * la * lb; ky /= sn * la * lb; kz /= sn * la * lb; }
        for (const v of c.v) {
          const i = v * 3, px = base[i] - ex, py = base[i + 1] - ey, pz = base[i + 2] - ez;
          if (sn <= 1e-9) { A[i] = base[i]; A[i + 1] = base[i + 1]; A[i + 2] = base[i + 2]; continue; }
          const d = kx * px + ky * py + kz * pz, cx = ky * pz - kz * py, cy = kz * px - kx * pz, cz = kx * py - ky * px;   // Rodrigues: about k by the angle
          A[i] = ex + px * cs1 + cx * sn + kx * d * (1 - cs1); A[i + 1] = ey + py * cs1 + cy * sn + ky * d * (1 - cs1); A[i + 2] = ez + pz * cs1 + cz * sn + kz * d * (1 - cs1);
        }
      }
      P.needsUpdate = true; continue;
    }
    for (let j = 0; j < cs.length; j++) {
      const c = cs[j] * 3; let x = 0, y = 0, z = 0;
      for (let q = 0; q < 3; q++) { const s = sl[j * 3 + q]; if (s < 0) continue; const w = ws[j * 3 + q]; x += w * mv[s * 3]; y += w * mv[s * 3 + 1]; z += w * mv[s * 3 + 2]; }
      A[c] = base[c] + x * scale; A[c + 1] = base[c + 1] + y * scale; A[c + 2] = base[c + 2] + z * scale;
    }
    const at = n => (w72 ? w72[F.names.indexOf(n)] || 0 : 0);   // the eyeballs turned by the gaze, as the Studio turns them
    const gaze = sd => [Math.asin(Math.sin((at("eyesLookLeft_" + sd) - at("eyesLookRight_" + sd)) * 0.45)), Math.asin(Math.sin((at("eyesLookDown_" + sd) - at("eyesLookUp_" + sd)) * 0.35))];
    for (const f of t.fit || []) { const [yaw, pitch] = gaze(f.side); pushOut(A, f, yaw, pitch); }   // and the lids kept off them
    P.needsUpdate = true;
    t.eyes.forEach((b, i) => { if (!b) return; const [yaw, pitch] = gaze(i ? "R" : "L"); b.rotation.set(pitch, yaw, 0); });
  }
}
