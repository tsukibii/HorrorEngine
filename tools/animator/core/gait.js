// Animator v2: walking and running, made from a body (docs/ANIMATOR_V2.md §5). Nothing here is a recorded motion: a
// gait is planned on the ground first (where each foot lands, rolls from heel to toe and leaves, at this body's step
// length and pace), the pelvis rides over the planted leg at the height its bending knee gives, and the rest of the
// body answers: the hips list and turn, the chest counters them, the arms swing against the legs. How wide, how
// loose, how heavy: from the three sliders (style, strength, weight) and from the body's own measures.
import { V, DEG, clamp, lerp, sm, sm2, wrap01, curve } from "./m.js";
import { ankleAt } from "./pose.js";

export const FPS = 30;

/** what every clip is made from: the sliders and the body, as a few numbers
    set: { style: -1 masculine .. 0 .. 1 feminine, strength: 0..1, weight: -1..1 on top of what the body weighs, soft: 0..1.5 } */
export function params(body, set = {}) {
  const style = clamp(set.style ?? 0, -1, 1), strength = clamp(set.strength ?? 0.5, 0, 1), pw = strength * 2 - 1;
  const build = clamp(body.build + (set.weight ?? 0) * 0.9, -0.8, 1.8), heavy = Math.max(0, build), light = Math.max(0, -build);
  return { style, strength, pw, build, heavy, light, fem: Math.max(0, style), masc: Math.max(0, -style), weak: Math.max(0, -pw), strong: Math.max(0, pw),
    sc: body.leg / 0.87, soft: clamp(set.soft ?? 1, 0, 1.5), g: 9.81, load: clamp(heavy - 0.5 * pw, -1, 2) };
}

// a smooth curve through keys [[u, y], ...] with the slopes at its two ends given (the slopes inside from the keys
// beside each): a foot's path joined to the ground's own speed where it leaves and lands
function path(keys, m0, m1) {
  const n = keys.length, m = keys.map((k, i) => i === 0 ? m0 : i === n - 1 ? m1 : (keys[i + 1][1] - keys[i - 1][1]) / (keys[i + 1][0] - keys[i - 1][0]));
  return u => { u = clamp(u, keys[0][0], keys[n - 1][0]); let i = 0; while (i < n - 2 && u > keys[i + 1][0]) i++;
    const h = keys[i + 1][0] - keys[i][0], t = (u - keys[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * h * m[i + 1]; };
}
// a loop's samples smoothed round the loop (a Gaussian, `sig` in samples)
function smoothLoop(a, sig) { const n = a.length, r = Math.ceil(sig * 3), o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, w = 0; for (let k = -r; k <= r; k++) { const g = Math.exp(-k * k / (2 * sig * sig)); s += g * a[((i + k) % n + n) % n]; w += g; } o[i] = s / w; } return o; }
// a loop's samples followed by a weight on a spring (natural frequency f Hz, damping z): what a heavy body does with
// the height its legs ask for: later, deeper, and round at the bottom
function follow(a, dt, f, z) { const n = a.length, w = 2 * Math.PI * f, o = new Float64Array(n); let x = a[0], v = 0; const sub = 8, h = dt / sub;
  for (let lap = 0; lap < 4; lap++) for (let i = 0; i < n; i++) { const a0 = a[i], a1 = a[(i + 1) % n]; for (let k = 0; k < sub; k++) { const tg = a0 + (a1 - a0) * (k / sub); v += (w * w * (tg - x) - 2 * z * w * v) * h; x += v * h; } if (lap === 3) o[(i + 1) % n] = x; }
  return o; }

const legLen = (l1, l2, knee) => Math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(knee));   // hip to ankle with the knee bent `knee`

