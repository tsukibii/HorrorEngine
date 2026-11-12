// Which way each pore's hair is combed, for the hair editor v2.0 (docs/HAIR_V2.md): a direction along the scalp and a
// lift off it for every growing pore, put together from a few things a hairdresser would name (the crown's whorl, a
// parting, the top combed to a side or back, the sides down or back, a fringe forward, a tie's pull), smoothed between
// neighbouring pores but never across the parting or between groups. And the same as a field over the head, so a hair
// passing over other hair's roots goes the way the hair there goes. Plain arrays; the head's local space.
//
//   parts(ctx)      each pore's share of the top, the sides, the back and the nape (lengths and volumes blend by them)
//   comb(ctx)       -> { dir (3 a pore, unit, along the skin), lift (radians), group (LOOSE, FRINGE, FRAME, TIE + k) }
//   fieldOf(ctx, C) -> at(x, y, z, out) the combed way over the head at a point (false where no hair grows under it)
const D = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
import { EAR } from "./pores.js";
export const LOOSE = 0, FRINGE = 1, FRAME = 2, TIE = 3;
const ETOP = EAR.y + EAR.dy;                                             // the ear's top on the chart

// the angle of a point round the head's side-to-side axis (degrees): 0 straight over the skull's middle, + toward the
// face, - toward the back (the crown about -35, the nape about -125)
export const sagittal = (y, z, C) => Math.atan2(z - C[2], y - C[1]) / D;

// ctx: { n, pos, nrm (3 a pore, the body's), az, by (the chart: degrees round, the base height), u (each pore's own number), C, s (the settings) }
export function parts(ctx) {
  const { n, pos, az, by, C } = ctx, top = new Float32Array(n), sides = new Float32Array(n), back = new Float32Array(n), nape = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] - C[0], y = pos[i * 3 + 1] - C[1], z = pos[i * 3 + 2] - C[2], el = Math.asin(clamp(y / (Math.hypot(x, y, z) || 1), -1, 1)) / D, a = Math.abs(az[i]);
    const t = smooth(36, 54, el), b = smooth(104, 128, a), np = smooth(-0.022, -0.05, by[i]) * smooth(96, 122, a);
    top[i] = t; nape[i] = (1 - t) * np; back[i] = (1 - t) * (1 - np) * b; sides[i] = (1 - t) * (1 - np) * (1 - b);
  }
  return { top, sides, back, nape };
}

const along = (v, n) => { const k = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; return [v[0] - n[0] * k, v[1] - n[1] * k, v[2] - n[2] * k]; };   // a vector laid in the skin's plane
const unit = v => { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : null; };
const turn = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];   // v about the unit axis k
  return [v[0] * c + (k[1] * v[2] - k[2] * v[1]) * s + k[0] * d * (1 - c), v[1] * c + (k[2] * v[0] - k[0] * v[2]) * s + k[1] * d * (1 - c), v[2] * c + (k[0] * v[1] - k[1] * v[0]) * s + k[2] * d * (1 - c)]; };

// where the parting's plane is at a point: its signed distance (m; + the character's left of it)
export function partingSide(s, x, z) {
  const p = s.parting || {}; if (!p.kind || p.kind === "none") return x;
  const off = p.kind === "left" ? Math.abs(p.offset ?? 0.035) : p.kind === "right" ? -Math.abs(p.offset ?? 0.035) : 0, a = (p.angle || 0) * D;
  return (x - off) * Math.cos(a) - (z - 0.02) * Math.sin(a);              // (turned about a point near the front hairline)
}
// how much of the parting a point has: 1 from the front hairline back to where it ends, 0 behind that (the crown takes over)
export function partingShare(s, phi) {
  const p = s.parting || {}; if (!p.kind || p.kind === "none") return 0;
  const end = 22 - 62 * clamp(p.length ?? 0.6, 0, 1);                    // short: over the forehead only; long: to the crown
  return smooth(end - 14, end + 6, phi);
}

