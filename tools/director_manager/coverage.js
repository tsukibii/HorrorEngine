// The Director Manager's checks and Coverage (docs/GODOT_DIRECTOR_PLAN.md §4, DECISIONS 2026-11-01: "a helper tool to
// see what ids/things haven't been assigned anything in game, so we can figure out what we're missing"): what the
// scene has that the story never names, what the story names that the scene hasn't got, each fact a condition reads
// and where it can come from, and what's wrong. No DOM: the page (manager.js) and the check (check.mjs) share it.
//   S: the Director file (director/director.json)   P: the project ({ids: {kind: [ids]}, sounds: [...], lives: {...}})

// a trigger's words and the kind of id each names (STORY_FORMAT §4)
const TRIG = { enter: "area", exit: "area", use: "thing", pickup: "item", read: "note", look: "thing", peeping: "door", locked: "door",
  state: "life", dropped: "thing", carrying: "thing", rolled: "thing", played: "thing", arrived: "actor", caught: "actor", hidden: "thing" };
// an action's words and the kind of id each names
const ACT = { show: "thing", hide: "thing", move: "thing", behave: "actor", anim: "actor", door: "door", light: "light", state: "thing",
  give: "item", take: "item", lookat: "thing", sound: "sound" };
const TRICK = { figure: "thing", at: "thing", door: "door", room: "room", hide: "thing", show: "thing" };
// the facts the brain writes by itself (run/brain.gd): their prefix and what the id after it is
export const AUTO = { "used:": "thing", "picked:": "item", "read:": "note", "entered:": "area", "left:": "area", "talked:": "talk",
  "heard:": "talk", "answered:": "answer", "gave:": "gave", "step:": "step", "failed:": "step", "done:": "quest", "ending:": "ending",
  "achievement:": "achievement", "caught:": "actor", "rolled:": "thing", "played:": "thing", "dropped:": "thing", "@": "quest" };
const isObj = x => x && typeof x === "object" && !Array.isArray(x);
const arr = x => (Array.isArray(x) ? x : []);

// every condition the story asks, with where; every fact each reads
export function condsOf(S) {
  const out = [];
  const add = (c, where) => { if (c !== undefined && c !== null && c !== "" && !(Array.isArray(c) && !c.length) && !(isObj(c) && !Object.keys(c).length)) out.push([c, where]); };
  const trig = (w, where) => { if (!isObj(w)) return; if (w.holds !== undefined) add(w.holds, where); for (const k of ["all", "any"]) arr(w[k]).forEach(x => trig(x, where)); };
  arr(S.quests).forEach(q => {
    arr(q.steps).forEach(s => { trig(s.done, `quest ${q.id}, step ${s.id}`); trig(s.fail, `quest ${q.id}, step ${s.id}`); });
    arr(q.next).forEach(n => add(n.if, `quest ${q.id}'s next`));
  });
  arr(S.moments).forEach(m => { trig(m.when, `moment ${m.id}`); add(m.if, `moment ${m.id}`); });
  arr(S.states).forEach((st, i) => add(st.while, `state ${i + 1}`));
  for (const [who, list] of Object.entries(S.talk || {})) arr(list).forEach(t => {
    add(t.if, `${who}'s conversation ${t.id}`);
    arr(t.lines).forEach((ln, j) => { add(ln.if, `${who}'s ${t.id}, line ${j + 1}`); arr(ln.answers).forEach(a => add(a.if, `${who}'s ${t.id}, answer ${a.label || a.id}`)); });
  });
  arr(S.achievements).forEach(a => add(a.when, `achievement ${a.id}`));
  return out;
}

export function factsRead(c, out = new Set()) {
  if (typeof c === "string") { if (c) out.add(c.replace(/^!/, "")); return out; }
  if (Array.isArray(c)) { c.forEach(x => factsRead(x, out)); return out; }
  if (!isObj(c)) return out;
  for (const k of ["all", "any"]) if (c[k] !== undefined) factsRead(c[k], out);
  if (c.not !== undefined) factsRead(c.not, out);
  if (c.fact) out.add(String(c.fact));
  if (c.done) out.add("done:" + c.done);
  if (c.step) out.add("step:" + c.step);
  if (c.ending) out.add("ending:" + c.ending);
  return out;
}

