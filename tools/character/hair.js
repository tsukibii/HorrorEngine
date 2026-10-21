// Hair for the Character Studio: cards grown from the scalp of the body as it is now (any shape, any face), styled by a
// few numbers, kept off the head and shoulders. Plain arrays out (no three.js here), so the page and a check can share it.
//   grow(pos, tris, lm, scale, style) -> { hair: {position, uv, shade, index}, brows: {...}, scalp: [triangle ids], report }
// pos: the body's points (Float32Array, metres, Y up, facing +Z); tris: its triangles; lm(i): MediaPipe landmark i on the
// body now; scale: the body's scale against MHR (sizes below are MHR's, at 1.7 m). Cards: ribbons with an alpha of strands,
// a scalp cap under them in the hair's colour. docs/MHR_PIPELINE_RESEARCH.md phase 4: strands and grooms come later.

export const STYLES = {
  long:  { label: "Long, straight", length: 0.42, bangs: false, tails: "none", part: 0, volume: 0.006, wave: 0 },
  bob:   { label: "Bob with bangs", length: 0.2, cut: "chin", bangs: true, tails: "none", part: 0, volume: 0.012, wave: 0 },
  twin:  { label: "Twin tails", length: 0.34, bangs: true, tails: "twin", part: 0, volume: 0.006, wave: 0.15, tie: 0.75 },
  pony:  { label: "Ponytail", length: 0.3, bangs: false, tails: "pony", part: 0.4, volume: 0.006, wave: 0.1, tie: 0.6 },
  short: { label: "Short", length: 0.07, bangs: false, tails: "none", part: 0.5, volume: 0.008, wave: 0 },
  wavy:  { label: "Long, wavy", length: 0.38, bangs: false, tails: "none", part: 0.3, volume: 0.016, wave: 0.6 },
};
export const DEFAULTS = { style: "long", cards: 900, width: 0.012, bangsAt: -0.006, hairline: 0, color: "#2a1d17", brows: true, lashes: true };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => mul(a, 1 / (len(a) || 1));
const mix = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// the head's frame from the face: X to the character's left, U up the face, F forward; C the skull's middle
function frame(pos, lm, S) {
  const ear = [lm(234), lm(454)], X = norm(sub(ear[1], ear[0]));
  let U = sub(lm(10), lm(152)); U = norm(sub(U, mul(X, dot(U, X))));
  const F = cross(X, U);
  let C = mix(ear[0], ear[1], 0.5);
  let fmin = Infinity, fmax = -Infinity, top = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - C[0], pos[i + 1] - C[1], pos[i + 2] - C[2]];
    if (len(d) > 0.16 * S || dot(d, U) < 0.02 * S) continue;           // the skull above the ears
    const f = dot(d, F); fmin = Math.min(fmin, f); fmax = Math.max(fmax, f); top = Math.max(top, dot(d, U));
  }
  C = add(C, mul(F, (fmin + fmax) / 2));
  return { X, U, F, C, top };
}

