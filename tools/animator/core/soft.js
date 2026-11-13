// Animator v2: soft tissue (docs/ANIMATOR_V2.md §7). A few extra bones the body's flesh hangs from: one in each
// breast, one in the belly, one in each buttock, one on the outside of each hip, one inside each thigh. They are bones
// and not morph targets, so the face's shapes stay their own layer; and whatever is skinned where they are goes with
// them: skin and clothes alike. Each is sized and weighted from the body's own measures (a flat chest gets next to
// nothing, a full one a slow, deep bounce), swings on a spring driven by how its part of the body is thrown about and
// by which way is down, and is baked into every clip. The inner thighs also give way where the two legs would
// otherwise pass through each other: a heavy thigh squashes against the other instead of the walk going wide.
import { V, Q, clamp, sm } from "./m.js";
import { SIDES, SGN, skinned, partKind } from "./rig.js";
import { jointSegments, SEG } from "./measure.js";
import { addJoints, setWeights } from "./bake.js";

const G = [0, -1, 0];

/** the soft bones a body gets: [{ name, kind, side, parent, at, ax: [three unit axes], r: [three radii], wmax, amount,
    f (Hz), z (damping), sag (m), max (m), family: Set of joints its weight is taken from, medial: [dir, radius] }] */
export function softPlan(rig, body) {
  const s = body.height / 1.65, segJ = jointSegments(rig), heavy = Math.max(0, body.build), out = [], XYZ = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const fam = (...segs) => new Set(rig.J.map((_, i) => i).filter(i => segs.includes(segJ[i]) && !rig.J[i].soft));
  const add = (name, kind, g, parent, at, r, wmax, amount, f, z, sag, max, family, more = {}) => { if (amount > 0.04) out.push({ name: "soft_" + name, kind, side: g, parent, at, ax: more.ax || XYZ, r, wmax, amount, f, z, sag: sag * amount, max: max * amount, family, ...more }); };
  for (const sd of SIDES) {
    const g = SGN[sd], L = rig.leg(sd);
    // a breast: from its apex half way back to the ribs
    const bo = body.bustOut, a = body.apex["bust_" + sd], am = clamp(bo / (0.04 * s) - 0.15, 0, 1.3);
    add("bust_" + sd, "bust", g, rig.chest, [a[0], a[1] - 0.004 * s, a[2] - 0.5 * bo - 0.005], [0.07 * s * (0.8 + 0.5 * am), 0.075 * s * (0.8 + 0.5 * am), bo * 0.95 + 0.03 * s], 0.6, am, clamp(3.5 - 1.0 * am, 2.2, 3.5), 0.26, 0.012, 0.028, fam(SEG.trunk));
    // a buttock, and the outside of the hip beside it
    const so = body.seatOut, sa = body.apex["seat_" + sd], sam = clamp(so / (0.075 * s) + 0.3 * heavy - 0.1, 0, 1.4);
    add("seat_" + sd, "seat", g, rig.pelvis, [sa[0], sa[1], sa[2] + 0.45 * (0.6 * so + 0.03 * s)], [0.085 * s * (1 + 0.25 * heavy), 0.1 * s, 0.05 * s + 0.6 * so], 0.55, sam, clamp(3.7 - 0.7 * sam, 2.6, 3.7), 0.33, 0.008, 0.024, fam(SEG.trunk, SEG["legU_" + sd]));
    const ha = body.apex["hip_" + sd], ham = clamp(body.hipFlare / (0.07 * s) + 0.45 * heavy - 0.25, 0, 1.3);
    add("hip_" + sd, "hip", g, rig.pelvis, [ha[0] - g * 0.035 * s, ha[1] - 0.02 * s, ha[2]], [0.055 * s + 0.5 * body.hipFlare, 0.11 * s, 0.09 * s], 0.5, ham, clamp(3.9 - 0.6 * ham, 3, 3.9), 0.36, 0.006, 0.02, fam(SEG.trunk, SEG["legU_" + sd]));
    // the inside of a thigh: along the thigh, toward the other leg
    const A = rig.J[L.up].at, K = rig.J[L.low].at, d = V.norm(V.sub(K, A)), fz = V.norm(V.perp([0, 0, 1], d)), med = V.mul(V.cross(fz, d), -g), len = V.dist(A, K);
    const mr = interpMed(body.thighIn, 0.32), tam = clamp((body.r.thigh - 0.068 * s) / (0.04 * s) + 0.3 * heavy, 0.12, 1.3);
    add("thigh_" + sd, "thigh", g, L.up, V.add(V.mad(A, d, 0.32 * len), V.mul(med, 0.55 * mr)), [0.38 * len, 1.3 * mr, 1.25 * Math.max(body.r.thigh, mr)], 0.7, tam, clamp(4.3 - 0.8 * tam, 3.2, 4.3), 0.4, 0.004, 0.018, fam(SEG["legU_" + sd], SEG.trunk),
      { ax: [d, med, fz], medial: med, axis: { a: A.slice(), d, len } });
  }
  const b = body.apex.belly, bo = body.bellyOut, bam = clamp(0.14 + bo / (0.05 * s) + 0.35 * heavy, 0.14, 1.4);
  add("belly", "belly", 0, rig.spine[1], [0, b[1], b[2] - 0.4 * (bo + 0.03 * s)], [0.85 * body.half.waist, Math.max(0.07 * s, 0.42 * (body.levels.under - body.crotchY)), 0.05 * s + bo], 0.55, bam, clamp(3.0 - 0.6 * bam, 2.1, 3), 0.34, 0.01, 0.028, fam(SEG.trunk));
  return out;
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
  const idx = addJoints(glb, rig, plan.map(b => ({ name: b.name, parent: b.parent, at: b.at })), undo); plan.forEach((b, k) => { b.j = idx[k]; });
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
    it; a frame's controls may say `press: { seat, back }` (sat or lain on: 0..1) and `breath` (-1..1).
    -> { name: most it moved (mm) }, and `thighs`: { before, after }: how far the thighs overlapped, mm */
export function softMotion(rig, body, plan, clip, frames, set = {}) {
  const n = frames.length, dt = 1 / clip.fps, SUB = 8, h = dt / SUB, amt = clamp(set.soft ?? 1, 0, 1.5), loop = !!clip.loop, stats = {};
  const wrap = i => loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i)), Pj = (f, j) => { const P = frames[f].solved.P; return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; };
  const off = plan.map(() => Array.from({ length: n }, () => [0, 0, 0]));
  // ---- the springs --------------------------------------------------------------------------------------------------
  plan.forEach((b, bi) => {
    const p = b.parent, rel = V.sub(b.at, rig.J[p].at), A = [], acc = [], sag = [];
    for (let f = 0; f < n; f++) { const D = frames[f].solved.D[p]; A.push(V.add(Pj(f, p), Q.rot(D, rel))); sag.push(V.mul(V.sub(G, Q.rot(D, G)), b.sag * amt)); }
    for (let f = 0; f < n; f++) { const a0 = A[wrap(f - 1)], a1 = A[f], a2 = A[wrap(f + 1)]; acc.push([(a2[0] - 2 * a1[0] + a0[0]) / (dt * dt), (a2[1] - 2 * a1[1] + a0[1]) / (dt * dt), (a2[2] - 2 * a1[2] + a0[2]) / (dt * dt)]); }
    const w = 2 * Math.PI * b.f, x = sag[0].slice(), v = [0, 0, 0], X = Array.from({ length: n }, () => [0, 0, 0]), laps = loop ? 3 : 1, gain = b.amount * amt;
    for (let lap = 0; lap < laps; lap++) for (let f = 0; f < n; f++) { if (lap === laps - 1) X[f] = x.slice(); const f1 = wrap(f + 1);
      for (let k = 0; k < SUB; k++) { const t = k / SUB; for (let c = 0; c < 3; c++) { const a = acc[f][c] + (acc[f1][c] - acc[f][c]) * t, xs = sag[f][c] + (sag[f1][c] - sag[f][c]) * t; v[c] += (-w * w * (x[c] - xs) - 2 * b.z * w * v[c] - a * gain) * h; x[c] += v[c] * h; } } }
    let most = 0; const lim = b.max * Math.max(amt, 0.001);
    for (let f = 0; f < n; f++) { let d = X[f]; const l = V.len(d); if (l > lim) d = V.mul(d, (lim * (1 + Math.tanh((l - lim) / lim) * 0.25)) / l); most = Math.max(most, V.len(d)); off[bi][f] = V.mul(Q.rot(Q.conj(frames[f].solved.D[p]), d), 1 / b.wmax); }
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
  for (let f = 0; f < n; f++) { plan.forEach((b, bi) => frames[f].pose.off.set(b.j, off[bi][f])); frames[f].solved = frames[f].pose.solve(); }
  return stats;
}
