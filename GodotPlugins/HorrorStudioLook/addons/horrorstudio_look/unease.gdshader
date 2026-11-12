// Unease (docs/GODOT_LOOK.md §5t, DECISIONS 2026-11-12, after the seats: "things that make the player think, am I
// going crazy"): the picture as a mind that's slipping sees it. HSUnease draws it over the game, under the tape and
// the grade; `amount` 0 is nothing at all. Each part its own strength:
//   warp    the edges of the view swim, slowly, and breathe in and out; its middle stays still, so what you look at
//           is steady and what you don't look at isn't
//   doubled a second picture drifting a little off the first, most at the edges: you can't quite focus
//   crawl   something dark growing in from the corners in veins, further the worse it is, never still
//   drain   the colour going out of things
// Nothing in it flashes: every part moves slower than a breath.
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear, repeat_disable;
uniform float amount : hint_range(0.0, 1.0) = 0.0;
uniform float warp : hint_range(0.0, 1.0) = 0.6;
uniform float doubled : hint_range(0.0, 1.0) = 0.5;
uniform float crawl : hint_range(0.0, 1.0) = 0.6;
uniform float drain : hint_range(0.0, 1.0) = 0.4;
uniform float breath : hint_range(0.0, 2.0) = 0.22;      // breaths a second
uniform float clock = 0.0;                               // seconds (HSUnease's own, so a check can hold it still)

float hs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hs_n(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hs_h(i), hs_h(i + vec2(1.0, 0.0)), u.x), mix(hs_h(i + vec2(0.0, 1.0)), hs_h(i + vec2(1.0, 1.0)), u.x), u.y);
}
float hs_fbm(vec2 p) { return 0.5 * hs_n(p) + 0.3 * hs_n(p * 2.1 + 3.7) + 0.2 * hs_n(p * 4.3 + 9.1); }

void fragment() {
	vec2 uv = SCREEN_UV;
	float aspect = SCREEN_PIXEL_SIZE.y / SCREEN_PIXEL_SIZE.x;
	vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
	float r = length(c);
	float edge = smoothstep(0.18, 0.75, r);                        // 0 in the middle of the view, 1 out at its edges
	float t = clock;
	// the edges swim and breathe
	vec2 swim = vec2(hs_n(uv * 3.0 + vec2(t * 0.13, 0.0)), hs_n(uv * 3.0 + vec2(17.0, -t * 0.11))) - 0.5;
	uv += swim * 0.045 * warp * amount * edge;
	uv = 0.5 + (uv - 0.5) * (1.0 - 0.02 * warp * amount * edge * sin(t * breath * 6.2832));
	// a second picture, drifting
	vec2 off = vec2(cos(t * 0.37), sin(t * 0.29) * 0.6) * 0.014 * doubled * amount * (0.25 + 0.75 * edge);
	vec3 col = textureLod(screen_tex, clamp(uv, vec2(0.001), vec2(0.999)), 0.0).rgb;
	vec3 two = textureLod(screen_tex, clamp(uv + off, vec2(0.001), vec2(0.999)), 0.0).rgb;
	col = mix(col, two, 0.42 * clamp(doubled * amount * 2.0, 0.0, 1.0));
	// the colour going
	col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), 0.65 * drain * amount);
	// what grows in from the corners: veins along the way in, creeping
	float ang = atan(c.y, c.x);
	vec2 way = r > 1e-4 ? c / r : vec2(1.0, 0.0);                                               // (the way out from the middle: no seam, as an angle has)
	float vein = 1.0 - abs(2.0 * hs_fbm(way * 2.3 + vec2(r * 3.0 - t * 0.04, 7.0)) - 1.0);    // ridges
	float reach = mix(1.05, 0.42, crawl * amount);                                                // where the dark begins, from the middle
	float dark = smoothstep(reach, reach + 0.28, r + (vein - 0.5) * 0.3 + 0.05 * sin(t * 0.5 + ang * 3.0));
	col *= 1.0 - 0.9 * dark * step(0.001, crawl * amount);
	COLOR = vec4(col, 1.0);
}