export function comb(ctx) {
  const { n, pos, nrm, az, by, u, C, s, crown } = ctx, dir = new Float32Array(n * 3), lift = new Float32Array(n), group = new Uint8Array(n), P = ctx.parts || parts(ctx);
  const fr = s.fringe || {}, hasFringe = fr.kind && fr.kind !== "none", cb = s.comb || {}, sh = s.shape || {}, ties = (s.ties && s.ties.kind && s.ties.kind !== "none") ? ctx.ties || [] : [];
  const swirl = ((s.crown && s.crown.swirl) ?? 0.4) * 40 * D, lim = ctx.limit;
  for (let i = 0; i < n; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], nn = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]], a = az[i], phi = sagittal(p[1], p[2], C);
    const down = unit(along([0, -1, 0], nn)) || [0, 0, -1], flat = clamp(nn[1], 0, 1);
    // the crown: out from the whorl, turned a little
    let w = unit(along([p[0] - crown[0], p[1] - crown[1], p[2] - crown[2]], nn)) || down; w = turn(w, nn, swirl * (ctx.swirlSign || 1));
    let d = w;
    // the parting: away from its line, over the top; turning down where the head turns down
    const share = partingShare(s, phi) * smooth(0.25, 0.6, flat + 0.35 * P.top[i]);
    if (share > 0) {
      const side = partingSide(s, p[0], p[2]) >= 0 ? 1 : -1, sw = unit(along([side, 0, -0.12], nn)) || down, k = Math.sqrt(flat);
      const pd = unit([sw[0] * k + down[0] * (1 - k), sw[1] * k + down[1] * (1 - k), sw[2] * k + down[2] * (1 - k)]) || down;
      d = unit([d[0] * (1 - share) + pd[0] * share, d[1] * (1 - share) + pd[1] * share, d[2] * (1 - share) + pd[2] * share]) || pd;
    }
    // the top combed back or forward; the sides back
    if (cb.top === "back") { const k = smooth(-62, -28, phi) * (0.35 + 0.65 * P.top[i]), b = unit(along([0, 0.25, -1], nn)) || down; d = unit([d[0] * (1 - k) + b[0] * k, d[1] * (1 - k) + b[1] * k, d[2] * (1 - k) + b[2] * k]) || d; }
    else if (cb.top === "forward") { const k = smooth(-45, -5, phi) * P.top[i], f = unit(along([0, -0.2, 1], nn)) || down; d = unit([d[0] * (1 - k) + f[0] * k, d[1] * (1 - k) + f[1] * k, d[2] * (1 - k) + f[2] * k]) || d; }
    if (cb.sides === "back") { const k = P.sides[i] * 0.85, b = unit(along([0, -0.35, -1], nn)) || down; d = unit([d[0] * (1 - k) + b[0] * k, d[1] * (1 - k) + b[1] * k, d[2] * (1 - k) + b[2] * k]) || d; }
    else if (cb.sides === "forward") { const k = P.sides[i] * 0.7, f = unit(along([0, -0.5, 1], nn)) || down; d = unit([d[0] * (1 - k) + f[0] * k, d[1] * (1 - k) + f[1] * k, d[2] * (1 - k) + f[2] * k]) || d; }
    // at the front, hair that isn't a fringe never goes forward over the face: it goes to its own side (the fringe's pores are taken below)
    if (cb.top !== "forward") {
      const k = smooth(6, 32, phi) * (1 - share) * (cb.top === "back" ? 0.25 : 1);
      if (k > 0) { const sw = unit(along([p[0] >= 0 ? 1 : -1, -0.3, -0.25], nn)) || down; d = unit([d[0] * (1 - k) + sw[0] * k, d[1] * (1 - k) + sw[1] * k, d[2] * (1 - k) + sw[2] * k]) || d; }
    }
    // below the top the hair simply hangs: toward straight down as the skin steepens
    { const k = (1 - P.top[i]) * (cb.sides === "back" || cb.sides === "forward" ? 0.3 : 0.75) * (1 - flat); d = unit([d[0] * (1 - k) + down[0] * k, d[1] * (1 - k) + down[1] * k, d[2] * (1 - k) + down[2] * k]) || d; }
    // tucked behind the ear: over the temple and above the ear the roots themselves are combed back along the head (they pass over the ear's top and fall behind it: strands.js)
    if (s.ears === "tucked" || (p[0] >= C[0] ? s.ears === "tucked_left" : s.ears === "tucked_right")) {
      const ap = Math.abs(a), k = smooth(16, 32, ap) * (1 - smooth(EAR.az + EAR.da * 1.1, EAR.az + EAR.da * 1.4, ap)) * smooth(ETOP - 0.004, ETOP + 0.004, by[i]) * (1 - smooth(ETOP + 0.05, ETOP + 0.085, by[i]));
      if (k > 0) { const sg = p[0] >= C[0] ? 1 : -1, ex = p[0] - C[0], ez = p[2] - C[2], r = Math.hypot(ex, ez) || 1, b = unit(along([sg * ez / r, 0.1, -sg * ex / r], nn)) || down; d = unit([d[0] * (1 - k) + b[0] * k, d[1] * (1 - k) + b[1] * k, d[2] * (1 - k) + b[2] * k]) || d; }
    }
    let lf = (sh.lift ?? 20) * D * (0.55 + 0.45 * P.top[i]);
    // the fringe: the front band's pores (some of them: Density), forward and down over the forehead, swept or split
    if (hasFringe && lim) {
      // the fringe is the front hairline's own band, whole: Amount is how deep the band is (a see-through fringe a shallow one, a full one deep), so
      // the hair behind it starts behind its roots and nothing crosses
      const depth = by[i] - lim(a), wide = fr.width ?? 46, deep = (0.007 + 0.034 * clamp(fr.amount ?? 0.7, 0, 1)) * (1 - 0.5 * smooth(wide * 0.5, wide, Math.abs(a)));
      if (Math.abs(a) < wide && depth < deep) {
        const split = fr.kind === "curtain" ? (p[0] >= (fr.splitAt || 0) ? 1 : -1) * (fr.split ?? 0.6) * 55 * D : 0, sweep = (fr.sweep || 0) * D + split;
        d = turn(down, nn, sweep); group[i] = FRINGE; lf = (10 + 50 * (fr.curve ?? 0.4)) * D;
      }
    }
    // face-framing strands: some of the hairline's own pores beside the fringe (or beside the parting), straight down in front of the ears
    if (!group[i] && (fr.frame || 0) > 0 && lim) {
      const depth = by[i] - lim(a), a0 = hasFringe ? Math.max(34, (fr.width ?? 46) - 8) : 36;   // (the temples' pores: in front of the ears, never over the eyes)
      if (depth < 0.014 && Math.abs(a) > a0 && Math.abs(a) < 64 && u[i] < fr.frame) { d = turn(down, nn, (p[0] >= 0 ? -1 : 1) * 12 * D); group[i] = FRAME; lf = 22 * D; }
    }
    // a quiff: the front stands up and goes back
    if (!group[i] && (sh.quiff || 0) > 0) { const k = smooth(8, 40, phi) * sh.quiff * P.top[i]; if (k > 0) { const b = unit(along([0, 0.3, -1], nn)) || down; d = unit([d[0] * (1 - k) + b[0] * k, d[1] * (1 - k) + b[1] * k, d[2] * (1 - k) + b[2] * k]) || d; lf = lf * (1 - k) + 78 * D * k; } }
    if (!group[i]) for (let k = 0; k < ties.length; k++) {               // a tie takes its pores (never the fringe's)
      const t = ties[k]; if (!t.takes(i, p, a, by[i], P)) continue;
      d = unit(along([t.at[0] - p[0], t.at[1] - p[1], t.at[2] - p[2]], nn)) || down; group[i] = TIE + k; lf = (4 + 14 * (1 - (t.tight ?? 0.6))) * D; break;
    }
    dir[i * 3] = d[0]; dir[i * 3 + 1] = d[1]; dir[i * 3 + 2] = d[2]; lift[i] = lf;
  }
  return { dir, lift, group, parts: P };
}

