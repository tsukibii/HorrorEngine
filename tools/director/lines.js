// Sculpting lines (the Fat suit page's Lines tool, docs/FLESH.md §5): vertical lines over each soft part of the fat
// suit, from where the fat attaches above to where it attaches below, with control points to pull in or out, the
// way a modeller works the silhouette. Only the fat suit moves: the lean body is the floor (FleshSim.volMin).
import * as THREE from "three";

export const LINE_DEFAULTS = { points: 5, minLen: 4 };

// The lines of a built simulation. Each soft part gets a few lines spread round it, each the cut of a vertical plane
// (through the part's centre line, at a bearing) with the part's triangles: a clean curve, trimmed to the part
// (the region's points: fat over 6 mm, or a volume), so it stops where the fat attaches. A curve is a chain of
// points on mesh edges (edge a-b, fraction s), so it can be placed on the body in any pose from the skinned points.
export function traceLines(sim, opts = {}) {
  const o = Object.assign({}, LINE_DEFAULTS, opts), N = sim.N, B = sim.outerBase;
  if (!sim.region || !sim.regionNames) return [];
  const G = sim.mesh.geometry, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, bones = sim.mesh.skeleton.bones;
  const trunk = new Set(["root", "c_spine0", "c_spine1", "c_spine2", "c_spine3", "c_neck"]);
  const isTrunk = sim.rep.map(r => { let best = -1, bw = 0; for (let k = 0; k < 4; k++) if (SW.getComponent(r, k) > bw) { bw = SW.getComponent(r, k); best = SI.getComponent(r, k); } return trunk.has(bones[best]?.name); });
  const centre = set => { let x = 0, z = 0, n = 0; for (let i = 0; i < N; i++) if (set(i)) { x += B[i * 3]; z += B[i * 3 + 2]; n++; } return n ? [x / n, z / n] : [0, 0]; };
  // the triangles touching each region
  const triOf = new Map();
  for (let t = 0; t < sim.index.length; t += 3) for (const v of [sim.index[t], sim.index[t + 1], sim.index[t + 2]]) { const r = sim.region[v]; if (r) { if (!triOf.has(r)) triOf.set(r, new Set()); triOf.get(r).add(t); } }
  const lines = [];
  for (let r = 1; r < sim.regionNames.length; r++) {
    const name = sim.regionNames[r], ids = []; for (let i = 0; i < N; i++) if (sim.region[i] === r) ids.push(i);
    if (ids.length < 12 || !triOf.has(r)) continue;
    const own = /^(thigh|upper arm)/.test(name), ymid = ids.reduce((s, i) => s + B[i * 3 + 1], 0) / ids.length;
    const [cx, cz] = own ? centre(i => sim.region[i] === r) : centre(i => isTrunk[i] && Math.abs(B[i * 3 + 1] - ymid) < 6);
    const az = i => Math.atan2(B[i * 3] - cx, B[i * 3 + 2] - cz);
    let sx = 0, sz = 0; for (const i of ids) { const a = az(i); sx += Math.sin(a); sz += Math.cos(a); }
    const a0 = Math.atan2(sx, sz), rel = i => { let d = az(i) - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    let lo = Infinity, hi = -Infinity; for (const i of ids) { const d = rel(i); lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const span = hi - lo, K = Math.max(2, Math.min(6, Math.round(span / 0.4)));
    for (let k = 0; k < K; k++) {
      const bearing = a0 + lo + span * (0.1 + 0.8 * k / (K - 1));
      // the vertical plane through the centre line at that bearing; only the half-space in front of the centre
      const dir = [Math.sin(bearing), Math.cos(bearing)], nrm = [dir[1], -dir[0]];   // (x, z) along the bearing, and across it
      const side = i => (B[i * 3] - cx) * nrm[0] + (B[i * 3 + 2] - cz) * nrm[1], ahead = i => (B[i * 3] - cx) * dir[0] + (B[i * 3 + 2] - cz) * dir[1] > 0;
      const segs = [];
      for (const t of triOf.get(r)) {
        const v = [sim.index[t], sim.index[t + 1], sim.index[t + 2]]; if (!v.some(ahead)) continue;
        const cross = [];
        for (let e = 0; e < 3; e++) { const a = v[e], b = v[(e + 1) % 3], sa = side(a), sb = side(b); if ((sa < 0) !== (sb < 0)) cross.push({ a: Math.min(a, b), b: Math.max(a, b), s: a < b ? sa / (sa - sb) : sb / (sb - sa) }); }
        if (cross.length === 2) segs.push(cross);
      }
      const curve = chain(segs, B); if (!curve || curve.length < o.minLen) continue;
      const ctrl = []; for (let m = 0; m < o.points; m++) ctrl.push(+(m / (o.points - 1)).toFixed(4));
      lines.push({ part: name, name: `${name} ${k + 1}`, k, K, edge: k === 0 || k === K - 1, pts: curve, ctrl });
    }
  }
  return lines;
}
// segments (two edge crossings each) into one polyline, top to bottom: the longest chain
function chain(segs, B) {
  const key = c => `${c.a}-${c.b}`, byKey = new Map();
  segs.forEach((sg, i) => { for (const c of sg) { const k = key(c); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(i); } });
  const used = new Set(); let best = null;
  const grow = (s0, startKey) => {                   // from segment s0, leaving by the crossing that isn't startKey
    const out = []; let cur = s0, inKey = startKey;
    for (;;) {
      used.add(cur);
      const other = key(segs[cur][0]) === inKey ? segs[cur][1] : segs[cur][0]; out.push(other);
      const nxt = (byKey.get(key(other)) || []).find(i => !used.has(i)); if (nxt === undefined) break;
      inKey = key(other); cur = nxt;
    }
    return out;
  };
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used.has(s0)) continue;
    const right = grow(s0, key(segs[s0][0])); used.delete(s0); const left = grow(s0, key(segs[s0][1]));
    const pts = left.reverse().concat(right); if (!best || pts.length > best.length) best = pts;
  }
  if (!best) return null;
  const y = c => B[c.a * 3 + 1] + (B[c.b * 3 + 1] - B[c.a * 3 + 1]) * c.s;
  if (y(best[0]) < y(best[best.length - 1])) best.reverse();
  // arc length along it (bind space), for the control points' parameters
  let L = 0; const pos = c => new THREE.Vector3(B[c.a * 3], B[c.a * 3 + 1], B[c.a * 3 + 2]).lerp(new THREE.Vector3(B[c.b * 3], B[c.b * 3 + 1], B[c.b * 3 + 2]), c.s);
  best[0].t = 0; for (let i = 1; i < best.length; i++) { L += pos(best[i]).distanceTo(pos(best[i - 1])); best[i].t = L; }
  for (const c of best) c.t = L ? c.t / L : 0;
  return best;
}

