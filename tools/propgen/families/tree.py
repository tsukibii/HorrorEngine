"""Trees: the small trees of a street, grown by Mtree's functions (../mtree.py, after Maxime Herpin's Modular Tree
core, MIT) and meshed for a game: the trunk and the branches as tubes (few sides on the twigs, a flare at the roots,
every branch rooted inside its parent), the leaves as cards of leaf clusters drawn by code (a species' own leaf shape,
its colours by season, the twig they hang from) on a see-through texture, alpha-cut in Godot, their normals rounded
over the crown so they light as a mass; the bark drawn by code too, a tile that goes round and up the trunk (ridges,
flakes, lenticels, mottled plates, scales), or a PBR set off the shelf (`pbr: {"bark": ...}`). Street trees are pruned
to a clear stem (`clear`), and a young one is held by stakes (`stakes`) in a tree pit (`pit`), as along a Tokyo street.

    {"family": "tree", "kind": "zelkova", "height": 8, "clear": 2.4, "season": "summer", "seed": 3,
     "stakes": "torii", "pit": "kerb", "spread": 1.0, "droop": 1.0, "density": 1.0, "crown": 1.0,
     "leaves": {"size": 0.42, "count": 1800, "tint": null}, "bark": {"color": null, "relief": 1.0}}

    "kind": "zelkova" | "ginkgo" | "cherry" | "camphor" | "plane" | "maple" | "crape_myrtle" | "pine" | "dead"
    "season": "summer" | "autumn" | "spring" | "winter"
    "stakes": "none" | "torii" | "tripod" | "single"
    "pit": "none" | "kerb" | "soil"
    "twigs": "auto" | "mesh" | "cards"

`bark`: `pbr` a set off the shelf (each species' real bark by default: pbr/bark/Bark001, 006 or 014; null for the
tile drawn by code), `tile` metres a repeat, `tint`, `relief`; `height` metres over all; `clear` the trunk below the first branch; `spread` turns the branches out (1 the species'
own), `droop` is gravity on them, `density` how many, `crown` their length, `levels` how many orders of branches (2 or
3; the last order carries the leaves, meshed only when the tree is bare unless `twigs` says); `lean` degrees off the
vertical; `pollard` cuts a plane tree back to knuckles with a broom of shoots; `multi` grows several stems from the
ground (a crape myrtle). Winter and the dead tree are bare. The same seed grows the same tree; another seed another one.
"""
import math

import numpy as np

from .. import bake as BK
from .. import mesh as M
from .. import mtree as T
from .. import noise as N
from ..paint import rgb

MM = 0.001
UP = np.array([0.0, 0.0, 1.0])

