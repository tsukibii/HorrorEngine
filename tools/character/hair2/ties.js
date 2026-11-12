// Ties: ponytails, twin tails, half-up, buns (the hair editor v2.0, docs/HAIR_V2.md §3.8). A tie is a point just off
// the head; the pores it takes have their hair run along the head to it and end there (strands.js); from it hangs a
// tail: a spine traced from the tie (its own way at first, then falling, resting on the shoulder or the chest), with
// cards round it, wider after the tie, tapering to the tip; or a bun: the tail wound round a ball at the tie. The tie
// itself is an object (an elastic, a scrunchie) in a colour. A tail carries the joints of a chain down its spine: the
// Character Studio's export makes them bones (`jiggle_<name>_0` ...), and Godot's HSJiggle swings it.
// Plain arrays; the head's local space.
//
//   tiesOf(S, C, s)  -> [{ name, side, at, out, dir, radius, tight, takes(i, p, az, by, parts) }]
//   tail(tie, ctx)   -> { n, pts, len, u, width, outv, joints, name } hairs for cards.js build (outv: each kept point's way out of the tail)
//   band(tie, s)     -> { position, normal, index, colour } the tie's own mesh
import { dist, grad } from "./sdf.js";
import { K, TS, GAP, hash, DRILL_TOP } from "./strands.js";
import { EAR } from "./pores.js";

const D = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function skinAlong(S, C, d) {
  let r = 0.2;
  for (let i = 0; i < 60; i++) { const q = dist(S, C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r); if (q < 0.0004) break; r -= Math.max(0.0004, q * 0.9); }
  return [C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r];
}

export const TIES = { none: "None", pony: "Ponytail", twin: "Twin tails", half: "Half-up", twin_half: "Two side up", bun: "Bun", buns: "Twin buns", knot: "Top knot" };

