#!/usr/bin/env python3
"""The score room: a local page for writing a game's music cues with Claude (horror piano and strings, K-drama
comedy and romance, the romance-horror cues between), making variations and keeping the favourites in a palette
the director's desk will read (docs/MUSIC.md).

    python tools/score/serve.py            then open http://127.0.0.1:8791

The palettes: Content/Studio/Music/palette.json (the studio's, any game may use it) and
Content/Games/<Game>/Music/palette.json (a game's own); renders (WAV, MIDI) go to that folder's renders/.
Every palette save keeps the previous file in Saved/Score/<scope>/history/. Plain Python, no installs. Listens on
127.0.0.1 only.
"""
import json
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STUDIO_MUSIC = ROOT / "Content" / "Studio" / "Music"
SAMPLES = STUDIO_MUSIC / "samples"
GAMES = ROOT / "Content" / "Games"

TYPES = {".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".md": "text/plain", ".css": "text/css",
         ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".flac": "audio/flac", ".mid": "audio/midi"}
PORT = 8791
KEEP = 30
SAFE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_. -]{0,120}$")


def empty_palette(scope):
    return {"format": "horrorstudio-score-palette", "version": 1, "scope": scope, "favourites": [], "sequences": [], "scenes": []}


def music_dir(scope):
    """studio -> Content/Studio/Music; a game's name -> Content/Games/<Game>/Music (the game must exist)."""
    if scope == "studio":
        return STUDIO_MUSIC
    if not SAFE.match(scope or "") or not (GAMES / scope).is_dir():
        return None
    return GAMES / scope / "Music"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith(("text", "application/json")) else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def file(self, path, cache=False):
        if not path.is_file():
            return self.send(404, {"error": "not found"})
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(path.suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=86400" if cache else "no-store")
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def do_GET(self):
        parts = [p for p in self.path.split("?")[0].split("/") if p]
        if not parts:
            return self.file(HERE / "index.html")
        if any(p.startswith(".") or "\\" in p for p in parts):
            return self.send(400, {"error": "bad path"})
        if parts[0] == "samples":
            return self.file(SAMPLES.joinpath(*parts[1:]), cache=True)
        if parts[0] == "js" and len(parts) == 2:
            return self.file(HERE / "js" / parts[1])
        if parts == ["index.html"] or parts == ["score.css"]:
            return self.file(HERE / parts[0])
        if parts == ["api", "games"]:
            games = sorted(p.name for p in GAMES.iterdir() if (p / "story.json").is_file()) if GAMES.is_dir() else []
            return self.send(200, {"games": games})
        if len(parts) == 3 and parts[:2] == ["api", "palette"]:
            d = music_dir(parts[2])
            if d is None:
                return self.send(404, {"error": "no such game"})
            f = d / "palette.json"
            return self.send(200, json.loads(f.read_text("utf-8")) if f.is_file() else empty_palette(parts[2]))
        if len(parts) == 3 and parts[:2] == ["api", "renders"]:
            d = music_dir(parts[2])
            files = sorted(p.name for p in (d / "renders").iterdir()) if d and (d / "renders").is_dir() else []
            return self.send(200, {"renders": files})
        return self.send(404, {"error": "not found"})

    def do_PUT(self):
        parts = [p for p in self.path.split("?")[0].split("/") if p]
        if len(parts) == 3 and parts[:2] == ["api", "palette"]:
            d = music_dir(parts[2])
            if d is None:
                return self.send(404, {"error": "no such game"})
            try:
                pal = json.loads(self.body().decode("utf-8"))
            except ValueError as e:
                return self.send(400, {"error": "not JSON: %s" % e})
            if pal.get("format") != "horrorstudio-score-palette" or not isinstance(pal.get("favourites"), list):
                return self.send(400, {"error": "not a score palette"})
            d.mkdir(parents=True, exist_ok=True)
            f = d / "palette.json"
            if f.is_file():
                hist = ROOT / "Saved" / "Score" / parts[2] / "history"
                hist.mkdir(parents=True, exist_ok=True)
                (hist / time.strftime("palette-%Y%m%d-%H%M%S.json")).write_bytes(f.read_bytes())
                for old in sorted(hist.glob("palette-*.json"))[:-KEEP]:
                    old.unlink()
            pal["saved"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            f.write_text(json.dumps(pal, indent=1, ensure_ascii=False) + "\n", "utf-8")
            return self.send(200, {"ok": True, "path": str(f.relative_to(ROOT)), "favourites": len(pal["favourites"])})
        # a render baked for the game: PUT /api/render/<scope>/<name>.wav|.mid
        if len(parts) == 4 and parts[:2] == ["api", "render"]:
            d = music_dir(parts[2])
            name = parts[3]
            if d is None or not SAFE.match(name) or Path(name).suffix.lower() not in (".wav", ".mid"):
                return self.send(400, {"error": "bad render name"})
            out = d / "renders"
            out.mkdir(parents=True, exist_ok=True)
            (out / name).write_bytes(self.body())
            return self.send(200, {"ok": True, "path": str((out / name).relative_to(ROOT))})
        return self.send(404, {"error": "not found"})


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("The score room: http://127.0.0.1:%d" % PORT)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
