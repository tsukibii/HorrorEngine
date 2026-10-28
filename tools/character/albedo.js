// albedo.js: what the Studio's shaders draw, baked into textures for the export (Export for desk / Unreal). glTF carries
// a material's colour and its maps, never a shader: the procedural skin (skinshader.js: the tone, the makeup, the lips,
// the nails, the photo and the touch-up), the tailor's fabric (tailor/look.js: the colour, the weave, a pattern, a
// print, a PBR set's colour) would leave the file white. So the material's own shader is drawn flat into the mesh's UV
// layout (its vertices at their UVs, every layer computed as in the view) and the colour it reaches before the light is
// read back: what's lit (gloss, a dewy glow, translucency) is left to whatever draws the file.
//
//   bake(renderer, geometry, material, uv, o)   the material's colour in the layout `uv` (a Float32Array, 0..1, per
//                                               vertex): {texture, covered, mean}; o.size, o.alpha (keep its alpha)
//   pack(uv, part, o)                           a garment's fabric coordinates (metres, an island per part) laid out in
//                                               one texture at about o.texel metres a pixel: {uv, size}
//   bakeSkinMaps(renderer, geometry, material, uv, o)   the procedural skin's surface for a file (skinshader.js,
//                                               skinlight.js): {normal, orm}: its relief (pores, wrinkles, a nail's
//                                               edge) as a tangent-space normal map in glTF's convention (+X along u,
//                                               +Y up the picture), and one map of R 1 (no occlusion yet), G its
//                                               roughness, B how thin it is (thin.js's skinThin: the light through it;
//                                               the file's metalness is 0, so its blue is free)
import * as THREE from "three";

const ATTR = "albedoUv";

/** the material's colour before the light, drawn flat into `uv`; empty texels around the islands filled from their edges */
export function bake(renderer, geometry, material, uv, o = {}) {
  const N = o.size || 2048, alpha = !!o.alpha;
  const px = draw(renderer, geometry, material, uv, N, "albedo" + (alpha ? "a" : ""),             // every layer applied, nothing lit yet (and no per-vertex shade: the file keeps that)
    `gl_FragColor = vec4(sRGBTransferOETF(vec4(clamp(diffuseColor.rgb, 0.0, 1.0), 1.0)).rgb, ${alpha ? "clamp(diffuseColor.a, 2.0 / 255.0, 1.0)" : "1.0"}); return;`);
  const { covered, mean } = fill(px, N, alpha);
  const t = textureOf(px, N, alpha ? "image/png" : "image/jpeg");                                 // GLTFExporter writes it so: the opaque ones smaller
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, covered, mean };
}

// the skin's relief and its roughness and thinness, drawn flat into `uv` as the colour is (the procedural skin's own
// shader up to its colour, where skinH, skinRough and the nails' are known); the relief as the view makes it (the
// height's change across a texel bending the normal, scale-free), turned into the layout's own frame: +u, +v and the
// surface's normal
const NORMAL = `{
  vec3 P = -vViewPosition, Ng = normalize(vNormal);                 // the bake draws with no view: the skin's own place and normal
  float hh = skinH + nailH;
  vec3 sx = dFdx(P), sy = dFdy(P), r1 = cross(sy, Ng), r2 = cross(Ng, sx);
  float det = dot(sx, r1); vec2 dh = vec2(dFdx(hh), dFdy(hh)) * 0.00025;
  vec3 n = (uProc > 0.5 || uHasLay > 0.5 || uNailOn > 0.5) ? normalize(abs(det) * Ng - sign(det) * (dh.x * r1 + dh.y * r2)) : Ng;
  vec3 T = normalize(sx - Ng * dot(Ng, sx)), B = normalize(sy - Ng * dot(Ng, sy));
  gl_FragColor = vec4(0.5 + 0.5 * dot(n, T), 0.5 - 0.5 * dot(n, B), 0.5 + 0.5 * dot(n, Ng), 1.0); return;   // glTF's: +Y up the picture, against +v
}`;
const ORM = `{
  float rf = roughness;
  if (uProc > 0.5 || uHasLay > 0.5 || uLipOn > 0.5) rf = clamp(rf * skinRough, 0.06, 1.0);
  rf = mix(rf, nailRough, nailM);
  gl_FragColor = vec4(1.0, rf, clamp(vSlThin, 0.0, 1.0), 1.0); return;
}`;
export function bakeSkinMaps(renderer, geometry, material, uv, o = {}) {
  const N = o.size || 2048, out = {};
  for (const [k, code] of [["normal", NORMAL], ["orm", ORM]]) {
    const px = draw(renderer, geometry, material, uv, N, "skin-" + k, code);
    fill(px, N, false, k === "normal" ? [128, 128, 255] : null);
    const t = textureOf(px, N, "image/png"); t.colorSpace = THREE.NoColorSpace; out[k] = t;
  }
  return out;
}

