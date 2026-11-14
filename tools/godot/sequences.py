"""SEQUENCES: the guide of sequences (guides/sequences) built for real and played headless in Godot 4.7.

    python tools/godot/sequences.py [--reuse] [--keep DIR] [--only a,b]
        a by-hand project (godot_byhand.py new), three characters baked by the Animator (the exports on this machine
        when they're there: Exports/characters/anim_normal_woman, anim_skinny_man, creature_ghoul; else its test
        bodies), and one scene, main.tscn, built by sequences_build.gd from the data below as the Things and NPC
        Markers tabs would save it: a flat, a shop and a corridor, the things in them, and every recipe of the guide
        as a character's markers. sequences_test.gd then plays each recipe as a player would (walking in, E,
        answers, looking away) and measures what happens. Ends "SEQUENCES ok".

    python tools/godot/sequences.py --pictures [--reuse] [--only a,b]
        the guide's pictures of the game, under xvfb (sequences_shots.gd), into guides/sequences/img.

    python tools/godot/sequences.py --editor [--reuse]
        the guide's pictures of the editor (the NPC Markers tab with each recipe's storyboard, its pins in the 3D
        view), under xvfb (sequences_editor_shots.gd installed as a plugin of its own), into guides/sequences/img.

    python tools/godot/sequences.py tables
        the guide's storyboard tables written again from the data below (between its <!-- seq:ID --> marks), so the
        guide, the scene and the check are one thing. `tables --check`: only says whether they're current.

    python tools/godot/sequences.py guide
        SEQGUIDE: the page alone, no Godot: its tables are the data's, every picture it shows is there and every one of
        its own is shown, every link lands, its card is in guides/index.html.

    python tools/godot/sequences.py data
        the data as JSON (what the builder reads).

Godot is $GODOT, else godot. The finished project stays in Saved/Godot/_sequences (or --keep DIR): open it in Godot
to walk through every recipe.
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import godot_byhand as BH  # noqa: E402

HERE = Path(__file__).resolve().parent
GUIDE = ROOT / "guides" / "sequences"

# ---- the place ------------------------------------------------------------------------------------------------------------
# metres; y up; a character faces +Z at yaw 0 (90: +X, 180: -Z, -90: -X). Walls 0.2 thick, 2.6 high.
# The flat: x -4..4, z -3..3. The shop: x -4..4, z 3..9 (its street door in the south wall). The corridor: east of the
# flat, x 4..10 along z -0.55..1.45, then south, x 10..12 down to z 8 (the cellar door at its end).
# Everything a character uses is sized by docs/ANIMATION_RULES.md: the table and the counter's ledge 0.82 to 0.97 m (a
# thing she takes: 0.8 to 1.0), the sofa's seat 0.45 with 0.9 m behind its edge and a metre of floor in front, the
# shelf a book goes on 1.4 m, 0.45 m of floor between a customer and the counter.
C = {"floor": "#8a6a4c", "tile": "#b9b4a8", "street": "#3b3d42", "carpet": "#4a3b3b", "wall": "#d9d2c3", "dark": "#6f675c", "ceil": "#e9e5dc",
     "wood": "#6b4a32", "sofa": "#3f6b4b", "cloth": "#8d3b3b", "metal": "#8f969e", "white": "#f1efe9", "red": "#b23b32", "green": "#4c8a4a",
     "blue": "#3a6ea5", "brass": "#c9a24b", "black": "#22252a", "door": "#4b3628"}


def box(n, at, size, c, solid=True):
    return {"n": n, "at": at, "size": size, "c": C[c], "solid": solid}


BOXES = [
    box("FlatFloor", [0, -0.1, 0], [8.4, 0.2, 6.2], "floor"),
    box("ShopFloor", [0, -0.1, 6.05], [8.4, 0.2, 5.9], "tile"),
    box("Street", [0, -0.1, 10.6], [8.4, 0.2, 3.2], "street"),
    box("CorridorFloor", [8.2, -0.1, 3.7], [8.0, 0.2, 9.0], "carpet"),
    box("FlatWallN", [0, 1.3, -3.1], [8.4, 2.6, 0.2], "wall"),
    box("WallW", [-4.1, 1.3, 3.0], [0.2, 2.6, 12.4], "wall"),
    box("FlatWallE1", [4.1, 1.3, -1.6], [0.2, 2.6, 3.2], "wall"),
    box("FlatWallE2", [4.1, 1.3, 1.95], [0.2, 2.6, 2.1], "wall"),
    box("FlatDoorTopE", [4.1, 2.35, 0.45], [0.2, 0.5, 0.9], "wall"),
    box("SharedWall1", [-2.225, 1.3, 3.0], [3.55, 2.6, 0.2], "wall"),
    box("SharedWall2", [2.225, 1.3, 3.0], [3.55, 2.6, 0.2], "wall"),
    box("SharedDoorTop", [0, 2.35, 3.0], [0.9, 0.5, 0.2], "wall"),
    box("ShopWallE", [4.1, 1.3, 6.15], [0.2, 2.6, 6.1], "wall"),
    box("ShopWallS1", [-1.3, 1.3, 9.1], [5.8, 2.6, 0.2], "wall"),
    box("ShopWallS2", [3.35, 1.3, 9.1], [1.7, 2.6, 0.2], "wall"),
    box("ShopDoorTop", [2.05, 2.35, 9.1], [0.9, 0.5, 0.2], "wall"),
    box("CorridorWallN", [8.2, 1.3, -0.65], [8.0, 2.6, 0.2], "dark"),
    box("CorridorWallS", [7.0, 1.3, 1.55], [5.6, 2.6, 0.2], "dark"),
    box("CornerWall", [9.9, 1.3, 4.825], [0.2, 2.6, 6.75], "dark"),          # its end (x 10.0, z 1.45) is the corner she peeks round
    box("CorridorWallE", [12.1, 1.3, 3.725], [0.2, 2.6, 8.95], "dark"),
    box("CorridorEnd", [11.0, 1.3, 8.1], [2.4, 2.6, 0.2], "dark"),
    box("Ceiling", [0, 2.65, 3.0], [8.4, 0.1, 12.4], "ceil"),
    box("CorridorCeiling", [8.2, 2.65, 3.7], [8.0, 0.1, 9.0], "ceil"),
    # the flat
    box("Table", [-3.5, 0.41, -0.5], [0.9, 0.82, 1.6], "wood"),
    box("SofaSeat", [0.8, 0.225, -2.4], [2.2, 0.45, 1.0], "sofa"),
    box("SofaBack", [0.8, 0.7, -2.9], [2.2, 0.5, 0.2], "sofa"),
    box("SofaArmL", [-0.4, 0.32, -2.4], [0.2, 0.64, 1.0], "sofa"),
    box("SofaArmR", [2.0, 0.32, -2.4], [0.2, 0.64, 1.0], "sofa"),
    box("CoffeeTable", [0.8, 0.2, -0.55], [1.1, 0.4, 0.55], "wood"),
    box("ShelfSideA", [3.75, 1.0, -2.55], [0.5, 2.0, 0.04], "wood"),
    box("ShelfSideB", [3.75, 1.0, -1.05], [0.5, 2.0, 0.04], "wood"),
    box("ShelfBack", [3.98, 1.0, -1.8], [0.04, 2.0, 1.5], "wood"),
    box("Shelf1", [3.75, 0.45, -1.8], [0.5, 0.03, 1.46], "wood"),
    box("Shelf2", [3.75, 0.95, -1.8], [0.5, 0.03, 1.46], "wood"),
    box("Shelf3", [3.75, 1.4, -1.8], [0.5, 0.03, 1.46], "wood"),
    box("Shelf4", [3.75, 1.85, -1.8], [0.5, 0.03, 1.46], "wood"),
    box("HookBoard", [3.97, 1.0, 2.0], [0.06, 0.3, 0.4], "wood", False),
    # the shop
    box("ShopShelves", [-2.2, 0.9, 3.28], [2.4, 1.8, 0.35], "wood"),
    box("ShopLedge", [-2.2, 0.95, 3.58], [2.4, 0.04, 0.25], "wood"),
    box("Counter", [-1.6, 0.45, 5.2], [3.6, 0.9, 0.6], "wood"),
    box("Till", [-2.9, 0.98, 5.2], [0.35, 0.16, 0.35], "black", False),
    box("Display", [3.6, 0.7, 6.5], [0.6, 1.4, 2.0], "wood"),
]

LIGHTS = [  # a node of lamps a room: [x, y, z, energy, reach, colour]
    {"n": "FlatLights", "lamps": [[-1.0, 2.3, 0.0, 2.2, 9.0, "#ffd9a8"], [2.4, 2.3, -0.4, 1.4, 7.0, "#ffd9a8"]]},
    {"n": "ShopLights", "lamps": [[-1.6, 2.35, 4.4, 2.0, 7.0, "#eaf2ff"], [1.2, 2.35, 7.0, 2.0, 8.0, "#eaf2ff"]]},
    {"n": "CorridorLights", "lamps": [[6.3, 2.35, 0.45, 1.5, 6.5, "#ffe9c4"], [11.0, 2.35, 3.2, 1.2, 6.0, "#ffe9c4"], [11.0, 2.35, 6.9, 0.9, 5.0, "#ffe9c4"]]},
]

# things: a mesh, and what a Things tab card or the Look plugin's grip makes of it
THINGS = [
    {"n": "Mug", "mesh": ["cyl", 0.04, 0.095], "at": [-3.2, 0.868, -1.0], "c": C["white"],
     "grip": {"shape": 0, "size": 0.075, "length": 0.09, "use": 2, "mouth": [0, 0.045, -0.035], "carry": 2, "upright": True}},
    {"n": "Apple", "mesh": ["ball", 0.036], "at": [-3.2, 0.856, 0.05], "c": C["red"], "script": "res://starter/pickup.gd",
     "set": {"item": "apple", "label": "An apple"}, "grip": {"shape": 1, "size": 0.072, "use": 1, "mouth": [0, 0, -0.036]}},
    {"n": "Book", "mesh": ["box", 0.15, 0.035, 0.21], "at": [2.3, 0.018, -0.3], "c": C["blue"]},
    {"n": "CellarKey", "mesh": ["box", 0.012, 0.07, 0.03], "at": [3.9, 0.95, 2.0], "c": C["brass"], "grip": {"shape": 2, "size": 0.012}},
    {"n": "Soda1", "mesh": ["cyl", 0.033, 0.12], "at": [-2.8, 1.03, 3.58], "c": C["green"], "script": "res://starter/pickup.gd", "set": {"item": "soda", "label": "A can of soda"}},
    {"n": "Soda2", "mesh": ["cyl", 0.033, 0.12], "at": [-2.5, 1.03, 3.58], "c": C["green"], "script": "res://starter/pickup.gd", "set": {"item": "soda", "label": "A can of soda"}},
    {"n": "Soda3", "mesh": ["cyl", 0.033, 0.12], "at": [-2.2, 1.03, 3.58], "c": C["green"], "script": "res://starter/pickup.gd", "set": {"item": "soda", "label": "A can of soda"}},
    {"n": "CellarDoor", "mesh": ["box", 0.9, 2.0, 0.06], "at": [11.0, 1.0, 7.95], "c": C["door"],
     "logic": {"needs": "item:cellar_key", "locked_says": "Locked. It wants a key.", "say": "The key turns.", "set_flags": "+cellar_open", "tick": "cellar", "once": True}},
]

AREAS = [  # the Things tab's Area and Scare cards: a box you walk into
    {"n": "BehindCounter", "script": "res://starter/event_area.gd", "at": [-1.6, 0, 4.3], "size": [3.4, 2.0, 1.0], "set": {"fact": "behind_counter"}},
    {"n": "InCorridor", "script": "res://starter/event_area.gd", "at": [5.3, 0, 0.45], "size": [1.6, 2.0, 1.8], "set": {"fact": "in_corridor"}},
    {"n": "AtCorner", "script": "res://starter/event_area.gd", "at": [11.0, 0, 0.5], "size": [1.6, 2.0, 1.7], "set": {"fact": "at_corner"}},
    {"n": "ShopScare", "script": "res://starter/scare_area.gd", "at": [1.5, 0, 7.5], "size": [1.0, 2.0, 1.0],
     "set": {"walk_in": False, "lights_do": "flicker", "for_seconds": 3.0}, "nodes": {"lights_of": "ShopLights"}},
    {"n": "CorridorScare", "script": "res://starter/scare_area.gd", "at": [7.0, 0, 0.45], "size": [1.0, 2.0, 1.0],
     "set": {"walk_in": False, "lights_do": "flicker", "for_seconds": 4.0}, "nodes": {"lights_of": "CorridorLights"}},
]

PLAYER = {"at": [0.0, 0.1, 2.0]}
TASKS = []

# ---- the cards (the tab's own: plugin.gd CARDS) -------------------------------------------------------------------------------
CARDS = {
    "appear": ("Start here", "appear", {}), "walk": ("Walk", "walk", {}), "run": ("Run", "walk", {"pace": "run"}),
    "sneak": ("Sneak", "walk", {"pace": "sneak"}), "crawl": ("Crawl", "walk", {"pace": "crawl"}),
    "wait": ("Wait", "wait", {"stay": "secs", "stay_secs": 3.0}), "talk": ("Talk", "wait", {"talk": True, "stay": "talked"}),
    "gesture": ("Small movement", "gesture", {}), "look_at": ("Look at it", "gesture", {"gesture": "look_hand"}),
    "sit": ("Sit", "sit", {}), "sleep": ("Sleep", "sleep", {}), "grab": ("Grab", "grab", {"action": "reach"}),
    "pick_up": ("Pick up", "grab", {"action": "pick_up"}), "put_down": ("Put down", "grab", {"action": "put_down"}),
    "open": ("Open door", "grab", {"action": "open"}), "eat": ("Eat", "grab", {"action": "eat"}), "drink": ("Drink", "grab", {"action": "drink"}),
    "take_from": ("Take from you", "grab", {"action": "take_from"}), "give_to": ("Hand to you", "grab", {"action": "give_to"}),
    "attack": ("Attack", "attack", {}), "jumpscare": ("Jump scare", "scare", {"face_player": True}),
    "peek": ("Peek", "peek", {"stay": "secs", "stay_secs": 2.5}), "animation": ("Animation", "animation", {}),
    "event": ("Event", "event", {}), "choice": ("Choice", "choice", {}), "repeat": ("Repeat", "repeat", {}), "disappear": ("Disappear", "disappear", {}),
}


def M(card, where="", form="", **fields):
    """a marker: its card, where it's clicked (the guide's words), what's set in its form (the guide's words), its fields"""
    return {"card": card, "where": where, "form": form, **fields}


# ---- the cast and their recipes ---------------------------------------------------------------------------------------------
# Each recipe is a quest of one character. `starts`: the quest's Starts when. The words in `where` and `form` are the
# guide's (tables); the fields are what the builder sets. A recipe's `about` is its paragraph in the guide.
CAST = [
    {"id": "Mio", "model": "woman", "at": [-1.6, 0, 1.6], "yaw": 180, "color": "#4FC3F7", "npc": {"alive": True, "life_every": [5.0, 9.0]},
     "quests": [
        {"id": "evening", "title": "An evening in", "starts": "",
         "markers": [
            M("appear", "the floor by the door", "", at=[-1.6, 0, 1.6], yaw=180),
            M("walk", "the floor in front of the table; turn its arrow to the table", "", at=[-2.45, 0, -1.0], yaw=-90),
            M("pick_up", "the mug", "It stays in the hand: on", at=[-3.2, 0.868, -1.0], yaw=-90, target="Mug", keep_in_hand=True),
            M("walk", "the floor in front of the sofa; click the + on its path and drag the bend clear of the coffee table",
              "Turns to the arrow at the end: off", at=[0.6, 0, -1.35], yaw=0, face_arrow=False, bends=[[-1.0, 0, -0.95]]),
            M("sit", "the sofa's front edge; the arrow the way her knees point", "Stays: for some seconds, 1.5", at=[0.6, 0.45, -1.9], yaw=0, stay="secs", stay_secs=1.5),
            M("look_at", "", "(nothing to set: it looks at what's in her hand)"),
            M("wait", "", "Seconds: 4 (she stays sat)", stay="secs", stay_secs=4.0),
            M("gesture", "", "Does: Sighs", gesture="sigh", set_flags="+mio_settled"),
         ]},
     ]},
    {"id": "Aya", "model": "woman", "at": [2.6, 0, 1.3], "yaw": -90, "color": "#F7A84F", "npc": {},
     "quests": [
        {"id": "tidy", "title": "Tidying up", "starts": "",
         "markers": [
            M("appear", "the floor where she starts", "", at=[2.6, 0, 1.3], yaw=-90),
            M("walk", "the floor a step west of the book; arrow to the book", "", at=[1.8, 0, -0.3], yaw=90),
            M("pick_up", "the book on the floor", "It stays in the hand: on", at=[2.3, 0.018, -0.3], yaw=90, target="Book", keep_in_hand=True),
            M("walk", "the floor in front of the bookshelf; arrow to the shelf", "", at=[3.0, 0, -1.8], yaw=90),
            M("put_down", "the shelf at eye height, near its front edge", "", at=[3.62, 1.435, -1.8], yaw=90),
            M("gesture", "", "Does: Rubs her hands", gesture="rub_hands"),
            M("walk", "the floor where she waits; arrow into the room", "", at=[2.6, 0, 1.3], yaw=-90),
            M("talk", "", "Lines: \"There. Tidy.\" / \"I haven't eaten all day. Is that apple still on the table?\" · Head: follows you · Then, Adds tasks: apple: Bring Aya the apple from the table.",
              head="follow", talks=[{"lines": ["Aya: There. Tidy.", "I haven't eaten all day. Is that apple still on the table?"], "again": "Aya: The apple. On the table by the wall."}],
              add_tasks=["apple: Bring Aya the apple from the table."]),
         ]},
        {"id": "apple", "title": "The apple", "starts": "item:apple, @near:2.2",
         "markers": [
            M("take_from", "", "The thing: apple (picked from the list) · It stays in the hand: on · Then, Says: \"Oh, you found it!\"",
              take_item="apple", keep_in_hand=True, say="Aya: Oh, you found it!"),
            M("eat", "the floor beside her (the pin isn't used)", "The thing: left empty: she eats what's in her hand", at=[2.6, 0, 1.3], yaw=-90),
            M("wait", "", "Seconds: 2.5 · Face: Smile · Then, Says: \"Thank you. I needed that.\" · Ticks: apple · Flags: + aya_fed (switched when the wait is over)",
              stay="secs", stay_secs=2.5, face="smile", say="Aya: Thank you. I needed that.", tick="apple", set_flags="+aya_fed"),
         ]},
        {"id": "key", "title": "The cellar key", "starts": "aya_fed",
         "markers": [
            M("wait", "", "Seconds: 1.5 · Then, Says: \"Wait. You'll want this for the cellar.\"", stay="secs", stay_secs=1.5, say="Aya: Wait. You'll want this for the cellar.", face="neutral"),
            M("walk", "the floor in front of the key's hook; arrow to the wall", "", at=[3.4, 0, 2.0], yaw=90),
            M("pick_up", "the key on its hook", "It stays in the hand: on", at=[3.9, 0.95, 2.0], yaw=90, target="CellarKey", keep_in_hand=True),
            M("walk", "", "Comes to you instead of to the pin: on · Stops: 1.0 m from you", to_player=True, stop_short=1.0),
            M("give_to", "", "Gives: left empty (what's in her hand) · Called: Cellar key · Then, Says: \"Don't lose it.\" · Adds tasks: cellar: Open the cellar door at the end of the corridor.",
              give_label="Cellar key", say="Aya: Don't lose it.", add_tasks=["cellar: Open the cellar door at the end of the corridor."]),
            M("walk", "the floor where she waits", "", at=[2.6, 0, 1.3], yaw=-90),
            M("talk", "", "Stays: until the next marker can start · Lines: \"The cellar's at the end of the corridor. I don't go down there.\"",
              stay="next", talks=[{"lines": ["Aya: The cellar's at the end of the corridor. I don't go down there."]}]),
         ]},
     ]},
    {"id": "Ken", "model": "man", "at": [2.05, 0, 10.4], "yaw": 180, "color": "#7BD88F", "npc": {"starts_hidden": True, "alive": True, "life_every": [3.0, 6.0]},
     "quests": [
        {"id": "customer", "title": "A can of soda", "starts": "behind_counter",
         "markers": [
            M("appear", "the street outside the shop's door", "Comes: when you're not looking", at=[2.05, 0, 10.4], yaw=180, how="unseen"),
            M("walk", "the floor in front of the till; arrow to the counter; two bends to bring him in through the door", "Head: follows you",
              at=[-1.4, 0, 5.95], yaw=180, bends=[[2.05, 0, 8.3], [0.8, 0, 6.7]], head="follow"),
            M("talk", "", "Lines: \"Evening.\" / \"A can of soda, please.\" · Answers: \"Coming up\" (flags: + soda_yes; he says \"Thanks.\") and \"We're out\" (flags: + soda_no; face: Sad; he says \"Oh. Never mind, then.\")",
              talks=[{"lines": ["Ken: Evening.", "A can of soda, please."],
                      "answers": [{"text": "Coming up", "sets": "+soda_yes", "reply": "Ken: Thanks."}, {"text": "We're out", "sets": "+soda_no", "face": "sad", "reply": "Ken: Oh. Never mind, then."}]}]),
            M("choice", "", "its two ways, below", ways=[
                {"when": "soda_yes", "note": "served", "markers": [
                    M("give_to", "", "Starts when: you carry soda, you're within 2.5 m · And money: 1.50", start_when="item:soda, @near:2.5", give_cash=1.5),
                    M("take_from", "", "The thing: soda · It stays in the hand: on · Then, Says: \"Keep the change.\"", take_item="soda", keep_in_hand=True, say="Ken: Keep the change."),
                    M("look_at", "", "Over what comes next: on (he looks at the can as he leaves)", gesture_along=True),
                ]},
                {"when": "soda_no", "note": "refused", "markers": [
                    M("gesture", "", "Does: Sighs · Face: Sad", gesture="sigh", face="sad"),
                ]},
            ]),
            M("walk", "the street outside the door; the same two bends, the other way round", "Head: is her animation's again", at=[2.05, 0, 10.4], yaw=0, face_arrow=False,
              bends=[[0.8, 0, 6.7], [2.05, 0, 8.3]], head="free"),
            M("disappear", "", "Then, Flags: + ken_gone", set_flags="+ken_gone"),
         ]},
     ]},
    {"id": "Rin", "model": "woman", "at": [2.05, 0, 10.7], "yaw": 180, "color": "#C792EA", "npc": {"starts_hidden": True},
     "quests": [
        {"id": "last", "title": "The last customer", "starts": "ken_gone",
         "markers": [
            M("appear", "the street outside the shop's door", "Starts when: after 3 s · Comes: when you're not looking", at=[2.05, 0, 10.4], yaw=180, how="unseen", start_when="@wait:3"),
            M("walk", "the floor in front of the till; the same two bends", "Speed: 0.55 × · Head: follows you, within 220 degrees · Small movements: none",
              at=[-1.4, 0, 5.95], yaw=180, bends=[[2.05, 0, 8.3], [0.8, 0, 6.7]], pace_scale=0.55, head="follow", head_range=220.0, life="still"),
            M("talk", "", "Stays: until the next marker can start · Lines: \"...\"", stay="next", turn_to_player=False, talks=[{"lines": ["Rin: ..."]}]),
            M("appear", "the open end of the counter; arrow along the counter, at you", "Starts when: after 2.5 s · Comes: when you're not looking", at=[0.75, 0, 5.2], yaw=-90, how="unseen", start_when="@wait:2.5"),
            M("wait", "", "Stays: until the next marker can start", stay="next"),
            M("appear", "the floor behind the counter, your side of it", "Starts when: after 2 s · Comes: when you're not looking", at=[-0.1, 0, 4.3], yaw=-90, how="unseen", start_when="@wait:2"),
            M("wait", "", "Stays: until the next marker can start", stay="next"),
            M("jumpscare", "the floor a little over a metre from where you'll stand", "Starts when: after 1.5 s · Comes: when you're not looking · Then, Sound: sting_big · Fires: ShopScare (the lights flicker)",
              at=[-1.2, 0, 4.3], yaw=-90, how="unseen", start_when="@wait:1.5", sound="sting_big", fire=["ShopScare"]),
            M("event", "", "Then, Flags: + rin_gone", set_flags="+rin_gone"),
         ]},
     ]},
    {"id": "It", "model": "creature", "at": [11.0, 0, 4.2], "yaw": 180, "color": "#FF5370", "npc": {"starts_hidden": True, "threat": True},
     "quests": [
        {"id": "corner", "title": "Round the corner", "starts": "in_corridor",
         "markers": [
            M("appear", "the floor round the corner, out of sight", "", at=[11.0, 0, 4.2], yaw=180),
            M("peek", "the foot of the wall's end, on its hidden side; turn the arrow to look back up the corridor", "Stays: until the next marker can start · Head: follows you",
              at=[10.0, 0, 1.45], yaw=-90, stay="next", head="follow"),
            M("walk", "the floor back down the side corridor", "Starts when: you see it, after 1.5 s · Pace: creep", at=[11.0, 0, 5.2], yaw=0, face_arrow=False, pace="creep", start_when="@seen, @wait:1.5", head="free"),
            M("disappear", "", ""),
            M("appear", "the corridor floor behind where you'll stand at the corner; arrow at the corner", "Starts when: the flag at_corner (the area at the corner) · Comes: when you're not looking · Then, Sound: breath_close",
              at=[9.3, 0, 0.45], yaw=90, how="unseen", start_when="at_corner", sound="breath_close"),
            M("wait", "", "Stays: until the next marker can start · Head: follows you", stay="next", head="follow"),
            M("jumpscare", "the same spot", "Starts when: you see it · Then, Sound: sting_big · Fires: CorridorScare (the lights flicker)",
              at=[9.3, 0, 0.45], yaw=90, start_when="@seen", sound="sting_big", fire=["CorridorScare"]),
            M("event", "", "Then, Flags: + corridor_done", set_flags="+corridor_done"),
         ]},
        {"id": "cellar", "title": "Out of the dark", "starts": "cellar_open",
         "markers": [
            M("appear", "the floor at the top of the side corridor, behind you", "Comes: when you're not looking · Then, Sound: scrape_stone", at=[11.0, 0, 2.2], yaw=0, how="unseen", sound="scrape_stone"),
            M("crawl", "the floor half way down to you", "", at=[11.0, 0, 4.0], yaw=0, face_arrow=False),
            M("walk", "", "Comes to you instead of to the pin: on · Stops: 0.9 m from you · Pace: creep", pace="creep", to_player=True, stop_short=0.9),
            M("attack", "", "Does: throws a punch · At: you", attack="punch"),
            M("disappear", "", "Then, Flags: + it_done", set_flags="+it_done"),
         ]},
     ]},
]

# the guide's recipes, in its order: [id, the character, her quests' ids, title]
RECIPES = [
    ["evening", "Mio", ["evening"], "A mug, the sofa, a look at it"],
    ["tidy", "Aya", ["tidy"], "Tidying up, then asking you for something"],
    ["apple", "Aya", ["apple"], "You give her the apple and she eats it"],
    ["key", "Aya", ["key"], "She fetches a key and hands it to you"],
    ["customer", "Ken", ["customer"], "A customer at the till"],
    ["last", "Rin", ["last"], "The last customer: nearer each time you look away"],
    ["corner", "It", ["corner"], "Round the corner, then behind you"],
    ["cellar", "It", ["cellar"], "Out of the dark: a crawl, a creep, a blow"],
]

# the editor's pictures: a recipe's storyboard with one of its markers picked, the 3D view on the part of the place it's in
VIEWS = [
    {"id": "evening", "npc": "Mio markers", "quest": "An evening in", "pick": "Looks at her hand", "at": [-1.2, 0.8, -0.6], "size": [6.2, 1.6, 5.2]},
    {"id": "tidy", "npc": "Aya markers", "quest": "Tidying up", "pick": "Put down", "at": [2.7, 0.8, -0.2], "size": [3.4, 1.6, 4.6]},
    {"id": "apple", "npc": "Aya markers", "quest": "The apple", "pick": "Take from you", "at": [1.0, 0.8, 0.6], "size": [8.0, 1.6, 4.0]},
    {"id": "key", "npc": "Aya markers", "quest": "The cellar key", "pick": "Hand to you", "at": [2.7, 0.8, 1.2], "size": [3.4, 1.6, 3.4]},
    {"id": "customer", "npc": "Ken markers", "quest": "A can of soda", "pick": "Choice", "at": [0.0, 0.8, 7.0], "size": [8.0, 1.6, 7.0]},
    {"id": "last", "npc": "Rin markers", "quest": "The last customer", "pick": "Start here2", "at": [0.0, 0.8, 6.5], "size": [8.0, 1.6, 6.5]},
    {"id": "corner", "npc": "It markers", "quest": "Round the corner", "pick": "Peek", "at": [8.6, 0.8, 1.6], "size": [7.5, 1.6, 5.5]},
    {"id": "cellar", "npc": "It markers", "quest": "Out of the dark", "pick": "Punch", "at": [10.6, 0.8, 4.6], "size": [4.0, 1.6, 7.6]},
]
ORBIT = [115, 100]      # the editor's 3D view turned once, in pixels of a middle-drag: from the south, looking down into the rooms

MODELS = {  # model -> (the Studio export on this machine, the Animator's test body)
    "woman": ("anim_normal_woman", "normal_woman"),
    "man": ("anim_skinny_man", "skinny_man"),
    "creature": ("creature_ghoul", "ghoul"),
}


def data():
    return {"boxes": BOXES, "lights": LIGHTS, "things": THINGS, "areas": AREAS, "player": PLAYER, "tasks": TASKS, "cast": CAST,
            "cards": {k: {"title": v[0], "kind": v[1], "set": v[2]} for k, v in CARDS.items()}}


# ---- the guide's tables ------------------------------------------------------------------------------------------------------
def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def rows(markers, pre=""):
    out = []
    for i, m in enumerate(markers, 1):
        lab = f"{pre}{i}"
        out.append((lab, CARDS[m["card"]][0], m.get("where", ""), m.get("form", ""), len(pre.split(".")) - 1 if pre else 0))
        for w, way in enumerate(m.get("ways", [])):
            wl = lab + chr(65 + w)
            out.append((wl, "way: " + (way.get("note") or "otherwise"), "", "Flags: " + way["when"] if way.get("when") else "no flags: otherwise", 1))
            out += rows(way["markers"], wl + ".")
        if m.get("inner"):
            out += rows(m["inner"], lab + ".")
    return out


def table(quest, npc):
    head = f'<p class="quest"><b>{esc(npc)}</b>, quest <b>{esc(quest["title"])}</b> &middot; Starts when: {esc(words(quest["starts"])) if quest["starts"] else "at once (the game starts)"}</p>'
    body = ['<table class="board">', "<tr><th>#</th><th>Card</th><th>Click in the 3D view</th><th>In its form</th></tr>"]
    for lab, card, where, form, depth in rows(quest["markers"]):
        cls = ' class="way"' if card.startswith("way: ") else ""
        pad = ' style="padding-left:%dpx"' % (10 + 16 * depth) if depth else ""
        body.append(f'<tr{cls}><td>{esc(lab)}</td><td{pad}>{esc(card)}</td><td>{esc(where) if where else "&mdash;"}</td><td>{esc(form) if form else "&mdash;"}</td></tr>')
    body.append("</table>")
    return head + "\n" + "\n".join(body)


def words(cond):
    """a condition's words as the tab's chips read"""
    out = []
    for w in [x.strip() for x in cond.split(",") if x.strip()]:
        neg = w.startswith("!")
        w = w.lstrip("!")
        if w.startswith("item:"):
            t = "you carry " + w[5:]
        elif w.startswith("task:"):
            t = "the task " + w[5:] + " is ticked"
        elif w.startswith("on:"):
            t = "the task " + w[3:] + " is open"
        elif w.startswith("@wait:"):
            t = "after " + w[6:] + " s"
        elif w.startswith("@near:"):
            t = "you're within " + w[6:] + " m"
        elif w.startswith("@far:"):
            t = "you're further than " + w[5:] + " m"
        elif w == "@seen":
            t = "you see them"
        elif w == "@unseen":
            t = "you can't see them"
        else:
            t = "the flag " + w
        out.append(("not " if neg else "") + t)
    return ", ".join(out)


def tables(args):
    page = GUIDE / "index.html"
    if not page.is_file():
        sys.exit("tables: guides/sequences/index.html isn't there")
    text = page.read_text(encoding="utf-8")
    quests = {q["id"]: (c["id"], q) for c in CAST for q in c["quests"]}
    new = text
    missing = []
    for qid, (npc, q) in quests.items():
        pat = re.compile(r"(<!-- seq:%s -->).*?(<!-- /seq -->)" % re.escape(qid), re.S)
        if not pat.search(new):
            missing.append(qid)
            continue
        new = pat.sub(lambda mo, npc=npc, q=q: mo.group(1) + "\n" + table(q, npc) + "\n" + mo.group(2), new, count=1)
    for qid in missing:
        print(f"ERROR: the guide has no <!-- seq:{qid} --> ... <!-- /seq --> for the quest '{qid}'")
    if "--check" in args:
        if new != text:
            print("ERROR: the guide's tables aren't the data's: python tools/godot/sequences.py tables")
        ok = new == text and not missing
        print("SEQTABLES ok" if ok else "SEQTABLES FAILED")
        return 0 if ok else 1
    if new != text:
        page.write_text(new, encoding="utf-8")
    print(f"tables: {len(quests) - len(missing)} storyboards in {page}" + (" (unchanged)" if new == text else ""))
    return 1 if missing else 0


def guide_check():
    """the guide's page against what's on disk: every picture it shows is there, every picture of its own is shown,
    every link lands (a file, and its #place); its card in the guides' index -> the problems"""
    errs = []
    page = GUIDE / "index.html"
    if not page.is_file():
        return ["guides/sequences/index.html isn't there"]
    text = page.read_text(encoding="utf-8")
    shown = set(re.findall(r'src="([^"]+)"', text))
    for src in sorted(shown):
        if not (GUIDE / src).resolve().is_file():
            errs.append(f"the guide shows {src}, which isn't there")
    own = {f"img/{f.name}" for f in (GUIDE / "img").glob("*.jpg")} if (GUIDE / "img").is_dir() else set()
    for f in sorted(own - shown):
        errs.append(f"the guide's {f} isn't shown anywhere")
    ids = set(re.findall(r'id="([^"]+)"', text))
    for href in sorted(set(re.findall(r'href="([^"]+)"', text))):
        if href.startswith("#"):
            if href[1:] not in ids:
                errs.append(f"the guide links to {href}, which isn't a place in it")
            continue
        if href.startswith("http"):
            errs.append(f"the guide links outside: {href}")
            continue
        path, _, frag = href.partition("#")
        target = (GUIDE / path).resolve()
        if not target.is_file():
            errs.append(f"the guide links to {href}, which isn't there")
        elif frag and f'id="{frag}"' not in target.read_text(encoding="utf-8"):
            errs.append(f"the guide links to {href}: no such place in that page")
    index = (ROOT / "guides" / "index.html").read_text(encoding="utf-8")
    if 'href="sequences/index.html"' not in index:
        errs.append("guides/index.html has no card for the sequences guide")
    return errs


# ---- the project -------------------------------------------------------------------------------------------------------------
def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def run(cmd, timeout=1800, env=None):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)


