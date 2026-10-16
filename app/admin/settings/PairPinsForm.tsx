"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { setPairDefaultPins } from "@/app/actions/admin/settings";
import { toast } from "@/components/ui/toast";
import { parseDefaultPinSpec } from "@/lib/pair/default-pins";

export function PairPinsForm({ spec: initial }: { spec: string }) {
  const [spec, setSpec] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();

  const groups = useMemo(() => parseDefaultPinSpec(spec), [spec]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await setPairDefaultPins(spec);
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      setSpec(res.spec);
      setSaved(res.spec);
      toast({
        title: res.spec
          ? `Đã lưu ${parseDefaultPinSpec(res.spec).length} cặp cố định`
          : "Đã tắt cặp cố định",
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cặp cố định khi xoay cặp</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pair-pins">Danh sách cặp</Label>
            <textarea
              id="pair-pins"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder="Hoà Hồ|Lê Hoạt"
              className="w-full rounded-md border bg-background p-2 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Mỗi cặp một dòng kiểu <code>Tên A|Tên B</code>, nhiều cặp cách nhau
              bằng <code>;</code>. Tên khớp không phân biệt dấu và chữ hoa/thường.
              Để trống là tắt, mọi người quay random hoàn toàn.
            </p>
          </div>

          {groups.length > 0 && (
            <div className="space-y-1 rounded-md border bg-secondary/30 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Sẽ ghim {groups.length} nhóm
              </p>
              <ul className="space-y-0.5">
                {groups.map((names, i) => (
                  <li key={i} className="truncate">
                    {names.join(" + ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Áp dụng cho mọi phòng xoay cặp, mọi lượt quay, kể cả &quot;Quay 1
            cặp&quot; và &quot;Phát ra tất&quot;. Người xem không thấy nhãn gì —
            cặp ghim hiện y như cặp quay ra bình thường. Nếu host đã tự ghim một
            trong hai người thì cặp cố định ở đây bị bỏ qua.
          </p>

          <Button type="submit" disabled={pending || spec === saved}>
            Lưu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
