// UltraVHS in Godot (UnrealPlugins/UltraVHS/Shaders/Private/UltraVHS.usf, its three passes in one canvas shader over
// the screen, after the tonemapper): the camera (barrel distortion, chromatic aberration, vignette, the sensor's levels
// and saturation, sampled into a small "tape" frame of tape_lines, 4:3), the recording (luma low-passed with the
// deck's edge enhancement, chroma bled wide and shared with the line above, tracking slips, the head-switching band,
// noise, dropouts), the screen (the tape scaled back up, pillarboxed, scanlines). Distances on the tape are in
// "480-line pixels" so a knob means the same at any tape_lines. The same names as the plugin's; Tools/preview.py
// (numpy) is the reference the look check measures this against. No persistence (ghosting needs the last frame).
shader_type canvas_item;
render_mode blend_disabled, unshaded;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear, repeat_disable;
uniform float strength : hint_range(0.0, 1.0) = 1.0;      // 0: the picture as it is; 1: the tape
uniform float tape_lines = 480.0;
uniform bool crop_4x3 = true;
uniform float distortion = 0.085;
uniform float chromatic_aberration = 0.0;
uniform float vignette = 0.08;
uniform float saturation = 0.8;
uniform vec3 black_level = vec3(0.035, 0.027, 0.022);
uniform vec3 white_level = vec3(0.82, 0.81, 0.78);
uniform vec3 night_black = vec3(0.02, 0.03, 0.05);        // night mode: black records as a cool blue
uniform float night : hint_range(0.0, 1.0) = 0.0;
uniform float luma_blur = 1.4;
uniform float sharpen = 1.0;
uniform float sharpen_radius = 3.0;
uniform float chroma_blur = 2.0;
uniform float chroma_shift = 0.0;
uniform float chroma_vertical_blend = 0.5;
uniform float luma_noise = 0.0;
uniform float chroma_noise = 0.0;
uniform float tracking_jitter = 0.0;
uniform float tracking_error = 0.0;
uniform float head_switch = 0.0;
uniform float dropouts = 0.0;
uniform float scanlines = 0.0;
uniform float glitch = 0.0;
uniform int frame = 0;
uniform sampler2D history_tex : filter_linear, repeat_disable;   // the last frame (vhs.gd's history viewport)
uniform float ghosting : hint_range(0.0, 0.95) = 0.0;           // how much of it stays (persistence)
uniform bool has_history = false;

uint hash_u(uint x) {
	x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
	return x;
}
float hash01(uint a, uint b, uint c) { return float(hash_u(a ^ hash_u(b ^ hash_u(c))) >> 8u) * (1.0 / 16777216.0); }
float line_noise(float x, uint row, uint seed) {
	float cell = floor(x);
	float t = x - cell;
	t = t * t * (3.0 - 2.0 * t);
	uint c = uint(cell + 65536.0);
	return mix(hash01(c, row, seed), hash01(c + 1u, row, seed), t);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 rgb_to_yiq(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312))); }
vec3 yiq_to_rgb(vec3 y) { return vec3(y.x + 0.956 * y.y + 0.621 * y.z, y.x - 0.272 * y.y - 0.647 * y.z, y.x - 1.106 * y.y + 1.703 * y.z); }

// a point on the tape (0..1) to where the lens saw it in the view (0..1)
vec2 tape_to_view(vec2 tape_uv, float fringe, vec2 tape_size, float view_aspect) {
	float tape_aspect = tape_size.x / tape_size.y;
	vec2 p = (tape_uv - 0.5) * 2.0 * vec2(tape_aspect, 1.0);
	float r2 = dot(p, p);
	float corner_r2 = tape_aspect * tape_aspect + 1.0;
	float zoom = max(1.0, 1.0 + distortion * corner_r2);
	p *= (1.0 + distortion * r2) / zoom;
	p *= 1.0 + fringe * r2;
	return p / vec2(view_aspect, 1.0) * 0.5 + 0.5;
}
vec3 sample_view(vec2 uv, vec2 px) { return texture(screen_tex, clamp(uv, px * 0.5, 1.0 - px * 0.5)).rgb; }

// 1. the camera: one tape pixel (its centre at tape_px), four taps through the lens
vec3 capture(vec2 tape_px, vec2 tape_size, float view_aspect, vec2 px) {
	vec2 tape_uv = tape_px / tape_size;
	float tape_aspect = tape_size.x / tape_size.y;
	float corner_r2 = tape_aspect * tape_aspect + 1.0;
	float fringe = chromatic_aberration / (240.0 * corner_r2 * sqrt(corner_r2));
	vec2 half_px = 0.25 / tape_size;
	vec3 c = vec3(0.0);
	for (int i = 0; i < 4; i++) {
		vec2 uv = tape_uv + vec2((i & 1) != 0 ? half_px.x : -half_px.x, (i & 2) != 0 ? half_px.y : -half_px.y);
		c.r += sample_view(tape_to_view(uv, fringe, tape_size, view_aspect), px).r;
		c.g += sample_view(tape_to_view(uv, 0.0, tape_size, view_aspect), px).g;
		c.b += sample_view(tape_to_view(uv, -fringe, tape_size, view_aspect), px).b;
	}
	c *= 0.25;
	vec2 p = (tape_uv - 0.5) * 2.0 * vec2(tape_aspect, 1.0);
	float v = 1.0 + vignette * dot(p, p);
	c /= v * v;
	c = mix(vec3(luma(c)), c, saturation);
	vec3 black = mix(black_level, night_black, night);
	return black + (white_level - black) * clamp(c, 0.0, 1.0);
}