// a curve point at parameter t, from any point array (bind or skinned: xyz per vertex)
export function curveAt(line, t, X) {
  const P = line.pts; let i = 1; while (i < P.length - 1 && P[i].t < t) i++;
  const a = P[i - 1], b = P[i], u = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
  const at = c => new THREE.Vector3(X[c.a * 3], X[c.a * 3 + 1], X[c.a * 3 + 2]).lerp(new THREE.Vector3(X[c.b * 3], X[c.b * 3 + 1], X[c.b * 3 + 2]), c.s);
  return at(a).lerp(at(b), u);
}
export function nearestT(line, p, X) {             // the parameter of the curve point nearest a position
  let best = 0, bd = Infinity;
  for (const c of line.pts) { const q = new THREE.Vector3(X[c.a * 3], X[c.a * 3 + 1], X[c.a * 3 + 2]).lerp(new THREE.Vector3(X[c.b * 3], X[c.b * 3 + 1], X[c.b * 3 + 2]), c.s); const d = q.distanceTo(p); if (d < bd) { bd = d; best = c.t; } }
  return best;
}

// proportional editing from one spot (bind space): vol = vol0 + amount x falloff, for vertices within the radius of
// it (and of its mirror), never below the floor; the shape follows at once, the physics on release (refine)
export function pullAt(sim, centre, amount, radius, mirror, vol0) {
  const B = sim.outerBase, n = sim.nrm0, N = sim.N, touched = [];
  const cs = [[centre.x, centre.y, centre.z]]; if (mirror) cs.push([-centre.x, centre.y, centre.z]);
  for (let i = 0; i < N; i++) {
    let d = Infinity; for (const c of cs) d = Math.min(d, Math.hypot(B[i * 3] - c[0], B[i * 3 + 1] - c[1], B[i * 3 + 2] - c[2]));
    if (d >= radius) continue;
    const u = 1 - d / radius, f = u * u * (3 - 2 * u);                   // Blender's smooth falloff
    sim.vol[i] = Math.max(sim.volMin[i], vol0[i] + amount * f);
    for (let a = 0; a < 3; a++) sim.outerBind[i * 3 + a] = B[i * 3 + a] + n[i * 3 + a] * sim.vol[i];
    touched.push(i);
  }
  return touched;
}
