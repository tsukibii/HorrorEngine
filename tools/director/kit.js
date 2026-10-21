// The kit: room things built from boxes, bevelled boxes and cylinders, from a handful of numbers (docs/KIT.md).
// One source for the scene builder, the desk, the kit maker and the Unreal export (tools/kit/build.mjs): no DOM, no
// three.js. A spec is a preset's name or {type | preset, size: [w, d, h], ...params}. Local space is the story's:
// x across, y deep with the FRONT at -y, z up from the base; every part stays inside the size box, so the box the
// plan and the checks see is the thing. The gaps (between tiles, boards, doors and drawers) and the bevels are real
// geometry: they're what a light bake turns into the thin dark lines and bright edges of a real room.
export const VERSION = 1;          // bump when a generator's output changes (presets.json carries the same number)

// ---- material slots: one material each in Unreal (kit_<slot>), a flat colour in the desk ----------------------
// [colour, roughness, metalness, opacity, emissive]
export const SLOTS = {
  body: [0xe8e4dc, 0.6], front: [0xefebe3, 0.45], inner: [0x2a2a2e, 0.85], counter: [0xcfc8bc, 0.35],
  wood: [0xa47a52, 0.6], wood_2: [0x93693f, 0.6], wood_3: [0xb48b61, 0.6], wood_4: [0x86603d, 0.6],
  gap: [0x1b1712, 1], grout: [0x8f8c85, 1],
  tile: [0xdedbd4, 0.3], tile_2: [0xd3d0c8, 0.3], tile_3: [0xe7e4de, 0.3], tile_4: [0xcac7bf, 0.3],
  stone: [0x9d988f, 0.7], stone_2: [0x8f8a81, 0.7], stone_3: [0xa8a39a, 0.7], stone_4: [0x857f76, 0.7],
  tatami: [0xbfb57e, 0.9], heri: [0x2b2925, 0.8],
  fabric: [0x8d8277, 0.95], fabric_2: [0xdcd7cd, 0.95], sheer: [0xf0eee8, 0.9, 0, 0.55],
  rug: [0x6c707a, 1], rug_border: [0x3d4047, 1],
  plastic: [0xf4f2ed, 0.4], metal: [0xa3a8ae, 0.35, 0.8], black: [0x1f1f21, 0.5], frame: [0x3b3c3f, 0.45, 0.3],
  glass: [0xbcd3dc, 0.05, 0, 0.25], mirror: [0xc4cfd6, 0.03, 0.95], screen: [0x0d0e11, 0.15],
  paper: [0xd8c9b0, 0.9], white: [0xefefeb, 0.5], hole: [0x0e0e10, 1], emit: [0xfff1dc, 0.5, 0, 1, true],
};
export const slotOf = m => SLOTS[m] ? m : (SLOTS[m.replace(/_\d+$/, "")] ? m.replace(/_\d+$/, "") : "body");
const tone = (base, n, R) => { const i = n > 1 ? Math.floor(R() * n) : 0; return i && !/_\d+$/.test(base) ? `${base}_${i + 1}` : base; };

