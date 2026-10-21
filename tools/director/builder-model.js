// The scene builder's model, without the page: rooms and openings in world metres, read from a story level or a
// reference layout and written back as the story's rooms (with the shared walls worked out: the taller, then the
// larger room builds a wall two rooms share, the other skips that stretch), openings, links, built-ins, stairs and
// the start spot. docs/SCENE_BUILDER.md has the rules; check.js-style tests run it in the page (builder_test.js).
import { KINDS, FIXTURES, OPENINGS, JO } from "./builder-presets.js";

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
           dir: o.dir || (d >= w ? "n" : "e"), extra: o.extra || {} };
}

export function newOpening(type, id, line, c, z, o = {}) {
  const D = OPENINGS[type];
  return { id, type, axis: line.axis, v: line.v, c, z, w: o.w || D.w, h: o.h || D.h, sill: o.sill ?? D.sill,
           swing: type === "slide" ? "slide" : (o.swing || "in"), locked_by: o.locked_by || null, creak: !!o.creak, extra: o.extra || {} };
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
  return { rooms, ops, floors, player: { x: P.start[0], y: P.start[1], yaw: P.start[2], z: 0 },
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
             fixtures: r.fixtures ?? (r.props || []).some(p => p.id.startsWith(`${r.id}_fx_`)), dir: r.dir || (r.size[1] >= r.size[0] ? "n" : "e"), extra };
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
  for (const [k, v] of Object.entries(lvl)) if (!["rooms", "links", "start"].includes(k)) levelExtra[k] = clone(v);
  return { rooms, ops, floors: floors.length ? floors : [0], player, her, levelExtra, startId: lvl.start || "start", problems: [] };
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
  const out = {}, links = [], seen = new Set();
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
    d.props = (r.extra.props || []).filter(p => !p.id.startsWith(`${r.id}_fx_`)).map(clone);
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
    if (other && op.type !== "window") {
      const key = [host.room.id, other.room.id].sort().join("|") + "|" + (o.door ? o.door.id : "");
      if (!seen.has(key)) { seen.add(key); links.push({ a: host.room.id, b: other.room.id, via: o.door ? o.door.id : null }); }
    }
  }
  // built-ins and stairs, placed clear of every doorway
  for (const r of model.rooms) {
    const d = out[r.id];
    const extra = [];
    if (r.fixtures) extra.push(...placeFixtures(model, r));
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
  const level = Object.assign({}, clone(model.levelExtra || {}), { start: startId, rooms: model.rooms.map(r => out[r.id]), links });
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
        // keep standing room in front of it (0.6 m) clear of the walls opposite
        done = { rect, wl };
      }
      if (done) break;
    }
    if (!done) continue;
    placed.push(done.rect);
    const [x0, y0, x1, y1] = done.rect;
    out.push({ id: `${r.id}_fx_${fx}`, shape: `box ${fw} ${fd} ${fh}`, at: [r3((x0 + x1) / 2), r3((y0 + y1) / 2)],
               rot: done.wl === "n" || done.wl === "s" ? 0 : 90, tag: FIXTURES[fx].tag });
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
  for (const r of model.rooms) r.id = fresh(r.id);
  for (const op of model.ops) if (op.type === "door" || op.type === "slide") op.id = fresh(op.id); else op.id = fresh(op.id);
  if (taken.has(model.startId || "start")) model.startId = fresh(levelName ? `${levelName}_start` : "start");
  else taken.add(model.startId || "start");
  return model;
}
