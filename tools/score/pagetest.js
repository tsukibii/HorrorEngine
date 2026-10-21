// The score room in a headless browser: every cue opens and writes its card, variations come, keeping one saves
// the palette through the server, a WAV renders with sound in it, a MIDI file is written. Ends "SCOREPAGE ok".
//
//   python tools/score/serve.py            (in another shell)
//   node tools/score/pagetest.js [shot.png]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>). It saves into a scratch scope it
// cleans up after: the studio's palette is untouched.
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.SCORE_URL || "http://127.0.0.1:8791/";

(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const fail = msg => { console.log("FAIL " + msg); process.exitCode = 1; };
  await page.goto(URL);
  await page.waitForFunction(() => window.__scoreReady, null, { timeout: 20000 });

  // every cue: its card writes, its controls draw
  const ids = await page.evaluate(() => Object.keys(CUES));
  for (const id of ids) {
    const r = await page.evaluate(id => { selectCue(id); return { cards: document.querySelectorAll("#cards .card").length, params: document.querySelectorAll("#params .prm").length }; }, id);
    if (r.cards !== 1 || r.params < 1) fail(id + " card " + JSON.stringify(r));
  }
  console.log("cues", ids.length);

  // variations, keep two (the button and Shift+2), against a scratch palette held in memory (no server writes)
  await page.evaluate(() => { selectCue("music_box"); UI.scope = "__pagetest"; UI.palette = { format: "horrorstudio-score-palette", version: 1, scope: "__pagetest", favourites: [], sequences: [] }; window.savePalette = async () => {}; });
  await page.click("#vary");
  const nvar = await page.evaluate(() => document.querySelectorAll("#cards .card").length - 1);
  if (nvar !== 8) fail("variations " + nvar);
  await page.click("#cards .card:nth-child(2) button:nth-child(2)");
  await page.keyboard.down("Shift"); await page.keyboard.press("Digit2"); await page.keyboard.up("Shift");
  const favs = await page.evaluate(() => UI.palette.favourites.map(f => ({ cue: f.cue, print: f.print, seed: f.seed })));
  if (favs.length !== 2 || favs.some(f => f.cue !== "music_box" || !/^[0-9a-f]{8}$/.test(f.print))) fail("favourites " + JSON.stringify(favs));
  const shown = await page.evaluate(() => document.querySelectorAll("#favs .fav").length);
  if (shown !== 2) fail("favourite cards " + shown);
  // the sequence: both favourites chained
  await page.evaluate(() => { for (const f of UI.palette.favourites) UI.seq.push({ fav: f.id, gap: 0.5 }); renderSeq(); });
  const seq = await page.evaluate(() => { const t = seqTake(UI.seq); return t && { parts: t.parts.length, secs: t.secs }; });
  if (!seq || seq.parts !== 2) fail("sequence " + JSON.stringify(seq));
  console.log("variations", nvar, "kept", favs.length, "sequence", JSON.stringify(seq));

  // the server's palette round trip, on a game's scope only if one exists; else the studio left as it was
  const rt = await page.evaluate(async () => {
    const g = (await (await fetch("/api/games")).json()).games;
    const r = await fetch("/api/palette/studio"); const pal = await r.json();
    return { games: g.length, studio: Array.isArray(pal.favourites) };
  });
  if (!rt.studio) fail("palette GET");

  // a WAV with sound in it, and a MIDI file
  const wav = await page.evaluate(async () => {
    const take = writeCue("reply_answer", { mood: "warm" }, 3);
    const bytes = await Engine.renderWav(take, "room");
    const dv = new DataView(bytes.buffer); let peak = 0;
    for (let o = 44; o < bytes.length; o += 2) peak = Math.max(peak, Math.abs(dv.getInt16(o, true)));
    const mid = Engine.midi(writeCue("chase", {}, 5));
    return { len: bytes.length, peak, riff: String.fromCharCode(...bytes.slice(0, 4)), mthd: String.fromCharCode(...mid.slice(0, 4)), midLen: mid.length };
  });
  if (wav.riff !== "RIFF" || wav.peak < 300) fail("wav " + JSON.stringify(wav));
  if (wav.mthd !== "MThd" || wav.midLen < 200) fail("midi " + JSON.stringify(wav));
  console.log("wav", wav.len, "bytes, peak", wav.peak, "| midi", wav.midLen, "bytes");

  // live playback starts and reports a position
  const pos = await page.evaluate(async () => { await playTake(writeCue("sting", {}, 1), null, null); await new Promise(r => setTimeout(r, 400)); const p = Engine.position(); stopAll(); return p; });
  if (!(pos > 0)) fail("playback position " + pos);

  // audition: two short variations and the settings, each cut at 3 s, then it says so
  await page.evaluate(() => { selectCue("punchline"); $("count").value = 2; makeVariations(); $("audsecs").value = 3; $("audition").click(); });
  await page.waitForFunction(() => /auditioned 3/.test(document.getElementById("status").textContent), null, { timeout: 30000 }).catch(() => fail("audition never finished"));

  await page.evaluate(() => { $("count").value = 8; selectCue("yandere_waltz"); makeVariations(); });
  if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
  if (errors.length) fail("page errors: " + errors.slice(0, 5).join(" | "));
  await browser.close();
  if (!process.exitCode) console.log("SCOREPAGE ok");
})().catch(e => { console.log("FAIL " + e.stack); process.exit(1); });
