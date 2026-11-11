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
import { MARKS, earIn } from "./pores.js";

export const K = 24;                                                     // points a hair keeps
export const GAP = 0.0022;                                               // hair this far off the skin, at the least
export const TS = Array.from({ length: K }, (_, k) => Math.pow(k / (K - 1), 1.35));   // where the kept points are along a hair: closer near the root, where it bends
const D = Math.PI / 180, MAXS = 72;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// two more numbers of a pore's own, from its one
export const hash = (u, k) => { const x = Math.sin((u + 0.137) * (12.9898 + k * 78.233)) * 43758.5453; return x - Math.floor(x); };

// the cut line's height at an angle round the head: Tilt lowers the front (an A-line) or the back, Round dips the back's middle
export function cutLine(c, az) {
  const a = Math.abs(az) * D;
  return (c.line ?? -0.1) - (c.tilt || 0) * 0.045 * Math.cos(a) - (c.round || 0) * 0.035 * smooth(115, 180, Math.abs(az));
}

// ctx: { n, pos, nrm, dir, lift, group, u, len (the length each may reach), vol (how thick the hair lies there), S (the
//        distance grid), field(x, y, z, out), C, s (the settings), ties }
export function trace(ctx) {
  const { n, pos, nrm, dir, lift, group, u, len, vol, S, field, C, s } = ctx;
  const cut = s.cut || {}, sh = s.shape || {}, fr = s.fringe || {}, byLine = cut.mode === "line", hasFringe = !!fr.kind && fr.kind !== "none";
  const hold = clamp((s.comb && s.comb.hold) ?? 0.3, 0, 1), holdLen = 0.02 + 0.3 * hold;
  const turnAmt = clamp(sh.turn ?? 0, -1, 1), turnR = Math.max(0.008, sh.turnRadius ?? 0.03), turnLen = turnR * Math.PI / 2 * Math.abs(turnAmt);
  const bendLen = 0.004 + 0.05 * clamp(sh.stiff ?? 0.2, 0, 1), ears = s.ears || "covered", cap = MARKS.chest - 0.04;
  const out = new Float32Array(n * K * 3), got = new Float32Array(n), poly = new Float32Array((MAXS + 2) * 3), g = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    let L = len[i]; if (!(L > 0.0015)) continue;
    const gr = group[i], steps = clamp(Math.ceil(L / 0.008), 5, MAXS), dl = L / steps, al = 1 - Math.exp(-dl / bendLen);
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2], cl = Math.cos(lift[i]), sl = Math.sin(lift[i]);
    let px = pos[i * 3] + nx * 0.0006, py = pos[i * 3 + 1] + ny * 0.0006, pz = pos[i * 3 + 2] + nz * 0.0006;
    let tx = dir[i * 3] * cl + nx * sl, ty = dir[i * 3 + 1] * cl + ny * sl, tz = dir[i * 3 + 2] * cl + nz * sl;
    const V = vol[i], reach = V / Math.max(sl, 0.1), jit = 0.88 + 0.24 * hash(u[i], 3);
    const tie = gr >= TIE ? ctx.ties[gr - TIE] : null, own = gr === FRINGE || gr === FRAME, ownHold = own ? (gr === FRINGE ? (fr.hold ?? 0.5) : 0.25) * L : 0;
    poly[0] = px; poly[1] = py; poly[2] = pz;
    let m = 1, sAt = 0, rest = 0.03, done = false;
    for (let k = 1; k <= steps && !done; k++) {
      sAt = k * dl;
      const d0 = dist(S, px, py, pz), ok = grad(S, px, py, pz, g), near = ok && d0 < GAP + V + 0.014;
      // the way wanted: combed, or falling
      let wc = 0, cx = 0, cy = 0, cz = 0;
      let free = false, atTie = false;
      if (tie) {                                                          // toward its tie along the head; the last few centimetres straight to it, and it ends in it
        cx = tie.at[0] - px; cy = tie.at[1] - py; cz = tie.at[2] - pz; wc = 1; const dT = Math.hypot(cx, cy, cz);
        free = dT < 0.045; if (dT < (tie.radius || 0.012) * 0.6 + dl * 1.2) atTie = true;
      }
      else if (own) { cx = dir[i * 3]; cy = dir[i * 3 + 1]; cz = dir[i * 3 + 2]; wc = 1 - smooth(ownHold * 0.4, ownHold + 1e-6, sAt); }
      else if (near && field(px, py, pz, c)) { cx = c[0]; cy = c[1]; cz = c[2]; wc = Math.max(smooth(0.12, 0.5, g[1]), hold * (1 - smooth(holdLen * 0.5, holdLen, sAt))); }
      else if (near && py > MARKS.brow + 0.01 && pz > C[2] && Math.abs(Math.atan2(px, pz - C[2])) < 54 * D && Math.abs(tx) > 0.25) {   // combed to the side over the forehead's corner: it carries on to the temple before it falls (never down over the face)
        cx = tx; cy = ty - 0.25; cz = tz; wc = 0.9;
      }
      if (wc > 0 && ok && !free) { const kk = cx * g[0] + cy * g[1] + cz * g[2]; cx -= g[0] * kk; cy -= g[1] * kk; cz -= g[2] * kk; }   // along the skin
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
      tx += (dx - tx) * al; ty += (dy - ty) * al; tz += (dz - tz) * al;
      const tn = Math.hypot(tx, ty, tz) || 1; tx /= tn; ty /= tn; tz /= tn;
      let qx = px + tx * dl, qy = py + ty * dl, qz = pz + tz * dl;
      // lie: out of the body and the hair below, down onto it while it's combed
      const h = GAP + V * (1 - Math.exp(-sAt / reach)) * jit;
      for (let pass = 0; pass < 2; pass++) {
        const dq = dist(S, qx, qy, qz); if (!grad(S, qx, qy, qz, g)) break;
        if (dq < h) { qx += g[0] * (h - dq); qy += g[1] * (h - dq); qz += g[2] * (h - dq); }
        else if (wc > 0.05 && !free && dq < h + 0.03) { const k2 = (dq - h) * Math.min(1, wc * 1.3); qx -= g[0] * k2; qy -= g[1] * k2; qz -= g[2] * k2; }
        else break;
        if (pass === 0) { const vx = qx - px, vy = qy - py, vz = qz - pz, vl = Math.hypot(vx, vy, vz) || 1; qx = px + vx / vl * dl; qy = py + vy / vl * dl; qz = pz + vz / vl * dl; }   // the step keeps its length
      }
      if (atTie) { const r = (tie.radius || 0.012) * 0.55; qx = tie.at[0] + (hash(u[i], 12) - 0.5) * r; qy = tie.at[1] + (hash(u[i], 13) - 0.5) * r; qz = tie.at[2] + (hash(u[i], 14) - 0.5) * r; done = true; }
      // the rules
      const azq = Math.atan2(qx, qz - C[2]) / D;
      if (gr === LOOSE && !hasFringe && Math.abs(azq) < 33 && qy < MARKS.brow + 0.018 && qy > MARKS.chin - 0.02 && qz > 0.02) {   // not over the eyes, the nose, the mouth: out to the face's side
        const want = Math.sign(qx || 1) * Math.tan((44 + 12 * hash(u[i], 9)) * D) * (qz - C[2]); qx += (want - qx) * 0.6;   // (each to its own place there, in with the hair beside the face: not all down one line)
      }
      if (ears === "clear" && !own && earIn(azq, qy) < 1.12 && dist(S, qx, qy, qz) < 0.03) done = true;   // the ear left clear: the hair is cut where it would cover it
      if (qy < cap) done = true;                                          // (never below the chest)
      if (!tie && qy < MARKS.chin && dist(S, qx, qy, qz) < h + 0.004) {            // lying on the neck, a shoulder, the chest: it gathers there; it may hang on down, it never runs along the body sideways
        const side = Math.hypot(qx - px, qz - pz), downs = Math.max(0, py - qy);
        rest -= g[1] > 0.72 ? dl : dl * (0.25 + 1.5 * side / (side + downs + 1e-6)); if (rest <= 0) done = true;
      }
      if (byLine && gr !== FRINGE && !tie) {                              // cut to the line
        const line = cutLine(cut, azq) + (hash(u[i], 5) - 0.5) * 0.012 * (cut.uneven ?? 0.15) + (ctx.raise ? ctx.raise[i] : 0);
        if (qy < line) { const f = clamp((py - line) / Math.max(1e-6, py - qy), 0, 1); qx = px + (qx - px) * f; qy = py + (qy - py) * f; qz = pz + (qz - pz) * f; sAt -= dl * (1 - f); done = true; }
      }
      const overFace = hasFringe && gr === LOOSE && qz > C[2] + 0.045 && Math.abs(azq) < (fr.width ?? 46) && qy > MARKS.chin;   // hair from behind a fringe that comes down over the face is cut with it
      if ((gr === FRINGE || overFace) && fr.line !== undefined) {         // the fringe's own line (the brows, the eyes...), arched by its Curve
        const line = fr.line + (fr.arch || 0) * 0.02 * Math.pow(Math.abs(azq) / 45, 2) + (hash(u[i], 6) - 0.5) * 0.008 * (fr.uneven ?? 0.3);
        if (qy < line) { const f = clamp((py - line) / Math.max(1e-6, py - qy), 0, 1); qx = px + (qx - px) * f; qy = py + (qy - py) * f; qz = pz + (qz - pz) * f; sAt -= dl * (1 - f); done = true; }
      }
      if (gr === FRAME) {                                                 // a face-framing strand's own line (the cheek, the jaw...)
        const line = (fr.frameLine ?? MARKS.jaw) + (hash(u[i], 6) - 0.5) * 0.02 * (fr.uneven ?? 0.3);
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
