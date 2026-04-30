"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AuthNavLinkClient } from "@/components/nav/AuthNavLinkClient";
import { useQuickStore } from "@/stores/quick-tournament";
import { BracketView } from "@/components/bracket/BracketView";
import { MatchScoreDialog } from "@/components/tournaments/MatchScoreDialog";
import { StandingsTable } from "@/components/tournaments/StandingsTable";
import { ScheduleView } from "@/components/tournaments/ScheduleView";
import type { Match } from "@/lib/pairing/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tab = "bracket" | "schedule" | "standings";

export default function QuickBracketPage() {
  const router = useRouter();
  const current = useQuickStore((s) => s.current);
  const reset = useQuickStore((s) => s.actions.reset);
  const updateScore = useQuickStore((s) => s.actions.updateScore);
  const [hydrated, setHydrated] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("bracket");
  const [activeGroup, setActiveGroup] = useState<string | undefined>();

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (hydrated && !current) {
      router.replace("/quick/new");
    }
  }, [hydrated, current, router]);

  if (!hydrated || !current) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Đang tải...
      </div>
    );
  }

  const { config, teams, matches, champion, status } = current;
  const isElim =
    config.format === "single_elim" || config.format === "double_elim";
  const isGroupKO = config.format === "group_knockout";
  const isRandomPairs = config.format === "random_pairs";
  const isRandomGroups = config.format === "random_groups";
  const groupLabels =
    isGroupKO || isRandomGroups
      ? Object.keys(current.groupAssignments ?? {}).sort()
      : [];

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "bracket", label: "Bảng đấu", show: isElim || isGroupKO },
    {
      id: "schedule",
      label: isRandomPairs ? "Cặp đấu" : "Lịch thi đấu",
      show: !isRandomGroups,
    },
    {
      id: "standings",
      label: "Bảng điểm",
      show: !isElim && !isRandomPairs && !isRandomGroups,
    },
  ];
  const visibleTabs = tabs.filter((t) => t.show);

  const handleReset = () => {
    if (confirm("Xoá giải đấu hiện tại? Không thể hoàn tác.")) {
      reset();
      router.push("/quick/new");
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            Hội Nhóm Pickleball
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <Trash2 className="size-4" />
              Xoá
            </Button>
            <Link href="/quick/new">
              <Button variant="ghost" size="sm">
                <RotateCcw className="size-4" />
                Tạo mới
              </Button>
            </Link>
            <AuthNavLinkClient />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-3" />
            Trang chủ
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{config.name}</h1>
            <p className="text-sm text-muted-foreground">
              {teams.length} {isRandomPairs || isRandomGroups ? "người" : "đội"} ·{" "}
              {formatLabel(config.format)}
              {!isRandomPairs && !isRandomGroups &&
                ` · ${config.seriesFormat.toUpperCase()}`}
            </p>
          </div>
          {champion && status === "completed" && (
            <ChampionBanner
              championName={
                teams.find((t) => t.id === champion)?.name ?? "—"
              }
            />
          )}
        </div>

        <div className="mb-4 flex gap-1 border-b">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isGroupKO && groupLabels.length > 0 && activeTab !== "bracket" && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant={activeGroup === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveGroup(undefined)}
            >
              Tất cả bảng
            </Button>
            {groupLabels.map((g) => (
              <Button
                key={g}
                variant={activeGroup === g ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveGroup(g)}
              >
                Bảng {g}
              </Button>
            ))}
          </div>
        )}

        {isRandomGroups && (
          <RandomGroupsView
            teams={teams}
            assignments={current.groupAssignments ?? {}}
            onReshuffle={() => {
              if (confirm("Trộn lại nhóm? Bốc thăm mới sẽ tạo nhóm khác.")) {
                router.push("/quick/new");
              }
            }}
          />
        )}

        {isRandomPairs && activeTab === "schedule" && (
          <RandomPairsList teams={teams} matches={matches} />
        )}

        {activeTab === "bracket" && (isElim || isGroupKO) && (
          <BracketView
            matches={
              isGroupKO
                ? matches.filter((m) => m.bracket === "main")
                : matches
            }
            teams={teams}
            variant={config.format === "double_elim" ? "double" : "single"}
            onMatchClick={(id) => {
              const m = matches.find((x) => x.id === id);
              if (m) setSelectedMatch(m);
            }}
          />
        )}

        {activeTab === "schedule" && !isRandomPairs && !isRandomGroups && (
          <ScheduleView
            teams={teams}
            matches={
              isGroupKO && activeGroup
                ? matches.filter((m) => m.groupLabel === activeGroup)
                : matches
            }
            onMatchClick={(id) => {
              const m = matches.find((x) => x.id === id);
              if (m) setSelectedMatch(m);
            }}
          />
        )}

        {activeTab === "standings" && !isElim && (
          <div className="space-y-6">
            {isGroupKO && !activeGroup ? (
              groupLabels.map((g) => (
                <Card key={g}>
                  <CardHeader>
                    <CardTitle>Bảng {g}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StandingsTable
                      teams={teams}
                      matches={matches}
                      tiebreakers={config.tiebreakers}
                      groupLabel={g}
                      randomSeed={config.randomSeed}
                      highlight={config.qualifyPerGroup}
                    />
                  </CardContent>
                </Card>
              ))
            ) : (
              <StandingsTable
                teams={teams}
                matches={matches}
                tiebreakers={config.tiebreakers}
                groupLabel={activeGroup}
                randomSeed={config.randomSeed}
                highlight={isGroupKO ? config.qualifyPerGroup : undefined}
              />
            )}
          </div>
        )}

        <MatchScoreDialog
          match={selectedMatch}
          teams={teams}
          open={selectedMatch !== null}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          onSave={(id, sa, sb) => updateScore(id, sa, sb)}
        />
      </main>
    </div>
  );
}

