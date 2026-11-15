// Animations v3: on all fours (docs/ANIMATOR_V3.md §2.3): a crawl on hands and knees, stopped on all fours, and a
// creature's scuttle on hands and feet. Nothing recorded: the contacts are planned on the ground as the walk's feet
// are (each stays where it was put while the body goes over it, then is carried forward), opposite hand and leg
// together, and the trunk hangs between them.
//
// A leg in the crawl is a contact at the KNEE. The thigh goes over the planted knee as a leg goes over a planted foot,
// so the hips rise over each knee and fall between them, and the pelvis lists toward the knee that's being carried,
// which is what clears it off the floor. Its height and its list are solved together each frame from the knees that
// are down. The shin lies behind the knee. The arms are solved to hands flat on the floor, the wrist bent back as far
// as the forearm has leant.
import { V, Q, DEG, clamp, lerp, sm, sm2, wrap01, rx, ry, rz } from "./m.js";
import { build, ankleAt } from "./pose.js";
import { params, FPS, path } from "./gait.js";

const TAU = 2 * Math.PI, dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const turnOf = (yaw, roll, pitch) => Q.mul(ry(yaw), Q.mul(rz(roll), rx(pitch)));
// two unknowns fitted to residuals (least squares, a few Gauss-Newton steps with slopes by difference)
function fit2(res, x0, steps = 9) {
  let x = x0.slice();
  for (let k = 0; k < steps; k++) { const r = res(x), e = 1e-4, J = [0, 1].map(i => { const y = x.slice(); y[i] += e; const r2 = res(y); return r2.map((v, j) => (v - r[j]) / e); });
    const a = dot(J[0], J[0]) + 1e-10, b = dot(J[0], J[1]), d = dot(J[1], J[1]) + 1e-10, g0 = dot(J[0], r), g1 = dot(J[1], r), det = a * d - b * b; if (Math.abs(det) < 1e-20) break;
    x = [x[0] - (d * g0 - b * g1) / det, x[1] - (a * g1 - b * g0) / det]; }
  return x;
}
// where the shoulders are from the pelvis joint, for a pelvis and a chest pitched so (the spine bends between them)
function shouldersFrom(rig, thP, thC) {
  const c = { pelvis: { pos: [0, 2, 0], pitch: thP }, chest: { pitch: thC }, head: { pitch: thC }, legs: { l: { ankle: [0.1, 1.2, 0] }, r: { ankle: [-0.1, 1.2, 0] } }, arms: { l: {}, r: {} } };
  const P = build(rig, c).solve().P, at = j => [P[j * 3], P[j * 3 + 1] - 2, P[j * 3 + 2]]; return { l: at(rig.armL.up), r: at(rig.armR.up) };
}
// a hand planted flat: the arm's controls for a wrist at W. The hand's own turn is given outright (pose.js handQ): its
// palm down, its fingers ahead and a little down from the wrist (`tilt`, degrees: the heel of a hand is thicker than
// its fingers; below 0 the knuckles are held up, a clawed hand on its fingertips), so it lies on the floor however
// the arm above it leans. `droop`: 0..1, a carried hand hanging from its wrist
function planted(rig, s, W, o = {}) {
  const g = s === "l" ? 1 : -1, A = rig.arm(s), d = ((o.tilt ?? 8) + 22 * (o.droop || 0)) * DEG, out = g * (o.out ?? 6) * DEG, f = [Math.sin(out) * Math.cos(d), -Math.sin(d), Math.cos(out) * Math.cos(d)];
  return { hand: W, pole: o.pole || [g * 0.35, 0.1, -1], handQ: Q.frame(A.handDir, A.palm0, f, [0, -Math.cos(d), -Math.sin(d)]), curl: o.curl ?? 0, thumbFlat: 1, free: true };
}

// How far under its wrist a planted hand's lowest finger joint lies, metres (`o`: as planted's). Read off the pose
// itself: the hand's turn is given outright, so it's the same wherever the arm is, and a creature's fingers are as
// long as they are (a wrist held a person's 3 cm off the floor put an ogre's fingertips 5 cm under it).
function handDrop(rig, o = {}) {
  const A = rig.armL, c = { pelvis: { pos: [0, 2, 0], pitch: 0 }, chest: { pitch: 0 }, head: { pitch: 0 }, legs: { l: { ankle: [0.1, 1.2, 0] }, r: { ankle: [-0.1, 1.2, 0] } }, arms: { l: {}, r: {} } };
  const P0 = build(rig, c).solve().P, len = A.upper + A.fore;
  c.arms.l = planted(rig, "l", [P0[A.up * 3] + 0.05, P0[A.up * 3 + 1] - 0.6 * len, P0[A.up * 3 + 2] + 0.3 * len], o);
  const P = build(rig, c).solve().P, wy = P[A.hand * 3 + 1]; let low = 0;
  for (const chain of A.fingers) for (const j of chain) { low = Math.max(low, wy - P[j * 3 + 1]); for (const k of rig.J[j].kids) low = Math.max(low, wy - P[k * 3 + 1]); }
  return low;
}

