/**
 * Generates a polished animated PS Demo TV intro (education-only, no admin/dev).
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

const FONT_BOLD = "C\\:/Windows/Fonts/segoeuib.ttf";
const FONT = "C\\:/Windows/Fonts/segoeui.ttf";
const FPS = 30;
const XFADE = 0.55;

type Slide = {
  eyebrow?: string;
  title: string;
  lines: string[];
  seconds: number;
  accent: string;
};

/** Strong first-impression slides — viewer only, no admin/developer detail */
const SLIDES: Slide[] = [
  {
    eyebrow: "EDUCATION-ONLY",
    title: "PSTV",
    lines: ["Your live TV lab in the browser", "Simple. Fast. Installable."],
    seconds: 4.5,
    accent: "0x14b8a6",
  },
  {
    eyebrow: "WHAT YOU GET",
    title: "Watch live channels",
    lines: [
      "Browse a curated channel list",
      "Tap once — playback starts instantly",
      "Works on phone, tablet, and desktop",
    ],
    seconds: 5.2,
    accent: "0x2dd4bf",
  },
  {
    eyebrow: "HOW TO USE",
    title: "Pick. Play. Enjoy.",
    lines: [
      "Choose any channel from the list",
      "Control volume, quality, and fullscreen",
      "Picture-in-picture when you need it",
    ],
    seconds: 5.4,
    accent: "0x5eead4",
  },
  {
    eyebrow: "FIND FAST",
    title: "Search and filter",
    lines: [
      "Search by channel name",
      "Filter by country, language, or category",
      "Free and paid views when you explore",
    ],
    seconds: 5.2,
    accent: "0x14b8a6",
  },
  {
    eyebrow: "YOUR ACCOUNT",
    title: "Optional sign-in",
    lines: [
      "Public visitors can watch free channels",
      "Sign in to save favorites and history",
      "Sync across your devices",
    ],
    seconds: 5.2,
    accent: "0x2dd4bf",
  },
  {
    eyebrow: "INSTALL",
    title: "Use it like an app",
    lines: [
      "Add PSTV to your Home Screen or desktop",
      "iPhone, Android, Windows — PWA ready",
      "One tap back to live TV anytime",
    ],
    seconds: 5.2,
    accent: "0x5eead4",
  },
  {
    eyebrow: "RESPECT",
    title: "Thanks to every channel",
    lines: [
      "Copyright and credit stay with owners",
      "Streams may change — education use only",
      "We appreciate the broadcasters you watch",
    ],
    seconds: 5.0,
    accent: "0x14b8a6",
  },
  {
    eyebrow: "PS DEMO TV",
    title: "You are ready",
    lines: [
      "Pick your next channel and start watching",
      "Education-only — enjoy PSTV",
    ],
    seconds: 4.8,
    accent: "0x2dd4bf",
  },
];

function esc(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "");
}

function buildSlideVf(slide: Slide): string {
  const fadeOutStart = Math.max(0.2, slide.seconds - XFADE - 0.05);
  const parts: string[] = [
    // Soft teal glow orb (animated position via sin)
    `geq=lum='lum(X\\,Y)':cb='128+18*sin(2*PI*(T*0.08+X/1280))':cr='128-12*sin(2*PI*(T*0.06+Y/720))'`,
    // Dark vignette-ish panels
    `drawbox=x=0:y=0:w=iw:h=ih:color=0x0b0f14@0.35:t=fill`,
    // Top accent bar that "grows in"
    `drawbox=x=80:y=96:w='min(iw-160\\, (t/0.55)* (iw-160))':h=4:color=${slide.accent}@0.95:t=fill`,
    // Bottom teal rule
    `drawbox=x=80:y=ih-110:w=iw-160:h=2:color=${slide.accent}@0.55:t=fill`,
  ];

  if (slide.eyebrow) {
    parts.push(
      `drawtext=fontfile=${FONT}:fontsize=22:fontcolor=${slide.accent}:x=90:y=120:alpha='if(lt(t\\,0.25)\\,0\\,min(1\\,(t-0.25)/0.35))':text='${esc(slide.eyebrow)}'`,
    );
  }

  const titleSize = slide.title === "PSTV" ? 96 : 54;
  parts.push(
    `drawtext=fontfile=${FONT_BOLD}:fontsize=${titleSize}:fontcolor=white:x=90:y=165:alpha='if(lt(t\\,0.35)\\,0\\,min(1\\,(t-0.35)/0.4))':text='${esc(slide.title)}'`,
  );

  slide.lines.forEach((line, i) => {
    const delay = 0.55 + i * 0.22;
    parts.push(
      `drawtext=fontfile=${FONT}:fontsize=30:fontcolor=0xe2e8f0:x=90:y=${250 + i * 52}:alpha='if(lt(t\\,${delay})\\,0\\,min(1\\,(t-${delay})/0.35))':text='${esc(line)}'`,
    );
  });

  parts.push(
    `drawtext=fontfile=${FONT}:fontsize=18:fontcolor=0x94a3b8:x=90:y=h-78:alpha='if(lt(t\\,0.8)\\,0\\,min(1\\,(t-0.8)/0.4))':text='${esc("PSTV  ·  Education-only  ·  tv.pasiths.tech")}'`,
  );

  // Fade in / out for smoother xfade joins
  parts.push(`fade=t=in:st=0:d=0.35`);
  parts.push(`fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${XFADE}`);

  return parts.join(",");
}

function main() {
  const bin = ffmpegPath;
  if (!bin) throw new Error("ffmpeg-static binary not found");

  mkdirSync(outDir, { recursive: true });
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  console.log("Generating professional animated PS Demo TV video...");

  const segmentNames: string[] = [];
  SLIDES.forEach((slide, index) => {
    const segmentName = `seg-${index}.mp4`;
    segmentNames.push(segmentName);
    console.log(`  slide ${index + 1}/${SLIDES.length}: ${slide.title}`);
    execFileSync(
      bin,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=0x0b1220:s=1280x720:d=${slide.seconds}:r=${FPS}`,
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${220 + index * 18}:sample_rate=44100:duration=${slide.seconds}`,
        "-vf",
        buildSlideVf(slide),
        "-af",
        `volume=0.045,afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0.2, slide.seconds - 0.6)}:d=0.55`,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
        "-movflags",
        "+faststart",
        segmentName,
      ],
      { stdio: "inherit", cwd: workDir },
    );
  });

  // Crossfade chain between slides for a polished first impression
  const inputs = segmentNames.flatMap((name) => ["-i", name]);
  let filter = "";
  let lastLabel = "[0:v]";
  let lastAudio = "[0:a]";
  let offset = SLIDES[0].seconds - XFADE;

  for (let i = 1; i < SLIDES.length; i += 1) {
    const vOut = i === SLIDES.length - 1 ? "[vout]" : `[v${i}]`;
    const aOut = i === SLIDES.length - 1 ? "[aout]" : `[a${i}]`;
    filter += `${lastLabel}[${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}${vOut};`;
    filter += `${lastAudio}[${i}:a]acrossfade=d=${XFADE}${aOut};`;
    lastLabel = vOut;
    lastAudio = aOut;
    if (i < SLIDES.length - 1) {
      offset += SLIDES[i].seconds - XFADE;
    }
  }

  console.log("  stitching crossfades...");
  execFileSync(
    bin,
    [
      "-y",
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
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
