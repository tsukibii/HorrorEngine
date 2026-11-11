// Creature skins (docs/GODOT_LOOK.md §5o, DECISIONS 2026-11-11: "some more weird skin shaders/textures for the monster
// characters that we can apply in godot, e.g. a chrome silver skin, a pearlescent skin, some kind of greasy shader").
// One shader, a look a set of numbers (creature_skin.gd HSCreatureSkin.LOOKS): a metal, a film of colours that turn
// with the angle it's seen at, a coat of gloss in smears with grime in the creases, cracks that can glow, scales, light
// through from behind. It goes on a character's skin in place of the skin shader and keeps what the skin had: its
// own paint (as much as the look leaves of it), its relief, its occlusion. Everything is Godot's own lighting (metal,
// roughness, clear coat, rim, backlight): no light() of its own, so the lamps, the room and the reflections treat it as
// they treat everything else, and in the dark it's as dark as the room.
//
// The patterns (smears, cracks, scales) are drawn in the skin's UVs at their size in metres: a Studio character's skin
// is MHR's layout, the head and hands at one density and the body at another (the region map's alpha says which:
// tools/skin_detail.py), so a crack is as wide on a cheek as on a thigh. They break at the layout's seams (the back of
// the head, the inside of the limbs): a pattern in the skin's own space would want the rest pose per corner.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform float amount : hint_range(0.0, 1.0) = 1.0;        // how much of the look: 0 the skin plain (its paint, matt), 1 the look
// ---- what the skin had
uniform vec4 albedo : source_color = vec4(1.0);
uniform sampler2D texture_albedo : source_color, hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D texture_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D texture_orm : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;   // glTF's: R occlusion, G roughness
uniform bool use_orm = false;
uniform sampler2D texture_regions : hint_default_black, filter_linear, repeat_disable;   // MHR's layout: A the body's islands
uniform bool use_regions = false;
uniform vec2 uv_metres = vec2(0.72, 1.9);                // the metres one UV unit spans: on MHR's head and hands, on its body
uniform vec2 uv_aspect = vec2(1.0, 1.0);                 // a mesh whose UVs aren't square in metres (a ball's: twice as far round as pole to pole)
uniform float plain_roughness : hint_range(0.0, 1.0) = 0.62;
// ---- the look's surface
uniform vec4 tint : source_color = vec4(0.8, 0.8, 0.8, 1.0);
uniform float keep_paint : hint_range(0.0, 1.0) = 0.0;   // how much of the character's own colour stays under the tint (0: the tint alone)
uniform float metallic : hint_range(0.0, 1.0) = 0.0;
uniform float roughness : hint_range(0.0, 1.0) = 0.5;
uniform float specular : hint_range(0.0, 1.0) = 0.5;
uniform float coat : hint_range(0.0, 1.0) = 0.0;         // a clear coat over it (a glaze, a film of grease or slime)
uniform float coat_roughness : hint_range(0.0, 1.0) = 0.1;
uniform float relief : hint_range(0.0, 2.0) = 1.0;       // how much of the skin's own relief (its pores and wrinkles) shows
uniform float rim : hint_range(0.0, 1.0) = 0.0;          // light gathered at the edges
uniform float rim_tint : hint_range(0.0, 1.0) = 0.5;
// ---- a film's colours, turning with the angle it's seen at (a pearl, an oil slick, a beetle)
uniform float irid : hint_range(0.0, 1.0) = 0.0;
uniform float irid_face : hint_range(0.0, 1.0) = 0.25;   // how much of it facing the eye (the rest comes in toward the edges)
uniform float irid_bands : hint_range(0.0, 4.0) = 1.2;   // how many times the colours turn from the middle to the edge
uniform float irid_shift : hint_range(0.0, 1.0) = 0.0;   // where in the colours it starts
uniform float irid_soft : hint_range(0.0, 1.0) = 0.5;    // pastel (1) or full colours (0)
uniform float irid_swirl : hint_range(0.0, 1.0) = 0.2;   // the colours drifting across the skin in slow patches
// ---- smears and grime
uniform float blotch : hint_range(0.0, 1.0) = 0.0;       // the coat in smears: thick and glossy here, thin and dull there
uniform float blotch_m : hint_range(0.005, 0.5) = 0.06;  // a smear's size (m)
uniform float blotch_rough : hint_range(0.0, 1.0) = 0.3; // how much rougher between the smears
uniform vec4 grime : source_color = vec4(0.16, 0.12, 0.07, 1.0);
uniform float grime_amount : hint_range(0.0, 1.0) = 0.0; // dirt: in the creases (the skin's occlusion) and in patches
// ---- cracks
uniform float cracks : hint_range(0.0, 1.0) = 0.0;
uniform float crack_m : hint_range(0.003, 0.3) = 0.035;  // a plate's size between cracks (m)
uniform float crack_width : hint_range(0.005, 0.5) = 0.05;
uniform float crack_cover : hint_range(0.0, 1.0) = 1.0;  // 1 everywhere, less: in patches
uniform vec4 crack_color : source_color = vec4(0.05, 0.04, 0.04, 1.0);
uniform vec4 glow : source_color = vec4(1.0, 0.35, 0.05, 1.0);
uniform float glow_amount : hint_range(0.0, 16.0) = 0.0; // the cracks lit from inside
uniform float glow_pulse : hint_range(0.0, 4.0) = 0.0;   // breathing, times a second
// ---- scales
uniform float scales : hint_range(0.0, 1.0) = 0.0;
uniform float scale_m : hint_range(0.001, 0.1) = 0.007;  // a scale's size (m)
uniform float scale_bump : hint_range(0.0, 2.0) = 0.8;
// ---- light through it
uniform vec4 backlight : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float sss : hint_range(0.0, 1.0) = 0.0;

