// A candle's flame (HSPropFX; docs/PROPGEN.md §14): a teardrop drawn on a quad that turns round the world's up to face
// the camera (a flame stays upright), its core white-yellow, an orange skirt, a little blue at its foot, swaying at
// the tip and breathing in height by noise over time, added onto what's behind it. `tint` colours it, `intensity`
// how bright, `seed` so two flames don't move together.
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, unshaded, shadows_disabled;

uniform vec4 tint : source_color = vec4(1.0, 0.62, 0.3, 1.0);
uniform float intensity = 2.2;
uniform float seed = 0.0;
uniform float sway = 1.0;

varying vec2 vuv;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise(float x) { float i = floor(x), f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), u); }

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	vec3 to_cam = INV_VIEW_MATRIX[3].xyz - o;
	vec3 fwd = normalize(vec3(to_cam.x, 0.0, to_cam.z) + vec3(0.0, 0.0, 1e-5));
	vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
	float sx = length(MODEL_MATRIX[0].xyz), sy = length(MODEL_MATRIX[1].xyz);
	vec3 world = o + right * VERTEX.x * sx + vec3(0.0, 1.0, 0.0) * VERTEX.y * sy;
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(world, 1.0);
	vuv = UV;
}

void fragment() {
	vec2 p = vec2(vuv.x * 2.0 - 1.0, 1.0 - vuv.y);                    // x across, y 0 at its foot to 1 at its tip
	float t = TIME * 5.0 + seed * 17.3;
	float breathe = 0.9 + 0.12 * (vnoise(t * 0.9) - 0.5) * 2.0 + 0.05 * (vnoise(t * 3.1 + 5.0) - 0.5);
	float y = p.y / breathe;
	p.x += (vnoise(t * 0.55 + 11.0) - 0.5) * 0.5 * sway * y * y;      // the tip sways more than the foot
	float w = 0.58 * pow(max(sin(3.14159 * pow(clamp(y, 0.0, 1.0), 0.62)), 0.0), 0.85);
	float d = abs(p.x) / max(w, 1e-3);
	float a = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.82, 1.0, y));
	vec3 skirt = tint.rgb * vec3(1.0, 0.75, 0.6);
	vec3 c = mix(skirt, mix(tint.rgb, vec3(1.0, 0.85, 0.55), 0.5), smoothstep(0.95, 0.35, d));
	c = mix(c, vec3(1.0, 0.97, 0.86), smoothstep(0.55, 0.0, d) * smoothstep(0.75, 0.15, y));     // the bright core
	c = mix(c, vec3(0.25, 0.4, 1.0), smoothstep(0.16, 0.0, y) * smoothstep(1.0, 0.3, d) * 0.7); // blue where it starts
	ALBEDO = c * intensity;
	ALPHA = a;
}
