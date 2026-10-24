# Ultra VHS: notes for Claude

How to put this plugin in a project, see it working, check it by measurement, and fix it on an engine it hasn't met.
The general steps (copy, enable, build, Blueprint-only projects) are in `../CLAUDE.md`; this is what's specific.

## Map

| File | What |
|---|---|
| `UltraVHS.uplugin` | two modules: `UltraVHSRender` (PostConfigInit) and `UltraVHS` (Default) |
| `Shaders/Private/UltraVHS.usf` | the three passes: `CapturePS` (lens, sensor), `TapePS` (luma, chroma, wear, persistence), `DisplayPS` (scale up, pillarbox, scanlines) |
| `Source/UltraVHSRender/` | no UObjects. `UltraVHSRenderModule.cpp` maps `/Plugin/UltraVHS` to `Shaders/`; `UltraVHSShaders.*` the global shaders and their parameter structs; `UltraVHSViewExtension.*` an `FWorldSceneViewExtension` that adds the passes after the tonemapper; `UltraVHSRenderParams.h` the plain numbers it draws with |
| `Source/UltraVHS/` | `UltraVHSSettings.*` the knobs and presets (`FUltraVHSSettings`, `FUltraVHSHandheldSettings`, `EUltraVHSPreset`); `UltraVHSSubsystem.*` one per world, owns the view extension, picks the active component, the `r.UltraVHS` console variables; `UltraVHSComponent.*` what goes on the player; `UltraVHSHandheldModifier.*` the handheld camera |
| `Tools/preview.py`, `Tools/measure.py` | the passes in numpy; the measurements (README.md "The reference") |

Why two modules: global shaders must be registered before the engine compiles the global shader map, so their
module loads at PostConfigInit; UObjects (components, subsystems) are safest in a Default module. Keep UObjects out of
`UltraVHSRender`.

**Keep the shader and the preview in step:** a change to `UltraVHS.usf` gets the same change in `Tools/preview.py`,
and a new knob goes in five places: `FUltraVHSSettings` (with its meta and comment), `FUltraVHSRenderParams`,
`UltraVHS::ToRenderParams` (subsystem), the shader's parameter struct and the `Params->` line in the view extension,
and the `.usf`. The README's knob table too.

**Night mode** (`bNightMode`, `NightBlackLevel`, `SetNightMode`, `r.UltraVHS.Night`) lives on the component, not in
`FUltraVHSSettings`: the subsystem blends `BlackLevel` toward the night's before `ToRenderParams`, so the shader and
the presets don't change and a preset applied at night stays at night. LightKit's sky calls `SetNightMode` by name.

## 1. Install

Follow `../CLAUDE.md` steps 1 to 3 with `<Plugin>` = `UltraVHS`. The folder must stay named `UltraVHS` (the render
module finds `Shaders/` by the plugin's name).

## 2. See it before wiring anything

In the editor, open any level, press the backtick for the console and type `r.UltraVHS 1`. The viewport should go
4:3, soft and barrel-shaped at once. `r.UltraVHS 2` and `3` are the other presets, `r.UltraVHS.Glitch 1` the damage,
`r.UltraVHS -1` hands it back to the components.

If nothing changes:
- the Output Log at startup: a shader error names `UltraVHS.usf` and a line. Fix it, then `recompileshaders changed`
  (or Ctrl+Shift+.). The shader compiles with DXC offline: see "Offline checks".
- `profilegpu` (or Unreal Insights / RenderDoc): look for an `UltraVHS` event with `UltraVHS.Camera`, `.Tape`,
  `.Screen` under the post-process. Missing: the view extension isn't active (the world has no `UUltraVHSSubsystem`,
  e.g. a dedicated server, or an asset editor's preview world, which subsystems skip by design).
- is the module loaded? `Output Log`: "LogModuleManager" lines for `UltraVHSRender`.

## 3. Put it on the player

**Blueprint:** open the player's character Blueprint, Add Component > Ultra VHS, compile, save. Defaults are the
Camcorder preset with the handheld camera on.

**C++:** in the character's constructor,

```cpp
#include "UltraVHSComponent.h"
// ...
VHS = CreateDefaultSubobject<UUltraVHSComponent>(TEXT("UltraVHS"));
```

with `UPROPERTY(VisibleAnywhere) TObjectPtr<UUltraVHSComponent> VHS;` in the header and `"UltraVHS"` in the game
module's `PublicDependencyModuleNames`.

Then Play: the view records, walks with a gait, wanders when still. A glitch on a scare is
`VHS->TriggerGlitch(1.f, 0.6f)` (Blueprint: Trigger Glitch).

Things to tell the user:
- The 4:3 crop narrows the view; with `bCrop4x3` a field of view around 100 (horizontal, on 16:9) gives the
  camcorder's wide look. Their call.
- The UI is drawn after the post-process, so the HUD stays clean (not on the tape). A REC overlay that should be on
  the tape has to be in the world or drawn into the scene; that isn't built.
- `RotationLag` makes the view trail the controller; aim traces from the controller lead the picture slightly. Set
  it to 0 for a shooter.
- The component sets the owner's camera's motion blur at BeginPlay (`bSetMotionBlur`); turn it off if the project
  manages post-process volumes itself.

## 4. Check it by measurement

You can't judge the look; you can judge the frame. Ask the user for a 1080p capture of Play (Movie Render Queue, or
OBS on the window) that walks and turns, then:

