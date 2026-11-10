// HSOoze's shared part (react/ooze_<kind>.gdshader include it, define field() and include ooze_frag.gdshaderinc):
// black ichor as a living liquid (the user, 2026-11-10: "a shader for the black gothic blood that will fit our vhs
// camhybrid look and look eery and oozy"; docs/research/ooze.md). A box projected onto whatever it covers, as a decal
// is, but its own shader: the surface found from the depth buffer (its normal from its neighbours there), lit where it
// lies (LIGHT_VERTEX), so its shape can move:
// - a spray spreads as it lands and creeps on; on a wall drips run down out of it, their heads bulging, slowing to a
//   stop (the world's down in its plane: on a floor there are none); a pool spreads, its edge reaching out in thin
//   tendrils; a wound oozes down whatever it's on; a drop splashes;
// - thick, it's black with an oil's sheen in its highlight (violet, green, gold, by the angle and its depth, drifting);
//   thin (its edges, the tendrils, a drip's trail) a deep oxblood; every blob is a low dome, its highlight a crescent;
// - never still: the surface crawls, a slow double beat swells it (the highlights pulse), embers die in it.
// The camhybrid tape lifts black and blurs colour to a fifth of its brightness's detail: the ooze reads by its shine and
// its movement, colour only bleeds round it. Nothing finer than a few millimetres.

uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform int debug = 0;                   // (a check's: 1 lit white, 2 its normal, 3 chrome, 4 rough chrome)

uniform vec4 film_color : source_color = vec4(0.12, 0.014, 0.022, 1.0);    // thin: a deep oxblood
uniform vec4 sheen_a : source_color = vec4(0.42, 0.16, 0.75, 1.0);         // the oil's sheen: violet...
uniform vec4 sheen_b : source_color = vec4(0.12, 0.62, 0.42, 1.0);         // ...green...
uniform vec4 sheen_c : source_color = vec4(0.85, 0.62, 0.16, 1.0);         // ...gold
uniform float sheen : hint_range(0.0, 1.0) = 0.65;                          // how much of it (0: a plain black gloss)
uniform float gloss : hint_range(0.0, 1.0) = 0.92;                          // 1: a mirror (glints that crawl over it as its surface moves)
uniform float mirror : hint_range(0.0, 3.0) = 1.0;                          // what's round it seen in it (the lit wall at its rims)
uniform vec4 ember_color : source_color = vec4(1.0, 0.3, 0.06, 1.0);
uniform float ember_energy = 3.0;
uniform float pulse : hint_range(0.0, 1.0) = 0.5;                           // the slow double beat (0: still)
uniform float crawl : hint_range(0.0, 2.0) = 1.0;                           // its surface moving
uniform float reach : hint_range(0.0, 2.0) = 1.0;                           // a pool's tendrils
uniform float drip : hint_range(0.0, 2.0) = 1.0;                            // how far drips run
uniform float thickness_mm = 6.0;                                           // how high a blob bulges (a little more than a real one: its highlights read)


instance uniform float age = 0.0;        // seconds since it landed (HSOoze counts them)
instance uniform float seed = 0.0;
instance uniform float size_m = 0.4;     // the shape's size (its box is bigger: drips run out of it)
instance uniform float embers = 1.0;     // their strength now
instance uniform vec3 half = vec3(0.3, 0.08, 0.3);   // its box's half size, in the mesh's own units (its -Y into the surface)

varying flat vec4 im0;
varying flat vec4 im1;
varying flat vec4 im2;
varying flat vec3 vx;
varying flat vec3 vy;
varying flat vec3 vz;
varying flat vec3 bscale;
varying flat vec2 dn;                    // the world's down in its plane (its length the slope: 0 on a floor, 1 on a wall)

void vertex() {
	mat4 im = inverse(MODEL_MATRIX);
	im0 = vec4(im[0][0], im[1][0], im[2][0], im[3][0]);
	im1 = vec4(im[0][1], im[1][1], im[2][1], im[3][1]);
	im2 = vec4(im[0][2], im[1][2], im[2][2], im[3][2]);
	bscale = vec3(length(MODEL_MATRIX[0].xyz), length(MODEL_MATRIX[1].xyz), length(MODEL_MATRIX[2].xyz));
	vx = normalize((VIEW_MATRIX * vec4(MODEL_MATRIX[0].xyz, 0.0)).xyz);
	vy = normalize((VIEW_MATRIX * vec4(MODEL_MATRIX[1].xyz, 0.0)).xyz);
	vz = normalize((VIEW_MATRIX * vec4(MODEL_MATRIX[2].xyz, 0.0)).xyz);
	dn = vec2(-MODEL_MATRIX[0].y / bscale.x, -MODEL_MATRIX[2].y / bscale.z);
}

