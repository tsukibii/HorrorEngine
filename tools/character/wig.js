// The wig: hair as a thing put on the head, not grown out of it. A style's strands (hair.js) become clumps: each a chain
// of points, pinned at the root (a tail up to its tie), the rest moved by gravity, held loosely to the style's shape (the
// hold fades from the root to the tip), kept to their lengths and pushed off the head and shoulders. Each clump is drawn
// as three crossed cards. Plain arrays, no three.js: the page feeds it the body's matrix (column-major 4x4, as three.js
// keeps it) so a turning, nodding head swings it; the chains go to Unreal later as bone chains (the export's JSON).
//   const w = new Wig(strands, push, centre, scale, rand, every, guard);  w.step(dt, M, Minv, settings);  w.cards(G) / w.local()

const SET = { gravity: 1, hold: 0.25, damping: 0.97, width: 0.024, iterations: 4 };
const apply = (M, x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
const turn = (M, x, y, z) => [M[0] * x + M[4] * y + M[8] * z, M[1] * x + M[5] * y + M[9] * z, M[2] * x + M[6] * y + M[10] * z];
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export class Wig {
  constructor(strands, push, centre, scale, rand = Math.random, every = 2, guard = q => q) {
    this.push = push; this.C = centre; this.S = scale; this.guard = guard;
    strands = strands.map(s => {                         // the pinned points all, then every other one (about 2.4 cm)
      const pts = s.pts.filter((p, k) => k < s.pin || (k - s.pin) % every === 0 || k === s.pts.length - 1);
      return { ...s, pts };
    });
    this.chains = [];
    let n = 0;
    for (const s of strands) { this.chains.push({ at: n, count: s.pts.length, pin: Math.min(s.pin, s.pts.length - 1), tail: s.tail, bang: s.bang, spin: s.spin, shade: 0.85 + 0.3 * rand() }); n += s.pts.length; }
    this.n = n;
    this.R = new Float32Array(n * 3);                    // the style's shape, in the body's frame
    for (const [c, s] of this.chains.map((c, i) => [c, strands[i]])) s.pts.forEach((p, k) => this.R.set(p, (c.at + k) * 3));
    this.P = Float32Array.from(this.R); this.Q = Float32Array.from(this.R);
    this.L = new Float32Array(n);                        // each point's distance to the one before it
    for (const c of this.chains) for (let k = 1; k < c.count; k++) {
      const i = (c.at + k) * 3, j = i - 3;
      this.L[c.at + k] = Math.hypot(this.R[i] - this.R[j], this.R[i + 1] - this.R[j + 1], this.R[i + 2] - this.R[j + 2]);
    }
    this.M = ID; this.started = false;
  }

  // one step of dt seconds with the body at matrix M (and its inverse)
  step(dt, M = ID, Minv = ID, set = {}) {
    const s = { ...SET, ...set }, { P, Q, R, L } = this, g = -9.81 * s.gravity * dt * dt;
    if (!this.started) {                                 // the first frame: everything where the style put it
      for (let i = 0; i < this.n; i++) { const p = apply(M, R[i * 3], R[i * 3 + 1], R[i * 3 + 2]); P.set(p, i * 3); Q.set(p, i * 3); }
      this.started = true;
    }
    for (const c of this.chains) {
      for (let k = 0; k < c.count; k++) {
        const i = (c.at + k) * 3, goal = apply(M, R[i], R[i + 1], R[i + 2]);
        if (k < c.pin) { Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2]; P.set(goal, i); continue; }
        const t = (k - c.pin) / Math.max(1, c.count - 1 - c.pin);
        const hold = c.bang ? Math.max(0.5, s.hold) : s.hold * (1 - t) ** 2 * (c.tail ? 0.4 : 1) + 0.003;   // bangs stay cut
        for (let a = 0; a < 3; a++) {
          const v = (P[i + a] - Q[i + a]) * s.damping;
          Q[i + a] = P[i + a];
          P[i + a] += v + (a === 1 ? g : 0);
          P[i + a] += (goal[a] - P[i + a]) * hold;
        }
      }
    }
    for (let it = 0; it < s.iterations; it++) {
      for (const c of this.chains) for (let k = Math.max(1, c.pin); k < c.count; k++) {
        const i = (c.at + k) * 3, j = i - 3;
        const dx = P[i] - P[j], dy = P[i + 1] - P[j + 1], dz = P[i + 2] - P[j + 2], d = Math.hypot(dx, dy, dz) || 1e-9;
        const e = (d - L[c.at + k]) / d, wj = k - 1 < c.pin ? 0 : 0.5, wi = 1 - wj;
        P[i] -= dx * e * wi; P[i + 1] -= dy * e * wi; P[i + 2] -= dz * e * wi;
        P[j] += dx * e * wj; P[j + 1] += dy * e * wj; P[j + 2] += dz * e * wj;
      }
      if (it !== 1 && it !== s.iterations - 1) continue;   // off the head and shoulders twice a step: in the body's frame, back out
      const gap = 0.002 * this.S;
      for (const c of this.chains) for (let k = c.pin; k < c.count; k++) {
        const i = (c.at + k) * 3, l0 = apply(Minv, P[i], P[i + 1], P[i + 2]), l = c.bang ? l0 : this.guard(l0);
        let [q, moved] = this.push(l, c.bang ? 0.002 * this.S : gap);
        moved = moved || l !== l0;
        if (moved) P.set(apply(M, q[0], q[1], q[2]), i);
      }
    }
    this.M = M;
  }

  // the clumps as cards (three crossed ribbons each) into G {position, uv, shade, index}; in the body's frame if local
  cards(G, width = SET.width, local = false, Minv = ID) {
    const { P } = this, S = this.S, W = width * S;
    const C = local ? this.C : apply(this.M, ...this.C);
    const at = i => local ? apply(Minv, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) : [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    const up = local ? [0, 1, 0] : turn(this.M, 0, 1, 0);
    for (const c of this.chains) {
      const pts = []; for (let k = 0; k < c.count; k++) pts.push(at(c.at + k));
      const spin = c.spin ? (local ? c.spin : turn(this.M, ...c.spin)) : null;
      const flat = new Float32Array(c.count);
      const across = pts.map((q, k) => {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(c.count - 1, k + 1)];
        let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(...t) || 1; t = t.map(v => v / tl);
        let o = [q[0] - C[0], q[1] - C[1], q[2] - C[2]];
        const h = o[0] * up[0] + o[1] * up[1] + o[2] * up[2];
        flat[k] = c.tail && k > 9 ? 1 : Math.min(1, Math.max(0, -h / (0.07 * S)));        // on the skull only the card lying on it
        if (h < -0.12 * S) o = [o[0] - up[0] * h, o[1] - up[1] * h, o[2] - up[2] * h];   // below the head: out from the body
        if (spin && k > 9) o = spin;
        let x = [t[1] * o[2] - t[2] * o[1], t[2] * o[0] - t[0] * o[2], t[0] * o[1] - t[1] * o[0]]; const xl = Math.hypot(...x) || 1; x = x.map(v => v / xl);
        const y = [t[1] * x[2] - t[2] * x[1], t[2] * x[0] - t[0] * x[2], t[0] * x[1] - t[1] * x[0]];
        return [x, y];
      });
      const w0 = W * (c.bang ? 0.6 : c.tail ? 0.8 : 1);
      for (const ang of [0, 1.0, -1.0]) {                // three cards round the clump's line
        const base = G.position.length / 3, cs = Math.cos(ang), sn = Math.sin(ang);
        for (let k = 0; k < c.count; k++) {
          const [x, y] = across[k], d = [x[0] * cs + y[0] * sn, x[1] * cs + y[1] * sn, x[2] * cs + y[2] * sn];
          const w = w0 * (ang ? 0.75 * flat[k] : 1) * (1 - 0.65 * (k / (c.count - 1)) ** 1.4) / 2, q = pts[k], v = 1 - k / (c.count - 1);
          G.position.push(q[0] - d[0] * w, q[1] - d[1] * w, q[2] - d[2] * w, q[0] + d[0] * w, q[1] + d[1] * w, q[2] + d[2] * w);
          G.uv.push(0, v, 1, v); G.shade.push(c.shade, c.shade);
        }
        for (let k = 0; k + 1 < c.count; k++) { const i = base + k * 2; G.index.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
      }
    }
    return G;
  }

  // the chains now, in the body's frame: for the export (bone chains in Unreal later)
  local(Minv = ID) {
    return this.chains.map(c => ({ pinned: c.pin, tail: c.tail, bang: c.bang,
      points: Array.from({ length: c.count }, (_, k) => apply(Minv, ...this.P.subarray((c.at + k) * 3, (c.at + k) * 3 + 3)).map(v => +v.toFixed(5))) }));
  }

  // how far the clumps hang from the style now (mean, m) and how many points sit inside the body
  measure(Minv = ID) {
    let drift = 0, inside = 0, free = 0, nan = false;
    for (const c of this.chains) for (let k = c.pin; k < c.count; k++) {        // the free points (the pinned sit on the scalp)
      const i = c.at + k, l = apply(Minv, this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]);
      if (l.some(Number.isNaN)) nan = true;
      drift += Math.hypot(l[0] - this.R[i * 3], l[1] - this.R[i * 3 + 1], l[2] - this.R[i * 3 + 2]); free++;
      if (this.push(l, 0)[1]) inside++;
    }
    return { clumps: this.chains.length, points: this.n, drift_mm: Math.round(drift / free * 10000) / 10, inside_pct: Math.round(1000 * inside / free) / 10, nan };
  }
}
