"""The writers' room's Claude API worker: one request, from llm.ClaudeAPI, run by vendor/writers/venv's Python (the
official anthropic SDK; room.py setup installs it). Reads {model, effort, system, user, schema, kind, out} on stdin,
streams the answer (progress lines on stderr, `PROGRESS ...`), and writes {ok, data | error, usage, model} to `out`.

The credentials are the SDK's own: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile. The answer
is held to the stage's JSON schema (structured outputs); a request a safety classifier declines goes to Anthropic's
recommended fallback model server-side (fallbacks "default") on the models that take it.
"""
import json
import sys
import time

FALLBACK_MODELS = {"claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}


def progress(text):
    print("PROGRESS " + text, file=sys.stderr, flush=True)


def main():
    req = json.loads(sys.stdin.read())
    out = {"ok": False}
    try:
        import anthropic
    except ImportError:
        out["error"] = "the anthropic SDK isn't installed: python tools/writers/room.py setup"
        return finish(req, out)
    kind = req.get("kind", "answer")
    params = dict(model=req["model"], max_tokens=64000,
                  system=[{"type": "text", "text": req["system"], "cache_control": {"type": "ephemeral"}}],
                  messages=[{"role": "user", "content": req["user"]}],
                  output_config={"effort": req.get("effort", "high"), "format": {"type": "json_schema", "schema": req["schema"]}})
    if req["model"] in FALLBACK_MODELS:                 # a declined request is retried on the recommended model, server-side
        params.update(betas=["server-side-fallback-2026-07-01"], extra_body={"fallbacks": "default"})
    try:
        client = anthropic.Anthropic()
        n, last = 0, 0.0
        with client.beta.messages.stream(**params) as stream:
            for event in stream:
                if event.type == "content_block_start" and event.content_block.type == "thinking":
                    progress(f"Claude is thinking about the {kind}")
                elif event.type == "content_block_delta" and event.delta.type == "text_delta":
                    n += len(event.delta.text)
                    if time.time() - last > 0.5:
                        last = time.time()
                        progress(f"Claude is writing the {kind} ({n} characters)")
            msg = stream.get_final_message()
    except anthropic.AuthenticationError:
        out["error"] = "the API key was refused (ANTHROPIC_API_KEY, or `ant auth login`)"
        return finish(req, out)
    except anthropic.PermissionDeniedError as e:
        out["error"] = f"the key can't use this: {e.message}"
        return finish(req, out)
    except anthropic.NotFoundError:
        out["error"] = f"no model {req['model']!r} for this key"
        return finish(req, out)
    except anthropic.RateLimitError:
        out["error"] = "rate limited by the API: try again in a minute"
        return finish(req, out)
    except anthropic.APIStatusError as e:
        out["error"] = f"the API answered {e.status_code}: {e.message}"
        return finish(req, out)
    except anthropic.APIConnectionError:
        out["error"] = "the API can't be reached (the network?)"
        return finish(req, out)
    out["usage"] = {"input": msg.usage.input_tokens, "output": msg.usage.output_tokens,
                    "cache_read": getattr(msg.usage, "cache_read_input_tokens", 0) or 0}
    out["model"] = msg.model
    if msg.stop_reason == "refusal":
        cat = getattr(getattr(msg, "stop_details", None), "category", None)
        out["error"] = f"Claude declined this request{f' ({cat})' if cat else ''}: reword the brief and try again"
        return finish(req, out)
    if msg.stop_reason == "max_tokens":
        out["error"] = "the answer ran past its length: ask for less at once (one act at a time)"
        return finish(req, out)
    text = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        out["data"] = json.loads(text)
        out["ok"] = True
    except ValueError as e:
        out["error"] = f"the answer isn't JSON ({e})"
    return finish(req, out)


def finish(req, out):
    with open(req["out"], "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