# ---- the species: how each grows (Mtree's words), its leaf and its bark; numbers for its default height ----------------
# levels: the orders of branches on the trunk, each on the one before; `length` and `angle` as Mtree properties along
# the parent (from its start to its end); lengths are shares of the tree's height.
SPECIES = {
    "zelkova": {  # ケヤキ, the Tokyo avenue tree: a vase of rising limbs, a broom of fine twigs, small serrated leaves
        "height": 9.0, "clear": 2.6, "radius": 0.17, "trunk": {"frac": 0.72, "shape": 0.75, "randomness": 0.5, "up": 0.7},
        "levels": [
            {"end": 0.92, "density": 2.4, "length": {"from": 0.42, "to": 0.2}, "angle": {"from": 38, "to": 22}, "start_radius": 0.38,
             "end_radius": 0.12, "randomness": 0.3, "gravity": 3.0, "stiffness": 0.2, "split": 0.55, "split_angle": 28, "split_radius": 0.8,
             "up": 0.5, "flatness": 0.25, "break": 0.01, "resolution": 3},
            {"start": 0.2, "density": 3.2, "length": {"from": 0.18, "to": 0.1}, "angle": [32, 52], "start_radius": 0.42, "end_radius": 0.15,
             "randomness": 0.45, "gravity": 5.0, "stiffness": 0.12, "split": 0.45, "split_angle": 35, "split_radius": 0.8, "up": 0.3,
             "flatness": 0.35, "break": 0.02, "resolution": 3},
            {"start": 0.1, "density": 6.5, "length": [0.045, 0.085], "angle": [40, 70], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.5, "gravity": 3.0, "stiffness": 0.1, "split": 0.3, "split_angle": 40, "split_radius": 0.8, "up": 0.3,
             "flatness": 0.4, "break": 0.03, "resolution": 6}],
        "leaf": {"shape": "elliptic", "mm": (52, 26), "serrate": True, "card": 0.5, "cluster": 9, "gloss": 0.5, "count": 2600,
                 "colors": {"summer": ["#4d7a2c", "#6a9a3a"], "spring": ["#7fb04a", "#a6cc62"], "autumn": ["#c9702a", "#d9a63a", "#b8482a"]}},
        "bark": {"style": "flaky", "color": "#7c7268", "flake": "#8e6c4c", "relief": 1.0, "pbr": "pbr/bark/Bark006_1K-PNG"},
        "pipe": {"end": 0.0035, "growth": 0.6, "power": 2.4},
    },
    "ginkgo": {  # イチョウ: upright, a narrow crown of short limbs, fan leaves gold in autumn, furrowed grey bark
        "height": 9.0, "clear": 2.6, "radius": 0.16, "trunk": {"frac": 0.86, "shape": 0.8, "randomness": 0.3, "up": 0.9},
        "levels": [
            {"end": 0.96, "density": 2.8, "length": {"from": 0.26, "to": 0.1}, "angle": {"from": 62, "to": 40}, "start_radius": 0.3,
             "end_radius": 0.15, "randomness": 0.25, "gravity": 2.5, "stiffness": 0.25, "split": 0.25, "split_angle": 30, "split_radius": 0.75,
             "up": 0.35, "flatness": 0.5, "break": 0.01, "resolution": 3},
            {"start": 0.15, "density": 3.0, "length": {"from": 0.12, "to": 0.07}, "angle": [35, 60], "start_radius": 0.4, "end_radius": 0.2,
             "randomness": 0.4, "gravity": 3.0, "stiffness": 0.15, "split": 0.3, "split_angle": 35, "split_radius": 0.8, "up": 0.3,
             "flatness": 0.4, "break": 0.02, "resolution": 3},
            {"start": 0.1, "density": 7.0, "length": [0.035, 0.07], "angle": [35, 65], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.45, "gravity": 2.0, "stiffness": 0.1, "split": 0.25, "split_angle": 40, "split_radius": 0.8, "up": 0.4,
             "flatness": 0.4, "break": 0.03, "resolution": 6}],
        "leaf": {"shape": "fan", "mm": (58, 70), "card": 0.46, "cluster": 8, "gloss": 0.5, "count": 2300,
                 "colors": {"summer": ["#5c8a37", "#7aa84a"], "spring": ["#86b652", "#a9cf6a"], "autumn": ["#e8c23a", "#f0d050", "#d9a82c"]}},
        "bark": {"style": "furrowed", "color": "#857a6d", "crack": "#4a423a", "relief": 1.0, "pbr": "pbr/bark/Bark001_1K-PNG"},
        "pipe": {"end": 0.0035, "growth": 0.7, "power": 2.5},
    },
    "cherry": {  # ソメイヨシノ: a low fork, spreading limbs, lenticelled dark bark; blossom in spring
        "height": 7.0, "clear": 2.0, "radius": 0.19, "trunk": {"frac": 0.5, "shape": 0.6, "randomness": 0.7, "up": 0.45},
        "levels": [
            {"start": 0.0, "end": 0.98, "density": 3.0, "length": {"from": 0.5, "to": 0.36}, "angle": {"from": 52, "to": 38}, "start_radius": 0.5,
             "end_radius": 0.12, "randomness": 0.4, "gravity": 6.0, "stiffness": 0.14, "split": 0.6, "split_angle": 38, "split_radius": 0.82,
             "up": 0.3, "flatness": 0.3, "break": 0.01, "resolution": 3},
            {"start": 0.25, "density": 3.0, "length": {"from": 0.2, "to": 0.11}, "angle": [38, 62], "start_radius": 0.42, "end_radius": 0.15,
             "randomness": 0.5, "gravity": 7.0, "stiffness": 0.1, "split": 0.45, "split_angle": 40, "split_radius": 0.8, "up": 0.2,
             "flatness": 0.4, "break": 0.02, "resolution": 3},
            {"start": 0.1, "density": 6.0, "length": [0.05, 0.09], "angle": [40, 75], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.5, "gravity": 4.0, "stiffness": 0.1, "split": 0.3, "split_angle": 45, "split_radius": 0.8, "up": 0.2,
             "flatness": 0.4, "break": 0.03, "resolution": 6}],
        "leaf": {"shape": "ovate", "mm": (78, 42), "serrate": True, "card": 0.52, "cluster": 8, "gloss": 0.5, "count": 2400,
                 "colors": {"summer": ["#4a7a30", "#699c42"], "spring": ["#f7dde7", "#f2c9d8"], "autumn": ["#c9562a", "#d98a2e", "#a63a22"]},
                 "blossom": "spring"},
        "bark": {"style": "lenticels", "color": "#4f4642", "lenticel": "#a39383", "relief": 1.0, "pbr": "pbr/bark/Bark014_1K-PNG", "tint": "#9a9a9c"},
        "pipe": {"end": 0.0035, "growth": 0.7, "power": 2.4},
    },
    "camphor": {  # クスノキ: a broad dome of glossy evergreen leaves over a thick, deeply furrowed trunk
        "height": 9.0, "clear": 2.4, "radius": 0.24, "trunk": {"frac": 0.5, "shape": 0.55, "randomness": 0.55, "up": 0.5},
        "levels": [
            {"start": 0.0, "end": 0.98, "density": 2.6, "length": {"from": 0.55, "to": 0.4}, "angle": {"from": 48, "to": 30}, "start_radius": 0.5,
             "end_radius": 0.12, "randomness": 0.35, "gravity": 4.0, "stiffness": 0.16, "split": 0.6, "split_angle": 36, "split_radius": 0.82,
             "up": 0.45, "flatness": 0.3, "break": 0.01, "resolution": 3},
            {"start": 0.25, "density": 2.0, "length": {"from": 0.2, "to": 0.12}, "angle": [35, 60], "start_radius": 0.42, "end_radius": 0.15,
             "randomness": 0.45, "gravity": 5.0, "stiffness": 0.12, "split": 0.4, "split_angle": 38, "split_radius": 0.8, "up": 0.35,
             "flatness": 0.4, "break": 0.02, "resolution": 3},
            {"start": 0.1, "density": 6.5, "length": [0.045, 0.085], "angle": [40, 70], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.5, "gravity": 3.0, "stiffness": 0.1, "split": 0.3, "split_angle": 40, "split_radius": 0.8, "up": 0.4,
             "flatness": 0.4, "break": 0.03, "resolution": 6}],
        "leaf": {"shape": "elliptic", "mm": (88, 38), "card": 0.56, "cluster": 8, "gloss": 0.32, "count": 2600,
                 "colors": {"summer": ["#3e6b2a", "#5f8f3c"], "spring": ["#6b9a3c", "#9fc45a"], "autumn": ["#3e6b2a", "#5f8f3c"]}},
        "bark": {"style": "furrowed", "color": "#6f655a", "crack": "#3a332c", "relief": 1.3, "scale": 1.3, "pbr": "pbr/bark/Bark001_1K-PNG", "tint": "#b0a898"},
        "pipe": {"end": 0.004, "growth": 0.9, "power": 2.4},
    },
    "plane": {  # プラタナス: big lobed leaves, bark in camouflage plates; along a street, often pollarded (`pollard`)
        "height": 10.0, "clear": 2.8, "radius": 0.2, "trunk": {"frac": 0.74, "shape": 0.7, "randomness": 0.4, "up": 0.7},
        "levels": [
            {"end": 0.94, "density": 2.4, "length": {"from": 0.38, "to": 0.18}, "angle": {"from": 50, "to": 32}, "start_radius": 0.4,
             "end_radius": 0.12, "randomness": 0.35, "gravity": 4.0, "stiffness": 0.18, "split": 0.5, "split_angle": 32, "split_radius": 0.8,
             "up": 0.4, "flatness": 0.3, "break": 0.01, "resolution": 3},
            {"start": 0.2, "density": 3.0, "length": {"from": 0.17, "to": 0.1}, "angle": [35, 60], "start_radius": 0.42, "end_radius": 0.15,
             "randomness": 0.45, "gravity": 5.0, "stiffness": 0.12, "split": 0.45, "split_angle": 36, "split_radius": 0.8, "up": 0.3,
             "flatness": 0.4, "break": 0.02, "resolution": 3},
            {"start": 0.1, "density": 5.5, "length": [0.05, 0.09], "angle": [40, 70], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.5, "gravity": 3.0, "stiffness": 0.1, "split": 0.3, "split_angle": 40, "split_radius": 0.8, "up": 0.3,
             "flatness": 0.4, "break": 0.03, "resolution": 6}],
        "leaf": {"shape": "palmate", "mm": (150, 150), "lobes": 5, "card": 0.6, "cluster": 5, "gloss": 0.55, "count": 2000,
                 "colors": {"summer": ["#558a36", "#74a84a"], "spring": ["#7fb04a", "#a0c862"], "autumn": ["#b8863a", "#c9a24a", "#8f5a2a"]}},
        "bark": {"style": "mottled", "color": "#9a9484", "patches": ["#6f7a5a", "#d9d2bc", "#8d8470"], "relief": 0.6, "pbr": "pbr/bark/Bark006_1K-PNG"},
        "pipe": {"end": 0.004, "growth": 0.7, "power": 2.4},
    },
    "maple": {  # イロハモミジ: a small, layered tree with palmate leaves that turn deep red; smooth grey bark
        "height": 5.5, "clear": 1.6, "radius": 0.1, "trunk": {"frac": 0.5, "shape": 0.6, "randomness": 0.8, "up": 0.4},
        "levels": [
            {"start": 0.0, "end": 0.98, "density": 3.4, "length": {"from": 0.5, "to": 0.34}, "angle": {"from": 56, "to": 40}, "start_radius": 0.5,
             "end_radius": 0.12, "randomness": 0.45, "gravity": 7.0, "stiffness": 0.12, "split": 0.6, "split_angle": 40, "split_radius": 0.82,
             "up": 0.25, "flatness": 0.5, "break": 0.01, "resolution": 3},
            {"start": 0.2, "density": 3.4, "length": {"from": 0.22, "to": 0.12}, "angle": [40, 65], "start_radius": 0.42, "end_radius": 0.15,
             "randomness": 0.5, "gravity": 7.0, "stiffness": 0.1, "split": 0.5, "split_angle": 42, "split_radius": 0.8, "up": 0.15,
             "flatness": 0.6, "break": 0.02, "resolution": 3},
            {"start": 0.1, "density": 7.0, "length": [0.05, 0.1], "angle": [40, 75], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.5, "gravity": 4.0, "stiffness": 0.1, "split": 0.3, "split_angle": 45, "split_radius": 0.8, "up": 0.1,
             "flatness": 0.6, "break": 0.03, "resolution": 6}],
        "leaf": {"shape": "palmate", "mm": (68, 72), "lobes": 7, "card": 0.42, "cluster": 7, "gloss": 0.5, "count": 2200,
                 "colors": {"summer": ["#4f8a36", "#73ad4a"], "spring": ["#8fbf52", "#b9d86a"], "autumn": ["#c8321f", "#e0522a", "#8f1e14"]}},
        "bark": {"style": "smooth", "color": "#7f7a72", "relief": 0.5, "pbr": "pbr/bark/Bark006_1K-PNG", "tint": "#a8a6a4"},
        "pipe": {"end": 0.003, "growth": 0.5, "power": 2.4},
    },
    "crape_myrtle": {  # サルスベリ: several smooth, mottled stems from the ground, a round head, pink flowers in summer
        "height": 4.5, "clear": 1.2, "radius": 0.075, "trunk": {"frac": 0.55, "shape": 0.6, "randomness": 0.6, "up": 0.5}, "multi": 3,
        "levels": [
            {"start": 0.0, "end": 0.98, "density": 3.6, "length": {"from": 0.46, "to": 0.3}, "angle": {"from": 48, "to": 30}, "start_radius": 0.5,
             "end_radius": 0.12, "randomness": 0.45, "gravity": 4.0, "stiffness": 0.14, "split": 0.6, "split_angle": 36, "split_radius": 0.82,
             "up": 0.4, "flatness": 0.3, "break": 0.01, "resolution": 3},
            {"start": 0.2, "density": 3.6, "length": {"from": 0.2, "to": 0.12}, "angle": [35, 60], "start_radius": 0.42, "end_radius": 0.15,
             "randomness": 0.5, "gravity": 5.0, "stiffness": 0.1, "split": 0.5, "split_angle": 40, "split_radius": 0.8, "up": 0.3,
             "flatness": 0.4, "break": 0.02, "resolution": 3},
            {"start": 0.1, "density": 7.5, "length": [0.05, 0.1], "angle": [40, 70], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.5, "gravity": 3.0, "stiffness": 0.1, "split": 0.3, "split_angle": 40, "split_radius": 0.8, "up": 0.4,
             "flatness": 0.4, "break": 0.03, "resolution": 6}],
        "leaf": {"shape": "elliptic", "mm": (48, 26), "card": 0.42, "cluster": 9, "gloss": 0.45, "count": 1300,
                 "colors": {"summer": ["#4a7d36", "#6a9e48"], "spring": ["#7fae4c", "#a6cc62"], "autumn": ["#c4542b", "#d9862e", "#8f2e1c"]},
                 "flowers": "summer", "flower": "#d8569a"},
        "bark": {"style": "mottled", "color": "#b59d82", "patches": ["#8e7256", "#d4c2a8", "#a08a70"], "relief": 0.4, "pbr": "pbr/bark/Bark006_1K-PNG", "tint": "#c8b49c"},
        "pipe": {"end": 0.003, "growth": 0.4, "power": 2.4},
    },
    "pine": {  # クロマツ: a leaning trunk, a few bold level limbs, tufts of needles at their ends, scaly bark
        "height": 7.0, "clear": 2.0, "radius": 0.2, "trunk": {"frac": 0.8, "shape": 0.7, "randomness": 1.3, "up": 0.35},
        "levels": [
            {"start": 0.3, "end": 0.95, "density": 1.4, "length": {"from": 0.45, "to": 0.22}, "angle": {"from": 78, "to": 55}, "start_radius": 0.42,
             "end_radius": 0.15, "randomness": 0.5, "gravity": 9.0, "stiffness": 0.2, "split": 0.4, "split_angle": 30, "split_radius": 0.82,
             "up": 0.25, "flatness": 0.6, "break": 0.01, "resolution": 3},
            {"start": 0.3, "density": 3.0, "length": {"from": 0.18, "to": 0.1}, "angle": [40, 70], "start_radius": 0.42, "end_radius": 0.2,
             "randomness": 0.45, "gravity": 6.0, "stiffness": 0.14, "split": 0.5, "split_angle": 36, "split_radius": 0.8, "up": 0.5,
             "flatness": 0.6, "break": 0.02, "resolution": 3},
            {"start": 0.5, "density": 9.0, "length": [0.03, 0.06], "angle": [30, 60], "start_radius": 0.35, "end_radius": 0.3,
             "randomness": 0.4, "gravity": 1.0, "stiffness": 0.1, "split": 0.4, "split_angle": 40, "split_radius": 0.8, "up": 0.9,
             "flatness": 0.3, "break": 0.02, "resolution": 6}],
        "leaf": {"shape": "needles", "mm": (110, 110), "card": 0.36, "cluster": 1, "gloss": 0.55, "count": 2400,
                 "colors": {"summer": ["#2f5a2e", "#4a7a3e"], "spring": ["#3f6f36", "#6a9a4a"], "autumn": ["#2f5a2e", "#4a7a3e"]}},
        "bark": {"style": "scaly", "color": "#6b5a4e", "crack": "#2a2320", "plate": "#8a6e5a", "relief": 1.4, "pbr": "pbr/bark/Bark014_1K-PNG"},
        "pipe": {"end": 0.004, "growth": 0.9, "power": 2.4},
    },
    "dead": {  # a dead tree: bare, bleached, its branches broken short, bending down
        "height": 7.0, "clear": 2.2, "radius": 0.16, "trunk": {"frac": 0.75, "shape": 0.7, "randomness": 0.9, "up": 0.5},
        "levels": [
            {"end": 0.95, "density": 2.0, "length": {"from": 0.36, "to": 0.16}, "angle": {"from": 48, "to": 30}, "start_radius": 0.4,
             "end_radius": 0.1, "randomness": 0.5, "gravity": 8.0, "stiffness": 0.1, "split": 0.5, "split_angle": 34, "split_radius": 0.8,
             "up": 0.3, "flatness": 0.3, "break": 0.08, "resolution": 3},
            {"start": 0.2, "density": 2.6, "length": {"from": 0.16, "to": 0.08}, "angle": [35, 60], "start_radius": 0.4, "end_radius": 0.12,
             "randomness": 0.6, "gravity": 8.0, "stiffness": 0.1, "split": 0.4, "split_angle": 36, "split_radius": 0.8, "up": 0.2,
             "flatness": 0.4, "break": 0.12, "resolution": 3},
            {"start": 0.1, "density": 4.0, "length": [0.04, 0.08], "angle": [40, 70], "start_radius": 0.35, "end_radius": 0.25,
             "randomness": 0.6, "gravity": 4.0, "stiffness": 0.1, "split": 0.3, "split_angle": 40, "split_radius": 0.8, "up": 0.1,
             "flatness": 0.4, "break": 0.15, "resolution": 6}],
        "leaf": {"shape": "elliptic", "mm": (50, 25), "card": 0.4, "cluster": 8, "gloss": 0.6, "count": 0, "colors": {"summer": ["#6a6050", "#7a7060"]}},
        "bark": {"style": "furrowed", "color": "#8d8880", "crack": "#44403a", "relief": 1.2, "scale": 1.2, "pbr": "pbr/bark/Bark001_1K-PNG", "tint": "#c4c0b8"},
        "pipe": {"end": 0.003, "growth": 0.5, "power": 2.6},
    },
}

