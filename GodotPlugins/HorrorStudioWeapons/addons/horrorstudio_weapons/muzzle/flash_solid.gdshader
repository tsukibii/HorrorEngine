// A muzzle flash's wings drawn solid (HSMuzzleFlash.blend SOLID): the same spheres, fronts culled, and the same burn
// (flash.gdshaderinc), but each pixel shows the nearest sphere's back and is cut away where the burn has eaten it, so
// the orange and red edges stay crisp instead of adding up to white.
shader_type spatial;
render_mode unshaded, cull_front, depth_draw_opaque, shadows_disabled, fog_disabled;

#include "res://addons/horrorstudio_weapons/muzzle/flash.gdshaderinc"

uniform float cut = 0.04;                  // where the burn has eaten it: gone

void fragment() {
	vec4 f = flash_burn(NORMAL, VIEW, v_p, v_n, v_custom);
	ALBEDO = f.rgb;
	ALPHA = f.a;
	ALPHA_SCISSOR_THRESHOLD = cut;
}
