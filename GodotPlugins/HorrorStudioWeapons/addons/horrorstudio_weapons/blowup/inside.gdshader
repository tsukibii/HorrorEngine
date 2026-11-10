shader_type spatial;
render_mode cull_back, depth_draw_opaque;
// The broken faces of an HSBlowUp's pieces (docs/research/breaking_props.md): what a thing is inside where it broke,
// drawn in the thing's own space so it stays put on a piece as it flies: its colour, grit, fibres along a grain, a
// scorch round a blast. A piece's mesh is in the thing's own space (HSBlowUp keeps it so), so MODEL's space is it.

uniform vec4 inside_color : source_color = vec4(0.86, 0.82, 0.75, 1.0);
uniform float roughness_v : hint_range(0.0, 1.0) = 0.85;
uniform float metallic_v : hint_range(0.0, 1.0) = 0.0;
uniform float speckle : hint_range(0.0, 1.0) = 0.3;     // grit (stone, ceramic)
uniform float fibres : hint_range(0.0, 1.0) = 0.0;      // lines along the grain (wood, card)
uniform vec3 grain_axis = vec3(1.0, 0.0, 0.0);
uniform float grit_m = 0.003;                           // the grit's size
uniform float bump = 0.5;                               // how much it catches the light
uniform vec3 scorch_at = vec3(0.0);                     // a blast's middle (the thing's space)
uniform float scorch_r = 0.0;                           // 0: none
uniform float scorch : hint_range(0.0, 1.0) = 0.0;

varying vec3 obj;

float h3(vec3 p) {
	p = fract(p * 0.1031);
	p += dot(p, p.zyx + 31.32);
	return fract((p.x + p.y) * p.z);
}

float vn(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// the break's height at a place: grit, or fibres drawn out along the grain
float rough_h(vec3 p) {
	float g = vn(p / grit_m) * 0.6 + vn(p / (grit_m * 0.37)) * 0.4;
	vec3 a = normalize(grain_axis);
	vec3 q = p - a * dot(p, a) * 0.93;
	float f = vn(q / (grit_m * 0.7)) * 0.7 + vn(q / (grit_m * 0.3)) * 0.3;
	return mix(mix(0.5, g, speckle), f, fibres);
}

void vertex() {
	obj = VERTEX;
}

void fragment() {
	float h = rough_h(obj);
	float e = grit_m * 0.3;
	vec3 grad = vec3(rough_h(obj + vec3(e, 0.0, 0.0)) - h, rough_h(obj + vec3(0.0, e, 0.0)) - h, rough_h(obj + vec3(0.0, 0.0, e)) - h) / e;
	vec3 gv = (VIEW_MATRIX * MODEL_MATRIX * vec4(grad, 0.0)).xyz;
	gv -= NORMAL * dot(gv, NORMAL);
	NORMAL = normalize(NORMAL - gv * bump * grit_m);
	vec3 col = inside_color.rgb * (0.8 + 0.4 * h);
	if (scorch_r > 0.0) {
		float s = scorch * (1.0 - smoothstep(scorch_r * 0.3, scorch_r, distance(obj, scorch_at)));
		col = mix(col, vec3(0.05, 0.045, 0.04), clamp(s * (0.65 + 0.5 * vn(obj * 55.0)), 0.0, 1.0));
	}
	ALBEDO = col;
	ROUGHNESS = roughness_v;
	METALLIC = metallic_v;
}
