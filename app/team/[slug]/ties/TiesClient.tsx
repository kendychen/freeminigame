"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, ChevronDown, Link2, MoreHorizontal, Pencil, Trophy, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  getTeamRefereeToken, reopenTeamRubber, scoreTeamRubber,
  setRubberWalkover, setTieLineup, setTieWinner,
} from "@/app/actions/team";
import { computeTeamStandings } from "@/lib/team/standings";
import { CATEGORY_LABELS } from "@/lib/team/types";
import type {
  DbTeamPlayer, DbTeamRubber, DbTeamSquad, DbTeamTie, RubberCategory, TeamEventFull,
} from "@/lib/team/types";
import type { LineupSlots } from "@/lib/team/validate";
import { translateError } from "@/lib/error-messages";
import LineupSheet from "./LineupSheet";

// ── helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<RubberCategory, string> = {
  MD: "bg-blue-500/15 text-blue-600",
  WD: "bg-pink-500/15 text-pink-600",
  XD: "bg-purple-500/15 text-purple-600",
  FD: "bg-slate-500/15 text-slate-600",
};

function CategoryBadge({ category }: { category: RubberCategory }) {
  return (
    <span className={`flex h-5 w-8 shrink-0 items-center justify-center rounded text-[10px] font-bold ${CATEGORY_STYLES[category]}`}>
      {category}
    </span>
  );
}

function diffClass(v: number) {
  return v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-muted-foreground";
}

function fmtDiff(v: number) {
  return `${v > 0 ? "+" : ""}${v}`;
}

// ── ScoreEditor: 2 inputs + nút tắt điểm đích + armed-confirm 2 chạm ───────────

