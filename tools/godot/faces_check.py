"""GDFACES: a Character Studio character's expressions in Godot (docs/GODOT_DIRECTOR.md §6c, DECISIONS 2026-11-11:
"fix anything that needs fixed for godot too"). The copy of an export a Godot project wears has MHR's 72 face shapes
baked into it (tools/face_morphs.mjs: beside its blink, which is the export's own), and the runtime's face.gd plays the
story's `expr` on them. Here: an export baked into a scratch project, read at run time as the game reads a cast
member's body, and measured headless: its skin carrying all 72 by Meta's names beside the blink and its in-betweens;
the brows and lashes carrying those that move them; each a real move in the mesh (how far the jaw's drop, a lip
corner's pull and a brow's take their furthest point, against the head's size); an expression played on every mesh
that has its shapes; its eyesClosed handed to the blinker (HSBlink: never set beside it, the in-betweens with it) and
taken back when it ends; with no blinker, set on the meshes themselves. Ends "GDFACES ok".

    python tools/godot/faces_check.py [--person NAME | --glb FILE] [--keep DIR]

Needs a Studio export made since the blink (its skin with eyesClosed_L and _R): STUDIO and GROWPAGE each make one
(_studiotest, _growtest); `--person` picks one, else the first there is.
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOOK = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
RUNTIME = ROOT / "tools" / "godot" / "addons" / "horrorstudio"
PEOPLE = ROOT / "Content" / "Studio" / "People"
OUT = ROOT / "Saved" / "Godot" / "_faces"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_faces"

PROJECT = '''config_version=5

[application]

config/name="HorrorStudio faces check"
config/features=PackedStringArray("4.7", "Forward Plus")
'''


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def glb_json(path):
    """a binary glTF's JSON chunk"""
    with open(path, "rb") as f:
        head = f.read(20)
        if len(head) < 20 or head[:4] != b"glTF":
            return None
        (n,) = struct.unpack_from("<I", head, 12)
        return json.loads(f.read(n))


def blinks(path):
    """does an export's skin carry its blink (eyesClosed_L among a mesh's target names)"""
    try:
        j = glb_json(path) or {}
    except (OSError, ValueError):
        return False
    return any("eyesClosed_L" in ((m.get("extras") or {}).get("targetNames") or []) for m in j.get("meshes", []))


LID_SHAPES = ["eyesLookDown", "eyesLookUp", "eyesLookLeft", "eyesLookRight", "lidTightener", "upperLidRaiser", "cheekRaiser", "noseWrinkler", "browLowerer"]