def xvfb(cmd, size="1280x720"):
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json") and not env.get("DISPLAY"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    if shutil.which("xvfb-run") and not env.get("DISPLAY"):
        cmd = ["xvfb-run", "-a", "-s", f"-screen 0 {size}x24"] + cmd
    return cmd, env


def characters(proj, name):
    """the three models baked into the project's characters/: -> {model: where it came from}"""
    out = {}
    (proj / "characters").mkdir(exist_ok=True)
    scratch = ROOT / "Saved" / "Animator" / "check"
    for model, (export, body) in MODELS.items():
        src = ROOT / "Exports" / "characters" / export / f"{export}.glb"
        if not src.is_file() or os.environ.get("SEQ_PLAIN"):
            r = run(["node", str(ROOT / "tools" / "animator" / "bodies.mjs"), "--out", str(scratch), body], timeout=900)
            if "BODIES ok" not in r.stdout:
                sys.exit(f"{name} FAILED: the test body {body}: " + (r.stdout + r.stderr)[-1500:])
            src = scratch / f"{body}.glb"
            out[model] = f"the Animator's test body {body}"
        else:
            out[model] = f"Exports/characters/{export}"
        r = run(["node", str(ROOT / "tools" / "animator" / "bake.mjs"), str(src), "--out", str(proj / "characters" / f"{model}.glb")], timeout=1200)
        if "BAKE ok" not in r.stdout:
            sys.exit(f"{name} FAILED: the bake of {model}: " + (r.stdout + r.stderr)[-1500:])
    return out