export function tiesOf(S, C, s) {
  const t = s.ties || {}, kind = t.kind || "none"; if (kind === "none") return [];
  const h = clamp(t.height ?? 0.5, 0, 1), tl = t.tail || {}, thick = clamp(tl.thick ?? 0.013, 0.004, 0.03), loose = clamp(t.loose ?? 0, 0, 1), g = [0, 0, 0], out = [], drop = clamp(t.drop ?? 0, 0, 0.08);
  const twin = kind === "twin" || kind === "buns" || kind === "twin_half", front = (tl.fall || "back") === "front";   // (two side up: two small tails of the top's hair, the rest loose)
  const make = (name, side, d) => {
    const p = skinAlong(S, C, unit(d)); grad(S, p[0], p[1], p[2], g);
    const n = g.slice(), at = [p[0] + n[0] * (0.01 + thick), p[1] + n[1] * (0.01 + thick), p[2] + n[2] * (0.01 + thick)];
    if (drop > 0) {                                                       // Drop: the tie slid down the hanging hair, below where Height can put it on the head (a low tail's elastic a few centimetres under the ear); kept off the neck sideways, at its height
      // (it hangs on the hair there, against the neck: brought in to it, the band just clear of the skin, where a tie on the head stands a centimetre off it)
      const off = thick + 0.003 + 0.007 * (1 - smooth(0, 0.02, drop));
      at[1] -= drop;
      for (let it = 0; it < 8; it++) { const d = dist(S, at[0], at[1], at[2]); if (Math.abs(d - off) < 0.0004 || !grad(S, at[0], at[1], at[2], g)) break; const hl = Math.hypot(g[0], g[2]) || 1; at[0] += g[0] / hl * (off - d); at[2] += g[2] / hl * (off - d); }
    }
    // the way the tail leaves the tie: out of the head, and down; a low tail that falls in front goes forward over the shoulder
    // (Out: twin tails lean away from the neck: they leave their ties turned out and hang a little out of plumb all the way down, as tails that rest on the shoulders and the chest do)
    const outA = twin ? clamp(tl.out ?? 0, -1, 1) : 0, dir = unit(front && twin ? [side * (0.12 + 0.6 * Math.tan(outA * 36 * D)), -0.5 - 0.1 * Math.abs(outA), 0.85 * (1 - 0.4 * Math.abs(outA))] : [n[0] * 0.75 + side * 0.6 * Math.tan(outA * 36 * D), n[1] * 0.75 - 0.55 - 0.5 * (1 - h), n[2] * 0.75]);
    const fall = unit([side * Math.tan(outA * 32 * D), -1, 0]);
    // a low tie by an ear that's out (tucked): its hair goes round the ear to it, over the ear's top and down behind
    // (strands.js). round: how much so (1 under or just behind the ear, 0 from the nape's side on); under: it sits
    // within the ear's own span round the head; guard: the ear is kept clear down to here
    const azT = Math.abs(Math.atan2(at[0] - C[0], at[2] - C[2])) / D, low = at[1] < EAR.y;
    const round = low ? 1 - smooth(EAR.az + 30, EAR.az + 55, azT) : 0, under = low && Math.abs(azT - EAR.az) < EAR.da * 1.08;
    out.push({ name, side, at, out: n, dir, fall, radius: thick, tight: clamp(t.tight ?? 0.6, 0, 1), kind, round, under, guard: Math.max(EAR.y - EAR.dy * 1.08, Math.min(EAR.y - 0.012, at[1] + 0.02)),
      takes: (i, pp, az, by, P) => {
        if (Math.abs(az) < 118 * loose) return false;                    // the front left loose, as far round as Loose says
        if ((kind === "half" || kind === "twin_half" || t.part === "top") && P.top[i] < 0.45 && by < 0.06) return false;   // half-up, two side up, or any tie of The top's hair only: the rest hangs loose
        if (twin && (pp[0] >= 0 ? 1 : -1) !== side) return false;
        return true;
      } });
  };
  if (twin) { const az = lerp(162, 98, clamp(t.side ?? 0.7, 0, 1)) * D, el = lerp(-38, 42, h) * D; for (const sd of [1, -1]) make(sd > 0 ? "tail_l" : "tail_r", sd, [sd * Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]); }
  else {                                                                // one tail: up the back of the head by Height, round to one side by To one side (a side ponytail)
    const ph = (kind === "knot" ? lerp(-45, -8, h) : kind === "half" ? lerp(-100, -42, h) : lerp(-122, -30, h)) * D, b = clamp(t.offset || 0, -1, 1) * 85 * D, hz = Math.sin(ph);
    make("tail", 0, [-hz * Math.sin(b), Math.cos(ph), hz * Math.cos(b)]);
  }
  return out;
}

// the tail's spine from the tie: its own way at first, then falling; kept a tail's thickness off the body
function spine(tie, S, L, stiff) {
  const steps = clamp(Math.ceil(L / 0.008), 6, 64), dl = L / steps, P = [tie.at.slice()], g = [0, 0, 0], fl = tie.fall || [0, -1, 0];
  let [px, py, pz] = tie.at, [tx, ty, tz] = tie.dir;
  for (let k = 1; k <= steps; k++) {
    const s = k * dl, w = 1 - smooth(stiff * 0.3, stiff, s), al = 1 - Math.exp(-dl / 0.02);
    let dx = tie.dir[0] * w + fl[0] * (1 - w), dy = tie.dir[1] * w + fl[1] * (1 - w), dz = tie.dir[2] * w + fl[2] * (1 - w); const dn = Math.hypot(dx, dy, dz) || 1;
    tx += (dx / dn - tx) * al; ty += (dy / dn - ty) * al; tz += (dz / dn - tz) * al; const tn = Math.hypot(tx, ty, tz) || 1; tx /= tn; ty /= tn; tz /= tn;
    let qx = px + tx * dl, qy = py + ty * dl, qz = pz + tz * dl;
    const need = tie.radius * 0.8 + GAP;
    for (let pass = 0; pass < 2; pass++) { const d = dist(S, qx, qy, qz); if (d >= need || !grad(S, qx, qy, qz, g)) break; qx += g[0] * (need - d); qy += g[1] * (need - d); qz += g[2] * (need - d); }
    tx = qx - px; ty = qy - py; tz = qz - pz; const l2 = Math.hypot(tx, ty, tz) || 1; tx /= l2; ty /= l2; tz /= l2;
    px = qx; py = qy; pz = qz; P.push([px, py, pz]);
  }
  return P;
}
const at = (P, f) => { const x = clamp(f, 0, 1) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(x)), u = x - i; return [0, 1, 2].map(k => P[i][k] + (P[i + 1][k] - P[i][k]) * u); };

