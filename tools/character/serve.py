#!/usr/bin/env python3
"""The Character Studio (tools/character/index.html): MHR's whole body from a base (average, feminine, masculine) and
its 45 identity sliders, with a face from up to two pictures (front, side) bent onto its head by tools/face_mesh.py,
or none, and its 72 FACS expressions; the hair from the salon (salon.html); everything that needs MediaPipe in face_mesh.py's
environment. Exports the body and the head alone (for Mesh to MetaHuman) as OBJ. Each character keeps its pictures and
settings in Content/Studio/People/<name>/ (git-ignored: real people's faces).

    python tools/character/serve.py            then open http://127.0.0.1:8793

Plain Python, no installs (the face fit runs in face_mesh.py's environment: python tools/face_mesh.py setup).
Listens on 127.0.0.1 only.
"""
import json
import os
import subprocess
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import face_mesh  # noqa: E402 - the worker's client (no numpy at import)
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import pbr as PBR  # noqa: E402 - the PBR shelf (Content/Studio/PBR), for the Layers tab's PBR fills

PORT = int(os.environ.get("BODY_PORT", 8793))
PEOPLE = ROOT / "Content" / "Studio" / "People"
BODIES = ROOT / "Content" / "Studio" / "Bodies"
DESIGNS = ROOT / "Content" / "Studio" / "Clothes" / "designs"
VENDOR = ROOT / "tools" / "director" / "vendor"     # three.js, shared with the desk
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
         ".bin": "application/octet-stream", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".webp": "image/webp", ".glb": "model/gltf-binary"}
PICTURES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SLOTS = ("front", "side")
EXPORTS = (".obj", ".json")
WORKER = face_mesh.Worker(ROOT / "Saved" / "body_editor_worker.log")


def clean(n):
    """a character's or a file's name: letters, digits, _ - . and no leading dot"""
    n = urllib.parse.unquote(n or "")
    return n if n and not n.startswith(".") and all(ch.isalnum() or ch in "_-." for ch in n) else None


HAIR = ROOT / "Content" / "Studio" / "Hair"                     # hairstyles to start from (the salon's Save as a hairstyle)
SALON_FILES = {"salon.json", "salon_bake.json", "salon.glb", "salon_base.glb"}   # the salon's hair: People/<name>/salon/ or Hair/<style>/
HAIR_FILES = SALON_FILES
REFS = HAIR / "References"                                       # the salon's locked references (tools/gshair.py reference)
REF_RUNS = {}


def ref_status(name):
    d = REFS / name; p = REF_RUNS.get(name)
    running = p is not None and p.poll() is None
    if p is not None and not running: REF_RUNS.pop(name, None)
    log = (d / "run.log").read_text(encoding="utf-8", errors="replace")[-3000:] if (d / "run.log").exists() else ""
    return dict(running=running, exit=None if running or p is None else p.returncode, ready=(d / "reference.json").exists(), log=log)


def body_bytes():
    """body.bin's size: MHR's points (Bodies/MHR_lod1.bin's header), float32 xyz"""
    with open(BODIES / "MHR_lod1.bin", "rb") as f:
        n = int.from_bytes(f.read(4), "little")
        return json.loads(f.read(n))["points"] * 12


