import { createClient } from "@/lib/supabase/server";
import type { DbMatch, DbTeam, DbTournament } from "@/types/database";
import TournamentTvClient from "./TournamentTvClient";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
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

  // RLS hides private tournaments from anonymous viewers (a TV browser is
  // never logged in), so explain instead of a bare 404.
  if (!t) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 p-10 text-center text-white">
        <div>
          <p className="text-6xl">📺</p>
          <h1 className="mt-6 text-4xl font-black">Không mở được màn hình hiển thị</h1>
          <p className="mx-auto mt-4 max-w-2xl text-2xl text-zinc-400">
            Giải không tồn tại hoặc đang ở chế độ riêng tư. Vào cài đặt giải, bật <strong className="text-white">Công khai</strong> rồi mở lại link này trên TV.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: teams }, { data: matches }] = await Promise.all([
    supabase.from("teams").select("*").eq("tournament_id", t.id),
    supabase.from("matches").select("*").eq("tournament_id", t.id).order("round").order("match_number"),
  ]);

  return (
    <TournamentTvClient
      tournament={t as DbTournament}
      teams={(teams ?? []) as DbTeam[]}
      initialMatches={(matches ?? []) as DbMatch[]}
    />
  );
}
