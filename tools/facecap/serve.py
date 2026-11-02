#!/usr/bin/env python3
"""The Face page (docs/GODOT_ANIMATION_PLAN.md §3b; the user, 2026-11-02, night: "the tooling we are using in director
to upload the face videos... let's make it a separate page so I can save the facial mocap"): the desk's Expressions
import as a page of its own. A video of a face is solved on this machine (tools/face_capture.py), previewed on a
character (the default MHR, or a Character Studio export) in sync with the clip, named, its neutral, strength and length
set, a loop cut from a range; Accept keeps it in the studio's expression library (Content/Studio/Expressions, the
same one the desk's Expressions tab shows). **For Godot** bakes the picked ones into a Godot project's faces/ (the loops
in faces/loops/: tools/face_export.mjs), where the Director's Animate tab shows them as cards.

    python tools/facecap/serve.py [--project <a Godot project>] [--port 8797]     then open http://127.0.0.1:8797

It is the desk's own server (tools/director/serve.py: the library's endpoints, the bodies, the page modules) with the
page and the Godot routes on top, so the desk and this page never disagree about the library. Plain Python, no
installs. Listens on 127.0.0.1 only. `--library <folder>` serves another library (the page's check, FACEMOCAP).
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import urllib.parse
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
_spec = importlib.util.spec_from_file_location("desk_serve", ROOT / "tools" / "director" / "serve.py")
DESK = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(DESK)

PORT = 8797
PAGE = {"index.html": "text/html", "facecap.js": "text/javascript", "facecap.css": "text/css"}
RECENT = ROOT / "Saved" / "facecap" / "projects.json"     # the Godot projects faces went to, newest first
STATE = {"project": ""}                                    # the project it was started for (the Animate tab's button)


def project_of(p):
    """a Godot project's folder from what was typed (~ and relative paths too), and why not when it isn't one"""
    if not p or not str(p).strip():
        return None, "type the Godot project's folder (the one with project.godot)"
    d = Path(os.path.expanduser(str(p).strip())).resolve()
    if not d.is_dir():
        return None, f"no folder {d}"
    if not (d / "project.godot").is_file():
        return None, f"{d} isn't a Godot project (no project.godot in it)"
    return d, ""


def recent():
    try:
        return [p for p in json.loads(RECENT.read_text(encoding="utf-8")) if isinstance(p, str)]
    except (OSError, ValueError):
        return []


def remember(d):
    keep = [str(d)] + [p for p in recent() if p != str(d)]
    RECENT.parent.mkdir(parents=True, exist_ok=True)
    RECENT.write_text(json.dumps(keep[:8], indent=1), encoding="utf-8")


def faces_in(d):
    """the face clips a project has: [{id, loop}] (faces/<id>.tres, faces/loops/<id>.tres)"""
    out = []
    for sub, loop in (("faces", False), (os.path.join("faces", "loops"), True)):
        f = d / sub
        for t in sorted(f.glob("*.tres")) if f.is_dir() else []:
            out.append({"id": t.stem, "loop": loop})
    return out


class Handler(DESK.Handler):
    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        parts = url.path.strip("/").split("/")
        if parts == [""]:
            parts = ["index.html"]
        if len(parts) == 1 and parts[0] in PAGE:
            return self.send(200, (HERE / parts[0]).read_bytes(), PAGE[parts[0]])
        if parts == ["api", "godot", "projects"]:          # where faces went before, and the project it was started for
            return self.send(200, {"projects": recent(), "start": STATE["project"]})
        if parts == ["api", "godot", "faces"]:             # a project's faces/ now
            q = urllib.parse.parse_qs(url.query)
            d, why = project_of((q.get("project") or [""])[0])
            if d is None:
                return self.send(200, {"ok": False, "why": why, "faces": []})
            return self.send(200, {"ok": True, "project": str(d), "faces": faces_in(d)})
        return super().do_GET()

    def do_POST(self):
        parts = self.path.split("?")[0].strip("/").split("/")
        if parts == ["api", "godot", "faces"]:             # For Godot: the picked expressions baked into the project's faces/
            req = json.loads(self.body().decode("utf-8") or "{}")
            d, why = project_of(req.get("project"))
            if d is None:
                return self.send(400, {"error": why})
            ids = [str(i) for i in req.get("ids") or []]
            bad = [i for i in ids if not DESK.face_name(i) or not (DESK.EXPRESSIONS / i / "expression.json").is_file()]
            if not ids or bad:
                return self.send(400, {"error": f"not in the library: {', '.join(bad)}" if bad else "tick the faces to send first"})
            node = shutil.which("node")
            if not node:
                return self.send(400, {"error": "For Godot needs Node.js (https://nodejs.org): tools/face_export.mjs bakes the clips"})
            env = dict(os.environ, HS_EXPRESSIONS=str(DESK.EXPRESSIONS))
            r = subprocess.run([node, str(ROOT / "tools" / "face_export.mjs"), "--project", str(d), *ids],
                               capture_output=True, text=True, timeout=600, env=env, cwd=str(ROOT))
            said = [x for x in (r.stdout + r.stderr).splitlines() if x.strip()]
            if r.returncode or not any(x.startswith("FACEEXPORT ok") for x in said):
                return self.send(400, {"error": (said[-1] if said else "face_export.mjs failed")[:400]})
            remember(d)
            return self.send(200, {"ok": True, "project": str(d), "sent": [x.strip() for x in said if x.startswith("  ")], "faces": faces_in(d)})
        return super().do_POST()

    def log_message(self, *a):
        pass


def main(argv):
    global PORT
    opt = lambda k, dflt=None: argv[argv.index(k) + 1] if k in argv and argv.index(k) + 1 < len(argv) else dflt   # noqa: E731
    PORT = int(opt("--port", os.environ.get("FACECAP_PORT", PORT)))
    if opt("--library"):                                   # another library (the check's scratch one): the desk's endpoints read it
        DESK.EXPRESSIONS = Path(opt("--library")).resolve()
        DESK.EXPR_SAVED = DESK.EXPRESSIONS.parent / (DESK.EXPRESSIONS.name + "_saved")
    if opt("--project"):
        STATE["project"] = str(Path(os.path.expanduser(opt("--project"))).resolve())
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"FACE PAGE on http://127.0.0.1:{PORT}  (the library: {DESK.EXPRESSIONS}; Ctrl+C stops it)", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main(sys.argv[1:])