LEAF_SEASON = {"summer": "summer", "autumn": "autumn", "spring": "spring", "winter": None, "dead": None}


def _hex(c):
    return c if isinstance(c, str) else "#%02x%02x%02x" % tuple(int(round(float(x) * 255)) for x in np.clip(np.asarray(c, float)[:3], 0, 1))


# ---- growing ---------------------------------------------------------------------------------------------------------------

def grow(spec, sp, seed):
    """The tree's skeleton: stems (mtree) and the levels' creator ids [trunk, level 1, level 2...]."""
    H = float(spec.get("height", sp["height"]))
    k = H / sp["height"]                                     # the species' numbers scaled to this height
    clear = float(spec.get("clear", sp["clear"] * k))
    tr = sp["trunk"]
    tlen = max(H * tr["frac"], clear + 0.8)
    r0 = float(spec.get("radius", sp["radius"] * k ** 1.3))
    lean = float(spec.get("lean", 0.0))
    stems = []
    multi = int(spec.get("multi", sp.get("multi", 1)))
    for i in range(max(1, multi)):
        a = 2 * math.pi * i / max(1, multi) + 0.4
        d = UP.copy()
        if multi > 1:                                          # a clump: each stem leans out from the middle
            d = T._unit(UP + np.array([math.cos(a), math.sin(a), 0.0]) * 0.28)
        elif lean:
            d = T._unit(UP + np.array([math.cos(a), math.sin(a), 0.0]) * math.tan(math.radians(lean)))
        T.trunk(stems, seed * 31 + i, length=tlen * (1.0 if multi == 1 else 0.8 + 0.4 * (i % 2)), start_radius=r0 / (1 if multi == 1 else 1.4),
                end_radius=r0 * 0.12, shape=tr["shape"], resolution=3, randomness=tr["randomness"], up_attraction=tr["up"], creator=0,
                origin=(0.0, 0.0, 0.0) if multi == 1 else (math.cos(a) * r0 * 0.9, math.sin(a) * r0 * 0.9, 0.0), direction=d)
    levels = sp["levels"][:int(spec.get("levels", len(sp["levels"])))]
    if spec.get("pollard"):
        levels = _pollard_levels(levels)
    spread, droop, dens, crown = (float(spec.get(k_, 1.0)) for k_ in ("spread", "droop", "density", "crown"))
    twigs = float(spec.get("twigs_density", 1.0))
    ids = [0]
    for li, lv in enumerate(levels):
        cid = li + 1
        last = li == len(levels) - 1
        start = lv.get("start")
        if li == 0:
            start = clear / tlen if start is None or spec.get("clear") is not None else max(start, clear / tlen)
        T.branches(stems, seed * 7 + 11 * cid, parent=ids[-1], creator=cid, start=float(start if start is not None else 0.1), end=lv.get("end", 1.0),
                   density=lv["density"] * dens * (twigs if last else 1.0), length=_scaled(lv["length"], H * crown),
                   start_radius=lv["start_radius"], end_radius=lv["end_radius"], break_chance=lv.get("break", 0.01),
                   resolution=lv.get("resolution", 3), randomness=lv["randomness"], gravity=lv["gravity"] * droop,
                   stiffness=lv["stiffness"], up_attraction=lv["up"], flatness=lv["flatness"], split_radius=lv["split_radius"],
                   angle=_scaled(lv["angle"], spread), split_angle=lv["split_angle"] * spread, split=lv["split"])
        ids.append(cid)
    pipe = sp["pipe"]
    T.pipe_radius(stems, end_radius=pipe["end"] * max(0.6, k ** 0.5), constant_growth=pipe["growth"], power=pipe["power"],
                  only={1} if spec.get("pollard") else None)
    _trunk_floor(stems, r0 / (1 if multi == 1 else 1.4))
    if spec.get("pollard"):
        _knuckles(stems, 1)
    return stems, ids


