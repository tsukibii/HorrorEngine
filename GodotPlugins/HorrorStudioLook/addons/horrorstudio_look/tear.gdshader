// The tear line on a Character Studio export (docs/GODOT_LOOK.md §5f; the Studio's TEARM): a thin wet strip along each
// lower lid, between the lid's rim and the eyeball, that only reflects: added over what's behind it, black itself, so
// it shows as the lights' and the room's glint along the lid, never a white line. Its fade (the vertices' colour: nothing
// at its ends and edges, the most along its middle; the file's material is wholly see-through, glTF having no adding)
// and its strength from the export (`studioTear`). MetaHuman's lacrimal fluid; the eye's wet look with the cornea's coat
// (eye.gdshader).
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, shadows_disabled, specular_schlick_ggx;

uniform float strength = 0.4;         // the Studio's Tear line (0.8 of it)
uniform float gain = 0.2;             // Godot's lamps on it: at the Studio's strength (and at 0.45 of it) it read as a white line along the lid
uniform float roughness = 0.2;        // wet, the glint spread along it (sharper, it sparkled in dots)
// wet eyes (docs/GODOT_LOOK.md §5ab, DECISIONS 2026-11-17, cuter eyes; the Studio's Wet eyes, in the export's
// `studioTear`): the film thicker: the strip stronger and sharper, and it glistens under any lamp that reaches it
// whatever the angle (a meniscus turns through every direction across its width: some of it always faces the light),
// in small glints where the film is uneven, most where it pools at the corners. 0: the line as it always was
uniform float wet : hint_range(0.0, 1.0) = 0.0;
uniform float wet_gain = 3.0;         // how much stronger the strip is at 1
uniform float wet_sheen = 1.0;        // the glisten: the lamp's light given back whatever the angle
uniform float wet_sparkle = 0.75;     // how much of the glisten is broken into glints (0 an even sheen)
uniform float wet_grain = 1800.0;     // the glints' size: cells a metre (1800: about half a millimetre)
uniform float wet_pool = 2.5;         // where the film pools at the corners (the vertices' red under their green: the Studio's Wet eyes): an even blob of light, this many times the glisten

varying vec3 v_at;                    // the point in the model's space (the glints' pattern rides the lid)
varying float v_sheen;                // the glisten here, for light()

void vertex() {
	v_at = VERTEX;
}

float tear_hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float tear_noise(vec3 p) {
	vec3 i = floor(p), f = fract(p);
	vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(tear_hash(i), tear_hash(i + vec3(1.0, 0.0, 0.0)), u.x), mix(tear_hash(i + vec3(0.0, 1.0, 0.0)), tear_hash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
		mix(mix(tear_hash(i + vec3(0.0, 0.0, 1.0)), tear_hash(i + vec3(1.0, 0.0, 1.0)), u.x), mix(tear_hash(i + vec3(0.0, 1.0, 1.0)), tear_hash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

void fragment() {
	float fade = min(max(COLOR.r, COLOR.g), COLOR.a);      // (an export of the first day kept the fade in the alpha; the red may be under the green: a pool)
	float pool = clamp((COLOR.g - COLOR.r) / max(0.5 * COLOR.g, 1e-3), 0.0, 1.0);
	ALBEDO = vec3(0.0);
	ROUGHNESS = mix(roughness, 0.07, wet);
	SPECULAR = 1.0;
	ALPHA = clamp(fade * strength * gain * (1.0 + wet_gain * wet), 0.0, 1.0);
	// the glints: the film's unevenness, drifting slowly (tears move with every blink); the peaks of a smooth noise
	float n = tear_noise(v_at * wet_grain + vec3(0.0, TIME * 0.35, 0.0));
	float glint = mix(1.0, smoothstep(0.55, 0.9, n) * 3.0, wet_sparkle);
	v_sheen = wet * wet_sheen * (glint + wet_pool * pool * pool) * fade;   // (the strip's fade twice over: the glisten soft at its edges; a pool lit evenly: a blob of light where the lids meet)
}

float tear_ggx(float ndh, float a) { float k = a / (1.0 - ndh * ndh + ndh * ndh * a * a); return k * k / PI; }

// the strip's own shine (Godot's GGX, as it always drew it) and, wet, the glisten: each lamp's light given back
// whatever the angle (ALPHA scales both: the strip's fade and strength)
void light() {
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0), ndv = clamp(abs(dot(NORMAL, VIEW)), 1e-3, 1.0);
	vec3 H = normalize(LIGHT + VIEW);
	float ndh = clamp(dot(NORMAL, H), 0.0, 1.0), f5 = pow(1.0 - clamp(dot(LIGHT, H), 0.0, 1.0), 5.0);
	float a = ROUGHNESS * ROUGHNESS;
	float shine = tear_ggx(ndh, a) * 0.5 / max(mix(2.0 * ndl * ndv, ndl + ndv, a), 1e-4) * mix(0.04, 1.0, f5);
	SPECULAR_LIGHT += min(shine * ndl, 4.0) * ATTENUATION * LIGHT_COLOR * SPECULAR_AMOUNT;
	SPECULAR_LIGHT += v_sheen * ATTENUATION * LIGHT_COLOR * SPECULAR_AMOUNT / PI;
}
