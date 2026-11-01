// The tailor off the page's thread (tools/character/index.html). {id, key, P, T, list, designs, drape} in: the garments
// cut at once ({id, stage: "cut", garments}), then, with `drape`, hung by gravity a few dozen steps at a time
// ({id, progress: {k, of, name, frac}} between) and sent again ({id, stage: "hung", garments, bakes: {key: points}});
// a newer job stops an older one's drape between its slices. The garments: {name, key, stats, drape, look, handles,
// parts: [{name, color, fabric, P, T, N, UV, PART, S, CRZ}]} with the arrays transferred. {bakes: {key: points}} in: drapes
// kept with the character, taken as they are when they fit (tailor.js dressing). The body is read once per `key`.
// `have` (the wardrobe's): the garments (their `made` keys) the page already shows: sent without their parts.
// `gpu` (the pages' "Use the GPU", a test of the card: DECISIONS 2026-11-02): each drape's steps on the card
// (tailor/drape_gpu.js), the CPU's where there's no WebGPU; the last message says which ({gpu: {used, name | why}}).
// Drapes made on the card are kept apart from the CPU's (so switching re-hangs); the character's own bakes count for both.
import * as TAILOR from "../tailor.js";
import { drapeGPU, gpuState } from "./drape_gpu.js";

let KEY = null, B = null, JOB = 0;
const KEPT = new Map();                                // drape key -> its points: made here or given ("gpu:" before the key: hung on the card)
const GIVEN = new Set();                               // the keys given (the character's bakes), not made here
function kept(gpu) {                                   // the bakes a job takes: on the CPU all but the card's; on the card the given and its own
  const o = {};
  for (const [k, v] of KEPT) if (!k.startsWith("gpu:") && (!gpu || GIVEN.has(k))) o[k] = v;
  if (gpu) for (const [k, v] of KEPT) if (k.startsWith("gpu:")) o[k.slice(4)] = v;
  return o;
}

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
  if (m.bakes && !m.list) { for (const [k, v] of Object.entries(m.bakes)) { KEPT.set(k, v); GIVEN.add(k); } return; }
  const { id, key, P, T, list, designs, drape } = m, have = m.have ? new Set(m.have) : null, gpu = !!m.gpu, mode = gpu ? "gpu:" : "";
  JOB = id;
  try {
    if (key !== KEY || !B) { B = TAILOR.body(P, T); KEY = key; }
    const plan = drape ? TAILOR.plan(key, list, designs) : [];
    // the cut at once, unless every garment that hangs has a drape kept for it (then the hung clothes come straight away)
    const bakes0 = kept(gpu);
    if (!drape || plan.some(g => g.drapes && !bakes0[g.key])) send(id, TAILOR.dress(B, list, designs), { stage: drape ? "cut" : "done" }, have);
    if (!drape) return;
    const it = TAILOR.dressing(B, list, designs, { drape: true, body: key, bakes: bakes0, ...(gpu ? { gpu: true } : {}) });
    let r, t = Date.now(), back, onCard = 0, onCPU = 0;
    while (!(r = it.next(back)).done) {
      back = undefined;
      if (r.value.gpu) {                               // a drape's steps for the card: run there, its result sent back in
        const q = r.value;
        back = await drapeGPU(q.gpu, { alive: () => JOB === id, progress: frac => self.postMessage({ id, progress: { k: q.k, of: q.of, name: q.name, frac, gpu: true } }) });
        if (JOB !== id) return;
        if (back) onCard++; else onCPU++;              // (none: no WebGPU here, the CPU's steps follow)
        t = Date.now(); continue;
      }
      if (Date.now() - t < 60) continue;
      self.postMessage({ id, progress: r.value });
      await new Promise(go => setTimeout(go, 0));      // a newer job's message comes in here
      if (JOB !== id) return;
      t = Date.now();
    }
    const bakes = {};
    for (const g of r.value) if (g.hung) { KEPT.delete(mode + g.key); KEPT.set(mode + g.key, g.hung); if (!gpu && !g.drape?.baked) GIVEN.delete(g.key); bakes[g.key] = Float32Array.from(g.hung); }
    while (KEPT.size > 48) { const k = KEPT.keys().next().value; KEPT.delete(k); GIVEN.delete(k); }   // the oldest go
    const st = gpuState();
    send(id, r.value, { stage: "hung", bakes, ...(gpu ? { gpu: { used: onCard > 0, onCard, onCPU, ...(st.ok ? { name: st.name } : { why: st.why }) } } : {}) }, have);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
