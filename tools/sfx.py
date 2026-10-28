#!/usr/bin/env python3
"""The Studio's sound-effect shelf: CC0 sound effects for the story's `sounds` (docs/SFX.md). Not the orchestra's:
the score room's instruments are music, these are the doors, steps, knocks, breaths and room tones a beat plays.

    python tools/sfx.py fetch             fetch and prepare the shelf (what's missing; --force all of it again)
    python tools/sfx.py list [WORDS]      what's on it, filtered by name, category or tag
    python tools/sfx.py add FILE --name N --category C --tags "a, b" [--loop]   one of our own (recorded or made by us)
    python tools/sfx.py check             SFX: every sound's file is there and plays, every licence CC0 or ours,
                                          and every story sound that names the shelf (`sfx/<name>`) is on it

The shelf: Content/Studio/SFX/<category>/<name>.ogg and Content/Studio/SFX/index.json (name -> file, category, tags,
secs, loop, credit, licence, source). A story sound uses one by name: `"sounds": {"slam": {"file": "sfx/door_slam"}}`.
Sources are CC0 packs on GitHub (only what's listed is checked out, into Saved/SFX/sources/): Kenney's, rubberduck's
"100 CC0 SFX" packs and Ben Burnes's micro packs, gathered in lavenderdotpet/CC0-Public-Domain-Sounds, and VCSL and
VSCO-2 CE by Versilian Studios. Some are built here from parts (three knocks from one, steps heard through a ceiling,
a sting from metal hits) and one is made from nothing (the answering machine's beep). ffmpeg and numpy are needed.
"""
import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SHELF = ROOT / "Content" / "Studio" / "SFX"
INDEX = SHELF / "index.json"
SOURCES = ROOT / "Saved" / "SFX" / "sources"
GAMES = ROOT / "Content" / "Games"
SR = 44100

REPOS = {
    "cc0": ("https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds", "CC0 packs gathered in lavenderdotpet/CC0-Public-Domain-Sounds"),
    "vcsl": ("https://github.com/sgossner/VCSL", "VCSL by Versilian Studios (github.com/sgossner/VCSL)"),
    "vsco": ("https://github.com/sgossner/VSCO-2-CE", "VSCO-2 CE by Versilian Studios (github.com/sgossner/VSCO-2-CE)"),
}
PACK = {  # the pack each folder is, for the credit (all CC0; crediting is welcome, never required)
    "100-CC0-SFX": "100 CC0 SFX by rubberduck (OpenGameArt)", "100-cc0-sfx-2": "100 CC0 SFX #2 by rubberduck (OpenGameArt)",
    "100-CC0-wood-metal-SFX": "100 CC0 wood and metal SFX by rubberduck (OpenGameArt)", "75-cc0-breaking-falling-hit-sfx": "75 CC0 breaking, falling and hit SFX by rubberduck (OpenGameArt)",
    "80-CC0-creature-SFX": "80 CC0 creature SFX by rubberduck (OpenGameArt)", "80-CC0-creature-sfx-2": "80 CC0 creature SFX #2 by rubberduck (OpenGameArt)",
    "30-cc0-sfx-loops": "30 CC0 SFX loops by rubberduck (OpenGameArt)", "30-cc0-weird-sfx": "30 CC0 weird SFX by rubberduck (OpenGameArt)",
    "kenney_impactsounds": "Impact Sounds by Kenney (kenney.nl)", "kenney_rpgaudio": "RPG Audio by Kenney (kenney.nl)",
    "bb - Fans and Drones (Jul 2021)": "Fans and Drones by Ben Burnes", "bb - Books, Paper, Writing (Jan 2021)": "Books, Paper, Writing by Ben Burnes",
    "bb - Toolbox Rummaging (Sept 2021)": "Toolbox Rummaging by Ben Burnes", "Micro Pack - Record Fuzzies": "Record Fuzzies micro pack by Ben Burnes",
    "Micro Pack - NazdyNate - Electromagnetic Sounds": "Electromagnetic Sounds micro pack by NazdyNate", "Micro Pack - Kitchen Knives": "Kitchen Knives micro pack by Ben Burnes",
    "Micro Pack - Organic Wooshes": "Organic Wooshes micro pack by Ben Burnes",
}


def S(src, path, gain=0.0, at=0.0, start=0.0, filt=None):
    """One part of a sound: a file in a source, its gain (dB), where it starts in the sound (s), where it's read from,
    an ffmpeg filter on it (a ceiling's low-pass)."""
    return dict(src=src, path=path, gain=gain, at=at, start=start, filt=filt)


