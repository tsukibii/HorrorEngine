// Wigify: a hair-only model (GLB, FBX or OBJ: CC0 or our own) worn as a wig. Fitted to this head by its crown (the
// band across the top of the skull: width, top, front to back), then six handles: the crown moves it, left, right,
// front and back widen or narrow each side, the length stretches what hangs below the ears. The top is locked to the
// head (it can't slip off), the rest swings: a light cage of particles (a few hundred, not every vertex) with gravity,
// held loosely to the fitted shape, kept to their spacing and pushed off the head and shoulders (hair.js's collision,
// the skin itself); every vertex rides its nearest particles. Plain arrays, no three.js, like wig.js.
//   const fit = fitModel(base, head, settings)  -> { R (the fitted points, body frame), handles }
//   const w = new ModelWig(R, push, head, scale, lock);  w.step(dt, M, Minv, set);  w.positions(out, M)

export const FIT = { move: [0, 0, 0], left: 1, right: 1, front: 1, back: 1, length: 1, yaw: 0 };
export const SET = { gravity: 1, hold: 0.3, damping: 0.96, iterations: 4, lock: 0.45 };
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const apply = (M, x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// the model's points as metres, Y up, facing +Z: centimetre models (taller than 3 units) scaled down, turned by yaw
export function normalise(P, yaw = 0) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  const k = hi - lo > 3 ? 0.01 : hi - lo < 0.03 ? 100 : 1, c = Math.cos(yaw * Math.PI / 180), s = Math.sin(yaw * Math.PI / 180);
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i] * k, y = P[i + 1] * k, z = P[i + 2] * k;
    out[i] = c * x + s * z; out[i + 1] = y; out[i + 2] = -s * x + c * z;
  }
  return out;
}

// the head's crown band from the body's points: its middle (across, front to back), its width and depth, its top (all
// in the head frame from hair.js: X across, U up, F forward, C the skull's middle at the ears)
export function headBand(pos, fr, S) {
  let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity, top = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - fr.C[0], pos[i + 1] - fr.C[1], pos[i + 2] - fr.C[2]];
    if (Math.hypot(d[0], d[1], d[2]) > 0.16 * S) continue;
    const b = dot(d, fr.U); top = Math.max(top, b);
  }
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - fr.C[0], pos[i + 1] - fr.C[1], pos[i + 2] - fr.C[2]];
    if (Math.hypot(d[0], d[1], d[2]) > 0.16 * S) continue;
    const b = dot(d, fr.U); if (b < top - 0.1 * S || b < 0.02 * S) continue;
    const a = dot(d, fr.X), c = dot(d, fr.F);
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
  }
  return { a: (a0 + a1) / 2, c: (c0 + c1) / 2, width: a1 - a0, depth: c1 - c0, top };
}

