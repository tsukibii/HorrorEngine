// Lives (docs/IMMERSION.md): what a little thing does by itself. Content/Studio/Life/lives.json is the data; this is
// the logic, plain (no DOM, no three.js), shared by the stage, the Watch and Play: which life a prop has, where it
// starts, what the player can do to it, and its state at any moment from where it started, the story's changes, its
// timers and the thing it stands on (a pot follows its hob). storykit/life.py reads the same file for the check.
//   lifeOf(d, data, presets) -> the life of a prop (its dict): its own `life`, else its kit's (by_preset, by_kit)
//   startOf(d, life, data) -> the state it starts in
//   new States(data, things) -> a world of lives; things: {id: {life, d}} (d: the prop's dict, with `on`, `from`...)
//     .start(t0), .set(id, to, t, by), .at(id, t) -> {state, since, age, secs, p, spent, def}, .acts(id, t),
//     .ready(id, t), .changes (every change: {t, id, from, to, by}), .snapshot(), .restore(snap)

// a rule from by_kit: a life's name, or {param: {value: life | null}, ..., "else": life}
export function pickRule(rule, spec) {
  if (rule === undefined || rule === null) return null;
  if (typeof rule === "string") return rule;
  for (const [k, m] of Object.entries(rule)) {
    if (k === "else" || !(k in spec) || !m || typeof m !== "object") continue;
    const v = String(spec[k]);
    if (v in m) return m[v];
  }
  return rule.else ?? null;
}
// a prop's kit spec with its preset merged under it (top level only, as kit.js resolve)
export function kitSpec(kit, presets = {}) {
  if (kit === undefined || kit === null) return null;
  const s = typeof kit === "string" ? { preset: kit } : kit;
  const p = s.preset ? presets[s.preset] : null;
  return Object.assign({}, p || {}, s, { preset: s.preset || null });
}
export function lifeOf(d, data, presets = {}) {
  if (!d || !data || !data.lives) return null;
  if (d.life !== undefined) return d.life && data.lives[d.life] ? d.life : null;     // life: false (or "") switches it off
  const k = kitSpec(d.kit, presets);
  if (!k) return null;
  if (k.preset && data.by_preset && data.by_preset[k.preset] !== undefined) return data.by_preset[k.preset];
  const name = pickRule((data.by_kit || {})[k.type], k);
  return name && data.lives[name] ? name : null;
}
export const stateDef = (data, life, s) => (((data.lives || {})[life] || {}).states || []).find(x => x.id === s) || null;
export const statesOf = (data, life) => (((data.lives || {})[life] || {}).states || []).map(x => x.id);
export function startOf(d, life, data) {
  const ids = statesOf(data, life);
  return d && ids.includes(d.state) ? d.state : ids[0] || null;
}
// a state's length for this thing: its own `secs` setting over the life's
export function secsOf(data, life, d, s) {
  const own = d && d.secs && typeof d.secs === "object" ? d.secs[s] : undefined, def = stateDef(data, life, s);
  return own !== undefined ? +own : def && def.secs !== undefined ? +def.secs : null;
}