def project(args, name):
    """the project, made or reused, its scene built; -> its folder"""
    g = godot_bin()
    if not g:
        sys.exit(f"{name} FAILED: no godot (tools/godot_setup.sh on a cloud session)")
    proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_sequences"
    mark = proj / "sequences_made.json"
    fresh = not ("--reuse" in args and mark.is_file() and all((proj / "characters" / f"{m}.glb").is_file() for m in MODELS))
    if fresh:
        if proj.exists() and any(proj.iterdir()) and not mark.exists():
            sys.exit(f"{name} FAILED: {proj} has things in it this didn't make: give --keep a new folder")
        shutil.rmtree(proj, ignore_errors=True)
        if BH.main(["new", str(proj), "--name", "Sequences"]):
            sys.exit(f"{name} FAILED: godot_byhand.py new")
        mark.write_text(json.dumps({"characters": characters(proj, name)}, indent=1), encoding="utf-8")
    else:
        BH.install(proj, starter=True)
        print(f"  reusing {proj}")
    (proj / "sequences.json").write_text(json.dumps(data(), indent=1), encoding="utf-8")
    shutil.copy(HERE / "sequences_build.gd", proj / "sequences_build.gd")
    pg = proj / "project.godot"
    text = pg.read_text(encoding="utf-8")
    if "run/main_scene" not in text:
        text = text.replace("[application]\n", '[application]\n\nrun/main_scene="res://main.tscn"\n', 1)
        pg.write_text(text, encoding="utf-8")
    for _ in range(3):
        run([g, "--headless", "--path", str(proj), "--import"], timeout=2400)
        if all(list((proj / ".godot" / "imported").glob(f"{m}.glb-*.scn")) for m in MODELS):
            break
    r = run([g, "--headless", "--path", str(proj), "-s", "sequences_build.gd"], timeout=900)
    said = [ln for ln in (r.stdout + r.stderr).splitlines() if ln.startswith("SEQBUILD ")]
    for ln in said:
        print("  " + ln[9:])
    if not any(ln.startswith("SEQBUILD ok") for ln in said) or not (proj / "main.tscn").is_file():
        sys.exit(f"{name} FAILED: the scene wasn't built: " + (r.stdout + r.stderr)[-3000:])
    return proj


