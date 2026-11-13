// An eye's paint drawn flat (HSEyePaint, eye_paint.gd; docs/GODOT_LOOK.md §5v): the picture an export's eyeball wears
// (the eye's front half projected flat, the iris in the middle), drawn again by Godot from the eye's own record with
// whatever was changed, into a small viewport once a change; the eye's shader then reads it as it reads the baked one.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

#include "eye_paint.gdshaderinc"

void fragment() {
	COLOR = vec4(eyeFlat(vec2(UV.x, 1.0 - UV.y)), 1.0);      // (the picture's rows run down, the layout's v up the eye)
}
