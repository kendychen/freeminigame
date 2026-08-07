"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { loadTeamEventState } from "@/app/actions/team";
import { computeTeamStandings } from "@/lib/team/standings";
import { CATEGORY_LABELS } from "@/lib/team/types";
import type {
  DbTeamPlayer,
  DbTeamRubber,
  DbTeamSquad,
  DbTeamTie,
  RubberCategory,
  TeamEventFull,
} from "@/lib/team/types";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { PickleballLogo } from "@/components/brand/PickleballLogo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const CATEGORY_BADGE: Record<RubberCategory, string> = {
  MD: "bg-blue-500/15 text-blue-600",
  WD: "bg-pink-500/15 text-pink-600",
  XD: "bg-purple-500/15 text-purple-600",
  FD: "bg-muted text-muted-foreground",
};

function rubberLabel(rubbers: DbTeamRubber[], rubber: DbTeamRubber): string {
  const sameCat = rubbers.filter((r) => r.category === rubber.category);
  const base = CATEGORY_LABELS[rubber.category];
  if (sameCat.length <= 1) return base;
  return `${base} #${sameCat.findIndex((r) => r.id === rubber.id) + 1}`;
}

function sideNames(
  players: DbTeamPlayer[],
  id1: string | null,
  id2: string | null,
): string | null {
  const names = [id1, id2]
    .filter((id): id is string => !!id)
    .map((id) => players.find((p) => p.id === id)?.name ?? "?");
  return names.length ? names.join(" + ") : null;
}