def _trunk_floor(stems, r0):
    """A stem never thinner than its species' trunk, tapering up it, however few tips the pipe model finds over it (a
    sapling, a dead tree, a pollard)."""
    for st in stems:
        total = T.branch_length(st.node)
        node, at = st.node, 0.0
        while True:
            t = at / max(total, 1e-6)
            node.radius = max(node.radius, r0 * (1 - 0.92 * t) ** 0.8)
            if not node.children:
                break
            at += node.length
            node = node.children[0][0]


def _scaled(p, k):
    """A property times k (a share of the height into metres, an angle spread)."""
    if isinstance(p, dict):
        return {kk: (v * k if kk in ("from", "to", "min", "max") else v) for kk, v in p.items()}
    if isinstance(p, (list, tuple)):
        return [v * k for v in p]
    return float(p) * k


def _pollard_levels(levels):
    """A pollarded tree: the limbs cut back short and thick, a broom of upright shoots from each knuckle."""
    lv1 = dict(levels[0], length={"from": 0.14, "to": 0.09}, density=levels[0]["density"] * 2.2, start_radius=0.55, end_radius=0.85, split=0.25,
               up=0.6, gravity=1.0, resolution=4)
    shoots = {"start": 0.7, "end": 1.0, "density": 60.0, "length": [0.12, 0.2], "angle": [25, 55], "start_radius": 0.1, "end_radius": 0.3,
              "randomness": 0.35, "gravity": 2.0, "stiffness": 0.1, "split": 0.3, "split_angle": 30, "split_radius": 0.85, "up": 0.9,
              "flatness": 0.3, "break": 0.02, "resolution": 6}
    return [lv1, shoots]


def _knuckles(stems, creator):
    """The swollen ends of pollarded limbs: the last nodes of each limb thicker than what they carry."""
    for branch in T.select(stems, creator):
        tail = [n for n, _ in branch[-2:]]
        for n in tail:
            n.radius = max(n.radius, branch[0][0].radius * 1.25)


# ---- meshing ---------------------------------------------------------------------------------------------------------------

def _sides(r, detail=1.0):
    """Sides round a tube by its radius: three on a twig, twelve on a trunk."""
    return int(np.clip(round((3 + r / 0.014) * detail), 3, 12))