// ctx: { S, C, s (settings), seed }
export function tail(tie, ctx) {
  const { S, s } = ctx, tl = (s.ties && s.ties.tail) || {}, tx = s.texture || {}, bun = tie.kind === "bun" || tie.kind === "buns" || tie.kind === "knot";
  const L = bun ? 0.001 : clamp(tl.length ?? 0.2, 0.03, 0.45), thick = tie.radius, spread = clamp(tl.spread ?? 0.5, 0, 1.5), taper = clamp(tl.taper ?? 0.6, 0, 1);
  if (bun) return bunOf(tie, ctx);
  // Strands: how many hairs the tail has (1: by its thickness); Fan: it springs out right under the tie, as a brush
  // does, where 0 leaves the tie as a rope and widens after; Flat: it lies against the body as a brush laid on it,
  // wide across and thin through (its section's frame is the body's own there: across it, and out of it)
  const fan = clamp(tl.fan ?? 0, 0, 1), flat = clamp(tl.flat ?? 0, 0, 1), bloom = clamp(tl.bloom ?? 0.3, 0.1, 0.8);
  const SP = spine(tie, S, L, 0.02 + 0.06 * clamp(tl.stiff ?? 0.4, 0, 1)), m = clamp(Math.round((14 + thick / 0.013 * 20) * clamp(tl.strands ?? 1, 0.3, 4)), 8, 140);
  const pts = new Float32Array(m * K * 3), len = new Float32Array(m), u = new Float32Array(m), width = new Float32Array(m), outv = new Float32Array(m * K * 3);
  const wave = Math.max(0, tx.wave || 0), wl = Math.max(0.02, tx.waveLength || 0.09), curl = clamp(tx.curl || 0, 0, 1), g = [0, 0, 0];
  // a frame carried down the spine (a across, b the other way), so the cards keep their places round it
  const fr = []; let a = null;
  for (let k = 0; k < K; k++) {
    const p0 = at(SP, Math.max(0, TS[k] - 0.02)), p1 = at(SP, Math.min(1, TS[k] + 0.02)), t = unit([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
    if (!a) a = unit(Math.abs(t[1]) < 0.9 ? [t[2], 0, -t[0]] : [1, 0, 0]);
    const d = a[0] * t[0] + a[1] * t[1] + a[2] * t[2]; a = unit([a[0] - t[0] * d, a[1] - t[1] * d, a[2] - t[2] * d]);
    let av = a.slice(), bv = [t[1] * a[2] - t[2] * a[1], t[2] * a[0] - t[0] * a[2], t[0] * a[1] - t[1] * a[0]];
    if (flat > 0) {                                                       // (out of the body here, square to the tail; across it the other way)
      // (where the tail rests on the body, out of the body; where it hangs in the air, the way it faces: forward for tails that fall over the shoulders, out of the head for the others. Not the body's own way there: beside the neck that is sideways, and the fan would be edge-on from the front)
      const c = at(SP, TS[k]), face = (tl.fall || "back") === "front" && tie.side ? [0, 0.15, 1] : [tie.out[0], 0, tie.out[2]], dB = dist(S, c[0], c[1], c[2]), on = grad(S, c[0], c[1], c[2], g) ? 1 - smooth(0.008, 0.02, dB) : 0;
      let nb = unit([g[0] * on + face[0] * (1 - on), g[1] * on + face[1] * (1 - on), g[2] * on + face[2] * (1 - on)]);
      const dd = nb[0] * t[0] + nb[1] * t[1] + nb[2] * t[2]; nb = [nb[0] - t[0] * dd, nb[1] - t[1] * dd, nb[2] - t[2] * dd];
      if (Math.hypot(...nb) > 0.2) { bv = unit(nb); av = [bv[1] * t[2] - bv[2] * t[1], bv[2] * t[0] - bv[0] * t[2], bv[0] * t[1] - bv[1] * t[0]]; }
    }
    fr.push([t, av, bv]);
  }
  for (let j = 0; j < m; j++) {
    const r1 = hash((j + 1) * 0.0731 + (ctx.seed || 1) * 0.013, 71), r2 = hash((j + 1) * 0.0731, 72), r3 = hash((j + 1) * 0.0731, 73);
    const ring = Math.sqrt((j + 0.5) / m), th0 = j * 2.39996, own = L * (1 - taper * 0.45 * r1 * (0.4 + 0.6 * ring));   // the outer hairs the shortest: the tip thins
    u[j] = r2; len[j] = own; width[j] = clamp(thick * 2 * Math.PI * Math.max(0.35, ring) / Math.sqrt(m) * 1.9, 0.004, 0.02);
    for (let k = 0; k < K; k++) {
      const f = TS[k] * own / L, c = at(SP, f), [, av, bv] = fr[Math.min(K - 1, Math.round(f * (K - 1)))], sAt = f * L;
      const open = lerp(smooth(0, bloom, f), Math.pow(Math.min(1, f / bloom), 0.55), fan);
      const rad = thick * ring * lerp(0.75, 1 + 1.3 * spread, open) * (1 - taper * 0.75 * smooth(0.55, 1, f));
      const th = th0 + curl * sAt / 0.05 * 2 + (wave > 0 ? 0.6 * Math.sin(2 * Math.PI * sAt / wl + r3 * 6.28) : 0), cs = Math.cos(th), sn = Math.sin(th) * (1 - 0.72 * flat * open), wv = wave > 0 ? wave * 0.8 * smooth(0.02, 0.08, sAt) * Math.sin(2 * Math.PI * sAt / wl) : 0;
      const ox = av[0] * cs + bv[0] * sn, oy = av[1] * cs + bv[1] * sn, oz = av[2] * cs + bv[2] * sn, o = (j * K + k) * 3;
      pts[o] = c[0] + ox * rad + av[0] * wv; pts[o + 1] = c[1] + oy * rad + av[1] * wv; pts[o + 2] = c[2] + oz * rad + av[2] * wv;
      if (flat > 0) { const fl2 = flat * open, nx = bv[0] * (sn >= 0 ? 1 : -1), ny = bv[1] * (sn >= 0 ? 1 : -1), nz = bv[2] * (sn >= 0 ? 1 : -1), ol = Math.hypot(ox * (1 - fl2) + nx * fl2, oy * (1 - fl2) + ny * fl2, oz * (1 - fl2) + nz * fl2) || 1; outv[o] = (ox * (1 - fl2) + nx * fl2) / ol; outv[o + 1] = (oy * (1 - fl2) + ny * fl2) / ol; outv[o + 2] = (oz * (1 - fl2) + nz * fl2) / ol; }   // (a flat tail's cards face out of the body, or into it: not sideways)
      else { outv[o] = ox; outv[o + 1] = oy; outv[o + 2] = oz; }
    }
  }
  for (let j = 0; j < m; j++) for (let k = 1; k < K; k++) {               // kept off the body: the tail lies on a shoulder, it doesn't sink into it
    const o = (j * K + k) * 3, d = dist(S, pts[o], pts[o + 1], pts[o + 2]);
    if (d < GAP && grad(S, pts[o], pts[o + 1], pts[o + 2], g)) { pts[o] += g[0] * (GAP - d); pts[o + 1] += g[1] * (GAP - d); pts[o + 2] += g[2] * (GAP - d); }
  }
  const joints = [0, 0.25, 0.5, 0.75, 1].map(f => at(SP, f));
  const lane = Float32Array.from({ length: m }, (_, j) => ((j * 2.39996) % (2 * Math.PI)) / D);   // (where each hair is round the tail: a dyed streak's lane, engine.js)
  return { name: tie.name, n: m, pts, len, u, width, outv, joints, lane, length: L, soft: clamp(tl.sway ?? 0.5, 0, 1) };
}

// Strands standing out of a bun (ties.wild): thin locks that leave it every way but into the head, arcing and drooping
// (soft) or standing straight to a point (spiky), and with them a halo of short fine hairs: what makes a bun look done
// by hand. They're the bun's own hairs (its mesh). c, R: the bun's ball
function wildOf(tie, ctx, c, R) {
  const t = ctx.s.ties || {}, amt = clamp(t.wild || 0, 0, 1); if (!(amt > 0)) return null;
  const Lw = clamp(t.wildLength ?? 0.07, 0.02, 0.16), stiff = clamp(t.wildStiff ?? 0.4, 0, 1), big = Math.round(3 + amt * 11), fine = Math.round(amt * 26), m = big + fine, S = ctx.S, g = [0, 0, 0];
  const n = tie.out, a = unit(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]), b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]], sd = (ctx.seed || 1) * 0.071 + (tie.side || 0) * 0.31;
  const pts = new Float32Array(m * K * 3), len = new Float32Array(m), u = new Float32Array(m), width = new Float32Array(m), outv = new Float32Array(m * K * 3), taper = new Float32Array(m), wispy = new Float32Array(m);
  for (let j = 0; j < m; j++) {
    const thin = j >= big, r1 = hash((j + 1) * 0.0613 + sd, 85), r2 = hash((j + 1) * 0.0613 + sd, 86), r3 = hash((j + 1) * 0.0613 + sd, 87), r4 = hash((j + 1) * 0.0613 + sd, 88), r5 = hash((j + 1) * 0.0613 + sd, 89);
    const el = thin ? -0.25 + 1.6 * r1 : 0.2 + 1.25 * r1, th = j * 2.39996 + r2 * 0.8, ce = Math.cos(el), se = Math.sin(el);   // (how far out of the head's surface it points: a strand never back into the head)
    const e = unit([(a[0] * Math.cos(th) + b[0] * Math.sin(th)) * ce + n[0] * se, (a[1] * Math.cos(th) + b[1] * Math.sin(th)) * ce + n[1] * se, (a[2] * Math.cos(th) + b[2] * Math.sin(th)) * ce + n[2] * se]);
    const L = thin ? 0.012 + 0.03 * r3 : Lw * (0.45 + 0.55 * r3), droop = (1 - stiff) * (thin ? 0.5 : 0.9), q = unit(Math.abs(e[1]) < 0.9 ? [e[2], 0, -e[0]] : [1, 0, 0]), q2 = [e[1] * q[2] - e[2] * q[1], e[2] * q[0] - e[0] * q[2], e[0] * q[1] - e[1] * q[0]];
    const ph = r4 * 6.28, wob = (1 - stiff) * L * (thin ? 0.2 : 0.1), turns = 0.8 + 1.1 * r5, fa = r2 * 6.28, o0 = [q[0] * Math.cos(fa) + q2[0] * Math.sin(fa), q[1] * Math.cos(fa) + q2[1] * Math.sin(fa), q[2] * Math.cos(fa) + q2[2] * Math.sin(fa)];
    let total = 0, prev = null;
    for (let k = 0; k < K; k++) {
      const f = TS[k], sA = f * L, w = wob * f * Math.sin(Math.PI * turns * f + ph), o = (j * K + k) * 3;
      let x = c[0] + e[0] * (R * 0.85 + sA) + q[0] * w, y = c[1] + e[1] * (R * 0.85 + sA) + q[1] * w - droop * sA * sA / L, z = c[2] + e[2] * (R * 0.85 + sA) + q[2] * w;
      const d = dist(S, x, y, z); if (d < GAP * 2 && grad(S, x, y, z, g)) { x += g[0] * (GAP * 2 - d); y += g[1] * (GAP * 2 - d); z += g[2] * (GAP * 2 - d); }
      pts[o] = x; pts[o + 1] = y; pts[o + 2] = z; outv[o] = o0[0]; outv[o + 1] = o0[1]; outv[o + 2] = o0[2];
      if (prev) total += Math.hypot(x - prev[0], y - prev[1], z - prev[2]); prev = [x, y, z];
    }
    len[j] = total; u[j] = r5; width[j] = thin ? 0.0016 + 0.0014 * r4 : lerp(0.0036, 0.012, stiff) * (0.7 + 0.6 * r5); taper[j] = thin ? 0.8 : lerp(0.78, 0.97, stiff); wispy[j] = thin ? 1 : lerp(0.95, 0.5, stiff);
  }
  return { n: m, pts, len, u, width, outv, taper, wispy };
}

