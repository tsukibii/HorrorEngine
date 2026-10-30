// A light shaft as a card (HSShaft, docs/GODOT_LOOK.md §1c): the beam a window throws into a room drawn as
// translucent planes (Light Kit's Window shaft card): two crossed along it for the side views and slices across it
// for the view down the beam, added to the picture: full near the window, fading along the beam and at its sides,
// dust drifting in it as slow clumps in world space, each plane fading as it turns edge-on so together they read
// as one beam from any side. The fades come from the box's own space (`box_size`), not the planes' UVs. Nothing of the renderer's volumetric fog
// (a FogVolume box drew its foot on the floor as a crisp rectangle on the froxel grid and came and went with the
// eye: the user's pictures, 2026-10-30).
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;

uniform vec3 beam_color : source_color = vec3(1.0, 0.96, 0.88);
uniform float density : hint_range(0.0, 1.0) = 0.3;
uniform float dust : hint_range(0.0, 1.0) = 0.5;
uniform float drift = 0.12;
uniform vec3 box_size = vec3(1.0, 1.0, 3.0);   // the beam's box: width, height, reach (the window at +Z/2)
uniform float weight = 1.0;                      // this plane's share of the beam (a slice: one of several)
uniform float soft_near = 0.5;                   // how soft its sides are at the window (of the half width: 0.5 fades from halfway out)
uniform float soft_far = 0.5;                    // and at its end (the penumbra grows with distance)
uniform float tail = 0.3;                        // where along it the end starts fading (0..1)
uniform float floor_y = -100000.0;               // world height the beam stops at (the floor it lands on), softly

varying vec3 v_world;
varying vec3 v_nrm;
varying vec3 v_local;

void vertex() {
	v_local = VERTEX;
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_nrm = normalize(MODEL_NORMAL_MATRIX * NORMAL);   // (the node can shear the box: the window's rectangle swept along the sun)
}

void fragment() {
	float along = clamp((box_size.z * 0.5 - v_local.z) / max(box_size.z, 1e-3), 0.0, 1.0);   // 0 at the window, 1 at the beam's end
	float ax = abs(v_local.x) / max(box_size.x * 0.5, 1e-3);
	float ay = abs(v_local.y) / max(box_size.y * 0.5, 1e-3);
	float ends = smoothstep(0.0, 0.04, along) * (1.0 - smoothstep(tail, 1.0, along));
	float soft = max(mix(soft_near, soft_far, along), 0.02);
	float edge = (1.0 - smoothstep(1.0 - soft, 1.0, ax)) * (1.0 - smoothstep(1.0 - soft, 1.0, ay));
	ends *= smoothstep(floor_y, floor_y + 0.12, v_world.y);                 // landing on the floor, not through it
	vec3 p = v_world * 3.0 + vec3(0.0, -TIME * drift * 3.0, 0.0);
	float motes = 0.5 + 0.5 * sin(p.x * 3.1 + sin(p.y * 2.3 + TIME * 0.2) * 2.0) * sin(p.z * 2.7 + sin(p.x * 1.9 - TIME * 0.15) * 2.0);
	float fine = 0.5 + 0.5 * sin(p.x * 11.0 + TIME * 0.3) * sin(p.y * 13.0 - TIME * 0.2) * sin(p.z * 9.0);
	float clumps = mix(1.0, 0.4 + 1.2 * motes, dust) * mix(1.0, 0.7 + 0.6 * fine, dust * 0.5);
	vec3 V = normalize(CAMERA_POSITION_WORLD - v_world);
	float facing = abs(dot(normalize(v_nrm), V));                           // a plane turning edge-on hands over to the other
	float a = density * ends * edge * clumps * facing * 0.22 * weight;
	ALBEDO = beam_color * a;
	ALPHA = 1.0;
}
