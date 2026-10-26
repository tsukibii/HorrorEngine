// A three-way merge of two edits of one story: the desk's (mine) and the disk's (theirs: Claude's, the scene builder's,
// a Kimodo import), from the version both started from (base). Objects merge key by key; lists of things with ids
// (beats, clips, rooms, props, answers...) merge by id, a thing added on either side kept where it was put; anything
// else is a value, taken from the side that changed it. Where both changed the same value differently, that's a
// conflict: mine is kept and theirs offered. No DOM: DESK tests it.
//   merge3(base, mine, theirs) -> {value, conflicts: [{path, base, mine, theirs}]}
//   setAt(doc, path, value): put a conflict's other side in; changedPaths(a, b): where two versions differ

const isObj = x => x !== null && typeof x === "object" && !Array.isArray(x);
export function same(a, b) {                       // deep equality, key order aside
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (isObj(a)) { if (!isObj(b)) return false; const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => k in b && same(a[k], b[k])); }
  return false;
}
const idList = a => Array.isArray(a) && a.every(x => isObj(x) && typeof x.id === "string") && new Set(a.map(x => x.id)).size === a.length;
const ID = id => ({ id });                         // a path step into a list by the id of the thing in it

export function merge3(base, mine, theirs) {
  const conflicts = [];
  const value = merge(base, mine, theirs, [], conflicts);
  return { value, conflicts };
}
function merge(b, m, t, path, out) {
  if (same(m, t)) return m;
  if (same(b, m)) return t;                        // only theirs changed it
  if (same(b, t)) return m;                        // only mine did
  if (isObj(m) && isObj(t) && (b === undefined || isObj(b))) {
    const res = {}, bb = b || {};
    for (const k of [...Object.keys(m), ...Object.keys(t).filter(k => !(k in m))]) {
      const v = merge(bb[k], m[k], t[k], [...path, k], out);
      if (v !== undefined) res[k] = v;
    }
    return res;
  }
  if (idList(m) && idList(t) && (b === undefined || idList(b))) return mergeList(b || [], m, t, path, out);
  out.push({ path, base: b, mine: m, theirs: t });  // both changed it, each their own way
  return m;
}
function mergeList(b, m, t, path, out) {
  const byId = l => Object.fromEntries(l.map(x => [x.id, x])), B = byId(b), M = byId(m), T = byId(t);
  const order = l => l.map(x => x.id), among = (ids, keep) => ids.filter(id => keep.has(id));
  const bo = order(b), mo = order(m), to = order(t), inB = new Set(bo);
  const moved = side => !same(among(side, inB), among(bo, new Set(side)));   // the things that were there, in another order
  const mMoved = moved(mo), tMoved = moved(to);
  if (mMoved && tMoved && !same(among(mo, new Set(to)), among(to, new Set(mo)))) out.push({ path: [...path, "(order)"], base: bo, mine: mo, theirs: to });
  const first = tMoved && !mMoved ? to : mo, second = first === to ? mo : to, ids = [...first];
  second.forEach((id, i) => {                     // a thing only the other side has: after the one before it there
    if (ids.includes(id)) return;
    let j = i - 1; while (j >= 0 && !ids.includes(second[j])) j--;
    ids.splice(j >= 0 ? ids.indexOf(second[j]) + 1 : 0, 0, id);
  });
  const res = [];
  for (const id of ids) { const v = merge(B[id], M[id], T[id], [...path, ID(id)], out); if (v !== undefined) res.push(v); }
  return res;
}

// a path into a document: keys, list indexes, or {id} for the thing with that id in a list
export function getAt(doc, path) { let x = doc; for (const k of path) { if (x === undefined || x === null) return undefined; x = isObj(k) ? (x.find ? x.find(y => y && y.id === k.id) : undefined) : x[k]; } return x; }
export function setAt(doc, path, value) {
  if (path[path.length - 1] === "(order)") {      // a list's order: put the things in the other side's order
    const list = getAt(doc, path.slice(0, -1)); if (!Array.isArray(list)) return;
    const rank = id => { const i = value.indexOf(id); return i < 0 ? value.length : i; };
    list.sort((a, b) => rank(a.id) - rank(b.id)); return;
  }
  const parent = getAt(doc, path.slice(0, -1)), k = path[path.length - 1];
  if (parent === undefined || parent === null) return;
  if (isObj(k)) {
    const i = parent.findIndex(y => y && y.id === k.id);
    if (value === undefined) { if (i >= 0) parent.splice(i, 1); } else if (i >= 0) parent[i] = value; else parent.push(value);
  } else if (value === undefined) { if (Array.isArray(parent)) parent.splice(k, 1); else delete parent[k]; }
  else parent[k] = value;
}
// the same path with list indexes instead of ids (for refs.js placeOf)
export function indexPath(doc, path) {
  const out = []; let x = doc;
  for (const k of path) {
    if (k === "(order)") break;
    if (isObj(k)) { const i = Array.isArray(x) ? x.findIndex(y => y && y.id === k.id) : -1; if (i < 0) break; out.push(i); x = x[i]; }
    else { out.push(k); x = x === undefined || x === null ? undefined : x[k]; }
  }
  return out;
}
// where two versions differ: the paths of what changed (a list of things with ids by id, any other list as a whole)
export function changedPaths(a, b, path = [], out = []) {
  if (same(a, b)) return out;
  if (isObj(a) && isObj(b)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) changedPaths(a[k], b[k], [...path, k], out); return out; }
  if (idList(a) && idList(b)) {
    const A = Object.fromEntries(a.map(x => [x.id, x])), Bm = Object.fromEntries(b.map(x => [x.id, x]));
    for (const id of new Set([...Object.keys(A), ...Object.keys(Bm)])) changedPaths(A[id], Bm[id], [...path, ID(id)], out);
    if (!same(a.map(x => x.id).filter(id => id in Bm), b.map(x => x.id).filter(id => id in A))) out.push([...path, "(order)"]);
    return out;
  }
  out.push(path); return out;
}
