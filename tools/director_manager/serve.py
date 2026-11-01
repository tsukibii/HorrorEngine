#!/usr/bin/env python3
"""The Director Manager (docs/GODOT_DIRECTOR_PLAN.md §4, DECISIONS 2026-11-01): the page that writes a Director game's
story, `director/director.json` in its Godot project, over the scene's ids (the plugin writes them to
`.hsdirector/index.json` on every save). Its quests, people (their conversations and states), moments, states,
endings, facts, achievements, the saves, and Coverage: what the scene has that the story never names, and what the
story names that the scene hasn't got.

    python tools/director_manager/serve.py --project ~/Games/MyGame      then open http://127.0.0.1:8796
    (the dock's Manager button in Godot starts it on its project; --port or DIRECTOR_MANAGER_PORT for another)

The page opens the project given here, or `?project=<folder>` (any folder with a project.godot). A save keeps the
version before it in `director/history/` (the last 50). Nothing loads from outside: the desk's editors (its commands,
forms and lists, tools/director/ui.js) are served from this repo.
"""
import argparse
import json
import os
import re
import shutil
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DESK = ROOT / "tools" / "director"
DESK_FILES = {"ui.js", "ui.css", "commands.js", "icons.js", "clipboard.js", "refs.js"}
PAGES = {"index.html", "manager.js", "manager.css", "coverage.js"}
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json"}
EMPTY = {"format": 1, "quests": [], "states": [], "moments": [], "talk": {}, "endings": [], "achievements": [], "facts": {}}
KEEP = 50
DEFAULT_PROJECT = None


def project_dir(q):
    """The project a request names (?project=), else the one the server was started on; a folder with project.godot."""
    p = (q.get("project") or [None])[0] or DEFAULT_PROJECT
    if not p:
        return None
    d = Path(os.path.expanduser(p)).resolve()
    return d if (d / "project.godot").is_file() else None


def godot_setting(d, key):
    text = (d / "project.godot").read_text(encoding="utf-8", errors="replace")
    m = re.search(r'^' + re.escape(key) + r'\s*=\s*"?([^"\n]*)"?', text, re.M)
    return m.group(1) if m else None


def user_dir(d):
    """Godot's user:// for the project (its saves, the play-from-here file): app_userdata/<name>, or its custom one."""
    name = godot_setting(d, "config/name") or d.name
    custom = godot_setting(d, "config/use_custom_user_dir") == "true"
    if sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", Path.home()))
        return base / (godot_setting(d, "config/custom_user_dir_name") or name) if custom else base / "Godot" / "app_userdata" / name
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / (godot_setting(d, "config/custom_user_dir_name") or name) if custom else base / "godot" / "app_userdata" / name


def read_json(p, default):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def project_info(d):
    story_p = d / "director" / "director.json"
    story = read_json(story_p, None)
    problem = None
    if story is None and story_p.exists():
        problem = "director/director.json isn't JSON: fix it by hand, or save over it here"
    story = story if isinstance(story, dict) else json.loads(json.dumps(EMPTY))
    for k, v in EMPTY.items():
        story.setdefault(k, json.loads(json.dumps(v)))
    index = read_json(d / ".hsdirector" / "index.json", {})
    ids = {}
    for scene, kinds in (index.get("_scenes") or {}).items():
        for k, vals in kinds.items():
            ids.setdefault(k, set()).update(vals)
    if not ids:                                  # an index written before scenes were kept apart
        for k, vals in index.items():
            if not k.startswith("_") and isinstance(vals, list):
                ids.setdefault(k, set()).update(vals)
    lives = read_json(d / "game" / "lives.json", {}).get("lives", {})
    sfx = read_json(d / "game" / "sfx" / "index.json", {})
    sounds = sorted((sfx.get("sounds") or sfx).keys()) if isinstance(sfx, dict) else []
    return {
        "project": str(d), "name": godot_setting(d, "config/name") or d.name, "story": story, "problem": problem,
        "stamp": story_p.stat().st_mtime if story_p.exists() else 0,
        "ids": {k: sorted(v) for k, v in ids.items()}, "indexed": bool(index),
        "lives": {k: [s.get("id") for s in v.get("states", [])] for k, v in lives.items()}, "sounds": [s for s in sounds if not s.startswith("_")],
        "saves": saves(d), "user": str(user_dir(d)),
    }


def saves(d):
    """The game's saves (user://saves_<game>.json: its slots) and the play-from-here file, if any."""
    u = user_dir(d)
    out = []
    for f in sorted(u.glob("saves_*.json")) if u.is_dir() else []:
        data = read_json(f, {})                  # the pause menu's: {slot: {where, secs, at (unix time)}}, "auto" the autosave
        for k, v in (data.items() if isinstance(data, dict) else []):
            if isinstance(v, dict):
                out.append({"file": f.name, "slot": k, "where": v.get("where", ""), "secs": v.get("secs", 0), "at": v.get("at", 0)})
    run = u / "hs_director_run.json"
    return {"slots": out, "next_play": read_json(run, None) if run.exists() else None}


