#!/usr/bin/env python3
"""The Character Studio (tools/character/index.html): MHR's whole body from a base (average, feminine, masculine) and
its 45 identity sliders, with a face from up to two pictures (front, side) bent onto its head by tools/face_mesh.py,
or none, and its 72 FACS expressions. Exports the body and the head alone (for Mesh to MetaHuman) as OBJ. Each character keeps its pictures and
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

PORT = int(os.environ.get("BODY_PORT", 8793))
PEOPLE = ROOT / "Content" / "Studio" / "People"
BODIES = ROOT / "Content" / "Studio" / "Bodies"
DESIGNS = ROOT / "Content" / "Studio" / "Clothes" / "designs"
VENDOR = ROOT / "tools" / "director" / "vendor"     # three.js, shared with the desk
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
         ".bin": "application/octet-stream", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".webp": "image/webp"}
PICTURES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SLOTS = ("front", "side")
EXPORTS = (".obj", ".json")
WORKER = face_mesh.Worker(ROOT / "Saved" / "body_editor_worker.log")


def clean(n):
    """a character's or a file's name: letters, digits, _ - . and no leading dot"""
    n = urllib.parse.unquote(n or "")
    return n if n and not n.startswith(".") and all(ch.isalnum() or ch in "_-." for ch in n) else None


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

    def do_GET(self):
        parts = [p for p in urllib.parse.urlparse(self.path).path.split("/") if p]
        if not parts:
            parts = ["index.html"]
        if ".." in parts:
            return self.send(400, {"error": "no"})
        if parts[0] == "vendor" and len(parts) == 2 and (VENDOR / parts[1]).is_file():
            return self.send(200, (VENDOR / parts[1]).read_bytes(), TYPES.get(Path(parts[1]).suffix, "text/plain"))
        if parts[0] == "bodies" and len(parts) == 2 and Path(parts[1]).suffix in (".bin", ".json"):
            f = BODIES / parts[1]
            return self.send(200, f.read_bytes(), TYPES[f.suffix]) if f.is_file() else self.send(404, {"error": "no body"})
        if parts[:2] == ["api", "people"] and len(parts) == 2:
            out = []
            for d in sorted(PEOPLE.iterdir()) if PEOPLE.exists() else []:
                if d.is_dir() and clean(d.name): out.append({"name": d.name, "pictures": sorted(pictures(d.name))})
            return self.send(200, {"people": out})
        if parts[:2] == ["api", "people"] and len(parts) == 3 and clean(parts[2]):
            f = PEOPLE / clean(parts[2]) / "character.json"
            return self.send(200, json.loads(f.read_text(encoding="utf-8")) if f.exists() else {})
        if parts[:2] == ["api", "designs"]:                                         # the garment designs
            return self.send(200, {"designs": sorted(f.stem for f in DESIGNS.glob("*.yaml"))})
        if parts[:2] == ["api", "clothes"] and len(parts) == 4 and clean(parts[2]) and clean(parts[3]):   # a draped garment
            f = PEOPLE / clean(parts[2]) / "clothes" / clean(parts[3]) / "garment.obj"
            return self.send(200, f.read_bytes(), "text/plain") if f.exists() else self.send(404, {"error": "not made yet"})
        if parts[:2] == ["api", "skin"] and len(parts) == 3 and clean(parts[2]):        # the photo skin texture
            f = PEOPLE / clean(parts[2]) / "skin.png"
            return self.send(200, f.read_bytes(), "image/png") if f.exists() else self.send(404, {"error": "no skin yet"})
        if parts[:2] == ["api", "picture"] and len(parts) == 4 and clean(parts[2]) and parts[3] in SLOTS:
            f = pictures(clean(parts[2])).get(parts[3])
            return self.send(200, f.read_bytes(), TYPES.get(f.suffix.lower(), "image/jpeg")) if f else self.send(404, {"error": "none"})
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
                                "--height", str(float(q.get("height", 1.7))), "--weights", json.dumps(q.get("weights", []))],
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