def eyes_through_lids(path, views=("front", "below")):
    """for each shape that moves a lid, at its full weight: how much of that side's eyeball stands in front of a lid
    (mm2 and the deepest mm), by the file's own depth as EYELIDS measures the blink (eyelids_check.py: the skin and the
    eyeballs drawn as depth at 0.05 mm a pixel); {shape: (mm2 through a lid, the deepest mm, mm2 along the opening's
    rim)}, the worst of the views. What's within 0.3 mm of the opening is the rim: a lid's edge has a thickness, and
    where it meets the eye the eye covers a hair of it (the grafted eyes' thick lids most), which is the lid resting
    on the eye, not the eye coming through the lid"""
    import numpy as np
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import eyelids_check as EL
    skin, eyes = EL.glb_parts(path)
    if skin is None or not eyes:
        return None
    P, T, tg = skin[:3]
    lined = len(skin) > 3 and skin[3]
    out = {}
    for side, (EP, ET) in sorted(eyes.items()):
        c = (EP.max(0) + EP.min(0)) / 2
        r = (EP.max(0) - EP.min(0))[0] / 2
        box = (-1.6 * r, -1.2 * r, 1.6 * r, 1.2 * r)
        W_, H_ = int((box[2] - box[0]) / EL.RES), int((box[3] - box[1]) / EL.RES)
        GX, GY = np.meshgrid(box[0] + (np.arange(W_) + 0.5) * EL.RES, box[1] + (np.arange(H_) + 0.5) * EL.RES)
        # only the skin round this eye (the rest of the body can't cover it)
        near = np.linalg.norm(P - c, axis=1) < 4.0 * r
        tri = T[near[T].all(axis=1)]
        for vname, yaw, pitch in EL.VIEWS:
            if vname not in views:
                continue
            R = EL.turn(np.radians(yaw), np.radians(pitch))
            Ze = EL.zbuf(EP, ET, R, c, box)
            eye = np.isfinite(Ze)
            for base in ["rest"] + LID_SHAPES:
                nm = f"{base}_{side}"
                if base != "rest" and nm not in tg:
                    continue
                SP = P if base == "rest" else P + tg[nm]
                inward = np.zeros((H_, W_), bool) if lined else None
                Zs = EL.zbuf(SP, tri, R, c, box, inward)
                with np.errstate(invalid="ignore"):
                    dz = Ze - Zs
                    poke = eye & np.isfinite(Zs) & (dz > (0.0001 if lined else 0)) & (dz < (EL.NEAR_LINED if lined else EL.NEAR))
                    if lined:
                        poke &= ~(GX ** 2 + GY ** 2 + Zs ** 2 < (r - 0.0001) ** 2) & ~inward
                    opening = eye & ~poke & (~np.isfinite(Zs) | (dz > 0))     # the eye seen through the lids' opening
                rim = opening.copy()                                         # the opening grown by 0.3 mm (6 pixels) each way
                for ax in (0, 1):
                    grown = rim.copy()
                    for k in range(1, 7):
                        grown |= np.roll(rim, k, axis=ax) | np.roll(rim, -k, axis=ax)
                    rim = grown
                through = poke & ~rim
                key = base if base == "rest" else nm
                area, deep = float(through.sum() * EL.RES * EL.RES * 1e6), float(dz[through].max() * 1000) if through.any() else 0.0
                edge = float((poke & rim).sum() * EL.RES * EL.RES * 1e6)
                was = out.get(key, (0.0, 0.0, 0.0))
                out[key] = (max(was[0], area), max(was[1], deep), max(was[2], edge))
    return out


FACES = [("rest", {}), ("smile", {"lipCornerPuller_L": 0.9, "lipCornerPuller_R": 0.9, "cheekRaiser_L": 0.8, "cheekRaiser_R": 0.8, "lidTightener_L": 0.5, "lidTightener_R": 0.5}),
         ("squint", {"lidTightener_L": 1.0, "lidTightener_R": 1.0, "eyesLookDown_L": 1.0, "eyesLookDown_R": 1.0, "browLowerer_L": 0.6, "browLowerer_R": 0.6})]


