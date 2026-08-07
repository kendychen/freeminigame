"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Upload, Users, Check, X, Pencil, Lock, Shuffle, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import {
  addTeamSquad, updateTeamSquad, removeTeamSquad, addTeamPlayer, updateTeamPlayer,
  removeTeamPlayer, bulkAddTeamPlayers, generateTeamSchedule,
} from "@/app/actions/team";
import { CATEGORY_LABELS } from "@/lib/team/types";
import type { Gender, RubberCategory, TeamConfig, TeamStage } from "@/lib/team/types";
import {
  meetsRosterMinimum, recommendedDistinctPlayers, rosterRequirement, validateSquadRoster,
} from "@/lib/team/validate";

interface Squad { id: string; name: string; groupLabel: string | null }
interface Player { id: string; name: string; gender: Gender; squadId: string | null }

function groupSizesFor(n: number, k: number): number[] {
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
}

function tiesFor(size: number): number {
  return (size * (size - 1)) / 2;
}

function parseBulkLine(line: string): { name: string; gender: Gender } {
  const parts = line.split(",");
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!.trim().toLowerCase();
    const rest = parts.slice(0, -1).join(",").trim();
    if (["nữ", "nu", "f"].includes(last)) return { name: rest, gender: "F" };
    if (["nam", "m"].includes(last)) return { name: rest, gender: "M" };
  }
  return { name: line.trim(), gender: "M" };
}

function categoryCheck(
  cat: RubberCategory,
  m: number,
  f: number,
  total: number,
  config: TeamConfig,
): { ok: boolean; reason: string } {
  const req = rosterRequirement(config);
  const simple = config.allowRepeatPlayer !== false;
  let needM = 0, needF = 0, needTotal = 0;
  if (cat === "MD") needM = simple ? 2 : req.minM;
  else if (cat === "WD") needF = simple ? 2 : req.minF;
  else if (cat === "XD") { needM = simple ? 1 : req.minM; needF = simple ? 1 : req.minF; }
  else needTotal = simple ? 2 : req.minTotal;
  const reasons: string[] = [];
  if (m < needM) reasons.push("thiếu nam");
  if (f < needF) reasons.push("thiếu nữ");
  if (total < needTotal) reasons.push("thiếu VĐV");
  return { ok: reasons.length === 0, reason: reasons.join(" & ") };
}

