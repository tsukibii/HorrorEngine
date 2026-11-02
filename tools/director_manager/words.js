// The Director's words, shared by the Director Manager's page (manager.js) and Godot's Story tab (the HorrorStudio
// panel: story/commands.gd, through story/commands.json, which commands_json.mjs writes from this and the desk's
// commands.js), so the two say the same (docs/GODOT_DIRECTOR.md §6e): the desk's commands as the Director has them (a
// line written in place: no lines table), and conditions (core/cond.gd's shapes) in clauses, each as words.
// No DOM and no imports: the page and node both load it.

const isObj = x => x && typeof x === "object" && !Array.isArray(x);

// the desk's commands (tools/director/commands.js) with the Director's changes, in place
export function directorCommands({ ACTIONS, TRICKS }) {
  for (const d of ACTIONS) for (const f of d.fields) if (f.kind === "line") f.kind = "longtext";
  for (const k of Object.keys(TRICKS)) for (const f of TRICKS[k]) if (f.kind === "line") f.kind = "longtext";
}

// ---- conditions -------------------------------------------------------------------------------------------------
export const CLAUSES = [["fact", "a fact (something done, or a flag)"], ["quest", "a quest is the one on"], ["done", "a quest is done"], ["step", "a step is ticked"],
  ["has", "an item is held"], ["count", "a counter"], ["karma", "karma"], ["ending", "an ending was reached"]];
// the facts the game writes down as the player plays (coverage.js AUTO's), as words: [prefix, done, not done, what it's about]
export const FACT_WORDS = [
  ["read:", "they've read", "they haven't read", "note"], ["used:", "they've used", "they haven't used", "thing"],
  ["picked:", "they've picked up", "they haven't picked up", "item"], ["entered:", "they've been in", "they haven't been in", "area"],
  ["left:", "they've left", "they haven't left", "area"], ["gave:", "they've given", "they haven't given", "gave"],
  ["talked:", "they've begun the talk", "they haven't begun the talk", "talk"], ["heard:", "they've heard", "they haven't heard", "talk"],
  ["answered:", "they've answered", "they haven't answered", "answer"], ["caught:", "they've been caught by", "they haven't been caught by", "actor"],
  ["dropped:", "they've put down", "they haven't put down", "thing"], ["rolled:", "they've rolled", "they haven't rolled", "thing"],
  ["played:", "they've played", "they haven't played", "thing"], ["step:", "they've done the step", "they haven't done the step", "step"],
  ["failed:", "they've failed the step", "they haven't failed the step", "step"], ["done:", "they've finished", "they haven't finished", "quest"],
  ["@", "they've reached", "they haven't reached", "quest"], ["result:", "the round ended", "the round didn't end", "round"],
  ["ending:", "they've reached the ending", "they haven't reached the ending", "ending"], ["achievement:", "they've unlocked", "they haven't unlocked", "achievement"],
];
// ---- talking (the user: "for quests, do we have talk to as a quest"): the facts the game writes as the player talks,
// `talked:<person or conversation>` (she's clicked and offers one) and `heard:<person or conversation>` (one played to its
// end), as words when `ctx` says who's who: {talks: the Director file's `talk`, name: (kind, id) => her name (else the id)}
const shortLine = s => { s = String(s || "").trim(); if (s.length <= 40) return s; const i = s.lastIndexOf(" ", 40); return s.slice(0, i > 20 ? i : 40) + "…"; };
// a conversation's person and how it's called (its title, else its first line, shortened), null if it isn't one
export function talkOf(talks, id) {
  for (const [who, list] of Object.entries(isObj(talks) ? talks : {}))
    for (const t of Array.isArray(list) ? list : []) if (isObj(t) && t.id === id) {
      const first = (Array.isArray(t.lines) ? t.lines : []).find(l => isObj(l) && String(l.text || "").trim());
      return { who, label: String(t.title || "").trim() || shortLine(first ? first.text : "") || String(id) };
    }
  return null;
}
const nameOf = (ctx, id) => (ctx && typeof ctx.name === "function" ? ctx.name("cast", id) : id);
// a talk fact as {who, how: talked | heard, talk: the conversation's id or null, label}, null when it isn't one ctx knows
export function talkFact(f, ctx) {
  if (!ctx || !isObj(ctx.talks)) return null;
  const m = /^(talked|heard):(.+)$/.exec(String(f));
  if (!m) return null;
  if (Object.prototype.hasOwnProperty.call(ctx.talks, m[2])) return { who: m[2], how: m[1], talk: null, label: null };
  const t = talkOf(ctx.talks, m[2]);
  return t ? { who: t.who, how: m[1], talk: m[2], label: t.label } : null;
}
// a WHEN that's a talk ({"holds": "talked:mari"}, "heard:mari", "heard:t_open"): its talk fact, else null
export function talkWhen(w, ctx) {
  if (!isObj(w) || !("holds" in w) || Object.keys(w).length !== 1) return null;
  const p = parseCond(w.holds);
  if (p.items.length !== 1 || p.items[0].kind !== "fact" || p.items[0].not) return null;
  return talkFact(p.items[0].v, ctx);
}
// what a talk WHEN reads as: "the player talks to Mari", "the player hears Mari out", "the player hears out Mari's “You
// found it.”" ("" when it isn't one)
export function talkWhenText(w, ctx) {
  const t = talkWhen(w, ctx);
  if (!t) return "";
  const n = nameOf(ctx, t.who);
  if (!t.talk) return t.how === "talked" ? `the player talks to ${n}` : `the player hears ${n} out`;
  return t.how === "talked" ? `the player begins ${n}'s “${t.label}”` : `the player hears out ${n}'s “${t.label}”`;
}
// what can be asked of a talk with someone: [fact, how it reads in a picker] (she's clicked, she's heard out, each of her
// conversations heard out)
export function talkHows(talks, who) {
  const out = [[`talked:${who}`, "when she's clicked"], [`heard:${who}`, "when she's heard out"]];
  for (const t of Array.isArray((isObj(talks) ? talks : {})[who]) ? talks[who] : [])
    if (isObj(t) && t.id) out.push([`heard:${t.id}`, `when “${talkOf(talks, t.id).label}” is heard out`]);
  return out;
}

