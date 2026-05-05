"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { fetchDbMetrics, type DbMetrics } from "@/app/actions/admin/metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshCw, AlertTriangle, CheckCircle, Users, Database, Zap } from "lucide-react";

// ── Supabase Free Tier hard limits ──────────────────────────
const LIMITS = {
  realtimeConn: 200,   // concurrent Realtime connections
  storageMb: 500,      // database storage in MB
  bandwidthGb: 5,      // outbound bandwidth per month (GB)
};

// ── threshold colours ────────────────────────────────────────
function pctColor(pct: number) {
  if (pct >= 85) return "bg-red-500";
  if (pct >= 65) return "bg-amber-400";
  return "bg-green-500";
}

function StatusIcon({ pct }: { pct: number }) {
  if (pct >= 65)
    return <AlertTriangle className="size-4 text-amber-500 shrink-0" />;
  return <CheckCircle className="size-4 text-green-500 shrink-0" />;
}

// ── Gauge bar ────────────────────────────────────────────────
function Gauge({
  label,
  value,
  max,
  unit = "",
  helpText,
}: {
  label: string;
  value: number | null;
  max: number;
  unit?: string;
  helpText?: string;
}) {
  const pct = value != null ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barClass = value != null ? pctColor(pct) : "bg-muted";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1.5 font-medium">
          {value != null && <StatusIcon pct={pct} />}
          {label}
        </div>
        <span className="tabular-nums text-muted-foreground">
          {value != null ? `${value}${unit} / ${max}${unit}` : "—"}
          {value != null && <span className="ml-1 text-xs">({pct}%)</span>}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────
export function CapacityDashboard({
  initialMetrics,
}: {
  initialMetrics: DbMetrics | null;
}) {
  const [metrics, setMetrics] = useState<DbMetrics | null>(initialMetrics);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();

  // ── Realtime Presence: count connected users ─────────────
  // Use a fresh client (not the singleton) so the channel is independent
  // from the SitePresenceTracker that already subscribed on the same singleton.
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const adminId = "__admin__" + Math.random().toString(36).slice(2);
    const channel = sb.channel("site-presence", {
      config: { presence: { key: adminId } },
    });

    const sync = () => {
      const state = channel.presenceState();
      // Exclude this admin observer tab from the count
      const count = Object.keys(state).filter((k) => !k.startsWith("__admin__")).length;
      setOnlineUsers(count);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          channel.track({ pid: adminId });
        }
      });

    return () => {
      void sb.removeChannel(channel);
    };
  }, []);

  // ── Refresh DB metrics via server action ─────────────────
  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = await fetchDbMetrics();
      if (data) {
        setMetrics(data);
        setLastRefresh(new Date());
      }
    });
  }, []);

  // Auto-refresh every 60 s
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  // ── Derived values ───────────────────────────────────────
  const maxConn = metrics?.max_connections ?? 60;
  const activeConn = metrics?.active_connections ?? null;
  const dbMb = metrics?.db_size_mb ?? null;

  const onlinePct = Math.min(100, Math.round((onlineUsers / LIMITS.realtimeConn) * 100));
  const connPct = activeConn != null ? Math.min(100, Math.round((activeConn / maxConn) * 100)) : 0;
  const dbPct = dbMb != null ? Math.min(100, Math.round((dbMb / LIMITS.storageMb) * 100)) : 0;

  const needsUpgrade = onlinePct >= 65 || connPct >= 65 || dbPct >= 65;

  return (
    <div className="space-y-4">
      {/* ── Upgrade banner ──────────────────────────────── */}
      {needsUpgrade && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Sắp chạm giới hạn — cân nhắc nâng cấp server
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-400">
              Supabase Pro ($25/tháng): tăng lên 500 Realtime conn, 8 GB DB, 250 GB bandwidth.
              Vercel Pro ($20/tháng): thêm edge network, analytics, log streaming.
            </p>
          </div>
        </div>
      )}

      {/* ── Online users (real-time) ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Người dùng đang online
            </CardTitle>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block size-2 animate-pulse rounded-full bg-green-500" />
              Real-time
            </span>
          </div>
          <CardDescription>
            Đếm qua Supabase Realtime Presence — giới hạn Free tier: {LIMITS.realtimeConn} kết nối đồng thời
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tabular-nums">{onlineUsers}</span>
            <span className="mb-1 text-sm text-muted-foreground">/ {LIMITS.realtimeConn} capacity</span>
          </div>
          <Gauge
            label="Realtime connections"
            value={onlineUsers}
            max={LIMITS.realtimeConn}
            helpText={
              onlinePct >= 85
                ? "⚠️ Gần đầy — nâng cấp ngay"
                : onlinePct >= 65
                ? "⚠️ Cảnh báo — theo dõi chặt"
                : "✅ Bình thường"
            }
          />
          <p className="text-xs text-muted-foreground">
            Mỗi tab mở bảng điểm / chia bảng realtime = 1 kết nối. Người chỉ xem trang tĩnh không tính.
          </p>
        </CardContent>
      </Card>

      {/* ── DB metrics ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4" />
              Tài nguyên Database (Supabase)
            </CardTitle>
            <button
              onClick={refresh}
              disabled={isPending}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${isPending ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </div>
          <CardDescription>
            Cập nhật lúc {lastRefresh.toLocaleTimeString("vi-VN")} · tự làm mới mỗi 60 giây
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Gauge
            label="Kết nối DB active"
            value={activeConn}
            max={maxConn}
            helpText={
              metrics == null
                ? "Chạy migration 0028 để kích hoạt metric này"
                : `${metrics.idle_connections} idle · ${metrics.total_connections} tổng cộng`
            }
          />
          <Gauge
            label="Dung lượng DB"
            value={dbMb}
            max={LIMITS.storageMb}
            unit=" MB"
            helpText={
              dbMb != null && dbPct >= 65
                ? "⚠️ Cần dọn dữ liệu cũ hoặc nâng cấp"
                : undefined
            }
          />
        </CardContent>
      </Card>

      {/* ── Capacity cheat sheet ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4" />
            Ước tính sức chịu tải
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
              <p className="font-semibold">Free tier (hiện tại)</p>
              <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                <li>~<strong className="text-foreground">200</strong> user xem realtime cùng lúc</li>
                <li>~<strong className="text-foreground">500+</strong> user trang tĩnh cùng lúc</li>
                <li>500 MB database · 5 GB bandwidth/tháng</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
              <p className="font-semibold">Supabase Pro ($25/tháng)</p>
              <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                <li>~<strong className="text-foreground">500</strong> user realtime cùng lúc</li>
                <li>8 GB database · 250 GB bandwidth</li>
                <li>Daily backups · No pausing</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Nút thắt cổ chai của app này là <strong>Supabase Realtime</strong> (200 conn free).
            Vercel tự scale serverless functions — không cần lo phía frontend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
