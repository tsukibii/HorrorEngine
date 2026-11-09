"""The weapons plugin's sounds, made from nothing (numpy, then ffmpeg for the Ogg; DECISIONS 2026-11-09): a 12-gauge's
blast, its pump racked back and run forward, a shell pushed into the loading port, the dry click on an empty chamber,
a spent hull dropping on the floor, the gun raised and lowered, a box of shells picked up. Each is mono (the Sound node places it in the room and
the sound physics give it the room's reverb, so the blast carries no room of its own: a short tail only).

    python tools/weapon_sounds.py [--out DIR]     (default GodotPlugins/HorrorStudioWeapons/addons/horrorstudio_weapons/sounds)
"""
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "GodotPlugins" / "HorrorStudioWeapons" / "addons" / "horrorstudio_weapons" / "sounds"
SR = 44100


def t_(secs):
    return np.arange(int(secs * SR)) / SR


def band(x, lo, hi, tilt=0.0):
    """x filtered to lo..hi Hz in the frequency domain (smooth edges, `tilt` dB an octave above lo)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / (1 + (lo / np.maximum(f, 1.0)) ** 4) / (1 + (f / hi) ** 4)
    if tilt:
        g *= (np.maximum(f, lo) / lo) ** (tilt / 6.02)
    return np.fft.irfft(X * g, len(x))


def decay(t, tau, at=0.0, attack=0.0005):
    """An envelope rising over `attack` from `at`, then falling with time constant `tau`."""
    s = t - at
    e = np.where(s < 0, 0.0, np.where(s < attack, s / max(attack, 1e-6), np.exp(-(s - attack) / tau)))
    return e


def modes(t, at, freqs, taus, amps, rng):
    """Struck metal (or plastic): damped sines from `at`, each with a random phase."""
    out = np.zeros_like(t)
    for f, tau, a in zip(freqs, taus, amps):
        ph = rng.uniform(0, 2 * np.pi)
        out += a * np.sin(2 * np.pi * f * (t - at) + ph) * decay(t, tau, at, 0.0002)
    return out


def tick(t, at, lo, hi, tau, amp, rng):
    return amp * band(rng.standard_normal(len(t)), lo, hi) * decay(t, tau, at, 0.0002)


def blast(rng):
    t = t_(1.3)
    crack = band(rng.standard_normal(len(t)), 900, 9000) * decay(t, 0.006, 0, 0.0002)
    body = band(rng.standard_normal(len(t)), 70, 1600) * decay(t, 0.055, 0, 0.0003)
    f = 95 * np.exp(-t / 0.08) + 42                                    # the thump, its pitch falling
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(t, 0.10, 0, 0.001)
    tail = band(rng.standard_normal(len(t)), 40, 700) * decay(t, 0.32, 0.01, 0.01)
    x = 1.0 * crack / np.abs(crack).max() + 0.9 * body / np.abs(body).max() + 0.85 * thump + 0.22 * tail / np.abs(tail).max()
    return np.tanh(1.8 * x)


def pump_back(rng):
    t = t_(0.26)
    x = modes(t, 0.002, [2300, 3650, 5150], [0.022, 0.016, 0.010], [0.55, 0.4, 0.3], rng) + tick(t, 0.002, 2000, 9000, 0.003, 0.5, rng)
    slide = band(rng.standard_normal(len(t)), 1500, 6500) * np.clip(np.sin(np.pi * np.clip((t - 0.012) / 0.11, 0, 1)), 0, 1) * 0.16
    x += slide / max(np.abs(slide).max(), 1e-9) * 0.16
    x += modes(t, 0.128, [1350, 2580, 4120, 6150], [0.040, 0.030, 0.020, 0.012], [0.8, 0.6, 0.4, 0.25], rng)
    x += tick(t, 0.128, 1800, 9000, 0.004, 0.7, rng) + tick(t, 0.128, 140, 600, 0.016, 0.6, rng)
    return x


def pump_forward(rng):
    t = t_(0.24)
    slide = band(rng.standard_normal(len(t)), 1300, 6000) * np.clip(np.sin(np.pi * np.clip(t / 0.095, 0, 1)), 0, 1)
    x = slide / max(np.abs(slide).max(), 1e-9) * 0.15
    x += modes(t, 0.098, [1180, 2240, 3480, 5600], [0.045, 0.034, 0.022, 0.013], [0.9, 0.65, 0.45, 0.25], rng)
    x += tick(t, 0.098, 1500, 9000, 0.004, 0.8, rng) + tick(t, 0.098, 110, 520, 0.020, 0.75, rng)
    return x


def shell_insert(rng):
    t = t_(0.22)
    scrape = band(rng.standard_normal(len(t)), 900, 5000) * np.clip(np.sin(np.pi * np.clip(t / 0.065, 0, 1)), 0, 1)
    x = scrape / max(np.abs(scrape).max(), 1e-9) * 0.2
    x += modes(t, 0.066, [3100, 4800], [0.010, 0.007], [0.5, 0.35], rng) + tick(t, 0.066, 2000, 9000, 0.002, 0.35, rng)
    x += tick(t, 0.074, 180, 900, 0.022, 0.55, rng)
    return x


def dry_click(rng):
    t = t_(0.16)
    return modes(t, 0.002, [2900, 4400, 6800], [0.012, 0.009, 0.006], [0.7, 0.5, 0.3], rng) + tick(t, 0.002, 2500, 10000, 0.002, 0.5, rng)


def shell_drop(rng):
    t = t_(0.65)
    x = np.zeros_like(t)
    for at, a in ((0.0, 1.0), (0.155, 0.5), (0.262, 0.26), (0.33, 0.12)):
        x += a * (modes(t, at, [1150, 2380, 3520], [0.034, 0.022, 0.014], [0.7, 0.5, 0.3], rng) +
                  modes(t, at, [4250, 6150], [0.055, 0.040], [0.18, 0.12], rng) + tick(t, at, 1000, 7000, 0.004, 0.45, rng))
    return x


def handle(rng):
    t = t_(0.45)
    cloth = band(rng.standard_normal(len(t)), 300, 3200) * np.clip(np.sin(np.pi * np.clip(t / 0.4, 0, 1)), 0, 1) ** 2
    x = cloth / max(np.abs(cloth).max(), 1e-9) * 0.25
    for at in (0.09, 0.21, 0.29):
        x += modes(t, at, [1900, 3300, 5100], [0.018, 0.012, 0.008], [0.25, 0.18, 0.1], rng)
    return x


def shells_box(rng):
    """A box of shells picked up: the cardboard's soft thump, the shells inside knocking together."""
    t = t_(0.45)
    thump = band(rng.standard_normal(len(t)), 120, 700) * decay(t, 0.025, 0.004)
    x = thump / max(np.abs(thump).max(), 1e-9) * 0.5
    for i in range(7):
        at = 0.012 + rng.uniform(0.0, 0.26) * (0.5 + 0.5 * i / 7)
        a = rng.uniform(0.25, 0.6) * (1.0 - i / 10)
        x += a * (modes(t, at, [1350 * rng.uniform(0.9, 1.1), 2700 * rng.uniform(0.9, 1.1), 4300], [0.012, 0.008, 0.005],
                        [0.6, 0.35, 0.15], rng) + tick(t, at, 1500, 8000, 0.002, 0.3, rng))
    return x