def tube(P, R, sides, isl, mat, cap=True, v0=0.0, lobes=None, base=False):
    """A branch as a tube: rings of `sides` round each point, bridged, the far end closed with a point (`base`: the
    near end too, a stem's foot in the ground). Maps round (u) and along (v) in circumferences, so a square tile of
    bark stays square however thick the branch. `lobes`: (count, depth, phase) root lobes on the first two rings."""
    P = np.asarray(P, float)
    k = len(P)
    Tn = np.gradient(P, axis=0) if k > 2 else np.repeat((P[1:2] - P[0:1]), k, 0)
    Tn /= np.maximum(np.linalg.norm(Tn, axis=1, keepdims=True), 1e-12)
    up = UP if abs(Tn[0, 2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    Nn = T._unit(np.cross(up, Tn[0]))
    frames = np.zeros((k, 2, 3))
    for i in range(k):
        if i:
            Nn = T._unit(Nn - Tn[i] * float(np.dot(Nn, Tn[i])))
        frames[i, 0], frames[i, 1] = Nn, np.cross(Tn[i], Nn)
    ang = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    scale = np.ones((k, sides))
    if lobes:
        n_l, depth, phase = lobes
        for i, w in ((0, 1.0), (1, 0.45)):
            if i < k:
                scale[i] *= 1 + depth * w * np.abs(np.sin(n_l * ang / 2 + phase)) ** 1.5
    ring = P[:, None, :] + (np.cos(ang)[None, :, None] * frames[:, 0][:, None, :] + np.sin(ang)[None, :, None] * frames[:, 1][:, None, :]) * (R[:, None] * scale)[..., None]
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    rm = np.maximum((R[:-1] + R[1:]) / 2, 1e-4)
    v = np.concatenate([[v0], v0 + np.cumsum(seg / (2 * math.pi * rm))])
    i = np.repeat(np.arange(k - 1), sides)
    j = np.tile(np.arange(sides), k - 1)
    j1 = (j + 1) % sides
    f = np.stack([i * sides + j, i * sides + j1, (i + 1) * sides + j1, (i + 1) * sides + j], 1)
    u0, u1 = j / sides, (j + 1) / sides
    uv = np.stack([isl.to_uv(u0, v[i]), isl.to_uv(u1, v[i]), isl.to_uv(u1, v[i + 1]), isl.to_uv(u0, v[i + 1])], 1)
    verts = ring.reshape(-1, 3)
    if cap:
        tip = P[-1] + Tn[-1] * R[-1] * 0.9
        ti = len(verts)
        verts = np.concatenate([verts, tip[None]])
        base = (k - 1) * sides
        jj = np.arange(sides)
        jj1 = (jj + 1) % sides
        fc = np.stack([base + jj, base + jj1, np.full(sides, ti), np.full(sides, -1)], 1)
        uvc = np.stack([isl.to_uv(jj / sides, np.full(sides, v[-1])), isl.to_uv((jj + 1) / sides, np.full(sides, v[-1])),
                        isl.to_uv((jj + 0.5) / sides, np.full(sides, v[-1] + R[-1] / (2 * math.pi * max(R[-1], 1e-4)))), np.zeros((sides, 2))], 1)
        f = np.concatenate([f, fc])
        uv = np.concatenate([uv, uvc])
    if base:
        foot = P[0] - Tn[0] * R[0] * 0.05
        bi = len(verts)
        verts = np.concatenate([verts, foot[None]])
        jj = np.arange(sides)
        jj1 = (jj + 1) % sides
        fb = np.stack([jj1, jj, np.full(sides, bi), np.full(sides, -1)], 1)
        uvb = np.stack([isl.to_uv((jj + 1) / sides, np.full(sides, v[0])), isl.to_uv(jj / sides, np.full(sides, v[0])),
                        isl.to_uv((jj + 0.5) / sides, np.full(sides, v[0] - 0.05)), np.zeros((sides, 2))], 1)
        f = np.concatenate([f, fb])
        uv = np.concatenate([uv, uvb])
    m = M.Mesh(verts, f, uv, mats=[mat])
    m.a["rest"] = verts.copy()
    return m


def mesh_wood(stems, ids, meshed, isl, mat, seed, detail=1.0):
    """Every spline of the levels in `meshed` as a tube, each side branch sunk into its parent with a collar, the
    stems flared at the root."""
    r = N.rng(seed, "wood")
    parts = []
    for sp in T.splines(stems):
        cid = sp["nodes"][0].creator
        if cid not in meshed:
            continue
        P, R = sp["P"].copy(), sp["R"].copy()
        if sp["parent"] is not None:
            d = T._unit(P[1] - P[0]) if len(P) > 1 else UP
            P[0] = P[0] - d * sp["parent_radius"] * 0.45           # rooted inside the parent
            R[0] = min(R[0] * 1.25, max(sp["parent_radius"] * 0.95, R[0]))
        lobes = None
        if sp["parent"] is None:
            R[0] *= 1.3
            if len(R) > 1:
                R[1] *= 1.08
            lobes = (int(r.integers(3, 6)), 0.22, float(r.uniform(0, math.pi)))
        sides = _sides(float(R.max()), detail)
        parts.append(tube(P, R, sides, isl, mat, cap=True, v0=float(r.uniform(0, 1)), lobes=lobes, base=sp["parent"] is None))
    return parts


def leaf_cards(stems, ids, leaf, spec, seed, isls, mat, bare_tips=False):
    """Leaf clusters as cards on the last level's nodes: each card's foot at a node, standing along the twig and out of
    the crown, a cluster of the texture drawn on it, its normal rounded over the crown so the mass lights as one."""
    r = N.rng(seed, "leaves")
    last = ids[-1]
    cand = []
    for node, pos, parent in T.walk(stems):
        if node.creator == last or (node.creator != 0 and node.is_leaf()):
            cand.append((node.end(pos), node.direction, node.radius, node.is_leaf()))
    if not cand:
        return None, None
    n_cand = len(cand)
    want = int(leaf.get("count", 1800))
    size = float(leaf.get("size", leaf["card"]))
    per = want / n_cand
    centre = np.mean([c[0] for c in cand], axis=0)
    centre[2] = float(np.percentile([c[0][2] for c in cand], 45))
    corners, uvs, normals = [], [], []
    for pos, d, rad, tip in cand:
        n_here = int(per) + (1 if r.random() < per - int(per) else 0)
        if tip and n_here == 0 and r.random() < 0.6:
            n_here = 1
        for _ in range(n_here):
            o = pos - centre
            o[2] *= 0.55
            o = T._unit(o) if np.linalg.norm(o) > 1e-6 else UP
            light = T._unit(o * 0.75 + UP * 0.4 + r.normal(0, 0.18, 3))
            n = T._unit(o * 0.6 + r.normal(0, 0.55, 3) + UP * 0.15)
            a = T._unit(T.project(T._unit(d) * 0.7 + o * 0.35 - UP * float(leaf.get("droop", 0.3)) + r.normal(0, 0.25, 3), n))
            if np.linalg.norm(a) < 1e-6:
                a = T._unit(T.project(UP, n))
            s = np.cross(a, n)
            w = size * float(r.uniform(0.8, 1.2))
            h = w
            foot = pos - a * h * 0.12 + n * float(r.uniform(-0.02, 0.02))
            c = np.stack([foot - s * w / 2, foot + s * w / 2, foot + s * w / 2 + a * h, foot - s * w / 2 + a * h])
            corners.append(c)
            cell = isls[int(r.integers(len(isls)))]
            flip = r.random() < 0.5
            uu = np.array([1, 0, 0, 1], float) if flip else np.array([0, 1, 1, 0], float)
            uvs.append(cell.to_uv(uu, np.array([0, 0, 1, 1], float)))
            normals.append(np.repeat(light[None], 4, 0))
    if not corners:
        return None, None
    V = np.concatenate(corners)
    F = np.arange(len(V)).reshape(-1, 4)
    m = M.Mesh(V, F, np.stack(uvs), mats=[mat])
    m.a["rest"] = V.copy()
    m.a["normal"] = np.concatenate(normals)
    return m, centre


def stakes_mesh(kind, r_at, I, seed):
    """The props of a street tree: `torii` two posts and a crossbar bound to the trunk, `tripod` three poles leaning on
    it, `single` one post beside it; posts of 65 mm timber, the bindings black bands. r_at(z): the trunk's radius."""
    r = N.rng(seed, "stakes")
    parts = []
    pole_r = 0.0325

    def pole(a, b, lean=0.0):
        a, b = np.asarray(a, float), np.asarray(b, float)
        P = np.stack([a, a + (b - a) * 0.5, b])
        parts.append(tube(P, np.full(3, pole_r), 8, I["pole"], "stake", cap=True, v0=float(r.uniform(0, 1))))

    def band(c, radius, width=0.03, sides=14):
        c = np.asarray(c, float)
        P = np.stack([c - UP * width / 2, c, c + UP * width / 2])
        parts.append(tube(P, np.full(3, radius), sides, I["band"], "stake", cap=False))

    if kind == "torii":
        z_bar = 1.78
        rt = r_at(z_bar)
        y = -(rt + pole_r + 0.01)
        for x in (-0.55, 0.55):
            pole((x * 1.03, y, 0.0), (x, y, 1.98))
            band((x, y, z_bar), pole_r + 0.012, 0.035, 10)
        xb = np.array([-0.62, y, z_bar]), np.array([0.62, y, z_bar])
        parts.append(tube(np.stack([xb[0], (xb[0] + xb[1]) / 2, xb[1]]), np.full(3, pole_r), 8, I["pole"], "stake", cap=True, v0=0.3))
        parts.append(_strap((0.0, 0.0, z_bar), rt, (0.0, y, z_bar), pole_r, I["band"]))
    elif kind == "tripod":
        z_top = 1.55
        rt = r_at(z_top)
        for i in range(3):
            a = 2 * math.pi * i / 3 + 0.5
            pole((math.cos(a) * 0.8, math.sin(a) * 0.8, 0.0), (math.cos(a) * (rt + pole_r), math.sin(a) * (rt + pole_r), z_top + 0.12))
        band((0.0, 0.0, z_top), rt + 2 * pole_r + 0.01, 0.04, 18)
    elif kind == "single":
        rt = r_at(1.2)
        x = rt + pole_r + 0.012
        pole((x, 0.0, 0.0), (x, 0.0, 2.0))
        for z in (0.8, 1.6):
            band((x / 2, 0.0, z), r_at(z) + pole_r + 0.03, 0.03, 16)
    return parts


def _strap(c_trunk, r_trunk, c_bar, r_bar, isl):
    """A binding round the trunk and the bar lying against it: a band along a rounded loop enclosing both."""
    c_trunk, c_bar = np.asarray(c_trunk, float), np.asarray(c_bar, float)
    d = c_bar - c_trunk
    d[2] = 0
    L = float(np.linalg.norm(d))
    d = d / max(L, 1e-9)
    s = np.cross(UP, d)
    pts = []
    n = 20
    for i in range(n):
        a = 2 * math.pi * i / n
        # a stadium round the two: the trunk's circle on one side, the bar's on the other
        along = math.cos(a)
        across = math.sin(a)
        if along >= 0:
            p = c_bar + d * along * (r_bar + 0.012) + s * across * (r_trunk * 0.5 + r_bar + 0.012)
        else:
            p = c_trunk + d * along * (r_trunk + 0.012) + s * across * (r_trunk + 0.012)
        pts.append(p)
    pts.append(pts[0])
    P = np.array(pts)
    m = tube(P, np.full(len(P), 0.009), 6, isl, "stake", cap=False)
    return m


def pit_mesh(kind, size, I):
    """A tree pit: a square concrete kerb round a square of soil (`kerb`), or the soil alone (`soil`)."""
    parts = []
    S = float(size)
    w, h = 0.12, 0.09
    if kind == "kerb":
        for x, y, sx, sy in ((0, S / 2 - w / 2, S, w), (0, -(S / 2 - w / 2), S, w), (S / 2 - w / 2, 0, w, S - 2 * w), (-(S / 2 - w / 2), 0, w, S - 2 * w)):
            parts.append(M.box((sx, sy, h), at=(x, y, 0.0), island="kerb", islands=I, mat="pit"))
    inner = S - 2 * w if kind == "kerb" else S
    parts.append(M.box((inner, inner, 0.035), at=(0.0, 0.0, 0.0), island="soil", islands=I, mat="pit"))
    return parts


# ---- the family ----------------------------------------------------------------------------------------------------------------

def make(spec, th):
    seed = int(spec.get("seed", 0))
    kind = spec.get("kind", "zelkova")
    if kind not in SPECIES:
        raise ValueError(f"tree kind {kind!r}: one of {', '.join(SPECIES)}")
    sp = SPECIES[kind]
    season = "dead" if kind == "dead" else spec.get("season", "summer")
    leaf = dict(sp["leaf"])
    leaf.update(spec.get("leaves") or {})
    bark = dict(sp["bark"])
    bark.update(spec.get("bark") or {})
    leafy = LEAF_SEASON.get(season) is not None and int(leaf.get("count", 1)) > 0
    stems, ids = grow(spec, sp, seed)
    twigs = spec.get("twigs", "auto")
    meshed = set(ids) if (not leafy or twigs == "mesh" or len(ids) <= 2) and twigs != "cards" else set(ids[:-1])
    detail = float(spec.get("detail", 1.0))
    # materials and islands
    r0 = max(float(stems[0].node.radius) * 1.3, 0.03)
    C = 2 * math.pi * r0 * 1000.0
    th.material("bark", "weathered", color=bark["color"], rough=0.88)
    th.island("bark", C, C, mat="bark", wrap=True)
    palette = (leaf.get("colors") or {}).get(LEAF_SEASON.get(season) or "summer") or ["#4d7a2c", "#6a9a3a"]
    if leaf.get("tint"):
        palette = [_hex(rgb(c) * rgb(leaf["tint"]) / max(float(rgb(leaf["tint"]).mean()), 1e-6) * 0.6 + rgb(c) * 0.4) for c in palette]
    card_mm = float(leaf.get("size", leaf["card"])) * 1000.0
    leaf_isls = []
    if leafy:
        th.material("leaf", "paint", alpha="clip", double=True, color=palette[0], rough=float(leaf.get("gloss", 0.5)))
        for i in range(4):
            leaf_isls.append(th.island(f"leaf{i}", card_mm, card_mm, mat="leaf"))
    stakes = spec.get("stakes", "none")
    pit = spec.get("pit", "none")
    if stakes not in ("none", None, False):
        th.material("stake", "weathered", color=spec.get("stake_color", "#9a8a72"), rough=0.85, px=512)
        th.island("pole", 2 * math.pi * 32.5, 1000.0, mat="stake", wrap=True)
        th.island("band", 120.0, 60.0, mat="stake", wrap=True)
    if pit not in ("none", None, False):
        th.material("pit", "stone", color="#9a9690", rough=0.9, px=512)
        th.island("kerb", 1200.0, 300.0, mat="pit")
        th.island("soil", 1100.0, 1100.0, mat="pit")
    th.pack()
    I = th.islands
    I["bark"].rect = (0.0, 0.0, 1.0, 1.0)                 # the bark tile is the whole texture: it goes round and up
    th.density["bark"] = th.mats["bark"]["px"] / C
    # the wood
    parts = mesh_wood(stems, ids, meshed, I["bark"], "bark", seed, detail)
    wood = M.join(parts, ["bark"])
    wood.a["normal"] = BK.vertex_normals(wood)
    allparts = [wood]
    crown = None
    if leafy:
        cards, crown = leaf_cards(stems, ids, leaf, spec, seed, leaf_isls, "leaf")
        if cards is not None:
            allparts.append(cards)
    # the trunk's radius at a height, for the stakes
    stem = T.splines(stems)[0]

    def r_at(z):
        P, R = stem["P"], stem["R"]
        zs = P[:, 2]
        if z <= zs[0]:
            return float(R[0])
        if z >= zs[-1]:
            return float(R[-1])
        return float(np.interp(z, zs, R))

    if stakes not in ("none", None, False):
        for p in stakes_mesh(stakes, r_at, I, seed):
            p.a["normal"] = BK.vertex_normals(p)
            allparts.append(p)
    if pit not in ("none", None, False):
        for p in pit_mesh(pit, float(spec.get("pit_size", 1.2)), I):
            allparts.append(p)
    mats = ["bark"] + (["leaf"] if leafy and len(allparts) > 1 and "leaf" in allparts[1].mats else []) + \
        (["stake"] if stakes not in ("none", None, False) else []) + (["pit"] if pit not in ("none", None, False) else [])
    th.low = M.join(allparts, mats)
    # every vertex a normal of its own (the leaves' rounded over the crown, the wood's smooth): fill what the join left
    nrm = th.low.a.get("normal")
    if nrm is not None:
        bad = np.linalg.norm(nrm, axis=1) < 0.5
        if bad.any():
            vn = BK.vertex_normals(th.low)
            nrm[bad] = vn[bad]
        th.low.a["normal"] = nrm
    th.high = None
    th.pose = "stand"
    th.anchor = np.zeros(3)                                # the trunk's foot stays at the origin
    th.bake_ao = False                                     # the bark tiles: an occlusion bake over it would be a jumble
    for m_ in ("bark", "leaf"):
        if m_ in th.mats:
            th.mats[m_]["wear"] = {k: 0.0 for k in ("grime", "dirt", "dust", "scratches", "edges", "stains", "fade")}
    lo, hi = T.bounds(stems)
    th.sockets["base"] = ((0.0, 0.0, 0.0), (0, 0, 1))
    th.sockets["crown"] = (tuple(crown) if crown is not None else (0.0, 0.0, float(hi[2]) * 0.7), (0, 0, 1))
    th.view = {"azim": -32, "elev": 7, "lens": 60, "fill": 0.92}
    th.tree = {"kind": kind, "season": season, "height_m": round(float(hi[2]), 2), "nodes": T.count(stems), "cards": 0 if not leafy or len(allparts) < 2 else len(allparts[1].f)}

    def paint(fr):
        paint_bark(fr["bark"], bark, seed, C)
        if leafy:
            for i, isl in enumerate(leaf_isls):
                paint_cluster(fr[isl.name], leaf, palette, season, seed * 4 + i, kind)
        if stakes not in ("none", None, False):
            paint_stake(fr["pole"], fr["band"], spec.get("stake_color", "#9a8a72"), seed)
        if pit not in ("none", None, False):
            paint_pit(fr["kerb"], fr["soil"], seed)

    th.paint = paint
    return th


# ---- paint: the bark --------------------------------------------------------------------------------------------------------------

def _tiled(fn, X, Y, W, H, scale, stretch=1.0):
    """A noise field over an island W x H mm that tiles both ways: the island laid on the flat torus in 4D (a circle
    for x, a circle for y, each the island's length round at `scale` mm a unit), where fn (of 4D points) reads it with
    no direction squeezed. `stretch` > 1 draws the field out along y (ridges up a trunk)."""
    r1 = W / (2 * math.pi * scale)
    r2 = H / (2 * math.pi * scale * stretch)
    a = X / W * 2 * math.pi
    b = Y / H * 2 * math.pi
    return fn(np.stack([np.cos(a) * r1, np.sin(a) * r1, np.cos(b) * r2, np.sin(b) * r2], -1))


def paint_bark(f, bark, seed, C):
    """The bark tile: a PBR set off the shelf (`pbr`, the species' real bark by default: its repeats snapped to the tile
    so it still goes round and up without a seam, `tile` metres a repeat across, `tint` over it), or, with `pbr` null,
    its style's relief and colours drawn by code, every field tiling round and up (4D noise on the flat torus)."""
    X, Y = f.grid()
    W, H = f.W, f.H
    if bark.get("pbr"):
        return paint_bark_pbr(f, bark, X, Y, W, H)
    style = bark.get("style", "furrowed")
    base = rgb(bark["color"])
    relief = float(bark.get("relief", 1.0))
    sc = float(bark.get("scale", 1.0))
    grain = _tiled(lambda p: N.fbm4(p, seed + 3, 3), X, Y, W, H, 4.0 * sc, 2.5)
    col = base[None, None] * (1 + 0.14 * grain[..., None])
    height = 0.25 * grain * relief
    rough = np.full(X.shape, 0.88, np.float32)
    if style == "furrowed":
        # ridges running up the trunk: cracks between them dark and deep, the plates between lighter, mottled
        crack = _tiled(lambda p: N.ridged4(p, seed + 7, 3), X, Y, W, H, 30.0 * sc, 4.5)
        crack = N.smoothstep(0.58, 0.9, crack + 0.08 * grain)
        plates = _tiled(lambda p: N.fbm4(p, seed + 9, 2), X, Y, W, H, 70.0 * sc, 2.0) * 0.5 + 0.5
        dark = rgb(bark.get("crack", "#3a332c"))
        col = col * (1 - crack[..., None]) + (dark[None, None] * (0.8 + 0.3 * grain[..., None])) * crack[..., None]
        col = col * (1 + 0.14 * (plates[..., None] - 0.5))
        height = height - 2.6 * relief * crack + 0.7 * relief * (plates - 0.5)
        rough = rough + 0.08 * crack
    elif style == "scaly":
        # plates like a jigsaw, taller than wide, parted by deep dark fissures of uneven width; each plate its own shade
        net = _tiled(lambda p: N.ridged4(p, seed + 7, 2), X, Y, W, H, 120.0 * sc, 2.2)
        width = _tiled(lambda p: N.fbm4(p, seed + 8, 2), X, Y, W, H, 40.0 * sc) * 0.07
        crack = N.smoothstep(0.66 + width, 0.84 + width, net)
        plates = _tiled(lambda p: N.fbm4(p, seed + 9, 3), X, Y, W, H, 60.0 * sc, 1.5) * 0.5 + 0.5
        plate_col = rgb(bark.get("plate", "#8a6e5a"))
        col = col * (1 - 0.55 * plates[..., None]) + plate_col[None, None] * 0.55 * plates[..., None] * (0.9 + 0.3 * grain[..., None])
        dark = rgb(bark.get("crack", "#2a2320"))
        col = col * (1 - crack[..., None]) + dark[None, None] * crack[..., None]
        height = height - 3.4 * relief * crack + 0.8 * relief * (plates - 0.5)
        rough = rough + 0.08 * crack
    elif style == "flaky":
        # smooth grey bark flaking in patches to orange-brown under it, each patch stepped in with a dark rim
        fl = _tiled(lambda p: N.fbm4(p, seed + 11, 3), X, Y, W, H, 95.0 * sc, 1.3)
        inside = N.smoothstep(0.15, 0.23, fl)
        rim = np.exp(-((fl - 0.17) / 0.03) ** 2) * (fl < 0.19)
        flake = rgb(bark.get("flake", "#8e6c4c"))
        col = col * (1 - inside[..., None]) + (flake[None, None] * (1 + 0.18 * grain[..., None])) * inside[..., None]
        col = col * (1 - 0.45 * rim[..., None])
        lent = _tiled(lambda p: N.fbm4(p, seed + 13, 2), X, Y, W, H, 9.0 * sc, 0.16)
        lent = N.smoothstep(0.5, 0.7, lent) * (1 - inside)
        col = col * (1 - 0.3 * lent[..., None]) + 0.3 * lent[..., None] * 0.9
        height = height - 0.9 * relief * inside + 0.3 * relief * lent
        rough = rough - 0.05 * inside
    elif style == "lenticels":
        # dark smooth bark banded across with pale lenticels, a few vertical cracks on the old wood
        strip = _tiled(lambda p: N.fbm4(p, seed + 17, 3), X, Y, W, H, 16.0 * sc, 0.12)
        lent = N.smoothstep(0.2, 0.36, strip + 0.15 * grain)
        pale = rgb(bark.get("lenticel", "#a39383"))
        col = col * (1 - 0.85 * lent[..., None]) + pale[None, None] * 0.85 * lent[..., None]
        crack = _tiled(lambda p: N.ridged4(p, seed + 19, 2), X, Y, W, H, 60.0 * sc, 5.0)
        crack = N.smoothstep(0.86, 0.97, crack)
        col = col * (1 - 0.45 * crack[..., None])
        sheen = _tiled(lambda p: N.fbm4(p, seed + 21, 2), X, Y, W, H, 30.0 * sc) * 0.5 + 0.5
        col = col * (1 + 0.2 * (sheen[..., None] - 0.5))
        height = height + 0.5 * relief * lent - 1.6 * relief * crack
        rough = rough - 0.12 * sheen + 0.05
    elif style == "mottled":
        # bark shed in plates: patches of three colours over the base, each a shallow step
        patches = [rgb(c) for c in bark.get("patches", ["#6f7a5a", "#d9d2bc", "#8d8470"])]
        fa = _tiled(lambda p: N.fbm4(p, seed + 23, 3), X, Y, W, H, 130.0 * sc, 1.4)
        fb = _tiled(lambda p: N.fbm4(p, seed + 29, 3), X, Y, W, H, 85.0 * sc, 1.4)
        masks = [N.smoothstep(0.1, 0.16, fa), N.smoothstep(0.12, 0.18, fb) * (1 - N.smoothstep(0.1, 0.16, fa)), N.smoothstep(0.08, 0.14, -fa - 0.1 * fb)]
        for pc, mk in zip(patches, masks):
            col = col * (1 - mk[..., None]) + (pc[None, None] * (1 + 0.1 * grain[..., None])) * mk[..., None]
            height = height + 0.35 * relief * mk
        rough = rough - 0.1
    else:  # smooth
        mott = _tiled(lambda p: N.fbm4(p, seed + 31, 3), X, Y, W, H, 50.0 * sc, 1.5)
        col = col * (1 + 0.16 * mott[..., None])
        lent = _tiled(lambda p: N.fbm4(p, seed + 33, 2), X, Y, W, H, 10.0 * sc, 0.2)
        lent = N.smoothstep(0.55, 0.72, lent)
        col = col * (1 - 0.25 * lent[..., None]) + 0.25 * lent[..., None] * 0.85
        height = height + 0.25 * relief * lent
        rough = rough - 0.08
    f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=np.clip(rough, 0.3, 1).astype(np.float32),
                 metal=0.0, height=height.astype(np.float32))


def paint_bark_pbr(f, bark, X, Y, W, H):
    """A bark set laid over the whole tile: `tile` metres a repeat across (the set's own tile_m), its height from its
    own shape (a 1 x 2 m set repeats half as often up), a whole number of repeats each way so the edges meet; the
    set's colour times `tint`, its roughness, its normal at `relief` strength."""
    from .. import pbrset
    st = pbrset.load(bark["pbr"])
    alb = st.maps["albedo"]
    aspect = alb.shape[0] / alb.shape[1]
    tile = float(bark.get("tile") or st.tile_m) * 1000.0                  # mm across one repeat
    tile_v = float(getattr(st, "tile_v_m", 0.0) or 0.0) * 1000.0 or tile * aspect
    n_u = max(1, int(round(W / tile)))
    n_v = max(1, int(round(H / tile_v)))
    smp = st.sample(X / W * n_u, Y / H * n_v)
    col = smp["albedo"]
    if bark.get("tint"):
        col = col * rgb(bark["tint"])[None, None] / max(float(rgb(bark["tint"]).mean()), 1e-6) * 0.62
    n = smp["normal"].copy()
    n[..., :2] *= float(bark.get("relief", 1.0))
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
    f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=smp["rough"], metal=0.0, normal=n.astype(np.float32))


