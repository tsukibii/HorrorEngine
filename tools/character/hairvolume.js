// The hair as a volume, for the salon's bake (docs/SALON.md, The bake; docs/GODOT_LOOK.md §5c): every card's vertices
// splatted into a grid with the head and body filled in, blurred into a smooth density, and from it, for each card
// vertex, a shell normal (the volume's outward direction blended with the card's own face, so the cards shade as one
// soft mass instead of stripes card to card: foliage's "normals from a master surface", what soft card hair does in
// Unreal and elsewhere: docs/research/hair_cards_unreal.md §1) and an occlusion (how much of the sky it sees through
// the hair and past the head: the inner layers, the roots and the underside darker; §6). Plain arrays, no three.js, so
// node can check it.
//
//   const V = volume(positions, solid, o)   positions: flat x, y, z of every card vertex (the head's local metres);
//                                           solid(p) true inside the head or body; o.cell (m), o.blur (m)
//   shell(V, positions, faces, mix)         Float32Array of normals: the volume's own, `mix` of it (0.8) over the
//                                           card's face normal (faces, flipped to agree)
//   occlusion(V, positions, normals, o)     Float32Array, 1 open to 0 shut: rays over the hemisphere round each normal
//                                           marched through the density (o.reach m, o.dirs)

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function volume(pos, solid, o = {}) {
  const cell = o.cell ?? 0.008, pad = o.pad ?? 0.04, blur = o.blur ?? 0.012, gain = o.gain ?? 0.6;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i + a]); hi[a] = Math.max(hi[a], pos[i + a]); }
  if (!isFinite(lo[0])) { lo = [-0.1, -0.1, -0.1]; hi = [0.1, 0.1, 0.1]; }
  lo = lo.map(x => x - pad); hi = hi.map(x => x + pad);
  const n = lo.map((x, a) => Math.max(2, Math.ceil((hi[a] - x) / cell) + 1)), [nx, ny, nz] = n, N = nx * ny * nz;
  const count = new Float32Array(N);
  for (let i = 0; i < pos.length; i += 3) {                            // each vertex splatted with trilinear weights
    const fx = (pos[i] - lo[0]) / cell, fy = (pos[i + 1] - lo[1]) / cell, fz = (pos[i + 2] - lo[2]) / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz), tx = fx - x0, ty = fy - y0, tz = fz - z0;
    for (let c = 0; c < 8; c++) {
      const x = x0 + (c & 1), y = y0 + ((c >> 1) & 1), z = z0 + ((c >> 2) & 1);
      if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue;
      count[(z * ny + y) * nx + x] += (c & 1 ? tx : 1 - tx) * ((c >> 1) & 1 ? ty : 1 - ty) * ((c >> 2) & 1 ? tz : 1 - tz);
    }
  }
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = 1 - Math.exp(-count[i] * gain);  // a few vertices to a cell make it dense
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {   // the head and body are solid
    if (solid && solid([lo[0] + x * cell, lo[1] + y * cell, lo[2] + z * cell])) d[(z * ny + y) * nx + x] = 1;
  }
  const r = Math.max(1, Math.round(blur / cell)), t = new Float32Array(N);
  for (let pass = 0; pass < 2; pass++) for (let ax = 0; ax < 3; ax++) {   // two box passes a side: close to a Gaussian
    const st = ax === 0 ? 1 : ax === 1 ? nx : nx * ny, len = n[ax];
    for (let i = 0; i < N; i++) {
      const k = Math.floor(i / st) % len; let s = 0, m = 0;
      for (let j = -r; j <= r; j++) { const kk = k + j; if (kk < 0 || kk >= len) continue; s += d[i + j * st]; m++; }
      t[i] = s / m;
    }
    d.set(t);
  }
  return { d, n, lo, cell };
}

