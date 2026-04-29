"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Upload, Dice5, RotateCcw, Users } from "lucide-react";
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
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  addPlayer,
  bulkImportPlayers,
  clearTeamsAndMembers,
  createPlayerTeamDraw,
  deletePlayer,
} from "@/app/actions/players";

interface Player {
  id: string;
  name: string;
  handle: string | null;
  rating: number | null;
  created_at: string;
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
  const [pending, startTransition] = useTransition();

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
            .select("id, name, handle, rating, created_at")
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
          description: res.error,
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
          description: res.error,
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
          description: res.error,
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
          description: res.error,
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
      const res = await createPlayerTeamDraw({ tournamentId, teamSize });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: res.error,
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

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onTeamDraw}
              disabled={
                pending ||
                players.length < teamSize ||
                teamCount > 0
              }
              size="lg"
            >
              <Dice5 className="size-4" />
              {teamCount > 0
                ? `Đã tạo ${teamCount} đội — xoá trước nếu muốn bốc lại`
                : "🎲 Bốc thăm chia đội realtime"}
            </Button>
            {teamCount > 0 && (
              <Button onClick={onClearTeams} variant="outline">
                <RotateCcw className="size-4" />
                Xoá tất cả đội
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Bốc thăm 1 lần duy nhất. Sau bốc thăm, server tự sinh sơ đồ thi
            đấu (bracket) theo format giải.
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
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(p.id)}
                    disabled={pending}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
