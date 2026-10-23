# Face mocap for MHR heads: takes (front-on face video + Japanese audio) into blendshape curves in UE 5.8 on Linux

Researched 2026-10-21. A note on how sources were read: in this session only github.com and raw.githubusercontent.com
could be opened directly. Hugging Face, arXiv, docs.nvidia.com, dev.epicgames.com, metahuman.com,
developers.google.com, nvidia.com, cgchannel.com and note.com could not be fetched (DNS failure or proxy refusal). So
findings from those sites come from search-engine result summaries and are marked **(search summary)**. Findings marked
**(read)** come from opening the primary file or page itself, including source code in the MHR, ComfyUI, MediaPipe and
Audio2Face-3D-SDK repos.

## 1. MediaPipe Face Landmarker blendshapes: quality limits, smoothing, what it is good for

### Takeaway
MediaPipe returns 52 scores per frame: `_neutral` plus 51 ARKit names, with **no tongueOut**. It has no temporal model.
In practice several channels are dead (jaw sideways and forward, cheekPuff, dimples), jawOpen saturates, and eyes and
brows read low. It is good for blinks, gaze, lids, brows, cheek and nose, and head pose. It is weak for speech lips. For
offline takes it needs a per-channel baseline and gain calibration, plus zero-phase smoothing that leaves blinks sharp.

### Cited Findings
- **The output set has no tongueOut.** MediaPipe's own face-blendshapes graph enumerates its categories up to
  "51 - noseSneerRight" ([MediaPipe face_blendshapes_graph.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/face_landmarker/face_blendshapes_graph.cc), read via code search).
  ComfyUI's pure-PyTorch port of `face_landmarker_v2_with_blendshapes.task` lists `BLENDSHAPE_NAMES` in model output
  order, starting with `"_neutral", "browDownLeft", …`, and returns a `(B, 52)` tensor (read) ([ComfyUI face_landmarker.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/mediapipe/face_landmarker.py)).
