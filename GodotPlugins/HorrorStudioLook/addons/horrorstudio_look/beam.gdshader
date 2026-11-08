// A spot light's beam in the air (HSBeam, nodes/beam.gd; docs/research/eye_candy.md §2): what a flashlight in fog
// looks like from behind it. Drawn on a cone hull round the light (Godot's CylinderMesh, its narrow end at the light),
// its back faces only, so it's drawn with the eye inside the cone too. Along each view ray, the light scattered toward
// the eye inside the cone is summed by equiangular samples about the apex (Kulla and Fajardo 2012: they crowd where the
// light is strongest, so 24 a pixel hold up), jittered per pixel and frame for TAA to settle (no banding in the dark).
// It uses:
//   - the scene's depth: the ray stops at what it hits;
//   - the spot's own falloffs (Godot's formulas: the cone's rim to `angle_attenuation`, the range window, `decay`);
//   - the cookie as the beam's profile (the light's projector);
//   - a phase (0 even);
//   - the air's density: the atmosphere's haze, its ground mist by height, its noise drifting on its wind (air_fog.gdshader has the same);
//   - extinction along the light's way and the eye's.
// Drawn after the opaque pass, added. Godot's volumetric fog leaves this light out (its fog energy 0: no double beam, no ghost).
shader_type spatial;
render_mode unshaded, blend_add, cull_front, depth_draw_never, depth_test_disabled, fog_disabled, shadows_disabled;

uniform vec3 light_color = vec3(3.0, 2.82, 2.52);   // the light's colour times its energy (and the beam's gain)
uniform float spot_range = 14.0;
uniform float cos_angle = 0.9135;                    // cos(spot_angle)
uniform float tan_angle = 0.4452;
uniform float angle_attenuation = 1.0;
uniform float decay = 1.0;
uniform float density = 0.02;                        // the air's scattering per metre, the haze's
uniform float extinction = 0.009;                    // and how much it takes away per metre
uniform float mist = 0.0;                            // the ground mist's density at the ground
uniform float mist_height = 1.2;
uniform float mist_ground = 0.0;
uniform float noise_amount = 0.5;
uniform float noise_scale = 0.18;
uniform vec3 drift = vec3(0.0);                       // the wind's run so far, metres
uniform float phase_g = 0.0;
uniform sampler3D noise_tex : repeat_enable, filter_linear;
uniform sampler2D profile_tex : filter_linear, repeat_disable;
uniform bool use_profile = false;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform int steps = 24;
uniform float hull_height = 14.7;

varying vec3 v_apex;
varying vec3 v_axis;

void vertex() {
	v_apex = (MODELVIEW_MATRIX * vec4(0.0, -hull_height * 0.5, 0.0, 1.0)).xyz;
	v_axis = normalize((MODELVIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
}

float ign(vec2 p) {
	return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}

float hg(float g, float c) {
	float g2 = g * g;
	return (1.0 - g2) / (12.566371 * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}

void fragment() {
	vec3 v = normalize(VERTEX);
	float t_hull = length(VERTEX);
	float dz = texture(depth_tex, SCREEN_UV).r;
	vec4 sp = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, dz, 1.0);
	float t_scene = dz <= 0.0 ? 1e6 : length(sp.xyz / sp.w);
	float t1 = min(t_hull, t_scene);
	float t0 = 0.02;
	if (t1 <= t0) {
		discard;
	}
	float delta = dot(v_apex, v);
	float D = max(length(v_apex - v * delta), 1e-3);
	float th0 = atan((t0 - delta) / D);
	float th1 = atan((t1 - delta) / D);
	float jit = ign(FRAGCOORD.xy + vec2(fract(TIME * 7.13) * 97.0, fract(TIME * 3.71) * 61.0));
	float acc = 0.0;
	for (int i = 0; i < steps; i++) {
		float s = (float(i) + jit) / float(steps);
		float th = mix(th0, th1, s);
		float t = delta + D * tan(th);
		vec3 p = v * t;
		vec3 L = p - v_apex;
		float dist = length(L);
		vec3 Ln = L / max(dist, 1e-4);
		float c = dot(Ln, v_axis);
		if (c <= cos_angle) {
			continue;
		}
		float rim = max((1.0 - c) / (1.0 - cos_angle), 0.0);   // on the axis c can round over 1: pow of a negative is NaN (black pixels)
		float cone = 1.0 - pow(rim, angle_attenuation);
		if (use_profile) {
			float rt = sqrt(max(1.0 - c * c, 0.0)) / max(c, 1e-3) / tan_angle;   // tan of the angle off the axis, over the spot's: the projector's own mapping
			cone *= texture(profile_tex, vec2(0.5 + 0.5 * rt, 0.5)).r;
		}
		float nd = dist / spot_range;
		nd *= nd;
		nd *= nd;
		nd = max(1.0 - nd, 0.0);
		nd *= nd;
		float att = nd * pow(max(dist, 0.05), -decay);
		vec3 wp = (INV_VIEW_MATRIX * vec4(p, 1.0)).xyz;
		float n = texture(noise_tex, (wp - drift) * noise_scale).r;
		float vary = (n * 2.0 - 1.0) * noise_amount;
		float dens = max(density * (1.0 + vary) + mist * exp(-max(wp.y - mist_ground, 0.0) / mist_height) * (1.0 + vary), 0.0);
		float ph = hg(phase_g, dot(Ln, -v));
		float inv_pdf = (th1 - th0) * (D * D + (t - delta) * (t - delta)) / D;
		acc += cone * att * dens * ph * inv_pdf * exp(-extinction * (t + dist));
	}
	ALBEDO = light_color * (acc / float(steps));
}
