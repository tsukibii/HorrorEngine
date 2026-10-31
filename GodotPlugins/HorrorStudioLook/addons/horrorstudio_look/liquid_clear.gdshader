// The see-through liquid (water, sake, tea): liquid.gdshaderinc, blended over what's behind it; its depth written so
// the glass round it sorts over it.
shader_type spatial;
render_mode cull_disabled, blend_mix, depth_draw_always;

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
	SPECULAR = 0.6;
	ALPHA = al;
	if (!FRONT_FACING) {
		NORMAL = n;
	}
}
