shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back, specular_schlick_ggx;
// A character charring over as she goes (HSHitReact's DISSOLVE; docs/research/hit_reactions.md): drawn over her own
// materials as each mesh's material_overlay, the char spreading in ragged patches from `burn` 0 to all of her at 1, its
// front glowing like embers. Once she's charred all over, crumble.gdshader takes her surfaces and eats them away.
#include "res://addons/horrorstudio_weapons/react/char_noise.gdshaderinc"

uniform float burn : hint_range(0.0, 1.0) = 0.0;
uniform vec4 char_color : source_color = vec4(0.02, 0.016, 0.018, 1.0);
uniform vec4 edge_color : source_color = vec4(1.0, 0.3, 0.06, 1.0);
uniform float edge_energy = 3.0;
uniform float edge_w = 0.07;                    // the burning front's width (of the noise's range)
uniform float scale = 7.0;                      // the patches: about 1/scale m across
uniform vec3 seed = vec3(0.0);

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float n = ch_spread(ch_field(wpos, scale, seed));
	float front = burn * (1.0 + edge_w * 2.0) - edge_w;     // below it: charred
	float charred = smoothstep(front + 0.01, front - 0.01, n);
	float edge = smoothstep(front + edge_w, front, n) * (1.0 - charred);
	ALBEDO = char_color.rgb;
	ROUGHNESS = 0.95;
	SPECULAR = 0.2;
	EMISSION = edge_color.rgb * edge_energy * edge * (0.6 + 0.4 * ch_vn(wpos * 40.0 + vec3(0.0, TIME * 3.0, 0.0)));
	ALPHA = clamp(charred + edge * 0.85, 0.0, 1.0);
}
