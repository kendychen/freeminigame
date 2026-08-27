import Link from "next/link";
import type { ReactNode } from "react";
import type { HeroMatch } from "@/lib/home-live-match";

const SERIES: Record<string, string> = { bo1: "1 ván", bo3: "Bo3", bo5: "Bo5" };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[hsl(230_45%_16%)] p-5 text-white shadow-[0_20px_50px_rgba(20,10,0,0.18)] dark:bg-card dark:shadow-none">
      <div className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full bg-primary/25" />
      {children}
    </div>
  );
}

function Row({ name, score, hot }: { name: string; score: number; hot: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="truncate font-semibold">{name}</span>
      <span className={`text-4xl font-extrabold ${hot ? "text-primary" : "text-white/50"}`}>{score}</span>
    </div>
  );
}

/** V2 hero card: latest completed final (tournament or PIC) > static mock. */
export function HeroScoreCard({ match }: { match: HeroMatch | null }) {
  if (!match) {
    return (
      <div aria-hidden>
        <Shell>
          <div className="flex justify-between text-xs text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="size-2 animate-pulse rounded-full bg-red-500" /> Sân 2 · Chung kết
            </span>
            <span>Giải Mùa Thu 2026 <span className="opacity-60">· minh hoạ</span></span>
          </div>
          <div className="mt-2 divide-y divide-white/10">
            <Row name="Kendy / Linh" score={11} hot />
            <Row name="Minh / An" score={7} hot={false} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-white/70">
            <span>Trọng tài: Hùng</span><span>Set 2/3</span>
          </div>
        </Shell>
      </div>
    );
  }

  const byScore = match.live || !match.winner;
  const hotA = byScore ? match.scoreA >= match.scoreB : match.winner === "a";
  const hotB = byScore ? match.scoreB >= match.scoreA : match.winner === "b";
  return (
    <Link
      href={match.href}
      className="block transition-transform hover:-translate-y-0.5"
      aria-label={`Xem giải ${match.tournamentName}`}
    >
      <Shell>
        <div className="flex justify-between gap-3 text-xs text-white/70">
          <span className="flex shrink-0 items-center gap-1.5">
            {match.live ? (
              <>
                <span className="size-2 animate-pulse rounded-full bg-red-500" /> Đang đấu · {match.roundLabel}
              </>
            ) : (
              <>🏆 {match.roundLabel}</>
            )}
          </span>
          <span className="truncate">{match.tournamentName}</span>
        </div>
        <div className="mt-2 divide-y divide-white/10">
          <Row name={match.teamA} score={match.scoreA} hot={hotA} />
          <Row name={match.teamB} score={match.scoreB} hot={hotB} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/70">
          <span>{match.live ? "Cập nhật trực tiếp" : `Kết thúc ${fmtDate(match.updatedAt)}`}</span>
          <span>{SERIES[match.seriesFormat] ?? match.seriesFormat} · Xem giải →</span>
        </div>
      </Shell>
    </Link>
  );
}
