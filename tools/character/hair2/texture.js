// Texture: what's done to the traced hairs to make them read as hair (the hair editor v2.0, docs/HAIR_V2.md §3.7), in
// Blender's own order for hair (clump, curl, noise):
//   clumps   the pores gather in small groups round a guide hair (the first few of the ranked pores: evenly spread); a
//            group's hairs draw together toward their tips. What makes waves and curls read as locks, and tips as points
//   waves    a size, a length, where down the hair they start; one phase a clump, so a lock waves together
//   curls    the lock winds round its own middle (a radius, a pitch); the card's width lies along the lock, a ringlet
//   frizz    fine noise, more toward the tips
//   strays   single wisps standing off the surface, grown from hairs already there
// then everything kept off the body again. Plain arrays; the head's local space.
//
//   clumpsOf(ctx)   -> { of (each hair's clump), n }      which clump each pore's hair is in (before tracing: Messy turns a clump's way)
//   texture(ctx)    changes ctx.pts in place; -> { axis (3 a kept point: a curl's middle line's way, zeros elsewhere), strays: { pts, len, u, n } }
import { dist, grad } from "./sdf.js";
import { K, TS, GAP, hash } from "./strands.js";
import { partingSide, partingShare, sagittal, FRAME } from "./flow.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ctx: { n, pos, group, C, s, spacing, size (a clump's width, m) }
export function clumpsOf(ctx) {
  const { n, pos, group, s, C } = ctx, size = Math.max(ctx.spacing * 1.2, ctx.size || 0.018), m = clamp(Math.round(n * (ctx.spacing / size) ** 2), 1, n), of = new Int32Array(n);
  const cell = size * 1.5, grid = new Map(), key = (x, y, z) => ((Math.floor(x / cell) + 512) << 20) | ((Math.floor(y / cell) + 512) << 10) | (Math.floor(z / cell) + 512);
  for (let c = 0; c < m; c++) { const q = key(pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]); (grid.get(q) || grid.set(q, []).get(q)).push(c); }
  const parted = s.parting && s.parting.kind !== "none", sideOf = i => partingSide(s, pos[i * 3], pos[i * 3 + 2]) >= 0, inPart = i => parted && partingShare(s, sagittal(pos[i * 3 + 1], pos[i * 3 + 2], C)) > 0.5;
  for (let i = 0; i < n; i++) {
    if (i < m) { of[i] = i; continue; }
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; let best = -1, bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const g = grid.get(key(x + a * cell, y + b * cell, z + c * cell)); if (!g) continue;
      for (const j of g) {
        if (group[j] !== group[i]) continue;
        if (inPart(i) && sideOf(i) !== sideOf(j)) continue;               // never across the parting
        const d = Math.hypot(pos[j * 3] - x, pos[j * 3 + 1] - y, pos[j * 3 + 2] - z); if (d < bd) { bd = d; best = j; }
      }
    }
    of[i] = best < 0 ? i : best;                                           // none near: its own clump
  }
  return { of, n: m };
}

