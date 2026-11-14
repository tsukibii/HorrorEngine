// Animations v3: the slow, low two-legged gaits and their stances (docs/ANIMATOR_V3.md §2.2): a careful sneak, a
// creature's hunched creep. Planned as the walk is (gait.js: where each foot lands and how long it stays, the pelvis
// carried over the planted leg at the height its knee gives), with what makes them what they are: the knees kept
// bent all through, the foot set down on its ball and the heel let down after, both feet on the ground most of the
// time, the trunk leant, and the weight taken right over each foot before the other leaves. In place, like the walk:
// the record says how fast it travels.
import { DEG, clamp, lerp, sm, sm2, wrap01, curve } from "./m.js";
import { ankleAt } from "./pose.js";
import { params, FPS, path, smoothLoop, legLen } from "./gait.js";

const TAU = 2 * Math.PI;
// what each is, from the sliders (p: gait.js params). step: a step as a share of the leg; T: a stride, seconds; beta:
// the share of a stride a foot is down; knee: how bent the planted knee is kept; lean: the trunk's; lift: how high the
// foot is carried; land: toes down as it lands; pTO: heel up as it leaves
const STYLE = {
  sneak: p => ({ step: clamp(0.37 + 0.03 * p.pw - 0.04 * p.heavy, 0.26, 0.43), T: clamp(1.5 - 0.16 * p.pw + 0.2 * p.heavy, 1.15, 1.95), beta: 0.7, knee: (58 + 5 * p.strong - 8 * p.weak - 8 * p.heavy) * DEG,
    lean: (21 + 4 * p.strong) * DEG, width: clamp(0.12 + 0.04 * p.heavy - 0.02 * p.fem, 0.08, 0.2), toeOut: (9 + 3 * p.heavy) * DEG, lift: 0.09 + 0.02 * p.strong, land: 15 * DEG, pTO: 38 * DEG,
    sway: 0.5, rot: 3.5 * DEG, list: 3 * DEG, tilt: 6 * DEG }),
  creep: p => ({ step: clamp(0.41 + 0.04 * p.pw - 0.05 * p.heavy, 0.28, 0.5), T: clamp(1.3 - 0.2 * p.pw + 0.22 * p.heavy, 0.95, 1.8), beta: 0.66, knee: (74 + 6 * p.strong - 10 * p.weak - 10 * p.heavy) * DEG,
    lean: (41 + 6 * p.strong - 4 * p.heavy) * DEG, width: clamp(0.18 + 0.05 * p.heavy, 0.12, 0.28), toeOut: (17 + 4 * p.heavy) * DEG, lift: 0.035, land: 6 * DEG, pTO: 30 * DEG,
    sway: 0.62, rot: 7 * DEG, list: 5 * DEG, tilt: 12 * DEG }),
};
// the arms and the head of each, at a phase (sw: this arm's swing, -1 back .. 1 forward; breath: -1..1)
const UPPER = {
  sneak: (p, K) => ({
    arm: (g, sw, b) => ({ flex: (17 + 7 * sw) * DEG, elbow: (72 + 8 * sw + 2 * b) * DEG, abd: (11 + 4 * p.masc + 3 * p.heavy) * DEG, rot: (12 + 5 * Math.max(0, sw)) * DEG, pron: 34 * DEG, wrist: -6 * DEG, curl: 0.62, hang: 0.5 }),
    clav: () => ({ up: 3 * DEG, fwd: 6 * DEG }),
    head: (phi, chest) => ({ yaw: 9 * DEG * Math.sin(TAU * phi) , roll: 0.3 * chest.roll, pitch: 3 * DEG }), neck: 0.4 }),
  creep: (p, K) => ({
    arm: (g, sw, b) => ({ flex: (30 + 11 * sw) * DEG, elbow: (40 + 12 * Math.max(0, sw) + 3 * b) * DEG, abd: (9 + 4 * p.heavy) * DEG, rot: (4 + 6 * Math.max(0, sw)) * DEG, pron: 62 * DEG, wrist: (26 + 8 * sw) * DEG, curl: 0.86, hang: 0.82 }),
    clav: () => ({ up: 9 * DEG, fwd: 15 * DEG }),
    head: (phi, chest) => ({ yaw: 5 * DEG * Math.sin(TAU * (phi + 0.1)), roll: 11 * DEG + 4 * DEG * Math.sin(TAU * phi), pitch: -7 * DEG + 2 * DEG * Math.cos(2 * TAU * phi) }), neck: 0.34 }),
};

