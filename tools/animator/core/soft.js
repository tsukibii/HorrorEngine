// Animator v2: soft tissue (docs/ANIMATOR_V2.md §7). A few extra bones the body's flesh hangs from: one in each
// breast, one in the belly, one in each buttock, one on the outside of each hip, one inside each thigh. They are bones
// and not morph targets, so the face's shapes stay their own layer; and whatever is skinned where they are goes with
// them: skin and clothes alike. Each is sized and weighted from the body's own measures (a flat chest gets next to
// nothing, a full one a slow, deep bounce).
//
// Each swings as a jiggle bone does, after JiggleBones for Godot (the asset library's 1595: BauxiteDev, Cory
// Petkovsek, Yael Atletl; MIT), the plugin the user pointed to (DECISIONS 2026-11-13, the hands and the jiggle). Its
// way, written again here: the bone is a rod from where the flesh is rooted (the bone's joint) to where its weight is;
// the weight is a point that keeps going as it was going (Verlet), is pulled each tick toward where the rod points at
// rest (times `stiffness`), loses a share of its speed (`damping`), and is put back at the rod's length from the
// joint; the bone is turned to point at it. So flesh swings from its root in arcs, lags when the body starts, carries
// on when it stops and rings a few times: the plugin's look. On top, what flesh needs and a tail doesn't: where it
// rests follows which way is down (lying, bent over), how much shows comes from the body's measures, and it has a
// limit. Baked into every clip at the plugin's own 60 ticks a second; the same steps run live in Godot (the look
// plugin's HSSoftJiggle), where they answer what no clip knows: a stop, a turn, a clip of the user's own.
//
// Three things are not swing and stay as they were, as the bone's own shift: the inner thighs giving way where the
// two legs would otherwise pass through each other (a heavy thigh squashes against the other instead of the walk
// going wide), a seat pressed flat by what it sits on, the belly's breath.
import { V, Q, clamp, sm } from "./m.js";
import { SIDES, SGN, skinned, partKind } from "./rig.js";
import { jointSegments, SEG } from "./measure.js";
import { addJoints, setWeights } from "./bake.js";

const G = [0, -1, 0];
export const TICK = 1 / 60;                                   // the plugin steps in Godot's physics tick

// JiggleBones' numbers for a bone that should ring at `f` Hz: at 60 ticks a second its pull shrinks a swing by
// 1 / (1 + 9.81 * stiffness / 60) a tick, which with the weight's own momentum rings at acos(sqrt(that)) a tick
export const stiffOf = f => { const c = Math.cos(2 * Math.PI * f * TICK) ** 2; return (1 / c - 1) / (9.81 * TICK); };
/** how a jiggle bone rings: { f (Hz), half (s: the time it takes to lose half its swing) }: the plugin's rule solved */
export function ringOf(stiff, damp) { const c = 1 / (1 + 9.81 * stiff * TICK), k = Math.max(0, 1 - damp * TICK), r = Math.sqrt(c * k), co = c * (1 + k) / (2 * r);
  return co >= 1 ? { f: 0, half: Math.log(0.5) / Math.log(c * (1 + k) / 2 + Math.sqrt((c * (1 + k) / 2) ** 2 - c * k)) * TICK } : { f: Math.acos(co) / (2 * Math.PI * TICK), half: Math.log(0.5) / Math.log(r) * TICK }; }
/** one tick of a jiggle bone's weight: st { x, xp, j } (the point now and a tick ago, in the world, and where the
    joint was a tick ago) stepped in place. joint: where the bone is; pull: the unit direction it rests along; len:
    the rod; stiff, damp: the plugin's two.
    One thing is not the plugin's: what `damping` slows is the weight's speed against its joint's, not against the
    world's. Flesh is held by the body it's on, not by the air; and on a rod of a few centimetres (the plugin's is a
    whole unit) a drag against the world would lean every soft bone back at walking pace and lay it flat at a run.
    With the joint still the two are the same rule: it rings exactly as the plugin's does. */
