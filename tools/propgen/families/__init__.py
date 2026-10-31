"""The prop families: each a module with make(spec, thing) that fills in a build.Thing (its materials, islands, game
mesh, detailed mesh and paint). FAMILIES names them; a recipe's `family` picks one."""
from . import appliance, bits, bottle, box, can, candle, charm, cookware, cup, doll, imported, key, pills, rope, sack, sheet, shrine, sink, utensil, ware

FAMILIES = {"can": can, "bottle": bottle, "cup": cup, "sheet": sheet, "box": box, "import": imported, "utensil": utensil,
            "key": key, "ware": ware, "bits": bits, "sack": sack, "pills": pills, "candle": candle, "charm": charm, "rope": rope, "doll": doll, "shrine": shrine, "cookware": cookware, "appliance": appliance, "sink": sink}
