// The smoke a muzzle trails after a shot (HSMuzzle; docs/research/muzzle_smoke.md): soft sprites close along the curve
// through the places the muzzle has been, each stretched along it and turned to the eye. Their density is one noise read
// in the world (fractal value noise warped by itself, so the wisps curl, the noise rising through it with time), so the
// sprites read as one wisp rather than beads; read along a ribbon instead, the noise stretched into parallel streaks. A
// soft body, worn away by subtraction as it ages, so it frays from its edges into wisps (multiplied, it only faded as a
// whole); faded out where it meets what's behind it (a soft particle) and near the lens. Drawn premultiplied, as the
// puffs are: a thin wisp only adds the light it scatters, a thick one converges to its lit colour instead of adding up
// to white; its light capped (smoke_light.gdshaderinc).
shader_type spatial;
render_mode blend_premul_alpha, depth_draw_never, cull_disabled, shadows_disabled, specular_disabled;

#include "res://addons/horrorstudio_weapons/muzzle/smoke_light.gdshaderinc"
#include "res://addons/horrorstudio_weapons/muzzle/smoke_noise.gdshaderinc"

uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;
uniform vec4 smoke_color : source_color = vec4(0.82, 0.8, 0.77, 1.0);
uniform float density = 0.5;
uniform float occlude = 0.45;              // how much of what's behind it a thick wisp hides (0: only added)
uniform float wisp_m = 0.045;              // the wisps' size (m)
uniform float rise = 0.05;                 // the noise rising through it (m/s)
uniform float erode = 0.55;                // how much it frays as it ages
uniform float soft_m = 0.08;               // faded out this near what's behind it (m)
uniform float near_m = 0.14;               // and this near the lens (m)
uniform vec4 ember : source_color = vec4(0.0);   // a glow in the youngest smoke (its alpha how strong): a demon's, near its wound

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	// UV across the sprite (x along the curve, y across it); COLOR.r its age (0 fresh, 1 gone), COLOR.g its seed, COLOR.a
	// its share of the wisp's density
	float age = COLOR.r;
	float n = smoke_wisps(wpos, age, wisp_m, rise, COLOR.g, TIME);
	vec2 q = UV * 2.0 - 1.0;
	float body = exp(-(q.x * q.x * 1.5 + q.y * q.y * 3.0));     // the sprite's footprint: soft all round, long along the curve
	// subtractive erosion of the world's noise (the same for every sprite on a spot, so they agree: one wisp, not
	// beads): the thin parts go first, and more of it as it ages (wisps, then threads, then nothing)
	float wisp = clamp((n + 0.15 * body - 0.38 - erode * (0.1 + 0.4 * age)) / 0.25, 0.0, 1.0);
	float d = wisp * wisp * body * COLOR.a * density;
	// a soft particle: thinner as it nears what's behind it, gone where it meets it; and none against the lens
	float dz = texture(depth_tex, SCREEN_UV).r;
	vec4 sv = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, dz, 1.0);
	float behind = -sv.z / sv.w;
	float here = -VERTEX.z;
	d *= clamp((behind - here) / soft_m, 0.0, 1.0);
	d *= smoothstep(near_m * 0.4, near_m, here);
	ALBEDO = smoke_color.rgb;
	EMISSION = smoke_color.rgb * glow + ember.rgb * ember.a * 4.0 * (1.0 - age) * (1.0 - age) * (1.0 - age);
	PREMUL_ALPHA_FACTOR = d;
	ALPHA = d * occlude;
}
