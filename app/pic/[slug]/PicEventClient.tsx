"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, Shuffle, CheckCircle2, Check, Pencil, X, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeStandings, type PicMatch, type PicPlayer, type PicGroup } from "@/stores/pic-tournament";
import {
  scorePicMatch, picDrawKnockout, picAdvanceToDraw, createPicMatchScore, getPicRefereeToken, picDrawFinalPairs,
  createPicKnockoutDrawSession, getActivePicKnockoutDraw, cancelPicIndividualDrawSession, updatePicConfig,
} from "@/app/actions/pic";
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

type TierLabels = { A: string; B: string } | undefined;

function TierBadge({ cat, labels }: { cat: "A" | "B" | undefined; labels?: TierLabels }) {
  if (!cat) return null;
  const text = labels?.[cat] ?? cat;
  const cls =
    cat === "A"
      ? "bg-blue-500/20 text-blue-600"
      : labels?.B === "Nữ"
        ? "bg-pink-500/20 text-pink-600"
        : "bg-orange-500/20 text-orange-600";
  return (
    <span className={`inline-flex h-3.5 min-w-4 shrink-0 items-center justify-center rounded px-0.5 text-[8px] font-bold ${cls}`}>{text}</span>
  );
}

function SlotTag({ slot }: { slot: string | undefined }) {
  if (!slot) return null;
  // "VĐV 1" → "VĐV1" (no space, more compact)
  const compact = slot.replace(/^VĐV\s+/, "VĐV");
  return (
    <span className="shrink-0 font-mono text-[8px] font-semibold uppercase leading-none tracking-wider text-muted-foreground/70">
      {compact}
    </span>
  );
}

function PlayerRow({ player, cat, slot, won, tierLabels }: {
  player: PicPlayer | undefined;
  cat: "A" | "B" | undefined;
  slot: string | undefined;
  won: boolean;
  tierLabels?: TierLabels;
}) {
  const nameClass = `text-xs font-semibold leading-tight break-words ${won ? "text-primary" : ""}`;
  return (
    <div className="flex flex-col items-center min-w-0 text-center">
      {(slot || cat) && (
        <span className="flex items-center justify-center gap-1">
          <SlotTag slot={slot} />
          <TierBadge cat={cat} labels={tierLabels} />
        </span>
      )}
      <span className={nameClass}>{player?.name ?? "?"}</span>
    </div>
  );
}

function PairLabel({ id1, id2, players, categories, slots, won, align, tierLabels }: {
  id1: string; id2: string; players: PicPlayer[];
  categories?: Record<string, "A" | "B">;
  slots?: Record<string, string>;
  won: boolean; align: "left" | "right";
  tierLabels?: TierLabels;
}) {
  const p1 = players.find(p => p.id === id1);
  const p2 = players.find(p => p.id === id2);
  if (!categories && !slots) {
    return <p className={`truncate text-sm font-semibold leading-tight ${won ? "text-primary" : align === "right" ? "text-muted-foreground" : ""}`}>{p1?.name ?? "?"} & {p2?.name ?? "?"}</p>;
  }
  return (
    <div className={`min-w-0 w-full rounded-md border px-2 py-1.5 space-y-1.5 ${
      won ? "border-primary/50 bg-primary/5" : "bg-card/50"
    }`}>
      <PlayerRow player={p1} cat={categories?.[id1]} slot={slots?.[id1]} won={won} tierLabels={tierLabels} />
      <PlayerRow player={p2} cat={categories?.[id2]} slot={slots?.[id2]} won={won} tierLabels={tierLabels} />
    </div>
  );
}

