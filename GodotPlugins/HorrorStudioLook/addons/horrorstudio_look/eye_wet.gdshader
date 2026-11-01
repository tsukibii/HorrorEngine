// The eye's wet layer (HSEye; docs/GODOT_LOOK.md §5h): HumanShaders' eye wetness (vshader_eye_wetness.tres: the
// screen behind a shell over the eye, blurred and darkened toward the lids) and MetaHuman's eye occlusion, worn as
// each eyeball's material_overlay, so the export needs nothing new. HumanShaders reads where the lids are from its
// shell's vertex colours; a Studio export has no shell, so this layer finds the lids itself: around each point of the
// eye it looks at the depth buffer, and wherever something stands in front of the eyeball's own surface (the
// eyeball's shape is known exactly: the white's sphere and the cornea's dome, placed by the eye's centre and axis)
// there's a lid. By the lid's distance: a dark rim against every lid, the upper lid's softer shadow further down the eye
// (the brow and the lid's overhang keep the light off), warm, and next to the lid the eye melts into it (the screen read
// blurrier). It follows the real lids in any pose: the grafted lids or MHR's, a blink, a squint, an eye turned.
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_back, shadows_disabled, fog_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;
uniform float eye_radius = 0.012;     // the eyeball's radius in the mesh's units (metres), from its bounds
uniform float rho = 0.5;              // the eye's shape, as eye.gdshader's: the limbus's radius and plane, the dome
uniform float limbus_plane = 0.866;
uniform float dome_centre = 0.4;
uniform float dome_radius = 0.65;
uniform float handed = -1.0;          // eye.gdshader's: the tangent frame's handedness and the picture's V
uniform float flip_v = 1.0;
uniform float lift = 0.00012;         // the layer this far off the eyeball (metres): over the eye, under the lids (0.4 mm off it), clear of a 24-bit depth's steps a few metres off
uniform float shade = 0.6;            // the rim's shadow against the lids, at the lid (the share of the light taken)
uniform float reach = 1.0;            // how far the rim's shadow reaches into the eye, mm
uniform float top_shade = 0.45;       // the upper lid's shadow down the eye (the brow and the lid's overhang keep the light off)
uniform float reach_up = 2.0;         // how far that reaches: reach × (1 + this) under the upper lid
uniform vec3 shadow_color : source_color = vec3(1.0, 0.84, 0.8);   // the shadow's colour (HumanShaders' ShadowColor): warm, the lids' skin bouncing its light in
uniform float soften = 0.3;           // the lid's edge melted into the eye over this, mm (the screen read blurrier there)
uniform float tolerance = 0.25;       // mm in front of the eyeball's surface before something counts as a lid
uniform int debug = 0;                // 1 the rim's shadow (red) and the upper lid's (green)

varying vec3 v_centre;                // the eyeball's centre in view space: every vertex gives the same one
varying vec3 v_axis;                  // the way it looks, view space

// the eye's centre and axis from each vertex's own frame: the point in eye units from the UV (the layout is the eye's
// front projected flat, as eye.gdshader reads it), its normal as the export made it (the white's sphere, the cornea's
// dome, and on the limbus, where they meet, the two averaged), so the mesh's tangent frame maps the eye's axes into
// the model exactly (worked out per pixel instead, the limbus's crease bent the frame up to 15° and drew a false ring)
void vertex() {
	float fv = flip_v > 0.5 ? -1.0 : 1.0;
	vec2 xy = (UV - 0.5) * 2.0;
	xy.y = xy.y * fv;
	float r = length(xy);
	float zs = sqrt(max(1.0 - r * r, 0.0));
	float zd = dome_centre + sqrt(max(dome_radius * dome_radius - r * r, 0.0));
	bool crease = abs(r - rho) < 0.002;
	bool onC = r < rho && !crease;
	vec3 eP = vec3(xy, onC ? zd : zs);
	vec3 nS = vec3(xy, zs);
	vec3 nD = normalize(vec3(xy, zd - dome_centre));
	vec3 eN = crease ? normalize(nS + nD) : (onC ? nD : nS);
	vec3 eT = vec3(1.0 - eN.x * eN.x, -eN.x * eN.y, -eN.x * eN.z);
	eT = dot(eT, eT) < 1e-8 ? vec3(0.0, 0.0, eN.x > 0.0 ? -1.0 : 1.0) : normalize(eT);
	vec3 eB = cross(eN, eT) * handed;
	mat3 toModel = mat3(TANGENT, BINORMAL, NORMAL) * transpose(mat3(eT, eB, eN));
	v_centre = (MODELVIEW_MATRIX * vec4(VERTEX - eye_radius * (toModel * eP), 1.0)).xyz;
	v_axis = normalize((MODELVIEW_MATRIX * vec4(toModel * vec3(0.0, 0.0, 1.0), 0.0)).xyz);
	VERTEX += NORMAL * lift;
}

