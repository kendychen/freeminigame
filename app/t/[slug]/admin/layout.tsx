import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Users,
  Calendar,
  BarChart3,
  Settings,
  Layers,
  UserPlus,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PickleballLogo } from "@/components/brand/PickleballLogo";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, slug, name, owner_id, deleted_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!t || t.deleted_at) notFound();
  const isOwner = t.owner_id === user.id;
  let role: "owner" | "co_admin" | "viewer" | null = isOwner ? "owner" : null;
  if (role === null) {
    const { data: ta } = await supabase
      .from("tournament_admins")
      .select("role")
      .eq("tournament_id", t.id)
      .eq("admin_id", user.id)
      .maybeSingle();
    const r = ta?.role as "owner" | "co_admin" | "viewer" | undefined;
    role = r ?? null;
  }
  const r: string = role ?? "";
  if (!role || r === "viewer") notFound();

  const nav = [
    { href: `/t/${slug}/admin`, label: "Tổng quan", short: "Trang chủ", icon: BarChart3 },
    { href: `/t/${slug}/admin/members`, label: "Thành viên", short: "Người", icon: UserPlus },
    { href: `/t/${slug}/admin/teams`, label: "Đội", short: "Đội", icon: Users },
    { href: `/t/${slug}/admin/groups`, label: "Chia bảng", short: "Bảng", icon: Layers },
    { href: `/t/${slug}/admin/bracket`, label: "Sơ đồ thi đấu", short: "Sơ đồ", icon: Calendar },
    { href: `/t/${slug}/admin/settings`, label: "Cấu hình", short: "Cấu hình", icon: Settings },
  ];

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0">
      {/* Top header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <PickleballLogo size={26} />
            <span className="hidden sm:inline">FreeMinigame</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Tournament name banner */}
      <div className="border-b bg-gradient-to-r from-primary/10 via-secondary/30 to-primary/5">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold sm:text-lg">{t.name}</h1>
            <p className="text-xs text-muted-foreground">
              <Link
                href={`/t/${slug}`}
                className="underline-offset-2 hover:underline"
              >
                Xem trang công khai →
              </Link>
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {role === "owner" ? "👑" : "👤"} {role}
          </span>
        </div>
      </div>

      {/* Main 2-column on desktop / stacked on mobile */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:flex-row lg:gap-6">
        {/* Desktop sidebar (hidden on mobile) */}
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

      {/* Mobile bottom tab bar (hidden on desktop) */}
      <nav className="mobile-tabbar border-t bg-background/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-6">
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
