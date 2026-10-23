// The tailor off the page's thread (tools/character/index.html): {id, key, P, T, list, designs} in, the garments' parts
// out ({id, garments: [{name, stats, parts: [{name, color, P, T, S}]}]} with the arrays transferred). The body is read
// once per `key` (its weights and height), so a colour or a new garment doesn't measure it again.
import * as TAILOR from "../tailor.js";

let KEY = null, B = null;
self.onmessage = e => {
  const { id, key, P, T, list, designs } = e.data;
  try {
    if (key !== KEY || !B) { B = TAILOR.body(P, T); KEY = key; }
    const worn = TAILOR.dress(B, list, designs), move = [];
    const garments = worn.map(g => ({
      name: g.name, stats: g.stats,
      parts: g.parts.map(q => { move.push(q.P.buffer, q.T.buffer, q.S.buffer); return { name: q.name, color: q.color, P: q.P, T: q.T, S: q.S }; }),
    }));
    self.postMessage({ id, garments }, move);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
