// Hair (HSHair, docs/GODOT_LOOK.md §5c; the body of hair.gdshader and hair_fine.gdshader): the Character Studio's hair look on an imported model's hair cards (the
// salon's bake, the brows and lashes: strands in an atlas whose alpha is the coverage), the same maths as
// tools/character/hairshader.js on the scene's own lights: Kajiya-Kay highlights along the strands (two, shifted
// apart along the strand, the second tinted by the hair's colour), a wrap diffuse so a card's back isn't black, a
// rim, soft tips and cards fading as they turn edge-on, a lock's own colour by its vertex colour; and the retro look
// as toggles: `flat` (unlit, the atlas's own colours, whatever the light), `steps` (the colours in so many levels),
// `dither` (the PSX's 4x4 ordered dither between the levels, in the screen's pixels). The tangent along the strand
// comes from the card's UVs (the glb carries none), so any card hair with v along the strand works.
// MetaHuman's way, from the salon's bake (2026-10-31, docs/GODOT_LOOK.md §5e; docs/research/hair_cards_unreal.md):
// the hair volume's shell normal (`shell_normals`: the cards shade as one soft mass, both faces alike), the tangent
// along each strand (`tangent_along`), each vertex's occlusion (`baked_occlusion`: UV2), each strand's own numbers
// (`use_strands`: its shift, its glint), the coverage dithered pixel by pixel and frame by frame for the TAA to
// resolve into soft strands (`hashed`), the roots fading into the scalp, the card's own face fading edge-on,
// light through the outer strands from behind (`transmission`) and a soft scatter of the hair's own colour.
// Two shaders wear it: hair.gdshader cuts the coverage (the head's hair: soft or dithered for the TAA), hair_fine.gdshader
// (HS_FINE) blends it at its true coverage (the brows and lashes: a hair a tenth of a millimetre wide is a third of a
// pixel at a close-up, and a cut drew it a whole pixel wide and black; dithered, the TAA wiped it out).

uniform sampler2D texture_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D texture_strands : filter_linear_mipmap, repeat_enable;   // the bake's strand numbers (G strand, B clump): the glb's occlusion slot
uniform bool use_strands = false;
uniform bool tangent_along = false;           // the mesh's own TANGENT runs along the strand (the salon's bake); else it comes from the UVs
uniform bool shell_normals = false;           // the mesh's NORMAL is the hair volume's (the salon's bake): both faces lit by it
uniform bool baked_occlusion = false;         // UV2: x across the card (0 and 1 its edges), y how much sky it sees (the salon's bake)
uniform float side_fade : hint_range(0.0, 0.5) = 0.0;  // the card's sides fade over this much of its width (the bake's UV2.x): locks, not planks
uniform vec4 albedo : source_color = vec4(1.0);
uniform bool use_vertex_color = true;         // a lock's own colour (the salon's bake carries it)
uniform float cut : hint_range(0.0, 1.0) = 0.4;        // the coverage a pixel needs to be hair
uniform float soft : hint_range(0.0, 1.0) = 0.5;       // the tips feathered, a card seen edge-on faded
uniform float tips_at : hint_range(0.0, 1.0) = 1.0;    // where the tips are along v (the salon's atlas: the root at 0; three's exporter keeps the UVs and flips the image)
uniform bool hashed = false;                  // the coverage dithered (TAA averages it into soft, see-through strands); else the soft cut
uniform float coverage_gain : hint_range(0.5, 3.0) = 1.0;   // hair_fine's blended coverage, thickened (the brows and lashes)
uniform float density : hint_range(0.5, 2.5) = 1.25;   // the coverage thickened (hashed)
uniform float root_fade : hint_range(0.0, 0.3) = 0.0;  // how far along the strand the roots fade in from the scalp
uniform float edge_fade : hint_range(0.0, 1.0) = 0.6;  // a card seen edge-on fades (the card's own face, not the shell's)
uniform float shine : hint_range(0.0, 3.0) = 1.0;
uniform float spec_gain : hint_range(0.0, 6.0) = 1.0;    // the highlights over the look's shine (the bake's: a soft volume holds more than a flat card)
uniform float spec_cap : hint_range(0.1, 2.0) = 0.35;    // the most a light's highlight adds (a flat card's ring under a strong lamp)
uniform float gloss1 : hint_range(4.0, 400.0) = 120.0;   // the first highlight, tight and white
uniform float gloss2 : hint_range(4.0, 400.0) = 24.0;    // the second, broad and in the hair's colour
uniform float shift1 : hint_range(-0.5, 0.5) = -0.06;    // the highlights shifted apart along the strand
uniform float shift2 : hint_range(-0.5, 0.5) = 0.1;
uniform float shift_noise : hint_range(0.0, 1.0) = 0.4;   // each strand's highlight shifted its own way (a flat card otherwise lights up whole)
uniform vec4 spec_color : source_color = vec4(1.0, 0.97, 0.92, 1.0);
uniform vec4 spec2_color : source_color = vec4(0.0);     // the second highlight's colour (the salon look's); none: the hair's own
uniform float glints : hint_range(0.0, 2.0) = 0.0;       // some strands catch the second highlight brighter
uniform float transmission : hint_range(0.0, 3.0) = 0.0; // a light behind the hair through its outer strands, in the hair's colour
uniform float scatter : hint_range(0.0, 1.0) = 0.0;      // light wandering through the hair: its own colour again, soft (light hair glows, dark hair barely)
uniform float kajiya : hint_range(0.0, 1.0) = 0.0;       // the diffuse by how square the light is to the strand (Kajiya's), over the wrapped one
uniform float occlusion : hint_range(0.0, 1.0) = 0.85;   // how much the baked occlusion darkens
uniform float rim : hint_range(0.0, 1.0) = 0.15;
uniform float wrap : hint_range(0.0, 1.0) = 0.6;         // the diffuse wrapped round (hair is lit through)
uniform float roughness : hint_range(0.0, 1.0) = 0.45;
// the retro look
uniform bool unlit = false;                   // the story's `flat` (`flat` is GLSL's own word)
uniform float flat_gain : hint_range(0.2, 3.0) = 1.0;
uniform float steps : hint_range(0.0, 64.0) = 0.0;      // 0: off
uniform bool dither = false;

