/*
Wet skin (HSSkin, docs/GODOT_LOOK.md): HumanShaders' skin shader (MIT, MatMADNESS, built on RustyRoboticsBV's
GodotStandardLightShader; GodotPlugins/HumanShaders/UPSTREAM.md) with a wetness layer on top: `wetness` a sweat film
(a sheen everywhere, the skin a touch darker), `sweat` beads standing on the skin (little domes, each a glint,
roughness near zero on them), `drips` runs down the skin, `oil` oiled up (a smooth gloss over all of it, the colour
deeper); the skin's detail at its true size (§5d) and its depth (§5g: light that has travelled under the skin, warm in
the creases round the eyes, the nose, the mouth and the ears, whatever lights it). Everything of the original stays:
its uniforms, its light(). The lines marked HS are ours.
*/


shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx, sss_mode_skin;

group_uniforms albedo;
uniform vec4 albedo : source_color = vec4(1.);
uniform sampler2D texture_albedo : source_color, filter_linear_mipmap, repeat_enable;

group_uniforms roughness;
uniform float roughness : hint_range(0.0, 1.0) = 0.4;
uniform float specular : hint_range(0.0, 1.0, 0.01) = 0.5;
uniform bool double_specularity = true;

uniform sampler2D texture_roughness : hint_roughness_r, filter_linear_mipmap, repeat_enable;

group_uniforms metallic;
uniform float metallic : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_metallic : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec4 metallic_texture_channel;

group_uniforms normal;
uniform sampler2D texture_normal : hint_roughness_normal, filter_linear_mipmap, repeat_enable;
uniform float normal_strength : hint_range(-16.0, 16.0) = 1.0;
uniform bool normal_gl = false;          // HS: the map in glTF's convention (+Y up the picture: the Studio's bake), not HumanShaders' DirectX ones
uniform bool normal_has_ao = true;       // HS: HumanShaders packs an occlusion into the normal map's blue; a plain normal map hasn't one

group_uniforms micro_detail;
uniform bool use_micro_detail = false;
uniform float micro_detail_scale : hint_range(0.0, 200.0) = 25.0;
uniform float micro_normal_strength : hint_range(-1.0, 1.0) = 0.3;
uniform float micro_ao_strength : hint_range(-1.0, 1.0) = 0.4;
uniform sampler2D texture_micro_detail : hint_roughness_normal, filter_linear_mipmap_anisotropic, repeat_enable;
//uniform float soften_normal : hint_range(0.0, 1.0);

group_uniforms ambient_occlusion;
uniform bool use_ambient_occlusion = false;
uniform sampler2D ambient_occlusion_texture : hint_roughness_normal, filter_linear_mipmap, repeat_enable;
uniform float ao_strength : hint_range(0.0, 2.0) = 0.5;
uniform float ao_block_light : hint_range(0.0, 2.0) = 0.5;

group_uniforms subsurface_scattering;
uniform bool use_subsurface_scattering = true;
uniform bool use_noise = true;
uniform float subsurface_scattering_strength : hint_range(0.0, 1.0, 0.01) = 0.4;
uniform float skin_smoothness : hint_range(0.0, 10.0) = 5.0;
uniform float skin_fallof_smoothness : hint_range(0.7, 2.0, 0.01) = 1.0;
uniform bool tinted_shadow_penumbra = false;
uniform bool old_lightwarp_fallof = false;
uniform sampler2D lightwarp : source_color, filter_linear, repeat_disable;
uniform sampler2D texture_sss_noise : filter_linear, repeat_enable, source_color;
uniform float sss_scale : hint_range(0.0, 1.0) = 1.0;     // HS: the screen-space scattering's strength scaled (Godot blurs the whole colour, the paint too: a little softens the light, a lot is wax)


group_uniforms translucency;
uniform bool translucency = false;
uniform float translucency_strength : hint_range(0.0, 2.0, 0.01) = 0.75;
uniform sampler2D texture_translucency : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform sampler2D texture_translucency_color : source_color, filter_linear, repeat_disable;

group_uniforms u_v;
uniform vec3 uv1_scale = vec3(1.);
uniform vec3 uv1_offset = vec3(0.);
uniform vec3 uv2_scale = vec3(1.);
uniform vec3 uv2_offset = vec3(0.);

