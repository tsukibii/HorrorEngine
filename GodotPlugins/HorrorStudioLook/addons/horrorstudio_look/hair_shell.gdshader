// Short hair as shells (HSHair, docs/GODOT_LOOK.md §5u; the Character Studio's hair editor v2.0, docs/HAIR_V2.md
// §3.10): a buzz cut, stubble, clipped sides and napes. The mesh is a few copies of the scalp lifted off the skin (the
// fur technique); each is drawn with a tile of hairs' cross-sections: a hair is drawn on a layer while it's tall enough
// to reach it, narrower the higher the layer, and only where hair is left (the hairline's edge and a thinning patch
// thin out). The coverage is dithered pixel by pixel and frame by frame for the TAA, as the cards' is, so from afar it's
// a soft fuzz of the right density and close up it's hairs.
//   the tile: R each hair's height (its own number), G its number for thinning, B its shade, A its profile (1 middle .. 0 edge)
//   COLOR:    r the layer (0 at the skin .. 1 at the tips), g how much hair is left there
shader_type spatial;
render_mode cull_disabled, depth_draw_opaque;

uniform sampler2D texture_tile : filter_linear_mipmap, repeat_enable;
uniform vec4 root_color : source_color = vec4(0.012, 0.012, 0.014, 1.0);
uniform vec4 tip_color : source_color = vec4(0.05, 0.05, 0.06, 1.0);
uniform float amount : hint_range(0.0, 1.0) = 1.0;       // hairs drawn, over what the mesh says is left
uniform float thick : hint_range(0.3, 2.5) = 1.0;        // each hair's width
uniform float density : hint_range(0.5, 3.0) = 1.6;      // the coverage thickened (dithered)
uniform float shine : hint_range(0.0, 1.0) = 0.3;
uniform float roughness : hint_range(0.0, 1.0) = 0.55;

varying float v_f;
varying float v_left;

void vertex() {
	v_f = COLOR.r;
	v_left = COLOR.g;
}

void fragment() {
	vec4 t = texture(texture_tile, UV);
	float tall = smoothstep(v_f - 0.08, v_f + 0.04, t.r);                 // this hair reaches this layer
	float there = smoothstep(t.g - 0.04, t.g + 0.04, v_left * amount);    // this hair is one of those left here
	float prof = smoothstep(0.0, 0.3, t.a * thick - v_f * 0.5);            // narrower toward its tip
	ALPHA = clamp(tall * there * prof * density, 0.0, 1.0);
	float fr = floor(TIME * 60.0);
	vec2 px = FRAGCOORD.xy + fr * vec2(5.588238, 3.6971);
	ALPHA_SCISSOR_THRESHOLD = clamp(fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))), 0.05, 0.95);
	vec3 c = mix(root_color.rgb, tip_color.rgb, smoothstep(0.0, 0.85, v_f)) * (0.65 + 0.7 * t.b);
	ALBEDO = c * mix(0.45, 1.0, v_f);                                    // the lower layers in the upper ones' shade
	ROUGHNESS = roughness;
	SPECULAR = shine;
}
