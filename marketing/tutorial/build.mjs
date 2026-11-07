// Turns the recorded tutorial into an MP4 with background music.
// Usage: node marketing/tutorial/build.mjs --format landscape|vertical
// Music is read in place from the owner's music folder; never copied into the repo.
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORMAT = process.argv.includes("vertical") ? "vertical" : "landscape";
const MUSIC = "F:/Files/Music/My Music/song_exports/lofi_seville.mp3";
const SIZE = FORMAT === "vertical" ? [1080, 1920] : [1920, 1080];

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, ".work", FORMAT);
const out = path.resolve(here, `../../media/video/synergy-wizard-howto-${FORMAT}.mp4`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const timings = JSON.parse(fs.readFileSync(path.join(work, "timings.json"), "utf8"));

const start = Math.max(0, timings.videoOffset - 0.1);
const dur = timings.total + 0.2;
const [w, h] = SIZE;
const r = spawnSync(
  ffmpeg,
  [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", String(start), "-t", String(dur), "-i", path.join(work, "raw.webm"),
    "-i", MUSIC,
    "-filter_complex",
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v];` +
      `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, dur - 2.5)}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[a]`,
    "-map", "[v]", "-map", "[a]", "-t", String(dur),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-movflags", "+faststart", out,
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`Wrote ${out} (${dur.toFixed(1)} s)`);
