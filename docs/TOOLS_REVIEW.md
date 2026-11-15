# The tools reviewed (2026-11-15, branch `enhancements`)

The user, 2026-11-15, early morning: *"Create a new branch called enhancements, do a review of all the tools we made
and work on enhancements on this new branch until 11am, I will review at the end."* And part way through: *"note dont
focus on the director tool, most games will be made directly using the horrorengine godotplugin."*

This is that review, and what the branch did about it. Each fix is its own commit, pushed, with the check that holds it.
What was found and not done is in §4, ranked, with what it would take. **After the user's note the work went to the
games built by hand with the plugins** (the starter kit, the Markers, UI, Devices, Weapons and Look plugins,
`godot_byhand.py`, the Animator and the Character Studio that feed them); the desk, the Director and the desk's
export were left as they were from then, and their findings are at the end of §4.

## 0. The improvements by ID

The user, part way through: *"at the end can you show screenshots of all your improvements with id references so if I
decide to undo some i can ref what i want removed"*. Each commit is an ID, oldest first; a letter is one part of a
commit (taken out by hand, where a whole ID is a `git revert`). The screenshots are a page on claude.ai (each ID's
picture: in the game or the page where there's something to see, else its check's output or its commit), made by
`tools/godot/enhance_shots.gd` (in tutorial v2's project) and headless browser runs.

| ID | Commit | What |
|---|---|---|
| E01 | 2be129f8 | `tools/browser_checks.py`: every browser check from one command, a report to paste back |
| E02 | 3252c511 | `setup/setup.py doctor`, in place of the launcher's dead Find Unreal row |
| E03 | 372ba813 | Character Studio: unsaved edits ask before they're lost; everything marks unsaved; Save keeps the touch-up |
| E04 | b0249430 | a failed Godot run exits 1; the dashboard reads FAIL |
| E05 | 8dd87b19 | FROMDESK builds in `_check`; `from-desk --force` keeps the old project |
| E06 | 642c2b0d | the export's receipt records only what it wrote: a re-export keeps your edits |
| E07 | 83c87bb7 | hair editor: a fringe's kind brings no old numbers; Show the pores wears nothing |
| E08 | fc861fdf | a whole look after an eye look is that look |
| E09 | cea69c27 | by hand: dying puts the world back (`hs_keeps`); a blow is a scare |
| E10 | f7738a29 | a: the story CLIs say what's wrong; b: the dashboard's Animator tile back |
| E11 | 937baf1a | scene builder: undo per level, leaving asks, Ctrl+S; `layoutset.mjs` keeps a set's levels |
| E12 | 0f5364f2 | which characters want baking again (`ANIMATOR_VERSION`, `bake.mjs --status`, `--rebake`) |
| E13 | 2f09fd9b | a: spot lights aimed in the export; b: `sfx.py add` wants tags; c: `pbr-add` a zip; d: the street bake keeps made sets; e: no Unreal tooltips for players; f: dead launcher rows out |
| E14 | 735b2073 | a: writers' room Build again asks; b: the desk's delete keeps the story whole; c: rename, New asks; d: REFS |
| E15 | 1475e04b | a: your outfits' pictures never a preset's; b: hair styles not written over |
| E16 | f8b50608 | a doorway under 0.75 m is a warning (level_check, the builder's Check) |
| E17 | 3f2e0ac1 | the Godot export says what it went without (`export.json` warnings) |
| E18 | b647b010 | the Animator: a finger's own curl (groundwork, no clip uses it) |
| E19 | 316c6fa1 | by hand: E's prompt and ring on the HSHud |
| E20 | abf2e6c9 | a: the Studio opens your last character; b: the export guide's first scene past a choice |
| E21 | 99963577 | Godot: a Japanese line as long as on the desk |
| E22 | 5ae6a879 | a: the desk's Edit as text takes a shot off; b: pasted answers lose dangling jumps |
| E23 | c2ded860 | by hand: a: a key isn't a step (layer 2); b: act.gd's flag a switch in the Flags tab; c: install keeps your plugins, says `--starter`; d: the guides |
| E24 | 057c75de | by hand: saves (`save_game`, `load_game`, autosave, continue, F5 and F9; `hs_saves`) |
| E25 | 0c023848 | the laptop's shop and parcels kept at a checkpoint and in a save |
| E26 | f4a08c7a | a scare added after the start is heard |
| E27 | 82c5efc5 | TUTORIAL2 compares the ready-made floor without the made sets' names |
| E28 | 925e89bc | TUTORIAL_TODO: the earlier branches' TUTORIAL2 runs ticked |
| E29 | 9137c7c9, ee40b520 | by hand: a: the pause menu (`starter/pause.gd`, Load game, Set up the scene); b: its controls the game's own keys |
| E30 | 1188d3eb | the gun in a save |
| E31 | bb93e08b | PARSE in check_all: every runtime script of the by-hand plugins and the starter loaded by Godot, every preset instanced |
| E32 | 9854591e | a hunt in a save: running at its stage, or over and not started again by its needs |
| E33 | a6d7a0b0 | the pause menu by hand shows only the settings that work there; Brightness on the scene's environment |
| E34 | 8e462467, 3ea77121 | the Story's `use_hud` (off by default): its objective, list and lines on the HSHud |
| E35 | f02e6f73 | the UI plugin's card (HSSplash, "[Artist] presents") and main menu (HSTitleMenu); the Story loads the save the menu picked |
| E36 | 7ca2cf07 | `tools/horror_game.py`: a new horror game in one command, named, ready to play (the card, the menu, a room) |
| E37 | 0f2898fe | Continue and Load game open the scene a save was made in (a game of several scenes) |
| E38 | ac7374dc | A game by hand as it ships: Godot's export emptied every list in its scenes; faces, a character's looks and Kimodo motions found in the pack; ready export presets |
| E39 | f09bf784 | What the shotgun breaks kept at a checkpoint and in a save: a lamp shot out lit again when you die, a mug blown up whole; both still broken after a load |
| E40 | 2ec46af4 | Inspector tooltips for 101 of the Look plugin's node fields (light zones, flicker lights, the character look, the grade, wet surfaces, rain, the storm, CRT screens, blood, panes, puddles, leaks, breath) |
| E41 | a00ff660 | The rest of the Look plugin's tooltips (63): every exported field in it now says what it does |
| E42 | bc07052f | Tooltips for the card and the main menu (E35's), and the starter's hunt, cue and sanity (35 fields) |
| E43 | 833f60fb | `horror_game.py new "Name" --artist "Your Studio"`: the card says your studio's name from the start |
| E44 | eabd2517 | Tooltips for five more starter scripts: the dread moment, the searcher, gaslight, the scare area and the door (40 fields) |
| E45 | 633bc0cf | Tooltips for nine more starter scripts: the director, presence, the chase, feet under the door, the event area, the flashlight, the glimpse, the hunt spot, the sound (48 fields) |
| E46 | 4a3f60c9 | Tooltips for the Markers' and the Devices' last bare fields (17): a marker's kind and stay, the laptop's words and view, the parcel's sounds |
| E47 | 4f5cda94 | The starter kit's last tooltips (41): every exported field in it says what it does |

## 1. How it was done

- **A baseline first.** On main as it was (after tsukibii/HorrorEngine#33), every offline check (`check_all.py`: CHECKS
  ok, 5 min) and the Godot checks a change to the by-hand side needs (GDPLAY, MARKERS, GDMOTION, GDMOTION3, GDSMALL,
  GDLIFE, SEQUENCES, LOGIC) were run here: all green. So everything below was found by reading and probing, not by a
  red check (REFS, a desk check, was the one already failing: §3.1).
- **Six reviews across the 211 launcher tools**, each reading its area's code with a brief to find real bugs (with the
  input that breaks them), stale things, friction for someone who isn't a programmer, and enhancements small enough to
  build and check here: the story pipeline (the desk, the writers' room, the dashboard and launcher, the story CLIs);
  the Character Studio (the page, the tailor, the salon, the hair editor, the clothing library); animation and faces
  (the Animator, Kimodo, the face capture and its exports); world building (the scene builder, the kit, the street
  builder and paint, the prop generator, the PBR shelf, the sounds); Godot by hand (the starter kit, the Markers, UI,
  Devices and Weapons plugins, `godot_byhand.py`, the guides); the Godot export, the Director and the Look plugin's
  nodes.
- **Every finding was checked again before it was fixed**: read in the code, then reproduced (a probe, a headless
  run, a made-up story) where it could be, and the fix held by a check that fails on the old code where one could be
  written (said in each commit).

## 2. What the tools are like

Strong where it matters: "text is the truth" is real (story.json, sets, streets and recipes are the source; every
save keeps its history; the desk merges by id). The logic of the pages lives in plain modules that node can test
(merge, refs, clipboard, flowedit, screenplay, the kit, the Animator's core), and almost every tool has a check with
numbers in it. Bakes are deterministic. Every Godot script in the plugins and the starter kit parses on 4.7 and every
Look preset loads. The guides are made from the real thing.

Weak in three ways, the same in most tools:
1. **Losing work without a word.** Pages that replace what's shown (another character, another level, a New, an
   Import, a Build again, a re-export into the same folder) mostly didn't ask, and a few wrote over files they didn't
   own (preset pictures, a set's other levels, the user's own Director project). Most of what this branch fixed is
   this.
2. **Failing quietly.** A failed Godot run exited 0 and the dashboard showed it green; the export turned a failed
   kit build into boxes with no word; a blow that should scare reached nobody; a bake two versions old played
   without its new clips and nothing said so.
3. **Unreal left behind.** Two weeks after it was removed, players still saw "Unreal: IA_Move" in the pause menu's
   tooltips, and the launcher had rows that ran nothing (`setup.py env`) or only worked on Windows.

## 3. Done on this branch

### 3.1 Data you could lose

| Where | What was wrong | Now | Held by |
|---|---|---|---|
| Character Studio | Another character, New and Import replaced unsaved edits without asking; `open()` never cleared the flag; Feminine/Masculine, both Resets, Wear it, a garment's ×, an outfit, a dragged handle and the photo skin didn't mark anything unsaved; the main Save and Export skipped the touch-up (the export's skin had the strokes, its recipe didn't) | They ask (`dirty()`: settings, touch-up, layers, salon); all of those mark it; Save and Export save the touch-up; both Resets ask | probed in the page (a headless run on scratch characters); `window.__unsaved()` for checks |
| Character Studio | My outfits' pictures were named as the presets' are, in the presets' folder: "Cardigan and skirt" wrote over a tracked preset picture, deleting it deleted the preset's, a Japanese name wrote `thumbs/.jpg` | `mine_<name>.jpg` (a hash for other letters), a preset's name in any case refused, a preset's picture never deleted; the hair editor's Save as my style takes a Japanese name and won't write over a style with a name like it | WARDROBE |
| Scene builder | Undo's snapshots held no level and nothing cleared them: open another level or game, Ctrl+Z, and the last level's rooms came back under the new name for Save to write there; no leave-page guard; the game picker didn't ask | Snapshots carry their level; opening a level or game starts the history again; the picker and leaving ask; Ctrl+S saves | BUILDER |
| `layoutset.mjs` | Replaced a set's every level with the one it makes, and the page's edits to that level with it | Keeps the other levels; writes nothing (without `--force`) when the layout doesn't make what the set has, naming it; a bad layout names its problems instead of a TypeError | every preset and both layout files dry-run clean; a made-up edit refused |
| Writers' room | A Build again from the session that built the game went over the desk's story without asking (the force box came ticked) | The Build records its story's sha1; over a story changed since it refuses unless the new "replace the desk's edits" box is ticked (`room.py build --replace`), the story going into history first | WRITERS (build, edit, refused, replaced), WRITERSPAGE |
| Godot export | The receipt hashed every file in the folder after a merge: the next re-export overwrote your kept edit and deleted your own new files | It records only what the export wrote | GDEXPORT (a third export with a file of your own: fails on the old code) |
| FROMDESK | The pre-push check built in `Saved/Godot/Pilot_director`, the project the launcher makes for you to work in, deleting it first | Checks build in `Saved/Godot/_check/`; `from-desk --force` keeps the old project aside as `<Game>_director.old-<time>` | FROMDESK |
| Devices plugin | A parcel unboxed after a checkpoint was freed and dying took what came out of it back out of the pocket; the laptop kept nothing, so a thing bought since (a stock-1 shotgun) stayed sold out with the cash given back: with a lethal hunt, a game you couldn't finish | The laptop joins the checkpoint (`hs_keeps`): what's sold and seen, its orders on their way, the parcels it's left (shut, or kept open) come back as they were; a parcel placed by hand is hidden once unboxed and shut again by a checkpoint from before; both are in a save | LAPTOP's dying and save steps (fail on the old code) |
| Starter kit | Dying put back the pocket, flags and tasks but not the world: a key taken after the checkpoint stayed hidden with its reach box freed (the door it opens never opened again); a once-only area, scare, cue, flag switch or act never fired again; a checkpoint kept while seated stood you on the mattress | A checkpoint keeps the world: every node in the group `hs_keeps` gives `keep_state()` and gets `put_state()` (pickup, food, note, flag switch, act, event area, scare area and what it hid, cue, shown); seated, where you stood | LOGIC's checkpoint stage (fails on the old kit) |
| Desk | The Inspector's Delete left the card in its act and every arrow into it pointing at nothing (the story check failed); Rename left a death's retry on the old id and took any id; New didn't ask about unsaved edits; the Database's rename of a cast member missed `beam`, `lit`, `flashed` (REFS failed on main) | One delete for the board and the Inspector (`flowedit.removeCard`: arrows into it cut to stubs, out of its acts; the start, a card a choice reads the result of and one a death retries from refused with why); `renameCard` moves every use and refuses a bad or taken id; New asks | DESK (both on TestRoom001), REFS, CMDS |
| Desk | Edit as text couldn't take a shot off a line (it came back from the line before); pasted lines kept their answers' jumps to lines that weren't copied | A shot taken off goes (a pov shot, which the words never show, stays); a jump out of what was copied is dropped | DESK |

| A game by hand, exported | **Godot 4.7's export, converting a scene's text to binary, left out every `PackedStringArray`** (measured in the pack it exports: the Story's tasks and flags, the HUD's keys, a note's `add_tasks`, and so every Logic's and marker's lists): the game as it ships had no to-do list and no key chips. A Studio character's eye, hair and skin records were read from her `.glb`'s own file, which isn't in an export (only what Godot imported is); the Markers' face clips read as text are binary there; HumanShaders' micro detail was listed by file name (`x.png.import` only, there); a Kimodo `.npz` was opened by a path made from res:// (nothing on disk in a pack) and isn't exported unless a preset names it | By-hand projects keep text resources as text in an export (`godot_byhand.py`: new ones, and `install`/`update` on old ones); the records are read off the imported materials' `extras` first (`HSEye.material_records`); faces and micro detail listed and loaded through the resource loader, with the face clip's script put in every by-hand project; `.npz` by its res:// path; `new` writes `export_presets.cfg` (Linux, Windows) naming `*.npz`, and `install` adds it to a project's presets | HORRORGAME: the made game exported as a pack (no templates needed) and played in it, start to Load game, and `base_probe.gd` in it |

| Weapons plugin | A lamp shot out (HSShootable's `lights_out`) or a thing blown up (HSBlowUp) stayed so when you died at a checkpoint from before (a lamp a puzzle needs, dark for good), and a save made after didn't hold them: loaded, they were whole again | Both are in the starter Story's world (`hs_keeps`): whole again when you die, broken at once and quietly (no sparks, no pieces) when a save that has them broken is loaded | WEAPONS' new `weapons_keep_test.gd` (the old scripts fail it) |

### 3.2 Things that failed quietly

- **A failed Godot run exits 1** (`godot_export.py --play`, `--testroom`, `--cull`, `--pictures`, `--shot` exited 0),
  and the dashboard reads `FAIL` as well as `FAILED`.
- **A blow on the player is a scare**: it was a method call nobody has; the Fear node, the director and Sanity listen to
  `scared` signals. GDMOTION3 has a real Sanity node hear it (1.00 to 0.94).
- **Which characters want baking again**: Godot's `motion.gd` warned only under version 2 while the bake was at 5, and the
  Markers never did. Both carry `ANIMATOR_VERSION` (ANIMATOR holds it to the bake's `VERSION`) and say what she plays
  without. `node tools/animator/bake.mjs --status` lists every exported character by version and the ones exported
  again since their bake; `--rebake` bakes them with their last settings.
- **The Godot export says what it went without** (a kit build that failed or had no node, a character's face shapes,
  the story's expressions, a DirectX normal map): printed and kept in `export.json`'s `warnings`.
- **Japanese lines are as long in Godot as on the desk**: Godot's `ja_secs` had no half second of breath and counted
  other characters its own way (3 s short over the Pilot's seven lines, though the bake is mapped line by line).
  GDEXPORT holds the two the same on the games' own lines.
- **A key on the floor was a step**: a pickup's and a note's reach boxes were solid on collision layer 1, so the
  player stepped up onto a key and a character's floor rays lifted her over it. They're on layer 2 now, as a seat's
  and a Logic's are: only E's aim finds them.
- **The Flags tab misread an act**: `scan.gd` took `act.gd`'s `flag` ("+a, -b") as one flag turned on; it's a switch.
- **`godot_byhand.py install`** switched back on a plugin you'd turned off, and never said the project's `starter/` was
  older than the plugins want: it keeps your choice now (a record of what it offered) and says when to `--starter`.
- **A scare added after the start was never heard** by the Fear node or the night's director (they hooked the group
  `hs_scare` once), and Sanity, which looked round every 2 s, missed one in its first two seconds: all three hear a
  node added since (SANITY: 0.00, 0.00, 0.00 on the old kit).
- **TUTORIAL2 failed on any fresh checkout** with nothing wrong: a made set's name hashes its sets' file times, so the
  tracked ready-made floor named other made sets than a fresh export here. It compares without those names now, and
  the whole tutorial was played on this branch: TUTORIAL2 ok.
- **A doorway too narrow for the characters' clips** (under the rules' 0.75 m) is a warning in `level_check` and the
  scene builder's Check: 16 of the sets' doors are 0.70 m (left as they are: the user's call, §4.4).
- **The story CLIs**: `story.py flow` printed a traceback on any cut flow (the view CLAUDE.md says to read stories by);
  `show`, `new`, `new-set`, `durations` with nothing after them, an unknown command, and `story_check` on a story with
  no `format` all crashed or read as ok.

### 3.3 Smaller fixes

- The Animator: `--preview <file>` found its file, a furniture size in centimetres (`--seat 45`) is refused, a bake is
  written whole or not at all; `ringOf` (and Godot's `ring_of`) left the damping out of the pull (a damped thigh said
  4.34 Hz where it rings 4.03: now within 1%, a damping-9 case added); a name in other letters opens in its page; a
  failed poll gives Bake back; the page's help says how to bake again.
- The hair editor: a fringe's kind brought the last kind's numbers with it (a curtain after a choppy fringe kept its
  closed parting); Show the pores put the v2 hair on a character without asking.
- Whole looks after an eye look (Eyes v3) kept its catchlights and cool whites under them: the eye look is taken off
  first now (EYELOOKS holds every look after every eye look).
- Export for Godot: patterned spot lights all pointed level and north (turned to their targets now, no empty node).
- `sfx.py add` wanted no tags (the shelf's check then failed) and wrote over a name silently; `propgen.py pbr-add` with a
  `.zip` never worked; a street bake's clean-up deleted the made sets the games and sets paint with (21 of them).
- The dashboard's Animator tile had gone (v3 lengthened its label); `check_all` printed two sets as `set:school_c`.
- The Character Studio opened the alphabetically first character, on the user's machine a check's `_` scratch one: it
  opens the one you had open last, else the first that isn't a check's.
- The export guide's first scene stopped at a choice (it followed `next`; a choice's options carry `to`).
- The guides behind the code: godot_by_hand §2's folders and plugins, after a pull `install --starter`, its keys
  (Space, Tab, the held click, F7); first_game §6's tree and §10; the markers guide's install line.
- `story.gd` looked for an HSHud on every mouse move when the scene had none.
- Unreal: the pause menu's tooltips (Godot's UI plugin and the desk's Play), the launcher's dead rows (the script
  generator: DECISIONS 2026-10-27; Windows-only placeholder voices; the FBX retarget), RUN_LOCALLY's UEEYE row.

### 3.4 New

- **`python tools/browser_checks.py [NAMES]`**: every browser check in turn (26 of them), starting the desk, the Studio
  or the score room only when a check needs one and stopping what it started, on the card when `nvidia-smi` finds
  one, each check's output kept and a `report.md` to paste back (docs/RUN_LOCALLY.md's quick way; LATER.md had asked
  for it). In the launcher and the dashboard.
- **`python setup/setup.py doctor`**: what of the toolchain this machine has (Node, Playwright with its Chromium,
  Godot 4.7, Blender or its module, MediaPipe, Kimodo, a card...), what each is for and how to set it up. In place of
  the launcher's dead "Find Unreal" row.
- **E's prompt and ring over everything in a game built by hand**: the starter's player asks what it's aimed at ten
  times a second and puts the verb on the scene's HSHud (Open or Close, Take with the thing's label, Read with the
  note's title, Sit, Lie down, Hide, Use; Locked in red where a door's lock or a Logic says no). A conversation's own
  prompt comes first. `prompts` on the player turns it off; a script of your own says its words with `use_prompt(by)`.
  (FLAGS §9's first "later" item; tutorial v2 §34's "E's prompt".)
- **Saving a game built by hand**: it had none (a pause menu's slot is the desk export's, and by hand there's no pause
  menu). The Story's `save_game(slot)` writes a checkpoint kept where you stand to `user://hs_save_<slot>.save` as
  text, `load_game(slot)` puts it back as dying puts a checkpoint back, with no card: the tasks, flags, pocket (and
  what of it is eatable), cash, objective, doors and where you stood; the world (`hs_keeps`); and what keeps its own
  checkpoint, the new group `hs_saves` (`save_state`/`load_state`): the Markers' Logic nodes and characters, the Sanity
  meter, the flashlight's charge and spares. A pocket loaded into a fresh game gets its things' models from their
  pickups. The Story's Saving group: *Autosave* (each checkpoint written to slot 0), *Continue Saved* (slot 0 loaded at
  the start), *Save Keys* (F5 and F9). LOGIC's save stage (saved, played on, loaded; then loaded as if the game had
  just started) and SANITY's.
- **A pause menu for a game built by hand**: a Node called Pause with the starter's `pause.gd` beside the HSHud. Esc
  holds the game (the tree paused) and opens the UI plugin's own menu (the runtime's: the controls, Resume, Save game,
  Settings, Quit), now with a **Load game** row; Save game and Load game are the Story's saves (slots 1 to 3, the
  Autosave); Quit to title starts the scene again (or `title_scene`). Not while the laptop has you, dead, or after the
  ending. The desk's export passes the menu no save or load, so it's as it was. LOGIC's menu stage. Its controls are the
  game's own keys, and its Settings show only the rows that work by hand, Brightness on the scene's WorldEnvironment.
- **The gun in a save**: the weapons plugin's gun is in the save too (whether it's yours and up, its shells in each
  barrel and in the pocket by kind); a save loaded into a game where it isn't carried yet draws it up as it was.
  WEAPONS's save step (it found the double's chambers following `loaded`: a load recounts it).
