// The sculpt (the Character Studio's Body tab): named shape controls MHR's 45 identity shapes don't give (the
// forehead's height, the jaw's width, the arms' thickness...), each a smooth offset field over MHR's own base body,
// mirrored across the middle. The face's are placed by MediaPipe's points on that body (each pair averaged across the
// middle: MHR's mesh is symmetric, the points found on it aren't quite), the limbs' by their cross-sections. A slider
// runs from -1 to 1; the handles on the body drag them (index.html). Built once, on the base: added to any body as
// they are (as MHR's expressions are), so they ride its shapes, a photo's fit and every expression.
//
//   const S = buildSculpt({ P, T, lm, lid })   P: MHR's base points (metres, Y up, +Z front, +X the character's left),
//                                         T: its triangles, lm(i): MediaPipe's point i on P, lid: the left eye's own lid
//                                         line on P (index.html's MESHLID: 0 the outer corner, 1..7 the lower lid, 8 the
//                                         inner corner, 9..15 the upper; MediaPipe's ring without it)
//   S.controls: [{ id, label, group, help, idx, d }]   idx: the points it moves; d: their offsets at 1 (xyz)
//   S.handles: [{ id, label, controls, at: [vertex, its twin or -1] }]   the circles on the body, and what each drags

export const GROUPS = ["Forehead", "Face", "Body"];

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };   // 0 at a, 1 at b
const bump = (d, r) => d >= r ? 0 : (1 - (d / r) ** 2) ** 2;                // 1 at the middle, 0 at r, smooth
const dist = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);

