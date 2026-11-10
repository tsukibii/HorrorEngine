// HSOoze's drop (react/ooze.gdshaderinc has the rest): a drop that landed: a round splash, a few droplets round it.
shader_type spatial;
render_mode blend_mix, depth_draw_never, depth_test_disabled, cull_front, specular_schlick_ggx;
#include "res://addons/horrorstudio_weapons/react/ooze.gdshaderinc"

float field(vec2 p, float t) {
	float s = seed * 7.0;
	float S = size_m;
	float R = S * 0.3 * (0.75 + 0.25 * (1.0 - exp(-t * 6.0)));
	float d = length(p) - R;
	for (int i = 0; i < 5; i++) {
		float fi = float(i);
		float a = hh(s + fi * 2.3) * 6.2832;
		vec2 c = vec2(cos(a), sin(a)) * R * (1.35 + 0.6 * hh(s + 7.0 + fi));
		d = min(d, length(p - c) - R * (0.08 + 0.12 * hh(s + 17.0 + fi)));
	}
	d += (fbm(p / S * 6.0 + s) - 0.5) * S * 0.05;
	return drips(p, vec2(0.0), R, 1, t, d, s, S * 0.8);
}

#include "res://addons/horrorstudio_weapons/react/ooze_frag.gdshaderinc"
