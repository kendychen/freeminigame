"use client";

import { useMemo } from "react";
import { loadPicTvState, type PicTvState } from "@/app/actions/pic";
import { computeStandings, type PicMatch, type PicPlayer } from "@/stores/pic-tournament";
import { TvShell, TvCard, TvLiveCard, TvMatchRow, TvStandings, type TvScreen } from "@/components/tv/TvShell";
import { useTvFeed, useRecentlyCompleted } from "@/components/tv/useTvFeed";

const STAGE_LABEL: Record<PicMatch["stage"], string> = {
  group: "Vòng bảng",
  r16: "Vòng 1/8",
  quarterfinal: "Tứ kết",
  semifinal: "Bán kết",
  final: "Chung kết",
  third: "Tranh hạng 3",
};

function pairName(players: PicPlayer[], ...ids: string[]) {
  const names = ids.filter(Boolean).map((id) => players.find((p) => p.id === id)?.name ?? "?");
  return names.length ? names.join(" / ") : "Chờ xác định";
}

export default function PicTvClient({ initial }: { initial: PicTvState }) {
  const eventId = initial.state.id;
  const { data, conn, updatedAt } = useTvFeed<PicTvState>({
    key: `pic:${eventId}`,
    initial,
    tables: [
      { table: "pic_matches", filter: `event_id=eq.${eventId}` },
      { table: "quick_scores" },
    ],
    refetch: () => loadPicTvState(eventId),
  });
  const { state, live } = data;
  const { config, players, groups, knockoutMatches, stage } = state;

  const allMatches = useMemo(
    () => [...groups.flatMap((g) => g.matches.map((m) => ({ m, group: g.label }))), ...knockoutMatches.map((m) => ({ m, group: null }))],
    [groups, knockoutMatches],
  );
  const completedIds = useMemo(
    () => allMatches.filter((x) => x.m.status === "completed").map((x) => x.m.id),
    [allMatches],
  );
  const { recent, banner } = useRecentlyCompleted(completedIds);

  const bannerNode = useMemo(() => {
    if (!banner) return null;
    const hit = allMatches.find((x) => x.m.id === banner);
    if (!hit) return null;
    const { m, group } = hit;
    return `Kết thúc ${group ? `bảng ${group}` : STAGE_LABEL[m.stage]}: ${pairName(players, m.a1, m.a2)} ${m.scoreA} – ${m.scoreB} ${pairName(players, m.b1, m.b2)}`;
  }, [banner, allMatches, players]);

  const W = config.pointsForWin ?? 2;
  const L = config.pointsForLoss ?? 0;
  const TB = config.tiebreakerOrder ?? "diff_first";

  const screens: TvScreen[] = [];

  // ── Live now ──
  const liveMatches = allMatches.flatMap((x) => {
    const s = x.m.status === "pending" ? live[x.m.id] : undefined;
    return s ? [{ ...x, s }] : [];
  });
  if (liveMatches.length > 0) {
    const shown = liveMatches.slice(0, 4);
    screens.push({
      key: "live",
      label: "Đang đấu",
      node: (
        <div className={`grid h-full gap-5 ${shown.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${shown.length > 2 ? "grid-rows-2" : ""}`}>
          {shown.map(({ m, group, s }) => {
            return (
              <TvLiveCard
                key={m.id}
                label={group ? `Bảng ${group} · Trận ${m.round}` : STAGE_LABEL[m.stage]}
                a={pairName(players, m.a1, m.a2)}
                b={pairName(players, m.b1, m.b2)}
                scoreA={s.scoreA}
                scoreB={s.scoreB}
                target={s.target}
              />
            );
          })}
        </div>
      ),
    });
  }

  // ── Groups ──
  for (const g of groups) {
    const gPlayers = players.filter((p) => g.playerIds.includes(p.id));
    const standings = computeStandings(gPlayers, g.matches, W, L, TB);
    const done = g.matches.filter((m) => m.status === "completed");
    const pending = g.matches.filter((m) => m.status === "pending");
    const rows = [...done.slice(-4), ...pending.slice(0, Math.max(0, 6 - Math.min(done.length, 4)))];
    screens.push({
      key: `group:${g.id}`,
      label: `Bảng ${g.label}`,
      node: (
        <div className="grid h-full grid-cols-[1.15fr_1fr] gap-5">
          <TvCard title={`Bảng ${g.label} · Xếp hạng`}>
            <TvStandings
              head={["#", "VĐV", "Thắng", "Thua", "Hiệu số", "Điểm"]}
              advance={config.advancePerGroup}
              rows={standings.map((s) => ({
                id: s.playerId,
                cells: [s.rank, s.name, s.wins, s.losses, s.diff > 0 ? `+${s.diff}` : s.diff, s.pts],
              }))}
            />
          </TvCard>
          <TvCard title={`Kết quả · ${done.length}/${g.matches.length} trận`}>
            {rows.map((m) => {
              const s = live[m.id];
              return (
                <TvMatchRow
                  key={m.id}
                  meta={`Trận ${m.round}`}
                  a={pairName(players, m.a1, m.a2)}
                  b={pairName(players, m.b1, m.b2)}
                  scoreA={m.status === "completed" ? m.scoreA : (s?.scoreA ?? 0)}
                  scoreB={m.status === "completed" ? m.scoreB : (s?.scoreB ?? 0)}
                  done={m.status === "completed"}
                  live={!!s}
                  fresh={recent.has(m.id)}
                />
              );
            })}
          </TvCard>
        </div>
      ),
    });
  }

  // ── Knockout ──
  if (stage === "knockout" || stage === "done") {
    const cols = (["r16", "quarterfinal", "semifinal"] as const)
      .map((st) => ({ st, ms: knockoutMatches.filter((m) => m.stage === st) }))
      .filter((c) => c.ms.length > 0);
    const finals = knockoutMatches.filter((m) => m.stage === "final" || m.stage === "third");
    const columns: { st: PicMatch["stage"]; ms: PicMatch[] }[] = [
      ...cols,
      ...(finals.length ? [{ st: "final" as const, ms: finals }] : []),
    ];
    screens.push({
      key: "ko",
      label: "Trung kết",
      node: (
        <div className="grid h-full gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}>
          {columns.map((c) => (
            <TvCard key={c.st} title={c.st === "final" ? "Chung kết" : STAGE_LABEL[c.st]}>
              {c.ms.map((m) => {
                const s = live[m.id];
                return (
                  <TvMatchRow
                    key={m.id}
                    meta={c.st === "final" ? (m.stage === "third" ? "Hạng 3" : "CK") : undefined}
                    a={pairName(players, m.a1, m.a2)}
                    b={pairName(players, m.b1, m.b2)}
                    scoreA={m.status === "completed" ? m.scoreA : (s?.scoreA ?? 0)}
                    scoreB={m.status === "completed" ? m.scoreB : (s?.scoreB ?? 0)}
                    done={m.status === "completed"}
                    live={!!s}
                    fresh={recent.has(m.id)}
                    size={columns.length <= 2 ? "lg" : "md"}
                  />
                );
              })}
            </TvCard>
          ))}
        </div>
      ),
    });
  }

  // ── Podium ──
  const finalMatch = knockoutMatches.find((m) => m.stage === "final");
  if (finalMatch && finalMatch.status === "completed") {
    const aWon = finalMatch.scoreA > finalMatch.scoreB;
    const champs = aWon ? [finalMatch.a1, finalMatch.a2] : [finalMatch.b1, finalMatch.b2];
    const runners = aWon ? [finalMatch.b1, finalMatch.b2] : [finalMatch.a1, finalMatch.a2];
    const third = knockoutMatches.find((m) => m.stage === "third");
    const thirds =
      third && third.status === "completed"
        ? third.scoreA > third.scoreB
          ? [third.a1, third.a2]
          : [third.b1, third.b2]
        : null;
    screens.push({
      key: "podium",
      label: "Kết quả",
      node: (
        <div className="flex h-full flex-col items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold uppercase tracking-[0.3em] text-yellow-400">🏆 Vô địch</p>
            <p className="mt-3 text-[64px] font-black leading-tight">{pairName(players, ...champs)}</p>
            <p className="mt-2 text-2xl text-zinc-400">
              Chung kết {finalMatch.scoreA} – {finalMatch.scoreB}
            </p>
          </div>
          <div className="flex gap-16 text-center">
            <div>
              <p className="text-lg font-bold uppercase tracking-widest text-zinc-400">🥈 Á quân</p>
              <p className="mt-1 text-3xl font-bold">{pairName(players, ...runners)}</p>
            </div>
            {thirds && (
              <div>
                <p className="text-lg font-bold uppercase tracking-widest text-amber-600">🥉 Hạng 3</p>
                <p className="mt-1 text-3xl font-bold">{pairName(players, ...thirds)}</p>
              </div>
            )}
          </div>
        </div>
      ),
    });
  }

  if (stage === "draw") {
    screens.unshift({
      key: "draw",
      label: "Bốc thăm",
      node: (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-6xl">🎲</p>
          <p className="mt-6 text-4xl font-black">Vòng bảng đã kết thúc</p>
          <p className="mt-3 text-2xl text-zinc-400">Đang bốc thăm nhánh trung kết — vui lòng chờ</p>
        </div>
      ),
    });
  }

  const subtitle =
    stage === "group"
      ? `PIC xoay cặp · Vòng bảng · ${groups.length} bảng · ${players.length} VĐV`
      : stage === "draw"
        ? "PIC xoay cặp · Chờ bốc thăm"
        : stage === "knockout"
          ? "PIC xoay cặp · Vòng trung kết"
          : "PIC xoay cặp · Đã kết thúc";

  return (
    <TvShell
      title={config.name}
      subtitle={subtitle}
      screens={screens}
      conn={conn}
      updatedAt={updatedAt}
      banner={bannerNode}
    />
  );
}
