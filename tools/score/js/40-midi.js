// The recorder (every note the engine plays, with the scene changes and tempo) and the Standard MIDI File writer:
// one track per instrument with its General MIDI program, the kit on channel 10, the tempo map so bars line up in
// REAPER when the music had a beat.
"use strict";

const Recorder = {
  on: true, t0: 0, notes: [], marks: [], tempos: [], limit: 20000,
  start(t0) { this.t0 = t0; this.notes = []; this.marks = []; this.tempos = [{ t: 0, bpm: 120, meter: [4, 4] }]; },
  note(inst, midi, vel, when, dur) {
    if (!this.on) return;
    this.notes.push({ inst, midi, vel, t: when - this.t0, dur: Math.max(0.03, dur || 0.3) });
    if (this.notes.length > this.limit) this.notes.splice(0, this.notes.length - this.limit);
  },
  mark(text, when) { this.marks.push({ t: when - this.t0, text }); },
  tempo(bpm, meter, when) {
    const t = Math.max(0, when - this.t0);
    const last = this.tempos[this.tempos.length - 1];
    if (last && Math.abs(last.t - t) < 0.001) { last.bpm = bpm; last.meter = meter; } else this.tempos.push({ t, bpm, meter });
  },
  // the notes between two times (s from the start), shifted to begin at 0
  slice(from, to) {
    const notes = this.notes.filter(n => n.t >= from && n.t < to).map(n => ({ ...n, t: n.t - from }));
    const marks = this.marks.filter(m => m.t >= from && m.t < to).map(m => ({ ...m, t: m.t - from }));
    let tempos = this.tempos.filter(x => x.t < to).map(x => ({ ...x, t: Math.max(0, x.t - from) }));
    const before = tempos.filter(x => x.t === 0);
    tempos = (before.length ? [before[before.length - 1]] : [{ t: 0, bpm: 120, meter: [4, 4] }]).concat(tempos.filter(x => x.t > 0));
    return { notes, marks, tempos };
  },
};