function StandingsTable({
  label,
  squads,
  ties,
  rubbers,
}: {
  label: string | null;
  squads: DbTeamSquad[];
  ties: DbTeamTie[];
  rubbers: DbTeamRubber[];
}) {
  const standings = computeTeamStandings(squads, ties, rubbers);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-bold text-primary">
        {label ? `Bảng ${label}` : "Bảng xếp hạng"}
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Đội</th>
            <th className="px-3 py-2 text-center">Trận</th>
            <th className="px-3 py-2 text-center">T-B</th>
            <th className="px-3 py-2 text-center">HS trận</th>
            <th className="px-3 py-2 text-center">HS điểm</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.squadId} className="border-b last:border-0">
              <td className="px-3 py-2.5">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0
                      ? "bg-yellow-400/20 text-yellow-600"
                      : i === 1
                        ? "bg-slate-300/20 text-slate-500"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.rank}
                </span>
              </td>
              <td className="px-3 py-2.5 font-medium">{s.name}</td>
              <td className="px-3 py-2.5 text-center font-mono">{s.played}</td>
              <td className="px-3 py-2.5 text-center font-mono font-bold text-primary">
                {s.tiesWon}-{s.tiesLost}
              </td>
              <td
                className={`px-3 py-2.5 text-center font-mono font-semibold ${
                  s.rubberDiff > 0
                    ? "text-green-600"
                    : s.rubberDiff < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                {s.rubberDiff > 0 ? "+" : ""}
                {s.rubberDiff}
              </td>
              <td
                className={`px-3 py-2.5 text-center font-mono font-semibold ${
                  s.pointDiff > 0
                    ? "text-green-600"
                    : s.pointDiff < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                {s.pointDiff > 0 ? "+" : ""}
                {s.pointDiff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function RubberRow({
  rubber,
  label,
  players,
  nameA,
  nameB,
}: {
  rubber: DbTeamRubber;
  label: string;
  players: DbTeamPlayer[];
  nameA: string;
  nameB: string;
}) {
  const lineupA = sideNames(players, rubber.a1_id, rubber.a2_id);
  const lineupB = sideNames(players, rubber.b1_id, rubber.b2_id);
  const isDone = rubber.status === "completed";
  const isWo = rubber.status === "walkover";
  const aWon =
    (isDone && rubber.score_a > rubber.score_b) || (isWo && rubber.walkover_winner === "a");
  const bWon =
    (isDone && rubber.score_b > rubber.score_a) || (isWo && rubber.walkover_winner === "b");

  return (
    <div className="border-b px-3 py-2 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${CATEGORY_BADGE[rubber.category]}`}
        >
          {rubber.category}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{label}</span>
        {isWo ? (
          rubber.walkover_winner ? (
            <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
              W.O.
            </span>
          ) : (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Đã hủy
            </span>
          )
        ) : (
          <span
            className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
              isDone ? "" : "text-muted-foreground"
            }`}
          >
            {isDone ? `${rubber.score_a} – ${rubber.score_b}` : "–"}
          </span>
        )}
      </div>
      {lineupA || lineupB ? (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className={`min-w-0 flex-1 truncate ${aWon ? "font-semibold" : "text-muted-foreground"}`}>
            {lineupA ?? "Chưa xếp"}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">vs</span>
          <span
            className={`min-w-0 flex-1 truncate text-right ${bWon ? "font-semibold" : "text-muted-foreground"}`}
          >
            {lineupB ?? "Chưa xếp"}
          </span>
        </div>
      ) : isWo && rubber.walkover_winner ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Xử thắng {rubber.walkover_winner === "a" ? nameA : nameB}
        </p>
      ) : (
        <p className="mt-1 text-xs italic text-muted-foreground/70">Chưa xếp đội hình</p>
      )}
    </div>
  );
}

function TieCard({
  tie,
  rubbers,
  squads,
  players,
  expanded,
  onToggle,
}: {
  tie: DbTeamTie;
  rubbers: DbTeamRubber[];
  squads: DbTeamSquad[];
  players: DbTeamPlayer[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const nameA = squads.find((s) => s.id === tie.squad_a_id)?.name ?? "?";
  const nameB = squads.find((s) => s.id === tie.squad_b_id)?.name ?? "?";
  const pending = rubbers.filter((r) => r.status === "pending").length;
  const isDone = tie.status === "completed";
  const aWon = isDone && !!tie.squad_a_id && tie.winner_squad_id === tie.squad_a_id;
  const bWon = isDone && !!tie.squad_b_id && tie.winner_squad_id === tie.squad_b_id;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          V{tie.round}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${aWon ? "font-bold text-primary" : "font-medium"}`}
        >
          {nameA}
        </span>
        <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 font-mono text-sm font-bold tabular-nums">
          {tie.rubbers_won_a} – {tie.rubbers_won_b}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-right text-sm ${bWon ? "font-bold text-primary" : "font-medium"}`}
        >
          {nameB}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        {isDone
          ? "Kết thúc"
          : pending < rubbers.length
            ? `${tie.rubbers_won_a}–${tie.rubbers_won_b} · còn ${pending}`
            : `Chưa đấu · ${rubbers.length} nội dung`}
      </div>
      {expanded && (
        <div className="border-t">
          {rubbers.map((r) => (
            <RubberRow
              key={r.id}
              rubber={r}
              label={rubberLabel(rubbers, r)}
              players={players}
              nameA={nameA}
              nameB={nameB}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamViewerClient({ state }: { state: TeamEventFull }) {
  const { event, squads, players } = state;
  const [live, setLive] = useState<{ ties: DbTeamTie[]; rubbers: DbTeamRubber[] }>({
    ties: state.ties,
    rubbers: state.rubbers,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLive({ ties: state.ties, rubbers: state.rubbers });
  }, [state]);

  useEffect(() => {
    let active = true;
    let pollHandle: ReturnType<typeof setInterval> | undefined;
    const sb = getSupabaseBrowser();

    const refresh = async () => {
      const next = await loadTeamEventState(event.slug);
      if (next && active) setLive({ ties: next.ties, rubbers: next.rubbers });
    };

    const channel = sb.channel(`team:${event.id}`);
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "team_rubbers", filter: `event_id=eq.${event.id}` },
      (payload: { new: DbTeamRubber }) => {
        if (!active) return;
        setLive((prev) => ({
          ...prev,
          rubbers: prev.rubbers.map((r) => (r.id === payload.new.id ? payload.new : r)),
        }));
      },
    );
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "team_ties", filter: `event_id=eq.${event.id}` },
      (payload: { new: DbTeamTie }) => {
        if (!active) return;
        setLive((prev) => ({
          ...prev,
          ties: prev.ties.map((t) => (t.id === payload.new.id ? payload.new : t)),
        }));
      },
    );
    channel.subscribe((status: string) => {
      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !pollHandle) {
        pollHandle = setInterval(() => void refresh(), 3000);
      }
    });

    return () => {
      active = false;
      if (pollHandle) clearInterval(pollHandle);
      void sb.removeChannel(channel);
    };
  }, [event.id, event.slug]);

  const { ties, rubbers } = live;

  const rubbersByTie = useMemo(() => {
    const m = new Map<string, DbTeamRubber[]>();
    for (const r of rubbers) {
      const arr = m.get(r.tie_id) ?? [];
      arr.push(r);
      m.set(r.tie_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.rubber_no - b.rubber_no);
    return m;
  }, [rubbers]);

  const groupLabels = useMemo(() => {
    const set = new Set<string>();
    for (const t of ties) if (t.group_label) set.add(t.group_label);
    return Array.from(set).sort();
  }, [ties]);
  const sections: (string | null)[] = groupLabels.length > 0 ? groupLabels : [null];

  const doneTies = ties.filter((t) => t.status === "completed").length;
  const isDone = ties.length > 0 && doneTies === ties.length;
  const stageLabel = ties.length === 0 ? "Đang chuẩn bị" : isDone ? "Kết thúc" : "Vòng bảng";

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
          <h1 className="font-bold text-lg">{event.name}</h1>
          <p className="text-xs text-muted-foreground">
            Giải đồng đội · {stageLabel}
            {ties.length > 0 && (
              <span className="ml-1">· {doneTies}/{ties.length} trận đối đầu</span>
            )}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-5">
        {ties.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có lịch thi đấu — ban tổ chức đang chuẩn bị…
          </div>
        ) : (
          sections.map((label) => {
            const sectionTies = label
              ? ties.filter((t) => t.group_label === label)
              : ties;
            const sectionSquads = label
              ? squads.filter((s) => s.group_label === label)
              : squads;
            return (
              <div key={label ?? "all"} className="space-y-4">
                <StandingsTable
                  label={label}
                  squads={sectionSquads}
                  ties={sectionTies}
                  rubbers={rubbers}
                />
                <div className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Kết quả đối đầu{label ? ` — Bảng ${label}` : ""}
                  </h2>
                  {sectionTies.map((tie) => (
                    <TieCard
                      key={tie.id}
                      tie={tie}
                      rubbers={rubbersByTie.get(tie.id) ?? []}
                      squads={squads}
                      players={players}
                      expanded={expanded.has(tie.id)}
                      onToggle={() => toggle(tie.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