export function rng(seed) {           // mulberry32: the same seed, the same gaps, on every machine
  let a = (Math.floor(+seed || 0) >>> 0) ^ 0x9e3779b9;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SL = ["box", "cyl"];

// a part: {s: "box"|"cyl", at: [x, y, z] (the middle of its base), size: [w, d, h], m: slot, b: bevel, rz: degrees
// about z, skip: faces to leave out ("-z+y"), uv: [du, dv, swap]}. A cyl's size is [2r, 2r, length] along its axis
// ("z" up, "-z" down, "-y" out of the front), ri a tube's inner radius, m2 its inner faces' slot.
function bx(P, x0, y0, z0, x1, y1, z1, m, o) {
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return null;
  const p = Object.assign({ s: "box", at: [(x0 + x1) / 2, (y0 + y1) / 2, z0], size: [x1 - x0, y1 - y0, z1 - z0], m }, o || {});
  P.push(p); return p;
}
function cy(P, x, y, z, r, len, m, o) { const p = Object.assign({ s: "cyl", at: [x, y, z], size: [2 * r, 2 * r, len], m }, o || {}); P.push(p); return p; }

// ---- the types: their numbers (for the forms), their default size and where they go -----------------------------
// a param: [key, label, default, kind, extra]: kind m (metres), mm (stored in metres, shown in mm), int, num, deg,
// pick (extra: the choices), bool, slot, cols, holes, parts
const SURF = [["pattern", "pattern", "grid", "pick", ["grid", "half", "third", "random", "herringbone"]],
  ["gap", "gap", 0.003, "mm"], ["gap_var", "gap varies (0 to 1)", 0.35, "num"], ["seed", "seed", 1, "int"],
  ["groove", "gap depth", 0.002, "mm"], ["bevel", "edge bevel", 0.001, "mm"], ["lip", "unevenness", 0.0004, "mm"],
  ["tones", "tones (material slots)", 3, "int"], ["align", "start", "centre", "pick", ["centre", "line", "corner"]],
  ["angle", "runs", 0, "pick", [0, 90]], ["orient", "on", "floor", "pick", ["floor", "wall"]]];
export const TYPES = {
  tiles: { label: "Tiles", cat: "floor", mount: "room-floor", size: [3, 3, 0.012], params: [["tile", "tile w × l", [0.6, 0.6], "m2"], ...SURF,
    ["slot", "material", "tile", "slot"], ["base", "gap material", "grout", "slot"]], gen: tilesGen },
  planks: { label: "Wood planks", cat: "floor", mount: "room-floor", size: [3, 3, 0.015], params: [["board", "board width", 0.15, "m"],
    ["length", "lengths (min, max)", [0.9, 1.8], "m2"], ["stagger", "joints at least", 0.2, "m"],
    ...SURF.map(p => p[0] === "pattern" ? ["pattern", "pattern", "random", "pick", ["random", "half", "third", "herringbone"]] : p[0] === "gap" ? ["gap", "gap", 0.0015, "mm"] : p[0] === "align" ? ["align", "start", "corner", "pick", ["centre", "line", "corner"]] : p),
    ["slot", "material", "wood", "slot"], ["base", "gap material", "gap", "slot"]], gen: planksGen },
  tatami: { label: "Tatami", cat: "floor", mount: "room-floor", size: [3.64, 2.73, 0.055], params: [["mat", "mat w × l", [0.91, 1.82], "m2"],
    ["heri", "border (heri)", 0.03, "m"], ["gap", "gap", 0.002, "mm"], ["gap_var", "gap varies", 0.3, "num"], ["seed", "seed", 1, "int"],
    ["bevel", "edge bevel", 0.004, "mm"], ["angle", "runs", 0, "pick", [0, 90]]], gen: tatamiGen },
  rug: { label: "Rug", cat: "floor", mount: "floor", size: [2, 1.4, 0.012], params: [["border", "border", 0.08, "m"],
    ["fringe", "fringe (short ends)", 0.06, "m"], ["fringe_n", "fringe strands per m", 40, "int"], ["bevel", "edge bevel", 0.004, "mm"],
    ["slot", "material", "rug", "slot"], ["border_slot", "border material", "rug_border", "slot"]], gen: rugGen },
  cabinet: { label: "Cabinet / built-in", cat: "cabinet", mount: "back", size: [1.2, 0.6, 0.9], params: [["cols", "columns", [{ k: "doors", w: 0, n: 1 }], "cols"],
    ["kick", "toe kick", 0.08, "m"], ["kick_in", "kick set back", 0.05, "m"], ["carcass", "carcass", 0.018, "mm"],
    ["front_t", "front thickness", 0.019, "mm"], ["reveal", "gap between fronts", 0.003, "mm"],
    ["handle", "handles", "bar", "pick", ["none", "bar", "knob", "groove", "edge"]], ["slide", "sliding doors", false, "bool"],
    ["top", "worktop thickness", 0, "m"], ["top_over", "worktop overhang", 0.02, "m"], ["bevel", "front bevel", 0.001, "mm"],
    ["body", "carcass material", "body", "slot"], ["fronts", "front material", "front", "slot"], ["inside", "inside material", "inner", "slot"],
    ["top_slot", "worktop material", "counter", "slot"], ["handle_slot", "handle material", "metal", "slot"]], gen: cabinetGen },
  buildout: { label: "Wall build-out with recesses", cat: "wall", mount: "back", size: [2.4, 0.3, 2.4], params: [["holes", "recesses", [{ x: 0.6, z: 0.6, w: 1.2, h: 0.8, depth: 0.2, shelves: 0 }], "holes"],
    ["slot", "material", "body", "slot"], ["hole_slot", "recess material", "body", "slot"], ["bevel", "edge bevel", 0, "mm"]], gen: buildoutGen },
  plate: { label: "Switch / socket / panel", cat: "fitting", mount: "wall", size: [0.07, 0.012, 0.12], params: [["kind", "kind", "switch", "pick", ["switch", "socket_jp", "socket_eu", "screen", "blank"]],
    ["gangs", "switches / sockets", 1, "int"], ["layout", "laid out", "col", "pick", ["col", "row"]], ["margin", "margin", 0.008, "mm"],
    ["bevel", "edge bevel", 0.0015, "mm"], ["slot", "material", "plastic", "slot"]], gen: plateGen },
  panel: { label: "Mirror / TV / frame / board", cat: "wall", mount: "wall", size: [0.6, 0.02, 0.9], params: [["face", "face", "mirror", "slot"],
    ["frame", "frame width", 0.012, "m"], ["frame_slot", "frame material", "frame", "slot"], ["mat", "inner margin (mount)", 0, "m"],
    ["back", "slim back (a TV's)", 0, "m"], ["bevel", "edge bevel", 0.001, "mm"]], gen: panelGen },
  downlight: { label: "Downlight / ceiling panel", cat: "ceiling", mount: "ceiling", size: [0.12, 0.12, 0.02], params: [["shape", "shape", "round", "pick", ["round", "square"]],
    ["trim", "trim ring", 0.012, "mm"], ["lens_in", "lens set in", 0.012, "mm"], ["slot", "trim material", "white", "slot"]], gen: downlightGen },
  window: { label: "Window frame", cat: "opening", mount: "opening", size: [1.6, 0.22, 1.25], params: [["cols", "panes across", 2, "int"], ["rows", "panes up", 1, "int"],
    ["frame", "frame width", 0.06, "m"], ["frame_d", "frame depth", 0.07, "m"], ["mullion", "mullion", 0.05, "m"], ["sash", "sash width (0: none)", 0.045, "m"],
    ["slide", "sliding sashes", true, "bool"], ["wall", "wall thickness", 0.1, "m"], ["stool", "inside sill depth", 0.12, "m"], ["stool_t", "sill thickness", 0.025, "m"],
    ["slot", "frame material", "frame", "slot"], ["stool_slot", "sill material", "body", "slot"]], gen: windowGen },
  curtain: { label: "Curtain", cat: "curtain", mount: "back", size: [1.8, 0.14, 2.3], params: [["panels", "panels", 2, "int"], ["open", "drawn open (0 to 1)", 0.3, "num"],
    ["pitch", "fold every", 0.11, "m"], ["thick", "cloth", 0.004, "mm"], ["rail", "rail", 0.03, "m"], ["hem", "above the floor", 0.015, "m"], ["seed", "seed", 1, "int"],
    ["slot", "material", "fabric", "slot"]], gen: curtainGen },
  slats: { label: "Slats: radiator, vent, louvre", cat: "wall", mount: "back", size: [1.0, 0.1, 0.5], params: [["n", "slats", 16, "int"], ["dir", "slats run", "v", "pick", ["v", "h"]],
    ["slat_t", "slat thickness", 0.008, "mm"], ["frame", "frame", 0.02, "m"], ["back_plate", "back plate", true, "bool"], ["slot", "material", "white", "slot"]], gen: slatsGen },
  table: { label: "Table / desk / bench", cat: "furniture", mount: "floor", size: [1.4, 0.8, 0.72], params: [["top_t", "top thickness", 0.03, "m"], ["leg", "leg size", 0.05, "m"],
    ["leg_in", "legs in from the edge", 0.04, "m"], ["apron", "apron", 0.08, "m"], ["shelf", "low shelf at", 0, "m"], ["bevel", "edge bevel", 0.002, "mm"],
    ["slot", "top material", "wood", "slot"], ["leg_slot", "leg material", "wood", "slot"]], gen: tableGen },
  bed: { label: "Bed", cat: "furniture", mount: "back", size: [1.4, 2.05, 0.95], params: [["top", "mattress top", 0.5, "m"], ["base", "base height", 0.25, "m"],
    ["kick_in", "base set in", 0.05, "m"], ["headboard", "headboard (the full height)", true, "bool"], ["head_t", "headboard thickness", 0.06, "m"], ["pillows", "pillows", 2, "int"], ["duvet", "duvet (0 to 1 of the length)", 0.7, "num"],
    ["bevel", "softness", 0.03, "m"], ["slot", "frame material", "wood", "slot"], ["mattress", "mattress material", "fabric_2", "slot"], ["duvet_slot", "duvet material", "fabric", "slot"]], gen: bedGen },
  sofa: { label: "Sofa", cat: "furniture", mount: "back", size: [2.1, 0.92, 0.8], params: [["seats", "seat cushions", 3, "int"], ["seat_h", "seat height", 0.42, "m"],
    ["arm", "arm width (0: none)", 0.16, "m"], ["arm_h", "arm height", 0.6, "m"], ["back_t", "back frame", 0.12, "m"], ["legs", "legs", 0.06, "m"],
    ["chaise", "chaise (an end seat run long)", "none", "pick", ["none", "left", "right"]], ["depth", "depth beside a chaise", 0.92, "m"],
    ["gap", "cushion gap", 0.006, "mm"], ["bevel", "softness", 0.035, "m"], ["slot", "material", "fabric", "slot"], ["leg_slot", "leg material", "black", "slot"]], gen: sofaGen },
  bulkhead: { label: "Ceiling step / curtain pocket", cat: "ceiling", mount: "room-ceiling", size: [3.6, 3.6, 0.12], params: [["border", "step width n, e, s, w", [0.35, 0.35, 0.35, 0.35], "m4"],
    ["pocket", "curtain pocket on", "none", "pick", ["none", "n", "e", "s", "w"]], ["pocket_w", "pocket width", 0.13, "m"], ["slot", "material", "body", "slot"]], gen: bulkheadGen },
  block: { label: "Block: a step, a plinth, a board", cat: "furniture", mount: "floor", size: [1.2, 0.3, 0.18], params: [["bevel", "edge bevel", 0.003, "mm"],
    ["nosing", "nosing (front lip)", 0, "m"], ["slot", "material", "wood", "slot"]], gen: blockGen },
  parts: { label: "Free parts (any furniture)", cat: "furniture", mount: "floor", size: [0.6, 0.6, 0.6], params: [["parts", "parts", [{ s: "box", at: [0, 0, 0], size: [0.6, 0.6, 0.6], m: "body", b: 0.003 }], "parts"]], gen: partsGen },
};
export const CATS = { floor: "Floors", cabinet: "Cabinets and built-ins", furniture: "Furniture", wall: "On and in the walls", fitting: "Wall fittings",
  ceiling: "Ceilings", opening: "Windows", curtain: "Curtains" };

// ---- specs: presets merged under a spec, defaults filled ---------------------------------------------------------
const META = new Set(["label", "cat", "mount", "z", "note", "user"]);
export function resolve(spec, presets) {
  if (typeof spec === "string") spec = { preset: spec };
  const out = {};
  if (spec && spec.preset) {
    const p = (presets || {})[spec.preset];
    if (!p) throw new Error(`no kit preset ${spec.preset}`);
    for (const [k, v] of Object.entries(p)) if (!META.has(k)) out[k] = clone(v);
  }
  for (const [k, v] of Object.entries(spec || {})) if (k !== "preset" && !META.has(k)) out[k] = clone(v);
  if (!TYPES[out.type]) throw new Error(`unknown kit type ${out.type} (${Object.keys(TYPES).join(", ")})`);
  return out;
}
export function withDefaults(s) {
  const T = TYPES[s.type], o = { type: s.type, size: (s.size || T.size).slice() };
  for (const [k, , def] of T.params) o[k] = s[k] === undefined ? clone(def) : s[k];
  return o;
}
const clone = v => v === undefined ? v : JSON.parse(JSON.stringify(v));

// the canonical text of a resolved spec (numbers in micrometres), its hash names its mesh: kit/<type>_<hash>.
// storykit/kit.py writes the same text, so the importer and this agree on the file without asking each other.
export function canon(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(Math.round(v * 1e6));
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}

// ---- building: a spec -> parts -> one mesh per material slot -------------------------------------------------------
export function build(spec, presets) {
  const s = withDefaults(resolve(spec, presets));
  const P = [], warn = [];
  const R = rng(s.seed ?? 1);
  s.size = s.size.map(v => Math.max(0.001, +v || 0.001));
  TYPES[s.type].gen(s, P, R, warn);
  return { spec: s, parts: P, warn };
}

// the parts as triangles: {slot: {pos, nrm, uv, idx}} in metres, local space (front -y, z up)
export function mesh(parts) {
  const G = {};
  const buf = m => G[m] || (G[m] = { pos: [], nrm: [], uv: [], idx: [] });
  for (const p of parts) (p.s === "cyl" ? cylFaces : boxFaces)(p, buf);
  return G;
}
function xform(p) {              // part space (centred on its at) -> item space
  const a = (p.rz || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return ([x, y, z]) => [p.at[0] + x * c - y * s, p.at[1] + x * s + y * c, p.at[2] + z];
}
function emit(B, pts, n, uvs, xf, rz) {
  const a = (rz || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const nn = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
  const P = pts.map(xf);
  const e1 = P[1].map((v, i) => v - P[0][i]), e2 = P[2].map((v, i) => v - P[0][i]);
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  let order = P.map((_, i) => i);
  if (cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] < 0) order = order.reverse();
  const base = B.pos.length / 3;
  for (const i of order) { B.pos.push(...P[i]); B.nrm.push(...nn); B.uv.push(...uvs[i]); }
  for (let i = 1; i + 1 < order.length; i++) B.idx.push(base, base + i, base + i + 1);
}
function uvFor(p, pt, n) {         // box projection in metres, in item space before the part turns: textures at real scale
  const x = pt[0] + p.at[0], y = pt[1] + p.at[1], z = pt[2] + p.at[2];
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  let u, v;
  if (az >= ax && az >= ay) { u = x; v = y; } else if (ay >= ax) { u = x; v = z; } else { u = y; v = z; }
  const o = p.uv || [0, 0, 0];
  return o[2] ? [v + o[1], u + o[0]] : [u + o[0], v + o[1]];
}
function boxFaces(p, buf) {
  const B = buf(p.m), xf = xform(p);
  const h = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2], off = [0, 0, h[2]];
  const r = clamp(p.b || 0, 0, Math.min(...h) * 0.95);
  const skip = p.skip || "";
  const at = (v) => [v[0] + off[0], v[1] + off[1], v[2] + off[2]];
  const face = (pts, n) => emit(B, pts.map(at), n, pts.map(q => uvFor(p, at(q), n)), xf, p.rz);
  const inner = (k, s) => s * (h[k] - r);
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {           // the six faces, inset by the bevel
    if (skip.includes((s < 0 ? "-" : "+") + "xyz"[k])) continue;
    const [k1, k2] = [(k + 1) % 3, (k + 2) % 3], pts = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const v = [0, 0, 0]; v[k] = s * h[k]; v[k1] = inner(k1, a); v[k2] = inner(k2, b); pts.push(v); }
    const n = [0, 0, 0]; n[k] = s; face(pts, n);
  }
  if (r < 1e-5) return;
  for (let k = 0; k < 3; k++) {                                       // twelve edge strips
    const [k1, k2] = [(k + 1) % 3, (k + 2) % 3];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const pt = (t, full1) => { const v = [0, 0, 0]; v[k] = inner(k, t); v[k1] = full1 ? s1 * h[k1] : inner(k1, s1); v[k2] = full1 ? inner(k2, s2) : s2 * h[k2]; return v; };
      const n = [0, 0, 0]; n[k1] = s1 * Math.SQRT1_2; n[k2] = s2 * Math.SQRT1_2;
      face([pt(-1, true), pt(1, true), pt(1, false), pt(-1, false)], n);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {   // eight corners
    const S = [sx, sy, sz], q = 1 / Math.sqrt(3), pts = [];
    for (let k = 0; k < 3; k++) { const v = [0, 0, 0]; for (let j = 0; j < 3; j++) v[j] = j === k ? S[j] * h[j] : inner(j, S[j]); pts.push(v); }
    face(pts, [sx * q, sy * q, sz * q]);
  }
}
function cylFaces(p, buf) {
  const B = buf(p.m), Bi = buf(p.m2 || p.m), n = p.n || (p.size[0] > 0.3 ? 32 : 20);
  const r = p.size[0] / 2, ri = clamp(p.ri || 0, 0, r * 0.99), L = p.size[2], ax = p.axis || "z";
  const map = ([u, v, t]) => ax === "-y" ? [u, -t, v] : ax === "-z" ? [u, v, -t] : [u, v, t];
  const xf0 = xform(p), xf = q => xf0(map(q));
  const nm = q => map(q);
  const ring = (rad, t) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [Math.cos(a) * rad, Math.sin(a) * rad, t]; });
  const uv = (q, nn) => uvFor(p, xf0(map(q)).map((v, i) => v - p.at[i]), nm(nn));
  const quad = (T, q, nn, flipOut) => emit(T, q, nm(nn), q.map(x => uv(x, nn)), xf, p.rz);
  const o0 = ring(r, 0), o1 = ring(r, L), i0 = ri ? ring(ri, 0) : null, i1 = ri ? ring(ri, L) : null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = (i + 0.5) / n * Math.PI * 2, nn = [Math.cos(a), Math.sin(a), 0];
    quad(B, [o0[i], o0[j], o1[j], o1[i]], nn);
    if (ri) quad(Bi, [i0[i], i1[i], i1[j], i0[j]], [-nn[0], -nn[1], 0]);
  }
  for (const [T, ringO, ringI, nz] of [[0, o0, i0, -1], [L, o1, i1, 1]]) {
    if (!ri) { emit(B, ringO.slice(), nm([0, 0, nz]), ringO.map(x => uv(x, [0, 0, nz])), xf, p.rz); continue; }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; quad(B, [ringO[i], ringO[j], ringI[j], ringI[i]], [0, 0, nz]); }
  }
}

