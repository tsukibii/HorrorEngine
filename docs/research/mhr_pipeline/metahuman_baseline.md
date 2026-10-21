# MetaHuman baseline (October 2026) and the alternatives: build on MHR, use MetaHuman, or a hybrid

Sourcing note (2026-10-21): this session's network proxy refused dev.epicgames.com, metahuman.com, forums.unrealengine.com,
unrealengine.com, cdn2.unrealengine.com, cgchannel.com and reallusion.com. Claims from those sites come from search-engine
extracts of the cited pages, not from reading them in full; they are marked "(extract)" where the wording matters. GitHub
sources (MHR, SAM 3D Body, Anny, MPFB2, SMPL-X, OpenRigLogic, QtMeshEditor PR) were read directly. The "project" facts come
from files in this repository. Versions: UE/MetaHuman 5.6 shipped 2025-06-03, 5.7 shipped 2025-11-12, 5.8 shipped about
2026-06-17/18. The user runs 5.8.3.

## 1. What MetaHuman offers and restricts in UE 5.6, 5.7 and 5.8 (platforms, automation, cloud, pain points)

### Takeaway
MetaHuman is now an in-editor system that you can script. MetaHuman Creator (MHC) has run on Linux since 5.7, and
MetaHuman Animator's (MHA) facial solving has run on Linux since 5.8. It has a parametric body, and since 5.8
Mesh to MetaHuman (M2MH) takes a full body from any topology. Since June 2026 its rig runtime is open source under MIT
(OpenRigLogic). The hard limits for this studio:
- Auto-rigging and texture synthesis run in Epic's cloud, behind an Epic login and a consent step. 5.7 and 5.8.1 have
  reports of 150–300 s rig jobs and timeouts.
- Shapes are limited to realistic human ranges.
- Body capture is Windows-only.
- MHA solves only onto the MetaHuman control rig.

### Cited Findings

