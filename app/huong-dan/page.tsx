import type { Metadata } from "next";
import Link from "next/link";
import {
  Dices,
  Activity,
  Zap,
  RefreshCw,
  Users,
  Trophy,
  PlayCircle,
  Link2,
  MonitorPlay,
  Smartphone,
  LockOpen,
  Lock,
} from "lucide-react";
import { FORMAT_GUIDE } from "@/lib/formats-guide";

export const metadata: Metadata = {
  title: "Hướng dẫn sử dụng — Hội Nhóm Pickleball",
  description:
    "Hướng dẫn từng bước: bốc thăm chia bảng, chấm tỷ số, chia cặp nhanh, tạo giải đấu Live, chọn thể thức và gửi link trọng tài.",
};

const TOOLS = [
  {
    icon: Dices,
    title: "Bốc thăm realtime",
    href: "/pair/new",
    auth: false,
    when: "Cần chia cặp/chia bảng công khai, mọi người cùng xem kết quả trên máy mình.",
    steps: [
      "Nhập tên phòng, chọn số người mỗi nhóm (2 = chia cặp).",
      "Chọn Preset (bạn nhập sẵn danh sách) hoặc Lobby (ai vào link tự nhập tên).",
      "Bấm Tạo phòng → gửi link cho mọi người → bấm Bốc thăm. Mỗi phòng chỉ bốc 1 lần.",
    ],
  },
  {
    icon: Activity,
    title: "Tỷ số nhanh",
    href: "/score/new",
    auth: false,
    when: "Chấm điểm 1 trận lẻ, muốn khán giả xem tỷ số trực tiếp.",
    steps: [
      "Nhập tên 2 đội, điểm mục tiêu (mặc định 11).",
      "Bạn giữ link trọng tài để bấm +/−; gửi link xem cho khán giả.",
      "Kết thúc trận → tỷ số được lưu lại.",
    ],
  },
  {
    icon: Zap,
    title: "Chia cặp nhanh",
    href: "/quick/new",
    auth: false,
    when: "Tự tổ chức giải nhỏ ngay trên 1 điện thoại, không cần tài khoản.",
    steps: [
      "Bước 1: đặt tên giải, chọn thể thức (xem bảng so sánh bên dưới).",
      "Bước 2: dán danh sách đội, mỗi dòng 1 tên.",
      "Bước 3: xem sơ đồ, nhập kết quả từng trận. Dữ liệu nằm trong máy bạn.",
    ],
  },
  {
    icon: RefreshCw,
    title: "PIC xoay cặp",
    href: "/quick/pic/new",
    auth: false,
    when: "Giao lưu cá nhân: mỗi vòng đổi bạn cặp, tính điểm từng người.",
    steps: [
      "Nhập danh sách người chơi và số sân.",
      "Mỗi vòng app tự ghép cặp mới và xếp sân.",
      "Nhập tỷ số → bảng xếp hạng cá nhân cập nhật. Có tài khoản thì tạo tại /pic/new để nhiều người cùng chấm.",
    ],
  },
  {
    icon: Trophy,
    title: "Giải đấu Live",
    href: "/dashboard/new",
    auth: true,
    when: "Giải chính thức nhiều sân, nhiều trọng tài, có màn hình hiển thị cho khán giả.",
    steps: [
      "Đăng nhập (miễn phí, không cần xác minh email) → Bảng điều khiển → Tạo giải.",
      "Chọn thể thức, thêm đội, bấm Bốc thăm để sinh sơ đồ.",
      "Gửi link trọng tài cho từng sân, mở link hiển thị trên TV. Kết quả tự đồng bộ.",
    ],
  },
  {
    icon: Users,
    title: "Giải đồng đội",
    href: "/team/new",
    auth: true,
    when: "Đội gặp đội, mỗi cặp đấu (tie) gồm nhiều trận đơn/đôi.",
    steps: [
      "Đăng nhập → Giải đồng đội → nhập các đội và thành viên.",
      "Chọn số trận mỗi tie và thể thức vòng đấu.",
      "Trọng tài chấm từng trận, đội thắng nhiều trận hơn thắng tie.",
    ],
  },
  {
    icon: PlayCircle,
    title: "Video kỹ thuật",
    href: "/videos",
    auth: false,
    when: "Mới tập hoặc muốn nâng trình: dink, serve, third shot…",
    steps: [
      "Chọn kỹ thuật ở thanh trên.",
      "Lọc Việt Nam / thế giới và mức Cơ bản / Nâng cao.",
      "Video được chọn lọc tự động mỗi ngày.",
    ],
  },
];

