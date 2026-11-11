// grow.js: the body's proportions, the ages and the creatures (the Character Studio's Body tab, DECISIONS 2026-11-10,
// night: "making younger npcs 8-18", "a toggle for monster mode", "cutify"). What the sculpt's offset fields (sculpt.js)
// can't do: parts of the body made longer, shorter, bigger or smaller against the rest. A child isn't a small adult: at
// eight the head is a sixth of the height, not an eighth, so the body is scaled against the head, then the whole to
// the height.
//
// The head is the unit: nothing here moves a point of the head (so a face fitted to a photo, the expressions, the eyes,
// the teeth, the lashes and the hair stay exactly as they were made); "a bigger head" is the body under it made smaller
// about the top of the neck, and the Studio then scales everything to the height asked for. The regions are MHR's own
// skin weights (pose.js readRig): what belongs to an arm, a hand, a finger, the neck. Plain JS, no three.js
// (growtest.mjs checks it in node).
//
//   const G = buildGrow({ P, rig, chin })   P: MHR's base points, rig: pose.js readRig's, chin: the chin's point on P
//   G.controls: [{ id, label, group, help, idx, d, prop: true, gain(v), parts }]   as the sculpt's (idx, d: what it moves
//                                         on the base at 1: the handles read them), and how it's really applied
//   applyProps(G, value, X, S)            X: the body's points (MHR's units), changed in place; value(id): each control's
//                                         slider; S: each point's own scale after it (a sculpt's offset there is
//                                         scaled by it), or null
//   ageOf(age, base, G)                   an age's build: { sculpt: {id: value}, young, sexed, height }
//   CUTE, MONSTERS, soften(v, lin, lim), statureOf(age, base)

export const GROUPS = ["Proportions", "Creature"];
export const AGE_MIN = 8, AGE_ADULT = 18;

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// 0 below 0, 1 above 1, a straight line between with its two ends eased over e (no kink where a stretch starts and stops)
function ramp(u, e = 0.12) {
  if (u <= 0) return 0; if (u >= 1) return 1;
  const v = u < e ? u * u / (2 * e) : u <= 1 - e ? u - e / 2 : (1 - e) - (1 - u) * (1 - u) / (2 * e);
  return v / (1 - e);
}
// a slider's sum (the character's own, its base's, its age's, Cutify's) kept within lim: as it is up to lin, easing
// into lim past that
export function soften(v, lin, lim) {
  const a = Math.abs(v); if (a <= lin) return v;
  const r = lim - lin; return Math.sign(v) * (lin + r * (1 - Math.exp(-(a - lin) / r)));
}

