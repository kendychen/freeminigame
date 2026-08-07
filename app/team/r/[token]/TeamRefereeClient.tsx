"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Trophy, X } from "lucide-react";
import { scoreTeamRubber } from "@/app/actions/team";
import { CATEGORY_LABELS } from "@/lib/team/types";
import type {
  DbTeamPlayer,
  DbTeamRubber,
  RubberCategory,
  TeamEventFull,
} from "@/lib/team/types";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";

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

// ── Score editor: 21–x quick fill + armed 2-tap confirm ────────────────────────

function ScoreEditor({
  rubber,
  target,
  nameA,
  nameB,
  onSave,
  onCancel,
}: {
  rubber: DbTeamRubber;
  target: number;
  nameA: string;
  nameB: string;
  onSave: (scoreA: number, scoreB: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [draftA, setDraftA] = useState(
    rubber.status === "completed" ? String(rubber.score_a) : "",
  );
  const [draftB, setDraftB] = useState(
    rubber.status === "completed" ? String(rubber.score_b) : "",
  );
  const [armed, setArmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const a = Math.max(0, Math.min(99, parseInt(draftA) || 0));
  const b = Math.max(0, Math.min(99, parseInt(draftB) || 0));

  const save = async () => {
    if (a === b) {
      toast({
        title: "Đang hoà",
        description: "Nội dung đôi phải có bên thắng — cần chênh điểm.",
        variant: "destructive",
      });
      return;
    }
    if (!armed) {
      setArmed(true);
      toast({
        title: "Bấm lần nữa để xác nhận",
        description: `${nameA} ${a} – ${b} ${nameB}`,
      });
      return;
    }
    setArmed(false);
    setSaving(true);
    await onSave(a, b);
    setSaving(false);
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-primary/50 bg-background p-2">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setDraftA(String(target))}
          className="rounded-md border px-2 py-1.5 font-mono text-xs font-bold text-muted-foreground hover:border-primary/60 hover:text-primary"
        >
          {target}
        </button>
        <input
          type="number"
          min={0}
          max={99}
          value={draftA}
          onChange={(e) => setDraftA(e.target.value)}
          className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
        />
        <span className="font-bold text-muted-foreground">–</span>
        <input
          type="number"
          min={0}
          max={99}
          value={draftB}
          onChange={(e) => setDraftB(e.target.value)}
          className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
        />
        <button
          type="button"
          onClick={() => setDraftB(String(target))}
          className="rounded-md border px-2 py-1.5 font-mono text-xs font-bold text-muted-foreground hover:border-primary/60 hover:text-primary"
        >
          {target}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`flex h-10 flex-1 items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            armed
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {armed ? "Xác nhận?" : "Lưu tỉ số"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ── Rubber row ─────────────────────────────────────────────────────────────────

function RubberRow({
  rubber,
  label,
  players,
  nameA,
  nameB,
  target,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  rubber: DbTeamRubber;
  label: string;
  players: DbTeamPlayer[];
  nameA: string;
  nameB: string;
  target: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (scoreA: number, scoreB: number) => Promise<void>;
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
    <div className="border-b px-3 py-2.5 last:border-0">
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
        ) : isDone ? (
          <>
            <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 font-mono text-sm font-bold tabular-nums">
              {rubber.score_a}–{rubber.score_b}
            </span>
            {!editing && (
              <button
                type="button"
                onClick={onEdit}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:border-primary/60 hover:text-primary"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </>
        ) : (
          !editing && (
            <button
              type="button"
              onClick={onEdit}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Nhập tỉ số
            </button>
          )
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
      {editing && (
        <ScoreEditor
          rubber={rubber}
          target={target}
          nameA={nameA}
          nameB={nameB}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

// ── Main referee client ────────────────────────────────────────────────────────

export default function TeamRefereeClient({
  state,
  token,
  tieFilter,
}: {
  state: TeamEventFull;
  token: string;
  tieFilter: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { event, squads, players, ties, rubbers } = state;
  const target = event.config.targetPoints ?? 15;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(ties.filter((t) => t.status === "completed" && t.id !== tieFilter).map((t) => t.id)),
  );

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

  const visibleTies = tieFilter ? ties.filter((t) => t.id === tieFilter) : ties;
  const groupLabels = useMemo(() => {
    const set = new Set<string>();
    for (const t of visibleTies) if (t.group_label) set.add(t.group_label);
    return Array.from(set).sort();
  }, [visibleTies]);
  const sections: (string | null)[] = groupLabels.length > 0 ? groupLabels : [null];

  const squadName = (id: string | null) => squads.find((s) => s.id === id)?.name ?? "?";

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSave = (rubberId: string) => async (scoreA: number, scoreB: number) => {
    const res = await scoreTeamRubber({ eventId: event.id, rubberId, scoreA, scoreB, token });
    if ("error" in res) {
      toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      return;
    }
    setEditingId(null);
    toast({ title: "Đã lưu tỉ số" });
    startTransition(() => router.refresh());
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-center px-4">
          <div className="text-center">
            <p className="font-semibold">{event.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {tieFilter ? "Trọng tài trận đối đầu" : "Trọng tài — không cần đăng nhập"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-4">
        {event.stage === "done" && (
          <div className="rounded-xl border bg-primary/5 p-6 text-center">
            <Trophy className="mx-auto mb-2 size-8 text-primary" />
            <p className="font-bold">Giải đấu đã kết thúc</p>
            <p className="mt-1 text-xs text-muted-foreground">Vẫn có thể sửa tỉ số nếu nhập nhầm</p>
          </div>
        )}

        {ties.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có lịch thi đấu — chờ ban tổ chức tạo lịch…
          </div>
        ) : visibleTies.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <p>Trận đối đầu không thuộc giải này</p>
            <Link href={`/team/r/${token}`} className="font-medium text-primary underline">
              Xem tất cả trận
            </Link>
          </div>
        ) : (
          sections.map((label) => (
            <div key={label ?? "all"} className="space-y-2">
              {label && !tieFilter && (
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bảng {label}
                </h2>
              )}
              {(label ? visibleTies.filter((t) => t.group_label === label) : visibleTies).map(
                (tie) => {
                  const tieRubbers = rubbersByTie.get(tie.id) ?? [];
                  const pending = tieRubbers.filter((r) => r.status === "pending").length;
                  const nameA = squadName(tie.squad_a_id);
                  const nameB = squadName(tie.squad_b_id);
                  const expanded = !collapsed.has(tie.id);
                  return (
                    <div key={tie.id} className="overflow-hidden rounded-xl border bg-card">
                      <button
                        type="button"
                        onClick={() => toggle(tie.id)}
                        className="flex w-full items-center gap-2 px-3 py-3 text-left"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          V{tie.round}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{nameA}</span>
                        <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 font-mono text-sm font-bold tabular-nums">
                          {tie.rubbers_won_a} – {tie.rubbers_won_b}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right text-sm font-medium">
                          {nameB}
                        </span>
                        <ChevronDown
                          className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </button>
                      <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                        {tie.status === "completed"
                          ? "Kết thúc"
                          : pending < tieRubbers.length
                            ? `${tie.rubbers_won_a}–${tie.rubbers_won_b} · còn ${pending}`
                            : `Chưa đấu · ${tieRubbers.length} nội dung`}
                      </div>
                      {expanded && (
                        <div className="border-t">
                          {tieRubbers.map((r) => (
                            <RubberRow
                              key={r.id}
                              rubber={r}
                              label={rubberLabel(tieRubbers, r)}
                              players={players}
                              nameA={nameA}
                              nameB={nameB}
                              target={target}
                              editing={editingId === r.id}
                              onEdit={() => setEditingId(r.id)}
                              onCancel={() => setEditingId(null)}
                              onSave={handleSave(r.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          ))
        )}

        {tieFilter && visibleTies.length > 0 && (
          <div className="text-center">
            <Link href={`/team/r/${token}`} className="text-xs font-medium text-primary underline">
              Xem tất cả trận của giải
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
