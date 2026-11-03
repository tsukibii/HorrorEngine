#!/usr/bin/env python3
"""The director's desk: a local page for plotting a game with Claude (the flow, scenes and their clips, stitches,
endings, notes to each other, an animatic of any path). It reads and writes the same Content/Games/<Game>/story.json
Claude edits, so both see each other's changes; every save keeps the previous file in Saved/Story/<Game>/history/.

    python tools/director/serve.py            then open http://127.0.0.1:8780

Plain Python, no installs. Listens on 127.0.0.1 only.
"""
import json
import re
import os
import shutil
import subprocess
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402
from storykit import plan as P  # noqa: E402
from storykit import library as LIB  # noqa: E402
from storykit import kit as KIT  # noqa: E402
from storykit import pbr as PBR  # noqa: E402
from storykit import life as LIFE  # noqa: E402
sys.path.insert(0, str(HERE.parent))                 # tools/: the checks (story_check, level_check)

STATIC = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain",
          ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml"}   # images: the guide's pictures (guide/)
BODY = {".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".fbx": "application/octet-stream",
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
BODIES = L.STUDIO / "Bodies"
PEOPLE = L.STUDIO / "People"                       # the Character Studio's characters: each one's export/<name>.glb is a body for the desk


def people_bodies():
    """the Character Studio's characters exported for the desk (People/<name>/export/<name>.glb), as previs_body values"""
    if not PEOPLE.is_dir():
        return []
    return sorted(f"people/{d.name}" for d in PEOPLE.iterdir() if d.is_dir() and not d.name.startswith(".") and (d / "export" / f"{d.name}.glb").is_file())
FOOTAGE = L.ROOT / "Footage"          # the takes, as intake.py copies them (Footage/<Game>/<take id>.mp4)
MEDIA = {".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4"}

HEADS = L.STUDIO / "Heads"           # the face page's pictures and heads (git-ignored: real people's faces)
FACE_FILES = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
FACE = {"proc": None}
EXPRESSIONS = L.STUDIO / "Expressions"   # the expression library (docs/EXPRESSIONS_PLAN.md §1): <id>/expression.json, clip.mp4
EXPR_SAVED = ROOT / "Saved" / "Expressions"    # pending/<token>: an import waiting for Accept; removed/: what the red x took away
EXPR_FILES = {"clip.mp4"}


def expr_list():
    """the library, newest first: each expression's id, name, length, stamp and whether it has its clip"""
    out = []
    for d in sorted(EXPRESSIONS.iterdir()) if EXPRESSIONS.is_dir() else []:
        f = d / "expression.json"
        if d.name.startswith(".") or not f.is_file():
            continue
        e = json.loads(f.read_text(encoding="utf-8"))
        stamp = int(f.stat().st_mtime)
        of = (e.get("of") or {}).get("id")              # a loop cut from another: its clip is the other's
        out.append({"id": d.name, "name": e.get("name", d.name), "secs": e.get("secs"), "made": e.get("made", ""), "stamp": stamp,
                    "clip": (d / "clip.mp4").is_file() or bool(of and (EXPRESSIONS / of / "clip.mp4").is_file()),
                    "loop": bool(e.get("loop")), "of": e.get("of")})
    return sorted(out, key=lambda x: x["made"], reverse=True)


def expr_id(name):
    """an expression's folder from its name: lower case, letters, digits and _, unique in the library"""
    base = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:40] or "expression"
    i, out = 1, base
    while (EXPRESSIONS / out).exists():
        i += 1; out = f"{base}_{i}"
    return out


def mhr_face_names():
    """MHR's 72 face shapes by Meta's names, in the order of the bodies' shape_c_45..116 (MHR_lod1.bin's header)"""
    import struct
    with open(L.STUDIO / "Bodies" / "MHR_lod1.bin", "rb") as fh:
        n = struct.unpack("<I", fh.read(4))[0]
        return json.loads(fh.read(n))["expr_names"]


PORT = int(os.environ.get("DESK_PORT", 8780))     # a second desk (a test beside the open one): DESK_PORT=8781
KEEP = 50
STREETS = L.STUDIO / "Streets"          # the street builder's streets (street.html): <name>/street.json, refs/ its photos (git-ignored)
STREET_NAME = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
PHOTO = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif"}


# a street's Blender job from the paint page (paint.html): `street.py look` or `bake`, one at a time, its log on disk
BAKES = {}


def bake_state(name):
    j = BAKES.get(name)
    out = ROOT / "Saved" / "Streets" / name / "blender"
    pics = sorted(((f.name, f.stat().st_mtime) for f in out.glob("*") if f.suffix.lower() in (".jpg", ".png") and not f.name.startswith("street_glyph")),
                  key=lambda x: -x[1]) if out.is_dir() else []
    log = []
    if j and j["log"].is_file():
        log = j["log"].read_text(encoding="utf-8", errors="replace").splitlines()[-60:]
    running = bool(j and j["proc"].poll() is None)
    return {"running": running, "cmd": j and j["cmd"], "code": None if not j or running else j["proc"].returncode,
            "started": j and j["started"], "log": log, "pictures": [{"file": n, "mtime": m} for n, m in pics[:40]]}


def street_file(name):
    name = urllib.parse.unquote(name or "")
    return STREETS / name / "street.json" if STREET_NAME.match(name) else None


def made_looks(story):
    """{ref: meta} of the tuned sets a story's rooms and blocks paint with (their look objects, STREET_PAINT §2),
    each made now when it's missing (pbrmix.py: a second or two the first time), for the stage beside the plan's
    `mat:pbr/_made/<hash>` tags; a look that can't be made (its set not on this machine's shelf) is left out: grey."""
    out = {}
    for look, where in LIB.looks(story):
        if not isinstance(look, dict) or ".outside." in where:    # the outside's slots: street3.js asks for its own
            continue
        try:
            from storykit import pbrmix as MIX  # noqa: PLC0415 - numpy and Pillow, only when a look needs them
            ref, m = MIX.made(look)
            if m:
                out[ref] = dict(m, base="/" + ref)
        except (ValueError, OSError, ImportError):
            pass
    return out


def history_dir(game):
    d = ROOT / "Saved" / "Story" / game.replace(":", "-") / "history"
    d.mkdir(parents=True, exist_ok=True)
    return d