const FAQ = [
  {
    q: "Tôi có cần đăng ký không?",
    a: "Không, trừ Giải đấu Live và Giải đồng đội. Tài khoản miễn phí, đăng ký bằng email hoặc Google trong 10 giây.",
  },
  {
    q: "Bốc thăm nhầm thì làm lại được không?",
    a: "Không — mỗi phòng bốc thăm chỉ bốc 1 lần để kết quả là cuối cùng, ai cũng tin. Kiểm tra kỹ danh sách trước khi bấm; nếu nhầm, tạo phòng mới.",
  },
  {
    q: "Trọng tài có cần tài khoản không?",
    a: "Không. Trọng tài chỉ cần mở link bạn gửi trên điện thoại. Ai có link đó đều chấm được, nên chỉ gửi cho người tin cậy.",
  },
  {
    q: "Mở link trong Zalo/Messenger bị lỗi đăng nhập Google?",
    a: "Trình duyệt trong app chặn Google. Bấm ⋯ → Mở bằng trình duyệt (Chrome/Safari) rồi đăng nhập lại.",
  },
  {
    q: "Dữ liệu Chia cặp nhanh lưu ở đâu?",
    a: "Trong trình duyệt trên máy bạn. Xóa dữ liệu trình duyệt hoặc đổi máy là mất. Cần lưu lâu dài thì dùng Giải đấu Live.",
  },
];

export default function GuidePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hướng dẫn sử dụng</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Chưa dùng bao giờ? Chọn công cụ theo việc bạn cần làm. Hầu hết không cần đăng nhập.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
            <LockOpen className="size-3.5 text-primary" /> Không cần đăng nhập
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
            <Lock className="size-3.5 text-muted-foreground" /> Cần tài khoản (miễn phí)
          </span>
        </div>
      </header>

      <nav aria-label="Mục lục" className="mt-6 flex flex-wrap gap-2 text-sm">
        {[
          ["#cong-cu", "Chọn công cụ"],
          ["#the-thuc", "So sánh thể thức"],
          ["#trong-tai", "Trọng tài & màn hình"],
          ["#cai-app", "Cài như app"],
          ["#faq", "Câu hỏi thường gặp"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full bg-secondary px-3 py-1.5 font-medium hover:bg-secondary/70">
            {label}
          </a>
        ))}
      </nav>

      <section id="cong-cu" className="mt-10 scroll-mt-20">
        <h2 className="text-2xl font-bold">1. Chọn công cụ theo việc cần làm</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {TOOLS.map((t) => (
            <article key={t.title} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <t.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="flex flex-wrap items-center gap-2 font-bold">
                    {t.title}
                    {t.auth ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <Lock className="size-3" /> Cần tài khoản
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <LockOpen className="size-3" /> Không cần đăng nhập
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t.when}</p>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5 text-sm">
                {t.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <Link
                href={t.href}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Mở {t.title}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="the-thuc" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold">2. Chọn thể thức nào?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nguyên tắc: ít thời gian → Loại trực tiếp. Muốn ai cũng đấu nhiều → Vòng tròn hoặc Swiss. Giải lớn cả ngày → Vòng bảng + Loại trực tiếp.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Thể thức</th>
                <th className="px-4 py-2.5">Cách chơi</th>
                <th className="px-4 py-2.5">Hợp với</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(FORMAT_GUIDE).map(([k, g]) => (
                <tr key={k}>
                  <td className="px-4 py-3 font-semibold">{g.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.short}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.fit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="trong-tai" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold">3. Trọng tài & màn hình hiển thị</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold"><Link2 className="size-4 text-primary" /> Link trọng tài</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Trong trang quản lý giải, mỗi sân có nút <strong>Copy link trọng tài</strong>. Gửi qua Zalo cho người chấm. Họ mở link, bấm +/− và Kết thúc trận — không cần tài khoản.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold"><MonitorPlay className="size-4 text-primary" /> Màn hình lớn</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Nút <strong>Màn hình hiển thị</strong> (có ở giải đấu, PIC xoay cặp và giải đồng đội) mở trang cho TV/máy chiếu: tỷ số đang đấu, bảng xếp hạng, nhánh đấu tự xoay và tự cập nhật khi có kết quả. Mở link trên trình duyệt TV hoặc cast từ điện thoại/laptop rồi bấm "Toàn màn hình"; nếu TV tự tắt màn thì tắt screensaver trong cài đặt TV.
            </p>
          </div>
        </div>
      </section>

      <section id="cai-app" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold">4. Cài như app trên điện thoại</h2>
        <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold"><Smartphone className="size-4 text-primary" /> Không cần tải từ store</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><strong>Android (Chrome):</strong> Menu ⋮ → <em>Thêm vào màn hình chính</em>.</li>
            <li><strong>iPhone (Safari):</strong> nút Chia sẻ → <em>Thêm vào MH chính</em>.</li>
          </ul>
        </div>
      </section>

      <section id="faq" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold">5. Câu hỏi thường gặp</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border bg-card px-5 py-3 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold marker:content-none">
                {f.q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Vẫn vướng? Nhắn admin qua{" "}
          <a href="https://www.facebook.com/linhnguyendac93" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">
            Facebook
          </a>
          .
        </p>
      </section>
    </main>
  );
}
