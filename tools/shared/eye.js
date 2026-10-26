// The eye: the Character Studio's, the desk's, and what an export carries. MetaHuman's way of making an eye, in our own
// code (docs/research/eyes.md §3: Jimenez's refraction as O3DE and RoboPoets' Godot eye write it, Unity's caustic and
// limbus, Epic's flat layout). One eyeball per eye, its pole looking forward (+Z): the white a sphere of radius 1 (eye
// units), the cornea a dome over the limbus (eyeGeometry). In its shader:
//   - the iris lies on a plane behind the cornea and is read where the view ray, bent at the dome (Snell's law into the
//     eye's fluid, 1.336), lands on that plane: it sits behind glass and slides against the limbus as the view turns;
//   - the cornea's own normal goes to the clear coat, which reflects the room and the lights (real catchlights); the
//     iris under it has no shine of its own;
//   - the iris is lit as a shallow bowl, so its side away from the light is the bright one (the cornea's caustic);
//   - the limbus darkens further seen from the side; the white has veins toward its rim and pink at the corners.
// The paint (iris, pupil, limbus, sclera: eyes.js's, ported) is drawn by the shader in the eye's flat layout (Epic's
// Digital Humans: the front half projected flat, the iris in the middle, up is up), so it's sharp at any size; bakeEye
// draws the same paint into a texture in that layout for files (an export's eyeball: a plain viewer shows it, Unreal's
// material refracts it). Anything with `eyeLocal` (each point in eye units) can wear it, skinned or not: the Studio's
// eyeballs, and a GLB's (wearEye). Our own code.
import * as THREE from "three";

export const EYE_COLOURS = [["iris", "Iris (rim)", "#3b2618"], ["iris2", "Iris (round the pupil)", "#7a5a3a"], ["accent", "Iris accent (the pattern's)", "#e8a33a"],
                            ["pupilColor", "Pupil", "#030303"], ["sclera", "Sclera", "#f4efe9"], ["corner", "Corner tint", "#e08a8a"]];
// the iris's pattern and the pupil's shape: [key, label, [[value, name, help]...], default]
export const EYE_CHOICES = [
  ["pattern", "Iris pattern", [
    ["natural", "Natural", "Fine radial fibres and a pale ring round the pupil."],
    ["sunburst", "Sunburst", "The accent colour bursts out from the pupil in flame-like rays into the iris's own colour (Burst reach: how far)."],
    ["lightning", "Lightning", "Thin bright branching streaks of the accent colour running out from the pupil, glowing a little."],
    ["nebula", "Nebula", "Clouds drifting through the iris, a fiery ring of the accent colour round the pupil, specks of light."],
    ["crypts", "Crypts", "A real iris's dark hollows round the pupil with pale rims, and furrows near the rim (Pattern detail: how many)."],
    ["halo", "Halo", "A band of the accent colour round the pupil, its outer edge jagged; the rest the iris's own colour."]], "natural"],
  ["pupilShape", "Pupil shape", [
    ["round", "Round", "A real pupil."],
    ["heart", "Heart", "A heart: the yandere's eyes."],
    ["slit", "Slit", "A cat's or a snake's: tall and pointed."],
    ["goat", "Bar", "A goat's: a wide rounded bar."],
    ["star", "Star", "Five points."],
    ["diamond", "Diamond", "A tall diamond."],
    ["cross", "Cross", "A cross."],
    ["crescent", "Crescent", "A crescent moon, its horns toward the nose (mirrored between the eyes)."],
    ["flower", "Flower", "Five round petals."],
    ["ring", "Ring", "A hollow ring, the iris inside it: a hypnotised stare."],
    ["two", "Two", "Two pupils side by side (polycoria)."],
    ["none", "None", "No pupil: the iris all the way in, blind or possessed."]], "round"]];