def pictures(g, baked, raw, keep):
    """the face in Godot as the game wears it (demo/portrait.gd, the eyes close): at rest, a smile, a squint looking
    down, on three copies: as MHR's moves alone would leave it; baked, the lids kept off the eyes a shape at a time;
    and that with the eyeball drawn its lid_room deeper, as HSEye draws it (what a game shows). The smile again with
    the eyeballs flat green, counted, the last two: the eye drawn deeper gives up what came through the lid. A sheet
    in keep (faces.jpg)."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from portrait_check import HUMAN, project_text, run
    proj = ROOT / "Saved" / "Godot" / "_faces_look"
    if proj.exists():
        shutil.rmtree(proj)
    (proj / "addons").mkdir(parents=True)
    (proj / "people").mkdir()
    (proj / "project.godot").write_text(project_text(), encoding="utf-8")
    shutil.copytree(LOOK, proj / "addons" / "horrorstudio_look")
    shutil.copytree(HUMAN, proj / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    shutil.copy(baked, proj / "people" / "baked.glb")
    if raw.exists():
        shutil.copy(raw, proj / "people" / "raw.glb")
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=3600)
    flat = ['--eye={"lid_room": 0.0}']
    rows = ([("raw", "raw", flat, "MHR's moves alone")] if raw.exists() else []) + [
        ("baked", "baked", flat, "baked: the lids kept off the eyes, a shape at a time"),
        ("game", "baked", [], "and the eyeball drawn deeper while her lids move: as a game wears her")]
    px = {}
    for row, which, extra, _ in rows:
        for name, face in FACES:
            for mask in ([False, True] if name == "smile" and row != "raw" else [False]):
                tag = f"{row}_{name}" + ("_mask" if mask else "")
                text, err = run(g, proj, [f"--glb=res://people/{which}.glb", f"--out={keep}", f"--tag={tag}", "--shots=eyes", f"--face={json.dumps(face)}"] + extra + (["--eyes=mask"] if mask else []), env)
                if text is None:
                    print(err[-1500:])
                    print(f"  BAD the picture {tag} didn't run clean")
                    return False
                if mask:
                    px[row] = json.loads((keep / f"{tag}.json").read_text(encoding="utf-8"))["shots"]["eyes"].get("eye_px", 0)
    good = px.get("game", 0) < px.get("baked", 0) and px.get("game", 0) > 2000
    print(("  ok  " if good else "  BAD ") + "in Godot, the smile with the eyeballs flat green: %d pixels of eye drawn with the bake alone, %d with the eye drawn deeper (what came through the lid given up, the opening left)" % (px.get("baked", 0), px.get("game", 0)))
    try:
        from PIL import Image, ImageDraw
        W, H = 640, 360
        im = Image.new("RGB", (W * len(FACES), (H + 22) * len(rows)), (20, 20, 20))
        d = ImageDraw.Draw(im)
        for r, (row, _, _, label) in enumerate(rows):
            for c, (name, _) in enumerate(FACES):
                im.paste(Image.open(keep / f"{row}_{name}_eyes.png").convert("RGB").resize((W, H)), (c * W, r * (H + 22) + 22))
                d.text((c * W + 6, r * (H + 22) + 5), f"{label}: {name}", fill=(230, 230, 230))
        im.save(keep / "faces.jpg", quality=90)
        print(f"  the faces: {keep / 'faces.jpg'}")
    except (ImportError, FileNotFoundError) as e:
        print(f"  (no sheet: {e})")
    return good


LID_ROOM = 0.0012                  # how much deeper than it is HSEye draws an eyeball (eye.gd's LID_ROOM)


def eyes_through_mix(path, mix, views=("front", "left", "below"), deep=0.0):
    """the same measure for a mix of shapes held together (a smile: cheeks, lids and lip corners at once): per eye,
    (mm2 through a lid, the deepest mm, mm2 along the rim, mm2 of the eye given up), the worst of the views. `deep`:
    the eyeball drawn that much deeper than it is, as HSEye draws it: skin up to that far behind its surface covers
    it (unless it faces the eye's middle: culled), and what the eye gives up to skin it hid before is counted"""
    import numpy as np
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import eyelids_check as EL
    skin, eyes = EL.glb_parts(path)
    if skin is None or not eyes:
        return None
    P, T, tg = skin[:3]
    lined = len(skin) > 3 and skin[3]
    SP = P.copy()
    for nm, w in mix.items():
        if nm in tg:
            SP = SP + w * tg[nm]
    out = {}
    for side, (EP, ET) in sorted(eyes.items()):
        c = (EP.max(0) + EP.min(0)) / 2
        r = (EP.max(0) - EP.min(0))[0] / 2
        box = (-1.6 * r, -1.2 * r, 1.6 * r, 1.2 * r)
        W_, H_ = int((box[2] - box[0]) / EL.RES), int((box[3] - box[1]) / EL.RES)
        GX, GY = np.meshgrid(box[0] + (np.arange(W_) + 0.5) * EL.RES, box[1] + (np.arange(H_) + 0.5) * EL.RES)
        near = np.linalg.norm(P - c, axis=1) < 4.0 * r
        tri = T[near[T].all(axis=1)]
        for vname, yaw, pitch in EL.VIEWS:
            if vname not in views:
                continue
            R = EL.turn(np.radians(yaw), np.radians(pitch))
            Ze = EL.zbuf(EP, ET, R, c, box)
            eye = np.isfinite(Ze)
            inward = np.zeros((H_, W_), bool)               # where the nearest skin faces the eye's middle (a lid's back, the lining: culled in Godot)
            Zs = EL.zbuf(SP, tri, R, c, box, inward)
            with np.errstate(invalid="ignore"):
                dz = Ze - Zs
                poke = eye & np.isfinite(Zs) & (dz > max(deep, 0.0001 if lined else 0)) & (dz < (EL.NEAR_LINED if lined else EL.NEAR))
                if lined:
                    poke &= ~(GX ** 2 + GY ** 2 + Zs ** 2 < (r - 0.0001) ** 2) & ~inward
                opening = eye & ~poke & (~np.isfinite(Zs) | (dz > 0))
                given = eye & np.isfinite(Zs) & (dz > 0) & (dz <= deep) & ~inward if deep > 0 else np.zeros_like(eye)
            rim = opening.copy()
            for ax in (0, 1):
                grown = rim.copy()
                for k in range(1, 7):
                    grown |= np.roll(rim, k, axis=ax) | np.roll(rim, -k, axis=ax)
                rim = grown
            through = poke & ~rim
            was = out.get(side, (0.0, 0.0, 0.0, 0.0))
            out[side] = (max(was[0], float(through.sum() * EL.RES * EL.RES * 1e6)), max(was[1], float(dz[through].max() * 1000) if through.any() else 0.0),
                         max(was[2], float((poke & rim).sum() * EL.RES * EL.RES * 1e6)), max(was[3], float(given.sum() * EL.RES * EL.RES * 1e6)))
    return out


def lid_room_of(path):
    """the room a baked copy says its mixed expressions want (its skin node's lidRoom, m); None when it says none"""
    j = glb_json(path) or {}
    for n in j.get("nodes", []):
        ex = n.get("extras") or {}
        if str(n.get("name", "")).endswith("_skin") and "lidRoom" in ex:
            return float(ex["lidRoom"])
    return None


def find_export(person):
    if person:
        f = PEOPLE / person / "export" / f"{person}.glb"
        return f if f.exists() else None
    for d in sorted(PEOPLE.iterdir()) if PEOPLE.is_dir() else []:
        f = d / "export" / f"{d.name}.glb"
        if f.exists() and blinks(f):
            return f
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", default="")
    ap.add_argument("--person", default="")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--pictures", action="store_true", help="also: the face in Godot at rest, smiling and squinting down, as MHR's moves alone leave it and as baked (under xvfb; slow on a CPU)")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("GDFACES FAIL: no godot (tools/godot_setup.sh)")
        return 1
    src = Path(a.glb) if a.glb else find_export(a.person)
    if src is None or not src.exists():
        print("GDFACES FAIL: no Character Studio export to bake (%s): Export for Godot in the Studio, or STUDIO or GROWPAGE makes one" % (a.glb or a.person or "none under Content/Studio/People with its blink"))
        return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "project.godot").write_text(PROJECT, encoding="utf-8")
    shutil.copytree(LOOK, OUT / "addons" / "horrorstudio_look", ignore=shutil.ignore_patterns("*.import", "presets", "textures", "demo"))
    (OUT / "addons" / "horrorstudio" / "tests").mkdir(parents=True)
    for f in ["face.gd", "face_clip.gd", "tests/faces.gd"]:
        shutil.copy(RUNTIME / f, OUT / "addons" / "horrorstudio" / f)
    people = OUT / "people"
    people.mkdir()
    (people / ".gdignore").write_text("", encoding="utf-8")       # (read at run time, as the game reads it: not imported)
    who = people / "who.glb"
    had = blinks(src)
    r = subprocess.run(["node", str(ROOT / "tools" / "face_morphs.mjs"), str(src), str(who)], capture_output=True, text=True, timeout=900)
    if r.returncode != 0 or "FACEMORPHS ok" not in r.stdout:
        print((r.stdout + r.stderr)[-2000:])
        print("GDFACES FAIL: the face bake")
        return 1
    print("       " + " ".join((r.stdout.strip().splitlines() or [""])[0].split()))
    raw = OUT / "raw.glb"                                         # the same with MHR's moves as they are: the before
    subprocess.run(["node", str(ROOT / "tools" / "face_morphs.mjs"), str(src), str(raw), "--raw"], capture_output=True, text=True, timeout=900)
    keep = Path(a.keep)
    keep.mkdir(parents=True, exist_ok=True)
    subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=900)   # (the classes' names registered)
    cmd = [g, "--headless", "--fixed-fps", "60", "--path", str(OUT), "-s", "res://addons/horrorstudio/tests/faces.gd", "--", f"--out={keep}", f"--glb={who}"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        text = r.stdout + r.stderr
    except subprocess.TimeoutExpired as e:
        text = (e.stdout or b"").decode("utf-8", "replace") + (e.stderr or b"").decode("utf-8", "replace") + "\n(stopped after 900 s)"
    text = "\n".join(l for l in text.splitlines() if l and "ALSA" not in l and "snd_" not in l)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l]
    if bad or "GDFACES {done}" not in text:
        print(text[-3000:])
        print("GDFACES FAIL: the test didn't run clean")
        return 1
    rep = json.loads((keep / "faces.json").read_text(encoding="utf-8"))
    ok = True

    def say(good, words):
        nonlocal ok
        ok = ok and bool(good)
        print(("  ok  " if good else "  BAD ") + words)

    mm = lambda v: 1000.0 * v
    meshes = rep.get("meshes") or []
    say(rep.get("loaded") and meshes, f"{src.name} baked and read by Godot at run time: {len(meshes)} meshes carry MHR's face shapes (the copy {rep.get('file_mb', 0):.0f} MB, read in {rep.get('load_ms', 0) / 1000.0:.1f} s here)")
    if not meshes:
        print("GDFACES FAIL")
        return 1
    skin = meshes[0]
    say(skin["shapes"] == 72 and not rep.get("missing"), "the skin (%s, %d points) carries all 72 by Meta's names%s" % (
        skin["name"], skin["verts"], "" if not rep.get("missing") else " (missing: %s)" % ", ".join(rep["missing"][:6])))
    if had:
        say(skin["blink"] >= 2 and skin["all"] >= 72 + skin["blink"] - 2, "beside its own blink: %d shapes in all, %d of them the blink and its in-betweens (kept as the export made them)" % (skin["all"], skin["blink"]))
        say(rep.get("blinker") and rep.get("found_blink"), "her blinker (HSBlink) is put on and the face player finds it under her body")
        rr, rp, ra = rep.get("room_rest") or [1, [1]], rep.get("room_playing") or [0, [0]], rep.get("room_after") or [1, [1]]
        say(rep.get("movers", 0) >= 20 and rep.get("eye_mats", 0) >= 2 and abs(rr[0]) < 1e-9 and all(abs(x) < 1e-9 for x in rr[1]),
            "the eyes on the Studio's eye (%d materials with their wet layers); at rest they're drawn where they are (lid_room 0; her blinker watches %d lid-moving shapes)" % (rep.get("eye_mats", 0), rep.get("movers", 0)))
    else:
        print("  --  this export is from before the blink: no blinker, the lids are the 72's own (Export for Godot again for the blink)")
    rest = [m for m in meshes[1:]]
    say(not had or len(rest) >= 1, "the other meshes that ride the face: %s" % (", ".join("%s (%d of the 72)" % (m["name"], m["shapes"]) for m in rest) or "none"))
    reach, tall = rep.get("reach") or {}, rep.get("tall", 1.7)
    jaw, lip, brow = reach.get("jawDrop", {}), reach.get("lipCornerPuller_L", {}), reach.get("browLowerer_R", {})
    say(0.006 < jaw.get("far", 0) < 0.06 and jaw.get("moved", 0) > 500, "the jaw's drop is a real move in the mesh: its furthest point %.1f mm, %d points moved" % (mm(jaw.get("far", 0)), jaw.get("moved", 0)))
    say(0.002 < lip.get("far", 0) < 0.04 and 0.001 < brow.get("far", 0) < 0.03, "a lip corner's pull %.1f mm, a brow's lowering %.1f mm (the body %.2f m tall)" % (mm(lip.get("far", 0)), mm(brow.get("far", 0)), tall))

    played = {"jawDrop": 0.8, "lipCornerPuller_L": 0.6, "lipCornerPuller_R": 0.6, "browLowerer_L": 0.5, "browLowerer_R": 0.5, "upperLidRaiser_L": 0.4}
    alone = rep.get("alone") or {}
    sk = alone.get(skin["name"], {})
    say(rep.get("played") and all(abs(sk.get(k, -1) - v) < 0.02 for k, v in played.items()), "an expression played: on the skin every shape at its weight (the jaw %.2f, the lip corners %.2f, the brows %.2f)" % (
        sk.get("jawDrop", -1), sk.get("lipCornerPuller_L", -1), sk.get("browLowerer_L", -1)))
    others = {n: v for n, v in alone.items() if n != skin["name"]}
    set_on = {n: [k for k in v if k in played and abs(v[k] - played[k]) < 0.02] for n, v in others.items()}
    wrong = {n: [k for k in v if k in played and abs(v[k] - played[k]) >= 0.02] for n, v in others.items()}
    riders = [n for n, v in others.items() if any(k in played for k in v)]
    if riders:
        say(not any(wrong.values()) and all(set_on[n] for n in riders), "and on every other mesh that carries them, not the skin alone: %s" % "; ".join("%s %s" % (n, ", ".join(set_on[n])) for n in riders))
    else:
        print("  --  no other mesh of this character carries those shapes (no brows or lashes on it: they're meshes of their own and ride the face when it has them)")
    st = rep.get("state") or {}
    say(st.get("over") == "_test" and st.get("meshes") == len(meshes), "the player's own word: \"%s\" playing on %d meshes%s" % (st.get("over"), st.get("meshes", 0), ", her lids her blinker's" if st.get("blink") else ""))
    if had:
        hold = rep.get("hold") or [0, 0]
        lids_alone = [v.get(k, 0) for v in alone.values() for k in ("eyesClosed_L", "eyesClosed_R") if k in v]
        say(abs(hold[0] - 0.7) < 0.02 and abs(hold[1] - 0.3) < 0.02 and all(abs(x) < 1e-6 for x in lids_alone), "its eyesClosed is handed to the blinker (asked %.2f left, %.2f right) and set on no mesh by the player itself" % (hold[0], hold[1]))
        wb = (rep.get("with_blink") or {}).get(skin["name"], {})
        left = rep.get("lids_left") or {}
        inb = {k: v for k, v in left.items() if "_in" in k and k.startswith(skin["name"] + ":")}
        say(abs(wb.get("eyesClosed_L", -1) - 0.7) < 0.02 and abs(wb.get("eyesClosed_R", -1) - 0.3) < 0.02 and (not inb or any(v > 0.01 for v in inb.values())),
            "the blinker shuts the lids that far with the blink's own arc (the left lid %.2f%s), the player leaving them be" % (
                wb.get("eyesClosed_L", -1), "".join(", %s %.2f" % (k.split(":")[1].replace("eyesClosed_", ""), v) for k, v in inb.items() if v > 0.01 and "_L_" in k)))
        said = lid_room_of(who)
        most = rep.get("room_most", -1)
        say(said is not None and abs(most - said) < 1e-6, "the room her mixed expressions want, measured by the bake and written in her copy (%.2f mm), is what her blinker reads (%.2f mm)" % ((said or 0) * 1000, most * 1000))
        if said and said > 0:
            say(abs(rp[0] - said) < 1e-6 and all(abs(x - rp[0]) < 1e-7 for x in rp[1]), "while the expression moves her lids the eyeballs are drawn that much deeper (%.2f mm, every eye material)" % (rp[0] * 1000))
        else:
            say(abs(rp[0]) < 1e-9 and all(abs(x) < 1e-9 for x in rp[1]), "her lids never reach her eyes: no room asked, the eyeballs drawn where they are while the expression plays too")
        ha = rep.get("hold_after") or [1, 1]
        say(abs(ha[0]) < 1e-6 and abs(ha[1]) < 1e-6 and abs(ra[0]) < 1e-9 and all(abs(x) < 1e-9 for x in ra[1]), "when it ends the lids are given back (the blinker asked for nothing) and the eyes are drawn where they are again")
    after = rep.get("after") or {}
    left_on = [(n, k, v) for n, vs in after.items() for k, v in vs.items() if abs(v) > 1e-4]
    say(not left_on and (rep.get("state_after") or {}).get("over") == "", "and every shape on every mesh is back at 0" + ("" if not left_on else ": not %s" % ", ".join("%s %s %.2f" % t for t in left_on[:4])))
    nb = rep.get("no_blinker") or {}
    v = nb.get("values") or {}
    say(not nb.get("found") and abs(v.get("eyesClosed_L", -1) - 0.7) < 0.02 and abs(v.get("jawDrop", -1) - 0.8) < 0.02, "a body with no blinker (the bake's, an older copy): the lids set on the mesh itself (%.2f)" % v.get("eyesClosed_L", -1))
    # the lids kept off the eyeballs: each lid-moving shape at its full weight, by the file's own depth, before and after
    try:
        after, before = eyes_through_lids(who), eyes_through_lids(raw) if raw.exists() else None
    except ImportError as e:
        after = before = None
        print(f"  --  the eyes against the lids aren't measured here ({e}: numpy)")
    if after:
        rest = after.pop("rest", (0.0, 0.0, 0.0))
        (before or {}).pop("rest", None)
        worst = max(after.items(), key=lambda kv: kv[1][0]) if after else ("", (0.0, 0.0, 0.0))
        edge = max(after.items(), key=lambda kv: kv[1][2]) if after else ("", (0.0, 0.0, 0.0))
        say(after and worst[1][0] <= max(0.05, rest[0] + 0.03), "the lids kept off the eyeballs: of %d shapes that move a lid, each at its full weight, the most of an eye through a lid %.3f mm2 (%s; at rest %.3f); along the opening's rim, where a lid's edge rests on the eye, at most %.2f mm2 (%s)" % (
            len(after), worst[1][0], worst[0], rest[0], edge[1][2], edge[0]))
        if before:
            bw = sorted(before.items(), key=lambda kv: -kv[1][0])[:4]
            if bw and bw[0][1][0] < 0.5:
                print("  --  on this character MHR's own moves leave nothing of an eye through a lid either (%.2f mm2 at most: her lids don't reach the eye's dome)" % bw[0][1][0])
            else:
                say(bw and bw[0][1][0] > max(1.0, 10 * worst[1][0]), "MHR's own moves alone would have left it through them: %s" % "; ".join("%s %.1f mm2, %.1f mm deep" % (k, v[0], v[1]) for k, v in bw))
        # several shapes at once (a smile, a squint): each alone is exact, their sum isn't; the eye drawn a little deeper covers it
        flat = lambda d: (max(v[0] for v in d.values()), max(v[1] for v in d.values()), max(v[3] for v in d.values()))
        room = lid_room_of(who) or 0.0
        mixes = {name: (flat(eyes_through_mix(who, mix)), flat(eyes_through_mix(who, mix, deep=room))) for name, mix in FACES[1:]}
        say(all(d[0] <= 0.05 for _, d in mixes.values()), "several shapes at once (%s): baked alone they leave %s of an eye through a lid; with the eyeball drawn the %.2f mm deeper her copy asks for, %s" % (
            ", ".join("a %s of %d" % (n, len(m)) for n, m in FACES[1:]), "; ".join("%.1f mm2, %.1f mm deep" % (b[0], b[1]) for b, _ in mixes.values()), room * 1000,
            "; ".join("%.3f mm2" % d[0] for _, d in mixes.values())))
        if room > 0:
            rest_deep = flat(eyes_through_mix(who, {}, deep=room))
            print("      (drawn that much deeper at rest too it would give up %.1f mm2 of the eye to the lids' edges: the room is on only while lids move)" % rest_deep[2])
    if a.pictures and ok:
        ok = pictures(g, who, raw, keep) and ok
    if not ok:
        print("GDFACES FAIL")
        return 1
    print("GDFACES ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
