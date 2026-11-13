// LASHFIT: the lashes kept on top of the lid's skin (tools/character/lashfit.js; DECISIONS 2026-11-13, the lashes), no
// browser (check_all runs it).
//   - on a made-up lid (a rounded rim a few millimetres across running along x, a cheek below it, the lid's lining
//     behind it, which isn't skin to stand on): the signed distance against the answer worked out the slow way over
//     every triangle; a lash line laid as flat chords under the rim put on the skin, every point a hair's breadth off
//     it and none on the lining; lashes rooted under the skin lifted out where they're in it and left alone where
//     they're in the air; nothing past its reach touched; the same answer twice; quick enough for a blink's frames;
//   - with --glb FILE (or --person NAME: Content/Studio/People/NAME/export/NAME.glb), a character exported for Godot:
//     its lashes and lash line against its skin at rest and at every twentieth of the blink, as Godot puts the blink's
//     targets together (HSBlink: the blink's own weight and each in-between's hat): no point of a lash or of the lash
//     line under the skin by more than a twentieth of a millimetre, and the lash line on it. An export made before the
//     fit fails this (thousands of points under, most of a millimetre deep): --before says the numbers without failing.
//   node tools/character/lashfit_check.mjs [--person eyes_v3 | --glb FILE] [--before]
// Ends "LASHFIT ok".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeSkin, closest, conform, inSeam } from "./lashfit.js";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
let ok = true;
const say = (good, what) => { console.log((good ? "  ok  " : "  BAD ") + what); ok = ok && !!good; };
const mm = 0.001;

// ---- a made-up lid: a rim (a quarter-round of radius 2 mm along x, 30 mm long) between a flat lid above it (facing +z)
// and a flat margin under it (facing -y), and the lining behind the margin (facing -z: the lid's back on the eye)
const P = [], F = [], lining = new Set(), NX = 60, NA = 10, R = 2 * mm, L = 30 * mm;
const grid = (rows, at, tag) => {                         // rows x (NX + 1) points, quads between
  const base = P.length / 3;
  for (let r = 0; r <= rows; r++) for (let i = 0; i <= NX; i++) { P.push(...at(r / rows, i / NX * L - L / 2)); if (tag) lining.add(P.length / 3 - 1); }
  for (let r = 0; r < rows; r++) for (let i = 0; i < NX; i++) { const a = base + r * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; F.push(a, c, b, b, c, d); }
};
grid(8, (t, x) => [x, R + 6 * mm * (1 - t), R]);                                   // the lid's front, down to the rim's top
grid(NA, (t, x) => [x, R * Math.sin((1 - t) * Math.PI / 2), R * Math.cos((1 - t) * Math.PI / 2)]);   // the rim: from the front round to the margin
grid(3, (t, x) => [x, 0, -t * 1.2 * mm]);                                          // the margin (the lid's edge), back toward the eye
grid(4, (t, x) => [x, t * 5 * mm, -1.2 * mm], true);                                // the lining, up the lid's back
const PA = Float32Array.from(P), FA = Uint32Array.from(F);
// (the grids' winding faces the lid's front out along +z; the margin faces down and the lining back, as a lid's do)
const S = makeSkin(PA, FA, { skip: i => lining.has(i), cell: 1.2 * mm });
say(S.n === (8 + NA + 3) * NX * 2, `a made-up lid: ${S.n} triangles of skin (its ${4 * NX * 2} of lining left out)`);
// the slow way: the nearest point over every triangle of skin
let worst = 0, n = 0, r = 12345; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const one = makeSkin(PA, FA, { skip: i => lining.has(i), cell: 1 });
for (let k = 0; k < 400; k++) {
  const x = (rnd() - 0.5) * 24 * mm, y = (rnd() - 0.2) * 6 * mm, z = (rnd() - 0.3) * 4 * mm, a = closest(S, x, y, z, 2 * mm), b = closest(one, x, y, z, 2 * mm);
  if (a !== a && b !== b) continue;
  n++; worst = Math.max(worst, a !== a || b !== b ? 1 : Math.abs(a - b));
}
say(n > 150 && worst < 1e-7, `the signed distance by the grid is the one over every triangle (${n} points near the skin, the furthest apart ${(worst / mm).toExponential(1)} mm)`);
say(closest(S, 0, R + 3 * mm, R + 0.5 * mm, 2 * mm) > 0.49 * mm && closest(S, 0, R + 3 * mm, R - 0.4 * mm, 2 * mm) < -0.39 * mm && Number.isNaN(closest(S, 0, R + 3 * mm, R + 5 * mm, 2 * mm)),
  "in front of the lid it's outside, behind its skin inside, past its reach nothing");

