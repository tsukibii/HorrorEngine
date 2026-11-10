@tool
@icon("res://addons/horrorstudio_weapons/icons/break_kind.svg")
class_name HSBreakKind
extends Resource
## What a thing is made of, for HSBlowUp: how it breaks when it's shot (docs/research/breaking_props.md). The plugin's
## (`blowup/kinds/`: ceramic, glass, wood, metal, cardboard, plastic, stone) are a start: duplicate one, change it in
## the Inspector, and give it to an HSBlowUp's `kind`.

@export var id := "ceramic"                             ## its name (the plugin's sounds are sounds/break_<id>.ogg)
@export var title := "Ceramic"
@export_group("Breaking")
@export var strength := 1.5                             ## a shot's damage that breaks it (a buckshot pellet's 1, an explosive's blast up to 6); shots that don't wear it down, 2.5 times this in all
@export_range(2, 64) var pieces := 18                   ## how many pieces it's cut into, for a thing 25 cm across (fewer for a smaller one)
@export_range(0.05, 2.0) var coarse := 0.35             ## how big the pieces away from the hit stay, of its size (small: it shatters; big: it breaks in two or three)
@export_range(0.0, 1.0) var grain := 0.0                ## 0: cut any way; 1: along its longest side (wood: splinters)
@export var crumple_m := 0.0                            ## its pieces crumpled this much (metal, card)
@export var dent_m := 0.0                               ## each pellet that doesn't break it dents it this deep (0: none)
@export var dent_r_m := 0.025                           ## the dent's radius
@export var hollow := false                             ## its inside is air (a kettle, a box, a bottle): a cut through it is never filled, the inside of its wall is drawn instead (false: filled, as a mug's wall or a block of wood)
@export_group("Flying")
@export var speed := 3.0                                ## m/s, the pieces nearest the hit (slower away from it)
@export var spin := 14.0                                ## rad/s at most
@export_range(0.0, 1.0) var bounce := 0.2
@export_range(0.0, 1.0) var friction := 0.7
@export var areal_kg := 10.0                            ## a square metre of its surface's mass (its pieces' weight)
@export_group("Inside")
@export var inside_color := Color(0.86, 0.82, 0.75)     ## the broken faces' colour
@export_range(0.0, 1.0) var inside_from_surface := 0.0  ## the broken faces' colour taken from the thing's own this much (plastic whitened where it breaks)
@export_range(0.0, 1.0) var inside_roughness := 0.85
@export_range(0.0, 1.0) var inside_metallic := 0.0
@export_range(0.0, 1.0) var fibres := 0.0               ## lines along the grain in the break (wood, card)
@export_range(0.0, 1.0) var speckle := 0.3              ## grit in it (stone, ceramic)
@export var see_through := false                        ## glass: its pieces' broken faces see-through
@export_group("Debris")
@export_range(0, 64) var dust := 10                     ## a puff of it where it's hit
@export var dust_color := Color(0, 0, 0, 0)             ## (alpha 0: the inside's colour)
@export_range(0, 96) var chips := 14                    ## bits too small to be pieces
@export_enum("chip", "splinter", "glint", "paper") var chip_style := "chip"
@export_range(0, 64) var sparks := 0
@export var surface := "ceramic"                        ## what HSImpacts calls it: the marks and dust a pellet leaves on it and its pieces
@export_group("Sound")
@export var sound: AudioStream                          ## its breaking (none: the plugin's sounds/break_<id>.ogg)
@export var clink: AudioStream                          ## a piece landing (none: sounds/debris_<id>.ogg)
