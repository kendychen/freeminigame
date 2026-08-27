import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TECHNIQUES, isTechniqueSlug, getTechnique } from "@/lib/videos/techniques";
import { listTechniqueVideos } from "@/lib/videos/queries";
import { TechniqueChips } from "@/components/videos/TechniqueChips";
import { TechniqueBrowser } from "@/components/videos/VideoBrowser";

export const revalidate = 3600;
export function generateStaticParams() { return TECHNIQUES.map((t) => ({ technique: t.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ technique: string }> }): Promise<Metadata> {
  const { technique } = await params;
  if (!isTechniqueSlug(technique)) return {};
  const t = getTechnique(technique);
  return { title: `${t.nameVi} (${t.nameEn}) — video kỹ thuật Pickleball`, description: `Video hướng dẫn ${t.nameVi} pickleball, tóm tắt tiếng Việt.` };
}

export default async function TechniquePage({ params }: { params: Promise<{ technique: string }> }) {
  const { technique } = await params;
  if (!isTechniqueSlug(technique)) notFound();
  const t = getTechnique(technique);
  const byMarket = await listTechniqueVideos(technique, 20);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <header className="py-4 sm:py-6">
        <h1 className="text-2xl font-extrabold">{t.nameVi} <span className="block text-base font-normal text-muted-foreground sm:inline">{t.nameEn}</span></h1>
      </header>
      <TechniqueChips active={technique} />
      <div className="mt-6">
        <Suspense fallback={null}>
          <TechniqueBrowser byMarket={byMarket} />
        </Suspense>
      </div>
    </main>
  );
}
