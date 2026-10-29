// Rain splashes (HSRain's Splashes child, docs/GODOT_LOOK.md §4): where the streaks land, on the box's floor. A
// MultiMesh of small quads lying flat, each a seat and a phase from its custom data: every cycle a drop lands there.
// What a real drop shows on a wet floor under a lamp, and nothing drawn (the first version's ring read as a cartoon,
// the user's 2026-10-29 run): a glint the instant it lands, a few tiny droplets thrown out and gone within a third
// of a second, each its own way, and a faint wet sheen where the crown stood. The ripple itself is the wet floor's
// (wet.gdshader bends the reflection in rings). Additive, unshaded: only glints over the wet floor; nothing beyond
// a few metres, where a splash is smaller than a pixel.
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, unshaded;

uniform vec3 box_size = vec3(8.0, 4.0, 8.0);
uniform float radius = 0.045;              // metres: how far the droplets get
uniform float rate = 2.2;                  // landings a second at each seat
uniform vec4 color : source_color = vec4(0.8, 0.86, 0.95, 1.0);
uniform float strength : hint_range(0.0, 1.0) = 0.45;

varying vec2 vuv;
varying float vt;
varying float vk;
varying float vseed;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }

void vertex() {
	vec4 c = INSTANCE_CUSTOM;              // xz the seat in the box 0..1, y a phase, w its own pace and seed
	float t = fract(TIME * rate * (0.7 + 0.6 * c.w) + c.y);
	vec3 p = vec3(c.x * box_size.x - box_size.x * 0.5, -box_size.y * 0.5 + 0.004, c.z * box_size.z - box_size.z * 0.5);
	float r = radius * (0.5 + 0.5 * c.w);
	vec3 pos = p + vec3(VERTEX.x * 2.0 * r, 0.0, VERTEX.y * 2.0 * r);   // the quad laid flat, as wide as the droplets fly
	vuv = VERTEX.xy * 2.0;
	vt = t;
	vseed = c.w * 17.0 + floor(TIME * rate * (0.7 + 0.6 * c.w) + c.y);  // a new throw each landing
	vk = 0.6 + 0.4 * c.w;
	float dcam = length((VIEW_MATRIX * vec4((MODEL_MATRIX * vec4(pos, 1.0)).xyz, 1.0)).xyz);
	vk *= smoothstep(0.2, 0.6, dcam) * (1.0 - smoothstep(5.0, 9.0, dcam));   // not under the eye, not across the room
	VERTEX = pos;
}

void fragment() {
	float d = length(vuv);                                  // 0 at the seat, 1 at the quad's edge
	float a = 0.0;
	// the landing's glint: a point, an instant
	a += (1.0 - smoothstep(0.0, 0.18, d)) * (1.0 - smoothstep(0.0, 0.08, vt)) * 3.0;
	// the wet sheen where the crown stood: faint, soft, a tenth of a second
	a += (1.0 - smoothstep(0.0, 0.3, d)) * smoothstep(0.0, 0.03, vt) * (1.0 - smoothstep(0.05, 0.22, vt)) * 0.35;
	// the droplets: five, thrown their own ways, out and gone by a third of a second
	for (int i = 0; i < 5; i++) {
		float fi = float(i);
		float ang = 6.2832 * (fi + hash11(vseed + fi * 3.1)) / 5.0;
		float reach = 0.35 + 0.6 * hash11(vseed + fi * 7.7);
		float life = 0.14 + 0.16 * hash11(vseed + fi * 5.3);
		float u = vt / life;                                  // 0 at the throw, 1 when it's down
		if (u >= 1.0) continue;
		float fly = sqrt(u);                                  // fast out, slowing (it rises and falls, seen from above)
		vec2 at = vec2(cos(ang), sin(ang)) * reach * fly;
		float dd = length(vuv - at);
		float dot_ = 1.0 - smoothstep(0.0, 0.09 + 0.04 * (1.0 - u), dd);
		a += dot_ * (1.0 - smoothstep(0.5, 1.0, u)) * (1.0 - u * 0.4) * 1.8;
	}
	a *= vk * strength;
	ALBEDO = color.rgb * a;
	ALPHA = 1.0;
}