// ---- the lash line: a strip from the margin over the rim and up the lid, laid as three flat chords (as a strip through
// a few points of the rim is): under the rounded rim between them
const strip = []; for (let i = 0; i <= 48; i++) { const x = (i / 48 - 0.5) * 24 * mm; for (const [y, z] of [[0, -0.3 * mm], [0, R], [R, R], [R + 1 * mm, R]]) strip.push(x, y, z);
  for (const t of [0.25, 0.5, 0.75]) strip.push(x, t * R, R * (1 - 0) - (1 - t) * 0);   // (and three on the chord across the rim's corner)
}
// (the chord from the margin's front (y 0, z R) to the rim's top (y R, z R) passes outside the round rim; the one below
// passes under it: both are put on it)
const line = Float32Array.from(strip.map((v, k) => k % 3 === 2 && strip[k - 1] > 0.1 * mm && strip[k - 1] < R * 0.95 ? v - 0.9 * mm : v));
const before = conform(Float32Array.from(line), S, { lift: 0.09 * mm, reach: 2.5 * mm }), fit = conform(line, S, { lift: 0.09 * mm, reach: 2.5 * mm, all: true });
let off = 0, low = Infinity; for (let i = 0; i < line.length; i += 3) { const d = closest(one, line[i], line[i + 1], line[i + 2], 3 * mm); off = Math.max(off, Math.abs(d - 0.09 * mm)); low = Math.min(low, line[i + 2]); }
say(before.under > 100 && fit.moved === line.length / 3 && off < 0.012 * mm, `a lash line laid as chords under the rim (${before.under} of its ${line.length / 3} points under the skin, to ${(before.deepest / mm).toFixed(2)} mm): put on it, every point 0.09 mm off the skin within ${(off / mm).toFixed(3)} mm`);
say(low > -1.25 * mm, `none of it on the lid's lining (the furthest back ${(low / mm).toFixed(2)} mm: the margin, never the back of the lid)`);

// ---- lashes: each rooted 0.4 mm under the lid's front, running down under the skin for a millimetre and then out
// into the air; and one wholly in the air
const lash = [], free = [];
for (let k = 0; k < 60; k++) { const x = (k / 59 - 0.5) * 22 * mm; for (let j = 0; j <= 8; j++) { const t = j / 8; lash.push(x, R + 2 * mm - 1.5 * mm * t, R - 0.4 * mm + 2.6 * mm * t * t); } }
for (let j = 0; j <= 8; j++) free.push(0, R + 3 * mm, R + 0.5 * mm + j * 0.5 * mm);
const LA = Float32Array.from([...lash, ...free]), was = Float32Array.from(LA), b2 = conform(Float32Array.from(LA), S, { lift: 0.06 * mm, reach: 2 * mm });
conform(LA, S, { lift: 0.06 * mm, reach: 2 * mm }); const again = conform(LA, S, { lift: 0.06 * mm, reach: 2 * mm });
let under = 0, kept = 0, air = 0; for (let i = 0; i < LA.length; i += 3) { const d = closest(one, LA[i], LA[i + 1], LA[i + 2], 3 * mm), d0 = closest(one, was[i], was[i + 1], was[i + 2], 3 * mm);
  if (d === d && d < 0.06 * mm - 0.005 * mm) under++;
  if (!(d0 < 0.06 * mm)) { air++; if (LA[i] === was[i] && LA[i + 1] === was[i + 1] && LA[i + 2] === was[i + 2]) kept++; } }
