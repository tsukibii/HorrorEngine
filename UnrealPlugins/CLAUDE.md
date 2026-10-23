# Adding a plugin from UnrealPlugins/ to a project: notes for Claude

These steps are the same for every plugin here; the plugin's own `CLAUDE.md` adds what's specific (what to put in
the level, what to check, what breaks on other engine versions). Ask the user which project and which engine before
touching anything, and say what you'll change in their project.

## 1. Know the project

- Find the `.uproject` and its `EngineAssociation` (the engine version). Read the plugin's README for the engines it
  supports.
- **Does the project have a `Source/` folder** (a C++ project)? If it does, the editor builds the plugin itself. If
  it's Blueprint-only, see step 3b.
- Find the engine: on the user's machine Unreal 5.8.3 is at `/run/media/hal/Derick/Unreal/UnrealEngine` (Linux
  prebuilt, started with `ue`). Elsewhere, ask.

## 2. Put the plugin in

Either copy it (the project owns its copy, simplest to ship):

```bash
cp -r /path/to/HorrorEngine/UnrealPlugins/<Plugin> /path/to/Project/Plugins/<Plugin>
```

or point the project at this folder (one copy for every project on the machine; the project needs this repo to
build) by adding to the `.uproject`:

```json
"AdditionalPluginDirectories": [ "/path/to/HorrorEngine/UnrealPlugins" ]
```

Keep the folder's name: a plugin finds its own shaders by its name.

## 3. Enable and build

Add it to the `.uproject`'s `Plugins` list (or Edit > Plugins in the editor, then restart):

```json
{ "Name": "<Plugin>", "Enabled": true }
```

**a. C++ project.** Build the editor target once from the command line, so errors show in full (the editor's "rebuild
modules?" dialog hides them):

```bash
ENGINE=/run/media/hal/Derick/Unreal/UnrealEngine
"$ENGINE/Engine/Build/BatchFiles/Linux/Build.sh" <Project>Editor Linux Development -Project="/path/to/Project/<Project>.uproject" -WaitMutex
```

(Windows: `Engine\Build\BatchFiles\Build.bat <Project>Editor Win64 Development -Project=... -WaitMutex`.)

**b. Blueprint-only project.** The editor can't compile plugin source for a project with no code. Either add a C++
class once (Tools > New C++ Class > None, which makes it a C++ project), or build the plugin by itself and drop the
built copy in:

```bash
"$ENGINE/Engine/Build/BatchFiles/RunUAT.sh" BuildPlugin -Plugin="/path/to/UnrealPlugins/<Plugin>/<Plugin>.uplugin" -Package=/tmp/<Plugin>_built -TargetPlatforms=Linux
cp -r /tmp/<Plugin>_built /path/to/Project/Plugins/<Plugin>
```

## 4. When it doesn't compile

Read the first error, not the last. Most breaks between engine versions are a renamed type or a changed virtual
signature; the plugin's `CLAUDE.md` lists the ones it knows ("Engine versions") with the engine header to read.
Read that header in the user's engine (`$ENGINE/Engine/Source/Runtime/...`), match the signature, and guard the
change with `UE_VERSION_OLDER_THAN(major, minor, patch)` (from `Misc/EngineVersionComparison.h`) so other versions
still build. Then write what you learned in the plugin's `CLAUDE.md` and, in HorrorStudio, in `docs/LESSONS.md`.

## 5. Check it, then tell the user what to look at

Each plugin's `CLAUDE.md` says how to see it working and what to measure. You can't judge the look; you can judge the
frame: measure, say what you think it needs, and let the user decide.
