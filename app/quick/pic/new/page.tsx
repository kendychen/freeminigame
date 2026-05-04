"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePicStore } from "@/stores/pic-tournament";
import type { PicPlayer, PicConfig } from "@/stores/pic-tournament";
import Link from "next/link";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function PicNewPage() {
  const router = useRouter();
  const init = usePicStore((s) => s.actions.init);

  const [name, setName] = useState("Giải đấu PIC");
  const [targetGroup, setTargetGroup] = useState(11);
  const [targetKnockout, setTargetKnockout] = useState(15);
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [players, setPlayers] = useState<PicPlayer[]>([
    { id: uid(), name: "Người chơi 1" },
    { id: uid(), name: "Người chơi 2" },
    { id: uid(), name: "Người chơi 3" },
    { id: uid(), name: "Người chơi 4" },
    { id: uid(), name: "Người chơi 5" },
  ]);

  const addPlayer = () => {
    if (players.length >= 6) return;
    setPlayers((p) => [...p, { id: uid(), name: `Người chơi ${p.length + 1}` }]);
  };

  const removePlayer = (id: string) => {
    if (players.length <= 4) return;
    setPlayers((p) => p.filter((x) => x.id !== id));
  };

  const updateName = (id: string, name: string) =>
    setPlayers((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));

  const handleStart = () => {
    const config: PicConfig = { name: name.trim() || "Giải đấu PIC", targetGroup, targetKnockout, hasThirdPlace };
    const validPlayers = players.map((p) => ({
      ...p,
      name: p.name.trim() || `Người chơi ${players.indexOf(p) + 1}`,
    }));
    init(config, validPlayers);
    router.push("/quick/pic");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Link href="/" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <ChevronLeft className="size-5" />
          </Link>
          <span className="font-semibold">Tạo giải PIC xoay cặp</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
        {/* Tên giải */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">Tên giải đấu</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Giải đấu PIC"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary/50 focus:ring-2"
          />
        </section>

        {/* VĐV */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">
              Vận động viên
              <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {players.length} người
              </span>
            </label>
            <button
              onClick={addPlayer}
              disabled={players.length >= 6}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              <Plus className="size-3.5" />
              Thêm
            </button>
          </div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <input
                  value={p.name}
                  onChange={(e) => updateName(p.id, e.target.value)}
                  placeholder={`Người chơi ${i + 1}`}
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary/50 focus:ring-2"
                />
                <button
                  onClick={() => removePlayer(p.id)}
                  disabled={players.length <= 4}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {players.length === 4 && "4 người → 3 trận, mỗi người đánh 3 trận"}
            {players.length === 5 && "5 người → 5 trận, mỗi người đánh 4 trận (nghỉ 1)"}
            {players.length === 6 && "6 người → 6 trận, mỗi người đánh 4 trận (nghỉ 2)"}
          </p>
        </section>

        {/* Luật thi đấu */}
        <section className="space-y-3">
          <label className="text-sm font-semibold">Luật thi đấu</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vòng bảng — chạm</label>
              <div className="flex items-center gap-2">
                {[9, 11, 15, 21].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTargetGroup(v)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      targetGroup === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Chung kết — chạm</label>
              <div className="flex items-center gap-2">
                {[11, 15, 21].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTargetKnockout(v)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      targetKnockout === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
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

        {/* Hạng 3 */}
        <section>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-3">
            <div>
              <p className="text-sm font-medium">Tranh hạng 3 – 4</p>
              <p className="text-xs text-muted-foreground">Hiển thị bục 3 – 4 sau chung kết</p>
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

        <Button onClick={handleStart} size="lg" className="w-full">
          Bắt đầu giải đấu
        </Button>
      </main>
    </div>
  );
}
