// nails.js: fingernails painted on the skin (the Character Studio's Skin tab, Nails). MHR's fingertips carry no nails
// of their own, so each nail is a place on the skin: found once on MHR's base body (the fingertips as the hand's points
// farthest from the wrist, each finger's axis and its back, the nail's length and width from the finger's own width),
// given to the skin's shader as a coordinate per point (along the nail from its cuticle to its free edge, across it,
// how much a point faces the back of the finger, which finger), and painted there by the shader (skinshader.js): the
// nail plate, its half moon, the free edge, the cuticle and the folds' shadow, fine ridges, a gloss; and the polish
// over it (full, French, half moon, ombré, tips, dots; gloss, matte, chrome, glitter, jelly; an accent nail). It rides
// every body: the shape sliders move the fingers and the nails with them. Plain arrays, no three.js. Our own code.

export const NAIL_DEFAULTS = {
  on: true, tint: 0.5, half: 0.5, free: 0.35, shape: "round", shine: 0.5,          // the nail itself
  paint: false, style: "full", colour: "#b0122e", colour2: "#f4ece6", finish: "gloss", cover: 1, accent: false,   // the polish
};
export const NAIL_SHAPES = ["square", "squoval", "round", "oval", "almond"];
export const NAIL_STYLES = ["full", "French", "half moon", "ombré", "tips", "dots"];
export const NAIL_FINISHES = ["gloss", "matte", "chrome", "glitter", "jelly"];
// [key, label, lo, hi, step, help]
export const NAIL_SLIDERS = [
  ["tint", "Nail bed", 0, 1, 0.01, "How pink the nail looks over its bed (0 the skin's own colour, 1 rosy)."],
  ["half", "Half moon", 0, 1, 0.01, "The pale half moon (lunula) at the nail's base."],
  ["free", "Free edge", 0, 1, 0.01, "The white tip past the nail bed: 0 none (cut short), 1 a long one."],
  ["shine", "Shine", 0, 1, 0.01, "How glossy the bare nail is."],
];
export const NAIL_PRESETS = {
  "bare": { paint: false, tint: 0.5, half: 0.5, free: 0.35, shine: 0.5 },
  "buffed": { paint: false, tint: 0.65, half: 0.6, free: 0.3, shine: 0.95 },
  "clear gloss": { paint: true, style: "full", finish: "jelly", colour: "#f6dfe0", cover: 0.25 },
  "classic red": { paint: true, style: "full", finish: "gloss", colour: "#b0122e", cover: 1 },
  "nude": { paint: true, style: "full", finish: "gloss", colour: "#d9a99a", cover: 0.9 },
  "French": { paint: true, style: "French", finish: "gloss", colour: "#fbf6f0", colour2: "#f3c9c7", cover: 1, free: 0.45 },
  "black": { paint: true, style: "full", finish: "gloss", colour: "#121014", cover: 1 },
  "matte black": { paint: true, style: "full", finish: "matte", colour: "#151316", cover: 1 },
  "chrome": { paint: true, style: "full", finish: "chrome", colour: "#d8dce4", cover: 1 },
  "glitter pink": { paint: true, style: "full", finish: "glitter", colour: "#e0628f", cover: 1 },
  "ombré": { paint: true, style: "ombré", finish: "gloss", colour: "#f7d6dc", colour2: "#c2185b", cover: 1 },
  "half moon": { paint: true, style: "half moon", finish: "gloss", colour: "#7a1530", cover: 1 },
  "pastel dots": { paint: true, style: "dots", finish: "gloss", colour: "#bfe3f2", colour2: "#ffffff", cover: 1, accent: true },
  "jelly berry": { paint: true, style: "full", finish: "jelly", colour: "#9c1f4f", cover: 0.7 },
};
export const FINGERS = ["thumb", "index", "middle", "ring", "little"];