// ---- hands and knees --------------------------------------------------------------------------------------------------
// (`share`: how much of their length the arms are given at the middle of the stance)
function kneelingAt(rig, body, set, share) {
  const p = params(body, set), sc = p.sc, l1 = body.thigh, l2 = body.shank, arm = body.upper + body.fore;
  const drop0 = handDrop(rig, {}), drop1 = handDrop(rig, { droop: 1 });                                      // a hand flat on the floor, and hanging from its wrist as it's carried
  const kneeR = 0.055 * sc * (1 + 0.25 * p.heavy), aLie = 0.042 * sc, wristH = Math.max(0.028 * sc, drop0 - 0.003 * sc);
  const th0 = clamp(22 + 3 * p.pw - 4 * p.heavy, 14, 27) * DEG, a = l1 * Math.sin(th0), beta = 0.58;         // the thigh swings th0 each side of upright over its knee
  const kx = body.hipHalf + 0.015 * sc + 0.02 * sc * p.heavy, hx = body.shoulderHalf + 0.02 * sc;
  // the trunk's slope: what puts the shoulders where arms a little bent reach the floor, the hips where the thighs put them
  const y0 = kneeR + l1 * Math.cos(0.55 * th0) - rig.legL.hip[1], shY = wristH + Math.sqrt(Math.max(0.01, (share * arm) ** 2 - a * a));
  let lo = 50 * DEG, hi = 118 * DEG; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (y0 + shouldersFrom(rig, m - 3 * DEG, m).l[1] > shY) lo = m; else hi = m; }
  const thC = (lo + hi) / 2, thP = thC - 3 * DEG, sh = shouldersFrom(rig, thP, thC), zc = sh.l[2] + 0.015 * sc;
  return { p, sc, l1, l2, arm, kneeR, aLie, wristH, th0, a, beta, kx, hx, y0, thC, thP, sh, zc, share, drop0, drop1 };
}
// The stance on hands and knees, for the crawl and everything that starts from it. The arms are given 0.972 of their
// length at the middle of the stance, which leaves a person's a little bent all the way through the crawl. A
// creature's arms are long for its thighs and its shoulders wide, and at the ends of a hand's time on the floor they
// were asked for all of their length and more (a goblin's 0.993, an ogre's 0.997): their share comes down until the
// crawl's own cycle never asks for more than 0.975. Kept for a body and its settings: three makers ask for it.
const KNEEL = new WeakMap();
function kneeling(rig, body, set) {
  const key = JSON.stringify(set || {}); let kept = KNEEL.get(body); if (!kept) KNEEL.set(body, kept = new Map()); if (kept.has(key)) return kept.get(key);
  let share = 0.972, G = kneelingAt(rig, body, set, share);
  for (let i = 0; i < 5; i++) { const c = crawlOn(rig, body, set, G); let most = 0;
    for (let f = 0; f < c.n; f++) { const info = build(rig, c.ctrl(f)).info; most = Math.max(most, info.armReach_l || 0, info.armReach_r || 0); }
    if (most <= 0.975) break; share -= most - 0.968; G = kneelingAt(rig, body, set, share); }
  if (kept.size > 8) kept.delete(kept.keys().next().value);
  kept.set(key, G); return G;
}
// one frame on hands and knees. a: { K: { l, r } the knees (where each is, or is wanted), w: { l, r } 1 down .. 0
// carried, W: { l, r } the wrists (null: that arm by `arms`), px, pz, yaw, roll0, chest: { yaw, roll, pitch (added) },
// head, curl, pitch (added to the pelvis), arms: { l, r } }
function fours(rig, G, a) {
  const { l1, l2, aLie } = G, pitch = G.thP + (a.pitch || 0), yaw = a.yaw || 0, hipOf = (y, roll, s) => V.add([a.px || 0, y, a.pz || 0], Q.rot(turnOf(yaw, roll, pitch), rig.leg(s).hip));
  const res = x => { const out = [0.05 * (x[1] - (a.roll0 || 0))];
    for (const s of ["l", "r"]) { const d = V.dist(hipOf(x[0], x[1], s), a.K[s]), w = a.w[s]; out.push(w * (d - l1), (1 - w) * Math.max(0, l1 - d)); }
    return out; };
  const [y, roll] = fit2(res, [G.y0, a.roll0 || 0]), c = { breath: a.breath || 0, legs: {}, arms: {} };
  c.pelvis = { pos: [a.px || 0, y, a.pz || 0], yaw, roll, pitch };
  const ch = a.chest || {}; c.chest = { yaw: ch.yaw || 0, roll: ch.roll || 0, pitch: G.thC + (ch.pitch || 0) }; c.head = a.head || { pitch: 34 * DEG }; c.neck = a.neck ?? 0.42;
  for (const [s, g] of [["l", 1], ["r", -1]]) {
    const H = hipOf(y, roll, s), K = V.add(H, V.mul(V.norm(V.sub(a.K[s], H)), l1));            // the knee where the thigh can put it: on its mark when it's down
    const dy = Math.min(0, aLie - K[1]), A = [K[0] - g * 0.012, K[1] + dy, K[2] - Math.sqrt(Math.max(1e-6, l2 * l2 - dy * dy - 0.012 * 0.012))];
    c.legs[s] = { ankle: A, pole: V.sub(K, V.lerp(H, A, 0.5)), yaw: g * 5 * DEG, pitch: -(150 + 12 * (1 - a.w[s])) * DEG, knee: 0 };
    c.arms[s] = a.W && a.W[s] ? planted(rig, s, a.W[s], { curl: a.curl, droop: a.droop ? a.droop[s] : 0 }) : (a.arms || {})[s] || {};
  }
  return c;
}

