#!/usr/bin/env python3
"""The director's desk: a local page for plotting a game with Claude (the flow, scenes and their clips, stitches,
endings, notes to each other, an animatic of any path). It reads and writes the same Content/Games/<Game>/story.json
Claude edits, so both see each other's changes; every save keeps the previous file in Saved/Story/<Game>/history/.

    python tools/director/serve.py            then open http://127.0.0.1:8780

Plain Python, no installs. Listens on 127.0.0.1 only.
"""
import json
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402
from storykit import plan as P  # noqa: E402
from storykit import library as LIB  # noqa: E402

STATIC = {".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".txt": "text/plain"}
BODY = {".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".fbx": "application/octet-stream",
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
BODIES = L.STUDIO / "Bodies"
FOOTAGE = L.ROOT / "Footage"          # the takes, as intake.py copies them (Footage/<Game>/<take id>.mp4)
MEDIA = {".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4"}

PORT = 8780
KEEP = 50


def history_dir(game):
    d = ROOT / "Saved" / "Story" / game / "history"
    d.mkdir(parents=True, exist_ok=True)
    return d


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body)).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
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
        if not name or "/" in name or "\\" in name or name.startswith("."):
            return None
        return L.GAMES / name / "story.json"

    def do_GET(self):
        parts = self.path.split("?")[0].strip("/").split("/")
        if parts == [""]:
            parts = ["index.html"]
        f = HERE.joinpath(*parts) if parts and ".." not in parts else None
        if f and f.suffix in STATIC and f.is_file() and HERE in f.resolve().parents:
            return self.send(200, f.read_bytes(), STATIC[f.suffix])
        if parts[:2] == ["api", "bodies"]:
            files = sorted(f.name for f in BODIES.glob("*") if f.suffix.lower() in (".glb", ".gltf", ".fbx")) if BODIES.exists() else []
            return self.send(200, {"bodies": files})
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
            return self.send(200, {"meshes": meshes, "textures": tex})
        if parts[0] == "library" and len(parts) >= 3 and ".." not in parts:
            lf = LIB.LIB.joinpath(*parts[1:])
            if lf.is_file() and lf.suffix.lower() in BODY and LIB.LIB.resolve() in lf.resolve().parents:
                return self.send(200, lf.read_bytes(), BODY[lf.suffix.lower()])
            return self.send(404, {"error": "not in the library"})
        if parts[:2] == ["api", "soma"]:             # Kimodo's 77-joint skeleton, for retargeting its motions
            return self.send(200, (L.STUDIO / "soma77.json").read_bytes())
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
        if parts[:2] == ["api", "games"]:
            return self.send(200, {"games": L.games()})
        if parts[:2] == ["api", "story"] and len(parts) == 3:
            p = self.game_path(parts[2])
            if not p or not p.exists():
                return self.send(404, {"error": "no such game"})
            return self.send(200, {"story": json.loads(p.read_text(encoding="utf-8")), "mtime": p.stat().st_mtime})
        if parts[:2] == ["api", "mtime"] and len(parts) == 3:
            p = self.game_path(parts[2])
            return self.send(200, {"mtime": p.stat().st_mtime if p and p.exists() else 0})
        return self.send(404, {"error": "not found"})

    def do_PUT(self):
        parts = self.path.strip("/").split("/")
        if parts[:2] != ["api", "story"] or len(parts) != 3:
            return self.send(404, {"error": "not found"})
        p = self.game_path(parts[2])
        if not p or not p.exists():
            return self.send(404, {"error": "no such game"})
        body = json.loads(self.body().decode("utf-8"))
        if body.get("mtime") and abs(body["mtime"] - p.stat().st_mtime) > 0.001 and not body.get("force"):
            return self.send(409, {"error": "the file changed on disk since you loaded it (Claude edited it?): reload, "
                                            "or save anyway to overwrite", "mtime": p.stat().st_mtime})
        hist = history_dir(parts[2])
        (hist / f"{time.strftime('%Y%m%d-%H%M%S')}.json").write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
        for old in sorted(hist.glob("*.json"))[:-KEEP]:
            old.unlink()
        p.write_text(json.dumps(body["story"], ensure_ascii=False, indent=1), encoding="utf-8")
        return self.send(200, {"ok": True, "mtime": p.stat().st_mtime})

    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n) if n else b""

    def do_POST(self):
        parts = self.path.strip("/").split("/")
        if parts[:2] == ["api", "plan"] and len(parts) == 3:
            story = json.loads(self.body().decode("utf-8"))
            try:
                things, errs = L.index(story)
                pieces = P.plan(story)
            except Exception as e:  # noqa: BLE001 - a half-edited story: say why, the page keeps the last plan
                return self.send(400, {"error": f"the world doesn't plan yet: {e}"})
            th = {k: {"kind": t.kind, "use": t.use, "level": t.level, "room": t.room, "pos": t.pos, "size": t.size,
                      "yaw": t.yaw} for k, t in things.items()}
            return self.send(200, {"pieces": pieces, "things": th})
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
