#!/usr/bin/env python3
"""The studio dashboard: every tool on one page, started, opened and stopped with a click (the terminal launcher,
tools/launch.py, as a page: the same tools, the same sections, the same record of what's running).

    python dashboard.py              opens http://127.0.0.1:8790 in the browser (DASH_PORT=8799 for another port)
    python dashboard.py --no-open    the same, without opening the browser
    python dashboard.py --close      stop every page the dashboard or the launcher started, then exit

The pages (the desk, the Character Studio, the writers' room...) run as their own servers: Start starts one and opens
it when it answers, Open opens it again, Stop stops its server (pages on one server share it: the desk, the scene
builder, the kit maker...). They're kept in Saved/launch.json, the launcher's own record, so either can stop what the
other started, and they keep running when the dashboard closes. Everything else (the checks, the story views, the
setup steps) runs as a job: its output streams into the page, ok or failed when it ends, Stop ends it early; the
jobs' logs are kept in Saved/dashboard/. Words a tool needs (a game, an id, a folder) are asked for on its row.
Plain Python, no installs; listens on 127.0.0.1 only.
"""
import importlib.util
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
PAGE = ROOT / "tools" / "dashboard"
SAVED = ROOT / "Saved" / "dashboard"
JOBS_FILE = SAVED / "jobs.json"
PORT = int(os.environ.get("DASH_PORT", 8790))
KEEP_JOBS = 40
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml"}

spec = importlib.util.spec_from_file_location("launch", ROOT / "tools" / "launch.py")
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)
TOOLS = launch.TOOLS
WIN = launch.WIN
PY = launch.PY
LOCK = threading.RLock()

# the tools to start the day from: shown first, as tiles (labels as in launch.py's TOOLS)
START_HERE = ["Writers' room (prototype a game's story: the river, its endings, its secrets)", "Director's desk",
              "Character Studio (body, face, skin, hair in the salon, clothes)", "Score room (music)", "Kimodo demo",
              "Scene builder (floor plans)"]


# ---- a tool's command: the words it asks for, then its argument list -------------------------------------------

TOKEN = re.compile(r"\{[^}]*\}|\S+")


def fields_of(cmd):
    """What a command asks for, in order: the game, a word ({ask:Prompt}) or an optional word ({opt:Prompt|--flag})."""
    out = []
    for n, tok in enumerate(TOKEN.findall(cmd)):
        if "{game}" in tok and not any(f["kind"] == "game" for f in out):
            out.append({"kind": "game", "key": "game", "prompt": "Game"})
        elif tok.startswith("{ask:") or tok.startswith("{opt:"):
            prompt, _, flag = tok[5:-1].partition("|")
            out.append({"kind": tok[1:4], "key": f"w{n}", "prompt": prompt, "flag": flag})
    return out


def args_of(cmd, values):
    """The command as an argument list from the page's values; raises ValueError naming a missing word."""
    out = []
    for n, tok in enumerate(TOKEN.findall(cmd)):
        if "{game}" in tok:
            g = (values.get("game") or "").strip()
            if g not in launch.games():
                raise ValueError("choose a game" if not g else f"no game called {g}")
            tok = tok.replace("{game}", g)
        if tok.startswith("{ask:") or tok.startswith("{opt:"):
            prompt, _, flag = tok[5:-1].partition("|")
            v = str(values.get(f"w{n}", "")).strip().strip('"')
            if not v and tok.startswith("{ask:"):
                raise ValueError(f"fill in: {prompt}")
            if v:
                out += ([flag] if flag else []) + [v]
            continue
        out.append(tok)
    return out if out[0] == "node" else [PY] + out


def shown(args):
    return launch.shown(args)


def log_of(args):
    """Where a page server's output goes: the launcher's own log for it (Saved/launch/<its folder>.log)."""
    return ROOT / "Saved" / "launch" / (Path(args[1]).parent.name + ".log")


def port_of(url):
    p = urlparse(url)
    return p.port or (443 if p.scheme == "https" else 80)


def answers(url, secs=12.0):
    """Waits until the page's server takes connections (True), or gives up after secs."""
    t0, port = time.time(), port_of(url)
    while time.time() - t0 < secs:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.25)
    return False


