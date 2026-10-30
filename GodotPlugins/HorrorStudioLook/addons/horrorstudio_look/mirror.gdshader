// A mirror (HSMirror, docs/GODOT_LOOK.md): the reflection a second camera rendered into a SubViewport from behind the
// glass, read back at the texel that camera gave this point of the glass (its view-projection, passed in), so the
// parity, the angle and the frame all come out right whatever the mirror's shape. Unshaded: the reflection carries
// its own light, rendered through a linear tone map so the main pass maps it once. `tint` the glass's colour, `gain`
// a lift, `dust` a faint film.
shader_type spatial;
render_mode unshaded, cull_back;

uniform sampler2D mirror_tex : source_color, filter_linear, repeat_disable;
uniform mat4 mirror_vp;
uniform vec4 tint : source_color = vec4(0.93, 0.95, 0.97, 1.0);
uniform float gain = 1.0;
uniform float dust : hint_range(0.0, 1.0) = 0.012;
uniform float flip_v = 1.0;
uniform float active = 1.0;

varying vec3 wpos;

float hs_hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

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
	ALBEDO = mix(seen * tint.rgb, vec3(0.5, 0.5, 0.52), film);
	ALPHA = 1.0;
}
