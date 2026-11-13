"""Animator v2: the page's server (docs/ANIMATOR_V2.md §9). The characters exported from the Character Studio
(Exports/characters/<name>/<name>.glb; a scratch one's in Saved/Exports) and any .glb opened in the page, each shown
in 3D with its clips made live from the sliders by the same code the bake runs (tools/animator/core), and baked into
its own file on Bake.

    python tools/animator/serve.py [--port 8788]          then http://127.0.0.1:8788   (ANIMATOR_PORT too)

Node does the work (tools/animator/bake.mjs); this serves the page, the files and the bake's log.
"""
import json
import os
import re
import struct
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PORT = int(os.environ.get("ANIMATOR_PORT", 8788))
PAGE = HERE / "page"
CORE = HERE / "core"
VENDOR = ROOT / "tools" / "director" / "vendor"
SHARED = ROOT / "tools" / "shared"
SAVED = Path(os.environ.get("ANIMATOR_SAVED") or (ROOT / "Saved" / "Animator")).resolve()
PLACES = [Path(p).resolve() for p in (os.environ.get("ANIMATOR_PLACES") or "").split(os.pathsep) if p] or [ROOT / "Exports" / "characters", ROOT / "Saved" / "Exports" / "characters"]
OPENED = SAVED / "in"
MHR_RIG = ROOT / "Content" / "Studio" / "Bodies" / "MHR_lod1_rig.bin"
TYPES = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
         ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".svg": "image/svg+xml", ".hdr": "application/octet-stream"}
NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_\- ]{0,80}$")
JOBS = {}
LOCK = threading.Lock()


def glb_json(path):
    """a .glb's JSON chunk (its structure, no geometry read)"""
    with open(path, "rb") as f:
        head = f.read(20)
        if len(head) < 20 or head[:4] != b"glTF":
            return None
        n, kind = struct.unpack("<II", head[12:20])
        if kind != 0x4E4F534A:
            return None
        return json.loads(f.read(n))


def characters():
    """every character the page can open: {name: {file, place, size, mtime, baked, settings, clips}}"""
    out = {}
    for place in PLACES + [OPENED]:
        if not place.is_dir():
            continue
        files = sorted(place.glob("*.glb")) if place == OPENED else sorted(p / (p.name + ".glb") for p in place.iterdir() if p.is_dir())
        for f in files:
            if not f.is_file() or f.stem in out:
                continue
            st = f.stat()
            info = {"name": f.stem, "file": str(f), "where": str(f.relative_to(ROOT)) if ROOT in f.parents else str(f), "size": st.st_size, "mtime": st.st_mtime, "baked": False, "settings": None, "clips": []}
            try:
                j = glb_json(f)
                rec = ((j.get("scenes") or [{}])[j.get("scene", 0)].get("extras") or {}).get("hsMotion") if j else None
                if rec:
                    info.update(baked=bool(rec.get("clips")), settings=rec.get("settings"), clips=sorted((rec.get("clips") or {}).keys()))
                info["studio"] = bool(j and ((j.get("scenes") or [{}])[j.get("scene", 0)].get("extras") or {}).get("studio"))
            except Exception as e:                            # (a broken file is listed, and says so)
                info["error"] = str(e)
            side = f.with_suffix("").with_suffix(".motion.json") if False else f.parent / (f.stem + ".motion.json")
            if side.is_file() and not info["settings"]:      # exported again since its bake: the settings it was baked with are still beside it
                try:
                    info["last"] = json.loads(side.read_text(encoding="utf-8")).get("settings")
                except Exception:
                    pass
            out[f.stem] = info
    return out


def preview(name):
    """the character with its soft bones and no clips, made once for each version of its file: what the page shows"""
    c = characters().get(name)
    if not c:
        return None, "no such character"
    out = SAVED / "preview" / f"{name}.glb"
    stamp = out.with_suffix(".json")
    key = {"mtime": c["mtime"], "size": c["size"], "tool": max(p.stat().st_mtime for p in CORE.glob("*.js"))}
    with LOCK:
        if out.is_file() and stamp.is_file() and json.loads(stamp.read_text()) == key:
            return out, ""
        out.parent.mkdir(parents=True, exist_ok=True)
        r = subprocess.run(["node", str(HERE / "bake.mjs"), c["file"], "--out", str(out), "--preview"], capture_output=True, text=True, timeout=600)
        if "BAKE ok" not in r.stdout:
            return None, (r.stdout + r.stderr)[-1500:]
        stamp.write_text(json.dumps(key))
        return out, ""


