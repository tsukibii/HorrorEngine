// The tailor's check: every design in Content/Studio/Clothes/designs.json is cut on five bodies (MHR's average, its
// feminine and masculine presets, and slim ones of each: tailor/bodies.json), every outfit in outfits.json on the
// feminine one, in order. Each garment has
// triangles, no stray numbers, indices in range, fabric coordinates and normals on every point, lies outside the body (its outside never under the skin), reaches the
// heights its design names, and comes out the same twice. Ends "TAILOR ok".
//
//   node tools/character/tailor/check.mjs
import { readFileSync } from "fs";
import { join } from "path";
import { loadMhr, mhrBody, bodyWeights, ROOT } from "./node.mjs";
import * as TAILOR from "../tailor.js";
import { height } from "./frame.js";

const CLOTHES = join(ROOT, "Content", "Studio", "Clothes");
const { designs } = JSON.parse(readFileSync(join(CLOTHES, "designs.json")));
const { outfits } = JSON.parse(readFileSync(join(CLOTHES, "outfits.json")));
const errs = [], DETAILS = new Set(["neckband", "collar", "placket", "band", "cuff", "pocket", "buttons"]), SLOTS = new Set(["top", "bottom", "full"]);

for (const [name, d] of Object.entries(designs)) {
  if (!d.label) errs.push(`${name}: no label`);
  if (!SLOTS.has(d.slot)) errs.push(`${name}: slot ${d.slot}`);
  if (!/^#[0-9a-f]{6}$/i.test(d.color || "")) errs.push(`${name}: colour ${d.color}`);
  if (!["shell", "skirt"].includes(d.piece?.kind)) errs.push(`${name}: piece kind ${d.piece?.kind}`);
  for (const x of d.details || []) if (!DETAILS.has(x.kind)) errs.push(`${name}: a detail called ${x.kind}`);
}
for (const [name, list] of Object.entries(outfits)) for (const [d] of list) if (!designs[d]) errs.push(`outfit ${name}: no design ${d}`);

const sum = g => { let h = 0; for (const q of g.parts) { for (let i = 0; i < q.P.length; i += 97) h = (h * 31 + Math.round(q.P[i] * 1e5)) % 1e9; h = (h + q.T.length) % 1e9; } return h; };
const look = (label, B, g) => {
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
  // the outside never under the skin: every 5th point of the cloth's outside, against the body
  const o = g.outer[0], hit = {}; let under = 0, n = 0;
  for (let i = 0; i < o.P.length; i += 15) {
    lo = Math.min(lo, o.P[i + 1]); hi = Math.max(hi, o.P[i + 1]);
    const r = B.surf.closest(o.P[i], o.P[i + 1], o.P[i + 2], 0.05, hit); n++;
    if (r && r.d < -0.0005) under++;
  }
  if (under / n > 0.002) errs.push(`${label}: ${(100 * under / n).toFixed(2)}% of its outside is under the skin`);
  // it reaches what its design names
  const p = g.design.piece, F = B.F, want = [];
  if (p.kind === "skirt") want.push(["waist", height(F, p.waist?.at ?? "waist-0.04"), hi], ["hem", height(F, p.length ?? "knee+0.06"), lo]);
  if (p.legs) want.push(["legs", height(F, p.legs.to), lo]);
  if (p.hem) want.push(["hem", height(F, p.hem.at) - Math.max(p.hem.front || 0, p.hem.back || 0) * F.s, lo]);   // its tails lowest
  if (p.neck) want.push(["neck", F.neckBaseY + 0.02 * F.s, hi]);                  // the back of the neckline rises (its tilt)
  for (const [what, y, got] of want) if (Math.abs(got - y) > 0.035 * F.s) errs.push(`${label}: its ${what} at ${got.toFixed(3)} m, not ${y.toFixed(3)}`);
  if (tris > 250000) errs.push(`${label}: ${tris} triangles`);
  return tris;
};

const m = loadMhr(), t0 = Date.now(), counts = {};
const BODIES = [["average", 1.7], ["feminine", 1.62], ["masculine", 1.78], ["slim_feminine", 1.6], ["slim_masculine", 1.76]];
for (const [bname, h] of BODIES) {
  const b = mhrBody(m, bodyWeights(bname), h), B = TAILOR.body(b.P, b.T);
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
if (errs.length) { console.error(errs.map(e => "TAILOR FAIL: " + e).join("\n")); process.exit(1); }
console.log(`TAILOR ok (${Object.keys(designs).length} designs on ${BODIES.length} bodies, ${Object.keys(outfits).length} outfits, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
