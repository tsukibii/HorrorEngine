// Growing a hair: comb, lie, fall (the hair editor v2.0, docs/HAIR_V2.md §3.4). Each hair is traced from its pore in
// short steps, not simulated:
//   comb   where the head is flat enough to hold hair it goes the combed way (the field: flow.js); steeper, or in the
//          air, gravity takes over; Hold stretches the comb's reach
//   lie    over the head it is laid at a height above the skin that grows with how far it has come from its root, up
//          to the Volume there: hair from further up has come further, so it lies over the hair that grows below it.
//          The layers are in order by construction; nothing is sorted and nothing crosses. Laid down to that height,
//          not only kept out (LESSONS: hair has to be laid down)
//   fall   where the head falls away it hangs: straight down from where it left, kept off the neck, the shoulders and
//          whatever else is in the distance grid (sdf.js); its last centimetres turn in or out
// and the rules live here, not in a simulation after (LESSONS: a simulation undoes what the generator promised): the
// face's keep-out, the ears, the cut, the cap. Plain arrays; the head's local space.
//
//   trace(ctx) -> { pts (K points a hair, 3 each), len (each hair's length, 0: none), t (where each kept point is along its hair, 0..1) }
import { dist, grad } from "./sdf.js";
import { LOOSE, FRINGE, FRAME, TIE } from "./flow.js";
import { MARKS, earIn, EAR } from "./pores.js";

export const K = 24;                                                     // points a hair keeps
export const GAP = 0.0022;                                               // hair this far off the skin, at the least
export const DRILL_TOP = 0.0;                                            // where a ringlet (the face-framing strands wound up: fringe.frameCurl) begins: the ears' line
export const TS = Array.from({ length: K }, (_, k) => Math.pow(k / (K - 1), 1.35));   // where the kept points are along a hair: closer near the root, where it bends
const D = Math.PI / 180, MAXS = 72;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// two more numbers of a pore's own, from its one
export const hash = (u, k) => { const x = Math.sin((u + 0.137) * (12.9898 + k * 78.233)) * 43758.5453; return x - Math.floor(x); };

// the cut line's height at an angle round the head: Tilt lowers the front (an A-line) or the back, Round dips the back's middle
// Two lengths (tiers "front"): the front and the sides have a line of their own, higher up, as far round the head as
// frontTo; behind that the cut's own line (a step, or a slope by frontSoft)
export function cutLine(c, az) {
  const a = Math.abs(az) * D, line = (c.line ?? -0.1) - (c.tilt || 0) * 0.045 * Math.cos(a) - (c.round || 0) * 0.035 * smooth(115, 180, Math.abs(az));
  if (c.tiers !== "front" || c.front == null || c.front <= line) return line;
  const to = c.frontTo ?? 112, w = Math.max(0.5, (c.frontSoft ?? 0.2) * 50);
  return line + (c.front - line) * (1 - smooth(to - w / 2, to + w / 2, Math.abs(az)));
}

