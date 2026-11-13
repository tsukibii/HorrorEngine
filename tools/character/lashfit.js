// lashfit.js: lashes and the lash line kept on top of the lid's skin (Character Studio, Brows & lashes; DECISIONS
// 2026-11-13, the lashes: the user's marked picture: "they don't sit on top of the skin (light clipping in the red
// circles) ... a solution that knows how to place the eyelashes in a more realistic manner and then bakes it for
// godot, eyelids only ever close / blink so it shouldn't be too intricate with the eyelid motions").
//
// The lashes are built from a few lines along each lid (browlash.js: the lid's edge, three points over its rim) and
// swung with the lid as it shuts; the skin they stand on is a mesh that the eye's shape keys, the sculpt and the blink
// bend its own way. Between the two, a lash's root sat under the skin (the hair seemed to start in mid air), the lash
// line's strip cut chords under the lid's rounded rim, and a fold of skin lay over both. So the lashes are fitted to
// the skin itself, after they're built, in whatever state the lids are in:
//   - the lash line (a strip of dark roots over the rim): every point put on the nearest skin, a hair's breadth off it;
//   - a lash: every point of it that is under the skin, or nearer than a hair's breadth, lifted out to that; the rest of
//     it (out in the air) left as it was made. So a lash lies along the skin from its root until it leaves it.
// The Studio runs it each time the lashes are made (browLash), which is once a state of the blink when a character is
// exported: each of the export's blink targets holds lashes fitted to the lid as it is there. Nothing for Godot to do.
//
//   const S = makeSkin(P, faces, { skip: i => ring[i] < 0, cell })   P: the skin's points (x, y, z each), faces: its triangles;
//                                                                    skip(i): a point whose triangles aren't skin (the lid's lining)
//   closest(S, x, y, z, reach, out)        the signed distance to the skin (+ outside, by the nearest triangle's own facing), or
//                                          NaN past reach; out: the nearest point and that triangle's normal (6 numbers)
//   conform(pos, S, { lift, reach, all })  pos (x, y, z each) changed in place; all: every point within reach put at
//                                          lift (the lash line); else only those under lift. Returns { near, moved, under, deepest }
// Plain arrays, no three.js (lashfit_check.mjs runs it in node: LASHFIT).