// the material drawn into a square N px texture at `uv` (its vertices there, every fragment its own computed values,
// `code` in place of the light), read back
function draw(renderer, geometry, material, uv, N, key, code) {
  const g = geometry.clone(); for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
  g.setAttribute(ATTR, new THREE.BufferAttribute(uv, 2));
  const was = { obc: material.onBeforeCompile, key: material.customProgramCacheKey, side: material.side, transparent: material.transparent, blending: material.blending,
                depthTest: material.depthTest, depthWrite: material.depthWrite, a2c: material.alphaToCoverage };
  material.onBeforeCompile = (sh, r) => {
    was.obc.call(material, sh, r);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>\nattribute vec2 ${ATTR};`)
      .replace("#include <fog_vertex>", `#include <fog_vertex>\ngl_Position = vec4(${ATTR} * 2.0 - 1.0, 0.0, 1.0);`);   // the vertex at its place in the texture
    sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", `${code}\n#include <color_fragment>`);
  };
  material.customProgramCacheKey = () => was.key.call(material) + "|" + key;
  Object.assign(material, { side: THREE.DoubleSide, transparent: false, blending: THREE.NoBlending, depthTest: false, depthWrite: false, alphaToCoverage: false, needsUpdate: true });
  const m = new THREE.Mesh(g, material), scene = new THREE.Scene(); m.frustumCulled = false; scene.add(m);
  const rt = new THREE.WebGLRenderTarget(N, N), px = new Uint8Array(N * N * 4);
  const r0 = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  try {
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, new THREE.OrthographicCamera());
    renderer.readRenderTargetPixels(rt, 0, 0, N, N, px);
  } finally {
    renderer.setRenderTarget(r0); renderer.setClearColor(cc, ca); rt.dispose(); g.dispose();
    Object.assign(material, { onBeforeCompile: was.obc, customProgramCacheKey: was.key, side: was.side, transparent: was.transparent, blending: was.blending,
                              depthTest: was.depthTest, depthWrite: was.depthWrite, alphaToCoverage: was.a2c, needsUpdate: true });
  }
  return px;
}
function textureOf(px, N, mime) {
  const c = document.createElement("canvas"); c.width = c.height = N;
  const img = new ImageData(N, N), row = N * 4;
  for (let y = 0; y < N; y++) img.data.set(px.subarray((N - 1 - y) * row, (N - y) * row), y * row);   // the target's first row is v = 0: the picture's last
  c.getContext("2d").putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.userData.mimeType = mime;
  return t;
}

