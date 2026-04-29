"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Users, Plus, Minus, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useQuickStore } from "@/stores/quick-tournament";
import type { Team, TournamentFormat, SeedingOptions } from "@/lib/pairing/types";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const FORMATS: Array<{ value: TournamentFormat; label: string }> = [
  { value: "random_pairs", label: "Chia cặp ngẫu nhiên — 2 người 1 cặp" },
  { value: "random_groups", label: "Chia bảng ngẫu nhiên — chia thành nhiều nhóm" },
  { value: "single_elim", label: "Single Elimination — Loại trực tiếp" },
  { value: "double_elim", label: "Double Elimination — Loại 2 lần thua" },
  { value: "round_robin", label: "Round Robin — Vòng tròn" },
  { value: "swiss", label: "Swiss — Ghép theo điểm" },
  { value: "group_knockout", label: "Group + Knockout — Bảng + loại" },
];

export default function QuickNewPage() {
  const router = useRouter();
  const init = useQuickStore((s) => s.actions.init);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("Giải đấu của tôi");
  const [format, setFormat] = useState<TournamentFormat>("single_elim");
  const [seriesFormat, setSeriesFormat] = useState<"bo1" | "bo3" | "bo5">("bo1");
  const [doubleRound, setDoubleRound] = useState(false);
  const [groupSize, setGroupSize] = useState(4);
  const [qualifyPerGroup, setQualifyPerGroup] = useState(2);
  const [swissRounds, setSwissRounds] = useState(5);
  const [seedingMode, setSeedingMode] =
    useState<SeedingOptions["mode"]>("manual");
  const [teamCount, setTeamCount] = useState(8);
  const isPersonFormat =
    format === "random_pairs" || format === "random_groups";
  const entityWord = isPersonFormat ? "Người" : "Đội";
  const [teamNames, setTeamNames] = useState<string[]>(() =>
    Array.from({ length: 8 }, (_, i) => `Đội ${i + 1}`),
  );

  const setTeamCountAndNames = (n: number) => {
    const clamped = Math.max(2, Math.min(64, n));
    setTeamCount(clamped);
    setTeamNames((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push(`${entityWord} ${next.length + 1}`);
      return next.slice(0, clamped);
    });
  };

  const updateTeamName = (idx: number, value: string) => {
    setTeamNames((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const submit = () => {
    const teams: Team[] = teamNames.map((tn, i) => ({
      id: `team_${i + 1}`,
      name: tn || `Đội ${i + 1}`,
      seed: i + 1,
    }));
    init(
      {
        name,
        format,
        seriesFormat,
        doubleRound: format === "round_robin" ? doubleRound : undefined,
        groupSize:
          format === "group_knockout" || format === "random_groups"
            ? groupSize
            : undefined,
        qualifyPerGroup:
          format === "group_knockout" ? qualifyPerGroup : undefined,
        swissRounds: format === "swiss" ? swissRounds : undefined,
        tiebreakers: defaultTiebreakers(format),
        seeding: { mode: seedingMode },
        randomSeed: Date.now(),
      },
      teams,
    );
    router.push("/quick/bracket");
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Tạo bảng đấu nhanh</h1>
          <p className="mt-2 text-muted-foreground">
            Bước {step}/3 — {step === 1 ? "Chọn thể thức" : step === 2 ? "Nhập đội tham gia" : "Cấu hình"}
          </p>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin cơ bản</CardTitle>
              <CardDescription>
                Đặt tên giải và chọn thể thức phù hợp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên giải đấu</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Giải nội bộ tháng 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Thể thức</Label>
                <Select
                  id="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="series">Thể thức trận</Label>
                <Select
                  id="series"
                  value={seriesFormat}
                  onChange={(e) =>
                    setSeriesFormat(e.target.value as "bo1" | "bo3" | "bo5")
                  }
                >
                  <option value="bo1">BO1 — 1 ván</option>
                  <option value="bo3">BO3 — 3 ván thắng 2</option>
                  <option value="bo5">BO5 — 5 ván thắng 3</option>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Đội tham gia ({teamCount})</CardTitle>
              <CardDescription>
                Tối thiểu 2 đội, tối đa 64. Có thể chỉnh tên trực tiếp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setTeamCountAndNames(teamCount - 1)}
                  disabled={teamCount <= 2}
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  type="number"
                  value={teamCount}
                  onChange={(e) => setTeamCountAndNames(Number(e.target.value))}
                  min={2}
                  max={64}
                  className="w-24 text-center"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setTeamCountAndNames(teamCount + 1)}
                  disabled={teamCount >= 64}
                >
                  <Plus className="size-4" />
                </Button>
                <span className="ml-2 text-sm text-muted-foreground">
                  {isPersonFormat ? "người" : "đội"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {teamNames.map((tn, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border bg-secondary/30 p-2"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {i + 1}
                    </span>
                    <Input
                      value={tn}
                      onChange={(e) => updateTeamName(i, e.target.value)}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình thêm</CardTitle>
              <CardDescription>
                Hạt giống và các tuỳ chọn nâng cao theo thể thức.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cách xếp hạt giống</Label>
                <Select
                  value={seedingMode}
                  onChange={(e) =>
                    setSeedingMode(
                      e.target.value as SeedingOptions["mode"],
                    )
                  }
                >
                  <option value="manual">Thủ công (theo thứ tự nhập)</option>
                  <option value="random">Ngẫu nhiên</option>
                  <option value="ranking">Theo rating</option>
                </Select>
              </div>

              {format === "random_groups" && (
                <div className="space-y-2">
                  <Label>Số người mỗi nhóm</Label>
                  <Input
                    type="number"
                    value={groupSize}
                    onChange={(e) =>
                      setGroupSize(
                        Math.max(2, Math.min(20, Number(e.target.value))),
                      )
                    }
                    min={2}
                    max={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    {teamCount} người → {Math.ceil(teamCount / groupSize)} nhóm
                  </p>
                </div>
              )}

              {format === "random_pairs" && (
                <p className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
                  {teamCount} người → {Math.floor(teamCount / 2)} cặp
                  {teamCount % 2 === 1 && " · 1 người được miễn (BYE)"}
                </p>
              )}

              {format === "round_robin" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={doubleRound}
                    onChange={(e) => setDoubleRound(e.target.checked)}
                    className="size-4"
                  />
                  Đá lượt đi và lượt về (double round-robin)
                </label>
              )}

              {format === "group_knockout" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Số đội mỗi bảng</Label>
                    <Input
                      type="number"
                      value={groupSize}
                      onChange={(e) =>
                        setGroupSize(
                          Math.max(2, Math.min(8, Number(e.target.value))),
                        )
                      }
                      min={2}
                      max={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Đi tiếp / bảng</Label>
                    <Input
                      type="number"
                      value={qualifyPerGroup}
                      onChange={(e) =>
                        setQualifyPerGroup(
                          Math.max(1, Math.min(4, Number(e.target.value))),
                        )
                      }
                      min={1}
                      max={4}
                    />
                  </div>
                </div>
              )}

              {format === "swiss" && (
                <div className="space-y-2">
                  <Label>Số vòng Swiss</Label>
                  <Input
                    type="number"
                    value={swissRounds}
                    onChange={(e) =>
                      setSwissRounds(
                        Math.max(2, Math.min(15, Number(e.target.value))),
                      )
                    }
                    min={2}
                    max={15}
                  />
                  <p className="text-xs text-muted-foreground">
                    Khuyến nghị: ceil(log2(N)) — với {teamCount} đội nên dùng{" "}
                    {Math.max(3, Math.ceil(Math.log2(teamCount)))} vòng
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? router.push("/") : setStep((s) => (s - 1) as 1 | 2 | 3))}
          >
            <ArrowLeft className="size-4" />
            {step === 1 ? "Về trang chủ" : "Quay lại"}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
              Tiếp theo
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit}>
              <Users className="size-4" />
              Tạo bảng đấu
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function defaultTiebreakers(format: TournamentFormat) {
  if (format === "swiss") {
    return [
      { order: 1, type: "buchholz" as const },
      { order: 2, type: "sonneborn_berger" as const },
      { order: 3, type: "head_to_head" as const },
      { order: 4, type: "random" as const },
    ];
  }
  return [
    { order: 1, type: "head_to_head" as const },
    { order: 2, type: "point_differential" as const },
    { order: 3, type: "random" as const },
  ];
}
