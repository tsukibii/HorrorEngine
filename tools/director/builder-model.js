// The scene builder's model, without the page: rooms and openings in world metres, read from a story level or a
// reference layout and written back as the story's rooms (with the shared walls worked out: the taller, then the
// larger room builds a wall two rooms share, the other skips that stretch), openings, links, built-ins, stairs and
// the start spot. docs/SCENE_BUILDER.md has the rules; check.js-style tests run it in the page (builder_test.js).
import { KINDS, FIXTURES, OPENINGS, JO, WALL_ITEMS, LIGHT_K, FINISH, FLOOR_BY_KIND, WINDOW_FRAME } from "./builder-presets.js";
import * as KIT from "./kit.js";

// the kit's presets (docs/KIT.md): the page sets them once it has them (stage.js loadAssetLibrary)
export const KITS = { presets: {} };
const kitFull = spec => KIT.withDefaults(KIT.resolve(spec, KITS.presets));
const noSize = k => { if (!k || typeof k !== "object") return k ? { preset: k } : null; const o = clone(k); delete o.size; return o; };

export const WALLS = ["n", "e", "s", "w"];
const OPP = { n: "s", s: "n", e: "w", w: "e" };
const OUTDOOR = new Set(["balcony", "garden", "common"]);
const r3 = v => Math.round(v * 1000) / 1000;
const clone = o => JSON.parse(JSON.stringify(o));
export const area = r => r.w * r.d;
export const jo = r => area(r) / JO;

// a wall as a line: axis "y" runs east-west at y = v, "x" runs north-south at x = v; lo..hi along it
export function wallLine(r, wall) {
  if (wall === "n") return { axis: "y", v: r.y + r.d, lo: r.x, hi: r.x + r.w };
  if (wall === "s") return { axis: "y", v: r.y, lo: r.x, hi: r.x + r.w };
  if (wall === "e") return { axis: "x", v: r.x + r.w, lo: r.y, hi: r.y + r.d };
  return { axis: "x", v: r.x, lo: r.y, hi: r.y + r.d };
}
const vOverlap = (a, b) => Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z);

// the stretches two rooms share: [{wa, wb, axis, v, lo, hi}] (only facing walls can meet)
export function shared(a, b) {
  if (vOverlap(a, b) <= 0.3) return [];
  const out = [];
  for (const wa of WALLS) {
    const la = wallLine(a, wa), lb = wallLine(b, OPP[wa]);
    if (Math.abs(la.v - lb.v) > 0.01) continue;
    const lo = Math.max(la.lo, lb.lo), hi = Math.min(la.hi, lb.hi);
    if (hi - lo > 0.05) out.push({ wa, wb: OPP[wa], axis: la.axis, v: la.v, lo, hi });
  }
  return out;
}

export function overlaps(a, b) {
  return vOverlap(a, b) > 0.3 && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.02 && Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y) > 0.02;
}

export function newRoom(kind, id, x, y, z = 0, o = {}) {
  const K = KINDS[kind] || KINDS.other;
  const [w, d] = o.size || K.size;
  return { id, kind, name: o.name || "", x, y, z, w, d, h: o.h || K.h || 2.4, floor: o.floor || K.floor, light: o.light || "dim",
           ceiling: o.ceiling ?? K.ceiling ?? true, open: (o.open || K.open || []).slice(), fixtures: o.fixtures ?? true,
           dir: o.dir || (d >= w ? "n" : "e"), floorKit: o.floorKit !== undefined ? o.floorKit : (FLOOR_BY_KIND[kind] ? { preset: FLOOR_BY_KIND[kind] } : null),
           ceilKit: o.ceilKit || null, extra: o.extra || {} };
}

export function newOpening(type, id, line, c, z, o = {}) {
  const D = OPENINGS[type];
  return { id, type, axis: line.axis, v: line.v, c, z, w: o.w || D.w, h: o.h || D.h, sill: o.sill ?? D.sill,
           swing: type === "slide" ? "slide" : (o.swing || "in"), locked_by: o.locked_by || null, creak: !!o.creak, extra: o.extra || {},
           frame: o.frame !== undefined ? o.frame : (type === "window" ? { preset: WINDOW_FRAME } : null) };
}

