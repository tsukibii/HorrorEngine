// teeth.js: teeth, gums and a simple tongue for MHR's face (MHR has none: its lips are sealed by a membrane that stretches
// when the mouth opens). Plain arrays, no three.js, so node can build them too (studiotest.js measures them in the page).
//
// An adult's average teeth (crown sizes in mm, after the usual dental tables), seven a side on each jaw, set along an arch
// by their widths. The frame: millimetres, x the character's left, y up, z forward; the origin on the midline, at the
// upper incisors' biting edge, z = 0 their front face. The upper arch is fixed to the skull, the lower (with the tongue)
// rides the jaw. index.html sizes the frame to the neutral mouth's width and sets it behind the lips.

// [name, width along the arch, crown height, thickness, kind]
const UPPER = [["central", 8.5, 10.5, 7, "incisor"], ["lateral", 6.5, 9, 6, "incisor"], ["canine", 7.5, 10, 8, "canine"],
               ["premolar1", 7, 8.5, 9, "premolar"], ["premolar2", 6.5, 8, 9, "premolar"], ["molar1", 10, 7.5, 11, "molar"], ["molar2", 9, 7, 10.5, "molar"]];
const LOWER = [["central", 5.3, 9, 6, "incisor"], ["lateral", 5.9, 9.5, 6.2, "incisor"], ["canine", 6.8, 11, 7.5, "canine"],
               ["premolar1", 7, 8.5, 8, "premolar"], ["premolar2", 7, 8, 8.5, "premolar"], ["molar1", 11, 7.5, 10.5, "molar"], ["molar2", 10.5, 7, 10]];
// the upper teeth's centre line, half of it (x >= 0, z back from the front face): 33 mm across the canines, 48 across the
// first molars
const ARCH = [[0, -3.5], [4.4, -4], [10.5, -6], [15.6, -9.6], [19, -15], [21.3, -21], [23.5, -28.5], [25.5, -38], [26.8, -47], [27.6, -56]];
export const LOWER_ARCH = { sx: 0.95, dz: -2.6, over: 1.6 };   // the lower arch: a little narrower, behind the upper incisors (overjet), their edges 1.6 mm above the upper's (overbite)
// ---- the v2 mouth (DECISIONS 2026-11-13, better mouths: "a v2 mouth interior that's more feminine and looks 1:1 with the
// image shared, even the person realistic tongue ... i hate gummy smiles"). A young woman's teeth after the user's
// picture: a little smaller and more even than the tables' average (the laterals nearer the centrals, the canines no
// longer than their neighbours), their corners rounder, whiter; the gum's edge high on the crown and scalloped (up
// over each tooth, a papilla down between two), so a lip that rises in a smile uncovers crown, not gum; the upper
// teeth high under the lip, as hers show under a lip at rest; and a tongue that is a tongue (V2.tongue)
// (a sixth number: how far a tooth's biting edge stops short of the central incisors' line, mm: the laterals a little
// shorter, the line rising toward the back, as a smile's does)
const UPPER2 = [["central", 8.3, 10.8, 6.8, "incisor", 0], ["lateral", 6.9, 10, 6, "incisor", 0.7], ["canine", 7.3, 10.2, 7.6, "canine", 0.4],
                ["premolar1", 6.8, 8.6, 8.8, "premolar", 0.5], ["premolar2", 6.4, 8.1, 8.8, "premolar", 0.4], ["molar1", 9.8, 7.5, 10.8, "molar", 0], ["molar2", 8.8, 7, 10.2, "molar", 0]];
const LOWER2 = [["central", 5, 8.8, 5.8, "incisor", 0], ["lateral", 5.5, 9, 6, "incisor", 0.1], ["canine", 6.5, 9.8, 7.2, "canine", 0], 
                ["premolar1", 6.8, 8.4, 7.8, "premolar", 0], ["premolar2", 6.8, 8, 8.3, "premolar", 0], ["molar1", 10.8, 7.5, 10.3, "molar", 0], ["molar2", 10.2, 7, 9.8, "molar", 0]];
