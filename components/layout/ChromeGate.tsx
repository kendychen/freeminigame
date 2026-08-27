"use client";
import { usePathname } from "next/navigation";

// Surfaces that must stay chrome-free: admin has its own shell, embed/display
// are fullscreen, /r is the referee scoring link, and live match pages keep
// their bottom controls clear of the mobile tab bar.
export const NO_CHROME = ["/admin", "/embed/", "/display/", "/r/", "/pic/tv/", "/team/tv/"];
export const NO_TABBAR = [...NO_CHROME, "/score/", "/pair/", "/pic/", "/t/"];

export function ChromeGate({ hide, children }: { hide: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  if (hide.some((p) => pathname === p || pathname.startsWith(p))) return null;
  return <>{children}</>;
}
