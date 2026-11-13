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
// (grow.js adds "Proportions" and "Creature": lengths and sizes of the body's parts, on MHR's rig; a few of the fields
// here are Creature's too: only monster mode shows them)

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
  const round = pair(192, 416);                                             // the lower cheek, beside the mouth's corner
  const jaw = pair(172, 397), chin = L(152), chinFront = mid(L(175), L(152)), tip = L(1), bridge = L(6), ala = pair(98, 327);
  const corner = pair(61, 291), lips = mid(L(0), L(17)), lowerLip = L(17);
  const chinSide = pair(148, 377);                             // under the nose, where it meets the lip; the chin's side on the jaw's border
  let lobeY = Infinity; for (let i = 0; i < N; i++) if (P[i * 3] > 0.062 && Math.abs(P[i * 3 + 2] - jaw[2]) < 0.03 && P[i * 3 + 1] > jaw[1] + 0.012 && P[i * 3 + 1] < jaw[1] + 0.06 && P[i * 3] > jaw[0] + 0.004) lobeY = Math.min(lobeY, P[i * 3 + 1]);   // the ear lobe's lowest point (the ear stands out of the head over the jaw's angle)
  if (!isFinite(lobeY)) lobeY = jaw[1] + 0.03;
  const lipTop = L(0), seam = L(13);                                      // the upper lip's top edge at the middle, the mouth's own line (where the lips meet)
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
  // how much a point comes down with the shoulder's point (Shoulder slope): as armW, but from the neck's root (7 cm out) to the shoulder's point (19), so the whole line slopes; nothing over the shoulders (the jaw, the ears)
  const slopeW = (x, y) => y < 0.98 || y > 1.53 ? 0 : (sm(0.205, 0.235, x) + (sm(0.07, 0.19, x) - sm(0.205, 0.235, x)) * sm(1.24, 1.32, y)) * sm(1.53, 1.505, y);
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

  // the eye's middle (between its corners, on the lid line), the ear (MHR's auricle: 6 cm tall from the lobe at the
  // nose's base to its top at the eye's height, standing a centimetre off the head's side, which is further out the
  // higher it is: the ear is what's outside that side), the face's front (the ears and the back of the jaw stay)
  const eyeC = mid(lidIn, lidOut), yFace = pair(145, 374)[1] - 0.004;
  const EAR0 = 1.566, EAR1 = 1.630, earRoot = [0.072, 1.598, 0.028], earTop = [0.084, 1.626, 0.020];
  // how much a point is ear, EARW (both sides): 1 where it stands well clear of the head's side, 0 on the skull, and
  // between them (the ear's root: the bowl in front, the fold behind) a harmonic blend over the mesh itself, each point
  // the mean of its neighbours. The ear is a thin sheet with a front and a back: a weight by how far out a point is
  // moved its two faces apart and through each other; by the mesh, both faces are ear alike and ease out at the root
  const EARW = new Float32Array(N);
  { const inBox = i => Math.abs(P[i * 3]) > 0.06 && P[i * 3 + 1] > EAR0 - 0.015 && P[i * 3 + 1] < EAR1 + 0.015 && P[i * 3 + 2] > -0.03 && P[i * 3 + 2] < 0.07;
    const free = [], slot = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) { if (!inBox(i)) continue;
      const e = Math.abs(P[i * 3]) - (0.073 + 0.12 * (P[i * 3 + 1] - 1.6)), y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (e > 0.0045 && y > EAR0 - 0.004 && y < EAR1 + 0.004 && z > -0.012 && z < 0.05) EARW[i] = 1;
      else if (e >= 0.0003) { slot[i] = free.length; free.push(i); } }
    const nb = free.map(() => new Set());
    for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) { const a = T[t + k], q = slot[a]; if (q >= 0) { nb[q].add(T[t + (k + 1) % 3]); nb[q].add(T[t + (k + 2) % 3]); } }
    const NB = nb.map(s => [...s]);
    for (let it = 0; it < 400; it++) for (let q = 0; q < free.length; q++) { let m = 0; for (const j of NB[q]) m += EARW[j]; EARW[free[q]] = NB[q].length ? m / NB[q].length : 0; }   // (in place: Gauss-Seidel, settled long before 400)
  }
  // a field about one eye reaches across the nose's bridge; each side's is worked out for its own eye alone, so what
  // it does sideways must be nothing at the middle (or the two halves pull the bridge apart: a pinch down the nose)
  const midOff = p => sm(0.002, 0.014, p[0]);
  const earOff = p => Math.max(0, p[0] - (0.073 + 0.12 * (p[1] - 1.6)));   // how far a point stands off the head's side (m)
  const faceFront = z => sm(0.035, 0.085, z);

  // the full bust's foot on the base (metres; the left breast's root on the chest): its middle, how far it reaches toward
  // the sternum, the arm, up (to under the collarbone) and down (to the fold under the breast). bustShape() below
  const BUST = { cx: 0.074, cy: 1.283, inn: 0.064, out: 0.094, up: 0.13, dn: 0.06 };
  // each control: f(p, nrm, i) for a point on the left (x >= 0; a right one mirrored onto it, i its own index), its offset at 1; mirrored for the right
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
    // a round face: the cheek's lower half and the jaw's side fuller as one broad, soft swell (the Cheeks control is the
    // apple of the cheek alone: turned up far it puffs; this is what a child's and a soft face have), or leaner
    ["face_round", "Round face", "Face", "The lower cheeks and the jaw's sides fuller together, a soft round face (a child's), or leaner.",
      (p, m) => { const w = bump(dist(p, round), 0.048) * sm(0.006, 0.018, dist(p, corner)); return w ? m.map(v => 0.005 * w * v) : null; }],   // (clear of the mouth's corner: the lips' seal there is slivers, turned by any push along their normals)
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
    // (two heads, DECISIONS 2026-11-13: a profile picture showed what no slider reached. Nose length moves the tip
    // alone: turned far it is a spike over a nose base that hasn't moved. Her nose joins the lip low, over a short
    // upper lip, and its underside rises from there to the tip: where it meets the lip and the nostrils lower, the tip
    // a quarter as far, is a doll's turned-up nose seen from the side)
    ["nose_base", "Nose base", "Face", "Where the nose meets the lip, and its nostrils, lower toward the mouth, the tip hardly: a nose turned up over a short upper lip (a doll's); or higher: a long upper lip under a nose that points down. The lips stay.",
      p => { if (p[1] > bridge[1] || p[1] < lipTop[1] - 0.002 || p[2] < ala[2] - 0.016) return null;
        const w = (p[1] >= subn[1] ? sm(tip[1] + 0.014, subn[1], p[1]) : sm(lipTop[1] - 0.002, subn[1], p[1])) * sm(ala[0] + 0.02, ala[0] + 0.005, p[0]) * sm(ala[2] - 0.016, ala[2] - 0.006, p[2]) * (1 - 0.75 * sm(subn[2] + 0.002, tip[2], p[2]));
        return w ? [0, -0.004 * w, 0.0015 * w] : null; }],                 // (and a little forward: the lip's top under a low nose base stands further out)
    // (the same picture: her jaw's line rises from the chin to the ear more steeply than MHR's. The jaw's angle under
    // the ear higher, the border between it and the chin with it, most at the angle: a small jaw with a short back)
    ["jaw_angle", "Jaw line", "Face", "The jaw's angle under the ear higher: the jaw's line rises more steeply from the chin to the ear (a small, soft jaw); or lower: a strong, square angle. The chin and the ear stay.",
      p => { const dx = jaw[0] - chinSide[0], dy = jaw[1] - chinSide[1], dz = jaw[2] - chinSide[2], L2 = dx * dx + dy * dy + dz * dz, t = Math.max(0, Math.min(1, ((p[0] - chinSide[0]) * dx + (p[1] - chinSide[1]) * dy + (p[2] - chinSide[2]) * dz) / L2));
        const w = bump(dist(p, [chinSide[0] + t * dx, chinSide[1] + t * dy, chinSide[2] + t * dz]), 0.034) * sm(0.1, 1, t) * sm(lobeY, lobeY - 0.012, p[1]); return w ? [0, 0.006 * w, 0] : null; }],
    ["mouth_width", "Mouth width", "Face", "A wider or a smaller mouth.",
      p => { const w = bump(dist(p, corner), 0.018); return w ? [0.005 * w, 0, 0] : null; }],
    ["lips", "Lips", "Face", "Fuller or thinner lips.",
      (p, m) => { const w = bump(Math.hypot(p[0] / 0.028, (p[1] - lips[1]) / 0.012, (p[2] - lips[2]) / 0.02), 1); return w ? m.map(v => 0.0035 * w * v) : null; }],
    // ---- the lips' own shape (DECISIONS 2026-11-13, better mouths: "a new v2 lip shape too that resembles the daz3d
    // lips (create some variations)"). MHR's lips are thick and even; the pictures' are a thin, defined upper lip over
    // a fuller lower one, a clear cupid's bow, corners that turn up. Each lip's red taller or thinner about the mouth's
    // own line (the seam stays: the teeth and the opening are set by it), the bow, the corners, the pout
    ["lip_upper", "Upper lip", "Face", "The upper lip's red taller and fuller, or thinner (its top edge drawn down toward the mouth's line).",
      p => { const h = lipTop[1] - seam[1], u = (p[1] - seam[1]) / h; if (u < 0 || p[1] > lipTop[1] + 0.007 || p[2] < lips[2] - 0.022) return null;
        const w = bump(p[0], 0.031) * (u <= 1 ? sm(0, 1, u) : 1 - sm(lipTop[1], lipTop[1] + 0.007, p[1])); return w ? [0, 0.34 * h * w, 0.0011 * w] : null; }],
    ["lip_lower", "Lower lip", "Face", "The lower lip's red taller and fuller, or thinner (its bottom edge drawn up toward the mouth's line).",
      p => { const h = seam[1] - lowerLip[1], u = (seam[1] - p[1]) / h; if (u < 0 || p[1] < lowerLip[1] - 0.008 || p[2] < lips[2] - 0.022) return null;
        const w = bump(p[0], 0.031) * (u <= 1 ? sm(0, 1, u) : 1 - sm(lowerLip[1], lowerLip[1] - 0.008, p[1])); return w ? [0, -0.3 * h * w, 0.0012 * w] : null; }],
    ["lip_bow", "Cupid's bow", "Face", "The upper lip's two peaks higher and the dip between them deeper: a defined bow (−1: a flat upper edge).",
      p => { if (p[2] < lips[2] - 0.02) return null; const pk = bump(Math.hypot(p[0] - 0.0055, p[1] - lipTop[1]), 0.0055), dp = bump(Math.hypot(p[0], p[1] - lipTop[1]), 0.0045);
        const w = pk - 0.8 * dp; return w ? [0, 0.0011 * w, 0] : null; }],
    ["lip_corners", "Lip corners", "Face", "The mouth's corners turned up (+) or down.",
      p => { const w = bump(dist(p, corner), 0.013); return w ? [0, 0.0028 * w, 0] : null; }],
    ["lip_pout", "Pout", "Face", "Both lips forward, their middle most (a pout), or flatter against the teeth.",
      p => { const w = bump(Math.hypot(p[0] / 0.024, (p[1] - lips[1]) / 0.013, (p[2] - lips[2]) / 0.02), 1); return w ? [0, 0, 0.003 * w] : null; }],
    // the face from the eyes down as one: its length toward the eyes' line (the nose, the mouth, the jaw and the chin
    // together: a child's face is short under its eyes, a long face is a horse's or a ghoul's), whole across the front,
    // easing out toward the ears (they stay) and, under the chin, down the neck
    ["face_height", "Face length", "Face", "The face from the eyes down (nose, mouth, jaw and chin together) longer or shorter: −1 a tenth shorter, a child's. The eyes and the ears stay.",
      p => { if (p[1] > yFace || p[1] < chin[1] - 0.05 || p[2] < 0.03) return null;
        const s = p[1] >= chin[1] ? yFace - p[1] : (yFace - chin[1]) * sm(chin[1] - 0.05, chin[1], p[1]), w = 0.1 * s * faceFront(p[2]);
        return w > 1e-7 ? [0, -w, 0] : null; }],
    // the eyes: the skin round each (its lids, the socket's rim) bigger or smaller about the eye's own middle; the eyeball
    // and the opening follow the skin (the grafted eyes grow with it). The move's slope stays well inside 1 at any
    // slider, so the lids never fold
    // the face narrowing from the eyes down to the chin, or widening: every point of the face's front sideways in
    // proportion to how far out it is, more the lower it is (nothing at the eyes' line, a third of it at the mouth,
    // all of it at the chin, easing out under it), so each height keeps its own shape and nothing is left standing
    // over what moved. (Jaw width is a spot at the jaw's angle and Chin width a spot at the chin: pulled in far, the
    // cheek above them is left as a ledge. A band along the jaw's own line was tried first and did the same.) With
    // Face length it makes a small lower face, shorter and narrower together: the v2female base's. The eyes and the
    // ears stay, as Face length's
    ["face_taper", "Face taper", "Face", "The face narrowing from the eyes down to a small chin (a V: -1 a fifth narrower at the chin), or widening to a broad jaw. The eyes and the ears stay.",
      p => { if (p[1] > yFace || p[1] < chin[1] - 0.05 || p[2] < 0.03) return null;
        const t = p[1] >= chin[1] ? (yFace - p[1]) / (yFace - chin[1]) : sm(chin[1] - 0.05, chin[1], p[1]), w = 0.2 * t * t * faceFront(p[2]);
        return w > 1e-7 ? [p[0] * w, 0, 0] : null; }],
    ["eye_size", "Eye size", "Face", "Bigger or smaller eyes: the lids and the socket round each eye about its middle (the eyeball follows).",
      p => { const w = bump(dist(p, eyeC), 0.036) * midOff(p); return w ? [0.15 * w * (p[0] - eyeC[0]), 0.15 * w * (p[1] - eyeC[1]), 0.15 * w * (p[2] - eyeC[2])] : null; }],
    ["eye_spacing", "Eye spacing", "Face", "The eyes further apart or closer together.",
      p => { const w = bump(dist(p, eyeC), 0.04) * sm(0.004, 0.012, p[0]); return w ? [0.004 * w, 0, 0] : null; }],
    ["eye_depth", "Deep-set eyes", "Face", "The eyes back under the brow (deep-set, sunken) or forward.",
      p => { const w = bump(dist(p, eyeC), 0.032); return w ? [0, 0, -0.004 * w] : null; }],
    // the ears' moves grow with how far a point stands off the head (earOff): nothing at the ear's root all round (in
    // front, behind, at its top and its lobe), all of it at the rim, and the sheet's two faces, a few millimetres
    // apart, moving almost alike
    ["ears_size", "Ear size", "Face", "Bigger or smaller ears.",
      (p, m, i) => { const w = EARW[i]; if (!w) return null; const e = earOff(p), o = w * sm(0.001, 0.011, e); return [0.25 * w * e, 0.25 * o * (p[1] - earRoot[1]), 0.25 * o * (p[2] - earRoot[2])]; }],
    ["ears_out", "Ears out", "Face", "Ears that stand out from the head, or lie flat against it.",
      (p, m, i) => { const w = EARW[i]; if (!w) return null; const e = earOff(p); return [0.45 * w * e, 0, 0.15 * w * e]; }],   // (−1: nearly half the way to the head, the ear's bowl kept)
    // ---- Creature (monster mode): what no person has
    ["eye_tilt", "Eye slant", "Creature", "The eyes' outer corners up (a cat's, a demon's) or down.",
      p => { const w = bump(dist(p, eyeC), 0.034) * midOff(p); return w ? [-0.14 * w * (p[1] - eyeC[1]), 0.14 * w * (p[0] - eyeC[0]), 0] : null; }],
    // pointed ears: the ear's top drawn up, back and out to a point, more the higher on the ear, its width gathered in
    // toward the tip (a quarter a slider: at 3 it still hasn't crossed itself)
    ["ears_point", "Pointed ears", "Creature", "The ears' tops drawn up and back to a point (an elf's, a goblin's); with Ear size, long ones.",
      (p, m, i) => { const w = EARW[i]; if (!w) return null; const t = sm(1.588, EAR1, p[1]), k = w * sm(0.001, 0.011, earOff(p)) * t * t;
        return k > 1e-6 ? [0.005 * k, 0.02 * k, -0.011 * k - 0.25 * k * (p[2] - earTop[2])] : null; }],
    ["snout", "Snout", "Creature", "The nose and the mouth forward together, a muzzle.",
      p => { const w = bump(Math.hypot(p[0] / 0.05, (p[1] - (subn[1] - 0.006)) / 0.05, (p[2] - subn[2]) / 0.07), 1); return w ? [0, 0, 0.014 * w] : null; }],
    ["skull_back", "Long skull", "Creature", "The back of the head drawn out behind (an alien's long skull).",
      p => { if (!head(p) || p[2] > zc) return null; const w = sm(1.555, 1.61, p[1]) * sm(zc, zc - 0.04, p[2]); return w ? [0, 0.06 * (zc - p[2]) * w, -0.3 * (zc - p[2]) * w] : null; }],
    ["neck", "Neck", "Body", "A thicker or a slimmer neck.",
      p => { if (p[1] < 1.44 || p[1] > 1.6) return null; const c = along(NECK, p[1]); if (!c) return null; const r = Math.hypot(p[0], p[2] - c[1]);
        const w = bump(Math.abs(p[1] - 1.5), 0.05) * sm(0.075, 0.06, r); return w ? [0.18 * p[0] * w, 0, 0.18 * (p[2] - c[1]) * w] : null; }],   // under the jaw
    // the whole neck, as a column: every point of it in toward its own axis (or out), from under the skull and the jaw
    // down to where it runs into the shoulders; out toward the shoulders it fades with the distance from the axis. (Neck, above, is the throat under the jaw alone: it stops 7 cm from the
    // axis, and the widest of MHR's neck is its back and sides, further out. The v2female base's slender neck is this.)
    ["neck_width", "Neck width", "Body", "The whole neck slimmer or thicker, from under the skull and the jaw down to the shoulders (Neck is the throat under the jaw alone).",
      p => { if (p[1] < 1.4 || p[1] > 1.6) return null;
        // (its axis: the neck's own middle, front to back, at two heights of the neck proper, and the line through them
        // above and below: over the chin the slices' middles are the face's, far in front, and the jaw's angles would
        // count as the neck's back)
        const y1 = 1.45, y2 = chin[1] - 0.012, a1 = along(NECK, y1), a2 = along(NECK, y2); if (!a1 || !a2) return null;
        const dz = p[2] - (a1[1] + (a2[1] - a1[1]) * (p[1] - y1) / (y2 - y1)), r = Math.hypot(p[0], dz); if (r < 1e-6) return null;
        // (where it ends above, by the bearing from the axis: 0 straight in front, 90 to the side, 180 behind. Under the
        // chin in front, rising to under the jaw's line at the side, then from just behind the jaw up to under the ear
        // and the skull's base, and so round the nape. Nothing at that height itself: the jaw's line and the chin
        // don't move. It first stayed at the jaw's height to behind the ear: the neck then kept its full width under
        // the ears, a column that flared at its top, where the user's Daz characters' is straight up to the ear)
        const th = Math.atan2(Math.abs(p[0]), dz) * 180 / Math.PI, t0 = chin[1] - 0.006, t1 = jaw[1] - 0.004, tj = t0 + (t1 - t0) * sm(30, 85, th), top = tj + (1.565 - tj) * sm(95, 140, th);
        // (how fast it comes in under that height: within 3 cm under the jaw, which overhangs the neck anyway; over
        // 5 cm at the back, where the skull runs down into the nape: in 3 cm there it left a step under the skull)
        const w = sm(1.405, 1.46, p[1]) * sm(top + 0.004, top - 0.026 - 0.024 * sm(110, 150, th), p[1]) * sm(0.125, 0.08, r);
        return w > 1e-4 ? [0.3 * p[0] * w, 0, 0.3 * dz * w, sm(100, 125, th)] : null; }, { smooth: 3 }],   // (smoothed behind the jaw only: the jaw's own line keeps the field's edge as it is)
    ["shoulders", "Shoulders", "Body", "Broader or narrower shoulders (the arms move with them).",
      p => { const w = armW(p[0], p[1]); return w ? [0.03 * w, 0, 0] : null; }],
    // sloping shoulders: the line from the neck out to the shoulder's point comes down, more the further out (nothing
    // at the neck's root, all of it from the shoulder's point on: the arm goes down whole with it), as Shoulders moves
    // them sideways. MHR's shoulder line runs out almost level from 4 cm under the chin: with a slender neck on it, a
    // pole on a shelf. Sloped, the neck's line carries on down into the shoulder. -1 squarer, higher at the points
    ["shoulder_slope", "Shoulder slope", "Body", "Sloping shoulders: the shoulders' points and the arms lower, the line from the neck coming down to them (a long neck's line), or square, level ones.",
      p => { const w = slopeW(p[0], p[1]); return w ? [0, -0.03 * w, 0] : null; }],
    // the neck's base: the rise from the shoulders up to the neck (the trapezius' top edge). On MHR it is a straight
    // ramp from a third of the way down the neck out to the shoulder's point: a tent, which a slender neck stands in
    // like a pole. Hollowed (-1), the top of the shoulder between the neck's root and its point comes down, most 9 cm
    // out and nothing at either end, so the ramp becomes a curve: steep beside the neck, then level; the neck reads
    // long and stands clear. Only the top (from 1.47 m up on the base, easing out over 7 cm below it, front and back)
    ["neck_base", "Neck base", "Body", "The rise from the shoulders up to the neck: hollowed and lower (a long, slender neck standing clear of the shoulders), or fuller and higher (strong shoulders, a short neck).",
      p => { const w = sm(0.045, 0.085, p[0]) * sm(0.175, 0.11, p[0]) * sm(1.40, 1.47, p[1]) * sm(1.535, 1.515, p[1]); return w > 1e-4 ? [0, 0.025 * w, 0] : null; }],
    ["chest", "Chest", "Body", "A deeper or a flatter chest.",
      p => { const w = bump(Math.abs(p[1] - 1.28), 0.09) * bump(p[0], 0.17) * sm(0.02, 0.09, p[2]) * (1 - armW(p[0], p[1])); return w ? [0, 0, 0.012 * w] : null; }],
    ["bust", "Bust", "Body", "A fuller bust or a flatter chest (a child's: −1). With Anime on (above) it runs further: −2 flat, past 1 a full, heavy bust (3: very large).",
      (p, m) => { if (p[2] < 0.03 || p[1] < 1.18 || p[1] > 1.39) return null;
        const w = bump(Math.hypot((p[0] - 0.072) / 0.078, (p[1] - 1.285) / 0.09), 1) * sm(0.1, 0.6, m[2]) * (1 - armW(p[0], p[1])); return w > 1e-6 ? [0.2 * 0.016 * w * sm(0, 0.02, p[0]), -0.15 * 0.016 * w, 0.016 * w] : null; }, { cap: 1 }],
    ["waist", "Waist", "Body", "A wider or a slimmer waist.",
      p => { const w = bump(Math.abs(p[1] - 1.12), 0.1) * (1 - sm(0.205, 0.235, p[0])); return w ? [0.12 * p[0] * w, 0, 0.08 * (p[2] - 0.03) * w] : null; }],
    ["belly", "Belly", "Body", "A flat stomach (all the way: back to a straight line from the pubic bone to the ribs) or a rounder belly.",
      (p, m) => { if (p[1] < BY0 || p[1] > BY1 || p[2] < 0) return null;
        const w = excess(p[1]) * sm(0.155, 0.06, p[0]) * sm(-0.1, 0.4, m[2]);   // whole across the middle, easing out by the flanks, and where the skin faces forward
        return w > 1e-6 ? [0, 0, w] : null; }],
    ["hips", "Hips", "Body", "Wider or narrower hips.",
      p => { const w = bump(Math.abs(p[1] - 0.95), 0.1) * sm(0.3, 0.25, p[0]); return w ? [0.12 * p[0] * w, 0, 0.06 * p[2] * w] : null; }],
    ["seat", "Seat", "Body", "A rounder or a flatter seat.",
      (p, m) => { if (p[2] > 0 || p[1] < 0.76 || p[1] > 1.0) return null;
        const w = bump(Math.hypot((p[0] - 0.085) / 0.1, (p[1] - 0.885) / 0.11), 1) * sm(-0.1, -0.6, m[2]); return w > 1e-6 ? [0, 0, -0.014 * w] : null; }],
    // (more body presets, DECISIONS 2026-11-13: the user's low-poly character: thick thighs under a skinny waist. Hips,
    // Seat and Thighs each swell their own band, and stacked far enough they leave a dip under the seat and a bulge
    // at mid thigh; this is the lower body as one shape: widest where the thigh joins the hip, easing up into the
    // waist and tapering all the way down to the knee, more to the back (the seat) than to the front, the thighs'
    // insides hardly moved so they don't run into each other)
    ["pear", "Hips & thighs", "Body", "The lower body fuller as one shape: round hips running into thick thighs that taper to the knee, the seat with them (a pear), or slimmer.",
      p => { const y = p[1]; if (y < 0.42 || y > 1.18) return null;
        // (a long rise from the waist, a level stretch over the hip and the thigh's top, a longer fall to the knee:
        // a body's outline is a curve, and a short rise draws a straight line out to a point at the hip. The user, on
        // the first v2 pear: "notice how sharp the angle is around the waist to hips ... make it more curved")
        const lo = sm(0.42, 0.8, y) * sm(0.3, 0.25, p[0]), w = sm(1.16, 0.9, y) * lo, wb = sm(1.18, 0.98, y) * lo; if (w < 1e-6 && wb < 1e-6) return null;   // (wb: to the back the whole seat grows alike, so it stays the round thing it is: with the sides' long rise it came to a point low down)
        // about the leg's own line, and the hip joint's above it: a line fitted to MHR's base (the thigh's middle is
        // 10.5 cm out at the hip and 14.9 at the knee, the legs standing apart; 1.2 cm forward and 6 back), bent
        // smoothly where the legs join. (The sampled line, LEG, steps from slice to slice: the outline had its kinks)
        const u = 0.8 - y, r = u > 0.05 ? u : u < -0.05 ? 0 : (u + 0.05) * (u + 0.05) / 0.2, dx = p[0] - (0.105 + 0.122 * r), dz = p[2] - (0.012 - 0.2 * r);
        return [0.3 * dx * (dx < 0 ? 0.1 * sm(0, 0.02, p[0]) : 1) * w, 0, dz < 0 ? 0.22 * dz * wb : 0.1 * dz * w]; }],   // (nothing sideways at the body's middle)
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
  const NBR = Array.from({ length: N }, () => new Set());                  // each point's neighbours on the mesh
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) { NBR[T[t + k]].add(T[t + (k + 1) % 3]); NBR[T[t + k]].add(T[t + (k + 2) % 3]); }
  const controls = C.map(([id, label, group, help, f, more]) => {
    const idx = [], d = [], how = [];
    for (let i = 0; i < N; i++) {
      const s = P[i * 3] < 0 ? -1 : 1, p = [s * P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], m = [s * n[i * 3], n[i * 3 + 1], n[i * 3 + 2]];
      const o = f(p, m, i); if (!o || !(Math.abs(o[0]) + Math.abs(o[1]) + Math.abs(o[2]) > 1e-7)) continue;
      idx.push(i); d.push(s * o[0], o[1], o[2]); how.push(o.length > 3 ? o[3] : 1);
    }
    // (smooth: n rounds of each moved point taking the mean of its own offset and its neighbours' on the mesh, the
    // points the field left alone staying at nothing: a field whose edge runs slantwise across the mesh, the neck's
    // under the ear, otherwise leaves a crease along that edge)
    if (more && more.smooth) { const slot = new Int32Array(N).fill(-1), raw = d.slice(); idx.forEach((i, q) => { slot[i] = q; });
      for (let r = 0; r < more.smooth; r++) { const e = d.slice(); idx.forEach((i, q) => { let sx = e[q * 3], sy = e[q * 3 + 1], sz = e[q * 3 + 2], c = 1; for (const j of NBR[i]) { const k = slot[j]; c++; if (k >= 0) { sx += e[k * 3]; sy += e[k * 3 + 1]; sz += e[k * 3 + 2]; } } d[q * 3] = sx / c; d[q * 3 + 1] = sy / c; d[q * 3 + 2] = sz / c; }); }
      for (let q = 0; q < idx.length; q++) { const k = how[q]; for (let a = 0; a < 3; a++) d[q * 3 + a] = raw[q * 3 + a] + (d[q * 3 + a] - raw[q * 3 + a]) * k; } }   // (how: the field's fourth number, how much of the smoothing a point takes, all of it when it gives none)
    return { id, label, group, help, idx: Uint32Array.from(idx), d: Float32Array.from(d), ...(more || {}) };
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
    ["face", "Face length", ["face_height"], [0.03, chin[1] + 0.012, chin[2] - 0.016], true],
    ["face_side", "Face taper", ["face_taper"], pair(150, 379), true],
    ["eye", "Eye size", ["eye_size"], [eyeC[0], yFace - 0.006, eyeC[2] - 0.004], true],
    ["ear", "Ear", ["ears_size", "ears_out"], [0.087, 1.6, 0.012], true],
    ["ear_top", "Pointed ear", ["ears_point"], earTop, true],
    ["snout", "Snout", ["snout"], [0, subn[1] - 0.004, subn[2]], false],
    ["neck", "Neck", ["neck"], "out", true],
    ["shoulder", "Shoulder", ["shoulders", "shoulder_slope"], extreme(p => p[0] > 0.17 && p[0] < 0.22 && p[1] < 1.5, p => p[1]), true],
    ["neck_root", "Neck base", ["neck_base"], extreme(p => Math.abs(p[0] - 0.09) < 0.006 && p[1] < 1.51 && p[1] > 1.4, p => p[1]), true],
    ["chest", "Chest", ["chest"], extreme(p => Math.abs(p[0] - 0.08) < 0.01 && Math.abs(p[1] - 1.28) < 0.01, p => p[2]), true],
    ["bust", "Bust", ["bust"], extreme(p => Math.abs(p[0] - 0.075) < 0.008 && Math.abs(p[1] - 1.24) < 0.008, p => p[2]), true],
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
  // ---- the full bust's foot (bustShape, below): on each side the points of the breast's root, the ring of points round
  // them, and the chest wall under them as the ring's points say it is: each foot point the mean of its neighbours (a
  // membrane across the ring: the chest with no breast on it), solved once here as weights on the ring's points, so any
  // body's wall is a sum of its own ring. The foot's layout (how far each point is from the middle toward its edge,
  // which way) is read on the base's wall, the breast's middle a few points round it
  const nbr = Array.from({ length: N }, () => new Set());
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) { nbr[T[t + k]].add(T[t + (k + 1) % 3]); nbr[T[t + k]].add(T[t + (k + 2) % 3]); }
  const bust = [1, -1].map(sg => {
    const B = BUST, slot = new Int32Array(N).fill(-1), idx = [], g = [];
    for (let i = 0; i < N; i++) {
      const px = sg * P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2]; if (px < 0.004 || pz < 0.02) continue;
      const ex = px - B.cx, ey = py - B.cy; if (Math.hypot(ex / (ex < 0 ? B.inn : B.out), ey / (ey < 0 ? B.dn : B.up)) >= 1) continue;
      const w = sm(-0.1, 0.4, n[i * 3 + 2]) * (1 - sm(0.165, 0.2, px) * sm(1.26, 1.32, py)); if (w < 0.02) continue;   // the skin that faces forward, the arm's own by the armpit left out
      slot[i] = idx.length; idx.push(i); g.push(w);
    }
    const nf = idx.length, ringSlot = new Map(), ring = [];
    for (const i of idx) for (const j of nbr[i]) if (slot[j] < 0 && !ringSlot.has(j)) { ringSlot.set(j, ring.length); ring.push(j); }
    const nr = ring.length, A = new Float64Array(nf * nf), R = new Float64Array(nf * nr);
    idx.forEach((i, q) => { A[q * nf + q] = 1; const k = 1 / nbr[i].size; for (const j of nbr[i]) { if (slot[j] >= 0) A[q * nf + slot[j]] -= k; else R[q * nr + ringSlot.get(j)] += k; } });
    for (let c = 0; c < nf; c++) {                                          // A W = R by elimination (A: each row its point less its neighbours' mean, well conditioned; a couple of hundred points)
      let pv = c; for (let r = c + 1; r < nf; r++) if (Math.abs(A[r * nf + c]) > Math.abs(A[pv * nf + c])) pv = r;
      if (pv !== c) { for (let k = 0; k < nf; k++) { const t = A[c * nf + k]; A[c * nf + k] = A[pv * nf + k]; A[pv * nf + k] = t; } for (let k = 0; k < nr; k++) { const t = R[c * nr + k]; R[c * nr + k] = R[pv * nr + k]; R[pv * nr + k] = t; } }
      const d = A[c * nf + c]; for (let k = c; k < nf; k++) A[c * nf + k] /= d; for (let k = 0; k < nr; k++) R[c * nr + k] /= d;
      for (let r = 0; r < nf; r++) { if (r === c) continue; const m = A[r * nf + c]; if (!m) continue; for (let k = c; k < nf; k++) A[r * nf + k] -= m * A[c * nf + k]; for (let k = 0; k < nr; k++) R[r * nr + k] -= m * R[c * nr + k]; }
    }
    const W = Float32Array.from(R), nrm = unit3([sg * 0.1, 0, 1]), out = [sg * nrm[2], 0, -sg * nrm[0]];   // the chest's plane there: facing a little outward; `out` across it away from the middle, y up it
    const wall = new Float32Array(nf * 3);
    for (let q = 0; q < nf; q++) for (let k = 0; k < nr; k++) { const w = W[q * nr + k], j = ring[k] * 3; wall[q * 3] += w * P[j]; wall[q * 3 + 1] += w * P[j + 1]; wall[q * 3 + 2] += w * P[j + 2]; }
    // the middle: the wall at the foot's middle, from the few points round it
    const cw = new Float32Array(nf); let cs = 0;
    for (let q = 0; q < nf; q++) { const d = Math.hypot(sg * wall[q * 3] - B.cx, wall[q * 3 + 1] - B.cy); cw[q] = Math.max(0, 1 - d / 0.03) ** 2; cs += cw[q]; }
    const mid = [0, 0, 0]; for (let q = 0; q < nf; q++) { cw[q] /= cs; for (let e = 0; e < 3; e++) mid[e] += cw[q] * wall[q * 3 + e]; }
    const share = new Float32Array(nf);                                     // how far each point is from the middle to the foot's edge, 0..1
    for (let q = 0; q < nf; q++) { const r = [wall[q * 3] - mid[0], wall[q * 3 + 1] - mid[1], wall[q * 3 + 2] - mid[2]], a = r[0] * out[0] + r[2] * out[2], b = r[1];
      share[q] = Math.min(0.999, Math.hypot(a / (a < 0 ? B.inn : B.out), b / (b < 0 ? B.dn : B.up))); }
    // the skin round the foot that a big ball hangs over (the ribs under the fold, the chest's side): the dress form
    // moves what's under the ball out from under it (bustShape, form)
    const apron = [];
    for (let i = 0; i < N; i++) { const px = sg * P[i * 3], py = P[i * 3 + 1]; if (slot[i] >= 0 || px < 0.004 || P[i * 3 + 2] < 0.02 || n[i * 3 + 2] < 0.2) continue;
      if (Math.hypot(px - B.cx, py - B.cy) < 0.24 && !(px > 0.165 && py > 1.26)) apron.push(i); }
    const own = new Set([...idx, ...apron]), adj = new Map();           // who is next to whom among them (the form gathers along it)
    for (const i of own) adj.set(i, [...nbr[i]].filter(j => own.has(j)));
    return { sg, idx: Uint32Array.from(idx), g: Float32Array.from(g), ring: Uint32Array.from(ring), W, cw, share, nrm, out, apron: Uint32Array.from(apron), adj };
  });
  return { controls, handles, normals: n, bust };
}
const unit3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// what a control's field is multiplied by, from the sliders' whole values (value(id)): its own; with Anime on (grow.js
// SPAN: the Bust's long slider) never past its `cap` either way (the Bust's bump stops at 1 and at -1: past them the
// bust is bustShape's, below). Off, the bump is the whole of it, as it always was
export const fieldValue = (c, value, anime = false) => { const v = value(c.id); return anime && c.cap !== undefined ? Math.max(-c.cap, Math.min(v, c.cap)) : v; };

