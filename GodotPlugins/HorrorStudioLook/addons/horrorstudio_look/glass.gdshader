// A window pane (HSGlass; docs/GODOT_LOOK.md §2): clear glass with the room's lights in it, and when it rains, drops
// on it running down: a grid of cells with a drop each sliding down at its own pace, a trail of beads above it, and
// a mist of fine static droplets; each drop a little dome that bends what's seen through the glass (the screen
// behind, read through the drop's normal) and catches the lights. After the "Heartfelt" rain-on-glass idea, kept
// small. `rain` 0 is dry glass. In the cold, `frost` (HSGlass.frost: docs/GODOT_LOOK.md §5l) rises from the pane's
// bottom edge, its coldest part, by its height in the world (`frost_bottom`, `frost_top`): below its ragged line the
// room behind seen as a blur through crystals that take the lights, a mist of condensation above it.
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, diffuse_burley, specular_schlick_ggx, ambient_light_disabled;   // no flat ambient haze on the glass: the lights' own glints only

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform vec4 tint : source_color = vec4(0.94, 0.96, 0.98, 1.0);
uniform float clarity : hint_range(0.0, 1.0) = 0.96;      // how much of the view comes through
uniform float rain : hint_range(0.0, 1.0) = 0.0;          // the downpour on the glass
uniform vec2 size_m = vec2(1.2, 1.1);                     // the pane's size, metres: the drops at their real size
uniform float drop_cm = 2.2;                              // a cell's width, cm
uniform float speed = 1.0;
uniform float bend = 0.02;                                // how far a drop bends the view (screen fraction)
uniform float seed = 1.0;
uniform float frost : hint_range(0.0, 1.0) = 0.0;         // how far up it's frosted (1: three quarters of the way)
uniform float frost_bottom = 0.0;                         // the pane's bottom and top edges, world height
uniform float frost_top = 1.0;
uniform vec4 frost_tint : source_color = vec4(0.9, 0.94, 0.98, 1.0);

varying vec2 v_uv;
varying float v_wy;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

// one layer of running drops: returns the drop's height field gradient (xy) and its coverage (z)
vec3 drops(vec2 p, float t, float layer_seed) {
	vec2 cell = vec2(1.0, 2.0);                            // cells taller than wide: the run
	vec2 q = p / cell;
	vec2 i = floor(q);
	vec3 out_ = vec3(0.0);
	for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
		vec2 c = i + vec2(float(dx), float(dy));
		vec2 h = hash22(c + layer_seed);
		if (h.x > 0.22) continue;                          // a drop in a few cells
		float pace = 0.4 + h.y * 0.8;
		float yy = fract(-t * pace * 0.25 + h.y * 7.0);   // falls: y goes down
		float xx = 0.15 + 0.7 * h.x + 0.08 * sin(yy * 12.0 + h.y * 9.0);   // a wobble on the way down
		vec2 centre = (c + vec2(xx, 1.0 - yy)) * cell;
		vec2 d = (p - centre) / vec2(0.22, 0.3);          // the drop: a tall ellipse
		float r = length(d);
		float dome = 1.0 - smoothstep(0.75, 1.0, r);
		if (dome > 0.0) {
			out_.xy += -d * dome * 1.5;                   // the dome's slope: a normal bending the view toward its edge
			out_.z = max(out_.z, dome);
		}
		// the trail: beads above the drop, smaller as they go up
		for (int k = 1; k <= 4; k++) {
			float fk = float(k);
			vec2 bc = centre + vec2(0.02 * sin(fk * 3.1 + h.x * 20.0), 0.26 * fk * cell.y * 0.5);
			float br = (0.09 - 0.012 * fk) * (0.8 + 0.4 * hash12(c + fk));
			float bd = 1.0 - smoothstep(br * 0.6, br, length((p - bc) * vec2(1.0, 0.8)));
			if (bd > 0.0 && (p.y - centre.y) > 0.0) {
				out_.xy += -(p - bc) / br * bd * 0.8;
				out_.z = max(out_.z, bd * 0.7);
			}
		}
	}
	return out_;
}

void vertex() {
	v_uv = UV;
	v_wy = (MODEL_MATRIX * vec4(VERTEX, 1.0)).y;
}

void fragment() {
	vec2 p = v_uv * size_m * 100.0 / drop_cm;             // cells of drop_cm across the pane
	vec3 g = vec3(0.0);
	if (rain > 0.0) {
		g = drops(p + seed * 13.0, TIME * speed, seed);
		vec3 g2 = drops(p * 1.7 + seed * 29.0, TIME * speed * 0.8, seed + 5.0);
		g += g2 * 0.6;
		// a mist of fine static droplets
		vec2 m = p * 4.0;
		vec2 mi = floor(m);
		vec2 mh = hash22(mi + seed);
		float mr = length(fract(m) - 0.5 - (mh - 0.5) * 0.5) ;
		float mist = (1.0 - smoothstep(0.1, 0.16, mr)) * step(0.75, mh.x) * rain;
		g.z = max(g.z, mist * 0.4);
		g.xy += (fract(m) - 0.5) * mist * 0.12;
		g *= rain;
	}
	// frost: up from the bottom edge to a ragged line, crystals at a centimetre's grain, a mist of condensation above
	float fm = 0.0;
	vec2 ice = vec2(0.0);
	if (frost > 0.0) {
		float h = clamp((v_wy - frost_bottom) / max(frost_top - frost_bottom, 0.01), 0.0, 1.0);
		vec2 cm = v_uv * size_m * 100.0;
		float ragged = fbm(cm * 0.07 + seed * 7.0);       // the line's ins and outs, about 15 cm across
		float grain = fbm(cm * 0.8 + seed * 3.0);         // the crystals
		float line = frost * 0.75 + (ragged - 0.5) * 0.22;
		fm = smoothstep(line + 0.03, line - 0.07, h) * (0.7 + 0.3 * grain);
		fm += smoothstep(line + 0.22, line, h) * 0.3 * (1.0 - fm);
		ice = vec2(fbm(cm * 1.7 + 11.0) - 0.5, fbm(cm * 1.7 + 23.0) - 0.5) * fm;
		g.z = max(g.z, fm);
	}
	vec2 offs = g.xy * bend;
	vec3 seen = texture(screen_tex, clamp(SCREEN_UV + offs, vec2(0.001), vec2(0.999))).rgb;
	if (fm > 0.0) {
		vec3 blurred = textureLod(screen_tex, clamp(SCREEN_UV + ice * 0.01, vec2(0.001), vec2(0.999)), 4.5).rgb;
		seen = mix(seen, blurred * 0.85, fm);                    // through frost the room behind is a blur
	}
	ALBEDO = frost_tint.rgb * fm * 0.6;                    // no diffuse of its own but the frost's: the lights in front whiten it
	EMISSION = seen * tint.rgb * clarity;
	ALPHA = 1.0;
	// the glass takes the lights: clear, a little rougher where the drops lie and rough where it's frosted; the drops'
	// normal and the crystals' for their glints
	NORMAL = normalize(NORMAL + TANGENT * (g.x * 0.6 + ice.x * 1.5) + BINORMAL * (g.y * 0.6 + ice.y * 1.5));
	ROUGHNESS = mix(mix(0.04, 0.12, g.z), 0.45, fm);
	SPECULAR = 0.5;
	METALLIC = 0.0;
}
