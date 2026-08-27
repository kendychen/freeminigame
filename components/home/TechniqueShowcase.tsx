import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { TECHNIQUES } from "@/lib/videos/techniques";

/** Compact, high-contrast banner pointing to /videos. No data fetch. */
export function TechniqueShowcase({ containerClass = "max-w-7xl" }: { containerClass?: string }) {
  return (
    <section id="ky-thuat" className={`mx-auto w-full ${containerClass} px-4 py-6 sm:py-8`}>
      <Link
        href="/videos"
        className="group flex flex-col gap-4 rounded-3xl border-2 border-primary/40 bg-primary/10 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/15 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <PlayCircle className="size-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Miễn phí · có tóm tắt tiếng Việt</p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">Hướng dẫn Kỹ thuật Pickleball</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Video chọn lọc theo {TECHNIQUES.length} động tác — giao bóng, dink, third shot, volley… Việt Nam / thế giới, cơ bản / nâng cao.
            </p>
          </div>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground group-hover:opacity-90">
          Xem video <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </section>
  );
}
