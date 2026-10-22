// The salon's starting points (docs/SALON.md, Presets): hairstyles laid out rough on purpose, in layers, to be finished by
// gravity (the Gravity switch, with friction): sheets rooted in rows round the head (the nape, the back, the crown, above
// the ears, the temples), each combed its way (down and out, forward for a fringe, to the side for curtains) and as long as
// the style says, the left side mirrored to the right (twins), the top a parting of Y's (the cover), a fringe where the
// style has one. Built on the head shown (any MHR body), so they fit it; Layer by height on, so the rows lie in order.
// Plain arrays, no three.js.
//
//   PRESETS: [{id, label, who, length}]       buildPreset(id, col) -> {locks, groups, layering, roots}
import { add, sub, mul, norm, len, length, makeSheet, mirrored, partingCover, onScalp } from "./salonlib.js";

const D = Math.PI / 180;
const dir = (az, el) => [Math.sin(az * D) * Math.cos(el * D), Math.sin(el * D), Math.cos(az * D) * Math.cos(el * D)];   // az 0 the front, 90 the left
const at = (col, az, el) => col.surface(add(col.C, mul(dir(az, el), 0.1)));
const rootLine = (col, a, b, n = 5) => Array.from({ length: n }, (_, i) => at(col, a[0] + (b[0] - a[0]) * i / (n - 1), a[1] + (b[1] - a[1]) * i / (n - 1)));