// ---- floors and wall cladding: tiles, planks, tatami ---------------------------------------------------------------
// a layout is rectangles [u0, v0, u1, v1, along] in a region U × V; then each is clipped, inset by its share of the gap
// (each side its own, from the seed: no two joints alike), raised a hair at random (lippage) and given a tone and a
// texture offset of its own.
function startOf(len, tile, align) {
  if (align === "corner") return 0;
  const c = align === "line" ? len / 2 : len / 2 - tile / 2;
  let s = c % tile; if (s > 0) s -= tile; return s;
}
function gridLayout(U, V, tw, tl, step, align) {
  const out = [], v0 = startOf(V, tl, align);
  for (let r = 0, v = v0; v < V; r++, v += tl) {
    const shift = ((r * step) % 1) * tw, u0 = startOf(U, tw, align) - shift;
    for (let u = u0 - tw; u < U; u += tw) out.push([u, v, u + tw, v + tl, "u"]);
  }
  return out;
}
function randomRows(U, V, bw, lmin, lmax, stagger, R, align) {
  const out = []; let prev = [];
  for (let v = startOf(V, bw, align); v < V; v += bw) {
    const joints = [];
    let u = -R() * lmax;
    while (u < U) {
      let L = lmin + R() * (lmax - lmin);
      for (let t = 0; t < 8 && prev.some(j => Math.abs(u + L - j) < stagger); t++) L = lmin + R() * (lmax - lmin);
      out.push([u, v, u + L, v + bw, "u"]); u += L; joints.push(u);
    }
    prev = joints;
  }
  return out;
}
function herringbone(U, V, W, L) {
  L = Math.max(2, Math.round(L / W)) * W;
  const out = [], kmin = Math.floor(-(U + V + 2 * L) / W) - 2, kmax = Math.ceil((V + L) / W) + 2;
  for (let k = kmin; k <= kmax; k++) {
    const b0 = Math.floor((-2 * L - k * W) / (2 * L)) - 1, b1 = Math.ceil((U - k * W) / (2 * L)) + 1;
    for (let b = b0; b <= b1; b++) {
      const x = b * 2 * L + k * W, y = k * W;
      out.push([x, y, x + L, y + W, "u"], [x, y + W, x + W, y + W + L, "v"]);
    }
  }
  return out;
}
function surface(s, P, R, rects, look) {
  const wall = s.orient === "wall", [w, d, h] = s.size;
  const U = w, V = wall ? h : d, T = wall ? d : h;
  const g = Math.max(0, s.gap), gv = clamp(s.gap_var, 0, 1), groove = clamp(s.groove ?? 0.002, 0, T * 0.8);
  const swap = +s.angle === 90 && !wall, RU = swap ? V : U, RV = swap ? U : V;     // the region the layout was made on
  const put = (a0, b0, a1, b1, t0, t1, m, o) => {
    const [u0, v0, u1, v1] = swap ? [b0, a0, b1, a1] : [a0, b0, a1, b1];
    return wall ? bx(P, u0 - U / 2, d / 2 - t1, v0, u1 - U / 2, d / 2 - t0, v1, m, Object.assign({ skip: "+y" }, o))
                : bx(P, u0 - U / 2, v0 - V / 2, t0, u1 - U / 2, v1 - V / 2, t1, m, Object.assign({ skip: "-z" }, o));
  };
  put(0, 0, RU, RV, 0, T - groove, s.base || "grout");
  const top = T - groove - 0.0005;
  for (const [a0, b0, a1, b1, along] of rects) {
    const half = () => g / 2 * (1 + gv * (2 * R() - 1));
    let u0 = Math.max(a0, 0), v0 = Math.max(b0, 0), u1 = Math.min(a1, RU), v1 = Math.min(b1, RV);
    if (u1 - u0 < 0.004 || v1 - v0 < 0.004) continue;
    u0 += a0 >= 0 ? half() : 0; u1 -= a1 <= RU ? half() : 0; v0 += b0 >= 0 ? half() : 0; v1 -= b1 <= RV ? half() : 0;
    if (u1 - u0 < 0.004 || v1 - v0 < 0.004) continue;
    const t1 = T + (s.lip || 0) * R(), m = tone(s.slot || look, Math.max(1, s.tones || 1), R);
    const p = put(u0, v0, u1, v1, top, t1, m, { b: s.bevel, uv: [+(R() * 4).toFixed(3), +(R() * 4).toFixed(3), (along === "v") !== swap ? 1 : 0] });
    if (p && s._each) s._each(p, t1);
  }
}
function region(s) {                       // the laid-out region: turned 90° when the pattern runs the other way
  const wall = s.orient === "wall", [w, d, h] = s.size;
  const U = w, V = wall ? h : d;
  return +s.angle === 90 && !wall ? [V, U] : [U, V];
}
function tilesGen(s, P, R) {
  const [U, V] = region(s), [tw, tl] = s.tile.map(v => Math.max(0.02, v));
  const step = { grid: 0, half: 0.5, third: 1 / 3, random: 0, herringbone: 0 }[s.pattern] ?? 0;
  const rects = s.pattern === "herringbone" ? herringbone(U, V, Math.min(tw, tl), Math.max(tw, tl))
              : s.pattern === "random" ? randomRows(U, V, tl, tw * 0.5, tw * 1.5, tw * 0.2, R, s.align) : gridLayout(U, V, tw, tl, step, s.align);
  surface(s, P, R, rects, "tile");
}
function planksGen(s, P, R) {
  const [U, V] = region(s), bw = Math.max(0.03, s.board), [lmin, lmax] = [Math.max(0.1, Math.min(...s.length)), Math.max(0.1, ...s.length)];
  const rects = s.pattern === "herringbone" ? herringbone(U, V, bw, lmax)
              : s.pattern === "half" || s.pattern === "third" ? gridLayout(U, V, lmax, bw, s.pattern === "half" ? 0.5 : 1 / 3, s.align)
              : randomRows(U, V, bw, lmin, lmax, s.stagger, R, s.align);
  surface(s, P, R, rects, "wood");
}
function tatamiGen(s, P, R) {
  const [mw, ml] = [Math.min(...s.mat), Math.max(...s.mat)];
  const t = Object.assign({}, s, { orient: "floor", align: "corner", groove: 0.02, lip: 0.001, tones: 1, slot: "tatami", base: "gap" });
  const [U, V] = region(t);
  t._each = (p, z1) => {                                       // the heri: cloth borders down the long edges of each mat
    const hw = Math.min(s.heri, Math.min(p.size[0], p.size[1]) / 3); if (hw <= 0) return;
    const [x0, y0, x1, y1] = [p.at[0] - p.size[0] / 2, p.at[1] - p.size[1] / 2, p.at[0] + p.size[0] / 2, p.at[1] + p.size[1] / 2];
    const longX = p.size[0] >= p.size[1];
    if (longX) { bx(P, x0, y0, z1 - 0.004, x1, y0 + hw, z1 + 0.001, "heri"); bx(P, x0, y1 - hw, z1 - 0.004, x1, y1, z1 + 0.001, "heri"); }
    else { bx(P, x0, y0, z1 - 0.004, x0 + hw, y1, z1 + 0.001, "heri"); bx(P, x1 - hw, y0, z1 - 0.004, x1, y1, z1 + 0.001, "heri"); }
  };
  t.size = [s.size[0], s.size[1], s.size[2] - 0.002];
  surface(t, P, R, gridLayout(U, V, ml, mw, 0.5, "corner"), "tatami");
}

