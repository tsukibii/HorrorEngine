// The grade (HSPost, docs/GODOT_LOOK.md §1d): a film-style colour grade over the finished picture, under the HUD and
// over the tape: a three-way corrector (lift the shadows, gamma the mids, gain the highlights, each a colour),
// warmth, saturation, contrast, a film fade (lifted blacks), a vignette, fine grain, a touch of chromatic aberration
// at the edges; `amount` mixes it with the plain picture. The screen comes in tonemapped: the grade works on what
// the eye would see, as a LUT on a finished film does.
shader_type canvas_item;
render_mode blend_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear;
uniform float amount : hint_range(0.0, 1.0) = 1.0;
uniform vec3 lift = vec3(0.0, 0.0, 0.0);
uniform vec3 gamma_ = vec3(1.0, 1.0, 1.0);
uniform vec3 gain = vec3(1.0, 1.0, 1.0);
uniform float warmth : hint_range(-1.0, 1.0) = 0.0;
uniform float saturation : hint_range(0.0, 2.0) = 1.0;
uniform float contrast : hint_range(0.5, 2.0) = 1.0;
uniform float fade : hint_range(0.0, 0.3) = 0.0;
uniform float vignette : hint_range(0.0, 1.0) = 0.0;
uniform float vignette_soft : hint_range(0.1, 1.0) = 0.55;
uniform float grain : hint_range(0.0, 1.0) = 0.0;
uniform float grain_cap : hint_range(0.0, 1.0) = 1.0;   // the menu's Film grain
uniform float aberration : hint_range(0.0, 4.0) = 0.0;  // pixels at the picture's edge
uniform float seed = 0.0;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 px = SCREEN_PIXEL_SIZE;
	vec2 d = uv - 0.5;
	float r = length(d) * 1.4142;
	vec3 c;
	if (aberration > 0.0) {                                   // the channels pulled apart along the radius, more toward the edge
		vec2 off = d * r * r * aberration * px * 2.0;
		c = vec3(texture(screen_tex, uv + off).r, texture(screen_tex, uv).g, texture(screen_tex, uv - off).b);
	} else {
		c = texture(screen_tex, uv).rgb;
	}
	vec3 o = c;
	c = clamp(c * gain + lift * (1.0 - c), 0.0, 1.0);          // the three-way: lift the shadows, gain the highlights
	c = pow(c, 1.0 / max(gamma_, vec3(0.05)));                  // gamma the mids
	c *= vec3(1.0 + 0.12 * warmth, 1.0 + 0.02 * warmth, 1.0 - 0.14 * warmth);
	float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
	c = mix(vec3(l), c, saturation);
	c = (c - 0.5) * contrast + 0.5;
	c = c * (1.0 - fade) + fade * vec3(0.09, 0.09, 0.1);       // a film fade: the blacks lifted a little toward grey-blue
	c *= 1.0 - vignette * smoothstep(1.0 - vignette_soft, 1.0 + 0.25, r);
	float g = (hash12(uv * (1.0 / px) * 0.5 + vec2(seed * 7.3, seed * 3.1)) - 0.5) * grain * grain_cap * 0.09;
	c += g * (1.0 - 0.6 * l);                                   // finer in the lights, as film's
	c = clamp(c, 0.0, 1.0);
	COLOR = vec4(mix(o, c, amount), 1.0);
}