// every id the story names: [id, kind, where]
export function refsOf(S) {
  const out = [];
  const ref = (v, kind, where) => { if (typeof v === "string" && v && v !== "*" && v !== "player") out.push([v, kind, where]); };
  const trig = (w, where) => {
    if (!isObj(w)) return;
    for (const k of ["all", "any"]) arr(w[k]).forEach(x => trig(x, where));
    for (const [k, kind] of Object.entries(TRIG)) if (k in w && w[k] !== true) ref(w[k], kind, where);
    if ("gave" in w) { ref(w.gave, "item", where); ref(w.to, "actor", where); ref(w.except, "item", where); }
    if (w.arrived !== undefined && w.at) ref(w.at, "spot", where);
    if (w.dropped !== undefined && w.in) ref(w.in, "area", where);
  };
  const acts = (list, where) => arr(list).forEach(a => {
    if (!isObj(a)) return;
    for (const [k, kind] of Object.entries(ACT)) if (k in a && a[k] !== null && a[k] !== true) ref(a[k], kind, where);
    if (a.say !== undefined) ref(a.who, "actor", where);
    if (a.behave !== undefined) { ref(a.at, "spot", where); ref(a.to, "spot", where); ref(a.route, "path", where); arr(a.routes).forEach(r => ref(r, "path", where)); }
    if (a.move !== undefined) { ref(a.to, "spot", where); }
    if (a.light === null) ref(a.room, "room", where);
    if (a.trick) for (const [k, kind] of Object.entries(TRICK)) ref(a[k], kind, where);
    if (a.anim !== undefined) ref(a.clip, "motion", where);
  });
  arr(S.quests).forEach(q => {
    const w = `quest ${q.id}`;
    ref(q.map, "level", w); ref(q.start_at, "spot", w);
    arr(q.steps).forEach(s => { trig(s.done, `${w}, step ${s.id}`); trig(s.fail, `${w}, step ${s.id}`); ref(s.who, "actor", `${w}, step ${s.id}`); if (s.wrong) ref(s.wrong.who, "actor", `${w}, step ${s.id}`); });
    acts(q.on_start, w); acts(q.on_done, w);
  });
  arr(S.moments).forEach(m => { trig(m.when, `moment ${m.id}`); acts(m.do, `moment ${m.id}`); });
  arr(S.states).forEach((st, i) => {
    const w = `state ${i + 1}`;
    for (const [t, set] of Object.entries(st.set || {})) {
      ref(t, "target", w);
      if (!isObj(set)) continue;
      ref(set.at, "spot", w); ref(set.to, "spot", w); ref(set.path, "path", w); arr(set.paths).forEach(p => ref(p, "path", w)); ref(set.motion, "motion", w);
    }
  });
  for (const [who, list] of Object.entries(S.talk || {})) {
    ref(who, "actor", `${who}'s conversations`);
    arr(list).forEach(t => arr(t.lines).forEach(ln => { if (ln.who) ref(ln.who, "actor", `${who}'s ${t.id}`); acts(ln.do, `${who}'s ${t.id}`); }));
  }
  return out;
}

const KIND_IDS = {                                   // where the scene keeps the ids of each kind (the plugin's index)
  area: ["area"], thing: ["thing"], item: ["item"], note: ["note"], door: ["door"], actor: ["actor"], spot: ["spot"], light: ["light"],
  room: ["room"], path: ["path"], motion: ["motion"], level: ["level"], life: ["life"], target: ["actor", "thing", "door", "light", "life"],
};

