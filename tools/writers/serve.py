#!/usr/bin/env python3
"""The writers' room: a local page for prototyping a game's story with an assistant (docs/WRITERS_ROOM.md).

    python tools/writers/serve.py            then open http://127.0.0.1:8795 (WRITERS_PORT for another)

Sessions live in Content/Prototypes/<id>/prototype.json; every save keeps the one before it in
Saved/Writers/<id>/history/ (the last 40). Drafting and the assistant run as jobs (one at a time a session) whose
progress the page follows; the model is the switch's (Claude through the API or Claude Code, or a local model through
Ollama: llm.py). What the page shows is written to Saved/Writers/now.json for Claude in Claude Code (room.py now).
Plain Python, no installs; listens on 127.0.0.1 only.
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
from storykit import proto  # noqa: E402
import llm  # noqa: E402
import gen  # noqa: E402
import fake  # noqa: E402

PORT = int(os.environ.get("WRITERS_PORT", 8795))
SAVED = ROOT / "Saved" / "Writers"
NOW = SAVED / "now.json"
KEEP = 40
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml"}
PAGES = {"index.html", "app.js", "river.js", "ui.css"}
LOCK = threading.RLock()
JOBS = {}                                           # job id -> {id, session, kind, status, log, error, result, cancel}
BUSY = {}                                           # session id -> job id running on it


def history_dir(sid):
    return SAVED / sid / "history"


def keep_history(sid):
    """The session as it is on disk, into its history before it's replaced."""
    p = proto.path_of(sid)
    if not p.exists():
        return
    d = history_dir(sid)
    d.mkdir(parents=True, exist_ok=True)
    (d / (time.strftime("%Y%m%d-%H%M%S") + f"-{int(time.time() * 1000) % 1000:03d}.json")).write_bytes(p.read_bytes())
    for old in sorted(d.glob("*.json"))[:-KEEP]:
        old.unlink()


def session(sid):
    if not proto.SESSION.match(sid or "") or not proto.path_of(sid).exists():
        return None
    return proto.load(proto.path_of(sid))


def with_check(P):
    errs, warns = proto.check(P)
    return {"prototype": P, "errors": errs, "warnings": warns, "minutes": round(proto.main_minutes(P), 1),
            "busy": BUSY.get(P["id"])}


def store(P):
    with LOCK:
        keep_history(P["id"])
        proto.save(P)


# ---- jobs: drafting and the assistant, in the background --------------------------------------------------------

class Cancelled(Exception):
    pass


def start_job(sid, kind, work):
    """work(job, P, backend, progress) -> result, run on a thread; the session is reloaded fresh when it starts."""
    with LOCK:
        if BUSY.get(sid):
            raise ValueError("the assistant is already working on this session")
        jid = f"{sid}-{int(time.time() * 1000)}"
        job = {"id": jid, "session": sid, "kind": kind, "status": "running", "log": [], "error": None, "result": None,
               "cancel": False, "started": time.time()}
        JOBS[jid] = job
        BUSY[sid] = jid

    def progress(msg):
        if job["cancel"]:
            raise Cancelled()
        with LOCK:
            if job["log"] and job["log"][-1]["text"].split(" (")[0] == msg.split(" (")[0]:
                job["log"][-1] = {"t": time.time(), "text": msg}      # the same step's count going up: one line
            else:
                job["log"].append({"t": time.time(), "text": msg})

    def run():
        try:
            P = session(sid)
            be = llm.backend(llm.settings(), fake.answer)
            progress(f"{be.label}: {kind}")
            job["result"] = work(job, P, be, progress)
            job["status"] = "done"
        except Cancelled:
            job["status"] = "cancelled"
        except llm.ModelError as e:
            job["status"], job["error"] = "failed", str(e)
        except Exception as e:                           # a bug: said on the page, the server carries on
            traceback.print_exc()
            job["status"], job["error"] = "failed", f"{type(e).__name__}: {e}"
        finally:
            with LOCK:
                BUSY.pop(sid, None)
            job["ended"] = time.time()
    threading.Thread(target=run, daemon=True).start()
    return job


def job_draft(stages, act=None):
    def work(job, P, be, progress):
        def save(Q):
            if job["cancel"]:
                raise Cancelled()
            store(Q)
        if stages == ["endings"]:
            gen.stage_endings(P, be, progress)
            save(P)
        elif stages == ["details"] and act:
            gen.stage_details(P, be, act, progress)
            save(P)
        else:
            gen.draft(P, be, progress, save, tuple(stages))
        return {"points": len(P.get("points", []))}
    return work


