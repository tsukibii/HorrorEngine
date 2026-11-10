// HSOoze's pool (react/ooze.gdshaderinc has the rest): spreading where it lay, its edge reaching out in thin tendrils
// as it ages; on a slope drips run down out of it.
shader_type spatial;
render_mode blend_mix, depth_draw_never, depth_test_disabled, cull_front, specular_schlick_ggx;
#include "res://addons/horrorstudio_weapons/react/ooze.gdshaderinc"

float field(vec2 p, float t) {
	float s = seed * 7.0;
	float S = size_m;
	float R = S * 0.42 * (0.35 + 0.65 * (1.0 - exp(-t / 1.4))) * (1.0 + 0.05 * log(1.0 + t));
	float d = length(p) - R * 0.7;
	for (int i = 0; i < 6; i++) {
		float fi = float(i);
		float a = fi * 1.047 + hh(s + fi) * 0.8;
		vec2 c = vec2(cos(a), sin(a)) * R * (0.35 + 0.3 * hh(s + 13.0 + fi));
		d = smin(d, length(p - c) - R * (0.38 + 0.22 * hh(s + 29.0 + fi)), R * 0.35);
	}
	d += (fbm(p / S * 7.0 + s) - 0.5) * S * 0.05;
	float far = S * 0.32 * reach * (1.0 - exp(-t / 9.0));        // the tendrils' reach, slowly
	float out_d = length(p) - R;
	if (far > 0.002 && out_d < far + S * 0.02) {
		vec2 q = p / S * 4.0 + vec2(s, -s);
		float n = fbm(q + 0.6 * vec2(fbm(q * 0.7 + 3.1), fbm(q * 0.7 + 8.4)));
		float ridge = 1.0 - abs(2.0 * n - 1.0);                      // thin lines where the noise crosses its middle
		float tendril = (0.955 - ridge) * S * 0.2 + max(out_d - far, 0.0) * 2.0;
		tendril = max(tendril, -S * 0.004);                         // (thin: a film, never a body)
		d = smin(d, tendril, S * 0.02);
	}
	return drips(p, vec2(0.0), R * 0.6, 3, t, d, s, S * 0.9);
}

#include "res://addons/horrorstudio_weapons/react/ooze_frag.gdshaderinc"
