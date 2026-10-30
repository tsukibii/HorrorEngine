// A light's pattern (HSPattern, docs/GODOT_LOOK.md §1b): moving light with nothing moving. Drawn into a small
// viewport the light projects (its `light_projector`), so the pattern falls where the light is aimed: water caustics
// on a ceiling or a wall (by a bath, a pool, a puddle under a lamp), sun or moon through swaying leaves, stripes from
// venetian blinds, cloud shadows passing. Light Kit's four light functions (UnrealPlugins/LightKit,
// lightkit_materials.py) in GLSL, the same maths; UV in metres across the aimed surface (`metres` the width the
// projector covers there), so `scale` means what it means there.
shader_type canvas_item;
render_mode blend_disabled, unshaded;

uniform int kind = 0;               // 0 caustics, 1 leaves, 2 blinds, 3 clouds
uniform float metres = 3.0;         // the width the texture covers at the aim (HSPattern sets it from the distance and the spread)
uniform float scale = 0.6;          // metres per feature (blinds: per slat)
uniform float speed = 0.4;
uniform float openness = 0.5;       // leaves: the canopy's openness; blinds: the slats'; caustics: the water's own light; clouds: the cover
uniform float angle = 0.0;          // blinds: the slats' angle in degrees (0 horizontal)
uniform float t = 0.0;              // the moment drawn (HSPattern draws a loop of frames, one a frame, then cycles them)

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 q) {
	vec2 i = floor(q), f = fract(q);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 q, int octaves, vec2 step_) {
	float n = 0.0, a = 0.5;
	for (int o = 0; o < 6; o++) {
		if (o >= octaves) break;
		n += a * vnoise(q);
		q = q * 2.07 + step_;
		a *= 0.5;
	}
	return n;
}

void fragment() {
	vec2 uvm = (UV - 0.5) * metres;        // metres across the aimed surface, 0 at the middle
	float v = 1.0;
	if (kind == 1) {                        // leaves
		vec2 p = uvm / max(scale, 0.01) * 3.0;
		float tt = t * speed;
		vec2 w = 0.12 * vec2(sin(tt * 1.3 + p.y * 0.9), cos(tt * 1.1 + p.x * 0.8));
		float n = fbm(p + w, 3, vec2(13.7, 7.3) + w);
		float cut = mix(0.68, 0.42, clamp(openness, 0.0, 1.0));
		float lit = smoothstep(cut - 0.05, cut + 0.05, n);
		v = mix(0.06, 1.0, lit);
	} else if (kind == 2) {                 // blinds
		float a = radians(angle);
		float s = uvm.x * cos(a) + uvm.y * sin(a);
		float f = fract(s / max(scale, 0.005));
		float lit = 1.0 - smoothstep(openness - 0.06, openness + 0.06, f);
		v = mix(0.04, 1.0, lit);
	} else if (kind == 3) {                 // clouds
		vec2 q = uvm / max(scale, 0.01) + vec2(t * speed, t * speed * 0.37);
		float n = fbm(q, 5, vec2(5.3, 9.1));
		float cover = mix(0.35, 0.65, clamp(openness, 0.0, 1.0));
		v = mix(1.0, 0.35, smoothstep(cover - 0.08, cover + 0.08, n));
	} else {                                // caustics
		float tt = t * speed;
		float acc = 0.0;
		for (int layer = 0; layer < 2; layer++) {
			vec2 p = uvm / max(scale, 0.01) * (layer == 0 ? 1.0 : 1.7) + float(layer) * vec2(3.1, 1.7);
			p += 0.2 * vec2(sin(p.y * 2.3 + tt), cos(p.x * 2.1 - tt * 0.8));
			vec2 i = floor(p), f = fract(p);
			float d1 = 8.0, d2 = 8.0;
			for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
				vec2 g = vec2(float(x), float(y));
				vec2 c = i + g;
				vec2 h = fract(sin(vec2(dot(c, vec2(127.1, 311.7)), dot(c, vec2(269.5, 183.3)))) * 43758.5453);
				vec2 o = 0.5 + 0.4 * sin(tt * 0.7 + 6.2831853 * h);
				float d = length(g + o - f);
				if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
			}
			acc += (1.0 - smoothstep(0.0, 0.12, d2 - d1)) * (layer == 0 ? 0.7 : 0.45);
		}
		float base = mix(0.05, 0.5, clamp(openness, 0.0, 1.0));
		v = base + (1.2 - base) * clamp(acc, 0.0, 1.0);
	}
	// the cone's own edge: nothing outside the circle the projector draws, soft at its rim
	float r = length(UV - 0.5) * 2.0;
	v *= 1.0 - smoothstep(0.8, 1.0, r);
	COLOR = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}
