// The drape's steps on the graphics card (WebGPU compute), behind the pages' "Use the GPU" switch: a test of the user's
// card (DECISIONS 2026-11-02), not yet the default. Everything before the steps is drape.js's own (`prepare`: masses,
// holds, lengths, bends, tethers, buttoned pairs, the first planes) and so is everything after (`finish`); only the step
// loop runs here, the same passes in the same order: predict, then for each pass the lengths, the buttoned pairs and
// the bends, then the tethers, the skin and a skirt's floor.
// What differs from the CPU's loop (drape.js `draping`), so the two come out alike but not the same:
// - the constraints run in batches that share no point (a greedy colouring), each batch at once, the batches in turn,
//   instead of one at a time from the top down (Gauss-Seidel by colour);
// - float32, not float64;
// - each point's plane on the skin is asked again on the CPU (the body's own search, drape.js `ask`) every `every`
//   steps from the points read back, not the moment a point has moved too far from where it last asked;
// - it stops once still at those readbacks, not at the step it's still.
// Every constraint and point a thread; the passes in order inside one compute pass (WebGPU makes each dispatch's writes
// seen by the next). Needs a secure page (localhost) and a browser with WebGPU (Vivaldi or Chromium: Unsafe WebGPU
// Support in vivaldi://flags or chrome://flags where it isn't on by default; docs/TAILOR.md §1i). Returns null (and
// `gpuState().why`) when there is none: the CPU's loop then.
import { ask, finish, predict, lengths, seams, bends, tether, collide, floorRings } from "./drape.js";
import { smooth } from "./mesh.js";

let DEV = null, STATE = { ok: false, why: "not asked yet" };
/** the card, asked for once: {ok, name, why} */
export const gpuState = () => STATE;
export async function gpuDevice() {
  if (DEV) return DEV;
  try {
    const gpu = globalThis.navigator?.gpu;
    if (!gpu) throw new Error(globalThis.isSecureContext === false ? "the page isn't a secure context (open it on localhost)" : "this browser has no WebGPU (Vivaldi or Chromium: turn on Unsafe WebGPU Support in vivaldi://flags or chrome://flags, then check WebGPU in vivaldi://gpu)");
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("WebGPU found no graphics adapter");
    const device = await adapter.requestDevice();
    const info = adapter.info || {}, name = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(" ") || "a WebGPU adapter";
    device.lost.then(l => { DEV = null; STATE = { ok: false, why: `the device was lost: ${l.message || l.reason}` }; });
    DEV = { device, name, fallback: !!(info.isFallbackAdapter || adapter.isFallbackAdapter) };
    STATE = { ok: true, name };
    return DEV;
  } catch (e) { STATE = { ok: false, why: e.message || String(e) }; return null; }
}

