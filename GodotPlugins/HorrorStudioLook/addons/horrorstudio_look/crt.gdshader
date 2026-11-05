// A CRT screen seen close (HSCrt, HSCrtScreen; docs/GODOT_LOOK.md §5i): what a tube television, a monitor or a
// security feed looks like in the game, on the glass's mesh. The phosphors as an aperture grille of red, green and
// blue stripes at their true pitch (0.3 mm on a 14-inch tube) and the beam's scanlines (240 down the raster, a dark
// gap between), both fading out as they shrink under a few pixels on the screen (no moiré at a distance); the
// picture bulged by the glass's curve, the tube's black border past the raster; the bright parts bleeding into a
// soft halo; a mains hum and a slow rolling bar; and the glass itself dark and glossy, carrying the room's lights.
// The picture is a texture (`picture`), or snow made here when there's none. After Sakura Rabbit's 2020 Retro
// Shaders entry (docs/research/sakura_rabbit.md §10). Not the tape (vhs.gdshader), which is what the game is seen
// through: this is what a screen in the game looks like.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform sampler2D picture : source_color, hint_default_black, filter_linear_mipmap, repeat_disable;
uniform bool use_picture = false;                               // off: snow made here
uniform float brightness : hint_range(0.0, 4.0) = 1.0;          // the raster's light; 0 the set off (the glass alone)
uniform vec3 tint : source_color = vec3(1.0, 1.0, 1.0);
uniform vec2 size_mm = vec2(280.0, 210.0);                      // the glass's size: the pitch and the lines at their true size
uniform float pitch_mm : hint_range(0.1, 2.0) = 0.3;            // the triads' pitch (a 14-inch tube 0.3; a 29-inch 0.7)
uniform float scan_lines : hint_range(60.0, 1200.0) = 240.0;    // the beam's lines down the raster (a console's picture; 480 broadcast)
uniform float scan_dark : hint_range(0.0, 1.0) = 0.55;          // how dark the gap between lines
uniform float phosphor : hint_range(0.0, 1.0) = 0.6;            // the stripes' strength
uniform float scale : hint_range(0.5, 4.0) = 1.0;               // 1 true size; more: coarser stripes and lines (a stronger look at the game's resolution)
uniform float curve : hint_range(0.0, 0.3) = 0.08;              // the glass's bulge
uniform float border_mm : hint_range(0.0, 30.0) = 6.0;          // the tube's black band between the raster and the glass's edge
uniform float bleed : hint_range(0.0, 1.0) = 0.35;              // the bright parts' halo
uniform float flicker : hint_range(0.0, 1.0) = 0.5;             // the mains hum
uniform float roll : hint_range(0.0, 1.0) = 0.3;                // a dark bar rolling down the raster
uniform float roll_secs : hint_range(1.0, 30.0) = 7.0;
uniform float fade_px : hint_range(1.0, 8.0) = 3.0;             // stripes and lines gone once their period on the screen is under this many pixels (half gone at twice it)
uniform float glass : hint_range(0.0, 1.0) = 0.5;               // the glass's reflection (its specular)
uniform float roughness : hint_range(0.02, 0.5) = 0.12;
uniform float seed = 1.0;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

// a soft bump round c on a ring of length 1: 1 within w - s of c, 0 past w
float bump(float x, float c, float w, float s) {
	float d = abs(fract(x - c + 0.5) - 0.5);
	return 1.0 - smoothstep(w - s, w, d);
}

// television snow: grains two triads wide and a line tall, a new field thirty times a second, brighter in streaks
// line by line, slow bands drifting down
vec3 snow(vec2 p, float t) {
	vec2 g = vec2(p.x * size_mm.x / (pitch_mm * scale * 2.0), p.y * scan_lines / scale);
	float f = floor(t * 30.0);
	float n = hash13(vec3(floor(g), f + seed));
	float streak = hash12(vec2(floor(g.y / 3.0), f));
	float band = 0.75 + 0.5 * hash12(vec2(floor(p.y * 7.0 + t * 0.6), seed));
	n = n * (0.55 + 0.9 * streak) * band * 0.8;
	return vec3(n * 0.95, n * 0.97, n * 1.05);
}

void fragment() {
	vec2 uv = UV;
	vec2 mm = uv * size_mm;
	// the glass's curve: the raster bulged (the beam on a curved face); the stripes stay on the glass
	vec2 c = uv * 2.0 - 1.0;
	vec2 cd = c * (1.0 + curve * dot(c, c));
	vec2 uvd = cd * 0.5 + 0.5;
	// the raster: inset from the glass's edge by the border, its edge soft over a millimetre; the halo spills 4 mm past it
	vec2 b = border_mm / size_mm;
	vec2 soft = 1.0 / size_mm;
	vec2 e = smoothstep(b - soft, b + soft, uvd) * smoothstep(b - soft, b + soft, 1.0 - uvd);
	float raster = e.x * e.y;
	vec2 hb = (border_mm - 4.0) / size_mm;
	vec2 eh = smoothstep(hb - 4.0 * soft, hb + 4.0 * soft, uvd) * smoothstep(hb - 4.0 * soft, hb + 4.0 * soft, 1.0 - uvd);
	float halo_edge = eh.x * eh.y;
	vec2 puv = clamp((uvd - b) / (1.0 - 2.0 * b), 0.0, 1.0);
	vec3 pic;
	vec3 blur;
	if (use_picture) {
		pic = texture(picture, puv).rgb;
		blur = textureLod(picture, puv, 4.0).rgb;
	} else {
		pic = snow(puv, TIME);
		blur = vec3(0.42, 0.43, 0.46);
	}
	// the scanlines, with the picture; faded as they shrink on the screen (their period in pixels from the derivative)
	float ty = uvd.y * scan_lines / scale;
	float wy = fwidth(ty);
	float visy = 1.0 - smoothstep(0.5 / fade_px, 1.0 / fade_px, wy);
	float line = 1.0 - scan_dark * (0.5 - 0.5 * cos(TAU * ty));
	line = mix(1.0 - 0.5 * scan_dark, line, visy);
	// the phosphors: an aperture grille, a red, a green and a blue stripe each pitch, on the glass; the same fade
	float tx = mm.x / (pitch_mm * scale);
	float wx = fwidth(tx);
	float visx = 1.0 - smoothstep(0.5 / fade_px, 1.0 / fade_px, wx);
	vec3 grille = vec3(bump(tx, 1.0 / 6.0, 0.12, 0.08), bump(tx, 0.5, 0.12, 0.08), bump(tx, 5.0 / 6.0, 0.12, 0.08)) / 0.16;   // a stripe lit over 0.16 of the pitch, black between: its mean 1, the picture's brightness kept
	vec3 mask = mix(vec3(1.0), grille, phosphor * visx);
	// the tube's corners a little dimmer; the mains hum; the bar rolling down
	float vign = 1.0 - 0.18 * dot(c, c);
	float hum = 1.0 + flicker * (0.035 * sin(TIME * 37.0 + seed) + 0.025 * sin(TIME * 113.0));
	float bar = 1.0 - roll * 0.3 * bump(uvd.y - TIME / roll_secs, 0.5, 0.06, 0.05);
	vec3 ras = pic * mask * line * raster * vign;
	vec3 halo = blur * bleed * 0.5 * halo_edge;
	EMISSION = (ras + halo) * 0.5 * brightness * hum * bar * tint;   // at 1 a white picture about a lit white wall's
	ALBEDO = vec3(0.02, 0.02, 0.025);                             // the glass: dark, its gloss carrying the room's lights
	ROUGHNESS = roughness;
	SPECULAR = glass;
	METALLIC = 0.0;
}
