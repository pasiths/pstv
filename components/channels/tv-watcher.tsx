"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { HlsPlayer } from "@/components/player/hls-player";
import { ChannelGrid, type ChannelCardData } from "@/components/channels/channel-grid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { recordWatch, toggleFavorite } from "@/actions/user";
import { PictureInPicture2, Search } from "lucide-react";
import { LiveChatroom } from "@/components/chat/live-chatroom";

export type WatcherChannel = ChannelCardData & {
  streamUrl: string;
};

type TvWatcherProps = {
  channels: WatcherChannel[];
  favoriteIds?: string[];
  recentChannels?: WatcherChannel[];
  epgTitle?: string | null;
  epgNext?: string | null;
  enableFilters?: boolean;
  pageSize?: number;
  userName?: string | null;
  enableChat?: boolean;
};

const CATEGORIES = [
  "All",
  "General",
  "News",
  "Sports",
  "Entertainment",
  "Kids",
];

export function TvWatcher({
  channels,
  favoriteIds: initialFavorites = [],
  recentChannels = [],
  epgTitle,
  epgNext,
  enableFilters = true,
  pageSize = 24,
  userName = null,
  enableChat = true,
}: TvWatcherProps) {
  const [activeId, setActiveId] = useState(channels[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All");
  const [language, setLanguage] = useState("All");
  const [category, setCategory] = useState("All");
  const [visible, setVisible] = useState(pageSize);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [pip, setPip] = useState(false);
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const countries = useMemo(
    () => ["All", ...Array.from(new Set(channels.map((c) => c.country))).sort()],
    [channels],
  );
  const languages = useMemo(
    () =>
      [
        "All",
        ...Array.from(
          new Set(channels.map((c) => c.language).filter(Boolean) as string[]),
        ).sort(),
      ],
    [channels],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (country !== "All" && c.country !== country) return false;
      if (language !== "All" && c.language !== language) return false;
      if (category !== "All" && c.category !== category) return false;
      return true;
    });
  }, [channels, query, country, language, category]);

  const visibleChannels = filtered.slice(0, visible);
  const active = channels.find((c) => c.id === activeId) ?? filtered[0] ?? null;

  useEffect(() => {
    setVisible(pageSize);
  }, [query, country, language, category, pageSize]);

  useEffect(() => {
    if (!active?.id) return;
    startTransition(() => {
      void recordWatch(active.id);
    });
  }, [active?.id]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => Math.min(v + pageSize, filtered.length));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length, pageSize]);

  const onSelect = useCallback((id: string) => setActiveId(id), []);

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight">
                  {active.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {active.category}
                  {active.country ? ` · ${active.country}` : ""}
                  {active.language ? ` · ${active.language}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant={pip ? "default" : "outline"}
                size="sm"
                onClick={() => setPip((v) => !v)}
              >
                <PictureInPicture2 className="size-4" />
                PiP
              </Button>
            </div>
            <HlsPlayer src={active.streamUrl} title={active.name} pip={pip} />
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
          <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed text-muted-foreground">
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
                  onClick={() => setActiveId(ch.id)}
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
        {enableFilters && (
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
              <select
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "All countries" : c}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l === "All" ? "All languages" : l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
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
              Showing {visibleChannels.length} of {filtered.length}
              {pending ? " · syncing…" : ""}
            </p>
          </div>
        )}

        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <ChannelGrid
            channels={visibleChannels}
            activeId={active?.id}
            favoriteIds={favorites}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            loadingMore={visible < filtered.length}
          />
          <div ref={sentinelRef} className="h-4" />
        </div>
      </aside>
    </div>
  );
}
