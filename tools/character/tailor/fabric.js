// Fabrics for the tailor's garments, after Woohill's surfaces (tsukibii/woohill creator/src/js/60-character.js
// `surfaceTile`, `surfaceAux`; 20-clothes.js `SURFACE_SCALE`, `SURFACE_GLOSS`, `SURFACE_RELIEF`): each a seamless tile
// drawn in code at four times Woohill's size (its strokes are kept in its 128-unit space and scaled), laid on the
// garment at its real size in metres (tailor/uv.js). The tile is the cloth's light and dark round a mid grey, so the
// garment's colour or pattern shows through it; the over-skin ones (fishnet, lace, sheer tights) carry their
// coverage, so the skin shows in their holes. Also patterns (stripes, checks, plaid, dots...) and prints (a picture or
// some text placed on a panel). Browser only (canvas); tailor/look.js turns them into materials.

const TAU = Math.PI * 2, N = 512, K = N / 128;
// id: [label, tile metres, gloss, relief, over the skin]
export const SURFACES = {
  flat: ["Flat", 0.1, 0, 0, false],
  cotton: ["Cotton", 0.03, 0, 0.12, false],
  jersey: ["Jersey (t-shirt knit)", 0.02, 0.05, 0.12, false],
  denim: ["Denim", 0.035, 0.05, 0.18, false],
  canvas: ["Canvas (work wear)", 0.05, 0, 0.3, false],
  twill: ["Twill (trousers)", 0.025, 0.08, 0.15, false],
  knit: ["Knit", 0.04, 0, 0.35, false],
  rib: ["Rib knit", 0.025, 0.02, 0.4, false],
  wool: ["Wool (felt)", 0.06, 0, 0.25, false],
  tweed: ["Tweed", 0.05, 0, 0.25, false],
  silk: ["Silk sheen", 0.12, 0.5, 0, false],
  satin: ["Satin", 0.1, 0.65, 0, false],
  spandex: ["Spandex", 0.045, 0.45, 0.05, false],
  leather: ["Leather", 0.08, 0.3, 0.15, false],
  patent: ["Patent leather", 0.14, 1.0, 0, false],
  suede: ["Suede", 0.09, 0.03, 0.1, false],
  velvet: ["Velvet", 0.16, 0.3, 0.1, false],
  quilted: ["Quilted", 0.12, 0.1, 0.8, false],
  rubber: ["Rubber", 0.05, 0.15, 0.2, false],
  sheer: ["Sheer (pantyhose)", 0.03, 0.4, 0, true],
  fishnet: ["Fishnet", 0.028, 0.2, 0.4, true],
  lace: ["Lace", 0.07, 0.1, 0.3, true],
  laced: ["Lace, lined", 0.07, 0.15, 0.35, false],
  sequin: ["Sequins", 0.03, 0.9, 0.4, false],
};

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const canvas = (w = N, h = N) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

