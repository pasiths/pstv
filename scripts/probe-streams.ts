import { prisma } from "../lib/prisma";

async function probe(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: new URL(url).origin + "/",
      },
      redirect: "follow",
    });
    const text = await res.text();
    const isPlaylist = text.includes("#EXTM3U");
    const hasDrm =
      /EXT-X-KEY|drm|widevine|fairplay|playready/i.test(text) ||
      /drm/i.test(url);
    return {
      ok: res.ok,
      status: res.status,
      isPlaylist,
      hasDrm,
      sample: text.slice(0, 120).replace(/\s+/g, " "),
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      isPlaylist: false,
      hasDrm: /drm/i.test(url),
      error: e instanceof Error ? e.message : "fail",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const channels = await prisma.channel.findMany({
    where: { isHidden: false },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`Probing ${channels.length} channels...\n`);
  const working: string[] = [];
  const broken: string[] = [];

  for (const ch of channels) {
    const result = await probe(ch.streamUrl);
    const label = result.ok && result.isPlaylist && !result.hasDrm ? "OK" : "FAIL";
    if (label === "OK") working.push(ch.id);
    else broken.push(ch.id);
    console.log(
      `[${label}] ${ch.name} | status=${result.status} playlist=${result.isPlaylist} drm=${result.hasDrm} ${result.error ?? ""}`,
    );
  }

  if (broken.length) {
    await prisma.channel.updateMany({
      where: { id: { in: broken } },
      data: { isBroken: true },
    });
  }
  if (working.length) {
    await prisma.channel.updateMany({
      where: { id: { in: working } },
      data: { isBroken: false },
    });
  }

  // Ensure at least one always-working demo if all fail
  if (working.length === 0) {
    console.log("\nNo working LK streams. Adding reliable public demo channel...");
    await prisma.channel.create({
      data: {
        name: "FluxTV Demo (Mux)",
        slug: "fluxtv-demo-mux",
        streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        logoUrl:
          "https://api.dicebear.com/7.x/initials/svg?seed=Demo&backgroundColor=0f766e",
        country: "XX",
        countryName: "Demo",
        category: "General",
        isLocal: false,
        isBroken: false,
        externalId: "demo:mux-test",
        sortOrder: -1,
      },
    });
  }

  console.log(`\nWorking: ${working.length} | Broken/DRM: ${broken.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
