"""Measuring the user's takes (MiniMax videos, voice files): length, and the dead air at either end (plain Python).

`measure(path)` -> {"dur", "lead", "tail"} in seconds: the file's length and the silence before the first and
after the last sound, from 20 ms windows of the audio against a threshold. A .wav is read here; anything else
(.mp4, .mov, .mp3, .m4a) is decoded by ffmpeg (on the PATH; on Windows `winget install ffmpeg`).
`clean(clip, m)` writes the clip's `dur` and `trim` (the dead air cut, leaving a breath either side). The desk's
auto-clean does the same in the browser (Web Audio), with the same numbers.
"""
import array
import math
import shutil
import subprocess
import wave
from pathlib import Path

RATE = 16000          # Hz, mono, for the analysis
WIN = 0.02            # seconds a window
FLOOR_DB = -38.0      # a window quieter than this (RMS, dBFS) is silence
PAD_IN, PAD_OUT = 0.08, 0.15      # what the trim leaves before the first sound and after the last
MIN_TRIM = 0.05       # trims shorter than this aren't worth writing
AUDIO = (".wav", ".mp4", ".mov", ".mp3", ".m4a", ".webm")


def _wav_samples(path):
    with wave.open(str(path)) as w:
        n, ch, width, rate = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(n)
    if width != 2:
        return None, rate, n / float(rate)
    a = array.array("h", raw)
    if ch > 1:
        a = array.array("h", a[::ch])
    return a, rate, n / float(rate)


def _ffmpeg_samples(path):
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg isn't on the PATH (Windows: winget install ffmpeg): it reads the takes' audio")
    r = subprocess.run([exe, "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(RATE), "-f", "s16le", "-"],
                       capture_output=True)
    if r.returncode:
        raise RuntimeError(f"ffmpeg couldn't read {Path(path).name}: {r.stderr.decode(errors='replace')[-300:]}")
    a = array.array("h")
    a.frombytes(r.stdout[: len(r.stdout) // 2 * 2])
    dur = _probe_secs(path) or len(a) / float(RATE)
    return a, RATE, dur


def _probe_secs(path):
    exe = shutil.which("ffprobe")
    if not exe:
        return None
    r = subprocess.run([exe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def silence_ends(samples, rate, floor_db=FLOOR_DB):
    """(lead, tail): seconds of silence before the first and after the last window louder than floor_db."""
    w = max(1, int(rate * WIN))
    loud = []
    for i in range(0, len(samples) - w + 1, w):
        s = samples[i:i + w]
        rms = math.sqrt(sum(x * x for x in s) / len(s)) / 32768.0
        loud.append(20 * math.log10(rms) > floor_db if rms > 0 else False)
    if not any(loud):
        return 0.0, 0.0
    first = loud.index(True)
    last = len(loud) - 1 - loud[::-1].index(True)
    total = len(samples) / float(rate)
    return first * WIN, max(0.0, total - (last + 1) * WIN)


def measure(path):
    path = Path(path)
    if path.suffix.lower() == ".wav":
        a, rate, dur = _wav_samples(path)
        if a is None:                 # not 16-bit: ffmpeg reads it
            a, rate, dur = _ffmpeg_samples(path)
    else:
        a, rate, dur = _ffmpeg_samples(path)
    lead, tail = silence_ends(a, rate)
    return {"dur": round(dur, 2), "lead": round(lead, 2), "tail": round(tail, 2)}


def trim_for(m):
    """The trim the auto-clean writes for a measurement: the dead air less a breath either side."""
    t = {"in": round(max(0.0, m["lead"] - PAD_IN), 2), "out": round(max(0.0, m["tail"] - PAD_OUT), 2)}
    return {k: v for k, v in t.items() if v >= MIN_TRIM}


def clean(clip, m, keep_trim=False):
    """The clip's `dur` from the take and its `trim` from the dead air (a hand-set trim stays when keep_trim)."""
    clip["dur"] = m["dur"]
    if keep_trim and clip.get("trim"):
        return clip
    t = trim_for(m)
    if t:
        clip["trim"] = t
    else:
        clip.pop("trim", None)
    return clip