/** crawling on hands and knees: "crawl_loop" (in place: `speed` says how fast it travels) */
export function crawl(rig, body, set) { return crawlOn(rig, body, set, kneeling(rig, body, set)); }
function crawlOn(rig, body, set, G) {
  const { p, sc, a, beta, kx, hx, kneeR, wristH, zc } = G, sw = 1 - beta;
  const lift = Math.max((0.075 + 0.02 * p.strong) * sc, G.drop1 - wristH + 0.006 * sc);                      // a carried hand hangs from its wrist: lifted far enough that its fingertips clear the floor
  const T0 = clamp(1.3 - 0.24 * p.pw + 0.25 * p.heavy, 0.9, 1.85), N = Math.max(20, 2 * Math.round(T0 * FPS / 2)), T = N / FPS, v = 2 * a / (T * beta), S = v * T;
  const zSwing = path([[0, -a], [1, a]], -2 * a * sw / beta, -2 * a * sw / beta * 0.5), hb = 0.62, hsw = 1 - hb, ah = v * T * hb / 2, hSwing = path([[0, -ah], [1, ah]], -2 * ah * hsw / hb, -2 * ah * hsw / hb * 0.5);
  const knee = (g, psi) => { psi = wrap01(psi); if (psi <= beta) return { K: [g * kx, kneeR, a * (1 - 2 * psi / beta)], w: sm(0, 0.05, psi) * (1 - sm(beta - 0.05, beta, psi)) };
    const u = (psi - beta) / sw; return { K: [g * kx, kneeR + 0.03 * sc * Math.sin(Math.PI * u), zSwing(u)], w: 0 }; };
  const wrist = (g, psi) => { psi = wrap01(psi); if (psi <= hb) return [g * hx, wristH, zc + ah * (1 - 2 * psi / hb)]; const u = (psi - hb) / hsw; return [g * hx, wristH + lift * Math.sin(Math.PI * u) ** 0.8, zc + hSwing(u)]; };
  const ctrl = f => { const phi = wrap01(f / N), kl = knee(1, phi), kr = knee(-1, phi + 0.5), cy = Math.cos(TAU * phi), b = Math.sin(2 * TAU * phi);
    const droop = psi => { psi = wrap01(psi); return psi <= hb ? 0 : Math.sin(Math.PI * (psi - hb) / hsw); };      // (a carried hand hangs a little from its wrist)
    const c = fours(rig, G, { K: { l: kl.K, r: kr.K }, w: { l: kl.w, r: kr.w }, W: { l: wrist(1, phi + 0.5 + 0.04), r: wrist(-1, phi + 0.04) }, droop: { l: droop(phi + 0.54), r: droop(phi + 0.04) },
      px: 0.012 * sc * Math.cos(TAU * (phi - 0.3)), pz: 0.01 * sc * Math.cos(2 * TAU * (phi - 0.15)), yaw: -5 * DEG * cy, roll0: 7 * DEG * Math.sin(TAU * (phi - 0.04)),
      chest: { yaw: 6 * DEG * Math.cos(TAU * (phi - 0.04)), roll: -3 * DEG * Math.sin(TAU * phi), pitch: 1.2 * DEG * b }, head: { yaw: 3 * DEG * cy, roll: 2 * DEG * Math.sin(TAU * phi), pitch: 34 * DEG + 1.5 * DEG * b }, breath: 0.4 * b });
    c.phase = phi; return c; };
  return { name: "crawl_loop", loop: true, n: N, fps: FPS, secs: T, speed: v, stride: S, ctrl, events: [{ t: 0, name: "knee_l" }, { t: T / 2, name: "knee_r" }], plan: { beta, a, kneeR, wristH, kx, hx, slope: G.thC } };
}

