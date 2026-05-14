"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, Shuffle, Users, Radio, ExternalLink, RefreshCw, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  addPicPlayer, removePicPlayer, bulkAddPicPlayers,
  generatePicGroups, generateCrossTierGroupMatches, generateNormalGroupMatches,
  generateCrossTierGroupsFull, createPicDraw, applyPicDraw, resetPicGroups,
  createPicIndividualDrawSession, cancelPicIndividualDrawSession,
  setPicScheduleMode,
} from "@/app/actions/pic";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import IndividualDrawClient from "./IndividualDrawClient";

interface Player { id: string; name: string }
interface Group { id: string; label: string; playerIds: string[] }
type Category = "A" | "B";
interface PreviewGroup { aPlayers: Player[]; bPlayers: Player[] }

function snakePreview(count: number, groupCount: number): number[] {
  const sizes = Array.from({ length: groupCount }, () => 0);
  let dir = 1, gi = 0;
  for (let i = 0; i < count; i++) {
    sizes[gi]!++;
    const next = gi + dir;
    if (next >= groupCount || next < 0) dir = -dir;
    else gi += dir;
  }
  return sizes;
}

function clientShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function clientSnake<T>(arr: T[], n: number): T[][] {
  const groups: T[][] = Array.from({ length: n }, () => []);
  let dir = 1, gi = 0;
  for (const item of arr) {
    groups[gi]!.push(item);
    const next = gi + dir;
    if (next >= n || next < 0) dir = -dir;
    else gi += dir;
  }
  return groups;
}