def job_chat(message, view):
    def work(job, P, be, progress):
        reply, Q, done, couldnt = gen.chat(P, message, view, be, progress)
        if job["cancel"]:
            raise Cancelled()
        Q.setdefault("chat", []).extend([{"role": "user", "text": message, "at": proto.now()},
                                         {"role": "assistant", "text": reply, "done": done, "at": proto.now()}])
        store(Q)
        return {"reply": reply, "done": done, "couldnt": couldnt}
    return work


# ---- the server ---------------------------------------------------------------------------------------------------

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
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
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
        if what == "settings":
            s = llm.settings()
            return self.send(200, {"settings": s, "status": llm.status(s)})
        if what == "job" and len(parts) == 3:
            j = JOBS.get(parts[2])
            return self.send(200, {k: v for k, v in j.items()}) if j else self.send(404, {"error": "no such job"})
        return self.send(404, {"error": "unknown"})

    def page(self, name):
        if name not in PAGES:
            return self.send(404, {"error": "not found"})
        p = HERE / name
        self.send(200, p.read_bytes(), TYPES.get(p.suffix, "application/octet-stream"))

    def do_POST(self):
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        try:
            b = self.body()
        except ValueError:
            return self.send(400, {"error": "bad json"})
        what = parts[1] if len(parts) > 1 and parts[0] == "api" else ""
        sid = parts[2] if len(parts) > 2 else None
        try:
            if what == "sessions":                       # a new session
                title = str(b.get("title") or "").strip() or "Untitled"
                P = proto.new_session(title, {k: b[k] for k in ("kind", "references", "notes", "endings", "minutes") if k in b})
                return self.send(200, with_check(P))
            if what == "session" and sid:                # the page's prototype, saved (not while a job writes it)
                P = b.get("prototype")
                if not isinstance(P, dict) or P.get("id") != sid or not session(sid):
                    return self.send(400, {"error": "that isn't this session"})
                if BUSY.get(sid):
                    return self.send(409, {"error": "the assistant is working on it: wait for it to finish"})
                store(P)
                return self.send(200, with_check(session(sid)))
            if what == "restore" and sid:                # an earlier version back
                p = history_dir(sid) / (re.sub(r"[^0-9-]", "", str(b.get("version", ""))) + ".json")
                if not p.exists() or BUSY.get(sid):
                    return self.send(400, {"error": "no such version (or the assistant is working)"})
                P = proto.load(p)
                store(P)
                return self.send(200, with_check(P))
            if what == "draft" and sid:
                stages = [s for s in (b.get("stages") or ["bible", "river", "details"]) if s in ("bible", "endings", "river", "details")]
                if not session(sid) or not stages:
                    return self.send(400, {"error": "no such session, or nothing to draft"})
                return self.send(200, start_job(sid, "draft " + "+".join(stages), job_draft(stages, b.get("act"))))
            if what == "chat" and sid:
                msg = str(b.get("message") or "").strip()
                if not msg or not session(sid):
                    return self.send(400, {"error": "nothing to say"})
                return self.send(200, start_job(sid, "chat", job_chat(msg, b.get("view") or {})))
            if what == "cancel" and sid:                 # sid is the job's id here
                j = JOBS.get(sid)
                if j and j["status"] == "running":
                    j["cancel"] = True
                return self.send(200, {"ok": True})
            if what == "settings":
                s = llm.settings()
                for k in ("backend", "claude_via", "model", "effort"):
                    if k in b:
                        s[k] = b[k]
                if isinstance(b.get("ollama"), dict):
                    s["ollama"].update({k: v for k, v in b["ollama"].items() if k in ("url", "model")})
                llm.save_settings(s)
                return self.send(200, {"settings": s, "status": llm.status(s)})
            if what == "now":                            # what the page shows, for Claude Code (room.py now)
                SAVED.mkdir(parents=True, exist_ok=True)
                NOW.write_text(json.dumps(dict(b, at=proto.now()), ensure_ascii=False, indent=1), encoding="utf-8")
                return self.send(200, {"ok": True})
            if what == "build" and sid:
                import build
                P = session(sid)
                if not P:
                    return self.send(404, {"error": "no such session"})
                res = build.build(P, str(b.get("game") or ""), force=bool(b.get("force")))
                if res.get("ok"):
                    P["built"] = {"game": res["game"], "at": proto.now()}
                    store(P)
                return self.send(200 if res.get("ok") else 400, res)
        except ValueError as e:
            return self.send(400, {"error": str(e)})
        return self.send(404, {"error": "unknown"})


def main():
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        sys.exit(f"port {PORT} is taken: is the writers' room already open? (WRITERS_PORT=8796 for another)")
    print(f"THE WRITERS' ROOM on http://127.0.0.1:{PORT}  (Ctrl+C stops it)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
