## A light shaft (shaft.gdshader; docs/GODOT_LOOK.md §1c): the beam a window throws into a room, dust drifting in it.
## `HSShaft.make(at, into, width, height, reach, settings)` a FogVolume box from the window's middle `at` along
## `into` (both in the parent's space; the box's -Z runs into the room), `width` and `height` the glass, `reach` how
## far the beam goes; its fog shader thickens the room's haze inside the beam with dust in it, and the window's own
## light (a SpotLight3D with its `light_volumetric_fog_energy` raised: `HSShaft.light(spot, k)`) lights the haze, the
## frame's shadow in it. Settings: `strength` 0..1 (the density, 0.5 at 1), `dust` 0..1, `drift`. After Light Kit's
## Window shaft card; here the renderer's own fog carries the light, so nothing is drawn by hand. Needs the look's
## haze (volumetric fog) on: the pause menu's Effects Low switches shafts off with it.
class_name HSShaft
extends FogVolume

var mat: ShaderMaterial


static func make(at: Vector3, into: Vector3, width: float, height: float, reach: float = 3.0, s: Dictionary = {}) -> HSShaft:
	var sh := HSShaft.new()
	sh.name = "Shaft"
	sh.size = Vector3(width * 1.15, height * 1.15, reach)
	var dir := into.normalized()
	var centre := at + dir * reach * 0.5
	var up := Vector3.UP if absf(dir.y) < 0.99 else Vector3.FORWARD
	sh.transform = Transform3D(Basis.looking_at(dir, up), centre)        # looking_at: -Z along the beam
	wear(sh, s)
	return sh


## the beam's shader onto a FogVolume that's there (the export writes one along each window's light with `shaft`)
static func wear(fv: FogVolume, s: Dictionary = {}) -> ShaderMaterial:
	fv.shape = RenderingServer.FOG_VOLUME_SHAPE_BOX
	var m := ShaderMaterial.new()
	m.shader = load("res://addons/horrorstudio_look/shaft.gdshader")
	m.set_shader_parameter("density", 0.5 * float(s.get("strength", 1.0)))
	m.set_shader_parameter("dust", float(s.get("dust", 0.5)))
	m.set_shader_parameter("drift", float(s.get("drift", 0.12)))
	fv.material = m
	if fv is HSShaft:
		fv.mat = m
	return m


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/shaft.gdshader")


func settings(s: Dictionary) -> void:
	wear(self, s)


## the window's light into the haze: its volumetric energy up, so the beam shows (and its shadows cut it)
static func light(spot: Light3D, k: float = 4.0) -> void:
	spot.light_volumetric_fog_energy = k
