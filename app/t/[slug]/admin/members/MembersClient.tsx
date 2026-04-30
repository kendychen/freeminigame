"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Upload, Dice5, Users } from "lucide-react";
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
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  addPlayer,
  bulkImportPlayers,
  bulkSetPlayerTags,
  clearTeamsAndMembers,
  createPlayerTeamDraw,
  deletePlayer,
  setPlayerTag,
} from "@/app/actions/players";
import { getActiveDraw } from "@/app/actions/group-draw";
import { ExternalLink } from "lucide-react";

interface Player {
  id: string;
  name: string;
  handle: string | null;
  rating: number | null;
  seed_tag: string | null;
  created_at: string;
}

type TagPreset = "AB" | "MF" | "custom";

const PRESET_LABELS: Record<Exclude<TagPreset, "custom">, [string, string]> = {
  AB: ["A", "B"],
  MF: ["Nam", "Nữ"],
};

function presetLabelsOf(preset: TagPreset): [string, string] | null {
  return preset === "custom" ? null : PRESET_LABELS[preset];
}

/** Tag-picker toolbar: choose preset + bulk actions. */
function TagPickerToolbar({
  preset,
  setPreset,
  disabled,
  counts,
  onRandomSplit,
  onClear,
}: {
  preset: TagPreset;
  setPreset: (p: TagPreset) => void;
  disabled: boolean;
  counts: { left: number; right: number; untagged: number };
  onRandomSplit: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
}) {
  const labels = presetLabelsOf(preset);
  return (
    <div className="space-y-2 rounded-lg border border-dashed bg-secondary/20 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Phân tag thủ công:</span>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as TagPreset)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          disabled={disabled}
        >
          <option value="AB">A vs B</option>
          <option value="MF">Nam vs Nữ</option>
          <option value="custom">Tuỳ chỉnh (gõ tay)</option>
        </select>
        {labels && (
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={disabled}
            onClick={() => onRandomSplit()}
          >
            🎲 Random 50:50
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          type="button"
          disabled={disabled}
          onClick={() => onClear()}
        >
          Xoá tất cả tag
        </Button>
      </div>
      {labels && (
        <div className="flex flex-wrap gap-3 text-[11px]">
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 font-semibold text-blue-600 dark:text-blue-400">
            {labels[0]}: {counts.left}
          </span>
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 font-semibold text-orange-600 dark:text-orange-400">
            {labels[1]}: {counts.right}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            Chưa gán: {counts.untagged}
          </span>
        </div>
      )}
    </div>
  );
}

export function MembersClient({
  tournamentId,
  initialPlayers,
}: {
  tournamentId: string;
  tournamentName: string;
  initialPlayers: Player[];
  hasTeams: boolean;
}) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [name, setName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [teamSize, setTeamSize] = useState(2);
  const [teamCount, setTeamCount] = useState(0);
  const [drawMode, setDrawMode] = useState<"random_all" | "balanced_by_tag">(
    "random_all",
  );
  const [tagPreset, setTagPreset] = useState<TagPreset>("AB");
  const [pending, startTransition] = useTransition();
  const [activeDraw, setActiveDraw] = useState<{
    code: string;
    host_token: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const res = await getActiveDraw(tournamentId);
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

  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`players:${tournamentId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async () => {
          const { data } = await sb
            .from("players")
            .select("id, name, handle, rating, seed_tag, created_at")
            .eq("tournament_id", tournamentId)
            .order("created_at");
          if (data) setPlayers(data as Player[]);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [tournamentId]);

  // Sync teams count
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const refresh = async () => {
      const { count } = await sb
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId);
      setTeamCount(count ?? 0);
    };
    void refresh();
    const ch = sb
      .channel(`teams-count:${tournamentId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [tournamentId]);

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addPlayer({ tournamentId, name: name.trim() });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setName("");
    });
  };

  const onImport = () => {
    const names = csvText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    startTransition(async () => {
      const res = await bulkImportPlayers({ tournamentId, names });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Đã thêm", description: `${res.count} thành viên` });
      setCsvText("");
    });
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      const res = await deletePlayer({ tournamentId, playerId: id });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      }
    });
  };

  const onClearTeams = () => {
    if (
      !confirm(
        "Xoá tất cả đội và phân bảng hiện có? Thành viên sẽ giữ nguyên.",
      )
    )
      return;
    startTransition(async () => {
      const res = await clearTeamsAndMembers(tournamentId);
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Đã xoá tất cả đội" });
      }
    });
  };

  const onTeamDraw = () => {
    if (players.length < teamSize) {
      toast({
        title: "Chưa đủ thành viên",
        description: `Cần ít nhất ${teamSize} thành viên`,
        variant: "destructive",
      });
      return;
    }
    if (teamCount > 0) {
      toast({
        title: "Đội đã tồn tại",
        description: "Bấm 'Xoá đội' trước khi bốc thăm chia đội mới",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const res = await createPlayerTeamDraw({
        tournamentId,
        teamSize,
        drawMode,
      });
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
      window.open(`/pair/${res.code}?host=${res.host_token}`, "_blank");
      toast({
        title: "Đã mở phòng bốc thăm chia đội",
        description: `Sau khi bốc thăm xong, ${Math.ceil(players.length / teamSize)} đội sẽ được tạo tự động`,
      });
    });
  };

  const expectedTeams = Math.ceil(players.length / teamSize);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Thành viên ({players.length})
          </CardTitle>
          <CardDescription>
            Nhập danh sách người chơi của giải. Sau đó bốc thăm chia đội random
            — server tự tạo {expectedTeams || "?"} đội với{" "}
            {teamSize} người mỗi đội.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Add player */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thêm thành viên</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="flex gap-2">
            <Input
              placeholder="Tên thành viên"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={pending || !name.trim()}>
              <Plus className="size-4" />
              Thêm
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Bulk import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import danh sách</CardTitle>
          <CardDescription>Mỗi dòng 1 tên</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full rounded-md border bg-background p-2 font-mono text-sm"
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"Nguyễn Văn A\nTrần Thị B\nLê Văn C\n..."}
          />
          <Button
            onClick={onImport}
            variant="outline"
            disabled={pending || !csvText.trim()}
          >
            <Upload className="size-4" />
            Import
          </Button>
        </CardContent>
      </Card>

      {/* Random team draw */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dice5 className="size-5 text-primary" />
            Bốc thăm chia đội random (realtime)
          </CardTitle>
          <CardDescription>
            Chia ngẫu nhiên thành viên vào các đội. Server tự tạo đội + thêm
            thành viên + sinh sơ đồ thi đấu sau khi bốc thăm xong.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tổng thành viên</Label>
              <div className="flex h-10 items-center rounded-md border bg-secondary/30 px-3 text-sm">
                {players.length} người
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Người/đội</Label>
              <Input
                id="size"
                type="number"
                value={teamSize}
                onChange={(e) =>
                  setTeamSize(
                    Math.max(2, Math.min(20, Number(e.target.value) || 2)),
                  )
                }
                min={2}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Số đội tạo ra</Label>
              <div className="flex h-10 items-center rounded-md border bg-secondary/30 px-3 text-sm">
                {expectedTeams} đội{" "}
                {players.length % teamSize !== 0 &&
                  `(${players.length % teamSize} dư BYE)`}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="drawMode">Cách bốc thăm</Label>
            <select
              id="drawMode"
              value={drawMode}
              onChange={(e) =>
                setDrawMode(
                  e.target.value as "random_all" | "balanced_by_tag",
                )
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="random_all">Random toàn bộ</option>
              <option value="balanced_by_tag">
                Cân bằng theo Tag (A vs B, Nam vs Nữ…)
              </option>
            </select>
            {drawMode === "balanced_by_tag" && (
              <p className="text-xs text-muted-foreground">
                Mỗi đội sẽ có 1 người mỗi nhóm Tag. Nhập Tag bên dưới (vd:{" "}
                <code>A</code> / <code>B</code>, <code>Nam</code> /{" "}
                <code>Nữ</code>).
              </p>
            )}
          </div>

          <TagPickerToolbar
            preset={tagPreset}
            setPreset={setTagPreset}
            disabled={pending}
            counts={(() => {
              const labels = presetLabelsOf(tagPreset);
              if (!labels) {
                return {
                  left: 0,
                  right: 0,
                  untagged: players.filter((p) => !p.seed_tag).length,
                };
              }
              const left = players.filter((p) => p.seed_tag === labels[0]).length;
              const right = players.filter((p) => p.seed_tag === labels[1]).length;
              return {
                left,
                right,
                untagged: players.length - left - right,
              };
            })()}
            onRandomSplit={async () => {
              const labels = presetLabelsOf(tagPreset);
              if (!labels) return;
              // Shuffle a copy so the split is random, not by row order
              const shuffled = [...players].sort(() => Math.random() - 0.5);
              const half = Math.ceil(shuffled.length / 2);
              const assignments = shuffled.map((p, i) => ({
                playerId: p.id,
                tag: i < half ? labels[0] : labels[1],
              }));
              const res = await bulkSetPlayerTags({
                tournamentId,
                assignments,
              });
              if ("error" in res) {
                toast({
                  title: "Lỗi",
                  description: translateError(res.error),
                  variant: "destructive",
                });
                return;
              }
              const tagById = new Map(
                assignments.map((a) => [a.playerId, a.tag]),
              );
              setPlayers((prev) =>
                prev.map((p) => ({
                  ...p,
                  seed_tag: tagById.get(p.id) ?? p.seed_tag,
                })),
              );
              toast({
                title: "Đã chia 50:50",
                description: `${labels[0]}: ${half} người · ${labels[1]}: ${
                  shuffled.length - half
                } người`,
              });
            }}
            onClear={async () => {
              const res = await bulkSetPlayerTags({
                tournamentId,
                assignments: players.map((p) => ({
                  playerId: p.id,
                  tag: null,
                })),
              });
              if ("error" in res) return;
              setPlayers((prev) =>
                prev.map((p) => ({ ...p, seed_tag: null })),
              );
            }}
          />

          {activeDraw && teamCount === 0 && (
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
              onClick={onTeamDraw}
              disabled={
                pending ||
                players.length < teamSize ||
                teamCount > 0 ||
                !!activeDraw
              }
              size="lg"
            >
              <Dice5 className="size-4" />
              {teamCount > 0
                ? `✅ Đã tạo ${teamCount} đội — bốc 1 lần duy nhất`
                : activeDraw
                  ? "🔒 Đang có phiên bốc thăm…"
                  : "🎲 Bốc thăm chia đội realtime"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Bốc thăm chia đội 1 lần duy nhất. Sau bốc thăm, sang tab{" "}
            <strong>"Chia bảng"</strong> để bốc thăm chia đội vào bảng A/B/C/D
            — sơ đồ thi đấu sẽ tự sinh từ đó.
          </p>
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách</CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chưa có thành viên nào. Thêm ở trên hoặc import danh sách.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(() => {
                const labels = presetLabelsOf(tagPreset);
                const quickSet = async (
                  playerId: string,
                  next: string | null,
                ) => {
                  const cur =
                    players.find((x) => x.id === playerId)?.seed_tag ?? null;
                  const cleaned = next?.trim() ? next.trim() : null;
                  if (cur === cleaned) {
                    // Toggle off if clicking same tag
                    setPlayers((prev) =>
                      prev.map((x) =>
                        x.id === playerId ? { ...x, seed_tag: null } : x,
                      ),
                    );
                    await setPlayerTag({
                      tournamentId,
                      playerId,
                      tag: null,
                    });
                    return;
                  }
                  setPlayers((prev) =>
                    prev.map((x) =>
                      x.id === playerId ? { ...x, seed_tag: cleaned } : x,
                    ),
                  );
                  await setPlayerTag({
                    tournamentId,
                    playerId,
                    tag: cleaned,
                  });
                };
                return players.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <span className="flex flex-1 items-center gap-2 truncate">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {labels && (
                        <span className="flex overflow-hidden rounded-md border">
                          {labels.map((lbl, idx) => {
                            const active = p.seed_tag === lbl;
                            const colorActive =
                              idx === 0
                                ? "bg-blue-500 text-white"
                                : "bg-orange-500 text-white";
                            return (
                              <button
                                key={lbl}
                                type="button"
                                onClick={() => quickSet(p.id, lbl)}
                                className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                                  active
                                    ? colorActive
                                    : "bg-secondary text-muted-foreground hover:bg-accent"
                                } ${idx === 0 ? "border-r" : ""}`}
                                aria-pressed={active}
                                title={`Đặt tag ${lbl}${active ? " (bấm lại để bỏ)" : ""}`}
                              >
                                {lbl}
                              </button>
                            );
                          })}
                        </span>
                      )}
                      {tagPreset === "custom" && (
                        <input
                          defaultValue={p.seed_tag ?? ""}
                          placeholder="Tag"
                          maxLength={12}
                          onBlur={async (e) => {
                            const next = e.target.value.trim();
                            if ((p.seed_tag ?? "") === next) return;
                            await quickSet(p.id, next || null);
                          }}
                          className="h-7 w-16 rounded-md border bg-background px-2 text-xs"
                          title="Hạt giống / nhãn"
                        />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(p.id)}
                        disabled={pending}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </span>
                  </div>
                ));
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
