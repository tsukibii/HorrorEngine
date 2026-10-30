// Hair (HSHair, docs/GODOT_LOOK.md §5c): the Character Studio's hair look on an imported model's hair cards (the
// salon's bake, the brows and lashes: strands in an atlas whose alpha is the coverage), the same maths as
// tools/character/hairshader.js on the scene's own lights: Kajiya-Kay highlights along the strands (two, shifted
// apart along the strand, the second tinted by the hair's colour), a wrap diffuse so a card's back isn't black, a
// rim, soft tips and cards fading as they turn edge-on, a lock's own colour by its vertex colour; and the retro look
// as toggles: `flat` (unlit, the atlas's own colours, whatever the light), `steps` (the colours in so many levels),
// `dither` (the PSX's 4x4 ordered dither between the levels, in the screen's pixels). The tangent along the strand
// comes from the card's UVs (the glb carries none), so any card hair with v along the strand works.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform sampler2D texture_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 albedo : source_color = vec4(1.0);
uniform bool use_vertex_color = true;         // a lock's own colour (the salon's bake carries it)
uniform float cut : hint_range(0.0, 1.0) = 0.4;        // the coverage a pixel needs to be hair
uniform float soft : hint_range(0.0, 1.0) = 0.5;       // the tips feathered, a card seen edge-on faded
uniform float tips_at : hint_range(0.0, 1.0) = 1.0;    // where the tips are along v (the salon's atlas: the root at 0; three's exporter keeps the UVs and flips the image)
uniform float shine : hint_range(0.0, 3.0) = 1.0;
uniform float gloss1 : hint_range(4.0, 400.0) = 120.0;   // the first highlight, tight and white
uniform float gloss2 : hint_range(4.0, 400.0) = 24.0;    // the second, broad and in the hair's colour
uniform float shift1 : hint_range(-0.5, 0.5) = -0.06;    // the highlights shifted apart along the strand
uniform float shift2 : hint_range(-0.5, 0.5) = 0.1;
uniform float shift_noise : hint_range(0.0, 1.0) = 0.4;   // each strand's highlight shifted its own way (a flat card otherwise lights up whole)
uniform vec4 spec_color : source_color = vec4(1.0, 0.97, 0.92, 1.0);
uniform float rim : hint_range(0.0, 1.0) = 0.15;
uniform float wrap : hint_range(0.0, 1.0) = 0.6;         // the diffuse wrapped round (hair is lit through)
uniform float roughness : hint_range(0.0, 1.0) = 0.45;
// the retro look
uniform bool unlit = false;                   // the story's `flat` (`flat` is GLSL's own word)
uniform float flat_gain : hint_range(0.2, 3.0) = 1.0;
uniform float steps : hint_range(0.0, 64.0) = 0.0;      // 0: off
uniform bool dither = false;

varying vec3 v_tangent;                        // along the strand, view space (set in fragment, read in light)
varying float v_along;
varying float v_shift;                         // this strand's own shift

float bayer4(vec2 p) {
	int i = int(mod(p.x, 4.0)) + 4 * int(mod(p.y, 4.0));
	const float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
	return (m[i] + 0.5) / 16.0;
}

// the colours in `steps` levels, in the screen's own gamma (as the Studio quantises its drawn frame), the dither between them
vec3 quantise(vec3 c, vec2 px) {
	vec3 s = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
	float lv = steps > 0.5 ? steps : 31.0;
	float d = dither ? bayer4(px) - 0.5 : 0.0;
	s = clamp(floor(s * lv + 0.5 + d) / lv, 0.0, 1.0);
	return pow(s, vec3(2.2));
}

float kk(vec3 T, vec3 H, float g) {
	float th = dot(T, H);
	return pow(sqrt(max(0.0, 1.0 - th * th)), g);
}

void fragment() {
	vec4 at = texture(texture_albedo, UV);
	vec3 base = at.rgb * albedo.rgb;
	if (use_vertex_color) {
		base *= COLOR.rgb;
	}
	float along = abs(UV.y - (1.0 - tips_at));           // 0 at the root, 1 at the tip
	v_along = along;
	v_shift = (fract(sin(floor(UV.x * 48.0) * 12.9898) * 43758.5453) - 0.5) * shift_noise;
	vec3 N = FRONT_FACING ? NORMAL : -NORMAL;
	NORMAL = N;
	// the tangent along the strand from the card's UVs: dP/dv in view space (the sign doesn't matter to Kajiya-Kay)
	vec3 dpx = dFdx(VERTEX), dpy = dFdy(VERTEX);
	vec2 dux = dFdx(UV), duy = dFdy(UV);
	vec3 T = dpx * duy.x - dpy * dux.x;
	float tl = length(T);
	v_tangent = tl > 1e-8 ? T / tl : normalize(cross(N, vec3(0.0, 1.0, 0.0)));
	float alpha = smoothstep(cut - 0.15 - 0.25 * soft, cut + 0.15 + 0.1 * soft, at.a) * albedo.a;
	alpha *= 1.0 - soft * smoothstep(0.8, 1.0, along);                       // the tips feather out
	float ndv = abs(dot(N, VIEW));
	alpha *= mix(1.0, smoothstep(0.06, 0.35, ndv), 0.6 * soft);             // a card seen edge-on fades: no spikes in profile
	ALPHA = alpha;
	ALPHA_SCISSOR_THRESHOLD = cut * 0.4 * (1.0 - 0.75 * soft);
	ROUGHNESS = roughness;
	SPECULAR = 0.0;                                                          // the highlights are ours (light())
	if (unlit) {
		ALBEDO = vec3(0.0);                                                  // unlit: the strands' own colours, whatever the light
		EMISSION = quantise(base * flat_gain, FRAGCOORD.xy);
	} else {
		ALBEDO = (steps > 0.5 || dither) ? quantise(base, FRAGCOORD.xy) : base;
		EMISSION = vec3(0.0);
	}
	RIM = rim;
	RIM_TINT = 0.5;
}

void light() {
	if (!unlit) {                                  // (a light() can't return early)
		vec3 T = normalize(v_tangent);
		float ndl = dot(NORMAL, LIGHT);
		float diff = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
		float vis = smoothstep(-0.25, 0.35, ndl);
		DIFFUSE_LIGHT += diff * ATTENUATION * LIGHT_COLOR / PI;
		vec3 H = normalize(LIGHT + VIEW);
		vec3 T1 = normalize(T + NORMAL * (shift1 + v_shift)), T2 = normalize(T + NORMAL * (shift2 + v_shift));
		float s1 = kk(T1, H, gloss1), s2 = kk(T2, H, gloss2);
		vec3 spec = (spec_color.rgb * s1 * 0.6 + ALBEDO * 1.6 * s2 * 0.3) * 0.12 * shine * mix(0.25, 1.0, smoothstep(0.0, 0.3, v_along));   // the roots in the strands' shade
		SPECULAR_LIGHT += min(spec * vis * ATTENUATION * LIGHT_COLOR / PI, vec3(0.35));   // a strong lamp never bleaches a card white (Kajiya-Kay lights a whole flat card whose strands run square to the half vector: the crown's ring)
	}
}