export function buildGrow({ P, rig, chin, eyes = null }) {            // eyes: the height of the eyes' line on P (the lower lids'), for the face's length under it
  const N = P.length / 3, nb = rig.bones.length, ix = n => rig.byName.get(n), at = n => rig.bones[ix(n)].at.slice();
  const under = (...roots) => { const s = new Uint8Array(nb), R = roots.map(ix); for (const b of rig.order) { const p = rig.bones[b].parent; s[b] = R.includes(b) || (p >= 0 && s[p]) ? 1 : 0; } return s; };
  // a point's share of something: its bones' weights, each times f(bone, the point's index) (0..1)
  const share = f => { const w = new Float32Array(N); for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) { const bw = rig.BW[i * 4 + k]; if (bw > 0) w[i] += bw * f(rig.BI[i * 4 + k], i); } return w; };
  const sparse = w => { const idx = []; for (let i = 0; i < N; i++) if (Math.abs(w[i]) > 1e-4) idx.push(i); return { idx: Uint32Array.from(idx), w: Float32Array.from(idx, i => w[i]) }; };
  const y = i => P[i * 3 + 1];
  // a joint that rides the body as it is now: its bone's ring (pose.js: the points round the joint), or its first child's
  const ringOf = n => { let b = ix(n); if (!rig.rings[b]) b = rig.bones.findIndex((x, i) => x.parent === b && rig.rings[i] && Math.hypot(...sub(x.at, rig.bones[b].at)) < 1e-6); return b >= 0 ? rig.rings[b] : null; };
  const joint = n => ({ at: at(n), ring: ringOf(n) });

  const HEAD = under("c_head"), NECKB = new Uint8Array(nb), LEGS = under("l_upleg", "r_upleg"), ARMS = under("l_uparm", "r_uparm");
  for (const n of ["c_neck", "c_neck_twist0_proc", "c_neck_twist1_proc"]) if (ix(n) !== undefined) NECKB[ix(n)] = 1;
  const yN0 = at("c_neck")[1], yN1 = at("c_head")[1], ySh = at("l_uparm")[1], yHip = at("l_upleg")[1];
  let top = -Infinity, low = Infinity; for (let i = 0; i < N; i++) { top = Math.max(top, y(i)); low = Math.min(low, y(i)); }
  const measures = { head: top - chin[1], body: chin[1] - low, r0: (top - chin[1]) / (top - low), legY: yHip - at("l_foot")[1], torso: yN0 - (yHip - 0.002), neck: yN1 - yN0, face: (eyes ?? chin[1] + 0.097) - chin[1] };

  // a limb made longer along its own line, from its joint to its end: the points past the end move whole (a hand keeps
  // its shape at the end of a longer arm)
  const limb = (root, from, to, open = false) => {
    const S = under(root), w = share(b => S[b]), p0 = at(from), a = unit(sub(at(to), p0)), len = Math.hypot(...sub(at(to), p0)), d = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { if (!(w[i] > 1e-4)) continue; const s = (P[i * 3] - p0[0]) * a[0] + (P[i * 3 + 1] - p0[1]) * a[1] + (P[i * 3 + 2] - p0[2]) * a[2];
      const t = w[i] * (open ? Math.max(0, s) : len * ramp(s / len, 0.06)); d[i * 3] = t * a[0]; d[i * 3 + 1] = t * a[1]; d[i * 3 + 2] = t * a[2]; }
    return { kind: "shift", d };
  };
  const both = f => ["l", "r"].flatMap(s => f(s));
  const scaled = (root, pivot) => { const S = under(root); return { kind: "scale", ...sparse(share(b => S[b])), joint: joint(pivot) }; };

  // the torso: everything above the hips up by its height in it (the arms with their shoulders, the head with the neck)
  const yT0 = yHip - 0.002, LT = yN0 - yT0, torso = new Float32Array(N * 3);
  { const w = share((b, i) => LEGS[b] ? 0 : ARMS[b] ? ramp((ySh - yT0) / LT) : ramp((y(i) - yT0) / LT)); for (let i = 0; i < N; i++) torso[i * 3 + 1] = LT * w[i]; }
  // the neck: the head up whole, the neck's own skin by its height
  const LN = yN1 - yN0, neck = new Float32Array(N * 3);
  { const w = share((b, i) => HEAD[b] ? 1 : NECKB[b] ? ramp((y(i) - yN0) / LN) : 0); for (let i = 0; i < N; i++) neck[i * 3 + 1] = LN * w[i]; }
  // the body against the head: everything under the head, the neck tapering from its base (the body's size) to its top (the head's)
  const body = sparse(share((b, i) => HEAD[b] ? 0 : NECKB[b] ? 1 - sm(yN0 - 0.01, yN1, y(i)) : 1));
  // a hunch: the back bent forward from the waist up to the shoulders, the head brought back up to look ahead
  const upper = sparse(share((b, i) => LEGS[b] ? 0 : ARMS[b] || HEAD[b] || NECKB[b] ? 1 : sm(1.0, 1.42, y(i))));
  const headUp = sparse(share((b, i) => HEAD[b] ? 1 : NECKB[b] ? sm(yN0, yN1, y(i)) : 0));

  // the controls, in the order they're applied: lengths first (each a plain move on the base), then the bend, then the
  // sizes about their joints as those have moved, the body against the head last
  const C = [
    ["fingers", "Fingers", "Proportions", "Longer or shorter fingers (in monster mode: claws' reach).", v => 0.2 * v,
      both(s => ["thumb", "index", "middle", "ring", "pinky"].map(f => limb(`${s}_${f}1`, `${s}_${f}1`, `${s}_${f}_null`, true)))],
    ["arms_length", "Arm length", "Proportions", "Longer or shorter arms, shoulder to wrist (the hands keep their size).", v => 0.1 * v,
      both(s => [limb(`${s}_uparm`, `${s}_uparm`, `${s}_wrist`)])],
    ["legs_length", "Leg length", "Proportions", "Longer or shorter legs, hip to ankle, against the torso.", v => 0.1 * v,
      both(s => [limb(`${s}_upleg`, `${s}_upleg`, `${s}_foot`)])],
    ["torso_length", "Torso length", "Proportions", "A longer or a shorter torso, hips to shoulders.", v => 0.1 * v, [{ kind: "shift", d: torso }]],
    ["neck_length", "Neck length", "Proportions", "A longer or a shorter neck.", v => 0.3 * v, [{ kind: "shift", d: neck }]],
    ["hunch", "Hunch", "Creature", "The back bent forward from the waist to the shoulders, the head still looking ahead (−1: leaning back).", v => 0.26 * v,
      [{ kind: "bend", ...upper, joint: joint("c_spine1"), k: 1 }, { kind: "bend", ...headUp, joint: joint("c_head"), k: -0.72 }]],
    ["hands", "Hands", "Proportions", "Bigger or smaller hands.", v => 0.15 * v, both(s => [scaled(`${s}_wrist`, `${s}_wrist`)])],
    ["feet", "Feet", "Proportions", "Bigger or smaller feet.", v => 0.15 * v, both(s => [scaled(`${s}_foot`, `${s}_foot`)])],
    ["head_size", "Head size", "Proportions", "The head against the body: +1 a head a quarter bigger for the height (a child's; the body under it is made smaller, the height stays as set), −1 smaller.", v => Math.pow(0.8, v) - 1,
      [{ kind: "scale", ...body, joint: joint("c_head") }]],
  ];
  const controls = C.map(([id, label, group, help, gain, parts]) => {
    // what it moves on the base at 1 (the handles' pull, the check): each part's move there
    const D = new Float32Array(N * 3), g1 = gain(1);
    for (const p of parts) {
      if (p.kind === "shift") { for (let i = 0; i < N * 3; i++) D[i] += g1 * p.d[i]; continue; }
      const c = p.joint.at;
      for (let q = 0; q < p.idx.length; q++) { const i = p.idx[q] * 3, w = p.w[q], dx = P[i] - c[0], dy = P[i + 1] - c[1], dz = P[i + 2] - c[2];
        if (p.kind === "scale") { D[i] += g1 * w * dx; D[i + 1] += g1 * w * dy; D[i + 2] += g1 * w * dz; }
        else { const a = g1 * p.k * w, co = Math.cos(a), si = Math.sin(a); D[i + 1] += co * dy - si * dz - dy; D[i + 2] += si * dy + co * dz - dz; } }
    }
    const idx = []; for (let i = 0; i < N; i++) if (Math.abs(D[i * 3]) + Math.abs(D[i * 3 + 1]) + Math.abs(D[i * 3 + 2]) > 1e-7) idx.push(i);
    const d = new Float32Array(idx.length * 3); idx.forEach((i, q) => { d[q * 3] = D[i * 3]; d[q * 3 + 1] = D[i * 3 + 1]; d[q * 3 + 2] = D[i * 3 + 2]; });
    for (const p of parts) if (p.kind === "shift") Object.assign(p, (() => { const s = []; for (let i = 0; i < N; i++) if (Math.abs(p.d[i * 3]) + Math.abs(p.d[i * 3 + 1]) + Math.abs(p.d[i * 3 + 2]) > 1e-7) s.push(i);
      const dd = new Float32Array(s.length * 3); s.forEach((i, q) => { dd[q * 3] = p.d[i * 3]; dd[q * 3 + 1] = p.d[i * 3 + 1]; dd[q * 3 + 2] = p.d[i * 3 + 2]; }); return { idx: Uint32Array.from(s), d: dd }; })());
    return { id, label, group, help, idx: Uint32Array.from(idx), d, prop: true, gain, parts };
  });

  // the circles on the body: where each is held (a point of the base, its twin across the middle), and what it drags
  const nearest = c => { let bi = -1, bd = Infinity; for (let i = 0; i < N; i++) { const e = (P[i * 3] - c[0]) ** 2 + (P[i * 3 + 1] - c[1]) ** 2 + (P[i * 3 + 2] - c[2]) ** 2; if (e < bd) { bd = e; bi = i; } } return bi; };
  const front = (x, yy) => { let bi = -1, bz = -Infinity; for (let i = 0; i < N; i++) if (Math.abs(P[i * 3] - x) < 0.012 && Math.abs(P[i * 3 + 1] - yy) < 0.012 && P[i * 3 + 2] > bz) { bz = P[i * 3 + 2]; bi = i; } return bi; };
  const twin = a => nearest([-P[a * 3], P[a * 3 + 1], P[a * 3 + 2]]);
  const H = [
    ["head_size", "Head size", ["head_size"], nearest([0, top, at("c_head")[2]]), false],
    ["neck_length", "Neck length", ["neck_length"], front(0, (yN0 + yN1) / 2), false],
    ["torso_length", "Torso length", ["torso_length"], front(0, yT0 + 0.62 * LT), false],
    ["arms_length", "Arm length", ["arms_length"], nearest(at("l_lowarm")), true],
    ["hands", "Hand", ["hands", "fingers"], nearest(at("l_middle1")), true],
    ["legs_length", "Leg length", ["legs_length"], nearest([at("l_lowleg")[0], at("l_lowleg")[1], at("l_lowleg")[2] + 0.06]), true],
    ["feet", "Foot", ["feet"], nearest(at("l_ball")), true],
  ];
  const handles = H.filter(h => h[3] >= 0).map(([id, label, ids, a, tw]) => ({ id, label, controls: ids, at: [a, tw ? twin(a) : -1] }));
  return { controls, handles, measures };
}