group_uniforms wet_skin;   // HS
uniform float wetness : hint_range(0.0, 1.0) = 0.0;       // HS: the sweat film
uniform float sweat : hint_range(0.0, 1.0) = 0.0;         // HS: beads on the skin
uniform float sweat_scale = 160.0;                        // HS: beads per UV unit
uniform float sweat_size : hint_range(0.0, 1.0) = 0.5;    // HS: a bead's size in its cell
uniform float drips : hint_range(0.0, 1.0) = 0.0;         // HS: runs down the skin (down the UV's v)
uniform float oil : hint_range(0.0, 1.0) = 0.0;           // HS: oiled up
uniform float oil_roughness : hint_range(0.0, 1.0) = 0.14;  // HS

group_uniforms skin_detail;   // HS: the skin's detail at its true size (tools/skin_detail.py; docs/GODOT_LOOK.md §5d)
uniform float detail : hint_range(0.0, 2.0) = 0.0;                // HS: the whole layer (0 off: the demo's spheres, a plain body)
uniform sampler2D texture_pores : filter_linear_mipmap_anisotropic, repeat_enable;        // HS: 10 mm of skin: RG its normal (OpenGL's), B how open
uniform sampler2D texture_skin_micro : filter_linear_mipmap_anisotropic, repeat_enable;   // HS: 5 mm: the furrows' network
uniform sampler2D texture_regions : filter_linear, repeat_disable;                        // HS: MHR's layout: R pores, G furrows, B lips, A the body's islands
uniform sampler2D texture_tone : filter_linear_mipmap_anisotropic, repeat_enable;         // HS: 40 mm of the colour's unevenness: R melanin, G blood, B grain
uniform bool use_regions = false;                                 // HS: the skin is MHR's (a Studio export): the region map places it; else the same everywhere
uniform float detail_metres = 0.01;                               // HS: the pores' tile on the skin (the furrows' is half)
uniform vec2 uv_metres = vec2(0.72, 1.9);                         // HS: the metres one UV unit spans on MHR's head and hands, and on its body
uniform float pore_depth : hint_range(0.0, 3.0) = 1.0;            // HS: the pores' relief
uniform float pore_size : hint_range(0.5, 2.0) = 1.0;             // HS: their size (the tile laid larger)
uniform float furrow_depth : hint_range(0.0, 3.0) = 1.0;          // HS: the furrows' relief (the lids' crepe, age's lines)
uniform float detail_cavity : hint_range(0.0, 1.0) = 0.5;         // HS: how much a pit or a furrow darkens and dulls
uniform float lip_lines : hint_range(0.0, 3.0) = 1.0;             // HS: the lips' fine lines, about a millimetre apart
uniform float detail_rough : hint_range(0.0, 0.5) = 0.08;         // HS: the roughness the relief turns into once it's too fine to see
uniform float fuzz : hint_range(0.0, 1.0) = 0.0;                  // HS: peach fuzz: a soft bright rim where the skin turns away
uniform float tone : hint_range(0.0, 3.0) = 1.0;                  // HS: how uneven the colour is (melanin's specks and blotches, a grain; 0 the paint as baked)
uniform float tone_red : hint_range(0.0, 3.0) = 1.0;              // HS: the blood's redder and paler patches

group_uniforms skin_depth;   // HS: light that has travelled under the skin (docs/GODOT_LOOK.md §5g): what lights the skin, a baked level's probes or a lamp, comes out of it warm where it has gone furthest in: the creases round the eyes, the nose, the mouth and the ears
uniform float skin_depth : hint_range(0.0, 3.0) = 0.0;            // HS: the whole layer (0 off: the demo's spheres, a plain body)
uniform sampler2D texture_depth : hint_default_black, filter_linear_mipmap, repeat_disable;   // HS: MHR's layout (tools/skin_detail.py depth): R round the eyes, G the nose, B the ears, A the mouth, each the region times how deep a crease
uniform float depth_eyes : hint_range(0.0, 2.0) = 1.0;            // HS: each region's share
uniform float depth_nose : hint_range(0.0, 2.0) = 1.0;
uniform float depth_mouth : hint_range(0.0, 2.0) = 0.6;
uniform bool depth_ears_on = true;                                // HS: the ears' glow: off for a character whose hair covers them (the lamps' light through them goes too)
uniform float depth_ears : hint_range(0.0, 2.0) = 1.0;
uniform float depth_rest : hint_range(0.0, 1.0) = 0.0;            // HS: the occlusion's creases everywhere else warmed too (0: the core alone)
uniform vec3 depth_color : source_color = vec3(0.86, 0.33, 0.24); // HS: the colour light takes on under the skin (the blood's)
uniform float depth_warmth : hint_range(0.0, 2.0) = 1.0;          // HS: how far the regions' colour turns toward it
uniform float depth_creases : hint_range(0.0, 2.0) = 1.0;         // HS: the export's occlusion there red, not grey (the red goes furthest under the skin)
uniform float depth_glow : hint_range(0.0, 2.0) = 1.0;            // HS: thin skin (the export's thinness: an ear's rim, the nostrils) lit through by the room's light
uniform float depth_pores : hint_range(0.0, 1.0) = 1.0;           // HS: the detail layer's pits and furrows shaded warm, not grey (everywhere)

