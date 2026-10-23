// The salon's locked reference (docs/SALON_PLAN.md, Phase 1): a video's frames with a camera each in the head's local
// space (tools/character/gshair/reference.py writes them), turned into cameras on the salon's head, the nearest one to
// where the user looks picked, and the hand fit applied. Plain arrays (3x3 as rows), no three.js.
//
// The head's local space: the origin between the ears, X to the character's left, Y up the face, Z forward, units of
// MHR's base face height (metres on the base body). headFrame(points, anchors) finds it on any MHR body.
// Cameras are OpenCV's: world to camera x_c = R p + t, x right, y down, z forward; K = [fx, fy, cx, cy] in the frame's pixels.
//
// The fit (saved with the hair): offset (local metres), scale (the reference's size), turn and height (degrees: the
// reference's world turned about the head's up axis, tilted about its left axis), flip (the turn went the other way),
// sweep (the turn's degrees scaled), cover (the degrees of the turn used from the first frame), mirror (angles the video never reached are filled by mirrored frames), per_frame
// ({name: [scale, dx, dy]} a photo's own nudge, in its pixels).

export const FACE_H = 0.1653;
export const DEFAULT_ANCHORS = { right: 4113, left: 1227, top: 2796, chin: 2834 };
export const DEFAULT_FIT = { offset: [0, 0, 0], scale: 1, turn: 0, height: 0, flip: false, sweep: 1, cover: 360, mirror: true, per_frame: {} };
const D = Math.PI / 180;

export const T = A => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]];
export const MM = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export const MV = (A, v) => A.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
export const Ry = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
export const Rx = a => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const FX = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];

// the head's frame on a body (points: a flat array, metres): C the origin, B the axes as columns, S the size against MHR's
export function headFrame(P, a = DEFAULT_ANCHORS) {
  const v = k => [P[a[k] * 3], P[a[k] * 3 + 1], P[a[k] * 3 + 2]];
  const r = v("right"), l = v("left"), top = v("top"), chin = v("chin");
  let X = [l[0] - r[0], l[1] - r[1], l[2] - r[2]]; const xl = Math.hypot(...X); X = X.map(x => x / xl);
  let U = [top[0] - chin[0], top[1] - chin[1], top[2] - chin[2]]; const h = Math.hypot(...U);
  const ux = U[0] * X[0] + U[1] * X[1] + U[2] * X[2]; U = U.map((u, i) => u - X[i] * ux); const ul = Math.hypot(...U); U = U.map(u => u / ul);
  const F = [X[1] * U[2] - X[2] * U[1], X[2] * U[0] - X[0] * U[2], X[0] * U[1] - X[1] * U[0]];
  return { C: [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2, (r[2] + l[2]) / 2], B: [[X[0], U[0], F[0]], [X[1], U[1], F[1]], [X[2], U[2], F[2]]], S: h / FACE_H };
}
export const toLocal = (hf, p) => { const d = [p[0] - hf.C[0], p[1] - hf.C[1], p[2] - hf.C[2]]; return MV(T(hf.B), d).map(x => x / hf.S); };
export const toWorld = (hf, q) => { const w = MV(hf.B, q); return [hf.C[0] + w[0] * hf.S, hf.C[1] + w[1] * hf.S, hf.C[2] + w[2] * hf.S]; };

export const centre = (R, t) => MV(T(R), t).map(x => -x);
export const azel = c => [Math.atan2(c[0], c[2]) / D, Math.atan2(c[1], Math.hypot(c[0], c[2])) / D];

