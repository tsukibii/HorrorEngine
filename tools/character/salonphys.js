// The salon's physics (docs/SALON_PLAN.md, game-grade): a lock with physics on swings on short chains, its own control
// curves: a strand's points, a bundle's spine, a sheet's three edges. Each chain's root is pinned to the head; the rest
// are Verlet points held towards the lock's styled shape (so a still head keeps the style exactly), swung by the head's
// motion, pulled by gravity only as far as the head is tilted from upright, rustled by a wind with no direction, kept
// their lengths, pushed off the body. No bending springs, no solver. Plain arrays, no three.js.
//
//   const sim = new Sim(locks, col)      the locks with physics on
//   sim.step(M, Minv, Rrig, t, dt)        M / Minv: local -> world and back (functions of a point); Rrig: the head's
//                                         turn from upright (3x3 rows); returns nothing
//   sim.pose(lock) -> a copy of the lock with its chains where the sim has them (local), for evaluate()

import { add, sub, mul, len, dot } from "./salonlib.js";

export const DEFAULTS = { on: false, stiffness: 0.4, damping: 0.92, gravity: 1, rustle: 0 };
export const holdOf = s => 0.02 + 0.3 * s * s;                            // stiffness (0 floppy, 1 stiff) -> pull to rest per step

export function chainsOf(lock) {                                          // [path into the lock, points]
  if (lock.type === "strand") return [["pts", lock.pts]];
  if (lock.type === "bundle") return [["spine", lock.spine]];
  return lock.edges.map((E, k) => [`edges.${k}`, E]);
}

