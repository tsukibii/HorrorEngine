// The tailor off the page's thread (tools/character/index.html). {id, key, P, T, list, designs, drape} in: the garments
// cut at once ({id, stage: "cut", garments}), then, with `drape`, hung by gravity a few dozen steps at a time
// ({id, progress: {k, of, name, frac}} between) and sent again ({id, stage: "hung", garments, bakes: {key: points}});
// a newer job stops an older one's drape between its slices. The garments: {name, key, stats, drape, look, handles,
// parts: [{name, color, fabric, P, T, N, UV, PART, S, CRZ}]} with the arrays transferred. {bakes: {key: points}} in: drapes
// kept with the character, taken as they are when they fit (tailor.js dressing). The body is read once per `key`.
// `have` (the wardrobe's): the garments (their `made` keys) the page already shows: sent without their parts.
import * as TAILOR from "../tailor.js";

let KEY = null, B = null, JOB = 0;
const KEPT = new Map();                                // drape key -> its points: made here or given

function send(id, worn, extra, have = null) {
  const move = [];
  const garments = worn.map(g => ({
    name: g.name, key: g.key, made: g.made, stats: g.stats, drape: g.drape, look: g.look, handles: g.handles,
    parts: have && have.has(g.made) ? null : g.parts.map(q => {     // (none for a garment the page already shows: `have`, the wardrobe's)                                        // copies sent (the tailor keeps its garments to give again: transferred, its own would be emptied)
      const { name, color, fabric, surface } = q, [P, T, N, UV, PART, S, CRZ] = [q.P, q.T, q.N, q.UV, q.PART, q.S, q.CRZ].map(a => a.slice());
      move.push(P.buffer, T.buffer, N.buffer, UV.buffer, PART.buffer, S.buffer, CRZ.buffer); return { name, color, fabric, surface, P, T, N, UV, PART, S, CRZ };
    }),
  }));
  self.postMessage({ id, garments, ...extra }, move);
}

self.onmessage = async e => {
  const m = e.data;
  if (m.bakes && !m.list) { for (const [k, v] of Object.entries(m.bakes)) KEPT.set(k, v); return; }
  const { id, key, P, T, list, designs, drape } = m, have = m.have ? new Set(m.have) : null;
  JOB = id;
  try {
    if (key !== KEY || !B) { B = TAILOR.body(P, T); KEY = key; }
    const plan = drape ? TAILOR.plan(key, list, designs) : [];
    // the cut at once, unless every garment that hangs has a drape kept for it (then the hung clothes come straight away)
    if (!drape || plan.some(g => g.drapes && !KEPT.has(g.key))) send(id, TAILOR.dress(B, list, designs), { stage: drape ? "cut" : "done" }, have);
    if (!drape) return;
    const it = TAILOR.dressing(B, list, designs, { drape: true, body: key, bakes: Object.fromEntries(KEPT) });
    let r, t = Date.now();
    while (!(r = it.next()).done) {
      if (Date.now() - t < 60) continue;
      self.postMessage({ id, progress: r.value });
      await new Promise(go => setTimeout(go, 0));      // a newer job's message comes in here
      if (JOB !== id) return;
      t = Date.now();
    }
    const bakes = {};
    for (const g of r.value) if (g.hung) { KEPT.delete(g.key); KEPT.set(g.key, g.hung); bakes[g.key] = Float32Array.from(g.hung); }
    while (KEPT.size > 48) KEPT.delete(KEPT.keys().next().value);   // the oldest go
    send(id, r.value, { stage: "hung", bakes }, have);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
