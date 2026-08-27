import { Suspense } from "react";
import type { Metadata } from "next";
import { TECHNIQUES } from "@/lib/videos/techniques";
import { listOverview } from "@/lib/videos/queries";
import { TechniqueChips } from "@/components/videos/TechniqueChips";
import { OverviewBrowser } from "@/components/videos/VideoBrowser";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Học kỹ thuật Pickleball — video theo từng động tác",
  description: "Tổng hợp video YouTube dạy kỹ thuật pickleball: giao bóng, dink, third shot drop, volley, Erne, ATP… có tóm tắt tiếng Việt.",
};

export default async function VideosPage() {
  // Load extra per technique so the level filter still has 4 to show.
  const overview = await listOverview(12);
  const sections = TECHNIQUES.map((t) => ({
    slug: t.slug, nameVi: t.nameVi, nameEn: t.nameEn,
    byMarket: overview[t.slug] ?? { vn: [], global: [] },
  }));
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <header className="py-8">
        <h1 className="text-3xl font-extrabold">Học kỹ thuật Pickleball</h1>
        <p className="mt-2 text-muted-foreground">Video hướng dẫn chọn lọc theo từng động tác, có tóm tắt tiếng Việt. Chọn video Việt Nam hoặc toàn thế giới, lọc theo trình độ. Cập nhật hàng tuần.</p>
      </header>
      <TechniqueChips />
      <div className="mt-6">
        <Suspense fallback={null}>
          <OverviewBrowser sections={sections} perTechnique={4} />
        </Suspense>
      </div>
    </main>
  );
}
