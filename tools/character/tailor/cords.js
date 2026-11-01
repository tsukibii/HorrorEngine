// Cords: a bikini's strings as real tubes, not bands cut from the skin (the user, 2026-11-01: "why do the bras look
// painted on ... why does the red one attach to nothing around the neck"; their string bikini OBJ the reference). A
// string under tension runs straight between what holds it and lies on the body only where the body pushes it out:
// each is a path pulled taut (smoothed with its ends held) and pushed off the skin, swept as a round tube.
//
//   halterCords(F, B, P, o)  a halter top's strings: a strap from each cup's point up to the neck's side, round behind
//                            the neck, a band round the ribs under the cups, a bow at the front between them

const TAU = Math.PI * 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** a round tube of radius r along points (open: capped ends; closed: a loop), its frames carried along (no twist) */
export function tube(pts, r, sides = 8, closed = false, out = { P: [], T: [] }) {
  const n = pts.length; if (n < 2) return out;
  const tan = pts.map((p, i) => norm(sub(pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)], pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)])));
  let u = Math.abs(tan[0][1]) < 0.9 ? norm(cross(tan[0], [0, 1, 0])) : norm(cross(tan[0], [1, 0, 0]));
  const base = out.P.length / 3;
  for (let i = 0; i < n; i++) {
    if (i) { const t = tan[i]; u = norm(sub(u, mul(t, dot(u, t)))); }   // carried along: square to the new tangent
    const w = cross(tan[i], u);
    for (let k = 0; k < sides; k++) { const a = k / sides * TAU, d = add(mul(u, Math.cos(a) * r), mul(w, Math.sin(a) * r)); out.P.push(pts[i][0] + d[0], pts[i][1] + d[1], pts[i][2] + d[2]); }
  }
  const rings = closed ? n : n - 1;
  for (let i = 0; i < rings; i++) for (let k = 0; k < sides; k++) {
    const a = base + i * sides + k, b = base + i * sides + (k + 1) % sides, c = base + ((i + 1) % n) * sides + k, d = base + ((i + 1) % n) * sides + (k + 1) % sides;
    out.T.push(a, c, b, b, c, d);
  }
  if (!closed) for (const [i, sg] of [[0, -1], [n - 1, 1]]) {        // the ends capped
    const c = out.P.length / 3; out.P.push(...pts[i]);
    for (let k = 0; k < sides; k++) { const a = base + i * sides + k, b = base + i * sides + (k + 1) % sides; if (sg > 0) out.T.push(c, a, b); else out.T.push(c, b, a); }
  }
  return out;
}

/** a path pulled taut between its ends and kept `clear` off the skin: smoothed with its ends held, pushed out along the
    skin's normal wherever it's nearer than that, again and again (a string's shortest way over the body) */
export function taut(surf, pts, clear, rounds = 40) {
  const P = pts.map(p => [...p]), hit = {};
  for (let r = 0; r < rounds; r++) {
    for (let i = 1; i < P.length - 1; i++) P[i] = mul(add(add(P[i - 1], P[i + 1]), mul(P[i], 2)), 0.25);
    for (let i = 1; i < P.length - 1; i++) {
      const q = surf.closest(P[i][0], P[i][1], P[i][2], clear + 0.06, hit); if (!q || q.d >= clear) continue;
      const k = clear - q.d; P[i] = [P[i][0] + hit.nx * k, P[i][1] + hit.ny * k, P[i][2] + hit.nz * k];
    }
  }
  return P;
}

const line = (a, b, n) => Array.from({ length: n }, (_, i) => add(a, mul(sub(b, a), i / (n - 1))));

/** a slice of the body at height y as its convex hull's radius by angle round (cx, cz): r(angle), the angle from +z */
function hullAt(F, y, cx, cz) {
  const row = F.scan.at(y), l = row && F.scan.central(row);
  const pts = (l ? l.pts : []).map(([x, z]) => [x - cx, z - cz]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const H = lo.slice(0, -1).concat(up.slice(0, -1));
  return a => {
    const dx = Math.sin(a), dz = Math.cos(a); let best = 0;
    for (let i = 0; i < H.length; i++) {
      const p = H[i], q = H[(i + 1) % H.length], ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-12) continue;
      const t = (p[0] * ez - p[1] * ex) / den, u = (p[0] * dz - p[1] * dx) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t);
    }
    return best || 0.06 * F.s;
  };
}