// ---- a reference layout -> the model ----
export function presetToModel(P) {
  const rooms = P.rooms.map(([id, kind, name, x0, y0, x1, y1, o = {}]) =>
    newRoom(kind, id, x0, y0, o.z || 0, Object.assign({}, o, { name, size: [r3(x1 - x0), r3(y1 - y0)] })));
  const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
  const ops = [], problems = [];
  for (const [a, b, type, o = {}] of P.doors || []) {
    const ra = byId[a], rb = byId[b];
    const z = o.z ?? Math.max(ra.z, rb.z);
    const sh = shared(ra, rb).sort((p, q) => (q.hi - q.lo) - (p.hi - p.lo))[0];
    if (!sh) { problems.push(`layout: ${a} and ${b} don't touch`); continue; }
    const w = Math.min(o.w || OPENINGS[type].w, sh.hi - sh.lo - 0.12);
    const c = Math.min(Math.max(sh.lo + (sh.hi - sh.lo) * (o.at ?? 0.5), sh.lo + w / 2 + 0.06), sh.hi - w / 2 - 0.06);
    const id = type === "arch" ? `${a}_${b}_arch` : (o.id || `${a}_${b}_door`);
    ops.push(newOpening(type, id, sh, r3(c), z, Object.assign({}, o, { w: r3(w) })));
  }
  for (const [rid, wall, type, o = {}] of P.windows || []) {
    const r = byId[rid], ln = wallLine(r, wall);
    const w = Math.min(o.w || OPENINGS[type].w, ln.hi - ln.lo - 0.3);
    ops.push(newOpening(type, `${rid}_${wall}_${type}`, ln, r3(ln.lo + (ln.hi - ln.lo) * (o.at ?? 0.5)), r.z, Object.assign({}, o, { w })));
  }
  const floors = P.floors || [0];
  const items = (P.items || []).map(([rid, wall, kind, at = 0.5], i) => {
    const r = byId[rid], ln = wallLine(r, wall), W = WALL_ITEMS[kind];
    return newItem(kind, `${rid}_wi_${kind}_${i + 1}`, rid, wall, r3((ln.hi - ln.lo) * at));
  });
  return { rooms, ops, items, kits: [], floors, finish: Object.assign({}, FINISH), player: { x: P.start[0], y: P.start[1], yaw: P.start[2], z: 0 },
           her: { x: P.her[0], y: P.her[1], yaw: P.her[2], z: 0 }, levelExtra: {}, startId: "start", problems };
}

// ---- a story level -> the model ----
const KIND_GUESS = [[/genkan|entrance|entry|porch_in/, "genkan"], [/porch|garden|yard|path/, "garden"], [/hall|corridor|landing|passage/, "corridor"],
  [/kitchen/, "kitchen"], [/bath/, "bath"], [/toilet|wc|loo/, "toilet"], [/wash|laundry|utility/, "washroom"], [/closet|wardrobe/, "closet"],
  [/stair/, "stairs"], [/balcony|terrace/, "balcony"], [/bed|room_\d/, "bedroom"], [/living|lounge|ldk/, "ldk"], [/dining/, "dining"],
  [/study|office/, "study"], [/cellar|basement|storage|store/, "storage"], [/tatami|washitsu|japanese/, "washitsu"]];
export function guessKind(id) { for (const [re, k] of KIND_GUESS) if (re.test(id)) return k; return "other"; }
const ROOM_KEYS = new Set(["id", "at", "size", "floor", "light", "ceiling", "skip", "openings", "kind", "name", "dir", "fixtures"]);

