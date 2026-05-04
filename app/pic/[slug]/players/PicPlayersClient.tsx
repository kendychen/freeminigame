"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, Shuffle, Users, Radio, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { addPicPlayer, removePicPlayer, bulkAddPicPlayers, generatePicGroups, createPicDraw, applyPicDraw } from "@/app/actions/pic";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface Player { id: string; name: string }

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

export default function PicPlayersClient({
  eventId,
  initialPlayers,
  hasGroups,
  drawCode: initialDrawCode,
}: {
  eventId: string;
  initialPlayers: Player[];
  hasGroups: boolean;
  drawCode: string | null;
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [name, setName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [groupCount, setGroupCount] = useState(1);
  const [advancePerGroup, setAdvancePerGroup] = useState(1);
  const [pending, startTransition] = useTransition();
  const [drawCode, setDrawCode] = useState<string | null>(initialDrawCode);
  const [drawStatus, setDrawStatus] = useState<string | null>(null);

  const pc = players.length;

  const validGroupCounts = useMemo(() => {
    const result: number[] = [];
    for (let g = 1; g <= Math.ceil(pc / 4); g++) {
      const sizes = snakePreview(pc, g);
      if (sizes.length > 0 && Math.min(...sizes) >= 4 && Math.max(...sizes) <= 8)
        result.push(g);
    }
    return result;
  }, [pc]);

  const effG = validGroupCounts.includes(groupCount) ? groupCount : (validGroupCounts[0] ?? 1);
  const groupSizes = useMemo(() => snakePreview(pc, effG), [pc, effG]);
  const canGenerate = pc >= 4 && validGroupCounts.length > 0 && !hasGroups;

  // Subscribe to pair session realtime — auto-apply when shuffled
  useEffect(() => {
    if (!drawCode || hasGroups) return;
    const sb = getSupabaseBrowser();
    // Load current status first
    void sb.from("pair_sessions").select("status").eq("code", drawCode).single().then(({ data }: { data: { status: string } | null }) => {
      if (data) setDrawStatus(data.status);
    });
    const ch = sb
      .channel(`pic-draw:${drawCode}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pair_sessions", filter: `code=eq.${drawCode}` },
        (payload: { new: { status: string } }) => {
          const status = payload.new.status;
          setDrawStatus(status);
          if (status === "shuffled") {
            startTransition(async () => {
              const res = await applyPicDraw(eventId);
              if ("ok" in res) {
                toast({ title: "Đã áp dụng kết quả bốc thăm!" });
                router.refresh();
              } else {
                toast({ title: "Lỗi áp dụng", description: res.error, variant: "destructive" });
              }
            });
          }
        },
      )
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawCode, hasGroups]);

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || hasGroups) return;
    startTransition(async () => {
      const res = await addPicPlayer(eventId, name.trim());
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setPlayers((prev) => [...prev, { id: res.id, name: name.trim() }]);
      setName("");
    });
  };

  const onImport = () => {
    const names = csvText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
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
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    });
  };

  const onGenerate = () => {
    if (!canGenerate) return;
    startTransition(async () => {
      const res = await generatePicGroups(eventId, effG, advancePerGroup);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      toast({ title: "Đã chia bảng!", description: `${effG} bảng đã được tạo ngẫu nhiên.` });
      router.refresh();
    });
  };

  const onCreateLiveDraw = () => {
    if (!canGenerate) return;
    startTransition(async () => {
      const res = await createPicDraw(eventId, effG, advancePerGroup);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setDrawCode(res.code);
      setDrawStatus("locked");
      const url = `${window.location.origin}/pair/${res.code}?host=${res.hostToken}`;
      window.open(url, "_blank");
      toast({ title: "Phòng bốc thăm đã tạo!", description: "Chia sẻ link để mọi người cùng xem." });
    });
  };

  const onApplyDraw = () => {
    startTransition(async () => {
      const res = await applyPicDraw(eventId);
      if ("ok" in res) { toast({ title: "Đã áp dụng!" }); router.refresh(); }
      else toast({ title: "Lỗi", description: res.error, variant: "destructive" });
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            VĐV ({pc})
          </CardTitle>
          <CardDescription>
            {hasGroups
              ? "Bảng đấu đã được tạo. Danh sách VĐV đã cố định."
              : "Thêm VĐV rồi chia bảng ngẫu nhiên ở phần bên dưới."}
          </CardDescription>
        </CardHeader>
      </Card>

      {!hasGroups && (
        <>
          {/* Add one */}
          <Card>
            <CardHeader><CardTitle className="text-base">Thêm VĐV</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={onAdd} className="flex gap-2">
                <Input
                  placeholder="Tên VĐV"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={pending || !name.trim()}>
                  <Plus className="size-4" />Thêm
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Bulk import */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import danh sách</CardTitle>
              <CardDescription>Mỗi dòng 1 tên</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                className="w-full rounded-md border bg-background p-2 font-mono text-sm"
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"Nguyễn Văn A\nTrần Thị B\nLê Văn C\n..."}
              />
              <Button onClick={onImport} variant="outline" disabled={pending || !csvText.trim()}>
                <Upload className="size-4" />Import
              </Button>
            </CardContent>
          </Card>

          {/* Live draw session — shown when active */}
          {drawCode && (
            <Card className="border-red-400/40 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <Radio className="size-4 animate-pulse" />
                  Phòng bốc thăm đang hoạt động
                </CardTitle>
                <CardDescription>
                  {drawStatus === "shuffled"
                    ? "Đã có kết quả! Đang áp dụng vào giải…"
                    : "Chia sẻ link bên dưới để mọi người cùng xem quay bảng."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href={`/pair/${drawCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-mono text-primary hover:bg-accent"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  /pair/{drawCode}
                </a>
                {drawStatus === "shuffled" && (
                  <Button onClick={onApplyDraw} disabled={pending} className="w-full">
                    Áp dụng kết quả bốc thăm
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Group generation */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="size-5 text-primary" />
                Chia bảng đấu
              </CardTitle>
              <CardDescription>
                Chọn số bảng, rồi quay ngay hoặc tạo phòng bốc thăm realtime để mọi người cùng xem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tổng VĐV</p>
                  <div className="flex h-10 items-center rounded-md border bg-secondary/30 px-3 text-sm">
                    {pc} người
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Số bảng</p>
                  {validGroupCounts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {validGroupCounts.map((g) => {
                        const sizes = snakePreview(pc, g);
                        const unique = [...new Set(sizes)].sort((a, b) => a - b);
                        const tag = unique.length === 1 ? `${unique[0]}ng` : `${unique[0]}–${unique[unique.length - 1]}ng`;
                        return (
                          <button key={g} onClick={() => setGroupCount(g)}
                            className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                              effG === g ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                            }`}>
                            {g} bảng <span className="text-xs font-normal opacity-60">{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Cần ít nhất 4 VĐV</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Vào chung kết/bảng</p>
                  <div className="flex gap-1.5">
                    {[1, 2].map((v) => {
                      const total = effG * v;
                      const ok = total >= 2 && total % 2 === 0;
                      return (
                        <button key={v} onClick={() => ok && setAdvancePerGroup(v)} disabled={!ok}
                          className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                            advancePerGroup === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                          }`}>
                          Top {v}
                          <span className="ml-1 text-xs font-normal opacity-60">({total}ng)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {validGroupCounts.length > 0 && pc >= 4 && (
                <div className={`grid gap-2 rounded-xl border bg-muted/30 p-3 ${effG <= 2 ? "grid-cols-2" : effG <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {groupSizes.map((size, gi) => (
                    <div key={gi} className="space-y-0.5">
                      <p className="text-xs font-bold text-primary">Bảng {String.fromCharCode(65 + gi)}</p>
                      <p className="text-[11px] text-muted-foreground">{size} người</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={onGenerate} disabled={!canGenerate || pending || !!drawCode} variant="outline" size="lg">
                  <Shuffle className="size-4" />
                  {pending ? "Đang tạo…" : "🎲 Quay ngay (local)"}
                </Button>
                <Button onClick={onCreateLiveDraw} disabled={!canGenerate || pending || !!drawCode} size="lg">
                  <Radio className="size-4" />
                  {pending ? "Đang tạo…" : "📺 Quay LIVE (realtime)"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Chia bảng 1 lần duy nhất. Sau khi quay, sang tab <strong>Trận đấu</strong> để nhập điểm.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Player list */}
      <Card>
        <CardHeader><CardTitle className="text-base">Danh sách</CardTitle></CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chưa có VĐV nào. Thêm ở trên hoặc import danh sách.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span className="flex flex-1 items-center gap-2 truncate">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </span>
                  {!hasGroups && (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(p.id)} disabled={pending}>
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
