// Cloth (HSCloth, cloth.gd; GODOT_LOOK §5x): a garment wearing one of the studio's clothing fabric sets
// (tools/fabricpbr.py, the packs in textures/cloth/). The file brings the dye (the garment's colour, its pattern and
// prints, baked flat on its own layout) and its creases; the fabric's own surface is drawn here at its real size on
// the second UV, which is the cloth's metres: the weave's or the knit's relief, roughness and occlusion, how the dye
// reads deeper down between the yarns, and the fuzz: a second lobe (Charlie's, as three.js and Filament have it) off
// the cloth's hairs, strongest where the cloth turns away from the eye or the light is behind it. The same numbers
// and the same terms as the Character Studio's garment shader (tools/character/tailor/look.js), so a garment looks
// in the game as it did where it was made.
//
// Godot has no sheen of its own, so the direct light is written here (light()): a diffuse that wraps past the
// terminator (the light through and between the fibres), GGX for the fibres' own shine, the fuzz lobe. The sky's
// light never comes through light(): there the fuzz is folded into ALBEDO (what the ambient light is multiplied by),
// and light() takes it out again for its own diffuse (v_ratio).

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform sampler2D crease_tex : hint_normal, filter_linear_mipmap_anisotropic;
uniform float crease_on = 0.0;
uniform sampler2D pack_a : filter_linear_mipmap_anisotropic, repeat_enable;   // the weave's normal (x, y), its hairiness
uniform sampler2D pack_b : filter_linear_mipmap_anisotropic, repeat_enable;   // the undyed cloth over its mean (halved), its roughness, its occlusion
uniform sampler2D pack_o : filter_linear_mipmap_anisotropic, repeat_enable;   // a sheer knit's yarn against its holes, or where a dye takes
uniform float dye_mask = 0.0;              // 1: pack_o says where the dye takes (a denim's weft stays undyed)
uniform float dye_mean = 1.0;              // the mask's mean
uniform vec3 undyed : source_color = vec3(0.86, 0.84, 0.8);
uniform float tile = 30.0;                 // repeats a metre of cloth
uniform float detail = 1.0;                // the weave's relief (0 none, 1 as made)
uniform float cavity = 0.5;                // how much deeper the dye reads down between the yarns
uniform float sheen = 0.5;                 // the fuzz lobe's strength
uniform float sheen_rough = 0.5;
uniform float sheen_dye = 0.85;            // how much of the dye the hairs carry
uniform float fuzz_flat = 0.8;             // the fuzz stands on the cloth's own surface, not each yarn's
uniform float halo = 0.3;                  // a light behind the cloth caught in its hairs along its outline
uniform float wrap = 0.3;                  // how far the diffuse light wraps past the terminator
uniform float spec = 0.5;                  // the fibres' reflectance (0.5: F0 0.04)
uniform float rough_scale = 1.0;
uniform float macro = 0.03;                // a slow unevenness over many repeats
uniform float cover = 0.25;                // a sheer knit: its yarn's share of the cloth as made
uniform float denier = 0.3;                // and how much of the skin it should hide, seen straight on
uniform float vertex_shade = 1.0;          // the garment's own shade along its edges (the file's vertex colours)
uniform float flip_v = 1.0;                // (the file's second UV runs up the cloth, a picture's rows run down)

varying vec3 v_ratio;                      // the cloth's own colour over ALBEDO: the direct diffuse without the sky's fuzz
varying vec3 v_sheen;                      // the fuzz lobe's colour here
varying vec3 v_fabn;                       // the cloth's own surface (its creases, not its weave), view space
varying float v_comp;                      // what the fuzz takes from the cloth under it

float sheen_dg(float nv, float r) {        // the fuzz lobe's directional albedo (three.js r160's fit)
	float r2 = r * r;
	float a = r < 0.25 ? -339.2 * r2 + 161.4 * r - 25.9 : -8.48 * r2 + 14.3 * r - 9.95;
	float b = r < 0.25 ? 44.0 * r2 - 23.7 * r + 3.26 : 1.97 * r2 - 3.27 * r + 0.72;
	return min(exp(a * nv + b) + (r < 0.25 ? 0.0 : 0.1 * (r - 0.25)), PI);
}