/** a slow gait held low: { name, loop, n, fps, secs, speed, stride, ctrl, events, plan }. kind: "sneak" or "creep" */
export function prowl(rig, body, set, kind = "sneak") {
  const p = params(body, set), K = STYLE[kind](p), U = UPPER[kind](p, K), F = body.foot, L = body.leg, l1 = body.thigh, l2 = body.shank, aH = body.ankleH;
  const S = 2 * L * K.step, N = Math.max(20, 2 * Math.round(K.T * FPS / 2)), T = N / FPS, v = S / T, beta = K.beta, sw = 1 - beta, width = p.sc * K.width, toeOut = K.toeOut;
  // ---- on the ground: the ball of the foot first, the heel let down, a long time flat, the heel up late -------------
  const ff = 0.14, ho = 0.66 * beta;
  const pitchOf = curve([[0, -K.land], [ff, 0], [ho, 0], [ho + 0.5 * (beta - ho), -0.35 * K.pTO], [beta, -K.pTO], [beta + 0.3 * sw, -1.1 * K.pTO], [beta + 0.7 * sw, -(K.land + 0.35 * K.pTO)]], 1);
  const zHS = 0.52 * S * beta, ground = (g, psi) => [g * width / 2, 0, zHS - S * psi], stance = (g, psi) => ankleAt(F, aH, ground(g, psi), g * toeOut, pitchOf(psi));
  const mk = g => { const e = 1e-3, A0 = stance(g, beta), A1 = stance(g, 0), v0 = (stance(g, beta)[2] - stance(g, beta - e)[2]) * sw / e, v1 = (stance(g, e)[2] - stance(g, 0)[2]) * sw / e;
    const zOf = path([[0, A0[2]], [1, A1[2]]], v0, v1 * 0.5), top = aH + K.lift * p.sc;
    const yOf = path([[0, A0[1]], [0.3, Math.max(top, A0[1] + 0.01)], [0.62, top], [0.9, A1[1] + 0.012 * p.sc], [1, A1[1]]], (stance(g, beta)[1] - stance(g, beta - e)[1]) * sw / e, -0.05);
    return psi => { psi = wrap01(psi); if (psi <= beta) return stance(g, psi); const u = (psi - beta) / sw; return [g * width / 2, yOf(u), zOf(u)]; }; };
  const ankleL = mk(1), ankleR = mk(-1), ankle = (g, phi) => g > 0 ? ankleL(phi) : ankleR(phi + 0.5);
  const toeY = (A, pt) => A[1] + (-aH + 0.012) * Math.cos(pt) + F.toeAhead * Math.sin(pt);
  let low = 1e9; for (let i = 0; i < 60; i++) { const psi = beta + sw * (i + 0.5) / 60; low = Math.min(low, toeY(ankleL(psi), pitchOf(psi))); }
  const raise = Math.max(0, 0.014 - low);
  // ---- the pelvis: over the planted foot, at the height its bent knee gives ---------------------------------------
  const Ax = K.sway * width + 0.012 * p.sc, Az = 0.018 * p.sc;
  const pelvisXZ = phi => [Ax * Math.cos(TAU * (phi - 0.33)), Az * Math.cos(2 * TAU * (phi - 0.2))];
  const pelvisTurn = phi => ({ yaw: -K.rot * Math.cos(TAU * (phi - 0.02)), roll: K.list * Math.cos(TAU * (phi - 0.2)), pitch: K.tilt });
  const hipOff = (g, phi) => { const t = pelvisTurn(phi), hp = rig.leg(g > 0 ? "l" : "r").hip;
    return [hp[0] * Math.cos(t.yaw) + hp[2] * Math.sin(t.yaw) - hp[1] * Math.sin(t.roll), hp[1] + hp[0] * Math.sin(t.roll) - hp[2] * Math.sin(t.pitch), hp[2] * Math.cos(t.yaw) - hp[0] * Math.sin(t.yaw) + hp[1] * Math.sin(t.pitch)]; };
  const implied = (g, phi, knee) => { const A = ankle(g, phi), xz = pelvisXZ(phi), o = hipOff(g, phi), dx = A[0] - (xz[0] + o[0]), dz = A[2] - (xz[1] + o[2]), d = legLen(l1, l2, knee);
    return A[1] + Math.sqrt(Math.max(1e-6, d * d - dx * dx - dz * dz)) - o[1]; };
  const M = N * 4, raw = new Float64Array(M), cap = new Float64Array(M);
  for (let i = 0; i < M; i++) { const phi = i / M; let sum = 0, wt = 0, top = 1e9;
    for (const g of [1, -1]) { let psi = wrap01(g > 0 ? phi : phi + 0.5); if (psi > beta + 0.02) psi -= 1;
      const w = sm2(-0.12, 0.04, psi) * (1 - sm2(beta - 0.16, beta, psi)); if (w > 1e-4) { sum += w * implied(g, phi, K.knee); wt += w; }
      top = Math.min(top, implied(g, phi, 6 * DEG)); }
    raw[i] = wt > 0 ? sum / wt : NaN; cap[i] = top; }
  let ys = smoothLoop(raw, M * 0.02); for (let i = 0; i < M; i++) ys[i] = Math.min(ys[i], cap[i] - 0.004); ys = smoothLoop(ys, M * 0.012);
  { let over = 0; for (let i = 0; i < M; i++) over = Math.max(over, ys[i] - (cap[i] - 0.001)); if (over > 0) for (let i = 0; i < M; i++) ys[i] -= over; }
  const pelvisY = phi => { const x = wrap01(phi) * M, i = Math.floor(x), t = x - i; return ys[i % M] * (1 - t) + ys[(i + 1) % M] * t; };
  // ---- the rest of her ------------------------------------------------------------------------------------------------
  const ctrl = f => {
    const phi = wrap01(f / N), xz = pelvisXZ(phi), pt = pelvisTurn(phi), b = Math.sin(2 * TAU * phi), c = { phase: phi, breath: 0.5 * b };
    c.pelvis = { pos: [xz[0], pelvisY(phi), xz[1]], ...pt };
    c.chest = { yaw: 0.7 * K.rot * Math.cos(TAU * (phi - 0.04)), roll: -0.5 * pt.roll, pitch: K.lean + 1.2 * DEG * Math.cos(2 * TAU * (phi - 0.1)) };
    c.head = U.head(phi, c.chest); c.neck = U.neck;
    c.legs = {};
    for (const [s, g] of [["l", 1], ["r", -1]]) { const psi = wrap01(g > 0 ? phi : phi + 0.5), A = ankle(g, phi), pch = pitchOf(psi), up = psi > beta ? raise * Math.sin(Math.PI * (psi - beta) / sw) : 0;
      c.legs[s] = { ankle: [A[0], A[1] + up, A[2]], yaw: g * toeOut, pitch: pch, toe: psi <= beta && pch < 0 ? Math.min(-pch, 55 * DEG) : psi > beta ? Math.min(-pch, 55 * DEG) * Math.max(0, 1 - (psi - beta) / (0.4 * sw)) : 0, knee: (kind === "creep" ? 10 : 3) * DEG }; }
    const arm = g => U.arm(g, Math.cos(TAU * (phi - (g > 0 ? 0.5 : 0) - 0.05)), b);
    c.arms = { l: arm(1), r: arm(-1) }; c.clav = { l: U.clav(), r: U.clav() };
    return c;
  };
  return { name: kind + "_loop", loop: true, n: N, fps: FPS, secs: T, speed: v, stride: S, ctrl, events: [{ t: 0, name: "step_l" }, { t: T / 2, name: "step_r" }], plan: { beta, width, toeOut, step: S / 2, knee: K.knee, lean: K.lean, raise } };
}

