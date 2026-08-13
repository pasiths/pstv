import { NextRequest, NextResponse } from "next/server";
import { resolveRealProgrammes } from "@/lib/epg-resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  try {
    const result = await resolveRealProgrammes(channelId);
    return NextResponse.json({
      channelId,
      channelName: result.channelName,
      category: result.category,
      generated: false,
      source: result.source,
      programs: result.programs,
      real: result.programs.length > 0,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load programme guide",
        programs: [],
        real: false,
        source: "none",
      },
      { status: 500 },
    );
  }
}