// a bun: hairs wound round a ball at the tie
function bunOf(tie, ctx) {
  const tl = (ctx.s.ties && ctx.s.ties.tail) || {}, R = clamp((tl.bun ?? 0.035), 0.015, 0.07), c = [tie.at[0] + tie.out[0] * R * 0.75, tie.at[1] + tie.out[1] * R * 0.75, tie.at[2] + tie.out[2] * R * 0.75];
  const m = clamp(Math.round(40 + R / 0.035 * 30), 30, 110), pts = new Float32Array(m * K * 3), len = new Float32Array(m), u = new Float32Array(m), width = new Float32Array(m), outv = new Float32Array(m * K * 3), lane = new Float32Array(m);
  const n = tie.out, a = unit(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]), b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  for (let j = 0; j < m; j++) {
    const r1 = hash((j + 1) * 0.0917, 81), r2 = hash((j + 1) * 0.0917, 82), lat0 = (r1 - 0.5) * 2.6, turn = 1.2 + 1.3 * r2, ph = j * 2.39996, rr = R * (0.94 + 0.1 * r2);
    const way = (hash((j + 1) * 0.0917, 83) < 0.84 ? 1 : -1) * (tie.side < 0 ? -1 : 1);   // (a bun is a coil: most of its hair wound the one way, a few across it; a pair of buns mirrored)
    u[j] = r2; width[j] = 0.012; lane[j] = lat0 * 46; let L = 0, prev = null;   // (a dyed streak's lane: a band round the ball)
    for (let k = 0; k < K; k++) {
      const f = TS[k], lon = ph + turn * f * 2 * Math.PI * way * 0.5, lat = lat0 + (0.5 - f) * 0.5, cl = Math.cos(lat), ox = (a[0] * Math.cos(lon) + b[0] * Math.sin(lon)) * cl + n[0] * Math.sin(lat), oy = (a[1] * Math.cos(lon) + b[1] * Math.sin(lon)) * cl + n[1] * Math.sin(lat), oz = (a[2] * Math.cos(lon) + b[2] * Math.sin(lon)) * cl + n[2] * Math.sin(lat), o = (j * K + k) * 3;
      pts[o] = c[0] + ox * rr; pts[o + 1] = c[1] + oy * rr; pts[o + 2] = c[2] + oz * rr; outv[o] = ox; outv[o + 1] = oy; outv[o + 2] = oz;
      if (prev) L += Math.hypot(pts[o] - prev[0], pts[o + 1] - prev[1], pts[o + 2] - prev[2]); prev = [pts[o], pts[o + 1], pts[o + 2]];
    }
    len[j] = L;
  }
  const wd = wildOf(tie, ctx, c, R);
  if (wd) {
    const cat = (x, y) => { const o = new Float32Array(x.length + y.length); o.set(x); o.set(y, x.length); return o; };
    return { name: tie.name, n: m + wd.n, pts: cat(pts, wd.pts), len: cat(len, wd.len), u: cat(u, wd.u), width: cat(width, wd.width), outv: cat(outv, wd.outv), taper: cat(new Float32Array(m).fill(0.1), wd.taper), wispy: cat(new Float32Array(m).fill(0.2), wd.wispy),
      lane: cat(lane, Float32Array.from({ length: wd.n }, (_, j) => 1000 + j * 137.5)), joints: null, length: R * 2, soft: 0, bun: { c, R }, wild: wd.n };
  }
  return { name: tie.name, n: m, pts, len, u, width, outv, lane, joints: null, length: R * 2, soft: 0, bun: { c, R } };
}