def kill_tree(pid):
    if WIN:
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(pid)], capture_output=True)
        return
    try:
        os.killpg(pid, signal.SIGTERM)
        for _ in range(30):
            try:
                os.killpg(pid, 0)
            except OSError:
                return
            time.sleep(0.1)
        os.killpg(pid, signal.SIGKILL)
    except OSError:
        pass


def spawn(args, log):
    """A process in its own group (so Stop ends its children too), its output to log."""
    log.parent.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PYTHONUNBUFFERED="1", NO_COLOR="1", PYTHONIOENCODING="utf-8")
    with open(log, "ab") as f:
        if WIN:
            return subprocess.Popen(args, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=f, stderr=subprocess.STDOUT, env=env,
                                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | getattr(subprocess, "CREATE_NO_WINDOW", 0))
        return subprocess.Popen(args, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=f, stderr=subprocess.STDOUT, env=env, start_new_session=True)


# ---- pages: servers kept in the launcher's record -----------------------------------------------------------

def pages(state):
    """The page servers running, each with its pages (labels) and their urls."""
    url_of = {label: opts.get("url") for _, label, _, opts in TOOLS}
    out = []
    for key, r in launch.running(state).items():
        out.append({"key": key, "pid": r["pid"], "labels": r["labels"], "urls": {l: url_of.get(l) for l in r["labels"]},
                    "since": r.get("since"), "log": str(log_of(r["args"]).relative_to(ROOT))})
    return out


def start_page(i, args, state):
    """Start a page's server, or (its server already up) add the page to it; returns its url once it answers."""
    sec, label, cmd, opts = TOOLS[i]
    key = shown(args)
    r = launch.running(state).get(key)
    if r:
        if label not in r["labels"]:
            r["labels"].append(label)
            launch.save_state(state)
        return {"kind": "page", "url": opts["url"], "already": True}
    log = log_of(args)
    log.parent.mkdir(parents=True, exist_ok=True)
    with open(log, "ab") as f:
        f.write(f"\n---- {time.strftime('%Y-%m-%d %H:%M:%S')} started from the dashboard: {key}\n".encode("utf-8"))
    proc = spawn(args, log)
    state.setdefault("running", {})[key] = {"pid": proc.pid, "args": args, "labels": [label], "since": time.time()}
    launch.save_state(state)
    ok = answers(opts["url"])
    if proc.poll() is not None:
        launch.running(state)
        tail = log.read_text("utf-8", "replace")[-1200:] if log.exists() else ""
        return {"kind": "page", "error": f"{label} stopped straight away (is it running from somewhere else? is its port taken?)", "tail": tail}
    return {"kind": "page", "url": opts["url"], "answering": ok}


# ---- jobs: one-shot commands with their output ----------------------------------------------------------------

JOBS = {}            # id -> job (the running ones keep their Popen in "proc")


def load_jobs():
    try:
        for j in json.loads(JOBS_FILE.read_text("utf-8")):
            if j.get("status") == "running":           # the dashboard closed while it ran: whatever it was is unknown now
                j["status"] = "lost"
            JOBS[j["id"]] = j
    except (OSError, ValueError):
        pass


def save_jobs():
    keep = sorted(JOBS.values(), key=lambda j: j["started"])[-KEEP_JOBS:]
    for j in list(JOBS.values()):
        if j not in keep and j.get("status") != "running":
            JOBS.pop(j["id"], None)
    SAVED.mkdir(parents=True, exist_ok=True)
    JOBS_FILE.write_text(json.dumps([{k: v for k, v in j.items() if k != "proc"} for j in keep], indent=1), "utf-8")


def verdict(text, code):
    """ok or failed, by the exit code and the check's last word (`<NAME> ok`, `<NAME> FAILED`)."""
    names = re.findall(r"^\s*([A-Z][A-Z0-9 _]{1,30}) (ok|FAILED)\b", text, re.M)
    if code == 0 and not any(v == "FAILED" for _, v in names[-3:]):
        return "ok"
    return "failed"


