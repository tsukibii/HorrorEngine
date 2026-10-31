shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;
// a street surface from the Blender bake, opaque (street.gdshaderinc does the work; street.gd sets it up)
#include "res://addons/horrorstudio_look/street.gdshaderinc"
