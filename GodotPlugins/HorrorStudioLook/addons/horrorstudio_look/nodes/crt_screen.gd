## A CRT screen (HSCrt; docs/GODOT_LOOK.md §5i): a tube television's glass on the mesh it's under (a quad on the
## set's front, or one surface of the set's mesh: `surface`), seen close: the phosphor stripes and scanlines at
## their true size (fading out at a distance, no moiré), the glass's curve and its reflection of the room, the
## bright parts' halo, the hum and a rolling bar. `picture` what it shows (none: snow); `brightness` 0 is the set
## off, the dark glass alone. `size_mm` the glass's size for the pitch (zero: the mesh's own). Your material comes
## back when it's removed and before every save.
@tool
@icon("res://addons/horrorstudio_look/icons/crt.svg")
class_name HSCrtScreen
extends HSOnMesh

@export var picture: Texture2D = null
@export_range(0.0, 4.0) var brightness: float = 1.0
@export var tint := Color(1.0, 1.0, 1.0)
@export var size_mm := Vector2.ZERO
@export var surface: int = -1                              ## the surface it goes on; -1 the whole mesh
@export_range(0.1, 2.0) var pitch_mm: float = 0.3
@export_range(60.0, 1200.0) var scan_lines: float = 240.0
@export_range(0.0, 1.0) var scan_dark: float = 0.55
@export_range(0.0, 1.0) var phosphor: float = 0.6
@export_range(0.5, 4.0) var scale_up: float = 1.0        ## 1 true size; more: a coarser, stronger look
@export_range(0.0, 0.3) var curve: float = 0.08
@export_range(0.0, 30.0) var border_mm: float = 6.0
@export_range(0.0, 1.0) var bleed: float = 0.35
@export_range(0.0, 1.0) var flicker: float = 0.5
@export_range(0.0, 1.0) var roll: float = 0.3
@export_range(1.0, 30.0) var roll_secs: float = 7.0
@export_range(1.0, 8.0) var fade_px: float = 3.0
@export_range(0.0, 1.0) var glass: float = 0.5
@export_range(0.02, 0.5) var roughness: float = 0.12
@export var seed: float = 1.0
var materials: Array = []                                  ## the material on each mesh
var _surf_was: Array = []                                  # [mesh, surface, its own override] put back by _unapply


func _settings() -> Dictionary:
	return {"picture": picture, "brightness": brightness, "tint": tint, "size_mm": size_mm, "surface": surface, "pitch_mm": pitch_mm,
			"scan_lines": scan_lines, "scan_dark": scan_dark, "phosphor": phosphor, "scale": scale_up, "curve": curve, "border_mm": border_mm,
			"bleed": bleed, "flicker": flicker, "roll": roll, "roll_secs": roll_secs, "fade_px": fade_px, "glass": glass, "roughness": roughness, "seed": seed}


func _params() -> Dictionary:
	var s := _settings()
	s.erase("size_mm")
	s.erase("surface")
	return s


func _apply(ms: Array) -> void:
	materials = []
	_surf_was = []
	for mi in ms:
		var sz := size_mm if size_mm != Vector2.ZERO else HSCrt.size_of(mi)
		if surface >= 0 and mi.mesh != null and surface < mi.mesh.get_surface_count():
			_surf_was.append([mi, surface, mi.get_surface_override_material(surface)])
		materials.append(HSCrt.screen(mi, sz, _params(), surface))


func _unapply() -> void:
	for w in _surf_was:
		if is_instance_valid(w[0]) and w[0].mesh != null and w[1] < w[0].mesh.get_surface_count():
			w[0].set_surface_override_material(w[1], w[2])
	_surf_was = []
	materials = []
