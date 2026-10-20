#!/usr/bin/env python3
"""Placeholder voices before the real takes exist: Windows' own speech (SAPI) reads every clip and line that has no
take yet, into Footage/<Game>/placeholder/<take id>.wav, and writes its length as `dur_tts` (never `dur`, which
means a real take). The greybox then plays with sound and honest timing; the real takes replace them by name.

    python tools/voice_placeholder.py --game Pilot [--lang ja|en]

Japanese needs a Japanese voice installed (Settings > Time & language > Speech > Add voices: Japanese, e.g. Haruka);
without one it reads the English. Windows only. V0: written before it ever ran.
"""
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

PS = r"""
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like '{lang}*' } | Select-Object -First 1
if ($v) { $s.SelectVoice($v.VoiceInfo.Name) } else { Write-Output 'NOVOICE' }
$items = Get-Content -Raw -Encoding UTF8 '{list}' | ConvertFrom-Json
foreach ($it in $items) { $s.SetOutputToWaveFile($it.out); $s.Speak($it.text) }
$s.SetOutputToNull()
"""


def main():
    game, args = L.pick_game(sys.argv[1:])
    lang = args[args.index("--lang") + 1] if "--lang" in args else "ja"
    story, spath = L.load(game)
    game = spath.parent.name
    out = ROOT / "Footage" / game / "placeholder"
    out.mkdir(parents=True, exist_ok=True)
    todo = []
    for sid, sc in story.get("scenes", {}).items():
        vs = sc.get("variants") or {}
        for k, ver in ([(None, sc)] if not vs else list(vs.items())):
            for c in ver.get("clips", []):
                if not c.get("dur"):
                    todo.append((f"{game}_{sid}_{k or 'main'}_{c['id']}", c))
    for k, ln in story.get("lines", {}).items():
        if not ln.get("dur"):
            todo.append((k, ln))
    items = [{"out": str(out / f"{tid}.wav"), "text": c.get(lang) or c.get("en", "")} for tid, c in todo]
    lst = Path(tempfile.gettempdir()) / "voice_placeholder.json"
    lst.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    r = subprocess.run(["powershell", "-NoProfile", "-Command", PS.replace("{lang}", lang).replace("{list}", str(lst))],
                       capture_output=True, text=True)
    if "NOVOICE" in r.stdout:
        print(f"no {lang} voice installed: it read with the default voice")
    n = 0
    for tid, c in todo:
        f = out / f"{tid}.wav"
        if f.exists():
            with wave.open(str(f)) as w:
                c["dur_tts"] = round(w.getnframes() / w.getframerate(), 2)
            n += 1
    spath.write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"VOICE {n}/{len(todo)} placeholders -> {out}" + (f" ({r.stderr.strip()[:200]})" if r.returncode else ""))


if __name__ == "__main__":
    main()
