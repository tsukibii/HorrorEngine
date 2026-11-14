// An outfit as the tailor cuts and hangs it, written as a .glb for Godot without the Character Studio's page: the
// body, and each garment part with the fabric's metres as its second UV and, on its material, the record the Studio's
// Export for Godot writes for a garment that wears a clothing fabric set (`studioCloth`: the set, its repeat, its
// numbers, the garment's denier; tools/fabricpbr.py, docs/TAILOR.md §1k). The look plugin's HSCloth dresses it from
// those records (GODOT_LOOK §5x): what tools/godot/cloth_check.py --outfits pictures. No rig, no baked dye (a
// garment's colour is its material's), no creases: the cloth shader on real garments, in seconds.
//
//   node tools/character/tailor/outfitglb.mjs --outfit "fabrics: red rib jumper and leather skirt" --out FILE.glb
//        [--body feminine] [--height 1.62] [--no-drape]
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { loadMhr, mhrBody, bodyWeights, bodySculpt, ROOT } from "./node.mjs";
import * as TAILOR from "../tailor.js";
import { normals } from "./mesh.js";
import { Glb } from "../hair2/glb.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1] ?? true; };
const has = k => process.argv.includes("--" + k);
const CLOTHES = join(ROOT, "Content", "Studio", "Clothes");
const designs = JSON.parse(readFileSync(join(CLOTHES, "designs.json"))).designs, outfits = JSON.parse(readFileSync(join(CLOTHES, "outfits.json"))).outfits;
const name = arg("outfit"), list = outfits[name], out = arg("out");
if (!list || !out) { console.error("--outfit NAME (one in outfits.json) and --out FILE.glb"); process.exit(1); }
const bodyName = arg("body", "feminine"), H = parseFloat(arg("height", /masculine/.test(bodyName) ? 1.76 : 1.62));
const SHELVES = [process.env.STUDIO_PBR || join(ROOT, "assets", "pbr"), join(ROOT, "pbr"), join(ROOT, "Content", "Studio", "PBR")];
const setOf = ref => { if (typeof ref !== "string") return null; const f = SHELVES.map(d => join(d, ...ref.replace(/^pbr\//, "").split("/"), "meta.json")).find(f => existsSync(f)); return f ? JSON.parse(readFileSync(f)) : null; };
const lin = hex => { const c = [1, 3, 5].map(i => parseInt(String(hex || "#888888").slice(i, i + 2), 16) / 255); return c.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); };

const MHR = loadMhr(), b = mhrBody(MHR, bodyWeights(bodyName), H, bodySculpt(bodyName), {});
const t0 = Date.now(), worn = TAILOR.dress(TAILOR.body(b.P, b.T), list, designs, { drape: !has("no-drape") });
const G = new Glb(), root = G.node({ name: "outfit" });
G.node({ name: "body_skin", parent: root, mesh: G.mesh({ name: "body_skin", position: new Float32Array(b.P), normal: new Float32Array(normals(b.P, b.T)), index: new Uint32Array(b.T),
  material: G.material({ name: "body_skin", color: [...lin("#c8a28c"), 1], roughness: 0.6 }) }) });
let sets = 0, parts = 0;
for (const g of worn) {
  const look = g.look || {}, ref = look.pbr || designs[g.name]?.pbr, m = setOf(ref), fb = m && m.fabric;
  for (const q of g.parts) {
    const fabric = q.fabric !== false, n = q.P.length / 3, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = q.S[i];          // the garment's own shade along its edges
    const sheer = !!(fabric && fb && fb.kind === "sheer"), rec = fabric && fb ? { set: ref.split("/").pop().replace(/_\d+K(-JPG|-PNG)?$/, ""), ref, tile_m: m.tile_m, tint: true, sheer,
      ...Object.fromEntries(["kind", "cavity", "sheen", "sheen_rough", "sheen_dye", "wrap", "halo", "spec", "macro", "cover", "mean", "dye_mean"].filter(k => fb[k] !== undefined).map(k => [k, fb[k]])),
      fuzz: look.fuzz ?? 1, denier: look.denier ?? designs[g.name]?.denier ?? 0.55, normal: "none" } : null;
    const mat = G.material({ name: q.name, color: [...lin(fabric ? look.color || q.color : q.color), sheer ? rec.denier : 1], roughness: 0.85, blend: sheer, extras: rec ? { studioCloth: rec } : undefined });
    G.node({ name: q.name, parent: root, mesh: G.mesh({ name: q.name, position: new Float32Array(q.P), normal: new Float32Array(q.N), uv: new Float32Array(q.UV), uv1: new Float32Array(q.UV), color: col, index: new Uint32Array(q.T), material: mat }) });
    parts++; if (rec) sets++;
  }
}
mkdirSync(dirname(out), { recursive: true }); G.write(out);
console.log(`OUTFITGLB ${out}: "${name}" on the ${bodyName} body, ${worn.length} garments, ${parts} parts, ${sets} of them saying their fabric (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
