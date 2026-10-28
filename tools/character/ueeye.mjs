// UEEYE: the Studio's eye as an Unreal material (Content/Python/storykit/people.py, docs/UNREAL_FLOW.md §1d), checked
// without an editor. Every Character Studio export here carries both eyes (the paint baked flat, studioEye's shape
// and paint, sensible numbers for M_StudioEye); and M_StudioEye's two Custom nodes, run as GLSL in a headless browser
// (their HLSL is written so it is GLSL too, under a few #defines), put the iris where a ray from the camera, brought
// into the eye's frame from the tangent space Unreal hands them, lands on the iris's plane after the cornea bends it
// (Snell's law), read the white where the point is, flip with Handed and FlipV as they say, and say how much iris is
// seen. With DXC set (github.com/microsoft/DirectXShaderCompiler releases), the HLSL also compiles as Unreal wraps
// it. Ends "UEEYE ok".
//
//   node tools/character/ueeye.mjs              (DXC=/path/to/dxc-linux: the folder with bin/dxc and lib/)
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const fail = m => { console.error("UEEYE FAIL: " + m); process.exit(1); };
const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { fail(`${what}: ${e.message}`); } };

// people.py's text and what it reads in each export (plain Python: no editor)
const py = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "Content", "Python"))})
import storykit.people as p
out = {"color": p.EYE_COLOR, "iris": p.EYE_IRIS, "params": p.EYE_PARAMS, "rough": p.ROUGHNESS, "version": p.EYE_VERSION, "people": []}
for n in p.exported():
    f = p.export_path(n)
    out["people"].append({"name": n, "height": p.height(f, n), "eyes": [{"side": e["side"], "material": e["material"], "png": e["image"][:8].hex(),
                          "bytes": len(e["image"]), "params": p.params(e["record"])} for e in p.eyes(f)]})
print(json.dumps(out))
`;
const M = JSON.parse(execFileSync(process.env.PYTHON || "python3", ["-c", py], { encoding: "utf8", maxBuffer: 64 << 20 }));
const names = M.params.map(p => p[0]);

await step("every Character Studio export carries both eyes: the paint baked flat, the eye's shape and paint, numbers M_StudioEye can take", async () => {
  if (!M.people.length) { console.log("       (no Character Studio export on this machine: Export for desk / Unreal makes one; STUDIO exports _studiotest)"); return; }
  for (const c of M.people) {
    const sides = c.eyes.map(e => e.side).join("");
    if (sides !== "LR") throw new Error(`${c.name}: eyes ${JSON.stringify(c.eyes.map(e => e.side))}`);
    for (const e of c.eyes) {
      const k = e.params;
      if (!e.png.startsWith("89504e47") || e.bytes < 10000) throw new Error(`${c.name} ${e.side}: the paint isn't a PNG of any size (${e.png}, ${e.bytes} bytes)`);
      if (!e.material.endsWith(`_eye_${e.side}`)) throw new Error(`${c.name} ${e.side}: the material is named ${e.material}`);
      const bad = Object.entries(k).filter(([, v]) => !Number.isFinite(v));
      if (bad.length || !(k.Rho > 0.1 && k.Rho < 0.95) || !(k.DomeRadius > 0.05) || !(k.IrisPlane < k.LimbusPlane + 0.05) || !(k.IOR >= 1 && k.IOR < 2)
          || !(k.LimbusPlane > 0.2 && k.LimbusPlane < 1) || "Handed" in k || "FlipV" in k)
        throw new Error(`${c.name} ${e.side}: ${JSON.stringify(k)}`);
    }
    if (!(c.height > 1.2 && c.height < 2.3)) throw new Error(`${c.name}: ${c.height} m tall`);
    console.log(`       ${c.name}: ${c.height.toFixed(2)} m, eyes L and R (${(c.eyes[0].bytes / 1024).toFixed(0)} KB of paint each), the limbus at ${c.eyes[0].params.Rho.toFixed(3)}, the iris ${(c.eyes[0].params.LimbusPlane - c.eyes[0].params.IrisPlane).toFixed(3)} behind it, IOR ${c.eyes[0].params.IOR}`);
  }
});

// the cases: a point on the eye (its uv), the camera's direction from it (in the eye's frame), the parameters; what
// the material should give, worked out here with plain vector maths
const P0 = Object.fromEntries(M.params), shape = (M.people[0] && M.people[0].eyes[0].params) || {};
const base = { ...P0, ...shape, IrisBright: 1, LimbusView: 0, Handed: 1, FlipV: 0 };   // no brightening or slant darkening: the output is where the iris is read
const V3 = { add: (a, b) => a.map((v, i) => v + b[i]), sub: (a, b) => a.map((v, i) => v - b[i]), mul: (a, k) => a.map(v => v * k), dot: (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
             norm: a => { const l = Math.hypot(...a); return a.map(v => v / l); }, cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] };
