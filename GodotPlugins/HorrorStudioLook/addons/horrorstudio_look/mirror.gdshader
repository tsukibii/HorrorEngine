// A mirror (HSMirror, docs/GODOT_LOOK.md): the reflection a second camera rendered into a SubViewport from behind the
// glass, read back at the texel that camera gave this point of the glass (its view-projection, passed in), so the
// parity, the angle and the frame all come out right whatever the mirror's shape. Unshaded: the reflection carries
// its own light, rendered through a linear tone map so the main pass maps it once. `tint` the glass's colour, `gain`
// a lift, `dust` a faint film. **Steam** (HSMirror.set_steam: docs/GODOT_LOOK.md §5m) fogs it over from its bottom
// edge up, by world height: the reflection a pale blur through it. **Writing** in the steam (HSMirror.write): where a
// finger went the glass stays clear (grease fogs differently), so the words show in the reflection as the steam comes;
// laid on the glass by its own axes (`glass_*`, read the right way round from the front), drips running down from
// them.
shader_type spatial;
render_mode unshaded, cull_back;

uniform sampler2D mirror_tex : source_color, filter_linear, repeat_disable;
uniform mat4 mirror_vp;
uniform vec4 tint : source_color = vec4(0.93, 0.95, 0.97, 1.0);
uniform float gain = 1.0;
uniform float dust : hint_range(0.0, 1.0) = 0.012;
uniform float flip_v = 1.0;
uniform float active = 1.0;
uniform float steam : hint_range(0.0, 1.0) = 0.0;          // fogged over from the bottom (1: all of it)
uniform float steam_bottom = 0.0;                         // the glass's bottom and top, world height
uniform float steam_top = 1.0;
uniform sampler2D writing_tex : filter_linear, repeat_disable;   // white where the finger went
uniform float writing : hint_range(0.0, 1.0) = 0.0;
uniform vec3 glass_centre = vec3(0.0);                    // the glass's middle and its axes as seen from the front (world)
uniform vec3 glass_right = vec3(1.0, 0.0, 0.0);
uniform vec3 glass_up = vec3(0.0, 1.0, 0.0);
uniform vec2 glass_size = vec2(1.0, 1.0);                 // metres
uniform vec4 writing_rect = vec4(0.1, 0.25, 0.8, 0.5);    // where the writing lies on the glass (0..1 from its top left)

varying vec3 wpos;

float hs_hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hs_noise(vec2 p) {
	vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hs_hash12(i), hs_hash12(i + vec2(1.0, 0.0)), u.x), mix(hs_hash12(i + vec2(0.0, 1.0)), hs_hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float hs_fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * hs_noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }

// the writing at a point of the glass (0..1 from its top left), with drips run down from it
float hs_written(vec2 g) {
	vec2 w = (g - writing_rect.xy) / max(writing_rect.zw, vec2(1e-4));
	if (w.x < 0.0 || w.x > 1.0 || w.y < 0.0 || w.y > 1.4) return 0.0;
	float m = w.y <= 1.0 ? texture(writing_tex, w).r : 0.0;
	float lane = floor(w.x * 90.0);                                   // a drip down from some of the strokes
	float len = 0.08 + 0.3 * hs_hash12(vec2(lane, 3.0));
	if (hs_hash12(vec2(lane, 7.0)) > 0.55) {
		for (int k = 1; k <= 6; k++) {
			float up = len * float(k) / 6.0;
			float above = (w.y - up) <= 1.0 && (w.y - up) >= 0.0 ? texture(writing_tex, vec2((lane + 0.5) / 90.0, w.y - up)).r : 0.0;
			m = max(m, above * (1.0 - float(k) / 7.0) * smoothstep(0.012, 0.0, abs(w.x - (lane + 0.5) / 90.0)));
		}
	}
	return m;
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec4 c = mirror_vp * vec4(wpos, 1.0);
	vec2 uv = c.xy / max(c.w, 1e-4) * 0.5 + 0.5;
	if (flip_v > 0.5) uv.y = 1.0 - uv.y;
	vec3 seen = texture(mirror_tex, clamp(uv, 0.0, 1.0)).rgb * gain;
	if (active < 0.5 || c.w <= 0.0) seen = vec3(0.04, 0.045, 0.05);
	float film = (hs_hash12(floor(UV * 160.0)) * 0.5 + hs_hash12(floor(UV * 23.0)) * 0.5) * dust;
	if (steam > 0.0) {
		vec3 d = wpos - glass_centre;
		vec2 g = vec2(dot(d, glass_right) / glass_size.x + 0.5, 0.5 - dot(d, glass_up) / glass_size.y);
		float h = clamp((wpos.y - steam_bottom) / max(steam_top - steam_bottom, 0.01), 0.0, 1.0);
		float line = steam * 1.3 - 0.15;                                 // from the bottom up: all of it by steam 1
		float sm = smoothstep(line + 0.06, line - 0.14, h + (hs_fbm(g * vec2(7.0, 5.0)) - 0.5) * 0.3);
		sm *= 0.85 + 0.15 * hs_fbm(g * 60.0);                             // the beads' grain
		if (writing > 0.0) {
			sm *= 1.0 - clamp(hs_written(g) * writing, 0.0, 1.0) * 0.92;     // the finger's lines stay clear
		}
		vec2 px = vec2(0.024, 0.036);                                     // the reflection through the steam: a wide blur, three rings
		vec3 b = texture(mirror_tex, clamp(uv, 0.0, 1.0)).rgb;
		for (int k = 0; k < 8; k++) {
			float a = float(k) * 0.785398;
			vec2 o = vec2(cos(a), sin(a)) * px;
			vec2 t = vec2(-o.y, o.x);
			b += texture(mirror_tex, clamp(uv + o, 0.0, 1.0)).rgb;
			b += texture(mirror_tex, clamp(uv + o * 2.2 + t * 0.4, 0.0, 1.0)).rgb;
			b += texture(mirror_tex, clamp(uv + o * 3.6 - t * 0.7, 0.0, 1.0)).rgb;
		}
		b = b / 25.0 * gain;
		if (active < 0.5 || c.w <= 0.0) b = vec3(0.04, 0.045, 0.05);
		float lum = dot(b, vec3(0.299, 0.587, 0.114));
		vec3 fog = mix(b, vec3(lum), 0.6) * 0.7 + vec3(0.06, 0.065, 0.07) * (0.3 + lum);   // paler, flatter, whiter
		seen = mix(seen, fog, sm);
	}
	ALBEDO = mix(seen * tint.rgb, vec3(0.5, 0.5, 0.52), film);
	ALPHA = 1.0;
}
