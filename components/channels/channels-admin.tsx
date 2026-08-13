"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createChannel,
  updateChannel,
  deleteChannel,
  toggleChannelHidden,
} from "@/actions/channels";
import { toast } from "sonner";

type AdminChannel = {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  country: string;
  countryName: string | null;
  language: string | null;
  category: string;
  isLocal: boolean;
  isHidden: boolean;
  isBroken: boolean;
};

const emptyForm = {
  name: "",
  streamUrl: "",
  logoUrl: "",
  country: "LK",
  countryName: "Sri Lanka",
  language: "si",
  category: "General",
  isLocal: true,
};

export function ChannelsAdmin({ channels }: { channels: AdminChannel[] }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        ...form,
        logoUrl: form.logoUrl || undefined,
      };
      const res = editingId
        ? await updateChannel(editingId, payload)
        : await createChannel(payload);
      if (res.success) {
        toast.success(editingId ? "Channel updated" : "Channel created");
        reset();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/dashboard/import">Import real streams (M3U / iptv-org)</Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4"
      >
        <h2 className="font-medium">
          {editingId ? "Edit channel" : "Add channel"}
        </h2>
        {(
          [
            ["name", "Name"],
            ["streamUrl", "Stream URL (m3u8)"],
            ["logoUrl", "Logo URL"],
            ["country", "Country code"],
            ["countryName", "Country name"],
            ["language", "Language"],
            ["category", "Category"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              required={key === "name" || key === "streamUrl"}
            />
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isLocal}
            onChange={(e) => setForm((f) => ({ ...f, isLocal: e.target.checked }))}
          />
          Local channel
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {editingId ? "Save" : "Create"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {channels.map((ch) => (
          <div
            key={ch.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/30 p-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{ch.name}</p>
                {ch.isLocal && <Badge variant="secondary">Local</Badge>}
                {ch.isHidden && <Badge variant="outline">Hidden</Badge>}
                {ch.isBroken && <Badge variant="destructive">Broken</Badge>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{ch.streamUrl}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(ch.id);
                  setForm({
                    name: ch.name,
                    streamUrl: ch.streamUrl,
                    logoUrl: ch.logoUrl ?? "",
                    country: ch.country,
                    countryName: ch.countryName ?? "",
                    language: ch.language ?? "",
                    category: ch.category,
                    isLocal: ch.isLocal,
                  });
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  startTransition(async () => {
                    await toggleChannelHidden(ch.id);
                    toast.success(ch.isHidden ? "Shown" : "Hidden");
                  })
                }
              >
                {ch.isHidden ? "Show" : "Hide"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  startTransition(async () => {
                    await deleteChannel(ch.id);
                    toast.success("Deleted");
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