export default function SquadsClient({
  eventId,
  slug,
  stage,
  config,
  initialSquads,
  initialPlayers,
  lineupPlayerIds,
  genderLockedPlayerIds,
}: {
  eventId: string;
  slug: string;
  stage: TeamStage;
  config: TeamConfig;
  initialSquads: Squad[];
  initialPlayers: Player[];
  lineupPlayerIds: string[];
  genderLockedPlayerIds: string[];
}) {
  const router = useRouter();
  const isSetup = stage === "setup";
  const [pending, startTransition] = useTransition();

  const [squads, setSquads] = useState<Squad[]>(initialSquads);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  useEffect(() => { setSquads(initialSquads); }, [initialSquads]);
  useEffect(() => { setPlayers(initialPlayers); }, [initialPlayers]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSquads[0]?.id ?? null);
  useEffect(() => {
    if (selectedId && squads.some(s => s.id === selectedId)) return;
    setSelectedId(squads[0]?.id ?? null);
  }, [squads, selectedId]);

  const [squadName, setSquadName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerGender, setPlayerGender] = useState<Gender | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [groupCount, setGroupCount] = useState(1);

  const lineupSet = useMemo(() => new Set(lineupPlayerIds), [lineupPlayerIds]);
  const genderLockedSet = useMemo(() => new Set(genderLockedPlayerIds), [genderLockedPlayerIds]);

  const selectedSquad = squads.find(s => s.id === selectedId) ?? null;
  const roster = useMemo(
    () => players.filter(p => p.squadId === selectedId),
    [players, selectedId],
  );
  const rosterM = roster.filter(p => p.gender === "M").length;
  const rosterF = roster.filter(p => p.gender === "F").length;
  const totalM = players.filter(p => p.gender === "M").length;
  const totalF = players.filter(p => p.gender === "F").length;

  const distinctCategories = useMemo(() => [...new Set(config.rubbers)], [config.rubbers]);
  const categoryCounts = useMemo(() => {
    const c: Partial<Record<RubberCategory, number>> = {};
    for (const r of config.rubbers) c[r] = (c[r] ?? 0) + 1;
    return c;
  }, [config.rubbers]);
  const recommended = recommendedDistinctPlayers(config);

  const rosterErrors = useMemo(
    () => squads.flatMap(s =>
      validateSquadRoster(s.name, players.filter(p => p.squadId === s.id), config),
    ),
    [squads, players, config],
  );

  const n = squads.length;
  const maxGroups = Math.max(1, Math.floor(n / 2));
  const effG = Math.min(groupCount, maxGroups);
  const sizes = n >= 2 ? groupSizesFor(n, effG) : [];
  const uniqSizes = [...new Set(sizes)].sort((a, b) => a - b);
  const totalTies = sizes.reduce((sum, s) => sum + tiesFor(s), 0);
  const previewText = n >= 2
    ? effG === 1
      ? `1 bảng × ${n} đội — ${totalTies} trận đối đầu`
      : uniqSizes.length === 1
      ? `${effG} bảng × ${uniqSizes[0]} đội — ${tiesFor(uniqSizes[0]!)} trận đối đầu/bảng · tổng ${totalTies} trận`
      : `${effG} bảng (${uniqSizes[0]}–${uniqSizes[uniqSizes.length - 1]} đội) — ${tiesFor(uniqSizes[0]!)}–${tiesFor(uniqSizes[uniqSizes.length - 1]!)} trận đối đầu/bảng · tổng ${totalTies} trận`
    : null;

  const canGenerate = isSetup && n >= 2 && rosterErrors.length === 0 && !pending;

  const genderLockReason = (p: Player): string | null => {
    if (genderLockedSet.has(p.id))
      return "Đang trong đội hình đôi nam/đôi nữ/đôi nam nữ — không đổi được giới tính";
    if (!isSetup && p.squadId) {
      const mates = players.filter(x => x.squadId === p.squadId);
      const after = mates.map(x =>
        x.id === p.id ? { gender: (p.gender === "M" ? "F" : "M") as Gender } : { gender: x.gender },
      );
      if (!meetsRosterMinimum(after, config)) return "Đổi sẽ khiến đội thiếu VĐV tối thiểu";
    }
    return null;
  };

  const onAddSquad = (e: React.FormEvent) => {
    e.preventDefault();
    const name = squadName.trim();
    if (!name || !isSetup) return;
    startTransition(async () => {
      const res = await addTeamSquad(eventId, name);
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      setSquads(prev => [...prev, { id: res.id, name, groupLabel: null }]);
      setSelectedId(res.id);
      setSquadName("");
    });
  };

  const onRemoveSquad = (id: string) => {
    if (!isSetup) return;
    startTransition(async () => {
      const res = await removeTeamSquad(eventId, id);
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      setSquads(prev => prev.filter(s => s.id !== id));
      setPlayers(prev => prev.map(p => p.squadId === id ? { ...p, squadId: null } : p));
    });
  };

  // Edit squad name inline (available in every stage — updateTeamSquad has no stage lock)
  const [editingSquadId, setEditingSquadId] = useState<string | null>(null);
  const [squadEditValue, setSquadEditValue] = useState("");
  const startSquadEdit = (s: Squad) => { setEditingSquadId(s.id); setSquadEditValue(s.name); };
  const cancelSquadEdit = () => { setEditingSquadId(null); setSquadEditValue(""); };
  const saveSquadEdit = (id: string) => {
    const newName = squadEditValue.trim();
    if (!newName) { cancelSquadEdit(); return; }
    const current = squads.find(s => s.id === id);
    if (current && current.name === newName) { cancelSquadEdit(); return; }
    startTransition(async () => {
      const res = await updateTeamSquad(eventId, id, newName);
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      setSquads(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
      cancelSquadEdit();
    });
  };

  const onAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = playerName.trim();
    if (!name || !selectedId || !playerGender) return;
    startTransition(async () => {
      const res = await addTeamPlayer(eventId, selectedId, name, playerGender);
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      setPlayers(prev => [...prev, { id: res.id, name, gender: playerGender, squadId: selectedId }]);
      setPlayerName("");
    });
  };

  const onToggleGender = (p: Player) => {
    const reason = genderLockReason(p);
    if (reason) { toast({ title: "Không đổi được", description: reason, variant: "destructive" }); return; }
    const next: Gender = p.gender === "M" ? "F" : "M";
    startTransition(async () => {
      const res = await updateTeamPlayer(eventId, p.id, { gender: next });
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, gender: next } : x));
    });
  };

  const onDeletePlayer = (id: string) => {
    startTransition(async () => {
      const res = await removeTeamPlayer(eventId, id);
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      setPlayers(prev => prev.filter(p => p.id !== id));
    });
  };

  const onImport = () => {
    if (!selectedId) return;
    const rows = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(parseBulkLine).filter(r => r.name);
    if (!rows.length) return;
    startTransition(async () => {
      const res = await bulkAddTeamPlayers(eventId, selectedId, rows);
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      toast({ title: "Đã thêm", description: `${res.count} VĐV` });
      setBulkText("");
      router.refresh();
    });
  };

  const onGenerate = () => {
    if (!canGenerate) return;
    startTransition(async () => {
      const res = await generateTeamSchedule(eventId, effG);
      if ("error" in res) {
        if (res.detail?.length) {
          for (const d of res.detail) toast({ title: "Thiếu VĐV", description: d, variant: "destructive" });
        } else {
          toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
        }
        return;
      }
      toast({ title: "Đã tạo lịch thi đấu!", description: `${effG} bảng · ${totalTies} trận đối đầu.` });
      router.push(`/team/${slug}/ties`);
    });
  };

  // Edit player name inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const startEdit = (p: Player) => { setEditingId(p.id); setEditValue(p.name); };
  const cancelEdit = () => { setEditingId(null); setEditValue(""); };
  const saveEdit = (id: string) => {
    const newName = editValue.trim();
    if (!newName) { cancelEdit(); return; }
    const current = players.find(x => x.id === id);
    if (current && current.name === newName) { cancelEdit(); return; }
    startTransition(async () => {
      const res = await updateTeamPlayer(eventId, id, { name: newName });
      if ("error" in res) { toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" }); return; }
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
      cancelEdit();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Đội ({squads.length})
          </CardTitle>
          <CardDescription className="mt-1">
            {isSetup
              ? "Thêm đội, gán VĐV rồi tạo lịch thi đấu ở cuối trang."
              : "Lịch thi đấu đã tạo — đội đã khóa, VĐV vẫn chỉnh được trong giới hạn tối thiểu."}
            {players.length > 0 && (
              <span className="ml-1 font-medium text-foreground">
                Toàn giải: {totalM} Nam · {totalF} Nữ
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Squad chips */}
          <div className="flex flex-wrap gap-2">
            {squads.map(s => {
              const sRoster = players.filter(p => p.squadId === s.id);
              const m = sRoster.filter(p => p.gender === "M").length;
              const f = sRoster.filter(p => p.gender === "F").length;
              const ok = meetsRosterMinimum(sRoster, config);
              const active = selectedId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex cursor-pointer select-none items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors active:scale-95 ${
                    active ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                  }`}
                >
                  {editingSquadId === s.id ? (
                    <Input
                      autoFocus
                      value={squadEditValue}
                      onChange={e => setSquadEditValue(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); saveSquadEdit(s.id); }
                        else if (e.key === "Escape") { e.preventDefault(); cancelSquadEdit(); }
                      }}
                      onBlur={() => saveSquadEdit(s.id)}
                      maxLength={80}
                      className="h-7 w-32 text-sm"
                    />
                  ) : (
                    <span className="font-semibold">{s.name}</span>
                  )}
                  {s.groupLabel && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      Bảng {s.groupLabel}
                    </span>
                  )}
                  <span className={`text-xs ${ok ? "text-muted-foreground" : "font-semibold text-destructive"}`}>
                    {m}♂ {f}♀
                  </span>
                  {editingSquadId !== s.id && (
                    <button
                      onClick={e => { e.stopPropagation(); startSquadEdit(s); }}
                      disabled={pending}
                      title="Sửa tên đội"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  {isSetup && editingSquadId !== s.id && (
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveSquad(s.id); }}
                      disabled={pending}
                      title="Xóa đội"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {squads.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có đội nào — thêm đội để bắt đầu.</p>
            )}
          </div>

          {/* Add squad */}
          {isSetup && (
            <form onSubmit={onAddSquad} className="flex gap-2">
              <Input
                placeholder="Tên đội"
                value={squadName}
                onChange={e => setSquadName(e.target.value)}
                maxLength={80}
                className="flex-1"
              />
              <Button type="submit" disabled={pending || !squadName.trim()}>
                <Plus className="size-4" />Thêm đội
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Post-schedule banner */}
      {!isSetup && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <p className="text-sm">Sang tab <strong>Đối đầu</strong> để xếp đội hình và nhập điểm.</p>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/team/${slug}/ties`}>
                Xem lịch đấu<ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Roster panel */}
      {selectedSquad && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{selectedSquad.name}</CardTitle>
                <CardDescription className="mt-1">
                  <span className={meetsRosterMinimum(roster, config) ? "" : "font-semibold text-destructive"}>
                    {rosterM}♂ {rosterF}♀ / {config.teamSize}
                  </span>
                </CardDescription>
              </div>
            </div>
            {/* Per-category feasibility badges */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {distinctCategories.map(cat => {
                const check = categoryCheck(cat, rosterM, rosterF, roster.length, config);
                const count = categoryCounts[cat] ?? 0;
                return (
                  <span
                    key={cat}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                      check.ok ? "bg-green-500/15 text-green-600" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {check.ok ? <Check className="size-3" /> : <X className="size-3" />}
                    {CATEGORY_LABELS[cat]}{count > 1 ? ` ×${count}` : ""}
                    {!check.ok && ` — ${check.reason}`}
                  </span>
                );
              })}
              {roster.length > 0 && roster.length < recommended && (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                  Khuyến nghị ≥{recommended} VĐV để không ai phải đánh 2 nội dung
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add player: name + mandatory gender pill */}
            <form onSubmit={onAddPlayer} className="flex gap-2">
              <Input
                placeholder="Tên VĐV"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={100}
                className="flex-1"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPlayerGender("M")}
                  className={`h-10 rounded-md border px-3 text-sm font-semibold transition-colors ${
                    playerGender === "M" ? "border-blue-500 bg-blue-500 text-white" : "text-blue-600 hover:border-blue-400"
                  }`}
                >
                  Nam
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerGender("F")}
                  className={`h-10 rounded-md border px-3 text-sm font-semibold transition-colors ${
                    playerGender === "F" ? "border-pink-500 bg-pink-500 text-white" : "text-pink-600 hover:border-pink-400"
                  }`}
                >
                  Nữ
                </button>
              </div>
              <Button type="submit" disabled={pending || !playerName.trim() || !playerGender}>
                <Plus className="size-4" />Thêm
              </Button>
            </form>
            {!playerGender && playerName.trim() && (
              <p className="text-xs text-destructive">Chọn giới tính Nam/Nữ trước khi thêm.</p>
            )}

            {/* Player list */}
            {roster.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Đội chưa có VĐV nào.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {roster.map((p, i) => {
                  const lockReason = genderLockReason(p);
                  const inLineup = lineupSet.has(p.id);
                  const isEditing = editingId === p.id;
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span className="flex flex-1 items-center gap-2 truncate">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">{i + 1}</span>
                        {isEditing ? (
                          <Input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") { e.preventDefault(); saveEdit(p.id); }
                              else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                            }}
                            onBlur={() => saveEdit(p.id)}
                            maxLength={100}
                            className="h-7 flex-1 text-sm"
                          />
                        ) : (
                          <span className="truncate">{p.name}</span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => onToggleGender(p)}
                          disabled={pending}
                          title={lockReason ?? "Tap để đổi giới tính"}
                          className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] font-bold text-white transition-transform ${
                            p.gender === "M" ? "bg-blue-500" : "bg-pink-500"
                          } ${lockReason ? "cursor-not-allowed opacity-60" : "active:scale-95"}`}
                        >
                          {lockReason && <Lock className="size-3" />}
                          {p.gender === "M" ? "Nam" : "Nữ"}
                        </button>
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" onMouseDown={e => { e.preventDefault(); saveEdit(p.id); }} disabled={pending} title="Lưu" className="h-9 w-9 p-0">
                              <Check className="size-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onMouseDown={e => { e.preventDefault(); cancelEdit(); }} disabled={pending} title="Hủy" className="h-9 w-9 p-0">
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => startEdit(p)} disabled={pending} title="Sửa tên" className="h-9 w-9 p-0">
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeletePlayer(p.id)}
                              disabled={pending || inLineup}
                              title={inLineup ? "VĐV đang trong đội hình — không xóa được" : "Xoá"}
                              className="h-9 w-9 p-0"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bulk import */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium">Import nhanh — mỗi dòng: <code>Tên, nữ</code> (mặc định nam)</p>
              <textarea
                className="w-full rounded-md border bg-background p-2 font-mono text-sm"
                rows={4}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"Nguyễn Văn A\nTrần Thị B, nữ\n..."}
              />
              <Button onClick={onImport} variant="outline" size="sm" disabled={pending || !bulkText.trim()}>
                <Upload className="size-4" />Import vào {selectedSquad.name}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Group split + generate schedule */}
      {isSetup && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shuffle className="size-5 text-primary" />
              Chia bảng & tạo lịch
            </CardTitle>
            <CardDescription>Chia ngẫu nhiên các đội vào bảng, mỗi bảng đấu vòng tròn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {n < 2 ? (
              <p className="text-sm text-muted-foreground">Cần ít nhất 2 đội để tạo lịch.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Số bảng</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: maxGroups }, (_, i) => i + 1).map(k => (
                      <button
                        key={k}
                        onClick={() => setGroupCount(k)}
                        className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                          effG === k ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                        }`}
                      >
                        {k} bảng
                        {k === 2 && n >= 6 && <span className="ml-1 text-xs font-normal text-amber-600">gợi ý</span>}
                      </button>
                    ))}
                  </div>
                  {previewText && <p className="text-xs text-muted-foreground">{previewText}</p>}
                </div>

                {rosterErrors.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    {rosterErrors.map((err, i) => (
                      <p key={i} className="text-xs font-medium text-destructive">{err}</p>
                    ))}
                  </div>
                )}

                <Button onClick={onGenerate} disabled={!canGenerate} size="lg" className="w-full">
                  <Calendar className="size-4" />
                  {pending ? "Đang tạo…" : "Tạo lịch thi đấu"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Sau khi tạo lịch, đội bị khóa — VĐV vẫn thêm/sửa được trong giới hạn tối thiểu.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
