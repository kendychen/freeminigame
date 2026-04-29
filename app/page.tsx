import Link from "next/link";
import {
  Trophy,
  Zap,
  Users,
  Activity,
  Layers,
  Crown,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const FORMATS = [
  { icon: Trophy, name: "Single Elimination", desc: "Loại trực tiếp 1 lần thua" },
  { icon: Crown, name: "Double Elimination", desc: "Loại trực tiếp 2 lần thua" },
  { icon: Layers, name: "Round Robin", desc: "Vòng tròn tính điểm" },
  { icon: Activity, name: "Swiss System", desc: "Ghép theo điểm, không loại" },
  { icon: Users, name: "Group + Knockout", desc: "Bảng đấu + loại trực tiếp" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Trophy className="size-5 text-primary" />
            FreeMinigame
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="flex flex-col items-center text-center">
            <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium">
              100% Miễn phí · Không cần đăng ký
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Tạo bảng đấu minigame trong{" "}
              <span className="text-primary">vài giây</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Chia cặp tự động, bốc thăm thông minh, theo dõi kết quả realtime.
              Hỗ trợ 5 thể thức đấu phổ biến nhất. Không cần cài đặt — chạy thẳng
              trên trình duyệt.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/quick/new">
                <Button size="lg" className="min-w-[220px]">
                  <Zap className="size-4" />
                  Tạo cặp nhanh
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="min-w-[220px]">
                  <Trophy className="size-4" />
                  Giải đấu trực tiếp
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Quick Mode: chia cặp ngay không cần đăng nhập · Live Mode: nhập
              điểm realtime, nhiều admin
            </p>
          </div>
        </section>

        <section className="border-t bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-3xl font-bold">Hỗ trợ 5 thể thức</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Chọn thể thức phù hợp với giải đấu của bạn — chúng tôi tự động lo
              phần chia cặp, bốc thăm, và theo dõi điểm.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {FORMATS.map((f) => (
                <div
                  key={f.name}
                  className="rounded-lg border bg-background p-5 transition-shadow hover:shadow-md"
                >
                  <f.icon className="size-6 text-primary" />
                  <h3 className="mt-4 font-semibold">{f.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-lg border p-6">
              <Zap className="size-6 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">Quick Mode</h3>
              <p className="mt-2 text-muted-foreground">
                Chia cặp tức thì cho 8-32 đội. Toàn bộ chạy trong trình duyệt.
                Lưu state vào URL hoặc localStorage. Không cần tài khoản.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>• Chia cặp 5 thể thức</li>
                <li>• Nhập điểm + advance bracket</li>
                <li>• Xuất PDF/PNG/CSV</li>
                <li>• Chia sẻ link 72h</li>
              </ul>
              <Link href="/quick/new" className="mt-6 inline-block">
                <Button>Bắt đầu ngay</Button>
              </Link>
            </div>
            <div className="rounded-lg border p-6">
              <Trophy className="size-6 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">Live Tournament</h3>
              <p className="mt-2 text-muted-foreground">
                Tạo giải đấu kéo dài, nhiều admin nhập điểm cùng lúc, viewer xem
                live không cần đăng nhập. Lưu trữ vĩnh viễn, audit log đầy đủ.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>• Đa admin realtime</li>
                <li>• Public viewer link</li>
                <li>• BO3/BO5, seeding, tie-breakers</li>
                <li>• Stats & MVP highlights</li>
              </ul>
              <Link href="/login" className="mt-6 inline-block">
                <Button variant="outline">Đăng nhập</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} FreeMinigame</span>
          <Link href="/quick/new" className="hover:text-foreground">
            Tạo cặp nhanh
          </Link>
        </div>
      </footer>
    </div>
  );
}
