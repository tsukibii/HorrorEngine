// TAU's brows and lashes on a Character Studio character (tools/tau_hair.py, docs/TAU_HAIR.md; TAU's Procedural Human
// Hair, CC BY-SA 4.0, by TAU): the strands TAU's generators grew on the character's export, each pinned to an MHR
// triangle at its root, rebuilt here on the face as it is now (POS: the sliders, the sculpt, the face's fit and its
// expressions), so they ride every edit and every blink. The frame is the pinning's own: x along the triangle's first
// edge, z its normal (MHR's winding), y across, each axis the triangle's size (the square root of twice its area), so a
// strand follows the face's scale and its local stretch. Plain arrays in and out.
//
//   strandsNow(set, P, TRIS) -> { brows, lashes }: each [{ pts: [[x,y,z]...], radius: [m...], normal: [x,y,z] }...]
//     set: strands.json as read; P: the body's points (x,y,z each); TRIS: MHR's triangles (three point indices each)

export const TAU_BROWS = ["Natural", "Bushy", "Feather", "Fluffy", "Laminated"];   // TAU's presets (tools/tau_hair.py presets)
export const TAU_LASHES = ["Straight", "Clumped", "Fox", "Manga", "Volume"];

function frameAt(P, TRIS, tri) {
  const a = TRIS[tri * 3] * 3, b = TRIS[tri * 3 + 1] * 3, c = TRIS[tri * 3 + 2] * 3;
  const A = [P[a], P[a + 1], P[a + 2]], B = [P[b], P[b + 1], P[b + 2]], C = [P[c], P[c + 1], P[c + 2]];
  const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ac = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const lc = Math.hypot(...cr) || 1e-12, la = Math.hypot(...ab) || 1e-12, size = Math.sqrt(lc);
  const e1 = ab.map(v => v / la * size), nz = cr.map(v => v / lc), e2 = [nz[1] * e1[2] - nz[2] * e1[1], nz[2] * e1[0] - nz[0] * e1[2], nz[0] * e1[1] - nz[1] * e1[0]];
  return { A, B, C, e1, e2, nz: nz.map(v => v * size), n: nz };
}

export function strandsNow(set, P, TRIS) {
  const out = {};
  for (const kind of ["brows", "lashes"]) {
    const S = set && set[kind]; if (!S) continue;
    out[kind] = S.strands.map((s, i) => {
      const f = frameAt(P, TRIS, s.tri), b = s.bary;
      const O = [0, 1, 2].map(k => b[0] * f.A[k] + b[1] * f.B[k] + b[2] * f.C[k]);
      const pts = s.offsets.map(o => [0, 1, 2].map(k => O[k] + o[0] * f.e1[k] + o[1] * f.e2[k] + o[2] * f.nz[k]));
      return { pts, radius: S.radius[i], normal: f.n };
    });
  }
  return out;
}
