"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, Shuffle, Users, Radio, ExternalLink, RefreshCw, Check, Sparkles, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  addPicPlayer, removePicPlayer, updatePicPlayer, bulkAddPicPlayers,
  generatePicGroups, generateCrossTierGroupMatches, generateNormalGroupMatches,
  generateCrossTierGroupsFull, generateTypedGroupMatches, generateSplitGenderGroups, createPicDraw, applyPicDraw, resetPicGroups,
  createPicIndividualDrawSession, cancelPicIndividualDrawSession,
  setPicScheduleMode, updatePicConfig,
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
  initialPlayerGenders,
  initialBestExtra,
}: {
  eventId: string;
  initialPlayers: Player[];
  initialGroups: Group[];
  hasMatches: boolean;
  hasCompletedMatches: boolean;
  drawCode: string | null;
  initialScheduleMode: "standard" | "hd";
  initialLiveDraw: { code: string; playerTokens: Record<string, string> } | null;
  initialPlayerGenders?: Record<string, "M" | "F">;
  initialBestExtra?: number;
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
  // Gender tags (persisted server-side in config.playerGenders)
  const [genders, setGenders] = useState<Record<string, "M" | "F">>(initialPlayerGenders ?? {});
  const [genderQuota, setGenderQuota] = useState(false);
  // Trận cùng loại: đôi nam vs đôi nam · đôi nữ vs đôi nữ · nam-nữ vs nam-nữ
  const [typedMode, setTypedMode] = useState(false);
  // Bảng nam & bảng nữ riêng: bảng nam đánh đôi nam, bảng nữ đánh đôi nữ,
  // vòng trong bốc cặp đôi nam-nữ
  const [splitGender, setSplitGender] = useState(false);
  const [maleGroupCount, setMaleGroupCount] = useState(1);
  const [femaleGroupCount, setFemaleGroupCount] = useState(1);
  // Vớt: lấy thêm N người hạng kế tiếp có thành tích tốt nhất liên bảng
  const [bestExtra, setBestExtra] = useState(initialBestExtra ?? 0);

  const pc = players.length;
  const aCount = useMemo(() => players.filter(p => categories[p.id] === "A").length, [players, categories]);
  const bCount = useMemo(() => players.filter(p => categories[p.id] === "B").length, [players, categories]);
  const untaggedCount = pc - aCount - bCount;
  const maleCount = useMemo(() => players.filter(p => genders[p.id] === "M").length, [players, genders]);
  const femaleCount = useMemo(() => players.filter(p => genders[p.id] === "F").length, [players, genders]);
  const ungenderedCount = pc - maleCount - femaleCount;
  const allGendered = pc > 0 && ungenderedCount === 0;

  const toggleGender = (playerId: string) => {
    setGenders(prev => {
      const cur = prev[playerId];
      const next = { ...prev };
      if (!cur) next[playerId] = "M";
      else if (cur === "M") next[playerId] = "F";
      else delete next[playerId];
      void updatePicConfig(eventId, { playerGenders: next });
      return next;
    });
  };

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
      const maxSize = 16; // 1 bảng chung hỗ trợ tới 16 người (lịch 11-16 đã có)
      const result: number[] = [];
      for (let g = 1; g <= Math.ceil(pc / 4); g++) {
        const sizes = snakePreview(pc, g);
        if (sizes.length > 0 && Math.min(...sizes) >= 4 && Math.max(...sizes) <= maxSize)
          result.push(g);
      }
      return result;
    }
    // Chế độ A/B: vòng tròn ghép cặp — mỗi bảng cần 2–8 VĐV mỗi trình, A×B chẵn.
    // Cho phép lệch trình (vd 6A + 5B) và 1 bảng chung.
    if (aCount < 2 || bCount < 2) return [];
    const result: number[] = [];
    for (let g = 1; g <= Math.floor(Math.min(aCount, bCount) / 2); g++) {
      const aS = snakePreview(aCount, g);
      const bS = snakePreview(bCount, g);
      let ok = true;
      for (let i = 0; i < g; i++) {
        const aN = aS[i] ?? 0;
        const bN = bS[i] ?? 0;
        if (aN < 2 || bN < 2 || aN > 8 || bN > 8 || (aN * bN) % 2 !== 0) {
          ok = false;
          break;
        }
      }
      if (ok) result.push(g);
    }
    return result;
  }, [pc, crossTierMode, aCount, bCount, typedMode]);

  const effG = validGroupCounts.includes(groupCount) ? groupCount : (validGroupCounts[0] ?? 1);

  // Split mode: số bảng hợp lệ cho từng giới (mỗi bảng 4–16 người)
  const genderGroupOptions = (n: number) => {
    const result: number[] = [];
    for (let g = 1; g <= Math.floor(n / 4); g++) {
      const sizes = snakePreview(n, g);
      if (sizes.length > 0 && Math.min(...sizes) >= 4 && Math.max(...sizes) <= 16)
        result.push(g);
    }
    return result;
  };
  const validMaleGroupCounts = useMemo(
    () => (splitGender ? genderGroupOptions(maleCount) : []),
    [splitGender, maleCount],
  );
  const validFemaleGroupCounts = useMemo(
    () => (splitGender ? genderGroupOptions(femaleCount) : []),
    [splitGender, femaleCount],
  );
  const effMG = validMaleGroupCounts.includes(maleGroupCount) ? maleGroupCount : (validMaleGroupCounts[0] ?? 1);
  const effFG = validFemaleGroupCounts.includes(femaleGroupCount) ? femaleGroupCount : (validFemaleGroupCounts[0] ?? 1);

  useEffect(() => { setPreview(null); }, [categories, effG]);

  const groupSizes = useMemo(() => {
    if (splitGender)
      return [...snakePreview(maleCount, effMG), ...snakePreview(femaleCount, effFG)];
    if (!crossTierMode) return snakePreview(pc, effG);
    if (aCount < 2 || bCount < 2 || validGroupCounts.length === 0) return [];
    const aS = snakePreview(aCount, effG);
    const bS = snakePreview(bCount, effG);
    return aS.map((a, i) => a + (bS[i] ?? 0));
  }, [pc, crossTierMode, effG, aCount, bCount, validGroupCounts.length, splitGender, maleCount, femaleCount, effMG, effFG]);

  const tierSplits = useMemo(
    () =>
      crossTierMode
        ? { a: snakePreview(aCount, effG), b: snakePreview(bCount, effG) }
        : null,
    [crossTierMode, aCount, bCount, effG],
  );

  // Tổng số bảng dùng để tính phương án vào vòng trong (split: bảng nam + bảng nữ)
  const advanceG = splitGender ? effMG + effFG : effG;

  const validAdvanceOptions = useMemo<{ v: number; e: number }[]>(() => {
    if (crossTierMode || groupSizes.length === 0) return [{ v: 1, e: 0 }];
    const minSize = Math.min(...groupSizes);
    const opts: { v: number; e: number }[] = [];
    for (let v = 1; v < minSize; v++) {
      if ((advanceG * v) % 2 === 0 && advanceG * v >= 2) opts.push({ v, e: 0 });
      // Vớt: +e người hạng (v+1) có thành tích tốt nhất liên bảng, tròn nhánh 4/8/16 người
      if (v + 1 <= minSize) {
        for (const target of [4, 8, 16]) {
          const e = target - advanceG * v;
          if (e >= 1 && e < advanceG) opts.push({ v, e });
        }
      }
    }
    opts.sort((a, b) => (advanceG * a.v + a.e) - (advanceG * b.v + b.e) || a.v - b.v);
    return opts.length > 0 ? opts : [{ v: 1, e: 0 }];
  }, [groupSizes, advanceG, crossTierMode]);

  useEffect(() => {
    if (crossTierMode || groupSizes.length === 0) return;
    const stillValid = validAdvanceOptions.some(o => o.v === advancePerGroup && o.e === bestExtra);
    if (!stillValid) {
      setAdvancePerGroup(1);
      if (bestExtra !== 0) {
        setBestExtra(0);
        void updatePicConfig(eventId, { bestExtraCount: 0 });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceG, crossTierMode, splitGender]);

  const crossTierError = useMemo(() => {
    if (!crossTierMode) return null;
    if (untaggedCount > 0) return `Còn ${untaggedCount} VĐV chưa được phân hạng`;
    if (aCount < 2 || bCount < 2) return `Mỗi trình cần ít nhất 2 VĐV (A: ${aCount}, B: ${bCount})`;
    if (validGroupCounts.length === 0)
      return "Không chia được bảng (mỗi bảng cần 2–8 VĐV mỗi trình và số cặp A×B phải chẵn — thêm/bớt 1 VĐV)";
    return null;
  }, [crossTierMode, untaggedCount, aCount, bCount, validGroupCounts.length]);

  const splitError = useMemo(() => {
    if (!splitGender) return null;
    if (!allGendered) return `Còn ${ungenderedCount} VĐV chưa gán Nam/Nữ`;
    if (maleCount < 4 || femaleCount < 4)
      return `Cần ít nhất 4 nam và 4 nữ (Nam: ${maleCount}, Nữ: ${femaleCount})`;
    if (validMaleGroupCounts.length === 0 || validFemaleGroupCounts.length === 0)
      return "Không chia được bảng 4–16 người mỗi giới";
    return null;
  }, [splitGender, allGendered, ungenderedCount, maleCount, femaleCount, validMaleGroupCounts.length, validFemaleGroupCounts.length]);

  const canGenerate = pc >= 4 && !hasGroups && (
    crossTierMode ? crossTierError === null
    : splitGender ? splitError === null
    : validGroupCounts.length > 0
  ) && (!typedMode || allGendered);

  // State 2: validate A/B per group
  const groupCategoryErrors = useMemo(() => {
    if (!hasGroups || hasMatches) return {} as Record<string, string>;
    const errors: Record<string, string> = {};
    for (const g of initialGroups) {
      const aPs = g.playerIds.filter(id => categories[id] === "A");
      const bPs = g.playerIds.filter(id => categories[id] === "B");
      const untagged = g.playerIds.filter(id => !categories[id]);
      if (untagged.length > 0) errors[g.id] = `Còn ${untagged.length} VĐV chưa phân hạng`;
      else if (aPs.length < 2 || bPs.length < 2) errors[g.id] = `Mỗi trình cần ≥2 VĐV (A: ${aPs.length}, B: ${bPs.length})`;
      else if (aPs.length > 8 || bPs.length > 8) errors[g.id] = `Tối đa 8 VĐV mỗi trình`;
      else if ((aPs.length * bPs.length) % 2 !== 0)
        errors[g.id] = `${aPs.length}×${bPs.length} = ${aPs.length * bPs.length} cặp (lẻ) — thêm/bớt 1 VĐV`;
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
    if (splitGender) {
      startTransition(async () => {
        const res = await generateSplitGenderGroups(eventId, effMG, effFG, advancePerGroup);
        if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
        toast({ title: "Đã chia bảng nam & bảng nữ!", description: "Bảng nam đôi nam · bảng nữ đôi nữ · vòng trong bốc đôi nam-nữ." });
        router.refresh();
      });
      return;
    }
    if ((genderQuota || typedMode) && !allGendered) {
      toast({ title: "Chưa gán đủ Nam/Nữ", description: `Còn ${ungenderedCount} VĐV chưa gán`, variant: "destructive" });
      return;
    }
    if (typedMode) {
      // Trận cùng loại: chia bảng cân giới + sinh lịch MD/WD/XD trong 1 bước
      startTransition(async () => {
        const res = await generateTypedGroupMatches(eventId, effG, advancePerGroup);
        if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
        toast({ title: "Đã tạo lịch trận cùng loại!", description: "Đôi nam vs đôi nam · đôi nữ vs đôi nữ · nam-nữ vs nam-nữ" });
        router.refresh();
      });
      return;
    }
    // Always crossTierMode=true for random draw — goes to State 2 for A/B assignment
    startTransition(async () => {
      const res = await generatePicGroups(eventId, effG, advancePerGroup, true, genderQuota);
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
    if (genderQuota && !allGendered) {
      toast({ title: "Chưa gán đủ Nam/Nữ", description: `Còn ${ungenderedCount} VĐV chưa gán`, variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const res = await createPicIndividualDrawSession(eventId, effG, advancePerGroup, genderQuota);
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
  const seedCategoriesFromGenders = () => {
    const next: Record<string, Category> = {};
    for (const p of players) {
      const g = genders[p.id];
      if (g === "M") next[p.id] = "A";
      else if (g === "F") next[p.id] = "B";
    }
    setCategories(next);
    setActiveTier(null);
    toast({ title: "Đã dùng Nam/Nữ làm phân hạng", description: "Nam = A, Nữ = B — mỗi đội xoay cặp sẽ là 1 nam + 1 nữ" });
  };

  // Tự seed Nam→A / Nữ→B khi vào màn phân hạng mà chưa có tag nào lưu trước đó
  useEffect(() => {
    if (!hasGroups || hasMatches || !allGendered) return;
    if (localStorage.getItem(`pic-cat-${eventId}`)) return;
    if (Object.keys(categories).length > 0) return;
    seedCategoriesFromGenders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGroups, hasMatches, allGendered]);

  // Categories khớp Nam→A/Nữ→B? → lịch là lịch nam nữ, badge hiển thị Nam/Nữ
  const categoriesMatchGenders =
    allGendered &&
    players.length > 0 &&
    players.every(p => {
      const g = genders[p.id];
      const c = categories[p.id];
      return (g === "M" && c === "A") || (g === "F" && c === "B");
    });

  const onGenerateCrossTierMatches = () => {
    startTransition(async () => {
      const res = await generateCrossTierGroupMatches(eventId, categories);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      // Nếu phân hạng đúng theo giới tính → badge hiển thị "Nam"/"Nữ" thay vì A/B
      await updatePicConfig(eventId, {
        tierLabels: categoriesMatchGenders ? { A: "Nam", B: "Nữ" } : undefined,
      });
      localStorage.removeItem(`pic-cat-${eventId}`);
      toast({ title: categoriesMatchGenders ? "Đã tạo lịch Nam + Nữ!" : "Đã tạo lịch A/B!" });
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

  // Edit name inline
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
      const res = await updatePicPlayer(eventId, id, newName);
      if ("error" in res) { toast({ title: "Lỗi", description: res.error, variant: "destructive" }); return; }
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
      cancelEdit();
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

              {/* Trận cùng loại: MD vs MD · WD vs WD · XD vs XD */}
              {!crossTierMode && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium">Chế độ trận cùng loại 🔵🩷💑</p>
                    <p className="text-xs text-muted-foreground">
                      Đôi nam đấu đôi nam · đôi nữ đấu đôi nữ · đôi nam-nữ đấu đôi nam-nữ.
                      Nam nữ lệch nhau vẫn chạy, hỗ trợ 1 bảng tới 16 người, mỗi VĐV đúng 4 trận.
                    </p>
                  </div>
                  <div
                    onClick={() => setTypedMode(v => { const nv = !v; if (nv) setSplitGender(false); return nv; })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${typedMode ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${typedMode ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </label>
              )}

              {/* Bảng nam & bảng nữ riêng: bảng nam đôi nam · bảng nữ đôi nữ · vòng trong đôi nam-nữ */}
              {!crossTierMode && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium">Bảng nam & bảng nữ riêng 🔵🩷</p>
                    <p className="text-xs text-muted-foreground">
                      Chia bảng toàn nam và bảng toàn nữ — bảng nam đánh đôi nam, bảng nữ đánh đôi nữ.
                      Vòng trong lấy top mỗi bảng (+ vớt nếu chọn) rồi bốc cặp đôi nam-nữ.
                      Chọn số bảng từng giới, hỗ trợ 1 bảng nam + 1 bảng nữ.
                    </p>
                  </div>
                  <div
                    onClick={() => setSplitGender(v => { const nv = !v; if (nv) { setTypedMode(false); setGenderQuota(false); } return nv; })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${splitGender ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${splitGender ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </label>
              )}

              {/* Gender tags + per-group Nam/Nữ quota */}
              {!crossTierMode && (
                <div className="space-y-2 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Giới tính VĐV (Nam/Nữ)</p>
                      <p className="text-xs text-muted-foreground">
                        Tap badge ⚥ ở danh sách VĐV bên dưới: Nam → Nữ → bỏ
                      </p>
                    </div>
                    <div className="flex gap-1.5 text-sm font-medium shrink-0">
                      <span className="rounded bg-blue-500/15 px-2 py-0.5 text-blue-600">Nam: {maleCount}</span>
                      <span className="rounded bg-pink-500/15 px-2 py-0.5 text-pink-600">Nữ: {femaleCount}</span>
                    </div>
                  </div>
                  {!typedMode && !splitGender && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={genderQuota}
                        onChange={e => setGenderQuota(e.target.checked)}
                        className="size-4 accent-primary"
                      />
                      Giới hạn Nam/Nữ mỗi bảng khi quay (chia đều nam, đều nữ vào các bảng)
                    </label>
                  )}
                  {(genderQuota || typedMode || splitGender) && !allGendered && (
                    <p className="text-xs font-medium text-destructive">
                      Còn {ungenderedCount} VĐV chưa gán Nam/Nữ — gán đủ mới quay được
                    </p>
                  )}
                  {splitGender && allGendered && splitError && (
                    <p className="text-xs font-medium text-destructive">{splitError}</p>
                  )}
                  {genderQuota && allGendered && (
                    <p className="text-xs text-muted-foreground">
                      Mỗi bảng sẽ có ~{Math.floor(maleCount / effG)}–{Math.ceil(maleCount / effG)} nam
                      + ~{Math.floor(femaleCount / effG)}–{Math.ceil(femaleCount / effG)} nữ.
                      Chỉ áp dụng cho <strong>Quay ngay</strong> và <strong>Cá nhân LIVE</strong>.
                    </p>
                  )}
                </div>
              )}

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
                    {splitGender ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Số bảng nam / nữ</p>
                        {validMaleGroupCounts.length > 0 && validFemaleGroupCounts.length > 0 ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="w-8 shrink-0 text-xs font-bold text-blue-600">Nam</span>
                              {validMaleGroupCounts.map(g => {
                                const sizes = snakePreview(maleCount, g);
                                const unique = [...new Set(sizes)].sort((a, b) => a - b);
                                const tag = unique.length === 1 ? `${unique[0]}ng` : `${unique[0]}–${unique[unique.length - 1]}ng`;
                                return (
                                  <button key={g} onClick={() => setMaleGroupCount(g)}
                                    className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors ${effMG === g ? "border-blue-500 bg-blue-500/10 text-blue-600" : "hover:border-blue-400"}`}>
                                    {g} bảng <span className="text-xs font-normal opacity-60">{tag}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="w-8 shrink-0 text-xs font-bold text-pink-600">Nữ</span>
                              {validFemaleGroupCounts.map(g => {
                                const sizes = snakePreview(femaleCount, g);
                                const unique = [...new Set(sizes)].sort((a, b) => a - b);
                                const tag = unique.length === 1 ? `${unique[0]}ng` : `${unique[0]}–${unique[unique.length - 1]}ng`;
                                return (
                                  <button key={g} onClick={() => setFemaleGroupCount(g)}
                                    className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors ${effFG === g ? "border-pink-500 bg-pink-500/10 text-pink-600" : "hover:border-pink-400"}`}>
                                    {g} bảng <span className="text-xs font-normal opacity-60">{tag}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Cần ≥4 nam và ≥4 nữ (đã gán đủ giới tính)</p>
                        )}
                      </div>
                    ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Số bảng</p>
                      {validGroupCounts.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {validGroupCounts.map(g => {
                            const sizes = crossTierMode
                              ? snakePreview(aCount, g).map((a, i) => a + (snakePreview(bCount, g)[i] ?? 0))
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
                    )}
                    {!crossTierMode && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Vào vòng trong</p>
                        <div className="flex flex-wrap gap-1.5">
                          {validAdvanceOptions.map(o => {
                            const selected = advancePerGroup === o.v && bestExtra === o.e;
                            const total = advanceG * o.v + o.e;
                            return (
                              <button
                                key={`${o.v}-${o.e}`}
                                onClick={() => {
                                  setAdvancePerGroup(o.v);
                                  setBestExtra(o.e);
                                  void updatePicConfig(eventId, { bestExtraCount: o.e });
                                }}
                                className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"}`}
                              >
                                <span className="block">
                                  Top {o.v}/bảng{o.e > 0 ? ` + ${o.e} vớt` : ""}
                                </span>
                                <span className="block text-xs font-normal opacity-60">
                                  {o.e > 0
                                    ? `+${o.e} hạng ${o.v + 1} tốt nhất → ${total} người`
                                    : `→ ${total} người tổng`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {groupSizes.length > 0 && (
                    <div className={`grid gap-2 rounded-xl border bg-muted/30 p-3 ${(splitGender ? effMG + effFG : effG) <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {groupSizes.map((size, gi) => (
                        <div key={gi} className="space-y-0.5">
                          <p className={`text-xs font-bold ${splitGender ? (gi < effMG ? "text-blue-600" : "text-pink-600") : "text-primary"}`}>
                            Bảng {String.fromCharCode(65 + gi)}
                            {splitGender && (gi < effMG ? " · Nam" : " · Nữ")}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {crossTierMode && tierSplits
                              ? `${tierSplits.a[gi] ?? 0}A + ${tierSplits.b[gi] ?? 0}B`
                              : `${size} người`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {splitGender && effMG !== effFG && (
                    <p className="text-[11px] font-medium text-amber-600">
                      ⚠️ Số bảng nam ({effMG}) ≠ số bảng nữ ({effFG}) → số nam/nữ vào vòng trong lệch nhau, sẽ khó bốc cặp đôi nam-nữ. Nên chọn bằng nhau.
                    </p>
                  )}

                  <div className={`grid gap-2 ${crossTierMode ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
                    <Button onClick={onDrawOrPreview} disabled={!canGenerate || pending || !!drawCode || !!liveDraw} variant="outline" size="lg">
                      <Shuffle className="size-4" />
                      {pending ? "Đang tạo…" : crossTierMode ? "🎲 Xem phân bảng" : splitGender ? "🎲 Quay bảng nam/nữ" : typedMode ? "🎲 Tạo lịch cùng loại" : "🎲 Quay ngay"}
                    </Button>
                    {!crossTierMode && (
                      <>
                        <Button
                          onClick={() => setIndividualDrawMode(true)}
                          disabled={!canGenerate || pending || !!drawCode || !!liveDraw || genderQuota || typedMode || splitGender}
                          variant="outline"
                          size="lg"
                          className="border-primary/40 text-primary hover:bg-primary/10"
                          title={genderQuota || typedMode || splitGender ? "Chế độ này chưa hỗ trợ tuỳ chọn giới tính đang bật" : undefined}
                        >
                          <Sparkles className="size-4" />
                          ✨ Cá nhân
                        </Button>
                        <Button
                          onClick={onCreateLiveIndividualDraw}
                          disabled={!canGenerate || pending || !!drawCode || !!liveDraw || typedMode || splitGender}
                          size="lg"
                          className="bg-red-500 hover:bg-red-600 text-white"
                          title={typedMode || splitGender ? "Chế độ này chưa hỗ trợ bốc LIVE — dùng nút Quay bên trái" : undefined}
                        >
                          <Sparkles className="size-4" />
                          🌐 Cá nhân LIVE
                        </Button>
                        <Button
                          onClick={onCreateLiveDraw}
                          disabled={!canGenerate || pending || !!drawCode || !!liveDraw || genderQuota || typedMode || splitGender}
                          size="lg"
                          title={genderQuota || typedMode || splitGender ? "Chế độ này chưa hỗ trợ tuỳ chọn giới tính đang bật" : undefined}
                        >
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
            <CardDescription>
              VÒNG TRÒN GHÉP CẶP: mỗi đội = 1 VĐV hạng A + 1 hạng B, mọi tổ hợp A×B
              cặp với nhau đúng 1 lần (A đánh số-B trận, B đánh số-A trận). Giải nam nữ:
              Nam = A, Nữ = B. Cho phép lệch số lượng — chỉ cần A×B là số chẵn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allGendered && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pink-400/40 bg-pink-500/5 p-3">
                <div>
                  <p className="text-sm font-medium">💑 Giải nam nữ — dùng luôn Nam/Nữ đã gán</p>
                  <p className="text-xs text-muted-foreground">
                    Nam = A, Nữ = B → lịch xoay cặp luôn ghép 1 nam + 1 nữ, badge hiện Nam/Nữ
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={categoriesMatchGenders ? "outline" : "default"}
                  onClick={seedCategoriesFromGenders}
                  disabled={pending || categoriesMatchGenders}
                >
                  {categoriesMatchGenders ? <><Check className="size-3.5" />Đang dùng Nam/Nữ</> : "Áp dụng Nam/Nữ"}
                </Button>
              </div>
            )}
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
                <Check className="size-4" />
                {pending ? "Đang tạo…" : categoriesMatchGenders ? "💑 Tạo lịch Nam + Nữ" : "Tạo lịch A/B"}
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
                const isEditing = editingId === p.id;
                return (
                  <div key={p.id}
                    onClick={isActive && !isEditing ? () => handlePlayerTap(p.id) : undefined}
                    className={`flex items-center justify-between gap-2 rounded-md border p-2 text-sm ${isActive && !isEditing ? "cursor-pointer select-none active:scale-95 transition-transform" : ""} ${isActive && activeTier && !isEditing ? "hover:bg-accent" : ""}`}>
                    <span className="flex flex-1 items-center gap-2 truncate">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">{i + 1}</span>
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
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
                    <div className="flex items-center gap-1 shrink-0">
                      {!isEditing && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleGender(p.id); }}
                          title="Tap để đổi: Nam → Nữ → bỏ"
                          className={`flex h-6 min-w-9 items-center justify-center rounded px-1 text-[10px] font-bold transition-colors ${
                            genders[p.id] === "M" ? "bg-blue-500 text-white"
                            : genders[p.id] === "F" ? "bg-pink-500 text-white"
                            : "border bg-muted text-muted-foreground"
                          }`}
                        >
                          {genders[p.id] === "M" ? "Nam" : genders[p.id] === "F" ? "Nữ" : "⚥"}
                        </button>
                      )}
                      {isActive && !isEditing && (
                        <span className={`flex h-6 w-7 items-center justify-center rounded text-xs font-bold transition-colors ${
                          cat === "A" ? "bg-blue-500 text-white"
                          : cat === "B" ? "bg-orange-500 text-white"
                          : "border bg-muted text-muted-foreground"
                        }`}>{cat ?? "—"}</span>
                      )}
                      {!hasGroups && !preview && !isEditing && (
                        <>
                          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); startEdit(p); }} disabled={pending} title="Sửa tên" className="h-9 w-9 p-0">
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onDelete(p.id); }} disabled={pending} title="Xoá" className="h-9 w-9 p-0">
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                      {isEditing && (
                        <>
                          <Button size="sm" variant="ghost" onMouseDown={e => { e.preventDefault(); saveEdit(p.id); }} disabled={pending} title="Lưu" className="h-9 w-9 p-0">
                            <Check className="size-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onMouseDown={e => { e.preventDefault(); cancelEdit(); }} disabled={pending} title="Hủy" className="h-9 w-9 p-0">
                            <X className="size-4" />
                          </Button>
                        </>
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
