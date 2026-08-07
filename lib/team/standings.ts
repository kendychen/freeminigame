/** Team mode standings — pure, shared by admin/viewer/referee.
 * Only completed ties count (ties never draw — winner_squad_id is authoritative).
 * Sort: ties won → rubber diff (walkover-with-winner counts, canceled excluded)
 * → point diff (completed rubbers only — walkovers have no real points) → name. */

import type { DbTeamRubber, DbTeamSquad, DbTeamTie } from "./types";

export interface TeamStanding {
  squadId: string;
  name: string;
  rank: number;
  played: number;
  tiesWon: number;
  tiesLost: number;
  rubbersWon: number;
  rubbersLost: number;
  rubberDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export function computeTeamStandings(
  squads: DbTeamSquad[],
  ties: DbTeamTie[],
  rubbers: DbTeamRubber[],
): TeamStanding[] {
  const map = new Map<string, TeamStanding>();
  for (const s of squads) {
    map.set(s.id, {
      squadId: s.id,
      name: s.name,
      rank: 0,
      played: 0,
      tiesWon: 0,
      tiesLost: 0,
      rubbersWon: 0,
      rubbersLost: 0,
      rubberDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    });
  }

  const countedTies = new Map<string, DbTeamTie>();
  for (const t of ties) {
    if (t.status !== "completed" || !t.squad_a_id || !t.squad_b_id || !t.winner_squad_id) continue;
    const a = map.get(t.squad_a_id);
    const b = map.get(t.squad_b_id);
    if (!a || !b) continue;
    countedTies.set(t.id, t);
    a.played += 1;
    b.played += 1;
    if (t.winner_squad_id === t.squad_a_id) {
      a.tiesWon += 1;
      b.tiesLost += 1;
    } else if (t.winner_squad_id === t.squad_b_id) {
      b.tiesWon += 1;
      a.tiesLost += 1;
    }
  }

  for (const r of rubbers) {
    const tie = countedTies.get(r.tie_id);
    if (!tie) continue;
    const a = map.get(tie.squad_a_id!)!;
    const b = map.get(tie.squad_b_id!)!;
    if (r.status === "completed") {
      a.pointsFor += r.score_a;
      a.pointsAgainst += r.score_b;
      b.pointsFor += r.score_b;
      b.pointsAgainst += r.score_a;
      if (r.score_a > r.score_b) {
        a.rubbersWon += 1;
        b.rubbersLost += 1;
      } else if (r.score_b > r.score_a) {
        b.rubbersWon += 1;
        a.rubbersLost += 1;
      }
    } else if (r.status === "walkover" && r.walkover_winner) {
      if (r.walkover_winner === "a") {
        a.rubbersWon += 1;
        b.rubbersLost += 1;
      } else {
        b.rubbersWon += 1;
        a.rubbersLost += 1;
      }
    }
  }

  const rows = Array.from(map.values());
  for (const r of rows) {
    r.rubberDiff = r.rubbersWon - r.rubbersLost;
    r.pointDiff = r.pointsFor - r.pointsAgainst;
  }
  rows.sort(
    (x, y) =>
      y.tiesWon - x.tiesWon ||
      y.rubberDiff - x.rubberDiff ||
      y.pointDiff - x.pointDiff ||
      x.name.localeCompare(y.name),
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}
