// The tool that makes the hair editor v2.0's fixed pores (docs/HAIR_V2.md): about four thousand points evenly spread
// over MHR's scalp at its widest (pores.js masterLimit), each on its own triangle, the right side the left's mirror
// image, ranked so that every prefix is evenly spread too. Written to Content/Studio/Hair2/pores.bin and committed:
// every character's hair grows from the same pores.
//
//   node tools/character/hair2/pores.mjs make      makes the file again (the same file every time: a fixed seed)
//   node tools/character/hair2/pores.mjs check     what's in the file: its spacing by prefix, its mirror, and that making it again gives the same
//
// Evenly spread by sample elimination (Yuksel 2015, "Sample Elimination for Poisson Disk Sample Sets"): five times too
// many candidates thrown at random, the most crowded one taken away until the number wanted is left; then halved again
// and again the same way, the order they leave in read backwards as the rank.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { loadMhr, mhrBody, ROOT } from "../tailor/node.mjs";
import { Collider, rng } from "../salonlib.js";
import { localBody } from "./body.js";
import { masterLimit, onEar, chartAz, writePores, readPores } from "./pores.js";

export const FILE = join(ROOT, "Content", "Studio", "Hair2", "pores.bin");
const HALF = 2048, OVER = 5, SEED = 20261111, SEAM = 0.0016;

export function baseBody() { const m = loadMhr(), b = mhrBody(m, [], 1.7); return { m, body: localBody(b.P, m.T), P: b.P }; }

// the candidates: points thrown evenly over the left half of the widest scalp
function candidates(body, col, n, r) {
  const { L, T, VN, C } = body, tris = [], cum = [];
  let area = 0;
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const cx = (L[a] + L[b] + L[c]) / 3, cy = (L[a + 1] + L[b + 1] + L[c + 1]) / 3, cz = (L[a + 2] + L[b + 2] + L[c + 2]) / 3;
    if (cy < -0.11 || Math.max(L[a], L[b], L[c]) < 0 || Math.hypot(cx - C[0], cy - C[1], cz - C[2]) > 0.17) continue;
    const ux = L[b] - L[a], uy = L[b + 1] - L[a + 1], uz = L[b + 2] - L[a + 2], vx = L[c] - L[a], vy = L[c + 1] - L[a + 1], vz = L[c + 2] - L[a + 2];
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; tris.push(t); cum.push(area);
  }
  const out = []; let tried = 0;
  while (out.length < n) {
    tried++;
    const x = r() * area; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    const t = tris[lo], a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v, p = [0, 1, 2].map(k => L[a + k] * w + L[b + k] * u + L[c + k] * v), nr = [0, 1, 2].map(k => VN[a + k] * w + VN[b + k] * u + VN[c + k] * v);
    if (p[0] < SEAM) continue;
    const az = chartAz(p[0], p[2], C);
    if (p[1] <= masterLimit(az) || onEar(az, p[1])) continue;
    const d = [p[0] - C[0], p[1] - C[1], p[2] - C[2]], rr = Math.hypot(...d);
    if (col.radius(d) - rr > 0.004 || d[0] * nr[0] + d[1] * nr[1] + d[2] * nr[2] <= 0) continue;   // the outer skin only, facing out
    out.push({ tri: t / 3, w: [w, u, v], p });
  }
  return { list: out, area: area * out.length / tried };                 // the scalp's own area: the share of the throws that landed on it
}