export function buildSculpt({ P, T, lm, lid = null }) {
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
  // the upper lid's fold: the upper lid's own line (the opening's, inner corner to outer; MediaPipe's ring, 2 mm below
  // it on MHR's face, without it) and the brow's lower row (medial to lateral) on the left, each a height by x; a point's
  // height over the line, and ex where it is along the eye (0 the inner corner, 1 the outer)
  const LIDRING = lid && lid.length === 16 ? [lid[8], ...lid.slice(9), lid[0]] : [[133, 362], [173, 398], [157, 384], [158, 385], [159, 386], [160, 387], [161, 388], [246, 466], [33, 263]].map(([a, b]) => pair(a, b));
  const BROWLOW = [[55, 285], [65, 295], [52, 282], [53, 283], [46, 276]].map(([a, b]) => pair(a, b));
  const KEEP = lid ? 0.0028 : 0.0048;                                       // how far over the line nothing moves (the rim the lashes lie over, and the rim's search, 2.2 mm out)
  const yAt = (pts, x) => { const s = [...pts].sort((a, b) => a[0] - b[0]); if (x <= s[0][0]) return s[0][1]; if (x >= s[s.length - 1][0]) return s[s.length - 1][1];
    for (let k = 1; k < s.length; k++) if (x <= s[k][0]) { const f = (x - s[k - 1][0]) / (s[k][0] - s[k - 1][0]); return s[k - 1][1] + (s[k][1] - s[k - 1][1]) * f; } return s[0][1]; };
  const lidIn = LIDRING[0], lidOut = LIDRING[LIDRING.length - 1], lidMid = LIDRING[LIDRING.length >> 1];
  // the line's height by x on a fine grid (flat past its ends), kept from falling faster than SLOPE either way: its steep
  // ends at the corners stay under this envelope, so a point's height over it changes at most sqrt(1 + SLOPE²) as fast
  // as the point moves, and the drop's slope stays bounded round the corners too (measured from the line itself, the
  // skin just over the outer corner turned over)
  const SLOPE = 0.6, GDX = 0.00025, GX0 = lidIn[0] - 0.03, GN = Math.ceil((lidOut[0] + 0.03 - GX0) / GDX) + 1;
  const ENV = Float64Array.from({ length: GN }, (_, i) => yAt(LIDRING, GX0 + i * GDX));
  for (let i = 1; i < GN; i++) ENV[i] = Math.max(ENV[i], ENV[i - 1] - SLOPE * GDX);
  for (let i = GN - 2; i >= 0; i--) ENV[i] = Math.max(ENV[i], ENV[i + 1] - SLOPE * GDX);
  const lidY = x => { const f = Math.min(GN - 1, Math.max(0, (x - GX0) / GDX)), i = Math.min(GN - 2, Math.floor(f)); return ENV[i] + (ENV[i + 1] - ENV[i]) * (f - i); };

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
  // the belly: MHR's average stomach stands 3 cm proud of a straight line from the pubic bone to the lower ribs (and
  // 2 cm in front of the chest), more than its identity shapes can take back (the flattest takes 1 cm). Measured on
  // the base, down the middle: how far the front stands out of that line (bowed out 4 mm in its middle: a flat stomach
  // isn't a board) at each height. Taken back as a smooth field, whole across the middle 12 cm and easing out to the
  // flanks (only what's in front of the line, cut off at its edge, left the flanks standing round a sunken middle)
  const BY0 = 0.90, BY1 = 1.22, front = (y, x0, x1) => { let z = -Infinity; for (let i = 0; i < N; i++) { const ax = Math.abs(P[i * 3]); if (P[i * 3 + 2] > 0 && Math.abs(P[i * 3 + 1] - y) < 0.008 && ax >= x0 && ax <= x1) z = Math.max(z, P[i * 3 + 2]); } return z; };
  const z0 = front(BY0, 0, 0.015), z1 = front(BY1, 0, 0.015), E = [], STEP = 0.04;
  for (let y = BY0; y <= BY1 + 1e-9; y += STEP) { const t = (y - BY0) / (BY1 - BY0); E.push(t <= 0 || t >= 1 ? 0 : Math.max(0, front(y, 0, 0.015) - (z0 + (z1 - z0) * t + 0.004 * Math.sin(Math.PI * t)))); }
  const excess = y => {                                                   // between the samples a Catmull-Rom curve: no kinks for the light to catch
    const f = (y - BY0) / STEP, i = Math.floor(f), t = f - i, at = k => E[Math.max(0, Math.min(E.length - 1, k))];
    if (f <= 0 || f >= E.length - 1) return 0;
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    return Math.max(0, b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a))));
  };

  // the nose as a height over the face under it (its size, its projection): under it, the line from its root (the
  // nasion) to the subnasale down the middle, falling across to the skin at its border, where it meets the face (its
  // half-width by height, NW: 7 mm between the eyes, the alar crease's by the alae; that skin measured on the base,
  // smoothed). MHR's average nose is broad (its alae 37 mm across) and stands 16 mm out of that line at the tip: the
  // tip's and the bridge's own controls move a spot each, leaving the rest standing. A narrower nose takes the cheek
  // beside it in too, eased out over NF (4 mm between the eyes, 16 by the alae: the alar crease itself moves, or a
  // narrowed nose would stand on its old, wide foot), nothing within 6 mm of the eye's inner corner
  const nasion = L(168), subn = L(2), crease = pair(129, 358), canthus = pair(133, 362), yN = nasion[1], yS = subn[1];
  const NW = y => 0.007 + (crease[0] - 0.007) * sm(yN, crease[1], y), NF = y => 0.004 + 0.012 * sm(yN, crease[1], y);
  const NY0 = yS - 0.008, NB = [], NP = [];
  for (let i = 0; i < N; i++) if (P[i * 3 + 2] > 0.08 && Math.abs(P[i * 3]) < 0.04 && P[i * 3 + 1] > NY0 - 0.002 && P[i * 3 + 1] < yN + 0.01) NP.push(i);   // the face round the nose
  for (let y = NY0; y <= yN + 0.008; y += 0.001) {
    const x = NW(y); let z = -Infinity;
    for (const i of NP) if (Math.abs(Math.abs(P[i * 3]) - x) < 0.0015 && Math.abs(P[i * 3 + 1] - y) < 0.0015) z = Math.max(z, P[i * 3 + 2]);
    NB.push(z);
  }
  for (let i = 0; i < NB.length; i++) if (!isFinite(NB[i])) {                // rows the mesh missed: between their neighbours
    let j = i; while (j < NB.length && !isFinite(NB[j])) j++;
    const a = i > 0 ? NB[i - 1] : NB[j], b = j < NB.length ? NB[j] : a;
    for (let k = i; k < j; k++) NB[k] = a + (b - a) * (k - i + 1) / (j - i + 1);
    i = j;
  }
  for (let r = 0; r < 2; r++) { const A = NB.slice(); for (let i = 0; i < A.length; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(A.length - 1, i + 2); j++) { s += A[j]; c++; } NB[i] = s / c; } }
  const noseH = p => {                                                     // how far a point stands out of the face under the nose
    const w = NW(p[1]), f = Math.min(NB.length - 1, Math.max(0, (p[1] - NY0) / 0.001)), i = Math.min(NB.length - 2, Math.floor(f));
    const zl = nasion[2] + (subn[2] - nasion[2]) * Math.min(1, Math.max(0, (yN - p[1]) / (yN - yS))), zr = Math.min(zl, NB[i] + (NB[i + 1] - NB[i]) * (f - i)), u = Math.min(1, p[0] / w);
    return Math.max(0, p[2] - (zl - (zl - zr) * u * u)) * sm(w + 0.003, w - 0.001, p[0]);
  };
  const noseV = y => sm(yN + 0.002, yN - 0.006, y) * sm(yS - 0.004, yS + 0.001, y);   // its bulk: from the root to the subnasale
  const noseVX = y => sm(yN, yN - 0.015, y) * sm(yS - 0.012, yS + 0.001, y);          // its width: little at the root, all of it from the bridge's middle to the alae, easing out down the upper lip

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
    // hooded lids (the user's second lash reference, its old man: docs/research/lash_reference.md): the skin between the
    // lid's crease and the brow comes down over the lid and a little forward, most toward the outer corner and on past it
    // (age hoods the outer corner first); nothing within KEEP of the lid's own line moves, so the opening, the lid's rim
    // and the lashes' roots stay as they are; the drop's slope up the lid kept under 0.85, so the skin gathers into a fold
    // and never folds over itself. -1 lifts the crease instead (more lid showing)
    ["hooded_lids", "Hooded lids", "Face", "The skin under the brow down over the upper lid in a fold (an older or a heavy-lidded eye), most at the outer corner; −1 more lid showing. The opening and the lashes' roots stay.",
      p => {
        if (!head(p) || p[2] < lidMid[2] - 0.016) return null;
        const yl = lidY(p[0]), h = p[1] - yl, gap = yAt(BROWLOW, p[0]) - yl; if (!(gap > 2.5 * KEEP)) return null;
        const ex = (p[0] - lidIn[0]) / (lidOut[0] - lidIn[0]); if (h <= KEEP || h >= 1.4 * gap || ex < -0.15 || ex > 1.5) return null;
        const band = 0.4 * gap, A = Math.min(0.0032 * (0.75 + 0.45 * sm(0.3, 1.05, ex)), 0.85 * band / (1.5 * Math.hypot(1, SLOPE)));   // (the drop's steepest: A * 1.5 / band, times how fast h changes)
        const wx = sm(-0.15, 0.2, ex) * sm(1.5, 1.05, ex) * sm(2.5 * KEEP, 4 * KEEP, gap) * sm(lidMid[2] - 0.016, lidMid[2] - 0.009, p[2]);   // faded out along the eye, where the brow comes down to the lid, and round the head's side (no edge where it stops)
        const down = A * sm(KEEP, KEEP + band, h) * (1 - 0.6 * sm(0.6 * gap, 1.1 * gap, h)) * sm(1.4 * gap, 1.05 * gap, h) * wx, fwd = 0.0011 * sm(KEEP, KEEP + 0.5 * band, h) * sm(0.75 * gap, 0.35 * gap, h) * wx;
        return down > 1e-6 || fwd > 1e-6 ? [0, -down, fwd] : null;
      }],
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
    // the whole nose scaled toward the face under it: −1 its width (the alae, the tip, the bridge) 30% in and how far it
    // stands out 35% back, the cheek beside it eased along, the eyes and the lips as they were; Nose projection the
    // standing out alone (a flatter profile)
    ["nose_size", "Nose size", "Face", "The whole nose smaller (narrower, its nostrils in, standing less far out of the face) or bigger. The eyes and the mouth stay.",
      p => { const vz = noseV(p[1]), w = NW(p[1]), vx = p[0] < w + NF(p[1]) ? noseVX(p[1]) : 0; if (!vx && !vz) return null;
        return [vx && 0.3 * p[0] * sm(w + NF(p[1]), w, p[0]) * vx * sm(0.006, 0.012, dist(p, canthus)), 0, vz && 0.35 * noseH(p) * vz]; }],
    ["nose_projection", "Nose projection", "Face", "How far the nose stands out of the face, its bridge to its tip, seen from the side: −1 a flatter, smaller profile. Its root stays.",
      p => { const v = p[0] < NW(p[1]) + 0.003 && noseV(p[1]); return v ? [0, 0, 0.5 * noseH(p) * v] : null; }],
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
    ["belly", "Belly", "Body", "A flat stomach (all the way: back to a straight line from the pubic bone to the ribs) or a rounder belly.",
      (p, m) => { if (p[1] < BY0 || p[1] > BY1 || p[2] < 0) return null;
        const w = excess(p[1]) * sm(0.155, 0.06, p[0]) * sm(-0.1, 0.4, m[2]);   // whole across the middle, easing out by the flanks, and where the skin faces forward
        return w > 1e-6 ? [0, 0, w] : null; }],
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
    ["lid_fold", "Hooded lid", ["hooded_lids"], [lidMid[0] + 0.25 * (lidOut[0] - lidMid[0]), lidY(lidMid[0]) + KEEP + 0.2 * (yAt(BROWLOW, lidMid[0]) - lidY(lidMid[0])), lidMid[2] + 0.002], true],
    ["cheekbone", "Cheekbone", ["cheekbones"], cheekbone, true],
    ["cheek", "Cheek", ["cheeks"], cheek, true],
    ["jaw", "Jaw", ["jaw_width"], jaw, true],
    ["chin", "Chin", ["chin_length", "chin_forward"], chin, false],
    ["chin_side", "Chin's width", ["chin_width"], [chin[0] + 0.018, chin[1] + 0.004, chin[2] - 0.004], true],
    ["nose_side", "Nose size", ["nose_size"], pair(236, 456), true],
    ["nose_dorsum", "Nose projection", ["nose_projection"], L(5), false],
    ["nose_bridge", "Nose bridge", ["nose_bridge"], bridge, false],
    ["nose_tip", "Nose tip", ["nose_length", "nose_tip"], tip, false],
    ["nostril", "Nose width", ["nose_width"], ala, true],
    ["mouth", "Mouth corner", ["mouth_width"], corner, true],
    ["lips", "Lips", ["lips"], L(0), false],
    ["neck", "Neck", ["neck"], "out", true],
    ["shoulder", "Shoulder", ["shoulders"], extreme(p => p[0] > 0.17 && p[0] < 0.22 && p[1] < 1.5, p => p[1]), true],
    ["chest", "Chest", ["chest"], extreme(p => Math.abs(p[0] - 0.08) < 0.01 && Math.abs(p[1] - 1.28) < 0.01, p => p[2]), true],
    ["waist", "Waist", ["waist"], extreme(p => Math.abs(p[1] - 1.12) < 0.006 && p[0] < 0.2, p => p[0]), true],
    ["belly", "Belly", ["belly"], extreme(p => Math.abs(p[0]) < 0.008 && p[1] > 1.0 && p[1] < 1.12, p => p[2]), false],
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