function rugGen(s, P, R) {
  const [w, d, h] = s.size, f = clamp(s.fringe, 0, w / 4), bw = clamp(s.border, 0, Math.min(w, d) / 3);
  const x0 = -w / 2 + f, x1 = w / 2 - f;
  bx(P, x0, -d / 2, 0, x1, d / 2, h - (bw ? 0.0008 : 0), bw ? s.border_slot : s.slot, { b: s.bevel, skip: "-z" });
  if (bw) bx(P, x0 + bw, -d / 2 + bw, h - 0.0012, x1 - bw, d / 2 - bw, h, s.slot, { b: Math.min(s.bevel, 0.001), skip: "-z" });
  if (f > 0.005) {
    const n = Math.max(2, Math.round(d * s.fringe_n)), sw = Math.min(0.004, d / n * 0.5);
    for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
      const y = -d / 2 + (i + 0.5) * d / n, len = f * (0.85 + 0.15 * R()), xa = side < 0 ? x0 - len : x1, xb = side < 0 ? x0 : x1 + len;
      bx(P, xa, y - sw / 2, 0, xb, y + sw / 2, Math.min(h, 0.003), s.border_slot, { skip: "-z" });
    }
  }
}

// ---- cabinets: frameless fronts with real reveals, carcass, kick, open shelves, drawers, sliding doors ------------
function colsOf(s, W) {
  const cols = (s.cols && s.cols.length ? s.cols : [{ k: "doors" }]).map(c => Object.assign({ k: "door", w: 0, n: 0, split: 0, up: "door" }, c));
  const fixed = cols.reduce((a, c) => a + (c.w > 0 ? c.w : 0), 0), free = cols.filter(c => !(c.w > 0)).length;
  const each = free ? Math.max(0.05, (W - fixed) / free) : 0;
  let x = -W / 2;
  const k = free ? 1 : W / Math.max(0.01, fixed);
  return cols.map(c => { const cw = c.w > 0 ? c.w * k : each; const o = Object.assign({}, c, { x0: x, x1: x + cw }); x += cw; return o; });
}
function cabinetGen(s, P, R, warn) {
  const [W, D, H] = s.size, ct = clamp(s.carcass, 0.005, 0.05), ft = clamp(s.front_t, 0.005, 0.05), rv = clamp(s.reveal, 0, 0.02);
  const topT = clamp(s.top, 0, H / 3), over = s.top ? clamp(s.top_over, 0, D / 3) : 0;
  const hp = { bar: 0.025, knob: 0.022, edge: 0.003 }[s.handle] || 0;                    // handles stand proud of the fronts
  const kick = clamp(s.kick, 0, H / 3), Hb = H - topT, fy0 = -D / 2 + Math.max(over, hp);   // the fronts' face
  const slide = !!s.slide, cy0 = fy0 + ft * (slide ? 2 : 1) + (slide ? 0.004 : 0);       // the carcass' face
  const cols = colsOf(s, W);
  if (topT) bx(P, -W / 2, -D / 2, Hb, W / 2, D / 2, H, s.top_slot, { b: 0.0015 });
  // dividers and ends, full height wherever the column beside them has a carcass
  const hasLow = c => c.k !== "void", hasUp = c => c.split > 0 && c.up !== "void";
  const span = c => hasLow(c) ? [kick, Hb] : hasUp(c) ? [Hb - c.split, Hb] : null;
  for (let i = 0; i <= cols.length; i++) {
    const L = cols[i - 1], Rt = cols[i], sp = [L && span(L), Rt && span(Rt)].filter(Boolean);
    if (!sp.length) continue;
    const z0 = Math.min(...sp.map(q => q[0])), z1 = Math.max(...sp.map(q => q[1]));
    const x = i === 0 ? -W / 2 : i === cols.length ? W / 2 - ct : (L.x1 - ct / 2);
    bx(P, x, cy0, z0, x + ct, D / 2, z1, s.body);
  }
  cols.forEach((c, ci) => {
    const xa = c.x0 + (ci === 0 ? ct : ct / 2), xb = c.x1 - (ci === cols.length - 1 ? ct : ct / 2);
    const parts = [];
    if (hasLow(c)) parts.push({ k: c.k, z0: kick, z1: c.split > 0 ? Hb - c.split : Hb, n: c.n, low: true });
    if (hasUp(c)) parts.push({ k: c.up, z0: Hb - c.split, z1: Hb, n: c.n_up || 0 });
    if (hasLow(c) && kick) bx(P, c.x0, fy0 + clamp(s.kick_in, 0, D / 2), 0, c.x1, D / 2 - ct, kick, s.body, { skip: "-z" });
    for (const q of parts) {
      bx(P, xa, cy0, q.z0, xb, D / 2 - ct, q.z0 + ct, s.body);                           // bottom
      bx(P, xa, cy0, q.z1 - ct, xb, D / 2 - ct, q.z1, s.body);                           // top
      bx(P, xa, D / 2 - ct, q.z0, xb, D / 2, q.z1, q.k === "open" ? s.inside : s.body);  // back
      const fx0 = c.x0 + (ci === 0 ? 0.0005 : rv / 2), fx1 = c.x1 - (ci === cols.length - 1 ? 0.0005 : rv / 2);
      const fz0 = q.z0 + rv / 2, fz1 = q.z1 - rv / 2 - (slide && q.z1 >= Hb - 1e-6 ? 0.02 : 0);   // under a sliding door's track
      if (q.k === "open") {
        const n = Math.max(0, q.n | 0);
        for (const [x0, x1] of [[xa, xa + 0.001], [xb - 0.001, xb]]) bx(P, x0, cy0 + 0.004, q.z0 + ct, x1, D / 2 - ct, q.z1 - ct, s.inside);
        bx(P, xa, cy0 + 0.004, q.z0 + ct, xb, D / 2 - ct, q.z0 + ct + 0.001, s.inside);
        bx(P, xa, cy0 + 0.004, q.z1 - ct - 0.001, xb, D / 2 - ct, q.z1 - ct, s.inside);
        for (let i = 1; i <= n; i++) { const z = q.z0 + ct + (q.z1 - q.z0 - 2 * ct) * i / (n + 1); bx(P, xa + 0.001, cy0 + 0.01, z - ct / 2, xb - 0.001, D / 2 - ct, z + ct / 2, s.inside); }
        continue;
      }
      if (q.k === "panel" || q.k === "door" || q.k === "doors" || q.k === "glass" || q.k === "drawers") fronts(s, P, c, ci, q, fx0, fx1, fz0, fz1, fy0, ft, slide, warn);
    }
  });
  if (slide) bx(P, -W / 2, fy0, Hb - 0.02, W / 2, cy0, Hb, s.handle_slot, { skip: "" });   // the track
}
function fronts(s, P, c, ci, q, x0, x1, z0, z1, fy0, ft, slide, warn) {
  const rv = s.reveal, b = s.bevel;
  let leaves = [];
  if (q.k === "drawers") {
    const n = Math.max(1, q.n | 0 || 3), hh = (z1 - z0 + rv) / n;
    for (let i = 0; i < n; i++) leaves.push({ x0, x1, z0: z1 - (i + 1) * hh + rv, z1: z1 - i * hh, drawer: true });
  } else if (q.k === "doors") {
    const m = (x0 + x1) / 2;
    leaves.push({ x0, x1: m - rv / 2, z0, z1, hinge: "l" }, { x0: m + rv / 2, x1, z0, z1, hinge: "r" });
  } else leaves.push({ x0, x1, z0, z1, hinge: ci % 2 ? "r" : "l", glass: q.k === "glass", panel: q.k === "panel" });
  if (slide && !leaves[0].drawer) {             // sliding: each column one panel, alternate tracks, overlapping a little
    const lap = 0.02, back = ci % 2 === 1;
    leaves = [{ x0: x0 - (ci ? lap : 0), x1: x1 + lap, z0, z1, slide: true, y0: back ? fy0 + ft + 0.004 : fy0 }];
    leaves[0].x1 = Math.min(leaves[0].x1, s.size[0] / 2);
  }
  for (const L of leaves) {
    if (L.x1 - L.x0 < 0.01 || L.z1 - L.z0 < 0.01) { warn.push("a front too small to draw"); continue; }
    const y0 = L.y0 ?? fy0;
    let top = L.z1;
    if (s.handle === "groove" && !L.panel && !L.slide) {           // a J-pull: the front stops short, a dark slot behind
      top = L.z1 - Math.min(0.025, (L.z1 - L.z0) / 4);
      bx(P, L.x0, y0 + ft * 0.6, top, L.x1, y0 + ft + 0.01, L.z1, s.inside);
    }
    if (L.glass) {
      const fw = Math.min(0.05, (L.x1 - L.x0) / 4);
      bx(P, L.x0, y0, L.z0, L.x0 + fw, y0 + ft, top, s.fronts, { b }); bx(P, L.x1 - fw, y0, L.z0, L.x1, y0 + ft, top, s.fronts, { b });
      bx(P, L.x0 + fw, y0, L.z0, L.x1 - fw, y0 + ft, L.z0 + fw, s.fronts, { b }); bx(P, L.x0 + fw, y0, top - fw, L.x1 - fw, y0 + ft, top, s.fronts, { b });
      bx(P, L.x0 + fw, y0 + ft * 0.4, L.z0 + fw, L.x1 - fw, y0 + ft * 0.6, top - fw, "glass");
    } else bx(P, L.x0, y0, L.z0, L.x1, y0 + ft, top, s.fronts, { b });
    if (L.panel) continue;
    const mid = (L.x0 + L.x1) / 2, hs = s.handle_slot;
    if (L.slide) {                                                // finger pulls down the edges that meet another panel
      const last = s.cols.length - 1, edges = ci === 0 ? [L.x1 - 0.06] : ci >= last ? [L.x0 + 0.04] : [L.x0 + 0.04, L.x1 - 0.06];
      for (const ex of (s.cols.length < 2 ? [L.x1 - 0.06] : edges)) bx(P, ex, y0 - 0.0015, Math.max(L.z0, 0.8), ex + 0.02, y0, Math.min(top, 1.3), hs);
      continue;
    }
    if (s.handle === "bar") {
      if (L.drawer) { const len = Math.min(0.32, (L.x1 - L.x0) * 0.5); bx(P, mid - len / 2, y0 - 0.025, top - 0.045, mid + len / 2, y0, top - 0.033, hs, { b: 0.002 }); }
      else { const ex = L.hinge === "l" ? L.x1 - 0.05 : L.x0 + 0.038, len = Math.min(0.32, (top - L.z0) * 0.4); const zc = clamp(1.0, L.z0 + len / 2 + 0.05, top - len / 2 - 0.05);
        bx(P, ex, y0 - 0.025, zc - len / 2, ex + 0.012, y0, zc + len / 2, hs, { b: 0.002 }); }
    } else if (s.handle === "knob") {
      const ex = L.drawer ? mid : L.hinge === "l" ? L.x1 - 0.045 : L.x0 + 0.045, zc = L.drawer ? top - 0.05 : clamp(1.0, L.z0 + 0.06, top - 0.06);
      cy(P, ex, y0, zc, 0.014, 0.022, hs, { axis: "-y", n: 14 });
    } else if (s.handle === "edge") bx(P, L.x0 + 0.01, y0 - 0.003, top - 0.006, L.x1 - 0.01, y0 + ft, top, hs);
  }
}