varying float hs_gloss;   // HS: the wet layer's gloss for light(): 0 dry skin, 1 water or oil
varying vec3 hs_lamp;     // HS: the depth layer's colour for the lamps' diffuse against the ambient's, its warmth aside (§5g)
varying vec3 hs_warm;     // HS: the depth layer's warmth here (light() gives a lamp's light all of it where the lamp barely reaches)
varying vec3 hs_dn;       // HS: the detail's tilt of the normal (view space), for the diffuse's blurred normals
varying float hs_fuzz;    // HS: the fuzz here (none on the lips)
varying mat3 TBN;
varying vec4 micro_detail;
varying vec3 final_albedo;
varying float final_metallic;
varying float ao;
varying float linear_depth;
varying float smooth_depth;
varying float sss_tex;

void vertex() {
	UV = UV * uv1_scale.xy + uv1_offset.xy;
	// Detail UV Layer: UV2
	UV2 = UV2 * uv2_scale.xy + uv2_offset.xy;
}

vec3 normal_blending(vec3 b, vec3 d) {
	return vec3(b.xy + d.xy - 0.5, b.z);
}

vec3 overlay(vec3 base, vec3 blend){
	vec3 limit = step(0.5, base);
	return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), limit);
}

vec3 custom_normal(vec3 normal_map){
	normal_map = mix(vec3(0.5,0.5,1.0), normal_map, normal_strength);
	vec3 normal_tangent = vec3(
		normal_map.r * 2.0 - 1.0,  // X-axis (unchanged)
		(normal_gl ? normal_map.g : 1.0 - normal_map.g) * 2.0 - 1.0,  // Y-axis (inverted for a DirectX map; HS: as it is for glTF's)
		1   // Z-axis (solid blue)
		);
	return normalize(TBN * normal_tangent);
}

