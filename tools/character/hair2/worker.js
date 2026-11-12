// The hair editor v2.0's engine off the page's thread (docs/HAIR_V2.md): the Character Studio's tab (ui.js) sends the
// body when it changes and the settings when a slider moves; back come the hair's arrays, ready for three.js.
//   { cmd: "body", P, T }                       the body's points (the Studio's, metres) and, the first time, its triangles -> { cmd: "body", hf, C, ms }
//   { cmd: "grow", seq, settings, draft, pores } -> { cmd: "hair", seq, draft, stats, hair, scalp, shell, tails, bands, pores }
// Only the newest grow asked for is made: a slider dragged asks many times.
import { prepare, grow } from "./engine.js";
import { readPores } from "./pores.js";
import { localBody } from "./body.js";
import { lookOf } from "./styles.js";
import { linear } from "../hairtex.js";

let pores = null, body = null, prep = null, wanted = null, queued = false, TRIS = null;
const ready = fetch(new URL("./pores.bin", import.meta.url)).then(r => { if (!r.ok) throw new Error("no pores.bin (node tools/character/hair2/pores.mjs make)"); return r.arrayBuffer(); }).then(b => { pores = readPores(b); });

function run() {
  queued = false; const m = wanted; wanted = null; if (!m || !prep) return;
  try {
    const s = m.settings, look = lookOf(s), root = linear(look.root).map(v => Math.round(255 * Math.pow(v, 1 / 2.2)));
    const r = grow(body, pores, s, prep, { draft: m.draft, rootColour: root }), move = [];
    const geo = g => { if (!g) return null; const o = {}; for (const k of ["position", "normal", "tangent", "uv", "uv1", "color", "index"]) if (g[k]) { o[k] = g[k]; move.push(g[k].buffer); } return o; };
    const out = { cmd: "hair", seq: m.seq, draft: !!m.draft, stats: r.stats, hair: geo(r.hair), shell: geo(r.shell), layers: r.shell ? r.shell.layers : 0,
      // (the scalp's patch and its picture are kept from one remake to the next: copied, never handed over; the picture only when it was painted again)
      scalp: r.scalp ? { position: r.scalp.position.slice(), normal: r.scalp.normal.slice(), uv: r.scalp.uv.slice(), index: r.scalp.index.slice(), rgba: r.scalp.fresh || m.repaint ? r.scalp.rgba.slice() : null, size: r.scalp.size } : null,
      tails: r.tails.map(t => ({ name: t.name, joints: t.joints, soft: t.soft, along: t.along, ...geo(t.geo) })),
      bands: r.bands.map(b => ({ name: b.name, colour: b.colour, position: b.position, normal: b.normal, index: b.index })),
      pores: m.pores ? { pos: r.guides.pos, group: r.guides.group, len: r.guides.len } : null };
    if (out.scalp && out.scalp.rgba) move.push(out.scalp.rgba.buffer);
    for (const t of out.tails) move.push(t.along.buffer);
    postMessage(out, [...new Set(move)]);
  } catch (e) { postMessage({ cmd: "error", seq: m.seq, error: String(e && e.stack || e) }); }
}

onmessage = async e => {
  const m = e.data;
  try { await ready; } catch (err) { postMessage({ cmd: "error", error: String(err.message || err) }); return; }
  if (m.cmd === "body") {
    if (m.T) TRIS = m.T;                                                  // (the triangles come once: they never change)
    const t = performance.now(); body = localBody(m.P, TRIS); prep = prepare(body);
    postMessage({ cmd: "body", seq: m.seq, hf: body.hf, C: body.C, ms: performance.now() - t });
  } else if (m.cmd === "grow") { wanted = m; if (!queued) { queued = true; setTimeout(run, 0); } }
};
