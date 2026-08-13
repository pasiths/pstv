"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { findNowIndex, type ProgramSlot } from "@/lib/epg";

type ProgramGuideProps = {
  channelId: string;
  channelName: string;
  category?: string;
};

export function ProgramGuide({ channelId, channelName }: ProgramGuideProps) {
  const [programs, setPrograms] = useState<ProgramSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"database" | "live" | "none" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPrograms([]);
    setSource(null);
    setExpanded(false);

    fetch(`/api/epg?channelId=${encodeURIComponent(channelId)}`)
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as {
          programs?: ProgramSlot[];
          source?: "database" | "live" | "none";
        };
      })
      .then((data) => {
        if (cancelled) return;
        setPrograms(data?.programs?.length ? data.programs : []);
        setSource(data?.source ?? "none");
      })
      .catch(() => {
        if (!cancelled) {
          setPrograms([]);
          setSource("none");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const nowIndex = useMemo(() => findNowIndex(programs, now), [programs, now]);

  /** Always start from the programme on air now (skip finished shows). */
  const fromNow = useMemo(() => {
    if (!programs.length) return [];
    if (nowIndex >= 0) return programs.slice(nowIndex);
    return programs.filter((p) => new Date(p.endsAt).getTime() > now);
  }, [programs, nowIndex, now]);

  const visible = useMemo(() => {
    if (expanded) return fromNow;
    return fromNow.slice(0, 5);
  }, [fromNow, expanded]);

  const current = fromNow[0] ?? null;
  const next = fromNow[1] ?? null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
      <div className="flex items-start justify-between gap-2 border-b border-border/40 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 shrink-0 text-teal-400" />
            Programme guide
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {channelName}
            {loading
              ? " · loading real schedule…"
              : source === "none"
                ? " · no real EPG for this channel"
                : " · from now onwards"}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border/60 px-2 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-40"
          onClick={() => setExpanded((v) => !v)}
          disabled={!fromNow.length}
        >
          {expanded ? "Less" : `More (${Math.max(fromNow.length - 5, 0)})`}
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      </div>

      {loading && (
        <p className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Fetching what’s on now…
        </p>
      )}

      {!loading && !fromNow.length && (
        <p className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
          No real programme is listed for this channel right now. Placeholder
          titles are disabled — only official / XMLTV schedules are shown.
        </p>
      )}

      {!loading && fromNow.length > 0 && (
        <div className="grid gap-2 border-b border-border/40 px-4 py-3 sm:grid-cols-2">
          <div className="rounded-lg bg-teal-500/10 px-3 py-2 ring-1 ring-teal-500/25">
            <p className="text-[10px] font-semibold tracking-wide text-teal-300 uppercase">
              Now
            </p>
            <p className="mt-0.5 truncate text-sm font-medium">
              {current?.title || "—"}
            </p>
            {current && (
              <p className="text-[11px] text-muted-foreground">
                {fmt(current.startsAt)} – {fmt(current.endsAt)}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Next
            </p>
            <p className="mt-0.5 truncate text-sm font-medium">
              {next?.title || "—"}
            </p>
            {next && (
              <p className="text-[11px] text-muted-foreground">
                {fmt(next.startsAt)} – {fmt(next.endsAt)}
              </p>
            )}
          </div>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="px-2 py-2">
          <ul
            className={cn(
              "space-y-0.5",
              expanded && "max-h-72 overflow-y-auto pr-1",
            )}
          >
            {visible.map((p, i) => {
              const isNow = i === 0 && nowIndex >= 0;
              return (
                <li
                  key={`${p.startsAt}-${p.title}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm",
                    isNow && "bg-teal-500/10 ring-1 ring-teal-500/30",
                  )}
                >
                  <span className="w-[5.5rem] shrink-0 text-xs tabular-nums text-muted-foreground">
                    {fmt(p.startsAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {isNow && (
                    <span className="shrink-0 rounded-md bg-teal-600/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                      Now
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
