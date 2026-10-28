// How the browser checks start Chromium (STUDIO, SALON, PLAY, TESTROOM and the rest). By default WebGL runs in
// SwiftShader, on the CPU, as in the cloud, where there's no graphics card: a frame of the Character Studio takes about
// a second there, so STUDIO takes most of an hour. On the user's machine GPU draws on its card (docs/RUN_LOCALLY.md):
//   GPU=1       headless, ANGLE on Vulkan (Chromium's new headless mode)
//   GPU=egl     headless, ANGLE on EGL (if Vulkan isn't found)
//   GPU=headed  a window, always on the card
// With GPU set a check's first line is the renderer WebGL got: the card's name, or SwiftShader if it fell back (then
// the next mode).
//
//   const browser = await require("../browser.cjs").launch(chromium, { args: [...more] });
const SOFT = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const MODES = {
  "1": { headless: true, channel: "chromium", args: ["--use-angle=vulkan", "--enable-features=Vulkan", "--disable-vulkan-surface"], next: "GPU=egl, then GPU=headed" },
  egl: { headless: true, args: ["--use-gl=angle", "--use-angle=gl-egl"], next: "GPU=headed" },
  headed: { headless: false, args: [], next: "the card's driver (nvidia-smi)" },
};

async function launch(chromium, opts = {}) {
  const mode = process.env.GPU || "", m = mode && mode !== "0" ? MODES[mode] : null, more = opts.args || [];
  if (mode && mode !== "0" && !m) throw new Error(`GPU=${mode}: 1, egl or headed (docs/RUN_LOCALLY.md)`);
  if (!m) return chromium.launch({ ...opts, args: [...SOFT, ...more] });
  const browser = await chromium.launch({ ...opts, headless: m.headless, ...(m.channel && !opts.executablePath ? { channel: m.channel } : {}),
    args: ["--ignore-gpu-blocklist", "--enable-gpu", "--disable-background-networking", "--disable-component-update", ...m.args, ...more] });
  const page = await browser.newPage();                // which renderer WebGL got
  const name = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2"), d = gl && gl.getExtension("WEBGL_debug_renderer_info");
    return gl ? gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : "no WebGL";
  });
  await page.close();
  console.log(`GL: ${name}${/swiftshader|llvmpipe|no webgl/i.test(name) ? `  (not the card: GPU=${mode} fell back; try ${m.next})` : ""}`);
  return browser;
}

module.exports = { launch };