// ---- a build-out: a false wall in front of the real one, with recesses (a TV niche, a display nook) -------------
function buildoutGen(s, P) {
  const [W, D, H] = s.size, holes = (s.holes || []).map(o => ({ x0: clamp(o.x, 0, W), x1: clamp(o.x + o.w, 0, W), z0: clamp(o.z, 0, H), z1: clamp(o.z + o.h, 0, H), dp: clamp(o.depth, 0, D - 0.005), shelves: o.shelves | 0 }));
  const xs = [...new Set([0, W, ...holes.flatMap(o => [o.x0, o.x1])])].sort((a, b) => a - b);
  const zs = [...new Set([0, H, ...holes.flatMap(o => [o.z0, o.z1])])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) {
    let run = null;
    const flush = () => { if (run) bx(P, xs[i] - W / 2, run.y0, run.z0, xs[i + 1] - W / 2, D / 2, run.z1, run.m, { b: s.bevel, skip: "+y" }); run = null; };
    for (let j = 0; j + 1 < zs.length; j++) {
      const mx = (xs[i] + xs[i + 1]) / 2, mz = (zs[j] + zs[j + 1]) / 2;
      const hole = holes.find(o => mx > o.x0 && mx < o.x1 && mz > o.z0 && mz < o.z1);
      const y0 = hole ? -D / 2 + hole.dp : -D / 2, m = hole ? s.hole_slot : s.slot;
      if (run && run.y0 === y0 && run.m === m) run.z1 = zs[j + 1];
      else { flush(); run = { y0, m, z0: zs[j], z1: zs[j + 1] }; }
    }
    flush();
  }
  for (const o of holes) for (let k = 1; k <= o.shelves; k++) {
    const z = o.z0 + (o.z1 - o.z0) * k / (o.shelves + 1);
    bx(P, o.x0 - W / 2, -D / 2 + 0.01, z - 0.009, o.x1 - W / 2, -D / 2 + o.dp, z + 0.009, s.hole_slot);
  }
}

