"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatMessage = {
  id: string;
  author: string;
  text: string;
  at: number;
};

export function LiveChatroom({
  channelName,
  userName,
}: {
  channelName: string;
  userName?: string | null;
}) {
  const storageKey = `fluxtv-chat-${channelName}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

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
    localStorage.setItem(storageKey, JSON.stringify(next));
    setText("");
  };

  return (
    <div className="flex h-72 flex-col rounded-xl border border-border/60 bg-card/40">
      <div className="border-b border-border/60 px-3 py-2 text-sm font-medium">
        Live chat · {channelName}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
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
        />
        <Button type="submit" size="sm">
          Send
        </Button>
      </form>
    </div>
  );
}
