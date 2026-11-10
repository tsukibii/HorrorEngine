// The noise the weapons' smoke is read through (smoke.gdshader's trail, puff.gdshader's puffs; docs/research/
// muzzle_smoke.md): fractal value noise in the world, warped by itself so its wisps curl, rising through the smoke with
// time, its contrast stretched. Every sprite and puff on a spot reads the same value there, so together they're one
// smoke, not beads or grit.

float smoke_hash(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float smoke_vnoise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = mix(mix(smoke_hash(i), smoke_hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(smoke_hash(i + vec3(0.0, 1.0, 0.0)), smoke_hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y);
	float b = mix(mix(smoke_hash(i + vec3(0.0, 0.0, 1.0)), smoke_hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(smoke_hash(i + vec3(0.0, 1.0, 1.0)), smoke_hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y);
	return mix(a, b, f.z);
}

float smoke_fbm(vec3 p, int octaves) {
	float a = 0.5;
	float s = 0.0;
	float norm = 0.0;
	for (int i = 0; i < octaves; i++) {
		s += a * smoke_vnoise(p);
		norm += a;
		p = p * 2.03 + vec3(1.7, 9.2, 3.1);
		a *= 0.5;
	}
	return s / norm;
}

// the smoke's noise at a place in the world (m), 0..1: wisps `wisp_m` across, curling more as the smoke ages (0..1),
// rising `rise` m/s; `seed` moves it for a strand of its own
float smoke_wisps(vec3 wpos, float age, float wisp_m, float rise, float seed, float time) {
	vec3 p = wpos / wisp_m + vec3(seed * 13.7, -time * rise / wisp_m, seed * 7.1);
	vec3 warp = vec3(smoke_fbm(p * 0.4 + 2.3, 2), smoke_fbm(p * 0.4 + 8.1, 2), smoke_fbm(p * 0.4 + 5.6, 2)) - 0.5;
	float n = smoke_fbm(p + warp * (2.0 + 2.5 * age), 4);
	return clamp((n - 0.5) * 1.9 + 0.5, 0.0, 1.0);   // (fractal value noise sits near its middle: its contrast stretched)
}
