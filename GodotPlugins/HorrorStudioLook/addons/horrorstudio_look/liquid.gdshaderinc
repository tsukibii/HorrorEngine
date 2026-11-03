// Liquid in a container (liquid.gd, nodes/liquid_fill.gd; docs/PROPGEN.md §10): the container's inside as a closed
// mesh, cut at a level kept flat in the world (tilted by the slosh) and its back faces, seen through the cut, drawn
// as the surface. The level comes from the fill table the prop generator made from the inside's own shape (a height
// over the container's base for each tilt and fill), so a tipped bottle keeps its volume. After Valve's bottles in
// Half-Life: Alyx (a plane held level in world space, a spring for the slosh, nothing simulated inside).

uniform vec4 liquid_color : source_color = vec4(0.11, 0.03, 0.012, 1.0);   // the body, through the side
uniform vec4 surface_color : source_color = vec4(0.2, 0.07, 0.03, 1.0);    // the top, seen from above
uniform vec4 foam_color : source_color = vec4(0.35, 0.16, 0.07, 1.0);      // where the top meets the wall
uniform float foam_width = 0.0012;                                           // metres
uniform float fill : hint_range(0.0, 1.0) = 0.6;
uniform float clarity : hint_range(0.0, 1.0) = 0.0;                          // 0 opaque (soy), 1 clear (water)
uniform sampler2D fill_table : filter_linear, repeat_disable;               // R: the level (0-1 of h_min..h_max) by fill (u) and tilt (v)
uniform vec2 table_size = vec2(33.0, 24.0);                                 // its columns (fills) and rows (tilts)
uniform float h_min = 0.0;
uniform float h_max = 0.2;
uniform vec3 axis_local = vec3(0.0, 1.0, 0.0);                              // the container's axis, the mesh's space
uniform vec3 origin_local = vec3(0.0);                                       // its base's middle, the mesh's space
instance uniform vec2 wobble = vec2(0.0);                                    // the slosh: the level's slope along world x and z

varying vec3 rel;        // the world position against the container's base, world axes
varying float tilt;      // the container against the world's up (0 upright, PI upside down)

void vertex() {
	vec3 o = (MODEL_MATRIX * vec4(origin_local, 1.0)).xyz;
	rel = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz - o;
	vec3 ax = normalize(mat3(MODEL_MATRIX) * axis_local);
	tilt = acos(clamp(ax.y, -1.0, 1.0));
}

float liquid_level() {
	vec2 uv = (vec2(fill, tilt / PI) * (table_size - 1.0) + 0.5) / table_size;
	return mix(h_min, h_max, texture(fill_table, uv).r);
}

// below the level: the body (with its foam line) on the front faces, the lit surface on the back faces
void liquid_fragment(bool front, mat4 view, out vec3 albedo, out vec3 normal_view, out float rough, out float alpha, out bool cut) {
	float d = rel.y - (liquid_level() + wobble.x * rel.x + wobble.y * rel.z);
	cut = d > 0.0;
	if (front) {
		float foam = smoothstep(-foam_width, 0.0, d);
		albedo = mix(liquid_color.rgb, foam_color.rgb, foam);
		rough = 0.12;
		alpha = mix(1.0, 0.35, clarity) + foam * 0.4;
		normal_view = vec3(0.0);
	} else {
		albedo = surface_color.rgb;
		normal_view = normalize((view * vec4(normalize(vec3(-wobble.x, 1.0, -wobble.y)), 0.0)).xyz);
		rough = 0.05;
		alpha = mix(1.0, 0.55, clarity);
	}
}