function frame(k, xy) {                               // the eye's surface at xy: its point, normal and tangent frame (eye.js's eyeGeometry)
  const r2 = xy[0] ** 2 + xy[1] ** 2, onC = r2 < k.Rho ** 2;
  const z = onC ? k.DomeCentre + Math.sqrt(Math.max(k.DomeRadius ** 2 - r2, 0)) : Math.sqrt(Math.max(1 - r2, 0));
  const P = [xy[0], xy[1], z], N = onC ? V3.norm(V3.sub(P, [0, 0, k.DomeCentre])) : V3.norm(P);
  let T = [1 - N[0] * N[0], -N[0] * N[1], -N[0] * N[2]]; T = V3.dot(T, T) < 1e-8 ? [0, 0, N[0] > 0 ? -1 : 1] : V3.norm(T);
  return { onC, P, N, T, B: V3.cross(N, T) };
}
function snell(i, n, eta) {                           // the refracted direction (i, n unit; i into the surface)
  const c = -V3.dot(i, n), s = eta * eta * (1 - c * c);
  return s > 1 ? null : V3.add(V3.mul(i, eta), V3.mul(n, eta * c - Math.sqrt(1 - s)));
}
const cases = [];
for (const r of [0, 0.25, 0.5, 0.8]) for (const ph of [0, 1.3, 2.6, 3.9, 5.2]) for (const [yaw, pitch] of [[0, 0], [0.5, 0], [-0.45, 0.2], [0.2, -0.5], [0.7, 0.4]]) {
  if (r === 0 && ph > 0) continue;
  const xy = [r * base.Rho * Math.cos(ph), r * base.Rho * Math.sin(ph)], f = frame(base, xy);
  const cam = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];   // toward the camera, in the eye's frame
  if (V3.dot(cam, f.N) < 0.2) continue;
  const Vt = [V3.dot(cam, f.T), V3.dot(cam, f.B), V3.dot(cam, f.N)];   // the camera vector in the surface's tangent space (Unreal's Transform node)
  const t = snell(V3.mul(cam, -1), f.N, 1 / base.IOR), q = [xy[0] + t[0] * (f.P[2] - base.IrisPlane) / -t[2], xy[1] + t[1] * (f.P[2] - base.IrisPlane) / -t[2]];
  if (Math.hypot(...q) > 0.9 * base.Rho) continue;   // on the iris (its edge blends with the white)
  cases.push({ kind: "iris", uv: [0.5 + 0.5 * xy[0], 0.5 + 0.5 * xy[1]], Vt, k: base, want: [0.5 + 0.5 * q[0], 0.5 + 0.5 * q[1]], wantIris: 1, unbent: [0.5 + 0.5 * xy[0], 0.5 + 0.5 * xy[1]] });
  cases.push({ kind: "handed", uv: [0.5 + 0.5 * xy[0], 0.5 + 0.5 * xy[1]], Vt: [Vt[0], -Vt[1], Vt[2]], k: { ...base, Handed: -1 }, want: [0.5 + 0.5 * q[0], 0.5 + 0.5 * q[1]], wantIris: 1 });
  cases.push({ kind: "flipV", uv: [0.5 + 0.5 * xy[0], 0.5 - 0.5 * xy[1]], Vt, k: { ...base, FlipV: 1 }, want: [0.5 + 0.5 * q[0], 0.5 - 0.5 * q[1]], wantIris: 1 });
}
for (const r of [0.5, 0.75, 0.95]) for (const ph of [0.4, 2.2, 4.4]) {             // the white: read where the point is, no iris
  const xy = [r * Math.cos(ph), r * Math.sin(ph)]; if (Math.hypot(...xy) < base.Rho * 1.2) continue;
  const f = frame(base, xy), cam = V3.norm([0.2, 0.1, 1]); if (V3.dot(cam, f.N) < 0.1) continue;
  cases.push({ kind: "white", uv: [0.5 + 0.5 * xy[0], 0.5 + 0.5 * xy[1]], Vt: [V3.dot(cam, f.T), V3.dot(cam, f.B), V3.dot(cam, f.N)], k: base, want: [0.5 + 0.5 * xy[0], 0.5 + 0.5 * xy[1]], wantIris: 0 });
}

