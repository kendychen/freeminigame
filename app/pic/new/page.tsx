"use client";

import { useState, useMemo, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPicEvent } from "@/app/actions/pic";
import type { PicConfig } from "@/stores/pic-tournament";
import Link from "next/link";

function snakeDistribute(names: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  let dir = 1, gi = 0;
  for (const n of names) {
    groups[gi]!.push(n);
    const next = gi + dir;
    if (next >= groupCount || next < 0) dir = -dir;
    else gi += dir;
  }
  return groups;
}

export default function PicNewPage() {
  return (
    <Suspense>
      <PicNewForm />
    </Suspense>
  );
}

function PicNewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(searchParams.get("name") ?? "Giải đấu PIC");
  const [rawNames, setRawNames] = useState(
    "Người chơi 1\nNgười chơi 2\nNgười chơi 3\nNgười chơi 4\nNgười chơi 5\nNgười chơi 6",
  );
  const [targetGroup, setTargetGroup] = useState(11);
  const [targetKnockout, setTargetKnockout] = useState(15);
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [advancePerGroup, setAdvancePerGroup] = useState(1);
  const [groupCount, setGroupCount] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);

  const players = useMemo(
    () => rawNames.split("\n").map((s) => s.trim()).filter(Boolean),
    [rawNames],
  );
  const pc = players.length;

  const validGroupCounts = useMemo(() => {
    const result: number[] = [];
    for (let g = 1; g <= Math.ceil(pc / 4); g++) {
      const sizes = snakeDistribute(players, g).map((gr) => gr.length);
      if (sizes.length > 0 && Math.min(...sizes) >= 4 && Math.max(...sizes) <= 6)
        result.push(g);
    }
    return result;
  }, [players, pc]);

  const effG = validGroupCounts.includes(groupCount) ? groupCount : (validGroupCounts[0] ?? 1);
  const preview = useMemo(() => snakeDistribute(players, effG), [players, effG]);
  const totalAdv = effG === 1 ? Math.min(4, pc) : effG * advancePerGroup;
  const canStart = pc >= 4 && validGroupCounts.length > 0 && !pending;

  const handleStart = () => {
    if (!canStart) return;
    setServerError(null);
    const aPerGroup = effG === 1 ? Math.min(4, pc) : advancePerGroup;
    const config: PicConfig = {
      name: name.trim() || "Giải đấu PIC",
      targetGroup,
      targetKnockout,
      advancePerGroup: aPerGroup,
      hasThirdPlace,
    };
    startTransition(async () => {
      const res = await createPicEvent(config, players, effG);
      if ("error" in res) {
        setServerError(res.error);
      } else {
        router.push(`/pic/${res.slug}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Link href="/dashboard" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <ChevronLeft className="size-5" />
          </Link>
          <span className="font-semibold">Tạo giải PIC xoay cặp</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
        {serverError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Lỗi: {serverError}
          </div>
        )}

        <section className="space-y-2">
          <label className="text-sm font-semibold">Tên giải đấu</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary/50 focus:ring-2"
          />
        </section>

        <section className="space-y-2">
          <label className="text-sm font-semibold">
            Vận động viên
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {pc} người
            </span>
          </label>
          <textarea
            value={rawNames}
            onChange={(e) => setRawNames(e.target.value)}
            rows={9}
            placeholder="Nhập tên mỗi người một dòng..."
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none ring-primary/50 focus:ring-2"
          />
          <p className="text-[11px] text-muted-foreground">Mỗi dòng 1 tên. Cần ít nhất 4 người.</p>
        </section>

        {pc >= 4 && (
          <section className="space-y-2">
            <label className="text-sm font-semibold">Số bảng đấu</label>
            {validGroupCounts.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {validGroupCounts.map((g) => {
                    const sizes = snakeDistribute(players, g).map((gr) => gr.length);
                    const unique = [...new Set(sizes)].sort((a, b) => a - b);
                    const tag =
                      unique.length === 1
                        ? `${g}×${unique[0]}người`
                        : `${unique[0]}–${unique[unique.length - 1]}người`;
                    return (
                      <button
                        key={g}
                        onClick={() => setGroupCount(g)}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                          effG === g
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:border-primary/50"
                        }`}
                      >
                        {g === 1 ? "1 bảng" : `${g} bảng`}
                        <span className="ml-1 text-xs font-normal opacity-60">{tag}</span>
                      </button>
                    );
                  })}
                </div>
                <div
                  className={`grid gap-2 rounded-xl border bg-muted/30 p-3 ${
                    preview.length <= 2
                      ? "grid-cols-2"
                      : preview.length <= 4
                        ? "grid-cols-2"
                        : "grid-cols-3"
                  }`}
                >
                  {preview.map((grp, gi) => (
                    <div key={gi} className="space-y-0.5">
                      <p className="text-xs font-bold text-primary">
                        Bảng {String.fromCharCode(65 + gi)}
                      </p>
                      {grp.map((n, ni) => (
                        <p key={ni} className="truncate text-[11px] text-muted-foreground">
                          {n}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Không thể chia nhóm 4–6 người đều. Vui lòng điều chỉnh số lượng VĐV.
              </p>
            )}
          </section>
        )}

        {effG > 1 && validGroupCounts.length > 0 && (
          <section className="space-y-2">
            <label className="text-sm font-semibold">Số người đi tiếp mỗi bảng</label>
            <div className="flex gap-2">
              {[1, 2].map((v) => {
                const total = effG * v;
                const ok = total >= 2 && total % 2 === 0;
                return (
                  <button
                    key={v}
                    onClick={() => ok && setAdvancePerGroup(v)}
                    disabled={!ok}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                      advancePerGroup === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:border-primary/50"
                    }`}
                  >
                    Top {v}
                    <span className="ml-1 text-xs font-normal opacity-60">({total} người)</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <label className="text-sm font-semibold">Luật thi đấu</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vòng bảng — chạm</label>
              <div className="flex gap-1">
                {[9, 11, 15, 21].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTargetGroup(v)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      targetGroup === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:border-primary/50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Chung kết — chạm</label>
              <div className="flex gap-1">
                {[11, 15, 21].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTargetKnockout(v)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      targetKnockout === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:border-primary/50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Không cách — ai chạm trước thắng.</p>
        </section>

        {totalAdv >= 8 && (
          <section>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <p className="text-sm font-medium">Tranh hạng 3 – 4</p>
                <p className="text-xs text-muted-foreground">Thêm trận tranh huy chương đồng</p>
              </div>
              <div
                onClick={() => setHasThirdPlace((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${hasThirdPlace ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasThirdPlace ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
            </label>
          </section>
        )}

        <Button onClick={handleStart} size="lg" className="w-full" disabled={!canStart}>
          {pending ? "Đang tạo…" : "Bắt đầu giải đấu"}
        </Button>
      </main>
    </div>
  );
}
