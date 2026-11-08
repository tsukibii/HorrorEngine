// A dust mote (HSDust, nodes/dust.gd; docs/research/eye_candy.md §2.3 H and §2.3b): seen the way an eye sees dust in
// a beam, not a camera's soft discs.
// - A flake (most of them: skin scales, flecks) is a point of a power-law size, tumbling about its own axis. Its light
//   is a dim glow through the air's two-lobed phase, plus a mirror flash when its face lines up with the light and the
//   eye: the twinkle.
// - A fibre (lint) is a thread drawn along its own axis as seen, glinting where the light meets it square.
// - Lit by every light; under a `knee` of light dark (moonlight shows none); each light's share capped (a sparkle,
//   never a blob).
// - Never under `min_px` on screen (grown and dimmed to keep its light: TAA would average a smaller one away); faded
//   out within `near_fade` of the eye (the eye doesn't focus that close) and at the box's edge.
// - Seen against darkness only: what's behind it (the screen before the transparent pass) is read, and a mote fades out
//   over a lit wall (`dark` to `lit_bg`), as dust does (a lit room's dust is never seen, a beam's is against the dark);
//   and it never adds more than takes the pixel to `most_light`, so it never blooms (the look's glow starts at 1.05).
// INSTANCE_CUSTOM (dust_particles.gdshader): x the kind, y the size, z the tumble, w the brightness.
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, shadows_disabled, ambient_light_disabled, specular_disabled, fog_disabled;

uniform float glint = 300.0;         // a flake's mirror flash, for a light of 1 and a mote a pixel big (a flake under a pixel still lights it: the flash is as bright as the light's own face)
uniform float shine = 40.0;          // how narrow the flash (higher: rarer, shorter twinkles)
uniform float scatter = 8.0;         // its glow the rest of the time, at the forward lobe's peak, the same units (faint: in an ordinary lit room dust is hardly seen)
uniform float knee = 2.0;            // the light a mote needs before it shows, full at three times it (a flashlight's core, a sunbeam; not a corridor's tubes)
uniform float most_light = 1.0;      // a mote's brightest pixel: under the look's glow (1.05), so a speck stays a point, never a blooming blob
uniform float near_fade = 0.7;       // metres from the eye
uniform float far_fade = 3.6;        // and out toward the box's edge
uniform float quad_m = 0.0009;       // a typical flake, metres (the biggest 2.5 times it)
uniform float fibres = 0.12;         // the share that are fibres
uniform float min_px = 1.6;
uniform float viewport_h = 1080.0;   // the picture's height in pixels (VIEWPORT_SIZE isn't there in vertex())
// the beams (HSBeam's lights: a flashlight, a car's lamps): a mote in one is lit by it here, its cone, cookie and falloff
// worked out per mote. Dust shows in a beam (a real flashlight packs its light into one, far brighter than a lamp: Godot's
// spots don't), and hardly anywhere else (light() above takes the ordinary lights with a high knee).
uniform int beam_count = 0;
uniform vec4 beam_pos[4];            // the light (world), its range
uniform vec4 beam_dir[4];            // its axis (world), cos of its angle
uniform vec4 beam_col[4];            // its colour times its energy (linear), its angle attenuation
uniform vec4 beam_shape[4];          // its cookie (0 none, 1 flashlight, 2 led, 3 lantern), tan of its angle, its decay
uniform float beam_scatter = 30.0;   // a mote's glow in a beam (its flash is `glint`'s)
uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;   // what's behind it
uniform float dark = 0.06;           // a background this dark (linear) or darker: a mote shows fully
uniform float lit_bg = 0.5;          // and this light or lighter: it can't be seen

varying float v_fade;                // its share of a pixel's light: its size, its brightness, the fades, the growth's dimming
varying float v_fibre;
varying vec3 v_face;                 // a flake's face, or a fibre's axis (view space)
varying vec3 v_tint;
varying vec3 v_beam;                 // the beams' light on it, glow and flash (before its share of a pixel)
varying vec2 v_bg;                   // fragment() to light(): how well it's seen against what's behind it, the light it may still add