// take the most crowded away until `target` are left; returns the ones taken, first to last
function thin(pts, live, target, area) {
  const n0 = live.length, rmax = Math.sqrt(area / (2 * Math.sqrt(3) * target)), R = 2 * rmax, rmin = rmax * (1 - Math.pow(target / n0, 1.5)) * 0.65;
  const wf = d => d >= R ? 0 : Math.pow(1 - Math.max(d, rmin) / R, 8);
  const cell = R, key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`, grid = new Map();
  for (const i of live) { const k = key(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  const near = (x, y, z, f) => { const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const g = grid.get(`${cx + a},${cy + b},${cz + c}`); if (g) for (const j of g) f(j); } };
  const W = new Float64Array(pts.length / 3), nb = new Map();
  for (const i of live) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2], list = [];
    near(x, y, z, j => { if (j === i) return; const w = wf(Math.hypot(x - pts[j * 3], y - pts[j * 3 + 1], z - pts[j * 3 + 2])); if (w > 0) list.push([j, w]); });
    near(-x, y, z, j => { const w = wf(Math.hypot(-x - pts[j * 3], y - pts[j * 3 + 1], z - pts[j * 3 + 2])); if (w > 0) list.push([j, w]); });   // the other side's twins (its own too, by the seam)
    nb.set(i, list); W[i] = list.reduce((a, e) => a + e[1], 0);
  }
  const heap = live.map(i => [W[i], i]); heap.sort((a, b) => a[0] - b[0]);
  const up = (h, k) => { while (k > 0) { const p = (k - 1) >> 1; if (h[p][0] >= h[k][0]) break; [h[p], h[k]] = [h[k], h[p]]; k = p; } };
  const down = (h, k) => { for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < h.length && h[l][0] > h[m][0]) m = l; if (r < h.length && h[r][0] > h[m][0]) m = r; if (m === k) break; [h[m], h[k]] = [h[k], h[m]]; k = m; } };
  const H = []; for (const e of heap) { H.push(e); up(H, H.length - 1); }
  const gone = new Uint8Array(pts.length / 3), taken = [];
  let left = n0;
  while (left > target && H.length) {
    const [w, i] = H[0]; const last = H.pop(); if (H.length) { H[0] = last; down(H, 0); }
    if (gone[i] || Math.abs(w - W[i]) > 1e-12) continue;                 // an old entry
    gone[i] = 1; taken.push(i); left--;
    for (const [j, wj] of nb.get(i)) { if (gone[j] || j === i) continue; W[j] -= wj; H.push([W[j], j]); up(H, H.length - 1); }
  }
  return taken;
}

export function make() {
  const { m, body, P } = baseBody(), { L, T, C } = body, col = new Collider(L, { tris: T }), r = rng(SEED);
  const { list, area } = candidates(body, col, HALF * OVER, r), pts = new Float32Array(list.length * 3);
  list.forEach((c, i) => pts.set(c.p, i * 3));
  let live = list.map((_, i) => i);
  const drop = new Set(thin(pts, live, HALF, area)); live = live.filter(i => !drop.has(i));
  const rounds = [];
  for (let target = HALF / 2; target >= 4; target /= 2) { const t = thin(pts, live, target, area), s = new Set(t); live = live.filter(i => !s.has(i)); rounds.push(t); }
  const order = live.slice(); for (let k = rounds.length - 1; k >= 0; k--) order.push(...rounds[k].slice().reverse());
  // the other side: each point's mirror image on the mirror triangle (MHR's head is the same both sides, point for point)
  const key = (x, y, z) => `${Math.round(Math.abs(x) * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)},${Math.abs(x) < 5e-6 ? 0 : Math.sign(x)}`, at = new Map();
  for (let i = 0; i < P.length / 3; i++) at.set(key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i);
  const twin = i => at.get(key(-P[i * 3], P[i * 3 + 1], P[i * 3 + 2])), triOf = new Map();
  for (let t = 0; t < T.length; t += 3) triOf.set([T[t], T[t + 1], T[t + 2]].sort((a, b) => a - b).join(), t / 3);
  const n = order.length * 2, tri = new Uint32Array(n), bary = new Float32Array(n * 2), base = new Float32Array(n * 3), u = new Float32Array(n), mirror = new Uint32Array(n);
  let unmatched = 0;
  order.forEach((ci, k) => {
    const c = list[ci], t = c.tri * 3, v = [T[t], T[t + 1], T[t + 2]], mv = v.map(twin), mt = mv.every(x => x !== undefined) ? triOf.get(mv.slice().sort((a, b) => a - b).join()) : undefined;
    tri[2 * k] = c.tri; bary[4 * k] = c.w[0]; bary[4 * k + 1] = c.w[1]; base.set(c.p, 6 * k); u[2 * k] = r(); mirror[2 * k] = 2 * k + 1;
    if (mt === undefined) { unmatched++; throw new Error(`no mirror triangle for triangle ${c.tri}`); }
    const mo = [T[mt * 3], T[mt * 3 + 1], T[mt * 3 + 2]], w = mo.map(x => c.w[mv.indexOf(x)]);   // the mirror triangle's corners in its own order
    tri[2 * k + 1] = mt; bary[4 * k + 2] = w[0]; bary[4 * k + 3] = w[1]; base.set([-c.p[0], c.p[1], c.p[2]], 6 * k + 3); u[2 * k + 1] = r(); mirror[2 * k + 1] = 2 * k;
  });
  const header = { version: 1, about: "the hair editor v2.0's pores on MHR's scalp (tools/character/hair2/pores.mjs): tri, bary (two weights; the third is what's left), base (the place on MHR's base head, local metres), u (each pore's own number), mirror; ranked: every prefix is evenly spread",
    n, C, seed: SEED, area_cm2: +(area * 2e4).toFixed(1), mesh: { points: P.length / 3, triangles: T.length / 3 } };
  return { header, n, tri, bary, base, u, mirror, C, unmatched };
}

// the nearest neighbour's distance for each of the first n pores (mm): its mean and its least
function spacing(base, n) {
  let sum = 0, least = Infinity;
  for (let i = 0; i < n; i++) { let best = Infinity; for (let j = 0; j < n; j++) { if (j === i) continue; const d = Math.hypot(base[i * 3] - base[j * 3], base[i * 3 + 1] - base[j * 3 + 1], base[i * 3 + 2] - base[j * 3 + 2]); if (d < best) best = d; } sum += best; least = Math.min(least, best); }
  return [sum / n * 1000, least * 1000];
}

if (process.argv[1] && process.argv[1].endsWith("pores.mjs")) {
  const cmd = process.argv[2] || "check";
  if (cmd === "make") {
    const t0 = performance.now(), P = make();
    mkdirSync(join(ROOT, "Content", "Studio", "Hair2"), { recursive: true });
    writeFileSync(FILE, writePores(P));
    console.log(`${P.n} pores on ${P.header.area_cm2} cm2 of scalp, ${(performance.now() - t0).toFixed(0)} ms -> ${FILE}`);
    for (const k of [P.n, 2600, 1800, 1300, 600]) { const [mean, least] = spacing(P.base, k); console.log(`  the first ${k}: ${mean.toFixed(1)} mm apart on average, ${least.toFixed(1)} at the least`); }
  } else {
    let bad = 0; const say = (ok, w) => { if (!ok) bad++; console.log((ok ? "  ok  " : "  BAD ") + w); };
    say(existsSync(FILE), "the pores file is there");
    const buf = readFileSync(FILE), P = readPores(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), again = writePores(make());
    say(again.length === buf.length && again.every((b, i) => b === buf[i]), "made again, the same file byte for byte");
    let mir = 0; for (let i = 0; i < P.n; i++) { const j = P.mirror[i]; if (P.mirror[j] !== i || Math.abs(P.base[i * 3] + P.base[j * 3]) > 1e-6 || Math.abs(P.base[i * 3 + 1] - P.base[j * 3 + 1]) > 1e-6) mir++; }
    say(mir === 0, `every pore has its mirror image (${P.n} pores)`);
    for (const k of [P.n, 2048, 1024, 512]) { const [mean, least] = spacing(P.base, k), ideal = Math.sqrt(P.header.area_cm2 * 1e-4 / (0.866 * k)) * 1000; say(least > 0.45 * ideal && mean > 0.75 * ideal, `the first ${k} evenly spread: ${mean.toFixed(1)} mm apart on average, ${least.toFixed(1)} at the least (a perfect grid: ${ideal.toFixed(1)})`); }
    console.log(bad ? "PORES FAIL" : "PORES ok");
    process.exit(bad ? 1 : 0);
  }
}