export const EYE_CONTROLS = [   // [key, label, lo, hi, step, default, help]
  ["irisSize", "Iris size", 20, 46, 0.5, 31, "The iris's angle round the front pole (degrees): a bigger one reads more doll-like and anime."],
  ["pupil", "Pupil size", 0.12, 0.6, 0.01, 0.31, "The pupil: its share of the iris (wide in the dark, small in light). Seen through the cornea it looks about a tenth bigger, as a real one does."],
  ["fibres", "Iris fibres", 0, 1, 0.01, 0.3, "Fine radial streaks and a pale ring round the pupil."],
  ["limbal", "Limbal ring", 0, 1, 0.01, 0.5, "The dark band at the iris's edge."],
  ["limbalWidth", "Limbal width", 0.05, 0.45, 0.01, 0.18, "As a share of the iris."],
  ["limbalSoft", "Iris edge softness", 0, 1, 0.01, 0.6, "How the iris melts into the white: 0 a crisp line, 1 a wide soft shadow (the limbus seen through the cornea)."],
  ["catch1", "Catchlight", 0, 1, 0.01, 0.9, "The main highlight, painted on the eye (with the refracting cornea off: on, the cornea reflects the lights themselves)."],
  ["catchSize", "Catchlight size", 0.05, 0.45, 0.01, 0.17, "As a share of the iris."],
  ["catchX", "Catchlight across", -0.8, 0.8, 0.01, -0.35, "Left to right on the iris."],
  ["catchY", "Catchlight up", -0.8, 0.8, 0.01, 0.4, "Down to up on the iris."],
  ["catch2", "Second catchlight", 0, 1, 0.01, 0.5, "A smaller one on the other side."],
  ["scleraShade", "Sclera shading", 0, 1, 0.01, 0.4, "Darker toward the rim of the eyeball, so it sits in the socket."],
  ["cornerPink", "Corner pink", 0, 1, 0.01, 0.35, "The inner corner (and a little of the outer) and the waterline."],
  ["gloss", "Wet gloss", 0, 1, 0.01, 0.9, "How wet and glassy the eye looks."],
  ["irisDepth", "Iris depth (mm)", 0, 2, 0.05, 0.2, "How far behind the limbus the iris lies, under the cornea: deeper, it slides further against the white as the eye or the view turns."],
  ["bulge", "Cornea bulge", 0, 1.5, 0.05, 1, "The cornea's dome over the iris (1: an adult's, 7.8 mm round; 0: none, the white's own curve). It bends the view onto the iris and carries the reflections."],
  ["ior", "Refraction", 1, 1.5, 0.005, 1.336, "How strongly the cornea bends the view onto the iris (1.336: the eye's own fluid; 1: not at all)."],
  ["caustic", "Iris caustic", 0, 1, 0.01, 0.6, "The iris lit as a shallow bowl: its side away from the light glows, where the cornea focuses the light."],
  ["irisBright", "Iris brightness", 0.5, 2.5, 0.01, 1.3, "How much light the iris gives back under the cornea (MetaHuman's iris brightness): the fibres and colour show more."],
  ["limbusView", "Limbus from the side", 0, 1, 0.01, 0.5, "The dark ring round the iris grows as the eye is seen from the side."],
  ["veins", "Veins", 0, 1, 0.01, 0.2, "Fine red vessels in the white, toward its rim."],
  ["patternAmt", "Pattern strength", 0, 1, 0.01, 1, "How strongly the iris's pattern lies over its colours."],
  ["burst", "Burst reach", 0, 1, 0.01, 0.55, "How far the pattern reaches out from the pupil: the sunburst's flames, the halo's band, the nebula's ring, the lightning's streaks."],
  ["detail", "Pattern detail", 0, 1, 0.01, 0.5, "How many rays, streaks and hollows: few and bold, or many and fine."],
  ["pupilTurn", "Pupil turn", -180, 180, 1, 0, "Turns the pupil's shape (mirrored between the eyes): a slit on its side is a goat's bar."],
];
export const EYE_DEFAULTS = { on: true, real: true, ...Object.fromEntries(EYE_COLOURS.map(c => [c[0], c[2]])), ...Object.fromEntries(EYE_CONTROLS.map(c => [c[0], c[5]])),
                              ...Object.fromEntries(EYE_CHOICES.map(c => [c[0], c[3]])) };
const PATTERNS = EYE_CHOICES[0][2].map(o => o[0]), PUPILS = EYE_CHOICES[1][2].map(o => o[0]);

// styles: the colours, the pattern and the pupil set together (after the user's references, 2026-10-26: violet irises
// with an orange sunburst, electric violet streaks, a nebula with a fiery ring, a grey iris with a violet halo, a real
// grey-blue iris with its crypts, gold, green, magenta and red irises, a pink iris with a black heart for a pupil); each
// starts from the plain pattern and pupil, so a style replaces the last one's
const PLAIN = { pattern: "natural", pupilShape: "round", pupilTurn: 0, patternAmt: 1, burst: 0.55, detail: 0.5, pupilColor: "#030303", accent: "#e8a33a",
                pupil: 0.31, fibres: 0.3, limbal: 0.5, limbalWidth: 0.18, irisBright: 1.3, veins: 0.2 };