export function levelToModel(story, levelName) {
  const lvl = story.levels[levelName];
  const rooms = lvl.rooms.map(r => {
    const extra = {};
    for (const [k, v] of Object.entries(r)) if (!ROOM_KEYS.has(k)) extra[k] = clone(v);
    const kind = r.kind || guessKind(r.id);
    return { id: r.id, kind, name: r.name || "", x: r.at[0], y: r.at[1], z: r.at[2], w: r.size[0], d: r.size[1], h: r.size[2],
             floor: r.floor || (KINDS[kind] || KINDS.other).floor, light: r.light || "dim", ceiling: r.ceiling !== false, open: [],
             fixtures: r.fixtures ?? (r.props || []).some(p => p.id.startsWith(`${r.id}_fx_`) && !/_fx_(light|switch|floor|ceiling|win\d+)$/.test(p.id)),
             dir: r.dir || (r.size[1] >= r.size[0] ? "n" : "e"), extra,
             floorKit: noSize(((r.props || []).find(p => p.id === `${r.id}_fx_floor`) || {}).kit),
             ceilKit: noSize(((r.props || []).find(p => p.id === `${r.id}_fx_ceiling`) || {}).kit) };
  });
  const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
  // a wall skipped whole that no neighbour builds is an open side (a porch, a balcony's railing side)
  for (const sr of lvl.rooms) {
    for (const wl of sr.skip || []) {
      if (typeof wl !== "string") continue;
      const r = byId[sr.id], ln = wallLine(r, wl);
      let cover = 0;
      for (const o of rooms) if (o !== r) for (const sh of shared(r, o)) if (sh.wa === wl) cover += sh.hi - sh.lo;
      if (cover < ln.hi - ln.lo - 0.05) r.open.push(wl);
    }
  }
  const ops = [];
  for (const sr of lvl.rooms) {
    const r = byId[sr.id];
    for (const op of sr.openings || []) {
      const ln = wallLine(r, op.wall), sill = op.sill || 0;
      const type = op.door ? (op.door.swing === "slide" ? "slide" : "door") : op.window ? "window" : "arch";
      const upper = type !== "window" && sill > 0.3;                  // a door onto an upper floor (a stair's top)
      const dx = Object.assign({}, op.door || {});
      const o = newOpening(type, (op.door && op.door.id) || `${r.id}_${op.wall}_${type}`, ln, r3(ln.lo + op.at), r3(r.z + (upper ? sill : 0)),
        { w: op.w, h: op.h, sill: upper ? 0 : sill, swing: dx.swing, locked_by: dx.locked_by, creak: dx.creak });
      delete dx.id; delete dx.swing; delete dx.locked_by; delete dx.creak;
      o.extra = dx;
      o.frame = null;
      ops.push(o);
    }
  }
  const floors = [...new Set(rooms.filter(r => r.kind !== "stairs").map(r => r3(r.z)))].sort((a, b) => a - b);
  // the player's start and a second person (the first cast member) in the biggest room
  let player = { x: 0, y: 0, yaw: 90, z: 0 };
  for (const r of lvl.rooms) for (const p of r.props || []) if (p.id === lvl.start) player = { x: r.at[0] + p.at[0], y: r.at[1] + p.at[1], yaw: p.rot ?? 90, z: r.at[2] };
  const big = rooms.filter(r => !OUTDOOR.has(r.kind)).sort((a, b) => area(b) - area(a))[0] || rooms[0];
  const her = { x: big.x + big.w / 2, y: big.y + big.d / 2, yaw: 270, z: big.z };
  const levelExtra = {};
  for (const [k, v] of Object.entries(lvl)) if (!["rooms", "links", "start", "trim"].includes(k)) levelExtra[k] = clone(v);
  // wall items: the props named <room>_wi_<kind>_<n> (and wall fittings, <room>_wf_<n>), read back to their wall
  const items = [], kits = [];
  for (const sr of lvl.rooms) for (const p of sr.props || []) {
    const r = byId[sr.id];
    // window frames: <room>_fx_win<n>, of: the window
    if (new RegExp(`^${sr.id}_fx_win\\d+$`).test(p.id) && p.of && p.kit) { const op = ops.find(o => o.id === p.of); if (op) op.frame = noSize(p.kit); continue; }
    if (new RegExp(`^${sr.id}_kt_`).test(p.id) && p.kit) {          // kit things placed in the room
      const sz = (p.kit.size || []).slice();
      const ex = clone(p); for (const k of ["id", "at", "rot", "z", "kit"]) delete ex[k];
      kits.push({ id: p.id, room: sr.id, x: p.at[0], y: p.at[1], z: p.z || 0, rot: p.rot || 0, spec: noSize(p.kit), size: sz.length === 3 ? sz : null, extra: ex });
      continue;
    }
    const m = p.id.match(new RegExp(`^${sr.id}_wi_([a-z0-9]+)_`)), f = new RegExp(`^${sr.id}_wf_`).test(p.id);
    if (!(m && WALL_ITEMS[m[1]]) && !f) continue;
    let w, t, h;
    if (p.kit && Array.isArray(p.kit.size)) [w, t, h] = p.kit.size;
    else if (/^box /.test(p.shape || "")) [w, t, h] = p.shape.split(/\s+/).slice(1).map(Number);
    else continue;
    const [ax, ay] = p.at, ns = Math.round(((p.rot || 0) % 180 + 180) % 180) !== 90;
    const wall = ns ? (ay > r.d / 2 ? "n" : "s") : (ax > r.w / 2 ? "e" : "w");
    const it = Object.assign(newItem(f ? "fit" : m[1], p.id, sr.id, wall, ns ? ax : ay), { w, h, t, z: r3((p.z || 0) + h / 2), extra: clone(p) });
    if (p.kit) it.kit = noSize(p.kit);
    delete it.extra.kit; delete it.extra.shape;
    items.push(it);
  }
  const tr = lvl.trim || {};
  const finish = { skirting: tr.skirting || 0, cornice: tr.cornice || 0, casing: tr.casing || 0, threshold: tr.threshold || 0,
                   lights: lvl.rooms.some(r => (r.props || []).some(p => p.id === `${r.id}_fx_light`)),
                   switches: lvl.rooms.some(r => (r.props || []).some(p => p.id === `${r.id}_fx_switch`)) };
  return { rooms, ops, items, kits, floors: floors.length ? floors : [0], finish, player, her, levelExtra, startId: lvl.start || "start", problems: [] };
}

// ---- the model -> a story level ----
// who builds a stretch two rooms share: not a room open on that side, then the taller, then the larger, then by id
function builder(a, b, sh) {
  const ao = a.open.includes(sh.wa), bo = b.open.includes(sh.wb);
  if (ao && bo) return null;
  if (ao) return b;
  if (bo) return a;
  if (Math.abs(a.h - b.h) > 0.01) return a.h > b.h ? a : b;
  if (Math.abs(area(a) - area(b)) > 0.01) return area(a) > area(b) ? a : b;
  return a.id < b.id ? a : b;
}

