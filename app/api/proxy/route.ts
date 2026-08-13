import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

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

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FluxTV/1.0; +https://localhost)",
        Accept: "*/*",
        ...(request.headers.get("range")
          ? { Range: request.headers.get("range")! }
          : {}),
      },
      cache: "no-store",
      redirect: "follow",
    });

    const contentType = upstream.headers.get("content-type") || "";
    const body = Buffer.from(await upstream.arrayBuffer());

    // Rewrite absolute/relative playlist URLs so segment requests also go through proxy
    if (
      contentType.includes("mpegurl") ||
      contentType.includes("m3u8") ||
      parsed.pathname.endsWith(".m3u8") ||
      body.subarray(0, 7).toString().includes("#EXTM3U")
    ) {
      const text = body.toString("utf8");
      const base = parsed;
      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) {
            if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
              return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
                const abs = new URL(uri, base).toString();
                return `URI="/api/proxy?url=${encodeURIComponent(abs)}"`;
              });
            }
            return line;
          }
          const abs = new URL(trimmed, base).toString();
          return `/api/proxy?url=${encodeURIComponent(abs)}`;
        })
        .join("\n");

      return new NextResponse(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "no-store");
    if (contentType) headers.set("Content-Type", contentType);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

    return new NextResponse(body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("[proxy]", error);
    return NextResponse.json({ error: "Proxy fetch failed" }, { status: 502 });
  }
}