float h1(float n) {
	return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

float hg(float g, float c) {
	float g2 = g * g;
	return (1.0 - g2) / (12.566371 * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}

// a flashlight's cookie across its cone (HSAir.profile: the same numbers)
float profile(float kind, float r) {
	if (kind < 0.5) {
		return 1.0;
	}
	if (kind > 2.5) {
		return 1.0 - 0.85 * smoothstep(0.35, 1.0, r);
	}
	float hot = kind < 1.5 ? 1.0 - smoothstep(0.16, 0.34, r) : 1.0 - smoothstep(0.3, 0.46, r);
	float ring = kind < 1.5 ? 0.22 * exp(-pow((r - 0.4) / 0.035, 2.0)) : 0.12 * exp(-pow((r - 0.5) / 0.03, 2.0));
	float spill = kind < 1.5 ? 0.2 * (1.0 - smoothstep(0.82, 0.98, r)) : 0.3 * (1.0 - smoothstep(0.86, 0.97, r));
	return clamp(max(hot, spill) + ring, 0.0, 1.0);
}

void vertex() {
	vec4 cu = INSTANCE_CUSTOM;
	float fibre = step(1.0 - fibres, cu.x);
	// the tumble: about an axis of its own, at a rate of its own
	vec3 axis = normalize(vec3(h1(cu.z * 17.1), h1(cu.z * 31.7), h1(cu.z * 53.3)) - 0.5 + 1e-3);
	vec3 n0 = normalize(cross(axis, abs(axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
	float ang = cu.z * 6.2832 + TIME * mix(0.25, 1.4, h1(cu.z * 91.7));
	vec3 face = n0 * cos(ang) + cross(axis, n0) * sin(ang);
	v_face = normalize((VIEW_MATRIX * vec4(face, 0.0)).xyz);
	v_fibre = fibre;
	// lint isn't white: a touch of each mote's own colour
	v_tint = mix(vec3(1.0), vec3(h1(cu.w * 7.7), h1(cu.w * 13.3), h1(cu.w * 19.9)) * 0.6 + 0.55, 0.25 + 0.35 * fibre);
	float size = quad_m * mix(0.45 + 2.0 * pow(cu.y, 3.0), 1.0, fibre);
	vec3 centre = MODEL_MATRIX[3].xyz;
	vec3 c = (VIEW_MATRIX * vec4(centre, 1.0)).xyz;
	float px = size / max(-c.z, 0.01) * abs(PROJECTION_MATRIX[1][1]) * viewport_h * 0.5;   // abs: Vulkan's projection flips y (negative here, every mote grew 8-fold)
	float grow = clamp(min_px / max(px, 1e-4), 1.0, 8.0);
	vec3 right = INV_VIEW_MATRIX[0].xyz;
	vec3 up = INV_VIEW_MATRIX[1].xyz;
	vec2 half_size = vec2(size, size) * grow;
	if (fibre > 0.5) {
		vec2 d2 = v_face.xy;
		d2 = length(d2) > 1e-3 ? normalize(d2) : vec2(1.0, 0.0);
		right = (INV_VIEW_MATRIX * vec4(d2.x, d2.y, 0.0, 0.0)).xyz;
		up = (INV_VIEW_MATRIX * vec4(-d2.y, d2.x, 0.0, 0.0)).xyz;
		half_size = vec2(max(size * mix(2.5, 5.0, cu.y), size * 0.6 * grow), size * 0.6 * grow);   // grown in width only: a thread stays its own length
	}
	VERTEX = centre + right * VERTEX.x * half_size.x * 2.0 + up * VERTEX.y * half_size.y * 2.0;
	MODELVIEW_MATRIX = VIEW_MATRIX;
	float d = length(c);
	float area = mix(pow(0.45 + 2.0 * pow(cu.y, 3.0), 2.0), 1.6, fibre);   // its light goes with its size
	v_fade = smoothstep(near_fade, near_fade * 2.0, d) * (1.0 - smoothstep(far_fade * 0.7, far_fade, d)) * area * mix(0.6, 1.4, cu.w) / (grow * grow);
	// the beams' light on it
	vec3 to_eye = normalize(CAMERA_POSITION_WORLD - centre);
	vec3 acc = vec3(0.0);
	for (int i = 0; i < beam_count; i++) {
		vec3 L = beam_pos[i].xyz - centre;
		float dist = length(L);
		if (dist > beam_pos[i].w || dist < 1e-3) {
			continue;
		}
		vec3 Ln = L / dist;
		float cosa = dot(-Ln, beam_dir[i].xyz);
		if (cosa <= beam_dir[i].w) {
			continue;
		}
		float rim = max((1.0 - cosa) / (1.0 - beam_dir[i].w), 0.0);
		float cone = (1.0 - pow(rim, beam_col[i].w)) * profile(beam_shape[i].x, sqrt(max(1.0 - cosa * cosa, 0.0)) / max(cosa, 1e-3) / beam_shape[i].y);
		float nd = dist / beam_pos[i].w;
		nd *= nd;
		nd *= nd;
		nd = max(1.0 - nd, 0.0);
		nd *= nd;
		float att = nd * pow(max(dist, 0.05), -beam_shape[i].z);
		vec3 hv = Ln + to_eye;
		vec3 h = dot(hv, hv) > 1e-8 ? normalize(hv) : Ln;
		float flash;
		if (fibre > 0.5) {
			float t = dot(face, h);
			flash = pow(sqrt(max(1.0 - t * t, 0.0)), shine * 0.35) * 0.4;
		} else {
			flash = pow(abs(dot(face, h)), shine);
		}
		float cc = dot(-Ln, to_eye);
		float ph = mix(hg(0.6, cc), hg(-0.5, cc), 0.45) / hg(0.6, 1.0);
		acc += beam_col[i].rgb * 3.14159 * cone * att * (beam_scatter * ph + glint * flash);
	}
	v_beam = acc;
}

void fragment() {
	vec2 q = (UV - 0.5) * 2.0;
	float a = v_fibre > 0.5 ? exp(-q.y * q.y * 3.0) * (1.0 - smoothstep(0.55, 1.0, abs(q.x))) : exp(-dot(q, q) * 3.0);
	vec3 bg = textureLod(screen_tex, SCREEN_UV, 0.0).rgb;
	float lb = max(max(bg.r, bg.g), bg.b);
	float seen = 1.0 - smoothstep(dark, lit_bg, lb);
	float room = max(most_light - lb, 0.0);
	vec3 e = min(v_beam * v_fade * seen, vec3(room));
	v_bg = vec2(seen, max(room - max(max(e.r, e.g), e.b), 0.0));
	ALBEDO = v_tint * a;
	EMISSION = e * v_tint * a;
}

void light() {
	vec3 l = ATTENUATION * LIGHT_COLOR;
	float lum = max(max(l.r, l.g), l.b);
	float k = smoothstep(knee, knee * 3.0, lum);
	vec3 hv = LIGHT + VIEW;
	vec3 h = dot(hv, hv) > 1e-8 ? normalize(hv) : LIGHT;   // the light straight behind the mote: no half vector (NaN drew black)
	float flash;
	if (v_fibre > 0.5) {
		float t = dot(v_face, h);
		flash = pow(sqrt(max(1.0 - t * t, 0.0)), shine * 0.35) * 0.4;
	} else {
		flash = pow(abs(dot(v_face, h)), shine);
	}
	float c = dot(-LIGHT, VIEW);
	float ph = mix(hg(0.6, c), hg(-0.5, c), 0.45) / hg(0.6, 1.0);   // forward, and back toward the light (flakes): seen in your own beam
	DIFFUSE_LIGHT += min(l * k * (scatter * ph + glint * flash) * v_fade * v_bg.x, vec3(v_bg.y));
}
