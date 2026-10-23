// The tailor: clothes for a Character Studio character, cut from its own body (after Woohill's character creator,
// tsukibii/woohill creator/src/js/20-clothes.js and 21-outfits.js, with far more polygons for our realistic bodies).
// No sewing patterns and no cloth simulation (DECISIONS 2026-10-23): a garment is the skin over a region, lifted by its
// ease and relaxed into cloth (shirts, trousers, shorts, coveralls), or rings hung from the waist (skirts), with
// details lifted off it (neckbands, collars, plackets, pockets, waistbands, belts, cuffs) and buttons; every piece
// has a thickness. The designs are data: Content/Studio/Clothes/designs.json; outfits in outfits.json.
// Plain ES module: the Studio page (tools/character/index.html) and node (tools/character/tailor/cli.mjs) run it.
import { frame } from "./tailor/frame.js";
import { prepare, shell, skirt, shoeShell, detail, buttons, thicken, lifted, cut, handles, soles } from "./tailor/pieces.js";
import { unwrap } from "./tailor/uv.js";
import { height } from "./tailor/frame.js";

export const VERSION = 1;

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

/**
 * One garment on the body, over what's already worn (`under`: garments this function made). Returns
 * {design, parts: [{name, color, fabric (true: it takes the garment's fabric), P, T, N, UV (metres round its part: tailor/uv.js),
 * PART, S (a shade per vertex: darker along the edges)}], outer: [{P, T}] (its outside, for what goes over it), stats}.
 */
export function make(B, name, design, opts = {}) {
  const t0 = Date.now(), F = B.F, s = F.s, y0 = B.floor || 0;
  const under = (opts.under || []).map(g => y0 ? { ...g, outer: g.outer.map(o => ({ ...o, P: raised(o.P, -y0) })) } : g);   // into the frame it's cut in
  const p = design.piece, color = opts.color || design.color || "#888888", trim = design.trim || color;
  const G = p.kind === "skirt" ? skirt(B, p, under.map(g => ({ outer: g.outer[0] }))) : p.kind === "shoe" ? shoeShell(B, p) : shell(B, p, under);
  const th = (design.thickness ?? 0.002) * s, parts = [], outer = [G.outer];
  // a bottom's legs are panels from its waist down; a coverall's from a waist seam
  const legsTo = p.legs ? (p.waist ? height(F, p.waist.at) + 0.05 * s : F.crotchY + 0.2 * s) : -1;
  const part = (pname, col, m, fabric, surface) => parts.push({ name: pname, color: col, fabric, surface, ...unwrap(F, m.P, m.T, m.S, { rings: G.rings, legsTo }) });
  part(name, color, thicken(G.outer.P, G.outer.T, th, design.rim ?? 0.7, design.edge ?? 0.82), true);
  if (design.sole) {                                                 // a shoe's soles, under the floor
    const so = soles(F, B, design.sole); outer.push({ P: so.P, T: so.T });
    part(`${name}_sole`, design.sole.color || "#e8e4dc", so, false, design.sole.surface || "rubber");
  }
  for (const d of design.details || []) {
    if (d.kind === "buttons") { const b = buttons(F, G.outer, d); if (b.T.length) part(`${name}_buttons`, d.color || design.buttons || "#222222", b, false); continue; }
    const D = detail(F, G, d); if (!D) continue;
    const L = lifted(cut, G.outer, D.value, D.lift); if (!L) continue;
    if (d.kind !== "collar" && d.kind !== "neckband") outer.push(L);   // what goes over it eases over pockets and belts, not the roll of a collar
    part(`${name}_${d.kind}`, d.color || (d.trim ? trim : color), thicken(L.P, L.T, (d.thickness ?? design.thickness ?? 0.002) * s * 0.8, d.rim ?? 0.45, d.edge ?? 0.62), !d.trim && !d.color, d.surface);
  }
  const tris = parts.reduce((a, q) => a + q.T.length / 3, 0), verts = parts.reduce((a, q) => a + q.P.length / 3, 0);
  // its look (tailor/look.js): the design's fabric, pattern and trim, then the garment's own
  const look = { color, surface: design.surface, trim: design.trimSurface, pattern: design.pattern, denier: design.denier, ...(opts.look || {}) };
  const hs = handles(F, G, p);
  if (y0) {                                                          // back into the body's own frame
    for (const q of [...parts, ...outer]) q.P = raised(q.P, y0);
    for (const h of hs) h.at = [h.at[0], h.at[1] + y0, h.at[2]];
  }
  return { name, design, look, parts, outer, thickness: th, handles: hs, stats: { triangles: tris, vertices: verts, ms: Date.now() - t0 } };
}

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

/** a whole outfit, in order (each garment over the ones before): list = [[design name, colour?, look?, edit?], ...] */
export function dress(B, list, designs) {
  const worn = [];
  for (const [name, color, look, edit] of list) {
    const d = designs[name]; if (!d) throw new Error(`no design called ${name}`);
    worn.push(make(B, name, edited(d, edit), { color, look, under: worn.slice() }));
  }
  return worn;
}
