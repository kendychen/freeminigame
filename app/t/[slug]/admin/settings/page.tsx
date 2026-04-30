import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SettingsClient } from "./SettingsClient";

export default async function TournamentSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();

  const isOwner = t.owner_id === user.id;

  // Load admin list with display names + emails (service role to read auth.users emails)
  const { data: adminRows } = await supabase
    .from("tournament_admins")
    .select("admin_id, role, created_at, profiles(id, display_name, avatar_url)")
    .eq("tournament_id", t.id)
    .order("created_at");
  type AdminRow = {
    admin_id: string;
    role: "owner" | "co_admin" | "viewer";
    created_at: string;
    profiles:
      | { id: string; display_name: string | null; avatar_url: string | null }
      | { id: string; display_name: string | null; avatar_url: string | null }[]
      | null;
  };
  const rows = (adminRows ?? []) as AdminRow[];
  const adminIds = rows.map((r) => r.admin_id);

  let emailMap = new Map<string, string>();
  if (isOwner && adminIds.length > 0) {
    try {
      const svc = createServiceClient();
      const { data: list } = await svc.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      for (const u of list?.users ?? []) {
        if (u.email && adminIds.includes(u.id)) {
          emailMap.set(u.id, u.email);
        }
      }
    } catch {
      /* missing service env — skip emails */
    }
  }

  const admins = rows.map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.admin_id,
      role: r.role,
      displayName: p?.display_name ?? "User",
      avatarUrl: p?.avatar_url ?? null,
      email: emailMap.get(r.admin_id) ?? null,
      createdAt: r.created_at,
    };
  });

  return (
    <SettingsClient
      tournament={t}
      admins={admins}
      isOwner={isOwner}
      currentUserId={user.id}
    />
  );
}
