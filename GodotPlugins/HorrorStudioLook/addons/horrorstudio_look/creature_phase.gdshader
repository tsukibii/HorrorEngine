// Phasing out of the world (docs/GODOT_LOOK.md §5s, DECISIONS 2026-11-12, after the seats: "some effect for phasing
// in and out of the reality/world so it's almost like the creature is in the world but disappears, but not super
// abruptly, some kind of horror-ish one"). HSPhase wears it on everything she has (HSCreatureSkin.wear with a look of
// its own, as the cloak) and runs `amount` from 0, herself, to 1, gone:
//   - she comes apart in thin level slices (`band_m` of the world's height each), which jump sideways across the view
//     a few times a second (`tear_m`, `rate`), more of them and further as it goes, a cut between them (`gap`);
//   - her colour drains to a cold near-black (`tone`, `darken`): she turns to her own shadow before she goes;
//   - the slices go one by one, each in threads (`streak_m`) and stuttering in and out before it's gone, lifting a
//     little as it does (`rise_m`): for a moment she's a stack of slices standing in the air;
//   - at 1 nothing of her is drawn.
// `stutter` tears her without taking any of her away (HSPhase.stutter: a glitch in her, and back). She keeps her own
// paint (her albedo, normal and ORM maps) under Godot's own lighting, with no light of her own: in the dark she goes
// unseen, as she should. It's solid where it's drawn (what's gone is cut out, not faded), so it writes its depth,
// sorts as any solid thing and her shadow comes apart with her.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx, world_vertex_coords;

uniform float amount : hint_range(0.0, 1.0) = 0.0;       // 0 herself, 1 gone
uniform float stutter : hint_range(0.0, 1.0) = 0.0;      // torn without going
// ---- what she had (as creature_skin.gdshader takes it)
uniform vec4 albedo : source_color = vec4(1.0);
uniform sampler2D texture_albedo : source_color, hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D texture_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D texture_orm : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool use_orm = false;
uniform float plain_roughness : hint_range(0.0, 1.0) = 0.62;
uniform bool alpha_cut = false;                          // a card of hair: nothing where its picture is see-through
// ---- the phase
uniform float band_m : hint_range(0.005, 0.3) = 0.035;   // a slice's height (m)
uniform float tear_m : hint_range(0.0, 0.5) = 0.07;      // how far a slice jumps sideways (m)
uniform float rate : hint_range(1.0, 30.0) = 12.0;       // jumps a second
uniform float rise_m : hint_range(0.0, 0.3) = 0.05;      // a slice lifts this far as it goes
uniform float gap : hint_range(0.0, 0.6) = 0.14;         // the cut between slices, of a slice's height
uniform float streak_m : hint_range(0.002, 0.2) = 0.012; // the threads a slice goes in (m)
uniform float darken : hint_range(0.0, 1.0) = 0.85;      // how far her colour drains to `tone`
uniform vec4 tone : source_color = vec4(0.02, 0.025, 0.03, 1.0);
uniform float crackle : hint_range(0.0, 1.0) = 0.35;     // fine lines of static across her while she's torn
uniform float seed = 0.0;                                // another figure, another order

varying vec3 v_rest;                                     // where this point was before it was torn (the world's)

float hs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hs_n(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hs_h(i), hs_h(i + vec2(1.0, 0.0)), u.x), mix(hs_h(i + vec2(0.0, 1.0)), hs_h(i + vec2(1.0, 1.0)), u.x), u.y);
}
// when a slice goes, of `amount`: every one gone by 0.98
float hs_goes(float b) { return mix(0.2, 0.78, hs_h(vec2(b * 3.1 + seed, 5.3))); }
float hs_tear() { return clamp(smoothstep(0.0, 0.35, amount) + stutter, 0.0, 1.0); }

void vertex() {
	v_rest = VERTEX;
	float b = floor(VERTEX.y / band_m);
	float tick = floor(TIME * rate);
	float tear = hs_tear();
	float jumps = step(hs_h(vec2(b * 1.7 + seed, tick + 3.0)), 0.2 + 0.8 * tear);      // only some slices at a time
	float j = hs_h(vec2(b + seed, tick)) - 0.5;
	vec3 right = normalize(INV_VIEW_MATRIX[0].xyz);
	VERTEX += right * j * 2.0 * tear_m * tear * jumps;
	float goes = hs_goes(b);
	VERTEX.y += rise_m * smoothstep(goes - 0.3, goes, amount);
}

void fragment() {
	vec4 paint = texture(texture_albedo, UV) * albedo;
	if (alpha_cut && paint.a < 0.5) {
		discard;
	}
	if (amount >= 0.999) {
		discard;
	}
	float tear = hs_tear();
	float b = floor(v_rest.y / band_m);
	if (fract(v_rest.y / band_m) < gap * tear) {                 // the cut between two slices
		discard;
	}
	float goes = hs_goes(b);
	float thread = hs_n(v_rest.xz / streak_m + b * 7.0);
	float flick = hs_h(vec2(b + seed, floor(TIME * rate * 1.3)));
	float gone = amount + ((flick - 0.5) * 0.22 + (thread - 0.5) * 0.18) * step(0.001, amount);
	if (gone > goes) {
		discard;
	}
	vec3 orm = use_orm ? texture(texture_orm, UV).rgb : vec3(1.0);
	float d = darken * smoothstep(0.03, 0.6, amount + 0.4 * stutter);
	float line = 1.0 - crackle * tear * step(0.6, hs_h(vec2(floor(v_rest.y / (band_m * 0.25)), floor(TIME * 30.0))));
	ALBEDO = mix(paint.rgb, tone.rgb, d) * line;
	METALLIC = 0.0;
	ROUGHNESS = mix(clamp(plain_roughness * (use_orm ? orm.g * 1.4 : 1.0), 0.05, 1.0), 0.9, d);
	SPECULAR = 0.35 * (1.0 - d);
	AO = orm.r;
	AO_LIGHT_AFFECT = 0.3;
	NORMAL_MAP = texture(texture_normal, UV).rgb;
	NORMAL_MAP_DEPTH = 1.0 - d;
}
