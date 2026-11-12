// The cloak (docs/GODOT_LOOK.md §5p, DECISIONS 2026-11-12: "a new one that emulates that 'invisibility cloaking'
// effect that the predators in the predators use"): a creature skin that is what's behind her. HSCreatureSkin's look
// `cloak` (creature_skin.gd), a shader of its own because it reads the screen: the picture behind her, bent by her
// own shape as through a body of glass, in a few nested shells each shifted whole (the film's look: copies of the
// background stepping in toward her outline), its colours parted a little at the edges, with ripples that stand
// still in the world, so she swims through them when she moves: standing still she's nearly gone, moving she shows.
//
// It has no light of its own: what it draws is the room behind it, so with the lamps out it's as dark as the room; a
// faint glint (`glint`) lets a lamp catch on her: a lobe of its own in light(), with no brightening toward her
// outline (Godot's own shine rises to a mirror's at a grazing angle: a first cloak was a glass ball with a pale rim)
// and nothing of the sky or the room's reflections on her. `amount` runs from her own paint (0) to the cloak (1) in patches
// that crackle (`spark`) while it turns; `glitch` breaks it up in bands (she's been shot, she's standing in water);
// `motion` (0..1, HSCloak sets it from her speed) makes it bend and ripple more.
//
// Reading the screen puts it in the transparent pass (after everything solid is drawn, which is what it should see):
// it writes its depth so her own parts still sort, never reads a pixel that's in front of her (the depth buffer says),
// and is drawn after the screen was copied, so one cloaked thing doesn't show in another. Two things follow from it:
// what's see-through behind her (a beam in fog, smoke, a window's drops) isn't in that picture, so in fog or a beam
// she shows as a hole, as the film's creature shows in rain; and Godot draws no shadow for it (a depth prepass would,
// and would hide the wall behind her from the picture: tried, a black figure), so a cloaked thing that should still
// cast one gets a shadow-only twin of each mesh (HSCreatureSkin.wear's `shadow`).
shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, diffuse_burley, specular_schlick_ggx;

uniform float amount : hint_range(0.0, 1.0) = 1.0;       // 0 her own paint, 1 cloaked
// ---- what she had (as creature_skin.gdshader takes it)
uniform vec4 albedo : source_color = vec4(1.0);
uniform sampler2D texture_albedo : source_color, hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D texture_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D texture_orm : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool use_orm = false;
uniform float plain_roughness : hint_range(0.0, 1.0) = 0.62;
uniform bool alpha_cut = false;                          // a card of hair: nothing where its picture is see-through
// ---- the cloak
uniform float bend : hint_range(0.0, 0.3) = 0.035;       // how far the picture behind her is shifted at her outline (m, at her distance)
uniform float shells : hint_range(0.0, 12.0) = 5.0;      // the nested shells (0: one smooth lens)
uniform float shell_mix : hint_range(0.0, 1.0) = 0.7;    // how stepped (1 the film's hard shells, 0 smooth glass)
uniform float split : hint_range(0.0, 1.0) = 0.25;       // the colours parted at the edges
uniform float relief : hint_range(0.0, 2.0) = 0.6;       // how much of her skin's own relief bends it
uniform float ripple : hint_range(0.0, 0.05) = 0.004;    // ripples standing in the world (m): she swims through them
uniform float ripple_m : hint_range(0.01, 1.0) = 0.07;   // a ripple's size (m)
uniform float ripple_speed : hint_range(0.0, 4.0) = 0.25;
uniform float motion : hint_range(0.0, 1.0) = 0.0;       // how fast she's moving, 0..1 (HSCloak sets it)
uniform float motion_gain : hint_range(0.0, 8.0) = 2.5;  // moving: the bend and the ripples this much more
uniform float edge_dark : hint_range(0.0, 1.0) = 0.16;   // her outline a little darker than what's behind it
uniform float blur : hint_range(0.0, 5.0) = 0.0;         // the picture through her softened
uniform vec4 tint : source_color = vec4(0.96, 1.0, 0.98, 1.0);
uniform float glint : hint_range(0.0, 1.0) = 0.15;       // how much a lamp catches on her
uniform float glint_roughness : hint_range(0.02, 1.0) = 0.22;
uniform float glint_cap : hint_range(0.0, 4.0) = 0.3;    // the glint's brightest, however strong the lamp
// ---- turning (amount between 0 and 1) and breaking up
uniform float patch_m : hint_range(0.01, 1.0) = 0.09;    // the patches it turns in (m)
uniform vec4 spark : source_color = vec4(0.55, 0.8, 1.0, 1.0);
uniform float spark_amount : hint_range(0.0, 16.0) = 5.0;   // the crackle along the patches' edges
uniform float glitch : hint_range(0.0, 1.0) = 0.0;       // broken up in flickering bands, her paint showing through
uniform bool depth_guard = true;                         // never read a pixel that's in front of her (off: a post in front of her is pulled into her; the check's contrast)

