#!/usr/bin/env python3
"""Every check that needs a browser, one after another, with the servers they need (docs/RUN_LOCALLY.md).

    python tools/browser_checks.py                  every one, on the graphics card when there is one (GPU=1)
    python tools/browser_checks.py PLAY STUDIO      only these, in this order (commas or spaces)
    python tools/browser_checks.py --quick          leave out the ones that take most of an hour on a CPU
    python tools/browser_checks.py --list           what there is, the server each needs, which are long
    python tools/browser_checks.py --cpu            no card: SwiftShader, as in the cloud
    python tools/browser_checks.py --gpu egl        another of tools/browser.cjs's modes (1, egl, headed)

It starts the desk (8780) or the Character Studio (8793) when a check needs one and nothing answers there, and stops
only what it started, as soon as no check left needs it. A server that was already running keeps the code it started
with, so after a pull it says to restart it. Playwright is found as the checks find it (PLAYWRIGHT, NODE_PATH), and
when neither is set it tries `npm root -g` before giving up with how to install it.

Each check's whole output goes to Saved/browser_checks/<time>/<NAME>.log and its lines show as it runs (--quiet: one
line a check). At the end, one line a check and report.md beside the logs: for each its last line, how long it took,
the GL: line (which renderer WebGL got) and any picture a failure left, which is what the cloud session asks to be
pasted back. Ends `BROWSER ok` or `BROWSER FAILED`.
"""
import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Saved" / "browser_checks"
WIN = os.name == "nt"

# the servers the checks talk to: the script, its port, the environment variable a check takes another address from
SERVERS = {
    "desk": ("tools/director/serve.py", 8780, "DESK_URL"),
    "studio": ("tools/character/serve.py", 8793, "BODY_URL"),
    "score": ("tools/score/serve.py", 8791, "SCORE_URL"),
}

# (name, the script, the server it needs or None (it starts its own or needs none), long on a CPU, a note (what it needs)
CHECKS = [
    ("DASH", "tools/dashboard/dashtest.mjs", None, False, ""),
    ("WRITERSPAGE", "tools/writers/pagetest.mjs", None, False, ""),
    ("ANIMATORPAGE", "tools/animator/pagetest.mjs", None, False, ""),
    ("FACEMOCAP", "tools/facecap/pagetest.mjs", None, False, ""),
    ("MANAGERPAGE", "tools/director_manager/pagetest.mjs", None, False, ""),
    ("SCOREPAGE", "tools/score/pagetest.js", "score", False, ""),
    ("PROPPAGE", "tools/propgen/pagetest.mjs", None, False, "needs Blender"),
    ("PLAY", "tools/director/playtest.js", "desk", False, ""),
    ("TIMES", "tools/director/timetest.js", "desk", False, ""),
    ("MODELS", "tools/director/modelstest.js", "desk", False, ""),
    ("EXPRESSIONS", "tools/director/exprtest.mjs", "desk", False, ""),
    ("BUILDER", "tools/director/buildertest.js", "desk", False, ""),
    ("STREETPAGE", "tools/director/streettest.mjs", "desk", False, ""),
    ("PAINT", "tools/director/painttest.mjs", "desk", False, ""),
    ("FACEPAGE", "tools/director/facetest.js", "desk", False, "needs MediaPipe (python tools/face_mesh.py setup)"),
    ("PEOPLE", "tools/director/peopletest.js", "desk", False, "needs a Studio export (STUDIO makes one)"),
    ("TESTROOM", "tools/director/testroom.mjs", "desk", True, ""),
    ("GUIDE", "tools/director/guide_shots.mjs", "desk", True, "writes the desk guide's pictures (tools/director/guide/)"),
    ("WARDROBE", "tools/character/wardrobetest.mjs", "studio", False, ""),
    ("GPUDRAPE", "tools/character/tailor/gputest.mjs", "studio", False, "needs WebGPU"),
    ("GROOM", "tools/character/groomtest.mjs", "studio", False, ""),
    ("LIBRARYPAGE", "tools/character/librarypagetest.mjs", "studio", False, ""),
    ("SALON", "tools/character/salontest.js", "studio", True, ""),
    ("GROWPAGE", "tools/character/growpagetest.mjs", "studio", True, ""),
    ("HAIR2PAGE", "tools/character/hair2pagetest.mjs", "studio", True, ""),
    ("STUDIO", "tools/character/studiotest.js", "studio", True, "needs MediaPipe (python tools/face_mesh.py setup)"),
]
BY_NAME = {c[0]: c for c in CHECKS}


def say(text):
    print(text, flush=True)


def answers(port, timeout=2.0):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/" % port, timeout=timeout) as r:
            return 200 <= r.status < 500
    except Exception as e:                                       # an HTTP error page still means something answers
        return hasattr(e, "code")


