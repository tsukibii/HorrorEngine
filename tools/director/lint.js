// The desk's live checks: what's wrong with the story while it's being edited, before the story check runs. Each
// problem names its place (the flow node, the beat, the line, the Database entry), so the desk marks it there and the
// Problems list goes to it. Which fields a command needs and what they name come from the palette's own table
// (commands.js). No DOM: DESK (desktest.mjs) runs it on every game, where it must find no errors the check doesn't.
//   lint(S, {things, poses, secs}) -> [{sev: "error" | "warn", text, path, obj, at}]
//   things: the plan's placed things (id -> {kind, use, level}); poses: the pose names; secs(clip): a clip's length
import { ACTION, TRIGGER, verbOfAction, verbOfTrigger, fieldsOf } from "./commands.js";
import { placeOf } from "./refs.js";

const IS = {                                       // what a placed thing must be for a field of each kind
  thing: t => t.kind !== "room", spot: t => t.use === "spot", door: t => t.kind === "door", light: t => t.use === "light",
  room: t => t.kind === "room", zone: t => t.kind === "room" || t.use === "trigger", locker: t => t.use === "locker",
  carry: t => t.use === "carry", die: t => t.use === "roll", table: t => t.use === "game", life: t => !!t.life,
  stain: t => t.use === "clean", breaker: t => t.use === "breaker",
};
const NOUN = { thing: "placed thing", spot: "spot", door: "door", light: "light", room: "room", zone: "room or trigger", locker: "hiding place",
  carry: "thing you carry", die: "die", table: "game table", line: "line", sound: "sound", item: "item", note: "note", counter: "counter",
  axis: "karma axis", scene: "scene", cast: "cast member", motion: "motion", secret: "secret", route: "route", beat: "beat in this task",
  ask: "question", pose: "pose", life: "thing with a life", todo: "task on the to-do list", stain: "stain", breaker: "breaker box" };
const TABLE = { line: "lines", sound: "sounds", item: "items", note: "notes", scene: "scenes", cast: "cast", motion: "motions", secret: "secrets" };
const ANY = { anyone: "cast", anylocker: "locker", anycarry: "carry", anytodo: "todo" };   // true (any, all) or one of a kind
const BUILT_IN_POSES = new Set(["idle", "tpose"]);
const MUST = new Set([...Object.keys(NOUN), "flag", "routes", "lifestate"]);      // a field of these kinds can't be left empty (unless it's optional)
const SEAM_LOOKS = new Set(["glance", "cutaway"]);                   // seams that need something to look at
const an = w => (/^[aeiou]/.test(w) ? "an " : "a ") + w;
const isObj = x => x && typeof x === "object" && !Array.isArray(x);
const empty = v => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);

