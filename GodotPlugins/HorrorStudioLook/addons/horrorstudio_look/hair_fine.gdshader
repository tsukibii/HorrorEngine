// Fine hair (HSHair, docs/GODOT_LOOK.md §5f): the brows and lashes, blended at their true coverage (a hair narrower than
// a pixel draws as a faint line, as a real lash does at a distance, never a whole black pixel); drawn after the opaque
// world, over the eye and the skin. The body is hair.gdshaderinc, shared with hair.gdshader.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;

#define HS_FINE
#include "res://addons/horrorstudio_look/hair.gdshaderinc"
