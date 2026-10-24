# Light Kit: notes for Claude

How to put it in a project, make its materials, light a room with it, check it, and fix it on another engine. The
general steps (copy, enable, build, Blueprint-only projects) are in `../CLAUDE.md`.

## Map

| File | What |
|---|---|
| `LightKit.uplugin` | one Runtime module, content on (for the made materials), needs ProceduralMeshComponent |
| `Source/LightKit/Public/LightKitTypes.h` | `ELightKitTime` (Day, Dusk, Night, Custom), `ELightKitLighting` (Dynamic, Baked), `ELightKitPattern`, `FLightKitTimeSettings` (every number of a time of day, physical units) and its presets (`LightKitTypes.cpp`), the materials' paths |
| `LightKitSky.*` | the sky rig; `TellFollowers` refreshes windows and patterns when the time changes |
| `LightKitWindow.*` | sky fill, portal, fake bounce (a trace for the sun's patch), shaft card (a procedural mesh) |
| `LightKitPattern.*`, `LightKitSweep.*`, `LightKitFlicker.*`, `LightKitPuddle.*` | the rest |
| `Content/Python/lightkit_materials.py` | the six materials as HLSL text and the editor code that builds them |
| `Content/Python/init_unreal.py` | at the editor's start, once it has loaded: builds any of the materials that's missing |
| `Tools/check_hlsl.py`, `Tools/preview_patterns.py` | the HLSL compiled with DXC; the patterns drawn in numpy |

**Keep the HLSL and the preview in step:** a change to a Custom node's code in `lightkit_materials.py` gets the same
change in `Tools/preview_patterns.py`, then `check_hlsl.py` and a look at the preview.

## 1. Install

`../CLAUDE.md` steps 1 to 3 with `<Plugin>` = `LightKit`. Also enable **PythonScriptPlugin** and
**EditorScriptingUtilities** (the material script needs them; HorrorEngine has both).

## 2. The materials (made by themselves)

The materials are made from text, not stored: they land in the plugin's `Content/Materials/` (git-ignored). The
plugin's `init_unreal.py` makes any that's missing a moment after the editor has loaded (the log says
`lightkit: making the materials it hasn't got`), so a fresh checkout needs nothing by hand. To rebuild them after
changing the HLSL, in the editor (Python console, or `unreal_execute_script` through UnrealClaude):

```python
import lightkit_materials; lightkit_materials.build()
```

It logs `lightkit: made 6 materials in /LightKit/Materials`. Errors from a Custom node name the material; the HLSL
also compiles offline (step 6). Without the materials everything still works except patterns, cloud shadows,
shafts and puddles (each logs a warning saying to run this).

## 3. Light a level

**Clear the level's own sky first:** delete its Directional Light, Sky Light, Sky Atmosphere, Exponential Height
Fog (and a BP_Sky_Sphere). Then:

1. **Light Kit Sky** anywhere. Time: Day, Dusk or Night. Lighting: **Dynamic** with Lumen (or nothing baked), or
   **Baked** for Lightmass.
2. **Light Kit Window** in every window and glass door, the arrow pointing **into** the room, Width and Height set
   to the glass (cm). Set `FloorColor` to the room's floor.
3. A **Box Reflection Capture** (Unreal's own) per room, sized to the room. **Lightmass Importance Volume** round the
   building when baking.
4. Where it fits: **Light Kit Pattern** (caustics over a bath, leaves by a window with a tree outside), **Light Kit
   Sweep** outside a street-facing window, **Light Kit Puddle** on wet ground, **Light Kit Flicker** on a tired tube.

**Day and night when baked:** a bake holds one time of day. Make a Lighting Scenario sublevel per time (Levels panel:
the level's "Lighting Scenario" box), put a Light Kit Sky set to that time in each, build lighting with each one
visible in turn, and load the scenario you want in play (Load Stream Level). Dynamic skies just `SetTime`.

**Exposure:** the sky's post-process sets auto exposure in EV100. That needs the project setting *Extend default
luminance range in Auto Exposure settings* on (Project Settings > Rendering; on by default in UE5). A post-process
volume of the user's with a higher priority wins over the sky's (it's at -1).

## 4. Check it

You can't judge the look; you can judge the frame. With the user:
- `HighResShot 1920x1080` in Day, Dusk and Night from the same spots (a window wall, the room's back, a corridor),
  then a contact sheet. Look for: a room's back wall not black by day (the fill reaches), the sun patch on the
  floor, night shadows blue not black (sample a shadow pixel: blue the largest, above about 0.02), the sky a
  visible navy at night.
- With UltraVHS on, `UltraVHS/Tools/measure.py` on a capture gives black and white levels and the shadows' colour.
- `stat gpu` / `profilegpu`: the budget table in README.md.

What to move:

| Off | Move |
|---|---|
| a room too dark by day, the back wall black | window `FillScale` up, or `Reach`; Dynamic without Lumen: `Bounce` On |
| a room too flat, no sense of the window | `FillScale` down, fill shadows on |
| night too black | Night's `SkyGlow`, `SkyIntensity`, `ShadowLift` (bluer, higher), `ExposureBias` toward 0 |
| night looks like day | `ExposureBias` down, `SunIntensity` down, `Saturation` down |
| shadows too sharp | `SunSourceAngle` up (and lights' `SourceRadius`, rect sizes) |
| shafts too strong or visible edge-on | window `ShaftScale`, the time's `ShaftIntensity` |

## 5. Engine versions

Written for 5.8 against the 5.4 to 5.8 API. Where it touches the engine, and what to read if one breaks:

| What | Where | Read |
|---|---|---|
| `UExponentialHeightFogComponent::SetFogInscatteringColor` (the property became `FogInscatteringLuminance` in 5.x; the setter stayed) | sky `Apply` | `Engine/Classes/Components/ExponentialHeightFogComponent.h` |
| `USkyAtmosphereComponent::SetSkyLuminanceFactor` | sky `Apply` | `Engine/Classes/Components/SkyAtmosphereComponent.h` |
| `USkyLightComponent::bRealTimeCapture`, `RecaptureSky`, `SetIntensity`, `SetLightColor` | sky | `Engine/Classes/Components/SkyLightComponent.h` |
| `UDirectionalLightComponent::LightSourceAngle`, `bAtmosphereSunLight`, `ContactShadowLength`, `LightFunctionScale`, `SetLightFunctionMaterial` | sky, pattern | `.../DirectionalLightComponent.h`, `.../LightComponent.h` |
| `FPostProcessSettings` fields (`AutoExposure*`, `WhiteTemp`, `ColorSaturation`, `ColorOffsetShadows`, `BloomIntensity`) | sky `Apply` | `Engine/Classes/Engine/Scene.h` |
| `URectLightComponent` (`SetSourceWidth/Height`, `BarnDoorAngle/Length`), `ULocalLightComponent::IntensityUnits` (`ELightUnits::Candelas`) | window | `.../RectLightComponent.h`, `.../LocalLightComponent.h` |
| `ULightmassPortalComponent`: its box assumed to be a unit extent (scale = half size); check the portal's drawn box matches the window | window | `.../LightmassPortalComponent.h`, `Engine/Private/LightmassPortal.cpp` |
| `UProceduralMeshComponent::CreateMeshSection_LinearColor` | window shaft | `Plugins/Runtime/ProceduralMeshComponent/Source/.../ProceduralMeshComponent.h` |
| Python: `MaterialEditingLibrary`, `MaterialExpressionCustom` (`code`, `inputs`, `output_type`), `CustomInput.input_name`, `MaterialExpressionEyeAdaptationInverse` (falls back if missing), `MaterialDomain`/`BlendMode`/`MaterialProperty` names | the material script | the editor's Python API (`help(unreal.MaterialExpressionCustom)`) |
| `FindObject<UClass>(nullptr, "/Script/UltraVHS.UltraVHSComponent")`, `ForEachObjectOfClass`, `UObject::FindFunction` + `ProcessEvent` (a `{bool, float}` parameter block, checked against `ParmsSize`), `UWorld::AddOnActorSpawnedHandler` | sky `TellCamcorder` (UltraVHS's night mode by name) | `CoreUObject/Public/UObject/UObjectHash.h`, `.../UObjectGlobals.h`, `Engine/Classes/Engine/World.h` |
| Light functions see light-space coordinates as texture coordinates (`LightFunctionPixelShader.usf`: TexCoords = LightVector.zy) | the pattern HLSL | `Engine/Shaders/Private/LightFunctionPixelShader.usf` |

Fix with `UE_VERSION_OLDER_THAN(...)` guards (`Misc/EngineVersionComparison.h`) and add a row here.

## 6. Offline checks

```bash
DXC=/path/to/dxc python Tools/check_hlsl.py                                       # ends "HLSL ok"
uv run --with numpy --with pillow python Tools/preview_patterns.py /tmp/patterns.png
```

## 7. In HorrorStudio

The look comes last, per game (DECISIONS 2026-10-21), so the kit isn't enabled in `HorrorEngine.uproject` until a
game wants it: then `python tools/unreal_plugins.py on LightKit --build` (it adds `"AdditionalPluginDirectories":
["UnrealPlugins"]`, enables the kit and what it needs, and builds). With the kit on, the importer's `environment`
places a Light Kit Sky (Dynamic, at the time the level is first seen in the flow) and a Light Kit Window in every
builder window (`storykit.importer.light_kit`), and the story preview sets each scene's time (a scene's `time`,
STORY_FORMAT §3.1; docs/UNREAL_FLOW.md §1c). Still to do: a light's `flicker` onto Light Kit Flicker.
