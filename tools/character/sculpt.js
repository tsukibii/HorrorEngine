// The sculpt (the Character Studio's Body tab): named shape controls MHR's 45 identity shapes don't give (the
// forehead's height, the jaw's width, the arms' thickness...), each a smooth offset field over MHR's own base body,
// mirrored across the middle. The face's are placed by MediaPipe's points on that body (each pair averaged across the
// middle: MHR's mesh is symmetric, the points found on it aren't quite), the limbs' by their cross-sections. A slider
// runs from -1 to 1; the handles on the body drag them (index.html). Built once, on the base: added to any body as
// they are (as MHR's expressions are), so they ride its shapes, a photo's fit and every expression.
//
//   const S = buildSculpt({ P, T, lm })   P: MHR's base points (metres, Y up, +Z front, +X the character's left),
//                                         T: its triangles, lm(i): MediaPipe's point i on P
//   S.controls: [{ id, label, group, help, idx, d }]   idx: the points it moves; d: their offsets at 1 (xyz)
//   S.handles: [{ id, label, controls, at: [vertex, its twin or -1] }]   the circles on the body, and what each drags

export const GROUPS = ["Forehead", "Face", "Body"];

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };   // 0 at a, 1 at b
const bump = (d, r) => d >= r ? 0 : (1 - (d / r) ** 2) ** 2;                // 1 at the middle, 0 at r, smooth
const dist = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);