varying vec3 v_tangent;                        // along the strand, view space (set in fragment, read in light)
varying vec3 v_shell;                          // the mesh's normal in view space, unturned (the shell is the same seen from either face)
varying vec3 v_strand_dir;                     // the mesh's tangent in view space
varying float v_along;
varying float v_shift;                         // this strand's own shift
varying float v_glint;                         // this strand's glint
varying float v_occ;                           // the occlusion here (1 open)

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

void vertex() {
	v_shell = (MODELVIEW_MATRIX * vec4(NORMAL, 0.0)).xyz;
	v_strand_dir = (MODELVIEW_MATRIX * vec4(TANGENT, 0.0)).xyz;
}

void fragment() {
	vec4 at = texture(texture_albedo, UV);
	vec3 sd = use_strands ? texture(texture_strands, UV).rgb : vec3(0.5, fract(sin(floor(UV.x * 48.0) * 12.9898) * 43758.5453), 0.5);
	vec3 base = at.rgb * albedo.rgb;
	if (use_vertex_color) {
		base *= COLOR.rgb;
	}
	float along = abs(UV.y - (1.0 - tips_at));           // 0 at the root, 1 at the tip
	v_along = along;
	v_shift = (sd.g - 0.5) * shift_noise + (sd.b - 0.5) * shift_noise * 0.6;
	v_glint = pow(fract(sd.g * 7.31 + sd.b * 3.17), 8.0);   // one strand in a few catches the light
	vec3 N = FRONT_FACING ? NORMAL : -NORMAL;
	if (shell_normals) {
		N = normalize(v_shell);                             // the volume's: the same from either face
	}
	NORMAL = N;
	vec3 T;
	if (tangent_along) {
		T = normalize(v_strand_dir);
	} else {                                                 // the tangent along the strand from the card's UVs: dP/dv in view space (the sign doesn't matter to Kajiya-Kay)
		vec3 dpx = dFdx(VERTEX), dpy = dFdy(VERTEX);
		vec2 dux = dFdx(UV), duy = dFdy(UV);
		T = dpx * duy.x - dpy * dux.x;
		float tl = length(T);
		T = tl > 1e-8 ? T / tl : normalize(cross(N, vec3(0.0, 1.0, 0.0)));
	}
	v_tangent = T;
	v_occ = baked_occlusion ? mix(1.0, UV2.y, occlusion) : 1.0;
	vec3 face = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));   // the card's own face (the shell isn't the card)
	float ndv = abs(dot(shell_normals ? face : N, VIEW));
	float fade = 1.0 - soft * smoothstep(0.8, 1.0, along);                  // the tips feather out
	fade *= mix(1.0, smoothstep(0.06, 0.35, ndv), edge_fade * soft);         // a card seen edge-on fades: no spikes in profile
	if (root_fade > 0.0) {
		fade *= smoothstep(0.0, root_fade, along);                            // the roots grow out of the scalp
	}
	if (baked_occlusion && side_fade > 0.0) {
		fade *= smoothstep(0.0, side_fade, 1.0 - abs(UV2.x * 2.0 - 1.0));    // the card's own sides fade: a lock tapers, a plank stops
	}
