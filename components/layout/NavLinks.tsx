"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "/", label: "Trang chủ", match: (p: string) => p === "/" },
  { href: "/pair/new", label: "Bốc thăm", match: (p: string) => p.startsWith("/pair") },
  { href: "/score/new", label: "Tỷ số", match: (p: string) => p.startsWith("/score") },
  { href: "/quick/new", label: "Chia cặp nhanh", match: (p: string) => p.startsWith("/quick") },
  { href: "/videos", label: "Video kỹ thuật", match: (p: string) => p.startsWith("/videos") },
  { href: "/team/new", label: "Giải đồng đội", match: (p: string) => p.startsWith("/team") },
  { href: "/huong-dan", label: "Hướng dẫn", match: (p: string) => p.startsWith("/huong-dan") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
      {NAV_LINKS.map((l) => {
        const on = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              on && "bg-secondary text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
