"""The writers' room's models (docs/WRITERS_ROOM.md §5): every backend answers ask(system, user, schema) with the JSON the
schema asks for. Claude through the API (the anthropic SDK, in its own environment: room.py setup), Claude through
Claude Code (`claude -p`, your Claude Code login), a local model through Ollama (setup/scriptgen.json's), or the
stand-in the checks use. Plain Python; the API's worker (claude_api.py) runs in vendor/writers/venv.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VENV = ROOT / "vendor" / "writers" / "venv"
SETTINGS = ROOT / "Saved" / "Writers" / "settings.json"
CLI_DIR = ROOT / "Saved" / "Writers" / "cli"          # Claude Code runs from here: an empty folder, no project to read
SCRIPTGEN = ROOT / "setup" / "scriptgen.json"
DEFAULTS = {"backend": "claude", "claude_via": "auto", "model": "claude-opus-5-5", "effort": "high",
            "ollama": {"url": "http://127.0.0.1:11434", "model": "qwen3.6:27b", "num_ctx": 32768, "temperature": 0.8, "timeout": 900}}
CODE_MODEL = {"claude-opus-5-5": "opus", "claude-sonnet-5-5": "sonnet", "claude-fable-5-1": "fable"}   # Claude Code's aliases


class ModelError(Exception):
    pass


def venv_python():
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def settings():
    s = json.loads(json.dumps(DEFAULTS))
    try:                                                # the local model the script generator uses, unless set here
        g = {k: v for k, v in json.loads(SCRIPTGEN.read_text(encoding="utf-8")).items() if not k.startswith("_")}
        s["ollama"].update({k: g[k] for k in ("url", "model", "num_ctx", "temperature") if k in g})
    except (OSError, ValueError):
        pass
    try:
        mine = json.loads(SETTINGS.read_text(encoding="utf-8"))
        s.update({k: v for k, v in mine.items() if k != "ollama"})
        s["ollama"].update(mine.get("ollama") or {})
    except (OSError, ValueError):
        pass
    return s


def save_settings(s):
    SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS.write_text(json.dumps(s, indent=1), encoding="utf-8")


def strict(schema):
    """A schema as structured outputs want it: every object closed (additionalProperties false) and every property
    required (an optional one is written as nullable instead)."""
    if isinstance(schema, dict):
        out = {k: strict(v) for k, v in schema.items()}
        if out.get("type") == "object" and "properties" in out:
            out["additionalProperties"] = False
            out["required"] = list(out["properties"])
        return out
    if isinstance(schema, list):
        return [strict(x) for x in schema]
    return schema


# ---- the backends ------------------------------------------------------------------------------------------------

class Fake:
    """The stand-in: answers from gen.fake (deterministic), for the checks and the page's test."""
    name, label = "fake", "the stand-in (tests)"

    def __init__(self, answer):
        self.answer = answer

    def ask(self, system, user, schema, kind, progress=None):
        if progress:
            progress(f"the stand-in writes the {kind}")
        time.sleep(float(os.environ.get("WRITERS_FAKE_DELAY", "0")))
        return self.answer(kind, user)


