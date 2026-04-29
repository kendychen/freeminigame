import Link from "next/link";
import {
  Trophy,
  Zap,
  Users,
  Activity,
  Layers,
  Crown,
  ArrowRight,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PickleballLogo } from "@/components/brand/PickleballLogo";

const FORMATS = [
  { icon: Trophy, name: "Single Elim", desc: "Loại trực tiếp 1 lần thua" },
  { icon: Crown, name: "Double Elim", desc: "Loại trực tiếp 2 lần thua" },
  { icon: Layers, name: "Round Robin", desc: "Vòng tròn tính điểm" },
  { icon: Activity, name: "Swiss", desc: "Ghép theo điểm, không loại" },
  { icon: Users, name: "Group + KO", desc: "Bảng đấu + loại trực tiếp" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <PickleballLogo size={28} />
            <span>FreeMinigame</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/15 via-secondary/40 to-transparent"
          />
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                100% miễn phí · Pickleball ready
              </span>

              <h1 className="mt-5 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:mt-6 sm:text-5xl md:text-6xl">
                Tổ chức giải{" "}
                <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  Pickleball
                </span>{" "}
                trong vài giây
              </h1>

              <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
                Chia cặp · Bốc thăm chia bảng realtime · Sơ đồ thi đấu tự động.
                Hoạt động trên điện thoại — share link là mọi người cùng xem.
              </p>

              <div className="mt-8 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:gap-3">
                <Link href="/pair/new" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:min-w-[220px]">
                    <Radio className="size-4" />
                    Bốc thăm realtime
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/quick/new" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:min-w-[220px]"
                  >
                    <Zap className="size-4" />
                    Chia cặp nhanh
                  </Button>
                </Link>
                <Link href="/login" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full sm:min-w-[220px]"
                  >
                    <Trophy className="size-4" />
                    Giải đấu Live
                  </Button>
                </Link>
              </div>
              <p className="mt-3 px-2 text-center text-xs text-muted-foreground">
                Realtime: link mọi người vào xem · Quick: chia cặp local ngay ·
                Live: giải đấu đa admin
              </p>
            </div>
          </div>
        </section>

        {/* Formats — mobile-first horizontal scroll */}
        <section className="border-t bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              5 thể thức đấu chuẩn
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground sm:text-base">
              Chia cặp · Bốc thăm · Theo dõi điểm tự động — phù hợp giải đấu
              Pickleball, cầu lông, ping pong, bóng bàn…
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              {FORMATS.map((f) => (
                <div
                  key={f.name}
                  className="rounded-xl border bg-background p-4 transition-all hover:border-primary/40 hover:shadow-md sm:p-5"
                >
                  <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold sm:text-base">
                    {f.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2 modes */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 sm:p-6">
              <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/15">
                <Zap className="size-5 text-primary" />
              </div>
              <h3 className="mt-3 text-lg font-bold sm:text-xl">Quick Mode</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Chia cặp tức thì 8-64 đội. Toàn bộ chạy trên trình duyệt. Không
                cần đăng ký.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>✓ 5 thể thức đấu</li>
                <li>✓ Nhập điểm trực tiếp</li>
                <li>✓ Xuất PDF/CSV</li>
                <li>✓ Share link 72h</li>
              </ul>
              <Link href="/quick/new" className="mt-5 block">
                <Button className="w-full sm:w-auto">Bắt đầu ngay</Button>
              </Link>
            </div>
            <div className="rounded-2xl border bg-card p-5 sm:p-6">
              <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/15">
                <Trophy className="size-5 text-primary" />
              </div>
              <h3 className="mt-3 text-lg font-bold sm:text-xl">
                Live Tournament
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Tạo giải dài, đa admin realtime, viewer xem live. Bốc thăm chia
                bảng + sơ đồ thi đấu tự sinh.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>✓ Đa admin realtime</li>
                <li>✓ Public viewer link</li>
                <li>✓ BO3/BO5, tie-breakers</li>
                <li>✓ Stats & MVP</li>
              </ul>
              <Link href="/login" className="mt-5 block">
                <Button variant="outline" className="w-full sm:w-auto">
                  Đăng nhập
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground sm:h-16 sm:text-sm">
          <span className="flex items-center gap-1.5">
            <PickleballLogo size={16} /> © {new Date().getFullYear()}{" "}
            FreeMinigame
          </span>
          <Link href="/quick/new" className="hover:text-foreground">
            Tạo cặp nhanh
          </Link>
        </div>
      </footer>
    </div>
  );
}
