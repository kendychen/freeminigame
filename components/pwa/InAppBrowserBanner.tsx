"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

/**
 * Detects in-app browsers (Zalo, Messenger, Facebook, TikTok, Instagram)
 * which block Google OAuth, and prompts the user to open in the system
 * browser. Without this, "Tiếp tục với Google" silently fails on mobile.
 */
export function InAppBrowserBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (sessionStorage.getItem("dismissed-iab-banner") === "1") {
      setDismissed(true);
      return;
    }
    const ua = navigator.userAgent;
    const isInApp = /FBAN|FBAV|MessengerForiOS|Instagram|Zalo|TikTok|Line\/|wv\)/i.test(
      ua,
    );
    setShow(isInApp);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("dismissed-iab-banner", "1");
    } catch {
      /* ignore */
    }
  };

  if (!show || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 flex items-start gap-2 border-b border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 sm:text-sm">
      <ExternalLink className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">Mở trên trình duyệt để đăng nhập Google</p>
        <p className="mt-0.5 text-[11px] opacity-90 sm:text-xs">
          Bạn đang dùng Zalo / Messenger / Facebook in-app — Google chặn đăng
          nhập trong WebView. Bấm <strong>⋮</strong> → <strong>Mở trong trình
          duyệt</strong> (Chrome / Safari) rồi đăng nhập lại.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 hover:bg-amber-500/20"
        aria-label="Đóng"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