export const EYE_STYLES = [   // [id, name, what it is, settings]
  ["natural", "Natural brown", "a real brown eye", { ...PLAIN, iris: "#3b2618", iris2: "#7a5a3a" }],
  ["steel", "Steel grey", "a real grey-blue iris: crypts round the pupil, furrows near the rim, a dark limbal ring", { ...PLAIN, iris: "#4f5f6e", iris2: "#a3b1bb", accent: "#d8e0e6", pattern: "crypts", detail: 0.55, fibres: 0.65, limbal: 0.8, limbalWidth: 0.14, pupil: 0.27 }],
  ["violetSun", "Violet sunburst", "violet with an orange-gold burst round the pupil", { ...PLAIN, iris: "#4a1694", iris2: "#7b3fd0", accent: "#ffa21f", pattern: "sunburst", burst: 0.62, detail: 0.55, fibres: 0.55, limbal: 0.55, pupil: 0.24 }],
  ["electric", "Electric violet", "violet with bright pink streaks branching out from the pupil", { ...PLAIN, iris: "#3c1188", iris2: "#6326c9", accent: "#f6a8ff", pattern: "lightning", burst: 0.85, detail: 0.6, fibres: 0.35, limbal: 0.6, pupil: 0.29 }],
  ["nebula", "Nebula", "deep violet clouds, a fiery orange ring round the pupil, specks of light", { ...PLAIN, iris: "#35106e", iris2: "#1a0838", accent: "#ff9f1c", pattern: "nebula", burst: 0.45, detail: 0.45, fibres: 0.2, limbal: 0.65, pupil: 0.27 }],
  ["halo", "Grey-violet halo", "grey-blue with a jagged violet ring round the pupil", { ...PLAIN, iris: "#6f7f96", iris2: "#97a5bb", accent: "#7a35ff", pattern: "halo", burst: 0.45, detail: 0.6, fibres: 0.45, limbal: 0.6, pupil: 0.28 }],
  ["amber", "Amber", "gold, bright round the pupil, in fine rays", { ...PLAIN, iris: "#8a5a08", iris2: "#f0be3c", accent: "#ffe17a", pattern: "sunburst", burst: 0.4, detail: 0.85, patternAmt: 0.7, fibres: 0.75, limbal: 0.6, pupil: 0.27 }],
  ["emerald", "Emerald", "green with a bright lime burst", { ...PLAIN, iris: "#0b5a26", iris2: "#2fbf5a", accent: "#b8ff5a", pattern: "sunburst", burst: 0.5, detail: 0.6, fibres: 0.6, limbal: 0.65, pupil: 0.27 }],
  ["magenta", "Magenta", "magenta with fine pale streaks", { ...PLAIN, iris: "#7a0f5c", iris2: "#d0359f", accent: "#ff9be0", pattern: "lightning", burst: 0.6, detail: 0.85, patternAmt: 0.6, fibres: 0.6, limbal: 0.6, pupil: 0.29 }],
  ["blood", "Blood red", "red with a burning centre, bloodshot", { ...PLAIN, iris: "#7a0606", iris2: "#ff2a12", accent: "#ffb27a", pattern: "sunburst", burst: 0.35, detail: 0.7, fibres: 0.6, limbal: 0.85, limbalWidth: 0.2, pupil: 0.22, veins: 0.7 }],
  ["heart", "Yandere heart", "pink with a black heart for a pupil", { ...PLAIN, iris: "#c9798f", iris2: "#f0b5c4", accent: "#fff0f4", pattern: "crypts", detail: 0.4, patternAmt: 0.5, pupilShape: "heart", pupil: 0.36, fibres: 0.45, limbal: 0.45 }],
  ["serpent", "Serpent", "yellow-green with an orange burst and a slit pupil", { ...PLAIN, iris: "#7f8a06", iris2: "#e6d23a", accent: "#ff7a00", pattern: "sunburst", burst: 0.5, detail: 0.7, pupilShape: "slit", pupil: 0.38, fibres: 0.5, limbal: 0.7 }],
  ["starry", "Starry", "blue with a star for a pupil", { ...PLAIN, iris: "#2c5ac4", iris2: "#86b4ff", accent: "#e8f2ff", pattern: "lightning", burst: 0.7, detail: 0.5, patternAmt: 0.6, pupilShape: "star", pupil: 0.34, pupilColor: "#05081a" }],
  ["hypnotised", "Hypnotised", "a hollow ring for a pupil in a pale violet iris", { ...PLAIN, iris: "#5b4a8a", iris2: "#b9a8e8", accent: "#ffffff", pattern: "halo", burst: 0.3, pupilShape: "ring", pupil: 0.36, limbal: 0.7 }],
  ["possessed", "Possessed", "milky and pale, no pupil", { ...PLAIN, iris: "#bdbcb4", iris2: "#ecebe4", accent: "#ffffff", pattern: "crypts", patternAmt: 0.35, pupilShape: "none", fibres: 0.25, limbal: 0.35, veins: 0.45 }],
  ["polycoria", "Two pupils", "dark brown with two pupils side by side", { ...PLAIN, iris: "#2e1c10", iris2: "#5f4128", pupilShape: "two", pupil: 0.26, fibres: 0.45 }],
];

const EYE_MM = 12, CORNEA_MM = 7.8;   // an adult eyeball's radius; the cornea's front radius

// The eye's shape in eye units (the white's radius 1) for an eyeball k times 12 mm, the iris keeping its size in mm:
// the limbus (its radius rho and the plane it lies in, zl), the cornea's dome (a sphere through the limbus, centre zc on
// the axis, radius rc: Bulge 0 the white's own sphere, 1 an adult's 7.8 mm cornea), the iris's plane (zi)
export function eyeShape(p, k = 1) {
  const R = EYE_MM * k, rho = Math.min(0.95, EYE_MM * Math.sin((p.irisSize ?? 31) * Math.PI / 180) / R);
  const zl = Math.sqrt(1 - rho * rho), cap = 1 - zl;                       // the white's own height over the limbus
  const ra = CORNEA_MM / R, adult = ra - Math.sqrt(Math.max(0, ra * ra - rho * rho));   // an adult cornea's
  const h = Math.max(1e-4, cap + (p.bulge ?? 1) * (adult - cap));
  const rc = (rho * rho + h * h) / (2 * h), zc = zl + h - rc;              // the sphere through the limbus, its top h over it
  return { rho, zl, zc, rc, zi: zl - (p.irisDepth ?? 0.2) / R, angle: Math.asin(rho), k };
}