// ---- wall fittings: switch plates, sockets, panels with screens --------------------------------------------------
function plateGen(s, P) {
  const [W, D, H] = s.size, pr = Math.min(0.004, D / 3), b = s.bevel, n = Math.max(1, s.gangs | 0), mg = clamp(s.margin, 0, Math.min(W, H) / 3);
  bx(P, -W / 2, -D / 2 + pr, 0, W / 2, D / 2, H, s.slot, { b, skip: "+y" });
  const fy = -D / 2 + pr, col = s.layout === "col";
  const cell = i => {                                              // the i-th switch or socket's area on the plate
    const iw = W - 2 * mg, ih = H - 2 * mg, g = 0.002;
    if (col) { const ch = (ih - g * (n - 1)) / n; const z1 = H - mg - i * (ch + g); return [-iw / 2, iw / 2, z1 - ch, z1]; }
    const cw = (iw - g * (n - 1)) / n, x0 = -iw / 2 + i * (cw + g); return [x0, x0 + cw, mg, H - mg];
  };
  for (let i = 0; i < n; i++) {
    const [x0, x1, z0, z1] = cell(i), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (s.kind === "switch") bx(P, x0, -D / 2, z0, x1, fy + 0.001, z1, s.slot, { b: Math.min(0.0015, b) });
    else if (s.kind === "socket_jp") {                              // a raised face, two flat slots, the earth hole
      bx(P, x0, fy - 0.002, z0, x1, fy + 0.001, z1, s.slot, { b: 0.001 });
      for (const dx of [-0.0065, 0.0065]) bx(P, mx + dx - 0.001, fy - 0.0025, mz - 0.0035 + 0.003, mx + dx + 0.001, fy - 0.0015, mz + 0.0035 + 0.003, "hole");
      cy(P, mx, fy - 0.0015, mz - 0.007, 0.002, 0.001, "hole", { axis: "-y", n: 10 });
    } else if (s.kind === "socket_eu") {                            // a round well with two pin holes
      const r = Math.min(x1 - x0, z1 - z0) * 0.42;
      cy(P, mx, fy + 0.0005, mz, r, 0.0035, s.slot, { axis: "-y", ri: r * 0.85, m2: "hole", n: 28 });
      cy(P, mx, fy + 0.0005, mz, r * 0.86, 0.0004, "white", { axis: "-y", n: 24 });
      for (const dx of [-0.0095, 0.0095]) cy(P, mx + dx, fy - 0.0001, mz, 0.0024, 0.0004, "hole", { axis: "-y", n: 10 });
    } else if (s.kind === "screen") {
      if (i === 0) { const sh = (H - 2 * mg) * 0.55; bx(P, -W / 2 + mg, fy - 0.0008, H - mg - sh, W / 2 - mg, fy + 0.001, H - mg, "screen"); }
      const bw = Math.min(0.012, (W - 2 * mg) / n * 0.6), bxc = -W / 2 + mg + (W - 2 * mg) * (i + 0.5) / n;
      cy(P, bxc, fy, mg + 0.012, bw / 2, 0.002, s.slot, { axis: "-y", n: 12 });
    }
  }
}
function panelGen(s, P) {
  const [W, D, H] = s.size, fw = clamp(s.frame, 0, Math.min(W, H) / 3), back = clamp(s.back, 0, D - 0.004), mat = clamp(s.mat, 0, Math.min(W, H) / 3);
  const fd = D - back, y1 = -D / 2 + fd;
  if (back) bx(P, -W * 0.38, y1, H * 0.12, W * 0.38, D / 2, H * 0.88, s.frame_slot);
  if (fw) {
    bx(P, -W / 2, -D / 2, 0, -W / 2 + fw, y1, H, s.frame_slot, { b: s.bevel }); bx(P, W / 2 - fw, -D / 2, 0, W / 2, y1, H, s.frame_slot, { b: s.bevel });
    bx(P, -W / 2 + fw, -D / 2, 0, W / 2 - fw, y1, fw, s.frame_slot, { b: s.bevel }); bx(P, -W / 2 + fw, -D / 2, H - fw, W / 2 - fw, y1, H, s.frame_slot, { b: s.bevel });
  }
  const fy = fw ? -D / 2 + Math.min(0.004, fd / 3) : -D / 2;
  if (mat) { bx(P, -W / 2 + fw, fy + 0.002, fw, W / 2 - fw, y1, H - fw, "white"); bx(P, -W / 2 + fw + mat, fy, fw + mat, W / 2 - fw - mat, fy + 0.0025, H - fw - mat, s.face); }
  else bx(P, -W / 2 + fw, fy, fw, W / 2 - fw, y1, H - fw, s.face, { b: fw ? 0 : s.bevel });
}
function downlightGen(s, P) {
  const [W, D, H] = s.size, t = clamp(s.trim, 0.002, Math.min(W, D) / 3), lin = clamp(s.lens_in, 0, H - 0.001);
  if (s.shape === "square") {
    bx(P, -W / 2, -D / 2, 0, W / 2, -D / 2 + t, H, s.slot); bx(P, -W / 2, D / 2 - t, 0, W / 2, D / 2, H, s.slot);
    bx(P, -W / 2, -D / 2 + t, 0, -W / 2 + t, D / 2 - t, H, s.slot); bx(P, W / 2 - t, -D / 2 + t, 0, W / 2, D / 2 - t, H, s.slot);
    bx(P, -W / 2 + t, -D / 2 + t, lin, W / 2 - t, D / 2 - t, lin + 0.002, "emit");
  } else {
    const r = Math.min(W, D) / 2;
    cy(P, 0, 0, H, r, H, s.slot, { axis: "-z", ri: r - t, m2: "inner" });
    cy(P, 0, 0, H - (H - lin) + 0.002, r - t + 0.0005, 0.002, "emit", { axis: "-z" });
    cy(P, 0, 0, H, r - t + 0.0005, 0.001, "inner", { axis: "-z" });
  }
}

