"""The prop families: each a module with make(spec, thing) that fills in a build.Thing (its materials, islands, game
mesh, detailed mesh and paint). FAMILIES names them; a recipe's `family` picks one."""
from . import bits, bottle, box, can, cup, imported, key, sack, sheet, utensil, ware

FAMILIES = {"can": can, "bottle": bottle, "cup": cup, "sheet": sheet, "box": box, "import": imported, "utensil": utensil,
            "key": key, "ware": ware, "bits": bits, "sack": sack}