// a joint's place on the body as it is now: where it was, moved as its ring has moved
function jointNow(j, X, P) {
  const c = j.at.slice(), g = j.ring; if (!g) return c;
  for (let a = 0; a < 3; a++) { let m = 0; for (let q = 0; q < g.idx.length; q++) m += g.w[q] * (X[g.idx[q] * 3 + a] - P[g.idx[q] * 3 + a]); c[a] += m; }
  return c;
}

// the proportions onto a body: X (N*3, MHR's units) changed in place; P: MHR's base (where the joints' rings rest);
// value(id): each control's slider; S (N, or null): filled with each point's own scale, 1 where nothing sized it.
// Returns true if anything moved
export function applyProps(G, value, X, P, S = null) {
  let any = false; if (S) S.fill(1);
  for (const c of G.controls) {
    const v = value(c.id); if (!v) continue;
    const g = c.gain(v); if (!g) continue; any = true;
    for (const p of c.parts) {
      if (p.kind === "shift") { for (let q = 0; q < p.idx.length; q++) { const i = p.idx[q] * 3; X[i] += g * p.d[q * 3]; X[i + 1] += g * p.d[q * 3 + 1]; X[i + 2] += g * p.d[q * 3 + 2]; } continue; }
      const o = jointNow(p.joint, X, P);
      if (p.kind === "scale") for (let q = 0; q < p.idx.length; q++) { const i = p.idx[q] * 3, k = g * p.w[q]; X[i] += k * (X[i] - o[0]); X[i + 1] += k * (X[i + 1] - o[1]); X[i + 2] += k * (X[i + 2] - o[2]); if (S) S[p.idx[q]] *= 1 + k; }
      else for (let q = 0; q < p.idx.length; q++) { const i = p.idx[q] * 3, a = g * p.k * p.w[q], co = Math.cos(a), si = Math.sin(a), dy = X[i + 1] - o[1], dz = X[i + 2] - o[2]; X[i + 1] = o[1] + co * dy - si * dz; X[i + 2] = o[2] + si * dy + co * dz; }
    }
  }
  return any;
}