// the model on the head: scaled so its crown band is the head's plus a little hair, its top just over the head's,
// centred on the skull; then the handles (fit) about the skull's middle. Returns the points in the body's frame and
// where the six handles sit.
export function fitModel(base, fr, band, S, fit = FIT) {
  const n = base.length / 3;
  let top = -Infinity;
  for (let i = 1; i < base.length; i += 3) top = Math.max(top, base[i]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < base.length; i += 3) if (base[i + 1] > top - 0.1) {     // the model's own top 10 cm
    x0 = Math.min(x0, base[i]); x1 = Math.max(x1, base[i]); z0 = Math.min(z0, base[i + 2]); z1 = Math.max(z1, base[i + 2]);
  }
  const s = Math.min(3, Math.max(0.3, band.width * 1.1 / Math.max(1e-6, x1 - x0)));   // a centimetre or so of hair each side
  const ax = (x0 + x1) / 2, az = (z0 + z1) / 2;
  const R = new Float32Array(base.length), mv = fit.move || [0, 0, 0];
  const lift = band.top + 0.008 * S;
  let ext = { left: 0, right: 0, front: 0, back: 0, low: 0, high: -Infinity };
  for (let i = 0; i < n; i++) {
    let a = (base[i * 3] - ax) * s + band.a, b = (base[i * 3 + 1] - top) * s + lift, c = (base[i * 3 + 2] - az) * s + band.c;
    a = band.a + (a - band.a) * (a > band.a ? fit.left : fit.right);           // +X is the character's left
    c = band.c + (c - band.c) * (c > band.c ? fit.front : fit.back);
    if (b < 0) b *= fit.length;                                                // below the ears: the length
    ext.left = Math.max(ext.left, a - band.a); ext.right = Math.max(ext.right, band.a - a);
    ext.front = Math.max(ext.front, c - band.c); ext.back = Math.max(ext.back, band.c - c);
    ext.low = Math.min(ext.low, b); ext.high = Math.max(ext.high, b);
    for (let k = 0; k < 3; k++) R[i * 3 + k] = fr.C[k] + fr.X[k] * a + fr.U[k] * b + fr.F[k] * c + mv[k];
  }
  const at = (a, b, c) => [0, 1, 2].map(k => fr.C[k] + fr.X[k] * a + fr.U[k] * b + fr.F[k] * c + mv[k]);
  const mid = band.top * 0.55;
  const handles = {                                   // [where, the axis it pulls along, its extent from the middle]
    crown: { at: at(band.a, ext.high, band.c), axis: fr.U, extent: ext.high },
    left: { at: at(band.a + ext.left, mid, band.c), axis: fr.X, extent: ext.left },
    right: { at: at(band.a - ext.right, mid, band.c), axis: fr.X.map(v => -v), extent: ext.right },
    front: { at: at(band.a, mid, band.c + ext.front), axis: fr.F, extent: ext.front },
    back: { at: at(band.a, mid, band.c - ext.back), axis: fr.F.map(v => -v), extent: ext.back },
    length: { at: at(band.a, Math.min(ext.low, 0), band.c - ext.back * 0.5), axis: fr.U.map(v => -v), extent: -Math.min(ext.low, -1e-3) },
  };
  return { R, handles, scale: s };
}

// push the fitted points out of the head and body: no clipping at rest. Returns how many moved.
export function unclip(R, push, gap) {
  let moved = 0;
  for (let i = 0; i < R.length; i += 3) {
    const [q, m] = push([R[i], R[i + 1], R[i + 2]], gap);
    if (m) { R[i] = q[0]; R[i + 1] = q[1]; R[i + 2] = q[2]; moved++; }
  }
  return moved;
}