// ---- a window's frame for its opening: outer frame, mullions, sashes (sliding ones on two tracks), glass, inside sill
function windowGen(s, P) {
  const [W, D, H] = s.size, st = s.stool > 0 ? clamp(s.stool_t, 0.005, H / 4) : 0, fw = clamp(s.frame, 0.01, Math.min(W, H) / 4);
  const fd = clamp(s.frame_d, 0.02, D), yc = D / 2 - clamp(s.wall, 0.02, D) / 2, fy0 = Math.max(-D / 2, yc - fd / 2), fy1 = Math.min(D / 2, yc + fd / 2);
  const z0 = st, z1 = H, slot = s.slot;
  if (st) bx(P, -W / 2 - 0, -D / 2, 0, W / 2, fy0 + 0.001, st, s.stool_slot, { b: 0.002 });
  bx(P, -W / 2, fy0, z0, W / 2, fy1, z0 + fw, slot); bx(P, -W / 2, fy0, z1 - fw, W / 2, fy1, z1, slot);
  bx(P, -W / 2, fy0, z0 + fw, -W / 2 + fw, fy1, z1 - fw, slot); bx(P, W / 2 - fw, fy0, z0 + fw, W / 2, fy1, z1 - fw, slot);
  const nc = Math.max(1, s.cols | 0), nr = Math.max(1, s.rows | 0), mw = clamp(s.mullion, 0.005, 0.2), sw = clamp(s.sash, 0, 0.15);
  const ix0 = -W / 2 + fw, ix1 = W / 2 - fw, iz0 = z0 + fw, iz1 = z1 - fw, slide = !!s.slide && nc > 1;
  const pw = slide ? (ix1 - ix0) / nc : (ix1 - ix0 - mw * (nc - 1)) / nc, ph = (iz1 - iz0 - mw * (nr - 1)) / nr;
  if (!slide) for (let i = 1; i < nc; i++) { const x = ix0 + i * pw + (i - 1) * mw; bx(P, x, fy0 + 0.005, iz0, x + mw, fy1 - 0.005, iz1, slot); }
  for (let j = 1; j < nr; j++) { const z = iz0 + j * ph + (j - 1) * mw; bx(P, ix0, fy0 + 0.005, z, ix1, fy1 - 0.005, z + mw, slot); }
  const sd = Math.min(0.04, (fy1 - fy0) / 2 - 0.004);
  for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) {
    let x0 = ix0 + i * (pw + (slide ? 0 : mw)), x1 = x0 + pw;
    const za = iz0 + j * (ph + mw), zb = za + ph;
    let ya = yc - sd / 2, yb = yc + sd / 2;
    if (slide) { const lap = sw / 2; if (i > 0) x0 -= lap; if (i < nc - 1) x1 += lap; const off = (i % 2 ? 1 : -1) * (sd / 2 + 0.002); ya += off; yb += off; }
    if (sw > 0) {
      bx(P, x0, ya, za, x0 + sw, yb, zb, slot); bx(P, x1 - sw, ya, za, x1, yb, zb, slot);
      bx(P, x0 + sw, ya, za, x1 - sw, yb, za + sw, slot); bx(P, x0 + sw, ya, zb - sw, x1 - sw, yb, zb, slot);
      bx(P, x0 + sw, (ya + yb) / 2 - 0.003, za + sw, x1 - sw, (ya + yb) / 2 + 0.003, zb - sw, "glass");
    } else bx(P, x0, (ya + yb) / 2 - 0.003, za, x1, (ya + yb) / 2 + 0.003, zb, "glass");
  }
}

// ---- soft things and furniture -------------------------------------------------------------------------------------
function curtainGen(s, P, R) {
  const [W, D, H] = s.size, th = clamp(s.thick, 0.001, D / 4), rail = clamp(s.rail, 0, H / 4), z0 = clamp(s.hem, 0, H / 4), z1 = H - rail;
  if (rail) bx(P, -W / 2, -D / 2, z1, W / 2, D / 2, H, "metal");
  const np = Math.max(1, s.panels | 0), open = clamp(s.open, 0, 0.9), pw = W * (1 - open) / np, a = D / 2 - th;
  const starts = np === 1 ? [-W / 2] : [-W / 2, W / 2 - pw];
  for (const x0 of starts.slice(0, np)) {
    const n = Math.max(2, Math.round(pw / clamp(s.pitch, 0.03, 0.5)) * 2), step = pw / n;
    const ys = Array.from({ length: n + 1 }, (_, k) => (k % 2 ? a : -a) * (0.7 + 0.3 * R()));   // the folds' crests, each its own depth
    for (let k = 0; k < n; k++) {
      const xa = x0 + k * step, xb = xa + step, ya = ys[k], yb = ys[k + 1];
      const len = Math.hypot(xb - xa, yb - ya) + th, ang = Math.atan2(yb - ya, xb - xa) * 180 / Math.PI;
      P.push({ s: "box", at: [(xa + xb) / 2, (ya + yb) / 2, z0], size: [len, th, z1 - z0], m: s.slot, rz: ang, uv: [k * 0.37, 0, 0] });
    }
  }
}
function slatsGen(s, P) {
  const [W, D, H] = s.size, f = clamp(s.frame, 0, Math.min(W, H) / 3), n = Math.max(1, s.n | 0), t = clamp(s.slat_t, 0.001, 0.05);
  if (s.back_plate) bx(P, -W / 2, D / 2 - 0.004, 0, W / 2, D / 2, H, s.slot, { skip: "+y" });
  if (f) { bx(P, -W / 2, -D / 2, 0, -W / 2 + f, D / 2, H, s.slot, { b: 0.002 }); bx(P, W / 2 - f, -D / 2, 0, W / 2, D / 2, H, s.slot, { b: 0.002 });
           bx(P, -W / 2 + f, -D / 2, 0, W / 2 - f, D / 2, f, s.slot, { b: 0.002 }); bx(P, -W / 2 + f, -D / 2, H - f, W / 2 - f, D / 2, H, s.slot, { b: 0.002 }); }
  const v = s.dir === "v", L = v ? W - 2 * f : H - 2 * f;
  for (let i = 0; i < n; i++) {
    const c = -L / 2 + (i + 0.5) * L / n;
    if (v) bx(P, c - t / 2, -D / 2 + 0.002, f, c + t / 2, D / 2 - 0.004, H - f, s.slot);
    else bx(P, -W / 2 + f, -D / 2 + 0.002, H / 2 + c - t / 2, W / 2 - f, D / 2 - 0.004, H / 2 + c + t / 2, s.slot);
  }
}
function tableGen(s, P) {
  const [W, D, H] = s.size, tt = clamp(s.top_t, 0.005, H / 3), lg = clamp(s.leg, 0.01, Math.min(W, D) / 3), li = clamp(s.leg_in, 0, Math.min(W, D) / 3);
  bx(P, -W / 2, -D / 2, H - tt, W / 2, D / 2, H, s.slot, { b: s.bevel });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * (W / 2 - li - lg / 2), y = sy * (D / 2 - li - lg / 2);
    bx(P, x - lg / 2, y - lg / 2, 0, x + lg / 2, y + lg / 2, H - tt, s.leg_slot, { b: Math.min(0.002, s.bevel) });
  }
  const ap = clamp(s.apron, 0, H / 3);
  if (ap) {                                                      // aprons between the legs, on the legs' middle line
    const xa = W / 2 - li - lg, ya = D / 2 - li - lg, xl = W / 2 - li - lg / 2, yl = D / 2 - li - lg / 2, t = Math.min(0.02, lg * 0.6);
    for (const sy of [-1, 1]) bx(P, -xa, sy * yl - t / 2, H - tt - ap, xa, sy * yl + t / 2, H - tt, s.leg_slot);
    for (const sx of [-1, 1]) bx(P, sx * xl - t / 2, -ya, H - tt - ap, sx * xl + t / 2, ya, H - tt, s.leg_slot);
  }
  if (s.shelf > 0) bx(P, -W / 2 + li + lg, -D / 2 + li + lg, s.shelf, W / 2 - li - lg, D / 2 - li - lg, s.shelf + 0.02, s.slot, { b: 0.001 });
}
function bedGen(s, P) {
  const [W, D, H] = s.size, top = clamp(s.top, 0.15, H), base = clamp(s.base, 0.05, top - 0.08), ki = clamp(s.kick_in, 0, 0.2);
  const ht = s.headboard ? clamp(s.head_t, 0.02, 0.2) : 0, sb = clamp(s.bevel, 0, 0.08), y0 = -D / 2, y1 = D / 2 - ht;
  if (ht) bx(P, -W / 2, D / 2 - ht, 0, W / 2, D / 2, H, s.slot, { b: 0.004 });
  bx(P, -W / 2 + ki, y0 + ki, 0, W / 2 - ki, y1, base * 0.35, "black");                       // the plinth, in shadow
  bx(P, -W / 2, y0, base * 0.35, W / 2, y1, base, s.slot, { b: 0.004 });
  bx(P, -W / 2 + 0.01, y0 + 0.01, base, W / 2 - 0.01, y1 - 0.005, top - 0.03, s.mattress, { b: sb });
  const dv = clamp(s.duvet, 0, 1);
  if (dv > 0) bx(P, -W / 2, y0, top - 0.05, W / 2, y0 + (y1 - y0) * dv, top, s.duvet_slot, { b: Math.min(sb, 0.024), skip: "-z" });
  const np = Math.max(0, s.pillows | 0), pz = Math.min(H, top + 0.12);
  for (let i = 0; i < np && pz > top; i++) {
    const pw = (W - 0.08) / np, x0 = -W / 2 + 0.04 + i * pw;
    bx(P, x0 + 0.01, y1 - 0.42, top - 0.03, x0 + pw - 0.01, y1 - 0.05, pz, "white", { b: Math.min(0.05, sb * 1.5) });
  }
}
function sofaGen(s, P) {
  const [W, D, H] = s.size, lg = clamp(s.legs, 0, 0.2), sh = clamp(s.seat_h, lg + 0.14, H - 0.1), aw = clamp(s.arm, 0, W / 4), ah = clamp(s.arm_h, sh, H);
  const bt = clamp(s.back_t, 0.06, D / 3), sb = clamp(s.bevel, 0, 0.08), g = clamp(s.gap, 0, 0.03), n = Math.max(1, s.seats | 0);
  const ch = s.chaise === "left" ? 0 : s.chaise === "right" ? n - 1 : -1;               // the chaise is the end cushion, run long
  const yb = D / 2, yf = ch >= 0 ? yb - clamp(s.depth, 0.5, D) : -D / 2;
  const xa = -W / 2 + aw, xb = W / 2 - aw, cw = (xb - xa) / n, plinth = sh - 0.12, front = i => i === ch ? -D / 2 : yf;
  const cush = Math.min(0.14, (yb - bt - yf) / 4);                                       // the back cushions' thickness
  for (const [x, i] of [[-W / 2 + 0.05, 0], [W / 2 - 0.05, n - 1]]) for (const y of [yb - 0.06, front(i) + 0.06])
    if (lg) bx(P, x - 0.02, y - 0.02, 0, x + 0.02, y + 0.02, lg, s.leg_slot);
  for (let i = 0; i < n; i++) bx(P, xa + i * cw, front(i), lg, xa + (i + 1) * cw, yb, plinth, s.slot, { b: 0.01 });
  if (aw) { bx(P, -W / 2, front(0), lg, xa, yb, ah, s.slot, { b: sb * 0.8 }); bx(P, xb, front(n - 1), lg, W / 2, yb, ah, s.slot, { b: sb * 0.8 }); }
  bx(P, xa, yb - bt, plinth, xb, yb, H - 0.16, s.slot, { b: sb * 0.6 });
  for (let i = 0; i < n; i++) {
    const x0 = xa + i * cw + g / 2, x1 = xa + (i + 1) * cw - g / 2;
    bx(P, x0, front(i) + 0.005, plinth, x1, yb - bt - cush - g, sh, s.slot, { b: sb });
    bx(P, x0, yb - bt - cush, sh - 0.005, x1, yb - bt + 0.01, H, s.slot, { b: sb });
  }
}
function bulkheadGen(s, P) {
  const [W, D, H] = s.size, [bn, be, bs, bw] = (s.border || [0, 0, 0, 0]).map(v => clamp(+v || 0, 0, Math.min(W, D) / 2));
  const pk = s.pocket, pw = clamp(s.pocket_w, 0, 0.4), off = k => pk === k ? pw : 0;
  const yN = D / 2 - off("n"), yS = -D / 2 + off("s"), xE = W / 2 - off("e"), xW = -W / 2 + off("w");
  if (bn) bx(P, xW, yN - bn, 0, xE, yN, H, s.slot, { skip: "+z" });
  if (bs) bx(P, xW, yS, 0, xE, yS + bs, H, s.slot, { skip: "+z" });
  if (be) bx(P, xE - be, yS + bs, 0, xE, yN - bn, H, s.slot, { skip: "+z" });
  if (bw) bx(P, xW, yS + bs, 0, xW + bw, yN - bn, H, s.slot, { skip: "+z" });
}
function blockGen(s, P) {
  const [W, D, H] = s.size, no = clamp(s.nosing, 0, D / 3);
  if (!no) { bx(P, -W / 2, -D / 2, 0, W / 2, D / 2, H, s.slot, { b: s.bevel }); return; }
  bx(P, -W / 2, -D / 2 + no, 0, W / 2, D / 2, H - 0.03, s.slot, { b: s.bevel });
  bx(P, -W / 2, -D / 2, H - 0.03, W / 2, D / 2, H, s.slot, { b: s.bevel });
}
function partsGen(s, P) {
  for (const q of s.parts || []) {
    if (!SL.includes(q.s) || !Array.isArray(q.at) || !Array.isArray(q.size)) continue;
    P.push({ s: q.s, at: q.at.map(Number), size: q.size.map(v => Math.max(0.0005, +v)), m: q.m || "body",
             b: +q.b || 0, rz: +q.rz || 0, axis: q.axis, ri: +q.ri || 0 });
  }
}
// a built thing's parts, as a free list (the kit maker's "Explode": start from a preset, then move single boxes)
export function explode(built) {
  return built.parts.map(p => { const o = { s: p.s, at: p.at.map(v => +v.toFixed(5)), size: p.size.map(v => +v.toFixed(5)), m: p.m };
    if (p.b) o.b = +p.b.toFixed(5); if (p.rz) o.rz = +p.rz.toFixed(3); if (p.axis) o.axis = p.axis; if (p.ri) o.ri = +p.ri.toFixed(5); return o; });
}

