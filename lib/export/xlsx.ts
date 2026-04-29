import * as XLSX from "xlsx";
import type { DbMatch, DbTeam, DbTournament } from "@/types/database";

export function buildScheduleWorkbook(input: {
  tournament: DbTournament;
  teams: DbTeam[];
  matches: DbMatch[];
}): ArrayBuffer {
  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const teamName = (id: string | null) =>
    id ? (teamById.get(id)?.name ?? "TBD") : "TBD";

  const wb = XLSX.utils.book_new();

  const scheduleRows = input.matches.map((m) => ({
    Vong: m.round,
    Tran: m.match_number,
    Bang: m.bracket,
    Nhom: m.group_label ?? "",
    DoiA: teamName(m.team_a_id),
    DoiB: teamName(m.team_b_id),
    DiemA: m.score_a,
    DiemB: m.score_b,
    Trang_thai: m.status,
  }));
  const wsSchedule = XLSX.utils.json_to_sheet(scheduleRows);
  XLSX.utils.book_append_sheet(wb, wsSchedule, "Schedule");

  const teamsRows = input.teams.map((t) => ({
    Ten: t.name,
    KhuVuc: t.region ?? "",
    Rating: t.rating ?? "",
    Seed: t.seed ?? "",
  }));
  const wsTeams = XLSX.utils.json_to_sheet(teamsRows);
  XLSX.utils.book_append_sheet(wb, wsTeams, "Teams");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buf;
}