**5.6 (2025-06-03): Creator moves into the engine**
- MHC moved into Unreal Engine: characters are authored in the editor as a new MetaHuman Character asset — [Digital Production, 2025-06-03](https://digitalproduction.com/2025/06/03/unreal-engine-5-6-60-fps-smarter-metahumans-and-fewer-cpu-tantrums/); [MetaHuman 5.6 release forum post](https://forums.unrealengine.com/t/metahuman-5-6-release/2539165)
- The parametric body replaced the 18 fixed body presets with continuous sliders: height, chest, waist, leg length "and many other measurements". Clothes adjust to match — [Digital Production, 2025-06-03](https://digitalproduction.com/2025/06/03/unreal-engine-5-6-60-fps-smarter-metahumans-and-fewer-cpu-tantrums/)
- A new Outfit asset type autoscales to fit any body. Custom MetaHuman-compatible grooms and clothing can be used directly in Creator's wardrobe — [Digital Production, 2025-06-03](https://digitalproduction.com/2025/06/03/unreal-engine-5-6-60-fps-smarter-metahumans-and-fewer-cpu-tantrums/); [Epic docs: Tailoring Your Own Wardrobe Items](https://dev.epicgames.com/documentation/metahuman/tailoring-your-own-wardrobe-items) (extract: outfits are either parametric, resizing with the body, or skeletal and fixed-size. Groom and Groom Binding assets come from Fab or are made in UE, and Epic offers Maya and Houdini groom kits)
- MHA (5.6) solves facial animation in real time from a single camera and works with "most webcams and a wide range of smartphones". Audio-driven animation infers upper-face motion and head movement, and has emotion overrides (Anger/Happy/Sad/Surprise/Fear/Disgust) — [Digital Production, 2025-06-03](https://digitalproduction.com/2025/06/03/unreal-engine-5-6-60-fps-smarter-metahumans-and-fewer-cpu-tantrums/); [UE 5.6 announcement](https://www.unrealengine.com/news/unreal-engine-5-6-is-now-available)
- In June 2025 an Epic staffer said MetaHuman was supported only on Windows. Linux users reported running UE 5.6 under Proton as an unofficial workaround, with some editor lag — [Epic forum: UE 5.6 MetaHuman Character Creator Linux support](https://forums.unrealengine.com/t/ue-5-6-metahuman-character-creator-linux-support/2541069)
- MetaHuman left Early Access with this release — [metahuman.com: MetaHuman leaves Early Access](https://www.metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release)

**5.7 (2025-11-12): Linux and macOS, scripting, conforming**
- "The MetaHuman Creator plugin for Unreal Engine is now available on Linux and macOS in addition to Windows." MHA support for Linux and macOS was "planned for a future release". The Houdini plugin was also released for Linux — [metahuman.com: MetaHuman 5.7](https://www.metahuman.com/releases/metahuman-5-7-is-now-available); [UE 5.7 announcement](https://www.unrealengine.com/news/unreal-engine-5-7-is-now-available) (extract)
- Nearly all editing and assembly operations on MetaHuman character assets can be automated and batch-processed with Python or Blueprints: sculpting, conforming, wardrobe, rigging and textures. They can run interactively in the editor or offline on a compute farm — [metahuman.com: MetaHuman 5.7](https://www.metahuman.com/releases/metahuman-5-7-is-now-available) (extract)
- Conforming:
  - It accepts any pose between A-pose and T-pose (earlier versions needed the A-pose).
  - "Estimate Joints from Mesh" handles extreme proportions.
  - UV-space vertex correspondence lets a mesh round-trip through external DCCs as FBX.
  - Characters can be conformed "within a viable human height range" beyond the old database min/max heights.
  — [metahuman.com: 5.7 body conforming](https://www.metahuman.com/news/metahuman-5-7-brings-major-improvements-to-body-conforming-with-more-to-come)
- The 5.7 Preview reported that a MetaHuman Identity asset could not yet be created on Linux/macOS. Whether the final release fixed this was not confirmed — [MetaHuman 5.7 Preview forum post](https://forums.unrealengine.com/t/metahuman-5-7-preview-released/2658153) (extract)

**5.8 (about 2026-06-17/18): full-body Mesh to MetaHuman, Animator on Linux, OpenRigLogic**
- Mesh to MetaHuman is now built into Creator for full bodies. It conforms head and body together, accepts input meshes of any topology, and outputs a rigged character in MetaHuman topology. It works on humanoid characters only — [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine); [metahuman.com: MetaHuman 5.8](https://www.metahuman.com/news/metahuman-5-8-is-now-available) (extract)
- MHA on Linux and macOS:
  - Facial animation from performance capture can be generated on Linux and macOS "without requiring access to a Windows machine".
  - Real-time facial animation on Linux works only with Live Link Face.
  - Body animation features are Windows-only.
  — [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine); [metahuman.com: MetaHuman 5.8](https://www.metahuman.com/news/metahuman-5-8-is-now-available) (extract)
- The MetaHuman Animator Markerless Motion Capture Plugin (single-camera full-body capture built on Meshcapade's technology) is Experimental, on Fab, free, and "compatible with Unreal Engine 5.8 running on Windows only" — [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine); [CG Channel, 2026-06](https://www.cgchannel.com/2026/06/get-the-free-metahuman-animator-markerless-mocap-plugin/) (extract)
- Crowds: MetaHuman Collections (Experimental, orchestrated with Mass) switch characters between full Actors and instanced skinned meshes by camera distance. Epic claims "hundreds on mobile, thousands on higher-end hardware" and published a Crowds Sample on Fab — [GamesBeat](https://gamesbeat.com/epic-games-launches-metahuman-5-8-to-create-real-time-game-character-crowds/); [MetaHuman 5.8 released forum post](https://forums.unrealengine.com/t/metahuman-5-8-released/2729288) (extract)
- Unbaked textures and materials can be exported and edited in UE or external DCCs. Creator gained custom lighting previews — [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine) (extract)
- RigLogic and DNA changes:
  - The RigLogic and DNA libraries were updated, and cooked DNA assets load faster.
  - A `ConvertLegacyDNAAssets` commandlet migrates old DNA content.
  - FP16 RigLogic evaluation works on Linux and Windows desktop.
  — [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine) (extract)
- The RigLogic and DNA libraries were released under MIT as OpenRigLogic, the first piece of a "MetaHuman Devkit" — [metahuman.com/devkit](https://www.metahuman.com/devkit); [GitHub: EpicGames/OpenRigLogic](https://github.com/EpicGames/OpenRigLogic) (details in §3)
- The 5.8.1 hotfix gated "MetaHuman Generator toolset" registration on optional content being available, and fixed several DCC export bugs — [5.8.1 Hotfix forum post](https://forums.unrealengine.com/t/5-8-1-hotfix-released/2738864) (extract)
- Export: Creator's Export > DCC Export package contains a DNA file for the head, a DNA file for the body, and the textures. "Groom and clothing information is not currently part of this package." — [OpenRigLogic README](https://github.com/EpicGames/OpenRigLogic)

**Cloud, account and network (5.6 onward)**
- MHC in Unreal Engine uses cloud services for auto-rigging and texture synthesis — [Epic docs: Getting Started with MetaHuman Creator in UE](https://dev.epicgames.com/documentation/metahuman/getting-started-with-metahuman-creator-in-unreal-engine?lang=en-US) (extract)
- MHA also uses cloud services for auto-rigging — [Epic docs: Getting Started with MetaHuman Animator](https://dev.epicgames.com/documentation/en-us/metahuman/getting-started-with-metahuman-animator) (extract)
- The first auto-rig or texture download opens an Epic Games account login, followed by agreeing to the "MetaHuman Consent" — [Epic forum: Error, not logged in (5.6)](https://forums.unrealengine.com/t/error-not-logged-in-5-6/2542895)
- Managed networks must allow Epic's auto-rig and texture-synthesis domains and `s3.us-east-1.amazonaws.com` — [Epic forum: MetaHuman failing to connect to server](https://forums.unrealengine.com/t/metahuman-failing-to-connect-to-server/2541243)

**Automation (Python, and an MCP-style toolset)**
- Scripting goes through `unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)`. The subsystem is required for face-landmark edits, body sculpting, conforming, texture and auto-rig requests, and assembly. The pattern is register → edit → commit → remove. Skin and eye settings can be edited on the asset without it — [Epic docs: MetaHuman Creator Python Scripting](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-python-scripting-in-unreal-engine?lang=en-US) (extract)
- Some calls are missing: face-rig removal is not exposed in 5.7, and a later reply says it is not possible in 5.8.0 — [Epic forum: Python API edit in place](https://forums.unrealengine.com/t/metahuman-python-api-add-ability-to-edit-metahuman-creator-assets-in-place/2763639/4)
- A community issue shows a working Python script that sets body constraints, adds wardrobe items, and requests the auto-rig and textures through the subsystem — [GitHub db-lyon/ue-mcp #1354](https://github.com/db-lyon/ue-mcp/issues/1354)

**Pain points reported**
- **Full Rig hangs (5.8.1):** the job reaches 75% / RUNNING, the status poll times out after 300 s with "Server Error", and the character returns to unbound. This was reproduced on two accounts. "Joints Only" rigs succeeded on the same machine in 198.243 s and 153.145 s — [Epic forum: Full Rig AutoRig hangs 300 s (5.8.1)](https://forums.unrealengine.com/t/metahuman-full-rig-autorig-status-poll-with-waitseconds-10-hangs-for-300s-and-fails-with-server-error-5-8-1-reproduced-across-two-accounts/2741256); [Epic forum: 5.8 Full Rig times out after 300 s](https://forums.unrealengine.com/t/ue-5-8-metahuman-character-full-rig-remains-running-and-times-out-after-300-seconds/2739214)
- **The same failure on 5.7:** one user says it "works normally in UE5.6" — [Epic forum: Auto-Rigging stuck at 75% (5.7)](https://forums.unrealengine.com/t/metahuman-auto-rigging-stuck-at-75-fails-with-error-ue-5-7/2709617)
- **Assembly crashes:** out of video memory on 5.7 (workaround: disable Nanite, lower scalability), and memory-limit crashes on 5.6 — [Epic forum: Metahuman assembly crash](https://forums.unrealengine.com/t/metahuman-assembly-crash/2679379); [Epic forum: 5.6 assembly constant crashing](https://forums.unrealengine.com/t/5-6-metahuman-creator-assembly-constant-crashing-memory-limit-reached/2512750)
- **Clothing fit:** a 5.8.3 user asks how to avoid "hours of manual fitting per set" for armour and clothing on MetaHumans — [Epic forum: fitting armour/clothing in 5.8.3](https://forums.unrealengine.com/t/fitting-armour-clothing-to-metahumans-in-ue-5-8-3-best-workflow-to-avoid-hours-of-manual-fitting-per-set/2839852)
- **Realistic ranges only (older threads):**
  - Creator's controls are limited to real human proportions and ranges. Its sculpting can't make enlarged eyes, cheekbones beyond realistic proportions, or elongated jaws, and the most stylised result is "realistic anime" — [Epic forum: Does MetaHuman support stylized characters?](https://forums.unrealengine.com/t/does-metahuman-support-stylized-characters/213339)
  - Opinion: Epic limited customisation so as not to break the rig, and the preset faces share nearly identical facial skeletal proportions — [Daz 3D forum thread](https://www.daz3d.com/forums/discussion/472361/metahuman-creator-an-insane-level-of-competition/p8)
- **A studio example:** the *Daughter of the Inner Stars* team built the closest character they could in MHC, then exported the head mesh and edited the eyes in Blender because MHC couldn't reach the proportions — [Unreal Engine spotlight](https://www.unrealengine.com/spotlights/crafting-stylized-digital-humans-on-daughter-of-the-inner-stars-with-metahuman-and-ue5)
- **Older Mesh to MetaHuman (before 5.8):** "any changes below the lower neck get smoothed out in order to match the body" — [Epic forum: New Mesh to MetaHuman workflow for custom characters](https://forums.unrealengine.com/t/new-mesh-to-metahuman-workflow-for-custom-characters/1275923)

**The web Creator is being retired**
- Notice posted 2026-09-16; access ends **2026-11-05**. Version selections were removed in stages: UE 4.27–5.1 on 2026-04-05, 5.2–5.4 on 2026-06-05, and 5.5 on 2026-11-05. After that there is a 90-day retrieval window through Quixel Bridge, then remaining MetaHumans are deleted. UE 4.27 MetaHumans cannot be migrated — [Epic forum: MetaHuman Creator Web Application is being Discontinued](https://forums.unrealengine.com/t/metahuman-creator-web-application-is-being-discontinued/2695297) (extract)
- Epic's Mark Rein: Creator "is in the engine. You don't need the web version anymore." — [Mark Rein on X](https://x.com/MarkRein/status/2029615980150697990?lang=en)

### Inferences
- **The face path now fits our Linux machine.** For a Linux-only studio on UE 5.8.3, Creator, M2MH and offline facial MHA from video are all officially supported on Linux. Only body capture (markerless or MHA body) still needs Windows. The user's own M2MH test on Linux fits this.
- **Final MetaHumans can't be fully local.** Any final MetaHuman with a face rig and synthesised skin needs Epic's cloud: an account login, network access, and service uptime. The forum failures (5.7, 5.8.1) show this can break unattended pipelines like the desk's "Generate" with "no Claude in between". The user's "slow and restrictive" finding matches these reports: rig jobs of several minutes, timeouts, assembly crashes, realistic-only ranges.
- **The 5.8 Mesh to MetaHuman suits our desk.** It conforms head and body from any topology, so an MHR body designed on the desk (any topology) can go straight into MetaHuman without a manual retopology. The output is then MetaHuman topology and Epic-licensed.
- **The automation surface is enough to drive MetaHuman from the desk** (Python subsystem, batch processing, a Generator toolset in 5.8). It has gaps, and every face or texture change still triggers a cloud call.

### Gaps
- I couldn't open the 5.6, 5.7 and 5.8 release notes in full (proxy). Known-issues lists were not reviewed.
- No Epic source gives the parametric body's numeric slider ranges (height and girth min/max).
- Not confirmed:
  - Whether the MetaHuman Identity flow from video or depth, and the Depth processing plugin, run on Linux in 5.8 (the 5.7 Preview said identity creation wasn't possible on Linux).
  - Which Creator stages are local. The parametric body's local evaluation comes from earlier project notes, not an Epic statement found here.
  - What "MetaHuman Generator toolset" covers exactly (seen only in the 5.8.1 hotfix note).
- No source gives typical auto-rig times under normal service. The only numbers are user reports (150–200 s for Joints Only; 300 s timeouts for Full Rig).

## 2. The MetaHuman licence today: other engines, mixing parts, modification, attribution, fees

### Takeaway
Since UE 5.6 (June 2025), MetaHumans fall under the standard Unreal Engine EULA:
- free to use, in any engine or creative software;
- sellable on Fab and third-party marketplaces;
- no MetaHuman-specific fee. UE's own 5% royalty above $1M lifetime gross per product applies to UE games anyway, and a seat licence is needed only above $1M annual revenue when MetaHumans are rendered outside UE.

The binding restrictions are the AI clauses: no training or testing AI, and no building or enhancing datasets with MetaHuman characters or curves, or with renders crafted to replicate them. MetaHuman characters stay Epic-licensed even when evaluated by the MIT-licensed OpenRigLogic. **I found no source that explicitly allows or forbids putting MetaHuman grooms, textures, eyes or outfits on non-MetaHuman characters.**

### Cited Findings
- Epic's FAQ: from UE 5.6, MetaHuman use is covered by your existing Unreal Engine licence. The UE EULA "provides for MetaHuman characters and animation to be used across all engines and creative software, subject to applicable terms" — [metahuman.com FAQ](https://www.metahuman.com/faq); [metahuman.com/license](https://www.metahuman.com/license) (extract)
- MetaHuman characters and animation are classed as **Non-Engine Products**. Above $1M USD annual gross revenue, rendering MetaHumans outside Unreal Engine needs a UE seat licence — [metahuman.com FAQ](https://www.metahuman.com/faq) (extract)
  - Seat licences were reported at **$1,850/year** in June 2025. This is secondary; I could not reach Epic's pricing page — [CG Channel, 2025-06](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/) (extract)
- MetaHuman assets can be packaged in UE for sale on Fab "as well as on third-party marketplaces" — [metahuman.com FAQ](https://www.metahuman.com/faq) (extract); [Digital Production, 2025-06-05](https://digitalproduction.com/2025/06/05/metahumans-graduate-ready-for-unity-godot-and-the-fab-cash-register/)
- The standalone MetaHuman Creator EULA still applies to the cloud Creator on UE 5.5 and earlier. "If you're using MetaHuman with Unreal Engine 5.6 and beyond, the Unreal Engine EULA applies" — [unrealengine.com/eula/mhc](https://www.unrealengine.com/eula/mhc) (extract)
- **Before 2025** the FAQ said you "must render MetaHumans with Unreal Engine; you cannot render them outside of Unreal Engine" (quoted in a forum thread). The 5.6 change superseded this — [Epic forum: Clarity required on the FAQ on MetaHuman](https://forums.unrealengine.com/t/clarity-required-on-the-faq-on-metahuman/834122)
- A 2026 blog says there is no "cross-engine licensing for Blender / Maya". This contradicts Epic's FAQ and should be treated as an outlier — [StraySpark blog](https://www.strayspark.studio/blog/metahuman-2026-web-app-shutdown-migration-guide)
- **UE royalty:** 5% of worldwide gross revenue above the first $1M USD lifetime gross per product, provided the Release Form is filed. It is due only on off-the-shelf products such as games — [Unreal Engine FAQ](https://www.unrealengine.com/en-US/faq?active); [Road to VR](https://roadtovr.com/unreal-engine-royalty-free-first-1-million-revenue/)
- **AI, EULA update 20:** adds "express language against use of the Licensed Technology as a training input or prompt-based input into Generative AI Programs". A Generative AI Program is defined broadly: "artificial intelligence, machine learning, deep learning, neural networks, or similar technologies designed to automate the generation of or aid in the creation of new content" — [UE EULA change log](https://www.unrealengine.com/eula-change-log/unreal) (extract)
- **AI, EULA update 21:** "Adds a restriction on use of MetaHuman digital characters and animation curves with AI or similar technologies". You may not "use, or permit others to use, MetaHuman digital characters and animation curves (or any rendered output thereof if crafted to replicate the functionality of MetaHuman) to build or enhance any database or training or testing any artificial intelligence" — [UE EULA change log](https://www.unrealengine.com/eula-change-log/unreal) (extract); [Licenseware wiki](https://wiki.licenseware.io/wiki/twinmotion-realityscan-and-metahuman-licensing/)
  - Secondary commentary reads this as: MetaHumans may be used inside AI-driven workflows (NPC dialogue, audio lip-sync, real-time avatars), but not to train or enhance models — [Licenseware wiki](https://wiki.licenseware.io/wiki/twinmotion-realityscan-and-metahuman-licensing/)
  - Forum posters disagree on whether "prompt-based input" reaches beyond training (informal, about two years old) — [Epic forum: NEW EULA AI Restriction?](https://forums.unrealengine.com/t/new-eula-ai-restriction/2068913)
  - An Epic contact reportedly said the EULA forbids MetaHumans as training data — [Epic forum: academic AI training](https://forums.unrealengine.com/t/can-metahuman-be-used-for-ai-training-in-academic-purposes/2037347)
- **OpenRigLogic's MIT scope:** asked to clarify (2026-06-17), the maintainer `andrean-3lateral` (2026-06-18) said "This repository and its MIT license cover only the DNA and RigLogic C++ libraries and Python bindings". It "does not include MetaHuman digital characters and animation curves", which "remain subject to their own specific terms", and "a MetaHuman character created in UE 5.8 remains subject to the Unreal Engine EULA terms" — [GitHub: OpenRigLogic issue #1](https://github.com/EpicGames/OpenRigLogic/issues/1)
- OpenRigLogic's sample assets and the MetaHuman Faceboard Control Rig come separately on Fab under the Fab Standard License — [OpenRigLogic README](https://github.com/EpicGames/OpenRigLogic)
- Fab packaging rules for MetaHuman grooms: the groom must include the skeletal mesh it was authored against, and its UVs must match MetaHuman UV coordinates. This is a marketplace format rule, not a licence term — [Epic docs: Asset Format and Structure Requirements for MetaHumans on Fab](https://dev.epicgames.com/documentation/en-us/metahuman/asset-format-and-structure-requirements-for-metahumans-on-fab) (extract)
- An itch.io seller claims "Metahuman models and all derivative textures remain the exclusive property of Epic Games". This is the seller's statement, not Epic's — [itch.io listing](https://primalbone.itch.io/metahuman-nude-male)
- Who owns a custom MetaHuman was asked on the forum. The answers I found were not authoritative — [Epic forum: Do I own the rights to custom characters made with MetaHuman Creator?](https://forums.unrealengine.com/t/do-i-own-the-rights-to-custom-characters-made-with-metahuman-creator-ue5/541431)

### Inferences
- **Fees:** for commercial UE games under $1M lifetime gross, MetaHuman adds nothing. Above that, the 5% UE royalty applies whether the characters are MetaHumans or MHR-based. The licence doesn't favour either route on cost.
- **The AI clause is the one most likely to bite this project.** A conservative reading of updates 20 and 21 would bar:
  - fitting or training any model (including our MHR fitting or a learned face solver) on MetaHuman meshes, curves or renders;
  - using MetaHuman renders as prompts or inputs to generative image or video tools.

  Driving MetaHumans *with* AI outputs (Kimodo motions, MiniMax-voiced lip-sync) appears to be allowed by the commentary, but I found no explicit Epic text saying so.
- **Mixing parts:** a MetaHuman groom or eye material on an MHR character inside a UE game is probably within the UE EULA's general permission to use Epic content in Products. This is an inference with no confirming text, so verify the EULA's "Content"/MetaHuman sections before shipping. Keeping MetaHuman-derived files out of shared or public repos matches the project's rule that non-CC0 assets stay in the user's own project.
- **No new account needed:** the UE Linux binary and the GitHub source both require an Epic account (§6 sources), so this studio almost certainly has one already. MetaHuman's extra burden is the in-editor login and consent for cloud services.

### Gaps
- I could not read the current UE EULA text or the MetaHuman FAQ in full. Section numbers (e.g. "Section 6(e)") and the dates of EULA updates 20 and 21 were not verified.
- No source found on:
  - any MetaHuman-specific attribution or credit requirement (the UE EULA's general notice requirements were not reviewed);
  - the rules for sharing MetaHuman source files (DNA, textures) with collaborators or in a public repo;
  - whether using MetaHuman grooms, textures, materials, eyes, teeth or outfits on non-MetaHuman characters is expressly allowed.

## 3. What makes MetaHumans look good up close, and which parts a non-MetaHuman character can use

### Takeaway
The close-up advantage is mostly in the face rig. Epic's archetype head DNA has 870 joints and 263 expression controls, and RigLogic evaluates them into joint motion, LOD-0 corrective vertex displacement and 82 animated wrinkle masks. The combinations are clearly nonlinear, which a plain blendshape set (ARKit-52, or MHR's 72) can't reproduce. Alongside the rig:
- scan-derived skin from cloud texture synthesis;
- eye, tearline and occlusion geometry with refractive eye shading;
- strand grooms;
- an 8-level LOD system.

Since June 2026 the rig runtime itself (RigLogic + DNA) is MIT open source, so any tool can evaluate a MetaHuman face. The MetaHuman *characters* stay Epic-licensed, and MHA still solves only onto the MetaHuman control set.

### Cited Findings
- RigLogic takes hundreds of named control channels and maps them to joint transforms, to per-vertex displacement at LOD 0, and to externally connected parameters such as wrinkle triggers. Each control holds the weight of one basic expression — [Epic docs: MetaHuman DNA, Rig Definition, and Rig Operation](https://dev.epicgames.com/documentation/metahuman/metahuman-dna-rig-definition-and-rig-operation?lang=en-US) (extract); [RigLogic whitepaper (PDF)](https://cdn2.unrealengine.com/rig-logic-whitepaper-v2-5c9f23f7e210.pdf) (not read: blocked)
- The face has 8 LODs (0–7). One joint set is shared across all LODs, and lower LODs drop joints. Per-vertex displacement is applied only at LOD 0 — [Epic docs: MetaHuman DNA, Rig Definition, and Rig Operation](https://dev.epicgames.com/documentation/metahuman/metahuman-dna-rig-definition-and-rig-operation?lang=en-US) (extract)
- **Counts measured from Epic's `SKM_Face.dna`** (QtMeshEditor PR, opened 2026-10-18, merged 2026-10-19): "a joint rig (870 joints, 263 `CTRL_expressions.*` controls)", with 82 animated wrinkle masks that the PR leaves unbaked — [GitHub: fernandotonon/QtMeshEditor PR #1104](https://github.com/fernandotonon/QtMeshEditor/pull/1104)
- **What baking the MetaHuman face to ARKit loses** (same PR):
  - 50 ARKit-named morph targets. The ARKit-52 → MetaHuman map has 51 channels, 11 of them approximate.
  - Combined controls are nonlinear: jaw+smile peaks at 4.2 mm, funnel+jaw+brow at 3.3 mm, and pucker+jaw at 16.6 mm ("worst case, clearly nonlinear").
  - `mouthClose` drives no vertices at LOD 0.

  — [GitHub: QtMeshEditor PR #1104](https://github.com/fernandotonon/QtMeshEditor/pull/1104)
- Other sources give different counts: about 700–800 head joints and "710 FACS-driven blend shapes" (a Medium pipeline guide) — [Medium: MetaHuman 5.6/5.7 Pipeline Reference](https://medium.com/@Jamesroha/metahuman-5-6-5-7-pipeline-reference-170d302b078e). This conflicts with the PR's direct count from the DNA file.
- 3Lateral's MetaHuman DNA format "stores a complete description of a rig and its geometry". DNA can be geometry-independent, "enabling the same DNA file to be applied to multiple characters of different shapes and sizes" — [metahuman.com: The tech behind MetaHuman Creator face rigs](https://www.metahuman.com/learning/the-tech-behind-metahuman-creator-face-rigs) (extract)
- Skin (secondary sources):
  - Realism comes from the subsurface-profile shading model, dual-lobe specular and pore-level normals. Albedo, normal, roughness and wrinkle maps are blended, with the wrinkle maps driven by the face's expression values — [yelzkizi: Realistic MetaHumans guide](https://yelzkizi.org/make-metahumans-look-realistic/); [realtime-avatars: MetaHuman pipeline](https://www.realtime-avatars.com/learn/metahuman)
  - Skin textures come from cloud texture synthesis — [Epic docs: Getting Started with MetaHuman Creator in UE](https://dev.epicgames.com/documentation/metahuman/getting-started-with-metahuman-creator-in-unreal-engine?lang=en-US) (extract)
  - Since 5.8 they can be exported unbaked — [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine) (extract)
- Eyes and hair (secondary source):
  - Eyes use layered geometry with refractive corneas, a wet tearline and caustics.
  - Hair is strand-based grooms, including eyebrows, lashes and peach fuzz, with cards as the performance fallback.
  - Cinematic close-ups force LOD 0 (`r.ForceLOD 0`).

  — [yelzkizi: Realistic MetaHumans guide](https://yelzkizi.org/make-metahumans-look-realistic/)

**What a non-MetaHuman character can use**
- **OpenRigLogic (MIT, © 2026 Epic Games)** contains the DNA library (read and write MetaHuman DNA) and RigLogic (real-time rig evaluation), as C++ libraries with Python bindings, "ready to integrate into third-party content creation tools".
  - It runs on Windows, Linux, macOS, consoles and mobile, and builds with C++11 and CMake.
  - The `5.8` branch is "Production-Ready" and `main` is experimental.

  — [GitHub: EpicGames/OpenRigLogic](https://github.com/EpicGames/OpenRigLogic)
- Poly Hammer's free Character DNA add-on for Blender bundles OpenRigLogic. It imports MetaHuman head and body DNA into Blender for editing and sends it back to MetaHuman Creator — [Poly Hammer blog](https://www.polyhammer.com/blog/free-character-dna-addon-openriglogic); [GitHub: poly-hammer/character-dna-addon](https://github.com/poly-hammer/character-dna-addon)
- **MHA output on custom faces:** MHA solves to the standard MetaHuman control set and assumes a full MetaHuman head rig, so animation must be moved onto another rig after solving.
  - An experimental RigMapper plugin in 5.7 is "in very early development".
  - Curves can be transferred to ARKit-named morph targets, but only approximately and with manual tweaks.

  — [Epic forum: Retarget MetaHuman facial animation to custom character](https://forums.unrealengine.com/t/retarget-metahuman-facial-animation-to-custom-character/837213); [Epic forum: Retarget MetaHuman face animation to an external custom skeletal mesh](https://forums.unrealengine.com/t/retarget-metahuman-face-animation-to-an-external-custom-skeletal-mesh-with-different-bones/2330137)
- **Grooms are engine assets.** A Groom Binding asset has a target skeletal mesh and an optional source skeletal mesh "used only if the hair binding is done [on] a different mesh than the one which it has been authored". `GroomLibrary.create_new_groom_binding_asset` takes `source_skeletal_mesh_for_transfer` — [UE 5.1 Python API: GroomBindingAsset](https://docs.unrealengine.com/5.1/en-US/PythonAPI/class/GroomBindingAsset.html). Tutorials bind custom grooms to "your MetaHuman or custom character" — [yelzkizi: PixelHair to MetaHuman](https://yelzkizi.org/pixelhair-to-metahuman-in-unreal-engine-5/)

**MHR for comparison**
- **The model:**
  - 45 identity parameters (20 body, 20 head, 5 hands) and 204 pose parameters.
  - 72 facial expression parameters that are "artist-sculpted, sparse semantic blendshape weights that follow FACS", not PCA and not a one-to-one list of Action Units.
  - 7 LODs (0–6) and neural-network pose correctives.
  - FBX rigs with identity and expression blendshapes, under Apache-2.0.
  - The TorchScript export supports LOD 1 only.

  — [GitHub: facebookresearch/MHR](https://github.com/facebookresearch/MHR)
- **Project measurements:** MHR LOD0 has 73,639 vertices, LOD1 18,437, and LOD2 10,661 (`MHR_hi.fbx`) — project file `/home/user/HorrorEngine/Content/Studio/Bodies/README.md`. The project's `MHR_lod0.fbx` and `MHR_lod1.fbx` contain UV layers and joints named `l_eye`, `r_eye`, `c_teeth` and `c_tongue0–4` (measured locally with `strings`/`grep`). Whether separate eyeball and teeth geometry exists was not checked.

### Inferences
- **MetaHuman's quality has four parts:** (1) the RigLogic face, (2) scan-quality synthesised skin, (3) eye, teeth and tearline assets with shaders, (4) grooms. Parts 2–4 are engine features or assets an MHR character could approximate:
  - Substrate or subsurface skin and the eye shading model are engine-wide.
  - Grooms can be bound to any skeletal mesh.

  Part 1 is the deep moat. MHR's 72 linear expressions have no wrinkle maps and no control-combination correctives, and are far from 870 joints and 263 controls. The QtMeshEditor numbers show that even mapping MetaHuman onto ARKit loses up to about 1.7 cm in combined shapes.
- **OpenRigLogic changes the hybrid options:**
  - The desk (Python) or a custom UE component can now evaluate a real MetaHuman DNA face outside MetaHuman Creator.
  - DNA's geometry independence suggests a DNA rig could be fitted to other head shapes, which is what MHC, M2MH and DNA-editing tools do.

  Any DNA made *from* MetaHuman stays under the UE EULA.
- **MHR's body correctives need conversion for UE.** They are a neural network plus sparse corrective blendshapes (per the MHR asset list), which UE does not run natively. They would have to be baked into pose-driven morphs or approximated, for example with UE's ML Deformer. This is not verified here.

### Gaps
- I could not read the RigLogic whitepaper or Epic's material and shader docs. The skin, eye and groom details above come from secondary tutorials.
- No authoritative per-LOD vertex or joint counts for MetaHuman heads and bodies were found.
- I didn't find whether MetaHuman eye, teeth, tearline and occlusion meshes and materials are licensed for use on non-MetaHuman heads, or how they would be fitted.

## 4. Alternatives and their licences and quality

### Takeaway
None of the free, commercial-use packages found combines a parametric body, a production face rig, strand hair and clothing:
- The free, commercially safe bases are MHR (Apache-2.0), Anny (Apache-2.0 code on CC0 MakeHuman data) and MPFB2 (CC0 assets). They have bodies, basic expressions and (MPFB) simple clothes, but no RigLogic-class face rig or groom library.
- Reallusion CC5 and Daz are complete but Windows-centred, with paid and sometimes contradictory content licences.
- SMPL-X is non-commercial.

MetaHuman remains the only free, complete package, at the price of its cloud dependency and Epic-licensed output.

### Cited Findings

**Body models: open or free**

**MHR (Meta)**
- Apache-2.0, published 2025.
- 45 identity, 204 pose and 72 expression parameters; 7 LODs; neural-network pose correctives; FBX rigs.
- It infers nothing from images itself; the README points to SAM 3D Body for that.

— [GitHub: facebookresearch/MHR](https://github.com/facebookresearch/MHR)

**SAM 3D Body (Meta)**
- Single-image full-body human mesh recovery that outputs MHR parameters. Checkpoints and dataset released 2025-11-19.
- Weights come from Hugging Face after an access request.
- **SAM License (last updated 2025-11-19):** a "non-exclusive, worldwide, non-transferable and royalty-free limited license … to use, reproduce, distribute, copy, create derivative works of, and make modifications to the SAM Materials". You own your derivatives.
- Restrictions:
  - trade-control, ITAR, military and weapons uses are forbidden;
  - no reverse engineering;
  - redistribution must carry the licence.

— [GitHub: facebookresearch/sam-3d-body README](https://github.com/facebookresearch/sam-3d-body); [SAM License](https://raw.githubusercontent.com/facebookresearch/sam-3d-body/main/LICENSE)

**Anny (NAVER Labs Europe)**
- Code under Apache-2.0. Assets are "adapted from MPFB2" under CC0. Facial actions come from the CC0 "Face Units" asset pack.
- Covers "infants to elders" in one topology. Rigs: a compact 104-bone rig, or the full 163-bone MakeHuman rig with face, tongue and eye bones.
- Releases:
  - v0.3 (2026-02-04): SMPL-X topology. The SMPL-X dependency is non-commercial, and the full install "may download non-commercial only assets".
  - v0.5 (2026-06-03): support for NVIDIA's "SOMA" rig and topology.

— [GitHub: naver/anny README](https://github.com/naver/anny); [NAVER Labs blog](https://europe.naverlabs.com/blog/anny-a-free-to-use-3d-human-parametric-model-for-all-ages/)

**MakeHuman / MPFB2**
- Code: GPLv3 (MPFB; MakeHuman itself is AGPL).
- Assets under CC0 1.0: the base mesh and proxies, targets and modifiers, textures, MHCLO clothes, rigs, poses, expressions.
- Output: "the MakeHuman team makes no claim whatsoever over output such as … Exports to files (FBX, OBJ…)".
- Copyright line: "2001-2021 MakeHuman Team".
- Runs as a Blender add-on, so it works on Linux.

— [GitHub: makehumancommunity/mpfb2 LICENSE.md](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md)

**SMPL-X (Max Planck)**
- Licensed for "non-commercial scientific research … non-commercial artistic projects". "Any other use, in particular any use for commercial … purposes is prohibited. This includes … incorporation in a commercial product".
- Training methods for commercial use is also prohibited. Commercial licences come via ps-license@tue.mpg.de.

— [GitHub: vchoutas/smplx LICENSE](https://github.com/vchoutas/smplx/blob/main/LICENSE)

**MB-Lab and CharMorph (Blender)**
- MB-Lab's README calls itself the "Final version of MB-Lab as development has moved onto Charmorph" — [GitHub: animate1978/MB-Lab](https://github.com/animate1978/MB-Lab)
- CharMorph uses MB-Lab's base meshes and morphs, and adds hairstyles and "Rigify support with full face rig" — [GitHub: Upliner/CharMorph](https://github.com/Upliner/CharMorph)
- Licences not verified (see Gaps).

**Sloyd (browser tool)**
- Advertises 45 body-shape parameters, 72 facial-expression controls and 204 pose parameters — exactly MHR's counts, which suggests MHR underneath. Commercial terms unknown — [Sloyd 3D human generator](https://www.sloyd.ai/3d-human-model-generator)

**Commercial character systems**

**Reallusion Character Creator 5 (+ iClone)**
- Launched 2025-08-27. Ships free "Auto Setup for Unreal Engine" and "Character Creator UE Control Rig" plugins.
- Price: perpetual $498 (£369), or about $8.25/month billed annually.

— [Reallusion Magazine, 2025-08-27](https://magazine.reallusion.com/2025/08/27/reallusion-officially-launches-character-creator-5-powering-the-next-generation-of-hd-character-creation/); [CG Channel, 2025-08](https://www.cgchannel.com/2025/08/reallusion-releases-character-creator-5/); [GameFromScratch](https://gamefromscratch.com/reallusion-character-creator-5/) (extract)

- **Windows only:** "iClone 8 and Character Creator 5 only support Windows Operating Systems". Virtual machines are not supported. It needs at least 8 GB VRAM and 200 GB free for the DDS cache. There are no plans for Linux.

— [Reallusion CC5 product page](https://www.reallusion.com/plan-and-pricing/individual/perpetual/character-creator-5-3101); [CC5 manual: System Requirements](https://manual.reallusion.com/Character-Creator-5/Content/ENU/5.0/04-Introducing-the-User-Interface/System-Requirements.htm); [Reallusion forum: Linux version?](https://forum.reallusion.com/451180/Linux-version) (extract)

- **The content licence is contradictory across Reallusion's own pages:**
  - The content policy says the Standard License now covers export "to external tools and engines such as Unreal Engine, Unity" and lists game titles among mass-distribution uses. A new iContent License (in-software use only) costs 30% of Standard.
  - The content store page still says iContent needs an "export license version" for game engines.
  - Another Reallusion page says "Extended Licenses for CC components are required if those components are used on characters in games … for mass distribution".

— [Reallusion Content License Policy](https://www.reallusion.com/license/content.html); [Reallusion content store](https://www.reallusion.com/contentstore/charactercreator-official.html) (extract)

- **CC → MetaHuman pipelines:**
  - Since 2023, Reallusion's CC-to-MetaHuman pipeline transfers "head shape, skin textures, and dynamic wrinkles" into a MetaHuman — [Reallusion Magazine, 2023-04-11](https://magazine.reallusion.com/2023/04/11/cc-to-metahuman-pipeline-available-now/)
  - CC5 continues this ("Character Creator 5 Meets MetaHuman", 2026-02-06) — [Reallusion Magazine, 2026-02-06](https://magazine.reallusion.com/2026/02/06/characters-for-unreal-character-creator-5-meets-metahuman/)

**Daz 3D (Genesis 9)**
- The Interactive License ("use 3D models in interactive ways, like a game") is a per-product add-on, e.g. $50 for Genesis 9 Starter Essentials — [Daz: Genesis 9 Starter Essentials](https://www.daz3d.com/genesis-9-starter-essentials); [Daz licences page](https://www.daz3d.com/daz-licenses)
- Forum consensus: it is needed whenever the game ships the mesh and textures for real-time rendering (hair and clothing products included). Editorial-licensed items can't be used in games at all (informal, 2022–2023) — [Daz forum: Interactive License](https://www.daz3d.com/forums/discussion/665356/daz-interactive-license)
- The Daz Unreal Bridge page lists UE 5.2 as its newest supported version (dated) — [Daz Unreal Bridge](https://www.daz3d.com/unreal-bridge)

**Human Generator Ultimate (Blender add-on)**
- Code is GPL; assets fall under a separate Digital Asset License.
- The commercial tier ($128 on Superhive; personal $68) allows use "in software and video games". Distributing raw model files is not allowed: you can't sell FBX of generated humans or offer extraction as a feature.

— [Human Generator License FAQ](https://help.humgen3d.com/license); [Human Generator pricing](https://humgen3d.com/pricing); [Superhive listing](https://superhivemarket.com/products/humgen3d) (extract)

**Rig services and add-ons**
- Polywink's "MetaHuman Rig" service requires a realistic model. Its separate "Rig on Demand" (236 blendshapes) handles cartoonish characters — [Polywink MetaHuman Rig](https://polywink.com/en/207-metahuman-rig.html); [Polywink Rig on Demand](https://polywink.com/en/14-advanced-rig-on-demand-236-blendshapes.html); [80.lv: Polywink on MetaHuman rig](https://80.lv/articles/polywink-on-creating-characters-with-metahuman-rig) (extract)

**Epic Mutable (runtime character customisation)**
- Still **Beta** in UE 5.5–5.8 and not enabled by default — [Unreal Directive plugin tracker](https://unrealdirective.com/resources/engine-plugins/mutable/) (third-party)
- 5.8 overhauled it ("significant performance improvements and a much better editor workflow", with some bugs slipping through). The sample project broke in 5.8 — [Epic forum: Mutable Sample doesn't work in 5.8](https://forums.unrealengine.com/t/mutable-sample-doesnt-work-in-5-8/2738480)
- Docs — [GitHub: anticto/Mutable-Documentation](https://github.com/anticto/Mutable-Documentation)

**Not researched in depth:** VRoid Studio, MetaPerson/Avatar SDK and Avaturn appear in comparison lists as commercial or stylised options — [Avatar SDK: MetaHuman alternatives 2026](https://avatarsdk.com/metahuman-alternative/) (vendor); [AlternativeTo: MakeHuman alternatives](https://alternativeto.net/software/make-human/?license=free)

### Inferences
- **Licence and platform rule out several options.** For commercial games made on Linux with no account sign-ups:
  - SMPL-X is ruled out (non-commercial).
  - Anny's SMPL-X topology and extras must be avoided; its default CC0/Apache path is fine.
  - CC5 is Windows-only and its licence is unclear.
  - Daz needs a paid licence per product, and its bridge is old.
  - Human Generator is commercially usable from Blender on Linux, but it's paid and forbids redistributing raw files.

  MHR, Anny and MPFB2 are the clean foundations.
- **MHR and Anny connect to the project's other tools.** MHR is also SAM 3D Body's output format, so photo or video → MHR fitting is a maintained path. Anny v0.5's SOMA rig bridges to the Kimodo SOMA skeleton the project already uses (project: `Content/Studio/soma77.json`).
- **No open package matches MetaHuman's face rig, skin synthesis or groom library.** Those parts would be built or bought whichever open base is chosen.

### Gaps
- CharMorph and MB-Lab licences (code and data) were not verified: their LICENSE files weren't at the expected paths.
- Reallusion's licence conflict is unresolved. I could not tell which page is current or whether a CC5 character in a sold game needs Extended licences per component.
- Daz Studio's current platforms and Genesis 9's current game terms come only from the product page and forums.
- No independent quality comparison (close-up face realism, rig quality) between CC5, Daz, Human Generator and MetaHuman was found.
- No comparable studio-wide comparison of these systems for games in 2026 was found.

## 5. Hybrid strategies people use, and what studios report

### Takeaway
The common hybrid runs one way: design or sculpt elsewhere (CC, Blender, scans, an external DCC), then conform into MetaHuman to get its rig (M2MH, the CC-to-MetaHuman route, DNA editing). Studios report editing MetaHuman heads outside Creator to escape its realistic ranges. Using MetaHuman parts on non-MetaHuman characters is mostly grooms and clothing; I found no shipped-game report of MetaHuman faces on custom bodies. Custom bodies are consistently the weakest link in automated routes. 5.8's full-body M2MH from any topology is aimed at exactly that.

### Cited Findings
- **Epic forum, Mesh to MetaHuman custom workflow:** export the conformed face mesh, edit it externally, then auto-rig it onto a chosen body. Changes below the lower neck get smoothed to match the body — [Epic forum: New Mesh to MetaHuman workflow](https://forums.unrealengine.com/t/new-mesh-to-metahuman-workflow-for-custom-characters/1275923)
- **Daughter of the Inner Stars** (Epic spotlight): got as close as possible in MHC, exported the head mesh from UE and edited the eyes in Blender, because MHC couldn't reach the stylised proportions — [Unreal Engine spotlight](https://www.unrealengine.com/spotlights/crafting-stylized-digital-humans-on-daughter-of-the-inner-stars-with-metahuman-and-ue5)
- **Reallusion → MetaHuman:**
  - CC's head shape, skin textures and dynamic wrinkles go into a MetaHuman, and skin detail is added to the MetaHuman body and hands — [Reallusion: Create Custom MetaHumans](https://www.reallusion.com/character-creator/metahuman/); [Reallusion Magazine, 2023-04-11](https://magazine.reallusion.com/2023/04/11/cc-to-metahuman-pipeline-available-now/)
  - An 80.lv walkthrough: sculpt the head in CC5/Headshot 3, generate a rigged body with AI tools from a reference image, and target iClone and MHA pipelines — [80.lv: Stylized characters with CC5 & Headshot 3](https://80.lv/articles/mastering-stylized-characters-with-character-creator-5-headshot-3)
- **Expedition 33 (Sandfall):**
  - A former Sandfall hair and technical character artist describes making Lumière's NPC heads "from scan we did of the team, optimising the metahuman base and shader" — [ArtStation project (amarest)](https://amarest.artstation.com/projects/mAKkdd) (extract). A second project page from the same artist was also surfaced; it's unclear which holds the quote.
  - A Sandfall postmortem (Yokohama, 2026-07-26) included character-creation and tech-art sessions, but its contents were not read — [CGWorld report](https://cgworld.jp/article/202609-coe33-01.html)
  - Unverified: one search summary said Sandfall had to "find some hacks to resculpt the characters and preserve the rigs on the faces". No primary source was found, so treat it as unconfirmed.
- **Fab sellers** ship custom head-and-body sculpts as MetaHuman-compatible characters — [Epic forum: Liminal Interactive custom MetaHuman](https://forums.unrealengine.com/t/liminal-interactive-theon-custom-metahuman-character-02a/2753958); [Fab: Dwarf MetaHuman](https://www.fab.com/listings/400cad70-4f48-4497-98cc-b6bbecafac91)
- **Epic's stylised body rig doc** covers adjusting the body rig for stylised characters — [Epic docs: MetaHuman Stylized Character - Body Rig Editing](https://dev.epicgames.com/documentation/metahuman/metahuman-stylized-character-body-rig-editing?lang=en-US)
- **A MetaHuman head on a custom body** is a recurring forum topic (attaching without sockets) — [Epic forum: attaching a head to a custom rig body](https://forums.unrealengine.com/t/metahuman-properly-attaching-a-head-to-a-custom-rig-body-no-sockets/1261475)
- **DNA round-trip:** the Character DNA add-on imports MetaHuman head and body components into Blender from their DNA files, lets you customise them, then sends them back to MetaHuman Creator — [GitHub: poly-hammer/character-dna-addon](https://github.com/poly-hammer/character-dna-addon)
- **5.8 full-body M2MH:** head and body conformed from any topology, humanoid only — [MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine) (extract)
- **MHA onto custom faces** only approximately: ARKit-named curve transfer, or the experimental RigMapper (5.7) — [Epic forum: Retarget MetaHuman face animation to custom skeletal mesh](https://forums.unrealengine.com/t/retarget-metahuman-face-animation-to-an-external-custom-skeletal-mesh-with-different-bones/2330137)

### Inferences
- **For this studio the evidence-backed hybrid is:**
  - MHR on the desk for design, measures, previs and fast offline iteration. This is what the project already has: the body editor and photo-fitted heads.
  - A MetaHuman for anything seen in close-up, made through the 5.8 Python API: parametric constraints first, full-body M2MH from the desk's mesh when the parametric body refuses a shape.
  - OpenRigLogic to preview the real MetaHuman face in the desk without Unreal.

  The reverse (MetaHuman faces or grooms on MHR bodies in game) has few precedents and runs into the licence gap in §2.
- **Bodies matter less than faces here.** Custom bodies are the weakest link in every automated route. That matters less for a first-person game, where the player mostly sees faces and hands in close-ups.

### Gaps
- I found no postmortem from a game shipped with a custom (non-MetaHuman) body plus a MetaHuman face, or with MetaHuman grooms on fully custom characters. The Expedition 33 postmortem content was not readable.
- No first-hand studio numbers on time saved or lost by hybrid MetaHuman pipelines were found.

## 6. Effort: how long comparable character systems took, and a realistic one-person-plus-AI scope

### Takeaway
Every comparable system took many people and many years:
- MetaHuman grew out of 3Lateral (founded 2008), was acquired by Epic in 2019 plus Cubic Motion in 2020, and only left Early Access in June 2025.
- MakeHuman's assets carry a 2001–2021 copyright line.
- Ubisoft's Wolfskin was researched before Far Cry Primal.

The sources give no team-size or person-month figures. From the component gap (an inference), one person with AI over a few months could make MHR characters good enough at mid distance in UE: skeletal mesh, morphs, ARKit-style face curves, grooms, a skin material. They could not match MetaHuman's close-up faces. That would need a RigLogic-class rig, scan-based skin synthesis and a 4D-trained performance solver.

### Cited Findings
- **3Lateral and MetaHuman:**
  - 3Lateral was founded in 2008 by Vladimir Mastilovic. Epic acquired it in January 2019, with all staff joining Epic — [CG Channel, 2019-01-24](https://www.cgchannel.com/?p=100800); [Epic blog, 2019-01-23](https://www.unrealengine.com/blog/epic-games-welcomes-3lateral-to-unreal-engine-team)
  - 3Lateral's earlier work: "A Boy and His Kite", "Siren", "Digital Andy Serkis", *Hellblade* — [Epic blog, 2019-01-23](https://www.unrealengine.com/blog/epic-games-welcomes-3lateral-to-unreal-engine-team)
  - Cubic Motion joined in March 2020, and the two now work together as the MetaHuman team — [3Lateral: About us](https://3lateral.com/about-us)
  - Mastilovic framed MetaHuman Creator's launch as following "decades of research and development" plus the Cubic Motion and Quixel acquisitions — [PCGamesInsider](https://www.pcgamesinsider.biz/news/71931/epics-metahuman-app-lets-you-create-digital-people-quickly/)
  - MetaHuman left Early Access with the 5.6 release (June 2025) — [metahuman.com](https://www.metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release)
- **MakeHuman:** MPFB's licence carries the copyright line "2001-2021 MakeHuman Team" — [MPFB2 LICENSE.md](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md)
- **Anny:** a NAVER Labs research model with releases on 2025-11-21 (v0.2), 2026-02-04 (v0.3) and 2026-06-03 (v0.5). It reuses MakeHuman's community assets rather than building its own — [GitHub: naver/anny](https://github.com/naver/anny)
- **Far Cry Primal:** Ubisoft's customisation system "Wolfskin was born before Far Cry Primal as part of research on character customization in the game engine Dunia" — [GDC17 summary (J. Lalleve)](https://jlalleve.wordpress.com/2017/03/11/gdc17-character-production-pipeline-customization-system-on-far-cry-primal/)
- **Destiny:** Bungie's GDC 2014 talk on customisable characters described a modular "mash up" approach. The summary notes the tools "were still in a work in progress mode", which slowed content creation — [Game Developer](https://www.gamedeveloper.com/audio/learn-all-about-i-destiny-i-s-customizable-character-design-at-gdc-2014); [Bungie forum summary](https://www.bungie.net/en/Forums/Post/64332998?page=0)
- **Unreal on Linux needs an Epic account:**
  - The 2022 Linux binary editor required accepting the EULA and being "logged in with an Epic Account" — [GamingOnLinux, 2022-07](https://gamingonlinux.com/2022/07/unreal-engine-5-editor-quietly-gets-a-proper-linux-version)
  - Building from source requires linking GitHub to an Epic account — [UE 4.26 Linux docs](https://docs.unrealengine.com/4.26/SharingAndReleasing/Linux/BeginnerLinuxDeveloper/SettingUpAnUnrealWorkflow)
- **What the project already has:**
  - A body editor on MHR's whole body: 45 identity sliders, bases, a height.
  - A face from up to two pictures, bent onto MHR's head by `face_mesh.py` (MediaPipe).
  - OBJ export.
  - GarmentCode clothing experiments and a glass-skin texture set.

  — project `/home/user/HorrorEngine/CLAUDE.md` (tools/body, face_mesh, garment, glass_skin rows)

### Inferences
These are reasoned estimates, not sourced figures.

**Feasible in roughly 1–3 months for one person plus AI, building on what exists:**
- MHR → UE skeletal mesh per character: identity baked, the 72 expressions as morph targets, and the 7-level LOD chain from MHR's own LODs.
- A curve map from ARKit-52 (Live Link Face / MediaPipe) to MHR's 72 expressions. This would be approximate, as the PR #1104 losses show.
- A skin material on UE's subsurface/Substrate with the project's glass-skin textures.
- Hand-fitted eye, teeth and tearline meshes.
- Strand grooms authored in Blender and bound with Groom Binding (one source mesh, transferred to each identity).
- Baked approximations of MHR's pose correctives.
- Clothing from GarmentCode or Chaos Cloth.

**Unlikely in months, and the source of MetaHuman's close-up quality:**
- A RigLogic-class face: about 870 joints, 263 controls, nonlinear combination correctives and 82 wrinkle masks, built from 4D scan data.
- Per-character skin synthesis from a scan database.
- An MHA-equivalent video-to-rig solver.

Even 3Lateral needed about a decade plus acquisitions for these.

**What follows:**
- **Pure "build on MHR"** gives local, account-free, fully automatable characters whose faces will look clearly below MetaHuman in close-up. That is the case this project cares most about.
- **The hybrid** (MHR for design and previs, MetaHuman for final faces, OpenRigLogic for previews) keeps the moat Epic has built. Its cost is the cloud step, Epic-licensed output and the AI clause.
- **A third option worth weighing:** an MHR or Anny body with a MetaHuman face via M2MH, if a custom body matters more than an Epic-native one.

### Gaps
- I found no talk or postmortem with team sizes or person-months for an in-house character creator or face-rig system. The Far Cry Primal and Destiny talks were only available as summaries.
- No source reports a solo or AI-assisted developer building a MetaHuman-class system. The scope estimate above is inference only.
- MetaHuman Creator's Early Access start date was not checked against a dated source. PC Gamer covered the early access ([PC Gamer](https://www.pcgamer.com/metahuman-creator-early-access-epic/)), but the page was not read.