// the skin's triangles in a grid of `cell`: each cell the triangles whose box touches it
export function makeSkin(P, faces, o = {}) {
  const cell = o.cell || 0.0012, skip = o.skip || null, n = Math.floor(faces.length / 3), T = new Float32Array(n * 12), cells = new Map();
  let m = 0;
  for (let t = 0; t < n; t++) {
    const a = faces[t * 3], b = faces[t * 3 + 1], c = faces[t * 3 + 2];
    if (skip && (skip(a) || skip(b) || skip(c))) continue;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2], cx = P[c * 3], cy = P[c * 3 + 1], cz = P[c * 3 + 2];
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const l = Math.hypot(nx, ny, nz); if (!(l > 1e-18)) continue;               // (a triangle with no area has no facing)
    const k = m * 12; T[k] = ax; T[k + 1] = ay; T[k + 2] = az; T[k + 3] = bx; T[k + 4] = by; T[k + 5] = bz; T[k + 6] = cx; T[k + 7] = cy; T[k + 8] = cz; T[k + 9] = nx / l; T[k + 10] = ny / l; T[k + 11] = nz / l;
    const x0 = Math.floor(Math.min(ax, bx, cx) / cell), x1 = Math.floor(Math.max(ax, bx, cx) / cell), y0 = Math.floor(Math.min(ay, by, cy) / cell), y1 = Math.floor(Math.max(ay, by, cy) / cell);
    const z0 = Math.floor(Math.min(az, bz, cz) / cell), z1 = Math.floor(Math.max(az, bz, cz) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const key = x + "," + y + "," + z; let L = cells.get(key); if (!L) cells.set(key, L = []); L.push(m); }
    m++;
  }
  return { T, n: m, cell, cells, near: new Map() };
}
// the triangles that can be within `reach` of a point in the fine cell (half a grid cell across) it lies in: found
// once a fine cell (the lashes' thousands of points share a few hundred of them)
function nearOf(S, x, y, z, reach) {
  const f = S.cell / 2, fx = Math.floor(x / f), fy = Math.floor(y / f), fz = Math.floor(z / f), key = fx + "," + fy + "," + fz + "," + reach;
  let L = S.near.get(key); if (L) return L;
  const mx = (fx + 0.5) * f, my = (fy + 0.5) * f, mz = (fz + 0.5) * f, R = reach + f * 0.87, c = S.cell, seen = new Set();   // (0.87: half a fine cell's diagonal)
  for (let cx = Math.floor((mx - R) / c); cx <= Math.floor((mx + R) / c); cx++) for (let cy = Math.floor((my - R) / c); cy <= Math.floor((my + R) / c); cy++) for (let cz = Math.floor((mz - R) / c); cz <= Math.floor((mz + R) / c); cz++) {
    const B = S.cells.get(cx + "," + cy + "," + cz); if (B) for (const t of B) seen.add(t);
  }
  const T = S.T, out = [];
  for (const t of seen) {                                 // only those whose own box is within R of the fine cell's middle
    const k = t * 12, dx = Math.max(Math.min(T[k], T[k + 3], T[k + 6]) - mx, 0, mx - Math.max(T[k], T[k + 3], T[k + 6]));
    const dy = Math.max(Math.min(T[k + 1], T[k + 4], T[k + 7]) - my, 0, my - Math.max(T[k + 1], T[k + 4], T[k + 7])), dz = Math.max(Math.min(T[k + 2], T[k + 5], T[k + 8]) - mz, 0, mz - Math.max(T[k + 2], T[k + 5], T[k + 8]));
    if (dx * dx + dy * dy + dz * dz <= R * R) out.push(t);
  }
  S.near.set(key, L = Int32Array.from(out)); return L;
}
// the nearest point of a triangle (Ericson, Real-Time Collision Detection 5.1.5), into q
const q = [0, 0, 0];
function onTriangle(T, k, px, py, pz) {
  const ax = T[k], ay = T[k + 1], az = T[k + 2], abx = T[k + 3] - ax, aby = T[k + 4] - ay, abz = T[k + 5] - az, acx = T[k + 6] - ax, acy = T[k + 7] - ay, acz = T[k + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { q[0] = ax; q[1] = ay; q[2] = az; return; }
  const bpx = apx - abx, bpy = apy - aby, bpz = apz - abz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { q[0] = ax + abx; q[1] = ay + aby; q[2] = az + abz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q[0] = ax + v * abx; q[1] = ay + v * aby; q[2] = az + v * abz; return; }
  const cpx = apx - acx, cpy = apy - acy, cpz = apz - acz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { q[0] = ax + acx; q[1] = ay + acy; q[2] = az + acz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q[0] = ax + w * acx; q[1] = ay + w * acy; q[2] = az + w * acz; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q[0] = ax + abx + w * (acx - abx); q[1] = ay + aby + w * (acy - aby); q[2] = az + abz + w * (acz - abz); return; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  q[0] = ax + abx * v + acx * w; q[1] = ay + aby * v + acy * w; q[2] = az + abz * v + acz * w;
}
// the signed distance from a point to the skin within reach (NaN past it): + on the side the nearest triangle faces.
// Where two triangles are as near (the point over an edge between them), the one the point is more squarely in front
// of or behind decides, so a point just inside a fold's crease isn't called outside by the fold's other face
export function closest(S, x, y, z, reach, out = null) {
  const L = nearOf(S, x, y, z, reach), T = S.T; let best = reach * reach, bt = -1, bx = 0, by = 0, bz = 0, bq = 0;
  for (let i = 0; i < L.length; i++) {
    const k = L[i] * 12; onTriangle(T, k, x, y, z);
    const dx = x - q[0], dy = y - q[1], dz = z - q[2], d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > best * 1.0002 + 1e-18) continue;
    const sq = Math.abs(dx * T[k + 9] + dy * T[k + 10] + dz * T[k + 11]);       // how squarely it's in front of (or behind) this one
    if (d2 < best * 0.9998 - 1e-18 || sq > bq) { best = Math.min(best, d2); bt = k; bx = q[0]; by = q[1]; bz = q[2]; bq = sq; }
  }
  if (bt < 0) return NaN;
  const side = (x - bx) * T[bt + 9] + (y - by) * T[bt + 10] + (z - bz) * T[bt + 11] >= 0 ? 1 : -1;
  if (out) { out[0] = bx; out[1] = by; out[2] = bz; out[3] = T[bt + 9]; out[4] = T[bt + 10]; out[5] = T[bt + 11]; }
  return side * Math.sqrt(best);
}
// a point pressed between two skins (the lids' margins, shut: the upper's facing down on the lower's facing up, with
// nothing between them): it's under one, and put out of that one it's behind another whose facing is against the
// first's, or nearer to it than the lift (the gap between the two is less than a hair can lie in), no further in than
// `within` (a lid's own back is a lid's thickness away: not that). There's no place on top of the skin for it there,
// and none is wanted: both lids hide it. hit: closest()'s out for the point (the skin it's under or on); lift: how
// far off that skin it would be put
export function inSeam(S, hit, lift, reach, within = 0.00035) {
  const x = hit[0] + hit[3] * lift, y = hit[1] + hit[4] * lift, z = hit[2] + hit[5] * lift, L = nearOf(S, x, y, z, Math.min(reach, 2 * within)), T = S.T;
  for (let i = 0; i < L.length; i++) {
    const k = L[i] * 12, nx = T[k + 9], ny = T[k + 10], nz = T[k + 11];
    if (hit[3] * nx + hit[4] * ny + hit[5] * nz > -0.15) continue;             // (only a skin that faces the other way: at the eye's corners the two lids meet at an angle, not square on)
    onTriangle(T, k, x, y, z);
    const dx = x - q[0], dy = y - q[1], dz = z - q[2], s = dx * nx + dy * ny + dz * nz, d2 = dx * dx + dy * dy + dz * dz;
    if (s < lift && d2 <= within * within && s * s >= 0.25 * d2) return true;  // behind it or within a hair of it, squarely, and no deeper than skins pressed together go
  }
  return false;
}
// points fitted to the skin, in place: `all` every point within reach put a `lift` off its nearest skin (the lash line: it
// is the skin's own dark edge); else only the points under `lift` (a lash: where it's in the skin, or nearer than a
// hair's breadth, it lies on it; the rest of it is its own). A point's way out is the nearest triangle's facing, eased
// toward the way it already stands off the skin when that's outward too (so a strip over a rounded rim keeps its
// roundness). A point in a seam (inSeam) is put on the skin it's under, with no lift (between the two skins), and
// counted; with `settle` (the last pass of a fit) so is a point whose place off the skin would be under another skin
export function conform(pos, S, o = {}) {
  const lift = o.lift ?? 0.00006, reach = o.reach ?? 0.002, all = !!o.all, hit = [0, 0, 0, 0, 0, 0], n = Math.floor(pos.length / 3);
  let near = 0, moved = 0, under = 0, deepest = 0, seam = 0;
  for (let i = (o.from || 0); i < (o.to ?? n); i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], d = closest(S, x, y, z, reach, hit);
    if (d !== d) continue;                               // (NaN: no skin within reach)
    near++;
    if (d < 0) { under++; if (-d > deepest) deepest = -d; }
    if (!(all ? Math.abs(d - lift) > lift * 1e-3 : d < lift * 0.999)) continue;   // (already there, to a thousandth of the lift: fitting again moves nothing)
    let nx = hit[3], ny = hit[4], nz = hit[5];
    if (d > 1e-7) {                                      // outside already: out along the way it stands off the skin, when that's the triangle's side
      const ox = (x - hit[0]) / d, oy = (y - hit[1]) / d, oz = (z - hit[2]) / d;
      if (ox * nx + oy * ny + oz * nz > 0.5) { nx = ox; ny = oy; nz = oz; }
    }
    if (d < lift && inSeam(S, hit, lift, reach, o.within ?? 0.00035)) {   // between two skins pressed together: hidden by both, with no room to stand off either.
      seam++;                                            // It goes onto the skin it's under, between the two (left deep in one lid it pulled the lash under the skin on the
      if (Math.abs(d) > lift * 1e-3) { pos[i * 3] = hit[0]; pos[i * 3 + 1] = hit[1]; pos[i * 3 + 2] = hit[2]; moved++; }   // way there, between two weights of a blink)
      continue;
    }
    const lx = hit[0] + nx * lift, ly = hit[1] + ny * lift, lz = hit[2] + nz * lift;
    if (o.settle) {                                      // the last pass: a place off this skin that is under another one (two skins meeting at a corner of the eye, not
      const dl = closest(S, lx, ly, lz, reach);          // squarely against each other) is no place either: onto the skin, as in a seam
      if (dl === dl && dl < 0) { seam++; if (Math.abs(d) > lift * 1e-3) { pos[i * 3] = hit[0]; pos[i * 3 + 1] = hit[1]; pos[i * 3 + 2] = hit[2]; moved++; } continue; }
    }
    pos[i * 3] = lx; pos[i * 3 + 1] = ly; pos[i * 3 + 2] = lz;
    moved++;
  }
  return { near, moved, under, deepest, seam };
}
