// The story's music moods as beds the games play (docs/HORROR_TODO.md 13, DECISIONS 2026-11-07, later): the format's
// `music` words (calm, uneasy, dread, chase; `silence` is none) each a cue of the score room's, written with a fixed
// seed at its longest and rendered through its own sampled orchestra and hall (Engine.renderWav, the WAV button's),
// made Ogg Vorbis by ffmpeg into Content/Studio/Music/moods/<mood>.ogg at one loudness (LUFS, peaks kept under PEAK: the
// cues differ by 24 dB as written, a pizzicato with its silences to a chase), with moods.json saying what made each. The desk's
// Play and the Godot export play them looped, crossfading (a game's own Content/Games/<G>/Music/moods/<mood>.ogg over
// the studio's). Run it again to make them anew:
//   python tools/score/serve.py            (in another shell)
//   node tools/score/moods.mjs [--check]   (MOODS ok: every mood's file there, an Ogg Vorbis as long as moods.json says;
//                                           check_all runs it: no ffmpeg needed, the length read off the file's own pages)
import fs from "fs";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "Content/Studio/Music/moods");
const URL = process.env.SCORE_URL || "http://127.0.0.1:8791/";
const LUFS = -20, PEAK = -1.5;                             // every mood's integrated loudness, and the true peak none goes over
// each mood: a cue, its settings (the longest it goes, so a loop rarely shows), a seed; the cue catalogue is
// docs/MUSIC_CUES.md (the score room's own words for each)
export const MOODS = {
  calm: { cue: "close_moment", params: { len: 32 }, seed: 3, note: "high piano notes far apart, a breath of strings, long silences" },
  uneasy: { cue: "house_creaks", params: { len: 36 }, seed: 5, note: "low pizzicato taps like wood settling, tremolo swelling in and out" },
  dread: { cue: "dread_drone", params: { len: 40 }, seed: 2, note: "a low string pedal swelling and ebbing, a dissonance creeping in, drips" },
  chase: { cue: "chase", params: { len: 48 }, seed: 4, note: "driving strings and pizzicato over low piano octaves, timpani, the key climbing" },
};

// an Ogg Vorbis file's length: its last page's granule position (the samples so far) over the identification header's
// sample rate; null when it isn't one
export function oggSecs(f) {
  const b = fs.readFileSync(f);
  if (b.length < 64 || b.toString("latin1", 0, 4) !== "OggS") return null;
  const head = 27 + b[26];                                 // the first page's header and its segment table
  if (b[head] !== 1 || b.toString("latin1", head + 1, head + 7) !== "vorbis") return null;
  const rate = b.readUInt32LE(head + 12);
  const last = b.lastIndexOf(Buffer.from("OggS", "latin1"));
  const granule = Number(b.readBigInt64LE(last + 6));
  return rate > 0 && granule > 0 ? granule / rate : null;
}

const check = process.argv.includes("--check");
if (check) {
  const j = JSON.parse(fs.readFileSync(path.join(OUT, "moods.json"), "utf8"));
  const bad = [];
  for (const m of Object.keys(MOODS)) {
    const f = path.join(OUT, m + ".ogg");
    if (!fs.existsSync(f) || fs.statSync(f).size < 20000) { bad.push(m + ": no file"); continue; }
    const secs = oggSecs(f);
    if (secs === null) { bad.push(m + ": not an Ogg Vorbis"); continue; }
    if (!(Math.abs(secs - j.moods[m].secs) < 0.5)) bad.push(`${m}: ${secs.toFixed(1)} s, moods.json says ${j.moods[m].secs}`);
  }
  console.log(bad.length ? "MOODS FAIL " + bad.join("; ") : `MOODS ok (${Object.keys(MOODS).join(", ")} in ${path.relative(ROOT, OUT)})`);
  process.exit(bad.length ? 1 : 0);
}

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.goto(URL);
await page.waitForFunction(() => window.__scoreReady, null, { timeout: 30000 });
fs.mkdirSync(OUT, { recursive: true });
const made = {};
for (const [mood, m] of Object.entries(MOODS)) {
  const r = await page.evaluate(async m => {
    const take = writeCue(m.cue, m.params, m.seed), bytes = await Engine.renderWav(take, "room");
    let s = ""; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return { b64: btoa(s), secs: take.secs };
  }, m);
  const wav = path.join(OUT, mood + ".wav"), ogg = path.join(OUT, mood + ".ogg");
  fs.writeFileSync(wav, Buffer.from(r.b64, "base64"));
  const measure = f => {                                   // ffmpeg's loudness meter (it prints to stderr): integrated LUFS and the true peak
    const err = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr || "";
    const j = JSON.parse(err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1)); return { i: +j.input_i, tp: +j.input_tp };
  };
  const lv = measure(wav);
  const gain = Math.min(LUFS - lv.i, PEAK - lv.tp);           // to the loudness, unless a peak would go over
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-af", `volume=${gain.toFixed(2)}dB`, "-ac", "2", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "3", ogg]);
  fs.unlinkSync(wav);
  const after = measure(ogg);
  const secs = oggSecs(ogg);
  made[mood] = Object.assign({}, m, { file: mood + ".ogg", secs: +secs.toFixed(2), cue_secs: +r.secs.toFixed(2), gain_db: +gain.toFixed(2), lufs: after.i, peak: after.tp });
  console.log(`  ${mood}: ${m.cue} (seed ${m.seed}), ${secs.toFixed(1)} s, ${(fs.statSync(ogg).size / 1024).toFixed(0)} KB, ${lv.i} LUFS made ${after.i} (peak ${after.tp})`);
}
await browser.close();
fs.writeFileSync(path.join(OUT, "moods.json"), JSON.stringify({ format: "horrorstudio-moods", made: new Date().toISOString().slice(0, 10),
  by: "tools/score/moods.mjs: the score room's cues rendered through its sampled orchestra (CC0 samples: Content/Studio/Music/samples)", moods: made }, null, 1) + "\n");
console.log("MOODS made");
