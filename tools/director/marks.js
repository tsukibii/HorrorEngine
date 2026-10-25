// Marks on a level, for blocking by mouse (blocking.js): which room a point is in, a new spot there (its id unique in the
// file, at the room's own coordinates), and the story's facing from one point toward another. No DOM, no three.js: DESK
// tests them.
import { allIds } from "./refs.js";

const r2 = v => Math.round(v * 100) / 100;
export function facingRot(from, to) {              // the story's rot (degrees, 0 east, 90 north) from one point toward another
  if (!from || !to) return 0;
  const d = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
  return Math.round((d + 360) % 360);
}
export function roomAt(level, x, y, z = null) {     // the room whose floor holds the point (the nearest floor below, on stairs)
  let best = null;
  for (const r of (level && level.rooms) || []) {
    const [x0, y0, z0] = r.at || [0, 0, 0], [w, d] = r.size || [0, 0];
    if (x < x0 - 1e-6 || x > x0 + w + 1e-6 || y < y0 - 1e-6 || y > y0 + d + 1e-6) continue;
    const dz = z === null ? 0 : Math.abs(z - (z0 || 0));
    if (!best || dz < best.dz) best = { r, dz };
  }
  return best ? best.r : null;
}
export function newSpot(S, lvl, room, x, y, rot, stem) {    // a mark in the room, its id unique in the file
  const taken = allIds(S); let id = stem, n = 2; while (taken.has(id)) id = `${stem}_${n++}`;
  const [x0, y0] = room.at || [0, 0];
  (room.props = room.props || []).push({ id, use: "spot", at: [r2(x - x0), r2(y - y0)], rot });
  return id;
}
