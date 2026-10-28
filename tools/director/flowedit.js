// Cutting the flow and putting it back together on the board (HANDOFF_DIRECTOR_TODO §2): every arrow out of a card
// with its place in the story (`at`), so the board can cut one (a stub stays on its card, the cards after it a loose
// chain until it's attached again), point it at another card, put a new card on it, swap two cards' places in the
// flow, or move a run of cards onto another arrow. Plain functions on the story: app.js draws and asks, DESK tests them.
const isObj = x => x && typeof x === "object" && !Array.isArray(x);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LINEAR = new Set(["scene", "stitch"]);       // a card with one way on (its `next`)

// every answer of every reply in every scene and its versions: fn(option, scene id, version key | null, clip index, option index)
export function forAnswers(S, fn) {
  for (const [sid, sc] of Object.entries(S.scenes || {})) for (const [vk, v] of [[null, sc], ...Object.entries(sc.variants || {})])
    (v.clips || []).forEach((c, ci) => ((c.reply && c.reply.options) || []).forEach((o, oi) => fn(o, sid, vk, ci, oi)));
}
// the arrows out of a card: {to (null where it's cut), at, kind?}. at: ["next"], ["option", i], ["timer"],
// ["interrupt", i] or ["answer", version key (null: the scene's own clips), clip index, option index]
export function arrows(S, id) {
  const n = (S.flow || {})[id]; if (!n) return [];
  const out = [];
  if (n.type === "choice") (n.options || []).forEach((o, i) => out.push({ to: o.to || null, at: ["option", i] }));
  else if (n.type !== "ending") out.push({ to: n.next || null, at: ["next"] });
  if (n.type === "stitch") {
    const st = (S.stitches || {})[n.ref] || {};
    if (st.timer && st.timer.fail) out.push({ to: st.timer.fail, at: ["timer"], kind: "timer" });
    (S.interrupts || []).forEach((it, i) => { if (it.to && (it.during === "all" || (it.during || []).includes(n.ref))) out.push({ to: it.to, at: ["interrupt", i], kind: "interrupt" }); });
  }
  const sc = n.type === "scene" && (S.scenes || {})[n.ref];
  if (sc) for (const [vk, v] of [[null, sc], ...Object.entries(sc.variants || {})]) (v.clips || []).forEach((c, ci) => ((c.reply && c.reply.options) || []).forEach((o, oi) => {
    if (isObj(o.go) && o.go.node) out.push({ to: o.go.node, at: ["answer", vk, ci, oi], kind: "answer", option: o });
  }));
  return out;
}
export const arrowAt = (S, from, at) => arrows(S, from).find(a => same(a.at, at)) || null;
// an arrow that can be cut: a card's way on, a choice's way, an answer's jump (a timer's or a trigger cutscene's only moves)
export const canCut = at => ["next", "option", "answer"].includes(at[0]);
// the arrow at `at` out of `from` pointed at `to`; null cuts it: a card's next goes empty (its stub), a choice's way
// goes nowhere, an answer's jump goes back to the next line
export function setArrow(S, from, at, to) {
  const n = (S.flow || {})[from]; if (!n || (!to && !canCut(at))) return false;
  const [k, a, b, c] = at;
  if (k === "next") { n.next = to || null; return true; }
  if (k === "option") { const o = (n.options || [])[a]; if (!o) return false; o.to = to || ""; return true; }
  if (k === "timer") { const st = (S.stitches || {})[n.ref]; if (!st || !st.timer) return false; st.timer.fail = to; return true; }
  if (k === "interrupt") { const it = (S.interrupts || [])[a]; if (!it) return false; it.to = to; return true; }
  if (k === "answer") {
    const sc = (S.scenes || {})[n.ref], v = sc && (a === null ? sc : (sc.variants || {})[a]), o = v && (((v.clips || [])[b] || {}).reply || { options: [] }).options[c];
    if (!o) return false; if (to) o.go = { node: to }; else delete o.go; return true;
  }
  return false;
}
// a new card put on an arrow: the arrow goes to it, and it goes on where the arrow went (a choice: each of its ways)
export function insertOn(S, from, at, nid, node) {
  const a = arrowAt(S, from, at); if (!a || S.flow[nid]) return false;
  if (node.type === "choice") for (const o of node.options || []) o.to = o.to || a.to || "";
  else if (node.type !== "ending") node.next = a.to || null;
  S.flow[nid] = node;
  return setArrow(S, from, at, nid);
}
// every arrow into the flow's cards, rewritten by f (a card's next, a choice's ways, a timer's, a trigger cutscene's,
// an answer's jump, the start); a choice's `of` stays on the card whose result it reads
function mapInto(S, f) {
  for (const n of Object.values(S.flow || {})) { if (n.next) n.next = f(n.next); for (const o of n.options || []) if (o.to) o.to = f(o.to) || ""; }
  for (const st of Object.values(S.stitches || {})) if (st.timer && st.timer.fail) st.timer.fail = f(st.timer.fail);
  for (const it of S.interrupts || []) if (it.to) it.to = f(it.to);
  forAnswers(S, o => { if (isObj(o.go) && o.go.node) { const t = f(o.go.node); if (t) o.go.node = t; else delete o.go; } });
  if (S.game && S.game.start) S.game.start = f(S.game.start) || S.game.start;
}
// two cards (scenes or tasks) trade places in the flow: what led to each leads to the other, each goes on where the
// other went, and each takes the other's place on the board and in the acts
export function swapNodes(S, a, b) {
  const A = (S.flow || {})[a], B = (S.flow || {})[b];
  if (!A || !B || a === b || !LINEAR.has(A.type) || !LINEAR.has(B.type)) return false;
  mapInto(S, x => (x === a ? b : x === b ? a : x));
  [A.next, B.next] = [B.next, A.next];
  const xa = A.xy, xb = B.xy; if (xb) A.xy = xb; else delete A.xy; if (xa) B.xy = xa; else delete B.xy;
  for (const f of S.frames || []) f.nodes = (f.nodes || []).map(x => (x === a ? b : x === b ? a : x));   // and each other's acts
  return true;
}
// the cards picked as a run (scenes and tasks one after another by `next`), in order; null when they aren't one
export function runOf(S, ids) {
  const flow = S.flow || {}, set = new Set(ids);
  if (!ids.length || ids.some(id => !flow[id] || !LINEAR.has(flow[id].type))) return null;
  const heads = ids.filter(id => !ids.some(o => o !== id && flow[o].next === id));
  if (heads.length !== 1) return null;
  const run = []; for (let cur = heads[0]; cur && set.has(cur) && !run.includes(cur); cur = flow[cur].next) run.push(cur);
  return run.length === set.size ? run : null;
}
// a run of cards taken out of the flow (what led into it goes on to what came after it) and put on another arrow
// (the arrow goes to its first card, its last goes on where the arrow went)
export function moveRun(S, ids, from, at) {
  const run = runOf(S, ids), flow = S.flow || {};
  if (!run || run.includes(from) || !arrowAt(S, from, at)) return false;
  const head = run[0], tail = run[run.length - 1], after = flow[tail].next || null;
  if (S.game && S.game.start === head && !after) return false;     // the start can't go with nothing after it
  if (arrowAt(S, from, at).to === head) return false;            // already there
  mapInto(S, x => (x === head ? after : x));
  const to = arrowAt(S, from, at).to;
  flow[tail].next = to || null;
  return setArrow(S, from, at, head);
}
// where the flow is cut: a scene's or task's next empty, a choice's way going nowhere
export function cutsOf(S) {
  const out = [];
  for (const id of Object.keys(S.flow || {})) for (const a of arrows(S, id)) if (!a.to && (a.at[0] === "next" || a.at[0] === "option")) out.push({ id, at: a.at });
  return out;
}
