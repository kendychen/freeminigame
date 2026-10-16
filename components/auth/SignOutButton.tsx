import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Nút đăng xuất dùng chung cho các header quản trị.
 * Dùng form POST tới /auth/signout nên chạy được trong server component,
 * không cần client JS.
 */
export function SignOutButton({ email }: { email?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {email && (
        <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:block">
          {email}
        </span>
      )}
      <form action="/auth/signout" method="post">
        <Button variant="ghost" size="sm" type="submit" title="Đăng xuất">
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </Button>
      </form>
    </div>
  );
}