def pictures(name):
    """{slot: path} of a character's pictures"""
    d = PEOPLE / name / "pictures"
    out = {}
    for slot in SLOTS:
        for f in sorted(d.glob(slot + ".*")) if d.exists() else []:
            if f.suffix.lower() in PICTURES: out[slot] = f
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body)).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith(("text/", "application/json")) else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n) if n else b""

    def keep(self, d, fname):
        """a posted file written to d/fname, if it is what its name says"""
        data = self.body()
        if fname.endswith(".json"):
            try: json.loads(data.decode("utf-8"))
            except ValueError: return self.send(400, {"error": "not JSON"})
        elif fname.endswith(".png") and not data.startswith(b"\x89PNG\r\n\x1a\n"):
            return self.send(400, {"error": "a PNG"})
        elif fname.endswith(".glb") and not data.startswith(b"glTF"):
            return self.send(400, {"error": "a binary glTF"})
        elif fname == "body.bin" and len(data) != body_bytes():
            return self.send(400, {"error": f"a body is {body_bytes()} bytes"})
        d.mkdir(parents=True, exist_ok=True)
        (d / fname).write_bytes(data)
        return self.send(200, {"ok": True, "path": str((d / fname).relative_to(ROOT))})

    def do_GET(self):
        parts = [p for p in urllib.parse.urlparse(self.path).path.split("/") if p]
        if not parts:
            parts = ["index.html"]
        if ".." in parts:
            return self.send(400, {"error": "no"})
        if parts[0] == "vendor" and len(parts) == 2 and (VENDOR / parts[1]).is_file():
            return self.send(200, (VENDOR / parts[1]).read_bytes(), TYPES.get(Path(parts[1]).suffix, "text/plain"))
        if parts[0] in ("shared", "env") and len(parts) == 2:                       # tools/shared (components any page can import) and Content/Studio/Env (HDRs)
            f = (ROOT / "tools" / "shared" if parts[0] == "shared" else ROOT / "Content" / "Studio" / "Env") / parts[1]
            if f.is_file():
                return self.send(200, f.read_bytes(), "text/javascript" if f.suffix == ".js" else "application/octet-stream")
        if parts[0] == "bodies" and len(parts) == 2 and Path(parts[1]).suffix in (".bin", ".json"):
            f = BODIES / parts[1]
            return self.send(200, f.read_bytes(), TYPES[f.suffix]) if f.is_file() else self.send(404, {"error": "no body"})
        if parts[:2] == ["api", "people"] and len(parts) == 2:
            out = []
            for d in sorted(PEOPLE.iterdir()) if PEOPLE.exists() else []:
                if d.is_dir() and clean(d.name): out.append({"name": d.name, "pictures": sorted(pictures(d.name)), "body": (d / "body.bin").exists(),
                                                             "hair": (d / "salon" / "salon.json").exists(), "baked": (d / "salon" / "salon.glb").exists()})
            return self.send(200, {"people": out})
        if parts[:2] == ["api", "people"] and len(parts) == 3 and clean(parts[2]):
            f = PEOPLE / clean(parts[2]) / "character.json"
            return self.send(200, json.loads(f.read_text(encoding="utf-8")) if f.exists() else {})
        if parts[:2] == ["api", "people"] and len(parts) == 4 and clean(parts[2]) and parts[3] == "body.bin":   # the body as the studio shows it
            f = PEOPLE / clean(parts[2]) / "body.bin"
            return self.send(200, f.read_bytes(), TYPES[".bin"]) if f.exists() else self.send(404, {"error": "not saved from the Character Studio yet"})
        if parts[:2] == ["api", "people"] and len(parts) == 5 and clean(parts[2]) and parts[3] == "salon" and parts[4] in SALON_FILES:
            f = PEOPLE / clean(parts[2]) / "salon" / parts[4]                    # the character's hair from the salon
            return self.send(200, f.read_bytes(), TYPES[f.suffix]) if f.exists() else self.send(404, {"error": "no salon hair yet"})
        if parts[:2] == ["api", "outfits"]:                                         # garments made in order, each over the last
            f = DESIGNS.parent / "outfits.json"
            return self.send(200, json.loads(f.read_text(encoding="utf-8")) if f.exists() else {"outfits": {}})
        if parts[:2] == ["api", "designs"]:                                         # the garment designs
            return self.send(200, {"designs": sorted(f.stem for f in DESIGNS.glob("*.yaml"))})
        if parts[:2] == ["api", "clothes"] and len(parts) == 4 and clean(parts[2]) and clean(parts[3]):   # a draped garment
            f = PEOPLE / clean(parts[2]) / "clothes" / clean(parts[3]) / "garment.obj"
            return self.send(200, f.read_bytes(), "text/plain") if f.exists() else self.send(404, {"error": "not made yet"})
        if parts[:2] == ["api", "pbr"]:                    # the shelf's sets, for a PBR fill: {ref: {maps: {albedo: file...}}}
            return self.send(200, {"sets": {r: {"maps": m["maps"], "tile_m": m.get("tile_m", 2.0)} for r, m in PBR.scan(write=False).items()}})
        if parts[0] == "pbrfile" and len(parts) >= 3 and ".." not in parts:        # /pbrfile/<category>/<name>/<file>
            f = PBR.ROOT.joinpath(*parts[1:])
            return self.send(200, f.read_bytes(), TYPES.get(f.suffix.lower(), "image/jpeg")) if f.is_file() and f.suffix.lower() in PBR.WEB else self.send(404, {"error": "no such map"})
        if parts[:2] == ["api", "layers"] and len(parts) == 3 and clean(parts[2]):      # the paint layers (layers.js), saved as one JSON
            f = PEOPLE / clean(parts[2]) / "layers.json"
            return self.send(200, f.read_bytes(), "application/json") if f.exists() else self.send(200, {"layers": []})
        if parts[:2] == ["api", "skin"] and len(parts) == 3 and clean(parts[2]):        # the photo skin texture (?mask: its coverage;
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)           # ?paint, ?touch: the touch-up's layers)
            f = PEOPLE / clean(parts[2]) / next((n for k, n in (("mask", "skin_mask.png"), ("paint", "skin_paint.png"), ("touch", "skin_touch.png"), ("pigment", "skin_pigment.png"))
                                                 if k in q), "skin.png")
            return self.send(200, f.read_bytes(), "image/png") if f.exists() else self.send(404, {"error": "no skin yet"})
        if parts[:2] == ["api", "picture"] and len(parts) == 4 and clean(parts[2]) and parts[3] in SLOTS:
            f = pictures(clean(parts[2])).get(parts[3])
            return self.send(200, f.read_bytes(), TYPES.get(f.suffix.lower(), "image/jpeg")) if f else self.send(404, {"error": "none"})
        if parts[:2] == ["api", "salon"] and len(parts) == 2:                             # the salon's hair (salon.json)
            out = [d.name for d in sorted(HAIR.iterdir()) if d.is_dir() and clean(d.name) and (d / "salon.json").exists()] if HAIR.exists() else []
            return self.send(200, {"hair": out})
        if parts[:2] == ["api", "refs"] and len(parts) == 2:                              # the salon's references
            out = []
            for d in sorted(REFS.iterdir()) if REFS.exists() else []:
                if d.is_dir() and clean(d.name) and (d / "reference.json").exists():
                    r = json.loads((d / "reference.json").read_text(encoding="utf-8"))
                    out.append({"name": d.name, "kind": r.get("kind"), "frames": len(r.get("frames", [])), "sweep": r.get("sweep")})
            return self.send(200, {"refs": out})
        if parts[:2] == ["api", "refs"] and len(parts) >= 4 and clean(parts[2]):
            if parts[3] == "status" and len(parts) == 4: return self.send(200, ref_status(clean(parts[2])))
            if (len(parts) == 4 and parts[3] == "reference.json") or (len(parts) == 5 and parts[3] in ("frames", "keyed") and Path(parts[4]).suffix in (".webp", ".jpg", ".png")):
                f = REFS.joinpath(clean(parts[2]), *parts[3:])
                return self.send(200, f.read_bytes(), TYPES.get(f.suffix, "application/octet-stream")) if f.is_file() else self.send(404, {"error": f"no {'/'.join(parts[3:])}"})
        if parts[:2] == ["api", "hair"] and len(parts) == 4 and clean(parts[2]) and parts[3] in HAIR_FILES:
            f = HAIR / clean(parts[2]) / parts[3]
            return self.send(200, f.read_bytes(), TYPES.get(f.suffix, "application/octet-stream")) if f.exists() else self.send(404, {"error": f"no {parts[3]} for {parts[2]}"})
        f = HERE.joinpath(*parts)
        if f.is_file() and f.suffix in TYPES and f.suffix != ".py":
            return self.send(200, f.read_bytes(), TYPES[f.suffix])
        return self.send(404, {"error": "not found"})

    def do_POST(self):
        parts = [p for p in urllib.parse.urlparse(self.path).path.split("/") if p]
        name = clean(parts[2]) if len(parts) >= 3 else None
        if parts[:2] == ["api", "people"] and len(parts) == 3 and name:          # the character's settings
            d = PEOPLE / name
            d.mkdir(parents=True, exist_ok=True)
            data = json.loads(self.body().decode("utf-8"))
            (d / "character.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
            return self.send(200, {"ok": True, "path": str((d / "character.json").relative_to(ROOT))})
        if parts[:2] == ["api", "picture"] and len(parts) == 5 and name and parts[3] in SLOTS:   # /api/picture/<name>/<slot>/<ext>
            ext = "." + parts[4].lower().lstrip(".")
            if ext not in PICTURES:
                return self.send(400, {"error": "a picture: jpg, png, webp or bmp"})
            d = PEOPLE / name / "pictures"
            d.mkdir(parents=True, exist_ok=True)
            for old in d.glob(parts[3] + ".*"):
                old.unlink()
            data = self.body()
            if data:                                                           # an empty body clears the slot
                (d / (parts[3] + ext)).write_bytes(data)
            return self.send(200, {"ok": True})
        if parts[:2] == ["api", "skin"] and len(parts) == 4 and name and parts[3] in ("paint", "touch", "pigment"):   # the touch-up's layers
            data = self.body()
            if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                return self.send(400, {"error": "a PNG"})
            (PEOPLE / name).mkdir(parents=True, exist_ok=True)
            (PEOPLE / name / f"skin_{parts[3]}.png").write_bytes(data)
            return self.send(200, {"ok": True})
        if parts[:2] == ["api", "layers"] and len(parts) == 3 and name:
            (PEOPLE / name).mkdir(parents=True, exist_ok=True)
            (PEOPLE / name / "layers.json").write_bytes(self.body())
            return self.send(200, {"ok": True})
        if parts[:2] == ["api", "export"] and len(parts) == 4 and name and clean(parts[3]) and \
                Path(parts[3]).suffix in EXPORTS:
            f = PEOPLE / name / clean(parts[3])
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(self.body())
            return self.send(200, {"ok": True, "path": str(f.relative_to(ROOT))})
        if parts[:2] == ["api", "clothes"] and len(parts) == 3 and name:          # make and drape a garment on this body
            q = json.loads(self.body().decode("utf-8") or "{}")
            design = clean(q.get("design"))
            if not design or not (DESIGNS / f"{design}.yaml").exists():
                return self.send(400, {"error": "pick a design"})
            py = ROOT / "vendor" / "garmentcode" / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            if not py.exists():
                return self.send(400, {"error": "GarmentCode isn't set up: python tools/garment.py setup"})
            out = PEOPLE / name / "clothes" / design
            r = subprocess.run([str(py), str(HERE / "clothes.py"), "--out", str(out), "--design", design,
                                "--height", str(float(q.get("height", 1.7))), "--weights", json.dumps(q.get("weights", [])),
                                "--locks", str(q.get("locks", "auto")),
                                "--under", ",".join(str(PEOPLE / name / "clothes" / u / "garment.obj") for u in q.get("under", [])
                                                    if clean(u) and (PEOPLE / name / "clothes" / u / "garment.obj").exists())],
                               capture_output=True, text=True, encoding="utf-8")
            line = next((l for l in r.stdout.splitlines() if l.startswith("{")), None)
            if r.returncode or not line:
                return self.send(500, {"error": "the garment failed: " + (r.stderr or r.stdout)[-600:]})
            res = json.loads(line)
            return self.send(200, {"design": design, "drape": res["drape"], "measures_cm": res["measures_cm"]})
        if parts[:2] == ["api", "face"] and len(parts) == 3 and parts[2] in ("mhr", "landmarks", "detect", "body", "skin"):
            req = json.loads(self.body().decode("utf-8") or "{}")
            req["op"] = parts[2]
            if parts[2] not in ("mhr", "landmarks"):
                n = clean(req.get("name"))
                if not n:
                    return self.send(400, {"error": "pick or make a character first"})
                req["name"] = n
            if parts[2] == "detect":                                       # none: the worker forgets the old ones
                req["files"] = [str(f) for f in pictures(req["name"]).values()]
            if parts[2] == "skin":
                req["out"] = str(PEOPLE / req["name"] / "skin.png")
                code, res = WORKER.call(req)
                if "path" in res: res["path"] = str(Path(res["path"]).relative_to(ROOT))
                return self.send(code, res)
            return self.send(*WORKER.call(req))
        if parts[:2] == ["api", "hair"] and len(parts) == 4 and name and parts[3] in HAIR_FILES:   # a hairstyle saved by the salon
            return self.keep(HAIR / name, parts[3])
        if parts[:2] == ["api", "people"] and len(parts) == 4 and name and parts[3] == "body.bin":   # the body, with its face, no expression
            return self.keep(PEOPLE / name, "body.bin")
        if parts[:2] == ["api", "people"] and len(parts) == 5 and name and parts[3] == "salon" and parts[4] in SALON_FILES:
            if not (PEOPLE / name).is_dir(): return self.send(404, {"error": f"no character {name}"})
            return self.keep(PEOPLE / name / "salon", parts[4])                  # the character's hair from the salon
        if parts[:2] == ["api", "refs"] and len(parts) == 4 and name and parts[3] == "run":   # a video (or photos) to a salon reference
            q = json.loads(self.body().decode("utf-8") or "{}")
            if ref_status(name)["running"]: return self.send(409, {"error": "already running"})
            d = REFS / name; d.mkdir(parents=True, exist_ok=True)
            tool = [sys.executable, str(ROOT / "tools" / "gshair.py")]
            photos = [x for x in q.get("photos", []) if x]
            if photos:
                if not all(Path(x).exists() for x in photos): return self.send(400, {"error": "pictures on this machine: front, side, back"})
                cmd = tool + ["reference", "--name", name, "--photos", *photos, "--side-face", str(q.get("side_face", "left"))]
            else:
                src = q.get("source", "")
                if not src or not Path(src).exists(): return self.send(400, {"error": "a video on this machine"})
                cmd = tool + ["run", src, "--to", "reference", "--ref", name, "--orbit",
                              "--sweep", str(float(q.get("sweep", 360))), "--front", str(int(q.get("front", 0))),
                              "--key", str(q.get("key", "green")), "--count", str(int(q.get("count", 90)))]
            log = open(d / "run.log", "w", encoding="utf-8")
            REF_RUNS[name] = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
            return self.send(200, {"started": True})
        return self.send(404, {"error": "not found"})


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"CHARACTER STUDIO on http://127.0.0.1:{PORT}  (Ctrl+C stops it)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
