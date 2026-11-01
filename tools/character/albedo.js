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
//                                               +Y up the picture), and one map of R its ambient occlusion (o.ao, from
//                                               bakeOcclusion; 1 without), G its roughness, B how thin it is (thin.js's
//                                               skinThin: the light through it; the file's metalness is 0, so its blue
//                                               is free)
//   bakeClothNormal(renderer, geometry, material, uv, o)   a garment's creases (tailor/crease.js, worked out in
//                                               tailor/look.js's shader as crG: the height's slope along the fabric's
//                                               metres) as a tangent-space normal map in glTF's convention, in the layout
//                                               `uv` (pack() keeps the fabric's directions: +u, +v)
//   bakeOcclusion(renderer, geometry, uv, o)    how much of the sky each point of the mesh sees (its position and
//                                               normal as they are), in the layout `uv`: N x N bytes, 255 open
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
    if (k === "orm" && o.ao && o.ao.length === N * N) for (let i = 0; i < N * N; i++) if (px[i * 4 + 3]) px[i * 4] = o.ao[i];   // its occlusion in R
    fill(px, N, false, k === "normal" ? [128, 128, 255] : null);
    const t = textureOf(px, N, "image/png"); t.colorSpace = THREE.NoColorSpace; out[k] = t;
  }
  return out;
}

const CLOTH_NORMAL = `{
  vec3 n = normalize(vec3(-crG.x, -crG.y, 1.0));                 // in the fabric's own frame: +u, +v, out of the cloth
  gl_FragColor = vec4(0.5 + 0.5 * n.x, 0.5 - 0.5 * n.y, 0.5 + 0.5 * n.z, 1.0); return;   // glTF's, as the skin's (bakeSkinMaps)
}`;
export function bakeClothNormal(renderer, geometry, material, uv, o = {}) {
  const N = o.size || 2048, px = draw(renderer, geometry, material, uv, N, "cloth-normal", CLOTH_NORMAL);
  fill(px, N, false, [128, 128, 255]);
  const t = textureOf(px, N, "image/png"); t.colorSpace = THREE.NoColorSpace;
  return t;
}

