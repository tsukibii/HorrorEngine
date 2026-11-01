// The tailor: clothes for a Character Studio character, cut from its own body (after Woohill's character creator,
// tsukibii/woohill creator/src/js/20-clothes.js and 21-outfits.js, with far more polygons for our realistic bodies).
// No sewing patterns: a garment is the skin over a region, lifted by its ease and relaxed into cloth (shirts,
// trousers, shorts, coveralls), or rings hung from the waist (skirts), then hung on the body by gravity (the drape,
// tailor/drape.js: a cloth simulation, DECISIONS 2026-10-25), with details lifted off it (neckbands, collars,
// plackets, pockets, waistbands, belts, cuffs) and buttons sewn on the hanging cloth; every piece has a thickness.
// The designs are data: Content/Studio/Clothes/designs.json; outfits in outfits.json.
// Plain ES module: the Studio page (tools/character/index.html) and node (tools/character/tailor/cli.mjs) run it.
import { frame } from "./tailor/frame.js";
import { prepare, shell, skirt, shoeShell, detail, buttons, thicken, lifted, cut, handles, soles, waistline, sleeveEnd } from "./tailor/pieces.js";
import { unwrap } from "./tailor/uv.js";
import { height } from "./tailor/frame.js";
import { draping, run, DRAPE } from "./tailor/drape.js";
import { normals, smooth } from "./tailor/mesh.js";

export const VERSION = 1;
export const DRAPE_VERSION = 3;                                     // a bake of an older drape is draped again: raise it when the drape changes

/** the body, read once per shape: P, T in metres, Y up, facing +Z. One that doesn't stand on y = 0 (the desk's figure
    stands its foot bones there, its soles a little under) is measured standing on it, and its clothes come back in its
    own frame (B.floor, the height it stands at) */
export function body(P, T) {
  let low = Infinity; for (let i = 1; i < P.length; i += 3) low = Math.min(low, P[i]);
  if (Math.abs(low) > 1e-4) { const B = body(raised(P, -low), T); B.floor = low; return B; }
  const F = frame(P, T);
  return prepare(P, T, F);
}
const raised = (P, dy) => { const Q = Float32Array.from(P); for (let i = 1; i < Q.length; i += 3) Q[i] += dy; return Q; };

/** a piece cut looser or tighter than designed by its `fit`: 1 as designed, 0 skin tight (the ease down to a millimetre
    and a half, clinging to every hollow, no fullness to hang, a skirt straight down), 2 loose (two and a half times the
    ease, hanging freer, a fifth more cloth round the body, twice the flare) */
export function fitted(p) {
  const f = p.fit; if (f === undefined || f === 1 || p.kind === "shoe") return p;
  const q = { ...p }, k = Math.max(0, f), tight = 0.0015, e = v => k <= 1 ? tight + (v - tight) * k : v * (1 + (k - 1) * 1.5);
  if (p.kind === "skirt") { q.ease = e(p.ease ?? 0.006); if (!(p.taper > 0)) q.flare = (p.flare ?? 0.12) * k; }
  else {
    q.ease = { ...(p.ease || {}) };
    for (const key of ["body", "sleeve", "leg"]) if (q.ease[key] !== undefined || key === "body") q.ease[key] = e(q.ease[key] ?? 0.008);
    if (q.ease.flare !== undefined) q.ease.flare *= k;
    if (q.ease.crotch !== undefined && k < 1) q.ease.crotch = 0.004 + (q.ease.crotch - 0.004) * k;
    const t = p.tension ?? 16; q.tension = Math.round(k <= 1 ? 6 + (t - 6) * k : t * (1 + (k - 1) * 0.5));
  }
  if (p.drape) q.drape = { ...p.drape, slack: k <= 1 ? (p.drape.slack ?? 0) * k : (p.drape.slack ?? 0) + (k - 1) * 0.2, ...(k < 0.25 ? { on: false } : {}) };   // skin tight: nothing to hang
  return q;
}

/** make() a step at a time (it yields {name, frac} while it drapes): see make */
export const make = (...a) => run(making(...a));

/**
 * One garment on the body, over what's already worn (`under`: garments this function made). `opts.drape`: hang it by
 * gravity (true, or settings over its piece's `drape`: tailor/drape.js) if its design drapes; `opts.baked`: the points
 * of an earlier drape of it (tailor/drape.js takes them as they are). Returns {design, parts: [{name, color, fabric
 * (true: it takes the garment's fabric), P, T, N, UV (metres round its part: tailor/uv.js), PART, S (a shade per vertex:
 * darker along the edges)}], outer: [{P, T}] (its outside, for what goes over it), hung (the draped points of its cut,
 * for a bake), stats}.
 */
