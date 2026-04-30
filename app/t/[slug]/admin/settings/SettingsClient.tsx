"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2 } from "lucide-react";
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
import {
  inviteCoAdmin,
  removeCoAdmin,
  setCoAdminRole,
  softDeleteTournament,
  togglePublic,
  updatePlateConfig,
} from "@/app/actions/tournaments";
import type { DbTournament } from "@/types/database";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";

interface AdminEntry {
  id: string;
  role: "owner" | "co_admin" | "viewer";
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  createdAt: string;
}

export function SettingsClient({
  tournament,
  admins: initialAdmins,
  isOwner,
  currentUserId,
}: {
  tournament: DbTournament;
  admins: AdminEntry[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminEntry[]>(initialAdmins);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"co_admin" | "viewer">(
    "co_admin",
  );
  const [isPublic, setPublic] = useState(tournament.is_public);
  const [pending, start] = useTransition();

  const cfg = (tournament.config ?? {}) as {
    plateEnabled?: boolean;
    qualifyPerGroup?: number;
    qualifyPlatePerGroup?: number;
  };
  const isGroupKO = tournament.format === "group_knockout";
  const [plateEnabled, setPlateEnabled] = useState(!!cfg.plateEnabled);
  const [qpg, setQpg] = useState<number>(cfg.qualifyPerGroup ?? 2);
  const [qpgPlate, setQpgPlate] = useState<number>(
    cfg.qualifyPlatePerGroup ?? 1,
  );

  const onInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    start(async () => {
      const res = await inviteCoAdmin({
        tournamentId: tournament.id,
        email,
        role: inviteRole,
      });
      if ("error" in res) {
        toast({
          title: "Mời thất bại",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Đã thêm đồng quản trị",
        description: `${res.invitedEmail ?? email} với vai trò ${
          inviteRole === "co_admin" ? "Đồng admin" : "Người xem"
        }`,
      });
      setInviteEmail("");
      router.refresh();
    });
  };

  const onRemove = (adminId: string, name: string) => {
    if (!confirm(`Xoá ${name} khỏi danh sách quản trị?`)) return;
    start(async () => {
      const res = await removeCoAdmin({
        tournamentId: tournament.id,
        adminId,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
      toast({ title: `Đã xoá ${name}` });
    });
  };

  const onChangeRole = (adminId: string, role: "co_admin" | "viewer") => {
    start(async () => {
      const res = await setCoAdminRole({
        tournamentId: tournament.id,
        adminId,
        role,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setAdmins((prev) =>
        prev.map((a) => (a.id === adminId ? { ...a, role } : a)),
      );
    });
  };

  const onSavePlate = () =>
    start(async () => {
      const res = await updatePlateConfig({
        tournamentId: tournament.id,
        plateEnabled,
        qualifyPerGroup: qpg,
        qualifyPlatePerGroup: qpgPlate,
      });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
      } else {
        toast({ title: "Đã lưu cấu hình" });
        router.refresh();
      }
    });

  const onTogglePublic = () =>
    start(async () => {
      const next = !isPublic;
      const res = await togglePublic(tournament.id, next);
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      } else {
        setPublic(next);
        toast({ title: next ? "Đã công khai" : "Đã ẩn" });
      }
    });

  const onDelete = () => {
    if (!confirm("Xoá giải đấu này? Có thể khôi phục bởi super_admin.")) return;
    start(async () => {
      const res = await softDeleteTournament(tournament.id);
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
      } else {
        router.push("/dashboard");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hiển thị</CardTitle>
          <CardDescription>Bật/tắt chế độ công khai cho viewer.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onTogglePublic} disabled={pending}>
            {isPublic ? "Đang công khai · Click để ẩn" : "Đang ẩn · Click để công khai"}
          </Button>
        </CardContent>
      </Card>

      {isGroupKO && (
        <Card>
          <CardHeader>
            <CardTitle>Cúp phụ (Series B)</CardTitle>
            <CardDescription>
              Chia 2 nhánh đấu sau vòng bảng: top vào Cúp chính, kế tiếp vào Cúp phụ.
              Chỉ chỉnh được trước khi tạo knockout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={plateEnabled}
                onChange={(e) => setPlateEnabled(e.target.checked)}
                className="size-4 accent-primary"
              />
              Bật Cúp phụ
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="qpg">Số đội/bảng vào Cúp chính</Label>
                <Input
                  id="qpg"
                  type="number"
                  min={1}
                  max={8}
                  value={qpg}
                  onChange={(e) =>
                    setQpg(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </div>
              <div>
                <Label htmlFor="qpgp">Số đội/bảng vào Cúp phụ</Label>
                <Input
                  id="qpgp"
                  type="number"
                  min={0}
                  max={8}
                  value={qpgPlate}
                  onChange={(e) =>
                    setQpgPlate(Math.max(0, Number(e.target.value) || 0))
                  }
                  disabled={!plateEnabled}
                />
              </div>
            </div>
            <Button onClick={onSavePlate} disabled={pending}>
              Lưu cấu hình
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Đồng quản trị viên
          </CardTitle>
          <CardDescription>
            Mời người dùng FreeMinigame khác cùng quản lý giải. Đồng admin có
            thể bốc thăm + chấm điểm; Người xem chỉ xem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner && (
            <form
              onSubmit={onInvite}
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email người được mời</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:w-44">
                <Label htmlFor="invite-role">Vai trò</Label>
                <Select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "co_admin" | "viewer")
                  }
                >
                  <option value="co_admin">Đồng admin</option>
                  <option value="viewer">Người xem</option>
                </Select>
              </div>
              <Button
                type="submit"
                disabled={pending || !inviteEmail.trim()}
                className="sm:w-auto"
              >
                <UserPlus className="size-4" />
                Mời
              </Button>
            </form>
          )}
          {!isOwner && (
            <p className="rounded-md border border-dashed bg-secondary/30 p-3 text-xs text-muted-foreground">
              Chỉ chủ giải đấu mới mời được đồng admin.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Danh sách quản trị ({admins.length})
            </p>
            {admins.length === 0 ? (
              <p className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
                Chưa có ai.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {admins.map((a) => {
                  const isMe = a.id === currentUserId;
                  const isOwnerRow = a.role === "owner";
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 p-3 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {a.avatarUrl ? (
                          <img
                            src={a.avatarUrl}
                            alt=""
                            className="size-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                            {a.displayName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {a.displayName}
                            {isMe && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (bạn)
                              </span>
                            )}
                          </p>
                          {a.email && (
                            <p className="truncate text-xs text-muted-foreground">
                              {a.email}
                            </p>
                          )}
                        </div>
                      </div>
                      {isOwnerRow ? (
                        <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          👑 Chủ giải
                        </span>
                      ) : isOwner ? (
                        <>
                          <Select
                            value={a.role}
                            onChange={(e) =>
                              onChangeRole(
                                a.id,
                                e.target.value as "co_admin" | "viewer",
                              )
                            }
                            disabled={pending}
                            className="h-8 w-32 text-xs"
                          >
                            <option value="co_admin">Đồng admin</option>
                            <option value="viewer">Người xem</option>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemove(a.id, a.displayName)}
                            disabled={pending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {a.role === "co_admin" ? "Đồng admin" : "Người xem"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vùng nguy hiểm</CardTitle>
          <CardDescription>
            Xoá giải đấu (soft-delete). Có thể khôi phục bởi super_admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            Xoá giải đấu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
