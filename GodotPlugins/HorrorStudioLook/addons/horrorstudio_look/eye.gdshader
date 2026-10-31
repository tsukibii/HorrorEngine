// The Studio's eye (HSEye; docs/GODOT_LOOK.md §5; tools/shared/eye.js, M_StudioEye in Unreal: the same maths): the
// eyeball's paint baked flat in Epic's layout (the front half projected flat, the iris in the middle) on an export's
// eyeball, with the cornea put back: the iris lies on a plane behind the cornea's dome and is read where the view
// ray, bent at the dome by Snell's law into the eye's fluid, lands on that plane, so it sits behind glass and slides
// against the limbus as the view turns; the cornea's own normal goes to the clear coat (real catchlights); the iris
// under it has no shine of its own; the limbus darker seen from the side. The eye's frame comes from the mesh's own
// tangent space (the export's tangents lie along the eye's +x), as the Unreal material reads it.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform sampler2D paint : source_color, filter_linear_mipmap, repeat_disable;   // the paint baked flat (the glb's base colour)
uniform float rho = 0.5;              // the limbus's radius (the cornea's edge), eye units (the eyeball's radius is 1)
uniform float limbus_plane = 0.866;   // where the cornea meets the white, along the eye's axis
uniform float dome_centre = 0.4;      // the cornea's sphere: its centre along the axis and its radius
uniform float dome_radius = 0.65;
uniform float iris_plane = 0.85;      // the iris's plane, behind the cornea
uniform float ior = 1.336;            // the aqueous humour's (1 bends nothing: the iris painted on the eyeball)
uniform float iris_bright = 1.0;      // the iris lit through the cornea
uniform float limbus_view = 0.5;      // the limbus darker seen from the side
uniform float limbal = 0.5;           // the paint's limbal ring, its width and softness
uniform float limbal_width = 0.18;
uniform float limbal_soft = 0.6;
uniform float handed = -1.0;          // the tangent frame's handedness as Godot's importer leaves it (-1: its binormal runs the other way)
uniform float flip_v = 1.0;           // 1 when the picture's V runs the other way from the layout's (glTF's does)
uniform float roughness = 0.094;      // the white under the cornea
uniform float coat_roughness = 0.036; // the cornea's wet coat
uniform float caustic = 0.6;          // the iris lit as a shallow bowl: its side away from the light glows
uniform float occlusion = 0.0;        // the lids' shadow on the eyeball (MetaHuman's eye occlusion as a falloff): 0 none, 1 full
uniform vec2 opening = vec2(0.8, 0.34);    // the opening's half-width and half-height on the eyeball, eye units (the shadow's ellipse)
uniform float sclera_bright = 1.0;    // the white's paint scaled
uniform float sclera_warm = 0.0;      // the white warmer and pinker toward the corners (MetaHuman's sclera: never a neutral white)
uniform float socket = 0.0;           // the eye in its socket (the Studio's Socket shade, eye.js's maths): the white and its shine darker all over, more toward the brow and the corners, the iris a little
uniform float coat = 0.625;           // the wet coat's strength: the cornea's reflectance (0.025) over Godot's clear coat's (0.04)
uniform float catch_size = 0.08;      // the catchlight's spread (added to the coat's GGX alpha): a lamp's size on the cornea, a small soft dot (a point light's mirror image is a pinpoint the glow blows up)
uniform float catch_cap = 1.5;        // the shine's peak (before the light's colour): a strong lamp never blooms the eye white
uniform int debug = 0;                // 1 q (where the iris is read), 2 the view in the tangent space, 3 the frame's tangent

varying vec3 v_eyeN;                  // the surface's frame in the eye's own units, per vertex
varying float v_onc;
varying vec3 v_bowl;                  // fragment -> light: the iris's bowl normal (view space), for its diffuse alone
varying float v_irisw;                // how much iris this is
varying float v_coat;                 // the wet coat's strength here, and the white's own shine
varying float v_spec;

void vertex() {
}

