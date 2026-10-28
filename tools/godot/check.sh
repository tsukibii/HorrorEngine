#!/usr/bin/env bash
# GODOT: Godot 4.7 runs here, headless (a script) and with pictures (a lit box rendered under xvfb on lavapipe,
# or on the real GPU when there's a display). Ends "GODOT ok".
#   tools/godot/check.sh            ($GODOT, else godot, else godot-mono)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
G="${GODOT:-}"; [ -n "$G" ] || G="$(command -v godot || command -v godot-mono || true)"
[ -n "$G" ] || { echo "GODOT FAIL: no godot (tools/godot_setup.sh on a cloud session; godot-mono on the user's machine)"; exit 1; }
quiet() { grep -v -i "ALSA\|ERR_CANT_OPEN\|snd_" ; }
out="$(timeout 120 "$G" --headless --path "$HERE/smoke" -s check.gd 2>&1 | quiet)"
echo "$out" | grep -q "^GDTEST verts=24" || { echo "$out" | tail -5; echo "GODOT FAIL: headless script"; exit 1; }
echo "$out" | grep "^GDTEST"
rm -f "$HERE/smoke/shot.png"
if [ -n "${DISPLAY:-}" ]; then
  shot="$(timeout 180 "$G" --path "$HERE/smoke" -s shot.gd 2>&1 | quiet)"
else
  command -v xvfb-run >/dev/null || { echo "GODOT FAIL: no xvfb-run for the picture"; exit 1; }
  shot="$(VK_ICD_FILENAMES="${VK_ICD_FILENAMES:-/usr/share/vulkan/icd.d/lvp_icd.json}" timeout 180 xvfb-run -a "$G" --path "$HERE/smoke" --rendering-driver vulkan -s shot.gd 2>&1 | quiet)"
fi
line="$(echo "$shot" | grep "^GDSHOT")"
[ -n "$line" ] || { echo "$shot" | tail -8; echo "GODOT FAIL: no picture"; exit 1; }
echo "$line"
# the frame is mostly dark with a lit floor and box: a mean luminance between 0.02 and 0.5 says something rendered
mean="$(echo "$line" | sed 's/.*mean=//')"
python3 -c "import sys; m=float('$mean'); sys.exit(0 if 0.02 < m < 0.5 else 1)" || { echo "GODOT FAIL: the picture is blank or washed out (mean $mean)"; exit 1; }
rm -f "$HERE/smoke/shot.png"
echo "GODOT ok"
