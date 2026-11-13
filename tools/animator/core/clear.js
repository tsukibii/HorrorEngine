// Animator v2: a body that doesn't pass through itself (docs/ANIMATOR_V2.md §6). The trunk as the slabs it was
// measured in (each a rounded box: its half width, its depth, where its middle is), the thighs as tubes; an arm as a
// few balls from the elbow to the fingertips. Where a hanging, swinging arm would cut into the trunk or a thigh, the
// arm is carried further out from the shoulder, as a broad or a heavy body carries its arms: worked out a frame at a
// time, then made one smooth amount over the clip, so nothing twitches.
import { V, Q, clamp } from "./m.js";
import { build } from "./pose.js";
import { SIDES, SGN } from "./rig.js";

const POW = 2.6;                                              // a trunk's slab is squarer than an ellipse

/** the body's solid shapes, from its measures (`pad`: what's kept clear round them; `cover`: the measures of the body
    with its clothes on, when there are any: a jacket's thickness is kept clear too, up to 3 cm) */
export function proxies(rig, body, { pad = 0.008, cover = null } = {}) {
  const S = body.slabs, grow = k => { if (!cover) return 0; const c = cover.slabs.reduce((a, s) => (Math.abs(s.y - S[k].y) < Math.abs(a.y - S[k].y) ? s : a), cover.slabs[0]); return clamp(Math.max(c.a - S[k].a, c.b - S[k].b), 0, 0.03); };
  const slabs = S.map((s, k) => { const g = grow(k); return { y: s.y + body.floor, a: s.a + g, b: s.b + g, cx: s.cx, cz: s.cz }; });
  const split = body.floor + (body.levels.waist + body.levels.under) / 2;
  const thigh = {}; for (const s of SIDES) thigh[s] = body.limbs["thigh_" + s].bins.map(b => ({ f: b.f, r: Math.max(b.r, (b.lat + b.front) / 2) }));
  return { slabs, split, pad, thigh, rFore: body.r.fore || 0.035, rUpper: body.r.upper || 0.045, hand: body.hand, y0: slabs[0].y, y1: slabs[slabs.length - 1].y };
}
const slabAt = (X, y) => { const s = X.slabs, n = s.length; if (y <= s[0].y) return s[0]; if (y >= s[n - 1].y) return s[n - 1]; let i = Math.min(n - 2, Math.max(0, Math.floor((y - s[0].y) / (s[1].y - s[0].y)))); while (i > 0 && s[i].y > y) i--; while (i < n - 2 && s[i + 1].y < y) i++;
  const t = (y - s[i].y) / (s[i + 1].y - s[i].y), a = s[i], b = s[i + 1]; return { a: a.a + (b.a - a.a) * t, b: a.b + (b.b - a.b) * t, cx: a.cx + (b.cx - a.cx) * t, cz: a.cz + (b.cz - a.cz) * t }; };
const interp = (bins, f) => { if (f <= bins[0].f) return bins[0].r; for (let i = 0; i < bins.length - 1; i++) if (f <= bins[i + 1].f) return bins[i].r + (bins[i + 1].r - bins[i].r) * (f - bins[i].f) / (bins[i + 1].f - bins[i].f); return bins[bins.length - 1].r; };

/** how deep a ball (its middle `p`, in the world, its radius `r`) is inside the posed body: > 0 inside (metres, about) */
export function depthAt(rig, X, solved, p, r) {
  const { D, P } = solved; let deep = -1;
  for (const [j, lo, hi] of [[rig.pelvis, X.y0 - 0.02, X.split + 0.03], [rig.chest, X.split - 0.03, X.y1 + 0.02]]) {
    const q = V.add(Q.rot(Q.conj(D[j]), [p[0] - P[j * 3], p[1] - P[j * 3 + 1], p[2] - P[j * 3 + 2]]), rig.J[j].at);
    if (q[1] < lo || q[1] > hi) continue; const s = slabAt(X, q[1]), A = s.a + r + X.pad, B = s.b + r + X.pad, e = Math.pow(Math.abs(q[0] - s.cx) / A, POW) + Math.pow(Math.abs(q[2] - s.cz) / B, POW);
    if (e < 1) deep = Math.max(deep, (1 - Math.pow(e, 1 / POW)) * Math.min(A, B));
  }
  for (const s of SIDES) { const L = rig.leg(s), a = [P[L.up * 3], P[L.up * 3 + 1], P[L.up * 3 + 2]], b = [P[L.low * 3], P[L.low * 3 + 1], P[L.low * 3 + 2]], ab = V.sub(b, a), t = clamp(V.dot(V.sub(p, a), ab) / V.dot(ab, ab), 0, 1);
    const d = V.dist(p, V.mad(a, ab, t)), R = interp(X.thigh[s], t) + r + X.pad; if (d < R) deep = Math.max(deep, R - d); }
  return deep;
}

