// The salon's padding (docs/SALON.md, Volume): the base's hair filled out into one smooth, full mass, the way finished
// hair reads (no see-through gaps between locks, no lumps), as cards that follow the hair. Only the head (above the chin):
// what hangs below is the locks' own. The formula:
//   1. the hull: per direction round the skull's middle (72 x 144 bins, 2.5 degrees), how far out the hair reaches
//      (every guide point and card edge)
//   2. the gaps closed: the covered bins dilated by `close` and eroded back (a morphological closing), a gap's radius its
//      neighbours' (a normalized Gaussian average)
//   3. smoothed: the radius averaged over a Gaussian (wider with Smooth), lifted by Thickness (up to 1.2 cm), never
//      under the skin; the mass's outer curve is that smooth surface
//   4. the flow: each bin's hair direction (the guides' tangents laid on the sphere, root to tip), averaged the same
//      way; where there's none near, down the head
//   5. the cards: evenly spaced streamlines along the flow on that surface (after Jobard and Lefer, 1997: a new line is
//      started a spacing away from the others and stops when it comes within half of it), traced upstream to where the
//      hair starts and downstream to where it ends, each a card with the strand texture, its root upstream; just under
//      the surface, so the outer locks lie on it, and with Thickness, deeper shells
// Plain arrays, no three.js, so node can check it.
//
//   const P = padding(guidesList, col, {thickness, smooth, spacing, seed})  -> {cards, hull: {at(d), inside(d), flow(d)}, stats}
import { add, sub, mul, dot, cross, norm, len, GAP, rng, WIDTH } from "./salonlib.js";

const EL = 72, AZ = 144, N = EL * AZ, SAMP = 24;
const binOf = d => { const e = Math.asin(Math.max(-1, Math.min(1, d[1]))), a = Math.atan2(d[0], d[2]); return [(e + Math.PI / 2) / Math.PI * (EL - 1), (a + Math.PI) / (2 * Math.PI) * AZ]; };
const dirOf = (i, j) => { const e = i / (EL - 1) * Math.PI - Math.PI / 2, a = j / AZ * 2 * Math.PI - Math.PI; return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]; };
const wrap = j => ((j % AZ) + AZ) % AZ;
const azStretch = i => 1 / Math.max(0.2, Math.cos(i / (EL - 1) * Math.PI - Math.PI / 2));   // bins round get narrower towards the poles

// separable Gaussian blur over the grid (azimuth wrapping, widened by latitude), of v weighted by w: sum(v w) / sum(w)
function blur(v, w, sigma) {
  const num = new Float32Array(N), den = new Float32Array(N), tn = new Float32Array(N), td = new Float32Array(N);
  for (let k = 0; k < N; k++) { num[k] = v[k] * w[k]; den[k] = w[k]; }
  const re = Math.ceil(sigma * 2.5);
  for (let i = 0; i < EL; i++) for (let j = 0; j < AZ; j++) {                    // along the elevation
    let a = 0, b = 0; for (let di = -re; di <= re; di++) { const ii = i + di; if (ii < 0 || ii >= EL) continue; const g = Math.exp(-di * di / (2 * sigma * sigma)), k = ii * AZ + j; a += num[k] * g; b += den[k] * g; }
    tn[i * AZ + j] = a; td[i * AZ + j] = b;
  }
  for (let i = 0; i < EL; i++) {                                                  // round the azimuth
    const s = sigma * azStretch(i), ra = Math.min(AZ / 2, Math.ceil(s * 2.5));
    for (let j = 0; j < AZ; j++) { let a = 0, b = 0; for (let dj = -ra; dj <= ra; dj++) { const g = Math.exp(-dj * dj / (2 * s * s)), k = i * AZ + wrap(j + dj); a += tn[k] * g; b += td[k] * g; } num[i * AZ + j] = a; den[i * AZ + j] = b; }
  }
  const out = new Float32Array(N); for (let k = 0; k < N; k++) out[k] = den[k] > 1e-6 ? num[k] / den[k] : 0;
  return { v: out, w: den };
}
function dilate(m, r) {                                                           // a square neighbourhood, r bins (round: widened)
  const t = new Uint8Array(N), o = new Uint8Array(N);
  for (let i = 0; i < EL; i++) for (let j = 0; j < AZ; j++) { let on = 0; for (let di = -r; di <= r && !on; di++) { const ii = i + di; if (ii >= 0 && ii < EL && m[ii * AZ + j]) on = 1; } t[i * AZ + j] = on; }
  for (let i = 0; i < EL; i++) { const ra = Math.min(AZ / 2, Math.round(r * azStretch(i))); for (let j = 0; j < AZ; j++) { let on = 0; for (let dj = -ra; dj <= ra && !on; dj++) if (t[i * AZ + wrap(j + dj)]) on = 1; o[i * AZ + j] = on; } }
  return o;
}
const erode = (m, r) => { const inv = new Uint8Array(N); for (let k = 0; k < N; k++) inv[k] = m[k] ? 0 : 1; const d = dilate(inv, r); for (let k = 0; k < N; k++) inv[k] = d[k] ? 0 : 1; return inv; };