function merge(spans) {
  const out = [];
  for (const [a, b] of spans.slice().sort((p, q) => p[0] - q[0])) {
    if (out.length && a <= out[out.length - 1][1] + 0.01) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
}

export function skips(model) {
  const S = {};                                  // room id -> wall -> [[a0, a1]] (along the wall from its west/south end)
  for (const r of model.rooms) { S[r.id] = { n: [], e: [], s: [], w: [] }; for (const wl of r.open) S[r.id][wl].push([0, 1e9]); }
  const rs = model.rooms;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    for (const sh of shared(a, b)) {
      const own = builder(a, b, sh);
      for (const [r, wl] of [[a, sh.wa], [b, sh.wb]]) {
        if (r === own) continue;
        const lo = wallLine(r, wl).lo;
        S[r.id][wl].push([sh.lo - lo, sh.hi - lo]);
      }
    }
  }
  for (const r of rs) for (const wl of WALLS) {
    const len = wallLine(r, wl).hi - wallLine(r, wl).lo;
    S[r.id][wl] = merge(S[r.id][wl].map(([a, b]) => [Math.max(0, a), Math.min(len, b)]));
  }
  return S;
}
const isSkipped = (S, r, wl, a0, a1) => S[r.id][wl].some(([s0, s1]) => s0 <= a0 + 0.02 && s1 >= a1 - 0.02);

// the rooms an opening sits between: [{room, wall, at}] (one: an outside wall; two: between rooms)
// The host (the room whose wall holds it) must hold all of its height; the room on the other side only has to be
// there at its foot (a balcony's 1.1 m railing behind a 2 m glass door).
export function sides(model, op) {
  const out = [];
  for (const r of model.rooms) {
    if (r.z > op.z + 0.01 || r.z + r.h < op.z + (op.sill || 0) + 0.3) continue;
    for (const wl of WALLS) {
      const ln = wallLine(r, wl);
      if (ln.axis !== op.axis || Math.abs(ln.v - op.v) > 0.01) continue;
      if (op.c - op.w / 2 < ln.lo - 0.01 || op.c + op.w / 2 > ln.hi + 0.01) continue;
      out.push({ room: r, wall: wl, at: op.c - ln.lo, holds: op.z + op.sill + op.h <= r.z + r.h + 0.01 });
    }
  }
  return out;
}

