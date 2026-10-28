// The tailor's check: every design in Content/Studio/Clothes/designs.json is cut on seven bodies (MHR's average, its
// feminine and masculine presets, and slim and full ones of each: tailor/bodies.json), every outfit in outfits.json on
// the feminine one, in order. Each garment has triangles, no stray numbers, indices in range, fabric coordinates and
// normals on every point, lies outside the body (its outside never under the skin), reaches the heights its design
// names, and comes out the same twice. Then the drape (tailor/drape.js): outfits that show each kind of garment hung by
// gravity (tops, trousers, skirts, pleats, a tucked shirt, buttoned fronts, a coverall) on the feminine body, one on
// the masculine and the full one: every garment settles, stretches little, stays out of the body, its hem no more
// than a hand under where it was cut; a bake of it comes back the same without falling again; a skin-tight fit clings.
// The frame's wrist and elbow (where sleeves end) within 3.5 cm of MHR's own joints (its rig) on every body. The guides
// (tailor/guides.js, the Studio's edit mode): a garment's lines found on the body alone reach where its cut does (its
// film's or rings' top and bottom within 2 cm of the cut's) and its handles sit within 3 cm of the cut's own (8 at a
// trouser hem, where the relaxed cloth bridges the ankle's hollow; 5 for a skirt's flare, found on a waved or pleated hem).
// Ends "TAILOR ok".
//
//   node tools/character/tailor/check.mjs
import { readFileSync } from "fs";
import { join } from "path";
import { loadMhr, namedBody, bodyWeights, ROOT } from "./node.mjs";
import * as PO from "../pose.js";
import * as TAILOR from "../tailor.js";
import { height, frame } from "./frame.js";
import { bust, sleeveEnd } from "./pieces.js";
import { normals } from "./mesh.js";
import { guide } from "./guides.js";

const CLOTHES = join(ROOT, "Content", "Studio", "Clothes");
const { designs } = JSON.parse(readFileSync(join(CLOTHES, "designs.json")));
const { outfits } = JSON.parse(readFileSync(join(CLOTHES, "outfits.json")));
const errs = [], DETAILS = new Set(["neckband", "collar", "placket", "band", "cuff", "pocket", "buttons", "lapel", "edgeband", "foot", "trim"]), SLOTS = new Set(["under", "top", "bottom", "full", "legs", "feet", "jacket"]);

