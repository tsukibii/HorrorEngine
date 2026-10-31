// The tear line on a Character Studio export (docs/GODOT_LOOK.md §5f; the Studio's TEARM): a thin wet strip along each
// lower lid, between the lid's rim and the eyeball, that only reflects: added over what's behind it, black itself, so
// it shows as the lights' and the room's glint along the lid, never a white line. Its fade (the vertices' colour: nothing
// at its ends and edges, the most along its middle; the file's material is wholly see-through, glTF having no adding)
// and its strength from the export (`studioTear`). MetaHuman's lacrimal fluid; the eye's wet look with the cornea's coat
// (eye.gdshader).
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled, shadows_disabled, specular_schlick_ggx;

uniform float strength = 0.4;         // the Studio's Tear line (0.8 of it)
uniform float gain = 0.2;             // Godot's lamps on it: at the Studio's strength (and at 0.45 of it) it read as a white line along the lid
uniform float roughness = 0.2;        // wet, the glint spread along it (sharper, it sparkled in dots)

void fragment() {
	ALBEDO = vec3(0.0);
	ROUGHNESS = roughness;
	SPECULAR = 1.0;
	ALPHA = clamp(min(COLOR.r, COLOR.a) * strength * gain, 0.0, 1.0);   // (an export of the first day kept the fade in the alpha)
}
