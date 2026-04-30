"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Dice5, Users, Wand2 } from "lucide-react";
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
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  clearTournamentGroups,
  createTournamentGroupDraw,
  ensureBracket,
  getActiveDraw,
  manualAssignGroup,
} from "@/app/actions/group-draw";
import { getOrCreateScopedRefereeToken } from "@/app/actions/matches";
import { ExternalLink, Link2 } from "lucide-react";
import { ChatBox } from "@/components/chat/ChatBox";

interface TeamRow {
  id: string;
  name: string;
  group_label: string | null;
  region: string | null;
  rating: number | null;
  seed: number | null;
}

const GROUP_LABELS = "ABCDEFGHIJKLMNOP".split("");

export function GroupsClient({
  tournamentId,
  tournamentName,
  initialTeams,
  membersByTeam,
}: {
  tournamentId: string;
  tournamentName: string;
  initialTeams: TeamRow[];
  membersByTeam: Record<string, { id: string; name: string }[]>;
}) {
  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);
  const [groupSize, setGroupSize] = useState(4);
  const [pending, startTransition] = useTransition();
  const [activeDraw, setActiveDraw] = useState<{
    code: string;
    host_token: string;
    status: string;
  } | null>(null);

  // Poll the active linked pair_session every 3s so the button locks as soon
  // as another tab/user creates one.
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const res = await getActiveDraw(tournamentId, "group");
      if (!mounted) return;
      if ("active" in res && res.active) {
        setActiveDraw({
          code: res.code,
          host_token: res.host_token,
          status: res.status,
        });
      } else {
        setActiveDraw(null);
      }
    };
    void refresh();
    const interval = setInterval(refresh, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [tournamentId]);

  // Realtime: refresh teams on changes
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`teams-groups:${tournamentId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async () => {
          const { data } = await sb
            .from("teams")
            .select("id, name, group_label, region, rating, seed")
            .eq("tournament_id", tournamentId)
            .order("group_label", { ascending: true, nullsFirst: false })
            .order("seed", { ascending: true, nullsFirst: false });
          if (data) setTeams(data as TeamRow[]);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [tournamentId]);

  const groupCount = Math.ceil(teams.length / groupSize);

  const groupedTeams = useMemo(() => {
    const map = new Map<string, TeamRow[]>();
    const unassigned: TeamRow[] = [];
    for (const t of teams) {
      if (!t.group_label) {
        unassigned.push(t);
      } else {
        const arr = map.get(t.group_label) ?? [];
        arr.push(t);
        map.set(t.group_label, arr);
      }
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return { groups: sorted, unassigned };
  }, [teams]);

  const onLaunchDraw = () => {
    if (teams.length < groupSize) {
      toast({
        title: "Chưa đủ đội",
        description: `Cần ít nhất ${groupSize} đội`,
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const res = await createTournamentGroupDraw({ tournamentId, groupSize });
      if ("error" in res) {
        if (res.error === "draw_in_progress" && "existingCode" in res) {
          window.open(
            `/pair/${res.existingCode}?host=${res.existingHostToken}`,
            "_blank",
          );
          toast({
            title: "Đã có phiên bốc thăm",
            description: "Mở lại phòng đang chạy",
          });
          return;
        }
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setActiveDraw({
        code: res.code,
        host_token: res.host_token,
        status: "lobby",
      });
      window.open(`/pair/${res.code}?host=${res.host_token}`, "_blank");
      toast({
        title: "Đã mở phòng bốc thăm",
        description:
          "Sau khi bốc thăm xong, các bảng A/B/C/D sẽ tự động hiển thị ở trang này",
      });
    });
  };

  const onClear = () => {
    if (!confirm("Xoá tất cả phân bảng hiện tại?")) return;
    startTransition(async () => {
      const res = await clearTournamentGroups(tournamentId);
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      }
    });
  };

  const onChangeLabel = (teamId: string, label: string) => {
    startTransition(async () => {
      await manualAssignGroup({
        tournamentId,
        teamId,
        groupLabel: label === "—" ? null : label,
      });
    });
  };

  const onShareGroup = (label: string) => {
    startTransition(async () => {
      const res = await getOrCreateScopedRefereeToken({
        tournamentId,
        scope: "group",
        scopeValue: label,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      const url = `${window.location.origin}/r/${res.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: `Đã copy link trọng tài bảng ${label}`,
          description: url,
        });
      } catch {
        prompt("Sao chép link trọng tài:", url);
      }
    });
  };

  const onEnsureBracket = () => {
    startTransition(async () => {
      const res = await ensureBracket(tournamentId);
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      if (res.alreadyGenerated) {
        toast({
          title: "Sơ đồ đã có sẵn",
          description: "Vào tab 'Sơ đồ thi đấu' để xem",
        });
      } else {
        toast({
          title: "Đã sinh sơ đồ thi đấu",
          description: `${res.count} trận được tạo`,
        });
      }
    });
  };

  const hasGroups = groupedTeams.groups.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chia bảng đấu</CardTitle>
          <CardDescription>
            Bốc thăm ngẫu nhiên realtime hoặc gán thủ công. Tự đồng bộ sang
            mọi người đang xem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tổng số đội</Label>
              <div className="flex h-10 items-center rounded-md border bg-secondary/30 px-3 text-sm">
                {teams.length} đội
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Đội mỗi bảng</Label>
              <Input
                id="size"
                type="number"
                value={groupSize}
                onChange={(e) =>
                  setGroupSize(
                    Math.max(2, Math.min(20, Number(e.target.value) || 4)),
                  )
                }
                min={2}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Số bảng</Label>
              <div className="flex h-10 items-center rounded-md border bg-secondary/30 px-3 text-sm">
                {groupCount} bảng ({GROUP_LABELS.slice(0, groupCount).join(", ")})
              </div>
            </div>
          </div>

          {activeDraw && !hasGroups && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                🎲 Phiên bốc thăm đang chạy
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Trạng thái: <strong>{activeDraw.status}</strong> · Mã{" "}
                <code>{activeDraw.code}</code>
              </p>
              <a
                href={`/pair/${activeDraw.code}?host=${activeDraw.host_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
              >
                <ExternalLink className="size-3" />
                Mở phòng host
              </a>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onLaunchDraw}
              disabled={
                pending ||
                teams.length < groupSize ||
                hasGroups ||
                !!activeDraw
              }
            >
              <Dice5 className="size-4" />
              {pending
                ? "Đang tạo phòng…"
                : hasGroups
                  ? "✅ Đã bốc thăm xong"
                  : activeDraw
                    ? "🔒 Đang có phiên bốc thăm…"
                    : "🎲 Bốc thăm chia bảng realtime"}
            </Button>
            {hasGroups && (
              <Button
                variant="outline"
                onClick={onEnsureBracket}
                disabled={pending}
              >
                <Wand2 className="size-4" />
                Sinh sơ đồ thi đấu
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Mỗi giải đấu chỉ bốc thăm chia bảng 1 lần. Sau khi bốc thăm, sơ
            đồ thi đấu tự động sinh; nếu chưa thấy ở tab "Sơ đồ thi đấu", bấm
            <strong> Sinh sơ đồ thi đấu </strong> để tạo thủ công.
          </p>
        </CardContent>
      </Card>

      {/* Current groups */}
      {hasGroups ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {groupedTeams.groups.map(([label, list]) => (
            <Card key={label}>
              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {label}
                  </span>
                  <span className="flex-1 truncate">Bảng {label}</span>
                  <span className="shrink-0 whitespace-nowrap text-xs font-normal text-muted-foreground">
                    {list.length} đội
                  </span>
                </CardTitle>
                <button
                  type="button"
                  onClick={() => onShareGroup(label)}
                  disabled={pending}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                  title={`Copy link trọng tài bảng ${label}`}
                >
                  <Link2 className="size-3.5" />
                  Link trọng tài bảng {label}
                </button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {list.map((t) => {
                    const members = membersByTeam[t.id] ?? [];
                    return (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-2 rounded px-1 py-1 hover:bg-accent"
                      >
                        <span className="flex flex-1 flex-col gap-0.5 truncate">
                          <span className="truncate font-medium">{t.name}</span>
                          {members.length > 0 && (
                            <span className="truncate text-[11px] text-muted-foreground">
                              {members.map((m) => m.name).join(" · ")}
                            </span>
                          )}
                        </span>
                        <Select
                          value={t.group_label ?? "—"}
                          onChange={(e) => onChangeLabel(t.id, e.target.value)}
                          disabled={pending}
                          className="h-7 w-16 text-xs"
                        >
                          <option value="—">—</option>
                          {GROUP_LABELS.slice(0, groupCount).map((lbl) => (
                            <option key={lbl} value={lbl}>
                              {lbl}
                            </option>
                          ))}
                        </Select>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Chưa chia bảng nào. Bấm <strong>Bốc thăm chia bảng realtime</strong>{" "}
              ở trên để bắt đầu.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unassigned */}
      {groupedTeams.unassigned.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Chưa phân bảng ({groupedTeams.unassigned.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groupedTeams.unassigned.map((t) => {
                const members = membersByTeam[t.id] ?? [];
                return (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="flex flex-1 flex-col gap-0.5 truncate">
                    <span className="truncate font-medium">{t.name}</span>
                    {members.length > 0 && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {members.map((m) => m.name).join(" · ")}
                      </span>
                    )}
                  </span>
                  <Select
                    value="—"
                    onChange={(e) => onChangeLabel(t.id, e.target.value)}
                    disabled={pending}
                    className="h-7 w-16 text-xs"
                  >
                    <option value="—">—</option>
                    {GROUP_LABELS.slice(0, Math.max(groupCount, 4)).map(
                      (lbl) => (
                        <option key={lbl} value={lbl}>
                          {lbl}
                        </option>
                      ),
                    )}
                  </Select>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <ChatBox channelKey={`tournament:${tournamentId}`} title="Chat ban điều hành" />
    </div>
  );
}