const TILES = new Map();
/** a surface's tile: RGB its light and dark round mid grey (128), A its coverage (1 but in an over-skin surface's holes) */
export function surfaceTile(kind) {
  if (TILES.has(kind)) return TILES.get(kind);
  const c = canvas(), x = c.getContext("2d"), info = SURFACES[kind] || SURFACES.flat, over = info[4];
  if (!over) { x.fillStyle = "#808080"; x.fillRect(0, 0, N, N); }
  x.save(); x.scale(K, K);
  const n = 128, rnd = mulberry32(kind.length * 7919 + 13);
  const wrap = f => { for (let ox = -n; ox <= n; ox += n) for (let oy = -n; oy <= n; oy += n) { x.save(); x.translate(ox, oy); f(); x.restore(); } };
  const dot = (px, py, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); };
  const weave = (step, lw, hi, lo) => {
    x.lineWidth = lw;
    for (let yy = 0; yy < n; yy += step) for (let xx = 0; xx < n; xx += step) {
      const o = ((xx + yy) / step) % 2 === 0;
      x.strokeStyle = o ? hi : lo; x.beginPath();
      if (o) { x.moveTo(xx + 0.5, yy + step / 4); x.lineTo(xx + step - 0.5, yy + step / 4); } else { x.moveTo(xx + step / 2, yy - 0.5); x.lineTo(xx + step / 2, yy + step - 1.5); }
      x.stroke();
    }
  };
  const sheen = (amp, pow, f) => {                                    // a soft band of light that comes round seamlessly
    x.restore(); const img = x.getImageData(0, 0, N, N), d = img.data;
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      const s = 0.5 + 0.5 * Math.sin(f(xx / N, yy / N) * TAU), k = (yy * N + xx) * 4, add = Math.round(amp * Math.pow(s, pow));
      d[k] = Math.min(255, d[k] + add); d[k + 1] = Math.min(255, d[k + 1] + add); d[k + 2] = Math.min(255, d[k + 2] + add);
    }
    x.putImageData(img, 0, 0); x.save(); x.scale(K, K);
  };
  if (kind === "cotton") {
    weave(4, 1.2, "rgba(255,255,255,0.12)", "rgba(0,0,0,0.1)");
    for (let i = 0; i < 400; i++) dot(rnd() * n, rnd() * n, 0.5 + rnd() * 0.5, rnd() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)");
  } else if (kind === "jersey") {                                     // a fine knit: little Vs in columns
    x.strokeStyle = "rgba(0,0,0,0.13)"; x.lineWidth = 0.9;
    for (let yy = 0; yy < n; yy += 4) for (let xx = 0; xx < n; xx += 4) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 2, yy + 3.5); x.lineTo(xx + 4, yy); x.stroke(); }
    for (let i = 0; i < 300; i++) dot(rnd() * n, rnd() * n, 0.5, "rgba(255,255,255,0.06)");
  } else if (kind === "denim") {                                      // a twill's diagonal, and slubs
    x.strokeStyle = "rgba(255,255,255,0.16)"; x.lineWidth = 1;
    for (let i = -n; i < n * 2; i += 4) { x.beginPath(); x.moveTo(i, n); x.lineTo(i + n, 0); x.stroke(); }
    x.strokeStyle = "rgba(0,0,30,0.12)";
    for (let i = -n + 2; i < n * 2; i += 4) { x.beginPath(); x.moveTo(i, n); x.lineTo(i + n, 0); x.stroke(); }
    for (let i = 0; i < 500; i++) dot(rnd() * n, rnd() * n, 0.6, "rgba(0,0,30,0.07)");
    for (let i = 0; i < 40; i++) { x.strokeStyle = "rgba(255,255,255,0.14)"; x.lineWidth = 1; const px = rnd() * n, py = rnd() * n; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + 3 + rnd() * 8); x.stroke(); }
  } else if (kind === "twill") {
    x.strokeStyle = "rgba(255,255,255,0.1)"; x.lineWidth = 0.8;
    for (let i = -n; i < n * 2; i += 3) { x.beginPath(); x.moveTo(i, n); x.lineTo(i + n * 0.6, 0); x.stroke(); }
    for (let i = 0; i < 300; i++) dot(rnd() * n, rnd() * n, 0.5, "rgba(0,0,0,0.05)");
  } else if (kind === "canvas") {
    weave(6, 2, "rgba(255,255,255,0.15)", "rgba(0,0,0,0.13)");
    for (let i = 0; i < 40; i++) { x.strokeStyle = "rgba(0,0,0,0.12)"; x.lineWidth = 1.5; const px = rnd() * n, py = Math.floor(rnd() * n / 6) * 6 + 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 4 + rnd() * 8, py); x.stroke(); }
  } else if (kind === "knit" || kind === "wool" || kind === "tweed") {
    x.strokeStyle = "rgba(0,0,0,0.16)"; x.lineWidth = 1.4;
    for (let yy = 0; yy < n; yy += 8) for (let xx = 0; xx < n; xx += 8) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 4, yy + 7); x.lineTo(xx + 8, yy); x.stroke(); }
    x.strokeStyle = "rgba(255,255,255,0.08)"; x.lineWidth = 1;
    for (let yy = 0; yy < n; yy += 8) for (let xx = 0; xx < n; xx += 8) { x.beginPath(); x.moveTo(xx + 1, yy + 1); x.lineTo(xx + 4, yy + 6); x.stroke(); }
    if (kind === "wool") for (let i = 0; i < 900; i++) dot(rnd() * n, rnd() * n, 0.6, rnd() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)");
    if (kind === "tweed") { const fl = ["rgba(255,255,255,0.35)", "rgba(0,0,0,0.35)", "rgba(200,120,60,0.4)", "rgba(120,140,200,0.35)"]; for (let i = 0; i < 160; i++) dot(rnd() * n, rnd() * n, 0.9 + rnd() * 0.9, fl[Math.floor(rnd() * fl.length)]); }
  } else if (kind === "rib") {                                        // ribs down the piece (cuffs, socks, a sweater's hem)
    for (let xx = 0; xx < n; xx += 4) { x.fillStyle = "rgba(255,255,255,0.12)"; x.fillRect(xx, 0, 2, n); x.fillStyle = "rgba(0,0,0,0.14)"; x.fillRect(xx + 2.5, 0, 1.2, n); }
    for (let yy = 0; yy < n; yy += 3) { x.fillStyle = "rgba(0,0,0,0.05)"; x.fillRect(0, yy, n, 0.6); }
  } else if (kind === "silk" || kind === "satin") {
    wrap(() => { for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.04})`; x.save(); x.translate(rnd() * n, 0); x.rotate(0.5); x.fillRect(0, -n, 3 + rnd() * 10, n * 3); x.restore(); } });
    if (kind === "satin") sheen(30, 3, (u, v) => u + v * 0.3);
  } else if (kind === "spandex") {
    for (let yy = 0; yy < n; yy += 4) { x.fillStyle = yy % 8 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.045)"; x.fillRect(0, yy, n, 1); }
    sheen(26, 3, (u, v) => u + v * 0.6);
  } else if (kind === "leather") {
    wrap(() => { for (let i = 0; i < 60; i++) dot(rnd() * n, rnd() * n, 6 + rnd() * 18, `rgba(0,0,0,${0.025 + rnd() * 0.03})`); });
    for (let i = 0; i < 1400; i++) dot(rnd() * n, rnd() * n, 0.5 + rnd() * 0.4, "rgba(0,0,0,0.08)");
  } else if (kind === "patent") {
    x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(0, 0, n, n);
    sheen(70, 9, (u, v) => u + v * 0.5);
  } else if (kind === "suede") {
    for (let i = 0; i < 2600; i++) dot(rnd() * n, rnd() * n, 0.6, rnd() < 0.5 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)");
    sheen(14, 1, (u, v) => u * 0.7 + v);
  } else if (kind === "velvet") {
    wrap(() => { for (let i = 0; i < 18; i++) dot(rnd() * n, rnd() * n, 10 + rnd() * 16, rnd() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"); });
    for (let i = 0; i < 1800; i++) { x.strokeStyle = rnd() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"; x.lineWidth = 0.8; const px = rnd() * n, py = rnd() * n; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 0.3, py + 2.2); x.stroke(); }
  } else if (kind === "sequin") {                                    // discs in staggered rows, each catching the light its own way
    const P = 7, rows = Math.ceil(n / (P * 0.87)) + 2, cols = Math.ceil(n / P) + 2;
    wrap(() => { for (let row = -1; row < rows; row++) for (let col = -1; col < cols; col++) {
      const cx = col * P + (row % 2 ? P / 2 : 0), cy = row * P * 0.87, b = rnd();
      dot(cx, cy, P * 0.6, b < 0.35 ? `rgba(0,0,0,${0.25 + rnd() * 0.3})` : b < 0.7 ? `rgba(255,255,255,${0.08 + rnd() * 0.15})` : `rgba(255,255,255,${0.35 + rnd() * 0.4})`);
      x.strokeStyle = "rgba(0,0,0,0.35)"; x.lineWidth = 0.6; x.beginPath(); x.arc(cx, cy, P * 0.6, 0, TAU); x.stroke();
      dot(cx - 1.2, cy - 1.2, 1.1, "rgba(255,255,255,0.55)");
    } });
  } else if (kind === "quilted") {
    const P = n / 2;
    for (let row = -1; row <= 2; row++) for (let col = -1; col <= 2; col++) { const cx = col * P + (row % 2 ? P / 2 : 0) + P / 2, cy = row * P / 2; const gr = x.createRadialGradient(cx, cy, 2, cx, cy, P * 0.55); gr.addColorStop(0, "rgba(255,255,255,0.14)"); gr.addColorStop(1, "rgba(0,0,0,0.12)"); x.fillStyle = gr; x.fillRect(cx - P / 2, cy - P / 2, P, P); }
    x.lineWidth = 1.4; x.setLineDash([2.5, 2.5]); x.strokeStyle = "rgba(0,0,0,0.3)";
    for (let k = -2; k <= 4; k++) { x.beginPath(); x.moveTo(k * P - P, 0); x.lineTo(k * P, P); x.lineTo(k * P - P, 2 * P); x.stroke(); x.beginPath(); x.moveTo(k * P + P, 0); x.lineTo(k * P, P); x.lineTo(k * P + P, 2 * P); x.stroke(); }
    x.setLineDash([]);
  } else if (kind === "rubber") {                                    // a sole: fine grain and a few scuffs
    for (let i = 0; i < 1600; i++) dot(rnd() * n, rnd() * n, 0.5, rnd() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.05)");
    for (let i = 0; i < 12; i++) { x.strokeStyle = "rgba(0,0,0,0.12)"; x.lineWidth = 0.8; const px = rnd() * n, py = rnd() * n; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6 * rnd(), py + 2 * rnd()); x.stroke(); }
  } else if (kind === "sheer") {
    // tights: the nylon all over at its denier (the coverage, set again by the material), a fine mesh and a sheen down the leg
    x.fillStyle = "rgba(128,128,128,0.7)"; x.fillRect(0, 0, n, n);
    x.fillStyle = "rgba(128,128,128,0.25)"; for (let yy = 0; yy < n; yy += 2) for (let xx = yy % 4 ? 0 : 1; xx < n; xx += 2) x.fillRect(xx, yy, 1, 1);
    sheen(30, 4, (u) => u);
  } else if (kind === "fishnet") {
    // a diamond net; its holes are empty (the skin shows)
    x.strokeStyle = "#8a8a8a"; x.lineWidth = 2.4; x.lineCap = "round";
    const P = n / 2;
    wrap(() => { for (let k = -2; k <= 4; k++) { x.beginPath(); x.moveTo(k * P - P, 0); x.lineTo(k * P, P); x.lineTo(k * P - P, 2 * P); x.stroke(); x.beginPath(); x.moveTo(k * P + P, 0); x.lineTo(k * P, P); x.lineTo(k * P + P, 2 * P); x.stroke(); } });
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) dot(k * P + (j % 2 ? P / 2 : 0), j * P / 2, 2.2, "#9a9a9a");
  } else if (kind === "lace" || kind === "laced") {              // lined: the same net and flowers raised on an opaque ground
    const P = n / 4; x.strokeStyle = kind === "laced" ? "rgba(255,255,255,0.42)" : "#8a8a8a"; x.lineCap = "round";
    if (kind === "laced") { x.fillStyle = "rgba(0,0,0,0.06)"; x.fillRect(0, 0, n, n); }
    wrap(() => {
      x.lineWidth = 0.9; x.globalAlpha = 0.6;
      for (let k = -1; k <= 5; k++) { x.beginPath(); x.moveTo(k * P - P, 0); x.lineTo(k * P, P); x.lineTo(k * P - P, 2 * P); x.stroke(); x.beginPath(); x.moveTo(k * P + P, 0); x.lineTo(k * P, P); x.lineTo(k * P + P, 2 * P); x.stroke(); }
      x.globalAlpha = 1; x.lineWidth = 2.2;
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        const cx = col * n / 2 + (row ? n / 4 : 0) + n / 8, cy = row * n / 2 + n / 8;
        x.beginPath(); x.arc(cx, cy, 7, 0, TAU); x.stroke();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; x.beginPath(); x.arc(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 4.5, 0, TAU); x.stroke(); }
      }
    });
  }
  x.restore();
  TILES.set(kind, c);
  return c;
}

const RELIEF = new Map();
/** a surface's relief as grey (for a bump map): its tile's light and dark, deeper for a deeper surface, softened */
export function surfaceRelief(kind) {
  if (RELIEF.has(kind)) return RELIEF.get(kind);
  const src = surfaceTile(kind), d = src.getContext("2d").getImageData(0, 0, N, N).data, rl = (SURFACES[kind] || SURFACES.flat)[3];
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) { const a = d[i * 4 + 3] / 255, lum = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255; h[i] = 0.5 + ((SURFACES[kind]?.[4] ? a : lum) - 0.5) * 2.4 * rl; }
  const c = canvas(), x = c.getContext("2d"), img = x.createImageData(N, N), o = img.data;
  for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
    let t = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) t += h[((y + dy + N) % N) * N + (xx + dx + N) % N];
    const v = Math.max(0, Math.min(255, Math.round(t / 25 * 255))), k = (y * N + xx) * 4; o[k] = o[k + 1] = o[k + 2] = v; o[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  RELIEF.set(kind, c);
  return c;
}

// ---- patterns: woven or printed, in the garment's own colours --------------------------------------------------------
// id: [label, its colours' names]
export const PATTERNS = {
  none: ["None", []],
  stripes: ["Stripes", ["ground", "stripe"]],
  pinstripe: ["Pinstripe", ["ground", "line"]],
  vstripes: ["Vertical stripes", ["ground", "stripe"]],
  gingham: ["Gingham", ["ground", "check"]],
  checks: ["Checks", ["ground", "check"]],
  plaid: ["Plaid (tartan)", ["ground", "band", "line"]],
  dots: ["Polka dots", ["ground", "dot"]],
  houndstooth: ["Houndstooth", ["ground", "tooth"]],
  camo: ["Camouflage", ["ground", "patch", "shadow"]],
};

const PATS = new Map();
/** a pattern's tile (one repeat, N square) in its colours */
export function patternTile(kind, colors) {
  const key = kind + "|" + colors.join(","); if (PATS.has(key)) return PATS.get(key);
  const c = canvas(), x = c.getContext("2d"), [a, b, d] = [colors[0] || "#dddddd", colors[1] || "#333333", colors[2] || colors[1] || "#666666"];
  x.fillStyle = a; x.fillRect(0, 0, N, N);
  if (kind === "stripes") { x.fillStyle = b; x.fillRect(0, 0, N, N * 0.4); }
  else if (kind === "pinstripe") { x.fillStyle = b; x.fillRect(0, 0, N * 0.04, N); }
  else if (kind === "vstripes") { x.fillStyle = b; x.fillRect(0, 0, N * 0.4, N); }
  else if (kind === "gingham") {
    x.globalAlpha = 0.55; x.fillStyle = b; x.fillRect(0, 0, N / 2, N); x.fillRect(0, 0, N, N / 2); x.globalAlpha = 1;
    x.fillStyle = b; x.fillRect(0, 0, N / 2, N / 2);
  } else if (kind === "checks") { x.fillStyle = b; x.fillRect(0, 0, N / 2, N / 2); x.fillRect(N / 2, N / 2, N / 2, N / 2); }
  else if (kind === "plaid") {
    x.globalAlpha = 0.6; x.fillStyle = b;
    for (const [o, w] of [[0.1, 0.22], [0.5, 0.08]]) { x.fillRect(o * N, 0, w * N, N); x.fillRect(0, o * N, N, w * N); }
    x.globalAlpha = 0.85; x.fillStyle = d;
    for (const o of [0.38, 0.75]) { x.fillRect(o * N, 0, 0.02 * N, N); x.fillRect(0, o * N, N, 0.02 * N); }
    x.globalAlpha = 1;
  } else if (kind === "dots") {
    x.fillStyle = b;
    for (const [px, py] of [[0.25, 0.25], [0.75, 0.75]]) { x.beginPath(); x.arc(px * N, py * N, N * 0.12, 0, TAU); x.fill(); }
  } else if (kind === "houndstooth") {
    x.fillStyle = b; const q = N / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if ((i + j) % 2) continue; const ox = i * q, oy = j * q;
      x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + q, oy); x.lineTo(ox + q * 1.5, oy - q * 0.5); x.lineTo(ox + q * 1.5, oy + q * 0.5); x.lineTo(ox + q, oy + q); x.lineTo(ox + q * 0.5, oy + q * 1.5); x.lineTo(ox - q * 0.5, oy + q * 1.5); x.lineTo(ox, oy + q); x.closePath(); x.fill();
    }
  } else if (kind === "camo") {
    const rnd = mulberry32(9);
    for (const [col, k] of [[b, 22], [d, 14]]) for (let i = 0; i < k; i++) {
      const px = rnd() * N, py = rnd() * N, r = N * (0.06 + rnd() * 0.08);
      x.fillStyle = col;
      for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) { x.beginPath(); x.ellipse(px + ox, py + oy, r * 1.6, r, rnd() * 3, 0, TAU); x.fill(); }
    }
  }
  PATS.set(key, c);
  return c;
}

/** a print's picture: an image (a data URL, loaded) or some text set in a canvas */
export function textPrint(text, color = "#ffffff", font = "bold 200px sans-serif") {
  const c = canvas(1024, 256), x = c.getContext("2d");
  x.fillStyle = color; x.textAlign = "center"; x.textBaseline = "middle";
  const lines = String(text).split("\n"), h = 256 / lines.length;
  lines.forEach((l, i) => {                                          // each line as big as fits the width and its share of the height
    let size = Math.floor(h * 0.86); x.font = font.replace(/\d+px/, size + "px");
    while (x.measureText(l).width > 1000 && size > 12) { size -= 4; x.font = font.replace(/\d+px/, size + "px"); }
    x.fillText(l, 512, h * (i + 0.5));
  });
  return c;
}
