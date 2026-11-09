// The smoke a muzzle trails after a shot (HSMuzzle): a ribbon through the places the muzzle has been, turned to face
// the eye, its width growing and its density fading with each part's age, broken into wisps by the noise drifting up
// it. Like all the studio's smoke it scatters the light that reaches it and never darkens what's behind it (LESSONS:
// alpha smoke made a dark cloud in a dim room): lit, added, its light capped (smoke_light.gdshaderinc).
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, shadows_disabled, specular_disabled;

#include "res://addons/horrorstudio_weapons/muzzle/smoke_light.gdshaderinc"

uniform sampler2D noise_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec4 smoke_color : source_color = vec4(0.82, 0.8, 0.77, 1.0);
uniform float density = 0.5;
uniform float drift = 0.18;                // how fast the wisps run up the ribbon

void fragment() {
	// UV.x across the ribbon, UV.y along it (metres from the muzzle's end); COLOR.a its density there
	float across = sin(clamp(UV.x, 0.0, 1.0) * PI);
	vec2 q = vec2(UV.x * 0.35, UV.y * 1.6 - TIME * drift);
	float n = texture(noise_tex, q).r * 0.6 + texture(noise_tex, q * 2.7 + vec2(0.41, -TIME * drift * 0.7)).r * 0.4;
	float d = across * smoothstep(0.12, 0.8, n) * COLOR.a * density;
	ALBEDO = smoke_color.rgb;
	EMISSION = smoke_color.rgb * glow;
	ALPHA = clamp(d, 0.0, 1.0);
}