// the tie itself: a ring round the tail where it leaves the head (an elastic thin, a scrunchie fat and gathered)
export function band(tie, s) {
  const k = (s.ties && s.ties.tie) || {}, kind = k.kind || "elastic"; if (kind === "none") return null;
  const R = tie.radius * (kind === "scrunchie" ? 1.25 : 1.02), r = kind === "scrunchie" ? 0.0065 : 0.0024, A = 28, B = kind === "scrunchie" ? 10 : 8;
  const t = tie.dir, a = unit(Math.abs(t[1]) < 0.9 ? [t[2], 0, -t[0]] : [1, 0, 0]), b = [t[1] * a[2] - t[2] * a[1], t[2] * a[0] - t[0] * a[2], t[0] * a[1] - t[1] * a[0]];
  const c = [tie.at[0] + t[0] * 0.006, tie.at[1] + t[1] * 0.006, tie.at[2] + t[2] * 0.006], P = [], N = [], I = [];
  for (let i = 0; i < A; i++) {
    const th = i / A * 2 * Math.PI, ex = a[0] * Math.cos(th) + b[0] * Math.sin(th), ey = a[1] * Math.cos(th) + b[1] * Math.sin(th), ez = a[2] * Math.cos(th) + b[2] * Math.sin(th), rr = r * (kind === "scrunchie" ? 1 + 0.28 * Math.sin(th * 9) : 1);
    for (let j = 0; j < B; j++) {
      const ph = j / B * 2 * Math.PI, nx = ex * Math.cos(ph) + t[0] * Math.sin(ph), ny = ey * Math.cos(ph) + t[1] * Math.sin(ph), nz = ez * Math.cos(ph) + t[2] * Math.sin(ph);
      P.push(c[0] + ex * R + nx * rr, c[1] + ey * R + ny * rr, c[2] + ez * R + nz * rr); N.push(nx, ny, nz);
      const i1 = (i + 1) % A, j1 = (j + 1) % B; I.push(i * B + j, i1 * B + j, i * B + j1, i1 * B + j, i1 * B + j1, i * B + j1);
    }
  }
  return { name: tie.name.replace("tail", "tie"), position: new Float32Array(P), normal: new Float32Array(N), index: new Uint32Array(I), colour: k.colour || "#a01c24" };
}