export function* making(B, name, design, opts = {}) {
  const t0 = Date.now(), F = B.F, s = F.s, y0 = B.floor || 0;
  const under = (opts.under || []).map(g => y0 ? { ...g, outer: g.outer.map(o => ({ ...o, P: raised(o.P, -y0) })) } : g);   // into the frame it's cut in
  const p = fitted(design.piece), color = opts.color || design.color || "#888888", trim = design.trim || color;
  const G = p.kind === "skirt" ? skirt(B, p, under.map(g => ({ outer: g.outer[0] }))) : p.kind === "shoe" ? shoeShell(B, p) : shell(B, p, under);
  const th = (design.thickness ?? 0.002) * s, parts = [];
  // the drape: the cut cloth hung on the body; everything on it is cut where the cloth was cut and sewn where it hangs.
  // Tucked into what closes round the waist over it later (opts.tuck), its sleeves held inside the sleeves over it
  // (opts.cover); its front closed where it's buttoned
  let hung = null;
  if (opts.drape && p.drape && p.drape.on !== false) {
    const bt = (design.details || []).find(d => d.kind === "buttons");   // a front worn open (`open.closed: false`) is never pulled together
    const closed = p.open && p.open.closed !== false ? (bt ? [height(F, bt.to) - 0.01 * s, height(F, bt.from) + 0.01 * s] : [-1, height(F, p.open.from ?? "bust-0.06")]) : null;
    const it = draping(B, G, p, { ...p.drape, ...(typeof opts.drape === "object" ? opts.drape : {}), tuck: opts.tuck || null, cover: opts.cover || null, closed, hold: bandHolds(F, G, design), baked: opts.baked || null }, under, th);
    let r; while (!(r = it.next()).done) yield { name, frac: r.value };
    hung = r.value;
  }
  const at = hung ? hung.P : null, outer = [at ? { P: at, T: G.outer.T } : G.outer];
  // a bottom's legs are panels from its waist down; a coverall's from a waist seam
  const legsTo = p.legs ? (p.waist ? height(F, p.waist.at) + 0.05 * s : F.crotchY + 0.2 * s) : -1;
  const part = (pname, col, m, fabric, surface, mAt = null) => parts.push({ name: pname, color: col, fabric, surface, ...unwrap(F, m.P, m.T, m.S, { rings: G.rings, legsTo, at: mAt }) });
  const thick = (P, T, Pat, ...a) => [thicken(P, T, ...a), Pat ? thicken(Pat, T, ...a).P : null];   // the cut's and the hanging cloth's (the same points)
  part(name, color, ...insert(thick(G.outer.P, G.outer.T, at, th, design.rim ?? 0.7, design.edge ?? 0.82), true));
  if (design.sole) {                                                 // a shoe's soles, under the floor
    const so = soles(F, B, design.sole); outer.push({ P: so.P, T: so.T });
    part(`${name}_sole`, design.sole.color || "#e8e4dc", so, false, design.sole.surface || "rubber");
  }
  for (const d of design.details || []) {
    if (d.kind === "buttons") { const b = buttons(F, G.outer, d, at); if (b.T.length) part(`${name}_buttons`, d.color || design.buttons || "#222222", b, false); continue; }
    const D = detail(F, G, d); if (!D) continue;
    const L = lifted(cut, G.outer, D.value, D.lift, at); if (!L) continue;
    if (d.kind !== "collar" && d.kind !== "neckband") outer.push(L.at ? { P: L.at, T: L.T } : L);   // what goes over it eases over pockets and belts, not the roll of a collar
    const dt = (d.thickness ?? design.thickness ?? 0.002) * s * 0.8;
    part(`${name}_${d.kind}`, d.color || (d.trim ? trim : color), ...insert(thick(L.P, L.T, L.at, dt, d.rim ?? 0.45, d.edge ?? 0.62), !d.trim && !d.color, d.surface));
  }
  const tris = parts.reduce((a, q) => a + q.T.length / 3, 0), verts = parts.reduce((a, q) => a + q.P.length / 3, 0);
  // its look (tailor/look.js): the design's fabric, pattern and trim, then the garment's own
  const look = { color, surface: design.surface, trim: design.trimSurface, pattern: design.pattern, denier: design.denier, crease: design.crease, ...(opts.look || {}) };
  const hs = handles(F, G, p, at);
  if (y0) {                                                          // back into the body's own frame
    for (const q of [...parts, ...outer]) q.P = raised(q.P, y0);
    for (const h of hs) h.at = [h.at[0], h.at[1] + y0, h.at[2]];
  }
  return { name, design, look, parts, outer, thickness: th, handles: hs, hung: at, drape: hung && hung.stats, stats: { triangles: tris, vertices: verts, ms: Date.now() - t0 } };
}
/** the cloth under the bands that hold their shape as cut: a neckband, a sleeve's cuff (buttoned or ribbed round the
    wrist: the sleeve blouses above it, never over the hand), a ribbed hem (rib pulls in round the hips), any detail with
    `hold`: 1 there, per point of the cut */
function bandHolds(F, G, design) {
  const P = G.outer.P, n = P.length / 3, H = new Float32Array(n), N = normals(P, G.outer.T), s = F.s;
  for (const d of design.details || []) {
    if (!(d.hold ?? (d.kind === "neckband" || (d.kind === "cuff" && d.on !== "legs") || (d.kind === "band" && d.surface === "rib")))) continue;
    const D = detail(F, G, d); if (!D) continue;
    for (let i = 0; i < n; i++) H[i] = Math.max(H[i], smooth(-0.012 * s, -0.002 * s, D.value(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2])));
  }
  return H;
}
// [m, mAt] and the rest of part()'s arguments in its order: (m, fabric, surface, mAt)
const insert = ([m, mAt], fabric, surface) => [m, fabric, surface, mAt];

