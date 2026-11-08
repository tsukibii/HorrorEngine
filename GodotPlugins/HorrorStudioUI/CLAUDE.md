# HorrorStudio UI: notes for Claude

The studio's own Godot plugin for the HUD (DECISIONS 2026-11-08, ui-v3: the user, "the ui should be part of the godot
plugin for horrorengine"). It lives here, not in the exports: `storykit/godot.py` copies `addons/horrorstudio_ui/` into
every export, `tools/godot_director.py` into every Director project, `tools/godot_byhand.py` into every project made by
hand (all three enable its plugin.cfg). The runtime add-on (`tools/godot/addons/horrorstudio`) uses it by path
(`res://addons/horrorstudio_ui/hud.gd` etc.): a change here reaches every game on its next export. Needs the Look plugin
beside it (`HSLook`, in menu.gd).

## Map

| File | What |
|---|---|
| `hud.gd` | `HSHud`, the CanvasLayer: the corners (OBJECTIVE and TO DO resting at 74% and up to full for a few seconds on a change; rows kept between changes so a tick eases: the line drawn across, the row dimmed), the reticle (`Reticle`: a dot that opens into a ring, red and crossed when locked, an arc for a held use), the prompt, the footer (the line in a serif over a scrim, `who`, a choice on one line), the log's toasts, the timer, the stance's vignette, the chips of the keys, the inventory row (each slot a small SubViewport world; the band behind it a halo, the line under the hand's), a chapter card (a rule with the marker's diamond), cards (`panel`: only words, a halo, a veil), the fade. `standalone` (true by hand: project settings, no menu, `auto_markers`), `fade()` an ease kept on a node. Every ease is a tween on the node: `fade(n, a, secs)` returns null when it's there already |
| `marker.gd` | the guide marker's drawing and its numbers: `base_alpha(d)` (the nearer the clearer, a log scale: A_NEAR .9 inside 3 m, A_FAR .2 at 36 m, gone at 72), HIDDEN .55 out of sight, TAKEN .62 when the cursor is on it; `update(targets, cam, dt, ctx)` with ctx {seen, names, aimed}; `marks[id]` {k, d, seen, on, ptr, label, gem, above, top...}; the pointer on an ellipse, after a moment out of view; `mode` 0 off, 1 subtle, 2 clear |
| `quest_marker.gd` | `HSQuestMarker`: a Node3D in the group `hs_quest_marker` (`active`, `label`, `height`, `sight_mask`); the HSHud (`auto_markers`) feeds the guide from them |
| `theme.gd` | the four themes' colours, `box`, `make` (the glass themes' PanelContainer is a ghost: no fill, no border, no shadow), `serif` (a `SystemFont`) and `tracked` (letter-spaced) |
| `menu.gd` | the pause menu and the settings (`SETTINGS` rows with their Unreal names; Quest marker is `guide`): used when `standalone` is false |
| `typing.gd` | a thought typed out (`typed_at`, `glitched`) |
| `halo.gdshader` | a soft, edgeless dark behind a card's words (the desk's halo) |
| `plugin.gd` | the project settings `horrorstudio/ui/theme` and `quest_marker` |
| `demo/hudlab.gd` | the HUD alone over a picture and a JSON plan (see its header): seconds a picture, for designing; `demo/byhand_check.gd` the by-hand check |

## Checking it

`python tools/godot/ui_check.py [--pictures]` (GDUI, under a minute, headless): the Pilot exported and started with the HUD
driven from the runtime (the marker's strength by distance, by walls, its name, the pointer, the setting; the to-do's
rows, the corners' rest and fresh, the hint chips, the reticle, a card that is only words, the lines and the scrim, the
timer, the hidden vignette), then the by-hand half: a project from `godot_byhand.py new` with an HSHud and two
HSQuestMarkers. After a change also GDPLAY, GDTESTROOM (from `n_chores`: stations 6 and 13 need local Studio files),
GDEXPORT, DIRECTOR and FIRSTGAME.

## Rules (the user's, from the decisions that shaped it)

- **Flat, vector, one stroke; nothing glows or pops** (2026-11-02: "the duller version… more like a vectorish style";
  2026-10-30: a glow on the choice "breaks the horror immersion"). Every appearing and going is an ease.
- **No panels** (2026-11-08: "the glassmorphism panel actually removes some of the immersion… the panel isn't as
  noticeable and the text is there"): words, and a soft edgeless dark behind them where they must read; the inventory's
  row has no border. The `neumorph` and `plain` themes keep their surfaces (they are their look).
- **The player's eye is never moved for them** (2026-10-30) and no quick-time events.
- **The nearer the clearer, and still there through a wall** (2026-11-08): `base_alpha` is monotonic (GDUI holds it).
- **Two voices**: a serif for what people say and write (lines, answers, cards), the default sans for the game's own words.
- **A word the story format doesn't have is grown in the story format, the check and the runtime together**: nothing here adds one.
