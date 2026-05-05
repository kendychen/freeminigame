"use server";

import { requireSiteAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export interface DbMetrics {
  active_connections: number;
  idle_connections: number;
  total_connections: number;
  db_size_mb: number;
  max_connections: number;
}

export async function fetchDbMetrics(): Promise<DbMetrics | null> {
  await requireSiteAdmin();
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("get_server_metrics");
  if (error) return null;
  return data as DbMetrics;
}
