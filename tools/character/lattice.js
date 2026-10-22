// The hair builder's cage (tools/character/hairbuilder.html): a box round the hair, cut into pieces by planes across
// it (y: horizontal cuts, z: front to back, x: side to side). Each piece is its own small lattice of nodes: two
// columns each way (x, z) and `segments` + 1 rows down it. A Gaussian belongs to the piece it sits in when the cage is
// locked and keeps its place in that piece's nodes (trilinear coordinates), so moving, stretching or jiggling the nodes
// carries the Gaussians. Pieces are independent: dragging the bottom piece moves the bottom only. Plain arrays, no
// three.js; the page keeps the nodes in a float texture for the GPU.
//   const L = new Lattice(cage);  L.lock(positions)  ->  per-Gaussian piece and (u, v, w);  L.movePiece(id, d);  L.nodes()

const clamp01 = t => Math.max(0, Math.min(1, t));

export class Lattice {
  // cage: { box: {centre, size}, cuts: {x: [], y: [], z: []} (fractions along the box, 0 at the low side), pieces: {id: {...}}, segments }
  constructor(cage) {
    this.box = { centre: [...cage.box.centre], size: [...cage.box.size] };
    this.cuts = { x: [...(cage.cuts.x || [])].sort(), y: [...(cage.cuts.y || [])].sort(), z: [...(cage.cuts.z || [])].sort() };
    this.segments = cage.segments || 2;
    this.pieces = [];
    const edges = a => [0, ...this.cuts[a].filter(c => c > 0 && c < 1), 1];
    const ex = edges("x"), ey = edges("y"), ez = edges("z");
    const lo = this.box.centre.map((c, i) => c - this.box.size[i] / 2);
    for (let k = 0; k + 1 < ez.length; k++) for (let j = 0; j + 1 < ey.length; j++) for (let i = 0; i + 1 < ex.length; i++) {
      const id = `${i}_${j}_${k}`;
      const min = [lo[0] + ex[i] * this.box.size[0], lo[1] + ey[j] * this.box.size[1], lo[2] + ez[k] * this.box.size[2]];
      const max = [lo[0] + ex[i + 1] * this.box.size[0], lo[1] + ey[j + 1] * this.box.size[1], lo[2] + ez[k + 1] * this.box.size[2]];
      this.pieces.push({ id, i, j, k, min, max, rows: this.segments + 1, rest: null, nodes: null, count: 0, settings: Object.assign({ jiggle: false, gravity: 1, hold: 0.5, damping: 0.97, name: "" }, (cage.pieces || {})[id] || {}) });
    }
    this.byId = Object.fromEntries(this.pieces.map(p => [p.id, p]));
    // the nodes: per piece, rows from the top (row 0) down, each row 4 nodes: (x0,z0) (x1,z0) (x0,z1) (x1,z1)
    let at = 0;
    for (const p of this.pieces) {
      p.at = at; at += p.rows * 4;
      p.rest = new Float32Array(p.rows * 4 * 3);
      for (let r = 0; r < p.rows; r++) {
        const y = p.max[1] - (p.max[1] - p.min[1]) * r / (p.rows - 1);
        [[p.min[0], p.min[2]], [p.max[0], p.min[2]], [p.min[0], p.max[2]], [p.max[0], p.max[2]]].forEach(([x, z], c) => p.rest.set([x, y, z], (r * 4 + c) * 3));
      }
      p.nodes = Float32Array.from(p.rest);
    }
    this.total = at;
    if (cage.nodes) for (const p of this.pieces) if (cage.nodes[p.id] && cage.nodes[p.id].length === p.nodes.length) p.nodes.set(cage.nodes[p.id]);
  }

