"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setUiTheme } from "@/app/actions/admin/settings";
import { toast } from "@/components/ui/toast";
import type { UiTheme } from "@/lib/ui-theme";

const OPTIONS: { value: UiTheme; label: string; desc: string }[] = [
  { value: "v1", label: "V1 · Xanh lá", desc: "Giao diện hiện tại (Geist, xanh lá)." },
  { value: "v2", label: "V2 · Sunset Court", desc: "Cam bóng pickleball + navy, font Plus Jakarta Sans, bo tròn hơn." },
];

export function UiThemeForm({ theme: initial }: { theme: UiTheme }) {
  const [theme, setTheme] = useState<UiTheme>(initial);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await setUiTheme(theme);
      if ("error" in res) toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      else toast({ title: `Đã chuyển toàn site sang ${theme.toUpperCase()}` });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giao diện website</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${theme === o.value ? "border-primary bg-secondary" : ""}`}
              >
                <input
                  type="radio"
                  name="ui_theme"
                  value={o.value}
                  checked={theme === o.value}
                  onChange={() => setTheme(o.value)}
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
            Áp dụng cho mọi người dùng. Trang tĩnh sẽ đổi sau vài giây; người đang mở web thấy khi tải lại.
          </p>
          <Button type="submit" disabled={pending || theme === initial}>
            Lưu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