def game(args):
    proj = project(args, "SEQUENCES")
    g = godot_bin()
    shutil.copy(HERE / "sequences_test.gd", proj / "sequences_test.gd")
    cmd = [g, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "sequences_test.gd"]
    if "--only" in args:
        cmd += ["--", "--only=" + args[args.index("--only") + 1]]
    r = run(cmd, timeout=2400)
    got = [ln for ln in r.stdout.splitlines() if ln.startswith("SEQUENCES ")]
    for ln in got:
        if not ln.startswith("SEQUENCES result "):
            print("  " + ln[10:])
    res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("SEQUENCES result ")), None)
    if res is None:
        sys.exit("SEQUENCES FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-4000:])
    errs = list(res.get("errors", []))
    errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:10]
    saved = (proj / "main.tscn").read_text(encoding="utf-8")
    for word in ["_Ghost", "_Talk", "_MarkerClips", "_LogicReach", "hs_given"]:
        if word in saved:
            errs.append(f"the built scene holds '{word}': something made for the game was saved")
    if GUIDE.joinpath("index.html").is_file() and tables(["--check"]):
        errs.append("the guide's tables aren't the data's")
    errs += guide_check()
    for e in errs:
        print("ERROR: " + e)
    print("SEQUENCES ok" if not errs else f"SEQUENCES FAILED ({len(errs)})")
    return 1 if errs else 0


