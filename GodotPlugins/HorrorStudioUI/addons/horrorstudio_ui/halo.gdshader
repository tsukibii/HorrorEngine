// A soft, edgeless patch of dark behind text, never a shape (the desk's "halo", play/ui/hud.css: "a soft, edgeless patch
// behind boxless text"). The rectangle a ColorRect wearing it covers is the text's own plus `feather` pixels all round:
// inside the text's rectangle it is `strength`, and out to its edge it falls away to nothing along a smooth curve, so there
// is no line anywhere to see and no panel. hud.gd's halo() makes one and keeps `rect_size` right.
shader_type canvas_item;

uniform vec2 rect_size = vec2(100.0, 100.0);          // the whole rectangle in pixels (hud.gd sets it when it changes)
uniform float feather = 80.0;                          // how far past the text it fades, in pixels
uniform float strength : hint_range(0.0, 1.0) = 0.6;   // how dark right behind the words
uniform vec4 tint : source_color = vec4(0.01, 0.015, 0.025, 1.0);
uniform float tail = 1.5;                              // above 1: a longer, softer tail

float round_box(vec2 p, vec2 half_size, float r) {
	vec2 q = abs(p) - half_size + vec2(r);
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

void fragment() {
	vec2 p = (UV - vec2(0.5)) * rect_size;
	vec2 inner = max(rect_size * 0.5 - vec2(feather), vec2(1.0));
	// the full-strength part is the text's rectangle with its corners well rounded, so the dark is a soft blob, not a box
	float d = round_box(p, inner, min(inner.x, inner.y) * 0.8);
	float a = 1.0 - smoothstep(0.0, feather, max(d, 0.0));
	a = a * a * (3.0 - 2.0 * a);
	COLOR = vec4(tint.rgb, pow(a, tail) * strength * tint.a);
}
