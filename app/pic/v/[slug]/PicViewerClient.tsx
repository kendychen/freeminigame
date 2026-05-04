"use client";

import { Trophy } from "lucide-react";
import { computeStandings, type PicPlayer, type PicGroup, type PicMatch } from "@/stores/pic-tournament";
import type { PicEventFull } from "@/app/actions/pic";
import Link from "next/link";
import { PickleballLogo } from "@/components/brand/PickleballLogo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

function pairName(players: PicPlayer[], ...ids: string[]) {
  return ids.map((id) => players.find((p) => p.id === id)?.name ?? "?").join(" & ");
}

function StandingsTable({
  group, players, advancePerGroup, pointsForWin, pointsForLoss, tiebreakerOrder,
}: {
  group: PicGroup; players: PicPlayer[]; advancePerGroup: number;
  pointsForWin: number; pointsForLoss: number;
  tiebreakerOrder?: "diff_first" | "wins_first";
}) {
  const gPlayers = group.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is PicPlayer => !!p);
  const standings = computeStandings(gPlayers, group.matches, pointsForWin, pointsForLoss, tiebreakerOrder);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-bold text-primary">
        Bảng {group.label}
        <span className="ml-2 font-normal text-muted-foreground">T+{pointsForWin} B+{pointsForLoss}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Tên</th>
            <th className="px-3 py-2 text-center">Điểm</th>
            <th className="px-3 py-2 text-center">T</th>
            <th className="px-3 py-2 text-center">B</th>
            <th className="px-3 py-2 text-center">±</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.playerId} className={`border-b last:border-0 ${i >= advancePerGroup ? "opacity-50" : ""}`}>
              <td className="px-3 py-2.5">
                <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-yellow-400/20 text-yellow-600" :
                  i === 1 ? "bg-slate-300/20 text-slate-500" :
                  i < advancePerGroup ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>{s.rank}</span>
              </td>
              <td className="px-3 py-2.5 font-medium">{s.name}</td>
              <td className="px-3 py-2.5 text-center font-mono font-bold text-primary">{s.pts}</td>
              <td className="px-3 py-2.5 text-center font-mono">{s.wins}</td>
              <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">{s.losses}</td>
              <td className={`px-3 py-2.5 text-center font-mono font-semibold ${s.diff > 0 ? "text-green-600" : s.diff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                {s.diff > 0 ? "+" : ""}{s.diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KoRow({ match, label, players }: { match: PicMatch; label: string; players: PicPlayer[] }) {
  const aWon = match.scoreA > match.scoreB;
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className={`flex-1 truncate ${aWon ? "font-bold" : "text-muted-foreground"}`}>
          {pairName(players, match.a1, match.a2)}
        </span>
        <span className="shrink-0 font-mono font-black tabular-nums">
          {match.scoreA} – {match.scoreB}
        </span>
        <span className={`flex-1 truncate text-right ${!aWon ? "font-bold" : "text-muted-foreground"}`}>
          {pairName(players, match.b1, match.b2)}
        </span>
      </div>
    </div>
  );
}

export default function PicViewerClient({ state }: { state: PicEventFull }) {
  const { config, players, groups, knockoutMatches, stage } = state;

  const W = config.pointsForWin ?? 2;
  const L = config.pointsForLoss ?? 0;
  const TB = config.tiebreakerOrder ?? "diff_first";

  const finalMatch = knockoutMatches.find((m) => m.stage === "final");
  const thirdMatch = knockoutMatches.find((m) => m.stage === "third");
  const quarterMatches = knockoutMatches.filter((m) => m.stage === "quarterfinal");
  const semiMatches = knockoutMatches.filter((m) => m.stage === "semifinal");
  const isDone = stage === "done";

  const stageLabel =
    stage === "group" ? "Vòng bảng" :
    stage === "draw" ? "Chờ bốc thăm" :
    stage === "knockout" ? "Vòng trung kết" : "Kết thúc";

  const champs = finalMatch && finalMatch.status === "completed"
    ? (finalMatch.scoreA > finalMatch.scoreB ? [finalMatch.a1, finalMatch.a2] : [finalMatch.b1, finalMatch.b2])
    : null;
  const runners = finalMatch && finalMatch.status === "completed"
    ? (finalMatch.scoreA > finalMatch.scoreB ? [finalMatch.b1, finalMatch.b2] : [finalMatch.a1, finalMatch.a2])
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <PickleballLogo size={24} />
            <span className="hidden sm:inline text-sm">Hội Nhóm Pickleball</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b bg-gradient-to-r from-primary/10 via-secondary/30 to-primary/5">
        <div className="mx-auto max-w-xl px-4 py-3">
          <h1 className="font-bold text-lg">{config.name}</h1>
          <p className="text-xs text-muted-foreground">
            PIC xoay cặp · {stageLabel}
            {stage === "group" && (() => {
              const done = groups.reduce((s, g) => s + g.matches.filter((m) => m.status === "completed").length, 0);
              const total = groups.reduce((s, g) => s + g.matches.length, 0);
              return <span className="ml-1">· {done}/{total} trận</span>;
            })()}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-5">
        {/* Podium — done stage */}
        {isDone && champs && runners && (
          <div className="space-y-3">
            <h2 className="text-center text-xl font-bold">🏆 Kết quả</h2>
            <div className="rounded-2xl border-2 border-yellow-400 bg-yellow-500/10 p-5 text-center">
              <p className="text-2xl">🥇</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-yellow-600">Vô địch</p>
              <p className="mt-1 text-lg font-black">{pairName(players, ...champs)}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 text-center">
              <p className="text-xl">🥈</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Á quân</p>
              <p className="mt-1 font-bold">{pairName(players, ...runners)}</p>
            </div>
            {thirdMatch && thirdMatch.status === "completed" && (() => {
              const t3Won = thirdMatch.scoreA > thirdMatch.scoreB;
              const third = t3Won ? [thirdMatch.a1, thirdMatch.a2] : [thirdMatch.b1, thirdMatch.b2];
              return (
                <div className="rounded-2xl border bg-card p-4 text-center">
                  <p className="text-xl">🥉</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">Hạng 3</p>
                  <p className="mt-0.5 font-bold">{pairName(players, ...third)}</p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Knockout results */}
        {(stage === "knockout" || isDone) && knockoutMatches.some((m) => m.status === "completed") && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vòng trung kết</h2>
            {quarterMatches.filter((m) => m.status === "completed").map((m, i) => (
              <KoRow key={m.id} match={m} label={`Tứ kết ${i + 1}`} players={players} />
            ))}
            {quarterMatches.some((m) => m.status === "pending") && (
              <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
                Đang thi đấu tứ kết…
              </div>
            )}
            {semiMatches.filter((m) => m.status === "completed").map((m, i) => (
              <KoRow key={m.id} match={m} label={`Bán kết ${i + 1}`} players={players} />
            ))}
            {semiMatches.some((m) => m.status === "pending") && (
              <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Đang thi đấu bán kết…
              </div>
            )}
            {thirdMatch && thirdMatch.status === "completed" && (
              <KoRow match={thirdMatch} label="Tranh hạng 3–4" players={players} />
            )}
            {finalMatch && finalMatch.status === "completed" && (
              <KoRow match={finalMatch} label="Chung kết" players={players} />
            )}
            {finalMatch && finalMatch.status === "pending" && (
              <div className="rounded-xl border border-dashed border-yellow-400/50 bg-yellow-500/5 p-4 text-center text-sm text-muted-foreground">
                🏆 Đang thi đấu chung kết…
              </div>
            )}
          </div>
        )}

        {/* Draw stage notice */}
        {stage === "draw" && (
          <div className="rounded-xl border bg-muted/30 p-5 text-center">
            <Trophy className="mx-auto mb-2 size-7 text-primary" />
            <p className="font-semibold">Vòng bảng hoàn thành</p>
            <p className="mt-1 text-sm text-muted-foreground">Đang chờ ban tổ chức bốc thăm vòng trung kết…</p>
          </div>
        )}

        {/* Group standings */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isDone ? "Thống kê vòng bảng" : "Bảng đấu"}
          </h2>
          {groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <StandingsTable
                group={g}
                players={players}
                advancePerGroup={config.advancePerGroup}
                pointsForWin={W}
                pointsForLoss={L}
                tiebreakerOrder={TB}
              />

              {/* Completed match results */}
              {g.matches.some((m) => m.status === "completed") && (
                <div className="overflow-hidden rounded-xl border bg-card">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    Kết quả trận — Bảng {g.label}
                  </div>
                  {g.matches.filter((m) => m.status === "completed").map((m) => {
                    const mAWon = m.scoreA > m.scoreB;
                    return (
                      <div key={m.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-0 text-xs">
                        <span className="w-12 shrink-0 text-muted-foreground">Vòng {m.round}</span>
                        <span className={`flex-1 truncate ${mAWon ? "font-semibold" : "text-muted-foreground"}`}>
                          {pairName(players, m.a1, m.a2)}
                        </span>
                        <span className="shrink-0 font-mono font-bold tabular-nums">
                          {m.scoreA} – {m.scoreB}
                        </span>
                        <span className={`flex-1 truncate text-right ${!mAWon ? "font-semibold" : "text-muted-foreground"}`}>
                          {pairName(players, m.b1, m.b2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
