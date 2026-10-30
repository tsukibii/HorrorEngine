// Blood (HSBlood, docs/GODOT_LOOK.md): a splat on a flat thing (a stain's block, a decal's quad): a pool with a
// ragged edge, satellite drops flung from it, drips running down its -y when it's on a wall (`drips`), the surface
// wet and glossy (roughness 0.08: the lights lie in it) drying to a dull brown (`dry` 0..1). `opacity` fades it
// (the clean task scrubbing it away). The shape from the seed: no two alike.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 wet_color : source_color = vec4(0.30, 0.012, 0.012, 1.0);
uniform vec4 dry_color : source_color = vec4(0.14, 0.03, 0.02, 1.0);
uniform float dry : hint_range(0.0, 1.0) = 0.0;
uniform float opacity : hint_range(0.0, 1.0) = 1.0;
uniform float seed = 1.0;
uniform float drops = 0.6;             // the satellite drops
uniform float drips = 0.0;             // streaks running down -y (the quad's v), for a wall
uniform float pool = 0.55;             // the main pool's size (of the quad)
uniform float ragged = 0.35;           // how ragged its edge

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.1 + 5.3; a *= 0.5; } return v; }

// the splat's coverage 0..1 at a point of the quad (uv 0..1), and its thickness (the pool deep in the middle)
float splat(vec2 uv, out float thick) {
	vec2 c = uv - 0.5;
	float ang = atan(c.y, c.x);
	float r = length(c);
	// the pool: a disc whose radius wanders with the angle (ragged), bulging at a few angles (lobes)
	float edge_n = fbm(vec2(ang * 1.6, seed * 3.1) ) - 0.5;
	float lobes = 0.5 + 0.5 * sin(ang * (3.0 + floor(hash12(vec2(seed, 2.0)) * 3.0)) + seed);
	float rad = pool * 0.5 * (0.75 + ragged * (edge_n * 1.4 + lobes * 0.4));
	float d = r - rad;
	float cover = 1.0 - smoothstep(-0.015, 0.012, d);
	thick = clamp(-d / max(rad, 1e-3), 0.0, 1.0);
	// satellite drops: cells round the pool, a drop in some, flung outward (elongated away from the middle)
	vec2 q = uv * 9.0 + seed * 7.0;
	vec2 i = floor(q);
	for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
		vec2 cell = i + vec2(float(dx), float(dy));
		vec2 h = hash22(cell + seed);
		if (h.x > drops * 0.9) continue;
		vec2 centre = (cell + 0.15 + 0.7 * hash22(cell * 1.7 + seed)) / 9.0;
		vec2 dir = normalize(centre - 0.5 + 1e-4);
		vec2 off = uv - centre;
		float along = dot(off, dir), across = dot(off, vec2(-dir.y, dir.x));
		float far = length(centre - 0.5);
		float sz = 0.012 + 0.02 * h.y * (1.0 - far);     // smaller further out
		float e = length(vec2(along / (1.0 + 1.5 * far), across)) - sz;
		float dd = 1.0 - smoothstep(-0.004, 0.004, e);
		cover = max(cover, dd * step(rad * 0.9, far));
		thick = max(thick, dd * 0.5);
	}
	// drips: streaks down from the pool's lower edge
	if (drips > 0.0) {
		float x = uv.x + seed;
		float lane = floor(x * 14.0);
		float lh = hash12(vec2(lane, seed));
		if (lh < drips) {
			float lx = fract(x * 14.0) - 0.5;
			float width = 0.14 + 0.2 * hash12(vec2(lane, seed + 1.0));
			float len = 0.15 + 0.4 * hash12(vec2(lane, seed + 2.0));
			float top = 0.5 + rad * 0.6;
			float v = uv.y;
			float inlane = 1.0 - smoothstep(width * 0.8, width, abs(lx));
			float inlen = smoothstep(top - 0.02, top, v) * (1.0 - smoothstep(top + len - 0.03, top + len, v));
			float bead = 1.0 - smoothstep(0.0, width * 1.6, length(vec2(lx, (v - (top + len)) * 1.2)));
			float dr = max(inlane * inlen, bead);
			cover = max(cover, dr);
			thick = max(thick, dr * 0.6);
		}
	}
	return cover;
}

void fragment() {
	float thick;
	float cover = splat(UV, thick);
	float a = cover * opacity;
	if (a < 0.02) discard;
	vec3 col = mix(wet_color.rgb, dry_color.rgb, dry);
	col *= mix(1.0, 0.55, thick * (1.0 - dry * 0.5));        // the pool deep red in its middle
	ALBEDO = col;
	ROUGHNESS = mix(0.08, 0.6, dry);
	SPECULAR = mix(0.7, 0.4, dry);
	ALPHA = a;
}