// the box the parts fill (for checks: every part inside the size box)
export function bounds(parts) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const G = mesh(parts);
  for (const g of Object.values(G)) for (let i = 0; i < g.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], g.pos[i + k]); hi[k] = Math.max(hi[k], g.pos[i + k]); }
  return { lo, hi };
}
export function stats(G) { let tris = 0, verts = 0; for (const g of Object.values(G)) { tris += g.idx.length / 3; verts += g.pos.length / 3; } return { tris, verts, slots: Object.keys(G).length }; }

// ---- glTF binary: one mesh, a primitive per slot, Y up, the front facing +Z (glTF's own front) -----------------------
export function glb(G, name = "kit") {
  const prims = [], mats = [], views = [], accs = [], chunks = [];
  let off = 0;
  const add = (arr, type, comp, target, count, minmax) => {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), pad = (4 - bytes.length % 4) % 4;
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, target });
    chunks.push(bytes, new Uint8Array(pad)); off += bytes.length + pad;
    const a = { bufferView: views.length - 1, componentType: comp, count, type };
    if (minmax) Object.assign(a, minmax);
    accs.push(a); return accs.length - 1;
  };
  for (const [slot, g] of Object.entries(G)) {
    const n = g.pos.length / 3; if (!n) continue;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) {                         // story (x, y, z up) -> glTF (x, z, -y)
      const p = [g.pos[i * 3], g.pos[i * 3 + 2], -g.pos[i * 3 + 1]];
      pos.set(p, i * 3); nrm.set([g.nrm[i * 3], g.nrm[i * 3 + 2], -g.nrm[i * 3 + 1]], i * 3);
      uv.set([g.uv[i * 2], 1 - g.uv[i * 2 + 1]], i * 2);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    }
    const idx = new Uint32Array(g.idx);
    const S = SLOTS[slotOf(slot)];
    mats.push({ name: `kit_${slot}`, pbrMetallicRoughness: { baseColorFactor: [...hex(S[0]), S[3] ?? 1], roughnessFactor: S[1] ?? 0.6, metallicFactor: S[2] ?? 0 },
                ...(S[3] !== undefined && S[3] < 1 ? { alphaMode: "BLEND" } : {}), ...(S[4] ? { emissiveFactor: hex(S[0]) } : {}) });
    prims.push({ attributes: { POSITION: add(pos, "VEC3", 5126, 34962, n, { min: lo, max: hi }), NORMAL: add(nrm, "VEC3", 5126, 34962, n),
                               TEXCOORD_0: add(uv, "VEC2", 5126, 34962, n) }, indices: add(idx, "SCALAR", 5125, 34963, idx.length), material: mats.length - 1 });
  }
  const json = { asset: { version: "2.0", generator: `HorrorStudio kit v${VERSION}` }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
                 meshes: [{ name, primitives: prims }], materials: mats, accessors: accs, bufferViews: views, buffers: [{ byteLength: off }] };
  let js = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - js.length % 4) % 4; if (jpad) { const t = new Uint8Array(js.length + jpad); t.set(js); t.fill(32, js.length); js = t; }
  const total = 12 + 8 + js.length + 8 + off, out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20);
  let o = 20 + js.length; dv.setUint32(o, off, true); dv.setUint32(o + 4, 0x004E4942, true); o += 8;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
const hex = c => [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