const MIDI = {
  PPQ: 480,
  // write({notes: [{inst, midi, vel, t, dur}], tempos: [{t, bpm, meter}], marks: [{t, text}], name}) -> Uint8Array
  write({ notes, tempos, marks = [], name = "Woohill living music" }) {
    const ppq = this.PPQ;
    tempos = (tempos && tempos.length ? tempos : [{ t: 0, bpm: 120, meter: [4, 4] }]).slice().sort((a, b) => a.t - b.t);
    // seconds -> ticks through the tempo map
    const segs = [];
    let tick = 0;
    tempos.forEach((x, i) => { segs.push({ t: x.t, tick, bpm: x.bpm }); const next = tempos[i + 1]; if (next) tick += (next.t - x.t) * x.bpm / 60 * ppq; });
    const toTick = t => { let s = segs[0]; for (const g of segs) if (g.t <= t) s = g; return Math.round(s.tick + (t - s.t) * s.bpm / 60 * ppq); };
    const tracks = [];
    // track 0: name, tempo map, meters, markers
    const meta = [];
    meta.push({ tick: 0, data: metaEv(0x03, strBytes(name)) });
    for (const x of tempos) {
      const us = Math.round(60000000 / x.bpm);
      meta.push({ tick: toTick(x.t), data: metaEv(0x51, [(us >> 16) & 255, (us >> 8) & 255, us & 255]) });
      const [nn, dd] = x.meter || [4, 4];
      meta.push({ tick: toTick(x.t), data: metaEv(0x58, [nn, Math.round(Math.log2(dd)), 24, 8]) });
    }
    for (const m of marks) meta.push({ tick: toTick(m.t), data: metaEv(0x06, strBytes(m.text)) });
    tracks.push(meta);
    // one track per instrument
    const byInst = {};
    for (const n of notes) (byInst[n.inst] = byInst[n.inst] || []).push(n);
    let chan = 0;
    for (const inst of Object.keys(byInst).sort()) {
      const isKit = inst === "drums";
      const ch = isKit ? 9 : chan;
      if (!isKit) { chan++; if (chan === 9) chan++; if (chan > 15) chan = 15; }
      const ev = [{ tick: 0, data: metaEv(0x03, strBytes(TRACK_NAMES[inst] || inst)) }];
      if (!isKit) ev.push({ tick: 0, data: [0xC0 | ch, GM_PROGRAM[inst] ?? 0] });
      for (const n of byInst[inst]) {
        const on = toTick(Math.max(0, n.t)), off = Math.max(on + 1, toTick(Math.max(0, n.t) + n.dur));
        const key = clamp(Math.round(n.midi), 0, 127), vel = clamp(Math.round(n.vel), 1, 127);
        ev.push({ tick: on, data: [0x90 | ch, key, vel], on: 1 });
        ev.push({ tick: off, data: [0x80 | ch, key, 0], on: 0 });
      }
      tracks.push(ev);
    }
    // the file
    const out = [...strBytes("MThd"), 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (ppq >> 8) & 255, ppq & 255];
    for (const ev of tracks) {
      ev.sort((a, b) => a.tick - b.tick || (a.on ?? 2) - (b.on ?? 2));   // note-offs before note-ons on a tick
      const body = [];
      let last = 0;
      for (const e of ev) { body.push(...varLen(e.tick - last), ...e.data); last = e.tick; }
      body.push(0, 0xFF, 0x2F, 0);
      out.push(...strBytes("MTrk"), (body.length >>> 24) & 255, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255, ...body);
    }
    return new Uint8Array(out);
  },
  // A minimal reader (the check reads back what it wrote): [{inst: track name, midi, vel, tick, dur ticks}], ppq.
  read(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let p = 0;
    const u32 = () => (b[p++] << 24 | b[p++] << 16 | b[p++] << 8 | b[p++]) >>> 0, u16 = () => (b[p++] << 8) | b[p++];
    const vl = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
    if (String.fromCharCode(...b.slice(0, 4)) !== "MThd") throw new Error("not a MIDI file");
    p = 8; u16(); const n = u16(), ppq = u16();
    const notes = [], tempos = [];
    for (let k = 0; k < n; k++) {
      p += 4; const len = u32(), end = p + len;
      let tick = 0, status = 0, name = "";
      const open = {};
      while (p < end) {
        tick += vl();
        let s = b[p];
        if (s & 0x80) { status = s; p++; } else s = status;
        if (s === 0xFF) { const type = b[p++], l = vl(); const d = b.slice(p, p + l); p += l;
          if (type === 0x03) name = String.fromCharCode(...d);
          if (type === 0x51) tempos.push({ tick, bpm: 60000000 / ((d[0] << 16) | (d[1] << 8) | d[2]) }); }
        else if (s === 0xF0 || s === 0xF7) { p += vl(); }
        else { const hi = s & 0xF0, d1 = b[p++], d2 = (hi === 0xC0 || hi === 0xD0) ? 0 : b[p++];
          if (hi === 0x90 && d2 > 0) open[d1] = { tick, vel: d2 };
          else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) { const o = open[d1]; if (o) { notes.push({ inst: name, midi: d1, vel: o.vel, tick: o.tick, dur: tick - o.tick }); delete open[d1]; } } }
      }
      p = end;
    }
    return { ppq, notes, tempos };
  },
};
const TRACK_NAMES = { piano: "Piano (Meta Piano)", guitar: "Nylon guitar", harp: "Harp", glock: "Glockenspiel", marimba: "Marimba",
  xylo: "Xylophone", bells: "Tubular bells", pizz: "Strings pizzicato", strings: "Strings", trem: "Strings tremolo", flute: "Flute",
  flute_stac: "Flute staccato", horn: "French horn", timpani: "Timpani", drums: "Drums (GM)", celesta: "Celesta (synth)", pad: "Pad (synth)" };

function varLen(v) { v = Math.max(0, Math.round(v)); const bytes = [v & 127]; while ((v >>= 7)) bytes.unshift((v & 127) | 128); return bytes; }
function strBytes(s) { return Array.from(new TextEncoder().encode(s)); }
function metaEv(type, data) { return [0xFF, type, ...varLen(data.length), ...data]; }

function downloadBytes(bytes, filename, mime = "audio/midi") {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// An AudioBuffer as a 16-bit WAV file (the offline renders).
function wavBytes(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt "); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, clamp(data[c][i], -1, 1) * 32767, true); o += 2; }
  return new Uint8Array(out.buffer);
}