float ScreenSpaceDither12(vec2 vScreenPos, float time){
	float vDither = dot( vec2( 171.0, 231.0 ), vScreenPos.xy + time); 
	return fract(vDither / 53.2);
}
// HS: the wetness layer's noise
float hs_hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hs_hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
// the beads: cells over the UV, a dome in some; returns its coverage and writes the dome's slope (tangent space)
float hs_beads(vec2 uv, out vec2 slope) {
	slope = vec2(0.0);
	if (sweat <= 0.0) return 0.0;
	vec2 q = uv * sweat_scale;
	vec2 i = floor(q);
	float best = 0.0;
	for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
		vec2 cell = i + vec2(float(dx), float(dy));
		vec2 h = hs_hash22(cell);
		if (h.x > sweat * 0.85) continue;
		vec2 centre = cell + 0.2 + 0.6 * hs_hash22(cell + 3.1);
		float rad = (0.12 + 0.3 * h.y) * sweat_size * 0.9;
		vec2 d = q - centre;
		float r = length(d);
		float cover = 1.0 - smoothstep(rad - 0.04, rad, r);
		if (cover > best) {
			best = cover;
			float t = clamp(r / max(rad, 1e-3), 0.0, 1.0);
			slope = (r > 1e-4 ? d / r : vec2(0.0)) * t * cover;    // the dome: steeper toward its rim
		}
	}
	return best;
}
// runs down the skin: lanes along u, each a streak of some length from a start, wet inside
float hs_drips(vec2 uv) {
	if (drips <= 0.0) return 0.0;
	float lanes = 40.0;
	float lane = floor(uv.x * lanes);
	float h = hs_hash12(vec2(lane, 11.0));
	if (h > drips * 0.7) return 0.0;
	float lx = fract(uv.x * lanes) - 0.5;
	float w = 0.08 + 0.1 * hs_hash12(vec2(lane, 5.0));
	float top = hs_hash12(vec2(lane, 9.0)) * 0.6;
	float len = 0.15 + 0.45 * hs_hash12(vec2(lane, 7.0));
	float inlane = 1.0 - smoothstep(w * 0.7, w, abs(lx + 0.04 * sin(uv.y * 60.0 + lane)));
	float inlen = smoothstep(top, top + 0.05, uv.y) * (1.0 - smoothstep(top + len - 0.05, top + len, uv.y));
	return inlane * inlen;
}
// HS: a detail tile laid twice, the second turned 37° and 1.37 times larger with its own offset, so no repeat shows:
// the relief's tilt in the UV's own frame (+u, +v; both layers added) in xy, how open the skin is (both cavities) in z
vec3 hs_tile(sampler2D t, vec2 q, vec2 qx, vec2 qy) {
	mat2 R = mat2(vec2(0.7986, 0.6018), vec2(-0.6018, 0.7986));
	vec2 q2 = R * q * (1.0 / 1.37) + vec2(0.37, 0.71);
	vec3 a = textureGrad(t, q, qx, qy).xyz;
	vec3 b = textureGrad(t, q2, R * qx * (1.0 / 1.37), R * qy * (1.0 / 1.37)).xyz;
	vec2 sa = vec2(a.x * 2.0 - 1.0, 1.0 - a.y * 2.0);                  // the picture's +Y is up it: v runs down
	vec2 sb = transpose(R) * vec2(b.x * 2.0 - 1.0, 1.0 - b.y * 2.0);   // the turned one's back into the UV's frame
	return vec3(sa + sb, a.z * b.z);
}
// HS: each colour's share of a shade that light under the skin fills (§5g): red least shaded, blue most; `s` 0 grey
vec3 hs_depth_exp(float s) { return max(vec3(1.0) + s * vec3(-0.5, -0.05, 0.12), vec3(0.15)); }
// HS: the tone tile laid twice the same way, its unevenness kept (the two layers' sum scaled back to one's spread)
vec3 hs_tone(sampler2D t, vec2 q, vec2 qx, vec2 qy) {
	mat2 R = mat2(vec2(0.7986, 0.6018), vec2(-0.6018, 0.7986));
	vec3 a = textureGrad(t, q, qx, qy).xyz;
	vec3 b = textureGrad(t, R * q * (1.0 / 1.37) + vec2(0.53, 0.19), R * qx * (1.0 / 1.37), R * qy * (1.0 / 1.37)).xyz;
	return (a + b - 1.0) * 0.7071;
}

