# MCP tools (UnrealClaude)

The editor through the `unreal` MCP server: `Plugins/UnrealClaude` (pull request 48 plus
`setup/unrealclaude_linux.patch`), its bridge at `Resources/mcp-bridge/index.js`, the editor's side at
`http://localhost:3000` (`/mcp/status` lists everything). 28 tools in the editor; the bridge's router
(`tool-router.js`) shows 15 as they are, folds 7 into `unreal_ue`, hides 6, and adds its own `unreal_status`,
`unreal_ue` and two context tools. Proven on 2026-10-21 (SETUP S4): status, spawn and delete, capture, the log, a
Python script.

## Shown (call as `mcp__unreal__unreal_<name>`)

| Tool | What |
|---|---|
| `status` | connected or not, the project, the engine version |
| `execute_script` | Python (or console, or C++ through Live Coding) in the editor: **the one we use most** (storykit) |
| `get_script_history` | the last scripts run: description, success, no output |
| `cleanup_scripts` | delete the generated script files and the history |
| `get_level_actors` | the actors in the open level |
| `spawn_actor` | add an actor by class, at a place |
| `move_actor` | location, rotation, scale |
| `set_property` | any property on an actor, components with a dotted path |
| `delete_actors` | remove actors (no undo through MCP) |
| `open_level` | open, create, save or list maps |
| `asset_search` | find assets by name, class, folder |
| `asset_dependencies` | what an asset uses |
| `asset_referencers` | what uses an asset |
| `blueprint_query` | read a Blueprint: variables, functions, graphs |
| `capture_viewport` | a JPEG of the editor viewport |
| `get_output_log` | the last lines of the editor log |
| `get_ue_context`, `get_project_context` | the bridge's notes on Unreal's APIs and the project |
| `ue` | the router: `domain` + `operation` + `params` for `blueprint` (modify), `anim`, `character` (and its data), `enhanced_input`, `material`, `asset` |

## Hidden

`task_submit`, `task_status`, `task_result`, `task_list`, `task_cancel` (the bridge's own async queue) and
`run_console_command` (it can run `py`: stays hidden, DECISIONS 2026-10-21).

## Quirks

- **Start the editor before Claude Code.** The bridge answers the tool list once, when Claude Code starts; with no
  editor it lists only `unreal_status`, and it never says the list changed. Editor up later: restart Claude Code.
- **`execute_script` is asynchronous and doesn't return the script's output.** It answers "queued" with a task id,
  and `task_status`/`task_result` are hidden. `print()` goes to the editor log: read it with `get_output_log` or
  `grep <marker> Saved/Logs/HorrorEngine.log`. Print one tagged line (`print("GAMES", ...)`) so it's easy to find.
- **No approval dialog:** `bAutoApproveScripts=True` (Config/DefaultEditor.ini); the log says
  `Script auto-approved` for each one.
- **The `@Description` header is read to the end of its line:** in a `"""` docstring the closing quotes end up in
  the history. Put the description on a line of its own.
- **A spawned `StaticMeshActor` has no mesh:** follow with `set_property` `StaticMeshComponent.StaticMesh` =
  `/Engine/BasicShapes/Cube.Cube`.
- **`capture_viewport` is the editor's viewport** (not the game camera), scaled to 1024x576.
- **Run the right project:** the editor started from a stray template once (`Unreal/Projects/HorrorEngine`) and the
  bridge never came up. `pgrep -a UnrealEditor` shows which `.uproject` it has; `setup.py editor` opens this one.
