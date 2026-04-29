"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold text-destructive">Lỗi tải trang</h2>
      <p className="text-sm text-muted-foreground">
        Đã có lỗi xảy ra. Bạn có thể thử lại hoặc quay về dashboard.
      </p>
      <div className="rounded-md border bg-secondary/30 p-4 font-mono text-xs">
        <div>
          <strong>Message:</strong> {error.message || "(no message)"}
        </div>
        {error.digest && (
          <div>
            <strong>Digest:</strong> {error.digest}
          </div>
        )}
        {error.stack && (
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[10px]">
            {error.stack}
          </pre>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Thử lại</Button>
        <Link href="/dashboard">
          <Button variant="outline">Về Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
