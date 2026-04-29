import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * Service-role client. NEVER import from client components.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service env vars missing");
  }
  return createSbClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
