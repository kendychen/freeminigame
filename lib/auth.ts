import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { user, supabase };
}

export async function getOptionalUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { user, supabase };
  } catch {
    return { user: null, supabase: null };
  }
}

export async function requireSiteAdmin() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("site_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["moderator", "super_admin"].includes(profile.site_role)) {
    redirect("/");
  }
  return { user, supabase, role: profile.site_role as "moderator" | "super_admin" };
}

export async function requireSuperAdmin() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("site_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.site_role !== "super_admin") redirect("/");
  return { user, supabase };
}

export async function requireTournamentAdmin(tournamentId: string) {
  const { user, supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, owner_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) redirect("/dashboard");
  if (t.owner_id === user.id) return { user, supabase, role: "owner" as const };
  const { data: ta } = await supabase
    .from("tournament_admins")
    .select("role")
    .eq("tournament_id", tournamentId)
    .eq("admin_id", user.id)
    .maybeSingle();
  if (!ta || !["owner", "co_admin"].includes(ta.role)) redirect("/dashboard");
  return { user, supabase, role: ta.role as "owner" | "co_admin" };
}
