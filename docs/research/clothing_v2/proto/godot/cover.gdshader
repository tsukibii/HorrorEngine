// Clothing layers in Godot (the fit test, docs/research/clothing_v2/fit_test.md): what a layer worn over this mesh
// covers isn't drawn, so nothing is there to come through it in any pose; where the mesh goes under that layer's edge
// it dissolves over a couple of centimetres instead of ending in a line.
// The mesh's vertex colours say how deep each point is under each band of layers (glb.py: (cover + 1) / 3, a cover
// 0 where the dissolve starts and 1 where the cloth is gone): red under bottoms, green under tops, blue under
// outerwear, alpha under legwear and shoes. A game that takes a layer off turns its band down here and what was
// under it is drawn again, dissolving back in: nothing is baked again.
shader_type spatial;
render_mode cull_disabled;

uniform vec4 albedo : source_color = vec4(1.0);
uniform sampler2D albedo_tex : source_color, hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform float alpha_cut : hint_range(0.0, 1.0) = 0.0;      // a texture with holes cut in it
uniform float roughness : hint_range(0.0, 1.0) = 0.85;
uniform bool use_cover = true;                              // (a mesh with no vertex colours: nothing hides it)
// the bands worn over this mesh: 1 worn, 0 taken off, in between while it goes on or comes off
uniform float bottoms : hint_range(0.0, 1.0) = 1.0;
uniform float tops : hint_range(0.0, 1.0) = 1.0;
uniform float outerwear : hint_range(0.0, 1.0) = 1.0;
uniform float footwear : hint_range(0.0, 1.0) = 1.0;
uniform bool show_cover = false;                            // for looking at it: what's hidden painted red instead of left out

varying vec4 cover;

void vertex() {
	cover = use_cover ? COLOR * 3.0 - 1.0 : vec4(-1.0);
}

// interleaved gradient noise: a dither that TAA and FSR2 resolve into a smooth fade
float ign(vec2 p) {
	return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void fragment() {
	vec4 t = texture(albedo_tex, UV) * albedo;
	if (t.a < alpha_cut) {
		discard;
	}
	// each band's cover, less as its layer comes off (3 is a cover's whole range), then the most of them
	vec4 c4 = cover - (1.0 - vec4(bottoms, tops, outerwear, footwear)) * 3.0;
	float c = max(max(c4.r, c4.g), max(c4.b, c4.a));
	if (show_cover) {
		t.rgb = mix(t.rgb, vec3(1.0, 0.08, 0.03), clamp(c, 0.0, 1.0));
	} else if (c > ign(FRAGCOORD.xy)) {
		discard;
	}
	if (alpha_cut <= 0.0 && t.a < 0.999 && ign(FRAGCOORD.xy + vec2(37.0, 17.0)) > t.a) {
		discard;                                            // a sheer garment (tights): a veil by the same dither
	}
	ALBEDO = t.rgb;
	ROUGHNESS = roughness;
	METALLIC = 0.0;
}
