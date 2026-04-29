"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addTeam,
  bulkImportTeams,
  deleteTeam,
} from "@/app/actions/teams";
import { toast } from "@/components/ui/toast";
import { translateError } from "@/lib/error-messages";

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
  initial,
}: {
  tournamentId: string;
  initial: TeamRow[];
}) {
  const [teams, setTeams] = useState<TeamRow[]>(initial);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [rating, setRating] = useState("");
  const [csvText, setCsvText] = useState("");
  const [isPending, start] = useTransition();

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
                    <th className="px-3 py-2">Khu vực</th>
                    <th className="px-3 py-2">Rating</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{t.name}</td>
                      <td className="px-3 py-2 text-center">{t.region ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{t.rating ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(t.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