def one(name, cat, tags, src, path, **kw):
    return (name, dict(cat=cat, tags=tags, parts=[S(src, path, **{k: v for k, v in kw.items() if k in ("gain", "start", "filt")})], **{k: v for k, v in kw.items() if k in ("loop", "max", "note")}))


def many(stem, cat, tags, src, folder, files, **kw):
    """A numbered family: stem_01, stem_02... from a list of files."""
    return [one("%s_%02d" % (stem, i + 1), cat, tags, src, folder + "/" + f, **kw) for i, f in enumerate(files)]


C0, CW, C2, CB, CC, CC2, CL, CWD = ("100-CC0-SFX", "100-CC0-wood-metal-SFX", "100-cc0-sfx-2", "75-cc0-breaking-falling-hit-sfx",
                                     "80-CC0-creature-SFX", "80-CC0-creature-sfx-2", "30-cc0-sfx-loops", "30-cc0-weird-sfx")
KI, KR = "kenney_impactsounds/Audio", "kenney_rpgaudio/Audio"
FANS, BOOKS, TOOLS, REC, EM, KNIVES, WOOSH = ("bb - Fans and Drones (Jul 2021)", "bb - Books, Paper, Writing (Jan 2021)", "bb - Toolbox Rummaging (Sept 2021)",
                                               "Micro Pack - Record Fuzzies", "Micro Pack - NazdyNate - Electromagnetic Sounds", "Micro Pack - Kitchen Knives", "Micro Pack - Organic Wooshes")
VMISC = "Miscellania Raw/Misc 1"

