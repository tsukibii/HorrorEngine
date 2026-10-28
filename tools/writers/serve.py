#!/usr/bin/env python3
"""The writers' room: a local page where you write a game's story as a flowchart before the director (docs/WRITERS_ROOM.md).

    python tools/writers/serve.py            then open http://127.0.0.1:8795 (WRITERS_PORT for another)

WRITERS_HOME=<a scratch folder> keeps everything there instead (its sessions, versions and builds): the page's test
runs on one.

Sessions live in Content/Prototypes/<id>/prototype.json; every save keeps the one before it in
Saved/Writers/<id>/history/ (the last 40). What the page shows is written to Saved/Writers/now.json for Claude in
Claude Code (room.py now). Build writes Content/Games/<Game>/ (build.py). Plain Python, no installs; 127.0.0.1 only.
"""
import json
import os
import re
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
sys.path.insert(0, str(HERE))
from storykit import chartscript  # noqa: E402
from storykit import proto  # noqa: E402

PORT = int(os.environ.get("WRITERS_PORT", 8795))
HOME = Path(os.environ["WRITERS_HOME"]).resolve() if os.environ.get("WRITERS_HOME") else None
SAVED = HOME / "Saved" if HOME else ROOT / "Saved" / "Writers"
NOW = SAVED / "now.json"
if HOME:                                            # a scratch home: the sessions live there too
    proto.PROTOS = HOME / "Prototypes"
proto.SAVED = SAVED
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml"}
PAGES = {"index.html", "app.js", "canvas.js", "ui.css"}
LOCK = threading.RLock()


history_dir = proto.history_dir


def session(sid):
    if not proto.SESSION.match(sid or "") or not proto.path_of(sid).exists():
        return None
    return proto.load(proto.path_of(sid))


def stamp(sid):
    """The version on disk: its file's time, to the nanosecond."""
    p = proto.path_of(sid)
    return str(p.stat().st_mtime_ns) if p.exists() else ""


def with_check(P):
    errs, warns = proto.check(P)
    scripts = {n["id"]: chartscript.shape_lines(P, n) for n in P.get("nodes", []) if n.get("steps")}   # each shape's script as written
    return {"prototype": P, "errors": errs, "warnings": warns, "minutes": list(proto.minutes_range(P)), "scripts": scripts,
            "stamp": stamp(P.get("id", ""))}


def store(P):
    with LOCK:
        proto.keep_history(P["id"])
        proto.save(P)


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

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            traceback.print_exc()
            try:
                self.send(500, {"error": f"the writers' room failed: {type(e).__name__}: {e}"})
            except OSError:
                pass

    def do_GET(self):
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if not parts:
            return self.page("index.html")
        if parts[0] != "api":
            return self.page(parts[0])
        what = parts[1] if len(parts) > 1 else ""
        if what == "sessions":
            return self.send(200, {"sessions": proto.sessions()})
        if what == "session" and len(parts) == 3:
            P = session(parts[2])
            return self.send(200, with_check(P)) if P else self.send(404, {"error": "no such session"})
        if what == "history" and len(parts) == 3:
            d = history_dir(parts[2])
            return self.send(200, {"versions": [p.stem for p in sorted(d.glob("*.json"), reverse=True)] if d.is_dir() else []})
        if what == "library":
            return self.send(200, {"faces": list(proto.library().values())})
        if what == "stamp" and len(parts) == 3:          # which version is on disk (the page takes in what Claude made)
            return self.send(200, {"stamp": stamp(parts[2])})
        if what == "sets":                               # the places designed first in the scene builder (Build into one)
            from storykit import storylib  # noqa: PLC0415
            return self.send(200, {"sets": storylib.sets()})
        return self.send(404, {"error": "unknown"})

    def page(self, name):
        if name not in PAGES:
            return self.send(404, {"error": "not found"})
        p = HERE / name
        self.send(200, p.read_bytes(), TYPES.get(p.suffix, "application/octet-stream"))

    def do_POST(self):
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        try:
            b = self.body()
        except ValueError:
            return self.send(400, {"error": "bad json"})
        what = parts[1] if len(parts) > 1 and parts[0] == "api" else ""
        sid = parts[2] if len(parts) > 2 else None
        try:
            if what == "sessions":                       # a new session
                title = str(b.get("title") or "").strip() or "Untitled"
                P = proto.new_session(title, {k: b[k] for k in ("kind", "references", "notes", "minutes") if k in b})
                return self.send(200, with_check(P))
            if what == "session" and sid:                # the page's chart, saved
                P = b.get("prototype")
                if not isinstance(P, dict) or P.get("id") != sid or not session(sid):
                    return self.send(400, {"error": "that isn't this session"})
                with LOCK:
                    if b.get("base") and b["base"] != stamp(sid):    # made again on disk since the page loaded it
                        return self.send(409, dict(with_check(session(sid)), error="the session changed on disk"))
                    store(P)
                return self.send(200, with_check(session(sid)))
            if what == "restore" and sid:                # an earlier version back
                p = history_dir(sid) / (re.sub(r"[^0-9-]", "", str(b.get("version", ""))) + ".json")
                if not p.exists():
                    return self.send(400, {"error": "no such version"})
                P = proto.load(p)
                store(P)
                return self.send(200, with_check(P))
            if what == "now":                            # what the page shows, for Claude Code (room.py now)
                SAVED.mkdir(parents=True, exist_ok=True)
                NOW.write_text(json.dumps(dict(b, at=proto.now()), ensure_ascii=False, indent=1), encoding="utf-8")
                return self.send(200, {"ok": True})
            if what == "build" and sid:
                import build
                if HOME:
                    build.GAMES = HOME / "Games"
                P = session(sid)
                if not P:
                    return self.send(404, {"error": "no such session"})
                res = build.build(P, str(b.get("game") or ""), force=bool(b.get("force")), set_name=str(b.get("set") or "") or None)
                if res.get("ok"):
                    P["built"] = dict({"game": res["game"], "at": proto.now()}, **({"set": b["set"]} if b.get("set") else {}))
                    store(P)
                    res["stamp"] = stamp(sid)
                return self.send(200, res) if res.get("ok") else self.send(400, dict(res, error=res.get("message")))
        except ValueError as e:
            return self.send(400, {"error": str(e)})
        return self.send(404, {"error": "unknown"})


def main():
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        sys.exit(f"port {PORT} is taken: is the writers' room already open? (WRITERS_PORT=8796 for another)")
    print(f"THE WRITERS' ROOM on http://127.0.0.1:{PORT}" + (f"  (home: {HOME})" if HOME else "") + "  (Ctrl+C stops it)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
