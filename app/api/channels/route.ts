import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCountryLongName } from "@/lib/iptv-catalog";
import { getLanguageLongName } from "@/lib/languages";
import { getCurrentUser } from "@/lib/session";
import { canAccessPremium, mapPublicChannel } from "@/lib/premium";
import { withPsDemoFirst } from "@/lib/ps-demo";
import { PS_DEMO_CHANNEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") || "").trim();
  const country = searchParams.get("country") || "All";
  const language = searchParams.get("language") || "All";
  const category = searchParams.get("category") || "All";
  const access = (searchParams.get("access") || "All").toLowerCase();
  const localOnly = searchParams.get("local") === "1";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(12, Number(searchParams.get("limit") || 48)));
  const skip = (page - 1) * limit;

  const user = await getCurrentUser();
  const entitled = canAccessPremium(user);

  const where = {
    isHidden: false,
    ...(localOnly ? { isLocal: true } : {}),
    ...(country !== "All" ? { country } : {}),
    ...(language !== "All" ? { language } : {}),
    ...(category !== "All" && category !== "Free" && category !== "Paid"
      ? { category }
      : {}),
    ...(access === "free" || category === "Free" ? { isPremium: false } : {}),
    ...(access === "paid" || category === "Paid" ? { isPremium: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { countryName: { contains: q, mode: "insensitive" as const } },
            { language: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows, countries, languages, categories] =
    page === 1
      ? await Promise.all([
          prisma.channel.count({ where }),
          prisma.channel.findMany({
            where,
            orderBy: [
              { isLocal: "desc" },
              { isBroken: "asc" },
              { isPremium: "asc" },
              { sortOrder: "asc" },
              { name: "asc" },
            ],
            skip,
            take: limit,
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              category: true,
              country: true,
              countryName: true,
              language: true,
              isLocal: true,
              isPremium: true,
              isBroken: true,
              streamUrl: true,
            },
          }),
          prisma.channel.findMany({
            where: { isHidden: false },
            distinct: ["country"],
            select: { country: true },
            orderBy: { country: "asc" },
            take: 300,
          }),
          prisma.channel.findMany({
            where: { isHidden: false, language: { not: null } },
            distinct: ["language"],
            select: { language: true },
            orderBy: { language: "asc" },
            take: 200,
          }),
          prisma.channel.findMany({
            where: { isHidden: false },
            distinct: ["category"],
            select: { category: true },
            orderBy: { category: "asc" },
            take: 100,
          }),
        ])
      : await Promise.all([
          prisma.channel.count({ where }),
          prisma.channel.findMany({
            where,
            orderBy: [
              { isLocal: "desc" },
              { isBroken: "asc" },
              { isPremium: "asc" },
              { sortOrder: "asc" },
              { name: "asc" },
            ],
            skip,
            take: limit,
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              category: true,
              country: true,
              countryName: true,
              language: true,
              isLocal: true,
              isPremium: true,
              isBroken: true,
              streamUrl: true,
            },
          }),
          Promise.resolve([] as { country: string }[]),
          Promise.resolve([] as { language: string | null }[]),
          Promise.resolve([] as { category: string }[]),
        ]);

  const countryFacets = countries
    .filter((c) => c.country)
    .map((c) => ({
      code: c.country,
      name: getCountryLongName(c.country),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const languageFacets = languages
    .map((l) => l.language)
    .filter((v): v is string => Boolean(v))
    .map((code) => ({
      code,
      name: getLanguageLongName(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let channels = rows.map((row) =>
    mapPublicChannel(
      {
        ...row,
        countryName: getCountryLongName(row.country),
      },
      entitled,
    ),
  );

  // Keep PS Demo TV first on the default browse page (public + signed-in).
  const showDemo =
    page === 1 &&
    !q &&
    country === "All" &&
    language === "All" &&
    category !== "Paid" &&
    access !== "paid" &&
    !localOnly;
  if (showDemo) {
    channels = withPsDemoFirst(channels);
  } else {
    channels = channels.filter(
      (c) =>
        c.streamUrl !== PS_DEMO_CHANNEL.streamUrl &&
        (c as { slug?: string }).slug !== PS_DEMO_CHANNEL.slug &&
        c.name !== PS_DEMO_CHANNEL.name,
    );
  }

  return NextResponse.json({
    total: showDemo ? Math.max(total, 1) : total,
    page,
    limit,
    hasMore: skip + rows.length < total,
    entitled,
    channels,
    facets: {
      countries: [{ code: "All", name: "All countries" }, ...countryFacets],
      languages: [{ code: "All", name: "All languages" }, ...languageFacets],
      categories: [
        "All",
        "Free",
        "Paid",
        ...categories.map((c) => c.category).filter(Boolean),
      ],
    },
  });
}
