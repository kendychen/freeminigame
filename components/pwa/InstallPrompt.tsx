"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Floating "Cài đặt như app" prompt for the homepage.
 * Listens for the standard `beforeinstallprompt` event (Chrome / Edge / Samsung
 * Internet on Android). Hidden once installed or after user dismiss.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("pwa-install-dismissed") === "1") {
      setHidden(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !evt) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("pwa-install-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") setHidden(true);
    } catch {
      /* ignore */
    }
    setEvt(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-2xl border bg-card p-3 shadow-2xl sm:bottom-6">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <Download className="size-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Cài như app trên điện thoại</p>
        <p className="text-[11px] text-muted-foreground">
          Mở mỗi lần là toàn màn hình, không URL bar.
        </p>
      </div>
      <button
        onClick={install}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Cài đặt
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent"
        aria-label="Đóng"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
