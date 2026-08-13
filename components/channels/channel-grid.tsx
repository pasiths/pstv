"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Heart, Lock, Radio } from "lucide-react";
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
  isPremium?: boolean;
  locked?: boolean;
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
    <div className="space-y-2 sm:space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {channels.map((channel) => {
          const active = channel.id === activeId;
          const favorited = favoriteIds.includes(channel.id);
          const locked = Boolean(channel.locked);
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
                "group relative flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border p-2 text-left transition-all sm:gap-2 sm:rounded-xl sm:p-2.5",
                active
                  ? "border-teal-500/80 bg-teal-500/10 ring-1 ring-teal-500/40"
                  : "border-border/60 bg-card/40 hover:border-teal-500/40 hover:bg-muted/40",
                locked && "opacity-95",
              )}
            >
              <div className="flex w-full items-start gap-1.5 sm:gap-2">
                <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted sm:size-9 sm:rounded-lg">
                  {channel.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={channel.logoUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Radio className="size-3.5 text-muted-foreground" />
                    </div>
                  )}
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                      <Lock className="size-3.5 text-amber-200" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-medium leading-snug text-pretty sm:text-sm"
                    title={channel.name}
                    style={{
                      overflowWrap: "break-word",
                      wordBreak: "normal",
                    }}
                  >
                    {channel.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
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
                    className="size-7 shrink-0 sm:size-8"
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
                  <Badge variant="secondary" className="px-1.5 py-0 text-[9px] sm:text-[10px]">
                    Local
                  </Badge>
                )}
                {channel.isPremium ? (
                  <Badge className="bg-amber-600/90 px-1.5 py-0 text-[9px] text-white hover:bg-amber-600/90 sm:text-[10px]">
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="outline" className="px-1.5 py-0 text-[9px] sm:text-[10px]">
                    Free
                  </Badge>
                )}
                {active && !locked && (
                  <Badge className="bg-teal-600 px-1.5 py-0 text-[9px] text-white hover:bg-teal-600 sm:text-[10px]">
                    Live
                  </Badge>
                )}
                {locked && (
                  <Badge
                    variant="outline"
                    className="border-amber-400/40 px-1.5 py-0 text-[9px] text-amber-200 sm:text-[10px]"
                  >
                    Locked
                  </Badge>
                )}
                {channel.isBroken && (
                  <Badge variant="destructive" className="px-1.5 py-0 text-[9px] sm:text-[10px]">
                    Not working
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