// the empty texels: eight rings round the islands from their neighbours (so a filtered or mipmapped read at an island's
// edge doesn't pull in black), the rest the islands' mean (or `rest`: a flat normal's); opaque unless the alpha is kept
function fill(px, N, alpha, rest = null) {
  const state = new Uint8Array(N * N), sum = [0, 0, 0];   // 0 empty, 1 filled, 2 queued
  let covered = 0, front = [];
  for (let i = 0; i < N * N; i++) if (px[i * 4 + 3] > 0) { state[i] = 1; covered++; for (let k = 0; k < 3; k++) sum[k] += px[i * 4 + k]; }
  const mean = sum.map(s => covered ? s / covered : 0);
  const near = (i, f) => { const x = i % N, y = (i - x) / N;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < N && Y < N) f(Y * N + X); } };
  for (let i = 0; i < N * N; i++) if (state[i] === 1) near(i, j => { if (!state[j]) { state[j] = 2; front.push(j); } });
  for (let ring = 0; ring < 8 && front.length; ring++) {
    for (const i of front) { const s = [0, 0, 0, 0]; let n = 0; near(i, j => { if (state[j] === 1) { for (let k = 0; k < 4; k++) s[k] += px[j * 4 + k]; n++; } }); for (let k = 0; k < 4; k++) px[i * 4 + k] = s[k] / n; }
    for (const i of front) state[i] = 1;
    const next = []; for (const i of front) near(i, j => { if (!state[j]) { state[j] = 2; next.push(j); } }); front = next;
  }
  for (let i = 0; i < N * N; i++) {
    if (state[i] !== 1) { const m = rest || mean; px[i * 4] = m[0]; px[i * 4 + 1] = m[1]; px[i * 4 + 2] = m[2]; px[i * 4 + 3] = alpha ? 0 : 255; }
    else if (!alpha) px[i * 4 + 3] = 255;
  }
  return { covered: covered / (N * N), mean: mean.map(v => v / 255) };
}

/** a garment's fabric coordinates (metres round each part: tailor/uv.js) as islands in one texture, one per part, on
 * shelves; about `texel` metres a pixel, shrunk until they fit `max`. uv: the coordinates (2 a vertex), part: each
 * vertex's part (or null: one island) */
export function pack(uv, part, o = {}) {
  const texel = o.texel || 0.002, max = o.max || 2048, pad = o.pad ?? 6, n = uv.length / 2, box = new Map();
  for (let i = 0; i < n; i++) {
    const p = part ? part[i] : 0, u = uv[i * 2], v = uv[i * 2 + 1];
    let b = box.get(p); if (!b) box.set(p, b = [u, v, u, v]);
    b[0] = Math.min(b[0], u); b[1] = Math.min(b[1], v); b[2] = Math.max(b[2], u); b[3] = Math.max(b[3], v);
  }
  const isles = [...box.entries()].map(([p, b]) => ({ p, b, w: b[2] - b[0], h: b[3] - b[1] }));
  let s = 1 / texel, area = 0;
  for (const I of isles) area += (I.w * s + 2 * pad) * (I.h * s + 2 * pad);
  const N = Math.max(64, Math.min(max, 2 ** Math.ceil(Math.log2(Math.sqrt(area * 1.25)))));
  const place = () => {                                   // tallest first, left to right, a new shelf when a row is full
    let x = pad, y = pad, rowH = 0;
    for (const I of [...isles].sort((a, b) => b.h - a.h)) {
      const w = Math.ceil(I.w * s), h = Math.ceil(I.h * s);
      if (x + w + pad > N) { x = pad; y += rowH + 2 * pad; rowH = 0; }
      if (x + w + pad > N || y + h + pad > N) return false;
      I.x = x; I.y = y; x += w + 2 * pad; rowH = Math.max(rowH, h);
    }
    return true;
  };
  while (!place()) s *= 0.92;
  const at = new Map(isles.map(I => [I.p, I])), out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const I = at.get(part ? part[i] : 0);
    out[i * 2] = (I.x + (uv[i * 2] - I.b[0]) * s) / N; out[i * 2 + 1] = (I.y + (uv[i * 2 + 1] - I.b[1]) * s) / N;
  }
  return { uv: out, size: N, texel: 1 / s };
}