SOUNDS = dict([
    # --- doors: opening, closing, slamming, creaking, locks ---
    one("door_open", "doors", ["door", "open"], "cc0", C0 + "/door_open.ogg"),
    *many("door_close", "doors", ["door", "close", "shut"], "cc0", C0, ["door_close_01.ogg", "door_close_02.ogg", "door_close_03.ogg", "door_close_04.ogg"]),
    *many("door", "doors", ["door", "handle", "open"], "cc0", C2, ["sfx100v2_door_01.ogg", "sfx100v2_door_02.ogg", "sfx100v2_door_03.ogg", "sfx100v2_door_04.ogg", "sfx100v2_door_05.ogg"]),
    *many("door_slam", "doors", ["door", "slam", "bang", "scare"], "cc0", CW, ["wood_slam_01.ogg", "wood_slam_02.ogg", "wood_slam_03.ogg", "wood_slam_04.ogg"]),
    *many("slam", "doors", ["slam", "bang", "heavy"], "cc0", C0, ["slam_01.ogg", "slam_02.ogg", "slam_03.ogg", "slam_04.ogg"]),
    *many("door_creak", "doors", ["creak", "door", "hinge", "slow"], "cc0", KR, ["creak1.ogg", "creak2.ogg", "creak3.ogg"]),
    *many("squeak", "doors", ["creak", "squeak", "wood", "hinge"], "cc0", CW, ["wood_squeak_01.ogg", "wood_squeak_02.ogg"]),
    *many("hinge_metal", "doors", ["creak", "hinge", "metal", "gate"], "cc0", TOOLS, ["Metal Hinge 1.wav", "Metal Hinge 2.wav"]),
    one("lock_open", "doors", ["lock", "key", "unlock"], "cc0", CW + "/lock_open_01.ogg"),
    one("lock_open_02", "doors", ["lock", "key", "unlock"], "cc0", C2 + "/sfx100v2_lock_open_01.ogg"),
    *many("key_turn", "doors", ["key", "lock"], "cc0", C0, ["key_open_01.ogg", "key_open_02.ogg"]),
    one("latch", "doors", ["latch", "metal", "lock"], "cc0", KR + "/metalLatch.ogg"),
    *many("drawer", "doors", ["drawer", "open", "close", "furniture"], "cc0", TOOLS, ["Close Drawer 1.wav", "Close Drawer 2.wav", "Drawer Move.wav"]),
    # --- steps ---
    *many("step_wood", "steps", ["footstep", "wood", "floor", "steps"], "cc0", KI, ["footstep_wood_000.ogg", "footstep_wood_001.ogg", "footstep_wood_002.ogg", "footstep_wood_003.ogg", "footstep_wood_004.ogg"]),
    *many("step_concrete", "steps", ["footstep", "concrete", "stone", "steps"], "cc0", KI, ["footstep_concrete_000.ogg", "footstep_concrete_001.ogg", "footstep_concrete_002.ogg", "footstep_concrete_003.ogg", "footstep_concrete_004.ogg"]),
    *many("step_carpet", "steps", ["footstep", "carpet", "soft", "steps"], "cc0", KI, ["footstep_carpet_000.ogg", "footstep_carpet_001.ogg", "footstep_carpet_002.ogg", "footstep_carpet_003.ogg", "footstep_carpet_004.ogg"]),
    *many("step_creaky", "steps", ["footstep", "wood", "creaky", "old house"], "cc0", C2, ["sfx100v2_footstep_wood_01.ogg", "sfx100v2_footstep_wood_02.ogg", "sfx100v2_footstep_wood_03.ogg", "sfx100v2_footstep_wood_04.ogg"]),
    *many("step_wet", "steps", ["footstep", "wet", "water", "bathroom"], "cc0", C2, ["sfx100v2_footstep_wet_01.ogg", "sfx100v2_footstep_wet_02.ogg", "sfx100v2_footstep_wet_03.ogg"]),
    # --- knocks and impacts ---
    *many("knock_wood", "knocks", ["knock", "wood", "tap"], "cc0", CW, ["wood_hit_01.ogg", "wood_hit_03.ogg", "wood_hit_05.ogg", "wood_hit_07.ogg"]),
    *many("thud_wood", "knocks", ["thud", "wood", "impact", "heavy"], "cc0", KI, ["impactWood_heavy_000.ogg", "impactWood_heavy_001.ogg", "impactWood_heavy_002.ogg"]),
    *many("thud_soft", "knocks", ["thud", "body", "soft", "fall"], "cc0", KI, ["impactSoft_heavy_000.ogg", "impactSoft_heavy_001.ogg", "impactSoft_heavy_002.ogg"]),
    *many("thump", "knocks", ["thump", "wall", "heavy"], "cc0", TOOLS, ["Big Thump.wav", "Good Thunk.wav"]),
    *many("metal_hit", "knocks", ["metal", "hit", "clang"], "cc0", CW, ["metal_hit_01.ogg", "metal_hit_02.ogg", "metal_hit_03.ogg", "metal_hit_04.ogg", "metal_hit_05.ogg"]),
    *many("pipe_clang", "knocks", ["metal", "pipe", "clang", "basement"], "cc0", KI, ["impactMetal_heavy_000.ogg", "impactMetal_heavy_001.ogg", "impactMetal_heavy_002.ogg"]),
    *many("fall", "knocks", ["fall", "drop", "crash"], "cc0", CB, ["bfh1_falling_01.ogg", "bfh1_falling_02.ogg", "bfh1_falling_03.ogg"]),
    *many("thing_falls", "knocks", ["fall", "wood", "drop"], "cc0", CW, ["wood_falling_01.ogg", "wood_falling_02.ogg", "wood_falling_03.ogg"]),
    *many("metal_falls", "knocks", ["fall", "metal", "drop", "crash"], "cc0", CB, ["bfh1_metal_falling_01.ogg", "bfh1_metal_falling_02.ogg"]),
    # --- glass ---
    *many("glass_break", "glass", ["glass", "break", "shatter", "window"], "cc0", CB, ["bfh1_glass_breaking_01.ogg", "bfh1_glass_breaking_02.ogg", "bfh1_glass_breaking_03.ogg", "bfh1_glass_breaking_04.ogg"]),
    *many("glass_shatter", "glass", ["glass", "shatter", "break"], "vsco", VMISC, ["glass_break.wav", "glass_break3.wav", "glass_break5.wav"]),
    *many("glass_clink", "glass", ["glass", "cup", "clink"], "cc0", C0, ["glass_01.ogg", "glass_02.ogg", "glass_03.ogg"]),
    *many("dishes", "glass", ["dishes", "kitchen", "plates"], "cc0", C0, ["dishes_01.ogg", "dishes_02.ogg"]),
    # --- the house: wood cracking, metal, chains, scrapes ---
    *many("wood_crack", "house", ["crack", "wood", "creak", "settling"], "cc0", CW, ["wood_cracking_01.ogg", "wood_cracking_02.ogg", "wood_cracking_03.ogg", "wood_cracking_04.ogg"]),
    *many("wood_break", "house", ["break", "wood", "splinter"], "cc0", CW, ["wood_breaking_01.ogg", "wood_breaking_02.ogg"]),
    one("chain_grind", "house", ["chain", "metal", "drag", "dungeon"], "vsco", VMISC + "/chain_grind.wav", max=8),
    one("chain_loop", "house", ["chain", "metal", "rattle", "loop"], "vsco", VMISC + "/chain_loop.wav", loop=True, max=8),
    one("scrape_stone", "house", ["scrape", "stone", "drag"], "vsco", VMISC + "/brick_scrape.wav"),
    *many("scrape_knife", "house", ["scrape", "knife", "blade", "metal"], "cc0", KNIVES, ["Unpleasant Scraping 1.wav", "Unpleasant Scraping 2.wav", "Big Knife - Scrape 3.wav"]),
    *many("unsheath", "house", ["knife", "blade", "draw"], "cc0", KNIVES, ["Big Knife - Unsheath 1.wav", "Small Knife - Unsheath 1.wav"]),
    *many("keys", "house", ["keys", "jingle", "pocket"], "cc0", CW, ["keys_01.ogg", "keys_03.ogg", "keys_05.ogg"]),
    *many("switch", "house", ["switch", "light", "click"], "cc0", C0, ["switch_01.ogg", "switch_02.ogg"]),
    *many("flashlight", "house", ["flashlight", "torch", "click"], "cc0", TOOLS, ["Flashlight Clicky 1.wav", "Flashlight Clicky 2.wav"]),
    *many("rummage", "house", ["search", "rummage", "box"], "cc0", TOOLS, ["Rummage 1.wav", "Rummage 2.wav"]),
    # --- paper, books, cloth ---
    *many("page_turn", "paper", ["page", "book", "note", "paper"], "cc0", BOOKS, ["Page Turn 1.wav", "Page Turn 2.wav", "Page Turn 3.wav"]),
    *many("riffle", "paper", ["book", "pages", "riffle"], "cc0", BOOKS, ["Riffle Pages 1.wav", "Riffle Pages 2.wav"]),
    *many("writing", "paper", ["writing", "pen", "diary"], "cc0", BOOKS, ["Pen Writing 1.wav", "Pen Writing 2.wav"]),
    one("book_close", "paper", ["book", "close"], "cc0", KR + "/bookClose.ogg"),
    one("book_open", "paper", ["book", "open"], "cc0", KR + "/bookOpen.ogg"),
    *many("cloth", "paper", ["cloth", "clothes", "rustle", "grab"], "cc0", KR, ["cloth1.ogg", "cloth2.ogg", "cloth3.ogg", "cloth4.ogg"]),
    *many("whoosh", "paper", ["whoosh", "swish", "fast"], "cc0", WOOSH, ["Swish 1.wav", "Swish 3.wav", "Gentle Swish.wav"]),
    # --- breath and voices (not words) ---
    one("breath", "voices", ["breath", "breathing", "close", "behind you"], "cc0", CC + "/breath.ogg"),
    one("breath_02", "voices", ["breath", "breathing", "heavy"], "cc0", CC2 + "/breath_02.ogg"),
    one("snore", "voices", ["snore", "sleep", "someone's there"], "cc0", CC + "/snore.ogg"),
    *many("cough", "voices", ["cough", "someone's there"], "cc0", CC, ["cough_01.ogg", "cough_02.ogg"]),
    *many("human", "voices", ["human", "voice", "grunt", "gasp"], "cc0", CC2, ["human_01.ogg", "human_02.ogg", "human_03.ogg", "human_04.ogg", "human_05.ogg", "human_06.ogg"]),
    *many("scream", "voices", ["scream", "shriek", "scare"], "cc0", CC, ["scream_01.ogg", "scream_02.ogg"]),
    *many("hurt", "voices", ["hurt", "pain", "grunt"], "cc0", CC, ["hurt_01.ogg", "hurt_02.ogg", "hurt_03.ogg"]),
    *many("die", "voices", ["death", "die", "last breath"], "cc0", CC2, ["die_01.ogg", "die_02.ogg"]),
    # --- monsters ---
    *many("monster", "monsters", ["monster", "creature", "growl"], "cc0", CC, ["monster_01.ogg", "monster_02.ogg", "monster_03.ogg", "monster_04.ogg", "monster_05.ogg", "monster_06.ogg", "monster_07.ogg"]),
    *many("creature", "monsters", ["monster", "creature", "growl"], "cc0", CC2, ["monster_08.ogg", "monster_10.ogg", "monster_12.ogg", "monster_14.ogg", "monster_16.ogg", "monster_18.ogg", "monster_20.ogg"]),
    *many("roar", "monsters", ["roar", "monster", "scare"], "cc0", CC, ["roar_01.ogg", "roar_02.ogg", "roar_03.ogg"]),
    *many("growl", "monsters", ["growl", "grunt", "low"], "cc0", CC, ["grunt_01.ogg", "grunt_02.ogg", "grunt_03.ogg"]),
    *many("attack", "monsters", ["attack", "lunge", "scare"], "cc0", CC2, ["attack_01.ogg", "attack_02.ogg", "attack_03.ogg"]),
    *many("bug", "monsters", ["insects", "bugs", "crawling", "skitter"], "cc0", CC2, ["bug_05.ogg", "bug_07.ogg", "bug_09.ogg"]),
    *many("slime", "monsters", ["slime", "wet", "flesh", "squelch"], "cc0", CC2, ["slime_01.ogg", "slime_02.ogg", "slime_03.ogg"]),
    *many("howl", "monsters", ["howl", "wolf", "far off"], "cc0", CC, ["howl.ogg"]),
    # --- weird: textures and stingers for the uncanny ---
    *many("weird", "weird", ["weird", "uncanny", "sting", "texture"], "cc0", CWD, ["weird_%02d.ogg" % i for i in (1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29)]),
    *many("needle", "weird", ["record", "gramophone", "needle", "old"], "cc0", REC, ["Needle Drop.wav", "Record Skipping 1.wav", "Record Skipping 2.wav"]),
    # --- room tones and ambiences (loops) ---
    *many("room_tone", "ambience", ["room tone", "hum", "loop", "quiet"], "cc0", FANS, ["Air Vent.wav", "Refridgerator.wav", "Furnace Fan.wav", "Bathroom Fan.wav", "Dehumidifier.wav", "Large Fan.wav"], loop=True, max=30),
    *many("electric_hum", "ambience", ["electric", "hum", "buzz", "lights", "loop"], "cc0", EM, ["NazdyNate - EM Room Noise 1.wav", "NazdyNate - EM Room Noise 2.wav", "NazdyNate - Computer Monitor 1.wav"], loop=True, max=20),
    *many("phone_static", "ambience", ["phone", "static", "interference", "signal"], "cc0", EM, ["NazdyNate -Cell Reception 1.wav", "NazdyNate - Cell Phone 1.wav"], max=12),
    *many("ambient", "ambience", ["ambience", "drone", "dark", "loop"], "cc0", CL, ["ambient_01.ogg", "ambient_02.ogg", "ambient_03.ogg"], loop=True, max=30),
    *many("ambient_wind", "ambience", ["ambience", "wind", "outside", "loop"], "cc0", C2, ["sfx100v2_loop_ambient_01.ogg", "sfx100v2_loop_ambient_02.ogg", "sfx100v2_loop_ambient_03.ogg", "sfx100v2_loop_ambient_04.ogg"], loop=True, max=30),
    one("rain", "ambience", ["rain", "weather", "loop", "outside"], "cc0", CL + "/rain.ogg", loop=True, max=30),
    one("water_running", "ambience", ["water", "tap", "running", "bathroom", "loop"], "cc0", CL + "/water_flowing.ogg", loop=True, max=20),
    *many("noise", "ambience", ["noise", "static", "tv", "loop"], "cc0", CL, ["noise_01.ogg", "noise_02.ogg"], loop=True, max=15),
    one("record_crackle", "ambience", ["record", "crackle", "gramophone", "loop"], "cc0", REC + "/Classic Record Fuzz.wav", loop=True, max=20),
    one("thunder", "ambience", ["thunder", "storm", "weather"], "cc0", C2 + "/sfx100v2_thunder_01.ogg", max=12),
    # --- stings from metal (Versilian's bowed and struck percussion) ---
    one("metal_screech", "stings", ["screech", "bowed metal", "j-horror", "scare", "sting"], "vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Bowed_rr2_Mid.wav", max=6),
    one("cymbal_scrape", "stings", ["scrape", "cymbal", "metal", "screech"], "vcsl", "Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_scrape_1.wav", max=6),
    one("gong_scrape", "stings", ["gong", "scrape", "dread"], "vcsl", "Idiophones/Struck Idiophones/Gong 1/gong_scrape_mf.wav", max=8),
    one("gong_hit", "stings", ["gong", "hit", "boom", "shrine"], "vcsl", "Idiophones/Struck Idiophones/Gong 1/gong_fff.wav", max=8),
])

