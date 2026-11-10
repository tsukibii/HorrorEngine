@tool
@icon("res://addons/horrorstudio_devices/icons/laptop.svg")
class_name HSTerminalLook
extends Resource
## How the laptop's terminal looks (HSLaptop's `look`; the user, 2026-11-10: "the typical green matrix style terminal
## look"): green phosphor on black, one pixel font, frames of thin lines, the things' models in the same green, the
## code's rain behind it all and on its own when nobody's at it; on the glass the scanlines, a glow and a flicker.

@export var ink := Color(0.25, 1.0, 0.45)          ## the words and the lines
@export var dim := Color(0.09, 0.47, 0.2)          ## quieter: frames, hints, what can't be had
@export var faint := Color(0.03, 0.17, 0.07)       ## the rain's tails, a card's ground under the pointer
@export var paper := Color(0.0, 0.025, 0.01)       ## the screen's black
@export var hot := Color(0.8, 1.0, 0.84)           ## the brightest: the rain's heads, what's picked
@export var font: Font                              ## a pixel font (VT323, OFL, when empty)
@export_range(12, 64) var text_px := 30             ## the words' size, its picture 1024 pixels wide
@export_range(0.0, 1.0) var rain := 0.16            ## the rain behind the windows while you use it (0: none)
@export_range(0.0, 1.0) var rain_idle := 0.9        ## the rain on its own while nobody's at it
@export var glyphs := "0123456789ABCDEFXZ$#%&*+=<>?/\\|:;@!"   ## what the rain is made of
@export_range(0.0, 1.0) var scanlines := 0.22       ## the glass's rows
@export_range(0.0, 2.0) var glow := 0.6             ## the phosphor's glow round what's lit
@export_range(0.0, 0.2) var flicker := 0.02
@export var boot := true                            ## the boot's lines typed out the first time it wakes
@export var models_in_ink := true                   ## the things' models in the terminal's green (off: their own colours)


func font_or_default() -> Font:
	if font != null:
		return font
	return load("res://addons/horrorstudio_devices/fonts/VT323-Regular.ttf")