def jpeg(src, dst, width=0):
    from PIL import Image
    im = Image.open(src).convert("RGB")
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, quality=86, optimize=True)


def pictures(args):
    proj = project(args, "SEQPICTURES")
    g = godot_bin()
    out = ROOT / "Saved" / "Sequences" / "shots"
    out.mkdir(parents=True, exist_ok=True)
    shutil.copy(HERE / "sequences_shots.gd", proj / "sequences_shots.gd")
    cmd = [g, "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1280x720", "--fixed-fps", "60", "-s", "sequences_shots.gd", "--", "--out=" + str(out)]
    if "--only" in args:
        cmd.append("--only=" + args[args.index("--only") + 1])
    cmd, env = xvfb(cmd)
    r = run(cmd, timeout=3400, env=env)
    for ln in r.stdout.splitlines():
        if ln.startswith("SEQSHOTS "):
            print("  " + ln[9:])
    errs = [ln.strip() for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:10]
    img = GUIDE / "img"
    img.mkdir(parents=True, exist_ok=True)
    made = 0
    for png in sorted(out.glob("*.png")):
        jpeg(png, img / (png.stem + ".jpg"), 1280)
        made += 1
    for e in errs:
        print("ERROR: " + e)
    print(f"pictures: {made} in {img}" if not errs else f"pictures FAILED ({len(errs)})")
    return 1 if errs else 0


