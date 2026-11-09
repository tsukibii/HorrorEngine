// The muzzle flash's wings, shared by flash.gdshader (added: a glow) and flash_solid.gdshader (solid: each pixel the
// nearest sphere's back, cut where it burns out): see flash.gdshader for the way it's drawn.
uniform sampler2D noise_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform float noise_scale = 1.7;           // the noise's size on each sphere (the unit sphere's coordinates times it)
uniform float sharp = 4.0;                 // the triplanar's blend between its three planes
uniform vec3 seed = vec3(0.0);             // a shot's own noise
uniform float age : hint_range(0.0, 1.0) = 0.0;   // the flash's life gone by
uniform float burn : hint_range(0.0, 1.5) = 1.0;  // how much of the noise shows and burns (0: smooth spheres)
uniform float erode = 0.55;                // how much more is burnt away by the flash's end
uniform float tip_burn = 0.55;             // a wing's tip burns this much more than its root
uniform float swell = 0.3;                 // how much each sphere grows over the flash
uniform vec4 core_color : source_color = vec4(1.0, 0.97, 0.82, 1.0);
uniform vec4 mid_color : source_color = vec4(1.0, 0.62, 0.2, 1.0);
uniform vec4 edge_color : source_color = vec4(0.75, 0.16, 0.04, 1.0);
uniform float energy = 6.0;                // HDR: the glow takes what's over white
uniform float fade = 0.6;                  // how much dimmer it is by its end
uniform float z_clip = 1.0;                // a gun's in first person: drawn in front of the world as the gun is
uniform float fov_override = 0.0;          // the gun's own lens (0: the camera's)

varying vec3 v_p;
varying vec3 v_n;
varying vec4 v_custom;                     // x: along its wing (0 root, 1 tip), y: the sphere's seed, z: its brightness

void vertex() {
	v_p = VERTEX;
	v_n = NORMAL;
	v_custom = INSTANCE_CUSTOM;
	VERTEX *= 1.0 + swell * age;
	Z_CLIP_SCALE = z_clip;
	if (fov_override > 0.0 && !IN_SHADOW_PASS) {
		float flip_y = sign(PROJECTION_MATRIX[1][1]);
		float aspect = PROJECTION_MATRIX[1][1] / PROJECTION_MATRIX[0][0];
		float f = flip_y / tan(fov_override * PI / 360.0);
		PROJECTION_MATRIX[0][0] = f / aspect;
		PROJECTION_MATRIX[1][1] = f;
	}
}

float triplanar(vec3 p, vec3 n) {
	vec3 w = pow(abs(n), vec3(sharp));
	w /= (w.x + w.y + w.z + 1e-5);
	return texture(noise_tex, p.yz).r * w.x + texture(noise_tex, p.xz).r * w.y + texture(noise_tex, p.xy).r * w.z;
}

// a colour burn: the base darkened by the blend, 1 - (1 - base) / blend
float color_burn(float base, float blend) {
	return 1.0 - (1.0 - base) / max(blend, 1e-3);
}

// the burn at this fragment: rgb its colour (HDR), a the burn's value b (0 burnt out, 1 white-hot)
vec4 flash_burn(vec3 normal, vec3 view, vec3 sp, vec3 sn, vec4 custom) {
	// the view's normal dotted with the surface's: 1 where a sphere's middle is seen, falling to 0 at its rim; less
	// as the flash dies and toward a wing's tip, so those burn away first
	float facing = abs(dot(normalize(normal), normalize(view)));
	facing *= (1.0 - erode * age) * (1.0 - tip_burn * custom.x * custom.x);
	// the noise on the sphere, triplanar, a little of it held up by `floor_` so the cores stay mostly alight
	vec3 p = sp * noise_scale + seed + custom.y * vec3(3.17, 7.31, 5.13);
	float nz = triplanar(p, normalize(sn));
	float base = mix(1.0 - 0.65 * clamp(burn, 0.0, 1.5), 1.0, nz);
	// the burn: the noise burnt by the facing (1 - (1 - noise) / facing): the noise itself where the sphere faces
	// the eye, eaten away toward its rim, furthest where the noise is darkest
	float b = clamp(color_burn(base, facing), 0.0, 1.0);
	// the ramp: red where it burns out, orange, white-yellow where it's hottest; the orange and red kept dim
	// enough for the tonemapper to leave them coloured (bright, everything turns white)
	vec3 col = mix(edge_color.rgb, mid_color.rgb, smoothstep(0.05, 0.55, b));
	col = mix(col, core_color.rgb, smoothstep(0.6, 0.95, b));
	float bright = custom.z * (1.0 - fade * age);
	return vec4(col * energy * bright * (0.22 + 0.78 * b * b * b), b);
}
