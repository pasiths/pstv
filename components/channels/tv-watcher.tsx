"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { HlsPlayer } from "@/components/player/hls-player";
import { ChannelGrid, type ChannelCardData } from "@/components/channels/channel-grid";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ProgramGuide } from "@/components/channels/program-guide";
import { recordWatch, toggleFavorite } from "@/actions/user";
import { Search, Lock } from "lucide-react";
import { LiveChatroom } from "@/components/chat/live-chatroom";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type WatcherChannel = ChannelCardData & {
  streamUrl: string;
  isPremium?: boolean;
  locked?: boolean;
};

type CountryFacet = {
  code: string;
  name: string;
};

type LanguageFacet = {
  code: string;
  name: string;
};

type Facets = {
  countries: CountryFacet[];
  languages: LanguageFacet[];
  categories: string[];
};

type TvWatcherProps = {
  initialChannels: WatcherChannel[];
  initialTotal?: number;
  facets?: Facets;
  favoriteIds?: string[];
  recentChannels?: WatcherChannel[];
  userName?: string | null;
  hasPremium?: boolean;
  enableChat?: boolean;
  pageSize?: number;
  /** When true, use only provided channels (no /api/channels paging). */
  localCatalog?: boolean;
};

const DEFAULT_FACETS: Facets = {
  countries: [{ code: "All", name: "All countries" }],
  languages: [{ code: "All", name: "All languages" }],
  categories: ["All"],
};

const LAST_CHANNEL_KEY = "fluxtv_last_channel";

function readLastChannel(): WatcherChannel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_CHANNEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WatcherChannel>;
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.name === "string" &&
      typeof parsed?.streamUrl === "string"
    ) {
      return parsed as WatcherChannel;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

function writeLastChannel(channel: WatcherChannel) {
  try {
    window.localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(channel));
  } catch {
    // ignore quota / private mode
  }
}

