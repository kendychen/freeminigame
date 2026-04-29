import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Users, Calendar, BarChart3, Settings, Layers, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";

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
    { href: `/t/${slug}/admin`, label: "Tổng quan", icon: BarChart3 },
    { href: `/t/${slug}/admin/members`, label: "Thành viên", icon: UserPlus },
    { href: `/t/${slug}/admin/teams`, label: "Đội", icon: Users },
    { href: `/t/${slug}/admin/groups`, label: "Chia bảng", icon: Layers },
    { href: `/t/${slug}/admin/bracket`, label: "Sơ đồ thi đấu", icon: Calendar },
    { href: `/t/${slug}/admin/settings`, label: "Cấu hình", icon: Settings },
  ];

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            FreeMinigame
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="border-b bg-secondary/30">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate font-semibold">{t.name}</h1>
            <p className="text-xs text-muted-foreground">
              <Link href={`/t/${slug}`} className="underline-offset-2 hover:underline">
                Xem trang công khai →
              </Link>
            </p>
          </div>
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs">
            {role}
          </span>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
