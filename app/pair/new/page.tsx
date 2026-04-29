"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { toast } from "@/components/ui/toast";

export default function NewPairLobbyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Bốc thăm chia cặp");
  const [groupSize, setGroupSize] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/pair/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, groupSize }),
      });
      const json = (await res.json()) as {
        code?: string;
        host_token?: string;
        error?: string;
      };
      if (!res.ok || !json.code || !json.host_token) {
        toast({
          title: "Lỗi",
          description: json.error ?? "Không tạo được session",
          variant: "destructive",
        });
        return;
      }
      // Save host token to localStorage so refresh keeps host control
      localStorage.setItem(`pair-host-${json.code}`, json.host_token);
      router.push(`/pair/${json.code}?host=${json.host_token}`);
    } catch (err) {
      toast({
        title: "Lỗi mạng",
        description: err instanceof Error ? err.message : "Unknown",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            FreeMinigame
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 size-3" /> Trang chủ
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Tạo phòng bốc thăm realtime
            </CardTitle>
            <CardDescription>
              Tạo link, share cho mọi người. Họ vào nhập tên, bạn bấm bốc thăm
              → tất cả cùng thấy kết quả ngay tức thì.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tên phòng</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Chia cặp giải đấu Giáng sinh"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Số người mỗi nhóm</Label>
                <Input
                  id="size"
                  type="number"
                  value={groupSize}
                  onChange={(e) =>
                    setGroupSize(
                      Math.max(2, Math.min(20, Number(e.target.value) || 2)),
                    )
                  }
                  min={2}
                  max={20}
                />
                <p className="text-xs text-muted-foreground">
                  Mặc định 2 = chia cặp. Đặt 3, 4… nếu muốn chia thành nhóm lớn
                  hơn.
                </p>
              </div>
              <div className="rounded-md border bg-secondary/30 p-3 text-sm space-y-1">
                <p className="font-medium">📋 Sau khi tạo:</p>
                <ul className="text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Bạn nhận 1 link share cho mọi người</li>
                  <li>Họ paste link → nhập tên → vào lobby</li>
                  <li>Bạn bấm 🎲 Bốc thăm → tất cả cùng thấy kết quả</li>
                  <li>Có thể bốc lại nhiều lần đến khi vừa ý</li>
                  <li>Phòng tự động hết hạn sau 72 giờ</li>
                </ul>
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting}
              >
                {submitting ? "Đang tạo phòng…" : "🎲 Tạo phòng"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
