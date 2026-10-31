// The kit: room things built from boxes, bevelled boxes and cylinders, from a handful of numbers (docs/KIT.md).
// One source for the scene builder, the desk, the kit maker and the Unreal export (tools/kit/build.mjs): no DOM, no
// three.js. A spec is a preset's name or {type | preset, size: [w, d, h], ...params}. Local space is the story's:
// x across, y deep with the FRONT at -y, z up from the base; every part stays inside the size box, so the box the
// plan and the checks see is the thing. The gaps (between tiles, boards, doors and drawers) and the bevels are real
// geometry: they're what a light bake turns into the thin dark lines and bright edges of a real room.
export const VERSION = 5;          // bump when a generator's output changes (presets.json carries the same number)

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
  // the little things (docs/IMMERSION.md): kitchenware, smoking, clocks. A part its life moves or lights (a lid, a
  // clock's hands, a pendulum, a hob's rings, an LED) is a slot of its own, so the desk can move or light it alone.
  steel: [0xc4c8cc, 0.3, 0.55], chrome: [0xdfe3e6, 0.15, 0.6], lid: [0xc4c8cc, 0.3, 0.55], brass: [0xb8955a, 0.3, 0.6], pendulum: [0xb8955a, 0.3, 0.6],
  iron: [0x2b2826, 0.75, 0.4], matte_black: [0x1c1c1e, 0.6, 0.2], plastic_2: [0x2a2b2e, 0.45], rubber: [0x1a1a1a, 0.9], lighter: [0xc23b2e, 0.3],
  ceramic: [0xf1eee6, 0.2], glaze: [0x9fb3ab, 0.22], glaze_2: [0x8a5a33, 0.25], glaze_3: [0x2e2420, 0.25], glaze_4: [0x2f3d5c, 0.22],
  clay: [0x9a4a2c, 0.7], enamel: [0xe3dccb, 0.22], enamel_2: [0xa8322c, 0.22], glass_2: [0xc9d8dc, 0.05, 0, 0.5],
  glass_hob: [0x09090b, 0.06], print: [0x7c7f84, 0.5], heat: [0x120d0c, 0.5], led: [0x2c3036, 0.3], lcd: [0x8f9a8c, 0.3],
  dial: [0xf3f1ea, 0.7], hand_h: [0x1b1b1d, 0.5], hand_m: [0x1b1b1d, 0.5], hand_s: [0xb02a22, 0.5],
  cig: [0xf4f2ec, 0.85], filter: [0xd29a5c, 0.75], tobacco: [0x7a4f27, 1], ash: [0x9a9792, 1], ash_2: [0x3a3735, 1],
  coil: [0x4c6838, 0.95], incense: [0x5f4630, 0.9], wax: [0xf0e9d6, 0.5], wick: [0x1e1b18, 1], kraft: [0xa88159, 0.9],
};
export const slotOf = m => SLOTS[m] ? m : (SLOTS[m.replace(/_\d+$/, "")] ? m.replace(/_\d+$/, "") : "body");
const tone = (base, n, R) => { const i = n > 1 ? Math.floor(R() * n) : 0; return i && !/_\d+$/.test(base) ? `${base}_${i + 1}` : base; };

export function rng(seed) {           // mulberry32: the same seed, the same gaps, on every machine
  let a = (Math.floor(+seed || 0) >>> 0) ^ 0x9e3779b9;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SL = ["box", "cyl", "soft", "pipe", "lathe", "sweep"];

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
  downlight: { label: "Downlight / ceiling panel / round LED", cat: "ceiling", mount: "ceiling", size: [0.12, 0.12, 0.02], params: [["shape", "shape", "round", "pick", ["round", "square"]],
    ["style", "style (round)", "recessed", "pick", ["recessed", "flush", "dome", "ring"]],
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
    ["bevel", "softness", 0.03, "m"], ["soft", "soft (filled, piped, wrinkled)", true, "bool"], ["quilted", "quilted mattress", false, "bool"], ["seed", "seed", 1, "int"],
    ["slot", "frame material", "wood", "slot"], ["mattress", "mattress material", "fabric_2", "slot"], ["duvet_slot", "duvet material", "fabric", "slot"]], gen: bedGen },
  sofa: { label: "Sofa", cat: "furniture", mount: "back", size: [2.1, 0.92, 0.8], params: [["seats", "seat cushions", 3, "int"], ["seat_h", "seat height", 0.42, "m"],
    ["arm", "arm width (0: none)", 0.16, "m"], ["arm_h", "arm height", 0.6, "m"], ["back_t", "back frame", 0.12, "m"], ["legs", "legs", 0.06, "m"],
    ["chaise", "chaise (an end seat run long)", "none", "pick", ["none", "left", "right"]], ["depth", "depth beside a chaise", 0.92, "m"],
    ["gap", "cushion gap", 0.006, "mm"], ["bevel", "softness", 0.035, "m"], ["soft", "soft cushions (filled, piped)", true, "bool"], ["piping", "piping", 0.004, "mm"],
    ["wrinkle", "wrinkles", 0.003, "mm"], ["tufts", "buttoned back", false, "bool"], ["seed", "seed", 1, "int"], ["slot", "material", "fabric", "slot"], ["leg_slot", "leg material", "black", "slot"]], gen: sofaGen },
  cushion: { label: "Cushion, pillow, mattress", cat: "soft", mount: "on", size: [0.45, 0.45, 0.16], params: [["seam", "seam", "knife", "pick", ["knife", "box", "none"]],
    ["puff", "filling (0 to 0.9)", 0.45, "num"], ["pinch", "pinched at the seam", 0.75, "num"], ["b", "roundness", 0.03, "m"], ["pipe", "piping", 0.004, "mm"],
    ["tufts", "buttons across × along", [0, 0], "n2"], ["tuft", "button depth", 0.35, "num"], ["wrinkle", "wrinkles", 0.004, "mm"], ["seed", "seed", 1, "int"],
    ["stand", "stands up (leans on a back)", false, "bool"], ["lean", "leans back", 0, "deg"], ["n", "detail", 16, "int"],
    ["slot", "material", "fabric", "slot"], ["pipe_slot", "piping material", "fabric_2", "slot"], ["button_slot", "button material", "fabric_2", "slot"]], gen: cushionGen },
  door: { label: "Door", cat: "door", mount: "door", size: [0.8, 0.04, 2.0], pivot: doorPivot, params: [["style", "style", "panels", "pick", ["flush", "panels", "shaker", "glass", "louvre", "shoji", "slide"]],
    ["grid", "panels across × up", [1, 2], "n2"], ["rail", "frame width", 0.1, "m"], ["recess", "panel depth", 0.006, "mm"], ["hinges", "hinges", 3, "int"],
    ["hinge_h", "hinge height", 0.1, "m"], ["knuckles", "knuckles a hinge", 5, "int"], ["hinge_tip", "hinge tips", "ball", "pick", ["ball", "flat", "none"]],
    ["hinge_w", "hinge plate width", 0.026, "m"], ["hinge_t", "plate thickness (the mortise's depth)", 0.0025, "mm"], ["barrel", "barrel Ø", 0.013, "mm"],
    ["mortise", "cut mortises (plates flush)", true, "bool"], ["hinge_model", "hinges drawn", "kit", "pick", ["kit", "none"]],
    ["hinge", "hinged on (seen from the side it opens to)", "left", "pick", ["left", "right"]], ["bevel", "edge bevel", 0.002, "mm"],
    ["handle", "handle", "lever_round", "preset", "handle"], ["handle_z", "handle height", 0.95, "m"], ["handle_in", "handle from the edge", 0.065, "m"],
    ["frame", "frame", "door_frame", "preset", "door_frame"], ["lining", "frame lining", 0.02, "mm"], ["gap", "gap round the leaf", 0.003, "mm"], ["floor_gap", "gap under it", 0.008, "mm"],
    ["slot", "material", "front", "slot"], ["hinge_slot", "hinge material", "metal", "slot"]], gen: doorGen },
  handle: { label: "Door handle (both sides)", cat: "door", mount: "door", size: [0.15, 0.13, 0.07], params: [["kind", "kind", "lever", "pick", ["lever", "bar", "knob", "pull", "recess"]],
    ["through", "door thickness", 0.04, "m"], ["points", "a lever points", "left", "pick", ["left", "right"]], ["rose", "rose", "round", "pick", ["round", "square", "plate"]],
    ["lock", "keyhole below", false, "bool"], ["style", "style", "modern", "pick", ["modern", "classic"]], ["slot", "material", "metal", "slot"]], gen: handleGen },
  door_frame: { label: "Door frame: lining and stop", cat: "door", mount: "opening", size: [0.84, 0.1, 2.05], params: [["lining", "lining", 0.02, "mm"], ["stop", "door stop", true, "bool"],
    ["stop_t", "stop", 0.012, "mm"], ["leaf_t", "the door's thickness", 0.04, "m"], ["slot", "material", "body", "slot"],
    ["hinge", "hinges on (the door's: the plan fills these)", "none", "pick", ["none", "left", "right"]], ["hinges", "hinges", 3, "int"], ["hinge_h", "hinge height", 0.1, "m"],
    ["knuckles", "knuckles", 5, "int"], ["hinge_tip", "hinge tips", "ball", "pick", ["ball", "flat", "none"]], ["leaf_w", "the door's width", 0, "m"],
    ["hinge_w", "hinge plate width", 0.026, "m"], ["hinge_t", "plate thickness (the mortise's depth)", 0.0025, "mm"], ["barrel", "barrel Ø", 0.013, "mm"],
    ["mortise", "cut mortises", true, "bool"], ["hinge_model", "hinges drawn", "kit", "pick", ["kit", "none"]],
    ["leaf_h", "the door's height", 0, "m"], ["leaf_z", "the gap under it", 0.008, "mm"], ["hinge_slot", "hinge material", "metal", "slot"]], gen: frameGen },
  bulkhead: { label: "Ceiling step / curtain pocket", cat: "ceiling", mount: "room-ceiling", size: [3.6, 3.6, 0.12], params: [["border", "step width n, e, s, w", [0.35, 0.35, 0.35, 0.35], "m4"],
    ["pocket", "curtain pocket on", "none", "pick", ["none", "n", "e", "s", "w"]], ["pocket_w", "pocket width", 0.13, "m"], ["slot", "material", "body", "slot"]], gen: bulkheadGen },
  block: { label: "Block: a step, a plinth, a board", cat: "furniture", mount: "floor", size: [1.2, 0.3, 0.18], params: [["bevel", "edge bevel", 0.003, "mm"],
    ["nosing", "nosing (front lip)", 0, "m"], ["slot", "material", "wood", "slot"]], gen: blockGen },
  parts: { label: "Free parts (any furniture)", cat: "furniture", mount: "floor", size: [0.6, 0.6, 0.6], params: [["parts", "parts", [{ s: "box", at: [0, 0, 0], size: [0.6, 0.6, 0.6], m: "body", b: 0.003 }], "parts"]], gen: partsGen },
  // the little things (docs/IMMERSION.md): drawn at their own size and fitted into the box, so a size scales them evenly
  kettle: { label: "Kettle", cat: "small", mount: "on", size: [0.162, 0.216, 0.204], params: [["style", "kind", "jug", "pick", ["jug", "gooseneck", "whistling", "tetsubin"]],
    ["slot", "material", "plastic", "slot"], ["trim_slot", "handle, base and knob material", "plastic_2", "slot"]], gen: kettleGen },
  hob: { label: "Hob: ceramic, induction, gas", cat: "small", mount: "on", size: [0.59, 0.52, 0.006], params: [["style", "kind", "ceramic", "pick", ["ceramic", "induction", "gas"]],
    ["zones", "rings", 4, "int"], ["controls", "touch controls", "front", "pick", ["front", "none"]], ["body", "a body under it (a table-top unit)", false, "bool"],
    ["trim", "steel trim round it", 0, "mm"], ["slot", "top material", "glass_hob", "slot"], ["trim_slot", "trim material", "steel", "slot"], ["body_slot", "body material", "black", "slot"]], gen: hobGen },
  pot: { label: "Pot, pan", cat: "small", mount: "on", size: [0.337, 0.163, 0.123], params: [["style", "kind", "saucepan", "pick", ["saucepan", "stockpot", "donabe"]],
    ["slot", "material", "steel", "slot"], ["lid_slot", "lid material (a slot of its own rattles)", "lid", "slot"], ["trim_slot", "handle and knob material", "plastic_2", "slot"]], gen: potGen },
  cup: { label: "Cup, mug, glass", cat: "small", mount: "on", size: [0.114, 0.082, 0.096], params: [["style", "kind", "mug", "pick", ["mug", "teacup", "yunomi", "glass", "takeaway"]],
    ["slot", "material", "ceramic", "slot"]], gen: cupGen },
  teapot: { label: "Teapot", cat: "small", mount: "on", size: [0.172, 0.144, 0.084], params: [["style", "kind", "kyusu", "pick", ["kyusu", "round"]],
    ["slot", "material", "clay", "slot"], ["lid_slot", "lid material", "clay", "slot"]], gen: teapotGen },
  ashtray: { label: "Ashtray", cat: "small", mount: "on", size: [0.12, 0.12, 0.031], params: [["style", "kind", "glass", "pick", ["glass", "metal", "ceramic"]],
    ["rests", "rests (notches)", 3, "int"], ["butts", "butts in it", 0, "int"], ["seed", "seed", 1, "int"], ["resting", "a cigarette resting in it", false, "bool"],
    ["left", "how much of it is left (0.15 to 1)", 0.7, "num"], ["ash", "ash on its tip", 0.004, "mm"], ["slot", "material", "glass_2", "slot"]], gen: ashtrayGen },
  cigarette: { label: "Cigarette", cat: "small", mount: "on", size: [0.085, 0.008, 0.008], params: [["pose", "lies", "lying", "pick", ["lying", "butt"]],
    ["filter", "filter", true, "bool"], ["left", "how much is left (0.1 to 1)", 1, "num"], ["ash", "ash on its tip", 0, "mm"]], gen: cigaretteGen },
  cig_pack: { label: "Cigarette pack", cat: "small", mount: "on", size: [0.056, 0.049, 0.084], params: [["open", "open", true, "bool"], ["count", "cigarettes showing", 6, "int"],
    ["slot", "material", "white", "slot"], ["band_slot", "band colour", "lighter", "slot"]], gen: packGen },
  lighter: { label: "Lighter", cat: "small", mount: "on", size: [0.073, 0.025, 0.012], params: [["pose", "stands", "lying", "pick", ["lying", "standing"]],
    ["slot", "material", "lighter", "slot"]], gen: lighterGen },
  clock: { label: "Clock", cat: "small", mount: "wall", size: [0.3, 0.038, 0.3], params: [["style", "kind", "round", "pick", ["round", "school", "pendulum"]],
    ["time", "time it shows (hh:mm or hh:mm:ss)", "10:10:30", "text"], ["seconds", "second hand", true, "bool"], ["marks", "marks", 12, "pick", [12, 60]],
    ["slot", "case material", "white", "slot"]], gen: clockGen },
  rice_cooker: { label: "Rice cooker", cat: "small", mount: "on", size: [0.25, 0.325, 0.228], params: [["slot", "material", "white", "slot"], ["lid_slot", "lid material", "plastic", "slot"],
    ["panel_slot", "panel material", "black", "slot"]], gen: riceGen },
  coil: { label: "Mosquito coil", cat: "small", mount: "on", size: [0.14, 0.14, 0.018], params: [["style", "on", "stand", "pick", ["stand", "pig"]],
    ["left", "how much is left (0.1 to 1)", 1, "num"], ["slot", "the pig's material", "clay", "slot"]], gen: coilGen },
  incense: { label: "Incense", cat: "small", mount: "on", size: [0.054, 0.054, 0.116], params: [["style", "in", "holder", "pick", ["holder", "koro"]],
    ["sticks", "sticks (in a kōro)", 3, "int"], ["left", "how much is left (0.1 to 1)", 0.8, "num"], ["slot", "material", "ceramic", "slot"]], gen: incenseGen },
  phone: { label: "Phone", cat: "small", mount: "on", size: [0.072, 0.15, 0.008], params: [["style", "kind", "smartphone", "pick", ["smartphone", "flip"]],
    ["slot", "material", "black", "slot"]], gen: phoneGen },
  tap: { label: "Kitchen tap", cat: "small", mount: "on", size: [0.056, 0.295, 0.311], params: [["style", "kind", "mixer", "pick", ["mixer", "cross"]],
    ["slot", "material", "chrome", "slot"]], gen: tapGen },
  candle: { label: "Candle", cat: "small", mount: "on", size: [0.07, 0.07, 0.103], params: [["style", "kind", "pillar", "pick", ["pillar", "taper", "tealight"]],
    ["left", "how much is left (0.15 to 1)", 1, "num"], ["slot", "wax", "wax", "slot"], ["holder_slot", "candlestick material", "brass", "slot"]], gen: candleGen },
};
export const CATS = { floor: "Floors", cabinet: "Cabinets and built-ins", furniture: "Furniture", soft: "Cushions, pillows, mattresses", door: "Doors and handles", wall: "On and in the walls", fitting: "Wall fittings",
  ceiling: "Ceilings", opening: "Windows", curtain: "Curtains", small: "Little things (they come alive)" };

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
// sockets: the named points a little thing's life comes from (its spout, its tip, a ring), in item space
export function build(spec, presets) {
  const s = withDefaults(resolve(spec, presets));
  const P = [], warn = [], S = {};
  const R = rng(s.seed ?? 1);
  s.size = s.size.map(v => Math.max(0.001, +v || 0.001));
  TYPES[s.type].gen(s, P, R, warn, S);
  return { spec: s, parts: P, warn, sockets: S };
}

