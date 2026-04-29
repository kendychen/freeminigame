import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  if (
    req.headers.get("authorization") !== `Bearer ${process.env.SNAPSHOT_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = createServiceClient();
  const [{ count: rows }, { count: tournaments }] = await Promise.all([
    sb.from("tournaments").select("id", { count: "exact", head: true }),
    sb.from("matches").select("id", { count: "exact", head: true }),
  ]);
  const snapshot = {
    supabase_rows: (rows ?? 0) + (tournaments ?? 0),
    storage_mb: null,
    bandwidth_mb: null,
    realtime_conn: null,
    sentry_errors_7d: null,
    captured_at: new Date().toISOString(),
  };
  await sb.from("site_settings").upsert({
    key: "health_snapshot",
    value: snapshot,
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
