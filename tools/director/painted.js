// The placeholder things painted on their templates (tools/uv_templates.py, HANDOFF_DIRECTOR_TODO §6): a block's UVs
// laid from its template's layout, by the same rule as uv_templates.uv_of, so a picture painted on the template lands
// on the block exactly (UVTEMPLATES checks the two agree, face for face). Axes are the story's in the block's own
// frame: x east, y north, z up, its front facing south (-y); three.js has x, y up, z south.
const AX = { x: 0, y: 1, z: 2 };
// a face by its outward normal (story axes)
export const faceOf = n => (n[0] > 0.5 ? "right" : n[0] < -0.5 ? "left" : n[2] > 0.5 ? "top" : n[2] < -0.5 ? "bottom" : n[1] < -0.5 ? "front" : "back");
// the UV of a point p on a face of the block (its middle at 0): u across the picture, v up from its bottom
export function uvOf(lay, face, p) {
  let f = lay.faces[face]; if (f && f.of) f = lay.faces[f.of];
  if (!f) return [0, 0];
  const [W, H] = lay.canvas, s = lay.size, [ua, us] = f.u, [va, vs] = f.v, [x0, y0, x1, y1] = f.rect;
  const lu = 0.5 + us * p[AX[ua]] / s[AX[ua]], lv = 0.5 + vs * p[AX[va]] / s[AX[va]];
  return [(x0 + lu * (x1 - x0)) / W, 1 - (y1 - lv * (y1 - y0)) / H];
}
// a three.js box's UVs (its position, normal and uv attributes) laid from the layout
export function layUVs(position, normal, uv, lay) {
  for (let i = 0; i < position.count; i++) {
    const p = [position.getX(i), -position.getZ(i), position.getY(i)], n = [normal.getX(i), -normal.getZ(i), normal.getY(i)];
    const [u, v] = uvOf(lay, faceOf(n), p); uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}