void fragment() {
	vec2 px = SCREEN_PIXEL_SIZE;
	vec2 view_size = 1.0 / px;
	float view_aspect = view_size.x / view_size.y;
	float tape_aspect = crop_4x3 ? min(4.0 / 3.0, view_aspect) : view_aspect;
	float lines = clamp(tape_lines, 120.0, 1080.0);
	vec2 tape_size = vec2(round(lines * tape_aspect), lines);
	// 3. the screen: where this pixel is on the tape (pillarboxed)
	vec2 fit = tape_aspect < view_aspect ? vec2(tape_aspect / view_aspect, 1.0) : vec2(1.0, view_aspect / tape_aspect);
	vec2 tape_uv = (SCREEN_UV - 0.5) / fit + 0.5;
	vec3 clean = texture(screen_tex, SCREEN_UV).rgb;
	if (strength <= 0.0) { COLOR = vec4(clean, 1.0); }
	else if (any(lessThan(tape_uv, vec2(0.0))) || any(greaterThan(tape_uv, vec2(1.0)))) { COLOR = vec4(0.0, 0.0, 0.0, 1.0); }
	else {
		// 2. the tape, at this tape pixel
		vec2 pix = tape_uv * tape_size;
		float scale = tape_size.y / 480.0;
		uint row = uint(pix.y);
		uint fi = uint(frame);
		float v = pix.y / tape_size.y;
		float g = clamp(glitch, 0.0, 1.0);
		float jitter = tracking_jitter + g * 3.0;
		float off = (hash01(row, fi, 1u) - 0.5) * jitter;
		off += sin(TIME * 2.3 + v * 4.0) * 0.4 * jitter;
		float track = clamp(tracking_error + g * 0.8, 0.0, 1.0);
		float band_at = fract(TIME * 0.09) * 1.4 - 0.2;
		float band = track * clamp(1.0 - abs(v - band_at) / 0.05, 0.0, 1.0);
		off += band * (hash01(row, fi, 2u) - 0.3) * 28.0;
		float hs = clamp(head_switch + g * 0.5, 0.0, 1.0);
		float from_bottom = (tape_size.y - pix.y) / scale;
		float hs_lines = 5.0 + 5.0 * hs;
		float hs_amount = hs * clamp(1.0 - from_bottom / hs_lines, 0.0, 1.0);
		off += hs_amount * (14.0 + 12.0 * hash01(row, fi, 3u));
		float x = pix.x - off * scale;
		// luma: a soft low-pass with the deck's edge enhancement
		float sigma_l = max(luma_blur, 0.35);
		float sigma_s = max(sharpen_radius, sigma_l + 0.5);
		float yl = 0.0, wl = 0.0, ys = 0.0, ws = 0.0;
		for (int i = -8; i <= 8; i++) {
			float d = float(i);
			float y = luma(capture(vec2(x + d * scale, pix.y), tape_size, view_aspect, px));
			float w1 = exp(-0.5 * d * d / (sigma_l * sigma_l));
			float w2 = exp(-0.5 * d * d / (sigma_s * sigma_s));
			yl += y * w1; wl += w1; ys += y * w2; ws += w2;
		}
		yl /= wl; ys /= ws;
		float yv = yl + sharpen * (yl - ys);
		// chroma: much less bandwidth, a little late, averaged with the line above
		float sigma_c = max(chroma_blur, 0.5);
		float cstep = max(sigma_c * 0.3, 0.5);
		vec2 iq = vec2(0.0);
		float wc = 0.0;
		for (int j = -8; j <= 8; j++) {
			float d = float(j) * cstep;
			float w = exp(-0.5 * d * d / (sigma_c * sigma_c));
			float xc = x + (d - chroma_shift) * scale;
			vec2 a = rgb_to_yiq(capture(vec2(xc, pix.y), tape_size, view_aspect, px)).yz;
			vec2 b = rgb_to_yiq(capture(vec2(xc, pix.y - 1.0), tape_size, view_aspect, px)).yz;
			iq += mix(a, b, chroma_vertical_blend * 0.5) * w;
			wc += w;
		}
		iq /= wc;
		// noise: luma as fine horizontal streaks, chroma as long smears
		float ln = luma_noise + g * 0.35 + band * 0.8 + hs_amount * 0.6;
		float grain = line_noise(x / (1.6 * scale), row, fi * 3u + 11u) - 0.5;
		yv += grain * ln * 0.22;
		float cn = chroma_noise + g * 0.5 + band * 0.5;
		vec2 smear = vec2(line_noise(x / (18.0 * scale), row, fi * 3u + 12u), line_noise(x / (18.0 * scale), row, fi * 3u + 13u)) - 0.5;
		iq += smear * cn * 0.12;
		iq *= 1.0 - g * 0.45;
		// dropouts: a missing bit of oxide, a short white streak
		float drop_chance = dropouts * 0.004 + g * 0.01 + band * 0.04;
		if (hash01(row, fi, 7u) < drop_chance) {
			float start = hash01(row, fi, 8u) * tape_size.x;
			float len = (8.0 + 48.0 * hash01(row, fi, 9u)) * scale;
			float t = (pix.x - start) / len;
			if (t >= 0.0 && t <= 1.0) {
				float fade = 1.0 - t * t;
				yv = mix(yv, 0.85, fade);
				iq *= 1.0 - fade;
			}
		}
		vec3 c = clamp(yiq_to_rgb(vec3(yv, iq)), 0.0, 1.0);
		if (has_history && ghosting > 0.0) {            // persistence: a little of the last frame stays (the camera tube, the deck's comb filter)
			c = mix(c, texture(history_tex, SCREEN_UV).rgb, ghosting);
		}
		float line = tape_uv.y * tape_size.y - 0.5;
		c *= 1.0 - scanlines * (0.5 - 0.5 * cos(line * 6.2831853));
		COLOR = vec4(mix(clean, c, strength), 1.0);
	}
}