float hs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hs_hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float hs_noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hs_hash(i), hs_hash(i + vec2(1.0, 0.0)), u.x), mix(hs_hash(i + vec2(0.0, 1.0)), hs_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float hs_fbm(vec2 p) {
	float a = 0.5, s = 0.0;
	for (int i = 0; i < 4; i++) { s += a * hs_noise(p); p = p * 2.03 + vec2(17.3, 5.1); a *= 0.5; }
	return s / 0.9375;
}
// cells: x how far to the nearest cell's edge (0 on it), y the nearest cell's own number, zw from its middle (in cells)
vec4 hs_cells(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	float d1 = 8.0, d2 = 8.0;
	vec2 at = vec2(0.0), id = vec2(0.0);
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 g = vec2(float(x), float(y));
		vec2 o = g + hs_hash2(i + g) * 0.8 + 0.1 - f;
		float d = dot(o, o);
		if (d < d1) { d2 = d1; d1 = d; at = o; id = i + g; } else if (d < d2) { d2 = d; }
	}
	return vec4(sqrt(d2) - sqrt(d1), hs_hash(id), -at);
}
vec3 hs_film(float c) { return 0.5 + 0.5 * cos(6.28318 * (c + vec3(0.0, 0.33, 0.67))); }

void fragment() {
	vec4 paint = texture(texture_albedo, UV) * albedo;
	vec3 orm = use_orm ? texture(texture_orm, UV).rgb : vec3(1.0);
	float ao = orm.r;
	float body = use_regions ? texture(texture_regions, UV).a : 0.0;
	vec2 m = UV * uv_aspect * mix(uv_metres.x, uv_metres.y, body);   // the skin in metres
	float ndv = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
	float edge = pow(1.0 - ndv, 1.5);

	// ---- the look's colour: the tint, over as much of her own paint as the look keeps
	vec3 col = mix(tint.rgb, paint.rgb * tint.rgb, keep_paint);
	float rough = roughness, met = metallic, ct = coat, ct_r = coat_roughness;
	vec3 lit = vec3(0.0);
	vec2 bend = vec2(0.0);                                       // the patterns' own relief, in the UVs' frame

	// smears: the coat thick in patches, the skin duller between them; grime in the creases and in its own patches
	if (blotch > 0.0 || grime_amount > 0.0) {
		float b = hs_fbm(m / blotch_m);
		float smear = smoothstep(0.38, 0.62, b);
		rough = clamp(rough + blotch * blotch_rough * (1.0 - smear), 0.0, 1.0);
		ct *= mix(1.0, mix(0.25, 1.0, smear), blotch);
		ct_r = clamp(ct_r + blotch * 0.25 * (1.0 - smear), 0.0, 1.0);
		float dirt = clamp((1.0 - ao) * 1.6 + smoothstep(0.5, 0.8, hs_fbm(m / (blotch_m * 2.7) + 31.7)) * 0.5, 0.0, 1.0);
		col = mix(col, col * grime.rgb * 2.0, grime_amount * dirt);
		rough = mix(rough, max(rough, 0.7), grime_amount * dirt * 0.6);
	}
	// scales: cells, each its own shade, darker and rougher along its edge, a dome under the light
	if (scales > 0.0) {
		vec4 c = hs_cells(m / scale_m);
		float rim_line = 1.0 - smoothstep(0.0, 0.16, c.x);
		col *= mix(1.0, (0.82 + 0.36 * c.y) * mix(1.0, 0.45, rim_line), scales);
		rough = mix(rough, clamp(rough + 0.35 * rim_line - 0.1 * (1.0 - rim_line), 0.02, 1.0), scales);
		bend += c.zw * scale_bump * scales;
	}
	// cracks: the edges between plates, in patches or everywhere; dark, or lit from inside
	if (cracks > 0.0) {
		vec4 c = hs_cells(m / crack_m);
		float patch = crack_cover >= 1.0 ? 1.0 : smoothstep(1.0 - crack_cover - 0.12, 1.0 - crack_cover + 0.12, hs_fbm(m / (crack_m * 5.0) + 7.9));
		float line = (1.0 - smoothstep(0.0, crack_width, c.x)) * patch * cracks;
		col = mix(col, crack_color.rgb, line);
		rough = mix(rough, 0.95, line);
		met *= 1.0 - line;
		ct *= 1.0 - line;
		float breath = glow_pulse > 0.0 ? 0.65 + 0.35 * sin(TIME * 6.28318 * glow_pulse + c.y * 6.28318) : 1.0;
		lit += glow.rgb * glow_amount * line * breath;
		col *= 1.0 + (c.y - 0.5) * 0.16 * cracks * patch;        // each plate a shade of its own
	}
	// a film's colours: by the angle, drifting in slow patches
	if (irid > 0.0) {
		float drift = irid_swirl > 0.0 ? (hs_fbm(m / 0.18 + 3.1) - 0.5) * irid_swirl : 0.0;
		vec3 film = mix(hs_film(irid_bands * (1.0 - ndv) + irid_shift + drift), vec3(1.0), irid_soft * 0.55);
		col = mix(col, film, irid * mix(irid_face, 1.0, edge));
	}

	// ---- out: the look over the skin plain, by `amount`
	float plain_r = clamp(plain_roughness * (use_orm ? orm.g * 1.4 : 1.0), 0.05, 1.0);
	ALBEDO = mix(paint.rgb, col, amount);
	METALLIC = met * amount;
	ROUGHNESS = mix(plain_r, rough, amount);
	SPECULAR = mix(0.35, specular, amount);
	CLEARCOAT = ct * amount;
	CLEARCOAT_ROUGHNESS = ct_r;
	RIM = rim * amount;
	RIM_TINT = rim_tint;
	EMISSION = lit * amount;
	BACKLIGHT = backlight.rgb * amount;
	SSS_STRENGTH = sss * amount;
	AO = ao;
	AO_LIGHT_AFFECT = 0.3;
	vec3 n = texture(texture_normal, UV).rgb * 2.0 - 1.0;
	float keep = mix(1.0, relief, amount);
	n = normalize(vec3(n.xy * keep + bend * amount, max(n.z, 0.05)));
	NORMAL_MAP = n * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 1.0;
}
