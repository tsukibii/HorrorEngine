// HSOoze's fragment (after the kind's field()): the surface where this pixel looks, the shape there, its slope from
// this pixel's neighbours (one look at the field a pixel), its colour, its embers

void fragment() {
	vec3 vp = view_at(SCREEN_UV, INV_PROJECTION_MATRIX);
	vec4 w4 = INV_VIEW_MATRIX * vec4(vp, 1.0);
	vec3 lp = vec3(dot(im0, w4), dot(im1, w4), dot(im2, w4));
	vec2 p = vec2(lp.x * bscale.x, lp.z * bscale.z);
	float t = age;
	float d = field(p, t);
	// the double beat: thump-thump, a rest
	float bt = fract((TIME + seed * 3.7) / 1.3) * 1.3;
	float beat = exp(-pow((bt - 0.12) * 11.0, 2.0)) + 0.6 * exp(-pow((bt - 0.36) * 11.0, 2.0));
	float h0 = depth_at(d, p, beat);
	// the slopes from this pixel's neighbours, taken before anything is thrown away (a quad's lanes must all be alive)
	vec2 dpx = dFdxFine(p);
	vec2 dpy = dFdyFine(p);
	float dhx = dFdxFine(h0);
	float dhy = dFdyFine(h0);
	float aa = max(fwidthFine(d), 1e-5);
	if (abs(lp.x) > half.x || abs(lp.y) > half.y || abs(lp.z) > half.z) {
		discard;
	}
	float cover = clamp(0.5 - d / aa, 0.0, 1.0);
	if (cover <= 0.0) {
		discard;
	}
	// the surface's own normal from the depth buffer (the normal buffer is only filled for some materials): each way,
	// the neighbour across no edge (the nearer in depth)
	vec2 px = 1.0 / VIEWPORT_SIZE;
	vec3 l = view_at(SCREEN_UV - vec2(px.x, 0.0), INV_PROJECTION_MATRIX);
	vec3 r = view_at(SCREEN_UV + vec2(px.x, 0.0), INV_PROJECTION_MATRIX);
	vec3 u = view_at(SCREEN_UV - vec2(0.0, px.y), INV_PROJECTION_MATRIX);
	vec3 b = view_at(SCREEN_UV + vec2(0.0, px.y), INV_PROJECTION_MATRIX);
	vec3 ddx = abs(r.z - vp.z) < abs(vp.z - l.z) ? r - vp : vp - l;
	vec3 ddy = abs(b.z - vp.z) < abs(vp.z - u.z) ? b - vp : vp - u;
	vec3 sn = normalize(cross(ddy, ddx));
	if (dot(sn, -vp) < 0.0) {
		sn = -sn;
	}
	float facing = dot(sn, vy);
	if (facing < 0.08) {
		discard;
	}
	// its slope over the surface (dh/dp) from the neighbours' differences, then the normal leaning with it
	float det = dpx.x * dpy.y - dpx.y * dpy.x;
	vec2 g = abs(det) > 1e-14 ? vec2(dhx * dpy.y - dhy * dpx.y, dpx.x * dhy - dpy.x * dhx) / det : vec2(0.0);
	g = clamp(g, vec2(-3.0), vec2(3.0));
	vec3 tx = normalize(vx - sn * dot(vx, sn));
	vec3 tz = normalize(vz - sn * dot(vz, sn));
	vec3 n = normalize(sn - (tx * g.x + tz * g.y) * 1.6);
	NORMAL = n;
	LIGHT_VERTEX = vp;
	// thick and black with an oil's sheen, thin and oxblood
	float thick = clamp(-d / (0.002 + 0.008 * size_m), 0.0, 1.0);
	float film = 1.0 - smoothstep(0.05, 0.55, thick);
	float nv = clamp(dot(n, normalize(-vp)), 0.0, 1.0);
	float hue = fract(0.55 * (1.0 - nv) + 0.8 * h0 / max(thickness_mm * 0.001, 1e-5) + 0.35 * fbm(p * 6.0 + seed) + TIME * 0.015);
	vec3 tint = hue < 0.333 ? mix(sheen_a.rgb, sheen_b.rgb, hue * 3.0) : (hue < 0.667 ? mix(sheen_b.rgb, sheen_c.rgb, hue * 3.0 - 1.0) : mix(sheen_c.rgb, sheen_a.rgb, hue * 3.0 - 2.0));
	vec3 f0 = mix(vec3(1.0), tint, sheen) * 0.06;
	ALBEDO = mix(f0, film_color.rgb, film);                         // (thick: its specular colour, as a metal's)
	METALLIC = 1.0 - film;
	SPECULAR = 0.5;
	ROUGHNESS = mix(1.0 - gloss, 0.16, film * 0.6);
	// embers dying in it, flickering
	vec2 ce = floor(p / 0.03);                                     // (big enough to live through the tape)
	float he = h21(ce + seed);
	float em = 0.0;
	if (he > 0.9 && embers > 0.001 && thick > 0.25) {
		vec2 cc = (ce + 0.2 + 0.6 * vec2(h21(ce + 3.1), h21(ce + 7.7))) * 0.03;
		float er = 0.0012 + 0.003 * pow(h21(ce + 11.0), 2.0);
		em = smoothstep(er, er * 0.3, length(p - cc)) * (0.6 + 0.4 * sin(TIME * (7.0 + 9.0 * he) + he * 40.0)) * embers;
	}
	EMISSION = ember_color.rgb * ember_energy * em * (0.85 + 0.15 * beat * pulse);
	// what's round it seen in it: the screen behind (the lit wall, the floor) a little off along its lean, by Fresnel,
	// so its rounded edges mirror the room (the screen copy is the opaque world: never itself)
	float fres = 0.015 + 0.985 * pow(1.0 - nv, 5.0);              // (little head on: it stays pitch where it faces you)
	vec2 ruv = clamp(SCREEN_UV + n.xy * vec2(0.05, -0.05) * (0.4 + 2.0 * (1.0 - nv)), vec2(0.001), vec2(0.999));
	vec3 seen = textureLod(screen_tex, ruv, 1.5).rgb;
	seen *= smoothstep(0.0, 0.04, min(min(ruv.x, 1.0 - ruv.x), min(ruv.y, 1.0 - ruv.y)));   // (nothing read off the screen's edge)
	EMISSION += seen * fres * mirror * (1.0 - film) * mix(vec3(0.85), tint * 1.4, sheen * 0.7);
	// soft where the box ends, faded on a surface turned away from it
	float fade = (1.0 - smoothstep(0.64, 1.0, abs(lp.y) / half.y)) * smoothstep(0.08, 0.35, facing);
	ALPHA = cover * fade;
	if (debug == 1) {
		ALBEDO = vec3(1.0);
		METALLIC = 0.0;
		ROUGHNESS = 1.0;
		EMISSION = vec3(0.0);
	} else if (debug == 2) {
		ALBEDO = vec3(0.0);
		METALLIC = 0.0;
		EMISSION = n * 0.5 + 0.5;
	} else if (debug == 3) {
		ALBEDO = vec3(1.0);
		METALLIC = 1.0;
		ROUGHNESS = 0.3;
	} else if (debug == 4) {
		ALBEDO = vec3(1.0);
		METALLIC = 1.0;
		ROUGHNESS = 0.6;
		EMISSION = vec3(0.0);
	}
}