// ---- the ages (8 to 17; 18 is the adult the Studio always made) -----------------------------------------------------
// From the growth charts (CDC's stature for age, the 50th percentile; Snyder's 1977 anthropometry of children for the
// head's height and the breadths): the head's height as a share of the stature, the stature itself (girls, boys), how
// much of a child's build is left (narrow shoulders and hips, thin limbs, a straight trunk, a short, soft face), how far
// the legs have run ahead of the torso (they grow first: longest against it at twelve), and how far a girl's and a boy's
// builds have parted (puberty: none at eight, all of it by eighteen).
const TABLE = {
  //     head   girl   boy    young  leggy  sexed
  8:  [0.156, 1.275, 1.280, 1.00, 0.12, 0.00],
  9:  [0.152, 1.335, 1.335, 0.93, 0.22, 0.02],
  10: [0.148, 1.385, 1.385, 0.85, 0.33, 0.08],
  11: [0.144, 1.445, 1.435, 0.75, 0.43, 0.18],
  12: [0.141, 1.515, 1.490, 0.63, 0.50, 0.32],
  13: [0.138, 1.570, 1.560, 0.50, 0.45, 0.48],
  14: [0.136, 1.605, 1.640, 0.37, 0.35, 0.63],
  15: [0.134, 1.620, 1.700, 0.25, 0.24, 0.77],
  16: [0.133, 1.625, 1.735, 0.14, 0.13, 0.88],
  17: [0.1325, 1.630, 1.750, 0.06, 0.05, 0.95],
  18: [0.132, 1.630, 1.760, 0.00, 0.00, 1.00],
};
const row = age => { const a = Math.min(AGE_ADULT, Math.max(AGE_MIN, age)), i = Math.floor(a), j = Math.min(AGE_ADULT, i + 1), t = a - i; return TABLE[i].map((v, k) => v + (TABLE[j][k] - v) * t); };
// a child's build at eight, on the sculpt's controls (each times `young`): the body, and the face (times how much of the
// age's face is asked for: a child's photo already gives it)
export const CHILD_BODY = { shoulders: -0.45, hips: -0.45, thighs: -0.5, calves: -0.3, upper_arms: -0.4, forearms: -0.25, chest: -0.3, bust: -1, waist: 0.3, belly: 0.2, neck: -0.8, seat: -0.5, feet: 0.15 };
export const CHILD_FACE = { face_height: -0.9, jaw_width: -0.5, chin_length: -0.15, nose_size: -0.5, nose_projection: -0.35, nose_length: -0.45, nose_bridge: -0.6, brow_ridge: -0.25,
                            cheeks: 0.25, face_round: 0.5, cheekbones: -0.2, temples: 0.15, mouth_width: -0.25, forehead_slope: 0.5, eye_size: 0.35 };