// The eyeball: the white's sphere, and over the limbus the cornea's dome; denser over the cornea and round the limbus.
// Normals as the shapes have them; uv in the flat layout (0.5 + 0.5·xy: the front projected flat, the iris in the middle,
// v up); tangents along +x (what Unreal's material reads the eye's frame from); `eyeLocal` the point in eye units
export function eyeGeometry(s, seg = 64) {
  const A = s.angle, th = [];
  for (let i = 0; i <= 18; i++) th.push(A * i / 18);                        // the cornea
  for (let i = 1; i <= 8; i++) th.push(A + 0.3 * i / 8);                    // round the limbus
  const t1 = A + 0.3; for (let i = 1; i <= 22; i++) th.push(t1 + (Math.PI - t1) * i / 22);   // on to the back
  const n = th.length, P = [], N = [], UV = [], T = [], idx = [];
  const dome = (dz) => dz * s.zc + Math.sqrt(Math.max(0, (dz * s.zc) ** 2 - s.zc * s.zc + s.rc * s.rc));   // along a direction to the dome
  for (let r = 0; r < n; r++) {
    for (let j = 0; j <= seg; j++) {
      const phi = j / seg * Math.PI * 2, st = Math.sin(th[r]), d = [st * Math.cos(phi), st * Math.sin(phi), Math.cos(th[r])];
      const onC = th[r] < A - 1e-9, at = th[r] <= A + 1e-9 && th[r] >= A - 1e-9;
      const t = onC ? dome(d[2]) : 1, p = d.map(v => v * t);
      let nn = onC ? [p[0], p[1], p[2] - s.zc] : d.slice();
      if (at) { const c = [p[0], p[1], p[2] - s.zc], l = Math.hypot(...c); nn = [d[0] + c[0] / l, d[1] + c[1] / l, d[2] + c[2] / l]; }   // the limbus: between the two
      const nl = Math.hypot(...nn); nn = nn.map(v => v / nl);
      let tt = [1 - nn[0] * nn[0], -nn[0] * nn[1], -nn[0] * nn[2]], tl = Math.hypot(...tt);
      if (tl < 1e-4) { tt = [0, 0, nn[0] > 0 ? -1 : 1]; tl = 1; }
      P.push(...p); N.push(...nn); UV.push(0.5 + 0.5 * p[0], 0.5 + 0.5 * p[1]); T.push(tt[0] / tl, tt[1] / tl, tt[2] / tl, 1);
    }
  }
  for (let r = 0; r < n - 1; r++) for (let j = 0; j < seg; j++) {
    const a = r * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry(), pos = new THREE.Float32BufferAttribute(P, 3);
  g.setAttribute("position", pos); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute("tangent", new THREE.Float32BufferAttribute(T, 4));
  g.setAttribute("eyeLocal", new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

// the paint, in GLSL: eyes.js's iris, pupil, limbus and sclera, read at a point of the iris's plane (q) or the surface (P)
const PAINT = /* glsl */`
uniform vec3 uIris, uIris2, uSclera, uCorner;                  // sRGB
uniform vec4 uPaint;     // the iris's angle round the pole (rad), pupil, fibres, limbal
uniform vec4 uPaint2;    // limbal width, edge softness, sclera shading, corner pink
uniform vec4 uPaint3;    // veins, limbus from the side, the inner corner's side (-1: -x), refracting (0 or 1)
uniform vec4 uShape;     // the limbus's radius and plane, the dome's centre and radius (eye units)
uniform vec4 uShape2;    // the iris's plane, 1 / IOR, caustic, the iris's brightness
uniform vec4 uPat;       // the iris's pattern (EYE_CHOICES' order: 0 natural), its strength, the burst's reach, detail
uniform vec4 uPup;       // the pupil's shape (EYE_CHOICES' order: 0 round), its turn (rad)
uniform vec3 uAccent, uPupilCol;                               // sRGB
float eyeSm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float eyeH2(float x, float y) { return fract(sin(x * 127.1 + y * 311.7) * 43758.5453); }
float eyeVn(float x, float y, float per) {                    // value noise, repeating every per cells in x
  float ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3.0 - 2.0 * fx), v = fy * fy * (3.0 - 2.0 * fy);
  float x0 = mod(ix, per), x1 = mod(ix + 1.0, per);
  return mix(mix(eyeH2(x0, iy), eyeH2(x1, iy), u), mix(eyeH2(x0, iy + 1.0), eyeH2(x1, iy + 1.0), u), v);
}
vec3 eyeLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
float eyeDot2(vec2 v) { return dot(v, v); }
float eyeBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
// the pupil's signed distance (the iris's plane, the limbus at 1; < 0 inside), its shape the size Pupil size gives a
// round one, turned by Pupil turn (mirrored between the eyes); the 2D distances after Inigo Quilez's (MIT)
float eyePupilD(vec2 u) {
  float P = uPaint.y, s = uPup.x, t = uPup.y * uPaint3.z, c = cos(t), sn = sin(t), d;
  vec2 v = vec2(c * u.x - sn * u.y, sn * u.x + c * u.y) / P;          // the pupil's radius 1
  if (s < 0.5) d = length(v) - 1.0;                                   // round
  else if (s < 1.5) {                                                 // heart: upright, its tip down
    vec2 h = v * 0.62 + vec2(0.0, 0.52); h.x = abs(h.x);
    d = (h.y + h.x > 1.0 ? sqrt(eyeDot2(h - vec2(0.25, 0.75))) - 0.35355339
                         : sqrt(min(eyeDot2(h - vec2(0.0, 1.0)), eyeDot2(h - 0.5 * max(h.x + h.y, 0.0)))) * sign(h.x - h.y)) / 0.62;
  }
  else if (s < 2.5) {                                                 // slit: a tall pointed vesica
    vec2 p = abs(v); float r = 2.754, e = 2.454, b = 1.25;
    d = ((p.y - b) * e > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-e, 0.0)) - r;
  }
  else if (s < 3.5) d = eyeBox(v, vec2(1.05, 0.28)) - 0.12;          // a goat's bar
  else if (s < 4.5) {                                                 // star: five points, one up
    vec2 k1 = vec2(0.809016994, -0.587785252), k2 = vec2(-k1.x, k1.y), p = vec2(abs(v.x), v.y);
    p -= 2.0 * max(dot(k1, p), 0.0) * k1; p -= 2.0 * max(dot(k2, p), 0.0) * k2; p.x = abs(p.x); p.y -= 1.25;
    vec2 ba = 0.42 * vec2(-k1.y, k1.x) - vec2(0.0, 1.0); float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, 1.25);
    d = length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
  }
  else if (s < 5.5) {                                                 // diamond
    vec2 p = abs(v), b = vec2(0.78, 1.25); float h = clamp(((b.x - 2.0 * p.x) * b.x - (b.y - 2.0 * p.y) * b.y) / dot(b, b), -1.0, 1.0);
    d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h)) * sign(p.x * b.y + p.y * b.x - b.x * b.y);
  }
  else if (s < 6.5) d = min(eyeBox(v, vec2(1.15, 0.3)), eyeBox(v, vec2(0.3, 1.15)));   // cross
  else if (s < 7.5) {                                                 // crescent, its horns toward the nose
    vec2 p = vec2(v.x * uPaint3.z, abs(v.y)); float ra = 1.15, rb = 1.0, e = 0.55;
    float a = (ra * ra - rb * rb + e * e) / (2.0 * e), b = sqrt(max(ra * ra - a * a, 0.0));
    d = (e * (p.x * b - p.y * a) > e * e * max(b - p.y, 0.0)) ? length(p - vec2(a, b)) : max(length(p) - ra, -(length(p - vec2(e, 0.0)) - rb));
  }
  else if (s < 8.5) d = (length(v) - 0.8 * (1.0 + 0.3 * cos(5.0 * atan(v.y, v.x) - 1.5707963))) * 0.75;   // flower: five petals, one up
  else if (s < 9.5) d = abs(length(v) - 0.8) - 0.2;                  // ring: hollow
  else if (s < 10.5) d = min(length(v - vec2(0.56, 0.0)), length(v + vec2(0.56, 0.0))) - 0.44;   // two, apart
  else d = 1e3;                                                       // none
  return d * P;
}
// rays out from the pupil: N round the iris, each from the pupil's edge (P) to its own length (between lo and hi past
// it), tapering to a point, at its own jittered angle; 1 on a ray. a: the angle (0..1 round), dc: out from the middle
float eyeRays(float a, float dc, float P, float N, float seed, float lo, float hi, float wid, float soft) {
  float x = a * N, c = floor(x), f = x - c - 0.5 - (eyeH2(c, seed + 1.3) - 0.5) * 0.45;
  float L = P + mix(lo, hi, eyeH2(c, seed)), t = clamp((dc - P) / max(L - P, 0.01), 0.0, 1.0), w = wid * (1.0 - 0.8 * t);
  return (1.0 - eyeSm(w * (1.0 - soft), w, abs(f))) * (1.0 - eyeSm(L - 0.04, L, dc)) * eyeSm(P - 0.02, P + 0.01, dc);
}
// a ring of crypts (a real iris's lens-shaped hollows): N cells round, about half holding one, each at its own place
// between r0 and r1 past the pupil, its own size; x: inside, y: its rim
vec2 eyeCrypts(float a, float dc, float P, float N, float seed, float r0, float r1, float wr) {
  float x = a * N, c = floor(x), f = x - c - 0.5 - (eyeH2(c, seed + 2.2) - 0.5) * 0.3, on = step(0.42, eyeH2(c, seed));
  float cr = P + mix(r0, r1, eyeH2(c, seed + 4.1)), wa = mix(0.16, 0.36, eyeH2(c, seed + 5.9)), wd = wr * mix(0.6, 1.4, eyeH2(c, seed + 7.7));
  float e = (f / wa) * (f / wa) + ((dc - cr) / wd) * ((dc - cr) / wd) + (eyeVn(x * 4.0, dc * 30.0, N * 4.0) - 0.5) * 0.6;   // ragged, as real ones are
  return on * vec2(1.0 - eyeSm(0.45, 1.0, e), exp(-pow((e - 1.1) / 0.35, 2.0)));
}
// the pattern over the iris's colours ic: u the place (the limbus at 1), rr its radius, a its angle (0..1 round),
// dc how far out from the pupil's middle as its shape goes (a round pupil's: rr)
vec3 eyePattern(vec3 ic, vec2 u, float rr, float a, float dc) {
  float kind = uPat.x, reach = uPat.z, N1 = floor(mix(10.0, 34.0, uPat.w)), N2 = floor(N1 * 2.7), N3 = floor(N1 * 6.0);
  if (kind < 0.5 || uPat.y <= 0.0) return ic;
  vec3 col = ic, acc = uAccent; float P = uPaint.y, k = mix(0.25, 1.0, reach);
  if (kind < 1.5) {                                                   // sunburst: a corona of flame-like rays out from the pupil, bright at its root, into the iris at their tips
    float core = 1.0 - eyeSm(P + 0.03 * k, P + 0.08 * k, dc);
    float m = max(core, max(eyeRays(a, dc, P, N2, 3.7, 0.22 * k, 0.62 * k, 0.75, 0.85), 0.8 * eyeRays(a + 0.5 / N2, dc, P, N3, 6.1, 0.1 * k, 0.42 * k, 0.65, 0.8)));
    float t = clamp((dc - P) / (0.62 * k), 0.0, 1.0);
    vec3 ray = mix(min(vec3(1.0), acc * 1.35 + 0.12), acc, eyeSm(0.0, 0.45, t)) * (0.7 + 0.5 * eyeVn(a * N3 * 2.0, dc * 6.0, N3 * 2.0));
    col = mix(ic, ray, m * (1.0 - 0.45 * eyeSm(0.4, 1.0, t)));
  } else if (kind < 2.5) {                                            // lightning: many fine bright streaks out from the pupil, nearly straight, glowing
    float aw = a + (eyeVn(a * N2, dc * 5.0, N2) - 0.5) * 0.35 / N2;
    float fine = eyeRays(aw, dc, P, N3 * 2.0, 8.3, 0.25 * k, 0.95 * k, 0.24, 0.6), bold = eyeRays(aw + 0.37 / N2, dc, P, N2, 2.9, 0.45 * k, 0.95 * k, 0.16, 0.5);
    float glow = eyeRays(aw + 0.37 / N2, dc, P, N2, 2.9, 0.45 * k, 0.95 * k, 0.6, 1.0) * 0.4, fade = 1.0 - 0.5 * eyeSm(P, P + 0.9 * k, dc);
    float m = clamp(max(fine * 0.7, bold) + glow, 0.0, 1.0);
    col = mix(ic, acc, m * fade) + acc * 0.35 * bold * fade;
  } else if (kind < 3.5) {                                            // nebula: a fiery jagged ring round a dark middle, flames out of it, clouds, specks of light
    float n = eyeVn(a * 9.0, rr * 4.0, 9.0) * 0.5 + eyeVn(a * 21.0, rr * 9.0, 21.0) * 0.3 + eyeVn(a * 47.0, rr * 17.0, 47.0) * 0.2;
    float r0 = P + mix(0.04, 0.32, reach) + (eyeVn(a * N1, 1.3, N1) - 0.5) * 0.08;
    float ring = eyeSm(r0 - 0.03, r0 + 0.01, dc) * (1.0 - eyeSm(r0 + 0.04, r0 + 0.1 + 0.08 * n, dc));
    float flame = max(eyeRays(a, dc, r0, N2, 9.1, 0.05, 0.3, 0.5, 0.7), 0.7 * eyeRays(a + 0.5 / N2, dc, r0, N3, 3.3, 0.03, 0.16, 0.45, 0.7)) * eyeSm(r0 - 0.01, r0 + 0.02, dc);
    col = mix(ic, ic * 0.3, (1.0 - eyeSm(r0 - 0.04, r0, dc)) * 0.75);                          // the dark middle
    col = mix(col, uIris2 * 0.5 + acc * 0.25, eyeSm(0.5, 0.75, n) * 0.5 * eyeSm(r0 + 0.08, 0.95, dc));   // clouds outside
    col = mix(col, acc * (0.75 + 0.6 * n), clamp(max(ring, flame), 0.0, 1.0));
    col += vec3(step(0.985, eyeH2(floor(a * 220.0), floor(rr * 40.0)))) * 0.55 * (1.0 - rr);
  } else if (kind < 4.5) {                                            // crypts: ragged hollows round the collarette and smaller ones further out, pale rims, furrows near the rim
    vec2 c1 = eyeCrypts(a, dc, P, N1, 1.7, 0.08, 0.24, 0.1), c2 = eyeCrypts(a + 0.31, dc, P, N2, 4.9, 0.32, 0.52, 0.05);
    float hole = max(c1.x, c2.x * 0.8), rim = max(c1.y, c2.y * 0.7) * (1.0 - hole);
    float furrow = pow(0.5 + 0.5 * cos(rr * mix(40.0, 70.0, uPat.w)), 8.0) * eyeSm(0.68, 0.85, rr);
    float tr = 1.0 - abs(eyeVn(a * N3 * 3.0, dc * 3.0, N3 * 3.0) * 2.0 - 1.0);              // fine strands between the hollows
    float coll = exp(-pow((dc - P - 0.07 - 0.03 * (eyeVn(a * N2, 2.0, N2) - 0.5)) / 0.025, 2.0));   // the collarette: a pale jagged ring where they begin
    col = ic * (1.0 - 0.32 * hole) * (1.0 - 0.25 * furrow) * (1.0 + 0.3 * (pow(tr, 6.0) - 0.15) * (1.0 - hole));
    col = mix(col, max(acc, ic), 0.3 * rim + 0.3 * coll);
  } else {                                                            // halo: a band of the accent round the pupil, short dense spikes out of it
    float band = 1.0 - eyeSm(P + 0.04 * k, P + 0.09 * k, dc);
    float m = max(band, eyeRays(a, dc, P, N3, 4.3, 0.1 * k, 0.3 * k, 0.8, 0.5)) * eyeSm(P - 0.01, P + 0.03, dc);
    col = mix(ic, acc * (0.75 + 0.5 * eyeVn(a * N3, dc * 9.0, N3)), m * 0.92);
    col = mix(col, min(vec3(1.0), acc * 1.2 + 0.05), m * 0.4 * (1.0 - eyeSm(P + 0.01, P + 0.06, dc)));
  }
  return mix(ic, col, uPat.y);
}
vec3 eyeIrisPaint(vec2 u, float graze, float w) {               // u: the iris's plane, the limbus at 1
  float rr = length(u), a = atan(u.y, u.x) / 6.2831853 + 0.5, pd = eyePupilD(u), dc = uPup.x > 10.5 ? rr : pd + uPaint.y;
  vec3 ic = mix(uIris2, uIris, eyeSm(0.1, 0.95, rr));
  float fib = eyeVn(a * 156.0, rr * 5.0, 156.0) * 0.7 + eyeVn(a * 566.0, rr * 9.0, 566.0) * 0.3;
  ic *= 1.0 + (fib - 0.5) * 0.7 * uPaint.z;
  ic = mix(ic, min(vec3(1.0), ic * 1.35 + 14.0 / 255.0), uPaint.z * 0.5 * exp(-pow((dc - 0.42) / 0.06, 2.0)));   // the pale ring round the pupil, after its shape
  ic = eyePattern(ic, u, rr, a, dc);
  float lim = clamp(uPaint.w * (1.0 + 1.5 * uPaint3.y * graze), 0.0, 1.0);                                   // darker seen from the side
  ic = mix(ic, vec3(10.0, 7.0, 7.0) / 255.0, lim * eyeSm(1.0 - uPaint2.x - 0.3 * w, 1.0, rr));
  return mix(ic, uPupilCol, 1.0 - eyeSm(-0.025, 0.025, pd));                                                  // the pupil
}
vec3 eyeScleraPaint(vec3 P) {
  float R = uPaint.x, th = acos(clamp(normalize(P).z, -1.0, 1.0)), ph = atan(P.y, P.x);
  vec3 col = mix(uSclera, mix(uSclera, vec3(150.0, 120.0, 115.0) / 255.0, 0.6), uPaint2.z * eyeSm(R, R + 0.9, th));
  float sx = P.x, sy = P.y;
  float ci = eyeSm(0.35, 0.95, sx * uPaint3.z), co = eyeSm(0.55, 1.0, -sx * uPaint3.z), lid = eyeSm(0.4, 0.95, abs(sy)) * 0.5;
  col = mix(col, uCorner, min(1.0, uPaint2.w * (ci * 0.9 + co * 0.3 + lid * 0.4)) * eyeSm(R * 0.9, R * 1.5, th));
  if (uPaint3.x > 0.0) {                                      // veins: thin wavy lines from the rim toward the iris
    float a = ph / 6.2831853 + 0.5, warp = eyeVn(a * 9.0, th * 2.5, 9.0) - 0.5;
    float l1 = 1.0 - abs(eyeVn(a * 46.0 + warp * 3.0, th * 3.0, 46.0) * 2.0 - 1.0);
    float l2 = 1.0 - abs(eyeVn(a * 130.0 + warp * 7.0, th * 7.0, 130.0) * 2.0 - 1.0);
    float v = pow(l1, 14.0) * 0.8 + pow(l2, 18.0) * 0.6;
    v *= eyeSm(R * 1.15, R + 1.0, th) * (0.55 + 0.45 * eyeVn(a * 23.0, th * 4.0, 23.0));
    col = mix(col, vec3(0.78, 0.33, 0.3), clamp(v * uPaint3.x * 1.6, 0.0, 0.85));
  }
  float rr = th / R, soft = uPaint2.y, w = 0.03 + 0.24 * soft;
  if (soft > 0.0) {                                            // the limbus's soft shadow on the white
    float g = exp(-pow(max(0.0, rr - 1.0 + 0.2 * w) / (0.06 + 0.22 * soft), 2.0));
    col = mix(col, col * vec3(0.66, 0.68, 0.74), 0.55 * soft * g);
  }
  return col;
}
vec3 eyePaint(vec2 q, vec3 P, float graze) {                   // sRGB: the white at P, the iris read at q
  vec3 col = eyeScleraPaint(P);
  float w = 0.03 + 0.24 * uPaint2.y, rr = length(q) / uShape.x;
  if (rr <= 1.0 + w) col = mix(col, eyeIrisPaint(q / uShape.x, graze, w), 1.0 - eyeSm(1.0 - 0.35 * w, 1.0 + 0.65 * w, rr));
  return col;
}
`;

// the eye's uniforms, one set per eye (the inner corner differs)
function eyeUniforms() {
  return { uIris: { value: new THREE.Color() }, uIris2: { value: new THREE.Color() }, uSclera: { value: new THREE.Color() }, uCorner: { value: new THREE.Color() },
           uPaint: { value: new THREE.Vector4() }, uPaint2: { value: new THREE.Vector4() }, uPaint3: { value: new THREE.Vector4() },
           uShape: { value: new THREE.Vector4(0.5, 0.86, 0.4, 0.65) }, uShape2: { value: new THREE.Vector4(0.86, 1 / 1.336, 0.6, 1) },
           uPat: { value: new THREE.Vector4(0, 1, 0.55, 0.5) }, uPup: { value: new THREE.Vector4() }, uAccent: { value: new THREE.Color() }, uPupilCol: { value: new THREE.Color() } };
}
const srgb = (c, hex) => { c.set(hex); c.convertLinearToSRGB(); };   // THREE.Color keeps linear; the paint works in sRGB, as eyes.js did
function setUniforms(u, p, s, side) {
  srgb(u.uIris.value, p.iris); srgb(u.uIris2.value, p.iris2); srgb(u.uSclera.value, p.sclera); srgb(u.uCorner.value, p.corner);
  u.uPaint.value.set(s.angle, p.pupil, p.fibres, p.limbal);
  u.uPaint2.value.set(p.limbalWidth, p.limbalSoft ?? 0, p.scleraShade, p.cornerPink);
  u.uPaint3.value.set(p.veins ?? 0, p.limbusView ?? 0, side === "L" ? -1 : 1, p.real === false ? 0 : 1);
  u.uShape.value.set(s.rho, s.zl, s.zc, s.rc);
  u.uShape2.value.set(s.zi, 1 / Math.max(1, p.ior ?? 1.336), p.caustic ?? 0, p.real === false ? 1 : p.irisBright ?? 1);
  srgb(u.uAccent.value, p.accent ?? EYE_DEFAULTS.accent); srgb(u.uPupilCol.value, p.pupilColor ?? EYE_DEFAULTS.pupilColor);
  u.uPat.value.set(Math.max(0, PATTERNS.indexOf(p.pattern)), p.patternAmt ?? 1, p.burst ?? 0.55, p.detail ?? 0.5);
  u.uPup.value.set(Math.max(0, PUPILS.indexOf(p.pupilShape)), (p.pupilTurn ?? 0) * Math.PI / 180, 0, 0);
}

// a physical material wearing the eye; `extend(shader)` adds what a page needs on top (the Studio: the lids' shadow)
export function eyeMaterial(side, extend = null, key = "") {
  const m = new THREE.MeshPhysicalMaterial({ ior: 1.4, clearcoat: 1 });
  const u = m.userData.eyeU = eyeUniforms(); m.userData.eyeSide = side;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 eyeLocal;\nvarying vec3 vEyeP, vEyeX, vEyeF;")
      .replace("#include <skinnormal_vertex>", `#include <skinnormal_vertex>
  vec3 eyeAxX = vec3(1.0, 0.0, 0.0), eyeAxF = vec3(0.0, 0.0, 1.0);   // the eye's own frame, turned as its normals are
  #ifdef USE_SKINNING
    eyeAxX = (skinMatrix * vec4(eyeAxX, 0.0)).xyz; eyeAxF = (skinMatrix * vec4(eyeAxF, 0.0)).xyz;
  #endif
  vEyeX = normalize(normalMatrix * eyeAxX); vEyeF = normalize(normalMatrix * eyeAxF); vEyeP = eyeLocal;`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vEyeP, vEyeX, vEyeF;\n${PAINT}`)
      .replace("#include <map_fragment>", `
  vec3 eyeX = normalize(vEyeX), eyeF = normalize(vEyeF), eyeY = normalize(cross(eyeF, eyeX));
  vec3 eyeDv = normalize(-vViewPosition), eyeD = vec3(dot(eyeDv, eyeX), dot(eyeDv, eyeY), dot(eyeDv, eyeF));   // the view, in the eye's frame
  vec3 eyeP = vEyeP;
  float eyeOnC = (eyeP.z > uShape.y - 1e-4 && length(eyeP.xy) < uShape.x) ? 1.0 : 0.0;                    // on the cornea
  vec3 eyeN = eyeOnC > 0.5 ? normalize(eyeP - vec3(0.0, 0.0, uShape.z)) : normalize(eyeP);
  float eyeGraze = 1.0 - clamp(-eyeD.z, 0.0, 1.0);                                                       // how far from the eye's own axis it's seen
  vec2 eyeQ = eyeP.xy;
  if (uPaint3.w > 0.5 && eyeOnC > 0.5) {                     // bent at the cornea, onto the iris's plane
    vec3 t = refract(eyeD, eyeN, uShape2.y);
    eyeQ = eyeP.xy + t.xy * max(eyeP.z - uShape2.x, 0.0) / max(-t.z, 0.08);
  }
  float eyeIrisW = uPaint3.w * eyeOnC * (1.0 - eyeSm(0.95, 1.08, length(eyeQ) / uShape.x));
  diffuseColor.rgb *= eyeLin(eyePaint(eyeQ, eyeP, eyeGraze)) * mix(1.0, uShape2.w, eyeIrisW);
  vec3 eyeB = normalize(mix(eyeN, normalize(vec3(-eyeQ / uShape.x * uShape2.z * 1.4, 1.0)), eyeIrisW));   // the iris: a shallow bowl
  vec3 eyeBaseV = normalize(eyeX * eyeB.x + eyeY * eyeB.y + eyeF * eyeB.z), eyeCoatV = normalize(eyeX * eyeN.x + eyeY * eyeN.y + eyeF * eyeN.z);`)
      .replace("#include <clearcoat_normal_fragment_begin>", "#include <clearcoat_normal_fragment_begin>\n  normal = eyeBaseV;\n#ifdef USE_CLEARCOAT\n  clearcoatNormal = eyeCoatV;\n#endif")
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
  material.specularColor *= 1.0 - eyeIrisW; material.specularF90 *= 1.0 - eyeIrisW;   // under the cornea: no shine of its own
#ifdef USE_CLEARCOAT
  material.clearcoatF0 = vec3(0.025);                          // the cornea's (IOR 1.376)
#endif`);
    extend?.(sh);
  };
  m.customProgramCacheKey = () => "studio-eye-4" + key;
  return m;
}

// the paint, the shape and the wet look onto a material from eyeMaterial
export function setEye(m, p, s) {
  setUniforms(m.userData.eyeU, p, s, m.userData.eyeSide);
  m.roughness = 0.4 - 0.34 * p.gloss; m.clearcoat = 1; m.clearcoatRoughness = 0.18 - 0.16 * p.gloss;
}

// the paint baked flat (the eye's layout, sRGB) into a canvas, size × size: what a file carries, unrefracted
export function bakeEye(renderer, p, s, side, size = 1024) {
  const u = eyeUniforms(); setUniforms(u, p, s, side);
  const mat = new THREE.ShaderMaterial({ uniforms: u, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `${PAINT}
varying vec2 vUv;
void main() {
  vec2 xy = vUv * 2.0 - 1.0; float r = length(xy);
  if (r > 0.999) { xy *= 0.999 / r; r = 0.999; }
  vec3 P = vec3(xy, r < uShape.x ? uShape.z + sqrt(max(0.0, uShape.w * uShape.w - r * r)) : sqrt(1.0 - r * r));
  gl_FragColor = vec4(eyePaint(xy, P, 0.0), 1.0);
}` });
  const scene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false }), was = renderer.getRenderTarget();
  const cam = new THREE.Camera(), auto = renderer.autoClear;
  renderer.setRenderTarget(rt); renderer.autoClear = true; renderer.render(scene, cam);
  const px = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(was); renderer.autoClear = auto;
  rt.dispose(); mat.dispose(); quad.geometry.dispose();
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), row = size * 4;
  for (let y = 0; y < size; y++) img.data.set(px.subarray(y * row, (y + 1) * row), (size - 1 - y) * row);   // the target's rows run up, a canvas's down
  g.putImageData(img, 0, 0);
  return c;
}

