import Link from "next/link";
import { cn } from "@/lib/utils";
import { TECHNIQUES } from "@/lib/videos/techniques";

export function TechniqueChips({ active }: { active?: string }) {
  return (
    <nav className="sticky top-[calc(3.5rem+var(--safe-top))] z-10 -mx-4 min-w-0 overflow-x-auto [contain:inline-size] bg-background/95 px-4 py-2 backdrop-blur sm:top-[calc(4rem+var(--safe-top))]">
      <div className="flex gap-2 w-max">
        {TECHNIQUES.map((t) => (
          <Link key={t.slug} href={`/videos/${t.slug}`}
            className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-sm", active === t.slug ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
            {t.nameVi}
          </Link>
        ))}
      </div>
    </nav>
  );
}
