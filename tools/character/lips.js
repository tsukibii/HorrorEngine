// lips.js: the lipstick's guide (Character Studio, Face, Mouth). The lips' outline is MediaPipe's outer lip ring, its 20
// points riding the face (on a face fitted to a photo, the photo's own lips), shaped by hand: an overline (or under),
// the upper and the lower lip taller or thinner, the corners longer or shorter, a sharper or softer cupid's bow. The
// outline, smoothed into 32 points, is what the skin's shader paints inside (soft at its border, a gradient from the
// middle, gloss and fine lip lines) and what Show guide draws over the face. Plain arrays, no three.js.

// the outer lip ring, from the character's right corner (61) over the upper lip to the left corner (291) and back
// under the lower lip: [0] and [10] the corners, [4] and [6] the cupid's bow's peaks, [5] its dip, [15] the lower middle
export const LIP_RING = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
export const LIPS_DEFAULTS = { on: false, colour: "#d9606c", amount: 0.8, gradient: 0.5, soft: 0.4, gloss: 0.6, lines: 0.3,
                               over: 0, upper: 0, lower: 0, corners: 0, bow: 0, guide: false };
// [key, label, lo, hi, step, help]
export const LIP_PAINT = [
  ["amount", "Amount", 0, 1, 0.01, "How strong the colour is."],
  ["gradient", "Gradient", 0, 1, 0.01, "0 the whole lip evenly; 1 strongest in the middle, fading out to the border (gradient lips)."],
  ["soft", "Soft edge", 0, 1, 0.01, "How softly the colour stops at its border (0.3 mm to 2.5 mm)."],
  ["gloss", "Gloss", 0, 1, 0.01, "Wet and shiny: lower roughness and a clear coat."],
  ["lines", "Lip lines", 0, 1, 0.01, "The fine creases across the lips, a little darker and less glossy."],
];
export const LIP_SHAPE = [
  ["over", "Overline (mm)", -2, 2, 0.05, "The whole outline out over the lips' border (+) or inside it (−)."],
  ["upper", "Upper lip (mm)", -2, 2, 0.05, "The upper lip's border higher (+) or lower."],
  ["lower", "Lower lip (mm)", -2, 2, 0.05, "The lower lip's border lower (+) or higher."],
  ["corners", "Corners (mm)", -3, 3, 0.05, "The colour past the corners (+) or stopping short of them."],
  ["bow", "Cupid's bow (mm)", -1, 1, 0.05, "The bow's peaks higher and its dip deeper (+), or flatter."],
];

// the outline now: lm(i) a landmark's place on the face (rig space, metres), mm a millimetre on this face
export function lipOutline(lm, s, mm) {
  const P = LIP_RING.map(i => lm(i).slice());
  const c = [0, 1, 2].map(a => P.reduce((q, p) => q + p[a], 0) / P.length);
  const bump = i => Math.sin(Math.PI * (i % 10) / 10);           // 0 at the corners, 1 in the middle of a lip
  P.forEach((p, i) => {
    const dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy) || 1;
    p[0] += dx / l * (s.over || 0) * mm; p[1] += dy / l * (s.over || 0) * mm;
    if (i > 0 && i < 10) p[1] += (s.upper || 0) * mm * bump(i);
    if (i > 10) p[1] -= (s.lower || 0) * mm * bump(i);
    const side = Math.sign(p[0] - c[0]), cw = i === 0 || i === 10 ? 1 : i === 1 || i === 9 || i === 11 || i === 19 ? 0.45 : 0;
    p[0] += side * (s.corners || 0) * mm * cw;
    if (i === 4 || i === 6) p[1] += (s.bow || 0) * mm;
    if (i === 5) p[1] -= 0.6 * (s.bow || 0) * mm;
  });
  const out = [], n = P.length;                                  // closed Catmull-Rom, 32 points
  for (let k = 0; k < 32; k++) {
    const u = k / 32 * n, i = Math.floor(u), t = u - i, t2 = t * t, t3 = t2 * t;
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map(o => P[(i + o + n) % n]);
    out.push([0, 1, 2].map(a => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
  }
  const ys = out.map(p => p[1]);
  return { pts: out, ring: P, c, height: Math.max(...ys) - Math.min(...ys), zmin: Math.min(...out.map(p => p[2])) };
}
