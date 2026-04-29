"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Check } from "lucide-react";
import { toast } from "@/components/ui/toast";

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payload: { data: unknown; format: string; team_count: number };
}

export function ShareDialog({ open, onOpenChange, payload }: ShareDialogProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quick-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !json.code) {
        toast({
          title: "Không thể tạo link",
          description: json.error ?? "Lỗi không xác định",
          variant: "destructive",
        });
        return;
      }
      setCode(json.code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi mạng";
      toast({ title: "Lỗi", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const url =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/quick/share/${code}`
      : "";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chia sẻ bảng đấu</DialogTitle>
          <DialogDescription>
            Tạo link công khai. Hết hạn sau 72 giờ.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!code ? (
            <Button onClick={submit} disabled={loading} className="w-full">
              <Share2 className="size-4" />
              {loading ? "Đang tạo link…" : "Tạo link chia sẻ"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Input value={url} readOnly />
              <Button onClick={copy} className="w-full" variant="outline">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Đã copy" : "Copy link"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Mã: <code className="font-mono">{code}</code> · Hết hạn sau 72h
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