export function modelToLevel(model, story) {
  const S = skips(model), problems = [];
  const out = {}, links = [], seen = new Set(), frames = [];
  for (const r of model.rooms) {
    const d = Object.assign({}, clone(r.extra), { id: r.id, at: [r3(r.x), r3(r.y), r3(r.z)], size: [r3(r.w), r3(r.d), r3(r.h)], floor: r.floor, light: r.light });
    if (!r.ceiling) d.ceiling = false; else delete d.ceiling;
    d.kind = r.kind;
    if (r.name) d.name = r.name;
    if (r.kind === "stairs") d.dir = r.dir;
    const skip = [];
    for (const wl of WALLS) {
      const len = r3(wallLine(r, wl).hi - wallLine(r, wl).lo);
      const sp = S[r.id][wl];
      if (sp.length === 1 && sp[0][0] <= 0.02 && sp[0][1] >= len - 0.02) skip.push(wl);
      else for (const [a0, a1] of sp) skip.push([wl, r3(a0), r3(a1)]);
    }
    if (skip.length) d.skip = skip; else delete d.skip;
    d.openings = [];
    d.props = (r.extra.props || []).filter(p => !["_fx_", "_wi_", "_wf_", "_kt_"].some(k => p.id.startsWith(r.id + k))).map(clone);
    if (!d.props.length) delete d.props;
    out[r.id] = d;
  }
  for (const op of model.ops) {
    const sd = sides(model, op);
    const built = sd.filter(s => s.holds && !isSkipped(S, s.room, s.wall, s.at - op.w / 2, s.at + op.w / 2));
    if (!sd.length) { problems.push(`${op.id}: not on a wall`); continue; }
    if (!built.length) { problems.push(`${op.id}: on a wall nobody builds (an open side)`); continue; }
    const host = built[0], other = sd.find(s => s.room !== host.room);
    const o = { wall: host.wall, at: r3(host.at), w: r3(op.w), h: r3(op.h) };
    const sill = r3(op.z - host.room.z + (op.sill || 0));
    if (sill > 0.001) o.sill = sill;
    if (op.type === "window") o.window = true;
    if (op.type === "door" || op.type === "slide") {
      o.door = Object.assign({ id: op.id, swing: op.type === "slide" ? "slide" : (op.swing || "in") }, clone(op.extra || {}));
      if (op.locked_by) o.door.locked_by = op.locked_by;
      if (op.creak) o.door.creak = true;
    }
    out[host.room.id].openings.push(o);
    if (op.type === "window" && op.frame) frames.push({ op, host });
    if (other && op.type !== "window") {
      const key = [host.room.id, other.room.id].sort().join("|") + "|" + (o.door ? o.door.id : "");
      if (!seen.has(key)) { seen.add(key); links.push({ a: host.room.id, b: other.room.id, via: o.door ? o.door.id : null }); }
    }
  }
  // built-ins and stairs, placed clear of every doorway; ceiling lights and their switches; things on the walls
  const fin = Object.assign({}, FINISH, model.finish || {});
  for (const r of model.rooms) {
    const d = out[r.id];
    const extra = [];
    if (r.fixtures) extra.push(...placeFixtures(model, r));
    if (fin.lights && r.ceiling && !OUTDOOR.has(r.kind) && !["closet", "oshiire", "storage"].includes(r.kind)) {
      extra.push({ id: `${r.id}_fx_light`, use: "light", kind: "bulb", lit: !["off", "dark"].includes(r.light), at: [r3(r.w / 2), r3(r.d / 2)],
                   z: r3(r.h - 0.08), kelvin: LIGHT_K[r.kind] || 3000, lumens: Math.round(Math.min(4000, 250 * area(r))) });
      if (fin.switches) { const sw = switchFor(model, r); if (sw) extra.push(sw); }
    }
    for (const it of (model.items || []).filter(i => i.room === r.id)) extra.push(itemProp(r, it));
    const fl = r.floorKit && kitProp(r.floorKit, `${r.id}_fx_floor`, problems);
    if (fl) extra.push(Object.assign(fl, { kit: Object.assign(fl.kit, { size: [r3(r.w - 0.1), r3(r.d - 0.1), fl.kit.size[2]] }), at: [r3(r.w / 2), r3(r.d / 2)] }));
    const cl = r.ceilKit && r.ceiling && kitProp(r.ceilKit, `${r.id}_fx_ceiling`, problems);
    if (cl) { const dh = cl.kit.size[2]; extra.push(Object.assign(cl, { kit: Object.assign(cl.kit, { size: [r3(r.w - 0.1), r3(r.d - 0.1), dh] }), at: [r3(r.w / 2), r3(r.d / 2)], z: r3(r.h - dh) })); }
    for (const k of (model.kits || []).filter(k => k.room === r.id)) {
      const kp = kitProp(Object.assign({}, k.spec, k.size ? { size: k.size } : {}), k.id, problems);
      if (kp) extra.push(Object.assign(clone(k.extra || {}), kp, { at: [r3(k.x), r3(k.y)], rot: Math.round(k.rot) % 360 }, k.z ? { z: r3(k.z) } : {}));
    }
    frames.filter(f => f.host.room === r).forEach((f, i) => { const fp = frameProp(r, f, `${r.id}_fx_win${i + 1}`, problems); if (fp) extra.push(fp); });
    if (r.kind === "stairs" && r.fixtures) { const st = stairsProp(model, r); if (st) extra.push(st); else problems.push(`${r.id}: stairs need a floor above (add one)`); }
    if (extra.length) d.props = (d.props || []).concat(extra);
  }
  for (const d of Object.values(out)) if (!d.openings.length) delete d.openings;
  // the start: the player's spot, in the room they stand in
  const startId = model.startId || "start";
  let startProp = { id: startId, use: "spot" };
  for (const d of Object.values(out)) {
    const i = (d.props || []).findIndex(p => p.id === startId);
    if (i >= 0) { startProp = d.props[i]; d.props.splice(i, 1); if (!d.props.length) delete d.props; }
  }
  const p = model.player;
  const home = roomAt(model, p.x, p.y, p.z);
  if (!home) problems.push("the player's start isn't in a room: drag it into one");
  else {
    startProp = Object.assign({}, startProp, { at: [r3(p.x - home.x), r3(p.y - home.y)], rot: Math.round(p.yaw) });
    delete startProp.z;
    out[home.id].props = (out[home.id].props || []).concat([startProp]);
  }
  for (let i = 0; i < model.rooms.length; i++) for (let j = i + 1; j < model.rooms.length; j++)
    if (overlaps(model.rooms[i], model.rooms[j])) problems.push(`${model.rooms[i].id} and ${model.rooms[j].id} overlap`);
  for (const it of model.items || []) {
    const r = model.rooms.find(x => x.id === it.room);
    if (!r) { problems.push(`${it.id}: its room is gone`); continue; }
    const ln = wallLine(r, it.wall), c = ln.lo + it.a;
    for (const op of model.ops) {
      if (op.axis !== ln.axis || Math.abs(op.v - ln.v) > 0.01 || Math.abs(op.c - c) >= (op.w + it.w) / 2) continue;
      const o0 = op.z + (op.sill || 0) - r.z, o1 = o0 + op.h;
      if (it.z + it.h / 2 > o0 && it.z - it.h / 2 < o1) problems.push(`${it.id} covers ${op.id}`);
    }
  }
  const level = Object.assign({}, clone(model.levelExtra || {}), { start: startId, rooms: model.rooms.map(r => out[r.id]), links });
  const trim = {};
  for (const k of ["skirting", "cornice", "casing", "threshold"]) if (fin[k] > 0) trim[k] = r3(fin[k]);
  if (Object.keys(trim).length) level.trim = trim;
  return { level, problems };
}

export function roomAt(model, x, y, z = 0) {
  const c = model.rooms.filter(r => x > r.x + 0.01 && x < r.x + r.w - 0.01 && y > r.y + 0.01 && y < r.y + r.d - 0.01 && r.z <= z + 0.3 && r.z + r.h > z + 0.3);
  return c.sort((a, b) => b.z - a.z || area(a) - area(b))[0] || null;
}

// the doorway clearances that reach into a room (0.8 m each side of every walk-through opening, as level_check
// clears them, so a thin closet's door also keeps clear the room behind it): room-space rects
function doorZones(model, r) {
  const zs = [];
  for (const op of model.ops) {
    if (op.type === "window" || (op.sill || 0) > 0.3 || op.z > r.z + 0.3 || op.z < r.z - 0.3) continue;
    const a0 = op.c - op.w / 2 - 0.05, a1 = op.c + op.w / 2 + 0.05, b0 = op.v - 0.85, b1 = op.v + 0.85;
    const w = op.axis === "y" ? [a0, b0, a1, b1] : [b0, a0, b1, a1];        // world x0 y0 x1 y1
    zs.push([w[0] - r.x, w[1] - r.y, w[2] - r.x, w[3] - r.y]);
  }
  return zs;
}
const hit = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0.01 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.01;