def bake(body):
    name, c = body.get("name"), characters().get(body.get("name"))
    if not c:
        return {"error": "no such character"}
    SAVED.mkdir(parents=True, exist_ok=True)
    sf = SAVED / f"settings_{name}.json"
    sf.write_text(json.dumps(body.get("settings") or {}), encoding="utf-8")
    jid = f"{int(time.time() * 1000)}"
    job = {"id": jid, "name": name, "state": "running", "log": [], "started": time.time()}
    JOBS[jid] = job

    def run():
        try:
            p = subprocess.Popen(["node", str(HERE / "bake.mjs"), c["file"], "--settings", str(sf)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
            for line in p.stdout:
                job["log"].append(line.rstrip("\n"))
            p.wait()
            job["state"] = "ok" if p.returncode == 0 and any("BAKE ok" in l for l in job["log"]) else "failed"
        except Exception as e:
            job["log"].append(str(e))
            job["state"] = "failed"
        job["secs"] = round(time.time() - job["started"], 1)

    threading.Thread(target=run, daemon=True).start()
    return {"job": jid}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def file(self, path, cache=False):
        path = Path(path)
        if not path.is_file():
            return self.send(404, {"error": "not found"})
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(path.suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=3600" if cache else "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path, _, qs = self.path.partition("?")
        parts = [p for p in path.split("/") if p]
        if any(p.startswith(".") or "\\" in p for p in parts):
            return self.send(400, {"error": "bad path"})
        if not parts:
            return self.file(PAGE / "index.html")
        a = parts[0]
        if a == "page":
            return self.file(PAGE.joinpath(*parts[1:]))
        if a == "core":
            return self.file(CORE.joinpath(*parts[1:]))
        if a == "vendor":
            return self.file(VENDOR.joinpath(*parts[1:]), cache=True)
        if a == "shared":
            return self.file(SHARED.joinpath(*parts[1:]))
        if a == "api":
            what = parts[1] if len(parts) > 1 else ""
            name = parts[2].replace("%20", " ") if len(parts) > 2 else ""
            if what == "characters":
                return self.send(200, {"characters": list(characters().values()), "places": [str(p.relative_to(ROOT)) if ROOT in p.parents else str(p) for p in PLACES]})
            if what == "preview" and name:
                f, err = preview(name)
                return self.file(f) if f else self.send(500, {"error": err})
            if what == "mhr_rig":
                return self.file(MHR_RIG, cache=True)
            if what == "job" and name in JOBS:
                j = JOBS[name]
                since = int((re.search(r"from=(\d+)", qs) or [0, 0])[1])
                return self.send(200, {"state": j["state"], "name": j["name"], "secs": j.get("secs"), "log": j["log"][since:], "lines": len(j["log"])})
        return self.send(404, {"error": "not found"})

    def do_POST(self):
        path, _, qs = self.path.partition("?")
        parts = [p for p in path.split("/") if p]
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        if parts[:2] == ["api", "bake"]:
            try:
                return self.send(200, bake(json.loads(raw or b"{}")))
            except Exception as e:
                return self.send(400, {"error": str(e)})
        if parts[:2] == ["api", "open"]:                      # a .glb from the person's own disk, kept in Saved/Animator/in
            name = (re.search(r"name=([^&]+)", qs) or [0, ""])[1].replace("%20", " ")
            name = re.sub(r"\.glb$", "", name, flags=re.I)
            if not NAME.match(name) or raw[:4] != b"glTF":
                return self.send(400, {"error": "a .glb file, its name letters, digits, _ and -"})
            OPENED.mkdir(parents=True, exist_ok=True)
            (OPENED / f"{name}.glb").write_bytes(raw)
            return self.send(200, {"name": name})
        return self.send(404, {"error": "not found"})


def main():
    global PORT
    if "--port" in sys.argv:
        PORT = int(sys.argv[sys.argv.index("--port") + 1])
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        sys.exit(f"port {PORT} is taken ({e}): another Animator is running, or pass --port")
    print(f"Animator v2 on http://127.0.0.1:{PORT} (Ctrl+C stops it)", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
