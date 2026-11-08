#!/usr/bin/env python3
"""EXPORTS: the editors' Export for Godot (DECISIONS 2026-11-03, night: "an exports folder with sub folders for each ... so I
can drag and drop them into my Godot project"), each export dropped into a fresh Godot 4.7 project as the user drags it
in and imported headless (tools/godot/exports_probe.gd):

- an interior, the set school_tokyo as the scene builder exports it (levelexport.js): its rooms and things as meshes
  with materials, colliders (a ray from the player's start lands on the floor's, one level from there meets a wall),
  occluders, its lamps as lights, its markers (player_start, the spots, the triggers) with their metadata, each door a
  node of its own with its collider; the Bungalow's too, with its outside as a node of its own;
- a street, hill_motel as the street page exports it: colliders, its insides' markers with their sets;
- a character, a Character Studio export (`_studiotest`, which STUDIO makes) made Godot's as the Studio's Export for
  Godot makes it (storykit/exports.py `character`): a skeleton, MHR's face shapes as blend shapes (skipped, said so, on a
  machine with no export);
- the desk's endpoint writing an export and its README into the folder (a scratch name: Saved/Exports/).

    python tools/godot/exports_check.py          (the desk's server running; Godot: $GODOT or godot)

Ends "EXPORTS ok"."""
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import exports as EX  # noqa: E402

G = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot-mono")
DESK = os.environ.get("DESK_URL", "http://127.0.0.1:8780/")
node = shutil.which("node") or "node"
proj = ROOT / "Saved" / "Godot" / "_exports_check"
errs, notes = [], []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("EXPORTS FAILED: no godot (tools/godot_setup.sh on a cloud session)")
try:
    urllib.request.urlopen(DESK, timeout=5)
except OSError:
    sys.exit(f"EXPORTS FAILED: the desk's server isn't answering at {DESK} (python tools/director/serve.py)")
shutil.rmtree(proj, ignore_errors=True)
proj.mkdir(parents=True)
(proj / "project.godot").write_text('config_version=5\n\n[application]\nconfig/name="exports_check"\n', encoding="utf-8")
shutil.copy(ROOT / "tools/godot/exports_probe.gd", proj / "exports_probe.gd")

# the exports, as the pages make them
for game, f in [("set:school_tokyo", "interior_school_tokyo.glb"), ("set:bungalow", "interior_bungalow.glb")]:
    r = run([node, str(ROOT / "tools/director/levelexport.mjs"), "--game", game, "--out", str(proj / f)], cwd=ROOT, timeout=900)
    if r.returncode or not (proj / f).exists():
        errs.append(f"the scene builder's export of {game}: " + (r.stdout + r.stderr)[-400:])
    else:
        print("  " + r.stdout.strip().splitlines()[-1])
r = run([node, str(ROOT / "tools/director/streetexport.mjs"), "--street", "hill_motel", "--out", str(proj / "street_hill_motel.glb")], cwd=ROOT, timeout=900)
if r.returncode or not (proj / "street_hill_motel.glb").exists():
    errs.append("the street page's export of hill_motel: " + (r.stdout + r.stderr)[-400:])
else:
    print("  " + r.stdout.strip().splitlines()[-1])
people = ROOT / "Content" / "Studio" / "People"
who = "_studiotest" if (people / "_studiotest/export/_studiotest.glb").is_file() else next((p.name for p in sorted(people.glob("*")) if (p / "export" / f"{p.name}.glb").is_file()), None) if people.is_dir() else None
if who:
    out, said = EX.character(who, people, node=node, into=proj / "_character")
    shutil.copy(out, proj / f"character_{who}.glb")
    print(f"  the Character Studio's {who} made Godot's: {said}")
else:
    notes.append("no Character Studio export on this machine: the character left out (STUDIO makes _studiotest)")

# the endpoint: an export and its README written into its folder (a scratch name, Saved/Exports/)
tiny = (proj / "interior_bungalow.glb").read_bytes() if (proj / "interior_bungalow.glb").exists() else b""
if tiny:
    req = urllib.request.Request(DESK + "api/exports/interiors/_exportcheck/_exportcheck.glb?what=(a%20check)&from=set:bungalow", data=tiny, method="POST")
    try:
        j = json.loads(urllib.request.urlopen(req, timeout=60).read())
        d = ROOT / j["folder"]
        if not (d / "_exportcheck.glb").is_file() or (d / "_exportcheck.glb").stat().st_size != len(tiny) or not (d / "README.txt").is_file():
            errs.append(f"the desk's /api/exports didn't write the .glb and its README into {j['folder']}")
        elif not j["folder"].startswith("Saved/Exports/"):
            errs.append(f"a scratch name's export went to {j['folder']}, not Saved/Exports/")
        else:
            print(f"  the desk's /api/exports wrote {j['path']} and its README")
        shutil.rmtree(d, ignore_errors=True)
    except OSError as e:
        errs.append(f"the desk's /api/exports: {e} (restart the desk's server after a pull)")
    bad = urllib.request.Request(DESK + "api/exports/interiors/x/y.glb", data=b"not a glb", method="POST")
    try:
        urllib.request.urlopen(bad, timeout=30)
        errs.append("the desk's /api/exports took a file that isn't a .glb named for its folder")
    except urllib.error.HTTPError as e:
        if e.code != 400:
            errs.append(f"the desk's /api/exports answered {e.code} to a bad file")

