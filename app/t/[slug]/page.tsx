import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AuthNavLink } from "@/components/nav/AuthNavLink";
import { Button } from "@/components/ui/button";
import { LiveTournamentView } from "./LiveTournamentView";

export const revalidate = 60;

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!t) notFound();
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_id", t.id);
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", t.id)
    .order("round")
    .order("match_number");

  const teamIds = (teams ?? []).map((x) => x.id);
  const { data: memberRows } = teamIds.length
    ? await supabase
        .from("team_members")
        .select("team_id, players(name)")
        .in("team_id", teamIds)
    : { data: [] };
  type MR = {
    team_id: string;
    players: { name: string } | { name: string }[] | null;
  };
  const membersByTeam: Record<string, string[]> = {};
  for (const r of (memberRows ?? []) as MR[]) {
    const arr = membersByTeam[r.team_id] ?? [];
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    if (p?.name) arr.push(p.name);
    membersByTeam[r.team_id] = arr;
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            Hội Nhóm Pickleball
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/display/${t.slug}`}>
              <Button size="sm" variant="outline">
                Display Mode
              </Button>
            </Link>
            <AuthNavLink />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {String(t.format).replace("_", " ")} · {t.status}
          </p>
        </div>
        <LiveTournamentView
          tournament={t}
          teams={teams ?? []}
          initialMatches={matches ?? []}
          membersByTeam={membersByTeam}
        />
      </main>
    </div>
  );
}
