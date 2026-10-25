// Shared voice timeline for record.mjs (actions + subtitles) and build.mjs (audio mix).
// Audio is read in place from the owner's music folder; never copied into the repo.
const DIR = "F:/Files/Music/My Music/song_exports/";
export const MUSIC = DIR + "lofi_seville.mp3";

// Speech boundaries inside each file (ffmpeg silencedetect noise=-40dB:d=0.4) and the transcript lines (file-local seconds).
const FILES = [
  { path: DIR + "voice/v1.mp3", s: 0.888, e: 34.354, lines: [
    [0.9, 5.8, "Hey guys, have you ever wanted a quick way to find a skill that will complement your build?"],
    [5.8, 9.3, "I got tired of looking through the usual sites."],
    [9.3, 15.5, "Usually I ask an experienced friend, but this last season I was playing mostly by myself"],
    [15.5, 18.5, "because they're all waiting for 1.0."],
    [18.5, 26.5, "So I didn't have a way to easily identify a skill that would really complement my current build."],
    [26.5, 31.8, "So I decided to make it easier for myself and I created Synergy Wizard."],
    [31.8, 34.35, "You search for a skill by what it does."],
  ] },
  { path: DIR + "voice/v2.mp3", s: 0.511, e: 17.511, lines: [
    [0.51, 7.9, "Just type in plain words, something like: what skill will protect me for a few seconds?"],
    [7.9, 15.1, "Synergy Wizard will show you skill gems, supports and passives that best fit that criteria,"],
    [15.1, 17.51, "ranked by how close they are to what you asked for."],
  ] },
  { path: DIR + "voice/v3.mp3", s: 1.461, e: 20.884, lines: [
    [1.46, 3.3, "It's a free tool, it's in beta."],
    [3.3, 10.0, "So if something's missing or something's not working quite right, just leave me some feedback on my page."],
    [10.0, 12.4, "I read every message."],
    [12.4, 13.4, "Check it out."],
    [13.4, 20.884, "It's at poe2.90sgamer.com. The link is in the description. Thanks."],
  ] },
];

const FIRST_AT = 0.6, GAP = 0.5, HOLD = 2.0, MAXCH = 32;
export const voice = [];
let at = FIRST_AT; // video time at which this file's speech starts
for (const f of FILES) {
  const dur = f.e - f.s;
  voice.push({ path: f.path, trimStart: f.s, trimEnd: f.e, delay: at, speechEnd: at + dur, shift: at - f.s });
  at += dur + GAP;
}
export const lastSpeechEnd = voice[2].speechEnd;
export const end = lastSpeechEnd + HOLD;
export const total = end;

// absolute video time of file-local time t in voice part n (0-based)
const abs = (n, t) => t + voice[n].shift;

function split(text) {
  const n = Math.ceil(text.length / MAXCH);
  if (n <= 1) return [text];
  const limit = Math.min(MAXCH, Math.ceil(text.length / n) + 4);
  const words = text.split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > limit) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

export const lines = [];
export const cues = [];
FILES.forEach((f, n) => {
  f.lines.forEach(([a, b, text]) => {
    const start = abs(n, Math.max(a, f.s)), stop = abs(n, Math.min(b, f.e));
    lines.push({ part: n + 1, start, end: stop, text });
    const pieces = split(text);
    const totalCh = pieces.reduce((s, p) => s + p.length, 0);
    let t = start;
    for (const p of pieces) {
      const d = ((stop - start) * p.length) / totalCh;
      cues.push({ start: t, end: t + d, text: p });
      t += d;
    }
  });
});

export const named = {
  typeQuery: abs(1, 4.0),
  showResults: abs(1, 7.9),
  ranked: abs(1, 15.1),
  beta: abs(2, 1.5),
  feedback: abs(2, 3.3),
  checkItOut: abs(2, 12.4),
  url: abs(2, 13.4),
  end,
};
