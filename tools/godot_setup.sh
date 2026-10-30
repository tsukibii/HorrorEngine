#!/usr/bin/env bash
# Godot 4.7 for this repo's Godot side (docs/GODOT_PLAN.md), after Woohill's tools/cloud_setup.sh: gets a cloud
# session ready in about a minute and does nothing when it is (or on a machine that isn't a cloud session, unless
# --force). The user's own machine has godot-mono 4.7 already (DECISIONS 2026-10-28): the scripts take $GODOT, else
# godot, else godot-mono. Our projects are GDScript, so the standard build is enough here.
#   - Godot 4.7 (headless checks, and pictures under xvfb): /opt/godot, linked as /usr/local/bin/godot
#   - xvfb and lavapipe (mesa-vulkan-drivers) for pictures: VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
#   tools/godot_setup.sh [--force]
set -u
GODOT_VERSION="4.7-stable"
say() { echo "godot_setup: $*" >&2; }

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi

if ! godot --version 2>/dev/null | grep -q '^4\.7\.'; then
  say "installing Godot $GODOT_VERSION"
  tmp="$(mktemp -d)"
  zip="Godot_v${GODOT_VERSION}_linux.x86_64.zip"
  for base in https://github.com/godotengine/godot-builds/releases/download \
              https://github.com/godotengine/godot/releases/download; do
    curl -fsSL --retry 3 -o "$tmp/g.zip" "$base/$GODOT_VERSION/$zip" && break
  done
  if [ -s "$tmp/g.zip" ] && unzip -q -o "$tmp/g.zip" -d "$tmp"; then
    mkdir -p /opt/godot
    mv -f "$tmp/Godot_v${GODOT_VERSION}_linux.x86_64" /opt/godot/godot && chmod +x /opt/godot/godot
    ln -sf /opt/godot/godot /usr/local/bin/godot
  else
    say "Godot download failed (the network policy may block github.com release assets)"
  fi
  rm -rf "$tmp"
fi

if ! command -v xvfb-run >/dev/null || [ ! -f /usr/share/vulkan/icd.d/lvp_icd.json ]; then
  say "installing xvfb and mesa-vulkan-drivers"
  (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb mesa-vulkan-drivers) >/dev/null 2>&1 ||
    say "apt-get failed: pictures under xvfb won't work, the headless checks still do"
fi

say "ready: $(godot --version 2>/dev/null | head -1 || echo 'no godot')"
