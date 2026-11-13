// The eye's paint (HSEyePaint, eye_paint.gd; docs/GODOT_LOOK.md §5v): tools/shared/eye.js's PAINT in Godot's shading
// language, function for function and number for number (the Studio draws an eye's iris, pupil, limbus and white with
// it and bakes them flat into an export's eyeball; here the same paint is made again from the export's own record with
// any of its numbers changed: another iris colour, pattern or pupil). It works in sRGB, as the Studio's does. Change
// the two together: EYESV3 holds this file's picture of an export's record against the picture the Studio baked.
uniform vec3 uIris = vec3(0.231, 0.149, 0.094);       // sRGB, each
uniform vec3 uIris2 = vec3(0.478, 0.353, 0.227);
uniform vec3 uSclera = vec3(0.957, 0.937, 0.914);
uniform vec3 uCorner = vec3(0.878, 0.541, 0.541);
uniform vec3 uAccent = vec3(0.91, 0.639, 0.227);
uniform vec3 uPupilCol = vec3(0.012);
uniform vec4 uPaint = vec4(0.541, 0.31, 0.3, 0.5);     // the iris's angle round the pole (rad), pupil, fibres, limbal
uniform vec4 uPaint2 = vec4(0.18, 0.6, 0.4, 0.35);     // limbal width, edge softness, sclera shading, corner pink
uniform vec4 uPaint3 = vec4(0.2, 0.5, 1.0, 1.0);       // veins, limbus from the side, the inner corner's side (-1: -x), refracting (0 or 1)
uniform vec4 uShape = vec4(0.515, 0.857, 0.366, 0.65); // the limbus's radius and plane, the dome's centre and radius (eye units)
uniform vec4 uPat = vec4(0.0, 1.0, 0.55, 0.5);         // the iris's pattern (0 natural, sunburst, lightning, nebula, crypts, halo), its strength, the burst's reach, detail
uniform vec4 uPup = vec4(0.0);                         // the pupil's shape (0 round, heart, slit, bar, star, diamond, cross, crescent, flower, ring, two, none), its turn (rad)

float eyeSm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float eyeH2(float x, float y) { return fract(sin(x * 127.1 + y * 311.7) * 43758.5453); }
float eyeVn(float x, float y, float per) {                    // value noise, repeating every per cells in x
	float ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3.0 - 2.0 * fx), v = fy * fy * (3.0 - 2.0 * fy);
	float x0 = mod(ix, per), x1 = mod(ix + 1.0, per);
	return mix(mix(eyeH2(x0, iy), eyeH2(x1, iy), u), mix(eyeH2(x0, iy + 1.0), eyeH2(x1, iy + 1.0), u), v);
}
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
vec3 eyeScleraPaint(vec3 P, float graze) {
	float R = uPaint.x, th = acos(clamp(normalize(P).z, -1.0, 1.0)), ph = atan(P.y, P.x);
	// the white's rim shading, the corners' pink and the veins are painted for a view from the front, where the lids hide
	// the eyeball's flank: seen from the side they fade to the plain white. The bake (graze 0) keeps them
	float side = 1.0 - eyeSm(0.4, 0.75, graze);
	vec3 col = mix(uSclera, mix(uSclera, vec3(150.0, 120.0, 115.0) / 255.0, 0.6), side * uPaint2.z * eyeSm(R, R + 0.9, th));
	float sx = P.x, sy = P.y;
	float ci = eyeSm(0.35, 0.95, sx * uPaint3.z), co = eyeSm(0.55, 1.0, -sx * uPaint3.z), lid = eyeSm(0.4, 0.95, abs(sy)) * 0.5;
	col = mix(col, uCorner, side * min(1.0, uPaint2.w * (ci * 0.9 + co * 0.3 + lid * 0.4)) * eyeSm(R * 0.9, R * 1.5, th));
	if (uPaint3.x > 0.0) {                                      // veins: thin wavy lines from the rim toward the iris
		float a = ph / 6.2831853 + 0.5, warp = eyeVn(a * 9.0, th * 2.5, 9.0) - 0.5;
		float l1 = 1.0 - abs(eyeVn(a * 46.0 + warp * 3.0, th * 3.0, 46.0) * 2.0 - 1.0);
		float l2 = 1.0 - abs(eyeVn(a * 130.0 + warp * 7.0, th * 7.0, 130.0) * 2.0 - 1.0);
		float v = pow(l1, 14.0) * 0.8 + pow(l2, 18.0) * 0.6;
		v *= eyeSm(R * 1.15, R + 1.0, th) * (0.55 + 0.45 * eyeVn(a * 23.0, th * 4.0, 23.0));
		col = mix(col, vec3(0.78, 0.33, 0.3), side * clamp(v * uPaint3.x * 1.6, 0.0, 0.85));
	}
	float rr = th / R, soft = uPaint2.y, w = 0.03 + 0.24 * soft;
	if (soft > 0.0) {                                            // the limbus's soft shadow on the white
		float g = exp(-pow(max(0.0, rr - 1.0 + 0.2 * w) / (0.06 + 0.22 * soft), 2.0));
		col = mix(col, col * vec3(0.66, 0.68, 0.74), 0.55 * soft * g);
	}
	return col;
}
vec3 eyePaint(vec2 q, vec3 P, float graze) {                   // sRGB: the white at P, the iris read at q
	vec3 col = eyeScleraPaint(P, graze);
	float w = 0.03 + 0.24 * uPaint2.y, rr = length(q) / uShape.x;
	if (rr <= 1.0 + w) col = mix(col, eyeIrisPaint(q / uShape.x, graze, w), 1.0 - eyeSm(1.0 - 0.35 * w, 1.0 + 0.65 * w, rr));
	return col;
}
// the flat layout's picture at uv (0..1, v up the eye: how an export's eyeball stores it): tools/shared/eye.js bakeEye
vec3 eyeFlat(vec2 uv) {
	vec2 xy = uv * 2.0 - 1.0; float r = length(xy);
	if (r > 0.999) { xy *= 0.999 / r; r = 0.999; }
	vec3 P = vec3(xy, r < uShape.x ? uShape.z + sqrt(max(0.0, uShape.w * uShape.w - r * r)) : sqrt(1.0 - r * r));
	return eyePaint(xy, P, 0.0);
}
