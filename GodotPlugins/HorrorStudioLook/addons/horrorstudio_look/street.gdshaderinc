// A street from the Blender bake (tools/street.py bake, docs/STREET_TEXTURING.md), as street.gd sets it up at import:
// the finish's tileable set at its real size on UV (times the surface's own colour), and the street's wear atlas on
// UV2 (R the occlusion, G dirt, B rain streaks on walls or the wet patches on what faces up, A worn edges), laid on
// with the same sums as Blender's "Street wear" group (tools/streetbake/finishes.py), so the game matches the render.
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform sampler2D albedo_tex : source_color, hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform float roughness = 1.0;
uniform float metallic = 0.0;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_normal = false;
uniform float normal_scale = 1.0;
uniform vec3 uv1_scale = vec3(1.0);
uniform vec3 uv1_offset = vec3(0.0);
uniform sampler2D wear_tex : hint_default_white, filter_linear_mipmap, repeat_disable;
// the wear's colours are linear multipliers, as Blender's (not picked as sRGB colours)
uniform vec3 dirt_color = vec3(0.55, 0.52, 0.48);
uniform float dirt = 1.0;
uniform vec3 streak_color = vec3(0.5, 0.48, 0.45);
uniform float streaks = 1.0;
uniform vec3 edge_color = vec3(0.9);
uniform float edge_lighter = 1.0;
uniform float edges = 0.5;
uniform float wet = 0.0;
uniform float tone = 1.0;
uniform float wear_amount : hint_range(0.0, 2.0) = 1.0;
uniform float ao_strength : hint_range(0.0, 1.0) = 1.0;
#ifdef CUT
uniform float alpha_cut : hint_range(0.0, 1.0) = 0.5;
#endif

varying vec3 w_pos;
varying vec3 w_nrm;

float hs_hash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float hs_noise(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hs_hash(i), hs_hash(i + vec3(1, 0, 0)), f.x), mix(hs_hash(i + vec3(0, 1, 0)), hs_hash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hs_hash(i + vec3(0, 0, 1)), hs_hash(i + vec3(1, 0, 1)), f.x), mix(hs_hash(i + vec3(0, 1, 1)), hs_hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

void vertex() {
	w_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	w_nrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec2 uv = UV * uv1_scale.xy + uv1_offset.xy;
	vec4 a = texture(albedo_tex, uv) * albedo_color;
	vec4 w = texture(wear_tex, UV2);
	float vert = 1.0 - smoothstep(0.45, 0.7, abs(w_nrm.y));
	float up = smoothstep(0.6, 0.85, w_nrm.y);
	vec3 c = a.rgb;
	float t = hs_noise(w_pos * 0.12) * 0.6 + hs_noise(w_pos * 0.24 + 7.0) * 0.4;
	c *= 1.0 + tone * (t - 0.5) * 0.3;
	float f = clamp(w.g * dirt * wear_amount, 0.0, 1.0);
	c = mix(c, c * dirt_color, f);
	float s = clamp(w.b * streaks * vert * wear_amount, 0.0, 1.0);
	c = mix(c, c * streak_color, s);
	float wt = clamp(w.b * wet * up * wear_amount, 0.0, 1.0);
	c *= 1.0 - 0.35 * wt;
	float e = clamp(w.a * edges * wear_amount, 0.0, 1.0);
	c = mix(c, mix(edge_color, c * 1.3 + 0.03, edge_lighter), e);
	vec4 orm = texture(orm_tex, uv);
	ALBEDO = c;
	ROUGHNESS = clamp((orm.g * roughness + f * 0.08 + s * 0.04) * (1.0 - 0.7 * wt), 0.0, 1.0);
	METALLIC = orm.b * metallic;
	AO = mix(1.0, w.r, ao_strength);
	if (has_normal) {
		NORMAL_MAP = texture(normal_tex, uv).rgb;
		NORMAL_MAP_DEPTH = normal_scale;
	}
#ifdef CUT
	ALPHA = a.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cut;
#endif
}
