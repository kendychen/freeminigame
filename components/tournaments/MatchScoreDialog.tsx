"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Match, Team } from "@/lib/pairing/types";

export interface MatchScoreDialogProps {
  match: Match | null;
  teams: Team[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (matchId: string, scoreA: number, scoreB: number) => void;
}

export function MatchScoreDialog({
  match,
  teams,
  open,
  onOpenChange,
  onSave,
}: MatchScoreDialogProps) {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  useEffect(() => {
    if (match) {
      setScoreA(match.scoreA);
      setScoreB(match.scoreB);
    }
  }, [match]);

  if (!match) return null;

  const teamA = teams.find((t) => t.id === match.teamA);
  const teamB = teams.find((t) => t.id === match.teamB);
  const canSave = match.teamA && match.teamB;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhập điểm trận đấu</DialogTitle>
          <DialogDescription>
            Vòng {match.round}, trận {match.matchNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>{teamA?.name ?? "—"}</Label>
            <Input
              type="number"
              value={scoreA}
              onChange={(e) =>
                setScoreA(Math.max(0, Number(e.target.value) || 0))
              }
              disabled={!canSave}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>{teamB?.name ?? "—"}</Label>
            <Input
              type="number"
              value={scoreB}
              onChange={(e) =>
                setScoreB(Math.max(0, Number(e.target.value) || 0))
              }
              disabled={!canSave}
              min={0}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            onClick={() => {
              onSave(match.id, scoreA, scoreB);
              onOpenChange(false);
            }}
            disabled={!canSave || scoreA === scoreB}
          >
            Lưu kết quả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