// the ambient occlusion: depth maps of the mesh from `dirs` directions spread over the sphere (each an orthographic view
// of a sphere round it, a tile of one atlas), then every point drawn flat at its UV and tested against each: a direction
// it faces (weighted by the cosine) is shut when something lies in front of it there, nearer than `reach` metres
// counting fully and further ones less (a hand at the hip shades it, the far arm doesn't black it out). Twice: the whole
// body, and the head again in a sphere of its own (the creases round the eyes, the nostrils, the ears are millimetres:
// the body's maps are a centimetre a texel). The depth is packed in three bytes; the point's own surface is kept off by
// a texel and a half along its direction and its normal.
const OCC_DEPTH_V = `uniform vec3 uC, uD; uniform float uR; varying float vZ;
void main() { vZ = (2.0 * uR - dot(position - uC, uD)) / (4.0 * uR); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const OCC_DEPTH_F = `varying float vZ;
void main() { vec3 e = fract(clamp(vZ, 0.0, 0.999) * vec3(1.0, 255.0, 65025.0)); e -= e.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0); gl_FragColor = vec4(e, 1.0); }`;
const OCC_V = `attribute vec2 occUv; varying vec3 vP, vN;
void main() { vP = position; vN = normal; gl_Position = vec4(occUv * 2.0 - 1.0, 0.0, 1.0); }`;
const occF = K => `uniform sampler2D uBody, uHead; uniform vec3 uDir[${K}], uRight[${K}], uUp[${K}];
uniform vec4 uBodyS, uHeadS; uniform float uReach, uTiles, uTexelB, uTexelH;
varying vec3 vP, vN;
float shut(sampler2D atlas, vec4 S, float texel, vec3 p, vec3 n) {   // S: the sphere's centre and radius; texel: its tiles' size in texels
  float occ = 0.0, sum = 0.0, bias = 1.5 * 2.0 * S.w / texel;
  for (int k = 0; k < ${K}; k++) {
    vec3 d = uDir[k]; float w = dot(n, d); if (w <= 0.0) continue;
    vec3 q = p + n * bias - S.xyz;
    vec2 xy = vec2(dot(q, uRight[k]), dot(q, uUp[k])) / S.w * 0.5 + 0.5;
    float z = (2.0 * S.w - dot(q, d)) / (4.0 * S.w);
    vec2 at = (vec2(mod(float(k), uTiles), floor(float(k) / uTiles)) + clamp(xy, 0.0, 1.0)) / uTiles;
    float zs = dot(texture2D(atlas, at).rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
    float gap = (z - zs) * 4.0 * S.w;                              // metres in front of the point along d
    if (gap > bias) occ += w * (1.0 - smoothstep(uReach * 0.35, uReach, gap));
    sum += w;
  }
  return sum > 0.0 ? 1.0 - occ / sum : 1.0;
}
void main() {
  vec3 n = normalize(vN);
  float inHead = 1.0 - smoothstep(uHeadS.w * 0.85, uHeadS.w * 0.98, length(vP - uHeadS.xyz));
  float a = inHead < 0.999 ? shut(uBody, uBodyS, uTexelB, vP, n) : 1.0;
  if (inHead > 0.001) a = mix(a, min(a, shut(uHead, uHeadS, uTexelH, vP, n)), inHead);   // the head's finer maps (the shoulders under the chin are in them too: they render the whole body, clipped to the head's box)
  gl_FragColor = vec4(vec3(a), 1.0);
}`;
export function bakeOcclusion(renderer, geometry, uv, o = {}) {
  const N = o.size || 2048, K = o.dirs || 64, TB = o.tile || 256, TH = o.headTile || 512, tiles = Math.ceil(Math.sqrt(K)), reach = o.reach || 0.25;
  const P = geometry.attributes.position, box = new THREE.Box3().setFromBufferAttribute(P), top = box.max.y;
  const sphere = pts => { const c = new THREE.Vector3(), v = new THREE.Vector3(); let r = 0;
    for (const i of pts) c.add(v.fromBufferAttribute(P, i)); c.divideScalar(Math.max(1, pts.length));
    for (const i of pts) r = Math.max(r, c.distanceTo(v.fromBufferAttribute(P, i))); return new THREE.Vector4(c.x, c.y, c.z, r * 1.02 + 0.005); };
  const all = [...Array(P.count).keys()], head = all.filter(i => P.getY(i) > top - 0.3);
  const S = { body: sphere(all), head: sphere(head) };
  const dirs = [], rights = [], ups = [];                          // a Fibonacci sphere, and each view's frame
  for (let k = 0; k < K; k++) {
    const y = 1 - 2 * (k + 0.5) / K, r = Math.sqrt(1 - y * y), t = k * Math.PI * (3 - Math.sqrt(5));
    const d = new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
    const right = new THREE.Vector3().crossVectors(Math.abs(d.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), d).normalize();
    dirs.push(d); rights.push(right); ups.push(new THREE.Vector3().crossVectors(d, right));
  }
  const g = geometry.clone(); for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
  g.setAttribute("occUv", new THREE.BufferAttribute(uv, 2));
  const depthMat = new THREE.ShaderMaterial({ vertexShader: OCC_DEPTH_V, fragmentShader: OCC_DEPTH_F, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Vector3() }, uD: { value: new THREE.Vector3() }, uR: { value: 1 } } });
  const occMat = new THREE.ShaderMaterial({ vertexShader: OCC_V, fragmentShader: occF(K), side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    uniforms: { uBody: { value: null }, uHead: { value: null }, uDir: { value: dirs }, uRight: { value: rights }, uUp: { value: ups },
                uBodyS: { value: S.body }, uHeadS: { value: S.head }, uReach: { value: reach }, uTiles: { value: tiles }, uTexelB: { value: TB }, uTexelH: { value: TH } } });
  const m = new THREE.Mesh(g, depthMat), scene = new THREE.Scene(); m.frustumCulled = false; scene.add(m);
  const r0 = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  const atlases = [], px = new Uint8Array(N * N * 4);
  try {
    renderer.setClearColor(0xffffff, 1);
    for (const [s, T] of [[S.body, TB], [S.head, TH]]) {           // the depth atlases: a tile a direction
      const rt = new THREE.WebGLRenderTarget(T * tiles, T * tiles, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
      renderer.setRenderTarget(rt); renderer.clear();
      const c = new THREE.Vector3(s.x, s.y, s.z), cam = new THREE.OrthographicCamera(-s.w, s.w, s.w, -s.w, 0, 4 * s.w);
      depthMat.uniforms.uC.value.copy(c); depthMat.uniforms.uR.value = s.w;
      for (let k = 0; k < K; k++) {
        cam.position.copy(c).addScaledVector(dirs[k], 2 * s.w); cam.up.copy(ups[k]); cam.lookAt(c); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        depthMat.uniforms.uD.value.copy(dirs[k]);
        rt.viewport.set((k % tiles) * T, Math.floor(k / tiles) * T, T, T); rt.scissor.copy(rt.viewport); rt.scissorTest = true;
        renderer.setRenderTarget(rt); renderer.render(scene, cam);
      }
      rt.scissorTest = false; atlases.push(rt);
    }
    occMat.uniforms.uBody.value = atlases[0].texture; occMat.uniforms.uHead.value = atlases[1].texture;
    m.material = occMat;
    const out = new THREE.WebGLRenderTarget(N, N);
    renderer.setRenderTarget(out); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, new THREE.OrthographicCamera());
    renderer.readRenderTargetPixels(out, 0, 0, N, N, px); out.dispose();
  } finally {
    renderer.setRenderTarget(r0); renderer.setClearColor(cc, ca); for (const a of atlases) a.dispose(); g.dispose(); depthMat.dispose(); occMat.dispose();
  }
  // smoothed over a millimetre or so inside each island (the depth maps' texels would show as facets), never across a seam
  const a = new Float32Array(N * N), w = new Float32Array(N * N), t = new Float32Array(N * N), tw = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) if (px[i * 4 + 3]) { a[i] = px[i * 4]; w[i] = 1; }
  for (let pass = 0; pass < 2; pass++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    t.fill(0); tw.fill(0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; if (!w[i]) continue;
      let s = 0, c = 0;
      for (let k = -2; k <= 2; k++) { const X = x + k * dx, Y = y + k * dy; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; const j = Y * N + X; if (w[j]) { s += a[j]; c++; } }
      t[i] = s / c; tw[i] = 1;
    }
    a.set(t);
  }
  const ao = new Uint8Array(N * N); let sum = 0, n = 0;
  for (let i = 0; i < N * N; i++) if (w[i]) { ao[i] = Math.round(a[i]); sum += a[i]; n++; } else ao[i] = 255;
  return Object.assign(ao, { mean: n ? sum / n / 255 : 1 });
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
