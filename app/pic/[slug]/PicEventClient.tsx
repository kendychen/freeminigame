"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, Shuffle, CheckCircle2, Check, Pencil, X, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeStandings, type PicMatch, type PicPlayer, type PicGroup } from "@/stores/pic-tournament";
import { scorePicMatch, picDrawKnockout, picAdvanceToDraw, createPicMatchScore, getPicRefereeToken, picDrawFinalPairs } from "@/app/actions/pic";
import { buildDrawPairs, DRAW_MODES, type DrawMode } from "@/lib/pic-draw";
import type { PicEventFull } from "@/app/actions/pic";
import { QuickScoreClient, type QuickScore } from "@/components/score/QuickScoreClient";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// ── helpers ────────────────────────────────────────────────────────────────────

function pairName(p1: PicPlayer | undefined, p2: PicPlayer | undefined) {
  return `${p1?.name ?? "?"} & ${p2?.name ?? "?"}`;
}

// ── AdminMatchScore: QuickScoreClient bridge (no referee token needed) ─────────

function AdminMatchScore({
  match, players, target, eventId, onClose,
}: {
  match: PicMatch; players: PicPlayer[]; target: number;
  eventId: string; onClose: () => void;
}) {
  const router = useRouter();
  const [quickScore, setQuickScore] = useState<QuickScore | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byId = (id: string) => players.find((p) => p.id === id);
  const aName = pairName(byId(match.a1), byId(match.a2));
  const bName = pairName(byId(match.b1), byId(match.b2));
  const stageLabel =
    match.stage === "group" ? `Trận ${match.round}` :
    match.stage === "semifinal" ? "Bán kết" :
    match.stage === "third" ? "Tranh 3–4" : "Chung kết";

  useEffect(() => {
    createPicMatchScore({ teamAName: aName, teamBName: bName, targetPoints: target, title: stageLabel })
      .then((res) => {
        if ("error" in res) { setCreateError(res.error); return; }
        setQuickScore({
          code: res.code,
          team_a_name: aName,
          team_b_name: bName,
          score_a: 0,
          score_b: 0,
          status: "pending",
          winner: null,
          target_points: target,
          title: stageLabel,
          updated_at: new Date().toISOString(),
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!quickScore) return;
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`admin-qs:${quickScore.code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quick_scores", filter: `code=eq.${quickScore.code}` },
        (payload: { new: QuickScore }) => {
          const updated = payload.new;
          if (updated.status === "completed") {
            startTransition(async () => {
              await scorePicMatch({ eventId, matchId: match.id, scoreA: updated.score_a, scoreB: updated.score_b });
              onClose();
              router.refresh();
            });
          }
        },
      )
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickScore?.code]);

  if (createError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-6">
        <div className="space-y-3 text-center">
          <p className="text-destructive">{createError}</p>
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Quay lại</button>
        </div>
      </div>
    );
  }

  if (!quickScore) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="animate-pulse text-sm text-muted-foreground">Đang tạo trận…</p>
      </div>
    );
  }

  return <QuickScoreClient initial={quickScore} onBack={onClose} />;
}

// ── MatchCard ──────────────────────────────────────────────────────────────────

function TierBadge({ cat }: { cat: "A" | "B" | undefined }) {
  if (!cat) return null;
  return (
    <span className={`inline-flex h-3.5 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold ${
      cat === "A" ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"
    }`}>{cat}</span>
  );
}

function SlotTag({ slot }: { slot: string | undefined }) {
  if (!slot) return null;
  return (
    <span className="font-mono text-[10px] font-bold text-muted-foreground/80">{slot}</span>
  );
}

function PairLabel({ id1, id2, players, categories, slots, won, align }: {
  id1: string; id2: string; players: PicPlayer[];
  categories?: Record<string, "A" | "B">;
  slots?: Record<string, string>;
  won: boolean; align: "left" | "right";
}) {
  const p1 = players.find(p => p.id === id1);
  const p2 = players.find(p => p.id === id2);
  const cat1 = categories?.[id1];
  const cat2 = categories?.[id2];
  const slot1 = slots?.[id1];
  const slot2 = slots?.[id2];
  const nameClass = `text-xs font-semibold leading-tight ${won ? "text-primary" : align === "right" ? "text-muted-foreground" : ""}`;
  if (!categories && !slots) {
    return <p className={`truncate text-sm font-semibold leading-tight ${won ? "text-primary" : align === "right" ? "text-muted-foreground" : ""}`}>{p1?.name ?? "?"} & {p2?.name ?? "?"}</p>;
  }
  return (
    <div className={`space-y-0.5 ${align === "right" ? "items-end" : "items-start"} flex flex-col`}>
      <span className={`flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <SlotTag slot={slot1} />
        <TierBadge cat={cat1} />
        <span className={nameClass}>{p1?.name ?? "?"}</span>
      </span>
      <span className={`flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <SlotTag slot={slot2} />
        <TierBadge cat={cat2} />
        <span className={nameClass}>{p2?.name ?? "?"}</span>
      </span>
    </div>
  );
}

function MatchCard({ match, players, groupLabel, onClick, onDirectScore, refUrl, playerCategories, playerSlots }: {
  match: PicMatch; players: PicPlayer[]; groupLabel?: string;
  onClick?: () => void; onDirectScore?: (scoreA: number, scoreB: number) => void;
  refUrl?: string;
  playerCategories?: Record<string, "A" | "B">;
  playerSlots?: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftA, setDraftA] = useState("");
  const [draftB, setDraftB] = useState("");
  const [copiedRef, setCopiedRef] = useState(false);

  const copyRef = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!refUrl) return;
    navigator.clipboard.writeText(refUrl).catch(() => prompt("Copy link:", refUrl));
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const byId = (id: string) => players.find((p) => p.id === id);
  const aName = match.a1 ? pairName(byId(match.a1), byId(match.a2)) : "TBD";
  const bName = match.b1 ? pairName(byId(match.b1), byId(match.b2)) : "TBD";
  const isDone = match.status === "completed";
  const aWon = isDone && match.scoreA > match.scoreB;
  const bWon = isDone && match.scoreB > match.scoreA;
  const canPlay = !isDone && !!match.a1 && !!match.b1;
  const canEdit = !!match.a1 && !!match.b1;

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftA(String(match.scoreA));
    setDraftB(String(match.scoreB));
    setEditing(true);
  };

  const save = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDirectScore?.(Math.max(0, parseInt(draftA) || 0), Math.max(0, parseInt(draftB) || 0));
    setEditing(false);
  };

  const cancel = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/50 bg-card px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{aName} vs {bName}</p>
          <div className="mt-2 flex items-center gap-2">
            <input type="number" min={0} value={draftA}
              onChange={(e) => setDraftA(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
            <span className="font-bold text-muted-foreground">–</span>
            <input type="number" min={0} value={draftB}
              onChange={(e) => setDraftB(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded-md border bg-background px-2 py-1.5 text-center font-mono text-base font-bold"
            />
          </div>
        </div>
        <button onClick={save}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Check className="size-4" />
        </button>
        <button onClick={cancel}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border bg-card px-3 py-3 transition-colors ${
        canPlay ? "cursor-pointer hover:border-primary/50 hover:bg-accent/30 active:scale-[0.99]" : ""
      } ${!canEdit ? "opacity-40" : ""}`}
      onClick={canPlay ? onClick : undefined}
    >
      {groupLabel && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {groupLabel}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {match.a1 && (playerCategories || playerSlots) ? (
          <PairLabel id1={match.a1} id2={match.a2} players={players} categories={playerCategories} slots={playerSlots} won={aWon} align="left" />
        ) : (
          <p className={`truncate text-sm font-semibold leading-tight ${aWon ? "text-primary" : ""}`}>
            {aName}{aWon && <Trophy className="ml-1 inline size-3.5 text-primary" />}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">vs</span>
      <div className="min-w-0 flex-1 text-right">
        {match.b1 && (playerCategories || playerSlots) ? (
          <PairLabel id1={match.b1} id2={match.b2} players={players} categories={playerCategories} slots={playerSlots} won={bWon} align="right" />
        ) : (
          <p className={`truncate text-sm font-semibold leading-tight ${bWon ? "text-primary" : "text-muted-foreground"}`}>
            {bWon && <Trophy className="mr-1 inline size-3.5 text-primary" />}{bName}
          </p>
        )}
      </div>
      <div className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${isDone ? "bg-secondary" : "border text-muted-foreground"}`}>
        {match.scoreA}–{match.scoreB}
      </div>
      {canEdit && onDirectScore && (
        <button onClick={openEdit}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:border-primary/60 hover:text-primary">
          <Pencil className="size-3.5" />
        </button>
      )}
      {refUrl && canEdit && (
        <button onClick={copyRef}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:border-blue-500/60 hover:text-blue-500">
          {copiedRef ? <Check className="size-3.5 text-green-500" /> : <Link2 className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

// ── FinalDraw: xoay cặp trước Chung Kết / Hạng 3 ──────────────────────────────

function FinalDraw({
  label, pool, players, storageKey, currentPairs, onConfirm, confirming,
}: {
  label: string;
  pool: string[];
  players: PicPlayer[];
  storageKey: string;
  currentPairs?: [[string, string], [string, string]];
  onConfirm: (pairs: [[string, string], [string, string]]) => void;
  confirming: boolean;
}) {
  const [pairs, setPairs] = useState<[[string, string], [string, string]] | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [animTick, setAnimTick] = useState(0);
  const [progress, setProgress] = useState(0);

  const byId = (id: string) => players.find((p) => p.id === id);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      // User already spun → locked in
      try { setPairs(JSON.parse(saved)); setIsDone(true); return; } catch {}
    }
    // Auto-filled from semis → show as preview, still allow spinning
    if (currentPairs) { setPairs(currentPairs); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const doDraw = () => {
    if (isDone || isDrawing || pool.length < 4) return;
    setIsDrawing(true); setProgress(0);
    const DURATION = 2500;
    const start = Date.now();
    const tickId = setInterval(() => setAnimTick((t) => t + 1), 80);
    const progId = setInterval(() => setProgress(Math.min(99, ((Date.now() - start) / DURATION) * 100)), 50);
    setTimeout(() => {
      clearInterval(tickId); clearInterval(progId);
      const s = [...pool].sort(() => Math.random() - 0.5);
      const result: [[string, string], [string, string]] = [[s[0]!, s[1]!], [s[2]!, s[3]!]];
      setPairs(result);
      localStorage.setItem(storageKey, JSON.stringify(result));
      setProgress(100); setIsDrawing(false); setIsDone(true);
    }, DURATION);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shuffle className="size-4 text-primary" />
        <h3 className="text-sm font-bold text-primary">{label}</h3>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pool.map((id) => (
          <span key={id} className="rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium">
            {byId(id)?.name ?? id}
          </span>
        ))}
      </div>

      {/* Preview current pairs (auto-filled) before spinning */}
      {!isDone && pairs && !isDrawing && (
        <div className="space-y-1.5 opacity-60">
          <p className="text-[11px] text-muted-foreground">Cặp bán kết (giữ nguyên nếu không xoay):</p>
          {pairs.map((pair, pi) => (
            <div key={pi} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${pi === 0 ? "bg-blue-500/10" : "bg-orange-500/10"}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pi === 0 ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"}`}>
                {pi === 0 ? "A" : "B"}
              </span>
              <span className="flex-1 text-sm font-medium">{pair.map((id) => byId(id)?.name).join(" & ")}</span>
            </div>
          ))}
        </div>
      )}

      {!isDone && (
        <Button onClick={doDraw} disabled={isDrawing || pool.length < 4} className="w-full">
          <Shuffle className={`size-4 ${isDrawing ? "animate-spin" : ""}`} />
          {isDrawing ? "Đang bốc thăm..." : "🎲 Bốc thăm xoay cặp"}
        </Button>
      )}

      {isDrawing && (
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 font-bold">
            <span className="inline-block animate-spin">🎲</span>
            <span className="animate-pulse text-sm text-primary">ĐANG XOAY CẶP...</span>
            <span className="inline-block animate-spin" style={{ animationDirection: "reverse" }}>🎰</span>
          </div>
          <div className="mb-3 flex justify-center gap-1.5">
            {pool.map((_, i) => {
              const pid = pool[(animTick + i * 3) % pool.length]!;
              return (
                <div key={i} className="min-w-[70px] rounded-lg border-2 border-primary/40 bg-background px-2 py-2 text-center shadow"
                  style={{ transform: `rotate(${(animTick * 2 + i * 90) % 6 - 3}deg)`, transition: "transform 0.08s" }}>
                  <div className="text-[10px] text-muted-foreground">👤</div>
                  <div className="truncate text-xs font-bold text-primary">{byId(pid)?.name ?? "..."}</div>
                </div>
              );
            })}
          </div>
          <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {isDone && pairs && (
        <div className="space-y-2">
          {pairs.map((pair, pi) => (
            <div key={pi} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${pi === 0 ? "bg-blue-500/10" : "bg-orange-500/10"}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pi === 0 ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"}`}>
                {pi === 0 ? "A" : "B"}
              </span>
              <span className="flex-1 text-sm font-semibold">{pair.map((id) => byId(id)?.name).join(" & ")}</span>
            </div>
          ))}
          <Button disabled={confirming} onClick={() => onConfirm(pairs)} size="lg" className="w-full">
            <CheckCircle2 className="size-4" />
            {confirming ? "Đang cập nhật…" : "✅ Xác nhận cặp & Bắt đầu"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── StandingsTable ─────────────────────────────────────────────────────────────

function StandingsTable({ group, players, advancePerGroup, pointsForWin, pointsForLoss, tiebreakerOrder, playerCategories, playerSlots }: {
  group: PicGroup; players: PicPlayer[]; advancePerGroup: number;
  pointsForWin: number; pointsForLoss: number;
  tiebreakerOrder?: "diff_first" | "wins_first";
  playerCategories?: Record<string, "A" | "B">;
  playerSlots?: Record<string, string>;
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
            <th className="px-2 py-2 text-left sm:px-3">#</th>
            <th className="px-2 py-2 text-left sm:px-3">Tên</th>
            <th className="px-2 py-2 text-center sm:px-3">Điểm</th>
            <th className="hidden px-3 py-2 text-center sm:table-cell">T</th>
            <th className="hidden px-3 py-2 text-center sm:table-cell">B</th>
            <th className="px-2 py-2 text-center sm:px-3">±</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const cat = playerCategories?.[s.playerId];
            const slot = playerSlots?.[s.playerId];
            return (
            <tr key={s.playerId} className={`border-b last:border-0 ${i >= advancePerGroup ? "opacity-50" : ""}`}>
              <td className="px-2 py-2.5 sm:px-3">
                <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-yellow-400/20 text-yellow-600" :
                  i === 1 ? "bg-slate-300/20 text-slate-500" :
                  i < advancePerGroup ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>{s.rank}</span>
              </td>
              <td className="px-2 py-2.5 font-medium sm:px-3">
                <span className="flex items-center gap-1.5">
                  {slot && <span className="font-mono text-[10px] font-bold text-muted-foreground/80 shrink-0">{slot}</span>}
                  {cat && (
                    <span className={`flex h-4 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                      cat === "A" ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"
                    }`}>{cat}</span>
                  )}
                  <span className="truncate">{s.name}</span>
                </span>
              </td>
              <td className="px-2 py-2.5 text-center font-mono font-bold text-primary sm:px-3">
                {s.pts}
                <span className="ml-1 inline text-[10px] font-normal text-muted-foreground sm:hidden">
                  ({s.wins}T·{s.losses}B)
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-center font-mono sm:table-cell">{s.wins}</td>
              <td className="hidden px-3 py-2.5 text-center font-mono text-muted-foreground sm:table-cell">{s.losses}</td>
              <td className={`px-2 py-2.5 text-center font-mono font-semibold sm:px-3 ${s.diff > 0 ? "text-green-600" : s.diff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                {s.diff > 0 ? "+" : ""}{s.diff}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main client ────────────────────────────────────────────────────────────────

export default function PicEventClient({ state }: { state: PicEventFull }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeMatch, setActiveMatch] = useState<{
    match: PicMatch; groupId?: string; stage: "group" | "knockout";
  } | null>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [viewTab, setViewTab] = useState<"matches" | "standings">("matches");
  const [drawnPairs, setDrawnPairs] = useState<[string, string][] | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>("random_all");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawDone, setDrawDone] = useState(false);
  const [animTick, setAnimTick] = useState(0);
  const [drawProgress, setDrawProgress] = useState(0);
  const [refToken, setRefToken] = useState<string | null>(null);
  const [copiedRefKey, setCopiedRefKey] = useState<string | null>(null);

  const { id: eventId, config, players, groups, knockoutMatches, stage } = state;

  // Derive A/B tier from cross-tier match structure (a1/b1=A-tier, a2/b2=B-tier)
  // Falls back to config.playerCategories if stored, otherwise derives from matches
  const playerCategories = useMemo<Record<string, "A" | "B"> | undefined>(() => {
    if (config.playerCategories && Object.keys(config.playerCategories).length > 0)
      return config.playerCategories;
    const cats: Record<string, "A" | "B"> = {};
    for (const g of groups) {
      for (const m of g.matches) {
        if (m.a1) cats[m.a1] = "A";
        if (m.a2) cats[m.a2] = "B";
        if (m.b1) cats[m.b1] = "A";
        if (m.b2) cats[m.b2] = "B";
      }
    }
    // Only return if all group players have exactly 2 distinct tiers (cross-tier format)
    const vals = Object.values(cats);
    const aCount = vals.filter(v => v === "A").length;
    const bCount = vals.filter(v => v === "B").length;
    return aCount > 0 && bCount > 0 && aCount === bCount ? cats : undefined;
  }, [config.playerCategories, groups]);

  // Slot labels: "VĐV 1", "VĐV 2", ... based on each group's playerIds order (=seed)
  const playerSlots = useMemo<Record<string, string>>(() => {
    const slots: Record<string, string> = {};
    for (const g of groups) {
      for (let i = 0; i < g.playerIds.length; i++) {
        slots[g.playerIds[i]!] = `VĐV ${i + 1}`;
      }
    }
    return slots;
  }, [groups]);

  // Fetch referee token on mount
  useEffect(() => {
    getPicRefereeToken(eventId).then((res) => {
      if ("token" in res) setRefToken(res.token);
    });
  }, [eventId]);

  // Restore draw from localStorage so F5 doesn't reset it
  useEffect(() => {
    if (stage !== "draw") return;
    const saved = localStorage.getItem(`pic-draw-${eventId}`);
    if (!saved) return;
    try {
      const pairs = JSON.parse(saved) as [string, string][];
      setDrawnPairs(pairs);
      setDrawDone(true);
    } catch {}
  }, [eventId, stage]);
  const byId = (id: string) => players.find((p) => p.id === id);
  const multiGroup = groups.length > 1;
  const allGroupDone = groups.every((g) => g.matches.every((m) => m.status === "completed"));
  const pendingCount = groups.reduce((s, g) => s + g.matches.filter((m) => m.status === "pending").length, 0);

  const W = config.pointsForWin ?? 2;
  const L = config.pointsForLoss ?? 0;
  const TB = config.tiebreakerOrder ?? "diff_first";

  const advancingByGroup = groups.map((g) => {
    const gPlayers = g.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PicPlayer => !!p);
    return computeStandings(gPlayers, g.matches, W, L, TB).slice(0, config.advancePerGroup).map((s) => s.playerId);
  });
  const advancingIds = advancingByGroup.flat();

  const doDraw = () => {
    if (drawDone || isDrawing) return;
    setIsDrawing(true);
    setDrawProgress(0);
    setAnimTick(0);
    const DURATION = 3000;
    const start = Date.now();
    const tickId = setInterval(() => setAnimTick((t) => t + 1), 80);
    const progId = setInterval(() => {
      setDrawProgress(Math.min(99, ((Date.now() - start) / DURATION) * 100));
    }, 50);
    setTimeout(() => {
      clearInterval(tickId);
      clearInterval(progId);
      const pairs = buildDrawPairs(drawMode, advancingByGroup);
      setDrawnPairs(pairs);
      localStorage.setItem(`pic-draw-${eventId}`, JSON.stringify(pairs));
      setDrawProgress(100);
      setIsDrawing(false);
      setDrawDone(true);
    }, DURATION);
  };

  const doConfirm = () => {
    if (!drawnPairs) return;
    startTransition(async () => {
      await picDrawKnockout(eventId, drawnPairs);
      localStorage.removeItem(`pic-draw-${eventId}`);
      router.refresh();
    });
  };

  const copyGroupRef = (label: string) => {
    if (!refToken) return;
    const url = `${window.location.origin}/pic/r/${refToken}?g=${label}`;
    navigator.clipboard.writeText(url).catch(() => prompt("Copy link:", url));
    setCopiedRefKey(`g-${label}`);
    setTimeout(() => setCopiedRefKey(null), 2000);
  };

  const handleDirectScore = (matchId: string) => (scoreA: number, scoreB: number) => {
    startTransition(async () => {
      await scorePicMatch({ eventId, matchId, scoreA, scoreB });
      router.refresh();
    });
  };

  // ── Draw stage ───────────────────────────────────────────────────────────────
  if (stage === "draw") {
    const matchups: { a: [string, string]; b: [string, string] }[] = [];
    if (drawnPairs) {
      for (let i = 0; i < drawnPairs.length - 1; i += 2)
        matchups.push({ a: drawnPairs[i]!, b: drawnPairs[i + 1]! });
    }
    return (
      <div className="space-y-5">
          <div className="rounded-xl border bg-primary/5 p-4 text-center">
            <Trophy className="mx-auto mb-2 size-8 text-primary" />
            <p className="font-bold">Vòng bảng hoàn thành!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {advancingIds.length} người vào {advancingIds.length <= 4 ? "chung kết" : "bán kết"}
            </p>
          </div>

          {multiGroup && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Người đi tiếp</h2>
              {groups.map((g) => {
                const gPlayers = g.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PicPlayer => !!p);
                const top = computeStandings(gPlayers, g.matches, W, L, TB).slice(0, config.advancePerGroup);
                return (
                  <div key={g.id} className="rounded-xl border bg-card px-3 py-2">
                    <p className="mb-1 text-xs font-bold text-primary">Bảng {g.label}</p>
                    {top.map((s) => (
                      <div key={s.playerId} className="flex items-center gap-2 py-0.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{s.rank}</span>
                        <span className="flex-1 text-sm">{s.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{s.wins}T {s.diff > 0 ? "+" : ""}{s.diff}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bốc thăm cặp đôi</h2>

            {/* Draw mode selector — hidden after draw */}
            {!drawDone && !isDrawing && (
              <div className="space-y-1.5">
                {DRAW_MODES.filter((m) =>
                  (m.value === "cross_group" || m.value === "cross_rank") ? multiGroup : true
                ).map((m) => (
                  <button key={m.value} onClick={() => setDrawMode(m.value)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      drawMode === m.value ? "border-primary bg-primary/10" : "hover:border-primary/50"
                    }`}>
                    <p className={`text-sm font-semibold ${drawMode === m.value ? "text-primary" : ""}`}>{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* One-time draw button */}
            {!drawDone && (
              <Button onClick={doDraw} disabled={isDrawing} className="w-full">
                <Shuffle className={`size-4 ${isDrawing ? "animate-spin" : ""}`} />
                {isDrawing ? "Đang bốc thăm..." : "🎲 Bốc thăm"}
              </Button>
            )}

            {/* Live animation */}
            {isDrawing && (
              <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 text-center">
                <div className="mb-4 flex items-center justify-center gap-2 text-lg font-bold">
                  <span className="inline-block animate-spin">🎲</span>
                  <span className="animate-pulse text-primary">ĐANG BỐC THĂM...</span>
                  <span className="inline-block animate-spin" style={{ animationDirection: "reverse" }}>🎰</span>
                </div>
                <div className="mb-4 flex flex-wrap justify-center gap-2">
                  {Array.from({ length: Math.min(4, advancingIds.length) }, (_, i) => {
                    const pid = advancingIds[(animTick + i * 5) % advancingIds.length];
                    return (
                      <div key={i}
                        className="min-w-[110px] rounded-lg border-2 border-primary/40 bg-background px-3 py-2.5 text-center shadow-md"
                        style={{ transform: `rotate(${(animTick * 2 + i * 90) % 6 - 3}deg)`, transition: "transform 0.08s" }}
                      >
                        <div className="text-[10px] text-muted-foreground">👤 Người {i + 1}</div>
                        <div className="mt-0.5 truncate text-sm font-bold text-primary">
                          {players.find((p) => p.id === pid)?.name ?? "..."}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mx-auto h-2.5 max-w-xs overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-100"
                    style={{ width: `${drawProgress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{Math.round(drawProgress)}% · Kết quả sẽ hiện sau...</p>
              </div>
            )}

            {/* Results */}
            {drawDone && matchups.map((mu, i) => (
              <div key={i} className="rounded-xl border bg-card p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {matchups.length > 1 ? `Bán kết ${i + 1}` : "Chung kết"}
                </p>
                <div className="space-y-1.5">
                  {([mu.a, mu.b] as [string, string][]).map((pair, pi) => (
                    <div key={pi} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${pi === 0 ? "bg-blue-500/10" : "bg-orange-500/10"}`}>
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pi === 0 ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600"}`}>
                        {pi === 0 ? "A" : "B"}
                      </span>
                      <span className="flex-1 text-sm font-semibold">{pair.map((id) => byId(id)?.name).join(" & ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {drawDone && drawnPairs && (
            <Button disabled={pending} onClick={doConfirm} size="lg" className="w-full">
              <CheckCircle2 className="size-4" />
              {pending ? "Đang lưu…" : "✅ Bắt đầu Knockout"}
            </Button>
          )}
      </div>
    );
  }

  // ── Done stage ───────────────────────────────────────────────────────────────
  if (stage === "done") {
    const finalMatch = knockoutMatches.find((m) => m.stage === "final");
    const thirdMatch = knockoutMatches.find((m) => m.stage === "third");
    const doneKoR16 = knockoutMatches.filter((m) => m.stage === "r16");
    const doneKoQF = knockoutMatches.filter((m) => m.stage === "quarterfinal");
    const doneKoSemis = knockoutMatches.filter((m) => m.stage === "semifinal");
    if (!finalMatch) return null;
    const aWon = finalMatch.scoreA > finalMatch.scoreB;
    const champs = aWon ? [finalMatch.a1, finalMatch.a2] : [finalMatch.b1, finalMatch.b2];
    const runners = aWon ? [finalMatch.b1, finalMatch.b2] : [finalMatch.a1, finalMatch.a2];

    const KoRow = ({ match, label }: { match: PicMatch; label: string }) => {
      const mAWon = match.scoreA > match.scoreB;
      return (
        <div className="rounded-xl border bg-card px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className={`flex-1 truncate ${mAWon ? "font-bold" : "text-muted-foreground"}`}>
              {[match.a1, match.a2].map((id) => byId(id)?.name).join(" & ")}
            </span>
            <span className="shrink-0 font-mono font-black tabular-nums">
              {match.scoreA} – {match.scoreB}
            </span>
            <span className={`flex-1 truncate text-right ${!mAWon ? "font-bold" : "text-muted-foreground"}`}>
              {[match.b1, match.b2].map((id) => byId(id)?.name).join(" & ")}
            </span>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 py-2">
        {/* Podium */}
        <div className="mx-auto max-w-sm space-y-3">
          <h2 className="text-center text-xl font-bold">🏆 Kết quả</h2>
          <div className="rounded-2xl border-2 border-yellow-400 bg-yellow-500/10 p-5 text-center">
            <p className="text-2xl">🥇</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-yellow-600">Vô địch</p>
            <p className="mt-1 text-lg font-black">{champs.map((id) => byId(id)?.name).join(" & ")}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 text-center">
            <p className="text-xl">🥈</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Á quân</p>
            <p className="mt-1 font-bold">{runners.map((id) => byId(id)?.name).join(" & ")}</p>
          </div>
          {thirdMatch && thirdMatch.status === "completed" && (() => {
            const t3Won = thirdMatch.scoreA > thirdMatch.scoreB;
            const third = t3Won ? [thirdMatch.a1, thirdMatch.a2] : [thirdMatch.b1, thirdMatch.b2];
            return (
              <div className="rounded-2xl border bg-card p-4 text-center">
                <p className="text-xl">🥉</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Hạng 3</p>
                <p className="mt-0.5 font-bold">{third.map((id) => byId(id)?.name).join(" & ")}</p>
              </div>
            );
          })()}
        </div>

        {/* Knockout results */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vòng trung kết</h2>
          {doneKoR16.map((m, i) => <KoRow key={m.id} match={m} label={`1/16 - ${i + 1}`} />)}
          {doneKoQF.map((m, i) => <KoRow key={m.id} match={m} label={`Tứ kết ${i + 1}`} />)}
          {doneKoSemis.map((m, i) => <KoRow key={m.id} match={m} label={`Bán kết ${i + 1}`} />)}
          {thirdMatch && thirdMatch.status === "completed" && <KoRow match={thirdMatch} label="Tranh hạng 3–4" />}
          <KoRow match={finalMatch} label="Chung kết" />
        </div>

        {/* Group standings + match results */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thống kê vòng bảng</h2>
          {groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <StandingsTable group={g} players={players} advancePerGroup={config.advancePerGroup} pointsForWin={W} pointsForLoss={L} tiebreakerOrder={TB} playerCategories={playerCategories} playerSlots={playerSlots} />
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
                        {[m.a1, m.a2].map((id) => byId(id)?.name).join(" & ")}
                      </span>
                      <span className="shrink-0 font-mono font-bold tabular-nums">
                        {m.scoreA} – {m.scoreB}
                      </span>
                      <span className={`flex-1 truncate text-right ${!mAWon ? "font-semibold" : "text-muted-foreground"}`}>
                        {[m.b1, m.b2].map((id) => byId(id)?.name).join(" & ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Score overlay ─────────────────────────────────────────────────────────────
  if (activeMatch) {
    const target = activeMatch.stage === "group" ? config.targetGroup : config.targetKnockout;
    return (
      <AdminMatchScore
        match={activeMatch.match}
        players={players}
        target={target}
        eventId={eventId}
        onClose={() => setActiveMatch(null)}
      />
    );
  }

  // ── Group / knockout ──────────────────────────────────────────────────────────
  const r16Matches = knockoutMatches.filter((m) => m.stage === "r16");
  const quarterMatches = knockoutMatches.filter((m) => m.stage === "quarterfinal");
  const semiMatches = knockoutMatches.filter((m) => m.stage === "semifinal");
  const finalMatchKO = knockoutMatches.find((m) => m.stage === "final");
  const thirdMatchKO = knockoutMatches.find((m) => m.stage === "third");

  // Xoay cặp final: compute semi-winners/losers for re-draw
  const allSemisComplete = semiMatches.length >= 2 && semiMatches.every((m) => m.status === "completed");
  const completedSemisWithPlayers = semiMatches.filter((m) => m.status === "completed" && m.a1 !== "");
  const semiWinners = completedSemisWithPlayers.flatMap((m) =>
    m.scoreA > m.scoreB ? [m.a1, m.a2] : [m.b1, m.b2]
  );
  const semiLosers = completedSemisWithPlayers.flatMap((m) =>
    m.scoreA > m.scoreB ? [m.b1, m.b2] : [m.a1, m.a2]
  );

  type TabId = number | "standings";
  const allTabs: { id: TabId; label: string }[] = multiGroup
    ? [...groups.map((g, i) => ({ id: i as TabId, label: `Bảng ${g.label}` })), { id: "standings", label: "Xếp hạng" }]
    : [{ id: 0, label: "Trận đấu" }, { id: "standings", label: "Bảng điểm" }];
  const activeTabId: TabId = viewTab === "standings" ? "standings" : activeGroupIdx;
  const activeGroup = groups[activeGroupIdx];

  return (
    <div className="space-y-3">
      {stage === "group" && (
        <div className="flex overflow-x-auto border-b">
          {allTabs.map((t) => (
            <button key={String(t.id)}
              onClick={() => {
                if (t.id === "standings") setViewTab("standings");
                else { setActiveGroupIdx(t.id as number); setViewTab("matches"); }
              }}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTabId === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {stage === "knockout" && (
        <div className="space-y-4">
          {r16Matches.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vòng 1/16 — chạm {config.targetKnockout}</h2>
              {r16Matches.map((m, i) => (
                <MatchCard key={m.id} match={m} players={players}
                  groupLabel={`1/16-${i + 1}`}
                  onClick={() => setActiveMatch({ match: m, stage: "knockout" })}
                  onDirectScore={handleDirectScore(m.id)}
                  refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${m.id}` : undefined} />
              ))}
            </div>
          )}
          {quarterMatches.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tứ kết — chạm {config.targetKnockout}</h2>
              {quarterMatches.map((m, i) => (
                <MatchCard key={m.id} match={m} players={players}
                  groupLabel={`TK${i + 1}`}
                  onClick={() => setActiveMatch({ match: m, stage: "knockout" })}
                  onDirectScore={handleDirectScore(m.id)}
                  refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${m.id}` : undefined} />
              ))}
            </div>
          )}
          {semiMatches.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bán kết — chạm {config.targetKnockout}</h2>
              {semiMatches.map((m) => (
                <MatchCard key={m.id} match={m} players={players}
                  onClick={() => setActiveMatch({ match: m, stage: "knockout" })}
                  onDirectScore={handleDirectScore(m.id)}
                  refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${m.id}` : undefined} />
              ))}
            </div>
          )}
          {/* Xoay cặp option when both semis complete */}
          {allSemisComplete && finalMatchKO?.status !== "completed" && semiWinners.length === 4 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                🎲 Xoay cặp Chung Kết — tuỳ chọn
              </h2>
              <FinalDraw
                label="Bốc thăm cặp đôi Chung Kết"
                pool={semiWinners}
                players={players}
                storageKey={`pic-final-draw-${eventId}`}
                currentPairs={finalMatchKO?.a1 ? [[finalMatchKO.a1, finalMatchKO.a2], [finalMatchKO.b1, finalMatchKO.b2]] : undefined}
                confirming={pending}
                onConfirm={(newPairs) => {
                  startTransition(async () => {
                    await picDrawFinalPairs(eventId, newPairs, "final");
                    localStorage.removeItem(`pic-final-draw-${eventId}`);
                    router.refresh();
                  });
                }}
              />
              {thirdMatchKO && thirdMatchKO.status !== "completed" && semiLosers.length === 4 && (
                <FinalDraw
                  label="Bốc thăm cặp đôi Tranh Hạng 3–4"
                  pool={semiLosers}
                  players={players}
                  storageKey={`pic-third-draw-${eventId}`}
                  currentPairs={thirdMatchKO.a1 ? [[thirdMatchKO.a1, thirdMatchKO.a2], [thirdMatchKO.b1, thirdMatchKO.b2]] : undefined}
                  confirming={pending}
                  onConfirm={(newPairs) => {
                    startTransition(async () => {
                      await picDrawFinalPairs(eventId, newPairs, "third");
                      localStorage.removeItem(`pic-third-draw-${eventId}`);
                      router.refresh();
                    });
                  }}
                />
              )}
            </div>
          )}

          {finalMatchKO && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🏆 Chung kết — chạm {config.targetKnockout}</h2>
              <MatchCard match={finalMatchKO} players={players}
                onClick={() => setActiveMatch({ match: finalMatchKO, stage: "knockout" })}
                onDirectScore={handleDirectScore(finalMatchKO.id)}
                refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${finalMatchKO.id}` : undefined} />
            </div>
          )}
          {thirdMatchKO && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tranh hạng 3–4 — chạm {config.targetKnockout}</h2>
              <MatchCard match={thirdMatchKO} players={players}
                onClick={() => setActiveMatch({ match: thirdMatchKO, stage: "knockout" })}
                onDirectScore={handleDirectScore(thirdMatchKO.id)}
                refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${thirdMatchKO.id}` : undefined} />
            </div>
          )}
        </div>
      )}

      {stage === "group" && viewTab === "matches" && activeGroup && (
        <div className="space-y-2">
          {refToken && (
            <button
              onClick={() => copyGroupRef(activeGroup.label)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-blue-500/60 hover:text-blue-500 transition-colors"
            >
              {copiedRefKey === `g-${activeGroup.label}`
                ? <><Check className="size-3.5 text-green-500" />Đã copy link trọng tài Bảng {activeGroup.label}</>
                : <><Link2 className="size-3.5" />Link trọng tài Bảng {activeGroup.label}</>}
            </button>
          )}
          {activeGroup.matches.map((m) => (
            <MatchCard key={m.id} match={m} players={players}
              groupLabel={activeGroup.label}
              onClick={() => setActiveMatch({ match: m, groupId: activeGroup.id, stage: "group" })}
              onDirectScore={handleDirectScore(m.id)}
              refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${m.id}` : undefined}
              playerCategories={playerCategories}
              playerSlots={playerSlots} />
          ))}
          {allGroupDone && (
            <Button disabled={pending} onClick={() => { startTransition(async () => { await picAdvanceToDraw(eventId); router.refresh(); }); }} size="lg" className="mt-2 w-full">
              <Trophy className="size-4" />{pending ? "Đang xử lý…" : "Xem kết quả & Bốc thăm"}
            </Button>
          )}
        </div>
      )}

      {stage === "group" && viewTab === "standings" && (
        <div className="space-y-4">
          {groups.map((g) => (
            <StandingsTable key={g.id} group={g} players={players} advancePerGroup={config.advancePerGroup} pointsForWin={W} pointsForLoss={L} tiebreakerOrder={TB} playerCategories={playerCategories} playerSlots={playerSlots} />
          ))}
          {allGroupDone && (
            <Button onClick={() => { startTransition(async () => { router.refresh(); }); }} size="lg" className="w-full">
              <Trophy className="size-4" />Xem kết quả &amp; Bốc thăm
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
