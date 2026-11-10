// A spark (HSMuzzle's, an impact's): a streak along the way it flies, turned to face the eye, hot at its head and
// fading to its tail. The particles' Y is aligned with their velocity (CPUParticles3D's align_y); their scale is the
// streak's length.
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;

uniform float width = 0.0025;              // metres
uniform float energy = 2.6;

void vertex() {
	vec3 c = MODEL_MATRIX[3].xyz;
	vec3 y = MODEL_MATRIX[1].xyz;
	float len = length(y);
	vec3 dir = y / max(len, 1e-5);
	vec3 to_cam = normalize(CAMERA_POSITION_WORLD - c);
	vec3 side = cross(dir, to_cam);
	side = length(side) > 1e-4 ? normalize(side) : normalize(cross(vec3(0.0, 1.0, 0.0), to_cam) + vec3(1e-4, 0.0, 0.0));
	vec3 wp = c + dir * VERTEX.y * len + side * VERTEX.x * 2.0 * width;
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(wp, 1.0);
}

void fragment() {
	float across = 1.0 - abs(UV.x * 2.0 - 1.0);
	float head = mix(1.0, 0.15, UV.y);
	ALBEDO = COLOR.rgb * energy;
	ALPHA = clamp(COLOR.a * across * across * head, 0.0, 1.0);
}