// ---- Anime: the bust past the bump's ends (the Body tab's Anime switch: "keep the new bust slider as an 'anime'
// toggleable"; only with it on does anything here run): a full bust (the Bust slider past 1; DECISIONS 2026-11-11: "we should be able to make the woman more flat too
// but also more busty like the image", then, of the first try: "from the front angle it looks perfect, but as you go
// towards a side view it looks unnaturally pointy, it should feel more how a water balloon would sit"). The first try
// was a field like the others, added to the body: a bigger bump on the small breast the body already has, on the Bust's
// own bump: three bumps on one spot are a cone. So this isn't a field. It makes the shape itself, on the body as it is:
//
// a ball hung in the skin from the breast's foot (its root on the chest: an oval from under the collarbone to the fold
// under the breast), resting against the ribs, its weight low. The chest wall under the breast is the body's own (the
// membrane across the foot's ring: buildSculpt's weights), so the breast the body has is taken up into the ball instead
// of standing on it. The ball's middle sits below the foot's middle and a little outward, more the bigger it is; each
// foot point goes to its share of the way along the skin from the ball's front to its own place on the foot's edge:
// round the ball, then either straight to the edge where the skin leaves the ball (the long slope from the collarbone:
// eased into the chest at the top, no crease), or, where the ball hangs out past the edge (below the fold, and at the
// sides when it's big), on round the ball to the ribs and back along them to the edge (the fold stays where it is).
// And the other way, under -1: the breast taken back toward that same wall, at -2 a flat chest (the bump taken off a
// breast of another shape left dents: the first -2).
//
// The dress form (`form`): what the tailor cuts and hangs clothes on. A hanging ball has a hollow under it (its underside,
// the fold, the ribs below): skin that runs down the ball's front, back up under it and down again. Cloth is cut from
// the skin, so cloth cut there is three layers where a garment has one; pushed out to hang as a garment does they lie
// in each other (the first turtleneck on a full bust: torn under it). On the form the hollow is closed: the skin goes
// round the ball only to where it's widest over the wall (or to the middle of the chest, where the two balls meet), and
// all the skin past that, the ball's underside and the ribs' own skin under the ball, is gathered onto the first points
// to reach it: each onto the one it's joined to through the gathered skin (`gather`: pairs of a point and the point it
// lies on; the callers put the one exactly on the other, and the tailor makes points that lie on one another one:
// tailor/mesh.js welded). So no cloth is cut from the hollow at all: the cloth goes from the ball's widest ring
// straight to the ribs beyond it, as a garment does. The form holds the whole ball, so what's cut on it clears the
// real one; the body shown and exported stays the hanging one.
//   v: the Bust slider's whole value (past 1: the ball, 3 the picture's; under -1: flatter, -2 flat; between: nothing)
//   scale: the body's own size there (a child's, a goblin's)
//   at(i): the body's point i as it is (MHR's metres, the sculpt's fields on it), -> { idx, d }: what to add to each
export function bustShape(S, at, v, scale = 1, form = false) {
  const idx = [], d = [], gather = [], k = v - 1, flat = Math.min(1, -1 - v); if (!(k > 0 || flat > 0) || !S.bust) return { idx: new Uint32Array(0), d: new Float32Array(0), gather };
  const p = (0.06 + 0.055 * k) * scale, R = (0.055 + 0.45 * 0.055 * k) * scale, drop = (0.015 + 0.33 * 0.055 * k) * scale, lean = (0.005 + 0.15 * 0.055 * k) * scale;
  const depth = p - R, gap = 0.004 * scale, tau = sm(0, 0.6, k);            // how far the ball's front stands off the wall, its radius, how far its middle is below and outside the foot's; tau: how much of the shape is the ball's (the body's own breast the rest)
  const tilt = (15 + 12.5 * k) * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);   // where the foot's middle lands on the ball: below its front, more the bigger (the skin slides down a heavy breast; and the body's mesh has most of its points above the middle: they're what the ball's front is made of)
  for (const F of S.bust) {
    const nf = F.idx.length, nr = F.ring.length, ring = new Float64Array(nr * 3), wall = new Float64Array(nf * 3), mid = [0, 0, 0], o = F.out, nz = F.nrm;
    for (let j = 0; j < nr; j++) { const q = at(F.ring[j]); ring[j * 3] = q[0]; ring[j * 3 + 1] = q[1]; ring[j * 3 + 2] = q[2]; }
    for (let q = 0; q < nf; q++) { let x = 0, y = 0, z = 0; for (let j = 0; j < nr; j++) { const w = F.W[q * nr + j]; if (!w) continue; x += w * ring[j * 3]; y += w * ring[j * 3 + 1]; z += w * ring[j * 3 + 2]; }
      wall[q * 3] = x; wall[q * 3 + 1] = y; wall[q * 3 + 2] = z; for (let e = 0; e < 3; e++) mid[e] += F.cw[q] * wall[q * 3 + e]; }
    if (flat > 0) {                                                        // flatter: toward the wall, a little of a chest's own swell left on it
      for (let q = 0; q < nf; q++) { const y = at(F.idx[q]), s = F.share[q], up = 0.004 * scale * (1 - s * s), w = flat * F.g[q];
        idx.push(F.idx[q]); d.push(w * (wall[q * 3] + up * nz[0] - y[0]), w * (wall[q * 3 + 1] - y[1]), w * (wall[q * 3 + 2] + up * nz[2] - y[2])); }
      continue;
    }
    // in the chest's own frame at the foot's middle: (across it, outward; up it; off it)
    const C = [lean, -drop, depth], pole = [0, -st, ct], G = new Map(), anchors = new Map(), first = idx.length;   // (the form: the points past the ball's widest, and the last before it, each with where it now is)
    for (let q = 0; q < nf; q++) {
      const r = [wall[q * 3] - mid[0], wall[q * 3 + 1] - mid[1], wall[q * 3 + 2] - mid[2]], a = r[0] * o[0] + r[2] * o[2], b = r[1], h = r[0] * nz[0] + r[2] * nz[2], s = F.share[q];
      const Q = s > 0.02 ? [a / s, b / s, 0] : [0, 0, 0];                   // its own place on the foot's edge
      const ease = sm(0, 0.7, s > 0.02 ? b / (Math.hypot(a, b) || 1) : 0), lim = 0.004 * scale, past = [false];
      const place = t => { const T = hung(C, pole, R, Q, gap, t, ease, form, past); T[2] += h;   // (the wall isn't flat: its own height there)
        return [mid[0] + T[0] * o[0] + T[2] * nz[0], mid[1] + T[1], mid[2] + T[0] * o[2] + T[2] * nz[2]]; };
      let W = place(s), gone = past[0];
      if (F.sg * W[0] < lim) {                                             // the two never through each other: pressed together at the middle
        if (form) {                                                        // (the form: no wall between them either, a slot cloth would be cut down into: what's past the middle is gathered where the skin first reaches it)
          let lo = 0, hi = s; for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; if (F.sg * place(m)[0] < lim) hi = m; else lo = m; }
          W = place(lo); gone = true;
        }
        if (F.sg * W[0] < lim) W[0] = F.sg * lim;
      }
      const y = at(F.idx[q]), w = tau * F.g[q];
      if (form) { (gone ? G : anchors).set(F.idx[q], [y[0] + w * (W[0] - y[0]), y[1] + w * (W[1] - y[1]), y[2] + w * (W[2] - y[2])]); }
      idx.push(F.idx[q]); d.push(w * (W[0] - y[0]), w * (W[1] - y[1]), w * (W[2] - y[2]));
    }
    if (form) for (const j of F.apron) {                                    // the skin under the ball: out from under it, to just past where the ball is widest, in the order it lay
      const y = at(j), r = [y[0] - mid[0], y[1] - mid[1], y[2] - mid[2]], da = r[0] * o[0] + r[2] * o[2] - C[0], db = r[1] - C[1], h = r[0] * nz[0] + r[2] * nz[2], rr = Math.hypot(da, db);
      if (rr >= R + 0.002 * scale) continue;
      const to = R + (0.002 + 0.01 * rr / R) * scale, ka = rr > 1e-6 ? da / rr : 0, kb = rr > 1e-6 ? db / rr : -1;
      let na = C[0] + ka * to, nb = C[1] + kb * to;
      const am = (F.sg * 0.004 * scale - mid[0] - h * nz[0]) / o[0];       // the middle of the chest, across this frame
      if (na < am) { const e = am - C[0]; if (Math.abs(e) >= to) continue; na = am; nb = C[1] + (db < 0 ? -1 : 1) * Math.sqrt(to * to - e * e); }   // (never across the middle: along it instead, down from under the ball or up)
      const W = [mid[0] + na * o[0] + h * nz[0], mid[1] + nb, mid[2] + na * o[2] + h * nz[2]];
      G.set(j, [y[0] + tau * (W[0] - y[0]), y[1] + tau * (W[1] - y[1]), y[2] + tau * (W[2] - y[2])]);
      idx.push(j); d.push(tau * (W[0] - y[0]), tau * (W[1] - y[1]), tau * (W[2] - y[2]));
    }
    if (form && tau > 0.999 && G.size) {
      // gathered: the first points past the widest stay where the skin reaches it (the ball's widest ring, the middle
      // of the chest: the cloth's last row on the ball); every point further on lies on the one of them it's joined
      // to (breadth first from them, through the gathered skin). Onto the last row *before* the widest, the cloth
      // cut the ball's bottom off (the ball showed through it)
      const on = new Map(), queue = [...G.keys()].filter(i => F.adj.get(i).some(j => anchors.has(j)));
      for (const a of queue) on.set(a, a);
      for (let h = 0; h < queue.length; h++) { const v = queue[h]; for (const j of F.adj.get(v)) if (G.has(j) && !on.has(j)) { on.set(j, on.get(v)); queue.push(j); } }
      for (let q = first; q < idx.length; q++) { const i = idx[q], a = on.get(i); if (a === undefined || a === i) continue;
        const y = at(i), to = G.get(a); d[q * 3] = to[0] - y[0]; d[q * 3 + 1] = to[1] - y[1]; d[q * 3 + 2] = to[2] - y[2]; gather.push(i, a); }
    }
  }
  return { idx: Uint32Array.from(idx), d: Float32Array.from(d), gather };
}
// the skin from the ball's pole (where the foot's middle lands: C + R * pole) to a point Q of the foot's edge (on the
// wall, z = 0), at a share t of its length: a point [across, up, off the wall]. The ball: its middle C, radius R. Where
// Q is outside the ball the skin leaves the ball where a straight line to Q touches it (bent to meet the wall flat by
// `ease`: the top, no crease); where the ball hangs out past Q (below the fold, and at the sides when it's big) it goes
// on round the ball to the wall, `gap` off it: every point of the foot on the ball itself, and the skin from there back
// along the ribs to the edge is what lies between the last of them and the edge's own points (the body's mesh has four
// rows from a breast's middle to its fold: spent on the way back, the ball's bottom was one row, a blade)
// (the dress form, `form`: where the ball hangs out past Q, round the ball only to where it's widest over the wall and no
// further: no underside; `past[0]` set when the point would be past it)
function hung(C, pole, R, Q, gap, t, ease, form = false, past = null) {
  const r = [Q[0] - C[0], Q[1] - C[1], Q[2] - C[2]], aq = r[0] * pole[0] + r[1] * pole[1] + r[2] * pole[2];
  const e = [r[0] - aq * pole[0], r[1] - aq * pole[1], r[2] - aq * pole[2]], rq = Math.hypot(e[0], e[1], e[2]) || 1e-9, D = Math.hypot(rq, aq);
  for (let k = 0; k < 3; k++) e[k] /= rq;
  const on = q => [C[0] + R * (Math.cos(q) * pole[0] + Math.sin(q) * e[0]), C[1] + R * (Math.cos(q) * pole[1] + Math.sin(q) * e[1]), C[2] + R * (Math.cos(q) * pole[2] + Math.sin(q) * e[2])];
  if (form && Math.hypot(r[0], r[1]) < R) {
    let th = Math.atan2(pole[2], -e[2]); if (th <= 0) th += Math.PI;      // where the ball is widest over the wall on this way round: cos q pole.z + sin q e.z = 0
    const down = Math.max(0, C[2] - gap), a = t * (R * th + down);
    if (a <= R * th) return on(a / R);
    if (past) past[0] = true;                                              // (past the widest: the form gathers it there)
    return on(th);
  }
  if (D > R) {
    const th = Math.max(0, Math.atan2(rq, aq) - Math.acos(R / D)), line = Math.sqrt(D * D - R * R), a = t * (R * th + line);
    if (a <= R * th) return on(a / R);
    const u = (a - R * th) / line, T = on(th), f = (2 * u * u * u - 3 * u * u + 1) - (u * u * u - 2 * u * u + u) - (1 - ease) * (u * u * u - u * u);   // 1 - u, bent to meet the wall flat by `ease`
    return [T[0] + (Q[0] - T[0]) * u, T[1] + (Q[1] - T[1]) * u, T[2] * f];
  }
  // round the ball to the wall: where C.z + R (cos q pole.z + sin q e.z) = gap, the first time
  const m = Math.hypot(pole[2], e[2]) || 1e-9, c = (gap - C[2]) / (R * m), th = Math.abs(c) <= 1 ? Math.atan2(e[2], pole[2]) + Math.acos(c) : Math.PI;
  return on(t * (th > 0 ? th : th + 2 * Math.PI));
}

// a control's offset at one point (0 if it doesn't move it): what the handle's drag reads
export function offsetAt(c, v) {
  let lo = 0, hi = c.idx.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1, x = c.idx[m]; if (x === v) return [c.d[m * 3], c.d[m * 3 + 1], c.d[m * 3 + 2]]; if (x < v) lo = m + 1; else hi = m - 1; }
  return [0, 0, 0];
}