// neighbouring pores' ways eased toward each other (their nearest few; not across the parting, not between groups)
export function ease(ctx, C2, rounds = 2, k = 8) {
  const { n, pos, nrm, s } = ctx, { dir, group } = C2, cell = 0.012, grid = new Map(), key = (x, y, z) => ((Math.floor(x / cell) + 512) << 20) | ((Math.floor(y / cell) + 512) << 10) | (Math.floor(z / cell) + 512);
  for (let i = 0; i < n; i++) { const q = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); (grid.get(q) || grid.set(q, []).get(q)).push(i); }
  const near = new Int32Array(n * k).fill(-1), share = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], best = [];
    share[i] = partingShare(s, sagittal(y, z, ctx.C));
    const side = partingSide(s, x, z) >= 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const g = grid.get(key(x + a * cell, y + b * cell, z + c * cell)); if (!g) continue;
      for (const j of g) {
        if (j === i || group[j] !== group[i]) continue;
        if (share[i] > 0.5 && (partingSide(s, pos[j * 3], pos[j * 3 + 2]) >= 0) !== side) continue;
        const d = Math.hypot(pos[j * 3] - x, pos[j * 3 + 1] - y, pos[j * 3 + 2] - z); if (d < cell) best.push([d, j]);
      }
    }
    best.sort((p, q) => p[0] - q[0]); for (let m = 0; m < Math.min(k, best.length); m++) near[i * k + m] = best[m][1];
  }
  const tmp = new Float32Array(n * 3);
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n; i++) {
      let sx = dir[i * 3] * 2, sy = dir[i * 3 + 1] * 2, sz = dir[i * 3 + 2] * 2;
      for (let m = 0; m < k; m++) { const j = near[i * k + m]; if (j < 0) break; sx += dir[j * 3]; sy += dir[j * 3 + 1]; sz += dir[j * 3 + 2]; }
      const nn = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]], v = unit(along([sx, sy, sz], nn)) || [dir[i * 3], dir[i * 3 + 1], dir[i * 3 + 2]];
      tmp[i * 3] = v[0]; tmp[i * 3 + 1] = v[1]; tmp[i * 3 + 2] = v[2];
    }
    dir.set(tmp);
  }
  return near;
}