const WG = 64;
const HEAD = `struct U { a: u32, b: u32, c: f32, d: f32 }
@group(1) @binding(0) var<uniform> u: U;`;
// each kernel: its storage buffers in order (r: read only, w: read and write) and its body
const KERNELS = {
  predict: { bufs: ["w", "w", "r", "w"], code: `
@group(0) @binding(0) var<storage, read_write> X: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> Xp: array<vec4f>;
@group(0) @binding(2) var<storage, read> W: array<f32>;
@group(0) @binding(3) var<storage, read_write> V: array<f32>;
${HEAD}
// u: a n, b gravity a step (as f32 bits), c the step's damping, d the step's length
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.a) { return; }
  let x = X[i].xyz; let h = u.d;
  var v = (x - Xp[i].xyz) / h;
  V[i] = dot(v, v);
  Xp[i] = vec4f(x, 0.0);
  if (W[i] == 0.0) { return; }
  let g = bitcast<f32>(u.b);
  v = vec3f(v.x * u.c, (v.y - g) * u.c, v.z * u.c);
  X[i] = vec4f(x + v * h, 0.0);
}` },
  lengths: { bufs: ["w", "r", "r"], code: `
@group(0) @binding(0) var<storage, read_write> X: array<vec4f>;
@group(0) @binding(1) var<storage, read> W: array<f32>;
@group(0) @binding(2) var<storage, read> C: array<vec4u>;
${HEAD}
// u: a start, b count, c how hard it resists being pushed shorter (0: the buttoned pairs, only pulled together)
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u.b) { return; }
  let e = C[u.a + id.x]; let a = e.x; let b = e.y;
  let pa = X[a].xyz; let pb = X[b].xyz; let d = pb - pa; let L = length(d);
  let wa = W[a]; let wb = W[b]; let ws = wa + wb;
  if (L < 1e-9 || ws == 0.0) { return; }
  var c = L - bitcast<f32>(e.z); if (c < 0.0) { c = c * u.c; }
  let k = c / (ws * L);
  X[a] = vec4f(pa + (wa * k) * d, 0.0);
  X[b] = vec4f(pb - (wb * k) * d, 0.0);
}` },
  bends: { bufs: ["w", "r", "r", "r", "r"], code: `
@group(0) @binding(0) var<storage, read_write> X: array<vec4f>;
@group(0) @binding(1) var<storage, read> W: array<f32>;
@group(0) @binding(2) var<storage, read> I: array<vec4u>;
@group(0) @binding(3) var<storage, read> K: array<vec4f>;
@group(0) @binding(4) var<storage, read> M: array<vec4f>;
${HEAD}
// u: a start, b count; M: the bend it keeps (xyz) and its 1/(w + alpha) (w)
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u.b) { return; }
  let q = u.a + id.x; let ii = I[q]; let k = K[q]; let m = M[q];
  let p0 = X[ii.x].xyz; let p1 = X[ii.y].xyz; let p2 = X[ii.z].xyz; let p3 = X[ii.w].xyz;
  let c = k.x * p0 + k.y * p1 + k.z * p2 + k.w * p3 - m.xyz;
  let s = m.w;
  X[ii.x] = vec4f(p0 - (W[ii.x] * k.x * s) * c, 0.0);
  X[ii.y] = vec4f(p1 - (W[ii.y] * k.y * s) * c, 0.0);
  X[ii.z] = vec4f(p2 - (W[ii.z] * k.z * s) * c, 0.0);
  X[ii.w] = vec4f(p3 - (W[ii.w] * k.w * s) * c, 0.0);
}` },
  tether: { bufs: ["w", "r", "r"], code: `
@group(0) @binding(0) var<storage, read_write> X: array<vec4f>;
@group(0) @binding(1) var<storage, read> W: array<f32>;
@group(0) @binding(2) var<storage, read> T: array<vec2u>;
${HEAD}
// u: a n. A point's anchor is a root of the tethers (its own anchor), never moved here: no two threads touch one point
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.a) { return; }
  let t = T[i]; let a = bitcast<i32>(t.x);
  if (a < 0 || u32(a) == i || W[i] == 0.0) { return; }
  let pa = X[u32(a)].xyz; let d = X[i].xyz - pa; let L = length(d); let D = bitcast<f32>(t.y);
  if (L <= D) { return; }
  X[i] = vec4f(pa + d * (D / L), 0.0);
}` },
  collide: { bufs: ["w", "r", "r", "r"], code: `
@group(0) @binding(0) var<storage, read_write> X: array<vec4f>;
@group(0) @binding(1) var<storage, read> Xp: array<vec4f>;
@group(0) @binding(2) var<storage, read> W: array<f32>;
@group(0) @binding(3) var<storage, read> PL: array<vec4f>;
${HEAD}
// u: a n, c friction. PL: two a point, its skin point and floor (the layers under it), its normal and whether it has one
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.a) { return; }
  if (W[i] == 0.0) { return; }
  let p = PL[2u * i]; let q = PL[2u * i + 1u];
  if (q.w == 0.0) { return; }
  let nrm = q.xyz; var x = X[i].xyz;
  let d = dot(x - p.xyz, nrm) - p.w;
  if (d >= 0.0) { return; }
  x = x - d * nrm;
  var t = x - Xp[i].xyz; t = t - dot(t, nrm) * nrm;
  let tl = length(t); let lim = -u.c * d;
  var stop = 1.0; if (tl > lim) { stop = lim / tl; }
  X[i] = vec4f(x - t * stop, 0.0);
}` },
  floor: { bufs: ["w", "r", "r"], code: `
@group(0) @binding(0) var<storage, read_write> X: array<vec4f>;
@group(0) @binding(1) var<storage, read> W: array<f32>;
@group(0) @binding(2) var<storage, read> RF: array<f32>;
${HEAD}
// u: a n, c and d the rings' middle (x, z): a skirt never comes in past the legs' hull
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= u.a) { return; }
  if (W[i] == 0.0) { return; }
  let x = X[i]; let dx = x.x - u.c; let dz = x.z - u.d; let d = sqrt(dx * dx + dz * dz); let m = RF[i];
  if (d < m && d > 1e-6) { X[i] = vec4f(u.c + dx / d * m, x.y, u.d + dz / d * m, 0.0); }
}` },
};