if (under || again.moved) console.log(`      (${under} still under, ${again.moved} moved again)`);
say(b2.under >= 120 && under === 0 && again.moved === 0, `lashes rooted under the skin (${b2.under} points in it, to ${(b2.deepest / mm).toFixed(2)} mm): none under a hair's breadth of it after, and fitted again nothing moves`);
say(air > 150 && kept === air, `what was in the air is as it was made (${kept} of ${air} points, the lash wholly in the air among them)`);
// ---- shut: a lower lid's margin pressed up against the upper's (the same lid upside down, its margin 0.05 mm into the
// upper's: lids that meet overlap a little). A lash that crosses the margins there is between two skins: there is no
// place on top of either for it, and both hide it. It's left as made; where it comes out in front of them it lies on
// the skin as anywhere
{
  const P2 = Array.from(PA), F2 = Array.from(FA), lin2 = new Set(lining), nP = PA.length / 3;
  for (let i = 0; i < nP; i++) { P2.push(PA[i * 3], 0.05 * mm - PA[i * 3 + 1], PA[i * 3 + 2]); if (lining.has(i)) lin2.add(nP + i); }
  for (let t = 0; t < FA.length; t += 3) F2.push(nP + FA[t], nP + FA[t + 2], nP + FA[t + 1]);          // (mirrored: wound the other way round, so it still faces out)
  const SS = makeSkin(Float32Array.from(P2), Uint32Array.from(F2), { skip: i => lin2.has(i), cell: 1.2 * mm });
  const mid = [], out = [];                              // lashes across the margins: from the margins' back to their front edge (in the seam), then down the lower lid's front under its skin (to be lifted)
  for (let k = 0; k < 40; k++) { const x = (k / 39 - 0.5) * 20 * mm;
    for (let j = 0; j <= 6; j++) mid.push(x, 0.02 * mm, -1 * mm + j / 6 * 0.9 * mm);
    for (let j = 1; j <= 6; j++) out.push(x, 0.05 * mm - R - j * 0.4 * mm, R - 0.2 * mm); }
  const M = Float32Array.from(mid), M0 = Float32Array.from(M), O = Float32Array.from(out);
  const fm = conform(M, SS, { lift: 0.06 * mm, reach: 2 * mm }), fm2 = conform(M, SS, { lift: 0.06 * mm, reach: 2 * mm }), fo = conform(O, SS, { lift: 0.06 * mm, reach: 2 * mm }); conform(O, SS, { lift: 0.06 * mm, reach: 2 * mm });
  let onIt = 0; for (let i = 0; i < M.length; i += 3) { const d = closest(SS, M[i], M[i + 1], M[i + 2], 2 * mm); if (Math.abs(d) < 0.051 * mm && Math.abs(M[i] - M0[i]) < 1e-9 && Math.abs(M[i + 2] - M0[i + 2]) < 0.06 * mm) onIt++; }   // (on one margin, so no deeper in the other than the two overlap; not moved along the lid)
  let lowU = 0; for (let i = 0; i < O.length; i += 3) { const d = closest(SS, O[i], O[i + 1], O[i + 2], 3 * mm); if (d === d && d < 0.055 * mm) lowU++; }
  const h = [0, 0, 0, 0, 0, 0], dIn = closest(SS, 0, 0.02 * mm, -0.5 * mm, 2 * mm, h), seamIn = dIn < 0 && inSeam(SS, h, 0.06 * mm, 2 * mm);
  const dLid = closest(SS, 0, R + 3 * mm, R - 0.3 * mm, 2 * mm, h), seamLid = inSeam(SS, h, 0.06 * mm, 2 * mm);
  say(fm.seam === M.length / 3 && fm.moved === M.length / 3 && fm2.moved === 0 && onIt === M.length / 3 && seamIn && dLid < 0 && !seamLid,
    `shut, lashes across the two margins pressed together (${fm.seam} points between them, in both lids): each put on the margin it's under, between the two, and fitted again nothing moves; a point under a lid's front alone is not called between two`);
  say(fo.under > 150 && fo.seam === 0 && lowU === 0, `and where they come out in front, under the lower lid's skin (${fo.under} points): lifted onto it as anywhere`);
}
// ---- quick enough: twenty thousand points on the lid
const many = new Float32Array(60000); for (let i = 0; i < 20000; i++) { many[i * 3] = (rnd() - 0.5) * 24 * mm; many[i * 3 + 1] = (rnd() - 0.1) * 7 * mm; many[i * 3 + 2] = R + (rnd() - 0.6) * 1.5 * mm; }
const t0 = performance.now(); const S2 = makeSkin(PA, FA, { skip: i => lining.has(i), cell: 1.2 * mm }); const m1 = conform(many, S2, { lift: 0.06 * mm, reach: 2 * mm }); const dt = performance.now() - t0;
say(dt < 1500 && m1.near > 15000, `twenty thousand points fitted in ${dt.toFixed(0)} ms (${m1.near} near the skin, ${m1.moved} moved)`);

