shader_type spatial;
render_mode cull_disabled, specular_schlick_ggx;
// A character crumbling into smoke (HSHitReact's DISSOLVE, after char.gdshader has charred all of her): her surfaces
// swapped for this, the char's colour, eaten away in ragged holes from `crumble` 0 (whole) to 1 (nothing), each hole's
// rim burning. Opaque and cut out, so nothing behind her shows through her and nothing sorts wrong.
#include "res://addons/horrorstudio_weapons/react/char_noise.gdshaderinc"

uniform float crumble : hint_range(0.0, 1.0) = 0.0;
uniform vec4 char_color : source_color = vec4(0.02, 0.016, 0.018, 1.0);
uniform vec4 edge_color : source_color = vec4(1.0, 0.3, 0.06, 1.0);
uniform float edge_energy = 3.0;
uniform float edge_w = 0.09;
uniform float scale = 9.0;
uniform vec3 seed = vec3(0.0);

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float n = ch_spread(ch_field(wpos, scale, seed + vec3(17.3, 5.1, 9.2)));
	float front = crumble * (1.0 + edge_w * 2.0) - edge_w;  // below it: gone
	if (n < front) {
		discard;
	}
	float edge = smoothstep(front + edge_w, front, n);
	ALBEDO = char_color.rgb;
	ROUGHNESS = 0.95;
	SPECULAR = 0.2;
	EMISSION = edge_color.rgb * edge_energy * edge * edge * (0.6 + 0.4 * ch_vn(wpos * 40.0 + vec3(0.0, TIME * 3.0, 0.0)));
}