void fragment() {
	float fv = flip_v > 0.5 ? -1.0 : 1.0;
	vec2 xy = (UV - 0.5) * 2.0;
	xy.y = xy.y * fv;
	float r2 = dot(xy, xy);
	bool onC = r2 < rho * rho;
	float z = onC ? dome_centre + sqrt(max(dome_radius * dome_radius - r2, 0.0)) : sqrt(max(1.0 - r2, 0.0));
	vec3 eP = vec3(xy.x, xy.y, z);
	vec3 eN = onC ? normalize(eP - vec3(0.0, 0.0, dome_centre)) : normalize(eP);
	vec3 eT = vec3(1.0 - eN.x * eN.x, -eN.x * eN.y, -eN.x * eN.z);
	eT = dot(eT, eT) < 1e-8 ? vec3(0.0, 0.0, eN.x > 0.0 ? -1.0 : 1.0) : normalize(eT);
	vec3 eB = cross(eN, eT) * handed;
	// the view (toward the camera) in the surface's tangent space, then in the eye's frame
	vec3 Vt = vec3(dot(VIEW, TANGENT), dot(VIEW, BINORMAL), dot(VIEW, NORMAL));
	vec3 eD = -normalize(Vt.x * eT + Vt.y * eB + Vt.z * eN);
	vec2 q = xy;
	if (onC) {
		vec3 tr = refract(eD, eN, 1.0 / max(ior, 1.0));
		q = xy + tr.xy * max(z - iris_plane, 0.0) / max(-tr.z, 0.08);
	}
	float rq = length(q) / max(rho, 0.0001);
	float irisW = onC ? 1.0 - smoothstep(0.95, 1.08, rq) : 0.0;
	// the colour: the white where the point is (on the cornea, read just outside the limbus: the bake holds the
	// iris there), the iris where the view lands on its plane, darker at its edge seen from the side
	float w = 0.03 + 0.24 * limbal_soft;
	float sl = max(length(xy), 0.0001);
	vec2 s = onC ? xy / sl * max(sl, rho * (1.02 + 0.65 * w)) : xy;
	vec3 white = texture(paint, vec2(0.5 + 0.5 * s.x, 0.5 + 0.5 * s.y * fv)).rgb;
	vec3 iris = texture(paint, vec2(0.5 + 0.5 * q.x, 0.5 + 0.5 * q.y * fv)).rgb;
	float graze = 1.0 - clamp(-eD.z, 0.0, 1.0);
	float extra = clamp(limbal * (1.0 + 1.5 * limbus_view * graze), 0.0, 1.0) - clamp(limbal, 0.0, 1.0);
	iris = mix(iris, vec3(0.003, 0.0021, 0.0021), extra * smoothstep(1.0 - limbal_width - 0.3 * w, 1.0, rq));
	white *= mix(vec3(1.0), vec3(1.0, 0.95, 0.9), sclera_warm / 0.35 * 0.6);   // a warm, slightly yellowed white (MetaHuman's sclera), pinker toward the corners
	white = mix(white, white * vec3(1.0, 0.84, 0.78), sclera_warm * smoothstep(0.3, 0.95, abs(xy.x)));
	ALBEDO = mix(white * sclera_bright, iris, irisW) * mix(1.0, iris_bright, irisW);
	// the lids' shadow: darker toward the opening's edge and most under the upper lid, on the eye's own frame (it
	// turns with the eye: a glance moves it a little), the cornea's reflections shut out there too; the layout's +y
	// runs down the eye (measured on an export: the debug grid)
	float up = -eP.y;
	float oe = length(vec2(eP.x / opening.x, (up - 0.03) / opening.y));
	float occ = clamp(occlusion * (0.75 * smoothstep(0.35, 1.0, oe) + 0.5 * smoothstep(-0.1, 0.9, up / opening.y)), 0.0, 0.85);
	float sock = min(0.92, socket * (0.6 + 0.4 * smoothstep(-0.45, 0.55, up) + 0.3 * smoothstep(0.45, 0.95, abs(eP.x))) * (1.0 - 0.6 * irisW));
	ALBEDO *= (1.0 - occ) * (1.0 - sock);
	if (debug == 1) ALBEDO = vec3(q * 0.5 + 0.5, onC ? 1.0 : 0.0);
	if (debug == 2) ALBEDO = Vt * 0.5 + 0.5;
	if (debug == 3) ALBEDO = TANGENT * 0.5 + 0.5;
	// the iris as a shallow bowl under the cornea (its normal in the eye's frame, back to view space through the tangent
	// frame): its diffuse alone, in light(). The surface keeps its own normal (the white's sphere, the cornea's dome:
	// the mesh's, exactly the eye's shape) for every shine: Godot's clear coat takes NORMAL, and on the bowl the
	// catchlight spread into a flat white ellipse over half the iris
	vec3 eBowl = normalize(mix(eN, normalize(vec3(-q / max(rho, 0.0001) * caustic * 1.4, 1.0)), irisW));
	vec3 bowl_t = vec3(dot(eBowl, eT), dot(eBowl, eB) * handed, dot(eBowl, eN));   // in the surface's tangent space
	v_bowl = normalize(TANGENT * bowl_t.x + BINORMAL * bowl_t.y + NORMAL * bowl_t.z);
	v_irisw = irisW;
	ROUGHNESS = roughness;
	SPECULAR = 0.5 * (1.0 - irisW) * (1.0 - sock);        // under the cornea: no shine of its own; the socket keeps the room off the white
	CLEARCOAT = coat * (1.0 - 0.7 * occ) * (1.0 - sock * (onC ? 0.5 : 1.0));   // the cornea keeps half of it (its catchlight)
	CLEARCOAT_ROUGHNESS = coat_roughness;
	v_coat = CLEARCOAT;
	v_spec = SPECULAR;
	AO = 1.0 - occ;
}

float eye_ggx(float ndh, float a) { float k = a / (1.0 - ndh * ndh + ndh * ndh * a * a); return k * k / PI; }   // Godot's own D and V
float eye_vis(float ndl, float ndv, float a) { return 0.5 / max(mix(2.0 * ndl * ndv, ndl + ndv, a), 1e-4); }

// the lamps (the room's light and reflections stay Godot's, on the surface's own normal): the diffuse on the iris's bowl,
// the cornea's coat and the white's shine on the surface, each a GGX lobe widened by the catchlight's size and capped
void light() {
	vec3 Nd = normalize(mix(NORMAL, v_bowl, v_irisw));
	DIFFUSE_LIGHT += clamp(dot(Nd, LIGHT), 0.0, 1.0) * ATTENUATION * LIGHT_COLOR / PI;
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0), ndv = clamp(dot(NORMAL, VIEW), 1e-3, 1.0);
	vec3 H = normalize(LIGHT + VIEW);
	float ndh = clamp(dot(NORMAL, H), 0.0, 1.0), f5 = pow(1.0 - clamp(dot(LIGHT, H), 0.0, 1.0), 5.0);
	float ac = coat_roughness * coat_roughness + catch_size, ar = roughness * roughness + catch_size;
	float shine = eye_ggx(ndh, ac) * eye_vis(ndl, ndv, ac) * mix(0.04, 1.0, f5) * v_coat
		+ eye_ggx(ndh, ar) * eye_vis(ndl, ndv, ar) * mix(0.16 * v_spec * v_spec, 1.0, f5) * step(0.001, v_spec);
	SPECULAR_LIGHT += min(shine * ndl, catch_cap) * ATTENUATION * LIGHT_COLOR * SPECULAR_AMOUNT;
}