# ---- paint: the leaves ----------------------------------------------------------------------------------------------------------

def leaf_poly(shape, L, Wd, rng, serrate=False, lobes=5):
    """One leaf's outline in mm, its stalk end at (0, 0), its tip up the y axis."""
    if shape == "fan":
        # a ginkgo fan: a stalk, then a wedge spreading to a scalloped edge with a notch in the middle
        pts = [(0.0, 0.0), (1.2, 0.0), (1.2, L * 0.38)]
        n = 26
        for i in range(n + 1):
            a = math.radians(-58 + 116 * i / n)
            rr = L * (0.62 + 0.1 * math.sin(i / n * math.pi) - 0.08 * math.exp(-((i / n - 0.5) / 0.08) ** 2)) * (1 + 0.025 * math.sin(i * 2.3))
            pts.append((math.sin(a) * Wd / 2 * (rr / (L * 0.72)) * 1.2, L * 0.38 + math.cos(a) * rr * 0.85))
        pts += [(-1.2, L * 0.38), (-1.2, 0.0)]
        return np.array(pts)
    if shape == "palmate":
        # a maple's or a plane's lobed leaf: lobes as rays from the stalk's end, sinuses between them
        pts = [(0.0, 0.0), (0.8, 0.0), (0.8, L * 0.18)]
        k = int(lobes)
        n = 10 * k
        for i in range(n + 1):
            a = math.radians(-105 + 210 * i / n)
            u = (a + math.radians(105)) / math.radians(210) * k          # which lobe we're in
            frac = u - math.floor(u)
            lobe = (1 - abs(frac - 0.5) * 2) ** 0.7
            rr = L * 0.5 * (0.42 + 0.58 * lobe) * (1.0 - 0.25 * abs(a) / math.radians(105))
            x, y = math.sin(a) * rr * (Wd / L), L * 0.18 + math.cos(a) * rr * 1.1
            pts.append((x, y))
        pts.append((-0.8, L * 0.18))
        pts.append((-0.8, 0.0))
        return np.array(pts)
    # elliptic and ovate: a stalk, then a blade whose half width follows a curve, serrated or smooth
    n = 30
    stalk = L * 0.14
    xs, ys = [], []
    for i in range(n + 1):
        t = i / n
        if shape == "ovate":
            w = math.sin(math.pi * t) ** 0.65 * (1 - 0.35 * t) * (1 + 0.25 * (1 - t) * t)
            tip = (1 - t) ** 0.25 if t > 0.75 else 1.0
            w *= tip
        else:
            w = math.sin(math.pi * t) ** 0.85
        if serrate:
            w += 0.06 * (abs((t * 14) % 1.0 - 0.5) * 2 - 0.5)
        xs.append(w * Wd / 2)
        ys.append(stalk + t * (L - stalk))
    right = list(zip(xs, ys))
    left = [(-x, y) for x, y in reversed(right)]
    return np.array([(0.0, 0.0), (0.7, 0.0), (0.7, stalk)] + right + left + [(-0.7, stalk), (-0.7, 0.0)])