// (held to her picture by the overlay, docs/research/mouthfit: under a smiling lip only the lower quarter of her upper
// teeth shows, so the frame sits 1.5 mm higher than the classic's and the gum's edge is far up under the lip; her teeth
// are large for her small mouth: `fit`, a mouth narrower than MHR's shrinks them by its square root, not all the way;
// dark corners beside them: `arch`, a narrower, more tapered arch; only the tips of her lower teeth: `over`)
export const V2 = { margin: 0.95, scallop: 0.09, down: -1.5,   // the gum's edge at 0.95 of a crown's height (the classic: 0.78), dipping 0.09 of it between two teeth; the whole frame 1.5 mm higher against the lips
                    arch: 0.85, over: -1.9, fit: 0.5, tongueTop: 7.2, lean: 0.4,   // the arch's width against the classic's; the lower teeth's edges under the upper's at rest (mm; the classic 1.6 above); the tongue's top over the frame's origin; how far the upper teeth's shading leans up (enamel scatters light: under a lamp from above they are not grey)
                    gum: 0xd98f93, tongue: 0xaa547a, cavity: 0x3a1114 };   // a healthy pink gum, a rose tongue, the dark red behind them
export const TEETH_STYLES = { classic: "Classic (an adult's average)", v2: "v2 (a young woman's: even, rounded, little gum, a real tongue)" };
export const TEETH_DEFAULTS = { on: true, style: "classic", shade: 0.35, size: 1, forward: 0, up: 0, tongue: true, curl: 0.5, fangs: 0, points: 0 };   // (curl: the lower lip's, index.html; fangs, points: a creature's teeth, below)

function arch(sx = 1, dz = 0) {                         // the centre line sampled finely, with its length along it
  const P = []; for (let i = 0; i < ARCH.length - 1; i++) {
    const p0 = ARCH[Math.max(0, i - 1)], p1 = ARCH[i], p2 = ARCH[i + 1], p3 = ARCH[Math.min(ARCH.length - 1, i + 2)];
    for (let k = 0; k < 16; k++) {                    // Catmull-Rom between p1 and p2
      const t = k / 16, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      P.push([f(i ? p0[0] : -p2[0], p1[0], p2[0], p3[0]) * sx, f(i ? p0[1] : p2[1], p1[1], p2[1], p3[1]) + dz]);   // mirrored before the midline: flat across it
    }
  }
  const last = ARCH[ARCH.length - 1]; P.push([last[0] * sx, last[1] + dz]);
  const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { P, S };
}
function along({ P, S }, s) {                          // the point at length s along the line (x >= 0), the line's direction, its outward normal
  let i = 1; while (i < S.length - 1 && S[i] < s) i++;
  const t = Math.min(1, Math.max(0, (s - S[i - 1]) / (S[i] - S[i - 1] || 1))), a = P[i - 1], b = P[i];
  const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1, tx = d[0] / l, tz = d[1] / l;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx, tz, nx: -tz, nz: tx };   // the normal points out of the mouth
}