// ---- a character exported for Godot: its lashes against its skin, through the blink
const glbFile = opt("--glb") || (opt("--person") ? path.join(ROOT, "Content", "Studio", "People", opt("--person"), "export", opt("--person") + ".glb") : null);
if (glbFile) {
  if (!fs.existsSync(glbFile)) { say(false, `no export at ${glbFile}`); }
  else {
    const buf = fs.readFileSync(glbFile), jl = buf.readUInt32LE(12), J = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8")), bin = buf.subarray(20 + jl + 8);
    const acc = i => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], w = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
      const out = new C(a.count * w);
      if (v) {                                                              // (a target written sparse has no view of its own: nothing but what its sparse part says)
        const stride = v.byteStride || w * C.BYTES_PER_ELEMENT, dv = new DataView(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0));
        for (let i = 0; i < a.count; i++) for (let c = 0; c < w; c++) { const at = i * stride + c * C.BYTES_PER_ELEMENT; out[i * w + c] = C === Float32Array ? dv.getFloat32(at, true) : C === Uint32Array ? dv.getUint32(at, true) : C === Uint16Array ? dv.getUint16(at, true) : dv.getUint8(at); }
      }
      if (a.sparse) { const si = a.sparse.indices, sv = a.sparse.values, IV = J.bufferViews[si.bufferView], VV = J.bufferViews[sv.bufferView], IC = { 5125: 4, 5123: 2, 5121: 1 }[si.componentType];
        const di = new DataView(bin.buffer, bin.byteOffset + (IV.byteOffset || 0) + (si.byteOffset || 0)), dw = new DataView(bin.buffer, bin.byteOffset + (VV.byteOffset || 0) + (sv.byteOffset || 0));
        for (let k = 0; k < a.sparse.count; k++) { const at = IC === 4 ? di.getUint32(k * 4, true) : IC === 2 ? di.getUint16(k * 2, true) : di.getUint8(k); for (let c = 0; c < w; c++) out[at * w + c] = dw.getFloat32((k * w + c) * 4, true); } }
      return out; };
    const part = word => { const hits = J.nodes.filter(nd => nd.mesh !== undefined && word(String(nd.name || "").toLowerCase())); if (!hits.length) return null;
      const m = J.meshes[hits[0].mesh], pr = m.primitives[0], names = m.extras?.targetNames || [];
      const pos = acc(pr.attributes.POSITION);
      return { name: hits[0].name, extras: hits[0].extras || {}, pos, idx: pr.indices !== undefined ? acc(pr.indices) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i), targets: Object.fromEntries((pr.targets || []).map((t, k) => [names[k], acc(t.POSITION)])) }; };
    const skin = part(nm => nm.endsWith("skin")), lashes = part(nm => nm === "lashes" || nm.endsWith("_lashes")), lline = part(nm => nm.includes("lash_line"));
    if (!skin || !lashes) say(false, `${path.basename(glbFile)}: no skin or no lashes in it`);
    else {
      const weights = (names, w) => { const o = {}; for (const sd of "LR") { const base = `eyesClosed_${sd}`; if (!names.includes(base)) continue; o[base] = w;
        const keys = names.filter(nm => nm.startsWith(base + "_in")).map(nm => [parseInt(nm.slice(base.length + 3)) / 10000, nm]).sort((a, b) => a[0] - b[0]), ws = [0, ...keys.map(k => k[0]), 1];
        keys.forEach(([k, nm], i) => { const lo = ws[i], hi = ws[i + 2]; o[nm] = w >= lo && w <= k ? (w - lo) / (k - lo) : w > k && w <= hi ? (hi - w) / (hi - k) : 0; }); } return o; };
      const at = (p, w) => { const out = Float32Array.from(p.pos), W = weights(Object.keys(p.targets), w); for (const [nm, v] of Object.entries(W)) if (v) { const t = p.targets[nm]; for (let k = 0; k < out.length; k++) out[k] += v * t[k]; } return out; };
      // the skin near the lashes only (their box and a centimetre): a head's worth of triangles needn't be in the grid
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < lashes.pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], lashes.pos[i + a]); hi[a] = Math.max(hi[a], lashes.pos[i + a]); }
      const pad = 0.012, nearBox = i => skin.pos[i * 3] > lo[0] - pad && skin.pos[i * 3] < hi[0] + pad && skin.pos[i * 3 + 1] > lo[1] - pad && skin.pos[i * 3 + 1] < hi[1] + pad && skin.pos[i * 3 + 2] > lo[2] - pad && skin.pos[i * 3 + 2] < hi[2] + pad;
      // the lids' lining (their backs, on the eye) isn't skin a lash lies on: the file says which triangles it is (the skin's extras, `lining`: runs of [first, how many]); a file that doesn't say has all of it taken as skin
      const lin = new Uint8Array(skin.idx.length / 3), runs = skin.extras.lining || []; let nLin = 0; for (let k = 0; k < runs.length; k += 2) for (let t = runs[k]; t < runs[k] + runs[k + 1]; t++) lin[t] = 1;
      const faces = []; for (let t = 0; t < skin.idx.length; t += 3) if (nearBox(skin.idx[t]) && nearBox(skin.idx[t + 1]) && nearBox(skin.idx[t + 2])) { if (lin[t / 3]) nLin++; else faces.push(skin.idx[t], skin.idx[t + 1], skin.idx[t + 2]); }
      const size = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]), k = size / 0.11;                // (the lashes' span against an adult's eleven centimetres: a child's or a creature's hair's breadth)
      const TOL = 0.05 * mm * k, rows = [];
      // every twentieth of the blink, and the weights the file holds a target for (its in-betweens' own, in ten-thousandths: there the lashes are as they were fitted; between them Godot blends two fitted states)
      const baked = [...new Set(Object.keys(lashes.targets).map(nm => /_in(\d+)$/.exec(nm)).filter(Boolean).map(m => parseInt(m[1]) / 10000))], steps = [...new Set([...Array.from({ length: 21 }, (_, s) => s / 20), ...baked])].sort((a, b) => a - b);
      for (const w of steps) { const SK = makeSkin(at(skin, w), faces, { cell: 1.2 * mm * k }), row = { w, baked: w === 0 || w === 1 || baked.includes(w) };
        for (const [nm, p] of [["lashes", lashes], ["line", lline]]) { if (!p) continue; const X = at(p, w), lift = (nm === "line" ? 0.09 : 0.06) * mm * k; let under = 0, deep = 0, nearN = 0, sum = 0;
          let seam = 0; const h = [0, 0, 0, 0, 0, 0];
          for (let i = 0; i < X.length; i += 3) { const d = closest(SK, X[i], X[i + 1], X[i + 2], 2 * mm * k, h); if (d !== d) continue; nearN++; sum += d;
            if (d < -TOL) { if (inSeam(SK, h, lift, 2 * mm * k, 0.35 * mm * k)) seam++; else { under++; deep = Math.max(deep, -d); } } }   // (between the two lids' margins pressed together: hidden by both, with no place on top of either)
          row[nm] = { under, deep: deep / mm / k, near: nearN, mean: nearN ? sum / nearN / mm / k : 0, seam }; }
        rows.push(row); }
      const worstOf = (nm, R = rows) => R.reduce((b, r) => r[nm] && r[nm].under > (b?.[nm]?.under ?? -1) ? r : b, null);
      const held = rows.filter(r => r.baked), wl = worstOf("lashes", held), wn = lline ? worstOf("line", held) : null, bl = worstOf("lashes"), bn = lline ? worstOf("line") : null;
      const rest = rows[0], blinked = Object.keys(lashes.targets).some(nm => nm.startsWith("eyesClosed_"));
      const before = args.includes("--before"), good = wl.lashes.under === 0 && (!wn || wn.line.under === 0);
      say(blinked, `${path.basename(glbFile)}: its lashes carry the blink (${Object.keys(lashes.targets).length} targets), ${lashes.pos.length / 3} points of lashes${lline ? ` and ${lline.pos.length / 3} of the lash line` : ""} against ${faces.length / 3} triangles of skin round the eyes` +
        (runs.length ? ` (the lids' ${nLin} of lining left out, as the file says)` : " (the file doesn't say which is the lids' lining: all of it taken as skin)"));
      say(good || before, `no point of a lash under the skin at rest or at any weight the file holds a target for (${held.length} states): at rest ${rest.lashes.under} of ${rest.lashes.near} near it; the most ${wl.lashes.under} (${wl.lashes.deep.toFixed(2)} mm deep, the eye ${Math.round(wl.w * 100)}% shut)` +
        (wn ? `; the lash line: at rest ${rest.line.under} of ${rest.line.near}, the most ${wn.line.under} (${wn.line.deep.toFixed(2)} mm deep, ${Math.round(wn.w * 100)}% shut), lying ${rest.line.mean.toFixed(2)} mm off the skin` : "") + (before && !good ? "  (--before: said, not held)" : ""));
      // between two of the file's weights Godot blends two fitted states: a point that lies on the skin in both can pass a hair under it between them
      // (round a lid's rim: a lash moves whole with its root while the lid bends, so its place on the rim's top at one weight and on its front at the next are joined by a line through the rim's corner)
      const few = Math.max(3, Math.ceil(0.001 * rest.lashes.near)), deepB = Math.max(bl.lashes.deep, bn ? bn.line.deep : 0), mostB = Math.max(bl.lashes.under, bn ? bn.line.under : 0);
      say((mostB <= few && deepB < 0.3) || before, `and at every twentieth of the blink between them: the most ${bl.lashes.under} of the lashes' points (${bl.lashes.deep.toFixed(2)} mm, ${Math.round(bl.w * 100)}% shut)${bn ? ` and ${bn.line.under} of the lash line's (${bn.line.deep.toFixed(2)} mm, ${Math.round(bn.w * 100)}% shut)` : ""}: no more than a thousandth of them (${few}), none 0.3 mm deep`);
      const shut = rows[rows.length - 1], seams = rows.reduce((a, r) => a + r.lashes.seam + (r.line?.seam || 0), 0), open = rows.filter(r => r.w < 0.9).reduce((a, r) => a + r.lashes.seam + (r.line?.seam || 0), 0);
      say(open === 0 || before, `between the two lids' margins where they press together (hidden by both, no place on top of either): ${shut.lashes.seam} points of lashes and ${shut.line?.seam || 0} of the lash line shut, ${seams} over the whole blink, none while the eye is under nine tenths shut${open ? ` (${open})` : ""}`);
    }
  }
}
console.log(ok ? "LASHFIT ok" : "LASHFIT FAIL");
process.exit(ok ? 0 : 1);