/** constraints in batches that share no point: {order (the constraints by batch), batches: [{start, count}]} */
export function colour(count, nv, per, at) {
  const WORDS = 8, used = new Uint32Array(nv * WORDS), col = new Uint16Array(count), tally = [];
  for (let k = 0; k < count; k++) {
    let c = -1;
    for (let w = 0; w < WORDS && c < 0; w++) {
      let m = 0; for (let j = 0; j < per; j++) m |= used[at(k, j) * WORDS + w];
      if (~m) c = w * 32 + (31 - Math.clz32(~m & (m + 1)));   // the lowest free bit
    }
    if (c < 0) throw new Error("over 256 batches");
    col[k] = c; tally[c] = (tally[c] || 0) + 1;
    for (let j = 0; j < per; j++) used[at(k, j) * WORDS + (c >> 5)] |= 1 << (c & 31);
  }
  const batches = [], start = []; let s = 0;
  for (let c = 0; c < tally.length; c++) { start[c] = s; if (tally[c]) batches.push({ start: s, count: tally[c] }); s += tally[c] || 0; }
  const order = new Uint32Array(count), fill = start.slice();
  for (let k = 0; k < count; k++) order[fill[col[k]]++] = k;
  return { order, batches };
}

/**
 * The drape's steps on the card for a drape prepared by drape.js (`prepare`). `every`: steps between readbacks (the
 * planes asked again, still-ness measured, progress told); `progress(frac)`; `alive()`: false stops it (a newer job).
 * Returns what drape.js's `draping` would ({P, stats}, stats.gpu saying how), or null: no card (gpuState().why) or stopped.
 */