export function padding(guidesList, col, o = {}) {
  const thickness = o.thickness ?? 0.4, smooth = o.smooth ?? 0.5, spacing = o.spacing ?? 0.012, C = col.C;
  const low = col.chin - 0.03, head = new Uint8Array(N);
  for (let i = 0; i < EL; i++) for (let j = 0; j < AZ; j++) { const d = dirOf(i, j); head[i * AZ + j] = C[1] + d[1] * col.radius(d) > low ? 1 : 0; }
  // 1. the hull and the flow, splatted
  const R0 = new Float32Array(N), F = [new Float32Array(N), new Float32Array(N), new Float32Array(N)], Fw = new Float32Array(N);
  const put = (p, t) => {
    if (p[1] < low) return; const d = sub(p, C), r = len(d); if (r < 1e-6) return;
    const [e, a] = binOf(mul(d, 1 / r)), k = Math.min(EL - 1, Math.round(e)) * AZ + wrap(Math.round(a));
    if (r > R0[k]) R0[k] = r;
    if (t) { const n = mul(d, 1 / r), f = sub(t, mul(n, dot(t, n))), l = len(f); if (l > 1e-6) { for (let x = 0; x < 3; x++) F[x][k] += f[x] / l; Fw[k] += 1; } }
  };
  let points = 0;
  for (const guides of guidesList) for (const G of guides) G.pts.forEach((p, k) => {
    const t = G.pts[Math.min(G.pts.length - 1, k + 1)], s = G.pts[Math.max(0, k - 1)];
    put(p, sub(t, s)); const h = mul(G.across[k], G.width[k] / 2); put(add(p, h)); put(sub(p, h)); points++;
  });
  const m0 = new Uint8Array(N); let covered0 = 0; for (let k = 0; k < N; k++) { m0[k] = R0[k] > 0 && head[k] ? 1 : 0; covered0 += m0[k]; }
  // 2. the gaps closed
  const close = Math.round(2 + smooth * 3), M = erode(dilate(m0, close), close);
  for (let k = 0; k < N; k++) M[k] = M[k] && head[k] ? 1 : 0;
  const w0 = new Float32Array(N); for (let k = 0; k < N; k++) w0[k] = m0[k];
  const fill = blur(R0, w0, close * 0.8), R1 = new Float32Array(N);
  for (let k = 0; k < N; k++) R1[k] = m0[k] ? R0[k] : fill.v[k];
  // 3. smoothed, lifted, never under the skin
  const wM = new Float32Array(N); for (let k = 0; k < N; k++) wM[k] = M[k];
  const Rs = blur(R1, wM, 1 + smooth * 2.5).v;
  for (let i = 0; i < EL; i++) for (let j = 0; j < AZ; j++) { const k = i * AZ + j; if (!M[k]) { Rs[k] = 0; continue; } const d = dirOf(i, j); Rs[k] = Math.max(Rs[k] + thickness * 0.012, col.radius(d) + GAP + 0.002); }
  // 4. the flow
  const Fb = [0, 1, 2].map(x => blur(F[x], Fw.map(v => v > 0 ? 1 : 0), 2.2));
  const at = d => {                                                               // the hull's radius this way (0: none)
    const [e, a] = binOf(d), i0 = Math.floor(e), j0 = Math.floor(a), fe = e - i0, fa = a - j0; let s = 0, w = 0;
    for (const [di, dj, g] of [[0, 0, (1 - fe) * (1 - fa)], [0, 1, (1 - fe) * fa], [1, 0, fe * (1 - fa)], [1, 1, fe * fa]]) { const ii = Math.min(EL - 1, i0 + di), k = ii * AZ + wrap(j0 + dj); if (M[k]) { s += Rs[k] * g; w += g; } }
    return w > 0.35 ? s / w : 0;
  };
  const flow = d => {                                                             // the hair's way here, on the sphere
    const [e, a] = binOf(d), k = Math.min(EL - 1, Math.round(e)) * AZ + wrap(Math.round(a));
    let f = [Fb[0].v[k], Fb[1].v[k], Fb[2].v[k]]; f = sub(f, mul(d, dot(f, d)));
    if (len(f) < 0.2) { f = sub([0, -1, 0], mul(d, -d[1])); if (len(f) < 1e-3) f = cross(d, [1, 0, 0]); }
    return norm(f);
  };
  // 5. the cards: evenly spaced streamlines on each shell
  const shells = 1 + Math.round(thickness * 2), cards = [], r = rng(o.seed ?? 11), step = spacing * 0.4, maxSteps = Math.round(0.6 / step);
  for (let sh = 0; sh < shells; sh++) {
    const depth = d => { const R = at(d), skin = col.radius(d) + GAP; return sh === 0 ? R - 0.002 : R - 0.002 - (R - 0.002 - skin) * sh / shells; };
    const grid = new Map(), cell = spacing, key = p => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
    const near = (p, dist, own) => { const [x, y, z] = p.map(v => Math.floor(v / cell)); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const L = grid.get(`${x + a},${y + b},${z + c}`); if (L) for (const [q, id] of L) if (id !== own && len(sub(q, p)) < dist) return true; } return false; };
    const mark = (p, id) => { const k = key(p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([p, id]); };
    const trace = (d0, sign, id) => {                                              // on the shell from d0, one way
      const out = []; let d = d0;
      for (let s = 0; s < maxSteps; s++) {
        const R = at(d); if (!R) break; const p = add(C, mul(d, depth(d)));
        if (s > 2 && near(p, spacing * 0.5, id)) break;
        out.push(p);
        const nd = norm(add(d, mul(flow(d), sign * step / R)));
        if (C[1] + nd[1] * R < low) break;
        d = nd;
      }
      return out;
    };
    const seeds = [];
    for (let i = 1; i < EL - 1; i += 2) for (let j = 0; j < AZ; j += Math.max(1, Math.round(2 * azStretch(i)))) {
      const k = i * AZ + j; if (!M[k]) continue;
      seeds.push(norm(add(dirOf(i, j), mul([r() - 0.5, r() - 0.5, r() - 0.5], 0.02))));
    }
    for (let n = seeds.length - 1; n > 0; n--) { const m = Math.floor(r() * (n + 1)); [seeds[n], seeds[m]] = [seeds[m], seeds[n]]; }
    for (const d0 of seeds) {
      if (!at(d0)) continue; const p0 = add(C, mul(d0, depth(d0)));
      if (near(p0, spacing, -1)) continue;
      const id = cards.length + 1, up = trace(d0, -1, id), down = trace(d0, 1, id), line = [...up.reverse(), ...down.slice(1)];
      let L = 0; for (let k = 1; k < line.length; k++) L += len(sub(line[k], line[k - 1]));
      if (line.length < 4 || L < spacing * 2.5) continue;
      for (const p of line) mark(p, id);
      const pts = resampleLine(line, SAMP);
      cards.push({ pts, t: pts.map((_, k) => k / (SAMP - 1)), padding: true,
        across: pts.map((p, k) => { const tg = norm(sub(pts[Math.min(SAMP - 1, k + 1)], pts[Math.max(0, k - 1)])), n = norm(sub(p, C)); return norm(cross(n, tg)); }),
        width: pts.map((_, k) => spacing * 1.8 * WIDTH.scale * (1 - 0.45 * Math.pow(k / (SAMP - 1), 2))) });
    }
  }
  let covered = 0; for (let k = 0; k < N; k++) covered += M[k];
  return { cards, hull: { at, flow, inside: d => at(d) > 0, radius: Rs, mask: M }, stats: { points, shells, cards: cards.length, closed: covered - covered0, covered } };
}
function resampleLine(P, n) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + len(sub(P[i], P[i - 1])));
  const out = [];
  for (let s = 0; s < n; s++) { const want = s / (n - 1) * L[L.length - 1]; let i = 1; while (i < P.length - 1 && L[i] < want) i++; const seg = L[i] - L[i - 1] || 1; const f = Math.max(0, Math.min(1, (want - L[i - 1]) / seg)); out.push(add(P[i - 1], mul(sub(P[i], P[i - 1]), f))); }
  return out;
}
