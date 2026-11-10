// The char's noise (HSHitReact's DISSOLVE: char.gdshader, crumble.gdshader): value noise in the world, warped, so the
// patches don't follow her UVs' seams (she's held still while she goes: it doesn't swim on her).

float ch_h3(vec3 p) {
	p = fract(p * vec3(0.1031, 0.1030, 0.0973));
	p += dot(p, p.yxz + 33.33);
	return fract((p.x + p.y) * p.z);
}

float ch_vn(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(ch_h3(i), ch_h3(i + vec3(1, 0, 0)), f.x), mix(ch_h3(i + vec3(0, 1, 0)), ch_h3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(ch_h3(i + vec3(0, 0, 1)), ch_h3(i + vec3(1, 0, 1)), f.x), mix(ch_h3(i + vec3(0, 1, 1)), ch_h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float ch_fbm(vec3 p) {
	float s = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		s += ch_vn(p) * a;
		p = p * 2.03 + vec3(13.1, 7.7, 3.9);
		a *= 0.5;
	}
	return s / 0.97;
}

// 0..1 over her, warped: a front at `t` (0..1) has ragged patches
float ch_field(vec3 w, float scale, vec3 seed) {
	vec3 p = w * scale + seed;
	return ch_fbm(p + 0.6 * vec3(ch_fbm(p * 0.5 + 3.1), ch_fbm(p * 0.5 + 8.4), ch_fbm(p * 0.5 + 5.7)));
}

// the noise's range squeezed onto 0..1 (an fbm's values gather in its middle: the front would sweep it in a moment)
float ch_spread(float n) {
	return clamp((n - 0.28) / 0.44, 0.0, 1.0);
}