export default function PicPlayersClient({
  eventId,
  initialPlayers,
  initialGroups,
  hasMatches,
  hasCompletedMatches,
  drawCode: initialDrawCode,
  initialScheduleMode,
  initialLiveDraw,
}: {
  eventId: string;
  initialPlayers: Player[];
  initialGroups: Group[];
  hasMatches: boolean;
  hasCompletedMatches: boolean;
  drawCode: string | null;
  initialScheduleMode: "standard" | "hd";
  initialLiveDraw: { code: string; playerTokens: Record<string, string> } | null;
}) {
  const router = useRouter();
  const hasGroups = initialGroups.length > 0;

  const playerMap = useMemo(() => {
    const m: Record<string, Player> = {};
    for (const p of initialPlayers) m[p.id] = p;
    return m;
  }, [initialPlayers]);

  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [name, setName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [groupCount, setGroupCount] = useState(1);
  const [advancePerGroup, setAdvancePerGroup] = useState(1);
  const [pending, startTransition] = useTransition();
  const [drawCode, setDrawCode] = useState<string | null>(initialDrawCode);
  const [drawStatus, setDrawStatus] = useState<string | null>(null);

  // Old pre-split A/B flow toggle
  const [crossTierMode, setCrossTierMode] = useState(false);
  // Individual self-draw mode
  const [individualDrawMode, setIndividualDrawMode] = useState(false);
  // Schedule mode (standard vs HD)
  const [scheduleMode, setScheduleMode] = useState<"standard" | "hd">(initialScheduleMode);
  const onChangeScheduleMode = (mode: "standard" | "hd") => {
    if (mode === scheduleMode || hasMatches) return;
    setScheduleMode(mode);
    startTransition(async () => {
      const res = await setPicScheduleMode(eventId, mode);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      toast({ title: `Đã chuyển lịch ${mode === "hd" ? "HD" : "Chuẩn"}` });
    });
  };
  // Individual LIVE draw session (multi-device) — restored from server on page load
  const [liveDraw, setLiveDraw] = useState<{ code: string; playerTokens: Record<string, string> } | null>(initialLiveDraw);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Shared A/B categories (State 1 old flow + State 2 post-split)
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [activeTier, setActiveTier] = useState<Category | null>(null);
  // Preview for old flow
  const [preview, setPreview] = useState<PreviewGroup[] | null>(null);

  const pc = players.length;
  const aCount = useMemo(() => players.filter(p => categories[p.id] === "A").length, [players, categories]);
  const bCount = useMemo(() => players.filter(p => categories[p.id] === "B").length, [players, categories]);
  const untaggedCount = pc - aCount - bCount;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pic-cat-${eventId}`);
      if (saved) setCategories(JSON.parse(saved));
    } catch {}
  }, [eventId]);

  useEffect(() => {
    if (Object.keys(categories).length > 0)
      localStorage.setItem(`pic-cat-${eventId}`, JSON.stringify(categories));
  }, [eventId, categories]);

  const validGroupCounts = useMemo(() => {
    if (!crossTierMode) {
      const result: number[] = [];
      for (let g = 1; g <= Math.ceil(pc / 4); g++) {
        const sizes = snakePreview(pc, g);
        if (sizes.length > 0 && Math.min(...sizes) >= 4 && Math.max(...sizes) <= 8)
          result.push(g);
      }
      return result;
    }
    if (aCount === 0 || aCount !== bCount) return [];
    const result: number[] = [];
    for (let g = 1; g <= aCount; g++) {
      if (aCount % g !== 0) continue;
      const n = aCount / g;
      if (n === 2 || n === 4) result.push(g);
    }
    return result;
  }, [pc, crossTierMode, aCount, bCount]);

  const effG = validGroupCounts.includes(groupCount) ? groupCount : (validGroupCounts[0] ?? 1);

  useEffect(() => { setPreview(null); }, [categories, effG]);

  const groupSizes = useMemo(() => {
    if (!crossTierMode) return snakePreview(pc, effG);
    if (aCount === 0 || aCount !== bCount || validGroupCounts.length === 0) return [];
    return Array.from({ length: effG }, () => (aCount / effG) * 2);
  }, [pc, crossTierMode, effG, aCount, bCount, validGroupCounts.length]);

  useEffect(() => {
    if (crossTierMode || groupSizes.length === 0) return;
    const minSize = Math.min(...groupSizes);
    const stillValid = advancePerGroup < minSize && (effG * advancePerGroup) % 2 === 0 && effG * advancePerGroup >= 2;
    if (!stillValid) setAdvancePerGroup(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effG, crossTierMode]);

  const validAdvanceOptions = useMemo(() => {
    if (crossTierMode || groupSizes.length === 0) return [1];
    const minSize = Math.min(...groupSizes);
    const opts: number[] = [];
    for (let v = 1; v < minSize; v++) {
      if ((effG * v) % 2 === 0 && effG * v >= 2) opts.push(v);
    }
    return opts.length > 0 ? opts : [1];
  }, [groupSizes, effG, crossTierMode]);

  const crossTierError = useMemo(() => {
    if (!crossTierMode) return null;
    if (untaggedCount > 0) return `Còn ${untaggedCount} VĐV chưa được phân hạng`;
    if (aCount !== bCount) return `Hạng A: ${aCount} — Hạng B: ${bCount} — phải bằng nhau`;
    if (aCount === 0) return "Chưa phân hạng A/B";
    if (validGroupCounts.length === 0) return "Không thể chia bảng (cần 2 hoặc 4 VĐV mỗi trình mỗi bảng)";
    return null;
  }, [crossTierMode, untaggedCount, aCount, bCount, validGroupCounts.length]);

  const canGenerate = pc >= 4 && !hasGroups && (
    crossTierMode ? crossTierError === null : validGroupCounts.length > 0
  );

  // State 2: validate A/B per group
  const groupCategoryErrors = useMemo(() => {
    if (!hasGroups || hasMatches) return {} as Record<string, string>;
    const errors: Record<string, string> = {};
    for (const g of initialGroups) {
      const aPs = g.playerIds.filter(id => categories[id] === "A");
      const bPs = g.playerIds.filter(id => categories[id] === "B");
      const untagged = g.playerIds.filter(id => !categories[id]);
      if (untagged.length > 0) errors[g.id] = `Còn ${untagged.length} VĐV chưa phân hạng`;
      else if (aPs.length !== bPs.length) errors[g.id] = `A: ${aPs.length} ≠ B: ${bPs.length}`;
      else if (aPs.length !== 2 && aPs.length !== 4) errors[g.id] = `Cần 2 hoặc 4 VĐV mỗi trình`;
    }
    return errors;
  }, [hasGroups, hasMatches, initialGroups, categories]);

  const canGenerateCrossTier = hasGroups && !hasMatches && initialGroups.length > 0 &&
    Object.keys(groupCategoryErrors).length === 0;

  // Realtime draw
  useEffect(() => {
    if (!drawCode || hasGroups) return;
    const sb = getSupabaseBrowser();
    void sb.from("pair_sessions").select("status").eq("code", drawCode).single().then(({ data }: { data: { status: string } | null }) => {
      if (data) setDrawStatus(data.status);
    });
    const ch = sb
      .channel(`pic-draw:${drawCode}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pair_sessions", filter: `code=eq.${drawCode}` },
        (payload: { new: { status: string } }) => {
          const status = payload.new.status;
          setDrawStatus(status);
          if (status === "shuffled") {
            startTransition(async () => {
              const res = await applyPicDraw(eventId);
              if ("ok" in res) { toast({ title: "Đã áp dụng kết quả bốc thăm!" }); router.refresh(); }
              else toast({ title: "Lỗi áp dụng", description: res.error, variant: "destructive" });
            });
          }
        })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawCode, hasGroups]);

  const handlePlayerTap = (playerId: string) => {
    if (activeTier) {
      setCategories(prev => ({ ...prev, [playerId]: activeTier }));
    } else {
      setCategories(prev => {
        const cur = prev[playerId];
        const next = { ...prev };
        if (!cur) next[playerId] = "A";
        else if (cur === "A") next[playerId] = "B";
        else delete next[playerId];
        return next;
      });
    }
  };

  const computePreview = (): PreviewGroup[] => {
    const aPs = clientShuffle(players.filter(p => categories[p.id] === "A"));
    const bPs = clientShuffle(players.filter(p => categories[p.id] === "B"));
    const aGroups = clientSnake(aPs, effG);
    const bGroups = clientSnake(bPs, effG);
    return aGroups.map((ag, i) => ({ aPlayers: ag, bPlayers: bGroups[i]! }));
  };

  // State 1 handlers
  const onDrawOrPreview = () => {
    if (!canGenerate) return;
    if (crossTierMode) { setPreview(computePreview()); return; }
    // Always crossTierMode=true for random draw — goes to State 2 for A/B assignment
    startTransition(async () => {
      const res = await generatePicGroups(eventId, effG, advancePerGroup, true);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      toast({ title: "Đã chia bảng!", description: "Phân hạng A/B trong từng bảng để tạo lịch." });
      router.refresh();
    });
  };

  const onReshuffle = () => setPreview(computePreview());

  const onConfirm = () => {
    if (!preview) return;
    const groupSlots = preview.map(g => [...g.aPlayers.map(p => p.id), ...g.bPlayers.map(p => p.id)]);
    startTransition(async () => {
      const res = await generateCrossTierGroupsFull(eventId, groupSlots, categories, 1);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      localStorage.removeItem(`pic-cat-${eventId}`);
      toast({ title: "Đã tạo lịch thi đấu!", description: `${effG} bảng A/B.` });
      router.refresh();
    });
  };

  const onCreateLiveIndividualDraw = () => {
    if (!canGenerate || crossTierMode) return;
    startTransition(async () => {
      const res = await createPicIndividualDrawSession(eventId, effG, advancePerGroup);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setLiveDraw({ code: res.code, playerTokens: res.playerTokens });
      toast({ title: "Đã tạo phiên LIVE!", description: "Chia sẻ link cho VĐV." });
    });
  };

  const onCancelLiveIndividualDraw = () => {
    if (!liveDraw) return;
    startTransition(async () => {
      const res = await cancelPicIndividualDrawSession(liveDraw.code);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setLiveDraw(null);
      toast({ title: "Đã hủy phiên LIVE" });
    });
  };

  const copyLink = (url: string, key: string) => {
    navigator.clipboard.writeText(url).catch(() => prompt("Copy link:", url));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const onCreateLiveDraw = () => {
    if (!canGenerate || crossTierMode) return;
    startTransition(async () => {
      const res = await createPicDraw(eventId, effG, advancePerGroup);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setDrawCode(res.code);
      setDrawStatus("locked");
      const url = `${window.location.origin}/pair/${res.code}?host=${res.hostToken}`;
      window.open(url, "_blank");
      toast({ title: "Phòng bốc thăm đã tạo!" });
    });
  };

  const onApplyDraw = () => {
    startTransition(async () => {
      const res = await applyPicDraw(eventId);
      if ("ok" in res) { toast({ title: "Đã áp dụng!" }); router.refresh(); }
      else toast({ title: "Lỗi", description: res.error, variant: "destructive" });
    });
  };

  const onReset = () => {
    startTransition(async () => {
      const res = await resetPicGroups(eventId);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setPreview(null);
      setCategories({});
      toast({ title: "Đã đặt lại bảng" });
      router.refresh();
    });
  };

  // State 2 handlers
  const onGenerateCrossTierMatches = () => {
    startTransition(async () => {
      const res = await generateCrossTierGroupMatches(eventId, categories);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      localStorage.removeItem(`pic-cat-${eventId}`);
      toast({ title: "Đã tạo lịch A/B!" });
      router.refresh();
    });
  };

  const onGenerateNormalMatches = () => {
    startTransition(async () => {
      const res = await generateNormalGroupMatches(eventId);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      toast({ title: "Đã tạo lịch đấu!" });
      router.refresh();
    });
  };

  // Player management
  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || hasGroups) return;
    startTransition(async () => {
      const res = await addPicPlayer(eventId, name.trim());
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setPlayers(prev => [...prev, { id: res.id, name: name.trim() }]);
      setName("");
    });
  };

  const onImport = () => {
    const names = csvText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!names.length || hasGroups) return;
    startTransition(async () => {
      const res = await bulkAddPicPlayers(eventId, names);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      toast({ title: "Đã thêm", description: `${res.count} VĐV` });
      setCsvText("");
      router.refresh();
    });
  };

  const onDelete = (id: string) => {
    if (hasGroups) return;
    startTransition(async () => {
      const res = await removePicPlayer(eventId, id);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setPlayers(prev => prev.filter(p => p.id !== id));
      setCategories(prev => { const n = { ...prev }; delete n[id]; return n; });
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                VĐV ({players.length})
              </CardTitle>
              <CardDescription className="mt-1">
                {!hasGroups
                  ? "Thêm VĐV rồi chia bảng ở phần bên dưới."
                  : hasMatches
                  ? "Bảng đấu và lịch thi đấu đã được tạo."
                  : "Bảng đã chia. Phân hạng A/B trong từng bảng để tạo lịch."}
              </CardDescription>
            </div>
            {hasGroups && !hasCompletedMatches && (
              <Button size="sm" variant="outline" onClick={onReset} disabled={pending} className="shrink-0 text-destructive hover:text-destructive">
                <RefreshCw className="size-3.5" />Đặt lại bảng
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* ── STATE 1A: Individual draw mode ── */}
      {!hasGroups && individualDrawMode && (
        <IndividualDrawClient
          eventId={eventId}
          players={players}
          groupSizes={snakePreview(pc, effG)}
          advancePerGroup={advancePerGroup}
          onCancel={() => setIndividualDrawMode(false)}
        />
      )}

      {/* ── STATE 1: No groups ── */}
      {!hasGroups && !individualDrawMode && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Thêm VĐV</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={onAdd} className="flex gap-2">
                <Input placeholder="Tên VĐV" value={name} onChange={e => setName(e.target.value)} maxLength={100} required className="flex-1" />
                <Button type="submit" disabled={pending || !name.trim()}><Plus className="size-4" />Thêm</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import danh sách</CardTitle>
              <CardDescription>Mỗi dòng 1 tên</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea className="w-full rounded-md border bg-background p-2 font-mono text-sm" rows={6} value={csvText} onChange={e => setCsvText(e.target.value)} placeholder={"Nguyễn Văn A\nTrần Thị B\n..."} />
              <Button onClick={onImport} variant="outline" disabled={pending || !csvText.trim()}><Upload className="size-4" />Import</Button>
            </CardContent>
          </Card>

          {drawCode && (
            <Card className="border-red-400/40 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500"><Radio className="size-4 animate-pulse" />Phòng bốc thăm đang hoạt động</CardTitle>
                <CardDescription>{drawStatus === "shuffled" ? "Đã có kết quả! Đang áp dụng…" : "Chia sẻ link để mọi người cùng xem."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <a href={`/pair/${drawCode}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-mono text-primary hover:bg-accent">
                  <ExternalLink className="size-3.5 shrink-0" />/pair/{drawCode}
                </a>
                {drawStatus === "shuffled" && <Button onClick={onApplyDraw} disabled={pending} className="w-full">Áp dụng kết quả bốc thăm</Button>}
              </CardContent>
            </Card>
          )}

          {/* Active LIVE individual draw session */}
          {liveDraw && (
            <Card className="border-red-400/40 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <Sparkles className="size-4 animate-pulse" />
                  Phiên Quay cá nhân LIVE đang hoạt động
                </CardTitle>
                <CardDescription>
                  Share link cho VĐV — chung (ai cũng tap được) hoặc riêng (chỉ tap được tên mình)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Open link */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">🔓 Link chung (ai cũng tap)</p>
                  <button
                    onClick={() => copyLink(`${window.location.origin}/pic/draw/${liveDraw.code}`, "open")}
                    className="flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm font-mono text-primary hover:bg-accent"
                  >
                    {copiedKey === "open" ? <Check className="size-3.5 text-green-500 shrink-0" /> : <ExternalLink className="size-3.5 shrink-0" />}
                    <span className="truncate">/pic/draw/{liveDraw.code}</span>
                  </button>
                </div>

                {/* Per-player links */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">🔐 Link riêng từng VĐV (chỉ tap được tên mình)</p>
                    <button
                      onClick={() => {
                        const text = players
                          .map((p) => {
                            const tok = liveDraw.playerTokens[p.id];
                            if (!tok) return null;
                            return `${p.name}: ${window.location.origin}/pic/draw/${liveDraw.code}?p=${tok}`;
                          })
                          .filter(Boolean)
                          .join("\n");
                        copyLink(text, "all");
                      }}
                      className="flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                    >
                      {copiedKey === "all" ? <Check className="size-3 text-green-500" /> : <ExternalLink className="size-3" />}
                      Copy tất cả
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-lg border bg-background p-2 space-y-1">
                    {players.map((p) => {
                      const tok = liveDraw.playerTokens[p.id];
                      if (!tok) return null;
                      const url = `${window.location.origin}/pic/draw/${liveDraw.code}?p=${tok}`;
                      const combined = `${p.name}: ${url}`;
                      return (
                        <button
                          key={p.id}
                          onClick={() => copyLink(combined, `p-${p.id}`)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                          title="Click để copy tên + link"
                        >
                          {copiedKey === `p-${p.id}` ? <Check className="size-3 text-green-500 shrink-0" /> : <ExternalLink className="size-3 shrink-0 text-muted-foreground" />}
                          <span className="w-24 truncate font-medium shrink-0">{p.name}</span>
                          <span className="truncate font-mono text-muted-foreground">…?p={tok.slice(0, 8)}…</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <a href={`/pic/draw/${liveDraw.code}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" />Mở phiên (admin)
                    </a>
                  </Button>
                  <Button variant="outline" onClick={onCancelLiveIndividualDraw} disabled={pending} className="text-destructive">
                    Hủy phiên
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sau khi đủ {players.length} lượt quay, mở link admin → click <strong>Lưu kết quả</strong>.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Group generation card */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shuffle className="size-5 text-primary" />Chia bảng đấu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Schedule mode selector */}
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium">Kiểu lịch thi đấu</p>
                  <p className="text-xs text-muted-foreground">Chuẩn (mặc định) hoặc HD (lịch xoay khác)</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onChangeScheduleMode("standard")}
                    disabled={pending || hasMatches}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      scheduleMode === "standard" ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                    }`}
                  >
                    Chuẩn
                  </button>
                  <button
                    onClick={() => onChangeScheduleMode("hd")}
                    disabled={pending || hasMatches}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      scheduleMode === "hd" ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                    }`}
                  >
                    HD ✨
                  </button>
                </div>
              </div>

              {/* Old flow toggle: pre-tag A/B */}
              <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-3">
                <div>
                  <p className="text-sm font-medium">Chế độ A/B (phân hạng trước khi chia bảng)</p>
                  <p className="text-xs text-muted-foreground">Tag A/B toàn bộ VĐV → chia bảng + tạo lịch 1 bước</p>
                </div>
                <div onClick={() => { setCrossTierMode(v => !v); setPreview(null); setActiveTier(null); }}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${crossTierMode ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${crossTierMode ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </label>

              {/* Old flow: A/B tagger */}
              {crossTierMode && !preview && (
                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary">Chọn hạng rồi tap VĐV trong danh sách bên dưới</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setActiveTier(v => v === "A" ? null : "A")}
                      className={`flex h-8 w-12 items-center justify-center rounded-md text-sm font-bold transition-colors ${activeTier === "A" ? "bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-1" : "border bg-white text-blue-600 hover:bg-blue-50"}`}>A</button>
                    <button onClick={() => setActiveTier(v => v === "B" ? null : "B")}
                      className={`flex h-8 w-12 items-center justify-center rounded-md text-sm font-bold transition-colors ${activeTier === "B" ? "bg-orange-500 text-white ring-2 ring-orange-500 ring-offset-1" : "border bg-white text-orange-600 hover:bg-orange-50"}`}>B</button>
                    <span className="text-xs text-muted-foreground">
                      {activeTier ? <>Đang gán <strong>{activeTier}</strong> — nhấn lại để thoát</> : "hoặc tap badge từng VĐV để chuyển A→B→bỏ"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="rounded bg-blue-500/15 px-2 py-0.5 text-blue-600">A: {aCount}</span>
                    <span className="rounded bg-orange-500/15 px-2 py-0.5 text-orange-600">B: {bCount}</span>
                    {untaggedCount > 0 && <span className="text-xs text-muted-foreground">chưa tag: {untaggedCount}</span>}
                  </div>
                  {crossTierError && <p className="text-xs font-medium text-destructive">{crossTierError}</p>}
                </div>
              )}

              {/* Preview (old flow) */}
              {preview && (
                <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-primary">Xem trước phân bảng — kiểm tra rồi xác nhận</p>
                  <div className={`grid gap-3 ${effG <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
                    {preview.map((g, gi) => (
                      <div key={gi} className="rounded-lg border bg-card p-3 space-y-2">
                        <p className="text-xs font-bold text-primary">Bảng {String.fromCharCode(65 + gi)} — {g.aPlayers.length}A + {g.bPlayers.length}B</p>
                        <div className="space-y-1">
                          {g.aPlayers.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 text-xs">
                              <span className="flex h-4 w-5 items-center justify-center rounded bg-blue-500 text-[9px] font-bold text-white">A</span>
                              <span className="truncate">{p.name}</span>
                            </div>
                          ))}
                          {g.bPlayers.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 text-xs">
                              <span className="flex h-4 w-5 items-center justify-center rounded bg-orange-500 text-[9px] font-bold text-white">B</span>
                              <span className="truncate">{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={onReshuffle} disabled={pending} className="flex-1"><RefreshCw className="size-3.5" />Xáo lại</Button>
                    <Button onClick={onConfirm} disabled={pending} className="flex-1"><Check className="size-3.5" />{pending ? "Đang tạo…" : "Xác nhận & Tạo lịch"}</Button>
                  </div>
                  <button onClick={() => setPreview(null)} className="text-xs text-muted-foreground underline">← Quay lại chỉnh hạng</button>
                </div>
              )}

              {!preview && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Tổng VĐV</p>
                      <div className="flex h-10 items-center rounded-md border bg-secondary/30 px-3 text-sm">{pc} người</div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Số bảng</p>
                      {validGroupCounts.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {validGroupCounts.map(g => {
                            const sizes = crossTierMode
                              ? Array.from({ length: g }, () => (aCount / g) * 2)
                              : snakePreview(pc, g);
                            const unique = [...new Set(sizes)].sort((a, b) => a - b);
                            const tag = unique.length === 1 ? `${unique[0]}ng` : `${unique[0]}–${unique[unique.length - 1]}ng`;
                            return (
                              <button key={g} onClick={() => setGroupCount(g)}
                                className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors ${effG === g ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"}`}>
                                {g} bảng <span className="text-xs font-normal opacity-60">{tag}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{crossTierMode ? "Tag đủ A=B trước" : "Cần ít nhất 4 VĐV"}</p>
                      )}
                    </div>
                    {!crossTierMode && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Vào vòng trong</p>
                        <div className="flex flex-wrap gap-1.5">
                          {validAdvanceOptions.map(v => (
                            <button key={v} onClick={() => setAdvancePerGroup(v)}
                              className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors ${advancePerGroup === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"}`}>
                              <span className="block">Top {v}/bảng</span>
                              <span className="block text-xs font-normal opacity-60">→ {effG * v} người tổng</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {groupSizes.length > 0 && (
                    <div className={`grid gap-2 rounded-xl border bg-muted/30 p-3 ${effG <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {groupSizes.map((size, gi) => (
                        <div key={gi} className="space-y-0.5">
                          <p className="text-xs font-bold text-primary">Bảng {String.fromCharCode(65 + gi)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {crossTierMode ? `${size / 2}A + ${size / 2}B` : `${size} người`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`grid gap-2 ${crossTierMode ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
                    <Button onClick={onDrawOrPreview} disabled={!canGenerate || pending || !!drawCode || !!liveDraw} variant="outline" size="lg">
                      <Shuffle className="size-4" />
                      {pending ? "Đang tạo…" : crossTierMode ? "🎲 Xem phân bảng" : "🎲 Quay ngay"}
                    </Button>
                    {!crossTierMode && (
                      <>
                        <Button
                          onClick={() => setIndividualDrawMode(true)}
                          disabled={!canGenerate || pending || !!drawCode || !!liveDraw}
                          variant="outline"
                          size="lg"
                          className="border-primary/40 text-primary hover:bg-primary/10"
                        >
                          <Sparkles className="size-4" />
                          ✨ Cá nhân
                        </Button>
                        <Button
                          onClick={onCreateLiveIndividualDraw}
                          disabled={!canGenerate || pending || !!drawCode || !!liveDraw}
                          size="lg"
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          <Sparkles className="size-4" />
                          🌐 Cá nhân LIVE
                        </Button>
                        <Button onClick={onCreateLiveDraw} disabled={!canGenerate || pending || !!drawCode || !!liveDraw} size="lg">
                          <Radio className="size-4" />{pending ? "Đang tạo…" : "📺 LIVE bảng"}
                        </Button>
                      </>
                    )}
                  </div>
                  {!crossTierMode && (
                    <p className="text-[11px] text-muted-foreground">
                      <strong>Quay ngay</strong>: random tức thì · <strong>Cá nhân</strong>: tự tap 1 thiết bị · <strong>Cá nhân LIVE</strong>: mỗi VĐV tap từ máy riêng · <strong>LIVE bảng</strong>: bốc cả bảng cùng lúc
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    ⚠️ Chia bảng 1 lần duy nhất. Sau khi quay, sang tab <strong>Trận đấu</strong> để nhập điểm.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── STATE 2: Groups exist, no matches → A/B assignment ── */}
      {hasGroups && !hasMatches && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shuffle className="size-5 text-primary" />
              Phân hạng A/B trong từng bảng
            </CardTitle>
            <CardDescription>Mỗi bảng cần số VĐV hạng A = hạng B (2+2 hoặc 4+4)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Schedule mode selector */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium">Kiểu lịch thi đấu — đổi trước khi tạo lịch</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onChangeScheduleMode("standard")}
                  disabled={pending}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    scheduleMode === "standard" ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                  }`}
                >
                  Chuẩn
                </button>
                <button
                  onClick={() => onChangeScheduleMode("hd")}
                  disabled={pending}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    scheduleMode === "hd" ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                  }`}
                >
                  HD ✨
                </button>
              </div>
            </div>

            {/* Batch mode */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Gán nhanh:</span>
              <button onClick={() => setActiveTier(v => v === "A" ? null : "A")}
                className={`flex h-8 w-12 items-center justify-center rounded-md text-sm font-bold transition-colors ${activeTier === "A" ? "bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-1" : "border bg-white text-blue-600 hover:bg-blue-50"}`}>A</button>
              <button onClick={() => setActiveTier(v => v === "B" ? null : "B")}
                className={`flex h-8 w-12 items-center justify-center rounded-md text-sm font-bold transition-colors ${activeTier === "B" ? "bg-orange-500 text-white ring-2 ring-orange-500 ring-offset-1" : "border bg-white text-orange-600 hover:bg-orange-50"}`}>B</button>
              <span className="text-xs text-muted-foreground">
                {activeTier ? <>Đang gán <strong>{activeTier}</strong> — nhấn lại để thoát</> : "hoặc tap badge từng VĐV để chuyển A→B→bỏ"}
              </span>
            </div>

            {/* Groups grid */}
            <div className={`grid gap-3 ${initialGroups.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
              {initialGroups.map(g => {
                const err = groupCategoryErrors[g.id];
                const aPs = g.playerIds.filter(id => categories[id] === "A");
                const bPs = g.playerIds.filter(id => categories[id] === "B");
                const allTagged = !err && aPs.length > 0;
                return (
                  <div key={g.id} className={`rounded-lg border p-3 space-y-2 ${err ? "border-destructive/40" : allTagged ? "border-green-500/40 bg-green-500/5" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-primary">Bảng {g.label}</p>
                      <div className="flex gap-1 text-xs">
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-600">A:{aPs.length}</span>
                        <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-600">B:{bPs.length}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {g.playerIds.map(id => {
                        const p = playerMap[id];
                        const cat = categories[id];
                        return (
                          <div key={id} onClick={() => handlePlayerTap(id)}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-accent active:scale-95 transition-transform select-none">
                            <span className="truncate">{p?.name ?? id}</span>
                            <span className={`flex h-5 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                              cat === "A" ? "bg-blue-500 text-white"
                              : cat === "B" ? "bg-orange-500 text-white"
                              : "border bg-muted text-muted-foreground"
                            }`}>{cat ?? "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                    {err && <p className="text-[10px] text-destructive">{err}</p>}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={onGenerateCrossTierMatches} disabled={!canGenerateCrossTier || pending}>
                <Check className="size-4" />{pending ? "Đang tạo…" : "Tạo lịch A/B"}
              </Button>
              <Button variant="outline" onClick={onGenerateNormalMatches} disabled={pending}>
                <Shuffle className="size-4" />{pending ? "Đang tạo…" : "Tạo lịch ngẫu nhiên"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Lịch A/B: mỗi đội = 1 VĐV hạng A + 1 VĐV hạng B (cần phân hạng đủ). Lịch ngẫu nhiên: bỏ qua phân hạng.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Player list (all states) ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Danh sách VĐV</CardTitle></CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chưa có VĐV nào.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p, i) => {
                const cat = categories[p.id];
                const isActive = !hasGroups && crossTierMode && !preview;
                return (
                  <div key={p.id}
                    onClick={isActive ? () => handlePlayerTap(p.id) : undefined}
                    className={`flex items-center justify-between gap-2 rounded-md border p-2 text-sm ${isActive ? "cursor-pointer select-none active:scale-95 transition-transform" : ""} ${isActive && activeTier ? "hover:bg-accent" : ""}`}>
                    <span className="flex flex-1 items-center gap-2 truncate">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">{i + 1}</span>
                      <span className="truncate">{p.name}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && (
                        <span className={`flex h-6 w-7 items-center justify-center rounded text-xs font-bold transition-colors ${
                          cat === "A" ? "bg-blue-500 text-white"
                          : cat === "B" ? "bg-orange-500 text-white"
                          : "border bg-muted text-muted-foreground"
                        }`}>{cat ?? "—"}</span>
                      )}
                      {!hasGroups && !preview && (
                        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onDelete(p.id); }} disabled={pending}>
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