# Sounds built from parts: the parts mixed at their times and gains (a knock three times; steps heard through a
# ceiling, low-passed; stings made of hits)
CEILING = "lowpass=f=700,volume=0.8"
STEPS_UP = [S("cc0", KI + "/footstep_wood_00%d.ogg" % (i % 5), gain=-2 - i * 1.2, at=i * 0.62 + (0.05 if i % 2 else 0), filt=CEILING) for i in range(7)]
BUILT = {
    "knock_three": dict(cat="knocks", tags=["knock", "door", "three", "someone's there"], parts=[S("cc0", CW + "/wood_hit_03.ogg", at=t, gain=g) for t, g in ((0, 0), (0.42, -1), (0.84, 0.5))]),
    "knock_slow": dict(cat="knocks", tags=["knock", "door", "slow", "patient"], parts=[S("cc0", CW + "/wood_hit_01.ogg", at=t, gain=g) for t, g in ((0, 0), (1.3, -1), (2.6, 0), (3.9, -2))]),
    "knock_frantic": dict(cat="knocks", tags=["knock", "bang", "door", "frantic", "let me in"], parts=[S("cc0", CW + "/wood_hit_0%d.ogg" % (1 + i % 9), at=i * 0.16 + (0.03 if i % 3 == 0 else 0), gain=-3 + (i % 3)) for i in range(12)]),
    "steps_upstairs": dict(cat="steps", tags=["footsteps", "above", "upstairs", "ceiling", "someone's there"], parts=STEPS_UP),
    "steps_approach": dict(cat="steps", tags=["footsteps", "approaching", "closer", "wood"], parts=[S("cc0", KI + "/footstep_wood_00%d.ogg" % (i % 5), gain=-16 + i * 2.2, at=i * 0.58) for i in range(8)]),
    "floorboard_creak": dict(cat="house", tags=["creak", "floor", "floorboard", "someone's there"], parts=[S("cc0", CW + "/wood_squeak_01.ogg"), S("cc0", CW + "/wood_cracking_02.ogg", at=0.15, gain=-8)]),
    "sting_short": dict(cat="stings", tags=["sting", "scare", "short", "hit"], parts=[S("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Hammer_v3_rr1_Mid.wav"),
                                                                                   S("vcsl", "Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_hit_fff1.wav", gain=-6)], max=4),
    "sting_big": dict(cat="stings", tags=["sting", "scare", "big", "boom", "jump scare"], parts=[S("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Bowed_rr2_Mid.wav", gain=-6, start=0.0),
                                                                                                S("vcsl", "Idiophones/Struck Idiophones/Gong 1/gong_fff.wav", at=0.9), S("cc0", KI + "/impactWood_heavy_002.ogg", at=0.9, gain=-2),
                                                                                                S("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Hammer_v3_rr1_Mid.wav", at=0.9, gain=-3)], max=7),
    "grab_sting": dict(cat="stings", tags=["grab", "sting", "caught", "scare"], parts=[S("cc0", KR + "/cloth4.ogg", gain=2), S("vcsl", "Idiophones/Struck Idiophones/Brake Drum/BrakeDrum1_Hammer_v3_rr1_Mid.wav", at=0.05, gain=-2),
                                                                                       S("cc0", CC2 + "/attack_02.ogg", at=0.08, gain=-6)], max=4),
    "breath_close": dict(cat="voices", tags=["breath", "close", "behind you", "ear"], parts=[S("cc0", CC + "/breath.ogg", filt="highpass=f=180,lowpass=f=6000")], max=6),
    "power_hum_cut": dict(cat="house", tags=["power", "hum", "cut", "lights out", "blackout"], parts=[S("cc0", EM + "/NazdyNate - EM Room Noise 1.wav", filt="afade=t=out:st=2.2:d=0.12"), S("cc0", C0 + "/switch_02.ogg", at=2.2, gain=2)], max=3.5),
}
# Sounds made here from nothing (ours): name -> (category, tags, maker)
MADE = {
    "machine_beep": ("house", ["beep", "answering machine", "phone", "electronic"], "beep"),
}


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def checkout(src, paths):
    url = REPOS[src][0]
    repo = SOURCES / src
    if not (repo / ".git").is_dir():
        SOURCES.mkdir(parents=True, exist_ok=True)
        print("cloning", url, "(only what's needed)")
        run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", "--depth", "1", url, str(repo)])
    run(["git", "-C", str(repo), "sparse-checkout", "set", "--no-cone"] + ["/" + p for p in sorted(set(paths))])
    run(["git", "-C", str(repo), "checkout", "-q"])


