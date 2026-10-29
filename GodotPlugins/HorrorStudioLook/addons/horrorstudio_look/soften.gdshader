// The softener (HSSoften, docs/VHS.md: the camhybrid tape): the picture softened by distance, a full-screen quad on
// the camera reading the depth. Up close (a wall, a thing in the hand) it stays almost sharp, a touch of softness
// only; from `near_m` to `far_m` the blur grows to `soft` pixels, so the far room melts into the tape while what
// the eye is on stays readable. Drawn before the tape (a canvas layer) and under the HUD.
shader_type spatial;
render_mode unshaded, depth_test_disabled, cull_disabled, fog_disabled, skip_vertex_transform;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear, repeat_disable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;
uniform float near_m = 0.9;      // metres: sharp up to here
uniform float far_m = 7.0;       // metres: fully soft from here
uniform float soft = 1.6;        // pixels of blur at full
uniform float least = 0.25;      // pixels of blur up close (never quite sharp)

void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

void fragment() {
	float depth = texture(depth_tex, SCREEN_UV).x;
	vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, depth);
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view.xyz /= view.w;
	float lin = -view.z;
	float k = smoothstep(near_m, far_m, lin);
	float r = mix(least, soft, k);
	vec2 px = r / VIEWPORT_SIZE;
	vec3 c = texture(screen_tex, SCREEN_UV).rgb * 0.28;
	c += texture(screen_tex, SCREEN_UV + vec2(px.x, 0.0)).rgb * 0.12;
	c += texture(screen_tex, SCREEN_UV - vec2(px.x, 0.0)).rgb * 0.12;
	c += texture(screen_tex, SCREEN_UV + vec2(0.0, px.y)).rgb * 0.12;
	c += texture(screen_tex, SCREEN_UV - vec2(0.0, px.y)).rgb * 0.12;
	c += texture(screen_tex, SCREEN_UV + px).rgb * 0.06;
	c += texture(screen_tex, SCREEN_UV - px).rgb * 0.06;
	c += texture(screen_tex, SCREEN_UV + vec2(px.x, -px.y)).rgb * 0.06;
	c += texture(screen_tex, SCREEN_UV - vec2(px.x, -px.y)).rgb * 0.06;
	ALBEDO = c;
}
