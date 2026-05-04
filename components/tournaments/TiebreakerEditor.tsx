"use client";

import { useRef } from "react";
import { GripVertical, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { TieBreakerConfig } from "@/lib/standings/types";

const TB_LABELS: Record<string, string> = {
  head_to_head: "Đối đầu trực tiếp",
  point_differential: "Hiệu số (BT − BB)",
  buchholz: "Buchholz",
  sonneborn_berger: "Sonneborn-Berger",
  auxiliary_points: "Điểm phụ",
  random: "Bốc thăm ngẫu nhiên",
};

const ALL_TB_TYPES = Object.keys(TB_LABELS) as TieBreakerConfig["type"][];

export function TiebreakerEditor({
  value,
  onChange,
}: {
  value: TieBreakerConfig[];
  onChange: (v: TieBreakerConfig[]) => void;
}) {
  const dragIdx = useRef<number | null>(null);
  const activeTypes = new Set(value.map((t) => t.type));
  const available = ALL_TB_TYPES.filter((t) => !activeTypes.has(t));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next.map((t, i) => ({ ...t, order: i + 1 })));
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const add = (type: TieBreakerConfig["type"]) => {
    onChange([...value, { type, order: value.length + 1 }]);
  };

  return (
    <div className="space-y-2">
      <Label>Thứ tự ưu tiên khi bằng điểm</Label>
      <p className="text-xs text-muted-foreground">Kéo để sắp xếp lại thứ tự.</p>
      <div className="space-y-1">
        {value.map((tb, idx) => (
          <div
            key={tb.type}
            draggable
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={() => {
              if (dragIdx.current !== null) reorder(dragIdx.current, idx);
              dragIdx.current = null;
            }}
            className="flex items-center gap-2 rounded-md border bg-secondary/30 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {idx + 1}
            </span>
            <span className="flex-1 text-sm">{TB_LABELS[tb.type]}</span>
            {tb.type !== "random" && (
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Xoá"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {available.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => add(t)}
              className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-secondary transition-colors"
            >
              + {TB_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
