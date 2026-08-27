import Link from "next/link";
import type { Metadata } from "next";
import { TECHNIQUES } from "@/lib/videos/techniques";
import { listOverview } from "@/lib/videos/queries";
import { TechniqueChips } from "@/components/videos/TechniqueChips";
import { VideoGrid } from "@/components/videos/VideoGrid";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Học kỹ thuật Pickleball — video theo từng động tác",
  description: "Tổng hợp video YouTube dạy kỹ thuật pickleball: giao bóng, dink, third shot drop, volley, Erne, ATP… có tóm tắt tiếng Việt.",
};

export default async function VideosPage() {
  const overview = await listOverview(4);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <header className="py-8">
        <h1 className="text-3xl font-extrabold">Học kỹ thuật Pickleball</h1>
        <p className="mt-2 text-muted-foreground">Video hướng dẫn chọn lọc theo từng động tác, có tóm tắt tiếng Việt. Cập nhật hàng tuần.</p>
      </header>
      <TechniqueChips />
      {TECHNIQUES.map((t) => (
        <section key={t.slug} className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">{t.nameVi} <span className="text-sm font-normal text-muted-foreground">{t.nameEn}</span></h2>
            <Link href={`/videos/${t.slug}`} className="text-sm text-primary">Xem tất cả →</Link>
          </div>
          {overview[t.slug]?.length ? <VideoGrid cards={overview[t.slug]!} /> : <p className="text-sm text-muted-foreground">Đang cập nhật…</p>}
        </section>
      ))}
    </main>
  );
}
