import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

export type HeroMatch = {
  tournamentName: string;
  tournamentSlug: string;
  roundLabel: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  live: boolean;
  winner: "a" | "b" | null;
  seriesFormat: string;
  updatedAt: string;
};

type Team = { name: string } | null;
type MatchRow = {
  id: string;
  round: number;
  match_number: number;
  bracket: string;
  group_label: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_team_id: string | null;
  status: string;
  series_format: string;
  updated_at: string;
  team_a: Team;
  team_b: Team;
};
type TournamentRef = { name: string; slug: string };

const MATCH_COLS =
  "id, round, match_number, bracket, group_label, team_a_id, team_b_id, score_a, score_b, winner_team_id, status, series_format, updated_at, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)";

/** A "live" match nobody touched for this long is a forgotten one, not a current one. */
const LIVE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function roundLabel(m: MatchRow, all: MatchRow[]): string {
  if (m.bracket === "grand_final") return "Chung kết";
  if (m.bracket === "group") return m.group_label ? `Bảng ${m.group_label}` : "Vòng bảng";
  if (m.bracket === "plate") return `Plate · Vòng ${m.round}`;
  if (m.bracket === "losers") return `Nhánh thua · Vòng ${m.round}`;
  const sameBracket = all.filter((x) => x.bracket === m.bracket);
  const maxRound = Math.max(...sameBracket.map((x) => x.round));
  const inRound = sameBracket.filter((x) => x.round === m.round && x.status !== "bye").length;
  if (inRound === 1 && m.round === maxRound) return "Chung kết";
  if (inRound === 2 && m.round === maxRound - 1) return "Bán kết";
  return `Vòng ${m.round}`;
}

function toHero(m: MatchRow, all: MatchRow[], t: TournamentRef): HeroMatch {
  return {
    tournamentName: t.name,
    tournamentSlug: t.slug,
    roundLabel: roundLabel(m, all),
    teamA: m.team_a?.name ?? "Đội A",
    teamB: m.team_b?.name ?? "Đội B",
    scoreA: m.score_a,
    scoreB: m.score_b,
    live: m.status === "live",
    winner: m.winner_team_id ? (m.winner_team_id === m.team_a_id ? "a" : "b") : null,
    seriesFormat: m.series_format,
    updatedAt: m.updated_at,
  };
}

/** Live match first; else the completed final of the most recent public tournament that has one. Finals only — no group/semi fallback. */
export async function fetchHeroMatch(): Promise<HeroMatch | null> {
  const sb = createServiceClient();

  const { data: live } = await sb
    .from("matches")
    .select(`${MATCH_COLS}, tournament:tournaments!inner(name, slug, is_public, deleted_at)`)
    .eq("status", "live")
    .gte("updated_at", new Date(Date.now() - LIVE_MAX_AGE_MS).toISOString())
    .eq("tournament.is_public", true)
    .is("tournament.deleted_at", null)
    .not("team_a_id", "is", null)
    .not("team_b_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  const liveRow = live?.[0] as unknown as (MatchRow & { tournament: TournamentRef }) | undefined;
  if (liveRow) return toHero(liveRow, [liveRow], liveRow.tournament);

  const { data: tournaments } = await sb
    .from("tournaments")
    .select("id, name, slug")
    .eq("is_public", true)
    .is("deleted_at", null)
    .in("status", ["running", "completed"])
    .order("updated_at", { ascending: false })
    .limit(20);

  for (const t of tournaments ?? []) {
    const { data } = await sb.from("matches").select(MATCH_COLS).eq("tournament_id", t.id);
    const all = (data ?? []) as unknown as MatchRow[];
    const final = all.find(
      (m) => m.status === "completed" && m.team_a_id && m.team_b_id && roundLabel(m, all) === "Chung kết",
    );
    if (final) return toHero(final, all, t);
  }
  return null;
}

/** Cached 30s so a live score stays fresh without hammering the DB on every homepage hit. */
export const getHeroMatch = unstable_cache(
  async (): Promise<HeroMatch | null> => {
    try {
      return await fetchHeroMatch();
    } catch (e) {
      console.error("home-live-match failed", e);
      return null;
    }
  },
  ["home-hero-match"],
  { revalidate: 30 },
);