varying float v_cloak;                                   // fragment -> light: how much of the cloak here

uniform sampler2D hs_screen : hint_screen_texture, repeat_disable, filter_linear_mipmap;
uniform sampler2D hs_depth : hint_depth_texture, repeat_disable, filter_nearest;

float hs_hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float hs_noise3(vec3 p) {
	vec3 i = floor(p), f = fract(p);
	vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hs_hash3(i), hs_hash3(i + vec3(1.0, 0.0, 0.0)), u.x), mix(hs_hash3(i + vec3(0.0, 1.0, 0.0)), hs_hash3(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
		mix(mix(hs_hash3(i + vec3(0.0, 0.0, 1.0)), hs_hash3(i + vec3(1.0, 0.0, 1.0)), u.x), mix(hs_hash3(i + vec3(0.0, 1.0, 1.0)), hs_hash3(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

void fragment() {
	vec4 paint = texture(texture_albedo, UV) * albedo;
	if (alpha_cut && paint.a < 0.5) {
		discard;
	}
	vec3 orm = use_orm ? texture(texture_orm, UV).rgb : vec3(1.0);
	vec3 nm = texture(texture_normal, UV).rgb * 2.0 - 1.0;
	vec3 vn = normalize(TANGENT * nm.x * relief + BINORMAL * nm.y * relief + NORMAL * max(nm.z, 0.05));   // her surface, in the view's space
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float dist = max(-VERTEX.z, 0.05);
	float live = 1.0 + motion * motion_gain;

	// ---- how much of the cloak here: all of it at 1, none at 0, between them patches that flicker
	float pn = 0.6 * hs_noise3(wp / patch_m + vec3(0.0, TIME * 0.7, 0.0)) + 0.4 * hs_hash3(floor(wp / (patch_m * 0.6)) + floor(TIME * 14.0) * 3.1);
	float w = 0.07;
	float at = mix(-w, 1.0 + w, amount);
	float c = 1.0 - smoothstep(at - w, at + w, pn);
	float band = step(hs_hash3(vec3(floor(wp.y * 55.0), floor(TIME * 22.0) * 7.3, 1.7)), glitch * 0.85);
	float crackle = pow(4.0 * c * (1.0 - c), 2.5);               // the patches' edges, thin
	c *= 1.0 - band;

	// ---- the picture behind her, bent: by her outline in shells, by the ripples in the world
	float m = length(vn.xy);                                     // 0 facing the eye, 1 at her outline
	float ms = shells > 0.5 ? (floor(m * shells) + 0.5) / shells : m;
	float mag = pow(mix(m, ms, shell_mix), 1.5);
	vec2 dir = m > 1e-4 ? vn.xy / m : vec2(0.0);
	float t = TIME * ripple_speed;
	vec2 rip = vec2(hs_noise3(wp / ripple_m + vec3(0.0, t, 0.0)), hs_noise3(wp / ripple_m + vec3(31.7, -t, 12.3))) - 0.5;
	vec2 off_m = (dir * mag * bend + rip * 2.0 * ripple) * live;     // metres, at her distance
	vec2 off = vec2(off_m.x * abs(PROJECTION_MATRIX[0][0]), -off_m.y * abs(PROJECTION_MATRIX[1][1])) * 0.5 / dist;
	vec2 uv = clamp(SCREEN_UV - off, vec2(0.001), vec2(0.999));
	// never a pixel that's in front of her (a post between her and the eye isn't pulled into her)
	vec4 back = INV_PROJECTION_MATRIX * vec4(uv * 2.0 - 1.0, textureLod(hs_depth, uv, 0.0).r, 1.0);
	if (depth_guard && -back.z / back.w < dist - 0.03) {
		off = vec2(0.0);
		uv = SCREEN_UV;
	}
	float part = split * mag;
	vec2 uv_r = clamp(SCREEN_UV - off * (1.0 + part), vec2(0.001), vec2(0.999));
	vec2 uv_b = clamp(SCREEN_UV - off * (1.0 - part), vec2(0.001), vec2(0.999));
	vec3 behind = vec3(textureLod(hs_screen, uv_r, blur).r, textureLod(hs_screen, uv, blur).g, textureLod(hs_screen, uv_b, blur).b);
	behind *= tint.rgb * (1.0 - edge_dark * m * m);

	// ---- out: her paint where it isn't cloaked, the room behind her where it is
	float flick = 0.5 + 0.5 * hs_hash3(vec3(floor(wp * 90.0).xy, floor(TIME * 30.0)));
	vec3 lit = spark.rgb * spark_amount * (crackle * flick + band * glitch * 0.06 * flick);
	ALBEDO = paint.rgb * (1.0 - c);
	EMISSION = behind * c * EXPOSURE + lit;
	METALLIC = 0.0;
	ROUGHNESS = mix(clamp(plain_roughness * (use_orm ? orm.g * 1.4 : 1.0), 0.05, 1.0), glint_roughness, c);
	SPECULAR = 0.35 * (1.0 - c);                                 // cloaked: nothing of the room's reflections (the lamps' glint is light()'s)
	v_cloak = c;
	AO = mix(orm.r, 1.0, c);
	AO_LIGHT_AFFECT = 0.3;
	NORMAL_MAP = normalize(vec3(nm.xy * mix(1.0, relief, c), max(nm.z, 0.05))) * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 1.0;
}

float hs_ggx(float ndh, float a) { float k = a / (1.0 - ndh * ndh + ndh * ndh * a * a); return k * k / PI; }
float hs_vis(float ndl, float ndv, float a) { return 0.5 / max(mix(2.0 * ndl * ndv, ndl + ndv, a), 1e-4); }

// the lamps: on her paint as on any surface (where she isn't cloaked); on the cloak a small capped glint, the same
// at her outline as facing the eye
void light() {
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0), ndv = clamp(dot(NORMAL, VIEW), 1e-3, 1.0);
	vec3 H = normalize(LIGHT + VIEW);
	float ndh = clamp(dot(NORMAL, H), 0.0, 1.0), f5 = pow(1.0 - clamp(dot(LIGHT, H), 0.0, 1.0), 5.0);
	DIFFUSE_LIGHT += ndl * ATTENUATION * LIGHT_COLOR / PI;        // (the cloak's albedo is black: this lights her paint alone)
	float a = ROUGHNESS * ROUGHNESS;
	float plain = hs_ggx(ndh, a) * hs_vis(ndl, ndv, a) * mix(0.0196, 1.0, f5) * (1.0 - v_cloak);
	SPECULAR_LIGHT += plain * ndl * ATTENUATION * LIGHT_COLOR * SPECULAR_AMOUNT;
	vec3 g = hs_ggx(ndh, a) * hs_vis(ndl, ndv, a) * 0.04 * glint * v_cloak * ndl * ATTENUATION * LIGHT_COLOR * SPECULAR_AMOUNT;
	SPECULAR_LIGHT += g * min(1.0, glint_cap / max(max(g.r, max(g.g, g.b)), 1e-5));   // (capped as it lands: a strong lamp close by never lights her up)
}
