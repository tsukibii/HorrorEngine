// HAIR2: the hair editor v2.0's engine, in node, no browser (docs/HAIR_V2.md). The fixed pores well formed; the styles'
// table (every style a label, a group and a look that exist; every control's path a real setting; a character's
// `{ style, set }` bringing back exactly the settings it was made from); every style grown on MHR's base: no NaN,
// nothing deep inside the body, nothing below the chest, the scalp covered where locks grow, the triangles within the
// detail's budget, the same twice, made quickly; what each kind is made of (a tied style its tails with a chain's
// joints and its ties, a buzz cut shells and no locks, a bald top fewer pores); the hairline's dropdown and the
// thinning's really changing which pores grow; and a few styles on other bodies (a child, a full-grown man, two
// creatures): still on the head. Ends "HAIR2 ok".
//   node tools/character/hair2/check.mjs [style ...]
import { bodyByName, loadPores } from "./node.mjs";
import { prepare, grow, BUDGET } from "./engine.js";
import { STYLES, GROUPS, CONTROLS, DEFAULTS, settings, differs, lookOf, FRINGES } from "./styles.js";
import { alive, HAIRLINES, THINNING } from "./pores.js";
import { dist } from "./sdf.js";

const bad = [], t0 = Date.now(), only = process.argv.slice(2);
const say = (ok, what) => { if (!ok) { bad.push(what); console.log("  BAD " + what); } };
const get = (o, path) => path.split(".").reduce((q, k) => (q == null ? undefined : q[k]), o);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the pores
const pores = loadPores();
say(pores.n === 4096 && pores.header.area_cm2 > 600 && pores.header.area_cm2 < 800, `the pores: ${pores.n} on ${pores.header.area_cm2.toFixed(0)} cm2`);
{ let mirrored = 0; for (let i = 0; i < pores.n; i += 2) if (Math.abs(pores.base[i * 3] + pores.base[(i + 1) * 3]) < 1e-5 && Math.abs(pores.base[i * 3 + 1] - pores.base[(i + 1) * 3 + 1]) < 1e-5) mirrored++;
  say(mirrored > pores.n / 2 * 0.95, `the pores come in mirrored pairs (${mirrored} of ${pores.n / 2})`); }

