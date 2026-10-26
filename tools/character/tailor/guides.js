// The guides: a garment's cut lines on the body itself, without cutting any cloth (the Character Studio's edit mode,
// DECISIONS 2026-10-27: editing a garment took minutes a change, the whole outfit cut and hung again each time). Every
// point of the skin gets the cut's value (>= 0 where the cloth will be), which of the design's lines is nearest there
// (the neckline, a front opening, a sleeve's end, the hem, the waist, the legs' end, a shoe's line, underwear's own
// shape) and how far off the skin the cloth will sit (its ease, scaled by the fit, over the garments under it), so a
// page draws the garment as a film on the body with its lines; a skirt as its rings (pieces.js skirtOutline); and the
// handles the Studio drags, found on the body alone (pieces.js handles). A few milliseconds a garment, so a slider or a
// handle moves a line at once; the tailor cuts and hangs the cloth when the edits are baked. Plain typed arrays: the
// page and node (tailor/check.mjs compares them with the cut).
import { fitted } from "../tailor.js";
import { cutter, handles, skirtOutline } from "./pieces.js";
import { height } from "./frame.js";
import { smooth } from "./mesh.js";

/** the lines a point can be nearest, by number (the film's `K`): 0 is none */
export const KINDS = ["", "neck", "open", "sleeve", "hem", "waist", "legs", "shoe", "under"];
const KIND = Object.fromEntries(KINDS.map((k, i) => [k, i]));

/**
 * One garment's guides on the body (F its frame, P its points, N their normals and T its triangles, metres, Y up, feet on the floor),
 * over the guides of the garments under it (`under`, this function's own results, innermost first):
 * {kind: "film" | "rings", V (the cut's value at every point of P, >= 0 on the cloth), K (which line is nearest, KINDS),
 * lift (how far off the skin the cloth sits, over what's worn under it), rings ({pts: xyz, rows, NA} for a skirt, every
 * 4 cm from its waist to its hem), handles (pieces.js handles), piece (the design's, fitted)}
 */
export function guide(F, P, N, T, design, under = []) {
  const p = fitted(design.piece), s = F.s, n = P.length / 3, th = (design.thickness ?? 0.002) * s;
  if (p.kind === "skirt") {
    const o = skirtOutline(F, p, [], 0.04 * s, 48), pts = new Float32Array(o.rows * o.NA * 3);
    for (let r = 0; r < o.rows; r++) for (let k = 0; k < o.NA; k++) {
      const a = (k / o.NA - 0.5) * Math.PI * 2, rad = o.R[r][k];
      pts.set([o.cx + Math.sin(a) * rad, o.y0 - r * o.dy, o.cz + Math.cos(a) * rad], (r * o.NA + k) * 3);
    }
    const rows = o.R.map(row => row.reduce((a, v) => a + v, 0) / o.NA);   // each ring's mean radius: the handles' rings
    const G = { outer: { P: pts }, rings: { y0: o.y0, y1: o.y1, cx: o.cx, cz: o.cz, radius: y => rows[Math.max(0, Math.min(o.rows - 1, Math.round((o.y0 - y) / o.dy)))] } };
    return { kind: "rings", piece: p, thickness: th, rings: { pts, rows: o.rows, NA: o.NA }, handles: handles(F, G, p), lift: null, V: null, K: null };
  }
  const C = cutter(F, p), V = new Float32Array(n), K = new Uint8Array(n), lift = new Float32Array(n);
  // the ease as the tailor lifts the cloth (pieces.js shell): the body's, the sleeves', the legs' growing to the hem, more
  // round the crotch; a shoe its own; over the garments under it, from how far out their films stand there
  const e = p.ease || {}, eb = (e.body ?? 0.008) * s, ea = (e.sleeve ?? e.body ?? 0.008) * s, el = (e.leg ?? e.body ?? 0.008) * s, fl = (e.flare ?? 0) * s;
  const knee = F.kneeY, crotch = F.crotchY, legTo = p.legs ? height(F, p.legs.to) : 0, [ccx, ccz] = F.torsoAxis(crotch), gap = 0.0015 * s;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], [v, k] = C.which(x, y, z);
    V[i] = v; K[i] = KIND[k] || 0;
    if (v < -0.08 * s) continue;                                   // well outside: no need of its lift
    let u = 0;                                                     // what's worn under it, where that is
    for (const g of under) if (g.lift && g.V[i] >= 0) u = Math.max(u, g.lift[i] + g.thickness);
    if (u > 0) u += gap;
    const a = F.arm(x, y, z);
    if (a) { lift[i] = u + ea; continue; }
    const legW = 1 - smooth(crotch - 0.02 * s, crotch + 0.06 * s, y);
    let L = u + eb + (el - eb) * legW + fl * smooth(knee + 0.1 * s, legTo, y) * legW;
    if (p.legs && p.kind !== "shoe") L += (e.crotch ?? 0.014) * s * Math.exp(-((Math.hypot(x - ccx, y - crotch, z - ccz) / (0.08 * s)) ** 2));
    lift[i] = L;
  }
  // the handles found on the cloth's points: the skin where the cloth is, lifted off it (its points, the middles of its
  // edges, and where its edges cross the lines: the skin's mesh alone is too coarse for a handle's window)
  const O = [], at = (i, L) => O.push(P[i * 3] + N[i * 3] * L, P[i * 3 + 1] + N[i * 3 + 1] * L, P[i * 3 + 2] + N[i * 3 + 2] * L);
  const mid = (a, b, ta) => { const tb = 1 - ta, L = lift[a] * ta + lift[b] * tb; for (let q = 0; q < 3; q++) O.push((P[a * 3 + q] + N[a * 3 + q] * L) * ta + (P[b * 3 + q] + N[b * 3 + q] * L) * tb); };
  if (T) {
    for (let i = 0; i < n; i++) if (V[i] >= 0) at(i, lift[i]);
    const seen = new Set();
    for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = T[t + k], b = T[t + (k + 1) % 3], key = a < b ? a * n + b : b * n + a;
      if (seen.has(key) || (V[a] < 0 && V[b] < 0)) continue; seen.add(key);
      if (V[a] >= 0 && V[b] >= 0) mid(a, b, 0.5);
      else mid(a, b, 1 - V[a] / (V[a] - V[b]));                      // on the line itself
    }
  }
  const G = { outer: { P: Float32Array.from(O) }, ends: C.parts.ends, open: C.parts.open };
  return { kind: "film", piece: p, thickness: th, V, K, lift, rings: null, handles: p.kind === "shoe" || !T ? [] : handles(F, G, p) };
}

/** every garment of an outfit, each over the ones before it: [[design name, colour?, look?, edit?], ...] with the
    designs (tailor.js edited lays the edits on) */
export function guides(F, P, N, T, list, designs, edited) {
  const out = [];
  for (const [name, , , edit] of list) {
    const d = designs[name]; if (!d) continue;
    out.push({ name, ...guide(F, P, N, T, edited(d, edit), out) });
  }
  return out;
}