- **A hunt in a save**: running at its stage and clock, quietly; or over, and not started again by what started it
  (its needs still hold: on a fresh game's load it started and ended at once, its line said twice). HUNT's save steps.
- **The Story's words on the HSHud**, a switch (`use_hud`, off): the objective, the to-do list and the lines in the UI
  plugin's corners and footer, the one look of its prompt, conversations and pocket; the Story's own hidden, their
  words kept for what reads them. LOGIC's hud stage.
- **A new horror game in one command** (the user's ask): `python tools/horror_game.py new "My Game"` makes a Godot 4.7
  project with every plugin, the starter, the sounds and three scenes: a black card ("[Artist] presents", Godot's own
  logo not shown), the main menu (Continue, New game, Load game, Settings, Quit: the UI plugin's HSTitleMenu) and a room
  to play with the player, the Story and its saves, the HUD and the pause menu; `update` keeps it current. HORRORGAME
  plays one from the card to a load.
- **PARSE, a Godot parse gate in check_all**: every runtime script of the by-hand plugins and the starter loaded by
  Godot 4.7 and every preset and prefab instanced (174 scripts, 89 scenes), about 40 s with its project kept; a parse
  error put into a starter script for the test was named and failed it.

## 4. Found and not done

Ranked within each part. Effort: S an hour or less, M a few hours, L a day or more.

### 4.1 Worth doing next (my order, for games built by hand)

1. **The HSHud's words by default (your call, S).** The Story's `use_hud` is built (E34) and off: one look by hand, the
   objective, the list and the lines in the HUD's corners and footer, is a switch. Turned on by default, tutorial v2's
   pictures want retaking; its pictures side by side are on the screenshots page. A note's card on the HUD's `panel`
   too would be the rest of it.
2. **What a save still leaves out (S each).** The night's director, a searcher or a chase start afresh (they're
   moments; each could join `hs_saves` as the hunt has).
3. **One helper for the Godot check harness (M).** `godot_bin()` is copied 18 times, the xvfb command built by hand in
   about 27 files, and only 9 scripts fail when Vulkan falls back to OpenGL (the others would measure on GL3). The kept
   check projects are about 6 GB with nothing pruning them.
4. **A Director project as it ships (S).** E38 measured Godot 4.7's export leaving out every `PackedStringArray` in a
   converted scene. The desk's export is safe from it: the Pilot exported as a pack (binary scenes, Godot's default)
   plays GDPLAY to its good ending, its story being data. A Director project's nodes carry lists in the scene and
   weren't tried: `godot_director.py` could keep text as `godot_byhand.py` now does (one line).
5. **The undo in the Character Studio (M).** Head, body, creature, eye-look and look cards, outfits and the Resets
   each change many settings in one click with no undo (the touch-up and the hair editor have one), and there's no
   save history on the server (the desk keeps 50).
6. **The launcher table checks itself (M).** `needs: desk|studio` on a row (26 rows need a server and only say so in
   words: the dashboard runs them and they fail), the tiles from the table, `launch.py --check` in check_all.
7. **Eating and drinking sat down, and the gestures** (L, the Animator's own list, ANIMATOR_V3 §9): a beckon, a wave, a
   point, a finger to the lips are the horror beats the small movements don't have. The per-finger curl they need is
   on this branch (`curls`, b647b010), with no clip using it yet.

### 4.2 Story pipeline, the rest (the desk: not the focus now)

- The writers' room paste doesn't remap a choice's `when.talk`.
- The new-game template has voice "ja", subtitles en+zh and `metahuman: None` (three warnings on a fresh game); three
  rules for a game's name (story.py now follows the desk's).
- A Database "new sound" is `SFX/<id>`, which nothing plays (only the shelf's `sfx/` and `res://` play).
- The desk's Godot button is one request for up to 40 minutes with no progress and no catch-all handler on the server.
- Docs: PIPELINE.md (the menu CLAUDE.md offers) still describes local-model drafts and Unreal; STORY_FORMAT links docs
  that are gone; DESK_REVIEW §3 items 3 and 4 are done but listed as open.

### 4.3 Character Studio, the rest

- Suspected races: an export right after a body change can carry the previous face fit (Save and Export don't flush
  `faceTimer` or await `FACEFIT` as Bake the face does); a see-through library garment is layered as opaque the first
  time it's worn (its texture isn't loaded when `opaque` is worked out).
- Unreal text in the salon and the page (`salon.js:1054`, `index.html:454`, `:2656`), `serve.py` working out an Unreal
  path for every PBR set, CHARACTER_STUDIO §3 and §3.1, TAILOR §3b/§4, SALON.md; `serve.py` names `creature_thumbs.mjs`
  (it's `creatures.mjs thumbs`).

### 4.4 World building, the rest (and one call for you)

- **Your call: the 16 doorways at 0.70 m** (hotel_floor's 304 bath door, the motel room's, eight in maison_1f, six in
  the bungalow). Widening them changes the sets (and hotel_floor's ready-made export); the warnings now say which.
- Exports: every map is PNG (hotel_floor.glb is 45.8 MB in git, 22 MB of it colour, ORM and AO that JPEG would
  quarter); the street export has no 2048 cap; `lit: false` lamps come on in Godot.
- "New one" on a walk-in building turns it into a shop; copy ↑ drops the rooms' paint; the prop page's clean-up can
  delete a queued job's recipe; `replan()` has no sequence number (an older plan can win).
- No page or CLI deletes or renames a level, a set or a street; the kit maker has no undo and doesn't warn when a seat,
  bed or door leaves the animation ranges (ANIMRULES fails later).
- Unreal text: the PBR page's "In Unreal" panel (its `sync_pbr()` is gone), `PBR.unreal_path`, the builder's grid and
  references hints, kit.html, the score room's render button, KIT.md §5, ASSETS.md §5.

### 4.5 Godot by hand, the rest

- The look plugin's own nodes keep nothing at a checkpoint or in a save (a kettle's life, a liquid's level, a lamp a
  scare switched off): each joining `hs_keeps` is S, as HSShootable and HSBlowUp now do (E39).
- Every exported field of the Look plugin has an Inspector tooltip now (E40, E41: a trailing `##` on the field's line;
  `godot --doctool DIR --gdscript-docs res://addons/horrorstudio_look` lists what each says). The starter kit's all have one (E42,
  E44, E45, E47). Still without one: 52 of the
  Weapons plugin's 295 (20 in HSMuzzleFlash); the Markers' and the Devices' all have one (E46).
- Docs: guides/tutorial_v2 is behind the starter (E's prompt, the world at a checkpoint, saves): its bulk update is
  its own branch, by the user's word, listed in docs/TUTORIAL_TODO.md. GODOT_LOOK §6 says `realism` is the default
  (it's `balanced`), has two §5d sections, and §7 a VoxelGI per room.

### 4.6 Godot export and Director, the rest (not the focus now)

The user, 2026-11-15: most games will be made directly with the plugins. These are kept for when the Director or the
desk's export is next worked on.

- A verb-parity check (M): `seq`, `stalker` and `shot` pass the story check and the palette offers them, but neither
  Play nor Godot runs them. Every word the check accepts should be registered in both, or listed as not yet.
- Lighting that survives a re-export (M): every export is a new version and hand lighting is copied across by hand; a
  `<level>.lighting.tscn` kept beside the game would be instanced by the next one.
- Its saves: the pause menu's slots hold `{where, secs, at}` and nothing loads them (the death snapshot, `snap_of`, is
  most of a save; the by-hand Story's `save_game` is the model now).
- The Director's id index never forgets deleted scenes; the Manager and the Story tab can overwrite each other (no
  stamp on the Manager's save).
- The pause menu's Voices, Motion blur, Textures, View distance and In the background rows do nothing in Godot.
- `install --link` leaves `.uid` and `.import` sidecars in the repo's plugin folders (not ignored).
- Docs: the export guide promises LightmapGI and says the music isn't built (it is).

## 5. The checks themselves

- **BUILDER's walk is timed by the clock**: it holds W for 5 s and wants 0.3 m; on a busy CPU it walked 0.23 m and
  failed, on a quiet one 0.30. A walk measured in frames would hold on any machine.
- **STUDIO takes about 50 minutes on a CPU and HAIR2PAGE four and a half hours**: the browser runner (§3.4) on the
  user's card is the way to run them; their numbers are in RUN_LOCALLY.md.
- **GDTESTROOM's station 6 needs the desk's bake and station 13 five props made by Blender**, which no cloud session
  has: here it's played to 5, from `n_chores` to 11 and from `n_bath` on, each part ok; on main the same.

## 6. Left on the branch

Nothing uncommitted. The per-finger curl (`curls`) went in as b647b010; where the branch stopped and what could come
next is docs/CONTINUE.md §0.