export function buildSculpt({ P, T, lm }) {
  const N = P.length / 3, at = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const n = new Float32Array(N * 3);                                       // the base's normals (area-weighted)
  for (let t = 0; t < T.length; t += 3) {
    const a = at(T[t]), b = at(T[t + 1]), c = at(T[t + 2]), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) n[T[t + k] * 3 + j] += f[j];
  }
  for (let i = 0; i < N; i++) { const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1; for (let j = 0; j < 3; j++) n[i * 3 + j] /= l; }
  const mid = (...ps) => [0, 1, 2].map(k => ps.reduce((s, p) => s + p[k], 0) / ps.length);
  const pair = (a, b) => { const A = lm(a), B = lm(b); return mid([-A[0], A[1], A[2]], B); };   // a pair on the left (+x) side, averaged across the middle
  const L = i => lm(i);

  // the face's places (metres on the base)
  const yb = mid(L(105), L(334), L(66), L(296))[1] + 0.002;                  // the brows' top: the forehead starts here
  const yLid = pair(159, 386)[1];
  let zlo = Infinity, zhi = -Infinity;                                      // the head's front and back at the brows: its middle
  for (let i = 0; i < N; i++) if (Math.abs(P[i * 3 + 1] - yb) < 0.006 && Math.abs(P[i * 3]) < 0.1) { zlo = Math.min(zlo, P[i * 3 + 2]); zhi = Math.max(zhi, P[i * 3 + 2]); }
  const zc = (zlo + zhi) / 2;
  const brow = pair(105, 334), glabella = L(9), temple = pair(21, 251), cheekbone = pair(116, 345), cheek = pair(50, 280);
  const jaw = pair(172, 397), chin = L(152), chinFront = mid(L(175), L(152)), tip = L(1), bridge = L(6), ala = pair(98, 327);
  const corner = pair(61, 291), lips = mid(L(0), L(17)), lowerLip = L(17);

  // the limbs' middles: the arm by slices across x, the leg by slices up y (the left side)
  const armW = (x, y) => y < 0.98 || y > 1.5 ? 0 : sm(0.205, 0.235, x) + (sm(0.10, 0.21, x) - sm(0.205, 0.235, x)) * sm(1.24, 1.32, y);   // how much a point is arm (and shoulder)
  const slices = (key, lo, hi, step, pick, get) => { const out = []; for (let s = lo; s <= hi + 1e-9; s += step) { let a = 0, b = 0, c = 0;
    for (let i = 0; i < N; i++) { const p = at(i); if (Math.abs(p[key] - s) < step / 2 && pick(p)) { const g = get(p); a += g[0]; b += g[1]; c++; } }
    out.push(c ? [a / c, b / c] : null); } return { lo, step, v: out }; };
  const along = (S, s) => { const f = Math.min(S.v.length - 1, Math.max(0, (s - S.lo) / S.step)), i = Math.floor(f), j = Math.min(S.v.length - 1, i + 1), A = S.v[i] || S.v[j], B = S.v[j] || A;
    if (!A) return null; const t = f - i; return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]; };
  const ARM = slices(0, 0.19, 0.56, 0.01, p => p[1] > 1.0 && armW(p[0], p[1]) > 0.5, p => [p[1], p[2]]);   // (y, z) by x
  const LEG = slices(1, 0.02, 0.92, 0.01, p => p[0] > 0.005, p => [p[0], p[2]]);                         // (x, z) by y
  const NECK = slices(1, 1.44, 1.60, 0.01, p => Math.abs(p[0]) < 0.07, p => [0, p[2]]);                  // (-, z) by y
  const head = p => p[1] > 1.5;

  // each control: f(p, nrm) for a point on the left (x >= 0), its offset at 1; mirrored for the right
  const C = [
    ["forehead_height", "Forehead height", "Forehead", "Taller or shorter above the brows (the skull's top with it; hair covers it).",
      p => head(p) && p[1] > yb - 0.01 ? [0, 0.22 * (p[1] - yb) * sm(yb - 0.006, yb + 0.03, p[1]), 0] : null],
    ["forehead_width", "Forehead width", "Forehead", "Wider or narrower above the brows.",
      p => head(p) && p[1] > yb - 0.01 ? [0.12 * p[0] * sm(yb - 0.006, yb + 0.06, p[1]), 0, 0] : null],
    ["forehead_slope", "Forehead slope", "Forehead", "The forehead's top forward (upright, rounder) or back (sloping).",
      p => head(p) && p[1] > yb - 0.01 ? [0, 0, 0.22 * (p[1] - yb) * sm(yb - 0.006, yb + 0.03, p[1]) * sm(zc, zc + 0.07, p[2])] : null],
    ["brow_ridge", "Brow ridge", "Forehead", "The bone over the eyes out or in (the lids stay).",
      (p, m) => { const w = Math.max(bump(dist(p, brow), 0.024), bump(dist(p, glabella), 0.018)) * sm(yLid + 0.003, yLid + 0.009, p[1]); return w ? m.map(v => 0.006 * w * v) : null; }],
    ["temples", "Temples", "Forehead", "Fuller or hollower temples.",
      (p, m) => { const w = bump(dist(p, temple), 0.03); return w ? m.map(v => 0.007 * w * v) : null; }],
    ["cheekbones", "Cheekbones", "Face", "Wider, more prominent cheekbones, or flatter.",
      p => { const w = bump(dist(p, cheekbone), 0.028); return w ? [0.008 * w, 0, 0.004 * w] : null; }],
    ["cheeks", "Cheeks", "Face", "Fuller or hollower cheeks.",
      (p, m) => { const w = bump(dist(p, [cheek[0], cheek[1] - 0.004, cheek[2]]), 0.026); return w ? m.map(v => 0.007 * w * v) : null; }],
    ["jaw_width", "Jaw width", "Face", "A wider, squarer jaw or a narrower one.",
      p => { const w = bump(dist(p, jaw), 0.04); return w ? [0.009 * w, 0, 0] : null; }],
    ["chin_length", "Chin length", "Face", "The chin longer (down) or shorter.",
      p => { const w = sm(lowerLip[1] - 0.004, lowerLip[1] - 0.024, p[1]) * sm(chin[1] - 0.03, chin[1] - 0.005, p[1]) * bump(p[0], 0.05) * sm(jaw[2], jaw[2] + 0.03, p[2]);   // the lower face, fading out under the chin
        return w ? [0, -0.01 * w, 0] : null; }],
    ["chin_width", "Chin width", "Face", "A broader or a pointier chin.",
      p => { const w = bump(dist(p, chin), 0.035); return w ? [0.3 * p[0] * w, 0, 0] : null; }],
    ["chin_forward", "Chin forward", "Face", "The chin out or back.",
      p => { const w = bump(dist(p, chinFront), 0.032); return w ? [0, 0, 0.008 * w] : null; }],
    ["nose_length", "Nose length", "Face", "The nose's tip lower (a longer nose) or higher.",
      p => { const w = bump(dist(p, tip), 0.02); return w ? [0, -0.005 * w, 0] : null; }],
    ["nose_tip", "Nose tip", "Face", "The tip out or in.",
      p => { const w = bump(dist(p, tip), 0.017); return w ? [0, 0, 0.005 * w] : null; }],
    ["nose_width", "Nose width", "Face", "Wider or narrower nostrils and tip.",
      p => { const w = bump(dist(p, [0, ala[1], ala[2]]), 0.026); return w ? [0.3 * p[0] * w, 0, 0] : null; }],
    ["nose_bridge", "Nose bridge", "Face", "A higher or a flatter bridge.",
      p => { const w = bump(dist(p, bridge), 0.018) * bump(p[0], 0.012); return w ? [0, 0, 0.004 * w] : null; }],
    ["mouth_width", "Mouth width", "Face", "A wider or a smaller mouth.",
      p => { const w = bump(dist(p, corner), 0.018); return w ? [0.005 * w, 0, 0] : null; }],
    ["lips", "Lips", "Face", "Fuller or thinner lips.",
      (p, m) => { const w = bump(Math.hypot(p[0] / 0.028, (p[1] - lips[1]) / 0.012, (p[2] - lips[2]) / 0.02), 1); return w ? m.map(v => 0.0035 * w * v) : null; }],
    ["neck", "Neck", "Body", "A thicker or a slimmer neck.",
      p => { if (p[1] < 1.44 || p[1] > 1.6) return null; const c = along(NECK, p[1]); if (!c) return null; const r = Math.hypot(p[0], p[2] - c[1]);
        const w = bump(Math.abs(p[1] - 1.5), 0.05) * sm(0.075, 0.06, r); return w ? [0.18 * p[0] * w, 0, 0.18 * (p[2] - c[1]) * w] : null; }],   // under the jaw
    ["shoulders", "Shoulders", "Body", "Broader or narrower shoulders (the arms move with them).",
      p => { const w = armW(p[0], p[1]); return w ? [0.03 * w, 0, 0] : null; }],
    ["chest", "Chest", "Body", "A deeper or a flatter chest.",
      p => { const w = bump(Math.abs(p[1] - 1.28), 0.09) * bump(p[0], 0.17) * sm(0.02, 0.09, p[2]) * (1 - armW(p[0], p[1])); return w ? [0, 0, 0.012 * w] : null; }],
    ["waist", "Waist", "Body", "A wider or a slimmer waist.",
      p => { const w = bump(Math.abs(p[1] - 1.12), 0.1) * (1 - sm(0.205, 0.235, p[0])); return w ? [0.12 * p[0] * w, 0, 0.08 * (p[2] - 0.03) * w] : null; }],
    ["hips", "Hips", "Body", "Wider or narrower hips.",
      p => { const w = bump(Math.abs(p[1] - 0.95), 0.1) * sm(0.3, 0.25, p[0]); return w ? [0.12 * p[0] * w, 0, 0.06 * p[2] * w] : null; }],
    ["upper_arms", "Upper arms", "Body", "Thicker or thinner upper arms.",
      p => { const a = armW(p[0], p[1]); if (a < 0.5 || p[1] < 1.0) return null; const c = along(ARM, p[0]); if (!c) return null;
        const w = bump(Math.abs(p[0] - 0.31), 0.12) * a; return w ? [0, 0.3 * (p[1] - c[0]) * w, 0.3 * (p[2] - c[1]) * w] : null; }],
    ["forearms", "Forearms", "Body", "Thicker or thinner forearms.",
      p => { const a = armW(p[0], p[1]); if (a < 0.5 || p[1] < 1.0) return null; const c = along(ARM, p[0]); if (!c) return null;
        const w = bump(Math.abs(p[0] - 0.47), 0.065) * a; return w ? [0, 0.3 * (p[1] - c[0]) * w, 0.3 * (p[2] - c[1]) * w] : null; }],
    ["thighs", "Thighs", "Body", "Thicker or thinner thighs.",
      p => { if (p[1] > 0.92) return null; const c = along(LEG, p[1]); if (!c) return null;
        const w = bump(Math.abs(p[1] - 0.68), 0.18) * sm(0, 0.02, p[0]); return w ? [0.15 * (p[0] - c[0]) * w, 0, 0.15 * (p[2] - c[1]) * w] : null; }],
    ["calves", "Calves", "Body", "Thicker or thinner calves.",
      p => { if (p[1] > 0.6) return null; const c = along(LEG, p[1]); if (!c) return null;
        const w = bump(Math.abs(p[1] - 0.36), 0.13) * (1 + 0.6 * sm(0, -0.03, p[2] - c[1])); return w ? [0.22 * (p[0] - c[0]) * w, 0, 0.22 * (p[2] - c[1]) * w] : null; }],
  ];
  const controls = C.map(([id, label, group, help, f]) => {
    const idx = [], d = [];
    for (let i = 0; i < N; i++) {
      const s = P[i * 3] < 0 ? -1 : 1, p = [s * P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], m = [s * n[i * 3], n[i * 3 + 1], n[i * 3 + 2]];
      const o = f(p, m); if (!o || !(Math.abs(o[0]) + Math.abs(o[1]) + Math.abs(o[2]) > 1e-7)) continue;
      idx.push(i); d.push(s * o[0], o[1], o[2]);
    }
    return { id, label, group, help, idx: Uint32Array.from(idx), d: Float32Array.from(d) };
  });

  // the handles: a circle where each feature is (its twin across the middle), dragging the controls named
  const nearest = c => { let bi = -1, bd = Infinity; for (let i = 0; i < N; i++) { const e = (P[i * 3] - c[0]) ** 2 + (P[i * 3 + 1] - c[1]) ** 2 + (P[i * 3 + 2] - c[2]) ** 2; if (e < bd) { bd = e; bi = i; } } return bi; };
  const extreme = (pick, score) => { let bi = -1, bs = -Infinity; for (let i = 0; i < N; i++) { const p = at(i); if (pick(p)) { const s = score(p); if (s > bs) { bs = s; bi = i; } } } return bi >= 0 ? at(bi) : null; };
  const H = [
    ["forehead", "Forehead", ["forehead_height", "forehead_slope"], L(151), false],
    ["forehead_side", "Forehead's width", ["forehead_width"], pair(103, 332), true],
    ["brow", "Brow ridge", ["brow_ridge"], brow, true],
    ["temple", "Temple", ["temples"], temple, true],
    ["cheekbone", "Cheekbone", ["cheekbones"], cheekbone, true],
    ["cheek", "Cheek", ["cheeks"], cheek, true],
    ["jaw", "Jaw", ["jaw_width"], jaw, true],
    ["chin", "Chin", ["chin_length", "chin_forward"], chin, false],
    ["chin_side", "Chin's width", ["chin_width"], [chin[0] + 0.018, chin[1] + 0.004, chin[2] - 0.004], true],
    ["nose_bridge", "Nose bridge", ["nose_bridge"], bridge, false],
    ["nose_tip", "Nose tip", ["nose_length", "nose_tip"], tip, false],
    ["nostril", "Nose width", ["nose_width"], ala, true],
    ["mouth", "Mouth corner", ["mouth_width"], corner, true],
    ["lips", "Lips", ["lips"], L(0), false],
    ["neck", "Neck", ["neck"], "out", true],
    ["shoulder", "Shoulder", ["shoulders"], extreme(p => p[0] > 0.17 && p[0] < 0.22 && p[1] < 1.5, p => p[1]), true],
    ["chest", "Chest", ["chest"], extreme(p => Math.abs(p[0] - 0.08) < 0.01 && Math.abs(p[1] - 1.28) < 0.01, p => p[2]), true],
    ["waist", "Waist", ["waist"], extreme(p => Math.abs(p[1] - 1.12) < 0.006 && p[0] < 0.2, p => p[0]), true],
    ["hips", "Hips", ["hips"], extreme(p => Math.abs(p[1] - 0.95) < 0.006 && p[0] < 0.25, p => p[0]), true],
    ["upper_arm", "Upper arm", ["upper_arms"], extreme(p => Math.abs(p[0] - 0.31) < 0.006 && p[1] > 1.0, p => p[1]), true],
    ["forearm", "Forearm", ["forearms"], extreme(p => Math.abs(p[0] - 0.47) < 0.006 && p[1] > 1.0, p => p[1]), true],
    ["thigh", "Thigh", ["thighs"], extreme(p => Math.abs(p[1] - 0.68) < 0.006 && p[0] > 0 && p[0] < 0.3, p => p[0]), true],
    ["calf", "Calf", ["calves"], extreme(p => Math.abs(p[1] - 0.36) < 0.006 && p[0] > 0 && p[0] < 0.3, p => p[0]), true],
  ];
  const out = id => {                                                      // "out": where the control pushes the body furthest outwards (+x)
    const c = controls.find(c => c.id === id); let bi = -1, bd = 0;
    for (let q = 0; q < c.idx.length; q++) if (c.d[q * 3] > bd && P[c.idx[q] * 3] > 0) { bd = c.d[q * 3]; bi = c.idx[q]; }
    return bi >= 0 ? at(bi) : null;
  };
  const handles = H.map(h => h[3] === "out" ? [h[0], h[1], h[2], out(h[2][0]), h[4]] : h).filter(h => h[3]).map(([id, label, ids, c, twin]) => {
    const a = nearest(c); return { id, label, controls: ids, at: [a, twin ? nearest([-P[a * 3], P[a * 3 + 1], P[a * 3 + 2]]) : -1] };
  });
  return { controls, handles, normals: n };
}

// a control's offset at one point (0 if it doesn't move it): what the handle's drag reads
export function offsetAt(c, v) {
  let lo = 0, hi = c.idx.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1, x = c.idx[m]; if (x === v) return [c.d[m * 3], c.d[m * 3 + 1], c.d[m * 3 + 2]]; if (x < v) lo = m + 1; else hi = m - 1; }
  return [0, 0, 0];
}
