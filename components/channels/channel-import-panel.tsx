"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  importIptvOrgCategory,
  importIptvOrgCountry,
  importM3uPlaylist,
  syncInternationalChannels,
} from "@/actions/sync";

const QUICK_COUNTRIES = [
  { code: "lk", label: "Sri Lanka" },
  { code: "in", label: "India" },
  { code: "us", label: "USA" },
  { code: "gb", label: "UK" },
  { code: "ae", label: "UAE" },
  { code: "sg", label: "Singapore" },
];

const QUICK_CATEGORIES = ["news", "sports", "entertainment", "kids", "movies", "music"];

export function ChannelImportPanel() {
  const [pending, startTransition] = useTransition();
  const [country, setCountry] = useState("lk");
  const [m3uUrl, setM3uUrl] = useState(
    "https://iptv-org.github.io/iptv/countries/lk.m3u",
  );
  const [m3uText, setM3uText] = useState("");

  const run = (
    label: string,
    action: () => Promise<{
      success: boolean;
      error?: string;
      created?: number;
      updated?: number;
      total?: number;
    }>,
  ) => {
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        toast.error(res.error ?? `${label} failed`);
        return;
      }
      toast.success(
        `${label}: +${res.created ?? 0} new, ${res.updated ?? 0} updated (${res.total ?? 0} total)`,
      );
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="font-medium">Import by country (iptv-org)</h2>
        <p className="text-sm text-muted-foreground">
          Loads real free-to-air m3u8 streams from the public iptv-org catalog.
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_COUNTRIES.map((c) => (
            <Button
              key={c.code}
              type="button"
              size="sm"
              variant={country === c.code ? "default" : "outline"}
              disabled={pending}
              onClick={() => {
                setCountry(c.code);
                run(`Import ${c.label}`, () =>
                  importIptvOrgCountry({
                    country: c.code,
                    markLocal: c.code === "lk",
                  }),
                );
              }}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="country">Country code</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toLowerCase())}
              className="w-24"
              maxLength={2}
            />
          </div>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(`Import ${country.toUpperCase()}`, () =>
                importIptvOrgCountry({
                  country,
                  markLocal: country === "lk",
                }),
              )
            }
          >
            Import country
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="font-medium">Import by category</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(`Import ${cat}`, () =>
                  importIptvOrgCategory({ category: cat, limit: 80 }),
                )
              }
            >
              {cat}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run("Sync mixed international", () => syncInternationalChannels(150))
          }
        >
          Sync mixed news + sports + entertainment
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="font-medium">Import M3U URL</h2>
        <div className="space-y-1">
          <Label htmlFor="m3u-url">Playlist URL</Label>
          <Input
            id="m3u-url"
            value={m3uUrl}
            onChange={(e) => setM3uUrl(e.target.value)}
            placeholder="https://…/playlist.m3u"
          />
        </div>
        <Button
          type="button"
          disabled={pending || !m3uUrl.trim()}
          onClick={() =>
            run("Import M3U URL", () =>
              importM3uPlaylist({
                source: m3uUrl,
                defaultCountry: country.toUpperCase(),
                markLocal: country === "lk",
              }),
            )
          }
        >
          Import from URL
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="font-medium">Paste M3U playlist</h2>
        <textarea
          className="min-h-40 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder={"#EXTM3U\n#EXTINF:-1,Channel Name\nhttps://example.com/live.m3u8"}
          value={m3uText}
          onChange={(e) => setM3uText(e.target.value)}
        />
        <Button
          type="button"
          disabled={pending || !m3uText.trim()}
          onClick={() =>
            run("Import pasted M3U", () =>
              importM3uPlaylist({
                source: m3uText,
                defaultCountry: country.toUpperCase(),
                markLocal: country === "lk",
              }),
            )
          }
        >
          Import pasted playlist
        </Button>
      </section>
    </div>
  );
}