export function coverage(S, P) {
  const ids = (P && P.ids) || {}, has = (kind, v) => (kind === "sound" ? (P.sounds || []).includes(v) : (KIND_IDS[kind] || [kind]).some(k => (ids[k] || []).includes(v)));
  const problems = [], prob = (sev, text, where = "") => problems.push({ sev, text, where });
  const refs = refsOf(S);
  // the story's own ids
  const quests = arr(S.quests), endings = arr(S.endings), qids = new Set(), eids = new Set(), sids = new Map(), talkIds = new Set(), answers = new Set();
  quests.forEach((q, i) => {
    if (!q.id) prob("error", `quest ${i + 1} has no id`);
    else if (qids.has(q.id)) prob("error", `two quests are called ${q.id}`, `quest ${q.id}`);
    qids.add(q.id);
    arr(q.steps).forEach(s => { if (!s.id) prob("error", `a step of quest ${q.id} has no id`, `quest ${q.id}`); else if (sids.has(s.id)) prob("error", `step ${s.id} is in two quests`, `quest ${q.id}`); sids.set(s.id, q.id); });
    if ((q.finish || "steps") !== "never" && !arr(q.steps).length) prob("error", `quest ${q.id} finishes when its steps are done but has none`, `quest ${q.id}`);
    if (q.time_limit && !q.on_timeout) prob("warn", `quest ${q.id}'s time runs out into nothing: set what happens then`, `quest ${q.id}`);
  });
  endings.forEach(e => { if (!e.id) prob("error", "an ending with no id"); else if (eids.has(e.id) || qids.has(e.id)) prob("error", `${e.id} names two things`, `ending ${e.id}`); eids.add(e.id); });
  for (const [who, list] of Object.entries(S.talk || {})) arr(list).forEach(t => {
    talkIds.add(t.id);
    if (!arr(t.lines).length) prob("error", `${who}'s conversation ${t.id} has no lines`, `${who}`);
    arr(t.lines).forEach(ln => { arr(ln.answers).forEach(a => answers.add(`answered:${t.id}:${a.id}`)); if (arr(ln.answers).length > 2) prob("warn", `${who}'s ${t.id}: more than two answers on a line (the game shows two)`, who); });
  });
  arr(S.moments).forEach(m => { if (!m.when) prob("error", `moment ${m.id} has no when`, `moment ${m.id}`); if (!arr(m.do).length) prob("warn", `moment ${m.id} does nothing yet`, `moment ${m.id}`); });
  arr(S.states).forEach((st, i) => { if (!isObj(st.set) || !Object.keys(st.set).length) prob("error", `state ${i + 1} sets nothing`, `state ${i + 1}`); });
  // where the flow goes
  const go = new Set();
  quests.forEach(q => arr(q.next).forEach(n => { if (!n.go) prob("error", `quest ${q.id}: a next with nowhere to go`, `quest ${q.id}`); else if (!qids.has(n.go) && !eids.has(n.go)) prob("error", `quest ${q.id} goes to ${n.go}, which is neither a quest nor an ending`, `quest ${q.id}`); else go.add(n.go); }));
  for (const list of Object.values(S.talk || {})) arr(list).forEach(t => arr(t.lines).forEach(ln => arr(ln.answers).forEach(a => { if (a.go) go.add(a.go); })));
  quests.forEach(q => { if (q.on_timeout) go.add(q.on_timeout); });
  // reachable: the first quest, each one's nexts, else the one after it, else the first ending
  const seen = new Set(), todo = quests.length ? [quests[0].id] : [];
  while (todo.length) {
    const id = todo.pop(); if (seen.has(id)) continue; seen.add(id);
    const i = quests.findIndex(q => q.id === id); if (i < 0) continue;
    const q = quests[i], nx = arr(q.next);
    nx.forEach(n => n.go && todo.push(n.go));
    if (!nx.some(n => !n.if || (typeof n.if === "object" && !Object.keys(n.if).length))) todo.push(i + 1 < quests.length ? quests[i + 1].id : (endings[0] || {}).id);
    if (q.on_timeout) todo.push(q.on_timeout);
  }
  for (const g of go) if (qids.has(g) || eids.has(g)) seen.add(g);
  quests.forEach(q => { if (q.id && !seen.has(q.id)) prob("warn", `quest ${q.id} can't be reached: nothing leads there`, `quest ${q.id}`); });
  endings.forEach(e => { if (e.id && !seen.has(e.id)) prob("warn", `ending ${e.id} can't be reached: point a quest's next or an answer's go at it`, `ending ${e.id}`); });
  if (quests.length && !endings.length) prob("warn", "no endings yet: the last quest has nowhere to end");
  // the scene against the story
  const missing = [], named = new Set();
  for (const [v, kind, where] of refs) {
    named.add(v);
    if (kind === "scene") continue;
    if (!has(kind, v)) missing.push({ id: v, kind, where });
  }
  const dedup = new Map(); for (const m of missing) if (!dedup.has(m.id + m.kind)) dedup.set(m.id + m.kind, m);
  for (const m of dedup.values()) prob("warn", `${m.where} names ${m.kind === "target" ? "" : m.kind + " "}${m.id}, which isn't in the scene`, m.where);
  const unused = {};
  const doors = new Set(ids.door || []), people = new Set(ids.actor || []), rooms = new Set(ids.room || []);
  const kinds = { actor: ids.actor, thing: (ids.thing || []).filter(t => !doors.has(t) && !people.has(t)), door: ids.door, area: (ids.area || []).filter(a => !rooms.has(a)),
    room: ids.room, item: ids.item, note: ids.note, spot: (ids.spot || []).filter(s => s !== "start"), path: ids.path, light: ids.light, life: ids.life };
  const factsNamed = new Set(); condsOf(S).forEach(([c]) => factsRead(c, factsNamed));
  const viaFact = v => [...factsNamed].some(f => { for (const p of Object.keys(AUTO)) if (f.startsWith(p) && f.slice(p.length).split(":").includes(v)) return true; return false; });
  for (const [k, list] of Object.entries(kinds)) unused[k] = (list || []).filter(v => !named.has(v) && !viaFact(v)).sort();
  // the facts: what each condition reads, where each can come from
  const setBy = new Map(), sets = (f, how) => { if (!setBy.has(f)) setBy.set(f, []); setBy.get(f).push(how); };
  const flagActs = (list, where) => arr(list).forEach(a => { if (isObj(a) && typeof a.flag === "string") sets(a.flag, where); });
  quests.forEach(q => { flagActs(q.on_start, `quest ${q.id}`); flagActs(q.on_done, `quest ${q.id}`); });
  arr(S.moments).forEach(m => flagActs(m.do, `moment ${m.id}`));
  for (const [who, list] of Object.entries(S.talk || {})) arr(list).forEach(t => arr(t.lines).forEach(ln => { flagActs(ln.do, `${who}'s ${t.id}`); arr(ln.answers).forEach(a => arr(a.sets).forEach(f => sets(f, `${who}'s ${t.id}, answer ${a.label || a.id}`))); }));
  (ids.flag || []).forEach(f => sets(f, "a code lock or an item used (the scene)"));
  const auto = f => {                                 // a fact the brain writes as the player plays, if what it's about exists
    if (answers.has(f)) return "the conversation's answer";
    for (const [p, kind] of Object.entries(AUTO)) {
      if (!f.startsWith(p)) continue;
      const v = f.slice(p.length);
      if (kind === "talk") return talkIds.has(v) || people.has(v) ? "the game, as the player plays" : null;
      if (kind === "step") return sids.has(v) ? "the game, as the player plays" : null;
      if (kind === "quest") return qids.has(v) ? "the game, as the player plays" : null;
      if (kind === "ending") return eids.has(v) ? "the game, as the player plays" : null;
      if (kind === "achievement") return arr(S.achievements).some(a => a.id === v) ? "the game" : null;
      if (kind === "answer" || kind === "gave") return "the game, as the player plays";
      return has(kind, v.split(":")[0]) ? "the game, as the player plays" : null;
    }
    return null;
  };
  const facts = [];
  const readAt = new Map(); for (const [c, where] of condsOf(S)) for (const f of factsRead(c)) { if (!readAt.has(f)) readAt.set(f, []); readAt.get(f).push(where); }
  const names = new Set([...readAt.keys(), ...setBy.keys(), ...Object.keys(S.facts || {})]);
  for (const f of [...names].sort()) {
    const how = [...(setBy.get(f) || [])], a = auto(f); if (a) how.push(a);
    const decl = (S.facts || {})[f] || {};
    facts.push({ name: f, read: readAt.get(f) || [], set: how, about: decl.about || "", hidden: !!decl.hidden });
    if (readAt.has(f) && !how.length) prob("warn", `the fact ${f} is asked for (${readAt.get(f)[0]}) but nothing sets it`, readAt.get(f)[0]);
  }
  const errors = problems.filter(p => p.sev === "error").length;
  return { problems, errors, warnings: problems.length - errors, missing: [...dedup.values()], unused, facts };
}
