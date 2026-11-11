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
import { K, TS, GAP, hash } from "./strands.js";

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

export const TIES = { none: "None", pony: "Ponytail", twin: "Twin tails", half: "Half-up", bun: "Bun", buns: "Twin buns", knot: "Top knot" };

export function tiesOf(S, C, s) {
  const t = s.ties || {}, kind = t.kind || "none"; if (kind === "none") return [];
  const h = clamp(t.height ?? 0.5, 0, 1), tl = t.tail || {}, thick = clamp(tl.thick ?? 0.013, 0.004, 0.03), loose = clamp(t.loose ?? 0, 0, 1), g = [0, 0, 0], out = [];
  const twin = kind === "twin" || kind === "buns", front = (tl.fall || "back") === "front";
  const make = (name, side, d) => {
    const p = skinAlong(S, C, unit(d)); grad(S, p[0], p[1], p[2], g);
    const n = g.slice(), at = [p[0] + n[0] * (0.01 + thick), p[1] + n[1] * (0.01 + thick), p[2] + n[2] * (0.01 + thick)];
    // the way the tail leaves the tie: out of the head, and down; a low tail that falls in front goes forward over the shoulder
    const dir = unit(front && twin ? [side * 0.12, -0.5, 0.85] : [n[0] * 0.75, n[1] * 0.75 - 0.55 - 0.5 * (1 - h), n[2] * 0.75]);
    out.push({ name, side, at, out: n, dir, radius: thick, tight: clamp(t.tight ?? 0.6, 0, 1), kind,
      takes: (i, pp, az, by, P) => {
        if (Math.abs(az) < 118 * loose) return false;                    // the front left loose, as far round as Loose says
        if (kind === "half" && P.top[i] < 0.45 && by < 0.06) return false;   // half-up: the top's hair only
        if (twin && (pp[0] >= 0 ? 1 : -1) !== side) return false;
        return true;
      } });
  };
  if (twin) { const az = lerp(162, 98, clamp(t.side ?? 0.7, 0, 1)) * D, el = lerp(-38, 42, h) * D; for (const sd of [1, -1]) make(sd > 0 ? "tail_l" : "tail_r", sd, [sd * Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]); }
  else { const ph = (kind === "knot" ? lerp(-45, -8, h) : kind === "half" ? lerp(-100, -42, h) : lerp(-122, -30, h)) * D; make("tail", 0, [0, Math.cos(ph), Math.sin(ph)]); }
  return out;
}

