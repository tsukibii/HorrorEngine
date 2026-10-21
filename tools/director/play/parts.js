// The parts registry (docs/GAMEPLAY_PLAN.md §5): every gameplay word is one small part, registered by kind and name,
// so a game grows a torch, the player's hands or a mini-game by adding a part, not by changing the runtime. A part
// has `settings` (its defaults); a new possibility is a new setting on the same part, never a near-copy of it.
//
//   condition    test(value, when, ev, rt) -> bool        a beat's `when` ({"enter": "kitchen"})
//   action       run(value, act, rt) -> (promise)         a beat's `do` ({"objective": "Find the key"})
//   interactable prompt(thing, rt, s) -> {cursor, label}; use(thing, rt, s)    a prop's `use` (note, pickup, door...)
//   ability      update(rt, dt, s); key(rt, e, down, s); mouse(rt, dx, dy, s)  what the player can do (walk, crouch, look)
// `s` is the part's settings (settingsOf): the defaults, then the player's (the Watch's crouch toggle or hold).

export const KINDS = ["condition", "action", "interactable", "ability"];
const REG = Object.fromEntries(KINDS.map(k => [k, {}]));

export function register(kind, name, part) {
  if (!REG[kind]) throw new Error(`no part kind ${kind}`);
  REG[kind][name] = Object.assign({ settings: {} }, part, { kind, name });
  return REG[kind][name];
}
export const part = (kind, name) => REG[kind][name] || null;
export const names = kind => Object.keys(REG[kind]);
// a part's settings: its defaults, then the game's, then a call's own
export const settingsOf = (p, ...over) => Object.assign({}, p.settings, ...over.filter(Boolean));

// the verb of a `when` or a `do`: its first key that names a registered part (the rest are that part's settings)
export function verbOf(kind, obj) {
  for (const k of Object.keys(obj || {})) if (REG[kind][k]) return k;
  return null;
}