def _turn(pts, deg, at):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    p = np.asarray(pts, float)
    return np.stack([p[:, 0] * c - p[:, 1] * s, p[:, 0] * s + p[:, 1] * c], 1) + np.asarray(at, float)


def paint_cluster(f, leaf, palette, season, seed, kind):
    """One card's texture: a twig with its side twigs, leaves hung thick along them in the species' shape and colours
    (or blossom, or tufts of needles), see-through everywhere else; the base colour the leaves' so the cut edge stays
    green in the distance. A card stands for a whole spray, so its leaves are drawn a little bigger than life
    (`scale`) and close together."""
    rng = N.rng(seed, "cluster")
    W, H = f.W, f.H
    cols = [rgb(c) for c in palette]
    gloss = float(leaf.get("gloss", 0.5))
    f.fill(color=_hex(cols[0]), opacity=0.0, rough=gloss, height=0.0)
    twig_col = "#5a4634" if kind != "dead" else "#6a6058"
    shape = leaf.get("shape", "elliptic")
    sc = float(leaf.get("scale", 1.25))
    L, Wd = (v * sc for v in leaf.get("mm", (50, 25)))
    blossom = leaf.get("blossom") == season
    flowers = leaf.get("flowers") == season
    # the twigs: one up the middle, bending a little, side twigs off it alternately
    main = [(W / 2 + rng.uniform(-W * 0.03, W * 0.03), 0.0), (W / 2 + rng.uniform(-W * 0.07, W * 0.07), H * 0.45), (W / 2 + rng.uniform(-W * 0.14, W * 0.14), H * 0.9)]
    twigs = [main]
    n_side = int(rng.integers(5, 8)) if shape in ("elliptic", "ovate") else int(rng.integers(4, 7)) if shape != "needles" else 2
    for j in range(n_side):
        t = 0.12 + 0.68 * (j + rng.uniform(0.1, 0.9)) / n_side
        p0 = _along(main, t)
        ang = rng.uniform(35, 62) * (1 if j % 2 else -1)
        ln = H * rng.uniform(0.22, 0.42) * (1.0 - 0.3 * t)
        p1 = (p0[0] + math.sin(math.radians(ang)) * ln, p0[1] + math.cos(math.radians(ang)) * ln)
        twigs.append([p0, ((p0[0] + p1[0]) / 2 + rng.uniform(-W * 0.02, W * 0.02), (p0[1] + p1[1]) / 2), p1])
    for ti, tw in enumerate(twigs):
        f.line(tw, 2.4 if ti == 0 else 1.5, color=twig_col, opacity=1.0, rough=0.8, height=0.2)
    if shape == "needles":
        # tufts: needles radiating from each twig's end, each a thin line, the tufts kept inside the card
        L = min(L, 0.4 * min(W, H))
        for tw in twigs:
            tip = tw[-1]
            tip = (min(max(tip[0], L * 0.9), W - L * 0.9), min(tip[1], H - L * 0.95))
            d = math.degrees(math.atan2(tw[-1][0] - tw[0][0], tw[-1][1] - tw[0][1]))
            n = int(rng.integers(44, 60))
            for i in range(n):
                a = d + rng.uniform(-110, 110) + rng.normal(0, 8)
                ln = L * rng.uniform(0.6, 1.0)
                bend = rng.uniform(-0.12, 0.12)
                pts = [tip]
                for t in (0.35, 0.7, 1.0):
                    aa = math.radians(a + bend * 90 * t)
                    pts.append((tip[0] + math.sin(aa) * ln * t, tip[1] + math.cos(aa) * ln * t))
                c = cols[int(rng.integers(len(cols)))] * rng.uniform(0.8, 1.1)
                f.line(pts, 1.7, color=_hex(c), opacity=1.0, rough=0.55, height=0.15)
        return
    # where leaves hang: pairs along every twig at a little over half a leaf's length apart, smaller toward the tips
    spots = []
    for ti, tw in enumerate(twigs):
        p = np.asarray(tw, float)
        total = float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum())
        step = L * (0.42 if shape in ("elliptic", "ovate") else 0.5 if shape == "fan" else 0.75)
        n = max(2, int(total / step))
        for i in range(n):
            t = (i + 0.7) / (n + 0.2)
            if ti == 0 and t < 0.1:
                continue
            at = _along(tw, t)
            nxt = _along(tw, min(t + 0.05, 1.0))
            d = math.degrees(math.atan2(nxt[0] - at[0], nxt[1] - at[1]))
            for side in (-1, 1):
                if rng.random() < 0.12:
                    continue
                lean = side * rng.uniform(45, 80) * (0.75 if ti else 1.0)
                sz = (1.0 - 0.3 * t) * (0.9 if ti else 1.0)
                spots.append((at, d + lean, sz))
        tip = tw[-1]
        spots.append((tip, math.degrees(math.atan2(tw[-1][0] - tw[-2][0], tw[-1][1] - tw[-2][1])) + rng.uniform(-12, 12), 0.7))
    if blossom or flowers:
        fc = rgb(leaf.get("flower", "#f5d5e0") if flowers else palette[0])
        fc2 = rgb(palette[1] if len(palette) > 1 else palette[0]) if blossom else fc * 0.75
        for p, ang, sz in spots:
            for q in range(int(rng.integers(2, 4))):
                c = (p[0] + rng.uniform(-W * 0.06, W * 0.06), p[1] + rng.uniform(-H * 0.04, H * 0.06))
                r_ = (17 if blossom else 12) * sz * rng.uniform(0.8, 1.15)
                col = (fc if rng.random() < 0.7 else fc2) * rng.uniform(0.9, 1.05)
                if blossom:
                    for pe in range(5):
                        a = math.radians(72 * pe + rng.uniform(-8, 8))
                        f.ellipse(c[0] + math.sin(a) * r_ * 0.55, c[1] + math.cos(a) * r_ * 0.55, r_ * 0.5, r_ * 0.4, rot=-math.degrees(a),
                                  color=_hex(col), opacity=1.0, rough=0.6, height=0.12)
                    f.ellipse(c[0], c[1], r_ * 0.16, color="#c76c88", opacity=1.0, rough=0.6)
                else:
                    for pe in range(6):
                        a = rng.uniform(0, 360)
                        f.ellipse(c[0] + rng.uniform(-r_ * 0.5, r_ * 0.5), c[1] + rng.uniform(-r_ * 0.5, r_ * 0.5), r_ * 0.45, r_ * 0.32, rot=a,
                                  color=_hex(col * rng.uniform(0.85, 1.1)), opacity=1.0, rough=0.6, height=0.1)
        # a few small leaves among them
        spots = spots[::4]
        cols = [rgb("#8a7a48"), rgb("#6f8a3a")] if blossom else cols
    for p, ang, sz in spots:
        poly = leaf_poly(shape, L * sz * rng.uniform(0.85, 1.12), Wd * sz * rng.uniform(0.85, 1.12), rng, serrate=leaf.get("serrate", False), lobes=leaf.get("lobes", 5))
        if rng.random() < 0.3:
            poly[:, 0] *= rng.uniform(0.45, 0.7)                 # a leaf seen on edge
        pts = _turn(poly, -ang, p)
        c = cols[int(rng.integers(len(cols)))] * rng.uniform(0.86, 1.08)
        f.poly(pts, color=_hex(c), opacity=1.0, rough=gloss, height=0.18)
        tip = _turn(np.array([[0.0, L * sz * 0.14], [0.0, L * sz * 0.9]]), -ang, p)
        f.line(tip, 0.9, color=_hex(c * 0.78), opacity=1.0, rough=gloss + 0.05, height=0.05)
    # light and shade over the whole cluster, so no two leaves are quite the same green (or the same pink)
    X, Y = f.grid()
    sh = N.fbm3(np.stack([X / 60.0, Y / 60.0, np.full_like(X, seed * 0.37)], -1), seed + 41, 2)
    tone = rgb(leaf.get("flower", "#f5d5e0")) if flowers else rgb(palette[0]) if blossom else cols[0]
    f.lay_island(np.ones_like(X), color=np.clip(tone[None, None] * (1 + 0.5 * sh[..., None]), 0, 1).astype(np.float32), alpha=0.22)


