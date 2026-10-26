// Screenplay typing: a scene's lines as text, the way a script is written, and back. One line a clip:
//   Mari: You came.                         -> who mari, en "You came."
//   Mari: 来てくれたんだ。 / You came.         -> ja (what gets recorded) and en (the subtitle)
//   (she steps back, smiling)               -> the acting note (act) of the line before it, or of the next when first
//   You: Mari?                              -> the player (You, Me, I, Player)
//   Mari: Don't open it. [CU]               -> a shot at its end (ECU CU MCU MS FS WS)
// A line longer than a take (clip_max) is split at its sentences (a sentence too long, at its commas) into clips that
// fit, joined by blinks. Blank lines and
// lines starting # are skipped. No DOM: DESK tests it.
//   parse(text, {cast, clipMax, secs}) -> {lines: [{who, en, ja, act, shot, split}], warns: [text]}
//   toText(clips, cast) -> the clips as such text
//   applyTo(clips, lines, newId) -> {clips, kept, changed, added, removed}: a line still there keeps its clip (its
//     take, body, camera and all); one whose words changed keeps its clip with the new words; the rest are new
const SHOTS = ["ecu", "cu", "mcu", "ms", "fs", "ws"];
const PLAYER = new Set(["you", "me", "i", "player", "the player", "僕", "私", "俺"]);
const CJK = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const SENT = /[^。！？!?.…]+(?:[。！？!?.…]+["」』)]*\s*|$)/g;
const sentences = t => (String(t || "").match(SENT) || []).map(s => s.trim()).filter(Boolean);

export function speakerOf(name, cast = {}) {         // a name as written -> a cast id, "player", or null
  const n = String(name || "").trim().toLowerCase(); if (!n) return null;
  if (PLAYER.has(n)) return "player";
  for (const [id, c] of Object.entries(cast)) if (id.toLowerCase() === n || String((c || {}).name || "").trim().toLowerCase() === n) return id;
  return null;
}
// the words after "Name:": Japanese and English split at " / " (or " | "); one language alone goes where it belongs
function words(t) {
  const parts = String(t).split(/\s+[\/|｜]\s+/), out = {};
  for (const p of parts.map(x => x.trim()).filter(Boolean)) { if (CJK.test(p) && !out.ja) out.ja = p; else if (!out.en) out.en = p; else out.en += " " + p; }
  return out;
}
// a line too long for one take: its sentences in clips that fit (the recorded language decides; the subtitle is
// split alongside when it has as many sentences, else it stays whole on the first)
function fit(line, clipMax, secs) {
  if (!clipMax || !secs || secs(line) <= clipMax) return [line];
  const key = line.ja ? "ja" : "en", parts = [];
  for (const x of sentences(line[key])) {           // a sentence still too long: at its commas
    if (secs({ [key]: x }) <= clipMax) { parts.push(x); continue; }
    parts.push(...(x.match(/[^、,，;；]+(?:[、,，;；]\s*|$)/g) || [x]).map(y => y.trim()).filter(Boolean));
  }
  if (parts.length < 2) return [line];
  const out = []; let cur = [];
  for (const s of parts) { const t = [...cur, s].join(key === "ja" ? "" : " "); if (cur.length && secs({ [key]: t }) > clipMax) { out.push(cur); cur = [s]; } else cur.push(s); }
  if (cur.length) out.push(cur);
  if (out.length < 2) return [line];
  const other = key === "ja" ? "en" : null, os = other && line[other] ? sentences(line[other]) : [];
  let oi = 0;
  return out.map((g, i) => {
    const c = Object.assign({}, line, { [key]: g.join(key === "ja" ? "" : " "), split: i + 1 });
    if (i) delete c.act;
    if (other && line[other]) {
      if (os.length === parts.length) { c[other] = os.slice(oi, oi + g.length).join(" "); oi += g.length; }
      else if (i) delete c[other];
    }
    return c;
  });
}
export function parse(text, { cast = {}, clipMax = 10, secs = null } = {}) {
  const lines = [], warns = [], unknown = new Set(); let pending = null;
  String(text || "").replace(/\r/g, "").split("\n").forEach((raw, n) => {
    const t = raw.trim(); if (!t || t.startsWith("#")) return;
    const note = t.match(/^[(（](.*)[)）]$/);
    if (note) { const a = note[1].trim(); if (lines.length) lines[lines.length - 1].act = [lines[lines.length - 1].act, a].filter(Boolean).join("; "); else pending = [pending, a].filter(Boolean).join("; "); return; }
    const m = t.match(/^([^:：]{1,40})[:：]\s*(.*)$/);
    if (!m) { warns.push(`line ${n + 1}: no speaker (write it as "Name: what they say")`); return; }
    let rest = m[2], shot = null;
    const tag = rest.match(/\s*\[(e?cu|mcu|ms|fs|ws)\]\s*$/i); if (tag) { shot = tag[1].toLowerCase(); rest = rest.slice(0, tag.index); }
    const who = speakerOf(m[1], cast);
    if (!who) unknown.add(m[1].trim());
    const line = Object.assign({ who: who || m[1].trim().toLowerCase().replace(/\s+/g, "_"), name: m[1].trim() }, words(rest));
    if (shot && SHOTS.includes(shot)) line.shot = shot;
    if (pending) { line.act = pending; pending = null; }
    if (!line.en && !line.ja) { warns.push(`line ${n + 1}: ${m[1].trim()} says nothing`); return; }
    const parts = fit(line, clipMax, secs);
    if (parts.length > 1) warns.push(`${m[1].trim()}'s line ${n + 1} is longer than a take: split into ${parts.length} clips at its sentences`);
    lines.push(...parts);
  });
  for (const u of unknown) warns.push(`${u} isn't in the cast: add them in the Database, or write their name as it is there`);
  for (const l of lines) delete l.name;
  return { lines, warns };
}
export function toText(clips, cast = {}) {
  return (clips || []).map(c => {
    const who = c.who === "player" ? "You" : ((cast[c.who] || {}).name || c.who || "?");
    const say = [c.ja, c.en].filter(Boolean).join(" / ") || "…";
    return `${who}: ${say}${c.shot ? ` [${c.shot.toUpperCase()}]` : ""}${c.act ? `\n(${c.act})` : ""}`;
  }).join("\n");
}
const bag = c => new Set(`${c.en || ""} ${c.ja || ""}`.toLowerCase().match(/[a-z0-9']+|[\u3040-\u9fff]/g) || []);
function like(a, b) { const x = bag(a), y = bag(b); if (!x.size && !y.size) return 1; let k = 0; for (const w of x) if (y.has(w)) k++; return k / (x.size + y.size - k); }   // shared words, 0..1
const same = (c, l) => c.who === l.who && (c.en || "") === (l.en || "") && (c.ja || "") === (l.ja || "");
export function applyTo(clips, lines, newId) {
  const old = clips || [], n = old.length, m = lines.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));      // the longest run of lines unchanged
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = same(old[i], lines[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = []; for (let i = 0, j = 0; i < n && j < m;) {
    if (same(old[i], lines[j]) && L[i][j] === L[i + 1][j + 1] + 1) { pairs.push([i, j]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  pairs.push([n, m]);                              // the end, so the last gap is handled like the others
  const out = [], used = new Set(); let kept = 0, changed = 0, added = 0, i0 = 0, j0 = 0;
  const put = (c, l) => {                          // a clip kept: its words, note and shot from the text
    for (const k of ["en", "ja"]) { if (l[k]) c[k] = l[k]; else delete c[k]; }
    if (l.act) c.act = l.act; else delete c.act;
    if (l.shot) c.shot = l.shot;
    used.add(c); out.push(c);
  };
  for (const [pi, pj] of pairs) {
    // between lines unchanged: each new line keeps the clip of the old one it's most like (the same speaker, in order),
    // so an edited line keeps its take and body and an inserted one is new
    const go = old.slice(i0, pi), gl = lines.slice(j0, pj), A = go.length, B = gl.length;
    const D = Array.from({ length: A + 1 }, () => new Array(B + 1).fill(0));
    const sc = (a, b) => go[a].who === gl[b].who ? 0.1 + like(go[a], gl[b]) : -1;
    for (let a = A - 1; a >= 0; a--) for (let b = B - 1; b >= 0; b--) D[a][b] = Math.max(D[a + 1][b], D[a][b + 1], sc(a, b) >= 0 ? sc(a, b) + D[a + 1][b + 1] : -1);
    for (let a = 0, b = 0; b < B;) {
      if (a < A && sc(a, b) >= 0 && Math.abs(D[a][b] - (sc(a, b) + D[a + 1][b + 1])) < 1e-9) { put(go[a], gl[b]); changed++; a++; b++; }
      else if (a < A && D[a][b] === D[a + 1][b]) a++;
      else { const l = gl[b], c = { id: newId(out.concat(old)), who: l.who }; for (const x of ["ja", "en", "act", "shot"]) if (l[x]) c[x] = l[x]; used.add(c); out.push(c); added++; b++; }
    }
    if (pi < n) { put(old[pi], lines[pj]); kept++; }
    i0 = pi + 1; j0 = pj + 1;
  }
  out.forEach((c, x) => { if (x && !c.seam) c.seam = { kind: "blink" }; if (!x) delete c.seam; });
  return { clips: out, kept, changed, added, removed: old.filter(c => !used.has(c)).length };
}
