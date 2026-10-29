// A wet surface (HSWet, docs/GODOT_LOOK.md): the floor darkened by the damp, its roughness down so the lights smear
// across it (screen-space reflections carry them), and puddles pooled where a world-space noise dips: mirror-smooth,
// tinted by the water, their edge damp; rain on them as rings spreading from drops. The base look comes from the
// material it replaces (its colour or texture, its roughness). Chilla's Art's wet ground at night, Light Kit's
// Puddle (UnrealPlugins/LightKit): "deep and mirror-smooth in the middle, damp at the edge".
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 albedo : source_color = vec4(0.23, 0.2, 0.18, 1.0);
uniform sampler2D texture_albedo : source_color, hint_default_white, filter_linear_mipmap, repeat_enable;
uniform bool use_texture = false;
uniform bool world_uv = false;             // a world-aligned floor (the export's triplanar surfaces): sampled by its place
uniform vec3 uv1_scale = vec3(1.0);
uniform float roughness : hint_range(0.0, 1.0) = 1.0;
uniform float wetness : hint_range(0.0, 1.0) = 0.8;        // the damp: darker, a sheen
uniform float puddles : hint_range(0.0, 1.0) = 0.5;        // how much of the surface pools
uniform float puddle_scale = 0.9;                          // metres per pool
uniform float ripples : hint_range(0.0, 1.0) = 0.0;        // rain hitting the pools
uniform float ripple_rate = 1.0;
uniform vec4 water_tint : source_color = vec4(0.04, 0.05, 0.06, 1.0);
uniform float edge = 0.12;                                 // the damp rim round a pool (in the noise's units)

varying vec3 wpos;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.07 + 11.3; a *= 0.5; } return v; }

// the pool mask: 1 in the water, 0 on the dry, with a damp rim just outside
void pool(vec2 p, out float water, out float damp) {
	float n = fbm(p / puddle_scale);
	float th = 0.62 - puddles * 0.3;                   // more pooling: the threshold lower
	water = smoothstep(th, th + 0.05, n);
	damp = smoothstep(th - edge, th, n);
}

// rings from drops: a grid of cells, each a drop every so often, the ring's height as a gradient on the normal
vec2 rings(vec2 p, float t) {
	vec2 g = vec2(0.0);
	for (int k = 0; k < 2; k++) {
		vec2 q = p * (k == 0 ? 6.0 : 9.0) + float(k) * 3.7;
		vec2 i = floor(q), f = fract(q);
		for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
			vec2 c = i + vec2(float(dx), float(dy));
			vec2 h = hash22(c);
			float period = 1.2 + h.x * 1.6;              // seconds between drops in this cell
			float age = mod(t * ripple_rate + h.y * period, period);
			vec2 centre = c + 0.2 + 0.6 * hash22(c + 7.0);
			vec2 d = q - centre;
			float r = length(d);
			float ring = age * 1.1;                      // the ring's radius grows (about 18 cm a second)
			float w = 0.07;
			float fade = exp(-age * 2.4) * step(0.0, age);   // gone within a second, as a real drop's ring is
			float s = sin((r - ring) / w) * exp(-((r - ring) * (r - ring)) / (w * w * 2.0)) * fade;
			g += (r > 1e-4 ? d / r : vec2(0.0)) * s;
		}
	}
	return g * 0.2;
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	UV = UV * uv1_scale.xy;
}

void fragment() {
	vec3 base = albedo.rgb;
	if (use_texture) base *= texture(texture_albedo, world_uv ? wpos.xz * uv1_scale.xz : UV).rgb;
	float water, damp;
	pool(wpos.xz, water, damp);
	water *= step(0.001, wetness);
	float wet = wetness;
	// the damp darkens and tightens the highlight everywhere; a pool is water: its own colour over the dark floor
	vec3 col = base * mix(1.0, 0.55, wet) * mix(1.0, 0.75, damp * wet);
	col = mix(col, mix(col * 0.6, water_tint.rgb, 0.55), water);
	float rough = roughness * mix(1.0, 0.45, wet) * mix(1.0, 0.6, damp * wet);
	rough = mix(rough, 0.035, water);
	ALBEDO = col;
	ROUGHNESS = clamp(rough, 0.0, 1.0);
	SPECULAR = mix(0.5, 0.9, max(water, 0.5 * damp * wet));
	if (ripples > 0.0 && water > 0.0) {       // the rings bend the water's normal per pixel: the reflection wobbles where drops land
		vec2 g = rings(wpos.xz, TIME) * ripples * water;   // (per vertex it did nothing on a floor of eight vertices: 2026-10-29)
		NORMAL = normalize(NORMAL + TANGENT * g.x + BINORMAL * g.y);
	}
}
