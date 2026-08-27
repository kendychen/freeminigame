import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

export type HeroMatch = {
  tournamentName: string;
  href: string;
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
type PicName = { name: string } | null;
type PicFinalRow = {
  score_a: number;
  score_b: number;
  updated_at: string;
  a1: PicName; a2: PicName; b1: PicName; b2: PicName;
  event: { name: string; slug: string };
};

const PIC_FINAL_COLS =
  "score_a, score_b, updated_at, a1:pic_players!pic_matches_a1_id_fkey(name), a2:pic_players!pic_matches_a2_id_fkey(name), b1:pic_players!pic_matches_b1_id_fkey(name), b2:pic_players!pic_matches_b2_id_fkey(name), event:pic_events!inner(name, slug)";

const MATCH_COLS =
  "id, round, match_number, bracket, group_label, team_a_id, team_b_id, score_a, score_b, winner_team_id, status, series_format, updated_at, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)";

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
    href: `/t/${t.slug}`,
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

const pairName = (x: PicName, y: PicName) => [x?.name, y?.name].filter(Boolean).join(" / ") || "Cặp ?";

function picToHero(m: PicFinalRow): HeroMatch {
  return {
    tournamentName: m.event.name,
    href: `/pic/v/${m.event.slug}`,
    roundLabel: "Chung kết",
    teamA: pairName(m.a1, m.a2),
    teamB: pairName(m.b1, m.b2),
    scoreA: m.score_a,
    scoreB: m.score_b,
    live: false,
    winner: m.score_a === m.score_b ? null : m.score_a > m.score_b ? "a" : "b",
    seriesFormat: "bo1",
    updatedAt: m.updated_at,
  };
}

async function fetchTournamentFinal(sb: ReturnType<typeof createServiceClient>): Promise<HeroMatch | null> {

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

async function fetchPicFinal(sb: ReturnType<typeof createServiceClient>): Promise<HeroMatch | null> {
  const { data } = await sb
    .from("pic_matches")
    .select(PIC_FINAL_COLS)
    .eq("stage", "final")
    .eq("status", "completed")
    .not("a1_id", "is", null)
    .not("b1_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  const row = data?.[0] as unknown as PicFinalRow | undefined;
  return row ? picToHero(row) : null;
}

/** Most recent completed final across tournaments and PIC (xoay cặp) events. Finals only — no live/group/semi fallback. */
export async function fetchHeroMatch(): Promise<HeroMatch | null> {
  const sb = createServiceClient();
  const [tournament, pic] = await Promise.all([fetchTournamentFinal(sb), fetchPicFinal(sb)]);
  if (!tournament) return pic;
  if (!pic) return tournament;
  return pic.updatedAt > tournament.updatedAt ? pic : tournament;
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
