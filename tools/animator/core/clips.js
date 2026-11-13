// Animator v2: a clip as tracks (docs/ANIMATOR_V2.md §8). A clip's maker gives controls a frame; here each frame is
// built into a pose and the poses become what a file holds: for each bone that moves, its own rotation a frame (and a
// translation for the pelvis and the soft bones). Only the body's bones: never the eyes, the jaw, the tongue, a hair
// or an ear chain (the face and the springs stay their own layers, to mix with any body clip), and no morph target.
import { Q } from "./m.js";
import { build } from "./pose.js";

const NEVER = /(^|_)(eye|jaw|teeth|tongue)|^jiggle_|_null$/;
export const isBodyBone = name => !NEVER.test(name);

/** the poses of a clip, frame by frame: [{ pose, solved: { D, P }, c }] (a loop's frames 0 .. n-1; a one-shot's all) */
export function poses(rig, clip, tweak = null) {
  const out = [];
  for (let f = 0; f < clip.n; f++) { const c = clip.ctrl(f); if (tweak) tweak(c, f); const pose = build(rig, c); out.push({ pose, solved: pose.solve(), c }); }
  return out;
}

/** frames (poses()) as tracks: { name, loop, fps, secs, keys, times, tracks: [{ joint, r: Float32Array, t?, s? }] }.
    A loop gets its first frame again as its last key, so a player that wraps finds the same pose at both ends. */
export function tracksOf(rig, clip, frames) {
  const n = frames.length, keys = clip.loop ? n + 1 : n, nj = rig.J.length, loc = frames.map(f => f.pose.locals(f.solved));
  const times = new Float32Array(keys); for (let k = 0; k < keys; k++) times[k] = k / clip.fps;
  const tracks = [];
  for (let j = 0; j < nj; j++) {
    const name = rig.J[j].name; if (!isBodyBone(name)) continue;
    const r = new Float32Array(keys * 4); let moves = false, prev = null; const r0 = Q.norm(Q.mul(Q.conj(rig.J[j].parent >= 0 ? rig.J[rig.J[j].parent].q0 : [0, 0, 0, 1]), rig.J[j].q0));
    for (let k = 0; k < keys; k++) { let q = loc[k % n][j].r; if (prev && q[0] * prev[0] + q[1] * prev[1] + q[2] * prev[2] + q[3] * prev[3] < 0) q = [-q[0], -q[1], -q[2], -q[3]]; prev = q; r.set(q, k * 4);
      if (Math.abs(Math.abs(q[0] * r0[0] + q[1] * r0[1] + q[2] * r0[2] + q[3] * r0[3]) - 1) > 1e-7) moves = true; }
    const tr = { joint: j }; if (moves) tr.r = r;
    if (loc[0][j].t) { const t = new Float32Array(keys * 3); for (let k = 0; k < keys; k++) t.set(loc[k % n][j].t, k * 3); tr.t = t; }
    if (loc[0][j].s) { const s = new Float32Array(keys * 3); for (let k = 0; k < keys; k++) s.set(loc[k % n][j].s || [1, 1, 1], k * 3); tr.s = s; }
    if (tr.r || tr.t || tr.s) tracks.push(tr);
  }
  return { name: clip.name, loop: !!clip.loop, fps: clip.fps, secs: (keys - 1) / clip.fps, keys, times, tracks, meta: clip.meta || {}, events: clip.events || [], speed: clip.speed || 0 };
}
