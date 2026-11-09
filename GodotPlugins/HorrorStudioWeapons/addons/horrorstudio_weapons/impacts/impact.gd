@tool
@icon("res://addons/horrorstudio_weapons/icons/impact.svg")
class_name HSImpact
extends Resource
## What a shot does where it lands (DECISIONS 2026-11-09, latest: "if we shoot a wall we should visually see the
## effect and maybe a pbr mask to make it like pieces are missing from whatever was shot"). A shell kind names its own
## (HSShellType.impact); HSImpacts plays it. The plugin's: `impacts/pellet.tres` (a pellet's crater, dust and chips)
## and `impacts/explosive.tres` (a burst: a ball of fire, a scorched crater, a blast that pushes and hurts).
##
## The mark is a Decal with three maps made from one height field (tools/weapon_fx.py, `fx/<mark>_<n>_*.png`): its
## albedo the material under the surface where pieces are missing, its normal map leaning into the hole so the light
## finds its walls, its ORM's occlusion darkening the hole's depths; tinted by what was hit (HSImpacts.SURFACES: the
## Sound node's room surfaces, or a collider's `hs_surface` metadata). Dust and chips fly off in that surface's colours;
## metal throws sparks and keeps only a dent.

@export var title := "Pellet"
@export_group("Mark")
@export_enum("crater", "scorch", "none") var mark := "crater"   ## the decal's maps (fx/crater_* a pellet's, fx/scorch_* an explosion's)
@export var mark_size_m := 0.05                         ## its width: the chipped ring round the hole
@export_range(0.0, 1.0) var mark_jitter := 0.25         ## each one's size this much unalike
@export var keep := 180                                 ## the most marks kept in the world (the oldest go)
@export var embers_s := 0.0                             ## how long its embers glow (the scorch's emission map), 0 none
@export var embers_energy := 2.5
@export_group("Debris")
@export_range(0, 64) var dust := 6                      ## puffs of the surface's dust
@export_range(0, 64) var chips := 5                     ## bits of it thrown off (wood: splinters)
@export_range(0, 64) var sparks := 3                    ## sparks off it, times the surface's (metal throws the most)
@export var debris_speed := 1.4                         ## how hard the bits fly (m/s)
@export var debris_scale := 1.0                         ## how big the dust and bits are
@export_range(1, 32) var debris_max := 6                ## a shot's impacts with debris of their own (marks for all)
@export_group("Blast")
@export var radius_m := 0.0                             ## an explosion's reach (0: none): what's in it pushed, told and hurt
@export var power := 0.0                                ## its push at the middle
@export var damage := 0.0                               ## its hurt at the middle, nothing at the edge (shot(info).damage)
@export var fireball: HSMuzzleFlash                     ## its ball of fire (an HSMuzzleFlash laid out as a BURST): its light, sparks and smoke too
@export var light_energy := 0.0                         ## the fireball's light
@export var shake := 0.0                                ## the view shaken this much (degrees) right beside it, less with distance
@export var shake_m := 8.0                              ## felt this far
@export var noise := 0.0                                ## how loud it is to listeners (noise.gd: a run 1)
@export var ring_secs := 0.0                            ## the ears ringing near it (the Fear node's)
@export var sound: AudioStream                          ## its sound (none: the plugin's shell_burst for a blast)
