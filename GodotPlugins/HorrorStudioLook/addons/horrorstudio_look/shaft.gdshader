// A light shaft (HSShaft, docs/GODOT_LOOK.md §1c): the beam a window throws into a room, with dust drifting in it.
// A fog shader on a FogVolume box laid along the beam: the volumetric haze thicker inside it (the window's light,
// with the frame's shadow, lights the haze), full near the window and fading along the beam and at its sides, and
// the dust as slow clumps in world space (Light Kit's shaft card's motes, the same sin product). Nothing drawn: the
// renderer's own fog carries the light. Needs the look's haze on (volumetric fog; Effects Low turns it off).
shader_type fog;

uniform float density = 0.5;        // the beam's thickness over the room's haze
uniform float dust : hint_range(0.0, 1.0) = 0.5;
uniform float drift = 0.12;         // the dust's crawl (world metres a second, roughly)

void fog() {
	float along = 1.0 - UVW.z;                                               // 0 at the window, 1 at the beam's end
	float ends = smoothstep(0.0, 0.08, along) * (1.0 - smoothstep(0.45, 1.0, along));
	vec2 side = abs(UVW.xy - 0.5) * 2.0;
	float edge = (1.0 - smoothstep(0.6, 1.0, side.x)) * (1.0 - smoothstep(0.6, 1.0, side.y));
	vec3 p = WORLD_POSITION * 3.0 + vec3(0.0, -TIME * drift * 3.0, 0.0);  // the dust sinks slowly, and turns
	float motes = 0.5 + 0.5 * sin(p.x * 3.1 + sin(p.y * 2.3 + TIME * 0.2) * 2.0) * sin(p.z * 2.7 + sin(p.x * 1.9 - TIME * 0.15) * 2.0);
	float fine = 0.5 + 0.5 * sin(p.x * 11.0 + TIME * 0.3) * sin(p.y * 13.0 - TIME * 0.2) * sin(p.z * 9.0);
	float clumps = mix(1.0, 0.4 + 1.2 * motes, dust) * mix(1.0, 0.7 + 0.6 * fine, dust * 0.5);
	DENSITY = density * ends * edge * clumps;
	ALBEDO = vec3(1.0);
}
