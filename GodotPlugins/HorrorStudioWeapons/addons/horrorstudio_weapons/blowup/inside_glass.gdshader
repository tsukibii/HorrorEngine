shader_type spatial;
render_mode blend_mix, cull_back, depth_draw_opaque;
// A glass thing's broken faces (HSBlowUp, a kind that's see_through): clear and glossy, its edge green where you look
// along it, as a pane's edge is.

uniform vec4 inside_color : source_color = vec4(0.78, 0.9, 0.85, 0.4);
uniform float roughness_v : hint_range(0.0, 1.0) = 0.05;
uniform float metallic_v : hint_range(0.0, 1.0) = 0.0;
// (the opaque inside's words, so a kind sets either the same way)
uniform float speckle = 0.0;
uniform float fibres = 0.0;
uniform vec3 grain_axis = vec3(1.0, 0.0, 0.0);
uniform float grit_m = 0.003;
uniform float bump = 0.0;
uniform vec3 scorch_at = vec3(0.0);
uniform float scorch_r = 0.0;
uniform float scorch = 0.0;

void fragment() {
	float edge = 1.0 - abs(dot(NORMAL, VIEW));
	ALBEDO = mix(inside_color.rgb, inside_color.rgb * vec3(0.55, 0.85, 0.62), edge);
	ALPHA = clamp(inside_color.a + edge * 0.45, 0.0, 1.0);
	ROUGHNESS = roughness_v;
	METALLIC = metallic_v;
	SPECULAR = 0.9;
}
