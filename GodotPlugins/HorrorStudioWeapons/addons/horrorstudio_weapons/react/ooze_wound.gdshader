// HSOoze's wound (react/ooze.gdshaderinc has the rest): a dark hole oozing down whatever it's on.
shader_type spatial;
render_mode blend_mix, depth_draw_never, depth_test_disabled, cull_front, specular_schlick_ggx;
#include "res://addons/horrorstudio_weapons/react/ooze.gdshaderinc"

float field(vec2 p, float t) {
	float s = seed * 7.0;
	float S = size_m;
	float R = S * 0.32 * (0.85 + 0.15 * (1.0 - exp(-t * 2.0)));
	float d = length(p * vec2(1.0, 1.15)) - R;
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		vec2 c = (vec2(hh(s + fi * 5.3), hh(s + fi * 5.3 + 2.2)) - 0.5) * R * 1.1;
		d = smin(d, length(p - c) - R * (0.4 + 0.3 * hh(s + 9.0 + fi)), R * 0.4);
	}
	d += (fbm(p / S * 8.0 + s) - 0.5) * S * 0.04;
	return drips(p, vec2(0.0), R, 2, t, d, s, S * 1.6);
}

#include "res://addons/horrorstudio_weapons/react/ooze_frag.gdshaderinc"
