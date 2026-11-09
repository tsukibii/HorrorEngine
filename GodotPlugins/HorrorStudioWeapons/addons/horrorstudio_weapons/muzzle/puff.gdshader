// A puff of smoke (HSMuzzle's cloud thrown out with a shot, an impact's dust and an explosion's smoke): a particle
// billboard turned by its own angle, the puff's picture, the particle's colour and fade; lit and added, its light
// capped (smoke_light.gdshaderinc), so it scatters the light reaching it and never darkens what's behind it.
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, shadows_disabled, specular_disabled;

#include "res://addons/horrorstudio_weapons/muzzle/smoke_light.gdshaderinc"

uniform sampler2D puff_tex : source_color, hint_default_white, filter_linear_mipmap;
uniform float density = 1.0;

void vertex() {
	mat4 w = mat4(normalize(INV_VIEW_MATRIX[0]), normalize(INV_VIEW_MATRIX[1]), normalize(INV_VIEW_MATRIX[2]), MODEL_MATRIX[3]);
	w = w * mat4(vec4(cos(INSTANCE_CUSTOM.x), -sin(INSTANCE_CUSTOM.x), 0.0, 0.0), vec4(sin(INSTANCE_CUSTOM.x), cos(INSTANCE_CUSTOM.x), 0.0, 0.0), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_MATRIX = VIEW_MATRIX * w;
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
}

void fragment() {
	vec4 t = texture(puff_tex, UV);
	ALBEDO = COLOR.rgb * t.rgb;
	EMISSION = COLOR.rgb * t.rgb * glow;
	ALPHA = clamp(COLOR.a * t.a * density, 0.0, 1.0);
}