function ChampionBanner({ championName }: { championName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
      <Trophy className="size-5 text-primary" />
      <span className="font-semibold">Vô địch: {championName}</span>
    </div>
  );
}

function RandomPairsList({
  teams,
  matches,
}: {
  teams: { id: string; name: string }[];
  matches: { id: string; teamA: string | null; teamB: string | null; status: string }[];
}) {
  const teamById = new Map(teams.map((t) => [t.id, t.name]));
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Bốc thăm ngẫu nhiên — mỗi cặp gồm 2 người.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {matches.map((m, i) => {
          const a = m.teamA ? teamById.get(m.teamA) : null;
          const b = m.teamB ? teamById.get(m.teamB) : null;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-4"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium">{a ?? "—"}</p>
                <p className="text-xs text-muted-foreground">vs</p>
                <p className="font-medium">
                  {b ?? <span className="text-muted-foreground">BYE (miễn)</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RandomGroupsView({
  teams,
  assignments,
  onReshuffle,
}: {
  teams: { id: string; name: string }[];
  assignments: Record<string, string[]>;
  onReshuffle: () => void;
}) {
  const teamById = new Map(teams.map((t) => [t.id, t.name]));
  const labels = Object.keys(assignments).sort();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Bốc thăm thành {labels.length} nhóm.
        </p>
        <Button variant="outline" size="sm" onClick={onReshuffle}>
          Trộn lại
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {labels.map((label) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-semibold">Nhóm {label}</h3>
            <ol className="space-y-1 text-sm">
              {(assignments[label] ?? []).map((id, i) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{i + 1}.</span>
                  <span>{teamById.get(id) ?? "—"}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              {(assignments[label] ?? []).length} người
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLabel(f: string): string {
  const map: Record<string, string> = {
    random_pairs: "Chia cặp ngẫu nhiên",
    random_groups: "Chia bảng ngẫu nhiên",
    single_elim: "Single Elimination",
    double_elim: "Double Elimination",
    round_robin: "Round Robin",
    swiss: "Swiss",
    group_knockout: "Group + Knockout",
  };
  return map[f] ?? f;
}
