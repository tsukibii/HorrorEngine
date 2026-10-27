// HorrorStudio: the string sets, which samples play a cue's strings (docs/MUSIC.md §7.1). Every cue writes its
// string parts as "strings" (sustain), "trem" (tremolo) and "pizz" (pizzicato); a set says which instruments sound
// each of them, so the same notes can be heard on Woohill's section, the full section with violas and a double bass,
// the low strings alone, two solo players, or eerie stand-ins, and you choose by ear. The notes never change (a
// favourite's fingerprint stays), only the samples.
//
// A role's members: an instrument, or {inst, lo, hi} (it plays only notes from lo to hi). A note goes to every
// member that holds it (a stack: the full section's violins, violas and basses together), else to the set's
// fallback, else to the nearest member. A stack of n sits about 2 dB a member under one alone, so a set doesn't
// change the mix by much more than its colour.
"use strict";

const STRING_ROLES = ["strings", "trem", "pizz"];
const STRING_SETS = {
  section: {
    label: "Section (the original)",
    note: "Woohill's VSCO-2 violin and cello sections, the strings every cue was written and mixed with: warm, full, a little soft at the edges. The safe choice anywhere.",
    roles: { strings: ["strings"], trem: ["trem"], pizz: ["pizz"] },
  },
  full: {
    label: "Full section",
    note: "Thicker and darker: violas fill the middle and a double bass doubles everything under C3. Best for dread beds, the chase, death, the ritual and the big romance swell. Muddy in a small room (closet, basement): pick a bigger one in “played in”.",
    roles: {
      strings: ["strings", { inst: "viola_sus", lo: 48, hi: 79 }, { inst: "cbass_sus", lo: 28, hi: 47 }],
      trem: ["trem", { inst: "viola_trem", lo: 48, hi: 79 }, { inst: "cbass_trem", lo: 28, hi: 47 }],
      pizz: ["pizz", { inst: "viola_pizz", lo: 48, hi: 79 }, { inst: "cbass_pizz", lo: 28, hi: 47 }],
    },
  },
  low: {
    label: "Low strings (no violins)",
    note: "Cellos with the double bass under them and violas taking the high notes: muffled, heavy, close. Best for hiding, grief, the house at night, a sad flashback, anything that should feel underground. High lines lose their shine.",
    roles: {
      strings: [{ inst: "cello_sus", lo: 36, hi: 72 }, { inst: "viola_sus", lo: 73, hi: 90 }, { inst: "cbass_sus", lo: 24, hi: 47 }],
      trem: [{ inst: "cello_trem", lo: 36, hi: 72 }, { inst: "viola_trem", lo: 73, hi: 90 }, { inst: "cbass_trem", lo: 24, hi: 47 }],
      pizz: [{ inst: "cello_pizz", lo: 36, hi: 72 }, { inst: "viola_pizz", lo: 73, hi: 90 }, { inst: "cbass_pizz", lo: 24, hi: 47 }],
    },
  },
  solo: {
    label: "Solo (one violin, one bass)",
    note: "A solo violin over a solo double bass: thin, exposed, close enough to hear the bow. Best for a lament, the lullaby, her theme when she's alone, the close moment, Psycho-like stabs. A chord becomes a few players, not a section, so it never swells.",
    roles: {
      strings: [{ inst: "vln_solo", lo: 55, hi: 100 }, { inst: "cbass_sus", lo: 24, hi: 54 }],
      trem: [{ inst: "vln_solo_trem", lo: 55, hi: 100 }, { inst: "cbass_trem", lo: 24, hi: 54 }],
      pizz: [{ inst: "vln_solo_pizz", lo: 55, hi: 100 }, { inst: "cbass_pizz", lo: 24, hi: 54 }],
    },
  },
  eerie: {
    label: "Eerie (psaltery and solo tremolo)",
    note: "The sustained strings from A#4 up become a bowed psaltery (a thin, wavering singing-saw tone), the tremolo one shaking violin; the low notes stay the section. Best for ghost cues: the lullaby, behind you, the music box, a presence in the room. Wrong for a romance swell.",
    roles: { strings: [{ inst: "psaltery", lo: 70, hi: 92 }], trem: [{ inst: "vln_solo_trem", lo: 55, hi: 100 }], pizz: ["pizz"] },
    fallback: { strings: "strings", trem: "trem" },
  },
  glass: {
    label: "Glass (bowed metal and wine glasses)",
    note: "Sustained notes from A3 up become a bowed vibraphone, the top (D#5 up) rubbed wine glasses over it: pure, cold, unearthly, no bow noise at all. Best for a long held chord under a ghost, the memory of her, the moment before she appears. Tremolo and pizzicato stay the section; a fast line smears.",
    roles: { strings: [{ inst: "vibes_bowed", lo: 57, hi: 90 }, { inst: "glass", lo: 75, hi: 88 }], trem: ["trem"], pizz: ["pizz"] },
    fallback: { strings: "strings" },
  },
};
// Which set suits a cue best, in a word (shown by the cue; "use" sets it). Cues not named here: the section.
const STRING_ADVICE = {
  dread_drone: ["full", "the double bass gives the drone a floor you feel"],
  stalker_ostinato: ["low", "no violins: the pattern stays down where footsteps are"],
  music_box: ["eerie", "the psaltery over the box sounds like the box remembering a voice"],
  riser: ["full", "the climb gets heavier as it goes"],
  hiding_tension: ["low", "muffled, as if heard through the wardrobe door"],
  chase: ["full", "weight under the running"],
  death: ["full", "the biggest, darkest version"],
  behind_you: ["glass", "a cold bowed shimmer before the turn"],
  house_creaks: ["low", "the house's own low groan"],
  ritual: ["full", "a congregation, not a quartet"],
  sad_flashback: ["low", "cellos alone: grief without sweetness"],
  slowmo_romance: ["full", "the swell the scene is waiting for"],
  close_moment: ["solo", "two players, nearly whispering"],
  her_theme: ["solo", "her alone; switch to Full for the big reprise"],
  ghost_lullaby: ["eerie", "a ghost humming it"],
  ending: ["full", "the last swell; Solo for the quiet bad ending"],
  obsession_confession: ["full", "each key change a step closer"],
  sweet_then_wrong: ["solo", "sweet and thin, so the turn cuts deeper"],
};

