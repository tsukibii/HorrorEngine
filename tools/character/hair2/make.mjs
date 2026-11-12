// A head and its hair as a file, in node (the hair editor v2.0, docs/HAIR_V2.md): a style grown on a body by the same
// engine the Character Studio's tab runs, written as a glb in the head's local space (the origin between the ears)
// for Godot to picture (tools/godot/hair2_check.py) and for the checks. Not how a character's hair reaches a game:
// that's the Studio's Export for Godot.
//
//   node tools/character/hair2/make.mjs --style NAME [--set key=value ...] [--body base|fem|masc|child8|ogre|...] --out FILE.glb
//   node tools/character/hair2/make.mjs --bodybin People/NAME/body.bin --settings FILE.json --out FILE.glb      a character's own body and its { style, set }
//   node tools/character/hair2/make.mjs --pores [--set hairline.shape=m_shape ...] --out FILE.glb      the pores as dots (Show the pores)
import { Glb } from "./glb.mjs";
import { readFileSync } from "fs";
import { bodyByName, bodyFromFile, loadPores, headSkin } from "./node.mjs";
import { place, alive } from "./pores.js";
import { prepare, grow } from "./engine.js";
import { settings, lookOf, drawLook, STYLES } from "./styles.js";
import { textures, record } from "./bake.js";
import { linear } from "../hairtex.js";
import { tile } from "./shell.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes(k);
const BANDS = flag("--bands");                                           // (the pores coloured by their place on the chart: a centimetre of height, ten degrees round, a band each)
const sets = () => { const o = {}; process.argv.forEach((a, i) => { if (a === "--set") { const [k, v] = process.argv[i + 1].split("="); k.split(".").reduce((q, part, j, all) => (j === all.length - 1 ? (q[part] = isNaN(+v) ? (v === "true" ? true : v === "false" ? false : v) : +v) : (q[part] ||= {})), o); } }); return o; };

// the pores as small squares on the skin, coloured: growing (dark), off (pale), the hairline's soft edge (red)
export function poreDots(body, pores, on, edge, size = 0.0022) {
  const { pos, nrm } = place(pores, body.L, body.T, body.VN), P = [], N = [], C = [], I = [];
  for (let i = 0; i < pores.n; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], n = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]];
    let a = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]; const al = Math.hypot(...a); a = a.map(x => x / al);
    const b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]], s = on[i] ? size : size * 0.6, base = P.length / 3;
    const yb = Math.floor(pores.base[i * 3 + 1] * 100 + 100) % 2, ab = Math.floor((Math.abs(pores.az[i]) + 360) / 10) % 2;
    const col = BANDS ? (yb ? (ab ? [0.9, 0.1, 0.1] : [0.1, 0.1, 0.9]) : (ab ? [1, 0.9, 0.1] : [0.1, 0.8, 0.2])) : !on[i] ? [0.92, 0.86, 0.8] : edge[i] < 0.4 ? [0.75, 0.1, 0.1] : [0.05, 0.04, 0.04];
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { P.push(...p.map((x, k) => x + n[k] * 0.0007 + (a[k] * u + b[k] * v) * s)); N.push(...n); C.push(...col); }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { position: new Float32Array(P), normal: new Float32Array(N), color: new Float32Array(C), index: new Uint32Array(I) };
}

if (process.argv[1] && process.argv[1].endsWith("make.mjs")) {
  const body = arg("--bodybin") ? bodyFromFile(arg("--bodybin")) : bodyByName(arg("--body", "base")), pores = loadPores(), S = sets(), out = arg("--out"), G = new Glb();
  const kept = arg("--settings") ? JSON.parse(readFileSync(arg("--settings"), "utf8")) : null;   // { style, set }: a character's own (the Studio's Preview in Godot)
  const skin = headSkin(body);
  G.node({ name: "head_skin", mesh: G.mesh({ name: "head_skin", ...skin, material: G.material({ name: "skin", color: [0.8, 0.63, 0.54, 1], roughness: 0.6 }) }) });
  if (flag("--pores")) {
    const A = alive(pores, S.hairline || {}, +arg("--count", pores.n)), dots = poreDots(body, pores, A.on, A.edge);
    G.node({ name: "pores", mesh: G.mesh({ name: "pores", ...dots, material: G.material({ name: "pores", roughness: 1 }) }) });
    console.log(`${A.n} pores growing of ${Math.min(pores.n, +arg("--count", pores.n))}`);
  }
  const style = kept ? (STYLES[kept.style] ? kept.style : "bob_middle") : arg("--style");
  if (style) {
    const s = settings(style, kept ? kept.set || {} : S), prep = prepare(body), look = lookOf(s), rootC = linear(look.root).map(v => Math.round(255 * Math.pow(v, 1 / 2.2)));
    const r = grow(body, pores, s, prep, { rootColour: rootC }), tex = textures(drawLook(s));   // (dyed hair: a flat atlas, each lock's colour on its points)
    const mat = G.material({ name: "hair_cards", texture: G.texture(tex.albedo, tex.W, tex.H, { repeatS: true }), occlusion: G.texture(tex.strands, tex.W, tex.H, { repeatS: true }), alphaCutoff: 0.4, doubleSided: true, roughness: 0.55, extras: record(tex.look) });
    const h = r.hair;
    if (h.index.length) G.node({ name: "hair_static", mesh: G.mesh({ name: "hair_static", position: h.position, normal: h.normal, tangent: h.tangent, uv: h.uv, uv1: h.uv1, color: h.color, index: h.index, material: mat }) });   // (a cut that's all shells has no cards)
    if (r.scalp) G.node({ name: "hair_scalp", mesh: G.mesh({ name: "hair_scalp", position: r.scalp.position, normal: r.scalp.normal, uv: r.scalp.uv, index: r.scalp.index,
      material: G.material({ name: "hair_scalp", texture: G.texture(r.scalp.rgba, r.scalp.size, r.scalp.size), blend: true, roughness: 1 }) }) });
    for (const t of r.tails) G.node({ name: `hair_${t.name}`, mesh: G.mesh({ name: `hair_${t.name}`, position: t.geo.position, normal: t.geo.normal, tangent: t.geo.tangent, uv: t.geo.uv, uv1: t.geo.uv1, color: t.geo.color, index: t.geo.index, material: mat }) });
    for (const b of r.bands) { const c = linear(b.colour); G.node({ name: b.name, mesh: G.mesh({ name: b.name, position: b.position, normal: b.normal, index: b.index, material: G.material({ name: b.name, color: [c[0], c[1], c[2], 1], roughness: 0.85 }) }) }); }
    if (r.shell) G.node({ name: "hair_shell", mesh: G.mesh({ name: "hair_shell", position: r.shell.position, normal: r.shell.normal, tangent: r.shell.tangent, uv: r.shell.uv, color: r.shell.color, index: r.shell.index,
      material: G.material({ name: "hair_shell", texture: G.texture(tile(), 256, 256, { repeatS: true, repeatT: true }), alphaCutoff: 0.5, doubleSided: true, roughness: 0.6,
        extras: { look: tex.look, studioShell: { version: 1, tile: "R each hair's height, G its number for thinning, B its shade, A its profile", color: "r the layer (0 the skin .. 1 the tips), g the hair left there" } } }) }) });
    console.log(`${style} on ${body.name}: the grid ${prep.ms.toFixed(0)} ms; ${JSON.stringify(r.stats)}`);
  }
  console.log(`${out}: ${(G.write(out) / 1024).toFixed(0)} KB`);
}