// the combed way as a field over the head: the loose pores' directions splatted onto a grid of directions from the
// skull's middle (3 degrees a bin), so a hair lying over other hair's roots can ask which way the hair goes there
const EL = 60, AZ = 120;
export function fieldOf(ctx, C2) {
  const { n, pos, C } = ctx, { dir, group } = C2, F = new Float32Array(EL * AZ * 4);
  const bin = (x, y, z) => { const dx = x - C[0], dy = y - C[1], dz = z - C[2], r = Math.hypot(dx, dy, dz) || 1e-9; return [(Math.asin(clamp(dy / r, -1, 1)) / D + 90) / 180 * (EL - 1), (Math.atan2(dx, dz) / D + 180) / 360 * AZ]; };
  for (let i = 0; i < n; i++) {
    if (group[i] !== LOOSE) continue;
    const [e, a] = bin(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), e0 = Math.round(e), a0 = Math.round(a);
    for (let de = -2; de <= 2; de++) for (let da = -2; da <= 2; da++) {
      const ee = e0 + de; if (ee < 0 || ee >= EL) continue;
      const k = (ee * AZ + (((a0 + da) % AZ) + AZ) % AZ) * 4, w = Math.exp(-(de * de + da * da) / 2.5);
      F[k] += dir[i * 3] * w; F[k + 1] += dir[i * 3 + 1] * w; F[k + 2] += dir[i * 3 + 2] * w; F[k + 3] += w;
    }
  }
  return (x, y, z, out) => {
    const [e, a] = bin(x, y, z), e0 = Math.floor(e), a0 = Math.floor(a), fe = e - e0, fa = a - a0;
    let sx = 0, sy = 0, sz = 0, sw = 0;
    for (let q = 0; q < 4; q++) {
      const ee = clamp(e0 + (q >> 1), 0, EL - 1), aa = (((a0 + (q & 1)) % AZ) + AZ) % AZ, k = (ee * AZ + aa) * 4, w = ((q >> 1) ? fe : 1 - fe) * ((q & 1) ? fa : 1 - fa);
      sx += F[k] * w; sy += F[k + 1] * w; sz += F[k + 2] * w; sw += F[k + 3] * w;
    }
    if (sw < 0.2) return false;
    const l = Math.hypot(sx, sy, sz); if (l < 1e-6) return false;
    out[0] = sx / l; out[1] = sy / l; out[2] = sz / l; return true;
  };
}