export function jiggleTick(st, joint, pull, len, stiff, damp) {
  const k = Math.max(0, 1 - damp * TICK), imp = 9.81 * stiff * len * TICK, x = st.x, xp = st.xp, j = st.j || joint, c = 1 - k;   // (times len: `stiffness` then means what it means on the plugin's rod of one unit, whatever this rod's length)
  const nx = x[0] + ((x[0] - xp[0]) + pull[0] * imp) * k + (joint[0] - j[0]) * c, ny = x[1] + ((x[1] - xp[1]) + pull[1] * imp) * k + (joint[1] - j[1]) * c, nz = x[2] + ((x[2] - xp[2]) + pull[2] * imp) * k + (joint[2] - j[2]) * c;
  const dx = nx - joint[0], dy = ny - joint[1], dz = nz - joint[2], l = Math.hypot(dx, dy, dz) || 1, q = len / l;
  st.xp = x; st.x = [joint[0] + dx * q, joint[1] + dy * q, joint[2] + dz * q]; st.j = [joint[0], joint[1], joint[2]];
}
/** which way a bone rests: along its own direction as its parent carries it (restW), tipped by how far gravity has
    moved against the body since it stood (down in the world, less down as the body has it) */
export const pullOf = (restW, downBody, grav) => V.norm([restW[0] + grav * (G[0] - downBody[0]), restW[1] + grav * (G[1] - downBody[1]), restW[2] + grav * (G[2] - downBody[2])]);

/** the soft bones a body gets: [{ name, kind, side, parent, at (the middle of what it moves), pivot (its joint: where
    the flesh is rooted), dir, len (the rod from the joint to the middle), ax: [three unit axes], r: [three radii],
    wmax, amount, stiff, damp (JiggleBones' stiffness and damping), grav (how much gravity moves where it rests), show
    (how much of its swing is shown), max (m, the most its middle moves), family: Set of joints its weight is taken
    from, medial }] */