function ScoreEditor({
  initialA, initialB, squadAName, squadBName, targetPoints, pending, onSave, onCancel,
}: {
  initialA: number;
  initialB: number;
  squadAName: string;
  squadBName: string;
  targetPoints: number;
  pending: boolean;
  onSave: (scoreA: number, scoreB: number) => void;
  onCancel: () => void;
}) {
  const [draftA, setDraftA] = useState(String(initialA));
  const [draftB, setDraftB] = useState(String(initialB));
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const a = Math.max(0, Math.min(99, parseInt(draftA) || 0));
  const b = Math.max(0, Math.min(99, parseInt(draftB) || 0));

  const save = () => {
    if (a === b) {
      toast({ title: "Điểm bằng nhau", description: "Nội dung đôi phải có bên thắng.", variant: "destructive" });
      return;
    }
    if (!armed) {
      setArmed(true);
      toast({ title: "Bấm lần nữa để xác nhận", description: `${squadAName} ${a} – ${b} ${squadBName}` });
      return;
    }
    setArmed(false);
    onSave(a, b);
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-background p-2.5">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[11px] font-medium text-muted-foreground">{squadAName}</p>
          <div className="flex gap-1">
            <input
              type="number" inputMode="numeric" min={0} max={99} value={draftA}
              onChange={(e) => setDraftA(e.target.value)}
              className="w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
            <button
              onClick={() => setDraftA(String(targetPoints))}
              className={`shrink-0 rounded-md border px-2 py-1 font-mono text-xs font-bold transition-colors ${
                a === targetPoints ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/50"
              }`}
            >
              {targetPoints}
            </button>
          </div>
        </div>
        <span className="pb-2 font-bold text-muted-foreground">–</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-right text-[11px] font-medium text-muted-foreground">{squadBName}</p>
          <div className="flex gap-1">
            <button
              onClick={() => setDraftB(String(targetPoints))}
              className={`shrink-0 rounded-md border px-2 py-1 font-mono text-xs font-bold transition-colors ${
                b === targetPoints ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/50"
              }`}
            >
              {targetPoints}
            </button>
            <input
              type="number" inputMode="numeric" min={0} max={99} value={draftB}
              onChange={(e) => setDraftB(e.target.value)}
              className="w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-9 flex-1" onClick={onCancel} disabled={pending}>
          <X className="size-4" />Hủy
        </Button>
        <button
          onClick={save}
          disabled={pending}
          className={`h-9 flex-1 rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-40 ${
            armed ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
          }`}
        >
          {armed ? "Xác nhận?" : "Lưu tỉ số"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Bấm {targetPoints} để điền nhanh điểm đội thắng — chỉ cần gõ điểm đội thua.
      </p>
    </div>
  );
}

// ── RubberMenu: menu ⋯ owner-only (walkover / hủy / mở lại) ────────────────────

function RubberMenu({
  status, squadAName, squadBName, pending, onWalkover, onReopen,
}: {
  status: DbTeamRubber["status"];
  squadAName: string;
  squadBName: string;
  pending: boolean;
  onWalkover: (winner: "a" | "b" | null) => void;
  onReopen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [armedKey, setArmedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!armedKey) return;
    const t = setTimeout(() => setArmedKey(null), 4000);
    return () => clearTimeout(t);
  }, [armedKey]);

  const fire = (key: string, action: () => void) => {
    if (armedKey !== key) { setArmedKey(key); return; }
    setArmedKey(null);
    setOpen(false);
    action();
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => { setOpen((v) => !v); setArmedKey(null); }}
        disabled={pending}
        className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setArmedKey(null); }} />
          <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border bg-background p-1 shadow-lg">
            {status === "pending" ? (
              <>
                <button
                  onClick={() => fire("a", () => onWalkover("a"))}
                  className={`w-full truncate rounded px-2.5 py-2 text-left text-xs hover:bg-accent ${armedKey === "a" ? "font-semibold text-destructive" : ""}`}
                >
                  {armedKey === "a" ? "Xác nhận xử thắng?" : `Xử thắng ${squadAName} (bỏ cuộc)`}
                </button>
                <button
                  onClick={() => fire("b", () => onWalkover("b"))}
                  className={`w-full truncate rounded px-2.5 py-2 text-left text-xs hover:bg-accent ${armedKey === "b" ? "font-semibold text-destructive" : ""}`}
                >
                  {armedKey === "b" ? "Xác nhận xử thắng?" : `Xử thắng ${squadBName} (bỏ cuộc)`}
                </button>
                <button
                  onClick={() => fire("cancel", () => onWalkover(null))}
                  className={`w-full rounded px-2.5 py-2 text-left text-xs hover:bg-accent ${armedKey === "cancel" ? "font-semibold text-destructive" : "text-destructive"}`}
                >
                  {armedKey === "cancel" ? "Xác nhận hủy?" : "Hủy nội dung"}
                </button>
              </>
            ) : (
              <button
                onClick={() => { setOpen(false); onReopen(); }}
                className="w-full rounded px-2.5 py-2 text-left text-xs hover:bg-accent"
              >
                Mở lại
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── RubberRow ──────────────────────────────────────────────────────────────────

function RubberRow({
  rubber, label, lineup, squadAName, squadBName, targetPoints, pending,
  onOpenLineup, onScore, onWalkover, onReopen,
}: {
  rubber: DbTeamRubber;
  label: string;
  lineup: string | null;
  squadAName: string;
  squadBName: string;
  targetPoints: number;
  pending: boolean;
  onOpenLineup: () => void;
  onScore: (scoreA: number, scoreB: number) => void;
  onWalkover: (winner: "a" | "b" | null) => void;
  onReopen: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const isPending = rubber.status === "pending";
  const isDone = rubber.status === "completed";
  const isWo = rubber.status === "walkover";

  return (
    <div className="space-y-2 rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-2">
        <CategoryBadge category={rubber.category} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{label}</span>
        {isDone && (
          <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 font-mono text-sm font-bold tabular-nums">
            {rubber.score_a}–{rubber.score_b}
          </span>
        )}
        {isWo && rubber.walkover_winner && (
          <span className="max-w-40 shrink-0 truncate rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
            W.O. · {rubber.walkover_winner === "a" ? squadAName : squadBName} thắng
          </span>
        )}
        {isWo && !rubber.walkover_winner && (
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            Đã hủy
          </span>
        )}
        <RubberMenu
          status={rubber.status}
          squadAName={squadAName}
          squadBName={squadBName}
          pending={pending}
          onWalkover={onWalkover}
          onReopen={onReopen}
        />
      </div>
      {lineup ? (
        <p className="truncate text-xs text-muted-foreground">{lineup}</p>
      ) : (
        <p className="text-xs italic text-muted-foreground/60">Chưa xếp đội hình</p>
      )}
      {editing ? (
        <ScoreEditor
          initialA={rubber.score_a}
          initialB={rubber.score_b}
          squadAName={squadAName}
          squadBName={squadBName}
          targetPoints={targetPoints}
          pending={pending}
          onSave={(a, b) => { onScore(a, b); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        (isPending || isDone) && (
          <div className="flex gap-2">
            {isPending && (
              <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={onOpenLineup} disabled={pending}>
                <Users className="size-3.5" />Xếp đội hình
              </Button>
            )}
            {isPending && (
              <Button size="sm" className="h-8 flex-1 text-xs" onClick={() => setEditing(true)} disabled={pending}>
                <Pencil className="size-3.5" />Tỉ số
              </Button>
            )}
            {isDone && (
              <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => setEditing(true)} disabled={pending}>
                <Pencil className="size-3.5" />Sửa tỉ số
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}

// ── TieCard ────────────────────────────────────────────────────────────────────

function TieCard({
  tie, rubbers, squadAName, squadBName, players, targetPoints, refToken, pending,
  expanded, onToggle, onOpenLineup, onScore, onWalkover, onReopen, onDecide,
}: {
  tie: DbTeamTie;
  rubbers: DbTeamRubber[];
  squadAName: string;
  squadBName: string;
  players: DbTeamPlayer[];
  targetPoints: number;
  refToken: string | null;
  pending: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenLineup: (rubber: DbTeamRubber) => void;
  onScore: (rubberId: string, scoreA: number, scoreB: number) => void;
  onWalkover: (rubberId: string, winner: "a" | "b" | null) => void;
  onReopen: (rubberId: string) => void;
  onDecide: (winner: "a" | "b") => void;
}) {
  const [copied, setCopied] = useState(false);
  const [armedWinner, setArmedWinner] = useState<"a" | "b" | null>(null);

  useEffect(() => {
    if (!armedWinner) return;
    const t = setTimeout(() => setArmedWinner(null), 4000);
    return () => clearTimeout(t);
  }, [armedWinner]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const pendingCount = rubbers.filter((r) => r.status === "pending").length;
  const done = tie.status === "completed";
  const needsDecision = !done && rubbers.length > 0 && pendingCount === 0 && !tie.winner_squad_id;
  const aWon = done && !!tie.squad_a_id && tie.winner_squad_id === tie.squad_a_id;
  const bWon = done && !!tie.squad_b_id && tie.winner_squad_id === tie.squad_b_id;

  const labels = useMemo(() => {
    const totals: Partial<Record<RubberCategory, number>> = {};
    for (const r of rubbers) totals[r.category] = (totals[r.category] ?? 0) + 1;
    const counts: Partial<Record<RubberCategory, number>> = {};
    const m = new Map<string, string>();
    for (const r of rubbers) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
      m.set(
        r.id,
        (totals[r.category] ?? 0) > 1
          ? `${CATEGORY_LABELS[r.category]} #${counts[r.category]}`
          : CATEGORY_LABELS[r.category],
      );
    }
    return m;
  }, [rubbers]);

  const lineupText = (r: DbTeamRubber): string | null => {
    const nm = (id: string | null) => (id ? playerById.get(id)?.name ?? "?" : null);
    const sideA = [nm(r.a1_id), nm(r.a2_id)].filter(Boolean).join(" + ");
    const sideB = [nm(r.b1_id), nm(r.b2_id)].filter(Boolean).join(" + ");
    if (!sideA && !sideB) return null;
    return `${sideA || "?"} vs ${sideB || "?"}`;
  };

  const copyRef = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!refToken) return;
    const url = `${window.location.origin}/team/r/${refToken}?t=${tie.id}`;
    navigator.clipboard.writeText(url).catch(() => prompt("Copy link:", url));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const decide = (w: "a" | "b") => {
    if (armedWinner !== w) { setArmedWinner(w); return; }
    setArmedWinner(null);
    onDecide(w);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-3 text-left">
        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${aWon ? "text-primary" : ""}`}>
          {squadAName}
          {aWon && <Trophy className="ml-1 inline size-3.5 text-primary" />}
        </span>
        <span className="shrink-0 rounded-lg border px-2 py-1 font-mono text-sm font-bold tabular-nums">
          {tie.rubbers_won_a} – {tie.rubbers_won_b}
        </span>
        <span className={`min-w-0 flex-1 truncate text-right text-sm font-semibold ${bWon ? "text-primary" : "text-muted-foreground"}`}>
          {bWon && <Trophy className="mr-1 inline size-3.5 text-primary" />}
          {squadBName}
        </span>
        {done ? (
          <span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600">
            Xong
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {tie.rubbers_won_a}–{tie.rubbers_won_b} · còn {pendingCount}
          </span>
        )}
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-2 border-t bg-muted/20 p-2.5">
          {refToken && (
            <button
              onClick={copyRef}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-blue-500/60 hover:text-blue-500"
            >
              {copied
                ? <><Check className="size-3.5 text-green-500" />Đã copy link trọng tài trận này</>
                : <><Link2 className="size-3.5" />Link trọng tài trận này</>}
            </button>
          )}

          {rubbers.map((r) => (
            <RubberRow
              key={r.id}
              rubber={r}
              label={labels.get(r.id) ?? CATEGORY_LABELS[r.category]}
              lineup={lineupText(r)}
              squadAName={squadAName}
              squadBName={squadBName}
              targetPoints={targetPoints}
              pending={pending}
              onOpenLineup={() => onOpenLineup(r)}
              onScore={(a, b) => onScore(r.id, a, b)}
              onWalkover={(w) => onWalkover(r.id, w)}
              onReopen={() => onReopen(r.id)}
            />
          ))}

          {needsDecision && (
            <div className="space-y-2 rounded-lg border border-amber-400/40 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-600">
                Hòa cả trận nhỏ lẫn hiệu số điểm — phân định đội thắng:
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-8 flex-1 text-xs ${armedWinner === "a" ? "border-destructive text-destructive" : ""}`}
                  onClick={() => decide("a")}
                  disabled={pending}
                >
                  {armedWinner === "a" ? "Xác nhận?" : `${squadAName} thắng`}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-8 flex-1 text-xs ${armedWinner === "b" ? "border-destructive text-destructive" : ""}`}
                  onClick={() => decide("b")}
                  disabled={pending}
                >
                  {armedWinner === "b" ? "Xác nhận?" : `${squadBName} thắng`}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── StandingsTable: Đội / Trận / Thắng-Thua / HS trận nhỏ / HS điểm ────────────

function StandingsTable({
  label, squads, ties, rubbers,
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
              <th className="px-2 py-2 text-left sm:px-3">#</th>
              <th className="px-2 py-2 text-left sm:px-3">Đội</th>
              <th className="px-2 py-2 text-center sm:px-3">Trận</th>
              <th className="px-2 py-2 text-center sm:px-3">Thắng-Thua</th>
              <th className="px-2 py-2 text-center sm:px-3">HS trận nhỏ</th>
              <th className="px-2 py-2 text-center sm:px-3">HS điểm</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.squadId} className="border-b last:border-0">
                <td className="px-2 py-2.5 sm:px-3">
                  <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "bg-yellow-400/20 text-yellow-600" :
                    i === 1 ? "bg-slate-300/20 text-slate-500" : "bg-muted text-muted-foreground"
                  }`}>{s.rank}</span>
                </td>
                <td className="break-words px-2 py-2.5 font-medium sm:px-3">{s.name}</td>
                <td className="px-2 py-2.5 text-center font-mono sm:px-3">{s.played}</td>
                <td className="px-2 py-2.5 text-center font-mono font-semibold sm:px-3">
                  {s.tiesWon}-{s.tiesLost}
                </td>
                <td className={`px-2 py-2.5 text-center font-mono font-semibold sm:px-3 ${diffClass(s.rubberDiff)}`}>
                  {fmtDiff(s.rubberDiff)}
                </td>
                <td className={`px-2 py-2.5 text-center font-mono font-semibold sm:px-3 ${diffClass(s.pointDiff)}`}>
                  {fmtDiff(s.pointDiff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main client ────────────────────────────────────────────────────────────────

export default function TiesClient({ state }: { state: TeamEventFull }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { event, squads, players, ties, rubbers } = state;
  const eventId = event.id;
  const config = event.config;

  const [refToken, setRefToken] = useState<string | null>(state.refereeToken);
  const [activeTab, setActiveTab] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [lineupTarget, setLineupTarget] = useState<{ tie: DbTeamTie; rubber: DbTeamRubber } | null>(null);

  useEffect(() => {
    if (refToken) return;
    getTeamRefereeToken(eventId).then((res) => {
      if ("token" in res) setRefToken(res.token);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const squadById = useMemo(() => new Map(squads.map((s) => [s.id, s])), [squads]);

  const rubbersByTie = useMemo(() => {
    const m = new Map<string, DbTeamRubber[]>();
    for (const r of rubbers) {
      const list = m.get(r.tie_id);
      if (list) list.push(r);
      else m.set(r.tie_id, [r]);
    }
    for (const list of m.values()) list.sort((a, b) => a.rubber_no - b.rubber_no);
    return m;
  }, [rubbers]);

  const groupLabels = useMemo(
    () => [...new Set(ties.map((t) => t.group_label).filter((l): l is string => !!l))].sort(),
    [ties],
  );
  const multiGroup = groupLabels.length > 1;
  const effTab =
    activeTab === "BXH" || groupLabels.includes(activeTab) ? activeTab : (groupLabels[0] ?? "BXH");

  const doneTies = ties.filter((t) => t.status === "completed").length;

  const fail = (error: string) =>
    toast({ title: "Lỗi", description: translateError(error), variant: "destructive" });

  const toggleTie = (tieId: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tieId)) next.delete(tieId);
      else next.add(tieId);
      return next;
    });

  const saveLineup = (tieId: string, rubberId: string, slots: LineupSlots) => {
    startTransition(async () => {
      const res = await setTieLineup(eventId, tieId, [{ rubberId, ...slots }]);
      if ("error" in res) { fail(res.error); return; }
      setLineupTarget(null);
      toast({ title: "Đã lưu đội hình" });
      router.refresh();
    });
  };

  const scoreRubber = (rubberId: string, scoreA: number, scoreB: number) => {
    startTransition(async () => {
      const res = await scoreTeamRubber({ eventId, rubberId, scoreA, scoreB });
      if ("error" in res) { fail(res.error); return; }
      router.refresh();
    });
  };

  const walkoverRubber = (rubberId: string, winner: "a" | "b" | null) => {
    startTransition(async () => {
      const res = await setRubberWalkover({ eventId, rubberId, winner });
      if ("error" in res) { fail(res.error); return; }
      toast({ title: winner ? "Đã xử thắng" : "Đã hủy nội dung" });
      router.refresh();
    });
  };

  const reopenRubber = (rubberId: string) => {
    startTransition(async () => {
      const res = await reopenTeamRubber({ eventId, rubberId });
      if ("error" in res) { fail(res.error); return; }
      toast({ title: "Đã mở lại nội dung" });
      router.refresh();
    });
  };

  const decideTie = (tieId: string, winner: "a" | "b") => {
    startTransition(async () => {
      const res = await setTieWinner({ eventId, tieId, winner });
      if ("error" in res) { fail(res.error); return; }
      toast({ title: "Đã phân định đội thắng" });
      router.refresh();
    });
  };

  if (ties.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm font-medium">Chưa có lịch thi đấu</p>
        <p className="text-xs text-muted-foreground">
          Thêm đội & VĐV rồi bấm &quot;Tạo lịch thi đấu&quot; để bắt đầu.
        </p>
        <Button asChild variant="outline">
          <Link href={`/team/${event.slug}/squads`}>Đến Đội &amp; VĐV</Link>
        </Button>
      </div>
    );
  }

  const tabs: { id: string; label: string }[] = [
    ...(multiGroup
      ? groupLabels.map((l) => ({ id: l, label: `Bảng ${l}` }))
      : [{ id: groupLabels[0] ?? "", label: "Trận đấu" }]),
    { id: "BXH", label: "BXH" },
  ];

  const activeTies = ties.filter((t) => t.group_label === effTab);
  const rounds = [...new Set(activeTies.map((t) => t.round))].sort((a, b) => a - b);

  const renderTie = (tie: DbTeamTie) => (
    <TieCard
      key={tie.id}
      tie={tie}
      rubbers={rubbersByTie.get(tie.id) ?? []}
      squadAName={tie.squad_a_id ? squadById.get(tie.squad_a_id)?.name ?? "?" : "—"}
      squadBName={tie.squad_b_id ? squadById.get(tie.squad_b_id)?.name ?? "?" : "—"}
      players={players}
      targetPoints={config.targetPoints}
      refToken={refToken}
      pending={pending}
      expanded={expandedIds.has(tie.id)}
      onToggle={() => toggleTie(tie.id)}
      onOpenLineup={(rubber) => setLineupTarget({ tie, rubber })}
      onScore={scoreRubber}
      onWalkover={walkoverRubber}
      onReopen={reopenRubber}
      onDecide={(winner) => decideTie(tie.id, winner)}
    />
  );

  return (
    <div className="space-y-3">
      {event.stage === "done" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
          <Trophy className="mx-auto mb-1 size-5 text-primary" />
          <p className="text-sm font-bold">Giải đấu đã hoàn thành!</p>
          <p className="text-xs text-muted-foreground">Xem kết quả chung cuộc ở tab BXH.</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {doneTies}/{ties.length} trận đối đầu · mỗi nội dung chạm {config.targetPoints} điểm
      </p>

      <div className="flex overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
              effTab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {effTab === "BXH" ? (
        <div className="space-y-4">
          {groupLabels.map((label) => (
            <StandingsTable
              key={label}
              label={multiGroup ? label : null}
              squads={squads.filter((s) => s.group_label === label)}
              ties={ties.filter((t) => t.group_label === label)}
              rubbers={rubbers}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((rd) => (
            <div key={rd} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vòng {rd}
              </h2>
              {activeTies.filter((t) => t.round === rd).map(renderTie)}
            </div>
          ))}
        </div>
      )}

      {lineupTarget && (
        <LineupSheet
          rubber={lineupTarget.rubber}
          tie={lineupTarget.tie}
          tieRubbers={rubbersByTie.get(lineupTarget.tie.id) ?? []}
          players={players}
          squadAName={
            lineupTarget.tie.squad_a_id
              ? squadById.get(lineupTarget.tie.squad_a_id)?.name ?? "?"
              : "—"
          }
          squadBName={
            lineupTarget.tie.squad_b_id
              ? squadById.get(lineupTarget.tie.squad_b_id)?.name ?? "?"
              : "—"
          }
          allowRepeatPlayer={config.allowRepeatPlayer}
          pending={pending}
          onSave={(slots) => saveLineup(lineupTarget.tie.id, lineupTarget.rubber.id, slots)}
          onClose={() => setLineupTarget(null)}
        />
      )}
    </div>
  );
}