function placeFixtures(model, r) {
  const want = (KINDS[r.kind] || {}).fx || [];
  if (!want.length) return [];
  const zones = doorZones(model, r), placed = [], out = [];
  // wall items that hang low (a TV, a mirror) keep their stretch of wall clear: [rect, bottom height]
  const hung = (model.items || []).filter(i => i.room === r.id).map(i => {
    const g = 0.05, a0 = i.a - i.w / 2, a1 = i.a + i.w / 2, t = i.t + 0.02;
    const rect = i.wall === "n" ? [a0, r.d - g - t, a1, r.d] : i.wall === "s" ? [a0, 0, a1, g + t] : i.wall === "w" ? [0, a0, g + t, a1] : [r.w - g - t, a0, r.w, a1];
    return [rect, i.z - i.h / 2];
  });
  // furniture placed from the kit keeps its floor: its footprint (axis-aligned) in room space
  for (const k of (model.kits || []).filter(k => k.room === r.id)) {
    let surf = false; try { surf = ["tiles", "planks", "tatami", "rug"].includes(KIT.resolve(k.spec, KITS.presets).type); } catch (e) { }
    if (surf || mountOf(k.spec) === "ceiling" || k.z > 1.2 || !k.size) continue;
    const a = k.rot * Math.PI / 180, hw = (Math.abs(Math.cos(a)) * k.size[0] + Math.abs(Math.sin(a)) * k.size[1]) / 2, hd = (Math.abs(Math.sin(a)) * k.size[0] + Math.abs(Math.cos(a)) * k.size[1]) / 2;
    placed.push([k.x - hw, k.y - hd, k.x + hw, k.y + hd]);
  }
  const winOn = wl => model.ops.filter(op => op.type !== "window" ? false : sides(model, op).some(s => s.room === r && s.wall === wl));
  const walls = WALLS.filter(wl => !r.open.includes(wl)).sort((a, b) => (wallLine(r, b).hi - wallLine(r, b).lo) - (wallLine(r, a).hi - wallLine(r, a).lo));
  for (const fx of want) {
    const [fw, fd, fh] = FIXTURES[fx].size;
    let done = null;
    for (const wl of walls) {
      const L = wallLine(r, wl).hi - wallLine(r, wl).lo;
      if (L < fw + 0.15) continue;
      const lowWin = winOn(wl).some(op => op.sill < fh + 0.05);
      if (lowWin) continue;
      for (let k = 0; k <= Math.ceil(L / 0.05) && !done; k++) {
        const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.05, a = L / 2 + off;
        if (a - fw / 2 < 0.07 || a + fw / 2 > L - 0.07) continue;
        const g = 0.07;
        const rect = wl === "n" ? [a - fw / 2, r.d - g - fd, a + fw / 2, r.d - g] : wl === "s" ? [a - fw / 2, g, a + fw / 2, g + fd]
                   : wl === "w" ? [g, a - fw / 2, g + fd, a + fw / 2] : [r.w - g - fd, a - fw / 2, r.w - g, a + fw / 2];
        if (rect[2] > r.w || rect[3] > r.d || zones.some(z => hit(z, rect)) || placed.some(p => hit(p, rect))) continue;
        if (hung.some(([hr, bottom]) => bottom < fh + 0.05 && hit(hr, rect))) continue;
        // keep standing room in front of it (0.6 m) clear of the walls opposite
        done = { rect, wl };
      }
      if (done) break;
    }
    if (!done) continue;
    placed.push(done.rect);
    const [x0, y0, x1, y1] = done.rect;
    const F = FIXTURES[fx], useKit = F.kit && KITS.presets[F.kit];
    out.push(Object.assign({ id: `${r.id}_fx_${fx}` }, useKit ? { kit: { preset: F.kit, size: [fw, fd, fh] } } : { shape: `box ${fw} ${fd} ${fh}` },
               { at: [r3((x0 + x1) / 2), r3((y0 + y1) / 2)], rot: FACE[done.wl], tag: F.tag }));
  }
  return out;
}

// a stair: the steps climb `dir` from a 0.85 m landing at the bottom to the floor above, ending at the far wall
function stairsProp(model, r) {
  const above = model.floors.filter(z => z > r.z + 0.5).sort((a, b) => a - b)[0];
  if (above === undefined || above > r.z + r.h - 1.9) return null;
  const ns = r.dir === "n" || r.dir === "s", long = ns ? r.d : r.w, across = ns ? r.w : r.d;
  const run = r3(long - 0.85 - 0.07), sw = r3(across - 0.14), mid = 0.85 + run / 2;
  const at = r.dir === "n" ? [r.w / 2, mid] : r.dir === "s" ? [r.w / 2, r.d - mid] : r.dir === "e" ? [mid, r.d / 2] : [r.w - mid, r.d / 2];
  return { id: `${r.id}_fx_stairs`, shape: `stairs ${sw} ${run} ${r3(above - r.z)}`, at: at.map(r3), rot: { n: 90, s: 270, e: 0, w: 180 }[r.dir], tag: "stairs" };
}