export function softPlan(rig, body) {
  const s = body.height / 1.65, segJ = jointSegments(rig), heavy = Math.max(0, body.build), out = [], XYZ = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const fam = (...segs) => new Set(rig.J.map((_, i) => i).filter(i => segs.includes(segJ[i]) && !rig.J[i].soft));
  const firm = clamp(0.8 + 0.3 * body.build, 0.6, 1.1);      // a seat that stands out on a lean body is muscle: it moves less than the same seat on a soft one
  // (`show`: how much of the swing worked out is shown, by kind: a breast swings freely; a buttock, a hip, a thigh are
  //  flesh over muscle, held closer, and ring higher and shorter)
  const add = (name, kind, g, parent, at, pivot, r, wmax, amount, f, damp, grav, max, show, family, more = {}) => { if (amount <= 0.04) return; const d = V.sub(at, pivot), len = V.len(d);
    out.push({ name: "soft_" + name, kind, side: g, parent, at, pivot, dir: V.mul(d, 1 / len), len, ax: more.ax || XYZ, r, wmax, amount, f, stiff: stiffOf(f), damp, grav, max: max * amount, show, family, ...more }); };
  for (const sd of SIDES) {
    const g = SGN[sd], L = rig.leg(sd);
    // a breast: its middle half way from its apex back to the ribs, hung from the chest wall above and behind it
    const bo = body.bustOut, a = body.apex["bust_" + sd], am = clamp(bo / (0.04 * s) - 0.15, 0, 1.3), bc = [a[0], a[1] - 0.004 * s, a[2] - 0.5 * bo - 0.005];
    add("bust_" + sd, "bust", g, rig.chest, bc, [bc[0], bc[1] + 0.04 * s, bc[2] - 0.035 * s - 0.45 * bo], [0.07 * s * (0.8 + 0.5 * am), 0.075 * s * (0.8 + 0.5 * am), bo * 0.95 + 0.03 * s], 0.6, am, clamp(3.5 - 1.0 * am, 2.2, 3.5), 2, 0.5, 0.028, 1, fam(SEG.trunk));
    // a buttock, hung from the pelvis above and in front of it; and the outside of the hip beside it
    const so = body.seatOut, sa = body.apex["seat_" + sd], sam = clamp(so / (0.075 * s) + 0.3 * heavy - 0.1, 0, 1.4), sc = [sa[0], sa[1], sa[2] + 0.45 * (0.6 * so + 0.03 * s)];
    add("seat_" + sd, "seat", g, rig.pelvis, sc, [sc[0] - g * 0.015 * s, sc[1] + 0.065 * s, sc[2] + 0.075 * s + 0.25 * so], [0.085 * s * (1 + 0.25 * heavy), 0.1 * s, 0.05 * s + 0.6 * so], 0.55, sam, clamp(4.3 - 0.7 * sam, 3.2, 4.3), 6, 0.3, 0.02, 0.7 * firm, fam(SEG.trunk, SEG["legU_" + sd]));
    const ha = body.apex["hip_" + sd], ham = clamp(body.hipFlare / (0.07 * s) + 0.45 * heavy - 0.25, 0, 1.3), hc = [ha[0] - g * 0.035 * s, ha[1] - 0.02 * s, ha[2]];
    add("hip_" + sd, "hip", g, rig.pelvis, hc, [hc[0] - g * 0.085 * s, hc[1] + 0.06 * s, hc[2]], [0.055 * s + 0.5 * body.hipFlare, 0.11 * s, 0.09 * s], 0.5, ham, clamp(4.4 - 0.6 * ham, 3.4, 4.4), 7, 0.25, 0.016, 0.65 * firm, fam(SEG.trunk, SEG["legU_" + sd]));
    // the inside of a thigh: along the thigh, toward the other leg, rooted on the thigh's own line
    const A = rig.J[L.up].at, K = rig.J[L.low].at, d = V.norm(V.sub(K, A)), fz = V.norm(V.perp([0, 0, 1], d)), med = V.mul(V.cross(fz, d), -g), len = V.dist(A, K);
    const mr = interpMed(body.thighIn, 0.32), tam = clamp((body.r.thigh - 0.068 * s) / (0.04 * s) + 0.3 * heavy, 0.12, 1.3);
    add("thigh_" + sd, "thigh", g, L.up, V.add(V.mad(A, d, 0.32 * len), V.mul(med, 0.55 * mr)), V.add(V.mad(A, d, 0.32 * len - 0.04 * s), V.mul(med, -0.6 * mr)), [0.38 * len, 1.3 * mr, 1.25 * Math.max(body.r.thigh, mr)], 0.7, tam, clamp(4.9 - 0.6 * tam, 4, 4.9), 9, 0.2, 0.012, 0.5 * firm, fam(SEG["legU_" + sd], SEG.trunk),
      { ax: [d, med, fz], medial: med, axis: { a: A.slice(), d, len } });
  }
  // the belly, hung from under the ribs, toward the spine
  const b = body.apex.belly, bo = body.bellyOut, bam = clamp(0.14 + bo / (0.05 * s) + 0.35 * heavy, 0.14, 1.4), bc = [0, b[1], b[2] - 0.4 * (bo + 0.03 * s)];
  add("belly", "belly", 0, rig.spine[1], bc, [0, bc[1] + 0.07 * s, bc[2] - 0.07 * s - 0.4 * bo], [0.85 * body.half.waist, Math.max(0.07 * s, 0.42 * (body.levels.under - body.crotchY)), 0.05 * s + bo], 0.55, bam, clamp(3.1 - 0.5 * bam, 2.3, 3.1), 3, 0.55, 0.022, 0.8, fam(SEG.trunk));
  return out;
}
/** a soft bone's numbers as they are used, with the sliders in: softness (0..1.5: how much shows) and bounce (0: it
    settles at once .. 0.5: as made .. 1: the plugin's own default, no damping: it rings longest)
    -> { stiff, damp, grav, gain (the swing shown for the swing worked out), limit (rad) } */