export function TvWatcher({
  initialChannels,
  initialTotal,
  facets = DEFAULT_FACETS,
  favoriteIds: initialFavorites = [],
  recentChannels = [],
  userName = null,
  hasPremium = false,
  enableChat = true,
  pageSize = 72,
  localCatalog = false,
}: TvWatcherProps) {
  const [remoteChannels, setRemoteChannels] = useState(initialChannels);
  const channels = localCatalog ? initialChannels : remoteChannels;
  const [total, setTotal] = useState(initialTotal ?? initialChannels.length);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(
    !localCatalog && initialChannels.length < (initialTotal ?? initialChannels.length),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeChannel, setActiveChannel] = useState<WatcherChannel | null>(
    initialChannels[0] ?? null,
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [country, setCountry] = useState("All");
  const [language, setLanguage] = useState("All");
  const [category, setCategory] = useState("All");
  const [localOnly, setLocalOnly] = useState(false);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [pip, setPip] = useState(false);
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const userPickedRef = useRef(false);
  const restoredRef = useRef(false);

  const countryOptions = useMemo(
    () => facets.countries.map((c) => ({ value: c.code, label: c.name })),
    [facets.countries],
  );
  const languageOptions = useMemo(
    () => facets.languages.map((l) => ({ value: l.code, label: l.name })),
    [facets.languages],
  );

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = readLastChannel();
    if (!saved) return;
    userPickedRef.current = true;
    const fresh =
      initialChannels.find((c) => c.id === saved.id) ??
      recentChannels.find((c) => c.id === saved.id) ??
      saved;
    // Defer so we don't sync-set during effect render (React 19 lint).
    queueMicrotask(() => {
      setActiveChannel(fresh);
    });
  }, [initialChannels, recentChannels]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(pageSize),
        q: debouncedQuery,
        country,
        language,
        category,
        ...(localOnly ? { local: "1" } : {}),
      });
      const res = await fetch(`/api/channels?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        channels: WatcherChannel[];
        total: number;
        hasMore: boolean;
        page: number;
      };
      setTotal(data.total);
      setHasMore(data.hasMore);
      setPage(data.page);
      setRemoteChannels((prev) =>
        replace ? data.channels : [...prev, ...data.channels],
      );
      if (!userPickedRef.current) {
        setActiveChannel((current) => current ?? data.channels[0] ?? null);
      }
    },
    [pageSize, debouncedQuery, country, language, category, localOnly],
  );

  useEffect(() => {
    if (localCatalog) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingMore(true);
      void fetchPage(1, true).finally(() => {
        if (!cancelled) setLoadingMore(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, localCatalog]);

  useEffect(() => {
    if (localCatalog) return;
    const node = sentinelRef.current;
    const root = listScrollRef.current;
    if (!node || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          void fetchPage(page + 1, false).finally(() => setLoadingMore(false));
        }
      },
      { root, rootMargin: "320px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loadingMore, page, localCatalog]);

  const active = activeChannel;
  const shownTotal = localCatalog ? channels.length : total;

  useEffect(() => {
    if (!active?.id) return;
    startTransition(() => {
      void recordWatch(active.id);
    });
  }, [active?.id]);

  const onSelect = useCallback(
    (id: string, channel?: WatcherChannel) => {
      userPickedRef.current = true;
      const selected =
        channel ??
        channels.find((c) => c.id === id) ??
        recentChannels.find((c) => c.id === id) ??
        null;
      if (selected) {
        setActiveChannel(selected);
        writeLastChannel(selected);
      }
    },
    [channels, recentChannels],
  );

  const onToggleFavorite = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    startTransition(async () => {
      const res = await toggleFavorite(id);
      if (!res.success) {
        setFavorites((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
      }
    });
  }, []);

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1.05fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
      <section className="min-w-0 space-y-3 sm:space-y-4">
        {active ? (
          <>
            {active.locked ? (
              <div className="relative flex aspect-video flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-amber-400/30 bg-[#0a0f14] px-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-full border border-amber-400/35 bg-amber-500/10">
                  <Lock className="size-6 text-amber-200" />
                </div>
                <div>
                  <p className="font-heading text-lg font-semibold text-white">
                    {active.name}
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    This is a paid channel. Unlock premium to watch.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {hasPremium ? (
                    <p className="text-xs text-teal-200">
                      Premium is active — refresh if this still looks locked.
                    </p>
                  ) : (
                    <>
                      <Button asChild size="sm" className="bg-amber-600 text-white hover:bg-amber-500">
                        <Link href="/login">Sign in for premium</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/register">Create account</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : active.isBroken ? (
              <div className="relative flex aspect-video flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-red-400/25 bg-[#0a0f14] px-6 text-center">
                <p className="font-heading text-lg font-semibold text-white">
                  {active.name}
                </p>
                <p className="max-w-md text-sm text-red-100/85">
                  Not working — no live stream URL is available right now. PSTV
                  will auto-retry alternate links on the next health check.
                </p>
                {active.streamUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Allow a manual retry via remount by clearing broken flag locally.
                      setActiveChannel({ ...active, isBroken: false });
                    }}
                  >
                    Try play anyway
                  </Button>
                ) : null}
              </div>
            ) : (
              <HlsPlayer
                src={active.streamUrl}
                title={active.name}
                category={active.category}
                country={active.countryName || active.country}
                logoUrl={active.logoUrl}
                pip={pip}
                onPipToggle={() => setPip((v) => !v)}
              />
            )}
            <ProgramGuide
              key={active.id}
              channelId={active.id}
              channelName={active.name}
              category={active.category}
            />
            {enableChat && active.category === "Sports" && (
              <LiveChatroom
                key={active.id}
                channelName={active.name}
                userName={userName}
              />
            )}
          </>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-white/15 bg-card/20 text-muted-foreground">
            No channel selected
          </div>
        )}

        {recentChannels.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recently watched
            </h2>
            <div className="fluxtv-scroll flex gap-2 overflow-x-auto pb-1">
              {recentChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelect(ch.id, ch)}
                  className="shrink-0 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-left text-sm hover:border-teal-500/50"
                >
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col gap-3 sm:gap-4 lg:sticky lg:top-4 lg:h-[calc(100dvh-5.5rem)]">
        <div className="shrink-0 space-y-2.5 rounded-xl border border-border/60 bg-card/30 p-2.5 sm:space-y-3 sm:p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels…"
              className="pl-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SearchableSelect
              value={country}
              onChange={setCountry}
              options={countryOptions}
              placeholder="Country"
              searchPlaceholder="Search countries…"
            />
            <SearchableSelect
              value={language}
              onChange={setLanguage}
              options={languageOptions}
              placeholder="Language"
              searchPlaceholder="Search languages…"
            />
          </div>
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto sm:max-h-none">
            <Badge
              variant={localOnly ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setLocalOnly((v) => !v)}
            >
              Local LK
            </Badge>
            {facets.categories.slice(0, 12).map((cat) => (
              <Badge
                key={cat}
                variant={category === cat ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {channels.length.toLocaleString()} of {shownTotal.toLocaleString()}
            {pending || loadingMore ? " · loading…" : ""}
          </p>
        </div>

        <div
          ref={listScrollRef}
          className="fluxtv-scroll min-h-[58dvh] flex-1 overflow-y-auto overscroll-contain pr-1 sm:min-h-[62dvh] lg:min-h-0"
        >
          <ChannelGrid
            channels={channels}
            activeId={active?.id}
            favoriteIds={favorites}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            loadingMore={loadingMore}
          />
          <div ref={sentinelRef} className="h-8" />
        </div>
      </aside>
    </div>
  );
}