// an age's average height (m), girls' to boys' by the base (-1 feminine .. 1 masculine)
export function statureOf(age, base) { const [, girl, boy] = row(age); return Math.round((girl + (boy - girl) * (base + 1) / 2) * 100) / 100; }
// base: -1 feminine .. 1 masculine; face: how much of the age's face (0..1). The adult (18 and over) is nothing at all
export function ageOf(age, base, G, face = 1) {
  if (!(age < AGE_ADULT)) return { sculpt: {}, young: 0, sexed: 1, height: statureOf(AGE_ADULT, base), age: AGE_ADULT };
  const [head, girl, boy, young, leggy, sexed] = row(age), s = {}, M = G.measures;
  for (const k in CHILD_BODY) s[k] = CHILD_BODY[k] * young;
  for (const k in CHILD_FACE) s[k] = (s[k] || 0) + CHILD_FACE[k] * young * face;
  s.legs_length = leggy;
  // the head's share of the height: MHR's own adult's (an eighth: its head is small), times the chart's ratio to its
  // adult's. A child's head is its short face too: the chin comes up toward the eyes (the sculpt's Face length takes a
  // tenth of the face a slider, Chin length a centimetre), so the head measured as the chart measures it, chin to
  // crown, is that much shorter than MHR's own, whether the age's face or a child's picture shortens it; the body under
  // the chin is sized to that head (its legs' own change counted): a bigger skull over a small face, as a child's is
  // A head never shrinks as it grows up: the chart's one column of head shares is nearer a boy's timing, and a girl
  // is at her adult height two years sooner, so at fourteen its share of her height made her skull 4% bigger than at
  // eighteen. The share is held to what gives the adult's skull at this age's height (the short face counted)
  const short = -young * (CHILD_FACE.face_height * 0.1 * M.face + CHILD_FACE.chin_length * 0.01), h = M.head - short;
  const r = Math.min(M.r0 * head / TABLE[AGE_ADULT][0], M.r0 * statureOf(AGE_ADULT, base) / statureOf(age, base) * h / M.head);
  const beta = h * (1 - r) / r / (M.body * (1 + 0.1 * leggy * M.legY / M.body));
  s.head_size = Math.log(beta) / Math.log(0.8);
  return { sculpt: s, young, sexed, age, height: statureOf(age, base) };
}

// ---- Cutify: a cuter, softer face at any age (the baby schema: big eyes, a short round face, a small nose, mouth and
// chin, full cheeks, a round forehead), each of the sculpt's controls times its amount ----------------------------------
export const CUTE = { eye_size: 0.8, eye_spacing: 0.3, face_height: -0.45, jaw_width: -0.5, chin_length: -0.25, chin_width: -0.2, nose_size: -0.45, nose_projection: -0.25, nose_length: -0.35,
                      nose_bridge: -0.25, cheeks: 0.2, face_round: 0.45, cheekbones: -0.25, mouth_width: -0.25, lips: 0.15, brow_ridge: -0.2, forehead_slope: 0.5 };   // (no Forehead height: it lifts the whole crown, under the hair and the hats; the face shortened under the eyes gives the high forehead)