void fragment() {
	vec2 base_uv = UV;
	TBN = mat3(TANGENT, -BINORMAL, NORMAL);

	//Raw depth value:
	float depth_raw = FRAGCOORD.z;

	//Convert to linear:
	vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, depth_raw);
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view.xyz /= view.w;

	// reverse
	linear_depth = clamp(1. + (view.z / 1.0), 0., 1.);
	smooth_depth = smoothstep(0.0, 0.6, linear_depth);

	sss_tex = texture(texture_translucency, base_uv).b;
	vec4 hs_dm = use_regions ? texture(texture_depth, base_uv) : vec4(0.0);   // HS: the depth layer's regions (§5g)
	if (!depth_ears_on) {
		sss_tex *= 1.0 - clamp(1.6 * hs_dm.b, 0.0, 1.0);             // HS: the ears' switch takes the lamps' light through them off too
	}

	//float fresnel = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0 );

	micro_detail = texture(texture_micro_detail, base_uv * micro_detail_scale);
	ao = normal_has_ao ? texture(texture_normal, base_uv).b : 1.0;   // HS
	ao *= texture(ambient_occlusion_texture, base_uv).r;

	float micro_overlay = mix(0.5, micro_detail.b, micro_ao_strength * 2.);
	vec4 albedo_tex = texture(texture_albedo, base_uv);
	if (use_micro_detail){
		albedo_tex = vec4(overlay(albedo_tex.rgb, vec3(micro_overlay)), albedo_tex.w);
	}

	final_albedo = albedo.rgb * albedo_tex.rgb;

	float metallic_tex = dot(texture(texture_metallic, base_uv), metallic_texture_channel);
	final_metallic = metallic_tex * metallic;
	ALBEDO = final_albedo * (1.0 - final_metallic);


	//METALLIC = metallic_tex * metallic;

	//float spec = max(dot(NORMAL, LIGHT_VERTEX * LIGHT_VERTEX), 0.0);

	//ALBEDO = vec3(1.);
	SPECULAR = clamp(specular, 0.,1.);
	if (use_ambient_occlusion){
		SPECULAR *= ao;
	}

	vec4 roughness_texture_channel = vec4(0.0, 1.0, 0.0, 0.0);
	float roughness_tex = dot(texture(texture_roughness, base_uv), roughness_texture_channel);
	ROUGHNESS = clamp(roughness_tex * roughness, 0.,1.);

	// Normal Map: Enabled
	vec3 micro_normal = mix(vec3(.5,.5,1.), vec3(micro_detail.xy, 1.), micro_normal_strength);

	//Normal Map (For Specular):
	vec3 normal_final = texture(texture_normal, base_uv).rgb;
	normal_final = normal_blending(normal_final, micro_normal);
	NORMAL_MAP = normal_final;
	NORMAL_MAP_DEPTH = normal_strength;

	// HS: the skin's detail at its true size (tools/skin_detail.py): the pores and the furrows between them from tiles
	// laid at their metres (MHR's two densities, blended where they meet), placed by MHR's region map; the lips' lines;
	// a pit or a furrow darker and duller; what's too fine to see once far turned into roughness
	hs_dn = vec3(0.0);
	hs_fuzz = 0.0;
	if (detail > 0.0) {
		vec4 reg = use_regions ? texture(texture_regions, base_uv) : vec4(0.6, 0.6, 0.0, 0.0);
		vec2 ux = dFdx(base_uv), uy = dFdy(base_uv);
		vec3 n0 = normalize(NORMAL);
		vec3 r1 = cross(dFdy(VERTEX), n0), r2 = cross(n0, dFdx(VERTEX));
		vec3 tu = r1 * ux.x + r2 * uy.x, tv = r1 * ux.y + r2 * uy.y;   // the skin along +u and +v (from the UVs' screen derivatives: no tangents needed)
		float tn = inversesqrt(max(max(dot(tu, tu), dot(tv, tv)), 1e-24));
		tu *= tn;
		tv *= tn;
		vec3 pores = vec3(0.0), micro = vec3(0.0), tc = vec3(0.0);
		float lod = 0.0;
		for (int k = 0; k < 2; k++) {                                  // the head's density, the body's (both where they meet)
			float w = k == 0 ? 1.0 - reg.a : reg.a;
			if (w < 0.01) continue;
			float s = (k == 0 ? uv_metres.x : uv_metres.y) / (detail_metres * pore_size);
			pores += w * hs_tile(texture_pores, base_uv * s, ux * s * 0.5, uy * s * 0.5);              // a mip sharper than the pixel: the relief's glints survive (TAA settles them)
			micro += w * hs_tile(texture_skin_micro, base_uv * s * 2.0, ux * s, uy * s);
			tc += w * hs_tone(texture_tone, base_uv * s * 0.25, ux * s * 0.25, uy * s * 0.25);
			lod += w * log2(max(length(ux), length(uy)) * s * 1024.0); // the pores' texels a pixel spans, as a mip level
		}
		float pa = reg.r * pore_depth * detail, ma = reg.g * furrow_depth * detail;
		vec2 tilt = pores.xy * pa + micro.xy * ma;
		float lip = 0.0;
		if (reg.b > 0.01 && lip_lines > 0.0) {                         // the lips: grooves up and down them a millimetre apart, wandering, 0.25 mm wide
			float x = base_uv.x * uv_metres.x / 0.0011;
			x += 0.3 * sin(base_uv.y * uv_metres.x / 0.0035 + 1.7 * floor(x));
			float f = fract(x) - 0.5, g = exp(-f * f / 0.012);
			float seen = 1.0 - smoothstep(0.0003, 0.0008, max(length(ux), length(uy)) * uv_metres.x);   // gone once a pixel spans most of a line
			lip = g * reg.b * min(1.0, lip_lines * detail) * seen;
			tilt.x -= f * g * 3.0 * reg.b * lip_lines * detail * seen;
		}
		float open = mix(1.0, pores.z, clamp(pa, 0.0, 1.0)) * mix(1.0, micro.z, clamp(ma, 0.0, 1.0)) * (1.0 - 0.35 * lip);
		hs_dn = tilt.x * tu + tilt.y * tv;
		NORMAL = normalize(n0 + hs_dn);
		ALBEDO *= pow(vec3(mix(1.0, open, detail_cavity)), hs_depth_exp(skin_depth * depth_pores));   // §5g: a pit's shade warm, not grey
		float tm = clamp(1.0 - tone * detail * tc.r * 0.5, 0.5, 1.5);    // melanin: darker and browner (lighter where it's less)
		ALBEDO *= pow(vec3(tm), vec3(0.75, 1.0, 1.35));
		ALBEDO *= vec3(1.0, 1.0 - tone_red * detail * tc.g * 0.3, 1.0 - tone_red * detail * tc.g * 0.38);   // the blood: redder, or paler
		ALBEDO *= 1.0 + tone * detail * tc.b * 0.25;
		SPECULAR *= mix(1.0, open, min(1.0, 1.5 * detail_cavity));
		ROUGHNESS = clamp(ROUGHNESS * mix(1.0, 1.3, 1.0 - open) + detail_rough * detail * smoothstep(2.0, 7.0, lod), 0.0, 1.0);
		hs_fuzz = fuzz * (1.0 - reg.b);
	}

	// Ambient Occlusion
	if (use_ambient_occlusion){
		AO = ao * ao_strength + (1.-ao_strength);// * smoothstep(0.,1., micro_detail.z * 1.6);
		AO_LIGHT_AFFECT = 0.0;
	}

	// Subsurface Scattering: Enabled
	if (use_subsurface_scattering){
		if (smooth_depth > 0.){
			float sss_strength_value = subsurface_scattering_strength * 2.0;
			if (translucency){
				sss_strength_value += (sss_tex * 2.);
			}
			if (use_noise){
				vec2 ts = vec2(textureSize(texture_sss_noise, 0)) * 0.85;
				vec2 dither_uv = mod(FRAGCOORD.xy, ts) / ts + (TIME * 2.5);
				vec2 tiling_screen_uv = FRAGCOORD.xy / (0.64 * -1.);
				float noise = 3.* texture(texture_sss_noise, dither_uv).r;// + vec2(1000. * TIME)).r;
				//noise = 2.0 * ScreenSpaceDither12(FRAGCOORD.xy, TIME * .50);
				sss_strength_value *= noise;
				//ALBEDO = vec3(noise);
			}
			SSS_STRENGTH = sss_strength_value * texture(ambient_occlusion_texture, base_uv).r * smooth_depth * sss_scale;   // HS: sss_scale
		}
		//ALBEDO = vec3(smooth_depth);
		//float sss_depth = 1. - pow(clamp(world_camera.z,0.,1.), 0.5);
	}

	// HS: the skin's depth (docs/GODOT_LOOK.md §5g): light that has travelled under the skin comes out warm. Round the
	// eyes, the nose, the mouth and the ears (MHR's depth map: each region, most in its creases) the colour turns toward
	// the blood's (`warm`), the export's occlusion shades red rather than grey (red goes furthest under the skin:
	// `hs_depth_exp`), and thin skin (the export's thinness) is lit through by the room. The ambient light (a baked
	// level's probes, the sky) takes all of it through ALBEDO; each lamp in light() gets its own share through hs_lamp
	// and hs_warm: its own occlusion's colour, and the warmth by how little the lamp reaches the point (all of it at the
	// shadow's edge, under half where it shines full on: what's lit straight on shows the skin's own colour); its light
	// through thin skin is the translucency's. Never a light of its own: dark where the skin is dark
	hs_lamp = vec3(1.0);
	hs_warm = vec3(1.0);
	if (skin_depth > 0.0) {
		float ear = depth_ears_on ? hs_dm.b : 0.0;
		float d = skin_depth * max(max(hs_dm.r * depth_eyes, hs_dm.g * depth_nose), max(hs_dm.a * depth_mouth, ear * depth_ears));
		vec3 col = max(depth_color, vec3(1e-3));
		vec3 warm = pow(max(col / dot(col, vec3(0.2126, 0.7152, 0.0722)), vec3(0.05)), vec3(0.25 * depth_warmth * d));   // its hue at the skin's brightness
		vec3 e = hs_depth_exp(depth_creases * max(d, skin_depth * depth_rest)) - 1.0;
		float og = use_ambient_occlusion ? ao * ao_strength + (1.0 - ao_strength) : 1.0;          // the shade Godot puts on the ambient (AO above)
		float ol = use_ambient_occlusion ? ao * ao_block_light + (1.0 - ao_block_light) : 1.0;    // and light() on the lamps
		float here = clamp(1.6 * max(max(hs_dm.r, hs_dm.g), max(hs_dm.a, ear)), 0.0, 1.0);
		vec3 through = vec3(1.0) + skin_depth * depth_glow * (translucency ? sss_tex : 0.0) * here * col / max(max(col.r, col.g), col.b);
		vec3 amb = min(warm * pow(vec3(max(og, 0.02)), e) * through, vec3(4.0));
		ALBEDO *= amb;
		hs_warm = warm;
		hs_lamp = pow(vec3(max(ol, 0.02)), e) / amb;
	}

	// HS: the wetness layer, over everything above
	{
		vec2 slope;
		float bead = hs_beads(base_uv, slope);
		float run = hs_drips(base_uv);
		float film = clamp(wetness + run * 0.9, 0.0, 1.0);
		float gloss = max(film * 0.75, oil);
		ALBEDO *= mix(1.0, 0.86, film);                                   // wet skin reads darker
		ALBEDO = mix(ALBEDO, pow(ALBEDO, vec3(1.18)) * 1.04, oil);        // oil: the colour deeper
		ROUGHNESS *= mix(1.0, 0.4, film);
		ROUGHNESS = mix(ROUGHNESS, oil_roughness, oil * 0.85);
		ROUGHNESS = mix(ROUGHNESS, 0.03, bead);
		SPECULAR = mix(SPECULAR, 0.9, max(bead, gloss));
		hs_gloss = max(bead, gloss);
		NORMAL_MAP = vec3(NORMAL_MAP.xy + slope * 0.45, NORMAL_MAP.z);   // the beads' domes on the normal
		NORMAL_MAP_DEPTH = mix(NORMAL_MAP_DEPTH, max(NORMAL_MAP_DEPTH, 1.0), bead);
	}
}
float DistributionGGX(float cos_theta_m, float alpha){
	float alpha2 = alpha * alpha;
	float d = 1.0 + (alpha2 - 1.0) * cos_theta_m * cos_theta_m;
	return alpha2 / (PI * d * d);
}