/**
 * A halter top's strings on body B (frame F) for its cups cut as the points P (the cloth, hung or as cut): the straps
 * from each cup's highest point up to the neck's sides and round behind the neck (one string), a band round the ribs
 * just under the cups (over the spine's groove: the slice's hull), and a bow at the front between the cups with its
 * two ends hanging. `o`: the bra's settings (`cord` the string's thickness, m; `under` the band's height). {P, T, S}
 */
export function halterCords(F, B, P, o = {}) {
  const s = F.s, r = (o.cord ?? 0.0035) * s / 2, clear = r + 0.0012 * s, out = { P: [], T: [] };
  const [cx0, cz0] = F.torsoAxis(F.bustY);
  // the cups' points: on each side the highest point of the cloth on the front
  const tips = [1, -1].map(sg => {
    let best = null;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      if ((x - cx0) * sg < 0.015 * s || z < cz0 || y > F.armpitY + 0.05 * s) continue;
      if (!best || y > best[1]) best = [x, y, z];
    }
    return best;
  });
  if (!tips[0] || !tips[1]) return { P: new Float32Array(0), T: new Uint32Array(0), S: new Float32Array(0) };
  // the neck: a ring just over its base, the straps meeting it at its sides a little forward, round behind it
  const N = F.neck, ny = F.neckBaseY + 0.018 * s, nr = hullAt(F, ny, N.cx, N.cz), side = Math.PI / 2 - 0.35;
  const ring = a => [N.cx + Math.sin(a) * (nr(a) + clear), ny, N.cz + Math.cos(a) * (nr(a) + clear)];
  const strap = (tip, a) => taut(B.surf, line([tip[0], tip[1] + r, tip[2]], ring(a), 36), clear);
  const L = strap(tips[0], side), R = strap(tips[1], -side), back = [];
  for (let k = 1; k < 40; k++) back.push(ring(side + (TAU - 2 * side) * k / 40));   // from the left side round the back to the right
  tube(L.concat(back, R.slice().reverse()), r, 8, false, out);
  // the band: round the ribs just under the cups, on the slice's hull (over the spine's groove, under the cups' edge)
  const by = o.under ?? F.bustY - 0.06 * s, [bx, bz] = F.torsoAxis(by), br = hullAt(F, by, bx, bz), band = [];
  for (let k = 0; k < 96; k++) { const a = k / 96 * TAU; band.push([bx + Math.sin(a) * (br(a) + clear), by, bz + Math.cos(a) * (br(a) + clear)]); }
  tube(band, r, 8, true, out);
  // the bow at the front between the cups: two loops and two ends hanging
  const f = [bx, by, bz + br(0) + clear + r], lw = 0.022 * s, lh = 0.011 * s;
  for (const sg of [1, -1]) {
    const loop = []; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; loop.push([f[0] + sg * (lw / 2 + lw / 2 * Math.cos(a)), f[1] + lh * Math.sin(a), f[2] + r * 1.5 + 0.004 * s * (1 - Math.cos(a)) / 2]); }
    tube(loop, r * 0.9, 6, true, out);
    const end = []; for (let k = 0; k <= 12; k++) { const t = k / 12; end.push([f[0] + sg * (0.004 + 0.012 * t) * s, f[1] - 0.075 * s * t, f[2] + r * 1.5 + 0.006 * s * Math.sin(t * Math.PI) ]); }
    tube(end, r * 0.9, 6, false, out);
  }
  const knot = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; knot.push([f[0] + 0.004 * s * Math.cos(a), f[1] + 0.004 * s * Math.sin(a), f[2] + r * 2]); }
  tube(knot, r * 1.2, 6, true, out);
  return { P: new Float32Array(out.P), T: new Uint32Array(out.T), S: new Float32Array(out.P.length / 3).fill(1) };
}
