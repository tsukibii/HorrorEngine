@tool
@icon("res://addons/horrorstudio_weapons/icons/flash.svg")
class_name HSMuzzleFlash
extends Resource
## How a muzzle flashes (HSMuzzle plays it; a shell kind names its own: HSShellType.muzzle). Duplicate one of the
## plugin's (`muzzle/buckshot.tres`, `muzzle/explosive.tres`) and change it in the Inspector: an HSMuzzle with
## `preview` on shows it frozen in the editor as you go.
##
## The flash is wings round the bore and a plume out of it, each wing a run of `wing_spheres` slightly elongated
## spheres that intersect (`stretch` along the wing, tapering to `taper` at its tip), their fronts culled; the shader
## maps a noise triplanar onto each sphere and burns it by the view's normal dotted with the surface's, so the spheres
## burn away from their rims inward: white-hot in the middle (`core_color`), orange (`mid_color`) and red (`edge_color`)
## where they burn out. Every shot's wings are a little different (`jitter`). After the flash: its light for a moment,
## sparks, a cloud of smoke thrown out with the shot and smoke trailing from the muzzle wherever it goes.

enum Layout { STAR, BURST }
enum Blend { SOLID, ADD }

@export var title := "Buckshot"
@export_group("Wings")
@export var layout := Layout.STAR                     ## STAR: the wings in a ring round the bore; BURST: anywhere within `wing_angle_deg` of it (a ball of fire)
@export_range(0, 16) var wings := 5                   ## the petals (a star seen from in front)
@export_range(0.0, 90.0) var wing_angle_deg := 76.0   ## each petal's lean off the bore's line (90: straight out to the side)
@export var wing_length_m := 0.13
@export_range(1, 12) var wing_spheres := 6             ## the intersecting spheres a petal is made of
@export var wing_radius_m := 0.028                    ## its first sphere's
@export_range(0.1, 1.0) var taper := 0.45             ## the tip's sphere over the first's
@export var stretch := 1.6                            ## each sphere elongated along its petal
@export_range(0.0, 1.0) var jitter := 0.35            ## each shot's petals unalike: their lengths, leans and turns
@export_group("Plume")
@export var plume_length_m := 0.34                    ## the tongue of fire straight out of the bore (0: none)
@export_range(1, 12) var plume_spheres := 7
@export var plume_radius_m := 0.045
@export var core_radius_m := 0.032                    ## the white ball at the muzzle (0: none)
@export_group("Fire")
@export var blend := Blend.ADD                        ## ADD: the spheres added up, white-hot where they overlap (a glow); SOLID: each pixel the nearest sphere's back, cut where it burns out (crisp, all orange)
@export var core_color := Color(1.0, 0.96, 0.8)
@export var mid_color := Color(1.0, 0.6, 0.18)
@export var edge_color := Color(0.72, 0.14, 0.03)
@export var energy := 2.0                             ## how bright (HDR: the glow takes what's over white)
@export var noise_scale := 0.9                        ## the noise's size on each sphere
@export_range(0.0, 1.5) var burn := 1.0               ## how much of the noise shows in the fire and eats its edges (0: smooth spheres)
@export_range(0.0, 1.0) var erode := 0.6              ## how much more is burnt away by the end of the flash
@export_range(0.0, 1.0) var tip_burn := 0.3          ## a wing's tip burns this much more than its root
@export var swell := 0.35                             ## how much the spheres grow over the flash
@export var life_s := 0.055                           ## the flash's life (a frame or three)
@export_group("Light")
@export var light_scale := 1.0                        ## times the muzzle's light_energy (a gun's flash_energy)
@export var light_color := Color(1.0, 0.72, 0.42)
@export var light_range_m := 9.0
@export var light_s := 0.05                           ## how long the light takes to fall away
@export_range(0.0, 1.0) var light_fog := 0.12         ## how much it lights the room's haze (1: as much as a lamp; a flash that lit it fully hung a ball of glow in the air)
@export_group("Sparks")
@export_range(0, 200) var sparks := 6
@export var spark_speed := Vector2(4.0, 9.0)          ## m/s, the slowest and fastest
@export var spark_spread_deg := 16.0
@export var spark_life_s := 0.14
@export var spark_length_m := 0.06
@export var spark_gravity := 3.0
@export var spark_color := Color(1.0, 0.72, 0.32)
@export_group("Smoke")
@export_range(0, 64) var puffs := 10                  ## the cloud thrown out with the shot
@export var puff_size_m := Vector2(0.06, 0.11)
@export var puff_grow := 3.2                          ## how much a puff grows over its life
@export var puff_speed := Vector2(0.35, 0.9)
@export var puff_life_s := 1.6
@export var trail_s := 1.4                            ## how long the muzzle trails smoke after the shot (0: none)
@export var trail_life_s := 2.2                       ## each bit of the trail's
@export var trail_width_m := Vector2(0.025, 0.14)     ## the trail's width where it leaves the muzzle and where it dies
@export var trail_rise := 0.07                        ## m/s up
@export_range(1, 5) var trail_strands := 3            ## the trail drawn as this many strands parting as they age: wisps, not a band
@export var trail_spread := 0.045                     ## how far apart the strands have drifted by the end of their life (m)
@export var trail_turbulence := 0.22                  ## the curl noise's drift on the oldest of it (m/s): it leaves the barrel straight and curls as it goes
@export_range(0.0, 1.0) var trail_erode := 0.55       ## how much it frays into wisps as it ages (docs/research/muzzle_smoke.md)
@export var smoke_color := Color(0.82, 0.8, 0.77)
@export_range(0.0, 2.0) var smoke_density := 1.0
@export_range(0.0, 1.0) var smoke_glow := 0.6                ## a light of its own, so it reads as grey wisps in a dim room as in the user's reference (0: lit by the room's lights only)
@export_range(0.05, 2.0) var smoke_light_cap := 0.5          ## the most light any one lamp gives the smoke: the next shot's flash beside it lights the cloud a glow, not a white ball (a lamp a metre off is far under it)
