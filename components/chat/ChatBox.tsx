"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X, ChevronDown } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

const PRESET_EMOJI = ["👏", "🔥", "😂", "💪", "🍀", "🎉", "🥲", "👍"];
const MAX_MESSAGES = 80;
const MAX_LEN = 200;
const MIN_INTERVAL_MS = 1500; // ~1 msg / 1.5s per user
const STORAGE_KEY_NAME = "freeminigame:chat-name";
const STORAGE_KEY_OPEN = "freeminigame:chat-open";

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  /** Local own-message echo: true if this client sent it */
  mine?: boolean;
}

export interface ChatBoxProps {
  /** Unique key per room. Eg. "pair:ABCD" or "tournament:<id>" */
  channelKey: string;
  /** Optional initial display name to skip the prompt */
  defaultName?: string;
  /** Header label, default "Chat phòng" */
  title?: string;
}

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function ChatBox({ channelKey, defaultName, title = "Chat phòng" }: ChatBoxProps) {
  // Default OPEN — user can collapse to a small launcher button if they want.
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState<string>("");
  const [unread, setUnread] = useState(0);
  const lastSentRef = useRef(0);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof getSupabaseBrowser>["channel"]
  > | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load name + open state from storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY_NAME);
    if (stored) setName(stored);
    else if (defaultName) setName(defaultName);
    const storedOpen = localStorage.getItem(STORAGE_KEY_OPEN);
    if (storedOpen === "0") setOpen(false);
  }, [defaultName]);

  const setOpenPersist = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // Subscribe to broadcast channel
  useEffect(() => {
    if (!channelKey) return;
    const sb = getSupabaseBrowser();
    const ch = sb.channel(`chat:${channelKey}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "msg" }, (payload: { payload: ChatMessage }) => {
      const m = payload.payload;
      if (!m || !m.id || !m.text) return;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m].slice(-MAX_MESSAGES);
      });
      if (!open) setUnread((u) => u + 1);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      sb.removeChannel(ch);
      channelRef.current = null;
    };
  }, [channelKey, open]);

  // Reset unread when opening
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Auto-scroll to bottom on new message (when open)
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const send = (text: string) => {
    const cleaned = text.trim().slice(0, MAX_LEN);
    if (!cleaned) return;
    if (!name.trim()) {
      const ask = prompt("Nhập tên hiển thị trong chat:");
      if (!ask?.trim()) return;
      const trimmed = ask.trim().slice(0, 24);
      setName(trimmed);
      try {
        localStorage.setItem(STORAGE_KEY_NAME, trimmed);
      } catch {
        /* ignore */
      }
    }
    const now = Date.now();
    if (now - lastSentRef.current < MIN_INTERVAL_MS) {
      toast({
        title: "Nhắn nhanh quá",
        description: "Đợi 1-2 giây trước khi nhắn tiếp.",
      });
      return;
    }
    lastSentRef.current = now;
    const myName = name.trim() || "Khách";
    const msg: ChatMessage = {
      id: genId(),
      name: myName.slice(0, 24),
      text: cleaned,
      ts: now,
    };
    // Local echo
    setMessages((prev) => [...prev, { ...msg, mine: true }].slice(-MAX_MESSAGES));
    // Broadcast
    channelRef.current?.send({
      type: "broadcast",
      event: "msg",
      payload: msg,
    });
    setInput("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const renamePrompt = () => {
    const ask = prompt("Đổi tên hiển thị:", name);
    if (!ask) return;
    const trimmed = ask.trim().slice(0, 24);
    if (!trimmed) return;
    setName(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY_NAME, trimmed);
    } catch {
      /* ignore */
    }
  };

  const fmtTime = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpenPersist(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
        aria-label="Mở chat"
      >
        <MessageCircle className="size-5" />
        Chat
        {unread > 0 && (
          <span className="ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[60vh] w-full max-w-md flex-col rounded-t-2xl border border-b-0 bg-card shadow-2xl sm:bottom-6 sm:right-6 sm:left-auto sm:mx-0 sm:h-[calc(100vh-7rem)] sm:max-h-[640px] sm:w-[340px] sm:rounded-2xl sm:border-b">
      <header className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <span className="text-sm font-semibold">{title}</span>
          <button
            onClick={renamePrompt}
            className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            title="Đổi tên hiển thị"
          >
            {name || "Khách"} ✎
          </button>
        </div>
        <button
          onClick={() => setOpenPersist(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Thu nhỏ chat"
        >
          <ChevronDown className="size-4 sm:hidden" />
          <X className="hidden size-4 sm:block" />
        </button>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Chưa có tin nhắn — bắt đầu chém gió đi 🎉
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col gap-0.5 ${m.mine ? "items-end" : "items-start"}`}
          >
            <div className="flex items-baseline gap-1.5 text-[10px] text-muted-foreground">
              <span className="font-medium">{m.mine ? "Bạn" : m.name}</span>
              <span>{fmtTime.format(m.ts)}</span>
            </div>
            <div
              className={`max-w-[85%] break-words rounded-2xl px-3 py-1.5 ${
                m.mine
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t px-2 py-1.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PRESET_EMOJI.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => send(em)}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-lg transition-transform hover:bg-accent active:scale-90"
              aria-label={`Gửi ${em}`}
            >
              {em}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-1.5 pt-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_LEN}
            placeholder="Nhập tin nhắn…"
            className="flex h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
            aria-label="Gửi"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