def commit_of(src):
    return run(["git", "-C", str(SOURCES / src), "rev-parse", "--short", "HEAD"]).stdout.decode().strip()


def load(path, start=0.0, filt=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path)] + (["-af", filt] if filt else []) + ["-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(run(cmd).stdout, dtype=np.float32).copy()


def finish(x, max_s, loop):
    """The leading silence off (a one-shot), cut at max_s with a fade, peak at -1 dBFS; a loop keeps its start and gets
    a short fade at both ends so it can be looped without a click."""
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    if peak <= 0:
        raise ValueError("silent")
    if not loop:
        on = np.nonzero(np.abs(x) > peak * 10 ** (-45 / 20))[0]
        x = x[max(0, on[0] - int(0.005 * SR)):on[-1] + int(0.08 * SR)]
    n = int(max_s * SR)
    if len(x) > n:
        x = x[:n].copy()
        f = int(min(0.5, max_s * 0.1) * SR)
        x[-f:] *= np.linspace(1, 0, f) ** 2
    f = int((0.03 if loop else 0.003) * SR)
    x[:f] *= np.linspace(0, 1, f) if loop else 1
    x[-f:] *= np.linspace(1, 0, f)
    return x * (10 ** (-1 / 20) / float(np.max(np.abs(x))))


def write_ogg(x, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libvorbis", "-q:a", "3", str(path)],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode())


def mix(parts):
    out = np.zeros(0, dtype=np.float32)
    for p in parts:
        y = load(SOURCES / p["src"] / p["path"], p.get("start", 0), p.get("filt")) * (10 ** (p.get("gain", 0) / 20))
        i = int(p.get("at", 0) * SR)
        if len(out) < i + len(y):
            out = np.concatenate([out, np.zeros(i + len(y) - len(out), dtype=np.float32)])
        out[i:i + len(y)] += y
    return out


def made(kind):
    if kind == "beep":                                       # an answering machine's beep: 1 kHz, half a second, soft edges
        t = np.arange(int(0.55 * SR)) / SR
        x = 0.6 * np.sin(2 * math.pi * 1000 * t) + 0.08 * np.sin(2 * math.pi * 3000 * t)
        env = np.minimum(1, np.minimum(t / 0.01, (t[-1] - t) / 0.02))
        return (x * env).astype(np.float32)
    raise ValueError(kind)


def credit_of(parts):
    out = []
    for p in parts:
        top = p["path"].split("/")[0]
        c = PACK.get(top) or REPOS[p["src"]][1]
        if c not in out:
            out.append(c)
    return "; ".join(out)


def fetch(force):
    index = json.loads(INDEX.read_text("utf-8")) if INDEX.is_file() else {"format": "horrorstudio-sfx", "version": 1, "sounds": {}}
    sounds = index["sounds"]
    want = {**{k: dict(v, built=False) for k, v in SOUNDS.items()}, **{k: dict(v, built=True) for k, v in BUILT.items()}}
    todo = {k: v for k, v in want.items() if force or k not in sounds}
    todo_made = {k: v for k, v in MADE.items() if force or k not in sounds}
    if not todo and not todo_made:
        print("the shelf has everything (--force to make it again)")
        return
    need = {}
    for v in want.values():
        for p in v["parts"]:
            need.setdefault(p["src"], []).append(p["path"])
    for src, paths in need.items():
        checkout(src, paths)
    commits = {src: commit_of(src) for src in need}
    for name, v in sorted(todo.items()):
        x = finish(mix(v["parts"]), v.get("max", 12), v.get("loop", False))
        rel = "%s/%s.ogg" % (v["cat"], name)
        write_ogg(x, SHELF / rel)
        srcs = sorted({p["src"] for p in v["parts"]})
        sounds[name] = dict(file=rel, category=v["cat"], tags=v["tags"], secs=round(len(x) / SR, 2), loop=bool(v.get("loop")),
                            credit=credit_of(v["parts"]), license="CC0-1.0",
                            source=("built from " if v["built"] else "") + ", ".join("%s@%s %s" % (REPOS[p["src"]][0].split("github.com/")[1], commits[p["src"]], p["path"]) for p in v["parts"]) if len(v["parts"]) < 4
                            else "built from %d parts of %s" % (len(v["parts"]), ", ".join(REPOS[s][0].split("github.com/")[1] + "@" + commits[s] for s in srcs)))
        print("  %-18s %5.1f s  %s" % (name, len(x) / SR, rel))
    for name, (cat, tags, kind) in todo_made.items():
        x = finish(made(kind), 10, False)
        rel = "%s/%s.ogg" % (cat, name)
        write_ogg(x, SHELF / rel)
        sounds[name] = dict(file=rel, category=cat, tags=tags, secs=round(len(x) / SR, 2), loop=False, credit="HorrorStudio (made by tools/sfx.py)", license="ours", source="made")
    index["sounds"] = dict(sorted(sounds.items()))
    INDEX.write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", "utf-8")
    size = sum(f.stat().st_size for f in SHELF.rglob("*.ogg"))
    print("the shelf: %d sounds, %.1f MB" % (len(sounds), size / 1e6))


def cmd_list(words):
    sounds = json.loads(INDEX.read_text("utf-8"))["sounds"] if INDEX.is_file() else {}
    q = " ".join(words).lower()
    for name, s in sounds.items():
        hay = " ".join([name, s["category"]] + s["tags"]).lower()
        if all(w in hay for w in q.split()):
            print("%-18s %-9s %5.1f s %s  %s" % (name, s["category"], s["secs"], "loop" if s.get("loop") else "    ", ", ".join(s["tags"])))


def cmd_add(a):
    index = json.loads(INDEX.read_text("utf-8")) if INDEX.is_file() else {"format": "horrorstudio-sfx", "version": 1, "sounds": {}}
    if not a.name or not a.name.replace("_", "").isalnum() or a.name != a.name.lower():
        sys.exit("--name: lower case letters, digits and _")
    x = finish(load(Path(a.file)), a.max, a.loop)
    rel = "%s/%s.ogg" % (a.category, a.name)
    write_ogg(x, SHELF / rel)
    index["sounds"][a.name] = dict(file=rel, category=a.category, tags=[t.strip() for t in (a.tags or "").split(",") if t.strip()], secs=round(len(x) / SR, 2),
                                   loop=a.loop, credit=a.credit or "HorrorStudio", license=a.license, source="added from " + Path(a.file).name)
    index["sounds"] = dict(sorted(index["sounds"].items()))
    INDEX.write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", "utf-8")
    print("added", a.name, rel)


def story_refs():
    """Every story sound that names the shelf: (game, sound id, shelf name)."""
    out = []
    for f in sorted(GAMES.glob("*/story.json")):
        story = json.loads(f.read_text("utf-8"))
        for sid, s in (story.get("sounds") or {}).items():
            file = (s or {}).get("file") or ""
            if file.startswith("sfx/"):
                out.append((f.parent.name, sid, file[4:]))
    return out


def cmd_check():
    problems = []
    if not INDEX.is_file():
        sys.exit("FAIL no shelf: python tools/sfx.py fetch")
    index = json.loads(INDEX.read_text("utf-8"))
    sounds = index.get("sounds", {})
    if index.get("format") != "horrorstudio-sfx":
        problems.append("index.json: format")
    files = set()
    for name, s in sounds.items():
        f = SHELF / s.get("file", "")
        files.add(f.resolve())
        if not f.is_file():
            problems.append("%s: no file %s" % (name, s.get("file")))
            continue
        if s.get("license") not in ("CC0-1.0", "ours"):
            problems.append("%s: licence %s (the shelf is CC0 or ours)" % (name, s.get("license")))
        for k in ("category", "tags", "secs", "credit", "source"):
            if not s.get(k) and s.get(k) != 0:
                problems.append("%s: no %s" % (name, k))
        try:
            x = load(f)
        except subprocess.CalledProcessError as e:
            problems.append("%s: doesn't decode (%s)" % (name, e.stderr.decode()[:80]))
            continue
        secs, peak = len(x) / SR, float(np.max(np.abs(x))) if len(x) else 0
        if abs(secs - s["secs"]) > 0.1 or peak < 0.05:
            problems.append("%s: %.2f s (index says %s), peak %.3f" % (name, secs, s["secs"], peak))
    for f in SHELF.rglob("*.ogg"):
        if f.resolve() not in files:
            problems.append("%s: on the shelf but not in index.json" % f.relative_to(SHELF))
    for game, sid, name in story_refs():
        if name not in sounds:
            problems.append("%s: sound %s names sfx/%s, which isn't on the shelf" % (game, sid, name))
    print("sounds %d (%s), story sounds on the shelf %d" % (len(sounds), ", ".join("%s %d" % (c, n) for c, n in sorted(count_by(sounds).items())), len(story_refs())))
    for p in problems:
        print("FAIL", p)
    if problems:
        sys.exit(1)
    print("SFX ok")


def count_by(sounds):
    out = {}
    for s in sounds.values():
        out[s["category"]] = out.get(s["category"], 0) + 1
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch")
    f.add_argument("--force", action="store_true")
    li = sub.add_parser("list")
    li.add_argument("words", nargs="*")
    ad = sub.add_parser("add")
    ad.add_argument("file")
    ad.add_argument("--name", required=True)
    ad.add_argument("--category", default="ours")
    ad.add_argument("--tags", default="")
    ad.add_argument("--loop", action="store_true")
    ad.add_argument("--max", type=float, default=30)
    ad.add_argument("--credit")
    ad.add_argument("--license", default="ours", choices=["ours", "CC0-1.0"])
    sub.add_parser("check")
    a = ap.parse_args()
    if a.cmd in ("fetch", "add", "check") and not shutil.which("ffmpeg"):
        sys.exit("needs ffmpeg on the PATH")
    if a.cmd == "fetch":
        fetch(a.force)
    elif a.cmd == "list":
        cmd_list(a.words)
    elif a.cmd == "add":
        cmd_add(a)
    else:
        cmd_check()


if __name__ == "__main__":
    main()