await step("M_StudioEye's HLSL, run as GLSL: the iris read where the view lands on its plane after the cornea bends it, the white where the point is; Handed and FlipV undo a flipped frame or picture", async () => {
  const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
  const browser = await require("../browser.cjs").launch(chromium);
  const page = await browser.newPage();
  const r = await page.evaluate(([color, iris, names, cases]) => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return { err: "no WebGL2 with float targets" };
    const shim = "#version 300 es\nprecision highp float;\n#define float2 vec2\n#define float3 vec3\n#define float4 vec4\n#define lerp mix\n#define saturate(x) clamp(x, 0.0, 1.0)\n"
      + "#define Texture2DSample(t, s, uv) vec4(uv, 0.0, 1.0)\n";                   // the paint read back as where it was read
    const fs = shim + `uniform vec2 UV; uniform vec3 Vt; uniform float ${names.join(", ")};\nout vec4 o;\nvec3 colorOf() {\n${color}\n}\nfloat irisOf() {\n${iris}\n}\nvoid main() { o = vec4(colorOf(), irisOf()); }`;
    const vs = "#version 300 es\nvoid main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 1.0; }";
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    let prog;
    try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); } catch (e) { return { err: "the HLSL doesn't compile as GLSL: " + e.message }; }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, 1, 1); gl.useProgram(prog);
    const out = [], px = new Float32Array(4);
    for (const c of cases) {
      gl.uniform2fv(gl.getUniformLocation(prog, "UV"), c.uv); gl.uniform3fv(gl.getUniformLocation(prog, "Vt"), c.Vt);
      for (const n of names) gl.uniform1f(gl.getUniformLocation(prog, n), c.k[n]);
      gl.clearColor(-1, -1, -1, -1); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.POINTS, 0, 1);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px); out.push([...px]);
    }
    return { out };
  }, [M.color, M.iris, names, cases]);
  await browser.close();
  if (r.err) throw new Error(r.err);
  let worst = 0, bent = 0, n = { iris: 0, handed: 0, flipV: 0, white: 0 };
  r.out.forEach((o, i) => {
    const c = cases[i], d = Math.hypot(o[0] - c.want[0], o[1] - c.want[1]);
    if (d > 2e-4 || Math.abs(o[3] - c.wantIris) > 1e-3) throw new Error(`${c.kind} at uv ${c.uv.map(v => v.toFixed(3))}, view ${c.Vt.map(v => v.toFixed(3))}: read at ${o.slice(0, 2).map(v => v.toFixed(4))}, want ${c.want.map(v => v.toFixed(4))}; iris ${o[3].toFixed(3)} (want ${c.wantIris})`);
    worst = Math.max(worst, d); n[c.kind]++;
    if (c.unbent) bent = Math.max(bent, Math.hypot(c.want[0] - c.unbent[0], c.want[1] - c.unbent[1]));
  });
  if (n.iris < 20 || n.white < 3) throw new Error(`too few cases: ${JSON.stringify(n)}`);
  console.log(`       ${r.out.length} cases (${n.iris} on the iris from up to 47° off the axis, each with its frame and its picture flipped; ${n.white} on the white): within ${worst.toExponential(1)} of the trace (the view bends the iris's read up to ${(bent * 2).toFixed(3)} eye units)`);
});

await step("the HLSL compiles as Unreal wraps a Custom node (DXC, when DXC is set)", async () => {
  const dxc = process.env.DXC;
  if (!dxc) { console.log("       (DXC not set: compiled only as GLSL here; set DXC to DirectXShaderCompiler's release folder to compile it as HLSL)"); return; }
  const env = { ...process.env, LD_LIBRARY_PATH: path.join(dxc, "lib") }, args = names.map(n => `float ${n}`).join(", ");
  const lib = "float4 Texture2DSample(Texture2D T, SamplerState S, float2 UV) { return T.Sample(S, UV); }\n";   // Unreal's, from Common.ush
  for (const [what, code, ret, tex] of [["StudioEyeColor", M.color, "float3", true], ["StudioEyeIris", M.iris, "float", false]]) {
    const params = `float2 UV, float3 Vt${tex ? ", Texture2D Paint, SamplerState PaintSampler" : ""}, ${args}`;
    const call = `CustomExpression0(float2(0.4, 0.6), float3(0.1, 0.2, 0.97)${tex ? ", Paint, PaintSampler" : ""}, ${names.map(() => "0.5").join(", ")})`;
    const src = `${lib}Texture2D Paint; SamplerState PaintSampler;\n${ret} CustomExpression0(${params})\n{\n${code}\n}\nfloat4 MainPS(float4 Pos : SV_POSITION) : SV_Target0\n{\n    return float4(${call}${ret === "float" ? ".xxx" : ""}, 1.0);\n}\n`;
    const f = path.join(os.tmpdir(), `ueeye_${what}.hlsl`); fs.writeFileSync(f, src);
    for (const extra of [[], ["-spirv"]]) {
      try { const out = execFileSync(path.join(dxc, "bin", "dxc"), [...extra, "-T", "ps_6_0", "-E", "MainPS", "-HV", "2021", f, "-Fo", os.devnull], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        if (/warning/.test(out)) throw new Error(out); }
      catch (e) { throw new Error(`${what} (${extra.length ? "SPIR-V" : "DXIL"}): ${(e.stderr || e.message || "").toString().slice(0, 600)}`); }
    }
    fs.unlinkSync(f);
  }
});
console.log(`UEEYE ok (M_StudioEye ${M.version})`);