```bash
uv run --with numpy --with pillow python Tools/measure.py capture.mp4 --start 2 --seconds 30
```

It prints each number next to the reference's. What to move when a number is off:

| Off | Move |
|---|---|
| edge rise | `LumaBlur` (and `TapeLines`: fewer lines, wider edges) |
| halo | `Sharpen` (amount), `SharpenRadius` (width) |
| colour edges vs luma | `ChromaBlur` |
| black, white, shadows' tint | `BlackLevel`, `WhiteLevel` (at night: `NightBlackLevel`) |
| vignette | `Vignette` (only over many frames: one frame's corners are just the scene) |
| noise | the Wear knobs (the reference has none) |
| motion peaks and size | the handheld settings: `DriftSpeed` and `Drift*` for the slow wander, `StepsPerSecond` and `Bob*` for the walk |

The barrel isn't measured automatically: fit a straight wall edge near the frame's side as README.md describes
(`Distortion` is k with r in half-heights). Without a capture, `Tools/preview.py` on a frame or the chart shows
what a change does.

## 5. Engine versions

Written for 5.8 against the 5.4 to 5.8 API. The places it touches the engine, and what to read when one breaks:

| What | Where it's used | Read |
|---|---|---|
| `SubscribeToPostProcessingPass` and its delegate: before 5.5 `(Pass, FAfterPassCallbackDelegateArray&, bool)`, from 5.5 `(Pass, const FSceneView&, FPostProcessingPassDelegateArray&, bool)` | `UltraVHSViewExtension.h/.cpp`, `UltraVHS::FPassDelegate*` | `Engine/Source/Runtime/Engine/Public/SceneViewExtension.h` |
| `FWorldSceneViewExtension` (ctor, `IsActiveThisFrame_Internal`) | the view extension | same header |
| `FPostProcessMaterialInputs::GetInput` returning a `FScreenPassTextureSlice` (5.4+), `FScreenPassTexture::CopyFromSlice`, `ReturnUntouchedSceneColorForPostProcessing`, `OverrideOutput` | `PostTonemap_RenderThread` | `Engine/Source/Runtime/Renderer/Public/PostProcess/PostProcessMaterialInputs.h`, `.../Renderer/Public/ScreenPass.h` |
| `FPixelShaderUtils::AddFullscreenPass` | the three passes | `Engine/Source/Runtime/RenderCore/Public/PixelShaderUtils.h` |
| `AddShaderSourceDirectoryMapping` | the render module | `Engine/Source/Runtime/RenderCore/Public/ShaderCore.h` |
| `UCameraModifier::ModifyCamera(float, FMinimalViewInfo&)`, its `Alpha`, `CameraOwner` | the handheld modifier | `Engine/Source/Runtime/Engine/Classes/Camera/CameraModifier.h` |
| `FSceneView::bIsSceneCapture`, `GetViewKey`, `Family->Time`, `Family->FrameNumber` | the view extension | `Engine/Source/Runtime/Engine/Public/SceneView.h` |
| `#include "/Engine/Public/Platform.ush"` first in the `.usf` | the shader | any engine `.usf` under `Engine/Shaders/Private/` |

Fix with `UE_VERSION_OLDER_THAN(...)` guards, as `UltraVHSViewExtension.h` does, and add a row here. Older than 5.4
isn't supported (the post-process inputs were private headers then); mobile (ES3.1) isn't either (SM5 shaders).

## 6. Offline checks

```bash
# the shader: DXC from github.com/microsoft/DirectXShaderCompiler/releases (linux_dxc_*.tar.gz)
mkdir -p /tmp/vhs/Engine/Public && echo '// stub' > /tmp/vhs/Engine/Public/Platform.ush
sed 's#"/Engine/Public/Platform.ush"#"Engine/Public/Platform.ush"#' Shaders/Private/UltraVHS.usf > /tmp/vhs/UltraVHS.hlsl
for e in CapturePS TapePS DisplayPS; do LD_LIBRARY_PATH=$DXC/lib $DXC/bin/dxc -T ps_6_0 -E $e -HV 2021 /tmp/vhs/UltraVHS.hlsl -Fo /dev/null && echo "$e ok"; done
# the look
uv run --with numpy --with pillow python Tools/preview.py --chart /tmp/vhs/chart.png
uv run --with numpy --with pillow python Tools/preview.py /tmp/vhs/chart.png /tmp/vhs/out.png --side-by-side
uv run --with numpy --with pillow python Tools/measure.py /tmp/vhs/out.png
```

## 7. In HorrorStudio

The decision of 2026-10-21 stands: the look comes last, per game. This plugin is ready for when a game wants it;
until then it isn't enabled in `HorrorEngine.uproject`. To enable it there: add
`"AdditionalPluginDirectories": ["UnrealPlugins"]` and `{ "Name": "UltraVHS", "Enabled": true }` to the `.uproject`,
build, and add the component to the player Blueprint the importer uses (SETUP S6's class map). A story that wants
the look per scene or a glitch on a cue needs words in the format first (`STORY_FORMAT.md`, the runner and
`story_check` in one commit); don't use a word the format doesn't have.
