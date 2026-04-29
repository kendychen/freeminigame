"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-2xl font-bold text-destructive">Lỗi không mong đợi</h2>
      <p className="text-sm text-muted-foreground text-center">
        Đã có lỗi xảy ra khi tải trang.
      </p>
      <div className="w-full rounded-md border bg-secondary/30 p-4 font-mono text-xs">
        <div>
          <strong>Message:</strong> {error.message || "(no message)"}
        </div>
        {error.digest && (
          <div>
            <strong>Digest:</strong> {error.digest}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Thử lại</Button>
        <Link href="/">
          <Button variant="outline">Về trang chủ</Button>
        </Link>
      </div>
    </div>
  );
}
