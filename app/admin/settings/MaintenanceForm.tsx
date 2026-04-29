"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setMaintenance } from "@/app/actions/admin/settings";
import { toast } from "@/components/ui/toast";

export function MaintenanceForm({
  enabled: initialEnabled,
  message: initialMessage,
}: {
  enabled: boolean;
  message: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState(initialMessage);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await setMaintenance({ enabled, message });
      if ("error" in res) toast({ title: "Lỗi", description: res.error, variant: "destructive" });
      else toast({ title: "Đã lưu" });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4"
            />
            Bật chế độ bảo trì (chỉ admin truy cập được site)
          </label>
          <div className="space-y-2">
            <Label>Thông báo bảo trì</Label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Site đang bảo trì, quay lại sau ít phút."
            />
          </div>
          <Button type="submit" disabled={pending}>
            Lưu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