export class ModelWig {
  constructor(R, push, fr, S, lock = SET.lock) {
    this.push = push; this.S = S; this.Rv = R; this.nv = R.length / 3;
    // the cage: the points gathered into cells (about 2.5 cm; bigger when the model is big), one particle per cell
    let cell = 0.025 * S, cells;
    for (let tries = 0; tries < 6; tries++, cell *= 1.3) {
      cells = new Map();
      for (let i = 0; i < this.nv; i++) {
        const key = `${Math.floor(R[i * 3] / cell)},${Math.floor(R[i * 3 + 1] / cell)},${Math.floor(R[i * 3 + 2] / cell)}`;
        let c = cells.get(key); if (!c) cells.set(key, c = { sum: [0, 0, 0], n: 0 });
        c.sum[0] += R[i * 3]; c.sum[1] += R[i * 3 + 1]; c.sum[2] += R[i * 3 + 2]; c.n++;
      }
      if (cells.size <= 700) break;
    }
    this.cell = cell;
    const parts = [...cells.values()].map(c => c.sum.map(v => v / c.n));
    this.n = parts.length;
    this.R = new Float32Array(parts.flat()); this.P = Float32Array.from(this.R); this.Q = Float32Array.from(this.R);
    // the lock: particles on the top of the head, near the skull, are held to it (lock 0: the crown only, 1: down to the ears)
    const lockB = fr.top * (0.8 - 0.75 * lock);
    this.pin = new Uint8Array(this.n); this.hold = new Float32Array(this.n);
    let lowestPin = Infinity;
    for (let p = 0; p < this.n; p++) {
      const q = parts[p], d = [q[0] - fr.C[0], q[1] - fr.C[1], q[2] - fr.C[2]], b = dot(d, fr.U);
      const near = push(q, 0.03 * S)[1];
      if (b > lockB && near) { this.pin[p] = 1; lowestPin = Math.min(lowestPin, b); }
    }
    if (lowestPin === Infinity) lowestPin = fr.top;
    for (let p = 0; p < this.n; p++) {                   // the hold fades below the lock: loose ends swing most
      const q = parts[p], b = dot([q[0] - fr.C[0], q[1] - fr.C[1], q[2] - fr.C[2]], fr.U);
      const t = Math.min(1, Math.max(0, (lowestPin - b) / (0.3 * S)));
      this.hold[p] = (1 - t) ** 2;
    }
    // springs: each particle to its nearest few, at their fitted spacing
    const grid = new Map(), gk = (x, y, z) => `${x},${y},${z}`;
    for (let p = 0; p < this.n; p++) {
      const k = gk(...[0, 1, 2].map(a => Math.floor(this.R[p * 3 + a] / cell)));
      if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p);
    }
    const near = (x, y, z, r) => {                       // particles within r of a point, nearest first
      const out = [], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell), m = Math.ceil(r / cell);
      for (let i = -m; i <= m; i++) for (let j = -m; j <= m; j++) for (let k = -m; k <= m; k++) {
        for (const p of grid.get(gk(cx + i, cy + j, cz + k)) || []) {
          const d = Math.hypot(this.R[p * 3] - x, this.R[p * 3 + 1] - y, this.R[p * 3 + 2] - z);
          if (d <= r) out.push([d, p]);
        }
      }
      return out.sort((a, b) => a[0] - b[0]);
    };
    const seen = new Set(), E = [];
    for (let p = 0; p < this.n; p++) {
      for (const [d, q] of near(this.R[p * 3], this.R[p * 3 + 1], this.R[p * 3 + 2], cell * 2.2).slice(1, 9)) {
        const k = p < q ? p * 1e6 + q : q * 1e6 + p;
        if (seen.has(k)) continue; seen.add(k); E.push(p, q, d);
      }
    }
    this.E = Float32Array.from(E);
    // every vertex rides its nearest particles (up to four, by inverse distance)
    this.W = new Float32Array(this.nv * 4); this.I = new Int32Array(this.nv * 4).fill(-1);
    for (let v = 0; v < this.nv; v++) {
      let got = near(R[v * 3], R[v * 3 + 1], R[v * 3 + 2], cell * 1.8).slice(0, 4);
      if (!got.length) got = near(R[v * 3], R[v * 3 + 1], R[v * 3 + 2], cell * 6).slice(0, 1);
      let sum = 0; const w = got.map(([d]) => 1 / (d + 0.002 * S)); w.forEach(x => { sum += x; });
      got.forEach(([, p], k) => { this.I[v * 4 + k] = p; this.W[v * 4 + k] = w[k] / sum; });
    }
    this.started = false; this.M = ID;
    this.report = { vertices: this.nv, particles: this.n, locked: this.pin.reduce((a, b) => a + b, 0), springs: this.E.length / 3, cell_cm: Math.round(cell * 1000) / 10 };
  }

  step(dt, M = ID, Minv = ID, set = {}) {
    const s = { ...SET, ...set }, { P, Q, R, E } = this, g = -9.81 * s.gravity * dt * dt;
    if (!this.started) { for (let p = 0; p < this.n; p++) { const q = apply(M, R[p * 3], R[p * 3 + 1], R[p * 3 + 2]); P.set(q, p * 3); Q.set(q, p * 3); } this.started = true; }
    for (let p = 0; p < this.n; p++) {
      const i = p * 3, goal = apply(M, R[i], R[i + 1], R[i + 2]);
      if (this.pin[p]) { Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2]; P.set(goal, i); continue; }
      const hold = s.hold * this.hold[p] + 0.004;
      for (let a = 0; a < 3; a++) {
        const v = (P[i + a] - Q[i + a]) * s.damping;
        Q[i + a] = P[i + a];
        P[i + a] += v + (a === 1 ? g : 0);
        P[i + a] += (goal[a] - P[i + a]) * hold;
      }
    }
    for (let it = 0; it < s.iterations; it++) {
      for (let e = 0; e < E.length; e += 3) {
        const p = E[e] * 3, q = E[e + 1] * 3, wp = this.pin[E[e]] ? 0 : 1, wq = this.pin[E[e + 1]] ? 0 : 1;
        if (!wp && !wq) continue;
        const dx = P[q] - P[p], dy = P[q + 1] - P[p + 1], dz = P[q + 2] - P[p + 2], d = Math.hypot(dx, dy, dz) || 1e-9;
        const k = (d - E[e + 2]) / d / (wp + wq);
        P[p] += dx * k * wp; P[p + 1] += dy * k * wp; P[p + 2] += dz * k * wp;
        P[q] -= dx * k * wq; P[q + 1] -= dy * k * wq; P[q + 2] -= dz * k * wq;
      }
      if (it !== 1 && it !== s.iterations - 1) continue;   // off the head and shoulders twice a step, in the body's frame
      for (let p = 0; p < this.n; p++) {
        if (this.pin[p]) continue;
        const i = p * 3, l = apply(Minv, P[i], P[i + 1], P[i + 2]), [q, moved] = this.push(l, 0.004 * this.S);
        if (moved) P.set(apply(M, q[0], q[1], q[2]), i);
      }
    }
    this.M = M;
  }

  // every vertex where it rests (moved with the body) plus its particles' swing
  positions(out, M = this.M) {
    const { Rv, R, P, W, I } = this;
    const D = new Float32Array(this.n * 3);
    for (let p = 0; p < this.n; p++) { const g = apply(M, R[p * 3], R[p * 3 + 1], R[p * 3 + 2]); D[p * 3] = P[p * 3] - g[0]; D[p * 3 + 1] = P[p * 3 + 1] - g[1]; D[p * 3 + 2] = P[p * 3 + 2] - g[2]; }
    for (let v = 0; v < this.nv; v++) {
      const r = apply(M, Rv[v * 3], Rv[v * 3 + 1], Rv[v * 3 + 2]);
      for (let k = 0; k < 4; k++) {
        const p = I[v * 4 + k]; if (p < 0) break;
        const w = W[v * 4 + k]; r[0] += D[p * 3] * w; r[1] += D[p * 3 + 1] * w; r[2] += D[p * 3 + 2] * w;
      }
      out[v * 3] = r[0]; out[v * 3 + 1] = r[1]; out[v * 3 + 2] = r[2];
    }
    return out;
  }

  // how far the locked particles drifted off the head, how far the loose ones swing, how many are inside it (the check's numbers)
  measure(M = this.M, Minv = ID) {
    let drift = 0, swing = 0, inside = 0;
    for (let p = 0; p < this.n; p++) {
      const i = p * 3, g = apply(M, this.R[i], this.R[i + 1], this.R[i + 2]), d = Math.hypot(this.P[i] - g[0], this.P[i + 1] - g[1], this.P[i + 2] - g[2]);
      if (this.pin[p]) drift = Math.max(drift, d);
      else { swing = Math.max(swing, d); if (this.push(apply(Minv, this.P[i], this.P[i + 1], this.P[i + 2]), 0)[1]) inside++; }
    }
    return { drift_mm: Math.round(drift * 10000) / 10, swing_mm: Math.round(swing * 10000) / 10, inside };
  }
}