// a crown: rings of a rounded rectangle from the biting edge to the gum, closed at both ends. The ring's width and
// thickness change with the height by kind: an incisor is a blade at its edge, a canine comes to a point
const RING = 14;
function shapeAt(kind, v, sharp = 0, soft = 0) {       // v: 0 the edge, 1 the gum -> [width, thickness] as parts of the full size; soft: the v2 mouth's rounder teeth
  const e = Math.min(1, v / 0.55), s = e * (2 - e);    // eased up from the edge
  if (soft && !sharp) {                                 // a young woman's: the incisors' corners rounded off, the canine a soft point no longer than its neighbours
    const r = Math.sqrt(Math.min(1, v / 0.3)), nk = 0.16 * Math.max(0, v - 0.72) / 0.28;
    if (kind === "incisor") return [0.6 + 0.4 * r - nk, 0.3 + 0.7 * s];           // the edge's two corners rounded: a scalloped smile line
    if (kind === "canine") return [0.46 + 0.54 * Math.sqrt(Math.min(1, v / 0.4)) - nk, 0.45 + 0.55 * s];
    if (kind === "premolar") return [0.66 + 0.34 * Math.sqrt(Math.min(1, v / 0.3)) - 0.15 * Math.max(0, v - 0.75) / 0.25, 0.75 + 0.25 * s];
  }
  const pt = 1 - sharp * (1 - Math.min(1, v / 0.6)), k = [1 - 0.8 * (1 - pt), 1 - 0.55 * (1 - pt)];   // sharp (a fang, a pointed tooth): drawn in to a point toward the edge
  if (kind === "incisor") return [(0.92 + 0.08 * s - 0.2 * Math.max(0, v - 0.7) / 0.3) * k[0], (0.28 + 0.72 * s) * k[1]];
  if (kind === "canine") return [(0.4 + 0.6 * Math.min(1, v / 0.45) - 0.2 * Math.max(0, v - 0.7) / 0.3) * k[0], (0.45 + 0.55 * s) * k[1]];
  if (kind === "premolar") return [(0.8 + 0.2 * s - 0.15 * Math.max(0, v - 0.75) / 0.25) * k[0], (0.75 + 0.25 * s) * k[1]];
  return [(0.88 + 0.12 * s - 0.1 * Math.max(0, v - 0.8) / 0.2) * k[0], (0.85 + 0.15 * s) * k[1]];
}
// o: a creature's teeth (DECISIONS 2026-11-10, night): `fangs` 0..1 the canines longer past the biting edge (the upper
// 7 mm at 1, the lower 4.5) and sharper; `points` 0..1 every tooth drawn to a point, the front ones a little longer
function pushCrown(out, at, [, w, h, t, kind, back = 0], up, edgeY0, shade, o = {}) {
  const soft = o.style === "v2" ? 1 : 0, edgeY = edgeY0 + up * back, lowDim = soft && up < 0 ? 0.86 : 1;   // (back: the v2 tables' sixth number; the v2 lower teeth a little dimmer: under the upper lip's and the tongue's shade)
  const base = out.pos.length / 3, rows = 7, fang = kind === "canine" ? o.fangs || 0 : 0, pts = o.points || 0;
  const ext = fang * (up > 0 ? 7 : 4.5) + pts * (kind === "incisor" ? 1.6 : kind === "canine" ? 1.2 : kind === "premolar" ? 0.8 : 0.4), sharp = Math.min(1, Math.max(fang, pts));
  for (let r = 0; r <= rows; r++) {
    const v = r / rows, [kw, kt] = shapeAt(kind, Math.max(0.04, v), sharp, soft), y = edgeY - up * ext + up * v * (h + ext);
    for (let k = 0; k < RING; k++) {
      const a = k / RING * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const u = Math.sign(c) * Math.pow(Math.abs(c), 0.6) * w / 2 * kw, n = Math.sign(s) * Math.pow(Math.abs(s), 0.6) * t / 2 * kt;   // a superellipse: squarish, rounded
      out.pos.push(at.x + at.tx * u + at.nx * n, y, at.z + at.tz * u + at.nz * n);
      // enamel is never plain white: translucent blue-grey at a front tooth's biting edge (light passes through it),
      // warmer at the gum, darker at the sides where the teeth meet (the gaps), the back teeth in the mouth's shadow
      const g = soft ? lowDim * (0.6 + 0.4 * shade) * (0.92 + 0.08 * (1 - v)) * (1 - 0.1 * Math.pow(Math.abs(c), 6))   // (the v2 mouth's: brighter, the gaps and the back teeth less dark: a lit smile)
                     : shade * (0.84 + 0.16 * (1 - v)) * (1 - 0.32 * Math.pow(Math.abs(c), 4));
      const edge = (kind === "incisor" || kind === "canine" ? 0.6 * Math.pow(Math.max(0, 1 - v / 0.3), 1.5) : 0) * (soft ? 0.45 : 1);   // (the v2 mouth's: young enamel, less of the grey edge)
      const gum = Math.max(0, (v - 0.7) / 0.3);
      out.col.push(g * (1 - 0.24 * edge) * (1 + 0.02 * gum), g * (1 - 0.14 * edge) * (1 - 0.03 * gum), g * (1 - 0.03 * edge) * (1 - 0.12 * gum));
    }
  }
  const t0 = out.idx.length;
  for (let r = 0; r < rows; r++) for (let k = 0; k < RING; k++) {
    const a = base + r * RING + k, b = base + r * RING + (k + 1) % RING, c = a + RING, d = b + RING;
    out.idx.push(a, c, b, b, c, d);
  }
  for (const [r, dir] of [[0, -1], [rows, 1]]) {       // the ends: a fan to the middle, nudged out so the edge is rounded
    const m = out.pos.length / 3, y = edgeY - up * ext + up * (r / rows * (h + ext) + dir * 0.6 * (r ? 1 : 1 - 0.7 * sharp));
    out.pos.push(at.x, y, at.z); out.col.push(shade, shade, shade);
    for (let k = 0; k < RING; k++) out.idx.push(base + r * RING + k, base + r * RING + (k + 1) % RING, m);
  }
  const mid = [at.x, edgeY - up * ext + up * (h + ext) / 2, at.z];
  orient(out, t0, () => mid);
}
// every triangle from t0 on turned to face away from its middle (mirroring and the lower jaw flip the winding)
function orient(out, t0, middle) {
  const P = out.pos, I = out.idx;
  for (let t = t0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map(i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const g = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], o = middle(t, g);
    if (n[0] * (g[0] - o[0]) + n[1] * (g[1] - o[1]) + n[2] * (g[2] - o[2]) < 0) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
  }
}
// the gums: a rounded band swept along the arch over the crowns' necks, from the last tooth on one side to the other
function pushGum(out, line, teeth, up, edgeY, shade, o = {}) {
  const v2 = o.style === "v2", half = teeth.reduce((s, x) => s + x[1], 0) + 1.5, steps = v2 ? 168 : 64, prof = 9, base = out.pos.length / 3, necks = [];
  const at = s => { let acc = 0; for (const x of teeth) { if (s <= acc + x[1]) return [x, (s - acc) / x[1]]; acc += x[1]; } return [teeth[teeth.length - 1], 0.5]; };
  for (let q = 0; q <= steps; q++) {
    const s = -half + 2 * half * q / steps, side = s < 0 ? -1 : 1, p = along(line, Math.abs(s)), [[, , h, t], u] = at(Math.abs(s));
    // the gum's edge: at 0.78 of the crown; the v2 mouth's high on it and scalloped (highest over a tooth's middle, a papilla between two)
    const x = p.x * side, tx = p.tx * side, nx = p.nx * side, neck = edgeY + up * h * (v2 ? V2.margin - V2.scallop * Math.pow(Math.abs(2 * u - 1), 2.2) : 0.78);
    const bk = Math.min(1, Math.abs(s) / half), g = shade * (1 - 0.55 * bk);   // darker toward the back
    necks.push([x, neck, p.z]);
    for (let k = 0; k < prof; k++) {                  // a U over the necks: out, over the top, back in
      const a = Math.PI * k / (prof - 1), n = Math.cos(a) * (t / 2 + 1.3), lift = Math.sin(a) * 4.5 + (1 - Math.sin(a)) * 0.3;
      out.pos.push(x + nx * n, neck + up * lift, p.z + p.nz * n); out.col.push(g, g * 0.92, g * 0.92);
    }
    void tx;
  }
  const t0 = out.idx.length;
  for (let q = 0; q < steps; q++) for (let k = 0; k < prof - 1; k++) {
    const a = base + q * prof + k, b = a + 1, c = a + prof, d = c + 1;
    out.idx.push(a, b, c, b, d, c);
  }
  orient(out, t0, t => necks[Math.floor((t - t0) / 6 / (prof - 1))]);
}
function pushTongue(out, frontZ, topY, halfW) {         // an ellipsoid, flattened on top with a groove, narrower at the tip
  const base = out.pos.length / 3, U = 24, V = 14, L = 26, Hh = 7.5, cz = frontZ - L, cy = topY - Hh * 0.6;
  for (let i = 0; i <= V; i++) {
    const th = Math.PI * i / V, sy = Math.cos(th), r = Math.sin(th);
    for (let j = 0; j < U; j++) {
      const ph = 2 * Math.PI * j / U, sx = r * Math.cos(ph), sz = r * Math.sin(ph);
      const w = halfW * (1 - 0.4 * Math.max(0, sz) ** 2);   // narrower toward the tip (+z)
      let y = sy * Hh * (sy > 0 ? 0.6 : 1); if (sy > 0) y -= 1.6 * Math.exp(-(sx * sx) / 0.03) * sy;   // the top flatter, a groove down its middle
      out.pos.push(sx * w, cy + y, cz + sz * L);
      const g = 0.75 + 0.25 * Math.max(0, sz); out.col.push(g, g, g);   // darker toward the back
    }
  }
  const t0 = out.idx.length;
  for (let i = 0; i < V; i++) for (let j = 0; j < U; j++) {
    const a = base + i * U + j, b = base + i * U + (j + 1) % U, c = a + U, d = b + U;
    out.idx.push(a, b, c, b, d, c);
  }
  orient(out, t0, () => [0, cy, cz]);
}

