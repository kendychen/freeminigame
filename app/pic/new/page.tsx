"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPicEvent } from "@/app/actions/pic";
import Link from "next/link";

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
  const [targetGroup, setTargetGroup] = useState(11);
  const [targetKnockout, setTargetKnockout] = useState(15);
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const canStart = name.trim().length >= 3 && !pending;

  const handleStart = () => {
    if (!canStart) return;
    setServerError(null);
    startTransition(async () => {
      const res = await createPicEvent({
        name: name.trim(),
        targetGroup,
        targetKnockout,
        hasThirdPlace,
      });
      if ("error" in res) {
        setServerError(res.error);
      } else {
        router.push(`/pic/${res.slug}/players`);
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

        <section className="space-y-3">
          <label className="text-sm font-semibold">Luật thi đấu</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vòng bảng — chạm</label>
              <div className="flex gap-1">
                {[9, 11, 15, 21].map((v) => (
                  <button key={v} onClick={() => setTargetGroup(v)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      targetGroup === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Chung kết — chạm</label>
              <div className="flex gap-1">
                {[11, 15, 21].map((v) => (
                  <button key={v} onClick={() => setTargetKnockout(v)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      targetKnockout === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50"
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-3">
            <div>
              <p className="text-sm font-medium">Tranh hạng 3 – 4</p>
              <p className="text-xs text-muted-foreground">Thêm trận tranh huy chương đồng</p>
            </div>
            <div onClick={() => setHasThirdPlace((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${hasThirdPlace ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasThirdPlace ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </label>
        </section>

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
          Sau khi tạo, bạn sẽ thêm VĐV và chia bảng ở bước tiếp theo.
        </div>

        <Button onClick={handleStart} size="lg" className="w-full" disabled={!canStart}>
          {pending ? "Đang tạo…" : "Tạo giải đấu →"}
        </Button>
      </main>
    </div>
  );
}