// ---- the table
for (const [id, st] of Object.entries(STYLES)) {
  say(st.label && GROUPS[st.group], `${id}: a label and a group`);
  say(!st.from || STYLES[st.from], `${id}: the style it's from exists`);
  const s = settings(id), look = lookOf(s);
  say(look && /^#[0-9a-f]{6}$/i.test(look.root) && /^#[0-9a-f]{6}$/i.test(look.tip), `${id}: its look's colours`);
  say(same(differs(id, s), {}), `${id}: nothing differs from itself`);
  const mod = settings(id, { cut: { line: -0.123 }, texture: { wave: 0.011 }, fringe: { kind: "blunt", amount: 0.33 }, look: { ...look, root: "#102030" } });
  say(same(settings(id, differs(id, mod)), mod), `${id}: { style, set } brings back the settings it was made from`);
}
for (const sec of CONTROLS) for (const r of sec.rows) {
  const v = get(DEFAULTS, r[0]);
  say(v !== undefined, `the control ${r[0]} is a setting`);
  if (r[2] === "slide" && v != null) say(v * r[6] >= r[3] - 1e-9 && v * r[6] <= r[4] + 1e-9, `${r[0]}'s default (${v}) is on its slider (${r[3]} to ${r[4]})`);
  if (r[2] === "pick" && typeof v === "string") say(r[3].some(o => o[0] === v), `${r[0]}'s default is one of its choices`);
}
for (const [id, st] of Object.entries(STYLES)) for (const sec of CONTROLS) for (const r of sec.rows) {
  const v = get(settings(id), r[0]);
  if (r[2] === "slide" && v != null) say(v * r[6] >= r[3] - 1e-6 && v * r[6] <= r[4] + 1e-6, `${id}: ${r[0]} (${v}) is on its slider (${r[3]} to ${r[4]})`);
  if (r[2] === "pick" && typeof v === "string") say(r[3].some(o => o[0] === v), `${id}: ${r[0]} (${v}) is one of its choices`);
}
say(Object.keys(FRINGES).length >= 8, "the fringes");

// ---- the hairline and the thinning: which pores grow
{ const n = k => alive(pores, k).n, soft = n({ shape: "soft_round" });
  say(n({ shape: "receding_1" }) < soft && n({ shape: "receding_2" }) < n({ shape: "receding_1" }) && n({ shape: "receding_3" }) < n({ shape: "receding_2" }), "the receding hairlines: fewer pores each step");
  say(n({ shape: "low" }) > n({ shape: "high" }) && n({ shape: "soft_round", height: 15 }) < soft && n({ shape: "soft_round", temples: 20 }) < soft, "a low hairline grows more than a high one; Height and Temples take pores away");
  say(n({ sideburns: 1 }) > n({ sideburns: 0 }) && n({ nape: 1 }) > n({ nape: 0 }), "Sideburns and Nape add pores");
  for (const k of Object.keys(HAIRLINES)) { const a = alive(pores, { shape: k }); let lop = 0; for (let i = 0; i < pores.n; i += 2) if (a.on[i] !== a.on[i + 1]) lop++; say(k === "uneven" || lop < pores.n * 0.12, `the hairline ${k}: the same on both sides (but for the soft edge's chance: ${lop} pairs differ)`); }
  for (const k of Object.keys(THINNING)) if (k !== "none") say(n({ thinning: k, thinAmount: 1 }) < soft - 60, `thinning ${k}: fewer pores`);
  say(same(Array.from(alive(pores, { shape: "m_shape", seed: 3 }).on), Array.from(alive(pores, { shape: "m_shape", seed: 3 }).on)), "the same hairline twice: the same pores"); }

// ---- every style grown on MHR's base
const base = bodyByName("base"), prep = prepare(base);
say(prep.ms < 6000, `the body as a distance grid in ${prep.ms.toFixed(0)} ms`);
const finite = a => { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };
const KINDS = { pony: 1, twin: 2, half: 1, twin_half: 2, bun: 1, buns: 2, knot: 1 };
let slowest = [0, ""], most = [0, ""];
for (const id of Object.keys(STYLES)) {
  if (only.length && !only.includes(id)) continue;
  const s = settings(id), r = grow(base, pores, s, prep, {}), h = r.hair, st = r.stats, P = h.position;
  if (st.total > slowest[0]) slowest = [st.total, id]; if (st.triangles > most[0]) most = [st.triangles, id];
  say(finite(P) && finite(h.normal) && finite(h.tangent) && finite(h.uv) && finite(h.uv1), `${id}: no NaN`);
  say(h.index.length % 3 === 0 && (!h.index.length || Math.max(...h.index.subarray(0, 3000)) < P.length / 3) && h.uv1.length / 2 === P.length / 3 && h.normal.length === P.length, `${id}: the cards' arrays agree`);
  const budget = BUDGET[s.detail || "medium"];
  say(st.triangles <= budget * 1.45, `${id}: ${st.triangles} triangles of locks within the detail's ${budget} (and a half)`);
  say((st.shellTriangles || 0) <= 26000, `${id}: ${st.shellTriangles || 0} triangles of shells`);
  let deep = 0, low = 0, far = 0;
  for (let i = 0; i < P.length; i += 3) { if (dist(prep.S, P[i], P[i + 1], P[i + 2]) < -0.004) deep++; if (P[i + 1] < -0.325) low++; if (Math.hypot(P[i], P[i + 1], P[i + 2]) > 0.5) far++; }
  say(deep <= P.length / 3 * 0.004, `${id}: ${deep} of ${P.length / 3} points deep inside the body`);
  say(!low && !far, `${id}: nothing below the chest (${low}) or flown off (${far})`);
  // (no loose hair across the face: the eyes, the nose, the mouth. A fringe's own hair and face-framing strands are meant to be there; loose hair there was once a lock's hair dragged after a guide that went another way round the head)
  { const G = r.guides; let across = 0;
    for (let i = 0; i < G.n; i++) { if (G.group[i] !== 0 || !(G.len[i] > 0)) continue; let hit = 0; for (let k = 0; k < 24; k++) { const o = (i * 24 + k) * 3, x = G.pts[o], y = G.pts[o + 1], z = G.pts[o + 2]; if (Math.abs(x) < 0.05 && y < 0.008 && y > -0.07 && z > 0.035 && dist(prep.S, x, y, z) < 0.012) hit++; } if (hit >= 2) across++; }
    say(across <= (s.fringe.kind === "over" ? 40 : 1), `${id}: ${across} loose hairs across the face`); }
  const bald = (s.hairline.thinning && s.hairline.thinning !== "none") || /receding/.test(s.hairline.shape);
  if (st.cards > 300 && st.covered !== undefined) say(st.covered >= (bald ? 0.8 : 0.9), `${id}: the scalp ${(st.covered * 100).toFixed(1)}% covered where locks grow`);
  say(st.total < 3000, `${id}: made in ${st.total.toFixed(0)} ms`);
  const kind = s.ties.kind, tails = KINDS[kind] || 0;
  say(r.tails.length === tails, `${id}: ${tails} tails (${r.tails.length})`);
  for (const t of r.tails) {
    say(finite(t.geo.position) && t.geo.triangles > 100 && t.along.length === t.geo.position.length / 3, `${id}: the tail ${t.name}'s cards`);
    if (kind === "pony" || kind === "twin" || kind === "half" || kind === "twin_half") say(t.joints && t.joints.length === 5 && t.joints.every(j => j.every(Number.isFinite)) && t.joints[4][1] < t.joints[0][1], `${id}: ${t.name} carries a chain's five joints, hanging down`);
    else say(!t.joints, `${id}: a bun has no chain`);
  }
  say(r.bands.length === (s.ties.tie.kind === "none" ? 0 : tails), `${id}: its ties (${r.bands.length})`);
  const short = Math.max(s.length.top, s.length.sides, s.length.back) <= 0.03 && s.cut.mode === "length";
  if (short) say(r.shell && r.shell.triangles > 1000 && st.cards === 0, `${id}: short hair is shells and no locks`);
  if (s.under.height != null || (s.cut.mode === "length" && Math.min(s.length.sides, s.length.back, s.length.nape) <= 0.03)) say(!!r.shell, `${id}: its clipped part is shells`);
  if (s.scalp.shade > 0) say(r.scalp && r.scalp.rgba.length === r.scalp.size * r.scalp.size * 4 && r.scalp.index.length > 3000, `${id}: the scalp painted`);
  if (id === "bob_middle" || id === "twin_tails_low" || id === "curls_shoulder") {                 // the same twice
    const again = grow(base, pores, s, prep, {});
    let diff = 0; for (let i = 0; i < P.length; i++) if (again.hair.position[i] !== P[i]) diff++;
    say(again.hair.position.length === P.length && !diff, `${id}: the same hair twice`);
    const draft = grow(base, pores, s, prep, { draft: true });
    say(draft.hair.position.length === P.length && draft.stats.total < st.total * 1.5 + 100, `${id}: a draft is the same locks, quicker`);
  }
}
// ---- what the sliders do
if (!only.length) {
  const g = (id, set) => grow(base, pores, settings(id, set), prep, { draft: true });
  const lowY = r => { let lo = 1; for (let i = 1; i < r.hair.position.length; i += 3) lo = Math.min(lo, r.hair.position[i]); return lo; };
  const a = g("bob_middle"), b = g("bob_middle", { cut: { line: -0.2 } });
  say(lowY(b) < lowY(a) - 0.08, `the cut's line 11 cm lower: the hair ${((lowY(a) - lowY(b)) * 100).toFixed(1)} cm longer`);
  say(g("bob_middle", { density: 800 }).stats.cards < a.stats.cards - 150 && g("bob_middle", { detail: "light" }).stats.triangles < a.stats.triangles * 0.75, "fewer pores: fewer locks; the light detail: fewer triangles");
  const width = r => { let w = 0; for (let i = 0; i < r.hair.position.length; i += 3) if (r.hair.position[i + 1] > -0.06 && r.hair.position[i + 1] < 0) w = Math.max(w, Math.abs(r.hair.position[i])); return w; };
  say(width(g("bob_middle", { shape: { volume: { sides: 0.03 } } })) > width(a) + 0.01, "more volume at the sides: the hair stands wider");
  say(g("long_straight", { fringe: { kind: "blunt" } }).guides.group.filter(x => x === 1).length > 40, "a fringe takes the front's pores");
  say(g("bob_middle", { ears: "clear" }).stats.cards > 0 && g("m_side_part", { under: { height: 0.05 } }).shell, "ears clear, an undercut: made");
  const tw = g("long_straight", { ties: { kind: "twin", height: 0.5 } });
  say(tw.tails.length === 2 && tw.bands.length === 2, "twin tails on any style");
}
// ---- other bodies
if (!only.length) for (const [who, ids] of [["child8", ["bob_fringe", "twin_tails_high"]], ["masc", ["m_side_part", "m_long"]], ["goblin", ["unkempt"]], ["ogre", ["m_top_knot"]]]) {
  const body = bodyByName(who), pr = prepare(body);
  for (const id of ids) {
    const r = grow(body, pores, settings(id), pr, {}), P = r.hair.position; let deep = 0, far = 0;
    for (let i = 0; i < P.length; i += 3) { if (dist(pr.S, P[i], P[i + 1], P[i + 2]) < -0.006) deep++; if (Math.hypot(P[i], P[i + 1], P[i + 2]) > 0.55) far++; }
    say(finite(P) && r.stats.cards > 150 && deep <= P.length / 3 * 0.01 && !far, `${id} on ${who}: ${r.stats.cards} locks on the head (${deep} points inside, ${far} flown off)`);
    if (r.stats.covered !== undefined) say(r.stats.covered > 0.8, `${id} on ${who}: the scalp ${(r.stats.covered * 100).toFixed(0)}% covered`);
  }
}
console.log(bad.length ? `HAIR2 FAIL (${bad.length})` : `HAIR2 ok (${Object.keys(STYLES).length} styles on MHR's base, the slowest ${slowest[1]} in ${slowest[0].toFixed(0)} ms, the most triangles ${most[1]} with ${most[0]}; ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(bad.length ? 1 : 0);
