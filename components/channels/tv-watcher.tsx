"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { HlsPlayer } from "@/components/player/hls-player";
import { ChannelGrid, type ChannelCardData } from "@/components/channels/channel-grid";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { recordWatch, toggleFavorite } from "@/actions/user";
import { Search } from "lucide-react";
import { LiveChatroom } from "@/components/chat/live-chatroom";

export type WatcherChannel = ChannelCardData & {
  streamUrl: string;
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
  epgTitle?: string | null;
  epgNext?: string | null;
  userName?: string | null;
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

export function TvWatcher({
  initialChannels,
  initialTotal,
  facets = DEFAULT_FACETS,
  favoriteIds: initialFavorites = [],
  recentChannels = [],
  epgTitle,
  epgNext,
  userName = null,
  enableChat = true,
  pageSize = 48,
  localCatalog = false,
}: TvWatcherProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [total, setTotal] = useState(initialTotal ?? initialChannels.length);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(
    !localCatalog && initialChannels.length < (initialTotal ?? initialChannels.length),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeId, setActiveId] = useState(initialChannels[0]?.id ?? null);
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
  const userPickedRef = useRef(false);

  const countryOptions = useMemo(
    () => facets.countries.map((c) => ({ value: c.code, label: c.name })),
    [facets.countries],
  );
  const languageOptions = useMemo(
    () => facets.languages.map((l) => ({ value: l.code, label: l.name })),
    [facets.languages],
  );

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
      setChannels((prev) => (replace ? data.channels : [...prev, ...data.channels]));
      if (!userPickedRef.current) {
        setActiveChannel((current) => {
          if (current) return current;
          const first = data.channels[0] ?? null;
          if (first) setActiveId(first.id);
          return first;
        });
      }
    },
    [pageSize, debouncedQuery, country, language, category, localOnly],
  );

  useEffect(() => {
    if (localCatalog) {
      setChannels(initialChannels);
      setTotal(initialChannels.length);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    setLoadingMore(true);
    void fetchPage(1, true).finally(() => {
      if (!cancelled) setLoadingMore(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, localCatalog, initialChannels]);

  useEffect(() => {
    if (localCatalog) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          void fetchPage(page + 1, false).finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loadingMore, page, localCatalog]);

  const active = activeChannel;

  useEffect(() => {
    if (!active?.id) return;
    startTransition(() => {
      void recordWatch(active.id);
    });
  }, [active?.id]);

  const onSelect = useCallback(
    (id: string, channel?: WatcherChannel) => {
      userPickedRef.current = true;
      setActiveId(id);
      const selected =
        channel ??
        channels.find((c) => c.id === id) ??
        recentChannels.find((c) => c.id === id) ??
        null;
      if (selected) setActiveChannel(selected);
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <section className="space-y-4">
        {active ? (
          <>
            <HlsPlayer
              src={active.streamUrl}
              title={active.name}
              category={active.category}
              country={active.countryName || active.country}
              logoUrl={active.logoUrl}
              pip={pip}
              onPipToggle={() => setPip((v) => !v)}
            />
            {(epgTitle || epgNext) && (
              <div className="rounded-xl border border-border/60 bg-card/50 p-4 text-sm">
                {epgTitle && (
                  <p>
                    <span className="text-muted-foreground">Now: </span>
                    {epgTitle}
                  </p>
                )}
                {epgNext && (
                  <p className="mt-1">
                    <span className="text-muted-foreground">Next: </span>
                    {epgNext}
                  </p>
                )}
              </div>
            )}
            {enableChat && active.category === "Sports" && (
              <LiveChatroom channelName={active.name} userName={userName} />
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
            <div className="flex gap-2 overflow-x-auto pb-1">
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

      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-3">
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
          <div className="flex flex-wrap gap-1.5">
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
            Showing {channels.length} of {total.toLocaleString()}
            {pending || loadingMore ? " · loading…" : ""}
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <ChannelGrid
            channels={channels}
            activeId={active?.id}
            favoriteIds={favorites}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            loadingMore={loadingMore}
          />
          <div ref={sentinelRef} className="h-4" />
        </div>
      </aside>
    </div>
  );
}