  // which piece a point is in (the nearest piece for points outside the box: they still ride), and its coordinates
  locate(x, y, z) {
    let best = null, bd = Infinity;
    for (const p of this.pieces) {
      const dx = Math.max(p.min[0] - x, 0, x - p.max[0]), dy = Math.max(p.min[1] - y, 0, y - p.max[1]), dz = Math.max(p.min[2] - z, 0, z - p.max[2]);
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = p; if (d === 0) break; }
    }
    const p = best;
    const u = (x - p.min[0]) / (p.max[0] - p.min[0] || 1), v = (p.max[1] - y) / (p.max[1] - p.min[1] || 1), w = (z - p.min[2]) / (p.max[2] - p.min[2] || 1);
    return { piece: p, u, v, w };            // u across x, v down from the top (0 top, 1 bottom), w along z; outside the box: beyond 0..1, still linear
  }

  // every Gaussian's piece and coordinates (positions Float32Array xyz): the lock
  lock(positions) {
    const n = positions.length / 3, piece = new Int32Array(n), uvw = new Float32Array(n * 3);
    for (const p of this.pieces) p.count = 0;
    for (let i = 0; i < n; i++) {
      const l = this.locate(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      piece[i] = this.pieces.indexOf(l.piece); uvw[i * 3] = l.u; uvw[i * 3 + 1] = l.v; uvw[i * 3 + 2] = l.w; l.piece.count++;
    }
    return { piece, uvw };
  }

  // a point from a piece's current nodes (the GPU does the same per Gaussian)
  map(p, u, v, w) {
    const rf = clamp01(v) * (p.rows - 1), r0 = Math.min(Math.floor(rf), p.rows - 2), f = rf - r0;
    const N = p.nodes, at = r => r * 4 * 3;
    const corner = (r, c) => [N[at(r) + c * 3], N[at(r) + c * 3 + 1], N[at(r) + c * 3 + 2]];
    const row = r => {
      const a = corner(r, 0), b = corner(r, 1), c = corner(r, 2), d = corner(r, 3);
      return [0, 1, 2].map(i => (a[i] * (1 - u) + b[i] * u) * (1 - w) + (c[i] * (1 - u) + d[i] * u) * w);
    };
    const top = row(r0), bot = row(r0 + 1);
    const out = [0, 1, 2].map(i => top[i] * (1 - f) + bot[i] * f);
    // beyond the bottom or the top (v outside 0..1): carry on linearly
    if (v > 1 || v < 0) { const over = v > 1 ? v - 1 : v; const d = [0, 1, 2].map(i => (bot[i] - top[i]) * (p.rows - 1)); for (let i = 0; i < 3; i++) out[i] += d[i] * over; }
    return out;
  }

  // the piece's current scale against its rest (for the Gaussians' sizes), per axis
  stretch(p) {
    const ext = (A, a, b) => Math.hypot(A[b * 3] - A[a * 3], A[b * 3 + 1] - A[a * 3 + 1], A[b * 3 + 2] - A[a * 3 + 2]);
    const last = (p.rows - 1) * 4;
    return [ext(p.nodes, 0, 1) / (ext(p.rest, 0, 1) || 1), ext(p.nodes, 0, last) / (ext(p.rest, 0, last) || 1), ext(p.nodes, 0, 2) / (ext(p.rest, 0, 2) || 1)];
  }

  movePiece(id, d) { const p = this.byId[id]; for (let i = 0; i < p.nodes.length; i += 3) { p.nodes[i] += d[0]; p.nodes[i + 1] += d[1]; p.nodes[i + 2] += d[2]; } }

  // scale a piece about its centre (its nodes as they are now), per axis
  scalePiece(id, s) {
    const p = this.byId[id], c = this.centre(p);
    for (let i = 0; i < p.nodes.length; i += 3) for (let a = 0; a < 3; a++) p.nodes[i + a] = c[a] + (p.nodes[i + a] - c[a]) * s[a];
  }

  // turn a piece about its centre (yaw, pitch, roll in radians, about the world axes)
  rotatePiece(id, yaw, pitch, roll) {
    const p = this.byId[id], c = this.centre(p), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    for (let i = 0; i < p.nodes.length; i += 3) {
      let x = p.nodes[i] - c[0], y = p.nodes[i + 1] - c[1], z = p.nodes[i + 2] - c[2];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];           // yaw about y
      [y, z] = [y * cp - z * sp, y * sp + z * cp];            // pitch about x
      [x, y] = [x * cr - y * sr, x * sr + y * cr];            // roll about z
      p.nodes[i] = c[0] + x; p.nodes[i + 1] = c[1] + y; p.nodes[i + 2] = c[2] + z;
    }
  }

  // move one row of a piece (0 the top): the bend
  moveRow(id, row, d) { const p = this.byId[id]; for (let c = 0; c < 4; c++) { const o = (row * 4 + c) * 3; p.nodes[o] += d[0]; p.nodes[o + 1] += d[1]; p.nodes[o + 2] += d[2]; } }

  centre(p) { const c = [0, 0, 0]; for (let i = 0; i < p.nodes.length; i += 3) { c[0] += p.nodes[i]; c[1] += p.nodes[i + 1]; c[2] += p.nodes[i + 2]; } return c.map(v => v / (p.nodes.length / 3)); }
  reset(id) { const p = this.byId[id]; p.nodes.set(p.rest); }
  resetAll() { for (const p of this.pieces) p.nodes.set(p.rest); }

  // the cage back as data (the nodes kept only where they moved)
  toJSON() {
    const nodes = {};
    for (const p of this.pieces) if (p.nodes.some((v, i) => Math.abs(v - p.rest[i]) > 1e-6)) nodes[p.id] = Array.from(p.nodes, v => +v.toFixed(5));
    const pieces = {};
    for (const p of this.pieces) pieces[p.id] = { ...p.settings };
    return { box: this.box, cuts: this.cuts, segments: this.segments, pieces, nodes, locked: true };
  }

  // the pieces' chains for the jiggle (wig.js): each column of a jiggling piece, pinned at its top node
  chains() {
    const out = [];
    for (const p of this.pieces) {
      if (!p.settings.jiggle) continue;
      for (let c = 0; c < 4; c++) out.push({ piece: p.id, column: c, pts: Array.from({ length: p.rows }, (_, r) => [p.nodes[(r * 4 + c) * 3], p.nodes[(r * 4 + c) * 3 + 1], p.nodes[(r * 4 + c) * 3 + 2]]), pin: 1 });
    }
    return out;
  }
}