// ctx: { n, pos, nrm, dir, lift, group, u, len (the length each may reach), vol (how thick the hair lies there), S (the
//        distance grid), field(x, y, z, out), C, s (the settings), ties, limit (the hairline: its height at an angle round the head), cu (each hair's lock's own number),
//        fline (a face-framing strand's own line where it has one: under 1; else 9) }
export function trace(ctx) {
  const { n, pos, nrm, dir, lift, group, u, len, vol, S, field, C, s } = ctx;
  const cut = s.cut || {}, sh = s.shape || {}, fr = s.fringe || {}, byLine = cut.mode === "line", hasFringe = !!fr.kind && fr.kind !== "none";
  const hold = clamp((s.comb && s.comb.hold) ?? 0.3, 0, 1), holdLen = 0.02 + 0.3 * hold;
  const turnAmt = clamp(sh.turn ?? 0, -1, 1), turnR = Math.max(0.008, sh.turnRadius ?? 0.03), turnLen = turnR * Math.PI / 2 * Math.abs(turnAmt);
  const bendLen = 0.004 + 0.05 * clamp(sh.stiff ?? 0.2, 0, 1), ears = s.ears || "covered", cap = MARKS.chest - 0.04;
  const out = new Float32Array(n * K * 3), got = new Float32Array(n), poly = new Float32Array((MAXS + 2) * 3), g = [0, 0, 0], c = [0, 0, 0];
  const vv = sh.volume, VOL = vv ? [vv.top ?? 0.007, vv.sides ?? 0.007, vv.back ?? 0.009] : null;
  // tucked behind the ears (the ears show): the hair that comes down the side of the head turns back over the ear's top
  // and falls behind it, on both sides or one
  const tuckL = ears === "tucked" || ears === "tucked_left", tuckR = ears === "tucked" || ears === "tucked_right", ETOP = EAR.y + EAR.dy, EBOT = EAR.y - EAR.dy - 0.004, EOUT = 1.08;
  const FRONT = (tuckL || tuckR) && (s.tuckFall || "front") === "front";
  // tied hair's way to its tie: Sweep (it keeps its root's way at first and bends round to the tie over some centimetres: arcs over the head) and Swirl (it comes in turned, winding round the tie)
  const tieSweep = clamp((s.ties && s.ties.sweep) || 0, 0, 1) * 0.1, tieSwirl = clamp((s.ties && s.ties.swirl) || 0, -1, 1) * 42 * D;
  // Drape: tied hair hangs to its tie. It lies on the head only where the head holds it up; where the head falls away
  // under it (below its widest, behind the ear, down to the neck) it leaves the skin and hangs free, a curtain, drawn
  // in to the tie at the end, with some slack (it sags on the way). 0: it lies on the head all the way to its tie
  const tieBack = clamp((s.ties && s.ties.back) || 0, 0, 1) * 0.025;
  const drape = clamp((s.ties && s.ties.drape) || 0, 0, 1), puff = clamp((s.ties && s.ties.puff) || 0, 0, 1) * 0.035, EBACK = EAR.az + EAR.da * 1.15, GATHER = clamp((s.ties && s.ties.gather) ?? 0.075, 0.03, 0.2);
  for (let i = 0; i < n; i++) {
    let L = len[i]; if (!(L > 0.0015)) continue;
    const gr = group[i], steps = clamp(Math.ceil(L / 0.008), 5, MAXS), dl = L / steps, al = 1 - Math.exp(-dl / bendLen);
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2], cl = Math.cos(lift[i]), sl = Math.sin(lift[i]);
    let px = pos[i * 3] + nx * 0.0006, py = pos[i * 3 + 1] + ny * 0.0006, pz = pos[i * 3 + 2] + nz * 0.0006;
    let tx = dir[i * 3] * cl + nx * sl, ty = dir[i * 3 + 1] * cl + ny * sl, tz = dir[i * 3 + 2] * cl + nz * sl;
    const V = vol[i], reach = V / Math.max(sl, 0.1), jit = 0.88 + 0.24 * hash(u[i], 3);
    const tie = gr >= TIE ? ctx.ties[gr - TIE] : null, own = gr === FRINGE || gr === FRAME, ownHold = own ? (gr === FRINGE ? (fr.hold ?? 0.5) : 0.25) * L : 0;
    poly[0] = px; poly[1] = py; poly[2] = pz;
    let m = 1, sAt = 0, rest = 0.03, done = false, draped = false, hung = false, eta0 = 0, bow = 0, r0x = 0, r0z = 0;   // (r0x, r0z: where it left the head, as its distance from the head's axis and its bearing from the tie's)
    // a low tie by an ear that's out: this hair goes round the ear to it. Hair that grows in front of the ear's back
    // edge goes over the ear's top to a place of its own behind the ear (its lane) and comes down there; hair from
    // behind comes forward no further than the ear's back edge until it's below the ear
    const round = tie && tie.round > 0 && (pos[i * 3] >= C[0] ? tuckL : tuckR) ? tie.round : 0;
    const az0 = round ? Math.abs(Math.atan2(pos[i * 3] - C[0], pos[i * 3 + 2] - C[2])) / D : 0, lane = round && az0 < EBACK ? EAR.az + EAR.da * (1.15 + 0.45 * hash(u[i], 19)) : EBACK;
    for (let k = 1; k <= steps && !done; k++) {
      sAt = k * dl;
      const d0 = dist(S, px, py, pz), ok = grad(S, px, py, pz, g), near = ok && d0 < GAP + V + 0.014;
      // the way wanted: combed, or falling
      let wc = 0, cx = 0, cy = 0, cz = 0;
      let free = false, atTie = false, leave = 0;
      if (tie) {                                                          // toward its tie along the head; the last few centimetres straight to it, and it ends in it
        cx = tie.at[0] - px; cy = tie.at[1] - py; cz = tie.at[2] - pz; wc = 1; const dT = Math.hypot(cx, cy, cz);
        free = dT < (hung ? 0.045 - 0.03 * drape : 0.045); if (dT < (tie.radius || 0.012) * 0.6 + dl * 1.2) atTie = true;   // (hair that hangs comes down to its tie along its own curve: only the last centimetre or two straight)
        if (!free && dT > 1e-6 && (tieSweep > 0 || tieSwirl)) {
          cx /= dT; cy /= dT; cz /= dT;
          if (tieSwirl && ok) { const a = tieSwirl * smooth(0.045, 0.1, dT), cs = Math.cos(a), sn = Math.sin(a), rx = g[1] * cz - g[2] * cy, ry = g[2] * cx - g[0] * cz, rz = g[0] * cy - g[1] * cx; cx = cx * cs + rx * sn; cy = cy * cs + ry * sn; cz = cz * cs + rz * sn; }
          if (sAt < tieSweep) { const k = smooth(0, tieSweep, sAt); cx = dir[i * 3] * (1 - k) + cx * k; cy = dir[i * 3 + 1] * (1 - k) + cy * k; cz = dir[i * 3 + 2] * (1 - k) + cz * k; }
        }
        if (!free && dT > 1e-6 && (drape > 0 || round)) {
          const cl = Math.hypot(cx, cy, cz) || 1; cx /= cl; cy /= cl; cz /= cl;
          const tAz = Math.atan2(tie.at[0] - C[0], tie.at[2] - C[2]), tR = Math.hypot(tie.at[0] - C[0], tie.at[2] - C[2]);
          const eta = py - tie.at[1], ex = px - C[0], ez = pz - C[2], r = Math.hypot(ex, ez) || 1, ap = Math.abs(Math.atan2(ex, ez)) / D, sgn = ex >= 0 ? 1 : -1, bx = sgn * ez / r, bz = -sgn * ex / r;   // (b: round the head toward the back)
          // round an ear that's out: in front of its lane and above the ear, to its own pass over the ear's top, at its
          // lane; not to the tie yet (the hair in front of the ear, the sideburn's, too: up the front of the ear to above
          // its top first, then back with the rest)
          let wg = 0;
          if (round && az0 < EBACK && ok && d0 < 0.06) wg = smooth(-2, 6, lane - ap) * round * Math.max(smooth(ETOP - 0.004, ETOP + 0.006, py), (1 - smooth(EAR.az + EAR.da * 0.9, EAR.az + EAR.da * 1.1, ap)) * smooth(tie.guard - 0.004, tie.guard + 0.01, py));   // (level with the ear or above it only: under the ear it's on its way to the tie)
          if (drape > 0 && eta > 0.004) {
            // Drape. Where the head doesn't hold it up (its side from the widest part down, or already off the skin),
            // and near its tie's own plumb line, tied hair leaves the skin and hangs to its tie along a curve of its
            // own, planned where it leaves: plumb down to a gather's height over the tie (Gather: 7.5 cm, measured on
            // the user's Daz3D twin tails), then in to it, its distance from the head's axis and its bearing round it
            // each going to the tie's as 1 - (1 - t)^2 of its height over the tie in gather heights; and with Puff
            // (slack) it bows out from the head on the way, as t (1 - t)^1.5, fullest two fifths of the way up from
            // the tie, and tucks in to it: a rounded bulb over the tie. Hair that has come further bows more: it lies
            // outside hair from nearer by, and the bulb has a body. It is steered at the curve's next point, so it comes
            // back to it when the body or an ear puts it off. Hair far round the head from its tie runs to it along the
            // head, as hair with no drape does, and joins the others as it comes near
            if (!hung) {
              // (as far round the head from its tie as a quarter turn: the back of the head's hair hangs too, a bob's curtain, and is swept round to the tie; past that it runs along the head)
              let dA = (Math.atan2(ex, ez) - tAz) / D; dA -= 360 * Math.round(dA / 360);
              leave = drape * (ok && d0 < GAP + V + 0.008 ? 1 - smooth(-0.05, 0.25, g[1]) : 1) * (1 - smooth(70, 100, Math.abs(dA))) * (1 - wg);
              if (leave > 0.5 * drape) { hung = true; eta0 = Math.max(eta, 0.03); r0x = r; r0z = dA * D; bow = puff * (0.4 + 0.6 * smooth(0.02, 0.12, sAt)) * (0.8 + 0.4 * hash(u[i], 21)) * Math.min(1, eta0 / 0.08); }
              else if (leave > 0) { cx *= 1 - leave; cy = cy * (1 - leave) - leave; cz *= 1 - leave; }
            }
            if (hung) {
              leave = drape * (1 - wg);
              const tq = clamp((eta - dl) / eta0, 0, 1), tg = Math.min(1, (eta - dl) / GATHER), F = tg > 0 ? 1 - (1 - tg) * (1 - tg) : 0, B = bow * tq * Math.pow(1 - tq, 1.5) / 0.1859;   // (plumb down to a gather's height over the tie, then in. Tried and taken out: a longer gather for hair from further round the head, to round off the corner where it turns for the tie; from her second picture's side the corner stayed, and from the front the side came in half a centimetre too early)
              // (its place on the curve round the head's own axis: how far out, and its bearing, each from where it left to the tie's; a straight line across would go through the neck)
              const rT = tR + (r0x - tR) * F + B, aT = tAz + r0z * F, gx = C[0] + rT * Math.sin(aT) - px, gy = tie.at[1] + eta0 * tq - py, gz = C[2] + rT * Math.cos(aT) - pz, gl = Math.hypot(gx, gy, gz) || 1;
              cx = cx * (1 - leave) + gx / gl * leave; cy = cy * (1 - leave) + gy / gl * leave; cz = cz * (1 - leave) + gz / gl * leave;
            }
          }
          if (wg > 0) { const gy = ETOP + 0.007 + 0.016 * hash(u[i], 15) - py, ga = (lane - ap) * D * r * (ap < EAR.az ? smooth(ETOP - 0.006, ETOP + 0.01, py) : 1), gl = Math.hypot(ga, gy) || 1; cx = cx * (1 - wg) + bx * ga / gl * wg; cy = cy * (1 - wg) + gy / gl * wg; cz = cz * (1 - wg) + bz * ga / gl * wg; }
          if (round && ok && d0 < 0.06) {                                 // and never forward past its lane (the ear's back edge) while it's level with the ear
            const f = cx * bx + cz * bz, kf = f < 0 ? (1 - smooth(lane, lane + 5, ap)) * smooth(tie.guard - 0.004, tie.guard + 0.01, py) * round : 0;
            if (kf > 0) { cx -= bx * f * kf; cz -= bz * f * kf; }
          }
        }
      }
      else if (own) { cx = dir[i * 3]; cy = dir[i * 3 + 1]; cz = dir[i * 3 + 2]; wc = 1 - smooth(ownHold * 0.4, ownHold + 1e-6, sAt); }
      else if (near && field(px, py, pz, c)) { cx = c[0]; cy = c[1]; cz = c[2]; wc = Math.max(smooth(0.12, 0.5, g[1]), hold * (1 - smooth(holdLen * 0.5, holdLen, sAt))); }
      else if (near && py > MARKS.brow + 0.01 && pz > C[2] && Math.abs(Math.atan2(px, pz - C[2])) < 54 * D && Math.abs(tx) > 0.25) {   // combed to the side over the forehead's corner: it carries on to the temple before it falls (never down over the face)
        cx = tx; cy = ty - 0.25; cz = tz; wc = 0.9;
      }
      if (gr === LOOSE && ok && d0 < 0.045 && (px >= C[0] ? tuckL : tuckR)) {   // tucked: in front of and over the ear the hair goes back along the head, coming down only as far as its own pass over the ear's top
        const ex = px - C[0], ez = pz - C[2], ap = Math.abs(Math.atan2(ex, ez)) / D;
        const tk = smooth(16, 32, ap) * (1 - smooth(EAR.az + EAR.da * 1.1, EAR.az + EAR.da * 1.4, ap)) * smooth(ETOP - 0.002, ETOP + 0.006, py) * (1 - smooth(ETOP + 0.05, ETOP + 0.085, py));   // (from the forehead's corner on: no strands left hanging in front of the ear)
        if (tk > 0) {
          // its pass: over the ear's top; in front of that along the hairline (never down across the forehead: the hair is swept to the side along its edge)
          const sgn = ex >= 0 ? 1 : -1, r = Math.hypot(ex, ez) || 1, h15 = hash(u[i], 15), a = wc * (1 - tk);
          const pass = Math.max(ETOP + 0.007 + 0.016 * h15, ctx.limit && ap < 62 ? (Math.min(0.09, ctx.limit(sgn * ap)) + 0.002 + 0.012 * h15) * (1 - smooth(46, 62, ap)) : 0);
          cx = cx * a + sgn * ez / r * tk; cy = cy * a - 0.9 * smooth(0, 0.035, py - pass) * tk; cz = cz * a - sgn * ex / r * tk; wc += (1 - wc) * tk;
        }
      }
      let draping = false;
      if (gr === LOOSE && FRONT && ok && d0 < 0.06 && py < EBOT && py > MARKS.shoulder && (px >= C[0] ? tuckL : tuckR)) {   // and, tucked, it comes forward under the ear to hang in front of the shoulder (Over the shoulders): long hair seen from the front, the ears out above it
        const ex = px - C[0], ez = pz - C[2], ap = Math.abs(Math.atan2(ex, ez)) / D, to = 46 + 15 * hash(u[i], 17);   // (to in front of the shoulder's ridge: over the collarbone, each to its own place there)
        const k = ap < 152 ? smooth(to, to + 12, ap) * (1 - smooth(EBOT - 0.004, EBOT + 0.004, py)) * smooth(MARKS.shoulder, MARKS.shoulder + 0.02, py) : 0;
        if (k > 0) {
          const sgn = ex >= 0 ? 1 : -1, r = Math.hypot(ex, ez) || 1, a = wc * (1 - k);
          cx = cx * a - sgn * ez / r * k; cy = cy * a - 0.7 * k; cz = cz * a + sgn * ex / r * k; wc += (1 - wc) * k; draping = k > 0.15;
          if (draping) { rest = Math.max(rest, 0.16); draped = true; }       // (and it may lie on down the chest to its cut: it came there to hang, not to gather)
        }
      }
      if (wc > 0 && ok && !free) {                                        // along the skin (draped hair that hangs: only kept from going into it)
        const kk = cx * g[0] + cy * g[1] + cz * g[2], k1 = kk > 0 ? kk * (1 - leave) : kk; cx -= g[0] * k1; cy -= g[1] * k1; cz -= g[2] * k1;
      }
      const cn = Math.hypot(cx, cy, cz); if (cn < 1e-6) wc = 0; else { cx /= cn; cy /= cn; cz /= cn; }
      let dx = cx * wc, dy = cy * wc - (1 - wc), dz = cz * wc;
      // the ends turn in (or out) round a radius
      if (turnLen > 0 && !tie && gr !== FRINGE) {
        const left = byLine ? Math.min(L - sAt, py - cutLine(cut, Math.atan2(px, pz - C[2]) / D)) : L - sAt;
        if (left < turnLen) {
          const b = Math.sign(turnAmt) * (1 - Math.max(0, left) / turnLen) * 1.25, hx = -(px - C[0]), hz = -(pz - C[2]), hl = Math.hypot(hx, hz) || 1, dn = Math.hypot(dx, dy, dz) || 1;
          dx = dx / dn * Math.cos(b) + hx / hl * Math.sin(b); dy = dy / dn * Math.cos(b); dz = dz / dn * Math.cos(b) + hz / hl * Math.sin(b);
        }
      }
      const dn = Math.hypot(dx, dy, dz) || 1; dx /= dn; dy /= dn; dz /= dn;
      const a2 = hung ? Math.max(al, 0.7) : al;                           // (hair on its own hanging curve follows it: the curve is smooth already)
      tx += (dx - tx) * a2; ty += (dy - ty) * a2; tz += (dz - tz) * a2;
      const tn = Math.hypot(tx, ty, tz) || 1; tx /= tn; ty /= tn; tz /= tn;
      let qx = px + tx * dl, qy = py + ty * dl, qz = pz + tz * dl;
      // lie: out of the body and the hair below, down onto it while it's combed. How thick the hair lies is the
      // Volume of where it is, not of where it grew: hair from the top that hangs past the sides stands as far off
      // the head there as the sides' Volume says
      let Vq = V;
      if (gr === LOOSE && VOL) {
        const ex = qx - C[0], ey = qy - C[1], ez = qz - C[2], el = Math.asin(clamp(ey / (Math.hypot(ex, ey, ez) || 1), -1, 1)) / D, aq = Math.abs(Math.atan2(ex, ez)) / D, t = smooth(36, 54, el), b = smooth(104, 128, aq);
        Vq = t * VOL[0] + (1 - t) * ((1 - b) * VOL[1] + b * VOL[2]);
      }
      if (tie && tieBack > 0) {                                           // Fullness at the back: tied hair lies thicker on the back of the head (behind the ears, below the top), where a gathered style carries its body; the sides, which the face is seen between, stay as they are
        const ex = qx - C[0], ey = qy - C[1], ez = qz - C[2], el = Math.asin(clamp(ey / (Math.hypot(ex, ey, ez) || 1), -1, 1)) / D, aq = Math.abs(Math.atan2(ex, ez)) / D;
        Vq = V + tieBack * (1 - smooth(36, 54, el)) * smooth(112, 136, aq);   // (from well behind the ear on: nearer the side it widens the head as the face is seen)
      }
      const h = GAP + Vq * (1 - Math.exp(-sAt / reach)) * jit + (draped ? 0.014 * hash(u[i], 18) : 0);   // (hair brought forward over a shoulder hangs as a lock with some body, not a sheet on the chest)
      for (let pass = 0; pass < 2; pass++) {
        const dq = dist(S, qx, qy, qz); if (!grad(S, qx, qy, qz, g)) break;
        if (dq < h) { qx += g[0] * (h - dq); qy += g[1] * (h - dq); qz += g[2] * (h - dq); }
        else if (wc > 0.05 && !free && dq < h + 0.03) { const k2 = (dq - h) * Math.min(1, wc * 1.3) * (1 - leave); qx -= g[0] * k2; qy -= g[1] * k2; qz -= g[2] * k2; }
        else break;
        if (pass === 0) { const vx = qx - px, vy = qy - py, vz = qz - pz, vl = Math.hypot(vx, vy, vz) || 1; qx = px + vx / vl * dl; qy = py + vy / vl * dl; qz = pz + vz / vl * dl; }   // the step keeps its length
      }
      if (atTie) { const r = (tie.radius || 0.012) * 0.55; qx = tie.at[0] + (hash(u[i], 12) - 0.5) * r; qy = tie.at[1] + (hash(u[i], 13) - 0.5) * r; qz = tie.at[2] + (hash(u[i], 14) - 0.5) * r; done = true; }
      // the rules
      const azq = Math.atan2(qx, qz - C[2]) / D;
      if (gr === LOOSE && !hasFringe && Math.abs(azq) < 33 && qy < MARKS.brow + 0.018 && qy > MARKS.chin - 0.02 && qz > 0.02) {   // not over the eyes, the nose, the mouth: out to the face's side
        const want = Math.sign(qx || 1) * Math.tan((38 + 12 * hash(u[i], 9)) * D) * (qz - C[2]); qx += (want - qx) * 0.6;   // (each to its own place there, in with the hair beside the face: not all down one line)
      }
      if (ears === "clear" && !own && earIn(azq, qy) < 1.12 && dist(S, qx, qy, qz) < 0.03) done = true;   // the ear left clear: the hair is cut where it would cover it
      if ((gr === LOOSE || tie) && (qx >= C[0] ? tuckL : tuckR) && qy > (round ? tie.guard : EAR.y - 0.012) && earIn(azq, qy) < EOUT && dist(S, qx, qy, qz) < 0.045) {   // tucked: never across the ear; lifted back onto its outline (over the top, down behind); tied hair on its way up to a tie goes over the ear's top too
        const da = Math.abs((Math.abs(azq) - EAR.az) / EAR.da);
        if (round) {
          // a tie under the ear itself (within the ear's span round the head, below its middle: low twin tails by the
          // ears). Hair bound for it has to get down past the ear, and only ever over its top and down behind it: in
          // front of the ear's middle it is lifted onto the outline and moved on toward the back; behind it, it is put
          // straight back to the outline's back edge at its own height, so it slides down behind the ear. (Lifted only,
          // it stepped into the outline on its way down, was put back up on the top, and shuttled there for good. Put
          // out the short way, the way it lies from the ear's middle, hair that came in low and in front went down and
          // forward and hooked under the lobe.)
          const u = (Math.abs(azq) - EAR.az) / EAR.da, v = (qy - EAR.y) / EAR.dy, ex = qx - C[0], ez = qz - C[2], r = Math.hypot(ex, ez), sg = Math.sign(ex || 1);
          let a2;
          if (u < 0) { qy = Math.max(qy, EAR.y + EAR.dy * Math.pow(Math.max(0, Math.pow(EOUT, EAR.n) - Math.pow(da, EAR.n)), 1 / EAR.n)); a2 = Math.atan2(ex, ez) + sg * 2.5 * D; }
          else a2 = sg * Math.max(Math.abs(azq), EAR.az + EAR.da * Math.pow(Math.max(0, Math.pow(EOUT, EAR.n) - Math.pow(Math.abs(v), EAR.n)), 1 / EAR.n)) * D;
          qx = C[0] + r * Math.sin(a2); qz = C[2] + r * Math.cos(a2);
        }
        else {
          qy = Math.max(qy, EAR.y + EAR.dy * Math.pow(Math.max(0, Math.pow(EOUT, EAR.n) - Math.pow(da, EAR.n)), 1 / EAR.n));
          if (!tie && Math.abs(azq) > EAR.az - EAR.da * 0.6) {            // and on round the head to the back while it's over the ear: it comes down behind it, never in front or over its rim
            const ex = qx - C[0], ez = qz - C[2], r = Math.hypot(ex, ez), a2 = Math.atan2(ex, ez) + Math.sign(ex || 1) * 2.5 * D;
            qx = C[0] + r * Math.sin(a2); qz = C[2] + r * Math.cos(a2);
          }
        }
      }
      if (qy < cap) done = true;                                          // (never below the chest)
      if (!tie && !draping && qy < MARKS.chin && dist(S, qx, qy, qz) < h + 0.004) {            // lying on the neck, a shoulder, the chest: it gathers there; it may hang on down, it never runs along the body sideways (but round the neck to the front, when it's tucked and falls over the shoulders)
        // (what ends it is running along the body, not lying on it: hair that still comes down, down the back or the chest, goes on to its cut; on a shoulder's top it ends within a centimetre or so: no brim of hair spread along the shoulders)
        const level = Math.max(0, 1 - 2 * Math.max(0, py - qy) / dl), outward = Math.max(0, Math.abs(qx) - Math.abs(px));   // (and it doesn't slide out along a shoulder's slope: long hair falls in front of a shoulder or behind it, it doesn't fan over it)
        rest -= dl * (g[1] > 0.6 ? 4 : 1.5) * level + outward * 2.5; if (rest <= 0) done = true;
      }
      if (byLine && gr !== FRINGE && gr !== FRAME && !tie) {              // cut to the line (a face-framing strand has its own, below: on tied hair nobody sets the cut's line, and its default cut every tendril at the chin whatever its own length said)
        const line = cutLine(cut, azq) + (hash(u[i], 5) - 0.5) * 0.012 * (cut.uneven ?? 0.15) + (ctx.raise ? ctx.raise[i] : 0);
        if (qy < line) { const f = clamp((py - line) / Math.max(1e-6, py - qy), 0, 1); qx = px + (qx - px) * f; qy = py + (qy - py) * f; qz = pz + (qz - pz) * f; sAt -= dl * (1 - f); done = true; }
      }
      const overFace = hasFringe && gr === LOOSE && qz > C[2] + 0.045 && Math.abs(azq) < (fr.width ?? 46) && qy > MARKS.chin;   // hair from behind a fringe that comes down over the face is cut with it
      if ((gr === FRINGE || overFace) && fr.line !== undefined) {         // the fringe's own line (the brows, the eyes...), arched by its Curve
        // (Choppy: each lock its own length; Centre lock: longer between the eyes; Slant: longer toward one side, hair over one eye)
        const line = fr.line + (fr.arch || 0) * 0.02 * Math.pow(Math.abs(azq) / 45, 2) + (hash(u[i], 6) - 0.5) * 0.008 * (fr.uneven ?? 0.3)
          + (gr === FRINGE ? (ctx.cu ? hash(ctx.cu[i], 26) * 0.04 * (fr.choppy || 0) : 0) - (fr.centre || 0) * 0.032 * Math.exp(-(azq * azq) / 70) : 0.006)   // (the fringe's own locks only: a lock shorter by up to four centimetres, the centre one longer; the hair from behind it that's cut with it ends a little above its line, under it)
          - (fr.slant || 0) * 0.05 * clamp(azq / 45, -1.2, 1.2);
        if (qy < line) { const f = clamp((py - line) / Math.max(1e-6, py - qy), 0, 1); qx = px + (qx - px) * f; qy = py + (qy - py) * f; qz = pz + (qz - pz) * f; sAt -= dl * (1 - f); done = true; }
      }
      if (gr === FRAME) {                                                 // a face-framing strand's own line (the cheek, the jaw...)
        const line = ctx.fline && ctx.fline[i] < 1 ? ctx.fline[i] : (fr.frameCurl || 0) > 0 ? DRILL_TOP - 0.012 : (fr.frameLine ?? MARKS.jaw) + (hash(u[i], 6) - 0.5) * 0.02 * (fr.uneven ?? 0.3);   // (wound into a ringlet: they end where it begins, ties.js drills; fline: a tendril's lock's own line, a wisp by the ear's: engine.js)
        if (qy < line) { const f = clamp((py - line) / Math.max(1e-6, py - qy), 0, 1); qx = px + (qx - px) * f; qy = py + (qy - py) * f; qz = pz + (qz - pz) * f; sAt -= dl * (1 - f); done = true; }
      }
      tx = qx - px; ty = qy - py; tz = qz - pz; const tl = Math.hypot(tx, ty, tz); if (tl < 1e-7) break; tx /= tl; ty /= tl; tz /= tl;
      px = qx; py = qy; pz = qz; poly[m * 3] = px; poly[m * 3 + 1] = py; poly[m * 3 + 2] = pz; m++;
    }
    if (m < 2) continue;
    // the K kept points, by how far along the hair each is
    let total = 0; const acc = [0];
    for (let k = 1; k < m; k++) { total += Math.hypot(poly[k * 3] - poly[k * 3 - 3], poly[k * 3 + 1] - poly[k * 3 - 2], poly[k * 3 + 2] - poly[k * 3 - 1]); acc.push(total); }
    if (total < 0.0015) continue;
    got[i] = total;
    let seg = 1;
    for (let k = 0; k < K; k++) {
      const want = TS[k] * total; while (seg < m - 1 && acc[seg] < want) seg++;
      const a = acc[seg - 1], b = acc[seg], f = b > a ? (want - a) / (b - a) : 0, o = (i * K + k) * 3, q = seg * 3;
      out[o] = poly[q - 3] + (poly[q] - poly[q - 3]) * f; out[o + 1] = poly[q - 2] + (poly[q + 1] - poly[q - 2]) * f; out[o + 2] = poly[q - 1] + (poly[q + 2] - poly[q - 1]) * f;
    }
  }
  return { pts: out, len: got, t: TS };
}