export function softUse(b, set = {}) {
  const amt = clamp(set.soft ?? 1, 0, 1.5), bounce = clamp(set.bounce ?? 0.5, 0, 1);
  return { stiff: b.stiff, damp: b.damp * (bounce >= 0.5 ? 2 * (1 - bounce) : 1 + 10 * (0.5 - bounce)), grav: b.grav, gain: b.show * b.amount * amt / b.wmax, limit: b.max * Math.max(amt, 0.001) / (b.len * b.wmax) };
}
const interpMed = (bins, f) => { if (f <= bins[0].f) return bins[0].med; for (let i = 0; i < bins.length - 1; i++) if (f <= bins[i + 1].f) return bins[i].med + (bins[i + 1].med - bins[i].med) * (f - bins[i].f) / (bins[i + 1].f - bins[i].f); return bins[bins.length - 1].med; };

// how much of a point a soft bone takes (0..wmax): 1 at its middle, 0 at its edge; the inner thigh's only on its inside
function share(b, p) {
  const v = [p[0] - b.at[0], p[1] - b.at[1], p[2] - b.at[2]]; let d2 = 0;
  for (let k = 0; k < 3; k++) { const c = V.dot(v, b.ax[k]) / b.r[k]; d2 += c * c; if (d2 >= 1) return 0; }
  let m = (1 - d2) * (1 - d2); if (b.medial) m *= sm(-0.45, 0.25, V.dot(v, b.medial) / b.r[1]);
  return m * b.wmax;
}

/** the soft bones put into the file: joints added under the rig's, and every skin or garment vertex in a soft bone's
    reach given a share of it (taken from the bones it was on). -> the plan, each bone with its rig index (`j`) */
export function softRig(glb, rig, body, undo) {
  const plan = softPlan(rig, body); if (!plan.length) return plan;
  const idx = addJoints(glb, rig, plan.map(b => ({ name: b.name, parent: b.parent, at: b.pivot })), undo); plan.forEach((b, k) => { b.j = idx[k]; });
  const j = glb.json; let moved = 0;
  for (const part of skinned(glb)) {
    if (partKind(part.name) === "other") continue;
    const joints = j.skins[part.skin].joints, toRig = joints.map(nd => rig.J.findIndex(b => b.node === nd)), slot = new Map(toRig.map((r, k) => [r, k]));
    j.meshes[part.mesh].primitives.forEach((pr, pi) => {
      if (pr.attributes.JOINTS_0 == null || pr.attributes.WEIGHTS_0 == null) return;
      const P = glb.read(pr.attributes.POSITION), JI = glb.read(pr.attributes.JOINTS_0), JW = glb.read(pr.attributes.WEIGHTS_0, { float: true }), n = P.length / 3, NI = new Uint16Array(n * 4), NW = new Float32Array(n * 4); let any = false;
      for (let v = 0; v < n; v++) {
        const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], cand = [];
        for (const b of plan) { const m = share(b, p); if (m > 0.004) cand.push([m, b]); }
        const inf = []; for (let k = 0; k < 4; k++) if (JW[v * 4 + k] > 0) inf.push([toRig[JI[v * 4 + k]], JW[v * 4 + k]]);
        if (cand.length) {
          cand.sort((a, c) => c[0] - a[0]); cand.length = Math.min(cand.length, 2); const tot = cand.reduce((a, c) => a + c[0], 0), k = tot > 0.8 ? 0.8 / tot : 1;
          for (const [m0, b] of cand) { const m = m0 * k; let fam = 0; for (const e of inf) if (b.family.has(e[0])) fam += e[1]; if (fam < 1e-4) continue; for (const e of inf) if (b.family.has(e[0])) e[1] *= 1 - m; inf.push([b.j, m * fam]); any = true; }
          inf.sort((a, c) => c[1] - a[1]); inf.length = Math.min(inf.length, 4); const sum = inf.reduce((a, e) => a + e[1], 0) || 1; for (const e of inf) e[1] /= sum; moved++;
        }
        for (let k = 0; k < 4; k++) { NI[v * 4 + k] = k < inf.length ? slot.get(inf[k][0]) : 0; NW[v * 4 + k] = k < inf.length ? inf[k][1] : 0; }
      }
      if (any) setWeights(glb, part.mesh, pi, NI, NW, undo);
    });
  }
  plan.moved = moved;
  return plan;
}