export function lint(S, { things = {}, poses = null, secs = null, lives = null } = {}) {
  const out = [], add = (sev, text, path, obj) => out.push({ sev, text, path, obj, at: placeOf(S, path) });
  const cast = S.cast || {}, flow = S.flow || {}, game = S.game || {};
  const routes = new Set(Object.values(S.levels || {}).flatMap(l => Object.keys(l.routes || {})));
  const asks = {};
  for (const st of Object.values(S.stitches || {})) for (const b of st.beats || []) walkActs(b.do, a => { if (a.ask) asks[a.ask] = a; });
  const todos = {}, ticks = new Set();
  for (const st of Object.values(S.stitches || {})) for (const b of st.beats || []) walkActs(b.do, a => { if (typeof a.todo === "string") todos[a.todo] = a; if (a.tick) ticks.add(a.tick); });
  const counters = game.counters || {}, axes = (game.karma || {}).axes || { karma: {} };
  const has = (kind, v, ctx) => {                  // does v name something of this kind?
    if (IS[kind]) { const t = things[v]; return t ? IS[kind](t) || kind === "thing" : kind === "thing" && !!cast[v]; }
    if (TABLE[kind]) return !!(S[TABLE[kind]] || {})[v];
    if (kind === "counter") return !!counters[v];
    if (kind === "axis") return !!axes[v];
    if (kind === "route") return routes.has(v);
    if (kind === "beat") return !!(ctx.beats || []).find(b => b.id === v);
    if (kind === "ask") return !!asks[v];
    if (kind === "todo") return !!todos[v];
    if (kind === "pose") return !poses || poses.includes(v) || BUILT_IN_POSES.has(v);
    return true;
  };
  // one command or trigger's fields: what's missing, and what names something that isn't there
  const fields = (d, x, path, ctx, what) => {
    for (const f of fieldsOf(d, x)) {
      const v = x[f.key], p = [...path, f.key];
      if (empty(v)) { if (!f.opt && (MUST.has(f.kind) || (f.kind === "choice" && (f.verb || f.key === "set")))) add("error", `${what}: choose the ${f.label.toLowerCase()}`, path, x); continue; }
      if (f.kind === "choice" && f.opts && !f.opts.includes(v)) add("error", `${what}: ${f.label.toLowerCase()} ${v} isn't one of ${f.opts.join(", ")}`, p, x);
      else if (f.kind === "karma") { for (const k of typeof v === "number" ? [] : Object.keys(v || {})) if (!axes[k]) add("error", `${what}: karma axis ${k} isn't in the game's karma axes`, p, x); if (typeof v === "number" && !axes.karma) add("error", `${what}: a plain number counts on the karma axis, which this game hasn't got`, p, x); }
      else if (ANY[f.kind]) { if (v !== true && !has(ANY[f.kind], v, ctx)) add("error", `${what}: ${v} isn't ${an(NOUN[ANY[f.kind]])}`, p, x); }
      else if (f.kind === "trigger") trigger(v, p, ctx);
      else if (f.kind === "facing") { if (v !== "player" && !cast[v] && !things[v]) add("error", `${what}: facing ${v}, which isn't the player, a cast member or a placed thing`, p, x); }
      else if (f.kind === "routes") { for (const r of v) if (!routes.has(r)) add("error", `${what}: route ${r} isn't a route on any level`, p, x); }
      else if (f.kind === "answer") { if (!(x.options || []).some(o => o.id === v)) add("error", `${what}: ${v} isn't one of its answers`, p, x); }
      else if (f.kind === "askanswer") { const a = asks[x.answered]; if (a && !(a.options || []).some(o => o.id === v)) add("error", `${what}: ${v} isn't one of ${x.answered}'s answers`, p, x); }
      else if (f.kind === "lifestate") { const t = things[x.state], L = t && t.life && lives && lives.lives ? lives.lives[t.life] : null, ids = L ? (L.states || []).map(s => s.id) : null; if (ids && !ids.includes(v)) add("error", `${what}: ${v} isn't one of ${x.state}'s states (${ids.join(", ")})`, p, x); }
      else if (NOUN[f.kind] && typeof v === "string" && !has(f.kind, v, ctx)) add("error", `${what}: ${v} isn't ${an(NOUN[f.kind])}`, p, x);
    }
  };
  const action = (a, path, ctx) => {
    if (!isObj(a)) return;
    const verb = verbOfAction(a), d = ACTION[verb];
    if (!d) { add("error", `an unknown command: ${verb}`, path, a); return; }
    fields(d, a, path, ctx, d.label);
    if (verb === "light" && empty(a.light) && empty(a.room)) add("error", "Light: choose a light or a room", path, a);
    if (verb === "todo") {
      if (typeof a.todo !== "string" || !/^[a-z0-9_]+$/.test(a.todo)) add("error", "To do: its id is a word (lower case, digits, _), for Tick, Fail and “a task is ticked”", path, a);
      if (!a.text) add("error", `To do ${a.todo}: what the list says is empty`, path, a);
      if (!a.ticks && !ticks.has(a.todo)) add("warn", `To do ${a.todo}: nothing ticks it: give it a “ticked when”, or Tick it in a beat`, path, a);
      for (const [r, l] of Object.entries(a.on || {})) actions(l, [...path, "on", r], ctx);
    }
    if (verb === "ask") {
      if ("line" in a && "text" in a && a.text) add("error", `Ask ${a.ask}: the question is a thought or a spoken line, not both`, path, a);
      else if (!("line" in a) && !("text" in a)) add("error", `Ask ${a.ask}: the question needs its words (a thought or a spoken line)`, path, a);
      else if (!a.line && !a.text) add("warn", `Ask ${a.ask}: the question has no words yet`, path, a);
      const os = a.options || [];
      if (os.length < 2 || os.length > 4) add("error", `Ask ${a.ask}: 2 to 4 answers`, path, a);
      os.forEach((o, i) => { if (!o.label) add("error", `Ask ${a.ask}: answer ${o.id || i + 1} needs its words`, [...path, "options", i], a); (o.do || []).forEach((x, j) => action(x, [...path, "options", i, "do", j], ctx)); });
    }
  };
  const trigger = (w, path, ctx) => {
    if (!isObj(w)) { add("error", "a beat with no trigger: choose when it happens", path, w); return; }
    const verb = verbOfTrigger(w), d = TRIGGER[verb];
    if (!d) { add("error", `an unknown trigger: ${verb}`, path, w); return; }
    if (d.nest) { (w[verb] || []).forEach((x, i) => trigger(x, [...path, verb, i], ctx)); return; }
    fields(d, w, path, ctx, "When " + d.label.toLowerCase().replace(/^the /, "the "));
  };
  const actions = (list, path, ctx) => (Array.isArray(list) ? list : list ? [list] : []).forEach((a, i) => action(a, Array.isArray(list) ? [...path, i] : path, ctx));
  const results = (on, path, ctx) => { for (const [r, l] of Object.entries(on || {})) actions(l, [...path, r], ctx); };

  // ---- tasks: their beats, what ends them, their rounds
  for (const [tid, st] of Object.entries(S.stitches || {})) {
    const ctx = { beats: st.beats || [] }, base = ["stitches", tid];
    let done = false;
    if (st.level && !(S.levels || {})[st.level]) add("error", `it's set in level ${st.level}, which doesn't exist`, base, st);
    (st.beats || []).forEach((b, i) => {
      const p = [...base, "beats", i];
      trigger(b.when, [...p, "when"], ctx);
      actions(b.do, [...p, "do"], ctx);
      if ((b.do || []).some(a => isObj(a) && a.done)) done = true;
      if (b.secret && !(S.secrets || {})[b.secret]) add("error", `beat ${b.id}: secret ${b.secret} isn't in the Database's secrets`, p, b);
    });
    if (st.play) {
      const pl = st.play, pp = [...base, "play"];
      results(pl.on, [...pp, "on"], ctx);
      if (pl.seeker && !cast[pl.seeker]) add("error", `its round's seeker ${pl.seeker} isn't in the cast`, pp, st);
      for (const [role, m] of Object.entries(pl.loops || {})) if (!(S.motions || {})[m]) add("error", `its round's ${role} loop ${m} isn't a motion`, [...pp, "loops", role], st);
      for (const [role, ls] of Object.entries(pl.barks || {})) for (const l of ls || []) if (!(S.lines || {})[l]) add("error", `its round's ${role} bark ${l} isn't a line`, [...pp, "barks", role], st);
      for (const sp of pl.spots || []) if (!things[sp]) add("error", `its round's spot ${sp} isn't placed`, [...pp, "spots"], st);
    } else if (!done) add("error", "nothing ends this task: add “End the task” to a beat", base, st);
    if (st.timer && !flow[st.timer.fail]) add("error", `its timer's failure goes to ${st.timer.fail || "nothing"}: choose a node`, [...base, "timer"], st);
  }

  // ---- scenes: their lines, cues, results and replies
  const max = game.clip_max || ((S.format || 2) >= 3 ? 8 : 10);
  for (const [sid, sc] of Object.entries(S.scenes || {})) {
    const versions = sc.variants ? Object.entries(sc.variants).map(([k, v]) => [["scenes", sid, "variants", k], Object.assign({}, sc, v), v]) : [[["scenes", sid], sc, sc]];
    const ctx = { beats: [] };
    actions(sc.sets, ["scenes", sid, "sets"], ctx);
    if (sc.level && !(S.levels || {})[sc.level]) add("error", `it's set in level ${sc.level}, which doesn't exist`, ["scenes", sid], sc);
    if (sc.view && !things[sc.view]) add("error", `the player stands at ${sc.view}, which isn't placed`, ["scenes", sid], sc);
    for (const v of [sc, ...Object.values(sc.variants || {})]) for (const [cid, at] of Object.entries(v.stage || {})) {
      if (!cast[cid]) add("error", `its stage names ${cid}, who isn't in the cast`, ["scenes", sid, "stage"], sc);
      if (typeof at === "string" && !things[at]) add("error", `${cid} stands at ${at}, which isn't placed`, ["scenes", sid, "stage"], sc);
    }
    if (isObj(sc.look)) for (const cid of Object.keys(sc.look)) if (!cast[cid]) add("error", `its look names ${cid}, who isn't in the cast`, ["scenes", sid, "look"], sc);
    for (const [base, v, own] of versions) {
      const cb = own.cues ? base : ["scenes", sid], lb = own.clips ? base : ["scenes", sid];
      (v.cues || []).forEach((cu, i) => actions(cu.do, [...cb, "cues", i, "do"], ctx));
      (v.clips || []).forEach((c, i) => {
        const p = [...lb, "clips", i], who = c.who;
        if (who !== "player" && !cast[who]) add("error", `line ${c.id}: ${who ? who + " isn't in the cast" : "choose who says it"}`, p, c);
        if (!c.en) add("error", `line ${c.id}: no English subtitle`, p, c);
        if (i && !c.seam) add("error", `line ${c.id}: a cut with no seam to hide it (blink, glance, flicker…)`, p, c);
        else if (i && SEAM_LOOKS.has(c.seam.kind) && !c.seam.look) add("error", `line ${c.id}: its ${c.seam.kind} seam needs something to look at`, p, c);
        if (secs) { const t = secs(c); if (t > max + 0.01) add(c.dur ? "error" : "warn", `line ${c.id}: ${t.toFixed(1)} s${c.dur ? "" : " at speaking pace"}, over the ${max} s a take can be: split it`, p, c); }
        for (const e of ["start", "end"]) { const m = (c.body || {})[e]; if (m && !(S.motions || {})[m] && !BUILT_IN_POSES.has(m)) add("warn", `line ${c.id}: its body ${e}s from ${m}, which isn't a motion`, [...p, "body"], c); }
        if (c.event) results(c.event.on, [...p, "event", "on"], ctx);
        ((c.reply || {}).options || []).forEach((o, j) => {
          const op = [...p, "reply", "options", j], g = o.go === undefined ? "next" : o.go, ans = `line ${c.id}: answer ${o.label || o.id}`;
          actions(o.sets, [...op, "sets"], ctx);
          for (const th of Array.isArray(o.then) ? o.then : o.then ? [o.then] : []) if (isObj(th) && th.who && th.who !== "player" && !cast[th.who]) add("error", `${ans}: ${th.who} answers, who isn't in the cast`, op, c);
          if (!(g === "next" || g === "end" || isObj(g) && Object.keys(g).length === 1 && ("clip" in g || "node" in g))) add("error", `${ans}: where it goes is next, end, a later line or a card`, op, c);
          else if (isObj(g) && "clip" in g && !(v.clips || []).slice(i + 1).some(x => x.id === g.clip)) add("error", `${ans}: it skips to ${g.clip}, which isn't a later line`, op, c);
          else if (isObj(g) && "node" in g && !flow[g.node]) add("error", `${ans}: it goes to ${g.node}, which isn't on the board`, op, c);
        });
      });
    }
  }

  // ---- the flow: where each node goes, what nothing reaches
  if (!flow[game.start]) add("error", `the game starts at ${game.start || "nothing"}: make a node the start`, ["game"], game);
  for (const [nid, n] of Object.entries(flow)) {
    const p = ["flow", nid];
    if (n.type === "scene" && !(S.scenes || {})[n.ref]) add("error", `it plays scene ${n.ref}, which doesn't exist`, p, n);
    if (n.type === "stitch" && !(S.stitches || {})[n.ref]) add("error", `it runs task ${n.ref}, which doesn't exist`, p, n);
    if (n.next && !flow[n.next]) add("error", `it goes on to ${n.next}, which doesn't exist`, p, n);
    if (n.type === "choice") {
      if (!(n.options || []).length) add("error", "a choice with no options", p, n);
      (n.options || []).forEach((o, i) => {
        if (!o.to) add("error", `option ${o.label || i + 1} goes nowhere: choose where`, [...p, "options", i], n);
        else if (!flow[o.to]) add("error", `option ${o.label || i + 1} goes to ${o.to}, which doesn't exist`, [...p, "options", i], n);
        if (n.by === "act" && o.when) trigger(o.when, [...p, "options", i, "when"], { beats: [] });
        if (n.by === "count" && o.count && !counters[o.count]) add("error", `option ${i + 1} counts ${o.count}, which isn't a counter`, [...p, "options", i], n);
      });
    } else if (n.type !== "ending" && !n.next) add("error", "it goes nowhere: connect it to the next node", p, n);
  }
  const seen = new Set(), todo = [game.start];
  const jumps = sc => [sc || {}, ...Object.values((sc && sc.variants) || {})].flatMap(v => (v.clips || []).flatMap(c => ((c.reply || {}).options || []).map(o => isObj(o.go) ? o.go.node : null)));   // answers that leave for a card (§9.9)
  const outs = n => [n.next, ...(n.options || []).map(o => o.to), n.type === "stitch" && ((S.stitches || {})[n.ref] || {}).timer ? S.stitches[n.ref].timer.fail : null, ...(n.type === "scene" ? jumps((S.scenes || {})[n.ref]) : [])];
  while (todo.length) { const id = todo.pop(); if (!id || seen.has(id) || !flow[id]) continue; seen.add(id); todo.push(...outs(flow[id])); }
  for (const it of S.interrupts || []) if (it.to && seen.size) { const st = [it.to]; while (st.length) { const id = st.pop(); if (!id || seen.has(id) || !flow[id]) continue; seen.add(id); st.push(...outs(flow[id])); } }
  for (const [nid, n] of Object.entries(flow)) if (!seen.has(nid) && flow[game.start]) add(n.type === "ending" ? "error" : "warn", n.type === "ending" ? "no path reaches this ending" : "nothing leads here", ["flow", nid], n);

  // ---- the board's acts
  const inAct = {};
  (S.frames || []).forEach((f, i) => { for (const nid of (f && f.nodes) || []) { if (!flow[nid]) add("error", `act “${f.title || f.id}”: ${nid} isn't on the board`, ["frames", i], f); else if (inAct[nid]) add("error", `${nid} is in two acts`, ["frames", i], f); inAct[nid] = true; } });

  // ---- trigger cutscenes
  (S.interrupts || []).forEach((it, i) => {
    const p = ["interrupts", i];
    trigger(it.when, [...p, "when"], { beats: [] });
    if (!flow[it.to]) add("error", `trigger cutscene ${it.label || it.id}: it jumps to ${it.to || "nothing"}: choose a node`, p, it);
    if (Array.isArray(it.during)) for (const t of it.during) if (!(S.stitches || {})[t]) add("error", `trigger cutscene ${it.label || it.id}: during ${t}, which isn't a task`, p, it);
  });

  // ---- what the levels name: a pickup's item, a note's note, a door's key, an inspected thing's line
  const lvl = (x, path) => {
    if (Array.isArray(x)) return x.forEach((v, i) => lvl(v, [...path, i]));
    if (!isObj(x)) return;
    const id = x.id || "a thing", items = S.items || {};
    if (x.use === "pickup" && !items[x.item]) add("error", `${id}: picks up ${x.item || "nothing"}, which isn't an item`, path, x);
    if (x.use === "note" && !(S.notes || {})[x.note]) add("error", `${id}: reads ${x.note || "nothing"}, which isn't a note`, path, x);
    if (x.use === "use_on" && !items[x.needs]) add("error", `${id}: needs ${x.needs || "nothing"}, which isn't an item`, path, x);
    if (x.use === "inspect" && x.line && !(S.lines || {})[x.line]) add("error", `${id}: its line ${x.line} isn't a line`, path, x);
    if (x.use === "game" && x.vs && !cast[x.vs]) add("error", `${id}: plays against ${x.vs}, who isn't in the cast`, path, x);
    if (typeof x.locked_by === "string" && !x.locked_by.startsWith("flag:") && !items[x.locked_by]) add("error", `${id}: locked by ${x.locked_by}, which isn't an item (or flag:<name>)`, path, x);
    for (const [k, v] of Object.entries(x)) if (v && typeof v === "object") lvl(v, [...path, k]);
  };
  for (const [lid, l] of Object.entries(S.levels || {})) lvl(l, ["levels", lid]);

  // ---- the Database's own entries
  for (const [lid, ln] of Object.entries(S.lines || {})) {
    if (ln.who !== "player" && !cast[ln.who]) add("error", `line ${lid}: ${ln.who ? ln.who + " isn't in the cast" : "choose who says it"}`, ["lines", lid], ln);
    if (!ln.en) add("error", `line ${lid}: no English subtitle`, ["lines", lid], ln);
  }
  for (const [mid, m] of Object.entries(S.motions || {})) {
    if (!m.prompt) add("error", `motion ${mid}: no prompt for Kimodo`, ["motions", mid], m);
    if (m.who && !cast[m.who]) add("error", `motion ${mid}: ${m.who} isn't in the cast`, ["motions", mid], m);
  }

  // ---- flags waited for that nothing sets
  const set = new Set(), read = [];
  const scan = (x, path) => {
    if (Array.isArray(x)) return x.forEach((v, i) => scan(v, [...path, i]));
    if (!isObj(x)) return;
    for (const [k, v] of Object.entries(x)) {
      if ((k === "flag" || k === "then") && typeof v === "string") { if (path.includes("when") || path.includes("secrets")) read.push([v, path, x]); else set.add(v); }
      if (k === "if" && Array.isArray(v)) v.forEach(f => typeof f === "string" && read.push([f.replace(/^!/, ""), path, x]));
      if (k === "locked_by" && typeof v === "string" && v.startsWith("flag:")) read.push([v.slice(5), path, x]);
      if (v && typeof v === "object") scan(v, [...path, k]);
    }
  };
  scan(S, []);
  const warned = new Set();
  for (const [f, path, x] of read) if (f && !set.has(f) && !warned.has(f + path.join("/"))) { warned.add(f + path.join("/")); add("warn", `flag ${f} is waited for, but nothing sets it`, path, x); }
  return out;
}
function walkActs(list, fn) { for (const a of list || []) { if (!isObj(a)) continue; fn(a); for (const o of a.options || []) walkActs(o.do, fn); if (a.todo !== undefined && isObj(a.on)) for (const l of Object.values(a.on)) walkActs(l, fn); } }

// the problems of one place: a flow node, a beat (by its object), a clip (by its object)
export function byNode(problems) { const m = {}; for (const p of problems) { const n = p.at && p.at.node; if (n) (m[n] = m[n] || []).push(p); } return m; }
export function byObject(problems) {           // every object a problem sits on or inside, for the editors' marks
  const m = new Map();
  for (const p of problems) if (p.obj && typeof p.obj === "object") { const l = m.get(p.obj) || []; l.push(p); m.set(p.obj, l); }
  return m;
}
