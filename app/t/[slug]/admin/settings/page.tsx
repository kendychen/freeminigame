import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SettingsClient } from "./SettingsClient";

export default async function TournamentSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  return <SettingsClient tournament={t} />;
}
