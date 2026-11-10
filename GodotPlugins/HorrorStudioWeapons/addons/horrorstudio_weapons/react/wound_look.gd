@tool
@icon("res://addons/horrorstudio_weapons/icons/wound.svg")
class_name HSWoundLook
extends Resource
## How a character bleeds when it's shot, for HSHitReact: no blood (the user's), a demon's black ichor and dark smoke
## (docs/research/hit_reactions.md). The plugin's `react/looks/demon.tres` is a start: duplicate it, change it in the
## Inspector, and give it to an HSHitReact's `look` (a pale ghost's, a shadow's...).

@export var title := "Demon"
@export_group("Ichor")
@export var ichor_color := Color(1, 1, 1)               ## times the ichor's maps (white: as drawn, black with a dark oxblood film; fx/ichor_*)
@export var embers := 2.5                               ## the flecks in fresh ichor glowing (0: none)
@export var embers_s := 4.0                             ## how long they smoulder
@export var wound_m := Vector2(0.07, 0.12)              ## a wound's size on her
@export var splat_m := Vector2(0.32, 0.65)              ## the spray behind her, by the shot's power (and wider the farther it flew)
@export var splat_reach_m := 2.6                        ## how far behind her the spray reaches a wall or the floor
@export_range(0, 32) var drops := 6                     ## heavy drops flung out each shot, each a splash where it lands
@export_range(0, 96) var spray := 26                    ## fine droplets flung out of a wound
@export var pool_m := 0.9                               ## the pool left where she went (0: none)
@export_range(1, 400) var keep := 60                    ## the ichor marks that stay (the oldest go)
@export var evaporate_s := 0.0                          ## the marks fade after this (0: they stay)
@export_group("Ooze")
@export var ooze := true                                ## the ichor as a living liquid (HSOoze: it spreads, drips, glistens, beats); off, or on a renderer other than Forward+: flat decals from fx/ichor_*
@export var ooze_film := Color(0.12, 0.014, 0.022)      ## where it's thin (its edges, the tendrils, a drip's trail): a deep oxblood
@export_range(0.0, 1.0) var ooze_sheen := 0.65          ## the oil's sheen in its highlight (violet, green, gold); 0: a plain black gloss
@export_range(0.0, 1.0) var ooze_gloss := 0.92          ## 1: a mirror (glints that crawl over it as its surface moves)
@export_range(0.0, 3.0) var ooze_mirror := 1.0          ## the room seen in it (the lit wall at its rims)
@export_range(0.0, 1.0) var ooze_pulse := 0.5           ## a slow double beat swelling it (0: still)
@export_range(0.0, 2.0) var ooze_crawl := 1.0           ## its surface moving
@export_range(0.0, 2.0) var ooze_reach := 1.0           ## a pool's tendrils reaching out
@export_range(0.0, 2.0) var ooze_drip := 1.0            ## how far drips run down a wall
@export_group("Smoke")
@export var wound_smoke: HSMuzzleFlash                  ## smoke out of each wound, trailing after her (none: react/ichor_smoke.tres)
@export var down_smoke: HSMuzzleFlash                   ## smoke pouring off her as she goes (none: react/dissolve_smoke.tres)
@export_range(0, 16) var bleed_wounds := 5              ## wounds smoking at once at most
@export_group("Going")
@export var char_color := Color(0.02, 0.016, 0.018)     ## her skin charring over
@export var char_edge := Color(1.0, 0.3, 0.06)          ## the char's burning edge
@export var char_edge_energy := 3.0
@export var dissolve_s := 2.4                           ## from the first char to gone into the smoke
@export_group("Sound")
@export var hit_sound: AudioStream                      ## a wound (none: sounds/ichor_hit.ogg: wet, heavy, a hiss)
@export var down_sound: AudioStream                     ## her going (none: sounds/ichor_down.ogg)
