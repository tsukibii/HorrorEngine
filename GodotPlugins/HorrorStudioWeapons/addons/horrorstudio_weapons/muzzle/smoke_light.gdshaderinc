// How the weapons' smoke takes the light (puff.gdshader, smoke.gdshader): wrapped round it (smoke has no sharp
// terminator), light from behind let through, and no light let in brighter than `light_cap`. A light a few
// centimetres away (the muzzle's own flash, a flashlight at point blank) would otherwise light the smoke a thousand
// times over and blow it into a ball of glow the size of the room; a far one lights it as it should. `glow` gives it a
// light of its own (the smoke's colour times it, set by the look's smoke_glow), so a trail reads as grey wisps in a dim
// room as it does in the user's reference (impacts' dust keeps the faint default).
uniform float light_cap = 1.2;
uniform float wrap = 0.6;
uniform float through = 0.75;
uniform float glow = 0.05;                 // a light of its own: grey wisps where little light reaches it (0: lit only)

void light() {
	vec3 l = LIGHT_COLOR * ATTENUATION / PI;
	float m = max(max(l.r, l.g), l.b);
	l *= min(1.0, light_cap / max(m, 1e-4));
	float ndl = dot(NORMAL, LIGHT);
	float front = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
	float back = clamp(-ndl, 0.0, 1.0) * through;
	DIFFUSE_LIGHT += l * (front + back);
}
