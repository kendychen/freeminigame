"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dices, Activity, PlayCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Trang chủ", icon: Home, match: (p: string) => p === "/" },
  { href: "/pair/new", label: "Bốc thăm", icon: Dices, match: (p: string) => p.startsWith("/pair") },
  { href: "/score/new", label: "Tỷ số", icon: Activity, match: (p: string) => p.startsWith("/score") },
  { href: "/videos", label: "Video", icon: PlayCircle, match: (p: string) => p.startsWith("/videos") },
  { href: "/dashboard", label: "Tài khoản", icon: UserRound, match: (p: string) => p.startsWith("/dashboard") || p.startsWith("/login") },
];

/** V2 mobile bottom tab bar; /dashboard redirects to /login when signed out. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
        aria-label="Điều hướng nhanh"
      >
        {TABS.map((t) => {
          const on = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10.5px] font-semibold text-muted-foreground",
                on && "text-primary",
              )}
            >
              <t.icon className="size-5" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
