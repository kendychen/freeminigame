import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AuthNavLink } from "@/components/nav/AuthNavLink";
import { SharedBracketView } from "./SharedBracketView";

export const dynamic = "force-dynamic";

interface SharedPayload {
  code: string;
  data: unknown;
  format: string;
  team_count: number;
  created_at: string;
  expires_at: string;
}

async function fetchShared(code: string): Promise<SharedPayload | null> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/quick-share/${code}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as SharedPayload;
}

export default async function SharedQuickBracket({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const payload = await fetchShared(code);
  if (!payload) notFound();
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            Hội Nhóm Pickleball
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/quick/new">
              <Button size="sm" variant="outline">
                Tạo bảng đấu của bạn
              </Button>
            </Link>
            <AuthNavLink />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-6">
          <span className="rounded-full border bg-secondary px-3 py-1 text-xs">
            Bảng đấu chia sẻ · Mã <code className="font-mono">{code}</code> · Hết hạn{" "}
            {new Date(payload.expires_at).toLocaleString("vi-VN")}
          </span>
        </div>
        <SharedBracketView payload={payload} />
      </main>
    </div>
  );
}