export async function drapeGPU(S, opts = {}) {
  const dev = await gpuDevice(); if (!dev) return null;
  const { device } = dev, every = Math.max(1, opts.every ?? 8), alive = opts.alive || (() => true), t0 = performance.now();
  const { o, n, X, W, E, ne, L0, bI, bK, bD, bC, nb, TT, SE, c, RF, steps, g, cs, iters, h, rings } = S;
  const made = [], buf = (data, usage, size) => {
    const b = device.createBuffer({ size: Math.max(16, size ?? data.byteLength), usage, mappedAtCreation: !!data });
    if (data) { new data.constructor(b.getMappedRange()).set(data); b.unmap(); }
    made.push(b); return b;
  };
  const ST = GPUBufferUsage.STORAGE, CP = GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  try {
    // the cloth as the card keeps it: points as vec4 (xyz), constraints by batch
    const X4 = new Float32Array(n * 4); for (let i = 0; i < n; i++) { X4[i * 4] = X[i * 3]; X4[i * 4 + 1] = X[i * 3 + 1]; X4[i * 4 + 2] = X[i * 3 + 2]; }
    const bX = buf(X4, ST | CP), bXp = buf(X4, ST | CP), bW = buf(Float32Array.from(W), ST), bV = buf(null, ST | CP, n * 4);
    const ns = SE.L.length, EC = colour(ne, n, 2, (k, j) => (j ? E.B[k] : E.A[k])), SC = colour(ns, n, 2, (k, j) => (j ? SE.B[k] : SE.A[k]));
    const C = new Uint32Array((ne + ns) * 4), Cf = new Float32Array(C.buffer);
    EC.order.forEach((e, k) => { C[k * 4] = E.A[e]; C[k * 4 + 1] = E.B[e]; Cf[k * 4 + 2] = L0[e]; });
    SC.order.forEach((e, k) => { const q = (ne + k) * 4; C[q] = SE.A[e]; C[q + 1] = SE.B[e]; Cf[q + 2] = SE.L[e]; });
    const BC = colour(nb, n, 4, (k, j) => bI[k * 4 + j]), BI = new Uint32Array(nb * 4), BK = new Float32Array(nb * 4), BM = new Float32Array(nb * 4);
    BC.order.forEach((q, k) => { for (let j = 0; j < 4; j++) { BI[k * 4 + j] = bI[q * 4 + j]; BK[k * 4 + j] = bK[q * 4 + j]; } BM[k * 4] = bC[q * 3]; BM[k * 4 + 1] = bC[q * 3 + 1]; BM[k * 4 + 2] = bC[q * 3 + 2]; BM[k * 4 + 3] = bD[q]; });
    const T2 = new Uint32Array(n * 2), T2f = new Float32Array(T2.buffer), T2i = new Int32Array(T2.buffer);
    for (let i = 0; i < n; i++) { T2i[i * 2] = TT.A[i]; T2f[i * 2 + 1] = TT.D[i]; }
    const bC4 = buf(C, ST), bBI = buf(BI, ST), bBK = buf(BK, ST), bBM = buf(BM, ST), bT = buf(T2, ST), bRF = RF && rings ? buf(Float32Array.from(RF), ST) : null;
    const PL8 = new Float32Array(n * 8), planes = (list) => {
      for (const i of list) { const p = i * 7, q = i * 8; PL8[q] = c.PL[p]; PL8[q + 1] = c.PL[p + 1]; PL8[q + 2] = c.PL[p + 2]; PL8[q + 3] = c.PL[p + 6]; PL8[q + 4] = c.PL[p + 3]; PL8[q + 5] = c.PL[p + 4]; PL8[q + 6] = c.PL[p + 5]; PL8[q + 7] = c.HAS[i]; }
    };
    planes(Array.from({ length: n }, (_, i) => i));
    const bPL = buf(PL8, ST | CP);
    // the uniforms: one 256-byte slot each, chosen by a dynamic offset: a step's (its damping), a batch's, the points'
    const batches = [...EC.batches.map(b => ({ ...b, cs })), ...SC.batches.map(b => ({ start: b.start + ne, count: b.count, cs: 0 }))];
    const nslot = steps + batches.length + BC.batches.length + 2, U = new ArrayBuffer(nslot * 256), du = new DataView(U);
    const slot = (k, a, b, cc, d, bf = false) => { du.setUint32(k * 256, a, true); if (bf) du.setFloat32(k * 256 + 4, b, true); else du.setUint32(k * 256 + 4, b, true); du.setFloat32(k * 256 + 8, cc, true); du.setFloat32(k * 256 + 12, d, true); };
    for (let s = 0; s < steps; s++) slot(s, n, g, Math.exp(-(o.damp + 30 * smooth(0.6, 1, s / steps)) * h), h, true);   // as drape.js: settled harder at the end
    batches.forEach((b, k) => slot(steps + k, b.start, b.count, b.cs, 0));
    BC.batches.forEach((b, k) => slot(steps + batches.length + k, b.start, b.count, 0, 0));
    const PTS = nslot - 2, FLOOR = nslot - 1; slot(PTS, n, 0, o.friction, 0); slot(FLOOR, n, 0, rings?.cx ?? 0, rings?.cz ?? 0);   // the points' (friction), a skirt floor's (the rings' middle)
    const bU = buf(new Uint8Array(U), GPUBufferUsage.UNIFORM);
    const uLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 16 } }] });
    const uGroup = device.createBindGroup({ layout: uLayout, entries: [{ binding: 0, resource: { buffer: bU, offset: 0, size: 16 } }] });
    const K = {};
    for (const [name, k] of Object.entries(KERNELS)) {
      if (name === "floor" && !bRF) continue;
      const layout = device.createBindGroupLayout({ entries: k.bufs.map((t, b) => ({ binding: b, visibility: GPUShaderStage.COMPUTE, buffer: { type: t === "w" ? "storage" : "read-only-storage" } })) });
      const pipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [layout, uLayout] }), compute: { module: device.createShaderModule({ code: k.code }), entryPoint: "main" } });
      K[name] = { pipe, layout };
    }
    const group = (name, list) => device.createBindGroup({ layout: K[name].layout, entries: list.map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    const G = { predict: group("predict", [bX, bXp, bW, bV]), lengths: group("lengths", [bX, bW, bC4]), bends: group("bends", [bX, bW, bBI, bBK, bBM]),
                tether: group("tether", [bX, bW, bT]), collide: group("collide", [bX, bXp, bW, bPL]), ...(bRF ? { floor: group("floor", [bX, bW, bRF]) } : {}) };
    const rX = buf(null, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, n * 16), rV = buf(null, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, n * 4);
    const groups = x => Math.ceil(x / WG), run = (pass, name, grp, sl, count) => { pass.setPipeline(K[name].pipe); pass.setBindGroup(0, grp); pass.setBindGroup(1, uGroup, [sl * 256]); pass.dispatchWorkgroups(groups(count)); };
    const speed = [0, 0];
    let step = 0, asked = 0, reads = 0, dispatches = 0, stopped = false;
    while (step < steps) {
      const upto = Math.min(steps, step + every), enc = device.createCommandEncoder(), pass = enc.beginComputePass();
      for (let s = step; s < upto; s++) {
        run(pass, "predict", G.predict, s, n);
        for (let it = 0; it < iters; it++) {
          batches.forEach((b, k) => run(pass, "lengths", G.lengths, steps + k, b.count));
          BC.batches.forEach((b, k) => run(pass, "bends", G.bends, steps + batches.length + k, b.count));
        }
        run(pass, "tether", G.tether, PTS, n);
        run(pass, "collide", G.collide, PTS, n);
        if (bRF) run(pass, "floor", G.floor, FLOOR, n);
        dispatches += 3 + iters * (batches.length + BC.batches.length) + (bRF ? 1 : 0);
      }
      pass.end();
      enc.copyBufferToBuffer(bX, 0, rX, 0, n * 16); enc.copyBufferToBuffer(bV, 0, rV, 0, n * 4);
      device.queue.submit([enc.finish()]);
      await Promise.all([rX.mapAsync(GPUMapMode.READ), rV.mapAsync(GPUMapMode.READ)]); reads++;
      const x4 = new Float32Array(rX.getMappedRange()), v = new Float32Array(rV.getMappedRange());
      for (let i = 0; i < n; i++) { X[i * 3] = x4[i * 4]; X[i * 3 + 1] = x4[i * 4 + 1]; X[i * 3 + 2] = x4[i * 4 + 2]; }
      let fast = 0, sum = 0; for (let i = 0; i < n; i++) { sum += v[i]; if (v[i] > fast) fast = v[i]; }
      rX.unmap(); rV.unmap();
      speed[0] = Math.sqrt(fast); speed[1] = Math.sqrt(sum / n);
      step = upto;
      if (!alive()) { stopped = true; break; }
      if ((step - 1) / steps > 0.4 && speed[1] < 0.002 && speed[0] < 0.05) break;   // still (drape.js's test, at the readback)
      // the planes asked again where a point has gone further than it may from where it last asked (drape.js collide)
      const moved = [];
      for (let i = 0; i < n; i++) {
        if (W[i] === 0) continue;
        const i3 = i * 3, ax = X[i3] - c.ASK[i3], ay = X[i3 + 1] - c.ASK[i3 + 1], az = X[i3 + 2] - c.ASK[i3 + 2];
        if (ax * ax + ay * ay + az * az > c.FREE[i]) { ask(c, i); moved.push(i); }
      }
      asked += moved.length;
      if (moved.length) { planes(moved); device.queue.writeBuffer(bPL, 0, PL8); }
      opts.progress?.(step / steps);
    }
    if (stopped) return null;
    return finish(S, step, asked, speed, { gpu: { adapter: dev.name, fallback: dev.fallback, every, reads, dispatches, batches: { lengths: EC.batches.length, buttoned: SC.batches.length, bends: BC.batches.length }, ms: Math.round(performance.now() - t0) } });
  } finally {
    for (const b of made) b.destroy();
  }
}

