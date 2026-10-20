"""Runs when the editor starts (Unreal runs every Content/Python/init_unreal.py). UnrealClaude starts its own MCP
server (port 3000); this only makes the story tools importable and says so."""
import unreal

from storykit import storylib

unreal.log(f"storykit: ready, games {storylib.games()} (import storykit.importer as i; i.build('<Game>'))")