/** on all fours, still: a frame of it (`a`: what differs: see fours), for the idle and for what starts from it */
export function allFours(rig, body, set, a = {}, G = null) {
  G = G || kneeling(rig, body, set); const { sc, kx, hx, kneeR, wristH, zc } = G;
  return fours(rig, G, { K: { l: [kx, kneeR, 0.03 * sc], r: [-kx, kneeR, -0.03 * sc] }, w: { l: 1, r: 1 }, W: { l: [hx, wristH, zc - 0.02 * sc], r: [-hx, wristH, zc + 0.03 * sc] }, roll0: 0, ...a });
}
// the idle on all fours at a time: what differs from the plain frame (fours' `a`)
export function idleAt(G, t) { const sc = G.sc, b = Math.sin(TAU * t / 4), w = Math.sin(TAU * t / 8), w2 = Math.sin(TAU * t / 8 + 1.2);
  return { px: 0.012 * sc * w, pz: 0.008 * sc * w2, yaw: 1.5 * DEG * w2, chest: { yaw: -2 * DEG * w2, roll: 1 * DEG * w, pitch: -1.6 * DEG * b }, head: { yaw: 16 * DEG * Math.sin(TAU * t / 8 + 0.4), roll: 3 * DEG * w, pitch: 28 * DEG - 2 * DEG * b }, breath: b }; }
/** stopped on all fours, breathing, the head moving: "crawl_idle_loop". 8 s. */
export function crawlIdle(rig, body, set) {
  const G = kneeling(rig, body, set), N = 8 * FPS;
  return { name: "crawl_idle_loop", loop: true, n: N, fps: FPS, secs: N / FPS, ctrl: f => allFours(rig, body, set, idleAt(G, (f % N) / FPS), G), events: [], meta: {} };
}
export { kneeling, planted, handDrop };

// ---- hands and feet ---------------------------------------------------------------------------------------------------
/** a creature's scuttle: on its hands and the balls of its feet, low and quick, the back rounded: "scuttle_loop".
    The feet are behind the hips and the knees ahead of them and a little out, as a person's go (knees carried out
    to the sides over feet set under them would ask the hips for a lizard's turn); the pelvis is tucked under a
    rounded back, which keeps the hips inside what a hip folds. */
