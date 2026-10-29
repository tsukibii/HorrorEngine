// The tape's history (vhs.gd): the last frame of the screen copied into a viewport of its own each frame, so the
// tape shader can mix a little of it back in (UltraVHS's persistence, Ghosting): a canvas item can't read its own
// viewport while drawing it, so the copy lives one viewport over.
shader_type canvas_item;
render_mode unshaded;
uniform sampler2D current : filter_linear, repeat_disable;

void fragment() {
	COLOR = vec4(texture(current, UV).rgb, 1.0);
}
