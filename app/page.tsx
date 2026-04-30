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
  Gavel,
  Link2,
  Smartphone,
  Wifi,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PickleballLogo } from "@/components/brand/PickleballLogo";
import { AuthNavLink } from "@/components/nav/AuthNavLink";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { getOptionalUser } from "@/lib/auth";

const FORMATS = [
  { icon: Trophy, name: "Single Elim", desc: "Loại trực tiếp 1 lần thua" },
  { icon: Crown, name: "Double Elim", desc: "Loại trực tiếp 2 lần thua" },
  { icon: Layers, name: "Round Robin", desc: "Vòng tròn tính điểm" },
  { icon: Activity, name: "Swiss", desc: "Ghép theo điểm, không loại" },
  { icon: Users, name: "Group + KO", desc: "Bảng đấu + loại trực tiếp" },
];

export default async function HomePage() {
  const { user } = await getOptionalUser();
  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <PickleballLogo size={28} />
            <span>FreeMinigame</span>
          </Link>
          <div className="flex items-center gap-2">
            <AuthNavLink />
            <ThemeToggle />
          </div>
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
                Chia cặp · Bốc thăm chia bảng realtime · Sơ đồ thi đấu tự động ·
                Trọng tài chấm điểm live qua link share. Hoạt động trên điện
                thoại — mọi người cùng xem realtime.
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
                <Link
                  href={user ? "/dashboard" : "/login"}
                  className="w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full sm:min-w-[220px]"
                  >
                    <Trophy className="size-4" />
                    {user ? "Bảng điều khiển" : "Giải đấu Live"}
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

        {/* Trọng tài + realtime score */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Gavel className="size-3.5" />
                Mới · Trọng tài realtime
              </span>
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
                Trọng tài chấm điểm cực gọn
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Mỗi bảng / cúp có 1 link riêng — gửi qua Zalo, trọng tài mở
                điện thoại bấm <strong>+1</strong> là điểm số nhảy live cho
                tất cả viewer, không cần F5.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Link2 className="size-5 text-primary" />
                </div>
                <h3 className="mt-3 text-sm font-semibold sm:text-base">
                  Link share — không cần đăng nhập
                </h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Admin tạo URL trọng tài 1 click. Trọng tài chỉ cần mở link là
                  chấm được, ko đăng ký.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="size-5 text-primary" />
                </div>
                <h3 className="mt-3 text-sm font-semibold sm:text-base">
                  Fullscreen +1 / −1
                </h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Giao diện 2 cột to bự, nút +1 chiếm gần nửa màn hình. Wake-lock
                  chống tắt màn khi đang trận.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Wifi className="size-5 text-primary" />
                </div>
                <h3 className="mt-3 text-sm font-semibold sm:text-base">
                  Sync realtime mọi thiết bị
                </h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Trọng tài bấm là viewer + admin thấy tỉ số ngay. Lịch + bảng
                  điểm tự update không cần reload.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <ShieldCheck className="size-5 text-primary" />
                </div>
                <h3 className="mt-3 text-sm font-semibold sm:text-base">
                  Kết thúc thủ công, có thể mở lại
                </h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Bấm 2 lần để xác nhận kết thúc — chống nhầm. Đội thắng tự
                  advance vào vòng KO tiếp theo.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border bg-secondary/30 p-5 sm:p-6 lg:col-span-2">
                <h3 className="text-base font-bold sm:text-lg">
                  Workflow gửi link cho trọng tài
                </h3>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <strong className="text-foreground">1.</strong> Vào trang
                    bảng đấu / sơ đồ → bấm{" "}
                    <strong className="text-foreground">⚖️ Link trọng tài</strong>{" "}
                    cho bảng A / B / C / Cúp chính / Cúp phụ
                  </li>
                  <li>
                    <strong className="text-foreground">2.</strong> URL tự
                    copy clipboard — paste vào Zalo / Messenger gửi trọng tài
                  </li>
                  <li>
                    <strong className="text-foreground">3.</strong> Trọng tài
                    mở link → thấy danh sách trận → bấm 1 trận → màn hình +/-
                    điểm
                  </li>
                  <li>
                    <strong className="text-foreground">4.</strong> Bấm{" "}
                    <strong className="text-foreground">Kết thúc trận</strong>{" "}
                    khi xong — đội thắng tự đẩy vào vòng tiếp
                  </li>
                  <li>
                    <strong className="text-foreground">5.</strong> Cần thu
                    hồi link? Admin bấm 1 phát là vô hiệu hoá
                  </li>
                </ol>
              </div>
              <div className="rounded-2xl border bg-card p-5 sm:p-6">
                <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/15">
                  <Plus className="size-5 text-primary" />
                </div>
                <h3 className="mt-3 text-base font-bold sm:text-lg">
                  Mặc định ai cũng dùng được
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li>✓ Pickleball, cầu lông, ping pong</li>
                  <li>✓ Bóng bàn, bóng đá mini, futsal</li>
                  <li>✓ Boardgame, esport, minigame văn phòng</li>
                  <li>✓ BO1 / BO3 / BO5 đều OK</li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Hoạt động cả khi trọng tài offline tạm thời — kết nối lại tự
                  đồng bộ.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Install as app */}
        <section className="border-t bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
            <div className="grid gap-6 lg:grid-cols-3 lg:items-center">
              <div className="lg:col-span-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  📱 PWA
                </span>
                <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Cài như app trên điện thoại
                </h2>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                  Mở mỗi lần là toàn màn hình, không URL bar — y hệt một app native.
                  Không cần Play Store, không tốn dung lượng.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-background p-3 text-sm">
                    <p className="font-semibold">📱 Android (Chrome / Edge)</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bấm <strong>⋮</strong> góc phải → <strong>Cài đặt ứng
                      dụng</strong> (hoặc đợi banner "Cài đặt" hiện ra ở dưới).
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-sm">
                    <p className="font-semibold">🍎 iPhone / iPad (Safari)</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bấm <strong>Share ⬆</strong> → <strong>Thêm vào Màn hình
                      chính</strong>. Mở từ home screen sẽ ko có URL bar.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="flex size-48 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-2xl">
                  <PickleballLogo size={120} />
                </div>
              </div>
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
                <li>✓ Link trọng tài per-bảng / per-cúp</li>
                <li>✓ Public viewer link · điểm số live</li>
                <li>✓ BO3/BO5, tie-breakers, stats MVP</li>
              </ul>
              <Link
                href={user ? "/dashboard" : "/login"}
                className="mt-5 block"
              >
                <Button variant="outline" className="w-full sm:w-auto">
                  {user ? "Bảng điều khiển" : "Đăng nhập"}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <InstallPrompt />

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
