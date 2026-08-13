import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function rewritePlaylist(text: string, base: URL, origin: string, referer?: string | null) {
  const refParam = referer ? `&referer=${encodeURIComponent(referer)}` : "";
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        if (
          trimmed.startsWith("#EXT-X-KEY") ||
          trimmed.startsWith("#EXT-X-MAP") ||
          trimmed.startsWith("#EXT-X-MEDIA")
        ) {
          return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
            const abs = new URL(uri, base).toString();
            return `URI="${origin}/api/proxy?url=${encodeURIComponent(abs)}${refParam}"`;
          });
        }
        return line;
      }

      const abs = new URL(trimmed, base).toString();
      return `${origin}/api/proxy?url=${encodeURIComponent(abs)}${refParam}`;
    })
    .join("\n");
}

function looksLikePlaylist(contentType: string, pathname: string, url: string) {
  const lower = `${pathname} ${url}`.toLowerCase();
  return (
    contentType.includes("mpegurl") ||
    contentType.includes("m3u8") ||
    contentType.includes("text/plain") ||
    lower.includes(".m3u8") ||
    lower.includes("playlist") ||
    lower.includes("index.m3u") ||
    lower.includes("master.m3u")
  );
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return NextResponse.json({ error: "Protocol not allowed" }, { status: 400 });
  }

  const referer =
    request.nextUrl.searchParams.get("referer") || `${parsed.origin}/`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: referer,
        Origin: parsed.origin,
        ...(request.headers.get("range")
          ? { Range: request.headers.get("range")! }
          : {}),
      },
      cache: "no-store",
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    const origin = request.nextUrl.origin;
    const maybePlaylist = looksLikePlaylist(
      contentType,
      parsed.pathname,
      parsed.toString(),
    );

    if (maybePlaylist) {
      const text = await upstream.text();
      if (text.includes("#EXTM3U") || text.trimStart().startsWith("#EXT")) {
        const rewritten = rewritePlaylist(text, parsed, origin, referer);
        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-store",
          },
        });
      }

      // Not a playlist after all — return as binary/text payload
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          "Content-Type": contentType || "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Cache-Control", "no-store");
    if (contentType) headers.set("Content-Type", contentType);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("[proxy]", error);
    return NextResponse.json({ error: "Proxy fetch failed" }, { status: 502 });
  }
}
