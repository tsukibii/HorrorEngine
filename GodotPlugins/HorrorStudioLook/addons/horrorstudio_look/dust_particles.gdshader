// The motes' places (HSDust, nodes/dust.gd; docs/research/eye_candy.md §2.3b): they ride the air. The flow is a
// curl-noise flow (Bridson et al. 2007): the curl of a smooth potential, two octaves of slow eddies, so the motes swirl
// without bunching up or thinning out. It runs at `stir` (a still room's 3 cm/s), with the atmosphere's wind on top and
// a slow settling, and it's wrapped round the eye: the air round you is the same wherever you walk, and nothing is born
// or dies in view (a mote leaving the box on one side comes back on the other, far enough out to be faded).
// Each mote's CUSTOM is x its kind (over 0.88 a fibre), y its size, z its tumble, w its brightness.
shader_type particles;

uniform vec3 eye = vec3(0.0);
uniform vec3 box = vec3(8.0, 4.0, 8.0);
uniform vec3 wind = vec3(0.0);       // metres a second (the atmosphere's)
uniform float stir = 0.03;           // metres a second: the room's own eddies
uniform float eddy = 0.65;           // the big eddies' wavenumber (about 1.5 m across; the small ones 2.4 times it)
uniform float settle = 0.0015;       // metres a second down, for the biggest

float rand(uint x) {
	x ^= x >> 16u;
	x *= 0x7feb352du;
	x ^= x >> 15u;
	x *= 0x846ca68bu;
	x ^= x >> 16u;
	return float(x) / 4294967295.0;
}

// the curl of A = (sin(y + a t) cos(1.3 z), sin(0.9 z + b t) cos(1.1 x), sin(1.2 x + c t) cos(0.8 y)) at q = p k
vec3 curl(vec3 p, float k, float t) {
	vec3 q = p * k;
	float s1 = sin(q.y + 0.13 * t), c1 = cos(q.y + 0.13 * t);
	float s2 = sin(0.9 * q.z + 0.11 * t), c2 = cos(0.9 * q.z + 0.11 * t);
	float s3 = sin(1.2 * q.x + 0.17 * t), c3 = cos(1.2 * q.x + 0.17 * t);
	float dA3dy = s3 * (-0.8 * sin(0.8 * q.y));
	float dA2dz = 0.9 * c2 * cos(1.1 * q.x);
	float dA1dz = s1 * (-1.3 * sin(1.3 * q.z));
	float dA3dx = 1.2 * c3 * cos(0.8 * q.y);
	float dA2dx = s2 * (-1.1 * sin(1.1 * q.x));
	float dA1dy = c1 * cos(1.3 * q.z);
	return vec3(dA3dy - dA2dz, dA1dz - dA3dx, dA2dx - dA1dy);
}

void start() {
	uint s = NUMBER * 4u + 1013904223u * RANDOM_SEED;
	vec3 r = vec3(rand(s), rand(s + 1u), rand(s + 2u));
	CUSTOM = vec4(rand(s + 3u), rand(s + 4u), rand(s + 5u), rand(s + 6u));
	TRANSFORM = mat4(1.0);
	TRANSFORM[3].xyz = eye + (r - 0.5) * box;
	VELOCITY = vec3(0.0);
}

void process() {
	vec3 p = TRANSFORM[3].xyz;
	vec3 small = curl(p.zxy + 7.3, eddy * 2.4, TIME * 1.3).yzx;       // in the permuted frame, turned back: still divergence-free
	vec3 v = (curl(p, eddy, TIME) + 0.45 * small) * stir / 1.6;
	v += wind;
	v.y -= settle * CUSTOM.y * CUSTOM.y;
	p += v * DELTA;
	p = eye + mod(p - eye + box * 0.5, box) - box * 0.5;
	TRANSFORM = mat4(vec4(1.0, 0.0, 0.0, 0.0), vec4(0.0, 1.0, 0.0, 0.0), vec4(0.0, 0.0, 1.0, 0.0), vec4(p, 1.0));
	VELOCITY = v;
}