/**
 * The card's way on the CPU, in float64 with drape.js's own passes: the constraints in the same batches in the same
 * order, the planes asked every `every` steps, still-ness tested there. What drapeGPU gives back should match it to
 * float32's round-off (GPUDRAPE holds the kernels to it); what it gives back against drape.js's own loop differs by the
 * order alone (measured: the skirt's points 3 mm apart on the whole, 14 mm for one in ten: the folds placed a little
 * differently, as hung as well). A tool for tuning the card's way without a card.
 */
export function likeGPU(S, opts = {}) {
  const every = Math.max(1, opts.every ?? 8), { o, n, X, Xp, W, E, ne, L0, bI, bK, bD, bC, nb, TT, SE, c, RF, steps, g, cs, iters, h, rings } = S;
  const EC = colour(ne, n, 2, (k, j) => (j ? E.B[k] : E.A[k])), SC = colour(SE.L.length, n, 2, (k, j) => (j ? SE.B[k] : SE.A[k])), BC = colour(nb, n, 4, (k, j) => bI[k * 4 + j]);
  const A = Uint32Array.from(EC.order, e => E.A[e]), Bv = Uint32Array.from(EC.order, e => E.B[e]), L = Float64Array.from(EC.order, e => L0[e]);
  const SA = Uint32Array.from(SC.order, e => SE.A[e]), SB = Uint32Array.from(SC.order, e => SE.B[e]), SL = Float64Array.from(SC.order, e => SE.L[e]);
  const bi = new Uint32Array(nb * 4), bk = new Float64Array(nb * 4), bd = new Float64Array(nb), bc = new Float64Array(nb * 3);
  BC.order.forEach((q, k) => { for (let j = 0; j < 4; j++) { bi[k * 4 + j] = bI[q * 4 + j]; bk[k * 4 + j] = bK[q * 4 + j]; } bd[k] = bD[q]; for (let j = 0; j < 3; j++) bc[k * 3 + j] = bC[q * 3 + j]; });
  const never = new Float64Array(n).fill(Infinity), speed = [0, 0];
  let step = 0, asked = 0;
  while (step < steps) {
    const upto = Math.min(steps, step + every);
    for (; step < upto; step++) {
      predict(X, Xp, W, n, g, Math.exp(-(o.damp + 30 * smooth(0.6, 1, step / steps)) * h), h, speed);
      for (let it = 0; it < iters; it++) { lengths(X, W, A, Bv, L, ne, cs); seams(X, W, SA, SB, SL, SL.length); bends(X, W, bi, bk, bd, bc, nb); }
      tether(X, W, TT.A, TT.D, n);
      const free = c.FREE; c.FREE = never; collide(c, o.friction); c.FREE = free;   // (the planes as last asked)
      if (RF) floorRings(X, W, n, RF, rings);
    }
    if ((step - 1) / steps > 0.4 && speed[1] < 0.002 && speed[0] < 0.05) break;
    for (let i = 0; i < n; i++) {
      if (W[i] === 0) continue;
      const i3 = i * 3, ax = X[i3] - c.ASK[i3], ay = X[i3 + 1] - c.ASK[i3 + 1], az = X[i3 + 2] - c.ASK[i3 + 2];
      if (ax * ax + ay * ay + az * az > c.FREE[i]) { ask(c, i); asked++; }
    }
  }
  return finish(S, step, asked, speed, { like: "gpu", every });
}
