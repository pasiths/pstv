"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Heart, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChannelCardData = {
  id: string;
  name: string;
  logoUrl: string | null;
  category: string;
  country: string;
  countryName?: string | null;
  language: string | null;
  isLocal: boolean;
  isBroken?: boolean;
};

type ChannelGridProps = {
  channels: ChannelCardData[];
  activeId?: string | null;
  favoriteIds?: string[];
  onSelect: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  loadingMore?: boolean;
};

export function ChannelGrid({
  channels,
  activeId,
  favoriteIds = [],
  onSelect,
  onToggleFavorite,
  loadingMore,
}: ChannelGridProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {channels.map((channel) => {
          const active = channel.id === activeId;
          const favorited = favoriteIds.includes(channel.id);
          return (
            <div
              key={channel.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(channel.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(channel.id);
                }
              }}
              className={cn(
                "group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
                active
                  ? "border-teal-500/80 bg-teal-500/10 ring-1 ring-teal-500/40"
                  : "border-border/60 bg-card/40 hover:border-teal-500/40 hover:bg-muted/40",
              )}
            >
              <div className="flex w-full items-start gap-2">
                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {channel.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={channel.logoUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Radio className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{channel.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {channel.category}
                    {channel.countryName || channel.country
                      ? ` · ${channel.countryName || channel.country}`
                      : ""}
                  </p>
                </div>
                {onToggleFavorite && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(channel.id);
                    }}
                  >
                    <Heart
                      className={cn(
                        "size-3.5",
                        favorited && "fill-rose-500 text-rose-500",
                      )}
                    />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {channel.isLocal && (
                  <Badge variant="secondary" className="text-[10px]">
                    Local
                  </Badge>
                )}
                {active && (
                  <Badge className="bg-teal-600 text-[10px] text-white hover:bg-teal-600">
                    Live
                  </Badge>
                )}
                {channel.isBroken && (
                  <Badge variant="destructive" className="text-[10px]">
                    Broken
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {loadingMore && (
        <p className="text-center text-xs text-muted-foreground">Loading more…</p>
      )}
      {channels.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No channels match your filters.
        </p>
      )}
    </div>
  );
}