/** the soft bones' motion over a clip's poses (clips.js poses), set on the poses (each solved again). set.soft scales
    it, set.bounce is how long it rings; a frame's controls may say `press: { seat, back }` (sat or lain on: 0..1) and
    `breath` (-1..1).
    -> { name: most its middle moved (mm) }, and `thighs`: { before, after }: how far the thighs overlapped, mm */
export function softMotion(rig, body, plan, clip, frames, set = {}) {
  const n = frames.length, dt = 1 / clip.fps, SUB = Math.max(1, Math.round(dt / TICK)), loop = !!clip.loop, stats = {};
  const wrap = i => loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i)), Pj = (f, j) => { const P = frames[f].solved.P; return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; };
  const off = plan.map(() => Array.from({ length: n }, () => [0, 0, 0])), swing = plan.map(() => new Array(n).fill(null));
  // ---- the swing: each bone a jiggle bone, stepped through the clip (a loop three times round, so it's in its stride) ----
  plan.forEach((b, bi) => {
    const p = b.parent, rel = V.sub(b.pivot, rig.J[p].at), u = softUse(b, set), Dp = f => frames[f].solved.D[p], joint = f => V.add(Pj(f, p), Q.rot(Dp(f), rel));
    const rest0 = pullOf(Q.rot(Dp(0), b.dir), Q.rot(Dp(0), G), u.grav), st = { x: V.mad(joint(0), rest0, b.len), xp: null, j: joint(0) }; st.xp = st.x.slice();
    const laps = loop ? 3 : 1; let most = 0;
    for (let lap = 0; lap < laps; lap++) for (let f = 0; f < n; f++) {
      if (lap === laps - 1) {                                  // the bone turned to point at its weight, as much of it as shows
        const J = joint(f), rw = Q.rot(Dp(f), b.dir), tw = V.norm(V.sub(st.x, J)), ax = V.cross(rw, tw), sn = V.len(ax), th = Math.atan2(sn, V.dot(rw, tw)), show = u.limit > 0 ? u.limit * Math.tanh(u.gain * th / u.limit) : 0;
        swing[bi][f] = sn > 1e-9 && show > 1e-7 ? Q.mul(Q.axis(V.mul(ax, 1 / sn), show), Dp(f)) : null; most = Math.max(most, show * b.len * b.wmax); }
      if (f === n - 1 && !loop) break;
      const f1 = wrap(f + 1), J0 = joint(f), J1 = joint(f1);
      for (let k = 1; k <= SUB; k++) { const t = k / SUB, D = Q.slerp(Dp(f), Dp(f1), t); jiggleTick(st, V.lerp(J0, J1, t), pullOf(Q.rot(D, b.dir), Q.rot(D, G), u.grav), b.len, u.stiff, u.damp); }
    }
    stats[b.name] = +(most * 1000).toFixed(1);
  });
  // ---- sat on, lain on, breathing ---------------------------------------------------------------------------------
  plan.forEach((b, bi) => { for (let f = 0; f < n; f++) { const c = frames[f].c, pr = c.press || {}, o = off[bi][f], k = b.amount / b.wmax;
    if (b.kind === "seat") { o[1] += 0.016 * (pr.seat || 0) * k; o[2] += (0.008 * (pr.seat || 0) + 0.018 * (pr.back || 0)) * k; o[0] += b.side * 0.006 * ((pr.seat || 0) + (pr.back || 0)) * k; }
    else if (b.kind === "hip") o[0] += b.side * 0.012 * Math.max(pr.seat || 0, pr.back || 0) * k;
    else if (b.kind === "belly") o[2] += 0.005 * (c.breath || 0) * (0.6 + b.amount) / b.wmax;
    else if (b.kind === "bust") o[1] += 0.002 * (c.breath || 0) / b.wmax; } });
  // ---- the thighs, where they would pass through each other ---------------------------------------------------------
  const tl = plan.findIndex(b => b.name === "soft_thigh_l"), tr = plan.findIndex(b => b.name === "soft_thigh_r"); stats.thighs = { before: 0, after: 0 };
  if (tl >= 0 && tr >= 0) {
    const ST = [0.1, 0.2, 0.3, 0.42, 0.55, 0.68], LL = rig.legL, LR = rig.legR, push = { l: [], r: [] }, pad = 0.0015, axial = (b, f) => { const c = (f - 0.32) * b.axis.len / b.r[0]; return Math.max(0, 1 - c * c) ** 2; };
    for (let f = 0; f < n; f++) {
      const aL = Pj(f, LL.up), bL = Pj(f, LL.low), aR = Pj(f, LR.up), bR = Pj(f, LR.low), abR = V.sub(bR, aR); let wl = [0, 0, 0], wr = [0, 0, 0], ml = 0, mr = 0, worst = 0;
      for (const fi of ST) { const cL = V.lerp(aL, bL, fi), t = clamp(V.dot(V.sub(cL, aR), abR) / V.dot(abR, abR), 0, 1), cR = V.mad(aR, abR, t), d = V.dist(cL, cR), o = interpMed(body.thighIn, fi) + interpMed(body.thighIn, t) - d;
        if (o <= 0) continue; worst = Math.max(worst, o); const dir = V.mul(V.sub(cL, cR), 1 / (d || 1)), need = o / 2 + pad;
        const kl = need / (plan[tl].wmax * Math.max(axial(plan[tl], fi), 0.35)), kr = need / (plan[tr].wmax * Math.max(axial(plan[tr], t), 0.35));
        if (kl > ml) { ml = kl; wl = V.mul(dir, Math.min(kl, 0.05)); } if (kr > mr) { mr = kr; wr = V.mul(dir, -Math.min(kr, 0.05)); } }
      push.l.push(Q.rot(Q.conj(frames[f].solved.D[LL.up]), wl)); push.r.push(Q.rot(Q.conj(frames[f].solved.D[LR.up]), wr)); stats.thighs.before = Math.max(stats.thighs.before, worst * 1000);
      stats.thighs.after = Math.max(stats.thighs.after, Math.max(0, worst - Math.min(ml, 0.05) * plan[tl].wmax * 0.5 - Math.min(mr, 0.05) * plan[tr].wmax * 0.5) * 1000);
    }
    for (const [key, bi] of [["l", tl], ["r", tr]]) for (let f = 0; f < n; f++) { const o = off[bi][f]; let t = [0, 0, 0], w = 0; for (let k = -2; k <= 2; k++) { const g = Math.exp(-k * k / 2), q = push[key][wrap(f + k)]; t = V.mad(t, q, g); w += g; } off[bi][f] = V.add(o, V.mul(t, 1 / w)); }
    stats.thighs.before = +stats.thighs.before.toFixed(1); stats.thighs.after = +stats.thighs.after.toFixed(1);
  }
  for (let f = 0; f < n; f++) { plan.forEach((b, bi) => { frames[f].pose.off.set(b.j, off[bi][f]); frames[f].pose.D[b.j] = swing[bi][f]; }); frames[f].solved = frames[f].pose.solve(); }
  return stats;
}