// drop: every lock falls (physics on or not), nothing holds it to its style, gravity pulls straight down (opts.down, in
// the space the step works in), until it lies or hangs; the step's points are recorded for scrubbing
export class Sim {
  constructor(locks, col, opts = {}) {
    this.col = col; this.items = []; this.drop = !!opts.drop; this.down = opts.down || [0, -1, 0]; this.strength = opts.strength ?? 1; this.friction = opts.friction || 0;
    for (const l of locks) {
      const ph = Object.assign({}, DEFAULTS, l.physics || {}); if (!ph.on && !this.drop) continue;
      if (this.drop) Object.assign(ph, { stiffness: 0, damping: 0.965, gravity: this.strength, rustle: 0 });
      const chains = chainsOf(l).map(([path, P]) => ({ path, rest: P.map(p => p.slice()), x: null, xp: null, L: P.slice(1).map((p, i) => len(sub(p, P[i]))) }));
      // a sheet's neighbouring edges keep their spacing point by point (so it swings as one sheet)
      const ties = [];
      if (l.type === "sheet") for (let k = 0; k + 1 < chains.length; k++) for (let i = 1; i < chains[k].rest.length; i++) ties.push([k, k + 1, i, len(sub(chains[k].rest[i], chains[k + 1].rest[i]))]);
      this.items.push({ id: l.id, ph, chains, ties, phase: [...String(l.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 97 / 15 });
    }
  }
  has(id) { return this.items.some(it => it.id === id); }
  step(M, Minv, Rrig, t, dt = 1 / 60) {
    const down = [0, -1, 0], restDown = [Rrig[0][1] * -1, Rrig[1][1] * -1, Rrig[2][1] * -1];   // the head's own "down", in the world
    for (const it of this.items) {
      const { ph } = it, hold = this.drop ? 0 : holdOf(ph.stiffness), g = this.drop ? mul(this.down, 9.8 * ph.gravity * dt * dt) : mul(sub(down, restDown), 9.8 * ph.gravity * dt * dt);
      const ph0 = it.phase, wind = ph.rustle ? mul([Math.sin(1.7 * t + ph0) * Math.sin(0.53 * t + 2 * ph0), 0.3 * Math.sin(2.3 * t + 3 * ph0), Math.sin(1.31 * t + 0.7 * ph0) * Math.cos(0.71 * t + ph0)], ph.rustle * 2.5 * dt * dt) : [0, 0, 0];
      for (const c of it.chains) {
        const target = c.rest.map(p => M(p));
        if (!c.x) { c.x = target.map(p => p.slice()); c.xp = target.map(p => p.slice()); }
        c.x[0] = target[0]; c.xp[0] = target[0];
        const n = c.x.length;
        for (let i = 1; i < n; i++) {
          const v = mul(sub(c.x[i], c.xp[i]), ph.damping), f = i / (n - 1);
          c.xp[i] = c.x[i];
          let q = add(add(c.x[i], v), add(g, mul(wind, f)));
          q = add(q, mul(sub(target[i], q), hold));
          c.x[i] = q;
        }
      }
      for (let iter = 0; iter < (this.drop ? 6 : 3); iter++) {
        for (const c of it.chains) for (let i = 1; i < c.x.length; i++) {           // lengths, root to tip: the child moves
          const d = sub(c.x[i], c.x[i - 1]), l = len(d) || 1e-9; c.x[i] = add(c.x[i - 1], mul(d, c.L[i - 1] / l));
        }
        for (const [a, b, i, L] of it.ties) {                                       // a sheet's edges together, softly
          const A = it.chains[a].x, B = it.chains[b].x, d = sub(B[i], A[i]), l = len(d) || 1e-9, k = (l - L) / l * 0.25;
          A[i] = add(A[i], mul(d, k)); B[i] = sub(B[i], mul(d, k));
        }
      }
      for (const c of it.chains) for (let i = 1; i < c.x.length; i++) {             // off the body (in the head's space)
        const p = Minv(c.x[i]), [q, moved] = this.col.push(p, this.drop ? 0.0025 : 0.006); if (!moved) continue;
        c.x[i] = M(this.friction ? this.rub(p, q, Minv(c.xp[i])) : q);
      }
    }
  }
  // friction where a point touches (position-based Coulomb, as in Mueller et al.'s unified particles): its slide along
  // the surface this step held back, all of it while the slide is under friction x how far it was pushed out (static),
  // else that much of it; so hair lying where the slope is under atan(friction) stays put and steeper hair slides
  rub(p, q, prev) {
    const nv = sub(q, p), d = len(nv); if (d < 1e-12) return q;
    const n = mul(nv, 1 / d), mv = sub(q, prev), tg = sub(mv, mul(n, dot(mv, n))), tl = len(tg); if (tl < 1e-12) return q;
    return sub(q, mul(tg, Math.min(1, this.friction * d / tl)));
  }
  reset() { for (const it of this.items) for (const c of it.chains) { c.x = null; c.xp = null; } }
  // every chain point now, flat (a recorded frame), and back
  snapshot() { const out = []; for (const it of this.items) for (const c of it.chains) for (const p of c.x || c.rest) out.push(p[0], p[1], p[2]); return Float32Array.from(out); }
  restoreFrame(f) { let k = 0; for (const it of this.items) for (const c of it.chains) { c.x = c.rest.map(() => [f[k++], f[k++], f[k++]]); c.xp = c.x.map(p => p.slice()); } }
  speed() { let m = 0; for (const it of this.items) for (const c of it.chains) if (c.x) for (let i = 1; i < c.x.length; i++) m = Math.max(m, len(sub(c.x[i], c.xp[i]))); return m; }
  pose(lock, Minv) {                                                        // the lock as the sim has it, in local space
    const it = this.items.find(x => x.id === lock.id); if (!it || !it.chains[0].x) return lock;
    const out = JSON.parse(JSON.stringify(lock));
    for (const c of it.chains) {
      const P = c.x.map(p => Minv(p));
      if (c.path === "pts") out.pts = P; else if (c.path === "spine") out.spine = P; else out.edges[+c.path.split(".")[1]] = P;
    }
    return out;
  }
  // how far the lock's tips are from rest (local metres): the jiggle, for the checks
  tipOffset(lock, Minv) {
    const it = this.items.find(x => x.id === lock.id); if (!it || !it.chains[0].x) return 0;
    let m = 0; for (const c of it.chains) { const n = c.x.length; m = Math.max(m, len(sub(Minv(c.x[n - 1]), c.rest[n - 1]))); }
    return m;
  }
}

// the bones a baked lock gets: per chain, its points (local), and per evaluated guide sample, which chain(s) and joints
// carry it with what weight (up to 4 influences: two chains across a sheet, two joints along)
export function skinOf(lock, guides) {
  const chains = chainsOf(lock).map(([, P]) => P), J = chains[0].length, out = [];
  guides.forEach((G, gi) => {
    const n = G.pts.length, u = G.u ?? (guides.length > 1 ? gi / (guides.length - 1) : 0.5);   // across the lock (a thick one's dome too)
    let across;                                                          // [chain, weight] pairs
    if (lock.type === "sheet") across = u < 0.5 ? [[0, 1 - 2 * u], [1, 2 * u]] : [[1, 2 - 2 * u], [2, 2 * u - 1]];
    else across = [[0, 1]];
    out.push(G.pts.map((_, k) => {
      const t = (G.t ? G.t[k] : k / (n - 1)) * (J - 1), j = Math.min(J - 2, Math.floor(t)), f = t - j, w = [];   // the sample's place on the chain
      for (const [c, wc] of across) { if (wc > 1e-6) { w.push([c * J + j, wc * (1 - f)]); w.push([c * J + j + 1, wc * f]); } }
      return w.filter(x => x[1] > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4);
    }));
  });
  return { chains, J, weights: out };
}