// ---- hashes, noise, shapes -----------------------------------------------------------------------------------------

float hh(float n) {
	return fract(sin(n * 12.9898 + 4.1414) * 43758.5453);
}

float h21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float vn(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
	return (vn(p) * 0.5 + vn(p * 2.03 + 7.1) * 0.27 + vn(p * 4.1 + 2.3) * 0.15 + vn(p * 8.3 + 5.9) * 0.08) / 1.0;
}

float smin(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(b, a, h) - k * h * (1.0 - h);
}

// a capsule from a to b, its radius ra at a and rb at b
float capsule(vec2 p, vec2 a, vec2 b, float ra, float rb) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
	return length(pa - ba * h) - mix(ra, rb, h);
}

// ---- the shapes (metres from where it landed; negative inside) -----------------------------------------------------

// drips running down out of a body of radius R round o, `n` of them, slowing to a stop (a viscous film thins as it
// runs), each a thin trail wavering and beading as it thins behind a bulging head; the slope says how far (none on a
// floor)
float drips(vec2 p, vec2 o, float R, int n, float t, float d, float s, float lmax) {
	float slope = length(dn);
	if (slope < 0.3) {
		return d;
	}
	vec2 down = dn / slope;
	vec2 side = vec2(-down.y, down.x);
	for (int i = 0; i < 6; i++) {
		if (i >= n) {
			break;
		}
		float fi = float(i);
		float t0 = 0.15 + 0.9 * hh(s + 81.0 + fi);                 // a moment before it starts to run
		float run = max(t - t0, 0.0);
		float tau = 1.6 + 5.0 * hh(s + 91.0 + fi);
		float L = lmax * (0.25 + 0.75 * hh(s + 101.0 + fi)) * (slope - 0.2) / 0.8 * drip * (1.0 - exp(-run / tau));
		float w = R * (0.07 + 0.08 * hh(s + 111.0 + fi));
		vec2 a = o + side * (hh(s + 121.0 + fi) - 0.5) * 1.6 * R + down * R * 0.4;
		vec2 b = a + down * (R * 0.35 + L);
		b += side * sin(run * 0.9 + fi * 2.1) * w * 0.15;          // its head feeling its way down
		vec2 ba = b - a;
		float hl = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
		vec2 q = a + ba * hl + side * sin(hl * 17.0 + fi * 3.1 + s) * w * 0.3 * hl;   // (wandering a little across)
		float width = w * mix(1.15, 0.5, hl) * (1.0 + 0.22 * sin(hl * 29.0 + fi * 5.3) * hl);   // (beading as it thins)
		d = smin(d, length(p - q) - width, w * 0.8);
		d = smin(d, length(p - b - down * w * 0.45) - w * 1.5, w * 0.5);   // its head
	}
	return d;
}

// its depth over the surface (m): every blob a low dome rising across all of it (a paraboloid on its depth inside its
// edge, so its slope runs from steep at its edge to flat in its middle and some part of it faces any light), with a
// meniscus at its very edge; a slow crawl on it; the double beat swelling it
float depth_at(float d, vec2 p, float beat) {
	float H = thickness_mm * 0.001 * (1.0 + 0.2 * pulse * beat);
	float rho = 0.012 + 0.03 * size_m;                              // (its middle flat: a sheet with rounded edges, not a balloon)
	float k = clamp(-d / rho, 0.0, 1.0);
	float h = H * k * (2.0 - k);
	float m = clamp(-d / 0.0025, 0.0, 1.0);
	h += H * 0.18 * sqrt(max(1.0 - (1.0 - m) * (1.0 - m), 0.0));
	float c = crawl * 0.0007;
	h += c * (vn(p * 38.0 + vec2(TIME * 0.11, -TIME * 0.07)) + 0.6 * vn(p * 71.0 - vec2(TIME * 0.06, TIME * 0.09))) * smoothstep(0.0, 0.004, -d);
	return h;
}

// the surface seen at a screen point, in view space
vec3 view_at(vec2 uv, mat4 inv_proj) {
	float z = texture(depth_tex, uv).r;
	vec4 v4 = inv_proj * vec4(uv * 2.0 - 1.0, z, 1.0);
	return v4.xyz / v4.w;
}
