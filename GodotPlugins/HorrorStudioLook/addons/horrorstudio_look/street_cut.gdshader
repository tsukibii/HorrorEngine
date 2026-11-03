shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;
// a street surface from the Blender bake with holes: worn road paint, the road's letters, a fence's mesh
#define CUT
#include "res://addons/horrorstudio_look/street.gdshaderinc"
