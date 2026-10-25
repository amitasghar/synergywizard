// Assembles the Short from .work/raw.webm + narration + music.
// Default: narrated version (voice parts v1-v3 + lofi music, see narration.mjs).
// Usage: npm run short:build
//        npm run short:build -- --no-voice [--music "path/to/track.mp3"] [--music-start 12.5]   (old music-only mode)
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { voice, MUSIC as NARR_MUSIC, total as NARR_TOTAL } from "./narration.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, ".work");
const out = path.resolve(here, "../../media/video/synergy-wizard-short.mp4");
fs.mkdirSync(path.dirname(out), { recursive: true });
const timings = JSON.parse(fs.readFileSync(path.join(work, "timings.json"), "utf8"));
const raw = path.join(work, "raw.webm");
const NO_VOICE = process.argv.includes("--no-voice");

const run = (args, capture = false) => {
  const r = spawnSync(ffmpeg, args, capture ? { encoding: "utf8", maxBuffer: 1 << 26 } : { stdio: "inherit" });
  if (r.status !== 0) {
    if (capture) console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  return r;
};
// Integrated-loudness / measurement via loudnorm's json output.
const measure = (inputArgs, af) => {
  const r = run(["-hide_banner", ...inputArgs, "-af", `${af}loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"], true);
  const m = r.stderr.slice(r.stderr.lastIndexOf("{"), r.stderr.lastIndexOf("}") + 1);
  return JSON.parse(m);
};

const VIDEO_FILTER = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p";
const VIDEO_ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr"];
const AUDIO_ENC = ["-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "44100"];

if (NO_VOICE) {
  // ---- old music-only mode ----
  const DEFAULT_MUSIC = "F:/Files/Music/My Music/song_exports/kelethin.mp3";
  const DEFAULT_MUSIC_START = 4.9;
  const mi = process.argv.indexOf("--music");
  const MUSIC = mi > -1 ? process.argv[mi + 1] : DEFAULT_MUSIC;
  const si = process.argv.indexOf("--music-start");
  const MUSIC_START = si > -1 ? Number(process.argv[si + 1]) : DEFAULT_MUSIC_START;
  const start = Math.max(0, (timings.videoOffset ?? 0) - 0.1);
  const dur = Math.min(60, timings.total / 1000 + 0.2);
  const fadeOut = Math.max(0, dur - 1.5);
  console.log({ MUSIC, MUSIC_START, start, dur });
  run([
    "-y", "-ss", String(start), "-t", String(dur), "-i", raw, "-ss", String(MUSIC_START), "-i", MUSIC,
    "-filter_complex",
    `[0:v]${VIDEO_FILTER}[v];` +
      `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOut}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]`,
    "-map", "[v]", "-map", "[a]", "-t", String(dur), ...VIDEO_ENC, ...AUDIO_ENC, "-movflags", "+faststart", out,
  ]);
  console.log("Wrote", out);
  process.exit(0);
}

// ---- narrated mode ----
const START_PAD = 0.1; // seconds of slack before the estimated filming start
const start = Math.max(0, (timings.videoOffset ?? 0) - START_PAD);
const dur = NARR_TOTAL;
const fadeOut = 2;
console.log({ start, dur, voice: voice.map((v) => v.delay) });

const voiceInputs = voice.flatMap((v) => ["-i", v.path]);
const voiceChain =
  voice
    .map((v, i) => {
      const ms = Math.round(v.delay * 1000);
      return `[${i}:a]atrim=start=${v.trimStart}:end=${v.trimEnd},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[p${i}]`;
    })
    .join(";") +
  `;${voice.map((_, i) => `[p${i}]`).join("")}amix=inputs=${voice.length}:normalize=0:duration=longest,apad=whole_dur=${dur},atrim=0:${dur},` +
  `highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120[voice]`;

// Stage 1: processed voice track -> measure its loudness (to set the music 18 dB below it).
const voiceWav = path.join(work, "voice.wav");
run(["-y", "-hide_banner", "-loglevel", "error", ...voiceInputs, "-filter_complex", voiceChain, "-map", "[voice]", "-ar", "44100", "-ac", "2", voiceWav]);
const vm = measure(["-i", voiceWav], "");
const voiceLufs = Number(vm.input_i);
// Music loudness (over the portion used).
const mm = measure(["-t", String(dur), "-i", NARR_MUSIC], "");
const musicLufs = Number(mm.input_i);
const musicGain = voiceLufs - 18 - musicLufs;
console.log({ voiceLufs, musicLufs, musicGain: musicGain.toFixed(1) + " dB" });

// Stage 2: mix voice + ducked music into one wav.
const mixWav = path.join(work, "mix.wav");
run([
  "-y", "-hide_banner", "-loglevel", "error", "-i", voiceWav, "-i", NARR_MUSIC,
  "-filter_complex",
  `[0:a]asplit=2[vo][sc];` +
    `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=in:st=0:d=1,afade=t=out:st=${dur - fadeOut}:d=${fadeOut},volume=${musicGain.toFixed(2)}dB[mus];` +
    `[mus][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];` +
    `[vo][duck]amix=inputs=2:normalize=0:duration=first,atrim=0:${dur}[mix]`,
  "-map", "[mix]", "-ar", "44100", "-ac", "2", mixWav,
]);

// Stage 3: two-pass loudnorm (I=-14, TP=-1.5, LRA=11).
const p1 = measure(["-i", mixWav], "");
console.log("loudnorm pass 1:", p1);
const ln =
  `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${p1.input_i}:measured_TP=${p1.input_tp}:measured_LRA=${p1.input_lra}:measured_thresh=${p1.input_thresh}:offset=${p1.target_offset}:linear=true,aresample=44100`;

run([
  "-y", "-ss", String(start), "-t", String(dur), "-i", raw, "-i", mixWav,
  "-filter_complex", `[0:v]${VIDEO_FILTER}[v];[1:a]${ln}[a]`,
  "-map", "[v]", "-map", "[a]", "-t", String(dur), ...VIDEO_ENC, ...AUDIO_ENC, "-movflags", "+faststart", out,
]);
console.log("Wrote", out);

// Verify final loudness.
const fin = measure(["-i", out], "");
console.log(`FINAL integrated loudness: ${fin.input_i} LUFS, true peak ${fin.input_tp} dBTP, LRA ${fin.input_lra}`);
