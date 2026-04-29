"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }],
    })),
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(t: Omit<Toast, "id">) {
  useToastStore.getState().push(t);
}

export function Toaster() {
  const { toasts, remove } = useToastStore();
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => remove(t.id), 4000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, remove]);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-md border p-4 shadow-lg min-w-[280px] bg-background",
            t.variant === "destructive" && "border-destructive bg-destructive/10",
          )}
        >
          <div className="font-medium">{t.title}</div>
          {t.description && (
            <div className="text-sm text-muted-foreground">{t.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}
