// A thing's model in the terminal's green (HSOrderTab's slots): its own picture's light read as phosphor, the dark
// lifted so a black thing still reads, its outline lit, the screen's rows across it.
shader_type canvas_item;

uniform vec4 ink : source_color = vec4(0.25, 1.0, 0.45, 1.0);
uniform vec4 hot : source_color = vec4(0.8, 1.0, 0.84, 1.0);
uniform vec4 paper : source_color = vec4(0.0, 0.025, 0.01, 1.0);
uniform float rows = 50.0;
uniform float gain = 2.4;

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	l = pow(clamp(l * gain, 0.0, 1.0), 0.65);
	vec3 g = mix(paper.rgb, ink.rgb, smoothstep(0.02, 0.62, l));
	g = mix(g, hot.rgb, smoothstep(0.62, 1.0, l));
	vec2 px = TEXTURE_PIXEL_SIZE;
	float e = abs(texture(TEXTURE, UV + vec2(px.x, 0.0)).a - c.a) + abs(texture(TEXTURE, UV - vec2(px.x, 0.0)).a - c.a)
			+ abs(texture(TEXTURE, UV + vec2(0.0, px.y)).a - c.a) + abs(texture(TEXTURE, UV - vec2(0.0, px.y)).a - c.a);
	e = clamp(e, 0.0, 1.0);
	g = mix(g, ink.rgb, e * 0.85);
	float s = 0.84 + 0.16 * cos(UV.y * rows * 6.2831853);
	COLOR = vec4(g * s, max(c.a, e));
}
