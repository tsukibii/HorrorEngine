// A particle that is a picture turned to the eye (HSMuzzle.sprite_mesh): the love-heart shell's hearts out of the
// muzzle, floating up where they land and over someone smitten. A billboard turned by the particle's own angle, the
// picture times the particle's colour, unlit (it shows in the dark as the sparks do: `energy` how bright), soft against
// what's behind it so it never cuts a hard line into a wall.
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;

uniform sampler2D sprite_tex : source_color, hint_default_white, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;
uniform float energy = 1.0;
uniform float soft_m = 0.03;               // fading out this near what's behind it

void vertex() {
	mat4 w = mat4(normalize(INV_VIEW_MATRIX[0]), normalize(INV_VIEW_MATRIX[1]), normalize(INV_VIEW_MATRIX[2]), MODEL_MATRIX[3]);
	w = w * mat4(vec4(cos(INSTANCE_CUSTOM.x), -sin(INSTANCE_CUSTOM.x), 0.0, 0.0), vec4(sin(INSTANCE_CUSTOM.x), cos(INSTANCE_CUSTOM.x), 0.0, 0.0), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_MATRIX = VIEW_MATRIX * w;
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
}

void fragment() {
	vec4 t = texture(sprite_tex, UV);
	float dz = texture(depth_tex, SCREEN_UV).r;
	vec4 sv = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, dz, 1.0);
	float behind = -sv.z / sv.w;
	float here = -VERTEX.z;
	ALBEDO = COLOR.rgb * t.rgb * energy;
	ALPHA = clamp(COLOR.a * t.a, 0.0, 1.0) * clamp((behind - here) / soft_m, 0.0, 1.0);
}