class Ollama:
    name, label = "local", "a local model (Ollama)"

    def __init__(self, o):
        self.o = o

    def ask(self, system, user, schema, kind, progress=None):
        body = {"model": self.o["model"], "stream": True, "format": schema,
                "options": {"num_ctx": self.o.get("num_ctx", 32768), "temperature": self.o.get("temperature", 0.8)},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        req = urllib.request.Request(self.o["url"].rstrip("/") + "/api/chat", data=json.dumps(body).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
        text, last = [], 0.0
        try:
            with urllib.request.urlopen(req, timeout=self.o.get("timeout", 900)) as r:
                for line in r:
                    if not line.strip():
                        continue
                    ev = json.loads(line)
                    if ev.get("error"):
                        raise ModelError(f"Ollama: {ev['error']}")
                    text.append((ev.get("message") or {}).get("content", ""))
                    if progress and time.time() - last > 0.5:
                        last = time.time()
                        progress(f"{self.o['model']} is writing the {kind} ({sum(map(len, text))} characters)")
        except urllib.error.URLError as e:
            raise ModelError(f"no answer from Ollama at {self.o['url']} ({e.reason}): is it running? (ollama serve; the model: ollama pull {self.o['model']})")
        return parse_json("".join(text), "the local model")


class ClaudeCode:
    """Claude through Claude Code's command line: your Claude Code login, no API key. Its own system prompt, no tools,
    the JSON checked against the schema by Claude Code, from an empty folder so no project's files come into it."""
    name, label = "claude-code", "Claude, through Claude Code"

    def __init__(self, model, effort):
        self.model, self.effort = CODE_MODEL.get(model, model), effort

    def ask(self, system, user, schema, kind, progress=None):
        exe = shutil.which("claude")
        if not exe:
            raise ModelError("Claude Code isn't installed here (the `claude` command): install it, or set an API key")
        CLI_DIR.mkdir(parents=True, exist_ok=True)
        args = [exe, "-p", "--output-format", "json", "--json-schema", json.dumps(schema), "--system-prompt", system,
                "--tools", "", "--no-session-persistence", "--model", self.model, "--effort", self.effort, "--safe-mode"]
        if progress:
            progress(f"Claude ({self.model}, through Claude Code) is writing the {kind}")
        t0 = time.time()
        with tempfile.TemporaryFile("w+", encoding="utf-8") as fo, tempfile.TemporaryFile("w+", encoding="utf-8") as fe:
            p = subprocess.Popen(args, cwd=CLI_DIR, stdin=subprocess.PIPE, stdout=fo, stderr=fe, text=True, encoding="utf-8")
            try:
                p.stdin.write(user)
                p.stdin.close()
                while p.poll() is None:                   # the elapsed time while it writes (it sends no stream here)
                    time.sleep(1.0)
                    if progress:
                        progress(f"Claude ({self.model}, through Claude Code) is writing the {kind} ({time.time() - t0:.0f} s)")
                    if time.time() - t0 > 1800:
                        raise ModelError("Claude Code took over 30 minutes; stopped")
            finally:
                if p.poll() is None:
                    p.kill()
            fo.seek(0)
            fe.seek(0)
            out, err = fo.read(), fe.read()
        try:
            res = json.loads(out)
        except (TypeError, ValueError):
            raise ModelError(f"Claude Code answered with no JSON: {(err or out or '')[-400:]}")
        if res.get("is_error") or res.get("subtype") not in (None, "success"):
            raise ModelError(f"Claude Code: {res.get('result') or res.get('subtype') or 'failed'}")
        if res.get("structured_output") is not None:
            return res["structured_output"]
        return parse_json(res.get("result", ""), "Claude Code")


class ClaudeAPI:
    """Claude through the API with the official SDK, run by claude_api.py in vendor/writers/venv (room.py setup)."""
    name, label = "claude-api", "Claude, through the API"

    def __init__(self, model, effort):
        self.model, self.effort = model, effort

    def ask(self, system, user, schema, kind, progress=None):
        py = venv_python()
        if not py.exists():
            raise ModelError("the anthropic SDK isn't set up: python tools/writers/room.py setup")
        with tempfile.TemporaryDirectory() as tmp:
            res_file = Path(tmp) / "result.json"
            req = {"model": self.model, "effort": self.effort, "system": system, "user": user, "schema": schema, "kind": kind,
                   "out": str(res_file)}
            p = subprocess.Popen([str(py), str(HERE / "claude_api.py")], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                 stderr=subprocess.PIPE, text=True, encoding="utf-8")
            p.stdin.write(json.dumps(req))
            p.stdin.close()
            tail = []
            for line in p.stderr:                         # progress lines while it streams (the answer goes to a file)
                line = line.rstrip()
                if line.startswith("PROGRESS ") and progress:
                    progress(line[9:])
                elif line:
                    tail = (tail + [line])[-20:]
            p.wait()
            try:
                res = json.loads(res_file.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                raise ModelError("the API worker failed: " + " / ".join(tail[-6:]))
        if not res.get("ok"):
            raise ModelError(res.get("error") or "the API worker failed")
        return res["data"]


def api_ready():
    """Whether the API can be used: the SDK set up, and a key (or an `ant auth login` profile) to use it with."""
    if not venv_python().exists():
        return False, "not set up: python tools/writers/room.py setup"
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True, "an API key"
    if (Path.home() / ".config" / "anthropic").is_dir():
        return True, "an `ant auth login` profile"
    return False, "no ANTHROPIC_API_KEY (or `ant auth login`)"


def ollama_models(url, timeout=2.0):
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/api/tags", timeout=timeout) as r:
            return [m["name"] for m in json.loads(r.read().decode("utf-8")).get("models", [])]
    except (urllib.error.URLError, OSError, ValueError):
        return None


def status(s=None):
    """What each backend needs, and whether it has it: shown in the page's settings."""
    s = s or settings()
    ok, why = api_ready()
    models = ollama_models(s["ollama"]["url"])
    return {"claude-api": {"ok": ok, "why": why}, "claude-code": {"ok": bool(shutil.which("claude")), "why": "the claude command" if shutil.which("claude") else "Claude Code isn't installed"},
            "local": {"ok": bool(models and any(m.split(":")[0] == s["ollama"]["model"].split(":")[0] for m in models)),
                      "why": (f"Ollama answers; models: {', '.join(models) or 'none'}" if models is not None else f"Ollama isn't answering at {s['ollama']['url']}"),
                      "models": models or []}}


def backend(s=None, fake=None):
    """The backend the settings pick: Claude (the API when it's set up and has a key, else Claude Code), or local."""
    s = s or settings()
    if s.get("backend") == "fake":
        if not fake:
            raise ModelError("the stand-in needs its answers")
        return Fake(fake)
    if s.get("backend") == "local":
        return Ollama(s["ollama"])
    via = s.get("claude_via", "auto")
    if via == "api" or (via == "auto" and api_ready()[0]):
        return ClaudeAPI(s["model"], s["effort"])
    return ClaudeCode(s["model"], s["effort"])


def parse_json(text, who):
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[t.find("{"):]
    i, j = t.find("{"), t.rfind("}")
    try:
        return json.loads(t[i:j + 1] if i >= 0 else t)
    except ValueError as e:
        raise ModelError(f"{who} answered with JSON that doesn't read ({e}): {t[:200]}")