// ctx: { n, pts, len, u, group, clump: { of }, S, C, s (settings), spacing }
export function texture(ctx) {
  const { n, pts, len, u, S, C, clump } = ctx, tx = ctx.s.texture || {}, wet = clamp(tx.wet || 0, 0, 1);
  const cAmt = clamp(Math.max(tx.clump ?? 0.3, wet * 0.9), 0, 0.97), wave0 = Math.max(0, tx.wave || 0), wl = Math.max(0.02, tx.waveLength || 0.09), ws = clamp(tx.waveStart ?? 0.3, 0, 0.9);
  const curl = clamp(tx.curl || 0, 0, 1), cr = Math.max(0.003, tx.curlRadius || 0.012), frizz = clamp(tx.frizz ?? 0.15, 0, 1) * (1 - 0.8 * wet);
  const g = [0, 0, 0], axis = curl > 0 ? new Float32Array(n * K * 3) : null;
  // ---- clumps: each hair toward its clump's guide, more toward the tip
  if (cAmt > 0 || ctx.clumpAmt) {
    const src = new Float32Array(pts), far = Math.max(0.02, 1.4 * (tx.clumpSize || 0.018));
    for (let i = 0; i < n; i++) {
      const c = clump.of[i]; if (c === i || !(len[i] > 0) || !(len[c] > 0)) continue;
      const amt = ctx.clumpAmt && ctx.clumpAmt[i] > 0 ? ctx.clumpAmt[i] : cAmt * (0.75 + 0.25 * hash(u[i], 21));   // (clumpAmt: a tendril's hairs drawn to its point, whatever the rest of the hair does)
      for (let k = 1; k < K; k++) {
        const o = (i * K + k) * 3, q = (c * K + k) * 3, dx = src[q] - src[o], dy = src[q + 1] - src[o + 1], dz = src[q + 2] - src[o + 2];
        // (only while they travel together: a hair whose guide went another way round the head, at the whorl or by a tie, isn't dragged across the head, or the face, after it)
        const f = amt * Math.pow(smooth(0.08, 1, TS[k]), 0.8) * (1 - smooth(far, far * 2.2, Math.hypot(dx, dy, dz)));
        pts[o] = src[o] + dx * f; pts[o + 1] = src[o + 1] + dy * f; pts[o + 2] = src[o + 2] + dz * f;
      }
    }
  }
  // ---- waves, curls, frizz: each kept point moved across the hair and out of it
  const fw = Math.max(0, (ctx.s.fringe && ctx.s.fringe.frameWave) || 0);   // Tendrils, wave: an S along each face-framing lock, its own
  if (wave0 > 0 || curl > 0 || frizz > 0 || fw > 0) {
    const src = new Float32Array(pts);
    for (let i = 0; i < n; i++) {
      const L = len[i]; if (!(L > 0.02)) continue;
      const isF = fw > 0 && ctx.group[i] === FRAME, wave = isF ? Math.max(wave0, fw) : wave0;
      const c = clump.of[i], tg = isF ? 0 : clamp(tx.together ?? 0.5, 0, 1), o0 = i * K * 3, azr = Math.atan2(src[o0] - C[0], src[o0 + 2] - C[2]);
      // a clump's place in the wave: its own (a head of separate curls), or in step with its neighbours round the head (waves that run across the hair)
      const pc = (1 - tg) * hash(u[c], 31) * 6.2832 + tg * (1.2 * Math.sin(azr * 1.5 + 0.7) + 0.7 * (hash(u[c], 31) - 0.5)), own = (hash(u[i], 32) - 0.5) * 0.7 * (1 - 0.8 * tg), hand = hash(u[c], 33) < 0.5 ? 1 : -1;
      const f1 = 180 + 220 * hash(u[i], 34), f2 = 90 + 150 * hash(u[i], 35), p1 = hash(u[i], 36) * 6.28, p2 = hash(u[i], 37) * 6.28;
      const lam = (isF ? 0.15 : wl) * (0.85 + 0.3 * hash(u[c], 38)), start = isF ? Math.min(ws * L, 0.035) : ws * L, pitch = 2 * Math.PI * cr * 1.25;
      for (let k = 1; k < K; k++) {
        const o = (i * K + k) * 3, a = (i * K + Math.max(0, k - 1)) * 3, b = (i * K + Math.min(K - 1, k + 1)) * 3, sAt = TS[k] * L;
        let tx0 = src[b] - src[a], ty0 = src[b + 1] - src[a + 1], tz0 = src[b + 2] - src[a + 2]; const tl = Math.hypot(tx0, ty0, tz0) || 1; tx0 /= tl; ty0 /= tl; tz0 /= tl;
        const x = src[o], y = src[o + 1], z = src[o + 2];
        let ox, oy, oz; if (dist(S, x, y, z) < S.band * 0.8 && grad(S, x, y, z, g)) { ox = g[0]; oy = g[1]; oz = g[2]; } else { ox = x - C[0]; oy = 0; oz = z - C[2]; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l; }
        let lx = ty0 * oz - tz0 * oy, ly = tz0 * ox - tx0 * oz, lz = tx0 * oy - ty0 * ox; const ll = Math.hypot(lx, ly, lz) || 1; lx /= ll; ly /= ll; lz /= ll;   // across the hair, in its surface
        ox = ly * tz0 - lz * ty0; oy = lz * tx0 - lx * tz0; oz = lx * ty0 - ly * tx0;                                                                            // out of it, square to both
        let da = 0, dout = 0;
        if (wave > 0 && sAt > start) {
          // in step: the wave runs by height, in and out of the hair's surface, so its ridges lie across the hair and the cards stay side by side;
          // each on its own: by how far along the hair, across it (separate S-shaped locks)
          // (and not over the top of the head: waves begin where the hair comes down past the temples; up there they stood locks off the scalp like planks)
          const env = smooth(start, start + lam * 0.6, sAt) * (1 - smooth(0.04, 0.085, y)), ph = 2 * Math.PI * ((1 - tg) * (sAt - start) - tg * y) / lam + pc + own;
          dout += wave * env * (0.25 + 0.75 * tg) * (0.6 + Math.sin(ph)); da += wave * env * (1 - 0.7 * tg) * Math.sin(ph + 1.3);   // (more out than in: hair by the skin waves away from it)
        }
        if (curl > 0 && sAt > start) { const env = smooth(start, start + pitch * 0.7, sAt) * curl, th = hand * 2 * Math.PI * (sAt - start) / pitch + pc + own * 0.5; da += cr * env * Math.cos(th); dout += cr * env * (1 + Math.sin(th)); if (axis) { axis[o] = tx0 * env; axis[o + 1] = ty0 * env; axis[o + 2] = tz0 * env; } }
        if (frizz > 0) { const am = frizz * 0.0035 * (0.3 + 0.7 * TS[k]); da += am * Math.sin(f1 * sAt + p1); dout += am * 0.6 * Math.sin(f2 * sAt + p2); }
        pts[o] = x + lx * da + ox * dout; pts[o + 1] = y + ly * da + oy * dout; pts[o + 2] = z + lz * da + oz * dout;
      }
    }
  }
  settle(pts, n, len, S);
  // ---- strays: wisps grown from hairs already there, drifting out of the surface
  const want = Math.round((tx.strays || 0) * (1 - wet)), st = { n: 0, pts: new Float32Array(0), len: new Float32Array(0), u: new Float32Array(0), src: new Int32Array(0) };   // (src: the hair each wisp is grown from)
  if (want > 0 && n > 0) {
    st.pts = new Float32Array(want * K * 3); st.len = new Float32Array(want); st.u = new Float32Array(want); st.src = new Int32Array(want);
    let made = 0;
    for (let q = 0; q < want * 6 && made < want; q++) {
      const i = Math.floor(hash(q * 0.6180339 % 1, 41) * n), L = len[i]; if (!(L > 0.05) || ctx.group[i] !== 0 || (ctx.held && ctx.held[i])) continue;   // (held: hair tucked behind an ear lies tight; no wisp stands off it)
      const r1 = hash(u[i] + q * 0.013, 42), r2 = hash(u[i] + q * 0.017, 43), r3 = hash(u[i] + q * 0.019, 44), from = 0.05 + 0.4 * r1, top = pts[(i * K + Math.round(from * (K - 1))) * 3 + 1] > 0.085 ? 0.35 : 1, lift = (0.004 + 0.02 * r3 * r3) * top, side = (r2 - 0.5) * 0.02;   // (a wisp over the top of the head stands off it by millimetres: a halo of wires there is the first thing seen)
      let to = Math.min(1, from + 0.2 + 0.45 * r2);
      // a stray stands off hair in the air, never off hair lying on the neck, the shoulders or the chest: it ends where its hair comes to rest
      for (let k = K - 1; k > 1; k--) { const o = (i * K + k) * 3; if (TS[k] <= to) break; }
      { let stop = to; for (let k = 2; k < K; k++) { const o = (i * K + k) * 3; if (TS[k] > to) break; if (TS[k] > from && pts[o + 1] < -0.1 && dist(S, pts[o], pts[o + 1], pts[o + 2]) < 0.012) { stop = TS[k - 1]; break; } } to = stop; }
      if (to - from < 0.12) continue;
      for (let k = 0; k < K; k++) {
        const t = from + (to - from) * TS[k], x = t * (K - 1);
        // the place on the source hair at fraction t of its length (its kept points are at TS)
        let j = 0; while (j < K - 2 && TS[j + 1] < t) j++;
        const f = clamp((t - TS[j]) / (TS[j + 1] - TS[j]), 0, 1), a = (i * K + j) * 3, b = a + 3, o = (made * K + k) * 3;
        let px = pts[a] + (pts[b] - pts[a]) * f, py = pts[a + 1] + (pts[b + 1] - pts[a + 1]) * f, pz = pts[a + 2] + (pts[b + 2] - pts[a + 2]) * f;
        let ox, oy, oz; if (dist(S, px, py, pz) < S.band * 0.8 && grad(S, px, py, pz, g)) { ox = g[0]; oy = g[1]; oz = g[2]; } else { ox = px - C[0]; oy = 0; oz = pz - C[2]; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l; }
        const e = Math.pow(TS[k], 1.3); px += ox * lift * e + oz * side * e; py += oy * lift * e + 0.004 * e * (r1 - 0.3); pz += oz * lift * e - ox * side * e;
        st.pts[o] = px; st.pts[o + 1] = py; st.pts[o + 2] = pz; void x;
      }
      st.len[made] = L * (to - from); st.u[made] = hash(u[i] + q * 0.031, 45); st.src[made] = i; made++;
    }
    st.n = made; settle(st.pts, made, st.len, S);
  }
  return { axis, strays: st };
}

// every kept point but the root kept off the body
function settle(pts, n, len, S) {
  const g = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    if (!(len[i] > 0)) continue;
    for (let k = 1; k < K; k++) {
      const o = (i * K + k) * 3, d = dist(S, pts[o], pts[o + 1], pts[o + 2]);
      if (d < GAP && grad(S, pts[o], pts[o + 1], pts[o + 2], g)) { pts[o] += g[0] * (GAP - d); pts[o + 1] += g[1] * (GAP - d); pts[o + 2] += g[2] * (GAP - d); }
    }
  }
}