/** stood low and still: the sneak's crouch ("crouch_loop") or the creep's stance ("creep_idle_loop"). 8 s. */
export function lowStance(rig, body, set, kind = "sneak") {
  const p = params(body, set), K = STYLE[kind](p), U = UPPER[kind](p, K), aH = body.ankleH, width = p.sc * (K.width + 0.05), N = 8 * FPS, ahead = 0.11 * p.sc, creep = kind === "creep";
  const feet = { l: { ankle: [width / 2, aH, ahead], yaw: K.toeOut, pitch: 0 }, r: { ankle: [-width / 2, aH, -ahead], yaw: -K.toeOut - 4 * DEG, pitch: 0 } };
  const hipY = (px, pz, knee) => { let y = 1e9; for (const [s, g] of [["l", 1], ["r", -1]]) { const hp = rig.leg(s).hip, A = feet[s].ankle, dx = A[0] - (px + hp[0]), dz = A[2] - (pz + hp[2]), d = legLen(body.thigh, body.shank, knee); y = Math.min(y, A[1] + Math.sqrt(Math.max(1e-6, d * d - dx * dx - dz * dz)) - hp[1]); } return y; };
  const ctrl = f => {
    const t = (f % N) / FPS, b = Math.sin(TAU * t / (creep ? 2.667 : 4)), w = Math.sin(TAU * t / 8), w2 = Math.sin(TAU * t / 8 + 1.1), c = { phase: f / N, breath: b };
    const tw = creep ? sm(5.05, 5.12, t) * (1 - sm(5.16, 5.6, t)) : 0;                    // (a creature's twitch, once a loop)
    const px = 0.012 * p.sc * w, pz = 0.006 * p.sc * w2;
    c.legs = { l: { ...feet.l }, r: { ...feet.r } };
    c.pelvis = { pos: [px, hipY(px, pz, K.knee + (creep ? 1.2 : 0.6) * DEG * b) , pz], yaw: 3 * DEG * w2, roll: 1.2 * DEG * w, pitch: K.tilt };
    c.chest = { yaw: -2 * DEG * w2 + (creep ? 3 * DEG * tw : 0), roll: -0.8 * DEG * w + (creep ? 4 * DEG * tw : 0), pitch: K.lean - (creep ? 2.2 : 0.9) * DEG * b };
    c.head = U.head(t / 8, c.chest); c.neck = U.neck; if (creep) { c.head.roll += 14 * DEG * tw; c.head.yaw += 8 * DEG * tw; }
    const arm = g => U.arm(g, 0.15 * w * g, b); c.arms = { l: arm(1), r: arm(-1) }; c.clav = { l: U.clav(), r: U.clav() };
    if (creep) { c.clav.r.up += 7 * DEG * tw; }
    return c;
  };
  return { name: creep ? "creep_idle_loop" : "crouch_loop", loop: true, n: N, fps: FPS, secs: N / FPS, ctrl, events: [], meta: {} };
}