void fragment() {
	vec4 base = texture(albedo_tex, UV) * albedo_color;
	vec2 fm = UV2 * tile;                                       // the cloth's metres in repeats: u round, v up
	vec2 fu = vec2(fm.x, -fm.y * flip_v);
	vec3 a = texture(pack_a, fu).rgb;
	vec3 b = texture(pack_b, fu).rgb;
	float rel = b.r * 2.0;
	if (macro > 0.0) {                                          // the same map read seven times larger, turned: no grid of tiles from afar
		vec2 mu = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8)) * fu * 0.137 + 0.37;
		rel *= 1.0 + macro * clamp((textureLod(pack_b, mu, 5.0).r * 2.0 - 1.0) * 8.0, -1.0, 1.0);   // (its sixth mip: its slow mottle only, never its yarns seven times their size)
	}
	vec3 dye = base.rgb;
	if (dye_mask > 0.5) {
		dye = undyed * pow(max(dye, vec3(1e-4)) / undyed, vec3(texture(pack_o, fu).r / dye_mean));   // (a dye's depth goes by its amount as a power, not a blend; over the mask's mean: the colour picked is the cloth's from afar)
	}
	float cav = clamp(1.0 - rel, 0.0, 1.0);                     // down between the yarns the light meets the dye more than once
	vec3 cloth = pow(max(dye, vec3(1e-4)), vec3(1.0 + cavity * cav)) * rel * mix(vec3(1.0), COLOR.rgb, vertex_shade);

	vec3 n = normalize(NORMAL);
	if (crease_on > 0.5) {                                      // the garment's creases, on its own layout (the mesh's tangents)
		vec2 c = texture(crease_tex, UV).rg * 2.0 - 1.0;
		n = normalize(TANGENT * c.x + BINORMAL * c.y + n * sqrt(max(0.0, 1.0 - dot(c, c))));
	}
	v_fabn = n;
	vec3 dpx = dFdx(VERTEX);                                    // the weave's relief in the cloth's own frame, found on the screen:
	vec3 dpy = dFdy(VERTEX);                                    // it needs no tangents, and a garment's layout may lie any way round
	vec2 dux = dFdx(fm);
	vec2 duy = dFdy(fm);
	float det = dux.x * duy.y - dux.y * duy.x;
	if (detail > 0.0 && abs(det) > 1e-12) {
		vec3 tu = (dpx * duy.y - dpy * dux.y) / det;
		vec3 tv = (dpy * dux.x - dpx * duy.x) / det;
		tu = normalize(tu - n * dot(n, tu));
		tv = normalize(tv - n * dot(n, tv));
		vec2 d = (a.xy * 2.0 - 1.0) * detail;
		d *= min(1.0, 0.98 / max(length(d), 1e-4));
		n = normalize(tu * d.x + tv * d.y + n * sqrt(max(0.0, 1.0 - dot(d, d))));
	}
	NORMAL = n;

	ROUGHNESS = clamp(b.g * rough_scale, 0.05, 1.0);
	SPECULAR = spec;
	float al = clamp(dot(cloth, vec3(0.3333)), 0.0, 1.0);       // the weave's occlusion, with the light that bounces between pale yarns given back (Jimenez's fit)
	float ao = b.b;
	AO = max(ao, ((ao * (2.0404 * al - 0.3324) + (-4.7951 * al + 0.6417)) * ao + (2.7552 * al + 0.6903)) * ao);

	vec3 sc = mix(vec3(1.0), sqrt(clamp(dye, 0.0, 1.0)), sheen_dye) * min(sheen * a.b, 1.0);   // the hairs carry the dye's square root: lighter, less saturated
	v_sheen = sc;
	v_comp = 1.0 - 0.157 * max(sc.r, max(sc.g, sc.b));
	vec3 lit = cloth * v_comp;
	vec3 sky = lit + sc * sheen_dg(clamp(dot(v_fabn, VIEW), 0.0, 1.0), clamp(sheen_rough, 0.07, 1.0));
	ALBEDO = sky;
	v_ratio = lit / max(sky, vec3(1e-5));
#ifdef SHEER
	float cv = texture(pack_o, fu).r;                           // its yarn's cover brought to the garment's denier: denser, a haze of filaments between the loops; sheerer, thinner yarn
	float sa = denier >= cover ? mix(cv, 1.0, (denier - cover) / max(1.0 - cover, 1e-3)) : cv * denier / max(cover, 1e-3);
	ALPHA = 1.0 - pow(1.0 - min(sa, 0.999), 1.0 / max(abs(dot(n, VIEW)), 0.18));   // a thin sheet seen at a slant: more yarn in the way
#endif
}

void light() {
	vec3 n = NORMAL;
	vec3 h = normalize(VIEW + LIGHT);
	float ndl = dot(n, LIGHT);
	DIFFUSE_LIGHT += v_ratio * (clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0) * ATTENUATION / PI) * LIGHT_COLOR;
	float cndl = max(ndl, 0.0);
	float cndv = max(dot(n, VIEW), 1e-4);
	float cndh = max(dot(n, h), 0.0);
	float a2 = ROUGHNESS * ROUGHNESS;
	a2 *= a2;
	float dd = cndh * cndh * (a2 - 1.0) + 1.0;
	float vis = 0.5 / (cndl * sqrt(cndv * cndv * (1.0 - a2) + a2) + cndv * sqrt(cndl * cndl * (1.0 - a2) + a2) + 1e-5);
	float f0 = 0.08 * spec;
	float fr = f0 + (1.0 - f0) * pow(1.0 - max(dot(LIGHT, h), 0.0), 5.0);
	float ggx = a2 / (PI * dd * dd) * vis * fr * cndl * v_comp;
	vec3 nf = normalize(mix(n, v_fabn, fuzz_flat));             // the fuzz: Charlie's distribution, Neubelt's visibility
	float fnl = clamp(dot(nf, LIGHT), 0.0, 1.0);
	float fnv = clamp(dot(nf, VIEW), 0.0, 1.0);
	float fnh = clamp(dot(nf, h), 0.0, 1.0);
	float ia = 1.0 / pow(clamp(sheen_rough, 0.07, 1.0), 2.0);
	float dc = (2.0 + ia) * pow(max(1.0 - fnh * fnh, 0.0078125), ia * 0.5) / (2.0 * PI);
	float vn = clamp(1.0 / (4.0 * (fnl + fnv - fnl * fnv)), 0.0, 1.0);
	SPECULAR_LIGHT += (vec3(ggx) + v_sheen * (dc * vn * fnl)) * ATTENUATION * LIGHT_COLOR * SPECULAR_AMOUNT;
	// the halo: Charlie's lobe is dark for a light straight behind the cloth (its half vector lies along the normal
	// there), yet that is when a knit's hairs light up along its outline: the light scattered on through them
	float through = clamp(-dot(VIEW, LIGHT), 0.0, 1.0);
	SPECULAR_LIGHT += v_sheen * (halo * pow(1.0 - fnv, 3.0) * through * through / PI) * ATTENUATION * LIGHT_COLOR;
}
