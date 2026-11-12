// The hair editor v2.0's engine (docs/HAIR_V2.md): a body, the fixed pores and a style's settings in; the hair out, as
// cards with the salon's bake on them. Everything in order: which pores grow (the hairline, thinning, the parting's
// width), which way each is combed (flow.js), each hair traced (strands.js: comb, lie, fall), textured, made a card
// (cards.js), finished (bake.js: shell normals, occlusion), counted (how much of the scalp is covered). Plain arrays,
// no three.js: the Character Studio's tab runs it in a worker, node runs it for the checks and Godot's pictures.
//
//   prepare(body)                       -> { S }  the body as a distance grid: once a body (about a second)
//   grow(body, pores, settings, prep, o) -> { hair: { position, normal, tangent, uv, uv1, color, index }, stats, guides }
//      o.draft: quick (no occlusion, no coverage count): while a slider is dragged
import { buildSDF, dist, grad, withLumps } from "./sdf.js";
import { earLumps } from "./body.js";
import { patch, paint } from "./scalp.js";
import { build as shells, SHELL_MAX } from "./shell.js";
import { place, alive, hairline, EAR, MARKS } from "./pores.js";
import { parts, comb, ease, fieldOf, partingSide, partingShare, sagittal, LOOSE, FRINGE, FRAME, TIE } from "./flow.js";
import { trace, hash, cutLine, K } from "./strands.js";
import { build, coverage, join } from "./cards.js";
import { clumpsOf, texture } from "./texture.js";
import { tiesOf, tail, band, drills, ahoge } from "./ties.js";
import { finish } from "./bake.js";
import { lookOf, drawLook, dyed } from "./styles.js";
import { linear } from "../hairtex.js";

const D = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
export const BUDGET = { light: 9000, medium: 20000, high: 40000 };       // triangles of cards, about (short hair's shells are their own)
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// S: the skin itself; Sc: the same with the ears covered over (hair that falls over them)
export function prepare(body, o = {}) { const t = now(), S = buildSDF(body.L, body.T, { normals: body.VN, ...o }), lumps = earLumps(body); return { S, Sc: withLumps(S, lumps), lumps, ms: now() - t }; }
// the body's surface for a way of wearing the ears: covered (both under the hair: Sc), clear and tucked (the ears as they
// are: the hair is cut round them, or goes behind them), tucked on one side (the other ear covered)
function surfaceFor(prep, ears) {
  if (ears === "covered" || !ears) return prep.Sc;
  if (ears === "tucked_left" || ears === "tucked_right") {
    const keep = ears === "tucked_left" ? -1 : 1, k = `S${keep}`;         // the lump of the ear that stays covered
    return prep[k] || (prep[k] = withLumps(prep.S, prep.lumps.filter(l => Math.sign(l.c[0]) === keep)));
  }
  return prep.S;
}
// the scalp's own patch of the skin (once a body and a pore set)
const patchOf = (prep, body, pores) => prep.patch || (prep.patch = patch(body, pores));

// the skin's point in a direction from the skull's middle (stepped in from outside)
function skinAlong(S, C, d) {
  let r = 0.2;
  for (let i = 0; i < 60; i++) { const q = dist(S, C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r); if (q < 0.0004) break; r -= Math.max(0.0004, q * 0.9); }
  return [C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r];
}

// Dyed hair's colours over the flat atlas it's drawn with (styles.js drawLook): the natural roots' and lengths', the
// dye's, and where along a hair the dye is (cards.js build's `dye`)
function dyeOf(s, lk) {
  const d = s.dye, M = linear(drawLook(s).tip), over = a => a.map((v, c) => Math.min(1, v / M[c]));
  return { nat0: over(linear(lk.root)), nat1: over(linear(lk.tip)), dy: over(linear(d.colour || "#7b3fd6")), dim: 0.72, abs: 0.1, roots: Math.max(0, d.roots || 0), ends: Math.max(0, d.ends || 0),
    tips: d.where === "tips" ? 0.02 + 0.2 * clamp(d.amount ?? 0.5, 0, 1) : 0, soft: clamp(d.soft ?? 0.5, 0, 1) };
}

