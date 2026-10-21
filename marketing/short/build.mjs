// Assembles the Short from .work/raw.webm + music.
// Usage: npm run short:build [-- --music "path/to/track.mp3"]
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Swap the track here, or pass --music <path> on the command line (read in place, never copied into the repo).
const DEFAULT_MUSIC = "F:/Files/Music/My Music/song_exports/kelethin.mp3";
// Seconds into the track where the melody enters (found by loudness analysis: sharp jump at ~5.1 s). Override: --music-start <s>.
const DEFAULT_MUSIC_START = 4.9;
const mi = process.argv.indexOf("--music");
const MUSIC = mi > -1 ? process.argv[mi + 1] : DEFAULT_MUSIC;

const si = process.argv.indexOf("--music-start");
const MUSIC_START = si > -1 ? Number(process.argv[si + 1]) : DEFAULT_MUSIC_START;

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, ".work");
const out = path.resolve(here, "../../media/video/synergy-wizard-short.mp4");
fs.mkdirSync(path.dirname(out), { recursive: true });
const timings = JSON.parse(fs.readFileSync(path.join(work, "timings.json"), "utf8"));

// The video clock starts at page creation; videoOffset is the seconds before scene 1 (filming start).
const start = Math.max(0, (timings.videoOffset ?? 0) - 0.1);
const dur = Math.min(30, timings.total / 1000 + 0.2);
const fadeOut = Math.max(0, dur - 1.5);
console.log({ MUSIC, MUSIC_START, start, dur });

const args = [
  "-y", "-ss", String(start), "-t", String(dur), "-i", path.join(work, "raw.webm"),
  "-ss", String(MUSIC_START), "-i", MUSIC,
  "-filter_complex",
  `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v];` +
    `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOut}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]`,
  "-map", "[v]", "-map", "[a]", "-t", String(dur),
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr",
  "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "44100",
  "-movflags", "+faststart", out,
];
const r = spawnSync(ffmpeg, args, { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log("Wrote", out);
