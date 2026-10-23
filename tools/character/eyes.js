// The eyes' paint (Character Studio): the eyeball's texture drawn in polar coordinates round the front pole: an iris with two
// tones, fibres and a pale ring, a dark limbal ring, a pupil, catchlights, a sclera that darkens toward the rim and
// goes pink at the corners; and how wet it looks. Our own code. Each eye gets its own texture: the pink corner is the inner one.
import * as THREE from "three";

export const EYE_COLOURS = [["iris", "Iris (rim)", "#3b2618"], ["iris2", "Iris (round the pupil)", "#7a5a3a"], ["sclera", "Sclera", "#f4efe9"], ["corner", "Corner tint", "#e08a8a"]];
export const EYE_CONTROLS = [   // [key, label, lo, hi, step, default, help]
  ["irisSize", "Iris size", 20, 46, 0.5, 31, "The iris's angle round the front pole (degrees): a bigger one reads more doll-like and anime."],
  ["pupil", "Pupil size", 0.12, 0.6, 0.01, 0.34, "The pupil: its share of the iris (wide in the dark, small in light)."],
  ["fibres", "Iris fibres", 0, 1, 0.01, 0.3, "Fine radial streaks and a pale ring round the pupil."],
  ["limbal", "Limbal ring", 0, 1, 0.01, 0.5, "The dark band at the iris's edge."],
  ["limbalWidth", "Limbal width", 0.05, 0.45, 0.01, 0.18, "As a share of the iris."],
  ["catch1", "Catchlight", 0, 1, 0.01, 0.9, "The main highlight, painted on the eye."],
  ["catchSize", "Catchlight size", 0.05, 0.45, 0.01, 0.17, "As a share of the iris."],
  ["catchX", "Catchlight across", -0.8, 0.8, 0.01, -0.35, "Left to right on the iris."],
  ["catchY", "Catchlight up", -0.8, 0.8, 0.01, 0.4, "Down to up on the iris."],
  ["catch2", "Second catchlight", 0, 1, 0.01, 0.5, "A smaller one on the other side."],
  ["scleraShade", "Sclera shading", 0, 1, 0.01, 0.4, "Darker toward the rim of the eyeball, so it sits in the socket."],
  ["cornerPink", "Corner pink", 0, 1, 0.01, 0.35, "The inner corner (and a little of the outer) and the waterline."],
  ["gloss", "Wet gloss", 0, 1, 0.01, 0.9, "How wet and glassy the eye looks."],
];
export const EYE_DEFAULTS = { on: true, ...Object.fromEntries(EYE_COLOURS.map(c => [c[0], c[2]])), ...Object.fromEntries(EYE_CONTROLS.map(c => [c[0], c[5]])) };

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = h => { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h2(ix, iy) * (1 - u) + h2(ix + 1, iy) * u) * (1 - v) + (h2(ix, iy + 1) * (1 - u) + h2(ix + 1, iy + 1) * u) * v; };

// the texture for one eye: side "L" is the character's left (+x), whose inner corner points toward -x
export function eyeTexture(p, side) {
  const W = 512, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), img = g.createImageData(W, H);
  const iris = hex(p.iris), iris2 = hex(p.iris2), scl = hex(p.sclera), cor = hex(p.corner), dark = [10, 7, 7];
  const R = p.irisSize * Math.PI / 180, sinR = Math.sin(R), inner = side === "L" ? -1 : 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const th = (y + 0.5) / H * Math.PI, ph = (x + 0.5) / W * Math.PI * 2, st = Math.sin(th);
    const sx = -Math.cos(ph) * st, sy = -Math.sin(ph) * st;          // where this point is seen from the front (x right, y up)
    const rr = th / R;                                                // 0 at the pole, 1 at the iris's edge
    let col;
    // the sclera
    col = scl.slice();
    col = mix(col, mix(scl, [150, 120, 115], 0.6), p.scleraShade * smooth(R, R + 0.9, th));
    const ci = smooth(0.35, 0.95, sx * inner);                       // toward the inner corner
    const co = smooth(0.55, 1.0, -sx * inner);                      // a little at the outer corner
    const lid = smooth(0.4, 0.95, Math.abs(sy)) * 0.5;               // and along the lids (the waterline)
    col = mix(col, cor, Math.min(1, p.cornerPink * (ci * 0.9 + co * 0.3 + lid * 0.4)) * smooth(R * 0.9, R * 1.5, th));
    if (rr <= 1.03) {
      let ic = mix(iris2, iris, smooth(0.1, 0.95, rr));
      const fib = vn(ph * 26 / (Math.PI * 2) * 6, rr * 5) * 0.7 + vn(ph * 90, rr * 9) * 0.3;
      ic = ic.map(v => v * (1 + (fib - 0.5) * 0.7 * p.fibres));
      ic = mix(ic, ic.map(v => Math.min(255, v * 1.35 + 14)), p.fibres * 0.5 * Math.exp(-Math.pow((rr - 0.42) / 0.06, 2)));      // the pale ring round the pupil
      ic = mix(ic, dark, p.limbal * smooth(1 - p.limbalWidth, 1, rr));
      ic = mix(ic, [3, 3, 3], 1 - smooth(p.pupil - 0.025, p.pupil + 0.025, rr));                                                   // the pupil
      col = mix(col, ic, 1 - smooth(0.985, 1.03, rr));
    }
    // catchlights, on the iris's disc (x right, y up, in iris radii)
    const ux = sx / sinR, uy = sy / sinR;
    if (th < Math.PI / 2) {
      const a1 = 1 - smooth(p.catchSize * 0.6, p.catchSize, Math.hypot(ux - p.catchX, uy - p.catchY));
      const a2 = 1 - smooth(p.catchSize * 0.3, p.catchSize * 0.5, Math.hypot(ux + p.catchX * 0.7, uy + p.catchY * 0.8));
      col = mix(col, [255, 255, 255], Math.min(1, a1 * p.catch1 + a2 * p.catch2) * (1 - smooth(1.0, 1.1, rr)));
    }
    const o = (y * W + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// the wet look: roughness and the clear coat's
export function eyeFinish(material, p) {
  material.roughness = 0.4 - 0.34 * p.gloss; material.clearcoat = 1; material.clearcoatRoughness = 0.18 - 0.16 * p.gloss;
  material.needsUpdate = true;
}
