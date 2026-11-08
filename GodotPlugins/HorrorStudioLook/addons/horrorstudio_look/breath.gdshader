// A puff of breath in the cold (HSBreath; docs/GODOT_LOOK.md §5l): puff.gdshader's soft disc eroded by noise as it
// ages, but lit only by the lights that reach it and added (no ambient: a dark room hides your breath). Breath is water
// droplets, which throw light forward: a lamp behind it (the street lamp outside the window you breathe at) lights it
// up toward the eye (`forward`), while your own flashlight, from beside you, catches it only softly (`wrap`). Faded
// into what's just behind it (a soft particle) and right at the lens (breath against the camera fills nothing). Per
// instance (a MultiMesh with custom data): x its age 0..1, y its seed, z its spin; its colour's alpha the puff's
// strength now.
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, specular_disabled, ambient_light_disabled;   // breath scatters light, it hides nothing: unlit, it isn't there

uniform vec4 color : source_color = vec4(0.94, 0.95, 0.97, 1.0);
uniform float softness = 0.06;        // metres over which a puff fades into geometry behind it
uniform float near_fade = 0.12;       // metres from the lens under which it fades out
uniform float erode = 1.0;
uniform float wrap = 1.8;             // light from any side, softly (a flashlight's spill on the breath beside its core)
uniform float forward = 2.5;          // light from behind it thrown on toward the eye (droplets scatter forward: a lamp behind
                                      // your breath lights it up, your own flashlight from beside you only a little)
uniform sampler2D depth_tex : hint_depth_texture;

varying vec2 vuv;
varying vec4 vcustom;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }

void vertex() {
	vcustom = INSTANCE_CUSTOM;
	float ang = vcustom.y * 6.2831853 + vcustom.x * vcustom.z;
	float c = cos(ang), s = sin(ang);
	VERTEX.xy = mat2(vec2(c, s), vec2(-s, c)) * VERTEX.xy;
	vuv = VERTEX.xy;
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
}

void fragment() {
	float u = vcustom.x, seed = vcustom.y;
	vec2 c = vuv * 2.0;
	float r = length(c);
	if (r > 1.0) { discard; }
	float radial = 1.0 - r * r;
	float n = fbm(vuv * 3.0 + vec2(seed * 37.0, seed * 11.0) + vec2(0.0, -u * 0.6));
	float th = mix(0.42, 0.9, u) * erode;                          // wisps: the noise shapes it more than the disc does
	float a = smoothstep(th - 0.12, th + 0.18, n + radial * 0.22) * radial;
	NORMAL = normalize(vec3(c * 0.8, sqrt(max(0.0, 1.0 - r * r)) + 0.4));   // a soft ball facing the eye: lit round, wrapped
	float depth_raw = texture(depth_tex, SCREEN_UV).r;
	vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, depth_raw);
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view.xyz /= view.w;
	float fade = clamp((-view.z - (-VERTEX.z)) / softness, 0.0, 1.0);
	float lens = smoothstep(near_fade * 0.5, near_fade * 1.5, -VERTEX.z);
	ALBEDO = color.rgb;
	ALPHA = a * COLOR.a * fade * lens;
}


void light() {
	float soft = clamp((dot(NORMAL, LIGHT) + 0.5) / 1.5, 0.0, 1.0);
	float ahead = pow(clamp(dot(-LIGHT, VIEW), 0.0, 1.0), 6.0);
	DIFFUSE_LIGHT += LIGHT_COLOR * ATTENUATION * (soft * wrap + ahead * forward) / 3.14159;
}