float GeometryGGX(float NdotL, float NdotV, float alpha){
	return 0.5 / mix(2.0 * NdotL * NdotV, NdotL + NdotV, alpha);
}

vec3 SchlickBaseReflectivity(){
	float dielectric = 0.04 * mix(specular * specular, 1.0, hs_gloss);   // HS: water's and oil's own 4 %
	return mix(vec3(dielectric), final_albedo, vec3(final_metallic));
}

float SchlickFresnel(float u){
	float m = 1.0 - u;
	float m2 = m * m;
	return m2 * m2 * m;
}

void light()
{
	// Calculate some vectors.
	vec3 lightColor = LIGHT_COLOR / PI;

	vec3 half = normalize(VIEW + LIGHT);

	float NdotL = max(dot(NORMAL, LIGHT), 0.0);
	float NdotV = max(dot(NORMAL, VIEW), 0.0);
	float NdotH = max(dot(NORMAL, half), 0.0);
	float LdotH = max(dot(LIGHT, half), 0.0);

	// Diffuse light (Lambert):
	//DIFFUSE_LIGHT += clamp(dot(mix(DIFFUSE_NORMAL, NORMAL, 0.3), LIGHT),0.,1.) * ATTENUATION * lightColor;

	//Custom wrapped diffuse:
	float wrap = 0.5;
	vec3 diff_light;
	float normal_depth = max((1.5-linear_depth), 1.);
	//normal_depth = 1.;

	if (!old_lightwarp_fallof){ //Better SSS aproximation:

		//Calculate custom normal:
		float s = skin_smoothness;
		vec3 dn_r = custom_normal(textureLod(texture_normal, UV, (1.*s) * normal_depth).rgb);
		vec3 dn_g = custom_normal(textureLod(texture_normal, UV, (0.8*s) * normal_depth).rgb);
		vec3 dn_b = custom_normal(textureLod(texture_normal, UV, (0.7*s) * normal_depth).rgb);
		
		//Include micro normals in the mix:
		vec3 m_normal = texture(texture_micro_detail, UV * micro_detail_scale).rgb;
		m_normal = mix(vec3(.5,.5,1.), vec3(m_normal.xy, 1.), micro_normal_strength);
		
		dn_g = normal_blending(dn_g, m_normal);
		dn_b = normal_blending(dn_b, m_normal);
		dn_r = normalize(dn_r + hs_dn * 0.15);   // HS: the detail soft in the diffuse, softest in the red (it travels furthest under the skin)
		dn_g = normalize(dn_g + hs_dn * 0.4);
		dn_b = normalize(dn_b + hs_dn * 0.55);
		////
		
		float sf = skin_fallof_smoothness;
		
		float wrapped_r = smoothstep(0.4 /sf, 1.2 *sf, dot(dn_r, LIGHT) * wrap + (1.0-wrap));
		float wrapped_g = smoothstep(0.425 /sf, 1.2 *sf, dot(dn_g, LIGHT) * wrap + (1.0-wrap));
		float wrapped_b = smoothstep(0.44 /sf, 1.2 *sf, dot(dn_b, LIGHT) * wrap + (1.0-wrap));
		vec3 wrapped_rgb = vec3(wrapped_r, wrapped_g, wrapped_b);
		if (use_ambient_occlusion){
			wrapped_rgb *= (ao * ao_block_light + (1.-ao_block_light));
		}

		diff_light = wrapped_rgb;
	}
	else{ //Lightwarp technique:
		vec3 diff_normal_map = mix(
			textureLod(texture_normal, UV, 6. * normal_depth).rgb,
			textureLod(texture_normal, UV, 3. * normal_depth).rgb,
			.2);
		vec3 diff_normal = custom_normal(diff_normal_map);

		float wrapped = pow(dot(diff_normal, LIGHT) * wrap + (1.0-wrap), 2.0);
		vec3 lw = texture(lightwarp, vec2(wrapped, 0.0)).rgb;
		if (use_ambient_occlusion){
			lw = texture(lightwarp, vec2(wrapped * (ao * ao_block_light + (1.-ao_block_light)), 0.0)).rgb;
		}
		diff_light = lw;
	}

	//Tint shadow penumbra:
	vec3 att = overlay(min(vec3(ATTENUATION), 1.), vec3(1.2,.8,.6)) * max(ATTENUATION, 0.5);
	if (tinted_shadow_penumbra){att = att;} else{att = vec3(ATTENUATION);}

	vec3 hs_l = hs_lamp * pow(hs_warm, vec3(mix(1.0, 0.45, smoothstep(0.15, 0.85, NdotL))));   // HS: the depth layer's colour for this lamp (§5g; ALBEDO carries the ambient's)
	DIFFUSE_LIGHT += diff_light * att * lightColor * hs_l;
	if (hs_fuzz > 0.0) {   // HS: peach fuzz: the fine hairs catch the light where the skin turns away, more from behind
		DIFFUSE_LIGHT += hs_fuzz * pow(1.0 - NdotV, 4.0) * clamp(dot(NORMAL, LIGHT) * 0.6 + 0.4, 0.0, 1.0) * att * lightColor * hs_l;
	}

	if (translucency){
		float translucency_dot = dot(VIEW,-(LIGHT + NORMAL * .4));
		vec2 t_col_coord = vec2(sss_tex * translucency_dot * translucency_strength, 0.0);
		vec3 t_color = texture(texture_translucency_color, t_col_coord).rgb;
		vec3 translucent = max(translucency_dot * t_color, 0.0) * lightColor;
		//translucency *= max(translucency_strength, 1.);

		DIFFUSE_LIGHT += translucent * hs_l;   // HS
	}

	vec3 f0 = SchlickBaseReflectivity();
	float LdotH5 = SchlickFresnel(LdotH);
	float f90 = clamp(50.0 * f0.g, 0.0, 1.0);
	vec3 F = f0 + (f90 - f0) * LdotH5;

	// Specular light (Schlick-GGX).
	float ggxAlpha = ROUGHNESS * ROUGHNESS;
	float D = DistributionGGX(NdotH, ggxAlpha);
	float G = GeometryGGX(NdotL, NdotV, ggxAlpha);

	vec3 specularBRDF = max(NdotL * D * G * F, 0.0);
	if (double_specularity){
		float D2 = DistributionGGX(NdotH, ggxAlpha + .3);
		float G2 = GeometryGGX(NdotL, NdotV, ggxAlpha + .3);

		vec3 specularBRDF2 = max(NdotL * D2 * G2 * F, 0.0);
		specularBRDF = mix(specularBRDF2, specularBRDF, mix(.6, 1., hs_gloss)) * 2.;   // HS: a wet coat has one tight lobe
	}
	SPECULAR_LIGHT += specularBRDF * LIGHT_COLOR * ATTENUATION;
	if (use_ambient_occlusion){
		SPECULAR_LIGHT *= ao * ao_block_light + (1.-ao_block_light);
	}
}
