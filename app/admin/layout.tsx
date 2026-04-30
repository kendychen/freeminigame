import Link from "next/link";
import {
  Trophy,
  LayoutDashboard,
  Users,
  Calendar,
  Activity,
  ScrollText,
  Settings,
  Zap,
} from "lucide-react";
import { requireSiteAdmin } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const NAV = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/tournaments", label: "Giải đấu", icon: Trophy },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/quick-brackets", label: "Quick Shares", icon: Zap },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/health", label: "Health", icon: Activity },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await requireSiteAdmin();
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            Hội Nhóm Pickleball · Admin
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full border bg-secondary px-2 py-0.5 text-xs">
              {role}
            </span>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.email}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <nav className="flex flex-row gap-1 overflow-x-auto lg:w-56 lg:flex-col">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
