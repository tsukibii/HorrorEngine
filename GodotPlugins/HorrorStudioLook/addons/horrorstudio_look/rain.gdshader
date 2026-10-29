// Rain (HSRain, docs/GODOT_LOOK.md): streaks falling through a box, each a thin quad turned to the camera, moved
// by the shader from its seed (no particle system to tick): it falls at its own speed, wraps at the box's floor,
// drifts with the wind. Additive, soft at its ends, faint up close (a drop a hand from the eye would be a bar).
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, unshaded;

uniform vec3 box_size = vec3(8.0, 4.0, 8.0);
uniform float speed = 7.0;                 // m/s at the drops' slowest
uniform float streak = 0.3;                // metres: the streak's length (the shutter's smear)
uniform float width = 0.0035;              // metres
uniform vec4 color : source_color = vec4(0.72, 0.78, 0.9, 1.0);
uniform float strength : hint_range(0.0, 1.0) = 0.45;
uniform float wind = 0.25;                 // sideways lean, 0..1

varying float va;
varying vec2 vuv;

void vertex() {
	vec4 c = INSTANCE_CUSTOM;              // xyz the drop's seat in the box 0..1, w its phase
	float v = speed * (0.8 + 0.5 * c.w);
	vec3 p = c.xyz * box_size - box_size * 0.5;
	float fallen = mod(c.y * box_size.y + TIME * v, box_size.y);
	p.y = box_size.y * 0.5 - fallen;
	p.x += sin(TIME * 0.7 + c.w * 6.2831) * 0.15 * wind + wind * 0.6 * fallen * 0.15;
	vec3 fall = normalize(vec3(wind * 0.35, -1.0, 0.0));
	vec3 right = INV_VIEW_MATRIX[0].xyz;
	vec3 pos = p + right * VERTEX.x * width - fall * (VERTEX.y + 0.5) * streak;
	float dcam = length((VIEW_MATRIX * vec4((MODEL_MATRIX * vec4(pos, 1.0)).xyz, 1.0)).xyz);
	va = smoothstep(0.25, 0.9, dcam) * smoothstep(0.0, 0.3, fallen) * smoothstep(0.0, 0.3, box_size.y - fallen);
	vuv = vec2(VERTEX.x + 0.5, VERTEX.y + 0.5);
	VERTEX = pos;
}

void fragment() {
	float across = 1.0 - abs(vuv.x * 2.0 - 1.0);
	float along = smoothstep(0.0, 0.25, vuv.y) * (1.0 - smoothstep(0.75, 1.0, vuv.y));
	ALBEDO = color.rgb * across * along * va * strength;
	ALPHA = 1.0;
}