// MHR's fingertips and each nail's frame, on a body P (metres, flat x,y,z) with triangles T. Returns null when the hands
// can't be read (another mesh). attr: per point, (along: 0 the cuticle to 1 the free edge's end, across: -1..1, faces
// the back of the finger 0..1, finger 0..9 or -1 for no nail); fingers: per finger its tip, axis, back, side, the
// nail's length and width (metres).
export function findNails(P, T) {
  const n = P.length / 3;
  let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < P.length; i += 3) { y0 = Math.min(y0, P[i]); y1 = Math.max(y1, P[i]); }
  const H = (y1 - y0) / 1.7;                           // a body's size against 1.7 m: what every distance below is scaled by
  const adj = Array.from({ length: n }, () => []);
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) { const a = T[t + k], b = T[t + (k + 1) % 3]; adj[a].push(b); adj[b].push(a); }
  const d3 = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  const pt = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const mean = ids => { const c = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) c[k] += P[i * 3 + k]; return scale(c, 1 / Math.max(1, ids.length)); };
  const N = new Float64Array(n * 3);                   // the points' normals (area-weighted)
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { N[v] += nx; N[v + 1] += ny; N[v + 2] += nz; }
  }
  const attr = new Float32Array(n * 4); for (let i = 0; i < n; i++) { attr[i * 4] = -9; attr[i * 4 + 3] = -1; }   // no nail (far behind one: a triangle half on a finger blends to nothing)
  const fingers = [];
  for (const side of [1, -1]) {                         // the character's left hand (+x) then the right
    let far = -1, fx = -Infinity; for (let i = 0; i < n; i++) if (P[i * 3] * side > fx) { fx = P[i * 3] * side; far = i; }
    const reg = [], inReg = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (d3(i, far) < 0.2 * H) { reg.push(i); inReg[i] = 1; }
    // the distance along the skin from the wrist (the hand's points about a hand's length from its farthest point)
    const D = new Float64Array(n).fill(Infinity), heap = [];
    const push = (d, i) => { heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let s = c; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === c) break; [heap[s], heap[c]] = [heap[c], heap[s]]; c = s; } } return top; };
    for (const i of reg) if (d3(i, far) > 0.17 * H) { D[i] = 0; push(0, i); }
    while (heap.length) { const [d, i] = pop(); if (d > D[i]) continue; for (const j of adj[i]) if (inReg[j]) { const nd = d + d3(i, j); if (nd < D[j]) { D[j] = nd; push(nd, j); } } }
    // the fingertips: the farthest points along the skin, each the farthest within 9 mm round it (taken farthest first:
    // a point is a tip when no point already taken is that near)
    const tips = [], r = 0.009 * H, grid = new Map(), cell = i => [0, 1, 2].map(k => Math.floor(P[i * 3 + k] / r));
    for (const i of reg.filter(i => isFinite(D[i])).sort((a, b) => D[b] - D[a])) {
      const [cx, cy, cz] = cell(i); let top = true;
      for (let dx = -1; dx <= 1 && top; dx++) for (let dy = -1; dy <= 1 && top; dy++) for (let dz = -1; dz <= 1 && top; dz++)
        for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) if (d3(i, j) < r) { top = false; break; }
      if (top && D[i] > 0.06 * H) tips.push(i);
      const key = `${cx},${cy},${cz}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i);
    }
    if (tips.length < 5) return null;
    const five = tips.slice(0, 5), thumb = five.reduce((a, b) => D[b] < D[a] ? b : a);   // the thumb starts nearest the wrist
    const others = five.filter(i => i !== thumb).sort((a, b) => d3(a, thumb) - d3(b, thumb));   // index, middle, ring, little: away from the thumb
    // the back of the hand: square to its flat (the hand's points' least spread), on the side away from the thumb's
    // pad and the fingers' curl (both lean to the palm)
    const handIds = reg.filter(i => isFinite(D[i]) && D[i] > 0.02 * H), hc = mean(handIds), C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const i of handIds) { const q = sub(pt(i), hc); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += q[a] * q[b]; }
    let v = norm([1, 0.3, 0.2]);                         // the least spread: power iteration on (trace I - C)
    const tr = C[0][0] + C[1][1] + C[2][2];
    for (let it = 0; it < 60; it++) v = norm([0, 1, 2].map(a => tr * v[a] - (C[a][0] * v[0] + C[a][1] * v[1] + C[a][2] * v[2])));
    const palmward = dot(sub(mean([thumb, ...others]), hc), v) + dot(sub(pt(thumb), hc), v);
    const back = palmward > 0 ? scale(v, -1) : v;
    [thumb, ...others].forEach((tip, k) => {
      const id = (side > 0 ? 0 : 5) + k, Dt = D[tip], fing = [], seen = new Uint8Array(n), stack = [tip]; seen[tip] = 1;
      while (stack.length) { const i = stack.pop(); fing.push(i); for (const j of adj[i]) if (!seen[j] && inReg[j] && D[j] >= Dt - 0.03 * H) { seen[j] = 1; stack.push(j); } }
      const ring = (lo, hi) => fing.filter(i => D[i] >= Dt - hi * H && D[i] <= Dt - lo * H);
      const f = norm(sub(mean(ring(0, 0.006)), mean(ring(0.02, 0.028))));   // the finger's axis, toward its tip
      const d = norm(sub(back, scale(f, dot(back, f)))), s = cross(f, d);     // its back, and across it
      let tv = tip, best = -Infinity; for (const i of fing) { const a = dot(pt(i), f); if (a > best) { best = a; tv = i; } }
      const T0 = pt(tv);
      const mid = fing.filter(i => { const a = dot(sub(pt(i), T0), f); return a > -0.01 * H && a < -0.005 * H; }).map(i => dot(sub(pt(i), T0), s));
      const width = mid.length ? Math.max(...mid) - Math.min(...mid) : 0.016 * H;
      const L = width * (k === 0 ? 0.74 : 0.8), W = width * (k === 0 ? 0.78 : 0.74), end = -0.0025 * H;   // the free edge's end where the tip starts to curve down
      for (const i of fing) {                          // along the finger (straight: smooth outlines; a distance along the skin's edges is a polygon)
        const q = sub(pt(i), T0), a = dot(q, f), c = dot(q, s);
        const nn = norm([N[i * 3], N[i * 3 + 1], N[i * 3 + 2]]), up = dot(nn, d);
        attr[i * 4] = (a - (end - L)) / L; attr[i * 4 + 1] = c / (W / 2); attr[i * 4 + 2] = Math.min(1, Math.max(0, (up + 0.15) / 0.4)); attr[i * 4 + 3] = id;
      }
      fingers.push({ id, hand: side > 0 ? "left" : "right", finger: FINGERS[k], vertex: tv, tip: T0, axis: f, back: d, across: s, length: L, width: W, points: fing.length });
    });
  }
  return { attr, fingers };
}
