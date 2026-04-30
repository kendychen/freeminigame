import Link from "next/link";
import { LayoutDashboard, LogIn } from "lucide-react";
import { getOptionalUser } from "@/lib/auth";

/**
 * Server component. Renders "Bảng điều khiển" link if signed in,
 * else "Đăng nhập" — used in every public page header.
 */
export async function AuthNavLink({ className }: { className?: string }) {
  const { user } = await getOptionalUser();
  const base =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
  if (user) {
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
