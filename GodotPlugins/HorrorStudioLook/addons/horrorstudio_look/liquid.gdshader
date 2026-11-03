// The opaque liquid (soy sauce, coffee, blood): liquid.gdshaderinc. The see-through one is liquid_clear.gdshader.
shader_type spatial;
render_mode cull_disabled, depth_draw_opaque;

#include "res://addons/horrorstudio_look/liquid.gdshaderinc"

void fragment() {
	vec3 a;
	vec3 n;
	float r;
	float al;
	bool cut;
	liquid_fragment(FRONT_FACING, VIEW_MATRIX, a, n, r, al, cut);
	if (cut) {
		discard;
	}
	ALBEDO = a;
	ROUGHNESS = r;
	SPECULAR = 0.5;
	if (!FRONT_FACING) {
		NORMAL = n;
	}
}
