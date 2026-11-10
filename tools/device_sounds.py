"""The devices plugin's sounds, made from nothing (numpy, then ffmpeg for the Ogg; DECISIONS 2026-11-10, later still):
the laptop's terminal. A blip (a button pressed: a short square-ish beep through a small speaker), a tick (the pointer
over a thing), a key (a laptop key: a soft plastic click and its bottoming out), the order going through (three notes
up), an error (a low double buzz), the boot (the fan spinning up under a rising beep), waking (the lid's hinge and the
screen's high whine coming on), sleep (the whine falling away), and a hum (the coil's whine and the fan's air, a loop).
Each mono, quiet by design (the laptop plays them in the room through AudioStreamPlayer3D), each from its own seed.

    python tools/device_sounds.py [--out DIR]     (default GodotPlugins/HorrorStudioDevices/addons/horrorstudio_devices/sounds)
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from weapon_sounds import SR, band, decay, t_, write  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "GodotPlugins" / "HorrorStudioDevices" / "addons" / "horrorstudio_devices" / "sounds"


def beep(t, f, at, length, amp=1.0, soft=0.004):
    """A small speaker's beep: a square-ish tone (its odd partials rolled off) with soft edges."""
    on = np.clip((t - at) / soft, 0, 1) * np.clip((at + length - t) / soft, 0, 1)
    ph = 2 * np.pi * f * (t - at)
    x = np.sin(ph) + 0.28 * np.sin(3 * ph) + 0.1 * np.sin(5 * ph)
    return amp * on * x


def click(t, at, lo, hi, tau, amp, rng):
    return amp * band(rng.standard_normal(len(t)), lo, hi) * decay(t, tau, at, 0.0003)


def blip(rng):
    t = t_(0.09)
    return band(beep(t, 1320, 0.0, 0.055), 400, 6000)


def tick(rng):
    t = t_(0.05)
    return beep(t, 2200, 0.0, 0.012, 0.6) + click(t, 0.0, 2500, 9000, 0.003, 0.4, rng)


def key(rng):
    t = t_(0.12)
    x = click(t, 0.0, 1800, 7000, 0.004, 1.0, rng)                    # the cap's plastic
    x += click(t, 0.018, 300, 2600, 0.012, 0.7, rng)                  # bottoming out on the deck
    x += click(t, 0.075, 1500, 6000, 0.003, 0.35, rng)                # coming back up
    return x


def order(rng):
    t = t_(0.62)
    x = beep(t, 880, 0.0, 0.11) + beep(t, 1175, 0.13, 0.11) + beep(t, 1760, 0.26, 0.26)
    return band(x, 300, 7000) * (0.85 + 0.15 * np.cos(2 * np.pi * 6 * t))


def error(rng):
    t = t_(0.42)
    x = beep(t, 165, 0.0, 0.14) + beep(t, 155, 0.2, 0.17)
    return band(x * (1 + 0.4 * np.sign(np.sin(2 * np.pi * 50 * t))), 80, 3500)


def fan(t, start, rng, rise=0.8):
    """The fan's air: noise in a band whose middle climbs as it spins up, and its blade tone."""
    k = np.clip((t - start) / rise, 0, 1)
    air = band(rng.standard_normal(len(t)), 250, 2600) * (0.15 + 0.85 * k)
    f = 60 + 140 * k
    blade = 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR) * k
    return (air * 0.5 + blade) * (t >= start)


def boot(rng):
    t = t_(1.8)
    x = 0.5 * fan(t, 0.05, rng, 1.2)
    x += beep(t, 660, 0.35, 0.09, 0.8) + beep(t, 990, 0.5, 0.18, 0.8)
    x += click(t, 0.0, 200, 3000, 0.02, 0.8, rng)                     # the relay
    return x * np.clip((1.8 - t) / 0.3, 0, 1)


def whine(t, f0, f1):
    f = f0 + (f1 - f0) * t / t[-1]
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def wake(rng):
    t = t_(0.7)
    x = click(t, 0.0, 120, 1500, 0.06, 0.9, rng)                      # the lid's hinge
    x += click(t, 0.03, 700, 4000, 0.02, 0.4, rng)
    x += 0.06 * whine(t, 9000, 11500) * np.clip((t - 0.1) / 0.4, 0, 1)
    return x


def sleep(rng):
    t = t_(0.6)
    return 0.08 * whine(t, 11500, 6000) * np.clip(1 - t / 0.6, 0, 1) + click(t, 0.0, 600, 4000, 0.01, 0.4, rng)


def hum(rng):
    """Four seconds that loop: the coil's whine (its partials beating slowly) and the fan's air (made circular by
    filtering a whole loop of noise at once: the end runs into the start)."""
    t = t_(4.0)
    x = 0.05 * np.sin(2 * np.pi * 10500 * t) + 0.03 * np.sin(2 * np.pi * 10500.5 * t)
    air = band(rng.standard_normal(len(t)), 300, 2200)
    x += 0.35 * air / max(np.abs(air).max(), 1e-9)
    x += 0.12 * np.sin(2 * np.pi * 120 * t)
    return x


SOUNDS = {"blip": (blip, -6.0), "tick": (tick, -14.0), "key": (key, -9.0), "order": (order, -5.0), "error": (error, -6.0),
          "boot": (boot, -6.0), "wake": (wake, -9.0), "sleep": (sleep, -12.0), "hum": (hum, -24.0)}
SEEDS = {n: i for i, n in enumerate(SOUNDS)}


def main():
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else OUT
    out.mkdir(parents=True, exist_ok=True)
    for name, (fn, peak) in SOUNDS.items():
        x = fn(np.random.default_rng(2000 + SEEDS[name]))
        if name == "hum":                                 # a loop: no fade at its ends
            x = x / max(np.abs(x).max(), 1e-9) * 10 ** (peak / 20)
            import tempfile
            import subprocess
            import wave
            with tempfile.TemporaryDirectory() as d:
                w = Path(d) / "a.wav"
                with wave.open(str(w), "wb") as f:
                    f.setnchannels(1)
                    f.setsampwidth(2)
                    f.setframerate(SR)
                    f.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
                r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(w), "-c:a", "libvorbis", "-q:a", "5",
                                    "-fflags", "+bitexact", "-flags:a", "+bitexact", str(out / "hum.ogg")], capture_output=True, text=True)
                if r.returncode:
                    sys.exit("ffmpeg: " + r.stderr[-400:])
        else:
            write(out / f"{name}.ogg", x, peak)
        print(f"  {name}.ogg {len(x) / SR:.2f} s")
    print(f"DEVICESOUNDS ok ({len(SOUNDS)} into {out})")


if __name__ == "__main__":
    main()
