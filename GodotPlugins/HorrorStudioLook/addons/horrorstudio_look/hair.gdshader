// Hair (HSHair, docs/GODOT_LOOK.md §5c, §5e): the head's hair, its coverage cut (softly, or dithered for the TAA to
// resolve); the body is hair.gdshaderinc, shared with hair_fine.gdshader (the brows and lashes, blended).
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;

#include "res://addons/horrorstudio_look/hair.gdshaderinc"
