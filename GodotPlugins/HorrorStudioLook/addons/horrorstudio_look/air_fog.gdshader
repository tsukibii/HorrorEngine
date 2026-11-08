// The air's structure in Godot's volumetric fog (HSAtmosphere's FogVolume, shape World; docs/research/eye_candy.md §2):
// the environment's density is the haze, and this varies it by 3D noise drifting on the wind, wisps and pockets, and
// adds the ground mist, thick at the ground and thinning with height. beam.gdshader reads the same noise in the same way,
// so a flashlight's beam lights the same wisps the lamps do.
shader_type fog;

uniform float haze = 0.009;          // the environment's density: the noise varies it by ± noise_amount of it
uniform float noise_amount = 0.5;
uniform float noise_scale = 0.18;
uniform vec3 drift = vec3(0.0);       // the wind's run so far, metres
uniform float mist = 0.0;            // the ground mist's density at the ground
uniform float mist_height = 1.2;
uniform float ground = 0.0;
uniform vec3 albedo = vec3(0.8, 0.84, 0.9);
uniform sampler3D noise_tex : repeat_enable, filter_linear;

void fog() {
	float n = texture(noise_tex, (WORLD_POSITION - drift) * noise_scale).r;
	float vary = (n * 2.0 - 1.0) * noise_amount;
	float h = max(WORLD_POSITION.y - ground, 0.0);
	DENSITY = haze * vary + mist * exp(-h / mist_height) * (1.0 + vary);
	ALBEDO = albedo;
}