def editor(args):
    proj = project(args, "SEQEDITOR")
    g = godot_bin()
    out = ROOT / "Saved" / "Sequences" / "editor"
    out.mkdir(parents=True, exist_ok=True)
    t = proj / "addons" / "hs_sequences_shots"
    t.mkdir(parents=True, exist_ok=True)
    (t / "plugin.cfg").write_text('[plugin]\nname="hs sequences shots"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n', encoding="utf-8")
    shutil.copy(HERE / "sequences_editor_shots.gd", t / "plugin.gd")
    pg = proj / "project.godot"
    before = pg.read_text(encoding="utf-8").replace('"res://addons/hs_sequences_shots/plugin.cfg", ', "")
    pg.write_text(before.replace("enabled=PackedStringArray(", 'enabled=PackedStringArray("res://addons/hs_sequences_shots/plugin.cfg", ', 1), encoding="utf-8")
    only = args[args.index("--only") + 1].split(",") if "--only" in args else None
    orbit = [float(x) for x in args[args.index("--orbit") + 1].split(",")] if "--orbit" in args else ORBIT
    (proj / "sequences_editor.json").write_text(json.dumps({"out": str(out), "views": [v for v in VIEWS if only is None or v["id"] in only], "orbit": orbit}), encoding="utf-8")
    try:
        shutil.rmtree(proj / ".godot" / "editor", ignore_errors=True)
        cmd, env = xvfb([g, "--editor", "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1920x1080", "res://main.tscn"], "1920x1080")
        r = run(cmd, timeout=2400, env=env)
    finally:
        pg.write_text(before, encoding="utf-8")
        shutil.rmtree(t, ignore_errors=True)
    text = r.stdout + r.stderr
    line = next((ln for ln in text.splitlines() if ln.startswith("SEQEDITOR ")), None)
    if line is None:
        sys.exit("SEQEDITOR FAILED: the editor said nothing: " + text[-4000:])
    rep = json.loads(line[len("SEQEDITOR "):])
    for what in rep.get("did", []):
        print("  " + what)
    errs = list(rep.get("errors", []))
    img = GUIDE / "img"
    img.mkdir(parents=True, exist_ok=True)
    made = 0
    for png in sorted(out.glob("*.png")):
        jpeg(png, img / (png.stem + ".jpg"), 1600)
        made += 1
    for e in errs:
        print("ERROR: " + e)
    print(f"editor pictures: {made} in {img}" if not errs else f"SEQEDITOR FAILED ({len(errs)})")
    return 1 if errs else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "data":
        print(json.dumps(data(), indent=1))
        sys.exit(0)
    if a and a[0] == "tables":
        sys.exit(tables(a[1:]))
    if a and a[0] == "guide":                                   # the page alone: its tables, pictures and links (no Godot)
        bad = guide_check()
        for e in bad:
            print("ERROR: " + e)
        t = tables(["--check"])
        print("SEQGUIDE ok" if not bad and not t else "SEQGUIDE FAILED")
        sys.exit(1 if bad or t else 0)
    if "--pictures" in a:
        sys.exit(pictures(a))
    if "--editor" in a:
        sys.exit(editor(a))
    sys.exit(game(a))