def start_server(kind, logdir):
    script, port, _ = SERVERS[kind]
    log = open(logdir / ("_%s_server.log" % kind), "w", encoding="utf-8")
    kw = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WIN else {"start_new_session": True}
    p = subprocess.Popen([sys.executable, str(ROOT / script)], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, **kw)
    for _ in range(180):                                         # 90 s: the Studio reads its bodies first
        if p.poll() is not None:
            raise RuntimeError("the %s's server stopped as it started: %s" % (kind, logdir / ("_%s_server.log" % kind)))
        if answers(port, 0.5):
            return p
        time.sleep(0.5)
    stop_group(p)
    raise RuntimeError("the %s's server didn't answer on port %d in 90 s" % (kind, port))


def stop_group(p):
    if p.poll() is not None:
        return
    try:
        if WIN:
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True)
        else:
            os.killpg(p.pid, signal.SIGTERM)
            for _ in range(30):
                if p.poll() is not None:
                    return
                time.sleep(0.1)
            os.killpg(p.pid, signal.SIGKILL)
    except OSError:
        pass


def gpu_mode(args):
    if args.cpu:
        return ""
    if args.gpu:
        return args.gpu
    if os.environ.get("GPU"):
        return os.environ["GPU"]
    smi = shutil.which("nvidia-smi")
    if smi and subprocess.run([smi, "-L"], capture_output=True).returncode == 0:
        return "1"
    return ""


def playwright_env(env):
    """The environment in which `require('playwright')` works from the project folder, or None."""
    node = shutil.which("node")
    if not node:
        return None
    probe = ("require(process.env.PLAYWRIGHT || 'playwright')",)

    def works(e):
        return subprocess.run([node, "-e", probe[0]], cwd=ROOT, env=e, capture_output=True).returncode == 0

    if works(env):
        return env
    if not env.get("PLAYWRIGHT") and not env.get("NODE_PATH") and shutil.which("npm"):
        root = subprocess.run([shutil.which("npm"), "root", "-g"], capture_output=True, text=True).stdout.strip()
        if root:
            e = dict(env, NODE_PATH=root)
            if works(e):
                return e
    return None


def fail_pictures(since):
    found = []
    for base, deep in ((ROOT, False), (ROOT / "Saved", True)):
        if not base.is_dir():
            continue
        for p in (base.rglob("*fail*.png") if deep else base.glob("*fail*.png")):
            try:
                if p.stat().st_mtime >= since:
                    found.append(p.relative_to(ROOT).as_posix())
            except OSError:
                pass
    return sorted(found)


