// Copy and paste on the desk: commands, beats, a scene's lines and whole cards (with their scenes and tasks), within a
// game or into another. What's pasted gets new ids where ids must be unique (cards, scenes, tasks, beats, questions, a
// version's lines), and the links inside what was copied follow it (a beat's "after", an answer's question, a card's
// next); links out of it are dropped. On the system clipboard it's JSON text, so it can go into a chat and back; plain
// JSON of commands, beats or lines (Claude's, say) pastes too. No DOM: DESK tests it.
import { allIds } from "./refs.js";
import { ACTION, verbOfAction } from "./commands.js";

export const MARK = "horrorstudio-desk";
const clone = o => JSON.parse(JSON.stringify(o));
const isObj = x => x && typeof x === "object" && !Array.isArray(x);
export function pack(kind, items, extra = {}) { return Object.assign({ desk: MARK, kind, items: clone(items) }, clone(extra)); }
// the clipboard's text back into what it was: ours, or plain JSON that reads as commands, beats or lines
export function unpack(text) {
  let x; try { x = JSON.parse(text); } catch (e) { return null; }
  if (isObj(x) && x.desk === MARK && Array.isArray(x.items)) return x;
  const list = Array.isArray(x) ? x : isObj(x) ? [x] : null;
  if (!list || !list.length || !list.every(isObj)) return null;
  if (list.every(b => "when" in b && "do" in b)) return { kind: "beats", items: list };
  if (list.every(c => ("en" in c || "ja" in c) && ("who" in c || "id" in c))) return { kind: "clips", items: list };
  if (list.every(a => ACTION[verbOfAction(a)])) return { kind: "commands", items: list };
  return null;
}
const fresh = (id, taken) => { const stem = String(id || "x").replace(/_\d+$/, ""); let n = 2; while (taken.has(`${stem}_${n}`)) n++; const v = `${stem}_${n}`; taken.add(v); return v; };
const asksIn = (list, out = []) => { for (const a of list || []) if (isObj(a)) { if (typeof a.ask === "string") out.push(a); for (const o of a.options || []) asksIn(o.do, out); } return out; };
function askIds(S) { const ids = new Set(); for (const st of Object.values(S.stitches || {})) for (const b of st.beats || []) for (const a of asksIn(b.do)) ids.add(a.ask); return ids; }
// a question's id is how "answered" finds it: one id per question in the game
function renameAsks(S, actions, taken = new Set([...allIds(S), ...askIds(S)])) {
  const map = {};
  for (const a of asksIn(actions)) if (taken.has(a.ask)) { const nu = fresh(a.ask, taken); map[a.ask] = nu; a.ask = nu; } else taken.add(a.ask);
  return map;
}
const remapTrigger = (w, beats, asks) => {
  if (!isObj(w)) return;
  if (typeof w.after === "string" && beats[w.after]) w.after = beats[w.after];
  if (typeof w.answered === "string" && asks[w.answered]) w.answered = asks[w.answered];
  for (const x of w.all || w.any || []) remapTrigger(x, beats, asks);
};

// commands: copies, their questions renamed if the game has them already
export function pasteCommands(S, items) { const out = clone(items); renameAsks(S, out); return out; }
// beats: new ids (unique in the file), "after" and "answered" between them kept
export function pasteBeats(S, items, taken = null) {
  const out = clone(items), ids = taken || new Set([...allIds(S), ...askIds(S)]), beats = {}, asks = {};
  for (const b of out) { const nu = fresh(b.id || "b", ids); beats[b.id] = nu; b.id = nu; }
  for (const b of out) Object.assign(asks, renameAsks(S, b.do || [], ids));
  for (const b of out) remapTrigger(b.when, beats, asks);
  return out;
}
// a scene's lines: new ids in that version (c<n>); the take was the old line's, so its length and trim go; Kimodo's
// segments take the new line's name and are made again
export function pasteClips(ver, items, { scene = null, fromScene = null } = {}) {
  const used = new Set((ver.clips || []).map(c => c.id)), out = clone(items), ids = {};
  for (const c of out) {
    let n = used.size + 1; while (used.has("c" + n)) n++; const old = c.id; c.id = "c" + n; used.add(c.id); ids[old] = c.id;
    delete c.dur; delete c.trim;
    renameSegments(c, fromScene, old, scene, c.id);
  }
  for (const c of out) for (const o of (c.reply && c.reply.options) || []) if (o.go && ids[o.go.clip]) o.go.clip = ids[o.go.clip];   // a skip among the pasted lines keeps pointing at its line
  return out;
}
function renameSegments(c, fromScene, fromClip, toScene, toClip) {
  for (const g of ((c.body || {}).segments || [])) {
    if (g.name && fromScene && toScene && fromClip) g.name = g.name.replace(`_${fromScene}_${fromClip}_`, `_${toScene}_${toClip}_`);
    delete g.file;
  }
  if (c.body) delete c.body.file;
}
// cards: each with its own copy of its scene or task; the links between them kept, the links out dropped; placed from
// `at` as they were placed among themselves
export function copyNodes(S, ids, pos = {}) {
  const items = ids.filter(id => S.flow[id]).map(id => {
    const n = S.flow[id], it = { id, node: n, xy: pos[id] ? [pos[id].x, pos[id].y] : n.xy || null };
    if (n.type === "scene" && S.scenes[n.ref]) it.scene = S.scenes[n.ref];
    if (n.type === "stitch" && S.stitches[n.ref]) it.stitch = S.stitches[n.ref];
    return it;
  });
  return pack("nodes", items);
}
export function pasteNodes(S, clip, at = [0, 0]) {
  const items = clone(clip.items), taken = new Set([...allIds(S), ...askIds(S)]), map = {};
  for (const it of items) map[it.id] = fresh(it.id, taken);
  const x0 = Math.min(...items.map(it => (it.xy || [0, 0])[0])), y0 = Math.min(...items.map(it => (it.xy || [0, 0])[1]));
  const link = to => (to && map[to]) || null, made = [];
  items.forEach((it, i) => {
    const n = it.node, nid = map[it.id];
    delete n.notes;
    if (it.scene) {
      const sid = fresh(n.ref, taken), sc = it.scene; delete sc.notes;
      for (const v of [sc, ...Object.values(sc.variants || {})]) for (const c of v.clips || []) { delete c.dur; delete c.trim; renameSegments(c, n.ref, c.id, sid, c.id);
        for (const o of (c.reply && c.reply.options) || []) if (o.go && o.go.node) o.go.node = link(o.go.node) || o.go.node; }   // an answer's card: the copy's, if it came too
      S.scenes[sid] = sc; n.ref = sid;
    }
    if (it.stitch) {
      const tid = fresh(n.ref, taken), st = it.stitch; delete st.notes;
      st.beats = pasteBeats(S, st.beats || [], taken);
      if (st.timer) st.timer.fail = link(st.timer.fail) || st.timer.fail;
      S.stitches[tid] = st; n.ref = tid;
    }
    if ("next" in n) n.next = link(n.next);
    if (n.of) n.of = link(n.of) || n.of;
    for (const o of n.options || []) o.to = link(o.to) || "";
    const [x, y] = it.xy || [i * 214, 0];
    n.xy = [Math.round(at[0] + x - x0), Math.round(at[1] + y - y0)];
    S.flow[nid] = n; made.push(nid);
  });
  return made;
}
