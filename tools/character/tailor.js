// The tailor: clothes for a Character Studio character, cut from its own body (after Woohill's character creator,
// tsukibii/woohill creator/src/js/20-clothes.js and 21-outfits.js, with far more polygons for our realistic bodies).
// No sewing patterns and no cloth simulation (DECISIONS 2026-10-23): a garment is the skin over a region, lifted by its
// ease and relaxed into cloth (shirts, trousers, shorts, coveralls), or rings hung from the waist (skirts), with
// details lifted off it (neckbands, collars, plackets, pockets, waistbands, belts, cuffs) and buttons; every piece
// has a thickness. The designs are data: Content/Studio/Clothes/designs.json; outfits in outfits.json.
// Plain ES module: the Studio page (tools/character/index.html) and node (tools/character/tailor/cli.mjs) run it.
import { frame } from "./tailor/frame.js";
import { prepare, shell, skirt, detail, buttons, thicken, lifted, cut } from "./tailor/pieces.js";

export const VERSION = 1;

/** the body, read once per shape: P, T in metres, Y up, facing +Z, feet on the floor */
export function body(P, T) {
  const F = frame(P, T);
  return prepare(P, T, F);
}

/**
 * One garment on the body, over what's already worn (`under`: garments this function made). Returns
 * {design, parts: [{name, color, P, T}], outer: [{P, T}] (its outside, for what goes over it), stats}.
 */
export function make(B, name, design, opts = {}) {
  const t0 = Date.now(), F = B.F, s = F.s, under = opts.under || [];
  const p = design.piece, color = opts.color || design.color || "#888888", trim = design.trim || color;
  const G = p.kind === "skirt" ? skirt(B, p, under.map(g => ({ outer: g.outer[0] }))) : shell(B, p, under);
  const th = (design.thickness ?? 0.002) * s, parts = [], outer = [G.outer];
  parts.push({ name: name, color, ...thicken(G.outer.P, G.outer.T, th) });
  for (const d of design.details || []) {
    if (d.kind === "buttons") { const b = buttons(F, G.outer, d); if (b.T.length) parts.push({ name: `${name}_buttons`, color: d.color || design.buttons || "#222222", ...b }); continue; }
    const D = detail(F, G, d); if (!D) continue;
    const L = lifted(cut, G.outer, D.value, D.lift); if (!L) continue;
    outer.push(L);
    parts.push({ name: `${name}_${d.kind}`, color: d.color || (d.trim ? trim : color), ...thicken(L.P, L.T, (d.thickness ?? design.thickness ?? 0.002) * s * 0.8) });
  }
  const tris = parts.reduce((a, q) => a + q.T.length / 3, 0), verts = parts.reduce((a, q) => a + q.P.length / 3, 0);
  return { name, design, parts, outer, thickness: th, stats: { triangles: tris, vertices: verts, ms: Date.now() - t0 } };
}

/** a whole outfit, in order (each garment over the ones before): list = [[design name, colour?], ...] */
export function dress(B, list, designs) {
  const worn = [];
  for (const [name, color] of list) {
    const d = designs[name]; if (!d) throw new Error(`no design called ${name}`);
    worn.push(make(B, name, d, { color, under: worn.slice() }));
  }
  return worn;
}
