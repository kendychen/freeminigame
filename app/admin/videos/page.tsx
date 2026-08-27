import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { TECHNIQUES, isTechniqueSlug } from "@/lib/videos/techniques";
import { listTechniqueVideosAdmin } from "@/lib/videos/queries";
import { AdminVideoTable } from "@/components/videos/AdminVideoTable";
import { SettingsPanel } from "@/components/videos/SettingsPanel";
import { getSettingStatuses } from "@/lib/settings";

export const dynamic = "force-dynamic";
// Server actions in this segment (refreshTechniqueNow) inherit this budget.
export const maxDuration = 60;

export default async function VideosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const slug = t && isTechniqueSlug(t) ? t : "serve";
  const [cards, { data: states }, settings] = await Promise.all([
    listTechniqueVideosAdmin(slug),
    createServiceClient()
      .from("technique_refresh_state")
      .select("slug, last_refreshed_at, last_error")
      .order("slug"),
    getSettingStatuses(),
  ]);
  const stateRows = (states ?? []).map((s) => ({
    slug: s.slug as string,
    lastRefreshedAt: s.last_refreshed_at as string | null,
    lastError: s.last_error as string | null,
  }));
  const state = (states ?? []).find((s) => s.slug === slug);
  return (
    <div className="pb-8">
      <h1 className="mb-4 text-2xl font-extrabold">Quản lý video kỹ thuật</h1>
      <div className="flex flex-wrap gap-2">
        {TECHNIQUES.map((x) => (
          <Link
            key={x.slug}
            href={`/admin/videos?t=${x.slug}`}
            className={`rounded-full border px-3 py-1 text-sm ${x.slug === slug ? "bg-primary text-primary-foreground" : ""}`}
          >
            {x.nameVi}
          </Link>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Cập nhật lần cuối:{" "}
        {state?.last_refreshed_at
          ? new Date(state.last_refreshed_at).toLocaleString("vi-VN")
          : "chưa"}
        {state?.last_error && (
          <span className="ml-2 text-destructive">Lỗi: {state.last_error}</span>
        )}
      </p>
      <AdminVideoTable technique={slug} cards={cards} />
      <SettingsPanel settings={settings} states={stateRows} />
    </div>
  );
}