/** a gait: { name, loop: true, n (frames), fps, secs, speed (m/s), stride, ctrl(frame) -> controls (pose.js build), events, plan } */
export function gait(rig, body, set, kind = "walk") {
  const p = params(body, set), run = kind === "run", F = body.foot, L = body.leg, l1 = body.thigh, l2 = body.shank, aH = body.ankleH, hipHalf = body.hipHalf;
  // ---- the plan on the ground: pace, step, how long a foot stays down ---------------------------------------------
  const Fr = run ? clamp(1.15 + 0.2 * p.pw - 0.3 * p.heavy + 0.05 * p.light, 0.7, 1.5) : clamp(0.2 + 0.035 * p.pw - 0.05 * p.heavy + 0.015 * p.light, 0.11, 0.3);
  const v0 = Math.sqrt(Fr * p.g * L), stepK = run ? clamp(1.24 + 0.08 * p.pw - 0.12 * p.heavy - 0.03 * p.fem, 0.95, 1.4) : clamp(0.79 + 0.05 * p.pw - 0.075 * p.heavy - 0.03 * p.fem + 0.02 * p.masc, 0.55, 0.9);
  const S = 2 * L * stepK, N = Math.max(14, Math.round(S / v0 * FPS)), T = N / FPS, v = S / T;
  const beta = run ? clamp(0.4 + 0.035 * p.heavy - 0.02 * p.pw, 0.34, 0.47) : clamp(0.62 + 0.03 * p.heavy - 0.015 * p.pw, 0.58, 0.68);
  const width = p.sc * (run ? clamp(0.05 - 0.02 * p.style + 0.035 * p.heavy, 0.02, 0.13) : clamp(0.085 - 0.03 * p.style + 0.03 * p.heavy - 0.008 * p.light, 0.04, 0.16));
  const toeOut = (run ? 4 - 2 * p.style + 3 * p.heavy : 6 - 3 * p.style + 3 * p.heavy) * DEG;
  const pHS = (run ? clamp(7 + 3 * p.pw - 5 * p.heavy, 0, 12) : clamp(16 + 3 * p.pw - 6 * p.heavy, 6, 20)) * DEG;      // toes up at heel strike
  const pTO = (run ? clamp(64 + 5 * p.pw - 10 * p.heavy, 44, 72) : clamp(66 + 4 * p.pw - 9 * p.heavy, 46, 72)) * DEG;   // heel up at toe-off
  const ff = run ? 0.05 : clamp(0.085 - 0.02 * p.heavy, 0.05, 0.1), ho = run ? beta * 0.5 : clamp(0.335 + 0.04 * p.heavy - 0.02 * p.pw, 0.28, 0.42), sw = 1 - beta;
  const pitchOf = curve([[0, pHS], [ff, 0], [ho, 0], [ho + 0.45 * (beta - ho), -0.2 * pTO], [ho + 0.8 * (beta - ho), -0.58 * pTO], [beta, -pTO],
    [beta + 0.2 * sw, (run ? -1.05 : -0.68) * pTO], [beta + 0.45 * sw, (run ? -0.6 : -0.2) * pTO], [beta + 0.72 * sw, run ? -0.05 * pTO : 0.35 * pHS]], 1);
  const zHS = (run ? 0.3 : 0.44) * S / 2;                                    // the foot's place ahead of the pelvis when it lands
  const ground = (g, psi) => [g * width / 2, 0, zHS - S * psi];             // a planted foot's place: carried back under the body
  const lift = clamp(1 + 0.12 * p.pw + 0.06 * p.light - 0.16 * p.heavy, 0.75, 1.2);
  const stance = (g, psi) => ankleAt(F, aH, ground(g, psi), g * toeOut, pitchOf(psi));
  const mk = g => {                                                         // one leg's ankle over its own cycle
    const e = 1e-3, A0 = stance(g, beta), A1 = stance(g, 0), v0s = V.mul(V.sub(stance(g, beta), stance(g, beta - e)), sw / e), v1s = V.mul(V.sub(stance(g, e), stance(g, 0)), sw / e);
    const zOf = path([[0, A0[2]], [1, A1[2]]], v0s[2], v1s[2] * 0.6);
    const top = run ? A0[1] + (0.2 + 0.1 * p.pw - 0.07 * p.heavy) * p.sc * (1 + 0.25 * p.light) : A0[1] + 0.045 * p.sc * lift;
    const yOf = path(run ? [[0, A0[1]], [0.3, top], [0.62, aH + 0.2 * p.sc * lift], [0.88, A1[1] + 0.05 * p.sc], [1, A1[1]]]
      : [[0, A0[1]], [0.2, top], [0.55, aH + (0.03 + 0.055 * lift) * p.sc], [0.85, A1[1] + 0.02 * p.sc], [1, A1[1]]], v0s[1], Math.min(-0.12, v1s[1]) * 0.8);
    const arc = p.sc * (0.012 * p.fem - 0.012 * p.masc - 0.01 * p.heavy);   // the swinging foot passing close to the other (feminine), or round it
    return psi => { psi = wrap01(psi); if (psi <= beta) return stance(g, psi); const u = (psi - beta) / sw; return [g * (width / 2 - arc * Math.sin(Math.PI * u)), yOf(u), zOf(u)]; };
  };
  const ankleL = mk(1), ankleR = mk(-1), ankle = (g, phi) => g > 0 ? ankleL(phi) : ankleR(phi + 0.5);
  // the toes must clear the floor in swing: checked, the swing lifted where they wouldn't
  const toeY = (A, pt) => A[1] + (-aH + 0.012) * Math.cos(pt) + F.toeAhead * Math.sin(pt);
  let low = 1e9; for (let i = 0; i < 60; i++) { const psi = beta + sw * (i + 0.5) / 60; low = Math.min(low, toeY(ankleL(psi), pitchOf(psi))); }
  const raise = Math.max(0, 0.012 - low);
  // ---- the pelvis: where it is over the feet, and how it lists and turns --------------------------------------------
  const lag = clamp(0.02 + 0.035 * p.heavy - 0.01 * p.pw, 0, 0.08);
  const Ax = p.sc * (run ? 0.008 + 0.01 * p.heavy : 0.019 + 0.3 * (width / p.sc - 0.085) + 0.012 * p.heavy + 0.004 * p.fem), Az = p.sc * (run ? 0.012 : 0.011);
  const Arot = (run ? 6.5 + 1.5 * p.style - 1.5 * p.heavy : 4.5 + 2 * p.style - 1 * p.heavy) * DEG, Alist = (run ? 4.5 + 2 * p.style : 4 + 2.6 * p.style + 1.2 * p.heavy) * DEG;
  const tilt0 = (3 * p.fem - 1 * p.masc + (run ? 5 : 0)) * DEG, Atilt = 1.2 * DEG;
  const pelvisXZ = phi => [Ax * Math.cos(2 * Math.PI * (phi - (run ? 0.2 : 0.3) - lag * 0.5)), Az * Math.cos(4 * Math.PI * (phi - 0.12))];
  const pelvisTurn = phi => ({ yaw: -Arot * Math.cos(2 * Math.PI * (phi - 0.02)), roll: Alist * Math.cos(2 * Math.PI * (phi - (run ? 0.1 : 0.17) - lag * 0.4)), pitch: tilt0 + Atilt * Math.cos(4 * Math.PI * (phi - 0.1)) });
  // the height: each planted leg says how high the hip may be for the knee it should have; the pelvis takes the
  // leading leg's word through its stance, the two blended while both feet are down
  const kneeOf = run ? curve([[-0.05, 16 * DEG], [0, (17 + 4 * p.heavy) * DEG], [beta * 0.45, (40 + 6 * p.heavy - 5 * p.pw) * DEG], [beta, 18 * DEG], [beta + 0.06, 30 * DEG]])
    : curve([[-0.05, 5 * DEG], [0, 5 * DEG], [0.13, clamp(13 + 5 * p.heavy - 4 * p.pw + 1.5 * p.light, 8, 22) * DEG], [0.4, (5 + 3 * p.heavy + 2 * p.weak) * DEG], [0.5, 10 * DEG], [0.56, 20 * DEG], [0.62, 36 * DEG], [0.7, 44 * DEG]]);
  const hipOff = (g, phi) => { const t = pelvisTurn(phi);                 // the hip joint from the pelvis joint, turned as the pelvis is (small angles)
    const hp = rig.leg(g > 0 ? "l" : "r").hip; return [hp[0] * Math.cos(t.yaw) + hp[2] * Math.sin(t.yaw) - hp[1] * Math.sin(t.roll), hp[1] + hp[0] * Math.sin(t.roll) - hp[2] * Math.sin(t.pitch), hp[2] * Math.cos(t.yaw) - hp[0] * Math.sin(t.yaw) + hp[1] * Math.sin(t.pitch)]; };
  const implied = (g, phi, knee) => { const A = ankle(g, phi), xz = pelvisXZ(phi), o = hipOff(g, phi), dx = A[0] - (xz[0] + o[0]), dz = A[2] - (xz[1] + o[2]), d = legLen(l1, l2, knee);
    return A[1] + Math.sqrt(Math.max(1e-6, d * d - dx * dx - dz * dz)) - o[1]; };
  const M = N * 4, raw = new Float64Array(M), cap = new Float64Array(M), lead0 = run ? -0.05 : -0.1, lead1 = 0, out0 = run ? beta - 0.05 : 0.4, out1 = run ? beta : 0.5;
  for (let i = 0; i < M; i++) {
    const phi = i / M; let sum = 0, wt = 0, top = 1e9;
    for (const g of [1, -1]) {
      let psi = wrap01(g > 0 ? phi : phi + 0.5); if (psi > out1 + 0.02) psi -= 1;
      const w = sm2(lead0, lead1, psi) * (1 - sm2(out0, out1, psi));
      if (w > 1e-4) { sum += w * implied(g, phi, kneeOf(Math.max(psi, 0))); wt += w; }
      if (psi <= beta || psi > 0.86 || psi < 0) top = Math.min(top, implied(g, phi, 3 * DEG));   // (no leg, planted or reaching for the ground, ever asked to be longer than it is)
    }
    raw[i] = wt > 0 ? sum / wt : NaN; cap[i] = top;
  }
  if (run) {                                                                // in the air between steps: the height carried over (a short flight, nearly level)
    for (let lap = 0; lap < 2; lap++) for (let i = 0; i < M; i++) if (Number.isNaN(raw[i])) { let a = i; while (Number.isNaN(raw[(a + M - 1) % M])) a = (a + M - 1) % M; let b = i; while (Number.isNaN(raw[(b + 1) % M])) b = (b + 1) % M;
      const ya = raw[(a + M - 1) % M], yb = raw[(b + 1) % M], len = ((b - a + M) % M) + 2, t = (((i - a + M) % M) + 1) / len; raw[i] = ya + (yb - ya) * t + 0.5 * p.g * (T * len / M) ** 2 * t * (1 - t); }
  }
  // smooth, and never above what a leg can reach. The reach itself is made a smooth curve that lies under it (its
  // lowest within a little while, then smoothed by less than that), and the height is brought under that softly: a
  // clamp frame by frame would put a kink in the pelvis, and a kink there is a twitch in both knees
  const r = Math.ceil(M * 0.014), lowest = new Float64Array(M); for (let i = 0; i < M; i++) { let m = 1e9; for (let k = -r; k <= r; k++) m = Math.min(m, cap[((i + k) % M + M) % M]); lowest[i] = m; }
  const capS = smoothLoop(lowest, M * 0.004), softMin = (a, b, k = 0.001) => Math.min(a, b) - k * Math.log(1 + Math.exp(-Math.abs(a - b) / k));
  const under = a => { let over = 0; for (let i = 0; i < M; i++) over = Math.max(over, a[i] - (cap[i] - 0.0005)); if (over > 0) for (let i = 0; i < M; i++) a[i] -= over; return a; };
  let ys = smoothLoop(raw, M * (run ? 0.012 : 0.012)); for (let i = 0; i < M; i++) ys[i] = softMin(ys[i], capS[i] - 0.0005);
  ys = follow(ys, T / M, clamp((run ? 8 : 7) - 2.6 * p.heavy + 1.2 * p.pw + 0.8 * p.light, 3.2, 10), 0.7);
  for (let i = 0; i < M; i++) ys[i] = softMin(ys[i], capS[i] - 0.0005); ys = under(ys);
  const pelvisY = phi => { const x = wrap01(phi) * M, i = Math.floor(x), t = x - i; return ys[i % M] * (1 - t) + ys[(i + 1) % M] * t; };
  // ---- the upper body and the arms ----------------------------------------------------------------------------------
  const kc = clamp(0.55 + 0.35 * p.masc - 0.15 * p.fem + (run ? 0.25 : 0), 0.2, 1.1), swag = (0.6 + 1.6 * p.masc + 1.2 * p.heavy - 0.3 * p.fem) * DEG;
  const lean = (run ? 9 + 3 * p.pw - 2 * p.heavy : 2 + 4 * p.weak - 2 * p.strong - 2.5 * p.heavy) * DEG, headDown = (6 * p.weak - 1 * p.strong + (run ? -4 : 0)) * DEG;
  const aF = (run ? 34 + 6 * p.pw - 6 * p.heavy : 16 + 6 * p.masc - 3 * p.fem + 3 * p.pw - 3 * p.heavy) * DEG, aB = (run ? 30 + 4 * p.pw - 6 * p.heavy : 14 + 3 * p.masc + 1 * p.fem - 2 * p.heavy) * DEG;
  const e0 = (run ? 78 + 8 * p.fem - 6 * p.masc : 10 + 6 * p.masc - 2 * p.fem + 5 * p.heavy) * DEG, eDyn = (run ? 14 : 12 + 6 * p.fem) * DEG;
  const abd0 = (4 + 5 * p.masc + 1 * p.fem + 2 * p.heavy + (run ? 3 : 0)) * DEG, rot0 = (run ? 20 + 8 * p.masc : 8 + 10 * p.masc - 4 * p.fem) * DEG, pron = (25 + 25 * p.masc - 12 * p.fem + (run ? 10 : 0)) * DEG;
  const curl = clamp(0.28 + 0.22 * p.masc - 0.08 * p.fem + (run ? 0.3 : 0), 0.1, 0.9), armLag = 0.03 + 0.04 * p.heavy - 0.01 * p.pw;
  const arm = (g, phi) => { const sw_ = Math.cos(2 * Math.PI * (phi - (g > 0 ? 0.5 : 0) - armLag)), vel = -Math.sin(2 * Math.PI * (phi - (g > 0 ? 0.5 : 0) - armLag)), fwd = sm(-0.3, 1, sw_), back = sm(0, 1, -sw_);
    return { flex: (-2 + 3 * p.weak) * DEG + (run ? 6 * DEG : 0) + lerp(aB, aF, (sw_ + 1) / 2) * sw_, elbow: e0 + eDyn * fwd - (run ? 16 * DEG * back : 0), abd: abd0 + 6 * DEG * p.fem * back, rot: rot0 + (run ? 14 : 6) * DEG * Math.max(0, sw_),
      pron, wrist: (run ? 3 : 5 + 4 * p.fem) * DEG * vel, curl, hang: 0.7 }; };
  const ctrl = f => {
    const phi = wrap01(f / N), xz = pelvisXZ(phi), pt = pelvisTurn(phi), c = { phase: phi };
    c.pelvis = { pos: [xz[0], pelvisY(phi), xz[1]], ...pt };
    const sway = Math.cos(2 * Math.PI * (phi - 0.3 - lag));
    c.chest = { yaw: kc * Arot * Math.cos(2 * Math.PI * (phi - 0.02 - lag)), roll: -0.25 * p.fem * pt.roll - swag * sway, pitch: lean + 0.6 * DEG * Math.cos(4 * Math.PI * (phi - 0.05)) };
    c.head = { yaw: 0.2 * c.chest.yaw, roll: 0.2 * c.chest.roll, pitch: headDown + 0.3 * (c.chest.pitch - lean) };
    c.legs = {};
    for (const [s, g] of [["l", 1], ["r", -1]]) { const psi = wrap01(g > 0 ? phi : phi + 0.5), A = ankle(g, phi), pch = pitchOf(psi), up = psi > beta ? raise * Math.sin(Math.PI * (psi - beta) / sw) : 0;
      c.legs[s] = { ankle: [A[0], A[1] + up, A[2]], yaw: g * toeOut, pitch: pch, toe: psi <= beta && pch < 0 ? Math.min(-pch, 58 * DEG) : psi > beta ? Math.max(0, -pch) * Math.max(0, 1 - (psi - beta) / (0.35 * sw)) : 0, knee: (2 * p.masc - 3 * p.fem + 2 * p.heavy) * DEG }; }
    c.arms = { l: arm(1, phi), r: arm(-1, phi) };
    return c;
  };
  const events = [{ t: 0, name: "step_l" }, { t: T / 2, name: "step_r" }];
  return { name: kind, loop: true, n: N, fps: FPS, secs: T, speed: v, stride: S, ctrl, events, plan: { Fr, beta, width, toeOut, step: S / 2, pHS, pTO, raise } };
}