export function scuttle(rig, body, set) {
  const p = params(body, set), sc = p.sc, F = body.foot, aH = body.ankleH, l1 = body.thigh, l2 = body.shank, arm = body.upper + body.fore;
  const CLAW = { curl: 0.3, tilt: -8, out: 20 }, wristH = Math.max(0.028 * sc, handDrop(rig, CLAW) - 0.003 * sc), lift = Math.max(0.08 * sc, handDrop(rig, { ...CLAW, droop: 1 }) - wristH + 0.006 * sc);   // (as the crawl's: by the hand's own fingers)
  const T0 = clamp(0.54 - 0.07 * p.pw + 0.12 * p.heavy, 0.42, 0.8), N = Math.max(12, 2 * Math.round(T0 * FPS / 2)), T = N / FPS, beta = 0.5, sw = 1 - beta;
  const ah = clamp(0.36 * arm, 0.1, 0.19), v = 2 * ah / (T * beta), S = v * T, af = ah;                               // each contact goes `2 ah` back under her, hands and feet alike
  const width = (0.3 + 0.05 * p.heavy) * sc, toeOut = 20 * DEG, heel = 44 * DEG, out = (0.08 + 0.03 * p.heavy) * sc, hx = body.shoulderHalf + out;
  const zf = -0.27 * sc, foot = (g, psi) => ankleAt(F, aH, [g * width / 2, 0, zf + af * (1 - 2 * psi / beta)], g * toeOut, -heel);
  const mkFoot = g => { const A0 = foot(g, beta), A1 = foot(g, 0), zOf = path([[0, A0[2]], [1, A1[2]]], -2 * af * sw / beta, -2 * af * sw / beta * 0.5);
    return psi => { psi = wrap01(psi); if (psi <= beta) return foot(g, psi); const u = (psi - beta) / sw; return [A0[0], A0[1] + 0.06 * sc * Math.sin(Math.PI * u), zOf(u)]; }; };
  const footL = mkFoot(1), footR = mkFoot(-1), mid = foot(1, beta / 2), hipDx = width / 2 - body.hipHalf;
  // the trunk: the shoulders where arms bent a little hold them, the pelvis tucked under the chest; the
  // knees bent until the hips are low enough for the back to be about level (never the head hung below the hips)
  const TUCK = 38 * DEG, shY = wristH + Math.sqrt(Math.max(0.01, (0.93 * arm) ** 2 - (ah + 0.04 * sc) ** 2 - out * out));
  let kneeBend = 0, y0 = 0, thC = 0;
  for (let kb = 118 - 8 * p.heavy; kb <= 138; kb += 2) { kneeBend = kb * DEG; const reach = Math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(kneeBend));
    y0 = mid[1] + Math.sqrt(Math.max(0.004, reach * reach - hipDx * hipDx - mid[2] * mid[2])) - rig.legL.hip[1];
    let lo = 50 * DEG, hi = 130 * DEG; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (y0 + shouldersFrom(rig, m - TUCK, m).l[1] > shY) lo = m; else hi = m; }
    thC = (lo + hi) / 2; if (thC <= 114 * DEG) break; }
  const thP = thC - TUCK, sh = shouldersFrom(rig, thP, thC), zc = sh.l[2] + 0.03 * sc;
  const hSwing = path([[0, -ah], [1, ah]], -2 * ah * sw / beta, -2 * ah * sw / beta * 0.5);
  const wrist = (g, psi) => { psi = wrap01(psi); if (psi <= beta) return [g * hx, wristH, zc + ah * (1 - 2 * psi / beta)]; const u = (psi - beta) / sw; return [g * hx, wristH + lift * Math.sin(Math.PI * u), zc + hSwing(u)]; };
  const ctrl = f => { const phi = wrap01(f / N), cy = Math.cos(TAU * phi), sy = Math.sin(TAU * phi), b = Math.cos(2 * TAU * (phi - 0.1)), c = { phase: phi, breath: 0 };
    c.pelvis = { pos: [0.01 * sc * Math.cos(TAU * (phi - 0.25)), y0 - 0.012 * sc * b, 0.012 * sc * Math.cos(2 * TAU * phi)], yaw: -8 * DEG * cy, roll: 5 * DEG * Math.sin(TAU * (phi - 0.05)), pitch: thP };
    c.chest = { yaw: 9 * DEG * Math.cos(TAU * (phi - 0.03)), roll: -4 * DEG * sy, pitch: thC + 1.5 * DEG * b }; c.head = { yaw: 4 * DEG * cy, roll: 9 * DEG + 5 * DEG * sy, pitch: 38 * DEG }; c.neck = 0.4;
    c.legs = {}; c.arms = {};
    for (const [s, g] of [["l", 1], ["r", -1]]) { const psi = wrap01(g > 0 ? phi : phi + 0.5), A = (g > 0 ? footL : footR)(psi), up = psi > beta ? Math.sin(Math.PI * (psi - beta) / sw) : 0;
      c.legs[s] = { ankle: A, yaw: g * toeOut, pitch: -heel - 12 * DEG * up, toe: heel * (1 - 0.6 * up), pole: [g * 0.42, -0.3, 1] };
      const hpsi = wrap01((g > 0 ? phi + 0.5 : phi) + 0.03);
      c.arms[s] = planted(rig, s, wrist(g, hpsi), { pole: [g * 1, 0.25, -0.5], ...CLAW, droop: hpsi <= beta ? 0 : Math.sin(Math.PI * (hpsi - beta) / sw) }); }
    c.clav = { l: { up: 6 * DEG, fwd: 4 * DEG }, r: { up: 6 * DEG, fwd: 4 * DEG } };
    return c; };
  return { name: "scuttle_loop", loop: true, n: N, fps: FPS, secs: T, speed: v, stride: S, ctrl, events: [{ t: 0, name: "step_l" }, { t: T / 2, name: "step_r" }], plan: { beta, width, heel, hx, slope: thC, tuck: TUCK, kneeBend } };
}
