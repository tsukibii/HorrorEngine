// The laptop's glass (HSLaptop puts it on its model's screen surface): the terminal's picture (its SubViewport) shown
// as light, upright whatever its UVs were made as (uv_to_screen, fitted from the screen's own vertices), with a
// phosphor's glow round what's lit, the screen's rows (faded out where they'd be finer than a pixel: no moire), a
// faint flicker and a dimmer edge; dark glass that still shows the room when it's off (power 0), with an anti-glare
// coat (`matte`, a laptop LCD's): a lamp behind you is a soft sheen on it, not a hard spot over the words.
shader_type spatial;
render_mode cull_back;

uniform sampler2D screen_tex : source_color, filter_linear, repeat_disable;
uniform mat3 uv_to_screen = mat3(1.0);
uniform vec2 px = vec2(1024.0, 666.0);      // the picture's pixels
uniform float brightness = 1.7;
uniform float power : hint_range(0.0, 1.0) = 1.0;
uniform float scanlines : hint_range(0.0, 1.0) = 0.22;
uniform float glow : hint_range(0.0, 2.0) = 0.6;
uniform float flicker : hint_range(0.0, 0.2) = 0.02;
uniform float matte : hint_range(0.0, 1.0) = 0.42;      // the anti-glare coat's roughness (0.1: a glossy screen)

vec3 sample_at(vec2 st) {
	return texture(screen_tex, clamp(st, vec2(0.0), vec2(1.0))).rgb;
}

void fragment() {
	vec2 st = (uv_to_screen * vec3(UV, 1.0)).xy;
	vec3 col = vec3(0.0);
	if (power > 0.001 && st.x >= 0.0 && st.x <= 1.0 && st.y >= 0.0 && st.y <= 1.0) {
		vec3 c = sample_at(st);
		vec2 d1 = 1.6 / px;
		vec2 d2 = 4.0 / px;
		vec3 g1 = (sample_at(st + vec2(d1.x, 0.0)) + sample_at(st - vec2(d1.x, 0.0)) + sample_at(st + vec2(0.0, d1.y))
				+ sample_at(st - vec2(0.0, d1.y))) * 0.25;
		vec3 g2 = (sample_at(st + d2) + sample_at(st - d2) + sample_at(st + vec2(d2.x, -d2.y)) + sample_at(st + vec2(-d2.x, d2.y))) * 0.25;
		col = c + glow * (0.6 * g1 + 0.4 * g2) * 0.6;
		float rows = px.y * 0.5;
		float w = fwidth(st.y * rows);                     // how many rows a pixel of the view spans
		float k = scanlines * (1.0 - smoothstep(0.3, 0.75, w));
		col *= 1.0 - k * (0.5 + 0.5 * cos(st.y * rows * 6.2831853));
		vec2 q = st - 0.5;
		col *= 1.0 - 0.55 * dot(q, q);
		col *= 1.0 + flicker * (sin(TIME * 61.0) * 0.6 + sin(TIME * 7.3) * 0.4);
	}
	ALBEDO = vec3(0.01, 0.012, 0.011);
	ROUGHNESS = matte;
	SPECULAR = mix(0.45, 0.3, smoothstep(0.1, 0.5, matte));
	METALLIC = 0.0;
	EMISSION = col * brightness * power;
}
