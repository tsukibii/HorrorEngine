// MOUTH: the teeth, gums and tongue without a browser (teeth.js; DECISIONS 2026-11-13, better mouths). The classic
// mouth as it was before the v2 one (a character from before keeps it); the v2 mouth well formed, its teeth a young
// woman's (smaller, the laterals a little short), its gum's edge high and scalloped, its tongue a tongue (broad,
// over the lower teeth's edges, behind the upper teeth, with the layout its papillae are drawn by); how much gum a
// smile uncovers, from MHR's own shapes on the upper lip's edge: the open smile fitted to the user's picture none, a
// full smile about a millimetre; the open smile's shapes all MHR's.
//   node tools/character/mouthcheck.mjs        ends "MOUTH ok"
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as T from "./teeth.js";
import { loadMhr, grownBody, landmark } from "./tailor/node.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), B = path.join(HERE, "..", "..", "Content", "Studio", "Bodies");
let bad = 0; const say = (ok, words) => { if (!ok) bad++; console.log((ok ? "  ok  " : "  BAD ") + words); };
const box = m => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; let nan = 0; for (let i = 0; i < m.pos.length; i++) { if (!Number.isFinite(m.pos[i])) nan++; lo[i % 3] = Math.min(lo[i % 3], m.pos[i]); hi[i % 3] = Math.max(hi[i % 3], m.pos[i]); } return { lo, hi, nan }; };
const parts = M => [M.upper.teeth, M.upper.gums, M.lower.teeth, M.lower.gums, M.lower.tongue];
const C = T.buildMouth({}), V = T.buildMouth({ style: "v2" });
// ---- the classic mouth: what it was (its points summed: 204543.773 before the v2 mouth was written)
{ let sum = 0, n = 0; for (const m of parts(C)) { for (const v of m.pos) sum += Math.abs(v); n += m.pos.length / 3; }
  say(Math.abs(sum - 204543.773) < 0.01 && T.TEETH_DEFAULTS.style === "classic", `the classic mouth is as it was (${n} points, their sum ${sum.toFixed(3)}), and what a character from before has (the default style: ${T.TEETH_DEFAULTS.style})`); }
// ---- the v2 mouth: well formed
{ const nan = parts(V).reduce((a, m) => a + box(m).nan, 0), idxBad = parts(V).some(m => m.idx.some(i => !(i >= 0 && i < m.pos.length / 3)) || m.col.length !== m.pos.length);
  say(!nan && !idxBad && Object.keys(T.TEETH_STYLES).join() === "classic,v2", `the v2 mouth: ${parts(V).reduce((a, m) => a + m.pos.length / 3, 0)} points, ${parts(V).reduce((a, m) => a + m.idx.length / 3, 0)} triangles, no NaN, every corner a point, a colour a point`); }
// its teeth: as wide an arch within a millimetre, the front six a little narrower; the lateral incisor's edge short of the central's
{ const front = (M, x0, x1) => { let lo = 1e9; const P = M.upper.teeth.pos; for (let i = 0; i < P.length; i += 3) if (P[i] > x0 && P[i] < x1 && P[i + 2] > -8) lo = Math.min(lo, P[i + 1]); return lo; };
  const cw = box(C.upper.teeth), vw = box(V.upper.teeth), cen = front(V, 1, 7), lat = front(V, 10, 14), cenC = front(C, 1, 7), latC = front(C, 10, 14);
  say(vw.hi[0] < cw.hi[0] * 0.95 && vw.hi[0] > cw.hi[0] * 0.84 && lat - cen > 0.4 && lat - cen < 1.2 && Math.abs(latC - cenC) < 0.05,
    `its teeth: the upper arch ${(2 * vw.hi[0]).toFixed(1)} mm across (the classic's ${(2 * cw.hi[0]).toFixed(1)}: narrower, the dark corners of a smile beside it), the lateral incisors' edges ${(lat - cen).toFixed(1)} mm short of the centrals' (the classic's level: a smile's line)`); }
// its gum: the edge over the front teeth higher than the classic's and scalloped
{ const edge = M => { const P = M.upper.gums.pos, ys = []; for (let i = 0; i < P.length / 3; i += 9) if (Math.abs(P[i * 3]) < 16 && P[i * 3 + 2] > -9) ys.push(P[i * 3 + 1]); return ys; };   // (the band's outer edge: the first point of each of its sections)
  const ec = edge(C), ev = edge(V), mc = Math.max(...ec), mv = Math.max(...ev), wave = mv - Math.min(...ev), waveC = mc - Math.min(...ec);
  say(mv > mc + 1.5 && wave > 0.6 && wave < 2 && T.V2.margin > 0.9, `its gum: the edge ${mv.toFixed(1)} mm above the incisors' biting edge at its highest (the classic's ${mc.toFixed(1)}), rising and falling ${wave.toFixed(1)} mm from tooth to tooth over the front teeth (the classic's ${waveC.toFixed(1)}: by the teeth's heights alone)`); }