// ---- the creatures (monster mode's presets: the Body tab's cards, DECISIONS 2026-11-11: "add presets for the monster-ish
// shapes you made so I can use them"). Each is a sculpt (what the sliders show: every one can be moved on from there),
// the base, its teeth (fangs, points: teeth.js), the build from MHR's own shapes (0 heavier, 1 wider hips and waist,
// 3 belly out, 8 thicker thighs, 10 a slimmer neck: a big body made of them is one body, where the sculpt's bumps
// stacked up read as rolls), and its look, so a click gives a creature and not a pink person in its shape: the skin's
// tone and layers (skinshader.js: a preset, what's changed on it, no makeup), the eyes (a style of tools/shared/eye.js
// and what's changed on it), the lips, the teeth's shade and its horns (horns.js). The look is plain settings the page
// applies (index.html useCreature); GROW checks every name in it exists
export const MONSTERS = {
  goblin: { label: "Goblin", about: "Small, big-eared and long-nosed, a pot belly on bow legs, pointed teeth; olive green, yellow eyes with a slit.",
    height: 1.15, base: 0.3, shape: { 3: 1.2, 0: -1 }, teeth: { points: 0.7, fangs: 0.2 },
    sculpt: { head_size: 1.3, ears_point: 2.6, ears_size: 1.6, ears_out: 1.4, nose_size: 1.8, nose_length: 2.2, nose_tip: 1.5, eye_size: 1.2, eye_spacing: 0.8, jaw_width: -1.2, chin_length: 1.4, chin_width: -1.5,
              mouth_width: 2.4, brow_ridge: 1.6, cheeks: -1.5, hunch: 1, arms_length: 1.6, legs_length: -1.6, hands: 1.4, fingers: 1.4, shoulders: -1, belly: 1, neck: -1 },
    look: { tone: "#7d8f4e", skin: { preset: "adult", tweak: { flush: 0.12, flushColor: "#56703a", translucency: 0.18, veins: 0.25, spots: 0.5, freckleColor: "#4e5a2c", dewy: 0.05, evenness: 0.1 } },
            eyes: { style: "serpent", set: { sclera: "#e2daa6", corner: "#8a7a3c", irisSize: 34 } }, lips: { on: true, colour: "#566030", amount: 0.7, gradient: 0.1, soft: 0.5, gloss: 0.1, lines: 0.4 }, teeth: { shade: 0.7 } } },
  ghoul: { label: "Ghoul", about: "Tall and starved, long arms and fingers, sunken cheeks and temples; corpse grey, milky eyes with no pupil.",
    height: 1.9, base: 0.4, shape: { 0: -2.6, 1: -1.6, 8: -1.5 }, teeth: { points: 0.5, fangs: 0.35 },
    sculpt: { cheeks: -3, temples: -2.6, eye_depth: 2.4, eye_size: -0.6, brow_ridge: 1.4, jaw_width: -1, chin_length: 1.8, face_height: 1.2, nose_size: -1.4, nose_projection: -0.8, mouth_width: 1.8, lips: -1.3,
              neck: -1, neck_length: 1.4, hunch: 1.5, arms_length: 2.4, fingers: 2.6, hands: 0.8, upper_arms: -1.2, forearms: -1, thighs: -1.2, calves: -1, torso_length: 0.6, bust: -1.5, shoulders: -0.5 },
    look: { tone: "#a2a79b", skin: { preset: "50 and over", tweak: { flush: 0.06, flushColor: "#6a6f7c", translucency: 0.1, veins: 0.75, spots: 0.3, freckleColor: "#5a5f58", dewy: 0, evenness: 0 } },
            eyes: { style: "possessed", set: { sclera: "#d6d6cc", corner: "#8a7f86", veins: 0.6 } }, lips: { on: true, colour: "#4c4852", amount: 0.6, gradient: 0.2, soft: 0.5, gloss: 0.05, lines: 0.5 }, teeth: { shade: 0.75 } } },
  ogre: { label: "Ogre", about: "Huge and heavy, a small low-browed head on a barrel of a body, a wide jaw with tusks; khaki, small dark eyes.",
    height: 2.6, base: 1, shape: { 0: 3, 1: 2.2, 3: 2.4, 8: 2, 10: -3 }, teeth: { fangs: 0.6 },
    sculpt: { head_size: -0.9, jaw_width: 3, chin_width: 2.4, chin_forward: 2.2, brow_ridge: 3, forehead_height: -1.6, forehead_slope: -2, nose_size: 1.6, nose_width: 2, mouth_width: 2, eye_size: -1, eye_depth: 1.6, ears_size: 1.2,
              neck: 1, shoulders: 2.2, upper_arms: 1.6, forearms: 1.8, calves: 1, hands: 2.2, arms_length: 1.2, legs_length: -1.4, hunch: 0.7 },
    look: { tone: "#8c8a62", skin: { preset: "adult", tweak: { pores: 0.7, poreSize: 2.2, mottle: 0.6, flush: 0.15, flushColor: "#6a5a3a", translucency: 0.15, veins: 0.2, spots: 0.5, freckleColor: "#5a4e30", dewy: 0, evenness: 0 } },
            eyes: { style: "natural", set: { iris: "#1c120a", iris2: "#4a3018", sclera: "#ded6b8", corner: "#8a6a4a", pupil: 0.26, irisSize: 30 } }, lips: { on: true, colour: "#5c4a38", amount: 0.6, gradient: 0.1, soft: 0.5, gloss: 0.05, lines: 0.5 }, teeth: { shade: 0.8 } } },
  alien: { label: "Grey alien", about: "Small and thin under a great domed skull, long fingers, a slit of a mouth; grey, with large all-black eyes.",
    height: 1.25, base: 0, shape: { 0: -2.6, 1: -2, 8: -1.5, 10: 3 },
    sculpt: { head_size: 1.9, skull_back: 1.8, forehead_height: 2.6, forehead_width: 2.4, temples: 1.6, eye_size: 3, eye_spacing: 2, eye_tilt: 2.2, nose_size: -2.1, nose_projection: -0.4, mouth_width: -2, lips: -1.2, jaw_width: -3, chin_width: -2.6,
              chin_length: -1, cheekbones: 1, cheeks: -1.6, ears_size: -1.6, neck: -1.2, neck_length: 1.2, shoulders: -1.6, upper_arms: -1.2, forearms: -1, thighs: -1.2, calves: -1, arms_length: 1.6, fingers: 2.4, bust: -2 },
    look: { tone: "#a0a4a8", skin: { preset: "young glass", tweak: { flush: 0, translucency: 0.2, veins: 0.15, mottle: 0.2, dewy: 0.3, evenness: 0.5 } },
            eyes: { style: "natural", set: { iris: "#050506", iris2: "#0a0a0c", accent: "#101014", pupilColor: "#000000", sclera: "#08080a", corner: "#141416", fibres: 0, limbal: 0, patternAmt: 0, pupil: 0.5, irisSize: 44, veins: 0, scleraShade: 0, cornerPink: 0 } },
            lips: { on: true, colour: "#7b7f86", amount: 0.5, gradient: 0, soft: 0.6, gloss: 0, lines: 0.1 }, teeth: { shade: 0.4 } } },
  demon: { label: "Demon", about: "Tall and broad, a heavy brow over slanted eyes, a long chin, pointed ears and fangs; dark red, yellow slit eyes in black, great horns.",
    height: 2.05, base: 1, shape: { 0: 1, 10: -1.5 }, teeth: { fangs: 0.8 },
    sculpt: { brow_ridge: 2.6, eye_depth: 1.4, eye_tilt: 1.8, cheekbones: 1.5, cheeks: -1.8, jaw_width: 1.4, chin_length: 1.6, chin_width: -1.6, chin_forward: 1, nose_bridge: 1.6, nose_length: 1, ears_point: 2.2, ears_size: 0.8, mouth_width: 1.4,
              forehead_slope: -1, shoulders: 1.8, chest: 1.2, waist: -0.6, upper_arms: 1.4, forearms: 1.2, neck: 0.8, fingers: 1.6, hands: 0.6 },
    look: { tone: "#8a2d23", skin: { preset: "adult", tweak: { flush: 0.2, flushColor: "#4a0c0a", translucency: 0.25, veins: 0.3, spots: 0.1, freckleColor: "#3a0a08", mottle: 0.5, dewy: 0.1, evenness: 0.1 } },
            eyes: { style: "amber", set: { pupilShape: "slit", pupil: 0.3, sclera: "#140807", corner: "#3a0a08", veins: 0, scleraShade: 0 } }, lips: { on: true, colour: "#3a0c0c", amount: 0.7, gradient: 0.1, soft: 0.5, gloss: 0.15, lines: 0.4 }, teeth: { shade: 0.5 },
            horns: { style: "demon" } } },
  hag: { label: "Hag", about: "Bent double, a hooked nose over a jutting chin, hollow cheeks, thin lips; sallow and deeply lined, pale grey eyes.",
    height: 1.5, base: -1, shape: { 0: -1.2 }, teeth: { points: 0.3 },
    sculpt: { hooded_lids: 1, nose_size: 1.6, nose_length: 3, nose_tip: 1.6, nose_bridge: 2.4, chin_length: 2.6, chin_forward: 2.6, chin_width: -1.8, jaw_width: -1.4, cheeks: -2.6, cheekbones: 1.4, lips: -1.3, mouth_width: 1, temples: -1.8, eye_depth: 1.6,
              brow_ridge: 1, ears_size: 1.4, hunch: 2.2, neck: -1, shoulders: -1.2, bust: -1.2, upper_arms: -1.2, forearms: -1, fingers: 1.8, thighs: -1, calves: -1, belly: 0.8 },
    look: { tone: "#b3a787", skin: { preset: "70 and over", tweak: { flush: 0.2, flushColor: "#8a6a5a", veins: 0.5, dewy: 0, evenness: 0 } },
            eyes: { style: "steel", set: { sclera: "#dcd4c0", corner: "#a07a70", veins: 0.5, pupil: 0.22 } }, lips: { on: true, colour: "#6a4a4c", amount: 0.5, gradient: 0.2, soft: 0.5, gloss: 0, lines: 0.6 }, teeth: { shade: 0.85 } } },
  imp: { label: "Imp", about: "Knee high, a big head with huge pointed ears and eyes, a wide mouth of little fangs, a round belly on big feet; crimson, gold slit eyes, budding horns.",
    height: 0.9, base: 0, shape: { 3: 1.4 }, teeth: { points: 0.6, fangs: 0.4 },
    sculpt: { head_size: 1.7, eye_size: 2.2, eye_spacing: 0.6, eye_tilt: 1.2, ears_point: 3, ears_size: 2, ears_out: 2, nose_size: -1.2, nose_length: -1, nose_tip: 1, mouth_width: 3, cheeks: 0.8, chin_width: -2, chin_length: -0.6, jaw_width: -0.8, brow_ridge: 0.8,
              shoulders: -1.4, belly: 1.2, arms_length: 1, legs_length: -1.2, hands: 1.2, feet: 1.6, fingers: 1.2, neck: -1, hunch: 0.6 },
    look: { tone: "#a23a30", skin: { preset: "natural young", tweak: { flush: 0.2, flushColor: "#6a1410", translucency: 0.3, veins: 0.15, spots: 0, freckleColor: "#5a1410", dewy: 0.15, evenness: 0.3 } },
            eyes: { style: "amber", set: { pupilShape: "slit", pupil: 0.32, sclera: "#e8d8a8", corner: "#8a3a2a", irisSize: 36 } }, lips: { on: true, colour: "#4a1210", amount: 0.7, gradient: 0.1, soft: 0.5, gloss: 0.2, lines: 0.3 }, teeth: { shade: 0.5 },
            horns: { style: "stubs" } } },
};
// the sculpt's controls on the head (a creature's face alone on the character's own body: useCreature's Face only): the
// Face group and the Creature group's but the hunch
export const onHead = c => c.group === "Face" || (c.group === "Creature" && c.id !== "hunch");
// how far a control's whole value may go whatever the sliders say (past it the field turns the skin inside out: a nose
// narrowed to nothing, lips pushed through the teeth, an arm pinched to a thread): [least, most]
export const REACH = { nose_size: [-2.3, 9], nose_projection: [-1.7, 9], lips: [-1.6, 9], ears_size: [-1.6, 9], upper_arms: [-2.2, 9], forearms: [-2.2, 9], eye_size: [-2.4, 9], face_height: [-3, 3.4],
                       skull_back: [-1.2, 9], neck_length: [-1.6, 9], fingers: [-2.4, 9], torso_length: [-2.4, 9], ears_out: [-1.1, 9], ears_point: [-0.5, 9] };