// Ringlets ("drills"): on each side the face-framing strands are wound into one ringlet that hangs from the ears' line
// to their own line: a ribbon round a middle line that's kept off the body, and a thinner one inside it. A ribbon is
// more turns than a card has points for, so it's cards end to end, each three quarters of a turn, the atlas running on
// from one to the next (cards.js v0, v1).
//   tops: [{ side, x, z }] where each side's strands end (engine.js)   -> hairs for cards.js build, or null
export function drills(S, C, s, tops) {
  const fr = s.fringe || {}, amt = clamp(fr.frameCurl || 0, 0, 1), yEnd = fr.frameLine ?? -0.066; if (!(amt > 0) || !tops.length || yEnd > DRILL_TOP - 0.05) return null;
  const R0 = 0.008 + 0.008 * amt, pitch = 0.024 + 0.012 * amt, Ld = DRILL_TOP - yEnd, turns = Ld / pitch, per = 0.75, segs = Math.ceil(turns / per), g = [0, 0, 0];
  const n = tops.length * 2 * segs, pts = new Float32Array(n * K * 3), len = new Float32Array(n), u = new Float32Array(n), width = new Float32Array(n), taper = new Float32Array(n), wisp = new Float32Array(n), v0 = new Float32Array(n), v1 = new Float32Array(n), outv = new Float32Array(n * K * 3);
  let h = 0;
  for (const top of tops) {
    const N = 80, mid = []; let x = top.x, y = DRILL_TOP, z = top.z;      // the middle line, straight down, pushed off the cheek, the neck, the shoulder and the chest
    for (let q = 0; q <= N; q++) { const d = dist(S, x, y, z); if (d < R0 + 0.008 && grad(S, x, y, z, g)) { const w = R0 + 0.008 - d; x += g[0] * w; z += g[2] * w; } mid.push([x, y, z]); y -= Ld / N; }
    const at = f => { const q = clamp(f, 0, 1) * N, a = Math.min(N - 1, Math.floor(q)), k = q - a; return [0, 1, 2].map(c => mid[a][c] + (mid[a + 1][c] - mid[a][c]) * k); };
    for (let rib = 0; rib < 2; rib++) for (let sg = 0; sg < segs; sg++) {
      const f0 = sg / segs, f1 = (sg + 1) / segs, th0 = rib * Math.PI + top.side * 0.6; let L = 0, prev = null;
      for (let k = 0; k < K; k++) {
        const f = f0 + (f1 - f0) * TS[k], c = at(f), th = top.side * (th0 + 2 * Math.PI * turns * f), r = R0 * (rib ? 0.55 : 1) * (1 - 0.5 * f * f) * smooth(0, 0.06, f + 0.01), o = (h * K + k) * 3;
        pts[o] = c[0] + r * Math.cos(th); pts[o + 1] = c[1]; pts[o + 2] = c[2] + r * Math.sin(th); outv[o] = Math.cos(th); outv[o + 1] = 0; outv[o + 2] = Math.sin(th);
        if (prev) L += Math.hypot(pts[o] - prev[0], pts[o + 1] - prev[1], pts[o + 2] - prev[2]); prev = [pts[o], pts[o + 1], pts[o + 2]];
      }
      len[h] = L; u[h] = hash(top.side * 0.31 + rib * 0.17 + 0.4, 91); width[h] = pitch * (rib ? 0.5 : 0.72); taper[h] = sg === segs - 1 ? 0.75 : 0; wisp[h] = sg === segs - 1 ? 0.8 : 0;
      v0[h] = 0.08 + 0.5 * f0; v1[h] = 0.08 + 0.5 * f1 + (sg === segs - 1 ? 0.3 : 0); h++;
    }
  }
  return { n, pts, len, u, width, taper, wisp, v0, v1, outv };
}