// The instruments a role plays on a note in a set: [[inst, dB], ...]. Roles that aren't string roles play themselves.
function stringMembers(role, midi, setId, index) {
  const set = STRING_SETS[setId];
  if (!set || !STRING_ROLES.includes(role) || !set.roles[role]) return [[role, 0]];
  const list = set.roles[role].map(m => typeof m === "string" ? { inst: m } : m).filter(m => !index || index[m.inst]);
  const holds = m => { const r = (index && index[m.inst] && index[m.inst].range) || [0, 127]; return midi >= (m.lo ?? r[0] - 3) && midi <= (m.hi ?? r[1] + 3); };
  const on = list.filter(holds);
  if (on.length) return on.map(m => [m.inst, -2 * (on.length - 1)]);
  const fb = set.fallback && set.fallback[role];
  if (fb && (!index || index[fb])) return [[fb, 0]];
  if (!list.length) return [[role, 0]];
  const dist = m => { const r = (index && index[m.inst] && index[m.inst].range) || [0, 127], lo = m.lo ?? r[0], hi = m.hi ?? r[1]; return midi < lo ? lo - midi : midi - hi; };
  return [[list.slice().sort((a, b) => dist(a) - dist(b))[0].inst, 0]];
}
// Every instrument a set can use for a role (what to load before a take plays).
const stringInsts = (role, setId) => {
  const set = STRING_SETS[setId];
  if (!set || !STRING_ROLES.includes(role) || !set.roles[role]) return [role];
  return uniq(set.roles[role].map(m => typeof m === "string" ? m : m.inst).concat(set.fallback && set.fallback[role] ? [set.fallback[role]] : []));
};
