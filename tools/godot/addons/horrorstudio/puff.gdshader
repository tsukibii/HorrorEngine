// A puff of steam or smoke (lifefx.gd): a soft disc eroded by fractal noise as it ages (it dissolves from the edges
// in), spun by its seed, lit as a little sphere from above, faded where it meets the scene (a soft particle: never a
// hard cut across the spout or a wall), alpha-blended: steam translucent white, smoke dark. Per instance (a MultiMesh
// with custom data): x its age 0..1, y its seed, z its spin.
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, unshaded;

uniform vec4 color : source_color = vec4(0.93, 0.94, 0.96, 1.0);
uniform vec3 light_dir = vec3(0.25, 1.0, 0.15);
uniform float softness = 0.08;        // metres over which a puff fades into geometry behind it
uniform float erode = 1.0;            // how far the noise eats the disc over its life
uniform sampler2D depth_tex : hint_depth_texture;

varying vec2 vuv;
varying vec4 vcustom;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }

void vertex() {
	vcustom = INSTANCE_CUSTOM;
	float ang = vcustom.y * 6.2831853 + vcustom.x * vcustom.z;
	float c = cos(ang), s = sin(ang);
	VERTEX.xy = mat2(vec2(c, s), vec2(-s, c)) * VERTEX.xy;
	vuv = VERTEX.xy;                                   // -0.5..0.5 on the quad
	// a billboard that keeps the instance's scale (Godot's own billboard_keep_scale)
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
}

void fragment() {
	float u = vcustom.x, seed = vcustom.y;
	vec2 c = vuv * 2.0;
	float r = length(c);
	if (r > 1.0) { discard; }
	float radial = 1.0 - r * r;
	float n = fbm(vuv * 3.2 + vec2(seed * 37.0, seed * 11.0) + vec2(0.0, -u * 0.5));
	float th = mix(0.15, 0.75, u) * erode;                       // the noise threshold rises with age: the edges go first
	float a = smoothstep(th - 0.22, th + 0.12, n * 0.65 + radial * 0.6) * radial;
	vec3 nrm = normalize(vec3(c, sqrt(max(0.0, 1.0 - r * r))));  // lit as a little sphere
	vec3 L = normalize((VIEW_MATRIX * vec4(normalize(light_dir), 0.0)).xyz);
	float lit = 0.62 + 0.38 * clamp(dot(nrm, L), 0.0, 1.0);
	float depth_raw = texture(depth_tex, SCREEN_UV).r;             // a soft particle: fades into what's just behind it
	vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, depth_raw);
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view.xyz /= view.w;
	float fade = clamp((-view.z - (-VERTEX.z)) / softness, 0.0, 1.0);
	ALBEDO = color.rgb * lit;
	ALPHA = a * COLOR.a * fade;
}
