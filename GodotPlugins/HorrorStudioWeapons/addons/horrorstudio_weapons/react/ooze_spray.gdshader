// HSOoze's spray (react/ooze.gdshaderinc has the rest): a spray thrown along +x, as spatter lands: a dense core a little
// behind where it landed, thin spines thrown out (longer along the throw), droplets in a cone ahead drawn out into
// tadpoles, their tails back toward where they came from; it spreads as it lands, sags and creeps on; on a wall drips
// run down out of it.
shader_type spatial;
render_mode blend_mix, depth_draw_never, depth_test_disabled, cull_front, specular_schlick_ggx;
#include "res://addons/horrorstudio_weapons/react/ooze.gdshaderinc"

float field(vec2 p, float t) {
	float s = seed * 7.0;                                          // (small: sin() hashes lose themselves on big numbers)
	float S = size_m;
	float grow = (0.7 + 0.3 * (1.0 - exp(-t * 4.0))) * (1.0 + 0.035 * log(1.0 + t));
	float R = S * 0.13 * grow;
	float slope = length(dn);
	vec2 down = slope > 0.01 ? dn / slope : vec2(0.0);
	vec2 o = vec2(-S * 0.08, 0.0) + down * slope * S * 0.035 * (1.0 - exp(-t / 6.0));
	float d = 1e3;
	for (int i = 0; i < 9; i++) {
		float fi = float(i);
		vec2 c = o + (vec2(hh(s + fi * 3.1), hh(s + fi * 3.1 + 1.7)) - 0.5) * S * vec2(0.32, 0.24);
		d = smin(d, length(p - c) - R * (0.3 + 0.45 * hh(s + fi * 7.7)), R * 0.35);
	}
	float far = length(p - o);
	if (far < S * 0.56) {                                           // (the spines reach no farther)
		for (int i = 0; i < 10; i++) {
			float fi = float(i);
			float a = (hh(s + 11.0 + fi) - 0.5) * 2.3;
			vec2 dir = vec2(cos(a), sin(a));
			float L = S * (0.14 + 0.34 * pow(hh(s + 23.0 + fi), 1.5)) * grow * (0.55 + 0.45 * cos(a));
			float w0 = R * (0.14 + 0.12 * hh(s + 31.0 + fi));
			d = smin(d, capsule(p, o + dir * R * 0.3, o + dir * L, w0, w0 * 0.15), w0 * 1.1);
		}
	}
	if (far < S * 0.66) {                                           // (nor the droplets)
		for (int i = 0; i < 20; i++) {
			float fi = float(i);
			float a = (hh(s + 41.0 + fi) - 0.5) * 2.1 * (0.45 + 0.55 * hh(s + 47.0 + fi));
			vec2 dir = vec2(cos(a), sin(a));
			vec2 c = o + dir * S * (0.2 + 0.36 * pow(hh(s + 53.0 + fi), 0.8)) * grow;
			float r = S * (0.004 + 0.017 * pow(hh(s + 67.0 + fi), 2.0));    // (mostly small)
			float dd = length(p - c) - r;
			dd = smin(dd, capsule(p, c, c - dir * r * (2.0 + 5.0 * hh(s + 73.0 + fi)), r * 0.55, r * 0.1), r * 0.5);
			d = min(d, dd);
		}
	}
	d += (fbm(p / S * 7.0 + s) - 0.5) * S * 0.02;
	return drips(p, o, R, 5, t, d, s, S * 0.7);
}

#include "res://addons/horrorstudio_weapons/react/ooze_frag.gdshaderinc"