for (const [name, d] of Object.entries(designs)) {
  if (!d.label) errs.push(`${name}: no label`);
  if (!SLOTS.has(d.slot)) errs.push(`${name}: slot ${d.slot}`);
  if (!/^#[0-9a-f]{6}$/i.test(d.color || "")) errs.push(`${name}: colour ${d.color}`);
  if (!["shell", "skirt", "shoe"].includes(d.piece?.kind)) errs.push(`${name}: piece kind ${d.piece?.kind}`);
  for (const x of d.details || []) if (!DETAILS.has(x.kind)) errs.push(`${name}: a detail called ${x.kind}`);
}
for (const [name, list] of Object.entries(outfits)) for (const [d] of list) if (!designs[d]) errs.push(`outfit ${name}: no design ${d}`);

const sum = g => { let h = 0; for (const q of g.parts) { for (let i = 0; i < q.P.length; i += 97) h = (h * 31 + Math.round(q.P[i] * 1e5)) % 1e9; h = (h + q.T.length) % 1e9; } return h; };
const look = (label, B, g, hung = false) => {
  let tris = 0, lo = 1e9, hi = -1e9;
  for (const q of g.parts) {
    const n = q.P.length / 3; tris += q.T.length / 3;
    if (!q.T.length) errs.push(`${label}: ${q.name} has no triangles`);
    for (let i = 0; i < q.P.length; i++) if (!Number.isFinite(q.P[i])) { errs.push(`${label}: a stray number in ${q.name}`); break; }
    for (let i = 0; i < q.T.length; i++) if (q.T[i] >= n) { errs.push(`${label}: ${q.name} points past its vertices`); break; }
    if (q.UV.length !== n * 2 || q.N.length !== n * 3 || q.PART.length !== n || q.S.length !== n) errs.push(`${label}: ${q.name}'s attributes don't match its points`);
    for (let i = 0; i < q.UV.length; i++) if (!Number.isFinite(q.UV[i]) || Math.abs(q.UV[i]) > 5) { errs.push(`${label}: ${q.name} has fabric coordinates off its panels`); break; }
    for (let i = 0; i < n; i += 7) if (Math.abs(Math.hypot(q.N[i * 3], q.N[i * 3 + 1], q.N[i * 3 + 2]) - 1) > 0.01) { errs.push(`${label}: ${q.name} has a normal that isn't one long`); break; }
  }
  // the outside never under the skin: every 5th point of the cloth's outside, against the body (a skirt's rings pass
  // where the arms hang beside it in MHR's own pose: the drape pushes the cloth off them, so those points aren't counted)
  const o = g.outer[0], hit = {}, p = g.design.piece, F = B.F; let under = 0, n = 0, loBody = 1e9;
  for (let i = 0; i < o.P.length; i += 15) {
    const x = o.P[i], y = o.P[i + 1], z = o.P[i + 2], arm = F.arm(x, y, z);
    lo = Math.min(lo, y); hi = Math.max(hi, y); if (!arm) loBody = Math.min(loBody, y);
    if (p.kind === "skirt" && arm) continue;
    const r = B.surf.closest(x, y, z, 0.05, hit); n++;
    if (r && r.d < -0.0005) under++;
  }
  if (under / n > 0.002) errs.push(`${label}: ${(100 * under / n).toFixed(2)}% of its outside is under the skin`);
  // it reaches what its design names (a hem or a leg measured off the arms: a cropped top's sleeves hang lower than its hem)
  const want = [];
  if (p.kind === "skirt") want.push(["waist", height(F, p.waist?.at ?? "waist-0.04"), hi], ["hem", height(F, p.length ?? "knee+0.06"), lo]);
  if (p.legs) want.push(["legs", height(F, p.legs.to), loBody]);
  if (p.hem) want.push(["hem", height(F, p.hem.at) - Math.max(p.hem.front || 0, p.hem.back || 0) * F.s, loBody]);   // its tails lowest
  if (p.neck) want.push(["neck", F.neckBaseY + (0.02 + (p.neck.rise || 0)) * F.s, hi]);   // the back of the neckline rises (its tilt); a turtleneck's by its rise
  if (p.bra) {                                                                     // a bra: its band under the bust, its straps over the shoulders
    want.push(["band", bust(F).under + (p.bra.drop ?? 0) * F.s - (p.bra.band ?? 0.02) * F.s, lo]);
    if (p.bra.style !== "bandeau") want.push(["straps", F.neckBaseY, hi]);
  }
  if (p.brief) want.push(["gusset", F.crotchY - (p.brief.deep ?? 0.035) * F.s, lo]);   // briefs: down between the legs
  for (const [what, y, got] of want) {                                             // hung, a hem or a leg may fall a hand lower
    const off = got - y, tol = (what === "straps" ? 0.06 : 0.035) * F.s;
    if (off > tol || off < -(hung && got !== hi ? 0.1 * F.s : tol)) errs.push(`${label}: its ${what} at ${got.toFixed(3)} m, not ${y.toFixed(3)}`);
  }
  if (tris > 250000) errs.push(`${label}: ${tris} triangles`);
  return tris;
};

const m = loadMhr(), t0 = Date.now(), counts = {};
const BODIES = [["average", 1.7], ["feminine", 1.62], ["masculine", 1.78], ["slim_feminine", 1.6], ["slim_masculine", 1.76], ["full_feminine", 1.64], ["full_masculine", 1.78]];
const rig = readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1_rig.bin")), R = PO.readRig(rig.buffer.slice(rig.byteOffset, rig.byteOffset + rig.byteLength));
const joints = (P, w, h) => {                                      // MHR's joints fitted to this body (pose.js), as the Studio's T-pose fits them
  const Q = new Float32Array(m.P); let lo = 1e9, hi = -1e9;
  for (let k = 0; k < w.length; k++) if (w[k]) for (let i = 0; i < Q.length; i++) Q[i] += w[k] * m.shapes[k * m.n * 3 + i];
  for (let i = 1; i < Q.length; i += 3) { lo = Math.min(lo, Q[i]); hi = Math.max(hi, Q[i]); }
  const J = PO.joints(R, P, m.P, h / (hi - lo));
  return name => { const k = R.byName.get(name); return [J[k * 3], J[k * 3 + 1], J[k * 3 + 2]]; };
};
for (const [bname, h] of BODIES) {
  const b = namedBody(m, bname, h), B = TAILOR.body(b.P, b.T), J = joints(b.P, bodyWeights(bname), h);
  for (const side of ["L", "R"]) {                                  // where the sleeves end: the wrist and the elbow on the arm's line
    const A = B.F.arms[side], c = side.toLowerCase(), off = { wrist: A.wrist - A.line.project(...J(`${c}_wrist`))[0], elbow: A.elbow - A.line.project(...J(`${c}_lowarm`))[0] };
    for (const [k, d] of Object.entries(off)) if (!(Math.abs(d) < 0.035)) errs.push(`${bname}: its ${side} ${k} ${(d * 100).toFixed(1)} cm from MHR's own`);
  }
  for (const [name, d] of Object.entries(designs)) {
    let g;
    try { g = TAILOR.make(B, name, d); } catch (e) { errs.push(`${name} on ${bname}: ${e.message}`); continue; }
    const tris = look(`${name} on ${bname}`, B, g);
    (counts[name] ||= []).push(tris);
    if (bname === "feminine" && sum(TAILOR.make(B, name, d)) !== sum(g)) errs.push(`${name}: not the same twice`);
  }
  if (bname === "feminine") for (const [oname, list] of Object.entries(outfits)) {
    try { for (const g of TAILOR.dress(B, list, designs)) look(`${oname}: ${g.name}`, B, g); } catch (e) { errs.push(`outfit ${oname}: ${e.message}`); }
  }
}
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(16)} ${v.map(t => `${Math.round(t / 1000)}k`).join(" / ")} triangles`);

// the drape: each outfit hung, then from its bakes
const HUNG = [["feminine", 1.62, ["work uniform", "t-shirt and skirt", "school uniform (blazer)", "cardigan and skirt", "coverall", "school uniform (summer)", "skirt suit", "shirt and shorts"]], ["masculine", 1.78, ["office (blazer)", "t-shirt tucked in"]], ["full_feminine", 1.64, ["t-shirt and pants"]]];
for (const [bname, h, names] of HUNG) {
  const b = namedBody(m, bname, h), B = TAILOR.body(b.P, b.T);
  for (const oname of names) {
    const list = outfits[oname], label = `${oname} on ${bname}, hung`; let worn;
    try { worn = TAILOR.dress(B, list, designs, { drape: true, body: bname }); } catch (e) { errs.push(`${label}: ${e.message}`); continue; }
    const bakes = {};
    for (const g of worn) {
      look(`${label}: ${g.name}`, B, g, !!g.drape);
      if (!g.drape) continue;
      const d = g.drape; bakes[g.key] = g.hung;
      if (!(d.moving.rms < 0.005)) errs.push(`${label}: ${g.name} still moving at ${(d.moving.rms * 1000).toFixed(1)} mm/s`);
      if (!(d.stretch.p99 < 1.25)) errs.push(`${label}: ${g.name} stretched ${((d.stretch.p99 - 1) * 100).toFixed(0)}% (one edge in a hundred)`);
      console.log(`  ${label}: ${g.name.padEnd(16)} ${d.steps} steps, ${(d.ms / 1000).toFixed(1)} s, stretch ${d.stretch.p50}/${d.stretch.p90}/${d.stretch.p99}, fell ${(d.fell * 100).toFixed(1)} cm${d.buttoned ? `, ${d.buttoned} buttoned` : ""}`);
    }
    worn.forEach((g, k) => {                     // a sleeve inside a later one is held as it was cut: round the arm, not sagging into it
      const ends = list.slice(k + 1).map(([n]) => designs[n].piece.sleeve).filter(v => v !== undefined && v !== false);
      if (!g.drape || !ends.length || g.design.piece.sleeve === undefined || g.design.piece.sleeve === false) return;
      const F = B.F, y0 = B.floor || 0, o = g.outer[0], hit = {}, d = [];
      for (let i = 0; i < o.P.length; i += 9) {
        const x = o.P[i], y = o.P[i + 1] - y0, z = o.P[i + 2], a = F.arm(x, y, z);
        if (!a || a.t > Math.max(...ends.map(e => sleeveEnd(F, a.side, e))) - 0.03 * F.s) continue;
        const r = B.surf.closest(x, y, z, 0.2, hit); if (r) d.push(r.d);
      }
      if (!d.length) return;
      d.sort((a, b) => a - b); const sag = d[Math.floor(0.9 * (d.length - 1))] - d[d.length >> 1];
      if (!(sag < 0.003)) errs.push(`${label}: ${g.name}'s sleeves sag ${(sag * 1000).toFixed(0)} mm inside the sleeves over them`);
    });
    const again = TAILOR.dress(B, list, designs, { drape: true, body: bname, bakes });   // from its bakes: the same, and nothing falls
    again.forEach((g, i) => { if (worn[i].drape && (!g.drape?.baked || sum(g) !== sum(worn[i]))) errs.push(`${label}: ${g.name} isn't the same from its bake`); });
  }
}
{                                       // a bake comes back only if nothing it hangs from changed, what closes over it later too
  const key = (l, k = 0) => TAILOR.plan("k", l.map(n => [n]), designs)[k].key;
  if (key(["t-shirt"]) === key(["t-shirt", "pants"])) errs.push("a t-shirt's bake alone would come back tucked into pants");
  if (key(["work-shirt-long"]) === key(["work-shirt-long", "blazer"])) errs.push("a shirt's bake alone would come back inside a blazer");
  if (key(["long-sleeve", "skirt"], 1) === key(["long-sleeve", "skirt", "cardigan"], 1)) errs.push("a skirt's bake would come back over a top a cardigan now holds");
  if (key(["t-shirt"]) !== key(["t-shirt", "flats"])) errs.push("shoes would hang a t-shirt again");
}
{                                                                                  // skin tight: a t-shirt at fit 0 lies on the skin
  const b = namedBody(m, "feminine", 1.62), B = TAILOR.body(b.P, b.T), g = TAILOR.make(B, "t-shirt", TAILOR.edited(designs["t-shirt"], { fit: 0 }), { drape: true }), hit = {};
  let far = 0, n = 0; const o = g.outer[0];
  for (let i = 0; i < o.P.length; i += 30) { const r = B.surf.closest(o.P[i], o.P[i + 1], o.P[i + 2], 0.1, hit); n++; if (!r || r.d > 0.008) far++; }
  look("t-shirt at fit 0", B, g);
  if (g.drape) errs.push("t-shirt at fit 0: draped (skin tight has nothing to hang)");
  if (far / n > 0.05) errs.push(`t-shirt at fit 0: ${(100 * far / n).toFixed(0)}% of it over 8 mm off the skin`);
  else console.log(`  t-shirt at fit 0: ${(100 * (1 - far / n)).toFixed(0)}% of it within 8 mm of the skin`);
}
{                                                                                  // the guides against the cuts, on the feminine body
  const b = namedBody(m, "feminine", 1.62), B = TAILOR.body(b.P, b.T), F = frame(b.P, b.T), N = normals(b.P, b.T);
  const names = ["t-shirt", "pants", "skirt", "pleated-skirt", "blazer", "work-boots", "tights", "triangle-bralette", "jeogori-lace", "turtleneck", "chima", "sequin-dress", "cargo-pants"];
  let t = Date.now();
  for (const name of names) {
    const g = guide(F, b.P, N, b.T, designs[name]), made = TAILOR.make(B, name, designs[name]);
    let lo = 1e9, hi = -1e9, clo = 1e9, chi = -1e9;
    if (g.kind === "film") { for (let i = 0; i < g.V.length; i++) if (g.V[i] >= 0) { lo = Math.min(lo, b.P[i * 3 + 1]); hi = Math.max(hi, b.P[i * 3 + 1]); } }
    else for (let i = 1; i < g.rings.pts.length; i += 3) { lo = Math.min(lo, g.rings.pts[i]); hi = Math.max(hi, g.rings.pts[i]); }
    const O = made.outer[0].P; for (let i = 1; i < O.length; i += 3) { clo = Math.min(clo, O[i]); chi = Math.max(chi, O[i]); }
    if (Math.abs(lo - clo) > 0.02 || Math.abs(hi - chi) > 0.02) errs.push(`guides: ${name} reaches ${lo.toFixed(3)}..${hi.toFixed(3)} m, its cut ${clo.toFixed(3)}..${chi.toFixed(3)}`);
    for (const h of made.handles) {
      const q = g.handles.find(x => x.key === h.key);
      if (!q) { errs.push(`guides: ${name} has no ${h.key} handle`); continue; }
      const d = Math.hypot(q.at[0] - h.at[0], q.at[1] - h.at[1], q.at[2] - h.at[2]);
      if (d > (h.key === "legs" ? 0.08 : h.key === "flare" ? 0.05 : 0.03)) errs.push(`guides: ${name}'s ${h.key} handle ${(d * 100).toFixed(1)} cm from the cut's`);   // (at the ankle the relaxed cloth bridges the hollow in front of it: its hem sits forward of the skin's)
      if (q.value !== h.value || q.kind !== h.kind) errs.push(`guides: ${name}'s ${h.key} handle reads ${q.value}, the cut's ${h.value}`);
    }
  }
  console.log(`  guides: ${names.length} designs' lines and handles on the body alone, as their cuts' (${Date.now() - t} ms)`);
}
if (errs.length) { console.error(errs.map(e => "TAILOR FAIL: " + e).join("\n")); process.exit(1); }
console.log(`TAILOR ok (${Object.keys(designs).length} designs on ${BODIES.length} bodies, ${Object.keys(outfits).length} outfits, ${HUNG.reduce((a, [, , o]) => a + o.length, 0)} hung, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
