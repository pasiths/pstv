import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

type Provider = {
  name: string;
  url: string;
  apiKey: string;
  model: string;
};

function resolveProvider(): Provider | null {
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      name: "openai",
      url: "https://api.openai.com/v1/audio/translations",
      apiKey: openai,
      model: process.env.OPENAI_WHISPER_MODEL?.trim() || "whisper-1",
    };
  }

  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq) {
    return {
      name: "groq",
      url: "https://api.groq.com/openai/v1/audio/translations",
      apiKey: groq,
      model: process.env.GROQ_WHISPER_MODEL?.trim() || "whisper-large-v3",
    };
  }

  return null;
}

/** Translate speech audio (any language) → English text via Whisper translations API. */
export async function POST(request: NextRequest) {
  const provider = resolveProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error:
          "Auto English captions need OPENAI_API_KEY or GROQ_API_KEY in .env",
        configured: false,
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("audio");
  if (typeof file !== "object" || file === null || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const blob = file as Blob;
  if (blob.size < 1200) {
    return NextResponse.json({ text: "", skipped: true });
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio chunk too large" }, { status: 413 });
  }

  const filename =
    ("name" in blob && typeof (blob as File).name === "string" && (blob as File).name) ||
    `chunk.${guessExt(blob.type || "audio/webm")}`;

  const outbound = new FormData();
  outbound.append("file", blob, filename);
  outbound.append("model", provider.model);
  outbound.append("response_format", "json");

  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      body: outbound,
      cache: "no-store",
    });

    const payload = (await res.json().catch(() => null)) as {
      text?: string;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            payload?.error?.message ||
            `Caption provider failed (${provider.name})`,
        },
        { status: 502 },
      );
    }

    const text = (payload?.text || "").replace(/\s+/g, " ").trim();
    return NextResponse.json({ text, provider: provider.name });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Caption request failed",
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  const provider = resolveProvider();
  return NextResponse.json({
    configured: Boolean(provider),
    provider: provider?.name ?? null,
  });
}

function guessExt(mime: string) {
  if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}
