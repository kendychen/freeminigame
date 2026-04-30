import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/service";

const SITE = "https://hoinhompick.team";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/quick/new`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/pair/new`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/score/new`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Public tournaments (is_public + not deleted) — discoverable
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("tournaments")
      .select("slug, updated_at")
      .eq("is_public", true)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);
    const tRoutes: MetadataRoute.Sitemap = (data ?? []).map((t) => ({
      url: `${SITE}/t/${t.slug}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : now,
      changeFrequency: "daily",
      priority: 0.6,
    }));
    return [...staticRoutes, ...tRoutes];
  } catch {
    return staticRoutes;
  }
}
