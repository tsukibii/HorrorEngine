// Where a story names its database entries (cast members, items, notes, sounds, lines, motions, secrets, counters,
// karma axes, flags), found by the keys that hold them, so the Database can list each entry's uses and rename it
// everywhere. Ids are unique across the file (STORY_FORMAT §0), so a key's value names an entry only when it equals
// that entry's id; a key that also holds plain words (an event's `type`, a prop's kit `tag`, a door's `set`) is never
// one of these. No DOM: the desk and its check (refstest.mjs, REFS) share it.

export const KINDS = {
  cast: { table: ["cast"], label: "cast member" },
  item: { table: ["items"], label: "item" },
  note: { table: ["notes"], label: "note" },
  sound: { table: ["sounds"], label: "sound" },
  line: { table: ["lines"], label: "line" },
  motion: { table: ["motions"], label: "motion" },
  secret: { table: ["secrets"], label: "secret" },
  counter: { table: ["game", "counters"], label: "counter" },
  axis: { table: ["game", "karma", "axes"], label: "karma axis" },
  flag: { table: null, label: "flag" },          // flags have no table: one exists while something sets or reads it
};
// the key's string, or each string in its list, names an entry of the kind
const VALUE = {
  cast: ["who", "behave", "seeker", "vs", "caught", "face", "look", "lookat", "at"],
  item: ["item", "pickup", "give", "take", "needs", "locked_by"],
  note: ["note", "read"],
  sound: ["sound"],
  line: ["say", "line"],
  motion: ["start", "end"],                     // a body's first and last pose
  secret: ["secret"],
  counter: ["count"],
  axis: ["axis"],
  flag: ["flag", "unflag", "then"],             // `then`: the flag a combo or a use_on sets
};
const VALUES_OF = { line: ["barks"], motion: ["loops"] };   // a play's barks (lines by role) and loops (motions by role)
const KEYED = { cast: ["stage", "look"], axis: ["karma"] };  // objects keyed by entries: a scene's stage and trackers, a karma change
const FREE = new Set(["note"]);                  // game.note is the game's own free text, not a note's id

const isObj = x => x && typeof x === "object" && !Array.isArray(x);
const strings = (holder, key, v, kind, path, out) => {
  if (typeof v === "string") out.push({ kind, id: v, holder, key, path });
  else if (Array.isArray(v)) v.forEach((s, i) => { if (typeof s === "string") out.push({ kind, id: s, holder: v, key: i, path: [...path, i] }); });
};

// every reference in the story: {kind, id, holder, key, path, dictKey?, token?}
export function allRefs(S) {
  const out = [];
  const walk = (x, path) => {
    if (Array.isArray(x)) { x.forEach((v, i) => walk(v, [...path, i])); return; }
    if (!isObj(x)) return;
    const top = path.length === 1 && path[0] === "game";   // game.note is free text; game.karma holds the axes' table
    for (const [k, v] of Object.entries(x)) {
      const p = [...path, k];
      if (!(FREE.has(k) && top)) {
        for (const kind in VALUE) if (VALUE[kind].includes(k)) {
          if (k === "locked_by" && typeof v === "string" && v.startsWith("flag:")) out.push({ kind: "flag", id: v.slice(5), holder: x, key: k, path: p, token: "flag:" });
          else strings(x, k, v, kind, p, out);
        }
      }
      for (const kind in VALUES_OF) if (VALUES_OF[kind].includes(k) && isObj(v)) for (const [r, w] of Object.entries(v)) strings(v, r, w, kind, [...p, r], out);
      for (const kind in KEYED) if (KEYED[kind].includes(k) && isObj(v) && !top) for (const dk of Object.keys(v)) out.push({ kind, id: dk, holder: x, key: k, path: [...p, dk], dictKey: true });
      if (k === "clip" && "anim" in x && typeof v === "string") out.push({ kind: "motion", id: v, holder: x, key: k, path: p });
      if (k === "if" && Array.isArray(v)) v.forEach((f, i) => { if (typeof f === "string") out.push({ kind: "flag", id: f.replace(/^!/, ""), holder: v, key: i, path: [...p, i], token: f.startsWith("!") ? "!" : "" }); });
      if (k === "shape" && typeof v === "string" && /^person\s+\S+/.test(v)) out.push({ kind: "cast", id: v.split(/\s+/)[1], holder: x, key: k, path: p, token: "person" });
      if (v && typeof v === "object") walk(v, p);
    }
  };
  walk(S, []);
  return out;
}
const TABLE_OF = kind => KINDS[kind].table;
export function tableOf(S, kind) { let t = S; for (const k of TABLE_OF(kind) || []) { t = t && t[k]; } return t || null; }
const inTable = (S, kind, ref) => {                // an entry's own `who`, a secret's own `flag`... are uses; its key in its table isn't
  const t = TABLE_OF(kind); return !!t && ref.path.length === t.length + 1 && t.every((k, i) => ref.path[i] === k);
};
export function usesOf(S, kind, id) { return allRefs(S).filter(r => r.kind === kind && r.id === id && !inTable(S, kind, r)); }
export function flagsOf(S) { const n = {}; for (const r of allRefs(S)) if (r.kind === "flag" && r.id) n[r.id] = (n[r.id] || 0) + 1; return n; }