- **Some channels are practically dead.** A DroidKaigi 2026 talk (practitioner abstract, not peer reviewed) reports
  that cheekPuff, tongueOut, jawForward, jawLeft, jawRight and mouthDimpleLeft/Right "practically always return values
  near 0". It adds that this has been raised in GitHub issues for over two years and that Google's improved model has not
  been integrated into MediaPipe. It says the 478 landmarks "stay usable" and derives the weak shapes from landmark
  geometry instead (search summary) ([DroidKaigi 2026 talk](https://2026.droidkaigi.jp/en/timetable/1236039/)). This
  talk names tongueOut although the graph above has no such channel; either the talk means another build or it is listing
  ARKit names loosely. Either way there is no usable tongue output.
- **There is no temporal smoothing inside the model.** The port processes each frame independently with "no temporal
  filter". Landmarks are normalised and the outputs pass through a sigmoid into [0, 1] (read) ([ComfyUI face_landmarker.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/mediapipe/face_landmarker.py)).
- **Head pose is available.** The Face Landmarker graph has an optional `FACE_GEOMETRY` output, "A vector of 3D transform
  data for each detected face" ([MediaPipe face_landmarker_graph.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/face_landmarker/face_landmarker_graph.cc), read via code search).
- **The scale differs by channel.** The documentation for ComfyUI's SAM3DBody_FaceExpression node says MediaPipe's jawOpen
  saturates near 1.0. Eye values rarely exceed 0.5, so 2 to 3× gain is "often needed". Brows output about 0.1 to 0.3
  (search summary) ([ComfyUI node docs](https://docs.comfy.org/built-in-nodes/SAM3DBody_FaceExpression)).
- **Jitter is a known problem.** A 2026 arXiv paper on blendshape calculation says MediaPipe's detection stage adds
  regression error and jitter that is "especially noticeable for sensitive blendshape calculation", so smoothing is
  needed. It used MediaPipe Holistic v0.9, which may not match the current Face Landmarker (search summary) ([arXiv 2601.08234](https://arxiv.org/pdf/2601.08234)).
  A sign-language benchmark found MediaPipe face jitter "moderate", with a wide spread across sequences on low-resolution
  video (search summary) ([arXiv 2604.24609](https://arxiv.org/pdf/2604.24609)).
- **Official usage notes.** Smoothing applies only when a single face is tracked. Left and right blendshapes refer to the
  subject's face, so mirrored input swaps them (search summary) ([Google Face Landmarker web guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)).
- **How ComfyUI smooths it (read).** `smooth_blendshape_series` applies a Gaussian filter: default window 7, sigma =
  max(1.0, window/5), edge-padded, applied before mapping. `subtract_per_clip_baseline` subtracts each channel's 5th
  percentile and clamps at 0. `fill_detection_gaps` interpolates gaps up to 12 frames (or holds, or zeros). An optional
  deadzone is skipped for jaw* channels ([ComfyUI face_expression.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/sam3d_body/face_expression.py)).
- **The One Euro filter.** A GitHub discussion comment says recent MediaPipe code uses the One Euro filter by default (for
  landmarks), and that its parameters depend heavily on frame rate. This is an unverified user comment ([tf-lite-unity-sample discussion #287](https://github.com/asus4/tf-lite-unity-sample/discussions/287)).
  A Bournemouth SCA 2026 poster proposes "Adaptive Velocity-Confidence Smoothing", a One Euro variant, for monocular pose
  jitter ([Bournemouth eprint 42215](https://eprints.bournemouth.ac.uk/42215/)).
- **A competing tracker.** OpenSeeFace's author says its landmarks "remain more stable in challenging conditions" than
  MediaPipe's, but that its eye-region tracking "can be less accurate" (read) ([OpenSeeFace](https://github.com/emilianavt/OpenSeeFace)).

### Inferences
- **What it is good for:** blinks (eyeBlink*), gaze (eyeLook*), lids (eyeSquint*, eyeWide*), brows, cheekSquint, noseSneer,
  the emotional mouth corners (mouthSmile*, mouthFrown*), and head rotation from the transform matrix.
- **What it is weak for:** speech. jawOpen saturates, the lateral and forward jaw is missing, there is no tongue, and
  pucker, funnel, press and roll are unmeasured (see Gaps). This matches the user's concern.
- **Smooth zero-phase, because the takes are offline 10 s clips.** Use forward-backward One Euro or Butterworth, or
  Savitzky–Golay, rather than a causal filter, so nothing lags. Treat blink channels separately: a Gaussian window of 7
  frames at 24–30 fps covers 0.23–0.29 s, a whole blink, and will flatten it.
- **Calibrate each take:**
  - Subtract a neutral baseline: the 5th percentile, as ComfyUI does, or a known neutral frame.
  - Apply per-channel gains: eyes and brows ×2–3.
  - Soft-clip jawOpen.
  - Rebuild the dead channels (jaw sideways, cheekPuff, mouth roll) from landmark distances, as DroidKaigi suggests.
- **The lips in a take are synthetic.** The lip motion in AI-generated takes was produced by the video model. Tracking
  it copies that model's lip errors, so lips taken from the audio should be the primary source (see Q5).

### Gaps
- No lip-specific accuracy figures were found for MediaPipe's blendshapes (pucker, funnel, press, roll). They would have
  to be measured on our own takes.
- Google's model card for the blendshape model (training data, intended use) couldn't be opened.
- It isn't confirmed whether MediaPipe's video mode applies the One Euro filter to blendshapes or only to landmarks.

## 2. NVIDIA Audio2Face-3D: what was opened, licences, outputs, Linux/offline/no account, Japanese, UE versions, standalone export

### Takeaway
NVIDIA released the code as open source (SDK under MIT, training framework under Apache-2.0). The model weights are
open but under the NVIDIA Open Model License, which allows commercial use but is revocable and can be updated. The SDK
runs on Linux and outputs skin and tongue geometry, a jaw transform and eye rotations, with an optional blendshape
solver (the sample rig is ARKit-52 including tongueOut). The UE plugin is no help on our machine: its local execution
is Windows-only and it has builds only for UE 5.4 to 5.6. The realistic route is baking curves offline with the SDK on
Linux, without Audio2Emotion, which is gated behind a Hugging Face account. The models were trained on English and
Mandarin, and **no Japanese test was found**.

### Cited Findings
- **Components and licences (read, NVIDIA's collection repo)** ([NVIDIA/Audio2Face-3D](https://github.com/NVIDIA/Audio2Face-3D)):

  | Component | Form | Licence |
  |---|---|---|
  | Audio2Face-3D SDK | C++ and Python source | MIT |
  | Training Framework v1.0 | Python and Docker | Apache |
  | Maya ACE v2.0 | Maya plugin | MIT |
  | UE5 plugin v2.5 | plugin and source | MIT |
  | NIM | Docker container | "NVIDIA Software License Agreement and Product Specific Terms for AI Products" |
  | A2F models v2.3 and v3.0 | open weights, onnx-trt | "Nvidia Open Model" |
  | Audio2Emotion v2.2 and v3.0 | open weights | "Custom (use allowed with Audio2Face only)" |
  | Claire training dataset v1.0.0 | sample data | "Custom (evaluation only)" |

  The listed UE downloads are ACE Unreal 5.6 (v2.5.0rc3), 5.5 (v2.5.0rc3) and 5.4 (v2.4.0), plus the 3.0 and 2.3 Models
  plugins. The models are described as "Regression (v2.3) and diffusion (v3.0) pre-trained models for generating
  lip-sync", in the variants v3.0, Mark v2.3, Claire v2.3.1 and James v2.3.1.
- NVIDIA's ACE for Games page says the open weights in ONNX-TRT format are under the NVIDIA Open Model License and the SDK
  is C++ and Python source under MIT (search summary) ([ACE for Games](https://developer.nvidia.com/ace-for-games)).
- **Model cards (search summary):**
  - v3.0 says "Use of this model is governed by the NVIDIA Open Model License" and calls it ready for commercial and
    non-commercial use. Its architecture is "Transformer, Diffusion" with a HuBERT network, about 1.80×10^8 parameters.
    The audio training data is under 10,000 hours, labelled "Human - Commercial capture solution and internal labeling"
    ([HF Audio2Face-3D-v3.0](https://huggingface.co/nvidia/Audio2Face-3D-v3.0)).
  - Claire v2.3.1 is "Transformer, CNN" with Wav2vec2.0, 3.98×10^7 parameters ([HF Claire v2.3.1](https://huggingface.co/nvidia/Audio2Face-3D-v2.3.1-Claire)).
- **NVIDIA Open Model License terms (search summary of a mirrored text dated 2025-04-28; NVIDIA's own page couldn't be
  opened)** ([Wind River mirror](https://open.windriver.com/info/uni-license-list/licenses/nvidia-open-model-2025-04-28.html), [ScanCode entry](https://scancode-licensedb.aboutcode.org/nvidia-open-model-2025.yml)):
  - It grants a perpetual, worldwide, royalty-free licence that covers selling and distributing, but it is revocable
    under §2.1.
  - The licence ends on filing copyright or patent litigation over the model.
  - It terminates automatically if you bypass, disable or reduce the efficacy of a guardrail without a substantially
    similar substitute.
  - NVIDIA may update the terms; you must then comply or stop using the model.
  - An output is not a "Derivative Model".
- **SDK requirements (read)** ([NVIDIA/Audio2Face-3D-SDK](https://github.com/NVIDIA/Audio2Face-3D-SDK)):
  - OS: "Windows 10/11 or Linux (Ubuntu 20.04+)".
  - CUDA ">=12.8, <13.0 (12.9 is recommended)" and TensorRT ">=10.13, <11.0".
  - Python 3.8 to 3.10 for the download and test-data scripts; g++, make and CMake on Linux.
  - "8GB+ RAM, 4GB+ GPU memory".
  - A `download_models` script fetches the models from Hugging Face, and `gen_testdata` converts them to TensorRT.
  - The sample "does not include a GUI". Results can go to a ".bin" file for a DCC tool or to Maya-ACE. The executables
    are `sample-a2f-executor`, `audio2face-unit-tests` and `audio2face-benchmarks`.
  - At fetch time the repo had no releases and a single commit.
- **The account requirement (read).** "`Audio2Emotion` models are gated on Hugging Face and require a license
  click-through tied to your Hugging Face account", plus a user access token with gated-repo read permission ([SDK README](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/README.md), via code search).
  The README says this about Audio2Emotion specifically. For the Audio2Face model repos, no gating statement was found.
- **Outputs (read)** ([SDK docs/README.md](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/docs/README.md)):
  - Skin geometry vertex positions and tongue geometry vertex positions.
  - "Anchor point positions from which the jaw rigid transform (rotation and translation) can be extracted".
  - Eye rotation.
  - An optional blendshape solver, in a GPU and a CPU version. It finds "the weights that best match the output from
    geometry executors" on "an existing blendshape rig".
- **Timing and emotion (read, same SDK docs):**
  - The diffusion model "generates 60 frames per second, but half of them are discarded". The regression model "can
    produce frames for any frame rate".
  - Multi-track executors suit offline, high-throughput work, and results arrive through callbacks.
  - Audio2Emotion classifies six emotions (angry, disgust, fear, happy, neutral, sad) and expects 16 kHz audio. Emotions
    "should either be provided by the user to match the intent or can come straight from Audio2Emotion", and can be a
    constant or "animated values from DCC animation curves".
  - The execution options are Skin, Tongue, Jaw and Eyes ([executor.h](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/audio2face-sdk/include/audio2face/executor.h)).
- **The bundled blendshape set is ARKit-52 including tongueOut (read via code search).** The SDK test asserts
  `poseNamesSize == 52`, `poseNames[0] == "eyeBlinkLeft"` and `poseNames[51] == "tongueOut"` ([test_core_parse_helper.cpp](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/audio2face-sdk/tests/test_core_parse_helper.cpp)).
  A separate `bs_tongue_config.json` exists ([gen_sample_data.py](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/audio2face-sdk/scripts/gen_sample_data.py)).
  The regression model's outputs are PCA coefficients for skin and for tongue ([model_regression.h](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/audio2face-sdk/include/audio2face/model_regression.h)).
- **The Audio2Face-3D paper (search summary)** ([arXiv 2508.16401](https://arxiv.org/html/2508.16401v1)):
  - The solver works with any blendshape model, and ARKit was chosen for compatibility. Canonical ARKit shapes "may not
    precisely match a given character's expressions".
  - The actors "performed sentences covering most of the English or Mandarin pronunciations".
  - Including silence data in training improves "lip sync quality and multi-lingual capabilities".
- **An older doc conflicts on tongue and eyes.** NVIDIA's Audio2Face microservice 1.0 documentation says Audio2Face "does
  not animate head, tongue and eye movement" (search summary) ([archive doc 1.0](https://archive.docs.nvidia.com/ace/audio2face-3d-microservice/1.0/text/architecture/audio2face-ms.html)).
  That is an older release; the current SDK outputs tongue, jaw and eyes, but still no head motion.
- **Training Framework (read)** ([NVIDIA/Audio2Face-3D-Training-Framework](https://github.com/NVIDIA/Audio2Face-3D-Training-Framework)):
  - Apache-2.0. Runs on "Linux or WSL2 (Ubuntu 22.04 recommended)" with a CUDA GPU of at least 6 GB VRAM, Docker and
    NVIDIA Docker; Linux driver 575.57 to 579.x.
  - Inference can "Generate animations in .npy format or Maya cache (.mc) format", with "precise motion for the skin,
    jaw, tongue, and eyes".
  - It supports custom models for specific "characters, languages, or artistic styles". The sample dataset "may need"
    Hugging Face authentication.
- **The UE plugin on Linux (search summary)** ([ACE Unreal plugin 2.5 Audio2Face doc](https://docs.nvidia.com/ace/ace-unreal-plugin/2.5/ace-unreal-plugin-audio2face.html)):
  - Linux is supported for **remote** execution only: 64-bit Linux with libstdc++ 6.0.30+, Ubuntu 22.04+, Fedora 36+ or
    Debian 12+.
  - **Local** execution needs 64-bit Windows 10+, an Ampere, Ada or Blackwell GPU, driver 551.78+, and about 2.9 to
    4.4 GiB of VRAM.
  - An NVIDIA forum thread says the local NvAudio2FaceMark plugin (v3.0, UE 5.6) "currently only supports Windows
    (Win64)" and that no prebuilt Linux version is known ([NVIDIA forum](https://forums.developer.nvidia.com/t/ace-linux-support-for-nvaudio2facemark-plugin-audio2face-3d-local-execution/348812)).
  - The 2.3 changelog said "no Linux Audio2Face support currently" ([ACE 2.3 changelog](https://docs.nvidia.com/ace/ace-unreal-plugin/2.3/ace-unreal-plugin-changelog.html)).
- **No UE 5.7 or 5.8 build was found.** At Unreal Fest 2026 NVIDIA announced the ACE Game Agent SDK and "new Unreal
  Engine 5 plugins"; the snippet gives no engine versions (search summary) ([NVIDIA blog](https://developer.nvidia.com/blog/build-on-device-ai-companions-with-the-nvidia-ace-game-agent-sdk-and-unreal-engine-5-plugins/)).
- **Non-MetaHuman characters need extra steps.** The ACE plugin docs say it works well with MetaHumans and that a
  non-MetaHuman character requires extra steps (search summary) ([ACE plugin character animation doc](https://docs.nvidia.com/ace/ace-unreal-plugin/2.5/ace-unreal-plugin-animation.html)).
- **NGC needs a sign-in.** The NGC model page says "signing in will also allow download access" (search summary) ([NGC Audio2Face-3D model](https://catalog.ngc.nvidia.com/orgs/nim/nvidia/models/audio2face_3d_model/-)).
- **Japanese evidence:**
  - No benchmark or test of Audio2Face-3D on Japanese was found.
  - An older CGWorld case study (Omniverse Audio2Face era) recorded English because "日本語音声にはまだ対応していない"
    ("Japanese speech isn't supported yet") (search summary) ([CGWorld](https://cgworld.jp/special-feature/cyberhuman-productionsomniverse-audio2face.html)).
  - Reallusion's vendor page describes Claire as "tailored for female characters proficient in Asian languages"
    (search summary; a vendor claim) ([Reallusion Audio2Face page](https://www.reallusion.com/iclone/nvidia-omniverse/Audio2Face.html)).

### Inferences
- **The licence is acceptable for a sold game.** Commercial use is allowed and outputs are not derivatives, but the
  licence is revocable and can be updated. Archive the exact licence text that ships with the downloaded model version.
  The guardrail clause has little practical bite here: there is no safety filter in this use to bypass.
- **Skip Audio2Emotion.** It avoids the Hugging Face account and A2E's custom licence. Drive emotion with constant or
  per-take curves instead; the SDK supports user-provided and animated emotion values. Each take could take its mood
  from story.json.
- **Offline on Linux is feasible through the SDK, not through the UE plugin.** The plugin's local execution is
  Windows-only and has no 5.8 build.
- **Run the SDK in a container on Arch.** Arch's packaged CUDA is likely already 13.x by late 2026, outside the SDK's
  `<13.0` window, so use an Ubuntu 22.04 container with CUDA 12.9 and TensorRT 10.x. This is unverified. The RTX 3090
  (Ampere, 24 GB) clears the GPU requirements.
- **Two ways to put the output on MHR:**
  - **(a) The quick route:** solve to the bundled ARKit-52 rig, then map ARKit to MHR (Q4).
  - **(b) The better route:** wrap MHR's 72 expression shapes onto the A2F identity mesh and hand the solver that rig, so
    it fits MHR weights directly. Then drive the jaw transform into `c_jaw`, the eye rotations into `l_eye`/`r_eye`, and
    fit the tongue geometry into `c_tongue0-4` rotations, which is custom code. Route (b) skips the ARKit bottleneck:
    ARKit has no lipTightener, cheekSuck, nostrils or quadrant lip control.
- **The standalone export path.** Write a small C++ harness over the SDK's multi-track executor callbacks that dumps,
  per frame at the take's fps: solved weights, jaw transform, eye rotations and tongue data, as JSON or NPZ. For a 10 s
  take this is seconds of work.
- **Japanese, from general phonetics (not sourced here).** The models learnt from English and Mandarin. HuBERT and
  wav2vec2 features carry acoustics more than language, and Japanese's five vowels and consonant–vowel structure are
  acoustically simple, so it should mostly work. The risks to check:
  - English-style lip rounding on Japanese /u/, which is usually compressed or unrounded.
  - Closures on the moraic nasal ん and on geminate っ.
  - Whispered or devoiced vowels in quiet horror lines.

  Test on 3 to 5 takes before committing.

### Gaps
- The Hugging Face model cards couldn't be opened, which leaves open:
  - whether the Audio2Face model repos (as opposed to Audio2Emotion) are gated;
  - each model's exact output dimensions;
  - which languages Mark, Claire and James were each trained on.
- No Japanese test of Audio2Face-3D was found anywhere.
- It isn't verified whether the Training Framework's Docker inference can run the released v2.3 and v3.0 models
  unchanged; it may only run models trained with it.
- It isn't verified whether TensorRT 10.x can be obtained without an NVIDIA developer login. PyPI wheels or NGC
  containers may avoid one.
- A Japanese blog reportedly got "68 ARKit blendshape weights at 30 fps as CSV" from NVIDIA's cloud API (seen only in a
  search summary). The page couldn't be opened, so the 68-channel claim (52 plus tongue?) is unverified. That route is
  cloud and needs an API key anyway.
- Hugging Face also hosts distilled derivatives, `myned-ai/wav2arkit_cpu` and the datasets
  `myned-ai/audio2face-mediapipe-arkit-teacher` and `…-emotion-arkit-teacher`
  ([HF wav2arkit_cpu](https://huggingface.co/myned-ai/wav2arkit_cpu)). Their licences and quality weren't checked.

## 3. Better or complementary alternatives (late 2026), split by licence

### Takeaway
The big change is **MetaHuman Animator in 5.8**. It now runs facial animation offline on Linux, from mono video and from
audio, locally and free within UE. Its output, though, is MetaHuman face-rig curves that have to be mapped onto MHR.
Every other commercial-clean option is a component: MediaPipe, OpenSeeFace, LAM-A2E, uLipSync's method, and the
Japanese text tools pyopenjtalk and MFA. Most research face trackers and audio-to-face models are non-commercial, either
directly or through FLAME, VOCASET or BIWI.

### Cited Findings
**Usable commercially, or close to it:**
- **MetaHuman Animator 5.8:**
  - "MetaHuman Animator now supports Linux and macOS": you "can generate facial animation from performance capture on
    Linux and macOS", and "Offline and real-time facial MetaHuman Animator functionality is available on Linux and
    macOS" (search summary) ([MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine?lang=en-US)).
  - "Body animation features are currently only available on Windows", and "Real-time facial animation on Linux is only
    available using Live Link Face" (same source).
  - New real-time and offline models deliver "improved solve quality across a wider range of capture conditions". A new
    real-time audio model adds procedural blinks and automatic emotion detection (search summary) ([MetaHuman 5.8 news](https://www.metahuman.com/news/metahuman-5-8-is-now-available)).
  - In 5.7, MetaHuman Creator came to Linux, while Animator on Linux was "planned for a future release" (search summary)
    ([MetaHuman 5.7 release](https://www.metahuman.com/releases/metahuman-5-7-is-now-available)).
- **MHA audio-driven animation:**
  - Offline processing has solve parameters for "head movement, blinks, and mood" (search summary) ([Epic: Audio Driven Animation](https://dev.epicgames.com/documentation/metahuman/audio-driven-animation)).
  - It takes any audio UE accepts as a SoundWave, and no language list was found (search summary) ([Epic, Japanese page](https://dev.epicgames.com/documentation/ja-jp/metahuman/audio-driven-animation)).
- **MHA from mono video:**
  - Needs UE 5.6 or later, the MetaHuman Animator plugin, and Live Link Hub with the Capture Manager; footage is ingested
    through a "Mono Video" device (search summary) ([Epic: Animation from mono video](https://dev.epicgames.com/documentation/metahuman/animation-from-mono-video)).
  - Capture guidance: HD or 4K at **60 fps**, H.264 at CRF 18 or better, about 25 Mbps for HD, flat light. The face
    should fill at least 1/30 of the frame, and a face under 40×80 px "is likely to fail" (search summary) ([Epic video capture guidelines](https://dev.epicgames.com/documentation/metahuman/metahuman-animator-video-capture-guidelines-in-unreal-engine)).
  - The export offers a "Performer Skeleton" option for retargeting to non-MetaHuman characters (search summary) ([Epic: process and export](https://dev.epicgames.com/documentation/metahuman/metahuman-animator-02-process-and-export-your-animation-in-unreal-engine?lang=en-US)).
- **MetaHuman Animator Markerless Motion Capture plugin (UE 5.8, free).** It "takes a video and captures the 3D motion
  of the body, face, and hands" ([Michael Black on X](https://x.com/Michael_J_Black/status/2067342601511141875)); the
  body features are Windows-only per the 5.8 notes above.
- **MetaHuman licensing, with conflicting secondary sources:**
  - June 2025 coverage says MetaHumans can now be used "in any game engine or DCC application, including in commercial
    projects", under the standard UE EULA (search summary) ([CG Channel](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/), [Digital Production](https://digitalproduction.com/2025/06/05/metahumans-graduate-ready-for-unity-godot-and-the-fab-cash-register/)).
  - An April 2026 migration guide disputes cross-engine use (search summary) ([StraySpark guide](https://www.strayspark.studio/blog/metahuman-2026-web-app-shutdown-migration-guide)).
  - One June 2025 report says "the authoring workflow within the local editor is powered by a cloud service" (search
    summary, same CG Channel and Digital Production results).
- **ARKitRemap (community)** ([Dylanyz/ARKitRemap](https://github.com/Dylanyz/ARKitRemap), read):
  - It converts MHA facial performances into ARKit-52 curves through Epic's RigMapper plugin: the asset
    `RM_MHA_to_ARKit` takes 164 MHA curves in and gives 52 ARKit curves out. It is built and tested on UE 5.8.
  - Its licence is "CPAL-1.0 with the Commons Clause": "Nobody may sell or repackage it". Releases before 2026-10-06
    were MPL-2.0.
- **NVIDIA Maxine AR SDK:**
  - Its "Face Expression Estimation … estimates face expression (blendshape) coefficients from the provided facial
    landmarks" ([NVIDIA/MAXINE-AR-SDK](https://github.com/NVIDIA/MAXINE-AR-SDK)). The GitHub repo holds the headers and
    samples, not the models (search summary).
  - The Linux SDK 0.8.8.1 (EA and GA, June 2025) is on NGC. Early Access is "available by request only", and GA routes
    to an NVIDIA AI Enterprise subscription (search summary) ([NGC Maxine Linux AR SDK EA](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/maxine/resources/maxine_linux_ar_sdk_ea), [NGC collection](https://catalog.ngc.nvidia.com/orgs/nvidia/maxine/collections/maxine_linux_ar_sdk_collection/-)).
- **Live Link Face.** That workflow "requires an iPhone (12 or above) and a desktop PC running Windows 10/11" (search
  summary) ([App Store listing](https://apps.apple.com/us/app/-/id1495370836)).
- **OpenSeeFace (read)** ([OpenSeeFace](https://github.com/emilianavt/OpenSeeFace)):
  - "The code and models are distributed under the BSD 2-clause license". It tracks 66 landmarks (close to iBUG 68) on
    the CPU through ONNX Runtime and accepts "webcam input or video file".
  - Custom expressions need per-user calibration with LIBSVM, and it has no ARKit blendshape set.
  - The release binary is for Windows; on Linux it runs from Python and uv, unofficially.
- **LAM_Audio2Expression (Alibaba aigc3d, read)** ([aigc3d/LAM_Audio2Expression](https://github.com/aigc3d/LAM_Audio2Expression)):
  - The repo is Apache-2.0 and generates "ARKit blendshapes-driven facial expressions in ⚡real-time⚡" from audio, with
    a Wav2Vec encoder. The authors "adapted ARKit blendshapes to align with FLAME's facial topology through manual
    customization".
  - Weights come from Hugging Face (`3DAIGC/LAM_audio2exp`) or ModelScope. It needs Python 3.10 and CUDA.
  - The page states no training data and no languages.
  - A UE 5.8 runtime plugin exists for **Win64 only**: MIT code, with upstream models stated as Apache-2.0 (search
    summary) ([yeczrtu/LAMAudio2Expression-UE](https://github.com/yeczrtu/LAMAudio2Expression-UE)).
- **Rhubarb Lip Sync.** Its default PocketSphinx recogniser is English-only. The `phonetic` recogniser is
  language-independent but "usually less precise" (search summary) ([Rhubarb README, fork mirror](https://github.com/despossivel/rhubarb-lip-sync)).
- **uLipSync (read)** ([hecomi/uLipSync](https://github.com/hecomi/uLipSync)):
  - MIT. It compares MFCCs against registered "A, I, U, E, O, N" profiles, and the profile labels can be hiragana or
    katakana.
  - "Pre-bake data can be converted to AnimationClip", and it integrates with Timeline. It is Unity-only.
  - There is a WebAudio/WASM port, wLipSync ([mrxz/wlipsync](https://github.com/mrxz/wlipsync)).
- **CRI LipSync (commercial Japanese middleware).** It used five mouth shapes for a/i/u/e/o; CRI LipSync Alive (December
  2025) outputs more curves (search summary) ([CRI blog](https://blog.criware.com/index.php/2025/12/23/cri-lipsync-alive-released/)).
- **pyopenjtalk (read)** ([r9y9/pyopenjtalk](https://github.com/r9y9/pyopenjtalk)): MIT, with Open JTalk under
  "Modified BSD". `g2p("こんにちは")` returns `'k o N n i ch i w a'`, and full-context labels are available. It runs on
  Linux.
- **Montreal Forced Aligner.** A Japanese pretrained model (v2.0.1a) is listed. An Interspeech 2026 paper on MFA 3.0
  evaluates English, Japanese and Korean, with mean boundary errors under 15 ms (search summary) ([MFA 3.0 paper listing](https://papers.cool/arxiv/2606.18466), [MFA models index](https://mfa-models.readthedocs.io/en/latest/language_model/Thai/index.html)).
- **FLAME 2023 Open is CC-BY-4.0, but restricted.** It may not be used "for pornographic content or to create fake,
  libelous, misleading, or defamatory content". "Previous versions are only available for non-commercial research
  purposes" (search summary) ([FLAME model license](https://flame.is.tue.mpg.de/modellicense.html), [FLAME site](https://flame.is.tue.mpg.de/)).

**Non-commercial, or not cleanly commercial (list separately; don't ship):**
- **EMOCA:** "non-commercial scientific research purposes". The licence bars use in a commercial product or service ([EMOCA LICENSE](https://github.com/radekd91/emoca/blob/release/EMOCA_v2/LICENSE)).
- **DECA:** code and model are "available for non-commercial scientific research purposes" (read) ([DECA](https://github.com/yfeng95/DECA)).
- **SMIRK:** the code is labelled MIT, but it needs the FLAME model ("This requires registration"), version unspecified.
  No licence is given for the model, and it has a video demo (read) ([SMIRK](https://github.com/georgeretsi/smirk)).
- **SPECTRE:** no licence text on the page. It needs FLAME, its texture model "we are not allowed to share", and it is
  visual-speech-aware through a lipreading model (read) ([SPECTRE](https://github.com/filby89/spectre)).
- **EmoTalk:** "Creative Commons Attribution-NonCommercial 4.0"; commercial licensing is by email (read) ([EmoTalk_release](https://github.com/psyai-net/EmoTalk_release)).
- **FaceFormer and CodeTalker:** the code is MIT, but both train on VOCASET and BIWI (released on request) and output
  FLAME or BIWI mesh motion (read) ([FaceFormer](https://github.com/EvelynFan/FaceFormer), [CodeTalker](https://github.com/Doubiiu/CodeTalker)).
  VOCA and VOCASET are "free for non-commercial and scientific research purposes" (search summary) ([VOCA](https://github.com/TimoBolkart/voca)).
- **UniTalker:** the code is Apache-2.0, but it trains on BIWI, VOCASET, meshtalk and 3DETF and needs FLAME 2020. It
  claims "various languages" and has a Chinese dataset, D6 (read) ([UniTalker](https://github.com/X-niper/UniTalker)).

### Inferences
- **MHA on Linux (5.8) is now the most capable local face solver available to us.** It is free inside UE and needs no
  extra account beyond Epic's. The catch is the rig space: it outputs MetaHuman controls (164 curves per ARKitRemap), so
  a mapping onto MHR is required. The two candidates are MHA, then RigMapper to ARKit, then ARKit to MHR (two lossy
  hops), or a direct MHA-to-MHR mapping fitted the way ARKitRemap fits its own (see Q4).
- **Live Link Face and Maxine don't fit:**
  - Live Link Face captures a live performer, not existing AI-generated video. It only matters if the user re-performs
    lines on an iPhone, and on Linux that is the only real-time path.
  - Maxine needs an NGC account and an enterprise subscription: skip it.
- **A Japanese fallback from text.** Since story.json holds every line's Japanese text, run pyopenjtalk g2p, then MFA
  alignment, then a viseme track. That gives deterministic, licence-clean mouth shapes with exact mora timing.
  uLipSync's MFCC-against-vowel-profile method is simple enough to reimplement in Python (MIT) as an audio-only a/i/u/e/o
  track. Either one can sanity-check Audio2Face's Japanese, or stand in for it on cheap takes.
- **Weight licences inherit their training data.** FaceFormer, CodeTalker and UniTalker have permissive code but
  pretrained weights trained on non-commercial datasets. Treat those weights as non-commercial. They also output FLAME
  or BIWI meshes, which would need retargeting to MHR anyway.
- **FLAME is a poor fit even in its CC-BY version.** FLAME 2023 Open's content restrictions ("pornographic", "fake …
  misleading") are an awkward fit for intimate horror-romance scenes, so avoid FLAME-based paths.
- **LAM-A2E is licence-clean in code, but the training data is undisclosed.** Its ARKit output can drop into the same
  ARKit-to-MHR mapping. Worth a quick A/B against Audio2Face on Japanese.

### Gaps
- It isn't confirmed whether MHA's mono-video solve needs a MetaHuman Identity, nor whether creating an Identity or using
  "Prepare for Performance" needs Epic's cloud service and a sign-in.
- No Epic statement was found on using MHA output on non-MetaHuman rigs. The EULA text couldn't be opened, and the
  secondary sources conflict.
- Which languages MHA's audio solve handles, and how it does on Japanese, is untested and undocumented.
- Not checked in this pass:
  - Rhubarb's licence.
  - OVRLipSync's licence and Linux support (only a UE5 port was seen in search).
  - The licence of MFA's Japanese model.
  - LAM-A2E's training data and languages.

## 4. Mapping ARKit-52 to MHR's 72 FACS shapes: ComfyUI's node, SAM 3D Body's face output, how hard a hand mapping is

### Takeaway
Meta now publishes MHR's 72 expression names in index order (shape_45 to shape_116), so a clean hand mapping is
straightforward: ARKit's shapes are themselves FACS-derived. ComfyUI's built-in SAM3DBody_FaceExpression mapping is a
**visual approximation, made when the axes were anonymous**. Checked against Meta's names, about 12 axes look misrouted,
and it never uses pucker, funnel, press, roll or close, which are speech-critical. Use it as a reference, not as-is.
Only **tongueOut** truly has no MHR blendshape (MHR has tongue joints instead). Ten MHR shapes have no ARKit source.
SAM 3D Body itself doesn't deliver a usable face expression; that is why the node exists.

### Cited Findings
- **MHR's official names, in order (read)** ([MHR docs/face-expressions.md](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md), [mhr/face_expression.py](https://github.com/facebookresearch/MHR/blob/main/mhr/face_expression.py)).
  The FBX name is `shape_(45+i)` and `blend_(45+i)`:

  | Index | Name | Index | Name | Index | Name |
  |---|---|---|---|---|---|
  | 0 | browLowerer_L | 24 | jawDrop | 48 | lipTightener_L |
  | 1 | browLowerer_R | 25 | jawSidewaysLeft | 49 | lipTightener_R |
  | 2 | cheekPuff_L | 26 | jawSidewaysRight | 50 | lipsToward_LB |
  | 3 | cheekPuff_R | 27 | jawThrust | 51 | lipsToward_LT |
  | 4 | cheekRaiser_L | 28 | lidTightener_L | 52 | lipsToward_RB |
  | 5 | cheekRaiser_R | 29 | lidTightener_R | 53 | lipsToward_RT |
  | 6 | cheekSuck_L | 30 | lipCornerDepressor_L | 54 | lowerLipDepressor_L |
  | 7 | cheekSuck_R | 31 | lipCornerDepressor_R | 55 | lowerLipDepressor_R |
  | 8 | chinRaiser_B | 32 | lipCornerPuller_L | 56 | mouthLeft |
  | 9 | chinRaiser_T | 33 | lipCornerPuller_R | 57 | mouthRight |
  | 10 | dimpler_L | 34 | lipFunneler_LB | 58 | nasolabialFurrow_L |
  | 11 | dimpler_R | 35 | lipFunneler_LT | 59 | nasolabialFurrow_R |
  | 12 | eyesClosed_L | 36 | lipFunneler_RB | 60 | noseWrinkler_L |
  | 13 | eyesClosed_R | 37 | lipFunneler_RT | 61 | noseWrinkler_R |
  | 14 | eyesLookDown_L | 38 | lipPressor_L | 62 | nostrilCompressor_L |
  | 15 | eyesLookDown_R | 39 | lipPressor_R | 63 | nostrilCompressor_R |
  | 16 | eyesLookLeft_L | 40 | lipPucker_L | 64 | nostrilDilator_L |
  | 17 | eyesLookLeft_R | 41 | lipPucker_R | 65 | nostrilDilator_R |
  | 18 | eyesLookRight_L | 42 | lipStretcher_L | 66 | outerBrowRaiser_L |
  | 19 | eyesLookRight_R | 43 | lipStretcher_R | 67 | outerBrowRaiser_R |
  | 20 | eyesLookUp_L | 44 | lipSuck_LB | 68 | upperLidRaiser_L |
  | 21 | eyesLookUp_R | 45 | lipSuck_LT | 69 | upperLidRaiser_R |
  | 22 | innerBrowRaiser_L | 46 | lipSuck_RB | 70 | upperLipRaiser_L |
  | 23 | innerBrowRaiser_R | 47 | lipSuck_RT | 71 | upperLipRaiser_R |

  The docs call the set "artist-sculpted, sparse semantic facial blendshapes" following FACS. They are not PCA, and "not
  every control maps one-to-one" to a canonical Action Unit; the extras are unilateral controls, gaze, jaw direction and
  lip quadrants. `face_expression.py` says position *i* names column `face_expr_coeffs[:, i]` "in MHR v1.x assets". Meta
  publishes **no ARKit mapping**.
- **ComfyUI's built-in node (read)** ([ComfyUI face_expression.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/sam3d_body/face_expression.py)):
  - On provenance, the file says "MHR's 72 expression axes ship as anonymous `shape_c_N` channels in the upstream FBX
    (no semantic names)" and that the table is "hand-derived by visual inspection of which axis each ARKit shape
    drives". It has no licence header.
  - Its routes, as MHR index → ARKit (weight):

    | MHR index | ARKit source (weight) |
    |---|---|
    | 0, 1 | browDownLeft, browDownRight |
    | 2, 3 | cheekPuff |
    | 4, 5 | cheekSquintLeft, cheekSquintRight |
    | 6, 7 | mouthStretchLeft, mouthStretchRight |
    | 8, 9 | mouthShrugLower, mouthShrugUpper |
    | 10, 11 | mouthDimpleLeft, mouthDimpleRight |
    | 12, 13 | eyeLookDownLeft, eyeLookDownRight (0.3) |
    | 14, 15 | eyeBlinkLeft, eyeBlinkRight |
    | 16–19 | eyeLookOutLeft, eyeLookInRight, eyeLookInLeft, eyeLookOutRight |
    | 22, 23 | eyeLookUpLeft, eyeLookUpRight, plus browInnerUp (0.5) |
    | 24 | jawOpen, plus mouthLowerDownLeft and mouthLowerDownRight (0.3 each) |
    | 25–27 | jawLeft, jawRight, jawForward |
    | 28, 29 | eyeSquintLeft, eyeSquintRight |
    | 32, 33 | mouthSmileLeft, mouthSmileRight |
    | 40, 41 | mouthLeft, mouthRight |
    | 42, 43 | mouthFrownLeft, mouthFrownRight |
    | 54, 55 | mouthLowerDownLeft, mouthLowerDownRight |
    | 60, 61 | noseSneerLeft, noseSneerRight |
    | 66, 67 | browOuterUpLeft, browOuterUpRight |
    | 68, 69 | eyeWideLeft, eyeWideRight |
    | 70, 71 | mouthUpperUpLeft, mouthUpperUpRight |

  - **28 axes are unused:** 20, 21, 30, 31, 34–39, 44–53, 56–59 and 62–65.
  - **8 ARKit names are unused:** mouthClose, mouthFunnel, mouthPucker, mouthRollLower, mouthRollUpper, mouthPressLeft,
    mouthPressRight and tongueOut. The file says "ARKit shapes with no MHR analog are simply absent".
  - Each axis takes the max across its routes, times the region scale and `strength`, with no upper clamp. The function
    defaults are strength, mouth, eye and brow all 1.0.
- **The node's documentation (search summary)** ([ComfyUI node docs](https://docs.comfy.org/built-in-nodes/SAM3DBody_FaceExpression)):
  - The node detects faces with the MediaPipe Face Landmarker, matches each face to a tracked person, maps the 52 ARKit
    blendshapes onto MHR's 72 expression parameters, and re-runs the body model.
  - Its controls are a global multiplier plus mouth, eye and brow multipliers. The docs list defaults of 1.0 for global
    and mouth and **2.0 for eyes and brows**. This conflicts with the 1.0 function defaults in the code; the node's UI
    defaults may live elsewhere.
- **The ComfyUI PR (read)** ([Comfy-Org/ComfyUI PR #14370](https://github.com/Comfy-Org/ComfyUI/pull/14370)): authored by
  kijai and merged on 2026-08-23 by comfyanonymous. It includes the "Option to drive facial expressions through
  MediaPipe blendshapes" and "Temporal smoothing for video detection" ([ComfyUI-Wiki news](https://comfyui-wiki.com/en/news/2026-08-23-sam-3d-body-native-comfyui)).
- **SAM 3D Body's own face output:**
  - The MHRGait paper reports that in its SAM 3D Body output all 72 facial-expression dimensions were "identically zero"
    (search summary) ([arXiv 2607.29083](https://arxiv.org/pdf/2607.29083)).
  - A C++ port lists face expression (72) as an output separate from hand pose (108) (search summary) ([SAM3DBody-cpp](https://github.com/AmmarkoV/SAM3DBody-cpp)).
  - The Hugging Face model card's output list doesn't mention a face-expression vector (search summary) ([facebook/sam-3d-body-dinov3](https://huggingface.co/facebook/sam-3d-body-dinov3)).
- **MHR's names match Meta's face-tracking set:**
  - OpenXR's `FaceExpressionLipCornerPullerLFB = 32` is the same index as MHR's lipCornerPuller_L ([Silk.NET FaceExpressionFB](https://github.com/dotnet/Silk.NET/blob/main/src/OpenXR/Silk.NET.OpenXR/Enums/FaceExpressionFB.gen.cs)).
  - Meta's Unreal Movement sample maps `LipCornerPullerL` to curve `"lipCornerPuller_L"`, `LipFunnelerLB` to
    `"lipFunneler_LB"` and `LipPressorL` to `"lipPressor_L"`, the exact MHR names ([oculus-samples/Unreal-Movement](https://github.com/oculus-samples/Unreal-Movement/blob/main/Plugins/OculusXRMovementUtility/Source/OculusXRMovementUtility/Public/AnimNode_OculusXRFaceTracking.h)).
  - Meta's compskin rig uses the same names with antagonist pairs: ("cheekSuck_L", "cheekPuff_L"), eyesClosed with
    upperLidRaiser, lipSuck with lipFunneler, mouthRight with mouthLeft, nostrilCompressor with nostrilDilator ([facebookresearch/compskin riglogic.py](https://github.com/facebookresearch/compskin/blob/main/rig/riglogic.py)).
  - All of these were read via code search.
- **Existing mapping work to borrow from:**
  - Meta's Movement SDK has an "Add A2E ARKit Face" helper that "establishes our default mappings for ARKit" (search
    summary) ([Meta: Face Tracking for Movement SDK](https://developers.meta.com/vr/documentation/unity/move-face-tracking/)).
  - Meta has an Unreal blendshape visual reference ([Meta: Blendshape Visual Reference, Unreal](https://developers.meta.com/horizon/documentation/unreal/move-ref-blendshapes/)).
  - VRCFaceTracking documents tables between Meta Movement and Unified Expressions ([VRCFT: Meta Movement](https://docs.vrcft.io/docs/tutorial-avatars/tutorial-avatars-extras/compatibility/meta-movement)).
- **A principled fitting method (read)** ([ARKitRemap](https://github.com/Dylanyz/ARKitRemap)):
  - Extract Epic's `PA_MetaHuman_ARKit_Mapping` PoseAsset and evaluate each ARKit shape through RigLogic on the
    archetype head.
  - Solve the inverse with bounded least squares, then fit a sparse weighted-sum graph (R² 0.92).
  - Validate against paired iPhone ARKit recordings. "Zero hand-tuned numbers."
- **Left and right refer to the subject's face in MediaPipe** (search summary) ([Google web guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)).

### Inferences
- **Twelve ComfyUI axes look misrouted when checked against Meta's names.** My comparison of the two read sources:

  | MHR axes | Actual MHR shape | ComfyUI routes | Should route |
  |---|---|---|---|
  | 6, 7 | cheekSuck | mouthStretch | mouthStretch to lipStretcher (42, 43) |
  | 12, 13 | eyesClosed | eyeLookDown ×0.3 | eyeBlink |
  | 14, 15 | eyesLookDown | eyeBlink | eyeLookDown |
  | 22, 23 | innerBrowRaiser | eyeLookUp, plus browInnerUp ×0.5 | eyeLookUp to 20, 21; browInnerUp at 1.0 |
  | 40, 41 | lipPucker | mouthLeft, mouthRight | mouthPucker; mouthLeft/Right to 56, 57 |
  | 42, 43 | lipStretcher | mouthFrown | mouthStretch; mouthFrown to lipCornerDepressor (30, 31) |

  The blink and look-down swap and the pucker and stretcher confusions are the kind of mistakes visual inspection makes:
  look-down lowers the lids, and stretch resembles frown. As a result, a MediaPipe blink in ComfyUI drives eyesLookDown
  and never fully closes the eye, and Japanese う and お would get no pucker or funnel.
  The remaining 50 routes agree with the names. This assumes SAM 3D Body's MHR uses the documented v1.x order, which
  the file states for v1.x assets.
- **A proposed ARKit (MediaPipe) to MHR mapping, as a starting point.** Multipliers to be fitted; L/R by the subject:

  | Group | ARKit (MediaPipe) | MHR |
  |---|---|---|
  | Brows | browDownL/R | browLowerer_L/R |
  | | browInnerUp | innerBrowRaiser_L and _R |
  | | browOuterUpL/R | outerBrowRaiser_L/R |
  | Eyes | eyeBlinkL/R | eyesClosed_L/R |
  | | eyeSquintL/R | lidTightener_L/R |
  | | eyeWideL/R | upperLidRaiser_L/R |
  | | eyeLookUp/DownL/R | eyesLookUp/Down_L/R |
  | | eyeLookOutLeft | eyesLookLeft_L |
  | | eyeLookInLeft | eyesLookRight_L |
  | | eyeLookInRight | eyesLookLeft_R |
  | | eyeLookOutRight | eyesLookRight_R |
  | | (gaze) | optionally also the `l_eye`/`r_eye` joints |
  | Cheek and nose | cheekSquintL/R | cheekRaiser_L/R |
  | | cheekPuff | cheekPuff_L and _R |
  | | noseSneerL/R | noseWrinkler_L/R |
  | Jaw | jawOpen | jawDrop, plus a `c_jaw` rotation (see Gaps) |
  | | jawLeft/Right | jawSidewaysLeft/Right |
  | | jawForward | jawThrust |
  | Mouth | mouthClose | all four lipsToward_* (FACS AU8 "lips toward each other", the same idea: lips sealed with the jaw open) |
  | | mouthSmileL/R | lipCornerPuller_L/R |
  | | mouthFrownL/R | lipCornerDepressor_L/R |
  | | mouthStretchL/R | lipStretcher_L/R |
  | | mouthDimpleL/R | dimpler_L/R |
  | | mouthPressL/R | lipPressor_L/R |
  | | mouthPucker | lipPucker_L and _R |
  | | mouthFunnel | all four lipFunneler_* |
  | | mouthRollUpper | lipSuck_LT and _RT |
  | | mouthRollLower | lipSuck_LB and _RB |
  | | mouthShrugUpper | chinRaiser_T |
  | | mouthShrugLower | chinRaiser_B |
  | | mouthLowerDownL/R | lowerLipDepressor_L/R |
  | | mouthUpperUpL/R | upperLipRaiser_L/R |
  | | mouthLeft/Right | mouthLeft/mouthRight |
  | Tongue | tongueOut (Audio2Face only) | no blendshape; drive the `c_tongue0-4` joints |

- **The user's list of suspected gaps is mostly fine.** mouthClose maps to lipsToward (AU8), mouthRoll to lipSuck (AU28)
  and eyeWide to upperLidRaiser (AU5). Only tongueOut lacks a blendshape.
- **Ten MHR shapes have no ARKit source:** cheekSuck_L/R, lipTightener_L/R, nasolabialFurrow_L/R, nostrilCompressor_L/R
  and nostrilDilator_L/R. They can be left at 0, or driven by secondary rules:
  - nasolabialFurrow follows lipCornerPuller and cheekRaiser;
  - nostrilDilator follows breaths and effort;
  - lipTightener follows mouthPress and mouthRoll.
- **How hard it is.** Naming the routes takes about a day. The real work is per-channel gain and combination
  calibration, because MHR's 1.0 isn't ARKit's 1.0. Two ways to do it:
  - Fit gains so MediaPipe run on a rendered MHR face reproduces the source landmarks.
  - Or, ARKitRemap-style, use a reference ARKit-52 head (for example Audio2Face's bundled ARKit rig), wrap it onto MHR's
    head, and least-squares-fit each ARKit target as a sparse combination of MHR shapes. That is a few days with
    existing tools.
- **Respect the antagonist pairs** from compskin: never drive cheekSuck with cheekPuff, eyesClosed with upperLidRaiser,
  or lipSuck with lipFunneler together.
- **Check the shapes visually first.** Render all 72 at weight 1.0 as one contact sheet to confirm the names and the L/R
  convention. This is cheap and matches the project's contact-sheet rule.

### Gaps
- Not verified for MHR: whether its `_L` means the subject's left; whether jawDrop moves the teeth, or `c_jaw` and
  `c_teeth` must be rotated alongside it; and whether its face has any corrective or combination shapes beyond the 72.
- Whether the ComfyUI table predates Meta publishing the names. No dates for `face-expressions.md` were seen.
- Whether SAM 3D Body's expression head is ever non-zero in good conditions. The MHRGait observation could be
  specific to that paper.
- The exact lip and mouth rows of Meta's and VRCFaceTracking's ARKit tables. Only eye rows were seen.

## 5. Getting curves into Unreal 5.8 on a custom (MHR) skeletal mesh, and combining video upper face with audio lips

### Takeaway
Bake everything offline and keep the mapping in Python, outside the engine. Per take:
1. Write 72 MHR curves, named exactly as the MHR morph targets, plus bone tracks for `c_jaw`, the eyes, the tongue and the
   head.
2. Put them into an AnimSequence on the MHR skeleton, with `unreal.AnimationLibrary.add_float_curve_keys` or through an
   FBX.
3. Keep a Pose Asset or the RigMapper plugin as an optional in-engine remap for live tuning.

Combine by region: the upper face and head from video, and the jaw, lips and tongue from audio. Blend the
emotional mouth corners from video at reduced weight, and use the video mouth during silences.

### Cited Findings
- In the Interchange pipeline, morph targets are translated into the mesh and "can be animated with a float curve"
  (search summary) ([UE Python API: InterchangeAnimSequenceFactoryNode](https://docs.unrealengine.com/5.2/en-US/PythonAPI/class/InterchangeAnimSequenceFactoryNode.html)).
- `AnimationLibrary.add_float_curve_keys(animation_sequence_base, curve_name, times, values)` "Adds a multiple of Float
  Keys to the specified Animation Curve inside of the given Animation Sequence". Related calls are `add_float_curve_key`
  and the Blueprint "Does Curve Exist" check (search summary) ([UE Python API: AnimationLibrary](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AnimationLibrary), [AddFloatCurveKeys BP](https://docs.unrealengine.com/4.27/en-US/BlueprintAPI/AnimationBlueprintLibrary/Curves/AddFloatCurveKeys/index.html)).
- Epic's own conversions use a mapping PoseAsset (`PA_MetaHuman_ARKit_Mapping`) and the `ABP_MH_LiveLink` formulas. The
  RigMapper plugin is "experimental since 5.7", and ARKitRemap ships its remap as a RigMapper definition, tested on 5.8.
  It notes that selfie-style footage is mirrored and that head movement is an optional toggle (read) ([ARKitRemap](https://github.com/Dylanyz/ARKitRemap)).
- A forum answer says that when both models use the Apple ARKit morph names, curve values transfer directly, as "an
  approximation", with some expressions needing tweaks (search summary) ([UE forum](https://forums.unrealengine.com/t/retarget-metahuman-facial-animation-to-custom-character/837213)).
- In 5.8, real-time facial animation on Linux is only available through Live Link Face (search summary) ([MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine)).
- The ACE plugin needs extra steps for non-MetaHuman characters and only has builds for UE 5.4 to 5.6 ([ACE doc](https://docs.nvidia.com/ace/ace-unreal-plugin/2.5/ace-unreal-plugin-animation.html), [NVIDIA/Audio2Face-3D](https://github.com/NVIDIA/Audio2Face-3D)).
- Audio2Face's diffusion model is effectively 30 fps (60 generated, half discarded), and the regression model runs at any
  frame rate (read) ([SDK docs](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/docs/README.md)). It outputs no head
  motion; MHA's audio solve does have a head-movement parameter ([Epic: Audio Driven Animation](https://dev.epicgames.com/documentation/metahuman/audio-driven-animation)).

### Inferences
- **A recommended pipeline (licence-clean, local, no new accounts), per take:**
  1. **Video.** MediaPipe Face Landmarker in VIDEO mode, already run locally by `tools/face_mesh.py`, gives 51
     blendshapes, 478 landmarks and the head transform at the take's fps. Then: neutral baseline, per-channel gains,
     zero-phase smoothing that spares blinks, and landmark-derived fixes for the dead channels.
  2. **Audio.** The Audio2Face-3D SDK with the v3.0 diffusion model, or the Claire v2.3.1 regression model for a woman's
     voice, both to be A/B tested. Run it in a CUDA 12.9 container on Linux, without Audio2Emotion, with the emotion
     vector set from the take's mood in story.json. Dump the weights for the 52 ARKit names (route (a)) or for MHR
     directly (route (b)), plus jaw, eyes and tongue.
  3. **Fallback and check.** pyopenjtalk on the line's text, MFA alignment and Japanese vowel visemes. Also use these
     where Audio2Face mis-shapes Japanese (う, ん, っ).
  4. **Merge, by region:**
     - Upper face (brows, lids, blinks, gaze, cheekRaiser, noseWrinkler) and the head from video.
     - Jaw, lip shapes (funnel, pucker, press, suck, toward, stretcher, lip raisers and depressors, chin) and tongue from
       audio.
     - Mouth corners (lipCornerPuller, lipCornerDepressor, dimpler) = max(audio, k·video).
     - During silences (audio RMS low), crossfade the mouth to video so breaths and held expressions survive.
  5. **Map to MHR's 72** (Q4), clamp, and enforce the antagonist pairs. Jaw goes to the jawDrop curve plus `c_jaw`
     rotation, if the rig needs both.
  6. **Write the AnimSequence in UE.** Through Python, with curves named `shape_45`…`shape_116` or whatever the imported
     morph targets are called, plus bone keys. Or export from Blender as FBX with shape-key animation. Bake at the take's
     fps, keyed to the clip, never to absolute scene time, which fits the project's "cues ride on clip edges" rule.
- **Live Link isn't needed for offline takes.** It is only useful for previewing a live performer, and on Linux that is
  Live Link Face.
- **Control Rig can host the procedural extras** if wanted: blink cleanup, eye micro-saccades, tongue follow. The baked
  AnimSequence stays the deliverable, which keeps "text is the truth" intact. The tool's settings live in a file, and the
  curves are regenerated.

### Gaps
- No verified UE 5.8 script was found that keys morph curves on a new AnimSequence and saves it. The steps to confirm in
  the editor are curve metadata (the morph-target flag), compression and the AnimDataController.
- Whether MHR's FBX import keeps the `shape_45..shape_116` names as morph target names wasn't checked.
- No sources were found on running a mapping Pose Asset on a non-MetaHuman custom mesh in 5.8.

## 6. Honest quality comparison with MetaHuman Animator (mono video) for close-up dialogue

### Takeaway
Expect solid game-dialogue quality, not MetaHuman Animator quality in tight close-ups. MHA is identity-aware, has a
temporally consistent solver and a RigLogic rig, and is still clearly ahead on lip contact, asymmetry and subtle
expression. Our MHR path is capped three times over:
- MediaPipe's weak lower face;
- Audio2Face's generic, English/Mandarin-trained style, with no head motion;
- MHR's 72 linear "sparse semantic" shapes.

Running MHA itself, which now runs on Linux in 5.8, and mapping its curves onto MHR closes much of the solver gap, but
not the rig gap.

### Cited Findings
- MHA's solver "uses a 4D solver to combine video and depth data together with a MetaHuman representation of the
  performer"; on the iPhone path, depth builds the identity (search summary) ([MetaHuman Animator launch post](https://www.metahuman.com/news/delivering-high-quality-facial-animation-in-minutes-metahuman-animator-is-now-available)).
- 5.8's new models give "improved solve quality across a wider range of capture conditions" (search summary) ([MetaHuman 5.8 news](https://www.metahuman.com/news/metahuman-5-8-is-now-available)).
- **How well MHA's curves carry over, measured by ARKitRemap (read)** ([ARKitRemap](https://github.com/Dylanyz/ARKitRemap)).
  Remapped MHA curves correlate with paired iPhone ARKit at:
  - jaw 0.96, brows 0.94 to 0.96, smile 0.88, blink 0.87;
  - "Decent": squints, cheeks, stretch, frown, MouthClose (r = 0.81 after calibration);
  - "Weak": Dimples, MouthRollUpper, JawForward.

  It adds that "No remap can beat the format's ceiling", that tongue tracking "is weak in MHA", and that the result
  "Sometimes … reads more expressive than phone ARKit, occasionally less on extreme faces".
- A side-by-side video comparing MHA with iPhone depth against video-only exists, but its findings weren't visible
  (search summary) ([YouTube: iPhone Depth vs Video Only](https://www.youtube.com/watch?v=XvwfPS0XGmE)).
- MHA's mono capture guidance asks for 60 fps, HD or 4K, flat light and a large face (search summary) ([Epic capture guidelines](https://dev.epicgames.com/documentation/metahuman/metahuman-animator-video-capture-guidelines-in-unreal-engine)).
- MediaPipe's dead channels and jitter: [DroidKaigi 2026](https://2026.droidkaigi.jp/en/timetable/1236039/), [arXiv 2601.08234](https://arxiv.org/pdf/2601.08234).
- The MHR face rig is 72 "artist-sculpted, sparse semantic facial blendshapes" (read) ([MHR docs](https://github.com/facebookresearch/MHR/blob/main/docs/face-expressions.md)).

### Inferences
- **A quality ladder for one close-up line on our MHR head, best first:**
  1. **MHA mono video (5.8, on Linux), mapped to MHR.** Identity-aware, temporally consistent, best lip contact from
     video. It loses detail in the two mapping hops and in MHR's simpler rig. It also needs the MetaHuman toolchain
     (Epic account; possibly a cloud Identity step) and a mapping from MetaHuman controls to MHR that has to be built.
  2. **Audio2Face-3D lips, with MediaPipe for the upper face and head, mapped to MHR.** Lips match the actual audio, not
     the video model's synthetic mouth. Clean and smooth, but generic in style. Japanese is unproven: watch う rounding
     and the m/p/b seals. This is the best fully licence-clean, account-free, Linux-native option, and the recommended
     default.
  3. **MediaPipe only.** Jittery, with saturated or dead jaw channels and no tongue. Fine for blinks, brows and head;
     poor for speech.
  4. **Text visemes from pyopenjtalk and MFA.** Rock-solid timing but robotic unless coarticulation is added. A good
     fallback and a check on the other paths.
- **Where the MHR path will fall short of MHA on a MetaHuman:**
  - Lip seal and press nuance; asymmetric micro-expressions (smirks, lip tremble).
  - Teeth and tongue visibility, and skin sliding and wrinkles. MHR has no wrinkle maps or RigLogic correctives that we
    know of.
  - Eye darts and lid follow, which come from neither source unless added procedurally.

  For a horror-romance close-up, the eyes, blinks and breath will sell more than lip accuracy. Spend the polish there.
- **Practical expectation.** At the game's usual first-person distances and the medium close-ups in DIRECTING, the
  recommended path should read as convincing. For hero extreme close-ups, plan to hand-key a few frames, or re-perform
  with Live Link Face/MHA if the user can.
- **The source takes are a hidden ceiling.** MHA's guidance asks for 60 fps HD or 4K. AI-generated takes are probably 24
  to 30 fps, and their lips are synthetic, which caps any video solver whichever one is used. This is one more reason to
  drive lips from audio.
- **Measure the frame, per the project's rule:**
  1. Render the MHR head with the solved curves from the take's camera.
  2. Run MediaPipe on the render.
  3. Report landmark error against the source video per region (lips, lids, brows), plus a sync offset between audio
     onsets and lip opening. That gives an objective per-take score for A/B tests (Audio2Face v3.0 against Claire against
     LAM-A2E against the viseme track) without anyone having to judge the scare.

### Gaps
- No independent quantitative benchmark was found comparing MHA mono video with other trackers, or with MHA using depth.
- The resolution and frame rate of MiniMax's video output weren't researched; they set how much a video solve can
  recover.
- Nobody has measured any of these tools on Japanese dialogue that we could find; our own 3 to 5 take test is needed.
- Whether MHA output can legally drive a non-MetaHuman character in a sold game hasn't been confirmed against Epic's
  current EULA text. It is probably fine inside a UE game, but unverified.
