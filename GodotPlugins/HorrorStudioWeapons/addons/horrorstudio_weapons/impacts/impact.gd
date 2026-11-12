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
## metal throws sparks. A shot's pellets are what a 12-gauge leaves indoors (docs/research/shotgun_damage.md): those
## landing within `merge_m` of each other run into one torn hole (`fx/blast_*`: at an arm's length the whole charge,
## a few metres out the pattern's middle, farther each pellet its own), the smoke blackens the wall round it within
## `soot_m` of the muzzle (`fx/soot_0`) and the powder's grains pepper it within `powder_m` (`fx/grains_0`), the wad
## leaves its own dent near the middle once it has left the shot (`wad_m`, `fx/wad_0`); on concrete, stone or steel
## the lead doesn't go in: a grey smear and chips (`fx/smear_*`).
##
## The easter egg shells' (DECISIONS 2026-11-11) leave the wall whole: `impacts/heart.tres` prints a pink heart where
## each lands (`fx/heart_*`, glowing a moment, fading away after `fade_s`) and floats `hearts` up from it;
## `impacts/water.tres` splashes (`droplets`, `mist`), leaves a wet patch that runs down a wall (`fx/wet_*`,
## `fx/wet_drip_*`) and dries, and puts out embers and flames within `douse_m`. Their `sound` plays once a shot.

@export var title := "Pellet"
@export_group("Mark")
@export_enum("crater", "scorch", "heart", "wet", "none") var mark := "crater"   ## the decal's maps (fx/crater_* a pellet's, fx/scorch_* an explosion's; on concrete, stone or metal a pellet's is fx/smear_*, a lead smear; fx/heart_* a printed heart and fx/wet_* a wet patch, on a wall fx/wet_drip_*: nothing of the wall missing, upright on a wall)
@export var mark_size_m := 0.05                         ## its width: the chipped ring round the hole
@export_range(0.0, 1.0) var mark_jitter := 0.25         ## each one's size this much unalike
@export var keep := 180                                 ## the most marks kept in the world (the oldest go)
@export var embers_s := 0.0                             ## how long its embers glow (the scorch's emission map; a heart's glow), 0 none
@export var embers_energy := 2.5
@export var fade_s := 0.0                               ## the mark gone after this long, fading over its second half (a heart, water drying); 0: it stays
@export_group("Together")
@export var merge_m := 0.016                            ## pellets landing closer than this run into one torn hole (a 00 pellet's hole is 8 mm: nearer, the bridge between two tears; 0: never, each its own)
@export_range(2, 16) var merge_min := 3                 ## how many it takes (fewer: each its own crater)
@export var soot_m := 0.4                               ## within this of the muzzle the smoke blackens the wall round the hole, darker and smaller the nearer (0: never)
@export var powder_m := 0.9                             ## within this the powder's grains pepper it, wider and fainter the farther (0: never)
@export var wad_m := Vector2(1.5, 5.0)                  ## the wad leaves its own mark near the pattern's middle this near to this far (nearer it goes into the hole; 0, 0: never)
@export_group("Debris")
@export_range(0, 64) var dust := 6                      ## puffs of the surface's dust
@export_range(0, 64) var chips := 5                     ## bits of it thrown off (wood: splinters)
@export_range(0, 64) var sparks := 3                    ## sparks off it, times the surface's (metal throws the most)
@export var debris_speed := 1.4                         ## how hard the bits fly (m/s)
@export var debris_scale := 1.0                         ## how big the dust and bits are
@export_range(1, 32) var debris_max := 6                ## a shot's impacts with debris of their own (marks for all)
@export_group("Spray")
@export_range(0, 64) var hearts := 0                    ## hearts floating up from where it lands (fx/heart.png)
@export_range(0, 64) var droplets := 0                  ## drops of water splashing off it
@export_range(0, 32) var mist := 0                      ## puffs of fine spray
@export var spray_color := Color(1.0, 1.0, 1.0)         ## their colour
@export var douse_m := 0.0                              ## what burns within this of it is put out: a scorch's embers, a prop's candle flame (the Look plugin's HSPropFX), anything in the group hs_flame with douse() (0: nothing)
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
@export var sound: AudioStream                          ## its sound (none: the plugin's shell_burst for a blast); without a blast, played once a shot where the pattern's middle lands