// the parts as triangles: {slot: {pos, nrm, uv, idx}} in metres, local space (front -y, z up)
export function mesh(parts) {
  const G = {};
  const buf = m => G[m] || (G[m] = { pos: [], nrm: [], uv: [], idx: [] });
  for (const p of parts) ({ cyl: cylFaces, soft: softFaces, pipe: pipeFaces, lathe: latheFaces, sweep: sweepFaces }[p.s] || boxFaces)(p, buf);
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
  const map = ([u, v, t]) => ax === "-y" ? [u, -t, v] : ax === "y" ? [u, t, v] : ax === "-z" ? [u, v, -t] : [u, v, t];
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

// ---- soft things: cushions, mattresses, pillows, duvets -----------------------------------------------------------
// After FurnGen's upholstery (github.com/HumSaw/furngen, MIT): a rounded box; the filling pushing out against its
// cover (the crown); the cover pinched to a knife-edge seam (a throw pillow) or boxed (a seat cushion); seeded wrinkles,
// strongest near the seams; piping along the seams; buttons pulling tufts in. Built as a mapping of a cube's surface
// lattice, welded, with smooth normals: the same few numbers always make the same cushion.
function noise3(seed) {
  const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = sm(x - X), fy = sm(y - Y), fz = sm(z - Z), c = (i, j, k) => hash(X + i, Y + j, Z + k);
    return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), fx), lerp(c(0, 1, 0), c(1, 1, 0), fx), fy), lerp(lerp(c(0, 0, 1), c(1, 0, 1), fx), lerp(c(0, 1, 1), c(1, 1, 1), fx), fy), fz) * 2 - 1;
  };
}
// a soft part's shape: a point on the cube [-1, 1]³'s surface -> part space (centred on its box)
export function softMap(p) {
  const stand = !!p.stand, [W, D0, H0] = p.size, [D, H] = stand ? [H0, D0] : [D0, H0];          // standing: thin along y
  const pr = Math.max(0, +p.pipe || 0), boxed = p.seam === "box";
  const hx = W / 2 - pr, hy = D / 2 - pr, hz = H / 2 - (boxed ? pr : 0);
  const puff = clamp(p.puff ?? 0.25, 0, 0.9), knife = p.seam === "knife" ? clamp(p.pinch ?? 0.75, 0, 0.95) : 0, bz = hz * (1 - puff);
  const r = clamp(p.b ?? Math.min(hx, hy, bz) * 0.5, 0.001, Math.min(hx, hy, bz) * 0.98);
  const N = noise3((p.seed | 0) + 7), wr = Math.max(0, +p.wrinkle || 0), f = 3 / Math.max(0.05, Math.min(W, D));
  const [tx, ty] = (p.tufts || [0, 0]).map(v => Math.max(0, v | 0)), tufts = [];
  for (let i = 0; i < tx; i++) for (let j = 0; j < ty; j++) tufts.push([((i + 0.5 + (j % 2 ? 0.5 : 0)) / tx * 2 - 1) * 0.86, ((j + 0.5) / ty * 2 - 1) * 0.86]);
  const tufted = tufts.filter(([u]) => u < 0.9), td = clamp(p.tuft ?? 0.3, 0, 0.8) * hz, s2 = Math.pow(0.55 / Math.max(tx, ty, 1), 2);
  const lean = Math.tan((p.lean || 0) * Math.PI / 180);
  return c => {
    const P = [c[0] * hx, c[1] * hy, c[2] * bz], h = [hx, hy, bz];
    const inner = P.map((v, k) => clamp(v, -(h[k] - r), h[k] - r));
    let d = P.map((v, k) => v - inner[k]); const L = Math.hypot(...d) || 1; d = d.map(v => v / L);
    const q = inner.map((v, k) => v + d[k] * r), u = q[0] / hx, v = q[1] / hy, edge = Math.min(1, Math.max(Math.abs(u), Math.abs(v)));
    const cz = q[2] < 0 ? -1 : 1, zf = Math.abs(q[2]) / Math.max(1e-6, bz);
    q[2] += cz * puff * hz * (1 - u * u) * (1 - v * v) * zf;                                  // the filling pushing out
    if (knife) q[2] *= 1 - knife * Math.pow(edge, 1.8);                                        // pinched to the seam: a dome
    for (const [tu, tv] of tufted) q[2] -= cz * td * Math.abs(d[2]) * Math.exp(-((u - tu) ** 2 + (v - tv) ** 2) / s2);
    if (wr) { const n = N(q[0] * f + 3.1, q[1] * f + 1.7, q[2] * f), a = wr * (0.3 + 0.7 * edge * edge); for (let k = 0; k < 3; k++) q[k] += d[k] * n * a; }
    let o = [clamp(q[0], -W / 2, W / 2), clamp(q[1], -D / 2, D / 2), clamp(q[2], -H / 2, H / 2)];
    if (stand) o = [o[0], clamp(-o[2] + o[1] * lean, -D0 / 2 + pr, D0 / 2 - pr), o[1]];
    return o;
  };
}
function softFaces(p, buf) {
  const B = buf(p.m), f = softMap(p), [W, D, H] = p.stand ? [p.size[0], p.size[2], p.size[1]] : p.size, n = clamp(p.n || 16, 4, 48);
  const L = Math.max(W, D, H), cnt = a => Math.max(3, Math.round(n * a / L)), N = [cnt(W), cnt(D), Math.max(4, cnt(H) + (p.seam === "knife" ? 2 : 0))];
  const warp = t => Math.sin(t * Math.PI / 2);                        // more lattice toward the edges, where it curves
  const idx = new Map(), pos = [];
  const vid = (i, j, k) => {
    const key = i + "," + j + "," + k; let id = idx.get(key);
    if (id === undefined) { id = pos.length; idx.set(key, id); pos.push(f([i / N[0] * 2 - 1, j / N[1] * 2 - 1, k / N[2] * 2 - 1].map(warp))); }
    return id;
  };
  const tris = [];
  for (let ax = 0; ax < 3; ax++) for (const sd of [0, 1]) {
    const a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
    for (let i = 0; i < N[a1]; i++) for (let j = 0; j < N[a2]; j++) {
      const g = (di, dj) => { const l = [0, 0, 0]; l[ax] = sd ? N[ax] : 0; l[a1] = i + di; l[a2] = j + dj; return vid(...l); };
      const a = g(0, 0), b = g(1, 0), c = g(1, 1), e = g(0, 1);
      if (sd) tris.push([a, b, c], [a, c, e]); else tris.push([a, c, b], [a, e, c]);
    }
  }
  const nrm = pos.map(() => [0, 0, 0]);
  for (const [a, b, c] of tris) {
    const A = pos[a], e1 = pos[b].map((v, k) => v - A[k]), e2 = pos[c].map((v, k) => v - A[k]);
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nrm[v][k] += cr[k];
  }
  const xf = xform(p), a = (p.rz || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), hz = p.size[2] / 2, base = B.pos.length / 3;
  pos.forEach((q, i) => {
    const L2 = Math.hypot(...nrm[i]) || 1, n0 = nrm[i].map(v => v / L2), local = [q[0], q[1], q[2] + hz];
    B.pos.push(...xf(local)); B.nrm.push(n0[0] * co - n0[1] * si, n0[0] * si + n0[1] * co, n0[2]); B.uv.push(...uvFor(p, local, n0));
  });
  for (const [x, y, z] of tris) B.idx.push(base + x, base + y, base + z);
}
// a tube along a closed path (piping): pts in item space
function pipeFaces(p, buf) {
  const B = buf(p.m), pts = p.pts || [], n = pts.length, m = 8, r = Math.max(0.0005, p.r || 0.004);
  if (n < 3) return;
  const base = B.pos.length / 3; let run = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], c = pts[i];
    let t = b.map((v, k) => v - a[k]); const tl = Math.hypot(...t) || 1; t = t.map(v => v / tl);
    const up = Math.abs(t[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    let n1 = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]]; const l1 = Math.hypot(...n1) || 1; n1 = n1.map(v => v / l1);
    const n2 = [t[1] * n1[2] - t[2] * n1[1], t[2] * n1[0] - t[0] * n1[2], t[0] * n1[1] - t[1] * n1[0]];
    if (i) run += Math.hypot(...c.map((v, k) => v - pts[i - 1][k]));
    for (let j = 0; j < m; j++) {
      const an = j / m * Math.PI * 2, dir = n1.map((v, k) => v * Math.cos(an) + n2[k] * Math.sin(an));
      B.pos.push(...c.map((v, k) => v + dir[k] * r)); B.nrm.push(...dir); B.uv.push(run, j / m * Math.PI * 2 * r);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = base + i * m + j, b = base + ((i + 1) % n) * m + j, c = base + ((i + 1) % n) * m + (j + 1) % m, d = base + i * m + (j + 1) % m;
    B.idx.push(a, b, c, a, c, d);
  }
  // keep the winding outward: check one triangle against its radial normal
  const k = B.idx.length - 6, P3 = i => B.pos.slice(i * 3, i * 3 + 3), [ia, ib, ic] = [B.idx[k], B.idx[k + 1], B.idx[k + 2]];
  const A = P3(ia), e1 = P3(ib).map((v, q) => v - A[q]), e2 = P3(ic).map((v, q) => v - A[q]), nn = B.nrm.slice(ia * 3, ia * 3 + 3);
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] < 0) for (let q = base === 0 ? 0 : B.idx.length - n * m * 6; q < B.idx.length; q += 3) { const t2 = B.idx[q + 1]; B.idx[q + 1] = B.idx[q + 2]; B.idx[q + 2] = t2; }
}
// ---- turned and swept hardware: knobs, roses, levers, bar pulls, hinge knuckles ----------------------------------
// lathe: a profile [[r, t], ...] (radius, distance along the axis from the base) turned round its axis, smooth; a point
// given twice is a hard edge. sweep: a rounded section ({a, b, r}: half-height along `up`, half-width across, corner
// radius) carried along a path, with rounded ends. The way door hardware is modelled, at a density that holds up
// next to the soft things. A lathe's axis is one of x, y, z (and their negatives) or any direction (`dir`); a sweep can
// narrow along its length (`taper`: its section's scale at the end).
function lathe(P, x, y, z, prof, m, o = {}) {
  const R = Math.max(...prof.map(q => q[0])), L = Math.max(...prof.map(q => q[1]));
  const p = Object.assign({ s: "lathe", at: [x, y, z], prof, size: [2 * R, 2 * R, L], m, n: 40 }, o); P.push(p); return p;
}
const v3 = { add: (a, b) => a.map((x, k) => x + b[k]), sub: (a, b) => a.map((x, k) => x - b[k]), mul: (a, f) => a.map(x => x * f),
  nrm: a => { const L = Math.hypot(...a) || 1; return a.map(x => x / L); }, cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] };