// what an exported eyeball carries for a reader that knows the eye (the desk, Unreal): the paint and the shape
export function eyeRecord(p, s, side) {
  const keep = ["real", ...EYE_COLOURS.map(c => c[0]), ...EYE_CONTROLS.map(c => c[0]), ...EYE_CHOICES.map(c => c[0])];
  return { side, paint: Object.fromEntries(keep.filter(k => p[k] !== undefined).map(k => [k, p[k]])),
           shape: { rho: s.rho, zl: s.zl, zc: s.zc, rc: s.rc, zi: s.zi, angle: s.angle, k: s.k } };
}

// a loaded eyeball (an export's: its material's extras.studioEye, its `_eyelocal` points) put back in the eye's shader
export function wearEye(mesh) {
  const rec = mesh.material?.userData?.studioEye; if (!rec) return false;
  const g = mesh.geometry, loc = g.getAttribute("_eyelocal") || g.getAttribute("eyeLocal"); if (!loc) return false;
  g.setAttribute("eyeLocal", loc);
  const was = mesh.material, m = eyeMaterial(rec.side);
  setEye(m, { ...EYE_DEFAULTS, ...rec.paint }, rec.shape);
  m.userData.studioEye = rec; m.userData.plain = was;          // the plain (baked) one, for a simple view
  mesh.material = m;
  return true;
}
