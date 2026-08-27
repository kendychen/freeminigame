"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setTvLayout } from "@/app/actions/admin/settings";
import { toast } from "@/components/ui/toast";
import type { TvLayout } from "@/lib/tv-layout";

const OPTIONS: { value: TvLayout; label: string; desc: string }[] = [
  { value: "rotate", label: "Xoay vòng", desc: "Toàn màn hình, lần lượt chạy qua trận đang đấu, các bảng, nhánh đấu, kết quả." },
  { value: "split", label: "Chia đôi", desc: "Bên trái xoay vòng các bảng đấu; bên phải cố định chỉ hiện các trận đang thi đấu." },
];

export function TvLayoutForm({ layout: initial }: { layout: TvLayout }) {
  const [layout, setLayout] = useState<TvLayout>(initial);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await setTvLayout(layout);
      if ("error" in res) toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      else toast({ title: `Màn hình hiển thị: ${layout === "split" ? "Chia đôi" : "Xoay vòng"}` });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Màn hình hiển thị (TV)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${layout === o.value ? "border-primary bg-secondary" : ""}`}
              >
                <input
                  type="radio"
                  name="tv_layout"
                  value={o.value}
                  checked={layout === o.value}
                  onChange={() => setLayout(o.value)}
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="text-muted-foreground">{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Áp dụng cho mọi link TV (PIC, giải đấu, đồng đội) khi tải lại trang. Muốn ép riêng một TV, thêm <code>?layout=split</code> hoặc <code>?layout=rotate</code> vào link.
          </p>
          <Button type="submit" disabled={pending || layout === initial}>
            Lưu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
