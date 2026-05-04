import { notFound } from "next/navigation";
import Link from "next/link";
import { BarChart3, Users, CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PickleballLogo } from "@/components/brand/PickleballLogo";

export default async function PicAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireUser();
  const svc = createServiceClient();
  const { data: ev } = await svc
    .from("pic_events")
    .select("id, name, stage, owner_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!ev || ev.owner_id !== user.id) notFound();

  const stageLabel =
    ev.stage === "group" ? "Vòng bảng" :
    ev.stage === "draw" ? "Bốc thăm" :
    ev.stage === "knockout" ? "Knockout" : "Hoàn thành";

  const nav = [
    { href: `/pic/${slug}`, label: "Tổng quan", short: "Tổng quan", icon: BarChart3 },
    { href: `/pic/${slug}/players`, label: "VĐV", short: "VĐV", icon: Users },
    { href: `/pic/${slug}/matches`, label: "Trận đấu", short: "Trận đấu", icon: CalendarDays },
  ];

  return (
    <div className="flex flex-col flex-1 pb-16 lg:pb-0">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <PickleballLogo size={26} />
            <span className="hidden sm:inline">Hội Nhóm Pickleball</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b bg-gradient-to-r from-primary/10 via-secondary/30 to-primary/5">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold sm:text-lg">{ev.name}</h1>
            <p className="text-xs text-muted-foreground">PIC xoay cặp · {stageLabel}</p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            👑 owner
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:flex-row lg:gap-6">
        <nav className="hidden shrink-0 lg:flex lg:w-56 lg:flex-col lg:gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <item.icon className="size-5" />
              <span className="leading-tight">{item.short}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
