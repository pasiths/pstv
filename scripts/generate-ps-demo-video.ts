/**
 * Generates public/videos/ps-demo-tv.mp4 — education-only intro (no admin/dev detail).
 * Usage: npx tsx scripts/generate-ps-demo-video.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, renameSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "videos");
const workDir = join(outDir, "_ps-demo-work");
const font = "C\\:/Windows/Fonts/arial.ttf";

type Slide = { title: string; lines: string[]; seconds: number };

/** Viewer-facing only — no admin / developer walkthrough */
const SLIDES: Slide[] = [
  {
    title: "Welcome to PSTV",
    lines: ["Education-only live TV lab", "Watch channels in your browser"],
    seconds: 5,
  },
  {
    title: "What is PSTV?",
    lines: [
      "A simple place to try live TV streams",
      "Built for learning how web TV apps work",
      "Education-only - not a commercial service",
    ],
    seconds: 6,
  },
  {
    title: "How to watch",
    lines: [
      "1. Pick a channel from the list on the right",
      "2. The player starts on the left",
      "3. Use play, volume, fullscreen, and quality",
    ],
    seconds: 7,
  },
  {
    title: "Find channels",
    lines: [
      "Search by name",
      "Filter by country, language, or category",
      "Try Free / Paid filters when you explore",
    ],
    seconds: 6,
  },
  {
    title: "Free and paid",
    lines: [
      "Many channels are free to watch",
      "Some paid channels need a signed-in account",
      "You can still browse everything either way",
    ],
    seconds: 6,
  },
  {
    title: "Sign in - optional",
    lines: [
      "Create a free account to sync favorites",
      "Keep your watch history across devices",
      "Public visitors can still watch free channels",
    ],
    seconds: 6,
  },
  {
    title: "Install the app",
    lines: [
      "Add PSTV to your phone or Windows as a PWA",
      "Phone: browser menu or Share - Add to Home Screen",
      "Desktop: Install app when the browser offers it",
    ],
    seconds: 6,
  },
  {
    title: "Thanks to the channels",
    lines: [
      "Thank you to every channel shown here",
      "Copyright and credit stay with their owners",
      "Availability can change - education-only use",
    ],
    seconds: 6,
  },
  {
    title: "You are ready",
    lines: [
      "This is PS Demo TV - your quick start guide",
      "Pick any channel next and start watching",
      "Education-only - Enjoy PSTV",
    ],
    seconds: 6,
  },
];

function esc(text: string): string {
  // Keep ASCII; escape drawtext specials.
  return text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "");
}

function buildVf(slide: Slide): string {
  const parts: string[] = [
    `drawtext=fontfile=${font}:fontsize=52:fontcolor=white:x=(w-text_w)/2:y=h*0.28:borderw=2:bordercolor=black:text='${esc(slide.title)}'`,
  ];
  slide.lines.forEach((line, i) => {
    parts.push(
      `drawtext=fontfile=${font}:fontsize=28:fontcolor=0xd1d5db:x=(w-text_w)/2:y=h*0.42+${i * 48}:text='${esc(line)}'`,
    );
  });
  parts.push(
    `drawtext=fontfile=${font}:fontsize=20:fontcolor=0x14b8a6:x=(w-text_w)/2:y=h*0.88:text='${esc("PSTV - Education-only")}'`,
  );
  return parts.join(",");
}

function main() {
  const bin = ffmpegPath;
  if (!bin) {
    throw new Error("ffmpeg-static binary not found");
  }

  mkdirSync(outDir, { recursive: true });
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  const segmentNames: string[] = [];
  console.log("Generating PS Demo TV intro video...");

  SLIDES.forEach((slide, index) => {
    const segmentName = `seg-${index}.mp4`;
    segmentNames.push(segmentName);
    execFileSync(
      bin,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=0x0b0f14:s=1280x720:d=${slide.seconds}`,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-vf",
        buildVf(slide),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        "-movflags",
        "+faststart",
        segmentName,
      ],
      { stdio: "inherit", cwd: workDir },
    );
  });

  writeFileSync(
    join(workDir, "concat.txt"),
    segmentNames.map((name) => `file '${name}'`).join("\n"),
    "utf8",
  );

  execFileSync(
    bin,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "concat.txt",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "ps-demo-tv.mp4",
    ],
    { stdio: "inherit", cwd: workDir },
  );

  const output = join(outDir, "ps-demo-tv.mp4");
  if (existsSync(output)) rmSync(output, { force: true });
  renameSync(join(workDir, "ps-demo-tv.mp4"), output);
  rmSync(workDir, { recursive: true, force: true });
  console.log(`Wrote ${output}`);
}

main();
