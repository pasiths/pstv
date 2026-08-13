"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  emptyText?: string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className,
  emptyText = "No matches",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-input bg-background px-2 text-left text-xs hover:bg-muted/40"
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="relative border-b border-border/60 p-1.5">
            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <ul
            role="listbox"
            className="fluxtv-scroll max-h-52 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                {emptyText}
              </li>
            ) : (
              filtered.map((option) => {
                const active = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                        active && "bg-muted font-medium",
                      )}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