function MatchCard({ match, players, groupLabel, onClick, onDirectScore, refUrl, playerCategories, playerSlots, tierLabels }: {
  match: PicMatch; players: PicPlayer[]; groupLabel?: string;
  onClick?: () => void; onDirectScore?: (scoreA: number, scoreB: number) => void;
  refUrl?: string;
  playerCategories?: Record<string, "A" | "B">;
  playerSlots?: Record<string, string>;
  tierLabels?: TierLabels;
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
          <PairLabel id1={match.a1} id2={match.a2} players={players} categories={playerCategories} slots={playerSlots} won={aWon} align="left" tierLabels={tierLabels} />
        ) : (
          <p className={`truncate text-sm font-semibold leading-tight ${aWon ? "text-primary" : ""}`}>
            {aName}{aWon && <Trophy className="ml-1 inline size-3.5 text-primary" />}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">vs</span>
      <div className="min-w-0 flex-1 text-right">
        {match.b1 && (playerCategories || playerSlots) ? (
          <PairLabel id1={match.b1} id2={match.b2} players={players} categories={playerCategories} slots={playerSlots} won={bWon} align="right" tierLabels={tierLabels} />
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
  label, pool, players, storageKey, currentPairs, onConfirm, confirming, genders,
}: {
  label: string;
  pool: string[];
  players: PicPlayer[];
  storageKey: string;
  currentPairs?: [[string, string], [string, string]];
  onConfirm: (pairs: [[string, string], [string, string]]) => void;
  confirming: boolean;
  genders?: Record<string, "M" | "F">;
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
      // Đủ 2 nam + 2 nữ → luôn xoay thành cặp nam-nữ; thiếu thì random thuần
      const males = pool.filter((id) => genders?.[id] === "M");
      const females = pool.filter((id) => genders?.[id] === "F");
      let result: [[string, string], [string, string]];
      if (males.length === 2 && females.length === 2) {
        const m = [...males].sort(() => Math.random() - 0.5);
        const f = [...females].sort(() => Math.random() - 0.5);
        result = [[m[0]!, f[0]!], [m[1]!, f[1]!]];
      } else {
        const s = [...pool].sort(() => Math.random() - 0.5);
        result = [[s[0]!, s[1]!], [s[2]!, s[3]!]];
      }
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
              <span className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium">
                {pair.map((id, idx) => {
                  const g = genders?.[id];
                  return (
                    <span key={id} className="inline-flex items-center gap-1">
                      {idx > 0 && <span className="opacity-50">&</span>}
                      {byId(id)?.name ?? "?"}
                      {g && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${g === "M" ? "bg-blue-500/20 text-blue-600" : "bg-pink-500/20 text-pink-600"}`}>{g === "M" ? "Nam" : "Nữ"}</span>}
                    </span>
                  );
                })}
              </span>
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
              <span className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold">
                {pair.map((id, idx) => {
                  const g = genders?.[id];
                  return (
                    <span key={id} className="inline-flex items-center gap-1">
                      {idx > 0 && <span className="opacity-50">&</span>}
                      {byId(id)?.name ?? "?"}
                      {g && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${g === "M" ? "bg-blue-500/20 text-blue-600" : "bg-pink-500/20 text-pink-600"}`}>{g === "M" ? "Nam" : "Nữ"}</span>}
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
          <Button disabled={confirming} onClick={() => onConfirm(pairs)} size="lg" className="w-full">
            <CheckCircle2 className="size-4" />
            {confirming ? "Đang cập nhật…" : "✅ Xác nhận cặp & Bắt đầu"}
          </Button>
          <button
            onClick={() => {
              if (!confirm("Xoay lại cặp? Kết quả vừa quay sẽ bị bỏ.")) return;
              localStorage.removeItem(storageKey);
              setPairs(currentPairs ?? null);
              setIsDone(false);
            }}
            disabled={confirming || isDrawing}
            className="mx-auto flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <Shuffle className="size-3" />
            Xoay lại
          </button>
        </div>
      )}
    </div>
  );
}

// ── StandingsTable ─────────────────────────────────────────────────────────────

function StandingsTable({ group, players, advancePerGroup, pointsForWin, pointsForLoss, tiebreakerOrder, playerCategories, playerSlots, tierLabels }: {
  group: PicGroup; players: PicPlayer[]; advancePerGroup: number;
  pointsForWin: number; pointsForLoss: number;
  tiebreakerOrder?: "diff_first" | "wins_first";
  playerCategories?: Record<string, "A" | "B">;
  playerSlots?: Record<string, string>;
  tierLabels?: TierLabels;
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
                <span className="flex flex-wrap items-center gap-1.5">
                  {slot && (
                    <span className="shrink-0 font-mono text-[10px] font-bold text-muted-foreground/80">{slot}</span>
                  )}
                  {cat && (
                    <span className={`flex h-4 min-w-5 shrink-0 items-center justify-center rounded px-0.5 text-[9px] font-bold ${
                      cat === "A" ? "bg-blue-500/20 text-blue-600" : tierLabels?.B === "Nữ" ? "bg-pink-500/20 text-pink-600" : "bg-orange-500/20 text-orange-600"
                    }`}>{tierLabels?.[cat] ?? cat}</span>
                  )}
                  <span className="break-words">{s.name}</span>
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
  const tierLabels = config.tierLabels;

  // Badge Nam/Nữ cho vòng bảng khi mọi VĐV đã gán giới tính.
  // Ưu tiên: hạng A/B thật trong config > giới tính > suy từ lịch cross-tier.
  const allGenderCats = useMemo<Record<string, "A" | "B"> | null>(() => {
    const src = config.playerGenders ?? {};
    if (players.length === 0) return null;
    const cats: Record<string, "A" | "B"> = {};
    for (const p of players) {
      const g = src[p.id];
      if (!g) return null;
      cats[p.id] = g === "M" ? "A" : "B";
    }
    return cats;
  }, [players, config.playerGenders]);
  const hasConfigCats =
    !!config.playerCategories && Object.keys(config.playerCategories).length > 0;
  const groupCats = hasConfigCats
    ? playerCategories
    : (allGenderCats ?? playerCategories);
  const groupLabels = hasConfigCats
    ? tierLabels
    : allGenderCats
      ? { A: "Nam", B: "Nữ" }
      : tierLabels;

  // Gender/tier tags cho bốc cặp (persisted in config)
  const [genders, setGenders] = useState<Record<string, "M" | "F">>(
    () => config.playerGenders ?? {},
  );
  const [tiers, setTiers] = useState<Record<string, "A" | "B">>(
    () => config.playerCategories ?? {},
  );
  // Phiên bốc cặp LIVE
  const [koLive, setKoLive] = useState<{
    code: string;
    playerTokens: Record<string, string>;
    drawnCount: number;
    total: number;
  } | null>(null);
  const [copiedKoKey, setCopiedKoKey] = useState<string | null>(null);

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

  // KO cards: nếu mọi VĐV trong nhánh knockout đều có giới tính → badge Nam/Nữ
  const koGenderCats = useMemo<Record<string, "A" | "B"> | null>(() => {
    const ids = new Set<string>();
    for (const m of knockoutMatches)
      for (const id of [m.a1, m.a2, m.b1, m.b2]) if (id) ids.add(id);
    if (ids.size === 0) return null;
    const src = config.playerGenders ?? {};
    const cats: Record<string, "A" | "B"> = {};
    for (const id of ids) {
      const g = src[id];
      if (!g) return null;
      cats[id] = g === "M" ? "A" : "B";
    }
    return cats;
  }, [knockoutMatches, config.playerGenders]);
  const koCats = koGenderCats ?? undefined;
  const koLabels = koGenderCats ? { A: "Nam", B: "Nữ" } : undefined;

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
  // Poll phiên bốc cặp LIVE (đang draw stage): applied → refresh sang knockout
  useEffect(() => {
    if (stage !== "draw") return;
    let mounted = true;
    const refresh = async () => {
      try {
        const res = await getActivePicKnockoutDraw(eventId);
        if (!mounted) return;
        if (res.active) {
          setKoLive({
            code: res.code,
            playerTokens: res.playerTokens,
            drawnCount: res.drawnCount,
            total: res.total,
          });
        } else {
          setKoLive((prev) => {
            if (prev) router.refresh();
            return null;
          });
        }
      } catch {
        /* transient */
      }
    };
    void refresh();
    const interval = setInterval(refresh, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [stage, eventId, router]);

  const onCreateKoLive = () => {
    if (!selectedModeInfo.ok) return;
    const constraint =
      drawMode === "mixed_gender" ? ("gender" as const)
      : drawMode === "cross_tier" ? ("tier" as const)
      : ("none" as const);
    startTransition(async () => {
      const res = await createPicKnockoutDrawSession(eventId, advancingIds, constraint);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setKoLive({
        code: res.code,
        playerTokens: res.playerTokens,
        drawnCount: 0,
        total: advancingIds.length,
      });
    });
  };

  const onCancelKoLive = () => {
    if (!koLive) return;
    if (!confirm("Hủy phiên bốc cặp LIVE?")) return;
    startTransition(async () => {
      const res = await cancelPicIndividualDrawSession(koLive.code);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setKoLive(null);
    });
  };

  const copyKoLink = (url: string, key: string) => {
    navigator.clipboard.writeText(url).catch(() => prompt("Copy link:", url));
    setCopiedKoKey(key);
    setTimeout(() => setCopiedKoKey(null), 2000);
  };

  const byId = (id: string) => players.find((p) => p.id === id);
  const multiGroup = groups.length > 1;
  const allGroupDone = groups.every((g) => g.matches.every((m) => m.status === "completed"));
  const pendingCount = groups.reduce((s, g) => s + g.matches.filter((m) => m.status === "pending").length, 0);

  const W = config.pointsForWin ?? 2;
  const L = config.pointsForLoss ?? 0;
  const TB = config.tiebreakerOrder ?? "diff_first";

  const groupStandingsAll = groups.map((g) => {
    const gPlayers = g.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PicPlayer => !!p);
    return { label: g.label, st: computeStandings(gPlayers, g.matches, W, L, TB) };
  });

  const cmpStanding = (
    a: { pts: number; wins: number; diff: number; name: string },
    b: { pts: number; wins: number; diff: number; name: string },
  ) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (TB === "wins_first") {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.diff !== a.diff) return b.diff - a.diff;
    } else {
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.wins !== a.wins) return b.wins - a.wins;
    }
    return a.name.localeCompare(b.name);
  };

  // Đôi nam nữ: mỗi bảng lấy (v/2) nam + (v/2) nữ tốt nhất thay vì top v thuần điểm
  const allGroupPlayersGendered = groups.every((g) =>
    g.playerIds.every((id) => !!genders[id]),
  );
  const mixedAdvance =
    drawMode === "mixed_gender" &&
    config.advancePerGroup % 2 === 0 &&
    allGroupPlayersGendered;

  const advancingByGroup = groupStandingsAll.map(({ st }) => {
    if (mixedAdvance) {
      const half = config.advancePerGroup / 2;
      const picked = [
        ...st.filter((s) => genders[s.playerId] === "M").slice(0, half),
        ...st.filter((s) => genders[s.playerId] === "F").slice(0, half),
      ].sort((a, b) => a.rank - b.rank);
      // Bảng lệch giới (thiếu nam/nữ) → bù bằng hạng cao nhất còn lại
      if (picked.length < config.advancePerGroup) {
        const chosen = new Set(picked.map((s) => s.playerId));
        for (const s of st) {
          if (picked.length >= config.advancePerGroup) break;
          if (!chosen.has(s.playerId)) {
            picked.push(s);
            chosen.add(s.playerId);
          }
        }
      }
      return picked.map((s) => s.playerId);
    }
    return st.slice(0, config.advancePerGroup).map((s) => s.playerId);
  });

  // Tag hợp lệ cho mode Đôi nam nữ / Đôi A+B
  const effTiers = Object.keys(tiers).length > 0 ? tiers : (playerCategories ?? {});

  // Vớt: N người hạng (advancePerGroup+1) có thành tích tốt nhất so liên bảng
  const bestExtraCount = config.bestExtraCount ?? 0;
  const extraCandidatesAll = (() => {
    if (bestExtraCount <= 0) return [];
    if (mixedAdvance) {
      // Pool = MỌI VĐV chưa vào vòng trong (liên bảng) — để chọn nam/nữ tốt nhất còn lại
      const qualified = new Set(advancingByGroup.flat());
      return groupStandingsAll
        .flatMap(({ label, st }) =>
          st
            .filter((s) => !qualified.has(s.playerId))
            .map((s) => ({ ...s, groupLabel: label })),
        )
        .sort(cmpStanding);
    }
    return groupStandingsAll
      .map(({ label, st }) => {
        const c = st[config.advancePerGroup];
        return c ? { ...c, groupLabel: label } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort(cmpStanding);
  })();

  const vTagOf = (id: string): string | null =>
    drawMode === "mixed_gender"
      ? genders[id] === "M" ? "Nam" : genders[id] === "F" ? "Nữ" : null
      : drawMode === "cross_tier"
        ? (effTiers[id] ?? null)
        : null;

  // Đôi nam nữ / Đôi A+B: vớt chia đều theo nhóm — vd 2 vớt = 1 Nam tốt nhất + 1 Nữ tốt nhất
  const extraQualifiers = (() => {
    if (bestExtraCount <= 0) return [];
    if ((drawMode === "mixed_gender" || drawMode === "cross_tier") && bestExtraCount >= 2) {
      const vals = drawMode === "mixed_gender" ? ["Nam", "Nữ"] : ["A", "B"];
      const take = Math.floor(bestExtraCount / 2);
      const picked: typeof extraCandidatesAll = [];
      for (const v of vals)
        picked.push(...extraCandidatesAll.filter((c) => vTagOf(c.playerId) === v).slice(0, take));
      // Bù nếu một nhóm thiếu ứng viên (hoặc chưa gán tag đủ)
      if (picked.length < bestExtraCount) {
        const chosen = new Set(picked.map((c) => c.playerId));
        for (const c of extraCandidatesAll) {
          if (picked.length >= bestExtraCount) break;
          if (!chosen.has(c.playerId)) {
            picked.push(c);
            chosen.add(c.playerId);
          }
        }
      }
      return picked;
    }
    return extraCandidatesAll.slice(0, bestExtraCount);
  })();

  const drawBuckets =
    extraQualifiers.length > 0
      ? [...advancingByGroup, extraQualifiers.map((e) => e.playerId)]
      : advancingByGroup;
  const advancingIds = drawBuckets.flat();

  // Pills gán tag: gồm cả MỌI ứng viên vớt (hạng v+1 các bảng) để gán được
  // trước khi hệ chốt ai được vớt theo giới
  const tagPillIds = [
    ...new Set([...advancingByGroup.flat(), ...extraCandidatesAll.map((c) => c.playerId)]),
  ];
  const modeTagInfo = (m: DrawMode): { ok: boolean; msg?: string } => {
    if (m === "mixed_gender") {
      const c1 = advancingIds.filter((id) => genders[id] === "M").length;
      const c2 = advancingIds.filter((id) => genders[id] === "F").length;
      if (c1 + c2 < advancingIds.length)
        return { ok: false, msg: `Còn ${advancingIds.length - c1 - c2} người chưa gán Nam/Nữ — tap tên bên dưới` };
      if (c1 !== c2) return { ok: false, msg: `Nam ${c1} ≠ Nữ ${c2} — phải bằng nhau mới ghép đôi nam nữ được` };
      return { ok: true };
    }
    if (m === "cross_tier") {
      const c1 = advancingIds.filter((id) => effTiers[id] === "A").length;
      const c2 = advancingIds.filter((id) => effTiers[id] === "B").length;
      if (c1 + c2 < advancingIds.length)
        return { ok: false, msg: `Còn ${advancingIds.length - c1 - c2} người chưa gán A/B — tap tên bên dưới` };
      if (c1 !== c2) return { ok: false, msg: `A ${c1} ≠ B ${c2} — phải bằng nhau mới ghép đôi A+B được` };
      return { ok: true };
    }
    return { ok: true };
  };
  const selectedModeInfo = modeTagInfo(drawMode);

  const toggleQualifierGender = (id: string) => {
    setGenders((prev) => {
      const cur = prev[id];
      const next = { ...prev };
      if (!cur) next[id] = "M";
      else if (cur === "M") next[id] = "F";
      else delete next[id];
      void updatePicConfig(eventId, { playerGenders: next });
      return next;
    });
  };
  const toggleQualifierTier = (id: string) => {
    setTiers((prev) => {
      const cur = prev[id];
      const next = { ...prev };
      if (!cur) next[id] = "A";
      else if (cur === "A") next[id] = "B";
      else delete next[id];
      void updatePicConfig(eventId, { playerCategories: next });
      return next;
    });
  };

  const doDraw = () => {
    if (drawDone || isDrawing || !selectedModeInfo.ok) return;
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
      const pairTags =
        drawMode === "mixed_gender" ? genders
        : drawMode === "cross_tier" ? effTiers
        : undefined;
      const pairs = buildDrawPairs(drawMode, drawBuckets, { pairTags });
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

          {/* Chỉnh "Vào vòng trong" ngay tại đây (trước khi bốc) */}
          {!drawDone && !isDrawing && !koLive && (() => {
            const gSizes = groups.map((g) => g.playerIds.length);
            const minSize = gSizes.length ? Math.min(...gSizes) : 0;
            const gCount = groups.length;
            const opts: { v: number; e: number }[] = [];
            for (let v = 1; v < minSize; v++) {
              if ((gCount * v) % 2 === 0 && gCount * v >= 2) opts.push({ v, e: 0 });
              if (v + 1 <= minSize) {
                for (const t of [4, 8, 16]) {
                  const e = t - gCount * v;
                  if (e >= 1 && e < gCount) opts.push({ v, e });
                }
              }
            }
            opts.sort((a, b) => (gCount * a.v + a.e) - (gCount * b.v + b.e) || a.v - b.v);
            if (opts.length <= 1) return null;
            return (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vào vòng trong</p>
                <div className="flex flex-wrap gap-1.5">
                  {opts.map((o) => {
                    const selected = config.advancePerGroup === o.v && bestExtraCount === o.e;
                    const total = gCount * o.v + o.e;
                    return (
                      <button
                        key={`${o.v}-${o.e}`}
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await updatePicConfig(eventId, { advancePerGroup: o.v, bestExtraCount: o.e });
                            router.refresh();
                          });
                        }}
                        className={`rounded-md border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"}`}
                      >
                        Top {o.v}/bảng{o.e > 0 ? ` +${o.e} vớt` : ""}
                        <span className="ml-1 font-normal opacity-60">→ {total}ng</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {multiGroup && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Người đi tiếp</h2>
              {mixedAdvance && (
                <p className="text-[11px] text-muted-foreground">
                  💑 Đôi nam nữ: mỗi bảng lấy {config.advancePerGroup / 2} nam + {config.advancePerGroup / 2} nữ
                  có thành tích tốt nhất{bestExtraCount > 0 ? ` · vớt = ${Math.floor(bestExtraCount / 2)} nam + ${Math.floor(bestExtraCount / 2)} nữ tốt nhất còn lại liên bảng` : ""}
                </p>
              )}
              {groups.map((g, gi) => {
                const st = groupStandingsAll[gi]?.st ?? [];
                const top = (advancingByGroup[gi] ?? [])
                  .map((id) => st.find((s) => s.playerId === id))
                  .filter((s): s is NonNullable<typeof s> => !!s);
                return (
                  <div key={g.id} className="rounded-xl border bg-card px-3 py-2">
                    <p className="mb-1 text-xs font-bold text-primary">Bảng {g.label}</p>
                    {top.map((s) => {
                      const g = genders[s.playerId];
                      return (
                        <div key={s.playerId} className="flex items-center gap-2 py-0.5">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{s.rank}</span>
                          <span className="flex-1 text-sm">{s.name}</span>
                          {g && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              g === "M" ? "bg-blue-500/15 text-blue-600" : "bg-pink-500/15 text-pink-600"
                            }`}>{g === "M" ? "Nam" : "Nữ"}</span>
                          )}
                          <span className="font-mono text-xs text-muted-foreground">{s.wins}T {s.diff > 0 ? "+" : ""}{s.diff}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {extraQualifiers.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                  <p className="mb-1 text-xs font-bold text-amber-600">
                    🎟️ Vớt —{" "}
                    {mixedAdvance
                      ? "nam & nữ tốt nhất còn lại liên bảng"
                      : `hạng ${config.advancePerGroup + 1} tốt nhất liên bảng`}
                  </p>
                  {extraQualifiers.map((s) => {
                    const vt = vTagOf(s.playerId);
                    return (
                      <div key={s.playerId} className="flex items-center gap-2 py-0.5">
                        <span className="flex h-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-600">
                          Bảng {s.groupLabel}
                        </span>
                        <span className="flex-1 text-sm">{s.name}</span>
                        {vt && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            vt === "Nam" || vt === "A" ? "bg-blue-500/15 text-blue-600" : "bg-pink-500/15 text-pink-600"
                          }`}>{vt}</span>
                        )}
                        <span className="font-mono text-xs text-muted-foreground">{s.wins}T {s.diff > 0 ? "+" : ""}{s.diff}</span>
                      </div>
                    );
                  })}
                </div>
              )}
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

            {/* Tag pills for Đôi nam nữ / Đôi A+B */}
            {!drawDone && !isDrawing && (drawMode === "mixed_gender" || drawMode === "cross_tier") && (
              <div className="space-y-2 rounded-xl border bg-card p-3">
                <p className="text-xs font-semibold">
                  {drawMode === "mixed_gender"
                    ? "Giới tính người đi tiếp — đã gán từ đầu giải (sai thì sửa ở tab VĐV)"
                    : "Gán hạng A/B cho người đi tiếp — tap để đổi (A → B → bỏ)"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tagPillIds.map((id) => {
                    const p = byId(id);
                    const tag = drawMode === "mixed_gender"
                      ? (genders[id] === "M" ? "Nam" : genders[id] === "F" ? "Nữ" : null)
                      : (effTiers[id] ?? null);
                    const color =
                      tag === "Nam" || tag === "A"
                        ? "bg-blue-500 text-white border-blue-500"
                        : tag === "Nữ"
                          ? "bg-pink-500 text-white border-pink-500"
                          : tag === "B"
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-muted text-muted-foreground";
                    const inner = (
                      <>
                        <span>{p?.name ?? id}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
                          {tag ?? "—"}
                        </span>
                      </>
                    );
                    // Giới tính chỉ hiển thị (khoá) — hạng A/B vẫn tap để gán
                    if (drawMode === "mixed_gender") {
                      return (
                        <span key={id} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                          {inner}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={id}
                        onClick={() => toggleQualifierTier(id)}
                        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary active:scale-95"
                      >
                        {inner}
                      </button>
                    );
                  })}
                </div>
                {!selectedModeInfo.ok && (
                  <p className="text-xs font-medium text-destructive">{selectedModeInfo.msg}</p>
                )}
              </div>
            )}

            {/* One-time draw button */}
            {!drawDone && (
              <Button onClick={doDraw} disabled={isDrawing || !selectedModeInfo.ok} className="w-full">
                <Shuffle className={`size-4 ${isDrawing ? "animate-spin" : ""}`} />
                {isDrawing ? "Đang bốc thăm..." : "🎲 Bốc thăm (tại chỗ)"}
              </Button>
            )}

            {/* LIVE pair draw — mỗi VĐV 1 link riêng */}
            {!drawDone && !isDrawing && (
              <div className="space-y-2 rounded-xl border border-red-400/40 bg-red-500/5 p-3">
                {koLive ? (
                  <>
                    <p className="flex items-center gap-2 text-sm font-bold text-red-500">
                      <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />
                      Phiên bốc cặp LIVE · {koLive.drawnCount}/{koLive.total} đã quay
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <a href={`/pic/draw/${koLive.code}`} target="_blank" rel="noopener noreferrer">
                          <Link2 className="size-3.5" />Mở phiên (admin)
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyKoLink(`${window.location.origin}/pic/draw/${koLive.code}`, "ko-open")}
                      >
                        {copiedKoKey === "ko-open" ? <Check className="size-3.5 text-green-500" /> : <Link2 className="size-3.5" />}
                        Copy link chung
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const text = advancingIds
                            .map((id) => {
                              const tok = koLive.playerTokens[id];
                              return tok ? `${byId(id)?.name ?? "?"}: ${window.location.origin}/pic/draw/${koLive.code}?p=${tok}` : null;
                            })
                            .filter(Boolean)
                            .join("\n");
                          copyKoLink(text, "ko-all");
                        }}
                      >
                        {copiedKoKey === "ko-all" ? <Check className="size-3.5 text-green-500" /> : <Link2 className="size-3.5" />}
                        Copy tất cả link riêng
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={onCancelKoLive} disabled={pending}>
                        Hủy phiên
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Mỗi VĐV mở link riêng của mình, tự bấm quay — đủ {koLive.total} lượt thì mở phiên admin bấm <strong>Xác nhận</strong> để vào knockout.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">🔴 Bốc cặp LIVE — mỗi VĐV 1 link, tự quay từ máy mình</p>
                    <p className="text-[11px] text-muted-foreground">
                      Dùng chế độ bốc đang chọn ở trên ({DRAW_MODES.find((m) => m.value === drawMode)?.label}). Kết quả hiện realtime trên mọi máy.
                    </p>
                    <Button onClick={onCreateKoLive} disabled={pending || !selectedModeInfo.ok} size="sm" className="bg-red-500 text-white hover:bg-red-600">
                      <Link2 className="size-3.5" />
                      {pending ? "Đang tạo…" : "Tạo phiên bốc cặp LIVE"}
                    </Button>
                  </>
                )}
              </div>
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
                      <span className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold">
                        {pair.map((id, idx) => {
                          const g = genders[id];
                          const t = effTiers[id];
                          const badge = g
                            ? { text: g === "M" ? "Nam" : "Nữ", cls: g === "M" ? "bg-blue-500/20 text-blue-600" : "bg-pink-500/20 text-pink-600" }
                            : drawMode === "cross_tier" && t
                              ? { text: t, cls: t === "A" ? "bg-blue-500/20 text-blue-600" : "bg-orange-500/20 text-orange-600" }
                              : null;
                          return (
                            <span key={id} className="inline-flex items-center gap-1">
                              {idx > 0 && <span className="opacity-50">&</span>}
                              {byId(id)?.name ?? "?"}
                              {badge && (
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.text}</span>
                              )}
                            </span>
                          );
                        })}
                      </span>
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
              <StandingsTable group={g} players={players} advancePerGroup={config.advancePerGroup} pointsForWin={W} pointsForLoss={L} tiebreakerOrder={TB} playerCategories={groupCats} playerSlots={playerSlots} tierLabels={groupLabels} />
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
                  refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${m.id}` : undefined}
                  playerCategories={koCats} tierLabels={koLabels} />
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
                  refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${m.id}` : undefined}
                  playerCategories={koCats} tierLabels={koLabels} />
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
                  refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${m.id}` : undefined}
                  playerCategories={koCats} tierLabels={koLabels} />
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
                genders={genders}
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
                  genders={genders}
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
                refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${finalMatchKO.id}` : undefined}
                playerCategories={koCats} tierLabels={koLabels} />
            </div>
          )}
          {thirdMatchKO && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tranh hạng 3–4 — chạm {config.targetKnockout}</h2>
              <MatchCard match={thirdMatchKO} players={players}
                onClick={() => setActiveMatch({ match: thirdMatchKO, stage: "knockout" })}
                onDirectScore={handleDirectScore(thirdMatchKO.id)}
                refUrl={refToken ? `${window.location.origin}/pic/r/${refToken}?m=${thirdMatchKO.id}` : undefined}
                playerCategories={koCats} tierLabels={koLabels} />
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
              playerCategories={groupCats}
              playerSlots={playerSlots}
              tierLabels={groupLabels} />
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
            <StandingsTable key={g.id} group={g} players={players} advancePerGroup={config.advancePerGroup} pointsForWin={W} pointsForLoss={L} tiebreakerOrder={TB} playerCategories={groupCats} playerSlots={playerSlots} tierLabels={groupLabels} />
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
