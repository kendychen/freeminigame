"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Users, ArrowLeft, List, Eye } from "lucide-react";
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
import { AuthNavLinkClient } from "@/components/nav/AuthNavLinkClient";
import { toast } from "@/components/ui/toast";

type Mode = "lobby" | "preset";

export default function NewPairLobbyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Bốc thăm chia cặp");
  const [groupSize, setGroupSize] = useState(2);
  const [mode, setMode] = useState<Mode>("preset");
  const [namesText, setNamesText] = useState(
    Array.from({ length: 8 }, (_, i) => `Đội ${i + 1}`).join("\n"),
  );
  const [submitting, setSubmitting] = useState(false);

  const presetNames = namesText
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);
  const dedupedCount = new Set(presetNames.map((n) => n.toLowerCase())).size;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "preset" && presetNames.length < 2) {
      toast({
        title: "Cần ít nhất 2 đội",
        description: "Mỗi dòng 1 tên đội",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/pair/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          groupSize,
          presetNames: mode === "preset" ? presetNames : undefined,
          lockOnCreate: mode === "preset",
        }),
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
            Hội Nhóm Pickleball
          </Link>
          <div className="flex items-center gap-2">
            <AuthNavLinkClient />
            <ThemeToggle />
          </div>
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
              Tạo link, share cho mọi người. Host bấm bốc thăm → tất cả cùng
              thấy kết quả ngay tức thì.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
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
                <Label htmlFor="size">Số đội/người mỗi nhóm</Label>
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
                  2 = chia cặp · 3+ = chia thành nhóm lớn hơn
                </p>
              </div>

              <div className="space-y-2">
                <Label>Chế độ tham gia</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("preset")}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      mode === "preset"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    }`}
                  >
                    <List className="size-4 mb-2 text-primary" />
                    <div className="font-semibold">Preset (host nhập sẵn)</div>
                    <div className="text-xs text-muted-foreground">
                      Bạn nhập danh sách 30 đội. Mọi người vào link CHỈ XEM,
                      không nhập tên.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("lobby")}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      mode === "lobby"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    }`}
                  >
                    <Eye className="size-4 mb-2 text-primary" />
                    <div className="font-semibold">Lobby (mở cho ai cũng vào)</div>
                    <div className="text-xs text-muted-foreground">
                      Người vào link tự nhập tên để tham gia. Host bốc thăm cuối.
                    </div>
                  </button>
                </div>
              </div>

              {mode === "preset" && (
                <div className="space-y-2">
                  <Label htmlFor="names">
                    Danh sách đội/người ({dedupedCount} đội)
                  </Label>
                  <textarea
                    id="names"
                    value={namesText}
                    onChange={(e) => setNamesText(e.target.value)}
                    rows={10}
                    className="w-full rounded-md border bg-background p-3 font-mono text-sm"
                    placeholder={"Đội Sấm Sét\nĐội Bão Tố\nĐội Hoa Hồng\n..."}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mỗi dòng 1 tên · Tên trùng tự động loại bỏ · Tối đa 200
                  </p>
                </div>
              )}

              <div className="rounded-md border bg-secondary/30 p-3 text-sm space-y-1">
                <p className="font-medium">📋 Sau khi tạo:</p>
                <ul className="text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Bạn nhận 1 link share cho mọi người</li>
                  {mode === "preset" ? (
                    <li>
                      Mọi người vào link <strong>chỉ xem</strong> — không cần
                      nhập tên
                    </li>
                  ) : (
                    <li>Họ paste link → nhập tên → vào lobby</li>
                  )}
                  <li>Bạn bấm 🎲 Bốc thăm → tất cả cùng thấy kết quả</li>
                  <li>⚠️ Mỗi phòng chỉ bốc thăm 1 lần — kết quả là cuối cùng</li>
                  <li>Phòng tự động hết hạn sau 72 giờ</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting || (mode === "preset" && dedupedCount < 2)}
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