/** a design with a garment's own edits laid over its piece (objects merged, the rest replaced) */
export function edited(design, edit) {
  if (!edit || !Object.keys(edit).length) return design;
  const merge = (a, b) => {
    const o = { ...(a && typeof a === "object" && !Array.isArray(a) ? a : {}) };
    for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && !Array.isArray(v) && a && typeof a[k] === "object" ? merge(a[k], v) : v;
    return o;
  };
  return { ...design, piece: merge(design.piece, edit) };
}

/** dress() a step at a time (it yields {k, of, name, frac} while a garment drapes): see dress */
export const dress = (...a) => run(dressing(...a));

/** a whole outfit, in order (each garment over the ones before, hung over them if `opts.drape`): list = [[design
    name, colour?, look?, edit?], ...]. A top worn under trousers or a skirt that comes later is tucked into it. With
    `opts.bakes` ({key: points}) and `opts.body` (a key for the body) a garment draped before on the same body, under
    the same garments, cut the same, takes its bake instead of falling again; each garment comes back with its `key` */
export function* dressing(B, list, designs, opts = {}) {
  const worn = [], ds = list.map(([name, , , edit]) => { const d = designs[name]; if (!d) throw new Error(`no design called ${name}`); return edited(d, edit); });
  for (let k = 0; k < list.length; k++) {
    const [name, color, look] = list[k], key = drapeKey(opts.body, list, ds, k);
    const ov = opts.drape ? over(ds, k) : [], tuck = tucks(B.F, ov), cover = covers(B.F, ov);
    const it = making(B, name, ds[k], { color, look, under: worn.slice(), drape: opts.drape, tuck, cover, baked: opts.bakes ? opts.bakes[key] : null });
    let r; while (!(r = it.next()).done) yield { k, of: list.length, ...r.value };
    worn.push({ ...r.value, key });
  }
  return worn;
}
/** each garment of an outfit: its drape's key, and whether it drapes at all (its design hangs and isn't fitted skin
    tight), so a caller knows what a drape would have to do */
export function plan(body, list, designs) {
  const ds = list.map(([name, , , edit]) => edited(designs[name], edit));
  return ds.map((d, k) => { const p = fitted(d.piece); return { key: drapeKey(body, list, ds, k), drapes: !!(p.drape && p.drape.on !== false) }; });
}
/** what a garment's drape depends on, as a short key: the drape's own version, the body, and the cut of it and of
    everything worn under it (their pieces and details; not their colours or looks), each with what holds it from over
    it (a top's tuck is in the trousers that come after it) */
export function drapeKey(body, list, ds, k) {
  const held = j => over(ds, j).map(q => [q.kind ?? null, q.waist ?? null, q.neck === false, q.sleeve ?? null]);
  return hash(JSON.stringify([DRAPE_VERSION, DRAPE, body ?? null, list.slice(0, k + 1).map(([name], j) => [name, ds[j].piece, ds[j].details || [], held(j)])]));
}
function hash(str) {                                                // cyrb53: 53 bits as hex
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
/** what goes over garment k later and holds it there: the waists a top is tucked into (bottoms with a waistband,
    skirts) and the sleeves round its own */
function over(ds, k) {
  const p = ds[k].piece, top = p.neck !== false, sleeved = p.sleeve !== undefined && p.sleeve !== false;
  return ds.slice(k + 1).map(d => d.piece).filter(q => (top && (q.kind === "skirt" || (q.waist && q.neck === false))) || (sleeved && q.sleeve !== undefined && q.sleeve !== false));
}
/** how far down each arm the sleeves of what goes over a garment later reach ({L, R}, from the shoulder joint as
    F.arm's t), or null for none: the sleeve inside them is held as it was cut, pressed to the arm, not sagging */
function covers(F, later) {
  const q = later.filter(p => p.sleeve !== undefined && p.sleeve !== false);
  return q.length ? { L: Math.max(...q.map(p => sleeveEnd(F, "L", p.sleeve))), R: Math.max(...q.map(p => sleeveEnd(F, "R", p.sleeve))) } : null;
}
/** where the waists of what goes over a top later close round it (bottoms with a waistband, skirts): tuck(x, y, z) is
    how far under the highest of them a point is (> 0 tucked in), or null for none */
function tucks(F, later) {
  const lines = later.filter(p => p.kind === "skirt" || (p.waist && p.neck === false))
    .map(p => p.kind === "skirt" ? (y0 => (x, y) => y0 - y)(height(F, p.waist?.at ?? "waist-0.04")) : waistline(F, p.waist.at, p.waist));
  return lines.length ? (x, y, z) => Math.max(...lines.map(f => f(x, y, z))) : null;
}