// the v2 mouth's tongue (after the user's picture: a broad, soft, rose tongue filling the floor of an open mouth, its
// top a little under the upper teeth's edges, its tip behind the lower incisors). Sections along its length, front to
// back: a rounded blade that widens to the body and narrows to the root, the top domed with a shallow groove down the
// middle that dies out before the tip, the sides rolled, the underside tucked in; the tip turned down behind the
// teeth, the back falling away into the throat. `uv` (across, along) for its papillae's bump (index.html)
function pushTongue2(out, frontZ, topY) {
  // (her picture, docs/research/mouthfit: a broad tongue lying over the lower side teeth, domed across with a groove down
  // its middle, sloping down toward a thin tip behind the lower incisors: from the front its top is what shows, not a
  // front wall)
  const base = out.pos.length / 3, U = 32, V = 34, L = 46, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hwAt = f => 22 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.2 + 0.8 * Math.pow(f / 0.45, 0.6)) / 2), 0.8) * (1 - 0.28 * sm(0.62, 1, f));   // a round tip a finger wide, broadening to the blade over the side teeth
  const thAt = f => 2.2 + 10.3 * sm(0, 0.5, f);                                     // a thin tip, a body further back
  const topAt = f => topY - 6.5 * Math.pow(1 - sm(0, 0.42, f), 1.6) - 9 * Math.pow(sm(0.58, 1, f), 1.6);   // the tip sloping down to the lower teeth, the back falling into the throat
  out.uv = out.uv || [];
  for (let i = 0; i <= V; i++) {
    const f = i / V, z = frontZ - f * L, hw = hwAt(f), th = thAt(f), top = topAt(f);   // 0 the tip, 1 the root
    for (let j = 0; j < U; j++) {
      const a = 2 * Math.PI * j / U, c = Math.cos(a), s = Math.sin(a), ex = Math.sign(c) * Math.pow(Math.abs(c), 0.7), edge = 3.4 * (0.35 + 0.65 * ex * ex);   // domed across: its sides 3.4 mm under its middle
      let x = hw * ex, y = s > 0 ? top - edge * (1 - Math.pow(Math.max(0, s), 0.6)) : top - edge + s * th * (1 - 0.45 * ex * ex);   // (thinner toward its sides underneath: it lies over the side teeth)
      const gr = Math.exp(-(x * x) / 5) * sm(0.06, 0.24, f) * (1 - sm(0.3, 0.52, f));   // (the groove fades out before the dome's highest part: no notch in its outline from the front)
      if (s > 0) y -= 0.9 * gr * s - 0.7 * Math.exp(-Math.pow((Math.abs(x) - 0.5 * hw) / (0.32 * hw + 0.1), 2)) * s * sm(0.1, 0.5, f);   // the groove, and the soft swell either side of it
      if (s < 0) x *= 1 - 0.3 * -s;                                                 // the underside narrower
      out.pos.push(x, y, z); out.uv.push(0.5 + 0.5 * ex * (s >= 0 ? 1 : 0.5), f);
      const g = (0.7 + 0.3 * (1 - sm(0.25, 1, f))) * (s > 0 ? 1 : 0.8) * (1 - 0.2 * (s > 0 ? Math.exp(-(x * x) / 2.2) * sm(0.05, 0.2, f) * (1 - sm(0.42, 0.6, f)) : 0));   // darker toward the root, underneath and in the groove
      out.col.push(g, g * (0.96 + 0.04 * f), g * (0.96 + 0.04 * f));
    }
  }
  const t0 = out.idx.length;
  for (let i = 0; i < V; i++) for (let j = 0; j < U; j++) { const a = base + i * U + j, b = base + i * U + (j + 1) % U, c = a + U, d = b + U; out.idx.push(a, b, c, b, d, c); }
  for (const [i, zc] of [[0, frontZ + 0.6], [V, frontZ - L - 1]]) {                 // the two ends closed
    const m = out.pos.length / 3; let cy = 0; for (let j = 0; j < U; j++) cy += out.pos[(base + i * U + j) * 3 + 1] / U;
    out.pos.push(0, cy, zc); out.uv.push(0.5, i ? 1 : 0); out.col.push(i ? 0.6 : 1, i ? 0.58 : 0.97, i ? 0.58 : 0.97);
    for (let j = 0; j < U; j++) out.idx.push(base + i * U + j, base + i * U + (j + 1) % U, m);
  }
  orient(out, t0, (t, g) => { const f = Math.min(1, Math.max(0, (frontZ - g[2]) / L)); return [0, topAt(f) - 2 - 0.4 * thAt(f), g[2]]; });   // (out from the middle of its own section)
}