// its tongue
{ const t = box(V.lower.tongue), tc = box(C.lower.tongue), lowEdge = T.V2.over, lowEdgeC = T.LOWER_ARCH.over, backOfUpper = -7;
  say(t.hi[0] - t.lo[0] > 36 && t.hi[0] - t.lo[0] > tc.hi[0] - tc.lo[0] + 6 && t.hi[1] - lowEdge > 6 && t.hi[1] - lowEdge < 11 && T.V2.over < 0 && T.V2.over > -3 && t.hi[2] < backOfUpper && (V.lower.tongue.uv || []).length === V.lower.tongue.pos.length / 3 * 2 && !C.lower.tongue.uv,
    `its tongue: ${(t.hi[0] - t.lo[0]).toFixed(0)} mm across (the classic's ${(tc.hi[0] - tc.lo[0]).toFixed(0)}), its top ${(t.hi[1] - lowEdge).toFixed(1)} mm over the lower teeth's edges (the classic's ${(tc.hi[1] - lowEdgeC).toFixed(1)}: under them; the v2 lower teeth's edges ${(-T.V2.over).toFixed(1)} mm under the upper's at rest, so only their tips show in an open smile), its tip ${(-t.hi[2]).toFixed(1)} mm back (behind the upper incisors), a layout for its papillae`); }
// ---- the gum a smile uncovers: the upper lip's edge at the middle (the seal's upper points) with MHR's shapes, against where the gum's edge is
{ const M = loadMhr(), buf = fs.readFileSync(path.join(B, "MHR_lod1.bin")), hl = buf.readUInt32LE(0), H = JSON.parse(buf.subarray(4, 4 + hl).toString("utf8")), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const K = H.expr_points, EIDX = new Uint32Array(ab.slice(H.expr_idx_at, H.expr_idx_at + K * 4)), half = new Uint16Array(ab.slice(H.expr_at, H.expr_at + H.expressions * K * 6)), names = H.expr_names;
  const f16 = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * f * 2 ** -24 : s * (1 + f / 1024) * 2 ** (e - 15); };
  const where = new Int32Array(M.n).fill(-1); EIDX.forEach((v, k) => { where[v] = k; });
  const LM = JSON.parse(fs.readFileSync(path.join(B, "MHR_landmarks.json"), "utf8")), t13 = LM.tri[13] * 3, b13 = LM.bary[13];
  const rise = shapes => { let dy = 0; for (const [k, w] of Object.entries(shapes)) for (const n of names.includes(k) ? [k] : [k + "_L", k + "_R"]) { const e = names.indexOf(n); if (e < 0) return NaN; for (let c = 0; c < 3; c++) { const q = where[M.T[t13 + c]]; if (q >= 0) dy += w * b13[c] * f16(half[(e * K + q) * 3 + 1]); } } return dy * 1000; };
  const AM = JSON.parse(fs.readFileSync(path.join(HERE, "arkit_mhr.json"), "utf8")), open = AM.mhr_presets?.["open smile"]?.shapes || {}, unknown = Object.keys(open).filter(k => !names.includes(k) && !(names.includes(k + "_L") && names.includes(k + "_R")));
  say(Object.keys(open).length >= 4 && !unknown.length && open.jawDrop > 0.2 && open.jawDrop < 0.6, `the open smile (arkit_mhr.json mhr_presets): ${Object.keys(open).length} shapes, all MHR's${unknown.length ? " (NOT: " + unknown.join(", ") + ")" : ""}, the jaw ${open.jawDrop}`);
  // the gum's edge above the lips' line at rest (mm): the crown's height times the margin, less how far under the line the biting edge sits
  const gum = (h, margin, down) => h * margin - 3.5 - down, gv = gum(10.8, T.V2.margin - T.V2.scallop * 0, T.V2.down), gc = gum(10.5, 0.78, 0);
  const shown = (r, g) => Math.max(0, r - g), rOpen = rise(open), rFull = rise({ lipCornerPuller: 1, cheekRaiser: 1 }), rSneer = rise({ lipCornerPuller: 1, upperLipRaiser: 0.5 });
  say(shown(rOpen, gv) === 0 && shown(rFull, gv) < 1.5 && shown(rFull, gv) < shown(rFull, gc) - 0.3 && gv > gc,
    `the gum a smile uncovers (the upper lip's edge at the middle rises ${rOpen.toFixed(1)} mm in the open smile, ${rFull.toFixed(1)} in a full one; the v2 gum's edge is ${gv.toFixed(1)} mm above the lips' line, the classic's ${gc.toFixed(1)}): the open smile ${shown(rOpen, gv).toFixed(1)} mm, a full smile ${shown(rFull, gv).toFixed(1)} mm (the classic mouth: ${shown(rFull, gc).toFixed(1)}); with the upper lip raised as well, a snarl's ${shown(rSneer, gv).toFixed(1)} mm (the classic: ${shown(rSneer, gc).toFixed(1)})`);
}
if (bad) { console.log(`MOUTH FAIL: ${bad}`); process.exit(1); }
console.log("MOUTH ok");
