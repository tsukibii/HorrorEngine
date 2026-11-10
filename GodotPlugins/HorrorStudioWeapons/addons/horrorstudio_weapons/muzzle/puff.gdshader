// A puff of smoke (HSMuzzle's cloud thrown out with a shot, an impact's dust and an explosion's smoke): a particle
// billboard turned by its own angle, the puff's soft round shape (its picture, a little blurred), worn into wisps by the
// smoke's noise in the world (smoke_noise.gdshaderinc: the same for every puff on a spot, so a cloud of them is one
// smoke, not grit; more of it as the puff ages), the particle's colour and fade; lit, its light capped
// (smoke_light.gdshaderinc), so it scatters the light reaching it. Premultiplied: a puff adds its light as an added one
// would, and hides `occlude` of what's behind it as much as it covers, so a thick cloud lit by a second flash glows
// its lit colour instead of the puffs summing to white (0: added, hiding nothing).
shader_type spatial;
render_mode blend_premul_alpha, depth_draw_never, cull_disabled, shadows_disabled, specular_disabled;

#include "res://addons/horrorstudio_weapons/muzzle/smoke_light.gdshaderinc"
#include "res://addons/horrorstudio_weapons/muzzle/smoke_noise.gdshaderinc"

uniform sampler2D puff_tex : source_color, hint_default_white, filter_linear_mipmap;
uniform float density = 1.0;
uniform float occlude = 0.7;
uniform float wisp_m = 0.05;               // the wisps' size (m)
uniform float rise = 0.05;                 // the noise rising through it (m/s)
uniform float erode = 0.45;                // how much a puff frays into wisps as it ages
uniform vec4 ember : source_color = vec4(0.0);   // a glow in the youngest puffs (its alpha how strong)

varying float v_age;                       // the particle's phase: 0 thrown out, 1 gone

void vertex() {
	mat4 w = mat4(normalize(INV_VIEW_MATRIX[0]), normalize(INV_VIEW_MATRIX[1]), normalize(INV_VIEW_MATRIX[2]), MODEL_MATRIX[3]);
	w = w * mat4(vec4(cos(INSTANCE_CUSTOM.x), -sin(INSTANCE_CUSTOM.x), 0.0, 0.0), vec4(sin(INSTANCE_CUSTOM.x), cos(INSTANCE_CUSTOM.x), 0.0, 0.0), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_MATRIX = VIEW_MATRIX * w;
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
	v_age = INSTANCE_CUSTOM.y;
}

void fragment() {
	vec4 t = texture(puff_tex, UV, 1.5);             // (its soft round shape: the fine raggedness is the noise's to give)
	vec3 wpos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float n = smoke_wisps(wpos, v_age, wisp_m, rise, 0.0, TIME);
	float wisp = clamp((n + 0.3 * t.a - 0.36 - erode * (0.05 + 0.35 * v_age)) / 0.4, 0.0, 1.0);
	ALBEDO = COLOR.rgb * t.rgb;
	EMISSION = COLOR.rgb * t.rgb * glow + ember.rgb * ember.a * 4.0 * (1.0 - v_age) * (1.0 - v_age) * (1.0 - v_age);
	float a = clamp(COLOR.a * t.a * wisp * density * 1.5, 0.0, 1.0);
	PREMUL_ALPHA_FACTOR = a;
	ALPHA = a * occlude;
}
