// A muzzle flash's wings (HSMuzzle; DECISIONS 2026-11-09, latest, the user's way): each wing a run of slightly
// elongated spheres that intersect, their fronts culled. A noise is mapped triplanar onto each sphere and blended by
// the view's normal dotted with the surface's through a colour burn: the facing (1 where the sphere's middle is seen,
// 0 at its rim) burnt by the noise, so each sphere is eaten away from its rim inward along the noise, its middle
// white-hot, its edges orange and red where they burn out, and where the spheres overlap the fire adds up.
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_front, shadows_disabled, fog_disabled;

#include "res://addons/horrorstudio_weapons/muzzle/flash.gdshaderinc"

void fragment() {
	vec4 f = flash_burn(NORMAL, VIEW, v_p, v_n, v_custom);
	ALBEDO = f.rgb;
	ALPHA = smoothstep(0.0, 0.08, f.a);
}
