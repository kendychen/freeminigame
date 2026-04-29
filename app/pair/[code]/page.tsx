import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LobbyClient } from "./LobbyClient";
import { headers } from "next/headers";
import type { PairSessionState } from "@/hooks/usePairLobby";

export const dynamic = "force-dynamic";

async function fetchSession(code: string): Promise<PairSessionState | null> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/pair/${code}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as PairSessionState;
}

export default async function PairLobbyPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ host?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const session = await fetchSession(code);
  if (!session) notFound();

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            FreeMinigame
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <LobbyClient code={code} hostTokenFromUrl={sp.host ?? null} initial={session} />
      </main>
    </div>
  );
}