// an arm's balls: the elbow, the forearm's middle, the wrist, the hand, the fingertips
function armBalls(X, info, s) { const E = info["elbowAt_" + s], W = info["wristAt_" + s], hd = info["handDir_" + s];
  return [[E, X.rFore * 1.1], [V.lerp(E, W, 0.5), X.rFore], [W, X.rFore * 0.8], [V.mad(W, hd, 0.45 * X.hand), 0.02], [V.mad(W, hd, 0.92 * X.hand), 0.01]]; }   // (a hand hangs flat to the thigh: thinner than a forearm)

/** how deep one arm is inside the body in a built pose (> 0: inside) */
export function armDepth(rig, X, pose, solved, s) { let d = -1; for (const [p, r] of armBalls(X, pose.info, s)) d = Math.max(d, depthAt(rig, X, solved, p, r)); return d; }

/** a clip's arms kept clear of the body: returns tweak(c, frame), which carries each arm as far out as the clip needs
    (`report`: the most any frame needed, in degrees, and what's left inside after) */
export function clearance(rig, X, clip, report = {}) {
  const n = clip.n, need = { l: new Float64Array(n), r: new Float64Array(n) }, STEP = 1.5 * Math.PI / 180;
  const deepest = (c, s) => { const pose = build(rig, c), solved = pose.solve(); let d = -1; for (const [p, r] of armBalls(X, pose.info, s)) d = Math.max(d, depthAt(rig, X, solved, p, r)); return d; };
  for (let f = 0; f < n; f++) { const c = clip.ctrl(f);
    for (const s of SIDES) { if (!c.arms[s] || c.arms[s].hand || c.arms[s].free) continue; let extra = 0;
      for (let it = 0; it < 28; it++) { const d = deepest(c, s); if (d <= 0) break; const step = clamp(d / 0.35, STEP * 0.5, STEP * 3); c.arms[s].abd = (c.arms[s].abd || 0) + step; extra += step; }
      need[s][f] = extra; } }
  const out = {};
  for (const s of SIDES) { const a = need[s], env = new Float64Array(n), sm = new Float64Array(n), at = i => clip.loop ? a[((i % n) + n) % n] : a[Math.min(n - 1, Math.max(0, i))];
    for (let i = 0; i < n; i++) { let m = 0; for (let k = -3; k <= 3; k++) m = Math.max(m, at(i + k)); env[i] = m; }
    const ev = i => clip.loop ? env[((i % n) + n) % n] : env[Math.min(n - 1, Math.max(0, i))];
    for (let i = 0; i < n; i++) { let t = 0, w = 0; for (let k = -4; k <= 4; k++) { const g = Math.exp(-k * k / 4.5); t += g * ev(i + k); w += g; } sm[i] = t / w * 1.04 + (env[i] > 0 ? 0.004 : 0); }
    out[s] = sm; report["arm_" + s] = +(Math.max(...sm) * 180 / Math.PI).toFixed(1); }
  return (c, f) => { for (const s of SIDES) if (c.arms[s] && !c.arms[s].hand && !c.arms[s].free) c.arms[s].abd = (c.arms[s].abd || 0) + out[s][f]; };
}

/** the deepest any arm ball is inside the body over a clip's poses (clips.js poses): a check's number, metres */
export function worstArm(rig, X, frames) { let worst = -1; for (const f of frames) for (const s of SIDES) { if (f.c.arms[s].hand || f.c.arms[s].free) continue; for (const [p, r] of armBalls(X, f.pose.info, s)) worst = Math.max(worst, depthAt(rig, { ...X, pad: 0 }, f.solved, p, r)); } return worst; }