// ---- what the plan holds for events ----
export function stats(model, level) {
  const indoor = model.rooms.filter(r => !OUTDOOR.has(r.kind) && r.ceiling);
  const floorArea = {};
  for (const r of indoor) floorArea[r.z] = (floorArea[r.z] || 0) + area(r);
  const ids = model.rooms.map(r => r.id), adj = Object.fromEntries(ids.map(i => [i, new Set()]));
  for (const l of level.links) { adj[l.a] && adj[l.a].add(l.b); adj[l.b] && adj[l.b].add(l.a); }
  // components and loops (the cyclomatic number of the door graph: how many ways round there are)
  const seen = new Set(); let comps = 0;
  for (const i of ids) { if (seen.has(i)) continue; comps++; const st = [i]; while (st.length) { const n = st.pop(); if (seen.has(n)) continue; seen.add(n); for (const m of adj[n]) st.push(m); } }
  const edges = new Set(level.links.map(l => [l.a, l.b].sort().join("|"))).size;
  const loops = edges - ids.length + comps;
  const start = roomAt(model, model.player.x, model.player.y, model.player.z);
  const reach = new Set();
  if (start) { const st = [start.id]; while (st.length) { const n = st.pop(); if (reach.has(n)) continue; reach.add(n); for (const m of adj[n]) st.push(m); } }
  const hiding = model.rooms.filter(r => ["closet", "walkin", "oshiire", "storage", "bath"].includes(r.kind)).length;
  const dead = model.rooms.filter(r => adj[r.id].size === 1 && !["closet", "walkin", "oshiire", "storage", "toilet", "bath"].includes(r.kind)).map(r => r.id);
  const doors = model.ops.filter(o => o.type === "door" || o.type === "slide").length;
  return { floorArea, total: Object.values(floorArea).reduce((a, b) => a + b, 0), rooms: model.rooms.length, doors, loops,
           unreachable: ids.filter(i => !reach.has(i)), hiding, dead, floors: model.floors.length };
}

// Ids are unique across the whole story file: a layout added beside other levels renames whatever it shares with
// them (a second "genkan" becomes "genkan_2", the start "<level>_start").
export function takenIds(story, except) {
  const s = Object.assign({}, story, { levels: Object.fromEntries(Object.entries(story.levels || {}).filter(([k]) => k !== except)) });
  const out = new Set();
  const walk = o => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== "object") return;
    if (typeof o.id === "string") out.add(o.id);
    for (const v of Object.values(o)) walk(v);
  };
  walk(s.levels);
  for (const k of ["items", "notes", "sounds", "lines", "scenes", "stitches", "motions", "flow", "secrets", "interrupts"]) for (const id of Object.keys(s[k] || {})) out.add(id);
  return out;
}
export function uniquify(model, taken, levelName) {
  const fresh = id => { if (!taken.has(id)) { taken.add(id); return id; } let i = 2; while (taken.has(`${id}_${i}`)) i++; taken.add(`${id}_${i}`); return `${id}_${i}`; };
  for (const r of model.rooms) { const old = r.id; r.id = fresh(r.id); if (old !== r.id) renameItems(model, old, r.id); }
  for (const it of model.items || []) it.id = fresh(it.id);
  for (const k of model.kits || []) k.id = fresh(k.id);
  for (const op of model.ops) if (op.type === "door" || op.type === "slide") op.id = fresh(op.id); else op.id = fresh(op.id);
  if (taken.has(model.startId || "start")) model.startId = fresh(levelName ? `${levelName}_start` : "start");
  else taken.add(model.startId || "start");
  return model;
}