def _along(pts, t):
    """A point t (0 to 1) along a polyline."""
    p = np.asarray(pts, float)
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    L = seg.sum()
    d = t * L
    for i, s in enumerate(seg):
        if d <= s or i == len(seg) - 1:
            u = d / max(s, 1e-9)
            return tuple(p[i] + (p[i + 1] - p[i]) * min(u, 1.0))
        d -= s
    return tuple(p[-1])


# ---- paint: the stakes and the pit -------------------------------------------------------------------------------------------

def paint_stake(f_pole, f_band, color, seed):
    """Weathered timber posts (the grain along them, greyed) and black rubber bands."""
    X, Y = f_pole.grid()
    base = rgb(color)
    grain = N.fbm3(np.stack([X / 2.2, Y / 90.0, np.full_like(X, 3.0)], -1), seed + 51, 3)
    grey = N.fbm3(np.stack([X / 30.0, Y / 120.0, np.full_like(X, 7.0)], -1), seed + 53, 2) * 0.5 + 0.5
    col = base[None, None] * (1 + 0.2 * grain[..., None])
    col = col * (1 - 0.35 * grey[..., None]) + np.array([0.55, 0.53, 0.5])[None, None] * 0.35 * grey[..., None]
    f_pole.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.85, height=(0.12 * grain).astype(np.float32))
    f_band.fill(color="#1c1b1a", rough=0.75, height=0.0)
    f_band.stripes(6.0, duty=0.5, angle=0.0, color="#262524", rough=0.7, height=0.1)


def paint_pit(f_kerb, f_soil, seed):
    """Precast concrete kerbs and dark, lumpy soil."""
    X, Y = f_kerb.grid()
    g = N.fbm3(np.stack([X / 6.0, Y / 6.0, np.full_like(X, 1.0)], -1), seed + 61, 3)
    col = rgb("#9a9690")[None, None] * (1 + 0.1 * g[..., None])
    f_kerb.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.92, height=(0.1 * g).astype(np.float32))
    X, Y = f_soil.grid()
    lumps = N.fbm3(np.stack([X / 14.0, Y / 14.0, np.full_like(X, 2.0)], -1), seed + 63, 3)
    fine = N.fbm3(np.stack([X / 2.5, Y / 2.5, np.full_like(X, 5.0)], -1), seed + 65, 2)
    col = rgb("#3a2d22")[None, None] * (1 + 0.3 * lumps[..., None] + 0.15 * fine[..., None])
    f_soil.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.98, height=(1.2 * lumps + 0.3 * fine).astype(np.float32))
