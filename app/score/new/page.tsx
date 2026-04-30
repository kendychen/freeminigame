"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft, Zap } from "lucide-react";
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
import { getSupabaseBrowser } from "@/lib/supabase/client";

const ALPHABET =
  "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // ambiguous chars removed
function genCode(len = 8) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[arr[i]! % ALPHABET.length];
  return out;
}

export default function NewQuickScorePage() {
  const router = useRouter();
  const [teamA, setTeamA] = useState("Đội A");
  const [teamB, setTeamB] = useState("Đội B");
  const [title, setTitle] = useState("");
  const [targetPoints, setTargetPoints] = useState<number | "">(11);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamA.trim() || !teamB.trim()) {
      toast({
        title: "Cần tên 2 đội",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const sb = getSupabaseBrowser();
      // Try a few codes in case of collision
      let code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        code = genCode(8);
        const { error } = await sb.from("quick_scores").insert({
          code,
          team_a_name: teamA.trim().slice(0, 80),
          team_b_name: teamB.trim().slice(0, 80),
          title: title.trim() ? title.trim().slice(0, 120) : null,
          target_points:
            typeof targetPoints === "number" && targetPoints > 0
              ? targetPoints
              : null,
        });
        if (!error) {
          router.push(`/score/${code}`);
          return;
        }
        if (!String(error.message).toLowerCase().includes("duplicate")) {
          toast({
            title: "Lỗi tạo bảng điểm",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
      }
      toast({ title: "Trùng mã liên tiếp", variant: "destructive" });
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
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 size-3" /> Trang chủ
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              Tỷ số nhanh
            </CardTitle>
            <CardDescription>
              Tạo bảng điểm chia sẻ — không cần đăng ký. Bạn nhập tên 2 đội,
              ai có link đều bấm +/- chấm điểm được, viewer xem realtime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tên trận (tuỳ chọn)</Label>
                <Input
                  id="title"
                  placeholder="Vd: Pickleball nội bộ ngày 30/4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamA">Đội A</Label>
                <Input
                  id="teamA"
                  required
                  value={teamA}
                  onChange={(e) => setTeamA(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamB">Đội B</Label>
                <Input
                  id="teamB"
                  required
                  value={teamB}
                  onChange={(e) => setTeamB(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">
                  Điểm thắng (tuỳ chọn — gợi ý kết thúc)
                </Label>
                <Input
                  id="target"
                  type="number"
                  min={1}
                  max={99}
                  value={targetPoints}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTargetPoints(v === "" ? "" : Number(v));
                  }}
                  placeholder="11"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting}
              >
                {submitting ? "Đang tạo…" : "Tạo bảng điểm + share link"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Link tự xoá sau 30 ngày · Có thể chấm điểm trên nhiều thiết bị cùng lúc
        </p>
      </main>
    </div>
  );
}