export class States {
  constructor(data, things = {}) {
    this.data = data; this.things = {}; this.e = {}; this.now = 0; this.changes = [];
    for (const [id, t] of Object.entries(things)) if (t && t.life && data.lives[t.life]) this.things[id] = { life: t.life, d: t.d || {} };
    // who follows whom: a thing whose life follows stands `on` a thing with a life (a pot on its hob)
    this.followers = {};
    for (const [id, t] of Object.entries(this.things)) {
      const lead = t.d.on, L = data.lives[t.life];
      if (L.follows && lead && this.things[lead]) (this.followers[lead] = this.followers[lead] || []).push(id);
      t.lead = L.follows && lead && this.things[lead] ? lead : null;
    }
  }
  def(id, s) { const t = this.things[id]; return t ? stateDef(this.data, t.life, s ?? (this.e[id] || {}).state) : null; }
  start(t0 = 0) {
    this.now = t0; this.e = {}; this.changes = []; this.first = {};
    for (const [id, t] of Object.entries(this.things)) this.e[id] = { state: startOf(t.d, t.life, this.data), since: t0, spent: {} };
    for (const [id, t] of Object.entries(this.things)) {          // a follower starts where its leader puts it, unless told
      if (!t.lead || t.d.state !== undefined) continue;
      const m = this.data.lives[t.life].follows[this.e[t.lead].state];
      if (m) this.e[id].state = m;
    }
    for (const [id, e] of Object.entries(this.e)) this.first[id] = { t: t0, state: e.state };
    return this;
  }
  // its states over time, [{t, state}] from where it started: the effects read what was going on when a puff was born
  history(id) {
    const out = this.first && this.first[id] ? [this.first[id]] : [];
    for (const c of this.changes) if (c.id === id) out.push({ t: c.t, state: c.to });
    return out;
  }
  snapshot() { return { now: this.now, e: JSON.parse(JSON.stringify(this.e)) }; }
  restore(s) { this.now = s.now; this.e = JSON.parse(JSON.stringify(s.e)); this.changes = []; this.first = Object.fromEntries(Object.entries(this.e).map(([id, e]) => [id, { t: e.since, state: e.state }])); return this; }
  // when its state's time runs out (null: it doesn't)
  due(id) {
    const e = this.e[id], t = this.things[id], def = this.def(id);
    if (!e || !def || !def.next) return null;
    const secs = secsOf(this.data, t.life, t.d, e.state);
    if (secs === null || !(secs >= 0)) return null;
    return e.since + Math.max(0, secs - (def.keep ? e.spent[e.state] || 0 : 0));
  }
  advance(t) {
    for (let guard = 0; guard < 10000; guard++) {
      let best = null;
      for (const id of Object.keys(this.e)) { const d = this.due(id); if (d !== null && d <= t && (!best || d < best.d)) best = { id, d }; }
      if (!best) break;
      this.enter(best.id, this.def(best.id).next, best.d, "timer");
    }
    this.now = Math.max(this.now, t);
  }
  enter(id, to, t, by = "story") {
    const e = this.e[id]; if (!e || !this.def(id, to) || e.state === to) return false;
    e.spent[e.state] = (e.spent[e.state] || 0) + Math.max(0, t - e.since);
    this.changes.push({ t, id, from: e.state, to, by });
    e.state = to; e.since = t;
    for (const f of this.followers[id] || []) {                   // what stands on it follows, unless it's already on its way
      const m = this.data.lives[this.things[f].life].follows[to];
      if (m && !this.downstream(f, m)) this.enter(f, m, t, "follows");
    }
    return true;
  }
  downstream(id, s) {                                             // is it in s, or where s leads by itself?
    const cur = this.e[id].state;
    for (let i = 0, x = s; x && i < 30; i++) { if (x === cur) return true; const d = this.def(id, x); x = d && d.secs !== undefined ? d.next : null; }
    return false;
  }
  set(id, to, t = this.now, by = "story") { this.advance(t); return this.enter(id, to, t, by); }
  at(id, t = this.now) {
    this.advance(t);
    const e = this.e[id]; if (!e) return null;
    const th = this.things[id], def = this.def(id), age = Math.max(0, t - e.since), secs = secsOf(this.data, th.life, th.d, e.state);
    const kept = def && def.keep ? e.spent[e.state] || 0 : 0;
    return { state: e.state, since: e.since, age, secs, p: secs ? Math.min(1, (kept + age) / secs) : 0, spent: Object.assign({}, e.spent, { [e.state]: kept + age }), def, life: th.life };
  }
  ready(id, t = this.now) { const s = id && this.things[id] ? this.at(id, t) : null; return !!(s && s.def && s.def.ready); }
  // what the player can do to it now: its state's acts, those that need a source (a cup's `from`) only when it's ready
  acts(id, t = this.now) {
    const th = this.things[id]; if (!th || th.d.acts === false) return [];
    const s = this.at(id, t);
    return ((s && s.def && s.def.acts) || []).filter(a => !a.needs || this.ready(th.d[a.needs], t));
  }
}