// the head as a radial field round C (max radius per direction) and the neck and torso as slices (max radius per sector)
function fields(pos, fr, S) {
  const AZ = 32, EL = 16, head = new Float32Array(AZ * EL);
  const at = d => {
    const r = len(d), el = Math.asin(Math.max(-1, Math.min(1, dot(d, fr.U) / (r || 1)))), az = Math.atan2(dot(d, fr.X), dot(d, fr.F));
    return [Math.min(AZ - 1, Math.floor((az + Math.PI) / (2 * Math.PI) * AZ)), Math.min(EL - 1, Math.floor((el + Math.PI / 2) / Math.PI * EL)), r, el];
  };
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - fr.C[0], pos[i + 1] - fr.C[1], pos[i + 2] - fr.C[2]];
    const [a, e, r, el] = at(d);
    if (r > 0.17 * S || el < -0.35) continue;
    head[e * AZ + a] = Math.max(head[e * AZ + a], r);
  }
  for (let pass = 0; pass < 3; pass++)                                 // fill holes from neighbours
    for (let e = 0; e < EL; e++) for (let a = 0; a < AZ; a++) if (!head[e * AZ + a]) {
      let m = 0; for (const [de, da] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const ee = e + de; if (ee >= 0 && ee < EL) m = Math.max(m, head[ee * AZ + (a + da + AZ) % AZ]); }
      head[e * AZ + a] = m;
    }
  // slices from the chin down to the hips, |x| within the shoulders (the arms stay out)
  const SEC = 24, STEP = 0.015 * S, y0 = fr.C[1] - 0.02 * S, rows = Math.ceil(0.75 * S / STEP);
  const body = new Float32Array(rows * SEC), mid = new Float32Array(rows * 2), cnt = new Float32Array(rows);
  const xl = 0.2 * S;
  for (let i = 0; i < pos.length; i += 3) {
    const r = Math.floor((y0 - pos[i + 1]) / STEP);
    if (r < 0 || r >= rows || Math.abs(pos[i]) > xl) continue;
    mid[r * 2] += pos[i]; mid[r * 2 + 1] += pos[i + 2]; cnt[r]++;
  }
  for (let r = 0; r < rows; r++) if (cnt[r]) { mid[r * 2] /= cnt[r]; mid[r * 2 + 1] /= cnt[r]; }
  for (let i = 0; i < pos.length; i += 3) {
    const r = Math.floor((y0 - pos[i + 1]) / STEP);
    if (r < 0 || r >= rows || Math.abs(pos[i]) > xl) continue;
    const dx = pos[i] - mid[r * 2], dz = pos[i + 2] - mid[r * 2 + 1], s = Math.floor((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * SEC) % SEC;
    body[r * SEC + s] = Math.max(body[r * SEC + s], Math.hypot(dx, dz));
  }
  // hug: a point floating off the head, brought back to gap off it (or null)
  const hug = (p, gap) => {
    const d = sub(p, fr.C), [a, e, r] = at(d), R = head[e * AZ + a] + gap;
    return R > gap && r > R ? add(fr.C, mul(norm(d), R)) : null;
  };
  // push p out of the head and the body, gap off them; returns the point and whether it was moved
  const push = (p, gap) => {
    let moved = false;
    const d = sub(p, fr.C), [a, e, r, el] = at(d);
    if (el > -0.35) {
      const R = head[e * AZ + a] + gap;
      if (R > gap && r < R) { p = add(fr.C, mul(norm(d), R)); moved = true; }
    }
    const row = Math.floor((y0 - p[1]) / STEP);
    if (row >= 0 && row < rows && cnt[row]) {
      const dx = p[0] - mid[row * 2], dz = p[2] - mid[row * 2 + 1], s = Math.floor((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * SEC) % SEC;
      const R = body[row * SEC + s] + gap, rr = Math.hypot(dx, dz);
      if (body[row * SEC + s] && rr < R) { const k = R / (rr || 1e-6); p = [mid[row * 2] + dx * k, p[1], mid[row * 2 + 1] + dz * k]; moved = true; }
    }
    return [p, moved];
  };
  return { push, hug };
}

// the scalp: head triangles above a hairline that runs from the forehead (landmark 10) over the ears to the nape
function scalp(pos, tris, lm, fr, S, hairline) {
  const h = p => dot(sub(p, fr.C), fr.U);
  const front = h(lm(10)) + hairline * S, side = h(mix(lm(105), lm(334), 0.5)) + 0.012 * S, back = -0.08 * S;
  const ok = new Uint8Array(pos.length / 3);
  for (let i = 0; i < ok.length; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], d = sub(p, fr.C);
    if (len(d) > 0.16 * S) continue;
    const az = Math.abs(Math.atan2(dot(d, fr.X), dot(d, fr.F)));
    const line = az < Math.PI / 2 ? front + (side - front) * smooth(az / (Math.PI / 2) * 1.15) : side + (back - side) * smooth((az - Math.PI / 2) / (Math.PI / 2) * 2.4);   // down right behind the ears
    if (dot(d, fr.U) > line) ok[i] = 1;
  }
  const out = [];
  for (let t = 0; t < tris.length; t += 3) if (ok[tris[t]] && ok[tris[t + 1]] && ok[tris[t + 2]]) out.push(t / 3);
  return out;
}