// ---- things on walls ----
export function newItem(kind, id, room, wall, a, o = {}) {
  const W = WALL_ITEMS[kind] || { size: [0.1, 0.1, 0.01], z: 1.2 };
  const it = { id, kind, room, wall, a, w: o.w || W.size[0], h: o.h || W.size[1], t: o.t || W.size[2], z: o.z || W.z, extra: o.extra || {} };
  if (o.kit) it.kit = o.kit;
  return it;
}
// a wall fitting from a kit preset (a switch plate, a socket, a panel): its size and height from the preset
export function newFitting(preset, id, room, wall, a) {
  const P = KITS.presets[preset], [w, t, h] = kitFull({ preset }).size;
  return newItem("fit", id, room, wall, a, { w, h, t, z: r3((P && P.z !== undefined ? P.z : 1.2) + h / 2), kit: { preset } });
}
// a kit thing placed in a room: x, y its middle in room space, z its base above the floor, rot its front's way
export function newKit(preset, id, room, x, y, o = {}) {
  const P = KITS.presets[preset] || {}, f = kitFull({ preset });
  return { id, room, x, y, z: o.z ?? (P.z || 0), rot: o.rot || 0, spec: { preset }, size: f.size.slice(), extra: {} };
}
export const mountOf = spec => { try { const r = KIT.resolve(spec, KITS.presets); const p = r && spec.preset ? KITS.presets[spec.preset] : null; return (p && p.mount) || KIT.TYPES[r.type].mount; } catch (e) { return "floor"; } };
// the prop a wall item becomes: a box against the inside face of its wall, its middle at z
function itemProp(r, it) {
  const ln = wallLine(r, it.wall), len = ln.hi - ln.lo, T = 0.1;
  const a = Math.min(Math.max(it.a, it.w / 2 + 0.06), len - it.w / 2 - 0.06), off = T / 2 + it.t / 2 + 0.001;
  const at = it.wall === "n" ? [a, r.d - off] : it.wall === "s" ? [a, off] : it.wall === "e" ? [r.w - off, a] : [off, a];
  const zc = Math.min(it.z, r.h - 0.04 - it.h / 2);
  const W = WALL_ITEMS[it.kind], spec = it.kit || (W && W.kit ? { preset: W.kit } : null);
  const p = Object.assign({}, clone(it.extra || {}), { id: it.id, at: at.map(r3), rot: FACE[it.wall], z: r3(zc - it.h / 2) });
  if (W && W.tag) p.tag = W.tag;
  if (spec && (!spec.preset || KITS.presets[spec.preset] || !Object.keys(KITS.presets).length)) p.kit = Object.assign(clone(spec), { size: [r3(it.w), r3(it.t), r3(it.h)] });
  else p.shape = `box ${r3(it.w)} ${r3(it.t)} ${r3(it.h)}`;
  return p;
}
// the rot that turns a kit thing's front (its -y) away from a wall, into the room
export const FACE = { n: 0, s: 180, e: 270, w: 90 };
// a kit spec as a prop: its full size worked out (from its preset when it has none)
function kitProp(spec, id, problems) {
  try { const f = kitFull(spec); const k = clone(spec); k.size = f.size.map(r3); return { id, kit: k }; }
  catch (e) { problems.push(`${id}: ${e.message}`); return null; }
}
// a window's frame: in the wall's thickness, its sill (the stool) reaching into the room
function frameProp(r, { op, host }, id, problems) {
  let f;
  try { f = kitFull(op.frame); } catch (e) { problems.push(`${op.id}'s frame: ${e.message}`); return null; }
  const T = 0.1, stool = Math.max(0, +f.stool || 0), st = stool > 0 ? Math.max(0.005, +f.stool_t || 0) : 0, d = T + stool;
  const off = stool / 2, a = host.at, sill = op.z - r.z + (op.sill || 0);
  const at = host.wall === "n" ? [a, r.d - off] : host.wall === "s" ? [a, off] : host.wall === "e" ? [r.w - off, a] : [off, a];
  const k = clone(op.frame); k.size = [r3(op.w), r3(d), r3(op.h + st)]; k.wall = T;
  return { id, kit: k, at: at.map(r3), rot: FACE[host.wall], z: r3(sill - st), in_wall: true, of: op.id };
}
// a light switch by the first doorway into the room, on the room's side, past the door's casing
function switchFor(model, r) {
  const T = 0.1;
  for (const op of model.ops) {
    if (op.type === "window" || Math.abs(op.z - r.z) > 0.3) continue;
    const s = sides(model, op).find(x => x.room === r);
    if (!s || r.open.includes(s.wall)) continue;
    const ln = wallLine(r, s.wall), len = ln.hi - ln.lo;
    for (const a of [s.at + op.w / 2 + 0.2, s.at - op.w / 2 - 0.2]) {
      if (a < 0.2 || a > len - 0.2) continue;
      if (model.ops.some(o => o !== op && o.axis === ln.axis && Math.abs(o.v - ln.v) < 0.01 && Math.abs(ln.lo + a - o.c) < o.w / 2 + 0.15)) continue;
      const it = newItem("switch", `${r.id}_fx_switch`, r.id, s.wall, a);
      return Object.assign(itemProp(r, it), { use: "switch", light: `${r.id}_fx_light` });
    }
  }
  return null;
}
// a room renamed: its wall items follow it (their ids carry the room's, so a level reads them back)
export function renameItems(model, from, to) {
  for (const it of model.items || []) if (it.room === from) { it.room = to; it.id = it.id.replace(new RegExp(`^${from}_(wi|wf)_`), `${to}_$1_`); }
  for (const k of model.kits || []) if (k.room === from) { k.room = to; k.id = k.id.replace(new RegExp(`^${from}_kt_`), `${to}_kt_`); }
}

// A level taken from another game's script, as a start: its rooms, doors, built-ins, trim and wall items, and its
// plain props; what belongs to that game's story (things you use, people, the start) is left behind.
export function borrowLevel(story, levelName) {
  const m = levelToModel(story, levelName);
  for (const r of m.rooms) {
    r.extra.props = (r.extra.props || []).filter(p => !p.use && !(p.shape || "").startsWith("person") && !p.on);
    if (!r.extra.props.length) delete r.extra.props;
  }
  for (const o of m.ops) o.locked_by = null;   // its key stays with the other game's script
  m.startId = "start";
  return m;
}