// the nearest hit of a ray from the eye (the camera at the origin) on a sphere, or -1
float sphere_hit(vec3 rd, vec3 c, float r) {
	float b = dot(c, rd);
	float h = b * b - (dot(c, c) - r * r);
	return h < 0.0 ? -1.0 : b - sqrt(h);
}

// is there a lid at this view-space point's pixel: the depth buffer there stands in front of the eyeball's surface (the
// white's sphere or the cornea's dome, whichever the view ray meets first), or the eyeball isn't there at all. The
// point is laid out in view space and projected (the projection's own conventions: the screen's flips never matter)
bool lid_at(vec3 q, mat4 proj, mat4 inv_proj, vec3 centre, float R, vec3 dome, float domeR, vec3 axis, float limbus, float tol) {
	vec4 c = proj * vec4(q, 1.0);
	vec2 uv = c.xy / c.w * 0.5 + 0.5;
	vec4 sp = inv_proj * vec4(uv * 2.0 - 1.0, texture(depth_tex, uv).r, 1.0);
	float seen = length(sp.xyz / sp.w);
	vec3 rd = normalize(q);
	float t = sphere_hit(rd, centre, R);
	float td = sphere_hit(rd, dome, domeR);
	if (td > 0.0 && dot(rd * td - centre, axis) >= limbus - 1e-5)
		t = t > 0.0 ? min(t, td) : td;
	return t <= 0.0 || seen < t - tol;
}

void fragment() {
	float sc = length(MODEL_MATRIX[0].xyz);                // the model's scale (the eye grows with it)
	float R = eye_radius * sc;
	vec3 axis = normalize(v_axis);
	vec3 dome = v_centre + axis * (R * dome_centre);
	float domeR = R * dome_radius, limbus = R * limbus_plane, tol = tolerance * 0.001 * sc;
	// the world's up as the screen sees it (the upper lid's side), and a millimetre in pixels here (for the blur)
	vec3 up_v = (VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
	vec2 up = length(up_v.xy) > 1e-4 ? normalize(up_v.xy) : vec2(0.0, 1.0);
	float px_mm = 0.0005 * VIEWPORT_SIZE.y * abs(PROJECTION_MATRIX[1][1]) / max(-VERTEX.z, 0.01);
	// how far the lid is along eight ways out from the point (from the eye, the lid is crossed once: eye, then lid),
	// each found by halving: a distance, so the shade has no steps. The ways up search further (the upper lid's shadow
	// reaches further down the eye than the rim's)
	float nearest = reach_up + 1.0, under = reach_up + 1.0;     // in reaches: the nearest lid any way, the upper lid straight above
	for (int i = 0; i < 8; i++) {
		float a = float(i) * (6.2831853 / 8.0);
		vec2 dir = vec2(cos(a), sin(a));                       // view space: x right, y up
		float upness = dot(dir, up);
		float far = 1.0 + reach_up * max(upness, 0.0);
		vec3 step_v = vec3(dir * (reach * 0.001 * sc * far), 0.0);
		if (!lid_at(VERTEX + step_v, PROJECTION_MATRIX, INV_PROJECTION_MATRIX, v_centre, R, dome, domeR, axis, limbus, tol))
			continue;                                            // no lid within reach this way
		float lo = 0.0, hi = 1.0;
		for (int k = 0; k < 4; k++) {
			float mid = 0.5 * (lo + hi);
			if (lid_at(VERTEX + step_v * mid, PROJECTION_MATRIX, INV_PROJECTION_MATRIX, v_centre, R, dome, domeR, axis, limbus, tol))
				hi = mid;
			else
				lo = mid;
		}
		float d = 0.5 * (lo + hi) * far;                       // the lid's distance, in reaches
		nearest = min(nearest, d);
		if (upness > 0.5)
			under = min(under, d * upness);                      // its height above the point (a slanted lid: the nearest of the three ways up)
	}
	// the rim: dark against every lid, gone a reach in; the upper lid's shadow down the eye, softer, a reach and reach_up
	float rim = 1.0 - smoothstep(0.0, 1.0, nearest);
	float hood = 1.0 - smoothstep(0.0, 1.0 + reach_up, under);
	hood *= hood;
	float dark = 1.0 - (1.0 - shade * rim) * (1.0 - top_shade * hood);
	if (dark <= 0.002 && debug == 0)
		discard;
	float soft = soften * px_mm;
	vec3 sharp = textureLod(screen_tex, SCREEN_UV, 0.0).rgb;
	vec3 blur = textureLod(screen_tex, SCREEN_UV, log2(max(soft, 1.0))).rgb;
	vec3 col = mix(sharp, blur, (1.0 - smoothstep(0.0, soften / max(reach, 1e-3), nearest)) * step(1.0, soft));
	ALBEDO = col * (1.0 - dark) * mix(vec3(1.0), shadow_color, min(dark * 1.6, 1.0));
	if (debug == 1)
		ALBEDO = vec3(rim, hood, 0.0);
	ALPHA = 1.0;
}
