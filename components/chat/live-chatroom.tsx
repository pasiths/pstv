"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatMessage = {
  id: string;
  author: string;
  text: string;
  at: number;
};

function readChat(storageKey: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function LiveChatroom({
  channelName,
  userName,
}: {
  channelName: string;
  userName?: string | null;
}) {
  const storageKey = `fluxtv-chat-${channelName}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    readChat(storageKey),
  );
  const [text, setText] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const next: ChatMessage[] = [
      ...messages,
      {
        id: crypto.randomUUID(),
        author: userName || "Guest",
        text: text.trim(),
        at: Date.now(),
      },
    ].slice(-100);
    setMessages(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore quota
    }
    setText("");
  };

  return (
    <div className="flex h-72 flex-col rounded-xl border border-border/60 bg-card/40">
      <div className="border-b border-border/60 px-3 py-2 text-sm font-medium">
        Live chat · {channelName}
      </div>
      <div className="fluxtv-scroll flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <p className="text-muted-foreground">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <span className="font-medium text-teal-400">{m.author}: </span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border/60 p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button type="submit" size="sm">
          Send
        </Button>
      </form>
    </div>
  );
}