function frameOf(dir) {                                  // two directions square to `dir`, and it: [u, v, w]
  const w = v3.nrm(dir), u = v3.nrm(v3.cross(Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], w));
  return [u, v3.cross(w, u), w];
}
function latheFaces(p, buf) {
  const B = buf(p.m), n = Math.max(8, p.n || 40), prof = p.prof || [], ax = p.axis || "z", F = p.dir ? frameOf(p.dir) : null;
  const map = F ? ([u, v, t]) => [0, 1, 2].map(k => F[0][k] * u + F[1][k] * v + F[2][k] * t)
    : ([u, v, t]) => ax === "-y" ? [u, -t, v] : ax === "y" ? [u, t, v] : ax === "-z" ? [u, v, -t] : ax === "x" ? [t, u, v] : ax === "-x" ? [-t, u, v] : [u, v, t];
  const xf0 = xform(p), xf = q => xf0(map(q)), a = (p.rz || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const segN = i => { const [r0, t0] = prof[i], [r1, t1] = prof[i + 1], L = Math.hypot(r1 - r0, t1 - t0) || 1; return [(t1 - t0) / L, -(r1 - r0) / L]; };
  const same = (i, j) => prof[i] && prof[j] && prof[i][0] === prof[j][0] && prof[i][1] === prof[j][1];
  const vn = [];                                         // each profile point's normal (radial, axial)
  for (let i = 0; i < prof.length; i++) {
    const prev = i > 0 && !same(i, i - 1) ? segN(i - 1) : null, next = i < prof.length - 1 && !same(i, i + 1) ? segN(i) : null;
    const hardIn = i > 0 && same(i, i - 1), hardOut = i < prof.length - 1 && same(i, i + 1);
    const nn = hardOut ? prev : hardIn ? next : prev && next ? [prev[0] + next[0], prev[1] + next[1]] : prev || next || [0, 1];
    const L = Math.hypot(...nn) || 1; vn.push([nn[0] / L, nn[1] / L]);
  }
  const base = B.pos.length / 3, run = [0];
  for (let i = 1; i < prof.length; i++) run.push(run[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const Rm = Math.max(...prof.map(q => q[0]), 0.001);
  for (let i = 0; i < prof.length; i++) for (let j = 0; j <= n; j++) {
    const an = j / n * Math.PI * 2, c = Math.cos(an), sn = Math.sin(an), [r, t] = prof[i], [nr, nt] = vn[i];
    B.pos.push(...xf([r * c, r * sn, t]));
    const nm = map([nr * c, nr * sn, nt]); B.nrm.push(nm[0] * co - nm[1] * si, nm[0] * si + nm[1] * co, nm[2]);
    B.uv.push(j / n * Math.PI * 2 * Rm, run[i]);
  }
  for (let i = 0; i + 1 < prof.length; i++) {
    if (same(i, i + 1)) continue;
    for (let j = 0; j < n; j++) {
      const a0 = base + i * (n + 1) + j, a1 = a0 + 1, b0 = a0 + n + 1, b1 = b0 + 1;
      B.idx.push(a0, a1, b1, a0, b1, b0);
    }
  }
  fixWinding(B, base);
}
function sweep(P, pts, sec, m, o = {}) {
  const lo = [0, 1, 2].map(k => Math.min(...pts.map(q => q[k]))), hi = [0, 1, 2].map(k => Math.max(...pts.map(q => q[k])));
  const p = Object.assign({ s: "sweep", at: [0, 0, 0], size: hi.map((v, k) => v - lo[k]), pts, sec, m, up: [0, 0, 1], caps: true }, o); P.push(p); return p;
}
// a smooth path through control points (Catmull-Rom), k samples a span
function smoothPath(ctrl, k = 6) {
  if (ctrl.length < 3) return ctrl;
  const out = [], c = i => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) for (let q = 0; q < k; q++) {
    const t = q / k, t2 = t * t, t3 = t2 * t, p0 = c(i - 1), p1 = c(i), p2 = c(i + 1), p3 = c(i + 2);
    out.push([0, 1, 2].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
function sweepFaces(p, buf) {
  const B = buf(p.m), pts = p.pts || [], N = pts.length;
  if (N < 2) return;
  const sc = p.sec || { a: 0.005, b: 0.005, r: 0.005 }, A = sc.a, Bh = sc.b, rc = Math.min(sc.r ?? Math.min(A, Bh), A, Bh), k = 4;
  const sec = [];                                       // the rounded rectangle, anticlockwise, with its normals: [x across, y up, nx, ny]
  for (const [cx, cy0, a0] of [[Bh - rc, A - rc, 0], [-(Bh - rc), A - rc, 90], [-(Bh - rc), -(A - rc), 180], [Bh - rc, -(A - rc), 270]])
    for (let i = 0; i <= k; i++) { const an = (a0 + i / k * 90) * Math.PI / 180, c = Math.cos(an), sn = Math.sin(an); sec.push([cx + rc * c, cy0 + rc * sn, c, sn]); }
  const M = sec.length, sub = (u, v) => u.map((x, i) => x - v[i]), nrmz = u => { const L = Math.hypot(...u) || 1; return u.map(x => x / L); };
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const T = pts.map((q, i) => nrmz(sub(pts[Math.min(N - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let up = p.up || [0, 0, 1];
  const frames = [];
  for (let i = 0; i < N; i++) {                          // parallel transport: the section doesn't twist
    let nv = sub(up, T[i].map(x => x * dot(up, T[i]))); if (Math.hypot(...nv) < 1e-6) nv = Math.abs(T[i][0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    nv = nrmz(nv); const bv = cross(T[i], nv); frames.push([nv, bv]); up = nv;
  }
  const rings = [];                                     // [centre, up, across, scale, along-normal]
  const capR = Math.min(A, Bh) * 0.9, kc = p.caps === false ? 0 : 4, tp = p.taper ?? 1, run0 = [0];
  for (let i = 1; i < N; i++) run0.push(run0[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const sk = i => tp === 1 ? 1 : 1 + (tp - 1) * run0[i] / (run0[N - 1] || 1), tilt = tp === 1 ? 0 : -(tp - 1) * (A + Bh) / 2 / (run0[N - 1] || 1);
  for (let c = kc; c >= 1; c--) { const th = c / kc * Math.PI / 2; rings.push([pts[0].map((x, d) => x - T[0][d] * Math.sin(th) * capR), frames[0][0], frames[0][1], Math.cos(th), T[0].map(x => -x * Math.sin(th)), Math.cos(th)]); }
  for (let i = 0; i < N; i++) rings.push([pts[i], frames[i][0], frames[i][1], sk(i), tilt ? T[i].map(x => x * tilt) : [0, 0, 0], 1]);
  for (let c = 1; c <= kc; c++) { const th = c / kc * Math.PI / 2; rings.push([pts[N - 1].map((x, d) => x + T[N - 1][d] * Math.sin(th) * capR * tp), frames[N - 1][0], frames[N - 1][1], Math.cos(th) * tp, T[N - 1].map(x => x * Math.sin(th)), Math.cos(th)]); }
  const base = B.pos.length / 3; let run = 0;
  rings.forEach(([c, nv, bv, scl, tn, w], ri) => {
    if (ri) run += Math.hypot(...sub(c, rings[ri - 1][0]));
    for (let j = 0; j < M; j++) {
      const [sx, sy, nx, ny] = sec[j], shrinkX = sx * scl, shrinkY = sy * scl;
      B.pos.push(...c.map((x, d) => x + bv[d] * shrinkX + nv[d] * shrinkY));
      B.nrm.push(...nrmz([0, 1, 2].map(d => (bv[d] * nx + nv[d] * ny) * w + tn[d])));
      B.uv.push(run, j / M * 2 * (A + Bh));
    }
  });
  for (let r = 0; r + 1 < rings.length; r++) for (let j = 0; j < M; j++) {
    const a0 = base + r * M + j, a1 = base + r * M + (j + 1) % M, b0 = a0 + M, b1 = a1 + M;
    B.idx.push(a0, a1, b1, a0, b1, b0);
  }
  fixWinding(B, base);
}
// turn a run of triangles (from vertex `base` on) outward, judged by their vertices' normals
function fixWinding(B, base) {
  let score = 0, first = -1;
  for (let q = B.idx.length - 3; q >= 0 && B.idx[q] >= base; q -= 3) {
    first = q;
    const [ia, ib, ic] = [B.idx[q], B.idx[q + 1], B.idx[q + 2]], P3 = i => [B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]];
    const A = P3(ia), e1 = P3(ib).map((v, d) => v - A[d]), e2 = P3(ic).map((v, d) => v - A[d]);
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nn = [0, 1, 2].map(d => B.nrm[ia * 3 + d] + B.nrm[ib * 3 + d] + B.nrm[ic * 3 + d]);
    score += Math.sign(cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2]);
  }
  if (score < 0 && first >= 0) for (let q = first; q < B.idx.length; q += 3) { const t = B.idx[q + 1]; B.idx[q + 1] = B.idx[q + 2]; B.idx[q + 2] = t; }
}

// a soft part between bounds, with its piping (a tube round each seam) and its tufts' buttons
function sf(P, x0, y0, z0, x1, y1, z1, m, o = {}) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return null;
  const p = Object.assign({ s: "soft", at: [(x0 + x1) / 2, (y0 + y1) / 2, z0], size: [x1 - x0, y1 - y0, z1 - z0], m }, o);
  delete p.pipe_m; delete p.button_m;
  P.push(p);
  const f = softMap(p), c0 = [p.at[0], p.at[1], z0 + (z1 - z0) / 2], k = 14;
  const loop = cz => {
    const out = [], side = [[-1, -1, 1, 0], [1, -1, 0, 1], [1, 1, -1, 0], [-1, 1, 0, -1]];
    for (const [sx, sy, dx, dy] of side) for (let i = 0; i < k; i++) {
      const t = i / k * 2, c = [sx + dx * t, sy + dy * t, cz].map(v => Math.sin(v * Math.PI / 2));
      const q = f(p.stand ? [c[0], c[1], c[2]] : c), a = (p.rz || 0) * Math.PI / 180;
      out.push([c0[0] + q[0] * Math.cos(a) - q[1] * Math.sin(a), c0[1] + q[0] * Math.sin(a) + q[1] * Math.cos(a), c0[2] + q[2]]);
    }
    return out;
  };
  if (p.pipe > 0 && p.seam !== "none") for (const cz of p.seam === "knife" ? [0] : [-1, 1])
    P.push({ s: "pipe", at: [0, 0, 0], size: [0, 0, 0], pts: loop(cz), r: p.pipe, m: o.pipe_m || m });
  const [tx, ty] = (p.tufts || [0, 0]).map(v => Math.max(0, v | 0));
  for (let i = 0; i < tx; i++) for (let j = 0; j < ty; j++) {
    const u = ((i + 0.5 + (j % 2 ? 0.5 : 0)) / tx * 2 - 1) * 0.86, v = ((j + 0.5) / ty * 2 - 1) * 0.86;
    if (u >= 0.9) continue;
    const q = f([u, v, 1]);
    if (p.stand) cy(P, p.at[0] + q[0], p.at[1] + q[1] + 0.004, c0[2] + q[2], 0.011, 0.006, o.button_m || "fabric_2", { n: 10, axis: "-y" });
    else cy(P, p.at[0] + q[0], p.at[1] + q[1], c0[2] + q[2] - 0.004, 0.011, 0.006, o.button_m || "fabric_2", { n: 10 });
  }
  return p;
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
  } else if (s.style === "flush" || s.style === "dome" || s.style === "ring") {
    // round LED fittings on the ceiling (the user, 2026-10-31: "a circular rim with a glass circle, and those kinds of
    // variations"): flush, a slim drum with its frosted face nearly level with the rim; dome, a shallow rim with a domed
    // diffuser hanging under it; ring, a glowing annulus between the rim and a hub. The glass is `emit` (it glows while
    // the light it's the fitting of is on), the rim the trim material
    const r = Math.min(W, D) / 2, rim = s.style === "dome" ? Math.min(H, Math.max(0.01, H * 0.22)) : H;
    cy(P, 0, 0, H, r, rim, s.slot, { axis: "-z", ri: r - t, m2: s.slot });                    // the rim, from the ceiling down
    cy(P, 0, 0, H, r - t + 0.0005, 0.003, "inner", { axis: "-z" });                           // closed above
    if (s.style === "dome") {
      const rd = r - t + 0.0005, dz = H - rim + 0.002;                                     // the diffuser, just inside the rim
      lathe(P, 0, 0, 0, [[0, 0], [rd * 0.45, dz * 0.05], [rd * 0.75, dz * 0.22], [rd * 0.93, dz * 0.55], [rd, dz], [0, dz]], "emit", { n: 48 });
    } else if (s.style === "ring") {
      const hub = Math.max(t * 2, r * 0.55);
      cy(P, 0, 0, H - 0.004, hub, H - 0.004 - lin, s.slot, { axis: "-z", ri: Math.max(0.001, hub - t), m2: s.slot });   // the hub's own rim (under the cap)
      cy(P, 0, 0, lin + 0.002, hub - t + 0.0005, 0.002, s.slot, { axis: "-z" });           // its face, the light's colour off
      cy(P, 0, 0, lin + 0.002, r - t + 0.0005, 0.002, "emit", { axis: "-z", ri: hub });   // the glowing ring between
    } else {
      cy(P, 0, 0, lin + 0.002, r - t + 0.0005, 0.002, "emit", { axis: "-z" });            // the frosted face
    }
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
  const soft = s.soft !== false, seed = s.seed | 0, dv = clamp(s.duvet, 0, 1), np = Math.max(0, s.pillows | 0), pz = Math.min(H, top + 0.12);
  if (soft) sf(P, -W / 2 + 0.01, y0 + 0.01, base, W / 2 - 0.01, y1 - 0.005, top - 0.03, s.mattress, { seam: "box", puff: 0.12, b: Math.max(0.02, sb), pipe: 0.005, seed,
    tufts: s.quilted ? [Math.max(2, Math.round(W / 0.22)), Math.max(4, Math.round((y1 - y0) / 0.22))] : [0, 0], tuft: 0.18, wrinkle: 0.002, n: 24 });
  else bx(P, -W / 2 + 0.01, y0 + 0.01, base, W / 2 - 0.01, y1 - 0.005, top - 0.03, s.mattress, { b: sb });
  if (dv > 0) {
    if (soft) sf(P, -W / 2, y0, top - 0.06, W / 2, y0 + (y1 - y0) * dv, top, s.duvet_slot, { seam: "none", puff: 0.5, b: 0.03, wrinkle: 0.012, seed: seed + 3, n: 26 });
    else bx(P, -W / 2, y0, top - 0.05, W / 2, y0 + (y1 - y0) * dv, top, s.duvet_slot, { b: Math.min(sb, 0.024), skip: "-z" });
  }
  for (let i = 0; i < np && pz > top; i++) {
    const pw = (W - 0.08) / np, x0 = -W / 2 + 0.04 + i * pw;
    if (soft) sf(P, x0 + 0.01, y1 - 0.42, top - 0.03, x0 + pw - 0.01, y1 - 0.05, pz, "white", { seam: "knife", puff: 0.55, pinch: 0.8, b: 0.03, wrinkle: 0.005, seed: seed + 10 + i, pipe: 0 });
    else bx(P, x0 + 0.01, y1 - 0.42, top - 0.03, x0 + pw - 0.01, y1 - 0.05, pz, "white", { b: Math.min(0.05, sb * 1.5) });
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
  const soft = s.soft !== false, seed = s.seed | 0, pipe = clamp(s.piping, 0, 0.012), wr = clamp(s.wrinkle, 0, 0.02);
  for (let i = 0; i < n; i++) {
    const x0 = xa + i * cw + g / 2, x1 = xa + (i + 1) * cw - g / 2;
    if (soft) {
      sf(P, x0, front(i) + 0.005, plinth, x1, yb - bt - cush - g, sh, s.slot, { seam: "box", puff: 0.2, b: Math.max(0.02, sb * 0.8), pipe, wrinkle: wr, seed: seed + i });
      sf(P, x0, yb - bt - cush, sh - 0.005, x1, yb - bt + 0.01, H, s.slot, { seam: "box", puff: 0.35, b: Math.max(0.025, sb), pipe, wrinkle: wr * 1.3, seed: seed + 20 + i,
        stand: true, tufts: s.tufts ? [2, 3] : [0, 0], tuft: 0.3 });
    } else {
      bx(P, x0, front(i) + 0.005, plinth, x1, yb - bt - cush - g, sh, s.slot, { b: sb });
      bx(P, x0, yb - bt - cush, sh - 0.005, x1, yb - bt + 0.01, H, s.slot, { b: sb });
    }
  }
}
function cushionGen(s, P) {
  const [W, D, H] = s.size;
  sf(P, -W / 2, -D / 2, 0, W / 2, D / 2, H, s.slot, { seam: s.seam, puff: s.puff, pinch: s.pinch, b: s.b, pipe: s.seam === "none" ? 0 : s.pipe, tufts: s.tufts, tuft: s.tuft,
    wrinkle: s.wrinkle, seed: s.seed, stand: s.stand, lean: s.lean, n: s.n, pipe_m: s.pipe_slot, button_m: s.button_slot });
}
// a door leaf: flush, raised or flat (shaker) panels, glass, louvres, a shoji's lattice, or a sliding slab. Its hinges'
// knuckles stand on its hinge edge, on the face it opens toward (its front, -y); the mesh's pivot is their axis
// (doorPivot), so in Unreal the leaf turns round its hinges. The handle and the frame are their own things (handle,
// door_frame): plan.py puts the three together from a story door's kit, and in Unreal they're tagged door_part:*.
// butt hinges: the barrel on the hinge edge, half proud of the edge and the face (it straddles the gap); its knuckles
// alternate between the leaf on the door (screwed to its edge) and the leaf on the frame (screwed to the jamb), with
// the pin through them and a tip at each end. The door's half turns with the door; the frame's half stays.
const KNUCKLE = 0.0065;
const kR = s => clamp((s.barrel ?? 2 * KNUCKLE) / 2, 0.003, 0.012);              // the barrel's radius
const hingeAxis = (s, W, T) => [(s.hinge === "right" ? 1 : -1) * (W / 2 - kR(s) * 0.5), -T / 2 + kR(s) * 0.5];
// a hinge's mortise (the thin layer cut away for its plate) and its plate, in y and z: from the barrel's front to the
// plate's back edge, the hinge's height (plus half a millimetre of clearance)
function hingeCut(s, T, ay, zc) {
  const kr = kR(s), hh = clamp(s.hinge_h ?? 0.1, 0.03, 0.25), y0 = ay + kr * 0.6, y1 = Math.min(T / 2 - 0.003, y0 + clamp(s.hinge_w ?? 0.026, 0.008, 0.08));
  return { y0, y1, z0: zc - hh / 2, z1: zc + hh / 2, cut: [Math.max(-T / 2, ay - kr), y1 + 0.0005, zc - hh / 2 - 0.0005, zc + hh / 2 + 0.0005] };
}
// a face's skin (x0..x1 thick) over y0..y1 × z0..z1, with rectangles [ya, yb, za, zb] left open: a mortise's pocket
function skinWithHoles(P, x0, x1, y0, y1, z0, z1, holes, m) {
  const ys = [...new Set([y0, y1, ...holes.flatMap(h => [clamp(h[0], y0, y1), clamp(h[1], y0, y1)])])].sort((a, b) => a - b);
  const zs = [...new Set([z0, z1, ...holes.flatMap(h => [clamp(h[2], z0, z1), clamp(h[3], z0, z1)])])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < ys.length; i++) {
    let run = null;
    const flush = () => { if (run) bx(P, x0, ys[i], run[0], x1, ys[i + 1], run[1], m); run = null; };
    for (let j = 0; j + 1 < zs.length; j++) {
      const my = (ys[i] + ys[i + 1]) / 2, mz = (zs[j] + zs[j + 1]) / 2;
      if (holes.some(h => my > h[0] && my < h[1] && mz > h[2] && mz < h[3])) { flush(); continue; }
      if (run) run[1] = zs[j + 1]; else run = [zs[j], zs[j + 1]];
    }
    flush();
  }
}
function doorPivot(s) { const [W, T] = s.size; return s.style === "slide" || s.style === "shoji" ? [0, 0, 0] : [...hingeAxis(s, W, T), 0]; }
export function hingeZs(n, H) { return Array.from({ length: Math.max(0, n | 0) }, (_, k) => n === 1 ? H / 2 : k === 0 ? 0.25 : k === n - 1 ? H - 0.2 : 0.25 + (H - 0.45) * k / (n - 1)); }
// one hinge's half: its knuckles (the door's: 0, 2, 4...; the frame's: 1, 3...), its leaf plate and screws, the tips
function hingeHalf(P, s, ax, ay, zc, half, plate) {
  const kr = kR(s), hh = clamp(s.hinge_h ?? 0.1, 0.05, 0.2), nk = Math.max(3, (s.knuckles | 0) || 5), seg = hh / nk, m = s.hinge_slot || "metal", g = 0.0006;
  for (let i = half; i < nk; i += 2) {
    const z0 = zc - hh / 2 + i * seg + g / 2, L = seg - g, e = Math.min(0.0008, L / 4);
    lathe(P, ax, ay, z0, [[0, 0], [kr - e, 0], [kr, e], [kr, L - e], [kr - e, L], [0, L]], m, { n: 32 });
  }
  if (half === 0 && s.hinge_tip !== "none") for (const [z, up] of [[zc + hh / 2, true], [zc - hh / 2, false]]) {
    const tip = s.hinge_tip === "flat" ? [[0, 0], [kr * 0.8, 0], [kr * 0.8, 0.0012], [kr * 0.5, 0.0018], [0, 0.0018]]
                                       : [[0, 0], [kr * 0.55, 0], [kr * 0.5, 0.001], [kr * 0.75, 0.0035], [kr * 0.6, 0.0065], [kr * 0.3, 0.0078], [0, 0.008]];
    lathe(P, ax, ay, z, tip, m, { n: 28, axis: up ? "z" : "-z" });
  }
  // the plate: [x of the face it's screwed to, which way out of it (+1/-1), its y from, y to]; in its mortise it's
  // flush with the face, otherwise just proud of it
  const [fx, out, y0, y1] = plate, ht = clamp(s.hinge_t ?? 0.0025, 0.0008, 0.006);
  const [xa, xb] = s.mortise !== false ? [Math.min(fx, fx - out * ht), Math.max(fx, fx - out * ht)] : out > 0 ? [fx - 0.0004, fx + 0.0006] : [fx - 0.0006, fx + 0.0004];
  bx(P, xa, y0, zc - hh / 2 + 0.002, xb, y1, zc + hh / 2 - 0.002, m, { b: 0.0002 });
  for (const zs of [-hh * 0.3, 0, hh * 0.3]) {                      // countersunk screws, their heads just proud
    lathe(P, out > 0 ? xb : xa, (y0 + y1) / 2 + (zs ? 0 : (y1 - y0) * 0.15), zc + zs, [[0, 0], [0.0032, 0], [0.003, 0.0004], [0.0018, 0.0007], [0, 0.0008]], m, { n: 16, axis: out > 0 ? "x" : "-x" });
  }
}
function doorGen(s, P) {
  const [W, T, H] = s.size, st = s.style, b = s.bevel, slab = (xa, xb, za, zb, m, o, t = T) => bx(P, xa, -t / 2, za, xb, t / 2, zb, m, Object.assign({ b }, o || {}));
  const hinged = st !== "slide" && st !== "shoji", side = s.hinge === "right" ? 1 : -1, ht = clamp(s.hinge_t ?? 0.0025, 0.0008, 0.006);
  const mort = hinged && s.mortise !== false && (s.hinges | 0) > 0;
  // with mortises, the hinge edge's last few millimetres are a skin with the pockets left open (below)
  const XL = -W / 2 + (mort && side < 0 ? ht : 0), XR = W / 2 - (mort && side > 0 ? ht : 0);
  if (st === "flush" || st === "slide") slab(XL, XR, 0, H, s.slot);
  else {
    const rw = clamp(s.rail, 0.02, Math.min(W, H) / 3), [gc, gr] = (s.grid || [1, 2]).map(v => Math.max(1, v | 0)), shoji = st === "shoji";
    const bot = shoji ? rw : rw * 1.6, mw = shoji ? 0.014 : rw * 0.75, tb = shoji ? T * 0.7 : T;
    slab(XL, -W / 2 + rw, 0, H, s.slot); slab(W / 2 - rw, XR, 0, H, s.slot);
    slab(-W / 2 + rw, W / 2 - rw, 0, bot, s.slot); slab(-W / 2 + rw, W / 2 - rw, H - rw, H, s.slot);
    const ix0 = -W / 2 + rw, ix1 = W / 2 - rw, iz0 = bot, iz1 = H - rw;
    const pw = (ix1 - ix0 - mw * (gc - 1)) / gc, ph = (iz1 - iz0 - mw * (gr - 1)) / gr;
    for (let i = 1; i < gc; i++) { const x = ix0 + i * pw + (i - 1) * mw; slab(x, x + mw, iz0, iz1, s.slot, { b: 0.0008 }, tb); }
    for (let i = 0; i < gc; i++) for (let j = 0; j < gr; j++) {
      const x0 = ix0 + i * (pw + mw), x1 = x0 + pw, z0 = iz0 + j * (ph + mw), z1 = z0 + ph;
      if (j > 0) slab(x0, x1, z0 - mw, z0, s.slot, { b: 0.0008 }, tb);                       // the rail between panels
      const rc = clamp(s.recess, 0.001, T / 3);
      if (st === "panels" || st === "shaker") {
        slab(x0, x1, z0, z1, s.slot, { b: 0.001 }, T - 2 * rc);                             // the panel, set back each side
        if (st === "panels") { const e = Math.min(0.04, pw / 5, ph / 5); slab(x0 + e, x1 - e, z0 + e, z1 - e, s.slot, { b: 0.004 }, T - rc); }   // its raised field
      } else if (st === "glass") bx(P, x0, -0.003, z0, x1, 0.003, z1, "glass");
      else if (st === "louvre") { const k = Math.max(2, Math.round((z1 - z0) / 0.035)); for (let q = 0; q < k; q++) { const z = z0 + (q + 0.5) * (z1 - z0) / k; bx(P, x0, -T * 0.3, z - 0.009, x1, T * 0.3, z + 0.009, s.slot, { b: 0.001 }); } }
      else if (shoji) bx(P, x0, T * 0.2, z0, x1, T * 0.2 + 0.0015, z1, "paper");
    }
  }
  if (!hinged) return;
  const [ax, ay] = hingeAxis(s, W, T), zcs = hingeZs(s.hinges, H), cuts = zcs.map(zc => hingeCut(s, T, ay, zc));
  if (mort) skinWithHoles(P, side < 0 ? -W / 2 : W / 2 - ht, side < 0 ? -W / 2 + ht : W / 2, -T / 2, T / 2, 0, H, cuts.map(c => c.cut), s.slot);
  if ((s.hinge_model || "kit") === "kit") zcs.forEach((zc, i) =>                 // the door's half of each hinge, on its edge
    hingeHalf(P, s, ax, ay, zc, 0, [side * W / 2, side, cuts[i].y0, cuts[i].y1]));
}
// a door's handles, both sides of a leaf `through` thick, centred on the box (the plan puts the box's middle where
// the grip goes). lever, bar (a long pull), knob, pull (a short horizontal one), recess (a sliding door's flush cup)
function handleGen(s, P) {
  const [W, D, H] = s.size, th = clamp(s.through, 0.005, D), pj = (D - th) / 2, zc = H / 2, m = s.slot, dir = s.points === "right" ? 1 : -1;
  const classic = s.style === "classic";
  for (const sd of [-1, 1]) {
    const face = sd * th / 2, ax = sd < 0 ? "-y" : "y", Y = d => face + sd * d;     // Y(d): d out from this face
    const out = (a, b2) => sd < 0 ? [face - b2, face - a] : [face + a, face + b2];
    const rose = (R, len) => {                                    // a turned rose, domed, its edge rounded
      if (s.rose === "round") {
        const e = Math.min(0.0015, len * 0.25);
        lathe(P, 0, face, zc, classic ? [[0, 0], [R, 0], [R, 0], [R, len * 0.35], [R * 0.9, len * 0.7], [R * 0.55, len * 0.9], [R * 0.5, len], [R * 0.25, len], [0, len]]
                                      : [[0, 0], [R, 0], [R, 0], [R, len - e], [R - e * 0.6, len - e * 0.2], [R - e, len], [R * 0.6, len], [R * 0.25, len], [0, len]], m, { axis: ax, n: 48 });
      } else {
        const [y0, y1] = out(0, len), hw = s.rose === "plate" ? Math.min(0.025, W / 4) : R, hh = s.rose === "plate" ? Math.min(H / 2 - 0.002, 0.11) : R;
        bx(P, -hw, y0, zc - hh, hw, y1, zc + hh, m, { b: Math.min(0.0015, len * 0.3) });
      }
    };
    if (s.lock && s.kind !== "recess" && zc >= 0.085) {           // an escutcheon and its keyhole
      lathe(P, 0, face, zc - 0.07, [[0, 0], [0.013, 0], [0.013, 0.002], [0.011, 0.0035], [0, 0.0035]], m, { axis: ax, n: 32 });
      const [y0, y1] = out(0.0034, 0.0038);
      lathe(P, 0, Y(0.0034), zc - 0.066, [[0, 0], [0.0028, 0], [0.0028, 0.0004], [0, 0.0004]], "hole", { axis: ax, n: 16 });
      bx(P, -0.0013, y0, zc - 0.078, 0.0013, y1, zc - 0.066, "hole");
    }
    if (s.kind === "lever") {
      const rl = Math.min(0.008, pj * 0.2), nl = pj * 0.62;
      rose(Math.min(0.026, H / 2 - 0.001, W / 2), rl);
      lathe(P, 0, face, zc, [[0, 0], [0.0105, 0], [0.0105, rl + 0.002], [0.009, rl + 0.006], [0.009, nl - 0.004], [0.0105, nl], [0, nl]], m, { axis: ax, n: 32 });
      const L = W / 2 - 0.006, yl = pj * 0.8, half = Math.min(0.0055, (pj - yl) + 0.004);
      const ctrl = classic ? [[0, yl, 0], [L * 0.3, yl + 0.002, 0.001], [L * 0.7, yl + 0.004, -0.002], [L, yl - 0.002, -0.006]]   // a scroll, dipping at the tip
                           : [[-0.002, yl, 0], [L * 0.45, yl, 0], [L * 0.8, yl, 0], [L, yl - 0.008, 0]];                          // a return: the tip turns back to the door
      sweep(P, smoothPath(ctrl.map(([x, d, z]) => [dir * x, Y(Math.min(d, pj - half)), zc + z]), 8), { a: 0.0095, b: half, r: Math.min(0.0045, half) }, m, { up: [0, 0, 1] });
    } else if (s.kind === "bar") {
      const r = Math.min(0.0125, pj * 0.22, W / 2 - 0.001), yb = pj - r, sl = yb;
      for (const z of [0.035, H - 0.035]) lathe(P, 0, face, z, [[0, 0], [0.012, 0], [0.012, 0.002], [0.0075, 0.007], [0.0075, sl], [0, sl]], m, { axis: ax, n: 28 });
      sweep(P, [[0, Y(yb), r + 0.002], [0, Y(yb), H / 2], [0, Y(yb), H - r - 0.002]], { a: r, b: r, r }, m, { up: [1, 0, 0] });
    } else if (s.kind === "knob") {
      const R = Math.min(0.029, W / 2 - 0.001, H / 2 - 0.001), rl = Math.min(0.008, pj * 0.18), L = pj;
      rose(Math.min(0.026, H / 2 - 0.001), rl);
      const prof = classic                                         // a classic mushroom, or a modern ball on a slim neck
        ? [[0, 0], [0.011, 0], [0.011, rl + 0.002], [0.0085, L * 0.3], [0.009, L * 0.45], [R * 0.75, L * 0.62], [R, L * 0.78], [R * 0.97, L * 0.9], [R * 0.75, L * 0.98], [0, L]]
        : [[0, 0], [0.01, 0], [0.01, rl + 0.002], [0.0075, L * 0.32], [R * 0.55, L * 0.45], [R * 0.92, L * 0.6], [R, L * 0.74], [R * 0.93, L * 0.88], [R * 0.6, L * 0.97], [0, L]];
      lathe(P, 0, face, zc, prof, m, { axis: ax, n: 48 });
    } else if (s.kind === "pull") {
      const r = Math.min(0.006, H / 2 - 0.001, pj * 0.2), yb = pj - r, xs = W / 2 - 0.014;
      for (const x of [-xs, xs]) lathe(P, x, face, zc, [[0, 0], [0.008, 0], [0.008, 0.0015], [0.005, 0.005], [0.005, yb], [0, yb]], m, { axis: ax, n: 24 });
      sweep(P, [[-(W / 2 - r - 0.001), Y(yb), zc], [0, Y(yb), zc], [W / 2 - r - 0.001, Y(yb), zc]], { a: r, b: r, r }, m, { up: [0, 0, 1] });
    } else {                                                                    // recess: a flush cup and its rim
      const [y0, y1] = out(-0.0005, Math.max(0.001, pj)), outer = sd < 0 ? y0 : y1;
      bx(P, -W / 2, y0, 0, W / 2, y1, H, m, { b: Math.min(0.001, Math.max(0.0002, pj * 0.3)) });
      bx(P, -W / 2 + 0.004, outer - 0.0002, 0.004, W / 2 - 0.004, outer + 0.0002, H - 0.004, "hole", { b: 0.0001 });
    }
  }
}
// the lining of a doorway (the reveal, sides and head) and the stop the door closes against, behind the leaf
function frameGen(s, P) {
  const [W, T, H] = s.size, ln = clamp(s.lining, 0.005, W / 4), m = s.slot, hs = s.hinge === "right" ? 1 : s.hinge === "left" ? -1 : 0;
  const ht = clamp(s.hinge_t ?? 0.0025, 0.0008, Math.min(0.006, ln / 2)), mort = hs && s.leaf_w > 0 && s.mortise !== false && (s.hinges | 0) > 0;
  for (const sd of [-1, 1]) {
    const outer = sd * W / 2, inner = sd * (W / 2 - ln);
    if (!(mort && sd === hs)) { bx(P, Math.min(outer, inner), -T / 2, 0, Math.max(outer, inner), T / 2, H, m, { b: 0.001 }); continue; }
    const cutAt = inner + sd * ht, lt = clamp(s.leaf_t, 0.01, T), [, ay] = hingeAxis(s, s.leaf_w, lt);
    bx(P, Math.min(outer, cutAt), -T / 2, 0, Math.max(outer, cutAt), T / 2, H, m, { b: 0.001 });
    const cuts = hingeZs(s.hinges, s.leaf_h || H - ln).map(z => hingeCut(s, lt, ay, (s.leaf_z || 0) + z).cut);
    skinWithHoles(P, Math.min(inner, cutAt), Math.max(inner, cutAt), -T / 2, T / 2, 0, H, cuts, m);
  }
  bx(P, -W / 2 + ln, -T / 2, H - ln, W / 2 - ln, T / 2, H, m, { b: 0.001 });
  if (s.stop) {
    const st = clamp(s.stop_t, 0.004, 0.03), y0 = Math.min(T / 2 - 0.005, clamp(s.leaf_t, 0.01, T) / 2 + 0.001), y1 = Math.min(T / 2, y0 + 0.025);
    bx(P, -W / 2 + ln, y0, 0, -W / 2 + ln + st, y1, H - ln, m, { b: 0.001 }); bx(P, W / 2 - ln - st, y0, 0, W / 2 - ln, y1, H - ln, m, { b: 0.001 });
    bx(P, -W / 2 + ln + st, y0, H - ln - st, W / 2 - ln - st, y1, H - ln, m, { b: 0.001 });
  }
  if ((s.hinge === "left" || s.hinge === "right") && s.leaf_w > 0) {             // the frame's half of each hinge, on the jamb
    const side = s.hinge === "right" ? 1 : -1, lt = clamp(s.leaf_t, 0.01, T), [ax, ay] = hingeAxis(s, s.leaf_w, lt), jamb = side * (W / 2 - ln);
    const zcs = hingeZs(s.hinges, s.leaf_h || H - ln).map(z => (s.leaf_z || 0) + z), cuts = zcs.map(zc => hingeCut(s, lt, ay, zc));
    if ((s.hinge_model || "kit") === "kit") zcs.forEach((zc, i) => hingeHalf(P, s, ax, ay, zc, 1, [jamb, -side, cuts[i].y0, cuts[i].y1]));
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
    if (q.s === "soft" || q.s === "pipe" || q.s === "lathe" || q.s === "sweep") { P.push(Object.assign({}, q, { at: q.at.map(Number), size: q.size.map(v => Math.max(0, +v)), m: q.m || "body" })); continue; }
    P.push({ s: q.s, at: q.at.map(Number), size: q.size.map(v => Math.max(0.0005, +v)), m: q.m || "body",
             b: +q.b || 0, rz: +q.rz || 0, axis: q.axis, ri: +q.ri || 0 });
  }
}
// ---- little things (docs/IMMERSION.md) -----------------------------------------------------------------------------
// Kettles, hobs, pots, cups, teapots, ashtrays, cigarettes and their packs, lighters, clocks, rice cookers, mosquito
// coils, incense, phones, taps and candles: each drawn at its real size from its kind (style), then fitted into its box
// with one even scale (fit: its shape kept, centred, its base on the box's floor; a wall thing's back on the wall). Each
// names its sockets, the points its life's effects come from (a spout's steam, a tip's smoke, a ring's glow, a dial's
// hands): {at, n (the way it points), r, ...} in item space, moved with the parts.
let REAL = false;                                       // realSize: fit only centres, it doesn't scale
function fit(s, P, S, o = {}) {
  if (!P.length) return 1;
  const { lo, hi } = bounds(P), [W, D, H] = s.size, e = [0, 1, 2].map(k => Math.max(1e-6, hi[k] - lo[k]));
  const f = REAL ? 1 : Math.min(W / e[0], D / e[1], H / e[2]);
  const c = [(lo[0] + hi[0]) / 2, o.back ? hi[1] - D / 2 / f : (lo[1] + hi[1]) / 2, lo[2]], mv = v => v.map((x, k) => (x - c[k]) * f);
  for (let i = 0; i < P.length; i++) {
    const q = P[i], q2 = scalePart(q, [f, f, f]);
    q2.at = mv(q.at); if (q.pts) q2.pts = q.pts.map(mv);
    for (const k of ["b", "r", "pipe"]) if (q[k]) q2[k] = q[k] * f;
    P[i] = q2;
  }
  for (const q of Object.values(S)) {
    if (!q || !q.at) continue;
    q.at = mv(q.at); if (q.back) q.back = mv(q.back);
    for (const k of ["r", "w", "h", "len"]) if (typeof q[k] === "number") q[k] *= f;
    if (q.prof) q.prof = q.prof.map(([r, z]) => [r * f, (z - c[2]) * f]);
  }
  return f;
}
// a little thing's own size (the box it fills at scale 1), for its preset's size and the kit maker's "Real size"
export function realSize(spec, presets) {
  REAL = true;
  try { const b = build(spec, presets), { lo, hi } = bounds(b.parts); return hi.map((v, k) => Math.round((v - lo[k]) * 1e4) / 1e4); }
  finally { REAL = false; }
}
const deg = a => a * 180 / Math.PI;
// a profile's radius and outward normal at a height (a lathe's [[r, t], ...], t rising): where a bump or a spout sits
function profAt(prof, t) {
  for (let i = 0; i + 1 < prof.length; i++) {
    const [r0, t0] = prof[i], [r1, t1] = prof[i + 1];
    if ((t - t0) * (t - t1) > 0 || t1 === t0) continue;
    const k = (t - t0) / (t1 - t0), L = Math.hypot(r1 - r0, t1 - t0) || 1;
    return { r: r0 + (r1 - r0) * k, n: [(t1 - t0) / L, -(r1 - r0) / L] };
  }
  return { r: prof[prof.length - 1][0], n: [1, 0] };
}

function kettleGen(s, P, R, warn, S) {
  const m = s.slot, tr = s.trim_slot, st = s.style;
  if (st === "gooseneck") {
    // a pour-over kettle: a slim body on a round base with its readout, the long thin spout, a wooden handle
    lathe(P, 0, 0, 0, [[0, 0], [0.076, 0], [0.078, 0.002], [0.078, 0.015], [0.075, 0.019], [0, 0.019]], "plastic_2", { n: 56 });
    bx(P, -0.013, -0.0786, 0.005, 0.013, -0.074, 0.0155, "lcd", { b: 0.001 });
    S.lcd = { at: [0, -0.0789, 0.0103], n: [0, -1, 0], w: 0.022, h: 0.008, up: [0, 0, 1] };
    const zb = 0.019, zl = zb + 0.111;
    lathe(P, 0, 0, zb, [[0, 0], [0.055, 0], [0.059, 0.004], [0.06, 0.012], [0.06, 0.104], [0.0585, 0.11], [0.0565, 0.112], [0, 0.112]], m, { n: 56 });
    lathe(P, 0, 0, zl, [[0, 0], [0.053, 0], [0.053, 0.002], [0.05, 0.005], [0.014, 0.008], [0, 0.008]], m, { n: 56 });
    lathe(P, 0, 0, zl + 0.007, [[0, 0], [0.01, 0], [0.012, 0.007], [0.0115, 0.014], [0.008, 0.018], [0, 0.019]], tr, { n: 28 });
    const sp = smoothPath([[0, -0.04, zb + 0.022], [0, -0.068, zb + 0.026], [0, -0.092, zb + 0.05], [0, -0.104, zb + 0.095], [0, -0.115, zb + 0.13], [0, -0.14, zb + 0.145], [0, -0.165, zb + 0.14]], 6);
    sweep(P, sp, { a: 0.0052, b: 0.0052, r: 0.0052 }, m, { up: [1, 0, 0], taper: 0.7 });
    const e = sp[sp.length - 1], d = v3.nrm(v3.sub(e, sp[sp.length - 2]));
    S.spout = { at: v3.add(e, v3.mul(d, 0.004)), n: d, r: 0.0035 };
    sweep(P, smoothPath([[0, 0.048, zb + 0.1], [0, 0.082, zb + 0.104], [0, 0.103, zb + 0.088], [0, 0.106, zb + 0.055], [0, 0.094, zb + 0.032], [0, 0.056, zb + 0.026]], 6), { a: 0.009, b: 0.0075, r: 0.006 }, tr, { up: [1, 0, 0] });
    S.lid = { at: [0, 0, zl + 0.026], n: [0, 0, 1], r: 0.045 }; S.switch = { at: [0, -0.077, 0.01] };
  } else if (st === "whistling") {
    // a stovetop kettle, enamelled: wide and low, the spout out of its lower front with the whistle on, a handle over the top
    lathe(P, 0, 0, 0, [[0, 0], [0.084, 0], [0.09, 0.003], [0.097, 0.012], [0.1, 0.028], [0.098, 0.046], [0.09, 0.066], [0.077, 0.084], [0.064, 0.097], [0.056, 0.102], [0.052, 0.104], [0, 0.104]], m, { n: 64 });
    const zl = 0.1035;
    lathe(P, 0, 0, zl, [[0, 0], [0.05, 0], [0.0505, 0.003], [0.046, 0.009], [0.028, 0.015], [0, 0.0165]], m, { n: 48 });
    lathe(P, 0, 0, zl + 0.015, [[0, 0], [0.009, 0], [0.007, 0.006], [0.0115, 0.013], [0.0105, 0.018], [0.006, 0.0205], [0, 0.021]], tr, { n: 28 });
    const s0 = [0, -0.072, 0.03], s1 = [0, -0.124, 0.094], d = v3.nrm(v3.sub(s1, s0));
    sweep(P, [s0, v3.add(s0, v3.mul(d, 0.03)), s1], { a: 0.016, b: 0.016, r: 0.016 }, m, { up: [1, 0, 0], taper: 0.55, caps: false });
    const w0 = v3.sub(s1, v3.mul(d, 0.004));
    lathe(P, w0[0], w0[1], w0[2], [[0, 0], [0.0102, 0], [0.0102, 0.015], [0.009, 0.0185], [0.0042, 0.019], [0.0042, 0.019], [0.0036, 0.0172], [0, 0.0172]], tr, { dir: d, n: 28 });
    S.spout = { at: v3.add(w0, v3.mul(d, 0.021)), n: d, r: 0.004 };
    sweep(P, smoothPath([[0, -0.056, 0.098], [0, -0.06, 0.135], [0, -0.04, 0.175], [0, 0, 0.185], [0, 0.04, 0.175], [0, 0.06, 0.135], [0, 0.056, 0.098]], 6), { a: 0.0045, b: 0.003, r: 0.003 }, "steel", { up: [1, 0, 0] });
    sweep(P, smoothPath([[0, -0.042, 0.172], [0, -0.02, 0.183], [0, 0.02, 0.183], [0, 0.042, 0.172]], 6), { a: 0.011, b: 0.0095, r: 0.008 }, tr, { up: [1, 0, 0] });
    S.lid = { at: [0, 0, zl + 0.036], n: [0, 0, 1], r: 0.045 }; S.base = { at: [0, 0, 0], r: 0.085 };
  } else if (st === "tetsubin") {
    // cast iron: a squat round body pebbled with arare, a short spout, the lid and its knob, the arched handle (tsuru)
    const prof = [[0, 0], [0.058, 0], [0.066, 0.003], [0.08, 0.014], [0.09, 0.032], [0.093, 0.05], [0.089, 0.067], [0.078, 0.082], [0.06, 0.094], [0.044, 0.1], [0.04, 0.101], [0, 0.101]];
    lathe(P, 0, 0, 0, prof, m, { n: 64 });
    [0.056, 0.067, 0.077, 0.086].forEach((z, row) => {
      const { r, n: [nr, nt] } = profAt(prof, z), cnt = Math.round(2 * Math.PI * r / 0.0088);
      for (let i = 0; i < cnt; i++) {
        const a = (i + (row % 2) * 0.5) / cnt * 2 * Math.PI, c = Math.cos(a), sn = Math.sin(a);
        lathe(P, c * (r - 0.0004), sn * (r - 0.0004), z, [[0, 0], [0.0027, 0], [0.0024, 0.0011], [0.0014, 0.0021], [0, 0.0024]], m, { dir: [c * nr, sn * nr, nt], n: 8 });
      }
    });
    lathe(P, 0, 0, 0.1, [[0, 0], [0.043, 0], [0.043, 0.002], [0.04, 0.007], [0.022, 0.011], [0, 0.012]], m, { n: 48 });
    lathe(P, 0, 0, 0.111, [[0, 0], [0.0075, 0], [0.0055, 0.004], [0.009, 0.0095], [0.007, 0.0125], [0, 0.0135]], tr, { n: 24 });
    const s0 = [0, -0.07, 0.034], s1 = [0, -0.112, 0.082], d = v3.nrm(v3.sub(s1, s0));
    sweep(P, [s0, v3.add(s0, v3.mul(d, 0.03)), s1], { a: 0.0125, b: 0.0125, r: 0.0125 }, m, { up: [1, 0, 0], taper: 0.62 });
    const tip = v3.add(s1, v3.mul(d, 0.0068));
    lathe(P, tip[0], tip[1], tip[2], [[0, 0], [0.0042, 0], [0, 0.0004]], "hole", { dir: d, n: 16 });
    S.spout = { at: v3.add(tip, v3.mul(d, 0.002)), n: d, r: 0.004 };
    for (const sx of [-1, 1]) bx(P, sx < 0 ? -0.079 : 0.067, -0.006, 0.083, sx < 0 ? -0.067 : 0.079, 0.006, 0.097, m, { b: 0.002 });
    sweep(P, smoothPath([[-0.074, 0, 0.09], [-0.083, 0, 0.13], [-0.072, 0, 0.17], [-0.042, 0, 0.197], [0, 0, 0.205], [0.042, 0, 0.197], [0.072, 0, 0.17], [0.083, 0, 0.13], [0.074, 0, 0.09]], 6), { a: 0.0055, b: 0.0055, r: 0.0055 }, m, { up: [0, 1, 0] });
    S.lid = { at: [0, 0, 0.1245], n: [0, 0, 1], r: 0.04 }; S.base = { at: [0, 0, 0], r: 0.058 };
  } else {
    // an electric jug (most Japanese kitchens'): on its power base with a blue light in front, a pouring lip, a D handle
    lathe(P, 0, 0, 0, [[0, 0], [0.079, 0], [0.081, 0.003], [0.081, 0.013], [0.078, 0.018], [0.074, 0.019], [0, 0.019]], tr, { n: 56 });
    lathe(P, 0, -0.0806, 0.0095, [[0, 0], [0.0032, 0], [0.0032, 0.001], [0.0026, 0.0016], [0, 0.0017]], "led", { axis: "-y", n: 16 });
    S.led = { at: [0, -0.0824, 0.0095], n: [0, -1, 0], r: 0.0032 };
    const zb = 0.019, zl = zb + 0.1705;
    lathe(P, 0, 0, zb, [[0, 0], [0.068, 0], [0.072, 0.003], [0.0738, 0.012], [0.073, 0.06], [0.0705, 0.12], [0.067, 0.155], [0.065, 0.166], [0.064, 0.17], [0.06, 0.171], [0, 0.171]], m, { n: 56 });
    lathe(P, 0, 0, zl, [[0, 0], [0.0595, 0], [0.06, 0.003], [0.056, 0.008], [0.036, 0.0125], [0, 0.0135]], m, { n: 56 });
    sweep(P, [[0, -0.05, zl - 0.004], [0, -0.07, zl + 0.0005], [0, -0.086, zl + 0.006]], { a: 0.0045, b: 0.016, r: 0.004 }, m, { up: [0, 0, 1], taper: 0.45 });
    S.spout = { at: [0, -0.0885, zl + 0.007], n: v3.nrm([0, -1, 0.3]), r: 0.006 };
    sweep(P, smoothPath([[0, 0.05, zl - 0.006], [0, 0.088, zl - 0.002], [0, 0.112, zl - 0.02], [0, 0.117, zl - 0.07], [0, 0.106, zl - 0.12], [0, 0.072, zl - 0.148]], 6), { a: 0.0135, b: 0.0105, r: 0.0075 }, m, { up: [1, 0, 0] });
    bx(P, -0.007, 0.07, 0.026, 0.007, 0.094, 0.041, tr, { b: 0.003 });                         // the switch, under the handle
    bx(P, -0.0075, 0.03, zl + 0.006, 0.0075, 0.048, zl + 0.0145, tr, { b: 0.003 });             // the lid's button
    S.lid = { at: [0, 0, zl + 0.0135], n: [0, 0, 1], r: 0.05 }; S.switch = { at: [0, 0.09, 0.034] };
  }
  fit(s, P, S);
}

// a hob's zones in its cooking area: [x, y, r] (one; two side by side; two in front and a small one behind, as a
// Japanese IH; four, two big and two small)
function hobZones(n, x0, y0, x1, y1) {
  const aw = x1 - x0, ad = y1 - y0, cx = (x0 + x1) / 2, cz = (y0 + y1) / 2;
  if (n <= 1) return [[cx, cz, Math.min(0.11, Math.min(aw, ad) / 2 * 0.8)]];
  if (n === 2) { const r = Math.min(0.105, aw / 4 * 0.86, ad / 2 * 0.86); return [[cx - aw / 4, cz, r], [cx + aw / 4, cz, r * 0.82]]; }
  if (n === 3) { const r = Math.min(0.1, aw / 4 * 0.88, ad / 3.2); return [[cx - aw / 4, y0 + r + 0.01, r], [cx + aw / 4, y0 + r + 0.01, r], [cx, y1 - r * 0.72 - 0.01, r * 0.72]]; }
  const r = Math.min(0.1, aw / 4 * 0.9, ad / 4 * 0.9);
  return [[cx - aw / 4, y0 + ad / 4, r], [cx + aw / 4, y0 + ad / 4, r * 0.78], [cx - aw / 4, y0 + ad * 0.75, r * 0.78], [cx + aw / 4, y0 + ad * 0.75, r]];
}
// a hob, from its box: a ceramic one (black glass, printed rings over the elements that glow), induction (no glow, the
// same red digits), or gas (burners, the trivets over them). Built into a worktop it's only its top; with a body it's a
// table-top unit on feet (a portable IH, a gas konro with its fish grill). Sockets: ring_N (a zone's middle on the top,
// its radius, `seat` the height a pot stands at, `slot` the glowing element's), digit_N, led, knob_N.
function hobGen(s, P, R, warn, S) {
  const [W, D, H] = s.size, gas = s.style === "gas", t = clamp(s.trim || 0, 0, 0.03), nz = clamp(s.zones | 0, 1, gas ? 3 : 4);
  const zt = gas ? Math.max(0.004, H - 0.03) : H, pt = gas ? Math.min(0.003, zt) : Math.min(0.005, H), body = s.body && zt - pt > 0.02;
  const bf = gas ? 0.024 : 0.004;                       // a konro's knobs stand out of its front
  if (body) {
    bx(P, -W / 2 + 0.004, -D / 2 + bf, 0.008, W / 2 - 0.004, D / 2 - 0.004, zt - pt + 0.001, s.body_slot, { b: 0.004 });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) cy(P, sx * (W / 2 - 0.04), sy * (D / 2 - 0.04), 0, 0.012, 0.008, "rubber", { n: 16 });
  }
  if (t > 0) bx(P, -W / 2, -D / 2, zt - pt - 0.001, W / 2, D / 2, zt - 0.0012, s.trim_slot, { b: 0.0006 });
  bx(P, -W / 2 + t, -D / 2 + t, zt - pt, W / 2 - t, D / 2 - t, zt, s.slot, { b: Math.min(0.0015, pt * 0.3) });
  const cs = !gas && s.controls === "front" ? Math.min(0.07, D * 0.18) : gas && !body ? Math.min(0.06, D * 0.15) : 0;
  const Z = hobZones(nz, -W / 2 + t + 0.03, -D / 2 + t + cs + 0.015, W / 2 - t - 0.03, D / 2 - t - 0.025);
  Z.forEach(([x, y, r], k) => {
    const id = k + 1;
    if (gas) {                                            // the zone holds the burner, its spill bowl and the trivet
      const rb = clamp(r * 0.45, 0.025, 0.048), rt = Math.min(rb + 0.047, r);
      lathe(P, x, y, zt, [[0, 0], [rb + 0.024, 0], [rb + 0.027, 0.004], [rb + 0.0245, 0.005], [rb * 0.7, 0.0018], [0, 0.0018]], "black", { n: 48 });   // the spill bowl
      lathe(P, x, y, zt, [[0, 0], [rb * 0.72, 0], [rb * 0.72, 0.006], [rb, 0.008], [rb, 0.0135], [rb * 0.96, 0.0152], [0, 0.0158]], "iron", { n: 48 });  // the burner
      lathe(P, x, y, zt + 0.015, [[0, 0], [rb * 0.9, 0], [rb * 0.92, 0.0018], [rb * 0.6, 0.0036], [0, 0.0042]], "brass", { n: 40 });                    // its cap
      cy(P, x, y, zt, rt, 0.004, "iron", { ri: rt - 0.006, n: 48 });                                                                                  // the trivet's ring
      for (let i = 0; i < 5; i++) {
        const a = (i / 5 + 0.1) * 2 * Math.PI, rm = (rb + 0.008 + rt - 0.003) / 2, len = rt - 0.003 - rb - 0.008;
        P.push({ s: "box", at: [x + Math.cos(a) * rm, y + Math.sin(a) * rm, zt], size: [len, 0.005, H - zt], m: "iron", rz: deg(a), b: 0.001 });
      }
      if (body) {                                         // a konro's knob for it, on the front
        const kz = (0.008 + zt - pt) / 2, yk = -D / 2 + bf;
        lathe(P, x, yk, kz, [[0, 0], [0.019, 0], [0.02, 0.003], [0.0185, 0.016], [0.0165, 0.02], [0, 0.021]], "black", { axis: "-y", n: 32 });
        bx(P, x - 0.0016, yk - 0.0214, kz + 0.005, x + 0.0016, yk - 0.0206, kz + 0.015, "white");
        S[`knob_${id}`] = { at: [x, yk - 0.021, kz], n: [0, -1, 0] };
      }
      S[`ring_${id}`] = { at: [x, y, zt + 0.016], n: [0, 0, 1], r: rb, seat: H, kind: "gas" };
    } else {
      cy(P, x, y, zt, r + 0.006, 0.0002, "print", { ri: r + 0.0042, n: 72 });
      if (s.style === "induction") for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), r0 = r - 0.014, r1 = r - 0.004;
        sweep(P, [[x + c * r0, y + sn * r0, zt + 0.0001], [x + c * r1, y + sn * r1, zt + 0.0001]], { a: 0.0001, b: 0.001, r: 0.0001 }, "print", { up: [0, 0, 1], caps: false });
      } else {
        const nr = Math.max(3, Math.round(r / 0.0115));
        for (let j = 0; j < nr; j++) { const rad = r * (0.2 + 0.75 * j / (nr - 1)); cy(P, x, y, zt, rad + 0.0017, 0.00015, `heat_${id}`, { ri: rad - 0.0017, n: 48 }); }
        cy(P, x, y, zt, r * 0.12, 0.00015, `heat_${id}`, { n: 24 });
      }
      S[`ring_${id}`] = { at: [x, y, zt], n: [0, 0, 1], r, seat: zt, kind: s.style, slot: s.style === "ceramic" ? `heat_${id}` : undefined };
    }
  });
  if (gas && body && W > 0.45 && zt - pt > 0.12) {          // a konro's fish grill between its knobs: the door, its window, a handle
    const yk = -D / 2 + bf, gw = Math.min(0.2, W * 0.36), z0 = 0.03, z1 = zt - pt - 0.02;
    bx(P, -gw / 2, yk - 0.006, z0, gw / 2, yk + 0.001, z1, "black", { b: 0.003 });
    bx(P, -gw / 2 + 0.022, yk - 0.0068, z0 + 0.028, gw / 2 - 0.022, yk - 0.0055, z1 - 0.026, "screen", { b: 0.001 });
    bx(P, -gw / 2 + 0.03, yk - 0.016, z1 - 0.016, gw / 2 - 0.03, yk - 0.006, z1 - 0.006, "steel", { b: 0.003 });
    S.grill = { at: [0, yk - 0.007, (z0 + z1) / 2], n: [0, -1, 0] };
  }
  if (!cs) return;
  // the controls: on the glass a touch strip (each zone's symbol, minus, its digit, plus; the power and its LED),
  // on a built-in gas hob the knobs on its front strip
  const yc = -D / 2 + t + cs / 2;
  if (gas) {
    Z.forEach(([x], k) => {
      lathe(P, x, yc, zt, [[0, 0], [0.019, 0], [0.02, 0.003], [0.0185, 0.014], [0.0165, 0.018], [0, 0.019]], "black", { n: 32 });
      bx(P, x - 0.0018, yc - 0.016, zt + 0.019, x + 0.0018, yc - 0.004, zt + 0.0195, "white");
      S[`knob_${k + 1}`] = { at: [x, yc, zt + 0.019], n: [0, 0, 1] };
    });
    return;
  }
  const span = W - 2 * t - 0.12;
  Z.forEach((z, k) => {
    const gx = -W / 2 + t + 0.04 + (k + 0.5) * span / nz;
    cy(P, gx - 0.026, yc, zt, 0.0055, 0.0002, "print", { ri: 0.0043, n: 24 });
    bx(P, gx - 0.016, yc - 0.0006, zt, gx - 0.009, yc + 0.0006, zt + 0.0002, "print");
    bx(P, gx + 0.011, yc - 0.0006, zt, gx + 0.018, yc + 0.0006, zt + 0.0002, "print");
    bx(P, gx + 0.0139, yc - 0.0035, zt, gx + 0.0151, yc + 0.0035, zt + 0.0002, "print");
    S[`digit_${k + 1}`] = { at: [gx, yc, zt + 0.0003], n: [0, 0, 1], up: [0, 1, 0], w: 0.009, h: 0.014 };
  });
  const px = W / 2 - t - 0.035;
  cy(P, px, yc, zt, 0.0068, 0.0002, "print", { ri: 0.0055, n: 28 });
  bx(P, px - 0.0006, yc, zt, px + 0.0006, yc + 0.0085, zt + 0.0002, "print");
  lathe(P, px + 0.015, yc + 0.007, zt, [[0, 0], [0.0016, 0], [0.0016, 0.0002], [0, 0.0003]], "led", { n: 12 });
  S.led = { at: [px + 0.015, yc + 0.007, zt + 0.0004], n: [0, 0, 1], r: 0.0016 }; S.panel = { at: [0, yc, zt] };
}

function potGen(s, P, R, warn, S) {
  const m = s.slot, lid = s.lid_slot, tr = s.trim_slot;
  if (s.style === "donabe") {
    // a clay pot for nabe: thick-walled on its foot, two ears, a high lid with a knob and a steam hole
    lathe(P, 0, 0, 0, [[0, 0], [0.06, 0], [0.062, 0.004], [0.06, 0.008], [0.075, 0.01], [0.098, 0.02], [0.11, 0.035], [0.115, 0.05], [0.116, 0.062], [0.117, 0.068], [0.114, 0.071], [0.103, 0.071], [0.101, 0.066], [0.1, 0.05], [0.09, 0.028], [0.07, 0.016], [0, 0.014]], m, { n: 64 });
    for (const sx of [-1, 1]) sweep(P, smoothPath([[sx * 0.105, -0.025, 0.05], [sx * 0.124, -0.02, 0.056], [sx * 0.13, 0, 0.058], [sx * 0.124, 0.02, 0.056], [sx * 0.105, 0.025, 0.05]], 6), { a: 0.007, b: 0.008, r: 0.006 }, m, { up: [0, 0, 1] });
    lathe(P, 0, 0, 0.069, [[0, 0], [0.105, 0], [0.106, 0.003], [0.1, 0.012], [0.085, 0.03], [0.06, 0.048], [0.03, 0.058], [0, 0.06]], lid, { n: 64 });
    lathe(P, 0, 0, 0.1285, [[0, 0], [0.014, 0], [0.011, 0.008], [0.016, 0.016], [0.015, 0.02], [0, 0.021]], lid, { n: 32 });
    const vn = v3.nrm([0.42, 0, 1]);
    lathe(P, 0.06, 0, 0.1168, [[0, 0], [0.003, 0], [0, 0.0006]], "hole", { dir: vn, n: 12 });
    S.vent = { at: [0.0603, 0, 0.1176], n: vn, r: 0.003 };
    S.rim = { at: [0, 0, 0.071], r: 0.101 }; S.inner = { at: [0, 0, 0.014], prof: [[0.07, 0.016], [0.09, 0.028], [0.1, 0.05], [0.101, 0.066]] };
    S.lid = { at: [0, 0, 0.1495], n: [0, 0, 1], r: 0.105, slot: lid !== m ? lid : undefined, rest: [0, 0, 0.069] }; S.steam = { at: [0, 0, 0.074], n: [0, 0, 1], r: 0.106 };
  } else {
    // a saucepan (one long handle) or a stockpot (two loops): steel with a rolled rim, a domed lid and its knob
    const big = s.style === "stockpot", Rr = big ? 0.1 : 0.08, Hh = big ? 0.13 : 0.085, w = 0.0016;
    lathe(P, 0, 0, 0, [[0, 0], [Rr - 0.007, 0], [Rr - 0.002, 0.002], [Rr, 0.008], [Rr, Hh - 0.003], [Rr + 0.0015, Hh], [Rr + 0.0012, Hh + 0.0006], [Rr - w, Hh], [Rr - w, 0.009], [Rr - w - 0.0025, 0.0035], [Rr - 0.009, w], [0, w]], m, { n: 64 });
    lathe(P, 0, 0, Hh - 0.002, [[0, 0], [Rr - 0.0005, 0], [Rr, 0.0015], [Rr - 0.004, 0.005], [Rr * 0.65, 0.014], [Rr * 0.3, 0.018], [0, 0.019]], lid, { n: 64 });
    lathe(P, 0, 0, Hh + 0.0165, [[0, 0], [0.009, 0], [0.0075, 0.006], [0.013, 0.013], [0.0125, 0.0185], [0.008, 0.021], [0, 0.0215]], tr, { n: 28 });
    if (big) for (const sx of [-1, 1]) sweep(P, smoothPath([[sx * (Rr - 0.003), -0.03, Hh - 0.02], [sx * (Rr + 0.018), -0.026, Hh - 0.014], [sx * (Rr + 0.024), 0, Hh - 0.012], [sx * (Rr + 0.018), 0.026, Hh - 0.014], [sx * (Rr - 0.003), 0.03, Hh - 0.02]], 6), { a: 0.004, b: 0.007, r: 0.004 }, m, { up: [0, 0, 1] });
    else sweep(P, smoothPath([[Rr - 0.004, 0, Hh - 0.016], [Rr + 0.02, 0, Hh - 0.013], [Rr + 0.08, 0, Hh - 0.004], [Rr + 0.17, 0, Hh + 0.008]], 6), { a: 0.0065, b: 0.011, r: 0.0055 }, tr, { up: [0, 0, 1], taper: 0.92 });
    S.rim = { at: [0, 0, Hh], r: Rr - w }; S.inner = { at: [0, 0, w], prof: [[Rr - 0.009, w], [Rr - w - 0.0025, 0.0035], [Rr - w, 0.009], [Rr - w, Hh]] };
    S.lid = { at: [0, 0, Hh + 0.0375], n: [0, 0, 1], r: Rr, slot: lid !== m ? lid : undefined, rest: [0, 0, Hh - 0.002] }; S.steam = { at: [0, 0, Hh + 0.003], n: [0, 0, 1], r: Rr };
    S.handle = { at: big ? [Rr + 0.024, 0, Hh - 0.012] : [Rr + 0.15, 0, Hh + 0.006] };
  }
  fit(s, P, S);
}

// cups: their inner wall (`inner`: the floor and the wall's profile, [[r, z], ...]) is where a life's tea fills them
function cupGen(s, P, R, warn, S) {
  const m = s.slot, st = s.style;
  if (st === "teacup") {
    lathe(P, 0, 0, 0, [[0, 0], [0.034, 0], [0.036, 0.0018], [0.064, 0.0088], [0.0745, 0.0138], [0.0762, 0.0156], [0.0748, 0.0164], [0.063, 0.0118], [0.031, 0.0064], [0, 0.0062]], m, { n: 64 });
    const z0 = 0.0062;
    lathe(P, 0, 0, z0, [[0, 0], [0.0205, 0], [0.0215, 0.0015], [0.0215, 0.004], [0.024, 0.006], [0.034, 0.014], [0.0418, 0.03], [0.0453, 0.048], [0.0464, 0.0552], [0.0461, 0.0575], [0.0447, 0.0579], [0.0436, 0.0556], [0.0427, 0.0482], [0.0394, 0.0312], [0.0315, 0.0158], [0.022, 0.0093], [0, 0.0088]], m, { n: 56 });
    sweep(P, smoothPath([[0.0425, 0, z0 + 0.05], [0.0565, 0, z0 + 0.0535], [0.0655, 0, z0 + 0.0445], [0.0625, 0, z0 + 0.0305], [0.0505, 0, z0 + 0.0255], [0.0395, 0, z0 + 0.028]], 6), { a: 0.0042, b: 0.003, r: 0.0028 }, m, { up: [0, 1, 0] });
    S.rim = { at: [0, 0, z0 + 0.0579], n: [0, 0, 1], r: 0.0436 };
    S.inner = { at: [0, 0, z0 + 0.0088], prof: [[0.022, z0 + 0.0093], [0.0315, z0 + 0.0158], [0.0394, z0 + 0.0312], [0.0427, z0 + 0.0482], [0.0436, z0 + 0.0556]] };
    S.handle = { at: [0.064, 0, z0 + 0.04] };
  } else if (st === "yunomi") {
    lathe(P, 0, 0, 0, [[0, 0], [0.0255, 0], [0.0265, 0.001], [0.0265, 0.0055], [0.0282, 0.0068], [0.0302, 0.012], [0.0332, 0.05], [0.0352, 0.0835], [0.0354, 0.0868], [0.0341, 0.0882], [0.0318, 0.0864], [0.0298, 0.05], [0.0268, 0.0165], [0.0225, 0.0122], [0, 0.0118]], m, { n: 56 });
    S.rim = { at: [0, 0, 0.0882], n: [0, 0, 1], r: 0.0318 }; S.inner = { at: [0, 0, 0.0118], prof: [[0.0225, 0.0122], [0.0268, 0.0165], [0.0298, 0.05], [0.0318, 0.0864]] };
  } else if (st === "glass") {
    lathe(P, 0, 0, 0, [[0, 0], [0.0305, 0], [0.0318, 0.0015], [0.036, 0.0985], [0.0361, 0.1], [0.0345, 0.1], [0.0343, 0.0985], [0.0302, 0.0145], [0.0275, 0.0122], [0, 0.012]], m, { n: 56 });
    S.rim = { at: [0, 0, 0.1], n: [0, 0, 1], r: 0.0343 }; S.inner = { at: [0, 0, 0.012], prof: [[0.0275, 0.0122], [0.0302, 0.0145], [0.0343, 0.0985]] };
  } else if (st === "takeaway") {
    // a convenience store's coffee: a paper cup in its sleeve, the lid with its sip hole (the steam comes out of that)
    lathe(P, 0, 0, 0, [[0, 0], [0.0272, 0], [0.0282, 0.0025], [0.0392, 0.104], [0.0398, 0.105], [0, 0.105]], m, { n: 48 });
    lathe(P, 0, 0, 0.03, [[0.0308, 0], [0.0321, 0], [0.0375, 0.05], [0.0362, 0.05]], "kraft", { n: 48 });
    lathe(P, 0, 0, 0.103, [[0, 0], [0.0412, 0], [0.0415, 0.003], [0.041, 0.007], [0.037, 0.009], [0.036, 0.013], [0.032, 0.016], [0, 0.016]], "plastic", { n: 48 });
    bx(P, -0.006, -0.0362, 0.1158, 0.006, -0.0318, 0.1166, "hole", { b: 0.0002 });
    S.sip = { at: [0, -0.034, 0.1175], n: [0, 0, 1], r: 0.004 }; S.rim = { at: [0, 0, 0.119], n: [0, 0, 1], r: 0.03 };
  } else {
    lathe(P, 0, 0, 0, [[0, 0], [0.036, 0], [0.039, 0.002], [0.0405, 0.006], [0.041, 0.09], [0.0407, 0.0937], [0.0393, 0.0952], [0.0378, 0.0948], [0.0371, 0.0925], [0.0371, 0.012], [0.035, 0.0086], [0.03, 0.008], [0, 0.008]], m, { n: 56 });
    sweep(P, smoothPath([[0.037, 0, 0.078], [0.054, 0, 0.081], [0.066, 0, 0.07], [0.068, 0, 0.047], [0.061, 0, 0.027], [0.038, 0, 0.022]], 6), { a: 0.0068, b: 0.0046, r: 0.0042 }, m, { up: [0, 1, 0] });
    S.rim = { at: [0, 0, 0.0952], n: [0, 0, 1], r: 0.0371 }; S.inner = { at: [0, 0, 0.008], prof: [[0.03, 0.008], [0.035, 0.0086], [0.0371, 0.012], [0.0371, 0.0925]] };
    S.handle = { at: [0.067, 0, 0.05] };
  }
  fit(s, P, S);
}

function teapotGen(s, P, R, warn, S) {
  const m = s.slot, lid = s.lid_slot;
  if (s.style === "round") {
    // a round western teapot (a Brown Betty): the S spout in front, the loop handle behind
    lathe(P, 0, 0, 0, [[0, 0], [0.045, 0], [0.05, 0.003], [0.068, 0.02], [0.077, 0.045], [0.077, 0.065], [0.07, 0.085], [0.055, 0.1], [0.042, 0.106], [0.04, 0.107], [0, 0.107]], m, { n: 64 });
    lathe(P, 0, 0, 0.105, [[0, 0], [0.041, 0], [0.041, 0.002], [0.038, 0.008], [0.02, 0.014], [0, 0.015]], lid, { n: 48 });
    lathe(P, 0, 0, 0.119, [[0, 0], [0.006, 0], [0.005, 0.004], [0.009, 0.009], [0.008, 0.014], [0.004, 0.017], [0, 0.0175]], lid, { n: 24 });
    const sp = smoothPath([[0, -0.058, 0.025], [0, -0.085, 0.035], [0, -0.1, 0.06], [0, -0.112, 0.085], [0, -0.125, 0.098]], 6);
    sweep(P, sp, { a: 0.013, b: 0.013, r: 0.013 }, m, { up: [1, 0, 0], taper: 0.45 });
    const d = v3.nrm(v3.sub(sp[sp.length - 1], sp[sp.length - 2]));
    S.spout = { at: v3.add(sp[sp.length - 1], v3.mul(d, 0.006)), n: d, r: 0.005 };
    sweep(P, smoothPath([[0, 0.064, 0.09], [0, 0.095, 0.095], [0, 0.112, 0.075], [0, 0.11, 0.045], [0, 0.09, 0.025], [0, 0.07, 0.025]], 6), { a: 0.008, b: 0.006, r: 0.005 }, m, { up: [1, 0, 0] });
    S.lid = { at: [0, 0, 0.1365], n: [0, 0, 1], r: 0.038 };
  } else {
    // a kyusu: a squat clay pot, the short spout in front, the hollow handle out to the side
    lathe(P, 0, 0, 0, [[0, 0], [0.032, 0], [0.034, 0.002], [0.046, 0.01], [0.056, 0.025], [0.058, 0.035], [0.056, 0.046], [0.048, 0.056], [0.036, 0.062], [0.032, 0.063], [0, 0.063]], m, { n: 56 });
    lathe(P, 0, 0, 0.061, [[0, 0], [0.031, 0], [0.031, 0.002], [0.029, 0.006], [0.02, 0.01], [0, 0.011]], lid, { n: 40 });
    lathe(P, 0, 0, 0.071, [[0, 0], [0.007, 0], [0.006, 0.004], [0.008, 0.009], [0.005, 0.012], [0, 0.0125]], lid, { n: 20 });
    const sp = smoothPath([[0, -0.046, 0.022], [0, -0.062, 0.034], [0, -0.074, 0.05], [0, -0.08, 0.062]], 6);
    sweep(P, sp, { a: 0.0095, b: 0.0095, r: 0.0095 }, m, { up: [1, 0, 0], taper: 0.55 });
    const d = v3.nrm(v3.sub(sp[sp.length - 1], sp[sp.length - 2]));
    S.spout = { at: v3.add(sp[sp.length - 1], v3.mul(d, 0.005)), n: d, r: 0.004 };
    lathe(P, 0.05, 0, 0.03, [[0, 0], [0.0105, 0], [0.011, 0.02], [0.0122, 0.058], [0.0108, 0.0625], [0, 0.0635]], m, { dir: v3.nrm([1, 0, 0.22]), n: 28 });
    S.lid = { at: [0, 0, 0.0835], n: [0, 0, 1], r: 0.028 }; S.handle = { at: [0.1, 0, 0.042] };
  }
  fit(s, P, S);
}

// a cigarette from its filter's end along `dir`: the filter, the paper (lp of it left), the end (tobacco, or ash and
// its charred edge)
function cigParts(P, back, dir, cr, lf, lp, ash) {
  if (lf > 0) lathe(P, back[0], back[1], back[2], [[0, 0], [cr * 0.95, 0], [cr, 0.0006], [cr, lf], [0, lf]], "filter", { dir, n: 18 });
  const p0 = v3.add(back, v3.mul(dir, lf)), e = v3.add(p0, v3.mul(dir, lp));
  lathe(P, p0[0], p0[1], p0[2], [[0, 0], [cr, 0], [cr, lp], [cr * 0.92, lp]], "cig", { dir, n: 18 });
  if (ash > 0) {
    lathe(P, e[0], e[1], e[2], [[0, 0], [cr * 0.96, 0], [cr * 0.93, 0.0012], [cr * 0.95, 0.0006]], "ash_2", { dir, n: 18 });
    lathe(P, e[0], e[1], e[2], [[0, 0], [cr * 0.94, 0.0008], [cr * 0.98, ash * 0.4], [cr * 0.9, ash * 0.85], [cr * 0.6, ash], [0, ash]], "ash", { dir, n: 14 });
  } else lathe(P, e[0], e[1], e[2], [[0, -0.0004], [cr * 0.93, -0.0004], [cr * 0.93, 0], [0, 0.0001]], "tobacco", { dir, n: 18 });
  return v3.add(e, v3.mul(dir, ash));
}
const CIG = { r: 0.0039, L: 0.084, lf: 0.027 };
// an ashtray, round: its rim broken by rests (the notches a cigarette lies in), butts in it if it's been used, and a
// cigarette resting in the first rest (its tip over the bowl: the tip socket; its life a cigarette's)
function ashtrayGen(s, P, R, warn, S) {
  const m = s.slot, metal = s.style === "metal", n = clamp(s.rests | 0, 0, 6);
  const Ro = metal ? 0.065 : 0.06, Rin = metal ? 0.05 : 0.042, zr = metal ? 0.016 : 0.024, zf = metal ? 0.004 : 0.012, lip = metal ? 0.0025 : 0.004;
  lathe(P, 0, 0, 0, metal
    ? [[0, 0], [0.042, 0], [0.046, 0.002], [0.05, 0.006], [0.058, 0.012], [0.064, zr - 0.002], [Ro, zr], [Rin, zr], [0.049, zr - 0.002], [0.044, 0.0075], [0.04, zf], [0, zf]]
    : [[0, 0], [0.054, 0], [0.057, 0.0018], [0.0598, 0.008], [Ro, zr], [Rin, zr], [0.04, 0.0205], [0.036, 0.0138], [0.03, zf], [0, zf]], m, { n: 64 });
  const rm = (Ro + Rin) / 2, hb = (Ro - Rin) / 2, ga = 0.018 / rm, a0 = -Math.PI / 2 + (n ? Math.PI / n : 0), zc = zr + lip - 0.001;
  if (!n) lathe(P, 0, 0, zr - 0.001, [[Ro, 0], [Ro, lip], [Ro - lip * 0.5, 2 * lip], [Rin + lip * 0.5, 2 * lip], [Rin, lip], [Rin, 0]], m, { n: 64 });
  for (let k = 0; k < n; k++) {
    const t0 = a0 + k * 2 * Math.PI / n + ga / 2, t1 = a0 + (k + 1) * 2 * Math.PI / n - ga / 2, steps = Math.max(2, Math.ceil((t1 - t0) / 0.1)), pts = [];
    for (let i = 0; i <= steps; i++) { const a = t0 + (t1 - t0) * i / steps; pts.push([Math.cos(a) * rm, Math.sin(a) * rm, zc]); }
    sweep(P, pts, { a: lip, b: hb, r: Math.min(lip, hb) * 0.85 }, m, { up: [0, 0, 1] });
    const a = a0 + k * 2 * Math.PI / n;
    S[`rest_${k + 1}`] = { at: [Math.cos(a) * rm, Math.sin(a) * rm, zr], n: [-Math.cos(a), -Math.sin(a), 0] };
  }
  const nb = clamp(s.butts | 0, 0, 8);
  for (let i = 0; i < nb; i++) {                               // the butts: stubbed out, crushed, lying every which way
    const a = R() * 2 * Math.PI, rr = Math.sqrt(R()) * Math.max(0.004, Rin - 0.03), d = R() * 2 * Math.PI, cr = CIG.r * 0.97, lf = 0.021 + R() * 0.004, lp = 0.004 + R() * 0.012;
    const u = [Math.cos(d), Math.sin(d), 0], c = [Math.cos(a) * rr, Math.sin(a) * rr, zf + cr + i * 0.0007], back = v3.sub(c, v3.mul(u, (lf + lp) / 2));
    lathe(P, back[0], back[1], back[2], [[0, 0], [cr * 0.95, 0], [cr, 0.0006], [cr, lf], [0, lf]], "filter", { dir: u, n: 14 });
    const b2 = (R() - 0.5) * 0.9, u2 = v3.nrm([Math.cos(d + b2), Math.sin(d + b2), R() * 0.25]), p0 = v3.add(back, v3.mul(u, lf - 0.001));
    lathe(P, p0[0], p0[1], p0[2], [[0, 0], [cr * 0.98, 0], [cr * 0.9, lp * 0.7], [cr * 0.72, lp], [0, lp]], "cig", { dir: u2, n: 14 });
    const e = v3.add(p0, v3.mul(u2, lp));
    lathe(P, e[0], e[1], e[2], [[0, 0], [cr * 0.72, 0], [cr * 0.4, 0.0015], [0, 0.0018]], "ash_2", { dir: u2, n: 12 });
  }
  if (nb) cy(P, 0, 0, zf, Rin * 0.74, 0.0008, "ash", { n: 32 });
  if (s.resting && n) {
    // in the first rest: lying on the bowl's inner lip, the filter out past the rim, tipped 8° down toward the middle
    const out = [Math.cos(a0), Math.sin(a0), 0], tl = 8 * Math.PI / 180, cr = CIG.r, lp = (CIG.L - CIG.lf) * clamp(s.left, 0.15, 1);
    const dir = v3.nrm([-out[0] * Math.cos(tl), -out[1] * Math.cos(tl), -Math.sin(tl)]), pivot = [out[0] * (Rin + 0.001), out[1] * (Rin + 0.001), zr + cr];
    const back = v3.sub(pivot, v3.mul(dir, CIG.lf + 0.004 + (rm - Rin))), tip = cigParts(P, back, dir, cr, CIG.lf, lp, s.ash);
    S.tip = { at: tip, n: dir, r: cr, len: lp, back: v3.add(back, v3.mul(dir, CIG.lf)) };
  }
  S.bowl = { at: [0, 0, zf], n: [0, 0, 1], r: Rin * 0.85 };
  fit(s, P, S);
}
function cigaretteGen(s, P, R, warn, S) {
  const cr = CIG.r, lf = s.filter ? CIG.lf : 0;
  if (s.pose === "butt") {                                     // stubbed out: the filter, a crushed bent end
    const lp = 0.012, u = [1, 0, 0], back = [-0.017, 0, cr * 0.97];
    if (lf) lathe(P, back[0], back[1], back[2], [[0, 0], [cr * 0.95, 0], [cr, 0.0006], [cr, 0.024], [0, 0.024]], "filter", { dir: u, n: 18 });
    const p0 = v3.add(back, v3.mul(u, lf ? 0.023 : 0)), u2 = v3.nrm([1, 0.35, 0.05]);
    lathe(P, p0[0], p0[1], p0[2], [[0, 0], [cr * 0.98, 0], [cr * 0.92, lp * 0.6], [cr * 0.7, lp], [0, lp]], "cig", { dir: u2, n: 18 });
    const e = v3.add(p0, v3.mul(u2, lp));
    lathe(P, e[0], e[1], e[2], [[0, 0], [cr * 0.7, 0], [cr * 0.4, 0.0015], [0, 0.0018]], "ash_2", { dir: u2, n: 12 });
  } else {                                                     // lying on a table: the filter at -x, the tip at +x
    const lp = (CIG.L - (lf || 0)) * clamp(s.left, 0.1, 1), u = [1, 0, 0], back = [-(lf + lp + s.ash) / 2, 0, cr];
    const tip = cigParts(P, back, u, cr, lf, lp, s.ash);
    S.tip = { at: tip, n: u, r: cr, len: lp, back: v3.add(back, v3.mul(u, lf)) };
  }
  fit(s, P, S);
}
// a pack, standing: open, its lid flipped back and a row of filters showing; or shut
function packGen(s, P, R, warn, S) {
  const w = 0.055, d = 0.022, h = 0.088, lid = 0.026, m = s.slot, zl = h - lid;
  bx(P, -w / 2, -d / 2, 0, w / 2, d / 2, zl, m, { b: 0.0012 });
  bx(P, -w / 2 - 0.0002, -d / 2 - 0.0002, zl - 0.03, w / 2 + 0.0002, d / 2 + 0.0002, zl - 0.012, s.band_slot, { b: 0.0006 });   // the brand's band
  if (!s.open) { bx(P, -w / 2, -d / 2, zl + 0.0004, w / 2, d / 2, h, m, { b: 0.0012 }); bx(P, -w / 2 + 0.001, -d / 2 + 0.001, zl - 0.0004, w / 2 - 0.001, d / 2 - 0.001, zl + 0.0006, "gap"); }
  else {
    bx(P, -w / 2, d / 2, zl - 0.0005, w / 2, d / 2 + lid, zl + d, m, { b: 0.0012 });                  // the lid, flipped back on its hinge
    bx(P, -w / 2 + 0.0015, -d / 2 + 0.0015, zl - 0.004, w / 2 - 0.0015, d / 2 - 0.0015, zl + 0.007, "white", { b: 0.0005 });  // the foil
    const k = clamp(s.count | 0, 0, 20), per = Math.ceil(k / 2);
    for (let i = 0; i < k; i++) {
      const row = i < per ? 0 : 1, j = row ? i - per : i, nrow = row ? k - per : per;
      const x = (j - (nrow - 1) / 2) * (CIG.r * 2.02), y = (row - 0.5) * CIG.r * 2.02 * (k > per ? 1 : 0);
      lathe(P, x, y, zl - 0.002, [[0, 0], [CIG.r * 0.98, 0], [CIG.r * 0.98, 0.0125 + (i % 3) * 0.0012], [CIG.r * 0.9, 0.0128 + (i % 3) * 0.0012], [0, 0.0129 + (i % 3) * 0.0012]], "filter", { n: 14 });
    }
  }
  fit(s, P, S);
}
// a disposable lighter: the body, the steel hood, the spark wheel; standing (it can be lit) or lying on its side
function lighterGen(s, P, R, warn, S) {
  const m = s.slot, bw = 0.0245, bd = 0.0115, bh = 0.058, hw = 0.0205, hd = 0.0095, hh = 0.0125;
  if (s.pose === "standing") {
    sf(P, -bw / 2, -bd / 2, 0, bw / 2, bd / 2, bh, m, { seam: "none", puff: 0, b: 0.004, n: 10 });
    bx(P, -hw / 2, -hd / 2, bh - 0.001, hw / 2, hd / 2, bh + hh, "steel", { b: 0.0008 });
    lathe(P, 0.0035, -0.0042, bh + hh - 0.003, [[0, 0], [0.0046, 0], [0.0046, 0.0084], [0, 0.0084]], "steel", { axis: "y", n: 16 });
    bx(P, 0.006, -0.004, bh + 0.002, 0.0115, 0.004, bh + 0.008, "black", { b: 0.0005 });
    lathe(P, -0.004, 0, bh + hh - 0.001, [[0, 0], [0.0016, 0], [0.0016, 0.002], [0, 0.002]], "steel", { n: 12 });
    S.flame = { at: [-0.004, 0, bh + hh + 0.0012], n: [0, 0, 1] };
  } else {
    const x0 = -(bh + hh) / 2;
    sf(P, x0, -bw / 2, 0, x0 + bh, bw / 2, bd, m, { seam: "none", puff: 0, b: 0.004, n: 10 });
    bx(P, x0 + bh - 0.001, -hw / 2, (bd - hd) / 2, x0 + bh + hh, hw / 2, (bd + hd) / 2, "steel", { b: 0.0008 });
    lathe(P, x0 + bh + hh - 0.003, 0.0035, (bd - 0.0084) / 2, [[0, 0], [0.0046, 0], [0.0046, 0.0084], [0, 0.0084]], "steel", { n: 16 });
    bx(P, x0 + bh + 0.002, 0.006, (bd - 0.008) / 2, x0 + bh + 0.008, 0.0115, (bd + 0.008) / 2, "black", { b: 0.0005 });
    S.flame = { at: [x0 + bh + hh + 0.0012, -0.004, bd / 2], n: [1, 0, 0] };
  }
  fit(s, P, S);
}

// a clock's time as the hands' angles (degrees clockwise from twelve, seen from the front)
export function clockAngles(t) {
  const m = String(t || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/), h = m ? +m[1] % 12 : 10, mi = m ? +m[2] % 60 : 10, se = m && m[3] ? +m[3] % 60 : 30;
  return { h: (h + mi / 60 + se / 3600) * 30, m: (mi + se / 60) * 6, s: se * 6 };
}
function clockHand(P, cx, cz, y, a, tail, len, w, m, taper) {   // a hand on the dial at angle a, in front of it at y
  const r = a * Math.PI / 180, d = [Math.sin(r), 0, Math.cos(r)];
  sweep(P, [[cx - d[0] * tail, y, cz - d[2] * tail], [cx + d[0] * len, y, cz + d[2] * len]], { a: 0.0006, b: w, r: 0.0005 }, m, { up: [0, -1, 0], taper });
}
function clockMarks(P, cx, cz, y, r1, n, long, bw, m) {         // marks round a dial: every fifth long when there are 60
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI, big = n === 12 || i % 5 === 0, r0 = r1 - (big ? long : long * 0.35), sx = Math.sin(a), cz2 = Math.cos(a);
    sweep(P, [[cx + sx * r0, y, cz + cz2 * r0], [cx + sx * r1, y, cz + cz2 * r1]], { a: 0.0003, b: big ? bw : bw * 0.3, r: 0.0002 }, m, { up: [0, -1, 0], caps: false });
  }
}
// a wall clock, its front to -y: a slim round one, a school or office one (deep black case, bold marks, red second
// hand), or a pendulum clock in its wooden case (柱時計). The hands are drawn at `time` and are slots of their own
// (hand_h, hand_m, hand_s), as is the pendulum: the hub and pendulum sockets say where they turn.
function clockGen(s, P, R, warn, S) {
  const T = clockAngles(s.time), m = s.slot;
  if (s.style === "pendulum") {
    const W = 0.3, Dp = 0.11, Hp = 0.56, t = 0.012, fy = -Dp / 2 + 0.012, zd = 0.4, Rd = 0.105;
    bx(P, -W / 2 + t, Dp / 2 - 0.008, 0.03, W / 2 - t, Dp / 2, Hp - 0.03, "inner");
    for (const sx of [-1, 1]) bx(P, sx < 0 ? -W / 2 : W / 2 - t, -Dp / 2 + 0.012, 0.03, sx < 0 ? -W / 2 + t : W / 2, Dp / 2, Hp - 0.03, m, { b: 0.002 });
    bx(P, -W / 2 - 0.012, -Dp / 2 + 0.002, Hp - 0.03, W / 2 + 0.012, Dp / 2, Hp - 0.012, m, { b: 0.003 });          // the crown
    bx(P, -W / 2 - 0.006, -Dp / 2 + 0.008, Hp - 0.012, W / 2 + 0.006, Dp / 2, Hp, m, { b: 0.004 });
    bx(P, -W / 2 - 0.01, -Dp / 2 + 0.002, 0.012, W / 2 + 0.01, Dp / 2, 0.03, m, { b: 0.003 });                       // the foot
    bx(P, -W / 2 + 0.01, -Dp / 2 + 0.01, 0, W / 2 - 0.01, Dp / 2, 0.012, m, { b: 0.003 });
    bx(P, -W / 2 + t, fy, 0.29, W / 2 - t, fy + 0.014, Hp - 0.03, m, { b: 0.0015 });                                // the board round the dial
    lathe(P, 0, fy, zd, [[0, 0], [Rd, 0], [Rd, 0.002], [0, 0.002]], "dial", { axis: "-y", n: 64 });
    lathe(P, 0, fy, zd, [[Rd - 0.002, 0], [Rd + 0.012, 0], [Rd + 0.012, 0.004], [Rd + 0.008, 0.009], [Rd + 0.001, 0.0102], [Rd - 0.002, 0.008]], "brass", { axis: "-y", n: 64 });
    const yd = fy - 0.0024;
    clockMarks(P, 0, zd, yd, Rd - 0.008, 12, 0.017, 0.0024, "black");
    for (const r of [Rd - 0.0055, Rd - 0.0095]) lathe(P, 0, fy - 0.002, zd, [[r - 0.0004, 0], [r + 0.0004, 0], [r + 0.0004, 0.0003], [r - 0.0004, 0.0003]], "black", { axis: "-y", n: 64 });
    for (const sx of [-1, 1]) lathe(P, sx * 0.034, fy - 0.002, zd - 0.032, [[0, 0], [0.0042, 0], [0.0042, 0.0003], [0, 0.0003]], "hole", { axis: "-y", n: 16 });   // the winding holes
    clockHand(P, 0, zd, yd - 0.003, T.h, 0.014, 0.058, 0.0042, "hand_h", 0.45);
    clockHand(P, 0, zd, yd - 0.005, T.m, 0.016, 0.086, 0.003, "hand_m", 0.45);
    lathe(P, 0, yd - 0.0058, zd, [[0, 0], [0.0045, 0], [0.004, 0.0015], [0, 0.0022]], "brass", { axis: "-y", n: 20 });
    lathe(P, 0, fy - 0.009, zd, [[0, 0], [Rd + 0.003, 0], [0, 0.0016]], "glass", { axis: "-y", n: 64 });
    for (const [x0, z0, x1, z1] of [[-0.135, 0.04, -0.105, 0.29], [0.105, 0.04, 0.135, 0.29], [-0.105, 0.04, 0.105, 0.065], [-0.105, 0.265, 0.105, 0.29]])
      bx(P, x0, fy, z0, x1, fy + 0.014, z1, m, { b: 0.0015 });                                                        // the door's frame
    bx(P, -0.105, fy + 0.006, 0.065, 0.105, fy + 0.008, 0.265, "glass");
    sweep(P, [[0, 0.03, 0.36], [0, 0.03, 0.14]], { a: 0.0008, b: 0.0028, r: 0.0006 }, "pendulum", { up: [0, 1, 0] });
    lathe(P, 0, 0.034, 0.128, [[0, 0], [0.04, 0], [0.04, 0.002], [0.033, 0.0055], [0, 0.0075]], "pendulum", { axis: "-y", n: 48 });
    S.hub = { at: [0, yd - 0.006, zd], n: [0, -1, 0], hands: { h: T.h, m: T.m }, slots: { h: "hand_h", m: "hand_m" } };
    S.pendulum = { at: [0, 0.03, 0.36], n: [0, 1, 0], slot: "pendulum", len: 0.232 };
    S.chime = { at: [0, 0, 0.2] };
  } else {
    const school = s.style === "school", Rr = 0.15, dep = school ? 0.05 : 0.038, rim = school ? 0.013 : 0.007, cz = Rr, ya = dep / 2;
    lathe(P, 0, ya, cz, [[0, 0], [Rr - 0.004, 0], [Rr, 0.004], [Rr, dep - 0.006], [Rr - 0.003, dep], [Rr - rim + 0.002, dep], [Rr - rim, dep - 0.003], [Rr - rim, 0.012], [0, 0.012]], m, { axis: "-y", n: 72 });
    const Rf = Rr - rim, yd = ya - 0.0128;
    lathe(P, 0, ya - 0.012, cz, [[0, 0], [Rf, 0], [Rf, 0.0008], [0, 0.0008]], "dial", { axis: "-y", n: 72 });
    clockMarks(P, 0, cz, yd - 0.0004, Rf - 0.007, school || +s.marks === 60 ? 60 : 12, school ? 0.018 : 0.013, school ? 0.0032 : 0.0019, "black");
    clockHand(P, 0, cz, yd - 0.003, T.h, 0.015, Rf * 0.52, school ? 0.0048 : 0.004, "hand_h", 0.55);
    clockHand(P, 0, cz, yd - 0.005, T.m, 0.018, Rf * 0.8, school ? 0.0034 : 0.003, "hand_m", 0.5);
    if (s.seconds) clockHand(P, 0, cz, yd - 0.007, T.s, 0.03, Rf * 0.88, 0.0008, "hand_s", 1);
    lathe(P, 0, yd - 0.0072, cz, [[0, 0], [0.0045, 0], [0.0045, 0.0012], [0.003, 0.0024], [0, 0.0027]], s.seconds ? "hand_s" : "black", { axis: "-y", n: 20 });
    lathe(P, 0, ya - dep + 0.0045, cz, [[0, 0], [Rf + 0.001, 0], [Rf - 0.01, 0.0015], [0, 0.0025]], "glass", { axis: "-y", n: 72 });
    S.hub = { at: [0, yd - 0.008, cz], n: [0, -1, 0], hands: s.seconds ? { h: T.h, m: T.m, s: T.s } : { h: T.h, m: T.m }, slots: s.seconds ? { h: "hand_h", m: "hand_m", s: "hand_s" } : { h: "hand_h", m: "hand_m" } };
  }
  fit(s, P, S, { back: true });
}

// a Japanese rice cooker: a soft body, the domed lid, its steam vent; on the front the panel with the LCD, the buttons
// and the cook and warm lights, the lid's release
function riceGen(s, P, R, warn, S) {
  const m = s.slot, W = 0.25, D = 0.32, Hb = 0.19, yf = -D / 2;
  sf(P, -W / 2, -D / 2, 0.004, W / 2, D / 2, Hb, m, { seam: "none", puff: 0, b: 0.04, n: 14 });
  sf(P, -W / 2 + 0.004, -D / 2 + 0.018, Hb - 0.02, W / 2 - 0.004, D / 2 - 0.004, Hb + 0.032, s.lid_slot, { seam: "none", puff: 0.12, b: 0.03, n: 14 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) cy(P, sx * 0.085, sy * 0.115, 0, 0.012, 0.005, "rubber", { n: 16 });
  bx(P, -0.085, yf - 0.002, 0.07, 0.085, yf + 0.012, 0.15, s.panel_slot, { b: 0.006 });
  bx(P, -0.032, yf - 0.0028, 0.114, 0.032, yf + 0.002, 0.14, "lcd", { b: 0.0008 });
  S.lcd = { at: [0, yf - 0.003, 0.127], n: [0, -1, 0], w: 0.062, h: 0.024, up: [0, 0, 1] };
  [-0.054, -0.018, 0.018, 0.054].forEach((x, i) => lathe(P, x, yf - 0.0018, 0.092, [[0, 0], [i === 3 ? 0.0095 : 0.0072, 0], [i === 3 ? 0.0095 : 0.0072, 0.0014], [i === 3 ? 0.0078 : 0.0058, 0.0027], [0, 0.003]], i === 3 ? "white" : "plastic", { axis: "-y", n: 24 }));
  for (const [k, x] of [["led_warm", -0.054], ["led_cook", 0.054]]) {
    lathe(P, x, yf - 0.0018, 0.106, [[0, 0], [0.0019, 0], [0.0019, 0.0006], [0, 0.0009]], "led", { axis: "-y", n: 12 });
    S[k] = { at: [x, yf - 0.0029, 0.106], n: [0, -1, 0], r: 0.0019 };
  }
  bx(P, -0.03, yf + 0.004, Hb - 0.015, 0.03, yf + 0.022, Hb + 0.006, "plastic_2", { b: 0.005 });
  lathe(P, 0, 0.075, Hb + 0.024, [[0, 0], [0.026, 0], [0.027, 0.004], [0.025, 0.011], [0.02, 0.013], [0, 0.0135]], "plastic", { n: 40 });
  for (const j of [-1, 0, 1]) bx(P, -0.012, 0.075 + j * 0.007 - 0.001, Hb + 0.0373, 0.012, 0.075 + j * 0.007 + 0.001, Hb + 0.0377, "hole");
  S.vent = { at: [0, 0.075, Hb + 0.038], n: [0, 0, 1], r: 0.012 }; S.button = { at: [0.054, yf - 0.003, 0.092] };
  fit(s, P, S);
}

// a mosquito coil (katori senkō): the green spiral, burning from its outer end. On its tin tray and pin, or hung
// inside a kayari buta, the clay pig it smokes out of
function coilGen(s, P, R, warn, S) {
  const turns = 4.25 * clamp(s.left ?? 1, 0.1, 1), r0 = 0.011, r1 = 0.011 + 0.051 * turns / 4.25, half = 0.0028, th = 0.0018;
  const spiral = plane => { const N = Math.max(8, Math.ceil(turns * 2 * Math.PI / 0.12)), pts = []; for (let i = 0; i <= N; i++) { const a = i / N * turns * 2 * Math.PI, r = r0 + (r1 - r0) * i / N; pts.push(plane(r * Math.cos(a), r * Math.sin(a))); } return pts; };
  if (s.style === "pig") {
    const L = 0.17, zc = 0.095, yb = L / 2;
    const out = [[0, 0], [0.03, 0.002], [0.055, 0.012], [0.072, 0.03], [0.081, 0.06], [0.083, 0.09], [0.079, 0.12], [0.07, 0.145], [0.06, 0.162], [0.057, 0.168], [0.053, 0.17]];
    lathe(P, 0, yb, zc, out, s.slot, { axis: "-y", n: 64 });
    lathe(P, 0, yb, zc, [[0.053, 0.17], [0.052, 0.166], [0.064, 0.14], [0.073, 0.11], [0.075, 0.08], [0.072, 0.05], [0.06, 0.025], [0.035, 0.011], [0, 0.008]], "inner", { axis: "-y", n: 64 });
    for (const sx of [-1, 1]) {
      lathe(P, sx * 0.034, -0.03, zc + 0.07, [[0, 0], [0.015, 0], [0.002, 0.022], [0, 0.022]], s.slot, { dir: v3.nrm([sx * 0.35, -0.25, 0.9]), n: 16 });   // the ears
      for (const y of [-0.045, 0.045]) lathe(P, sx * 0.04, y, 0.026, [[0, 0], [0.013, 0], [0.011, 0.026], [0, 0.027]], s.slot, { axis: "-z", n: 16 });     // the legs
      const { n: [nr, nt] } = profAt(out, 0.145), ph = 40 * Math.PI / 180, n = v3.nrm([sx * Math.sin(ph) * nr, -nt, Math.cos(ph) * nr]);
      lathe(P, sx * 0.07 * Math.sin(ph), yb - 0.145, zc + 0.07 * Math.cos(ph), [[0, 0], [0.0045, 0], [0.0035, 0.0012], [0, 0.0016]], "black", { dir: n, n: 12 });    // the eyes
    }
    sweep(P, smoothPath([[0, yb - 0.004, zc + 0.02], [0, yb + 0.012, zc + 0.024], [0.006, yb + 0.017, zc + 0.032], [0.002, yb + 0.014, zc + 0.039], [-0.003, yb + 0.011, zc + 0.033]], 5), { a: 0.003, b: 0.003, r: 0.003 }, s.slot, { up: [1, 0, 0] });
    const pts = spiral((x, y) => [x, -0.01, zc + y]);
    sweep(P, pts, { a: th, b: half, r: 0.0012 }, "coil", { up: [0, 1, 0] });
    const e = pts[pts.length - 1];
    S.tip = { at: [e[0], e[1] - th, e[2]], n: [0, 0, 1] }; S.smoke = { at: [0, -L / 2 + 0.006, zc + 0.035], n: v3.nrm([0, -0.3, 1]), r: 0.03 };
  } else {
    lathe(P, 0, 0, 0, [[0, 0], [0.068, 0], [0.07, 0.006], [0.0695, 0.0068], [0.067, 0.0012], [0, 0.0012]], "steel", { n: 56 });
    lathe(P, 0, 0, 0.0012, [[0, 0], [0.006, 0], [0.0012, 0.003], [0.0012, 0.016], [0, 0.0165]], "steel", { n: 12 });
    const z = 0.012, pts = spiral((x, y) => [x, y, z]);
    sweep(P, pts, { a: th, b: half, r: 0.0012 }, "coil", { up: [0, 0, 1] });
    const e = pts[pts.length - 1];
    S.tip = { at: [e[0], e[1], z + th], n: [0, 0, 1] }; S.smoke = S.tip;
  }
  fit(s, P, S);
}

// incense: one stick in a small holder, or sticks standing in the ash of a kōro (the bowl on a butsudan)
function incenseGen(s, P, R, warn, S) {
  const koro = s.style === "koro", sr = 0.0011, len = 0.14 * clamp(s.left ?? 0.8, 0.1, 1);
  let z0, at;
  if (koro) {
    lathe(P, 0, 0, 0, [[0, 0], [0.032, 0], [0.033, 0.002], [0.03, 0.004], [0.042, 0.008], [0.05, 0.02], [0.052, 0.035], [0.0505, 0.045], [0.052, 0.048], [0.05, 0.05], [0.046, 0.0485], [0.046, 0.04], [0, 0.04]], s.slot, { n: 56 });
    cy(P, 0, 0, 0.04, 0.046, 0.002, "ash", { n: 40 });
    const n = clamp(s.sticks | 0, 1, 5); z0 = 0.036;
    at = Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * 0.014, (i % 2) * 0.004]);
  } else {
    lathe(P, 0, 0, 0, [[0, 0], [0.026, 0], [0.027, 0.002], [0.026, 0.006], [0.022, 0.007], [0.012, 0.006], [0.006, 0.008], [0.003, 0.01], [0.0013, 0.01], [0.0013, 0.004], [0, 0.004]], s.slot, { n: 40 });
    z0 = 0.004; at = [[0, 0]];
  }
  at.forEach(([x, y], i) => {
    const l = len * (1 - i * 0.06), b = l - 0.003;
    lathe(P, x, y, z0, [[0, 0], [sr, 0], [sr, b], [0, b]], "incense", { n: 8 });
    lathe(P, x, y, z0 + b, [[0, 0], [sr * 1.03, 0], [sr * 1.02, 0.0024], [sr * 0.5, 0.003], [0, 0.003]], "ash", { n: 8 });
    S[`tip_${i + 1}`] = { at: [x, y, z0 + l], n: [0, 0, 1], r: sr, len: l - 0.012, back: [x, y, z0 + 0.012] };
  });
  S.tip = S.tip_1;
  fit(s, P, S);
}

// a phone lying face up, its top to the back (+y): a smartphone, or a shut flip phone (the 2000s' garakei) with its
// outer screen and notification light
function phoneGen(s, P, R, warn, S) {
  if (s.style === "flip") {
    const w = 0.05, l = 0.1, h = 0.021;
    sf(P, -w / 2, -l / 2, 0, w / 2, l / 2 - 0.006, h / 2, s.slot, { seam: "none", puff: 0, b: 0.006, n: 10 });
    sf(P, -w / 2, -l / 2, h / 2 - 0.0004, w / 2, l / 2 - 0.006, h, s.slot, { seam: "none", puff: 0.08, b: 0.007, n: 10 });
    lathe(P, -w / 2 + 0.002, l / 2 - 0.011, h / 2, [[0, 0], [0.0085, 0], [0.0085, w - 0.004], [0, w - 0.004]], s.slot, { axis: "x", n: 20 });
    bx(P, -0.014, 0.008, h - 0.0012, 0.014, 0.034, h + 0.0004, "screen", { b: 0.0008 });
    lathe(P, 0, -0.012, h - 0.0008, [[0, 0], [0.002, 0], [0.002, 0.0011], [0, 0.0013]], "led", { n: 12 });
    S.screen = { at: [0, 0.021, h + 0.0006], n: [0, 0, 1], w: 0.028, h: 0.026, up: [0, 1, 0] }; S.led = { at: [0, -0.012, h + 0.0006], n: [0, 0, 1], r: 0.002 };
  } else {
    const w = 0.072, l = 0.15, h = 0.0078;
    sf(P, -w / 2, -l / 2, 0, w / 2, l / 2, h, s.slot, { seam: "none", puff: 0, b: 0.0035, n: 16 });
    bx(P, -w / 2 + 0.0028, -l / 2 + 0.0028, h - 0.0006, w / 2 - 0.0028, l / 2 - 0.0028, h + 0.0002, "screen", { b: 0.0006 });
    S.screen = { at: [0, 0, h + 0.0003], n: [0, 0, 1], w: w - 0.006, h: l - 0.006, up: [0, 1, 0] };
  }
  fit(s, P, S);
}

// a kitchen tap: a swan-neck mixer with its lever, or an old pillar tap with a cross handle. The spout socket is where a
// drip falls from (straight down, into whatever's under it)
function tapGen(s, P, R, warn, S) {
  const m = s.slot;
  if (s.style === "cross") {
    lathe(P, 0, 0, 0, [[0, 0], [0.026, 0], [0.026, 0.004], [0.02, 0.008], [0.014, 0.014], [0.0135, 0.07], [0.016, 0.075], [0.016, 0.085], [0.012, 0.088], [0, 0.088]], m, { n: 40 });
    sweep(P, smoothPath([[0, -0.004, 0.06], [0, -0.04, 0.062], [0, -0.09, 0.062], [0, -0.115, 0.05], [0, -0.12, 0.038]], 6), { a: 0.0085, b: 0.0085, r: 0.0085 }, m, { up: [1, 0, 0], caps: false, taper: 0.9 });
    lathe(P, 0, -0.12, 0.04, [[0, 0], [0.0088, 0], [0.0088, 0.009], [0.0062, 0.0098], [0.0062, 0.009], [0, 0.009]], m, { axis: "-z", n: 24 });
    for (const [a, b] of [[[-0.03, 0, 0.096], [0.03, 0, 0.096]], [[0, -0.03, 0.096], [0, 0.03, 0.096]]]) sweep(P, [a, b], { a: 0.0055, b: 0.0055, r: 0.0055 }, m, { up: [0, 0, 1] });
    lathe(P, 0, 0, 0.086, [[0, 0], [0.011, 0], [0.011, 0.012], [0.008, 0.017], [0, 0.018]], m, { n: 24 });
    S.spout = { at: [0, -0.12, 0.0295], n: [0, 0, -1], r: 0.006 }; S.handle = { at: [0, 0, 0.1] };
  } else {
    lathe(P, 0, 0, 0, [[0, 0], [0.028, 0], [0.028, 0.006], [0.025, 0.01], [0.022, 0.012], [0.022, 0.12], [0.0205, 0.125], [0, 0.125]], m, { n: 48 });
    lathe(P, 0, 0, 0.125, [[0, 0], [0.0205, 0], [0.0205, 0.012], [0.017, 0.018], [0, 0.019]], m, { n: 40 });
    sweep(P, [[0, 0.002, 0.138], [0, 0.03, 0.152], [0, 0.075, 0.162]], { a: 0.009, b: 0.004, r: 0.0035 }, m, { up: [1, 0, 0] });
    sweep(P, smoothPath([[0, 0, 0.1], [0, 0, 0.2], [0, -0.03, 0.272], [0, -0.1, 0.3], [0, -0.17, 0.272], [0, -0.2, 0.22], [0, -0.205, 0.188]], 6), { a: 0.0115, b: 0.0115, r: 0.0115 }, m, { up: [1, 0, 0], taper: 0.85, caps: false });
    lathe(P, 0, -0.205, 0.19, [[0, 0], [0.0105, 0], [0.0105, 0.008], [0.009, 0.0095], [0.006, 0.0095], [0.006, 0.009], [0, 0.009]], m, { axis: "-z", n: 28 });
    S.spout = { at: [0, -0.205, 0.18], n: [0, 0, -1], r: 0.006 }; S.handle = { at: [0, 0.06, 0.158] };
  }
  fit(s, P, S);
}

// a candle: a pillar with its melted dip, a taper in a brass candlestick, or a tealight; the wick a little bent
function candleGen(s, P, R, warn, S) {
  const m = s.slot, left = clamp(s.left ?? 1, 0.15, 1);
  let top;
  if (s.style === "taper") {
    lathe(P, 0, 0, 0, [[0, 0], [0.044, 0], [0.045, 0.003], [0.042, 0.007], [0.016, 0.014], [0.0095, 0.024], [0.008, 0.05], [0.0105, 0.058], [0.028, 0.062], [0.031, 0.066], [0.029, 0.0685], [0.0145, 0.069], [0.0145, 0.082], [0.0128, 0.0825], [0.0128, 0.072], [0, 0.072]], s.holder_slot, { n: 48 });
    const L = 0.24 * left;
    lathe(P, 0, 0, 0.072, [[0, 0], [0.0112, 0], [0.0112, L - 0.004], [0.0098, L - 0.0008], [0.004, L], [0, L - 0.0005]], m, { n: 28 });
    top = 0.072 + L - 0.0005;
  } else if (s.style === "tealight") {
    lathe(P, 0, 0, 0, [[0, 0], [0.0188, 0], [0.0192, 0.0006], [0.0195, 0.0155], [0.0197, 0.016], [0.0187, 0.016], [0.0186, 0.0012], [0, 0.0012]], "steel", { n: 40 });
    lathe(P, 0, 0, 0.0012, [[0, 0], [0.0186, 0], [0.0186, 0.0118], [0.012, 0.0112], [0, 0.011]], m, { n: 40 });
    top = 0.0122;
  } else {
    const H = 0.02 + 0.08 * left;
    lathe(P, 0, 0, 0, [[0, 0], [0.033, 0], [0.035, 0.002], [0.035, H - 0.004], [0.0345, H - 0.0012], [0.0325, H], [0.028, H - 0.0018], [0.012, H - 0.0058], [0, H - 0.0065]], m, { n: 48 });
    top = H - 0.0065;
  }
  lathe(P, 0, 0, top - 0.002, [[0, 0], [0.0008, 0], [0.0008, 0.009], [0.0006, 0.011], [0, 0.0115]], "wick", { dir: v3.nrm([0.12, 0, 1]), n: 8 });
  S.flame = { at: [0.0013, 0, top + 0.0105], n: [0, 0, 1] }; S.wick = { at: [0, 0, top] };
  fit(s, P, S);
}

// a built thing's parts, as a free list (the kit maker's "Explode": start from a preset, then move single boxes)
export function explode(built) {
  return built.parts.map(p => { const o = JSON.parse(JSON.stringify(p)); o.at = p.at.map(v => +v.toFixed(5)); o.size = p.size.map(v => +v.toFixed(5));
    for (const k of ["b", "rz", "ri"]) if (o[k]) o[k] = +o[k].toFixed(5); else delete o[k];
    if (o.pts) o.pts = o.pts.map(q => q.map(v => +v.toFixed(5))); delete o.uv; if (!o.skip) delete o.skip; return o; });
}

// ---- variations: the same kind of thing, other numbers (the kit maker's Variations, the builder's Vary) -------------
// per type: [key, group, mode, a, b]. group: size, layout or look (what the person chose to vary). mode: r a real in
// [a, b]; i a whole number in [a, b]; p one of a (or the param's own choices); f flip (a: the chance); s the size,
// each side scaled by up to a[k] either way; seed a new seed; cols, holes: cabinets' columns, a build-out's recesses.
const SURF_VARY = [["pattern", "layout", "p"], ["gap", "look", "r", 0.001, 0.004], ["gap_var", "look", "r", 0.1, 0.6], ["tones", "look", "i", 1, 4], ["seed", "look", "seed"]];
export const VARY = {
  tiles: [["tile", "layout", "p", [[0.3, 0.3], [0.45, 0.45], [0.6, 0.6], [0.6, 1.2], [0.3, 0.6], [0.2, 0.2]]], ...SURF_VARY, ["bevel", "look", "r", 0.0003, 0.0015]],
  planks: [["board", "layout", "r", 0.09, 0.22], ["pattern", "layout", "p", ["random", "random", "half", "third", "herringbone"]], ["gap", "look", "r", 0.0008, 0.003],
           ["gap_var", "look", "r", 0.1, 0.6], ["tones", "look", "i", 2, 4], ["seed", "look", "seed"], ["bevel", "look", "r", 0.0004, 0.0012]],
  tatami: [["mat", "layout", "p", [[0.88, 1.76], [0.91, 1.82], [0.955, 1.91]]], ["heri", "look", "r", 0.02, 0.04], ["seed", "look", "seed"]],
  rug: [["size", "size", "s", [0.2, 0.2, 0]], ["border", "look", "r", 0, 0.12], ["fringe", "look", "p", [0, 0, 0.04, 0.06, 0.08]]],
  cabinet: [["size", "size", "s", [0.25, 0.1, 0.12]], ["cols", "layout", "cols"], ["handle", "look", "p"], ["kick", "look", "p", [0, 0.06, 0.08, 0.1]], ["reveal", "look", "r", 0.002, 0.004]],
  buildout: [["size", "size", "s", [0.15, 0.2, 0]], ["holes", "layout", "holes"]],
  plate: [["gangs", "layout", "i", 1, 4], ["layout", "layout", "p"], ["margin", "look", "r", 0.005, 0.012]],
  panel: [["size", "size", "s", [0.2, 0, 0.2]], ["frame", "look", "p", [0, 0.01, 0.015, 0.025]], ["mat", "look", "p", [0, 0, 0.03, 0.05]]],
  downlight: [["size", "size", "s", [0.3, 0.3, 0]], ["shape", "look", "p"], ["trim", "look", "r", 0.006, 0.02]],
  window: [["cols", "layout", "i", 1, 3], ["rows", "layout", "i", 1, 2], ["slide", "layout", "f", 0.5], ["frame", "look", "r", 0.04, 0.08], ["sash", "look", "p", [0, 0.04, 0.05]]],
  curtain: [["size", "size", "s", [0.2, 0, 0]], ["panels", "layout", "i", 1, 2], ["open", "layout", "r", 0, 0.6], ["pitch", "look", "r", 0.07, 0.15], ["seed", "look", "seed"]],
  slats: [["size", "size", "s", [0.2, 0, 0.2]], ["n", "layout", "i", 5, 24], ["dir", "layout", "p"], ["frame", "look", "r", 0, 0.03]],
  table: [["size", "size", "s", [0.2, 0.15, 0.05]], ["leg", "look", "r", 0.03, 0.08], ["leg_in", "look", "r", 0, 0.08], ["apron", "layout", "p", [0, 0.05, 0.08, 0.1]], ["shelf", "layout", "p", [0, 0, 0.1, 0.15]], ["top_t", "look", "r", 0.02, 0.045]],
  bed: [["size", "size", "p", [[0.97, 2.0], [1.2, 2.0], [1.4, 2.05], [1.6, 2.05]]], ["headboard", "layout", "f", 0.3], ["pillows", "layout", "i", 1, 2], ["duvet", "look", "r", 0.5, 0.85], ["bevel", "look", "r", 0.015, 0.05]],
  sofa: [["seats", "size", "i", 2, 4], ["arm", "look", "p", [0, 0.1, 0.16, 0.22]], ["arm_h", "look", "r", 0.5, 0.68], ["back_t", "look", "r", 0.08, 0.2], ["legs", "look", "p", [0.02, 0.06, 0.12, 0.15]],
         ["chaise", "layout", "p", ["none", "none", "left", "right"]], ["bevel", "look", "r", 0.015, 0.05]],
  bulkhead: [["border", "layout", "border"], ["pocket", "layout", "p"]],
  block: [["size", "size", "s", [0.2, 0.2, 0.2]], ["nosing", "look", "p", [0, 0, 0.02, 0.03]], ["bevel", "look", "r", 0.001, 0.02]],
  parts: [["size", "size", "s", [0.2, 0.2, 0.15]]],
  cushion: [["size", "size", "s", [0.15, 0.15, 0.2]], ["seam", "layout", "p"], ["puff", "look", "r", 0.25, 0.6], ["pipe", "look", "p", [0, 0.003, 0.005]],
            ["tufts", "layout", "p", [[0, 0], [0, 0], [1, 1], [2, 2], [3, 3]]], ["wrinkle", "look", "r", 0.002, 0.008], ["seed", "look", "seed"]],
  door: [["style", "layout", "p", ["flush", "panels", "shaker", "glass", "louvre"]], ["grid", "layout", "p", [[1, 1], [1, 2], [2, 2], [1, 3], [2, 3], [1, 4]]],
         ["rail", "look", "r", 0.07, 0.13], ["handle", "look", "p", ["lever_round", "lever_square", "bar_pull", "knob_round", "lever_plate_lock"]], ["hinges", "look", "i", 2, 3]],
  handle: [["rose", "look", "p"], ["points", "layout", "p"], ["lock", "look", "f", 0.3]],
  door_frame: [["lining", "look", "r", 0.015, 0.03], ["stop_t", "look", "r", 0.008, 0.016]],
  ashtray: [["rests", "layout", "p", [3, 3, 4]], ["butts", "layout", "i", 0, 6], ["seed", "look", "seed"]],
  clock: [["time", "look", "p", ["10:10:30", "02:47:00", "04:44:44", "07:15:10", "11:58:20", "03:33:33"]]],
  cigarette: [["left", "look", "r", 0.3, 1]],
  candle: [["left", "look", "r", 0.4, 1]],
  incense: [["left", "look", "r", 0.3, 1]],
  coil: [["left", "look", "r", 0.35, 1]],
  hob: [["zones", "layout", "i", 1, 4]],
};
const COL_PICK = ["door", "doors", "doors", "drawers", "open", "glass"];
// a variation of a full spec (withDefaults) from a seed: only the groups asked for change; the result is a full spec
export function variation(full, seed, groups = ["size", "layout", "look"]) {
  const R = rng((seed | 0) * 7919 + 13), s = clone(full), T = TYPES[s.type], P = Object.fromEntries(T.params.map(p => [p[0], p]));
  const step = (v, k) => P[k] && P[k][3] === "mm" ? Math.round(v * 2000) / 2000 : Math.round(v * 200) / 200;
  const pick = a => a[Math.floor(R() * a.length) % a.length];
  const base = s.size.slice();
  for (const [key, group, mode, a, b] of VARY[s.type] || []) {
    if (!groups.includes(group)) continue;
    if (mode === "r") s[key] = step(a + R() * (b - a), key);
    else if (mode === "i") s[key] = a + Math.floor(R() * (b - a + 1));
    else if (mode === "p") { const opts = a || (P[key] && P[key][4]) || [s[key]]; s[key] = clone(pick(opts)); }
    else if (mode === "f") { if (R() < (a ?? 0.5)) s[key] = !s[key]; }
    else if (mode === "seed") s[key] = 1 + Math.floor(R() * 9999);
    else if (mode === "s") s.size = s.size.map((v, k) => Math.max(0.01, Math.round(v * (1 + (a[k] || 0) * (2 * R() - 1)) * 100) / 100));
    else if (mode === "cols") {
      // a gap left on purpose (a void: the TV's place, an appliance's) stays where it is; the other columns change
      const tall = s.size[2] > 1.5, fresh = () => {
        const k = pick(COL_PICK), c = { k, w: 0, n: k === "drawers" ? 2 + Math.floor(R() * 3) : k === "open" ? 2 + Math.floor(R() * 4) : 0 };
        if (tall && R() < 0.35) { c.split = Math.round((0.35 + R() * 0.25) * 100) / 100; c.up = pick(["door", "doors", "open"]); }
        return c;
      };
      const cols = (s.cols && s.cols.length ? s.cols : [{ k: "doors" }]).map(c => c.k === "void" ? Object.assign({}, c, c.split ? { up: pick(["door", "doors", "open"]) } : {}) : Object.assign(fresh(), c.w ? { w: c.w } : {}));
      const free = cols.filter(c => c.k !== "void" && !c.w).length, more = R();
      if (more < 0.25 && cols.length < 6) cols.splice(Math.floor(R() * (cols.length + 1)), 0, fresh());
      else if (more > 0.8 && free > 1) cols.splice(cols.findIndex(c => c.k !== "void" && !c.w), 1);
      s.cols = cols;
      if (s.slide) for (const c of s.cols) { c.k = "door"; delete c.split; }
    } else if (mode === "holes") {
      const [W, , H] = s.size;
      s.holes = (s.holes && s.holes.length ? s.holes : [{ x: W / 4, z: H / 3, w: W / 2, h: H / 3, depth: s.size[1] * 0.6, shelves: 0 }]).map(o => {
        const w = Math.min(W - 0.1, Math.round(o.w * (0.8 + 0.4 * R()) * 100) / 100), h = Math.min(H, Math.round(o.h * (0.8 + 0.4 * R()) * 100) / 100);
        return { x: Math.round((W - w) / 2 * 100) / 100, z: Math.min(o.z, H - h), w, h, depth: Math.min(s.size[1] - 0.01, o.depth), shelves: Math.floor(R() * 3) };
      });
    } else if (mode === "border") s.border = s.border.map(() => pick([0, 0.25, 0.35, 0.45]));
    else s[key] = clone(a);
  }
  if (s.type === "bed" && groups.includes("size") && s.size.length === 2) s.size = [s.size[0], s.size[1], full.size[2]];
  const sized = groups.includes("size");
  if (s.type === "sofa" && !sized) { s.seats = full.seats; s.chaise = full.chaise; }
  else if (s.type === "sofa" && s.seats !== full.seats) {           // a sofa grows by its seats
    const per = (full.size[0] - 2 * (full.arm || 0)) / Math.max(1, full.seats);
    s.size[0] = Math.round((s.seats * per + 2 * (s.arm || 0)) * 100) / 100;
  } else if (s.type === "sofa" && s.arm !== full.arm) s.size[0] = Math.round((full.size[0] - 2 * full.arm + 2 * s.arm) * 100) / 100;
  if (s.type === "sofa" && sized && s.chaise !== "none" && s.size[1] < 1.4) { s.depth = s.size[1]; s.size[1] = 1.55; }
  if (s.type === "sofa" && sized && s.chaise === "none" && full.chaise !== "none") s.size[1] = full.depth || 0.92;
  if (s.type === "parts" && s.size.some((v, k) => v !== base[k])) {   // free parts scale with their box
    const f = s.size.map((v, k) => v / base[k]);
    s.parts = (s.parts || []).map(q => scalePart(q, f));
  }
  return s;
}
// a part scaled with its box, per axis: a cylinder stays round (its width takes the smaller of the two across)
export function scalePart(q, f) {
  const o = Object.assign({}, q, { at: q.at.map((v, k) => v * f[k]) });
  if (q.s === "pipe" || q.s === "sweep") { o.pts = (q.pts || []).map(p => p.map((v, k) => v * f[k])); if (q.sec) { const r = Math.min(...f); o.sec = { a: q.sec.a * r, b: q.sec.b * r, r: (q.sec.r ?? 0) * r }; } return o; }
  if (q.s === "lathe") {
    const along = q.axis === "-y" || q.axis === "y" ? 1 : q.axis === "x" || q.axis === "-x" ? 0 : 2, r = Math.min(...[0, 1, 2].filter(k => k !== along).map(k => f[k]));
    const fa = q.dir ? Math.min(...f) : f[along], fr = q.dir ? fa : r;         // a lathe on a slant keeps its shape
    o.prof = (q.prof || []).map(([pr, t]) => [pr * fr, t * fa]); o.size = [q.size[0] * fr, q.size[1] * fr, q.size[2] * fa]; return o;
  }
  if (q.s !== "cyl") { o.size = q.size.map((v, k) => v * f[k]); return o; }
  const along = q.axis === "-y" ? 1 : 2, across = [0, 1, 2].filter(k => k !== along), r = Math.min(...across.map(k => f[k]));
  o.size = [q.size[0] * r, q.size[1] * r, q.size[2] * f[along]];
  if (q.ri) o.ri = q.ri * r;
  return o;
}
// a few variations at once, all different from each other and from the start
export function variations(full, n, seed = 1, groups) {
  const out = [], seen = new Set([canon(full)]);
  for (let i = 0; out.length < n && i < n * 8; i++) {
    const v = variation(full, seed * 1000 + i, groups), c = canon(v);
    if (seen.has(c)) continue;
    seen.add(c); out.push(v);
  }
  return out;
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
// pivot: the point (item space) that becomes the mesh's origin: a door leaf's hinge axis (TYPES.door.pivot)
export function pivotOf(spec) { const T = TYPES[spec.type]; return T && T.pivot ? T.pivot(spec) : [0, 0, 0]; }
export function glb(G, name = "kit", pivot = [0, 0, 0]) {
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
      const p = [g.pos[i * 3] - pivot[0], g.pos[i * 3 + 2] - pivot[2], -(g.pos[i * 3 + 1] - pivot[1])];
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
