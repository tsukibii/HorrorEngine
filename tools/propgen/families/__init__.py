"""The prop families: each a module with make(spec, thing) that fills in a build.Thing (its materials, islands, game
mesh, detailed mesh and paint). FAMILIES names them; a recipe's `family` picks one."""
from . import ammo, appliance, bedding, bits, book, bottle, box, can, candle, chair, charm, closet, clothes, cookware, cup, curtain, doll, imported, key, pills, plant, retro, rock, rope, sack, sheet, shrine, sink, suitcase, table, tree, utensil, ware, weapon

FAMILIES = {"can": can, "bottle": bottle, "cup": cup, "sheet": sheet, "box": box, "import": imported, "utensil": utensil,
            "key": key, "ware": ware, "bits": bits, "sack": sack, "pills": pills, "candle": candle, "charm": charm, "rope": rope, "doll": doll, "shrine": shrine, "cookware": cookware, "appliance": appliance, "sink": sink, "book": book, "tree": tree, "plant": plant, "bedding": bedding, "curtain": curtain, "table": table, "chair": chair, "suitcase": suitcase, "clothes": clothes, "closet": closet, "rock": rock, "retro": retro, "weapon": weapon, "ammo": ammo}