// every id in the file (tables, the flow, beats, everything placed in the levels): a new id must be none of these
export function allIds(S) {
  const ids = new Set();
  for (const t of ["cast", "items", "notes", "lines", "sounds", "scenes", "stitches", "flow", "secrets", "motions"]) for (const k of Object.keys(S[t] || {})) ids.add(k);
  for (const st of Object.values(S.stitches || {})) for (const b of st.beats || []) if (b.id) ids.add(b.id);
  for (const k of Object.keys((S.game || {}).counters || {})) ids.add(k);
  for (const k of Object.keys(((S.game || {}).karma || {}).axes || {})) ids.add(k);
  const walk = x => { if (Array.isArray(x)) return x.forEach(walk); if (!isObj(x)) return; if (typeof x.id === "string") ids.add(x.id); Object.values(x).forEach(walk); };
  walk(S.levels || {});
  for (const it of S.interrupts || []) if (it.id) ids.add(it.id);
  return ids;
}
export const ID_RE = /^[a-z][a-z0-9_]*$/;

// rename an entry and every use of it; returns how many uses changed (or throws why it can't)
export function renameRef(S, kind, old, nu) {
  if (!ID_RE.test(nu)) throw new Error("an id is snake_case: lower-case letters, digits and _, starting with a letter");
  if (kind === "axis" && old === "karma") throw new Error("karma is the default axis (a plain number counts on it): add another axis instead");
  if (kind !== "flag" && allIds(S).has(nu)) throw new Error(`${nu} is already used in this game (ids are unique across the file)`);
  const uses = usesOf(S, kind, old);
  for (const r of uses) {
    if (r.dictKey) { const o = r.holder[r.key]; r.holder[r.key] = Object.fromEntries(Object.entries(o).map(([k, v]) => [k === old ? nu : k, v])); }
    else if (r.token === "person") r.holder[r.key] = r.holder[r.key].replace(/^(person\s+)\S+/, `$1${nu}`);
    else if (r.token) r.holder[r.key] = r.token + nu;
    else r.holder[r.key] = nu;
  }
  const t = TABLE_OF(kind);
  if (t) {
    let parent = S; for (const k of t.slice(0, -1)) parent = parent[k];
    const last = t[t.length - 1]; parent[last] = Object.fromEntries(Object.entries(parent[last]).map(([k, v]) => [k === old ? nu : k, v]));
  }
  return uses.length;
}

// a use's place, for people: "task “Search the house” · beat b_key", and the flow node it opens (or the level)
export function placeOf(S, path) {
  const [t, a, ...rest] = path, nodeOf = (type, ref) => Object.keys(S.flow || {}).find(n => S.flow[n].type === type && S.flow[n].ref === ref) || null;
  if (t === "stitches") {
    const st = S.stitches[a] || {}, i = rest[0] === "beats" ? rest[1] : null, b = i !== null && st.beats ? st.beats[i] : null;
    return { text: `task “${st.title || a}”${b ? " · beat " + b.id : rest[0] === "play" ? " · its play" : rest[0] === "timer" ? " · its timer" : ""}`, node: nodeOf("stitch", a), stitch: a, beat: b ? b.id : null };
  }
  if (t === "scenes") {
    const sc = S.scenes[a] || {}; let v = sc, k = null, r = rest;
    if (r[0] === "variants") { k = r[1]; v = (sc.variants || {})[k] || {}; r = r.slice(2); }
    const c = r[0] === "clips" && v.clips ? v.clips[r[1]] : null;
    return { text: `scene “${sc.title || a}”${k ? " (" + k + ")" : ""}${c ? " · line " + c.id : r[0] === "cues" ? " · a cue" : r[0] === "stage" ? " · its stage" : r[0] === "look" ? " · its trackers" : r[0] === "sets" ? " · what it sets" : ""}`, node: nodeOf("scene", a), scene: a, variant: k, clip: c ? c.id : null };
  }
  if (t === "flow") return { text: `flow ${a}`, node: a };
  if (t === "levels") {
    let x = S, id = null; for (const k of path) { x = x && x[k]; if (isObj(x) && typeof x.id === "string") id = x.id; }
    return { text: `level ${a}${id ? " · " + id : ""}`, level: a };
  }
  if (t === "interrupts") return { text: `trigger cutscene ${((S.interrupts || [])[a] || {}).id || a}`, db: "interrupts" };
  const tabs = { lines: "line", motions: "motion", secrets: "secret", cast: "cast member", items: "item", notes: "note", sounds: "sound" };
  if (tabs[t]) return { text: `${tabs[t]} ${a}`, db: t, id: a };
  if (t === "game") return { text: "the game's settings", db: "game" };
  return { text: path.join(" · ") };
}
