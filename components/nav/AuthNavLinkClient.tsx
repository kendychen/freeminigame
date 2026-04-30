"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogIn } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Browser-side variant of AuthNavLink — usable inside `"use client"` pages. */
export function AuthNavLinkClient({ className }: { className?: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabaseBrowser();
    sb.auth.getUser().then((res: { data: { user: unknown } }) => {
      if (!cancelled) setSignedIn(!!res.data.user);
    });
    const sub = sb.auth.onAuthStateChange(
      (_e: string, session: { user?: unknown } | null) => {
        if (!cancelled) setSignedIn(!!session?.user);
      },
    );
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const base =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
  if (signedIn === null) {
    return <span className={`${base} opacity-0 pointer-events-none ${className ?? ""}`} />;
  }
  if (signedIn) {
    return (
      <Link
        href="/dashboard"
        className={`${base} border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 ${className ?? ""}`}
      >
        <LayoutDashboard className="size-4" />
        <span className="hidden sm:inline">Bảng điều khiển</span>
        <span className="sm:hidden">Dashboard</span>
      </Link>
    );
  }
  return (
    <Link
      href="/login"
      className={`${base} hover:bg-accent hover:text-accent-foreground ${className ?? ""}`}
    >
      <LogIn className="size-4" />
      Đăng nhập
    </Link>
  );
}
