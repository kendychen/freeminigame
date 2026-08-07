"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { CATEGORY_LABELS } from "@/lib/team/types";
import type { DbTeamPlayer, DbTeamRubber, DbTeamTie, Gender, RubberCategory } from "@/lib/team/types";
import type { LineupSlots } from "@/lib/team/validate";

const CATEGORY_HINTS: Record<RubberCategory, string> = {
  MD: "Chỉ chọn VĐV nam — 2 mỗi bên",
  WD: "Chỉ chọn VĐV nữ — 2 mỗi bên",
  XD: "Mỗi bên cần 1 nam + 1 nữ",
  FD: "Chọn 2 VĐV bất kỳ mỗi bên",
};

function SideColumn({
  title, roster, chosen, category, playedIn, allowRepeatPlayer, onToggle, onClear,
}: {
  title: string;
  roster: DbTeamPlayer[];
  chosen: string[];
  category: RubberCategory;
  playedIn: Map<string, number>;
  allowRepeatPlayer: boolean;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const chosenGenders = chosen
    .map((id) => roster.find((p) => p.id === id)?.gender)
    .filter((g): g is Gender => !!g);
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-bold text-primary">{title}</p>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          {chosen.length}/2
          {chosen.length > 0 && (
            <button onClick={onClear} className="underline hover:text-foreground">xóa</button>
          )}
        </span>
      </div>
      <div className="space-y-1">
        {roster.length === 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">Không có VĐV phù hợp</p>
        )}
        {roster.map((p) => {
          const idx = chosen.indexOf(p.id);
          const selected = idx >= 0;
          const playedNo = playedIn.get(p.id);
          const repeatBlocked = playedNo !== undefined && !allowRepeatPlayer;
          const genderBlocked =
            category === "XD" && !selected && chosenGenders.length === 1 && chosenGenders[0] === p.gender;
          const full = !selected && chosen.length >= 2;
          const disabled = repeatBlocked || genderBlocked || full;
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              disabled={disabled}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
                selected ? "border-primary bg-primary/10" : "hover:border-primary/50"
              }`}
            >
              <span className={`size-2 shrink-0 rounded-full ${p.gender === "M" ? "bg-blue-500" : "bg-pink-500"}`} />
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              {playedNo !== undefined && (
                <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                  đã đấu C{playedNo}
                </span>
              )}
              {selected && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LineupSheet({
  rubber, tie, tieRubbers, players, squadAName, squadBName, allowRepeatPlayer, pending, onSave, onClose,
}: {
  rubber: DbTeamRubber;
  tie: DbTeamTie;
  tieRubbers: DbTeamRubber[];
  players: DbTeamPlayer[];
  squadAName: string;
  squadBName: string;
  allowRepeatPlayer: boolean;
  pending: boolean;
  onSave: (slots: LineupSlots) => void;
  onClose: () => void;
}) {
  const [chosenA, setChosenA] = useState<string[]>(
    [rubber.a1_id, rubber.a2_id].filter((id): id is string => !!id),
  );
  const [chosenB, setChosenB] = useState<string[]>(
    [rubber.b1_id, rubber.b2_id].filter((id): id is string => !!id),
  );

  const playedIn = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of tieRubbers) {
      if (r.id === rubber.id) continue;
      for (const id of [r.a1_id, r.a2_id, r.b1_id, r.b2_id]) {
        if (!id) continue;
        const cur = m.get(id);
        if (cur === undefined || r.rubber_no < cur) m.set(id, r.rubber_no);
      }
    }
    return m;
  }, [tieRubbers, rubber.id]);

  const genderOk = (g: Gender) =>
    rubber.category === "MD" ? g === "M" : rubber.category === "WD" ? g === "F" : true;
  const rosterA = players.filter((p) => p.squad_id === tie.squad_a_id && genderOk(p.gender));
  const rosterB = players.filter((p) => p.squad_id === tie.squad_b_id && genderOk(p.gender));

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? prev : [...prev, id],
    );

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] self-end overflow-y-auto rounded-b-none rounded-t-2xl p-4 sm:self-center sm:rounded-lg sm:p-6">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-base">
            Xếp đội hình — {CATEGORY_LABELS[rubber.category]} (C{rubber.rubber_no})
          </DialogTitle>
          <DialogDescription>
            {CATEGORY_HINTS[rubber.category]}
            {!allowRepeatPlayer && " · giải này không cho VĐV đánh lặp nội dung"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <SideColumn
            title={squadAName}
            roster={rosterA}
            chosen={chosenA}
            category={rubber.category}
            playedIn={playedIn}
            allowRepeatPlayer={allowRepeatPlayer}
            onToggle={toggle(setChosenA)}
            onClear={() => setChosenA([])}
          />
          <SideColumn
            title={squadBName}
            roster={rosterB}
            chosen={chosenB}
            category={rubber.category}
            playedIn={playedIn}
            allowRepeatPlayer={allowRepeatPlayer}
            onToggle={toggle(setChosenB)}
            onClear={() => setChosenB([])}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={pending}>
            Hủy
          </Button>
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() =>
              onSave({
                a1: chosenA[0] ?? null,
                a2: chosenA[1] ?? null,
                b1: chosenB[0] ?? null,
                b2: chosenB[1] ?? null,
              })
            }
          >
            {pending ? "Đang lưu…" : "Lưu đội hình"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