// one frame's camera in the salon head's local space, with the fit; mirrored: the frame flipped across the head's middle
export function frameCamera(ref, i, fit = DEFAULT_FIT, mirrored = false) {
  const f = ref.frames[i], [W, H] = ref.size || [2 * f.K[2], 2 * f.K[3]];
  let R = f.R.map(r => r.slice()), t = f.t.slice(), K = f.K.slice(), az = f.az;
  if (mirrored) { R = MM(MM(FX, R), FX); t = [-t[0], t[1], t[2]]; K[2] = W - K[2]; az = -az; }
  // the turn's direction and amount: the camera turned about U from its angle to the corrected one
  const want = (fit.flip ? -az : az) * (fit.sweep ?? 1), delta = (want - az) * D;
  if (delta) R = MM(R, T(Ry(delta)));
  // the fit: the reference's world turned, tilted, scaled and moved onto the head
  const Rf = MM(Ry((fit.turn || 0) * D), Rx(-(fit.height || 0) * D)), k = fit.scale || 1, o = fit.offset || [0, 0, 0];
  R = MM(R, T(Rf));
  const Ro = MV(R, o); t = [k * t[0] - Ro[0], k * t[1] - Ro[1], k * t[2] - Ro[2]];
  const pf = (fit.per_frame || {})[f.name];
  if (pf) { const [s, dx, dy] = pf; K = [K[0] * s, K[1] * s, K[2] * s + dx, K[3] * s + dy]; }
  return { i, name: f.name, R, t, K, W, H, mirrored, nudge: pf || [1, 0, 0], az: azel(centre(R, t))[0], el: azel(centre(R, t))[1], file: f.file, keyed: f.keyed };
}

// every frame's camera (and its mirror when the fit fills the far side), for picking
export function cameras(ref, fit = DEFAULT_FIT) {
  const out = [], turned = unwrapped(ref), cover = fit.cover ?? 360;
  for (let i = 0; i < ref.frames.length; i++) {
    if (Math.abs(turned[i]) > cover + 1e-6) continue;               // past the part of the turn in use
    out.push(frameCamera(ref, i, fit, false));
    if (fit.mirror) out.push(frameCamera(ref, i, fit, true));
  }
  return out;
}

// how far round the turn each frame is from the first, in the frames' order (degrees, unwrapped)
export function unwrapped(ref) {
  const out = [0];
  for (let i = 1; i < ref.frames.length; i++) { let d = ref.frames[i].az - ref.frames[i - 1].az; d -= 360 * Math.round(d / 360); out.push(out[i - 1] + d); }
  return out;
}

// the camera nearest to looking from dir (local, from the head's origin): a mirrored frame only wins by a margin, so the
// real frames are used wherever the video reached
export function nearest(cams, dir, margin = 3, skip = null) {
  const dl = Math.hypot(...dir), d = dir.map(x => x / dl);
  let best = null, bestA = Infinity;
  for (const c of cams) {
    if (skip && skip(c)) continue;
    const p = centre(c.R, c.t), pl = Math.hypot(...p);
    const a = Math.acos(Math.max(-1, Math.min(1, (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]) / pl))) / D + (c.mirrored ? margin : 0);
    if (a < bestA) { bestA = a; best = c; }
  }
  return best ? Object.assign({ angle: bestA - (best.mirrored ? margin : 0) }, best) : null;
}

// a local camera onto the salon's world (the head's frame): R_w, t_w, and its centre
export function worldCamera(cam, hf) {
  const Rw = MM(cam.R, T(hf.B)), Rc = MV(Rw, hf.C);
  const t = [hf.S * cam.t[0] - Rc[0], hf.S * cam.t[1] - Rc[1], hf.S * cam.t[2] - Rc[2]];
  return { R: Rw, t, C: centre(Rw, t) };
}

// OpenGL's projection for a camera with these pixels in a view W x H (principal point at cx, cy in the view), as rows
export function projection(fx, fy, cx, cy, W, H, near = 0.02, far = 30) {
  return [[2 * fx / W, 0, 1 - 2 * cx / W, 0], [0, 2 * fy / H, 2 * cy / H - 1, 0], [0, 0, -(far + near) / (far - near), -2 * far * near / (far - near)], [0, 0, -1, 0]];
}