#ifdef HS_FINE
	ALPHA = clamp(at.a * coverage_gain, 0.0, 1.0) * fade * albedo.a;        // blended at its true coverage (the atlas's mips): a hair narrower than a pixel a faint line, never a black one
#else
	if (hashed) {                                                            // the coverage as a dither: each pixel this frame hair or not by its own threshold, TAA averaging them
		ALPHA = clamp(at.a * density, 0.0, 1.0) * fade * albedo.a;
		float fr = floor(TIME * 60.0);
		vec2 px = FRAGCOORD.xy + fr * vec2(5.588238, 3.6971);
		ALPHA_SCISSOR_THRESHOLD = clamp(fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))), 0.03, 0.97);
	} else {
		ALPHA = smoothstep(cut - 0.15 - 0.25 * soft, cut + 0.15 + 0.1 * soft, at.a) * fade * albedo.a;
		ALPHA_SCISSOR_THRESHOLD = cut * 0.4 * (1.0 - 0.75 * soft);
	}
#endif
	ROUGHNESS = roughness;
	SPECULAR = 0.0;                                                          // the highlights are ours (light())
	AO = v_occ;
	AO_LIGHT_AFFECT = 0.0;
	if (unlit) {
		ALBEDO = vec3(0.0);                                                  // unlit: the strands' own colours, whatever the light
		EMISSION = quantise(base * flat_gain, FRAGCOORD.xy);
	} else {
		ALBEDO = (steps > 0.5 || dither) ? quantise(base, FRAGCOORD.xy) : base;
		EMISSION = vec3(0.0);
	}
	RIM = rim * v_occ;
	RIM_TINT = 0.5;
}

void light() {
	if (!unlit) {                                  // (a light() can't return early)
		vec3 T = normalize(v_tangent);
		float ndl = dot(NORMAL, LIGHT);
		float tl = dot(T, LIGHT);
		float diff = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0) * mix(1.0, sqrt(max(0.0, 1.0 - tl * tl)), kajiya);   // Kajiya's: a strand lit by how square the light is to it
		float vis = smoothstep(-0.25, 0.35, ndl);
		DIFFUSE_LIGHT += diff * v_occ * ATTENUATION * LIGHT_COLOR / PI;
		DIFFUSE_LIGHT += scatter * ALBEDO * clamp(ndl * 0.5 + 0.5, 0.0, 1.0) * v_occ * ATTENUATION * LIGHT_COLOR / PI;   // light wandering through the hair
		vec3 H = normalize(LIGHT + VIEW);
		vec3 T1 = normalize(T + NORMAL * (shift1 + v_shift)), T2 = normalize(T + NORMAL * (shift2 + v_shift));
		float s1 = kk(T1, H, gloss1), s2 = kk(T2, H, gloss2) * (1.0 + glints * (v_glint * 3.0 - 0.3));
		vec3 c2 = spec2_color.a > 0.5 ? spec2_color.rgb * 3.0 : ALBEDO * 1.6;
		vec3 spec = (spec_color.rgb * s1 * 0.6 + c2 * s2 * 0.3) * 0.12 * shine * spec_gain * mix(0.25, 1.0, smoothstep(0.0, 0.3, v_along)) * mix(0.35, 1.0, v_occ);   // the roots and the inner layers in the strands' shade
		SPECULAR_LIGHT += min(spec * vis * ATTENUATION * LIGHT_COLOR / PI, vec3(spec_cap));   // a strong lamp never bleaches a card white (Kajiya-Kay lights a whole flat card whose strands run square to the half vector: the crown's ring)
		float back = pow(clamp(dot(-LIGHT, VIEW), 0.0, 1.0), 5.0) * smoothstep(0.35, -0.25, ndl);   // the light behind the hair, toward the eye
		SPECULAR_LIGHT += ALBEDO * ALBEDO * 8.0 * transmission * back * mix(0.35, 1.0, v_along) * v_occ * ATTENUATION * LIGHT_COLOR / PI;
	}
}
