@tool
@icon("res://addons/horrorstudio_weapons/icons/shell_type.svg")
class_name HSShellType
extends Resource
## A kind of shell (DECISIONS 2026-11-09, latest: "different types of particle effects depending on the type of shell
## the player uses, so make sure its easily expandable"): what it fires, how the muzzle flashes with it and what it
## does to what it hits. The plugin's two, `shells/buckshot.tres` (the normal one) and `shells/explosive.tres`, are a
## start: duplicate one, change it in the Inspector, and put it in a gun's `kinds` (and in a pickup's `shell`).
##
## And two for fun, easter eggs to hide in a game (DECISIONS 2026-11-11: "a couple of new goofy ammo types ... just
## some fun easter egg ones"): `shells/heart.tres` (love hearts: a pink puff and hearts out of the muzzle, a heart
## printed where each lands and hearts floating up from it; it hurts nobody, and someone hit is smitten: `touch`
## "charm") and `shells/water.tres` (a spray of water: splashes, wet patches that run down a wall and dry; it hurts
## nobody, soaks who it hits, `touch` "soak", and puts out embers and candles). A gun doesn't take them until a box is
## picked up (HSWeaponPickup's `shell`) or they're put in its `kinds`. A harmless kind is one whose `damage` is 0: what
## it hits is pushed and marked as its impact says, but never wounded, counted as shot, dented or broken.
##
## The gun keeps every shell's kind as it goes: the tube's in order, the chamber's, each of the double's barrels', the
## pocket's by kind. A shot is the chambered shell's: its pellets, its muzzle flash, its impact.

@export var id := "buckshot"                            ## its name in the pocket and the saves (unique)
@export var title := "Buckshot"                         ## its name for the player
@export_group("Shot")
@export_range(0, 64) var pellets := 0                   ## what it fires (0: the gun's own `pellets`; a slug 1)
@export var spread_scale := 1.0                         ## times the gun's cone (a slug's tighter)
@export var reach_scale := 1.0                          ## times the gun's reach
@export var push_scale := 1.0                           ## times the gun's push on what moves
@export var damage := 1.0                               ## each pellet's, to what it hits (shot(info).damage); 0: harmless (nobody's wounded, nothing counts as shot, dented or broken)
@export var recoil_scale := 1.0                         ## times the gun's kick
@export var noise_scale := 1.0                          ## times the gun's loudness to listeners
@export var ring_scale := 1.0                           ## times the gun's ringing in your ears (0: none)
@export var fire_sound: AudioStream                     ## its own shot's sound (none: the gun's blast)
@export var touch := ""                                 ## what it does to someone it hits besides its damage, a word HSHitReact knows: "charm" (smitten: hearts over her head, stood still a moment), "soak" (startled, dripping, her skin wet); any other word only reaches her `touched` signal
@export_group("Looks")
@export var muzzle: HSMuzzleFlash                       ## how the muzzle flashes with it (none: the muzzle's own)
@export var impact: HSImpact                            ## what each pellet does where it lands (none: the plugin's pellet)
@export var model: PackedScene                          ## the shell (none: the gun's shell_model)
@export var spent_model: PackedScene                    ## its hull once fired (none: the gun's spent_model)
@export var color := Color(0.93, 0.89, 0.82)            ## its marks in the shells' row (the normal one the HUD's own colour)
