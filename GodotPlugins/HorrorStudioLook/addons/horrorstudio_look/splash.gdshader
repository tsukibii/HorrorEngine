// Rain splashes (HSRain's Splashes child, docs/GODOT_LOOK.md §4): where the streaks land, on the box's floor. A
// MultiMesh of small quads lying flat, each a seat and a phase from its custom data: every cycle a drop lands there,
// a bright point for an instant, then a ring widening and fading (the crown seen from above, the ripple's first
// ring), a few short spikes thrown up round it. Additive, unshaded: it only adds a glint to the wet floor.
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, unshaded;

uniform vec3 box_size = vec3(8.0, 4.0, 8.0);
uniform float radius = 0.06;               // metres: the ring at its widest
uniform float rate = 2.2;                  // landings a second at each seat
uniform vec4 color : source_color = vec4(0.8, 0.86, 0.95, 1.0);
uniform float strength : hint_range(0.0, 1.0) = 0.45;

varying vec2 vuv;
varying float vt;
varying float vk;

void vertex() {
	vec4 c = INSTANCE_CUSTOM;              // xz the seat in the box 0..1, y a phase, w its own pace
	float t = fract(TIME * rate * (0.7 + 0.6 * c.w) + c.y);
	vec3 p = vec3(c.x * box_size.x - box_size.x * 0.5, -box_size.y * 0.5 + 0.004, c.z * box_size.z - box_size.z * 0.5);
	float r = radius * (0.25 + 1.1 * t);
	vec3 pos = p + vec3(VERTEX.x * 2.0 * r, 0.0, VERTEX.y * 2.0 * r);   // the quad laid flat, grown with the ring
	vuv = VERTEX.xy * 2.0;
	vt = t;
	vk = 0.6 + 0.4 * c.w;
	float dcam = length((VIEW_MATRIX * vec4((MODEL_MATRIX * vec4(pos, 1.0)).xyz, 1.0)).xyz);
	vk *= smoothstep(0.2, 0.6, dcam);
	VERTEX = pos;
}

void fragment() {
	float d = length(vuv);                                  // 0 at the seat, 1 at the quad's edge (the ring's radius now)
	float ring = 1.0 - smoothstep(0.0, 0.25, abs(d - 0.8));  // the crown, thin
	float point = (1.0 - smoothstep(0.0, 0.35, d)) * (1.0 - smoothstep(0.0, 0.18, vt));   // the landing's flash
	float ang = atan(vuv.y, vuv.x);
	float spikes = (0.5 + 0.5 * cos(ang * 6.0 + vt * 3.0)) * (1.0 - smoothstep(0.3, 1.0, d)) * smoothstep(0.0, 0.1, vt) * (1.0 - smoothstep(0.1, 0.45, vt));
	float life = (1.0 - smoothstep(0.35, 1.0, vt));          // the ring fades as it widens
	float a = (ring * life * 0.5 + point * 1.4 + spikes * 0.45) * vk * strength;
	ALBEDO = color.rgb * a;
	ALPHA = 1.0;
}