// a fact as words: "read:letter" → "they've read letter", a flag of the story's own → "saw_figure is set"; a talk in its
// own words when ctx knows it ("they've heard Mari out")
export function factText(f, not = false, ctx = null) {
  const s = String(f);
  const t = talkFact(s, ctx);
  if (t) {
    const n = nameOf(ctx, t.who), has = not ? "they haven't" : "they've";
    if (!t.talk) return t.how === "talked" ? `${has} talked to ${n}` : `${has} heard ${n} out`;
    return t.how === "talked" ? `${has} begun ${n}'s “${t.label}”` : `${has} heard out ${n}'s “${t.label}”`;
  }
  for (const [p, yes, no] of FACT_WORDS) {
    if (!s.startsWith(p)) continue;
    const v = s.slice(p.length), w = not ? no : yes;
    if (p === "gave:") { const [i, who] = v.split(":"); return who ? `${w} ${i} to ${who}` : `${w} ${i}`; }
    if (p === "answered:") { const [t, a] = v.split(":"); return a ? `${w} ${t} with ${a}` : `${w} ${t}`; }
    if (p === "result:") { const i = v.lastIndexOf(":"); return i > 0 ? `${v.slice(0, i)}'s round ${not ? "didn't end" : "ended"} ${v.slice(i + 1)}` : `${w} ${v}`; }
    return `${w} ${v}`;
  }
  return `${s} ${not ? "isn't" : "is"} set`;
}
export function parseClause(c) {
  if (typeof c === "string") return c.startsWith("!") ? { kind: "fact", v: c.slice(1), not: true } : { kind: "fact", v: c, not: false };
  if (!isObj(c)) return { kind: "raw", v: c };
  if (c.not !== undefined && Object.keys(c).length === 1) { const x = parseClause(c.not); if (x.kind !== "raw") { x.not = !x.not; return x; } return { kind: "raw", v: c }; }
  for (const k of ["fact", "quest", "done", "step", "has", "ending"]) if (c[k] !== undefined && Object.keys(c).length === 1) return { kind: k, v: String(c[k]), not: false };
  if (c.count !== undefined) return { kind: "count", v: c.count, at_least: c.at_least, at_most: c.at_most, not: false };
  if (c.karma !== undefined) return { kind: "karma", at_least: (c.karma || {}).at_least, at_most: (c.karma || {}).at_most, not: false };
  return { kind: "raw", v: c };
}
export function parseCond(c) {
  if (c === undefined || c === null || c === "") return { mode: "all", items: [] };
  if (Array.isArray(c)) return { mode: "all", items: c.map(parseClause) };
  if (isObj(c) && Array.isArray(c.all) && Object.keys(c).length === 1) return { mode: "all", items: c.all.map(parseClause) };
  if (isObj(c) && Array.isArray(c.any) && Object.keys(c).length === 1) return { mode: "any", items: c.any.map(parseClause) };
  return { mode: "all", items: [parseClause(c)] };
}
export function clauseJSON(x) {
  if (x.kind === "raw") return x.v;
  if (x.kind === "fact") return (x.not ? "!" : "") + x.v;
  let j;
  if (x.kind === "count") { j = { count: x.v }; if (x.at_least !== undefined) j.at_least = x.at_least; if (x.at_most !== undefined) j.at_most = x.at_most; }
  else if (x.kind === "karma") { j = { karma: {} }; if (x.at_least !== undefined) j.karma.at_least = x.at_least; if (x.at_most !== undefined) j.karma.at_most = x.at_most; }
  else j = { [x.kind]: x.v };
  return x.not ? { not: j } : j;
}
export function buildCond(mode, items) {
  if (!items.length) return undefined;
  if (items.length === 1) return clauseJSON(items[0]);
  return { [mode]: items.map(clauseJSON) };
}
const range = x => [x.at_least !== undefined ? `≥ ${x.at_least}` : "", x.at_most !== undefined ? `≤ ${x.at_most}` : ""].filter(Boolean).join(" and ");
export function clauseText(x, ctx = null) {
  const n = x.not ? "not " : "";
  switch (x.kind) {
    case "fact": return factText(x.v, x.not, ctx);
    case "quest": return `quest ${x.v} ${x.not ? "isn't" : "is"} on`;
    case "done": return `quest ${x.v} ${x.not ? "isn't" : "is"} done`;
    case "step": return `step ${x.v} ${x.not ? "isn't" : "is"} ticked`;
    case "has": return `they ${x.not ? "don't hold" : "hold"} ${x.v}`;
    case "ending": return `ending ${x.v} ${x.not ? "wasn't" : "was"} reached`;
    case "count": return `${n}${x.v} ${range(x)}`;
    case "karma": return `${n}karma ${range(x)}`;
    default: return JSON.stringify(x.v);
  }
}
// a whole condition as words: its clauses joined by and / or ("" when there are none)
export function condText(c, ctx = null) {
  const p = parseCond(c);
  return p.items.map(x => clauseText(x, ctx)).join(p.mode === "all" ? " and " : " or ");
}
