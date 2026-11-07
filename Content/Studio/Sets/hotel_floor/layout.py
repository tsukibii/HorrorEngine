"""Writes Content/Studio/Sets/hotel_floor/layout.json: the third floor of a business hotel at night (guides/tutorial_v2).
x east, y north, metres; the third floor at z 2.85, the stairwell's foot (the second floor) at z 0."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "layout.json"        # then: node tools/director/layoutset.mjs --file <it> hotel_floor
Z, H = 2.85, 2.6                              # the hotel floor and its ceiling
PLASTER = "pbr/wall/Plaster001_1K-PNG"
WALLPAPER = {"set": PLASTER, "tint": "#cbbd9e", "tint_amount": 0.5}
CONCRETE, CONCRETE_DARK = "pbr/concrete/Concrete006_1K-PNG", "pbr/concrete/Concrete029_1K-PNG"
CARPET_HALL, CARPET_ROOM = "#4b2a2c", "#6a5a4a"


def look(floor=None, walls=WALLPAPER, ceiling=PLASTER):
    lk = {"walls": walls, "ceiling": ceiling}
    if floor:
        lk["floor"] = floor
    return lk


def room(id, kind, name, x0, y0, x1, y1, **o):
    return [id, kind, name, x0, y0, x1, y1, o]


def bare(id, name, x0, y0, x1, y1):           # a guest room nobody enters: walls, a floor, its door locked for good
    return room(id, "bedroom", name, x0, y0, x1, y1, z=Z, h=H, fixtures=False, light="off", floor="carpet",
                floorKit=None, extra={"look": look(CARPET_ROOM)})


stair_mats = [{"id": f"stairs_fx_{p}", "mat": CONCRETE_DARK} for p in ("stairs_1a", "stairs_1b", "half_1", "landing_2", "stairs_1base")]
rooms = [
    room("stairs", "stairs", "Stairwell", 0, 8, 2.6, 12.8, h=Z + H, dir="n", flights=2, stair="apartment", light="dim", floor="stone",
         extra={"look": look(CONCRETE, CONCRETE, CONCRETE), "props": stair_mats}),
    room("corridor", "corridor", "Third floor corridor", 0, 6, 18.4, 8, z=Z, h=H, floor="carpet", floorKit=None,
         extra={"look": look(CARPET_HALL)}),
    room("r304", "bedroom", "Room 304", 4.6, 0, 9.2, 4.0, z=Z, h=H, open=["n"], floor="carpet", floorKit=None,
         extra={"look": look(CARPET_ROOM)}),
    room("r304_entry", "corridor", "304 entry", 6.6, 4.0, 9.2, 6.0, z=Z, h=H, open=["s"], floor="carpet", floorKit=None,
         extra={"look": look(CARPET_ROOM)}),
    room("r304_bath", "bath", "304 bath", 4.6, 4.0, 6.6, 6.0, z=Z, h=2.4,
         extra={"look": look(None, "pbr/plastic/white_plastic", "pbr/plastic/white_plastic"),
                "props": [{"id": "r304_toilet", "shape": "box 0.4 0.68 0.8", "at": [1.6, 1.6], "rot": 180, "tag": "toilet", "mat": "pbr/plastic/white_plastic"}]}),
    room("linen", "closet", "Linen closet", 7.2, 8, 9.2, 10.4, z=Z, h=H, floor="tile", floorKit=None,
         extra={"look": look(CONCRETE, PLASTER)}),
    room("vending", "common", "Vending corner", 9.2, 8, 11.6, 10.4, z=Z, h=H, floor="tile",
         extra={"look": look("#3c3a38", PLASTER)}),
    bare("r301", "Room 301", 2.6, 8, 7.2, 14),
    bare("r303", "Room 303", 11.6, 8, 16.2, 14),
    room("staff", "storage", "Staff only", 16.2, 8, 18.4, 11, z=Z, h=H, fixtures=False, light="off", floor="tile", floorKit=None,
         extra={"look": look(CONCRETE, PLASTER)}),
    room("landing_2f", "common", "Second floor landing", 0, 6, 2.6, 8, h=H, light="off", floor="carpet",
         extra={"look": look(CARPET_HALL)}),                  # where the player came from: its door locked behind them
    bare("r302", "Room 302", 0, 0, 4.6, 6),
    bare("r306", "Room 306", 9.2, 0, 13.8, 6),
    bare("r308", "Room 308", 13.8, 0, 18.4, 6),
]
FLUSH, PANELS = {"kit": {"preset": "door_flush"}}, {"kit": {"preset": "door_panels"}}
NEVER = "flag:never"
doors = [
    ["corridor", "stairs", "door", {"id": "stair_door", "w": 0.9, "h": 2.05, "extra": FLUSH}],
    ["landing_2f", "stairs", "door", {"id": "door_2f", "w": 0.9, "h": 2.05, "z": 0, "locked_by": NEVER, "extra": FLUSH}],   # the way back, shut
    ["corridor", "r304_entry", "door", {"id": "door_304", "w": 0.85, "h": 2.05, "locked_by": "key_304", "extra": PANELS}],
    ["r304_entry", "r304_bath", "door", {"id": "door_304_bath", "w": 0.7, "h": 2.0, "at": 0.2, "extra": FLUSH}],
    ["corridor", "linen", "door", {"id": "door_linen", "w": 0.8, "h": 2.05, "extra": FLUSH}],
    ["corridor", "vending", "arch", {"w": 2.0}],
    ["corridor", "r301", "door", {"id": "door_301", "w": 0.85, "h": 2.05, "at": 0.7, "locked_by": NEVER, "extra": PANELS}],
    ["corridor", "r303", "door", {"id": "door_303", "w": 0.85, "h": 2.05, "at": 0.3, "locked_by": NEVER, "extra": PANELS}],
    ["corridor", "staff", "door", {"id": "door_staff", "w": 0.8, "h": 2.05, "locked_by": NEVER, "extra": FLUSH}],
    ["corridor", "r302", "door", {"id": "door_302", "w": 0.85, "h": 2.05, "at": 0.7, "locked_by": NEVER, "extra": PANELS}],
    ["corridor", "r306", "door", {"id": "door_306", "w": 0.85, "h": 2.05, "at": 0.3, "locked_by": NEVER, "extra": PANELS}],
    ["corridor", "r308", "door", {"id": "door_308", "w": 0.85, "h": 2.05, "at": 0.3, "locked_by": NEVER, "extra": PANELS}],
]
windows = [
    ["corridor", "w", "window", {"at": 0.5, "w": 1.0, "h": 1.2, "sill": 0.9}],                 # the end window: rain on it
    ["corridor", "e", "door", {"at": 0.5, "w": 0.9, "h": 2.05, "extra": FLUSH}],             # the fire exit
    ["r304", "s", "window", {"at": 0.5, "w": 1.8, "h": 1.4, "sill": 0.7}],
    ["stairs", "n", "window", {"at": 0.5, "w": 0.6, "h": 0.9, "sill": 1.9, "frame": {"preset": "window_fixed"}}],
]
items = [["r304", "w", "frame", 0.5], ["r304", "n", "ac", 0.3], ["corridor", "s", "frame", 0.36], ["linen", "w", "switch", 0.8]]
TUBE = {"use": "light", "kind": "bulb", "lit": True, "kelvin": 4200, "lumens": 800}
kits = [["corridor", "tube_batten", x, 1.0, 0, {"z": 2.48, "extra": dict(TUBE)}] for x in (2.2, 5.8, 9.4, 13.0, 16.6)]
kits += [["corridor", "runner", x, 1.0, 0, {}] for x in (4.0, 9.2, 14.4)]
kits += [
    ["stairs", "tube_batten", 1.3, 0.09, 180, {"z": 2.35, "extra": dict(TUBE, lumens=600)}],
    ["stairs", "tube_batten", 1.3, 0.09, 180, {"z": Z + 2.35, "extra": dict(TUBE, lumens=600)}],
    ["r304", "bed_double", 1.08, 1.75, 90, {}],
    ["r304", "desk", 4.25, 1.55, 270, {"mats": {"wood": "pbr/wood/WoodWalnut001_2K-JPG"}}],
    ["r304", "dining_chair", 3.62, 1.55, 90, {}],
    ["r304", "tv_55", 4.52, 2.75, 270, {"z": 1.15}],
    ["r304", "floor_lamp", 0.3, 0.3, 0, {"extra": {"use": "light", "kind": "lamp", "lit": True, "kelvin": 2700, "lumens": 450}}],
    ["r304", "curtain_blackout", 2.3, 0.27, 180, {}],
    ["r304_bath", "vanity_mirror", 1.0, 1.93, 0, {"z": 1.0}],           # rot 0 faces south: into the bath
    ["linen", "bookshelf", 1.0, 2.2, 0, {}],
    ["vending", "fridge", 0.5, 2.0, 0, {}],
    ["vending", "desk", 1.65, 2.05, 0, {}],
]
L = {"id": "hotel_floor", "name": "Hotel, third floor",
     "note": "tutorial v2 (guides/tutorial_v2): a business hotel's third floor at night, its stairwell up from the second; room 304 locked by its key, the other rooms locked for good, the fire exit at the corridor's end",
     "floors": [0, Z], "rooms": rooms, "doors": doors, "windows": windows, "items": items, "kits": kits,
     "finish": {"wainscot": 0, "skirting": 0.08, "casing": 0.06},
     "start": [1.3, 8.55, 90], "her": [15.4, 7.0, 180], "herZ": Z}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(L, indent=1) + "\n", encoding="utf-8")
print("wrote", OUT)
