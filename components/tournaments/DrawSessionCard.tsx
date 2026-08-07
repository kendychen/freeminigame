"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Radio, Copy, ExternalLink, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  createTournamentDrawSession,
  getActiveTournamentDraw,
  cancelTournamentDrawSession,
  type TDrawMode,
} from "@/app/actions/tournament-draw";

interface Entrant {
  id: string;
  name: string;
}

interface ActiveSession {
  code: string;
  mode: TDrawMode;
  entrantTokens: Record<string, string>;
  drawnCount: number;
  total: number;
}

/**
 * Admin card: create/resume a LIVE self-draw session with one personal link
 * per entrant (/t/draw/[code]?p=token).
 * - variant "teams": bốc chia bảng (group_knockout) or bốc vị trí nhánh (elim/swiss/rr)
 * - variant "pair": bốc thăm ghép đôi từ danh sách VĐV (1 Nam + 1 Nữ theo tag, tuỳ chọn)
 */
export function DrawSessionCard({
  tournamentId,
  variant,
  isGroupFormat,
  entrants,
  disabledReason,
}: {
  tournamentId: string;
  variant: "teams" | "pair";
  isGroupFormat?: boolean;
  entrants: Entrant[];
  disabledReason?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [groupCount, setGroupCount] = useState(2);
  const [teamCount, setTeamCount] = useState(0); // 0 = auto (số VĐV / 2)
  const [balanced, setBalanced] = useState(true);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const res = await getActiveTournamentDraw(tournamentId);
        if (!mounted) return;
        setActive(res.active ? res : null);
      } catch {
        /* transient */
      }
    };
    void refresh();
    const interval = setInterval(refresh, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [tournamentId]);

  const maxGroups = Math.max(2, Math.floor(entrants.length / 2));
  const maxTeams = Math.max(2, Math.floor(entrants.length / 2));
  const effTeamCount = teamCount || maxTeams;
  const isAllPairs = entrants.length === effTeamCount * 2;
  const nameById = new Map(entrants.map((e) => [e.id, e.name]));
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const mode: TDrawMode =
    variant === "pair" ? "pair" : isGroupFormat ? "group" : "slot";

  const onCreate = () => {
    startTransition(async () => {
      const res = await createTournamentDrawSession({
        tournamentId,
        mode,
        groupCount: mode === "group" ? groupCount : undefined,
        teamCount: mode === "pair" ? effTeamCount : undefined,
        balancedByTag: mode === "pair" ? balanced && isAllPairs : undefined,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Đã tạo phiên bốc thăm!",
        description: "Gửi link riêng cho từng người bên dưới",
      });
    });
  };

  const onCancel = () => {
    if (!active) return;
    if (!confirm("Hủy phiên bốc thăm này? Kết quả đã quay sẽ bị bỏ.")) return;
    startTransition(async () => {
      const res = await cancelTournamentDrawSession(active.code);
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setActive(null);
      toast({ title: "Đã hủy phiên bốc thăm" });
    });
  };

  const copyText = (text: string, label: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: `Đã copy ${label}` }))
      .catch(() => toast({ title: "Không copy được", variant: "destructive" }));
  };

  const modeTitle =
    variant === "pair"
      ? "Bốc thăm ghép đôi — mỗi VĐV 1 link"
      : isGroupFormat
        ? "Bốc thăm chia bảng — mỗi đội 1 link"
        : "Bốc thăm vị trí nhánh đấu — mỗi đội 1 link";

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-5 text-primary" />
          {modeTitle}
        </CardTitle>
        <CardDescription>
          {variant === "pair"
            ? "Không cần tạo đội trước. Mỗi VĐV mở link riêng, tự bấm quay — kết quả hiện LIVE trên mọi máy. Bốc xong admin xác nhận, hệ tự tạo Đội 1, Đội 2… và ghép người theo đúng kết quả."
            : isGroupFormat
              ? "Mỗi đội mở link riêng, tự bấm quay vào bảng — mọi người xem LIVE. Bốc xong admin xác nhận, sơ đồ sinh theo đúng kết quả."
              : "Mỗi đội mở link riêng, tự bấm quay vị trí trong nhánh đấu — mọi người xem LIVE."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {active ? (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
              <Radio className="size-4 animate-pulse text-red-500" />
              <span className="font-semibold">
                Phiên đang chạy · {active.drawnCount}/{active.total} đã quay
              </span>
              <span className="text-xs text-muted-foreground">
                Mã: <code>{active.code}</code>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/t/draw/${active.code}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm">
                  <ExternalLink className="size-3.5" />
                  Mở trang bốc thăm (admin)
                </Button>
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(`${origin}/t/draw/${active.code}`, "link chung")}
              >
                <Copy className="size-3.5" />
                Copy link chung
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const lines = Object.entries(active.entrantTokens).map(
                    ([id, token]) =>
                      `${nameById.get(id) ?? "?"}: ${origin}/t/draw/${active.code}?p=${token}`,
                  );
                  copyText(lines.join("\n"), "tất cả link riêng");
                }}
              >
                <Copy className="size-3.5" />
                Copy tất cả link riêng
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={onCancel}
                disabled={pending}
              >
                <XCircle className="size-3.5" />
                Hủy phiên
              </Button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
              {Object.entries(active.entrantTokens).map(([id, token]) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/50"
                >
                  <span className="truncate">{nameById.get(id) ?? "?"}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0"
                    onClick={() =>
                      copyText(
                        `${origin}/t/draw/${active.code}?p=${token}`,
                        `link của ${nameById.get(id) ?? "?"}`,
                      )
                    }
                  >
                    <Copy className="size-3" />
                    Copy link
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Gửi mỗi người đúng link của họ (link khoá theo tên — chỉ quay được
              cho mình). Link chung thì ai bấm tên nào cũng được.
            </p>
          </>
        ) : (
          <>
            {mode === "group" && (
              <div className="flex items-end gap-3">
                <div className="space-y-2">
                  <Label>Số bảng đấu</Label>
                  <select
                    value={groupCount}
                    onChange={(e) => setGroupCount(Number(e.target.value))}
                    className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Array.from({ length: Math.max(0, maxGroups - 1) }, (_, i) => i + 2).map(
                      (n) => (
                        <option key={n} value={n}>
                          {n} bảng
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <p className="pb-2 text-xs text-muted-foreground">
                  {entrants.length} đội → mỗi bảng ~
                  {Math.ceil(entrants.length / groupCount)} đội
                </p>
              </div>
            )}
            {mode === "pair" && (
              <>
                <div className="flex items-end gap-3">
                  <div className="space-y-2">
                    <Label>Số đội</Label>
                    <select
                      value={effTeamCount}
                      onChange={(e) => setTeamCount(Number(e.target.value))}
                      className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Array.from(
                        { length: Math.max(0, maxTeams - 1) },
                        (_, i) => i + 2,
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n} đội
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="pb-2 text-xs text-muted-foreground">
                    Tên mặc định Đội 1…Đội {effTeamCount} ·{" "}
                    {entrants.length} VĐV →{" "}
                    {isAllPairs
                      ? "2 người/đội"
                      : `${Math.floor(entrants.length / effTeamCount)}–${Math.ceil(entrants.length / effTeamCount)} người/đội`}
                  </p>
                </div>
                <label
                  className={`flex items-center gap-2 text-sm ${isAllPairs ? "" : "opacity-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={balanced && isAllPairs}
                    disabled={!isAllPairs}
                    onChange={(e) => setBalanced(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Mỗi đội 1 Nam + 1 Nữ (theo tag Nam/Nữ ở danh sách)
                  {!isAllPairs && (
                    <span className="text-xs text-muted-foreground">
                      — cần đúng 2 người/đội
                    </span>
                  )}
                </label>
              </>
            )}
            {disabledReason ? (
              <p className="text-sm text-muted-foreground">⚠️ {disabledReason}</p>
            ) : (
              <Button onClick={onCreate} disabled={pending} size="lg">
                <Link2 className="size-4" />
                {pending ? "Đang tạo…" : "🎲 Tạo phiên bốc thăm LIVE"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