export function grow(body, pores, s, prep, o = {}) {
  const S = surfaceFor(prep, s.ears), C = body.C, t0 = now(), ms = {}; let tl = t0; const lap = k => { const t = now(); ms[k] = +(t - tl).toFixed(1); tl = t; };
  // ---- the pores that grow: the first `density` of them, inside the hairline, not thinned away, not on the parting's skin, not under an ear
  // a card on wavy or curly hair needs many more points than one on straight hair: fewer, wider cards keep it within the detail's budget (never under 700 pores: the scalp stays covered)
  const tx0 = s.texture || {}, wavy0 = (tx0.wave || 0) > 0.002 || (tx0.curl || 0) > 0, budget = o.budget ?? BUDGET[s.detail || "medium"] ?? 20000;
  const per = (tx0.curl || 0) > 0.2 ? 40 : (tx0.wave || 0) > 0.008 ? 30 : wavy0 ? 22 : 0, want = Math.max(8, Math.round(s.density));
  const count = Math.min(pores.n, per ? Math.max(Math.min(want, 700), Math.min(want, Math.round(budget * 1.3 / per))) : want), A = alive(pores, s.hairline, count), all = place(pores, body.L, body.T, body.VN), lim = hairline(s.hairline);
  const pw = (s.parting && s.parting.kind !== "none" ? s.parting.width || 0 : 0) / 2, ids = [];
  for (let i = 0; i < count; i++) {
    if (!A.on[i]) continue;
    const x = all.pos[i * 3], y = all.pos[i * 3 + 1], z = all.pos[i * 3 + 2], nx = all.nrm[i * 3], ny = all.nrm[i * 3 + 1], nz = all.nrm[i * 3 + 2];
    if (dist(prep.S, x + nx * 0.009, y + ny * 0.009, z + nz * 0.009) < 0.003) continue;                  // something over it (an ear's flap): nothing grows
    if (pw > 0 && Math.abs(partingSide(s, x, z)) < pw && partingShare(s, sagittal(y, z, C)) > 0.5) continue;
    ids.push(i);
  }
  const n = ids.length, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), az = new Float32Array(n), by = new Float32Array(n), u = new Float32Array(n), edge = new Float32Array(n);
  ids.forEach((i, k) => { for (let a = 0; a < 3; a++) { pos[k * 3 + a] = all.pos[i * 3 + a]; nrm[k * 3 + a] = all.nrm[i * 3 + a]; } az[k] = pores.az[i]; by[k] = pores.base[i * 3 + 1]; u[k] = pores.u[i]; edge[k] = A.edge[i]; });
  lap("pores");
  // ---- which way each is combed
  const cr = s.crown || {}, ph = (cr.phi ?? -38) * D, cd = [(cr.x ?? 0.012) / 0.1, Math.cos(ph), Math.sin(ph)], cl = Math.hypot(...cd), crown = skinAlong(S, C, cd.map(v => v / cl));
  const ctx = { n, pos, nrm, az, by, u, C, s, crown, limit: lim, ties: tiesOf(S, C, s) };
  ctx.parts = parts(ctx);
  const cmb = comb(ctx); ease(ctx, cmb); const field = fieldOf(ctx, cmb);
  // the clumps (texture.js), and Messy: a clump's way and lift knocked a little off
  const spacing = Math.sqrt((pores.header.area_cm2 * 1e-4) / (0.866 * count)), tx = s.texture || {}, clump = clumpsOf({ n, pos, group: cmb.group, s, C, spacing, size: tx.clumpSize });
  if (tx.messy > 0) for (let i = 0; i < n; i++) {
    const c = clump.of[i], a = (hash(u[c], 51) - 0.5) * 2 * tx.messy * 32 * D + (hash(u[i], 52) - 0.5) * tx.messy * 14 * D, cs = Math.cos(a), sn = Math.sin(a);
    const kx = nrm[i * 3], ky = nrm[i * 3 + 1], kz = nrm[i * 3 + 2], vx = cmb.dir[i * 3], vy = cmb.dir[i * 3 + 1], vz = cmb.dir[i * 3 + 2];
    cmb.dir[i * 3] = vx * cs + (ky * vz - kz * vy) * sn; cmb.dir[i * 3 + 1] = vy * cs + (kz * vx - kx * vz) * sn; cmb.dir[i * 3 + 2] = vz * cs + (kx * vy - ky * vx) * sn;
    cmb.lift[i] *= 1 + (hash(u[c], 53) - 0.5) * 1.2 * tx.messy;
  }
  for (let i = 0; i < n; i++) {                                          // hair lies down round the whorl (it stands up in a tuft there otherwise)
    const dc = Math.hypot(pos[i * 3] - crown[0], pos[i * 3 + 1] - crown[1], pos[i * 3 + 2] - crown[2]); if (dc < 0.045 && cmb.group[i] === LOOSE) cmb.lift[i] *= 0.2 + 0.8 * smooth(0.006, 0.045, dc);
  }
  // ---- tendrils: the face-framing strands gathered into pointed locks (Tendrils: so many a side), each lock its own
  // length and its hairs drawn to its point; and the wisps by the ears, each to somewhere between the lobe and the jaw
  const fr0 = s.fringe || {}, NL = (fr0.frameCurl || 0) > 0 ? 0 : Math.round(clamp(fr0.frameLocks || 0, 0, 4)), fline = new Float32Array(n).fill(9), clumpAmt = new Float32Array(n); let anyLock = false;
  {
    const a0 = fr0.kind && fr0.kind !== "none" ? Math.max(34, (fr0.width ?? 46) - 8) : 36, base = fr0.frameLine ?? MARKS.jaw, stag = clamp(fr0.frameStagger ?? 0.5, 0, 1), guide = new Map(), lock = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      if (cmb.group[i] !== FRAME) continue;
      const a = Math.abs(az[i]), side = pos[i * 3] >= C[0] ? 1 : -1;
      if (a >= 64) { fline[i] = Math.max(base, MARKS.jaw - 0.012) + 0.035 * hash(u[i], 72); continue; }
      if (!NL) continue;
      const j = clamp(Math.floor((a - a0) / (64 - a0) * NL), 0, NL - 1), key = side * (j + 1), dd = Math.abs(a - (a0 + (j + 0.5) * (64 - a0) / NL)), gd = guide.get(key);
      lock[i] = key; if (!gd || dd < gd.d) guide.set(key, { i, d: dd });
    }
    // (a strand joins a lock only if it grows near the lock's guide. The band is by the angle round the head, and it
    // takes in pores down the temple's front edge that are in it by angle and eight centimetres away: gathered with the
    // rest, they hung on their own for half their length, out of the pull's reach, then jogged across to the guide: a
    // zigzag in the lock. Those stay plain face-framing strands, as with no locks)
    // (the bands only choose where each lock's guide is; which lock a strand joins is the nearest guide on its side,
    // not its band's: a strand beside one lock isn't left out because the other's guide is far)
    const reach = Math.max(0.02, 1.4 * (tx.clumpSize || 0.018));
    for (let i = 0; i < n; i++) {
      if (!lock[i]) continue;
      let key = 0, bd = reach;
      for (const [q, gd] of guide) { if ((q > 0) !== (lock[i] > 0)) continue; const d = Math.hypot(pos[i * 3] - pos[gd.i * 3], pos[i * 3 + 1] - pos[gd.i * 3 + 1], pos[i * 3 + 2] - pos[gd.i * 3 + 2]); if (d <= bd) { bd = d; key = q; } }
      if (!key) continue;
      const gI = guide.get(key).i, j = Math.abs(key) - 1, k = (j * 0.618 + (key > 0 ? 0.13 : 0.47) + (s.seed || 1) * 0.31) % 1;
      clump.of[i] = gI; clumpAmt[i] = gI === i ? 0 : 0.93; fline[i] = base + stag * 0.085 * k; anyLock = true;
    }
  }
  // the first row meets the line: a hair beside the parting, or by the whorl, starts at it (no bare strip a pore's
  // spacing wide: the parting is as wide as its Width says)
  const root = new Float32Array(pos), rootN = new Float32Array(nrm), g = [0, 0, 0], parted = s.parting && s.parting.kind !== "none";
  const split = ctx.ties.length === 2;                                     // (twin ties: the hair is parted down the middle of the head, front to nape: its first row meets that line too)
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; let back = 0;
    if (cmb.group[i] >= TIE) { if (split && Math.abs(x - C[0]) < 0.011) back = Math.abs(x - C[0]) * 0.92; }
    else if (cmb.group[i] !== LOOSE) continue;
    const share = parted ? partingShare(s, sagittal(y, z, C)) : 0;
    if (cmb.group[i] >= TIE) { /* (above) */ }
    else if (share > 0.5) { const dp = Math.abs(partingSide(s, x, z)) - pw; if (dp < 0.011) back = Math.max(0, dp) * 0.92; }
    else { const dc = Math.hypot(x - crown[0], y - crown[1], z - crown[2]); if (dc < 0.016) back = dc * 0.85 * (1 - share * 2); }
    if (back < 0.0006) continue;
    let qx = x - cmb.dir[i * 3] * back, qy = y - cmb.dir[i * 3 + 1] * back, qz = z - cmb.dir[i * 3 + 2] * back;
    for (let it = 0; it < 3; it++) { const d = dist(prep.S, qx, qy, qz); if (!grad(prep.S, qx, qy, qz, g)) break; qx -= g[0] * d; qy -= g[1] * d; qz -= g[2] * d; }
    root[i * 3] = qx; root[i * 3 + 1] = qy; root[i * 3 + 2] = qz; rootN[i * 3] = g[0]; rootN[i * 3 + 1] = g[1]; rootN[i * 3 + 2] = g[2];
  }
  lap("comb");
  // ---- how long and how thick each lies
  const P = ctx.parts, Lp = s.length, cut = s.cut || {}, byLine = cut.mode === "line", fr = s.fringe || {}, V = (s.shape && s.shape.volume) || {}, un = s.under || {};
  const len = new Float32Array(n), vol = new Float32Array(n), raise = new Float32Array(n), width = new Float32Array(n), taper = new Float32Array(n), roll = new Float32Array(n), rootT = new Float32Array(n);
  const w0 = (s.card.width ?? 2.3) * spacing, soft = s.hairline.soft ?? 0.5, tuckL = s.ears === "tucked" || s.ears === "tucked_left", tuckR = s.ears === "tucked" || s.ears === "tucked_right";
  // how long the hair is at a place, by its part: (the length, whether it's clipped short there: an undercut's)
  const lengthAt = (top, sides, back, nape, y) => {
    const part = top * Lp.top + sides * Lp.sides + back * Lp.back + nape * Lp.nape;
    if (un.height == null) return [part, false];
    const k = Math.max(top > 0.6 ? 1 : 0, smooth(un.height, un.height + (un.fade ?? 0.02), y));
    return [lerp(un.length ?? 0.012, part, k), k < 0.5];
  };
  for (let i = 0; i < n; i++) {
    // the soft edge's baby hairs: the loose hair's last few millimetres, and every other one of a tied-back hairline's (they're too short to reach the tie)
    const [part, clipped] = lengthAt(P.top[i], P.sides[i], P.back[i], P.nape[i], by[i]), fine = soft > 0 && (cmb.group[i] === LOOSE ? edge[i] < 0.3 : cmb.group[i] >= TIE && edge[i] < 0.45 && hash(u[i], 9) < 0.5 * soft + 0.2);
    let L = byLine && !clipped ? lerp(0.62, part, cut.layers || 0) : part * (1 - 0.3 * (cut.uneven ?? 0.25) * hash(u[i], 1));
    if (cmb.group[i] === FRINGE) L = Lp.fringe * (fr.line !== undefined ? 1.5 : 1) * (1 - 0.15 * (fr.uneven ?? 0.3) * hash(u[i], 1));
    else if (cmb.group[i] >= TIE) L = 0.56;                                                                 // tied: as far as its tie
    else if (cmb.group[i] === FRAME) L = 0.4;                                                               // a face-framing strand: as far as its line
    else if ((!byLine || clipped) && part <= SHELL_MAX) L = 0;                                            // short hair is shells, not a card (shell.js)
    if (hash(u[i], 2) < (cut.thin || 0)) { if (byLine && !clipped) raise[i] = 0.01 + 0.035 * hash(u[i], 4); else L *= 0.6 + 0.3 * hash(u[i], 4); }
    // two lengths, the other way (tiers "over"): a bob over a long nape. The hair that grows on the low back of the head keeps the cut's own line; all the rest is cut at the front's line, all round
    if (byLine && !clipped && cut.tiers === "over" && cut.front != null && cmb.group[i] === LOOSE && !(by[i] < (cut.overFrom ?? -0.005) && Math.abs(az[i]) > 104)) raise[i] += Math.max(0, cut.front - cutLine(cut, az[i]));
    if (fine && L > 0) L = Math.min(L, 0.008 + 0.022 * hash(u[i], 8));                                     // the soft edge's baby hairs: short and fine
    // tucked behind the ear: the hair in front of the ear and below its top can't go over it; it stays as short wisps there
    const wisp = cmb.group[i] === LOOSE && L > 0 && (pos[i * 3] >= 0 ? tuckL : tuckR) && Math.abs(az[i]) > 36 && Math.abs(az[i]) < 86 && by[i] < EAR.y + EAR.dy + 0.008;
    if (wisp) L = hash(u[i], 17) < 0.5 ? Math.min(L, 0.012 + 0.03 * hash(u[i], 16)) : 0;                   // (every other one: a few wisps, not a patch of stubble)
    len[i] = L;
    vol[i] = cmb.group[i] >= TIE ? 0.0015 + 0.008 * (1 - (ctx.ties[cmb.group[i] - TIE].tight ?? 0.6)) : cmb.group[i] === FRINGE ? 0.003 + 0.012 * (fr.curve ?? 0.4) : P.top[i] * (V.top ?? 0.007) + P.sides[i] * (V.sides ?? 0.007) + (P.back[i] + P.nape[i]) * (V.back ?? 0.009);
    width[i] = w0 * (fine ? 0.35 : wisp ? 0.4 : cmb.group[i] === FRINGE ? 0.6 + 0.4 * Math.min(1, fr.amount ?? 0.7) : cmb.group[i] === FRAME ? (Math.abs(az[i]) >= 64 ? 0.4 : 0.75) : 1);   // (a wisp by the ear: thin)
    taper[i] = L < 0.06 ? 0.65 : (s.card.taper ?? 0.3);
    roll[i] = L < 0.05 && cmb.lift[i] > 34 * D ? (hash(u[i], 7) - 0.5) * Math.PI * smooth(34 * D, 60 * D, cmb.lift[i]) : 0;
    rootT[i] = 0.97 * (1 - smooth(0.1, 0.6, edge[i]));                                                      // at the hairline's edge a lock starts as a point (full width from a centimetre in: where the scalp's shade is full, so are the locks)
  }
  // ---- each hair traced
  const cu = new Float32Array(n); for (let i = 0; i < n; i++) cu[i] = u[clump.of[i]];                    // each hair's lock's own number (a choppy fringe cuts by the lock)
  const tr = trace({ n, pos: root, nrm: rootN, dir: cmb.dir, lift: cmb.lift, group: cmb.group, u, len, vol, raise, S, field, C, s, ties: ctx.ties, limit: lim, cu, fline });
  lap("trace");
  // ---- texture: clumps, waves, curls, frizz, strays
  // (hair tucked behind an ear: no stray wisps off it, and after the waves and the locks have moved it, back out of the ear's outline)
  let held = null;
  if (tuckL || tuckR) { held = new Uint8Array(n); for (let i = 0; i < n; i++) held[i] = cmb.group[i] === LOOSE && (pos[i * 3] >= C[0] ? tuckL : tuckR) && Math.abs(az[i]) < 126 ? 1 : 0; }
  const tex = texture({ n, pts: tr.pts, len: tr.len, u, group: cmb.group, clump, S, C, s, spacing, held, clumpAmt: anyLock ? clumpAmt : null });
  if (held) for (let i = 0; i < n; i++) {
    if (cmb.group[i] !== LOOSE || !(tr.len[i] > 0) || !(pos[i * 3] >= C[0] ? tuckL : tuckR)) continue;
    for (let k = 1; k < K; k++) {
      const o = (i * K + k) * 3, x = tr.pts[o], y = tr.pts[o + 1], z = tr.pts[o + 2]; if (y < EAR.y - 0.012 || y > EAR.y + EAR.dy * 1.1) continue;
      const aq = Math.abs(Math.atan2(x - C[0], z - C[2])) / D, da = Math.abs((aq - EAR.az) / EAR.da); if (da >= 1.08) continue;
      const top = EAR.y + EAR.dy * Math.pow(Math.max(0, Math.pow(1.08, EAR.n) - Math.pow(da, EAR.n)), 1 / EAR.n);
      if (y < top && dist(prep.S, x, y, z) < 0.05) tr.pts[o + 1] = top;
    }
  }
  lap("texture");
  // ---- a second colour: which hairs are dyed. A streak is a lane the hair runs in: tied hair's bearing round its tie
  // (every hair on a line into the tie is one colour, so the stripes run into a bun as the hair does), other hair's
  // place round the head where it hangs (a slice of hair from the parting down, the way a colourist takes it: through
  // all the layers). Its width is the Streak size; the share of the hairs dyed is the Amount (of what's seen, within a few points: HAIR2)
  const DY = dyed(s) ? dyeOf(s, lookOf(s)) : null, dw = DY ? new Float32Array(n) : null, dye = s.dye || {}, tieShare = ctx.ties.map(() => 0);
  const laneW = lerp(4, 38, clamp(dye.size ?? 0.5, 0, 1)), dsd = (dye.seed || 1) * 3.217;
  const noise1 = (x, sd) => { const i = Math.floor(x), f = x - i, k = f * f * (3 - 2 * f); return hash(i * 0.7131 + sd, 63) * (1 - k) + hash((i + 1) * 0.7131 + sd, 63) * k; };
  const laneNoise = (lane, sd) => 0.7 * noise1(lane / laneW, sd) + 0.3 * noise1(lane / (laneW * 0.37), sd + 5.1);
  if (DY) {
    const amt = clamp(dye.amount ?? 0.5, 0, 1), tieN = ctx.ties.map(() => 0), k70 = Math.round(0.7 * (K - 1));
    let streak = null, cutAt = 0;
    if (dye.where === "streaks") {
      streak = new Float32Array(n);
      const frames = ctx.ties.map(t => { const nn = t.out, a = Math.abs(nn[1]) < 0.9 ? [nn[2], 0, -nn[0]] : [1, 0, 0], al = Math.hypot(...a), aa = a.map(v => v / al); return [aa, [nn[1] * aa[2] - nn[2] * aa[1], nn[2] * aa[0] - nn[0] * aa[2], nn[0] * aa[1] - nn[1] * aa[0]]]; });
      for (let i = 0; i < n; i++) {
        const gI = cmb.group[i];
        if (gI >= TIE) {
          // (the bearing it arrives on, from its own path some 5 cm before the tie, not its root's: measured on a low bun, a root's bearing is a median 9 degrees off the one its hair comes in on, more than a lane's fine width, and a hair dyed by its root lay in its neighbour's lane)
          let k = K - 1; while (k > 0 && (1 - tr.t[k]) * tr.len[i] < 0.05) k--;
          const o = (i * K + k) * 3, t = ctx.ties[gI - TIE], [fa, fb] = frames[gI - TIE], rx = (tr.len[i] > 0 ? tr.pts[o] : pos[i * 3]) - t.at[0], ry = (tr.len[i] > 0 ? tr.pts[o + 1] : pos[i * 3 + 1]) - t.at[1], rz = (tr.len[i] > 0 ? tr.pts[o + 2] : pos[i * 3 + 2]) - t.at[2]; streak[i] = laneNoise(Math.atan2(rx * fb[0] + ry * fb[1] + rz * fb[2], rx * fa[0] + ry * fa[1] + rz * fa[2]) / D, dsd + 11.3 * (gI - TIE + 1));
        }
        else { const o = (i * K + k70) * 3; streak[i] = laneNoise(Math.atan2(tr.pts[o] - C[0], tr.pts[o + 2] - C[2]) / D * (gI === FRINGE ? 1.6 : 1), dsd + (gI === FRINGE ? 3.3 : 0)); }   // (a fringe's stripes a little narrower: it's seen close)
      }
      const of = Array.from(streak).sort((p, q) => p - q); cutAt = amt >= 1 ? 2 : of[Math.min(n - 1, Math.floor(amt * n))] ?? 0;
    }
    for (let i = 0; i < n; i++) {
      const gI = cmb.group[i], c = clump.of[i], depth = by[i] - lim(az[i]); let w = 0;
      switch (dye.where) {
        case "all": w = 1; break;
        case "streaks": w = streak[i] < cutAt ? 1 : 0; break;
        case "under": w = gI !== FRINGE && by[i] < lerp(-0.04, 0.07, amt) + (hash(u[c], 64) - 0.5) * 0.008 ? 1 : 0; break;   // (the hair that grows low on the head: it shows under the rest, at the nape, behind the ears, in a tail)
        case "over": w = by[i] > lerp(0.115, 0.02, amt) + (hash(u[c], 64) - 0.5) * 0.008 ? 1 : 0; break;
        case "front": w = gI === FRAME || (Math.abs(az[i]) > 24 && Math.abs(az[i]) < lerp(40, 62, amt) && depth < lerp(0.006, 0.02, amt)) ? 1 : 0; break;   // (the strands beside the face and a narrow band of the hairline there: two pieces, never the top of the head)
        case "fringe": w = gI === FRINGE || (gI === FRAME && amt > 0.5) ? 1 : 0; break;
        case "split": w = pos[i * 3] >= C[0] ? 1 : 0; break;
        case "split_r": w = pos[i * 3] < C[0] ? 1 : 0; break;
        case "tips": w = gI === FRINGE || gI === FRAME || gI >= TIE ? 0 : 1; break;       // (a tied hair's ends are in its tail: the tail's tips are dyed)
      }
      dw[i] = w;
      if (gI >= TIE) { tieShare[gI - TIE] += w; tieN[gI - TIE]++; }
    }
    for (let k = 0; k < tieShare.length; k++) tieShare[k] = dye.where === "tips" || dye.where === "all" ? 1 : tieN[k] ? tieShare[k] / tieN[k] : 0;
  }
  // (a tied hair ends in its tie: the ends' rules are its tail's)
  const noEnd = DY ? Uint8Array.from(cmb.group, gI => (gI >= TIE ? 1 : 0)) : null;
  // ---- cards, and their finish
  const wavy = (tx.wave || 0) > 0.002 || (tx.curl || 0) > 0;
  // a card keeps points only where it bends; if that's over the detail's budget of triangles, a looser fit until it isn't
  const lk = lookOf(s), lum = hex => { const c = linear(hex); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const shade = { lr: lum(lk.root), lt: lum(lk.tip), rootLength: lk.rootLength ?? 0.3, abs: 0.1 };          // (cards.js: the roots' shade over the first 10 cm of any hair)
  let tol = wavy ? 0.0006 : 0.0008, most = wavy ? 22 : 14, geo = null, stray = null;
  const wisp = new Float32Array(n); for (let i = 0; i < n; i++) wisp[i] = cmb.group[i] === FRINGE ? (fr.wispy ?? 0.75) : cmb.group[i] === FRAME ? (fr.frameWispy ?? 0.85) : (cut.wispy ?? 0.3);
  if (tex.strays.n) {
    const sw = new Float32Array(tex.strays.n); for (let i = 0; i < sw.length; i++) sw[i] = 0.0014 + 0.002 * hash(tex.strays.u[i], 61);
    const stw = DY ? Float32Array.from(tex.strays.src, i => dw[i]) : null;   // (a wisp is its hair's colour)
    stray = build({ n: tex.strays.n, pts: tex.strays.pts, len: tex.strays.len, u: tex.strays.u, width: sw, taper: 0.7, wispy: 1, S, C, most: 12, tol: 0.0007, shade, dye: DY ? { ...DY, w: stw, roots: 0, ends: 0, tips: 0, abs: 0 } : null });
  }
  const room = budget * (wavy ? 1.35 : 1) - (stray ? stray.triangles : 0);   // (first a looser fit, then fewer points a card at the most: messy, frizzy hair bends at every point)
  for (let pass = 0; pass < 14; pass++) {
    geo = build({ n, pts: tr.pts, len: tr.len, u, width, taper, rootTaper: rootT, roll, wispy: wisp, S, C, axis: tex.axis, most, tol, shade, dye: DY ? { ...DY, w: dw, noEnd } : null });
    if (geo.triangles <= room) break;
    if (tol <= (wavy ? 0.0013 : 0.003)) tol *= 1.5; else if (most > 8) most -= 2; else break;
  }
  if (stray) geo = join(geo, stray);
  // ringlets (the face-framing strands wound up: where each side's strands end is where its ringlet hangs from) and an ahoge
  if ((fr.frameCurl || 0) > 0) {
    const tops = [];
    for (const side of [1, -1]) { let x = 0, z = 0, m = 0; for (let i = 0; i < n; i++) if (cmb.group[i] === FRAME && tr.len[i] > 0.02 && (pos[i * 3] >= C[0] ? 1 : -1) === side) { const o = (i * K + K - 1) * 3; x += tr.pts[o]; z += tr.pts[o + 2]; m++; } if (m) tops.push({ side, x: x / m, z: z / m }); }
    const dr = drills(S, C, s, tops);
    // (dyed: a ringlet is the colour of the strands wound into it; its cards are laid end to end, so it's one colour all the way down)
    const drw = DY && dr ? Float32Array.from({ length: dr.n }, (_, h) => { const side = tops[Math.floor(h / (dr.n / tops.length))].side; let a = 0, m = 0; for (let i = 0; i < n; i++) if (cmb.group[i] === FRAME && (pos[i * 3] >= C[0] ? 1 : -1) === side) { a += dw[i]; m++; } return m && a / m > 0.5 ? 1 : 0; }) : null;
    if (dr) geo = join(geo, build({ n: dr.n, pts: dr.pts, len: dr.len, u: dr.u, width: dr.width, taper: dr.taper, wispy: dr.wisp, v0: dr.v0, v1: dr.v1, S, C, out: dr.outv, most: 22, tol: 0.0003, dye: DY ? { ...DY, w: drw, roots: 0, ends: 0, tips: 0, abs: 0 } : null }));
  }
  { const ah = ahoge(S, C, s); if (ah) geo = join(geo, build({ n: ah.n, pts: ah.pts, len: ah.len, u: ah.u, width: ah.width, taper: 0.85, wispy: 0.55, S, C, out: ah.outv, most: 14, tol: 0.0004, dye: DY ? { ...DY, w: new Float32Array(ah.n).fill(dye.where === "all" || dye.where === "over" ? 1 : 0), ends: 0, tips: 0 } : null })); }
  lap("cards");
  const fin = finish(geo, S, { draft: !!o.draft });
  lap("finish");
  // ---- tails and buns from the ties, each its own cards (they swing on their own bones in Godot), and the ties themselves
  const tails = [], bands = [];
  for (const t of ctx.ties) {
    // (dyed: a tail has its tie's share of dyed hairs, as stripes down it; a dip dye its tips; the roots' rules don't reach it, and a bun has no ends)
    const tg = tail(t, { S, C, s, seed: s.seed }), share = tieShare[ctx.ties.indexOf(t)] || 0;
    let tw = null;
    if (DY) {                                                             // (its lanes: round a tail, up a bun's ball; a strand out of a bun its own)
      const val = Float32Array.from(tg.u, (v, j) => (tg.lane ? laneNoise(tg.lane[j], dsd + 23.7 + 9.1 * ctx.ties.indexOf(t)) : hash(v + j * 0.0137 + dsd, 67))), of = Array.from(val).sort((p, q) => p - q), cutT = share >= 1 ? 2 : share <= 0 ? -1 : of[Math.min(tg.n - 1, Math.floor(share * tg.n))];
      tw = Float32Array.from(val, v => (v < cutT ? 1 : 0));
    }
    const tgeo = build({ n: tg.n, pts: tg.pts, len: tg.len, u: tg.u, width: tg.width, taper: tg.taper || (tg.bun ? 0.1 : 0.45), wispy: tg.wispy || (tg.bun ? 0.2 : 0.7), S, C, out: tg.outv, most: 16, tol: 0.0008,
      dye: DY ? { ...DY, w: tw, roots: 0, abs: 0, ...(tg.bun ? { ends: 0, tips: 0 } : {}) } : null });
    finish(tgeo, S, { draft: !!o.draft });
    // how far along the tail each point is (0 at the tie .. 1 at the tip): what its bones take it by
    const along = new Float32Array(tgeo.position.length / 3); for (let v = 0; v < along.length; v++) along[v] = tgeo.uv[v * 2 + 1] / 1.0 * (tg.len[tgeo.card[v]] / tg.length);
    tails.push({ name: tg.name, geo: tgeo, along, joints: tg.joints, soft: tg.soft });
    const bd = band(t, s); if (bd) bands.push(bd);
  }
  lap("ties");
  const stats = { pores: n, cards: geo.cards, triangles: geo.triangles, vertices: geo.position.length / 3, open: fin.open };
  if (!o.draft) {                                                        // how much of the scalp the cards cover (where cards grow: short hair is the shells')
    const at = []; for (let i = 0; i < n; i++) if (tr.len[i] > 0.03) at.push(i);
    const rp = new Float32Array(at.length * 3), rn = new Float32Array(at.length * 3); at.forEach((i, k) => { for (let a = 0; a < 3; a++) { rp[k * 3 + a] = pos[i * 3 + a]; rn[k * 3 + a] = nrm[i * 3 + a]; } });
    const cov = coverage(geo, rp, rn); stats.covered = +cov.one.toFixed(4); stats.twoLayers = +cov.two.toFixed(4); lap("count");
  }
  // ---- the scalp under it: its patch, painted with a dot a pore
  const pt = patchOf(prep, body, pores);
  // (a pore's dot is fainter at the hairline's soft edge, where the hairs are short and fine, and gone under a cut's line: a bob's or a bowl cut's line leaves the nape below it bare, not shaded)
  const Aall = alive(pores, s.hairline, pores.n), gp = [], gw = [], tied = ctx.ties.length > 0;
  for (let i = 0; i < pores.n; i++) if (Aall.on[i]) {
    const x = all.pos[i * 3], y = all.pos[i * 3 + 1], z = all.pos[i * 3 + 2];
    let w = soft > 0 ? lerp(Math.max(0.1, 1 - soft * 1.7), 1, smooth(0.15, 0.9, Aall.edge[i])) : 1;   // (faint at the very edge: under hair pulled up off a nape or back off a temple it's all there is to see, and a full shade there reads as a shadow on the skin)
    if (byLine && !tied && un.height == null && cut.tiers !== "over") w *= smooth(-0.002, 0.008, y - cutLine(cut, Math.atan2(x - C[0], z - C[2]) / D));
    if (w > 0.01) { gp.push(x, y, z); gw.push(w); }
  }
  const fine = Math.sqrt((pores.header.area_cm2 * 1e-4) / (0.866 * pores.n));
  // (painted again only when what it's made of changed: the hairline, the parting, the cut's line, the colour; a slider that only shapes the hair keeps the picture)
  let scalp = null;
  if (s.scalp && s.scalp.shade > 0) {
    const size = o.scalpSize || 512, colour = o.rootColour || [10, 9, 9], key = JSON.stringify([s.hairline, s.parting, s.scalp, byLine && !tied && un.height == null ? [cut.line, cut.tilt, cut.round, cut.tiers, cut.front, cut.frontTo, cut.frontSoft] : 0, colour, size]);
    const fresh = !prep.paint || prep.paint.key !== key;
    if (fresh) prep.paint = { key, rgba: paint(body, { n: gp.length / 3, pos: gp, weight: gw }, s, fine, colour, size) };
    scalp = { position: pt.position, normal: pt.normal, uv: pt.uv, index: pt.index, size, rgba: prep.paint.rgba, fresh };
  }
  lap("scalp");
  // ---- short hair: shells over the scalp's patch. How long the hair is at each of its points (nothing where a card
  // grows instead, but an undercoat under a short cut's cards), how much hair is left there (the growing share of all
  // the pores round it: the hairline's edge and a thinning patch thin the shells too), the way it's combed
  let shell = null;
  {
    const m = pt.vert.length, vpos = new Float32Array(m * 3), vaz = new Float32Array(m), vby = new Float32Array(m);
    for (let j = 0; j < m; j++) { const v = pt.vert[j] * 3; vpos[j * 3] = body.L[v]; vpos[j * 3 + 1] = body.L[v + 1]; vpos[j * 3 + 2] = body.L[v + 2]; vaz[j] = Math.atan2(body.L[v] - C[0], body.L[v + 2] - C[2]) / D; vby[j] = body.L[v + 1]; }
    const VP = parts({ n: m, pos: vpos, az: vaz, by: vby, C }), height = new Float32Array(m), stub = clamp((s.scalp && s.scalp.stubble) || 0, 0, 1);
    let any = stub > 0;
    for (let j = 0; j < m; j++) { const [part, clipped] = lengthAt(VP.top[j], VP.sides[j], VP.back[j], VP.nape[j], vby[j]); if ((!byLine || clipped) && part <= SHELL_MAX) { height[j] = part; any = true; } else height[j] = -1; }
    if (any) {
      const under = Math.min(0.012, Math.max(0.004, Math.min(Lp.sides, Lp.back) * 0.8));
      for (let j = 0; j < m; j++) { if (height[j] < 0) height[j] = byLine ? 0 : under; height[j] = Math.max(height[j], stub * 0.004); }
      const sumOn = new Float32Array(body.L.length / 3), sumAll = new Float32Array(body.L.length / 3), T = body.T;
      for (let i = 0; i < pores.n; i++) {
        const t = pores.tri[i] * 3, w = [pores.bary[i * 2], pores.bary[i * 2 + 1], 1 - pores.bary[i * 2] - pores.bary[i * 2 + 1]];
        for (let k = 0; k < 3; k++) { sumAll[T[t + k]] += w[k]; if (Aall.on[i]) sumOn[T[t + k]] += w[k]; }
      }
      const left = new Float32Array(m), dir = new Float32Array(m * 3), d3 = [0, 0, 0];
      for (let j = 0; j < m; j++) {
        const v = pt.vert[j]; left[j] = sumAll[v] > 0 ? sumOn[v] / sumAll[v] : 0;
        if (field(vpos[j * 3], vpos[j * 3 + 1], vpos[j * 3 + 2], d3)) { dir[j * 3] = d3[0]; dir[j * 3 + 1] = d3[1]; dir[j * 3 + 2] = d3[2]; }
      }
      shell = shells({ patch: pt, height, left, dir, lean: clamp(Math.cos(((s.shape && s.shape.lift) ?? 22) * D) * 0.55, 0.15, 0.6) });
      if (shell) stats.shellTriangles = shell.triangles;
    }
  }
  lap("shells");
  stats.ms = ms; stats.total = +(now() - t0).toFixed(1);
  if (tails.length) stats.tailTriangles = tails.reduce((a, t) => a + t.geo.triangles, 0);
  // (guides.lock: for a strand gathered into a tendril, the strand it's gathered to; itself for that one; else -1)
  const lockOf = new Int32Array(n).fill(-1); if (anyLock) { for (let i = 0; i < n; i++) if (clumpAmt[i] > 0) { lockOf[i] = clump.of[i]; lockOf[clump.of[i]] = clump.of[i]; } }
  return { hair: geo, scalp, shell, tails, bands, stats, guides: { n, pts: tr.pts, len: tr.len, group: cmb.group, pos, nrm, lock: lockOf } };
}