def refresh_jobs():
    for j in JOBS.values():
        p = j.get("proc")
        if p is None or j["status"] != "running":
            continue
        code = p.poll()
        if code is None:
            continue
        j["code"], j["ended"] = code, time.time()
        text = Path(ROOT / j["log"]).read_text("utf-8", "replace") if (ROOT / j["log"]).exists() else ""
        j["status"] = "stopped" if j.get("stopping") else verdict(text, code)
        j["result"] = last_word(text)
        j.pop("proc", None)
        save_jobs()


def last_word(text):
    """The line a check ends on (`STORY ok (...)`), else the last line of output."""
    lines = [l.strip() for l in text.splitlines() if l.strip() and not l.startswith("❯ ")]
    for l in reversed(lines[-30:]):
        if re.match(r"^[A-Z][A-Z0-9 _]{1,30} (ok|FAILED)\b", l):
            return l[:200]
    return lines[-1][:200] if lines else ""


def start_job(i, args):
    sec, label, cmd, opts = TOOLS[i]
    jid = time.strftime("%Y%m%d-%H%M%S") + f"-{len(JOBS) % 1000:03d}"
    slug = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")[:40]
    log = SAVED / "jobs" / f"{jid}-{slug}.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(f"❯ {shown(args)}\n\n", "utf-8")
    proc = spawn(args, log)
    JOBS[jid] = {"id": jid, "i": i, "label": label, "section": sec, "shown": shown(args), "pid": proc.pid, "proc": proc,
                 "log": str(log.relative_to(ROOT)), "started": time.time(), "status": "running"}
    save_jobs()
    return {"kind": "job", "job": jid}


def stop_job(jid):
    j = JOBS.get(jid)
    if not j or j["status"] != "running":
        return False
    j["stopping"] = True
    kill_tree(j["pid"])
    return True


def remember(state, label, args, url):
    r = {"label": label, "args": [a if a != PY else "{py}" for a in args], "url": url, "shown": shown(args)}
    state["recent"] = [r] + [x for x in state.get("recent", []) if x.get("shown") != r["shown"]][:7]
    launch.save_state(state)


def tools_list():
    out = []
    for i, (sec, label, cmd, opts) in enumerate(TOOLS):
        out.append({"i": i, "section": sec, "label": label, "cmd": cmd, "url": opts.get("url"), "fields": fields_of(cmd),
                    "server": cmd.split()[0] if opts.get("url") else None, "start": label in START_HERE})
    return out


def run_tool(i, values, state):
    if not 0 <= i < len(TOOLS):
        raise ValueError(f"no tool {i}")
    sec, label, cmd, opts = TOOLS[i]
    args = args_of(cmd, values)
    if args[0] == "node" and not shutil.which("node"):
        raise ValueError("this one needs Node.js (https://nodejs.org)")
    if values.get("game"):
        state["game"] = values["game"]
    remember(state, label, args, opts.get("url"))
    return start_page(i, args, state) if opts.get("url") else start_job(i, args)


