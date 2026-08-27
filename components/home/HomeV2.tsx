import Link from "next/link";
import {
  Dices,
  Activity,
  Zap,
  RefreshCw,
  Users,
  PlayCircle,
  ArrowRight,
  Smartphone,
  Link2,
  MonitorPlay,
} from "lucide-react";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { getOptionalUser } from "@/lib/auth";
import { FORMATS, STRUCTURED_DATA } from "./HomeV1";

const STEPS = [
  { n: "Bước 1", t: "Tạo giải, nhập đội" },
  { n: "Bước 2", t: "Bốc thăm chia bảng" },
  { n: "Bước 3", t: "Gửi link trọng tài" },
  { n: "Bước 4", t: "Theo dõi bảng xếp hạng" },
];

/** Home page for theme V2 — header/footer come from the root layout. */
export async function HomeV2() {
  const { user } = await getOptionalUser();
  const TOOLS = [
    { href: "/pair/new", icon: Dices, title: "Bốc thăm realtime", desc: "Chia bảng, hiện đồng thời trên mọi máy" },
    { href: "/score/new", icon: Activity, title: "Tỷ số nhanh", desc: "Chấm điểm 1 trận, share link cho khán giả" },
    { href: "/quick/new", icon: Zap, title: "Chia cặp nhanh", desc: "Không cần tài khoản, chạy offline" },
    { href: user ? "/pic/new" : "/quick/pic/new", icon: RefreshCw, title: "PIC xoay cặp", desc: "Đổi cặp mỗi vòng, tính điểm cá nhân" },
    { href: user ? "/team/new" : "/login", icon: Users, title: "Giải đồng đội", desc: "Đội gặp đội, nhiều trận mỗi tie" },
    { href: "/videos", icon: PlayCircle, title: "Video kỹ thuật", desc: "Cơ bản → nâng cao, Việt Nam & thế giới" },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pb-8 pt-8 sm:pt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:pt-16">
          <div>
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              100% miễn phí · không cần đăng ký
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Tổ chức giải Pickleball <span className="text-primary">trong vài giây</span>
            </h1>
            <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-muted-foreground">
              Bốc thăm chia bảng realtime, sơ đồ thi đấu tự động, trọng tài chấm điểm qua link. Chạy ngay trên điện thoại.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/pair/new"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_4px_14px_hsl(var(--primary)/0.35)] transition-transform hover:-translate-y-0.5"
              >
                <Dices className="size-4" /> Bốc thăm ngay
              </Link>
              <Link
                href={user ? "/dashboard" : "/login"}
                className="inline-flex h-11 items-center gap-2 rounded-xl border bg-card px-5 text-sm font-bold transition-colors hover:bg-secondary"
              >
                {user ? "Bảng điều khiển" : "Tạo giải đấu Live"} <ArrowRight className="size-4" />
              </Link>
            </div>
            <dl className="mt-7 flex flex-wrap gap-6 text-xs text-muted-foreground">
              <div><dt className="text-xl font-extrabold text-foreground">5</dt><dd>thể thức đấu</dd></div>
              <div><dt className="text-xl font-extrabold text-foreground">Realtime</dt><dd>đồng bộ mọi máy</dd></div>
              <div><dt className="text-xl font-extrabold text-foreground">0đ</dt><dd>mãi mãi</dd></div>
            </dl>
          </div>

          <div
            aria-hidden
            className="relative overflow-hidden rounded-3xl bg-[hsl(230_45%_16%)] p-5 text-white shadow-[0_20px_50px_rgba(20,10,0,0.18)] dark:bg-card dark:shadow-none"
          >
            <div className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full bg-primary/25" />
            <div className="flex justify-between text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="size-2 animate-pulse rounded-full bg-red-500" /> Sân 2 · Chung kết
              </span>
              <span>Giải Mùa Thu 2026</span>
            </div>
            <div className="mt-2 divide-y divide-white/10">
              <div className="flex items-center justify-between py-3">
                <span className="font-semibold">Kendy / Linh</span>
                <span className="text-4xl font-extrabold text-primary">11</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-semibold">Minh / An</span>
                <span className="text-4xl font-extrabold text-white/50">7</span>
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/70">
              <span>Trọng tài: Hùng</span><span>Set 2/3</span>
            </div>
          </div>
        </section>

        {/* Tools */}
        <section className="mx-auto w-full max-w-7xl px-4 py-6">
          <h2 className="text-2xl font-bold tracking-tight">Bắt đầu ngay</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chọn công cụ, không cần cài đặt.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {TOOLS.map((t) => (
              <Link
                key={t.title}
                href={t.href}
                className="group flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary md:flex-row md:items-start md:gap-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <t.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{t.title}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{t.desc}</span>
                </span>
                <ArrowRight className="ml-auto hidden size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 md:block" />
              </Link>
            ))}
          </div>
        </section>

        {/* Formats */}
        <section id="formats" className="mx-auto w-full max-w-7xl px-4 py-6">
          <h2 className="text-2xl font-bold tracking-tight">5 thể thức đấu chuẩn</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sơ đồ sinh tự động, cập nhật tức thì khi có kết quả.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <span key={f.name} className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-[13px] font-semibold">
                <f.icon className="size-4 text-primary" />
                {f.name}
                <span className="font-medium text-muted-foreground">{f.desc}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Referee */}
        <section className="mx-auto w-full max-w-7xl px-4 py-6">
          <h2 className="text-2xl font-bold tracking-tight">Trọng tài chấm điểm cực gọn</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mỗi sân một link, bấm là cập nhật cho tất cả.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold"><Link2 className="size-4 text-primary" /> Link riêng cho từng sân</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Ban tổ chức gửi link, trọng tài mở trên điện thoại, không cần đăng nhập.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold"><MonitorPlay className="size-4 text-primary" /> Màn hình hiển thị</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Trang hiển thị cho TV hoặc máy chiếu, tự đổi trận khi có kết quả.
              </p>
            </div>
          </div>
          <ol className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl bg-secondary px-3 py-2.5 text-[13px]">
                <span className="block text-[11px] font-bold uppercase text-primary">{s.n}</span>
                {s.t}
              </li>
            ))}
          </ol>
        </section>

        {/* PWA */}
        <section className="mx-auto w-full max-w-7xl px-4 py-6">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><Smartphone className="size-4 text-primary" /> Cài như app trên điện thoại</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Android: Menu ⋮ → Thêm vào màn hình chính · iOS: Chia sẻ → Thêm vào MH chính
              </p>
            </div>
          </div>
        </section>
      </main>
      <InstallPrompt />
    </>
  );
}