export function sample(V, x, y, z) {
  const { d, n, lo, cell } = V, [nx, ny, nz] = n;
  const fx = clamp((x - lo[0]) / cell, 0, nx - 1.001), fy = clamp((y - lo[1]) / cell, 0, ny - 1.001), fz = clamp((z - lo[2]) / cell, 0, nz - 1.001);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz), tx = fx - x0, ty = fy - y0, tz = fz - z0;
  const at = (a, b, c) => d[((z0 + c) * ny + (y0 + b)) * nx + (x0 + a)];
  const c00 = at(0, 0, 0) * (1 - tx) + at(1, 0, 0) * tx, c10 = at(0, 1, 0) * (1 - tx) + at(1, 1, 0) * tx;
  const c01 = at(0, 0, 1) * (1 - tx) + at(1, 0, 1) * tx, c11 = at(0, 1, 1) * (1 - tx) + at(1, 1, 1) * tx;
  return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
}

// the density's falling direction at p: outward from the mass (a unit vector, or null where it's flat)
export function outward(V, x, y, z) {
  const h = V.cell;
  const g = [sample(V, x - h, y, z) - sample(V, x + h, y, z), sample(V, x, y - h, z) - sample(V, x, y + h, z), sample(V, x, y, z - h) - sample(V, x, y, z + h)];
  const l = Math.hypot(g[0], g[1], g[2]);
  return l > 1e-6 ? g.map(v => v / l) : null;
}

export function shell(V, pos, faces, mix = 0.8) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const f = [faces[i], faces[i + 1], faces[i + 2]], o = outward(V, pos[i], pos[i + 1], pos[i + 2]) || f;
    const s = f[0] * o[0] + f[1] * o[1] + f[2] * o[2] < 0 ? -1 : 1;  // the card's face turned to the volume's side
    const m = [mix * o[0] + (1 - mix) * s * f[0], mix * o[1] + (1 - mix) * s * f[1], mix * o[2] + (1 - mix) * s * f[2]], l = Math.hypot(...m) || 1;
    out[i] = m[0] / l; out[i + 1] = m[1] / l; out[i + 2] = m[2] / l;
  }
  return out;
}

// a fixed spread of directions over the hemisphere round +z (cosine-weighted), turned onto each normal
function hemisphere(k) {
  const dirs = [];
  for (let i = 0; i < k; i++) {
    const u = (i + 0.5) / k, phi = i * 2.399963, r = Math.sqrt(u);   // the golden angle round, cosine-weighted out
    dirs.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(Math.max(0, 1 - u))]);
  }
  return dirs;
}
export function occlusion(V, pos, nrm, o = {}) {
  const reach = o.reach ?? 0.06, step = o.step ?? V.cell, k = o.dirs ?? 12, absorb = o.absorb ?? 55, dirs = hemisphere(k);
  const out = new Float32Array(pos.length / 3);
  for (let i = 0, v = 0; i < pos.length; i += 3, v++) {
    const N = [nrm[i], nrm[i + 1], nrm[i + 2]];
    const a = Math.abs(N[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];          // a frame round the normal
    let T = [N[1] * a[2] - N[2] * a[1], N[2] * a[0] - N[0] * a[2], N[0] * a[1] - N[1] * a[0]]; const tl = Math.hypot(...T); T = T.map(x => x / tl);
    const B = [N[1] * T[2] - N[2] * T[1], N[2] * T[0] - N[0] * T[2], N[0] * T[1] - N[1] * T[0]];
    let open = 0;
    for (const q of dirs) {
      const D = [T[0] * q[0] + B[0] * q[1] + N[0] * q[2], T[1] * q[0] + B[1] * q[1] + N[1] * q[2], T[2] * q[0] + B[2] * q[1] + N[2] * q[2]];
      let tau = 0;
      for (let s = step * 0.75; s <= reach; s += step) tau += sample(V, pos[i] + D[0] * s, pos[i + 1] + D[1] * s, pos[i + 2] + D[2] * s) * step;
      open += Math.exp(-tau * absorb);
    }
    out[v] = open / k;
  }
  return out;
}