// both jaws: { upper: {teeth, gums}, lower: {teeth, gums, tongue} }, each { pos, col, idx } in the frame above
export function buildMouth(o = {}) {                  // o: { fangs, points } (pushCrown), style: "v2" the v2 mouth
  const mesh = () => ({ pos: [], col: [], idx: [] });
  const R = { upper: { teeth: mesh(), gums: mesh() }, lower: { teeth: mesh(), gums: mesh(), tongue: mesh() } };
  const v2 = o.style === "v2", ax = v2 ? V2.arch : 1, over = v2 ? V2.over : LOWER_ARCH.over;
  const up = arch(ax), lo = arch(LOWER_ARCH.sx * ax, LOWER_ARCH.dz);
  for (const [line, teeth, out, dir, edge] of [[up, v2 ? UPPER2 : UPPER, R.upper, 1, 0], [lo, v2 ? LOWER2 : LOWER, R.lower, -1, over]]) {
    let s = 0;
    for (const [n, tooth] of teeth.entries()) {
      const p = along(line, s + tooth[1] / 2), shade = 1 - 0.6 * n / (teeth.length - 1);   // the back teeth in the mouth's shadow
      const e = tooth[4] === "molar" || tooth[4] === "premolar" ? (dir > 0 ? 0.5 : 0) : edge;   // the back teeth meet on one plane, the front overlap
      for (const side of [1, -1]) pushCrown(out.teeth, { ...p, x: p.x * side, tx: p.tx * side, nx: p.nx * side }, tooth, dir, e, shade, o);
      s += tooth[1];
    }
    pushGum(out.gums, line, teeth, dir, v2 ? edge : edge * 0.5, 1, o);   // (the v2 mouth's lower gum measured from its own teeth's edge, as the upper's is)
  }
  if (v2) pushTongue2(R.lower.tongue, LOWER_ARCH.dz - 3 - 2.6, V2.tongueTop);   // its tip 2.6 mm behind the lower incisors, its top to just under the upper teeth's edges in an open smile (her picture: the tongue fills the mouth); in a shut mouth that is behind the upper teeth, where a tongue rests
  else pushTongue(R.lower.tongue, LOWER_ARCH.dz - 3 - 4.5, LOWER_ARCH.over - 4.5, 15);
  return R;
}
// a rigid fit (Horn's quaternion method): the rotation and the shift that best carry points A onto B (flat arrays)
export function rigidFit(A, B, w) {
  const n = A.length / 3, ca = [0, 0, 0], cb = [0, 0, 0]; let sw = 0;
  for (let i = 0; i < n; i++) { const k = w ? w[i] : 1; sw += k; for (let a = 0; a < 3; a++) { ca[a] += k * A[i * 3 + a]; cb[a] += k * B[i * 3 + a]; } }
  for (let a = 0; a < 3; a++) { ca[a] /= sw; cb[a] /= sw; }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) { const k = w ? w[i] : 1; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a][b] += k * (A[i * 3 + a] - ca[a]) * (B[i * 3 + b] - cb[b]); }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const M = [[xx + yy + zz, yz - zy, zx - xz, xy - yx], [yz - zy, xx - yy - zz, xy + yx, zx + xz],
             [zx - xz, xy + yx, -xx + yy - zz, yz + zy], [xy - yx, zx + xz, yz + zy, -xx - yy + zz]];
  const sh = Math.abs(xx) + Math.abs(yy) + Math.abs(zz) + Math.abs(xy) + Math.abs(xz) + Math.abs(yx) + Math.abs(yz) + Math.abs(zx) + Math.abs(zy) + 1e-12;
  let q = [1, 0, 0, 0];
  for (let it = 0; it < 200; it++) {                   // the largest eigenvector, by power iteration on M shifted positive
    const r = [0, 1, 2, 3].map(a => M[a].reduce((s, m, b) => s + m * q[b], 0) + sh * q[a]), l = Math.hypot(...r);
    q = r.map(x => x / l);
  }
  const [w0, x, y, z] = q;
  const R = [[1 - 2 * (y * y + z * z), 2 * (x * y - w0 * z), 2 * (x * z + w0 * y)],
             [2 * (x * y + w0 * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w0 * x)],
             [2 * (x * z - w0 * y), 2 * (y * z + w0 * x), 1 - 2 * (x * x + y * y)]];
  return { R, ca, cb };
}
export function rotVec(R) {                            // a rotation matrix as axis times angle
  const c = Math.min(1, Math.max(-1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)), a = Math.acos(c);
  if (a < 1e-9) return [0, 0, 0];
  const k = a / (2 * Math.sin(a));
  return [(R[2][1] - R[1][2]) * k, (R[0][2] - R[2][0]) * k, (R[1][0] - R[0][1]) * k];
}
