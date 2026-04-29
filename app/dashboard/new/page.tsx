"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createTournament } from "@/app/actions/tournaments";
import type { TournamentFormat } from "@/lib/pairing/types";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("single_elim");
  const [series, setSeries] = useState<"bo1" | "bo3" | "bo5">("bo1");
  const [isPublic, setPublic] = useState(true);
  const [groupSize, setGroupSize] = useState(4);
  const [qualifyPerGroup, setQualifyPerGroup] = useState(2);
  const [doubleRound, setDoubleRound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await createTournament({
      name,
      format,
      isPublic,
      seriesFormat: series,
      config: {
        doubleRound: format === "round_robin" ? doubleRound : undefined,
        groupSize: format === "group_knockout" ? groupSize : undefined,
        qualifyPerGroup:
          format === "group_knockout" ? qualifyPerGroup : undefined,
      },
    });
    setSubmitting(false);
    if ("error" in res) {
      toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      return;
    }
    router.push(`/t/${res.slug}/admin/teams`);
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            FreeMinigame
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link href="/dashboard" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 size-3" /> Dashboard
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Tạo giải đấu</CardTitle>
            <CardDescription>Thiết lập cơ bản. Bạn sẽ thêm đội ở bước tiếp theo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên giải đấu</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Thể thức</Label>
                <Select
                  id="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                >
                  <option value="single_elim">Single Elimination</option>
                  <option value="double_elim">Double Elimination</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="swiss">Swiss</option>
                  <option value="group_knockout">Group + Knockout</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="series">Thể thức trận</Label>
                <Select
                  id="series"
                  value={series}
                  onChange={(e) => setSeries(e.target.value as "bo1" | "bo3" | "bo5")}
                >
                  <option value="bo1">BO1</option>
                  <option value="bo3">BO3</option>
                  <option value="bo5">BO5</option>
                </Select>
              </div>
              {format === "round_robin" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={doubleRound}
                    onChange={(e) => setDoubleRound(e.target.checked)}
                    className="size-4"
                  />
                  Đá lượt đi và lượt về
                </label>
              )}
              {format === "group_knockout" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Số đội/bảng</Label>
                    <Input
                      type="number"
                      value={groupSize}
                      onChange={(e) => setGroupSize(Number(e.target.value) || 4)}
                      min={2}
                      max={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Đi tiếp/bảng</Label>
                    <Input
                      type="number"
                      value={qualifyPerGroup}
                      onChange={(e) => setQualifyPerGroup(Number(e.target.value) || 2)}
                      min={1}
                      max={4}
                    />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setPublic(e.target.checked)}
                  className="size-4"
                />
                Công khai (viewer xem không cần đăng nhập)
              </label>
              <div className="flex justify-end gap-2 pt-4">
                <Link href="/dashboard">
                  <Button type="button" variant="ghost">
                    Huỷ
                  </Button>
                </Link>
                <Button type="submit" disabled={submitting || name.length < 3}>
                  {submitting ? "Đang tạo…" : "Tạo giải"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