// An ahoge: one lock standing up out of the top of the head and curving over (two thin cards, a little apart)
export function ahoge(S, C, s) {
  const sh = s.shape || {}, amt = clamp(sh.ahoge || 0, 0, 1); if (!(amt > 0)) return null;
  const side = clamp(sh.ahogeSide ?? -0.5, -1, 1), root = skinAlong(S, C, unit([side * 0.22, 1, 0.3])), L = 0.035 + 0.06 * amt, n = 2, g = [0, 0, 0];
  grad(S, root[0], root[1], root[2], g);
  const pts = new Float32Array(n * K * 3), len = new Float32Array(n), u = new Float32Array(n), width = new Float32Array(n), outv = new Float32Array(n * K * 3), lean = Math.sign(side || -1);
  for (let j = 0; j < n; j++) {
    let prev = null, total = 0;
    for (let k = 0; k < K; k++) {
      const t = TS[k], up = L * (t - 0.42 * t * t) * (1 - 0.12 * j), over = L * 0.62 * t * t * (1 + 0.25 * j), o = (j * K + k) * 3;   // up, then over to its side and a little down
      pts[o] = root[0] + g[0] * up + lean * over; pts[o + 1] = root[1] + g[1] * up - 0.004 * j - L * 0.1 * t * t * t; pts[o + 2] = root[2] + g[2] * up + 0.004 * j;
      outv[o] = 0; outv[o + 1] = 0.25; outv[o + 2] = 1;                  // (its face to the front: seen from where you look at her)
      if (prev) total += Math.hypot(pts[o] - prev[0], pts[o + 1] - prev[1], pts[o + 2] - prev[2]); prev = [pts[o], pts[o + 1], pts[o + 2]];
    }
    len[j] = total; u[j] = 0.37 + 0.31 * j; width[j] = 0.015 - 0.005 * j;
  }
  return { n, pts, len, u, width, outv };
}