def double_open(rng):
    """The top lever pushed over (a click), the barrels unlatching and dropping on the hinge (a metal clack, a low thunk)."""
    t = t_(0.42)
    x = tick(t, 0.004, 2000, 9000, 0.002, 0.5, rng) + modes(t, 0.006, [2600, 4300], [0.010, 0.007], [0.4, 0.25], rng)
    x += modes(t, 0.07, [1500, 2700, 4100], [0.030, 0.020, 0.012], [0.8, 0.5, 0.3], rng) + tick(t, 0.07, 800, 6000, 0.004, 0.6, rng)
    thunk = band(rng.standard_normal(len(t)), 90, 520) * decay(t, 0.03, 0.10)
    return x + thunk / max(np.abs(thunk).max(), 1e-9) * 0.7


def double_close(rng):
    """The barrels swung up and locked: a hard clack with the gun's body behind it, the lever snapping back."""
    t = t_(0.40)
    x = modes(t, 0.0, [1900, 3300, 5200, 7400], [0.035, 0.022, 0.014, 0.008], [1.0, 0.6, 0.35, 0.2], rng)
    x += tick(t, 0.0, 600, 9000, 0.003, 0.9, rng)
    body = band(rng.standard_normal(len(t)), 70, 400) * decay(t, 0.045, 0.0)
    x += body / max(np.abs(body).max(), 1e-9) * 0.9
    return x + modes(t, 0.055, [2900, 4600], [0.008, 0.006], [0.3, 0.2], rng)


def double_flick(rng):
    """The ejectors' springs throwing the hulls out: two sharp pings close together and the hulls' plastic rattle."""
    t = t_(0.30)
    x = np.zeros_like(t)
    for at in (0.0, 0.018):
        x += modes(t, at, [3300, 5600, 8100], [0.012, 0.008, 0.005], [0.7, 0.45, 0.25], rng) + tick(t, at, 1500, 9000, 0.002, 0.5, rng)
    for at in (0.05, 0.075, 0.11):
        x += 0.25 * modes(t, at, [1250, 2500], [0.010, 0.007], [0.6, 0.3], rng)
    return x


SOUNDS = {"shotgun_fire": (blast, -0.5), "shotgun_pump_back": (pump_back, -4.0), "shotgun_pump_forward": (pump_forward, -3.0),
          "shotgun_shell_insert": (shell_insert, -6.0), "shotgun_dry": (dry_click, -8.0), "shell_drop": (shell_drop, -10.0),
          "shotgun_handle": (handle, -10.0), "shells_box": (shells_box, -9.0),       # (new ones last: each one's seed is its place)
          "double_open": (double_open, -5.0), "double_close": (double_close, -3.0), "double_flick": (double_flick, -8.0)}


def write(path, x, peak_db):
    x = x / max(np.abs(x).max(), 1e-9) * 10 ** (peak_db / 20)
    fade = min(len(x), int(0.004 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    with tempfile.TemporaryDirectory() as d:
        w = Path(d) / "a.wav"
        with wave.open(str(w), "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(SR)
            f.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
        # bitexact: the same bytes every run (the Ogg muxer's stream serial is random otherwise)
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(w), "-c:a", "libvorbis", "-q:a", "6",
                            "-fflags", "+bitexact", "-flags:a", "+bitexact", str(path)],
                           capture_output=True, text=True)
        if r.returncode:
            sys.exit("ffmpeg: " + r.stderr[-400:])


def main():
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else OUT
    out.mkdir(parents=True, exist_ok=True)
    for i, (name, (fn, peak)) in enumerate(SOUNDS.items()):
        x = fn(np.random.default_rng(1000 + i))
        write(out / f"{name}.ogg", x, peak)
        print(f"  {name}.ogg {len(x) / SR:.2f} s")
    print(f"WEAPONSOUNDS ok ({len(SOUNDS)} into {out})")


if __name__ == "__main__":
    main()