def face_call(req):
    """one request to tools/face_mesh.py's worker (its Worker: MediaPipe's environment, started on first use and kept,
    holding the pictures' points and the head templates, so a slider's fit takes a fraction of a second)"""
    if FACE["proc"] is None:
        import face_mesh  # noqa: PLC0415 - tools/, on the path above
        FACE["proc"] = face_mesh.Worker(ROOT / "Saved" / "face_mesh_worker.log")
    return FACE["proc"].call(req)


def face_name(n):
    """a face session's or a picture's name: letters, digits, _ - . and no leading dot"""
    import urllib.parse
    n = urllib.parse.unquote(n)
    return n if n and not n.startswith(".") and all(ch.isalnum() or ch in "_-." for ch in n) else None



def latest_export(game):
    """A game's newest Godot export: Saved/Godot/<game>_v<NNN> with the highest number (DECISIONS 2026-10-30, noon), or None."""
    import re  # noqa: PLC0415
    best = None
    base = ROOT / "Saved" / "Godot"
    if base.exists():
        for d in base.iterdir():
            m = re.fullmatch(re.escape(game) + r"_v(\d+)", d.name)
            if m and d.is_dir() and (best is None or int(m.group(1)) > best[0]):
                best = (int(m.group(1)), d)
    return best[1] if best else None

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json", cache=False):
        data = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body)).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith(("text/", "application/json")) else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=86400" if cache else "no-store")   # cached: the URL carries the set's stamp
        self.end_headers()
        self.wfile.write(data)

    def send_media(self, f):
        """A take, with byte ranges so the browser can seek in it."""
        size, ctype = f.stat().st_size, MEDIA[f.suffix.lower()]
        rng = self.headers.get("Range", "")
        start, end = 0, size - 1
        if rng.startswith("bytes="):
            a, _, b = rng[6:].partition("-")
            start = int(a) if a else max(0, size - int(b or 0))
            end = min(size - 1, int(b)) if a and b else size - 1
        with open(f, "rb") as fh:
            fh.seek(start)
            data = fh.read(end - start + 1)
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(len(data)))
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        self.wfile.write(data)

    def game_path(self, name):
        name = urllib.parse.unquote(name or "")         # a set's name comes as set%3A<name>
        if not name or "/" in name or "\\" in name or name.startswith("."):
            return None
        if name.startswith("set:"):                    # a set (Content/Studio/Sets): the scene builder designs it like a game's level
            return L.SETS / name[4:] / "story.json" if L.SET_NAME.match(name[4:]) else None
        return L.GAMES / name / "story.json"

    def do_GET(self):
        parts = self.path.split("?")[0].strip("/").split("/")
        if parts == [""]:
            parts = ["index.html"]
        f = HERE.joinpath(*parts) if parts and ".." not in parts else None
        if f and f.suffix in STATIC and f.is_file() and HERE in f.resolve().parents:
            return self.send(200, f.read_bytes(), STATIC[f.suffix])
        if parts[0] in ("shared", "env") and len(parts) == 2 and ".." not in parts:      # tools/shared (components any page can import) and Content/Studio/Env (HDRs)
            f = (ROOT / "tools" / "shared" if parts[0] == "shared" else ROOT / "Content" / "Studio" / "Env") / parts[1]
            if f.is_file():
                return self.send(200, f.read_bytes(), "text/javascript" if f.suffix == ".js" else "application/octet-stream")
        if parts[0] == "godot" and len(parts) >= 3 and ".." not in parts and self.game_path(parts[1]):          # an exported Godot project's guide and pictures
            base = latest_export(parts[1]) or (ROOT / "Saved" / "Godot" / parts[1])   # the newest version's guide
            f = base
            for q in parts[2:]:
                f = f / q
            if f.is_file() and base.resolve() in f.resolve().parents:
                import mimetypes  # noqa: PLC0415
                return self.send(200, f.read_bytes(), mimetypes.guess_type(f.name)[0] or "application/octet-stream")
            return self.send(404, {"error": "no such file in the export"})
        if parts[0] == "boardgames" and len(parts) == 3 and parts[2].endswith(".js") and self.game_path(parts[1]):   # a board game's rules: the game's own, else the studio's
            for d in (L.GAMES / parts[1] / "BoardGames", L.BOARD_GAMES):
                if (d / parts[2]).is_file() and d.resolve() in (d / parts[2]).resolve().parents:
                    return self.send(200, (d / parts[2]).read_bytes(), "text/javascript")
            return self.send(404, {"error": f"no board game {parts[2]}"})
        if parts[:2] == ["api", "painted"] and len(parts) == 3 and self.game_path(parts[2]):     # the things painted on their templates
            out, base = {}, L.GAMES / parts[2] / "Art" / "Textures"                         # (tools/uv_templates.py): each one's layout and picture
            for j in (base.glob("*/*.json") if base.is_dir() else []):
                png = j.with_suffix(".png")
                if j.stem == j.parent.name and png.is_file():
                    try:
                        out[j.stem] = dict(json.loads(j.read_text(encoding="utf-8")), png=f"/painted/{parts[2]}/{j.stem}/{png.name}", t=int(png.stat().st_mtime))
                    except ValueError:
                        pass
            return self.send(200, {"things": out})
        if parts[0] == "painted" and len(parts) == 4 and self.game_path(parts[1]) and ".." not in parts and parts[3].endswith(".png"):
            f = L.GAMES / parts[1] / "Art" / "Textures" / parts[2] / parts[3]
            if f.is_file() and (L.GAMES / parts[1]).resolve() in f.resolve().parents:
                return self.send(200, f.read_bytes(), "image/png")
            return self.send(404, {"error": "no such painting"})
        if parts[:2] == ["api", "boardgames"] and len(parts) == 3 and self.game_path(parts[2]):   # the games a table can have
            return self.send(200, {"games": [dict(m, id=k) for k, m in L.board_games(parts[2]).items()]})
        if parts[:2] == ["api", "bodies"]:
            files = sorted(f.name for f in BODIES.glob("*") if f.suffix.lower() in (".glb", ".gltf", ".fbx")) if BODIES.exists() else []
            return self.send(200, {"bodies": files + people_bodies()})
        if parts[:2] == ["bodies", "people"] and len(parts) == 3:    # a Character Studio character, as exported for the desk (rigged, its eyes)
            name = urllib.parse.unquote(parts[2])
            gf = PEOPLE / name / "export" / f"{name}.glb" if name and "/" not in name and "\\" not in name and not name.startswith(".") else None
            if gf and gf.is_file():
                return self.send(200, gf.read_bytes(), BODY[".glb"])
            return self.send(404, {"error": f"no export of {name} from the Character Studio"})
        if parts[0] == "bodies" and len(parts) >= 2 and ".." not in parts:
            bf = BODIES.joinpath(*parts[1:])
            if bf.is_file() and bf.suffix.lower() in BODY:
                return self.send(200, bf.read_bytes(), BODY[bf.suffix.lower()])
            return self.send(404, {"error": "no such body file"})
        if parts[:2] == ["api", "library"]:          # what's been fetched into Content/Studio/Library
            meshes = sorted(f"{f.parent.name}/{f.stem}" for f in LIB.MESHES.glob("*/*.glb")) if LIB.MESHES.exists() else []
            tex = {}
            for m in (LIB.TEXTURES.glob("*/*/meta.json") if LIB.TEXTURES.exists() else []):
                try:
                    tex[f"{m.parent.parent.name}/{m.parent.name}"] = json.loads(m.read_text(encoding="utf-8"))
                except ValueError:
                    pass
            for ref, m in PBR.scan().items():       # the PBR shelf: same shape, files from Content/Studio/PBR
                tex[ref] = dict(m, base="/" + ref)
            # the prop generator's props in the library's index (docs/PROPGEN.md §6): the scene builder places them by
            # size, on and in the furniture (SCENE_BUILDER §10); made here or not (the index ships, the meshes are made)
            props = {f"props/{n}": {"size": LIB.mesh_size(f"props/{n}"), "tris": i.get("tris")} for n, i in LIB.mesh_index("props").items()}
            return self.send(200, {"meshes": meshes, "textures": tex, "props": props})
        if parts[:2] == ["api", "pbrfolders"]:       # the folders of yours attached to the shelf (ASSETS §6)
            return self.send(200, {"folders": [dict(f, there=Path(f["path"]).is_dir()) for f in PBR.attached()], "root": str(PBR.ROOT)})
        if parts[:2] == ["api", "pbrbrowse"]:        # a folder's subfolders, to pick one to attach
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                return self.send(200, PBR.browse((q.get("path") or [None])[0]))
            except (ValueError, OSError) as e:
                return self.send(400, {"error": str(e)})
        if parts[:2] == ["api", "pbr"]:              # the shelf page: every set, scanned (new ZIPs unpacked)
            sets = PBR.scan()
            for ref, m in sets.items():
                m["base"], m["unreal"] = "/" + ref, "/".join(PBR.unreal_path(ref))
            return self.send(200, {"root": str(PBR.ROOT), "sets": sets, "folders": PBR.attached()})
        if parts[:2] == ["api", "decals"]:           # the street's decals (tools/streetbake/decals.py), made when missing
            sys.path.insert(0, str(ROOT / "tools"))
            from streetbake import decals as DEC  # noqa: PLC0415 - plain Python (numpy, Pillow)
            return self.send(200, DEC.ensure(say=lambda *a: None))
        if parts[0] == "decals" and len(parts) == 2 and re.match(r"^[a-z0-9_]+\.png$", parts[1]):
            df = ROOT / "assets" / "decals" / parts[1]
            return self.send(200, df.read_bytes(), "image/png", cache=True) if df.is_file() else self.send(404, {"error": "no such decal"})
        if parts[0] == "pbr" and len(parts) >= 3:
            rel = [urllib.parse.unquote(p) for p in parts[1:]]
            pf = PBR.own_file("pbr/" + "/".join(rel[:-1]), rel[-1]) if ".." not in rel and all(rel) else None   # assets/pbr, pbr/, an attached folder
            if pf and pf.is_file() and pf.suffix.lower() in BODY:
                return self.send(200, pf.read_bytes(), BODY[pf.suffix.lower()], cache=True)
            return self.send(404, {"error": "not on the PBR shelf"})
        if parts[0] == "library" and len(parts) >= 3 and ".." not in parts:
            lf = LIB.LIB.joinpath(*parts[1:])
            if lf.is_file() and lf.suffix.lower() in BODY and LIB.LIB.resolve() in lf.resolve().parents:
                return self.send(200, lf.read_bytes(), BODY[lf.suffix.lower()])
            return self.send(404, {"error": "not in the library"})
        if parts[:2] == ["api", "sfx"]:              # the sound-effect shelf (Content/Studio/SFX, tools/sfx.py)
            f = L.STUDIO / "SFX" / "index.json"
            return self.send(200, f.read_bytes() if f.is_file() else {"format": "horrorstudio-sfx", "sounds": {}}, "application/json")
        if parts[0] == "sfx" and len(parts) == 3 and ".." not in parts and parts[2].endswith(".ogg"):
            sf = L.STUDIO / "SFX" / parts[1] / parts[2]
            if sf.is_file():
                return self.send(200, sf.read_bytes(), "audio/ogg", cache=True)
            return self.send(404, {"error": "not on the sound shelf"})
        if parts[:2] == ["api", "lives"]:            # the little things' lives (Content/Studio/Life/lives.json, life.js)
            return self.send(200, LIFE.data())
        if parts[:2] == ["api", "soma"]:             # Kimodo's 77-joint skeleton, for retargeting its motions, and its twin of each previs joint
            soma = json.loads((L.STUDIO / "soma77.json").read_text(encoding="utf-8"))
            try:
                soma["map"] = json.loads((L.ROOT / "setup" / "kimodo.json").read_text(encoding="utf-8"))["npz"]["joint_map"]
            except (OSError, KeyError, ValueError):
                pass
            return self.send(200, soma)
        if parts[:2] == ["api", "poses"]:
            return self.send(200, (L.STUDIO / "poses.json").read_bytes())
        if parts[:2] == ["api", "motion"] and len(parts) >= 4:
            p = self.game_path(parts[2])
            mf = (p.parent / "Motion" / "/".join(parts[3:])) if p else None
            if not mf or ".." in parts or not mf.is_file():
                return self.send(404, {"error": "no such motion"})
            return self.send(200, mf.read_bytes())
        if parts[:2] == ["api", "takes"] and len(parts) == 3 and self.game_path(parts[2]):
            d = FOOTAGE / parts[2]
            files = sorted(f.name for f in d.iterdir() if f.suffix.lower() in MEDIA) if d.is_dir() else []
            return self.send(200, {"takes": files})
        if parts[0] == "takes" and len(parts) == 3 and self.game_path(parts[1]) and ".." not in parts:
            tf = FOOTAGE / parts[1] / parts[2]
            if not tf.is_file() or tf.suffix.lower() not in MEDIA:
                return self.send(404, {"error": "no such take"})
            return self.send_media(tf)
        if parts[:2] == ["api", "kimodo"] and len(parts) == 3 and self.game_path(parts[2]):   # the Kimodo helper's status
            inbox = L.ROOT / "Saved" / "Story" / parts[2] / "kimodo"
            inbox.mkdir(parents=True, exist_ok=True)
            mdir = L.GAMES / parts[2] / "Motion"
            return self.send(200, {"inbox": str(inbox.relative_to(L.ROOT)).replace("\\", "/"),
                                   "saved": sorted(f.stem for f in inbox.glob("*.npz")) + sorted(f.stem for f in L.ROOT.glob("*.npz")),
                                   "made": sorted(f.stem for f in mdir.glob("*.json")) if mdir.is_dir() else [],
                                   "mtimes": {f.stem: f.stat().st_mtime for f in mdir.glob("*.json")} if mdir.is_dir() else {}})
        if parts[:3] == ["api", "face", "sessions"]:  # the face page: each name with its pictures
            out = []
            for d in sorted(HEADS.glob("*/pictures")):
                out.append({"name": d.parent.name, "pictures": sorted(f.name for f in d.iterdir()
                                                                       if f.suffix.lower() in FACE_FILES)})
            return self.send(200, {"sessions": out})
        if parts[:2] == ["api", "kit"]:               # the kit's presets (Content/Studio/Kit/presets.json)
            return self.send(200, KIT.presets_file())
        if parts[:2] == ["api", "games"]:
            return self.send(200, {"games": L.games()})
        if parts[:2] == ["api", "sets"]:              # the places designed before their games (the scene builder)
            return self.send(200, {"sets": L.sets()})
        if parts[:2] == ["api", "story"] and len(parts) == 3:
            p = self.game_path(parts[2])
            if not p or not p.exists():
                return self.send(404, {"error": "no such game"})
            return self.send(200, {"story": json.loads(p.read_text(encoding="utf-8")), "mtime": p.stat().st_mtime})
        if parts[:2] == ["api", "history"] and len(parts) in (3, 4) and self.game_path(parts[2]):   # the saves kept, newest first; one of them
            hist = ROOT / "Saved" / "Story" / urllib.parse.unquote(parts[2]).replace(":", "-") / "history"
            if len(parts) == 3:
                files = sorted(hist.glob("*.json"), reverse=True) if hist.is_dir() else []
                return self.send(200, {"saves": [{"name": f.stem, "at": f.stat().st_mtime, "size": f.stat().st_size} for f in files]})
            f = hist / (parts[3] + ".json")
            if not re.fullmatch(r"\d{8}-\d{6}", parts[3]) or not f.is_file():
                return self.send(404, {"error": "no such save"})
            return self.send(200, {"name": parts[3], "story": json.loads(f.read_text(encoding="utf-8"))})
        if parts[:2] == ["api", "expressions"]:          # the expression library (docs/EXPRESSIONS_PLAN.md §1)
            if len(parts) == 2:
                return self.send(200, {"expressions": expr_list()})
            if parts[2] == "map" and len(parts) == 3:     # ARKit's 52 onto MHR's 72, and MHR's order on the bodies
                amap = json.loads((ROOT / "tools" / "character" / "arkit_mhr.json").read_text(encoding="utf-8"))
                return self.send(200, {"map": amap["map"], "presets": amap.get("presets", {}), "mhr": mhr_face_names()})
            d = (EXPR_SAVED / "pending" / parts[3]) if parts[2] == "pending" and len(parts) == 4 else (EXPRESSIONS / parts[2]) if len(parts) == 3 else None
            if d is not None and face_name(d.name) and (d / "expression.json").is_file():
                return self.send(200, (d / "expression.json").read_bytes())
            return self.send(404, {"error": "no such expression"})
        if parts[0] == "expressions" and len(parts) in (3, 4) and parts[-1] in EXPR_FILES:   # an expression's clip
            d = (EXPR_SAVED / "pending" / parts[2]) if parts[1] == "pending" and len(parts) == 4 else (EXPRESSIONS / parts[1]) if len(parts) == 3 else None
            f = d / parts[-1] if d is not None and face_name(d.name) else None
            if f and f.is_file():
                return self.send_media(f)
            return self.send(404, {"error": "no such file"})
        if parts[:2] == ["api", "streetbake"] and len(parts) == 3:   # the paint page: Blender's job on a street, and its pictures
            return self.send(200, bake_state(parts[2])) if street_file(parts[2]) else self.send(404, {"error": "no such street"})
        if parts[0] == "streetout" and len(parts) == 3 and street_file(parts[1]) and re.match(r"^[\w.\-]+\.(jpg|png)$", parts[2]):
            f = ROOT / "Saved" / "Streets" / parts[1] / "blender" / parts[2]
            return self.send(200, f.read_bytes(), "image/png" if f.suffix == ".png" else "image/jpeg") if f.is_file() else self.send(404, {"error": "no picture"})
        if parts[:2] == ["api", "streets"]:            # the street builder: the streets there are
            names = sorted(d.name for d in STREETS.iterdir() if (d / "street.json").is_file()) if STREETS.is_dir() else []
            return self.send(200, {"streets": names})
        if parts[:2] == ["api", "street"] and len(parts) == 3:
            f = street_file(parts[2])
            if not f or not f.is_file():
                return self.send(404, {"error": "no such street"})
            return self.send(200, {"street": json.loads(f.read_text(encoding="utf-8")), "mtime": f.stat().st_mtime})
        if parts[0] == "streets" and len(parts) == 4 and parts[2] == "refs" and street_file(parts[1]):   # a street's photo
            f = STREETS / urllib.parse.unquote(parts[1]) / "refs" / urllib.parse.unquote(parts[3])
            if f.suffix.lower() in PHOTO and f.is_file() and ".." not in parts:
                return self.send(200, f.read_bytes(), PHOTO[f.suffix.lower()])
            return self.send(404, {"error": "no such photo"})
        if parts[:2] == ["api", "mtime"] and len(parts) == 3:
            p = self.game_path(parts[2])
            return self.send(200, {"mtime": p.stat().st_mtime if p and p.exists() else 0})
        return self.send(404, {"error": "not found"})

    def expressions_post(self, parts, query):
        import shutil
        import uuid
        if parts == ["import"]:                         # a video: solved into pending/<token>, then previewed in the desk
            src = Path((query.get("file") or ["face.mp4"])[0]).name
            if Path(src).suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}:
                return self.send(400, {"error": "a video: .mp4 .mov .mkv .webm .avi .m4v"})
            token = uuid.uuid4().hex[:12]
            d = EXPR_SAVED / "pending" / token
            d.mkdir(parents=True, exist_ok=True)
            video = d / ("source" + Path(src).suffix.lower())
            video.write_bytes(self.body())
            r = subprocess.run([sys.executable, str(ROOT / "tools" / "face_capture.py"), "solve", str(video), "--out", str(d)],
                               capture_output=True, text=True, timeout=900, cwd=str(ROOT))
            if r.returncode or not (d / "expression.json").is_file():
                shutil.rmtree(d, ignore_errors=True)
                said = [x for x in (r.stderr + r.stdout).splitlines() if x.strip() and not x.startswith(("W0000", "I0000", "INFO", "WARNING"))]
                return self.send(400, {"error": (said[-1] if said else "the capture failed")[:300]})
            e = json.loads((d / "expression.json").read_text(encoding="utf-8"))
            e["source"]["file"] = src
            (d / "expression.json").write_text(json.dumps(e, separators=(",", ":")), encoding="utf-8")
            return self.send(200, {"token": token, "expression": e})
        req = json.loads(self.body().decode("utf-8") or "{}")
        if parts == ["accept"]:                         # pending/<token> into the library under its name
            d = EXPR_SAVED / "pending" / str(req.get("token", ""))
            name = str(req.get("name", "")).strip()
            if not face_name(d.name) or not (d / "expression.json").is_file():
                return self.send(404, {"error": "nothing waiting under that token"})
            if not name:
                return self.send(400, {"error": "name it first"})
            eid = expr_id(name)
            e = json.loads((d / "expression.json").read_text(encoding="utf-8"))
            e.update(name=name, made=time.strftime("%Y-%m-%dT%H:%M:%S"), neutral=req.get("neutral", e.get("neutral", "first")), strength=float(req.get("strength", e.get("strength", 1))))
            if float(req.get("length") or 0) > 0:     # the seconds it plays in, when not as filmed
                e["length"] = round(float(req["length"]), 3)
            EXPRESSIONS.mkdir(parents=True, exist_ok=True)
            out = EXPRESSIONS / eid
            out.mkdir()
            for f in EXPR_FILES:
                if (d / f).is_file():
                    shutil.move(str(d / f), str(out / f))
            (out / "expression.json").write_text(json.dumps(e, separators=(",", ":")), encoding="utf-8")
            shutil.rmtree(d, ignore_errors=True)
            return self.send(200, {"id": eid, "name": name})
        if parts == ["discard"]:
            d = EXPR_SAVED / "pending" / str(req.get("token", ""))
            if face_name(d.name):
                shutil.rmtree(d, ignore_errors=True)
            return self.send(200, {"ok": True})
        if len(parts) == 2 and face_name(parts[0]) and (EXPRESSIONS / parts[0] / "expression.json").is_file():
            d = EXPRESSIONS / parts[0]
            if parts[1] == "set":                       # its name, neutral, strength (the folder keeps its id)
                f = d / "expression.json"
                e = json.loads(f.read_text(encoding="utf-8"))
                if str(req.get("name", "")).strip():
                    e["name"] = str(req["name"]).strip()
                for k in ("neutral", "strength", "length"):
                    if k in req:
                        e[k] = req[k]
                if e.get("loop") and "blend" in req:     # a loop's wrap
                    e["loop"] = dict(e["loop"], blend=round(max(0.0, min(5.0, float(req["blend"]))), 3))
                f.write_text(json.dumps(e, separators=(",", ":")), encoding="utf-8")
                return self.send(200, {"ok": True})
            if parts[1] == "loop":                      # a loop cut from a range of it: a card of its own (EXPRESSIONS_PLAN §2b)
                e = json.loads((d / "expression.json").read_text(encoding="utf-8"))
                n = int(e.get("frames") or 0)
                a, b = (max(0, min(n - 1, int(req.get(k, v)))) for k, v in (("from", 0), ("to", n - 1)))
                if b - a < 4:
                    return self.send(400, {"error": "a loop needs at least 5 frames"})
                name = str(req.get("name", "")).strip() or f"{e.get('name', d.name)} · loop"
                curves = e.get("curves", {})
                rest = e.get("rest") or {"first": {k: sum(v[:3]) / len(v[:3]) for k, v in curves.items() if v},   # the face at rest as the whole capture has it (face.js zeroOf; a loop's own, kept)
                                         "quiet": {k: sorted(v)[min(len(v) - 1, int(0.05 * len(v)))] for k, v in curves.items() if v}}
                of = e.get("of") or {}                  # where it came from: the capture with the clip (a loop of a loop: the first)
                out = {k: e[k] for k in ("about", "version", "fps", "source", "neutral", "strength") if k in e}
                out.update(name=name, made=time.strftime("%Y-%m-%dT%H:%M:%S"), frames=b - a + 1, secs=round((b - a + 1) / float(e.get("fps") or 30), 3),
                           curves={k: v[a:b + 1] for k, v in curves.items()}, rest=rest,
                           of={"id": of["id"], "from": of.get("from", 0) + a, "to": of.get("from", 0) + b} if of.get("id") else {"id": d.name, "from": a, "to": b},
                           loop={"blend": round(max(0.0, min(5.0, float(req.get("blend", 0.4)))), 3)})
                if e.get("length"):                     # stretched as its whole capture is
                    out["length"] = round(float(e["length"]) * (b - a + 1) / n, 3)
                eid = expr_id(name)
                (EXPRESSIONS / eid).mkdir()
                (EXPRESSIONS / eid / "expression.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
                return self.send(200, {"id": eid, "name": name})
            if parts[1] == "remove":                    # the red x: kept in Saved/Expressions/removed, out of the library
                gone = EXPR_SAVED / "removed" / f"{d.name}-{time.strftime('%Y%m%d-%H%M%S')}"
                gone.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(d), str(gone))
                return self.send(200, {"ok": True, "kept": str(gone.relative_to(ROOT))})
        return self.send(404, {"error": "not found"})

    def do_PUT(self):
        parts = self.path.strip("/").split("/")
        if parts[:3] == ["api", "kit", "preset"] and len(parts) == 4:      # the kit maker keeps (or, with null, drops) a preset
            name = parts[3]
            if not name.replace("_", "").isalnum() or not name[:1].isalpha() or name.lower() != name:
                return self.send(400, {"error": "a preset name is lower-case letters, digits and _"})
            spec = json.loads(self.body().decode("utf-8") or "null")
            data = KIT.presets_file()
            data = dict(data, presets=dict(data.get("presets", {})))
            if spec is None:
                data["presets"].pop(name, None)
            else:
                try:
                    KIT.size(spec)
                except ValueError as e:
                    return self.send(400, {"error": str(e)})
                data["presets"][name] = spec
            KIT.PRESETS_FILE.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
            return self.send(200, KIT.presets_file())
        if parts[:2] == ["api", "street"] and len(parts) == 3:       # the street builder saves a street (the one before kept)
            f = street_file(parts[2])
            if not f or not f.is_file():
                return self.send(404, {"error": "no such street"})
            body = json.loads(self.body().decode("utf-8"))
            if body.get("mtime") and abs(body["mtime"] - f.stat().st_mtime) > 0.001 and not body.get("force"):
                return self.send(409, {"error": "the street changed on disk since you opened it", "mtime": f.stat().st_mtime})
            hist = ROOT / "Saved" / "Streets" / f.parent.name / "history"
            hist.mkdir(parents=True, exist_ok=True)
            (hist / f"{time.strftime('%Y%m%d-%H%M%S')}.json").write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
            for old in sorted(hist.glob("*.json"))[:-KEEP]:
                old.unlink()
            f.write_text(json.dumps(body["street"], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            return self.send(200, {"ok": True, "mtime": f.stat().st_mtime})
        if parts[:2] != ["api", "story"] or len(parts) != 3:
            return self.send(404, {"error": "not found"})
        p = self.game_path(parts[2])
        if not p or not p.exists():
            return self.send(404, {"error": "no such game"})
        body = json.loads(self.body().decode("utf-8"))
        if body.get("mtime") and abs(body["mtime"] - p.stat().st_mtime) > 0.001 and not body.get("force"):
            return self.send(409, {"error": "the file changed on disk since you loaded it (Claude edited it?): reload, "
                                            "or save anyway to overwrite", "mtime": p.stat().st_mtime})
        hist = history_dir(urllib.parse.unquote(parts[2]))
        (hist / f"{time.strftime('%Y%m%d-%H%M%S')}.json").write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
        for old in sorted(hist.glob("*.json"))[:-KEEP]:
            old.unlink()
        p.write_text(json.dumps(body["story"], ensure_ascii=False, indent=1), encoding="utf-8")
        return self.send(200, {"ok": True, "mtime": p.stat().st_mtime})

    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n) if n else b""

    def do_POST(self):
        import urllib.parse
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        parts = self.path.split("?")[0].strip("/").split("/")
        if parts[:2] == ["api", "streetbake"] and len(parts) == 3:     # the paint page: the street in Blender (look or bake)
            name = parts[2]
            if not street_file(name):
                return self.send(404, {"error": "no such street"})
            if any(j["proc"].poll() is None for j in BAKES.values()):
                return self.send(409, {"error": "Blender is busy with a street already"})
            body = json.loads(self.body().decode("utf-8") or "{}")
            cmd = "bake" if body.get("cmd") == "bake" else "look"
            args = [sys.executable, str(ROOT / "tools" / "street.py"), cmd, name]
            if body.get("shot"):
                args += ["--shot", str(body["shot"])]
            if cmd == "bake" and body.get("godot"):
                args.append("--godot")
            if body.get("quick"):
                args += ["--samples", "16", "--height", "560"]
            out = ROOT / "Saved" / "Streets" / name / "blender"
            out.mkdir(parents=True, exist_ok=True)
            log = out / "paint_job.log"
            fh = open(log, "w", encoding="utf-8")
            BAKES[name] = {"proc": subprocess.Popen(args, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT), "log": log, "cmd": " ".join(args[2:]),
                           "started": time.time()}
            return self.send(200, bake_state(name))
        if parts[:2] == ["api", "expressions"] and len(parts) >= 3:    # the expression library: import, accept, discard, rename, remove
            return self.expressions_post(parts[2:], query)
        if parts[:2] == ["api", "street"] and len(parts) == 4 and parts[3] == "new":     # a new street (the page sends its start)
            f = street_file(parts[2])
            if not f:
                return self.send(400, {"error": "a street's name is small letters, digits and _"})
            if f.exists():
                return self.send(409, {"error": f"there's already a street called {f.parent.name}"})
            street = json.loads(self.body().decode("utf-8") or "{}").get("street") or {"format": 1, "name": f.parent.name, "roads": [], "buildings": [], "things": [], "fences": [], "shots": []}
            street["name"] = f.parent.name
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(json.dumps(street, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            return self.send(200, {"ok": True, "mtime": f.stat().st_mtime})
        if parts[:2] == ["api", "street"] and len(parts) == 5 and parts[3] == "ref":     # a photo pasted for a building's side or a shot
            f, name = street_file(parts[2]), urllib.parse.unquote(parts[4])
            if not f or not f.is_file() or not re.fullmatch(r"[A-Za-z0-9_.-]+", name) or Path(name).suffix.lower() not in PHOTO:
                return self.send(400, {"error": "a photo is <name>.png (.jpg .webp .gif .avif) for a street that's there"})
            out = f.parent / "refs" / name
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(self.body())
            return self.send(200, {"ok": True, "file": "refs/" + name, "kb": round(out.stat().st_size / 1024)})
        if parts[:2] == ["api", "take"] and len(parts) == 4 and self.game_path(parts[2]):   # a take dropped on its clip in the desk
            name = parts[3]
            if not re.fullmatch(r"[A-Za-z0-9_]+\.[A-Za-z0-9]+", name) or Path(name).suffix.lower() not in MEDIA:
                return self.send(400, {"error": "a take is <take id>.mp4 (or .mov .webm .wav .mp3 .m4a)"})
            f = FOOTAGE / parts[2] / name
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(self.body())
            return self.send(200, {"ok": True, "file": name, "kb": round(f.stat().st_size / 1024)})
        if parts[:3] in (["api", "face", "picture"], ["api", "face", "remove"]) and len(parts) == 5:
            name, fname = face_name(parts[3]), face_name(parts[4])
            if not name or not fname or Path(fname).suffix.lower() not in FACE_FILES:
                return self.send(400, {"error": "a name of letters, digits, _ - . and a picture or video"})
            f = HEADS / name / "pictures" / fname
            if parts[2] == "remove":
                f.unlink(missing_ok=True)
                return self.send(200, {"ok": True})
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(self.body())
            return self.send(200, {"ok": True, "kb": round(f.stat().st_size / 1024)})
        if parts[:2] == ["api", "face"] and len(parts) == 3 and parts[2] in ("detect", "template", "fit", "save"):
            req = json.loads(self.body().decode("utf-8") or "{}")
            req["op"] = parts[2]
            if parts[2] != "template":
                name = face_name(req.get("name", ""))
                if not name:
                    return self.send(400, {"error": "a name of letters, digits, _ - ."})
                req["name"] = name
            if parts[2] == "detect":
                d = HEADS / req["name"] / "pictures"
                req["files"] = [str(f) for f in sorted(d.iterdir()) if f.suffix.lower() in FACE_FILES] if d.exists() else []
                if not req["files"]:
                    return self.send(400, {"error": "add pictures first"})
            if parts[2] == "save":
                req["out"] = str(HEADS)
            code, res = face_call(req)
            if parts[2] == "save" and "path" in res:
                res["path"] = str(Path(res["path"]).relative_to(ROOT))
            return self.send(code, res)
        if parts[:2] == ["api", "pbrfolders"]:         # {"attach": path, "name": n} or {"detach": name}
            body = json.loads(self.body().decode("utf-8") or "{}")
            try:
                rows = PBR.detach(body["detach"]) if body.get("detach") else PBR.attach(body.get("attach"), body.get("name") or None)
                return self.send(200, {"folders": rows, "sets": len(PBR.scan(write=False))})
            except (ValueError, OSError, KeyError) as e:
                return self.send(400, {"error": str(e)})
        if parts[:3] == ["api", "pbr", "made"]:        # a street's looks as the sets they paint with (pbrmix.py: tinted, layered)
            from storykit import pbrmix as MIX  # noqa: PLC0415 - numpy and Pillow, only when a look needs them
            out = []
            for look in (json.loads(self.body().decode("utf-8")) or {}).get("looks", []):
                try:
                    ref, m = MIX.made(look)
                    out.append({"ref": ref, "meta": dict(m, base="/" + ref) if m else None})
                except (ValueError, OSError) as e:
                    out.append({"ref": None, "error": str(e)})
            return self.send(200, {"made": out})
        if parts[:2] == ["api", "pbr"] and len(parts) >= 3:     # /api/pbr/<category>/<name>: its tile, source, url, note
            import urllib.parse
            ref = "pbr/" + "/".join(urllib.parse.unquote(p) for p in parts[2:])
            try:
                return self.send(200, PBR.save(ref, json.loads(self.body().decode("utf-8"))))
            except (ValueError, OSError) as e:
                return self.send(400, {"error": str(e)})
        if parts[:3] == ["api", "library", "local"] and len(parts) == 4:   # a mesh of yours (the builder's hinge halves)
            name = parts[3]
            if not name.replace("_", "").replace("-", "").isalnum():
                return self.send(400, {"error": "a mesh name is letters, digits, - and _"})
            import base64
            body = json.loads(self.body().decode("utf-8"))
            out = LIB.MESHES / "local" / f"{name}.glb"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(base64.b64decode(body["glb"]))
            idx_file = LIB.INDEX / "local.json"
            idx = json.loads(idx_file.read_text(encoding="utf-8")) if idx_file.exists() else {}
            idx[name] = {k: body[k] for k in ("size_m", "box_m", "tris") if k in body}
            idx[name].update(kb=round(out.stat().st_size / 1024), axes="kit", note=body.get("note", ""))
            idx_file.parent.mkdir(parents=True, exist_ok=True)
            idx_file.write_text(json.dumps(idx, indent=1), encoding="utf-8")
            LIB._cache.pop("local", None)
            return self.send(200, {"ok": True, "ref": f"local/{name}"})
        if parts[:2] == ["api", "plan"] and len(parts) == 3:
            story = json.loads(self.body().decode("utf-8"))
            try:
                things, errs = L.index(story)
                pieces = P.plan(story)
            except Exception as e:  # noqa: BLE001 - a half-edited story: say why, the page keeps the last plan
                return self.send(400, {"error": f"the world doesn't plan yet: {e}"})
            th = {k: {"kind": t.kind, "use": t.use, "level": t.level, "room": t.room, "pos": t.pos, "size": t.size,
                      "yaw": t.yaw} for k, t in things.items()}
            for k, t in things.items():                    # a little thing's life and the state it starts in (lives.json)
                lf = LIFE.life_of(t.d) if t.kind == "prop" else None
                if lf:
                    th[k].update(life=lf, state=LIFE.start(t.d, lf))
            return self.send(200, {"pieces": pieces, "things": th, "made": made_looks(story)})
        if parts[:2] == ["api", "worldcheck"]:          # the scene builder: the world rules on an unsaved story
            story = json.loads(self.body().decode("utf-8"))
            try:
                import story_check as SC  # noqa: PLC0415 - tools/, on the path below
                import level_check as LC  # noqa: PLC0415
                things, errs = L.index(story)
                r = SC.Report()
                for e in errs:
                    r.err(e)
                if not errs:
                    SC.check_world(story, things, r)
                    lerrs, _ = LC.check(story, parts[2] if len(parts) == 3 else None)
                    r.errors += lerrs
            except Exception as e:  # noqa: BLE001 - a half-built world: say why
                return self.send(200, {"errors": [f"the world doesn't plan yet: {e}"], "warnings": []})
            return self.send(200, {"errors": r.errors, "warnings": r.warnings})
        if parts[:2] == ["api", "sets"] and len(parts) == 3:   # a new set: story.py new-set
            if not L.SET_NAME.match(parts[2]) or (L.SETS / parts[2]).exists():
                return self.send(400, {"error": "a new set needs a fresh name of lower-case letters, digits and _"})
            r = subprocess.run([sys.executable, str(ROOT / "tools" / "story.py"), "new-set", parts[2]], capture_output=True,
                               text=True, encoding="utf-8")
            return self.send(200 if r.returncode == 0 else 500, {"output": r.stdout + r.stderr, "sets": L.sets()})
        if parts[:2] == ["api", "new"] and len(parts) == 3:
            name = parts[2]
            if not name.replace("_", "").isalnum() or (L.GAMES / name).exists():
                return self.send(400, {"error": "a new game needs a fresh name of letters, digits and _"})
            r = subprocess.run([sys.executable, str(ROOT / "tools" / "story.py"), "new", name], capture_output=True,
                               text=True, encoding="utf-8")
            return self.send(200 if r.returncode == 0 else 500, {"output": r.stdout + r.stderr, "games": L.games()})
        if parts[:2] == ["api", "export"] and len(parts) == 4 and self.game_path(parts[2]):
            out = L.GAMES / parts[2] / "Previs"
            out.mkdir(parents=True, exist_ok=True)
            name = "".join(ch for ch in parts[3] if ch.isalnum() or ch in "_-.")
            (out / name).write_bytes(self.body())
            return self.send(200, {"ok": True, "path": str((out / name).relative_to(ROOT))})
        if parts[:2] == ["api", "character"] and len(parts) == 4 and self.game_path(parts[2]):   # the shape page's exports
            name = "".join(ch for ch in parts[3] if ch.isalnum() or ch in "_-.")
            if not name.lower().endswith((".obj", ".json")):
                return self.send(400, {"error": "only .obj and .json"})
            out = L.GAMES / parts[2] / "Characters"
            out.mkdir(parents=True, exist_ok=True)
            (out / name).write_bytes(self.body())
            return self.send(200, {"ok": True, "path": str((out / name).relative_to(ROOT))})
        if parts[:2] == ["api", "import"] and len(parts) == 3 and self.game_path(parts[2]):     # motion.py import
            r = subprocess.run([sys.executable, str(ROOT / "tools" / "motion.py"), "--game", parts[2], "import"],
                               capture_output=True, text=True, encoding="utf-8")
            return self.send(200 if r.returncode == 0 else 500, {"output": r.stdout + r.stderr})
        if parts[:2] == ["api", "preview"] and len(parts) == 3 and self.game_path(parts[2]):     # bake.js's recording
            out = L.GAMES / parts[2] / "Previs" / "preview.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            data = json.loads(self.body().decode("utf-8"))
            out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
            return self.send(200, {"ok": True, "path": str(out.relative_to(ROOT)), "kb": round(out.stat().st_size / 1024)})
        if parts[:3] == ["api", "godot", "export"] and len(parts) == 4 and self.game_path(parts[3]):   # the game as a Godot project (.zip) with its guide
            # the button writes the project and its zip, nothing more: no Godot windows (the guide's pictures are the CLI's --pictures;
            # DECISIONS 2026-10-29, the user's return: "export it as an individual godot project to manually load into godot")
            r = subprocess.run([sys.executable, str(ROOT / "tools" / "godot_export.py"), "--game", parts[3], "--zip"],
                               capture_output=True, text=True, encoding="utf-8", timeout=2400, cwd=str(ROOT))
            out = latest_export(parts[3]) or (ROOT / "Saved" / "Godot" / parts[3])   # the version this export made (Saved/Godot/<G>_v<NNN>)
            z = out.with_suffix(".zip")
            kept = []                                       # a re-export: the files changed by hand it kept (the receipt, GODOT_EXPORT §5)
            try:
                kept = json.loads((out / "game" / "export.json").read_text(encoding="utf-8")).get("kept", [])
            except (OSError, ValueError):
                kept = []
            return self.send(200 if r.returncode == 0 else 500, {"ok": r.returncode == 0, "output": (r.stdout + r.stderr)[-4000:], "dir": str(out.relative_to(ROOT)), "kept": kept,
                                                                "zip": str(z.relative_to(ROOT)) if z.exists() else None, "kb": round(z.stat().st_size / 1024) if z.exists() else 0,
                                                                "guide": f"/godot/{parts[3]}/guide/index.html" if (out / "guide" / "index.html").exists() else None})
        if parts[:2] == ["api", "storycheck"] and len(parts) == 3 and self.game_path(parts[2]):
            import tempfile  # noqa: PLC0415 - the desk's story as it is now, not saved yet: checked as this game's
            fd, tmp = tempfile.mkstemp(suffix=".json", prefix="desk_story_")
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(self.body())
                r = subprocess.run([sys.executable, str(ROOT / "tools" / "story_check.py"), "--game", parts[2], "--story", tmp],
                                   capture_output=True, text=True, encoding="utf-8", timeout=300)
            finally:
                os.unlink(tmp)
            lines = (r.stdout + r.stderr).splitlines()
            last = next((x for x in reversed(lines) if x.startswith("STORY ")), "STORY FAILED (no answer)")
            return self.send(200, {"ok": last.startswith("STORY ok"), "summary": last,
                                   "errors": [x[7:] for x in lines if x.startswith("ERROR: ")],
                                   "warnings": [x[9:] for x in lines if x.startswith("warning: ")]})
        if parts[:2] == ["api", "check"] and len(parts) == 3 and self.game_path(parts[2]):
            out = []
            for tool in ("story_check.py", "level_check.py"):
                r = subprocess.run([sys.executable, str(ROOT / "tools" / tool), "--game", parts[2]],
                                   capture_output=True, text=True, encoding="utf-8")
                out.append(r.stdout + r.stderr)
            return self.send(200, {"output": "\n".join(out)})
        return self.send(404, {"error": "not found"})


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"DIRECTOR on http://127.0.0.1:{PORT}  (games: {', '.join(L.games()) or 'none'}; Ctrl+C stops it)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