def run_check(name, script, env, logdir, quiet, timeout_s):
    log_path = logdir / (name + ".log")
    t0 = time.time()
    kw = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WIN else {"start_new_session": True}
    lines, gl, status = [], "", "FAIL"
    with open(log_path, "w", encoding="utf-8") as log:
        p = subprocess.Popen(["node", str(ROOT / script)], cwd=ROOT, env=env, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", bufsize=1, **kw)
        try:
            for ln in p.stdout:
                log.write(ln)
                ln = ln.rstrip("\n")
                if ln.strip():
                    lines.append(ln)
                    if not gl and ln.startswith("GL:"):
                        gl = ln[3:].strip()
                    if not quiet:
                        say("  │ " + ln[:220])
                if time.time() - t0 > timeout_s:
                    status = "TIMEOUT"
                    break
            if status == "TIMEOUT":
                stop_group(p)
            p.wait()
        except KeyboardInterrupt:
            stop_group(p)
            raise
    last = lines[-1] if lines else "(no output)"
    if status != "TIMEOUT":
        ok = p.returncode == 0 and any(ln.strip().startswith(name + " ok") for ln in lines[-20:])
        status = "ok" if ok else "FAIL"
    fails = [ln for ln in lines if ln.lstrip().startswith(("FAIL", "ERROR", "Error", "TypeError"))][:20]
    return {"name": name, "status": status, "secs": time.time() - t0, "last": last, "gl": gl, "fails": fails,
            "log": log_path.relative_to(ROOT).as_posix(), "pictures": fail_pictures(t0) if status != "ok" else []}


def git(*a):
    try:
        return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except OSError:
        return "?"


def minutes(s):
    return "%d:%02d" % (s // 60, s % 60)


def report(results, mode, logdir, skipped):
    head = "Browser checks on `%s` (%s), %s, %s" % (git("rev-parse", "--abbrev-ref", "HEAD"), git("rev-parse", "--short", "HEAD"),
                                                  "GPU=" + mode if mode else "on the CPU (SwiftShader)", time.strftime("%Y-%m-%d %H:%M"))
    out = [head, "", "| Check | Result | Time | GL |", "|---|---|---|---|"]
    for r in results:
        out.append("| %s | %s | %s | %s |" % (r["name"], r["last"].replace("|", "/")[:160], minutes(r["secs"]), r["gl"] or "-"))
    for r in results:
        if r["status"] != "ok":
            out += ["", "**%s %s** (log: `%s`)" % (r["name"], r["status"], r["log"])]
            out += ["    " + ln for ln in r["fails"]] or ["    " + r["last"]]
            out += ["    picture: `%s`" % p for p in r["pictures"]]
    if skipped:
        out += ["", "Not run: " + ", ".join(skipped)]
    text = "\n".join(out) + "\n"
    (logdir / "report.md").write_text(text, "utf-8")
    return text


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("only", nargs="*", help="check names (STUDIO, PLAY...), spaces or commas between")
    ap.add_argument("--list", action="store_true", help="the checks, their servers, which are long, then exit")
    ap.add_argument("--quick", action="store_true", help="leave out the ones that take most of an hour on a CPU")
    ap.add_argument("--cpu", action="store_true", help="draw on the CPU (SwiftShader) even when there's a card")
    ap.add_argument("--gpu", choices=["1", "egl", "headed"], help="tools/browser.cjs's mode (default: GPU, else 1 with an NVIDIA card)")
    ap.add_argument("--quiet", action="store_true", help="one line a check, not their output")
    ap.add_argument("--timeout", type=float, default=120, help="minutes a check may take (default 120)")
    args = ap.parse_args()

    if args.list:
        for name, script, server, long, needs in CHECKS:
            say("%-13s %-40s %-7s %s%s" % (name, script, server or "-", "long" if long else "", ("  " + needs) if needs else ""))
        return 0
    wanted = [w.strip().upper() for a in args.only for w in a.replace(",", " ").split() if w.strip()]
    unknown = [w for w in wanted if w not in BY_NAME]
    if unknown:
        say("No browser check called %s (python tools/browser_checks.py --list)." % ", ".join(unknown))
        say("BROWSER FAILED")
        return 2
    todo = [BY_NAME[w] for w in wanted] if wanted else [c for c in CHECKS if not (args.quick and c[3])]
    skipped = [] if wanted else [c[0] for c in CHECKS if args.quick and c[3]]

    mode = gpu_mode(args)
    env = dict(os.environ)
    env.pop("GPU", None)
    if mode:
        env["GPU"] = mode
    env = playwright_env(env)
    if env is None:
        say("Playwright isn't found from the project folder. Once per machine (docs/RUN_LOCALLY.md, step 2):")
        say("  npm install -g playwright && npx playwright install chromium")
        say("  export NODE_PATH=\"$(npm root -g)\"   (or PLAYWRIGHT=<the playwright package's folder>)")
        say("BROWSER FAILED")
        return 2
    logdir = OUT / time.strftime("%Y-%m-%d_%H%M%S")
    logdir.mkdir(parents=True, exist_ok=True)
    say("%d browser check%s, %s; logs in %s" % (len(todo), "" if len(todo) == 1 else "s",
                                                "GPU=" + mode if mode else "on the CPU (SwiftShader: slow, as in the cloud)",
                                                logdir.relative_to(ROOT).as_posix()))

    started, results, told = {}, [], set()
    try:
        for i, (name, script, server, _long, needs) in enumerate(todo):
            if server:
                _, port, _ = SERVERS[server]
                if server in started or server in told:
                    pass
                elif answers(port):
                    told.add(server)
                    say("· the %s was already running on port %d: it keeps the code it started with (restart it after a pull)" % (server, port))
                else:
                    say("· starting the %s (port %d)" % (server, port))
                    try:
                        started[server] = start_server(server, logdir)
                    except RuntimeError as e:
                        say("FAIL  %s: %s" % (name, e))
                        results.append({"name": name, "status": "FAIL", "secs": 0, "last": str(e), "gl": "", "fails": [str(e)],
                                        "log": (logdir / ("_%s_server.log" % server)).relative_to(ROOT).as_posix(), "pictures": []})
                        continue
            say("▶ %s%s" % (name, ("  (" + needs + ")") if needs else ""))
            r = run_check(name, script, env, logdir, args.quiet, args.timeout * 60)
            results.append(r)
            say("%s  %-13s %6s  %s" % ("ok  " if r["status"] == "ok" else r["status"][:4].ljust(4), name, minutes(r["secs"]), r["last"][:150]))
            for kind in list(started):                           # a server no check left needs is stopped now
                if not any(c[2] == kind for c in todo[i + 1:]):
                    stop_group(started.pop(kind))
                    say("· stopped the %s" % kind)
    except KeyboardInterrupt:
        say("stopped by Ctrl+C")
    finally:
        for p in started.values():
            stop_group(p)
    done = {r["name"] for r in results}
    text = report(results, mode, logdir, skipped + [c[0] for c in todo if c[0] not in done])
    say("")
    say(text)
    say("The report: %s" % (logdir / "report.md").relative_to(ROOT).as_posix())
    bad = [r for r in results if r["status"] != "ok"] or len(done) < len(todo)
    say("BROWSER FAILED" if bad else "BROWSER ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