// a ribbon along a polyline: across = the side direction at each point; taper to the tip
function ribbon(G, P, across, width, shade, taper = 0.35) {
  const base = G.position.length / 3, n = P.length;
  for (let k = 0; k < n; k++) {
    const w = width * (1 - (1 - taper) * (k / (n - 1)) ** 1.5) / 2, a = mul(across[k], w);
    G.position.push(...sub(P[k], a), ...add(P[k], a));
    G.uv.push(0, 1 - k / (n - 1), 1, 1 - k / (n - 1));
    G.shade.push(shade, shade);
  }
  for (let k = 0; k + 1 < n; k++) { const i = base + k * 2; G.index.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
}

export function grow(pos, tris, lm, scale, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, sty = { ...STYLES[o.style] || STYLES.long, ...(opts.over || {}) };
  const S = scale, fr = frame(pos, lm, S), { push, hug } = fields(pos, fr, S), rand = rng(7);
  const scalpTris = scalp(pos, tris, lm, fr, S, o.hairline);
  const G = { position: [], uv: [], shade: [], index: [] }, B = { position: [], uv: [], shade: [], index: [] };
  const P = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  // area-weighted roots on the scalp
  const area = [], acc = [];
  let total = 0;
  for (const t of scalpTris) {
    const a = P(tris[t * 3]), b = P(tris[t * 3 + 1]), c = P(tris[t * 3 + 2]), A = len(cross(sub(b, a), sub(c, a))) / 2;
    total += A; area.push(A); acc.push(total);
  }
  const length = (opts.length ?? sty.length) * S, vol = (opts.volume ?? sty.volume) * S, wave = opts.wave ?? sty.wave;
  const part = (opts.part ?? sty.part) * 0.035 * S, bangs = opts.bangs ?? sty.bangs, tails = opts.tails ?? sty.tails;
  const browY = (lm(105)[1] + lm(334)[1]) / 2, chinY = lm(152)[1];
  const bangsStop = browY - (o.bangsAt || 0) * S;
  const cutY = sty.cut === "chin" ? chinY - 0.005 * S : -Infinity;
  const tieUp = ((opts.tie ?? sty.tie) ?? 0.5) * fr.top;
  const ties = tails === "twin" ? [-1, 1].map(s => add(fr.C, add(mul(fr.X, s * 0.085 * S), add(mul(fr.U, tieUp), mul(fr.F, -0.035 * S)))))
             : tails === "pony" ? [add(fr.C, add(mul(fr.U, tieUp), mul(fr.F, -0.1 * S)))] : [];
  const DOWN = [0, -1, 0], SEG = 0.012 * S;
  let inside = 0, points = 0, cards = 0;
  const hfront = dot(sub(lm(10), fr.C), fr.U);
  for (let c = 0; c < o.cards && total; c++) {
    let r = rand() * total, lo = 0, hi = acc.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (acc[m] < r) lo = m + 1; else hi = m; }
    const t = scalpTris[lo], A = P(tris[t * 3]), Bq = P(tris[t * 3 + 1]), Cq = P(tris[t * 3 + 2]);
    let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const root = add(A, add(mul(sub(Bq, A), u), mul(sub(Cq, A), v))), n = norm(cross(sub(Bq, A), sub(Cq, A)));
    const d = sub(root, fr.C), x = dot(d, fr.X), f = dot(d, fr.F), hh = dot(d, fr.U);
    const side = Math.abs(x - part) < 0.004 * S ? (rand() < 0.5 ? -1 : 1) : Math.sign(x - part);
    const isBang = bangs && f > 0.02 * S && Math.abs(x) < 0.055 * S && hh < hfront + 0.06 * S;
    const tie = tails === "twin" ? ties[side < 0 ? 0 : 1] : tails === "pony" ? ties[0] : null;
    const proj = a => norm(sub(a, mul(n, dot(a, n))));
    const pts = [root];
    let dir, p = add(root, mul(n, vol * 0.5)), stop = -Infinity, L = length * (0.85 + 0.3 * rand());
    if (isBang) {
      dir = proj(add(mul(fr.F, 0.5), add(mul(fr.U, -1), mul(fr.X, side * 0.25))));
      L = 0.25 * S; stop = bangsStop + (rand() - 0.5) * 0.006 * S;
    } else if (tie) {                                            // gathered over the head to the tie, then hanging from it
      const n0 = 8;
      for (let k = 1; k <= n0; k++) {
        const s = k / n0; let q = mix(root, tie, s);
        q = push(q, vol * (1 - s) + 0.003 * S)[0]; pts.push(q);
      }
      const a = rand() * 6.28, rr = Math.sqrt(rand()) * 0.016 * S;              // a round bundle under the tie
      p = add(pts[pts.length - 1], [Math.cos(a) * rr, -rand() * 0.01 * S, Math.sin(a) * rr]); pts.push(p);
      dir = norm(add(mul(norm(sub(tie, fr.C)), 0.5), [Math.cos(a) * 0.25, -1, Math.sin(a) * 0.25]));
    } else {
      const sw = 1 - 0.85 * smooth(-f / (0.08 * S));               // the back falls straight: no parting down the nape
      dir = proj(add(mul(fr.X, side * sw), add(mul(fr.U, -0.3 - (1 - sw)), mul(fr.F, f > 0 ? -0.7 : -0.4))));   // away from the face
      dir = norm(add(dir, mul(n, 0.1)));
    }
    if (!tie) pts.push(p);
    const phase = rand() * 6.28, wdir = norm(cross(dir, n));
    let grown = 0;
    while (grown < L && pts.length < 60) {
      const k = grown / L, g = isBang ? 0.12 : tie ? 0.18 : 0.14 + 0.25 * k;
      dir = norm(mix(dir, DOWN, g));
      let q = add(p, mul(dir, SEG));
      if (wave) q = add(q, mul(wdir, Math.sin(grown / (0.06 * S) * 6.28 + phase) * wave * 0.004 * S));
      if (!isBang) {                                         // nothing but bangs hangs over the face
        const e = sub(q, fr.C), ex = dot(e, fr.X), half = 0.072 * S;
        if (dot(e, fr.F) > 0.01 * S && Math.abs(ex) < half && q[1] > chinY - 0.03 * S) q = add(q, mul(fr.X, (ex < 0 ? -1 : 1) * half - ex));
      }
      const gap = vol + (isBang ? 0.002 * S : 0.004 * S);
      let moved; [q, moved] = push(q, gap);
      const up = dot(sub(q, fr.C), fr.U) / fr.top;             // 1 on top, 0 at the ears: hug the top, loosen down to the ears
      if (!tie && up > 0) { const h = hug(q, gap + (1 - up) ** 2 * 0.03 * S); if (h) { q = h; moved = true; } }
      if (moved) dir = norm(sub(q, p));
      grown += len(sub(q, p)); p = q; pts.push(p);
      if (p[1] < stop || p[1] < cutY) break;
    }
    if (pts.length < 3) continue;
    const spin = tie ? norm([rand() - 0.5, rand() - 0.5, rand() - 0.5]) : null;   // a tail's cards face every way
    const across = pts.map((q, k) => {
      const tng = norm(sub(pts[Math.min(k + 1, pts.length - 1)], pts[Math.max(k - 1, 0)]));
      let out = sub(q, fr.C); if (q[1] < fr.C[1] - 0.12 * S) out = [q[0], 0, q[2]];   // below the head: out from the body
      if (spin && k > 9) out = spin;
      return norm(cross(tng, norm(out)));
    });
    ribbon(G, pts, across, o.width * S * (isBang ? 0.8 : 1), 0.85 + 0.3 * rand(), tie ? 0.25 : 0.4);
    cards++; points += pts.length;
    for (const q of pts.slice(2)) if (push(q, 0)[1]) inside++;
  }

  // brows: short hairs along the band between each brow's two landmark rows, medial hairs up, lateral ones out
  if (o.brows) {
    for (const [upper, lower, sgn] of [[[107, 66, 105, 63, 70], [55, 65, 52, 53, 46], -1], [[336, 296, 334, 293, 300], [285, 295, 282, 283, 276], 1]]) {
      for (let k = 0; k < 150; k++) {
        const s = rand() * (upper.length - 1), i = Math.floor(s), fs = s - i, j = Math.min(i + 1, upper.length - 1);
        const up = mix(lm(upper[i]), lm(upper[j]), fs), dn = mix(lm(lower[i]), lm(lower[j]), fs), q0 = mix(dn, up, 0.15 + 0.6 * rand());
        const along = s / (upper.length - 1), out = norm(sub(q0, fr.C));
        const dir0 = norm(add(mul(fr.U, 1 - along * 0.85), mul(fr.X, sgn * (0.3 + along * 1.2))));
        const dir = norm(sub(dir0, mul(out, dot(dir0, out)))), l = (0.007 + 0.004 * rand()) * S * (1 - 0.4 * along);
        const lift = mul(out, 0.0006 * S), pts = [add(q0, lift), add(add(q0, mul(dir, l * 0.5)), mul(lift, 1.6)), add(add(q0, mul(dir, l)), mul(lift, 1.2))];
        ribbon(B, pts, pts.map(() => norm(cross(dir, out))), 0.0008 * S, 0.8 + 0.3 * rand(), 0.3);
      }
    }
  }
  // lashes: along each upper lid, curling forward and up
  if (o.lashes) {
    for (const [lid, sgn] of [[[33, 246, 161, 160, 159, 158, 157, 173, 133], -1], [[263, 466, 388, 387, 386, 385, 384, 398, 362], 1]]) {
      for (let k = 0; k < 44; k++) {
        const s = (k + rand() * 0.6) / 44 * (lid.length - 1), i = Math.floor(s), j = Math.min(i + 1, lid.length - 1);
        const q0 = mix(lm(lid[i]), lm(lid[j]), s - i), outer = 1 - s / (lid.length - 1);   // 1 at the outer corner
        const l = (0.006 + 0.004 * Math.sin(Math.PI * (s / (lid.length - 1)))) * S;
        const d1 = norm(add(fr.F, add(mul(fr.U, 0.35), mul(fr.X, sgn * 0.4 * outer)))), d2 = norm(add(d1, mul(fr.U, 0.9)));
        const pts = [q0, add(q0, mul(d1, l * 0.5)), add(add(q0, mul(d1, l * 0.5)), mul(d2, l * 0.5))];
        ribbon(B, pts, pts.map(() => fr.X), 0.0007 * S, 0.3, 0.3);
      }
    }
  }
  return { hair: G, brows: B, scalp: scalpTris, frame: fr,
           report: { cards, points, scalp_triangles: scalpTris.length, inside_pct: points ? Math.round(1000 * inside / points) / 10 : 0 } };
}
