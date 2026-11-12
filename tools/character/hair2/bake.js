// The bake's finish for the hair editor v2.0's cards (docs/HAIR_V2.md §3.9): the same data the salon's bake carries
// (docs/GODOT_LOOK.md §5e), so Godot's HSHair wears this hair with no change: every card vertex's normal the hair
// volume's shell normal (hairvolume.js: the cards shade as one soft mass), each card wound to face it, the second UV
// (x across the card, y the occlusion), and the textures: the strand atlas in the look's colours, each strand's own
// numbers for the occlusion slot. Plain arrays, no three.js: the page wraps them, node writes them (glb.mjs).
//
//   finish(geo, S)             adds geo.normal (the shell's), geo.uv1; winds geo.index; -> { cells, open }
//   textures(look, o)          -> { W, H, albedo (RGBA), strands (RGBA), atlas }
//   record(look)               the material's extras: { look, shader, studioHair }
import * as HV from "../hairvolume.js";
import { makeAtlas, albedo, LOOKS, DEFAULT_LOOK } from "../hairtex.js";
import { dist } from "./sdf.js";

// (the same words as hairshader.js's STUDIO_HAIR, which HSHair reads: hair.gd set_bake)
export const STUDIO_HAIR = { version: 1, strands: "occlusionTexture (R a faint shade per strand, 0.8 to 1; G each strand's random number; B its clump's)",
  tangent: "along the strand, root to tip", normal: "the hair volume's shell normal (tools/character/hairvolume.js), both faces lit by it",
  uv1: "x across the card (0 one edge, 1 the other), y the occlusion (1 open)", uv: "v from the root (0) to the tip (1)", by: "the hair editor v2.0 (tools/character/hair2)",
  // (every lock starts at its own pore: HSHair's root fade, 6% of a lock for the salon's hand-laid ones, would bare two centimetres of scalp at a pulled-back hairline and widen every parting)
  settings: { root_fade: 0.012 } };

export function finish(geo, S, o = {}) {
  const P = geo.position; if (!P.length) { geo.uv1 = new Float32Array(0); return { cells: 0, open: 1 }; }
  const V = HV.volume(P, q => dist(S, q[0], q[1], q[2]) < 0, { cell: o.cell ?? 0.008, blur: o.blur ?? 0.012 });
  const sh = HV.shell(V, P, geo.normal, o.mix ?? 0.8);
  HV.wind(geo.index, P, sh);
  const n = P.length / 3, uv1 = new Float32Array(n * 2);
  if (o.draft) { for (let i = 0; i < n; i++) { uv1[i * 2] = i % 2; uv1[i * 2 + 1] = 1; } geo.normal = sh; geo.uv1 = uv1; return { cells: V.n, open: 1 }; }
  const oc = HV.occlusion(V, P, sh, { reach: 0.06, dirs: 12 }), sorted = Float32Array.from(oc).sort(), top = sorted[Math.floor(sorted.length * 0.9)] || 1;
  let sum = 0;
  for (let i = 0; i < n; i++) { const v = Math.min(1, oc[i] / top); uv1[i * 2] = i % 2; uv1[i * 2 + 1] = v; sum += v; }
  geo.normal = sh; geo.uv1 = uv1;
  return { cells: V.n, open: +(sum / n).toFixed(3) };
}

let ATLAS = null;
export const atlas = () => ATLAS || (ATLAS = makeAtlas());
export function textures(look) {
  const A = atlas(), k = Object.assign({}, LOOKS[DEFAULT_LOOK], look || {}), strands = new Uint8ClampedArray(A.W * A.H * 4);
  for (let i = 0; i < A.W * A.H; i++) { strands[i * 4] = 204 + Math.round(A.data[i * 4] * 0.2); strands[i * 4 + 1] = A.data[i * 4 + 1]; strands[i * 4 + 2] = A.data[i * 4 + 2]; strands[i * 4 + 3] = 255; }
  return { W: A.W, H: A.H, albedo: albedo(A, k), strands, atlas: A, look: k };
}
// (dyed hair, a look that's a carrier: each lock's broad highlight in its own colour too, where that's brighter than the look's: HSHair's spec2_own)
export const record = look => ({ look, shader: "tools/character/hairshader.js (Kajiya-Kay, shifted per strand; the atlas's R brightness, G strand, B clump, A coverage)", studioHair: look && look.carrier ? { ...STUDIO_HAIR, settings: { ...STUDIO_HAIR.settings, spec2_own: 1 } } : STUDIO_HAIR });
