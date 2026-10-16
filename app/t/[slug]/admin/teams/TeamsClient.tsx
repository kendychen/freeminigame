"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addTeam,
  addTeamMember,
  bulkImportTeams,
  deleteTeam,
  removeTeamMember,
  updateTeam,
} from "@/app/actions/teams";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";
import { DrawSessionCard } from "@/components/tournaments/DrawSessionCard";

interface TeamRow {
  id: string;
  name: string;
  region: string | null;
  rating: number | null;
  seed: number | null;
  logo_url: string | null;
}

export function TeamsClient({
  tournamentId,
  format,
  hasMatches,
  initial,
  membersByTeam,
  players,
}: {
  tournamentId: string;
  format: string;
  hasMatches: boolean;
  initial: TeamRow[];
  membersByTeam: Record<string, { id: string; name: string }[]>;
  players: { id: string; name: string }[];
}) {
  const [teams, setTeams] = useState<TeamRow[]>(initial);
  // Thành viên hiển thị trong bảng — state để thêm/xoá cập nhật ngay.
  const [members, setMembers] = useState(membersByTeam);
  // Đội đang mở ô chọn VĐV để thêm thành viên.
  const [addToTeam, setAddToTeam] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [rating, setRating] = useState("");
  const [csvText, setCsvText] = useState("");
  const [isPending, start] = useTransition();

  // Sửa tên đội ngay trên bảng: id đang sửa + giá trị đang gõ.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (t: TeamRow) => {
    setEditId(t.id);
    setEditName(t.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  const onRename = (id: string) => {
    const next = editName.trim();
    const current = teams.find((t) => t.id === id)?.name ?? "";
    if (!next || next === current) {
      cancelEdit();
      return;
    }
    start(async () => {
      const res = await updateTeam({ id, tournamentId, name: next });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setTeams((p) => p.map((t) => (t.id === id ? { ...t, name: next } : t)));
      cancelEdit();
      toast({ title: "Đã đổi tên đội" });
    });
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const res = await addTeam({
        tournamentId,
        name: name.trim(),
        region: region || undefined,
        rating: rating ? Number(rating) : undefined,
      });
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
        return;
      }
      setTeams((p) => [
        ...p,
        {
          id: crypto.randomUUID(),
          name,
          region: region || null,
          rating: rating ? Number(rating) : null,
          seed: null,
          logo_url: null,
        },
      ]);
      setName("");
      setRegion("");
      setRating("");
    });
  };

  const onAddMember = (teamId: string, playerId: string) => {
    if (!playerId) return;
    const picked = players.find((p) => p.id === playerId);
    if (!picked) return;
    start(async () => {
      const res = await addTeamMember({ tournamentId, teamId, playerId });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setMembers((prev) => ({
        ...prev,
        [teamId]: [...(prev[teamId] ?? []), picked],
      }));
      setAddToTeam(null);
      toast({ title: "Đã thêm thành viên", description: picked.name });
    });
  };

  const onRemoveMember = (teamId: string, playerId: string) =>
    start(async () => {
      const res = await removeTeamMember({ tournamentId, teamId, playerId });
      if ("error" in res) {
        toast({
          title: "Lỗi",
          description: translateError(res.error),
          variant: "destructive",
        });
        return;
      }
      setMembers((prev) => ({
        ...prev,
        [teamId]: (prev[teamId] ?? []).filter((m) => m.id !== playerId),
      }));
    });

  const onDelete = (id: string) =>
    start(async () => {
      const res = await deleteTeam({ id, tournamentId });
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
        return;
      }
      setTeams((p) => p.filter((x) => x.id !== id));
    });

  const onImport = () => {
    const rows = csvText
      .split(/\r?\n/)
      .map((line) => line.split(",").map((c) => c.trim()))
      .filter((cols) => cols[0])
      .map((cols) => ({
        name: cols[0]!,
        region: cols[1] || undefined,
        rating: cols[2] ? Number(cols[2]) : undefined,
      }));
    if (!rows.length) return;
    start(async () => {
      const res = await bulkImportTeams({ tournamentId, rows });
      if ("error" in res) {
        toast({ title: "Lỗi", description: translateError(res.error), variant: "destructive" });
        return;
      }
      toast({ title: "Import thành công", description: `${res.count} đội` });
      setCsvText("");
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      <DrawSessionCard
        tournamentId={tournamentId}
        variant="teams"
        isGroupFormat={format === "group_knockout"}
        entrants={teams.map((t) => ({ id: t.id, name: t.name }))}
        disabledReason={
          hasMatches
            ? "Sơ đồ thi đấu đã được tạo — không bốc thăm lại được"
            : teams.length < 2
              ? "Cần ít nhất 2 đội để bốc thăm"
              : null
        }
      />
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
        💡 Giải đôi từ danh sách VĐV: <strong>không cần tạo đội ở đây</strong> —
        sang tab <strong>Thành viên</strong>, thêm VĐV rồi bốc thăm ghép đôi, hệ
        tự tạo Đội 1, Đội 2… theo kết quả quay.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thêm đội</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Tên</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Khu vực</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <Input
                type="number"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isPending} className="md:col-span-4">
              <Plus className="size-4" />
              Thêm
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Mỗi dòng: <code>tên, khu vực (tuỳ chọn), rating (tuỳ chọn)</code>
          </p>
          <textarea
            className="w-full rounded-md border bg-background p-2 font-mono text-sm"
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"Đội Sấm Sét, Hà Nội, 1500\nĐội Bão Tố, Sài Gòn, 1450"}
          />
          <Button onClick={onImport} variant="outline" disabled={isPending || !csvText.trim()}>
            <Upload className="size-4" />
            Import
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách đội ({teams.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có đội nào.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Tên</th>
                    <th className="px-3 py-2 text-left">Thành viên</th>
                    <th className="px-3 py-2">Khu vực</th>
                    <th className="px-3 py-2">Rating</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const teamMembers = members[t.id] ?? [];
                    const memberIds = new Set(teamMembers.map((m) => m.id));
                    // Chỉ cho chọn VĐV chưa ở trong đội này.
                    const available = players.filter(
                      (p) => !memberIds.has(p.id),
                    );
                    return (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">
                          {editId === t.id ? (
                            <Input
                              value={editName}
                              autoFocus
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  onRename(t.id);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                              }}
                              className="h-8"
                            />
                          ) : (
                            t.name
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-1">
                            {teamMembers.length === 0 && (
                              <span className="opacity-50">—</span>
                            )}
                            {teamMembers.map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5"
                              >
                                {m.name}
                                <button
                                  type="button"
                                  disabled={isPending}
                                  title={`Xoá ${m.name} khỏi đội`}
                                  onClick={() => onRemoveMember(t.id, m.id)}
                                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                            {addToTeam === t.id ? (
                              <select
                                autoFocus
                                disabled={isPending}
                                defaultValue=""
                                onChange={(e) =>
                                  onAddMember(t.id, e.target.value)
                                }
                                onBlur={() => setAddToTeam(null)}
                                className="h-7 rounded-md border bg-background px-1 text-xs"
                              >
                                <option value="">Chọn VĐV…</option>
                                {available.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              available.length > 0 && (
                                <button
                                  type="button"
                                  disabled={isPending}
                                  title="Thêm thành viên"
                                  onClick={() => setAddToTeam(t.id)}
                                  className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 hover:border-primary hover:text-primary disabled:opacity-50"
                                >
                                  <Plus className="size-3" />
                                  Thêm
                                </button>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">{t.region ?? "—"}</td>
                        <td className="px-3 py-2 text-center">{t.rating ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {editId === t.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isPending}
                                  title="Lưu tên"
                                  onClick={() => onRename(t.id)}
                                >
                                  <Check className="size-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Huỷ"
                                  onClick={cancelEdit}
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Sửa tên"
                                  onClick={() => startEdit(t)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Xoá đội"
                                  onClick={() => onDelete(t.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