// which way a lock is combed from its root's middle p: down (and a little out), forward (a fringe), to its side, away from
// the face's middle (a parting; side +1 the left, -1 the right), back
function wayOf(kind, p, col, side = 1) {
  const n = col.normal(p), out = norm([n[0], 0, n[2]]);
  if (kind === "forward") return norm([0, -0.75, 1]);
  if (kind === "side") return norm(add(add(mul(out, 0.4), [side * 0.9, 0, 0]), [0, -1, 0]));
  if (kind === "part") return norm([side * 0.7, 0.1, -0.7]);                // from a parting: to its side and back over the head, off the face
  if (kind === "frame") return norm([side * 0.55, -1, -0.12]);               // by the face: down outside it
  if (kind === "curtain") return norm([side * 0.95, -0.8, 0.35]);            // curtains: out from the middle, forward and down
  if (kind === "back") return norm(add(mul(out, 0.3), [0, -0.6, -0.8]));
  return norm(add(mul(out, kind === "out" ? 0.8 : 0.35), [0, -1, 0]));
}
// a sheet rooted from (az, el) a to b, combed `way`, its middle `L` long (the end moved until the draped lock is)
function sheet(col, a, b, L, o = {}) {
  const root = rootLine(col, a, b), mid = root[2], w = wayOf(o.way || "down", mid, col, o.side);
  const spread = Math.max(0.01, length(root) * (o.spread ?? 1.25));
  let d = L, lock = null;
  for (let it = 0; it < 4; it++) {
    lock = makeSheet(root, add(mid, mul(w, d)), spread, col, { name: o.name, group: o.group, taper: o.taper ?? 0.35, ctrl: Math.max(6, Math.min(14, Math.round(L / 0.06) + 1)) });
    const got = length(lock.edges[1]); if (Math.abs(got - L) < 0.003) break; d *= L / got;
  }
  return lock;
}
// the scalp covered in rows (s.rows, s.width; s.jitter: how much each sheet's length varies, so the ends don't line up): at each elevation (degrees over the skull's middle, the nape to the top), sheets about `width`
// degrees round on the left side from the front-most root on the scalp back to the middle of the back, each mirrored to
// the right (so the two sides meet at the back and, high up, at a middle parting); each sheet's comb, length and group
// from the style: s.lock(az, el) -> {way, L | cut (the tips' height, head space), group, taper, spread} or null to skip
function cap(col, out, s) {
  const on = (az, el) => onScalp(at(col, az, el), col.C);
  for (const el of s.rows) {
    const runs = []; let start = null;                                 // where the row is on the scalp (round the ear: a run each side)
    for (let az = 0; az <= 180; az += 2) { const ok = on(az, el); if (ok && start == null) start = az; if ((!ok || az === 180) && start != null) { const end = ok ? 180 : az - 2; if (end - start >= 6) runs.push([start, end]); start = null; } }
    for (const [r0, r1] of runs) {
    const n = Math.max(1, Math.round((r1 - r0) / s.width));
    for (let i = 0; i < n; i++) {
      const a = r0 + (r1 - r0) * i / n, b = r0 + (r1 - r0) * (i + 1) / n, m = (a + b) / 2;
      const k = s.lock(m, el); if (!k) continue;
      const mid = at(col, m, el), jig = 1 + (s.jitter ?? 0.12) * (Math.sin(m * 12.9898 + el * 78.233) * 0.5);   // each a little longer or shorter: uneven ends
      const L = (k.L ?? Math.max(0.03, (mid[1] - k.cut) * 1.05 + 0.04)) * jig;
      const l = sheet(col, [a, el], [b, el], L, { way: k.way, side: 1, group: k.group, name: `${k.group} ${el}° ${Math.round(m)}°`, taper: k.taper, spread: k.spread });
      const t = mirrored(l, 0, col); t.name = l.name + " (mirror)";
      out.push(l, t);
    }
    }
  }
}
// the styles: lengths in metres along the hair from its root, cuts as the tips' height (head space: 0 about the ears,
// -0.1 the chin, -0.25 the shoulders, -0.55 the waist's top)
const WOMEN_ROWS = [-28, -8, 12, 32, 50, 66], MEN_ROWS = [-26, -12, 2, 16, 30, 45, 60];   // above them, the top: a parting of Y's
const FRONT = (az, el) => az < 40 && el >= 28;                       // the band behind the front hairline
const BY_FACE = (az, el) => az < 80 && el >= 8;                      // the temples, in front of the ears
const womansGroup = (az, el) => FRONT(az, el) ? "fringe" : el >= 46 ? "top" : az < 100 && el >= 8 ? "sides" : "back";
// a woman's style: tips at `cut`; the front band from the parting (or `front`: a fringe or curtains, its tips at frontCut), the
// temples by the face (or cut at `face`, sidelocks), the crown's front from the parting, the rest down
function woman(cut, o = {}) {
  return (az, el) => {
    const g = womansGroup(az, el);
    if (FRONT(az, el) && o.front) return { way: o.front, cut: typeof o.frontCut === "function" ? o.frontCut(az) : o.frontCut, group: "fringe", taper: 0.15, spread: 1.15 };
    if (FRONT(az, el) || (el >= 46 && az < 100 && !(o.front && az < 75))) return { way: "part", cut, group: g === "fringe" ? "top" : g };   // (with a fringe, the temples hang by the face)
    if (BY_FACE(az, el)) return { way: "frame", cut: o.face ?? cut, group: "sides", taper: o.face ? 0.08 : 0.35 };
    return { way: "down", cut, group: g };
  };
}
// a man's style: `side` long under `split` degrees up, `top` long above it, the front combed `front`
function man(side, top, o = {}) {
  return (az, el) => {
    if (el < (o.split ?? 30)) return { way: "down", L: side * (el < 0 ? 0.8 : 1), group: el < 0 ? "back" : "sides", taper: 0.5 };
    if (az < (o.frontAz ?? 55)) return o.frontCut != null ? { way: o.front || "forward", cut: typeof o.frontCut === "function" ? o.frontCut(az) : o.frontCut, group: "fringe", taper: 0.45, spread: 1.2 } : { way: o.front || "forward", L: o.frontL ?? top, group: "fringe", taper: 0.45, spread: 1.2 };
    return { way: "down", L: top * (az > 120 ? 0.8 : 0.9), group: "top", taper: 0.5 };
  };
}
const STYLES = {
  w_long: { label: "Long, straight, middle parting", who: "women", length: 0.55, roots: { lift: 30, length: 0.02 },
    build: (col, out) => { cap(col, out, { rows: WOMEN_ROWS, width: 40, lock: woman(-0.55) }); return { parting: { from: 0.04, to: 0.62, length: 0.62 } }; } },
  w_long_bangs: { label: "Long with blunt bangs", who: "women", length: 0.5, roots: { lift: 30, length: 0.02 },
    build: (col, out) => { cap(col, out, { rows: WOMEN_ROWS, width: 40, lock: woman(-0.5, { front: "forward", frontCut: 0.035 }) }); return { parting: { from: 0.36, to: 0.62, length: 0.58 } }; } },
  w_hime: { label: "Hime cut (blunt bangs, cheek-length sidelocks)", who: "women", length: 0.5, roots: { lift: 30, length: 0.02 },
    build: (col, out) => { cap(col, out, { rows: WOMEN_ROWS, width: 40, lock: woman(-0.5, { front: "forward", frontCut: 0.035, face: -0.11 }) }); return { parting: { from: 0.36, to: 0.62, length: 0.58 } }; } },
  w_chest_curtains: { label: "Chest length, curtain bangs", who: "women", length: 0.36, roots: { lift: 30, length: 0.02 },
    build: (col, out) => { cap(col, out, { rows: WOMEN_ROWS, width: 40, lock: woman(-0.36, { front: "curtain", frontCut: az => 0.03 - 0.1 * az / 40 }) }); return { parting: { from: 0.36, to: 0.62, length: 0.42 } }; } },
  w_shoulder: { label: "Shoulder length, middle parting", who: "women", length: 0.24, roots: { lift: 30, length: 0.02 },
    build: (col, out) => { cap(col, out, { rows: WOMEN_ROWS, width: 40, lock: woman(-0.2) }); return { parting: { from: 0.04, to: 0.62, length: 0.27 } }; } },
  m_crop: { label: "Short crop", who: "men", length: 0.06, roots: { lift: 12, length: 0.01 },
    build: (col, out) => { cap(col, out, { rows: MEN_ROWS, width: 45, jitter: 0.25, lock: man(0.04, 0.06, { frontL: 0.05 }) }); return { parting: { from: 0.18, to: 0.66, length: 0.065 } }; } },
  m_two_block: { label: "Two-block, fringe down", who: "men", length: 0.11, roots: { lift: 15, length: 0.012 },
    build: (col, out) => { cap(col, out, { rows: MEN_ROWS, width: 45, jitter: 0.2, lock: man(0.025, 0.11, { split: 24, frontCut: 0.03 }) }); return { parting: { from: 0.3, to: 0.66, length: 0.11 } }; } },
  m_curtains: { label: "Middle-part curtains", who: "men", length: 0.13, roots: { lift: 18, length: 0.015 },
    build: (col, out) => { cap(col, out, { rows: MEN_ROWS, width: 45, jitter: 0.2, lock: man(0.035, 0.12, { front: "curtain", frontCut: az => 0.03 - 0.06 * az / 50, frontAz: 50 }) }); return { parting: { from: 0.0, to: 0.66, length: 0.12 } }; } },
};
export const PRESETS = Object.entries(STYLES).map(([id, s]) => ({ id, label: s.label, who: s.who, length: s.length }));

const GROUPS = [["back", "Back"], ["sides", "Sides"], ["top", "Top"], ["fringe", "Fringe"], ["cover", "Cover"]];
export function buildPreset(id, col) {
  const s = STYLES[id]; if (!s) throw new Error(`no preset ${id}`);
  const locks = [], r = s.build(col, locks) || {};
  if (r.parting) locks.push(...partingCover(col, Object.assign({ group: "cover" }, r.parting)));
  const used = new Set(locks.map(l => l.group));
  return { locks, groups: GROUPS.filter(([g]) => used.has(g)).map(([id, name]) => ({ id, name, visible: true })), layering: true, roots: s.roots || null };
}