# into Godot
run([G, "--headless", "--path", str(proj), "--import"], timeout=900)
r = run([G, "--headless", "--path", str(proj), "-s", "exports_probe.gd"], timeout=600)
got = {}
for ln in r.stdout.splitlines():
    if ln.startswith("EXPROBE "):
        _, f, js = ln.split(" ", 2)
        got[f] = json.loads(js)
if not got:
    sys.exit("EXPORTS FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-800:])


def c(m, k):
    return int(m.get("counts", {}).get(k, 0))


for f, m in got.items():
    if m.get("error"):
        errs.append(f"{f}: {m['error']}")
        continue
    say = f"{f}: {c(m, 'MeshInstance3D')} meshes, {m['materials']} materials ({m['textured']} textured), {c(m, 'StaticBody3D')} static bodies ({m['shapes']} shapes), " \
          f"{c(m, 'OccluderInstance3D')} occluders, {c(m, 'OmniLight3D') + c(m, 'SpotLight3D')} lights, {len(m['markers'])} markers, {len(m['doors'])} doors"
    if f.startswith("interior_"):
        meta = (m.get("meta") or {}).get("horrorstudio") or {}
        if meta.get("kind") != "interior":
            errs.append(f"{f}: its root doesn't say it's an interior in its metadata: {m.get('meta')}")
        for k in ["visual", "doors", "collision", "occluders", "lights", "markers"]:
            if k not in m["top"]:
                errs.append(f"{f}: no {k} node (it has {m['top']})")
        if c(m, "MeshInstance3D") < 40 or m["materials"] < 5:
            errs.append(f"{f}: too little came in ({c(m, 'MeshInstance3D')} meshes, {m['materials']} materials)")
        if c(m, "StaticBody3D") < 1 or m["shapes"] < c(m, "StaticBody3D"):
            errs.append(f"{f}: no colliders came in (the -colonly meshes)")
        if c(m, "OccluderInstance3D") < 1:
            errs.append(f"{f}: no occluders came in (the -occonly meshes)")
        if c(m, "OmniLight3D") + c(m, "SpotLight3D") < 1:
            errs.append(f"{f}: its lamps didn't come in as lights")
        for d in m["doors"]:
            if d["body"] < 1 or "hinge" not in d["meta"]:
                errs.append(f"{f}: the door {d['name']} has no collider of its own or no hinge in its metadata: {d}")
        if c(m, "MeshInstance3D") and any(k.endswith("-colonly") or k.endswith("-occonly") for k in m["top"]):
            errs.append(f"{f}: a -colonly or -occonly mesh stayed a mesh")
        fl = m.get("floor") or {}
        if fl.get("hit") is None:
            errs.append(f"{f}: a ray down from {('player_start' if 'player_start' in m['markers'] else 'a marker')} met no floor collider: {fl}")
        elif abs(fl["hit"] - (fl["from"][1] - 0.0)) > 1.2:
            errs.append(f"{f}: the floor's collider is {fl['from'][1] - fl['hit']:.2f} m under the marker")
        if m.get("wall") is None or m["wall"] > 20:
            errs.append(f"{f}: level from the floor, no wall's collider within 20 m: {m.get('wall')}")
        say += f"; the floor {fl.get('from', [0, 0])[1] - (fl.get('hit') or 0):.2f} m under the marker, a wall {m.get('wall') or 0:.2f} m off"
    if f == "interior_school_tokyo.glb":
        if "player_start" not in m["markers"] or (m["markers"]["player_start"] or {}).get("kind") != "start":
            errs.append(f"{f}: no player_start marker with its metadata: {list(m['markers'])[:6]}")
        if not any(k.startswith("spot_") for k in m["markers"]) or not any(k.startswith("trigger_") for k in m["markers"]):
            errs.append(f"{f}: the spots or the triggers didn't come in as markers")
        vols = {k: v for k, v in m["markers"].items() if k.endswith("__volume") and isinstance(v, dict)}
        if not vols or not all(v.get("floor") and isinstance(v.get("mats"), dict) for v in vols.values()):
            errs.append(f"{f}: a room's volume marker without its floor and surfaces (the starter's sound reads them): {list(vols.items())[:2]}")
        else:
            say += f"; {len(vols)} rooms' surfaces on their markers (e.g. {next(iter(vols.values())).get('floor')})"
        if len(m["doors"]) < 3:
            errs.append(f"{f}: {len(m['doors'])} doors, the set has more")
    if f == "interior_bungalow.glb" and "outside" not in m["top"]:
        errs.append(f"{f}: the Bungalow's outside isn't a node of its own: {m['top']}")
    if f.startswith("street_"):
        if c(m, "StaticBody3D") < 1:
            errs.append(f"{f}: no colliders came in")
        ins = [k for k in m["top"] if k == "insides"]
        if not ins:
            errs.append(f"{f}: no insides node (where the walk-in buildings' levels go)")
    if f.startswith("character_"):
        if c(m, "Skeleton3D") < 1:
            errs.append(f"{f}: no skeleton")
        if m["blend"] < 72 or not {"jawDrop", "eyesClosed_L", "lipCornerPuller_R"} <= set(m["blend_names"]):
            errs.append(f"{f}: MHR's face shapes didn't come in as blend shapes ({m['blend']}: {m['blend_names'][:6]})")
        say += f", a skeleton, {m['blend']} blend shapes"
    print("  " + say)
for n in notes:
    print("  note: " + n)
for e in errs:
    print("ERROR: " + e)
print("EXPORTS ok" if not errs else f"EXPORTS FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