# ---- the server ------------------------------------------------------------------------------------------------

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
        except Exception as e:                         # a bug here: say so on the page, keep serving
            import traceback
            traceback.print_exc()
            try:
                self.send(500, {"error": f"the dashboard failed: {type(e).__name__}: {e}"})
            except OSError:
                pass

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path in ("/", "/index.html"):
            return self.static("index.html")
        if u.path.startswith("/api/"):
            with LOCK:
                return self.api_get(u.path[5:], q)
        return self.static(u.path.lstrip("/"))

    def static(self, name):
        p = (PAGE / name).resolve()
        if PAGE not in p.parents or not p.is_file():
            return self.send(404, {"error": "not found"})
        self.send(200, p.read_bytes(), TYPES.get(p.suffix, "application/octet-stream"))

    def api_get(self, what, q):
        state = launch.load_state()
        if what == "tools":
            return self.send(200, {"tools": tools_list(), "sections": list(dict.fromkeys(t[0] for t in TOOLS)),
                                   "games": launch.games(), "game": state.get("game"), "root": str(ROOT)})
        if what == "status":
            refresh_jobs()
            jobs = sorted(({k: v for k, v in j.items() if k != "proc"} for j in JOBS.values()), key=lambda j: -j["started"])
            return self.send(200, {"pages": pages(state), "jobs": jobs, "game": state.get("game"), "games": launch.games(),
                                   "recent": [{"n": n, "label": r["label"], "shown": r["shown"], "url": r.get("url")}
                                              for n, r in enumerate(state.get("recent", []))]})
        if what == "log":                              # a job's or a page server's output, from a byte offset on
            if q.get("job"):
                j = JOBS.get(q["job"])
                path = ROOT / j["log"] if j else None
            else:
                r = launch.running(state).get(q.get("page", ""))
                path = log_of(r["args"]) if r else None
            if not path or not path.exists():
                return self.send(404, {"error": "no log"})
            size = path.stat().st_size
            start = max(0, min(int(q.get("from") or 0), size))
            if start == 0 and size > 200_000:          # a long log: its end
                start = size - 200_000
            with open(path, "rb") as f:
                f.seek(start)
                text = f.read().decode("utf-8", "replace")
            return self.send(200, {"text": text, "size": size, "path": str(path.relative_to(ROOT))})
        return self.send(404, {"error": "unknown"})

    def do_POST(self):
        u = urlparse(self.path)
        try:
            b = self.body()
        except ValueError:
            return self.send(400, {"error": "bad json"})
        with LOCK:
            state = launch.load_state()
            try:
                if u.path == "/api/run":
                    return self.send(200, run_tool(int(b.get("i", -1)), b.get("values") or {}, state))
                if u.path == "/api/rerun":                 # one of the recent ones, as it ran
                    recent = state.get("recent", [])
                    n = int(b.get("n", -1))
                    if not 0 <= n < len(recent):
                        raise ValueError("no such recent run")
                    r = recent[n]
                    i = next((k for k, t in enumerate(TOOLS) if t[1] == r["label"]), None)
                    if i is None:
                        raise ValueError(f"{r['label']} isn't a tool any more")
                    args = [PY if a == "{py}" else a for a in r["args"]]
                    remember(state, r["label"], args, r.get("url"))
                    return self.send(200, start_page(i, args, state) if r.get("url") else start_job(i, args))
            except ValueError as e:
                return self.send(400, {"error": str(e)})
            if u.path == "/api/stop":
                if b.get("job"):
                    return self.send(200, {"stopped": stop_job(b["job"])})
                if b.get("page") in launch.running(state):
                    launch.stop(state, b["page"])
                    return self.send(200, {"stopped": True})
                return self.send(404, {"error": "not running"})
            if u.path == "/api/stop_all":
                n = len(launch.running(state))
                launch.close_all(state)
                k = sum(stop_job(j["id"]) for j in list(JOBS.values()) if j["status"] == "running")
                return self.send(200, {"pages": n, "jobs": k})
            if u.path == "/api/game":
                if b.get("game") not in launch.games():
                    return self.send(400, {"error": "no such game"})
                state["game"] = b["game"]
                launch.save_state(state)
                return self.send(200, {"game": state["game"]})
            if u.path == "/api/forget":                    # clear the finished jobs from the list
                for j in list(JOBS.values()):
                    if j["status"] != "running":
                        JOBS.pop(j["id"], None)
                save_jobs()
                return self.send(200, {"ok": True})
        return self.send(404, {"error": "unknown"})


def main(argv):
    if "--close" in argv:
        launch.close_all(launch.load_state())
        return 0
    load_jobs()
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        url = f"http://127.0.0.1:{PORT}"
        print(f"The dashboard is already running at {url} (or the port is taken: DASH_PORT=8799 python dashboard.py)")
        if "--no-open" not in argv:
            webbrowser.open(url)
        return 1
    url = f"http://127.0.0.1:{PORT}"
    print(f"HORROR STUDIO dashboard on {url}  (Ctrl+C closes it; the pages it started keep running)")
    if "--no-open" not in argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    with LOCK:
        running = [j for j in JOBS.values() if j["status"] == "running"]
        for j in running:
            stop_job(j["id"])
        refresh_jobs()
        n = len(launch.running(launch.load_state()))
    print(f"\nclosed{f'; stopped {len(running)} job(s)' if running else ''}"
          f"{f'; {n} page server(s) still running (python dashboard.py --close stops them)' if n else ''}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