def save_story(d, story):
    """The story written, the version before it kept in director/history/ (the last KEEP)."""
    p = d / "director" / "director.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        h = d / "director" / "history"
        h.mkdir(exist_ok=True)
        shutil.copy(p, h / time.strftime("%Y%m%d-%H%M%S.json"))
        old = sorted(h.glob("*.json"))
        for f in old[:-KEEP]:
            f.unlink()
    p.write_text(json.dumps(story, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return p.stat().st_mtime


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
                self.send(500, {"error": f"the Director Manager failed: {type(e).__name__}: {e}"})
            except OSError:
                pass

    def do_GET(self):
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        q = parse_qs(u.query)
        if not parts:
            return self.file(HERE / "index.html")
        if parts[0] == "desk" and len(parts) == 2 and parts[1] in DESK_FILES:
            return self.file(DESK / parts[1])
        if parts[0] in PAGES:
            return self.file(HERE / parts[0])
        if parts[0] != "api":
            return self.send(404, {"error": "not found"})
        d = project_dir(q)
        if d is None:
            return self.send(400, {"error": "no project: start it with --project <folder>, or open ?project=<a folder with project.godot>"})
        what = parts[1] if len(parts) > 1 else ""
        if what == "project":
            return self.send(200, project_info(d))
        if what == "stamp":                       # the file's version on disk (another writer: the page takes it in)
            p = d / "director" / "director.json"
            return self.send(200, {"stamp": p.stat().st_mtime if p.exists() else 0})
        if what == "history":
            h = d / "director" / "history"
            return self.send(200, {"versions": [f.stem for f in sorted(h.glob("*.json"), reverse=True)] if h.is_dir() else []})
        if what == "version" and len(parts) == 3:
            f = d / "director" / "history" / (Path(parts[2]).name + ".json")
            return self.send(200, read_json(f, {})) if f.exists() else self.send(404, {"error": "no such version"})
        return self.send(404, {"error": "unknown"})

    def do_POST(self):
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        d = project_dir(parse_qs(u.query))
        if d is None or not parts or parts[0] != "api":
            return self.send(400, {"error": "no project"})
        what = parts[1] if len(parts) > 1 else ""
        b = self.body()
        if what == "story":
            story = b.get("story")
            if not isinstance(story, dict):
                return self.send(400, {"error": "no story"})
            return self.send(200, {"ok": True, "stamp": save_story(d, story)})
        if what == "next_play":                   # the next F5 starts here (the dock's play-from-here file)
            u_dir = user_dir(d)
            u_dir.mkdir(parents=True, exist_ok=True)
            f = u_dir / "hs_director_run.json"
            if b.get("from"):
                f.write_text(json.dumps({"from": b["from"], "flags": b.get("flags", [])}), encoding="utf-8")
            elif f.exists():
                f.unlink()
            return self.send(200, {"ok": True, "saves": saves(d)})
        if what == "delete_save":                 # a slot taken out of its file, or the whole file (a new game from scratch)
            f = user_dir(d) / Path(str(b.get("file", ""))).name
            if not f.name.startswith("saves_") or not f.exists():
                return self.send(404, {"error": "no such save"})
            if b.get("slot") in (None, ""):
                f.unlink()
            else:
                data = read_json(f, {})
                if isinstance(data, dict):
                    data.pop(str(b["slot"]), None)
                f.write_text(json.dumps(data), encoding="utf-8")
            return self.send(200, {"ok": True, "saves": saves(d)})
        return self.send(404, {"error": "unknown"})

    def file(self, p):
        if not p.is_file():
            return self.send(404, {"error": "not found"})
        self.send(200, p.read_bytes(), TYPES.get(p.suffix, "application/octet-stream"))


def main(argv=None):
    global DEFAULT_PROJECT
    ap = argparse.ArgumentParser(description="The Director Manager: a Director game's story, in a page.")
    ap.add_argument("--project", help="the Godot project (a folder with project.godot)")
    ap.add_argument("--port", type=int, default=int(os.environ.get("DIRECTOR_MANAGER_PORT", 8796)))
    a = ap.parse_args(argv)
    if a.project:
        d = Path(os.path.expanduser(a.project)).resolve()
        if not (d / "project.godot").is_file():
            sys.exit(f"{d} isn't a Godot project (no project.godot)")
        DEFAULT_PROJECT = str(d)
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    except OSError:
        print(f"port {a.port} is taken: the Director Manager is already open there (http://127.0.0.1:{a.port})")
        return 0
    print(f"THE DIRECTOR MANAGER on http://127.0.0.1:{a.port}" + (f"  (project: {DEFAULT_PROJECT})" if DEFAULT_PROJECT else "") + "  (Ctrl+C stops it)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