// the tail's spine from the tie: its own way at first, then falling; kept a tail's thickness off the body
function spine(tie, S, L, stiff) {
  const steps = clamp(Math.ceil(L / 0.008), 6, 64), dl = L / steps, P = [tie.at.slice()], g = [0, 0, 0];
  let [px, py, pz] = tie.at, [tx, ty, tz] = tie.dir;
  for (let k = 1; k <= steps; k++) {
    const s = k * dl, w = 1 - smooth(stiff * 0.3, stiff, s), al = 1 - Math.exp(-dl / 0.02);
    let dx = tie.dir[0] * w, dy = tie.dir[1] * w - (1 - w), dz = tie.dir[2] * w; const dn = Math.hypot(dx, dy, dz) || 1;
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
  const SP = spine(tie, S, L, 0.02 + 0.06 * clamp(tl.stiff ?? 0.4, 0, 1)), m = clamp(Math.round(14 + thick / 0.013 * 20), 12, 64);
  const pts = new Float32Array(m * K * 3), len = new Float32Array(m), u = new Float32Array(m), width = new Float32Array(m), outv = new Float32Array(m * K * 3);
  const wave = Math.max(0, tx.wave || 0), wl = Math.max(0.02, tx.waveLength || 0.09), curl = clamp(tx.curl || 0, 0, 1), g = [0, 0, 0];
  // a frame carried down the spine (a across, b the other way), so the cards keep their places round it
  const fr = []; let a = null;
  for (let k = 0; k < K; k++) {
    const p0 = at(SP, Math.max(0, TS[k] - 0.02)), p1 = at(SP, Math.min(1, TS[k] + 0.02)), t = unit([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
    if (!a) a = unit(Math.abs(t[1]) < 0.9 ? [t[2], 0, -t[0]] : [1, 0, 0]);
    const d = a[0] * t[0] + a[1] * t[1] + a[2] * t[2]; a = unit([a[0] - t[0] * d, a[1] - t[1] * d, a[2] - t[2] * d]);
    fr.push([t, a.slice(), [t[1] * a[2] - t[2] * a[1], t[2] * a[0] - t[0] * a[2], t[0] * a[1] - t[1] * a[0]]]);
  }
  for (let j = 0; j < m; j++) {
    const r1 = hash((j + 1) * 0.0731 + (ctx.seed || 1) * 0.013, 71), r2 = hash((j + 1) * 0.0731, 72), r3 = hash((j + 1) * 0.0731, 73);
    const ring = Math.sqrt((j + 0.5) / m), th0 = j * 2.39996, own = L * (1 - taper * 0.45 * r1 * (0.4 + 0.6 * ring));   // the outer hairs the shortest: the tip thins
    u[j] = r2; len[j] = own; width[j] = clamp(thick * 2 * Math.PI * Math.max(0.35, ring) / Math.sqrt(m) * 1.9, 0.004, 0.02);
    for (let k = 0; k < K; k++) {
      const f = TS[k] * own / L, c = at(SP, f), [, av, bv] = fr[Math.min(K - 1, Math.round(f * (K - 1)))], sAt = f * L;
      const rad = thick * ring * lerp(0.75, 1 + 1.3 * spread, smooth(0, 0.3, f)) * (1 - taper * 0.75 * smooth(0.55, 1, f));
      const th = th0 + curl * sAt / 0.05 * 2 + (wave > 0 ? 0.6 * Math.sin(2 * Math.PI * sAt / wl + r3 * 6.28) : 0), cs = Math.cos(th), sn = Math.sin(th), wv = wave > 0 ? wave * 0.8 * smooth(0.02, 0.08, sAt) * Math.sin(2 * Math.PI * sAt / wl) : 0;
      const ox = av[0] * cs + bv[0] * sn, oy = av[1] * cs + bv[1] * sn, oz = av[2] * cs + bv[2] * sn, o = (j * K + k) * 3;
      pts[o] = c[0] + ox * rad + av[0] * wv; pts[o + 1] = c[1] + oy * rad + av[1] * wv; pts[o + 2] = c[2] + oz * rad + av[2] * wv;
      outv[o] = ox; outv[o + 1] = oy; outv[o + 2] = oz;
    }
  }
  for (let j = 0; j < m; j++) for (let k = 1; k < K; k++) {               // kept off the body: the tail lies on a shoulder, it doesn't sink into it
    const o = (j * K + k) * 3, d = dist(S, pts[o], pts[o + 1], pts[o + 2]);
    if (d < GAP && grad(S, pts[o], pts[o + 1], pts[o + 2], g)) { pts[o] += g[0] * (GAP - d); pts[o + 1] += g[1] * (GAP - d); pts[o + 2] += g[2] * (GAP - d); }
  }
  const joints = [0, 0.25, 0.5, 0.75, 1].map(f => at(SP, f));
  return { name: tie.name, n: m, pts, len, u, width, outv, joints, length: L, soft: clamp(tl.sway ?? 0.5, 0, 1) };
}

// a bun: hairs wound round a ball at the tie
function bunOf(tie, ctx) {
  const tl = (ctx.s.ties && ctx.s.ties.tail) || {}, R = clamp((tl.bun ?? 0.035), 0.015, 0.07), c = [tie.at[0] + tie.out[0] * R * 0.75, tie.at[1] + tie.out[1] * R * 0.75, tie.at[2] + tie.out[2] * R * 0.75];
  const m = clamp(Math.round(40 + R / 0.035 * 30), 30, 110), pts = new Float32Array(m * K * 3), len = new Float32Array(m), u = new Float32Array(m), width = new Float32Array(m), outv = new Float32Array(m * K * 3);
  const n = tie.out, a = unit(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]), b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  for (let j = 0; j < m; j++) {
    const r1 = hash((j + 1) * 0.0917, 81), r2 = hash((j + 1) * 0.0917, 82), lat0 = (r1 - 0.5) * 2.6, turn = 1.2 + 1.3 * r2, ph = j * 2.39996, rr = R * (0.94 + 0.1 * r2);
    u[j] = r2; width[j] = 0.012; let L = 0, prev = null;
    for (let k = 0; k < K; k++) {
      const f = TS[k], lon = ph + turn * f * 2 * Math.PI * (j % 2 ? 1 : -1) * 0.5, lat = lat0 + (0.5 - f) * 0.5, cl = Math.cos(lat), ox = (a[0] * Math.cos(lon) + b[0] * Math.sin(lon)) * cl + n[0] * Math.sin(lat), oy = (a[1] * Math.cos(lon) + b[1] * Math.sin(lon)) * cl + n[1] * Math.sin(lat), oz = (a[2] * Math.cos(lon) + b[2] * Math.sin(lon)) * cl + n[2] * Math.sin(lat), o = (j * K + k) * 3;
      pts[o] = c[0] + ox * rr; pts[o + 1] = c[1] + oy * rr; pts[o + 2] = c[2] + oz * rr; outv[o] = ox; outv[o + 1] = oy; outv[o + 2] = oz;
      if (prev) L += Math.hypot(pts[o] - prev[0], pts[o + 1] - prev[1], pts[o + 2] - prev[2]); prev = [pts[o], pts[o + 1], pts[o + 2]];
    }
    len[j] = L;
  }
  return { name: tie.name, n: m, pts, len, u, width, outv, joints: null, length: R * 2, soft: 0, bun: { c, R } };
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
